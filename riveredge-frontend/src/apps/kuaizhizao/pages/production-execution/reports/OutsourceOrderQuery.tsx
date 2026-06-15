import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const OutsourceOrderQuery: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '委外单号', dataIndex: 'order_code', width: 150 },
    { title: '供应商', dataIndex: 'supplier_name', width: 200 },
    { title: '产品名称', dataIndex: 'product_name', width: 200 },
    { title: '委外数量', dataIndex: 'order_qty', valueType: 'digit', width: 100 },
    { title: '下单日期', dataIndex: 'order_date', valueType: 'date', width: 120 },
  ];

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.OutsourceOrderQuery"
      title={t('app.kuaizhizao.menu.reports.outsource-order-query')}
      reportType="outsource_query"
      columns={columns}
    />
  );
};

export default OutsourceOrderQuery;
