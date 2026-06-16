import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildQualityReportRateTrendColumns } from '../components/qualityMeta';

const QualityRateTrend: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildQualityReportRateTrendColumns(t), [t]);

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
