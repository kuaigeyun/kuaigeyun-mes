import type { StatCard } from '../../../components/layout-templates';
import type { UniReportExecuteResult } from '../../../components/uni-report';
import {
  getSalesReport,
  getInventoryReport,
  getWarehouseReport,
  getQualityReport,
  getProductionReport,
  getPurchaseReport,
  getPlanReport,
  getEquipmentReport,
  getPerformanceReport,
  parseSalesReportDateRange,
  salesReportPageParams,
} from '../services/reports';

export type KuaizhizaoReportDomain =
  | 'sales'
  | 'inventory'
  | 'warehouse'
  | 'quality'
  | 'production'
  | 'purchase'
  | 'plan'
  | 'equipment'
  | 'performance';

export type ReportTypeRoute = {
  api: KuaizhizaoReportDomain;
  backendType: string;
  templateId?: string;
  dateRangeKeys?: string[];
};

export const REPORT_TYPE_ROUTES: Record<string, ReportTypeRoute> = {
  summary: { api: 'sales', backendType: 'summary', templateId: 'queryTable' },
  execution: { api: 'sales', backendType: 'order-execution-tracking', templateId: 'queryTable' },
  customer_summary: { api: 'sales', backendType: 'customer-sales-summary', templateId: 'queryTable' },
  customer_reconciliation: { api: 'sales', backendType: 'customer-sales-reconciliation', templateId: 'queryTable' },
  product_ranking: { api: 'sales', backendType: 'product-sales-ranking', templateId: 'queryTable' },
  quotation: { api: 'sales', backendType: 'quotation-query', templateId: 'queryTable' },
  'contract-execution': { api: 'sales', backendType: 'contract-execution', templateId: 'queryTable' },
  salesman: { api: 'sales', backendType: 'salesperson-performance', templateId: 'queryTable' },
  'sales-delivery-detail': { api: 'sales', backendType: 'sales-delivery-detail', templateId: 'queryTable' },
  'sales-return-detail': { api: 'sales', backendType: 'sales-return-detail', templateId: 'queryTable' },
  'material-sales-summary': { api: 'sales', backendType: 'material-sales-summary', templateId: 'queryTable' },
  'order-execution-tracking': { api: 'sales', backendType: 'order-execution-tracking', templateId: 'queryTable' },

  inventory_summary: { api: 'inventory', backendType: 'inventory_summary', templateId: 'inventoryLedger' },
  inventory_ledger: { api: 'warehouse', backendType: 'inventory_ledger', templateId: 'inventoryLedger' },
  slow_moving: { api: 'warehouse', backendType: 'slow_moving', templateId: 'queryTable' },
  stocktaking_history: { api: 'warehouse', backendType: 'stocktaking', templateId: 'queryTable' },
  transfer_tracking: { api: 'warehouse', backendType: 'transfer', templateId: 'queryTable' },

  incoming_pass_rate: { api: 'quality', backendType: 'incoming_pass_rate', templateId: 'queryTable' },
  process_pass_rate: { api: 'quality', backendType: 'process_pass_rate', templateId: 'queryTable' },
  final_pass_rate: { api: 'quality', backendType: 'final_pass_rate', templateId: 'queryTable' },
  quality_exception: { api: 'quality', backendType: 'quality_exception', templateId: 'queryTable' },
  nonconforming_summary: { api: 'quality', backendType: 'nonconforming_summary', templateId: 'queryTable' },
  quality_rate_trend: { api: 'quality', backendType: 'quality_rate_trend', templateId: 'queryTable' },

  wo_query: { api: 'production', backendType: 'wo_query', templateId: 'queryTable' },
  wo_tracking: { api: 'production', backendType: 'work-order-execution-report', templateId: 'queryTable' },
  wo_material_usage: { api: 'production', backendType: 'work-order-material-usage', templateId: 'queryTable' },
  wo_labor_detail: { api: 'production', backendType: 'process-completion-report', templateId: 'queryTable' },
  scrap_analysis: { api: 'production', backendType: 'scrap-reason-analysis', templateId: 'queryTable' },
  'production-delay-warning': { api: 'production', backendType: 'production-delay-warning', templateId: 'queryTable' },
  outsource_query: { api: 'production', backendType: 'outsource-work-order-query', templateId: 'queryTable' },
  outsource_recon: { api: 'production', backendType: 'outsource-material-reconciliation', templateId: 'queryTable' },

  po_query: { api: 'purchase', backendType: 'po_query', templateId: 'queryTable' },
  po_progress: { api: 'purchase', backendType: 'po_progress', templateId: 'queryTable' },
  requisition_tracking: { api: 'purchase', backendType: 'requisition_tracking', templateId: 'queryTable' },
  supplier_delivery: { api: 'purchase', backendType: 'supplier_delivery', templateId: 'queryTable' },
  purchase_recon: { api: 'purchase', backendType: 'pur_reconciliation', templateId: 'queryTable' },

  fulfillment: { api: 'plan', backendType: 'fulfillment', templateId: 'queryTable' },
  demand_detail: { api: 'plan', backendType: 'demand_detail', templateId: 'queryTable' },
  material_shortage: { api: 'plan', backendType: 'shortage', templateId: 'queryTable' },

  failure_analysis: { api: 'equipment', backendType: 'fault_analysis', templateId: 'queryTable' },
  equip_maint_plan: { api: 'equipment', backendType: 'maint_plan', templateId: 'queryTable' },
  equip_maint_detail: { api: 'equipment', backendType: 'maint_detail', templateId: 'queryTable' },
  equip_status_log: { api: 'equipment', backendType: 'status_log', templateId: 'queryTable' },

  'employee-efficiency-ranking': { api: 'performance', backendType: 'employee-efficiency-ranking', templateId: 'queryTable' },
  'piece-rate-salary-summary': { api: 'performance', backendType: 'piece-rate-salary-summary', templateId: 'queryTable' },
};

export function camelToKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
}

export function permissionResourceFromPersistenceId(columnPersistenceId: string): string {
  const m = columnPersistenceId.match(/pages\.([^.]+)\.reports(?:\.([\w-]+))?(?:\.(\w+))?$/);
  if (!m) return '';
  const moduleSeg = m[1];
  const pageSeg = m[3] === 'index' ? m[2] : m[3] || m[2] || '';
  if (!pageSeg) return '';
  if (pageSeg.includes('-')) {
    return `kuaizhizao:${moduleSeg}-reports-${pageSeg}`;
  }
  const kebab = camelToKebab(pageSeg);
  return `kuaizhizao:${moduleSeg}-reports-${kebab}`;
}

export function inferDomainFromPersistenceId(columnPersistenceId: string): KuaizhizaoReportDomain {
  const s = columnPersistenceId.toLowerCase();
  if (s.includes('.sales-management.')) return 'sales';
  if (s.includes('.warehouse-management.')) return 'warehouse';
  if (s.includes('.quality-management.')) return 'quality';
  if (s.includes('.purchase-management.')) return 'purchase';
  if (s.includes('.production-execution.')) return 'production';
  if (s.includes('.plan-management.')) return 'plan';
  if (s.includes('.equipment-management.')) return 'equipment';
  if (s.includes('.performance.')) return 'performance';
  return 'sales';
}

export function resolveReportRoute(reportType: string, domainHint?: KuaizhizaoReportDomain): ReportTypeRoute {
  const key = (reportType || '').trim();
  const routed = REPORT_TYPE_ROUTES[key];
  if (routed) return routed;
  return {
    api: domainHint ?? 'sales',
    backendType: key,
    templateId: 'queryTable',
  };
}

function normalizeResponse(res: {
  data?: unknown[];
  success?: boolean;
  total?: number;
  summary?: Record<string, number>;
}): UniReportExecuteResult {
  const data = Array.isArray(res?.data) ? res.data : [];
  return {
    data: data as Record<string, unknown>[],
    success: res?.success ?? true,
    total: typeof res?.total === 'number' ? res.total : data.length,
    summary: res?.summary,
  };
}

export async function fetchKuaizhizaoReport(
  reportType: string,
  params: Record<string, unknown>,
  searchFormValues?: Record<string, unknown>,
  options?: {
    domainHint?: KuaizhizaoReportDomain;
    dateRangeKeys?: string[];
    customerKeywordField?: string;
  },
): Promise<UniReportExecuteResult> {
  const route = resolveReportRoute(reportType, options?.domainHint);
  const dateKeys = options?.dateRangeKeys ?? route.dateRangeKeys ?? ['date_range', 'dateRange'];
  const { date_start, date_end } = parseSalesReportDateRange(searchFormValues, dateKeys);
  const { skip, limit } = salesReportPageParams(params);
  const customerField = options?.customerKeywordField ?? 'customer_name';
  const customer_keyword = searchFormValues?.[customerField] as string | undefined;

  const base = {
    report_type: route.backendType,
    date_start,
    date_end,
    skip,
    limit,
    ...(customer_keyword ? { customer_keyword } : {}),
  };

  switch (route.api) {
    case 'sales':
      return normalizeResponse(await getSalesReport(base));
    case 'inventory':
      return normalizeResponse(await getInventoryReport(base));
    case 'warehouse':
      return normalizeResponse(await getWarehouseReport(base));
    case 'quality':
      return normalizeResponse(await getQualityReport(base));
    case 'production':
      return normalizeResponse(await getProductionReport(base));
    case 'purchase':
      return normalizeResponse(await getPurchaseReport(base));
    case 'plan':
      return normalizeResponse(await getPlanReport(base));
    case 'equipment':
      return normalizeResponse(await getEquipmentReport(base));
    case 'performance':
      return normalizeResponse(await getPerformanceReport(base));
    default:
      return { data: [], total: 0, success: true };
  }
}

export type KuaizhizaoReportStatCards = StatCard[] | ((summary: Record<string, number>) => StatCard[]);
