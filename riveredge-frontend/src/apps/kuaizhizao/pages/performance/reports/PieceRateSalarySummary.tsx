import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPerformanceReport } from '../../../services/reports';

const PieceRateSalarySummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '工单号', dataIndex: 'code', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '实际产出', dataIndex: 'actual_quantity', valueType: 'digit', width: 100 },
    { title: '完成日期', dataIndex: 'actual_end_date', valueType: 'date', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.piece-rate-salary-summary')}
      reportType="piece_rate"
      columns={columns}
      request={async (params: any) => {
        const res = await getPerformanceReport({
          ...params,
          report_type: 'piece_rate',
        });
        return {
          data: res.data || [],
          success: res.success,
          total: res.data?.length || 0,
        };
      }}
    />
  );
};


export default PieceRateSalarySummary;
