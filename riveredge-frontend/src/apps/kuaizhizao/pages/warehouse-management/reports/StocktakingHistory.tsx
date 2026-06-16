import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const StocktakingHistory: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      copyableCodeColumn(
        t('app.kuaizhizao.warehouseReports.colStocktakingCode'),
        'order_code',
        150,
      ),
      {
        title: t('app.kuaizhizao.warehouseReports.colWarehouseName'),
        dataIndex: 'warehouse_name',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colBookQty'),
        dataIndex: 'book_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colActualQty'),
        dataIndex: 'actual_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colDiffQty'),
        dataIndex: 'diff_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colCheckDate'),
        dataIndex: 'check_date',
        valueType: 'date',
        width: 120,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.stocktaking-history')}
      reportType="stocktaking_history"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.StocktakingHistory"
    />
  );
};

export default StocktakingHistory;
