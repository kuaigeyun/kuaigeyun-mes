import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const InventoryLedger: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseReports.keyword'),
        dataIndex: 'keyword',
        hideInTable: true,
        fieldProps: {
          placeholder: t('app.kuaizhizao.warehouseReports.keywordPlaceholder'),
        },
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colEventDate'),
        dataIndex: 'event_date',
        valueType: 'dateTime',
        width: 160,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colMaterialCode'),
        dataIndex: 'material_code',
        width: 120,
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
        title: t('app.kuaizhizao.warehouseReports.colOrderCode'),
        dataIndex: 'order_code',
        width: 150,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colType'),
        dataIndex: 'type',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('common.quantity'),
        dataIndex: 'quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colBalanceQty'),
        dataIndex: 'balance_qty',
        valueType: 'digit',
        width: 110,
        hideInSearch: true,
        align: 'right',
        tooltip: t('app.kuaizhizao.warehouseReports.balanceQtyTip'),
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colOperator'),
        dataIndex: 'operator',
        width: 100,
        hideInSearch: true,
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
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.InventoryLedger-v2"
    />
  );
};

export default InventoryLedger;
