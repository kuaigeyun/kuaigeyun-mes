import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';
import { getQualityReport } from '../../../services/reports';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';

const QualityRateTrend: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '月份', dataIndex: 'month', valueType: 'dateMonth', width: 120 },
    { title: 'IQC合格率', dataIndex: 'iqc_rate', valueType: 'percent', width: 120 },
    { title: 'IPQC合格率', dataIndex: 'ipqc_rate', valueType: 'percent', width: 120 },
    { title: 'FQC合格率', dataIndex: 'fqc_rate', valueType: 'percent', width: 120 },
    { title: '综合合格率', dataIndex: 'overall_rate', valueType: 'percent', width: 120, sorter: true },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.quality-rate-trend')}
      reportType={QUALITY_REPORT_TYPES.QUALITY_RATE_TREND}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.QualityRateTrend"
      columns={columns}
      request={async (params: any) => {
        const res = await getQualityReport({
          ...params,
          report_type: QUALITY_REPORT_TYPES.QUALITY_RATE_TREND,
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

export default QualityRateTrend;
