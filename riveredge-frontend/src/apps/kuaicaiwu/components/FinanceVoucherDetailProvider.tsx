/**
 * 收/付款凭证详情抽屉（跨页打开：往来对账等场景）。
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FinanceVoucherDetailDrawer } from '../pages/finance-management/shared/FinanceVoucherDetailDrawer';
import { receiptService } from '../services/finance/receipt';
import { paymentService } from '../services/finance/payment';
import { receiptRefundService } from '../services/finance/receipt-refund';
import { paymentRefundService } from '../services/finance/payment-refund';
import { getApiErrorMessage } from '../../../utils/errorHandler';
import type {
  FinanceVoucherKind,
  FinanceVoucherLinkFields,
  FinanceVoucherOpenTarget,
} from '../types/finance/financeVoucherLinks';
import type { FinanceVoucherDetail } from '../pages/finance-management/shared/FinanceVoucherDetailDrawer';
import type { ReceiptVoucher } from '../services/finance/receipt';
import type { PaymentVoucher } from '../services/finance/payment';

type OpenFn = (target: FinanceVoucherOpenTarget) => void;

type CtxValue = {
  openFinanceVoucherDetail: OpenFn;
};

const FinanceVoucherDetailContext = createContext<CtxValue | null>(null);

export function useFinanceVoucherDetail(): CtxValue {
  const ctx = useContext(FinanceVoucherDetailContext);
  if (!ctx) {
    throw new Error('useFinanceVoucherDetail must be used within FinanceVoucherDetailProvider');
  }
  return ctx;
}

export function useOptionalFinanceVoucherDetail(): CtxValue | null {
  return useContext(FinanceVoucherDetailContext);
}

async function loadFinanceVoucher(
  target: FinanceVoucherOpenTarget,
): Promise<FinanceVoucherDetail & FinanceVoucherLinkFields> {
  if (target.kind === 'receipt') {
    return target.isRefund
      ? receiptRefundService.get(target.id)
      : receiptService.getReceipt(target.id);
  }
  return target.isRefund
    ? paymentRefundService.get(target.id)
    : paymentService.getPayment(target.id);
}

export const FinanceVoucherDetailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [target, setTarget] = useState<FinanceVoucherOpenTarget | null>(null);
  const [record, setRecord] = useState<(FinanceVoucherDetail & FinanceVoucherLinkFields) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFinanceVoucherDetail = useCallback<OpenFn>((next) => {
    if (!next.id) return;
    setTarget(next);
  }, []);

  const close = useCallback(() => {
    setTarget(null);
    setRecord(null);
    setError(null);
    setLoading(false);
  }, []);

  const reload = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const data = await loadFinanceVoucher(target);
      setRecord(data);
    } catch (err) {
      setRecord(null);
      setError(getApiErrorMessage(err, t('app.kuaicaiwu.financeUi.voucher.loadDetailFailed')));
    } finally {
      setLoading(false);
    }
  }, [t, target]);

  useEffect(() => {
    if (!target) {
      setRecord(null);
      setError(null);
      setLoading(false);
      return;
    }
    void reload();
  }, [reload, target]);

  const linkHandlers = useMemo(
    () => ({
      openVoucher: (next: FinanceVoucherOpenTarget) => openFinanceVoucherDetail(next),
      openPartnerStatement: (statementId: number) => {
        navigate(`/apps/kuaicaiwu/finance-management/partner-statements/${statementId}`);
      },
      createRefund: (kind: FinanceVoucherKind, sourceId: number) => {
        const path =
          kind === 'receipt'
            ? '/apps/kuaicaiwu/finance-management/receipt-refunds'
            : '/apps/kuaicaiwu/finance-management/payment-refunds';
        navigate(path, { state: { pullSourceId: sourceId } });
      },
    }),
    [navigate, openFinanceVoucherDetail],
  );

  const kind = target?.kind ?? 'receipt';
  const bankAccountLabel =
    kind === 'receipt'
      ? t('app.kuaicaiwu.receiptRefund.bankAccount')
      : t('app.kuaicaiwu.paymentRefund.bankAccount');

  return (
    <FinanceVoucherDetailContext.Provider value={{ openFinanceVoucherDetail }}>
      {children}
      <FinanceVoucherDetailDrawer
        kind={kind}
        open={Boolean(target)}
        onClose={close}
        record={record}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        bankAccountLabel={bankAccountLabel}
        linkHandlers={linkHandlers}
        isRefund={Boolean(target?.isRefund)}
      />
    </FinanceVoucherDetailContext.Provider>
  );
};

export type FinanceVoucherLinkHandlers = {
  openVoucher: (target: FinanceVoucherOpenTarget) => void;
  openPartnerStatement: (statementId: number) => void;
  createRefund: (kind: FinanceVoucherKind, sourceId: number) => void;
};

export function buildFinanceVoucherLinkHandlers(options: {
  openVoucher: (target: FinanceVoucherOpenTarget) => void;
  navigate: ReturnType<typeof useNavigate>;
}): FinanceVoucherLinkHandlers {
  return {
    openVoucher: options.openVoucher,
    openPartnerStatement: (statementId) => {
      options.navigate(`/apps/kuaicaiwu/finance-management/partner-statements/${statementId}`);
    },
    createRefund: (kind, sourceId) => {
      const path =
        kind === 'receipt'
          ? '/apps/kuaicaiwu/finance-management/receipt-refunds'
          : '/apps/kuaicaiwu/finance-management/payment-refunds';
      options.navigate(path, { state: { pullSourceId: sourceId } });
    },
  };
}

export function mergeFinanceVoucherRecord<T extends ReceiptVoucher | PaymentVoucher>(
  record: T,
): T & FinanceVoucherLinkFields {
  return record as T & FinanceVoucherLinkFields;
}
