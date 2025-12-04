import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { platform } from 'os'
import type { ProxyOptions } from 'vite'

// 主入口配置
// 统一使用 SaaS 模式
// 单体部署本质上就是只有 src，没有新建其他租户应用

// src 目录路径（当前目录）
const srcPath = resolve(__dirname, '.')

// public 目录路径（指向根目录的 public）
// 从 src/ 到 public/：../ -> riveredge-frontend/, ../public -> public/
const publicDir = resolve(__dirname, '../public')

// Vite 插件：处理 src 文件中的 @ 别名（支持静态和动态导入）
const srcAliasPlugin = () => {
  return {
    name: 'src-alias',
    enforce: 'pre', // 在其他插件之前执行，确保优先处理
    resolveId(id: string, importer?: string) {
      // 如果使用 @ 别名
      if (id.startsWith('@/')) {
        // 检查导入来源
        if (importer) {
          // importer 可能是绝对路径，检查是否包含 src
          // 处理 Windows 路径（反斜杠）和 Unix 路径（正斜杠）
          const normalizedImporter = importer.replace(/\\/g, '/')
          
          // 检查是否来自 src 目录（更严格的匹配）
          if (normalizedImporter.includes('/src/') || normalizedImporter.includes('\\src\\')) {
            const path = id.replace('@/', '')
            const resolvedPath = resolve(srcPath, path)
            
            // 检查文件是否存在（支持 .ts, .tsx, .js, .jsx 扩展名）
            const extensions = ['.ts', '.tsx', '.js', '.jsx', '']
            for (const ext of extensions) {
              const filePath = resolvedPath + ext
              if (existsSync(filePath)) {
                // 返回绝对路径，确保 Vite 能正确解析
                return filePath
              }
            }
            
            // 如果文件不存在，尝试作为目录查找 index 文件
            const indexExtensions = ['/index.ts', '/index.tsx', '/index.js', '/index.jsx']
            for (const ext of indexExtensions) {
              const filePath = resolvedPath + ext
              if (existsSync(filePath)) {
                return filePath
              }
            }
          }
        }
      }
      return null
    },
  }
}

export default defineConfig({
  // ⚠️ 关键修复：明确设置根目录，防止 Vite 监听父目录（包括后端目录）
  root: __dirname, // 限制 Vite 只监听当前目录（src），不监听父目录
  // 指定 public 目录（指向根目录的 public）
  publicDir: publicDir,
  // 服务器配置 - 优化稳定性
  server: {
    // Windows 兼容性：在 Windows 上使用 127.0.0.1 而不是 0.0.0.0 或 localhost
    // localhost 在 Windows 上可能解析为 IPv6 的 ::1，导致 EACCES 权限错误
    host: platform() === 'win32' ? '127.0.0.1' : '0.0.0.0', // Windows 使用 IPv4，其他系统允许外部访问
    port: 3000, // 主入口端口（8000 在 Windows 保留端口范围内，改用 3000）
    strictPort: false, // 如果端口被占用，自动寻找下一个可用端口
    open: false, // 不自动打开浏览器
    cors: true, // 启用CORS
    // ⚠️ 稳定性优化：代理配置（关键修复：添加错误处理，防止后端重启导致前端崩溃）
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9000', // 强制使用IPv4地址，避免IPv6连接问题
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
      overlay: true, // 显示错误覆盖层
      // 启用 HMR，使用 WebSocket
      protocol: 'ws',
      host: 'localhost',
      // 不指定固定端口，让 Vite 自动选择（避免端口冲突）
      clientPort: undefined,
      // ⚠️ 稳定性优化：增加 HMR 超时时间
      timeout: 20000, // 增加超时时间到 20 秒
    },
    watch: {
      // 优化文件监听，确保 HMR 正常工作
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
        '**/src/platform/**',
        '**/src/core/**',
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
      // ⚠️ 稳定性优化：增加文件变化检测间隔，减少 CPU 占用和重启频率
      interval: platform() === 'win32' ? 2000 : 100, // Windows 下增加到 2 秒
      // 优化文件监听性能
      binaryInterval: platform() === 'win32' ? 3000 : 1000,
    },
  },
  // 构建配置 - 优化性能
  build: {
    sourcemap: false, // 开发模式下关闭sourcemap，提高性能
    minify: false, // 开发模式下不压缩，提高构建速度
  },
  plugins: [
    // React 插件 - 启用 Fast Refresh 和 HMR
    react({
      // 启用 Fast Refresh
      fastRefresh: true,
      // 包含所有文件进行 HMR
      include: '**/*.{jsx,tsx}',
    }),
    // 自定义别名插件
    srcAliasPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname), // 指向当前目录（src）
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
  },
})

