import type { InboundReceiptType } from './inboundHubTypes';

export type PurchaseReceiptEntryHandoff = {
  lineWhByPoItemId: Record<number, number>;
  lineLocByPoItemId: Record<number, number | undefined>;
  lineLocCodeByPoItemId: Record<number, string>;
  lineBatchByPoItemId: Record<number, string>;
  lineSerialByPoItemId: Record<number, string[]>;
};

export type InboundPullDirectConfirmTarget = {
  id: number;
  receipt_type: InboundReceiptType;
  purchaseReceiptHandoff?: PurchaseReceiptEntryHandoff;
};

export type InboundPullEntryNavigationState = {
  inboundDirectConfirm?: InboundPullDirectConfirmTarget;
};
