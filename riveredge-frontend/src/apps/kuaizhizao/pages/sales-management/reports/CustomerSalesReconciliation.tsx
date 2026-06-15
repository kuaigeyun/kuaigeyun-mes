/**
 * 客户销售明细对账报表
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const CustomerSalesReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.transactionDate'),
        dataIndex: 'transaction_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        search: { order: 10 } as any,
      },
      {
        title: t('app.kuaizhizao.reports.transactionDate'),
        dataIndex: 'transaction_date',
        valueType: 'date',
        fixed: 'left',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.customerName'),
        dataIndex: 'customer_name',
        ellipsis: true,
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.billType'),
        dataIndex: 'bill_type',
        width: 100,
        valueEnum: {
          SALES_ORDER: { text: t('app.kuaizhizao.reports.billTypeSalesOrder'), status: 'Processing' },
          SALES_DELIVERY: { text: t('app.kuaizhizao.reports.billTypeSalesDelivery'), status: 'Success' },
          SALES_RETURN: { text: t('app.kuaizhizao.reports.billTypeSalesReturn'), status: 'Error' },
        },
      },
      {
        title: t('app.kuaizhizao.reports.billCode'),
        dataIndex: 'bill_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.amount'),
        dataIndex: 'amount',
        valueType: 'money',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.invoicedAmount'),
        dataIndex: 'invoiced_amount',
        valueType: 'money',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.receivedAmount'),
        dataIndex: 'received_amount',
        valueType: 'money',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.pendingAmount'),
        dataIndex: 'pending_amount',
        valueType: 'money',
        width: 120,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.CustomerSalesReconciliation"
      title={t('app.kuaizhizao.menu.reports.customer-sales-reconciliation')}
      reportType="customer_reconciliation"
      columns={columns}
      dateRangeKeys={['transaction_date_range', 'date_range', 'dateRange']}
      summaryFields={['total_sales', 'total_returns', 'total_received', 'total_pending', 'balance']}
    />
  );
};

export default CustomerSalesReconciliation;
