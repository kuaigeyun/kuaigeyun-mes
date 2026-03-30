import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import ReportBase from '../../../components/ReportBase';
import { useTranslation } from 'react-i18next';

const InventorySummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '物料编码', dataIndex: 'material_code', width: 120 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '仓库', dataIndex: 'warehouse_name', width: 150 },
    { title: '期初数量', dataIndex: 'opening_qty', valueType: 'digit', width: 100 },
    { title: '本期入库', dataIndex: 'inbound_qty', valueType: 'digit', width: 100 },
    { title: '本期出库', dataIndex: 'outbound_qty', valueType: 'digit', width: 100 },
    { title: '期末数量', dataIndex: 'closing_qty', valueType: 'digit', width: 100 },
  ];

  return (
    <ReportBase
      title={t('app.kuaizhizao.menu.reports.inventory-summary')}
      reportType="inventory_summary"
      columns={columns}
    />
  );
};

export default InventorySummary;
