/**
 * 单据关联关系 API（快智造）
 */

import { apiRequest } from './api';

/** 与后端 DocumentTraceReportingEntry 对齐 */
export interface DocumentTraceReportingEntry {
  document_id: number;
  document_code?: string | null;
  document_name?: string | null;
  created_at?: string | null;
  status?: string | null;
}

/** 与后端 DocumentTraceNode 对齐 */
export interface DocumentTraceNode {
  document_type: string;
  document_id: number;
  document_code?: string | null;
  document_name?: string | null;
  created_at?: string | null;
  level: number;
  is_deleted?: boolean;
  children: DocumentTraceNode[];
  /** 仅 reporting_timeline 节点：合并报工时间线 */
  reporting_timeline?: DocumentTraceReportingEntry[] | null;
}

/** 与后端 DocumentTraceResponse 对齐 */
export interface DocumentTraceResponse {
  document_type: string;
  document_id: number;
  document_code?: string | null;
  document_name?: string | null;
  created_at?: string | null;
  upstream_chain: DocumentTraceNode[];
  downstream_chain: DocumentTraceNode[];
}

export type DocumentRelationTraceDirection = 'upstream' | 'downstream' | 'both';

export async function getDocumentRelationTrace(
  documentType: string,
  documentId: number,
  options?: { direction?: DocumentRelationTraceDirection; max_depth?: number }
): Promise<DocumentTraceResponse> {
  const direction = options?.direction ?? 'both';
  const max_depth = options?.max_depth ?? 10;
  const qs = new URLSearchParams({
    direction,
    max_depth: String(max_depth),
  });
  return apiRequest<DocumentTraceResponse>(
    `/apps/kuaizhizao/document-relations/${documentType}/${documentId}/trace?${qs.toString()}`,
    { method: 'GET' }
  );
}
