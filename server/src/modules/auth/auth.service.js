import { randomBytes, randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Session } from '../../database/models.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { queueAccountEmail as sendAccountEmail } from '../../integrations/email/outbox.service.js';
import { logger } from '../../config/logger.js';
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const publicUser = (user) => ({
  _id: user._id,
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  addresses: user.addresses,
  isEmailVerified: user.isEmailVerified,
});
export async function createSession(user, deviceMetadata, family = randomUUID()) {
  const refreshToken = randomBytes(48).toString('base64url');
  const session = await Session.create({
    userId: user._id,
    refreshTokenHash: hashToken(refreshToken),
    tokenFamilyId: family,
    expiresAt: new Date(Date.now() + 30 * 86400000),
    deviceMetadata: String(deviceMetadata || '').slice(0, 300),
  });
  const accessToken = jwt.sign({ sid: String(session._id) }, env.JWT_SECRET, {
    subject: String(user._id),
    issuer: 'luna-api',
    audience: 'luna-store',
    expiresIn: '10m',
    algorithm: 'HS256',
  });
  return { refreshToken, accessToken, user: publicUser(user) };
}
export async function register(input, device) {
  if (await User.exists({ email: input.email }))
    throw new AppError(409, 'Unable to create an account with these details.');
  const verificationToken = randomBytes(32).toString('hex');
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 12),
    verifyTokenHash: hashToken(verificationToken),
    verifyExpiresAt: new Date(Date.now() + 86400000),
  });
  await sendAccountEmail(
    user.email,
    'Verify your LUNA email',
    `Verify your email: ${env.CLIENT_ORIGIN}/verify-email#token=${verificationToken}`,
  ).catch((error) => logger.warn({ err: error }, 'Verification email delivery failed'));
  return createSession(user, device);
}
const dummyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);
export async function login(input, device) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const valid = await bcrypt.compare(input.password, user?.passwordHash || dummyHash);
  if (!user || !valid || !user.isActive)
    throw new AppError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
  return createSession(user, device);
}
export async function refresh(token, device) {
  if (!token) throw new AppError(401, 'Please sign in again.');
  const previous = await Session.findOne({ refreshTokenHash: hashToken(token) });
  if (!previous) throw new AppError(401, 'Please sign in again.');
  if (previous.revokedAt) {
    // Any replay revokes the token family, including the replacement session.
    await Session.updateMany(
      { tokenFamilyId: previous.tokenFamilyId },
      { $set: { revokedAt: new Date(), reuseDetected: true } },
    );
    throw new AppError(401, 'Session reuse detected. Please sign in again.', 'SESSION_REUSE');
  }
  if (previous.expiresAt <= new Date())
    throw new AppError(401, 'Session expired. Please sign in again.');
  const claimed = await Session.findOneAndUpdate(
    { _id: previous._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  if (!claimed) {
    await Session.updateMany(
      { tokenFamilyId: previous.tokenFamilyId },
      { $set: { revokedAt: new Date(), reuseDetected: true } },
    );
    throw new AppError(401, 'Session reuse detected. Please sign in again.');
  }
  const user = await User.findOne({ _id: previous.userId, isActive: true });
  if (!user) throw new AppError(401, 'Please sign in again.');
  const result = await createSession(user, device, previous.tokenFamilyId);
  // Close a concurrent replay race that may revoke the family while replacement is being created.
  const familyReuse = await Session.exists({
    tokenFamilyId: previous.tokenFamilyId,
    reuseDetected: true,
  });
  if (familyReuse) {
    await Session.updateMany(
      { tokenFamilyId: previous.tokenFamilyId },
      { $set: { revokedAt: new Date() } },
    );
    throw new AppError(401, 'Please sign in again.');
  }
  return result;
}
