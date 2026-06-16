import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const PurchaseRequisitionTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseReports.colRequisitionCode'), dataIndex: 'requisition_code', width: 150 },
      { title: t('app.kuaizhizao.purchaseReports.colMaterialName'), dataIndex: 'material_name', width: 200 },
      { title: t('app.kuaizhizao.purchaseReports.colRequisitionQty'), dataIndex: 'quantity', valueType: 'digit', width: 100 },
      { title: t('app.kuaizhizao.purchaseReports.colRequirementDate'), dataIndex: 'requirement_date', valueType: 'date', width: 120 },
      { title: t('common.status'), dataIndex: 'status', width: 100 },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.PurchaseRequisitionTracking"
      title={t('app.kuaizhizao.menu.reports.purchase-requisition-tracking')}
      reportType="requisition_tracking"
      columns={columns}
    />
  );
};

export default PurchaseRequisitionTracking;
