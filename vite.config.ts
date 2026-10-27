import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: 'all'
  },
  define: {
    // Allows process.env.API_KEY to be accessed without crashing the browser
    'process.env': 'process' in globalThis ? process.env : { API_KEY: undefined }
  }
});