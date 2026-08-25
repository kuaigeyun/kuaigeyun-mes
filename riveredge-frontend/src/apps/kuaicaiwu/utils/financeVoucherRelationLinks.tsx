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

  if (isRefund && record.source_voucher_id) {
    blocks.push(
      <div key="source">
        <Typography.Text type="secondary">{t(`${prefix}.sourceVoucher`)}</Typography.Text>
        <div>
          <Typography.Link
            onClick={() =>
              linkHandlers.openVoucher({
                kind,
                id: Number(record.source_voucher_id),
                isRefund: false,
              })
            }
          >
            {record.source_voucher_code || `#${record.source_voucher_id}`}
          </Typography.Link>
        </div>
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
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
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
