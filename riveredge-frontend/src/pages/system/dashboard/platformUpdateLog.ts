/**
 * 平台更新日志（工作台版本卡展示）
 *
 * 完成一项用户可见的修复/优化/功能后，必须在本数组头部追加一条，并同步 zh-CN
 * `pages.dashboard.updateLog.entries.{id}.*`（默认仅简体中文，见 i18n-zh-cn-only）。
 * 同一会话内连续多项修复：每项做完即计入，勿攒到最后或漏记。
 *
 * 不计入：定制应用 HaoliGO（好力 GO）相关变动，仅在该应用内交付，不写本日志。
 */

import type { TFunction } from 'i18next';

export type PlatformUpdateType = 'major' | 'feature' | 'improvement' | 'fix' | 'security';

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
  'major',
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
    id: 'eight-d-unlock-edit-relock',
    date: '2026-09-01',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-unlock-edit-relock.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-unlock-edit-relock.description',
  },
  {
    id: 'eight-d-save-current-stage-only',
    date: '2026-09-01',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-save-current-stage-only.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-save-current-stage-only.description',
  },
  {
    id: 'eight-d-stage-html-blank-fix',
    date: '2026-09-01',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-stage-html-blank-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-stage-html-blank-fix.description',
  },
  {
    id: 'eight-d-stage-unlock-history',
    date: '2026-09-01',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-stage-unlock-history.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-stage-unlock-history.description',
  },
  {
    id: 'eight-d-stage-outline',
    date: '2026-09-01',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-stage-outline.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-stage-outline.description',
  },
  {
    id: 'delivery-workbench-progress-detail',
    date: '2026-09-01',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-progress-detail.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-progress-detail.description',
  },
  {
    id: 'project-workbench-overview-label',
    date: '2026-09-01',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.project-workbench-overview-label.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.project-workbench-overview-label.description',
  },
  {
    id: 'eight-d-workbench-overview',
    date: '2026-09-01',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-workbench-overview.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-workbench-overview.description',
  },
  {
    id: 'eight-d-list-edit-header',
    date: '2026-09-01',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-list-edit-header.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-list-edit-header.description',
  },
  {
    id: 'workbench-row-action-label',
    date: '2026-09-01',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.workbench-row-action-label.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.workbench-row-action-label.description',
  },
  {
    id: 'eight-d-workbench-header',
    date: '2026-09-01',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-workbench-header.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-workbench-header.description',
  },
  {
    id: 'project-workbench-shell-radius',
    date: '2026-09-01',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.project-workbench-shell-radius.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.project-workbench-shell-radius.description',
  },
  {
    id: 'project-workbench-toolbar',
    date: '2026-09-01',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.project-workbench-toolbar.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.project-workbench-toolbar.description',
  },
  {
    id: 'eight-d-stage-stepper',
    date: '2026-09-01',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-stage-stepper.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-stage-stepper.description',
  },
  {
    id: 'eight-d-history-transition',
    date: '2026-09-01',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-history-transition.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-history-transition.description',
  },
  {
    id: 'eight-d-workbench-print',
    date: '2026-08-31',
    type: 'major',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-workbench-print.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.eight-d-workbench-print.description',
  },
  {
    id: 'delivery-workbench-align-rd',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-align-rd.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-align-rd.description',
  },
  {
    id: 'delivery-workbench-no-full-chain',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-no-full-chain.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-no-full-chain.description',
  },
  {
    id: 'project-workbench-split-layout',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.project-workbench-split-layout.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.project-workbench-split-layout.description',
  },
  {
    id: 'rd-project-withdraw-not-executed',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.rd-project-withdraw-not-executed.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.rd-project-withdraw-not-executed.description',
  },
  {
    id: 'delivery-rd-project-workbench',
    date: '2026-08-31',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-rd-project-workbench.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-rd-project-workbench.description',
  },
  {
    id: 'kuaiplm-rd-projects-hide-material-col',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-rd-projects-hide-material-col.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-rd-projects-hide-material-col.description',
  },
  {
    id: 'kuaiplm-rd-projects-align-delivery',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-rd-projects-align-delivery.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-rd-projects-align-delivery.description',
  },
  {
    id: 'delivery-schedules-menu-rename',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-schedules-menu-rename.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-schedules-menu-rename.description',
  },
  {
    id: 'delivery-projects-column-order-v10',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-projects-column-order-v10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-projects-column-order-v10.description',
  },
  {
    id: 'delivery-merge-follow-up-into-projects',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-merge-follow-up-into-projects.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-merge-follow-up-into-projects.description',
  },
  {
    id: 'delivery-follow-up-node-progress-text',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-follow-up-node-progress-text.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-follow-up-node-progress-text.description',
  },
  {
    id: 'delivery-list-audit-columns',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-list-audit-columns.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-list-audit-columns.description',
  },
  {
    id: 'delivery-issue-badge-colors',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-issue-badge-colors.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-issue-badge-colors.description',
  },
  {
    id: 'delivery-issue-title-remainder-flex',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-issue-title-remainder-flex.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-issue-title-remainder-flex.description',
  },
  {
    id: 'delivery-status-tag-render-fix',
    date: '2026-08-31',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-status-tag-render-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-status-tag-render-fix.description',
  },
  {
    id: 'delivery-rd-project-tasks-members-v1',
    date: '2026-08-31',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-rd-project-tasks-members-v1.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-rd-project-tasks-members-v1.description',
  },
  {
    id: 'delivery-issue-list-layout-v1',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-issue-list-layout-v1.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-issue-list-layout-v1.description',
  },
  {
    id: 'delivery-progress-column-unify',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-progress-column-unify.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-progress-column-unify.description',
  },
  {
    id: 'delivery-list-batch-selection',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-list-batch-selection.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-list-batch-selection.description',
  },
  {
    id: 'delivery-dashboard-gantt',
    date: '2026-08-31',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-dashboard-gantt.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-dashboard-gantt.description',
  },
  {
    id: 'delivery-follow-up-node-progress-flex',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-follow-up-node-progress-flex.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-follow-up-node-progress-flex.description',
  },
  {
    id: 'delivery-project-list-layout-v1',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-list-layout-v1.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-project-list-layout-v1.description',
  },
  {
    id: 'delivery-project-backend-p1',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-backend-p1.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-project-backend-p1.description',
  },
  {
    id: 'delivery-project-deferred-scope',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-deferred-scope.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-project-deferred-scope.description',
  },
  {
    id: 'delivery-project-features-complete',
    date: '2026-08-31',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-features-complete.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-project-features-complete.description',
  },
  {
    id: 'delivery-project-install-boundary',
    date: '2026-08-31',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-install-boundary.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-project-install-boundary.description',
  },
  {
    id: 'delivery-project-documents-complete',
    date: '2026-08-31',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-documents-complete.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-project-documents-complete.description',
  },
  {
    id: 'delivery-project-form-modal-grid',
    date: '2026-08-31',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-form-modal-grid.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-project-form-modal-grid.description',
  },
  {
    id: 'two-column-layout-custom-pages-resizable',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.two-column-layout-custom-pages-resizable.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.two-column-layout-custom-pages-resizable.description',
  },
  {
    id: 'two-column-layout-resizable-default',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.two-column-layout-resizable-default.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.two-column-layout-resizable-default.description',
  },
  {
    id: 'kuaiplm-gate-templates-single-shell',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-gate-templates-single-shell.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-gate-templates-single-shell.description',
  },
  {
    id: 'kuaizhizao-delivery-process-template-stage-ui',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-process-template-stage-ui.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-process-template-stage-ui.description',
  },
  {
    id: 'kuaizhizao-delivery-project-deepening',
    date: '2026-08-31',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-project-deepening.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-project-deepening.description',
  },
  {
    id: 'kuaizhizao-delivery-process-template-layout',
    date: '2026-08-31',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-process-template-layout.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-process-template-layout.description',
  },
  {
    id: 'kuaizhizao-delivery-dashboard-layout',
    date: '2026-08-31',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-dashboard-layout.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-dashboard-layout.description',
  },
  {
    id: 'kuaizhizao-delivery-project-page-contract',
    date: '2026-08-31',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-project-page-contract.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-project-page-contract.description',
  },
  {
    id: 'app-sort-order-2xx-3xx-repair',
    date: '2026-08-31',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.app-sort-order-2xx-3xx-repair.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.app-sort-order-2xx-3xx-repair.description',
  },
  {
    id: 'kuaizhizao-delivery-project-menu',
    date: '2026-08-31',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-project-menu.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-delivery-project-menu.description',
  },
  {
    id: 'sync-mapping-add-more-fields',
    date: '2026-08-31',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.sync-mapping-add-more-fields.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sync-mapping-add-more-fields.description',
  },
  {
    id: 'start-menu-license-meta-tenant-admin-only',
    date: '2026-08-31',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.start-menu-license-meta-tenant-admin-only.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.start-menu-license-meta-tenant-admin-only.description',
  },
  {
    id: 'sync-freshness-hover-only',
    date: '2026-08-30',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sync-freshness-hover-only.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sync-freshness-hover-only.description',
  },
  {
    id: 'infra-official-api-library-toolbar-host',
    date: '2026-08-30',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.infra-official-api-library-toolbar-host.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.infra-official-api-library-toolbar-host.description',
  },
  {
    id: 'infra-official-api-library-status-segmented',
    date: '2026-08-30',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.infra-official-api-library-status-segmented.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.infra-official-api-library-status-segmented.description',
  },
  {
    id: 'infra-official-api-library-host-ui',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.infra-official-api-library-host-ui.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.infra-official-api-library-host-ui.description',
  },
  {
    id: 'infra-official-api-library-admin',
    date: '2026-08-30',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.infra-official-api-library-admin.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.infra-official-api-library-admin.description',
  },
  {
    id: 'sync-sales-order-write-batch-speed',
    date: '2026-08-30',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sync-sales-order-write-batch-speed.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-sales-order-write-batch-speed.description',
  },
  {
    id: 'sync-doc-prereq-stop-force-full',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sync-doc-prereq-stop-force-full.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-doc-prereq-stop-force-full.description',
  },
  {
    id: 'sync-sales-order-total-quantity-none-fix',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sync-sales-order-total-quantity-none-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-sales-order-total-quantity-none-fix.description',
  },
  {
    id: 'sync-material-group-empty-pull-fix',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sync-material-group-empty-pull-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-material-group-empty-pull-fix.description',
  },
  {
    id: 'sync-material-bulk-write',
    date: '2026-08-30',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sync-material-bulk-write.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sync-material-bulk-write.description',
  },
  {
    id: 'sync-material-prereq-full-not-incremental',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sync-material-prereq-full-not-incremental.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-material-prereq-full-not-incremental.description',
  },
  {
    id: 'sync-material-group-prereq-before-material',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sync-material-group-prereq-before-material.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-material-group-prereq-before-material.description',
  },
  {
    id: 'sync-active-only-switch',
    date: '2026-08-30',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sync-active-only-switch.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sync-active-only-switch.description',
  },
  {
    id: 'sync-customer-skip-invalid-kingdee',
    date: '2026-08-30',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sync-customer-skip-invalid-kingdee.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-customer-skip-invalid-kingdee.description',
  },
  {
    id: 'sync-progress-gzip-buffer-fix',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sync-progress-gzip-buffer-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-progress-gzip-buffer-fix.description',
  },
  {
    id: 'sync-live-progress-transaction-display',
    date: '2026-08-30',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sync-live-progress-transaction-display.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-live-progress-transaction-display.description',
  },
  {
    id: 'sync-kingdee-paginate-and-progress-stats',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sync-kingdee-paginate-and-progress-stats.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-kingdee-paginate-and-progress-stats.description',
  },
  {
    id: 'sync-prerequisite-incremental-fix',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sync-prerequisite-incremental-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-prerequisite-incremental-fix.description',
  },
  {
    id: 'sync-freshness-tooltip-overflow-fix',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sync-freshness-tooltip-overflow-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sync-freshness-tooltip-overflow-fix.description',
  },
  {
    id: 'tabs-persistence-logout-session-cache-fix',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tabs-persistence-logout-session-cache-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.tabs-persistence-logout-session-cache-fix.description',
  },
  {
    id: 'quality-exception-status-sync-on-nc-close-fix',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quality-exception-status-sync-on-nc-close-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-exception-status-sync-on-nc-close-fix.description',
  },
  {
    id: 'inventory-report-perf-pagination-fix',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inventory-report-perf-pagination-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inventory-report-perf-pagination-fix.description',
  },
  {
    id: 'custom-field-date-utc-off-by-one-fix',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.custom-field-date-utc-off-by-one-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.custom-field-date-utc-off-by-one-fix.description',
  },
  {
    id: 'custom-field-edit-after-unaudit-fix',
    date: '2026-08-30',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.custom-field-edit-after-unaudit-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.custom-field-edit-after-unaudit-fix.description',
  },
  {
    id: 'external-erp-sync-platform',
    date: '2026-08-30',
    type: 'major',
    titleKey: 'pages.dashboard.updateLog.entries.external-erp-sync-platform.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.external-erp-sync-platform.description',
  },
  {
    id: 'sales-invoice-red-letter-receivable',
    date: '2026-08-29',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-invoice-red-letter-receivable.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-invoice-red-letter-receivable.description',
  },
  {
    id: 'doc-reconcil-chain-nested-index-fix',
    date: '2026-08-29',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.doc-reconcil-chain-nested-index-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.doc-reconcil-chain-nested-index-fix.description',
  },
  {
    id: 'partner-statement-refund-under-ar',
    date: '2026-08-29',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.partner-statement-refund-under-ar.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.partner-statement-refund-under-ar.description',
  },
  {
    id: 'finance-multi-source-refund',
    date: '2026-08-29',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.finance-multi-source-refund.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.finance-multi-source-refund.description',
  },
  {
    id: 'nc-disposition-closed-loop',
    date: '2026-08-29',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.nc-disposition-closed-loop.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.nc-disposition-closed-loop.description',
  },
  {
    id: 'detail-drawer-attachment-center-tab',
    date: '2026-08-29',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.detail-drawer-attachment-center-tab.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.detail-drawer-attachment-center-tab.description',
  },
  {
    id: 'work-order-show-customer-name-param',
    date: '2026-08-29',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-show-customer-name-param.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-show-customer-name-param.description',
  },
  {
    id: 'wo-next-operation-in-app-notify',
    date: '2026-08-29',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.wo-next-operation-in-app-notify.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.wo-next-operation-in-app-notify.description',
  },
  {
    id: 'sales-order-lifecycle-audited-shows-dash-fix',
    date: '2026-08-29',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-lifecycle-audited-shows-dash-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-lifecycle-audited-shows-dash-fix.description',
  },
  {
    id: 'margin-report-cost-from-purchase-and-bom-fix',
    date: '2026-08-29',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.margin-report-cost-from-purchase-and-bom-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.margin-report-cost-from-purchase-and-bom-fix.description',
  },
  {
    id: 'purchase-overdue-warning-customer-feedback-fix',
    date: '2026-08-29',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-overdue-warning-customer-feedback-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-overdue-warning-customer-feedback-fix.description',
  },
  {
    id: 'sales-contract-print-rmb-uppercase',
    date: '2026-08-28',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-contract-print-rmb-uppercase.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-contract-print-rmb-uppercase.description',
  },
  {
    id: 'confidential-files-terminology',
    date: '2026-08-28',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.confidential-files-terminology.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.confidential-files-terminology.description',
  },
  {
    id: 'private-files-vault-and-company-seal',
    date: '2026-08-28',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.private-files-vault-and-company-seal.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.private-files-vault-and-company-seal.description',
  },
  {
    id: 'sales-order-framework-contract-merge',
    date: '2026-08-28',
    type: 'major',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-framework-contract-merge.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-framework-contract-merge.description',
  },
  {
    id: 'warehouse-allow-negative-inventory',
    date: '2026-08-28',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-allow-negative-inventory.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-allow-negative-inventory.description',
  },
  {
    id: 'mrp-dual-source-primary-and-net-cover',
    date: '2026-08-28',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-dual-source-primary-and-net-cover.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mrp-dual-source-primary-and-net-cover.description',
  },
  {
    id: 'mrp-process-route-resolve-priority',
    date: '2026-08-28',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-process-route-resolve-priority.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mrp-process-route-resolve-priority.description',
  },
  {
    id: 'sales-contract-amount-framework',
    date: '2026-08-28',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.sales-contract-amount-framework.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-contract-amount-framework.description',
  },
  {
    id: 'bom-create-version-unique-guard',
    date: '2026-08-28',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-create-version-unique-guard.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.bom-create-version-unique-guard.description',
  },
  {
    id: 'inspection-plan-copy-create',
    date: '2026-08-27',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.inspection-plan-copy-create.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inspection-plan-copy-create.description',
  },
  {
    id: 'fqc-linked-sales-order-detail-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fqc-linked-sales-order-detail-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.fqc-linked-sales-order-detail-fix.description',
  },
  {
    id: 'fqc-detail-customer-name-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fqc-detail-customer-name-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.fqc-detail-customer-name-fix.description',
  },
  {
    id: 'production-picking-decimal-overpick-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.production-picking-decimal-overpick-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-picking-decimal-overpick-fix.description',
  },
  {
    id: 'purchase-arrival-warning-and-change-display-fixes',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-arrival-warning-and-change-display-fixes.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-arrival-warning-and-change-display-fixes.description',
  },
  {
    id: 'inbound-detail-report-material-fields-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-detail-report-material-fields-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inbound-detail-report-material-fields-fix.description',
  },
  {
    id: 'batch-inventory-query-batch-no-display-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.batch-inventory-query-batch-no-display-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.batch-inventory-query-batch-no-display-fix.description',
  },
  {
    id: 'fqc-push-inbound-receipt',
    date: '2026-08-26',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.fqc-push-inbound-receipt.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fqc-push-inbound-receipt.description',
  },
  {
    id: 'last-operation-auto-inbound-fqc-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.last-operation-auto-inbound-fqc-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.last-operation-auto-inbound-fqc-fix.description',
  },
  {
    id: 'numeric-price-amount-precision-config-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.numeric-price-amount-precision-config-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.numeric-price-amount-precision-config-fix.description',
  },
  {
    id: 'numeric-quantity-precision-config-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.numeric-quantity-precision-config-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.numeric-quantity-precision-config-fix.description',
  },
  {
    id: 'material-call-push-production-picking-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-call-push-production-picking-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-call-push-production-picking-fix.description',
  },
  {
    id: 'outsource-work-order-received-qualified-only-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.outsource-work-order-received-qualified-only-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.outsource-work-order-received-qualified-only-fix.description',
  },
  {
    id: 'inbound-outsource-receipt-detail-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-outsource-receipt-detail-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inbound-outsource-receipt-detail-fix.description',
  },
  {
    id: 'work-order-kitting-related-doc-no-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-kitting-related-doc-no-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-kitting-related-doc-no-fix.description',
  },
  {
    id: 'inbound-outsource-receipt-amount-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-outsource-receipt-amount-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inbound-outsource-receipt-amount-fix.description',
  },
  {
    id: 'purchase-order-print-fields-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-print-fields-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-order-print-fields-fix.description',
  },
  {
    id: 'purchase-requisition-print',
    date: '2026-08-26',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-requisition-print.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-requisition-print.description',
  },
  {
    id: 'purchase-requisition-save-submit-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-requisition-save-submit-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-requisition-save-submit-fix.description',
  },
  {
    id: 'product-sales-ranking-report-fix',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.product-sales-ranking-report-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-sales-ranking-report-fix.description',
  },
  {
    id: 'sales-contract-print-chinese-labels',
    date: '2026-08-26',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-contract-print-chinese-labels.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-contract-print-chinese-labels.description',
  },
  {
    id: 'sales-contract-salesman-select',
    date: '2026-08-26',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-contract-salesman-select.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-contract-salesman-select.description',
  },
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
    case 'major':
      return 'purple';
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
