import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const SupplierDeliverySummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '供应商', dataIndex: 'supplier_name', width: 200 },
    { title: '交货单号', dataIndex: 'delivery_code', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '订单数量', dataIndex: 'order_qty', valueType: 'digit', width: 100 },
    { title: '实交数量', dataIndex: 'actual_qty', valueType: 'digit', width: 100 },
    { title: '及时率', dataIndex: 'ontime_rate', valueType: 'percent', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.supplier-delivery-summary')}
      reportType="supplier_delivery"
      columns={columns}
    />
  );
};

export default SupplierDeliverySummary;
