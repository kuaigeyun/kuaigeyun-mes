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

export default defineConfig({
  base: '/',
  // ⚠️ 优化：设置根目录为src目录，因为index.html在src目录下
  root: srcPath, // src目录
  publicDir: resolve(__dirname, 'static'),
  // 服务器配置 - 优化稳定性
  server: {
    // 使用 0.0.0.0 监听所有接口，确保 localhost 和 127.0.0.1 均可访问
    // （Windows 上 localhost 可能解析为 IPv6 ::1，仅绑定 127.0.0.1 会导致 localhost 无法连接）
    host: process.env.VITE_HOST || '0.0.0.0',
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
      // 积木报表代理，使其感觉上是“融合”在同一个域名下
      '/jeecg-boot': {
        target: 'http://localhost:8080', // 假设积木报表服务运行在 8080
        changeOrigin: true,
        secure: false,
      } as ProxyOptions,
    },
    hmr: {
      overlay: true,
      // ⚠️ 稳定性优化：增加 HMR 超时时间
      timeout: 30000, // 增加超时时间到 30 秒
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
        // 忽略测试文件
        '**/tests/**',
        '**/test/**',
        '**/*.test.{js,ts,jsx,tsx}',
        '**/*.spec.{js,ts,jsx,tsx}',
        // 忽略构建产物
        '**/*.map',
        '**/*.min.js',
        '**/*.min.css',
      ],
      // Windows 环境下使用轮询模式以确保文件变化能被检测到
      usePolling: platform() === 'win32',
      // ⚠️ 优化：增加文件变化检测间隔，减少 CPU 占用和重启频率
      interval: platform() === 'win32' ? 2000 : 500, // Windows 增加到 2 秒，其他平台 0.5 秒
      // 优化文件监听性能
      binaryInterval: platform() === 'win32' ? 3000 : 1000, // Windows 增加到 3 秒
      // 使用原子写入检测，减少不必要的重载
      atomic: true,
    },
  },
  // 构建配置 - 优化性能
  build: {
    // 单块告警阈值（KB），拆分后各块仍可能较大
    chunkSizeWarningLimit: 800,
    // 生产环境配置
    sourcemap: process.env.NODE_ENV === 'production' ? false : true, // 生产环境关闭sourcemap，减小体积
    minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false, // 生产环境使用esbuild压缩，速度更快
    // 代码分割配置（按依赖类型分割，不按路由分割，避免菜单加载慢）
    rollupOptions: {
      output: {
        // 手动代码分割策略（顺序重要：优先匹配最具体的路径）
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // 大体积库优先单独拆分
            if (id.includes('@univerjs')) return 'vendor-univerjs';
            if (id.includes('@ant-design/pro-flow')) return 'vendor-pro-flow';
            if (id.includes('@svar-ui/react-gantt')) return 'vendor-gantt';
            if (id.includes('@pdfme')) return 'vendor-pdfme';
            if (id.includes('@ant-design/pro-components')) return 'vendor-pro-components';
            if (id.includes('@ant-design/charts') || id.includes('@ant-design/plots')) return 'vendor-charts';
            if (id.includes('@ant-design/graphs')) return 'vendor-graphs';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor-react';
            if (id.includes('antd') || id.includes('@ant-design')) return 'vendor-antd';
            if (id.includes('framer-motion') || id.includes('lottie')) return 'vendor-animation';
            return 'vendor-other';
          }
          if (id.includes('/apps/')) {
            const appMatch = id.match(/\/apps\/([^/]+)/);
            if (appMatch) return `app-${appMatch[1]}`;
          }
          if (id.includes('/pages/system/')) return 'pages-system';
          if (id.includes('/pages/infra/')) return 'pages-infra';
          if (id.includes('/pages/personal/')) return 'pages-personal';
        },
        // 文件命名规则
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // 图片资源
          if (assetInfo.name && /\.(png|jpe?g|svg|gif|webp)$/.test(assetInfo.name)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          // 字体资源
          if (assetInfo.name && /\.(woff2?|eot|ttf|otf)$/.test(assetInfo.name)) {
            return 'assets/fonts/[name]-[hash][extname]';
          }
          // CSS 资源
          if (assetInfo.name && /\.css$/.test(assetInfo.name)) {
            return 'assets/css/[name]-[hash][extname]';
          }
          // 其他资源
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    // 构建目标
    target: 'es2015',
    // CSS 代码分割
    cssCodeSplit: true,
    // 资源内联阈值（小于4KB的资源内联为base64）
    assetsInlineLimit: 4096,
    // 压缩配置
    terserOptions: process.env.NODE_ENV === 'production' ? {
      compress: {
        drop_console: true, // 移除console
        drop_debugger: true, // 移除debugger
      },
    } : undefined,
  },
  plugins: [
    // React 插件 - 优化 Fast Refresh 和 HMR
    react({
      // 包含所有 React 文件进行 HMR
      include: '**/*.{jsx,tsx}',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.{jsx,tsx}',
        '**/*.spec.{jsx,tsx}',
      ],
      // ⚠️ 优化：移除不必要的babel配置，让React插件自动处理
      // ⚠️ 关键修复：使用经典的JSX运行时，确保兼容性
      jsxRuntime: 'automatic', // 使用自动JSX运行时，不需要显式导入React
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
      'react-router-dom',
      'antd',
      '@ant-design/icons',
      '@ant-design/pro-components',
      '@tanstack/react-query',
      'zustand',
      'dayjs',
      '@univerjs/core',
      '@univerjs/design',
      '@univerjs/docs',
      '@univerjs/docs-ui',
      '@univerjs/engine-formula',
      '@univerjs/engine-render',
      '@univerjs/network',
      '@univerjs/ui',
      '@univerjs/themes',
    ],
    // ⚠️ 关键修复：强制重新构建依赖，避免缓存问题
    force: false, // 开发环境不强制重建，提高启动速度
    // ⚠️ 关键修复：排除可能导致问题的依赖
    // exclude: [], // UniverJS 体积较大，但排除可能导致 bundling 问题，且 '@univerjs' 写法可能无效
    // 优化预构建配置
    esbuildOptions: {
      target: 'es2015',
    },
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
