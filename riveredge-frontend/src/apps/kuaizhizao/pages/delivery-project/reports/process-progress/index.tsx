/**
 * 项目流程进度表（一行一节点，对齐参考 ERP 流程进度表）
 */
import React, { useCallback, useMemo } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import {
  deliveryProjectApi,
  DELIVERY_NODE_STATUS,
  type DeliveryProcessProgressRow,
} from '../../../../services/delivery-project';
import { reportPercent } from '../../../../utils/reportPresentation';
import { DELIVERY_CUSTOMER_COLUMN_DEFAULTS } from '../../shared/deliveryTableColumns';
import { formatBusinessDateOnly } from '../../../../../../utils/format';

const ProcessProgressReportPage: React.FC = () => {
  const { t } = useTranslation();

  const columns: ProColumns<DeliveryProcessProgressRow>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.deliveryProject.fields.projectCode'),
        dataIndex: 'project_code',
        fixed: 'left',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.projectName'),
        dataIndex: 'project_name',
        width: 160,
        minWidth: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.nodeName'),
        dataIndex: 'node_name',
        width: 110,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.isMilestone'),
        dataIndex: 'is_milestone',
        width: 80,
        hideInSearch: true,
        render: (_, r) => (r.is_milestone ? t('common.yes') : t('common.no')),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.ownerName'),
        dataIndex: 'node_owner_name',
        width: 90,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.plannedStartDate'),
        dataIndex: 'planned_start_date',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatBusinessDateOnly(r.planned_start_date),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.plannedEndDate'),
        dataIndex: 'planned_end_date',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatBusinessDateOnly(r.planned_end_date),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.actualStartDate'),
        dataIndex: 'actual_start_date',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatBusinessDateOnly(r.actual_start_date),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.actualEndDate'),
        dataIndex: 'actual_end_date',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatBusinessDateOnly(r.actual_end_date),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.progress'),
        dataIndex: 'progress_percent',
        width: 80,
        hideInSearch: true,
        align: 'right',
        render: (_, r) => reportPercent(r.progress_percent),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.reporterName'),
        dataIndex: 'reporter_name',
        width: 90,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.report.issueCount'),
        dataIndex: 'issue_count',
        width: 80,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('common.status'),
        dataIndex: 'node_status',
        width: 90,
        hideInSearch: true,
        render: (_, r) => DELIVERY_NODE_STATUS[r.node_status] ?? r.node_status,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.customerName'),
        dataIndex: 'customer_name',
        ...DELIVERY_CUSTOMER_COLUMN_DEFAULTS,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.salesOrderCode'),
        dataIndex: 'sales_order_code',
        width: 120,
        hideInSearch: true,
      },
    ],
    [t],
  );

  const request = useCallback(
    async (params: Record<string, unknown>, _sort?: Record<string, unknown>, _filter?: Record<string, unknown>, searchFormValues?: Record<string, unknown>) => {
      const pageSize = Number(params.pageSize ?? 50);
      const skip = (Number(params.current ?? 1) - 1) * pageSize;
      const res = await deliveryProjectApi.processProgress({
        skip,
        limit: pageSize,
        keyword: (searchFormValues?.keyword ?? params.keyword) as string | undefined,
        status: (searchFormValues?.status ?? params.status) as string | undefined,
      });
      return { data: res.items, total: res.total, success: true };
    },
    [],
  );

  return (
    <KuaizhizaoReport<DeliveryProcessProgressRow>
      columnPersistenceId="apps.kuaizhizao.pages.delivery-project.reports.process-progress.index-v5"
      title={t('app.kuaizhizao.menu.delivery-project.reports.process-progress')}
      reportType="delivery-process-progress"
      domain="delivery"
      permissionResource="kuaizhizao:delivery-report"
      rowKey="id"
      columns={columns}
      request={request}
    />
  );
};

export default ProcessProgressReportPage;
