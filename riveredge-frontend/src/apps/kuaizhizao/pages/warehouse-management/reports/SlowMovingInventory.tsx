import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const SlowMovingInventory: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      copyableCodeColumn(
        t('app.kuaizhizao.warehouseReports.colMaterialCode'),
        'material_code',
        120,
      ),
      {
        title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
        dataIndex: 'material_name',
        width: 200,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colBatchNo'),
        dataIndex: 'batch_no',
        width: 140,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colStockQty'),
        dataIndex: 'quantity',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colLastMoveDate'),
        dataIndex: 'last_move_date',
        valueType: 'date',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colAgeDays'),
        dataIndex: 'age_days',
        valueType: 'digit',
        width: 100,
        sorter: true,
      },
    ],
    [t],
  );

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
