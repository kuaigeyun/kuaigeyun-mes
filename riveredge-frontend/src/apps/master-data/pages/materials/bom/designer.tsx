/**
 * 物料清单BOM可视化设计器页面
 * 
 * 使用 Ant Design Charts MindMap 可视化设计物料清单BOM结构。
 * 支持节点点击、添加、删除、配置等功能。
 * 
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button, Space, Form, Select, InputNumber, Input, Switch, Tag, Modal, theme, Row, Col, List, Descriptions, Spin, App, Alert } from 'antd';
import { EditOutlined, LeftOutlined, SaveOutlined, CloseOutlined, PlusOutlined, DeleteOutlined, DragOutlined, CloseCircleOutlined, SettingOutlined, ClusterOutlined, ReloadOutlined, CopyOutlined, DiffOutlined } from '@ant-design/icons';
import { MindMap, RCNode } from '@ant-design/graphs';

const { TextNode: G6TextNode } = RCNode;

const DEFAULT_EXPAND_LEVEL = 5;

/** 同级节点垂直间距，加大以缓解二级节点（如定子下硅钢片/漆包线、转子与外壳之间）拥挤 */
const NODE_V_GAP = 16;
/** 层级间水平间距 */
const NODE_H_GAP = 60;
/** 四级及更深层级：加大垂直间距，避免兄弟节点重叠（depth 0=根 1=二级 2=三级 3=四级） */
const NODE_V_GAP_DEEP = 28;
/** 四级及更深层级：加大水平间距，避免与父级/兄弟分支重叠 */
const NODE_H_GAP_DEEP = 88;
/** 节点高度：与渲染一致，用于 size/ports 使连线始终从侧面垂直中心连接 */
const NODE_HEIGHT_SINGLE = 32;
const NODE_HEIGHT_DOUBLE = 48;

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
  removeNode,
  resolveIssueMethodForNode,
} from './utils';
import { bomApi, materialApi, materialGroupApi } from '../../../services/material';
import { processRouteApi, unwrapProcessPagedList } from '../../../services/process';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import type { Material, MaterialCreate, MaterialUpdate, BOMHierarchyItem, MaterialUnits, BOMVersionCompareResult } from '../../../types/material';
import type { ProcessRoute } from '../../../types/process';
import {
  CanvasPageTemplate,
  CANVAS_GRID_STYLE,
  PAGE_SPACING,
  SYSTEM_VIEWPORT_OFFSETS,
  getViewportHeightExpr,
} from '../../../../../components/layout-templates';
import { MaterialForm } from '../../../components/MaterialForm';
import { DEFAULT_MATERIAL_BASE_UNIT } from '../../../constants/materialDefaults';
import FabricationRawMaterialWizard from '../../../components/FabricationRawMaterialWizard';
import {
  isFabricationMaterial,
  toFabricationMaterialRef,
} from '../../../utils/fabricationRawMaterial';
import type { FabricationMaterialRef } from '../../../utils/fabricationRawMaterial';
import { RouteFormModal } from '../../../components/RouteFormModal';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';

/** 现代化配色：主色（根节点/选中） */
const BOM_COLORS = {
  root: '#4f46e5',
  rootRing: 'rgba(79, 70, 229, 0.35)',
  configurable: '#0d9488',
  configurableBorder: '#14b8a6',
  dragActive: '#0ea5e9',
  dragActiveRing: 'rgba(14, 165, 233, 0.4)',
  defaultBorder: 'var(--ant-color-border-secondary, #e2e8f0)',
  defaultBg: 'var(--ant-color-bg-container, #ffffff)',
  textPrimary: 'var(--ant-color-text, #0f172a)',
  textMuted: 'var(--ant-color-text-secondary, #64748b)',
} as const;

/** 物料来源类型 key -> Ant Design Tag color（label 由 i18n 提供，已移除 Configure 配置件） */
const SOURCE_TYPE_COLORS: Record<string, string> = {
  Make: 'blue',
  Buy: 'green',
  Phantom: 'default',
  Outsource: 'orange',
  Service: 'cyan',
};

/** 物料来源类型对应的节点背景/边框（现代化柔和配色） */
const SOURCE_TYPE_NODE_COLORS: Record<string, { bg: string; border: string }> = {
  Make: {
    bg: 'color-mix(in srgb, #0ea5e9 16%, var(--ant-color-bg-container, #ffffff))',
    border: '#0ea5e9',
  },
  Buy: {
    bg: 'color-mix(in srgb, #10b981 16%, var(--ant-color-bg-container, #ffffff))',
    border: '#10b981',
  },
  Phantom: {
    bg: 'color-mix(in srgb, #64748b 14%, var(--ant-color-bg-container, #ffffff))',
    border: '#64748b',
  },
  Outsource: {
    bg: 'color-mix(in srgb, #f59e0b 14%, var(--ant-color-bg-container, #ffffff))',
    border: '#f59e0b',
  },
  Service: {
    bg: 'color-mix(in srgb, #14b8a6 14%, var(--ant-color-bg-container, #ffffff))',
    border: '#14b8a6',
  },
};

const KBD_STYLE: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  padding: '2px 6px',
  borderRadius: 6,
  border: '1px solid #e2e8f0',
  borderBottom: '2px solid #cbd5e1',
  backgroundColor: '#f8fafc',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
  margin: '0 4px',
  fontSize: '12px',
  color: '#334155',
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
const { useToken } = theme;

/** 物料来源类型 key -> i18n key */
const SOURCE_TYPE_I18N_KEYS: Record<string, string> = {
  Make: 'app.master-data.bom.sourceMake',
  Buy: 'app.master-data.bom.sourceBuy',
  Phantom: 'app.master-data.bom.sourcePhantom',
  Outsource: 'app.master-data.bom.sourceOutsource',
  Service: 'app.master-data.bom.sourceService',
};

const BOMDesignerPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const getSourceTypeLabel = (key: string) => (SOURCE_TYPE_I18N_KEYS[key] ? t(SOURCE_TYPE_I18N_KEYS[key]) : key);
  const issueMethodOptions = useMemo(
    () => [
      { label: t('app.master-data.bom.issueMethodPick'), value: 'pick' },
      { label: t('app.master-data.bom.issueMethodBackflush'), value: 'backflush' },
      { label: t('app.master-data.bom.issueMethodNone'), value: 'none' },
    ],
    [t],
  );
  const { token } = useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const materialId = searchParams.get('materialId');
  const version = searchParams.get('version');
  /** 实际加载的版本（来自 hierarchy），保存时使用 */
  const [resolvedVersion, setResolvedVersion] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [obsoleteModalVisible, setObsoleteModalVisible] = useState(false);
  const [obsoleteReason, setObsoleteReason] = useState('');
  const [obsoleteLoading, setObsoleteLoading] = useState(false);
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
  const loadingSubBomForNodeRef = useRef<string | null>(null);
  const [loadingSubBomNodeId, setLoadingSubBomNodeId] = useState<string | null>(null);
  /** 本会话中修改过的节点 ID，用于升版时仅对涉及变动的上级父件升版并写版本变更备注 */
  const dirtyNodeIdsRef = useRef<Set<string>>(new Set());
  /** 标记节点被修改，升版时用于计算需一起升版的上级父件并生成版本变更备注（需在引用它的 useCallback 之前定义） */
  const addDirtyNode = useCallback((nodeId: string) => {
    dirtyNodeIdsRef.current.add(nodeId);
  }, []);

  // History state for Undo/Redo
  const [, setHistory] = useState<{ past: any[]; future: any[] }>({ past: [], future: [] });
  
  const [unitMap, setUnitMap] = useState<Record<string, string>>({}); // value -> label

  /** 操作指南是否展开（默认收起，给画板留足空间；需要时点击键盘图标展开） */
  const [guideExpanded, setGuideExpanded] = useState(false);

  /** 当前物料的版本列表（用于版本切换下拉） */
  const [versionOptions, setVersionOptions] = useState<Array<{ value: string; label: string; isObsolete?: boolean }>>([]);
  const [versionOptionsLoading, setVersionOptionsLoading] = useState(false);
  /** 节点配置中通过 UniMaterialSelect 选中的物料（用于来源展示与单位选项，避免依赖全局 materials 列表） */
  const [selectedMaterialInForm, setSelectedMaterialInForm] = useState<Material | null>(null);

  // 物料编辑弹窗（直接打开，不跳转页面）
  const [materialEditModalVisible, setMaterialEditModalVisible] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);
  const [materialFormLoading, setMaterialFormLoading] = useState(false);
  const [materialGroups, setMaterialGroups] = useState<Array<{ id: number; code: string; name: string }>>([]);
  // 新建物料弹窗（BOM 节点配置内「快速新建」打开，创建成功后自动选中新物料）
  const [createMaterialModalVisible, setCreateMaterialModalVisible] = useState(false);
  const [newCreatedMaterial, setNewCreatedMaterial] = useState<Material | null>(null);
  // 工艺路线编辑弹窗（节点配置内「编辑工艺路线」打开）
  const [processRouteEditModalVisible, setProcessRouteEditModalVisible] = useState(false);
  const [processRouteToEditUuid, setProcessRouteToEditUuid] = useState<string | null>(null);
  const [processRouteEditLoading, setProcessRouteEditLoading] = useState(false);
  // 在「可选物料」列表中直接添加（选料后追加，不新建空白节点）
  const [addConfigurableOptionModalVisible, setAddConfigurableOptionModalVisible] = useState(false);
  const [addConfigurableOptionMaterial, setAddConfigurableOptionMaterial] = useState<Material | null>(null);
  const [addAlternativeOptionModalVisible, setAddAlternativeOptionModalVisible] = useState(false);
  const [addAlternativeOptionMaterial, setAddAlternativeOptionMaterial] = useState<Material | null>(null);
  /** 复制BOM弹窗：选择新根物料后以当前结构生成新BOM */
  const [copyBomModalVisible, setCopyBomModalVisible] = useState(false);
  const [copyBomNewRootMaterial, setCopyBomNewRootMaterial] = useState<Material | null>(null);
  const [copyBomLoading, setCopyBomLoading] = useState(false);
  /** 工艺型原料向导（Tier 3） */
  const fabricationWizardPromptedRef = useRef<Set<string>>(new Set());
  const [fabricationWizardState, setFabricationWizardState] = useState<{
    open: boolean;
    material: FabricationMaterialRef | null;
    nodeId?: string;
  }>({ open: false, material: null });

  const openFabricationWizard = useCallback((material: Material, nodeId?: string) => {
    setFabricationWizardState({
      open: true,
      material: toFabricationMaterialRef(material),
      nodeId,
    });
  }, []);

  const closeFabricationWizard = useCallback(() => {
    setFabricationWizardState({ open: false, material: null });
  }, []);
  const convertMindMapToBOMItems = useCallback((data: MindMapNode, parentMaterial: Material): any[] => {
    const items: any[] = [];
    const parentCode = (parentMaterial as any).mainCode ?? (parentMaterial as any).main_code ?? parentMaterial.code ?? '';

    if (data.children) {
      data.children.forEach((child: MindMapNode, index: number) => {
        if (child.material && child.componentId) {
          const compCode = (child.material as any).mainCode ?? (child.material as any).main_code ?? child.material.code ?? '';
          items.push({
            parentCode,
            componentCode: compCode,
            quantity: child.quantity || 1,
            unit: child.unit ?? undefined,
            wasteRate: child.wasteRate ?? undefined,
            isRequired: child.isRequired !== false,
            isConfigurable: child.isConfigurable ?? false,
            configurableGroupId: child.isConfigurable ? (child.configurableGroupId ?? undefined) : undefined,
            isDefaultConfigurable: child.isConfigurable ? false : undefined,
            isAlternative: child.isAlternative ?? false,
            alternativeGroupId: child.isAlternative ? (child.alternativeGroupId ?? undefined) : undefined,
            priority: child.priority ?? index,
            issueMethod: resolveIssueMethodForNode(child.issueMethod, child.material),
          });

          if (child.children && child.children.length > 0) {
            items.push(...convertMindMapToBOMItems(child, child.material!));
          }
        }
      });
    }

    return items;
  }, []);

  /**
   * 在 MindMap 树中根据 componentId 查找节点（含取半成品节点导出子件等场景）
   */
  const findNodeByComponentId = useCallback((node: MindMapNode, componentId: number): MindMapNode | null => {
    if (node.componentId === componentId) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeByComponentId(child, componentId);
        if (found) return found;
      }
    }
    return null;
  }, []);
  /** 版本比对弹窗 */
  const [versionCompareModalVisible, setVersionCompareModalVisible] = useState(false);
  const [versionCompareV1, setVersionCompareV1] = useState<string | null>(null);
  const [versionCompareV2, setVersionCompareV2] = useState<string | null>(null);
  const [versionCompareResult, setVersionCompareResult] = useState<BOMVersionCompareResult | null>(null);
  const [versionCompareLoading, setVersionCompareLoading] = useState(false);

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
      const code = (material as any).mainCode ?? (material as any).main_code ?? material.code ?? item.componentCode;

      const variantManaged = !!(material && ((material as any).variantManaged ?? (material as any).variant_managed));
      const node: MindMapNode = {
        id: `material_${item.componentId}_${pathKey}`,
        value: `${code} - ${material.name}`,
        material: material as Material,
        quantity: item.quantity,
        unit: item.unit,
        wasteRate: item.wasteRate,
        isRequired: item.isRequired,
        componentId: item.componentId,
        isConfigurable: item.isConfigurable || variantManaged,
        configurableGroupId: item.configurableGroupId ?? null,
        isDefaultConfigurable: item.isDefaultConfigurable,
        isAlternative: item.isAlternative ?? false,
        alternativeGroupId: item.alternativeGroupId ?? null,
        priority: (item as any).priority ?? 0,
        bomVersion: (item as any).bomVersion ?? (item as any).bom_version,
        issueMethod: resolveIssueMethodForNode(
          item.issueMethod ?? (item as any).issue_method,
          material as Material,
        ),
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
   * 将 BOM 层级项列表转为 MindMap 子节点（带路径前缀，用于半成品展开加载）
   * @param excludeComponentId 半成品自身物料 ID，若子件等于该 ID 则排除（防止自引用）
   */
  const convertHierarchyItemsToMindMapNodes = useCallback((
    items: BOMHierarchyItem[],
    parentPath: number[],
    excludeComponentId?: number
  ): MindMapNode[] => {
    const convertOne = (item: BOMHierarchyItem, path: number[], excludeId?: number): MindMapNode => {
      const material = materials.find(m => m.id === item.componentId) || {
        id: item.componentId,
        code: item.componentCode,
        name: item.componentName,
      };
      const pathKey = path.join('-');
      const code = (material as any).mainCode ?? (material as any).main_code ?? material.code ?? item.componentCode;
      const variantManaged = !!(material && ((material as any).variantManaged ?? (material as any).variant_managed));
      const node: MindMapNode = {
        id: `material_${item.componentId}_${pathKey}`,
        value: `${code} - ${material.name}`,
        material: material as Material,
        quantity: item.quantity,
        unit: item.unit,
        wasteRate: item.wasteRate,
        isRequired: item.isRequired,
        componentId: item.componentId,
        isConfigurable: item.isConfigurable || variantManaged,
        configurableGroupId: item.configurableGroupId ?? null,
        isDefaultConfigurable: item.isDefaultConfigurable,
        isAlternative: item.isAlternative ?? false,
        alternativeGroupId: item.alternativeGroupId ?? null,
        priority: (item as any).priority ?? 0,
        bomVersion: (item as any).bomVersion ?? (item as any).bom_version,
        issueMethod: resolveIssueMethodForNode(
          item.issueMethod ?? (item as any).issue_method,
          material as Material,
        ),
      };
      if (item.children && item.children.length > 0) {
        const filteredChildren = excludeId != null
          ? item.children.filter((c: BOMHierarchyItem) => c.componentId !== excludeId)
          : item.children;
        node.children = filteredChildren.map((child, index) => convertOne(child, [...path, index], excludeId));
      }
      return node;
    };
    const filteredItems = excludeComponentId != null
      ? items.filter((item) => item.componentId !== excludeComponentId)
      : items;
    return filteredItems.map((item, index) => convertOne(item, [...parentPath, index], excludeComponentId));
  }, [materials]);

  /**
   * 加载物料列表
   */
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setMaterialsLoading(true);
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result.items ?? []);
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
   * 加载物料分组（用于物料编辑弹窗）
   */
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const list = await materialGroupApi.list({ limit: 1000 });
        setMaterialGroups(list.map((g) => ({ id: g.id, code: g.code, name: g.name })));
      } catch (e) {
        console.error('加载物料分组失败:', e);
      }
    };
    loadGroups();
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
        const allMaterialsRes = await materialApi.list({ limit: 10000, isActive: true });
        material = (allMaterialsRes.items ?? []).find((m: Material) => m.id === materialIdNum);
      }

      if (!material) {
        messageApi.error(t('app.master-data.bom.materialNotFound'));
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
      // 根节点（成品）记录当前 BOM 版本，供节点上显示
      (data as any).version = actualVersion;

      setMindMapData(data);
      setHistory({ past: [], future: [] }); // Reset history on load
      dirtyNodeIdsRef.current.clear();

      // 刷新版本列表（便于切换版本下拉与刷新后一致）
      loadVersionList().catch(() => {});

      console.log('BOM设计器 - 加载完成:', {
        rootMaterial: material,
        hierarchyItems: hierarchy.items?.length || 0,
        mindMapData: data,
      });

      if (
        isFabricationMaterial(material) &&
        (!hierarchy.items || hierarchy.items.length === 0)
      ) {
        const promptKey = `root-${material.id}`;
        if (!fabricationWizardPromptedRef.current.has(promptKey)) {
          fabricationWizardPromptedRef.current.add(promptKey);
          setTimeout(() => openFabricationWizard(material, 'root'), 400);
        }
      }
    } catch (error: any) {
      console.error('BOM设计器 - 加载失败:', error);
      messageApi.error(error.message || t('app.master-data.bom.loadBomFailed'));
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
   * 加载当前物料的版本列表（用于版本切换下拉）
   */
  const loadVersionList = useCallback(async () => {
    if (!materialId) return;
    setVersionOptionsLoading(true);
    try {
      const boms = await bomApi.getByMaterial(Number(materialId), undefined, false, true);
      const seen = new Set<string>();
      const list: Array<{ value: string; label: string; isObsolete?: boolean }> = [];
      for (const b of boms) {
        if (seen.has(b.version)) continue;
        seen.add(b.version);
        const obsoleteSuffix = b.isObsolete ? ` (${t('app.master-data.bom.obsoleteTag')})` : '';
        list.push({ value: b.version, label: b.version + obsoleteSuffix, isObsolete: b.isObsolete });
      }
      list.sort((a, b) => {
        const aM = a.value.match(/v?(\d+)\.(\d+)/);
        const bM = b.value.match(/v?(\d+)\.(\d+)/);
        if (aM && bM) {
          const am = parseInt(aM[1], 10);
          const an = parseInt(aM[2], 10);
          const bm = parseInt(bM[1], 10);
          const bn = parseInt(bM[2], 10);
          if (am !== bm) return bm - am;
          return bn - an;
        }
        return b.value.localeCompare(a.value);
      });
      setVersionOptions(list);
    } catch (e) {
      console.error('加载版本列表失败', e);
      setVersionOptions([]);
    } finally {
      setVersionOptionsLoading(false);
    }
  }, [materialId, t]);

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
      messageApi.warning(t('app.master-data.bom.missingMaterialId'));
      navigate('/apps/master-data/process/engineering-bom', { state: { closeTab: location.pathname + (location.search || '') } });
    }
  }, [materialId, version, materials, convertToMindMapData]);

  /** 当物料加载完成后拉取版本列表 */
  useEffect(() => {
    if (materialId && materials.length > 0 && !loading) {
      loadVersionList();
    }
  }, [materialId, materials.length, loading, loadVersionList]);

  /**
   * Wrapper for updating BOM data with History support.
   * 同步更新 ref，确保「另存为新版本」等操作能立即拿到最新树（含刚添加的替代料/配置位）。
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
    mindMapDataRef.current = newData;
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
      nodeConfigForm,
      t('app.master-data.bom.materialNotSelected')
    );
  }, [nodeConfigForm, t]);

  /**
   * 添加同级节点
   */
  const handleAddSiblingNodeCallback = useCallback((
    siblingNodeId: string,
    configurableOverrides?: { isConfigurable: boolean; configurableGroupId: number; isDefaultConfigurable: boolean },
    alternativeOverrides?: { isAlternative: boolean; alternativeGroupId: number; priority: number }
  ) => {
    handleAddSiblingNode(
      siblingNodeId,
      mindMapDataRef,
      handleUpdateBOM,
      setSelectedNodeId,
      mindMapInstanceRef,
      selectedIdInGraphRef,
      nodeConfigForm,
      t('app.master-data.bom.materialNotSelected'),
      configurableOverrides,
      alternativeOverrides
    );
  }, [nodeConfigForm, t]);

  /** 打开「在列表中添加可选物料」弹窗（选料后直接追加到列表，不新建空白节点） */
  const handleOpenAddConfigurableOptionModal = useCallback(() => {
    setAddConfigurableOptionMaterial(null);
    setAddConfigurableOptionModalVisible(true);
  }, []);

  /**
   * 在列表中直接添加可选物料：用已选物料创建同级配置位节点，插入到当前节点（或同组末尾）紧跟的下一个位置，不追加到 children 末尾
   */
  const handleAddConfigurableOptionWithMaterial = useCallback(
    (material: Material) => {
      if (!mindMapDataRef.current || !selectedNodeId || selectedNodeId === 'root') return;
      const node = findNode(mindMapDataRef.current, selectedNodeId);
      const parent = findParentNode(mindMapDataRef.current, selectedNodeId);
      if (!node || !parent) return;
      const groupId = node.configurableGroupId ?? Date.now();
      const gid = typeof groupId === 'number' ? groupId : Date.now();
      const code = (material as any).mainCode ?? (material as any).main_code ?? material.code ?? '';
      const baseUnit = (material as any).baseUnit ?? (material as any).base_unit ?? '';
      const newNode: MindMapNode = {
        id: `material_new_${Date.now()}`,
        value: `${code} - ${material.name}`,
        material,
        quantity: 1,
        unit: baseUnit,
        wasteRate: 0,
        isRequired: true,
        issueMethod: resolveIssueMethodForNode(undefined, material),
        componentId: material.id,
        isConfigurable: true,
        configurableGroupId: gid,
        isDefaultConfigurable: false,
        isAlternative: false,
        alternativeGroupId: null,
      };
      const siblings = parent.children ?? [];
      const selectedIndex = siblings.findIndex((c: MindMapNode) => c.id === selectedNodeId);
      if (selectedIndex === -1) return;
      let insertAt = selectedIndex + 1;
      for (let i = selectedIndex + 1; i < siblings.length; i++) {
        if ((siblings[i] as MindMapNode).isConfigurable && (siblings[i] as MindMapNode).configurableGroupId === gid) {
          insertAt = i + 1;
        } else {
          break;
        }
      }
      const newChildren = [...siblings.slice(0, insertAt), newNode, ...siblings.slice(insertAt)];
      const updated = updateNode(mindMapDataRef.current, parent.id, (p) => ({
        ...p,
        children: newChildren,
      }));
      handleUpdateBOM(updated);
      addDirtyNode(selectedNodeId);
      setAddConfigurableOptionModalVisible(false);
      setAddConfigurableOptionMaterial(null);
      messageApi.success(t('app.master-data.bom.configurableOptionAdded'));
    },
    [selectedNodeId, handleUpdateBOM, addDirtyNode, messageApi, t]
  );

  /** 替代料组内按新顺序重排并更新 priority，保存（不可变更新，确保 UI 能正确响应新顺序） */
  const applyAlternativeOrder = useCallback(
    (parent: MindMapNode, reordered: MindMapNode[]) => {
      if (!mindMapDataRef.current) return;
      // 为每个节点创建新对象并写入新 priority，避免直接修改 state 导致 UI 不刷新
      const reorderedWithNewPriority = reordered.map((c: MindMapNode, i: number) => ({
        ...c,
        priority: i,
      }));
      const altIds = new Set(reorderedWithNewPriority.map((c: MindMapNode) => c.id));
      const newChildren: MindMapNode[] = [];
      let altIdx = 0;
      for (const c of parent.children ?? []) {
        if (altIds.has(c.id)) {
          newChildren.push(reorderedWithNewPriority[altIdx++]);
        } else {
          newChildren.push(c);
        }
      }
      const updated = updateNode(mindMapDataRef.current, parent.id, (p) => ({ ...p, children: newChildren }));
      handleUpdateBOM(updated);
      addDirtyNode(parent.id);
      messageApi.success(t('common.updateSuccess'));
    },
    [handleUpdateBOM, addDirtyNode, messageApi, t]
  );

  /** 替代料组内上移/下移 */
  const handleReorderAlternative = useCallback(
    (nodeId: string, direction: 'up' | 'down') => {
      if (!mindMapDataRef.current) return;
      const parent = findParentNode(mindMapDataRef.current, nodeId);
      if (!parent?.children) return;
      const node = findNode(mindMapDataRef.current, nodeId);
      if (!node?.isAlternative || node.alternativeGroupId == null) return;
      const altSiblings = parent.children
        .filter((c: MindMapNode) => c.isAlternative && c.alternativeGroupId === node.alternativeGroupId)
        .sort((a: MindMapNode, b: MindMapNode) => (a.priority ?? 0) - (b.priority ?? 0));
      const idx = altSiblings.findIndex((c: MindMapNode) => c.id === nodeId);
      if (idx < 0) return;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= altSiblings.length) return;
      const reordered = [...altSiblings];
      const [removed] = reordered.splice(idx, 1);
      reordered.splice(newIdx, 0, removed);
      applyAlternativeOrder(parent, reordered);
    },
    [applyAlternativeOrder]
  );

  /** 打开「添加可替代物料」弹窗（与配置位一致：选料后追加） */
  const handleOpenAddAlternativeOptionModal = useCallback(() => {
    setAddAlternativeOptionMaterial(null);
    setAddAlternativeOptionModalVisible(true);
  }, []);

  /** 在列表中直接添加可替代物料：选料后追加，与配置位逻辑一致 */
  const handleAddAlternativeOptionWithMaterial = useCallback(
    (material: Material) => {
      if (!mindMapDataRef.current || !selectedNodeId || selectedNodeId === 'root') return;
      let tree = mindMapDataRef.current;
      const node = findNode(tree, selectedNodeId);
      const parent = findParentNode(tree, selectedNodeId);
      if (!node || !parent) return;
      const formSaysAlternative = nodeConfigForm.getFieldValue('isAlternative');
      if (!node.isAlternative && !formSaysAlternative) return;
      let gid = node.alternativeGroupId ?? null;
      if (gid == null) gid = Date.now();
      const needWriteNode = !node.isAlternative || node.alternativeGroupId == null;
      if (needWriteNode) {
        tree = updateNode(tree, selectedNodeId, (n) => ({
          ...n,
          isAlternative: true,
          alternativeGroupId: gid,
        }));
      }
      const sameGroupCount = (parent.children ?? []).filter(
        (c: MindMapNode) => c.isAlternative && (c as MindMapNode).alternativeGroupId === gid
      ).length;
      const code = (material as any).mainCode ?? (material as any).main_code ?? material.code ?? '';
      const baseUnit = (material as any).baseUnit ?? (material as any).base_unit ?? '';
      const newNode: MindMapNode = {
        id: `material_new_${Date.now()}`,
        value: `${code} - ${material.name}`,
        material,
        quantity: 1,
        unit: baseUnit,
        wasteRate: 0,
        isRequired: true,
        issueMethod: resolveIssueMethodForNode(undefined, material),
        componentId: material.id,
        isConfigurable: false,
        configurableGroupId: null,
        isAlternative: true,
        alternativeGroupId: gid,
        priority: sameGroupCount,
      };
      const siblings = parent.children ?? [];
      const selectedIndex = siblings.findIndex((c: MindMapNode) => c.id === selectedNodeId);
      if (selectedIndex === -1) return;
      let insertAt = selectedIndex + 1;
      for (let i = selectedIndex + 1; i < siblings.length; i++) {
        if ((siblings[i] as MindMapNode).isAlternative && (siblings[i] as MindMapNode).alternativeGroupId === gid) {
          insertAt = i + 1;
        } else {
          break;
        }
      }
      const newChildren = [...siblings.slice(0, insertAt), newNode, ...siblings.slice(insertAt)];
      tree = updateNode(tree, parent.id, (p) => ({
        ...p,
        children: newChildren,
      }));
      handleUpdateBOM(tree);
      addDirtyNode(selectedNodeId);
      setAddAlternativeOptionModalVisible(false);
      setAddAlternativeOptionMaterial(null);
      messageApi.success(t('app.master-data.bom.configurableOptionAdded'));
    },
    [selectedNodeId, handleUpdateBOM, addDirtyNode, nodeConfigForm, messageApi, t]
  );

  /**
   * 删除节点
   */
  const handleDeleteNodeCallback = useCallback((nodeId: string) => {
    handleDeleteNode(
      nodeId,
      mindMapDataRef,
      handleUpdateBOM,
      setSelectedNodeId as any,
      messageApi,
      t
    );
  }, [messageApi, t]);

  /**
   * 从已拉取的 BOM 列表中解析版本：默认版本优先，否则最新已审核，否则最新版本
   */
  const resolveVersionFromBoms = useCallback((boms: any[]): string => {
    if (!boms.length) return '1.0';
    const defaultBom = boms.find((b: any) => b.isDefault === true);
    if (defaultBom) return defaultBom.version ?? '1.0';
    const sortDesc = (a: any, b: any) => {
      const vA = (a.version ?? '').toString();
      const vB = (b.version ?? '').toString();
      const ma = vA.match(/v?(\d+)\.(\d+)/);
      const mb = vB.match(/v?(\d+)\.(\d+)/);
      if (ma && mb) {
        if (parseInt(ma[1], 10) !== parseInt(mb[1], 10)) return parseInt(mb[1], 10) - parseInt(ma[1], 10);
        return parseInt(mb[2], 10) - parseInt(ma[2], 10);
      }
      return vB.localeCompare(vA);
    };
    const approved = boms.filter((b: any) => (b.approvalStatus ?? b.approval_status) === 'approved');
    if (approved.length > 0) {
      approved.sort(sortDesc);
      return approved[0]?.version ?? '1.0';
    }
    boms.sort(sortDesc);
    return boms[0]?.version ?? '1.0';
  }, []);

  /**
   * 选中半成品且无子节点时，自动加载该半成品的子物料（默认版本或最新已审核版本）
   * 仅请求一次 getByMaterial，用其结果解析版本后再请求 getHierarchy，减少延迟
   */
  const loadSemiProductChildrenIfNeeded = useCallback(async (nodeId: string) => {
    const tree = mindMapDataRef.current;
    if (!tree) return;
    const node = findNode(tree, nodeId);
    if (!node || nodeId === 'root' || !node.componentId) return;
    if (node.children && node.children.length > 0) return;
    if (loadingSubBomForNodeRef.current === nodeId) return;
    loadingSubBomForNodeRef.current = nodeId;
    setLoadingSubBomNodeId(nodeId);
    try {
      const boms = await bomApi.getByMaterial(node.componentId, undefined, false, true);
      if (!boms || boms.length === 0) {
        const mat =
          node.material ?? materials.find((m) => m.id === node.componentId) ?? null;
        if (mat && isFabricationMaterial(mat)) {
          const promptKey = `node-${node.componentId}`;
          if (!fabricationWizardPromptedRef.current.has(promptKey)) {
            fabricationWizardPromptedRef.current.add(promptKey);
            openFabricationWizard(mat, nodeId);
          }
        }
        return;
      }
      const version = resolveVersionFromBoms(boms);
      const hierarchy = await bomApi.getHierarchy(node.componentId, version);
      const items = hierarchy?.items ?? [];
      if (items.length === 0) return;
      const parts = node.id.split('_');
      const pathKey = parts[0] === 'material' && parts.length >= 3 ? parts.slice(2).join('_') : '';
      const parentPath = pathKey ? pathKey.split('-').map(Number) : [];
      const children = convertHierarchyItemsToMindMapNodes(items, parentPath, node.componentId);
      const updated = updateNode(tree, nodeId, (n) => ({ ...n, children }));
      if (updated) {
        handleUpdateBOM(updated);
        messageApi.success(t('app.master-data.bom.subBomLoaded'));
      }
    } catch (e) {
      console.error('加载半成品子物料失败', e);
      messageApi.error(t('app.master-data.bom.subBomLoadFailed'));
    } finally {
      if (loadingSubBomForNodeRef.current === nodeId) {
        loadingSubBomForNodeRef.current = null;
      }
      setLoadingSubBomNodeId(null);
    }
  }, [resolveVersionFromBoms, convertHierarchyItemsToMindMapNodes, handleUpdateBOM, messageApi, t, materials, openFabricationWizard]);

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
    loadSemiProductChildrenIfNeeded(nodeId);
  }, [nodeConfigForm, loadSemiProductChildrenIfNeeded]);

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
      const code = material ? ((material as any).mainCode ?? (material as any).main_code ?? material.code ?? '') : '';

      const updated = updateNode(mindMapDataRef.current!, selectedNodeId, (node: MindMapNode) => {
        let configurableGroupId = values.configurableGroupId ?? node.configurableGroupId;
        if (values.isConfigurable && !configurableGroupId) {
          configurableGroupId = Date.now();
        }
        return {
          ...node,
          value: material ? `${code} - ${material.name}` : t('app.master-data.bom.materialNotSelected'),
          material,
          quantity: values.quantity,
          unit: values.unit,
          wasteRate: values.wasteRate || 0,
          isRequired: values.isRequired !== false,
          issueMethod: values.issueMethod ?? 'pick',
          componentId: values.materialId,
          isConfigurable: values.isConfigurable ?? false,
          configurableGroupId: values.isConfigurable ? configurableGroupId : null,
          isDefaultConfigurable: false,
          isAlternative: values.isAlternative ?? false,
          alternativeGroupId: values.isAlternative ? (node.alternativeGroupId ?? Date.now()) : null,
        };
      });

      if (updated) {
        handleUpdateBOM(updated);
        addDirtyNode(selectedNodeId);
        messageApi.success(t('app.master-data.bom.configUpdated'));
        if (selectedNodeId && values.materialId) {
          loadSemiProductChildrenIfNeeded(selectedNodeId);
        }
      }
    });
  };

  /**
   * 将 MindMap 数据转换为 BOM 批量导入格式（含递归：用于草稿保存时整树写入）
   */

  /**
   * 仅导出当前物料（根）的直接子件，不递归子 BOM。
   * 用于「另存为新版本」：只对当前主件升版，不触动未改动的半成品 BOM 版本。
   */
  const getRootLevelBOMItems = useCallback((data: MindMapNode, rootMaterial: Material): any[] => {
    const items: any[] = [];
    const parentCode = (rootMaterial as any).mainCode ?? (rootMaterial as any).main_code ?? rootMaterial.code ?? '';
    if (!data.children) return items;
    data.children.forEach((child: MindMapNode, index: number) => {
      if (child.material && child.componentId) {
        const compCode = (child.material as any).mainCode ?? (child.material as any).main_code ?? child.material.code ?? '';
        items.push({
          parentCode,
          componentCode: compCode,
          quantity: child.quantity || 1,
          unit: child.unit ?? undefined,
          wasteRate: child.wasteRate ?? undefined,
          isRequired: child.isRequired !== false,
          isConfigurable: child.isConfigurable ?? false,
          configurableGroupId: child.isConfigurable ? (child.configurableGroupId ?? undefined) : undefined,
          isDefaultConfigurable: child.isConfigurable ? false : undefined,
          isAlternative: child.isAlternative ?? false,
          alternativeGroupId: child.isAlternative ? (child.alternativeGroupId ?? undefined) : undefined,
          priority: child.priority ?? index,
          issueMethod: resolveIssueMethodForNode(child.issueMethod, child.material),
        });
      }
    });
    return items;
  }, []);

  /**
   * 导出指定节点的直接子件为 BOM 导入项（用于半成品升版时 batchImport）
   */
  const getDirectChildrenBOMItems = useCallback((node: MindMapNode): any[] => {
    const parentMaterial = node.material;
    if (!parentMaterial) return [];
    const parentCode = (parentMaterial as any).mainCode ?? (parentMaterial as any).main_code ?? parentMaterial.code ?? '';
    const items: any[] = [];
    if (!node.children) return items;
    node.children.forEach((child: MindMapNode, index: number) => {
      if (child.material && child.componentId) {
        const compCode = (child.material as any).mainCode ?? (child.material as any).main_code ?? child.material.code ?? '';
        items.push({
          parentCode,
          componentCode: compCode,
          quantity: child.quantity || 1,
          unit: child.unit ?? undefined,
          wasteRate: child.wasteRate ?? undefined,
          isRequired: child.isRequired !== false,
          isConfigurable: child.isConfigurable ?? false,
          configurableGroupId: child.isConfigurable ? (child.configurableGroupId ?? undefined) : undefined,
          isDefaultConfigurable: child.isConfigurable ? false : undefined,
          isAlternative: child.isAlternative ?? false,
          alternativeGroupId: child.isAlternative ? (child.alternativeGroupId ?? undefined) : undefined,
          priority: child.priority ?? index,
          issueMethod: resolveIssueMethodForNode(child.issueMethod, child.material),
        });
      }
    });
    return items;
  }, []);

  /**
   * 构建父节点映射与深度，用于计算「受影响需升版的父件」
   */
  const buildParentMapAndDepth = useCallback((tree: MindMapNode): { parentMap: Map<string, MindMapNode>; depthMap: Map<string, number> } => {
    const parentMap = new Map<string, MindMapNode>();
    const depthMap = new Map<string, number>();
    depthMap.set(tree.id, 0);
    const visit = (node: MindMapNode, depth: number) => {
      if (node.children) {
        node.children.forEach((child: MindMapNode) => {
          parentMap.set(child.id, node);
          depthMap.set(child.id, depth + 1);
          visit(child, depth + 1);
        });
      }
    };
    visit(tree, 0);
    return { parentMap, depthMap };
  }, []);

  /**
   * 根据本会话修改过的节点，计算需要一起升版的上级父件（含根）。
   * 仅包含「有子件的节点」即成品/半成品；未涉及子件变动的半成品不升版。
   */
  const getAffectedParentMaterialIds = useCallback((
    tree: MindMapNode,
    rootMaterialId: number,
    dirtyNodeIds: Set<string>
  ): Array<{ materialId: number; depth: number }> => {
    const rootId = tree.id;
    const { parentMap, depthMap } = buildParentMapAndDepth(tree);
    const seen = new Set<number>();
    const result: Array<{ materialId: number; depth: number }> = [];

    if (dirtyNodeIds.size === 0) {
      result.push({ materialId: rootMaterialId, depth: 0 });
      return result;
    }

    dirtyNodeIds.forEach((nodeId) => {
      const node = findNode(tree, nodeId);
      if (!node) return;
      let current: MindMapNode | undefined = node;
      while (current) {
        const depth = depthMap.get(current.id) ?? 0;
        const hasChildren = current.children && current.children.length > 0;
        const materialId = current.id === rootId ? rootMaterialId : (current.componentId ?? (current.material as any)?.id);
        if (materialId != null && (current.id === rootId || hasChildren) && !seen.has(materialId)) {
          seen.add(materialId);
          result.push({ materialId: Number(materialId), depth });
        }
        current = parentMap.get(current.id);
      }
    });

    return result.sort((a, b) => b.depth - a.depth);
  }, [buildParentMapAndDepth]);

  /**
   * 根据修改过的节点生成版本变更备注文案
   */
  const buildVersionRemark = useCallback((dirtyNodeIds: Set<string>, tree: MindMapNode): string => {
    if (dirtyNodeIds.size === 0) return '';
    const labels: string[] = [];
    dirtyNodeIds.forEach((id) => {
      const node = findNode(tree, id);
      if (node?.material) {
        const code = (node.material as any).mainCode ?? (node.material as any).main_code ?? node.material.code;
        const name = (node.material as any).name ?? node.value;
        labels.push(code ? `${code} ${name || ''}`.trim() : (node.value || id));
      } else if (node?.value) {
        labels.push(node.value);
      }
    });
    if (labels.length === 0) return '';
    return `子件 ${labels.join('、')} 用量/配置变更`;
  }, []);

  /**
   * 保存BOM设计（草稿/新建场景，直接覆盖）
   */
  const handleSave = async () => {
    if (!materialId || !rootMaterial || !mindMapData) return;
    if (bomStatus === 'approved') {
      messageApi.warning(t('app.master-data.bom.approvedCannotEdit'));
      return;
    }

    try {
      setSaving(true);
      const items = convertMindMapToBOMItems(mindMapData as MindMapNode, rootMaterial);
      if (items.length === 0) {
        messageApi.warning(t('app.master-data.bom.addAtLeastOneChildMaterial'));
        return;
      }
      const targetVersion = resolvedVersion ?? '1.0';
      await bomApi.batchImport({ items, version: targetVersion });
      messageApi.success(t('app.master-data.bom.designSaved'));
      await loadBOMData();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 保存并生效：先 batchImport，再对本批新建行批量审核通过（无需依赖独立「审核流程」开关）
   */
  const handleSaveAndPublish = async () => {
    if (!materialId || !rootMaterial || !mindMapData) return;
    if (bomStatus === 'approved') {
      messageApi.warning(t('app.master-data.bom.approvedCannotEdit'));
      return;
    }

    try {
      setSaving(true);
      const items = convertMindMapToBOMItems(mindMapData as MindMapNode, rootMaterial);
      if (items.length === 0) {
        messageApi.warning(t('app.master-data.bom.addAtLeastOneChildMaterial'));
        return;
      }
      const targetVersion = resolvedVersion ?? '1.0';
      const created = await bomApi.batchImport({ items, version: targetVersion });
      const uuids = [...new Set((created ?? []).map((b) => b.uuid).filter(Boolean))];
      if (uuids.length === 0) {
        messageApi.warning(t('app.master-data.bom.saveFailed'));
        await loadBOMData();
        return;
      }
      try {
        await bomApi.batchApprove(
          uuids,
          true,
          t('app.master-data.bom.saveAndPublishComment'),
          true,
          false
        );
        messageApi.success(t('app.master-data.bom.saveAndPublishSuccess'));
      } catch (approveErr: any) {
        messageApi.warning(approveErr?.message || t('app.master-data.bom.saveAndPublishApproveFailed'));
      }
      await loadBOMData();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 版本号语义比较（用于取最大版本）：1.0 < 1.1 < 1.2
   */
  const compareVersionDesc = (a: { version: string }, b: { version: string }) => {
    const aM = a.version.match(/v?(\d+)\.(\d+)/);
    const bM = b.version.match(/v?(\d+)\.(\d+)/);
    if (aM && bM) {
      const am = parseInt(aM[1], 10);
      const an = parseInt(aM[2], 10);
      const bm = parseInt(bM[1], 10);
      const bn = parseInt(bM[2], 10);
      if (am !== bm) return bm - am;
      return bn - an;
    }
    return (b.version || '').localeCompare(a.version || '');
  };

  /**
   * 另存为新版本（已审核BOM场景：在「最大版本」上升版后 batchImport，而非当前选中版本）。
   * 仅导出根级子件，避免同层级未改动的半成品被误升版。
   * 若与当前版本完全无变动则提示无需升版并中止。
   */
  const handleSaveAsNewVersion = async () => {
    const latestTree = mindMapDataRef.current ?? mindMapData;
    if (!materialId || !rootMaterial || !latestTree) return;
    const materialIdNum = parseInt(materialId);

    // 使用 ref 中的最新树导出，避免添加替代料/配置位后 state 未刷新导致节点丢失
    const items = getRootLevelBOMItems(latestTree as MindMapNode, rootMaterial);
    if (items.length === 0) {
      messageApi.warning(t('app.master-data.bom.addAtLeastOneChildMaterial'));
      return;
    }

    try {
      // 取当前选中版本的数据用于「有无变动」对比
      const currentVersionBoms = await bomApi.getByMaterial(materialIdNum, resolvedVersion ?? undefined);
      if (!currentVersionBoms?.length) {
        messageApi.error(t('app.master-data.bom.cannotUpgrade'));
        return;
      }

      const norm = (o: {
        componentCode: string;
        quantity?: number;
        unit?: string;
        wasteRate?: number;
        isRequired?: boolean;
        isConfigurable?: boolean;
        configurableGroupId?: string | null;
        isDefaultConfigurable?: boolean;
      }) => ({
        code: String(o.componentCode ?? '').trim(),
        qty: Number(o.quantity ?? 1),
        unit: String(o.unit ?? '').trim(),
        waste: Number(o.wasteRate ?? 0),
        required: o.isRequired !== false,
        config: o.isConfigurable === true,
        groupId: o.configurableGroupId ?? null,
        defaultCfg: o.isDefaultConfigurable === true,
      });
      const currentItems = currentVersionBoms.map((b: any) => {
        const compId = b.componentId ?? b.component_id;
        const compCode = materials.find((m) => m.id === compId)?.mainCode ?? (materials.find((m) => m.id === compId) as any)?.main_code ?? '';
        return norm({
          componentCode: compCode,
          quantity: b.quantity,
          unit: b.unit,
          wasteRate: b.wasteRate ?? b.waste_rate,
          isRequired: b.isRequired ?? b.is_required,
          isConfigurable: b.isConfigurable ?? b.is_configurable,
          configurableGroupId: b.configurableGroupId ?? b.configurable_group_id ?? null,
          isDefaultConfigurable: b.isDefaultConfigurable ?? b.is_default_configurable,
        });
      }).sort((a, b) => a.code.localeCompare(b.code));
      const newItems = items.map((o: any) => norm(o)).sort((a, b) => a.code.localeCompare(b.code));
      const noChange =
        currentItems.length === newItems.length &&
        currentItems.every((c, i) =>
          c.code === newItems[i].code &&
          c.qty === newItems[i].qty &&
          c.unit === newItems[i].unit &&
          c.waste === newItems[i].waste &&
          c.required === newItems[i].required &&
          c.config === newItems[i].config &&
          (c.groupId ?? '') === (newItems[i].groupId ?? '') &&
          c.defaultCfg === newItems[i].defaultCfg
        );
      if (noChange) {
        messageApi.warning(t('app.master-data.bom.noChangeNoNeedRevise'));
        return;
      }

      setSaving(true);
      const rootMaterialId = rootMaterial.id ?? materialIdNum;
      const affected = getAffectedParentMaterialIds(latestTree as MindMapNode, rootMaterialId, dirtyNodeIdsRef.current);
      const versionRemark = buildVersionRemark(dirtyNodeIdsRef.current, latestTree as MindMapNode);

      let rootNewVersion = '';
      for (const { materialId } of affected) {
        const isRoot = materialId === rootMaterialId;
        const node = isRoot ? (latestTree as MindMapNode) : findNodeByComponentId(latestTree as MindMapNode, materialId);
        if (!node) continue;
        const partItems = isRoot ? getRootLevelBOMItems(latestTree as MindMapNode, rootMaterial) : getDirectChildrenBOMItems(node);
        const allBoms = await bomApi.getByMaterial(materialId, undefined, false, true);
        if (!allBoms?.length) {
          messageApi.error(t('app.master-data.bom.cannotUpgrade'));
          setSaving(false);
          return;
        }
        const sorted = [...allBoms].sort(compareVersionDesc);
        const maxBom = sorted[0];
        const newBom = await bomApi.revise(maxBom.uuid, undefined, versionRemark || undefined);
        await bomApi.batchImport({ items: partItems, version: newBom.version, versionRemark: versionRemark || undefined });
        if (isRoot) rootNewVersion = newBom.version;
      }

      dirtyNodeIdsRef.current.clear();
      if (rootNewVersion) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set('version', rootNewVersion);
            return next;
          },
          { replace: true }
        );
        setResolvedVersion(rootNewVersion);
      }

      messageApi.success(t('app.master-data.bom.saveAsNewVersion', { version: (rootNewVersion || resolvedVersion) ?? '' }));
      await loadBOMData();
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.bom.saveAsNewVersionFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 打开复制BOM弹窗（复制为新根物料，强制更换根节点）
   */
  const handleOpenCopyBomModal = useCallback(() => {
    setCopyBomNewRootMaterial(null);
    setCopyBomModalVisible(true);
  }, []);

  /**
   * 复制BOM：以选中的新根物料创建新BOM（结构同当前，根节点强制更换）
   */
  const handleCopyBomSubmit = useCallback(async () => {
    if (!copyBomNewRootMaterial || !mindMapData || !rootMaterial) return;
    if (copyBomNewRootMaterial.id === rootMaterial.id) {
      messageApi.warning(t('app.master-data.bom.copyBomNewRootMustDiff'));
      return;
    }
    const items = convertMindMapToBOMItems(mindMapData as MindMapNode, copyBomNewRootMaterial);
    if (items.length === 0) {
      messageApi.warning(t('app.master-data.bom.addAtLeastOneChildMaterial'));
      return;
    }
    try {
      setCopyBomLoading(true);
      await bomApi.batchImport({ items, version: '1.0' });
      messageApi.success(t('app.master-data.bom.copyBomSuccess'));
      setCopyBomModalVisible(false);
      setCopyBomNewRootMaterial(null);
      navigate(
        `/apps/master-data/process/engineering-bom/designer?materialId=${copyBomNewRootMaterial.id}&version=1.0`,
        { replace: true }
      );
    } catch (error: any) {
      messageApi.error((error?.message) ?? t('app.master-data.bom.copyFailed'));
    } finally {
      setCopyBomLoading(false);
    }
  }, [copyBomNewRootMaterial, mindMapData, rootMaterial, convertMindMapToBOMItems, navigate, messageApi, t]);

  /** 打开版本比对弹窗 */
  const handleOpenVersionCompareModal = useCallback(() => {
    setVersionCompareV1(null);
    setVersionCompareV2(null);
    setVersionCompareResult(null);
    setVersionCompareModalVisible(true);
  }, []);

  /** 根据物料ID获取显示名（用于版本比对结果） */
  const getMaterialDisplayName = useCallback((id: number | undefined | null) => {
    if (id == null) return '-';
    const m = materials.find((x) => x.id === id);
    const code = (m as any)?.mainCode ?? (m as any)?.main_code ?? m?.code ?? '';
    return m ? `${code} - ${m.name}` : String(id);
  }, [materials]);

  /** 执行版本比对 */
  const handleVersionCompareSubmit = useCallback(async () => {
    if (!materialId || !versionCompareV1 || !versionCompareV2) {
      messageApi.warning(t('app.master-data.bom.versionCompareSelectTwo'));
      return;
    }
    if (versionCompareV1 === versionCompareV2) {
      messageApi.warning(t('app.master-data.bom.versionCompareMustDiff'));
      return;
    }
    const materialIdNum = parseInt(materialId, 10);
    if (Number.isNaN(materialIdNum)) return;
    try {
      setVersionCompareLoading(true);
      const result = await bomApi.compareVersions(materialIdNum, {
        version1: versionCompareV1,
        version2: versionCompareV2,
      });
      setVersionCompareResult(result as BOMVersionCompareResult);
    } catch (error: any) {
      messageApi.error((error?.message) ?? t('app.master-data.bom.versionCompareFailed'));
    } finally {
      setVersionCompareLoading(false);
    }
  }, [materialId, versionCompareV1, versionCompareV2, messageApi, t]);

  /**
   * 打开「设为失效」弹窗
   */
  const handleOpenSetObsolete = () => {
    setObsoleteReason('');
    setObsoleteModalVisible(true);
  };

  /**
   * 提交设为失效（当前主件当前版本）
   */
  const handleSetObsoleteSubmit = async () => {
    if (!materialId || !resolvedVersion) return;
    const materialIdNum = parseInt(materialId, 10);
    if (Number.isNaN(materialIdNum)) return;
    try {
      setObsoleteLoading(true);
      await bomApi.setVersionObsolete(materialIdNum, resolvedVersion, obsoleteReason.trim() || undefined);
      messageApi.success(t('app.master-data.bom.obsoleteSuccess'));
      setObsoleteModalVisible(false);
      setObsoleteReason('');
      await loadBOMData();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.master-data.bom.operationFailed'));
    } finally {
      setObsoleteLoading(false);
    }
  };

  /**
   * 返回列表
   */
  const handleCancel = () => {
    navigate('/apps/master-data/process/engineering-bom', { state: { closeTab: location.pathname + (location.search || '') } });
  };

  /**
   * 打开物料编辑弹窗（直接在当前页面打开，不跳转）
   * @param materialOverride 可选，指定要编辑的物料（用于子节点配置中编辑当前选中的物料）
   */
  const openMaterialEditModal = useCallback(
    async (materialOverride?: Material) => {
      let materialUuid: string | undefined;
      if (materialOverride) {
        materialUuid = materialOverride.uuid || (materialOverride as any).uuid;
      } else if (selectedNodeId && rootMaterial && mindMapData) {
        if (selectedNodeId === 'root') {
          materialUuid = rootMaterial.uuid || (rootMaterial as any).uuid;
        } else {
          const node = findNode(mindMapData as MindMapNode, selectedNodeId);
          if (node?.material) {
            materialUuid = (node.material as Material).uuid || (node.material as any).uuid;
          } else if (node?.componentId) {
            const mat = materials.find((m) => m.id === node.componentId);
            materialUuid = mat?.uuid || (mat as any)?.uuid;
          }
        }
      }
      if (!materialUuid) {
        messageApi.warning(t('app.master-data.bom.cannotGetMaterial'));
        return;
      }
      try {
        setMaterialFormLoading(true);
        const detail = await materialApi.get(materialUuid);
        setMaterialToEdit(detail);
        setMaterialEditModalVisible(true);
      } catch (error: any) {
        messageApi.error(error.message || t('app.master-data.bom.getMaterialDetailFailed'));
      } finally {
        setMaterialFormLoading(false);
      }
    },
    [selectedNodeId, rootMaterial, mindMapData, materials, messageApi]
  );

  /**
   * 物料编辑弹窗提交
   */
  const handleMaterialEditSubmit = useCallback(
    async (values: MaterialCreate | MaterialUpdate) => {
      if (!materialToEdit) return;
      try {
        setMaterialFormLoading(true);
        await materialApi.update(materialToEdit.uuid, values as MaterialUpdate);
        messageApi.success(t('common.updateSuccess'));
        setMaterialEditModalVisible(false);
        setMaterialToEdit(null);
        // 刷新物料列表和主物料，以便节点显示最新来源等信息
        const result = await materialApi.list({ limit: 1000, isActive: true });
        const materialItems = result.items ?? [];
        setMaterials(materialItems);
        if (rootMaterial && materialToEdit.uuid === (rootMaterial.uuid || (rootMaterial as any).uuid)) {
          const updated = materialItems.find((m) => m.uuid === materialToEdit.uuid || (m as any).uuid === materialToEdit.uuid);
          if (updated) setRootMaterial(updated);
        }
      } catch (error: any) {
        messageApi.error(error.message || t('common.updateFailed'));
        throw error;
      } finally {
        setMaterialFormLoading(false);
      }
    },
    [materialToEdit, rootMaterial, messageApi]
  );

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

      // Ctrl+E：编辑所选物料（打开物料编辑弹窗）
      if (event.key === 'e' && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        if (!isInputActive && selectedNodeId) {
          event.preventDefault();
          openMaterialEditModal();
        }
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
  }, [selectedNodeId, handleAddSiblingNodeCallback, handleAddChildNodeCallback, handleDeleteNodeCallback, handleNodeSelectCallback, mindMapData, handleUndo, handleRedo, openMaterialEditModal]);

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

  // 当前节点的父节点（用于取同级）
  const parentNode = useMemo(() => {
    if (!selectedNodeId || !mindMapData) return null;
    return findParentNode(mindMapData as MindMapNode, selectedNodeId);
  }, [selectedNodeId, mindMapData]);

  // 同配置位组内的可选物料（同级、同 configurableGroupId）
  const configurableSiblings = useMemo(() => {
    if (!selectedNode?.isConfigurable || selectedNode.configurableGroupId == null || !parentNode?.children) return [];
    const gid = selectedNode.configurableGroupId;
    return parentNode.children.filter(
      (c: MindMapNode) => c.isConfigurable && c.configurableGroupId === gid
    );
  }, [selectedNode, parentNode]);

  // 同替代料组内的可替代物料（同级、同 alternativeGroupId），按 priority 排序
  const alternativeSiblings = useMemo(() => {
    if (!selectedNode?.isAlternative || selectedNode.alternativeGroupId == null || !parentNode?.children) return [];
    const gid = selectedNode.alternativeGroupId;
    return [...parentNode.children]
      .filter((c: MindMapNode) => c.isAlternative && c.alternativeGroupId === gid)
      .sort((a: MindMapNode, b: MindMapNode) => (a.priority ?? 0) - (b.priority ?? 0));
  }, [selectedNode, parentNode]);

  /** 替代料拖拽排序：fromIndex → toIndex（alternativeSiblings 下标）。主料(当前节点)始终在首位、不参与排序。 */
  const handleReorderAlternativeByDrag = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!parentNode?.children || !selectedNode?.isAlternative || selectedNode.alternativeGroupId == null) return;
      const altSiblings = [...alternativeSiblings];
      if (fromIndex < 0 || fromIndex >= altSiblings.length || toIndex < 0 || toIndex >= altSiblings.length) return;
      // 主料为 alternativeSiblings[0]（当前选中节点），不允许移动主料或把任意项移到主料位
      if (fromIndex === 0 || toIndex === 0) return;
      const [removed] = altSiblings.splice(fromIndex, 1);
      altSiblings.splice(toIndex, 0, removed);
      // 保证主料(selectedNodeId)始终在首位、priority 0，其余按新顺序排 priority 1,2,…
      const mainNode = altSiblings.find((c: MindMapNode) => c.id === selectedNodeId);
      const others = altSiblings.filter((c: MindMapNode) => c.id !== selectedNodeId);
      const finalOrder = mainNode ? [mainNode, ...others] : altSiblings;
      applyAlternativeOrder(parentNode, finalOrder);
    },
    [parentNode, selectedNode, alternativeSiblings, selectedNodeId, applyAlternativeOrder]
  );

  // 切换节点时同步「表单内选中物料」用于来源与单位展示（UniMaterialSelect 选中后也会通过 onChange 更新）
  useEffect(() => {
    if (selectedNode?.material) {
      setSelectedMaterialInForm(selectedNode.material as Material);
    } else {
      setSelectedMaterialInForm(null);
    }
  }, [selectedNode?.id, selectedNode?.material]);

  // 节点配置中选中的物料：优先用 UniMaterialSelect 选中的对象，否则从 materials 列表查找
  const watchedMaterialId = Form.useWatch('materialId', nodeConfigForm);
  const selectedMaterial = useMemo(
    () =>
      selectedMaterialInForm ??
      (watchedMaterialId != null ? materials.find((m) => m.id === watchedMaterialId) ?? null : null),
    [selectedMaterialInForm, watchedMaterialId, materials]
  );

  const isConfigurableFromForm = Form.useWatch('isConfigurable', nodeConfigForm);
  const isAlternativeFromForm = Form.useWatch('isAlternative', nodeConfigForm);
  // 可选物料展示列表：配置位打开时即包含「当前所选物料」，无需先保存再添加
  const effectiveConfigurableOptions = useMemo(() => {
    const fromForm = isConfigurableFromForm && (selectedMaterial || selectedNode?.material);
    const currentMaterial = selectedMaterial || selectedNode?.material;
    const current = fromForm && currentMaterial ? [{ material: currentMaterial, isCurrent: true }] : [];
    const siblings = configurableSiblings.filter((c: MindMapNode) => c.id !== selectedNodeId);
    return [...current, ...siblings.map((n: MindMapNode) => ({ material: n.material, node: n, isCurrent: false }))];
  }, [isConfigurableFromForm, selectedMaterial, selectedNode, configurableSiblings, selectedNodeId]);
  // 可替代物料展示列表：替代料打开时即包含「当前所选物料」，与配置位外观一致
  const effectiveAlternativeOptions = useMemo(() => {
    const fromForm = isAlternativeFromForm && (selectedMaterial || selectedNode?.material);
    const currentMaterial = selectedMaterial || selectedNode?.material;
    const current = fromForm && currentMaterial ? [{ material: currentMaterial, isCurrent: true }] : [];
    const siblings = alternativeSiblings.filter((c: MindMapNode) => c.id !== selectedNodeId);
    return [...current, ...siblings.map((n: MindMapNode) => ({ material: n.material, node: n, isCurrent: false }))];
  }, [isAlternativeFromForm, selectedMaterial, selectedNode, alternativeSiblings, selectedNodeId]);

  /** 按「可替代物料列表」展示顺序的索引拖拽。列表首项为「主料」不参与排序，仅替代料之间可拖拽。 */
  const handleReorderAlternativeByListIndices = useCallback(
    (fromListIndex: number, toListIndex: number) => {
      const hasCurrent = effectiveAlternativeOptions.length > 0 && (effectiveAlternativeOptions[0] as any).isCurrent === true;
      // 有主料时：列表 0=主料(不参与)，1、2…=替代料，对应 alternativeSiblings[1]、[2]…
      if (hasCurrent) {
        if (fromListIndex === 0 || toListIndex === 0) return; // 主料不参与拖拽、也不作为落点
        // 列表下标即 alternativeSiblings 下标
        handleReorderAlternativeByDrag(fromListIndex, toListIndex);
      } else {
        handleReorderAlternativeByDrag(fromListIndex, toListIndex);
      }
    },
    [effectiveAlternativeOptions, handleReorderAlternativeByDrag]
  );

  /** 从树中移除可替代料或手动添加的配置件（列表中删除该项） */
  const handleRemoveAlternativeOrConfigurableNode = useCallback(
    (nodeId: string) => {
      if (!mindMapDataRef.current || nodeId === 'root') return;
      const parent = findParentNode(mindMapDataRef.current, nodeId);
      const updated = removeNode(mindMapDataRef.current, nodeId);
      if (updated) {
        handleUpdateBOM(updated);
        if (parent) addDirtyNode(parent.id);
        if (selectedNodeId === nodeId) setSelectedNodeId(null);
        messageApi.success(t('app.master-data.bom.optionRemoved'));
      }
    },
    [selectedNodeId, handleUpdateBOM, addDirtyNode, messageApi, t]
  );

  /** 当前选中物料的单位选项：基础单位 + 辅助单位，label 使用字典标签（显示名） */
  const unitOptionsFromMaterial = useMemo(() => {
    if (!selectedMaterial) return [];
    const raw = selectedMaterial as unknown as Record<string, unknown>;
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

  /**
   * 打开工艺路线编辑弹窗（根据当前选中物料的 processRouteId 解析 uuid 后打开）
   */
  const openProcessRouteEditModal = useCallback(async () => {
    if (!selectedMaterial) return;
    const routeId = selectedMaterial.processRouteId ?? (selectedMaterial as any).process_route_id;
    if (routeId == null) {
      messageApi.warning(t('app.master-data.bom.noProcessRouteToEdit'));
      return;
    }
    setProcessRouteEditLoading(true);
    try {
      const list = unwrapProcessPagedList(await processRouteApi.list({}));
      const route = list.find((r: ProcessRoute) => r.id === routeId);
      if (route) {
        setProcessRouteToEditUuid(route.uuid);
        setProcessRouteEditModalVisible(true);
      } else {
        messageApi.warning(t('app.master-data.bom.processRouteNotFound'));
      }
    } catch (e: any) {
      messageApi.error(e?.message ?? t('common.loadFailed'));
    } finally {
      setProcessRouteEditLoading(false);
    }
  }, [selectedMaterial, messageApi, t]);

  // 供 MindMap 使用的纯净树数据；同一配置位多个可选物料在树上合并为「一个节点」显示
  const mindMapDataSafe = useMemo(() => {
    if (!mindMapData) return null;
    const root = mindMapData as MindMapNode;
    const strip = (n: MindMapNode): any => {
      const base = typeof n.value === 'string' ? n.value : String(n.id);
      const value = n.id === 'root'
        ? base
        : `${base} × ${n.quantity ?? 1}`;
      const material = n.material as Material | undefined;
      const sourceType = material?.sourceType || (material as any)?.source_type;
      let configurableCount = 0;
      let alternativeCount = 0;
      const parent = findParentNode(root, n.id);
      if (n.isConfigurable) {
        const va = material?.variantAttributes ?? (material as any)?.variant_attributes;
        if (va && typeof va === 'object' && Object.keys(va).length > 0) {
          const counts = Object.values(va).map((v: unknown) => (Array.isArray(v) ? v.length : 1));
          configurableCount = counts.reduce((a, b) => a * b, 1);
        }
        if (configurableCount === 0 && parent?.children && n.configurableGroupId != null) {
          configurableCount = parent.children.filter((c: MindMapNode) => c.isConfigurable && c.configurableGroupId === n.configurableGroupId).length;
        }
        if (configurableCount === 0) configurableCount = 1;
      }
      if (n.isAlternative) {
        if (parent?.children && n.alternativeGroupId != null) {
          alternativeCount = parent.children.filter((c: MindMapNode) => c.isAlternative && c.alternativeGroupId === n.alternativeGroupId).length;
        }
        if (alternativeCount === 0) alternativeCount = 1;
      }
      const out: any = {
        id: n.id,
        value,
        data: {
          ...n,
          isSelected: n.id === selectedNodeId,
          sourceType,
          isConfigurable: n.isConfigurable,
          isAlternative: n.isAlternative,
          configurableCount,
          alternativeCount,
          version: (n as any).version,
          bomVersion: (n as any).bomVersion,
        },
      };
      if (n.children?.length) {
        out.children = collapseGroupSiblings(n.children);
      }
      return out;
    };
    /** 同一配置位/替代料组（同 groupId）的连续兄弟节点合并为一个显示节点，用「等N种」表示 */
    const collapseGroupSiblings = (children: MindMapNode[]): any[] => {
      const result: any[] = [];
      let i = 0;
      while (i < children.length) {
        const c = children[i];
        if (c.isConfigurable && c.configurableGroupId != null) {
          const group = [c];
          while (i + 1 < children.length && (children[i + 1] as MindMapNode).isConfigurable && (children[i + 1] as MindMapNode).configurableGroupId === c.configurableGroupId) {
            group.push(children[++i] as MindMapNode);
          }
          i++;
          const first = group[0];
          let stripped = strip(first);
          if (group.length > 1) {
            const baseLabel = (typeof first.value === 'string' ? first.value : String(first.id)).replace(/\s*×\s*[\d.]+$/, '').trim();
            stripped = {
              ...stripped,
              value: `${baseLabel} 等${group.length}种 × ${first.quantity ?? 1}`,
              data: { ...stripped.data, configurableCount: group.length },
            };
          }
          result.push(stripped);
        } else if (c.isAlternative && c.alternativeGroupId != null) {
          const group = [c];
          while (i + 1 < children.length && (children[i + 1] as MindMapNode).isAlternative && (children[i + 1] as MindMapNode).alternativeGroupId === c.alternativeGroupId) {
            group.push(children[++i] as MindMapNode);
          }
          i++;
          const first = group[0];
          let stripped = strip(first);
          const altCount = group.length;
          if (group.length > 1) {
            const baseLabel = (typeof first.value === 'string' ? first.value : String(first.id)).replace(/\s*×\s*[\d.]+$/, '').trim();
            stripped = {
              ...stripped,
              value: `${baseLabel} 等${altCount}种 × ${first.quantity ?? 1}`,
              data: { ...stripped.data, alternativeCount: altCount },
            };
          } else {
            const totalInGroup = (stripped.data?.alternativeCount as number) ?? 1;
            stripped = { ...stripped, data: { ...stripped.data, alternativeCount: totalInGroup } };
          }
          result.push(stripped);
        } else {
          result.push(strip(c));
          i++;
        }
      }
      return result;
    };
    return strip(root);
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
        getVGap: (data: any) => ((data?.depth ?? data?.data?.depth ?? 0) >= 3 ? NODE_V_GAP_DEEP : NODE_V_GAP),
        getWidth: (data: any) => {
          const label = (data?.data?.value ?? data?.data?.label ?? data?.value ?? data?.label ?? data?.id ?? data?.data?.id ?? '').toString();
          const charWidth = (char: string) => (/[^\x00-\xff]/.test(char) ? 14 : 7.5);
          const textWidth = [...label].reduce<number>((sum, char) => sum + charWidth(char), 0);
          return Math.max(textWidth + 50, 140);
        },
        getHGap: (data: any) => {
          const depth = data?.depth ?? data?.data?.depth ?? 0;
          const base = depth >= 3 ? NODE_H_GAP_DEEP : NODE_H_GAP;
          const label = (data?.data?.value ?? data?.data?.label ?? data?.value ?? data?.label ?? data?.id ?? data?.data?.id ?? '').toString();
          const charWidth = (char: string) => (/[^\x00-\xff]/.test(char) ? 14 : 7.5);
          const textWidth = [...label].reduce<number>((sum, char) => sum + charWidth(char), 0);
          const nodeWidth = Math.max(textWidth + 50, 140);
          const minWidth = 140;
          const extraByWidth = nodeWidth > minWidth ? Math.min((nodeWidth - minWidth) * 0.2, 36) : 0;
          return base + extraByWidth;
        },
        getHeight: (data: any) => {
          const material = data.data?.material;
          const processRouteName = material?.processRouteName ?? (material as any)?.process_route_name;
          return processRouteName ? NODE_HEIGHT_DOUBLE : NODE_HEIGHT_SINGLE;
        },
        animate: false,
        animation: false,
      },
      behaviors: ['drag-canvas', 'zoom-canvas'],
      autoFit: true,
      theme: 'light' as const,
      backgroundColor: 'transparent',
      labelField: 'value',
      edge: {
        style: {
          stroke: '#cbd5e1',
          lineWidth: 1.2,
        }
      },
      node: {
        style: {
          // 节点尺寸与渲染一致，使连线锚点始终在右侧垂直中心（不随高度变化偏移）
          size: (data: any) => {
            const label = (data?.data?.value ?? data?.value ?? data?.data?.label ?? data?.label ?? data?.id ?? '').toString();
            const material = data.data?.material;
            const processRouteName = material?.processRouteName ?? (material as any)?.process_route_name;
            const charWidth = (char: string) => (/[^\x00-\xff]/.test(char) ? 14 : 7.5);
            const textWidth = [...label].reduce<number>((sum, char) => sum + charWidth(char), 0);
            const width = Math.max(textWidth + 50, 140);
            const height = processRouteName ? NODE_HEIGHT_DOUBLE : NODE_HEIGHT_SINGLE;
            return [width, height];
          },
          // 使用相对坐标 [x, y] 指定侧面垂直中心：左侧 [0, 0.5]、右侧 [1, 0.5]，确保连线始终从中心点连接
          ports: [{ placement: [0, 0.5] as [number, number] }, { placement: [1, 0.5] as [number, number] }],
          component: (data: any) => {
            const depth = data.depth ?? 0;
            const label = (data?.data?.value ?? data?.value ?? data?.data?.label ?? data?.label ?? data?.id ?? '').toString();
            const isRoot = data.id === 'root' || depth === 0;
            // 通过数据注入和外部状态双重判断选中
            const isSelected = data.data?.isSelected || data.id === selectedNodeId;
            // 物料来源对应节点颜色（子节点）
            const sourceType = data.data?.sourceType;
            const sourceColors = sourceType ? SOURCE_TYPE_NODE_COLORS[sourceType] : null;
            const isConfigurable = data.data?.isConfigurable;
            const isAlternative = data.data?.isAlternative;
            const material = data.data?.material;
            const processRouteName = material?.processRouteName ?? (material as any)?.process_route_name;
            const manufacturingMode = material?.sourceConfig?.manufacturing_mode ?? (material as any)?.source_config?.manufacturing_mode;
            const isFabrication = manufacturingMode === 'fabrication';
            const isAssembly = manufacturingMode === 'assembly' || (processRouteName && !isFabrication);
            const RouteIcon = isFabrication ? SettingOutlined : ClusterOutlined;
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
            const nodeHeight = processRouteName ? NODE_HEIGHT_DOUBLE : NODE_HEIGHT_SINGLE;
            const showStackIcon = !isRoot && (isConfigurable || isAlternative);

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
                   if (data.id) {
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${BOM_COLORS.dragActiveRing}`;
                      e.currentTarget.style.borderColor = BOM_COLORS.dragActive;
                   }
                }}
                onDragLeave={(e) => {
                   e.preventDefault();
                   if (data.id) {
                      e.currentTarget.style.boxShadow = isSelected ? `0 0 0 2px ${BOM_COLORS.rootRing}` : 'none';
                      e.currentTarget.style.borderColor = isSelected ? BOM_COLORS.root : (isRoot ? BOM_COLORS.root : (isConfigurable ? BOM_COLORS.configurableBorder : (sourceColors?.border ?? BOM_COLORS.defaultBorder)));
                      e.currentTarget.style.background = isRoot ? BOM_COLORS.root : (sourceColors?.bg ?? BOM_COLORS.defaultBg);
                   }
                }}
                onDrop={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   const draggedNodeId = e.dataTransfer.getData('nodeId');
                   const targetId = data.id;
                   e.currentTarget.style.boxShadow = isSelected ? `0 0 0 2px ${BOM_COLORS.rootRing}` : 'none';
                   e.currentTarget.style.borderColor = isSelected ? BOM_COLORS.root : (isRoot ? BOM_COLORS.root : (isConfigurable ? BOM_COLORS.configurableBorder : (sourceColors?.border ?? BOM_COLORS.defaultBorder)));
                   e.currentTarget.style.background = isRoot ? BOM_COLORS.root : (sourceColors?.bg ?? BOM_COLORS.defaultBg);

                   if (draggedNodeId && targetId && draggedNodeId !== targetId) {
                      if (mindMapDataRef.current) {
                        const newTree = handleMoveNodeLogic(mindMapDataRef.current, draggedNodeId, targetId);
                        if (newTree) {
                          handleUpdateBOM(newTree);
                        } else {
                           messageApi.warning(t('app.master-data.bom.cannotMoveToPosition'));
                        }
                      }
                   }
                }}
                style={{
                   display: 'flex',
                   alignItems: 'center',
                   height: nodeHeight,
                   boxSizing: 'border-box',
                   background: isRoot ? token.colorPrimary : token.colorBgContainer,
                   border: `1px solid ${isSelected ? (sourceColors?.border ?? token.colorPrimary) : (isRoot ? token.colorPrimary : token.colorBorderSecondary)}`,
                   borderRadius: token.borderRadiusLG,
                   padding: '6px 12px 6px 14px',
                   minWidth: 'fit-content',
                   boxShadow: isSelected ? `0 0 0 2px ${isSelected && isRoot ? token.colorPrimaryBg : (sourceColors?.border ?? token.colorPrimaryBorder)}44, ${token.boxShadowSecondary}` : token.boxShadowTertiary,
                   position: 'relative',
                   overflow: 'hidden',
                   transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {/* 统一化的左侧状态条 (Tech Accent Bar) */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '20%',
                  bottom: '20%',
                  width: 3,
                  borderRadius: '0 2px 2px 0',
                  background: isRoot ? '#fff' : (isConfigurable ? BOM_COLORS.configurableBorder : (sourceColors?.border ?? token.colorTextSecondary)),
                  opacity: isRoot ? 0.8 : 1,
                  transition: 'all 0.3s ease',
                }} />
                {!isRoot && (
                  <span style={{ marginRight: 6, cursor: 'move', color: BOM_COLORS.textMuted, display: 'flex', alignItems: 'center' }}>
                     <DragOutlined />
                  </span>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                  <span style={{ 
                    color: isRoot ? '#fff' : BOM_COLORS.textPrimary, 
                    fontSize: isRoot ? 16 : 13,
                    fontWeight: isRoot ? 600 : 500,
                    whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </span>
                  {processRouteName && (
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      color: isRoot ? 'rgba(255,255,255,0.9)' : BOM_COLORS.textMuted,
                    }}>
                      <RouteIcon style={{ fontSize: 12 }} />
                      {processRouteName}
                    </span>
                  )}
                </div>
                {((isRoot && data.data?.version) || (!isRoot && data.data?.bomVersion)) && (
                  <span
                    title={t('app.master-data.bom.versionLabel')}
                    style={{
                      marginLeft: 6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      paddingLeft: 6,
                      paddingRight: 6,
                      height: 20,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #d4af37 0%, #b8960c 100%)',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                  >
                    V{data.data?.version || data.data?.bomVersion}
                  </span>
                )}
                {showStackIcon && (() => {
                  let count = (data.data?.configurableCount ?? data.data?.alternativeCount ?? 0) as number;
                  if (count === 0 && typeof label === 'string') {
                    const match = label.match(/等(\d+)种/);
                    if (match) count = parseInt(match[1], 10);
                  }
                  return (
                    <span
                      title={isConfigurable ? t('app.master-data.bom.isConfigurable') : t('app.master-data.bom.alternativeTitle')}
                      style={{
                        marginLeft: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 20,
                        height: 20,
                        paddingLeft: count > 9 ? 4 : 0,
                        paddingRight: count > 9 ? 4 : 0,
                        borderRadius: 10,
                        background: isConfigurable ? BOM_COLORS.configurableBorder : '#f59e0b',
                        color: '#fff',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {count > 0 ? count : '?'}
                    </span>
                  );
                })()}
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
              color: isRoot ? BOM_COLORS.root : BOM_COLORS.dragActive,
              isSelected,
              style: {
                fill: isRoot ? BOM_COLORS.root : BOM_COLORS.defaultBg,
                stroke: isRoot ? BOM_COLORS.root : BOM_COLORS.defaultBorder,
                radius: 8,
                ...(isSelected ? { stroke: BOM_COLORS.root, lineWidth: 3, shadowBlur: 10, shadowColor: BOM_COLORS.rootRing } : {})
              },
              textStyle: {
                fill: isRoot ? '#fff' : BOM_COLORS.textPrimary,
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
                 messageApi.warning(t('app.master-data.bom.cannotMoveToPosition'));
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
    <>
    <style>{`.bom-alternative-list .ant-list-item-main, .bom-configurable-list .ant-list-item-main { min-width: 0; }`}</style>
    <CanvasPageTemplate
      functionalTitle="BOM设计"
      style={{
        height: getViewportHeightExpr(SYSTEM_VIEWPORT_OFFSETS.BOM_DESIGNER_PX, {
          compensateHeaderInFullscreen: true,
        }),
      }}
      toolbar={
        <Space>
          <Select
            value={resolvedVersion ?? version ?? undefined}
            loading={versionOptionsLoading}
            options={
              versionOptions.length > 0
                ? versionOptions
                : (resolvedVersion ?? version)
                  ? [{ value: resolvedVersion ?? version ?? '', label: resolvedVersion ?? version ?? '' }]
                  : []
            }
            placeholder={t('app.master-data.bom.versionSwitchPlaceholder')}
            style={{ minWidth: 120 }}
            onChange={(v) => {
              if (v) {
                setSearchParams(
                  (prev) => {
                    const next = new URLSearchParams(prev);
                    next.set('version', v);
                    return next;
                  },
                  { replace: true }
                );
              }
            }}
            allowClear={false}
          />
          {isReadOnly ? (
            <>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSaveAsNewVersion}
                title={t('app.master-data.bom.approvedBomSaveAsNewVersion')}
              >
                {t('app.master-data.bom.saveAsNewVersionBtn')}
              </Button>
              <Button
                icon={<CloseCircleOutlined />}
                onClick={handleOpenSetObsolete}
                title={t('app.master-data.bom.setObsoleteTitle')}
              >
                {t('app.master-data.bom.setObsolete')}
              </Button>
            </>
          ) : (
            <>
              <Button
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
                title={t('app.master-data.bom.saveDraftTitle')}
              >
                {t('app.master-data.bom.saveDraft')}
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSaveAndPublish}
                title={t('app.master-data.bom.saveAndPublishTitle')}
              >
                {t('app.master-data.bom.saveAndPublish')}
              </Button>
            </>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadBOMData()}
            title={t('app.master-data.bom.refresh')}
          >
            {t('app.master-data.bom.refresh')}
          </Button>
          <Button
            icon={<CopyOutlined />}
            onClick={handleOpenCopyBomModal}
            title={t('app.master-data.bom.copyBomTitle')}
          >
            {t('app.master-data.bom.copyBomBtn')}
          </Button>
          <Button
            icon={<DiffOutlined />}
            onClick={handleOpenVersionCompareModal}
            title={t('app.master-data.bom.versionCompareTitle')}
          >
            {t('app.master-data.bom.versionCompareBtn')}
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleCancel}>
            {t('app.master-data.bom.back')}
          </Button>
        </Space>
      }
      canvas={
        <div 
          ref={canvasRef}
          tabIndex={-1} // Allow div to be focused
          style={{ width: '100%', height: '100%', position: 'relative', outline: 'none', ...CANVAS_GRID_STYLE }}
        >
          {/* 调试标示：如果能看到这个文字和背景色变化，说明代码已更新 */}
          <div style={{ position: 'absolute', right: 12, top: 12, color: BOM_COLORS.root, fontSize: 10, opacity: 0.5, zIndex: 100 }}>
            Render Mode: High-Performance Optimized
          </div>
          {/* 画板左上角：常用键盘快捷键（可收起/展开） */}
          {guideExpanded ? (
            <div
              style={{
                position: 'absolute',
                left: 12,
                top: 12,
                zIndex: 10,
                padding: '12px 16px',
                background: BOM_COLORS.defaultBg,
                borderRadius: 10,
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
                fontSize: 12,
                color: BOM_COLORS.textPrimary,
                border: `1px solid ${BOM_COLORS.defaultBorder}`,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${token.colorBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{t('app.master-data.bom.operationGuide')}</span>
                <Space>
                  <span style={{ fontSize: 10, color: BOM_COLORS.textMuted, fontWeight: 400 }}>{t('app.master-data.bom.shortcuts')}</span>
                  <Button
                    type="text"
                    size="small"
                    icon={<LeftOutlined />}
                    onClick={() => setGuideExpanded(false)}
                    title={t('app.master-data.bom.collapseGuide')}
                  />
                </Space>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 8, columnGap: 16, alignItems: 'center', justifyItems: 'start' }}>
                 <span style={KBD_STYLE}>F2</span>
                 <span>{t('app.master-data.bom.editNodeMaterial')}</span>

                 <span style={KBD_STYLE}>Enter</span>
                 <span>{t('app.master-data.bom.saveOrAddSibling')}</span>

                 <span style={KBD_STYLE}>Tab</span>
                 <span>{t('app.master-data.bom.addChildNode')}</span>

                 <span style={KBD_STYLE}>Esc</span>
                 <span>{t('app.master-data.bom.exitEditOrCancel')}</span>

                 <span>
                   <span style={KBD_STYLE}>Ctrl</span>+<span style={KBD_STYLE}>Z</span>
                 </span>
                 <span>{t('app.master-data.bom.undo')}</span>

                 <span style={{ display: 'flex', gap: 2 }}>
                   <span style={KBD_STYLE}>↑</span><span style={KBD_STYLE}>↓</span>
                   <span style={KBD_STYLE}>←</span><span style={KBD_STYLE}>→</span>
                 </span>
                 <span>{t('app.master-data.bom.switchNode')}</span>

                 <span>
                   <span style={KBD_STYLE}>Ctrl</span>+<span style={KBD_STYLE}>E</span>
                 </span>
                 <span>{t('app.master-data.bom.editMaterialShortcut')}</span>
              </div>

              <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px dashed ${token.colorBorderSecondary}`, color: BOM_COLORS.textMuted, fontSize: 11 }}>
                 <div>• {t('app.master-data.bom.dragHandleLeft')} <DragOutlined /> {t('app.master-data.bom.dragHandleRight')}</div>
                 <div>• {t('app.master-data.bom.shortcutsFocusHint')}</div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setGuideExpanded(true)}
              title={t('app.master-data.bom.expandGuide')}
              style={{
                position: 'absolute',
                left: 12,
                top: 12,
                zIndex: 10,
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: token.colorBgElevated,
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
                border: `1px solid ${token.colorBorderSecondary}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                color: token.colorTextSecondary,
              }}
              onMouseEnter={(e) => {
                 e.currentTarget.style.color = token.colorPrimary;
                 e.currentTarget.style.borderColor = token.colorPrimary;
                 e.currentTarget.style.background = token.colorBgContainer;
              }}
              onMouseLeave={(e) => {
                 e.currentTarget.style.color = token.colorTextSecondary;
                 e.currentTarget.style.borderColor = token.colorBorderSecondary;
                 e.currentTarget.style.background = token.colorBgElevated;
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                <rect x="3" y="7" width="18" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M7 10H7.01M10 10H10.01M14 10H14.01M17 10H17.01M7 14H7.01M10 14H14M17 14H17.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
          )}

          {/* 画板左下角：物料来源颜色图例 */}
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              zIndex: 10,
              padding: '10px 14px',
              background: BOM_COLORS.defaultBg,
              borderRadius: 10,
              boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
              fontSize: 12,
              color: BOM_COLORS.textPrimary,
              border: `1px solid ${BOM_COLORS.defaultBorder}`,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>{t('app.master-data.bom.materialSource')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.keys(SOURCE_TYPE_COLORS).map((key) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: SOURCE_TYPE_NODE_COLORS[key]?.bg ?? BOM_COLORS.defaultBg,
                      border: `1px solid ${SOURCE_TYPE_NODE_COLORS[key]?.border ?? BOM_COLORS.defaultBorder}`,
                    }}
                  />
                  <span>{getSourceTypeLabel(key)}</span>
                </div>
              ))}
            </div>
          </div>

          {mindMapConfig ? (
            <MindMap key={`bom-mindmap-${mindMapDataSafe?.id || 'empty'}`} {...(mindMapConfig as any)} />
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
              <p style={{ color: BOM_COLORS.textMuted }}>{t('app.master-data.bom.noBomData')}</p>
              <Button
                icon={<PlusOutlined />}
                onClick={() => handleAddChildNodeCallback('root')}
              >
                {t('app.master-data.bom.addChildMaterial')}
              </Button>
            </div>
          )}
        </div>
      }
      rightPanel={{
        title: selectedNode ? (
          selectedNode.id === 'root' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
              <span>{t('app.master-data.bom.mainMaterialInfo')}</span>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleAddChildNodeCallback('root')}
              >
                {t('app.master-data.bom.addChildMaterial')}
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
              <span>{t('app.master-data.bom.materialNodeConfig')}</span>
              <Space size="small">
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => selectedNodeId && handleAddChildNodeCallback(selectedNodeId)}
                >
                  {t('app.master-data.bom.addChildMaterial')}
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => selectedNodeId && selectedNodeId !== 'root' && handleDeleteNodeCallback(selectedNodeId)}
                >
                  {t('app.master-data.bom.deleteNode')}
                </Button>
              </Space>
            </div>
          )
        ) : (
          t('app.master-data.bom.nodeConfig')
        ),
        children: selectedNode ? (
          selectedNode.id === 'root' ? (
            <div>
              <p><strong>{t('app.master-data.bom.materialCode')}</strong>{rootMaterial.code}</p>
              <p><strong>{t('app.master-data.bom.materialName')}</strong>{rootMaterial.name}</p>
              <p style={{ marginTop: 12 }}>
                <strong>{t('app.master-data.bom.materialSource')}：</strong>{' '}
                <Space>
                  {(rootMaterial.sourceType || (rootMaterial as any).source_type) ? (
                    <Tag color={SOURCE_TYPE_COLORS[rootMaterial.sourceType || (rootMaterial as any).source_type] ?? 'default'}>
                      {getSourceTypeLabel(rootMaterial.sourceType || (rootMaterial as any).source_type)}
                    </Tag>
                  ) : (
                    <span style={{ color: BOM_COLORS.textMuted }}>{t('app.master-data.bom.notSet')}</span>
                  )}
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openMaterialEditModal()}
                  >
                    {t('app.master-data.bom.editMaterial')}
                  </Button>
                </Space>
              </p>
              <p style={{ color: BOM_COLORS.textMuted, fontSize: 12, marginTop: 16 }}>
                {t('app.master-data.bom.mainMaterialCannotEdit')}
              </p>
              {rootMaterial && isFabricationMaterial(rootMaterial) && (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 16 }}
                  message={t('app.master-data.fabricationWizard.introTitle')}
                  description={
                    <Space orientation="vertical" size={8}>
                      <span>{t('app.master-data.fabricationWizard.promptAfterCreate')}</span>
                      <Button
                        type="primary"
                        size="small"
                        onClick={() => openFabricationWizard(rootMaterial, 'root')}
                      >
                        {t('app.master-data.fabricationWizard.configureRawMaterial')}
                      </Button>
                    </Space>
                  }
                />
              )}
            </div>
          ) : (
            <>
              {loadingSubBomNodeId === selectedNodeId && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spin size="small" />
                  <span style={{ color: '#0369a1', fontSize: 13 }}>{t('app.master-data.bom.loadingSubBom')}</span>
                </div>
              )}
              <Form form={nodeConfigForm} layout="vertical">
              <UniMaterialSelect
                name="materialId"
                label={t('app.master-data.bom.selectMaterial')}
                placeholder={t('app.master-data.bom.selectMaterialPlaceholder')}
                required
                fillMapping={{ unit: 'baseUnit' }}
                formItemProps={{
                  rules: [{ required: true, message: t('app.master-data.bom.selectMaterialRequired') }],
                  style: { marginBottom: 24 },
                }}
                showQuickCreate
                quickCreate={{
                  label: t('app.master-data.bom.quickCreateMaterial'),
                  onClick: () => setCreateMaterialModalVisible(true),
                }}
                showAdvancedSearch
                fallbackOption={
                  newCreatedMaterial
                    ? {
                        value: newCreatedMaterial.id,
                        label: `${(newCreatedMaterial as any).mainCode ?? (newCreatedMaterial as any).main_code ?? ''} - ${newCreatedMaterial.name}`.trim() || String(newCreatedMaterial.id),
                      }
                    : selectedNode?.material && selectedNode?.componentId
                      ? {
                          value: selectedNode.componentId,
                          label: `${(selectedNode.material as any).mainCode ?? (selectedNode.material as any).main_code ?? (selectedNode.material as any).code ?? ''} - ${selectedNode.material.name}`.trim() || String(selectedNode.componentId),
                        }
                      : undefined
                }
                onChange={(_, material) => {
                  setSelectedMaterialInForm(material ?? null);
                  if (material) {
                    setNewCreatedMaterial(null);
                    const variantManaged = (material as any).variantManaged ?? (material as any).variant_managed ?? false;
                    nodeConfigForm.setFieldsValue({
                      isConfigurable: variantManaged ? true : nodeConfigForm.getFieldValue('isConfigurable'),
                      issueMethod: resolveIssueMethodForNode(null, material),
                    });
                    if (nodeConfigForm.getFieldValue('isConfigurable') || nodeConfigForm.getFieldValue('isAlternative')) {
                      setTimeout(() => handleSaveNodeConfig(), 0);
                    }
                  }
                }}
              />
              {selectedMaterial && (
                <Form.Item label={t('app.master-data.bom.materialSource')}>
                  <Space>
                    {(selectedMaterial.sourceType || (selectedMaterial as any).source_type) ? (
                      <Tag color={SOURCE_TYPE_COLORS[selectedMaterial.sourceType || (selectedMaterial as any).source_type] ?? 'default'}>
                        {getSourceTypeLabel(selectedMaterial.sourceType || (selectedMaterial as any).source_type)}
                      </Tag>
                    ) : (
                      <span style={{ color: '#faad14' }}>{t('app.master-data.bom.notSetConfigInMaterial')}</span>
                    )}
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openMaterialEditModal(selectedMaterial)}
                    >
                      {t('app.master-data.bom.editMaterial')}
                    </Button>
                  </Space>
                </Form.Item>
              )}
              {selectedMaterial && (
                <Form.Item label={t('app.master-data.bom.processRouteLabel')}>
                  <Space>
                    {selectedMaterial.processRouteName ?? (selectedMaterial as any).process_route_name ? (
                      <span>{selectedMaterial.processRouteName ?? (selectedMaterial as any).process_route_name}</span>
                    ) : (
                      <span style={{ color: BOM_COLORS.textMuted }}>{t('app.master-data.bom.processRouteNotSet')}</span>
                    )}
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      loading={processRouteEditLoading}
                      disabled={!(selectedMaterial.processRouteId ?? (selectedMaterial as any).process_route_id)}
                      onClick={openProcessRouteEditModal}
                    >
                      {t('app.master-data.bom.editProcessRoute')}
                    </Button>
                  </Space>
                </Form.Item>
              )}
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name="quantity"
                    label={t('app.master-data.bom.quantity')}
                    rules={[
                      { required: true, message: t('app.master-data.bom.quantityRequired') },
                      { type: 'number', min: 0.0001, message: t('app.master-data.bom.quantityMin') },
                    ]}
                  >
                    <InputNumber
                      placeholder={t('app.master-data.bom.quantityPlaceholder')}
                      precision={4}
                      style={{ width: '100%' }}
                      min={0.0001}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="unit" label={t('app.master-data.bom.unit')} rules={[{ required: true, message: t('app.master-data.bom.unitRequired') }]}>
                    <Select
                      placeholder={selectedMaterial ? t('app.master-data.bom.unitPlaceholder') : t('app.master-data.bom.selectMaterialFirst')}
                      options={unitOptionsFromMaterial}
                      disabled={!selectedMaterial}
                      allowClear={false}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="wasteRate"
                    label={t('app.master-data.bom.wasteRate')}
                    rules={[{ type: 'number', min: 0, max: 100, message: t('app.master-data.bom.wasteRateRange') }]}
                  >
                    <InputNumber
                      placeholder={t('app.master-data.bom.wasteRatePlaceholder')}
                      precision={2}
                      style={{ width: '100%' }}
                      min={0}
                      max={100}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="issueMethod"
                label={t('app.master-data.bom.issueMethod')}
                tooltip={t('app.master-data.bom.issueMethodTooltip')}
                initialValue="pick"
              >
                <Select options={issueMethodOptions} />
              </Form.Item>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="isRequired" label={t('app.master-data.bom.isRequired')} valuePropName="checked">
                    <Switch checkedChildren={t('app.master-data.bom.yes')} unCheckedChildren={t('app.master-data.bom.no')} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="isConfigurable"
                    label={t('app.master-data.bom.isConfigurable')}
                    valuePropName="checked"
                    tooltip={t('app.master-data.bom.isConfigurableTooltip')}
                  >
                    <Switch
                      checkedChildren={t('app.master-data.bom.yes')}
                      unCheckedChildren={t('app.master-data.bom.no')}
                      onChange={(checked) => {
                        nodeConfigForm.setFieldsValue({
                          isConfigurable: checked,
                          ...(checked ? { isAlternative: false, alternativeGroupId: null } : {}),
                        });
                        if (checked && nodeConfigForm.getFieldValue('materialId')) {
                          setTimeout(() => handleSaveNodeConfig(), 0);
                        }
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="isAlternative"
                    label={t('app.master-data.bom.alternativeTitle')}
                    valuePropName="checked"
                    tooltip={t('app.master-data.bom.alternativeTitleTooltip')}
                  >
                    <Switch
                      checkedChildren={t('app.master-data.bom.yes')}
                      unCheckedChildren={t('app.master-data.bom.no')}
                      onChange={(checked) => {
                        nodeConfigForm.setFieldsValue({
                          isAlternative: checked,
                          ...(checked
                            ? { isConfigurable: false, configurableGroupId: null, isDefaultConfigurable: false }
                            : {}),
                        });
                        if (checked && nodeConfigForm.getFieldValue('materialId')) {
                          setTimeout(() => handleSaveNodeConfig(), 0);
                        }
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.isConfigurable !== curr?.isConfigurable}>
                {({ getFieldValue }) =>
                  getFieldValue('isConfigurable') ? (
                    <>
                      {selectedMaterial?.variantManaged ?? (selectedMaterial as any)?.variant_managed ? (
                        (() => {
                          const va = selectedMaterial?.variantAttributes ?? (selectedMaterial as any)?.variant_attributes;
                          if (!va || typeof va !== 'object') return null;
                          const entries = Object.entries(va);
                          if (entries.length === 0) return null;
                          const formatValue = (v: unknown): React.ReactNode => {
                            if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))).join('、');
                            if (typeof v === 'object' && v !== null) return JSON.stringify(v);
                            return String(v ?? '');
                          };
                          return (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontWeight: 500, marginBottom: 6 }}>{t('app.master-data.bom.variantAttributesLabel')}</div>
                              <Descriptions
                                size="small"
                                column={1}
                                bordered
                                labelStyle={{ width: 100, background: '#f8fafc', fontSize: 12 }}
                                contentStyle={{ fontSize: 12 }}
                              >
                                {entries.map(([key, val]) => (
                                  <Descriptions.Item key={key} label={key}>
                                    {formatValue(val)}
                                  </Descriptions.Item>
                                ))}
                              </Descriptions>
                            </div>
                          );
                        })()
                      ) : (
                        <>
                          <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('app.master-data.bom.optionalMaterialsList')}</div>
                          <List
                            size="small"
                            dataSource={effectiveConfigurableOptions}
                            style={{ marginBottom: 8, maxHeight: 160, overflow: 'auto' }}
                            className="bom-configurable-list"
                            renderItem={(item: { material?: Material | null; node?: MindMapNode; isCurrent?: boolean }) => {
                              const mat = item.material;
                              const code = (mat as any)?.mainCode ?? (mat as any)?.main_code ?? '';
                              const name = mat?.name ?? (item.node as MindMapNode)?.value ?? '';
                              const canRemove = !!(item as any).node;
                              return (
                                <List.Item
                                  style={{ paddingTop: 4, paddingBottom: 4, alignItems: 'center' }}
                                  actions={canRemove ? [
                                    <Button
                                      type="text"
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={() => (item as any).node?.id && handleRemoveAlternativeOrConfigurableNode((item as any).node.id)}
                                      aria-label={t('app.master-data.bom.removeOption')}
                                    />,
                                  ] : undefined}
                                >
                                  <span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', minWidth: 0 }}>
                                    {code} - {name}
                                  </span>
                                </List.Item>
                              );
                            }}
                          />
                          <Form.Item>
                            <Button type="dashed" icon={<PlusOutlined />} onClick={handleOpenAddConfigurableOptionModal} block>
                              {t('app.master-data.bom.addConfigurableOption')}
                            </Button>
                          </Form.Item>
                        </>
                      )}
                    </>
                  ) : null
                }
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.isAlternative !== curr?.isAlternative}>
                {({ getFieldValue }) =>
                  getFieldValue('isAlternative') ? (
                    <>
                      <div style={{ marginBottom: 6, fontWeight: 500 }}>{t('app.master-data.bom.alternativeMaterialsList')}</div>
                      <List
                        size="small"
                        dataSource={effectiveAlternativeOptions}
                        rowKey={(item: { material?: Material | null; node?: MindMapNode; isCurrent?: boolean }) =>
                          item?.node?.id ?? `alt-${item?.material?.id ?? 'row'}`
                        }
                        style={{ marginBottom: 8, maxHeight: 160, overflow: 'auto' }}
                        className="bom-alternative-list"
                        renderItem={(item: { material?: Material | null; node?: MindMapNode; isCurrent?: boolean }, idx: number) => {
                          const mat = item.material;
                          const code = (mat as any)?.mainCode ?? (mat as any)?.main_code ?? '';
                          const name = mat?.name ?? (item.node as MindMapNode)?.value ?? '';
                          const hasNode = !!(item as any).node;
                          const isMainRow = (item as any).isCurrent === true;
                          const canRemove = hasNode && !isMainRow;
                          return (
                            <List.Item
                              style={{ paddingTop: 4, paddingBottom: 4, alignItems: 'center' }}
                              actions={canRemove ? [
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={() => (item as any).node?.id && handleRemoveAlternativeOrConfigurableNode((item as any).node.id)}
                                  aria-label={t('app.master-data.bom.removeOption')}
                                />,
                              ] : undefined}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = 'move';
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!hasNode) return;
                                if (isMainRow) return;
                                try {
                                  const rawJson = e.dataTransfer.getData('application/json');
                                  const rawText = e.dataTransfer.getData('text/plain');
                                  let fromIndex: number | undefined;
                                  if (rawJson) {
                                    const payload = JSON.parse(rawJson);
                                    fromIndex = payload?.index;
                                  } else if (rawText !== '' && /^\d+$/.test(rawText)) {
                                    fromIndex = parseInt(rawText, 10);
                                  }
                                  if (typeof fromIndex === 'number' && fromIndex !== idx) {
                                    handleReorderAlternativeByListIndices(fromIndex, idx);
                                  }
                                } catch (_) {}
                              }}
                            >
                              <div
                                role="button"
                                tabIndex={0}
                                draggable={hasNode}
                                onDragStart={hasNode ? (e: React.DragEvent) => {
                                e.dataTransfer.setData('application/json', JSON.stringify({ index: idx }));
                                e.dataTransfer.setData('text/plain', String(idx));
                                e.dataTransfer.effectAllowed = 'move';
                                e.stopPropagation();
                                } : undefined}
                                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: hasNode ? 'grab' : 'default', userSelect: 'none', minWidth: 0, flex: 1 }}
                              >
                                <span
                                  style={{
                                    flexShrink: 0,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    background: '#f59e0b',
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: 600,
                                  }}
                                >
                                  {idx + 1}
                                </span>
                                {hasNode && <DragOutlined style={{ flexShrink: 0, color: BOM_COLORS.textMuted }} />}
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                  {code} - {name}
                                </span>
                              </div>
                            </List.Item>
                          );
                        }}
                      />
                      <Form.Item>
                        <Button type="dashed" icon={<PlusOutlined />} onClick={handleOpenAddAlternativeOptionModal} block>
                          {t('app.master-data.bom.addAlternativeOption')}
                        </Button>
                      </Form.Item>
                    </>
                  ) : null
                }
              </Form.Item>
              
              {/* Visual Focus Hint */}
              <div style={{ 
                margin: '16px 0', 
                padding: '10px 12px', 
                background: '#f8fafc', 
                border: `1px dashed ${BOM_COLORS.defaultBorder}`,
                borderRadius: 8,
                fontSize: 12,
                color: BOM_COLORS.textPrimary
              }}>
                {t('app.master-data.bom.editCompleteHint')}
              </div>

              <Form.Item>
                <Space>
                  <Button type="primary" onClick={handleSaveNodeConfig}>{t('app.master-data.bom.save')}</Button>
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
                    {t('app.master-data.bom.deselectEsc')}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
            </>
          )
        ) : (
          <div style={{ textAlign: 'center', color: BOM_COLORS.textMuted, padding: '40px 0' }}>
            <p>{t('app.master-data.bom.clickNodeToEdit')}</p>
          </div>
        ),
      }}
    />
    {/* 物料编辑弹窗（直接打开，不跳转页面） */}
    <MaterialForm
      key={materialEditModalVisible && materialToEdit ? materialToEdit.uuid : 'closed'}
      open={materialEditModalVisible}
      onClose={() => {
        setMaterialEditModalVisible(false);
        setMaterialToEdit(null);
      }}
      onFinish={handleMaterialEditSubmit}
      isEdit={true}
      material={materialToEdit || undefined}
      materialGroups={materialGroups}
      loading={materialFormLoading}
      initialValues={
        materialToEdit
          ? {
              mainCode:
                materialToEdit.mainCode ??
                (materialToEdit as any).main_code ??
                (materialToEdit as any).code ??
                '',
              name: materialToEdit.name ?? '',
              groupId: materialToEdit.groupId ?? (materialToEdit as any).group_id ?? undefined,
              sourceType:
                (materialToEdit as any).sourceType ??
                (materialToEdit as any).source_type ??
                undefined,
              specification: materialToEdit.specification ?? (materialToEdit as any).specification,
              baseUnit:
                materialToEdit.baseUnit ?? (materialToEdit as any).base_unit ?? DEFAULT_MATERIAL_BASE_UNIT,
              batchManaged:
                materialToEdit.batchManaged ?? (materialToEdit as any).batch_managed ?? false,
              variantManaged:
                materialToEdit.variantManaged ?? (materialToEdit as any).variant_managed ?? false,
              variantAttributes:
                materialToEdit.variantAttributes ??
                (materialToEdit as any).variant_attributes,
              description: materialToEdit.description ?? (materialToEdit as any).description,
              brand: materialToEdit.brand ?? (materialToEdit as any).brand,
              model: materialToEdit.model ?? (materialToEdit as any).model,
              texture: materialToEdit.texture ?? (materialToEdit as any).texture,
              isActive:
                materialToEdit.isActive ?? (materialToEdit as any).is_active ?? true,
            }
          : undefined
      }
    />
    {/* 新建物料弹窗（从节点配置「快速新建」打开，创建成功后自动选中并回填单位） */}
    <MaterialForm
      key={createMaterialModalVisible ? 'create' : 'closed'}
      open={createMaterialModalVisible}
      onClose={() => {
        setCreateMaterialModalVisible(false);
      }}
      onFinish={async (values) => {
        setMaterialFormLoading(true);
        try {
          const created = await materialApi.create(values as MaterialCreate);
          setNewCreatedMaterial(created);
          setSelectedMaterialInForm(created);
          const baseUnit = (created as any).base_unit ?? created.baseUnit ?? '';
          nodeConfigForm.setFieldsValue({
            materialId: created.id,
            unit: baseUnit,
          });
          setCreateMaterialModalVisible(false);
          messageApi.success(t('common.createSuccess'));
        } catch (e: any) {
          messageApi.error(e?.message ?? t('common.createFailed'));
          throw e;
        } finally {
          setMaterialFormLoading(false);
        }
      }}
      isEdit={false}
      materialGroups={materialGroups}
      loading={materialFormLoading}
    />
    {/* 未启用属性时：在「可选物料」列表中直接添加（选料后追加，不新建空白节点） */}
    <Modal
      title={t('app.master-data.bom.addConfigurableOption')}
      open={addConfigurableOptionModalVisible}
      onCancel={() => {
        setAddConfigurableOptionModalVisible(false);
        setAddConfigurableOptionMaterial(null);
      }}
      onOk={() => {
        if (addConfigurableOptionMaterial) {
          handleAddConfigurableOptionWithMaterial(addConfigurableOptionMaterial);
        }
      }}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      destroyOnHidden
      okButtonProps={{ disabled: !addConfigurableOptionMaterial }}
    >
      <div style={{ marginBottom: 8 }}>{t('app.master-data.bom.optionalMaterialsList')}</div>
      <Select
        placeholder={t('app.master-data.bom.selectMaterialFirst')}
        showSearch
        optionFilterProp="label"
        value={addConfigurableOptionMaterial?.id ?? undefined}
        onChange={(id) => setAddConfigurableOptionMaterial(materials.find((m) => m.id === id) ?? null)}
        options={materials
          .filter(
            (m) =>
              m.id !== selectedMaterial?.id &&
              !configurableSiblings.some(
                (s) => (s.componentId ?? (s.material as any)?.id) === m.id
              )
          )
          .map((m) => ({
            value: m.id,
            label: `${(m as any).mainCode ?? (m as any).main_code ?? ''} - ${m.name}`,
          }))}
        style={{ width: '100%' }}
        allowClear
        onClear={() => setAddConfigurableOptionMaterial(null)}
      />
    </Modal>
    {/* 添加可替代物料弹窗（与配置位一致：选料后追加，可继续添加或保存） */}
    <Modal
      title={t('app.master-data.bom.addAlternativeOption')}
      open={addAlternativeOptionModalVisible}
      onCancel={() => {
        setAddAlternativeOptionModalVisible(false);
        setAddAlternativeOptionMaterial(null);
      }}
      onOk={() => {
        if (addAlternativeOptionMaterial) {
          handleAddAlternativeOptionWithMaterial(addAlternativeOptionMaterial);
        }
      }}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      destroyOnHidden
      okButtonProps={{ disabled: !addAlternativeOptionMaterial }}
    >
      <div style={{ marginBottom: 8 }}>{t('app.master-data.bom.alternativeMaterialsList')}</div>
      <Select
        placeholder={t('app.master-data.bom.selectMaterialFirst')}
        showSearch
        optionFilterProp="label"
        value={addAlternativeOptionMaterial?.id ?? undefined}
        onChange={(id) => setAddAlternativeOptionMaterial(materials.find((m) => m.id === id) ?? null)}
        options={materials
          .filter(
            (m) =>
              m.id !== selectedMaterial?.id &&
              !alternativeSiblings.some(
                (s) => (s.componentId ?? (s.material as any)?.id) === m.id
              )
          )
          .map((m) => ({
            value: m.id,
            label: `${(m as any).mainCode ?? (m as any).main_code ?? ''} - ${m.name}`,
          }))}
        style={{ width: '100%' }}
        allowClear
        onClear={() => setAddAlternativeOptionMaterial(null)}
      />
    </Modal>
    {/* 复制BOM：选择新根物料，以当前结构生成新BOM（强制更换根节点） */}
    <Modal
      title={t('app.master-data.bom.copyBomTitle')}
      open={copyBomModalVisible}
      onCancel={() => {
        setCopyBomModalVisible(false);
        setCopyBomNewRootMaterial(null);
      }}
      onOk={() => handleCopyBomSubmit()}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      destroyOnHidden
      confirmLoading={copyBomLoading}
      okButtonProps={{ disabled: !copyBomNewRootMaterial }}
    >
      <p style={{ marginBottom: 12 }}>{t('app.master-data.bom.copyBomNewRootHint')}</p>
      <Form.Item label={t('app.master-data.bom.copyBomNewRootLabel')} required>
        <Select
          placeholder={t('app.master-data.bom.copyBomNewRootPlaceholder')}
          showSearch
          optionFilterProp="label"
          value={copyBomNewRootMaterial?.id ?? undefined}
          onChange={(id) => setCopyBomNewRootMaterial(materials.find((m) => m.id === id) ?? null)}
          options={materials
            .filter((m) => m.id !== rootMaterial?.id)
            .map((m) => ({
              value: m.id,
              label: `${(m as any).mainCode ?? (m as any).main_code ?? ''} - ${m.name}`,
            }))}
          style={{ width: '100%' }}
          allowClear
          onClear={() => setCopyBomNewRootMaterial(null)}
          notFoundContent={materials.length === 0 ? t('common.loading') : undefined}
        />
      </Form.Item>
    </Modal>
    {/* 版本比对弹窗 */}
    <Modal
      title={t('app.master-data.bom.versionCompareTitle')}
      open={versionCompareModalVisible}
      onCancel={() => {
        setVersionCompareModalVisible(false);
        setVersionCompareResult(null);
        setVersionCompareV1(null);
        setVersionCompareV2(null);
      }}
      footer={[
        versionCompareResult ? (
          <Button
            key="again"
            onClick={() => {
              setVersionCompareResult(null);
              setVersionCompareV1(null);
              setVersionCompareV2(null);
            }}
          >
            {t('app.master-data.bom.versionCompareAgain')}
          </Button>
        ) : null,
        <Button
          key="close"
          type={versionCompareResult ? 'primary' : undefined}
          onClick={() => {
            setVersionCompareModalVisible(false);
            setVersionCompareResult(null);
            setVersionCompareV1(null);
            setVersionCompareV2(null);
          }}
        >
          {t('common.close')}
        </Button>,
      ]}
      width={720}
      destroyOnHidden
    >
      {!versionCompareResult ? (
        <Space orientation="vertical" style={{ width: '100%' }} size="middle">
          <Form.Item label={t('app.master-data.bom.versionCompareSelectHint')}>
            <Space wrap>
              <Select
                placeholder={t('app.master-data.bom.version1')}
                value={versionCompareV1 ?? undefined}
                onChange={setVersionCompareV1}
                options={versionOptions.map((o) => ({ value: o.value, label: o.label }))}
                style={{ minWidth: 120 }}
                allowClear
              />
              <span>{t('app.master-data.bom.versionCompareVs')}</span>
              <Select
                placeholder={t('app.master-data.bom.version2')}
                value={versionCompareV2 ?? undefined}
                onChange={setVersionCompareV2}
                options={versionOptions.map((o) => ({ value: o.value, label: o.label }))}
                style={{ minWidth: 120 }}
                allowClear
              />
            </Space>
          </Form.Item>
          <Button
            type="primary"
            icon={<DiffOutlined />}
            loading={versionCompareLoading}
            onClick={() => handleVersionCompareSubmit()}
            disabled={!versionCompareV1 || !versionCompareV2}
          >
            {t('app.master-data.bom.versionCompareDo')}
          </Button>
        </Space>
      ) : (
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 16, color: BOM_COLORS.textMuted, fontSize: 12 }}>
            {versionCompareResult.version1} ↔ {versionCompareResult.version2}
          </div>
          {versionCompareResult.added && versionCompareResult.added.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: '#52c41a', marginBottom: 12 }}>
                {t('app.master-data.bom.versionCompareAdded')}（{versionCompareResult.added.length}{t('app.master-data.bom.versionCompareItem')}）
              </h4>
              <Space orientation="vertical" style={{ width: '100%' }} size="small">
                {versionCompareResult.added.map((item: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f6ffed',
                      border: '1px solid #b7eb8f',
                      borderRadius: 4,
                    }}
                  >
                    <Space wrap>
                      <span>{item.componentName ?? item.component_name ?? getMaterialDisplayName(item.componentId ?? item.component_id)}</span>
                      <span style={{ color: '#999' }}>
                        {item.quantity} {item.unit ?? ''}
                        {item.wasteRate ?? item.waste_rate ? ` (${t('app.master-data.bom.wasteRateTitle')}: ${item.wasteRate ?? item.waste_rate}%)` : ''}
                      </span>
                      {(item.is_configurable ?? item.isConfigurable) && <Tag color="cyan">{t('app.master-data.bom.isConfigurable')}</Tag>}
                      {(item.is_alternative ?? item.isAlternative) && (
                        <Tag color="orange">{t('app.master-data.bom.alternativeLabel')} ({(item.priority ?? 0)})</Tag>
                      )}
                    </Space>
                  </div>
                ))}
              </Space>
            </div>
          )}
          {versionCompareResult.removed && versionCompareResult.removed.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: '#ff4d4f', marginBottom: 12 }}>
                {t('app.master-data.bom.versionCompareRemoved')}（{versionCompareResult.removed.length}{t('app.master-data.bom.versionCompareItem')}）
              </h4>
              <Space orientation="vertical" style={{ width: '100%' }} size="small">
                {versionCompareResult.removed.map((item: any, index: number) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#fff1f0',
                      border: '1px solid #ffccc7',
                      borderRadius: 4,
                    }}
                  >
                    <Space wrap>
                      <span>{item.componentName ?? item.component_name ?? getMaterialDisplayName(item.componentId ?? item.component_id)}</span>
                      <span style={{ color: '#999' }}>
                        {item.quantity} {item.unit ?? ''}
                        {item.wasteRate ?? item.waste_rate ? ` (${t('app.master-data.bom.wasteRateTitle')}: ${item.wasteRate ?? item.waste_rate}%)` : ''}
                      </span>
                      {(item.is_configurable ?? item.isConfigurable) && <Tag color="cyan">{t('app.master-data.bom.isConfigurable')}</Tag>}
                      {(item.is_alternative ?? item.isAlternative) && (
                        <Tag color="orange">{t('app.master-data.bom.alternativeLabel')} ({(item.priority ?? 0)})</Tag>
                      )}
                    </Space>
                  </div>
                ))}
              </Space>
            </div>
          )}
          {versionCompareResult.modified && versionCompareResult.modified.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: '#1890ff', marginBottom: 12 }}>
                {t('app.master-data.bom.versionCompareModified')}（{versionCompareResult.modified.length}{t('app.master-data.bom.versionCompareItem')}）
              </h4>
              <Space orientation="vertical" style={{ width: '100%' }} size="small">
                {versionCompareResult.modified.map((item: any, index: number) => {
                  const v1 = item.version1 ?? {};
                  const v2 = item.version2 ?? {};
                  const name = item.componentName ?? item.component_name ?? getMaterialDisplayName(item.componentId ?? item.component_id);
                  return (
                    <div
                      key={index}
                      style={{
                        padding: 12,
                        backgroundColor: '#e6f7ff',
                        border: '1px solid #91d5ff',
                        borderRadius: 4,
                      }}
                    >
                      <div style={{ marginBottom: 8 }}><strong>{name}</strong></div>
                      <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                        {v1.quantity !== v2.quantity && (
                          <div style={{ paddingLeft: 16 }}>
                            {t('app.master-data.bom.quantityTitle')}：<span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>{v1.quantity}</span>
                            {' → '}<span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.quantity}</span>
                          </div>
                        )}
                        {v1.unit !== v2.unit && (
                          <div style={{ paddingLeft: 16 }}>
                            {t('app.master-data.bom.unitTitle')}：<span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>{v1.unit ?? '-'}</span>
                            {' → '}<span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.unit ?? '-'}</span>
                          </div>
                        )}
                        {(v1.waste_rate ?? v1.wasteRate) !== (v2.waste_rate ?? v2.wasteRate) && (
                          <div style={{ paddingLeft: 16 }}>
                            {t('app.master-data.bom.wasteRateTitle')}：<span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>{v1.waste_rate ?? v1.wasteRate ?? 0}%</span>
                            {' → '}<span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.waste_rate ?? v2.wasteRate ?? 0}%</span>
                          </div>
                        )}
                        {v1.is_required !== v2.is_required && (
                          <div style={{ paddingLeft: 16 }}>
                            {t('app.master-data.bom.isRequiredTitle')}：<span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>{v1.is_required ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}</span>
                            {' → '}<span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.is_required ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}</span>
                          </div>
                        )}
                        {(v1.is_configurable ?? v1.isConfigurable) !== (v2.is_configurable ?? v2.isConfigurable) && (
                          <div style={{ paddingLeft: 16 }}>
                            {t('app.master-data.bom.isConfigurable')}：<span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>{v1.is_configurable ?? v1.isConfigurable ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}</span>
                            {' → '}<span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.is_configurable ?? v2.isConfigurable ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}</span>
                          </div>
                        )}
                        {(v1.configurable_group_id ?? v1.configurableGroupId) !== (v2.configurable_group_id ?? v2.configurableGroupId) && (
                          <div style={{ paddingLeft: 16 }}>
                            {t('app.master-data.bom.configurableGroupIdLabel')}：<span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>{v1.configurable_group_id ?? v1.configurableGroupId ?? '-'}</span>
                            {' → '}<span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.configurable_group_id ?? v2.configurableGroupId ?? '-'}</span>
                          </div>
                        )}
                        {(v1.is_default_configurable ?? v1.isDefaultConfigurable) !== (v2.is_default_configurable ?? v2.isDefaultConfigurable) && (
                          <div style={{ paddingLeft: 16 }}>
                            {t('app.master-data.bom.isDefaultConfigurable')}：<span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>{v1.is_default_configurable ?? v1.isDefaultConfigurable ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}</span>
                            {' → '}<span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.is_default_configurable ?? v2.isDefaultConfigurable ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}</span>
                          </div>
                        )}
                        {(v1.is_alternative ?? v1.isAlternative) !== (v2.is_alternative ?? v2.isAlternative) && (
                          <div style={{ paddingLeft: 16 }}>
                            {t('app.master-data.bom.alternativeLabel')}：<span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>{v1.is_alternative ?? v1.isAlternative ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}</span>
                            {' → '}<span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.is_alternative ?? v2.isAlternative ? t('app.master-data.bom.yes') : t('app.master-data.bom.no')}</span>
                          </div>
                        )}
                        {(v1.alternative_group_id ?? v1.alternativeGroupId) !== (v2.alternative_group_id ?? v2.alternativeGroupId) && (
                          <div style={{ paddingLeft: 16 }}>
                            {t('app.master-data.bom.alternativeGroupIdLabel')}：<span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>{v1.alternative_group_id ?? v1.alternativeGroupId ?? '-'}</span>
                            {' → '}<span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.alternative_group_id ?? v2.alternativeGroupId ?? '-'}</span>
                          </div>
                        )}
                        {Number(v1.priority ?? 0) !== Number(v2.priority ?? 0) && (
                          <div style={{ paddingLeft: 16 }}>
                            {t('app.master-data.bom.priorityTitle')}：<span style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>{v1.priority ?? 0}</span>
                            {' → '}<span style={{ color: '#52c41a', fontWeight: 500 }}>{v2.priority ?? 0}</span>
                          </div>
                        )}
                      </Space>
                    </div>
                  );
                })}
              </Space>
            </div>
          )}
          {(!versionCompareResult.added || versionCompareResult.added.length === 0) &&
            (!versionCompareResult.removed || versionCompareResult.removed.length === 0) &&
            (!versionCompareResult.modified || versionCompareResult.modified.length === 0) && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: BOM_COLORS.textMuted }}>
                {t('app.master-data.bom.noVersionDiff')}
              </div>
            )}
        </div>
      )}
    </Modal>
    {/* 工艺路线编辑弹窗（从节点配置「编辑工艺路线」打开） */}
    <RouteFormModal
      open={processRouteEditModalVisible}
      onClose={() => {
        setProcessRouteEditModalVisible(false);
        setProcessRouteToEditUuid(null);
      }}
      editUuid={processRouteToEditUuid}
      onSuccess={(route) => {
        setSelectedMaterialInForm((prev) =>
          prev ? { ...prev, processRouteName: route.name, process_route_name: route.name } : null
        );
        setProcessRouteEditModalVisible(false);
        setProcessRouteToEditUuid(null);
        messageApi.success(t('common.updateSuccess'));
      }}
    />
    {/* 设为失效 Modal */}
    <Modal
      title={t('app.master-data.bom.setObsoleteTitle')}
      open={obsoleteModalVisible}
      onCancel={() => { setObsoleteModalVisible(false); setObsoleteReason(''); }}
      onOk={handleSetObsoleteSubmit}
      confirmLoading={obsoleteLoading}
      okText={t('app.master-data.bom.ok')}
      cancelText={t('app.master-data.bom.cancel')}
    >
      <p style={{ marginBottom: 8 }}>{t('app.master-data.bom.setObsoleteConfirm')}</p>
      {resolvedVersion && (
        <p style={{ marginBottom: 12, color: '#666' }}>
          {t('app.master-data.bom.versionTitle')} {resolvedVersion}
        </p>
      )}
      <Form.Item label={t('app.master-data.bom.obsoleteReason')}>
        <Input.TextArea
          rows={3}
          value={obsoleteReason}
          onChange={(e) => setObsoleteReason(e.target.value)}
          placeholder={t('app.master-data.bom.obsoleteReason')}
        />
      </Form.Item>
    </Modal>
    <FabricationRawMaterialWizard
      open={fabricationWizardState.open}
      onClose={closeFabricationWizard}
      fabricationMaterial={fabricationWizardState.material}
      onSuccess={() => {
        const nodeId = fabricationWizardState.nodeId;
        if (nodeId === 'root' || !nodeId) {
          loadBOMData();
        } else {
          loadingSubBomForNodeRef.current = null;
          loadSemiProductChildrenIfNeeded(nodeId);
        }
      }}
    />
  </>
  );
};

export default BOMDesignerPage;
