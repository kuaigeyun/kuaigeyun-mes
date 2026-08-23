/**
 * 平台更新日志（工作台版本卡展示）
 *
 * 完成一项修复/优化后，在此追加一条记录，并同步补充各语言 i18n 文案。
 *
 * 不计入：定制应用 HaoliGO（好力 GO）相关变动，仅在该应用内交付，不写本日志。
 */

import type { TFunction } from 'i18next';

export type PlatformUpdateType = 'feature' | 'improvement' | 'fix' | 'security';

export interface PlatformUpdateLogEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  type: PlatformUpdateType;
  titleKey: string;
  descriptionKey?: string;
}

/** 更新类型展示顺序（Modal 分组） */
export const PLATFORM_UPDATE_TYPE_ORDER: PlatformUpdateType[] = [
  'feature',
  'improvement',
  'fix',
  'security',
];

/**
 * 更新记录（新记录插在数组头部）
 * titleKey / descriptionKey 对应 pages.dashboard.updateLog.entries.{id}.*
 */
export const PLATFORM_UPDATE_LOG: PlatformUpdateLogEntry[] = [
  {
    id: 'production-return-hub-quantity-fix',
    date: '2026-08-24',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.production-return-hub-quantity-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-return-hub-quantity-fix.description',
  },
  {
    id: 'sop-create-attachments-payload-fix',
    date: '2026-08-24',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sop-create-attachments-payload-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sop-create-attachments-payload-fix.description',
  },
  {
    id: 'invoice-pull-tax-inclusive-rounding-fix',
    date: '2026-08-24',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.invoice-pull-tax-inclusive-rounding-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.invoice-pull-tax-inclusive-rounding-fix.description',
  },
  {
    id: 'invoice-pull-amount-field-grid-fix',
    date: '2026-08-24',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.invoice-pull-amount-field-grid-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.invoice-pull-amount-field-grid-fix.description',
  },
  {
    id: 'merge-settlement-code-batch-fix',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.merge-settlement-code-batch-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.merge-settlement-code-batch-fix.description',
  },
  {
    id: 'merge-voucher-bank-summary-fix',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.merge-voucher-bank-summary-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.merge-voucher-bank-summary-fix.description',
  },
  {
    id: 'merge-invoice-source-allocation-fix',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.merge-invoice-source-allocation-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.merge-invoice-source-allocation-fix.description',
  },
  {
    id: 'partner-statement-preview-line-selection',
    date: '2026-08-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.partner-statement-preview-line-selection.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.partner-statement-preview-line-selection.description',
  },
  {
    id: 'partner-statement-partial-reconciliation',
    date: '2026-08-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.partner-statement-partial-reconciliation.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.partner-statement-partial-reconciliation.description',
  },
  {
    id: 'document-reconciliation-gap-hierarchy',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.document-reconciliation-gap-hierarchy.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.document-reconciliation-gap-hierarchy.description',
  },
  {
    id: 'warehouse-doc-edit-withdraw-unify',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-doc-edit-withdraw-unify.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-doc-edit-withdraw-unify.description',
  },
  {
    id: 'quality-traceability-ui-polish',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.quality-traceability-ui-polish.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.quality-traceability-ui-polish.description',
  },
  {
    id: 'work-order-reporting-producer-card-sync',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-reporting-producer-card-sync.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-reporting-producer-card-sync.description',
  },
  {
    id: 'quality-inspection-inspector-sync',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quality-inspection-inspector-sync.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-inspection-inspector-sync.description',
  },
  {
    id: 'purchase-order-header-delivery-sync',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-header-delivery-sync.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-order-header-delivery-sync.description',
  },
  {
    id: 'purchase-order-delivery-date-from-requisition',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-delivery-date-from-requisition.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-order-delivery-date-from-requisition.description',
  },
  {
    id: 'purchase-price-auto-fill',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-price-auto-fill.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-price-auto-fill.description',
  },
  {
    id: 'rich-page-help-views',
    date: '2026-08-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.rich-page-help-views.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.rich-page-help-views.description',
  },
  {
    id: 'locale-pack-gap-sync',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.locale-pack-gap-sync.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.locale-pack-gap-sync.description',
  },
  {
    id: 'notification-high-value-scenes',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.notification-high-value-scenes.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.notification-high-value-scenes.description',
  },
  {
    id: 'read-path-performance-batch-two',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.read-path-performance-batch-two.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.read-path-performance-batch-two.description',
  },
  {
    id: 'work-order-list-query-performance',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-list-query-performance.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-list-query-performance.description',
  },
  {
    id: 'material-market-price-carry-forward-trend',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.material-market-price-carry-forward-trend.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.material-market-price-carry-forward-trend.description',
  },
  {
    id: 'material-batch-picker-group-descendants',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-batch-picker-group-descendants.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.material-batch-picker-group-descendants.description',
  },
  {
    id: 'bom-list-all-view-first-load',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-list-all-view-first-load.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.bom-list-all-view-first-load.description',
  },
  {
    id: 'numeric-precision-decimal-places-4',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.numeric-precision-decimal-places-4.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.numeric-precision-decimal-places-4.description',
  },
  {
    id: 'outsource-readiness-kitting-fix',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-readiness-kitting-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.outsource-readiness-kitting-fix.description',
  },
  {
    id: 'material-form-group-required-asterisk',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-form-group-required-asterisk.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.material-form-group-required-asterisk.description',
  },
  {
    id: 'material-group-tree-resizable',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.material-group-tree-resizable.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.material-group-tree-resizable.description',
  },
  {
    id: 'bom-list-export-detail',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-list-export-detail.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.bom-list-export-detail.description',
  },
  {
    id: 'inbound-hub-other-inbound-detail-qty',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-hub-other-inbound-detail-qty.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inbound-hub-other-inbound-detail-qty.description',
  },
  {
    id: 'last-operation-inbound-fqc-hints',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.last-operation-inbound-fqc-hints.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.last-operation-inbound-fqc-hints.description',
  },
  {
    id: 'document-form-page-bold-labels',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.document-form-page-bold-labels.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.document-form-page-bold-labels.description',
  },
  {
    id: 'global-select-dropdown-full-text',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.global-select-dropdown-full-text.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.global-select-dropdown-full-text.description',
  },
  {
    id: 'warehouse-pull-entry-form-ux',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-pull-entry-form-ux.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-pull-entry-form-ux.description',
  },
  {
    id: 'warehouse-list-print-toolbar-right',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-list-print-toolbar-right.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-list-print-toolbar-right.description',
  },
  {
    id: 'warehouse-hub-show-amount-toggle',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-hub-show-amount-toggle.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-hub-show-amount-toggle.description',
  },
  {
    id: 'warehouse-inbound-outbound-detail-reports',
    date: '2026-08-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-inbound-outbound-detail-reports.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-inbound-outbound-detail-reports.description',
  },
  {
    id: 'inspection-conduct-decimal-qty',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inspection-conduct-decimal-qty.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inspection-conduct-decimal-qty.description',
  },
  {
    id: 'reporting-correct-producer',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.reporting-correct-producer.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.reporting-correct-producer.description',
  },
  {
    id: 'reporting-correct-reported-at',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.reporting-correct-reported-at.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.reporting-correct-reported-at.description',
  },
  {
    id: 'mrp-dual-source-buy-priority',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-dual-source-buy-priority.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mrp-dual-source-buy-priority.description',
  },
  {
    id: 'work-order-list-scroll-preserve',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-list-scroll-preserve.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.work-order-list-scroll-preserve.description',
  },
  {
    id: 'purchase-arrival-warning',
    date: '2026-08-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-arrival-warning.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-arrival-warning.description',
  },
  {
    id: 'po-list-buyer-name',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.po-list-buyer-name.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.po-list-buyer-name.description',
  },
  {
    id: 'po-batch-push-receipt-notice',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.po-batch-push-receipt-notice.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.po-batch-push-receipt-notice.description',
  },
  {
    id: 'mrp-make-bom-route-gate',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-make-bom-route-gate.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mrp-make-bom-route-gate.description',
  },
  {
    id: 'mrp-inventory-netting-basis',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-inventory-netting-basis.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mrp-inventory-netting-basis.description',
  },
  {
    id: 'mrp-recompute-upstream-quantity',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-recompute-upstream-quantity.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mrp-recompute-upstream-quantity.description',
  },
  {
    id: 'order-line-price-trend',
    date: '2026-08-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.order-line-price-trend.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.order-line-price-trend.description',
  },
  {
    id: 'sales-order-attachment-carry',
    date: '2026-08-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-attachment-carry.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-attachment-carry.description',
  },
  {
    id: 'document-attachment-download',
    date: '2026-08-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.document-attachment-download.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.document-attachment-download.description',
  },
  {
    id: 'approval-workflow-todos',
    date: '2026-08-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.approval-workflow-todos.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.approval-workflow-todos.description',
  },
  {
    id: 'price-settlement',
    date: '2026-08-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.price-settlement.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.price-settlement.description',
  },
  {
    id: 'update-log-panel',
    date: '2026-08-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.update-log-panel.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.update-log-panel.description',
  },
  {
    id: 'workbench-calendar-weather-polish',
    date: '2026-08-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.workbench-calendar-weather-polish.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.workbench-calendar-weather-polish.description',
  },
];

export function getRecentPlatformUpdates(limit = 2): PlatformUpdateLogEntry[] {
  return PLATFORM_UPDATE_LOG.slice(0, limit);
}

export type PlatformUpdateTabKey = 'all' | PlatformUpdateType;

export function filterPlatformUpdates(
  tab: PlatformUpdateTabKey,
  entries: PlatformUpdateLogEntry[] = PLATFORM_UPDATE_LOG,
): PlatformUpdateLogEntry[] {
  if (tab === 'all') return entries;
  return entries.filter((entry) => entry.type === tab);
}

export function getAvailableUpdateLogTabs(
  entries: PlatformUpdateLogEntry[] = PLATFORM_UPDATE_LOG,
): PlatformUpdateTabKey[] {
  const tabs: PlatformUpdateTabKey[] = ['all'];
  for (const type of PLATFORM_UPDATE_TYPE_ORDER) {
    if (entries.some((entry) => entry.type === type)) {
      tabs.push(type);
    }
  }
  return tabs;
}

export interface PlatformUpdateDateGroup {
  date: string;
  entries: PlatformUpdateLogEntry[];
}

/** 按日期分组（保持原数组顺序，同一天只出现一组） */
export function groupPlatformUpdatesByDate(
  entries: PlatformUpdateLogEntry[],
): PlatformUpdateDateGroup[] {
  const groups: PlatformUpdateDateGroup[] = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (last?.date === entry.date) {
      last.entries.push(entry);
    } else {
      groups.push({ date: entry.date, entries: [entry] });
    }
  }
  return groups;
}

export function groupPlatformUpdatesByType(
  entries: PlatformUpdateLogEntry[] = PLATFORM_UPDATE_LOG,
): Partial<Record<PlatformUpdateType, PlatformUpdateLogEntry[]>> {
  const grouped: Partial<Record<PlatformUpdateType, PlatformUpdateLogEntry[]>> = {};
  for (const entry of entries) {
    if (!grouped[entry.type]) grouped[entry.type] = [];
    grouped[entry.type]!.push(entry);
  }
  return grouped;
}

export function resolveUpdateLogText(
  t: TFunction,
  key: string | undefined,
): string | undefined {
  if (!key) return undefined;
  const text = t(key);
  return text !== key ? text : undefined;
}

export function getUpdateTypeMarkerColor(type: PlatformUpdateType): string {
  switch (type) {
    case 'feature':
      return 'success';
    case 'improvement':
      return 'processing';
    case 'fix':
      return 'warning';
    case 'security':
      return 'error';
    default:
      return 'default';
  }
}
