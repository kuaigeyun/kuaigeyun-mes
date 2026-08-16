/**
 * 工时报工明细
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const WorkOrderLaborDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkOrderCode'),
        dataIndex: 'order_code',
        fixed: 'left',
        width: 150,
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProcessName'),
        dataIndex: 'process_name',
        ellipsis: true,
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkerName'),
        dataIndex: 'worker_name',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colQualifiedQty'),
        dataIndex: 'qualified_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReportHours'),
        dataIndex: 'hours',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReportDate'),
        dataIndex: 'report_date',
        valueType: 'dateTime',
        width: 160,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.work-order-labor-detail')}
      reportType="wo_labor_detail"
      summaryFields={['qualified_qty', 'hours']}
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderLaborDetail-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default WorkOrderLaborDetail;
