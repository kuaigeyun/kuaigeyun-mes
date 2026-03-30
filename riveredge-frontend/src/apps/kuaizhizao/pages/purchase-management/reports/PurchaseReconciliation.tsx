import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const PurchaseReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '供应商', dataIndex: 'supplier_name', width: 200 },
    { title: '入库单号', dataIndex: 'inbound_code', width: 150 },
    { title: '入库日期', dataIndex: 'inbound_date', valueType: 'date', width: 120 },
    { title: '结算金额', dataIndex: 'amount', valueType: 'money', width: 120 },
    { title: '对账状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.purchase-reconciliation')}
      reportType="purchase_recon"
      columns={columns}
    />
  );
};

export default PurchaseReconciliation;
