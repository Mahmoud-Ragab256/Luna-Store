import app from '../server/src/app.js';
import { connectDatabase } from '../server/src/database/connection.js';

export default async function handler(req, res) {
  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    // Diagnose hosting connectivity without logging a URI, password or request headers.
    console.error(
      JSON.stringify({
        event: 'database_connection_failed',
        name: error.name,
        code: error.code,
        topology: error.reason?.type,
        atlasNetworkHint: /IP|whitelist|access list/i.test(error.message || ''),
        causes: [...(error.reason?.servers?.values() || [])].map((server) => ({
          name: server.error?.name,
          code: server.error?.code,
          causeCode: server.error?.cause?.code,
        })),
      }),
    );
    res.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'The store is temporarily unavailable. Please try again.',
      },
    });
  }
}
