/**
 * 快财务：后端枚举/键值 → 界面中文文案（面向国内中小企业）
 */

/** 应收/应付账龄区间（与 finance_service 返回键一致） */
export const AGING_BUCKET_ORDER = ['within_30', '31_60', '61_90', 'over_90'] as const;

const AGING_BUCKET_LABEL: Record<string, string> = {
  within_30: '30 天以内',
  '31_60': '31～60 天',
  '61_90': '61～90 天',
  over_90: '超过 90 天',
  total: '合计',
};

export function formatAgingBucket(key: string): string {
  return AGING_BUCKET_LABEL[key] ?? key.replace(/_/g, ' ');
}

export type AgingBucketData = { count: number; amount: number };

export function orderedAgingRows(data?: Record<string, AgingBucketData>) {
  if (!data) return [];
  const ordered = AGING_BUCKET_ORDER.filter((k) => k in data).map((bucket) => ({
    bucket,
    label: formatAgingBucket(bucket),
    count: data[bucket].count,
    amount: data[bucket].amount,
  }));
  const rest = Object.keys(data)
    .filter((k) => k !== 'total' && !AGING_BUCKET_ORDER.includes(k as (typeof AGING_BUCKET_ORDER)[number]))
    .map((bucket) => ({
      bucket,
      label: formatAgingBucket(bucket),
      count: data[bucket].count,
      amount: data[bucket].amount,
    }));
  return [...ordered, ...rest];
}

export function agingChartData(data?: Record<string, AgingBucketData>) {
  return orderedAgingRows(data).map((row) => ({
    type: row.label,
    value: row.amount,
  }));
}

/** 收付款结算方式 */
const SETTLEMENT_TYPE_LABEL: Record<string, string> = {
  normal: '普通收付',
  prepayment: '预收/预付',
};

export function formatSettlementType(value?: string | null): string {
  if (!value) return '普通收付';
  return SETTLEMENT_TYPE_LABEL[value] ?? value;
}

/** 标准成本：核算对象类型 */
const TARGET_TYPE_LABEL: Record<string, string> = {
  material: '物料',
  work_center: '工作中心',
  work_station: '工位',
};

export function formatTargetType(value?: string | null): string {
  if (!value) return '—';
  return TARGET_TYPE_LABEL[value] ?? value;
}

/** 标准成本：成本项目 */
const COST_ITEM_TYPE_LABEL: Record<string, string> = {
  material: '材料',
  material_cost: '材料',
  labor: '人工',
  overhead: '制造费用',
};

export function formatCostItemType(value?: string | null): string {
  if (!value) return '—';
  return COST_ITEM_TYPE_LABEL[value] ?? value;
}

/** 币种（保留国际代码，补充中文说明） */
export const CURRENCY_SELECT_OPTIONS = [
  { label: '人民币（CNY）', value: 'CNY' },
  { label: '美元（USD）', value: 'USD' },
];

export function formatCurrency(code?: string | null): string {
  if (code === 'CNY') return '人民币';
  if (code === 'USD') return '美元';
  return code ?? '—';
}

/** 银行流水收支方向 */
export function formatBankDirection(direction?: string | null): '收入' | '支出' | string {
  if (direction === 'in' || direction === '收入') return '收入';
  if (direction === 'out' || direction === '支出') return '支出';
  return direction ?? '—';
}
