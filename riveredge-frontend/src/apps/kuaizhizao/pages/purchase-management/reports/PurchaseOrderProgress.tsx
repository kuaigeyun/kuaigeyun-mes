import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const PurchaseOrderProgress: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '订单编号', dataIndex: 'order_code', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '订单数量', dataIndex: 'order_qty', valueType: 'digit', width: 100 },
    { title: '收货数量', dataIndex: 'receipt_qty', valueType: 'digit', width: 100 },
    { title: '待收数量', dataIndex: 'pending_qty', valueType: 'digit', width: 100 },
    { title: '执行进度', dataIndex: 'progress', valueType: 'percent', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.purchase-order-progress')}
      reportType="po_progress"
      columns={columns}
    />
  );
};

export default PurchaseOrderProgress;
