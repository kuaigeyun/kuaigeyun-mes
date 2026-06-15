import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

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
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.quality-exception-tracking')}
      reportType={QUALITY_REPORT_TYPES.QUALITY_EXCEPTION}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.QualityExceptionTracking"
      columns={columns}
    />
  );
};

export default QualityExceptionTracking;
