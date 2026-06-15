/**
 * 物料中心 Tab 配置（原配料中心；API task_type 不变，仅优化命名与顺序）
 *
 * 排序：配料执行 → 产线叫料 → 委外收发 → 备料建议 → 倒冲异常
 */

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

export const MATERIAL_CENTER_TABS: MaterialCenterTabMeta[] = [
  {
    key: 'batching_draft',
    label: '配料执行',
    hint: '已有配料单：同步缺料、选批号并完成主仓→线边拣选',
  },
  {
    key: 'material_call',
    label: '产线叫料',
    hint: '产线临时发起的要料请求，需尽快配料送达',
  },
  {
    key: 'outsource_issue',
    label: '委外发料',
    hint: '向委外供应商发出原材料，关联工单委外单',
  },
  {
    key: 'outsource_receipt',
    label: '委外收货',
    hint: '委外加工完成后收回半成品/成品入库',
  },
  {
    key: 'outsource_material_return',
    label: '委外退料',
    hint: '供应商退回未使用的委外发料原料，增加库存',
  },
  {
    key: 'outsource_product_return',
    label: '委外退货',
    hint: '委外成品不合格退回供应商，扣减库存',
  },
  {
    key: 'proactive_prep',
    label: '备料建议',
    hint: '系统根据工单与库存推算的缺料提醒，可生成配料单后再到「配料执行」处理',
  },
  {
    key: 'backflush_alert',
    label: '倒冲异常',
    hint: '报工倒冲扣账失败记录，需核对库存后重试',
  },
];

/** @deprecated 使用 MATERIAL_CENTER_TABS */
export const BATCHING_CENTER_TABS = MATERIAL_CENTER_TABS.filter(
  (t): t is MaterialCenterTabMeta & { key: BatchingTaskTabKey } =>
    t.key !== 'outsource_issue' &&
    t.key !== 'outsource_receipt' &&
    t.key !== 'outsource_material_return' &&
    t.key !== 'outsource_product_return',
);

export const BATCHING_TASK_TYPE_LABEL: Record<BatchingTaskTabKey, string> = {
  batching_draft: '配料执行',
  material_call: '产线叫料',
  proactive_prep: '备料建议',
  backflush_alert: '倒冲异常',
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
