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

export interface Material {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  groupId?: number;
  specification?: string;
  baseUnit: string;
  units?: Record<string, any>;
  batchManaged: boolean;
  variantManaged: boolean;
  variantAttributes?: Record<string, any>;
  description?: string;
  brand?: string;
  model?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface MaterialCreate {
  code: string;
  name: string;
  groupId?: number;
  specification?: string;
  baseUnit: string;
  units?: Record<string, any>;
  batchManaged?: boolean;
  variantManaged?: boolean;
  variantAttributes?: Record<string, any>;
  description?: string;
  brand?: string;
  model?: string;
  isActive?: boolean;
}

export interface MaterialUpdate {
  code?: string;
  name?: string;
  groupId?: number;
  specification?: string;
  baseUnit?: string;
  units?: Record<string, any>;
  batchManaged?: boolean;
  variantManaged?: boolean;
  variantAttributes?: Record<string, any>;
  description?: string;
  brand?: string;
  model?: string;
  isActive?: boolean;
}

export interface MaterialListParams {
  skip?: number;
  limit?: number;
  groupId?: number;
  isActive?: boolean;
}

export interface BOM {
  id: number;
  uuid: string;
  tenantId: number;
  materialId: number;
  componentId: number;
  quantity: number;
  unit: string;
  isAlternative: boolean;
  alternativeGroupId?: number;
  priority: number;
  description?: string;
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

