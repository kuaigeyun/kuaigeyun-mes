import React, { useMemo, useState } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

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
        title: t('app.kuaizhizao.reports.statPeriod'),
        dataIndex: 'date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
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
        dataIndex: 'count',
        valueType: 'digit',
        width: 120,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colFirstPassYieldRate'),
        dataIndex: 'first_pass_yield_rate',
        valueType: 'percent',
        width: 140,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colQualificationRate'),
        dataIndex: 'qualification_rate',
        valueType: 'percent',
        width: 140,
        sorter: true,
        hideInSearch: true,
      },
    ],
    [t],
  );

  const workOrderColumns: ProColumns[] = useMemo(
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
        valueType: 'percent',
        width: 140,
        sorter: true,
        hideInSearch: true,
      },
    ],
    [t],
  );

  const rtyColumns: ProColumns[] = useMemo(
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
        title: t('app.kuaizhizao.productionExecutionReports.colRty'),
        dataIndex: 'roll_through_yield_rate',
        valueType: 'percent',
        width: 160,
        sorter: true,
        hideInSearch: true,
      },
    ],
    [t],
  );

  const columns =
    view === 'work_order' ? workOrderColumns : view === 'rty' ? rtyColumns : operationColumns;
  const rowKey =
    view === 'work_order' ? 'work_order_code' : view === 'rty' ? 'product_code' : 'operation_name';

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
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.FirstPassYieldAnalysis"
      title={t('app.kuaizhizao.menu.reports.first-pass-yield')}
      reportType={reportType}
      dateRangeKeys={['date_range', 'dateRange']}
      rowKey={rowKey}
      columns={columns}
      statCards={statCards}
    >
      <Segmented
        style={{ marginBottom: 12 }}
        value={view}
        onChange={(value) => setView(value as ReportView)}
        options={[
          { label: t('app.kuaizhizao.productionExecutionReports.tabOperationFpy'), value: 'operation' },
          { label: t('app.kuaizhizao.productionExecutionReports.tabWorkOrderFpy'), value: 'work_order' },
          { label: t('app.kuaizhizao.productionExecutionReports.tabProductRty'), value: 'rty' },
        ]}
      />
    </KuaizhizaoReport>
  );
};

export default FirstPassYieldAnalysis;
