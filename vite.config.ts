import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Allows process.env.API_KEY to be accessed without crashing the browser
    'process.env': 'process' in globalThis ? process.env : { API_KEY: undefined }
  }
});