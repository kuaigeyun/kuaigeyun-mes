/**
 * 服务结算详情抽屉。
 */

import React, { useMemo } from 'react';
import { Empty, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { SourceDocumentCode } from '../../../../../../components/linked-document-code/SourceDocumentCode';
import type { ServiceSettlement, ServiceSettlementItem } from '../../../../services/after-sales-service';
import {
  AFTER_SALES_REVIEW_STATUS_COLOR,
  renderAfterSalesStatusTag,
} from '../../shared/afterSalesListPresentation';
import { AfterSalesDocDetailDrawer } from '../../shared/AfterSalesDocDetailDrawer';

const PLACEHOLDER: ServiceSettlement = {
  id: 0,
  settlement_code: '',
  customer_id: 0,
  customer_name: '',
};

export type ServiceSettlementDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: ServiceSettlement | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
};

export const ServiceSettlementDetailDrawer: React.FC<ServiceSettlementDetailDrawerProps> = ({
  open,
  onClose,
  record,
  loading,
  error,
  onRetry,
  extra,
  zIndex,
}) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () =>
      [
        {
          title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.settlementCode'),
          dataIndex: 'settlement_code',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.customerName'),
          dataIndex: 'customer_name',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.warrantyFreeAmount'),
          dataIndex: 'warranty_free_amount',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.chargeableAmount'),
          dataIndex: 'chargeable_amount',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.totalAmount'),
          dataIndex: 'total_amount',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.reviewerName'),
          dataIndex: 'reviewer_name',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.reviewedAt'),
          dataIndex: 'reviewed_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.status'),
          dataIndex: 'status',
          render: (_, row) => renderAfterSalesStatusTag(row.status, AFTER_SALES_REVIEW_STATUS_COLOR),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.reviewRemarks'),
          dataIndex: 'review_remarks',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.notes'),
          dataIndex: 'notes',
          span: 3,
        },
      ] as ProDescriptionsItemProps<ServiceSettlement>[],
    [t],
  );

  const items = record?.items ?? [];
  const code = String(record?.settlement_code ?? '').trim();
  const title = `${t('app.kuaizhizao.afterSalesService.serviceSettlement.detailTitle')}${code ? ` - ${code}` : ''}`;

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
      zIndex={zIndex}
      linesTitle={t('app.kuaizhizao.afterSalesService.common.itemsTitle')}
      lines={
        items.length > 0 ? (
          <Table<ServiceSettlementItem>
            size="small"
            pagination={false}
            rowKey={(row, idx) => String(row.id ?? `${row.source_type}-${row.source_id}-${idx}`)}
            dataSource={items}
            columns={[
              {
                title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.sourceCode'),
                dataIndex: 'source_code',
                render: (_, row) => (
                  <SourceDocumentCode
                    sourceType={row.source_type}
                    sourceId={row.source_id}
                    sourceCode={row.source_code}
                  />
                ),
              },
              {
                title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.warrantyStatus'),
                dataIndex: 'warranty_status',
              },
              {
                title: t('app.kuaizhizao.afterSalesService.serviceSettlement.field.amount'),
                dataIndex: 'amount',
                align: 'right',
              },
              { title: t('app.kuaizhizao.afterSalesTicket.fieldLineNotes'), dataIndex: 'notes' },
            ]}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('app.kuaizhizao.afterSalesService.common.itemsEmpty')}
          />
        )
      }
    />
  );
};
