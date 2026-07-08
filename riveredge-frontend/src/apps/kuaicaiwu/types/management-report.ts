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

export interface MarginReportRow {
  product_id?: number;
  product_code?: string;
  product_name?: string;
  customer_id?: number;
  customer_name?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  delivery_id?: number;
  delivery_code?: string;
  revenue: number;
  cost: number;
  gross_margin: number;
  gross_margin_rate: number;
}

export interface MarginReportListResponse {
  period_days: number;
  items: MarginReportRow[];
  total: number;
}

export type MarginReportListParams = {
  days?: number;
  skip?: number;
  limit?: number;
  keyword?: string;
  product_code?: string;
  product_name?: string;
  customer_name?: string;
  sales_order_code?: string;
  delivery_code?: string;
  sort_field?: string;
  sort_order?: string;
};
