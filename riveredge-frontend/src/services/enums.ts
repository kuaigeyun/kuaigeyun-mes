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

let documentStatusCache: DocumentStatusConfig | null = null;
let documentStatusInflight: Promise<DocumentStatusConfig> | null = null;

/**
 * 获取单据状态枚举配置（带缓存 + in-flight 单例，防并发重复请求）
 */
export async function getDocumentStatusConfig(): Promise<DocumentStatusConfig> {
  if (documentStatusCache) {
    return documentStatusCache;
  }
  if (documentStatusInflight) {
    return documentStatusInflight;
  }
  documentStatusInflight = apiRequest<DocumentStatusConfig>('/core/enums/document-status')
    .then((data) => {
      documentStatusCache = data;
      return data;
    })
    .finally(() => {
      documentStatusInflight = null;
    });
  return documentStatusInflight;
}

/**
 * 初始化单据状态缓存（在 App 启动时调用）
 */
export async function initDocumentStatusCache(): Promise<void> {
  await getDocumentStatusConfig();
}

/**
 * 获取当前缓存的单据状态配置（同步，可能为 null）
 */
export function getDocumentStatusCache(): DocumentStatusConfig | null {
  return documentStatusCache;
}
