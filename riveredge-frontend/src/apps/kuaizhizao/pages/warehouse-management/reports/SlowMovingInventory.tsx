import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const SlowMovingInventory: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    copyableCodeColumn('物料编码', 'material_code', 120),
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '批次号', dataIndex: 'batch_no', width: 140 },
    { title: '库存数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
    { title: '最后变动日', dataIndex: 'last_move_date', valueType: 'date', width: 120 },
    { title: '库龄(天)', dataIndex: 'age_days', valueType: 'digit', width: 100, sorter: true },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.slow-moving-inventory')}
      reportType="slow_moving"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.SlowMovingInventory"
      summaryFields={['stale_days', 'material_count']}
    />
  );
};

export default SlowMovingInventory;
