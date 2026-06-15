import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const ScrapDefectAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '报废/缺陷原因', dataIndex: 'defect_reason', ellipsis: true, width: 240 },
    { title: '发生次数', dataIndex: 'count', valueType: 'digit', width: 120, sorter: true },
  ];

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.ScrapDefectAnalysis"
      title={t('app.kuaizhizao.menu.reports.scrap-defect-analysis')}
      reportType="scrap_analysis"
      columns={columns}
    />
  );
};

export default ScrapDefectAnalysis;
