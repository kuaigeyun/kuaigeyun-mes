import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const SupplierDeliverySummary: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseReports.colSupplier'), dataIndex: 'supplier_name', width: 200 },
      { title: t('app.kuaizhizao.purchaseReports.colDeliveryCode'), dataIndex: 'delivery_code', width: 150 },
      { title: t('app.kuaizhizao.purchaseReports.colMaterialName'), dataIndex: 'material_name', width: 200 },
      { title: t('app.kuaizhizao.purchaseReports.colOrderQty'), dataIndex: 'order_qty', valueType: 'digit', width: 100 },
      { title: t('app.kuaizhizao.purchaseReports.colActualQty'), dataIndex: 'actual_qty', valueType: 'digit', width: 100 },
      { title: t('app.kuaizhizao.purchaseReports.colOntimeRate'), dataIndex: 'ontime_rate', valueType: 'percent', width: 100 },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.SupplierDeliverySummary"
      title={t('app.kuaizhizao.menu.reports.supplier-delivery-summary')}
      reportType="supplier_delivery"
      columns={columns}
    />
  );
};

export default SupplierDeliverySummary;
