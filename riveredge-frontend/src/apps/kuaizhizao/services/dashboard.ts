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
  // 获取销售中心汇总
  getSalesSummary: async (is_active = true) => {
    return apiRequest('/apps/kuaizhizao/dashboard/sales-summary', {
      method: 'GET',
      params: { is_active },
    });
  },

  // 获取采购中心汇总
  getPurchaseSummary: async () => {
    return apiRequest('/apps/kuaizhizao/dashboard/purchase-summary', {
      method: 'GET',
    });
  },

  // 获取制造中心汇总
  getManufacturingSummary: async () => {
    return apiRequest('/apps/kuaizhizao/dashboard/manufacturing-summary', {
      method: 'GET',
    });
  },

  // 获取设备看板汇总
  getEquipmentSummary: async () => {
    return apiRequest('/apps/kuaizhizao/dashboard/equipment-summary', {
      method: 'GET',
    });
  },
};
