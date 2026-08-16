/**
 * 退货明细表
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { reportDocumentStatusText, salesOrderStatusEnum } from '../../../utils/reportPresentation';

const SalesReturnDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.returnCode'),
        dataIndex: 'return_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.returnDate'),
        dataIndex: 'return_date',
        valueType: 'date',
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
        title: t('app.kuaizhizao.reports.salesOrderCode'),
        dataIndex: 'sales_order_code',
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.deliveryCode'),
        dataIndex: 'sales_delivery_code',
        width: 140,
        hideInSearch: true,
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
        title: t('app.kuaizhizao.reports.documentStatus'),
        dataIndex: 'status',
        width: 90,
        hideInSearch: true,
        valueEnum: salesOrderStatusEnum(t),
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
      {
        title: t('app.kuaizhizao.reports.returnReason'),
        dataIndex: 'return_reason',
        ellipsis: true,
        width: 140,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.sales-return-detail')}
      reportType="sales-return-detail"
      summaryFields={['quantity', 'amount']}
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.SalesReturnDetail-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default SalesReturnDetail;
