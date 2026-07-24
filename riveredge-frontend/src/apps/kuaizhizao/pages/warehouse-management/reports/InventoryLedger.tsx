import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const InventoryLedger: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseReports.colEventDate'),
        dataIndex: 'event_date',
        valueType: 'dateTime',
        width: 160,
        hideInSearch: true,
      },
      {
        ...copyableCodeColumn(t('app.kuaizhizao.warehouseReports.colMaterialCode'), 'material_code', 120),
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
        dataIndex: 'material_name',
        width: 160,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colWarehouse'),
        dataIndex: 'warehouse_name',
        width: 120,
        ellipsis: true,
        hideInSearch: true,
      },
      {
        ...copyableCodeColumn(t('app.kuaizhizao.warehouseReports.colOrderCode'), 'order_code', 150),
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colType'),
        dataIndex: 'type',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colQuantity'),
        dataIndex: 'quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colBalanceQty'),
        dataIndex: 'balance_qty',
        valueType: 'digit',
        width: 110,
        hideInSearch: true,
        tooltip: t('app.kuaizhizao.warehouseReports.balanceQtyTip'),
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colOperator'),
        dataIndex: 'operator',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.keyword'),
        dataIndex: 'keyword',
        hideInTable: true,
        fieldProps: {
          placeholder: t('app.kuaizhizao.warehouseReports.keywordPlaceholder'),
        },
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.inventory-ledger')}
      reportType="inventory_ledger"
      templateId="inventoryLedger"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.InventoryLedger"
    />
  );
};

export default InventoryLedger;
