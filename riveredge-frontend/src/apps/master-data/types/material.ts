/**
 * 物料数据类型定义
 * 
 * 定义物料分组、物料、BOM的数据类型
 */

export interface MaterialGroup {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  alias?: string;
  name: string;
  parentId?: number;
  description?: string;
  isActive: boolean;
  processRouteId?: number;
  processRouteName?: string;
  process_route_id?: number;
  process_route_name?: string;
  inspectionStages?: Record<string, { mode?: string; planId?: number | null; plan_id?: number | null }>;
  inspection_stages?: Record<string, { mode?: string; planId?: number | null; plan_id?: number | null }>;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

/** 物料分组展示标签：有代号时优先显示英文代号，否则显示编号 */
export function formatMaterialGroupLabel(
  group: Pick<MaterialGroup, 'code' | 'name' | 'alias'>,
): string {
  const prefix = group.alias?.trim() || group.code;
  return `${prefix} - ${group.name}`;
}

/** 物料分组悬停提示：分组编号 - 分组代号 - 分组名称 */
export function formatMaterialGroupHoverTitle(
  group: Pick<MaterialGroup, 'code' | 'name' | 'alias'>,
): string {
  const code = (group.code ?? '').trim();
  const alias = (group.alias ?? '').trim() || '-';
  const name = (group.name ?? '').trim();
  return `${code} - ${alias} - ${name}`;
}

export interface MaterialGroupCreate {
  code: string;
  alias?: string;
  name: string;
  parentId?: number;
  description?: string;
  isActive?: boolean;
  processRouteId?: number | null;
  inspectionStages?: Record<string, { mode?: string; planId?: number | null }>;
}

export interface MaterialGroupUpdate {
  code?: string;
  alias?: string;
  name?: string;
  parentId?: number;
  description?: string;
  isActive?: boolean;
  processRouteId?: number | null;
  inspectionStages?: Record<string, { mode?: string; planId?: number | null }>;
}

export interface MaterialGroupListParams {
  skip?: number;
  limit?: number;
  parentId?: number;
  isActive?: boolean;
}

export interface MaterialCodeAlias {
  id: number;
  codeType: string;
  code: string;
  department?: string;
  externalEntityType?: string;
  externalEntityId?: number;
  description?: string;
  isPrimary: boolean;
}

// 多单位管理类型定义
export interface MaterialUnit {
  /** 单位名称 */
  unit: string;
  /** 换算分子（相对于基础单位，如1吨=1000kg，则numerator=1000，denominator=1） */
  numerator: number;
  /** 换算分母（相对于基础单位，如1kg=1000g，则numerator=1，denominator=1000） */
  denominator: number;
  /** 使用场景（purchase/sale/production/inventory） */
  scenarios?: string[];
}

export interface MaterialUnits {
  /** 辅助单位列表 */
  units: MaterialUnit[];
  /** 场景对应的单位映射 */
  scenarios?: {
    purchase?: string; // 采购单位
    sale?: string; // 销售单位
    production?: string; // 生产单位
    inventory?: string; // 库存单位（默认等于baseUnit）
  };
}

export interface Material {
  id: number;
  uuid: string;
  tenantId: number;
  code?: string; // 已废弃，保留用于向后兼容
  mainCode?: string; // 主编号（系统内部唯一标识）
  name: string;
  groupId?: number;
  specification?: string;
  baseUnit: string;
  units?: MaterialUnits;
  batchManaged: boolean;
  defaultBatchRuleId?: number;
  serialManaged?: boolean;
  defaultSerialRuleId?: number;
  variantManaged: boolean;
  variantAttributes?: Record<string, any>;
  description?: string;
  brand?: string;
  model?: string;
  texture?: string;
  weight?: number;
  volume?: number;
  barcode?: string;
  shelfLifeManaged?: boolean;
  shelf_life_managed?: boolean;
  shelfLifeDays?: number;
  shelf_life_days?: number;
  referenceCost?: number;
  reference_cost?: number;
  countryOfOrigin?: string;
  country_of_origin?: string;
  customsCode?: string;
  customs_code?: string;
  isActive: boolean;
  defaults?: MaterialDefaults; // 默认值设置
  codeAliases?: MaterialCodeAlias[]; // 编号别名列表
  sourceType?: string; // 物料来源类型（Make/Buy/Phantom/Outsource）
  source_type?: string; // 物料来源类型（向后兼容）
  sourceTypes?: string[]; // 物料来源类型（多选）
  source_types?: string[]; // 物料来源类型（多选，向后兼容）
  sourceConfig?: Record<string, any>; // 物料来源相关配置
  source_config?: Record<string, any>; // 物料来源相关配置（向后兼容）
  processRouteId?: number; // 默认工艺路线ID（自制件）
  processRouteName?: string; // 默认工艺路线名称
  process_route_id?: number;
  process_route_name?: string;
  /** 质检模式（none:无质检, simple:简易质检, plan:方案质检） */
  inspectionMode?: 'none' | 'simple' | 'plan';
  inspection_mode?: string;
  /** 默认质检方案ID（方案质检时使用） */
  defaultInspectionPlanId?: number | null;
  default_inspection_plan_id?: number | null;
  defaultInspectionPlanName?: string;
  overReportMode?: 'none' | 'fixed' | 'percent';
  over_report_mode?: string;
  overReportValue?: number;
  over_report_value?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  /** 树形列表：属性 SKU 子行 */
  children?: Material[];
}

// 编号映射类型定义
export interface DepartmentCodeMapping {
  code_type: string; // 编号类型（SALE/DES/PUR/WH/PROD等）
  code: string; // 编号
  name?: string; // 名称
  department?: string; // 部门名称
  description?: string; // 描述
}

export interface CustomerCodeMapping {
  customerId: number; // 客户ID
  customerUuid?: string; // 客户UUID
  customerName?: string; // 客户名称（用于显示）
  code: string; // 客户编号
  name?: string; // 名称
  description?: string; // 描述
}

export interface SupplierCodeMapping {
  supplierId: number; // 供应商ID
  supplierUuid?: string; // 供应商UUID
  supplierName?: string; // 供应商名称（用于显示）
  code: string; // 供应商编号
  name?: string; // 名称
  description?: string; // 描述
}

// 默认值类型定义
export interface MaterialDefaults {
  // 财务默认值
  defaultTaxRate?: number; // 默认税率（百分比，如13表示13%）
  defaultAccount?: string; // 默认科目
  
  // 采购默认值
  defaultSuppliers?: Array<{
    supplierId: number;
    supplierUuid?: string;
    supplierName?: string;
    priority?: number; // 优先级（1为最高）
  }>;
  defaultPurchasePrice?: number; // 默认采购价格
  /** 默认采购价格价类：tax_inclusive 含税 / tax_exclusive 不含税，新建默认含税 */
  defaultPurchasePriceType?: 'tax_inclusive' | 'tax_exclusive';
  defaultPurchaseUnit?: string; // 默认采购单位
  defaultPurchaseLeadTime?: number; // 默认采购周期（天数）
  
  // 销售默认值
  defaultSalePrice?: number; // 默认销售价格
  /** 默认销售价格价类：tax_inclusive 含税 / tax_exclusive 不含税，新建默认含税 */
  defaultSalePriceType?: 'tax_inclusive' | 'tax_exclusive';
  defaultSaleUnit?: string; // 默认销售单位
  defaultCustomers?: Array<{
    customerId: number;
    customerUuid?: string;
    customerName?: string;
  }>;
  
  // 库存默认值
  defaultWarehouses?: Array<{
    warehouseId: number;
    warehouseUuid?: string;
    warehouseName?: string;
    priority?: number; // 优先级
  }>;
  defaultLocation?: string; // 默认库位
  safetyStock?: number; // 安全库存
  maxStock?: number; // 最大库存
  minStock?: number; // 最小库存
  
  // 生产默认值
  defaultProcessRoute?: number; // 默认工艺路线ID
  defaultProcessRouteUuid?: string; // 默认工艺路线UUID
  defaultProductionUnit?: string; // 默认生产单位
}

export interface MaterialCreate {
  code?: string; // 已废弃，保留用于向后兼容
  mainCode?: string; // 主编号（如果未提供，系统会根据编号规则自动生成）
  name: string;
  groupId?: number;
  specification?: string;
  baseUnit: string;
  units?: MaterialUnits;
  batchManaged?: boolean;
  defaultBatchRuleId?: number;
  serialManaged?: boolean;
  defaultSerialRuleId?: number;
  variantManaged?: boolean;
  variantAttributes?: Record<string, any>;
  description?: string;
  brand?: string;
  model?: string;
  texture?: string;
  isActive?: boolean;
  // 编号映射
  departmentCodes?: DepartmentCodeMapping[]; // 部门编号列表
  customerCodes?: CustomerCodeMapping[]; // 客户编号列表
  supplierCodes?: SupplierCodeMapping[]; // 供应商编号列表
  // 默认值设置
  defaults?: MaterialDefaults;
  // 物料来源控制
  sourceType?: string; // 物料来源类型（Make/Buy/Phantom/Outsource）
  sourceTypes?: string[]; // 物料来源类型（多选）
  sourceConfig?: Record<string, any>; // 物料来源相关配置
}

export interface MaterialUpdate {
  code?: string;
  name?: string;
  groupId?: number;
  specification?: string;
  baseUnit?: string;
  units?: MaterialUnits;
  batchManaged?: boolean;
  defaultBatchRuleId?: number;
  serialManaged?: boolean;
  defaultSerialRuleId?: number;
  variantManaged?: boolean;
  variantAttributes?: Record<string, any>;
  description?: string;
  brand?: string;
  model?: string;
  texture?: string;
  isActive?: boolean;
  // 编号映射
  departmentCodes?: DepartmentCodeMapping[]; // 部门编号列表
  customerCodes?: CustomerCodeMapping[]; // 客户编号列表
  supplierCodes?: SupplierCodeMapping[]; // 供应商编号列表
  // 默认值设置
  defaults?: MaterialDefaults;
  // 物料来源控制
  sourceType?: string; // 物料来源类型（Make/Buy/Phantom/Outsource）
  sourceTypes?: string[]; // 物料来源类型（多选）
  sourceConfig?: Record<string, any>; // 物料来源相关配置
  /** 自制件默认工艺路线 FK（产品工艺页保存） */
  process_route_id?: number | null;
}

export interface MaterialListParams {
  skip?: number;
  limit?: number;
  groupId?: number;
  noGroup?: boolean;
  isActive?: boolean;
  keyword?: string;
  code?: string;
  name?: string;
  sourceType?: string; // 物料来源类型（Make/Buy/Outsource/Phantom）
  /** 后端：main_code | name | created_at | updated_at */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** 树形列表：主物料为父行，属性 SKU 为 children */
  treeView?: boolean;
  /** 仅主物料（排除属性 SKU 行），用于下拉选择等 */
  mastersOnly?: boolean;
}

export interface MaterialListResponse {
  items: Material[];
  total: number;
}

/** 批量更新批号/序列号管理（POST /materials/batch-tracking） */
export interface MaterialBulkTrackingPayload {
  material_uuids: string[];
  batch_managed?: boolean;
  default_batch_rule_id?: number | null;
  serial_managed?: boolean;
  default_serial_rule_id?: number | null;
}

/** POST /materials/batch-variant */
export interface MaterialBulkVariantPayload {
  material_uuids: string[];
  variantManaged: boolean;
}

/** POST /materials/batch-defaults — 合并更新 defaults 部分字段 */
export interface MaterialBulkDefaultsPatchPayload {
  material_uuids: string[];
  defaultTaxRate?: number;
  defaultWarehouseIds?: number[];
  safetyStock?: number;
  maxStock?: number;
  defaultSalePrice?: number;
  defaultLocation?: string;
}

/** POST /materials/{uuid}/generate-variants */
export interface MaterialGenerateVariantsPayload {
  attributeNames?: string[];
  skipExisting?: boolean;
}

export interface MaterialGenerateVariantsResult {
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  createdUuids: string[];
  message: string;
}

/** POST /materials/materialize-variant */
export interface MaterialMaterializeVariantPayload {
  masterMaterialUuid?: string;
  mainCode?: string;
  variantAttributes: Record<string, unknown>;
  createIfMissing?: boolean;
}

export interface MaterialMaterializeVariantResult {
  material: Material;
  created: boolean;
  matchedExisting: boolean;
}

export interface MaterialBulkTrackingResult {
  updated_count: number;
  requested_count: number;
  not_found_uuids?: string[];
}

/** POST /materials/batch-delete */
export interface MaterialBatchDeleteFailedItem {
  uuid: string;
  reason: string;
}

export interface MaterialBatchDeleteResult {
  deleted_count: number;
  failed_count: number;
  failed_items: MaterialBatchDeleteFailedItem[];
}

/** POST /materials/batch-move-group */
export interface MaterialBatchMoveGroupResult {
  updated_count: number;
  requested_count: number;
  not_found_uuids?: string[];
}

/** POST /materials/batch-process-route | batch-source-type */
export interface MaterialBatchFieldUpdatePayload {
  material_uuids: string[];
  processRouteId?: number | null;
  sourceType?: string;
}

export interface MaterialBatchFieldUpdateResult {
  updated_count: number;
  requested_count: number;
  not_found_uuids?: string[];
}

/** POST /materials/rewrite-main-codes（试运营模式） */
export interface MaterialRewriteMainCodesFailedItem {
  uuid: string;
  reason: string;
}

export interface MaterialRewriteMainCodesPayload {
  material_uuids?: string[];
  groupId?: number;
  reset_sequence?: boolean;
}

export interface MaterialRewriteMainCodesResult {
  updated_count: number;
  updated_material_count: number;
  requested_count: number;
  failed_count: number;
  failed_items: MaterialRewriteMainCodesFailedItem[];
}

/** GET /materials/standard-parts/preset-preview 中单条标准件 */
export interface StandardPartPresetItem {
  presetKey: string;
  name: string;
  specification: string;
  gbStandard: string;
  gbCode: string;
  baseUnit: string;
  texture?: string;
  description?: string;
}

/** 预设库一级大类（与后端 PRIMARY_CATEGORY_ALLOWED 一致；扩展时需同步后端与 i18n） */
/** 下拉展示顺序：与后端 PRIMARY_CATEGORY_ALLOWED 键集合一致 */
export const STANDARD_PRESET_PRIMARY_ORDER = [
  'standard_parts',
  'raw_materials',
  'electrical_components',
  'tools_and_gauges',
  'chemicals_lubricants',
  'auxiliary_materials',
  'consumables',
  'packaging',
  'mro_spares',
  'general',
] as const;

export type StandardPresetPrimaryCategoryId = (typeof STANDARD_PRESET_PRIMARY_ORDER)[number];

/** 标准件预设分类 */
export interface StandardPartPresetCategory {
  id: string;
  name: string;
  description?: string;
  industryId?: string;
  industryName?: string;
  /** 一级大类，默认 standard_parts */
  primaryCategory?: StandardPresetPrimaryCategoryId | string;
  items: StandardPartPresetItem[];
}

export interface StandardPartPresetPrimaryCategory {
  id: string;
  name: string;
  categories: StandardPartPresetCategory[];
}

export interface StandardPartPresetIndustry {
  id: string;
  name: string;
  description?: string;
  primaryCategories: StandardPartPresetPrimaryCategory[];
}

export interface StandardPartPresetTaxonomyPrimary {
  id: string;
  name: string;
}

export interface StandardPartPresetTaxonomySecondary {
  id: string;
  name: string;
  description?: string;
  primaryCategory: string;
}

/** 标准件预设目录 */
export interface StandardPartsPresetCatalog {
  industries: StandardPartPresetIndustry[];
  taxonomy: {
    primaryCategories: StandardPartPresetTaxonomyPrimary[];
    secondaryCategories: StandardPartPresetTaxonomySecondary[];
  };
}

/** POST /materials/standard-parts/load-preset 响应 */
export interface LoadStandardPartsPresetResponse {
  created: number;
  skippedDuplicateCode: number;
  skippedDuplicateItem: number;
  failed: number;
  groupsCreated?: number;
  groupsReused?: number;
  message: string;
}

/**
 * BOM（物料清单）类型定义
 * 
 * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
 */
export interface BOM {
  id: number;
  uuid: string;
  tenantId: number;
  materialId: number;
  componentId: number;
  quantity: number;
  unit?: string;
  // 损耗率和必选标识（根据优化设计规范新增）
  wasteRate: number; // 损耗率（百分比，如：5.00表示5%）
  isRequired: boolean; // 是否必选（默认：true）
  issueMethod?: 'pick' | 'backflush' | 'none';
  // 层级信息（用于多层级BOM展开，根据优化设计规范新增）
  level: number; // 层级深度（0为顶层）
  path?: string; // 层级路径（如：1/2/3）
  // 版本控制
  version: string;
  bomCode?: string;
  isDefault?: boolean; // 是否为默认版本（每个物料至多一个）
  // 有效期管理
  effectiveDate?: string;
  expiryDate?: string;
  // 失效标记（人为设为失效）
  isObsolete?: boolean;
  obsoletedAt?: string;
  obsoleteReason?: string;
  // 审核管理
  approvalStatus: 'draft' | 'pending' | 'approved' | 'rejected';
  approvedBy?: number;
  approvedAt?: string;
  approvalComment?: string;
  // 替代料管理
  isAlternative: boolean;
  alternativeGroupId?: number;
  priority: number;
  // 配置件（配置位）
  isConfigurable?: boolean;
  configurableGroupId?: number | null;
  isDefaultConfigurable?: boolean;
  // 扩展信息
  description?: string;
  remark?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface BOMCreate {
  materialId: number;
  componentId: number;
  quantity: number;
  unit?: string;
  // 损耗率和必选标识（根据优化设计规范新增）
  wasteRate?: number; // 损耗率（百分比，如：5.00表示5%）
  isRequired?: boolean; // 是否必选（默认：true）
  issueMethod?: 'pick' | 'backflush' | 'none';
  level?: number; // 层级深度（0为顶层）
  path?: string; // 层级路径（如：1/2/3）
  isAlternative?: boolean;
  alternativeGroupId?: number;
  priority?: number;
  description?: string;
  isActive?: boolean;
}

export interface BOMUpdate {
  materialId?: number;
  componentId?: number;
  quantity?: number;
  unit?: string;
  // 损耗率和必选标识（根据优化设计规范新增）
  wasteRate?: number; // 损耗率（百分比，如：5.00表示5%）
  isRequired?: boolean; // 是否必选
  issueMethod?: 'pick' | 'backflush' | 'none';
  // 层级信息（根据优化设计规范新增）
  level?: number; // 层级深度（0为顶层）
  path?: string; // 层级路径（如：1/2/3）
  isDefault?: boolean; // 设为默认版本（每个物料至多一个）
  isAlternative?: boolean;
  alternativeGroupId?: number;
  priority?: number;
  description?: string;
  isActive?: boolean;
}

export interface BOMListParams {
  skip?: number;
  limit?: number;
  materialId?: number;
  isActive?: boolean;
  /** 是否包含已失效的 BOM 版本 */
  includeObsolete?: boolean;
}

/** BOM 分组摘要（按 material_id + version，用于列表树） */
export interface BOMGroupSummary {
  material_id: number;
  version: string;
  bom_code?: string;
  approval_status: string;
  is_default: boolean;
  is_obsolete: boolean;
  item_count: number;
}

export interface BOMItemCreate {
  componentId: number;
  quantity: number;
  unit?: string;
  // 损耗率和必选标识（根据优化设计规范新增）
  wasteRate?: number; // 损耗率（百分比，如：5.00表示5%）
  isRequired?: boolean; // 是否必选（默认：true）
  issueMethod?: 'pick' | 'backflush' | 'none';
  isAlternative?: boolean;
  alternativeGroupId?: number;
  priority?: number;
  description?: string;
  remark?: string;
}

export interface BOMBatchCreate {
  materialId: number;
  items: BOMItemCreate[];
  // 版本控制
  version?: string;
  bomCode?: string;
  // 有效期管理
  effectiveDate?: string;
  expiryDate?: string;
  // 审核管理
  approvalStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
  // 扩展信息
  description?: string;
  remark?: string;
  isActive?: boolean;
}

/**
 * BOM批量导入项类型定义
 * 
 * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
 * 支持使用任意部门编号，系统自动映射到主编号。
 */
export interface BOMBatchImportItem {
  parentCode: string; // 父件编号（支持任意部门编号：SALE-A001、DES-A001、主编号MAT-FIN-0001）
  componentCode: string; // 子件编号（支持任意部门编号：PROD-A001、主编号MAT-SEMI-0001）
  quantity: number; // 子件数量（必填，数字）
  unit?: string; // 子件单位（可选，如：个、kg、m等）
  wasteRate?: number; // 损耗率（可选，百分比，如：5%表示5.00）
  isRequired?: boolean; // 是否必选（可选，是/否，默认：是）
  isConfigurable?: boolean; // 是否为配置位（用户在下单/开工单时选择）
  configurableGroupId?: number | null; // 配置位组ID（同组多行=该位置的可选物料）
  isDefaultConfigurable?: boolean; // 配置位组内是否为默认选项
  isAlternative?: boolean; // 是否为替代料（同组替代料生产时择一）
  alternativeGroupId?: number | null; // 替代料组ID（同组填相同ID）
  priority?: number; // 优先级（替代料顺序，数字越小越优先）
  /** 发料方式：pick=领料配料, backflush=倒冲, none=不发料 */
  issueMethod?: 'pick' | 'backflush' | 'none';
  remark?: string; // 备注（可选）
}

/**
 * BOM批量导入类型定义
 * 
 * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
 * 支持universheet批量导入，支持部门编号自动映射。
 */
export interface BOMBatchImport {
  items: BOMBatchImportItem[]; // BOM导入项列表
  version?: string; // BOM版本号（可选，默认：1.0）
  bomCode?: string; // BOM编号（可选）
  effectiveDate?: string; // 生效日期（可选）
  description?: string; // 描述（可选）
  versionRemark?: string; // 版本变更备注（可选，写入本版本所有BOM行）
}

export type BOMRelationImportEntity = 'material' | 'processRoute' | 'operation' | 'performance';
export type BOMRelationImportWriteStrategy = 'upsert' | 'create_only' | 'link_only' | 'strict_fail';

export interface BOMRelationImportRequest {
  rows: string[][];
  entities: BOMRelationImportEntity[];
  writeStrategy: BOMRelationImportWriteStrategy;
}

export interface BOMRelationImportResult {
  success: boolean;
  message?: string;
  summary: {
    created: number;
    updated: number;
    linked: number;
    failed: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * BOM版本创建类型定义
 * 
 * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
 */
export interface BOMVersionCreate {
  version: string; // 版本号（如：v1.1）
  versionDescription?: string; // 版本说明
  effectiveDate?: string; // 生效日期（可选）
  applyStrategy: 'new_only' | 'all'; // 版本应用策略：new_only（仅新工单使用新版本，推荐）或 all（所有工单使用新版本，谨慎使用）
}

/**
 * BOM版本对比类型定义
 * 
 * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
 */
export interface BOMVersionCompare {
  version1: string; // 版本1（如：v1.0）
  version2: string; // 版本2（如：v1.1）
}

/**
 * BOM版本对比结果类型定义
 */
export interface BOMVersionCompareResult {
  materialId: number;
  version1: string;
  version2: string;
  added: Array<{
    componentId: number;
    componentCode: string;
    componentName: string;
    quantity: number;
    unit?: string;
    wasteRate: number;
  }>; // 新增的子件
  removed: Array<{
    componentId: number;
    componentCode: string;
    componentName: string;
    quantity: number;
    unit?: string;
    wasteRate: number;
  }>; // 删除的子件
  modified: Array<{
    componentId: number;
    componentCode: string;
    componentName: string;
    version1: {
      quantity: number;
      unit?: string;
      wasteRate: number;
      isRequired: boolean;
    };
    version2: {
      quantity: number;
      unit?: string;
      wasteRate: number;
      isRequired: boolean;
    };
  }>; // 修改的子件
}

/**
 * BOM层级结构项类型定义
 */
export interface BOMHierarchyItem {
  componentId: number;
  componentCode: string;
  componentName: string;
  quantity: number;
  unit?: string;
  wasteRate: number;
  isRequired: boolean;
  level: number;
  path: string;
  isConfigurable?: boolean;
  configurableGroupId?: number | null;
  isDefaultConfigurable?: boolean;
  isAlternative?: boolean;
  alternativeGroupId?: number | null;
  priority?: number;
  /** 成品/半成品节点：该物料 BOM 的版本号，用于在节点上显示 */
  bomVersion?: string;
  /** 发料方式：pick=领料配料, backflush=倒冲, none=不发料 */
  issueMethod?: 'pick' | 'backflush' | 'none';
  children: BOMHierarchyItem[]; // 子项（递归结构）
}

/**
 * BOM层级结构类型定义
 */
export interface BOMHierarchy {
  materialId: number;
  materialCode: string;
  materialName: string;
  version: string;
  approvalStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
  items: BOMHierarchyItem[];
}


/**
 * BOM用量计算结果类型定义
 */
export interface BOMQuantityComponent {
  componentId: number;
  componentCode: string;
  componentName: string;
  baseQuantity: number; // 基础用量
  wasteRate: number; // 损耗率
  actualQuantity: number; // 实际用量（考虑损耗率）
  unit?: string;
  level: number; // 层级
}

/**
 * BOM用量计算结果类型定义
 */
export interface BOMQuantityResult {
  materialId: number;
  parentQuantity: number; // 父物料数量
  components: BOMQuantityComponent[]; // 子物料用量列表
}

/**
 * BOM循环依赖检测结果类型定义
 */
export interface BOMCycleDetectionResult {
  hasCycle: boolean; // 是否会导致循环依赖
}


// ==================== 物料编号映射类型定义 ====================

export interface MaterialCodeMapping {
  id: number;
  uuid: string;
  tenantId: number;
  materialId: number;
  materialUuid: string;
  internalCode: string;
  externalCode: string;
  externalSystem: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MaterialCodeMappingCreate {
  materialUuid: string;
  internalCode: string;
  externalCode: string;
  externalSystem: string;
  description?: string;
  isActive?: boolean;
}

export interface MaterialCodeMappingUpdate {
  materialUuid?: string;
  internalCode?: string;
  externalCode?: string;
  externalSystem?: string;
  description?: string;
  isActive?: boolean;
}

export interface MaterialCodeMappingListParams {
  materialUuid?: string;
  externalSystem?: string;
  internalCode?: string;
  externalCode?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface MaterialCodeMappingListResponse {
  items: MaterialCodeMapping[];
  total: number;
}

export interface MaterialCodeConvertRequest {
  externalCode: string;
  externalSystem: string;
}

export interface MaterialCodeConvertResponse {
  internalCode: string;
  materialUuid: string;
  materialName: string;
  found: boolean;
}

export interface MaterialCodeMappingBatchImportResult {
  successCount: number;
  failureCount: number;
  errors: Array<{
    index: number;
    externalCode: string;
    externalSystem: string;
    error: string;
  }>;
}

// ==================== 物料批号类型定义 ====================

export interface MaterialBatch {
  id: number;
  uuid: string;
  tenantId: number;
  materialId: number;
  materialUuid: string;
  materialName?: string;
  materialCode?: string;
  materialModel?: string;
  batchNo: string;
  productionDate?: string;
  expiryDate?: string;
  supplierBatchNo?: string;
  quantity: number;
  status: string; // in_stock, out_stock, expired, scrapped
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MaterialBatchCreate {
  materialUuid: string;
  batchNo: string;
  productionDate?: string;
  expiryDate?: string;
  supplierBatchNo?: string;
  quantity?: number;
  status?: string;
  remark?: string;
}

export interface MaterialBatchUpdate {
  productionDate?: string;
  expiryDate?: string;
  supplierBatchNo?: string;
  quantity?: number;
  status?: string;
  remark?: string;
}

export interface MaterialBatchListParams {
  materialUuid?: string;
  batchNo?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  /** 综合模糊：批号、供应商批号、物料名称 */
  keyword?: string;
  /** 后端 snake：batch_no | quantity | status | production_date | expiry_date | created_at | material_name */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MaterialBatchListResponse {
  items: MaterialBatch[];
  total: number;
}

// ==================== 物料序列号类型定义 ====================

export interface MaterialSerial {
  id: number;
  uuid: string;
  tenantId: number;
  materialId: number;
  materialUuid: string;
  materialName?: string;
  materialCode?: string;
  materialModel?: string;
  serialNo: string;
  productionDate?: string;
  factoryDate?: string;
  supplierSerialNo?: string;
  status: string; // in_stock, out_stock, sold, scrapped, returned
  remark?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MaterialSerialCreate {
  materialUuid: string;
  serialNo: string;
  productionDate?: string;
  factoryDate?: string;
  supplierSerialNo?: string;
  status?: string;
  remark?: string;
}

export interface MaterialSerialUpdate {
  productionDate?: string;
  factoryDate?: string;
  supplierSerialNo?: string;
  status?: string;
  remark?: string;
}

export interface MaterialSerialListParams {
  materialUuid?: string;
  serialNo?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  keyword?: string;
  /** serial_no | status | production_date | factory_date | created_at | material_name */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MaterialSerialListResponse {
  items: MaterialSerial[];
  total: number;
}