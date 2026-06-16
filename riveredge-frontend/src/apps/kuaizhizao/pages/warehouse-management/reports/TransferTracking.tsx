import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const TransferTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      copyableCodeColumn(
        t('app.kuaizhizao.warehouseReports.colTransferCode'),
        'order_code',
        150,
      ),
      {
        title: t('app.kuaizhizao.warehouseReports.colFromWarehouse'),
        dataIndex: 'from_warehouse',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colToWarehouse'),
        dataIndex: 'to_warehouse',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colMaterialName'),
        dataIndex: 'material_name',
        width: 200,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colTransferQty'),
        dataIndex: 'quantity',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
      },
    ],
    [t],
  );

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
