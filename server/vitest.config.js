import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', testTimeout: 30000, hookTimeout: 600000, fileParallelism: false, env: { NODE_ENV: 'test', JWT_SECRET: 'test-only-secret-at-least-32-characters-long', CLIENT_ORIGIN: 'http://localhost:5173' } } });

