/**
 * 工单状态跟踪
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  reportDocumentStatusText,
  reportOverdueText,
  reportPercent,
  workOrderStatusEnum,
} from '../../../utils/reportPresentation';

const WorkOrderTracking: React.FC = () => {
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
        dataIndex: 'planned_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colActualIssueQty'),
        dataIndex: 'actual_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.remainingQty'),
        dataIndex: 'remaining_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOverallProgress'),
        dataIndex: 'overall_progress',
        width: 90,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.overall_progress),
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colPlannedEndDate'),
        dataIndex: 'planned_end_date',
        valueType: 'dateTime',
        width: 160,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.overdue'),
        dataIndex: 'is_overdue',
        width: 110,
        hideInSearch: true,
        render: (_, record) =>
          reportOverdueText(t, Boolean(record.is_overdue), record.overdue_days),
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkOrderStatus'),
        dataIndex: 'status',
        width: 100,
        valueEnum: workOrderStatusEnum(t),
        search: { order: 40 } as ProColumns['search'],
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.work-order-tracking')}
      reportType="wo_tracking"
      summaryFields={['planned_qty', 'actual_qty', 'remaining_qty']}
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderTracking-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default WorkOrderTracking;
