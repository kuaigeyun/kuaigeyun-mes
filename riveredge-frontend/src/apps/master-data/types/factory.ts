/**
 * 工厂数据类型定义
 * 
 * 定义厂区、车间、产线、工位的数据类型
 */

/** 工厂主数据列表接口统一返回结构 */
export interface FactoryPaginatedList<T> {
  items: T[];
  total: number;
}

export interface Plant {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  description?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PlantCreate {
  code: string;
  name: string;
  description?: string;
  address?: string;
  isActive?: boolean;
}

export interface PlantUpdate {
  code?: string;
  name?: string;
  description?: string;
  address?: string;
  isActive?: boolean;
}

export interface PlantListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  keyword?: string;
  code?: string;
  name?: string;
  sort_field?: string;
  sort_order?: string;
}

export interface Workshop {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  plantId?: number;
  /** 后端列表/详情顺带返回，避免前端异步拉厂区字典闪烁 */
  plantCode?: string;
  plantName?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WorkshopCreate {
  code: string;
  name: string;
  plantId?: number;
  description?: string;
  isActive?: boolean;
}

export interface WorkshopUpdate {
  code?: string;
  name?: string;
  plantId?: number;
  description?: string;
  isActive?: boolean;
}

export interface WorkshopListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  keyword?: string;
  code?: string;
  name?: string;
  plantId?: number;
  sort_field?: string;
  sort_order?: string;
}

export interface ProductionLine {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  workshopId: number;
  /** 后端列表/详情顺带返回，避免前端异步拉车间字典闪烁 */
  workshopCode?: string;
  workshopName?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ProductionLineCreate {
  code: string;
  name: string;
  workshopId: number;
  description?: string;
  isActive?: boolean;
}

export interface ProductionLineUpdate {
  code?: string;
  name?: string;
  workshopId?: number;
  description?: string;
  isActive?: boolean;
}

export interface ProductionLineListParams {
  skip?: number;
  limit?: number;
  workshop_id?: number;
  is_active?: boolean;
  keyword?: string;
  sort_field?: string;
  sort_order?: string;
}

export interface Workstation {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  productionLineId: number;
  /** 后端列表/详情顺带返回，避免前端异步拉产线字典闪烁 */
  productionLineCode?: string;
  productionLineName?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WorkstationCreate {
  code: string;
  name: string;
  productionLineId: number;
  description?: string;
  isActive?: boolean;
}

export interface WorkstationUpdate {
  code?: string;
  name?: string;
  productionLineId?: number;
  description?: string;
  isActive?: boolean;
}

export interface WorkstationListParams {
  skip?: number;
  limit?: number;
  production_line_id?: number;
  is_active?: boolean;
  keyword?: string;
  sort_field?: string;
  sort_order?: string;
}

export interface WorkCenter {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  workstationIds?: number[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WorkCenterCreate {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  workstationIds?: number[];
}

export interface WorkCenterUpdate {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  workstationIds?: number[];
}

export interface WorkCenterListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  keyword?: string;
  code?: string;
  name?: string;
  sort_field?: string;
  sort_order?: string;
}

export interface WorkGroupMemberItem {
  employeeId: number;
  employeeName?: string;
  performanceWeight: number;
  sortOrder?: number;
}

export interface WorkGroup {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  members?: WorkGroupMemberItem[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WorkGroupCreate {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  members?: WorkGroupMemberItem[];
}

export interface WorkGroupUpdate {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  members?: WorkGroupMemberItem[];
}

export interface WorkGroupListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  keyword?: string;
  code?: string;
  name?: string;
  sort_field?: string;
  sort_order?: string;
}

