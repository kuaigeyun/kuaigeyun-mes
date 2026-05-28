import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Table, Tag, Typography, Timeline } from 'antd';
import { useRequest } from 'ahooks';
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
import dayjs from 'dayjs';
import { mesDashboardService } from '../../../services/dashboard';
import { workOrderApi } from '../../../services/work-order';
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
  const navigate = useNavigate();
  const [trendType, setTrendType] = useState<'output' | 'qualified'>('output');

  const { data: summary, loading: summaryLoading } = useRequest(mesDashboardService.getManufacturingSummary);
  const { data: todosData, loading: todosLoading } = useRequest(() =>
    mesDashboardService.getTodosByModule('manufacturing', 8),
  );
  const { data: recentOrdersResult, loading: ordersLoading } = useRequest(async () => {
    const res = await workOrderApi.list({ limit: 8 });
    return Array.isArray(res) ? res : res?.items || [];
  });
  const { data: broadcast, loading: broadcastLoading } = useRequest(() =>
    mesDashboardService.getProductionBroadcast(8),
  );
  const { data: trendData, loading: trendLoading } = useRequest(mesDashboardService.getManufacturingTrend);

  const s = summary as Record<string, number> | undefined;
  const recentOrders = recentOrdersResult || [];
  const recentBroadcast = (broadcast as { items?: unknown[] })?.items || [];
  const todos = todosData?.items || [];

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'scheduling',
        title: '待排产工单',
        value: s?.pending_scheduling ?? 0,
        subtitle: '草稿状态待排程下达',
        icon: <FormOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaizhizao/production-execution/work-orders?status=draft'),
        sideMetrics: [{ label: '返工中', value: s?.rework_count ?? 0 }],
      },
      {
        key: 'wip',
        title: '进行中工单',
        value: s?.in_progress_count ?? 0,
        subtitle: '已下达 / 生产中',
        icon: <InteractionOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
        onClick: () => navigate('/apps/kuaizhizao/production-execution/work-orders'),
        sideMetrics: [{ label: '待核报工', value: s?.pending_reporting ?? 0 }],
      },
      {
        key: 'quality',
        title: '加工合格率 (今日)',
        value: `${s?.qualified_rate ?? 0}%`,
        icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        progress: s?.qualified_rate ?? 0,
        sideMetrics: [
          { label: '成品产出', value: s?.today_output ?? 0 },
          { label: '待核报工', value: s?.pending_reporting ?? 0 },
        ],
      },
    ],
    [navigate, s],
  );

  const shortcuts: ModuleShortcutDef[] = [
    { key: 'wo', title: '工单管理', icon: <DashboardOutlined style={{ fontSize: 22, color: '#1890ff' }} />, path: '/apps/kuaizhizao/production-execution/work-orders' },
    { key: 'report', title: '报工看板', icon: <PlayCircleOutlined style={{ fontSize: 22, color: '#52c41a' }} />, path: '/apps/kuaizhizao/production-execution/reporting' },
    { key: 'shortage', title: '缺料预警', icon: <AlertOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />, path: '/apps/kuaizhizao/production-execution/material-shortage-exceptions' },
    { key: 'batch', title: '物料中心', icon: <AppstoreAddOutlined style={{ fontSize: 22, color: '#fa8c16' }} />, path: '/apps/kuaizhizao/warehouse-management/batching-center' },
  ];

  const statusChartData = useMemo(
    () => [
      { status: '待排产', count: s?.pending_scheduling ?? 0 },
      { status: '进行中', count: s?.in_progress_count ?? 0 },
      { status: '返工', count: s?.rework_count ?? 0 },
    ],
    [s],
  );

  const trendChartData = useMemo(() => {
    return (trendData?.items || []).map((it) => ({
      date: it.date,
      value: trendType === 'output' ? it.output : it.qualified,
    }));
  }, [trendData, trendType]);

  return (
    <ModuleCenterLayout
      loading={summaryLoading && !s}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      actionRow={
        <>
          <ModuleActionPanel title="制造待办" lg={8} loading={todosLoading}>
            <ModuleTodoList items={todos} emptyText="暂无制造待办" />
          </ModuleActionPanel>
          <ModuleActionPanel
            title="在制工单"
            lg={8}
            loading={ordersLoading}
            extra={<a onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}>全部</a>}
          >
            <Table
              size="small"
              dataSource={recentOrders.slice(0, 6)}
              pagination={false}
              rowKey="id"
              columns={[
                {
                  title: '工单编号',
                  dataIndex: 'code',
                  render: (text, record: { id: number }) => (
                    <a onClick={() => navigate(`/apps/kuaizhizao/production-execution/work-orders/${record.id}`)}>{text}</a>
                  ),
                },
                {
                  title: '进度',
                  width: 100,
                  render: (_: unknown, r: { completed_quantity?: number; quantity?: number }) =>
                    `${r.completed_quantity ?? 0}/${r.quantity ?? 0}`,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 80,
                  render: (status) => <Tag color="processing">{status}</Tag>,
                },
              ]}
            />
          </ModuleActionPanel>
          <ModuleActionPanel title="生产播报" lg={8} loading={broadcastLoading}>
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
            title="产出趋势"
            loading={trendLoading}
            segmented={{
              value: trendType,
              options: [
                { label: '入库产出', value: 'output' },
                { label: '报工合格', value: 'qualified' },
              ],
              onChange: (v) => setTrendType(v as 'output' | 'qualified'),
            }}
          >
            <Suspense fallback={null}>
              <MfgTrendLine data={trendChartData} xField="date" yField="value" height={240} smooth />
            </Suspense>
          </ModuleChartPanel>
          <ModuleChartPanel title="工单状态分布" loading={summaryLoading}>
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
