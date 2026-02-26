/**
 * 绩效数据 API 服务
 *
 * 提供假期、技能、员工绩效的 API 调用方法
 * 后端 API 位于 /apps/master-data/performance
 */

import { api } from '../../../services/api';
import type {
  Holiday,
  HolidayCreate,
  HolidayUpdate,
  HolidayListParams,
  Skill,
  SkillCreate,
  SkillUpdate,
  SkillListParams,
  EmployeePerformanceConfig,
  EmployeePerformanceConfigCreate,
  EmployeePerformanceConfigUpdate,
  PieceRate,
  PieceRateCreate,
  PieceRateUpdate,
  HourlyRate,
  HourlyRateCreate,
  HourlyRateUpdate,
  KPIDefinition,
  KPIDefinitionCreate,
  KPIDefinitionUpdate,
  PerformanceSummary,
  PerformanceDetail,
  Operation,
} from '../types/performance';

/**
 * 假期 API 服务
 */
export const holidayApi = {
  create: async (data: HolidayCreate): Promise<Holiday> => {
    return api.post('/apps/master-data/performance/holidays', data);
  },
  list: async (params?: HolidayListParams): Promise<Holiday[]> => {
    return api.get('/apps/master-data/performance/holidays', { params });
  },
  get: async (uuid: string): Promise<Holiday> => {
    return api.get(`/apps/master-data/performance/holidays/${uuid}`);
  },
  update: async (uuid: string, data: HolidayUpdate): Promise<Holiday> => {
    return api.put(`/apps/master-data/performance/holidays/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/performance/holidays/${uuid}`);
  },
};

/**
 * 技能 API 服务
 */
export const skillApi = {
  create: async (data: SkillCreate): Promise<Skill> => {
    return api.post('/apps/master-data/performance/skills', data);
  },
  list: async (params?: SkillListParams): Promise<Skill[]> => {
    return api.get('/apps/master-data/performance/skills', { params });
  },
  get: async (uuid: string): Promise<Skill> => {
    return api.get(`/apps/master-data/performance/skills/${uuid}`);
  },
  update: async (uuid: string, data: SkillUpdate): Promise<Skill> => {
    return api.put(`/apps/master-data/performance/skills/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/master-data/performance/skills/${uuid}`);
  },
};

/**
 * 工序 API（用于计件单价等，从主数据 process 获取）
 */
export const operationApi = {
  list: async (params?: { limit?: number; is_active?: boolean }): Promise<Operation[]> => {
    return api.get('/apps/master-data/process/operations', { params });
  },
};

const PERF_BASE = '/apps/master-data/performance';

export interface EmployeeOption {
  id: number;
  full_name: string;
  username: string;
}

export const employeePerformanceApi = {
  listEmployees: async (params?: { skip?: number; limit?: number }): Promise<{ items: EmployeeOption[]; total: number }> => {
    return api.get(`${PERF_BASE}/employees`, { params });
  },
  listDepartments: async (): Promise<{ items: { id: number; name: string }[] }> => {
    return api.get(`${PERF_BASE}/departments`);
  },
  listPositions: async (): Promise<{ items: { id: number; name: string }[] }> => {
    return api.get(`${PERF_BASE}/positions`);
  },
  listConfigs: async (params?: { skip?: number; limit?: number; employee_id?: number }): Promise<EmployeePerformanceConfig[]> => {
    return api.get(`${PERF_BASE}/employee-configs`, { params });
  },
  getConfig: async (id: number): Promise<EmployeePerformanceConfig> => {
    return api.get(`${PERF_BASE}/employee-configs/${id}`);
  },
  createConfig: async (data: EmployeePerformanceConfigCreate): Promise<EmployeePerformanceConfig> => {
    return api.post(`${PERF_BASE}/employee-configs`, data);
  },
  updateConfig: async (id: number, data: EmployeePerformanceConfigUpdate): Promise<EmployeePerformanceConfig> => {
    return api.put(`${PERF_BASE}/employee-configs/${id}`, data);
  },
  deleteConfig: async (id: number): Promise<void> => {
    return api.delete(`${PERF_BASE}/employee-configs/${id}`);
  },
  listPieceRates: async (params?: { skip?: number; limit?: number; operation_id?: number }): Promise<PieceRate[]> => {
    return api.get(`${PERF_BASE}/piece-rates`, { params });
  },
  getPieceRate: async (id: number): Promise<PieceRate> => {
    return api.get(`${PERF_BASE}/piece-rates/${id}`);
  },
  createPieceRate: async (data: PieceRateCreate): Promise<PieceRate> => {
    return api.post(`${PERF_BASE}/piece-rates`, data);
  },
  updatePieceRate: async (id: number, data: PieceRateUpdate): Promise<PieceRate> => {
    return api.put(`${PERF_BASE}/piece-rates/${id}`, data);
  },
  deletePieceRate: async (id: number): Promise<void> => {
    return api.delete(`${PERF_BASE}/piece-rates/${id}`);
  },
  listHourlyRates: async (params?: { skip?: number; limit?: number }): Promise<HourlyRate[]> => {
    return api.get(`${PERF_BASE}/hourly-rates`, { params });
  },
  getHourlyRate: async (id: number): Promise<HourlyRate> => {
    return api.get(`${PERF_BASE}/hourly-rates/${id}`);
  },
  createHourlyRate: async (data: HourlyRateCreate): Promise<HourlyRate> => {
    return api.post(`${PERF_BASE}/hourly-rates`, data);
  },
  updateHourlyRate: async (id: number, data: HourlyRateUpdate): Promise<HourlyRate> => {
    return api.put(`${PERF_BASE}/hourly-rates/${id}`, data);
  },
  deleteHourlyRate: async (id: number): Promise<void> => {
    return api.delete(`${PERF_BASE}/hourly-rates/${id}`);
  },
  listKpiDefinitions: async (params?: { skip?: number; limit?: number }): Promise<KPIDefinition[]> => {
    return api.get(`${PERF_BASE}/kpi-definitions`, { params });
  },
  getKpiDefinition: async (id: number): Promise<KPIDefinition> => {
    return api.get(`${PERF_BASE}/kpi-definitions/${id}`);
  },
  createKpiDefinition: async (data: KPIDefinitionCreate): Promise<KPIDefinition> => {
    return api.post(`${PERF_BASE}/kpi-definitions`, data);
  },
  updateKpiDefinition: async (id: number, data: KPIDefinitionUpdate): Promise<KPIDefinition> => {
    return api.put(`${PERF_BASE}/kpi-definitions/${id}`, data);
  },
  deleteKpiDefinition: async (id: number): Promise<void> => {
    return api.delete(`${PERF_BASE}/kpi-definitions/${id}`);
  },
  listSummaries: async (params?: { period?: string; employee_id?: number; skip?: number; limit?: number }): Promise<PerformanceSummary[]> => {
    return api.get(`${PERF_BASE}/summaries`, { params });
  },
  getDetail: async (params: { period: string; employee_id: number }): Promise<PerformanceDetail> => {
    return api.get(`${PERF_BASE}/details`, { params });
  },
  calculate: async (period: string): Promise<PerformanceSummary[]> => {
    return api.post(`${PERF_BASE}/calculate`, null, { params: { period } });
  },
};
