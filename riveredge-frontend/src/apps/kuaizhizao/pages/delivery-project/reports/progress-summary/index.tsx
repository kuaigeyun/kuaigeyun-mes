/**
 * 交付项目进度汇总报表
 */
import React, { useCallback, useMemo } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import { deliveryProjectApi, DELIVERY_PROJECT_STATUS, type DeliveryProgressSummaryRow } from '../../../../services/delivery-project';
import { reportPercent } from '../../../../utils/reportPresentation';
import { formatBusinessDateOnly } from '../../../../../../utils/format';

const ProgressSummaryReportPage: React.FC = () => {
  const { t } = useTranslation();

  const columns: ProColumns<DeliveryProgressSummaryRow>[] = useMemo(
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
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.customerName'),
        dataIndex: 'customer_name',
        width: 220,
        minWidth: 220,
        uniTableKeepWidth: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.salesOrderCode'),
        dataIndex: 'sales_order_code',
        width: 120,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.deliveryDate'),
        dataIndex: 'delivery_date',
        valueType: 'date',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatBusinessDateOnly(r.delivery_date),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.ownerName'),
        dataIndex: 'owner_name',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.currentNode'),
        dataIndex: 'current_node_name',
        width: 110,
        hideInSearch: true,
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
        title: t('app.kuaizhizao.deliveryProject.report.overdueNodes'),
        dataIndex: 'overdue_node_count',
        width: 90,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.deliveryProject.report.openIssues'),
        dataIndex: 'open_issue_count',
        width: 90,
        hideInSearch: true,
        align: 'right',
      },
      {
        title: t('app.kuaizhizao.deliveryProject.report.daysToDelivery'),
        dataIndex: 'days_to_delivery',
        width: 100,
        hideInSearch: true,
        align: 'right',
        render: (_, r) =>
          r.days_to_delivery == null ? '-' : String(r.days_to_delivery),
      },
      {
        title: t('app.kuaizhizao.deliveryProject.report.nodeProgress'),
        dataIndex: 'node_summary',
        ellipsis: true,
        uniTableRemainderFlex: true,
        hideInSearch: true,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 90,
        valueType: 'select',
        valueEnum: Object.fromEntries(
          Object.entries(DELIVERY_PROJECT_STATUS).map(([k, v]) => [k, { text: v }]),
        ),
        render: (_, r) => DELIVERY_PROJECT_STATUS[r.status] ?? r.status,
      },
    ],
    [t],
  );

  const request = useCallback(
    async (params: Record<string, unknown>, _sort?: Record<string, unknown>, _filter?: Record<string, unknown>, searchFormValues?: Record<string, unknown>) => {
      const pageSize = Number(params.pageSize ?? 20);
      const skip = ((Number(params.current ?? 1) - 1) * pageSize);
      const res = await deliveryProjectApi.progressSummary({
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
    <KuaizhizaoReport<DeliveryProgressSummaryRow>
      columnPersistenceId="apps.kuaizhizao.pages.delivery-project.reports.progress-summary.index-v3"
      title={t('app.kuaizhizao.menu.delivery-project.reports.progress-summary')}
      reportType="delivery-progress-summary"
      domain="delivery"
      permissionResource="kuaizhizao:delivery-report"
      rowKey="id"
      columns={columns}
      request={request}
    />
  );
};

export default ProgressSummaryReportPage;
