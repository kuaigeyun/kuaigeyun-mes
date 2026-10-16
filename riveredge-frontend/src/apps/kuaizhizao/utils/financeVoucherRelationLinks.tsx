import React from 'react';
import { Space, Typography } from 'antd';
import type { TFunction } from 'i18next';
import type { FinanceVoucherLinkHandlers } from '../components/FinanceVoucherDetailProvider';
import type {
  FinanceVoucherKind,
  FinanceVoucherLinkFields,
  FinanceVoucherOpenTarget,
} from '../types/finance/financeVoucherLinks';

type Props = {
  kind: FinanceVoucherKind;
  isRefund?: boolean;
  record: FinanceVoucherLinkFields;
  linkHandlers?: FinanceVoucherLinkHandlers;
  t: TFunction;
};

export function FinanceVoucherRelationLinks({
  kind,
  isRefund,
  record,
  linkHandlers,
  t,
}: Props): React.ReactElement | null {
  if (!linkHandlers) return null;

  const blocks: React.ReactNode[] = [];
  const prefix = 'app.kuaicaiwu.financeUi.voucher';

  if (isRefund) {
    const sources =
      record.source_vouchers && record.source_vouchers.length > 0
        ? record.source_vouchers
        : record.source_voucher_id
          ? [{ id: Number(record.source_voucher_id), code: String(record.source_voucher_code || record.source_voucher_id) }]
          : [];
    if (sources.length) {
      blocks.push(
        <div key="source">
          <Typography.Text type="secondary">{t(`${prefix}.sourceVoucher`)}</Typography.Text>
          <div>
            <Space size={8} wrap>
              {sources.map((src) => (
                <Typography.Link
                  key={src.id}
                  onClick={() =>
                    linkHandlers.openVoucher({
                      kind,
                      id: Number(src.id),
                      isRefund: false,
                    })
                  }
                >
                  {src.code || `#${src.id}`}
                </Typography.Link>
              ))}
            </Space>
          </div>
        </div>,
      );
    }
  }

  if (!isRefund && kind === 'payment' && (record.linked_source_documents?.length ?? 0) > 0) {
    blocks.push(
      <div key="pull-sources">
        <Typography.Text type="secondary">{t(`${prefix}.linkedSourceDocuments`)}</Typography.Text>
        <Space size={[8, 4]} wrap>
          {record.linked_source_documents!.map((doc) => {
            const typeLabel =
              doc.source_type === 'payable'
                ? t(`${prefix}.sourceType.payable`)
                : doc.source_type === 'payment_application'
                  ? t(`${prefix}.sourceType.paymentApplication`)
                  : doc.source_type;
            return (
              <Typography.Link
                key={`${doc.source_type}-${doc.id}`}
                onClick={() => linkHandlers.openSourceDocument?.(doc)}
              >
                {typeLabel} {doc.code || `#${doc.id}`}
              </Typography.Link>
            );
          })}
        </Space>
      </div>,
    );
  }

  if (!isRefund && (record.linked_refund_vouchers?.length ?? 0) > 0) {
    blocks.push(
      <div key="refunds">
        <Typography.Text type="secondary">{t(`${prefix}.linkedRefunds`)}</Typography.Text>
        <Space size={[8, 4]} wrap>
          {record.linked_refund_vouchers!.map((item) => (
            <Typography.Link
              key={item.id}
              onClick={() =>
                linkHandlers.openVoucher({
                  kind,
                  id: item.id,
                  isRefund: true,
                })
              }
            >
              {item.code}
            </Typography.Link>
          ))}
        </Space>
      </div>,
    );
  }

  if ((record.linked_partner_statements?.length ?? 0) > 0) {
    blocks.push(
      <div key="statements">
        <Typography.Text type="secondary">{t(`${prefix}.linkedPartnerStatements`)}</Typography.Text>
        <Space size={[8, 4]} wrap>
          {record.linked_partner_statements!.map((item) => (
            <Typography.Link key={item.id} onClick={() => linkHandlers.openPartnerStatement(item.id)}>
              {item.statement_code}
              {item.statement_period ? ` (${item.statement_period})` : ''}
            </Typography.Link>
          ))}
        </Space>
      </div>,
    );
  }

  if (blocks.length === 0) return null;

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      {blocks}
    </Space>
  );
}

export function openLinkedFinanceVoucherFromRecord(
  record: FinanceVoucherLinkFields & { id?: number },
  kind: FinanceVoucherKind,
  isRefund: boolean,
  openVoucher: (target: FinanceVoucherOpenTarget) => void,
): void {
  if (!record.id) return;
  openVoucher({ kind, id: record.id, isRefund });
}
