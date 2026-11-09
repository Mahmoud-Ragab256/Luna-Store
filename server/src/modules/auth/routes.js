import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { User, Session } from '../../database/models.js';
import { env } from '../../config/env.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../../common/middleware/auth.js';
import { AppError } from '../../common/errors/app-error.js';
import * as auth from './auth.service.js';
import { queueAccountEmail as sendAccountEmail } from '../../integrations/email/outbox.service.js';
export const authRouter = Router();
const email = z
  .string()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase().trim());
const password = z.string().min(10, 'Use at least 10 characters.').max(128);
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1/auth',
  maxAge: 30 * 86400000,
};
const replySession = (res, result, status = 200) => {
  res.cookie('luna_refresh', result.refreshToken, cookieOptions);
  res.status(status).json({ data: { user: result.user, accessToken: result.accessToken } });
};
authRouter.use(
  rateLimit({
    windowMs: 15 * 60000,
    limit: env.NODE_ENV === 'test' ? 1000 : 40,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);
authRouter.post(
  '/register',
  validate(z.object({ name: z.string().trim().min(2).max(100), email, password })),
  async (req, res) =>
    replySession(res, await auth.register(req.validated, req.get('user-agent')), 201),
);
authRouter.post(
  '/login',
  validate(z.object({ email, password: z.string().min(1).max(128) })),
  async (req, res) => replySession(res, await auth.login(req.validated, req.get('user-agent'))),
);
authRouter.post('/refresh', async (req, res) =>
  replySession(res, await auth.refresh(req.cookies.luna_refresh, req.get('user-agent'))),
);
authRouter.post('/logout', async (req, res) => {
  if (req.cookies.luna_refresh)
    await Session.updateOne(
      { refreshTokenHash: auth.hashToken(req.cookies.luna_refresh) },
      { $set: { revokedAt: new Date() } },
    );
  res.clearCookie('luna_refresh', { ...cookieOptions, maxAge: undefined });
  res.json({ data: { message: 'Signed out.' } });
});
authRouter.get('/me', requireAuth, (req, res) => res.json({ data: auth.publicUser(req.user) }));
authRouter.post('/forgot-password', validate(z.object({ email })), async (req, res) => {
  const user = await User.findOne({ email: req.validated.email, isActive: true });
  if (user) {
    const token = randomBytes(32).toString('hex');
    user.resetTokenHash = auth.hashToken(token);
    user.resetExpiresAt = new Date(Date.now() + 30 * 60000);
    await user.save();
    await sendAccountEmail(
      user.email,
      'Reset your LUNA password',
      `Reset your password: ${env.CLIENT_ORIGIN}/reset-password#token=${token}`,
    );
  }
  res.json({
    data: { message: 'If an account exists, password reset instructions will be emailed.' },
  });
});
authRouter.post(
  '/reset-password',
  validate(z.object({ token: z.string().min(32).max(200), password })),
  async (req, res) => {
    const user = await User.findOneAndUpdate(
      { resetTokenHash: auth.hashToken(req.validated.token), resetExpiresAt: { $gt: new Date() } },
      {
        $set: { passwordHash: await bcrypt.hash(req.validated.password, 12) },
        $unset: { resetTokenHash: 1, resetExpiresAt: 1 },
      },
    );
    if (!user) throw new AppError(400, 'Reset link is invalid or expired. Request a new link.');
    await Session.updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
    res.json({ data: { message: 'Password updated. Please sign in.' } });
  },
);
authRouter.post(
  '/verify-email',
  validate(z.object({ token: z.string().min(32).max(200) })),
  async (req, res) => {
    const user = await User.findOneAndUpdate(
      {
        verifyTokenHash: auth.hashToken(req.validated.token),
        verifyExpiresAt: { $gt: new Date() },
      },
      { $set: { isEmailVerified: true }, $unset: { verifyTokenHash: 1, verifyExpiresAt: 1 } },
    );
    if (!user) throw new AppError(400, 'Verification link is invalid or expired.');
    res.json({ data: { message: 'Email verified.' } });
  },
);
