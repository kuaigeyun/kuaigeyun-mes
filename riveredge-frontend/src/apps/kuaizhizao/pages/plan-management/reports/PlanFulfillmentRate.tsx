import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPlanReport } from '../../../services/reports';


const PlanFulfillmentRate: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '计划单号', dataIndex: 'plan_code', width: 150 },
    { title: '产品名称', dataIndex: 'material_name', width: 200 },
    { title: '计划数量', dataIndex: 'planned_quantity', valueType: 'digit', width: 100 },
    { title: '完成数量', dataIndex: 'completed_quantity', valueType: 'digit', width: 100 },
    { title: '达成率', dataIndex: 'fulfillment_rate', valueType: 'percent', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.plan-fulfillment-rate')}
      reportType="fulfillment"
      columns={columns}
      request={async (params) => {
        const res = await getPlanReport({
          ...params,
          report_type: 'fulfillment',
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


export default PlanFulfillmentRate;
