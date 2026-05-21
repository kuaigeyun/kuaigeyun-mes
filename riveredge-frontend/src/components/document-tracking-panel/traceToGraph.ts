/**
 * 将单据追溯树（upstream_chain / downstream_chain）转为 FlowGraph 所需 nodes / edges
 */

import type {
  DocumentTraceResponse,
  DocumentTraceNode,
  DocumentTraceReportingEntry,
} from '../../services/documentRelations';

export function traceDocumentNodeKey(document_type: string, document_id: number): string {
  return `${document_type}-${document_id}`;
}

export interface TraceGraphNodeMeta {
  document_type: string;
  document_id: number;
  document_code?: string;
  document_name?: string;
  created_at?: string;
  /** 是否为当前查看的单据 */
  is_root?: boolean;
  /** 关联单据是否已删除 */
  is_deleted?: boolean;
  /** 合并报工时间线（仅 reporting_timeline） */
  reporting_timeline?: DocumentTraceReportingEntry[];
}

export interface TraceFlowDatum {
  id: string;
  label: string;
  meta: TraceGraphNodeMeta;
  /** FlowGraph 节点样式（可由外层覆盖） */
  style?: { fill?: string; stroke?: string; lineWidth?: number };
  /** 自定义节点宽高（如报工时间线） */
  flowNodeSize?: [number, number];
}

export interface TraceFlowEdgeDatum {
  source: string;
  target: string;
}

export interface TraceToFlowGraphResult {
  nodes: TraceFlowDatum[];
  edges: TraceFlowEdgeDatum[];
  metaById: Record<string, TraceGraphNodeMeta>;
}

function upsertNode(map: Map<string, TraceGraphNodeMeta>, meta: TraceGraphNodeMeta): void {
  const key = traceDocumentNodeKey(meta.document_type, meta.document_id);
  const prev = map.get(key);
  if (!prev) {
    map.set(key, { ...meta });
    return;
  }
  if (meta.document_code && !prev.document_code) prev.document_code = meta.document_code;
  if (meta.document_name && !prev.document_name) prev.document_name = meta.document_name;
  if (meta.created_at && !prev.created_at) prev.created_at = meta.created_at;
  if (meta.is_root) prev.is_root = true;
  if (meta.is_deleted) prev.is_deleted = true;
  if (meta.reporting_timeline !== undefined && meta.reporting_timeline !== null) {
    prev.reporting_timeline = meta.reporting_timeline;
  }
}

function addEdgeDedup(edges: TraceFlowEdgeDatum[], dedup: Set<string>, source: string, target: string): void {
  const k = `${source}\n${target}`;
  if (dedup.has(k)) return;
  dedup.add(k);
  edges.push({ source, target });
}

function rebuildEdgeDedup(edges: TraceFlowEdgeDatum[], dedup: Set<string>): void {
  dedup.clear();
  for (const e of edges) {
    dedup.add(`${e.source}\n${e.target}`);
  }
}

/** 全链路图上销售出库只保留「成品入库 → 销售出库」，去掉其它歧义入边。 */
function keepOnlyFinishedGoodsReceiptToSalesDeliveryEdges(
  nodeMap: Map<string, TraceGraphNodeMeta>,
  edges: TraceFlowEdgeDatum[],
  edgeDedup: Set<string>,
): void {
  const sdTarget = /^sales_delivery-\d+$/;
  const kept = edges.filter((e) => {
    if (!sdTarget.test(e.target)) return true;
    return nodeMap.get(e.source)?.document_type === 'finished_goods_receipt';
  });
  if (kept.length === edges.length) return;
  edges.length = 0;
  edges.push(...kept);
  rebuildEdgeDedup(edges, edgeDedup);
}

/** 工单与成品/半成品入库之间插入报工时间线节点后，改线为 工单→时间线→入库 */
function rewireWorkOrderReceiptsThroughReportingTimeline(
  nodeMap: Map<string, TraceGraphNodeMeta>,
  edges: TraceFlowEdgeDatum[],
  edgeDedup: Set<string>
): void {
  const receiptPrefixes = ['semi_finished_goods_receipt-', 'finished_goods_receipt-'] as const;
  for (const [, meta] of nodeMap) {
    if (meta.document_type !== 'work_order') continue;
    const woKey = traceDocumentNodeKey('work_order', meta.document_id);
    const tlKey = traceDocumentNodeKey('reporting_timeline', -meta.document_id);
    if (!nodeMap.has(tlKey)) continue;

    const newReceiptEdges: TraceFlowEdgeDatum[] = [];
    for (let i = edges.length - 1; i >= 0; i--) {
      const e = edges[i];
      if (e.source !== woKey) continue;
      if (!receiptPrefixes.some((p) => e.target.startsWith(p))) continue;
      newReceiptEdges.push({ source: tlKey, target: e.target });
      edgeDedup.delete(`${e.source}\n${e.target}`);
      edges.splice(i, 1);
    }
    addEdgeDedup(edges, edgeDedup, woKey, tlKey);
    for (const ne of newReceiptEdges) {
      addEdgeDedup(edges, edgeDedup, ne.source, ne.target);
    }
  }
}

function walkUpstream(
  node: DocumentTraceNode,
  nodeMap: Map<string, TraceGraphNodeMeta>,
  edges: TraceFlowEdgeDatum[],
  dedup: Set<string>
): void {
  upsertNode(nodeMap, {
    document_type: node.document_type,
    document_id: node.document_id,
    document_code: node.document_code ?? undefined,
    document_name: node.document_name ?? undefined,
    created_at: node.created_at ?? undefined,
    is_deleted: node.is_deleted ?? undefined,
    reporting_timeline: node.reporting_timeline ?? undefined,
  });
  const parentKey = traceDocumentNodeKey(node.document_type, node.document_id);
  const children = node.children ?? [];
  for (const child of children) {
    const childKey = traceDocumentNodeKey(child.document_type, child.document_id);
    addEdgeDedup(edges, dedup, childKey, parentKey);
    walkUpstream(child, nodeMap, edges, dedup);
  }
}

function walkDownstream(
  node: DocumentTraceNode,
  nodeMap: Map<string, TraceGraphNodeMeta>,
  edges: TraceFlowEdgeDatum[],
  dedup: Set<string>
): void {
  upsertNode(nodeMap, {
    document_type: node.document_type,
    document_id: node.document_id,
    document_code: node.document_code ?? undefined,
    document_name: node.document_name ?? undefined,
    created_at: node.created_at ?? undefined,
    is_deleted: node.is_deleted ?? undefined,
    reporting_timeline: node.reporting_timeline ?? undefined,
  });
  const parentKey = traceDocumentNodeKey(node.document_type, node.document_id);
  const children = node.children ?? [];
  for (const child of children) {
    const childKey = traceDocumentNodeKey(child.document_type, child.document_id);
    addEdgeDedup(edges, dedup, parentKey, childKey);
    walkDownstream(child, nodeMap, edges, dedup);
  }
}

/** 默认节点文案（不含 i18n）；展示层可用 meta + t() 替换 label */
export function defaultTraceNodeLabel(meta: TraceGraphNodeMeta): string {
  const code = (meta.document_code || '').trim() || `#${meta.document_id}`;
  return code;
}

/**
 * @param trace API 追溯响应
 * @param formatLabel (meta) => 节点展示文案，例如拼接单据类型中文名
 */
export function traceResponseToFlowGraphData(
  trace: DocumentTraceResponse,
  formatLabel: (meta: TraceGraphNodeMeta) => string
): TraceToFlowGraphResult {
  const rootKey = traceDocumentNodeKey(trace.document_type, trace.document_id);
  const nodeMap = new Map<string, TraceGraphNodeMeta>();
  const edges: TraceFlowEdgeDatum[] = [];
  const edgeDedup = new Set<string>();

  upsertNode(nodeMap, {
    document_type: trace.document_type,
    document_id: trace.document_id,
    document_code: trace.document_code ?? undefined,
    document_name: trace.document_name ?? undefined,
    created_at: trace.created_at ?? undefined,
    is_root: true,
  });

  for (const top of trace.upstream_chain ?? []) {
    walkUpstream(top, nodeMap, edges, edgeDedup);
    const tk = traceDocumentNodeKey(top.document_type, top.document_id);
    addEdgeDedup(edges, edgeDedup, tk, rootKey);
  }

  for (const top of trace.downstream_chain ?? []) {
    walkDownstream(top, nodeMap, edges, edgeDedup);
    const tk = traceDocumentNodeKey(top.document_type, top.document_id);
    addEdgeDedup(edges, edgeDedup, rootKey, tk);
  }

  keepOnlyFinishedGoodsReceiptToSalesDeliveryEdges(nodeMap, edges, edgeDedup);
  rewireWorkOrderReceiptsThroughReportingTimeline(nodeMap, edges, edgeDedup);

  const metaById: Record<string, TraceGraphNodeMeta> = {};
  const nodes: TraceFlowDatum[] = [];

  for (const [id, meta] of nodeMap) {
    metaById[id] = meta;
    const isRoot = !!meta.is_root;
    nodes.push({
      id,
      label: formatLabel(meta),
      meta,
      style: isRoot
        ? { fill: '#E6F4FF', stroke: '#1677FF', lineWidth: 2 }
        : { fill: '#F5F5F5', stroke: '#D9D9D9', lineWidth: 1 },
    });
  }

  return { nodes, edges, metaById };
}
