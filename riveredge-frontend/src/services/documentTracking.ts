/**
 * 单据跟踪中心 API 服务
 */

import { apiRequest } from './api';

export interface DocumentTrackingFieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface DocumentTrackingTimelineItem {
  type: string;
  at?: string;
  by?: string;
  by_id?: number;
  detail?: string;
  from_state?: string;
  to_state?: string;
  reason?: string;
  /** 是否自动审核（状态变更为审核通过时） */
  is_auto_approve?: boolean;
  result?: string;
  comment?: string;
  changed_fields?: string[];
  field_changes?: DocumentTrackingFieldChange[];
  target_type?: string;
  target_id?: number;
  target_code?: string;
  source_type?: string;
  source_id?: number;
  source_code?: string;
}

export interface DocumentTrackingRelation {
  type: string;
  id: number;
  code?: string;
  name?: string;
  mode?: string;
}

export interface DocumentTrackingResponse {
  document_type: string;
  document_id: number;
  document_code?: string;
  timeline: DocumentTrackingTimelineItem[];
  relations: {
    upstream: DocumentTrackingRelation[];
    downstream: DocumentTrackingRelation[];
  };
}

export async function getDocumentTracking(
  documentType: string,
  documentId: number
): Promise<DocumentTrackingResponse> {
  return apiRequest<DocumentTrackingResponse>(
    `/core/document-tracking/${documentType}/${documentId}`,
    { method: 'GET' }
  );
}
