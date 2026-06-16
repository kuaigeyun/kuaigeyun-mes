import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildQualityReportFinishedColumns } from '../components/qualityMeta';

const FinishedInspectionReport: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildQualityReportFinishedColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.finished-inspection-report')}
      reportType={QUALITY_REPORT_TYPES.FINAL_PASS_RATE}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.FinishedInspectionReport"
      columns={columns}
      summaryFields={['avg_pass_rate']}
    />
  );
};

export default FinishedInspectionReport;
