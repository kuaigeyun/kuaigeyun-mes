/**
 * 单据关联API服务
 *
 * 统一提供单据关联关系的API调用。根据单据类型路由到对应后端：
 * - 规划类（demand、sales_forecast、sales_order）→ /document-relations/（新实现）
 * - 执行类（work_order、purchase_order 等）→ /documents/.../relations（旧实现，业务逻辑推导）
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import { apiRequest } from '../../../services/api';
import type { DocumentRelationData, RelatedDocument } from '../../../components/document-relation-display';

/** 使用 document-relations 新 API 的单据类型（基于 DocumentRelation 表） */
const DOCUMENT_RELATIONS_API_TYPES = new Set(['demand', 'sales_forecast', 'sales_order']);

/**
 * 获取单据关联关系（统一入口）
 *
 * @param documentType 单据类型（如：demand、work_order等）
 * @param documentId 单据ID
 * @returns 单据关联关系数据
 */
export async function getDocumentRelations(
  documentType: string,
  documentId: number
): Promise<DocumentRelationData> {
  if (DOCUMENT_RELATIONS_API_TYPES.has(documentType)) {
    return getDocumentRelationsFromNewApi(documentType, documentId);
  }
  return getDocumentRelationsFromLegacyApi(documentType, documentId);
}

/**
 * 从 /document-relations/ 新 API 获取（规划类单据）
 */
async function getDocumentRelationsFromNewApi(
  documentType: string,
  documentId: number
): Promise<DocumentRelationData> {
  const response = await apiRequest<{
    upstream: Array<{
      id: number;
      source_type: string;
      source_id: number;
      source_code?: string;
      source_name?: string;
      target_type: string;
      target_id: number;
      target_code?: string;
      target_name?: string;
      relation_type: string;
      relation_mode: string;
      relation_desc?: string;
      created_at?: string;
    }>;
    downstream: Array<{
      id: number;
      source_type: string;
      source_id: number;
      source_code?: string;
      source_name?: string;
      target_type: string;
      target_id: number;
      target_code?: string;
      target_name?: string;
      relation_type: string;
      relation_mode: string;
      relation_desc?: string;
      created_at?: string;
    }>;
  }>({
    url: `/apps/kuaizhizao/document-relations/${documentType}/${documentId}`,
    method: 'GET',
  });
  return transformNewApiResponse(response);
}

/**
 * 从 /documents/.../relations 旧 API 获取（执行类单据，业务逻辑推导）
 */
async function getDocumentRelationsFromLegacyApi(
  documentType: string,
  documentId: number
): Promise<DocumentRelationData> {
  const result = await apiRequest<DocumentRelationData>({
    url: `/apps/kuaizhizao/documents/${documentType}/${documentId}/relations`,
    method: 'GET',
  });
  return {
    upstream_documents: result.upstream_documents ?? [],
    downstream_documents: result.downstream_documents ?? [],
    upstream_count: result.upstream_count ?? (result.upstream_documents?.length ?? 0),
    downstream_count: result.downstream_count ?? (result.downstream_documents?.length ?? 0),
  };
}

function transformNewApiResponse(response: {
  upstream?: Array<{
    source_type: string;
    source_id: number;
    source_code?: string;
    source_name?: string;
    relation_desc?: string;
    created_at?: string;
  }>;
  downstream?: Array<{
    target_type: string;
    target_id: number;
    target_code?: string;
    target_name?: string;
    relation_desc?: string;
    created_at?: string;
  }>;
}): DocumentRelationData {
  // 转换上游单据（当前单据作为target，上游单据是source）
  // 上游关联：当前单据是target，上游单据是source
  const upstreamDocuments: RelatedDocument[] = (response.upstream || []).map((rel) => ({
    document_type: rel.source_type,
    document_id: rel.source_id,
    document_code: rel.source_code,
    document_name: rel.source_name,
    relation_desc: rel.relation_desc,
    created_at: rel.created_at,
  }));

  // 转换下游单据（当前单据作为source，下游单据是target）
  // 下游关联：当前单据是source，下游单据是target
  const downstreamDocuments: RelatedDocument[] = (response.downstream || []).map((rel) => ({
    document_type: rel.target_type,
    document_id: rel.target_id,
    document_code: rel.target_code,
    document_name: rel.target_name,
    relation_desc: rel.relation_desc,
    created_at: rel.created_at,
  }));

  return {
    upstream_documents: upstreamDocuments,
    downstream_documents: downstreamDocuments,
    upstream_count: upstreamDocuments.length,
    downstream_count: downstreamDocuments.length,
  };
}

/**
 * 追溯节点
 */
export interface TraceNode {
  document_type: string;
  document_id: number;
  document_code?: string;
  document_name?: string;
  level: number;
  children: TraceNode[];
}

/**
 * 单据追溯数据
 */
export interface DocumentTraceData {
  document_type: string;
  document_id: number;
  document_code?: string;
  document_name?: string;
  upstream_chain: TraceNode[];
  downstream_chain: TraceNode[];
}

/**
 * 追溯单据关联链
 *
 * @param documentType 单据类型
 * @param documentId 单据ID
 * @param direction 追溯方向（upstream: 向上追溯, downstream: 向下追溯, both: 双向追溯）
 * @param maxDepth 最大追溯深度
 * @returns 追溯链数据
 */
export async function traceDocumentChain(
  documentType: string,
  documentId: number,
  direction: 'upstream' | 'downstream' | 'both' = 'both',
  maxDepth: number = 10
): Promise<DocumentTraceData> {
  const response = await apiRequest<DocumentTraceData>({
    url: `/apps/kuaizhizao/document-relations/${documentType}/${documentId}/trace`,
    method: 'GET',
    params: {
      direction,
      max_depth: maxDepth,
    },
  });

  return response;
}
