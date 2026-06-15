/**
 * 职员销汇总（传统表格报表）
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const SalespersonPerformance: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    {
      title: t('app.kuaizhizao.reports.dateRange'),
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.reports.rank'),
      dataIndex: 'rank',
      width: 80,
      hideInSearch: true,
      render: (text) => <b>{text}</b>,
    },
    {
      title: t('app.kuaizhizao.reports.salesmanName'),
      dataIndex: 'salesman_name',
      width: 150,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.orderCount'),
      dataIndex: 'order_count',
      valueType: 'digit',
      sorter: true,
      width: 120,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.reports.totalRevenue'),
      dataIndex: 'total_revenue',
      valueType: 'money',
      sorter: true,
      width: 150,
      hideInSearch: true,
    },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.salesperson-performance')}
      reportType="salesman"
      dateRangeKeys={['date_range', 'dateRange']}
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.SalespersonPerformance"
      columns={columns}
    />
  );
};

export default SalespersonPerformance;
