import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildQualityReportProcessColumns } from '../components/qualityMeta';

const ProcessInspectionReport: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildQualityReportProcessColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.process-inspection-report')}
      reportType={QUALITY_REPORT_TYPES.PROCESS_PASS_RATE}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.ProcessInspectionReport"
      columns={columns}
      summaryFields={['avg_pass_rate']}
    />
  );
};

export default ProcessInspectionReport;
