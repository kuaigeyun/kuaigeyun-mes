/**
 * 标准操作SOP可视化编辑器页面
 * 
 * 使用 ProFlow 可视化设计标准操作SOP流程。
 * 支持节点拖拽、连接线绘制、节点属性配置等功能。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, message, Modal, Space, Form, Input, theme } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import { App } from 'antd';

const { TextArea } = Input;
const { useToken } = theme;
import { FlowView, FlowStoreProvider, useNodesState, useEdgesState } from '@ant-design/pro-flow';
import type { Node, Edge, NodeProps } from '@ant-design/pro-flow';
import { ReactFlowProvider, Handle, Position, addEdge } from 'reactflow';
import type { Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import { sopApi } from '../../../services/process';
import type { SOP } from '../../../types/process';
import { CanvasPageTemplate } from '../../../../../components/layout-templates';
import FormSchemaEditor from './FormSchemaEditor';
import type { ISchema } from '@formily/json-schema';

/** 垂直布局常量：中心线 x、等间距；节点按类型宽度居中对齐 */
const LAYOUT_CENTER_X = 280;
const LAYOUT_BASE_Y = 60;
const LAYOUT_GAP = 100;
/** 各类型节点宽度（与组件 minWidth 一致），用于居中对齐 */
const NODE_WIDTH_BY_TYPE: Record<string, number> = { start: 100, end: 100, step: 150, check: 150 };
function getNodeLayoutWidth(node: Node): number {
  return NODE_WIDTH_BY_TYPE[node.type as string] ?? 150;
}

/** 选中节点光晕样式 */
const GLOW_STYLE = {
  step: '0 0 0 2px #fff, 0 0 16px 6px #1890ff',
  check: '0 0 0 2px #fff, 0 0 16px 6px #faad14',
  start: '0 0 0 2px #fff, 0 0 16px 6px #52c41a',
  end: '0 0 0 2px #fff, 0 0 16px 6px #ff4d4f',
} as const;

type DesignerToken = {
  colorBgContainer: string;
  colorText: string;
  colorTextSecondary: string;
  colorBorder: string;
  colorPrimary: string;
  colorSuccess: string;
  colorError: string;
  colorWarning: string;
};
const DesignerThemeContext = React.createContext<DesignerToken | null>(null);

/**
 * 根据边关系得到节点垂直顺序：start -> 中间节点... -> end
 */
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
 * 对节点应用垂直排列、居中对齐：同一中心线 LAYOUT_CENTER_X，按节点类型宽度计算 position.x
 */
function applyVerticalLayout(nodes: Node[], edges: Edge[]): Node[] {
  const order = getVerticalOrder(edges);
  const allIds = new Set(nodes.map((n) => n.id));
  const missing = [...allIds].filter((id) => !order.includes(id));
  const fullOrder = order.slice(0, -1).concat(missing).concat(['end']);
  const idToIndex = new Map<string, number>();
  fullOrder.forEach((id, i) => idToIndex.set(id, i));
  return nodes.map((node) => {
    const index = idToIndex.get(node.id) ?? fullOrder.length;
    const y = LAYOUT_BASE_Y + index * LAYOUT_GAP;
    const w = getNodeLayoutWidth(node);
    const x = LAYOUT_CENTER_X - w / 2;
    return { ...node, position: { x, y } };
  });
}

/**
 * 作业步骤节点组件（适配暗黑模式）
 */
const StepNode: React.FC<NodeProps> = ({ data }) => {
  const token = React.useContext(DesignerThemeContext);
  const selected = (data as { selected?: boolean })?.selected;
  const bg = token?.colorBgContainer ?? '#fff';
  const border = token?.colorPrimary ?? '#1890ff';
  const text = token?.colorText ?? '#000';
  const textSec = token?.colorTextSecondary ?? '#666';
  return (
    <div
      style={{
        padding: '12px 16px',
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 8,
        minWidth: 150,
        cursor: 'pointer',
        boxShadow: selected ? GLOW_STYLE.step : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 'bold', marginBottom: 4, color: text }}>
        {data?.label || '作业步骤'}
      </div>
      <div style={{ fontSize: 12, color: textSec }}>
        {data?.description || '步骤描述'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

/**
 * 检查节点组件（适配暗黑模式）
 */
const CheckNode: React.FC<NodeProps> = ({ data }) => {
  const token = React.useContext(DesignerThemeContext);
  const selected = (data as { selected?: boolean })?.selected;
  const bg = token?.colorBgContainer ?? '#fff';
  const border = token?.colorWarning ?? '#faad14';
  const text = token?.colorText ?? '#000';
  const textSec = token?.colorTextSecondary ?? '#666';
  return (
    <div
      style={{
        padding: '12px 16px',
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 8,
        minWidth: 150,
        cursor: 'pointer',
        boxShadow: selected ? GLOW_STYLE.check : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 'bold', marginBottom: 4, color: text }}>
        {data?.label || '检查节点'}
      </div>
      <div style={{ fontSize: 12, color: textSec }}>
        {data?.description || '检查描述'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

/**
 * 开始节点组件（适配暗黑模式，保持绿色）
 */
const StartNode: React.FC<NodeProps> = ({ data }) => {
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
        boxShadow: selected ? GLOW_STYLE.start : undefined,
      }}
    >
      <Handle type="source" position={Position.Bottom} />
      开始
    </div>
  );
};

/**
 * 结束节点组件（适配暗黑模式，保持红色）
 */
const EndNode: React.FC<NodeProps> = ({ data }) => {
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
        boxShadow: selected ? GLOW_STYLE.end : undefined,
      }}
    >
      <Handle type="target" position={Position.Top} />
      结束
    </div>
  );
};

/**
 * eSOP 可视化编辑器页面组件
 */
const ESOPDesignerPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sopUuid = searchParams.get('uuid');
  const fromEdit = searchParams.get('from') === 'edit';
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sopData, setSopData] = useState<SOP | null>(null);
  
  // ProFlow 数据
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const nodesEdgesRef = React.useRef({ nodes: [] as Node[], edges: [] as Edge[] });
  nodesEdgesRef.current = { nodes, edges };
  /** 节点 data 的权威来源（label/description/formSchema），避免被 Flow 库 onNodesChange 等覆盖 */
  const dataByNodeIdRef = React.useRef<Record<string, { label?: string; description?: string; formSchema?: ISchema | null }>>({});

  // 节点配置（右侧面板，不使用抽屉）
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeConfigForm] = Form.useForm();
  const [formSchema, setFormSchema] = useState<ISchema | null>(null);
  /** 当前选中的连线（点击连线后高亮，可删除） */
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);

  /**
   * 加载 SOP 数据
   */
  useEffect(() => {
    if (sopUuid) {
      loadSOPData();
    } else {
      messageApi.warning(t('app.master-data.sop.missingUuid'));
      navigate('/apps/master-data/process/sop');
    }
  }, [sopUuid]);

  /**
   * 加载 SOP 数据
   */
  const loadSOPData = async () => {
    if (!sopUuid) return;
    
    try {
      setLoading(true);
      const data = await sopApi.get(sopUuid);
      setSopData(data);
      
      // 解析流程配置（兼容后端返回 snake_case flow_config 与前端 camelCase flowConfig）
      let nodesData: Node[] = [];
      let edgesData: Edge[] = [];
      const flowConfig = (data as any).flow_config ?? data.flowConfig;
      if (flowConfig && typeof flowConfig === 'object') {
        nodesData = flowConfig.nodes || [];
        edgesData = flowConfig.edges || [];
      }
      
      // 如果没有节点数据，添加默认的开始和结束节点及二者之间的连线
      if (!Array.isArray(nodesData) || nodesData.length === 0) {
        nodesData = [
          {
            id: 'start',
            type: 'start',
            position: { x: 100, y: 100 },
            data: { label: '开始' },
          },
          {
            id: 'end',
            type: 'end',
            position: { x: 400, y: 100 },
            data: { label: '结束' },
          },
        ];
        edgesData = [{ id: 'e-start-end', source: 'start', target: 'end' }];
      }
      
      // 解析表单配置并合并到节点数据中（兼容 snake_case form_config 与 camelCase formConfig）
      const formConfig = (data as any).form_config ?? data.formConfig;
      if (formConfig && typeof formConfig === 'object') {
        // formConfig 格式: { nodeId: schema, ... }
        nodesData = nodesData.map((node) => {
          const nodeId = node.id;
          if (formConfig[nodeId]) {
            return {
              ...node,
              data: {
                ...node.data,
                formSchema: formConfig[nodeId],
              },
            };
          }
          return node;
        });
      }
      
      const normalizedEdges = Array.isArray(edgesData)
        ? edgesData.map((e: Edge, i: number) => ({
            ...e,
            id: e.id || `e-${e.source}-${e.target}-${i}`,
            type: 'straight',
          }))
        : [];
      const layoutedNodes = applyVerticalLayout(nodesData, normalizedEdges);
      setNodes(layoutedNodes);
      setEdges(normalizedEdges);
      layoutedNodes.forEach((n) => {
        dataByNodeIdRef.current[n.id] = {
          label: n.data?.label,
          description: n.data?.description,
          formSchema: n.data?.formSchema ?? null,
        };
      });
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.sop.loadFailed'));
      navigate('/apps/master-data/process/sop');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 从指定节点添加下一步并自动连线；新节点插入到该节点与原有后继节点之间（源->新节点，新节点->各后继）
   */
  const addNextStepFromNode = (sourceNodeId: string, type: 'step' | 'check', defaultLabel: string) => {
    const newId = `${type}_${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type,
      position: {
        x: LAYOUT_CENTER_X - getNodeLayoutWidth({ type } as Node) / 2,
        y: LAYOUT_BASE_Y + LAYOUT_GAP,
      },
      data: {
        label: defaultLabel,
        description: '',
        formSchema: null,
      },
    };
    const straightEdge = (id: string, source: string, target: string) => ({ id, source, target, type: 'straight' as const });
    const outEdges = edges.filter((e) => e.source === sourceNodeId);
    const restEdges = edges.filter((e) => e.source !== sourceNodeId);
    const newEdges = [
      ...restEdges,
      straightEdge(`e-${sourceNodeId}-${newId}`, sourceNodeId, newId),
      ...outEdges.map((e, i) => straightEdge(`e-${newId}-${e.target}-${i}`, newId, e.target)),
    ];
    const nextNodes = [...nodes, newNode];
    const layoutedNodes = applyVerticalLayout(nextNodes, newEdges);
    setNodes(layoutedNodes);
    setEdges(newEdges);
    dataByNodeIdRef.current[newId] = { label: defaultLabel, description: '', formSchema: null };
  };

  /** 添加作业步骤（从当前选中节点或开始节点） */
  const handleAddStepNode = () => {
    const sourceId = selectedNode && selectedNode.type !== 'end' ? selectedNode.id : 'start';
    addNextStepFromNode(sourceId, 'step', '作业步骤');
  };

  /** 添加检查节点（从当前选中节点或开始节点） */
  const handleAddCheckNode = () => {
    const sourceId = selectedNode && selectedNode.type !== 'end' ? selectedNode.id : 'start';
    addNextStepFromNode(sourceId, 'check', '检查节点');
  };

  /**
   * 节点上移：与流程顺序中的前一个节点交换位置（开始/结束不参与）
   */
  const handleMoveNodeUp = () => {
    if (!selectedNode || selectedNode.type === 'start' || selectedNode.type === 'end') return;
    const order = getVerticalOrder(edges);
    const idx = order.indexOf(selectedNode.id);
    if (idx <= 1) return; // 已是第一个步骤，无法上移
    const prevId = order[idx - 1];
    const prevPrevId = order[idx - 2];
    const straightEdge = (id: string, source: string, target: string) => ({ id, source, target, type: 'straight' as const });
    const outFromSelected = edges.filter((e) => e.source === selectedNode.id);
    const outFromPrev = edges.filter((e) => e.source === prevId);
    const newEdges = edges
      .filter((e) => e.source !== prevPrevId || e.target !== prevId)
      .filter((e) => e.source !== prevId || e.target !== selectedNode.id)
      .filter((e) => e.source !== selectedNode.id)
      .filter((e) => e.source !== prevId);
    newEdges.push(straightEdge(`e-${prevPrevId}-${selectedNode.id}`, prevPrevId, selectedNode.id));
    newEdges.push(straightEdge(`e-${selectedNode.id}-${prevId}`, selectedNode.id, prevId));
    outFromSelected.forEach((e, i) => newEdges.push(straightEdge(`e-${prevId}-${e.target}-${i}`, prevId, e.target)));
    setEdges(newEdges);
    const layoutedNodes = applyVerticalLayout(nodes, newEdges);
    setNodes(layoutedNodes);
  };

  /**
   * 节点下移：与流程顺序中的后一个节点交换位置（开始/结束不参与）
   */
  const handleMoveNodeDown = () => {
    if (!selectedNode || selectedNode.type === 'start' || selectedNode.type === 'end') return;
    const order = getVerticalOrder(edges);
    const idx = order.indexOf(selectedNode.id);
    if (idx < 0 || idx >= order.length - 2) return; // 已是最后一步或不在顺序中，无法下移
    const nextId = order[idx + 1];
    const prevId = order[idx - 1];
    const straightEdge = (id: string, source: string, target: string) => ({ id, source, target, type: 'straight' as const });
    const outFromSelected = edges.filter((e) => e.source === selectedNode.id);
    const outFromNext = edges.filter((e) => e.source === nextId);
    const newEdges = edges
      .filter((e) => !(e.source === prevId && e.target === selectedNode.id))
      .filter((e) => e.source !== selectedNode.id)
      .filter((e) => e.source !== nextId);
    newEdges.push(straightEdge(`e-${prevId}-${nextId}`, prevId, nextId));
    newEdges.push(straightEdge(`e-${nextId}-${selectedNode.id}`, nextId, selectedNode.id));
    outFromNext.forEach((e, i) => newEdges.push(straightEdge(`e-${selectedNode.id}-${e.target}-${i}`, selectedNode.id, e.target)));
    setEdges(newEdges);
    const layoutedNodes = applyVerticalLayout(nodes, newEdges);
    setNodes(layoutedNodes);
  };

  /**
   * 删除节点（仅作业步骤/检查节点，开始/结束不可删）
   */
  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === 'start' || nodeId === 'end') {
      messageApi.warning(t('app.master-data.sop.cannotDeleteStartEnd'));
      return;
    }
    delete dataByNodeIdRef.current[nodeId];
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
    messageApi.success(t('app.master-data.sop.nodeDeleted'));
  };

  /**
   * 删除选中的连线
   */
  const handleDeleteEdge = () => {
    if (!selectedEdge) return;
    setEdges(edges.filter((e) => e.id !== selectedEdge.id));
    setSelectedEdge(null);
    messageApi.success(t('app.master-data.sop.edgeDeleted'));
  };

  /**
   * 打开节点配置
   */
  const handleNodeConfig = (node: Node) => {
    setSelectedNode(node);
    const nodeData = dataByNodeIdRef.current[node.id] ?? node.data;
    nodeConfigForm.setFieldsValue({
      label: nodeData?.label ?? '',
      description: nodeData?.description ?? '',
    });
    
    // 加载节点的表单配置
    const schema = nodeData?.formSchema ?? node.data?.formSchema;
    if (schema) {
      setFormSchema(schema as ISchema);
    } else {
      setFormSchema(null);
    }
  };

  /**
   * 保存节点配置（用函数式更新 setNodes 避免闭包中 nodes 过期导致画布不刷新）
   * 同时同步更新 nodesEdgesRef，确保紧接着点击「保存」时提交的是最新节点数据（含名称等）
   */
  const handleSaveNodeConfig = () => {
    nodeConfigForm
      .validateFields()
      .then((values) => {
        const nodeId = selectedNode?.id;
        if (!nodeId) return;
        const nextData = { ...selectedNode?.data, ...values, formSchema: formSchema ?? null };
        dataByNodeIdRef.current[nodeId] = {
          label: nextData.label,
          description: nextData.description,
          formSchema: nextData.formSchema ?? null,
        };
        setNodes((prevNodes) => {
          const nextNodes = prevNodes.map((node) =>
            node.id === nodeId ? { ...node, data: nextData } : node
          );
          nodesEdgesRef.current = { ...nodesEdgesRef.current, nodes: nextNodes };
          return nextNodes;
        });
        setSelectedNode((prev) =>
          prev && prev.id === nodeId ? { ...prev, data: nextData } : prev
        );
        messageApi.success(t('app.master-data.sop.nodeConfigSaved'));
      })
      .catch((err) => {
        if (err?.errorFields?.length) {
          const firstMsg = err.errorFields[0]?.errors?.[0];
          messageApi.warning(firstMsg || '请完善必填项');
        }
      });
  };

  /**
   * 保存SOP设计：序列化 nodes/edges 为可提交的纯数据，使用 snake_case 字段名
   */
  const handleSave = async () => {
    if (!sopUuid || !sopData) return;

    const { nodes: latestNodes, edges: latestEdges } = nodesEdgesRef.current;
    try {
      setSaving(true);
      const dataByNodeId = dataByNodeIdRef.current;
      const flow_config = {
        nodes: latestNodes.map((n) => {
          const data = { ...n.data, ...dataByNodeId[n.id] };
          return {
            id: n.id,
            type: n.type,
            position: n.position,
            data: { label: data.label, description: data.description, formSchema: data.formSchema ?? null },
          };
        }),
        edges: latestEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type ?? 'straight' })),
      };

      const form_config: Record<string, ISchema> = {};
      latestNodes.forEach((node) => {
        if (node.type === 'step' || node.type === 'check') {
          const schema = dataByNodeId[node.id]?.formSchema ?? node.data?.formSchema;
          if (schema) form_config[node.id] = schema as ISchema;
        }
      });

      const payload = {
        flow_config,
        form_config: Object.keys(form_config).length > 0 ? form_config : null,
      };
      await sopApi.update(sopUuid, payload as any);

      messageApi.success(t('app.master-data.sop.designSaved'));
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error('[SOP 保存失败]', error?.response?.data ?? error);
      }
      const msg = error?.response?.data?.detail ?? error?.message ?? t('app.master-data.sop.saveFailed');
      const errStr = typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.map((m: any) => m?.msg ?? m).join('; ') : JSON.stringify(msg);
      messageApi.error(errStr);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 返回列表或编辑页（若从编辑页进入）
   */
  const handleCancel = () => {
    if (fromEdit && sopUuid) {
      navigate(`/apps/master-data/process/sop?editUuid=${sopUuid}&tab=workflow`);
    } else {
      navigate('/apps/master-data/process/sop');
    }
  };

  /**
   * 节点类型配置
   */
  const nodeTypes = useMemo(() => ({
    step: StepNode,
    check: CheckNode,
    start: StartNode,
    end: EndNode,
  }), []);

  if (loading) {
    return <div style={{ padding: 16 }}>加载中...</div>;
  }

  if (!sopData) {
    return <div style={{ padding: 16 }}>SOP数据不存在</div>;
  }

  return (
    <CanvasPageTemplate
      functionalTitle="SOP 流程设计"
      style={{ height: 'calc(100vh - 110px)' }}
      toolbar={
        <Space style={{ width: '100%' }}>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            保存
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleCancel}>
            {fromEdit ? '返回编辑' : '返回列表'}
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={!selectedEdge}
            onClick={handleDeleteEdge}
          >
            {t('app.master-data.sop.deleteEdge')}
          </Button>
        </Space>
      }
      canvas={
        <ReactFlowProvider>
          <FlowStoreProvider>
            <DesignerThemeContext.Provider
              value={{
                colorBgContainer: token.colorBgContainer,
                colorText: token.colorText,
                colorTextSecondary: token.colorTextSecondary,
                colorBorder: token.colorBorder,
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
                  backgroundImage: `radial-gradient(${token.colorBorderSecondary} 1px, transparent 1px)`,
                  backgroundSize: '12px 12px',
                }}
              >
                <FlowView
                  nodes={nodes.map((n) => {
                    const mergedData = {
                      ...n.data,
                      ...dataByNodeIdRef.current[n.id],
                      selected: selectedNode?.id === n.id,
                    };
                    const label = mergedData.label ?? n.data?.label;
                    return {
                      ...n,
                      key: `${n.id}-${label ?? ''}`,
                      label,
                      data: mergedData,
                    };
                  })}
                  edges={edges.map((e) => ({ ...e, style: { ...e.style, stroke: token.colorBorder } }))}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={(_, node) => {
                    setSelectedEdge(null);
                    handleNodeConfig(node);
                  }}
                  onEdgeClick={(_, edge) => {
                    setSelectedEdge(edge);
                  }}
                  onPaneClick={() => {
                    setSelectedEdge(null);
                  }}
                  nodeTypes={nodeTypes}
                  flowProps={{
                    defaultEdgeOptions: {
                      type: 'straight',
                      style: { stroke: token.colorBorder },
                    },
                    onConnect: (connection: Connection) => {
                      setEdges((eds) => addEdge({ ...connection, type: 'straight' }, eds));
                    },
                  }}
                />
              </div>
            </DesignerThemeContext.Provider>
          </FlowStoreProvider>
        </ReactFlowProvider>
      }
      rightPanel={{
        title: selectedNode
          ? (selectedNode.type === 'step'
              ? '作业步骤'
              : selectedNode.type === 'check'
                ? '检查节点'
                : selectedNode.type === 'start'
                  ? '开始'
                  : selectedNode.type === 'end'
                    ? '结束'
                    : t('app.master-data.sop.nodeConfigTitle'))
          : t('app.master-data.sop.nodeConfigTitle'),
        children: selectedNode ? (
          selectedNode.type === 'start' ? (
            <div>
              <div style={{ marginBottom: 12, color: token.colorTextSecondary, fontSize: 12 }}>
                从开始节点添加下一步，新节点将自动连线并垂直排列。
              </div>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="default" icon={<PlusOutlined />} onClick={handleAddStepNode} block>
                  {t('app.master-data.sop.addStepNode')}
                </Button>
                <Button type="default" icon={<PlusOutlined />} onClick={handleAddCheckNode} block>
                  {t('app.master-data.sop.addCheckNode')}
                </Button>
              </Space>
            </div>
          ) : selectedNode.type === 'end' ? (
            <div style={{ color: token.colorTextSecondary }}>结束节点，无需配置。</div>
          ) : (
            <>
              <Form form={nodeConfigForm} layout="vertical" size="small">
                <Form.Item
                  name="label"
                  label={t('app.master-data.sop.nodeNameLabel')}
                  rules={[{ required: true, message: t('app.master-data.sop.nodeNamePlaceholder') }]}
                >
                  <Input
                    placeholder={t('app.master-data.sop.nodeNamePlaceholder')}
                    onChange={(e) => {
                      const label = e.target.value;
                      const nodeId = selectedNode?.id;
                      if (!nodeId) return;
                      dataByNodeIdRef.current[nodeId] = { ...dataByNodeIdRef.current[nodeId], label };
                      setNodes((prev) => {
                        const next = prev.map((n) =>
                          n.id === nodeId ? { ...n, data: { ...n.data, label } } : n
                        );
                        nodesEdgesRef.current = { ...nodesEdgesRef.current, nodes: next };
                        return next;
                      });
                      setSelectedNode((prev) =>
                        prev?.id === nodeId ? { ...prev, data: { ...prev.data, label } } : prev
                      );
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="description"
                  label={t('app.master-data.sop.nodeDescLabel')}
                >
                  <TextArea
                    rows={3}
                    placeholder={t('app.master-data.sop.nodeDescPlaceholder')}
                    onChange={(e) => {
                      const description = e.target.value;
                      const nodeId = selectedNode?.id;
                      if (!nodeId) return;
                      dataByNodeIdRef.current[nodeId] = { ...dataByNodeIdRef.current[nodeId], description };
                      setNodes((prev) => {
                        const next = prev.map((n) =>
                          n.id === nodeId ? { ...n, data: { ...n.data, description } } : n
                        );
                        nodesEdgesRef.current = { ...nodesEdgesRef.current, nodes: next };
                        return next;
                      });
                      setSelectedNode((prev) =>
                        prev?.id === nodeId ? { ...prev, data: { ...prev.data, description } } : prev
                      );
                    }}
                  />
                </Form.Item>
              </Form>
              {(selectedNode.type === 'step' || selectedNode.type === 'check') && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${token.colorBorder}` }}>
                    <strong>{t('app.master-data.sop.formConfigTitle')}</strong>
                    <div style={{ color: token.colorTextSecondary, fontSize: 12, marginTop: 4 }}>
                      {t('app.master-data.sop.formConfigHint')}
                    </div>
                  </div>
                  <FormSchemaEditor
                    value={(formSchema as any) || undefined}
                    onChange={(schema) => {
                      setFormSchema(schema as any);
                    }}
                  />
                </div>
              )}
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
                <div style={{ marginBottom: 8, fontSize: 12, color: token.colorTextSecondary }}>添加下一步</div>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button type="default" size="small" icon={<PlusOutlined />} onClick={handleAddStepNode} block>
                    {t('app.master-data.sop.addStepNode')}
                  </Button>
                  <Button type="default" size="small" icon={<PlusOutlined />} onClick={handleAddCheckNode} block>
                    {t('app.master-data.sop.addCheckNode')}
                  </Button>
                </Space>
              </div>
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
                <div style={{ marginBottom: 8, fontSize: 12, color: token.colorTextSecondary }}>节点顺序</div>
                <Space>
                  <Button
                    size="small"
                    icon={<UpOutlined />}
                    onClick={handleMoveNodeUp}
                    disabled={(() => {
                      const order = getVerticalOrder(edges);
                      const idx = order.indexOf(selectedNode.id);
                      return idx <= 1;
                    })()}
                  >
                    上移
                  </Button>
                  <Button
                    size="small"
                    icon={<DownOutlined />}
                    onClick={handleMoveNodeDown}
                    disabled={(() => {
                      const order = getVerticalOrder(edges);
                      const idx = order.indexOf(selectedNode.id);
                      return idx < 0 || idx >= order.length - 2;
                    })()}
                  >
                    下移
                  </Button>
                </Space>
              </div>
              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Button type="primary" size="small" onClick={handleSaveNodeConfig}>
                  保存
                </Button>
                <Button
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    Modal.confirm({
                      title: t('app.master-data.sop.deleteNodeConfirmTitle'),
                      content: t('app.master-data.sop.deleteNodeConfirmContent'),
                      okText: t('common.confirm'),
                      okType: 'danger',
                      cancelText: t('common.cancel'),
                      onOk: () => handleDeleteNode(selectedNode.id),
                    });
                  }}
                >
                  删除节点
                </Button>
              </div>
            </>
          )
        ) : (
          <div style={{ color: token.colorTextSecondary }}>
            <Form layout="vertical" size="small">
              <Form.Item label="SOP名称">
                <Input value={sopData?.name} readOnly bordered={false} style={{ color: token.colorText }} />
              </Form.Item>
              <Form.Item label="SOP编号">
                <Input value={sopData?.code} readOnly bordered={false} style={{ color: token.colorText }} />
              </Form.Item>
              <Form.Item>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Button
                    type="default"
                    icon={<PlusOutlined />}
                    onClick={handleAddStepNode}
                    block
                  >
                    {t('app.master-data.sop.addStepNode')}
                  </Button>
                  <Button
                    type="default"
                    icon={<PlusOutlined />}
                    onClick={handleAddCheckNode}
                    block
                  >
                    {t('app.master-data.sop.addCheckNode')}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
            <div style={{ padding: '24px 0', textAlign: 'center', color: token.colorTextSecondary }}>
              {t('app.master-data.sop.clickNodeToConfig')}
            </div>
          </div>
        ),
      }}
    />
  );
};

export default ESOPDesignerPage;

