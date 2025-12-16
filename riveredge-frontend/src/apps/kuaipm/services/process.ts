/**
 * PM数据 API 服务
 * 
 * 提供项目管理的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectListParams,
  ProjectApplication,
  ProjectApplicationCreate,
  ProjectApplicationUpdate,
  ProjectApplicationListParams,
  ProjectWBS,
  ProjectWBSCreate,
  ProjectWBSUpdate,
  ProjectWBSListParams,
  ProjectTask,
  ProjectTaskCreate,
  ProjectTaskUpdate,
  ProjectTaskListParams,
  ProjectResource,
  ProjectResourceCreate,
  ProjectResourceUpdate,
  ProjectResourceListParams,
  ProjectProgress,
  ProjectProgressCreate,
  ProjectProgressUpdate,
  ProjectProgressListParams,
  ProjectCost,
  ProjectCostCreate,
  ProjectCostUpdate,
  ProjectCostListParams,
  ProjectRisk,
  ProjectRiskCreate,
  ProjectRiskUpdate,
  ProjectRiskListParams,
  ProjectQuality,
  ProjectQualityCreate,
  ProjectQualityUpdate,
  ProjectQualityListParams,
} from '../types/process';

/**
 * 项目 API 服务
 */
export const projectApi = {
  create: async (data: ProjectCreate): Promise<Project> => {
    return api.post('/kuaipm/projects', data);
  },
  list: async (params?: ProjectListParams): Promise<Project[]> => {
    return api.get('/kuaipm/projects', { params });
  },
  get: async (uuid: string): Promise<Project> => {
    return api.get(`/kuaipm/projects/${uuid}`);
  },
  update: async (uuid: string, data: ProjectUpdate): Promise<Project> => {
    return api.put(`/kuaipm/projects/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaipm/projects/${uuid}`);
  },
};

/**
 * 项目申请 API 服务
 */
export const projectApplicationApi = {
  create: async (data: ProjectApplicationCreate): Promise<ProjectApplication> => {
    return api.post('/kuaipm/project-applications', data);
  },
  list: async (params?: ProjectApplicationListParams): Promise<ProjectApplication[]> => {
    return api.get('/kuaipm/project-applications', { params });
  },
  get: async (uuid: string): Promise<ProjectApplication> => {
    return api.get(`/kuaipm/project-applications/${uuid}`);
  },
  update: async (uuid: string, data: ProjectApplicationUpdate): Promise<ProjectApplication> => {
    return api.put(`/kuaipm/project-applications/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaipm/project-applications/${uuid}`);
  },
};

/**
 * 项目WBS API 服务
 */
export const projectWBSApi = {
  create: async (data: ProjectWBSCreate): Promise<ProjectWBS> => {
    return api.post('/kuaipm/project-wbss', data);
  },
  list: async (params?: ProjectWBSListParams): Promise<ProjectWBS[]> => {
    return api.get('/kuaipm/project-wbss', { params });
  },
  get: async (uuid: string): Promise<ProjectWBS> => {
    return api.get(`/kuaipm/project-wbss/${uuid}`);
  },
  update: async (uuid: string, data: ProjectWBSUpdate): Promise<ProjectWBS> => {
    return api.put(`/kuaipm/project-wbss/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaipm/project-wbss/${uuid}`);
  },
};

/**
 * 项目任务 API 服务
 */
export const projectTaskApi = {
  create: async (data: ProjectTaskCreate): Promise<ProjectTask> => {
    return api.post('/kuaipm/project-tasks', data);
  },
  list: async (params?: ProjectTaskListParams): Promise<ProjectTask[]> => {
    return api.get('/kuaipm/project-tasks', { params });
  },
  get: async (uuid: string): Promise<ProjectTask> => {
    return api.get(`/kuaipm/project-tasks/${uuid}`);
  },
  update: async (uuid: string, data: ProjectTaskUpdate): Promise<ProjectTask> => {
    return api.put(`/kuaipm/project-tasks/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaipm/project-tasks/${uuid}`);
  },
};

/**
 * 项目资源 API 服务
 */
export const projectResourceApi = {
  create: async (data: ProjectResourceCreate): Promise<ProjectResource> => {
    return api.post('/kuaipm/project-resources', data);
  },
  list: async (params?: ProjectResourceListParams): Promise<ProjectResource[]> => {
    return api.get('/kuaipm/project-resources', { params });
  },
  get: async (uuid: string): Promise<ProjectResource> => {
    return api.get(`/kuaipm/project-resources/${uuid}`);
  },
  update: async (uuid: string, data: ProjectResourceUpdate): Promise<ProjectResource> => {
    return api.put(`/kuaipm/project-resources/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaipm/project-resources/${uuid}`);
  },
};

/**
 * 项目进度 API 服务
 */
export const projectProgressApi = {
  create: async (data: ProjectProgressCreate): Promise<ProjectProgress> => {
    return api.post('/kuaipm/project-progresss', data);
  },
  list: async (params?: ProjectProgressListParams): Promise<ProjectProgress[]> => {
    return api.get('/kuaipm/project-progresss', { params });
  },
  get: async (uuid: string): Promise<ProjectProgress> => {
    return api.get(`/kuaipm/project-progresss/${uuid}`);
  },
  update: async (uuid: string, data: ProjectProgressUpdate): Promise<ProjectProgress> => {
    return api.put(`/kuaipm/project-progresss/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaipm/project-progresss/${uuid}`);
  },
};

/**
 * 项目成本 API 服务
 */
export const projectCostApi = {
  create: async (data: ProjectCostCreate): Promise<ProjectCost> => {
    return api.post('/kuaipm/project-costs', data);
  },
  list: async (params?: ProjectCostListParams): Promise<ProjectCost[]> => {
    return api.get('/kuaipm/project-costs', { params });
  },
  get: async (uuid: string): Promise<ProjectCost> => {
    return api.get(`/kuaipm/project-costs/${uuid}`);
  },
  update: async (uuid: string, data: ProjectCostUpdate): Promise<ProjectCost> => {
    return api.put(`/kuaipm/project-costs/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaipm/project-costs/${uuid}`);
  },
};

/**
 * 项目风险 API 服务
 */
export const projectRiskApi = {
  create: async (data: ProjectRiskCreate): Promise<ProjectRisk> => {
    return api.post('/kuaipm/project-risks', data);
  },
  list: async (params?: ProjectRiskListParams): Promise<ProjectRisk[]> => {
    return api.get('/kuaipm/project-risks', { params });
  },
  get: async (uuid: string): Promise<ProjectRisk> => {
    return api.get(`/kuaipm/project-risks/${uuid}`);
  },
  update: async (uuid: string, data: ProjectRiskUpdate): Promise<ProjectRisk> => {
    return api.put(`/kuaipm/project-risks/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaipm/project-risks/${uuid}`);
  },
};

/**
 * 项目质量 API 服务
 */
export const projectQualityApi = {
  create: async (data: ProjectQualityCreate): Promise<ProjectQuality> => {
    return api.post('/kuaipm/project-qualitys', data);
  },
  list: async (params?: ProjectQualityListParams): Promise<ProjectQuality[]> => {
    return api.get('/kuaipm/project-qualitys', { params });
  },
  get: async (uuid: string): Promise<ProjectQuality> => {
    return api.get(`/kuaipm/project-qualitys/${uuid}`);
  },
  update: async (uuid: string, data: ProjectQualityUpdate): Promise<ProjectQuality> => {
    return api.put(`/kuaipm/project-qualitys/${uuid}`, data);
  },
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/kuaipm/project-qualitys/${uuid}`);
  },
};

