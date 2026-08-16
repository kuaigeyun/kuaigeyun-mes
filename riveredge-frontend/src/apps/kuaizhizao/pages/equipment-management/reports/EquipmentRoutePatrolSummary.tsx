import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildEquipmentRoutePatrolColumns } from './equipmentReportColumns';

const EquipmentRoutePatrolSummary: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildEquipmentRoutePatrolColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-route-patrol-summary')}
      reportType="route_patrol_summary"
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentRoutePatrolSummary-v2"
      rowKey="route_id"
      columns={columns}
      summaryFields={['total_count', 'completed_count', 'abnormality_count']}
    />
  );
};

export default EquipmentRoutePatrolSummary;
