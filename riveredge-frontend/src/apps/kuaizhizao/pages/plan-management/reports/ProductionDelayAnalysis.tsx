import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPlanReport } from '../../../services/reports';

const ProductionDelayAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '工单单号', dataIndex: 'code', width: 150 },
    { title: '产品名称', dataIndex: 'material_name', width: 200 },
    { title: '计划完工', dataIndex: 'planned_end_date', valueType: 'date', width: 120 },
    { title: '实际完工', dataIndex: 'actual_end_date', valueType: 'date', width: 120 },
    { title: '延期天数', dataIndex: 'delay_days', valueType: 'digit', width: 100, sorter: true },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.production-delay-analysis')}
      reportType="delay_analysis"
      columns={columns}
      request={async (params: any) => {
        const res = await getPlanReport({
          ...params,
          report_type: 'delay_analysis',
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


export default ProductionDelayAnalysis;
