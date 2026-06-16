import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const PurchaseOrderQuery: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseReports.colOrderCode'), dataIndex: 'order_code', width: 150 },
      { title: t('app.kuaizhizao.purchaseReports.colSupplier'), dataIndex: 'supplier_name', width: 200 },
      { title: t('app.kuaizhizao.purchaseReports.colOrderDate'), dataIndex: 'order_date', valueType: 'date', width: 120 },
      { title: t('app.kuaizhizao.purchaseReports.colTotalAmount'), dataIndex: 'total_amount', valueType: 'money', width: 120 },
      { title: t('app.kuaizhizao.purchaseReports.colBuyer'), dataIndex: 'buyer_name', width: 100 },
      { title: t('common.status'), dataIndex: 'status', width: 100 },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.PurchaseOrderQuery"
      title={t('app.kuaizhizao.menu.reports.purchase-order-query')}
      reportType="po_query"
      columns={columns}
    />
  );
};

export default PurchaseOrderQuery;
