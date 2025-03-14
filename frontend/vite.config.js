// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': import.meta.env
  },
  server: {
    proxy: {
      '/playlist': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/target': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/guess': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
