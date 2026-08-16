/**
 * 物料耗用明细：已领料生产领料一行一物料
 */
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
        fixed: 'left',
        width: 150,
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.reports.pickingCode'),
        dataIndex: 'picking_code',
        width: 150,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.materialCode'),
        dataIndex: 'material_code',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.materialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        width: 160,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
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
        dataIndex: 'unit',
        width: 80,
        minWidth: 80,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colActualIssueQty'),
        dataIndex: 'actual_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.warehouse'),
        dataIndex: 'warehouse_name',
        ellipsis: true,
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.picker'),
        dataIndex: 'picker_name',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.pickingDate'),
        dataIndex: 'picking_time',
        valueType: 'dateTime',
        width: 160,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.work-order-material-usage')}
      reportType="wo_material_usage"
      summaryFields={['actual_qty']}
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.WorkOrderMaterialUsage-v3"
      rowKey="id"
      columns={columns}
    />
  );
};

export default WorkOrderMaterialUsage;
