import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const EquipmentMttrMtbfAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.equipmentReports.dateRange'),
        dataIndex: 'date_range',
        valueType: 'dateRange',
        hideInTable: true,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colEquipmentCode'),
        dataIndex: 'equipment_code',
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
        dataIndex: 'equipment_name',
        width: 180,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colFaultCount'),
        dataIndex: 'fault_count',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colRepairCount'),
        dataIndex: 'repair_count',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colMttrHours'),
        dataIndex: 'mttr_hours',
        width: 120,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => (r.mttr_hours != null ? `${r.mttr_hours} h` : '-'),
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colMtbfHours'),
        dataIndex: 'mtbf_hours',
        width: 120,
        hideInSearch: true,
        sorter: true,
        render: (_, r) => (r.mtbf_hours != null ? `${r.mtbf_hours} h` : '-'),
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-mttr-mtbf')}
      reportType="mttr_mtbf_summary"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentMttrMtbfAnalysis"
      permissionResource="kuaizhizao:equipment-management-reports-equipment-mttr-mtbf"
      dateRangeKeys={['date_range', 'dateRange']}
    />
  );
};

export default EquipmentMttrMtbfAnalysis;
