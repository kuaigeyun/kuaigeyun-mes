/**
 * 单据关联关系图形化展示组件
 *
 * 使用@ant-design/pro-flow实现单据关联关系的图形化可视化展示。
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Space, Tag, Empty, Spin, Radio, Drawer } from 'antd';
import { EyeOutlined, ReloadOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons';
import { FlowView, FlowStoreProvider, useNodesState, useEdgesState } from '@ant-design/pro-flow';
import type { Node, Edge, NodeProps } from '@ant-design/pro-flow';
import { ReactFlowProvider, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { traceDocumentChain, type DocumentTraceData, type TraceNode } from '../../apps/kuaizhizao/services/document-relation';

/**
 * 单据类型显示名称映射
 */
const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  demand: '需求',
  demand_computation: '需求计算',
  work_order: '工单',
  purchase_order: '采购单',
  sales_order: '销售订单',
  sales_forecast: '销售预测',
  sales_delivery: '销售出库',
  purchase_receipt: '采购入库',
  finished_goods_inspection: '成品检验',
  process_inspection: '过程检验',
  incoming_inspection: '来料检验',
  accounts_payable: '应付单',
  accounts_receivable: '应收单',
};

/**
 * 单据类型颜色映射
 */
const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  demand: '#1890ff',
  demand_computation: '#52c41a',
  work_order: '#fa8c16',
  purchase_order: '#722ed1',
  sales_order: '#eb2f96',
  sales_forecast: '#13c2c2',
  sales_delivery: '#f5222d',
  purchase_receipt: '#faad14',
  finished_goods_inspection: '#2f54eb',
  process_inspection: '#a0d911',
  incoming_inspection: '#fa541c',
  accounts_payable: '#595959',
  accounts_receivable: '#8c8c8c',
};

/**
 * 获取单据类型显示名称
 */
const getDocumentTypeName = (type: string): string => {
  return DOCUMENT_TYPE_NAMES[type] || type;
};

/**
 * 获取单据类型颜色
 */
const getDocumentTypeColor = (type: string): string => {
  return DOCUMENT_TYPE_COLORS[type] || '#1890ff';
};

/**
 * 单据节点组件
 */
const DocumentNode: React.FC<NodeProps> = ({ data }) => {
  const color = getDocumentTypeColor(data?.document_type || '');
  
  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#fff',
        border: `2px solid ${color}`,
        borderRadius: 8,
        minWidth: 180,
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ marginBottom: 8 }}>
        <Tag color={color} style={{ marginBottom: 4 }}>
          {getDocumentTypeName(data?.document_type || '')}
        </Tag>
      </div>
      <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: 14 }}>
        {data?.document_code || `ID: ${data?.document_id}`}
      </div>
      {data?.document_name && (
        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
          {data.document_name}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

/**
 * 根节点组件（当前单据）
 */
const RootNode: React.FC<NodeProps> = ({ data }) => {
  const color = getDocumentTypeColor(data?.document_type || '');
  
  return (
    <div
      style={{
        padding: '16px 20px',
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `3px solid ${color}`,
        borderRadius: 8,
        minWidth: 200,
        cursor: 'pointer',
        boxShadow: `0 4px 12px ${color}40`,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ marginBottom: 8 }}>
        <Tag color={color} style={{ marginBottom: 4, fontSize: 12 }}>
          当前单据
        </Tag>
        <Tag color={color}>
          {getDocumentTypeName(data?.document_type || '')}
        </Tag>
      </div>
      <div style={{ fontWeight: 'bold', marginBottom: 4, fontSize: 16 }}>
        {data?.document_code || `ID: ${data?.document_id}`}
      </div>
      {data?.document_name && (
        <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>
          {data.document_name}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

/**
 * 单据关联关系图形化展示组件Props
 */
export interface DocumentRelationGraphProps {
  /** 单据类型 */
  documentType: string;
  /** 单据ID */
  documentId: number;
  /** 追溯方向 */
  direction?: 'upstream' | 'downstream' | 'both';
  /** 最大追溯深度 */
  maxDepth?: number;
  /** 点击关联单据时的回调 */
  onDocumentClick?: (documentType: string, documentId: number) => void;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 标题 */
  title?: string;
}

/**
 * 单据关联关系图形化展示组件
 */
const DocumentRelationGraph: React.FC<DocumentRelationGraphProps> = ({
  documentType,
  documentId,
  direction = 'both',
  maxDepth = 10,
  onDocumentClick,
  style,
  title = '单据关联关系可视化',
}) => {
  const [loading, setLoading] = useState(false);
  const [traceData, setTraceData] = useState<DocumentTraceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /**
   * 加载追溯数据
   */
  const loadTraceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await traceDocumentChain(documentType, documentId, direction, maxDepth);
      setTraceData(data);
    } catch (err: any) {
      setError(err.message || '加载追溯数据失败');
      setTraceData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTraceData();
  }, [documentType, documentId, direction, maxDepth]);

  /**
   * 将追溯节点转换为Flow节点
   */
  const convertTraceNodeToFlowNode = (
    node: TraceNode,
    parentId: string | null,
    x: number,
    y: number,
    level: number,
    isUpstream: boolean
  ): { nodes: Node[]; edges: Edge[]; nextX: number; nextY: number } => {
    const nodeId = `${node.document_type}-${node.document_id}-${level}`;
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // 创建当前节点
    nodes.push({
      id: nodeId,
      type: 'document',
      position: { x, y },
      data: {
        document_type: node.document_type,
        document_id: node.document_id,
        document_code: node.document_code,
        document_name: node.document_name,
        level,
      },
    });

    // 如果有父节点，创建边
    if (parentId) {
      edges.push({
        id: `${parentId}-${nodeId}`,
        source: isUpstream ? nodeId : parentId,
        target: isUpstream ? parentId : nodeId,
        type: 'smoothstep',
        animated: true,
      });
    }

    // 递归处理子节点
    let nextX = x;
    let nextY = y;
    const childCount = node.children.length;
    const spacing = layout === 'horizontal' ? 250 : 150;

    node.children.forEach((child, index) => {
      if (layout === 'horizontal') {
        nextY = y + spacing * (index + 1 - childCount / 2);
      } else {
        nextX = x + spacing * (index + 1 - childCount / 2);
        nextY = y + 200;
      }

      const childResult = convertTraceNodeToFlowNode(
        child,
        nodeId,
        nextX,
        nextY,
        level + 1,
        isUpstream
      );
      nodes.push(...childResult.nodes);
      edges.push(...childResult.edges);
    });

    return { nodes, edges, nextX, nextY };
  };

  /**
   * 构建Flow图数据
   */
  useEffect(() => {
    if (!traceData) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const allNodes: Node[] = [];
    const allEdges: Edge[] = [];

    // 创建根节点（当前单据）
    const rootNodeId = `root-${traceData.document_type}-${traceData.document_id}`;
    allNodes.push({
      id: rootNodeId,
      type: 'root',
      position: { x: layout === 'horizontal' ? 400 : 500, y: layout === 'horizontal' ? 300 : 200 },
      data: {
        document_type: traceData.document_type,
        document_id: traceData.document_id,
        document_code: traceData.document_code,
        document_name: traceData.document_name,
        level: 0,
      },
    });

    // 处理上游节点
    if (traceData.upstream_chain.length > 0) {
      let upstreamX = layout === 'horizontal' ? 100 : 200;
      let upstreamY = layout === 'horizontal' ? 300 : 50;

      traceData.upstream_chain.forEach((node, index) => {
        const result = convertTraceNodeToFlowNode(
          node,
          rootNodeId,
          upstreamX,
          upstreamY + (layout === 'horizontal' ? 0 : index * 300),
          1,
          true
        );
        allNodes.push(...result.nodes);
        allEdges.push(...result.edges);
        upstreamX -= 200;
      });
    }

    // 处理下游节点
    if (traceData.downstream_chain.length > 0) {
      let downstreamX = layout === 'horizontal' ? 700 : 800;
      let downstreamY = layout === 'horizontal' ? 300 : 350;

      traceData.downstream_chain.forEach((node, index) => {
        const result = convertTraceNodeToFlowNode(
          node,
          rootNodeId,
          downstreamX,
          downstreamY + (layout === 'horizontal' ? 0 : index * 300),
          1,
          false
        );
        allNodes.push(...result.nodes);
        allEdges.push(...result.edges);
        downstreamX += 200;
      });
    }

    setNodes(allNodes);
    setEdges(allEdges);
  }, [traceData, layout, setNodes, setEdges]);

  const nodeTypes = useMemo(
    () => ({
      document: DocumentNode,
      root: RootNode,
    }),
    []
  );

  return (
    <Card
      title={
        <Space>
          <span>{title}</span>
          <Radio.Group
            value={layout}
            onChange={(e) => setLayout(e.target.value)}
            size="small"
          >
            <Radio.Button value="horizontal">
              <ExpandOutlined /> 水平布局
            </Radio.Button>
            <Radio.Button value="vertical">
              <CompressOutlined /> 垂直布局
            </Radio.Button>
          </Radio.Group>
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={loadTraceData}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      }
      style={style}
    >
      {loading && <Spin style={{ display: 'block', textAlign: 'center', padding: '20px' }} />}

      {error && (
        <div style={{ color: '#ff4d4f', textAlign: 'center', padding: '20px' }}>
          {error}
        </div>
      )}

      {!loading && !error && traceData && (
        <div style={{ width: '100%', height: '600px', position: 'relative' }}>
          {nodes.length > 0 ? (
            <ReactFlowProvider>
              <FlowStoreProvider>
                <FlowView
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={(event, node) => {
                    setSelectedNode(node);
                    if (onDocumentClick && node.data?.document_type && node.data?.document_id) {
                      onDocumentClick(node.data.document_type, node.data.document_id);
                    }
                  }}
                  nodeTypes={nodeTypes}
                  fitView
                />
              </FlowStoreProvider>
            </ReactFlowProvider>
          ) : (
            <Empty description="暂无关联单据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      )}

      {/* 节点详情Drawer */}
      <Drawer
        title="单据详情"
        open={!!selectedNode}
        onClose={() => setSelectedNode(null)}
        width={400}
      >
        {selectedNode && (
          <div>
            <p>
              <strong>单据类型：</strong>
              <Tag color={getDocumentTypeColor(selectedNode.data?.document_type || '')}>
                {getDocumentTypeName(selectedNode.data?.document_type || '')}
              </Tag>
            </p>
            <p>
              <strong>单据编码：</strong>
              {selectedNode.data?.document_code || `ID: ${selectedNode.data?.document_id}`}
            </p>
            {selectedNode.data?.document_name && (
              <p>
                <strong>单据名称：</strong>
                {selectedNode.data.document_name}
              </p>
            )}
            <p>
              <strong>层级：</strong>
              {selectedNode.data?.level || 0}
            </p>
          </div>
        )}
      </Drawer>
    </Card>
  );
};

export default DocumentRelationGraph;
