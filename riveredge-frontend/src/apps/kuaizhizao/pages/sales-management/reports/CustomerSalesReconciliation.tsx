/**
 * 客户销售对账
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { salesBillTypeEnum } from '../../../utils/reportPresentation';

const CustomerSalesReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.transactionDate'),
        dataIndex: 'transaction_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.customerCode'),
        dataIndex: 'customer_code',
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
        valueEnum: salesBillTypeEnum(t),
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
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.invoicedAmount'),
        dataIndex: 'invoiced_amount',
        valueType: 'money',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.receivedAmount'),
        dataIndex: 'received_amount',
        valueType: 'money',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.pendingAmount'),
        dataIndex: 'pending_amount',
        valueType: 'money',
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
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.CustomerSalesReconciliation-v2"
      title={t('app.kuaizhizao.menu.reports.customer-sales-reconciliation')}
      reportType="customer_reconciliation"
      rowKey="row_key"
      columns={columns}
      summaryFields={['total_sales', 'total_returns', 'total_received', 'total_pending', 'balance']}
    />
  );
};

export default CustomerSalesReconciliation;
