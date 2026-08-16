import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildEquipmentMaintPlanColumns } from './equipmentReportColumns';

const EquipmentMaintenancePlan: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildEquipmentMaintPlanColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-maintenance-plan')}
      reportType="equip_maint_plan"
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentMaintenancePlan-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default EquipmentMaintenancePlan;
