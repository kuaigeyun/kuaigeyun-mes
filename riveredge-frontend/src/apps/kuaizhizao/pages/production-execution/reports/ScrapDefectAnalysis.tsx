import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const ScrapDefectAnalysis: React.FC = () => {
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
        title: t('app.kuaizhizao.productionExecutionReports.colDefectReason'),
        dataIndex: 'defect_reason',
        ellipsis: true,
        width: 240,
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOccurrenceCount'),
        dataIndex: 'count',
        valueType: 'digit',
        width: 120,
        sorter: true,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.ScrapDefectAnalysis"
      title={t('app.kuaizhizao.menu.reports.scrap-defect-analysis')}
      reportType="scrap_analysis"
      dateRangeKeys={['date_range', 'dateRange']}
      rowKey="defect_reason"
      columns={columns}
    />
  );
};

export default ScrapDefectAnalysis;
