import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const EquipmentMaintenancePlan: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    {
      title: '保养项目',
      dataIndex: 'plan_name',
      width: 150,
      render: (_, r: any) => (
        <Typography.Text copyable={{ text: String(r?.plan_name ?? '') }} ellipsis>
          {r?.plan_name ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '设备名称', dataIndex: 'equipment_name', width: 150 },
    { title: '计划日期', dataIndex: 'plan_date', valueType: 'date', width: 120 },
    { title: '执行日期', dataIndex: 'actual_date', valueType: 'date', width: 120 },
    { title: '执行人', dataIndex: 'executor', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

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
