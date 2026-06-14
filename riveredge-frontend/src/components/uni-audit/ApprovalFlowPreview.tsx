import React, { useMemo } from 'react';
import { theme } from 'antd';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import UniFlowNode from '../common/uni-flow-node';
import { CANVAS_GRID_REACTFLOW } from '../layout-templates/constants';
import type { ApprovalProcessGraph, ApprovalNodeOverview } from '../../services/approvalInstance';

const { useToken } = theme;

interface ApprovalFlowPreviewProps {
  graph?: ApprovalProcessGraph | null;
  nodesOverview?: ApprovalNodeOverview[];
  height?: number;
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

export const ApprovalFlowPreview: React.FC<ApprovalFlowPreviewProps> = ({
  graph,
  nodesOverview = [],
  height = 320,
}) => {
  const { token } = useToken();

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
    const flowNodes: Node[] = rawNodes.map((n) => {
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
    const flowEdges: Edge[] = rawEdges.map((e, idx) => ({
      id: e.id || `e-${e.source}-${e.target}-${idx}`,
      source: String(e.source),
      target: String(e.target),
      type: 'default',
      style: { stroke: token.colorBorderSecondary, strokeWidth: 2 },
    }));
    return { nodes: flowNodes, edges: flowEdges };
  }, [graph, statusByNodeId, token.colorBorderSecondary]);

  if (!nodes.length) {
    return null;
  }

  return (
    <div
      style={{
        width: '100%',
        height,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
        overflow: 'hidden',
        ...CANVAS_GRID_REACTFLOW.style,
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
      >
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
