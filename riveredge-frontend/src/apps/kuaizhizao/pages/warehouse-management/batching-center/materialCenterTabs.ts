/**
 * 物料中心 Tab 配置（原配料中心；API task_type 不变，仅优化命名与顺序）
 *
 * 排序：配料执行 → 产线叫料 → 委外收发 → 备料建议 → 倒冲异常
 */

import type { TFunction } from 'i18next';

export type BatchingTaskTabKey =
  | 'material_call'
  | 'batching_draft'
  | 'proactive_prep'
  | 'backflush_alert';

export type OutsourceMaterialTabKey =
  | 'outsource_issue'
  | 'outsource_receipt'
  | 'outsource_material_return'
  | 'outsource_product_return';

export type MaterialCenterTabKey = BatchingTaskTabKey | OutsourceMaterialTabKey;

export type MaterialCenterTabMeta = {
  key: MaterialCenterTabKey;
  label: string;
  hint: string;
};

export function getMaterialCenterTabs(t: TFunction): MaterialCenterTabMeta[] {
  return [
    {
      key: 'batching_draft',
      label: t('app.kuaizhizao.batchingCenter.tab.batchingDraft'),
      hint: t('app.kuaizhizao.batchingCenter.tab.batchingDraftHint'),
    },
    {
      key: 'material_call',
      label: t('app.kuaizhizao.batchingCenter.tab.materialCall'),
      hint: t('app.kuaizhizao.batchingCenter.tab.materialCallHint'),
    },
    {
      key: 'outsource_issue',
      label: t('app.kuaizhizao.batchingCenter.tab.outsourceIssue'),
      hint: t('app.kuaizhizao.batchingCenter.tab.outsourceIssueHint'),
    },
    {
      key: 'outsource_receipt',
      label: t('app.kuaizhizao.batchingCenter.tab.outsourceReceipt'),
      hint: t('app.kuaizhizao.batchingCenter.tab.outsourceReceiptHint'),
    },
    {
      key: 'outsource_material_return',
      label: t('app.kuaizhizao.batchingCenter.tab.outsourceMaterialReturn'),
      hint: t('app.kuaizhizao.batchingCenter.tab.outsourceMaterialReturnHint'),
    },
    {
      key: 'outsource_product_return',
      label: t('app.kuaizhizao.batchingCenter.tab.outsourceProductReturn'),
      hint: t('app.kuaizhizao.batchingCenter.tab.outsourceProductReturnHint'),
    },
    {
      key: 'proactive_prep',
      label: t('app.kuaizhizao.batchingCenter.tab.proactivePrep'),
      hint: t('app.kuaizhizao.batchingCenter.tab.proactivePrepHint'),
    },
    {
      key: 'backflush_alert',
      label: t('app.kuaizhizao.batchingCenter.tab.backflushAlert'),
      hint: t('app.kuaizhizao.batchingCenter.tab.backflushAlertHint'),
    },
  ];
}

/** @deprecated 使用 getMaterialCenterTabs(t) */
export const MATERIAL_CENTER_TABS: MaterialCenterTabMeta[] = [];

/** @deprecated 使用 getMaterialCenterTabs(t) */
export const BATCHING_CENTER_TABS: MaterialCenterTabMeta[] = [];

export function getBatchingTaskTypeLabel(t: TFunction): Record<BatchingTaskTabKey, string> {
  return {
    batching_draft: t('app.kuaizhizao.batchingCenter.taskType.batchingDraft'),
    material_call: t('app.kuaizhizao.batchingCenter.taskType.materialCall'),
    proactive_prep: t('app.kuaizhizao.batchingCenter.taskType.proactivePrep'),
    backflush_alert: t('app.kuaizhizao.batchingCenter.taskType.backflushAlert'),
  };
}

/** @deprecated 使用 getBatchingTaskTypeLabel(t) */
export const BATCHING_TASK_TYPE_LABEL: Record<BatchingTaskTabKey, string> = {
  batching_draft: '',
  material_call: '',
  proactive_prep: '',
  backflush_alert: '',
};

export const DEFAULT_MATERIAL_CENTER_TAB: MaterialCenterTabKey = 'batching_draft';

/** @deprecated 使用 DEFAULT_MATERIAL_CENTER_TAB */
export const DEFAULT_BATCHING_CENTER_TAB = DEFAULT_MATERIAL_CENTER_TAB as BatchingTaskTabKey;

export function isBatchingTaskTab(key: MaterialCenterTabKey): key is BatchingTaskTabKey {
  return (
    key !== 'outsource_issue' &&
    key !== 'outsource_receipt' &&
    key !== 'outsource_material_return' &&
    key !== 'outsource_product_return'
  );
}
