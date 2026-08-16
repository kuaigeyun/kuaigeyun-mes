/**
 * 服务派工详情抽屉。
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { ServiceDispatchOrder } from '../../../../services/after-sales-service';
import {
  AFTER_SALES_DISPATCH_STATUS_COLOR,
  renderAfterSalesStatusTag,
} from '../../shared/afterSalesListPresentation';
import { SourceDocumentCode } from '../../../../../../components/linked-document-code/SourceDocumentCode';
import { AfterSalesDocDetailDrawer } from '../../shared/AfterSalesDocDetailDrawer';

const PLACEHOLDER: ServiceDispatchOrder = {
  id: 0,
  dispatch_code: '',
  customer_id: 0,
  customer_name: '',
  source_type: '',
  source_id: 0,
  source_code: '',
};

export type DispatchOrderDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: ServiceDispatchOrder | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
};

export const DispatchOrderDetailDrawer: React.FC<DispatchOrderDetailDrawerProps> = ({
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
        { title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.dispatchCode'), dataIndex: 'dispatch_code' },
        { title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.customerName'), dataIndex: 'customer_name' },
        {
          title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.sourceCode'),
          dataIndex: 'source_code',
          render: (_, row) => (
            <SourceDocumentCode
              sourceType={row.source_type}
              sourceId={row.source_id}
              sourceCode={row.source_code}
            />
          ),
        },
        { title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.engineerName'), dataIndex: 'engineer_name' },
        {
          title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.plannedStartAt'),
          dataIndex: 'planned_start_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.plannedEndAt'),
          dataIndex: 'planned_end_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.actualStartAt'),
          dataIndex: 'actual_start_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.actualEndAt'),
          dataIndex: 'actual_end_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.checkinAt'),
          dataIndex: 'checkin_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.siteAddress'),
          dataIndex: 'site_address',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.status'),
          dataIndex: 'status',
          render: (_, row) => renderAfterSalesStatusTag(row.status, AFTER_SALES_DISPATCH_STATUS_COLOR),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.completionNotes'),
          dataIndex: 'completion_notes',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.afterSalesService.dispatchOrder.field.notes'),
          dataIndex: 'notes',
          span: 3,
        },
      ] as ProDescriptionsItemProps<ServiceDispatchOrder>[],
    [t],
  );

  const code = String(record?.dispatch_code ?? '').trim();
  const title = `${t('app.kuaizhizao.afterSalesService.dispatchOrder.detailTitle')}${code ? ` - ${code}` : ''}`;

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
      traceDocumentType="service_dispatch"
    />
  );
};
