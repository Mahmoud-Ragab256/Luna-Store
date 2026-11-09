import { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { expireReservations } from '../commerce/service.js';
import { deliverEmailOutbox } from '../../integrations/email/outbox.service.js';
import { AppError } from '../../common/errors/app-error.js';
import { cleanupUnusedImages } from '../../integrations/media/cleanup.service.js';

export const maintenanceRouter = Router();
maintenanceRouter.get('/maintenance', async (req, res) => {
  const expected = process.env.CRON_SECRET;
  const actual = req.get('authorization') || '';
  const bearer = Buffer.from(`Bearer ${expected}`);
  const supplied = Buffer.from(actual);
  if (!expected || supplied.length !== bearer.length || !timingSafeEqual(supplied, bearer))
    throw new AppError(401, 'Maintenance authorization required.');
  const expired = await expireReservations();
  const email = await deliverEmailOutbox({ limit: 1 });
  const images = await cleanupUnusedImages({ limit: 1 });
  res.json({ data: { expired, email, images } });
});
