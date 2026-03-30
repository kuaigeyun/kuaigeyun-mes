import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const SupplierQualityRate: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '供应商', dataIndex: 'supplier_name', width: 200 },
    { title: '检验总数', dataIndex: 'total_count', valueType: 'digit', width: 100 },
    { title: '合格数量', dataIndex: 'qualified_count', valueType: 'digit', width: 100 },
    { title: '不合格数', dataIndex: 'unqualified_count', valueType: 'digit', width: 100 },
    { title: '合格率', dataIndex: 'quality_rate', valueType: 'percent', width: 100, sorter: true },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.supplier-quality-rate')}
      reportType="supplier_quality"
      columns={columns}
    />
  );
};

export default SupplierQualityRate;
