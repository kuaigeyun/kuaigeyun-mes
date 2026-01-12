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
  variantManaged: boolean;
  variantAttributes?: Record<string, any>;
  description?: string;
  brand?: string;
  model?: string;
  isActive: boolean;
  defaults?: MaterialDefaults; // 默认值设置
  codeAliases?: MaterialCodeAlias[]; // 编码别名列表
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

export interface BOM {
  id: number;
  uuid: string;
  tenantId: number;
  materialId: number;
  componentId: number;
  quantity: number;
  unit: string;
  // 版本控制
  version: string;
  bomCode?: string;
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
  unit: string;
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
  unit: string;
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
