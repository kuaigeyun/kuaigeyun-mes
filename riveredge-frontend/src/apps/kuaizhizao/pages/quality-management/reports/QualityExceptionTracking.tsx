import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';
import { getQualityReport } from '../../../services/reports';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';

const QualityExceptionTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '异常单号', dataIndex: 'exception_code', width: 150 },
    { title: '发现日期', dataIndex: 'discovery_date', valueType: 'date', width: 120 },
    { title: '异常类型', dataIndex: 'type', width: 120 },
    { title: '原因分析', dataIndex: 'reason', ellipsis: true },
    { title: '当前状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.quality-exception-tracking')}
      reportType={QUALITY_REPORT_TYPES.QUALITY_EXCEPTION}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.QualityExceptionTracking"
      columns={columns}
      request={async (params: any) => {
        const res = await getQualityReport({
          ...params,
          report_type: QUALITY_REPORT_TYPES.QUALITY_EXCEPTION,
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

export default QualityExceptionTracking;
