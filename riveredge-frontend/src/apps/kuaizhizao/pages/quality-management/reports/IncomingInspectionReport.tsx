import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getQualityReport } from '../../../services/reports';

const IncomingInspectionReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '检验单号', dataIndex: 'inspection_code', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '批次号', dataIndex: 'batch_no', width: 150 },
    { title: '检验日期', dataIndex: 'inspection_date', valueType: 'date', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.incoming-inspection-report')}
      reportType="incoming_pass_rate"
      columns={columns}
      request={async (params: any) => {
        const res = await getQualityReport({
          ...params,
          report_type: 'incoming_pass_rate',
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


export default IncomingInspectionReport;
