import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const StocktakingHistory: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    copyableCodeColumn('盘点单号', 'order_code', 150),
    { title: '仓库名称', dataIndex: 'warehouse_name', width: 150 },
    { title: '账面数量', dataIndex: 'book_qty', valueType: 'digit', width: 100 },
    { title: '实盘数量', dataIndex: 'actual_qty', valueType: 'digit', width: 100 },
    { title: '差异数量', dataIndex: 'diff_qty', valueType: 'digit', width: 100 },
    { title: '盘点日期', dataIndex: 'check_date', valueType: 'date', width: 120 },
  ];

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
