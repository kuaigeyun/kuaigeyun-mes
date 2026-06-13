/**
 * 系统枚举 API 服务
 *
 * 从后端获取枚举定义，作为单一数据源，避免前后端重复维护。
 */

import { apiRequest } from './api';

export interface DocumentStatusConfig {
  documentStatus: {
    values: string[];
    aliases: Record<string, string>;
    display: Record<string, { text: string; color: string }>;
  };
  reviewStatus: {
    values: string[];
    aliases: Record<string, string>;
    display: Record<string, { text: string; color: string }>;
  };
}

let documentStatusInflight: Promise<DocumentStatusConfig> | null = null;
let lastDocumentStatusConfig: DocumentStatusConfig | null = null;

/**
 * 获取单据状态枚举配置（每次请求最新；并发去重）
 */
export async function getDocumentStatusConfig(): Promise<DocumentStatusConfig> {
  if (documentStatusInflight) {
    return documentStatusInflight;
  }
  documentStatusInflight = apiRequest<DocumentStatusConfig>('/core/enums/document-status')
    .then((data) => {
      lastDocumentStatusConfig = data;
      return data;
    })
    .finally(() => {
      documentStatusInflight = null;
    });
  return documentStatusInflight;
}

/**
 * 启动时预热（仍走实时 API）
 */
export async function initDocumentStatusCache(): Promise<void> {
  await getDocumentStatusConfig();
}

/** 同步读取最近一次 API 结果（不触发请求；请先 init 或 getDocumentStatusConfig） */
export function getDocumentStatusCache(): DocumentStatusConfig | null {
  return lastDocumentStatusConfig;
}

export function invalidateDocumentStatusCache(): void {
  documentStatusInflight = null;
  lastDocumentStatusConfig = null;
}
