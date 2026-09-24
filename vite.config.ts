import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8080',
      '/live': 'http://127.0.0.1:8080',
      '^/history(?:/|$)': 'http://127.0.0.1:8080',
    },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
