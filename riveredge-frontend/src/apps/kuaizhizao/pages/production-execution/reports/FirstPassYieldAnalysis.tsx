import React, { useMemo, useState } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { ThemedSegmented } from '../../../../../components/themed-segmented/ThemedSegmented';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { reportPercent } from '../../../utils/reportPresentation';

type ReportView = 'operation' | 'work_order' | 'rty';

const FirstPassYieldAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<ReportView>('operation');

  const reportType =
    view === 'work_order'
      ? 'first_pass_yield_work_order'
      : view === 'rty'
        ? 'first_pass_yield_rty'
        : 'first_pass_yield';

  const operationColumns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOperationName'),
        dataIndex: 'operation_name',
        ellipsis: true,
        width: 200,
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReportCount'),
        dataIndex: 'reported_quantity',
        valueType: 'digit',
        width: 100,
        sorter: true,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colQualifiedCount'),
        dataIndex: 'qualified_quantity',
        valueType: 'digit',
        width: 100,
        sorter: true,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colUnqualifiedCount'),
        dataIndex: 'unqualified_quantity',
        valueType: 'digit',
        width: 110,
        sorter: true,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colFirstPassYieldRate'),
        dataIndex: 'first_pass_yield_rate',
        width: 110,
        sorter: true,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.first_pass_yield_rate),
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colQualificationRate'),
        dataIndex: 'qualification_rate',
        width: 110,
        sorter: true,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.qualification_rate),
      },
    ],
    [t],
  );

  const workOrderColumns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkOrderCode'),
        dataIndex: 'work_order_code',
        width: 160,
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductName'),
        dataIndex: 'product_name',
        ellipsis: true,
        width: 200,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReportCount'),
        dataIndex: 'reported_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colQualifiedCount'),
        dataIndex: 'qualified_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colUnqualifiedCount'),
        dataIndex: 'unqualified_quantity',
        valueType: 'digit',
        width: 110,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colHasRework'),
        dataIndex: 'has_rework',
        width: 120,
        hideInSearch: true,
        render: (_, record) =>
          record.has_rework
            ? t('app.kuaizhizao.productionExecutionReports.hasReworkYes')
            : t('app.kuaizhizao.productionExecutionReports.hasReworkNo'),
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colWorkOrderFpy'),
        dataIndex: 'work_order_first_pass_yield_rate',
        width: 120,
        sorter: true,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.work_order_first_pass_yield_rate),
      },
    ],
    [t],
  );

  const rtyColumns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductCode'),
        dataIndex: 'product_code',
        width: 160,
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colProductName'),
        dataIndex: 'product_name',
        ellipsis: true,
        width: 200,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOperationCount'),
        dataIndex: 'operation_count',
        valueType: 'digit',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReportCount'),
        dataIndex: 'reported_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colQualifiedCount'),
        dataIndex: 'qualified_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colUnqualifiedCount'),
        dataIndex: 'unqualified_quantity',
        valueType: 'digit',
        width: 110,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colRty'),
        dataIndex: 'roll_through_yield_rate',
        width: 140,
        sorter: true,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.roll_through_yield_rate),
      },
    ],
    [t],
  );

  const columns =
    view === 'work_order' ? workOrderColumns : view === 'rty' ? rtyColumns : operationColumns;
  const rowKey = view === 'work_order' ? 'id' : view === 'rty' ? 'product_code' : 'operation_name';

  const statCards = useMemo(
    () => (summary: Record<string, number>) =>
      view === 'operation'
        ? [
            {
              title: t('app.kuaizhizao.workReporting.statistics.statFirstPassYieldRate'),
              value: `${summary.first_pass_yield_rate ?? 0}%`,
            },
            {
              title: t('app.kuaizhizao.workReporting.statistics.statQualificationRate'),
              value: `${summary.qualification_rate ?? 0}%`,
            },
          ]
        : [],
    [t, view],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.FirstPassYieldAnalysis-v4"
      title={t('app.kuaizhizao.menu.reports.first-pass-yield')}
      reportType={reportType}
      rowKey={rowKey}
      columns={columns}
      summaryFields={['reported_quantity', 'qualified_quantity', 'unqualified_quantity']}
      statCards={statCards}
      beforeSearchButtons={
        <ThemedSegmented
          surfaceBackground
          size="small"
          value={view}
          onChange={(value) => setView(value as ReportView)}
          options={[
            { label: t('app.kuaizhizao.productionExecutionReports.tabOperationFpy'), value: 'operation' },
            { label: t('app.kuaizhizao.productionExecutionReports.tabWorkOrderFpy'), value: 'work_order' },
            { label: t('app.kuaizhizao.productionExecutionReports.tabProductRty'), value: 'rty' },
          ]}
        />
      }
    />
  );
};

export default FirstPassYieldAnalysis;
