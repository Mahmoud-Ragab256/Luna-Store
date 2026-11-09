import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
// Local development only: a real MongoDB replica set, not a replacement API or database mock.
if (process.env.NODE_ENV === 'production') throw new Error('The development database launcher cannot run in production.');
const databasePath = resolve('.local/mongodb'); mkdirSync(databasePath, { recursive: true });
const replica = await MongoMemoryReplSet.create({ instanceOpts: [{ port: 27017, dbPath: databasePath, storageEngine: 'wiredTiger' }], replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' } });
console.log(`Development MongoDB replica set ready: ${replica.getUri('luna')}`);
async function stop() { await replica.stop({ doCleanup: false, force: false }); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
