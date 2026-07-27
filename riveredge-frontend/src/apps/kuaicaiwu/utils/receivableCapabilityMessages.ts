import type { TFunction } from 'i18next';

const FALLBACK: Record<string, string> = {
  'receivable.pull_from_sales_order.not_allowed': '当前状态的销售订单不可加载应收单',
  'receivable.pull_from_sales_order.no_lines': '销售订单无可应收金额',
  'receivable.pull_from_sales_order.already_pulled': '销售订单可应收金额已全部占用，删除未审核应收单后可再次加载',
  'receivable.pull_from_sales_delivery.not_allowed': '当前状态的销售出库单不可加载应收单',
  'receivable.pull_from_sales_delivery.no_lines': '销售出库单无可应收金额',
  'receivable.pull_from_sales_delivery.already_pulled': '销售出库单可应收金额已全部占用，删除未审核应收单后可再次加载',
  'receipt.pull_from_receivable.not_allowed': '当前状态的应收单不可加载收款单',
  'receipt.pull_from_receivable.no_lines': '应收单无可收款金额',
  'receipt.pull_from_receivable.already_pulled': '应收单可收款金额已全部占用，作废未核销收款单后可再次加载',
};

export const receivableCapabilityReasonMessage = (reason: string | undefined | null, t: TFunction): string => {
  if (!reason) return '';
  const key = `app.kuaicaiwu.receivable.capability.${reason}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return FALLBACK[reason] ?? reason;
};
