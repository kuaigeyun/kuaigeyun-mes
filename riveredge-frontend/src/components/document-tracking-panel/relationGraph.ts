import type { DocumentTrackingRelation, DocumentTrackingResponse } from '../../services/documentTracking';

/** 稳定节点 id；与后端 relations_graph.nodes[].id 一致（{type}-{id}） */
export function relationNodeKey(rel: DocumentTrackingRelation): string {
  return `${rel.type}-${rel.id}`;
}

export function currentSegmentKey(document_type: string, document_id: number): string {
  return `current-${document_type}-${document_id}`;
}

export type RelationChainVariant = 'upstream' | 'current' | 'downstream';

export interface RelationChainSegment {
  key: string;
  variant: RelationChainVariant;
  /** upstream / downstream 时有值 */
  relation?: DocumentTrackingRelation;
}

/** 线性链：上游… → 当前 → 下游…（顺序与 API 列表一致） */
export function buildRelationChainSegments(data: DocumentTrackingResponse): RelationChainSegment[] {
  const segs: RelationChainSegment[] = [];
  for (const r of data.relations.upstream) {
    segs.push({ key: `${relationNodeKey(r)}-up`, variant: 'upstream', relation: r });
  }
  segs.push({
    key: currentSegmentKey(data.document_type, data.document_id),
    variant: 'current',
  });
  for (const r of data.relations.downstream) {
    segs.push({ key: `${relationNodeKey(r)}-down`, variant: 'downstream', relation: r });
  }
  return segs;
}
