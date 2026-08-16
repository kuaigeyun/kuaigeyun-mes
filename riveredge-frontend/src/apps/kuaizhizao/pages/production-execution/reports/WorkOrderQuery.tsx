/**
 * 工单查询
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  reportDocumentStatusText,
  workOrderStatusEnum,
} from '../../../utils/reportPresentation';

const WorkOrderQuery: React.FC = () => {
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
        title: t('app.kuaizhizao.productionExecutionReports.colProductCode'),
        dataIndex: 'product_code',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductName'),
        dataIndex: 'product_name',
        ellipsis: true,
        width: 160,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colPlanQty'),
        dataIndex: 'plan_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.workshop'),
        dataIndex: 'workshop_name',
        ellipsis: true,
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.orderCode'),
        dataIndex: 'sales_order_code',
        width: 150,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkOrderStatus'),
        dataIndex: 'status',
        width: 100,
        valueEnum: workOrderStatusEnum(t),
        search: { order: 40 } as ProColumns['search'],
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colPlannedEndDate'),
        dataIndex: 'planned_end_date',
        valueType: 'dateTime',
        width: 160,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOrderDate'),
        dataIndex: 'created_at',
        valueType: 'dateTime',
        width: 160,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.work-order-query')}
      reportType="wo_query"
      summaryFields={['plan_qty']}
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderQuery-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default WorkOrderQuery;
