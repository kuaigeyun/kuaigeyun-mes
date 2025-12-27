/**
 * QMS 数据 API 服务
 * 
 * 提供质量检验、不合格品管理、质量追溯、ISO标准体系等的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  InspectionTask,
  InspectionTaskCreate,
  InspectionTaskUpdate,
  InspectionRecord,
  InspectionRecordCreate,
  InspectionRecordUpdate,
  NonconformingProduct,
  NonconformingProductCreate,
  NonconformingProductUpdate,
  NonconformingHandling,
  NonconformingHandlingCreate,
  NonconformingHandlingUpdate,
  QualityTraceability,
  QualityTraceabilityCreate,
  ISOAudit,
  ISOAuditCreate,
  ISOAuditUpdate,
  CAPA,
  CAPACreate,
  CAPAUpdate,
  ContinuousImprovement,
  ContinuousImprovementCreate,
  ContinuousImprovementUpdate,
  QualityObjective,
  QualityObjectiveCreate,
  QualityObjectiveUpdate,
  QualityIndicator,
  QualityIndicatorCreate,
  QualityIndicatorUpdate,
} from '../types/process';

/**
 * 质量检验任务 API 服务
 */
export const inspectionTaskApi = {
  create: async (data: InspectionTaskCreate): Promise<InspectionTask> => {
    return api.post('/apps/kuaiqms/inspection-tasks', data);
  },
  list: async (params?: { skip?: number; limit?: number; inspection_type?: string; status?: string }): Promise<InspectionTask[]> => {
    return api.get('/apps/kuaiqms/inspection-tasks', { params });
  },
  get: async (uuid: string): Promise<InspectionTask> => {
    return api.get(`/apps/kuaiqms/inspection-tasks/${uuid}`);
  },
  update: async (uuid: string, data: InspectionTaskUpdate): Promise<InspectionTask> => {
    return api.put(`/apps/kuaiqms/inspection-tasks/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiqms/inspection-tasks/${uuid}`);
  },
};

/**
 * 质量检验记录 API 服务
 */
export const inspectionRecordApi = {
  create: async (data: InspectionRecordCreate): Promise<InspectionRecord> => {
    return api.post('/apps/kuaiqms/inspection-records', data);
  },
  list: async (params?: { skip?: number; limit?: number; inspection_type?: string; inspection_result?: string; task_uuid?: string }): Promise<InspectionRecord[]> => {
    return api.get('/apps/kuaiqms/inspection-records', { params });
  },
  get: async (uuid: string): Promise<InspectionRecord> => {
    return api.get(`/apps/kuaiqms/inspection-records/${uuid}`);
  },
  update: async (uuid: string, data: InspectionRecordUpdate): Promise<InspectionRecord> => {
    return api.put(`/apps/kuaiqms/inspection-records/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiqms/inspection-records/${uuid}`);
  },
};

/**
 * 不合格品记录 API 服务
 */
export const nonconformingProductApi = {
  create: async (data: NonconformingProductCreate): Promise<NonconformingProduct> => {
    return api.post('/apps/kuaiqms/nonconforming-products', data);
  },
  list: async (params?: { skip?: number; limit?: number; status?: string; defect_type?: number }): Promise<NonconformingProduct[]> => {
    return api.get('/apps/kuaiqms/nonconforming-products', { params });
  },
  get: async (uuid: string): Promise<NonconformingProduct> => {
    return api.get(`/apps/kuaiqms/nonconforming-products/${uuid}`);
  },
  update: async (uuid: string, data: NonconformingProductUpdate): Promise<NonconformingProduct> => {
    return api.put(`/apps/kuaiqms/nonconforming-products/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiqms/nonconforming-products/${uuid}`);
  },
};

/**
 * 不合格品处理 API 服务
 */
export const nonconformingHandlingApi = {
  create: async (data: NonconformingHandlingCreate): Promise<NonconformingHandling> => {
    return api.post('/apps/kuaiqms/nonconforming-handlings', data);
  },
  list: async (params?: { skip?: number; limit?: number; status?: string; handling_type?: string; nonconforming_product_uuid?: string }): Promise<NonconformingHandling[]> => {
    return api.get('/apps/kuaiqms/nonconforming-handlings', { params });
  },
  get: async (uuid: string): Promise<NonconformingHandling> => {
    return api.get(`/apps/kuaiqms/nonconforming-handlings/${uuid}`);
  },
  update: async (uuid: string, data: NonconformingHandlingUpdate): Promise<NonconformingHandling> => {
    return api.put(`/apps/kuaiqms/nonconforming-handlings/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiqms/nonconforming-handlings/${uuid}`);
  },
};

/**
 * 质量追溯 API 服务
 */
export const qualityTraceabilityApi = {
  create: async (data: QualityTraceabilityCreate): Promise<QualityTraceability> => {
    return api.post('/apps/kuaiqms/quality-traceabilities', data);
  },
  list: async (params?: { skip?: number; limit?: number; trace_type?: string; batch_no?: string; serial_no?: string }): Promise<QualityTraceability[]> => {
    return api.get('/apps/kuaiqms/quality-traceabilities', { params });
  },
  get: async (uuid: string): Promise<QualityTraceability> => {
    return api.get(`/apps/kuaiqms/quality-traceabilities/${uuid}`);
  },
};

/**
 * ISO质量审核 API 服务
 */
export const isoAuditApi = {
  create: async (data: ISOAuditCreate): Promise<ISOAudit> => {
    return api.post('/apps/kuaiqms/iso-audits', data);
  },
  list: async (params?: { skip?: number; limit?: number; audit_type?: string; iso_standard?: string; status?: string }): Promise<ISOAudit[]> => {
    return api.get('/apps/kuaiqms/iso-audits', { params });
  },
  get: async (uuid: string): Promise<ISOAudit> => {
    return api.get(`/apps/kuaiqms/iso-audits/${uuid}`);
  },
  update: async (uuid: string, data: ISOAuditUpdate): Promise<ISOAudit> => {
    return api.put(`/apps/kuaiqms/iso-audits/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiqms/iso-audits/${uuid}`);
  },
};

/**
 * CAPA API 服务
 */
export const capaApi = {
  create: async (data: CAPACreate): Promise<CAPA> => {
    return api.post('/apps/kuaiqms/capas', data);
  },
  list: async (params?: { skip?: number; limit?: number; capa_type?: string; status?: string }): Promise<CAPA[]> => {
    return api.get('/apps/kuaiqms/capas', { params });
  },
  get: async (uuid: string): Promise<CAPA> => {
    return api.get(`/apps/kuaiqms/capas/${uuid}`);
  },
  update: async (uuid: string, data: CAPAUpdate): Promise<CAPA> => {
    return api.put(`/apps/kuaiqms/capas/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiqms/capas/${uuid}`);
  },
};

/**
 * 持续改进 API 服务
 */
export const continuousImprovementApi = {
  create: async (data: ContinuousImprovementCreate): Promise<ContinuousImprovement> => {
    return api.post('/apps/kuaiqms/continuous-improvements', data);
  },
  list: async (params?: { skip?: number; limit?: number; improvement_type?: string; status?: string }): Promise<ContinuousImprovement[]> => {
    return api.get('/apps/kuaiqms/continuous-improvements', { params });
  },
  get: async (uuid: string): Promise<ContinuousImprovement> => {
    return api.get(`/apps/kuaiqms/continuous-improvements/${uuid}`);
  },
  update: async (uuid: string, data: ContinuousImprovementUpdate): Promise<ContinuousImprovement> => {
    return api.put(`/apps/kuaiqms/continuous-improvements/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiqms/continuous-improvements/${uuid}`);
  },
};

/**
 * 质量目标 API 服务
 */
export const qualityObjectiveApi = {
  create: async (data: QualityObjectiveCreate): Promise<QualityObjective> => {
    return api.post('/apps/kuaiqms/quality-objectives', data);
  },
  list: async (params?: { skip?: number; limit?: number; period?: string; status?: string }): Promise<QualityObjective[]> => {
    return api.get('/apps/kuaiqms/quality-objectives', { params });
  },
  get: async (uuid: string): Promise<QualityObjective> => {
    return api.get(`/apps/kuaiqms/quality-objectives/${uuid}`);
  },
  update: async (uuid: string, data: QualityObjectiveUpdate): Promise<QualityObjective> => {
    return api.put(`/apps/kuaiqms/quality-objectives/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiqms/quality-objectives/${uuid}`);
  },
};

/**
 * 质量指标 API 服务
 */
export const qualityIndicatorApi = {
  create: async (data: QualityIndicatorCreate): Promise<QualityIndicator> => {
    return api.post('/apps/kuaiqms/quality-indicators', data);
  },
  list: async (params?: { skip?: number; limit?: number; indicator_type?: string; status?: string }): Promise<QualityIndicator[]> => {
    return api.get('/apps/kuaiqms/quality-indicators', { params });
  },
  get: async (uuid: string): Promise<QualityIndicator> => {
    return api.get(`/apps/kuaiqms/quality-indicators/${uuid}`);
  },
  update: async (uuid: string, data: QualityIndicatorUpdate): Promise<QualityIndicator> => {
    return api.put(`/apps/kuaiqms/quality-indicators/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaiqms/quality-indicators/${uuid}`);
  },
};
