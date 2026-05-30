import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPerformanceReport } from '../../../services/reports';

const EmployeeEfficiencyRanking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '员工', dataIndex: 'worker_name', width: 140 },
    { title: '总产出', dataIndex: 'total_pieces', valueType: 'digit', width: 100, align: 'right' },
    { title: '总工时', dataIndex: 'total_hours', valueType: 'digit', width: 100, align: 'right' },
    { title: '件/小时', dataIndex: 'pieces_per_hour', valueType: 'digit', width: 100, align: 'right' },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.employee-efficiency-ranking')}
      reportType="employee-efficiency-ranking"
      columnPersistenceId="apps.kuaizhizao.pages.performance.reports.EmployeeEfficiencyRanking"
      columns={columns}
      request={async (params: any) => {
        const res = await getPerformanceReport({
          ...params,
          report_type: 'employee-efficiency-ranking',
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
