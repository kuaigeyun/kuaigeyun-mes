import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const WorkOrderQuery: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkOrderCode'),
        dataIndex: 'order_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductName'),
        dataIndex: 'product_name',
        width: 200,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colPlanQty'),
        dataIndex: 'plan_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkOrderStatus'),
        dataIndex: 'status',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOrderDate'),
        dataIndex: 'created_at',
        valueType: 'date',
        width: 120,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderQuery"
      title={t('app.kuaizhizao.menu.reports.work-order-query')}
      reportType="wo_query"
      columns={columns}
    />
  );
};

export default WorkOrderQuery;
