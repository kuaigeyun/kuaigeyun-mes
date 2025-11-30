import { defineConfig, mergeConfig } from 'vite'
import { resolve } from 'path'
import baseConfig from '../../vite.config'

// 共享配置，继承自根目录 vite.config.ts
// 仅覆盖项目特定的配置（如端口号）
// public 目录路径（指向根目录的 public）
// 从 src/tree-stem/ 到 public/：../ -> src/, ../../ -> riveredge-frontend/, ../../public -> public/
const publicDir = resolve(__dirname, '../../public')

export default mergeConfig(
  baseConfig,
  defineConfig({
    // 指定 public 目录（指向根目录的 public）
    publicDir: publicDir,
    server: {
      port: 8001, // 租户前端端口
      strictPort: false, // 如果端口被占用，自动寻找下一个可用端口
    },
    resolve: {
      alias: {
        '@': resolve(__dirname), // 指向当前项目目录（源代码直接在此目录）
      },
    },
  })
)
