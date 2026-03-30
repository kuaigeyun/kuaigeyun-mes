import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const StocktakingHistory: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '盘点单号', dataIndex: 'order_code', width: 150 },
    { title: '仓库名称', dataIndex: 'warehouse_name', width: 150 },
    { title: '账面数量', dataIndex: 'book_qty', valueType: 'digit', width: 100 },
    { title: '实盘数量', dataIndex: 'actual_qty', valueType: 'digit', width: 100 },
    { title: '差异数量', dataIndex: 'diff_qty', valueType: 'digit', width: 100 },
    { title: '盘点日期', dataIndex: 'check_date', valueType: 'date', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.stocktaking-history')}
      reportType="stocktaking_history"
      columns={columns}
    />
  );
};

export default StocktakingHistory;
