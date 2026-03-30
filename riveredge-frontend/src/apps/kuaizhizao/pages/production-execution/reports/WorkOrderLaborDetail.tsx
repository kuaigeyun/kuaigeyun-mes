import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const WorkOrderLaborDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '报工单号', dataIndex: 'report_code', width: 150 },
    { title: '人员名称', dataIndex: 'worker_name', width: 120 },
    { title: '工序名称', dataIndex: 'process_name', width: 120 },
    { title: '合格数量', dataIndex: 'qualified_qty', valueType: 'digit', width: 100 },
    { title: '报工工时', dataIndex: 'hours', valueType: 'digit', width: 100 },
    { title: '报工时期', dataIndex: 'report_date', valueType: 'date', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.work-order-labor-detail')}
      reportType="wo_labor_detail"
      columns={columns}
    />
  );
};

export default WorkOrderLaborDetail;
