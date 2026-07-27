import type { TFunction } from 'i18next';

const FALLBACK: Record<string, string> = {
  'payable.pull_from_purchase_order.not_allowed': '当前状态的采购订单不可加载应付单',
  'payable.pull_from_purchase_order.no_lines': '采购订单无可应付金额',
  'payable.pull_from_purchase_order.already_pulled': '采购订单可应付金额已全部占用，删除未审核应付单后可再次加载',
  'payable.pull_from_purchase_receipt.not_allowed': '当前状态的采购入库单不可加载应付单',
  'payable.pull_from_purchase_receipt.no_lines': '采购入库单无可应付金额',
  'payable.pull_from_purchase_receipt.already_pulled': '采购入库单可应付金额已全部占用，删除未审核应付单后可再次加载',
  'payment.pull_from_payable.not_allowed': '当前状态的应付单不可加载付款单',
  'payment.pull_from_payable.no_lines': '应付单无可付款金额',
  'payment.pull_from_payable.already_pulled': '应付单可付款金额已全部占用，作废未核销付款单后可再次加载',
};

export const payableCapabilityReasonMessage = (reason: string | undefined | null, t: TFunction): string => {
  if (!reason) return '';
  const key = `app.kuaicaiwu.payable.capability.${reason}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return FALLBACK[reason] ?? reason;
};
