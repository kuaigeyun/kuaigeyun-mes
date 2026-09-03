/**
 * 供应商交货统计
 */
import React, { useMemo, useState } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { reportPercent } from '../../../utils/reportPresentation';

type PeriodBasis = 'receipt_time' | 'required_date' | 'order_date';

const SupplierDeliverySummary: React.FC = () => {
  const { t } = useTranslation();
  const [periodBasis, setPeriodBasis] = useState<PeriodBasis>('receipt_time');

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

  const periodOptions = useMemo(
    () =>
      (
        [
          'receipt_time',
          'required_date',
          'order_date',
        ] as PeriodBasis[]
      ).map((value) => ({
        value,
        label: t(`app.kuaizhizao.purchaseReports.periodBasis.${value}`),
      })),
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.supplier-delivery-summary')}
      reportType="supplier_delivery"
      summaryFields={['receipt_count', 'receipt_quantity', 'receipt_amount']}
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.SupplierDeliverySummary-v3"
      rowKey="supplier_id"
      columns={columns}
      params={{ period_basis: periodBasis }}
      periodFilterLabel={t(`app.kuaizhizao.purchaseReports.periodBasis.${periodBasis}.periodLabel`)}
      beforeSearchButtons={
        <ThemedSegmented
          surfaceBackground
          size="small"
          value={periodBasis}
          onChange={(value) => setPeriodBasis(value as PeriodBasis)}
          options={periodOptions}
        />
      }
    />
  );
};

export default SupplierDeliverySummary;
