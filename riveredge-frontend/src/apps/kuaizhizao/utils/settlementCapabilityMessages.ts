import type { TFunction } from 'i18next';

const FALLBACK: Record<string, string> = {
  'settlement.receivable.not_allowed': '当前状态的应收单不可核销',
  'settlement.receivable.customer_mismatch': '应收单与收款单客户不一致，不可核销',
  'settlement.receivable.receipt_not_allowed': '当前状态的收款单不可核销',
  'settlement.receivable.no_balance': '应收待收与收款余额均为零，无可核销金额',
  'settlement.payable.not_allowed': '当前状态的应付单不可核销',
  'settlement.payable.supplier_mismatch': '应付单与付款单供应商不一致，不可核销',
  'settlement.payable.payment_not_allowed': '当前状态的付款单不可核销',
  'settlement.payable.no_balance': '应付待付与付款余额均为零，无可核销金额',
  'settlement.amount_invalid': '请输入正确的核销金额',
};

export const settlementCapabilityReasonMessage = (reason: string | undefined | null, t: TFunction): string => {
  if (!reason) return '';
  const key = `app.kuaicaiwu.settlement.capability.${reason}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return FALLBACK[reason] ?? reason;
};
