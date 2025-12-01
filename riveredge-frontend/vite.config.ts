import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000, // 默认端口
    strictPort: false, // 如果端口被占用，自动寻找下一个可用端口
    open: false, // 不自动打开浏览器
    cors: true, // 启用CORS
    hmr: {
      overlay: true, // 显示错误覆盖层
    },
    watch: {
      // 优化文件监听，减少不必要的重启
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/*.log',
      ],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:9000', // 后端服务地址（强制使用IPv4，避免IPv6连接问题）
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom', 'rc-field-form'],
  },
  optimizeDeps: {
    include: [
      'rc-field-form',
      'react',
      'react-dom',
      'antd',
      '@ant-design/pro-components',
      '@tanstack/react-query',
      'zustand',
    ],
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

