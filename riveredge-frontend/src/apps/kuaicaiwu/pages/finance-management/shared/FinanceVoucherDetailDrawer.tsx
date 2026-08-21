/**
 * 收款单 / 付款单原版详情抽屉。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React, { useMemo } from 'react';
import { Button, Descriptions, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerBasicColumn,
  detailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { alignDescriptionColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { getFinanceVoucherLifecycle } from '../../../utils/financeLifecycle';
import {
  formatPaymentMethod,
  formatPaymentSettlementType,
  formatReceiptSettlementType,
  isAcceptanceBillPaymentMethod,
} from '../../../utils/financeSharedOptions';
import type { PaymentVoucher } from '../../../services/finance/payment';
import type { ReceiptVoucher } from '../../../services/finance/receipt';
import type { FinanceNote } from '../../../services/finance/note';
import { formatNoteBillType } from '../../../utils/financeUiLabels';

export type FinanceVoucherKind = 'receipt' | 'payment';
export type FinanceVoucherDetail = ReceiptVoucher | PaymentVoucher;

const RECEIPT_PLACEHOLDER: ReceiptVoucher = {
  id: 0,
  receipt_code: '',
  customer_id: 0,
  customer_name: '',
  total_amount: 0,
  settled_amount: 0,
  unsettled_amount: 0,
  receipt_date: '',
  payment_method: '',
  status: '',
  created_at: '',
};

const PAYMENT_PLACEHOLDER: PaymentVoucher = {
  id: 0,
  payment_code: '',
  supplier_id: 0,
  supplier_name: '',
  total_amount: 0,
  settled_amount: 0,
  unsettled_amount: 0,
  payment_date: '',
  payment_method: '',
  status: '',
  created_at: '',
};

function formatMoney(value: unknown): string {
  return `¥${Number(value ?? 0).toFixed(2)}`;
}

export type FinanceVoucherDetailDrawerProps = {
  kind: FinanceVoucherKind;
  open: boolean;
  onClose: () => void;
  record: FinanceVoucherDetail | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
  bankAccountLabel: string;
  linkedNote?: FinanceNote | null;
  linkedNotePath?: string;
};

export const FinanceVoucherDetailDrawer: React.FC<FinanceVoucherDetailDrawerProps> = ({
  kind,
  open,
  onClose,
  record,
  loading = false,
  error = null,
  onRetry,
  extra,
  zIndex,
  bankAccountLabel,
  linkedNote,
  linkedNotePath,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isReceipt = kind === 'receipt';
  const prefix = isReceipt ? 'app.kuaicaiwu.receipt' : 'app.kuaicaiwu.payment';

  const contentReady = Boolean(record);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = record ?? (isReceipt ? RECEIPT_PLACEHOLDER : PAYMENT_PLACEHOLDER);

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns([
        isReceipt
          ? { title: t(`${prefix}.detail.code`), dataIndex: 'receipt_code' }
          : { title: t('app.kuaicaiwu.receipt.detail.code'), dataIndex: 'payment_code' },
        isReceipt
          ? { title: t(`${prefix}.col.receiptDate`), dataIndex: 'receipt_date', valueType: 'date' }
          : { title: t(`${prefix}.col.paymentDate`), dataIndex: 'payment_date', valueType: 'date' },
        isReceipt
          ? { title: t('app.kuaicaiwu.common.customer'), dataIndex: 'customer_name' }
          : { title: t('app.kuaicaiwu.common.supplier'), dataIndex: 'supplier_name' },
        {
          title: t(`${prefix}.col.paymentMethod`),
          dataIndex: 'payment_method',
          render: (_, row) => formatPaymentMethod(row.payment_method, t),
        },
        ...(isAcceptanceBillPaymentMethod(effective.payment_method)
          ? [
              {
                title: t('app.kuaicaiwu.common.referenceNumber'),
                dataIndex: 'bank_account',
                key: 'reference_number',
                render: (_: unknown, row: FinanceVoucherDetail) => row.bank_account || '—',
              } as ProDescriptionsItemProps<FinanceVoucherDetail>,
              ...(linkedNote
                ? [
                    {
                      title: t('app.kuaicaiwu.notes.linkField'),
                      key: 'linked_note',
                      render: () =>
                        linkedNotePath ? (
                          <a
                            onClick={() =>
                              navigate(
                                `${linkedNotePath}?keyword=${encodeURIComponent(linkedNote.bill_no)}`,
                              )
                            }
                          >
                            {linkedNote.bill_no} ({linkedNote.note_code})
                          </a>
                        ) : (
                          `${linkedNote.bill_no} (${linkedNote.note_code})`
                        ),
                    } as ProDescriptionsItemProps<FinanceVoucherDetail>,
                    {
                      title: t('app.kuaicaiwu.notes.col.billType'),
                      key: 'linked_note_type',
                      render: () => formatNoteBillType(linkedNote.bill_type, t),
                    } as ProDescriptionsItemProps<FinanceVoucherDetail>,
                  ]
                : []),
            ]
          : [
              {
                title: t('app.kuaicaiwu.receipt.detail.bankAccount'),
                dataIndex: 'bank_account_id',
                key: 'bank_account',
                render: () => bankAccountLabel || '—',
              } as ProDescriptionsItemProps<FinanceVoucherDetail>,
              {
                title: t('app.kuaicaiwu.receipt.detail.accountNote'),
                dataIndex: 'bank_account',
                key: 'bank_account_note',
                render: (_: unknown, row: FinanceVoucherDetail) => row.bank_account || '—',
              } as ProDescriptionsItemProps<FinanceVoucherDetail>,
            ]),
        {
          title: t(`${prefix}.settlementType.label`),
          dataIndex: 'settlement_type',
          render: (_, row) =>
            isReceipt
              ? formatReceiptSettlementType(row.settlement_type, t)
              : formatPaymentSettlementType(row.settlement_type, t),
        },
        {
          title: t(`${prefix}.col.amount`),
          dataIndex: 'total_amount',
          render: (_, row) => formatMoney(row.total_amount),
        },
        {
          title: t('app.kuaicaiwu.receipt.detail.settled'),
          dataIndex: 'settled_amount',
          render: (_, row) => formatMoney(row.settled_amount),
        },
        {
          title: t('app.kuaicaiwu.receipt.detail.unsettled'),
          dataIndex: 'unsettled_amount',
          render: (_, row) => formatMoney(row.unsettled_amount),
        },
        {
          title: t('common.remark'),
          dataIndex: 'notes',
          span: 3,
        },
        { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      ] as ProDescriptionsItemProps<FinanceVoucherDetail>[]),
    [bankAccountLabel, effective.payment_method, isReceipt, linkedNote, linkedNotePath, navigate, prefix, t],
  );

  const lifecycle = getFinanceVoucherLifecycle(effective as unknown as Record<string, unknown>, t);
  const steps = lifecycle.mainStages ?? [];
  const code = isReceipt
    ? String((effective as ReceiptVoucher).receipt_code ?? '').trim()
    : String((effective as PaymentVoucher).payment_code ?? '').trim();
  const title = code
    ? t(`${prefix}.detailDrawerTitle`, { code })
    : t(`${prefix}.detailTitle`);

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      loading={showLoading}
      extra={contentReady ? extra ?? null : null}
      plainBody={
        showError ? (
          <Result
            status="error"
            title={error}
            extra={
              onRetry ? (
                <Button type="primary" onClick={onRetry}>
                  {t('common.retry', { defaultValue: '重试' })}
                </Button>
              ) : null
            }
          />
        ) : undefined
      }
      basic={
        contentReady ? (
          <Descriptions
            column={detailDrawerBasicColumn(false)}
            size="small"
            items={detailDrawerDescriptionItems(basicColumns, effective)}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
      collaborationTitle={t('app.kuaicaiwu.common.lifecycle')}
      collaborationLifecycle={
        contentReady && steps.length > 0 ? (
          <UniLifecycleStepper
            steps={steps}
            showLabels
            status={lifecycle.status}
            nextStepSuggestions={lifecycle.nextStepSuggestions}
            hideNextStepSuggestions
          />
        ) : undefined
      }
    />
  );
};
