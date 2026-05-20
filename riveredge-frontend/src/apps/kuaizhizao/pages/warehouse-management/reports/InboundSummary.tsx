import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getWarehouseReport } from '../../../services/reports';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';

const InboundSummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    copyableCodeColumn('业务单号', 'move_code', 150),
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '异动类型', dataIndex: 'move_type', width: 120 },
    { title: '异动数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
    { title: '异动时间', dataIndex: 'created_at', valueType: 'dateTime', width: 180 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.inbound-summary')}
      reportType="inbound_outbound"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.InboundSummary"
      request={async (params: any) => {
        const res = await getWarehouseReport({
          ...params,
          report_type: 'inbound_outbound',
        });
        return {
          data: res.data || [],
          success: res.success,
          total: res.data?.length || 0,
        };
      }}
    />
  );
};

export default InboundSummary;
