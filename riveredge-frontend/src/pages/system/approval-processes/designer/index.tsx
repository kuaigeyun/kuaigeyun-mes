/**
 * 审批流程设计器页面
 * 
 * 使用 ProFlow 可视化设计审批流程。
 * 支持节点拖拽、连接线绘制、节点属性配置等功能。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProForm, ProFormText, ProFormSelect, ProFormList, ProFormGroup, ProFormDependency } from '@ant-design/pro-components';
import { App, Button, Tag, Form, Space, Divider, Card } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined, VerticalAlignBottomOutlined, ColumnWidthOutlined, UserOutlined, TeamOutlined, ControlOutlined, SendOutlined, ForkOutlined } from '@ant-design/icons';
import { getUserList } from '../../../../services/user';
import { getRoleList } from '../../../../services/role';
import { FlowView, FlowStoreProvider, useNodesState, useEdgesState } from '@ant-design/pro-flow';
import type { Node, Edge, NodeProps } from '@ant-design/pro-flow';
import { ReactFlowProvider, Handle, Position } from 'reactflow';
// @ts-ignore
import 'reactflow/dist/style.css';
import {
  getApprovalProcessByUuid,
  updateApprovalProcess,
  ApprovalProcess,
} from '../../../../services/approvalProcess';
import { CanvasPageTemplate, CANVAS_GRID_STYLE } from '../../../../components/layout-templates';

/**
 * 审批节点组件
 */
const ApprovalNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const isHorizontal = data?.layoutDirection === 'horizontal';
  const approvalType = data?.approvalType || 'OR';
  
  return (
    <div
      style={{
        padding: '10px 14px',
        background: '#fff',
        border: '1.5px solid #1890ff',
        borderRadius: '6px',
        minWidth: 180,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        transition: 'all 0.3s',
      }}
    >
      <Handle type="target" position={isHorizontal ? Position.Left : Position.Top} style={{ background: '#1890ff' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
        <span style={{ fontWeight: '600', fontSize: 14 }}>{data?.label || t('pages.approval.designer.label')}</span>
        <Tag color={approvalType === 'AND' ? 'orange' : 'blue'} style={{ marginRight: 0, fontSize: '10px', zoom: 0.85 }}>
          {approvalType === 'AND' ? t('pages.approval.designer.andSign') : t('pages.approval.designer.orSign')}
        </Tag>
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>
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
          <div style={{ marginTop: 4, padding: '2px 6px', background: '#f5f5f5', borderRadius: 4, fontSize: 10, color: '#999' }}>
            <ControlOutlined style={{ marginRight: 4 }} />
            {t('pages.approval.designer.hasConditions')}
          </div>
        )}
      </div>
      <Handle type="source" position={isHorizontal ? Position.Right : Position.Bottom} style={{ background: '#1890ff' }} />
    </div>
  );
};

/**
 * 抄送节点组件
 */
const CCNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const isHorizontal = data?.layoutDirection === 'horizontal';
  
  return (
    <div
      style={{
        padding: '10px 14px',
        background: '#fff',
        border: '1.5px solid #722ed1',
        borderRadius: '6px',
        minWidth: 180,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        transition: 'all 0.3s',
      }}
    >
      <Handle type="target" position={isHorizontal ? Position.Left : Position.Top} style={{ background: '#722ed1' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>
        <span style={{ fontWeight: '600', fontSize: 14, color: '#722ed1' }}>
          <SendOutlined style={{ marginRight: 6 }} />
          {data?.label || t('pages.approval.designer.ccNode')}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
           <span>{
            (data?.approverIds?.length || 0) + ' ' + t('pages.approval.designer.ccRecipients')
          }</span>
        </div>
      </div>
      <Handle type="source" position={isHorizontal ? Position.Right : Position.Bottom} style={{ background: '#722ed1' }} />
    </div>
  );
};

/**
 * 条件节点组件
 */
const ConditionNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const isHorizontal = data?.layoutDirection === 'horizontal';
  
  return (
    <div
      style={{
        padding: '8px 12px',
        background: '#fff',
        border: '1.5px dashed #faad14',
        borderRadius: '20px',
        minWidth: 140,
        textAlign: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        position: 'relative',
      }}
    >
      <Handle type="target" position={isHorizontal ? Position.Left : Position.Top} style={{ background: '#faad14' }} />
      <div style={{ color: '#faad14', fontWeight: '500', fontSize: 13 }}>
        <ForkOutlined style={{ marginRight: 6 }} />
        {data?.label || t('pages.approval.designer.conditionNode')}
      </div>
      {data?.conditions?.length > 0 && (
         <div style={{ fontSize: 10, color: '#999', marginTop: 4 }}>
           {data.conditions.length} {t('pages.approval.designer.addConditionNode').replace('增加', '')}
         </div>
      )}
      <Handle type="source" position={isHorizontal ? Position.Right : Position.Bottom} style={{ background: '#faad14' }} />
    </div>
  );
};

/**
 * 开始节点组件
 */
const StartNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const isHorizontal = data?.layoutDirection === 'horizontal';
  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#52c41a',
        color: '#fff',
        borderRadius: 8,
        minWidth: 100,
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      <Handle type="source" position={isHorizontal ? Position.Right : Position.Bottom} />
      {t('pages.approval.designer.start')}
    </div>
  );
};

/**
 * 结束节点组件
 */
const EndNode: React.FC<NodeProps> = ({ data }) => {
  const { t } = useTranslation();
  const isHorizontal = data?.layoutDirection === 'horizontal';
  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#ff4d4f',
        color: '#fff',
        borderRadius: 8,
        minWidth: 100,
        textAlign: 'center',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={isHorizontal ? Position.Left : Position.Top} />
      {t('pages.approval.designer.end')}
    </div>
  );
};

/**
 * 审批流程设计器页面组件
 */
const ApprovalProcessDesignerPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
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

  /**
   * 加载审批流程数据
   */
  useEffect(() => {
    if (processUuid) {
      loadProcessData();
    } else {
      messageApi.warning(t('pages.approval.designer.missingUuid'));
      navigate('/system/approval-processes');
    }
  }, [processUuid]);

  /**
   * 加载流程数据
   */
  const loadProcessData = async () => {
    if (!processUuid) return;

    try {
      setLoading(true);
      const data = await getApprovalProcessByUuid(processUuid);
      setProcessData(data);


      // 解析节点和边
      if (data.nodes && typeof data.nodes === 'object') {
        const nodesData = data.nodes.nodes || data.nodes;
        const edgesData = data.nodes.edges || [];

        let initialNodes: Node[] = [];
        if (Array.isArray(nodesData)) {
          initialNodes = nodesData as Node[];
        } else if (nodesData && typeof nodesData === 'object') {
          initialNodes = Object.values(nodesData) as Node[];
        } else {
          initialNodes = [
            {
              id: 'start',
              type: 'start',
              position: { x: 250, y: 50 },
              data: { label: t('pages.approval.designer.start') },
            },
            {
              id: 'end',
              type: 'end',
              position: { x: 250, y: 500 },
              data: { label: t('pages.approval.designer.end') },
            },
          ];
        }
        
        // 默认应用垂直布局标识，确保 handle 正确
        // 并且强制计算一次位置，确保 Start-End 垂直对齐
        if (initialNodes.length > 0) {
             const verticalNodes = computeVerticalLayout(initialNodes, (Array.isArray(edgesData) ? edgesData : []) as Edge[]);
             setNodes(verticalNodes as Node[]);
        } else {
             setNodes([]);
        }
        
        if (Array.isArray(edgesData)) {
          setEdges(edgesData as Edge[]);
        }
      } else {
        setNodes([
          {
            id: 'start',
            type: 'start',
            position: { x: 250, y: 50 },
            data: { label: t('pages.approval.designer.start'), layoutDirection: 'vertical' },
          },
          {
            id: 'end',
            type: 'end',
            position: { x: 250, y: 500 },
            data: { label: t('pages.approval.designer.end'), layoutDirection: 'vertical' },
          },
        ]);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.approval.designer.loadFailed'));
      navigate('/system/approval-processes');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 计算垂直布局
   */
  const computeVerticalLayout = (nodesToLayout: Node[], edgesToUse: Edge[]) => {
    // 强制排序：Start -> 中间节点（按添加顺序或旧Y轴） -> End
    // 为了更好的默认效果，我们先简单按类型排序，尽量线性化
    // TODO: 如果有复杂分支，这里应该用 BFS/Topological Sort
    
    // 1. 分离 Start, End, 和其他
    const startNode = nodesToLayout.find(n => n.type === 'start');
    const endNode = nodesToLayout.find(n => n.type === 'end');
    const otherNodes = nodesToLayout.filter(n => n.type !== 'start' && n.type !== 'end');
    
    // 2. 如果有边，尝试根据边来排序 otherNodes (简单链式)
    // 这种简单逻辑：如果 A->B，则 A 在 B 前。
    // 我们用一个简单的 visited SET 来构建链条
    const sortedOthers: Node[] = [];
    if (startNode) {
       let currentId = startNode.id;
       const remaining = new Set(otherNodes.map(n => n.id));
       
       // 简单的贪心遍历：找当前节点的下一个节点
       while (remaining.size > 0) {
         // 找以 currentId 为 source 的 edge
         const edge = edgesToUse.find(e => e.source === currentId && remaining.has(e.target));
         if (edge) {
            const nextNode = otherNodes.find(n => n.id === edge.target);
            if (nextNode) {
                sortedOthers.push(nextNode);
                remaining.delete(nextNode.id);
                currentId = nextNode.id;
            } else {
                break; // Should not happen if logic is correct
            }
         } else {
             // 如果没找到连线（或者是分支情况，或者是断开的），
             // 就把剩下的直接追加进去（因为无法通过简单链追溯）
             // 按照它们在数组中的原顺序
             otherNodes.forEach(n => {
                 if (remaining.has(n.id)) sortedOthers.push(n);
             });
             break;
         }
       }
    } else {
        // 没有 start 节点，直接用原始顺序
        sortedOthers.push(...otherNodes);
    }

    const simpleSorted = [
        ...(startNode ? [startNode] : []),
        ...sortedOthers,
        ...(endNode ? [endNode] : [])
    ];

    const centerX = 400;
    const spacing = 180;

    return simpleSorted.map((node, index) => ({
      ...node,
      data: { ...node.data, layoutDirection: 'vertical' },
      position: { x: centerX - 100, y: 50 + index * spacing }
    }));
  };

  /**
   * 自动布局切换
   */
  const handleLayout = (direction: 'horizontal' | 'vertical') => {
    const isVertical = direction === 'vertical';

    if (isVertical) {
        const layoutedNodes = computeVerticalLayout(nodes as Node[], edges as Edge[]);
        setNodes(layoutedNodes);
        messageApi.success(t('pages.approval.designer.verticalAlign'));
        return;
    }

    // Horizontal (Simple fallback)
    // 排序逻辑：开始 -> 其他 -> 结束
    const sortedNodes = [...nodes].sort((a, b) => {
      if (a.type === 'start') return -1;
      if (b.type === 'start') return 1;
      if (a.type === 'end') return 1;
      if (b.type === 'end') return -1;
      return 0;
    });

    const spacing = 250;
    const centerY = 150;

    const newNodes = sortedNodes.map((node, index) => ({
      ...node,
      data: { ...node.data, layoutDirection: 'horizontal' },
      position: { x: 100 + index * (spacing + 50), y: centerY },
    }));
    
    setNodes(newNodes);
    messageApi.success(t('pages.approval.designer.horizontalAlign'));
  };

  /**
   * 添加节点
   */
  /**
   * 添加节点
   */
  const handleAddNode = (type: 'approval' | 'cc' | 'condition' = 'approval') => {
    // 基础偏移
    const baseOffset = 150;
    const lastNode = nodes[nodes.length - 1];
    const currentDirection = lastNode?.data?.layoutDirection || 'vertical';
    
    // 找到当前 Y/X 坐标最大的节点，放到它后面
    const maxVal = nodes.reduce((max, node) => {
      const val = currentDirection === 'vertical' ? (node.position?.y ?? 0) : (node.position?.x ?? 0);
      return Math.max(max, val);
    }, 0);
    
    let label = t('pages.approval.designer.label');
    if (type === 'cc') label = t('pages.approval.designer.ccNode');
    if (type === 'condition') label = t('pages.approval.designer.conditionNode');

    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: type,
      position: currentDirection === 'vertical' 
        ? { x: 400, y: maxVal + baseOffset } 
        : { x: maxVal + baseOffset + 100, y: 150 },
      data: {
        label: label,
        approverType: 'user',
        approvalType: 'OR',
        approverIds: [],
        conditions: [],
        layoutDirection: currentDirection,
      },
    };
    setNodes([...nodes, newNode]);
  };

  /**
   * 删除节点
   */
  const handleDeleteNode = (nodeId: string) => {
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
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
   * 保存流程设计
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

  if (loading) {
    return <div style={{ padding: 16 }}>加载中...</div>;
  }

  if (!processData) {
    return <div style={{ padding: 16 }}>流程数据不存在</div>;
  }

  return (
    <CanvasPageTemplate
      style={{ height: 'calc(100vh - 110px)' }}
      toolbar={
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            {t('pages.approval.designer.save')}
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleCancel}>
            {t('pages.approval.designer.back')}
          </Button>
          <Space.Compact>
            <Button
              icon={<VerticalAlignBottomOutlined />}
              onClick={() => handleLayout('vertical')}
            >
              {t('pages.approval.designer.verticalAlign')}
            </Button>
            <Button
              icon={<ColumnWidthOutlined />}
              onClick={() => handleLayout('horizontal')}
            >
              {t('pages.approval.designer.horizontalAlign')}
            </Button>
          </Space.Compact>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleAddNode('approval')}
          >
            {t('pages.approval.designer.addNode')}
          </Button>
          <Button
            icon={<SendOutlined />}
            onClick={() => handleAddNode('cc')}
          >
            {t('pages.approval.designer.addCCNode')}
          </Button>
          <Button
            icon={<ForkOutlined />}
            onClick={() => handleAddNode('condition')}
          >
            {t('pages.approval.designer.addConditionNode')}
          </Button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: 13, color: '#666' }}>
              <strong>{t('pages.approval.designer.processName')}：</strong>{processData.name}
            </span>
            <span style={{ fontSize: 13, color: '#666' }}>
              <strong>{t('pages.approval.designer.processCode')}：</strong>{processData.code}
            </span>
          </div>
        </Space>
      }
      canvas={
        <div style={{ width: '100%', height: '100%', position: 'relative', ...CANVAS_GRID_STYLE }}>
          <ReactFlowProvider>
            <FlowStoreProvider>
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                 <FlowView
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  // @ts-ignore
                  snapToGrid={true}
                  // @ts-ignore
                  snapGrid={[15, 15]}
                  onNodeClick={(_event, node) => {
                    handleNodeConfig(node);
                  }}
                  onPaneClick={() => {
                    setSelectedNode(null);
                  }}
                  nodeTypes={nodeTypes}
                />
              </div>
            </FlowStoreProvider>
          </ReactFlowProvider>
        </div>
      }
      rightPanel={{
        title: selectedNode ? `${t('pages.approval.designer.nodeConfig')} - ${selectedNode.data?.label || ''}` : t('pages.approval.designer.nodeConfig'),
        children: selectedNode && (selectedNode.type === 'start' || selectedNode.type === 'end') ? (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>
            {selectedNode.type === 'start' ? t('pages.approval.designer.startNodeTitle') : t('pages.approval.designer.endNodeTitle')}
          </div>
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
            )}

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

            <Divider style={{ margin: '16px 0' }} />
            
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
                itemRender={({ listDom, action }) => (
                  <Card
                    size="small"
                    styles={{ body: { padding: 8 } }}
                    style={{ marginBottom: 8, background: '#fafafa' }}
                    extra={action}
                  >
                    {listDom}
                  </Card>
                )}
              >
                <ProFormGroup size={8}>
                  <ProFormSelect
                    name="field"
                    placeholder={t('pages.approval.designer.field')}
                    width="xs"
                    options={[
                      { value: 'amount', label: '审批金额' },
                      { value: 'department', label: '发起人部门' },
                      { value: 'urgent_level', label: '紧急程度' },
                      { value: 'custom', label: '自定义路径' },
                    ]}
                  />
                  <ProFormSelect
                    name="operator"
                    placeholder={t('pages.approval.designer.operator')}
                    width="xs"
                    options={[
                      { value: '==', label: '等于' },
                      { value: '!=', label: '不等于' },
                      { value: '>', label: '大于' },
                      { value: '<', label: '小于' },
                      { value: 'contains', label: '包含' },
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

            <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 16, paddingTop: 16 }}>
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

