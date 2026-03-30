import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const EquipmentMaintenanceDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '维修单号', dataIndex: 'maint_code', width: 150 },
    { title: '设备名称', dataIndex: 'equipment_name', width: 150 },
    { title: '故障描述', dataIndex: 'fault_desc', ellipsis: true },
    { title: '维修人员', dataIndex: 'maint_person', width: 100 },
    { title: '完成日期', dataIndex: 'completed_at', valueType: 'date', width: 120 },
    { title: '维修工时', dataIndex: 'maint_hours', valueType: 'digit', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.equipment-maintenance-detail')}
      reportType="equip_maint_detail"
      columns={columns}
    />
  );
};

export default EquipmentMaintenanceDetail;
