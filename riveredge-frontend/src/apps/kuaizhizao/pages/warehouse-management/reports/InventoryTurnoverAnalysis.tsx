import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import ReportBase from '../../../components/ReportBase';
import { getWarehouseReport } from '../../../services/reports';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';

const InventoryTurnoverAnalysis: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '仓库名称', dataIndex: 'warehouse_name', width: 150 },
    copyableCodeColumn('物料编码', 'material_code', 120),
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    copyableCodeColumn('批次号', 'batch_no', 150),
    { title: '数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.inventory-turnover-analysis')}
      reportType="turnover"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.InventoryTurnoverAnalysis"
      request={async (params: any) => {
        const res = await getWarehouseReport({
          ...params,
          report_type: 'turnover',
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

export default InventoryTurnoverAnalysis;
