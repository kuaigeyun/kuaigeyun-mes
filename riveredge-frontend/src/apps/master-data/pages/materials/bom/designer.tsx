/**
 * 工程BOM可视化设计器页面
 * 
 * 使用 ProFlow 可视化设计工程BOM结构。
 * 支持节点拖拽、连接线绘制、节点属性配置等功能。
 * 
 * Author: Luigi Lu
 * Date: 2026-01-16
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, message, Space, Drawer, Form, Input, Select, InputNumber, Switch, Tag } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { FlowView, FlowStoreProvider, useNodesState, useEdgesState } from '@ant-design/pro-flow';
import type { Node, Edge, NodeProps } from '@ant-design/pro-flow';
import { ReactFlowProvider, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import { bomApi, materialApi } from '../../../services/material';
import type { BOM, Material, BOMHierarchy, BOMHierarchyItem } from '../../../types/material';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { ProFormDigit, ProFormText, ProFormSwitch } from '@ant-design/pro-components';

const { TextArea } = Input;

/**
 * 物料节点组件
 */
const MaterialNode: React.FC<NodeProps> = ({ data }) => {
  const material = data?.material;
  const quantity = data?.quantity || 0;
  const unit = data?.unit || '';
  const wasteRate = data?.wasteRate || 0;
  const isRequired = data?.isRequired !== false;
  
  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#fff',
        border: `2px solid ${isRequired ? '#1890ff' : '#faad14'}`,
        borderRadius: 8,
        minWidth: 200,
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
        {material ? `${material.code} - ${material.name}` : '未选择物料'}
      </div>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
        数量: {quantity} {unit}
      </div>
      {wasteRate > 0 && (
        <div style={{ fontSize: 12, color: '#fa8c16' }}>
          损耗率: {wasteRate}%
        </div>
      )}
      {!isRequired && (
        <Tag color="orange" style={{ marginTop: 4, fontSize: 11 }}>可选</Tag>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

/**
 * 根物料节点组件（主物料）
 */
const RootMaterialNode: React.FC<NodeProps> = ({ data }) => {
  const material = data?.material;
  
  return (
    <div
      style={{
        padding: '12px 16px',
        background: '#52c41a',
        color: '#fff',
        borderRadius: 8,
        minWidth: 200,
        textAlign: 'center',
        cursor: 'pointer',
        fontWeight: 'bold',
      }}
    >
      <Handle type="source" position={Position.Bottom} />
      <div>{material ? `${material.code} - ${material.name}` : '主物料'}</div>
    </div>
  );
};

/**
 * BOM可视化设计器页面组件
 */
const BOMDesignerPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const materialId = searchParams.get('materialId');
  const version = searchParams.get('version');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rootMaterial, setRootMaterial] = useState<Material | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  
  // ProFlow 数据
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // 节点配置 Drawer
  const [nodeConfigVisible, setNodeConfigVisible] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeConfigForm] = Form.useForm();

  /**
   * 加载物料列表
   */
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setMaterialsLoading(true);
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result);
      } catch (error: any) {
        console.error('加载物料列表失败:', error);
      } finally {
        setMaterialsLoading(false);
      }
    };
    loadMaterials();
  }, []);

  /**
   * 加载 BOM 数据
   */
  useEffect(() => {
    if (materialId) {
      loadBOMData();
    } else {
      messageApi.warning('缺少物料ID参数');
      navigate('/apps/master-data/process/engineering-bom');
    }
  }, [materialId, version]);

  /**
   * 加载 BOM 数据
   */
  const loadBOMData = async () => {
    if (!materialId) return;
    
    try {
      setLoading(true);
      
      // 获取主物料信息
      const material = await materialApi.get(parseInt(materialId));
      setRootMaterial(material);
      
      // 获取BOM层级结构
      const hierarchy = await bomApi.getHierarchy(parseInt(materialId), version || undefined);
      
      // 转换为ProFlow节点和边
      const convertToNodesAndEdges = (
        items: BOMHierarchyItem[],
        parentNodeId: string,
        startY: number = 200,
        level: number = 0
      ): { nodes: Node[]; edges: Edge[]; nextY: number } => {
        let nodes: Node[] = [];
        let edges: Edge[] = [];
        let currentY = startY;
        const spacing = 150;
        
        items.forEach((item, index) => {
          const nodeId = `material_${item.componentId}_${item.level}_${index}`;
          const material = materials.find(m => m.id === item.componentId) || {
            id: item.componentId,
            code: item.componentCode,
            name: item.componentName,
          };
          
          const node: Node = {
            id: nodeId,
            type: 'material',
            position: { 
              x: 100 + level * 300, 
              y: currentY 
            },
            data: {
              material,
              quantity: item.quantity,
              unit: item.unit,
              wasteRate: item.wasteRate,
              isRequired: item.isRequired,
              componentId: item.componentId,
            },
          };
          
          nodes.push(node);
          
          // 添加边（连接父节点和子节点）
          if (parentNodeId) {
            edges.push({
              id: `edge_${parentNodeId}_${nodeId}`,
              source: parentNodeId,
              target: nodeId,
            });
          }
          
          // 递归处理子节点
          if (item.children && item.children.length > 0) {
            const childResult = convertToNodesAndEdges(
              item.children,
              nodeId,
              currentY,
              level + 1
            );
            nodes = nodes.concat(childResult.nodes);
            edges = edges.concat(childResult.edges);
            currentY = childResult.nextY;
          } else {
            currentY += spacing;
          }
        });
        
        return { nodes, edges, nextY: currentY };
      };
      
      // 创建根节点
      const rootNodeId = 'root';
      const rootNode: Node = {
        id: rootNodeId,
        type: 'root',
        position: { x: 100, y: 100 },
        data: {
          material,
        },
      };
      
      // 转换层级结构
      const { nodes: childNodes, edges: childEdges } = convertToNodesAndEdges(
        hierarchy.items || [],
        rootNodeId,
        200,
        1
      );
      
      setNodes([rootNode, ...childNodes]);
      setEdges(childEdges);
    } catch (error: any) {
      messageApi.error(error.message || '加载BOM数据失败');
      navigate('/apps/master-data/process/engineering-bom');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 添加物料节点
   */
  const handleAddMaterialNode = () => {
    const newNode: Node = {
      id: `material_${Date.now()}`,
      type: 'material',
      position: { x: 400, y: 200 + nodes.length * 150 },
      data: {
        material: null,
        quantity: 1,
        unit: '',
        wasteRate: 0,
        isRequired: true,
        componentId: null,
      },
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode);
    setNodeConfigVisible(true);
    nodeConfigForm.resetFields();
    nodeConfigForm.setFieldsValue({
      quantity: 1,
      wasteRate: 0,
      isRequired: true,
    });
  };

  /**
   * 删除节点
   */
  const handleDeleteNode = (nodeId: string) => {
    // 不允许删除根节点
    if (nodeId === 'root') {
      messageApi.warning('不能删除根节点（主物料）');
      return;
    }
    setNodes(nodes.filter((n) => n.id !== nodeId));
    setEdges(edges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    messageApi.success('节点已删除');
  };

  /**
   * 打开节点配置
   */
  const handleNodeConfig = (node: Node) => {
    setSelectedNode(node);
    setNodeConfigVisible(true);
    const material = node.data?.material;
    nodeConfigForm.setFieldsValue({
      materialId: material?.id || null,
      quantity: node.data?.quantity || 1,
      unit: node.data?.unit || '',
      wasteRate: node.data?.wasteRate || 0,
      isRequired: node.data?.isRequired !== false,
    });
  };

  /**
   * 保存节点配置
   */
  const handleSaveNodeConfig = () => {
    nodeConfigForm.validateFields().then((values) => {
      if (selectedNode) {
        const material = materials.find(m => m.id === values.materialId);
        
        const updatedNodes = nodes.map((node) => {
          if (node.id === selectedNode.id) {
            return {
              ...node,
              data: {
                ...node.data,
                material,
                quantity: values.quantity,
                unit: values.unit,
                wasteRate: values.wasteRate || 0,
                isRequired: values.isRequired !== false,
                componentId: values.materialId,
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
   * 保存BOM设计
   */
  const handleSave = async () => {
    if (!materialId || !rootMaterial) return;
    
    try {
      setSaving(true);
      
      // 从节点和边构建BOM数据
      // 找到所有非根节点的物料节点
      const materialNodes = nodes.filter(n => n.type === 'material' && n.data?.componentId);
      
      if (materialNodes.length === 0) {
        messageApi.warning('请至少添加一个子物料');
        return;
      }
      
      // 构建批量导入数据
      const items = materialNodes.map((node) => {
        const material = node.data?.material;
        if (!material) {
          throw new Error(`节点 ${node.id} 未选择物料`);
        }
        
        // 找到父节点（通过边查找）
        const parentEdge = edges.find(e => e.target === node.id);
        const parentNode = parentEdge ? nodes.find(n => n.id === parentEdge.source) : null;
        const parentMaterial = parentNode?.data?.material || rootMaterial;
        
        return {
          parentCode: parentMaterial.code,
          componentCode: material.code,
          quantity: node.data?.quantity || 1,
          unit: node.data?.unit || undefined,
          wasteRate: node.data?.wasteRate || undefined,
          isRequired: node.data?.isRequired !== false,
        };
      });
      
      // 调用批量导入API
      await bomApi.batchImport({
        items,
        version: version || '1.0',
      });
      
      messageApi.success('BOM设计已保存');
      // 重新加载数据
      await loadBOMData();
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
    navigate('/apps/master-data/materials/bom');
  };

  /**
   * 节点类型配置
   */
  const nodeTypes = useMemo(() => ({
    material: MaterialNode,
    root: RootMaterialNode,
  }), []);

  if (loading) {
    return <div style={{ padding: 16 }}>加载中...</div>;
  }

  if (!rootMaterial) {
    return <div style={{ padding: 16 }}>物料数据不存在</div>;
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
            onClick={handleAddMaterialNode}
          >
            添加子物料
          </Button>
          {selectedNode && selectedNode.id !== 'root' && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteNode(selectedNode.id)}
            >
              删除节点
            </Button>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ marginRight: 8 }}>主物料：{rootMaterial.code} - {rootMaterial.name}</span>
            {version && <span>版本：{version}</span>}
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
                  onConnect={(params) => {
                    // 允许手动连接节点（建立父子关系）
                    setEdges([...edges, { id: `edge_${params.source}_${params.target}`, ...params }]);
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
        title={selectedNode?.id === 'root' ? '主物料信息' : '物料节点配置'}
        open={nodeConfigVisible}
        onClose={() => {
          setNodeConfigVisible(false);
        }}
        size={600}
        footer={
          <Space>
            <Button onClick={() => {
              setNodeConfigVisible(false);
            }}>
              取消
            </Button>
            {selectedNode?.id !== 'root' && (
              <Button type="primary" onClick={handleSaveNodeConfig}>
                保存
              </Button>
            )}
          </Space>
        }
      >
        {selectedNode?.id === 'root' ? (
          <div>
            <p><strong>物料编码：</strong>{rootMaterial.code}</p>
            <p><strong>物料名称：</strong>{rootMaterial.name}</p>
            <p style={{ color: '#999', fontSize: 12, marginTop: 16 }}>
              主物料信息不可修改，如需修改请返回物料管理页面
            </p>
          </div>
        ) : (
          <Form form={nodeConfigForm} layout="vertical">
            <Form.Item
              name="materialId"
              label="选择物料"
              rules={[{ required: true, message: '请选择物料' }]}
            >
              <Select
                placeholder="请选择物料"
                showSearch
                loading={materialsLoading}
                filterOption={(input, option) => {
                  const label = option?.label as string || '';
                  return label.toLowerCase().includes(input.toLowerCase());
                }}
                options={materials.map(m => ({
                  label: `${m.code} - ${m.name}`,
                  value: m.id,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="quantity"
              label="数量"
              rules={[
                { required: true, message: '请输入数量' },
                { type: 'number', min: 0.0001, message: '数量必须大于0' },
              ]}
            >
              <InputNumber
                placeholder="请输入数量"
                precision={4}
                style={{ width: '100%' }}
                min={0.0001}
              />
            </Form.Item>
            <Form.Item
              name="unit"
              label="单位"
            >
              <Input placeholder="请输入单位（如：个、kg、m等）" maxLength={20} />
            </Form.Item>
            <Form.Item
              name="wasteRate"
              label="损耗率（%）"
              rules={[
                { type: 'number', min: 0, max: 100, message: '损耗率必须在0-100之间' },
              ]}
            >
              <InputNumber
                placeholder="请输入损耗率（如：5表示5%）"
                precision={2}
                style={{ width: '100%' }}
                min={0}
                max={100}
              />
            </Form.Item>
            <Form.Item
              name="isRequired"
              label="是否必选"
              valuePropName="checked"
            >
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </Form>
        )}
      </Drawer>
    </div>
  );
};

export default BOMDesignerPage;
