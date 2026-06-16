import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const EquipmentStatusLog: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.equipmentReports.colEquipmentName'),
        dataIndex: 'equipment_name',
        width: 150,
        render: (_, r: { equipment_name?: string }) => (
          <Typography.Text copyable={{ text: String(r?.equipment_name ?? '') }} ellipsis>
            {r?.equipment_name ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colStatusChange'),
        dataIndex: 'status_change',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colEventTime'),
        dataIndex: 'event_time',
        valueType: 'dateTime',
        width: 180,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colDurationMins'),
        dataIndex: 'duration_mins',
        valueType: 'digit',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.equipmentReports.colRemark'),
        dataIndex: 'remark',
        ellipsis: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.equipment-status-log')}
      reportType="equip_status_log"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.equipment-management.reports.EquipmentStatusLog"
    />
  );
};

export default EquipmentStatusLog;
