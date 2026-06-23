import React, { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { Badge, Empty, Table, Tag, Typography, Timeline } from 'antd';
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
import { formatDateTime } from '../../../../../utils/format';
import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  ModuleActionPanel,
  ModuleActionMasonry,
  ModuleTodoList,
  ModuleChartPanel,
} from '../../../components/module-center';
import { translateWorkOrderLifecycleStatus } from '../../../utils/workOrderLifecycle';

const { Text } = Typography;

const MfgTrendLine = lazy(async () => {
  const { Line } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Line>) => <Line {...props} /> };
});

const MfgStatusPie = lazy(async () => {
  const { Pie } = await import('@ant-design/charts');
  return { default: (props: React.ComponentProps<typeof Pie>) => <Pie {...props} /> };
});

const WIP_STATUSES = new Set(['released', 'in_progress', '已下达', '执行中', 'RELEASED', 'IN_PROGRESS']);
const COMPLETED_STATUSES = new Set(['completed', 'cancelled', '已完成', '已取消', 'COMPLETED', 'CANCELLED']);

type WorkOrderRow = {
  id: number;
  code?: string;
  product_name?: string;
  product_code?: string;
  row_kind?: string;
  quantity?: number;
  completed_quantity?: number;
  status?: string;
  planned_end_date?: string;
};

type ProductionBroadcastItem = {
  id: string;
  operator_name?: string;
  process_name?: string;
  product_name?: string;
  work_order_no?: string;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  created_at?: string;
};

function unwrapWorkOrderList(res: unknown): WorkOrderRow[] {
  if (Array.isArray(res)) return res as WorkOrderRow[];
  const payload = res as { data?: WorkOrderRow[]; items?: WorkOrderRow[] };
  return payload?.data ?? payload?.items ?? [];
}

function isDashboardWorkOrderRow(row: WorkOrderRow): boolean {
  const kind = row.row_kind;
  return !kind || kind === 'work_order';
}

function renderDashboardWorkOrderStackedCell(
  record: WorkOrderRow,
  onOpen: (id: number) => void,
) {
  return (
    <div
      style={{ cursor: 'pointer', minWidth: 0 }}
      onClick={() => onOpen(record.id)}
    >
      <UniTableStackedPrimaryCell
        primary={String(record.product_name ?? record.product_code ?? '').trim() || '-'}
        secondary={String(record.code ?? '').trim() || '-'}
      />
    </div>
  );
}

function isWipWorkOrder(row: WorkOrderRow): boolean {
  return WIP_STATUSES.has(String(row.status ?? ''));
}

function isOverdueWorkOrder(row: WorkOrderRow): boolean {
  const status = String(row.status ?? '');
  if (COMPLETED_STATUSES.has(status)) return false;
  if (!WIP_STATUSES.has(status) && status !== 'draft' && status !== '草稿') return false;
  if (!row.planned_end_date) return false;
  return dayjs(row.planned_end_date).isBefore(dayjs(), 'day');
}

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
  const { data: workOrdersResult, loading: ordersLoading } = useDashboardRequest(async () => {
    const res = await workOrderApi.list({ skip: 0, limit: 80, order_by: '-created_at' });
    return unwrapWorkOrderList(res);
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
  const allWorkOrders = workOrdersResult || [];
  const wipOrders = useMemo(
    () => allWorkOrders.filter((row) => isDashboardWorkOrderRow(row) && isWipWorkOrder(row)).slice(0, 6),
    [allWorkOrders],
  );
  const overdueOrders = useMemo(
    () =>
      allWorkOrders
        .filter((row) => isDashboardWorkOrderRow(row) && isOverdueWorkOrder(row))
        .sort((a, b) => dayjs(a.planned_end_date).valueOf() - dayjs(b.planned_end_date).valueOf())
        .slice(0, 6),
    [allWorkOrders],
  );
  const recentBroadcast = ((broadcast as { items?: ProductionBroadcastItem[] })?.items || []) as ProductionBroadcastItem[];
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

  const openWorkOrder = useCallback(
    (id: number) => {
      navigate(`/apps/kuaizhizao/production-execution/work-orders/${id}`);
    },
    [navigate],
  );

  const workOrderStackedColumn = useMemo(
    () => ({
      title: t('app.kuaizhizao.workOrder.colProductWorkOrderCode'),
      key: 'workOrderStacked',
      ellipsis: true,
      render: (_: unknown, record: WorkOrderRow) =>
        renderDashboardWorkOrderStackedCell(record, openWorkOrder),
    }),
    [openWorkOrder, t],
  );

  const orderColumns = useMemo(
    () => [
      workOrderStackedColumn,
      {
        title: t('app.kuaizhizao.productionExecutionDashboard.colProgress'),
        width: 96,
        render: (_: unknown, r: WorkOrderRow) =>
          `${r.completed_quantity ?? 0}/${r.quantity ?? 0}`,
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 88,
        render: (status: string) => (
          <Tag color="processing">{translateWorkOrderLifecycleStatus(t, status)}</Tag>
        ),
      },
    ],
    [t, workOrderStackedColumn],
  );

  const overdueColumns = useMemo(
    () => [
      workOrderStackedColumn,
      {
        title: t('app.kuaizhizao.productionExecutionDashboard.colPlannedEnd'),
        dataIndex: 'planned_end_date',
        width: 100,
        render: (value: string) => (value ? formatDateTime(value, 'MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.productionExecutionDashboard.colOverdueDays'),
        width: 72,
        render: (_: unknown, r: WorkOrderRow) => {
          if (!r.planned_end_date) return '-';
          const days = dayjs().startOf('day').diff(dayjs(r.planned_end_date).startOf('day'), 'day');
          return days > 0 ? t('app.kuaizhizao.productionExecutionDashboard.overdueDays', { days }) : '-';
        },
      },
    ],
    [t, workOrderStackedColumn],
  );

  const broadcastTimelineItems = useMemo(
    () =>
      recentBroadcast.slice(0, 5).map((item) => ({
        key: item.id,
        color: (item.unqualified_quantity ?? 0) > 0 ? 'red' : 'green',
        children: (
          <>
            <Text style={{ fontSize: 12 }}>
              <Text strong>{item.operator_name || '—'}</Text>
              {t('app.kuaizhizao.productionExecutionDashboard.broadcastReportAt')}
              <Text style={{ color: '#1890ff' }}>{item.process_name || '-'}</Text>
              {t('app.kuaizhizao.productionExecutionDashboard.broadcastReportDone')}
            </Text>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {t('app.kuaizhizao.productionExecutionDashboard.broadcastWorkOrder')}: {item.work_order_no || '-'}
                {' · '}
                {t('app.kuaizhizao.productionExecutionDashboard.broadcastProduct')}: {item.product_name || '-'}
              </Text>
            </div>
            <div style={{ marginTop: 4 }}>
              <Badge status="success" text={`${t('app.kuaizhizao.productionExecutionDashboard.broadcastQualified')}: ${item.qualified_quantity ?? 0}`} />
              {(item.unqualified_quantity ?? 0) > 0 && (
                <Badge
                  status="error"
                  text={`${t('app.kuaizhizao.productionExecutionDashboard.broadcastUnqualified')}: ${item.unqualified_quantity}`}
                  style={{ marginLeft: 12 }}
                />
              )}
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {item.created_at ? formatDateTime(item.created_at, 'MM-DD HH:mm') : ''}
              </Text>
            </div>
          </>
        ),
      })),
    [recentBroadcast, t],
  );

  return (
    <ModuleCenterLayout
      loading={summaryLoading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      actionRow={
        <ModuleActionMasonry>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.productionExecutionDashboard.todosTitle')}
            loading={todosLoading}
          >
            <ModuleTodoList
              items={todos}
              emptyText={t('app.kuaizhizao.productionExecutionDashboard.noTodos')}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.productionExecutionDashboard.wipOrdersTitle')}
            loading={ordersLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}>
                {t('app.kuaizhizao.productionExecutionDashboard.all')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={wipOrders}
              pagination={false}
              rowKey="id"
              columns={orderColumns}
              locale={{ emptyText: t('app.kuaizhizao.workOrder.emptyNoWip') }}
            />
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.productionExecutionDashboard.broadcastTitle')}
            loading={broadcastLoading}
          >
            {broadcastTimelineItems.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('app.kuaizhizao.productionExecutionDashboard.emptyBroadcast')}
              />
            ) : (
              <Timeline items={broadcastTimelineItems} />
            )}
          </ModuleActionPanel>
          <ModuleActionPanel
            layout="masonry"
            title={t('app.kuaizhizao.productionExecutionDashboard.overdueOrdersTitle')}
            loading={ordersLoading}
            extra={
              <a onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}>
                {t('app.kuaizhizao.productionExecutionDashboard.all')}
              </a>
            }
          >
            <Table
              size="small"
              dataSource={overdueOrders}
              pagination={false}
              rowKey="id"
              columns={overdueColumns}
              locale={{ emptyText: t('app.kuaizhizao.productionExecutionDashboard.emptyOverdue') }}
            />
          </ModuleActionPanel>
          <ModuleChartPanel
            layout="masonry"
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
              <MfgTrendLine
                data={trendChartData}
                xField="date"
                yField="value"
                height={240}
                autoFit
                shapeField="smooth"
                style={{ lineWidth: 2 }}
              />
            </Suspense>
          </ModuleChartPanel>
          <ModuleChartPanel
            layout="masonry"
            title={t('app.kuaizhizao.productionExecutionDashboard.statusDistributionTitle')}
            loading={summaryLoading}
          >
            <Suspense fallback={null}>
              <MfgStatusPie
                data={statusChartData}
                angleField="count"
                colorField="status"
                radius={0.8}
                innerRadius={0.6}
                height={240}
                autoFit
                legend={{ color: { position: 'bottom' } }}
              />
            </Suspense>
          </ModuleChartPanel>
        </ModuleActionMasonry>
      }
    />
  );
};

export default ManufacturingDashboard;
