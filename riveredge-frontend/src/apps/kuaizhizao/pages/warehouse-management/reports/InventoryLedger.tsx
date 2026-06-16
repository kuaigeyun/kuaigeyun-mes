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
        width: 180,
      },
      copyableCodeColumn(t('app.kuaizhizao.warehouseReports.colOrderCode'), 'order_code', 150),
      {
        title: t('app.kuaizhizao.warehouseReports.colType'),
        dataIndex: 'type',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colQuantity'),
        dataIndex: 'quantity',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colBalanceQty'),
        dataIndex: 'balance_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colOperator'),
        dataIndex: 'operator',
        width: 100,
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
