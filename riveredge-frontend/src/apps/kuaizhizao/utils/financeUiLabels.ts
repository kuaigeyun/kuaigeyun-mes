/**
 * 快财务：后端枚举/键值 → 界面文案
 */
import type { TFunction } from 'i18next';

/** 应收/应付账龄区间（与 finance_service 返回键一致） */
export const AGING_BUCKET_ORDER = ['within_30', '31_60', '61_90', 'over_90'] as const;

const AGING_BUCKET_I18N_KEY: Record<string, string> = {
  within_30: 'app.kuaicaiwu.financeUi.aging.within30',
  '31_60': 'app.kuaicaiwu.financeUi.aging.days31to60',
  '61_90': 'app.kuaicaiwu.financeUi.aging.days61to90',
  over_90: 'app.kuaicaiwu.financeUi.aging.over90',
  total: 'app.kuaicaiwu.financeUi.aging.total',
};

export function formatAgingBucket(key: string, t: TFunction): string {
  const i18nKey = AGING_BUCKET_I18N_KEY[key];
  return i18nKey ? t(i18nKey) : key.replace(/_/g, ' ');
}

export type AgingBucketData = { count: number; amount: number };

export function orderedAgingRows(data: Record<string, AgingBucketData> | undefined, t: TFunction) {
  if (!data) return [];
  const ordered = AGING_BUCKET_ORDER.filter((k) => k in data).map((bucket) => ({
    bucket,
    label: formatAgingBucket(bucket, t),
    count: data[bucket].count,
    amount: data[bucket].amount,
  }));
  const rest = Object.keys(data)
    .filter((k) => k !== 'total' && !AGING_BUCKET_ORDER.includes(k as (typeof AGING_BUCKET_ORDER)[number]))
    .map((bucket) => ({
      bucket,
      label: formatAgingBucket(bucket, t),
      count: data[bucket].count,
      amount: data[bucket].amount,
    }));
  return [...ordered, ...rest];
}

export function agingChartData(data: Record<string, AgingBucketData> | undefined, t: TFunction) {
  return orderedAgingRows(data, t).map((row) => ({
    type: row.label,
    value: row.amount,
  }));
}

const SETTLEMENT_TYPE_I18N_KEY: Record<string, string> = {
  normal: 'app.kuaicaiwu.financeUi.settlement.normal',
  prepayment: 'app.kuaicaiwu.financeUi.settlement.prepayment',
  refund: 'app.kuaicaiwu.financeUi.settlement.refund',
};

export function formatSettlementType(value: string | null | undefined, t: TFunction): string {
  if (!value) return t('app.kuaicaiwu.financeUi.settlement.normal');
  const i18nKey = SETTLEMENT_TYPE_I18N_KEY[value];
  return i18nKey ? t(i18nKey) : value;
}

const REFUND_EXECUTION_STATUS_I18N_KEY: Record<string, string> = {
  未退款: 'app.kuaicaiwu.financeUi.refundExecution.none',
  部分退款: 'app.kuaicaiwu.financeUi.refundExecution.partial',
  全部退款: 'app.kuaicaiwu.financeUi.refundExecution.full',
};

export function formatRefundExecutionStatus(value: string | null | undefined, t: TFunction): string {
  if (!value) return t('app.kuaicaiwu.financeUi.refundExecution.none');
  const i18nKey = REFUND_EXECUTION_STATUS_I18N_KEY[value];
  return i18nKey ? t(i18nKey) : value;
}

export function renderRefundExecutionMarker(value: string | null | undefined, t: TFunction) {
  const raw = String(value || '未退款');
  const label = formatRefundExecutionStatus(raw, t);
  if (raw === '全部退款') return { label, color: 'success' as const };
  if (raw === '部分退款') return { label, color: 'warning' as const };
  return { label, color: 'default' as const };
}

const TARGET_TYPE_I18N_KEY: Record<string, string> = {
  material: 'app.kuaicaiwu.financeUi.targetType.material',
  work_center: 'app.kuaicaiwu.financeUi.targetType.workCenter',
  work_station: 'app.kuaicaiwu.financeUi.targetType.workStation',
};

export function formatTargetType(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const i18nKey = TARGET_TYPE_I18N_KEY[value];
  return i18nKey ? t(i18nKey) : value;
}

/** 标准成本库 cost_item_type（与后端 StandardCost 模型一致） */
export const COST_ITEM_TYPE_CANONICAL = ['material_cost', 'labor_rate', 'overhead_rate'] as const;

const COST_ITEM_TYPE_I18N_KEY: Record<string, string> = {
  material: 'app.kuaicaiwu.financeUi.costItem.material',
  material_cost: 'app.kuaicaiwu.financeUi.costItem.materialCost',
  labor: 'app.kuaicaiwu.financeUi.costItem.labor',
  labor_rate: 'app.kuaicaiwu.financeUi.costItem.laborRate',
  overhead: 'app.kuaicaiwu.financeUi.costItem.overhead',
  overhead_rate: 'app.kuaicaiwu.financeUi.costItem.overheadRate',
};

export function formatCostItemType(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const i18nKey = COST_ITEM_TYPE_I18N_KEY[value];
  return i18nKey ? t(i18nKey) : value;
}

export function getCostItemTypeSelectOptions(t: TFunction) {
  return COST_ITEM_TYPE_CANONICAL.map((value) => ({
    label: formatCostItemType(value, t),
    value,
  }));
}

export function getCurrencySelectOptions(t: TFunction) {
  return [
    { label: t('app.kuaicaiwu.financeUi.currency.cny'), value: 'CNY' },
    { label: t('app.kuaicaiwu.financeUi.currency.usd'), value: 'USD' },
  ];
}

export function formatCurrency(code: string | null | undefined, t: TFunction): string {
  if (code === 'CNY') return t('app.kuaicaiwu.financeUi.currency.cnyShort');
  if (code === 'USD') return t('app.kuaicaiwu.financeUi.currency.usdShort');
  return code ?? '—';
}

export function formatBankDirection(
  direction: string | null | undefined,
  t: TFunction,
): string {
  if (direction === 'in' || direction === '收入') return t('app.kuaicaiwu.financeUi.bankDirection.in');
  if (direction === 'out' || direction === '支出') return t('app.kuaicaiwu.financeUi.bankDirection.out');
  return direction ?? '—';
}

const NOTE_BILL_TYPE_I18N_KEY: Record<string, string> = {
  bank_acceptance: 'app.kuaicaiwu.notes.billType.bankAcceptance',
  commercial_acceptance: 'app.kuaicaiwu.notes.billType.commercialAcceptance',
  bank_draft: 'app.kuaicaiwu.notes.billType.bankDraft',
  bank_promissory_note: 'app.kuaicaiwu.notes.billType.bankPromissoryNote',
  cheque: 'app.kuaicaiwu.notes.billType.cheque',
};

/** 新建/筛选下拉顺序（与客户票种清单一致） */
const NOTE_BILL_TYPE_ORDER: readonly string[] = [
  'bank_acceptance',
  'commercial_acceptance',
  'bank_draft',
  'bank_promissory_note',
  'cheque',
];

export function formatNoteBillType(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const i18nKey = NOTE_BILL_TYPE_I18N_KEY[value];
  return i18nKey ? t(i18nKey) : value;
}

export function getNoteBillTypeSelectOptions(t: TFunction) {
  return NOTE_BILL_TYPE_ORDER.map((value) => ({
    label: formatNoteBillType(value, t),
    value,
  }));
}

const NOTE_STATUS_I18N_KEY: Record<string, string> = {
  held: 'app.kuaicaiwu.notes.status.held',
  endorsed: 'app.kuaicaiwu.notes.status.endorsed',
  discounted: 'app.kuaicaiwu.notes.status.discounted',
  collected: 'app.kuaicaiwu.notes.status.collected',
  dishonored: 'app.kuaicaiwu.notes.status.dishonored',
  issued: 'app.kuaicaiwu.notes.status.issued',
  honored: 'app.kuaicaiwu.notes.status.honored',
};

export function formatNoteStatus(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const i18nKey = NOTE_STATUS_I18N_KEY[value];
  return i18nKey ? t(i18nKey) : value;
}

export function getNoteStatusSelectOptions(direction: 'receivable' | 'payable', t: TFunction) {
  const keys =
    direction === 'receivable'
      ? ['held', 'endorsed', 'discounted', 'collected', 'dishonored']
      : ['issued', 'honored', 'dishonored'];
  return keys.map((value) => ({ label: formatNoteStatus(value, t), value }));
}
