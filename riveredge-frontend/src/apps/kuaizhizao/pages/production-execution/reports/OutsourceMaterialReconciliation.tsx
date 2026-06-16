import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const OutsourceMaterialReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colIssueCode'),
        dataIndex: 'issue_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOutsourceWorkOrder'),
        dataIndex: 'outsource_work_order_code',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colMaterial'),
        dataIndex: 'material_name',
        width: 180,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colIssuedQty'),
        dataIndex: 'issued_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReturnedQty'),
        dataIndex: 'returned_qty',
        valueType: 'digit',
        width: 100,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colBalanceQty'),
        dataIndex: 'balance_qty',
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
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.OutsourceMaterialReconciliation"
      title={t('app.kuaizhizao.menu.reports.outsource-material-reconciliation')}
      reportType="outsource_recon"
      columns={columns}
    />
  );
};

export default OutsourceMaterialReconciliation;
