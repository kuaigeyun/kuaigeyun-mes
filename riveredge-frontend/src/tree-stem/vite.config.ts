import { defineConfig, mergeConfig } from 'vite'
import { resolve } from 'path'
import { platform } from 'os'
import type { ProxyOptions } from 'vite'
import baseConfig from '../../vite.config'

// 共享配置，继承自根目录 vite.config.ts
// 仅覆盖项目特定的配置（如端口号）
// public 目录路径（指向根目录的 public）
// 从 src/tree-stem/ 到 public/：../ -> src/, ../../ -> riveredge-frontend/, ../../public -> public/
const publicDir = resolve(__dirname, '../../public')

export default defineConfig({
  // ⚠️ 关键修复：明确设置根目录，防止 Vite 监听父目录（包括后端目录）
  root: __dirname, // 限制 Vite 只监听当前目录（tree-stem），不监听父目录
  // 指定 public 目录（指向根目录的 public）
  publicDir: publicDir,
  server: {
    // ⚠️ 稳定性优化：Windows 上使用 127.0.0.1，避免 IPv6 权限问题
    host: platform() === 'win32' ? '127.0.0.1' : '0.0.0.0',
    port: 8001, // 租户前端端口
    strictPort: false, // 如果端口被占用，自动寻找下一个可用端口
    cors: true, // 启用CORS
    // ⚠️ 稳定性优化：HMR 配置
    hmr: {
      overlay: true, // 显示错误覆盖层
      protocol: 'ws',
      host: 'localhost',
      // 不指定固定端口，让 Vite 自动选择（避免端口冲突）
      clientPort: undefined,
      // 优化 HMR 连接稳定性
      timeout: 20000, // 增加超时时间到 20 秒
    },
    // ⚠️ 稳定性优化：文件监听配置
    watch: {
      // 优化文件监听，减少不必要的重启
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/.vite/**',
        '**/build/**',
        '**/coverage/**',
        '**/*.log',
        '**/*.tmp',
        '**/startlogs/**',
        '**/logs/**',
        '**/.DS_Store',
        '**/Thumbs.db',
        '**/package-lock.json',
        '**/yarn.lock',
        '**/pnpm-lock.yaml',
        '**/.env.local',
        '**/.env.*.local',
        // ⚠️ 关键修复：忽略后端目录，防止前端服务监听后端文件变化导致崩溃
        // 使用绝对路径模式，确保无论从哪个目录启动都能正确忽略
        '**/riveredge-backend/**',
        '**/backend/**',
        '**/src/soil/**',
        '**/src/tree_root/**',
        '**/venv*/**',
        '**/__pycache__/**',
        '**/*.py',
        '**/*.pyc',
        '**/*.pyo',
        // ⚠️ 额外保护：忽略项目根目录下的后端目录（相对路径和绝对路径）
        '../../riveredge-backend/**',
        '../../../riveredge-backend/**',
        '**/../riveredge-backend/**',
      ],
      // Windows 环境下使用轮询模式以确保文件变化能被检测到
      usePolling: platform() === 'win32',
      // 文件变化检测间隔（Windows 下使用轮询时，增加间隔减少 CPU 占用）
      interval: platform() === 'win32' ? 2000 : 100, // Windows 下增加到 2 秒
      // 优化文件监听性能
      binaryInterval: platform() === 'win32' ? 3000 : 1000,
    },
    // ⚠️ 稳定性优化：代理配置（关键修复：添加错误处理，防止后端重启导致前端崩溃）
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://127.0.0.1:9000', // 后端服务地址
        changeOrigin: true,
        secure: false,
        // ⚠️ 关键修复：增加超时时间，防止后端重启时连接超时
        timeout: 30000, // 增加超时时间到 30 秒
        ws: true, // 支持 WebSocket
        // ⚠️ 关键修复：配置代理错误处理，防止后端重启导致前端服务崩溃
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            // 后端服务不可用时，只记录错误，不导致前端服务崩溃
            // 这是关键：错误处理不会导致 Vite 服务崩溃
            console.warn('⚠️ 代理错误（后端可能正在重启）:', err.message);
          });
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            // 设置更长的超时时间
            proxyReq.setTimeout(30000);
          });
      },
      } as ProxyOptions,
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname), // 指向当前项目目录（源代码直接在此目录）
    },
    dedupe: ['react', 'react-dom', 'rc-field-form'],
  },
  // ⚠️ 稳定性优化：依赖预构建配置
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
    // 强制预构建，避免运行时构建导致的延迟
    force: false, // 开发时不需要强制，避免每次启动都重新构建
    // 优化预构建性能
    esbuildOptions: {
      target: 'esnext',
    },
  },
  // ⚠️ 稳定性优化：构建配置
  build: {
    outDir: 'dist',
    sourcemap: false,
    // 优化构建性能，减少内存占用
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
          if (id.includes('pages/system/messages') || id.includes('pages/system/scheduled-tasks') || id.includes('pages/system/approval-processes') || id.includes('pages/system/electronic-records') || id.includes('pages/system/scripts') || id.includes('pages/system/print')) {
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
