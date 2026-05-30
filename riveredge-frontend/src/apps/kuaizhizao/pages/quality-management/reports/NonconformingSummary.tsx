import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';
import { getQualityReport } from '../../../services/reports';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';

const NonconformingSummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '处理单号', dataIndex: 'handle_code', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '不良数量', dataIndex: 'unqualified_qty', valueType: 'digit', width: 100 },
    { title: '处理方式', dataIndex: 'disposal_method', width: 120 },
    { title: '处理日期', dataIndex: 'disposal_date', valueType: 'date', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.nonconforming-summary')}
      reportType={QUALITY_REPORT_TYPES.NONCONFORMING_SUMMARY}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.NonconformingSummary"
      columns={columns}
      request={async (params: any) => {
        const res = await getQualityReport({
          ...params,
          report_type: QUALITY_REPORT_TYPES.NONCONFORMING_SUMMARY,
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

export default NonconformingSummary;
