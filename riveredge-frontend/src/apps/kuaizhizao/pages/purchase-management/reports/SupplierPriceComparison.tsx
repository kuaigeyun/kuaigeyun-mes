import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const SupplierPriceComparison: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '物料编码', dataIndex: 'material_code', width: 120 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '供应厂商', dataIndex: 'supplier_name', width: 200 },
    { title: '最近单价', dataIndex: 'last_price', valueType: 'money', width: 120 },
    { title: '最低单价', dataIndex: 'min_price', valueType: 'money', width: 120 },
    { title: '平均单价', dataIndex: 'avg_price', valueType: 'money', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.supplier-price-comparison')}
      reportType="supplier_price_compare"
      columns={columns}
    />
  );
};

export default SupplierPriceComparison;
