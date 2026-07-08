import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { buildWorkOrderLifecycleValueEnum } from '../../../utils/workOrderLifecycle';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const WorkOrderQuery: React.FC = () => {
  const { t } = useTranslation();
  const statusValueEnum = useMemo(() => buildWorkOrderLifecycleValueEnum(t), [t]);
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
        ...copyableCodeColumn(t('app.kuaizhizao.productionExecutionReports.colWorkOrderCode'), 'order_code', 150),
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductName'),
        dataIndex: 'product_name',
        width: 200,
        ellipsis: true,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colPlanQty'),
        dataIndex: 'plan_qty',
        valueType: 'digit',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkOrderStatus'),
        dataIndex: 'status',
        width: 100,
        valueType: 'select',
        valueEnum: statusValueEnum,
        sorter: true,
        search: { order: 40 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOrderDate'),
        dataIndex: 'created_at',
        valueType: 'dateTime',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
      },
    ],
    [t, statusValueEnum],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderQuery"
      title={t('app.kuaizhizao.menu.reports.work-order-query')}
      reportType="wo_query"
      dateRangeKeys={['date_range', 'dateRange']}
      rowKey="order_code"
      columns={columns}
    />
  );
};

export default WorkOrderQuery;
