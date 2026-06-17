/**
 * 审批流设计器页面
 * 
 * 修改记录：
 * - 修正 CanvasPageTemplate 用法。
 * - 修复翻译 Key。
 * - 修正状态管理：避免在 Render 中直接访问 Ref。
 * - 统一 UniFlowNode 设计语言。
 * - 修复类型错误与 Lint。
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProForm, ProFormText } from '@ant-design/pro-components';
import { App, Button, Form, Space, theme, Typography } from 'antd';
import { 
  SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNodesState, useEdgesState } from '@ant-design/pro-flow';
import type { Node, Edge } from '@ant-design/pro-flow';
import {
  ReactFlowProvider,
  ReactFlow,
  Background,
  BackgroundVariant,
  addEdge,
  Connection,
} from 'reactflow';
// @ts-ignore
import 'reactflow/dist/style.css';
import {
  getApprovalProcessByUuid,
  updateApprovalProcess,
  publishApprovalProcess,
  getConditionFields,
  ApprovalProcess,
} from '../../../../services/approvalProcess';
import { CanvasPageTemplate } from '../../../../components/layout-templates/CanvasPageTemplate';
import UniFlowNode from '../../../../components/common/uni-flow-node';
import { CANVAS_GRID_REACTFLOW } from '../../../../components/layout-templates/constants';
import {
  normalizeFlowGraph,
  normalizeNodeData,
  nodeDataToFormValues,
  validateFlowGraph,
} from '../../../../types/approvalFlowSchema';
import {
  ApprovalNodeForm,
  CcNodeForm,
  ConditionNodeForm,
  mergeFormToNodeData,
} from './properties/NodePropertyForms';

const { useToken } = theme;

/** 垂直布局常量 */
const LAYOUT_CENTER_X = 280;
const LAYOUT_BASE_Y = 60;
const LAYOUT_GAP = 120;
const LAYOUT_BRANCH_GAP = 48;
const BRANCH_COLUMN_WIDTH = 200;

const NODE_WIDTH_BY_TYPE: Record<string, number> = {
  start: 100,
  end: 100,
  approval: 200,
  cc: 200,
  condition: 160,
};

function getNodeLayoutWidth(node: Node): number {
  return NODE_WIDTH_BY_TYPE[node.type as string] ?? 200;
}

function getSubtreeFrom(nodeId: string, edges: Edge[]): Set<string> {
  const out = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    edges.filter((e) => e.source === curr).forEach((e) => {
      if (!out.has(e.target)) {
        out.add(e.target);
        queue.push(e.target);
      }
    });
  }
  return out;
}

function getConditionIds(edges: Edge[]): Set<string> {
  const outCount: Record<string, number> = {};
  edges.forEach((e) => { outCount[e.source] = (outCount[e.source] || 0) + 1; });
  const ids = new Set<string>();
  Object.keys(outCount).forEach((id) => { if (outCount[id] > 1) ids.add(id); });
  return ids;
}

function getLayersAndBranches(edges: Edge[]): { layers: string[][]; branchIndex: Map<string, number> } {
  const conditionIds = getConditionIds(edges);
  const branchIndex = new Map<string, number>();
  branchIndex.set('start', 0);
  const layers: string[][] = [['start']];
  const seen = new Set<string>(['start']);
  let i = 0;
  while (i < layers.length) {
    const curr = layers[i];
    const nextIds: string[] = [];
    for (const src of curr) {
      if (src === 'end') continue;
      const outEdges = edges.filter((e) => e.source === src);
      outEdges.forEach((e, edgeIdx) => {
        const t = e.target;
        if (!seen.has(t)) {
          seen.add(t);
          nextIds.push(t);
          if (conditionIds.has(src)) branchIndex.set(t, edgeIdx);
          else branchIndex.set(t, branchIndex.get(src) || 0);
        }
      });
    }
    if (nextIds.length > 0) layers.push(nextIds);
    i++;
  }
  return { layers, branchIndex };
}

function applyVerticalLayout(nodes: Node[], edges: Edge[]): Node[] {
  const { layers, branchIndex } = getLayersAndBranches(edges);
  const conditionIds = getConditionIds(edges);
  const allIds = new Set(nodes.map((n) => n.id));
  const inLayers = new Set(layers.flat());
  const missing = [...allIds].filter((id) => !inLayers.has(id));
  if (missing.length > 0) {
    const endLayerIndex = layers.findIndex((arr) => arr.includes('end'));
    if (endLayerIndex >= 0) layers.splice(endLayerIndex, 0, missing);
    else layers.push(missing);
    missing.forEach((id) => branchIndex.set(id, 0));
  }
  const idToLayer = new Map<string, number>();
  layers.forEach((layer, layerIdx) => { layer.forEach((id) => idToLayer.set(id, layerIdx)); });
  const maxBranch = branchIndex.size > 0 ? Math.max(...Array.from(branchIndex.values())) : 0;
  const numBranches = Math.max(1, maxBranch + 1);
  const totalBranchWidth = numBranches * BRANCH_COLUMN_WIDTH + (numBranches - 1) * LAYOUT_BRANCH_GAP;
  const branchCenterX = (b: number) => LAYOUT_CENTER_X - totalBranchWidth / 2 + b * (BRANCH_COLUMN_WIDTH + LAYOUT_BRANCH_GAP) + BRANCH_COLUMN_WIDTH / 2;
  const inAnyConditionSubtree = new Set<string>();
  conditionIds.forEach((cid) => { getSubtreeFrom(cid, edges).forEach((id) => inAnyConditionSubtree.add(id)); });
  return nodes.map((node) => {
    const layerIndex = idToLayer.get(node.id) ?? layers.length;
    const y = LAYOUT_BASE_Y + layerIndex * LAYOUT_GAP;
    const w = getNodeLayoutWidth(node);
    const onAxis = node.id === 'start' || node.id === 'end' || conditionIds.has(node.id) || !inAnyConditionSubtree.has(node.id);
    const x = onAxis ? LAYOUT_CENTER_X - w / 2 : branchCenterX(branchIndex.get(node.id) ?? 0) - w / 2;
    return { ...node, position: { x, y } };
  });
}

const ApprovalProcessDesignerPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processUuid = searchParams.get('uuid');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processData, setProcessData] = useState<ApprovalProcess | null>(null);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [nodeDataMap, setNodeDataMap] = useState<Record<string, any>>({});

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeConfigForm] = Form.useForm();
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [conditionFieldOptions, setConditionFieldOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    const code = processData?.code;
    if (!code) return;
    getConditionFields(code)
      .then((res) => {
        setConditionFieldOptions(
          (res.fields || []).map((f) => ({ label: f.label || f.field, value: f.field })),
        );
      })
      .catch(() => setConditionFieldOptions([]));
  }, [processData?.code]);

  const loadProcessData = useCallback(async () => {
    if (!processUuid) return;
    try {
      setLoading(true);
      const data = await getApprovalProcessByUuid(processUuid);
      setProcessData(data);
      let nodesData: Node[] = [];
      let edgesData: Edge[] = [];
      const graphSource = (data as ApprovalProcess & { draft_nodes?: { nodes?: Node[]; edges?: Edge[] } }).draft_nodes
        && (data as ApprovalProcess & { draft_nodes?: { nodes?: Node[] } }).draft_nodes?.nodes?.length
        ? (data as ApprovalProcess & { draft_nodes: { nodes: Node[]; edges?: Edge[] } }).draft_nodes
        : data.nodes;
      if (graphSource && typeof graphSource === 'object') {
        nodesData = (graphSource as any).nodes ?? [];
        edgesData = (graphSource as any).edges ?? [];
      }
      if (nodesData.length === 0) {
        nodesData = [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: t('pages.approval.designer.start') } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: t('pages.approval.designer.end') } },
        ];
        edgesData = [{ id: 'e-start-end', source: 'start', target: 'end', type: 'smoothstep' }];
      }
      
      const initialDataMap: Record<string, any> = {};
      nodesData.forEach(node => {
        const normalized = normalizeNodeData(String(node.type), { ...(node.data as object) });
        initialDataMap[node.id] = nodeDataToFormValues(normalized);
      });
      setNodeDataMap(initialDataMap);

      const normalizedEdges = edgesData.map((e, i) => ({ ...e, id: e.id || `e-${e.source}-${e.target}-${i}`, type: 'default' }));
      setNodes(applyVerticalLayout(nodesData, normalizedEdges) as any);
      setEdges(normalizedEdges);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.approval.designer.loadFailed'));
      navigate('/system/approval-processes');
    } finally {
      setLoading(false);
    }
  }, [processUuid, messageApi, navigate, t, setNodes, setEdges]);

  useEffect(() => {
    const init = async () => {
      if (processUuid) {
        await loadProcessData();
      }
    };
    init();
  }, [processUuid, loadProcessData]);

  const addNextNodeFromNode = useCallback((sourceNodeId: string, type: 'approval' | 'cc' | 'condition') => {
    const newId = `${type}_${Math.random().toString(36).substr(2, 9)}`;
    const label = t(`pages.approval.designer.${type}Node`);
    const newNode: Node = { id: newId, type, position: { x: 0, y: 0 }, data: { label } };
    const outEdges = edges.filter((e) => e.source === sourceNodeId);
    let newEdges = edges.filter((e) => e.source !== sourceNodeId);
    newEdges.push({ id: `e-${sourceNodeId}-${newId}`, source: sourceNodeId, target: newId, type: 'default' });
    outEdges.forEach((e, i) => { newEdges.push({ id: `e-${newId}-${e.target}-${i}`, source: newId, target: e.target, type: 'default' }); });
    
    setNodeDataMap(prev => ({ ...prev, [newId]: { label } }));
    const newNodes = [...nodes, newNode];
    setNodes(applyVerticalLayout(newNodes as any, newEdges) as any);
    setEdges(newEdges);
  }, [nodes, edges, setNodes, setEdges, t]);

  const addBranchFromConditionNode = useCallback((type: 'approval' | 'cc' | 'condition') => {
    if (!selectedNode || selectedNode.type !== 'condition') return;
    const sourceNodeId = selectedNode.id;
    const newId = `${type}_${Math.random().toString(36).substr(2, 9)}`;
    const label = t(`pages.approval.designer.${type}Node`);
    const newNode: Node = { id: newId, type, position: { x: 0, y: 0 }, data: { label } };
    const newEdges = [...edges, { id: `e-${sourceNodeId}-${newId}`, source: sourceNodeId, target: newId, type: 'default' }, { id: `e-${newId}-end`, source: newId, target: 'end', type: 'default' }];
    
    setNodeDataMap(prev => ({ ...prev, [newId]: { label } }));
    const newNodes = [...nodes, newNode];
    setNodes(applyVerticalLayout(newNodes as any, newEdges) as any);
    setEdges(newEdges);
  }, [selectedNode, nodes, edges, setNodes, setEdges, t]);

  const addNodeOnEdge = useCallback((type: 'approval' | 'cc' | 'condition') => {
    if (!selectedEdge) return;
    const edge = selectedEdge;
    const newId = `${type}_${Math.random().toString(36).substr(2, 9)}`;
    const label = t(`pages.approval.designer.${type}Node`);
    const newNode: Node = { id: newId, type, position: { x: 0, y: 0 }, data: { label } };
    const newEdges = edges.filter((e) => e.id !== edge.id).concat([
      { id: `e-${edge.source}-${newId}`, source: edge.source, target: newId, type: 'default' },
      { id: `e-${newId}-${edge.target}`, source: newId, target: edge.target, type: 'default' },
    ]);
    
    setNodeDataMap(prev => ({ ...prev, [newId]: { label } }));
    const newNodes = [...nodes, newNode];
    setNodes(applyVerticalLayout(newNodes as any, newEdges) as any);
    setEdges(newEdges);
    setSelectedEdge(null);
  }, [selectedEdge, nodes, edges, setNodes, setEdges, t]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ ...params, type: 'default' }, eds));
  }, [setEdges]);

  const handleSave = async () => {
    if (!processUuid || !processData) return;
    try {
      setSaving(true);
      const strippedNodes = nodes.map((node) => {
        const merged = mergeFormToNodeData(String(node.type), {
          ...node.data,
          ...nodeDataMap[node.id],
        });
        const data = normalizeNodeData(String(node.type), merged);
        return {
          id: node.id,
          type: node.type,
          position: node.position,
          data,
        };
      });
      const graph = normalizeFlowGraph({ nodes: strippedNodes, edges });
      const validationErrors = validateFlowGraph(graph);
      if (validationErrors.length > 0) {
        messageApi.error(validationErrors.join('；'));
        return;
      }
      await updateApprovalProcess(processUuid, { ...processData, nodes: graph });
      const refreshed = await getApprovalProcessByUuid(processUuid);
      setProcessData(refreshed);
      messageApi.success(t('pages.approval.designer.saveSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('pages.approval.designer.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleOrganizeNodes = useCallback(() => {
    setNodes((nds) => applyVerticalLayout(nds as Node[], edges) as any);
  }, [edges, setNodes]);

  const nodeTypes = useMemo(() => ({
    start: (p: any) => <UniFlowNode {...p} type="start" selected={p.selected} />,
    end: (p: any) => <UniFlowNode {...p} type="end" selected={p.selected} />,
    approval: (p: any) => <UniFlowNode {...p} type="approval" selected={p.selected} />,
    cc: (p: any) => <UniFlowNode {...p} type="cc" selected={p.selected} />,
    condition: (p: any) => <UniFlowNode {...p} type="condition" selected={p.selected} />,
  }), []);

  const toolbar = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Space>
        <span style={{ color: token.colorTextSecondary, fontSize: 13, marginRight: 8 }}>
          {t('pages.approval.designer.selectedNode')}: <Typography.Text strong>{selectedNode ? (nodeDataMap[selectedNode.id]?.label || selectedNode.id) : t('pages.approval.designer.noneSelected')}</Typography.Text>
        </span>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          disabled={!selectedNode || selectedNode.id === 'end'}
          onClick={() => selectedNode && addNextNodeFromNode(selectedNode.id, 'approval')}
        >
          {t('pages.approval.designer.addApproval')}
        </Button>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          disabled={!selectedNode || selectedNode.id === 'end'}
          onClick={() => selectedNode && addNextNodeFromNode(selectedNode.id, 'cc')}
        >
          {t('pages.approval.designer.addCC')}
        </Button>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          disabled={!selectedNode || selectedNode.id === 'end'}
          onClick={() => selectedNode && addNextNodeFromNode(selectedNode.id, 'condition')}
        >
          {t('pages.approval.designer.addCondition')}
        </Button>
        <Button 
          type="primary" 
          ghost 
          disabled={!selectedNode || selectedNode.type !== 'condition'}
          onClick={() => addBranchFromConditionNode('approval')}
        >
          {t('pages.approval.designer.addBranch')}
        </Button>
        <Button 
          danger 
          icon={<DeleteOutlined />} 
          disabled={!selectedNode || selectedNode.id === 'start' || selectedNode.id === 'end'}
          onClick={() => { 
            if (!selectedNode) return;
            const newDataMap = { ...nodeDataMap };
            delete newDataMap[selectedNode.id];
            setNodeDataMap(newDataMap);
            setNodes(nodes.filter((n) => n.id !== selectedNode.id)); 
            setEdges(edges.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)); 
            setSelectedNode(null); 
          }}
        >
          {t('common.delete')}
        </Button>
        <Button
          icon={<ReloadOutlined />}
          disabled={nodes.length === 0}
          onClick={handleOrganizeNodes}
        >
          {t('pages.approval.designer.organizeNodes')}
        </Button>
        {selectedEdge && (
          <Space>
            <Button onClick={() => addNodeOnEdge('approval')}>{t('pages.approval.designer.addApproval')}</Button>
            <Button onClick={() => addNodeOnEdge('cc')}>{t('pages.approval.designer.addCC')}</Button>
            <Button onClick={() => addNodeOnEdge('condition')}>{t('pages.approval.designer.addCondition')}</Button>
            <Button danger icon={<DeleteOutlined />} onClick={() => { setEdges(edges.filter(e => e.id !== selectedEdge.id)); setSelectedEdge(null); }}>{t('pages.approval.designer.deleteEdge')}</Button>
          </Space>
        )}
      </Space>
      <Space>
        {processData?.draft_nodes && (
          <Button
            onClick={async () => {
              if (!processUuid) return;
              try {
                setSaving(true);
                await publishApprovalProcess(processUuid);
                await loadProcessData();
                messageApi.success(t('pages.approval.designer.publishSuccess'));
              } catch (e: any) {
                messageApi.error(e.message || t('pages.approval.designer.publishFailed'));
              } finally {
                setSaving(false);
              }
            }}
          >
            {t('pages.approval.designer.publishDraft')}
          </Button>
        )}
        <Button icon={<CloseOutlined />} onClick={() => navigate('/system/approval-processes')}>{t('common.close')}</Button>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>{t('common.save')}</Button>
      </Space>
    </div>
  );

  const canvas = (
    <div style={{ width: '100%', height: '100%', ...CANVAS_GRID_REACTFLOW.style }}>
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: selectedNode?.id === n.id, data: { ...n.data, ...nodeDataMap[n.id] } })) as any}
        edges={edges.map((e) => ({ ...e, style: { ...e.style, stroke: selectedEdge?.id === e.id ? token.colorPrimary : '#475569', strokeWidth: selectedEdge?.id === e.id ? 3 : 2 } }))}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          setSelectedNode(node); setSelectedEdge(null);
          const raw = nodeDataMap[node.id] || node.data || {};
          const formValues = nodeDataToFormValues(normalizeNodeData(String(node.type), raw));
          nodeConfigForm.setFieldsValue({ label: formValues.label || node.id, ...formValues });
        }}
        onEdgeClick={(_, edge) => { setSelectedEdge(edge); setSelectedNode(null); }}
        onPaneClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.0 }}
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

  const conditionBranchCount = selectedNode?.type === 'condition'
    ? edges.filter((e) => e.source === selectedNode.id).length
    : 0;

  const rightPanel = selectedNode && (selectedNode.type === 'approval' || selectedNode.type === 'cc' || selectedNode.type === 'condition') ? {
    title: t('pages.approval.designer.nodeConfig'),
    children: (
      <ProForm form={nodeConfigForm} submitter={false} onValuesChange={(_, values) => {
        if (selectedNode) {
          const merged = mergeFormToNodeData(String(selectedNode.type), values as Record<string, unknown>);
          setNodeDataMap(prev => ({ ...prev, [selectedNode.id]: { ...prev[selectedNode.id], ...merged } }));
          setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, ...merged } } : n));
        }
      }}>
        <ProFormText name="label" label={t('pages.approval.designer.nodeLabel')} rules={[{ required: true }]} />
        {selectedNode.type === 'approval' && <ApprovalNodeForm />}
        {selectedNode.type === 'cc' && <CcNodeForm />}
        {selectedNode.type === 'condition' && (
          <ConditionNodeForm branchCount={conditionBranchCount} fieldOptions={conditionFieldOptions} />
        )}
      </ProForm>
    )
  } : undefined;

  if (loading) return <CanvasPageTemplate toolbar={null} canvas={<div style={{ height: 600 }} />} functionalTitle={t('pages.approval.designer.title')} />;

  return (
    <CanvasPageTemplate
      functionalTitle={`${t('pages.approval.designer.title')}: ${processData?.name || ''}`}
      toolbar={toolbar}
      canvas={canvas}
      rightPanel={rightPanel}
    />
  );
};

const ApprovalProcessDesignerPageWrapper: React.FC = () => (
  <ReactFlowProvider>
    <App>
      <ApprovalProcessDesignerPage />
    </App>
  </ReactFlowProvider>
);

export default ApprovalProcessDesignerPageWrapper;
