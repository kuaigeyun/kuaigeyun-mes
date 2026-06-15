/**
 * 销售出库明细表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const SalesDeliveryDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    {
      title: t('app.kuaizhizao.reports.deliveryDateRange'),
      dataIndex: 'delivery_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 10 } as ProColumns['search'],
    },
    copyableCodeColumn(t('app.kuaizhizao.reports.deliveryCode'), 'delivery_code', 150),
    {
      title: t('app.kuaizhizao.reports.deliveryDate'),
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.customerName'),
      dataIndex: 'customer_name',
      ellipsis: true,
      width: 160,
    },
    {
      title: t('app.kuaizhizao.reports.salesOrderCode'),
      dataIndex: 'sales_order_code',
      width: 140,
      hideInSearch: true,
    },
    copyableCodeColumn(t('app.kuaizhizao.reports.materialCode'), 'material_code', 120),
    {
      title: t('app.kuaizhizao.reports.materialName'),
      dataIndex: 'material_name',
      ellipsis: true,
      width: 180,
    },
    {
      title: t('app.kuaizhizao.reports.quantity'),
      dataIndex: 'quantity',
      valueType: 'digit',
      width: 100,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.unitPrice'),
      dataIndex: 'unit_price',
      valueType: 'money',
      width: 110,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.amount'),
      dataIndex: 'amount',
      valueType: 'money',
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.warehouse'),
      dataIndex: 'warehouse_name',
      width: 120,
      hideInSearch: true,
    },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.sales-delivery-detail')}
      reportType="sales-delivery-detail"
      dateRangeKeys={['delivery_date_range', 'date_range']}
      summaryFields={['quantity', 'amount']}
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.SalesDeliveryDetail"
      rowKey="id"
      columns={columns}
    />
  );
};

export default SalesDeliveryDetail;
