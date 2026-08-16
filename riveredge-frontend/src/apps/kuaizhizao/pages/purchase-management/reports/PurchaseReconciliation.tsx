/**
 * 采购对账
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  purchaseOrderStatusEnum,
  reportDocumentStatusText,
} from '../../../utils/reportPresentation';

const PurchaseReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseReports.colOrderCode'),
        dataIndex: 'order_code',
        fixed: 'left',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colOrderDate'),
        dataIndex: 'order_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.supplierCode'),
        dataIndex: 'supplier_code',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colSupplier'),
        dataIndex: 'supplier_name',
        ellipsis: true,
        width: 150,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colOrderAmount'),
        dataIndex: 'order_amount',
        valueType: 'money',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colReceivedAmount'),
        dataIndex: 'received_amount',
        valueType: 'money',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colInvoicedAmount'),
        dataIndex: 'invoiced_amount',
        valueType: 'money',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colPaidAmount'),
        dataIndex: 'paid_amount',
        valueType: 'money',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colPendingAmount'),
        dataIndex: 'pending_amount',
        valueType: 'money',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.documentStatus'),
        dataIndex: 'status',
        width: 100,
        valueEnum: purchaseOrderStatusEnum(t),
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.purchase-reconciliation')}
      reportType="purchase_recon"
      summaryFields={[
        'order_amount',
        'received_amount',
        'invoiced_amount',
        'paid_amount',
        'pending_amount',
      ]}
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.PurchaseReconciliation-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default PurchaseReconciliation;
