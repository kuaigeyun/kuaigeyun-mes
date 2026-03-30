import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const SlowMovingInventory: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '库存数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
    { title: '最后出库日', dataIndex: 'last_out_date', valueType: 'date', width: 120 },
    { title: '呆滞天数', dataIndex: 'idle_days', valueType: 'digit', width: 100, sorter: true },
    { title: '占用资金', dataIndex: 'value', valueType: 'money', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.slow-moving-inventory')}
      reportType="slow_moving"
      columns={columns}
    />
  );
};

export default SlowMovingInventory;
