import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      // Point BACKEND_URL at the gateway (http://localhost:8080) to route through
      // auth + rate limiting; leave default (:5001) to hit FastAPI directly.
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:5001',
        changeOrigin: true,
      },
      '/auth': {
        target: process.env.BACKEND_URL || 'http://localhost:5001',
        changeOrigin: true,
      }
    }
  },
  // `vite preview` serves the built dist/ as a lightweight static server (far
  // less RAM than the dev server). It needs its own proxy to reach the backend.
  preview: {
    port: 3000,
    proxy: {
      // Point BACKEND_URL at the gateway (http://localhost:8080) to route through
      // auth + rate limiting; leave default (:5001) to hit FastAPI directly.
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:5001',
        changeOrigin: true,
      },
      '/auth': {
        target: process.env.BACKEND_URL || 'http://localhost:5001',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['motion'],
          markdown: ['react-markdown', 'remark-gfm'],
          icons: ['@phosphor-icons/react'],
        },
      },
    },
  },
})