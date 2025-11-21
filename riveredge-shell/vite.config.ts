import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8001,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:9001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          antd: ['antd', '@ant-design/icons', '@ant-design/pro-components'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
          utils: ['lodash-es', 'dayjs'],
        },
      },
    },
  },
})
