import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPerformanceReport } from '../../../services/reports';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';

const EmployeeEfficiencyRanking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    copyableCodeColumn('工单号', 'code', 150),
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '实际产出', dataIndex: 'actual_quantity', valueType: 'digit', width: 100 },
    { title: '完成日期', dataIndex: 'actual_end_date', valueType: 'date', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.employee-efficiency-ranking')}
      reportType="efficiency_ranking"
      columnPersistenceId="apps.kuaizhizao.pages.performance.reports.EmployeeEfficiencyRanking"
      columns={columns}
      request={async (params: any) => {
        const res = await getPerformanceReport({
          ...params,
          report_type: 'efficiency_ranking',
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


export default EmployeeEfficiencyRanking;
