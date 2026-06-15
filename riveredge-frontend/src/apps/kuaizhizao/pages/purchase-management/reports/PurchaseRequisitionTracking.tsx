import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const PurchaseRequisitionTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '申购单号', dataIndex: 'requisition_code', width: 150 },
    { title: '物料名称', dataIndex: 'material_name', width: 200 },
    { title: '申购数量', dataIndex: 'quantity', valueType: 'digit', width: 100 },
    { title: '需求日期', dataIndex: 'requirement_date', valueType: 'date', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

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
