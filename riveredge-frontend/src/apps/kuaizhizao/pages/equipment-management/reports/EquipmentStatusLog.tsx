import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildEquipmentStatusLogColumns } from './equipmentReportColumns';

const EquipmentStatusLog: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildEquipmentStatusLogColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-status-log')}
      reportType="equip_status_log"
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentStatusLog-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default EquipmentStatusLog;
