import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const PurchaseReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '订单编号', dataIndex: 'order_code', width: 150 },
    { title: '订单日期', dataIndex: 'order_date', valueType: 'date', width: 120 },
    { title: '供应商', dataIndex: 'supplier_name', width: 200 },
    { title: '订单金额', dataIndex: 'order_amount', valueType: 'money', width: 120 },
    { title: '已入库', dataIndex: 'received_amount', valueType: 'money', width: 120 },
    { title: '已收票', dataIndex: 'invoiced_amount', valueType: 'money', width: 120 },
    { title: '已付款', dataIndex: 'paid_amount', valueType: 'money', width: 120 },
    { title: '未付', dataIndex: 'pending_amount', valueType: 'money', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

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
