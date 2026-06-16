import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const OutsourceOrderQuery: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOutsourceOrderCode'),
        dataIndex: 'order_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colSupplier'),
        dataIndex: 'supplier_name',
        width: 200,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductName'),
        dataIndex: 'product_name',
        width: 200,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOutsourceQty'),
        dataIndex: 'order_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOrderDate'),
        dataIndex: 'order_date',
        valueType: 'date',
        width: 120,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.OutsourceOrderQuery"
      title={t('app.kuaizhizao.menu.reports.outsource-order-query')}
      reportType="outsource_query"
      columns={columns}
    />
  );
};

export default OutsourceOrderQuery;
