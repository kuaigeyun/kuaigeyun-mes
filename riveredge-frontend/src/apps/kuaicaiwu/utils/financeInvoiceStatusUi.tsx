import React from 'react';
import { Tag } from 'antd';
import type { TFunction } from 'i18next';

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
  return <Tag color={RECEIVABLE_INVOICE_STATUS_COLORS[status ?? ''] ?? 'default'}>{label}</Tag>;
}

export function renderPayableInvoiceStatusTag(
  status: string | undefined,
  t: TFunction,
): React.ReactElement {
  const label = formatPayableInvoiceStatusLabel(status, t);
  return <Tag color={PAYABLE_INVOICE_STATUS_COLORS[status ?? ''] ?? 'default'}>{label}</Tag>;
}
