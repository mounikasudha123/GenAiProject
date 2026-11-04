import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    proxy: { '/api': 'http://localhost:3001' }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/recharts/') || id.includes('/node_modules/d3-')) return 'charts';
          if (id.includes('/node_modules/@firebase/auth/')) return 'firebase-auth';
          if (id.includes('/node_modules/@firebase/firestore/')) return 'firebase-firestore';
          if (id.includes('/node_modules/@firebase/app/')) return 'firebase-app';
          if (id.includes('/node_modules/@firebase/')) return 'firebase-shared';
          if (id.includes('/node_modules/firebase/')) return 'firebase';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'react-vendor';
        }
      }
    }
  }
});
