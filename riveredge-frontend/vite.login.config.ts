/// <reference types="vitest" />
/**
 * 登录页独立构建配置
 * 运行: npx vite build -c vite.login.config.ts
 * 输出到 dist/，与主构建合并
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const srcPath = resolve(__dirname, 'src');

export default defineConfig({
  base: '/',
  root: srcPath,
  publicDir: resolve(__dirname, 'static'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false, // 不清空，与主构建合并
    rollupOptions: {
      input: resolve(srcPath, 'login.html'),
      output: {
        entryFileNames: 'assets/js/login-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
  },
  plugins: [react({ jsxRuntime: 'automatic' })],
  resolve: { alias: { '@': '.' } },
  define: {
    __MODE__: JSON.stringify('saas'),
    __IS_MONOLITHIC__: JSON.stringify(false),
    __IS_SAAS__: JSON.stringify(true),
  },
});
