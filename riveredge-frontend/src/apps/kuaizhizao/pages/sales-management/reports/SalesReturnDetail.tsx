/**
 * 销售退货明细表
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const SalesReturnDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    {
      title: t('app.kuaizhizao.reports.returnDateRange'),
      dataIndex: 'return_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 10 } as ProColumns['search'],
    },
    copyableCodeColumn(t('app.kuaizhizao.reports.returnCode'), 'return_code', 150),
    {
      title: t('app.kuaizhizao.reports.returnDate'),
      dataIndex: 'return_date',
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
      title: t('app.kuaizhizao.reports.deliveryCode'),
      dataIndex: 'sales_delivery_code',
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
      title: t('app.kuaizhizao.reports.returnReason'),
      dataIndex: 'return_reason',
      ellipsis: true,
      width: 140,
      hideInSearch: true,
    },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.sales-return-detail')}
      reportType="sales-return-detail"
      dateRangeKeys={['return_date_range', 'date_range']}
      summaryFields={['quantity', 'amount']}
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.SalesReturnDetail"
      rowKey="id"
      columns={columns}
    />
  );
};

export default SalesReturnDetail;
