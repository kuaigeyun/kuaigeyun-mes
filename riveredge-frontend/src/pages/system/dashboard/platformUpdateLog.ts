/**
 * 平台更新日志（工作台版本卡展示）
 *
 * 完成一项用户可见的修复/优化/功能后，必须在本数组头部追加一条，并同步 zh-CN
 * `pages.dashboard.updateLog.entries.{id}.*`（默认仅简体中文，见 i18n-zh-cn-only）。
 * 同一会话内连续多项修复：每项做完即计入，勿攒到最后或漏记。
 *
 * 不计入：定制应用 HaoliGO（好力 GO）；DocToolkit / `.gen/docgen` 造数工具相关变动。
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
    id: 'tenant-path-entry-literal-r01',
    date: '2026-09-22',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-path-entry-literal-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.tenant-path-entry-literal-r01.description',
  },
  {
    id: 'domain-verify-txt-query-not-tenant-r02',
    date: '2026-09-22',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.domain-verify-txt-query-not-tenant-r02.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.domain-verify-txt-query-not-tenant-r02.description',
  },
  {
    id: 'domain-verify-txt-not-tenant-r01',
    date: '2026-09-22',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.domain-verify-txt-not-tenant-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.domain-verify-txt-not-tenant-r01.description',
  },
  {
    id: 'cost-calc-result-i18n-overhead-r01',
    date: '2026-09-22',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.cost-calc-result-i18n-overhead-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.cost-calc-result-i18n-overhead-r01.description',
  },
  {
    id: 'scheduling-card-border-scenario-r01',
    date: '2026-09-22',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.scheduling-card-border-scenario-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.scheduling-card-border-scenario-r01.description',
  },
  {
    id: 'scheduling-toolbar-settings-pin-order-r01',
    date: '2026-09-22',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.scheduling-toolbar-settings-pin-order-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.scheduling-toolbar-settings-pin-order-r01.description',
  },
  {
    id: 'scheduling-card-expand-label-r01',
    date: '2026-09-22',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.scheduling-card-expand-label-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.scheduling-card-expand-label-r01.description',
  },
  {
    id: 'serial-menu-icon-hash-rootfix-r01',
    date: '2026-09-22',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.serial-menu-icon-hash-rootfix-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.serial-menu-icon-hash-rootfix-r01.description',
  },
  {
    id: 'scheduling-card-lane-expand-global-r01',
    date: '2026-09-22',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.scheduling-card-lane-expand-global-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.scheduling-card-lane-expand-global-r01.description',
  },
  {
    id: 'scheduling-card-lane-expand-r01',
    date: '2026-09-22',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.scheduling-card-lane-expand-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.scheduling-card-lane-expand-r01.description',
  },
  {
    id: 'unitabs-navigate-in-render-r01',
    date: '2026-09-22',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.unitabs-navigate-in-render-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.unitabs-navigate-in-render-r01.description',
  },
  {
    id: 'serial-inventory-menu-icon-r01',
    date: '2026-09-22',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.serial-inventory-menu-icon-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.serial-inventory-menu-icon-r01.description',
  },
  {
    id: 'multi-tab-card-divider-dedupe-r01',
    date: '2026-09-22',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.multi-tab-card-divider-dedupe-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.multi-tab-card-divider-dedupe-r01.description',
  },
  {
    id: 'fai-drawing-under-attachments-r01',
    date: '2026-09-22',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fai-drawing-under-attachments-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.fai-drawing-under-attachments-r01.description',
  },
  {
    id: 'file-manager-hide-platform-folders-r01',
    date: '2026-09-22',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.file-manager-hide-platform-folders-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.file-manager-hide-platform-folders-r01.description',
  },
  {
    id: 'resource-category-tree-inline-actions-r01',
    date: '2026-09-22',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.resource-category-tree-inline-actions-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.resource-category-tree-inline-actions-r01.description',
  },
  {
    id: 'resource-category-tree-switcher-align-r01',
    date: '2026-09-22',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.resource-category-tree-switcher-align-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.resource-category-tree-switcher-align-r01.description',
  },
  {
    id: 'api-sync-direction-r01',
    date: '2026-09-22',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.api-sync-direction-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.api-sync-direction-r01.description',
  },
  {
    id: 'dedicated-oa-master-data-menus-r01',
    date: '2026-09-21',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.dedicated-oa-master-data-menus-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.dedicated-oa-master-data-menus-r01.description',
  },
  {
    id: 'project-proposal-funide-menu-route-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.project-proposal-funide-menu-route-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.project-proposal-funide-menu-route-r01.description',
  },
  {
    id: 'project-proposal-dedicated-split-r01',
    date: '2026-09-21',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.project-proposal-dedicated-split-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.project-proposal-dedicated-split-r01.description',
  },
  {
    id: 'project-proposal-template-fields-r01',
    date: '2026-09-21',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.project-proposal-template-fields-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.project-proposal-template-fields-r01.description',
  },
  {
    id: 'prototype-build-sheet-crud-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.prototype-build-sheet-crud-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.prototype-build-sheet-crud-r01.description',
  },
  {
    id: 'rd-archive-upload-attachment-i18n-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.rd-archive-upload-attachment-i18n-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rd-archive-upload-attachment-i18n-r01.description',
  },
  {
    id: 'kuaiplm-dashboard-gantt-gate-expand-r01',
    date: '2026-09-21',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-dashboard-gantt-gate-expand-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiplm-dashboard-gantt-gate-expand-r01.description',
  },
  {
    id: 'lab-request-remarks-i18n-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-remarks-i18n-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.lab-request-remarks-i18n-r01.description',
  },
  {
    id: 'lab-request-status-tag-trim-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-status-tag-trim-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.lab-request-status-tag-trim-r01.description',
  },
  {
    id: 'rd-project-system-archive-left-column-r01',
    date: '2026-09-21',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.rd-project-system-archive-left-column-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rd-project-system-archive-left-column-r01.description',
  },
  {
    id: 'rework-position-plan-template-list-uuid-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.rework-position-plan-template-list-uuid-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rework-position-plan-template-list-uuid-r01.description',
  },
  {
    id: 'kuaiplm-dashboard-pending-gates-live-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-dashboard-pending-gates-live-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiplm-dashboard-pending-gates-live-r01.description',
  },
  {
    id: 'funide-phase1-template-profile-r01',
    date: '2026-09-21',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-phase1-template-profile-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-phase1-template-profile-r01.description',
  },
  {
    id: 'uni-tabs-strip-placeholder-home-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-tabs-strip-placeholder-home-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.uni-tabs-strip-placeholder-home-r01.description',
  },
  {
    id: 'funide-rd-quality-2691-gap-r01',
    date: '2026-09-21',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-rd-quality-2691-gap-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.funide-rd-quality-2691-gap-r01.description',
  },
  {
    id: 'post-login-effective-home-no-flash-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.post-login-effective-home-no-flash-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.post-login-effective-home-no-flash-r01.description',
  },
  {
    id: 'uni-tabs-active-route-source-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-tabs-active-route-source-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.uni-tabs-active-route-source-r01.description',
  },
  {
    id: 'boot-watchdog-no-flicker-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.boot-watchdog-no-flicker-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.boot-watchdog-no-flicker-r01.description',
  },
  {
    id: 'uni-tabs-persistence-restore-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-tabs-persistence-restore-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.uni-tabs-persistence-restore-r01.description',
  },
  {
    id: 'uni-tabs-cloud-preference-r01',
    date: '2026-09-21',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-tabs-cloud-preference-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.uni-tabs-cloud-preference-r01.description',
  },
  {
    id: 'dedicated-shell-binding-scope-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.dedicated-shell-binding-scope-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.dedicated-shell-binding-scope-r01.description',
  },
  {
    id: 'dedicated-shell-menu-sync-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.dedicated-shell-menu-sync-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.dedicated-shell-menu-sync-r01.description',
  },
  {
    id: 'ind-prefix-migration-perm-dedupe-r02',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.ind-prefix-migration-perm-dedupe-r02.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.ind-prefix-migration-perm-dedupe-r02.description',
  },
  {
    id: 'app-code-rename-dedupe-r01',
    date: '2026-09-20',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.app-code-rename-dedupe-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.app-code-rename-dedupe-r01.description',
  },
  {
    id: 'app-center-industry-not-in-basic-r01',
    date: '2026-09-20',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.app-center-industry-not-in-basic-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.app-center-industry-not-in-basic-r01.description',
  },
  {
    id: 'official-api-library-configured-host-r01',
    date: '2026-09-20',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.official-api-library-configured-host-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.official-api-library-configured-host-r01.description',
  },
  {
    id: 'app-center-tab-order-application-layer-skill-r01',
    date: '2026-09-20',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.app-center-tab-order-application-layer-skill-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.app-center-tab-order-application-layer-skill-r01.description',
  },
  {
    id: 'ind-prefix-industry-app-codes-r01',
    date: '2026-09-20',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.ind-prefix-industry-app-codes-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.ind-prefix-industry-app-codes-r01.description',
  },
  {
    id: 'ind-mold-app-center-category-r01',
    date: '2026-09-20',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.ind-mold-app-center-category-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.ind-mold-app-center-category-r01.description',
  },
  {
    id: 'work-order-op-plan-time-expand-sync-r01',
    date: '2026-09-20',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-op-plan-time-expand-sync-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-op-plan-time-expand-sync-r01.description',
  },
  {
    id: 'warehouse-hub-document-date-business-r01',
    date: '2026-09-20',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-hub-document-date-business-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-hub-document-date-business-r01.description',
  },
  {
    id: 'repo-layer-deploy-custom-projects-r01',
    date: '2026-09-20',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.repo-layer-deploy-custom-projects-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.repo-layer-deploy-custom-projects-r01.description',
  },
  {
    id: 'dedicated-app-unbound-visible-r01',
    date: '2026-09-20',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.dedicated-app-unbound-visible-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.dedicated-app-unbound-visible-r01.description',
  },
  {
    id: 'dedicated-oa-bundle-menu-r01',
    date: '2026-09-20',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.dedicated-oa-bundle-menu-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.dedicated-oa-bundle-menu-r01.description',
  },
  {
    id: 'haolisales-requirement-gap-r03',
    date: '2026-09-20',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.haolisales-requirement-gap-r03.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.haolisales-requirement-gap-r03.description',
  },
  {
    id: 'application-layer-host-capabilities',
    date: '2026-09-20',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.application-layer-host-capabilities.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.application-layer-host-capabilities.description',
  },
  {
    id: 'haolisales-order-tracking-complete-r02',
    date: '2026-09-20',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.haolisales-order-tracking-complete-r02.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.haolisales-order-tracking-complete-r02.description',
  },
  {
    id: 'haolisales-dedicated-app-r01',
    date: '2026-09-20',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.haolisales-dedicated-app-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.haolisales-dedicated-app-r01.description',
  },
  {
    id: 'site-logo-round-crop-alpha-r01',
    date: '2026-09-20',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.site-logo-round-crop-alpha-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.site-logo-round-crop-alpha-r01.description',
  },
  {
    id: 'login-logs-map-auto-center-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.login-logs-map-auto-center-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-logs-map-auto-center-r01.description',
  },
  {
    id: 'login-logs-map-geo-accuracy-r01',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.login-logs-map-geo-accuracy-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-logs-map-geo-accuracy-r01.description',
  },
  {
    id: 'login-logs-map-initial-load-r01',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.login-logs-map-initial-load-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-logs-map-initial-load-r01.description',
  },
  {
    id: 'login-logs-map-city-cluster-r01',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.login-logs-map-city-cluster-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-logs-map-city-cluster-r01.description',
  },
  {
    id: 'login-logs-ip-geo-fallback-apis-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.login-logs-ip-geo-fallback-apis-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-logs-ip-geo-fallback-apis-r01.description',
  },
  {
    id: 'login-logs-world-map-viewport-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.login-logs-world-map-viewport-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-logs-world-map-viewport-r01.description',
  },
  {
    id: 'login-logs-world-map-geo-r01',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.login-logs-world-map-geo-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-logs-world-map-geo-r01.description',
  },
  {
    id: 'login-logs-ip-coords-write-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.login-logs-ip-coords-write-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-logs-ip-coords-write-r01.description',
  },
  {
    id: 'login-logs-world-map-r01',
    date: '2026-09-19',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.login-logs-world-map-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-logs-world-map-r01.description',
  },
  {
    id: 'outsource-issue-document-date-r01',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-issue-document-date-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.outsource-issue-document-date-r01.description',
  },
  {
    id: 'warehouse-doc-header-edit-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-doc-header-edit-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-doc-header-edit-r01.description',
  },
  {
    id: 'production-picking-document-date-r01',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.production-picking-document-date-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.production-picking-document-date-r01.description',
  },
  {
    id: 'work-order-planned-window-r01',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-planned-window-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.work-order-planned-window-r01.description',
  },
  {
    id: 'themed-segmented-toolbar-height-r01',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.themed-segmented-toolbar-height-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.themed-segmented-toolbar-height-r01.description',
  },
  {
    id: 'visual-scheduling-board-prefs-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-board-prefs-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-board-prefs-r01.description',
  },
  {
    id: 'visual-scheduling-card-view-r11',
    date: '2026-09-19',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r11.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r11.description',
  },
  {
    id: 'visual-scheduling-card-view-r10',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r10.description',
  },
  {
    id: 'visual-scheduling-card-view-r09',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r09.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r09.description',
  },
  {
    id: 'visual-scheduling-card-view-r08',
    date: '2026-09-19',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r08.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r08.description',
  },
  {
    id: 'visual-scheduling-card-view-r07',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r07.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r07.description',
  },
  {
    id: 'visual-scheduling-card-view-r06',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r06.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r06.description',
  },
  {
    id: 'visual-scheduling-card-view-r05',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r05.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r05.description',
  },
  {
    id: 'visual-scheduling-segmented-size-r01',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-segmented-size-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-segmented-size-r01.description',
  },
  {
    id: 'visual-scheduling-segmented-theme-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-segmented-theme-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-segmented-theme-r01.description',
  },
  {
    id: 'visual-scheduling-card-view-r04',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r04.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r04.description',
  },
  {
    id: 'visual-scheduling-ai-trigger-header-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-ai-trigger-header-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-ai-trigger-header-r01.description',
  },
  {
    id: 'visual-scheduling-load-table-hint-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-load-table-hint-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-load-table-hint-r01.description',
  },
  {
    id: 'visual-scheduling-card-view-r03',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r03.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r03.description',
  },
  {
    id: 'visual-scheduling-toolbar-layout-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-toolbar-layout-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-toolbar-layout-r01.description',
  },
  {
    id: 'visual-scheduling-card-view-r02',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r02.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r02.description',
  },
  {
    id: 'visual-scheduling-card-view-r01',
    date: '2026-09-19',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-card-view-r01.description',
  },
  {
    id: 'scheduling-muju-inspired-r01',
    date: '2026-09-19',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.scheduling-muju-inspired-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.scheduling-muju-inspired-r01.description',
  },
  {
    id: 'visual-scheduling-resource-filter-r01',
    date: '2026-09-19',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-resource-filter-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-resource-filter-r01.description',
  },
  {
    id: 'visual-scheduling-worker-label-r01',
    date: '2026-09-19',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-worker-label-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-worker-label-r01.description',
  },
  {
    id: 'visual-scheduling-resource-views-r01',
    date: '2026-09-19',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.visual-scheduling-resource-views-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.visual-scheduling-resource-views-r01.description',
  },
  {
    id: 'outsource-settlement-r02',
    date: '2026-09-19',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-settlement-r02.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.outsource-settlement-r02.description',
  },
  {
    id: 'outsource-settlement-r01',
    date: '2026-09-19',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-settlement-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.outsource-settlement-r01.description',
  },
  {
    id: 'role-users-add-remove-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.role-users-add-remove-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.role-users-add-remove-r01.description',
  },
  {
    id: 'sales-outbound-document-date-business-r02',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-outbound-document-date-business-r02.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-outbound-document-date-business-r02.description',
  },
  {
    id: 'gl-voucher-events-i18n-r02',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-events-i18n-r02.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-voucher-events-i18n-r02.description',
  },
  {
    id: 'warehouse-inventory-location-name-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-inventory-location-name-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-inventory-location-name-r01.description',
  },
  {
    id: 'gl-voucher-attachments-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-attachments-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-voucher-attachments-r01.description',
  },
  {
    id: 'gl-voucher-list-detail-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-list-detail-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-voucher-list-detail-r01.description',
  },
  {
    id: 'gl-books-balance-rollup-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-books-balance-rollup-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-books-balance-rollup-r01.description',
  },
  {
    id: 'sales-order-repush-after-delivery-delete-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-repush-after-delivery-delete-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-repush-after-delivery-delete-r01.description',
  },
  {
    id: 'sales-delivery-confirm-item-updates-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-delivery-confirm-item-updates-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-delivery-confirm-item-updates-r01.description',
  },
  {
    id: 'material-shortage-purchase-action-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-shortage-purchase-action-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.material-shortage-purchase-action-r01.description',
  },
  {
    id: 'timeconfig-extended-fields-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.timeconfig-extended-fields-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.timeconfig-extended-fields-r01.description',
  },
  {
    id: 'sales-tax-exclusive-price-anchor-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-tax-exclusive-price-anchor-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-tax-exclusive-price-anchor-r01.description',
  },
  {
    id: 'login-stale-default-home-tab-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.login-stale-default-home-tab-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-stale-default-home-tab-r01.description',
  },
  {
    id: 'sales-order-lifecycle-invoice-vs-receivable-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-lifecycle-invoice-vs-receivable-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-lifecycle-invoice-vs-receivable-r01.description',
  },
  {
    id: 'config-center-notification-search-layout-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.config-center-notification-search-layout-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.config-center-notification-search-layout-r01.description',
  },
  {
    id: 'sales-due-soon-and-wo-assign-notify-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.sales-due-soon-and-wo-assign-notify-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-due-soon-and-wo-assign-notify-r01.description',
  },
  {
    id: 'warehouse-batch-serial-ledger-menu-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-batch-serial-ledger-menu-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-batch-serial-ledger-menu-r01.description',
  },
  {
    id: 'traceability-serial-resolve-work-order-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.traceability-serial-resolve-work-order-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.traceability-serial-resolve-work-order-r01.description',
  },
  {
    id: 'work-order-split-push-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-split-push-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.work-order-split-push-r01.description',
  },
  {
    id: 'serial-generate-max-align-api-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.serial-generate-max-align-api-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.serial-generate-max-align-api-r01.description',
  },
  {
    id: 'receipt-notice-badge-after-inbound-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.receipt-notice-badge-after-inbound-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.receipt-notice-badge-after-inbound-r01.description',
  },
  {
    id: 'fqc-push-inbound-504-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fqc-push-inbound-504-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fqc-push-inbound-504-r01.description',
  },
  {
    id: 'process-inspection-quantity-decimals-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.process-inspection-quantity-decimals-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.process-inspection-quantity-decimals-r01.description',
  },
  {
    id: 'sales-order-term-group-picker-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-term-group-picker-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-term-group-picker-r01.description',
  },
  {
    id: 'inventory-transfer-material-snapshot-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inventory-transfer-material-snapshot-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inventory-transfer-material-snapshot-r01.description',
  },
  {
    id: 'gl-voucher-aux-partner-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-aux-partner-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-voucher-aux-partner-r01.description',
  },
  {
    id: 'mold-tool-doc-code-rules-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.mold-tool-doc-code-rules-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mold-tool-doc-code-rules-r01.description',
  },
  {
    id: 'equipment-doc-code-rules-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-doc-code-rules-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.equipment-doc-code-rules-r01.description',
  },
  {
    id: 'mold-trial-borrow-return-workflow-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mold-trial-borrow-return-workflow-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.mold-trial-borrow-return-workflow-r01.description',
  },
  {
    id: 'maintenance-execution-executor-picker-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.maintenance-execution-executor-picker-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.maintenance-execution-executor-picker-r01.description',
  },
  {
    id: 'warehouse-dashboard-pending-outbound-link-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-dashboard-pending-outbound-link-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-dashboard-pending-outbound-link-r01.description',
  },
  {
    id: 'sales-order-push-invoice-limit-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-push-invoice-limit-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-push-invoice-limit-r01.description',
  },
  {
    id: 'outsource-permission-modules-split-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-permission-modules-split-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.outsource-permission-modules-split-r01.description',
  },
  {
    id: 'dashboard-todo-deep-link-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.dashboard-todo-deep-link-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.dashboard-todo-deep-link-r01.description',
  },
  {
    id: 'dashboard-quality-kpi-blank-route-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.dashboard-quality-kpi-blank-route-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.dashboard-quality-kpi-blank-route-r01.description',
  },
  {
    id: 'mrp-push-preview-material-filter-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-push-preview-material-filter-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.mrp-push-preview-material-filter-r01.description',
  },
  {
    id: 'after-sales-ticket-push-sales-return-hang-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.after-sales-ticket-push-sales-return-hang-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.after-sales-ticket-push-sales-return-hang-r01.description',
  },
  {
    id: 'sales-order-export-headers-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-export-headers-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-export-headers-r01.description',
  },
  {
    id: 'after-sales-ticket-edit-items-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.after-sales-ticket-edit-items-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.after-sales-ticket-edit-items-r01.description',
  },
  {
    id: 'oa-announcement-datetime-tzinfo-fix-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.oa-announcement-datetime-tzinfo-fix-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.oa-announcement-datetime-tzinfo-fix-r01.description',
  },
  {
    id: 'after-sales-push-downstream-status-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.after-sales-push-downstream-status-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.after-sales-push-downstream-status-r01.description',
  },
  {
    id: 'drawing-folder-rename-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.drawing-folder-rename-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.drawing-folder-rename-r01.description',
  },
  {
    id: 'drawing-batch-upload-audit-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.drawing-batch-upload-audit-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.drawing-batch-upload-audit-r01.description',
  },
  {
    id: 'after-sales-spare-requisition-audit-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.after-sales-spare-requisition-audit-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.after-sales-spare-requisition-audit-r01.description',
  },
  {
    id: 'delivery-note-push-freight-order-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-note-push-freight-order-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-note-push-freight-order-r01.description',
  },
  {
    id: 'sales-outbound-push-delivery-notice-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.sales-outbound-push-delivery-notice-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-outbound-push-delivery-notice-r01.description',
  },
  {
    id: 'delivery-note-edit-blank-fix-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-note-edit-blank-fix-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-note-edit-blank-fix-r01.description',
  },
  {
    id: 'shift-roster-publish-fix-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.shift-roster-publish-fix-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.shift-roster-publish-fix-r01.description',
  },
  {
    id: 'po-push-change-order-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.po-push-change-order-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.po-push-change-order-r01.description',
  },
  {
    id: 'sales-order-change-delivery-date-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-change-delivery-date-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-change-delivery-date-r01.description',
  },
  {
    id: 'fqc-defect-scrap-accept-hint-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fqc-defect-scrap-accept-hint-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.fqc-defect-scrap-accept-hint-r01.description',
  },
  {
    id: 'defect-scrap-inbound-warehouse-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.defect-scrap-inbound-warehouse-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.defect-scrap-inbound-warehouse-r01.description',
  },
  {
    id: 'outbound-multi-batch-unified-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.outbound-multi-batch-unified-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.outbound-multi-batch-unified-r01.description',
  },
  {
    id: 'sales-outbound-multi-batch-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-outbound-multi-batch-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-outbound-multi-batch-r01.description',
  },
  {
    id: 'inspection-defect-multi-line-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.inspection-defect-multi-line-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inspection-defect-multi-line-r01.description',
  },
  {
    id: 'purchase-return-skip-fifo-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-skip-fifo-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-return-skip-fifo-r01.description',
  },
  {
    id: 'iqc-push-purchase-receipt-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.iqc-push-purchase-receipt-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.iqc-push-purchase-receipt-r01.description',
  },
  {
    id: 'outsource-issue-line-warehouse-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-issue-line-warehouse-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.outsource-issue-line-warehouse-r01.description',
  },
  {
    id: 'gl-cashier-auto-load-reconcile-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-cashier-auto-load-reconcile-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-cashier-auto-load-reconcile-r01.description',
  },
  {
    id: 'fa-depreciation-voucher-debit-credit-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fa-depreciation-voucher-debit-credit-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.fa-depreciation-voucher-debit-credit-r01.description',
  },
  {
    id: 'gl-transfer-template-edit-delete-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.gl-transfer-template-edit-delete-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-transfer-template-edit-delete-r01.description',
  },
  {
    id: 'gl-pl-close-via-current-year-profit-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-pl-close-via-current-year-profit-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-pl-close-via-current-year-profit-r01.description',
  },
  {
    id: 'material-over-qty-tolerance-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.material-over-qty-tolerance-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.material-over-qty-tolerance-r01.description',
  },
  {
    id: 'nc-defect-quarantine-stay-draft-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.nc-defect-quarantine-stay-draft-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.nc-defect-quarantine-stay-draft-r01.description',
  },
  {
    id: 'inbound-pull-from-qc-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-pull-from-qc-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inbound-pull-from-qc-r01.description',
  },
  {
    id: 'fa-depr-syd-uop-calc-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fa-depr-syd-uop-calc-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fa-depr-syd-uop-calc-r01.description',
  },
  {
    id: 'balance-sheet-child-accounts-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.balance-sheet-child-accounts-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.balance-sheet-child-accounts-r01.description',
  },
  {
    id: 'po-push-incoming-inspection-r01',
    date: '2026-09-18',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.po-push-incoming-inspection-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.po-push-incoming-inspection-r01.description',
  },
  {
    id: 'sales-outbound-document-date-display-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-outbound-document-date-display-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-outbound-document-date-display-r01.description',
  },
  {
    id: 'warehouse-hub-document-date-display-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-hub-document-date-display-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-hub-document-date-display-r01.description',
  },
  {
    id: 'gl-cash-flow-statement-amounts-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-cash-flow-statement-amounts-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-cash-flow-statement-amounts-r01.description',
  },
  {
    id: 'gl-voucher-account-show-non-leaf-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-account-show-non-leaf-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-voucher-account-show-non-leaf-r01.description',
  },
  {
    id: 'gl-event-voucher-aux-optional-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-event-voucher-aux-optional-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-event-voucher-aux-optional-r01.description',
  },
  {
    id: 'gl-voucher-events-source-type-label-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-events-source-type-label-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-voucher-events-source-type-label-r01.description',
  },
  {
    id: 'purchase-receipt-withdraw-cleanup-payable-r01',
    date: '2026-09-18',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.purchase-receipt-withdraw-cleanup-payable-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-receipt-withdraw-cleanup-payable-r01.description',
  },
  {
    id: 'picking-warehouse-select-stock-hint-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.picking-warehouse-select-stock-hint-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.picking-warehouse-select-stock-hint-r01.description',
  },
  {
    id: 'kuaioa-hr-basics-menu-group-r01',
    date: '2026-09-18',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-hr-basics-menu-group-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaioa-hr-basics-menu-group-r01.description',
  },
  {
    id: 'fqc-push-inbound-nested-tx-hang-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fqc-push-inbound-nested-tx-hang-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.fqc-push-inbound-nested-tx-hang-r01.description',
  },
  {
    id: 'fqc-created-notify-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.fqc-created-notify-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fqc-created-notify-r01.description',
  },
  {
    id: 'work-order-edit-operation-form-fill-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-edit-operation-form-fill-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-edit-operation-form-fill-r01.description',
  },
  {
    id: 'warehouse-hub-list-document-date-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-hub-list-document-date-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-hub-list-document-date-r01.description',
  },
  {
    id: 'inbound-hub-sort-updated-at-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-hub-sort-updated-at-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inbound-hub-sort-updated-at-r01.description',
  },
  {
    id: 'auto-reload-guard-reason-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.auto-reload-guard-reason-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.auto-reload-guard-reason-r01.description',
  },
  {
    id: 'measuring-instrument-calibration-edit-delete-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.measuring-instrument-calibration-edit-delete-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.measuring-instrument-calibration-edit-delete-r01.description',
  },
  {
    id: 'warehouse-inventory-location-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-inventory-location-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-inventory-location-r01.description',
  },
  {
    id: 'build-web-single-dist-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.build-web-single-dist-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.build-web-single-dist-r01.description',
  },
  {
    id: 'delivery-workbench-operation-column-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-operation-column-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-operation-column-r01.description',
  },
  {
    id: 'delivery-workbench-table-three-bucket-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-table-three-bucket-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-table-three-bucket-r01.description',
  },
  {
    id: 'delivery-node-report-detail-i18n-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-node-report-detail-i18n-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-node-report-detail-i18n-r01.description',
  },
  {
    id: 'delivery-workbench-recent-issue-actions-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-recent-issue-actions-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-recent-issue-actions-r01.description',
  },
  {
    id: 'delivery-workbench-recent-report-view-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-recent-report-view-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-recent-report-view-r01.description',
  },
  {
    id: 'delivery-node-task-core-task-textarea-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-node-task-core-task-textarea-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-node-task-core-task-textarea-r01.description',
  },
  {
    id: 'delivery-workbench-recent-report-actions-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-recent-report-actions-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-recent-report-actions-r01.description',
  },
  {
    id: 'delivery-workbench-related-attachments-uni-detail-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-related-attachments-uni-detail-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-workbench-related-attachments-uni-detail-r01.description',
  },
  {
    id: 'delivery-node-task-core-task-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-node-task-core-task-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-node-task-core-task-r01.description',
  },
  {
    id: 'delivery-workbench-related-attachments-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-related-attachments-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-related-attachments-r01.description',
  },
  {
    id: 'delivery-node-task-attachments-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-node-task-attachments-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-node-task-attachments-r01.description',
  },
  {
    id: 'delivery-linked-doc-status-zh-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-linked-doc-status-zh-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-linked-doc-status-zh-r01.description',
  },
  {
    id: 'delivery-linked-doc-progress-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-linked-doc-progress-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-linked-doc-progress-r01.description',
  },
  {
    id: 'delivery-linked-doc-code-copy-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-linked-doc-code-copy-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-linked-doc-code-copy-r01.description',
  },
  {
    id: 'delivery-linked-doc-type-nav-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-linked-doc-type-nav-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-linked-doc-type-nav-r01.description',
  },
  {
    id: 'delivery-workbench-hooks-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-hooks-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-hooks-r01.description',
  },
  {
    id: 'delivery-related-panel-slim-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-related-panel-slim-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-related-panel-slim-r01.description',
  },
  {
    id: 'delivery-linked-doc-columns-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-linked-doc-columns-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-linked-doc-columns-r01.description',
  },
  {
    id: 'delivery-node-schedule-revision-db-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-node-schedule-revision-db-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-node-schedule-revision-db-r01.description',
  },
  {
    id: 'delivery-workbench-scroll-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workbench-scroll-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workbench-scroll-r01.description',
  },
  {
    id: 'partner-fictional-names-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.partner-fictional-names-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.partner-fictional-names-r01.description',
  },
  {
    id: 'delivery-node-schedule-history-timeline-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-node-schedule-history-timeline-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-node-schedule-history-timeline-r01.description',
  },
  {
    id: 'delivery-node-document-create-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-node-document-create-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-node-document-create-r01.description',
  },
  {
    id: 'delivery-template-task-owner-members-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-template-task-owner-members-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-template-task-owner-members-r01.description',
  },
  {
    id: 'delivery-node-task-operate-split-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-node-task-operate-split-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-node-task-operate-split-r01.description',
  },
  {
    id: 'delivery-node-schedule-revision-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-node-schedule-revision-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-node-schedule-revision-r01.description',
  },
  {
    id: 'delivery-task-participant-mode-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-task-participant-mode-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-task-participant-mode-r01.description',
  },
  {
    id: 'delivery-product-model-duration-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-product-model-duration-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-product-model-duration-r01.description',
  },
  {
    id: 'delivery-spec-tier-generic-labels-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-spec-tier-generic-labels-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-spec-tier-generic-labels-r01.description',
  },
  {
    id: 'delivery-template-duration-rules-layout-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-template-duration-rules-layout-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-template-duration-rules-layout-r01.description',
  },
  {
    id: 'delivery-template-duration-rules-form-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-template-duration-rules-form-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-template-duration-rules-form-r01.description',
  },
  {
    id: 'delivery-procurement-parallel-schedule-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-procurement-parallel-schedule-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-procurement-parallel-schedule-r01.description',
  },
  {
    id: 'delivery-dashboard-gantt-view-mode-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-dashboard-gantt-view-mode-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-dashboard-gantt-view-mode-r01.description',
  },
  {
    id: 'delivery-dashboard-gantt-expand-height-r01',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-dashboard-gantt-expand-height-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-dashboard-gantt-expand-height-r01.description',
  },
  {
    id: 'delivery-dashboard-gantt-project-dimension-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-dashboard-gantt-project-dimension-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-dashboard-gantt-project-dimension-r01.description',
  },
  {
    id: 'delivery-project-list-sort-delivery-date-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-list-sort-delivery-date-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-project-list-sort-delivery-date-r01.description',
  },
  {
    id: 'uni-warehouse-select-reference-display',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-warehouse-select-reference-display.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.uni-warehouse-select-reference-display.description',
  },
  {
    id: 'delivery-demo-spec-tier-board-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-demo-spec-tier-board-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-demo-spec-tier-board-r01.description',
  },
  {
    id: 'delivery-workshop-board-drop-page-title-r01',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workshop-board-drop-page-title-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-workshop-board-drop-page-title-r01.description',
  },
  {
    id: 'delivery-phase2-sideline-duration-wo-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-phase2-sideline-duration-wo-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.delivery-phase2-sideline-duration-wo-r01.description',
  },
  {
    id: 'delivery-workshop-board-r01',
    date: '2026-09-17',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-workshop-board-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-workshop-board-r01.description',
  },
  {
    id: 'infra-packages-pagesize-le-100',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.infra-packages-pagesize-le-100.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.infra-packages-pagesize-le-100.description',
  },
  {
    id: 'production-files-hide-industry-checklist',
    date: '2026-09-17',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.production-files-hide-industry-checklist.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-files-hide-industry-checklist.description',
  },
  {
    id: 'kuaiplm-system-archive-created-by',
    date: '2026-09-17',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-system-archive-created-by.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-system-archive-created-by.description',
  },
  {
    id: 'rework-menu-restore-pack-menu-false',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.rework-menu-restore-pack-menu-false.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rework-menu-restore-pack-menu-false.description',
  },
  {
    id: 'prototype-build-sheet-audit-cols',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.prototype-build-sheet-audit-cols.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.prototype-build-sheet-audit-cols.description',
  },
  {
    id: 'bom-code-preview-wait-material',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-code-preview-wait-material.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.bom-code-preview-wait-material.description',
  },
  {
    id: 'bom-code-duplicate-preview-msg',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-code-duplicate-preview-msg.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.bom-code-duplicate-preview-msg.description',
  },
  {
    id: 'electronics-pack-menu-scope',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.electronics-pack-menu-scope.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.electronics-pack-menu-scope.description',
  },
  {
    id: 'kuaiplm-router-import-fix-r15',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-router-import-fix-r15.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-router-import-fix-r15.description',
  },
  {
    id: 'kuaioa-menu-hr-r01',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-menu-hr-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaioa-menu-hr-r01.description',
  },
  {
    id: 'kuaioa-hr-excel-remainder-r01',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-hr-excel-remainder-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaioa-hr-excel-remainder-r01.description',
  },
  {
    id: 'kuaioa-welfare-annual-r01',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-welfare-annual-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaioa-welfare-annual-r01.description',
  },
  {
    id: 'kuaioa-payroll-living-r01',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-payroll-living-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaioa-payroll-living-r01.description',
  },
  {
    id: 'it-admin-asset-lifecycle-r14',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.it-admin-asset-lifecycle-r14.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.it-admin-asset-lifecycle-r14.description',
  },
  {
    id: 'rd-project-archive-phase-r10',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.rd-project-archive-phase-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.rd-project-archive-phase-r10.description',
  },
  {
    id: 'prototype-build-sheet-r10',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.prototype-build-sheet-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.prototype-build-sheet-r10.description',
  },
  {
    id: 'kuaioa-attendance-monthly-r01',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-attendance-monthly-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaioa-attendance-monthly-r01.description',
  },
  {
    id: 'kuaioa-employee-profile-r01',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-employee-profile-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaioa-employee-profile-r01.description',
  },
  {
    id: 'structure-trial-flow-13step-r09',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.structure-trial-flow-13step-r09.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.structure-trial-flow-13step-r09.description',
  },
  {
    id: 'structure-form-approval-8h-r09',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.structure-form-approval-8h-r09.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.structure-form-approval-8h-r09.description',
  },
  {
    id: 'rd-deliverable-approval-24h-r31',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.rd-deliverable-approval-24h-r31.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rd-deliverable-approval-24h-r31.description',
  },
  {
    id: 'hr-schedule-split-menu-r01',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.hr-schedule-split-menu-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.hr-schedule-split-menu-r01.description',
  },
  {
    id: 'ecn-doc-template-change-kind-r08',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.ecn-doc-template-change-kind-r08.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.ecn-doc-template-change-kind-r08.description',
  },
  {
    id: 'lab-request-outsource-price-r64',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-outsource-price-r64.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.lab-request-outsource-price-r64.description',
  },
  {
    id: 'rework-material-required-at-r11',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.rework-material-required-at-r11.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.rework-material-required-at-r11.description',
  },
  {
    id: 'ecn-closed-notification-r04',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.ecn-closed-notification-r04.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.ecn-closed-notification-r04.description',
  },
  {
    id: 'training-approval-flow-r12',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.training-approval-flow-r12.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.training-approval-flow-r12.description',
  },
  {
    id: 'qc-sop-domain-r01-55',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.qc-sop-domain-r01-55.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.qc-sop-domain-r01-55.description',
  },
  {
    id: 'annual-lab-plan-next-month-reminder-r07',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.annual-lab-plan-next-month-reminder-r07.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.annual-lab-plan-next-month-reminder-r07.description',
  },
  {
    id: 'rd-project-system-archive-r01-70',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.rd-project-system-archive-r01-70.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rd-project-system-archive-r01-70.description',
  },
  {
    id: 'training-plan-annual-distributed-notify',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.training-plan-annual-distributed-notify.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.training-plan-annual-distributed-notify.description',
  },
  {
    id: 'phase2-acceptance-verify-script',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.phase2-acceptance-verify-script.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.phase2-acceptance-verify-script.description',
  },
  {
    id: 'phase2-training-plan-supplier-schedule-guides',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.phase2-training-plan-supplier-schedule-guides.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.phase2-training-plan-supplier-schedule-guides.description',
  },
  {
    id: 'phase2-annual-audit-production-checklist',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.phase2-annual-audit-production-checklist.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.phase2-annual-audit-production-checklist.description',
  },
  {
    id: 'phase2-calibration-license-stubs',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.phase2-calibration-license-stubs.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.phase2-calibration-license-stubs.description',
  },
  {
    id: 'phase2-training-license-industry-seeds',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.phase2-training-license-industry-seeds.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.phase2-training-license-industry-seeds.description',
  },
  {
    id: 'phase2-industry-seeds-production-daily-supplier-eval',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.phase2-industry-seeds-production-daily-supplier-eval.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.phase2-industry-seeds-production-daily-supplier-eval.description',
  },
  {
    id: 'phase1-acceptance-partial-product-line-ecn-validation',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.phase1-acceptance-partial-product-line-ecn-validation.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.phase1-acceptance-partial-product-line-ecn-validation.description',
  },
  {
    id: 'uni-im-open-chat-scroll-bottom',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-open-chat-scroll-bottom.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-open-chat-scroll-bottom.description',
  },
  {
    id: 'uni-im-direct-peer-title',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-direct-peer-title.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-direct-peer-title.description',
  },
  {
    id: 'uni-im-react-hooks-300',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-react-hooks-300.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-react-hooks-300.description',
  },
  {
    id: 'uni-im-pin-icon-right',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-pin-icon-right.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-pin-icon-right.description',
  },
  {
    id: 'uni-im-realtime-refresh',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-realtime-refresh.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-realtime-refresh.description',
  },
  {
    id: 'uni-im-ai-reply-markdown',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-ai-reply-markdown.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-ai-reply-markdown.description',
  },
  {
    id: 'uni-im-print-modal-zindex-stack',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-print-modal-zindex-stack.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-print-modal-zindex-stack.description',
  },
  {
    id: 'uni-im-conversation-pin',
    date: '2026-09-16',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-conversation-pin.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-conversation-pin.description',
  },
  {
    id: 'uni-im-doc-detail-drawer-left',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-doc-detail-drawer-left.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-doc-detail-drawer-left.description',
  },
  {
    id: 'uni-im-notify-list-icon-colors',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-notify-list-icon-colors.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-notify-list-icon-colors.description',
  },
  {
    id: 'uni-im-list-avatar-32',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-list-avatar-32.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-list-avatar-32.description',
  },
  {
    id: 'uni-im-window-max-half-viewport',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-window-max-half-viewport.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-window-max-half-viewport.description',
  },
  {
    id: 'uni-im-nav-contrast-theme-pill',
    date: '2026-09-16',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-nav-contrast-theme-pill.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-nav-contrast-theme-pill.description',
  },
  {
    id: 'uni-im-nav-active-token-primary',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-nav-active-token-primary.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-nav-active-token-primary.description',
  },
  {
    id: 'uni-im-approval-inbox-split',
    date: '2026-09-16',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-approval-inbox-split.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-approval-inbox-split.description',
  },
  {
    id: 'uni-im-group-chat',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-group-chat.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-group-chat.description',
  },
  {
    id: 'guest-login-ban-message',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.guest-login-ban-message.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.guest-login-ban-message.description',
  },
  {
    id: 'uni-im-peer-avatar-fetch',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-peer-avatar-fetch.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-peer-avatar-fetch.description',
  },
  {
    id: 'uni-im-list-title-time-only',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-list-title-time-only.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-list-title-time-only.description',
  },
  {
    id: 'uni-im-nav-active-theme-color',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-nav-active-theme-color.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-nav-active-theme-color.description',
  },
  {
    id: 'uni-im-remind-cn-hour',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-remind-cn-hour.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-remind-cn-hour.description',
  },
  {
    id: 'uni-im-remind-message-plain',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-remind-message-plain.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-remind-message-plain.description',
  },
  {
    id: 'uni-im-remind-modal-fields',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-remind-modal-fields.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-remind-modal-fields.description',
  },
  {
    id: 'uni-im-remind-modal-zindex',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-remind-modal-zindex.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-remind-modal-zindex.description',
  },
  {
    id: 'float-fab-im-feedback-swap',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.float-fab-im-feedback-swap.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.float-fab-im-feedback-swap.description',
  },
  {
    id: 'uni-im-doc-code-link',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-doc-code-link.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-doc-code-link.description',
  },
  {
    id: 'uni-im-time-link-remind',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-time-link-remind.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-time-link-remind.description',
  },
  {
    id: 'uni-im-bubble-side-icons',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-bubble-side-icons.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-bubble-side-icons.description',
  },
  {
    id: 'uni-im-minimize-fab',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-minimize-fab.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-minimize-fab.description',
  },
  {
    id: 'uni-im-auto-remind-from-time-text',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-auto-remind-from-time-text.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-auto-remind-from-time-text.description',
  },
  {
    id: 'uni-im-bubble-actions-recall',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-bubble-actions-recall.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-bubble-actions-recall.description',
  },
  {
    id: 'uni-im-nav-real-frosted-glass',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-nav-real-frosted-glass.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-nav-real-frosted-glass.description',
  },
  {
    id: 'uni-im-todo-reminder',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-todo-reminder.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-todo-reminder.description',
  },
  {
    id: 'uni-im-open-chat-perf',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-open-chat-perf.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-open-chat-perf.description',
  },
  {
    id: 'uni-im-nav-opacity-align-settings',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-nav-opacity-align-settings.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-nav-opacity-align-settings.description',
  },
  {
    id: 'uni-im-resize-col2-col3-only',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-resize-col2-col3-only.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-resize-col2-col3-only.description',
  },
  {
    id: 'uni-im-resize-handle-overlay',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-resize-handle-overlay.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-resize-handle-overlay.description',
  },
  {
    id: 'uni-im-window-expand-left',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-window-expand-left.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-window-expand-left.description',
  },
  {
    id: 'uni-im-nav-frost-backdrop-fix',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-nav-frost-backdrop-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-nav-frost-backdrop-fix.description',
  },
  {
    id: 'uni-im-nav-rail-resize',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-nav-rail-resize.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-nav-rail-resize.description',
  },
  {
    id: 'uni-im-nav-dark-frost',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-nav-dark-frost.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-nav-dark-frost.description',
  },
  {
    id: 'uni-im-direct-unread-sort',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-direct-unread-sort.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-direct-unread-sort.description',
  },
  {
    id: 'uni-im-kuai-inline-chat',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-kuai-inline-chat.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-kuai-inline-chat.description',
  },
  {
    id: 'uni-im-kuai-list-avatar-header-fit',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-kuai-list-avatar-header-fit.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-kuai-list-avatar-header-fit.description',
  },
  {
    id: 'uni-im-kuai-list-avatar-size',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-kuai-list-avatar-size.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-kuai-list-avatar-size.description',
  },
  {
    id: 'uni-im-kuai-lottie-avatar',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-kuai-lottie-avatar.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-kuai-lottie-avatar.description',
  },
  {
    id: 'uni-im-chat-avatar-sender-fix',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-chat-avatar-sender-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-chat-avatar-sender-fix.description',
  },
  {
    id: 'uni-im-message-order-fix',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-message-order-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-message-order-fix.description',
  },
  {
    id: 'uni-im-avatar-circle',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-avatar-circle.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-avatar-circle.description',
  },
  {
    id: 'uni-im-direct-contact-recent-sort',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-direct-contact-recent-sort.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-direct-contact-recent-sort.description',
  },
  {
    id: 'uni-im-list-pane-resize-no-ticks',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-list-pane-resize-no-ticks.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-list-pane-resize-no-ticks.description',
  },
  {
    id: 'uni-im-list-pane-resize',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-list-pane-resize.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-list-pane-resize.description',
  },
  {
    id: 'uni-im-direct-kuai-users',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-direct-kuai-users.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-direct-kuai-users.description',
  },
  {
    id: 'uni-im-nav-user-avatar',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-nav-user-avatar.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-nav-user-avatar.description',
  },
  {
    id: 'uni-im-nav-frost-labels',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-nav-frost-labels.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-nav-frost-labels.description',
  },
  {
    id: 'uni-im-merge-notification-bell',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-merge-notification-bell.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-merge-notification-bell.description',
  },
  {
    id: 'uni-im-wechat-three-column',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-wechat-three-column.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-wechat-three-column.description',
  },
  {
    id: 'uni-im-header-entry',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-header-entry.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-header-entry.description',
  },
  {
    id: 'header-mobile-qr-balance',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.header-mobile-qr-balance.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.header-mobile-qr-balance.description',
  },
  {
    id: 'uni-im-kuai-panel-style',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-kuai-panel-style.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-kuai-panel-style.description',
  },
  {
    id: 'header-mobile-miniprogram-merge',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.header-mobile-miniprogram-merge.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.header-mobile-miniprogram-merge.description',
  },
  {
    id: 'uni-im-wechat-dock-modal',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-im-wechat-dock-modal.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-im-wechat-dock-modal.description',
  },
  {
    id: 'prometheus-http-metrics',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.prometheus-http-metrics.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.prometheus-http-metrics.description',
  },
  {
    id: 'pdf-playwright-single-stack',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.pdf-playwright-single-stack.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.pdf-playwright-single-stack.description',
  },
  {
    id: 'realtime-legacy-ws-collapse',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.realtime-legacy-ws-collapse.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.realtime-legacy-ws-collapse.description',
  },
  {
    id: 'realtime-socketio-in-process',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.realtime-socketio-in-process.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.realtime-socketio-in-process.description',
  },
  {
    id: 'realtime-centrifugo-im-p0',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.realtime-centrifugo-im-p0.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.realtime-centrifugo-im-p0.description',
  },
  {
    id: 'mobile-server-settings-copy-plain',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.mobile-server-settings-copy-plain.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.mobile-server-settings-copy-plain.description',
  },
  {
    id: 'sales-order-approve-approval-status-nameerror',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-approve-approval-status-nameerror.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-approve-approval-status-nameerror.description',
  },
  {
    id: 'tenant-plan-pro-apps-gate-by-tier',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-plan-pro-apps-gate-by-tier.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.tenant-plan-pro-apps-gate-by-tier.description',
  },
  {
    id: 'package-edit-change-plan',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.package-edit-change-plan.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.package-edit-change-plan.description',
  },
  {
    id: 'numeric-display-format-contract-sweep',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.numeric-display-format-contract-sweep.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.numeric-display-format-contract-sweep.description',
  },
  {
    id: 'sales-order-detail-qty-formatQuantity',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-detail-qty-formatQuantity.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-detail-qty-formatQuantity.description',
  },
  {
    id: 'sales-review-status-converted',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-review-status-converted.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-review-status-converted.description',
  },
  {
    id: 'variant-attr-enum-value-quick-add',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.variant-attr-enum-value-quick-add.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.variant-attr-enum-value-quick-add.description',
  },
  {
    id: 'material-batch-serial-rule-quick-add',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.material-batch-serial-rule-quick-add.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-batch-serial-rule-quick-add.description',
  },
  {
    id: 'material-inspection-plan-quick-add',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.material-inspection-plan-quick-add.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-inspection-plan-quick-add.description',
  },
  {
    id: 'inspection-plan-step-modal-zindex-nested',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inspection-plan-step-modal-zindex-nested.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inspection-plan-step-modal-zindex-nested.description',
  },
  {
    id: 'process-route-inspection-plan-quick-add',
    date: '2026-09-15',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.process-route-inspection-plan-quick-add.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.process-route-inspection-plan-quick-add.description',
  },
  {
    id: 'inline-marker-tag-preview-shared',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.inline-marker-tag-preview-shared.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inline-marker-tag-preview-shared.description',
  },
  {
    id: 'inspection-plan-steps-tag-font-size',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.inspection-plan-steps-tag-font-size.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inspection-plan-steps-tag-font-size.description',
  },
  {
    id: 'bom-draft-delete-more-menu-confirm',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-draft-delete-more-menu-confirm.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.bom-draft-delete-more-menu-confirm.description',
  },
  {
    id: 'bom-version-switch-local-rebuild',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-version-switch-local-rebuild.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.bom-version-switch-local-rebuild.description',
  },
  {
    id: 'bom-list-hide-redundant-unit-column',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.bom-list-hide-redundant-unit-column.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.bom-list-hide-redundant-unit-column.description',
  },
  {
    id: 'bom-version-history-badge-gap',
    date: '2026-09-15',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-version-history-badge-gap.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.bom-version-history-badge-gap.description',
  },
  {
    id: 'bom-list-material-source-column',
    date: '2026-09-15',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.bom-list-material-source-column.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.bom-list-material-source-column.description',
  },
  {
    id: 'equipment-spot-check-docno-collision-fix',
    date: '2026-09-14',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-spot-check-docno-collision-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.equipment-spot-check-docno-collision-fix.description',
  },
  {
    id: 'units-load-preset-from-materials',
    date: '2026-09-14',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.units-load-preset-from-materials.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.units-load-preset-from-materials.description',
  },
  {
    id: 'units-load-preset-after-create',
    date: '2026-09-14',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.units-load-preset-after-create.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.units-load-preset-after-create.description',
  },
  {
    id: 'phase1-field-deepening-wrap-up',
    date: '2026-09-14',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.phase1-field-deepening-wrap-up.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.phase1-field-deepening-wrap-up.description',
  },
  {
    id: 'industry-form-profile-gate-and-bom-collab-lines',
    date: '2026-09-14',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.industry-form-profile-gate-and-bom-collab-lines.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.industry-form-profile-gate-and-bom-collab-lines.description',
  },
  {
    id: 'industry-pack-extension-menu-aggregation',
    date: '2026-09-14',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.industry-pack-extension-menu-aggregation.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.industry-pack-extension-menu-aggregation.description',
  },
  {
    id: 'rework-order-form-profile-dynamic-fields',
    date: '2026-09-14',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.rework-order-form-profile-dynamic-fields.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rework-order-form-profile-dynamic-fields.description',
  },
  {
    id: 'trial-flow-form-profile-dynamic-fields',
    date: '2026-09-14',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.trial-flow-form-profile-dynamic-fields.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.trial-flow-form-profile-dynamic-fields.description',
  },
  {
    id: 'ecn-form-profile-dynamic-columns',
    date: '2026-09-14',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.ecn-form-profile-dynamic-columns.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.ecn-form-profile-dynamic-columns.description',
  },
  {
    id: 'ind-electronics-ecn-trial-rework-profiles',
    date: '2026-09-14',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.ind-electronics-ecn-trial-rework-profiles.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.ind-electronics-ecn-trial-rework-profiles.description',
  },
  {
    id: 'inbound-hub-lifecycle-received-harden',
    date: '2026-09-14',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-hub-lifecycle-received-harden.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inbound-hub-lifecycle-received-harden.description',
  },
  {
    id: 'outbound-hub-purchase-return-lifecycle-done-key',
    date: '2026-09-14',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.outbound-hub-purchase-return-lifecycle-done-key.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.outbound-hub-purchase-return-lifecycle-done-key.description',
  },
  {
    id: 'equipment-ledger-null-nature-exclude-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-ledger-null-nature-exclude-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.equipment-ledger-null-nature-exclude-fix.description',
  },
  {
    id: 'menu-icon-pascal-lucide-resolve',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-icon-pascal-lucide-resolve.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-icon-pascal-lucide-resolve.description',
  },
  {
    id: 'menu-sync-preserve-app-active-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-sync-preserve-app-active-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-sync-preserve-app-active-fix.description',
  },
  {
    id: 'work-order-outsource-qty-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-outsource-qty-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.work-order-outsource-qty-fix.description',
  },
  {
    id: 'purchase-return-confirm-unit-price-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-confirm-unit-price-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-return-confirm-unit-price-fix.description',
  },
  {
    id: 'finance-note-create-date-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.finance-note-create-date-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.finance-note-create-date-fix.description',
  },
  {
    id: 'sales-invoice-receivable-offset-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-invoice-receivable-offset-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-invoice-receivable-offset-fix.description',
  },
  {
    id: 'purchase-return-pushed-qty-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-pushed-qty-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-return-pushed-qty-fix.description',
  },
  {
    id: 'fa-depr-detail-report-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fa-depr-detail-report-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fa-depr-detail-report-fix.description',
  },
  {
    id: 'fa-period-close-voucher-post',
    date: '2026-09-13',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.fa-period-close-voucher-post.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fa-period-close-voucher-post.description',
  },
  {
    id: 'fa-monthly-depr-after-impairment',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fa-monthly-depr-after-impairment.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fa-monthly-depr-after-impairment.description',
  },
  {
    id: 'fa-impairment-voucher-template',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fa-impairment-voucher-template.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fa-impairment-voucher-template.description',
  },
  {
    id: 'fa-depreciation-methods-expand',
    date: '2026-09-13',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.fa-depreciation-methods-expand.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fa-depreciation-methods-expand.description',
  },
  {
    id: 'gl-books-detail-ledger-load',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-books-detail-ledger-load.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-books-detail-ledger-load.description',
  },
  {
    id: 'reporting-defect-create-quarantine-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.reporting-defect-create-quarantine-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.reporting-defect-create-quarantine-fix.description',
  },
  {
    id: 'gl-voucher-delete-cancelled',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-delete-cancelled.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-voucher-delete-cancelled.description',
  },
  {
    id: 'defect-accept-typed-inbound-receipt',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.defect-accept-typed-inbound-receipt.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.defect-accept-typed-inbound-receipt.description',
  },
  {
    id: 'defect-accept-inbound-and-fqc-preview-qty',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.defect-accept-inbound-and-fqc-preview-qty.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.defect-accept-inbound-and-fqc-preview-qty.description',
  },
  {
    id: 'outsource-receipt-qty-sync-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-receipt-qty-sync-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.outsource-receipt-qty-sync-fix.description',
  },
  {
    id: 'warehouse-inventory-value-multi-unit',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-inventory-value-multi-unit.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-inventory-value-multi-unit.description',
  },
  {
    id: 'sales-order-menu-badge-delivery-status',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-menu-badge-delivery-status.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-menu-badge-delivery-status.description',
  },
  {
    id: 'equipment-create-code-preview-fix',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-create-code-preview-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.equipment-create-code-preview-fix.description',
  },
  {
    id: 'work-order-planned-end-delivery-anchor',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-planned-end-delivery-anchor.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-planned-end-delivery-anchor.description',
  },
  {
    id: 'sales-order-line-unit-display',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-line-unit-display.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-line-unit-display.description',
  },
  {
    id: 'cost-calculation-guide-zh-labels',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.cost-calculation-guide-zh-labels.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.cost-calculation-guide-zh-labels.description',
  },
  {
    id: 'cost-calculation-readiness-guide',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.cost-calculation-readiness-guide.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.cost-calculation-readiness-guide.description',
  },
  {
    id: 'uni-report-default-page-size-preference',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-report-default-page-size-preference.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.uni-report-default-page-size-preference.description',
  },
  {
    id: 'inventory-alert-scheduled-cron-timezone',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inventory-alert-scheduled-cron-timezone.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inventory-alert-scheduled-cron-timezone.description',
  },
  {
    id: 'approval-auto-pass-sync-batch',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.approval-auto-pass-sync-batch.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.approval-auto-pass-sync-batch.description',
  },
  {
    id: 'sales-delivery-approval-auto-pass-sync',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-delivery-approval-auto-pass-sync.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-delivery-approval-auto-pass-sync.description',
  },
  {
    id: 'sales-delivery-edit-batch-select',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-delivery-edit-batch-select.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-delivery-edit-batch-select.description',
  },
  {
    id: 'inventory-transfer-edit-form-hydration',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inventory-transfer-edit-form-hydration.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inventory-transfer-edit-form-hydration.description',
  },
  {
    id: 'fg-receipt-withdraw-inventory-summary',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fg-receipt-withdraw-inventory-summary.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fg-receipt-withdraw-inventory-summary.description',
  },
  {
    id: 'bom-pick-issue-method-kitting-align',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-pick-issue-method-kitting-align.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.bom-pick-issue-method-kitting-align.description',
  },
  {
    id: 'purchase-order-repush-receipt-after-return',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-repush-receipt-after-return.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-order-repush-receipt-after-return.description',
  },
  {
    id: 'purchase-return-outbound-hub-visibility',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-outbound-hub-visibility.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-return-outbound-hub-visibility.description',
  },
  {
    id: 'purchase-return-po-pull-material-columns',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-po-pull-material-columns.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-return-po-pull-material-columns.description',
  },
  {
    id: 'uni-report-search-filters',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-report-search-filters.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-report-search-filters.description',
  },
  {
    id: 'uni-report-no-stat-cards',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-report-no-stat-cards.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-report-no-stat-cards.description',
  },
  {
    id: 'warehouse-report-pagination-double-slice',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-report-pagination-double-slice.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-report-pagination-double-slice.description',
  },
  {
    id: 'module-center-shortcut-monochrome',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.module-center-shortcut-monochrome.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.module-center-shortcut-monochrome.description',
  },
  {
    id: 'module-center-masonry-drop-balanced',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.module-center-masonry-drop-balanced.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.module-center-masonry-drop-balanced.description',
  },
  {
    id: 'module-center-masonry-declaration-order-pack',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.module-center-masonry-declaration-order-pack.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.module-center-masonry-declaration-order-pack.description',
  },
  {
    id: 'module-center-masonry-card-order',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.module-center-masonry-card-order.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.module-center-masonry-card-order.description',
  },
  {
    id: 'module-center-masonry-always-show',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.module-center-masonry-always-show.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.module-center-masonry-always-show.description',
  },
  {
    id: 'outsource-center-kpi-masonry',
    date: '2026-09-13',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-center-kpi-masonry.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.outsource-center-kpi-masonry.description',
  },
  {
    id: 'quick-entry-message-app-context',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quick-entry-message-app-context.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.quick-entry-message-app-context.description',
  },
  {
    id: 'sidebar-icon-file-text-catalog',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sidebar-icon-file-text-catalog.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sidebar-icon-file-text-catalog.description',
  },
  {
    id: 'quick-entry-drop-stale-menu',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quick-entry-drop-stale-menu.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.quick-entry-drop-stale-menu.description',
  },
  {
    id: 'menu-sync-prompt-scan-merged',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.menu-sync-prompt-scan-merged.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-sync-prompt-scan-merged.description',
  },
  {
    id: 'menu-sync-prompt-bottom-right',
    date: '2026-09-13',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.menu-sync-prompt-bottom-right.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-sync-prompt-bottom-right.description',
  },
  {
    id: 'menu-sync-status-route-order',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-sync-status-route-order.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-sync-status-route-order.description',
  },
  {
    id: 'menu-sync-consent-modal',
    date: '2026-09-13',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-sync-consent-modal.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-sync-consent-modal.description',
  },
  {
    id: 'menu-sync-prompt-top-banner',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-sync-prompt-top-banner.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-sync-prompt-top-banner.description',
  },
  {
    id: 'menu-sync-prompt-guest-admin',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-sync-prompt-guest-admin.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-sync-prompt-guest-admin.description',
  },
  {
    id: 'menu-orphan-repair-on-sync',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-orphan-repair-on-sync.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-orphan-repair-on-sync.description',
  },
  {
    id: 'menu-disable-preserve-hierarchy',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-disable-preserve-hierarchy.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-disable-preserve-hierarchy.description',
  },
  {
    id: 'menu-sync-prompt-on-login',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.menu-sync-prompt-on-login.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-sync-prompt-on-login.description',
  },
  {
    id: 'custom-menu-layout-persist-on-rename',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.custom-menu-layout-persist-on-rename.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.custom-menu-layout-persist-on-rename.description',
  },
  {
    id: 'production-hub-menu-label-align',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.production-hub-menu-label-align.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.production-hub-menu-label-align.description',
  },
  {
    id: 'module-hub-pull-menu-scope',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.module-hub-pull-menu-scope.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.module-hub-pull-menu-scope.description',
  },
  {
    id: 'module-hub-scoped-type-filter',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.module-hub-scoped-type-filter.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.module-hub-scoped-type-filter.description',
  },
  {
    id: 'material-center-useeffect-import',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-center-useeffect-import.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.material-center-useeffect-import.description',
  },
  {
    id: 'module-menu-business-flow-order',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.module-menu-business-flow-order.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.module-menu-business-flow-order.description',
  },
  {
    id: 'outsource-menu-icon-order',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-menu-icon-order.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.outsource-menu-icon-order.description',
  },
  {
    id: 'page-soft-refresh-no-flash',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.page-soft-refresh-no-flash.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.page-soft-refresh-no-flash.description',
  },
  {
    id: 'outsource-module-hub-material-center',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-module-hub-material-center.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.outsource-module-hub-material-center.description',
  },
  {
    id: 'purchase-return-push-qty-map',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-push-qty-map.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-return-push-qty-map.description',
  },
  {
    id: 'inventory-transfer-edit-batch-warehouse-filter',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.inventory-transfer-edit-batch-warehouse-filter.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inventory-transfer-edit-batch-warehouse-filter.description',
  },
  {
    id: 'menu-admin-disabled-hierarchy',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-admin-disabled-hierarchy.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-admin-disabled-hierarchy.description',
  },
  {
    id: 'sales-order-approval-callback-sync',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-approval-callback-sync.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-approval-callback-sync.description',
  },
  {
    id: 'sales-delivery-edit-batch-picker',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-delivery-edit-batch-picker.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-delivery-edit-batch-picker.description',
  },
  {
    id: 'outsource-issue-outbound-lifecycle',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-issue-outbound-lifecycle.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.outsource-issue-outbound-lifecycle.description',
  },
  {
    id: 'outsource-material-issue-operator',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-material-issue-operator.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.outsource-material-issue-operator.description',
  },
  {
    id: 'sales-return-refund-gl-event',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-return-refund-gl-event.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-return-refund-gl-event.description',
  },
  {
    id: 'outsource-issue-manual-lines',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.outsource-issue-manual-lines.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.outsource-issue-manual-lines.description',
  },
  {
    id: 'fa-asset-depreciation-per-card',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.fa-asset-depreciation-per-card.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fa-asset-depreciation-per-card.description',
  },
  {
    id: 'fa-asset-form-full-fields',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.fa-asset-form-full-fields.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fa-asset-form-full-fields.description',
  },
  {
    id: 'fa-asset-import-template',
    date: '2026-09-12',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.fa-asset-import-template.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fa-asset-import-template.description',
  },
  {
    id: 'gl-balance-cashflow-excel-template',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.gl-balance-cashflow-excel-template.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-balance-cashflow-excel-template.description',
  },
  {
    id: 'gl-voucher-reorganize',
    date: '2026-09-12',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-reorganize.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-voucher-reorganize.description',
  },
  {
    id: 'gl-voucher-draft-delete',
    date: '2026-09-12',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-draft-delete.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-voucher-draft-delete.description',
  },
  {
    id: 'purchase-order-milestone-created-by-column',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-milestone-created-by-column.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-order-milestone-created-by-column.description',
  },
  {
    id: 'gl-coa-cost-accounts-gap-fix',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-coa-cost-accounts-gap-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-coa-cost-accounts-gap-fix.description',
  },
  {
    id: 'gl-chart-of-accounts-multi-level',
    date: '2026-09-12',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.gl-chart-of-accounts-multi-level.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-chart-of-accounts-multi-level.description',
  },
  {
    id: 'tenant-expires-at-enforcement',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-expires-at-enforcement.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.tenant-expires-at-enforcement.description',
  },
  {
    id: 'custom-document-date-off-by-one-backfill',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.custom-document-date-off-by-one-backfill.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.custom-document-date-off-by-one-backfill.description',
  },
  {
    id: 'measuring-instrument-precision-measurement-range',
    date: '2026-09-12',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.measuring-instrument-precision-measurement-range.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.measuring-instrument-precision-measurement-range.description',
  },
  {
    id: 'equipment-card-batch-print-n-squared-pages',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-card-batch-print-n-squared-pages.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.equipment-card-batch-print-n-squared-pages.description',
  },
  {
    id: 'spot-check-numeric-range-judgment-enforce',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.spot-check-numeric-range-judgment-enforce.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.spot-check-numeric-range-judgment-enforce.description',
  },
  {
    id: 'spot-check-scan-auto-load-bound-scheme-lines',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.spot-check-scan-auto-load-bound-scheme-lines.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.spot-check-scan-auto-load-bound-scheme-lines.description',
  },
  {
    id: 'equipment-create-modal-code-rule-preview',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-create-modal-code-rule-preview.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.equipment-create-modal-code-rule-preview.description',
  },
  {
    id: 'tenant-effective-home-redirect-from-default-home',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-effective-home-redirect-from-default-home.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.tenant-effective-home-redirect-from-default-home.description',
  },
  {
    id: 'equipment-dashboard-fault-link-blank-page',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-dashboard-fault-link-blank-page.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.equipment-dashboard-fault-link-blank-page.description',
  },
  {
    id: 'spot-check-numeric-value-type-mobile-input',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.spot-check-numeric-value-type-mobile-input.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.spot-check-numeric-value-type-mobile-input.description',
  },
  {
    id: 'inspection-item-boolean-hide-numeric-fields',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inspection-item-boolean-hide-numeric-fields.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inspection-item-boolean-hide-numeric-fields.description',
  },
  {
    id: 'equipment-responsible-person-user-picker-full-list',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-responsible-person-user-picker-full-list.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.equipment-responsible-person-user-picker-full-list.description',
  },
  {
    id: 'equipment-status-update-attachments-persist',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-status-update-attachments-persist.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.equipment-status-update-attachments-persist.description',
  },
  {
    id: 'equipment-ledger-default-code-sort',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-ledger-default-code-sort.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.equipment-ledger-default-code-sort.description',
  },
  {
    id: 'equipment-calibration-reminder-advance-days-config',
    date: '2026-09-12',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-calibration-reminder-advance-days-config.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.equipment-calibration-reminder-advance-days-config.description',
  },
  {
    id: 'measuring-instrument-calibration-modal-layout',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.measuring-instrument-calibration-modal-layout.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.measuring-instrument-calibration-modal-layout.description',
  },
  {
    id: 'measuring-instrument-calibration-list-layout',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.measuring-instrument-calibration-list-layout.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.measuring-instrument-calibration-list-layout.description',
  },
  {
    id: 'measuring-instruments-ledger-toolbar-layout',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.measuring-instruments-ledger-toolbar-layout.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.measuring-instruments-ledger-toolbar-layout.description',
  },
  {
    id: 'measuring-instruments-ledger-import-fix',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.measuring-instruments-ledger-import-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.measuring-instruments-ledger-import-fix.description',
  },
  {
    id: 'measuring-instrument-calibration-list-ux',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.measuring-instrument-calibration-list-ux.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.measuring-instrument-calibration-list-ux.description',
  },
  {
    id: 'measuring-instruments-menu-docs-reports',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.measuring-instruments-menu-docs-reports.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.measuring-instruments-menu-docs-reports.description',
  },
  {
    id: 'measuring-instruments-ledger',
    date: '2026-09-12',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.measuring-instruments-ledger.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.measuring-instruments-ledger.description',
  },
  {
    id: 'module-chart-mount-masonry-offset-fix',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.module-chart-mount-masonry-offset-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.module-chart-mount-masonry-offset-fix.description',
  },
  {
    id: 'equipment-ledger-responsible-spot-check-person',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-ledger-responsible-spot-check-person.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.equipment-ledger-responsible-spot-check-person.description',
  },
  {
    id: 'demand-plan-delete-capability-return-row-select',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.demand-plan-delete-capability-return-row-select.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.demand-plan-delete-capability-return-row-select.description',
  },
  {
    id: 'sales-order-return-delete-gate-batch-v2',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-return-delete-gate-batch-v2.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-return-delete-gate-batch-v2.description',
  },
  {
    id: 'document-delete-gate-downstream-capabilities',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.document-delete-gate-downstream-capabilities.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.document-delete-gate-downstream-capabilities.description',
  },
  {
    id: 'purchase-requisition-delete-block-when-po-linked',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-requisition-delete-block-when-po-linked.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-requisition-delete-block-when-po-linked.description',
  },
  {
    id: 'warehouse-dashboard-stock-value-unified-v2',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-dashboard-stock-value-unified-v2.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-dashboard-stock-value-unified-v2.description',
  },
  {
    id: 'purchase-order-push-require-supplier',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-push-require-supplier.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-order-push-require-supplier.description',
  },
  {
    id: 'order-milestone-delivery-billing-merge',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.order-milestone-delivery-billing-merge.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.order-milestone-delivery-billing-merge.description',
  },
  {
    id: 'purchase-order-basic-info-align-sales',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-basic-info-align-sales.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-order-basic-info-align-sales.description',
  },
  {
    id: 'order-payment-milestones-sync',
    date: '2026-09-12',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.order-payment-milestones-sync.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.order-payment-milestones-sync.description',
  },
  {
    id: 'sales-review-dept-opinions-tabs',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-review-dept-opinions-tabs.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-review-dept-opinions-tabs.description',
  },
  {
    id: 'gl-income-statement-excel-template',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.gl-income-statement-excel-template.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-income-statement-excel-template.description',
  },
  {
    id: 'gl-voucher-event-update-date',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-event-update-date.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-voucher-event-update-date.description',
  },
  {
    id: 'gl-voucher-events-source-type-filter',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-events-source-type-filter.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-voucher-events-source-type-filter.description',
  },
  {
    id: 'gl-voucher-generate-from-events-select',
    date: '2026-09-12',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-generate-from-events-select.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.gl-voucher-generate-from-events-select.description',
  },
  {
    id: 'sales-order-push-wo-planned-end',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-push-wo-planned-end.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-push-wo-planned-end.description',
  },
  {
    id: 'quality-inspection-revoke-keep-plan',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quality-inspection-revoke-keep-plan.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-inspection-revoke-keep-plan.description',
  },
  {
    id: 'quotation-push-sales-order-unit',
    date: '2026-09-12',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quotation-push-sales-order-unit.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quotation-push-sales-order-unit.description',
  },
  {
    id: 'maintenance-spare-part-inventory-deduct',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.maintenance-spare-part-inventory-deduct.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.maintenance-spare-part-inventory-deduct.description',
  },
  {
    id: 'work-order-cost-picking-status-fix',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-cost-picking-status-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-cost-picking-status-fix.description',
  },
  {
    id: 'sales-order-push-wo-inventory-columns',
    date: '2026-09-11',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-push-wo-inventory-columns.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-push-wo-inventory-columns.description',
  },
  {
    id: 'sales-order-push-work-order-inventory',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-push-work-order-inventory.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-push-work-order-inventory.description',
  },
  {
    id: 'config-center-scheduled-tasks',
    date: '2026-09-11',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.config-center-scheduled-tasks.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.config-center-scheduled-tasks.description',
  },
  {
    id: 'inventory-alert-auto-schedule',
    date: '2026-09-11',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.inventory-alert-auto-schedule.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inventory-alert-auto-schedule.description',
  },
  {
    id: 'sales-delivery-approval-status-sync',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-delivery-approval-status-sync.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-delivery-approval-status-sync.description',
  },
  {
    id: 'inventory-transfer-warehouse-name-list',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inventory-transfer-warehouse-name-list.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inventory-transfer-warehouse-name-list.description',
  },
  {
    id: 'kuaicaiwu-remove-management-analysis',
    date: '2026-09-11',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaicaiwu-remove-management-analysis.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaicaiwu-remove-management-analysis.description',
  },
  {
    id: 'report-menu-order-and-labels',
    date: '2026-09-11',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.report-menu-order-and-labels.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.report-menu-order-and-labels.description',
  },
  {
    id: 'fa-depr-report-columns',
    date: '2026-09-11',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.fa-depr-report-columns.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.fa-depr-report-columns.description',
  },
  {
    id: 'report-template-unification',
    date: '2026-09-11',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.report-template-unification.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.report-template-unification.description',
  },
  {
    id: 'kuaicaiwu-fixed-assets-list-toolbar',
    date: '2026-09-11',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaicaiwu-fixed-assets-list-toolbar.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaicaiwu-fixed-assets-list-toolbar.description',
  },
  {
    id: 'kuaicaiwu-fixed-assets-module',
    date: '2026-09-11',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaicaiwu-fixed-assets-module.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaicaiwu-fixed-assets-module.description',
  },
  {
    id: 'production-return-delete-list-filter',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.production-return-delete-list-filter.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-return-delete-list-filter.description',
  },
  {
    id: 'inbound-confirm-operator-date',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-confirm-operator-date.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inbound-confirm-operator-date.description',
  },
  {
    id: 'sales-delivery-confirm-operator-date',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-delivery-confirm-operator-date.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-delivery-confirm-operator-date.description',
  },
  {
    id: 'warehouse-hub-quantity-unit-display',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-hub-quantity-unit-display.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-hub-quantity-unit-display.description',
  },
  {
    id: 'work-order-split-code-suffix-import',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-split-code-suffix-import.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-split-code-suffix-import.description',
  },
  {
    id: 'work-order-op-start-inspection-mode',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-op-start-inspection-mode.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-op-start-inspection-mode.description',
  },
  {
    id: 'sales-return-confirm-red-receivable',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-return-confirm-red-receivable.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-return-confirm-red-receivable.description',
  },
  {
    id: 'sales-order-push-return-partial-qty',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-push-return-partial-qty.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-push-return-partial-qty.description',
  },
  {
    id: 'partner-statement-preview-page2-select',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.partner-statement-preview-page2-select.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.partner-statement-preview-page2-select.description',
  },
  {
    id: 'receivable-sales-return-offset-refund-display',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.receivable-sales-return-offset-refund-display.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.receivable-sales-return-offset-refund-display.description',
  },
  {
    id: 'partner-statement-return-offset-hierarchy',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.partner-statement-return-offset-hierarchy.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.partner-statement-return-offset-hierarchy.description',
  },
  {
    id: 'payable-refund-offset-marker-display',
    date: '2026-09-11',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.payable-refund-offset-marker-display.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.payable-refund-offset-marker-display.description',
  },
  {
    id: 'purchase-order-push-return-warehouse-select',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-push-return-warehouse-select.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-order-push-return-warehouse-select.description',
  },
  {
    id: 'payable-purchase-return-offset-display',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.payable-purchase-return-offset-display.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.payable-purchase-return-offset-display.description',
  },
  {
    id: 'purchase-return-refund-order-bridge',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-refund-order-bridge.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-return-refund-order-bridge.description',
  },
  {
    id: 'warehouse-menu-leaf-icons',
    date: '2026-09-11',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-menu-leaf-icons.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-menu-leaf-icons.description',
  },
  {
    id: 'sidebar-pro-app-badge-restore',
    date: '2026-09-11',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sidebar-pro-app-badge-restore.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sidebar-pro-app-badge-restore.description',
  },
  {
    id: 'ar-ap-return-open-balance-offset',
    date: '2026-09-10',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.ar-ap-return-open-balance-offset.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.ar-ap-return-open-balance-offset.description',
  },
  {
    id: 'purchase-order-return-preview-returnable',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.purchase-order-return-preview-returnable.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-order-return-preview-returnable.description',
  },
  {
    id: 'finance-refund-unconfirm-and-view',
    date: '2026-09-10',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.finance-refund-unconfirm-and-view.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.finance-refund-unconfirm-and-view.description',
  },
  {
    id: 'bank-account-tx-drawer-cache-isolation',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.bank-account-tx-drawer-cache-isolation.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.bank-account-tx-drawer-cache-isolation.description',
  },
  {
    id: 'finance-refund-bank-flow-atomic',
    date: '2026-09-10',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.finance-refund-bank-flow-atomic.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.finance-refund-bank-flow-atomic.description',
  },
  {
    id: 'purchase-return-pull-select-warehouse',
    date: '2026-09-10',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.purchase-return-pull-select-warehouse.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-return-pull-select-warehouse.description',
  },
  {
    id: 'purchase-inquiry-approval-process-ensure',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.purchase-inquiry-approval-process-ensure.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-inquiry-approval-process-ensure.description',
  },
  {
    id: 'purchase-inquiry-draft-no-simultaneous-submit-audit',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.purchase-inquiry-draft-no-simultaneous-submit-audit.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-inquiry-draft-no-simultaneous-submit-audit.description',
  },
  {
    id: 'purchase-inquiry-duplicate-submit-action',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.purchase-inquiry-duplicate-submit-action.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-inquiry-duplicate-submit-action.description',
  },
  {
    id: 'ipqc-no-duplicate-plan-after-inspected',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.ipqc-no-duplicate-plan-after-inspected.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.ipqc-no-duplicate-plan-after-inspected.description',
  },
  {
    id: 'work-order-op-card-inspection-overview-hover',
    date: '2026-09-10',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.work-order-op-card-inspection-overview-hover.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-op-card-inspection-overview-hover.description',
  },
  {
    id: 'quality-inspection-kind-plan-name-not-code-dup',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.quality-inspection-kind-plan-name-not-code-dup.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-inspection-kind-plan-name-not-code-dup.description',
  },
  {
    id: 'quality-inspection-kind-plan-name-code-stack',
    date: '2026-09-10',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.quality-inspection-kind-plan-name-code-stack.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-inspection-kind-plan-name-code-stack.description',
  },
  {
    id: 'quality-inspection-list-col-order-material-op-plan',
    date: '2026-09-10',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.quality-inspection-list-col-order-material-op-plan.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-inspection-list-col-order-material-op-plan.description',
  },
  {
    id: 'quality-inspection-kind-show-plan-name',
    date: '2026-09-10',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.quality-inspection-kind-show-plan-name.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-inspection-kind-show-plan-name.description',
  },
  {
    id: 'process-inspection-save-db-lock',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.process-inspection-save-db-lock.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.process-inspection-save-db-lock.description',
  },
  {
    id: 'form-modal-save-loading-stuck',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.form-modal-save-loading-stuck.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.form-modal-save-loading-stuck.description',
  },
  {
    id: 'ipqc-multi-plan-create-all-at-once',
    date: '2026-09-10',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.ipqc-multi-plan-create-all-at-once.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.ipqc-multi-plan-create-all-at-once.description',
  },
  {
    id: 'disposal-method-system-dictionary',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.disposal-method-system-dictionary.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.disposal-method-system-dictionary.description',
  },
  {
    id: 'process-inspection-conduct-save-no-response',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.process-inspection-conduct-save-no-response.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.process-inspection-conduct-save-no-response.description',
  },
  {
    id: 'wo-op-start-null-inspection-plan-ids',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.wo-op-start-null-inspection-plan-ids.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.wo-op-start-null-inspection-plan-ids.description',
  },
  {
    id: 'uni-push-mark-deleted-downstream',
    date: '2026-09-10',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.uni-push-mark-deleted-downstream.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.uni-push-mark-deleted-downstream.description',
  },
  {
    id: 'wo-op-schedule-shift-no-default-hour',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.wo-op-schedule-shift-no-default-hour.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.wo-op-schedule-shift-no-default-hour.description',
  },
  {
    id: 'sidebar-app-group-unique-key',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.sidebar-app-group-unique-key.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sidebar-app-group-unique-key.description',
  },
  {
    id: 'operation-list-show-inspection-plans',
    date: '2026-09-10',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.operation-list-show-inspection-plans.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.operation-list-show-inspection-plans.description',
  },
  {
    id: 'process-route-ipqc-reload-override',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.process-route-ipqc-reload-override.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.process-route-ipqc-reload-override.description',
  },
  {
    id: 'operation-inspection-plan-options-unscoped',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.operation-inspection-plan-options-unscoped.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.operation-inspection-plan-options-unscoped.description',
  },
  {
    id: 'operation-ipqc-ordered-multi-plan',
    date: '2026-09-10',
    type: 'feature',
    titleKey:
      'pages.dashboard.updateLog.entries.operation-ipqc-ordered-multi-plan.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.operation-ipqc-ordered-multi-plan.description',
  },
  {
    id: 'stale-chunk-auto-reload',
    date: '2026-09-10',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.stale-chunk-auto-reload.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.stale-chunk-auto-reload.description',
  },
  {
    id: 'process-route-ipqc-ordered-multi-plan',
    date: '2026-09-10',
    type: 'feature',
    titleKey:
      'pages.dashboard.updateLog.entries.process-route-ipqc-ordered-multi-plan.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.process-route-ipqc-ordered-multi-plan.description',
  },
  {
    id: 'process-route-step-ipqc-override',
    date: '2026-09-10',
    type: 'feature',
    titleKey:
      'pages.dashboard.updateLog.entries.process-route-step-ipqc-override.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.process-route-step-ipqc-override.description',
  },
  {
    id: 'process-route-outsource-detail-columns-conditional',
    date: '2026-09-10',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.process-route-outsource-detail-columns-conditional.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.process-route-outsource-detail-columns-conditional.description',
  },
  {
    id: 'process-route-detail-single-column',
    date: '2026-09-10',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.process-route-detail-single-column.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.process-route-detail-single-column.description',
  },
  {
    id: 'kuaizhizao-reset-include-purchase-inquiry',
    date: '2026-09-10',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-reset-include-purchase-inquiry.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-reset-include-purchase-inquiry.description',
  },
  {
    id: 'dashboard-quick-entry-icons-restore',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.dashboard-quick-entry-icons-restore.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.dashboard-quick-entry-icons-restore.description',
  },
  {
    id: 'purchase-sales-return-confirm-nested-tx',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.purchase-sales-return-confirm-nested-tx.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-sales-return-confirm-nested-tx.description',
  },
  {
    id: 'quality-inspection-auto-pass-sync-approve',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.quality-inspection-auto-pass-sync-approve.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-inspection-auto-pass-sync-approve.description',
  },
  {
    id: 'bom-list-material-master-cache-merge',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-list-material-master-cache-merge.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.bom-list-material-master-cache-merge.description',
  },
  {
    id: 'bom-import-process-route-optional',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.bom-import-process-route-optional.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.bom-import-process-route-optional.description',
  },
  {
    id: 'bom-detail-show-base-quantity',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.bom-detail-show-base-quantity.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.bom-detail-show-base-quantity.description',
  },
  {
    id: 'custom-menu-layout-disable-no-force-reopen',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.custom-menu-layout-disable-no-force-reopen.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.custom-menu-layout-disable-no-force-reopen.description',
  },
  {
    id: 'receivable-remaining-include-refund',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.receivable-remaining-include-refund.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.receivable-remaining-include-refund.description',
  },
  {
    id: 'sidebar-menu-icon-manifest-catalog-keys',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.sidebar-menu-icon-manifest-catalog-keys.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sidebar-menu-icon-manifest-catalog-keys.description',
  },
  {
    id: 'sales-order-submit-empty-approver-auto-pass',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.sales-order-submit-empty-approver-auto-pass.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-submit-empty-approver-auto-pass.description',
  },
  {
    id: 'sales-invoice-tax-amount-cents-math',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.sales-invoice-tax-amount-cents-math.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-invoice-tax-amount-cents-math.description',
  },
  {
    id: 'sales-doc-price-type-switch-preserve-amounts',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.sales-doc-price-type-switch-preserve-amounts.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-doc-price-type-switch-preserve-amounts.description',
  },
  {
    id: 'quotation-convert-order-downstream-unpack',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.quotation-convert-order-downstream-unpack.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quotation-convert-order-downstream-unpack.description',
  },
  {
    id: 'incoming-inspect-conduct-payload-error-detail',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.incoming-inspect-conduct-payload-error-detail.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.incoming-inspect-conduct-payload-error-detail.description',
  },
  {
    id: 'kuaiems-domain-prefixed-submenus',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiems-domain-prefixed-submenus.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiems-domain-prefixed-submenus.description',
  },
  {
    id: 'kuaiems-workbench-icon-hardhat',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiems-workbench-icon-hardhat.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiems-workbench-icon-hardhat.description',
  },
  {
    id: 'custom-menu-layout-disable-without-ref-validation',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.custom-menu-layout-disable-without-ref-validation.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.custom-menu-layout-disable-without-ref-validation.description',
  },
  {
    id: 'kuaiems-workbench-rename-ops-dashboard',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiems-workbench-rename-ops-dashboard.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiems-workbench-rename-ops-dashboard.description',
  },
  {
    id: 'kuaiems-workbench-icon-equipment',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiems-workbench-icon-equipment.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiems-workbench-icon-equipment.description',
  },
  {
    id: 'kuaioa-hr-training-submenu-group',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-hr-training-submenu-group.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaioa-hr-training-submenu-group.description',
  },
  {
    id: 'custom-menu-layout-save-respects-disable',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.custom-menu-layout-save-respects-disable.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.custom-menu-layout-save-respects-disable.description',
  },
  {
    id: 'mobile-workplace-userinfo-undefined',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mobile-workplace-userinfo-undefined.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.mobile-workplace-userinfo-undefined.description',
  },
  {
    id: 'custom-menu-layout-hoist-ungrouped',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.custom-menu-layout-hoist-ungrouped.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.custom-menu-layout-hoist-ungrouped.description',
  },
  {
    id: 'kuaireport-two-top-level-menu-groups',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaireport-two-top-level-menu-groups.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaireport-two-top-level-menu-groups.description',
  },
  {
    id: 'kuaiqms-menu-fold-basic-data',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiqms-menu-fold-basic-data.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiqms-menu-fold-basic-data.description',
  },
  {
    id: 'label-oem-single-entry-via-label-station',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.label-oem-single-entry-via-label-station.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.label-oem-single-entry-via-label-station.description',
  },
  {
    id: 'kuaireport-offline-analysis-center',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaireport-offline-analysis-center.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaireport-offline-analysis-center.description',
  },
  {
    id: 'kuaioa-menu-consolidate-groups',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-menu-consolidate-groups.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaioa-menu-consolidate-groups.description',
  },
  {
    id: 'industry-pack-split-sidebar-short',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.industry-pack-split-sidebar-short.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.industry-pack-split-sidebar-short.description',
  },
  {
    id: 'kuaicaiwu-offline-management-analysis-menu',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaicaiwu-offline-management-analysis-menu.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaicaiwu-offline-management-analysis-menu.description',
  },
  {
    id: 'custom-menu-layout-respect-enabled-toggle',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.custom-menu-layout-respect-enabled-toggle.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.custom-menu-layout-respect-enabled-toggle.description',
  },
  {
    id: 'split-qms-ems-delivery-apps',
    date: '2026-09-09',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.split-qms-ems-delivery-apps.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.split-qms-ems-delivery-apps.description',
  },
  {
    id: 'purchase-receipt-confirm-withdraw-reconfirm',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-receipt-confirm-withdraw-reconfirm.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-receipt-confirm-withdraw-reconfirm.description',
  },
  {
    id: 'reminder-events-audit-columns',
    type: 'fix',
    date: '2026-09-09',
    titleKey: 'pages.dashboard.updateLog.entries.reminder-events-audit-columns.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.reminder-events-audit-columns.description',
  },
  {
    id: 'equipment-ops-audit-columns-spot-check',
    type: 'fix',
    date: '2026-09-09',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-ops-audit-columns-spot-check.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.equipment-ops-audit-columns-spot-check.description',
  },
  {
    id: 'supplier-delivery-ontime-site-date',
    type: 'fix',
    date: '2026-09-09',
    titleKey: 'pages.dashboard.updateLog.entries.supplier-delivery-ontime-site-date.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.supplier-delivery-ontime-site-date.description',
  },
  {
    id: 'purchase-return-confirm-popconfirm-v2',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-confirm-popconfirm-v2.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-return-confirm-popconfirm-v2.description',
  },
  {
    id: 'ops-board-warehouse-total-stock-align',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.ops-board-warehouse-total-stock-align.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.ops-board-warehouse-total-stock-align.description',
  },
  {
    id: 'warehouse-dashboard-inventory-value-formula',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-dashboard-inventory-value-formula.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-dashboard-inventory-value-formula.description',
  },
  {
    id: 'mrp-warehouse-scope-strict-v2',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-warehouse-scope-strict-v2.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mrp-warehouse-scope-strict-v2.description',
  },
  {
    id: 'inbound-hub-pagination-total',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-hub-pagination-total.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inbound-hub-pagination-total.description',
  },
  {
    id: 'sales-order-line-amount-tail-diff',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-line-amount-tail-diff.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-line-amount-tail-diff.description',
  },
  {
    id: 'inbound-hub-page-partial-load-toast',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-hub-page-partial-load-toast.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.inbound-hub-page-partial-load-toast.description',
  },
  {
    id: 'inbound-hub-search-keyword',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-hub-search-keyword.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inbound-hub-search-keyword.description',
  },
  {
    id: 'partner-select-autofill-contact-v2',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.partner-select-autofill-contact-v2.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.partner-select-autofill-contact-v2.description',
  },
  {
    id: 'customer-list-code-column-overlap',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.customer-list-code-column-overlap.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.customer-list-code-column-overlap.description',
  },
  {
    id: 'warehouse-inbound-confirm-receiver-select-v2',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-inbound-confirm-receiver-select-v2.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-inbound-confirm-receiver-select-v2.description',
  },
  {
    id: 'finance-recognition-manual-no-auto-ar-ap',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.finance-recognition-manual-no-auto-ar-ap.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.finance-recognition-manual-no-auto-ar-ap.description',
  },
  {
    id: 'inventory-alert-rule-material-multi-filter-v2',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inventory-alert-rule-material-multi-filter-v2.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inventory-alert-rule-material-multi-filter-v2.description',
  },
  {
    id: 'production-picking-confirm-multi-batch',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.production-picking-confirm-multi-batch.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-picking-confirm-multi-batch.description',
  },
  {
    id: 'mrp-menu-relocate-persist-after-refresh-v2',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.mrp-menu-relocate-persist-after-refresh-v2.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.mrp-menu-relocate-persist-after-refresh-v2.description',
  },
  {
    id: 'batch-pick-merge-multi-work-order',
    date: '2026-09-09',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.batch-pick-merge-multi-work-order.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.batch-pick-merge-multi-work-order.description',
  },
  {
    id: 'material-form-custom-field-save-before-leave',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.material-form-custom-field-save-before-leave.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-form-custom-field-save-before-leave.description',
  },
  {
    id: 'material-management-keep-group-after-edit-v2',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.material-management-keep-group-after-edit-v2.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-management-keep-group-after-edit-v2.description',
  },
  {
    id: 'vat-ledger-month-end-day-fix',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.vat-ledger-month-end-day-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.vat-ledger-month-end-day-fix.description',
  },
  {
    id: 'work-order-edit-multi-unit-qty',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-edit-multi-unit-qty.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.work-order-edit-multi-unit-qty.description',
  },
  {
    id: 'work-order-reporting-card-planned-time-follow-header',
    date: '2026-09-09',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.work-order-reporting-card-planned-time-follow-header.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.work-order-reporting-card-planned-time-follow-header.description',
  },
  {
    id: 'mrp-detail-hide-push-time',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-detail-hide-push-time.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mrp-detail-hide-push-time.description',
  },
  {
    id: 'quality-exception-no-recreate-after-close',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quality-exception-no-recreate-after-close.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-exception-no-recreate-after-close.description',
  },
  {
    id: 'assembly-disassembly-batch-outbound',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.assembly-disassembly-batch-outbound.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.assembly-disassembly-batch-outbound.description',
  },
  {
    id: 'finance-ar-ap-voucher-correct',
    date: '2026-09-09',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.finance-ar-ap-voucher-correct.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.finance-ar-ap-voucher-correct.description',
  },
  {
    id: 'purchase-return-pull-batch-select',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-pull-batch-select.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-return-pull-batch-select.description',
  },
  {
    id: 'return-refund-bridge',
    date: '2026-09-09',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.return-refund-bridge.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.return-refund-bridge.description',
  },
  {
    id: 'receivable-sales-return-offset-ux',
    date: '2026-09-09',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.receivable-sales-return-offset-ux.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.receivable-sales-return-offset-ux.description',
  },
  {
    id: 'purchase-invoice-delete-align-sales',
    date: '2026-09-09',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-invoice-delete-align-sales.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-invoice-delete-align-sales.description',
  },
  {
    id: 'invoice-pull-amount-max-equal-fix',
    date: '2026-09-09',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.invoice-pull-amount-max-equal-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.invoice-pull-amount-max-equal-fix.description',
  },
  {
    id: 'uni-push-show-pushed-docs',
    date: '2026-09-08',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.uni-push-show-pushed-docs.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-push-show-pushed-docs.description',
  },
  {
    id: 'print-seal-no-page-break',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.print-seal-no-page-break.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.print-seal-no-page-break.description',
  },
  {
    id: 'document-code-edit-global',
    date: '2026-09-08',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.document-code-edit-global.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.document-code-edit-global.description',
  },
  {
    id: 'sales-order-code-edit-draft-no-downstream',
    date: '2026-09-08',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-code-edit-draft-no-downstream.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-code-edit-draft-no-downstream.description',
  },
  {
    id: 'sales-order-push-wo-line-remarks',
    date: '2026-09-08',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-push-wo-line-remarks.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-push-wo-line-remarks.description',
  },
  {
    id: 'drawing-form-main-file-upload',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.drawing-form-main-file-upload.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.drawing-form-main-file-upload.description',
  },
  {
    id: 'wo-material-call-push-pr-over-issue',
    date: '2026-09-08',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.wo-material-call-push-pr-over-issue.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.wo-material-call-push-pr-over-issue.description',
  },
  {
    id: 'demand-computation-no-push-needed-align',
    date: '2026-09-08',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.demand-computation-no-push-needed-align.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.demand-computation-no-push-needed-align.description',
  },
  {
    id: 'work-order-kitting-received-short',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-kitting-received-short.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.work-order-kitting-received-short.description',
  },
  {
    id: 'delivery-project-create-customer-grid',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-create-customer-grid.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-project-create-customer-grid.description',
  },
  {
    id: 'delivery-project-create-customer-date',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-create-customer-date.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-project-create-customer-date.description',
  },
  {
    id: 'sales-order-push-delivery-project-double-start',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-push-delivery-project-double-start.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-push-delivery-project-double-start.description',
  },
  {
    id: 'sales-order-audit-log-decimal-noise',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-audit-log-decimal-noise.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-audit-log-decimal-noise.description',
  },
  {
    id: 'doc-audit-revoke-resubmit-unify',
    date: '2026-09-08',
    type: 'major',
    titleKey: 'pages.dashboard.updateLog.entries.doc-audit-revoke-resubmit-unify.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.doc-audit-revoke-resubmit-unify.description',
  },
  {
    id: 'finance-receipt-code-unique-collision',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.finance-receipt-code-unique-collision.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.finance-receipt-code-unique-collision.description',
  },
  {
    id: 'reminder-event-orm-baseline-register',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.reminder-event-orm-baseline-register.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.reminder-event-orm-baseline-register.description',
  },
  {
    id: 'purchase-requisition-qty-scale-list-500',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-requisition-qty-scale-list-500.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-requisition-qty-scale-list-500.description',
  },
  {
    id: 'purchase-order-item-zero-qty-list-500',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-order-item-zero-qty-list-500.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-order-item-zero-qty-list-500.description',
  },
  {
    id: 'drawing-step-bom-released-restore',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.drawing-step-bom-released-restore.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.drawing-step-bom-released-restore.description',
  },
  {
    id: 'sales-print-require-audit-config',
    date: '2026-09-08',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.sales-print-require-audit-config.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-print-require-audit-config.description',
  },
  {
    id: 'sales-list-salesman-options-unwrap-fix',
    date: '2026-09-08',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-list-salesman-options-unwrap-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-list-salesman-options-unwrap-fix.description',
  },
  {
    id: 'sales-list-salesman-from-documents',
    date: '2026-09-08',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-list-salesman-from-documents.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-list-salesman-from-documents.description',
  },
  {
    id: 'sales-list-salesman-toolbar-filter',
    date: '2026-09-08',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.sales-list-salesman-toolbar-filter.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-list-salesman-toolbar-filter.description',
  },
  {
    id: 'master-data-time-rewrite-keep-clock',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.master-data-time-rewrite-keep-clock.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.master-data-time-rewrite-keep-clock.description',
  },
  {
    id: 'master-data-time-rewrite-fields-map',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.master-data-time-rewrite-fields-map.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.master-data-time-rewrite-fields-map.description',
  },
  {
    id: 'doc-code-use-business-date',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.doc-code-use-business-date.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.doc-code-use-business-date.description',
  },
  {
    id: 'print-detail-image-square-center',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.print-detail-image-square-center.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.print-detail-image-square-center.description',
  },
  {
    id: 'finance-ar-ap-reject-resubmit',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.finance-ar-ap-reject-resubmit.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.finance-ar-ap-reject-resubmit.description',
  },
  {
    id: 'quotation-print-image-mime',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quotation-print-image-mime.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.quotation-print-image-mime.description',
  },
  {
    id: 'nav-tree-kuaioa-orm-ready',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.nav-tree-kuaioa-orm-ready.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.nav-tree-kuaioa-orm-ready.description',
  },
  {
    id: 'package-plan-allow-duplicate',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.package-plan-allow-duplicate.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.package-plan-allow-duplicate.description',
  },
  {
    id: 'settlement-left-row-select',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.settlement-left-row-select.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.settlement-left-row-select.description',
  },
  {
    id: 'package-builtin-plan-four-tiers',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.package-builtin-plan-four-tiers.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.package-builtin-plan-four-tiers.description',
  },
  {
    id: 'sales-review-payment-cycle-dict-label',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-review-payment-cycle-dict-label.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-review-payment-cycle-dict-label.description',
  },
  {
    id: 'sales-review-edit-load-items',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-review-edit-load-items.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-review-edit-load-items.description',
  },
  {
    id: 'quotation-menu-badge-exclude-pushed',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quotation-menu-badge-exclude-pushed.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.quotation-menu-badge-exclude-pushed.description',
  },
  {
    id: 'quotation-push-progress-sales-review',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quotation-push-progress-sales-review.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.quotation-push-progress-sales-review.description',
  },
  {
    id: 'customer-supplier-name-width',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.customer-supplier-name-width.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.customer-supplier-name-width.description',
  },
  {
    id: 'material-spec-middle-ellipsis',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-spec-middle-ellipsis.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.material-spec-middle-ellipsis.description',
  },
  {
    id: 'plants-audit-operator-name',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.plants-audit-operator-name.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.plants-audit-operator-name.description',
  },
  {
    id: 'plants-address-remainder',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.plants-address-remainder.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.plants-address-remainder.description',
  },
  {
    id: 'dashboard-todos-limit-100',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.dashboard-todos-limit-100.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.dashboard-todos-limit-100.description',
  },
  {
    id: 'custom-menu-layout-reports-last',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.custom-menu-layout-reports-last.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.custom-menu-layout-reports-last.description',
  },
  {
    id: 'login-logs-location-remainder',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.login-logs-location-remainder.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.login-logs-location-remainder.description',
  },
  {
    id: 'settlement-cancel-rematch',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.settlement-cancel-rematch.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.settlement-cancel-rematch.description',
  },
  {
    id: 'playwright-chromium-deps-probe',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.playwright-chromium-deps-probe.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.playwright-chromium-deps-probe.description',
  },
  {
    id: 'gl-voucher-edit-await-queryset',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-edit-await-queryset.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-voucher-edit-await-queryset.description',
  },
  {
    id: 'ind-electronics-menu-leaf-no-icon',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.ind-electronics-menu-leaf-no-icon.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.ind-electronics-menu-leaf-no-icon.description',
  },
  {
    id: 'kuaiai-menu-leaf-no-icon',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiai-menu-leaf-no-icon.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiai-menu-leaf-no-icon.description',
  },
  {
    id: 'tenant-switch-unitabs-padding',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-switch-unitabs-padding.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.tenant-switch-unitabs-padding.description',
  },
  {
    id: 'tenant-selector-sort-id-height',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-selector-sort-id-height.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.tenant-selector-sort-id-height.description',
  },
  {
    id: 'tenant-list-tree-with-children',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-list-tree-with-children.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.tenant-list-tree-with-children.description',
  },
  {
    id: 'table-tree-expand-icon-center',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.table-tree-expand-icon-center.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.table-tree-expand-icon-center.description',
  },
  {
    id: 'tenant-plan-tier-sort',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-plan-tier-sort.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.tenant-plan-tier-sort.description',
  },
  {
    id: 'tenant-edit-basic-info-gap',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-edit-basic-info-gap.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.tenant-edit-basic-info-gap.description',
  },
  {
    id: 'update-log-timeline-slide-anim',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.update-log-timeline-slide-anim.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.update-log-timeline-slide-anim.description',
  },
  {
    id: 'update-log-timeline-edge-shift',
    date: '2026-09-07',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.update-log-timeline-edge-shift.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.update-log-timeline-edge-shift.description',
  },
  {
    id: 'page-flash-poll-focus',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.page-flash-poll-focus.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.page-flash-poll-focus.description',
  },
  {
    id: 'industry-pack-app-folder-title',
    date: '2026-09-07',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.industry-pack-app-folder-title.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.industry-pack-app-folder-title.description',
  },
  {
    id: 'electronics-menu-ia',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.electronics-menu-ia.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.electronics-menu-ia.description',
  },
  {
    id: 'industry-pack-menu-path-collision',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.industry-pack-menu-path-collision.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.industry-pack-menu-path-collision.description',
  },
  {
    id: 'equipment-dashboard-kpi-ticker',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-dashboard-kpi-ticker.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.equipment-dashboard-kpi-ticker.description',
  },
  {
    id: 'page-shell-no-duplicate-title',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.page-shell-no-duplicate-title.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.page-shell-no-duplicate-title.description',
  },
  {
    id: 'kuaiiot-menu-two-groups',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiiot-menu-two-groups.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiiot-menu-two-groups.description',
  },
  {
    id: 'label-station-multitab-shell',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.label-station-multitab-shell.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.label-station-multitab-shell.description',
  },
  {
    id: 'print-label-unify',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.print-label-unify.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.print-label-unify.description',
  },
  {
    id: 'system-infra-list-batch-row-selection',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.system-infra-list-batch-row-selection.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.system-infra-list-batch-row-selection.description',
  },
  {
    id: 'plm-master-gl-list-batch-delete',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.plm-master-gl-list-batch-delete.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.plm-master-gl-list-batch-delete.description',
  },
  {
    id: 'toolbar-print-right-slot',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.toolbar-print-right-slot.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.toolbar-print-right-slot.description',
  },
  {
    id: 'create-button-alt-n-hint',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.create-button-alt-n-hint.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.create-button-alt-n-hint.description',
  },
  {
    id: 'equipment-docs-batch-row-selection',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-docs-batch-row-selection.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.equipment-docs-batch-row-selection.description',
  },
  {
    id: 'kuaioa-hr-training-menu-group',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-hr-training-menu-group.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaioa-hr-training-menu-group.description',
  },
  {
    id: 'kuaiai-showcase-scrollbar-gutter',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiai-showcase-scrollbar-gutter.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiai-showcase-scrollbar-gutter.description',
  },
  {
    id: 'kuaiiot-menu-icon-depth-contract',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiiot-menu-icon-depth-contract.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiiot-menu-icon-depth-contract.description',
  },
  {
    id: 'unitable-empty-operation-column-width',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.unitable-empty-operation-column-width.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.unitable-empty-operation-column-width.description',
  },
  {
    id: 'kuaiplm-production-file-multitab-rename',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-production-file-multitab-rename.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-production-file-multitab-rename.description',
  },
  {
    id: 'production-daily-menu-order',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.production-daily-menu-order.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.production-daily-menu-order.description',
  },
  {
    id: 'unitable-empty-measure-header-ghost',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.unitable-empty-measure-header-ghost.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.unitable-empty-measure-header-ghost.description',
  },
  {
    id: 'equipment-line-rebind-menu-mount',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.equipment-line-rebind-menu-mount.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.equipment-line-rebind-menu-mount.description',
  },
  {
    id: 'timezone-export-filename-site-day',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.timezone-export-filename-site-day.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.timezone-export-filename-site-day.description',
  },
  {
    id: 'inf08-drawing-distribution-shell',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.inf08-drawing-distribution-shell.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inf08-drawing-distribution-shell.description',
  },
  {
    id: 'kuaiplm-firmware-inf05',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-firmware-inf05.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-firmware-inf05.description',
  },
  {
    id: 'ind-electronics-label-oem-pack',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.ind-electronics-label-oem-pack.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.ind-electronics-label-oem-pack.description',
  },
  {
    id: 'kuaizhizao-label-station-r16',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-label-station-r16.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-label-station-r16.description',
  },
  {
    id: 'kuaioa-license-asset-r14',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-license-asset-r14.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaioa-license-asset-r14.description',
  },
  {
    id: 'kuaizhizao-production-daily-r13',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-production-daily-r13.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-production-daily-r13.description',
  },
  {
    id: 'kuaioa-training-r12',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-training-r12.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaioa-training-r12.description',
  },
  {
    id: 'kuaizhizao-equipment-board-visit-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-board-visit-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-board-visit-r10.description',
  },
  {
    id: 'ind-electronics-esd-pack-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.ind-electronics-esd-pack-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.ind-electronics-esd-pack-r10.description',
  },
  {
    id: 'kuaizhizao-equipment-board-plant-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-board-plant-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-board-plant-r10.description',
  },
  {
    id: 'kuaizhizao-equipment-repair-arrival-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-repair-arrival-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-repair-arrival-r10.description',
  },
  {
    id: 'kuaizhizao-route-patrol-capture-abc-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-route-patrol-capture-abc-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-route-patrol-capture-abc-r10.description',
  },
  {
    id: 'kuaizhizao-equipment-line-rebind-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-line-rebind-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-line-rebind-r10.description',
  },
  {
    id: 'kuaizhizao-spot-check-review-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-spot-check-review-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-spot-check-review-r10.description',
  },
  {
    id: 'kuaizhizao-inspection-capture-abc-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-inspection-capture-abc-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-inspection-capture-abc-r10.description',
  },
  {
    id: 'kuaizhizao-equipment-qr-bind-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-qr-bind-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-qr-bind-r10.description',
  },
  {
    id: 'kuaizhizao-equipment-acceptance-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-acceptance-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-equipment-acceptance-r10.description',
  },
  {
    id: 'kuaizhizao-mold-signback-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-mold-signback-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-mold-signback-r10.description',
  },
  {
    id: 'kuaizhizao-tool-ledger-r10',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-tool-ledger-r10.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-tool-ledger-r10.description',
  },
  {
    id: 'kuaiplm-production-file-r06',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-production-file-r06.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-production-file-r06.description',
  },
  {
    id: 'kuaiplm-lab-judgment-rules-detail-props',
    date: '2026-09-06',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.kuaiplm-lab-judgment-rules-detail-props.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiplm-lab-judgment-rules-detail-props.description',
  },
  {
    id: 'kuaizhizao-quality-reports-menu-last',
    date: '2026-09-06',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-quality-reports-menu-last.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-quality-reports-menu-last.description',
  },
  {
    id: 'kuaizhizao-supplier-eval-status-tag-trim',
    date: '2026-09-06',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-supplier-eval-status-tag-trim.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-supplier-eval-status-tag-trim.description',
  },
  {
    id: 'kuaizhizao-supplier-eval-plan-summary-r03',
    date: '2026-09-06',
    type: 'feature',
    titleKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-supplier-eval-plan-summary-r03.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-supplier-eval-plan-summary-r03.description',
  },
  {
    id: 'kuaizhizao-supplier-eval-template-r03',
    date: '2026-09-06',
    type: 'feature',
    titleKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-supplier-eval-template-r03.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-supplier-eval-template-r03.description',
  },
  {
    id: 'kuaizhizao-supplier-eval-r03',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-supplier-eval-r03.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-supplier-eval-r03.description',
  },
  {
    id: 'kuaizhizao-equipment-calibration-external-r09',
    date: '2026-09-06',
    type: 'feature',
    titleKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-equipment-calibration-external-r09.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-equipment-calibration-external-r09.description',
  },
  {
    id: 'kuaiplm-rd-deliverable-version-r01',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-rd-deliverable-version-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiplm-rd-deliverable-version-r01.description',
  },
  {
    id: 'kuaizhizao-inventory-verify-loop-r07',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-inventory-verify-loop-r07.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-inventory-verify-loop-r07.description',
  },
  {
    id: 'kuaiplm-annual-lab-plan-r07',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-annual-lab-plan-r07.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-annual-lab-plan-r07.description',
  },
  {
    id: 'kuaizhizao-rework-inventory-verify-r07',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-rework-inventory-verify-r07.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-rework-inventory-verify-r07.description',
  },
  {
    id: 'kuaiplm-lab-judgment-rule-r02',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-lab-judgment-rule-r02.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-lab-judgment-rule-r02.description',
  },
  {
    id: 'kuaiplm-lab-report-notify-r02',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-lab-report-notify-r02.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-lab-report-notify-r02.description',
  },
  {
    id: 'kuaiplm-lab-report-ng-r02',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-lab-report-ng-r02.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-lab-report-ng-r02.description',
  },
  {
    id: 'kuaiplm-lab-measure-judgment-r02',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-lab-measure-judgment-r02.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiplm-lab-measure-judgment-r02.description',
  },
  {
    id: 'rework-plan-template-items-table',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.rework-plan-template-items-table.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.rework-plan-template-items-table.description',
  },
  {
    id: 'rework-plan-template-form-two-col',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.rework-plan-template-form-two-col.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.rework-plan-template-form-two-col.description',
  },
  {
    id: 'rework-plan-template-menu-create-label',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.rework-plan-template-menu-create-label.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rework-plan-template-menu-create-label.description',
  },
  {
    id: 'lab-request-create-button-label',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-create-button-label.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.lab-request-create-button-label.description',
  },
  {
    id: 'kuaiplm-lab-request-r02',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-lab-request-r02.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-lab-request-r02.description',
  },
  {
    id: 'qms-document-reject-inf05',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.qms-document-reject-inf05.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.qms-document-reject-inf05.description',
  },
  {
    id: 'drawing-sop-inf05-revisions',
    date: '2026-09-06',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.drawing-sop-inf05-revisions.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.drawing-sop-inf05-revisions.description',
  },
  {
    id: 'qms-document-inf05-zones',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.qms-document-inf05-zones.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.qms-document-inf05-zones.description',
  },
  {
    id: 'tenant-access-path-only',
    date: '2026-09-06',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-access-path-only.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.tenant-access-path-only.description',
  },
  {
    id: 'rework-finance-sign-product-line',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.rework-finance-sign-product-line.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rework-finance-sign-product-line.description',
  },
  {
    id: 'quality-complaint-analysis-r05',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.quality-complaint-analysis-r05.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-complaint-analysis-r05.description',
  },
  {
    id: 'rework-position-plan-template-master',
    date: '2026-09-06',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.rework-position-plan-template-master.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rework-position-plan-template-master.description',
  },
  {
    id: 'quality-complaint-due-reminder-defect',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.quality-complaint-due-reminder-defect.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-complaint-due-reminder-defect.description',
  },
  {
    id: 'quality-complaint-shell-wp11b',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.quality-complaint-shell-wp11b.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.quality-complaint-shell-wp11b.description',
  },
  {
    id: 'rework-order-multi-signoff-children',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.rework-order-multi-signoff-children.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.rework-order-multi-signoff-children.description',
  },
  {
    id: 'kuaiplm-trial-flow-notification-presets',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-trial-flow-notification-presets.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiplm-trial-flow-notification-presets.description',
  },
  {
    id: 'kuaiplm-trial-flow-reminder-inf03',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-trial-flow-reminder-inf03.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-trial-flow-reminder-inf03.description',
  },
  {
    id: 'kuaiplm-trial-flow-reject-export',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-trial-flow-reject-export.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-trial-flow-reject-export.description',
  },
  {
    id: 'kuaiplm-mold-sample-reject-export',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-mold-sample-reject-export.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-mold-sample-reject-export.description',
  },
  {
    id: 'kuaiplm-project-proposal-reject-export',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-project-proposal-reject-export.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-project-proposal-reject-export.description',
  },
  {
    id: 'kuaiplm-bom-collab-reject-export',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-bom-collab-reject-export.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-bom-collab-reject-export.description',
  },
  {
    id: 'kuaiplm-material-review-reject-export',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-material-review-reject-export.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-material-review-reject-export.description',
  },
  {
    id: 'kuaiplm-wave1-reject-export-pilot',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-wave1-reject-export-pilot.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-wave1-reject-export-pilot.description',
  },
  {
    id: 'ind-electronics-esd-document-shell',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.ind-electronics-esd-document-shell.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.ind-electronics-esd-document-shell.description',
  },
  {
    id: 'menu-hideinmenu-leaf-restore',
    date: '2026-09-05',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-hideinmenu-leaf-restore.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-hideinmenu-leaf-restore.description',
  },
  {
    id: 'industry-ext-profile-reconcile',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.industry-ext-profile-reconcile.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.industry-ext-profile-reconcile.description',
  },
  {
    id: 'kuaiplm-bom-section-profile',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-bom-section-profile.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-bom-section-profile.description',
  },
  {
    id: 'ind-electronics-sample-profile',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.ind-electronics-sample-profile.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.ind-electronics-sample-profile.description',
  },
  {
    id: 'kuaiplm-wave1-menu-names',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-wave1-menu-names.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-wave1-menu-names.description',
  },
  {
    id: 'kuaiplm-wave1-menu',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-wave1-menu.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-wave1-menu.description',
  },
  {
    id: 'layout-frame-inset-shadow',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.layout-frame-inset-shadow.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.layout-frame-inset-shadow.description',
  },
  {
    id: 'unitabs-rail-border-1px',
    date: '2026-09-05',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.unitabs-rail-border-1px.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.unitabs-rail-border-1px.description',
  },
  {
    id: 'sidebar-search-rail-1px',
    date: '2026-09-05',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sidebar-search-rail-1px.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sidebar-search-rail-1px.description',
  },
  {
    id: 'kuaiplm-wave1-integration',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-wave1-integration.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-wave1-integration.description',
  },
  {
    id: 'layout-frame-color-unify',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.layout-frame-color-unify.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.layout-frame-color-unify.description',
  },
  {
    id: 'kuaiplm-mold-sample',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-mold-sample.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-mold-sample.description',
  },
  {
    id: 'kuaiplm-project-proposal',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-project-proposal.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-project-proposal.description',
  },
  {
    id: 'kuaiplm-bom-collab',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-bom-collab.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-bom-collab.description',
  },
  {
    id: 'breadcrumb-hover-single-bg',
    date: '2026-09-05',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.breadcrumb-hover-single-bg.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.breadcrumb-hover-single-bg.description',
  },
  {
    id: 'site-logo-dark-variant',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.site-logo-dark-variant.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.site-logo-dark-variant.description',
  },
  {
    id: 'kuaiplm-material-review',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-material-review.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-material-review.description',
  },
  {
    id: 'header-logo-adaptive-width',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.header-logo-adaptive-width.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.header-logo-adaptive-width.description',
  },
  {
    id: 'site-settings-show-site-name',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.site-settings-show-site-name.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.site-settings-show-site-name.description',
  },
  {
    id: 'kuaiplm-sample-process',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-sample-process.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-sample-process.description',
  },
  {
    id: 'infra-menu-empty-permission-restore',
    date: '2026-09-05',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.infra-menu-empty-permission-restore.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.infra-menu-empty-permission-restore.description',
  },
  {
    id: 'kuaioa-form-business-type',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaioa-form-business-type.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaioa-form-business-type.description',
  },
  {
    id: 'kuaiplm-ecn-api-import',
    date: '2026-09-05',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-ecn-api-import.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-ecn-api-import.description',
  },
  {
    id: 'uni-audit-kuaiplm-handlers',
    date: '2026-09-05',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-audit-kuaiplm-handlers.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-audit-kuaiplm-handlers.description',
  },
  {
    id: 'kuaiplm-ecn-merge-change-desk',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-ecn-merge-change-desk.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-ecn-merge-change-desk.description',
  },
  {
    id: 'kuaiplm-ecn-shell',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-ecn-shell.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-ecn-shell.description',
  },
  {
    id: 'kuaiplm-trial-flow-execute',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-trial-flow-execute.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-trial-flow-execute.description',
  },
  {
    id: 'kuaiplm-product-firmware-upload',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-product-firmware-upload.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-product-firmware-upload.description',
  },
  {
    id: 'kuaiplm-trial-flow',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-trial-flow.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-trial-flow.description',
  },
  {
    id: 'sidebar-entry-leaf-menu-restore',
    date: '2026-09-05',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sidebar-entry-leaf-menu-restore.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sidebar-entry-leaf-menu-restore.description',
  },
  {
    id: 'kuaiplm-product-firmware',
    date: '2026-09-05',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-product-firmware.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaiplm-product-firmware.description',
  },
  {
    id: 'platform-infra-capability',
    date: '2026-09-05',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.platform-infra-capability.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.platform-infra-capability.description',
  },
  {
    id: 'material-variant-master-ensure',
    date: '2026-09-04',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-variant-master-ensure.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-variant-master-ensure.description',
  },
  {
    id: 'kuaiplm-knowledge-base-space-switch-loop',
    date: '2026-09-04',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-knowledge-base-space-switch-loop.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiplm-knowledge-base-space-switch-loop.description',
  },
  {
    id: 'demand-computation-analysis-null-code',
    date: '2026-09-04',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.demand-computation-analysis-null-code.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.demand-computation-analysis-null-code.description',
  },
  {
    id: 'kuaiplm-knowledge-base-null-title',
    date: '2026-09-04',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaiplm-knowledge-base-null-title.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaiplm-knowledge-base-null-title.description',
  },
  {
    id: 'structured-cost-format-currency-import',
    date: '2026-09-04',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.structured-cost-format-currency-import.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.structured-cost-format-currency-import.description',
  },
  {
    id: 'sales-order-push-delivery-project',
    date: '2026-09-04',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-push-delivery-project.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-push-delivery-project.description',
  },
  {
    id: 'payment-voucher-handle-confirm-undefined',
    date: '2026-09-04',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.payment-voucher-handle-confirm-undefined.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.payment-voucher-handle-confirm-undefined.description',
  },
  {
    id: 'detail-drawer-popconfirm-record-undefined',
    date: '2026-09-04',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.detail-drawer-popconfirm-record-undefined.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.detail-drawer-popconfirm-record-undefined.description',
  },
  {
    id: 'purchase-return-detail-record-undefined',
    date: '2026-09-04',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-detail-record-undefined.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.purchase-return-detail-record-undefined.description',
  },
  {
    id: 'document-time-rewrite-api',
    date: '2026-09-04',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.document-time-rewrite-api.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.document-time-rewrite-api.description',
  },
  {
    id: 'data-scope-all-persisted-for-external-roles',
    date: '2026-09-04',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.data-scope-all-persisted-for-external-roles.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.data-scope-all-persisted-for-external-roles.description',
  },
  {
    id: 'material-call-lifecycle-pending-i18n',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-call-lifecycle-pending-i18n.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.material-call-lifecycle-pending-i18n.description',
  },
  {
    id: 'bom-list-remainder-bom-name',
    date: '2026-09-03',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.bom-list-remainder-bom-name.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.bom-list-remainder-bom-name.description',
  },
  {
    id: 'bom-more-menu-icons',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-more-menu-icons.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.bom-more-menu-icons.description',
  },
  {
    id: 'bom-list-three-bucket-layout',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.bom-list-three-bucket-layout.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.bom-list-three-bucket-layout.description',
  },
  {
    id: 'approval-or-sign-node-completion',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.approval-or-sign-node-completion.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.approval-or-sign-node-completion.description',
  },
  {
    id: 'inbound-hub-type-label-undefined',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inbound-hub-type-label-undefined.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inbound-hub-type-label-undefined.description',
  },
  {
    id: 'sales-order-audit-permission-gate',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-audit-permission-gate.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-audit-permission-gate.description',
  },
  {
    id: 'user-list-reset-password-handler',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.user-list-reset-password-handler.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.user-list-reset-password-handler.description',
  },
  {
    id: 'dashboard-update-log-timeline-date-window',
    date: '2026-09-03',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.dashboard-update-log-timeline-date-window.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.dashboard-update-log-timeline-date-window.description',
  },
  {
    id: 'core-data-scope-all-fix',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.core-data-scope-all-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.core-data-scope-all-fix.description',
  },
  {
    id: 'popconfirm-migration-hotfix',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.popconfirm-migration-hotfix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.popconfirm-migration-hotfix.description',
  },
  {
    id: 'uni-report-remove-view-switcher',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.uni-report-remove-view-switcher.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.uni-report-remove-view-switcher.description',
  },
  {
    id: 'pure-confirm-popconfirm',
    date: '2026-09-03',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.pure-confirm-popconfirm.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.pure-confirm-popconfirm.description',
  },
  {
    id: 'delivery-dashboard-masonry-balance',
    date: '2026-09-03',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-dashboard-masonry-balance.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-dashboard-masonry-balance.description',
  },
  {
    id: 'delivery-node-document-select',
    date: '2026-09-03',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-node-document-select.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-node-document-select.description',
  },
  {
    id: 'module-center-panel-title-no-icon',
    date: '2026-09-03',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.module-center-panel-title-no-icon.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.module-center-panel-title-no-icon.description',
  },
  {
    id: 'delivery-dashboard-kpi-four',
    date: '2026-09-03',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-dashboard-kpi-four.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-dashboard-kpi-four.description',
  },
  {
    id: 'delivery-project-deepening-ab',
    date: '2026-09-02',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.delivery-project-deepening-ab.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.delivery-project-deepening-ab.description',
  },
  {
    id: 'dashboard-broadcast-source-icon',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.dashboard-broadcast-source-icon.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.dashboard-broadcast-source-icon.description',
  },
  {
    id: 'demand-submit-asyncpg-race-fix',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.demand-submit-asyncpg-race-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.demand-submit-asyncpg-race-fix.description',
  },
  {
    id: 'dashboard-approval-todo-orphan-clear',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.dashboard-approval-todo-orphan-clear.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.dashboard-approval-todo-orphan-clear.description',
  },
  {
    id: 'purchase-return-confirm-modal-fix',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-confirm-modal-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-return-confirm-modal-fix.description',
  },
  {
    id: 'mrp-warehouse-scope-main-batch',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-warehouse-scope-main-batch.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mrp-warehouse-scope-main-batch.description',
  },
  {
    id: 'reporting-source-and-proxy-mode',
    date: '2026-09-02',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.reporting-source-and-proxy-mode.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.reporting-source-and-proxy-mode.description',
  },
  {
    id: 'warehouse-hide-batch-serial-when-disabled',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-hide-batch-serial-when-disabled.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-hide-batch-serial-when-disabled.description',
  },
  {
    id: 'quality-inspection-list-notes-remainder',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.quality-inspection-list-notes-remainder.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.quality-inspection-list-notes-remainder.description',
  },
  {
    id: 'sales-delivery-approval-task-sync',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-delivery-approval-task-sync.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-delivery-approval-task-sync.description',
  },
  {
    id: 'supplier-delivery-period-basis',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.supplier-delivery-period-basis.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.supplier-delivery-period-basis.description',
  },
  {
    id: 'work-order-detail-op-code-name-line',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-detail-op-code-name-line.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.work-order-detail-op-code-name-line.description',
  },
  {
    id: 'inspection-judgment-default-pass',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inspection-judgment-default-pass.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inspection-judgment-default-pass.description',
  },
  {
    id: 'mrp-push-confirm-after-row-select',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-push-confirm-after-row-select.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.mrp-push-confirm-after-row-select.description',
  },
  {
    id: 'list-scope-segmented-reload-lag',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.list-scope-segmented-reload-lag.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.list-scope-segmented-reload-lag.description',
  },
  {
    id: 'sales-order-list-scope-filter',
    date: '2026-09-02',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-list-scope-filter.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-list-scope-filter.description',
  },
  {
    id: 'quotation-list-scope-mine',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.quotation-list-scope-mine.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.quotation-list-scope-mine.description',
  },
  {
    id: 'purchase-return-audit-setting',
    date: '2026-09-02',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.purchase-return-audit-setting.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.purchase-return-audit-setting.description',
  },
  {
    id: 'material-inspection-plan-echo',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-inspection-plan-echo.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.material-inspection-plan-echo.description',
  },
  {
    id: 'po-pull-receipt-select-warehouse',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.po-pull-receipt-select-warehouse.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.po-pull-receipt-select-warehouse.description',
  },
  {
    id: 'partner-select-autofill-contact',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.partner-select-autofill-contact.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.partner-select-autofill-contact.description',
  },
  {
    id: 'tenant-switch-clear-tabs-cache',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tenant-switch-clear-tabs-cache.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.tenant-switch-clear-tabs-cache.description',
  },
  {
    id: 'demand-computation-permission-resource-prefix',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.demand-computation-permission-resource-prefix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.demand-computation-permission-resource-prefix.description',
  },
  {
    id: 'demand-submit-approval-asyncpg-fix',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.demand-submit-approval-asyncpg-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.demand-submit-approval-asyncpg-fix.description',
  },
  {
    id: 'warehouse-inbound-form-import-fix',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-inbound-form-import-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-inbound-form-import-fix.description',
  },
  {
    id: 'document-push-progress-numeric-restore',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.document-push-progress-numeric-restore.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.document-push-progress-numeric-restore.description',
  },
  {
    id: 'work-order-without-bom-when-no-material',
    date: '2026-09-02',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.work-order-without-bom-when-no-material.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.work-order-without-bom-when-no-material.description',
  },
  {
    id: 'warehouse-inbound-confirm-receiver-select',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-inbound-confirm-receiver-select.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.warehouse-inbound-confirm-receiver-select.description',
  },
  {
    id: 'config-center-material-shortage-block-level',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.config-center-material-shortage-block-level.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.config-center-material-shortage-block-level.description',
  },
  {
    id: 'inventory-alert-rule-material-multi-filter',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.inventory-alert-rule-material-multi-filter.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.inventory-alert-rule-material-multi-filter.description',
  },
  {
    id: 'custom-menu-layout-sidebar-persist',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.custom-menu-layout-sidebar-persist.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.custom-menu-layout-sidebar-persist.description',
  },
  {
    id: 'eight-d-d8-verification-result-save',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.eight-d-d8-verification-result-save.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.eight-d-d8-verification-result-save.description',
  },
  {
    id: 'material-form-custom-field-save',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-form-custom-field-save.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-form-custom-field-save.description',
  },
  {
    id: 'material-form-unit-master-data-select',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-form-unit-master-data-select.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-form-unit-master-data-select.description',
  },
  {
    id: 'hub-custom-field-column-dedupe',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.hub-custom-field-column-dedupe.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.hub-custom-field-column-dedupe.description',
  },
  {
    id: 'warehouse-in-out-operator-column-no-time',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-in-out-operator-column-no-time.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-in-out-operator-column-no-time.description',
  },
  {
    id: 'unitable-column-preference-bump-migration',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.unitable-column-preference-bump-migration.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.unitable-column-preference-bump-migration.description',
  },
  {
    id: 'material-management-restore-group-after-edit',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.material-management-restore-group-after-edit.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-management-restore-group-after-edit.description',
  },
  {
    id: 'mrp-work-order-source-planned-dates',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.mrp-work-order-source-planned-dates.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.mrp-work-order-source-planned-dates.description',
  },
  {
    id: 'material-batch-expiry-history-backfill',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-batch-expiry-history-backfill.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-batch-expiry-history-backfill.description',
  },
  {
    id: 'material-batch-expiry-after-production-inbound',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.material-batch-expiry-after-production-inbound.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.material-batch-expiry-after-production-inbound.description',
  },
  {
    id: 'batch-production-picking-ux',
    date: '2026-09-02',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.batch-production-picking-ux.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.batch-production-picking-ux.description',
  },
  {
    id: 'document-push-progress-complete-no-numeric',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.document-push-progress-complete-no-numeric.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.document-push-progress-complete-no-numeric.description',
  },
  {
    id: 'menu-badge-data-scope',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.menu-badge-data-scope.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.menu-badge-data-scope.description',
  },
  {
    id: 'receivable-negative-invoiced-amount',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.receivable-negative-invoiced-amount.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.receivable-negative-invoiced-amount.description',
  },
  {
    id: 'gl-voucher-list-account-columns',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.gl-voucher-list-account-columns.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.gl-voucher-list-account-columns.description',
  },
  {
    id: 'sales-contract-alert-feed-key',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-contract-alert-feed-key.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-contract-alert-feed-key.description',
  },
  {
    id: 'remove-unused-link-preload',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.remove-unused-link-preload.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.remove-unused-link-preload.description',
  },
  {
    id: 'sales-order-detail-descriptions-span',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-detail-descriptions-span.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-detail-descriptions-span.description',
  },
  {
    id: 'antd6-api-migration',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.antd6-api-migration.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.antd6-api-migration.description',
  },
  {
    id: 'float-button-opt-in-display',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.float-button-opt-in-display.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.float-button-opt-in-display.description',
  },
  {
    id: 'platform-branding-clear-button',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.platform-branding-clear-button.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.platform-branding-clear-button.description',
  },
  {
    id: 'kuaizhizao-orm-models-complete',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-orm-models-complete.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.kuaizhizao-orm-models-complete.description',
  },
  {
    id: 'tortoise-bootstrap-two-phase',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.tortoise-bootstrap-two-phase.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.tortoise-bootstrap-two-phase.description',
  },
  {
    id: 'prod-memory-dynamic-trim',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.prod-memory-dynamic-trim.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.prod-memory-dynamic-trim.description',
  },
  {
    id: 'outbound-pull-delivery-note-from-sales-delivery',
    date: '2026-09-02',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.outbound-pull-delivery-note-from-sales-delivery.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.outbound-pull-delivery-note-from-sales-delivery.description',
  },
  {
    id: 'warehouse-pull-invalid-only-fields',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.warehouse-pull-invalid-only-fields.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.warehouse-pull-invalid-only-fields.description',
  },
  {
    id: 'sales-order-tax-exclusive-decimal-amount',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-tax-exclusive-decimal-amount.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.sales-order-tax-exclusive-decimal-amount.description',
  },
  {
    id: 'stocktaking-bulk-save-entries',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.stocktaking-bulk-save-entries.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.stocktaking-bulk-save-entries.description',
  },
  {
    id: 'stocktaking-start-button-permission',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.stocktaking-start-button-permission.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.stocktaking-start-button-permission.description',
  },
  {
    id: 'demand-computation-permission-align',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.demand-computation-permission-align.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.demand-computation-permission-align.description',
  },
  {
    id: 'file-manager-toolbar-layout',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.file-manager-toolbar-layout.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.file-manager-toolbar-layout.description',
  },
  {
    id: 'department-link-preset-managers-405-fix',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.department-link-preset-managers-405-fix.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.department-link-preset-managers-405-fix.description',
  },
  {
    id: 'approval-department-manager-setup',
    date: '2026-09-02',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.approval-department-manager-setup.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.approval-department-manager-setup.description',
  },
  {
    id: 'approval-multi-approver-fix',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.approval-multi-approver-fix.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.approval-multi-approver-fix.description',
  },
  {
    id: 'kuaizhizao-doc-form-reference-display',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.kuaizhizao-doc-form-reference-display.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.kuaizhizao-doc-form-reference-display.description',
  },
  {
    id: 'sales-order-form-reference-display',
    date: '2026-09-02',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.sales-order-form-reference-display.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.sales-order-form-reference-display.description',
  },
  {
    id: 'print-pdf-sigtrap-as-limit',
    date: '2026-09-01',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.print-pdf-sigtrap-as-limit.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.print-pdf-sigtrap-as-limit.description',
  },
  {
    id: 'print-pdf-chromium-error-hint',
    date: '2026-09-01',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.print-pdf-chromium-error-hint.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.print-pdf-chromium-error-hint.description',
  },
  {
    id: 'deploy-low-spec-mode-menu',
    date: '2026-09-01',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.deploy-low-spec-mode-menu.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.deploy-low-spec-mode-menu.description',
  },
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
