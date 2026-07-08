import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const WorkOrderLaborDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.statPeriod'),
        dataIndex: 'date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        ...copyableCodeColumn(t('app.kuaizhizao.productionExecutionReports.colReportCode'), 'report_code', 150),
        sorter: true,
        hideInSearch: true,
      },
      {
        ...copyableCodeColumn(t('app.kuaizhizao.productionExecutionReports.colWorkOrderCode'), 'order_code', 150),
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkerName'),
        dataIndex: 'worker_name',
        width: 120,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProcessName'),
        dataIndex: 'process_name',
        width: 120,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colQualifiedQty'),
        dataIndex: 'qualified_qty',
        valueType: 'digit',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReportHours'),
        dataIndex: 'hours',
        valueType: 'digit',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReportDate'),
        dataIndex: 'report_date',
        valueType: 'dateTime',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderLaborDetail"
      title={t('app.kuaizhizao.menu.reports.work-order-labor-detail')}
      reportType="wo_labor_detail"
      dateRangeKeys={['date_range', 'dateRange']}
      rowKey="report_code"
      columns={columns}
    />
  );
};

export default WorkOrderLaborDetail;
