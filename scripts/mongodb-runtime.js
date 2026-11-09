import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Reuse an optional local MongoDB executable; clean checkouts use the normal official download. */
export function configureLocalMongo() {
  const binary = fileURLToPath(new URL('../.local/mongodb/mongod.exe', import.meta.url));
  if (process.platform === 'win32' && !process.env.MONGOMS_SYSTEM_BINARY && existsSync(binary))
    process.env.MONGOMS_SYSTEM_BINARY = binary;
}
