import { defineConfig } from 'vite';

export default defineConfig({
  base: '/lushan-waterfall/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom', 'react-dom/client'],
        },
      },
    },
  },
});
