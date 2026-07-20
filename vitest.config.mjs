import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal config for unit-testing pure logic (lib/utils, lib/validators,
// lib/permissions) in a plain Node environment — no DOM, no Next.js runtime,
// no MongoDB connection required. Keeps tests fast and dependency-free.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
