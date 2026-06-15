/**
 * 销售合同执行报表
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Progress, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';

const ContractExecutionReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.signDate'),
        dataIndex: 'date_range',
        valueType: 'dateRange',
        hideInTable: true,
        search: { order: 9 } as any,
      },
      {
        title: t('app.kuaizhizao.reports.contractCode'),
        dataIndex: 'contract_code',
        copyable: true,
        fixed: 'left',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.contractType'),
        dataIndex: 'contract_type',
        width: 100,
        render: (_, r) =>
          r.contract_type === 'framework'
            ? t('app.kuaizhizao.reports.contractTypeFramework')
            : t('app.kuaizhizao.reports.contractTypeSingle'),
      },
      {
        title: t('app.kuaizhizao.reports.customerName'),
        dataIndex: 'customer_name',
        ellipsis: true,
        width: 160,
      },
      {
        title: t('app.kuaizhizao.reports.signDate'),
        dataIndex: 'contract_date',
        valueType: 'date',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.validTo'),
        dataIndex: 'valid_to',
        valueType: 'date',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.contractAmount'),
        dataIndex: 'total_amount',
        valueType: 'money',
        width: 120,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.releasedAmount'),
        dataIndex: 'released_amount',
        valueType: 'money',
        width: 120,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.remainingAmount'),
        dataIndex: 'remaining_amount',
        valueType: 'money',
        width: 120,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.executionRate'),
        dataIndex: 'execution_rate',
        width: 160,
        render: (_, record) => (
          <Progress
            percent={Math.round(Number(record.execution_rate) || 0)}
            size="small"
            status={Number(record.execution_rate) >= 100 ? 'success' : 'active'}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.reports.paymentCollectionRate'),
        dataIndex: 'payment_collection_rate',
        width: 160,
        render: (_, record) => (
          <Progress
            percent={Math.round(Number(record.payment_collection_rate) || 0)}
            size="small"
            status={Number(record.payment_collection_rate) >= 100 ? 'success' : 'active'}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.reports.releaseOrderCount'),
        dataIndex: 'release_order_count',
        width: 100,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.status'),
        dataIndex: 'status',
        width: 100,
        render: (_, r) => <Tag>{r.status}</Tag>,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.contract-execution.index"
      title={t('app.kuaizhizao.menu.reports.contract-execution')}
      reportType="contract-execution"
      columns={columns}
      dateRangeKeys={['date_range', 'contract_date_range']}
    />
  );
};

export default ContractExecutionReport;
