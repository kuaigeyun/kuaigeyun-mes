/**
 * 工程BOM可视化设计器页面
 * 
 * 使用 Ant Design Charts MindMap 可视化设计工程BOM结构。
 * 支持节点点击、添加、删除、配置等功能。
 * 
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button, Space, Form, Input, Select, InputNumber, Switch } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { MindMap, RCNode } from '@ant-design/graphs';
import type { MindMapData } from '@ant-design/graphs';

const { TextNode } = RCNode;

const DEFAULT_EXPAND_LEVEL = 5;

/** 节点固定宽度（文本在此宽度内换行），与 getVGap/getHGap 匹配使布局更自然 */
const NODE_WIDTH = 168;
/** 同级节点垂直间距，加大以缓解二级节点（如定子下硅钢片/漆包线、转子与外壳之间）拥挤 */
const NODE_V_GAP = 24;
/** 层级间水平间距 */
const NODE_H_GAP = 128;

import { bomApi, materialApi } from '../../../services/material';
import type { BOM, Material, BOMHierarchy, BOMHierarchyItem } from '../../../types/material';
import SafeProFormSelect from '../../../../../components/safe-pro-form-select';
import { CanvasPageTemplate, PAGE_SPACING } from '../../../../../components/layout-templates';

const { TextArea } = Input;

/** 画布内的 MindMap：仅当 config 引用变化时重渲染，避免选中节点触发整图 setOptions+render */
const MemoizedMindMap = memo((props: { config: Record<string, unknown> | null }) => {
  const { config } = props;
  if (!config) return null;
  return <MindMap {...(config as any)} />;
});
MemoizedMindMap.displayName = 'MemoizedMindMap';

// MindMap 树形数据节点类型
interface MindMapNode {
  id: string;
  value: string;
  material?: Material;
  quantity?: number;
  unit?: string;
  wasteRate?: number;
  isRequired?: boolean;
  componentId?: number;
  children?: MindMapNode[];
  [key: string]: any;
}

/**
 * BOM可视化设计器页面组件
 */
const BOMDesignerPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const materialId = searchParams.get('materialId');
  const version = searchParams.get('version');
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rootMaterial, setRootMaterial] = useState<Material | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  
  // MindMap 数据
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeConfigForm] = Form.useForm();
  
  // 使用ref保存数据，用于操作
  const mindMapDataRef = useRef<MindMapData | null>(null);
  const mindMapInstanceRef = useRef<any>(null);
  const handleNodeSelectRef = useRef<(id: string) => void>(() => {});
  const selectedIdInGraphRef = useRef<string | null>(null); // 与图内选中状态同步，用于 setElementState 时清除上一节点
  
  useEffect(() => {
    mindMapDataRef.current = mindMapData;
  }, [mindMapData]);

  /**
   * 将 BOM 层级数据转换为 MindMap 树形数据
   * 节点 id 使用路径（path）保证唯一：同一物料在多处出现时不会重复（如硅钢片在定子/转子下各出现一次）
   */
  const convertToMindMapData = useCallback((
    rootMaterial: Material,
    items: BOMHierarchyItem[]
  ): MindMapData => {
    const convertItem = (item: BOMHierarchyItem, path: number[]): MindMapNode => {
      const material = materials.find(m => m.id === item.componentId) || {
        id: item.componentId,
        code: item.componentCode,
        name: item.componentName,
      };
      const pathKey = path.join('-');
      
      const node: MindMapNode = {
        id: `material_${item.componentId}_${pathKey}`,
        value: `${material.code} - ${material.name}`,
        material,
        quantity: item.quantity,
        unit: item.unit,
        wasteRate: item.wasteRate,
        isRequired: item.isRequired,
        componentId: item.componentId,
      };
      
      if (item.children && item.children.length > 0) {
        node.children = item.children.map((child, index) =>
          convertItem(child, [...path, index])
        );
      }
      
      return node;
    };
    
    const rootNode: MindMapNode = {
      id: 'root',
      value: `${rootMaterial.code} - ${rootMaterial.name}`,
      material: rootMaterial,
      children: items.map((item, index) => convertItem(item, [index])),
    };
    
    return rootNode;
  }, [materials]);

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
  const loadBOMData = async () => {
    if (!materialId) return;
    
    try {
      setLoading(true);
      
      // 通过物料列表查找主物料（materialId是数字ID）
      const materialIdNum = parseInt(materialId);
      let material = materials.find(m => m.id === materialIdNum);
      
      // 如果物料列表中找不到，尝试通过API获取
      if (!material) {
        const allMaterials = await materialApi.list({ limit: 10000, isActive: true });
        material = allMaterials.find(m => m.id === materialIdNum);
      }
      
      if (!material) {
        messageApi.error('找不到指定的物料');
        navigate('/apps/master-data/process/engineering-bom', { state: { closeTab: location.pathname + (location.search || '') } });
        return;
      }
      
      setRootMaterial(material);
      
      // 获取BOM层级结构
      const hierarchy = await bomApi.getHierarchy(materialIdNum, version || undefined);
      
      // 转换为 MindMap 数据
      const data = convertToMindMapData(material, hierarchy.items || []);
      setMindMapData(data);
      
      console.log('BOM设计器 - 加载完成:', {
        rootMaterial: material,
        hierarchyItems: hierarchy.items?.length || 0,
        mindMapData: data,
      });
    } catch (error: any) {
      console.error('BOM设计器 - 加载失败:', error);
      messageApi.error(error.message || '加载BOM数据失败');
      // 即使加载失败，也显示根节点
      if (rootMaterial) {
        const data: MindMapData = {
          id: 'root',
          value: `${rootMaterial.code} - ${rootMaterial.name}`,
          material: rootMaterial,
        };
        setMindMapData(data);
      } else {
        navigate('/apps/master-data/process/engineering-bom', { state: { closeTab: location.pathname + (location.search || '') } });
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载 BOM 数据
   */
  useEffect(() => {
    if (materialId && materials.length > 0) {
      loadBOMData();
    } else if (materialId) {
      // 等待物料列表加载完成
      const timer = setTimeout(() => {
        if (materials.length > 0) {
          loadBOMData();
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      messageApi.warning('缺少物料ID参数');
      navigate('/apps/master-data/process/engineering-bom', { state: { closeTab: location.pathname + (location.search || '') } });
    }
  }, [materialId, version, materials, convertToMindMapData]);

  /**
   * 查找节点（递归）
   */
  const findNode = useCallback((data: MindMapData, nodeId: string): MindMapNode | null => {
    if (data.id === nodeId) {
      return data as MindMapNode;
    }
    if (data.children) {
      for (const child of data.children) {
        const found = findNode(child, nodeId);
        if (found) return found;
      }
    }
    return null;
  }, []);

  /**
   * 更新节点（递归）
   */
  const updateNode = useCallback((data: MindMapData, nodeId: string, updater: (node: MindMapNode) => MindMapNode): MindMapData | null => {
    if (data.id === nodeId) {
      return updater(data as MindMapNode);
    }
    if (data.children) {
      const updatedChildren = data.children
        .map(child => updateNode(child, nodeId, updater))
        .filter(Boolean) as MindMapNode[];
      return {
        ...data,
        children: updatedChildren,
      };
    }
    return data;
  }, []);

  /**
   * 删除节点（递归）
   */
  const removeNode = useCallback((data: MindMapData, nodeId: string): MindMapData | null => {
    if (data.id === nodeId) {
      return null; // 不允许删除根节点
    }
    if (data.children) {
      const filteredChildren = data.children
        .filter(child => child.id !== nodeId)
        .map(child => removeNode(child, nodeId))
        .filter(Boolean) as MindMapNode[];
      return {
        ...data,
        children: filteredChildren,
      };
    }
    return data;
  }, []);

  /**
   * 添加子节点
   */
  const handleAddChildNode = useCallback((parentNodeId: string) => {
    if (!mindMapDataRef.current) return;
    
    const newNode: MindMapNode = {
      id: `material_new_${Date.now()}`,
      value: '未选择物料',
      quantity: 1,
      unit: '',
      wasteRate: 0,
      isRequired: true,
    };
    
    const updated = updateNode(mindMapDataRef.current, parentNodeId, (node) => {
      return {
        ...node,
        children: [...(node.children || []), newNode],
      };
    });
    
    if (updated) {
      setMindMapData(updated);
      setSelectedNodeId(parentNodeId); // 保持父节点选中，方便连续「添加子节点」时都挂在同一父下，而不都连到刚加的那一个
      nodeConfigForm.resetFields();
      nodeConfigForm.setFieldsValue({
        quantity: 1,
        wasteRate: 0,
        isRequired: true,
      });
    }
  }, [updateNode, nodeConfigForm]);

  /**
   * 添加同级节点
   */
  const handleAddSiblingNode = useCallback((siblingNodeId: string) => {
    if (!mindMapDataRef.current || !selectedNodeId) return;
    
    // 找到父节点
    const findParent = (data: MindMapData, targetId: string): MindMapData | null => {
      if (data.children) {
        if (data.children.some(child => child.id === targetId)) {
          return data;
        }
        for (const child of data.children) {
          const parent = findParent(child, targetId);
          if (parent) return parent;
        }
      }
      return null;
    };
    
    const parent = findParent(mindMapDataRef.current, siblingNodeId);
    if (!parent) {
      // 如果没有父节点，添加到根节点
      handleAddChildNode('root');
      return;
    }
    
    const newNode: MindMapNode = {
      id: `material_new_${Date.now()}`,
      value: '未选择物料',
      quantity: 1,
      unit: '',
      wasteRate: 0,
      isRequired: true,
    };
    
    const updated = updateNode(mindMapDataRef.current, parent.id, (node) => {
      return {
        ...node,
        children: [...(node.children || []), newNode],
      };
    });
    
    if (updated) {
      setMindMapData(updated);
      setSelectedNodeId(parent.id); // 保持父节点选中，连续添加时都在同一父下增加兄弟
      nodeConfigForm.resetFields();
      nodeConfigForm.setFieldsValue({
        quantity: 1,
        wasteRate: 0,
        isRequired: true,
      });
    }
  }, [selectedNodeId, updateNode, handleAddChildNode, nodeConfigForm]);

  /**
   * 删除节点
   */
  const handleDeleteNode = useCallback((nodeId: string) => {
    if (nodeId === 'root') {
      messageApi.warning('不能删除根节点（主物料）');
      return;
    }
    
    if (!mindMapDataRef.current) return;
    
    const updated = removeNode(mindMapDataRef.current, nodeId);
    if (updated) {
      setMindMapData(updated);
      setSelectedNodeId(null);
      messageApi.success('节点已删除');
    }
  }, [removeNode, messageApi]);

  /**
   * 选择节点
   */
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    if (mindMapDataRef.current) {
      const node = findNode(mindMapDataRef.current, nodeId);
      if (node) {
        nodeConfigForm.setFieldsValue({
          materialId: node.material?.id || null,
          quantity: node.quantity || 1,
          unit: node.unit || '',
          wasteRate: node.wasteRate || 0,
          isRequired: node.isRequired !== false,
        });
      }
    }
  }, [findNode, nodeConfigForm]);

  useEffect(() => {
    handleNodeSelectRef.current = handleNodeSelect;
  }, [handleNodeSelect]);

  /**
   * 保存节点配置
   */
  const handleSaveNodeConfig = () => {
    if (!selectedNodeId || !mindMapDataRef.current) return;
    
    nodeConfigForm.validateFields().then((values) => {
      const material = materials.find(m => m.id === values.materialId);
      
      const updated = updateNode(mindMapDataRef.current!, selectedNodeId, (node) => {
        return {
          ...node,
          value: material ? `${material.code} - ${material.name}` : '未选择物料',
          material,
          quantity: values.quantity,
          unit: values.unit,
          wasteRate: values.wasteRate || 0,
          isRequired: values.isRequired !== false,
          componentId: values.materialId,
        };
      });
      
      if (updated) {
        setMindMapData(updated);
        messageApi.success('节点配置已保存');
      }
    });
  };

  /**
   * 将 MindMap 数据转换为 BOM 批量导入格式
   */
  const convertMindMapToBOMItems = useCallback((data: MindMapData, parentMaterial: Material): any[] => {
    const items: any[] = [];
    
    if (data.children) {
      data.children.forEach((child) => {
        if (child.material && child.componentId) {
          items.push({
            parentCode: parentMaterial.code,
            componentCode: child.material.code,
            quantity: child.quantity || 1,
            unit: child.unit || undefined,
            wasteRate: child.wasteRate || undefined,
            isRequired: child.isRequired !== false,
          });
          
          // 递归处理子节点
          if (child.children && child.children.length > 0) {
            items.push(...convertMindMapToBOMItems(child, child.material!));
          }
        }
      });
    }
    
    return items;
  }, []);

  /**
   * 保存BOM设计
   */
  const handleSave = async () => {
    if (!materialId || !rootMaterial || !mindMapData) return;
    
    try {
      setSaving(true);
      
      // 转换为批量导入数据
      const items = convertMindMapToBOMItems(mindMapData, rootMaterial);
      
      if (items.length === 0) {
        messageApi.warning('请至少添加一个子物料');
        return;
      }
      
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
    navigate('/apps/master-data/process/engineering-bom', { state: { closeTab: location.pathname + (location.search || '') } });
  };

  /**
   * 键盘事件处理
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 如果正在输入，不处理快捷键
      const activeElement = document.activeElement;
      if (
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      // Enter键：添加同级物料
      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        if (selectedNodeId) {
          handleAddSiblingNode(selectedNodeId);
        }
        return;
      }

      // TAB键：添加子物料
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        if (selectedNodeId) {
          handleAddChildNode(selectedNodeId);
        } else if (mindMapData) {
          handleAddChildNode('root');
        }
        return;
      }

      // Delete键：删除节点
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId && selectedNodeId !== 'root') {
        event.preventDefault();
        event.stopPropagation();
        handleDeleteNode(selectedNodeId);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNodeId, handleAddSiblingNode, handleAddChildNode, handleDeleteNode, mindMapData]);

  // 获取选中的节点
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !mindMapData) return null;
    return findNode(mindMapData, selectedNodeId);
  }, [selectedNodeId, mindMapData, findNode]);

  // 供 MindMap 使用的纯净树数据（id/value/children），子节点 value 含用量
  const mindMapDataSafe = useMemo(() => {
    if (!mindMapData) return null;
    const strip = (n: MindMapNode): { id: string; value: string; children?: any[] } => {
      const base = typeof n.value === 'string' ? n.value : String(n.id);
      const value = n.id === 'root'
        ? base
        : `${base} × ${n.quantity ?? 1}`;
      const out: { id: string; value: string; children?: any[] } = { id: n.id, value };
      if (n.children?.length) {
        out.children = n.children.map(strip);
      }
      return out;
    };
    return strip(mindMapData as MindMapNode);
  }, [mindMapData]);

  // MindMap 配置：固定节点宽度 + 换行，与间距匹配使布局自然
  const mindMapConfig = useMemo(() => {
    if (!mindMapDataSafe) return null;
    return {
      data: mindMapDataSafe,
      direction: 'right' as const,
      type: 'boxed' as const,
      nodeMinWidth: NODE_WIDTH,
      nodeMaxWidth: NODE_WIDTH,
      defaultExpandLevel: DEFAULT_EXPAND_LEVEL,
      theme: 'dark' as const,
      labelField: (d: { id?: string; value?: string; data?: { value?: string } }) => {
        const v = (d as any).value ?? (d.data && (d.data as any).value);
        return v != null && String(v).trim() !== '' ? String(v) : (d.id ?? '');
      },
      node: {
        style: {
          component: (data: any) => {
            const depth = data.depth ?? 0;
            const color = data.style?.color ?? '#99ADD1';
            const label = (() => {
              const v = data.value ?? (data.data && data.data.value);
              return v != null && String(v).trim() !== '' ? String(v) : (data.id ?? '');
            })();
            const font = { fontWeight: depth <= 1 ? 600 : 400, fontSize: depth === 0 ? 20 : 13 };
            const isSelected = (data.states || []).includes('selected');
            const props: any = {
              text: label,
              color,
              maxWidth: NODE_WIDTH,
              font,
              isSelected,
              borderWidth: 2,
              ...(depth === 0
                ? { type: 'filled' as const, color: '#f1f4f5', style: { color: '#252525' } }
                : depth === 1
                ? { type: 'filled' as const }
                : { type: 'outlined' as const }),
            };
            return React.createElement(TextNode, props);
          },
        },
      },
      layout: {
        type: 'mindmap',
        direction: 'H' as const,
        getSide: () => 'right',
        getVGap: () => NODE_V_GAP,
        getHGap: () => NODE_H_GAP,
      },
      onReady: (graph: any) => {
        mindMapInstanceRef.current = graph;
        graph.on('node:click', (e: any) => {
          const id = e.target?.get?.('id') ?? e.item?.getModel?.()?.id;
          if (!id) return;
          const prev = selectedIdInGraphRef.current;
          const updates: Record<string, string[]> = {};
          if (prev) updates[prev] = [];
          updates[id] = ['selected'];
          graph.setElementState(updates, true).then(() => {
            selectedIdInGraphRef.current = id;
            handleNodeSelectRef.current(id);
          });
        });
      },
    };
  }, [mindMapDataSafe]);

  if (loading || materialsLoading) {
    return (
      <div style={{ padding: PAGE_SPACING.PADDING, textAlign: 'center' }}>加载中...</div>
    );
  }

  if (!materialId) {
    return (
      <div style={{ padding: PAGE_SPACING.PADDING, textAlign: 'center' }}>
        <p>缺少物料ID参数</p>
        <Button onClick={() => navigate('/apps/master-data/process/engineering-bom', { state: { closeTab: location.pathname + (location.search || '') } })}>
          返回列表
        </Button>
      </div>
    );
  }

  if (!rootMaterial || !mindMapData) {
    return (
      <div style={{ padding: PAGE_SPACING.PADDING, textAlign: 'center' }}>
        <p>物料数据不存在或正在加载...</p>
        <Button onClick={() => navigate('/apps/master-data/process/engineering-bom', { state: { closeTab: location.pathname + (location.search || '') } })}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <CanvasPageTemplate
      toolbar={
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
            onClick={() => {
              if (selectedNodeId) {
                handleAddChildNode(selectedNodeId);
              } else {
                handleAddChildNode('root');
              }
            }}
          >
            添加子物料
          </Button>
          {selectedNodeId && selectedNodeId !== 'root' && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteNode(selectedNodeId)}
            >
              删除节点
            </Button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: 8 }}>主物料：{rootMaterial.code} - {rootMaterial.name}</span>
            {version && <span>版本：{version}</span>}
          </div>
        </Space>
      }
      canvas={
        <>
          {/* 画板左上角：常用键盘快捷键 */}
          <div
            style={{
              position: 'absolute',
              left: 12,
              top: 12,
              zIndex: 10,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.92)',
              borderRadius: 6,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              fontSize: 12,
              color: '#666',
              lineHeight: 1.8,
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 4, color: '#333' }}>快捷键</div>
            <div><kbd style={{ padding: '2px 6px', background: '#f5f5f5', borderRadius: 4 }}>Enter</kbd> 添加同级</div>
            <div><kbd style={{ padding: '2px 6px', background: '#f5f5f5', borderRadius: 4 }}>Tab</kbd> 添加子级</div>
            <div><kbd style={{ padding: '2px 6px', background: '#f5f5f5', borderRadius: 4 }}>Delete</kbd> 删除节点</div>
          </div>
          {mindMapConfig ? (
            <MemoizedMindMap config={mindMapConfig} />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 16,
            }}>
              <p style={{ color: '#999' }}>暂无BOM数据，请添加子物料</p>
              <Button
                icon={<PlusOutlined />}
                onClick={() => handleAddChildNode('root')}
              >
                添加子物料
              </Button>
            </div>
          )}
        </>
      }
      rightPanel={{
        title: selectedNode ? (selectedNode.id === 'root' ? '主物料信息' : '物料节点配置') : '节点配置',
        children: selectedNode ? (
          selectedNode.id === 'root' ? (
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
              <Form.Item name="unit" label="单位">
                <Input placeholder="请输入单位（如：个、kg、m等）" maxLength={20} />
              </Form.Item>
              <Form.Item
                name="wasteRate"
                label="损耗率（%）"
                rules={[{ type: 'number', min: 0, max: 100, message: '损耗率必须在0-100之间' }]}
              >
                <InputNumber
                  placeholder="请输入损耗率（如：5表示5%）"
                  precision={2}
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                />
              </Form.Item>
              <Form.Item name="isRequired" label="是否必选" valuePropName="checked">
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" onClick={handleSaveNodeConfig}>保存</Button>
                  <Button onClick={() => { setSelectedNodeId(null); nodeConfigForm.resetFields(); }}>
                    取消选择
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )
        ) : (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
            <p>请点击节点查看和编辑配置</p>
          </div>
        ),
      }}
    />
  );
};

export default BOMDesignerPage;
