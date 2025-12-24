/**
 * 工艺数据 API 服务
 * 
 * 提供不良品、工序、工艺路线、作业程序（SOP）的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  DefectType,
  DefectTypeCreate,
  DefectTypeUpdate,
  DefectTypeListParams,
  Operation,
  OperationCreate,
  OperationUpdate,
  OperationListParams,
  ProcessRoute,
  ProcessRouteCreate,
  ProcessRouteUpdate,
  ProcessRouteListParams,
  SOP,
  SOPCreate,
  SOPUpdate,
  SOPListParams,
  SOPExecution,
  SOPExecutionCreate,
  SOPExecutionUpdate,
  SOPExecutionListParams,
  SOPNodeCompleteRequest,
} from '../types/process';

/**
 * 不良品 API 服务
 */
export const defectTypeApi = {
  /**
   * 创建不良品
   */
  create: async (data: DefectTypeCreate): Promise<DefectType> => {
    return api.post('/apps/master-data/process/defect-types', data);
  },

  /**
   * 获取不良品列表
   */
  list: async (params?: DefectTypeListParams): Promise<DefectType[]> => {
    return api.get('/apps/master-data/process/defect-types', { params });
  },

  /**
   * 获取不良品详情
   */
  get: async (uuid: string): Promise<DefectType> => {
    return api.get(`/apps/master-data/process/defect-types/${uuid}`);
  },

  /**
   * 更新不良品
   */
  update: async (uuid: string, data: DefectTypeUpdate): Promise<DefectType> => {
    return api.put(`/apps/master-data/process/defect-types/${uuid}`, data);
  },

  /**
   * 删除不良品
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/process/defect-types/${uuid}`);
  },
};

/**
 * 工序 API 服务
 */
export const operationApi = {
  /**
   * 创建工序
   */
  create: async (data: OperationCreate): Promise<Operation> => {
    return api.post('/apps/master-data/process/operations', data);
  },

  /**
   * 获取工序列表
   */
  list: async (params?: OperationListParams): Promise<Operation[]> => {
    return api.get('/apps/master-data/process/operations', { params });
  },

  /**
   * 获取工序详情
   */
  get: async (uuid: string): Promise<Operation> => {
    return api.get(`/apps/master-data/process/operations/${uuid}`);
  },

  /**
   * 更新工序
   */
  update: async (uuid: string, data: OperationUpdate): Promise<Operation> => {
    return api.put(`/apps/master-data/process/operations/${uuid}`, data);
  },

  /**
   * 删除工序
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/process/operations/${uuid}`);
  },
};

/**
 * 工艺路线 API 服务
 */
export const processRouteApi = {
  /**
   * 创建工艺路线
   */
  create: async (data: ProcessRouteCreate): Promise<ProcessRoute> => {
    return api.post('/apps/master-data/process/routes', data);
  },

  /**
   * 获取工艺路线列表
   */
  list: async (params?: ProcessRouteListParams): Promise<ProcessRoute[]> => {
    return api.get('/apps/master-data/process/routes', { params });
  },

  /**
   * 获取工艺路线详情
   */
  get: async (uuid: string): Promise<ProcessRoute> => {
    return api.get(`/apps/master-data/process/routes/${uuid}`);
  },

  /**
   * 更新工艺路线
   */
  update: async (uuid: string, data: ProcessRouteUpdate): Promise<ProcessRoute> => {
    return api.put(`/apps/master-data/process/routes/${uuid}`, data);
  },

  /**
   * 删除工艺路线
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/process/routes/${uuid}`);
  },
};

/**
 * 作业程序（SOP） API 服务
 */
export const sopApi = {
  /**
   * 创建SOP
   */
  create: async (data: SOPCreate): Promise<SOP> => {
    return api.post('/apps/master-data/process/sop', data);
  },

  /**
   * 获取SOP列表
   */
  list: async (params?: SOPListParams): Promise<SOP[]> => {
    return api.get('/apps/master-data/process/sop', { params });
  },

  /**
   * 获取SOP详情
   */
  get: async (uuid: string): Promise<SOP> => {
    return api.get(`/apps/master-data/process/sop/${uuid}`);
  },

  /**
   * 更新SOP
   */
  update: async (uuid: string, data: SOPUpdate): Promise<SOP> => {
    return api.put(`/apps/master-data/process/sop/${uuid}`, data);
  },

  /**
   * 删除SOP
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/process/sop/${uuid}`);
  },
};

/**
 * SOP 执行实例 API 服务
 */
export const sopExecutionApi = {
  /**
   * 创建执行实例
   */
  create: async (data: SOPExecutionCreate): Promise<SOPExecution> => {
    return api.post('/apps/master-data/process/sop-executions', data);
  },

  /**
   * 获取执行实例列表
   */
  list: async (params?: SOPExecutionListParams): Promise<SOPExecution[]> => {
    return api.get('/apps/master-data/process/sop-executions', { params });
  },

  /**
   * 获取执行实例详情
   */
  get: async (uuid: string): Promise<SOPExecution> => {
    return api.get(`/apps/master-data/process/sop-executions/${uuid}`);
  },

  /**
   * 更新执行实例
   */
  update: async (uuid: string, data: SOPExecutionUpdate): Promise<SOPExecution> => {
    return api.put(`/apps/master-data/process/sop-executions/${uuid}`, data);
  },

  /**
   * 删除执行实例
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/process/sop-executions/${uuid}`);
  },

  /**
   * 启动执行（发送 Inngest 事件）
   */
  start: async (uuid: string): Promise<void> => {
    return api.post(`/apps/master-data/process/sop-executions/${uuid}/start`);
  },

  /**
   * 完成节点（发送 Inngest 事件）
   */
  completeNode: async (uuid: string, data: SOPNodeCompleteRequest): Promise<void> => {
    return api.post(`/apps/master-data/process/sop-executions/${uuid}/complete-node`, data);
  },
};

