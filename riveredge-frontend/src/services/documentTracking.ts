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
  /** 是否由系统自动生成（如下推关系自动产生） */
  is_auto_created?: boolean;
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
  /** 报工记录字段 */
  operation_name?: string;
  operation_code?: string;
  reported_quantity?: string;
  qualified_quantity?: string;
  unqualified_quantity?: string;
  work_hours?: string;
  status?: string;
}

export interface DocumentTrackingRelation {
  type: string;
  id: number;
  code?: string;
  name?: string;
  mode?: string;
  is_auto_created?: boolean;
  is_deleted?: boolean;
  is_changed_after_link?: boolean;
}

export interface DocumentTrackingGraphNode {
  /** 稳定图节点键，与 relationNodeKey / `{document_type}-{document_id}` 一致 */
  id: string;
  document_type: string;
  document_id: number;
  code?: string;
  name?: string;
  /** 在当前视图中的角色；同一单据既在上游又在下游列表时出现 related */
  role: 'current' | 'upstream' | 'downstream' | 'related';
}

export interface DocumentTrackingGraphEdge {
  from: string;
  to: string;
  direction: 'upstream' | 'downstream';
}

export interface DocumentTrackingRelationsGraph {
  nodes: DocumentTrackingGraphNode[];
  edges: DocumentTrackingGraphEdge[];
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
  /** 由 relations 推导的一步关联图；扁平列表仍为权威数据源 */
  relations_graph?: DocumentTrackingRelationsGraph;
}

/** 兼容网关/异常 JSON 中缺失或非数组字段，避免详情抽屉渲染崩溃 */
export function normalizeDocumentTrackingResponse(d: DocumentTrackingResponse): DocumentTrackingResponse {
  const rel = d.relations;
  return {
    ...d,
    timeline: Array.isArray(d.timeline) ? d.timeline : [],
    relations: {
      upstream: Array.isArray(rel?.upstream) ? rel.upstream : [],
      downstream: Array.isArray(rel?.downstream) ? rel.downstream : [],
    },
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
