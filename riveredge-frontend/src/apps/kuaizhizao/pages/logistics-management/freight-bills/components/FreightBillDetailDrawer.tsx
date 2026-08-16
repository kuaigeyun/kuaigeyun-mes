/**
 * 运费单详情抽屉（列表共用）。
 * 单一 DetailDrawerTemplate：加载中遮罩，失败 Result+重试。
 */

import React, { useMemo } from 'react';
import { Button, Descriptions, Empty, Result, Table } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerBasicColumn,
  detailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { alignDescriptionColumns } from '../../../sales-management/shared/documentFieldAlignment';
import type { FreightBill, FreightBillItem } from '../../../../services/logistics';
import { renderFreightBillReviewStatusTag } from '../../shared/logisticsListPresentation';

const PLACEHOLDER: FreightBill = {
  id: 0,
  uuid: '',
  bill_code: '',
  carrier_id: 0,
  carrier_name: '',
  total_amount: 0,
  status: '',
  review_status: '',
};

export type FreightBillDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  bill: FreightBill | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  zIndex?: number;
  extra?: React.ReactNode;
};

export const FreightBillDetailDrawer: React.FC<FreightBillDetailDrawerProps> = ({
  open,
  onClose,
  bill,
  loading = false,
  error = null,
  onRetry,
  zIndex,
  extra,
}) => {
  const { t } = useTranslation();

  const contentReady = Boolean(bill);
  const showError = Boolean(error) && !contentReady && !loading;
  const showLoading = loading || (!contentReady && !showError);
  const effective = bill ?? PLACEHOLDER;

  const basicColumns = useMemo(
    () =>
      alignDescriptionColumns([
        { title: t('app.kuaizhizao.logistics.field.billCode'), dataIndex: 'bill_code' },
        { title: t('app.kuaizhizao.logistics.field.carrierName'), dataIndex: 'carrier_name' },
        {
          title: t('app.kuaizhizao.logistics.field.totalAmount'),
          dataIndex: 'total_amount',
          render: (_, row) => (row.total_amount != null ? row.total_amount : '-'),
        },
        {
          title: t('app.kuaizhizao.logistics.field.payableCode'),
          dataIndex: 'payable_code',
          render: (_, row) =>
            row.payable_id ? (
              <Link to={`/apps/kuaicaiwu/finance-management/payables/${row.payable_id}`}>{row.payable_code}</Link>
            ) : (
              '-'
            ),
        },
        {
          title: t('app.kuaizhizao.logistics.field.reviewerName'),
          dataIndex: 'reviewer_name',
        },
        {
          title: t('app.kuaizhizao.logistics.field.reviewedAt'),
          dataIndex: 'reviewed_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.logistics.field.reviewStatus'),
          dataIndex: 'review_status',
          render: (_, row) => renderFreightBillReviewStatusTag(t, row.review_status),
        },
        {
          title: t('common.remark'),
          dataIndex: 'remark',
          span: 3,
        },
      ] as ProDescriptionsItemProps<FreightBill>[]),
    [t],
  );

  const items = (effective.items ?? []) as FreightBillItem[];
  const code = String(effective.bill_code ?? '').trim();
  const title = `${t('app.kuaizhizao.logistics.detail.freightBillTitle')}${code ? ` - ${code}` : ''}`;

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={title}
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.HALF_WIDTH}
      zIndex={zIndex}
      loading={showLoading}
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
      extra={contentReady ? extra ?? null : null}
      basic={
        contentReady ? (
          <Descriptions
            column={detailDrawerBasicColumn(false)}
            size="small"
            items={detailDrawerDescriptionItems(basicColumns, effective)}
          />
        ) : (
          <div style={{ minHeight: 120 }} />
        )
      }
      linesTitle={t('app.kuaizhizao.logistics.section.billItems')}
      lines={
        contentReady ? (
          items.length > 0 ? (
            <Table<FreightBillItem>
              size="small"
              pagination={false}
              rowKey={(row, idx) => String(row.id ?? `${row.freight_order_id}-${idx}`)}
              dataSource={items}
              columns={[
                {
                  title: t('app.kuaizhizao.logistics.field.orderCode'),
                  dataIndex: 'freight_order_code',
                },
                {
                  title: t('app.kuaizhizao.logistics.field.trackingNumber'),
                  dataIndex: 'tracking_number',
                  render: (value) => String(value ?? '').trim() || '-',
                },
                {
                  title: t('app.kuaizhizao.logistics.field.amount'),
                  dataIndex: 'amount',
                  align: 'right',
                },
              ]}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaizhizao.logistics.message.billItemRequired')}
            />
          )
        ) : null
      }
    />
  );
};

export default FreightBillDetailDrawer;
