/**
 * 销售未交数量表（订单行未交货明细）
 */
import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Progress, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const OrderExecutionTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    {
      title: t('app.kuaizhizao.reports.plannedDeliveryRange'),
      dataIndex: 'delivery_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      search: { order: 9 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.reports.orderCode'),
      dataIndex: 'order_code',
      copyable: true,
      fixed: 'left',
      width: 150,
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
      width: 150,
    },
    {
      title: t('app.kuaizhizao.reports.materialName'),
      dataIndex: 'material_name',
      ellipsis: true,
      width: 200,
    },
    {
      title: t('app.kuaizhizao.reports.orderQuantity'),
      dataIndex: 'order_quantity',
      valueType: 'digit',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.reports.deliveredQuantity'),
      dataIndex: 'delivered_quantity',
      valueType: 'digit',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.reports.remainingQuantity'),
      dataIndex: 'remaining_quantity',
      valueType: 'digit',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.reports.deliveryProgress'),
      dataIndex: 'delivery_progress',
      width: 180,
      hideInSearch: true,
      render: (_, record) => (
        <Progress
          percent={Math.round((record.delivered_quantity / record.order_quantity) * 100) || 0}
          size="small"
          status={record.remaining_quantity === 0 ? 'success' : 'active'}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.reports.plannedDelivery'),
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.reports.overdue'),
      dataIndex: 'is_overdue',
      width: 100,
      hideInSearch: true,
      render: (_, record) => {
        const isOverdue = new Date(record.delivery_date) < new Date() && record.remaining_quantity > 0;
        return isOverdue ? <Tag color="error">{t('app.kuaizhizao.reports.overdueYes')}</Tag> : <Tag color="success">{t('app.kuaizhizao.reports.overdueNo')}</Tag>;
      },
    },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.order-execution-tracking')}
      reportType="execution"
      dateRangeKeys={['delivery_date_range', 'date_range']}
      summaryFields={['order_quantity', 'delivered_quantity', 'remaining_quantity']}
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.OrderExecutionTracking"
      rowKey="id"
      columns={columns}
    />
  );
};

export default OrderExecutionTracking;
