import { configureLocalMongo } from './mongodb-runtime.js';
configureLocalMongo();
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
if (process.env.NODE_ENV === 'production')
  throw new Error('Development database launcher is disabled in production.');
const databasePath = resolve('.runtime/mongodb');
await mkdir(databasePath, { recursive: true });
const db = await MongoMemoryReplSet.create({
  instanceOpts: [{ port: 27017, dbPath: databasePath, storageEngine: 'wiredTiger' }],
  replSet: { count: 1, name: 'rs0', storageEngine: 'wiredTiger' },
});
await writeFile('.runtime/mongodb-uri.txt', db.getUri('luna'));
console.log(
  `Development MongoDB replica set ready at ${db.getUri('luna')}. Data stays in .runtime/mongodb. Keep this terminal running.`,
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await db.stop({ doCleanup: false, force: false });
    process.exit(0);
  });
