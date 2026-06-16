import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildQualityReportIncomingColumns } from '../components/qualityMeta';

const IncomingInspectionReport: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildQualityReportIncomingColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.incoming-inspection-report')}
      reportType={QUALITY_REPORT_TYPES.INCOMING_PASS_RATE}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.IncomingInspectionReport"
      columns={columns}
      summaryFields={['avg_pass_rate']}
    />
  );
};

export default IncomingInspectionReport;
