/**
 * 审批流程设计器页面
 * 
 * 使用 ProFlow 可视化设计审批流程。
 * 支持节点拖拽、连接线绘制、节点属性配置等功能。
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, message, Space, Drawer, Form, Input, Select, InputNumber, Switch } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { FlowView, FlowStoreProvider, useNodesState, useEdgesState } from '@ant-design/pro-flow';
import type { Node, Edge, NodeProps } from '@ant-design/pro-flow';
import { ReactFlowProvider, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  getApprovalProcessByUuid,
  updateApprovalProcess,
  ApprovalProcess,
} from '../../../../services/approvalProcess';

const { TextArea } = Input;

/**
 * 审批节点组件
 */
const ApprovalNode: React.FC<NodeProps> = ({ data }) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#fff',
        border: '2px solid #1890ff',
        borderRadius: 8,
        minWidth: 150,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
        {data?.label || '审批节点'}
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>
        {data?.approverType === 'user' ? '用户审批' : '角色审批'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

/**
 * 开始节点组件
 */
const StartNode: React.FC<NodeProps> = () => {
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
      <Handle type="source" position={Position.Bottom} />
      开始
    </div>
  );
};

/**
 * 结束节点组件
 */
const EndNode: React.FC<NodeProps> = () => {
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
      <Handle type="target" position={Position.Top} />
      结束
    </div>
  );
};

/**
 * 审批流程设计器页面组件
 */
const ApprovalProcessDesignerPage: React.FC = () => {
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
  
  // 节点配置 Drawer
  const [nodeConfigVisible, setNodeConfigVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeConfigForm] = Form.useForm();

  /**
   * 加载审批流程数据
   */
  useEffect(() => {
    if (processUuid) {
      loadProcessData();
    } else {
      messageApi.warning('缺少流程UUID参数');
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
        
        if (Array.isArray(nodesData)) {
          setNodes(nodesData as Node[]);
        } else if (nodesData && typeof nodesData === 'object') {
          // 如果是对象，尝试转换为数组
          setNodes(Object.values(nodesData) as Node[]);
        } else {
          // 默认添加开始和结束节点
          setNodes([
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
          ]);
        }
        
        if (Array.isArray(edgesData)) {
          setEdges(edgesData as Edge[]);
        }
      } else {
        // 默认添加开始和结束节点
        setNodes([
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
        ]);
      }
    } catch (error: any) {
      messageApi.error(error.message || '加载流程数据失败');
      navigate('/system/approval-processes');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 添加节点
   */
  const handleAddNode = () => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: 'approval',
      position: { x: 100 + nodes.length * 200, y: 100 },
      data: {
        label: '审批节点',
        approverType: 'user',
        approverId: undefined,
        condition: undefined,
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

  /**
   * 打开节点配置
   */
  const handleNodeConfig = (node: Node) => {
    setSelectedNode(node);
    setNodeConfigVisible(true);
    nodeConfigForm.setFieldsValue({
      label: node.data?.label || '',
      approverType: node.data?.approverType || 'user',
      approverId: node.data?.approverId,
      condition: node.data?.condition,
    });
  };

  /**
   * 保存节点配置
   */
  const handleSaveNodeConfig = () => {
    nodeConfigForm.validateFields().then((values) => {
      if (selectedNode) {
        const updatedNodes = nodes.map((node) => {
          if (node.id === selectedNode.id) {
            return {
              ...node,
              data: {
                ...node.data,
                ...values,
              },
            };
          }
          return node;
        });
        setNodes(updatedNodes);
        setNodeConfigVisible(false);
        messageApi.success('节点配置已保存');
      }
    });
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
      
      messageApi.success('流程设计已保存');
    } catch (error: any) {
      messageApi.error(error.message || '保存失败');
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
    <div style={{ height: 'calc(100vh - 96px)', display: 'flex', flexDirection: 'column' }}>
      {/* 工具栏 */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: '12px 16px' } }}
      >
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            保存
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleCancel}>
            返回
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={handleAddNode}
          >
            添加节点
          </Button>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ marginRight: 8 }}>流程名称：{processData.name}</span>
            <span>流程代码：{processData.code}</span>
          </div>
        </Space>
      </Card>

      {/* ProFlow 画布 */}
      <Card 
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
      >
        <div style={{ width: '100%', height: '100%', flex: 1, minHeight: 600 }}>
          <ReactFlowProvider>
            <FlowStoreProvider>
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <FlowView
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={(event, node) => {
                    handleNodeConfig(node);
                  }}
                  nodeTypes={nodeTypes}
                />
              </div>
            </FlowStoreProvider>
          </ReactFlowProvider>
        </div>
      </Card>

      {/* 节点配置 Drawer */}
      <Drawer
        title="节点配置"
        open={nodeConfigVisible}
        onClose={() => setNodeConfigVisible(false)}
        size={400}
        footer={
          <Space>
            <Button onClick={() => setNodeConfigVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleSaveNodeConfig}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={nodeConfigForm} layout="vertical">
          <Form.Item
            name="label"
            label="节点名称"
            rules={[{ required: true, message: '请输入节点名称' }]}
          >
            <Input placeholder="请输入节点名称" />
          </Form.Item>
          <Form.Item
            name="approverType"
            label="审批人类型"
            rules={[{ required: true, message: '请选择审批人类型' }]}
          >
            <Select>
              <Select.Option value="user">指定用户</Select.Option>
              <Select.Option value="role">指定角色</Select.Option>
              <Select.Option value="department">部门负责人</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="approverId"
            label="审批人ID"
          >
            <InputNumber style={{ width: '100%' }} placeholder="请输入审批人ID" />
          </Form.Item>
          <Form.Item
            name="condition"
            label="审批条件（JSON）"
          >
            <TextArea rows={4} placeholder='{"key": "value"}' />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default ApprovalProcessDesignerPage;

