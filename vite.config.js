import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import handler from './api/index.js';

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), {
      name: 'local-json-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api/')) handler(req, res);
          else next();
        });
        // Runtime data changes should not reload an in-progress admin form.
        server.watcher.unwatch('**/data/*.local.json');
      },
    }],
    server: {
      port: 5173,
      fs: { deny: ['.env', '.env.*', '**/*.{crt,pem}', '**/.git/**', '**/data/**', '**/server/**', '**/test-results/**'] },
      watch: { ignored: ['**/data/*.local.json', '**/test-results/**', '**/.npm-cache/**'] },
    },
  };
});
