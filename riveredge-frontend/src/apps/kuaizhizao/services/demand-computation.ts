/**
 * 统一需求计算API服务
 *
 * 提供统一需求计算相关的API调用接口
 *
 * @author Luigi Lu
 * @date 2025-01-14
 */

import { apiRequest } from '../../../services/api';

/**
 * 需求计算接口定义
 */
export interface DemandComputation {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  computation_code?: string;
  demand_id?: number;
  demand_ids?: number[];  // 多需求合并支持
  demand_code?: string;
  demand_type?: 'sales_forecast' | 'sales_order' | 'demand_plan';
  business_mode?: 'MTS' | 'MTO' | 'ATO';
  /** 恒为 MRP；业务模式见 business_mode */
  computation_type?: 'MRP';
  computation_params?: Record<string, any>;
  computation_status?: string;
  computation_start_time?: string;
  computation_end_time?: string;
  computation_summary?: Record<string, any>;
  error_message?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: DemandComputationItem[];
  capabilities?: {
    execute?: { allowed: boolean; reason?: string | null };
    recompute?: { allowed: boolean; reason?: string | null };
    compare?: { allowed: boolean; reason?: string | null };
    export?: { allowed: boolean; reason?: string | null };
  };
}

/**
 * 需求计算明细接口定义
 */
export interface DemandComputationItem {
  id?: number;
  computation_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  required_quantity?: number;
  available_inventory?: number;
  net_requirement?: number;
  gross_requirement?: number;
  safety_stock?: number;
  reorder_point?: number;
  planned_receipt?: number;
  planned_release?: number;
  delivery_date?: string;
  planned_production?: number;
  planned_procurement?: number;
  production_start_date?: string;
  production_completion_date?: string;
  procurement_start_date?: string;
  procurement_completion_date?: string;
  bom_id?: number;
  bom_version?: string;
  suggested_work_order_quantity?: number;
  suggested_purchase_order_quantity?: number;
  detail_results?: Record<string, any>;
  notes?: string;
  // 物料来源信息（核心功能，新增）
  material_source_type?: 'Make' | 'Buy' | 'Phantom' | 'Outsource' | 'Configure';
  material_source_config?: Record<string, any>;
  source_validation_passed?: boolean;
  source_validation_errors?: string[];
  // 计划员赋能增强字段
  readiness_status?: 'Ready' | 'Partial' | 'Shortage';
  readiness_rate?: number;
  is_overdue_risk?: boolean;
}

/**
 * 需求计算列表参数
 */
export interface DemandComputationListParams {
  skip?: number;
  limit?: number;
  demand_id?: number;
  demand_code?: string;
  computation_code?: string;
  /** 兼容后端筛选：MRP≈MTS、LRP≈MTO（列表请优先用 business_mode） */
  computation_type?: 'MRP' | 'LRP';
  computation_status?: string;
  business_mode?: 'MTS' | 'MTO' | 'ATO';
  start_date?: string;
  end_date?: string;
}

/**
 * 需求计算列表响应
 */
export interface DemandComputationListResponse {
  data: DemandComputation[];
  total: number;
  success: boolean;
}

/** 需求计算统计（用于指标卡片） */
export interface DemandComputationStatistics {
  total_count: number;
  mts_count: number;
  mto_count: number;
  /** @deprecated 等同于 mts_count */
  mrp_count: number;
  /** @deprecated 等同于 mto_count */
  lrp_count: number;
  pending_count: number;
  completed_count: number;
  /** 物料就绪或交期风险计数 */
  risk_count?: number;
}

/** 获取需求计算统计 */
export async function getDemandComputationStatistics(): Promise<DemandComputationStatistics> {
  return apiRequest<DemandComputationStatistics>('/apps/kuaizhizao/demand-computations/statistics', {
    method: 'GET',
  });
}

/**
 * 创建需求计算
 */
export async function createDemandComputation(data: Partial<DemandComputation>): Promise<DemandComputation> {
  return apiRequest<DemandComputation>('/apps/kuaizhizao/demand-computations', {
    method: 'POST',
    data,
  });
}

/**
 * 获取需求计算列表
 */
export async function listDemandComputations(params?: DemandComputationListParams): Promise<DemandComputationListResponse> {
  return apiRequest<DemandComputationListResponse>('/apps/kuaizhizao/demand-computations', {
    method: 'GET',
    params,
  });
}

/**
 * 获取需求计算详情
 */
export async function getDemandComputation(id: number, includeItems: boolean = true): Promise<DemandComputation> {
  return apiRequest<DemandComputation>(`/apps/kuaizhizao/demand-computations/${id}`, {
    method: 'GET',
    params: { include_items: includeItems },
  });
}

/**
 * 获取需求计算的动态变动监控
 */
export async function getComputationDynamicMonitor(id: number): Promise<{
  computation_id: number;
  computation_code: string;
  has_upstream_change: boolean;
  has_downstream_risk: boolean;
  upstream_alerts: Array<{
    type: string;
    id: number;
    code: string;
    name: string;
    updated_at: string;
    message: string;
  }>;
  downstream_alerts: Array<{
    type: string;
    id: number;
    code: string;
    name: string;
    planned_end_date?: string;
    delivery_date?: string;
    status: string;
    message: string;
  }>;
  monitor_time: string;
}> {
  return apiRequest(`/apps/kuaizhizao/demand-computations/${id}/dynamic-monitor`, {
    method: 'GET',
  });
}

/**
 * 执行计算预览（不持久化，用于二次确认）
 */
export async function previewExecuteDemandComputation(
  id: number,
  computationParams?: Record<string, any>
): Promise<{
  computation_code: string
  computation_type: string
  item_count: number
  items: Array<{
    material_id?: number
    material_code: string
    material_name: string
    material_unit: string
    /** 需求时间（交期/需求日） */
    delivery_date?: string | null
    /** 计划时间：计划开工/请购优先（含提前期倒推），否则完成/到货日 */
    planned_date?: string | null
    required_quantity: number
    available_inventory: number
    net_requirement: number
    suggested_work_order_quantity: number
    suggested_purchase_order_quantity: number
    material_source_type?: string
    /** 含 inventory_breakdown / supply_calculation，供可用库存 Popover */
    detail_results?: Record<string, unknown>
  }>
}> {
  return apiRequest(`/apps/kuaizhizao/demand-computations/${id}/execute/preview`, {
    method: 'POST',
    data: computationParams ? { computation_params: computationParams } : undefined,
  })
}

/**
 * 执行需求计算
 * @param id 计算ID
 * @param computationParams 可选临时覆盖参数，仅本次执行生效
 */
export async function executeDemandComputation(
  id: number,
  computationParams?: Record<string, any>
): Promise<DemandComputation> {
  return apiRequest<DemandComputation>(`/apps/kuaizhizao/demand-computations/${id}/execute`, {
    method: 'POST',
    data: computationParams ? { computation_params: computationParams } : undefined,
  });
}

/**
 * 重新计算（仅适用于已完成或失败的计算）
 */
export async function recomputeDemandComputation(id: number): Promise<DemandComputation> {
  return apiRequest<DemandComputation>(`/apps/kuaizhizao/demand-computations/${id}/recompute`, {
    method: 'POST',
  });
}

/**
 * 更新需求计算
 */
export async function updateDemandComputation(id: number, data: Partial<DemandComputation>): Promise<DemandComputation> {
  return apiRequest<DemandComputation>(`/apps/kuaizhizao/demand-computations/${id}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除需求计算
 * 仅当需求计算尚未下推工单/采购单等下游单据时允许删除
 */
export async function deleteDemandComputation(id: number): Promise<{ success: boolean; message: string }> {
  return apiRequest(`/apps/kuaizhizao/demand-computations/${id}`, {
    method: 'DELETE',
  });
}

/**
 * 一键生成工单和采购单响应
 */
export interface GenerateOrdersResponse {
  computation_id: number;
  computation_code: string;
  work_orders: Array<{
    id: number;
    code: string;
    product_code: string;
    product_name: string;
    quantity: number;
  }>;
  /** 委外工单（在委外管理页展示，不在工单管理页） */
  outsource_work_orders?: Array<{
    id: number;
    code: string;
    product_code: string;
    product_name: string;
    quantity: number;
  }>;
  purchase_orders: Array<{
    id: number;
    order_code: string;
    material_code: string;
    material_name: string;
    quantity: number;
  }>;
  /** 生产工单数量（工单管理页） */
  work_order_count: number;
  /** 委外工单数量（委外管理页） */
  outsource_work_order_count?: number;
  purchase_order_count: number;
  work_order_groups?: Array<{
    id: number;
    group_code: string;
    root_material_name?: string;
    member_count: number;
  }>;
  work_order_group_count?: number;
}

/**
 * 下推到采购申请（仅采购件）
 */
export async function pushToPurchaseRequisition(id: number): Promise<{ success: boolean; message: string; target_document?: { id: number; code: string } }> {
  return apiRequest(`/apps/kuaizhizao/demand-computations/${id}/push-to-purchase-requisition`, {
    method: 'POST',
  });
}

/**
 * 一键生成工单和采购单
 * @param generateMode 生成粒度：all=全部，work_order_only=仅工单，purchase_only=仅采购，outsource_only=仅委外工单
 * @param options.allowDraft 验证失败时是否仍生成草稿单（由下游用户补全）
 */
export async function generateOrdersFromComputation(
  id: number,
  generateMode: 'all' | 'work_order_only' | 'purchase_only' | 'outsource_only' = 'all',
  options?: { allowDraft?: boolean }
): Promise<GenerateOrdersResponse> {
  return apiRequest<GenerateOrdersResponse>(`/apps/kuaizhizao/demand-computations/${id}/generate-orders`, {
    method: 'POST',
    params: {
      generate_mode: generateMode,
      allow_draft: options?.allowDraft ?? false,
    },
  });
}

/** 下推能力与配置 */
export interface PushOptions {
  computation_id: number
  has_production_items: boolean
  has_outsource_items: boolean
  has_purchase_items: boolean
  make_count: number
  outsource_count: number
  purchase_items_with_supplier: number
  purchase_items_without_supplier: number
  can_direct_work_order: boolean
  default_production: 'work_order'
  default_purchase: 'requisition' | 'purchase_order'
  production_choices: 'work_order'[]
  purchase_choices: ('requisition' | 'purchase_order')[]
}

export async function getPushOptions(id: number): Promise<PushOptions> {
  return apiRequest<PushOptions>(`/apps/kuaizhizao/demand-computations/${id}/push-options`, {
    method: 'GET',
  })
}

/** 下推预览 */
export interface PushPreview {
  computation_id: number
  production_plan_count: number
  work_order_count: number
  outsource_work_order_count: number
  purchase_requisition_count: number
  purchase_order_count: number
  validation_failures: Array<{ material_code: string; material_name: string; errors: string[] }>
  can_direct_work_order: boolean
  make_count: number
  outsource_count: number
  purchase_items_with_supplier: number
  purchase_items_without_supplier: number
}

export async function getPushPreview(
  id: number,
  params?: { production?: 'work_order'; purchase?: 'requisition' | 'purchase_order'; outsource_only?: boolean }
): Promise<PushPreview> {
  return apiRequest<PushPreview>(`/apps/kuaizhizao/demand-computations/${id}/push-preview`, {
    method: 'GET',
    params,
  })
}

/** 一键下推 */
export async function pushAll(
  id: number,
  body: { production?: 'work_order'; purchase?: 'requisition' | 'purchase_order'; include_outsource?: boolean }
): Promise<{ success: boolean; message: string; results: Record<string, any> }> {
  return apiRequest(`/apps/kuaizhizao/demand-computations/${id}/push-all`, {
    method: 'POST',
    data: body,
  })
}

/**
 * 查询需求计算历史记录参数
 */
export interface ComputationHistoryParams {
  skip?: number;
  limit?: number;
  demand_id?: number;
  /** 兼容后端筛选：MRP≈MTS、LRP≈MTO */
  computation_type?: 'MRP' | 'LRP';
  start_date?: string;
  end_date?: string;
}

/**
 * 查询需求计算历史记录
 */
export async function listComputationHistory(params?: ComputationHistoryParams): Promise<DemandComputationListResponse> {
  return apiRequest<DemandComputationListResponse>('/apps/kuaizhizao/demand-computations/history', {
    method: 'GET',
    params,
  });
}

/**
 * 对比结果接口定义
 */
export interface ComputationCompareResult {
  computation1: {
    id: number;
    computation_code: string;
    computation_start_time?: string;
    computation_end_time?: string;
  };
  computation2: {
    id: number;
    computation_code: string;
    computation_start_time?: string;
    computation_end_time?: string;
  };
  basic_diff: {
    computation_type: {
      value1: string;
      value2: string;
      same: boolean;
    };
    business_mode?: {
      value1: string;
      value2: string;
      same: boolean;
    };
    computation_params: {
      value1: Record<string, any>;
      value2: Record<string, any>;
      same: boolean;
    };
    computation_summary: {
      value1: Record<string, any> | null;
      value2: Record<string, any> | null;
      same: boolean;
    };
  };
  items_diff: Array<{
    material_id: number;
    material_code: string;
    material_name: string;
    exists_in_both: boolean;
    only_in?: 'computation1' | 'computation2';
    differences?: Record<string, {
      value1: number | null;
      value2: number | null;
      diff: number | null;
    }>;
  }>;
  total_differences: number;
}

/**
 * 对比两个需求计算结果
 */
export async function compareComputations(id1: number, id2: number): Promise<ComputationCompareResult> {
  return apiRequest<ComputationCompareResult>('/apps/kuaizhizao/demand-computations/compare', {
    method: 'GET',
    params: {
      computation_id1: id1,
      computation_id2: id2,
    },
  });
}

/**
 * 物料来源信息接口定义
 */
export interface MaterialSourceInfo {
  material_id: number;
  material_code: string;
  material_name: string;
  source_type?: 'Make' | 'Buy' | 'Phantom' | 'Outsource' | 'Configure';
  source_config?: Record<string, any>;
  source_validation_passed: boolean;
  source_validation_errors?: string[];
}

/**
 * 物料来源信息响应接口
 */
export interface MaterialSourcesResponse {
  computation_id: number;
  computation_code: string;
  material_sources: MaterialSourceInfo[];
  total_count: number;
}

/**
 * 获取需求计算的物料来源信息
 */
export async function getMaterialSources(computationId: number): Promise<MaterialSourcesResponse> {
  return apiRequest<MaterialSourcesResponse>(`/apps/kuaizhizao/demand-computations/${computationId}/material-sources`, {
    method: 'GET',
  });
}

/**
 * 物料来源验证结果接口定义
 */
export interface MaterialSourceValidationResult {
  material_id: number;
  material_code: string;
  material_name: string;
  source_type?: string;
  validation_passed: boolean;
  errors: string[];
}

/**
 * 物料来源验证响应接口
 */
export interface MaterialSourceValidationResponse {
  computation_id: number;
  computation_code: string;
  all_passed: boolean;
  validation_results: MaterialSourceValidationResult[];
  total_count: number;
  passed_count: number;
  failed_count: number;
}

/**
 * 验证需求计算的物料来源配置
 */
export async function validateMaterialSources(computationId: number): Promise<MaterialSourceValidationResponse> {
  return apiRequest<MaterialSourceValidationResponse>(`/apps/kuaizhizao/demand-computations/${computationId}/validate-material-sources`, {
    method: 'POST',
  });
}

/** 需求计算重算历史项（与后端 list_computation_recalc_history 返回一致） */
export interface ComputationRecalcHistoryItem {
  id: number;
  recalc_at?: string;
  trigger?: string;
  operator_id?: number;
  result?: string;
  snapshot_id?: number;
  message?: string;
}

/** 需求计算快照项（与后端 list_computation_snapshots 返回一致） */
export interface ComputationSnapshotItem {
  id: number;
  snapshot_at?: string;
  trigger?: string;
  computation_summary_snapshot?: Record<string, any>;
  items_snapshot?: any[];
}

/**
 * 获取需求计算重算历史列表
 */
export async function listComputationRecalcHistory(
  computationId: number,
  params?: { limit?: number }
): Promise<ComputationRecalcHistoryItem[]> {
  return apiRequest<ComputationRecalcHistoryItem[]>(
    `/apps/kuaizhizao/demand-computations/${computationId}/recalc-history`,
    { method: 'GET', params }
  );
}

/**
 * 获取需求计算快照列表
 */
export async function listComputationSnapshots(
  computationId: number,
  params?: { limit?: number }
): Promise<ComputationSnapshotItem[]> {
  return apiRequest<ComputationSnapshotItem[]>(
    `/apps/kuaizhizao/demand-computations/${computationId}/snapshots`,
    { method: 'GET', params }
  );
}

/** 按需获取单条需求计算快照（重算历史 entry 关联的 snapshot_id） */
export async function getComputationSnapshot(
  computationId: number,
  snapshotId: number
): Promise<ComputationSnapshotItem> {
  return apiRequest<ComputationSnapshotItem>(
    `/apps/kuaizhizao/demand-computations/${computationId}/snapshots/${snapshotId}`,
    { method: 'GET' }
  );
}

/** 下推记录项 */
export interface PushRecordItem {
  target_type: string;
  target_id: number;
  target_code?: string;
  target_name?: string;
  relation_desc?: string;
  created_at?: string;
  target_exists: boolean;
}

/** 下推记录响应 */
export interface PushRecordsResponse {
  records: PushRecordItem[];
}

/**
 * 获取需求计算下推记录
 * 返回从该需求计算下推出去的单据列表，已删除的单据 target_exists 为 false
 */
export async function getPushRecords(computationId: number): Promise<PushRecordsResponse> {
  return apiRequest<PushRecordsResponse>(
    `/apps/kuaizhizao/demand-computations/${computationId}/push-records`,
    { method: 'GET' }
  );
}

export interface DemandReplanDashboard {
  pending_events: number;
  running_tasks: number;
  failed_tasks: number;
  pending_approval_tasks: number;
  latest_tasks: Array<{
    id: number;
    task_code: string;
    mode: 'net_change' | 'full_regen' | 'what_if';
    status: string;
    approval_status: string;
    created_at?: string;
  }>;
}

export interface DemandChangeEventItem {
  id: number;
  event_code: string;
  event_type: string;
  source_type: string;
  source_id: number;
  source_code?: string;
  event_status: string;
  created_at?: string;
}

export interface DemandReplanTaskItem {
  id: number;
  task_code: string;
  event_id: number;
  mode: 'net_change' | 'full_regen' | 'what_if';
  status: string;
  risk_level: 'low' | 'medium' | 'high';
  approval_status: 'not_required' | 'pending' | 'approved' | 'rejected';
  impact_metrics?: Record<string, any>;
  result_summary?: Record<string, any>;
  error_message?: string | null;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
}

export interface DemandChangeImpactDetail {
  event: {
    id: number;
    event_code: string;
    event_type: string;
    source_type: string;
    source_id: number;
    source_code?: string;
    event_status: string;
    trigger_reason?: string;
    created_at?: string;
  };
  impacts: Array<{
    id: number;
    impact_type: string;
    impact_id: number;
    impact_code?: string;
    impact_scope: string;
    impact_reason: string;
    risk_level: string;
    needs_approval: boolean;
    frozen_horizon_hit: boolean;
    impact_payload?: Record<string, any>;
  }>;
  tasks: DemandReplanTaskItem[];
}

export interface ExecuteReplanTaskRequest {
  force?: boolean;
  approval_comment?: string;
}

export interface ExecuteReplanTaskResponse {
  task_id: number;
  status: string;
  error_message?: string | null;
  result_summary?: Record<string, any>;
}

/** 需求重算看板汇总 */
export async function getDemandReplanDashboard(): Promise<DemandReplanDashboard> {
  return apiRequest<DemandReplanDashboard>('/apps/kuaizhizao/demand-computations/replan-dashboard', {
    method: 'GET',
  });
}

/** 待处理变更事件 */
export async function listPendingDemandChangeEvents(limit: number = 200): Promise<DemandChangeEventItem[]> {
  return apiRequest<DemandChangeEventItem[]>('/apps/kuaizhizao/demand-computations/change-events/pending', {
    method: 'GET',
    params: { limit },
  });
}

/** 变更事件影响详情 */
export async function getDemandChangeImpact(eventId: number): Promise<DemandChangeImpactDetail> {
  return apiRequest<DemandChangeImpactDetail>(`/apps/kuaizhizao/demand-computations/change-events/${eventId}/impact`, {
    method: 'GET',
  });
}

export interface EnsureReplanTaskResponse {
  created: boolean;
  event_id: number;
  task_id: number;
  task_code: string;
  mode?: string;
  approval_status?: string;
  status?: string;
  impact_metrics?: Record<string, unknown>;
}

/** 为变更事件补全分析并生成重算任务 */
export async function ensureReplanTaskForEvent(eventId: number): Promise<EnsureReplanTaskResponse> {
  return apiRequest<EnsureReplanTaskResponse>(
    `/apps/kuaizhizao/demand-computations/change-events/${eventId}/replan-task`,
    { method: 'POST' },
  );
}

/** 重算任务列表 */
export async function listDemandReplanTasks(limit: number = 200): Promise<DemandReplanTaskItem[]> {
  return apiRequest<DemandReplanTaskItem[]>('/apps/kuaizhizao/demand-computations/replan-tasks', {
    method: 'GET',
    params: { limit },
  });
}

/** 执行重算任务 */
export async function executeDemandReplanTask(
  taskId: number,
  data?: ExecuteReplanTaskRequest,
): Promise<ExecuteReplanTaskResponse> {
  return apiRequest<ExecuteReplanTaskResponse>(`/apps/kuaizhizao/demand-computations/replan-tasks/${taskId}/execute`, {
    method: 'POST',
    data: data || {},
  });
}
