import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';

const OutboundSummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    copyableCodeColumn('出库单号', 'order_code', 150),
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '出库类型', dataIndex: 'type', width: 100 },
    { title: '出库数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
    { title: '出库日期', dataIndex: 'outbound_date', valueType: 'date', width: 120 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.outbound-summary')}
      reportType="outbound_summary"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.OutboundSummary"
    />
  );
};

export default OutboundSummary;
