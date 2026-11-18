import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 4173,
    host: true
  },
  // @ts-expect-error vitest config types
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['**/node_modules/**', '**/tests/e2e/**']
  }
});
