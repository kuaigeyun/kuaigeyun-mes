import type { UniReportTemplate } from '../types';

/** 销售类：日期区间默认本月、金额/数量双合计 */
export const salesAnalysisTablePreset: UniReportTemplate = {
  id: 'salesAnalysisTable',
  label: 'components.uniReport.template.salesAnalysisTable',
  description: 'components.uniReport.template.salesAnalysisTableDesc',
  showIndexColumn: true,
  showSummaryRow: true,
  summaryFields: ['total_amount', 'quantity'],
  defaultDateRangeKey: 'order_date_range',
  tableSize: 'small',
  bordered: true,
  kpiBindings: [
    { key: 'total_orders', title: 'components.uniReport.kpi.totalOrders' },
    { key: 'total_amount', title: 'components.uniReport.kpi.totalAmount', precision: 2 },
    { key: 'pending_review', title: 'components.uniReport.kpi.pendingReview' },
    { key: 'in_execution', title: 'components.uniReport.kpi.inExecution' },
    { key: 'completed', title: 'components.uniReport.kpi.completed' },
  ],
};
