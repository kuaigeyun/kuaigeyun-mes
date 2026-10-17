import React, { useEffect, useMemo, useRef } from 'react';
import { theme } from 'antd';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useReactFlow,
  useNodesInitialized,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import UniFlowNode from '../common/uni-flow-node';
import { CANVAS_GRID_REACTFLOW } from '../layout-templates/constants';
import type { ApprovalProcessGraph, ApprovalNodeOverview } from '../../services/approvalInstance';
import { enrichApprovalFlowGraph } from '../../utils/approvalFlowLayout';

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

/** 弹窗打开后容器才有尺寸；节点测量完成且容器变化时再 fitView，避免停在默认视口。 */
function PreviewFitView({
  hostRef,
  layoutKey,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
  layoutKey: string;
}) {
  const { fitView } = useReactFlow();
  const ready = useNodesInitialized();

  useEffect(() => {
    const host = hostRef.current;
    if (!ready || !host) return;
    const run = () => {
      fitView({ padding: 0.2, maxZoom: 1, duration: 0 });
    };
    run();
    const observer = new ResizeObserver(run);
    observer.observe(host);
    return () => observer.disconnect();
  }, [ready, fitView, hostRef, layoutKey]);

  return null;
}

export const ApprovalFlowPreview: React.FC<ApprovalFlowPreviewProps> = ({
  graph,
  nodesOverview = [],
  height = 320,
  style,
}) => {
  const { token } = useToken();
  const hostRef = useRef<HTMLDivElement>(null);

  const statusByNodeId = useMemo(() => {
    const map = new Map<string, ApprovalNodeOverview>();
    for (const item of nodesOverview) {
      map.set(item.node_id, item);
    }
    return map;
  }, [nodesOverview]);

  const { nodes, edges } = useMemo(() => {
    const rawNodes = graph?.nodes ?? [];
    const rawEdges = graph?.edges ?? [];
    const baseNodes: Node[] = rawNodes.map((n) => {
      const overview = statusByNodeId.get(String(n.id));
      const isCurrent = overview?.is_current;
      const status = overview?.status;
      return {
        id: String(n.id),
        type: String(n.type || 'approval'),
        position: n.position ?? { x: 0, y: 0 },
        data: {
          ...(n.data || {}),
          flowStatus: status,
        },
        selected: isCurrent,
      };
    });
    const baseEdges: Edge[] = rawEdges.map((e, idx) => ({
      id: e.id || `e-${e.source}-${e.target}-${idx}`,
      source: String(e.source),
      target: String(e.target),
    }));
    const laidOut = enrichApprovalFlowGraph(baseNodes, baseEdges, { relayout: true });
    return {
      nodes: laidOut.nodes,
      edges: laidOut.edges.map((e) => ({
        ...e,
        style: { stroke: '#475569', strokeWidth: 2, ...(e.style || {}) },
      })),
    };
  }, [graph, statusByNodeId]);

  if (!nodes.length) {
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
      {/* 只读：手柄仍显示，否则连线锚点看不见，竖线会像断开 */}
      <style>{`
        .uni-audit-flow-preview .react-flow__handle {
          pointer-events: none;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        defaultEdgeOptions={{ type: 'straight' }}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <PreviewFitView
          hostRef={hostRef}
          layoutKey={nodes.map((n) => n.id).join('|')}
        />
        <Background
          variant={CANVAS_GRID_REACTFLOW.variant as BackgroundVariant}
          color={CANVAS_GRID_REACTFLOW.color}
          gap={CANVAS_GRID_REACTFLOW.gap}
          size={CANVAS_GRID_REACTFLOW.size}
        />
      </ReactFlow>
    </div>
  );
};

export default ApprovalFlowPreview;
