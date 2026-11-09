import mongoose from 'mongoose';
import { env } from '../config/env.js';
let pending;
export async function connectDatabase(uri = env.MONGODB_URI) {
  // Queries are constructed explicitly from validated scalar fields at each boundary.
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  pending ||= mongoose
    .connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 5 })
    .catch((error) => {
      pending = null;
      throw error;
    });
  await pending;
  pending = null;
  return mongoose.connection;
}
