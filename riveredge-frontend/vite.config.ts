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
        target: 'http://127.0.0.1:9000', // 强制使用IPv4地址，避免IPv6连接问题
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
    // 优化构建性能
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // 优化代码分割：按功能模块分组
        manualChunks: (id) => {
          // 核心依赖
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('antd') || id.includes('@ant-design')) {
              return 'vendor-antd';
            }
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('lodash') || id.includes('dayjs')) {
              return 'vendor-utils';
            }
            // 其他 node_modules 依赖
            return 'vendor-other';
          }
          // 按功能模块分割页面代码
          if (id.includes('pages/system/roles') || id.includes('pages/system/permissions')) {
            return 'module-permission';
          }
          if (id.includes('pages/system/departments') || id.includes('pages/system/positions') || id.includes('pages/system/users')) {
            return 'module-organization';
          }
          if (id.includes('pages/system/data-dictionaries') || id.includes('pages/system/system-parameters') || id.includes('pages/system/code-rules') || id.includes('pages/system/custom-fields') || id.includes('pages/system/languages')) {
            return 'module-config';
          }
          if (id.includes('pages/system/applications') || id.includes('pages/system/menus') || id.includes('pages/system/invitation-codes')) {
            return 'module-application';
          }
          if (id.includes('pages/system/files') || id.includes('pages/system/apis') || id.includes('pages/system/data-sources') || id.includes('pages/system/datasets')) {
            return 'module-datacenter';
          }
          if (id.includes('pages/system/messages') || id.includes('pages/system/scheduled-tasks') || id.includes('pages/system/approval-processes') || id.includes('pages/system/scripts') || id.includes('pages/system/print')) {
            return 'module-process';
          }
          if (id.includes('pages/personal')) {
            return 'module-personal';
          }
          if (id.includes('pages/system/operation-logs') || id.includes('pages/system/login-logs') || id.includes('pages/system/online-users') || id.includes('pages/system/data-backups') || id.includes('pages/system/inngest')) {
            return 'module-monitoring';
          }
          if (id.includes('pages/platform')) {
            return 'module-platform';
          }
        },
      },
    },
  },
})

