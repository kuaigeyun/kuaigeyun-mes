/**
 * 审批流 / 审核预览：自上而下分层布局 + 正交连线。
 * 节点宽度须与 UniFlowNode（宽节点 220、起止 120）一致，否则连线会斜。
 */
import type { Edge, Node } from 'reactflow';

/** 与 UniFlowNode 外层 width 一致 */
export const APPROVAL_FLOW_NODE_WIDTH = {
  wide: 220,
  compact: 120,
} as const;

export const APPROVAL_FLOW_LAYOUT = {
  centerX: 280,
  baseY: 60,
  layerGap: 132,
  layerGapSame: 56,
  sameLayerGap: 200,
} as const;

function getNodeLayoutWidth(node: Node): number {
  const t = String(node.type);
  if (t === 'start' || t === 'end') return APPROVAL_FLOW_NODE_WIDTH.compact;
  return APPROVAL_FLOW_NODE_WIDTH.wide;
}

export function getConditionIds(edges: Edge[]): Set<string> {
  const outCount: Record<string, number> = {};
  edges.forEach((e) => {
    outCount[e.source] = (outCount[e.source] || 0) + 1;
  });
  const ids = new Set<string>();
  Object.keys(outCount).forEach((id) => {
    if (outCount[id] > 1) ids.add(id);
  });
  return ids;
}

/** 最长路径分层；结束节点固定在最深一层之下。 */
function computeLayerDepth(nodes: Node[], edges: Edge[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  const resolve = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const preds = edges.filter((e) => e.target === id && ids.has(e.source)).map((e) => e.source);
    let d = 0;
    if (id === 'start') d = 0;
    else if (preds.length === 0) d = 0;
    else d = 1 + Math.max(...preds.map((p) => resolve(p)));
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };

  ids.forEach((id) => resolve(id));

  if (ids.has('end')) {
    const maxNonEnd = Math.max(
      0,
      ...[...ids].filter((id) => id !== 'end').map((id) => depth.get(id) ?? 0),
    );
    depth.set('end', Math.max(depth.get('end') ?? 0, maxNonEnd + 1));
  }
  return depth;
}

/** 条件分叉出边序号 → 子树继承，用于同层从左到右排序。 */
function buildBranchIndex(edges: Edge[], conditionIds: Set<string>): Map<string, number> {
  const branchIndex = new Map<string, number>();
  branchIndex.set('start', 0);
  const seen = new Set<string>(['start']);
  const queue = ['start'];
  while (queue.length > 0) {
    const src = queue.shift()!;
    const outs = edges.filter((e) => e.source === src);
    outs.forEach((e, edgeIdx) => {
      const t = e.target;
      if (!seen.has(t)) {
        seen.add(t);
        queue.push(t);
        if (conditionIds.has(src)) branchIndex.set(t, edgeIdx);
        else branchIndex.set(t, branchIndex.get(src) ?? 0);
      }
    });
  }
  return branchIndex;
}

function sortLayerNodes(layerNodes: Node[], branchIndex: Map<string, number>): Node[] {
  return [...layerNodes].sort((a, b) => {
    const ba = branchIndex.get(a.id) ?? 0;
    const bb = branchIndex.get(b.id) ?? 0;
    if (ba !== bb) return ba - bb;
    if (a.id === 'start') return -1;
    if (b.id === 'start') return 1;
    if (a.id === 'end') return 1;
    if (b.id === 'end') return -1;
    return a.id.localeCompare(b.id);
  });
}

/** 自上而下重算坐标：单层单节点一律主干居中；同层多个则整行居中排开。 */
export function applyVerticalLayout(nodes: Node[], edges: Edge[]): Node[] {
  const conditionIds = getConditionIds(edges);
  const layerDepth = computeLayerDepth(nodes, edges);
  const branchIndex = buildBranchIndex(edges, conditionIds);

  const byLayer = new Map<number, Node[]>();
  nodes.forEach((node) => {
    const L = layerDepth.get(node.id) ?? 0;
    const list = byLayer.get(L) ?? [];
    list.push(node);
    byLayer.set(L, list);
  });

  const { centerX, baseY, layerGap, layerGapSame, sameLayerGap } = APPROVAL_FLOW_LAYOUT;
  const positionById = new Map<string, { x: number; y: number }>();

  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
  for (const L of sortedLayers) {
    const layerNodes = sortLayerNodes(byLayer.get(L) ?? [], branchIndex);
    const y = baseY + L * layerGap;

    if (layerNodes.length === 1) {
      const node = layerNodes[0];
      const w = getNodeLayoutWidth(node);
      positionById.set(node.id, { x: centerX - w / 2, y });
      continue;
    }

    const gap = layerGapSame;
    const totalWidth =
      layerNodes.reduce((sum, n) => sum + getNodeLayoutWidth(n), 0) +
      (layerNodes.length - 1) * gap;
    let xCursor = centerX - totalWidth / 2;
    layerNodes.forEach((node) => {
      const w = getNodeLayoutWidth(node);
      positionById.set(node.id, { x: xCursor, y });
      xCursor += w + gap;
    });
  }

  return nodes.map((node) => ({
    ...node,
    position: positionById.get(node.id) ?? node.position ?? { x: 0, y: 0 },
  }));
}

/** 直线贴手柄中心。step 会在节点外再拐一刀，手柄被挡住时看起来像线断开。 */
export function enrichApprovalFlowEdges(nodes: Node[], edges: Edge[]): Edge[] {
  const posById = new Map(nodes.map((n) => [n.id, n.position]));
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  const outsBySource = new Map<string, Edge[]>();
  edges.forEach((e) => {
    const list = outsBySource.get(e.source) ?? [];
    list.push(e);
    outsBySource.set(e.source, list);
  });

  const handleIndexByEdgeId = new Map<string, number>();
  outsBySource.forEach((outs, sourceId) => {
    if (typeById.get(sourceId) !== 'condition' || outs.length <= 1) return;
    const sorted = [...outs].sort(
      (a, b) => (posById.get(a.target)?.x ?? 0) - (posById.get(b.target)?.x ?? 0),
    );
    sorted.forEach((e, idx) => handleIndexByEdgeId.set(e.id, idx));
  });

  return edges.map((e, i) => {
    const id = e.id || `e-${e.source}-${e.target}-${i}`;
    const branchIdx = handleIndexByEdgeId.get(id);
    return {
      ...e,
      id,
      type: 'straight',
      ...(branchIdx != null ? { sourceHandle: `branch-${branchIdx}` } : {}),
    };
  });
}

export function attachConditionBranchHandles(nodes: Node[], edges: Edge[]): Node[] {
  return nodes.map((node) => {
    if (node.type !== 'condition') return node;
    const n = edges.filter((e) => e.source === node.id).length;
    const branchSourceCount = n <= 1 ? 1 : Math.min(8, n);
    return {
      ...node,
      data: {
        ...(node.data || {}),
        branchSourceCount,
      },
    };
  });
}

export type EnrichApprovalFlowGraphOptions = {
  relayout?: boolean;
};

export function enrichApprovalFlowGraph(
  nodes: Node[],
  edges: Edge[],
  options?: EnrichApprovalFlowGraphOptions,
): { nodes: Node[]; edges: Edge[] } {
  const relayout = options?.relayout !== false;
  const laidOut = relayout ? applyVerticalLayout(nodes, edges) : nodes;
  const withHandles = attachConditionBranchHandles(laidOut, edges);
  const flowEdges = enrichApprovalFlowEdges(withHandles, edges);
  return { nodes: withHandles, edges: flowEdges };
}
