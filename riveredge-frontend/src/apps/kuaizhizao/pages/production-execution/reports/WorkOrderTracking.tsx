import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const WorkOrderTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '工单单号', dataIndex: 'order_code', width: 150 },
    { title: '工序名称', dataIndex: 'process_name', width: 120 },
    { title: '设备名称', dataIndex: 'equipment_name', width: 150 },
    { title: '今日产出', dataIndex: 'today_qty', valueType: 'digit', width: 100 },
    { title: '总进度', dataIndex: 'overall_progress', valueType: 'percent', width: 100 },
  ];

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderTracking"
      title={t('app.kuaizhizao.menu.reports.work-order-tracking')}
      reportType="wo_tracking"
      columns={columns}
    />
  );
};

export default WorkOrderTracking;
