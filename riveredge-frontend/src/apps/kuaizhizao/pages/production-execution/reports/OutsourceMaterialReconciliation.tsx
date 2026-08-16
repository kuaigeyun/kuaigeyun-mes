/**
 * 委外发料对账
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  outsourceMaterialIssueStatusEnum,
  reportDocumentStatusText,
} from '../../../utils/reportPresentation';

const OutsourceMaterialReconciliation: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionReports.colIssueCode'),
        dataIndex: 'issue_code',
        fixed: 'left',
        width: 150,
        sorter: true,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colOutsourceWorkOrder'),
        dataIndex: 'outsource_work_order_code',
        width: 150,
        sorter: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.reports.materialCode'),
        dataIndex: 'material_code',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.reports.materialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        width: 160,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colIssuedQty'),
        dataIndex: 'issued_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colReturnedQty'),
        dataIndex: 'returned_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.productionExecutionReports.colBalanceQty'),
        dataIndex: 'balance_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.documentStatus'),
        dataIndex: 'status',
        width: 100,
        valueEnum: outsourceMaterialIssueStatusEnum(t),
        search: { order: 30 } as ProColumns['search'],
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.outsource-material-reconciliation')}
      reportType="outsource_recon"
      summaryFields={['issued_qty', 'returned_qty', 'balance_qty']}
      columnPersistenceId="apps.kuaizhizao.pages.production-execution.reports.OutsourceMaterialReconciliation-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default OutsourceMaterialReconciliation;
