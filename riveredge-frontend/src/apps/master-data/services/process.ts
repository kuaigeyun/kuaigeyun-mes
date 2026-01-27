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

  /**
   * 生成工序二维码
   */
  generateQRCode: async (operationUuid: string, operationCode: string, operationName: string): Promise<any> => {
    const { qrcodeApi } = await import('../../../services/qrcode');
    return qrcodeApi.generateOperation({
      operation_uuid: operationUuid,
      operation_code: operationCode,
      operation_name: operationName,
    });
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

  /**
   * 创建工艺路线新版本
   */
  createVersion: async (code: string, data: ProcessRouteVersionCreate): Promise<ProcessRoute> => {
    return api.post(`/apps/master-data/process/routes/${code}/version`, data);
  },

  /**
   * 获取工艺路线所有版本
   */
  getVersions: async (code: string): Promise<ProcessRoute[]> => {
    return api.get(`/apps/master-data/process/routes/${code}/versions`);
  },

  /**
   * 对比工艺路线版本
   */
  compareVersions: async (code: string, data: ProcessRouteVersionCompare): Promise<ProcessRouteVersionCompareResult> => {
    return api.post(`/apps/master-data/process/routes/${code}/compare-versions`, data);
  },

  /**
   * 回退工艺路线到指定版本
   */
  rollbackVersion: async (code: string, targetVersion: string, newVersion?: string): Promise<ProcessRoute> => {
    const params = new URLSearchParams();
    params.set('target_version', targetVersion);
    if (newVersion) {
      params.set('new_version', newVersion);
    }
    return api.post(`/apps/master-data/process/routes/${code}/rollback-version?${params.toString()}`);
  },

  /**
   * 绑定工艺路线到物料分组
   */
  bindMaterialGroup: async (uuid: string, materialGroupUuid: string): Promise<void> => {
    return api.post(`/apps/master-data/process/routes/${uuid}/bind-material-group`, null, {
      params: { material_group_uuid: materialGroupUuid },
    });
  },

  /**
   * 解绑物料分组的工艺路线
   */
  unbindMaterialGroup: async (uuid: string, materialGroupUuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/process/routes/${uuid}/unbind-material-group`, {
      params: { material_group_uuid: materialGroupUuid },
    });
  },

  /**
   * 绑定工艺路线到物料
   */
  bindMaterial: async (uuid: string, materialUuid: string): Promise<void> => {
    return api.post(`/apps/master-data/process/routes/${uuid}/bind-material`, null, {
      params: { material_uuid: materialUuid },
    });
  },

  /**
   * 解绑物料的工艺路线
   */
  unbindMaterial: async (uuid: string, materialUuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/process/routes/${uuid}/unbind-material`, {
      params: { material_uuid: materialUuid },
    });
  },

  /**
   * 获取工艺路线绑定的物料和物料分组
   */
  getBoundMaterials: async (uuid: string): Promise<{
    materials: Array<{ uuid: string; code: string; name: string }>;
    material_groups: Array<{ uuid: string; code: string; name: string }>;
  }> => {
    return api.get(`/apps/master-data/process/routes/${uuid}/bound-materials`);
  },

  /**
   * 获取物料匹配的工艺路线（按优先级）
   */
  getProcessRouteForMaterial: async (materialUuid: string): Promise<ProcessRoute | null> => {
    return api.get(`/apps/master-data/process/materials/${materialUuid}/process-route`);
  },

  /**
   * 创建子工艺路线
   */
  createSubRoute: async (parentRouteUuid: string, parentOperationUuid: string, data: ProcessRouteCreate): Promise<ProcessRoute> => {
    return api.post(`/apps/master-data/process/routes/${parentRouteUuid}/sub-routes`, data, {
      params: { parent_operation_uuid: parentOperationUuid },
    });
  },

  /**
   * 获取子工艺路线列表
   */
  getSubRoutes: async (parentRouteUuid: string, parentOperationUuid?: string): Promise<ProcessRoute[]> => {
    const params: any = {};
    if (parentOperationUuid) {
      params.parent_operation_uuid = parentOperationUuid;
    }
    return api.get(`/apps/master-data/process/routes/${parentRouteUuid}/sub-routes`, { params });
  },

  /**
   * 删除子工艺路线
   */
  deleteSubRoute: async (subRouteUuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/process/routes/sub-routes/${subRouteUuid}`);
  },

  /**
   * 创建工艺路线模板
   */
  createTemplate: async (data: any): Promise<any> => {
    return api.post('/apps/master-data/process/route-templates', data);
  },

  /**
   * 获取工艺路线模板列表
   */
  listTemplates: async (params?: any): Promise<any[]> => {
    return api.get('/apps/master-data/process/route-templates', { params });
  },

  /**
   * 获取工艺路线模板详情
   */
  getTemplate: async (templateUuid: string): Promise<any> => {
    return api.get(`/apps/master-data/process/route-templates/${templateUuid}`);
  },

  /**
   * 基于模板创建工艺路线
   */
  createFromTemplate: async (data: any): Promise<ProcessRoute> => {
    return api.post('/apps/master-data/process/routes/from-template', data);
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
   * 按物料匹配 SOP（供工单/报工「以 SOP 为依据」使用，具体物料优先于物料组）
   */
  getForMaterial: async (
    materialUuid: string,
    operationUuid?: string
  ): Promise<SOP | null> => {
    return api.get('/apps/master-data/process/sop/for-material', {
      params: { material_uuid: materialUuid, operation_uuid: operationUuid },
    });
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

