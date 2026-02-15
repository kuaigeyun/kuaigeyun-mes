/**
 * 标准操作SOP可视化编辑器页面
 * 
 * 使用 ProFlow 可视化设计标准操作SOP流程。
 * 支持节点拖拽、连接线绘制、节点属性配置等功能。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, message, Space, Drawer, Form, Input } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { App } from 'antd';

const { TextArea } = Input;
import { FlowView, FlowStoreProvider, useNodesState, useEdgesState } from '@ant-design/pro-flow';
import type { Node, Edge, NodeProps } from '@ant-design/pro-flow';
import { ReactFlowProvider, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { sopApi } from '../../../services/process';
import type { SOP } from '../../../types/process';
import { CANVAS_GRID_STYLE } from '../../../../../components/layout-templates';
import FormSchemaEditor from './FormSchemaEditor';
import type { ISchema } from '@formily/core';

/**
 * 作业步骤节点组件
 */
const StepNode: React.FC<NodeProps> = ({ data }) => {
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
        {data?.label || '作业步骤'}
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>
        {data?.description || '步骤描述'}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

/**
 * 检查节点组件
 */
const CheckNode: React.FC<NodeProps> = ({ data }) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#fff',
        border: '2px solid #faad14',
        borderRadius: 8,
        minWidth: 150,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
        {data?.label || '检查节点'}
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>
        {data?.description || '检查描述'}
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
 * eSOP 可视化编辑器页面组件
 */
const ESOPDesignerPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sopUuid = searchParams.get('uuid');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sopData, setSopData] = useState<SOP | null>(null);
  
  // ProFlow 数据
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // 节点配置 Drawer
  const [nodeConfigVisible, setNodeConfigVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeConfigForm] = Form.useForm();
  const [formSchema, setFormSchema] = useState<ISchema | null>(null);

  /**
   * 加载 SOP 数据
   */
  useEffect(() => {
    if (sopUuid) {
      loadSOPData();
    } else {
      messageApi.warning('缺少SOP UUID参数');
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
      
      // 解析流程配置
      let nodesData: Node[] = [];
      let edgesData: Edge[] = [];
      
      if (data.flowConfig && typeof data.flowConfig === 'object') {
        nodesData = data.flowConfig.nodes || [];
        edgesData = data.flowConfig.edges || [];
      }
      
      // 如果没有节点数据，添加默认的开始和结束节点
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
      }
      
      // 解析表单配置并合并到节点数据中
      if (data.formConfig && typeof data.formConfig === 'object') {
        // formConfig 格式: { nodeId: schema, ... }
        nodesData = nodesData.map((node) => {
          const nodeId = node.id;
          if (data.formConfig[nodeId]) {
            return {
              ...node,
              data: {
                ...node.data,
                formSchema: data.formConfig[nodeId],
              },
            };
          }
          return node;
        });
      }
      
      setNodes(nodesData);
      if (Array.isArray(edgesData)) {
        setEdges(edgesData);
      }
    } catch (error: any) {
      messageApi.error(error.message || '加载SOP数据失败');
      navigate('/apps/master-data/process/sop');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 添加作业步骤节点
   */
  const handleAddStepNode = () => {
    const newNode: Node = {
      id: `step_${Date.now()}`,
      type: 'step',
      position: { x: 100 + nodes.length * 200, y: 200 },
      data: {
        label: '作业步骤',
        description: '',
        formSchema: null, // 表单配置将在节点配置中设置
      },
    };
    setNodes([...nodes, newNode]);
  };

  /**
   * 添加检查节点
   */
  const handleAddCheckNode = () => {
    const newNode: Node = {
      id: `check_${Date.now()}`,
      type: 'check',
      position: { x: 100 + nodes.length * 200, y: 200 },
      data: {
        label: '检查节点',
        description: '',
        formSchema: null, // 表单配置将在节点配置中设置
      },
    };
    setNodes([...nodes, newNode]);
  };

  /**
   * 删除节点
   */
  const handleDeleteNode = (nodeId: string) => {
    // 不允许删除开始和结束节点
    if (nodeId === 'start' || nodeId === 'end') {
      messageApi.warning('不能删除开始或结束节点');
      return;
    }
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
      description: node.data?.description || '',
    });
    
    // 加载节点的表单配置
    if (node.data?.formSchema) {
      setFormSchema(node.data.formSchema as ISchema);
    } else {
      setFormSchema(null);
    }
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
                formSchema: formSchema || null, // 保存表单配置
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
    if (!sopUuid || !sopData) return;
    
    try {
      setSaving(true);
      
      // 构建流程配置
      const flowConfig = {
        nodes,
        edges,
      };
      
      // 构建表单配置（按节点ID存储）
      const formConfig: Record<string, ISchema> = {};
      nodes.forEach((node) => {
        if (node.data?.formSchema && (node.type === 'step' || node.type === 'check')) {
          formConfig[node.id] = node.data.formSchema as ISchema;
        }
      });
      
      // 更新 SOP
      await sopApi.update(sopUuid, {
        flowConfig,
        formConfig: Object.keys(formConfig).length > 0 ? formConfig : null,
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
    navigate('/apps/master-data/process/sop');
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
            onClick={handleAddStepNode}
          >
            添加作业步骤
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={handleAddCheckNode}
          >
            添加检查节点
          </Button>
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ marginRight: 8 }}>SOP名称：{sopData.name}</span>
            <span>SOP编码：{sopData.code}</span>
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
              <div style={{ width: '100%', height: '100%', position: 'relative', ...CANVAS_GRID_STYLE }}>
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
        onClose={() => {
          setNodeConfigVisible(false);
          setFormSchema(null);
        }}
        size={800}
        footer={
          <Space>
            <Button onClick={() => {
              setNodeConfigVisible(false);
              setFormSchema(null);
            }}>
              取消
            </Button>
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
            name="description"
            label="节点描述"
          >
            <TextArea rows={4} placeholder="请输入节点描述" />
          </Form.Item>
        </Form>
        
        {/* 表单配置（仅对步骤节点和检查节点显示） */}
        {selectedNode && (selectedNode.type === 'step' || selectedNode.type === 'check') && (
          <div style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
              <strong>表单配置</strong>
              <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                为当前节点配置表单字段，这些字段将在执行该步骤时显示给用户填写
              </div>
            </div>
            <FormSchemaEditor
              value={formSchema || undefined}
              onChange={(schema) => {
                setFormSchema(schema);
              }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ESOPDesignerPage;

