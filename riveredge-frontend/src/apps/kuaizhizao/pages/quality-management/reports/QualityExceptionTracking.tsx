import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildQualityReportExceptionColumns } from '../components/qualityMeta';

const QualityExceptionTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildQualityReportExceptionColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.quality-exception-tracking')}
      reportType={QUALITY_REPORT_TYPES.QUALITY_EXCEPTION}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.QualityExceptionTracking"
      columns={columns}
    />
  );
};

export default QualityExceptionTracking;
