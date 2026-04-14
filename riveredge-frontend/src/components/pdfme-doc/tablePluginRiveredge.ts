/**
 * pdfme 内置 table 插件 + RiverEdge 扩展 PDF 渲染（image_url 列嵌入图片）
 */
import { table } from '@pdfme/schemas';
import { tablePdfRenderWithImageUrlColumn } from './tableWithImageUrlColumnPlugin';

/** 与官方 table 插件同结构，仅替换 pdf 渲染 */
export const tablePluginRiveredge = {
  ...table,
  pdf: tablePdfRenderWithImageUrlColumn,
} as typeof table;
