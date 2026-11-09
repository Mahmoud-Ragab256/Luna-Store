import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const parsed = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/luna?replicaSet=rs0'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32).optional(),
}).passthrough().parse(process.env);
if (parsed.NODE_ENV === 'production' && !parsed.JWT_SECRET) throw new Error('JWT_SECRET must be configured in production');
export const env = { ...parsed, JWT_SECRET: parsed.JWT_SECRET || randomBytes(48).toString('hex') };
