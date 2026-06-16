import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const PurchaseOrderProgress: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseReports.colOrderCode'), dataIndex: 'order_code', width: 150 },
      { title: t('app.kuaizhizao.purchaseReports.colMaterialName'), dataIndex: 'material_name', width: 200 },
      { title: t('app.kuaizhizao.purchaseReports.colOrderQty'), dataIndex: 'order_qty', valueType: 'digit', width: 100 },
      { title: t('app.kuaizhizao.purchaseReports.colReceiptQty'), dataIndex: 'receipt_qty', valueType: 'digit', width: 100 },
      { title: t('app.kuaizhizao.purchaseReports.colPendingQty'), dataIndex: 'pending_qty', valueType: 'digit', width: 100 },
      { title: t('app.kuaizhizao.purchaseReports.colProgress'), dataIndex: 'progress', valueType: 'percent', width: 100 },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.PurchaseOrderProgress"
      title={t('app.kuaizhizao.menu.reports.purchase-order-progress')}
      reportType="po_progress"
      columns={columns}
    />
  );
};

export default PurchaseOrderProgress;
