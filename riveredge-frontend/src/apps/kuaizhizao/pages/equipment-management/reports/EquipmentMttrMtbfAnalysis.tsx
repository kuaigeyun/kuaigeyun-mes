import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { buildEquipmentMttrColumns } from './equipmentReportColumns';

const EquipmentMttrMtbfAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns = useMemo(() => buildEquipmentMttrColumns(t), [t]);

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-mttr-mtbf')}
      reportType="mttr_mtbf_summary"
      permissionResource="kuaizhizao:equipment-management-reports-equipment-mttr-mtbf"
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentMttrMtbfAnalysis-v2"
      rowKey="equipment_id"
      columns={columns}
    />
  );
};

export default EquipmentMttrMtbfAnalysis;
