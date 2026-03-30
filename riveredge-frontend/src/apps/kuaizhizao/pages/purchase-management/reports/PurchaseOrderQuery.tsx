import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const PurchaseOrderQuery: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '订单编号', dataIndex: 'order_code', width: 150 },
    { title: '供应商', dataIndex: 'supplier_name', width: 200 },
    { title: '订单日期', dataIndex: 'order_date', valueType: 'date', width: 120 },
    { title: '总金额', dataIndex: 'total_amount', valueType: 'money', width: 120 },
    { title: '采购员', dataIndex: 'buyer_name', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.purchase-order-query')}
      reportType="po_query"
      columns={columns}
    />
  );
};

export default PurchaseOrderQuery;
