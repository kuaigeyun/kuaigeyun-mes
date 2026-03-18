/**
 * 审批流设计器页面
 *
 * 与 SOP 设计画板对齐：居中对齐布局、从选中节点新增节点并自动连线、
 * 画布暗黑模式、删除连线、右侧面板添加节点入口等。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProForm, ProFormText, ProFormSelect, ProFormList, ProFormGroup, ProFormDependency } from '@ant-design/pro-components';
import { App, Button, Tag, Form, Space, Divider, Card, theme } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined, UserOutlined, TeamOutlined, ControlOutlined, SendOutlined, ForkOutlined } from '@ant-design/icons';
import { getUserList } from '../../../../services/user';
import { getRoleList } from '../../../../services/role';
import { useNodesState, useEdgesState } from '@ant-design/pro-flow';
import type { Node, Edge, NodeProps } from '@ant-design/pro-flow';
import {
  ReactFlowProvider,
  ReactFlow,
  Handle,
  Position,
  addEdge,
  BezierEdge,
  Background,
  BackgroundVariant,
} from 'reactflow';
import type { Connection } from 'reactflow';
// @ts-ignore
import 'reactflow/dist/style.css';
import {
  getApprovalProcessByUuid,
  updateApprovalProcess,
  ApprovalProcess,
} from '../../../../services/approvalProcess';
import { CanvasPageTemplate } from '../../../../components/layout-templates';

const { useToken } = theme;

/** 垂直布局常量：与 SOP 设计器一致，居中对齐 */
const LAYOUT_CENTER_X = 280;
const LAYOUT_BASE_Y = 60;
const LAYOUT_GAP = 100;
/** 同一层多分支节点之间的水平间距 */
const LAYOUT_BRANCH_GAP = 48;
/** 各类型节点宽度（与组件 minWidth 一致），用于居中对齐 */
const NODE_WIDTH_BY_TYPE: Record<string, number> = {
  start: 100,
  end: 100,
  approval: 180,
  cc: 180,
  condition: 140,
};
function getNodeLayoutWidth(node: Node): number {
  return NODE_WIDTH_BY_TYPE[node.type as string] ?? 180;
}

/** 根据边关系得到节点垂直顺序：start -> 中间节点... -> end（与 SOP getVerticalOrder 一致） */
function getVerticalOrder(edges: Edge[]): string[] {
  const order: string[] = ['start'];
  const visited = new Set<string>(['start']);
  while (true) {
    const last = order[order.length - 1];
    if (last === 'end') break;
    const out = edges.filter((e) => e.source === last).map((e) => e.target);
    const next = out.find((t) => !visited.has(t));
    if (next == null) break;
    order.push(next);
    visited.add(next);
  }
  if (order[order.length - 1] !== 'end') order.push('end');
  return order;
}

/**
 * 多出边的节点视为条件节点（用于分支列计算）
 */
function getConditionIds(edges: Edge[]): Set<string> {
  const outCount: Record<string, number> = {};
  edges.forEach((e) => { outCount[e.source] = (outCount[e.source] || 0) + 1; });
  const ids = new Set<string>();
  Object.keys(outCount).forEach((id) => { if (outCount[id] > 1) ids.add(id); });
  return ids;
}

/**
 * 按边关系做 BFS 分层，并计算每个节点所属分支列 branchIndex（同一条件分支链共享同一列，便于垂直对齐）
 */
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
          const parentBranch = branchIndex.get(src) ?? 0;
          branchIndex.set(t, conditionIds.has(src) ? edgeIdx : parentBranch);
        }
      });
    }
    if (nextIds.length > 0) {
      layers.push(nextIds);
      i++;
    } else {
      break;
    }
  }
  if (layers[layers.length - 1]?.indexOf('end') === -1) {
    const allTargets = new Set(edges.map((e) => e.target));
    if (allTargets.has('end')) {
      layers.push(['end']);
      branchIndex.set('end', 0);
    }
  }
  const last = layers[layers.length - 1];
  if (last && last.length > 1 && last.includes('end')) {
    layers[layers.length - 1] = last.filter((id) => id !== 'end');
    layers.push(['end']);
    branchIndex.set('end', 0);
  }
  return { layers, branchIndex };
}

/** 默认分支列宽（用于计算分支中心 X） */
const BRANCH_COLUMN_WIDTH = 180;

/** 从某节点出发 BFS 得到所有后继节点（不含 end），用于条件子树 */
function getSubtreeFrom(nodeId: string, edges: Edge[]): Set<string> {
  const out = new Set<string>([nodeId]);
  let queue = [nodeId];
  while (queue.length) {
    const src = queue.shift()!;
    edges.filter((e) => e.source === src && e.target !== 'end').forEach((e) => {
      if (!out.has(e.target)) {
        out.add(e.target);
        queue.push(e.target);
      }
    });
  }
  return out;
}

/**
 * 整条流程沿竖向中轴线：start、end、条件节点、主干节点（条件前的节点）均在中轴；
 * 分支在轴线两侧对称展开（奇数分支时中间一列即中轴）。
 */
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
  layers.forEach((layer, layerIndex) => {
    layer.forEach((id) => idToLayer.set(id, layerIndex));
  });
  const maxBranch = branchIndex.size > 0 ? Math.max(...Array.from(branchIndex.values())) : 0;
  const numBranches = Math.max(1, maxBranch + 1);
  const totalBranchWidth = numBranches * BRANCH_COLUMN_WIDTH + (numBranches - 1) * LAYOUT_BRANCH_GAP;
  const branchCenterX = (b: number) =>
    LAYOUT_CENTER_X - totalBranchWidth / 2 + b * (BRANCH_COLUMN_WIDTH + LAYOUT_BRANCH_GAP) + BRANCH_COLUMN_WIDTH / 2;

  const inAnyConditionSubtree = new Set<string>();
  conditionIds.forEach((cid) => {
    getSubtreeFrom(cid, edges).forEach((id) => inAnyConditionSubtree.add(id));
  });

  const result = nodes.map((node) => {
    const layerIndex = idToLayer.get(node.id) ?? layers.length;
    const y = LAYOUT_BASE_Y + layerIndex * LAYOUT_GAP;
    const w = getNodeLayoutWidth(node);
    const onAxis =
      node.id === 'start' ||
      node.id === 'end' ||
      conditionIds.has(node.id) ||
      !inAnyConditionSubtree.has(node.id);
    const x = onAxis
      ? LAYOUT_CENTER_X - w / 2
      : branchCenterX(branchIndex.get(node.id) ?? 0) - w / 2;
    return { ...node, position: { x, y }, data: { ...node.data, layoutDirection: 'vertical' as const } };
  });

  return result;
}

type DesignerToken = {
  colorBgContainer: string;
  colorText: string;
  colorTextSecondary: string;
  colorBorder: string;
  colorBorderSecondary?: string;
  colorPrimary: string;
  colorSuccess: string;
  colorError: string;
  colorWarning: string;
};
const DesignerThemeContext = React.createContext<DesignerToken | null>(null);

/** 选中节点光晕（与 SOP 一致） */
const GLOW_STYLE = {
  approval: '0 0 0 2px #fff, 0 0 16px 6px #1890ff',
  cc: '0 0 0 2px #fff, 0 0 16px 6px #722ed1',
  condition: '0 0 0 2px #fff, 0 0 16px 6px #faad14',
} as const;

/**
 * 审批节点组件（适配暗黑模式）
 */
const ApprovalNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const token = React.useContext(DesignerThemeContext);
  const selected = (data as { selected?: boolean })?.selected;
  const isHorizontal = data?.layoutDirection === 'horizontal';
  const approvalType = data?.approvalType || 'OR';
  const bg = token?.colorBgContainer ?? '#fff';
  const border = token?.colorPrimary ?? '#1890ff';
  const text = token?.colorText ?? '#000';
  const textSec = token?.colorTextSecondary ?? '#666';
  return (
    <div
      style={{
        padding: '10px 14px',
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 8,
        minWidth: 180,
        cursor: 'pointer',
        boxShadow: selected ? GLOW_STYLE.approval : undefined,
      }}
    >
      <Handle type="target" position={isHorizontal ? Position.Left : Position.Top} style={{ background: border }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, borderBottom: `1px solid ${token?.colorBorder ?? '#d9d9d9'}`, paddingBottom: 6 }}>
        <span style={{ fontWeight: '600', fontSize: 14, color: text }}>{data?.label || t('pages.approval.designer.label')}</span>
        <Tag color={approvalType === 'AND' ? 'orange' : 'blue'} style={{ marginRight: 0, fontSize: '10px', zoom: 0.85 }}>
          {approvalType === 'AND' ? t('pages.approval.designer.andSign') : t('pages.approval.designer.orSign')}
        </Tag>
      </div>
      <div style={{ fontSize: 12, color: textSec }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {data?.approverType === 'user' ? <UserOutlined style={{ fontSize: 12 }} /> : <TeamOutlined style={{ fontSize: 12 }} />}
          <span>{
            data?.approverType === 'user' ? t('pages.approval.designer.approverTypeUser').split(' ')[0] :
            data?.approverType === 'role' ? t('pages.approval.designer.approverTypeRole').split(' ')[0] :
            data?.approverType === 'manager' ? t('pages.approval.designer.approverTypeManager').split(' ')[0] :
            data?.approverType === 'department' ? t('pages.approval.designer.approverTypeDept').split(' ')[0] : t('pages.approval.designer.approverTypeOptional').split(' ')[0]
          }</span>
        </div>
        {data?.conditions?.length > 0 && (
          <div style={{ marginTop: 4, padding: '2px 6px', background: token?.colorBorderSecondary ?? '#f5f5f5', borderRadius: 4, fontSize: 10, color: textSec }}>
            <ControlOutlined style={{ marginRight: 4 }} />
            {t('pages.approval.designer.hasConditions')}
          </div>
        )}
      </div>
      <Handle type="source" position={isHorizontal ? Position.Right : Position.Bottom} style={{ background: border }} />
    </div>
  );
};

/**
 * 抄送节点组件（适配暗黑模式）
 */
const CCNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const token = React.useContext(DesignerThemeContext);
  const selected = (data as { selected?: boolean })?.selected;
  const isHorizontal = data?.layoutDirection === 'horizontal';
  const bg = token?.colorBgContainer ?? '#fff';
  const purple = '#722ed1';
  const text = token?.colorText ?? '#000';
  const textSec = token?.colorTextSecondary ?? '#666';
  return (
    <div
      style={{
        padding: '10px 14px',
        background: bg,
        border: '2px solid #722ed1',
        borderRadius: 8,
        minWidth: 180,
        cursor: 'pointer',
        boxShadow: selected ? GLOW_STYLE.cc : undefined,
      }}
    >
      <Handle type="target" position={isHorizontal ? Position.Left : Position.Top} style={{ background: purple }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, borderBottom: `1px solid ${token?.colorBorder ?? '#d9d9d9'}`, paddingBottom: 6 }}>
        <span style={{ fontWeight: '600', fontSize: 14, color: purple }}>
          <SendOutlined style={{ marginRight: 6 }} />
          {data?.label || t('pages.approval.designer.ccNode')}
        </span>
      </div>
      <div style={{ fontSize: 12, color: textSec }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{(data?.approverIds?.length || 0) + ' ' + t('pages.approval.designer.ccRecipients')}</span>
        </div>
      </div>
      <Handle type="source" position={isHorizontal ? Position.Right : Position.Bottom} style={{ background: purple }} />
    </div>
  );
};

/**
 * 条件节点组件（适配暗黑模式）
 */
const ConditionNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const token = React.useContext(DesignerThemeContext);
  const selected = (data as { selected?: boolean })?.selected;
  const isHorizontal = data?.layoutDirection === 'horizontal';
  const bg = token?.colorBgContainer ?? '#fff';
  const warn = token?.colorWarning ?? '#faad14';
  const textSec = token?.colorTextSecondary ?? '#666';
  return (
    <div
      style={{
        padding: '8px 12px',
        background: bg,
        border: `2px dashed ${warn}`,
        borderRadius: 20,
        minWidth: 140,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: selected ? GLOW_STYLE.condition : undefined,
      }}
    >
      <Handle type="target" position={isHorizontal ? Position.Left : Position.Top} style={{ background: warn }} />
      <div style={{ color: warn, fontWeight: '500', fontSize: 13 }}>
        <ForkOutlined style={{ marginRight: 6 }} />
        {data?.label || t('pages.approval.designer.conditionNode')}
      </div>
      {data?.conditions?.length > 0 && (
        <div style={{ fontSize: 10, color: textSec, marginTop: 4 }}>
          {t('pages.approval.designer.conditionCount', { count: data.conditions.length })}
        </div>
      )}
      <Handle type="source" position={isHorizontal ? Position.Right : Position.Bottom} style={{ background: warn }} />
    </div>
  );
};

/**
 * 开始节点组件（适配暗黑模式，与 SOP 一致）
 */
const StartNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const token = React.useContext(DesignerThemeContext);
  const selected = (data as { selected?: boolean })?.selected;
  const bg = token?.colorSuccess ?? '#52c41a';
  return (
    <div
      style={{
        padding: '12px 16px',
        background: bg,
        color: '#fff',
        borderRadius: 8,
        minWidth: 100,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: selected ? '0 0 0 2px #fff, 0 0 16px 6px #52c41a' : undefined,
      }}
    >
      <Handle type="source" position={Position.Bottom} />
      {t('pages.approval.designer.start')}
    </div>
  );
};

/**
 * 结束节点组件（适配暗黑模式，与 SOP 一致）
 */
const EndNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const token = React.useContext(DesignerThemeContext);
  const selected = (data as { selected?: boolean })?.selected;
  const bg = token?.colorError ?? '#ff4d4f';
  return (
    <div
      style={{
        padding: '12px 16px',
        background: bg,
        color: '#fff',
        borderRadius: 8,
        minWidth: 100,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: selected ? '0 0 0 2px #fff, 0 0 16px 6px #ff4d4f' : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} />
      {t('pages.approval.designer.end')}
    </div>
  );
};

/**
 * 审批流设计器页面组件
 */
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

  // ProFlow 数据
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // 节点配置
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeConfigForm] = Form.useForm();
  /** 当前选中的连线（与 SOP 一致，可删除） */
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  useEffect(() => {
    if (processUuid) {
      loadProcessData();
    } else {
      messageApi.warning(t('pages.approval.designer.missingUuid'));
      navigate('/system/approval-processes');
    }
  }, [processUuid]);

  /**
   * 加载流程数据：与 SOP 一致，默认 start+end+一条边，并用 applyVerticalLayout 居中对齐
   */
  const loadProcessData = async () => {
    if (!processUuid) return;

    try {
      setLoading(true);
      const data = await getApprovalProcessByUuid(processUuid);
      setProcessData(data);

      let nodesData: Node[] = [];
      let edgesData: Edge[] = [];

      if (data.nodes && typeof data.nodes === 'object') {
        const rawNodes = data.nodes.nodes ?? data.nodes;
        const rawEdges = data.nodes.edges ?? [];
        if (Array.isArray(rawNodes)) {
          nodesData = rawNodes as Node[];
        } else if (rawNodes && typeof rawNodes === 'object') {
          nodesData = Object.values(rawNodes) as Node[];
        }
        if (Array.isArray(rawEdges)) {
          edgesData = rawEdges as Edge[];
        }
      }

      if (nodesData.length === 0) {
        nodesData = [
          { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { label: t('pages.approval.designer.start'), layoutDirection: 'vertical' } },
          { id: 'end', type: 'end', position: { x: 0, y: 0 }, data: { label: t('pages.approval.designer.end'), layoutDirection: 'vertical' } },
        ];
        edgesData = [{ id: 'e-start-end', source: 'start', target: 'end', type: 'default' }];
      }

      const normalizedEdges: Edge[] = (edgesData || []).map((e: Edge, i: number) => ({
        ...e,
        id: e.id || `e-${e.source}-${e.target}-${i}`,
        type: 'default',
      }));
      const layoutedNodes = applyVerticalLayout(nodesData, normalizedEdges);
      setNodes(layoutedNodes);
      setEdges(normalizedEdges);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.approval.designer.loadFailed'));
      navigate('/system/approval-processes');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 从指定节点添加下一节点并自动连线（与 SOP addNextStepFromNode 一致）
   */
  const addNextNodeFromNode = (sourceNodeId: string, type: 'approval' | 'cc' | 'condition') => {
    const newId = `${type}_${Date.now()}`;
    let label = t('pages.approval.designer.label');
    if (type === 'cc') label = t('pages.approval.designer.ccNode');
    if (type === 'condition') label = t('pages.approval.designer.conditionNode');

    const newNode: Node = {
      id: newId,
      type,
      position: { x: LAYOUT_CENTER_X - getNodeLayoutWidth({ type } as Node) / 2, y: LAYOUT_BASE_Y + LAYOUT_GAP },
      data: {
        label,
        approverType: 'user',
        approvalType: 'OR',
        approverIds: [],
        conditions: [],
        layoutDirection: 'vertical',
      },
    };

    const curveEdge = (id: string, source: string, target: string) => ({ id, source, target, type: 'default' as const });
    const outEdges = edges.filter((e) => e.source === sourceNodeId);
    const restEdges = edges.filter((e) => e.source !== sourceNodeId);
    const newEdges = [
      ...restEdges,
      curveEdge(`e-${sourceNodeId}-${newId}`, sourceNodeId, newId),
      ...outEdges.map((e, i) => curveEdge(`e-${newId}-${e.target}-${i}`, newId, e.target)),
    ];
    const nextNodes = [...nodes, newNode];
    const layoutedNodes = applyVerticalLayout(nextNodes, newEdges);
    setNodes(layoutedNodes);
    setEdges(newEdges);
  };

  /**
   * 条件节点：为某个条件（尚无出边）添加第一个节点，新建 条件→新节点→结束 的边
   * conditionIndex 对应条件列表中的第几条；若该位置尚无出边，会先补足前面的占位边（条件→结束）以保持顺序
   */
  const addFirstNodeForCondition = (conditionIndex: number, type: 'approval' | 'cc' | 'condition') => {
    if (!selectedNode || selectedNode.type !== 'condition') return;
    const sourceNodeId = selectedNode.id;
    const newId = `${type}_${Date.now()}`;
    let label = t('pages.approval.designer.label');
    if (type === 'cc') label = t('pages.approval.designer.ccNode');
    if (type === 'condition') label = t('pages.approval.designer.conditionNode');

    const newNode: Node = {
      id: newId,
      type,
      position: { x: LAYOUT_CENTER_X - getNodeLayoutWidth({ type } as Node) / 2, y: LAYOUT_BASE_Y + LAYOUT_GAP },
      data: {
        label,
        approverType: 'user',
        approvalType: 'OR',
        approverIds: [],
        conditions: [],
        layoutDirection: 'vertical',
      },
    };

    const curveEdge = (id: string, source: string, target: string) => ({ id, source, target, type: 'default' as const });
    const outEdges = edges.filter((e) => e.source === sourceNodeId);
    const otherEdges = edges.filter((e) => e.source !== sourceNodeId);
    const newEdgeToNode = curveEdge(`e-${sourceNodeId}-${newId}`, sourceNodeId, newId);
    const newEdgeToEnd = curveEdge(`e-${newId}-end`, newId, 'end');
    // 保持条件与出边顺序一致：若 conditionIndex 超出当前出边数，前面用 条件→结束 占位
    const padCount = Math.max(0, conditionIndex - outEdges.length);
    const padEdges = Array.from({ length: padCount }, (_, i) =>
      curveEdge(`e-${sourceNodeId}-end-pad-${Date.now()}-${i}`, sourceNodeId, 'end')
    );
    const newOutEdges = [...outEdges.slice(0, conditionIndex), ...padEdges, newEdgeToNode, ...outEdges.slice(conditionIndex)];
    const nextNodes = [...nodes, newNode];
    const newEdges = [...otherEdges, ...newOutEdges, newEdgeToEnd];
    const layoutedNodes = applyVerticalLayout(nextNodes, newEdges);
    setNodes(layoutedNodes);
    setEdges(newEdges);
  };

  /**
   * 条件节点：在指定分支（某条出边）上插入新节点，实现「按条件分别添加下一节点」
   * 将 条件→目标 改为 条件→新节点→目标
   */
  const addNextNodeOnBranch = (sourceNodeId: string, edgeId: string, type: 'approval' | 'cc' | 'condition') => {
    const edge = edges.find((e) => e.id === edgeId && e.source === sourceNodeId);
    if (!edge) return;

    const newId = `${type}_${Date.now()}`;
    let label = t('pages.approval.designer.label');
    if (type === 'cc') label = t('pages.approval.designer.ccNode');
    if (type === 'condition') label = t('pages.approval.designer.conditionNode');

    const newNode: Node = {
      id: newId,
      type,
      position: { x: LAYOUT_CENTER_X - getNodeLayoutWidth({ type } as Node) / 2, y: LAYOUT_BASE_Y + LAYOUT_GAP },
      data: {
        label,
        approverType: 'user',
        approvalType: 'OR',
        approverIds: [],
        conditions: [],
        layoutDirection: 'vertical',
      },
    };

    const curveEdge = (id: string, source: string, target: string) => ({ id, source, target, type: 'default' as const });
    const newEdges = edges.filter((e) => e.id !== edgeId);
    newEdges.push(curveEdge(`e-${sourceNodeId}-${newId}`, sourceNodeId, newId));
    newEdges.push(curveEdge(`e-${newId}-${edge.target}`, newId, edge.target));

    const nextNodes = [...nodes, newNode];
    const layoutedNodes = applyVerticalLayout(nextNodes, newEdges);
    setNodes(layoutedNodes);
    setEdges(newEdges);
  };

  /** 条件节点当前出边（每个分支一条边），用于按分支添加下一节点 */
  const conditionBranches = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'condition') return [];
    return edges.filter((e) => e.source === selectedNode.id).map((e, i) => ({
      edge: e,
      targetNode: nodes.find((n) => n.id === e.target),
      index: i + 1,
    }));
  }, [selectedNode, edges, nodes]);

  /** 条件节点：表单中条件条数（用于「其余分支」展示） */
  const conditionsLength = (Form.useWatch('conditions', nodeConfigForm) ?? []).length;

  /** 添加审批节点（从当前选中节点或开始节点；条件节点若选分支则用 addNextNodeOnBranch） */
  const handleAddApprovalNode = (branchEdgeId?: string) => {
    const sourceId = selectedNode && selectedNode.type !== 'end' ? selectedNode.id : 'start';
    if (selectedNode?.type === 'condition' && branchEdgeId) {
      addNextNodeOnBranch(sourceId, branchEdgeId, 'approval');
      return;
    }
    addNextNodeFromNode(sourceId, 'approval');
  };
  /** 添加抄送节点 */
  const handleAddCCNode = (branchEdgeId?: string) => {
    const sourceId = selectedNode && selectedNode.type !== 'end' ? selectedNode.id : 'start';
    if (selectedNode?.type === 'condition' && branchEdgeId) {
      addNextNodeOnBranch(sourceId, branchEdgeId, 'cc');
      return;
    }
    addNextNodeFromNode(sourceId, 'cc');
  };
  /** 添加条件节点 */
  const handleAddConditionNode = (branchEdgeId?: string) => {
    const sourceId = selectedNode && selectedNode.type !== 'end' ? selectedNode.id : 'start';
    if (selectedNode?.type === 'condition' && branchEdgeId) {
      addNextNodeOnBranch(sourceId, branchEdgeId, 'condition');
      return;
    }
    addNextNodeFromNode(sourceId, 'condition');
  };

  /**
   * 删除节点（仅中间节点可删，与 SOP 一致；开始/结束不可删）
   */
  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === 'start' || nodeId === 'end') {
      messageApi.warning(t('pages.approval.designer.cannotDeleteStartEnd'));
      return;
    }
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  };

  /** 删除选中的连线（与 SOP 一致） */
  const handleDeleteEdge = () => {
    if (!selectedEdge) return;
    setEdges(edges.filter((e) => e.id !== selectedEdge.id));
    setSelectedEdge(null);
    messageApi.success(t('pages.approval.designer.edgeDeleted'));
  };

  const handleNodeConfig = (node: Node) => {
    setSelectedNode(node);
    nodeConfigForm.setFieldsValue({
      label: node.data?.label || '',
      approverType: node.data?.approverType || 'user',
      approvalType: node.data?.approvalType || 'OR',
      approverIds: node.data?.approverIds || (node.data?.approverId ? [node.data.approverId] : []),
      conditions: node.data?.conditions || [],
    });
  };

  const handleSaveNodeConfig = (_changedValues: any, allValues: any) => {
    if (selectedNode) {
      const updatedNodes = nodes.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...allValues,
            },
          };
        }
        return node;
      });
      setNodes(updatedNodes);
    }
  };

  /**
   * 保存审批流设计
   */
  const handleSave = async () => {
    if (!processUuid || !processData) return;

    try {
      setSaving(true);

      // 构建节点配置
      const nodesConfig = {
        nodes,
        edges,
      };

      // 更新流程
      await updateApprovalProcess(processUuid, {
        nodes: nodesConfig,
        config: processData.config,
      });

      messageApi.success(t('pages.approval.designer.saveSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('common.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 返回列表
   */
  const handleCancel = () => {
    navigate('/system/approval-processes');
  };

  /**
   * 节点类型配置（使用 useMemo 优化性能）
   */
  const nodeTypes = useMemo(() => ({
    approval: ApprovalNode,
    cc: CCNode,
    condition: ConditionNode,
    start: StartNode,
    end: EndNode,
  }), []);

  /** 边类型：贝塞尔曲线（直接弧线） */
  /** 使用 React Flow 内置 BezierEdge（已 memo），减少拖动时边重绘 */
  const edgeTypes = useMemo(() => ({ default: BezierEdge }), []);

  /** 传给 ReactFlow 的 nodes（合并选中态），避免每次渲染新建引用导致整图重算 */
  const nodesForFlow = useMemo(
    () =>
      nodes.map((n) => {
        const mergedData = { ...n.data, selected: selectedNode?.id === n.id };
        return { ...n, data: mergedData };
      }),
    [nodes, selectedNode?.id]
  );

  /** 传给 ReactFlow 的 edges（统一样式） */
  const edgesForFlow = useMemo(
    () => edges.map((e) => ({ ...e, style: { ...e.style, stroke: token.colorBorder } })),
    [edges, token.colorBorder]
  );

  if (loading) {
    return <div style={{ padding: 16 }}>{t('pages.approval.designer.loading')}</div>;
  }

  if (!processData) {
    return <div style={{ padding: 16 }}>{t('pages.approval.designer.notFound')}</div>;
  }

  return (
    <CanvasPageTemplate
      functionalTitle={t('pages.approval.designer.functionalTitle')}
      style={{ height: 'calc(100vh - 110px)' }}
      toolbar={
        <Space style={{ width: '100%' }}>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {t('pages.approval.designer.save')}
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleCancel}>
            {t('pages.approval.designer.back')}
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={!selectedEdge}
            onClick={handleDeleteEdge}
          >
            {t('pages.approval.designer.deleteEdge')}
          </Button>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: token.colorTextSecondary }}>
            <strong>{t('pages.approval.designer.processName')}：</strong>{processData.name}
            <span style={{ marginLeft: 16 }}>
              <strong>{t('pages.approval.designer.processCode')}：</strong>{processData.code}
            </span>
          </span>
        </Space>
      }
      canvas={
        <ReactFlowProvider>
          <DesignerThemeContext.Provider
            value={{
              colorBgContainer: token.colorBgContainer,
              colorText: token.colorText,
              colorTextSecondary: token.colorTextSecondary,
              colorBorder: token.colorBorder,
              colorBorderSecondary: token.colorBorderSecondary,
              colorPrimary: token.colorPrimary,
              colorSuccess: token.colorSuccess,
              colorError: token.colorError,
              colorWarning: token.colorWarning,
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                backgroundColor: token.colorBgContainer,
                backgroundImage: `radial-gradient(${token.colorBorderSecondary ?? token.colorBorder} 1px, transparent 1px)`,
                backgroundSize: '12px 12px',
              }}
            >
              <ReactFlow
                nodes={nodesForFlow}
                edges={edgesForFlow}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_event, node) => {
                  setSelectedEdge(null);
                  handleNodeConfig(node as Node);
                }}
                onEdgeClick={(_event, edge) => setSelectedEdge(edge)}
                onPaneClick={() => setSelectedEdge(null)}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'default', style: { stroke: token.colorBorder } }}
                onConnect={(connection: Connection) => {
                  setEdges((eds) => addEdge({ ...connection, type: 'default' }, eds));
                }}
                panOnScroll
                fitView
                minZoom={0.1}
                maxZoom={2}
                onlyRenderVisibleElements
              >
                <Background
                  gap={10}
                  color={token.colorBorderSecondary ?? token.colorBorder}
                  variant={BackgroundVariant.Dots}
                />
              </ReactFlow>
            </div>
          </DesignerThemeContext.Provider>
        </ReactFlowProvider>
      }
      rightPanel={{
        title: selectedNode
          ? (selectedNode.type === 'start'
              ? t('pages.approval.designer.start')
              : selectedNode.type === 'end'
                ? t('pages.approval.designer.end')
                : `${t('pages.approval.designer.nodeConfig')} - ${selectedNode.data?.label || ''}`)
          : t('pages.approval.designer.nodeConfig'),
        children: selectedNode && selectedNode.type === 'start' ? (
          <div>
            <div style={{ marginBottom: 12, color: token.colorTextSecondary, fontSize: 12 }}>
              {t('pages.approval.designer.addNodeHint')}
            </div>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button type="default" icon={<PlusOutlined />} onClick={handleAddApprovalNode} block>
                {t('pages.approval.designer.addNode')}
              </Button>
              <Button type="default" icon={<SendOutlined />} onClick={handleAddCCNode} block>
                {t('pages.approval.designer.addCCNode')}
              </Button>
              <Button type="default" icon={<ForkOutlined />} onClick={handleAddConditionNode} block>
                {t('pages.approval.designer.addConditionNode')}
              </Button>
            </Space>
          </div>
        ) : selectedNode && selectedNode.type === 'end' ? (
          <div style={{ color: token.colorTextSecondary }}>{t('pages.approval.designer.endNodeTitle')}</div>
        ) : selectedNode ? (
          <ProForm
            form={nodeConfigForm}
            layout="vertical"
            submitter={false}
            onValuesChange={handleSaveNodeConfig}
          >
            <ProFormText
              name="label"
              label={t('pages.approval.designer.label')}
              rules={[{ required: true, message: t('pages.approval.designer.label') }]}
              placeholder={t('pages.approval.designer.label')}
            />

            {(selectedNode.type === 'approval') && (
            <>
            <ProFormSelect
              name="approvalType"
              label={t('pages.approval.designer.approvalType')}
              tooltip={t('pages.approval.designer.approvalTypeToolTip')}
              options={[
                { label: t('pages.approval.designer.approvalTypeOr'), value: 'OR' },
                { label: t('pages.approval.designer.approvalTypeAnd'), value: 'AND' },
              ]}
              initialValue="OR"
            />
            </>
            )}

            {(selectedNode.type === 'approval' || selectedNode.type === 'cc') && (
            <>
            <ProFormSelect
              name="approverType"
              label={selectedNode.type === 'cc' ? t('pages.approval.designer.ccRecipients') : t('pages.approval.designer.approverType')}
              rules={[{ required: true, message: t('pages.approval.designer.approverType') }]}
              options={[
                { label: t('pages.approval.designer.approverTypeUser'), value: 'user' },
                { label: t('pages.approval.designer.approverTypeRole'), value: 'role' },
                { label: t('pages.approval.designer.approverTypeManager'), value: 'manager' },
                { label: t('pages.approval.designer.approverTypeDept'), value: 'department' },
                { label: t('pages.approval.designer.approverTypeOptional'), value: 'optional' },
              ]}
              initialValue="user"
            />
            <ProFormDependency name={['approverType']}>
              {({ approverType }) => {
                if (approverType === 'user') {
                  return (
                    <ProFormSelect
                      name="approverIds"
                      label={t('pages.approval.designer.selectUser')}
                      mode="multiple"
                      request={async () => {
                        const response = await getUserList({ page_size: 1000 });
                        return (response.items || []).map((u: any) => ({ label: u.full_name || u.username, value: u.uuid }));
                      }}
                      placeholder={t('pages.approval.designer.selectUser')}
                    />
                  );
                }
                if (approverType === 'role') {
                  return (
                    <ProFormSelect
                      name="approverIds"
                      label={t('pages.approval.designer.selectRole')}
                      mode="multiple"
                      request={async () => {
                        const response = await getRoleList({ page_size: 1000 });
                        return (response.items || []).map((r: any) => ({ label: r.name, value: r.uuid }));
                      }}
                      placeholder={t('pages.approval.designer.selectRole')}
                    />
                  );
                }
                return null;
              }}
            </ProFormDependency>
            </>
            )}

            <Divider style={{ margin: '16px 0' }} />

            {/* 条件节点：先配置条件，再按条件顺序显示对应分支（条件 1 → 分支 1，条件 2 → 分支 2） */}
            {(selectedNode.type === 'condition') && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: '500', marginBottom: 8 }}>{t('pages.approval.designer.conditions')}</div>
              <ProFormList
                name="conditions"
                creatorButtonProps={{
                  creatorButtonText: t('pages.approval.designer.addCondition'),
                  size: 'small',
                  type: 'dashed'
                }}
                min={0}
                itemRender={({ listDom, action }, listMeta) => {
                  const index = listMeta?.index ?? 0;
                  const branch = conditionBranches[index];
                  const addButtons = (
                    <Space wrap>
                      <Button type="default" size="small" icon={<PlusOutlined />} onClick={() => branch ? handleAddApprovalNode(branch.edge.id) : addFirstNodeForCondition(index, 'approval')}>
                        {t('pages.approval.designer.addNode')}
                      </Button>
                      <Button type="default" size="small" icon={<SendOutlined />} onClick={() => branch ? handleAddCCNode(branch.edge.id) : addFirstNodeForCondition(index, 'cc')}>
                        {t('pages.approval.designer.addCCNode')}
                      </Button>
                      <Button type="default" size="small" icon={<ForkOutlined />} onClick={() => branch ? handleAddConditionNode(branch.edge.id) : addFirstNodeForCondition(index, 'condition')}>
                        {t('pages.approval.designer.addConditionNode')}
                      </Button>
                    </Space>
                  );
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <Card
                        size="small"
                        styles={{ body: { padding: 8 } }}
                        style={{ marginBottom: 6, background: (token as any).colorFillQuaternary ?? token.colorFillSecondary ?? '#fafafa' }}
                        extra={action}
                      >
                        {listDom}
                      </Card>
                      <Card size="small" style={{ background: (token as any).colorFillQuaternary ?? token.colorFillSecondary ?? '#f5f5f5', marginLeft: 8, borderLeft: `3px solid ${token.colorPrimary}` }}>
                        <div style={{ marginBottom: 6, fontSize: 12, color: token.colorTextSecondary }}>
                          {branch
                            ? `${t('pages.approval.designer.branchAfterCondition', { index: index + 1 })} → ${branch.targetNode?.data?.label || branch.targetNode?.id || branch.edge.target}`
                            : t('pages.approval.designer.branchAddFirst', { index: index + 1 })}
                        </div>
                        {addButtons}
                      </Card>
                    </div>
                  );
                }}
              >
                <ProFormGroup size={8}>
                  <ProFormSelect
                    name="field"
                    placeholder={t('pages.approval.designer.field')}
                    width="xs"
                    options={[
                      { value: 'amount', label: t('pages.approval.designer.fieldAmount') },
                      { value: 'department', label: t('pages.approval.designer.fieldDepartment') },
                      { value: 'urgent_level', label: t('pages.approval.designer.fieldUrgentLevel') },
                      { value: 'custom', label: t('pages.approval.designer.fieldCustom') },
                    ]}
                  />
                  <ProFormSelect
                    name="operator"
                    placeholder={t('pages.approval.designer.operator')}
                    width="xs"
                    options={[
                      { value: '==', label: t('pages.approval.designer.opEqual') },
                      { value: '!=', label: t('pages.approval.designer.opNotEqual') },
                      { value: '>', label: t('pages.approval.designer.opGreater') },
                      { value: '<', label: t('pages.approval.designer.opLess') },
                      { value: 'contains', label: t('pages.approval.designer.opContains') },
                    ]}
                  />
                  <ProFormText
                    name="value"
                    placeholder={t('pages.approval.designer.value')}
                    width="xs"
                  />
                </ProFormGroup>
              </ProFormList>
            </div>
            )}

            {selectedNode?.type === 'condition' && conditionBranches.length > conditionsLength && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 8 }}>
                  {t('pages.approval.designer.extraBranchesHint')}
                </div>
                <Space direction="vertical" style={{ width: '100%' }} size={8}>
                  {conditionBranches.slice(conditionsLength).map(({ edge, targetNode }, i) => (
                    <Card size="small" key={edge.id} style={{ background: (token as any).colorFillQuaternary ?? token.colorFillSecondary ?? '#fafafa' }}>
                      <div style={{ marginBottom: 6, fontSize: 12 }}>
                        {t('pages.approval.designer.branchLabel', { index: conditionsLength + i + 1 })} → {targetNode?.data?.label || targetNode?.id || edge.target}
                      </div>
                      <Space wrap>
                        <Button type="default" size="small" icon={<PlusOutlined />} onClick={() => handleAddApprovalNode(edge.id)}>
                          {t('pages.approval.designer.addNode')}
                        </Button>
                        <Button type="default" size="small" icon={<SendOutlined />} onClick={() => handleAddCCNode(edge.id)}>
                          {t('pages.approval.designer.addCCNode')}
                        </Button>
                        <Button type="default" size="small" icon={<ForkOutlined />} onClick={() => handleAddConditionNode(edge.id)}>
                          {t('pages.approval.designer.addConditionNode')}
                        </Button>
                      </Space>
                    </Card>
                  ))}
                </Space>
              </div>
            )}

            {selectedNode.type !== 'condition' && (
            <>
            <div style={{ marginBottom: 12, color: token.colorTextSecondary, fontSize: 12 }}>
              {t('pages.approval.designer.addFromCurrentHint')}
            </div>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
              <Button type="default" icon={<PlusOutlined />} onClick={() => handleAddApprovalNode()} block size="small">
                {t('pages.approval.designer.addNode')}
              </Button>
              <Button type="default" icon={<SendOutlined />} onClick={() => handleAddCCNode()} block size="small">
                {t('pages.approval.designer.addCCNode')}
              </Button>
              <Button type="default" icon={<ForkOutlined />} onClick={() => handleAddConditionNode()} block size="small">
                {t('pages.approval.designer.addConditionNode')}
              </Button>
            </Space>
            </>
            )}

            <div style={{ borderTop: `1px solid ${token.colorBorder}`, marginTop: 16, paddingTop: 16 }}>
              <Button
                danger
                icon={<DeleteOutlined />}
                block
                onClick={() => {
                  handleDeleteNode(selectedNode.id);
                  setSelectedNode(null);
                }}
              >
                {t('pages.approval.designer.deleteNode')}
              </Button>
            </div>
          </ProForm>
        ) : (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
            {t('pages.approval.designer.selectNodeTip')}
          </div>
        )
      }}
    />
  );
};

export default ApprovalProcessDesignerPage;

