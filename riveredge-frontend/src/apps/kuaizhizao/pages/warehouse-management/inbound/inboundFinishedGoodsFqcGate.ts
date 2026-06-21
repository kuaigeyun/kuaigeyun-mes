import type { TFunction } from 'i18next';
import { qualityApi, type EnsureFqcForFinishedGoodsReceiptResult } from '../../../services/quality-execution';

export async function fetchFinishedGoodsReceiptFqcEnsure(
  finishedGoodsReceiptId: string | number,
): Promise<EnsureFqcForFinishedGoodsReceiptResult> {
  return qualityApi.finishedGoodsInspection.ensureForFinishedGoodsReceipt(String(finishedGoodsReceiptId));
}

export async function fetchSemiFinishedGoodsReceiptFqcEnsure(
  semiFinishedGoodsReceiptId: string | number,
): Promise<EnsureFqcForFinishedGoodsReceiptResult> {
  return qualityApi.finishedGoodsInspection.ensureForSemiFinishedGoodsReceipt(String(semiFinishedGoodsReceiptId));
}

/** 批量确认：未通过检验时抛出后端 message */
export async function checkFinishedGoodsReceiptFqcForConfirm(
  finishedGoodsReceiptId: string | number,
  t?: TFunction,
): Promise<EnsureFqcForFinishedGoodsReceiptResult> {
  const ensure = await fetchFinishedGoodsReceiptFqcEnsure(finishedGoodsReceiptId);
  if (!ensure.can_confirm_inbound) {
    throw new Error(
      ensure.message ||
        t?.('app.kuaizhizao.warehouseInbound.fqc.ensureBlocked.content') ||
        '相关物料须完成成品检验并合格后方可确认入库',
    );
  }
  return ensure;
}

/** 批量确认半成品入库：未通过检验时抛出后端 message */
export async function checkSemiFinishedGoodsReceiptFqcForConfirm(
  semiFinishedGoodsReceiptId: string | number,
  t?: TFunction,
): Promise<EnsureFqcForFinishedGoodsReceiptResult> {
  const ensure = await fetchSemiFinishedGoodsReceiptFqcEnsure(semiFinishedGoodsReceiptId);
  if (!ensure.can_confirm_inbound) {
    throw new Error(
      ensure.message ||
        t?.('app.kuaizhizao.warehouseInbound.fqc.ensureBlocked.content') ||
        '相关物料须完成成品检验并合格后方可确认入库',
    );
  }
  return ensure;
}
