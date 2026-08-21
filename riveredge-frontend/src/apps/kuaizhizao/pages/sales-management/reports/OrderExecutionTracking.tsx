/**
 * 未交数量表
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { reportOverdueText, reportPercent } from '../../../utils/reportPresentation';

const OrderExecutionTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.orderCode'),
        dataIndex: 'order_code',
        fixed: 'left',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.customerCode'),
        dataIndex: 'customer_code',
        width: 120,
        hideInSearch: true,
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
        title: t('common.unit'),
        dataIndex: 'material_unit',
        width: 80,
        minWidth: 80,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.orderQuantity'),
        dataIndex: 'order_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.deliveredQuantity'),
        dataIndex: 'delivered_quantity',
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
        title: t('app.kuaizhizao.reports.openAmount'),
        dataIndex: 'open_amount',
        valueType: 'money',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.deliveryProgress'),
        dataIndex: 'delivery_progress',
        width: 90,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.delivery_progress),
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
      title={t('app.kuaizhizao.menu.reports.order-execution-tracking')}
      reportType="execution"
      summaryFields={['order_quantity', 'delivered_quantity', 'remaining_quantity', 'open_amount']}
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.OrderExecutionTracking-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default OrderExecutionTracking;
