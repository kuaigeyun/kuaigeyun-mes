/**
 * 采购订单查询：一行一物料
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  purchaseOrderStatusEnum,
  reportDocumentStatusText,
  reportReviewStatusText,
  salesReviewStatusEnum,
} from '../../../utils/reportPresentation';

const PurchaseOrderQuery: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseReports.colOrderCode'),
        dataIndex: 'order_code',
        fixed: 'left',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colOrderDate'),
        dataIndex: 'order_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.supplierCode'),
        dataIndex: 'supplier_code',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colSupplier'),
        dataIndex: 'supplier_name',
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
        dataIndex: 'unit',
        width: 80,
        minWidth: 80,
        hideInSearch: true,
      },
      {
        title: t('common.quantity'),
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
        title: t('app.kuaizhizao.reports.requiredDate'),
        dataIndex: 'required_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.documentStatus'),
        dataIndex: 'status',
        width: 100,
        valueEnum: purchaseOrderStatusEnum(t),
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
      {
        title: t('app.kuaizhizao.salesOrder.reviewStatus'),
        dataIndex: 'review_status',
        width: 90,
        hideInSearch: true,
        valueEnum: salesReviewStatusEnum(t),
        render: (_, record) => reportReviewStatusText(t, record.review_status),
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colBuyer'),
        dataIndex: 'buyer_name',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('common.remark'),
        dataIndex: 'notes',
        ellipsis: true,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.purchase-order-query')}
      reportType="po_query"
      summaryFields={['quantity', 'amount']}
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.PurchaseOrderQuery-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default PurchaseOrderQuery;
