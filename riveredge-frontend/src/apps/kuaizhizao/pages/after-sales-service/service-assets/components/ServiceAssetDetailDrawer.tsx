/**
 * 装机档案详情抽屉。
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import type { ServiceAsset } from '../../../../services/after-sales-service';
import {
  AFTER_SALES_ASSET_STATUS_COLOR,
  renderAfterSalesStatusTag,
} from '../../shared/afterSalesListPresentation';
import { LinkedDocumentCode } from '../../../../../../components/linked-document-code';
import { AfterSalesDocDetailDrawer } from '../../shared/AfterSalesDocDetailDrawer';

const PLACEHOLDER: ServiceAsset = {
  id: 0,
  asset_code: '',
  customer_id: 0,
  customer_name: '',
};

export type ServiceAssetDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  record: ServiceAsset | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  extra?: React.ReactNode;
  zIndex?: number;
};

export const ServiceAssetDetailDrawer: React.FC<ServiceAssetDetailDrawerProps> = ({
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
        { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.assetCode'), dataIndex: 'asset_code' },
        { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.customerName'), dataIndex: 'customer_name' },
        { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.materialCode'), dataIndex: 'material_code' },
        { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.materialName'), dataIndex: 'material_name' },
        { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.materialSpec'), dataIndex: 'material_spec' },
        { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.serialNumber'), dataIndex: 'serial_number' },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.salesOrderCode'),
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
          title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.salesDeliveryCode'),
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
          title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.installExecutionCode'),
          dataIndex: 'install_execution_code',
          render: (_, row) => (
            <LinkedDocumentCode
              documentType="install_execution"
              documentId={row.install_execution_id}
              code={row.install_execution_code}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.installAddress'),
          dataIndex: 'install_address',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.acceptedAt'),
          dataIndex: 'accepted_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.warrantyStartAt'),
          dataIndex: 'warranty_start_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.warrantyEndAt'),
          dataIndex: 'warranty_end_at',
          valueType: 'dateTime',
        },
        { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.warrantyMonths'), dataIndex: 'warranty_months' },
        { title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.warrantyPolicy'), dataIndex: 'warranty_policy' },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.status'),
          dataIndex: 'status',
          render: (_, row) => renderAfterSalesStatusTag(row.status, AFTER_SALES_ASSET_STATUS_COLOR),
        },
        {
          title: t('app.kuaizhizao.afterSalesService.serviceAsset.field.notes'),
          dataIndex: 'notes',
          span: 3,
        },
      ] as ProDescriptionsItemProps<ServiceAsset>[],
    [t],
  );

  const code = String(record?.asset_code ?? '').trim();
  const title = `${t('app.kuaizhizao.afterSalesService.serviceAsset.detailTitle')}${code ? ` - ${code}` : ''}`;

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
      traceDocumentType="service_asset"
    />
  );
};
