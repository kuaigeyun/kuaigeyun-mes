import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const EquipmentMaintenanceDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.equipmentReports.colMaintCode'),
        dataIndex: 'maint_code',
        width: 150,
        render: (_, r: { maint_code?: string }) => (
          <Typography.Text copyable={{ text: String(r?.maint_code ?? '') }} ellipsis>
            {r?.maint_code ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
        dataIndex: 'equipment_name',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colFaultDesc'),
        dataIndex: 'fault_desc',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colMaintPerson'),
        dataIndex: 'maint_person',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colCompletedAt'),
        dataIndex: 'completed_at',
        valueType: 'date',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colMaintHours'),
        dataIndex: 'maint_hours',
        valueType: 'digit',
        width: 100,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-maintenance-detail')}
      reportType="equip_maint_detail"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentMaintenanceDetail"
    />
  );
};

export default EquipmentMaintenanceDetail;
