/**
 * 备件申领详情抽屉。
 */

import React, { useMemo } from 'react';
import { Empty, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type {
  AfterSalesSparePartRequisition,
  AfterSalesSparePartRequisitionItem,
} from '../../../../services/after-sales-service';
import {
  AFTER_SALES_REVIEW_STATUS_COLOR,
  renderAfterSalesStatusTag,
} from '../../shared/afterSalesListPresentation';
import { AfterSalesDocDetailDrawer } from '../../shared/AfterSalesDocDetailDrawer';

const PLACEHOLDER: AfterSalesSparePartRequisition = {
  id: 0,
  requisition_code: '',
  source_type: '',
  source_id: 0,
  source_code: '',
};

export type SparePartRequisitionDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: AfterSalesSparePartRequisition | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
};

export const SparePartRequisitionDetailDrawer: React.FC<SparePartRequisitionDetailDrawerProps> = ({
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
          title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.requisitionCode'),
          dataIndex: 'requisition_code',
          skipLinkedDocumentLink: true,
        },
        { title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.sourceCode'), dataIndex: 'source_code' },
        {
          title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.warehouseName'),
          dataIndex: 'warehouse_name',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.reviewerName'),
          dataIndex: 'reviewer_name',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.reviewedAt'),
          dataIndex: 'reviewed_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.status'),
          dataIndex: 'status',
          render: (_, row) => renderAfterSalesStatusTag(row.status, AFTER_SALES_REVIEW_STATUS_COLOR),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.reviewRemarks'),
          dataIndex: 'review_remarks',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.afterSalesService.sparePartRequisition.field.notes'),
          dataIndex: 'notes',
          span: 3,
        },
      ] as ProDescriptionsItemProps<AfterSalesSparePartRequisition>[],
    [t],
  );

  const items = record?.items ?? [];
  const code = String(record?.requisition_code ?? '').trim();
  const title = `${t('app.kuaizhizao.afterSalesService.sparePartRequisition.detailTitle')}${code ? ` - ${code}` : ''}`;

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
          <Table<AfterSalesSparePartRequisitionItem>
            size="small"
            pagination={false}
            rowKey={(row, idx) => String(row.id ?? `${row.material_code}-${idx}`)}
            dataSource={items}
            columns={[
              { title: t('app.kuaizhizao.afterSalesTicket.fieldMaterialCode'), dataIndex: 'material_code' },
              { title: t('app.kuaizhizao.afterSalesTicket.fieldMaterialName'), dataIndex: 'material_name' },
              { title: t('app.kuaizhizao.afterSalesTicket.fieldQuantity'), dataIndex: 'quantity', align: 'right' },
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
