import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPlanReport } from '../../../services/reports';

const ProductionPlanComparison: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '计划单号', dataIndex: 'plan_code', width: 150 },
    { title: '计划名称', dataIndex: 'plan_name', width: 200 },
    { title: '开始日期', dataIndex: 'plan_start_date', valueType: 'date', width: 120 },
    { title: '结束日期', dataIndex: 'plan_end_date', valueType: 'date', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '工单数', dataIndex: 'total_work_orders', valueType: 'digit', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.production-plan-comparison')}
      reportType="production_comparison"
      columns={columns}
      request={async (params: any) => {
        const res = await getPlanReport({
          ...params,
          report_type: 'production_comparison',
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


export default ProductionPlanComparison;
