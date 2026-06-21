import type { TFunction } from 'i18next';
import type { TraceEdge, TraceEvent, TraceNode, TraceProfile } from '../../../services/traceability';
import { getTraceabilityNodeTypeLabel } from './inspectionTemplateUtils';

export type TraceSankeyLink = {
  source: string;
  target: string;
  value: number;
};

function parseQuantity(quantity: number | string | undefined): number {
  if (quantity == null || quantity === '') return 1;
  const n = Number(quantity);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function eventDocKey(ev: TraceEvent): string {
  return `${ev.documentType}:${ev.documentCode}`;
}

function formatEventSankeyLabel(ev: TraceEvent, t: TFunction): string {
  const typeLabel = getTraceabilityNodeTypeLabel(ev.documentType, t);
  return `${typeLabel}: ${ev.documentCode}`;
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
  nodeLabelById: Map<string, string>,
  qtyByNodeId: Map<string, number>,
): TraceSankeyLink[] {
  const links: TraceSankeyLink[] = [];
  for (const edge of edges) {
    const source = nodeLabelById.get(edge.source);
    const target = nodeLabelById.get(edge.target);
    if (!source || !target || source === target) continue;
    links.push({
      source,
      target,
      value: qtyByNodeId.get(edge.target) ?? 1,
    });
  }
  return links;
}

function linksFromTimeline(events: TraceEvent[], anchorCode: string, t: TFunction): TraceSankeyLink[] {
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
    const source = formatEventSankeyLabel(sorted[i], t);
    const target = formatEventSankeyLabel(sorted[i + 1], t);
    if (source === target) continue;
    links.push({
      source,
      target,
      value: parseQuantity(sorted[i + 1].quantity),
    });
  }
  return links;
}

/** 将追溯 profile 转为桑基图 links（优先图谱边，否则按时间线串联） */
export function traceProfileToSankeyLinks(profile: TraceProfile, t: TFunction): TraceSankeyLink[] {
  const nodeLabelById = new Map(
    profile.nodes.map((n) => [n.id, (n.label || n.id).trim()]),
  );
  const qtyByNodeId = buildQuantityByNodeId(profile.events, profile.nodes);

  let links = linksFromEdges(profile.edges || [], nodeLabelById, qtyByNodeId);
  if (links.length === 0) {
    links = linksFromTimeline(profile.events, profile.anchor.code, t);
  }
  return aggregateLinks(links);
}
