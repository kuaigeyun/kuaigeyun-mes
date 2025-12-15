/**
 * EAM 数据 API 服务
 * 
 * 提供维护计划、维护工单、故障报修等的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  MaintenancePlan,
  MaintenancePlanCreate,
  MaintenancePlanUpdate,
  MaintenancePlanListParams,
  MaintenanceWorkOrder,
  MaintenanceWorkOrderCreate,
  MaintenanceWorkOrderUpdate,
  MaintenanceWorkOrderListParams,
  MaintenanceExecution,
  MaintenanceExecutionCreate,
  MaintenanceExecutionUpdate,
  MaintenanceExecutionListParams,
  FailureReport,
  FailureReportCreate,
  FailureReportUpdate,
  FailureReportListParams,
  FailureHandling,
  FailureHandlingCreate,
  FailureHandlingUpdate,
  FailureHandlingListParams,
  SparePartDemand,
  SparePartDemandCreate,
  SparePartDemandUpdate,
  SparePartDemandListParams,
  SparePartPurchase,
  SparePartPurchaseCreate,
  SparePartPurchaseUpdate,
  SparePartPurchaseListParams,
  ToolingUsage,
  ToolingUsageCreate,
  ToolingUsageUpdate,
  ToolingUsageListParams,
  MoldUsage,
  MoldUsageCreate,
  MoldUsageUpdate,
  MoldUsageListParams,
} from '../types/process';

/**
 * 维护计划 API 服务
 */
export const maintenancePlanApi = {
  /**
   * 创建维护计划
   */
  create: async (data: MaintenancePlanCreate): Promise<MaintenancePlan> => {
    return api.post('/apps/kuaieam/maintenance-plans', data);
  },

  /**
   * 获取维护计划列表
   */
  list: async (params?: MaintenancePlanListParams): Promise<MaintenancePlan[]> => {
    return api.get('/apps/kuaieam/maintenance-plans', { params });
  },

  /**
   * 获取维护计划详情
   */
  get: async (uuid: string): Promise<MaintenancePlan> => {
    return api.get(`/apps/kuaieam/maintenance-plans/${uuid}`);
  },

  /**
   * 更新维护计划
   */
  update: async (uuid: string, data: MaintenancePlanUpdate): Promise<MaintenancePlan> => {
    return api.put(`/apps/kuaieam/maintenance-plans/${uuid}`, data);
  },

  /**
   * 删除维护计划
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaieam/maintenance-plans/${uuid}`);
  },
};

/**
 * 维护工单 API 服务
 */
export const maintenanceWorkOrderApi = {
  /**
   * 创建维护工单
   */
  create: async (data: MaintenanceWorkOrderCreate): Promise<MaintenanceWorkOrder> => {
    return api.post('/apps/kuaieam/maintenance-workorders', data);
  },

  /**
   * 获取维护工单列表
   */
  list: async (params?: MaintenanceWorkOrderListParams): Promise<MaintenanceWorkOrder[]> => {
    return api.get('/apps/kuaieam/maintenance-workorders', { params });
  },

  /**
   * 获取维护工单详情
   */
  get: async (uuid: string): Promise<MaintenanceWorkOrder> => {
    return api.get(`/apps/kuaieam/maintenance-workorders/${uuid}`);
  },

  /**
   * 更新维护工单
   */
  update: async (uuid: string, data: MaintenanceWorkOrderUpdate): Promise<MaintenanceWorkOrder> => {
    return api.put(`/apps/kuaieam/maintenance-workorders/${uuid}`, data);
  },

  /**
   * 删除维护工单
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaieam/maintenance-workorders/${uuid}`);
  },
};

/**
 * 维护执行 API 服务
 */
export const maintenanceExecutionApi = {
  /**
   * 创建维护执行记录
   */
  create: async (data: MaintenanceExecutionCreate): Promise<MaintenanceExecution> => {
    return api.post('/apps/kuaieam/maintenance-executions', data);
  },

  /**
   * 获取维护执行记录列表
   */
  list: async (params?: MaintenanceExecutionListParams): Promise<MaintenanceExecution[]> => {
    return api.get('/apps/kuaieam/maintenance-executions', { params });
  },

  /**
   * 获取维护执行记录详情
   */
  get: async (uuid: string): Promise<MaintenanceExecution> => {
    return api.get(`/apps/kuaieam/maintenance-executions/${uuid}`);
  },

  /**
   * 更新维护执行记录
   */
  update: async (uuid: string, data: MaintenanceExecutionUpdate): Promise<MaintenanceExecution> => {
    return api.put(`/apps/kuaieam/maintenance-executions/${uuid}`, data);
  },

  /**
   * 删除维护执行记录
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaieam/maintenance-executions/${uuid}`);
  },
};

/**
 * 故障报修 API 服务
 */
export const failureReportApi = {
  /**
   * 创建故障报修
   */
  create: async (data: FailureReportCreate): Promise<FailureReport> => {
    return api.post('/apps/kuaieam/failure-reports', data);
  },

  /**
   * 获取故障报修列表
   */
  list: async (params?: FailureReportListParams): Promise<FailureReport[]> => {
    return api.get('/apps/kuaieam/failure-reports', { params });
  },

  /**
   * 获取故障报修详情
   */
  get: async (uuid: string): Promise<FailureReport> => {
    return api.get(`/apps/kuaieam/failure-reports/${uuid}`);
  },

  /**
   * 更新故障报修
   */
  update: async (uuid: string, data: FailureReportUpdate): Promise<FailureReport> => {
    return api.put(`/apps/kuaieam/failure-reports/${uuid}`, data);
  },

  /**
   * 删除故障报修
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaieam/failure-reports/${uuid}`);
  },
};

/**
 * 故障处理 API 服务
 */
export const failureHandlingApi = {
  /**
   * 创建故障处理
   */
  create: async (data: FailureHandlingCreate): Promise<FailureHandling> => {
    return api.post('/apps/kuaieam/failure-handlings', data);
  },

  /**
   * 获取故障处理列表
   */
  list: async (params?: FailureHandlingListParams): Promise<FailureHandling[]> => {
    return api.get('/apps/kuaieam/failure-handlings', { params });
  },

  /**
   * 获取故障处理详情
   */
  get: async (uuid: string): Promise<FailureHandling> => {
    return api.get(`/apps/kuaieam/failure-handlings/${uuid}`);
  },

  /**
   * 更新故障处理
   */
  update: async (uuid: string, data: FailureHandlingUpdate): Promise<FailureHandling> => {
    return api.put(`/apps/kuaieam/failure-handlings/${uuid}`, data);
  },

  /**
   * 删除故障处理
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaieam/failure-handlings/${uuid}`);
  },
};

/**
 * 备件需求 API 服务
 */
export const sparePartDemandApi = {
  /**
   * 创建备件需求
   */
  create: async (data: SparePartDemandCreate): Promise<SparePartDemand> => {
    return api.post('/apps/kuaieam/spare-part-demands', data);
  },

  /**
   * 获取备件需求列表
   */
  list: async (params?: SparePartDemandListParams): Promise<SparePartDemand[]> => {
    return api.get('/apps/kuaieam/spare-part-demands', { params });
  },

  /**
   * 获取备件需求详情
   */
  get: async (uuid: string): Promise<SparePartDemand> => {
    return api.get(`/apps/kuaieam/spare-part-demands/${uuid}`);
  },

  /**
   * 更新备件需求
   */
  update: async (uuid: string, data: SparePartDemandUpdate): Promise<SparePartDemand> => {
    return api.put(`/apps/kuaieam/spare-part-demands/${uuid}`, data);
  },

  /**
   * 删除备件需求
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaieam/spare-part-demands/${uuid}`);
  },
};

/**
 * 备件采购 API 服务
 */
export const sparePartPurchaseApi = {
  /**
   * 创建备件采购
   */
  create: async (data: SparePartPurchaseCreate): Promise<SparePartPurchase> => {
    return api.post('/apps/kuaieam/spare-part-purchases', data);
  },

  /**
   * 获取备件采购列表
   */
  list: async (params?: SparePartPurchaseListParams): Promise<SparePartPurchase[]> => {
    return api.get('/apps/kuaieam/spare-part-purchases', { params });
  },

  /**
   * 获取备件采购详情
   */
  get: async (uuid: string): Promise<SparePartPurchase> => {
    return api.get(`/apps/kuaieam/spare-part-purchases/${uuid}`);
  },

  /**
   * 更新备件采购
   */
  update: async (uuid: string, data: SparePartPurchaseUpdate): Promise<SparePartPurchase> => {
    return api.put(`/apps/kuaieam/spare-part-purchases/${uuid}`, data);
  },

  /**
   * 删除备件采购
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaieam/spare-part-purchases/${uuid}`);
  },
};

/**
 * 工装夹具使用 API 服务
 */
export const toolingUsageApi = {
  /**
   * 创建工装夹具使用记录
   */
  create: async (data: ToolingUsageCreate): Promise<ToolingUsage> => {
    return api.post('/apps/kuaieam/tooling-usages', data);
  },

  /**
   * 获取工装夹具使用记录列表
   */
  list: async (params?: ToolingUsageListParams): Promise<ToolingUsage[]> => {
    return api.get('/apps/kuaieam/tooling-usages', { params });
  },

  /**
   * 获取工装夹具使用记录详情
   */
  get: async (uuid: string): Promise<ToolingUsage> => {
    return api.get(`/apps/kuaieam/tooling-usages/${uuid}`);
  },

  /**
   * 更新工装夹具使用记录
   */
  update: async (uuid: string, data: ToolingUsageUpdate): Promise<ToolingUsage> => {
    return api.put(`/apps/kuaieam/tooling-usages/${uuid}`, data);
  },

  /**
   * 删除工装夹具使用记录
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaieam/tooling-usages/${uuid}`);
  },
};

/**
 * 模具使用 API 服务
 */
export const moldUsageApi = {
  /**
   * 创建模具使用记录
   */
  create: async (data: MoldUsageCreate): Promise<MoldUsage> => {
    return api.post('/apps/kuaieam/mold-usages', data);
  },

  /**
   * 获取模具使用记录列表
   */
  list: async (params?: MoldUsageListParams): Promise<MoldUsage[]> => {
    return api.get('/apps/kuaieam/mold-usages', { params });
  },

  /**
   * 获取模具使用记录详情
   */
  get: async (uuid: string): Promise<MoldUsage> => {
    return api.get(`/apps/kuaieam/mold-usages/${uuid}`);
  },

  /**
   * 更新模具使用记录
   */
  update: async (uuid: string, data: MoldUsageUpdate): Promise<MoldUsage> => {
    return api.put(`/apps/kuaieam/mold-usages/${uuid}`, data);
  },

  /**
   * 删除模具使用记录
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaieam/mold-usages/${uuid}`);
  },
};

