/**
 * 报价单综合查询报表
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const QuotationQuery: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.quotationDateRange'),
        dataIndex: 'quotation_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        search: { order: 10 } as any,
      },
      {
        title: t('app.kuaizhizao.reports.quotationCode'),
        dataIndex: 'quotation_code',
        copyable: true,
        fixed: 'left',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.quotationDate'),
        dataIndex: 'quotation_date',
        valueType: 'date',
        sorter: true,
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.customerName'),
        dataIndex: 'customer_name',
        ellipsis: true,
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.quotationTotal'),
        dataIndex: 'total_amount',
        valueType: 'money',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.status'),
        dataIndex: 'status',
        width: 100,
        valueEnum: {
          DRAFT: { text: t('documentStatus.draft'), status: 'Default' },
          SENT: { text: t('app.kuaizhizao.reports.quotationStatusSent'), status: 'Processing' },
          ACCEPTED: { text: t('app.kuaizhizao.reports.quotationStatusAccepted'), status: 'Success' },
          REJECTED: { text: t('reviewStatus.rejected'), status: 'Error' },
          EXPIRED: { text: t('app.kuaizhizao.reports.quotationStatusExpired'), status: 'Warning' },
        },
      },
      {
        title: t('app.kuaizhizao.reports.salesman'),
        dataIndex: 'salesman_name',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.reports.notes'),
        dataIndex: 'notes',
        ellipsis: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.QuotationQuery"
      title={t('app.kuaizhizao.menu.reports.quotation-query')}
      reportType="quotation"
      columns={columns}
      dateRangeKeys={['quotation_date_range', 'date_range', 'dateRange']}
    />
  );
};

export default QuotationQuery;
