import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildEquipmentSpotCheckColumns } from './equipmentReportColumns';

const EquipmentSpotCheckSummary: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildEquipmentSpotCheckColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-spot-check-summary')}
      reportType="spot_check_summary"
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentSpotCheckSummary-v2"
      rowKey="equipment_id"
      columns={columns}
      summaryFields={['total_count', 'completed_count', 'abnormality_count']}
    />
  );
};

export default EquipmentSpotCheckSummary;
