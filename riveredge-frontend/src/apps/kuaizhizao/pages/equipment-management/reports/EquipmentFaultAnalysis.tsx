import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const EquipmentFaultAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '设备名称', dataIndex: 'equipment_name', width: 200 },
    { title: '故障次数', dataIndex: 'count', valueType: 'digit', width: 120, sorter: true },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-fault-analysis')}
      reportType="failure_analysis"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentFaultAnalysis"
    />
  );
};

export default EquipmentFaultAnalysis;
