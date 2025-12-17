import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Когда фронтенд видит путь, начинающийся с /static,
      // он перенаправляет запрос на 127.0.0.1:8000
      '/static': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    }
  }
})