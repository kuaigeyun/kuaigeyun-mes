/**
 * 关联单据：付款单原版详情（只取数 + FinanceVoucherDetailDrawer）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { FinanceVoucherDetailDrawer } from '../../../apps/kuaizhizao/pages/finance-management/shared/FinanceVoucherDetailDrawer';
import {
  paymentService,
  type PaymentVoucher,
} from '../../../apps/kuaizhizao/services/finance/payment';
import { getApiErrorMessage } from '../../../utils/errorHandler';

export type PaymentLinkedDetailDrawerProps = {
  open: boolean;
  documentId: number;
  onClose: () => void;
  zIndex?: number;
};

export function PaymentLinkedDetailDrawer({
  open,
  documentId,
  onClose,
  zIndex,
}: PaymentLinkedDetailDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [record, setRecord] = useState<PaymentVoucher | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    if (!open || documentId <= 0) {
      setRecord(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setRecord((prev) => (prev?.id === documentId ? prev : null));
    try {
      setRecord(await paymentService.getPayment(documentId));
    } catch (e: unknown) {
      const msg = getApiErrorMessage(e, t('app.kuaicaiwu.payment.loadDetailFailed'));
      setRecord(null);
      setLoadError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [open, documentId, message, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const bankAccountLabel =
    String(record?.bank_account || '').trim()
    || (record?.bank_account_id ? `#${record.bank_account_id}` : '—');

  return (
    <FinanceVoucherDetailDrawer
      kind="payment"
      open={open}
      onClose={onClose}
      record={record}
      loading={loading}
      error={loadError}
      onRetry={() => setRefreshKey((k) => k + 1)}
      zIndex={zIndex}
      bankAccountLabel={bankAccountLabel}
    />
  );
}
