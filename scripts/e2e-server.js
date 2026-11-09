import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {randomBytes} from 'node:crypto';
process.env.NODE_ENV='test';process.env.CLIENT_ORIGIN='http://localhost:5173';process.env.PAYMENT_PROVIDER='mock';process.env.MOCK_PAYMENT_WEBHOOK_SECRET=randomBytes(32).toString('hex');process.env.SEED_ADMIN_EMAIL='e2e-admin@example.invalid';process.env.SEED_ADMIN_PASSWORD='E2e-only-password-482!';
const db=await MongoMemoryReplSet.create({replSet:{count:1,storageEngine:'wiredTiger'}});process.env.MONGODB_URI=db.getUri('luna-e2e');
const {connectDatabase}=await import('../server/src/database/connection.js');await connectDatabase();const {seedDatabase}=await import('../server/src/database/seeds/seed.js');await seedDatabase();const {app}=await import('../server/src/app.js');const server=app.listen(4000,'127.0.0.1',()=>console.log('E2E backend ready on 4000'));
process.on('SIGTERM',async()=>{server.close();await db.stop();process.exit(0);});
