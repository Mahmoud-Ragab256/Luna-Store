import { app } from './app.js';
import { connectDatabase } from './database/connection.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { expireReservations } from './modules/commerce/service.js';
import mongoose from 'mongoose';
await connectDatabase();
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'LUNA API listening'));
server.requestTimeout = 30000;
server.headersTimeout = 15000;
server.on('error', (error) => logger.error({ err: error }, 'HTTP server error'));
const expiryTimer = setInterval(
  () =>
    expireReservations().catch((error) => logger.error({ err: error }, 'Inventory expiry failed')),
  60000,
);
expiryTimer.unref();
async function shutdown() {
  clearInterval(expiryTimer);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
