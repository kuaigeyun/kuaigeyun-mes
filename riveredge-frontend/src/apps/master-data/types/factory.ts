/**
 * 工厂数据类型定义
 * 
 * 定义厂区、车间、产线、工位的数据类型
 */

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
  isActive?: boolean;
}

export interface Workshop {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  plantId?: number;
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
  isActive?: boolean;
}

export interface ProductionLine {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  workshopId: number;
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
  workshopId?: number;
  isActive?: boolean;
}

export interface Workstation {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  productionLineId: number;
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
  productionLineId?: number;
  isActive?: boolean;
}

