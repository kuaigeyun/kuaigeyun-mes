import { apiRequest } from '../../../services/api';

const REPORT_API = '/apps/kuaicaiwu/management-report';

export type FinancialKPIs = {
  period_days: number;
  total_sales: number;
  ar_balance: number;
  dso: number;
  gross_margin_rate: number;
  inventory_total?: number;
  inventory_turnover: number;
  receivable_aging: Record<string, { count: number; amount: number }>;
};

export type QualityLossAnalysis = {
  period_days: number;
  scrap_cost: number;
  unqualified_quantity: number;
  quality_loss_total: number;
};

export type WIPValuation = {
  active_work_orders_count: number;
  estimated_wip_value: number;
};

export const managementReportService = {
  getKPIs: (days = 30) =>
    apiRequest<FinancialKPIs>(`${REPORT_API}/kpis`, { method: 'GET', params: { days } }),

  getQualityLoss: (days = 30) =>
    apiRequest<QualityLossAnalysis>(`${REPORT_API}/quality-loss`, {
      method: 'GET',
      params: { days },
    }),

  getWIPValuation: () => apiRequest<WIPValuation>(`${REPORT_API}/wip-valuation`, { method: 'GET' }),
};
