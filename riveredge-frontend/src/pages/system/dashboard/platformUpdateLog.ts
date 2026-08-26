/**
 * 平台更新日志（工作台版本卡展示）
 *
 * 完成一项修复/优化后，在此追加一条记录，并补充 zh-CN i18n 文案（默认仅简体中文，见 i18n-zh-cn-only 规则）。
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
    id: 'quotation-export-localized-columns',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quotation-export-localized-columns.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quotation-export-localized-columns.description',
  },
  {
    id: 'sales-dashboard-follow-up-kpi-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-dashboard-follow-up-kpi-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-dashboard-follow-up-kpi-fix.description',
  },
  {
    id: 'demand-computation-decimal-precision-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.demand-computation-decimal-precision-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.demand-computation-decimal-precision-fix.description',
  },
  {
    id: 'purchase-order-change-arrival-warning-fixes',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-change-arrival-warning-fixes.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-order-change-arrival-warning-fixes.description',
  },
  {
    id: 'incoming-inspection-posted-receipt-recheck',
    date: '2026-08-26',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.incoming-inspection-posted-receipt-recheck.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.incoming-inspection-posted-receipt-recheck.description',
  },
  {
    id: 'mrp-readiness-source-validation-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-readiness-source-validation-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.mrp-readiness-source-validation-fix.description',
  },
  {
    id: 'quotation-toolbar-push-capabilities-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quotation-toolbar-push-capabilities-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quotation-toolbar-push-capabilities-fix.description',
  },
  {
    id: 'work-order-draft-route-change-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-draft-route-change-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-draft-route-change-fix.description',
  },
  {
    id: 'product-process-route-improvements',
    date: '2026-08-26',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.product-process-route-improvements.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-process-route-improvements.description',
  },
  {
    id: 'work-order-readiness-rework-ui-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-readiness-rework-ui-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-readiness-rework-ui-fix.description',
  },
  {
    id: 'purchase-arrival-delay-change-flow-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-arrival-delay-change-flow-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-arrival-delay-change-flow-fix.description',
  },
  {
    id: 'report-advanced-search-period-filter-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.report-advanced-search-period-filter-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.report-advanced-search-period-filter-fix.description',
  },
  {
    id: 'payment-refund-prepayment-reverse-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.payment-refund-prepayment-reverse-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.payment-refund-prepayment-reverse-fix.description',
  },
  {
    id: 'receivable-receipt-button-draft-occupy-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.receivable-receipt-button-draft-occupy-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.receivable-receipt-button-draft-occupy-fix.description',
  },
  {
    id: 'partner-statement-generate-detail-crash-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.partner-statement-generate-detail-crash-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.partner-statement-generate-detail-crash-fix.description',
  },
  {
    id: 'finance-ar-ap-refund-execution-status',
    date: '2026-08-26',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.finance-ar-ap-refund-execution-status.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.finance-ar-ap-refund-execution-status.description',
  },
  {
    id: 'finance-voucher-posting-unify',
    date: '2026-08-26',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.finance-voucher-posting-unify.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.finance-voucher-posting-unify.description',
  },
  {
    id: 'partner-statement-preview-hierarchy-import-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.partner-statement-preview-hierarchy-import-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.partner-statement-preview-hierarchy-import-fix.description',
  },
  {
    id: 'prepayment-balance-from-ar-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.prepayment-balance-from-ar-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.prepayment-balance-from-ar-fix.description',
  },
  {
    id: 'finance-refund-partner-statement-links',
    date: '2026-08-25',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.finance-refund-partner-statement-links.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.finance-refund-partner-statement-links.description',
  },
  {
    id: 'finance-ar-ap-invoice-status-detail-unify',
    date: '2026-08-25',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.finance-ar-ap-invoice-status-detail-unify.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.finance-ar-ap-invoice-status-detail-unify.description',
  },
  {
    id: 'finance-voucher-refund-mirror',
    date: '2026-08-25',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.finance-voucher-refund-mirror.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.finance-voucher-refund-mirror.description',
  },
  {
    id: 'finance-note-bill-types-expand',
    date: '2026-08-25',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.finance-note-bill-types-expand.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.finance-note-bill-types-expand.description',
  },
  {
    id: 'receipt-payment-method-note-unify',
    date: '2026-08-25',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.receipt-payment-method-note-unify.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.receipt-payment-method-note-unify.description',
  },
  {
    id: 'sales-order-push-computation-demand-code-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-push-computation-demand-code-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-push-computation-demand-code-fix.description',
  },
  {
    id: 'receipt-payment-amount-decimal-input-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.receipt-payment-amount-decimal-input-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.receipt-payment-amount-decimal-input-fix.description',
  },
  {
    id: 'other-outbound-line-current-stock',
    date: '2026-08-25',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.other-outbound-line-current-stock.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.other-outbound-line-current-stock.description',
  },
  {
    id: 'purchase-arrival-impact-assembly-from-sales-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-arrival-impact-assembly-from-sales-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-arrival-impact-assembly-from-sales-fix.description',
  },
  {
    id: 'purchase-cost-order-trial-material-fields-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-cost-order-trial-material-fields-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-cost-order-trial-material-fields-fix.description',
  },
  {
    id: 'sales-order-reminder-user-list-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-reminder-user-list-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-reminder-user-list-fix.description',
  },
  {
    id: 'tenant-switch-connection-storm-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-switch-connection-storm-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.tenant-switch-connection-storm-fix.description',
  },
  {
    id: 'purchase-order-progress-arrival-warning-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-progress-arrival-warning-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-order-progress-arrival-warning-fix.description',
  },
  {
    id: 'purchase-center-overdue-receipt-feed-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-center-overdue-receipt-feed-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-center-overdue-receipt-feed-fix.description',
  },
  {
    id: 'advanced-search-column-filters-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.advanced-search-column-filters-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.advanced-search-column-filters-fix.description',
  },
  {
    id: 'document-detail-attachments-display-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.document-detail-attachments-display-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.document-detail-attachments-display-fix.description',
  },
  {
    id: 'rework-report-unqualified-writeback-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.rework-report-unqualified-writeback-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rework-report-unqualified-writeback-fix.description',
  },
  {
    id: 'inventory-ledger-movement-snapshot-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inventory-ledger-movement-snapshot-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inventory-ledger-movement-snapshot-fix.description',
  },
  {
    id: 'kitting-outsource-related-doc-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kitting-outsource-related-doc-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kitting-outsource-related-doc-fix.description',
  },
  {
    id: 'production-doc-data-scope-self-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.production-doc-data-scope-self-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-doc-data-scope-self-fix.description',
  },
  {
    id: 'spoke-wheel-concentricity-api-fix',
    date: '2026-08-25',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.spoke-wheel-concentricity-api-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.spoke-wheel-concentricity-api-fix.description',
  },
  {
    id: 'industry-pack-platform',
    date: '2026-08-25',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.industry-pack-platform.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.industry-pack-platform.description',
  },
  {
    id: 'mrp-execute-core-exceptions-import-fix',
    date: '2026-08-24',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-execute-core-exceptions-import-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.mrp-execute-core-exceptions-import-fix.description',
  },
  {
    id: 'purchase-price-trend-history-load-fix',
    date: '2026-08-24',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-price-trend-history-load-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-price-trend-history-load-fix.description',
  },
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
