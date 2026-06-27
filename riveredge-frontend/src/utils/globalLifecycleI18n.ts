/**
 * 全局生命周期阶段 i18n — 按 stage.key 翻译后端/兜底中文 label。
 *
 * - 与 documentStatus.* 重叠的 key 复用 documentStatus
 * - 其余阶段使用 lifecycle.stage.{key}
 * - 列表/详情组件（UniLifecycle、UniLifecycleStepper、ListUniLifecycleCell）统一消费
 */

import type { LifecycleResult, SubStage } from '../components/uni-lifecycle/types';

export type LifecycleTranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** 复用 documentStatus 的阶段 key（与 locales documentStatus.* 一致） */
const DOCUMENT_STATUS_STAGE_KEYS = new Set([
  'draft',
  'pending_review',
  'audited',
  'rejected',
  'approved',
  'confirmed',
  'cancelled',
  'effective',
  'in_progress',
  'delivered',
  'completed',
  // 注意：pending 不在此集合 — documentStatus.pending=「待审核」，业务轴须用 pending_ship / pending_inbound 等专用 key
  'submitted',
  'released',
  'split',
  'closed',
  'partial_converted',
  'full_converted',
]);

/** 仅 lifecycle.stage.* 的阶段 key（不含 documentStatus 已覆盖项） */
export const LIFECYCLE_ONLY_STAGE_KEYS = [
  'executing',
  'invoicing',
  'bom_check',
  'demand_compute',
  'material_ready',
  'work_order_create',
  'work_order_exec',
  'product_inbound',
  'sales_delivery',
  'pushed',
  'from_forecast',
  'from_order',
  'manual_plan',
  'sales_invoice',
  'receivable_collection',
  'production_plan',
  'work_order_released',
  'shipment_waiting',
  'material_picking',
  'first_inspection',
  'reporting',
  'process_qc',
  'fg_qc',
  'fg_receipt',
  'receipt_notice',
  'incoming_inspection',
  'purchase_receipt',
  'purchase_invoice',
  'executed',
  'partial',
  'full',
  'quoting',
  'pending_compare',
  'awarded',
  'converted',
  'generated',
  'customer_confirmed',
  'running',
  'applied',
  'picking',
  'pending_inbound',
  'pending_outbound',
  'pending_return',
  'returned',
  'pending_picking',
  'pending_delivery',
  'notified',
  'shipped',
  'receiving',
  'inspection',
  'inbound',
  'checking',
  'notify',
  'quality_check',
  'stock_in',
  'inspected',
  'testing',
  'review',
  'borrowed',
  'outbound',
  'on_hold',
  'settled',
  'calculated',
  'investigating',
  'correcting',
  'processing',
  'resolved',
  'plan',
  'execute',
  'maintain',
  'active',
  'inactive',
  'inventory',
  'alert',
  'normal',
  'repaired',
  'read',
  'unread',
  'handled',
  'batching',
  'disassembling',
  'assembling',
  'transferring',
  'stocktaking',
  'pending_revisit',
  'revisit_overdue',
  'no_revisit_needed',
  'recorded',
  'pending_ship',
  'pending_borrow',
  'pending_send',
  'pending_receive',
  'pending_material_return',
  'pending_calculation',
  'planned',
  'pending_return_goods',
  'returned_goods',
  'pending_inspection',
  'ready_to_ship',
  'failed',
  'send_or_push',
  'reviewed',
  'accepted',
  'sent',
] as const;

/**
 * 后端 current_stage_name / 列表筛选常用中文 → stage.key
 * （同一中文可能对应不同 key，此处取展示翻译时的优先 key）
 */
export const LIFECYCLE_ZH_LABEL_TO_KEY: Record<string, string> = {
  草稿: 'draft',
  待审核: 'pending_review',
  已审核: 'audited',
  已驳回: 'rejected',
  已通过: 'approved',
  已确认: 'confirmed',
  已生效: 'effective',
  执行中: 'executing',
  已下达: 'released',
  生产中: 'in_progress',
  已交货: 'delivered',
  发货出库: 'delivered',
  已送货: 'delivered',
  账款发票: 'invoicing',
  账款发票处理: 'invoicing',
  已完成: 'completed',
  已取消: 'cancelled',
  已拆分: 'split',
  已关闭: 'closed',
  部分转单: 'partial',
  全部转单: 'full',
  已下推: 'pushed',
  已下推计算: 'pushed',
  已下推入库: 'pushed',
  待入库: 'pending_inbound',
  已入库: 'inbound',
  待出库: 'pending_outbound',
  已出库: 'outbound',
  待退料: 'pending_return',
  已退料: 'returned',
  待领料: 'pending_picking',
  已领料: 'completed',
  待借出: 'pending_borrow',
  已借出: 'borrowed',
  待发货: 'pending_ship',
  待发送: 'pending_send',
  待收货: 'pending_receive',
  待归还: 'pending_material_return',
  已通知: 'notified',
  待退货: 'pending_return_goods',
  已退货: 'returned_goods',
  待检验: 'pending_inspection',
  已检验: 'inspected',
  配料中: 'batching',
  调拨中: 'transferring',
  盘点中: 'stocktaking',
  组装中: 'assembling',
  拆卸中: 'disassembling',
  询价中: 'quoting',
  待比价: 'pending_compare',
  已定标: 'awarded',
  已转单: 'converted',
  已报价: 'generated',
  客户确认: 'customer_confirmed',
  已转订单: 'converted',
  进行中: 'running',
  完成: 'completed',
  失败: 'failed',
  待计算: 'pending_calculation',
  计划中: 'planned',
  处理中: 'processing',
  已解决: 'resolved',
  调查中: 'investigating',
  纠正中: 'correcting',
  可发货: 'ready_to_ship',
  已执行: 'executed',
  已结清: 'settled',
  已核算: 'calculated',
  暂停: 'on_hold',
  计划: 'plan',
  执行: 'execute',
  结案: 'closed',
  维护: 'maintain',
  启用: 'active',
  停用: 'inactive',
  库存: 'inventory',
  预警: 'alert',
  正常: 'normal',
  已修复: 'repaired',
  已读: 'read',
  未读: 'unread',
  已处理: 'handled',
  提醒: 'notify',
};

export function resolveLifecycleStageI18nKey(stageKey: string): string | undefined {
  const key = stageKey.trim();
  if (!key) return undefined;
  if (DOCUMENT_STATUS_STAGE_KEYS.has(key)) {
    return `documentStatus.${key}`;
  }
  if ((LIFECYCLE_ONLY_STAGE_KEYS as readonly string[]).includes(key)) {
    return `lifecycle.stage.${key}`;
  }
  return undefined;
}

/** stage.key → i18n key（全局，模块专用 key 可覆盖） */
export function getGlobalLifecycleStageLabelKeys(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const key of DOCUMENT_STATUS_STAGE_KEYS) {
    map[key] = `documentStatus.${key}`;
  }
  for (const key of LIFECYCLE_ONLY_STAGE_KEYS) {
    map[key] = `lifecycle.stage.${key}`;
  }
  return map;
}

export function translateLifecycleStageByKey(
  t: LifecycleTranslateFn,
  stageKey: string | undefined,
  fallbackLabel?: string,
): string {
  if (stageKey) {
    const i18nKey = resolveLifecycleStageI18nKey(stageKey);
    if (i18nKey) {
      const translated = t(i18nKey);
      if (translated && translated !== i18nKey) return translated;
    }
  }
  const label = (fallbackLabel ?? '').trim();
  if (!label || label === '-') return label || '-';
  const keyFromZh = LIFECYCLE_ZH_LABEL_TO_KEY[label];
  if (keyFromZh) {
    const i18nKey = resolveLifecycleStageI18nKey(keyFromZh);
    if (i18nKey) {
      const translated = t(i18nKey);
      if (translated && translated !== i18nKey) return translated;
    }
  }
  return label;
}

/** documentStatus.* 中与审核态同名、不可用作业务 stage.key 的项（业务轴应使用 pending_ship 等专用 key） */
const AUDIT_SEMANTIC_DOCUMENT_STATUS_KEYS = new Set([
  'draft',
  'pending',
  'pending_review',
  'audited',
  'rejected',
  'approved',
]);

export function translateLifecycleSubStage(
  t: LifecycleTranslateFn,
  stage: SubStage,
  stageLabelKeysByKey?: Record<string, string>,
): SubStage {
  const globalKeys = getGlobalLifecycleStageLabelKeys();
  const mergedKeys = { ...globalKeys, ...stageLabelKeysByKey };

  const moduleKey = stageLabelKeysByKey?.[stage.key];
  if (moduleKey) {
    const translated = t(moduleKey);
    if (translated && translated !== moduleKey) {
      return { ...stage, label: translated };
    }
  }

  const backendLabel = (stage.label ?? '').trim();
  if (
    backendLabel &&
    backendLabel !== '-' &&
    backendLabel !== '—' &&
    AUDIT_SEMANTIC_DOCUMENT_STATUS_KEYS.has(stage.key)
  ) {
    const docKey = globalKeys[stage.key];
    const docTranslated = docKey ? t(docKey) : undefined;
    if (!docTranslated || docTranslated === backendLabel) {
      if (docTranslated) {
        return { ...stage, label: docTranslated };
      }
    }
    const label = translateLifecycleStageByKey(t, stage.key, backendLabel);
    return { ...stage, label: label || backendLabel };
  }

  const i18nKey = mergedKeys[stage.key];
  if (i18nKey) {
    const translated = t(i18nKey);
    if (translated && translated !== i18nKey) {
      return { ...stage, label: translated };
    }
  }

  const resolvedKey = resolveLifecycleStageI18nKey(stage.key);
  const label = resolvedKey
    ? t(resolvedKey)
    : translateLifecycleStageByKey(t, stage.key, stage.label);
  return { ...stage, label: label || stage.label };
}

/**
 * 翻译 LifecycleResult（mainStages / subStages / stageName）。
 * moduleStageLabelKeys 优先于全局 key。
 */
export function translateLifecycleResult(
  t: LifecycleTranslateFn,
  result: LifecycleResult,
  moduleStageLabelKeys?: Record<string, string>,
): LifecycleResult {
  const mergedKeys = { ...getGlobalLifecycleStageLabelKeys(), ...moduleStageLabelKeys };

  const mainStages = result.mainStages?.map((s) => translateLifecycleSubStage(t, s, mergedKeys));
  const subStages = result.subStages?.map((s) => translateLifecycleSubStage(t, s, mergedKeys));

  const activeKey =
    mainStages?.find((s) => s.status === 'active')?.key ??
    result.mainStages?.find((s) => s.status === 'active')?.key;

  const terminalKey = (() => {
    if (activeKey) return activeKey;
    const stages = mainStages ?? result.mainStages ?? [];
    const done = stages.filter((s) => s.status === 'done');
    if (done.length) return done[done.length - 1]?.key;
    return stages[stages.length - 1]?.key;
  })();

  let stageName = (result.stageName ?? '').trim();
  const backendStageName = stageName;

  if (terminalKey && moduleStageLabelKeys?.[terminalKey]) {
    const translated = t(moduleStageLabelKeys[terminalKey]!);
    if (translated && translated !== moduleStageLabelKeys[terminalKey]) {
      stageName = translated;
    }
  } else if (
    backendStageName &&
    backendStageName !== '-' &&
    backendStageName !== '—' &&
    terminalKey &&
    AUDIT_SEMANTIC_DOCUMENT_STATUS_KEYS.has(terminalKey)
  ) {
    const docKey = getGlobalLifecycleStageLabelKeys()[terminalKey];
    const docTranslated = docKey ? t(docKey) : undefined;
    if (docTranslated && docTranslated === backendStageName) {
      stageName = docTranslated;
    } else {
      stageName = translateLifecycleStageByKey(t, terminalKey, backendStageName);
    }
  } else if (terminalKey && mergedKeys[terminalKey]) {
    stageName = t(mergedKeys[terminalKey]!);
  } else if (backendStageName) {
    stageName = translateLifecycleStageByKey(t, terminalKey, backendStageName);
  }

  let subLabel = result.subLabel;
  if (subLabel) {
    subLabel = translateLifecycleStageByKey(t, undefined, subLabel);
  }

  return {
    ...result,
    stageName,
    mainStages,
    subStages,
    subLabel,
  };
}

/** 列表筛选 valueEnum：按 stage key 生成翻译文案 */
export function buildGlobalLifecycleValueEnum(
  t: LifecycleTranslateFn,
  stageKeys: readonly string[],
): Record<string, { text: string }> {
  return Object.fromEntries(
    stageKeys.map((key) => [key, { text: translateLifecycleStageByKey(t, key, key) }]),
  );
}
