import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

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
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.quality-rate-trend')}
      reportType={QUALITY_REPORT_TYPES.QUALITY_RATE_TREND}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.QualityRateTrend"
      columns={columns}
    />
  );
};

export default QualityRateTrend;
