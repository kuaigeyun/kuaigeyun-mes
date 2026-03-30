import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const ReworkOrderAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '返工单号', dataIndex: 'order_code', width: 150 },
    { title: '原工单号', dataIndex: 'parent_code', width: 150 },
    { title: '返工数量', dataIndex: 'rework_qty', valueType: 'digit', width: 100 },
    { title: '返工原因', dataIndex: 'reason', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.rework-order-analysis')}
      reportType="rework_analysis"
      columns={columns}
    />
  );
};

export default ReworkOrderAnalysis;
