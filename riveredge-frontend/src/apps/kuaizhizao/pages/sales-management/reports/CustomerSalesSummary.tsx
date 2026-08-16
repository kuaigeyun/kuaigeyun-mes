/**
 * 客户销售汇总
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { reportPercent } from '../../../utils/reportPresentation';

const CustomerSalesSummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.customerCode'),
        dataIndex: 'customer_code',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.customerName'),
        dataIndex: 'customer_name',
        ellipsis: true,
        width: 180,
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
        title: t('app.kuaizhizao.reports.salesTotalAmount'),
        dataIndex: 'total_amount',
        valueType: 'money',
        sorter: true,
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.completedAmount'),
        dataIndex: 'completed_amount',
        valueType: 'money',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.receivedAmount'),
        dataIndex: 'received_amount',
        valueType: 'money',
        width: 120,
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
      {
        title: t('app.kuaizhizao.reports.lastOrderDate'),
        dataIndex: 'last_order_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.salesman'),
        dataIndex: 'salesman_name',
        width: 100,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.CustomerSalesSummary-v2"
      title={t('app.kuaizhizao.menu.reports.customer-sales-summary')}
      reportType="customer_summary"
      rowKey="customer_id"
      columns={columns}
    />
  );
};

export default CustomerSalesSummary;
