import { apiRequest } from '../../../services/api';
import { 
  FinancialKPIs, 
  QualityLossAnalysis, 
  LaborEfficiencyAnalysis, 
  WIPValuation 
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
};
