import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildEquipmentFaultAnalysisColumns } from './equipmentReportColumns';

const EquipmentFaultAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildEquipmentFaultAnalysisColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-fault-analysis')}
      reportType="failure_analysis"
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentFaultAnalysis-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default EquipmentFaultAnalysis;
