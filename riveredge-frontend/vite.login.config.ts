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
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react/')) return 'vendor-react';
            if (id.includes('antd') || id.includes('@ant-design')) return 'vendor-antd';
            if (id.includes('@ant-design/pro-components')) return 'vendor-pro';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n';
            // 其余 node_modules 交给 Rollup 自动拆分，避免单块 vendor-other 过大拖慢首屏
            return undefined;
          }
        },
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
