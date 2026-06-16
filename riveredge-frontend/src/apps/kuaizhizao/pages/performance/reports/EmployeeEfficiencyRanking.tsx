import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildPerformanceEfficiencyReportColumns } from '../components/performanceMeta';

const EmployeeEfficiencyRanking: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildPerformanceEfficiencyReportColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.employee-efficiency-ranking')}
      reportType="employee-efficiency-ranking"
      columnPersistenceId="apps.kuaizhizao.pages.performance.reports.EmployeeEfficiencyRanking"
      columns={columns}
    />
  );
};

export default EmployeeEfficiencyRanking;
