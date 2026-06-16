import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const PurchaseReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseReports.colOrderCode'), dataIndex: 'order_code', width: 150 },
      { title: t('app.kuaizhizao.purchaseReports.colOrderDate'), dataIndex: 'order_date', valueType: 'date', width: 120 },
      { title: t('app.kuaizhizao.purchaseReports.colSupplier'), dataIndex: 'supplier_name', width: 200 },
      { title: t('app.kuaizhizao.purchaseReports.colOrderAmount'), dataIndex: 'order_amount', valueType: 'money', width: 120 },
      { title: t('app.kuaizhizao.purchaseReports.colReceivedAmount'), dataIndex: 'received_amount', valueType: 'money', width: 120 },
      { title: t('app.kuaizhizao.purchaseReports.colInvoicedAmount'), dataIndex: 'invoiced_amount', valueType: 'money', width: 120 },
      { title: t('app.kuaizhizao.purchaseReports.colPaidAmount'), dataIndex: 'paid_amount', valueType: 'money', width: 120 },
      { title: t('app.kuaizhizao.purchaseReports.colPendingAmount'), dataIndex: 'pending_amount', valueType: 'money', width: 120 },
      { title: t('common.status'), dataIndex: 'status', width: 100 },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.PurchaseReconciliation"
      title={t('app.kuaizhizao.menu.reports.purchase-reconciliation')}
      reportType="purchase_recon"
      columns={columns}
      summaryFields={['order_total', 'received_total']}
    />
  );
};

export default PurchaseReconciliation;
