import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const InventorySummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseReports.colMaterialCode'),
        dataIndex: 'material_code',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        width: 180,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
        dataIndex: 'warehouse_name',
        ellipsis: true,
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colOpeningQty'),
        dataIndex: 'opening_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colInboundQty'),
        dataIndex: 'inbound_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colOutboundQty'),
        dataIndex: 'outbound_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colClosingQty'),
        dataIndex: 'closing_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.inventory-summary')}
      reportType="inventory_summary"
      templateId="inventoryLedger"
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.InventorySummary-v3"
      columns={columns}
      summaryFields={['opening_qty', 'inbound_qty', 'outbound_qty', 'closing_qty']}
    />
  );
};

export default InventorySummary;
