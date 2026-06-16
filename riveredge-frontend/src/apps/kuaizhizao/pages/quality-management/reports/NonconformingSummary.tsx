import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildQualityReportNonconformingColumns } from '../components/qualityMeta';

const NonconformingSummary: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildQualityReportNonconformingColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.nonconforming-summary')}
      reportType={QUALITY_REPORT_TYPES.NONCONFORMING_SUMMARY}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.NonconformingSummary"
      summaryFields={['unqualified_qty']}
      rowKey="handle_code"
      columns={columns}
    />
  );
};

export default NonconformingSummary;
