import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const TransferTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    copyableCodeColumn('调拨单号', 'order_code', 150),
    { title: '调出仓库', dataIndex: 'from_warehouse', width: 150 },
    { title: '调入仓库', dataIndex: 'to_warehouse', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '调拨数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.transfer-tracking')}
      reportType="transfer_tracking"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.TransferTracking"
    />
  );
};

export default TransferTracking;
