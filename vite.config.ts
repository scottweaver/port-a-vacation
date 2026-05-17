import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Build / version identifiers are fetched at runtime from /version.json
// rather than baked into the bundle. That way the loaded app reflects
// whatever the server is currently advertising — which means the version
// shown in the header changes after a click-to-reload picks up new
// server-side content. In prod that's a real deploy; in dev it's whatever
// scripts/write-version.mjs (or scripts/simulate-update.sh) put in
// public/version.json.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
