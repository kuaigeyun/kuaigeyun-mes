import { formatCurrencyAmount } from '../../../utils/format';
import React from 'react';
import { Space, Typography } from 'antd';
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../constants/statusBadges';
import type { DocumentTrackingRelation } from '../../../services/documentTracking';

const RECEIVABLE_INVOICE_STATUS_COLORS: Record<string, string> = {
  未开票: 'default',
  部分开票: 'processing',
  已开票: 'success',
};

const PAYABLE_INVOICE_STATUS_COLORS: Record<string, string> = {
  未收票: 'default',
  部分收票: 'processing',
  已收票: 'success',
};

export function formatReceivableInvoiceStatusLabel(status: string | undefined, t: TFunction): string {
  switch (status) {
    case '部分开票':
      return t('app.kuaicaiwu.receivable.invoiceStatus.partial');
    case '已开票':
      return t('app.kuaicaiwu.receivable.invoiceStatus.issuedFull');
    default:
      return t('app.kuaicaiwu.receivable.invoiceStatus.notIssued');
  }
}

export function formatPayableInvoiceStatusLabel(status: string | undefined, t: TFunction): string {
  switch (status) {
    case '部分收票':
      return t('app.kuaicaiwu.payable.invoiceStatus.partial');
    case '已收票':
      return t('app.kuaicaiwu.payable.invoiceStatus.receivedFull');
    default:
      return t('app.kuaicaiwu.payable.invoiceStatus.notReceived');
  }
}

export function renderReceivableInvoiceStatusTag(
  status: string | undefined,
  t: TFunction,
): React.ReactElement {
  const label = formatReceivableInvoiceStatusLabel(status, t);
  return (
    <MarkerTag color={RECEIVABLE_INVOICE_STATUS_COLORS[status ?? ''] ?? 'default'}>{label}</MarkerTag>
  );
}

export function renderPayableInvoiceStatusTag(
  status: string | undefined,
  t: TFunction,
): React.ReactElement {
  const label = formatPayableInvoiceStatusLabel(status, t);
  return (
    <MarkerTag color={PAYABLE_INVOICE_STATUS_COLORS[status ?? ''] ?? 'default'}>{label}</MarkerTag>
  );
}

function formatMoney(value: number | undefined): string {
  return formatCurrencyAmount(value ?? 0);
}

export type FinanceArApInvoiceStatusDetailProps = {
  kind: 'receivable' | 'payable';
  invoiceStatus?: string;
  invoicedAmount?: number;
  remainingInvoiceAmount?: number;
  linkedInvoices?: DocumentTrackingRelation[];
  onInvoiceClick?: (documentType: string, documentId: number) => void;
  t: TFunction;
};

export function FinanceArApInvoiceStatusDetail({
  kind,
  invoiceStatus,
  invoicedAmount,
  remainingInvoiceAmount,
  linkedInvoices = [],
  onInvoiceClick,
  t,
}: FinanceArApInvoiceStatusDetailProps): React.ReactElement {
  const prefix = kind === 'receivable' ? 'app.kuaicaiwu.receivable' : 'app.kuaicaiwu.payable';
  const invoiceDocType = kind === 'receivable' ? 'sales_invoice' : 'purchase_invoice';
  const statusTag =
    kind === 'receivable'
      ? renderReceivableInvoiceStatusTag(invoiceStatus, t)
      : renderPayableInvoiceStatusTag(invoiceStatus, t);

  return (
    <Space direction="vertical" size={4}>
      {statusTag}
      {invoicedAmount != null || remainingInvoiceAmount != null ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t(`${prefix}.invoiceStatus.detailSummary`, {
            invoiced: formatMoney(invoicedAmount),
            remaining: formatMoney(remainingInvoiceAmount),
          })}
        </Typography.Text>
      ) : null}
      {linkedInvoices.length > 0 ? (
        <Space size={[8, 4]} wrap>
          {linkedInvoices.map((inv) =>
            onInvoiceClick && !inv.is_deleted ? (
              <Typography.Link
                key={`${inv.type}-${inv.id}`}
                onClick={() => onInvoiceClick(invoiceDocType, inv.id)}
              >
                {inv.code || `#${inv.id}`}
              </Typography.Link>
            ) : (
              <Typography.Text key={`${inv.type}-${inv.id}`} type="secondary">
                {inv.code || `#${inv.id}`}
              </Typography.Text>
            ),
          )}
        </Space>
      ) : null}
    </Space>
  );
}
