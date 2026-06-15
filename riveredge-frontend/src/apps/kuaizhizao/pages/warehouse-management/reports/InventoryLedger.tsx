import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const InventoryLedger: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '发生日期', dataIndex: 'event_date', valueType: 'dateTime', width: 180 },
    copyableCodeColumn('单号', 'order_code', 150),
    { title: '类型', dataIndex: 'type', width: 100 },
    { title: '数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
    { title: '结存数量', dataIndex: 'balance_qty', valueType: 'digit', width: 100 },
    { title: '操作人', dataIndex: 'operator', width: 100 },
  ];

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
