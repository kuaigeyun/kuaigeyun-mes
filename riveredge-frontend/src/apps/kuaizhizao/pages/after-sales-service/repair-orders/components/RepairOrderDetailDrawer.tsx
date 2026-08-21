/**
 * 维修单详情抽屉。
 */

import React, { useMemo } from 'react';
import { Empty, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { RepairOrder, RepairOrderItem } from '../../../../services/after-sales-service';
import {
  AFTER_SALES_REPAIR_STATUS_COLOR,
  renderAfterSalesStatusTag,
  renderAfterSalesTypeMarker,
} from '../../shared/afterSalesListPresentation';
import { LinkedDocumentCode } from '../../../../../../components/linked-document-code';
import { AfterSalesDocDetailDrawer } from '../../shared/AfterSalesDocDetailDrawer';

const PLACEHOLDER: RepairOrder = {
  id: 0,
  order_code: '',
  customer_id: 0,
  customer_name: '',
  fault_description: '',
  reported_at: '',
};

export type RepairOrderDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: RepairOrder | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
};

export const RepairOrderDetailDrawer: React.FC<RepairOrderDetailDrawerProps> = ({
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
        { title: t('app.kuaizhizao.afterSalesService.repairOrder.field.orderCode'), dataIndex: 'order_code' },
        { title: t('app.kuaizhizao.afterSalesService.repairOrder.field.customerName'), dataIndex: 'customer_name' },
        {
          title: t('app.kuaizhizao.afterSalesService.repairOrder.field.ticketCode'),
          dataIndex: 'after_sales_ticket_code',
          render: (_, row) => (
            <LinkedDocumentCode
              documentType="after_sales_ticket"
              documentId={row.after_sales_ticket_id}
              code={row.after_sales_ticket_code}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.repairOrder.field.assetCode'),
          dataIndex: 'service_asset_code',
          render: (_, row) => (
            <LinkedDocumentCode
              documentType="service_asset"
              documentId={row.service_asset_id}
              code={row.service_asset_code}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.repairOrder.field.repairMode'),
          dataIndex: 'repair_mode',
          render: (_, row) => renderAfterSalesTypeMarker(row.repair_mode),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.repairOrder.field.warrantyStatus'),
          dataIndex: 'warranty_status',
          render: (_, row) => renderAfterSalesTypeMarker(row.warranty_status),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.repairOrder.field.reportedAt'),
          dataIndex: 'reported_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.repairOrder.field.closedAt'),
          dataIndex: 'closed_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.repairOrder.field.siteAddress'),
          dataIndex: 'site_address',
          span: 3,
        },
        { title: t('app.kuaizhizao.afterSalesService.repairOrder.field.totalCost'), dataIndex: 'total_cost' },
        {
          title: t('common.status'),
          dataIndex: 'status',
          render: (_, row) => renderAfterSalesStatusTag(row.status, AFTER_SALES_REPAIR_STATUS_COLOR),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.repairOrder.field.faultDescription'),
          dataIndex: 'fault_description',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.afterSalesService.repairOrder.field.diagnosisResult'),
          dataIndex: 'diagnosis_result',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.afterSalesService.repairOrder.field.resolution'),
          dataIndex: 'resolution',
          span: 3,
        },
        {
          title: t('common.remark'),
          dataIndex: 'notes',
          span: 3,
        },
      ] as ProDescriptionsItemProps<RepairOrder>[],
    [t],
  );

  const items = record?.items ?? [];
  const code = String(record?.order_code ?? '').trim();
  const title = `${t('app.kuaizhizao.afterSalesService.repairOrder.detailTitle')}${code ? ` - ${code}` : ''}`;

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
      traceDocumentType="repair_order"
      linesTitle={t('app.kuaizhizao.afterSalesService.common.itemsTitle')}
      lines={
        items.length > 0 ? (
          <Table<RepairOrderItem>
            size="small"
            pagination={false}
            rowKey={(row, idx) => String(row.id ?? `${row.material_code}-${idx}`)}
            dataSource={items}
            columns={[
              { title: t('app.kuaizhizao.afterSalesTicket.fieldMaterialCode'), dataIndex: 'material_code' },
              { title: t('app.kuaizhizao.afterSalesTicket.fieldMaterialName'), dataIndex: 'material_name' },
              { title: t('common.quantity'), dataIndex: 'quantity', align: 'right' },
              { title: t('app.kuaizhizao.afterSalesService.repairOrder.field.totalCost'), dataIndex: 'amount', align: 'right' },
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
