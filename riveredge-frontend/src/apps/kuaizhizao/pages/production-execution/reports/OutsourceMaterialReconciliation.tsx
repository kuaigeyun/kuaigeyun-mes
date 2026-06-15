import React from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const OutsourceMaterialReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = [
    { title: '发料单号', dataIndex: 'issue_code', width: 150 },
    { title: '委外工单', dataIndex: 'outsource_work_order_code', width: 150 },
    { title: '物料', dataIndex: 'material_name', width: 180 },
    { title: '发料数量', dataIndex: 'issued_qty', valueType: 'digit', width: 100 },
    { title: '退料数量', dataIndex: 'returned_qty', valueType: 'digit', width: 100 },
    { title: '在外数量', dataIndex: 'balance_qty', valueType: 'digit', width: 100 },
    { title: '状态', dataIndex: 'status', width: 100 },
  ];

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.OutsourceMaterialReconciliation"
      title={t('app.kuaizhizao.menu.reports.outsource-material-reconciliation')}
      reportType="outsource_recon"
      columns={columns}
    />
  );
};

export default OutsourceMaterialReconciliation;
