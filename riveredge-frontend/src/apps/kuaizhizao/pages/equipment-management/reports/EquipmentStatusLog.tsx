import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Typography } from 'antd';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const EquipmentStatusLog: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    {
      title: '设备名称',
      dataIndex: 'equipment_name',
      width: 150,
      render: (_, r: any) => (
        <Typography.Text copyable={{ text: String(r?.equipment_name ?? '') }} ellipsis>
          {r?.equipment_name ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '状态变更', dataIndex: 'status_change', width: 150 },
    { title: '发生时间', dataIndex: 'event_time', valueType: 'dateTime', width: 180 },
    { title: '持续时长(分)', dataIndex: 'duration_mins', valueType: 'digit', width: 120 },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.equipment-status-log')}
      reportType="equip_status_log"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentStatusLog"
    />
  );
};

export default EquipmentStatusLog;
