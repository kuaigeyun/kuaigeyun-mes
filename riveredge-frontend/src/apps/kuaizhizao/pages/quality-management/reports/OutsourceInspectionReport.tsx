import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildQualityReportIncomingColumns } from '../components/qualityMeta';

const OutsourceInspectionReport: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildQualityReportIncomingColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.outsource-inspection-report')}
      reportType={QUALITY_REPORT_TYPES.OUTSOURCE_PASS_RATE}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.OutsourceInspectionReport-v1"
      rowKey="id"
      columns={columns}
      summaryFields={['sample_qty', 'qualified_qty', 'unqualified_qty']}
    />
  );
};

export default OutsourceInspectionReport;
