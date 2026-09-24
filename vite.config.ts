import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    fs: {
      strict: true,
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/docs/**', '**/.local/**'],
    },
  },
  preview: { host: '127.0.0.1' },
  test: { environment: 'node', include: ['src/tests/**/*.test.ts'] },
});
