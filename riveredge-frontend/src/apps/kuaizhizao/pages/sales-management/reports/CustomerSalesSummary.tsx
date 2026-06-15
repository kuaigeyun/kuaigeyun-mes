/**
 * 客户销售业绩汇总报表
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const CustomerSalesSummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.statPeriod'),
        dataIndex: 'date_range',
        valueType: 'dateRange',
        hideInTable: true,
        search: { order: 10 } as any,
      },
      {
        title: t('app.kuaizhizao.reports.customerName'),
        dataIndex: 'customer_name',
        copyable: true,
        fixed: 'left',
        width: 200,
      },
      {
        title: t('app.kuaizhizao.reports.customerCode'),
        dataIndex: 'customer_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.orderCount'),
        dataIndex: 'order_count',
        valueType: 'digit',
        sorter: true,
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.salesTotalAmount'),
        dataIndex: 'total_amount',
        valueType: 'money',
        sorter: true,
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.completedAmount'),
        dataIndex: 'completed_amount',
        valueType: 'money',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.receivedAmount'),
        dataIndex: 'received_amount',
        valueType: 'money',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.lastOrderDate'),
        dataIndex: 'last_order_date',
        valueType: 'date',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.accountManager'),
        dataIndex: 'salesman_name',
        width: 150,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.CustomerSalesSummary"
      title={t('app.kuaizhizao.menu.reports.customer-sales-summary')}
      reportType="customer_summary"
      columns={columns}
      dateRangeKeys={['date_range', 'dateRange']}
    />
  );
};

export default CustomerSalesSummary;
