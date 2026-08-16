import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildEquipmentMaintDetailColumns } from './equipmentReportColumns';

const EquipmentMaintenanceDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildEquipmentMaintDetailColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-maintenance-detail')}
      reportType="equip_maint_detail"
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentMaintenanceDetail-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default EquipmentMaintenanceDetail;
