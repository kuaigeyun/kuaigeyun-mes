/**
 * 项目进度问题报表
 */
import React, { useCallback, useMemo } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import KuaizhizaoReport from '../../../../components/KuaizhizaoReport';
import {
  deliveryProjectApi,
  DELIVERY_ISSUE_PRIORITY,
  DELIVERY_ISSUE_STATUS,
  DELIVERY_ISSUE_TYPE,
  type DeliveryIssueProgressRow,
} from '../../../../services/delivery-project';
import { formatBusinessDateOnly } from '../../../../../../utils/format';

const IssueProgressReportPage: React.FC = () => {
  const { t } = useTranslation();

  const columns: ProColumns<DeliveryIssueProgressRow>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.deliveryProject.fields.issueCode'),
        dataIndex: 'issue_code',
        fixed: 'left',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.projectCode'),
        dataIndex: 'project_code',
        width: 120,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.projectName'),
        dataIndex: 'project_name',
        width: 140,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.nodeName'),
        dataIndex: 'node_name',
        width: 100,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.title'),
        dataIndex: 'title',
        ellipsis: true,
        uniTableRemainderFlex: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.issueType'),
        dataIndex: 'issue_type',
        width: 90,
        hideInSearch: true,
        render: (_, r) => DELIVERY_ISSUE_TYPE[r.issue_type] ?? r.issue_type,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.priority'),
        dataIndex: 'priority',
        width: 90,
        hideInSearch: true,
        render: (_, r) => DELIVERY_ISSUE_PRIORITY[r.priority] ?? r.priority,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.assigneeName'),
        dataIndex: 'assignee_name',
        width: 90,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.deliveryProject.fields.dueDate'),
        dataIndex: 'due_date',
        width: 110,
        hideInSearch: true,
        render: (_, r) => formatBusinessDateOnly(r.due_date),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 90,
        valueType: 'select',
        valueEnum: Object.fromEntries(Object.entries(DELIVERY_ISSUE_STATUS).map(([k, v]) => [k, { text: v }])),
        render: (_, r) => DELIVERY_ISSUE_STATUS[r.status] ?? r.status,
      },
    ],
    [t],
  );

  const request = useCallback(
    async (params: Record<string, unknown>, _sort?: Record<string, unknown>, _filter?: Record<string, unknown>, searchFormValues?: Record<string, unknown>) => {
      const pageSize = Number(params.pageSize ?? 20);
      const skip = (Number(params.current ?? 1) - 1) * pageSize;
      const res = await deliveryProjectApi.issueProgress({
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
    <KuaizhizaoReport<DeliveryIssueProgressRow>
      columnPersistenceId="apps.kuaizhizao.pages.delivery-project.reports.issue-progress.index-v2"
      title={t('app.kuaizhizao.menu.delivery-project.reports.issue-progress')}
      reportType="delivery-issue-progress"
      domain="delivery"
      permissionResource="kuaizhizao:delivery-report"
      rowKey="id"
      columns={columns}
      request={request}
    />
  );
};

export default IssueProgressReportPage;
