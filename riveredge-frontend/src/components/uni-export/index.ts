/**
 * UniExport 组件重新导出
 * 
 * 从 index.tsx 重新导出，避免循环依赖
 */

export { UniExport as default, UniExport } from './index.tsx';
export type { UniExportProps } from './index.tsx';
