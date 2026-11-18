import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode === 'production' ? 'production' : 'demo', process.cwd(), '');

  return {
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
      exclude: ['**/node_modules/**', '**/tests/e2e/**'],
      env: {
        VITE_APP_MODE: 'demo',
        VITE_USE_MOCK_API: 'true',
        VITE_ENABLE_DEMO_TOOLS: 'true',
        VITE_OPERATIONAL_TIMEZONE: 'Asia/Kolkata',
        ...env
      }
    }
  };
});
