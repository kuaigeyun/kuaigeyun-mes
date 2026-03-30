import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const WorkOrderQuery: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '工单单号', dataIndex: 'order_code', width: 150 },
    { title: '产品名称', dataIndex: 'product_name', width: 200 },
    { title: '计划数量', dataIndex: 'plan_qty', valueType: 'digit', width: 100 },
    { title: '工单状态', dataIndex: 'status', width: 100 },
    { title: '下单日期', dataIndex: 'created_at', valueType: 'date', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.work-order-query')}
      reportType="wo_query"
      columns={columns}
    />
  );
};

export default WorkOrderQuery;
