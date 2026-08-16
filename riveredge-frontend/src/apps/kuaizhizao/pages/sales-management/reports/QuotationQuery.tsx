/**
 * 报价单查询：一行一物料
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { quotationStatusEnum, reportQuotationStatusText } from '../../../utils/reportPresentation';

const QuotationQuery: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.quotationCode'),
        dataIndex: 'quotation_code',
        fixed: 'left',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.quotationDate'),
        dataIndex: 'quotation_date',
        valueType: 'date',
        sorter: true,
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.validUntil'),
        dataIndex: 'valid_until',
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
        title: t('app.kuaizhizao.reports.currency'),
        dataIndex: 'currency_code',
        width: 72,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.status'),
        dataIndex: 'status',
        width: 90,
        valueEnum: quotationStatusEnum(t),
        render: (_, record) => reportQuotationStatusText(t, record.status),
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
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.QuotationQuery-v3"
      title={t('app.kuaizhizao.menu.reports.quotation-query')}
      reportType="quotation"
      rowKey="id"
      summaryFields={['quantity', 'amount']}
      columns={columns}
    />
  );
};

export default QuotationQuery;
