/**
 * 合同执行表
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import {
  reportDocumentStatusText,
  reportPercent,
  reportTextEnum,
  salesOrderStatusEnum,
} from '../../../../utils/reportPresentation';

const ContractExecutionReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.contractCode'),
        dataIndex: 'contract_code',
        fixed: 'left',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.contractType'),
        dataIndex: 'contract_type',
        width: 100,
        valueEnum: reportTextEnum({
          framework: t('app.kuaizhizao.reports.contractTypeFramework'),
          single: t('app.kuaizhizao.reports.contractTypeSingle'),
        }),
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
        title: t('app.kuaizhizao.reports.signDate'),
        dataIndex: 'contract_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.validTo'),
        dataIndex: 'valid_to',
        valueType: 'date',
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
        title: t('app.kuaizhizao.reports.contractAmount'),
        dataIndex: 'total_amount',
        valueType: 'money',
        width: 120,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.releasedAmount'),
        dataIndex: 'released_amount',
        valueType: 'money',
        width: 110,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.remainingAmount'),
        dataIndex: 'remaining_amount',
        valueType: 'money',
        width: 110,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.executionRate'),
        dataIndex: 'execution_rate',
        width: 90,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.execution_rate),
      },
      {
        title: t('app.kuaizhizao.reports.paymentCollectionRate'),
        dataIndex: 'payment_collection_rate',
        width: 90,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.payment_collection_rate),
      },
      {
        title: t('app.kuaizhizao.reports.releaseOrderCount'),
        dataIndex: 'release_order_count',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 90,
        hideInSearch: true,
        valueEnum: salesOrderStatusEnum(t),
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
      {
        title: t('app.kuaizhizao.reports.salesman'),
        dataIndex: 'salesman_name',
        width: 100,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.contract-execution.index-v2"
      title={t('app.kuaizhizao.menu.reports.contract-execution')}
      reportType="contract-execution"
      rowKey="id"
      columns={columns}
    />
  );
};

export default ContractExecutionReport;
