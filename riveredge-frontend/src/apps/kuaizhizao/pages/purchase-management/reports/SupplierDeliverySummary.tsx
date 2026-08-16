/**
 * 供应商交货统计
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { reportPercent } from '../../../utils/reportPresentation';

const SupplierDeliverySummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
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
        width: 180,
      },
      {
        title: t('app.kuaizhizao.reports.receiptCount'),
        dataIndex: 'receipt_count',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.receiptQuantity'),
        dataIndex: 'receipt_quantity',
        valueType: 'digit',
        width: 110,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.receiptAmount'),
        dataIndex: 'receipt_amount',
        valueType: 'money',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.ontimeCount'),
        dataIndex: 'ontime_count',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colOntimeRate'),
        dataIndex: 'ontime_rate',
        width: 90,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.ontime_rate),
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.supplier-delivery-summary')}
      reportType="supplier_delivery"
      summaryFields={['receipt_count', 'receipt_quantity', 'receipt_amount']}
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.SupplierDeliverySummary-v2"
      rowKey="supplier_id"
      columns={columns}
    />
  );
};

export default SupplierDeliverySummary;
