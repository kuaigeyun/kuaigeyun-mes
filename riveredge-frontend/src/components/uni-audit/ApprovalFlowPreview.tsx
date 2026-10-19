import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { theme } from 'antd';
import { useNodesState, useEdgesState } from '@ant-design/pro-flow';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  useNodesInitialized,
  useUpdateNodeInternals,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import UniFlowNode from '../common/uni-flow-node';
import { CANVAS_GRID_REACTFLOW } from '../layout-templates/constants';
import type { ApprovalProcessGraph, ApprovalNodeOverview } from '../../services/approvalInstance';
import {
  APPROVAL_FLOW_EDGE_STYLE,
  enrichApprovalFlowGraph,
} from '../../utils/approvalFlowLayout';

const { useToken } = theme;

interface ApprovalFlowPreviewProps {
  graph?: ApprovalProcessGraph | null;
  nodesOverview?: ApprovalNodeOverview[];
  /** 像素或 CSS 高度；填满父级时传 '100%' 并保证父级为定高/flex 子项 */
  height?: number | string;
  style?: React.CSSProperties;
}

function nodeTypesFactory() {
  return {
    start: (p: any) => <UniFlowNode {...p} type="start" selected={p.selected} />,
    end: (p: any) => <UniFlowNode {...p} type="end" selected={p.selected} />,
    approval: (p: any) => <UniFlowNode {...p} type="approval" selected={p.selected} />,
    cc: (p: any) => <UniFlowNode {...p} type="cc" selected={p.selected} />,
    condition: (p: any) => <UniFlowNode {...p} type="condition" selected={p.selected} />,
  };
}

const NODE_TYPES = nodeTypesFactory();

/**
 * 弹窗首次有尺寸后再 fitView；只适配一次，避免冲掉滚轮缩放。
 * fit 前 updateNodeInternals：父级曾带 transform（antd Modal zoom）时刷新手柄坐标，避免连线偏移。
 */
function PreviewFitView({
  hostRef,
  layoutKey,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
  layoutKey: string;
}) {
  const { fitView, getNodes } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const ready = useNodesInitialized();

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) return;
    let fitted = false;

    const run = () => {
      if (fitted) return;
      const { width, height } = host.getBoundingClientRect();
      if (width < 48 || height < 48) return;
      updateNodeInternals(getNodes().map((n) => n.id));
      fitView({
        padding: 0.2,
        minZoom: 0.05,
        maxZoom: 1,
        duration: 0,
        includeHiddenNodes: true,
      });
      fitted = true;
    };

    run();
    const observer = new ResizeObserver(run);
    observer.observe(host);
    return () => observer.disconnect();
  }, [ready, fitView, getNodes, updateNodeInternals, hostRef, layoutKey]);

  return null;
}

/**
 * 与审批流设计器同一挂载方式：
 * - useNodesState / useEdgesState（@ant-design/pro-flow，与设计器同源）
 * - onNodesChange 回写测量宽高（设计器有、旧预览没有）
 * - enrichApprovalFlowGraph(relayout) 出画布节点/边
 */
function ApprovalFlowPreviewCanvas({
  graph,
  nodesOverview = [],
  height = 320,
  style,
}: ApprovalFlowPreviewProps) {
  const { token } = useToken();
  const hostRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const statusByNodeId = useMemo(() => {
    const map = new Map<string, ApprovalNodeOverview>();
    for (const item of nodesOverview) {
      map.set(item.node_id, item);
    }
    return map;
  }, [nodesOverview]);

  const graphKey = useMemo(() => {
    const rawNodes = graph?.nodes ?? [];
    const rawEdges = graph?.edges ?? [];
    return [
      rawNodes.map((n) => n.id).join(','),
      rawEdges.map((e) => `${e.source}->${e.target}`).join(','),
    ].join('|');
  }, [graph]);

  useEffect(() => {
    const rawNodes = graph?.nodes ?? [];
    const rawEdges = graph?.edges ?? [];
    const nodeIdSet = new Set(rawNodes.map((n) => String(n.id)));
    const baseNodes: Node[] = rawNodes.map((n) => ({
      id: String(n.id),
      type: String(n.type || 'approval'),
      position: n.position ?? { x: 0, y: 0 },
      data: { ...(n.data || {}) },
    }));
    const baseEdges: Edge[] = rawEdges
      .filter((e) => nodeIdSet.has(String(e.source)) && nodeIdSet.has(String(e.target)))
      .map((e, idx) => ({
        ...e,
        id: e.id || `e-${e.source}-${e.target}-${idx}`,
        source: String(e.source),
        target: String(e.target),
        type: e.type || 'default',
      }));
    const laidOut = enrichApprovalFlowGraph(baseNodes, baseEdges, { relayout: true });
    setNodes(laidOut.nodes as any);
    setEdges(laidOut.edges as any);
  }, [graphKey, graph, setNodes, setEdges]);

  // 与设计器 flowNodes/flowEdges 同一路径：state → enrich → 交给 ReactFlow
  const { flowNodes, flowEdges } = useMemo(() => {
    const merged = (nodes as Node[]).map((n) => {
      const overview = statusByNodeId.get(String(n.id));
      return {
        ...n,
        selected: Boolean(overview?.is_current),
        data: {
          ...(n.data || {}),
          flowStatus: overview?.status,
        },
      };
    });
    const { nodes: laid, edges: enriched } = enrichApprovalFlowGraph(
      merged,
      edges as Edge[],
      { relayout: true },
    );
    return {
      flowNodes: laid,
      flowEdges: enriched.map((e) => ({
        ...e,
        type: 'default' as const,
        style: { ...APPROVAL_FLOW_EDGE_STYLE, ...(e.style || {}) },
      })),
    };
  }, [nodes, edges, statusByNodeId]);

  const layoutKey = useMemo(
    () => flowNodes.map((n) => `${n.id}:${n.position?.x}:${n.position?.y}`).join('|'),
    [flowNodes],
  );

  if (!flowNodes.length) {
    return null;
  }

  return (
    <div
      ref={hostRef}
      className="uni-audit-flow-preview"
      style={{
        width: '100%',
        height,
        minHeight: 0,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden',
        ...CANVAS_GRID_REACTFLOW.style,
        ...style,
      }}
    >
      <style>{`
        .uni-audit-flow-preview {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .uni-audit-flow-preview::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
        .uni-audit-flow-preview .react-flow__handle {
          pointer-events: none;
        }
      `}</style>
      <ReactFlow
        nodes={flowNodes as any}
        edges={flowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        defaultEdgeOptions={{ type: 'default', style: { ...APPROVAL_FLOW_EDGE_STYLE } }}
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.05}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        preventScrolling
        proOptions={{ hideAttribution: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <PreviewFitView hostRef={hostRef} layoutKey={layoutKey} />
        <Background
          variant={CANVAS_GRID_REACTFLOW.variant as BackgroundVariant}
          color={CANVAS_GRID_REACTFLOW.color}
          gap={CANVAS_GRID_REACTFLOW.gap}
          size={CANVAS_GRID_REACTFLOW.size}
        />
      </ReactFlow>
    </div>
  );
}

/** 审核弹窗流程图预览：挂载方式与审批流设计器一致。 */
export const ApprovalFlowPreview: React.FC<ApprovalFlowPreviewProps> = (props) => (
  <ReactFlowProvider>
    <ApprovalFlowPreviewCanvas {...props} />
  </ReactFlowProvider>
);

export default ApprovalFlowPreview;
