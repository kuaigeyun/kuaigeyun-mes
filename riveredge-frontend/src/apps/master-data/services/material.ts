/**
 * 物料数据 API 服务
 * 
 * 提供物料分组、物料、BOM的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  MaterialGroup,
  MaterialGroupCreate,
  MaterialGroupUpdate,
  MaterialGroupListParams,
  Material,
  MaterialCreate,
  MaterialUpdate,
  MaterialListParams,
  MaterialListResponse,
  MaterialBulkTrackingPayload,
  MaterialBulkTrackingResult,
  MaterialBulkVariantPayload,
  MaterialBulkDefaultsPatchPayload,
  MaterialGenerateVariantsPayload,
  MaterialGenerateVariantsResult,
  MaterialMaterializeVariantPayload,
  MaterialMaterializeVariantResult,
  MaterialBatchDeleteResult,
  MaterialBatchMoveGroupResult,
  MaterialBatchFieldUpdateResult,
  MaterialRewriteMainCodesPayload,
  MaterialRewriteMainCodesResult,
  BOM,
  BOMCreate,
  BOMUpdate,
  BOMListParams,
  BOMGroupSummary,
  BOMBatchCreate,
  BOMBatchImport,
  BOMRelationImportRequest,
  BOMRelationImportResult,
  BOMHierarchy,
  BOMHierarchyItem,
  BOMQuantityResult,
  BOMVersionCreate,
  BOMVersionCompare,
  BOMVersionCompareResult,
  BOMCycleDetectionResult,
  MaterialCodeMapping,
  MaterialCodeMappingCreate,
  MaterialCodeMappingUpdate,
  MaterialCodeMappingListParams,
  MaterialCodeMappingListResponse,
  MaterialCodeConvertRequest,
  MaterialCodeConvertResponse,
  MaterialCodeMappingBatchImportResult,
  MaterialBatch,
  MaterialBatchCreate,
  MaterialBatchUpdate,
  MaterialBatchListParams,
  MaterialBatchListResponse,
  MaterialSerial,
  MaterialSerialCreate,
  MaterialSerialUpdate,
  MaterialSerialListParams,
  MaterialSerialListResponse,
  StandardPartsPresetCatalog,
  LoadStandardPartsPresetResponse,
} from '../types/material';
import type { MaterialHealthCheckResult } from '../types/materialHealth';

/** 列表/详情接口可能返回 snake_case 或 camelCase，统一便于表格绑定 */
function normalizeMaterialRow(item: Material): Material {
  const row = item as any
  const processRouteName = row.processRouteName ?? row.process_route_name
  const processRouteId = row.processRouteId ?? row.process_route_id
  if (processRouteName !== undefined) row.processRouteName = processRouteName
  if (processRouteId !== undefined) row.processRouteId = processRouteId
  if (row.variantManaged === undefined && row.variant_managed !== undefined) {
    row.variantManaged = row.variant_managed
  }
  if (row.variantAttributes === undefined && row.variant_attributes !== undefined) {
    row.variantAttributes = row.variant_attributes
  }
  return row as Material
}

function optionalNumberId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const MATERIAL_LIST_LIMIT_MAX = 2000;

function clampMaterialListLimit(limit: unknown): number | undefined {
  if (typeof limit !== 'number' || Number.isNaN(limit)) return undefined;
  return Math.max(1, Math.min(MATERIAL_LIST_LIMIT_MAX, Math.trunc(limit)));
}

/**
 * 后端 BOM 响应为 snake_case，统一转为前端 camelCase
 */
function mapBomFromApi(raw: Record<string, unknown>): BOM {
  return {
    id: raw.id as number,
    uuid: raw.uuid as string,
    tenantId: (raw.tenant_id ?? raw.tenantId) as number,
    materialId: (raw.material_id ?? raw.materialId) as number,
    componentId: (raw.component_id ?? raw.componentId) as number,
    quantity: Number(raw.quantity),
    unit: (raw.unit as string) ?? undefined,
    wasteRate: Number(raw.waste_rate ?? raw.wasteRate ?? 0),
    isRequired: (raw.is_required ?? raw.isRequired) !== false,
    level: Number(raw.level ?? 0),
    path: (raw.path as string) ?? undefined,
    version: (raw.version as string) ?? '1.0',
    bomCode: (raw.bom_code ?? raw.bomCode) as string | undefined,
    isDefault: (raw.is_default ?? raw.isDefault) === true,
    effectiveDate: (raw.effective_date ?? raw.effectiveDate) as string | undefined,
    expiryDate: (raw.expiry_date ?? raw.expiryDate) as string | undefined,
    isObsolete: (raw.is_obsolete ?? raw.isObsolete) === true,
    obsoletedAt: (raw.obsoleted_at ?? raw.obsoletedAt) as string | undefined,
    obsoleteReason: (raw.obsolete_reason ?? raw.obsoleteReason) as string | undefined,
    approvalStatus: (raw.approval_status ?? raw.approvalStatus) as BOM['approvalStatus'],
    approvedBy: (raw.approved_by ?? raw.approvedBy) as number | undefined,
    approvedAt: (raw.approved_at ?? raw.approvedAt) as string | undefined,
    approvalComment: (raw.approval_comment ?? raw.approvalComment) as string | undefined,
    isAlternative: (raw.is_alternative ?? raw.isAlternative) === true,
    alternativeGroupId: (raw.alternative_group_id ?? raw.alternativeGroupId) as number | undefined,
    isConfigurable: (raw.is_configurable ?? raw.isConfigurable) === true,
    configurableGroupId: (raw.configurable_group_id ?? raw.configurableGroupId) as number | undefined,
    isDefaultConfigurable: (raw.is_default_configurable ?? raw.isDefaultConfigurable) === true,
    priority: Number(raw.priority ?? 0),
    description: (raw.description as string) ?? undefined,
    remark: (raw.remark as string) ?? undefined,
    isActive: (raw.is_active ?? raw.isActive) !== false,
    createdAt: (raw.created_at ?? raw.createdAt) as string,
    updatedAt: (raw.updated_at ?? raw.updatedAt) as string,
    deletedAt: (raw.deleted_at ?? raw.deletedAt) as string | undefined,
  };
}

/**
 * 后端 BOM 层级结构响应为 snake_case，统一转为前端 camelCase
 */
function mapBomHierarchyItemFromApi(raw: Record<string, unknown>): BOMHierarchyItem {
  const children = raw.children as Record<string, unknown>[] | undefined;
  const componentId = raw.component_id ?? raw.componentId;
  const componentCode = raw.component_code ?? raw.componentCode;
  const componentName = raw.component_name ?? raw.componentName;
  
  return {
    componentId: componentId ? Number(componentId) : 0,
    componentCode: componentCode ? String(componentCode) : '',
    componentName: componentName ? String(componentName) : '',
    quantity: Number(raw.quantity ?? 0),
    unit: raw.unit ? String(raw.unit) : undefined,
    wasteRate: Number(raw.waste_rate ?? raw.wasteRate ?? 0),
    isRequired: (raw.is_required ?? raw.isRequired) !== false,
    level: Number(raw.level ?? 0),
    path: raw.path ? String(raw.path) : '',
    isConfigurable: (raw.is_configurable ?? raw.isConfigurable) === true,
    configurableGroupId: optionalNumberId(raw.configurable_group_id ?? raw.configurableGroupId),
    isDefaultConfigurable: (raw.is_default_configurable ?? raw.isDefaultConfigurable) === true,
    isAlternative: (raw.is_alternative ?? raw.isAlternative) === true,
    alternativeGroupId: optionalNumberId(raw.alternative_group_id ?? raw.alternativeGroupId),
    priority: Number(raw.priority ?? 0),
    bomVersion: (raw.bom_version != null || raw.bomVersion != null) ? String(raw.bom_version ?? raw.bomVersion) : undefined,
    issueMethod: (raw.issue_method ?? raw.issueMethod ?? 'pick') as 'pick' | 'backflush' | 'none',
    children: children ? children.map(item => mapBomHierarchyItemFromApi(item)) : [],
  };
}

/**
 * 后端 BOM 层级结构响应为 snake_case，统一转为前端 camelCase
 */
function mapBomHierarchyFromApi(raw: Record<string, unknown>): BOMHierarchy {
  const items = raw.items as Record<string, unknown>[] | undefined;
  const materialId = raw.material_id ?? raw.materialId;
  const materialCode = raw.material_code ?? raw.materialCode;
  const materialName = raw.material_name ?? raw.materialName;
  
  return {
    materialId: materialId ? Number(materialId) : 0,
    materialCode: materialCode ? String(materialCode) : '',
    materialName: materialName ? String(materialName) : '',
    version: raw.version ? String(raw.version) : '1.0',
    approvalStatus: raw.approval_status as any,
    items: items ? items.map(item => mapBomHierarchyItemFromApi(item)) : [],
  };

}

/**
 * 物料分组 API 服务
 */
export const materialGroupApi = {
  /**
   * 创建物料分组
   */
  create: async (data: MaterialGroupCreate): Promise<MaterialGroup> => {
    return api.post('/apps/master-data/materials/groups', data);
  },

  /**
   * 获取物料分组列表
   */
  list: async (params?: MaterialGroupListParams): Promise<MaterialGroup[]> => {
    return api.get('/apps/master-data/materials/groups', { params });
  },

  /**
   * 获取物料分组详情
   */
  get: async (uuid: string): Promise<MaterialGroup> => {
    return api.get(`/apps/master-data/materials/groups/${uuid}`);
  },

  /**
   * 更新物料分组
   */
  update: async (uuid: string, data: MaterialGroupUpdate): Promise<MaterialGroup> => {
    return api.put(`/apps/master-data/materials/groups/${uuid}`, data);
  },

  /**
   * 删除物料分组
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/groups/${uuid}`);
  },

  /**
   * 获取物料分组树形结构
   */
  tree: async (): Promise<any[]> => {
    return api.get('/apps/master-data/materials/groups/tree');
  },
};

/**
 * 物料 API 服务
 */
export const materialApi = {
  /**
   * 创建物料
   */
  create: async (data: MaterialCreate): Promise<Material> => {
    return api.post('/apps/master-data/materials', data);
  },

  /**
   * 获取物料列表
   */
  list: async (params?: MaterialListParams): Promise<MaterialListResponse> => {
    const unwrap = (raw: MaterialListResponse | null | undefined): MaterialListResponse => {
      const items = Array.isArray(raw?.items) ? raw!.items.map((m) => normalizeMaterialRow(m)) : []
      return { items, total: raw?.total ?? 0 }
    };
    if (!params) {
      return unwrap(await api.get('/apps/master-data/materials'));
    }
    const { sortBy, sortOrder, treeView, mastersOnly, ...rest } = params;
    const limit = clampMaterialListLimit((rest as Record<string, unknown>).limit);
    const backendParams: Record<string, unknown> =
      limit != null ? { ...rest, limit } : { ...rest };
    if (sortBy != null && sortBy !== '') backendParams.sort_by = sortBy;
    if (sortOrder != null && sortOrder !== '') backendParams.sort_order = sortOrder;
    if (treeView) backendParams.treeView = true;
    if (mastersOnly) backendParams.mastersOnly = true;
    return unwrap(await api.get('/apps/master-data/materials', { params: backendParams }));
  },

  /**
   * 获取物料详情
   */
  get: async (uuid: string): Promise<Material> => {
    return api.get(`/apps/master-data/materials/${uuid}`);
  },

  /**
   * 更新物料
   */
  update: async (uuid: string, data: MaterialUpdate): Promise<Material> => {
    return api.put(`/apps/master-data/materials/${uuid}`, data);
  },

  /**
   * 删除物料
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/${uuid}`);
  },

  /**
   * 批量软删除物料（单请求，后端批量校验与 UPDATE）
   */
  batchDelete: async (material_uuids: string[]): Promise<MaterialBatchDeleteResult> => {
    return api.post('/apps/master-data/materials/batch-delete', { material_uuids });
  },

  /**
   * 批量移动物料分组（单请求，后端批量 UPDATE）
   */
  batchMoveGroup: async (
    material_uuids: string[],
    groupId: number,
  ): Promise<MaterialBatchMoveGroupResult> => {
    return api.post('/apps/master-data/materials/batch-move-group', {
      material_uuids,
      groupId,
    });
  },

  /**
   * 批量更新物料工艺路线（单请求，后端批量 UPDATE）
   */
  batchUpdateProcessRoute: async (
    material_uuids: string[],
    processRouteId: number | null,
  ): Promise<MaterialBatchFieldUpdateResult> => {
    return api.post('/apps/master-data/materials/batch-process-route', {
      material_uuids,
      processRouteId,
    });
  },

  /**
   * 批量更新物料来源类型（单请求，后端批量 UPDATE）
   */
  batchUpdateSourceType: async (
    material_uuids: string[],
    sourceType: string,
  ): Promise<MaterialBatchFieldUpdateResult> => {
    return api.post('/apps/master-data/materials/batch-source-type', {
      material_uuids,
      sourceType,
    });
  },

  /**
   * 试运营模式：按所属分组编号重写物料主编码
   */
  rewriteMainCodes: async (
    payload: MaterialRewriteMainCodesPayload,
  ): Promise<MaterialRewriteMainCodesResult> => {
    const body: Record<string, unknown> = {};
    if (payload.material_uuids?.length) {
      body.material_uuids = payload.material_uuids;
    }
    if (payload.groupId != null) {
      body.groupId = payload.groupId;
    }
    if (payload.reset_sequence) {
      body.reset_sequence = true;
    }
    return api.post('/apps/master-data/materials/rewrite-main-codes', body);
  },

  /** 物料健康助手：完备度与重复编码检查 */
  healthCheck: async (params?: { groupId?: number; mastersOnly?: boolean }): Promise<MaterialHealthCheckResult> => {
    return api.post('/apps/master-data/materials/health-check', {
      groupId: params?.groupId,
      mastersOnly: params?.mastersOnly ?? true,
    });
  },

  /**
   * 批量更新批号/序列号管理（单请求，后端批量 SQL）
   */
  bulkUpdateTracking: async (data: MaterialBulkTrackingPayload): Promise<MaterialBulkTrackingResult> => {
    const body: Record<string, unknown> = { material_uuids: data.material_uuids };
    if (data.batch_managed !== undefined) body.batch_managed = data.batch_managed;
    if (data.default_batch_rule_id !== undefined) body.default_batch_rule_id = data.default_batch_rule_id;
    if (data.serial_managed !== undefined) body.serial_managed = data.serial_managed;
    if (data.default_serial_rule_id !== undefined) body.default_serial_rule_id = data.default_serial_rule_id;
    return api.post('/apps/master-data/materials/batch-tracking', body);
  },

  /**
   * 批量更新属性管理开关及属性值（单请求，后端批量 SQL）
   */
  bulkUpdateVariant: async (data: MaterialBulkVariantPayload): Promise<MaterialBulkTrackingResult> => {
    return api.post('/apps/master-data/materials/batch-variant', {
      material_uuids: data.material_uuids,
      variantManaged: data.variantManaged,
    });
  },

  /**
   * 批量合并更新物料 defaults（税率、默认仓库、安全库存等）
   */
  bulkPatchDefaults: async (
    data: MaterialBulkDefaultsPatchPayload,
  ): Promise<MaterialBatchFieldUpdateResult> => {
    const body: Record<string, unknown> = { material_uuids: data.material_uuids };
    if (data.defaultTaxRate !== undefined) body.defaultTaxRate = data.defaultTaxRate;
    if (data.defaultWarehouseIds !== undefined) body.defaultWarehouseIds = data.defaultWarehouseIds;
    if (data.safetyStock !== undefined) body.safetyStock = data.safetyStock;
    if (data.maxStock !== undefined) body.maxStock = data.maxStock;
    if (data.defaultSalePrice !== undefined) body.defaultSalePrice = data.defaultSalePrice;
    if (data.defaultLocation !== undefined) body.defaultLocation = data.defaultLocation;
    return api.post('/apps/master-data/materials/batch-defaults', body);
  },

  listVariants: async (materialUuid: string): Promise<Material[]> =>
    api.get(`/apps/master-data/materials/${materialUuid}/variants`),

  generateVariants: async (
    materialUuid: string,
    data: MaterialGenerateVariantsPayload,
  ): Promise<MaterialGenerateVariantsResult> =>
    api.post(`/apps/master-data/materials/${materialUuid}/generate-variants`, data),

  materializeVariant: async (
    data: MaterialMaterializeVariantPayload,
  ): Promise<MaterialMaterializeVariantResult> =>
    api.post('/apps/master-data/materials/materialize-variant', data),

  /**
   * 生成物料二维码
   */
  generateQRCode: async (materialUuid: string, materialCode: string, materialName: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateMaterial({
      material_uuid: materialUuid,
      material_code: materialCode,
      material_name: materialName,
    });
  },

  /**
   * 标准件预设目录（按类型，含 GB/T 推荐主编码）
   */
  getStandardPartsPresetPreview: async (): Promise<StandardPartsPresetCatalog> => {
    return api.get('/apps/master-data/materials/standard-parts/preset-preview');
  },

  /**
   * 按勾选导入标准件（指定单一分组，或按预设库二级分类各建/复用分组）
   */
  loadStandardPartsPreset: async (body: {
    presetKeys: string[];
    codeMode: 'auto' | 'gb';
    groupMode: 'single' | 'preset_by_category';
    materialGroupUuid?: string;
    parentMaterialGroupUuid?: string;
  }): Promise<LoadStandardPartsPresetResponse> => {
    return api.post('/apps/master-data/materials/standard-parts/load-preset', body);
  },
};

/**
 * BOM API 服务
 */
export const bomApi = {
  /**
   * 创建BOM（支持批量创建）
   */
  create: async (data: BOMBatchCreate): Promise<BOM[]> => {
    const raw = await api.post<unknown[]>('/apps/master-data/materials/bom', data);
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item) => mapBomFromApi((item ?? {}) as Record<string, unknown>));
  },
  
  /**
   * 创建单个BOM（兼容旧接口）
   */
  createSingle: async (data: BOMCreate): Promise<BOM> => {
    const batchData: BOMBatchCreate = {
      materialId: data.materialId,
      items: [{
        componentId: data.componentId,
        quantity: data.quantity,
        unit: data.unit,
        isAlternative: data.isAlternative,
        alternativeGroupId: data.alternativeGroupId,
        priority: data.priority,
        description: data.description,
      }],
      isActive: data.isActive,
    };
    const list = await bomApi.create(batchData);
    return list[0]!;
  },

  /**
   * 获取 BOM 分组摘要（不拉子件明细，用于列表树首屏）
   */
  getGroups: async (includeObsolete?: boolean): Promise<BOMGroupSummary[]> => {
    const raw = await api.get<unknown[]>('/apps/master-data/materials/bom/groups', {
      params: { include_obsolete: includeObsolete },
    });
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item: any) => ({
      material_id: item.material_id ?? item.materialId,
      version: item.version ?? '1.0',
      bom_code: item.bom_code ?? item.bomCode,
      approval_status: (item.approval_status ?? item.approvalStatus) ?? 'draft',
      is_default: !!(item.is_default ?? item.isDefault),
      is_obsolete: !!(item.is_obsolete ?? item.isObsolete),
      item_count: item.item_count ?? item.itemCount ?? 0,
    }));
  },

  /**
   * 获取在 BOM 中作为子件出现过的物料 ID 列表（用于区分成品/半成品）
   */
  getComponentIds: async (includeObsolete?: boolean): Promise<number[]> => {
    const raw = await api.get<number[]>('/apps/master-data/materials/bom/component-ids', {
      params: { include_obsolete: includeObsolete },
    });
    return Array.isArray(raw) ? raw : [];
  },

  /**
   * 批量按 (material_id, version) 拉取 BOM 子件明细，用于列表树完整构建
   */
  getBatchItems: async (
    items: Array<{ material_id: number; version?: string }>,
    includeObsolete?: boolean
  ): Promise<Record<string, BOM[]>> => {
    if (!items.length) return {};
    const payload = {
      items: items.map((i) => ({ material_id: i.material_id, version: i.version || '1.0' })),
      include_obsolete: includeObsolete ?? false,
    };
    const raw = await api.post<Record<string, unknown[]>>(
      '/apps/master-data/materials/bom/batch-items',
      payload
    );
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, BOM[]> = {};
    for (const [key, list] of Object.entries(raw)) {
      const arr = Array.isArray(list) ? list : [];
      out[key] = arr.map((item: any) => mapBomFromApi((item ?? {}) as Record<string, unknown>));
    }
    return out;
  },

  /**
   * 获取BOM列表
   */
  list: async (params?: BOMListParams): Promise<BOM[]> => {
    const apiParams = params ? { ...params, include_obsolete: params.includeObsolete } : undefined;
    const raw = await api.get<unknown[]>('/apps/master-data/materials/bom', { params: apiParams });
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item) => mapBomFromApi((item ?? {}) as Record<string, unknown>));
  },

  /**
   * 获取BOM详情
   */
  get: async (uuid: string): Promise<BOM> => {
    const raw = await api.get<Record<string, unknown>>(`/apps/master-data/materials/bom/${uuid}`);
    return mapBomFromApi(raw ?? {});
  },

  /**
   * 更新BOM
   */
  update: async (uuid: string, data: BOMUpdate): Promise<BOM> => {
    const raw = await api.put<Record<string, unknown>>(`/apps/master-data/materials/bom/${uuid}`, data);
    return mapBomFromApi(raw ?? {});
  },

  /**
   * 删除BOM
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/bom/${uuid}`);
  },
  
  /**
   * 审核BOM
   */
  approve: async (uuid: string, approved: boolean, approvalComment?: string): Promise<BOM> => {
    const params: Record<string, any> = { approved };
    if (approvalComment) {
      params.approval_comment = approvalComment;
    }
    const raw = await api.post<Record<string, unknown>>(`/apps/master-data/materials/bom/${uuid}/approve`, null, { params });
    return mapBomFromApi(raw ?? {});
  },

  /**
   * 批量审核BOM
   */
  batchApprove: async (uuids: string[], approved: boolean, approvalComment?: string, recursive: boolean = false, isReverse: boolean = false): Promise<BOM[]> => {
    const data = {
      bom_uuids: uuids,
      approved,
      approval_comment: approvalComment,
      recursive,
      is_reverse: isReverse,
    };
    const raw = await api.post<unknown[]>('/apps/master-data/materials/bom/batch-approve', data);
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item) => mapBomFromApi((item ?? {}) as Record<string, unknown>));
  },
  
  /**
   * 复制BOM（创建新版本）
   */
  copy: async (uuid: string, newVersion?: string): Promise<BOM> => {
    const params: Record<string, any> = {};
    if (newVersion) {
      params.new_version = newVersion;
    }
    const raw = await api.post<Record<string, unknown>>(`/apps/master-data/materials/bom/${uuid}/copy`, null, { params });
    return mapBomFromApi(raw ?? {});
  },

  /**
   * BOM升版（Revise）
   */
  revise: async (uuid: string, newVersion?: string, versionRemark?: string): Promise<BOM> => {
    const params: Record<string, any> = {};
    if (newVersion) params.new_version = newVersion;
    if (versionRemark) params.version_remark = versionRemark;
    const raw = await api.post<Record<string, unknown>>(`/apps/master-data/materials/bom/${uuid}/revise`, null, { params });
    return mapBomFromApi(raw ?? {});
  },

  
  /**
   * 根据主物料获取BOM列表
   */
  getByMaterial: async (
    materialId: number,
    version?: string,
    onlyActive?: boolean,
    includeObsolete?: boolean
  ): Promise<BOM[]> => {
    const raw = await api.get<unknown[]>(`/apps/master-data/materials/bom/material/${materialId}`, {
      params: { version, only_active: onlyActive, include_obsolete: includeObsolete },
    });
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item) => mapBomFromApi((item ?? {}) as Record<string, unknown>));
  },

  /**
   * 获取BOM所有版本
   */
  getVersions: async (bomCode: string, includeObsolete?: boolean): Promise<BOM[]> => {
    const raw = await api.get<unknown[]>(`/apps/master-data/materials/bom/versions/${bomCode}`, {
      params: includeObsolete === false ? { include_obsolete: false } : undefined,
    });
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item) => mapBomFromApi((item ?? {}) as Record<string, unknown>));
  },

  /**
   * 将指定 BOM 版本设为失效
   */
  setVersionObsolete: async (
    materialId: number,
    version: string,
    reason?: string
  ): Promise<{ updated: number; message: string }> => {
    return api.post(`/apps/master-data/materials/bom/material/${materialId}/version/${encodeURIComponent(version)}/obsolete`, {
      reason: reason || undefined,
    });
  },

  /**
   * 批量导入BOM（支持部门编号）
   * 请求体转为 snake_case 以符合后端 Schema（parent_code, component_code 等）。
   */
  batchImport: async (data: BOMBatchImport): Promise<BOM[]> => {
    const payload = {
      items: data.items.map((item) => ({
        parent_code: item.parentCode,
        component_code: item.componentCode,
        quantity: item.quantity,
        unit: item.unit,
        waste_rate: item.wasteRate,
        is_required: item.isRequired,
        is_configurable: item.isConfigurable,
        configurable_group_id: item.configurableGroupId,
        is_default_configurable: item.isDefaultConfigurable,
        is_alternative: item.isAlternative,
        alternative_group_id: item.alternativeGroupId,
        priority: item.priority ?? 0,
        issue_method: item.issueMethod ?? 'pick',
        remark: item.remark,
      })),
      version: data.version,
      bom_code: data.bomCode,
      effective_date: data.effectiveDate,
      description: data.description,
      version_remark: data.versionRemark,
    };
    const raw = await api.post<unknown[]>('/apps/master-data/materials/bom/batch-import', payload);
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((item) => mapBomFromApi((item ?? {}) as Record<string, unknown>));
  },
  relationImportPrecheck: async (data: BOMRelationImportRequest): Promise<BOMRelationImportResult> => {
    return api.post('/apps/master-data/materials/bom/relation-import/precheck', {
      rows: data.rows,
      entities: data.entities,
      write_strategy: data.writeStrategy,
      dry_run: true,
    });
  },
  relationImport: async (data: BOMRelationImportRequest): Promise<BOMRelationImportResult> => {
    return api.post('/apps/master-data/materials/bom/relation-import', {
      rows: data.rows,
      entities: data.entities,
      write_strategy: data.writeStrategy,
      dry_run: false,
    });
  },
  
  /**
   * 生成BOM层级结构
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  getHierarchy: async (
    materialId: number,
    version?: string
  ): Promise<BOMHierarchy> => {
    const raw = await api.get<Record<string, unknown>>(`/apps/master-data/materials/bom/material/${materialId}/hierarchy`, {
      params: { version },
    });
    return mapBomHierarchyFromApi(raw ?? {});
  },
  
  /**
   * 计算BOM用量（考虑损耗率）
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  calculateQuantity: async (
    materialId: number,
    parentQuantity: number = 1.0,
    version?: string
  ): Promise<BOMQuantityResult> => {
    return api.get(`/apps/master-data/materials/bom/material/${materialId}/quantity`, {
      params: { parent_quantity: parentQuantity, version },
    });
  },
  
  /**
   * 创建BOM新版本
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  createVersion: async (
    materialId: number,
    data: BOMVersionCreate
  ): Promise<BOM[]> => {
    return api.post(`/apps/master-data/materials/bom/material/${materialId}/version`, data);
  },
  
  /**
   * 对比BOM版本
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  compareVersions: async (
    materialId: number,
    data: BOMVersionCompare
  ): Promise<BOMVersionCompareResult> => {
    return api.post(`/apps/master-data/materials/bom/material/${materialId}/compare-versions`, data);
  },
  
  /**
   * 检测BOM循环依赖
   * 
   * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
   */
  detectCycle: async (
    materialId: number,
    componentId: number
  ): Promise<BOMCycleDetectionResult> => {
    return api.get('/apps/master-data/materials/bom/detect-cycle', {
      params: { material_id: materialId, component_id: componentId },
    });
  },
};

/**
 * 物料编号映射 API 服务
 */
export const materialCodeMappingApi = {
  /**
   * 创建物料编号映射
   */
  create: async (data: MaterialCodeMappingCreate): Promise<MaterialCodeMapping> => {
    return api.post('/apps/master-data/materials/mapping', data);
  },

  /**
   * 获取物料编号映射列表
   */
  list: async (params?: MaterialCodeMappingListParams): Promise<MaterialCodeMappingListResponse> => {
    return api.get('/apps/master-data/materials/mapping', { params });
  },

  /**
   * 获取物料编号映射详情
   */
  get: async (uuid: string): Promise<MaterialCodeMapping> => {
    return api.get(`/apps/master-data/materials/mapping/${uuid}`);
  },

  /**
   * 更新物料编号映射
   */
  update: async (uuid: string, data: MaterialCodeMappingUpdate): Promise<MaterialCodeMapping> => {
    return api.put(`/apps/master-data/materials/mapping/${uuid}`, data);
  },

  /**
   * 删除物料编号映射
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/mapping/${uuid}`);
  },

  /**
   * 编号转换（外部编号 -> 内部编号）
   */
  convert: async (request: MaterialCodeConvertRequest): Promise<MaterialCodeConvertResponse> => {
    return api.post('/apps/master-data/materials/mapping/convert', request);
  },

  /**
   * 批量导入物料编号映射
   */
  batchImport: async (mappingsData: MaterialCodeMappingCreate[]): Promise<MaterialCodeMappingBatchImportResult> => {
    return api.post('/apps/master-data/materials/mapping/batch-import', mappingsData);
  },
};

/**
 * 物料批号 API 服务
 */
export const materialBatchApi = {
  /**
   * 创建物料批号
   * 后端使用 snake_case，自动转换
   */
  create: async (data: MaterialBatchCreate): Promise<MaterialBatch> => {
    const payload: Record<string, unknown> = {
      material_uuid: data.materialUuid ?? (data as any).material_uuid,
      batch_no: data.batchNo ?? (data as any).batch_no,
      supplier_batch_no: data.supplierBatchNo ?? (data as any).supplier_batch_no,
      quantity: data.quantity ?? (data as any).quantity ?? 0,
      status: data.status ?? (data as any).status ?? 'in_stock',
      remark: data.remark ?? (data as any).remark,
    };
    const prod = data.productionDate ?? (data as any).production_date;
    const exp = data.expiryDate ?? (data as any).expiry_date;
    if (prod != null) payload.production_date = prod;
    if (exp != null) payload.expiry_date = exp;
    return api.post('/apps/master-data/materials/batches', payload);
  },

  /**
   * 获取物料批号列表
   * 后端使用 snake_case 参数：material_uuid, batch_no, status, page, page_size
   */
  list: async (params?: MaterialBatchListParams): Promise<MaterialBatchListResponse> => {
    const backendParams = params
      ? {
          material_uuid: params.materialUuid,
          batch_no: params.batchNo,
          status: params.status,
          page: params.page ?? 1,
          page_size: params.pageSize ?? 20,
          ...(params.keyword?.trim() ? { keyword: params.keyword.trim() } : {}),
          ...(params.sortBy ? { sort_by: params.sortBy } : {}),
          ...(params.sortOrder ? { sort_order: params.sortOrder } : {}),
        }
      : undefined;
    return api.get('/apps/master-data/materials/batches', { params: backendParams });
  },

  /**
   * 获取物料批号详情
   */
  get: async (uuid: string): Promise<MaterialBatch> => {
    return api.get(`/apps/master-data/materials/batches/${uuid}`);
  },

  /**
   * 更新物料批号
   */
  update: async (uuid: string, data: MaterialBatchUpdate): Promise<MaterialBatch> => {
    return api.put(`/apps/master-data/materials/batches/${uuid}`, data);
  },

  /**
   * 删除物料批号
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/batches/${uuid}`);
  },

  /**
   * 生成批号
   * @param materialUuid 物料UUID
   * @param options 可选：rule_id、rule_uuid、supplier_code
   */
  generate: async (
    materialUuid: string,
    options?: {
      ruleId?: number;
      ruleUuid?: string;
      supplierCode?: string;
      /** 为 true 时不占用流水号，仅预览（入库确认预览等未保存场景） */
      preview?: boolean;
      /** 预览时同一单据内同物料多行递增值 0,1,2… */
      previewOffset?: number;
    }
  ): Promise<{ batch_no: string }> => {
    /** JSON Body，确保 preview 不被 POST 查询串丢失 */
    return api.post('/apps/master-data/materials/batches/generate', {
      material_uuid: materialUuid,
      ...(options?.ruleId != null ? { rule_id: options.ruleId } : {}),
      ...(options?.ruleUuid ? { rule_uuid: options.ruleUuid } : {}),
      ...(options?.supplierCode ? { supplier_code: options.supplierCode } : {}),
      preview: options?.preview === true,
      preview_offset: options?.previewOffset ?? 0,
    });
  },

  /**
   * 批号追溯
   */
  trace: async (uuid: string): Promise<any> => {
    return api.get(`/apps/master-data/materials/batches/${uuid}/trace`);
  },

  /**
   * 生成批号追溯二维码
   */
  generateTraceQRCode: async (batchUuid: string, batchNo: string, materialName?: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateTrace({
      trace_uuid: batchUuid,
      trace_code: batchNo,
      trace_data: {
        trace_type: 'batch',
        trace_name: materialName || batchNo,
      },
    });
  },
};

/**
 * 物料序列号 API 服务
 */
export const materialSerialApi = {
  /**
   * 创建物料序列号（后端 snake_case）
   */
  create: async (data: MaterialSerialCreate): Promise<MaterialSerial> => {
    const payload: Record<string, unknown> = {
      material_uuid: data.materialUuid ?? (data as any).material_uuid,
      serial_no: data.serialNo ?? (data as any).serial_no,
      supplier_serial_no: data.supplierSerialNo ?? (data as any).supplier_serial_no,
      status: data.status ?? (data as any).status ?? 'in_stock',
      remark: data.remark ?? (data as any).remark,
    };
    const prod = data.productionDate ?? (data as any).production_date;
    const fac = data.factoryDate ?? (data as any).factory_date;
    if (prod != null) payload.production_date = prod;
    if (fac != null) payload.factory_date = fac;
    return api.post('/apps/master-data/materials/serials', payload);
  },

  /**
   * 获取物料序列号列表（查询参数 snake_case）
   */
  list: async (params?: MaterialSerialListParams): Promise<MaterialSerialListResponse> => {
    const backendParams = params
      ? {
          material_uuid: params.materialUuid,
          serial_no: params.serialNo,
          status: params.status,
          page: params.page ?? 1,
          page_size: params.pageSize ?? 20,
          ...(params.keyword?.trim() ? { keyword: params.keyword.trim() } : {}),
          ...(params.sortBy ? { sort_by: params.sortBy } : {}),
          ...(params.sortOrder ? { sort_order: params.sortOrder } : {}),
        }
      : undefined;
    return api.get('/apps/master-data/materials/serials', { params: backendParams });
  },

  /**
   * 获取物料序列号详情
   */
  get: async (uuid: string): Promise<MaterialSerial> => {
    return api.get(`/apps/master-data/materials/serials/${uuid}`);
  },

  /**
   * 更新物料序列号
   */
  update: async (uuid: string, data: MaterialSerialUpdate): Promise<MaterialSerial> => {
    const payload: Record<string, unknown> = {};
    const prod = data.productionDate ?? (data as any).production_date;
    const fac = data.factoryDate ?? (data as any).factory_date;
    const sup = data.supplierSerialNo ?? (data as any).supplier_serial_no;
    const st = data.status ?? (data as any).status;
    const rm = data.remark ?? (data as any).remark;
    if (prod !== undefined) payload.production_date = prod;
    if (fac !== undefined) payload.factory_date = fac;
    if (sup !== undefined) payload.supplier_serial_no = sup;
    if (st !== undefined) payload.status = st;
    if (rm !== undefined) payload.remark = rm;
    return api.put(`/apps/master-data/materials/serials/${uuid}`, payload);
  },

  /**
   * 删除物料序列号
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/materials/serials/${uuid}`);
  },

  /**
   * 生成序列号（批量）
   * @param materialUuid 物料UUID
   * @param count 生成数量
   * @param options 可选：rule_id、rule_uuid
   */
  generate: async (
    materialUuid: string,
    count: number = 1,
    options?: { ruleId?: number; ruleUuid?: string }
  ): Promise<{ serial_nos: string[]; count: number }> => {
    const params: Record<string, string | number | undefined> = { material_uuid: materialUuid, count };
    if (options?.ruleId != null) params.rule_id = options.ruleId;
    if (options?.ruleUuid) params.rule_uuid = options.ruleUuid;
    return api.post('/apps/master-data/materials/serials/generate', null, { params });
  },

  /**
   * 序列号追溯
   */
  trace: async (uuid: string): Promise<any> => {
    return api.get(`/apps/master-data/materials/serials/${uuid}/trace`);
  },

  /**
   * 生成序列号追溯二维码
   */
  generateTraceQRCode: async (serialUuid: string, serialNo: string, materialName?: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateTrace({
      trace_uuid: serialUuid,
      trace_code: serialNo,
      trace_data: {
        trace_type: 'serial',
        trace_name: materialName || serialNo,
      },
    });
  },
};

/**
 * 物料来源控制 API 服务
 */
export const materialSourceApi = {
  /**
   * 验证物料来源配置
   */
  validate: async (materialUuid: string): Promise<{
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  }> => {
    return api.get(`/apps/master-data/materials/${materialUuid}/source/validate`);
  },

  /**
   * 批量验证物料来源配置
   */
  validateBatch: async (materialUuids: string[]): Promise<Record<string, {
    is_valid: boolean;
    errors: string[];
    warnings: string[];
  }>> => {
    return api.post('/apps/master-data/materials/source/validate-batch', materialUuids);
  },

  /**
   * 检查物料来源类型变更影响
   */
  checkChangeImpact: async (materialUuid: string, newSourceType: string): Promise<{
    can_change: boolean;
    impact: {
      work_orders: Array<{ uuid: string; code: string; status: string }>;
      purchase_orders: Array<{ uuid: string; code: string; status: string }>;
      warnings: string[];
    };
  }> => {
    return api.get(`/apps/master-data/materials/${materialUuid}/source/change-impact`, {
      params: { new_source_type: newSourceType },
    });
  },

  /**
   * 变更物料来源类型
   */
  change: async (
    materialUuid: string,
    newSourceType: string,
    newSourceConfig?: Record<string, any>
  ): Promise<Material> => {
    return api.put(`/apps/master-data/materials/${materialUuid}/source/change`, null, {
      params: {
        new_source_type: newSourceType,
        new_source_config: newSourceConfig ? JSON.stringify(newSourceConfig) : undefined,
      },
    });
  },

  /**
   * 建议物料来源类型
   */
  suggest: async (materialUuid: string): Promise<{
    suggested_type: string | null;
    confidence: number;
    reasons: string[];
    all_suggestions: Array<{
      source_type: string;
      confidence: number;
      reason: string;
    }>;
  }> => {
    return api.get(`/apps/master-data/materials/${materialUuid}/source/suggest`);
  },

  /**
   * 检查物料来源配置完整性
   */
  checkCompleteness: async (materialUuid: string): Promise<{
    is_complete: boolean;
    missing_configs: string[];
    warnings: string[];
  }> => {
    return api.get(`/apps/master-data/materials/${materialUuid}/source/check-completeness`);
  },
};
