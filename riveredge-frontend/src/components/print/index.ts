/**
 * 打印组件重新导出
 * 
 * 从 index.tsx 重新导出，避免循环依赖
 */

export { Print as default, Print } from './index.tsx';
export type { PrintProps } from './index.tsx';
