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
  name: string;
  parentId?: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MaterialGroupCreate {
  code: string;
  name: string;
  parentId?: number;
  description?: string;
  isActive?: boolean;
}

export interface MaterialGroupUpdate {
  code?: string;
  name?: string;
  parentId?: number;
  description?: string;
  isActive?: boolean;
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
  mainCode?: string; // 主编码（系统内部唯一标识）
  name: string;
  groupId?: number;
  materialType?: string; // 物料类型（FIN/SEMI/RAW/PACK/AUX）
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
  isActive: boolean;
  defaults?: MaterialDefaults; // 默认值设置
  codeAliases?: MaterialCodeAlias[]; // 编码别名列表
  sourceType?: string; // 物料来源类型（Make/Buy/Phantom/Outsource/Configure）
  source_type?: string; // 物料来源类型（向后兼容）
  sourceConfig?: Record<string, any>; // 物料来源相关配置
  source_config?: Record<string, any>; // 物料来源相关配置（向后兼容）
  processRouteId?: number; // 默认工艺路线ID（自制件）
  processRouteName?: string; // 默认工艺路线名称
  process_route_id?: number;
  process_route_name?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

// 编码映射类型定义
export interface DepartmentCodeMapping {
  code_type: string; // 编码类型（SALE/DES/PUR/WH/PROD等）
  code: string; // 编码
  name?: string; // 名称
  department?: string; // 部门名称
  description?: string; // 描述
}

export interface CustomerCodeMapping {
  customerId: number; // 客户ID
  customerUuid?: string; // 客户UUID
  customerName?: string; // 客户名称（用于显示）
  code: string; // 客户编码
  name?: string; // 名称
  description?: string; // 描述
}

export interface SupplierCodeMapping {
  supplierId: number; // 供应商ID
  supplierUuid?: string; // 供应商UUID
  supplierName?: string; // 供应商名称（用于显示）
  code: string; // 供应商编码
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
  defaultPurchaseUnit?: string; // 默认采购单位
  defaultPurchaseLeadTime?: number; // 默认采购周期（天数）
  
  // 销售默认值
  defaultSalePrice?: number; // 默认销售价格
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
  mainCode?: string; // 主编码（如果未提供，系统会根据编码规则自动生成）
  name: string;
  groupId?: number;
  materialType?: string; // 物料类型（FIN/SEMI/RAW/PACK/AUX）
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
  isActive?: boolean;
  // 编码映射
  departmentCodes?: DepartmentCodeMapping[]; // 部门编码列表
  customerCodes?: CustomerCodeMapping[]; // 客户编码列表
  supplierCodes?: SupplierCodeMapping[]; // 供应商编码列表
  // 默认值设置
  defaults?: MaterialDefaults;
  // 物料来源控制
  sourceType?: string; // 物料来源类型（Make/Buy/Phantom/Outsource/Configure）
  sourceConfig?: Record<string, any>; // 物料来源相关配置
}

export interface MaterialUpdate {
  code?: string;
  name?: string;
  groupId?: number;
  materialType?: string; // 物料类型（FIN/SEMI/RAW/PACK/AUX）
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
  isActive?: boolean;
  // 编码映射
  departmentCodes?: DepartmentCodeMapping[]; // 部门编码列表
  customerCodes?: CustomerCodeMapping[]; // 客户编码列表
  supplierCodes?: SupplierCodeMapping[]; // 供应商编码列表
  // 默认值设置
  defaults?: MaterialDefaults;
  // 物料来源控制
  sourceType?: string; // 物料来源类型（Make/Buy/Phantom/Outsource/Configure）
  sourceConfig?: Record<string, any>; // 物料来源相关配置
}

export interface MaterialListParams {
  skip?: number;
  limit?: number;
  groupId?: number;
  isActive?: boolean;
  keyword?: string;
  code?: string;
  name?: string;
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
  // 审核管理
  approvalStatus: 'draft' | 'pending' | 'approved' | 'rejected';
  approvedBy?: number;
  approvedAt?: string;
  approvalComment?: string;
  // 替代料管理
  isAlternative: boolean;
  alternativeGroupId?: number;
  priority: number;
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
  // 层级信息（根据优化设计规范新增）
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
}

export interface BOMItemCreate {
  componentId: number;
  quantity: number;
  unit?: string;
  // 损耗率和必选标识（根据优化设计规范新增）
  wasteRate?: number; // 损耗率（百分比，如：5.00表示5%）
  isRequired?: boolean; // 是否必选（默认：true）
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
 * 支持使用任意部门编码，系统自动映射到主编码。
 */
export interface BOMBatchImportItem {
  parentCode: string; // 父件编码（支持任意部门编码：SALE-A001、DES-A001、主编码MAT-FIN-0001）
  componentCode: string; // 子件编码（支持任意部门编码：PROD-A001、主编码MAT-SEMI-0001）
  quantity: number; // 子件数量（必填，数字）
  unit?: string; // 子件单位（可选，如：个、kg、m等）
  wasteRate?: number; // 损耗率（可选，百分比，如：5%表示5.00）
  isRequired?: boolean; // 是否必选（可选，是/否，默认：是）
  remark?: string; // 备注（可选）
}

/**
 * BOM批量导入类型定义
 * 
 * 根据《工艺路线和标准作业流程优化设计规范.md》设计。
 * 支持universheet批量导入，支持部门编码自动映射。
 */
export interface BOMBatchImport {
  items: BOMBatchImportItem[]; // BOM导入项列表
  version?: string; // BOM版本号（可选，默认：1.0）
  bomCode?: string; // BOM编码（可选）
  effectiveDate?: string; // 生效日期（可选）
  description?: string; // 描述（可选）
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


// ==================== 物料编码映射类型定义 ====================

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
}

export interface MaterialSerialListResponse {
  items: MaterialSerial[];
  total: number;
}