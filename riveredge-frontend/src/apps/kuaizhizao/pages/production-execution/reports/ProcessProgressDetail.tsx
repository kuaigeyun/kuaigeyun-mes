import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const ProcessProgressDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '工单号', dataIndex: 'order_code', width: 150 },
    { title: '工序', dataIndex: 'process_name', width: 120 },
    { title: '待加工', dataIndex: 'pending_qty', valueType: 'digit', width: 100 },
    { title: '加工中', dataIndex: 'ongoing_qty', valueType: 'digit', width: 100 },
    { title: '已完工', dataIndex: 'completed_qty', valueType: 'digit', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.process-progress-detail')}
      reportType="process_progress"
      columns={columns}
    />
  );
};

export default ProcessProgressDetail;
