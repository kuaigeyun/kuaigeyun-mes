import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPlanReport } from '../../../services/reports';

const CapacityLoadAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '工序名称', dataIndex: 'operation_name', width: 150 },
    { title: '计划开始', dataIndex: 'planned_start_date', valueType: 'date', width: 120 },
    { title: '计划结束', dataIndex: 'planned_end_date', valueType: 'date', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.capacity-load-analysis')}
      reportType="capacity_load"
      columns={columns}
      request={async (params: any) => {
        const res = await getPlanReport({
          ...params,
          report_type: 'capacity_load',
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


export default CapacityLoadAnalysis;
