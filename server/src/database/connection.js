import mongoose from 'mongoose';
import { env } from '../config/env.js';
export async function connectDatabase(uri = env.MONGODB_URI) {
  // Queries are constructed explicitly from validated scalar fields at each boundary.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}
