import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const SlowMovingInventory: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseReports.colMaterialCode'),
        dataIndex: 'material_code',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        width: 180,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colBatchNo'),
        dataIndex: 'batch_no',
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colStockQty'),
        dataIndex: 'quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colLastMoveDate'),
        dataIndex: 'last_move_date',
        valueType: 'date',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colAgeDays'),
        dataIndex: 'age_days',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
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
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.SlowMovingInventory-v2"
      summaryFields={['quantity']}
    />
  );
};

export default SlowMovingInventory;
