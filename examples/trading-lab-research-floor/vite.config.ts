import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  optimizeDeps: {
    // The kit is consumed as workspace TypeScript source.
    exclude: ['@trading-office/office-visual-kit'],
  },
  resolve: {
    dedupe: ['pixi.js', 'react', 'react-dom'],
  },
});
