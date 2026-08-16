import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import { reportDocumentStatusText } from '../../../utils/reportPresentation';

const TransferTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseReports.colTransferCode'),
        dataIndex: 'order_code',
        width: 150,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colTransferDate'),
        dataIndex: 'transfer_date',
        valueType: 'date',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colFromWarehouse'),
        dataIndex: 'from_warehouse',
        ellipsis: true,
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colToWarehouse'),
        dataIndex: 'to_warehouse',
        ellipsis: true,
        width: 140,
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
        ellipsis: true,
        width: 160,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colTransferQty'),
        dataIndex: 'quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        hideInSearch: true,
        render: (_, row) => reportDocumentStatusText(t, row.status),
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.transfer-tracking')}
      reportType="transfer_tracking"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.TransferTracking-v2"
      rowKey="id"
      summaryFields={['quantity']}
    />
  );
};

export default TransferTracking;
