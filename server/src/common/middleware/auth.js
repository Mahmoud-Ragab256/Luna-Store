import jwt from 'jsonwebtoken';
import { User, Session } from '../../database/models.js';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new AppError(401, 'Please sign in to continue.', 'UNAUTHENTICATED');
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'luna-api', audience: 'luna-store' });
    const [user, session] = await Promise.all([User.findOne({ _id: payload.sub, isActive: true }), Session.findOne({ _id: payload.sid, revokedAt: null, expiresAt: { $gt: new Date() } })]);
    if (!user || !session || String(session.userId) !== String(user._id)) throw new AppError(401, 'Your session has expired. Please sign in again.');
    req.user = user; req.sessionId = session._id; next();
  } catch (error) { next(error instanceof AppError ? error : new AppError(401, 'Your session has expired. Please sign in again.')); }
}
export const requireAdmin = (req, res, next) => req.user?.role === 'admin' ? next() : next(new AppError(403, 'Administrator access required.', 'FORBIDDEN'));
