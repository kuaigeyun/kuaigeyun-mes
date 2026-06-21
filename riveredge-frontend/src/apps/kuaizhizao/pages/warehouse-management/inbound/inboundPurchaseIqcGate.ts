import type { TFunction } from 'i18next';
import { qualityApi, type EnsureIqcForPurchaseReceiptResult } from '../../../services/quality-execution';

export async function fetchPurchaseReceiptIqcEnsure(
  purchaseReceiptId: string | number,
): Promise<EnsureIqcForPurchaseReceiptResult> {
  return qualityApi.incomingInspection.ensureForPurchaseReceipt(String(purchaseReceiptId));
}

/** 批量确认：未通过检验时抛出后端 message */
export async function checkPurchaseReceiptIqcForConfirm(
  purchaseReceiptId: string | number,
  t?: TFunction,
): Promise<EnsureIqcForPurchaseReceiptResult> {
  const ensure = await fetchPurchaseReceiptIqcEnsure(purchaseReceiptId);
  if (!ensure.can_confirm_inbound) {
    throw new Error(
      ensure.message ||
        t?.('app.kuaizhizao.warehouseInbound.iqc.ensureBlocked.content') ||
        '相关物料须完成来料检验并合格后方可确认入库',
    );
  }
  return ensure;
}
