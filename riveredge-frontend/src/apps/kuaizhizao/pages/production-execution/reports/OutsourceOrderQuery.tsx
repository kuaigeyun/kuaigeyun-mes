import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { buildOutsourceWorkOrderLifecycleValueEnum } from '../../../utils/outsourceWorkOrderLifecycle';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const OutsourceOrderQuery: React.FC = () => {
  const { t } = useTranslation();
  const statusValueEnum = useMemo(() => buildOutsourceWorkOrderLifecycleValueEnum(t), [t]);
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.statPeriod'),
        dataIndex: 'date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        ...copyableCodeColumn(
          t('app.kuaizhizao.productionExecutionReports.colOutsourceOrderCode'),
          'order_code',
          150,
        ),
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colSupplier'),
        dataIndex: 'supplier_name',
        width: 200,
        ellipsis: true,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductName'),
        dataIndex: 'product_name',
        width: 200,
        ellipsis: true,
        sorter: true,
        search: { order: 40 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOutsourceQty'),
        dataIndex: 'order_qty',
        valueType: 'digit',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        valueType: 'select',
        valueEnum: statusValueEnum,
        sorter: true,
        search: { order: 50 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOrderDate'),
        dataIndex: 'order_date',
        valueType: 'dateTime',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
      },
    ],
    [t, statusValueEnum],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.OutsourceOrderQuery"
      title={t('app.kuaizhizao.menu.reports.outsource-order-query')}
      reportType="outsource_query"
      dateRangeKeys={['date_range', 'dateRange']}
      rowKey="order_code"
      columns={columns}
    />
  );
};

export default OutsourceOrderQuery;
