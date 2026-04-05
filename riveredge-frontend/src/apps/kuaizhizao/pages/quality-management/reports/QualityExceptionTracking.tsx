import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const QualityExceptionTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '异常单号', dataIndex: 'exception_code', width: 150 },
    { title: '发现日期', dataIndex: 'discovery_date', valueType: 'date', width: 120 },
    { title: '异常类型', dataIndex: 'type', width: 120 },
    { title: '原因分析', dataIndex: 'reason', ellipsis: true },
    { title: '当前状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.quality-exception-tracking')}
      reportType="quality_exception"
      columnPersistenceId="kuaizhizao-qm-report-quality-exception-tracking"
      columns={columns}
    />
  );
};

export default QualityExceptionTracking;
