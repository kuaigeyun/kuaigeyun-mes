import type { TFunction } from 'i18next';
import type { TraceEdge, TraceEvent, TraceNode, TraceProfile } from '../../../services/traceability';
import { formatTraceGraphNodeLabel, parseTraceNodeId } from './inspectionTemplateUtils';

export type TraceSankeyLink = {
  source: string;
  target: string;
  value: number;
};

export type TraceSankeyModel = {
  links: TraceSankeyLink[];
  labelById: Map<string, string>;
};

/** 工艺阶段列：同类单据同列，避免报工链把桑基图拉成十多列后节点高度为 0 */
const STAGE_RANK: Record<string, number> = {
  serial: 0,
  batch: 0,
  purchase_receipt: 1,
  customer_material_registration: 1,
  incoming_inspection: 2,
  work_order: 3,
  production_picking: 4,
  material_binding: 4,
  inbound: 1,
  outbound: 4,
  reporting_record: 5,
  process_inspection: 6,
  finished_goods_inspection: 7,
  defect_record: 7,
  finished_goods_receipt: 8,
  semi_finished_goods_receipt: 8,
  oqc_inspection: 9,
  sales_delivery: 9,
  sales_return: 10,
};

const SANKEY_MIN_VALUE_RATIO = 0.12;

function parseQuantity(quantity: number | string | undefined): number {
  if (quantity == null || quantity === '') return 1;
  const n = Number(quantity);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function eventDocKey(ev: TraceEvent): string {
  return `${ev.documentType}:${ev.documentCode}`;
}

export function sankeyStageRank(nodeId: string): number {
  const { documentType } = parseTraceNodeId(nodeId);
  return STAGE_RANK[documentType] ?? 50;
}

export function sankeyNodeDepth(node: { key?: string }): number {
  return sankeyStageRank(String(node.key || ''));
}

function buildQuantityByNodeId(events: TraceEvent[], nodes: TraceNode[]): Map<string, number> {
  const qtyByKey = new Map<string, number>();
  for (const ev of events) {
    const key = eventDocKey(ev);
    const qty = parseQuantity(ev.quantity);
    qtyByKey.set(key, (qtyByKey.get(key) || 0) + qty);
  }

  const qtyByNodeId = new Map<string, number>();
  for (const node of nodes) {
    const qty = qtyByKey.get(node.id);
    if (qty != null) qtyByNodeId.set(node.id, qty);
  }
  return qtyByNodeId;
}

function aggregateLinks(links: TraceSankeyLink[]): TraceSankeyLink[] {
  const map = new Map<string, TraceSankeyLink>();
  for (const link of links) {
    const key = `${link.source}\0${link.target}`;
    const existing = map.get(key);
    if (existing) {
      existing.value += link.value;
    } else {
      map.set(key, { ...link });
    }
  }
  return Array.from(map.values());
}

function linksFromEdges(
  edges: TraceEdge[],
  knownIds: Set<string>,
  qtyByNodeId: Map<string, number>,
): TraceSankeyLink[] {
  const links: TraceSankeyLink[] = [];
  for (const edge of edges) {
    if (!knownIds.has(edge.source) || !knownIds.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    links.push({
      source: edge.source,
      target: edge.target,
      value: qtyByNodeId.get(edge.target) ?? 1,
    });
  }
  return links;
}

function linksFromTimeline(events: TraceEvent[], anchorCode: string): TraceSankeyLink[] {
  const filtered = events.filter(
    (ev) =>
      !(
        (ev.documentType === 'serial' || ev.documentType === 'batch') &&
        ev.documentCode === anchorCode
      ),
  );
  const sorted = [...filtered].sort((a, b) => {
    const ta = a.eventTime ? new Date(a.eventTime).getTime() : 0;
    const tb = b.eventTime ? new Date(b.eventTime).getTime() : 0;
    return ta - tb;
  });

  const links: TraceSankeyLink[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const source = eventDocKey(sorted[i]);
    const target = eventDocKey(sorted[i + 1]);
    if (source === target) continue;
    links.push({
      source,
      target,
      value: parseQuantity(sorted[i + 1].quantity),
    });
  }
  return links;
}

/** 去掉工艺逆流边（双向追溯里工单→成品批次等），否则 d3-sankey 会 circular link */
export function dropBackwardSankeyLinks(links: TraceSankeyLink[]): TraceSankeyLink[] {
  return links.filter((link) => sankeyStageRank(link.target) >= sankeyStageRank(link.source));
}

/**
 * 同列单据之间的链式边改为「上一阶段 → 各节点」，
 * 让多笔报工/检验并列而不是再占一列。
 */
export function promoteSameRankSankeyLinks(links: TraceSankeyLink[]): TraceSankeyLink[] {
  let current = aggregateLinks(links);
  for (let pass = 0; pass < 8; pass += 1) {
    const incoming = new Map<string, string[]>();
    for (const link of current) {
      const list = incoming.get(link.target) ?? [];
      list.push(link.source);
      incoming.set(link.target, list);
    }

    const next: TraceSankeyLink[] = [];
    let promoted = false;
    for (const link of current) {
      if (sankeyStageRank(link.source) !== sankeyStageRank(link.target)) {
        next.push(link);
        continue;
      }
      const parents = (incoming.get(link.source) ?? []).filter(
        (src) => sankeyStageRank(src) < sankeyStageRank(link.target),
      );
      if (parents.length === 0) {
        next.push(link);
        continue;
      }
      promoted = true;
      for (const src of parents) {
        next.push({ source: src, target: link.target, value: link.value });
      }
    }
    current = aggregateLinks(next);
    if (!promoted) break;
  }
  return current;
}

export function dropDirectedSankeyCycles(links: TraceSankeyLink[]): TraceSankeyLink[] {
  const adj = new Map<string, string[]>();
  for (const link of links) {
    const list = adj.get(link.source) ?? [];
    list.push(link.target);
    adj.set(link.source, list);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const blocked = new Set<string>();

  const dfs = (node: string): void => {
    visiting.add(node);
    for (const next of adj.get(node) ?? []) {
      const edgeKey = `${node}\0${next}`;
      if (visiting.has(next)) {
        blocked.add(edgeKey);
        continue;
      }
      if (!visited.has(next)) dfs(next);
    }
    visiting.delete(node);
    visited.add(node);
  };

  const nodes = new Set<string>();
  for (const link of links) {
    nodes.add(link.source);
    nodes.add(link.target);
  }
  for (const node of nodes) {
    if (!visited.has(node)) dfs(node);
  }

  return links.filter((link) => !blocked.has(`${link.source}\0${link.target}`));
}

/** 数量量级差过大时后段节点高度会被压成 0，只剩漂浮文字 */
export function floorSankeyLinkValues(
  links: TraceSankeyLink[],
  minRatio = SANKEY_MIN_VALUE_RATIO,
): TraceSankeyLink[] {
  const max = Math.max(...links.map((l) => l.value), 1);
  const floor = max * minRatio;
  return links.map((link) => ({
    ...link,
    value: Math.max(link.value, floor),
  }));
}

function buildLabelById(nodes: TraceNode[], t: TFunction): Map<string, string> {
  return new Map(nodes.map((n) => [n.id, formatTraceGraphNodeLabel(n, t)]));
}

/** 将追溯 profile 转为桑基图（节点 id 作 source/target，展示文案走 i18n） */
export function traceProfileToSankeyModel(profile: TraceProfile, t: TFunction): TraceSankeyModel {
  const labelById = buildLabelById(profile.nodes, t);
  const knownIds = new Set(profile.nodes.map((n) => n.id));
  const qtyByNodeId = buildQuantityByNodeId(profile.events, profile.nodes);

  let links = linksFromEdges(profile.edges || [], knownIds, qtyByNodeId);
  if (links.length === 0) {
    links = linksFromTimeline(profile.events, profile.anchor.code);
  }
  links = aggregateLinks(links);
  links = dropBackwardSankeyLinks(links);
  links = promoteSameRankSankeyLinks(links);
  links = dropDirectedSankeyCycles(links);
  links = floorSankeyLinkValues(links);
  return { links, labelById };
}
