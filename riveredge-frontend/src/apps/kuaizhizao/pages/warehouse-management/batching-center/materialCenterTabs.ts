/**
 * 物料中心 Tab 配置（原配料中心；行级 API task_type 不变）
 *
 * 排序：线边备料（建议+执行）→ 产线补料 → 委外收发 → 倒冲异常
 */

import type { TFunction } from 'i18next';

/** 列表请求 / Tab 键；含历史拆分键以便 URL 映射与行级标签 */
export type BatchingTaskTabKey =
  | 'line_side_prep'
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

/** 旧 URL ?tab= 映射到合并后的线边备料 */
export const LEGACY_MATERIAL_CENTER_TAB_ALIAS: Record<string, MaterialCenterTabKey> = {
  proactive_prep: 'line_side_prep',
  batching_draft: 'line_side_prep',
};

export function resolveMaterialCenterTabKey(raw: string | null | undefined): MaterialCenterTabKey | null {
  if (!raw) return null;
  if (raw in LEGACY_MATERIAL_CENTER_TAB_ALIAS) {
    return LEGACY_MATERIAL_CENTER_TAB_ALIAS[raw];
  }
  return null;
}

export function getMaterialCenterTabs(t: TFunction): MaterialCenterTabMeta[] {
  return [
    {
      key: 'line_side_prep',
      label: t('app.kuaizhizao.batchingCenter.tab.lineSidePrep'),
      hint: t('app.kuaizhizao.batchingCenter.tab.lineSidePrepHint'),
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

/** 行级 task_type 展示文案（含合并列表内的建议/备料单） */
export function getBatchingTaskTypeLabel(t: TFunction): Record<
  Exclude<BatchingTaskTabKey, 'line_side_prep'>,
  string
> {
  return {
    batching_draft: t('app.kuaizhizao.batchingCenter.taskType.batchingDraft'),
    material_call: t('app.kuaizhizao.batchingCenter.taskType.materialCall'),
    proactive_prep: t('app.kuaizhizao.batchingCenter.taskType.proactivePrep'),
    backflush_alert: t('app.kuaizhizao.batchingCenter.taskType.backflushAlert'),
  };
}

/** @deprecated 使用 getBatchingTaskTypeLabel(t) */
export const BATCHING_TASK_TYPE_LABEL: Record<Exclude<BatchingTaskTabKey, 'line_side_prep'>, string> = {
  batching_draft: '',
  material_call: '',
  proactive_prep: '',
  backflush_alert: '',
};

export const DEFAULT_MATERIAL_CENTER_TAB: MaterialCenterTabKey = 'line_side_prep';

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
