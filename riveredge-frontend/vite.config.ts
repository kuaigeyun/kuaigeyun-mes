/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { platform } from 'os'
import type { ProxyOptions } from 'vite'

// 主入口配置
// 统一使用 SaaS 模式
// 单体部署本质上就是只有 src，没有新建其他租户应用

// src 目录路径（src 目录）
const srcPath = resolve(__dirname, 'src')

// static 目录路径（指向前端项目的 static）
const publicDir = resolve(__dirname, 'static')


export default defineConfig({
  // ⚠️ 优化：设置根目录为src目录，因为index.html在src目录下
  root: srcPath, // src目录
  // 指定 static 目录
  publicDir: publicDir,
  // 服务器配置 - 优化稳定性
  server: {
    // Windows 兼容性：在 Windows 上使用 127.0.0.1 而不是 0.0.0.0 或 localhost
    // localhost 在 Windows 上可能解析为 IPv6 的 ::1，导致 EACCES 权限错误
    // 主机和端口从环境变量读取
    host: process.env.VITE_HOST || (platform() === 'win32' ? '127.0.0.1' : '0.0.0.0'), // 从环境变量读取，Windows 默认使用 IPv4
    port: parseInt(process.env.VITE_PORT || '8100', 10), // 从环境变量读取前端端口
    strictPort: false, // 如果端口被占用，自动寻找下一个可用端口
    open: false, // 不自动打开浏览器
    cors: true, // 启用CORS
    // ⚠️ 稳定性优化：代理配置（关键修复：添加错误处理，防止后端重启导致前端崩溃）
    proxy: {
      '/api': {
        // 后端服务地址从环境变量读取
        target: process.env.VITE_API_TARGET || `http://${process.env.VITE_BACKEND_HOST || '127.0.0.1'}:${process.env.VITE_BACKEND_PORT || '8200'}`,
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
    hmr: {
      overlay: true, // 允许错误覆盖层，但设置为不阻塞
      // 启用 HMR，使用 WebSocket
      protocol: 'ws',
      host: process.env.VITE_HMR_HOST || 'localhost', // 从环境变量读取 HMR 主机
      // 不指定固定端口，让 Vite 自动选择（避免端口冲突）
      clientPort: undefined,
      // ⚠️ 稳定性优化：增加 HMR 超时时间
      timeout: 30000, // 增加超时时间到 30 秒
      // ⚠️ 优化 HMR：允许错误覆盖层但不阻塞开发
      client: {
        overlay: {
          errors: true,
          warnings: false, // 只显示错误，不显示警告
        },
        // 优化重连逻辑
        reconnectInterval: 3000,
        reconnectDelay: 1000,
      },
    },
    watch: {
      // 优化文件监听，确保 HMR 正常工作，避免频繁重启
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
        '**/riveredge-backend/**',
        '**/backend/**',
        '**/venv*/**',
        '**/__pycache__/**',
        '**/*.py',
        '**/*.pyc',
        '**/*.pyo',
        '**/*.sqlite',
        '**/*.sqlite3',
        '**/*.db',
        // 忽略 IDE 和编辑器文件
        '**/.vscode/**',
        '**/.idea/**',
        '**/*.swp',
        '**/*.swo',
        '**/*~',
        // 忽略 macOS 文件
        '**/.fseventsd/**',
        '**/.DocumentRevisions-V100/**',
        '**/.TemporaryItems/**',
        '**/.Trashes/**',
        // 忽略 Windows 系统文件
        '**/desktop.ini',
        '**/Desktop.ini',
        '**/Thumbs.db',
        '**/$RECYCLE.BIN/**',
        '**/*.stackdump',
        // ⚠️ 额外保护：忽略项目根目录下的后端目录
        '../../riveredge-backend/**',
        '../../../riveredge-backend/**',
        '**/../riveredge-backend/**',
        // 忽略其他可能变化的文件
        '**/migrations/**',
        '**/*.lock',
        '**/uv.lock',
        '**/Pipfile.lock',
        '**/poetry.lock',
      ],
      // Windows 环境下使用轮询模式以确保文件变化能被检测到
      usePolling: platform() === 'win32',
      // ⚠️ 优化：增加文件变化检测间隔，减少 CPU 占用和重启频率
      interval: platform() === 'win32' ? 1000 : 300, // 减少检测频率
      // 优化文件监听性能
      binaryInterval: platform() === 'win32' ? 2000 : 500,
      // 减少监听的文件类型，只监听源码文件
      include: [
        '**/*.{js,jsx,ts,tsx,json,css,less,scss,html}',
      ],
    },
  },
  // 构建配置 - 优化性能
  build: {
    sourcemap: false, // 开发模式下关闭sourcemap，提高性能
    minify: false, // 开发模式下不压缩，提高构建速度
  },
  plugins: [
    // React 插件 - 优化 Fast Refresh 和 HMR
    react({
      // 启用 Fast Refresh
      fastRefresh: true,
      // 包含所有 React 文件进行 HMR
      include: '**/*.{jsx,tsx}',
      exclude: '**/node_modules/**',
      // ⚠️ 优化：移除不必要的babel配置，让React插件自动处理
      // ⚠️ 关键修复：使用经典的JSX运行时，确保兼容性
      jsxRuntime: 'automatic', // 使用自动JSX运行时，不需要显式导入React
      // 添加Fast Refresh选项
      fastRefreshOptions: {
        // 强制启用Fast Refresh
        force: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '.', // 由于root是src目录，@指向当前目录
    },
  },
  define: {
    // 统一使用 SaaS 模式
    __MODE__: JSON.stringify('saas'),
    __IS_MONOLITHIC__: JSON.stringify(false),
    __IS_SAAS__: JSON.stringify(true),
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'antd',
      '@ant-design/pro-components',
      '@tanstack/react-query',
      'zustand',
    ],
    // ⚠️ 关键修复：强制重新构建依赖，避免缓存问题
    force: false, // 开发环境不强制重建，提高启动速度
    // ⚠️ 关键修复：排除可能导致问题的依赖
    exclude: [],
  },
  // ⚠️ 优化：适当的日志级别
  logLevel: 'info', // 显示必要信息，方便调试
  // ⚠️ 优化：允许清屏，但减少频率
  clearScreen: true,
  // 测试配置
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, 'tests/setup.ts')],
    include: [
      '**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    root: resolve(__dirname), // 设置根目录为项目根目录，以便发现tests目录
  },
})
