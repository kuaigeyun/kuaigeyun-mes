import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { QUALITY_REPORT_TYPES } from '../../../constants/qualityReportTypes';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const ProcessInspectionReport: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '检验单号', dataIndex: 'inspection_code', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '工单号', dataIndex: 'work_order_code', width: 150 },
    { title: '检验日期', dataIndex: 'inspection_date', valueType: 'date', width: 120 },
    { title: '抽检数量', dataIndex: 'sample_qty', valueType: 'digit', width: 100 },
    { title: '合格数量', dataIndex: 'qualified_qty', valueType: 'digit', width: 100 },
    { title: '合格率(%)', dataIndex: 'pass_rate', valueType: 'digit', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.process-inspection-report')}
      reportType={QUALITY_REPORT_TYPES.PROCESS_PASS_RATE}
      columnPersistenceId="apps.kuaizhizao.pages.quality-management.reports.ProcessInspectionReport"
      columns={columns}
      summaryFields={['avg_pass_rate']}
    />
  );
};

export default ProcessInspectionReport;
