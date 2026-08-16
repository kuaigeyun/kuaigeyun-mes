/**
 * 计划达成率：一行一物料
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  demandTypeEnum,
  reportDemandTypeText,
  reportDocumentStatusText,
  reportOverdueText,
  reportPercent,
  salesOrderStatusEnum,
} from '../../../utils/reportPresentation';

const PlanFulfillmentRate: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.planReports.colPlanCode'),
        dataIndex: 'plan_code',
        fixed: 'left',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.demandType'),
        dataIndex: 'demand_type',
        width: 110,
        valueEnum: demandTypeEnum(t),
        render: (_, record) => reportDemandTypeText(t, record.demand_type),
      },
      {
        title: t('app.kuaizhizao.reports.customerName'),
        dataIndex: 'customer_name',
        ellipsis: true,
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.materialCode'),
        dataIndex: 'material_code',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.materialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        width: 160,
      },
      {
        title: t('app.kuaizhizao.reports.materialSpec'),
        dataIndex: 'material_spec',
        ellipsis: true,
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.unit'),
        dataIndex: 'material_unit',
        width: 80,
        minWidth: 80,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.planReports.colPlannedQty'),
        dataIndex: 'planned_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.planReports.colCompletedQty'),
        dataIndex: 'completed_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.remainingQuantity'),
        dataIndex: 'remaining_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.planReports.colFulfillmentRate'),
        dataIndex: 'fulfillment_rate',
        width: 90,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.fulfillment_rate),
      },
      {
        title: t('app.kuaizhizao.reports.plannedDelivery'),
        dataIndex: 'delivery_date',
        valueType: 'date',
        width: 110,
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
        title: t('common.status'),
        dataIndex: 'delivery_status',
        width: 100,
        hideInSearch: true,
        render: (_, record) => reportDocumentStatusText(t, record.delivery_status),
      },
      {
        title: t('app.kuaizhizao.reports.documentStatus'),
        dataIndex: 'status',
        width: 100,
        valueEnum: salesOrderStatusEnum(t),
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.reports.salesman'),
        dataIndex: 'salesman_name',
        width: 100,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.plan-fulfillment-rate')}
      reportType="fulfillment"
      summaryFields={['planned_quantity', 'completed_quantity', 'remaining_quantity']}
      columnPersistenceId="apps.kuaizhizao.pages.plan-management.reports.PlanFulfillmentRate-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default PlanFulfillmentRate;
