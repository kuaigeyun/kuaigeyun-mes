import type { TFunction } from 'i18next';

import { DOCUMENT_STATUS_SEMANTIC_COLOR } from '../../../constants/documentStatusColors';
import type { PurchaseArrivalProcessingStatus } from '../services/purchase-arrival';

const PROCESSING_STATUS_KEYS: PurchaseArrivalProcessingStatus[] = [
  'unprocessed',
  'reported',
  'pending_review',
  'approved',
  'change_pending',
  'changed',
  'rejected',
];

const PROCESSING_I18N_KEY: Record<PurchaseArrivalProcessingStatus, string> = {
  unprocessed: 'app.kuaizhizao.purchaseArrival.processing.unprocessed',
  reported: 'app.kuaizhizao.purchaseArrival.processing.reported',
  pending_review: 'app.kuaizhizao.purchaseArrival.processing.pendingReview',
  approved: 'app.kuaizhizao.purchaseArrival.processing.approved',
  change_pending: 'app.kuaizhizao.purchaseArrival.processing.changePending',
  changed: 'app.kuaizhizao.purchaseArrival.processing.changed',
  rejected: 'app.kuaizhizao.purchaseArrival.processing.rejected',
};

export function buildPurchaseArrivalProcessingStatusValueEnum(
  t: TFunction,
): Record<string, { text: string }> {
  return Object.fromEntries(
    PROCESSING_STATUS_KEYS.map((key) => [key, { text: t(PROCESSING_I18N_KEY[key]) }]),
  );
}

export function purchaseArrivalProcessingStatusLabel(
  t: TFunction,
  status?: PurchaseArrivalProcessingStatus | string | null,
): string {
  const key = String(status ?? 'unprocessed') as PurchaseArrivalProcessingStatus;
  return t(PROCESSING_I18N_KEY[key] ?? PROCESSING_I18N_KEY.unprocessed);
}

/** 处理状态 → StatusTag color（流程态，右固定 lifecycle 列） */
export function resolvePurchaseArrivalProcessingStatusTagColor(
  status?: PurchaseArrivalProcessingStatus | string | null,
): string {
  switch (status) {
    case 'changed':
    case 'approved':
      return DOCUMENT_STATUS_SEMANTIC_COLOR.success;
    case 'pending_review':
      return DOCUMENT_STATUS_SEMANTIC_COLOR.pending;
    case 'change_pending':
      return DOCUMENT_STATUS_SEMANTIC_COLOR.active;
    case 'reported':
      return DOCUMENT_STATUS_SEMANTIC_COLOR.draft;
    case 'rejected':
      return DOCUMENT_STATUS_SEMANTIC_COLOR.danger;
    case 'unprocessed':
    default:
      return DOCUMENT_STATUS_SEMANTIC_COLOR.muted;
  }
}
