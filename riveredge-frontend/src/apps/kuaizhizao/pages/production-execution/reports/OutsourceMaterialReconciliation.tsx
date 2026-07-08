import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { copyableCodeColumn } from '../../../utils/reportCopyableColumn';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const OutsourceMaterialReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        ...copyableCodeColumn(t('app.kuaizhizao.productionExecutionReports.colIssueCode'), 'issue_code', 150),
        sorter: true,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        ...copyableCodeColumn(
          t('app.kuaizhizao.productionExecutionReports.colOutsourceWorkOrder'),
          'outsource_work_order_code',
          150,
        ),
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colMaterial'),
        dataIndex: 'material_name',
        width: 180,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colIssuedQty'),
        dataIndex: 'issued_qty',
        valueType: 'digit',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReturnedQty'),
        dataIndex: 'returned_qty',
        valueType: 'digit',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colBalanceQty'),
        dataIndex: 'balance_qty',
        valueType: 'digit',
        width: 100,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.OutsourceMaterialReconciliation"
      title={t('app.kuaizhizao.menu.reports.outsource-material-reconciliation')}
      reportType="outsource_recon"
      rowKey="issue_code"
      columns={columns}
    />
  );
};

export default OutsourceMaterialReconciliation;
