import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildPerformanceSalaryReportColumns } from '../components/performanceMeta';

const PieceRateSalarySummary: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildPerformanceSalaryReportColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.piece-rate-salary-summary')}
      reportType="piece-rate-salary-summary"
      columnPersistenceId="apps.kuaizhizao.pages.performance.reports.PieceRateSalarySummary"
      columns={columns}
    />
  );
};

export default PieceRateSalarySummary;
