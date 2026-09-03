import React, { useMemo } from 'react';
import { Button, Table } from 'antd';
import { ProjectOutlined, ClockCircleOutlined, ExclamationCircleOutlined, FileTextOutlined, FormOutlined, AuditOutlined, CalendarOutlined, BugOutlined, BarChartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ModuleActionMasonry,
  ModuleActionPanel,
  ModuleCenterLayout,
  ModuleChartPanel,
  ModuleFeedList,
  ModuleKpiRow,
  ModuleShortcutGrid,
  masonryWeightFromRows,
  type ModuleFeedItem,
  type ModuleKpiDef,
  type ModuleShortcutDef,
} from '../../../components/module-center';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
import { deliveryProjectApi, DELIVERY_ALERT_KIND, DELIVERY_PROJECT_STATUS } from '../../../services/delivery-project';
import { renderDeliveryStatusTag } from '../shared/deliveryListPresentation';
import DeliveryProjectGanttChart from '../components/DeliveryProjectGanttChart';

import { formatBusinessDateOnly } from '../../../../../utils/format';

const DeliveryProjectDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, loading } = useDashboardRequest(deliveryProjectApi.dashboard, 'kz:delivery-dashboard');

  const openWorkbench = (projectId: number) => {
    navigate(`/apps/kuaizhizao/delivery-project/projects/${projectId}`);
  };

  const kpis: ModuleKpiDef[] = [
    {
      key: 'active',
      title: t('app.kuaizhizao.deliveryProject.dashboard.activeProjects'),
      value: data?.kpis.active_projects ?? 0,
      icon: <ProjectOutlined style={{ fontSize: 24, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
      boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
      onClick: () => navigate('/apps/kuaizhizao/delivery-project/projects'),
    },
    {
      key: 'alerts',
      title: t('app.kuaizhizao.deliveryProject.dashboard.nodeAlerts'),
      value: data?.kpis.alert_count ?? 0,
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
      boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
    },
    {
      key: 'risk',
      title: t('app.kuaizhizao.deliveryProject.dashboard.atRiskProjects'),
      value: data?.kpis.at_risk_projects ?? 0,
      icon: <ExclamationCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)',
      boxShadow: '0 4px 12px rgba(250, 140, 22, 0.15)',
      onClick: () => navigate('/apps/kuaizhizao/delivery-project/projects'),
    },
    {
      key: 'issues',
      title: t('app.kuaizhizao.deliveryProject.dashboard.openIssues'),
      value: data?.kpis.open_issues ?? 0,
      icon: <BugOutlined style={{ fontSize: 24, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
      boxShadow: '0 4px 12px rgba(114, 46, 209, 0.15)',
      onClick: () => navigate('/apps/kuaizhizao/delivery-project/issues'),
    },
  ];

  const shortcuts: ModuleShortcutDef[] = [
    {
      key: 'projects',
      title: t('app.kuaizhizao.menu.delivery-project.projects'),
      icon: <FileTextOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/delivery-project/projects',
    },
    {
      key: 'templates',
      title: t('app.kuaizhizao.menu.delivery-project.process-templates'),
      icon: <FormOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/delivery-project/process-templates',
    },
    {
      key: 'node-reports',
      title: t('app.kuaizhizao.menu.delivery-project.node-reports'),
      icon: <AuditOutlined style={{ fontSize: 22, color: '#722ed1' }} />,
      path: '/apps/kuaizhizao/delivery-project/node-reports',
    },
    {
      key: 'schedules',
      title: t('app.kuaizhizao.menu.delivery-project.schedules'),
      icon: <CalendarOutlined style={{ fontSize: 22, color: '#13c2c2' }} />,
      path: '/apps/kuaizhizao/delivery-project/schedules',
    },
    {
      key: 'issues',
      title: t('app.kuaizhizao.menu.delivery-project.issues'),
      icon: <BugOutlined style={{ fontSize: 22, color: '#eb2f96' }} />,
      path: '/apps/kuaizhizao/delivery-project/issues',
    },
    {
      key: 'progress-summary',
      title: t('app.kuaizhizao.menu.delivery-project.reports.progress-summary'),
      icon: <BarChartOutlined style={{ fontSize: 22, color: '#2f54eb' }} />,
      path: '/apps/kuaizhizao/delivery-project/reports/progress-summary',
    },
  ];

  const recentProjectItems: ModuleFeedItem[] = useMemo(
    () =>
      (data?.recent_projects ?? []).map((p) => ({
        id: p.id,
        title: `${p.project_code} ${p.project_name}`,
        subtitle: `${p.customer_name ?? '-'} ${formatBusinessDateOnly(p.delivery_date) ?? '-'}`,
        meta: renderDeliveryStatusTag(p.status, DELIVERY_PROJECT_STATUS),
        onClick: () => openWorkbench(p.id),
      })),
    [data?.recent_projects],
  );

  const overdueNodes = data?.overdue_nodes ?? [];
  const alertRows = data?.alerts ?? [];

  const alertListPanel = (
    <ModuleActionPanel
      layout="masonry"
      title={t('app.kuaizhizao.deliveryProject.dashboard.alertList')}
      loading={loading}
      masonryWeight={2}
    >
      <Table
        size="small"
        tableLayout="fixed"
        pagination={false}
        rowKey={(r) => `${r.project_id}-${r.node_id}-${r.alert_kind}`}
        dataSource={alertRows}
        locale={{ emptyText: t('common.noData') }}
        columns={[
          {
            title: t('app.kuaizhizao.deliveryProject.dashboard.alertKind'),
            dataIndex: 'alert_kind',
            width: 96,
            render: (v: string) => DELIVERY_ALERT_KIND[v] ?? v,
          },
          {
            title: t('app.kuaizhizao.deliveryProject.fields.projectCode'),
            dataIndex: 'project_code',
            ellipsis: true,
          },
          {
            title: t('app.kuaizhizao.deliveryProject.fields.nodeName'),
            dataIndex: 'node_name',
            ellipsis: true,
          },
          {
            title: t('app.kuaizhizao.deliveryProject.fields.plannedEndDate'),
            dataIndex: 'planned_end_date',
            width: 110,
            render: (v) => formatBusinessDateOnly(v),
          },
          {
            title: t('common.action'),
            width: 72,
            render: (_, r) => (
              <Button type="link" size="small" onClick={() => openWorkbench(r.project_id)}>
                {t('common.view')}
              </Button>
            ),
          },
        ]}
      />
    </ModuleActionPanel>
  );

  return (
    <>
    <ModuleCenterLayout
      loading={loading && !data}
      kpiRow={<ModuleKpiRow items={kpis} colProps={{ xs: 24, sm: 12, lg: 6 }} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      fullWidthRow={
        <ModuleChartPanel
          title={t('app.kuaizhizao.deliveryProject.dashboard.ganttTitle')}
          extra={
            <a onClick={() => navigate('/apps/kuaizhizao/delivery-project/projects')}>
              {t('app.kuaizhizao.deliveryProject.dashboard.viewAll')}
            </a>
          }
          loading={loading}
          fitContent
          layout="standalone"
        >
          <DeliveryProjectGanttChart items={data?.project_gantt ?? []} />
        </ModuleChartPanel>
      }
      actionRow={
        <ModuleActionMasonry>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.deliveryProject.dashboard.recentProjects')}
            loading={loading}
            masonryWeight={masonryWeightFromRows(recentProjectItems.length)}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/delivery-project/projects')}>
                {t('app.kuaizhizao.deliveryProject.dashboard.viewAll')}
              </a>
            }
          >
            <ModuleFeedList
              items={recentProjectItems}
              emptyText={t('app.kuaizhizao.deliveryProject.dashboard.noProjects')}
            />
          </ModuleActionPanel>

          {alertListPanel}

          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.deliveryProject.dashboard.overdueNodeList')}
            loading={loading}
            masonryWeight={2}
            extra={
              overdueNodes.length > 0 ? (
                <a onClick={() => navigate('/apps/kuaizhizao/delivery-project/projects')}>
                  {t('app.kuaizhizao.deliveryProject.dashboard.viewAll')}
                </a>
              ) : undefined
            }
          >
            <Table
              size="small"
              tableLayout="fixed"
              pagination={false}
              rowKey={(r) => `${r.project_id}-${r.node_id}`}
              dataSource={overdueNodes}
              locale={{ emptyText: t('common.noData') }}
              columns={[
                {
                  title: t('app.kuaizhizao.deliveryProject.fields.projectCode'),
                  dataIndex: 'project_code',
                  ellipsis: true,
                },
                {
                  title: t('app.kuaizhizao.deliveryProject.fields.nodeName'),
                  dataIndex: 'node_name',
                  ellipsis: true,
                },
                {
                  title: t('app.kuaizhizao.deliveryProject.fields.plannedEndDate'),
                  dataIndex: 'planned_end_date',
                  width: 110,
                  render: (v) => formatBusinessDateOnly(v),
                },
                {
                  title: t('common.action'),
                  width: 72,
                  render: (_, r) => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => openWorkbench(r.project_id)}
                    >
                      {t('common.view')}
                    </Button>
                  ),
                },
              ]}
            />
          </ModuleActionPanel>
        </ModuleActionMasonry>
      }
    />
    </>
  );
};

export default DeliveryProjectDashboard;
