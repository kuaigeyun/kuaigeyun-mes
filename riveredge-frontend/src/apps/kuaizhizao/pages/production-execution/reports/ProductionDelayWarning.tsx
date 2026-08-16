/**
 * 生产延期预警
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  productionDelayStatusEnum,
  reportDocumentStatusText,
  reportOverdueText,
} from '../../../utils/reportPresentation';

const ProductionDelayWarning: React.FC = () => {
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
        title: t('app.kuaizhizao.productionExecutionReports.colProductCode'),
        dataIndex: 'product_code',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductName'),
        dataIndex: 'material_name',
        ellipsis: true,
        width: 160,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colPlanQty'),
        dataIndex: 'plan_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colQualifiedQty'),
        dataIndex: 'completed_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colPlannedEndDate'),
        dataIndex: 'planned_end_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.overdue'),
        dataIndex: 'is_overdue',
        width: 120,
        hideInSearch: true,
        render: (_, record) =>
          reportOverdueText(t, Boolean(record.is_overdue), record.overdue_days),
      },
      {
        title: t('app.kuaizhizao.reports.documentStatus'),
        dataIndex: 'status',
        width: 100,
        valueEnum: productionDelayStatusEnum(t),
        search: { order: 40 } as ProColumns['search'],
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.production-delay-warning')}
      reportType="production-delay-warning"
      summaryFields={['plan_qty', 'completed_qty']}
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.ProductionDelayWarning-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default ProductionDelayWarning;
