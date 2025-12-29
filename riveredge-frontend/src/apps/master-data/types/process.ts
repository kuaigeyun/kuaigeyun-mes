/**
 * 工艺数据类型定义
 * 
 * 定义不良品、工序、工艺路线、作业程序（SOP）的数据类型
 */

export interface DefectType {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  category?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface DefectTypeCreate {
  code: string;
  name: string;
  category?: string;
  description?: string;
  isActive?: boolean;
}

export interface DefectTypeUpdate {
  code?: string;
  name?: string;
  category?: string;
  description?: string;
  isActive?: boolean;
}

export interface DefectTypeListParams {
  skip?: number;
  limit?: number;
  category?: string;
  isActive?: boolean;
}

export interface Operation {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface OperationCreate {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface OperationUpdate {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface OperationListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
}

export interface ProcessRoute {
  id: number;
  uuid: string;
  tenant_id: number;
  code: string;
  name: string;
  description?: string;
  operation_sequence?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface ProcessRouteCreate {
  code: string;
  name: string;
  description?: string;
  operationSequence?: Record<string, any>;
  isActive?: boolean;
}

export interface ProcessRouteUpdate {
  code?: string;
  name?: string;
  description?: string;
  operationSequence?: Record<string, any>;
  isActive?: boolean;
}

export interface ProcessRouteListParams {
  skip?: number;
  limit?: number;
  is_active?: boolean;
}

export interface SOP {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  operationId?: number;
  version?: string;
  content?: string;
  attachments?: Record<string, any>;
  flowConfig?: Record<string, any>; // ProFlow 流程配置（包含 nodes 和 edges）
  formConfig?: Record<string, any>; // Formily 表单配置（每个步骤的表单定义）
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SOPCreate {
  code: string;
  name: string;
  operationId?: number;
  version?: string;
  content?: string;
  attachments?: Record<string, any>;
  flowConfig?: Record<string, any>; // ProFlow 流程配置
  formConfig?: Record<string, any>; // Formily 表单配置
  isActive?: boolean;
}

export interface SOPUpdate {
  code?: string;
  name?: string;
  operationId?: number;
  version?: string;
  content?: string;
  attachments?: Record<string, any>;
  flowConfig?: Record<string, any>; // ProFlow 流程配置
  formConfig?: Record<string, any>; // Formily 表单配置
  isActive?: boolean;
}

export interface SOPListParams {
  skip?: number;
  limit?: number;
  operationId?: number;
  isActive?: boolean;
}

export interface SOPExecution {
  id: number;
  uuid: string;
  tenantId: number;
  sopUuid: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'paused' | 'cancelled';
  currentNodeId?: string;
  nodeData?: Record<string, { formData: Record<string, any>; completedAt: string }>;
  inngestRunId?: string;
  executorId: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface SOPExecutionCreate {
  sopUuid: string;
  title: string;
  description?: string;
  executorId: number;
}

export interface SOPExecutionUpdate {
  title?: string;
  description?: string;
  status?: 'pending' | 'running' | 'completed' | 'paused' | 'cancelled';
  currentNodeId?: string;
  nodeData?: Record<string, any>;
}

export interface SOPExecutionListParams {
  skip?: number;
  limit?: number;
  sopUuid?: string;
  status?: string;
  executorId?: number;
}

export interface SOPNodeCompleteRequest {
  nodeId: string;
  formData: Record<string, any>;
}

