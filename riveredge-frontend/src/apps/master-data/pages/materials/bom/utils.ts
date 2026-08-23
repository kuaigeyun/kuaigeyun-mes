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

export type BomExportGroupSummary = {
  material_id: number;
  version: string;
  bom_code?: string | null;
  bom_name?: string | null;
  approval_status?: string;
  is_default?: boolean;
};

export type BomExportGroupHint = {
  materialId: number;
  version: string;
  bomCode: string;
  bomName: string;
  approvalStatus?: string;
  isDefault?: boolean;
};

export type BomExportContext = {
  itemsIndex: Map<string, Array<Record<string, unknown>>>;
  hintsByMaterialId: Map<number, BomExportGroupHint[]>;
};

type BomExportNestedApi = {
  getGroups: (params?: {
    includeObsolete?: boolean;
    materialIds?: number[];
  }) => Promise<{ data: BomExportGroupSummary[] }>;
  getBatchItems: (
    items: Array<{ material_id: number; version?: string }>,
    includeObsolete?: boolean,
  ) => Promise<Record<string, Array<Record<string, unknown>>>>;
};

export function bomItemsIndexKey(materialId: number, version: string): string {
  return `${materialId}|${version || '1.0'}`;
}

export function appendBomExportHint(
  hintsByMaterialId: Map<number, BomExportGroupHint[]>,
  summary: BomExportGroupSummary,
): void {
  const materialId = Number(summary.material_id);
  if (!Number.isFinite(materialId) || materialId <= 0) return;
  const version = String(summary.version ?? '1.0');
  const hint: BomExportGroupHint = {
    materialId,
    version,
    bomCode: String(summary.bom_code ?? '-'),
    bomName: String(summary.bom_name ?? ''),
    approvalStatus: summary.approval_status,
    isDefault: summary.is_default === true,
  };
  const list = hintsByMaterialId.get(materialId) ?? [];
  if (!list.some((h) => h.version === hint.version && h.bomCode === hint.bomCode)) {
    list.push(hint);
    hintsByMaterialId.set(materialId, list);
  }
}

export function pickDefaultBomExportHint(
  hints: BomExportGroupHint[] | undefined,
): BomExportGroupHint | null {
  if (!hints?.length) return null;
  return hints.find((h) => h.isDefault) ?? hints[hints.length - 1] ?? null;
}

/**
 * 拉取导出所需 BOM 明细索引，并按列表相同规则 BFS 补齐半成品下级 BOM。
 */
export async function loadBomExportNestedItems(
  rootGroups: BomExportGroupSummary[],
  includeObsolete: boolean,
  api: BomExportNestedApi,
): Promise<BomExportContext & { batchItems: Record<string, Array<Record<string, unknown>>> }> {
  const hintsByMaterialId = new Map<number, BomExportGroupHint[]>();
  const mergedBatchItems: Record<string, Array<Record<string, unknown>>> = {};
  const existingGroupKeys = new Set<string>();

  rootGroups.forEach((g) => {
    appendBomExportHint(hintsByMaterialId, g);
    existingGroupKeys.add(bomItemsIndexKey(g.material_id, g.version));
  });

  if (rootGroups.length) {
    const rootBatch = await api.getBatchItems(
      rootGroups.map((g) => ({ material_id: g.material_id, version: g.version })),
      includeObsolete,
    );
    Object.assign(mergedBatchItems, rootBatch);
  }

  let frontierSemiIds = new Set<number>();
  for (const g of rootGroups) {
    const items = mergedBatchItems[bomItemsIndexKey(g.material_id, g.version)] ?? [];
    for (const it of items) {
      const componentId = Number(it.componentId ?? it.component_id);
      if (Number.isFinite(componentId) && componentId > 0) {
        frontierSemiIds.add(componentId);
      }
    }
  }

  const processedSemiIds = new Set<number>();
  while (frontierSemiIds.size > 0) {
    const ids = Array.from(frontierSemiIds).filter((id) => !processedSemiIds.has(id));
    ids.forEach((id) => processedSemiIds.add(id));
    frontierSemiIds = new Set();
    if (ids.length === 0) break;

    const { data: semiGroups } = await api.getGroups({
      includeObsolete,
      materialIds: ids,
    });
    semiGroups.forEach((g) => appendBomExportHint(hintsByMaterialId, g));

    const byMid = new Map<number, BomExportGroupSummary>();
    for (const x of semiGroups) {
      const cur = byMid.get(x.material_id);
      if (!cur || x.is_default) byMid.set(x.material_id, x);
    }
    const needFetch = Array.from(byMid.values()).filter(
      (g) => !existingGroupKeys.has(bomItemsIndexKey(g.material_id, g.version)),
    );
    if (needFetch.length === 0) continue;

    const semiBatch = await api.getBatchItems(
      needFetch.map((g) => ({ material_id: g.material_id, version: g.version })),
      includeObsolete,
    );
    Object.assign(mergedBatchItems, semiBatch);
    needFetch.forEach((g) => {
      existingGroupKeys.add(bomItemsIndexKey(g.material_id, g.version));
    });

    for (const g of needFetch) {
      const items = mergedBatchItems[bomItemsIndexKey(g.material_id, g.version)] ?? [];
      for (const it of items) {
        const componentId = Number(it.componentId ?? it.component_id);
        if (componentId > 0 && !processedSemiIds.has(componentId)) {
          frontierSemiIds.add(componentId);
        }
      }
    }
  }

  const itemsIndex = new Map<string, Array<Record<string, unknown>>>();
  Object.entries(mergedBatchItems).forEach(([key, items]) => {
    itemsIndex.set(key, items);
  });

  return { batchItems: mergedBatchItems, itemsIndex, hintsByMaterialId };
}

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

type BomExportFlatOptions = {
  unitValueToLabel?: Record<string, string>;
  approvalStatusLabels?: Record<string, string>;
  issueMethodLabels?: Record<string, string>;
  yesLabel?: string;
  noLabel?: string;
  exportContext?: BomExportContext;
  expandNested?: boolean;
};

type BomExportLineMeta = {
  bomCode: string;
  bomName: string;
  version: string;
  approvalStatus?: string;
};

function appendCustomFieldsToExportRow(
  flat: BomListExportRow,
  item: Record<string, unknown>,
): void {
  Object.entries(item).forEach(([key, value]) => {
    if (!key.startsWith('custom_')) return;
    if (value == null || typeof value === 'object') {
      flat[key] = value == null ? '' : JSON.stringify(value);
    } else {
      flat[key] = value as string | number | boolean;
    }
  });
}

function buildBomExportFlatRow(
  item: Record<string, unknown>,
  parentMaterialId: number,
  lineMeta: BomExportLineMeta,
  matById: Map<number, BomExportMaterialLike>,
  options: BomExportFlatOptions,
): BomListExportRow | null {
  const componentId = Number(item.componentId ?? item.component_id);
  if (!Number.isFinite(componentId) || componentId <= 0) return null;

  const parent = matById.get(parentMaterialId);
  const component = matById.get(componentId);
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
  const componentCode =
    String(item.componentCode ?? item.component_code ?? '').trim() || materialCodeOf(component);
  const componentName = String(component?.name ?? '').trim();
  const componentSpec = String(component?.specification ?? '').trim();
  const unitMap = options.unitValueToLabel ?? {};
  const yes = options.yesLabel ?? '是';
  const no = options.noLabel ?? '否';
  const unitRaw = String(item.unit ?? '').trim();
  const unit = unitRaw ? unitMap[unitRaw] || unitRaw : '';
  const wasteRaw = item.wasteRate ?? item.waste_rate;
  const wasteRate = wasteRaw == null || wasteRaw === '' ? 0 : Number(wasteRaw);
  const isRequired = item.isRequired ?? item.is_required;
  const isActive = item.isActive ?? item.is_active;
  const issueMethodRaw = String(item.issueMethod ?? item.issue_method ?? 'pick').trim();
  const issueMethodLabels = options.issueMethodLabels ?? {};
  const flat: BomListExportRow = {
    bomCode: lineMeta.bomCode || '',
    bomName: lineMeta.bomName || '',
    version: lineMeta.version || '1.0',
    approvalStatus: approvalStatusLabel(lineMeta.approvalStatus, options.approvalStatusLabels ?? {}),
    baseQuantity: Number(item.baseQuantity ?? item.base_quantity ?? 1) || 1,
    parentCode,
    componentCode,
    componentName,
    componentSpecification: componentSpec,
    quantity: item.quantity == null || item.quantity === '' ? '' : Number(item.quantity),
    unit,
    wasteRate: Number.isFinite(wasteRate) ? wasteRate : 0,
    isRequired: isRequired === false ? no : yes,
    isActive: isActive === false ? no : yes,
    issueMethod: issueMethodLabels[issueMethodRaw] || issueMethodRaw,
    remark: String(item.remark ?? item.description ?? '').trim(),
    materialName: parentName,
    specification: parentSpec,
    baseUnit: parentBaseUnit ? unitMap[parentBaseUnit] || parentBaseUnit : '',
    processRouteCode: parentRouteCode,
    processRouteName: parentRouteName,
  };
  appendCustomFieldsToExportRow(flat, item);
  return flat;
}

function walkBomExportLines(
  parentMaterialId: number,
  lineMeta: BomExportLineMeta,
  items: Array<Record<string, unknown>>,
  matById: Map<number, BomExportMaterialLike>,
  options: BomExportFlatOptions,
  out: BomListExportRow[],
  depth: number,
  visitedComponentIds: Set<number>,
): void {
  if (depth > 20 || !items.length) return;

  for (const item of items) {
    const flat = buildBomExportFlatRow(item, parentMaterialId, lineMeta, matById, options);
    if (!flat) continue;
    out.push(flat);

    if (!options.expandNested || !options.exportContext) continue;

    const componentId = Number(item.componentId ?? item.component_id);
    if (!Number.isFinite(componentId) || componentId <= 0 || visitedComponentIds.has(componentId)) {
      continue;
    }

    const childHint = pickDefaultBomExportHint(
      options.exportContext.hintsByMaterialId.get(componentId),
    );
    if (!childHint) continue;

    const childItems =
      options.exportContext.itemsIndex.get(
        bomItemsIndexKey(componentId, childHint.version),
      ) ?? [];
    if (!childItems.length) continue;

    const nextVisited = new Set(visitedComponentIds);
    nextVisited.add(componentId);
    walkBomExportLines(
      componentId,
      {
        bomCode: childHint.bomCode,
        bomName: childHint.bomName,
        version: childHint.version,
        approvalStatus: childHint.approvalStatus,
      },
      childItems,
      matById,
      options,
      out,
      depth + 1,
      nextVisited,
    );
  }
}

/**
 * 将 BOM 分组展平为可导入格式的明细行（父件 + 子件一行；可选按列表树规则多级展开）。
 */
export function flattenBomGroupsForExport(
  rows: unknown[],
  materials: BomExportMaterialLike[],
  options: BomExportFlatOptions = {},
): BomListExportRow[] {
  const matById = new Map<number, BomExportMaterialLike>();
  materials.forEach((m) => {
    if (m?.id != null) matById.set(Number(m.id), m);
  });
  const out: BomListExportRow[] = [];

  for (const row of rows) {
    const group = resolveBomExportGroup(row);
    if (!group || !group.items.length) continue;

    walkBomExportLines(
      group.materialId,
      {
        bomCode: group.bomCode,
        bomName: group.bomName,
        version: group.version,
        approvalStatus: group.approvalStatus,
      },
      group.items,
      matById,
      options,
      out,
      0,
      new Set(),
    );
  }
  return out;
}

/** 从 batchItems 索引收集导出所需的全部物料 ID */
export function collectBomExportMaterialIds(
  groups: unknown[],
  batchItems: Record<string, Array<Record<string, unknown>>>,
): number[] {
  const ids = new Set<number>();
  groups.forEach((row) => {
    const group = resolveBomExportGroup(row);
    if (group?.materialId) ids.add(group.materialId);
  });
  Object.values(batchItems).forEach((items) => {
    items.forEach((item) => {
      const componentId = Number(item.componentId ?? item.component_id);
      if (Number.isFinite(componentId) && componentId > 0) ids.add(componentId);
    });
  });
  return Array.from(ids);
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
