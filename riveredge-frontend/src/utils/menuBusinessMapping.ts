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
  // 销售管理
  'sales-forecasts': { node: 'sales_forecast', module: 'sales' },
  'sales-orders': { node: 'sales_order', module: 'sales' },
  'sales-deliveries': { node: 'sales_delivery', module: 'sales' },
  'sales-returns': { module: 'sales' },
  // 采购管理
  'purchase-requisitions': { node: 'purchase_request', module: 'purchase' },
  'purchase-orders': { node: 'purchase_order', module: 'purchase' },
  'purchase-receipts': { node: 'inbound_delivery', module: 'purchase' },
  'purchase-returns': { module: 'purchase' },
  // 生产执行
  'work-orders': { node: 'work_order', module: 'production' },
  'reporting': { module: 'production' },
  'terminal': { module: 'production' },
  'statistics': { module: 'production' },
  'rework-orders': { module: 'production' },
  'outsource-management': { module: 'production' },
  'material-shortage-exceptions': { module: 'production' },
  'delivery-delay-exceptions': { module: 'production' },
  'quality-exceptions': { module: 'production' },
  'exception-process': { module: 'production' },
  'exception-statistics': { module: 'production' },
  // 质量管理
  'incoming-inspection': { node: 'quality_inspection', module: 'quality' },
  'process-inspection': { node: 'quality_inspection', module: 'quality' },
  'finished-goods-inspection': { node: 'quality_inspection', module: 'quality' },
  'traceability': { node: 'quality_inspection', module: 'quality' },
  // 仓储管理（按 module 即可）
  'inbound': { module: 'warehouse' },
  'customer-material-registration': { module: 'warehouse' },
  'outbound': { module: 'warehouse' },
  'line-side-warehouse': { module: 'warehouse' },
  'backflush-records': { module: 'warehouse' },
  'inventory': { module: 'warehouse' },
  'initial-data': { module: 'warehouse' },
  'barcode-mapping-rules': { module: 'warehouse' },
  'document-timing': { module: 'warehouse' },
  'document-efficiency': { module: 'warehouse' },
  'replenishment-suggestions': { module: 'warehouse' },
  // 成本 / 财务管理
  'cost-calculations': { module: 'finance' },
  'cost-comparison': { module: 'finance' },
  'receivables': { module: 'finance' },
  'sales-invoices': { module: 'finance' },
  'receipts': { module: 'finance' },
  'payables': { module: 'finance' },
  'purchase-invoices': { module: 'finance' },
  'payments': { module: 'finance' },
  'invoices': { module: 'finance' },
};

/** 父级分组 key -> module（用于无 path 的分组节点） */
const GROUP_TITLE_TO_MODULE: Record<string, string> = {
  'app.kuaizhizao.menu.sales-management': 'sales',
  'app.kuaizhizao.menu.purchase-management': 'purchase',
  'app.kuaizhizao.menu.production-execution': 'production',
  'app.kuaizhizao.menu.quality-management': 'quality',
  'app.kuaizhizao.menu.warehouse-management': 'warehouse',
  'app.kuaizhizao.menu.cost-management': 'finance',
  'app.kuaizhizao.menu.finance-management': 'finance',
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
