import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const QualityRateTrend: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '月份', dataIndex: 'month', valueType: 'dateMonth', width: 120 },
    { title: 'IQC合格率', dataIndex: 'iqc_rate', valueType: 'percent', width: 120 },
    { title: 'IPQC合格率', dataIndex: 'ipqc_rate', valueType: 'percent', width: 120 },
    { title: 'FQC合格率', dataIndex: 'fqc_rate', valueType: 'percent', width: 120 },
    { title: '综合合格率', dataIndex: 'overall_rate', valueType: 'percent', width: 120, sorter: true },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.quality-rate-trend')}
      reportType="quality_rate_trend"
      columnPersistenceId="kuaizhizao-qm-report-quality-rate-trend"
      columns={columns}
    />
  );
};

export default QualityRateTrend;
