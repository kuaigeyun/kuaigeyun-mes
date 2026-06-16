import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const WorkOrderLaborDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReportCode'),
        dataIndex: 'report_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkerName'),
        dataIndex: 'worker_name',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProcessName'),
        dataIndex: 'process_name',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colQualifiedQty'),
        dataIndex: 'qualified_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReportHours'),
        dataIndex: 'hours',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReportDate'),
        dataIndex: 'report_date',
        valueType: 'date',
        width: 120,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderLaborDetail"
      title={t('app.kuaizhizao.menu.reports.work-order-labor-detail')}
      reportType="wo_labor_detail"
      columns={columns}
    />
  );
};

export default WorkOrderLaborDetail;
