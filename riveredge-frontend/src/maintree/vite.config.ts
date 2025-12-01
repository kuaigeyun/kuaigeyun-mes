import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { existsSync } from 'fs'
import { platform } from 'os'

// 主入口配置
// 统一使用 SaaS 模式
// 单体部署本质上就是只有 maintree，没有新建其他租户 tree

// tree-stem 目录路径
const treeStemPath = resolve(__dirname, '../tree-stem')

// public 目录路径（指向根目录的 public）
// 从 src/maintree/ 到 public/：../ -> src/, ../../ -> riveredge-frontend/, ../../public -> public/
const publicDir = resolve(__dirname, '../../public')

// Vite 插件：处理 tree-stem 文件中的 @ 别名（支持静态和动态导入）
const treeStemAliasPlugin = () => {
  return {
    name: 'tree-stem-alias',
    enforce: 'pre', // 在其他插件之前执行，确保优先处理
    resolveId(id: string, importer?: string) {
      // 如果使用 @ 别名
      if (id.startsWith('@/') && !id.startsWith('@/tree-stem')) {
        // 检查导入来源
        if (importer) {
          // importer 可能是绝对路径，检查是否包含 tree-stem
          // 处理 Windows 路径（反斜杠）和 Unix 路径（正斜杠）
          const normalizedImporter = importer.replace(/\\/g, '/')
          
          // 检查是否来自 tree-stem 目录（更严格的匹配）
          if (normalizedImporter.includes('/tree-stem/') || normalizedImporter.includes('\\tree-stem\\')) {
            const path = id.replace('@/', '')
            const resolvedPath = resolve(treeStemPath, path)
            
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
  // 指定 public 目录（指向根目录的 public）
  publicDir: publicDir,
  // 服务器配置 - 优化稳定性
  server: {
    host: '0.0.0.0', // 允许外部访问
    port: 8000, // 主入口端口
    strictPort: false, // 如果端口被占用，自动寻找下一个可用端口
    open: false, // 不自动打开浏览器
    cors: true, // 启用CORS
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9000', // 强制使用IPv4地址，避免IPv6连接问题
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: {
      overlay: true, // 显示错误覆盖层
      // 启用 HMR，使用 WebSocket
      protocol: 'ws',
      host: 'localhost',
      // 不指定固定端口，让 Vite 自动选择（避免端口冲突）
      clientPort: undefined,
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
      ],
      // Windows 环境下使用轮询模式以确保文件变化能被检测到
      usePolling: platform() === 'win32',
      // 文件变化检测间隔（Windows 下使用轮询时）
      interval: platform() === 'win32' ? 1000 : 100,
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
    treeStemAliasPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname), // 指向当前项目目录（源代码直接在此目录）
      // 支持从 tree-stem 导入
      '@/tree-stem': treeStemPath,
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

