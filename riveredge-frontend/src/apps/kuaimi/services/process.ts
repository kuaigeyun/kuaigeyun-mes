/**
 * MI 数据 API 服务
 * 
 * 提供实时生产看板、设备综合效率分析、工艺参数优化、质量预测分析、系统应用绩效分析等的 API 调用方法
 */

import { api } from '@/services/api';
import type {
  ProductionDashboard,
  ProductionDashboardCreate,
  ProductionDashboardUpdate,
  ProductionDashboardListParams,
  OEEAnalysis,
  OEEAnalysisCreate,
  OEEAnalysisUpdate,
  OEEAnalysisListParams,
  ProcessParameterOptimization,
  ProcessParameterOptimizationCreate,
  ProcessParameterOptimizationUpdate,
  ProcessParameterOptimizationListParams,
  QualityPredictionAnalysis,
  QualityPredictionAnalysisCreate,
  QualityPredictionAnalysisUpdate,
  QualityPredictionAnalysisListParams,
  SystemPerformanceAnalysis,
  SystemPerformanceAnalysisCreate,
  SystemPerformanceAnalysisUpdate,
  SystemPerformanceAnalysisListParams,
} from '../types/process';

/**
 * 实时生产看板 API 服务
 */
export const productionDashboardApi = {
  /**
   * 创建实时生产看板
   */
  create: async (data: ProductionDashboardCreate): Promise<ProductionDashboard> => {
    return api.post('/apps/kuaimi/production-dashboards', data);
  },

  /**
   * 获取实时生产看板列表
   */
  list: async (params?: ProductionDashboardListParams): Promise<ProductionDashboard[]> => {
    return api.get('/apps/kuaimi/production-dashboards', { params });
  },

  /**
   * 获取实时生产看板详情
   */
  get: async (uuid: string): Promise<ProductionDashboard> => {
    return api.get(`/apps/kuaimi/production-dashboards/${uuid}`);
  },

  /**
   * 更新实时生产看板
   */
  update: async (uuid: string, data: ProductionDashboardUpdate): Promise<ProductionDashboard> => {
    return api.put(`/apps/kuaimi/production-dashboards/${uuid}`, data);
  },

  /**
   * 删除实时生产看板
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimi/production-dashboards/${uuid}`);
  },
};

/**
 * 设备综合效率分析 API 服务
 */
export const oeeAnalysisApi = {
  /**
   * 创建设备综合效率分析
   */
  create: async (data: OEEAnalysisCreate): Promise<OEEAnalysis> => {
    return api.post('/apps/kuaimi/oee-analyses', data);
  },

  /**
   * 获取设备综合效率分析列表
   */
  list: async (params?: OEEAnalysisListParams): Promise<OEEAnalysis[]> => {
    return api.get('/apps/kuaimi/oee-analyses', { params });
  },

  /**
   * 获取设备综合效率分析详情
   */
  get: async (uuid: string): Promise<OEEAnalysis> => {
    return api.get(`/apps/kuaimi/oee-analyses/${uuid}`);
  },

  /**
   * 更新设备综合效率分析
   */
  update: async (uuid: string, data: OEEAnalysisUpdate): Promise<OEEAnalysis> => {
    return api.put(`/apps/kuaimi/oee-analyses/${uuid}`, data);
  },

  /**
   * 删除设备综合效率分析
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimi/oee-analyses/${uuid}`);
  },
};

/**
 * 工艺参数优化 API 服务
 */
export const processParameterOptimizationApi = {
  /**
   * 创建工艺参数优化
   */
  create: async (data: ProcessParameterOptimizationCreate): Promise<ProcessParameterOptimization> => {
    return api.post('/apps/kuaimi/process-parameter-optimizations', data);
  },

  /**
   * 获取工艺参数优化列表
   */
  list: async (params?: ProcessParameterOptimizationListParams): Promise<ProcessParameterOptimization[]> => {
    return api.get('/apps/kuaimi/process-parameter-optimizations', { params });
  },

  /**
   * 获取工艺参数优化详情
   */
  get: async (uuid: string): Promise<ProcessParameterOptimization> => {
    return api.get(`/apps/kuaimi/process-parameter-optimizations/${uuid}`);
  },

  /**
   * 更新工艺参数优化
   */
  update: async (uuid: string, data: ProcessParameterOptimizationUpdate): Promise<ProcessParameterOptimization> => {
    return api.put(`/apps/kuaimi/process-parameter-optimizations/${uuid}`, data);
  },

  /**
   * 删除工艺参数优化
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimi/process-parameter-optimizations/${uuid}`);
  },
};

/**
 * 质量预测分析 API 服务
 */
export const qualityPredictionAnalysisApi = {
  /**
   * 创建质量预测分析
   */
  create: async (data: QualityPredictionAnalysisCreate): Promise<QualityPredictionAnalysis> => {
    return api.post('/apps/kuaimi/quality-prediction-analyses', data);
  },

  /**
   * 获取质量预测分析列表
   */
  list: async (params?: QualityPredictionAnalysisListParams): Promise<QualityPredictionAnalysis[]> => {
    return api.get('/apps/kuaimi/quality-prediction-analyses', { params });
  },

  /**
   * 获取质量预测分析详情
   */
  get: async (uuid: string): Promise<QualityPredictionAnalysis> => {
    return api.get(`/apps/kuaimi/quality-prediction-analyses/${uuid}`);
  },

  /**
   * 更新质量预测分析
   */
  update: async (uuid: string, data: QualityPredictionAnalysisUpdate): Promise<QualityPredictionAnalysis> => {
    return api.put(`/apps/kuaimi/quality-prediction-analyses/${uuid}`, data);
  },

  /**
   * 删除质量预测分析
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimi/quality-prediction-analyses/${uuid}`);
  },
};

/**
 * 系统应用绩效分析 API 服务
 */
export const systemPerformanceAnalysisApi = {
  /**
   * 创建系统应用绩效分析
   */
  create: async (data: SystemPerformanceAnalysisCreate): Promise<SystemPerformanceAnalysis> => {
    return api.post('/apps/kuaimi/system-performance-analyses', data);
  },

  /**
   * 获取系统应用绩效分析列表
   */
  list: async (params?: SystemPerformanceAnalysisListParams): Promise<SystemPerformanceAnalysis[]> => {
    return api.get('/apps/kuaimi/system-performance-analyses', { params });
  },

  /**
   * 获取系统应用绩效分析详情
   */
  get: async (uuid: string): Promise<SystemPerformanceAnalysis> => {
    return api.get(`/apps/kuaimi/system-performance-analyses/${uuid}`);
  },

  /**
   * 更新系统应用绩效分析
   */
  update: async (uuid: string, data: SystemPerformanceAnalysisUpdate): Promise<SystemPerformanceAnalysis> => {
    return api.put(`/apps/kuaimi/system-performance-analyses/${uuid}`, data);
  },

  /**
   * 删除系统应用绩效分析
   */
  delete: async (uuid: string): Promise<void> => {
    return api.delete(`/apps/kuaimi/system-performance-analyses/${uuid}`);
  },
};

