/**
 * 审批流 / 审核预览：自上而下分层布局 + 贝塞尔连线。
 * 条件分支在汇合前左右错开；汇合节点回主干，避免双线叠在同一竖轴上。
 * 节点宽度须与 UniFlowNode（宽节点 220、起止 120）一致。
 */
import type { Edge, Node } from 'reactflow';

/** 与 UniFlowNode 外层 width 一致 */
export const APPROVAL_FLOW_NODE_WIDTH = {
  wide: 220,
  compact: 120,
} as const;

export const APPROVAL_FLOW_LAYOUT = {
  centerX: 320,
  baseY: 60,
  layerGap: 140,
  layerGapSame: 56,
  branchGap: 48,
  branchColumnWidth: 240,
} as const;

/** 设计器与审核预览共用的连线外观 */
export const APPROVAL_FLOW_EDGE_STYLE = {
  stroke: '#475569',
  strokeWidth: 2,
} as const;

function getNodeLayoutWidth(node: Node): number {
  const t = String(node.type);
  if (t === 'start' || t === 'end') return APPROVAL_FLOW_NODE_WIDTH.compact;
  return APPROVAL_FLOW_NODE_WIDTH.wide;
}

function getSubtreeFrom(nodeId: string, edges: Edge[]): Set<string> {
  const out = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    edges
      .filter((e) => e.source === curr)
      .forEach((e) => {
        if (!out.has(e.target)) {
          out.add(e.target);
          queue.push(e.target);
        }
      });
  }
  return out;
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

/** 条件分叉出边序号 → 子树继承（BFS 首次到达）。 */
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

function getMergeIds(edges: Edge[]): Set<string> {
  const inCount: Record<string, number> = {};
  edges.forEach((e) => {
    inCount[e.target] = (inCount[e.target] || 0) + 1;
  });
  return new Set(Object.keys(inCount).filter((id) => (inCount[id] || 0) > 1));
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

/**
 * 自上而下重算坐标。
 * - 主干 / 条件节点 / 汇合节点：居中
 * - 条件分叉后、汇合前的纯分支节点：按分支序号左右错开（即使该层只有一个节点）
 */
export function applyVerticalLayout(nodes: Node[], edges: Edge[]): Node[] {
  const conditionIds = getConditionIds(edges);
  const layerDepth = computeLayerDepth(nodes, edges);
  const branchIndex = buildBranchIndex(edges, conditionIds);
  const mergeIds = getMergeIds(edges);

  const inConditionSubtree = new Set<string>();
  conditionIds.forEach((cid) => {
    getSubtreeFrom(cid, edges).forEach((id) => inConditionSubtree.add(id));
  });

  const byLayer = new Map<number, Node[]>();
  nodes.forEach((node) => {
    const L = layerDepth.get(node.id) ?? 0;
    const list = byLayer.get(L) ?? [];
    list.push(node);
    byLayer.set(L, list);
  });

  const branchValues = [...branchIndex.entries()]
    .filter(([id]) => inConditionSubtree.has(id) && !mergeIds.has(id) && !conditionIds.has(id))
    .map(([, b]) => b);
  const maxBranch = branchValues.length > 0 ? Math.max(...branchValues) : 0;
  const numBranches = Math.max(1, maxBranch + 1);

  const { centerX, baseY, layerGap, layerGapSame, branchGap, branchColumnWidth } =
    APPROVAL_FLOW_LAYOUT;
  const totalBranchWidth = numBranches * branchColumnWidth + (numBranches - 1) * branchGap;
  const branchCenterX = (b: number) =>
    centerX - totalBranchWidth / 2 + b * (branchColumnWidth + branchGap) + branchColumnWidth / 2;

  const onSpine = (node: Node): boolean => {
    if (node.id === 'start' || node.id === 'end') return true;
    if (conditionIds.has(node.id)) return true;
    if (mergeIds.has(node.id)) return true;
    if (!inConditionSubtree.has(node.id)) return true;
    return false;
  };

  const positionById = new Map<string, { x: number; y: number }>();

  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
  for (const L of sortedLayers) {
    const layerNodes = sortLayerNodes(byLayer.get(L) ?? [], branchIndex);
    const y = baseY + L * layerGap;
    if (layerNodes.length === 0) continue;

    if (layerNodes.length === 1) {
      const node = layerNodes[0];
      const w = getNodeLayoutWidth(node);
      const cx = onSpine(node) ? centerX : branchCenterX(branchIndex.get(node.id) ?? 0);
      positionById.set(node.id, { x: cx - w / 2, y });
      continue;
    }

    // 同层多个：按分支序号排开；主干节点仍尽量居中夹在中间
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

/**
 * 贝塞尔曲线（React Flow `default`）。
 * 条件多分支共用底边同一 source 点，不挂 branch-N，避免多圆点。
 */
export function enrichApprovalFlowEdges(nodes: Node[], edges: Edge[]): Edge[] {
  return edges.map((e, i) => {
    const id = e.id || `e-${e.source}-${e.target}-${i}`;
    const { sourceHandle: _dropSourceHandle, ...rest } = e as Edge & {
      sourceHandle?: string | null;
    };
    return {
      ...rest,
      id,
      type: 'default',
      sourceHandle: undefined,
    };
  });
}

/** 保留出边数供节点文案；渲染始终单点出口。 */
export function attachConditionBranchHandles(nodes: Node[], edges: Edge[]): Node[] {
  return nodes.map((node) => {
    if (node.type !== 'condition') return node;
    const n = edges.filter((e) => e.source === node.id).length;
    return {
      ...node,
      data: {
        ...(node.data || {}),
        branchSourceCount: Math.max(1, Math.min(8, n || 1)),
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
