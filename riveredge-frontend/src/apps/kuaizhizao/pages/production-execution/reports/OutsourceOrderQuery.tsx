/**
 * 委外工单查询
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  outsourceWorkOrderStatusEnum,
  reportDocumentStatusText,
} from '../../../utils/reportPresentation';

const OutsourceOrderQuery: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOutsourceOrderCode'),
        dataIndex: 'order_code',
        fixed: 'left',
        width: 150,
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colSupplier'),
        dataIndex: 'supplier_name',
        ellipsis: true,
        width: 150,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductCode'),
        dataIndex: 'product_code',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductName'),
        dataIndex: 'product_name',
        ellipsis: true,
        width: 160,
        sorter: true,
        search: { order: 40 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOutsourceQty'),
        dataIndex: 'order_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
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
        width: 100,
        valueEnum: outsourceWorkOrderStatusEnum(t),
        search: { order: 50 } as ProColumns['search'],
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colPlannedEndDate'),
        dataIndex: 'planned_end_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOrderDate'),
        dataIndex: 'order_date',
        valueType: 'dateTime',
        width: 160,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.outsource-order-query')}
      reportType="outsource_query"
      summaryFields={['order_qty', 'amount']}
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.OutsourceOrderQuery-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default OutsourceOrderQuery;
