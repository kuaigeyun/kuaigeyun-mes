/**
 * 报废不良分析
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { reportPercent } from '../../../utils/reportPresentation';

const ScrapDefectAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
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
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.occurrenceShare'),
        dataIndex: 'share',
        width: 90,
        hideInSearch: true,
        align: 'right',
        render: (_, record) => reportPercent(record.share),
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.scrap-defect-analysis')}
      reportType="scrap_analysis"
      summaryFields={['count']}
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.ScrapDefectAnalysis-v2"
      rowKey="defect_reason"
      columns={columns}
    />
  );
};

export default ScrapDefectAnalysis;
