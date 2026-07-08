import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const WorkOrderMaterialUsage: React.FC = () => {
  const { t } = useTranslation();
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
        ...copyableCodeColumn(t('app.kuaizhizao.productionExecutionReports.colWorkOrderCode'), 'order_code', 150),
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colSubMaterial'),
        dataIndex: 'material_name',
        width: 200,
        ellipsis: true,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colActualIssueQty'),
        dataIndex: 'actual_qty',
        valueType: 'digit',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOrderDate'),
        dataIndex: 'created_at',
        valueType: 'dateTime',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderMaterialUsage"
      title={t('app.kuaizhizao.menu.reports.work-order-material-usage')}
      reportType="wo_material_usage"
      dateRangeKeys={['date_range', 'dateRange']}
      rowKey="order_code"
      columns={columns}
    />
  );
};

export default WorkOrderMaterialUsage;
