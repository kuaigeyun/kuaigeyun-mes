/**
 * 平台更新日志：定制应用专属条目
 *
 * 仅当租户已安装并启用对应 dedicatedAppCode 时在更新日志中可见。
 * 新记录插在数组头部；须同步 zh-CN pages.dashboard.updateLog.entries.{id}.*
 */

import type { PlatformUpdateLogEntry } from './platformUpdateLog';

export const PLATFORM_UPDATE_LOG_DEDICATED: PlatformUpdateLogEntry[] = [
  {
    id: 'engineering-drawing-l33-funide-r01',
    date: '2026-09-24',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.engineering-drawing-l33-funide-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.engineering-drawing-l33-funide-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-menu-production-software-r01',
    date: '2026-09-24',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-menu-production-software-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-menu-production-software-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'production-file-optional-project-backend-r01',
    date: '2026-09-24',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.production-file-optional-project-backend-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-file-optional-project-backend-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'production-file-release-date-api-format-r01',
    date: '2026-09-24',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.production-file-release-date-api-format-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-file-release-date-api-format-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'production-file-change-summary-on-edit-r01',
    date: '2026-09-24',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.production-file-change-summary-on-edit-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-file-change-summary-on-edit-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'production-file-pe-tab-no-burn-type-r01',
    date: '2026-09-24',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.production-file-pe-tab-no-burn-type-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-file-pe-tab-no-burn-type-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'production-file-modal-grid-like-firmware-r01',
    date: '2026-09-24',
    type: 'fix',
    titleKey:
      'pages.dashboard.updateLog.entries.production-file-modal-grid-like-firmware-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-file-modal-grid-like-firmware-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'production-file-optional-manual-project-r01',
    date: '2026-09-24',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.production-file-optional-manual-project-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-file-optional-manual-project-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'production-file-upload-label-by-sample-folder-r01',
    date: '2026-09-24',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.production-file-upload-label-by-sample-folder-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-file-upload-label-by-sample-folder-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-change-summary-on-revise-r01',
    date: '2026-09-24',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-change-summary-on-revise-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-change-summary-on-revise-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'production-file-rd-tool-l32-r01',
    date: '2026-09-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.production-file-rd-tool-l32-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.production-file-rd-tool-l32-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'file-upload-allow-firmware-bin-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.file-upload-allow-firmware-bin-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.file-upload-allow-firmware-bin-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-upload-uuid-sync-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-upload-uuid-sync-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-upload-uuid-sync-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-revise-popconfirm-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-revise-popconfirm-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-revise-popconfirm-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-download-restore-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-download-restore-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-download-restore-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-revise-r01',
    date: '2026-09-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-revise-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.product-firmware-revise-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-download-file-fix-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-download-file-fix-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-download-file-fix-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-download-row-action-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-download-row-action-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-download-row-action-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-row-actions-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-row-actions-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-row-actions-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-create-payload-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-create-payload-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-create-payload-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-menu-project-docs-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-menu-project-docs-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-menu-project-docs-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-optional-project-ref-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.product-firmware-optional-project-ref-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-optional-project-ref-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'product-firmware-l31-download-r01',
    date: '2026-09-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.product-firmware-l31-download-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.product-firmware-l31-download-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-report-draft-primary-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-report-draft-primary-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-report-draft-primary-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-report-draft-optional-file-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.lab-request-report-draft-optional-file-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-report-draft-optional-file-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-form-field-group-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-form-field-group-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-form-field-group-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-switches-before-measures-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.lab-request-switches-before-measures-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-switches-before-measures-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-business-type-options-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-business-type-options-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-business-type-options-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-product-special-test-oneline-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey:
      'pages.dashboard.updateLog.entries.lab-request-product-special-test-oneline-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-product-special-test-oneline-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-requester-default-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-requester-default-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-requester-default-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-revoke-to-draft-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-revoke-to-draft-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-revoke-to-draft-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-marker-colors-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-marker-colors-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-marker-colors-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-reason-modal-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-reason-modal-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-reason-modal-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-report-file-required-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-report-file-required-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-report-file-required-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-report-view-download-r01',
    date: '2026-09-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-report-view-download-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-report-view-download-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-report-action-order-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-report-action-order-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-report-action-order-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-report-submit-row-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-report-submit-row-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-report-submit-row-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-report-row-autofill-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-report-row-autofill-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-report-row-autofill-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-complete-inline-measures-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-complete-inline-measures-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-complete-inline-measures-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-scope-segmented-toolbar-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-scope-segmented-toolbar-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-scope-segmented-toolbar-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-list-width-v5-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-list-width-v5-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-list-width-v5-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-complete-columns-filter-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-complete-columns-filter-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-complete-columns-filter-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-measure-two-cols-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-measure-two-cols-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-measure-two-cols-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-type-fields-r01',
    date: '2026-09-23',
    type: 'feature',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-type-fields-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-type-fields-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-complete-by-measures-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-complete-by-measures-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-complete-by-measures-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-complete-label-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-complete-label-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-complete-label-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-form-selects-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-form-selects-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-form-selects-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-business-type-dict-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-business-type-dict-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-business-type-dict-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'lab-request-rd-mine-manager-r30',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.lab-request-rd-mine-manager-r30.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.lab-request-rd-mine-manager-r30.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-signoff-menu-penultimate-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-signoff-menu-penultimate-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-signoff-menu-penultimate-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-equipment-management-menu-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-equipment-management-menu-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-equipment-management-menu-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-process-equipment-menu-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-process-equipment-menu-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-process-equipment-menu-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-remove-duplicate-label-oem-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-remove-duplicate-label-oem-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-remove-duplicate-label-oem-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-project-proposal-menu-first-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-project-proposal-menu-first-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-project-proposal-menu-first-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-menu-business-flow-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-menu-business-flow-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-menu-business-flow-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-cross-dept-submenu-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-cross-dept-submenu-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-cross-dept-submenu-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-menu-dept-reorder-r01',
    date: '2026-09-23',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-menu-dept-reorder-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-menu-dept-reorder-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-list-three-bucket-layout-r02',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-list-three-bucket-layout-r02.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-list-three-bucket-layout-r02.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-list-three-bucket-layout-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-list-three-bucket-layout-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-list-three-bucket-layout-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-host-list-row-actions-r02',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-host-list-row-actions-r02.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-host-list-row-actions-r02.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-oa-host-list-row-actions-r01',
    date: '2026-09-23',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.funide-oa-host-list-row-actions-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-oa-host-list-row-actions-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'project-proposal-funide-menu-route-r01',
    date: '2026-09-21',
    type: 'fix',
    titleKey: 'pages.dashboard.updateLog.entries.project-proposal-funide-menu-route-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.project-proposal-funide-menu-route-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-phase1-template-profile-r01',
    date: '2026-09-21',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-phase1-template-profile-r01.title',
    descriptionKey:
      'pages.dashboard.updateLog.entries.funide-phase1-template-profile-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
  {
    id: 'funide-rd-quality-2691-gap-r01',
    date: '2026-09-21',
    type: 'improvement',
    titleKey: 'pages.dashboard.updateLog.entries.funide-rd-quality-2691-gap-r01.title',
    descriptionKey: 'pages.dashboard.updateLog.entries.funide-rd-quality-2691-gap-r01.description',
    scope: 'dedicated',
    dedicatedAppCode: 'funide-oa',
  },
];
