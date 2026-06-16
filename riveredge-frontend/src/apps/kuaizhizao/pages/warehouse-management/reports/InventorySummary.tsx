import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const InventorySummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      copyableCodeColumn(
        t('app.kuaizhizao.warehouseReports.colMaterialCode'),
        'material_code',
        120,
      ),
      {
        title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
        dataIndex: 'material_name',
        width: 200,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
        dataIndex: 'warehouse_name',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colOpeningQty'),
        dataIndex: 'opening_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colInboundQty'),
        dataIndex: 'inbound_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colOutboundQty'),
        dataIndex: 'outbound_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colClosingQty'),
        dataIndex: 'closing_qty',
        valueType: 'digit',
        width: 100,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.inventory-summary')}
      reportType="inventory_summary"
      templateId="inventoryLedger"
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.InventorySummary"
      columns={columns}
    />
  );
};

export default InventorySummary;
