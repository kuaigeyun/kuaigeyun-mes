import { apiRequest } from '../../../services/api';
import {
  FinancialKPIs,
  QualityLossAnalysis,
  LaborEfficiencyAnalysis,
  WIPValuation,
  MarginReportListParams,
  MarginReportListResponse,
} from '../types/management-report';

const REPORT_API = '/apps/kuaicaiwu/management-report';

export const managementReportService = {
  getKPIs: (days: number = 30) => {
    return apiRequest<FinancialKPIs>(`${REPORT_API}/kpis`, {
      method: 'GET',
      params: { days },
    });
  },

  getQualityLoss: (days: number = 30) => {
    return apiRequest<QualityLossAnalysis>(`${REPORT_API}/quality-loss`, {
      method: 'GET',
      params: { days },
    });
  },

  getLaborEfficiency: (days: number = 30) => {
    return apiRequest<LaborEfficiencyAnalysis>(`${REPORT_API}/labor-efficiency`, {
      method: 'GET',
      params: { days },
    });
  },

  getWIPValuation: () => {
    return apiRequest<WIPValuation>(`${REPORT_API}/wip-valuation`, {
      method: 'GET',
    });
  },

  getCostVariance: (productId: number) => {
    return apiRequest<any>(`${REPORT_API}/cost-variance/${productId}`, {
      method: 'GET',
    });
  },

  getFinanceSummary: () => {
    return apiRequest<Record<string, number>>(`${REPORT_API}/finance-summary`, {
      method: 'GET',
    });
  },

  getMarginByProduct: (params: MarginReportListParams = {}) => {
    return apiRequest<MarginReportListResponse>(`${REPORT_API}/margin-by-product`, {
      method: 'GET',
      params: { days: 30, ...params },
    });
  },

  getMarginByCustomer: (params: MarginReportListParams = {}) => {
    return apiRequest<MarginReportListResponse>(`${REPORT_API}/margin-by-customer`, {
      method: 'GET',
      params: { days: 30, ...params },
    });
  },

  getMarginByOrder: (params: MarginReportListParams = {}) => {
    return apiRequest<MarginReportListResponse>(`${REPORT_API}/margin-by-order`, {
      method: 'GET',
      params: { days: 30, ...params },
    });
  },
};
