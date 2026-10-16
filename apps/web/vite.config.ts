import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ecosphere/shared': path.resolve(__dirname, '../../modules/shared/src/index.ts'),
      '@ecosphere/energy': path.resolve(__dirname, '../../modules/energy/src/index.ts'),
      '@ecosphere/waste': path.resolve(__dirname, '../../modules/waste/src/index.ts')
    }
  },
  server: {
    port: 5173,
    host: true
  }
});
