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

/** 不良品项简要（工序绑定用） */
export interface DefectTypeMinimal {
  uuid: string;
  code: string;
  name: string;
}

export interface Operation {
  id: number;
  uuid: string;
  tenantId: number;
  code: string;
  name: string;
  description?: string;
  reportingType: 'quantity' | 'status';
  allowJump: boolean;
  isActive: boolean;
  /** 允许绑定的不良品项（API 可能返回 defect_types） */
  defectTypes?: DefectTypeMinimal[];
  defect_types?: DefectTypeMinimal[];
  defaultOperatorId?: number;
  default_operator_id?: number;
  defaultOperatorUuids?: string[];
  default_operator_uuids?: string[];
  defaultOperatorNames?: string[];
  default_operator_names?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface OperationCreate {
  code: string;
  name: string;
  description?: string;
  reportingType?: 'quantity' | 'status';
  allowJump?: boolean;
  isActive?: boolean;
  defectTypeUuids?: string[];
  defaultOperatorUuids?: string[];
}

export interface OperationUpdate {
  code?: string;
  name?: string;
  description?: string;
  reportingType?: 'quantity' | 'status';
  allowJump?: boolean;
  isActive?: boolean;
  defectTypeUuids?: string[];
  defaultOperatorUuids?: string[];
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
  version: string; // 版本号（如：v1.0、v1.1）
  versionDescription?: string; // 版本说明
  baseVersion?: string; // 基于版本（从哪个版本创建）
  effectiveDate?: string; // 生效日期
  operation_sequence?: Record<string, any>;
  parentRouteUuid?: string; // 父工艺路线UUID（如果此工艺路线是子工艺路线）
  parentOperationUuid?: string; // 父工序UUID（此子工艺路线所属的父工序）
  level: number; // 嵌套层级（0为主工艺路线，1-3为子工艺路线）
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

// ==================== 工艺路线版本管理相关类型 ====================

export interface ProcessRouteVersionCreate {
  version: string; // 版本号（如：v1.1）
  versionDescription?: string; // 版本说明
  effectiveDate?: string; // 生效日期（可选，默认为当前日期）
  applyStrategy: 'new_only' | 'all'; // 版本应用策略：new_only（仅新工单使用新版本，推荐）或 all（所有工单使用新版本，谨慎使用）
}

export interface ProcessRouteVersionCompare {
  version1: string; // 版本1
  version2: string; // 版本2
}

export interface ProcessRouteVersionCompareResult {
  version1: string;
  version2: string;
  added_operations: Array<{
    operation: Record<string, any>;
    position: number;
  }>;
  removed_operations: Array<{
    operation: Record<string, any>;
    old_position: number;
  }>;
  modified_operations: Array<{
    operation: Record<string, any>;
    changes: Record<string, { old: any; new: any }>;
  }>;
  sequence_changes: Array<{
    operation: Record<string, any>;
    old_position: number;
    new_position: number;
  }>;
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
  flowConfig?: Record<string, any>; // ProFlow 流程配置（作业指导步骤与顺序）
  formConfig?: Record<string, any>; // 报工数据采集项（Formily Schema）
  isActive: boolean;
  /** 绑定的物料组 UUID 列表 */
  materialGroupUuids?: string[];
  /** 绑定的具体物料 UUID 列表，匹配时优先于物料组 */
  materialUuids?: string[];
  /** 载入的工艺路线 UUID 列表，作为融合输入 */
  routeUuids?: string[];
  /** BOM 载入方式：by_material / by_material_group / specific_bom */
  bomLoadMode?: string;
  /** 指定 BOM 的 UUID（bom_load_mode=specific_bom 时使用） */
  specificBomUuid?: string | null;
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
  flowConfig?: Record<string, any>;
  formConfig?: Record<string, any>; // 报工数据采集项
  isActive?: boolean;
  materialGroupUuids?: string[];
  materialUuids?: string[];
  routeUuids?: string[];
  bomLoadMode?: string;
  specificBomUuid?: string | null;
}

export interface SOPUpdate {
  code?: string;
  name?: string;
  operationId?: number;
  version?: string;
  content?: string;
  attachments?: Record<string, any>;
  flowConfig?: Record<string, any>;
  formConfig?: Record<string, any>;
  isActive?: boolean;
  materialGroupUuids?: string[];
  materialUuids?: string[];
  routeUuids?: string[];
  bomLoadMode?: string;
  specificBomUuid?: string | null;
}

export interface SOPListParams {
  skip?: number;
  limit?: number;
  operationId?: number;
  isActive?: boolean;
  material_uuid?: string;
  material_group_uuid?: string;
  route_uuid?: string;
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

