import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const WorkOrderTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkOrderCode'),
        dataIndex: 'order_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProcessName'),
        dataIndex: 'process_name',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colEquipmentName'),
        dataIndex: 'equipment_name',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colTodayOutput'),
        dataIndex: 'today_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOverallProgress'),
        dataIndex: 'overall_progress',
        valueType: 'percent',
        width: 100,
      },
    ],
    [t],
  );

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
