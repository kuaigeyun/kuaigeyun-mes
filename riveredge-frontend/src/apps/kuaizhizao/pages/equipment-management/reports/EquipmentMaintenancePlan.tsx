import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const EquipmentMaintenancePlan: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.equipmentReports.colPlanName'),
        dataIndex: 'plan_name',
        width: 150,
        render: (_, r: { plan_name?: string }) => (
          <Typography.Text copyable={{ text: String(r?.plan_name ?? '') }} ellipsis>
            {r?.plan_name ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
        dataIndex: 'equipment_name',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colPlanDate'),
        dataIndex: 'plan_date',
        valueType: 'date',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colActualDate'),
        dataIndex: 'actual_date',
        valueType: 'date',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colExecutor'),
        dataIndex: 'executor',
        width: 100,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-maintenance-plan')}
      reportType="equip_maint_plan"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentMaintenancePlan"
    />
  );
};

export default EquipmentMaintenancePlan;
