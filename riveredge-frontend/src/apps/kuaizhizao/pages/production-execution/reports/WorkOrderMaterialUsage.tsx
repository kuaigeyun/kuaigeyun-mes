import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const WorkOrderMaterialUsage: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkOrderCode'),
        dataIndex: 'order_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colSubMaterial'),
        dataIndex: 'material_name',
        width: 200,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colPlannedIssueQty'),
        dataIndex: 'planned_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colActualIssueQty'),
        dataIndex: 'actual_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colExcessIssueQty'),
        dataIndex: 'excess_qty',
        valueType: 'digit',
        width: 100,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderMaterialUsage"
      title={t('app.kuaizhizao.menu.reports.work-order-material-usage')}
      reportType="wo_material_usage"
      columns={columns}
    />
  );
};

export default WorkOrderMaterialUsage;
