/**
 * 菜单路径与业务配置（node/module）的映射
 *
 * 用于在菜单项没有 meta 时（如历史同步数据）根据 path 回退查找对应的业务节点/模块。
 * 仅对 kuaizhizao 应用的路径生效。
 */

export interface MenuBusinessMeta {
  node?: string;
  module?: string;
}

/**
 * 路径最后一段 -> 业务配置映射
 * 仅包含有 path 的叶子菜单，匹配时取 path 的最后一个路径段
 */
const PATH_SEGMENT_TO_BUSINESS: Record<string, MenuBusinessMeta> = {
  // 计划管理
  'demand-management': { module: 'demand' },
  'demand-computation': { module: 'demand' },
  'production-plans': { node: 'production_plan', module: 'demand' },
  'scheduling': { module: 'production' },
  'computation-config': { module: 'demand' },
  'computation-history': { module: 'demand' },
  // 销售管理
  'quotations': { node: 'quotation', module: 'sales' },
  'sample-trials': { node: 'sample_trial', module: 'sales' },
  'sales-forecasts': { node: 'sales_forecast', module: 'sales' },
  'sales-orders': { node: 'sales_order', module: 'sales' },
  'shipment-notices': { node: 'shipment_notice', module: 'sales' },
  // 采购管理
  'purchase-requisitions': { node: 'purchase_request', module: 'purchase' },
  'purchase-orders': { node: 'purchase_order', module: 'purchase' },
  'receipt-notices': { node: 'receipt_notice', module: 'purchase' },
  // 生产执行
  'work-orders': { node: 'work_order', module: 'production' },
  'reporting': { module: 'production' },
  'terminal': { module: 'production' },
  'statistics': { module: 'production' },
  'rework-orders': { node: 'rework_order', module: 'production' },
  'outsource-management': { node: 'outsource_order', module: 'production' },
  'material-shortage-exceptions': { module: 'production' },
  'delivery-delay-exceptions': { module: 'production' },
  'quality-exceptions': { module: 'production' },
  'exception-process': { module: 'production' },
  'exception-statistics': { module: 'production' },
  // 质量管理
  'incoming-inspection': { node: 'quality_inspection', module: 'quality' },
  'inspection-plans': { module: 'quality' },
  'process-inspection': { node: 'quality_inspection', module: 'quality' },
  'finished-goods-inspection': { node: 'quality_inspection', module: 'quality' },
  'traceability': { node: 'quality_inspection', module: 'quality' },
  // 仓储管理
  'inbound': { node: 'inbound', module: 'warehouse' },
  'other-inbound': { module: 'warehouse' },
  'material-returns': { module: 'warehouse' },
  'customer-material-registration': { module: 'warehouse' },
  'outbound': { node: 'outbound', module: 'warehouse' },
  'other-outbound': { module: 'warehouse' },
  'material-borrows': { module: 'warehouse' },
  'delivery-notes': { node: 'delivery_notice', module: 'warehouse' },
  'line-side-warehouse': { module: 'warehouse' },
  'backflush-records': { module: 'warehouse' },
  'inventory': { module: 'warehouse' },
  'initial-data': { module: 'warehouse' },
  'barcode-mapping-rules': { module: 'warehouse' },
  'stocktaking': { node: 'stocktaking', module: 'warehouse' },
  'inventory-transfer': { node: 'inventory_transfer', module: 'warehouse' },
  'assembly-orders': { node: 'assembly_order', module: 'warehouse' },
  'disassembly-orders': { node: 'disassembly_order', module: 'warehouse' },
  // 分析中心
  'document-timing': { module: 'analysis' },
  'document-efficiency': { module: 'analysis' },
  'replenishment-suggestions': { module: 'warehouse' },
  // 设备管理
  'equipment': { module: 'equipment' },
  'molds': { module: 'equipment' },
  'tool-ledger': { module: 'equipment' },
  'equipment-faults': { node: 'equipment_fault', module: 'equipment' },
  'maintenance-plans': { node: 'maintenance_plan', module: 'equipment' },
  'maintenance-reminders': { node: 'maintenance_reminder', module: 'equipment' },
  'equipment-status': { node: 'equipment_status', module: 'equipment' },
  // 成本 / 财务管理
  'cost-calculations': { module: 'finance' },
  'cost-comparison': { module: 'finance' },
  'receivables': { node: 'receivable', module: 'finance' },
  'sales-invoices': { module: 'finance' },
  'receipts': { module: 'finance' },
  'payables': { node: 'payable', module: 'finance' },
  'purchase-invoices': { module: 'finance' },
  'payments': { module: 'finance' },
  'invoices': { node: 'invoice', module: 'finance' },
  // 报表路径（按最后一段匹配）
  'sales-order-query': { module: 'sales' },
  'order-execution-tracking': { module: 'sales' },
  'customer-sales-summary': { module: 'sales' },
  'customer-sales-reconciliation': { module: 'sales' },
  'product-sales-ranking': { module: 'sales' },
  'forecast-vs-actual': { module: 'sales' },
  'quotation-query': { module: 'sales' },
  'sample-trial-query': { module: 'sales' },
  'demand-plan-detail': { module: 'demand' },
  'production-plan-comparison': { module: 'demand' },
  'purchase-plan-comparison': { module: 'demand' },
  'capacity-load-analysis': { module: 'demand' },
  'material-shortage-alert': { module: 'demand' },
  'purchase-requisition-tracking': { module: 'purchase' },
  'purchase-order-query': { module: 'purchase' },
  'purchase-order-progress': { module: 'purchase' },
  'supplier-delivery-summary': { module: 'purchase' },
  'supplier-price-comparison': { module: 'purchase' },
  'purchase-reconciliation': { module: 'purchase' },
  'supplier-quality-rate': { module: 'purchase' },
  'work-order-query': { module: 'production' },
  'work-order-tracking': { module: 'production' },
  'work-order-material-usage': { module: 'production' },
  'work-order-labor-detail': { module: 'production' },
  'production-efficiency': { module: 'production' },
  'process-progress-detail': { module: 'production' },
  'rework-order-analysis': { module: 'production' },
  'outsource-order-query': { module: 'production' },
  'outsource-material-reconciliation': { module: 'production' },
  'wip-inventory': { module: 'production' },
  'incoming-inspection-report': { module: 'quality' },
  'process-inspection-report': { module: 'quality' },
  'finished-inspection-report': { module: 'quality' },
  'quality-exception-tracking': { module: 'quality' },
  'nonconforming-summary': { module: 'quality' },
  'quality-rate-trend': { module: 'quality' },
  'equipment-maintenance-detail': { module: 'equipment' },
  'equipment-maintenance-plan': { module: 'equipment' },
  'equipment-fault-analysis': { module: 'equipment' },
  'equipment-status-log': { module: 'equipment' },
  'inventory-summary': { module: 'warehouse' },
  'inventory-ledger': { module: 'warehouse' },
  'inventory-age-analysis': { module: 'warehouse' },
  'slow-moving-inventory': { module: 'warehouse' },
  'inbound-summary': { module: 'warehouse' },
  'outbound-summary': { module: 'warehouse' },
  'stocktaking-history': { module: 'warehouse' },
  'transfer-tracking': { module: 'warehouse' },
  'receivable-age-analysis': { module: 'finance' },
  'receivable-reconciliation': { module: 'finance' },
  'sales-receipt-detail': { module: 'finance' },
  'payable-age-analysis': { module: 'finance' },
  'payable-reconciliation': { module: 'finance' },
  'three-way-match': { module: 'finance' },
  'sales-order-full-trace': { module: 'analysis' },
  'purchase-order-full-trace': { module: 'analysis' },
  'material-lifecycle-trace': { module: 'analysis' },
  'business-status-dashboard': { module: 'analysis' },
};

/** 父级分组 key -> module（用于无 path 的分组节点） */
const GROUP_TITLE_TO_MODULE: Record<string, string> = {
  'app.kuaizhizao.menu.sales-management': 'sales',
  'app.kuaizhizao.menu.purchase-management': 'purchase',
  'app.kuaizhizao.menu.production-execution': 'production',
  'app.kuaizhizao.menu.quality-management': 'quality',
  'app.kuaizhizao.menu.warehouse-management': 'warehouse',
  'app.kuaizhizao.menu.analysis-center': 'analysis',
  'app.kuaizhizao.menu.analysis-center.efficiency-analysis': 'analysis',
  'app.kuaizhizao.menu.cost-management': 'finance',
  'app.kuaizhizao.menu.finance-management': 'finance',
  'app.kuaizhizao.menu.performance-management': 'performance',
  'app.kuaizhizao.menu.equipment-management': 'equipment',
};

const KUAIZHIZAO_PATH_PREFIX = '/apps/kuaizhizao';

/**
 * 从菜单项解析业务 meta（优先用 meta，否则按 path 回退）
 */
export function getMenuBusinessMeta(menu: { path?: string | null; name?: string; meta?: Record<string, unknown> | null }): MenuBusinessMeta | null {
  const meta = menu.meta as { node?: string; module?: string } | undefined;
  if (meta && (meta.node || meta.module)) {
    return { node: meta.node, module: meta.module };
  }
  if (menu.path && menu.path.startsWith(KUAIZHIZAO_PATH_PREFIX)) {
    const segments = menu.path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment && PATH_SEGMENT_TO_BUSINESS[lastSegment]) {
      return PATH_SEGMENT_TO_BUSINESS[lastSegment];
    }
  }
  if (menu.name && GROUP_TITLE_TO_MODULE[menu.name]) {
    return { module: GROUP_TITLE_TO_MODULE[menu.name] };
  }
  return null;
}
