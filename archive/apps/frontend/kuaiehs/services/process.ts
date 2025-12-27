/**
 * EHS数据 API 服务
 * 
 * 提供环境健康安全管理的 API 调用方法
 */

import { api } from '../../../services/api';
import type {
  EnvironmentMonitoring,
  EnvironmentMonitoringCreate,
  EnvironmentMonitoringUpdate,
  EnvironmentMonitoringListParams,
  EmissionManagement,
  EmissionManagementCreate,
  EmissionManagementUpdate,
  EmissionManagementListParams,
  EnvironmentalCompliance,
  EnvironmentalComplianceCreate,
  EnvironmentalComplianceUpdate,
  EnvironmentalComplianceListParams,
  EnvironmentalIncident,
  EnvironmentalIncidentCreate,
  EnvironmentalIncidentUpdate,
  EnvironmentalIncidentListParams,
  OccupationalHealthCheck,
  OccupationalHealthCheckCreate,
  OccupationalHealthCheckUpdate,
  OccupationalHealthCheckListParams,
  OccupationalDisease,
  OccupationalDiseaseCreate,
  OccupationalDiseaseUpdate,
  OccupationalDiseaseListParams,
  HealthRecord,
  HealthRecordCreate,
  HealthRecordUpdate,
  HealthRecordListParams,
  SafetyTraining,
  SafetyTrainingCreate,
  SafetyTrainingUpdate,
  SafetyTrainingListParams,
  SafetyInspection,
  SafetyInspectionCreate,
  SafetyInspectionUpdate,
  SafetyInspectionListParams,
  SafetyHazard,
  SafetyHazardCreate,
  SafetyHazardUpdate,
  SafetyHazardListParams,
  SafetyIncident,
  SafetyIncidentCreate,
  SafetyIncidentUpdate,
  SafetyIncidentListParams,
  Regulation,
  RegulationCreate,
  RegulationUpdate,
  RegulationListParams,
  ComplianceCheck,
  ComplianceCheckCreate,
  ComplianceCheckUpdate,
  ComplianceCheckListParams,
  ComplianceReport,
  ComplianceReportCreate,
  ComplianceReportUpdate,
  ComplianceReportListParams,
} from '../types/process';

/**
 * 环境监测 API 服务
 */
export const environmentMonitoringApi = {
  create: async (data: EnvironmentMonitoringCreate): Promise<EnvironmentMonitoring> => {
    return api.post('/kuaiehs/environment-monitorings', data);
  },
  list: async (params?: EnvironmentMonitoringListParams): Promise<EnvironmentMonitoring[]> => {
    return api.get('/kuaiehs/environment-monitorings', { params });
  },
  get: async (uuid: string): Promise<EnvironmentMonitoring> => {
    return api.get(`/kuaiehs/environment-monitorings/${uuid}`);
  },
  update: async (uuid: string, data: EnvironmentMonitoringUpdate): Promise<EnvironmentMonitoring> => {
    return api.put(`/kuaiehs/environment-monitorings/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/environment-monitorings/${uuid}`);
  },
};

/**
 * 排放管理 API 服务
 */
export const emissionManagementApi = {
  create: async (data: EmissionManagementCreate): Promise<EmissionManagement> => {
    return api.post('/kuaiehs/emission-managements', data);
  },
  list: async (params?: EmissionManagementListParams): Promise<EmissionManagement[]> => {
    return api.get('/kuaiehs/emission-managements', { params });
  },
  get: async (uuid: string): Promise<EmissionManagement> => {
    return api.get(`/kuaiehs/emission-managements/${uuid}`);
  },
  update: async (uuid: string, data: EmissionManagementUpdate): Promise<EmissionManagement> => {
    return api.put(`/kuaiehs/emission-managements/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/emission-managements/${uuid}`);
  },
};

/**
 * 环保合规 API 服务
 */
export const environmentalComplianceApi = {
  create: async (data: EnvironmentalComplianceCreate): Promise<EnvironmentalCompliance> => {
    return api.post('/kuaiehs/environmental-compliances', data);
  },
  list: async (params?: EnvironmentalComplianceListParams): Promise<EnvironmentalCompliance[]> => {
    return api.get('/kuaiehs/environmental-compliances', { params });
  },
  get: async (uuid: string): Promise<EnvironmentalCompliance> => {
    return api.get(`/kuaiehs/environmental-compliances/${uuid}`);
  },
  update: async (uuid: string, data: EnvironmentalComplianceUpdate): Promise<EnvironmentalCompliance> => {
    return api.put(`/kuaiehs/environmental-compliances/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/environmental-compliances/${uuid}`);
  },
};

/**
 * 环境事故 API 服务
 */
export const environmentalIncidentApi = {
  create: async (data: EnvironmentalIncidentCreate): Promise<EnvironmentalIncident> => {
    return api.post('/kuaiehs/environmental-incidents', data);
  },
  list: async (params?: EnvironmentalIncidentListParams): Promise<EnvironmentalIncident[]> => {
    return api.get('/kuaiehs/environmental-incidents', { params });
  },
  get: async (uuid: string): Promise<EnvironmentalIncident> => {
    return api.get(`/kuaiehs/environmental-incidents/${uuid}`);
  },
  update: async (uuid: string, data: EnvironmentalIncidentUpdate): Promise<EnvironmentalIncident> => {
    return api.put(`/kuaiehs/environmental-incidents/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/environmental-incidents/${uuid}`);
  },
};

/**
 * 职业健康检查 API 服务
 */
export const occupationalHealthCheckApi = {
  create: async (data: OccupationalHealthCheckCreate): Promise<OccupationalHealthCheck> => {
    return api.post('/kuaiehs/occupational-health-checks', data);
  },
  list: async (params?: OccupationalHealthCheckListParams): Promise<OccupationalHealthCheck[]> => {
    return api.get('/kuaiehs/occupational-health-checks', { params });
  },
  get: async (uuid: string): Promise<OccupationalHealthCheck> => {
    return api.get(`/kuaiehs/occupational-health-checks/${uuid}`);
  },
  update: async (uuid: string, data: OccupationalHealthCheckUpdate): Promise<OccupationalHealthCheck> => {
    return api.put(`/kuaiehs/occupational-health-checks/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/occupational-health-checks/${uuid}`);
  },
};

/**
 * 职业病 API 服务
 */
export const occupationalDiseaseApi = {
  create: async (data: OccupationalDiseaseCreate): Promise<OccupationalDisease> => {
    return api.post('/kuaiehs/occupational-diseases', data);
  },
  list: async (params?: OccupationalDiseaseListParams): Promise<OccupationalDisease[]> => {
    return api.get('/kuaiehs/occupational-diseases', { params });
  },
  get: async (uuid: string): Promise<OccupationalDisease> => {
    return api.get(`/kuaiehs/occupational-diseases/${uuid}`);
  },
  update: async (uuid: string, data: OccupationalDiseaseUpdate): Promise<OccupationalDisease> => {
    return api.put(`/kuaiehs/occupational-diseases/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/occupational-diseases/${uuid}`);
  },
};

/**
 * 健康档案 API 服务
 */
export const healthRecordApi = {
  create: async (data: HealthRecordCreate): Promise<HealthRecord> => {
    return api.post('/kuaiehs/health-records', data);
  },
  list: async (params?: HealthRecordListParams): Promise<HealthRecord[]> => {
    return api.get('/kuaiehs/health-records', { params });
  },
  get: async (uuid: string): Promise<HealthRecord> => {
    return api.get(`/kuaiehs/health-records/${uuid}`);
  },
  update: async (uuid: string, data: HealthRecordUpdate): Promise<HealthRecord> => {
    return api.put(`/kuaiehs/health-records/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/health-records/${uuid}`);
  },
};

/**
 * 安全培训 API 服务
 */
export const safetyTrainingApi = {
  create: async (data: SafetyTrainingCreate): Promise<SafetyTraining> => {
    return api.post('/kuaiehs/safety-trainings', data);
  },
  list: async (params?: SafetyTrainingListParams): Promise<SafetyTraining[]> => {
    return api.get('/kuaiehs/safety-trainings', { params });
  },
  get: async (uuid: string): Promise<SafetyTraining> => {
    return api.get(`/kuaiehs/safety-trainings/${uuid}`);
  },
  update: async (uuid: string, data: SafetyTrainingUpdate): Promise<SafetyTraining> => {
    return api.put(`/kuaiehs/safety-trainings/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/safety-trainings/${uuid}`);
  },
};

/**
 * 安全检查 API 服务
 */
export const safetyInspectionApi = {
  create: async (data: SafetyInspectionCreate): Promise<SafetyInspection> => {
    return api.post('/kuaiehs/safety-inspections', data);
  },
  list: async (params?: SafetyInspectionListParams): Promise<SafetyInspection[]> => {
    return api.get('/kuaiehs/safety-inspections', { params });
  },
  get: async (uuid: string): Promise<SafetyInspection> => {
    return api.get(`/kuaiehs/safety-inspections/${uuid}`);
  },
  update: async (uuid: string, data: SafetyInspectionUpdate): Promise<SafetyInspection> => {
    return api.put(`/kuaiehs/safety-inspections/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/safety-inspections/${uuid}`);
  },
};

/**
 * 安全隐患 API 服务
 */
export const safetyHazardApi = {
  create: async (data: SafetyHazardCreate): Promise<SafetyHazard> => {
    return api.post('/kuaiehs/safety-hazards', data);
  },
  list: async (params?: SafetyHazardListParams): Promise<SafetyHazard[]> => {
    return api.get('/kuaiehs/safety-hazards', { params });
  },
  get: async (uuid: string): Promise<SafetyHazard> => {
    return api.get(`/kuaiehs/safety-hazards/${uuid}`);
  },
  update: async (uuid: string, data: SafetyHazardUpdate): Promise<SafetyHazard> => {
    return api.put(`/kuaiehs/safety-hazards/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/safety-hazards/${uuid}`);
  },
};

/**
 * 安全事故 API 服务
 */
export const safetyIncidentApi = {
  create: async (data: SafetyIncidentCreate): Promise<SafetyIncident> => {
    return api.post('/kuaiehs/safety-incidents', data);
  },
  list: async (params?: SafetyIncidentListParams): Promise<SafetyIncident[]> => {
    return api.get('/kuaiehs/safety-incidents', { params });
  },
  get: async (uuid: string): Promise<SafetyIncident> => {
    return api.get(`/kuaiehs/safety-incidents/${uuid}`);
  },
  update: async (uuid: string, data: SafetyIncidentUpdate): Promise<SafetyIncident> => {
    return api.put(`/kuaiehs/safety-incidents/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/safety-incidents/${uuid}`);
  },
};

/**
 * 法规 API 服务
 */
export const regulationApi = {
  create: async (data: RegulationCreate): Promise<Regulation> => {
    return api.post('/kuaiehs/regulations', data);
  },
  list: async (params?: RegulationListParams): Promise<Regulation[]> => {
    return api.get('/kuaiehs/regulations', { params });
  },
  get: async (uuid: string): Promise<Regulation> => {
    return api.get(`/kuaiehs/regulations/${uuid}`);
  },
  update: async (uuid: string, data: RegulationUpdate): Promise<Regulation> => {
    return api.put(`/kuaiehs/regulations/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/regulations/${uuid}`);
  },
};

/**
 * 合规检查 API 服务
 */
export const complianceCheckApi = {
  create: async (data: ComplianceCheckCreate): Promise<ComplianceCheck> => {
    return api.post('/kuaiehs/compliance-checks', data);
  },
  list: async (params?: ComplianceCheckListParams): Promise<ComplianceCheck[]> => {
    return api.get('/kuaiehs/compliance-checks', { params });
  },
  get: async (uuid: string): Promise<ComplianceCheck> => {
    return api.get(`/kuaiehs/compliance-checks/${uuid}`);
  },
  update: async (uuid: string, data: ComplianceCheckUpdate): Promise<ComplianceCheck> => {
    return api.put(`/kuaiehs/compliance-checks/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/compliance-checks/${uuid}`);
  },
};

/**
 * 合规报告 API 服务
 */
export const complianceReportApi = {
  create: async (data: ComplianceReportCreate): Promise<ComplianceReport> => {
    return api.post('/kuaiehs/compliance-reports', data);
  },
  list: async (params?: ComplianceReportListParams): Promise<ComplianceReport[]> => {
    return api.get('/kuaiehs/compliance-reports', { params });
  },
  get: async (uuid: string): Promise<ComplianceReport> => {
    return api.get(`/kuaiehs/compliance-reports/${uuid}`);
  },
  update: async (uuid: string, data: ComplianceReportUpdate): Promise<ComplianceReport> => {
    return api.put(`/kuaiehs/compliance-reports/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaiehs/compliance-reports/${uuid}`);
  },
};

