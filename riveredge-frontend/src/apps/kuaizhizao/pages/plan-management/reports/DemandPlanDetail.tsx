import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getPlanReport } from '../../../services/reports';

const DemandPlanDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '需求来源', dataIndex: 'source', width: 120 },
    { title: '来源单号', dataIndex: 'source_code', width: 150 },
    { title: '物料编码', dataIndex: 'material_code', width: 120 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '需求日期', dataIndex: 'requirement_date', valueType: 'date', width: 120 },
    { title: '需求数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.demand-plan-detail')}
      reportType="demand_detail"
      columns={columns}
      request={async (params: any) => {
        const res = await getPlanReport({
          ...params,
          report_type: 'demand_detail',
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


export default DemandPlanDetail;
