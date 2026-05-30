export interface FinancialKPIs {
  period_days: number;
  total_sales: number;
  ar_balance: number;
  dso: number;
  gross_margin_rate: number;
  inventory_total?: number;
  inventory_turnover: number;
  receivable_aging: Record<string, { count: number; amount: number }>;
}

export interface QualityLossAnalysis {
  period_days: number;
  scrap_cost: number;
  unqualified_quantity: number;
  quality_loss_total: number;
}

export interface LaborEfficiencyAnalysis {
  period_days: number;
  actual_work_hours: number;
  standard_work_hours: number;
  labor_efficiency_rate: number;
}

export interface WIPValuation {
  active_work_orders_count: number;
  estimated_wip_value: number;
}
