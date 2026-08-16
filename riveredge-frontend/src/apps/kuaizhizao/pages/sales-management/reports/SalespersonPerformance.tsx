/**
 * 销售人员汇总
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { reportPercent } from '../../../utils/reportPresentation';

const SalespersonPerformance: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.rank'),
        dataIndex: 'rank',
        width: 64,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.salesmanName'),
        dataIndex: 'salesman_name',
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.orderCount'),
        dataIndex: 'order_count',
        valueType: 'digit',
        sorter: true,
        width: 90,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.completedOrderCount'),
        dataIndex: 'completed_order_count',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.customerCount'),
        dataIndex: 'customer_count',
        valueType: 'digit',
        width: 90,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.totalRevenue'),
        dataIndex: 'total_revenue',
        valueType: 'money',
        sorter: true,
        width: 130,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.amountShare'),
        dataIndex: 'amount_share',
        width: 90,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.amount_share),
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.salesperson-performance')}
      reportType="salesman"
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.SalespersonPerformance-v2"
      rowKey="row_key"
      columns={columns}
    />
  );
};

export default SalespersonPerformance;
