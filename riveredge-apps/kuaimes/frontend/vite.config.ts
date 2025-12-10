/**
 * Vite 配置
 * 
 * 插件前端构建配置
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    // 使用 ES Module 格式，更适合现代浏览器和动态导入
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'Kuaimes',
      fileName: (format) => `index.${format}.js`,
      formats: ['es'], // 使用 ES Module 格式，而不是 UMD
    },
    rollupOptions: {
      // 外部依赖：这些依赖由主应用提供，不需要打包进插件
      external: [
        'react',
        'react-dom',
        'react-router-dom',
        'antd',
        '@ant-design/pro-components',
        '@ant-design/icons',
      ],
      output: {
        // ES Module 格式不需要 globals 配置
        // 但可以保留用于兼容性（如果将来需要 UMD 格式）
        preserveModules: false, // 不保留模块结构，打包成单个文件
        preserveModulesRoot: undefined,
      },
    },
    // 输出目录：构建产物输出到 dist 目录
    outDir: 'dist',
    // 不生成 sourcemap（生产环境）
    sourcemap: false,
  },
});

