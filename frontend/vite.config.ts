import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',                     
  server: {
    port: 3000,
    proxy: {
      '/search': { target: 'http://localhost:8000', changeOrigin: true },
      '/stats':  { target: 'http://localhost:8000', changeOrigin: true },
      '/api':    { target: 'http://localhost:8000', changeOrigin: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    outDir: '../webcrawler/static/dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})