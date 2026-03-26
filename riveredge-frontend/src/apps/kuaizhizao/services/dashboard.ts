import { apiRequest } from '../../../services/api';

/**
 * MES Dashboard (Workbench) Service
 */
export const mesDashboardService = {
  // 获取待办事项
  getTodos: async (limit = 20) => {
    return apiRequest('/apps/kuaizhizao/dashboard/todos', {
      method: 'GET',
      params: { limit },
    });
  },

  // 获取全局统计
  getStatistics: async (dateStart?: string, dateEnd?: string) => {
    return apiRequest('/apps/kuaizhizao/dashboard/statistics', {
      method: 'GET',
      params: { date_start: dateStart, date_end: dateEnd },
    });
  },

  // 获取工序进度
  getProcessProgress: async (includeUnstarted = false) => {
    return apiRequest('/apps/kuaizhizao/dashboard/process-progress', {
      method: 'GET',
      params: { include_unstarted: includeUnstarted },
    });
  },

  // 获取管理指标
  getManagementMetrics: async (dateStart?: string, dateEnd?: string) => {
    return apiRequest('/apps/kuaizhizao/dashboard/management-metrics', {
      method: 'GET',
      params: { date_start: dateStart, date_end: dateEnd },
    });
  },

  // 获取生产实时播报
  getProductionBroadcast: async (limit = 10) => {
    return apiRequest('/apps/kuaizhizao/dashboard/production-broadcast', {
      method: 'GET',
      params: { limit },
    });
  },

  // 获取菜单徽标数量
  getMenuBadgeCounts: async () => {
    return apiRequest('/apps/kuaizhizao/dashboard/menu-badge-counts', {
      method: 'GET',
    });
  },
};
