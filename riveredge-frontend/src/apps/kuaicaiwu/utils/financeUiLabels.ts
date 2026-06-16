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
};

export function formatSettlementType(value: string | null | undefined, t: TFunction): string {
  if (!value) return t('app.kuaicaiwu.financeUi.settlement.normal');
  const i18nKey = SETTLEMENT_TYPE_I18N_KEY[value];
  return i18nKey ? t(i18nKey) : value;
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

const COST_ITEM_TYPE_I18N_KEY: Record<string, string> = {
  material: 'app.kuaicaiwu.financeUi.costItem.material',
  material_cost: 'app.kuaicaiwu.financeUi.costItem.material',
  labor: 'app.kuaicaiwu.financeUi.costItem.labor',
  overhead: 'app.kuaicaiwu.financeUi.costItem.overhead',
};

export function formatCostItemType(value: string | null | undefined, t: TFunction): string {
  if (!value) return '—';
  const i18nKey = COST_ITEM_TYPE_I18N_KEY[value];
  return i18nKey ? t(i18nKey) : value;
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
