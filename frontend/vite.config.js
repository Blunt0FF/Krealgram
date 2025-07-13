// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_VERCEL': JSON.stringify(isProd),
      'import.meta.env.VITE_BASE_URL': JSON.stringify(
        isProd 
          ? 'https://krealgram-backend.onrender.com' 
          : 'http://localhost:3000'
      )
    },
    server: {
      port: 4000,
      proxy: {
        '/api': {
          target: 'https://krealgram-backend.onrender.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true,
      assetsInlineLimit: 0,
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['@mui/material', '@mui/icons-material']
          },
          entryFileNames: '[name].[hash].js',
          chunkFileNames: '[name].[hash].js',
          assetFileNames: '[name].[hash].[ext]'
        }
      }
    }
  };
});