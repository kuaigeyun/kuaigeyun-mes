/**
 * 售后工单详情抽屉。
 */

import React, { useMemo } from 'react';
import { Table, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { AfterSalesTicket } from '../../../../services/after-sales-ticket';
import {
  AFTER_SALES_TICKET_STATUS_COLOR,
  renderAfterSalesStatusTag,
  renderAfterSalesTypeMarker,
} from '../../shared/afterSalesListPresentation';
import { LinkedDocumentCode } from '../../../../../../components/linked-document-code';
import { AfterSalesDocDetailDrawer } from '../../shared/AfterSalesDocDetailDrawer';

const PLACEHOLDER: AfterSalesTicket = {
  id: 0,
  ticket_code: '',
  customer_id: 0,
  customer_name: '',
  request_type: '',
  status: '',
  content: '',
  registered_at: '',
};

export type AfterSalesTicketDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: AfterSalesTicket | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  footer?: React.ReactNode;
  zIndex?: number;
};

export const AfterSalesTicketDetailDrawer: React.FC<AfterSalesTicketDetailDrawerProps> = ({
  open,
  onClose,
  record,
  loading,
  error,
  onRetry,
  extra,
  footer,
  zIndex,
}) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () =>
      [
        { title: t('app.kuaizhizao.afterSalesTicket.colTicketCode'), dataIndex: 'ticket_code' },
        { title: t('app.kuaizhizao.afterSalesTicket.colCustomer'), dataIndex: 'customer_name' },
        {
          title: t('app.kuaizhizao.afterSalesTicket.colRequestType'),
          dataIndex: 'request_type',
          render: (_, row) => renderAfterSalesTypeMarker(row.request_type),
        },
        {
          title: t('app.kuaizhizao.afterSalesTicket.colStatus'),
          dataIndex: 'status',
          render: (_, row) => renderAfterSalesStatusTag(row.status, AFTER_SALES_TICKET_STATUS_COLOR),
        },
        {
          title: t('app.kuaizhizao.afterSalesTicket.colSalesOrder'),
          dataIndex: 'sales_order_code',
          render: (_, row) => (
            <LinkedDocumentCode
              documentType="sales_order"
              documentId={row.sales_order_id}
              code={row.sales_order_code}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.afterSalesTicket.colSalesDelivery'),
          dataIndex: 'sales_delivery_code',
          render: (_, row) => (
            <LinkedDocumentCode
              documentType="sales_delivery"
              documentId={row.sales_delivery_id}
              code={row.sales_delivery_code}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.afterSalesTicket.colSalesReturn'),
          dataIndex: 'sales_return_code',
          render: (_, row) => (
            <LinkedDocumentCode
              documentType="sales_return"
              documentId={row.sales_return_id}
              code={row.sales_return_code}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.afterSalesTicket.colRegisteredAt'),
          dataIndex: 'registered_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesTicket.colClosedAt'),
          dataIndex: 'closed_at',
          valueType: 'dateTime',
        },
        { title: t('app.kuaizhizao.afterSalesTicket.fieldClaimAmount'), dataIndex: 'claim_amount' },
        {
          title: t('app.kuaizhizao.afterSalesTicket.colItemCount'),
          dataIndex: 'item_count',
          render: (_, row) => String(row.item_count ?? row.items?.length ?? 0),
        },
        {
          title: t('app.kuaizhizao.afterSalesTicket.fieldContent'),
          dataIndex: 'content',
          span: 3,
          render: (_, row) => (
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {row.content?.trim() ? row.content : '—'}
            </Typography.Paragraph>
          ),
        },
        {
          title: t('app.kuaizhizao.afterSalesTicket.fieldResolution'),
          dataIndex: 'resolution',
          span: 3,
          render: (_, row) => (
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {row.resolution?.trim() ? row.resolution : '—'}
            </Typography.Paragraph>
          ),
        },
      ] as ProDescriptionsItemProps<AfterSalesTicket>[],
    [t],
  );

  const items = record?.items ?? [];
  const code = String(record?.ticket_code ?? '').trim();
  const title = t('app.kuaizhizao.afterSalesTicket.detailTitle', {
    suffix: code ? ` - ${code}` : '',
  });

  return (
    <AfterSalesDocDetailDrawer
      open={open}
      onClose={onClose}
      title={title}
      record={record}
      placeholder={PLACEHOLDER}
      columns={columns}
      loading={loading}
      error={error}
      onRetry={onRetry}
      extra={extra}
      footer={footer}
      zIndex={zIndex}
      traceDocumentType="after_sales_ticket"
      linesTitle={t('app.kuaizhizao.afterSalesTicket.itemsTitle')}
      lines={
        <Table
          size="small"
          rowKey={(row) => String(row.id ?? `${row.material_code}-${row.line_no}`)}
          pagination={false}
          dataSource={items}
          locale={{ emptyText: t('app.kuaizhizao.afterSalesTicket.itemsEmpty') }}
          scroll={{ x: 800 }}
          columns={[
            {
              title: t('app.kuaizhizao.afterSalesTicket.fieldMaterialCode'),
              dataIndex: 'material_code',
              width: 140,
            },
            {
              title: t('app.kuaizhizao.afterSalesTicket.fieldMaterialName'),
              dataIndex: 'material_name',
              width: 180,
            },
            {
              title: t('app.kuaizhizao.afterSalesTicket.fieldBatchNo'),
              dataIndex: 'batch_no',
              width: 120,
            },
            {
              title: t('app.kuaizhizao.afterSalesTicket.fieldQuantity'),
              dataIndex: 'quantity',
              width: 100,
              align: 'right',
            },
            {
              title: t('app.kuaizhizao.afterSalesTicket.fieldClaimAmount'),
              dataIndex: 'claim_amount',
              width: 120,
              align: 'right',
            },
            {
              title: t('app.kuaizhizao.afterSalesTicket.fieldLineNotes'),
              dataIndex: 'notes',
              ellipsis: true,
            },
          ]}
        />
      }
    />
  );
};
