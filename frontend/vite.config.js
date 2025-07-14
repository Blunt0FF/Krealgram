// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': process.env
  },
  envPrefix: 'VITE_',
  server: {
    port: 4000,
    proxy: {
      '/api': {
        target: 'https://krealgram-backend.onrender.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    },
    cors: {
      origin: [
        'http://localhost:4000', 
        'http://127.0.0.1:4000', 
        'https://krealgram.vercel.app',
        'https://krealgram.com',
        'https://www.krealgram.com'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'],
      credentials: true
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})