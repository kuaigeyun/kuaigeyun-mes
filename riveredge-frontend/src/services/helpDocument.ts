/**
 * 帮助文档服务
 * 
 * 提供帮助文档的查询和管理功能
 */

import { apiRequest } from '../services/api';

/**
 * 帮助文档章节
 */
export interface HelpSection {
  title: string;
  content: string;
}

/**
 * 帮助文档
 */
export interface HelpDocument {
  key: string;
  title: string;
  sections: HelpSection[];
}

/**
 * 获取帮助文档
 * 
 * @param documentKey - 文档标识
 * @returns 帮助文档内容
 */
export async function getHelpDocument(documentKey: string): Promise<HelpDocument> {
  return apiRequest<HelpDocument>(`/core/help-documents/${documentKey}`, {
    method: 'GET',
  });
}

/**
 * 列出所有帮助文档
 * 
 * @param keyword - 搜索关键词（可选）
 * @returns 帮助文档列表
 */
export async function listHelpDocuments(keyword?: string): Promise<HelpDocument[]> {
  const params: Record<string, any> = {};
  if (keyword) {
    params.keyword = keyword;
  }
  return apiRequest<HelpDocument[]>('/core/help-documents', {
    method: 'GET',
    params,
  });
}

