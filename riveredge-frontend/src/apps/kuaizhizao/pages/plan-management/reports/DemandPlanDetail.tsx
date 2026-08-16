/**
 * 需求计划明细：一行一物料
 */
import React, { useMemo } from 'react';
import { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../components/KuaizhizaoReport';
import {
  demandTypeEnum,
  reportDemandTypeText,
  reportDocumentStatusText,
  salesOrderStatusEnum,
} from '../../../utils/reportPresentation';

const DemandPlanDetail: React.FC = () => {
  const { t } = useTranslation();
  const columns: ProColumns[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.reports.demandCode'),
        dataIndex: 'demand_code',
        fixed: 'left',
        width: 150,
      },
      {
        title: t('app.kuaizhizao.reports.demandType'),
        dataIndex: 'demand_type',
        width: 110,
        valueEnum: demandTypeEnum(t),
        render: (_, record) => reportDemandTypeText(t, record.demand_type),
      },
      {
        title: t('app.kuaizhizao.planReports.colRequirementDate'),
        dataIndex: 'requirement_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.customerCode'),
        dataIndex: 'customer_code',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.reports.customerName'),
        dataIndex: 'customer_name',
        ellipsis: true,
        width: 150,
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
        dataIndex: 'material_unit',
        width: 80,
        minWidth: 80,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.planReports.colRequirementQty'),
        dataIndex: 'quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.deliveredQuantity'),
        dataIndex: 'delivered_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.remainingQuantity'),
        dataIndex: 'remaining_quantity',
        valueType: 'digit',
        width: 100,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.reports.documentStatus'),
        dataIndex: 'status',
        width: 100,
        valueEnum: salesOrderStatusEnum(t),
        render: (_, record) => reportDocumentStatusText(t, record.status),
      },
      {
        title: t('app.kuaizhizao.reports.salesman'),
        dataIndex: 'salesman_name',
        width: 100,
        hideInSearch: true,
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
      title={t('app.kuaizhizao.menu.reports.demand-plan-detail')}
      reportType="demand_detail"
      summaryFields={['quantity', 'delivered_quantity', 'remaining_quantity']}
      columnPersistenceId="apps.kuaizhizao.pages.plan-management.reports.DemandPlanDetail-v2"
      rowKey="id"
      columns={columns}
    />
  );
};

export default DemandPlanDetail;
