/**
 * 单据关联API服务
 *
 * 提供单据关联关系相关的API调用接口。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import { apiRequest } from '../../../services/api';
import type { DocumentRelationData, RelatedDocument } from '../../../components/document-relation-display';

/**
 * 获取单据关联关系
 *
 * @param documentType 单据类型（如：demand、work_order等）
 * @param documentId 单据ID
 * @returns 单据关联关系数据
 */
export async function getDocumentRelations(
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
