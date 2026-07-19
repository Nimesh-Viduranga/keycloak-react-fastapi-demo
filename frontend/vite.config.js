import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /auth and /api to FastAPI so the session cookie is same-origin in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
