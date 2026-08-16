/**
 * 采购申请跟踪：一行一物料
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  purchaseRequisitionStatusEnum,
  reportDocumentStatusText,
} from '../../../utils/reportPresentation';

const PurchaseRequisitionTracking: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseReports.colRequisitionCode'),
        dataIndex: 'requisition_code',
        fixed: 'left',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.requisitionDate'),
        dataIndex: 'requisition_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.applicant'),
        dataIndex: 'applicant_name',
        width: 100,
        hideInSearch: true,
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
      },
      {
        title: t('app.kuaizhizao.reports.materialSpec'),
        dataIndex: 'material_spec',
        ellipsis: true,
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.unit'),
        dataIndex: 'unit',
        width: 80,
        minWidth: 80,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colRequisitionQty'),
        dataIndex: 'quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.purchaseReports.colRequirementDate'),
        dataIndex: 'required_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.convertedOrderCode'),
        dataIndex: 'purchase_order_code',
        width: 150,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.documentStatus'),
        dataIndex: 'status',
        width: 110,
        valueEnum: purchaseRequisitionStatusEnum(t),
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
      {
        title: t('app.kuaizhizao.reports.notes'),
        dataIndex: 'notes',
        ellipsis: true,
        width: 140,
        hideInSearch: true,
      },
    ],
    [t],
  );

  return (
    <KuaizhizaoReport
      title={t('app.kuaizhizao.menu.reports.purchase-requisition-tracking')}
      reportType="requisition_tracking"
      summaryFields={['quantity']}
      columnPersistenceId="apps.kuaizhizao.pages.purchase-management.reports.PurchaseRequisitionTracking-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default PurchaseRequisitionTracking;
