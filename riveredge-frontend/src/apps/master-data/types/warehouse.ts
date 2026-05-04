/**
 * 仓库数据类型定义
 * 
 * 定义仓库、库区、库位的数据类型
 */

export interface Warehouse {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  warehouseType?: string;
  workshopId?: number;
  workshopName?: string;
  workstationId?: number;
  workstationName?: string;
  workCenterId?: number;
  workCenterName?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface WarehouseCreate {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  warehouseType?: string;
  workshopId?: number;
  workstationId?: number;
  workCenterId?: number;
}

export interface WarehouseUpdate {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  warehouseType?: string;
  workshopId?: number;
  workstationId?: number;
  workCenterId?: number;
}

export interface WarehouseListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  warehouse_type?: string;
  keyword?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
}

export interface StorageArea {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  warehouseId: number;
  /** 后端列表/详情顺带返回，避免前端异步拉仓库字典闪烁 */
  warehouseCode?: string;
  warehouseName?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface StorageAreaCreate {
  code: string;
  name: string;
  warehouseId: number;
  description?: string;
  isActive?: boolean;
}

export interface StorageAreaUpdate {
  code?: string;
  name?: string;
  warehouseId?: number;
  description?: string;
  isActive?: boolean;
}

export interface StorageAreaListParams {
  skip?: number;
  limit?: number;
  warehouse_id?: number;
  is_active?: boolean;
  keyword?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
}

export interface StorageLocation {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  storageAreaId: number;
  /** 后端列表/详情顺带返回，避免前端异步拉库区字典闪烁 */
  storageAreaCode?: string;
  storageAreaName?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface StorageLocationCreate {
  code: string;
  name: string;
  storageAreaId: number;
  description?: string;
  isActive?: boolean;
}

export interface StorageLocationUpdate {
  code?: string;
  name?: string;
  storageAreaId?: number;
  description?: string;
  isActive?: boolean;
}

export interface StorageLocationListParams {
  skip?: number;
  limit?: number;
  storage_area_id?: number;
  is_active?: boolean;
  keyword?: string;
  sort_field?: string;
  sort_order?: 'asc' | 'desc';
}

export interface WarehouseListResponse {
  items: Warehouse[];
  total: number;
}

export interface StorageAreaListResponse {
  items: StorageArea[];
  total: number;
}

export interface StorageLocationListResponse {
  items: StorageLocation[];
  total: number;
}
