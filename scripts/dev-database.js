import { MongoMemoryReplSet } from 'mongodb-memory-server';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('.runtime/mongodb',{recursive:true});
const db=await MongoMemoryReplSet.create({instanceOpts:[{port:27017,dbPath:'.runtime/mongodb'}],replSet:{count:1,name:'rs0',storageEngine:'wiredTiger'}});
await writeFile('.runtime/mongodb-uri.txt',db.getUri('luna'));
console.log(`Development MongoDB replica set ready at ${db.getUri('luna')}. Data stays in .runtime/mongodb. Keep this terminal running.`);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await db.stop({doCleanup:false,force:false});process.exit(0);});
