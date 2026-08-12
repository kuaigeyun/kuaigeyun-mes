import { Material } from '../../../types/material';
import { message } from 'antd'; // Add message import if needed or use arg

const DEFAULT_ISSUE_METHOD_BY_SOURCE: Record<string, 'pick' | 'backflush' | 'none'> = {
  Phantom: 'none',
  Service: 'none',
  Buy: 'backflush',
  Make: 'pick',
  Outsource: 'pick',
  Configure: 'pick',
};

export function resolveIssueMethodForNode(
  issueMethod?: string | null,
  material?: Material | null,
): 'pick' | 'backflush' | 'none' {
  const explicit = (issueMethod ?? '').trim().toLowerCase();
  if (explicit === 'pick' || explicit === 'backflush' || explicit === 'none') return explicit;
  const st = material?.sourceType ?? (material as any)?.source_type;
  return DEFAULT_ISSUE_METHOD_BY_SOURCE[st] ?? 'pick';
}

export interface MindMapNode {
  id: string;
  value: string;
  material?: Material;
  quantity?: number;
  unit?: string;
  wasteRate?: number;
  isRequired?: boolean;
  componentId?: number;
  isConfigurable?: boolean;
  configurableGroupId?: number | null;
  isDefaultConfigurable?: boolean;
  isAlternative?: boolean;
  alternativeGroupId?: number | null;
  priority?: number;
  /** 发料方式：pick=领料配料, backflush=倒冲, none=不发料 */
  issueMethod?: 'pick' | 'backflush' | 'none';
  children?: MindMapNode[];
  [key: string]: any;
}

/** 与后端 IntField / PostgreSQL int4 一致；禁止用 Date.now() 当组 ID */
export const BOM_GROUP_ID_INT32_MAX = 2147483647;

export function isSafeBomGroupId(id: unknown): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id > 0 && id <= BOM_GROUP_ID_INT32_MAX;
}

/** 在已占用 ID 中取最小正整数（与 BOM 列表页 getNextAlternativeGroupId 一致） */
export function nextBomGroupId(usedIds: Iterable<number>): number {
  const used = new Set<number>();
  for (const id of usedIds) {
    if (isSafeBomGroupId(id)) used.add(id);
  }
  let next = 1;
  while (used.has(next)) next += 1;
  if (next > BOM_GROUP_ID_INT32_MAX) {
    throw new Error('BOM group id exhausted within int32 range');
  }
  return next;
}

/** 收集整棵树内已占用的替代料 / 配置位组 ID（仅 int32 安全值） */
export function collectBomGroupIds(root: MindMapNode | null | undefined): {
  alternative: number[];
  configurable: number[];
} {
  const alternative: number[] = [];
  const configurable: number[] = [];
  const walk = (n: MindMapNode) => {
    if (isSafeBomGroupId(n.alternativeGroupId)) alternative.push(n.alternativeGroupId);
    if (isSafeBomGroupId(n.configurableGroupId)) configurable.push(n.configurableGroupId);
    n.children?.forEach(walk);
  };
  if (root) walk(root);
  return { alternative, configurable };
}

type BomGroupIdItem = {
  isAlternative?: boolean;
  alternativeGroupId?: number | null;
  isConfigurable?: boolean;
  configurableGroupId?: number | null;
};

/**
 * 导出前将超出 int32 的组 ID（历史 Date.now()）映射为安全正整数，同组保持同一映射。
 */
export function remapUnsafeBomGroupIdsInItems<T extends BomGroupIdItem>(items: T[]): T[] {
  const altMap = new Map<number, number>();
  const cfgMap = new Map<number, number>();
  const usedAlt = new Set<number>();
  const usedCfg = new Set<number>();

  for (const it of items) {
    if (it.isAlternative && isSafeBomGroupId(it.alternativeGroupId)) {
      usedAlt.add(it.alternativeGroupId);
    }
    if (it.isConfigurable && isSafeBomGroupId(it.configurableGroupId)) {
      usedCfg.add(it.configurableGroupId);
    }
  }

  const mapOne = (
    raw: number | null | undefined,
    map: Map<number, number>,
    used: Set<number>,
  ): number | undefined => {
    if (raw == null || !Number.isFinite(Number(raw))) return undefined;
    const n = Number(raw);
    if (isSafeBomGroupId(n)) return n;
    let mapped = map.get(n);
    if (mapped == null) {
      mapped = nextBomGroupId(used);
      map.set(n, mapped);
      used.add(mapped);
    }
    return mapped;
  };

  return items.map((it) => {
    const next = { ...it };
    if (next.isAlternative) {
      const mapped = mapOne(next.alternativeGroupId, altMap, usedAlt);
      if (mapped != null) next.alternativeGroupId = mapped;
    }
    if (next.isConfigurable) {
      const mapped = mapOne(next.configurableGroupId, cfgMap, usedCfg);
      if (mapped != null) next.configurableGroupId = mapped;
    }
    return next;
  });
}

/**
 * 查找节点（递归）
 */
export const findNode = (node: MindMapNode | null, nodeId: string): MindMapNode | null => {
  if (!node) return null;
  if (node.id === nodeId) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNode(child, nodeId);
      if (found) return found;
    }
  }
  return null;
};

/**
 * 更新节点（递归）
 */
export const updateNode = (
  node: MindMapNode,
  nodeId: string,
  action: (node: MindMapNode) => MindMapNode
): MindMapNode => {
  if (node.id === nodeId) return action(node);
  if (node.children) {
    return {
      ...node,
      children: node.children.map((child) => updateNode(child, nodeId, action)),
    };
  }
  return node;
};

/**
 * 删除节点（递归）
 */
export const removeNode = (node: MindMapNode, nodeId: string): MindMapNode | null => {
  if (node.id === nodeId) return null;
  if (node.children) {
    return {
      ...node,
      children: node.children.map((child) => removeNode(child, nodeId)).filter(Boolean) as MindMapNode[],
    };
  }
  return node;
};

/**
 * 查找父节点
 */
export const findParentNode = (data: MindMapNode, targetId: string): MindMapNode | null => {
  if (data.children) {
    if (data.children.some((child) => child.id === targetId)) {
      return data;
    }
    for (const child of data.children) {
      const parent = findParentNode(child, targetId);
      if (parent) return parent;
    }
  }
  return null;
};

/**
 * 移动节点
 */
export const handleMoveNodeLogic = (
  root: MindMapNode,
  nodeId: string,
  newParentId: string
): MindMapNode | null => {
  if (nodeId === 'root') return null; // Cannot move root
  if (nodeId === newParentId) return null; // Cannot move to self

  const nodeToMove = findNode(root, nodeId);
  if (!nodeToMove) return null;

  // Check if target is descendant of node (cannot move to own child)
  const isDescendant = findNode(nodeToMove, newParentId);
  if (isDescendant) return null;

  // Remove from old parent
  const treeAfterRemove = removeNode(root, nodeId);
  if (!treeAfterRemove) return null;

  // Add to new parent
  const treeAfterAdd = updateNode(treeAfterRemove, newParentId, (parent) => ({
    ...parent,
    children: [...(parent.children || []), nodeToMove],
  }));

  return treeAfterAdd;
};

/**
 * 处理添加子节点
 * @param configurableOverrides 可选，配置位相关覆盖（用于添加可选物料）
 */
export const handleAddChildNode = (
  parentNodeId: string,
  mindMapDataRef: React.MutableRefObject<MindMapNode | null>,
  setMindMapData: (data: MindMapNode) => void,
  setSelectedNodeId: (id: string) => void,
  mindMapInstanceRef: React.MutableRefObject<any>,
  selectedIdInGraphRef: React.MutableRefObject<string | null>,
  nodeConfigForm: any,
  materialNotSelectedLabel: string = '未选择物料',
  configurableOverrides?: { isConfigurable: boolean; configurableGroupId: number; isDefaultConfigurable: boolean },
  alternativeOverrides?: { isAlternative: boolean; alternativeGroupId: number; priority: number }
) => {
  if (!mindMapDataRef.current) return;

  const newNode: MindMapNode = {
    id: `material_new_${Date.now()}`,
    value: materialNotSelectedLabel,
    quantity: 1,
    unit: '',
    wasteRate: 0,
    isRequired: true,
    isAlternative: false,
    alternativeGroupId: null,
    ...(configurableOverrides || {}),
    ...(alternativeOverrides || {}),
  };

  const updated = updateNode(mindMapDataRef.current, parentNodeId, (node) => {
    return {
      ...node,
      children: [...(node.children || []), newNode],
    };
  });

  if (updated) {
    setMindMapData(updated);
    setSelectedNodeId(newNode.id);
    
    setTimeout(() => {
      if (mindMapInstanceRef.current && newNode.id) {
        const graph = mindMapInstanceRef.current;
        
        // 视觉焦点切换
        if (selectedIdInGraphRef.current && graph.setItemState) {
          graph.setItemState(selectedIdInGraphRef.current, 'selected', false);
        }
        if (graph.setItemState) {
          graph.setItemState(newNode.id, 'selected', true);
        }
        selectedIdInGraphRef.current = newNode.id;

        // 强力聚焦：确保在布局完成后进行
        if (graph.focusItem) {
          graph.focusItem(newNode.id, true, { duration: 0 });
        } else if (graph.focusElement) {
          graph.focusElement(newNode.id, true);
        }

        // 二次聚焦补偿
        setTimeout(() => {
           if (graph.focusItem) graph.focusItem(newNode.id, true, { duration: 0 });
        }, 100);
      }
    }, 150);

    nodeConfigForm.resetFields();
    nodeConfigForm.setFieldsValue({
      quantity: 1,
      wasteRate: 0,
      isRequired: true,
      issueMethod: 'pick',
    });
  }
};

/**
 * 处理添加同级节点
 */
export const handleAddSiblingNode = (
  siblingNodeId: string,
  mindMapDataRef: React.MutableRefObject<MindMapNode | null>,
  setMindMapData: (data: MindMapNode) => void,
  setSelectedNodeId: (id: string) => void,
  mindMapInstanceRef: React.MutableRefObject<any>,
  selectedIdInGraphRef: React.MutableRefObject<string | null>,
  nodeConfigForm: any,
  materialNotSelectedLabel: string = '未选择物料',
  configurableOverrides?: { isConfigurable: boolean; configurableGroupId: number; isDefaultConfigurable: boolean },
  alternativeOverrides?: { isAlternative: boolean; alternativeGroupId: number; priority: number }
) => {
  if (!mindMapDataRef.current) return;

  const parent = findParentNode(mindMapDataRef.current, siblingNodeId);
  if (!parent) {
    handleAddChildNode(
      'root',
      mindMapDataRef,
      setMindMapData,
      setSelectedNodeId,
      mindMapInstanceRef,
      selectedIdInGraphRef,
      nodeConfigForm,
      materialNotSelectedLabel,
      configurableOverrides,
      alternativeOverrides
    );
    return;
  }

  handleAddChildNode(
    parent.id,
    mindMapDataRef,
    setMindMapData,
    setSelectedNodeId,
    mindMapInstanceRef,
    selectedIdInGraphRef,
    nodeConfigForm,
    materialNotSelectedLabel,
    configurableOverrides,
    alternativeOverrides
  );
};

/**
 * 处理删除节点
 */
export const handleDeleteNode = (
  nodeId: string,
  mindMapDataRef: React.MutableRefObject<MindMapNode | null>,
  setMindMapData: (data: MindMapNode) => void,
  setSelectedNodeId: (id: string | null) => void,
  messageApi: any,
  t: (key: string) => string
) => {
  if (nodeId === 'root') {
    messageApi.warning(t('app.master-data.bom.cannotDeleteRoot'));
    return;
  }

  if (!mindMapDataRef.current) return;

  const updated = removeNode(mindMapDataRef.current, nodeId);
  if (updated) {
    setMindMapData(updated as MindMapNode);
    setSelectedNodeId(null);
    messageApi.success(t('app.master-data.bom.nodeDeleted'));
  }
};

/** 列表导出行（与 BOM 导入表头对齐的扁平行） */
export type BomListExportRow = Record<string, string | number | boolean>;

type BomExportMaterialLike = {
  id?: number;
  mainCode?: string;
  code?: string;
  name?: string;
  specification?: string;
  baseUnit?: string;
  processRouteName?: string;
  process_route_name?: string;
  processRouteCode?: string;
  process_route_code?: string;
};

type BomExportGroupResolved = {
  materialId: number;
  bomCode: string;
  version: string;
  bomName: string;
  approvalStatus?: string;
  items: Array<Record<string, unknown>>;
};

/**
 * 从列表行（物料分组行 / 版本分组行）解析可导出的 BOM 组；子件叶行返回 null。
 */
export function resolveBomExportGroup(row: unknown): BomExportGroupResolved | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  if (Array.isArray(r.versions)) {
    const sel = (r.selectedVersion && typeof r.selectedVersion === 'object'
      ? r.selectedVersion
      : r) as Record<string, unknown>;
    const firstItem =
      sel.firstItem && typeof sel.firstItem === 'object'
        ? (sel.firstItem as Record<string, unknown>)
        : undefined;
    const materialId = Number(sel.materialId ?? r.materialId);
    if (!Number.isFinite(materialId) || materialId <= 0) return null;
    return {
      materialId,
      bomCode: String(sel.bomCode ?? firstItem?.bomCode ?? ''),
      version: String(sel.version ?? firstItem?.version ?? '1.0'),
      bomName: String(sel.bomName ?? firstItem?.bomName ?? ''),
      approvalStatus: (sel.approvalStatus ?? firstItem?.approvalStatus) as string | undefined,
      items: Array.isArray(sel.items) ? (sel.items as Array<Record<string, unknown>>) : [],
    };
  }
  if (Array.isArray(r.items) && r.groupKey != null) {
    const firstItem =
      r.firstItem && typeof r.firstItem === 'object'
        ? (r.firstItem as Record<string, unknown>)
        : undefined;
    const materialId = Number(r.materialId);
    if (!Number.isFinite(materialId) || materialId <= 0) return null;
    return {
      materialId,
      bomCode: String(r.bomCode ?? firstItem?.bomCode ?? ''),
      version: String(r.version ?? firstItem?.version ?? '1.0'),
      bomName: String(r.bomName ?? firstItem?.bomName ?? ''),
      approvalStatus: (r.approvalStatus ?? firstItem?.approvalStatus) as string | undefined,
      items: r.items as Array<Record<string, unknown>>,
    };
  }
  return null;
}

function materialCodeOf(mat?: BomExportMaterialLike | null): string {
  if (!mat) return '';
  return String(mat.mainCode || mat.code || '').trim();
}

function approvalStatusLabel(
  status: string | undefined,
  labels: Record<string, string>,
): string {
  const key = String(status ?? '').trim().toLowerCase();
  if (!key) return '';
  return labels[key] || String(status ?? '');
}

/**
 * 将 BOM 分组展平为可导入格式的明细行（父件 + 子件一行）。
 */
export function flattenBomGroupsForExport(
  rows: unknown[],
  materials: BomExportMaterialLike[],
  options: {
    unitValueToLabel?: Record<string, string>;
    approvalStatusLabels?: Record<string, string>;
    yesLabel?: string;
    noLabel?: string;
  } = {},
): BomListExportRow[] {
  const matById = new Map<number, BomExportMaterialLike>();
  materials.forEach((m) => {
    if (m?.id != null) matById.set(Number(m.id), m);
  });
  const unitMap = options.unitValueToLabel ?? {};
  const yes = options.yesLabel ?? '是';
  const no = options.noLabel ?? '否';
  const statusLabels = options.approvalStatusLabels ?? {};
  const out: BomListExportRow[] = [];

  for (const row of rows) {
    const group = resolveBomExportGroup(row);
    if (!group) continue;
    const parent = matById.get(group.materialId);
    const parentCode = materialCodeOf(parent);
    const parentName = String(parent?.name ?? '').trim();
    const parentSpec = String(parent?.specification ?? '').trim();
    const parentBaseUnit = String(parent?.baseUnit ?? '').trim();
    const parentRouteName = String(
      parent?.processRouteName ?? parent?.process_route_name ?? '',
    ).trim();
    const parentRouteCode = String(
      parent?.processRouteCode ?? parent?.process_route_code ?? '',
    ).trim();
    const approval = approvalStatusLabel(group.approvalStatus, statusLabels);
    const items = group.items.length
      ? group.items
      : [
          {
            componentId: undefined,
            quantity: '',
            unit: '',
            wasteRate: 0,
            isRequired: true,
            isActive: true,
            remark: '',
          },
        ];

    for (const item of items) {
      const componentId = Number(item.componentId ?? item.component_id);
      const component =
        Number.isFinite(componentId) && componentId > 0 ? matById.get(componentId) : undefined;
      const componentCode =
        String(item.componentCode ?? item.component_code ?? '').trim() || materialCodeOf(component);
      const unitRaw = String(item.unit ?? '').trim();
      const unit = unitRaw ? unitMap[unitRaw] || unitRaw : '';
      const wasteRaw = item.wasteRate ?? item.waste_rate;
      const wasteRate =
        wasteRaw == null || wasteRaw === ''
          ? 0
          : Number(wasteRaw);
      const isRequired = item.isRequired ?? item.is_required;
      const isActive = item.isActive ?? item.is_active;
      const flat: BomListExportRow = {
        bomCode: group.bomCode || '',
        bomName: group.bomName || '',
        version: group.version || '1.0',
        approvalStatus: approval,
        baseQuantity: Number(item.baseQuantity ?? item.base_quantity ?? 1) || 1,
        parentCode,
        componentCode,
        quantity: item.quantity == null || item.quantity === '' ? '' : Number(item.quantity),
        unit,
        wasteRate: Number.isFinite(wasteRate) ? wasteRate : 0,
        isRequired: isRequired === false ? no : yes,
        isActive: isActive === false ? no : yes,
        remark: String(item.remark ?? item.description ?? '').trim(),
        materialName: parentName,
        specification: parentSpec,
        baseUnit: parentBaseUnit ? unitMap[parentBaseUnit] || parentBaseUnit : '',
        processRouteCode: parentRouteCode,
        processRouteName: parentRouteName,
      };
      Object.entries(item).forEach(([key, value]) => {
        if (!key.startsWith('custom_')) return;
        if (value == null || typeof value === 'object') {
          flat[key] = value == null ? '' : JSON.stringify(value);
        } else {
          flat[key] = value as string | number | boolean;
        }
      });
      out.push(flat);
    }
  }
  return out;
}

/**
 * 处理选择节点
 */
export const handleNodeSelect = (
  nodeId: string,
  mindMapDataRef: React.MutableRefObject<MindMapNode | null>,
  setSelectedNodeId: (id: string) => void,
  nodeConfigForm: any
) => {
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
        issueMethod: resolveIssueMethodForNode(node.issueMethod, node.material),
        isConfigurable: node.isConfigurable ?? false,
        configurableGroupId: node.configurableGroupId ?? null,
        isDefaultConfigurable: false,
        isAlternative: node.isAlternative ?? false,
        alternativeGroupId: node.alternativeGroupId ?? null,
      });
    }
  }
};
