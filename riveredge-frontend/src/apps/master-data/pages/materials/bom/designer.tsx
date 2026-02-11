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
import { Button, Space, Form, Input, Select, InputNumber, Switch, Alert } from 'antd';
import { SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined, DragOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { MindMap, RCNode } from '@ant-design/graphs';

const { TextNode } = RCNode;

const DEFAULT_EXPAND_LEVEL = 5;

/** 同级节点垂直间距，加大以缓解二级节点（如定子下硅钢片/漆包线、转子与外壳之间）拥挤 */
const NODE_V_GAP = 16;
/** 层级间水平间距 */
const NODE_H_GAP = 60;

import {
  handleAddChildNode,
  handleAddSiblingNode,
  handleDeleteNode,
  handleNodeSelect,
  MindMapNode,
  findNode,
  updateNode,
  findParentNode,
  handleMoveNodeLogic,
} from './utils';
import { bomApi, materialApi } from '../../../services/material';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import type { Material, BOMHierarchyItem, MaterialUnits } from '../../../types/material';
import { CanvasPageTemplate, PAGE_SPACING } from '../../../../../components/layout-templates';
const GRID_STYLE: React.CSSProperties = {
  backgroundImage: 'radial-gradient(#dcdcdc 1px, transparent 1px)',
  backgroundSize: '16px 16px',
  backgroundColor: '#f5f7fa', // 略微修改颜色证明配置生效
};

const KBD_STYLE: React.CSSProperties = {
  fontFamily: 'Consolas, "Lucida Console", "Courier New", monospace',
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid #d9d9d9',
  borderBottom: '2px solid #ccc',
  backgroundColor: '#fff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  margin: '0 4px',
  fontSize: '12px',
  color: '#333',
  fontWeight: 600,
  lineHeight: '14px',
  display: 'inline-block',
};

/** 画布内的 MindMap：仅当 config 引用变化时重渲染，避免选中节点触发整图 setOptions+render */
const MemoizedMindMap = memo((props: { config: Record<string, unknown> | null }) => {
  const { config } = props;
  if (!config) return null;
  return <MindMap {...(config as any)} />;
});
MemoizedMindMap.displayName = 'MemoizedMindMap';

/**
 * BOM可视化设计器页面组件
 */
const BOMDesignerPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const materialId = searchParams.get('materialId');
  const version = searchParams.get('version');
  /** 实际加载的版本（来自 hierarchy），保存时使用 */
  const [resolvedVersion, setResolvedVersion] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bomStatus, setBomStatus] = useState<string>('draft');
  const [rootMaterial, setRootMaterial] = useState<Material | null>(null);
  
  const isReadOnly = useMemo(() => bomStatus === 'approved', [bomStatus]);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  /** 单位字典：value(code) -> label(显示名)，用于节点配置中单位下拉显示标签 */
  const [unitValueToLabel, setUnitValueToLabel] = useState<Record<string, string>>({});

  // MindMap 数据
  const [mindMapData, setMindMapData] = useState<any>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [nodeConfigForm] = Form.useForm();
  const materialSelectRef = useRef<any>(null);

  // 使用ref保存数据，用于操作
  const mindMapDataRef = useRef<any>(null);
  const mindMapInstanceRef = useRef<any>(null);
  const handleNodeSelectRef = useRef<(id: string) => void>(() => { });
  const selectedIdInGraphRef = useRef<string | null>(null); // 与图内选中状态同步，用于 setElementState 时清除上一节点
  const canvasRef = useRef<HTMLDivElement>(null);

  // History state for Undo/Redo
  const [, setHistory] = useState<{ past: any[]; future: any[] }>({ past: [], future: [] });
  
  const [unitMap, setUnitMap] = useState<Record<string, string>>({}); // value -> label

  // Load unit dictionary
  useEffect(() => {
    const loadUnitDict = async () => {
      try {
        const dict = await getDataDictionaryByCode('MATERIAL_UNIT');
        if (dict?.uuid) {
          const items = await getDictionaryItemList(dict.uuid);
          const map: Record<string, string> = {};
          items.forEach(item => {
            map[item.value] = item.label;
          });
          setUnitMap(map);
        }
      } catch (e) {
        console.error('Failed to load unit dictionary', e);
      }
    };
    loadUnitDict();
  }, []);

  const selectedMaterialId = Form.useWatch('materialId', nodeConfigForm);
  
  const unitOptions = useMemo(() => {
    if (!selectedMaterialId) return [];
    const material = materials.find(m => m.id === selectedMaterialId);
    if (!material) return [];

    const opts: { label: string; value: string }[] = [];
    
    // Base Unit
    if (material.baseUnit) {
      opts.push({
        label: unitMap[material.baseUnit] || material.baseUnit,
        value: material.baseUnit,
      });
    }

    // Auxiliary Units
    if (material.units?.units) {
      material.units.units.forEach((u: any) => {
        // Avoid duplicates if baseUnit is also in units list
        if (u.unit !== material.baseUnit) {
          opts.push({
            label: unitMap[u.unit] || u.unit,
            value: u.unit,
          });
        }
      });
    }
    
    return opts;
  }, [selectedMaterialId, materials, unitMap]);

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
  ): any => {
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
   * 加载单位字典（MATERIAL_UNIT），用于节点配置中单位下拉显示标签
   */
  useEffect(() => {
    const loadUnitDictionary = async () => {
      try {
        const dictionary = await getDataDictionaryByCode('MATERIAL_UNIT');
        const items = await getDictionaryItemList(dictionary.uuid, true);
        const valueToLabel: Record<string, string> = {};
        items.forEach((item: { value: string; label: string }) => {
          valueToLabel[item.value] = item.label;
        });
        setUnitValueToLabel(valueToLabel);
      } catch (error: any) {
        console.error('加载单位字典失败:', error);
      }
    };
    loadUnitDictionary();
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
        material = allMaterials.find((m: Material) => m.id === materialIdNum);
      }

      if (!material) {
        messageApi.error('找不到指定的物料');
        navigate('/apps/master-data/process/engineering-bom', { state: { closeTab: location.pathname + (location.search || '') } });
        return;
      }

      setRootMaterial(material);

      // 获取BOM层级结构
      const hierarchy = await bomApi.getHierarchy(materialIdNum, version || undefined);
      const actualVersion = hierarchy.version || '1.0';

      // 同步实际版本：用于保存时决策
      setResolvedVersion(actualVersion);

      // URL 无 version 时，写入实际版本以保证刷新、分享链接正确
      if (!version) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set('version', actualVersion);
            return next;
          },
          { replace: true }
        );
      }

      // 设置BOM状态
      if (hierarchy.approvalStatus) {
        setBomStatus(hierarchy.approvalStatus);
      } else {
        setBomStatus('draft'); // 默认草稿
      }

      // 转换为 MindMap 数据
      const data = convertToMindMapData(material, hierarchy.items || []);

      setMindMapData(data);
      setHistory({ past: [], future: [] }); // Reset history on load

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
        const data: any = {
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
   * Wrapper for updating BOM data with History support
   */
  const handleUpdateBOM = useCallback((newData: any) => {
    setHistory(curr => {
      const currentData = mindMapDataRef.current;
      if (!currentData) return curr;
      return {
        past: [...curr.past, currentData].slice(-20), // Limit history depth
        future: []
      };
    });
    setMindMapData(newData);
  }, []);

  /**
   * Undo action
   */
  const handleUndo = useCallback(() => {
    setHistory(curr => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const newPast = curr.past.slice(0, curr.past.length - 1);
      
      const currentData = mindMapDataRef.current;
      setMindMapData(previous);
      
      return {
        past: newPast,
        future: [currentData, ...curr.future]
      };
    });
  }, []);

  /**
   * Redo action
   */
  const handleRedo = useCallback(() => {
    setHistory(curr => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const newFuture = curr.future.slice(1);
      
      const currentData = mindMapDataRef.current;
      setMindMapData(next);
      
      return {
        past: [...curr.past, currentData],
        future: newFuture
      };
    });
  }, []);

  /**
   * 添加子节点
   */
  const handleAddChildNodeCallback = useCallback((parentNodeId: string) => {
    handleAddChildNode(
      parentNodeId,
      mindMapDataRef,
      handleUpdateBOM,
      setSelectedNodeId,
      mindMapInstanceRef,
      selectedIdInGraphRef,
      nodeConfigForm
    );
  }, [nodeConfigForm]);

  /**
   * 添加同级节点
   */
  const handleAddSiblingNodeCallback = useCallback((siblingNodeId: string) => {
    handleAddSiblingNode(
      siblingNodeId,
      mindMapDataRef,
      handleUpdateBOM,
      setSelectedNodeId,
      mindMapInstanceRef,
      selectedIdInGraphRef,
      nodeConfigForm
    );
  }, [nodeConfigForm]);

  /**
   * 删除节点
   */
  const handleDeleteNodeCallback = useCallback((nodeId: string) => {
    handleDeleteNode(
      nodeId,
      mindMapDataRef,
      handleUpdateBOM,
      setSelectedNodeId as any,
      messageApi
    );
  }, [messageApi]);

  /**
   * 选择节点
   */
  const handleNodeSelectCallback = useCallback((nodeId: string) => {
    handleNodeSelect(
      nodeId,
      mindMapDataRef,
      setSelectedNodeId,
      nodeConfigForm
    );
  }, [nodeConfigForm]);

  useEffect(() => {
    handleNodeSelectRef.current = handleNodeSelectCallback;
  }, [handleNodeSelectCallback]);

  /**
   * 保存节点配置
   */
  const handleSaveNodeConfig = () => {
    if (!selectedNodeId || !mindMapDataRef.current) return;

    nodeConfigForm.validateFields().then((values) => {
      const material = materials.find(m => m.id === values.materialId);

      const updated = updateNode(mindMapDataRef.current!, selectedNodeId, (node: MindMapNode) => {
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
        handleUpdateBOM(updated);
        messageApi.success('配置已更新');
      }
    });
  };

  /**
   * 将 MindMap 数据转换为 BOM 批量导入格式
   */
  const convertMindMapToBOMItems = useCallback((data: MindMapNode, parentMaterial: Material): any[] => {
    const items: any[] = [];

    if (data.children) {
      data.children.forEach((child: MindMapNode) => {
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
   * 保存BOM设计（草稿/新建场景，直接覆盖）
   */
  const handleSave = async () => {
    if (!materialId || !rootMaterial || !mindMapData) return;
    if (bomStatus === 'approved') {
      messageApi.warning('已审核的BOM不可直接修改，请使用「另存为新版本」');
      return;
    }

    try {
      setSaving(true);
      const items = convertMindMapToBOMItems(mindMapData as MindMapNode, rootMaterial);
      if (items.length === 0) {
        messageApi.warning('请至少添加一个子物料');
        return;
      }
      const targetVersion = resolvedVersion ?? '1.0';
      await bomApi.batchImport({ items, version: targetVersion });
      messageApi.success('BOM设计已保存');
      await loadBOMData();
    } catch (error: any) {
      messageApi.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 另存为新版本（已审核BOM场景：revise 后 batchImport）
   */
  const handleSaveAsNewVersion = async () => {
    if (!materialId || !rootMaterial || !mindMapData) return;
    const materialIdNum = parseInt(materialId);

    const items = convertMindMapToBOMItems(mindMapData as MindMapNode, rootMaterial);
    if (items.length === 0) {
      messageApi.warning('请至少添加一个子物料');
      return;
    }

    try {
      setSaving(true);
      const existingBoms = await bomApi.getByMaterial(materialIdNum, resolvedVersion ?? undefined);
      if (!existingBoms?.length) {
        messageApi.error('无法获取当前版本BOM信息，无法升版');
        return;
      }
      const firstBom = existingBoms[0];
      const newBom = await bomApi.revise(firstBom.uuid);
      const newVersion = newBom.version;

      await bomApi.batchImport({ items, version: newVersion });

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('version', newVersion);
          return next;
        },
        { replace: true }
      );
      setResolvedVersion(newVersion);

      messageApi.success(`已另存为新版本：${newVersion}`);
      await loadBOMData();
    } catch (error: any) {
      messageApi.error(error.message || '另存为新版本失败');
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
      // 如果正在输入，仅允许特定快捷键（如Enter保存）
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.getAttribute('contenteditable') === 'true';

      // F2: Edit (Focus Input)
      if (event.key === 'F2') {
        event.preventDefault();
        if (selectedNodeId && selectedNodeId !== 'root') {
             materialSelectRef.current?.focus();
        }
        return;
      }

      // Esc: Cancel Selection or Exit Edit
      if (event.key === 'Escape') {
        event.preventDefault();
        
        // If editing, just blur and return focus to canvas
        if (isInputActive) {
            (activeElement as HTMLElement).blur();
            canvasRef.current?.focus();
            return;
        }

        // If not editing, clear selection
        if (selectedNodeId) {
          setSelectedNodeId(null);
          // Try to clear graph selection state if possible
          if (mindMapInstanceRef.current && selectedIdInGraphRef.current) {
             try {
                if (mindMapInstanceRef.current.setItemState) {
                   mindMapInstanceRef.current.setItemState(selectedIdInGraphRef.current, 'selected', false);
                }
             } catch(e) {}
             selectedIdInGraphRef.current = null;
          }
          nodeConfigForm.resetFields();
        }
        return;
      }

      if (isInputActive) {
        if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
             event.preventDefault();
             handleSaveNodeConfig();
             // Blur and return focus to canvas immediately
             (activeElement as HTMLElement).blur();
             canvasRef.current?.focus();
        }
        return;
      }

      // Enter key handling (Canvas context)
      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        // Since input focus is handled above, this block is for canvas shortcuts
        event.preventDefault();
        event.stopPropagation();
        if (selectedNodeId) {
          handleAddSiblingNodeCallback(selectedNodeId);
        }
        return;
      }


      // TAB键：添加子物料
      if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        if (selectedNodeId) {
          handleAddChildNodeCallback(selectedNodeId);
        } else if (mindMapData) {
          handleAddChildNodeCallback('root');
        }
        return;
      }

      // Delete键：删除节点
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNodeId && selectedNodeId !== 'root') {
        event.preventDefault();
        event.stopPropagation();
        handleDeleteNodeCallback(selectedNodeId);
        return;
      }

      // 方向键导航
      if (selectedNodeId && mindMapDataRef.current) {
        // ArrowLeft: Go to Parent
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          const parent = findParentNode(mindMapDataRef.current, selectedNodeId);
          if (parent) {
            handleNodeSelectCallback(parent.id);
          }
          return;
        }

        // ArrowRight: Go to First Child
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          const current = findNode(mindMapDataRef.current, selectedNodeId);
          if (current && current.children && current.children.length > 0) {
            handleNodeSelectCallback(current.children[0].id);
          }
          return;
        }

        // ArrowUp: Previous Sibling
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          const parent = findParentNode(mindMapDataRef.current, selectedNodeId);
          if (parent && parent.children) {
            const index = parent.children.findIndex((c: MindMapNode) => c.id === selectedNodeId);
            if (index > 0) {
              handleNodeSelectCallback(parent.children[index - 1].id);
            }
          }
          return;
        }

        // ArrowDown: Next Sibling
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          const parent = findParentNode(mindMapDataRef.current, selectedNodeId);
          if (parent && parent.children) {
            const index = parent.children.findIndex((c: MindMapNode) => c.id === selectedNodeId);
            if (index >= 0 && index < parent.children.length - 1) {
              handleNodeSelectCallback(parent.children[index + 1].id);
            }
          }
          return;
        }
      }

      // Undo: Ctrl+Z
      if (event.key === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Ctrl+Y
      if (event.key === 'y' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        handleRedo();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedNodeId, handleAddSiblingNodeCallback, handleAddChildNodeCallback, handleDeleteNodeCallback, handleNodeSelectCallback, mindMapData, handleUndo, handleRedo]);

  // 新节点自动聚焦选择框
  useEffect(() => {
    if (selectedNodeId?.startsWith('material_new_')) {
      setTimeout(() => {
        materialSelectRef.current?.focus();
      }, 200);
    }
  }, [selectedNodeId]);

  // 获取选中的节点
  const selectedNode = useMemo(() => {
    if (!selectedNodeId || !mindMapData) return null;
    return findNode(mindMapData as MindMapNode, selectedNodeId);
  }, [selectedNodeId, mindMapData]);

  // 节点配置中选中的物料 ID，用于根据物料信息生成单位选项
  const watchedMaterialId = Form.useWatch('materialId', nodeConfigForm);
  const selectedMaterial = useMemo(
    () => (watchedMaterialId != null ? materials.find((m) => m.id === watchedMaterialId) : null),
    [watchedMaterialId, materials]
  );
  /** 当前选中物料的单位选项：基础单位 + 辅助单位，label 使用字典标签（显示名） */
  const unitOptionsFromMaterial = useMemo(() => {
    if (!selectedMaterial) return [];
    const raw = selectedMaterial as Record<string, unknown>;
    const base = (selectedMaterial.baseUnit ?? raw.base_unit) as string ?? '';
    const unitsData = (selectedMaterial.units ?? raw.units) as MaterialUnits | undefined;
    const alternates = unitsData?.units?.map((u) => u.unit).filter(Boolean) ?? [];
    const values = base ? [base, ...alternates] : alternates;
    const unique = Array.from(new Set(values));
    return unique.map((u) => ({
      label: unitValueToLabel[u] ?? u,
      value: u,
    }));
  }, [selectedMaterial, unitValueToLabel]);

  // 供 MindMap 使用的纯净树数据（id/value/children），子节点 value 含用量
  const mindMapDataSafe = useMemo(() => {
    if (!mindMapData) return null;
    const strip = (n: MindMapNode): any => {
      const base = typeof n.value === 'string' ? n.value : String(n.id);
      const value = n.id === 'root'
        ? base
        : `${base} × ${n.quantity ?? 1}`;
      const out: any = { 
        id: n.id, 
        value,
        data: { ...n, isSelected: n.id === selectedNodeId } // 显式传递选中状态到数据中
      };
      if (n.children?.length) {
        out.children = n.children.map(strip);
      }
      return out;
    };
    return strip(mindMapData as MindMapNode);
  }, [mindMapData, selectedNodeId]);

  const mindMapConfig = useMemo(() => {
    if (!mindMapDataSafe) return null;
    return {
      data: mindMapDataSafe,
      direction: 'right' as const,
      // type: 'boxed', // 移除 fixed 类型以允许更好的自定义
      defaultExpandLevel: DEFAULT_EXPAND_LEVEL,
      animate: false,
      animation: false,
      layout: {
        type: 'mindmap',
        direction: 'H' as const,
        getSide: () => 'right',
        getVGap: () => NODE_V_GAP,
        getHGap: () => NODE_H_GAP,
        animate: false,
        animation: false,
      },
      behaviors: ['drag-canvas', 'zoom-canvas'],
      theme: 'light' as const,
      labelField: 'value',
      node: {
        style: {
          component: (data: any) => {
            const depth = data.depth ?? 0;
            const label = data.value || data.id || '';
            const isRoot = data.id === 'root' || depth === 0;
            // 通过数据注入和外部状态双重判断选中
            const isSelected = data.data?.isSelected || data.id === selectedNodeId;
            // 判断是否处于激活状态（拖拽目标）
            // 注意：G6更新这种自定义组件状态比较麻烦，这里尝试用 data 注入
            // G6 的 setItemState 会更新 item 的 state，但 React 组件需要重绘才能感知
            // Ant Design Graphs 的 RCNode 机制可能会在 state 变化时重新渲染 component
            // 我们检查 data.data (model.data) 或其他属性
            // 实际上 G6 3.x/4.x 的 React 节点更新是个难点，如果不生效，我们只能依赖 G6 原生 shape 样式或 refresh
            // 暂时假设 props 会更新
             
            
            // 自适应宽度计算
            const charWidth = (char: string) => (/[^\x00-\xff]/.test(char) ? 14 : 7.5);
            const textWidth = Array.from(String(label)).reduce((sum: number, char: string) => sum + charWidth(char), 0);
            const nodeWidth = Math.max(textWidth + 50, 140); // 增加固定 padding

            return (
              <div
                draggable={!isRoot}
                onDragStart={(e) => {
                  if (isRoot) return;
                  e.stopPropagation();
                  e.dataTransfer.setData('nodeId', data.id);
                  e.dataTransfer.effectAllowed = 'move';
                  
                  // Optional: Set custom drag image
                  // const img = new Image();
                  // img.src = '...';
                  // e.dataTransfer.setDragImage(img, 10, 10);
                }}
                onDragOver={(e) => {
                   e.preventDefault(); // Allow dropping
                   e.dataTransfer.dropEffect = 'move';
                }}
                onDragEnter={(e) => {
                   e.preventDefault();
                   // Use direct DOM styling for valid drop targets
                   if (data.id) {
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(24, 144, 255, 0.8)';
                      e.currentTarget.style.borderColor = '#1890ff';
                   }
                }}
                onDragLeave={(e) => {
                   e.preventDefault();
                   if (data.id) {
                      // Reset styles based on selection state
                      e.currentTarget.style.boxShadow = isSelected ? `0 0 0 2px rgba(114, 46, 209, 0.4)` : 'none';
                      e.currentTarget.style.borderColor = isSelected ? '#722ed1' : (isRoot ? '#722ed1' : '#d9d9d9');
                   }
                }}
                onDrop={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   const draggedNodeId = e.dataTransfer.getData('nodeId');
                   const targetId = data.id;
                   
                   // Reset style
                   e.currentTarget.style.boxShadow = isSelected ? `0 0 0 2px rgba(114, 46, 209, 0.4)` : 'none';
                   e.currentTarget.style.borderColor = isSelected ? '#722ed1' : (isRoot ? '#722ed1' : '#d9d9d9');

                   if (draggedNodeId && targetId && draggedNodeId !== targetId) {
                      if (mindMapDataRef.current) {
                        const newTree = handleMoveNodeLogic(mindMapDataRef.current, draggedNodeId, targetId);
                        if (newTree) {
                          handleUpdateBOM(newTree);
                        } else {
                           messageApi.warning('无法移动到该位置（可能是因为它是当前节点的子节点）');
                        }
                      }
                   }
                }}
                style={{
                   display: 'flex',
                   alignItems: 'center',
                   background: isRoot ? '#722ed1' : '#fff',
                   border: `1px solid ${isRoot ? '#722ed1' : '#d9d9d9'}`,
                   borderRadius: 4,
                   padding: '4px 8px',
                   minWidth: 'fit-content',
                   // Add visual cue for selection or active (drop target)
                   boxShadow: isSelected ? `0 0 0 2px rgba(114, 46, 209, 0.4)` : (data.data?.active ? `0 0 0 2px rgba(24, 144, 255, 0.4)` : 'none'),
                   borderColor: isSelected ? '#722ed1' : (data.data?.active ? '#1890ff' : (isRoot ? '#722ed1' : '#d9d9d9')),
                }}
              >
                {!isRoot && (
                  <span style={{ marginRight: 6, cursor: 'move', color: '#999', display: 'flex', alignItems: 'center' }}>
                     <DragOutlined />
                  </span>
                )}
                <span style={{ 
                    color: isRoot ? '#fff' : '#000', 
                    fontSize: isRoot ? 16 : 13,
                    fontWeight: isRoot ? 600 : 400,
                    whiteSpace: 'nowrap',
                }}>
                  {label}
                </span>
              </div>
            );
            // Replaced RCNode.TextNode with manual DIV to support custom content (drag handle)
            /*
            return React.createElement(TextNode, {
              text: label,
              width: nodeWidth,
              height: 36,
              maxWidth: 800,
              type: isRoot ? 'filled' : 'outlined',
              // 根节点紫色
              color: isRoot ? '#722ed1' : '#1890ff',
              isSelected,
              // 显式传入样式
              style: {
                fill: isRoot ? '#722ed1' : '#fff',
                stroke: isRoot ? '#722ed1' : '#d9d9d9',
                radius: 4,
                // 确保选中时的效果
                ...(isSelected ? { stroke: '#722ed1', lineWidth: 3, shadowBlur: 10, shadowColor: 'rgba(114, 46, 209, 0.4)' } : {})
              },
              // 文本样式
              textStyle: {
                fill: isRoot ? '#fff' : '#000',
                fontSize: isRoot ? 16 : 13,
                fontWeight: isRoot ? 600 : 400,
              }
            } as any);
            */
          },
        },
      },
      onReady: (graph: any) => {
        mindMapInstanceRef.current = graph;

        // Force enable common behaviors
        if (graph.addBehaviors) {
            try {
              // Ensure default mode has these behaviors
              graph.addBehaviors(['drag-canvas', 'zoom-canvas'], 'default');
              graph.setMode('default');
            } catch (e) {
              console.warn('Failed to add behaviors', e);
            }
        }
        
        // 彻底禁用动画
        if (graph.set) {
          graph.set('animate', false);
        }

        graph.on('node:click', (e: any) => {
          const id = e.id || e.item?.getID?.() || e.target?.get?.('id');
          if (!id) return;
          
          const prev = selectedIdInGraphRef.current;
          if (prev && graph.setItemState) {
            graph.setItemState(prev, 'selected', false);
          }
          if (graph.setItemState) {
            graph.setItemState(id, 'selected', true);
          }
          
          selectedIdInGraphRef.current = id;
          handleNodeSelectRef.current(id);
        });

        // 拖拽状态追踪
        let draggingNodeId: string | null = null;
        let dropTargetId: string | null = null;

        graph.on('node:dragstart', (e: any) => {
          if (e.item) {
             draggingNodeId = e.item.getModel().id;
          }
        });

        graph.on('node:dragenter', (e: any) => {
           if (!draggingNodeId || !e.item) return;
           const targetId = e.item.getModel().id;
           if (targetId === draggingNodeId) return;
           
           dropTargetId = targetId;
           // 高亮潜在目标
           graph.setItemState(e.item, 'active', true);
        });

        graph.on('node:dragleave', (e: any) => {
           if (!draggingNodeId || !e.item) return;
           const targetId = e.item.getModel().id;
           if (targetId === dropTargetId) {
              dropTargetId = null;
           }
           // 取消高亮
           graph.setItemState(e.item, 'active', false);
        });

        // 拖拽结束处理
        graph.on('node:dragend', (e: any) => {
          const { item, x, y } = e;
          if (!item || !item.getModel) return;
          
          // 清除所有高亮状态
          if (dropTargetId) {
             const targetItem = graph.findById(dropTargetId);
             if (targetItem) graph.setItemState(targetItem, 'active', false);
          }
          
          // 如果通过 dragenter 找到了明确目标，优先使用
          let targetId = dropTargetId;
          
          // 如果没有通过事件捕获到（比如快速移动），尝试坐标检测兜底
          if (!targetId) {
             const nodes = graph.getNodes();
             for (const node of nodes) {
                const bbox = node.getBBox();
                if (node !== item && 
                    x >= bbox.minX && x <= bbox.maxX && 
                    y >= bbox.minY && y <= bbox.maxY) {
                  targetId = node.getModel().id;
                  break;
                }
             }
          }

          if (targetId && draggingNodeId) {
            // 执行移动逻辑
            if (mindMapDataRef.current) {
              const newTree = handleMoveNodeLogic(mindMapDataRef.current, draggingNodeId, targetId);
              if (newTree) {
                handleUpdateBOM(newTree);
                // 移动成功后不需要refresh，因为数据更新会触发 React 重绘
                draggingNodeId = null;
                dropTargetId = null;
                return;
              } else {
                 messageApi.warning('无法移动到该位置（可能是因为它是当前节点的子节点）');
              }
            }
          }
          
          // 如果没有有效移动，或移动失败，重置
          draggingNodeId = null;
          dropTargetId = null;
          graph.refresh();
        });
      },
    };
  }, [mindMapDataSafe, selectedNodeId, handleUpdateBOM]); // 增加依赖确保重算配置

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
      style={{ height: 'calc(100vh - 110px)' }}
      toolbar={
        <Space>
          {isReadOnly ? (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSaveAsNewVersion}
              title="已审核BOM需另存为新版本"
            >
              另存为新版本
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
              title="保存"
            >
              保存
            </Button>
          )}

          <Button icon={<CloseOutlined />} onClick={handleCancel}>
            返回
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              if (selectedNodeId) {
                handleAddChildNodeCallback(selectedNodeId);
              } else {
                handleAddChildNodeCallback('root');
              }
            }}
          >
            添加子物料
          </Button>
          {selectedNodeId && selectedNodeId !== 'root' && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteNodeCallback(selectedNodeId)}
            >
              删除节点
            </Button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: 8 }}>主物料：{rootMaterial.code} - {rootMaterial.name}</span>
            {(resolvedVersion ?? version) && <span>版本：{resolvedVersion ?? version}</span>}
          </div>
        </Space>
      }
      canvas={
        <div 
          ref={canvasRef}
          tabIndex={-1} // Allow div to be focused
          style={{ width: '100%', height: '100%', position: 'relative', outline: 'none', ...GRID_STYLE }}
        >
          {/* 调试标示：如果能看到这个文字和背景色变化，说明代码已更新 */}
          <div style={{ position: 'absolute', right: 12, top: 12, color: '#722ed1', fontSize: 10, opacity: 0.5, zIndex: 100 }}>
            Render Mode: High-Performance Optimized
          </div>
          {/* 画板左上角：常用键盘快捷键 */}
          <div
            style={{
              position: 'absolute',
              left: 12,
              top: 12,
              zIndex: 10,
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              fontSize: 12,
              color: '#333',
              border: '1px solid rgba(0,0,0,0.05)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>操作指南</span>
              <span style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>快捷键</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 8, columnGap: 16, alignItems: 'center', justifyItems: 'start' }}>
               <span style={KBD_STYLE}>F2</span>
               <span>编辑节点物料</span>

               <span style={KBD_STYLE}>Enter</span>
               <span>保存(编辑时) / 添加同级(画布时)</span>

               <span style={KBD_STYLE}>Tab</span>
               <span>添加子节点</span>

               <span style={KBD_STYLE}>Esc</span>
               <span>退出编辑 / 取消选中</span>

               <span>
                 <span style={KBD_STYLE}>Ctrl</span>+<span style={KBD_STYLE}>Z</span>
               </span>
               <span>撤销操作</span>

               <span style={{ display: 'flex', gap: 2 }}>
                 <span style={KBD_STYLE}>↑</span><span style={KBD_STYLE}>↓</span>
                 <span style={KBD_STYLE}>←</span><span style={KBD_STYLE}>→</span>
               </span>
               <span>切换选中节点</span>
            </div>

            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px dashed #f0f0f0', color: '#666', fontSize: 11 }}>
               <div>• 拖拽左侧 <DragOutlined /> 手柄可移动节点</div>
               <div>• 快捷键需在画布聚焦时生效</div>
            </div>
          </div>

          {mindMapConfig ? (
            <MindMap key={`bom-mindmap-${mindMapDataSafe?.id || 'empty'}`} {...mindMapConfig} />
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
                onClick={() => handleAddChildNodeCallback('root')}
              >
                添加子物料
              </Button>
            </div>
          )}
        </div>
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
                  ref={materialSelectRef}
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
                  onChange={(id) => {
                    const mat = materials.find((m) => m.id === id);
                    const base = mat ? ((mat as Record<string, unknown>).base_unit ?? mat.baseUnit) : '';
                    nodeConfigForm.setFieldsValue({ unit: base ?? '' });
                  }}
                  onSelect={(val) => {
                    const mat = materials.find(m => m.id === val);
                    if (mat) {
                      const base = (mat as Record<string, unknown>).base_unit ?? mat.baseUnit;
                      if (base) nodeConfigForm.setFieldsValue({ unit: base });
                    }
                    setTimeout(() => {
                      const qtyInput = document.querySelector('input[id$="_quantity"]');
                      (qtyInput as HTMLInputElement)?.focus();
                      (qtyInput as HTMLInputElement)?.select();
                    }, 50);
                  }}
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
              <Form.Item name="unit" label="单位" rules={[{ required: true, message: '请选择单位' }]}>
                <Select
                  placeholder={selectedMaterial ? '请选择单位' : '请先选择物料'}
                  options={unitOptionsFromMaterial}
                  disabled={!selectedMaterial}
                  allowClear={false}
                />
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
              
              {/* Visual Focus Hint */}
              <div style={{ 
                margin: '16px 0', 
                padding: '8px', 
                background: '#f0f5ff', 
                border: '1px dashed #adc6ff',
                borderRadius: 4,
                fontSize: 12,
                color: '#2f54eb'
              }}>
                提示：编辑完成后请点击保存按钮，或重新点击画布区域以恢复快捷键功能。
              </div>

              <Form.Item>
                <Space>
                  <Button type="primary" onClick={handleSaveNodeConfig}>保存</Button>
                  <Button onClick={() => { 
                    setSelectedNodeId(null); 
                    // Clear graph selection
                    if (mindMapInstanceRef.current && selectedIdInGraphRef.current) {
                      try {
                          if (mindMapInstanceRef.current.setItemState) {
                            mindMapInstanceRef.current.setItemState(selectedIdInGraphRef.current, 'selected', false);
                          }
                      } catch(e) {}
                      selectedIdInGraphRef.current = null;
                    }
                    nodeConfigForm.resetFields(); 
                  }}>
                    取消选择 (Esc)
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
