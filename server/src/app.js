import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { AppError } from './common/errors/app-error.js';
import { authRouter } from './modules/auth/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { catalogRouter } from './modules/catalog/routes.js';
import { adminRouter } from './modules/admin/routes.js';
import { commerceRouter } from './modules/commerce/routes.js';
export const app = express();
app.disable('x-powered-by');
app.use(helmet({ strictTransportSecurity: false, contentSecurityPolicy: { directives: { imgSrc: ["'self'", 'data:', 'https:'] } } }));
app.use(pinoHttp({ logger, genReqId: () => randomUUID(), autoLogging: env.NODE_ENV !== 'test' }));
app.use((req, res, next) => { res.setHeader('X-Request-Id', req.id); next(); });
app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(rateLimit({ windowMs: 60000, limit: env.NODE_ENV === 'test' ? 10000 : 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(express.json({ limit: '256kb', verify(req, res, buffer) { req.rawBody = buffer; } }));
app.use(cookieParser());
app.use((req, res, next) => {
  // Same-origin validation protects cookie-authenticated refresh/logout and login CSRF.
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.path !== '/api/v1/payments/webhook') {
    const origin = req.get('origin');
    if ((origin && origin !== env.CLIENT_ORIGIN) || req.get('sec-fetch-site') === 'cross-site') return next(new AppError(403, 'This request origin is not allowed.', 'CSRF_ORIGIN'));
    if (req.cookies.luna_refresh && !origin && !req.get('authorization')) return next(new AppError(403, 'An Origin header is required for cookie-authenticated requests.', 'CSRF_ORIGIN'));
  }
  next();
});
app.get('/api/v1/health', (req, res) => { const connected = mongoose.connection.readyState === 1; res.status(connected ? 200 : 503).json({ data: { status: connected ? 'ok' : 'database-unavailable', database: connected } }); });
app.get('/api/v1/openapi.json', (req, res) => res.type('application/json').send(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')));
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1', catalogRouter);
app.use('/api/v1', commerceRouter);
app.use('/api/v1/admin', adminRouter);
if (env.NODE_ENV === 'production') {
  const clientDirectory = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  app.use(express.static(clientDirectory));
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(`${clientDirectory}index.html`);
  });
}
app.use((req, res, next) => next(new AppError(404, 'The requested resource was not found.', 'NOT_FOUND')));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  let status = error.statusCode || error.status || 500;
  let message = error.message;
  let code = error.code || 'REQUEST_FAILED';
  let fields;
  if (error instanceof z.ZodError) { status = 422; message = 'Check the submitted fields.'; code = 'VALIDATION_ERROR'; fields = error.flatten().fieldErrors; }
  if (error.name === 'ValidationError' || error.name === 'CastError') { status = 422; message = 'The submitted data is invalid.'; code = 'VALIDATION_ERROR'; }
  if (error.code === 11000) { status = 409; message = 'This record already exists.'; code = 'DUPLICATE_RECORD'; }
  if (error.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'Images must be smaller than 5 MB.'; }
  if (status >= 500) { req.log.error({ err: error }, 'Request failed'); message = 'Something went wrong. Please try again.'; }
  res.status(status).json({ error: { code, message, ...(fields ? { fields } : {}) }, requestId: req.id });
});
export default app;
