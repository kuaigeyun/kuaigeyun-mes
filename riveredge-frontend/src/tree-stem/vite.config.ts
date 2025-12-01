import { defineConfig, mergeConfig } from 'vite'
import { resolve } from 'path'
import baseConfig from '../../vite.config'

// 共享配置，继承自根目录 vite.config.ts
// 仅覆盖项目特定的配置（如端口号）
// public 目录路径（指向根目录的 public）
// 从 src/tree-stem/ 到 public/：../ -> src/, ../../ -> riveredge-frontend/, ../../public -> public/
const publicDir = resolve(__dirname, '../../public')

export default defineConfig({
  // 指定 public 目录（指向根目录的 public）
  publicDir: publicDir,
  server: {
    host: '0.0.0.0',
    port: 8001, // 租户前端端口
    strictPort: false, // 如果端口被占用，自动寻找下一个可用端口
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
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:9000', // 后端服务地址
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname), // 指向当前项目目录（源代码直接在此目录）
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
