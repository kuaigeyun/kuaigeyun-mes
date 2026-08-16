import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';

const FifoExceptionAudit: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseReports.colEventAt'),
        dataIndex: 'event_at',
        valueType: 'dateTime',
        width: 160,
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
        title: t('app.kuaizhizao.warehouseReports.colIssuedBatchNo'),
        dataIndex: 'issued_batch_no',
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colIssuedQty'),
        dataIndex: 'issued_qty',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colPreferredBatchNo'),
        dataIndex: 'preferred_batch_no',
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colPreferredQtyAtEvent'),
        dataIndex: 'preferred_batch_qty_at_event',
        valueType: 'digit',
        width: 120,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colFifoMode'),
        dataIndex: 'fifo_mode_label',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colOrderCode'),
        dataIndex: 'source_doc_code',
        width: 140,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.warehouseReports.colOperator'),
        dataIndex: 'operator_name',
        width: 100,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.fifo-exception-audit')}
      reportType="fifo_exception"
      columns={columns}
      columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.reports.FifoExceptionAudit-v2"
      rowKey="id"
    />
  );
};

export default FifoExceptionAudit;
