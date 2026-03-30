import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getProductionReport } from '../../../services/reports';

const ProductionLeadTime: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '工单单号', dataIndex: 'code', width: 150 },
    { title: '产品名称', dataIndex: 'material_name', width: 200 },
    { title: '实际开工', dataIndex: 'actual_start_date', valueType: 'date', width: 120 },
    { title: '实际完工', dataIndex: 'actual_end_date', valueType: 'date', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.production-lead-time')}
      reportType="lead_time"
      columns={columns}
      request={async (params: any) => {
        const res = await getProductionReport({
          ...params,
          report_type: 'lead_time',
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


export default ProductionLeadTime;
