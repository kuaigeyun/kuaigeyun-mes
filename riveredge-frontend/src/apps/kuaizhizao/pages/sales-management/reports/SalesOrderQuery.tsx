/**
 * 订单明细表：一行一物料
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  reportDocumentStatusText,
  reportReviewStatusText,
  salesOrderStatusEnum,
  salesReviewStatusEnum,
} from '../../../utils/reportPresentation';

const SalesOrderQuery: React.FC = () => {
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
        title: t('app.kuaizhizao.reports.orderDate'),
        dataIndex: 'order_date',
        valueType: 'date',
        sorter: true,
        width: 110,
        hideInSearch: true,
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
        title: t('app.kuaizhizao.reports.unit'),
        dataIndex: 'material_unit',
        width: 80,
        minWidth: 80,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.quantity'),
        dataIndex: 'quantity',
        valueType: 'digit',
        width: 90,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.unitPrice'),
        dataIndex: 'unit_price',
        valueType: 'money',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.amount'),
        dataIndex: 'amount',
        valueType: 'money',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.deliveryDateCol'),
        dataIndex: 'delivery_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.documentStatus'),
        dataIndex: 'status',
        width: 90,
        valueEnum: salesOrderStatusEnum(t),
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
      {
        title: t('app.kuaizhizao.salesOrder.reviewStatus'),
        dataIndex: 'review_status',
        width: 90,
        valueEnum: salesReviewStatusEnum(t),
        render: (_, record) => reportReviewStatusText(t, record.review_status),
      },
      {
        title: t('app.kuaizhizao.reports.salesman'),
        dataIndex: 'salesman_name',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.notes'),
        dataIndex: 'notes',
        ellipsis: true,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.sales-order-query')}
      reportType="summary"
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.SalesOrderQuery-v3"
      rowKey="id"
      summaryFields={['quantity', 'amount']}
      columns={columns}
    />
  );
};

export default SalesOrderQuery;
