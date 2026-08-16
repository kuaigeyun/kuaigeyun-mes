/**
 * 采购执行进度：一行一物料
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  purchaseOrderStatusEnum,
  reportDocumentStatusText,
  reportOverdueText,
  reportPercent,
} from '../../../utils/reportPresentation';

const PurchaseOrderProgress: React.FC = () => {
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
        title: t('app.kuaizhizao.reports.unit'),
        dataIndex: 'unit',
        width: 80,
        minWidth: 80,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colOrderQty'),
        dataIndex: 'ordered_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colReceiptQty'),
        dataIndex: 'received_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colPendingQty'),
        dataIndex: 'outstanding_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colProgress'),
        dataIndex: 'receipt_progress',
        width: 90,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.receipt_progress),
      },
      {
        title: t('app.kuaizhizao.reports.requiredDate'),
        dataIndex: 'required_date',
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
        title: t('app.kuaizhizao.reports.documentStatus'),
        dataIndex: 'status',
        width: 100,
        valueEnum: purchaseOrderStatusEnum(t),
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colBuyer'),
        dataIndex: 'buyer_name',
        width: 100,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.purchase-order-progress')}
      reportType="po_progress"
      summaryFields={['ordered_quantity', 'received_quantity', 'outstanding_quantity']}
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.PurchaseOrderProgress-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default PurchaseOrderProgress;
