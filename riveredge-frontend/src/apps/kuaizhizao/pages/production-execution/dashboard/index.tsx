import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Table, Tag, Typography, Timeline } from 'antd';
import {
  FormOutlined,
  InteractionOutlined,
  PlayCircleOutlined,
  AppstoreAddOutlined,
  AlertOutlined,
  DashboardOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { mesDashboardService } from '../../../services/dashboard';
import { workOrderApi } from '../../../services/work-order';
import { useDashboardRequest } from '../../../utils/dashboardRequestOptions';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleTodoList,
  ModuleChartPanel,
  ModuleChartRow,
} from '../../../components/module-center';
import type { ModuleKpiDef, ModuleShortcutDef } from '../../../components/module-center';

const { Text } = Typography;

const MfgTrendLine = lazy(async () => {
  const { Line } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Line>) => <Line {...props} /> };
});

const MfgStatusColumn = lazy(async () => {
  const { Column } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Column>) => <Column {...props} /> };
});

const ManufacturingDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [trendType, setTrendType] = useState<'output' | 'qualified'>('output');

  const { data: summary, loading: summaryLoading } = useDashboardRequest(
    mesDashboardService.getManufacturingSummary,
    'kz:manufacturing-dashboard:summary',
  );
  const { data: todosData, loading: todosLoading } = useDashboardRequest(
    () => mesDashboardService.getTodosByModule('manufacturing', 8),
    'kz:manufacturing-dashboard:todos',
  );
  const { data: recentOrdersResult, loading: ordersLoading } = useDashboardRequest(async () => {
    const res = await workOrderApi.list({ limit: 8 });
    return Array.isArray(res) ? res : res?.items || [];
  }, 'kz:manufacturing-dashboard:orders');
  const { data: broadcast, loading: broadcastLoading } = useDashboardRequest(
    () => mesDashboardService.getProductionBroadcast(8),
    'kz:manufacturing-dashboard:broadcast',
  );
  const { data: trendData, loading: trendLoading } = useDashboardRequest(
    mesDashboardService.getManufacturingTrend,
    'kz:manufacturing-dashboard:trend',
  );

  const s = summary as Record<string, number> | undefined;
  const recentOrders = recentOrdersResult || [];
  const recentBroadcast = (broadcast as { items?: unknown[] })?.items || [];
  const todos = todosData?.items || [];

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'scheduling',
        title: t('app.kuaizhizao.productionExecutionDashboard.kpi.pendingScheduling'),
        value: s?.pending_scheduling ?? 0,
        subtitle: t('app.kuaizhizao.productionExecutionDashboard.kpi.pendingSchedulingSubtitle'),
        icon: <FormOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaizhizao/production-execution/work-orders?status=draft'),
        sideMetrics: [
          {
            label: t('app.kuaizhizao.productionExecutionDashboard.kpi.reworkInProgress'),
            value: s?.rework_count ?? 0,
          },
        ],
      },
      {
        key: 'wip',
        title: t('app.kuaizhizao.productionExecutionDashboard.kpi.inProgress'),
        value: s?.in_progress_count ?? 0,
        subtitle: t('app.kuaizhizao.productionExecutionDashboard.kpi.inProgressSubtitle'),
        icon: <InteractionOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
        onClick: () => navigate('/apps/kuaizhizao/production-execution/work-orders'),
        sideMetrics: [
          {
            label: t('app.kuaizhizao.productionExecutionDashboard.kpi.pendingReporting'),
            value: s?.pending_reporting ?? 0,
          },
        ],
      },
      {
        key: 'quality',
        title: t('app.kuaizhizao.productionExecutionDashboard.kpi.qualifiedRateToday'),
        value: `${s?.qualified_rate ?? 0}%`,
        icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        progress: s?.qualified_rate ?? 0,
        sideMetrics: [
          {
            label: t('app.kuaizhizao.productionExecutionDashboard.kpi.todayOutput'),
            value: s?.today_output ?? 0,
          },
          {
            label: t('app.kuaizhizao.productionExecutionDashboard.kpi.pendingReporting'),
            value: s?.pending_reporting ?? 0,
          },
        ],
      },
    ],
    [navigate, s, t],
  );

  const shortcuts: ModuleShortcutDef[] = useMemo(
    () => [
      {
        key: 'wo',
        title: t('app.kuaizhizao.productionExecutionDashboard.shortcut.workOrder'),
        icon: <DashboardOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
        path: '/apps/kuaizhizao/production-execution/work-orders',
      },
      {
        key: 'report',
        title: t('app.kuaizhizao.productionExecutionDashboard.shortcut.reporting'),
        icon: <PlayCircleOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
        path: '/apps/kuaizhizao/production-execution/reporting',
      },
      {
        key: 'shortage',
        title: t('app.kuaizhizao.productionExecutionDashboard.shortcut.materialShortage'),
        icon: <AlertOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />,
        path: '/apps/kuaizhizao/production-execution/material-shortage-exceptions',
      },
      {
        key: 'batch',
        title: t('app.kuaizhizao.productionExecutionDashboard.shortcut.batchCenter'),
        icon: <AppstoreAddOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
        path: '/apps/kuaizhizao/warehouse-management/batching-center',
      },
    ],
    [t],
  );

  const statusChartData = useMemo(
    () => [
      {
        status: t('app.kuaizhizao.productionExecutionDashboard.chart.statusPendingScheduling'),
        count: s?.pending_scheduling ?? 0,
      },
      {
        status: t('app.kuaizhizao.productionExecutionDashboard.chart.statusInProgress'),
        count: s?.in_progress_count ?? 0,
      },
      {
        status: t('app.kuaizhizao.productionExecutionDashboard.chart.statusRework'),
        count: s?.rework_count ?? 0,
      },
    ],
    [s, t],
  );

  const trendChartData = useMemo(() => {
    return (trendData?.items || []).map((it) => ({
      date: it.date,
      value: trendType === 'output' ? it.output : it.qualified,
    }));
  }, [trendData, trendType]);

  const orderColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.productionExecutionDashboard.colWorkOrderCode'),
        dataIndex: 'code',
        render: (text: string, record: { id: number }) => (
          <a onClick={() => navigate(`/apps/kuaizhizao/production-execution/work-orders/${record.id}`)}>
            {text}
          </a>
        ),
      },
      {
        title: t('app.kuaizhizao.productionExecutionDashboard.colProgress'),
        width: 100,
        render: (_: unknown, r: { completed_quantity?: number; quantity?: number }) =>
          `${r.completed_quantity ?? 0}/${r.quantity ?? 0}`,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 80,
        render: (status: string) => <Tag color="processing">{status}</Tag>,
      },
    ],
    [navigate, t],
  );

  return (
    <ModuleCenterLayout
      loading={summaryLoading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      actionRow={
        <>
          <ModuleActionPanel
            title={t('app.kuaizhizao.productionExecutionDashboard.todosTitle')}
            lg={8}
            loading={todosLoading}
          >
            <ModuleTodoList
              items={todos}
              emptyText={t('app.kuaizhizao.productionExecutionDashboard.noTodos')}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            title={t('app.kuaizhizao.productionExecutionDashboard.wipOrdersTitle')}
            lg={8}
            loading={ordersLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}>
                {t('app.kuaizhizao.productionExecutionDashboard.all')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={recentOrders.slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={orderColumns}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            title={t('app.kuaizhizao.productionExecutionDashboard.broadcastTitle')}
            lg={8}
            loading={broadcastLoading}
          >
            <Timeline
              items={(recentBroadcast as { content?: string; created_at?: string }[]).slice(0, 5).map((item) => ({
                children: (
                  <>
                    <Text style={{ fontSize: 12 }}>{item.content}</Text>
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {item.created_at ? dayjs(item.created_at).format('MM-DD HH:mm') : ''}
                      </Text>
                    </div>
                  </>
                ),
              }))}
            />
          </ModuleActionPanel>
        </>
      }
      chartRow={
        <ModuleChartRow>
          <ModuleChartPanel
            title={t('app.kuaizhizao.productionExecutionDashboard.trendTitle')}
            loading={trendLoading}
            segmented={{
              value: trendType,
              options: [
                {
                  label: t('app.kuaizhizao.productionExecutionDashboard.trendOutput'),
                  value: 'output',
                },
                {
                  label: t('app.kuaizhizao.productionExecutionDashboard.trendQualified'),
                  value: 'qualified',
                },
              ],
              onChange: (v) => setTrendType(v as 'output' | 'qualified'),
            }}
          >
            <Suspense fallback={null}>
              <MfgTrendLine data={trendChartData} xField="date" yField="value" height={240} smooth />
            </Suspense>
          </ModuleChartPanel>
          <ModuleChartPanel
            title={t('app.kuaizhizao.productionExecutionDashboard.statusDistributionTitle')}
            loading={summaryLoading}
          >
            <Suspense fallback={null}>
              <MfgStatusColumn data={statusChartData} xField="status" yField="count" height={240} />
            </Suspense>
          </ModuleChartPanel>
        </ModuleChartRow>
      }
    />
  );
};

export default ManufacturingDashboard;
