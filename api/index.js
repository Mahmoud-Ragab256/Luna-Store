import app from '../server/src/app.js';
import { connectDatabase } from '../server/src/database/connection.js';

export default async function handler(req, res) {
  try {
    await connectDatabase();
    return app(req, res);
  } catch {
    res
      .status(503)
      .json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'The store is temporarily unavailable. Please try again.',
        },
      });
  }
}
