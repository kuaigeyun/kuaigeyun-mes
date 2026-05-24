import React, { useMemo, Suspense, lazy } from 'react';
import { App, Button, Space, Typography, Tag, Skeleton } from 'antd';
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  FileDoneOutlined,
  PartitionOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useRequest } from 'ahooks';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { qualityApi, type QualityAnomalyItem } from '../../../services/quality-execution';
import { mesDashboardService } from '../../../services/dashboard';
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

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const PassRateLineChart = lazy(async () => {
  const { Line } = await import('@ant-design/charts');
  return {
    default: (props: React.ComponentProps<typeof Line>) => <Line {...props} />,
  };
});

const { Text } = Typography;

const INSPECTION_TYPE_LABEL: Record<string, string> = {
  incoming: '来料',
  process: '过程',
  finished: '成品',
};

const INSPECTION_LIST_PATH: Record<string, string> = {
  incoming: '/apps/kuaizhizao/quality-management/incoming-inspection',
  process: '/apps/kuaizhizao/quality-management/process-inspection',
  finished: '/apps/kuaizhizao/quality-management/finished-goods-inspection',
};

function anomalySeverity(a: QualityAnomalyItem): 'high' | 'medium' | 'low' {
  const iq = Number(a.inspection_quantity) || 0;
  const uq = Number(a.unqualified_quantity) || 0;
  if (iq <= 0) return 'low';
  const ratio = uq / iq;
  if (ratio >= 0.5) return 'high';
  if (ratio >= 0.2) return 'medium';
  return 'low';
}

const InspectionCenter: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const { data: summary, loading: summaryLoading } = useRequest(
    () => qualityApi.qualityStatistics.getInspectionCenterSummary(),
    { onError: (e: any) => message.error(e?.message || '加载质检中心数据失败') },
  );

  const { data: anomaliesResp } = useRequest(
    () => qualityApi.qualityStatistics.getAnomalies({ limit: 12 }),
    { onError: (e: any) => message.error(e?.message || '加载质量异常失败') },
  );

  const { data: todosData, loading: todosLoading } = useRequest(() =>
    mesDashboardService.getTodosByModule('quality', 8),
  );

  const anomalies = anomaliesResp?.anomalies ?? [];
  const qualityTodos = todosData?.items ?? [];

  const pendingTotal =
    (summary?.pending_incoming || 0) + (summary?.pending_process || 0) + (summary?.pending_finished || 0);

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'pending',
        title: '待检任务总数',
        value: pendingTotal,
        subtitle: '当前所有待检单据/工序',
        icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaizhizao/quality-management/incoming-inspection'),
        sideMetrics: [
          { label: '来料/过程', value: `${summary?.pending_incoming || 0} / ${summary?.pending_process || 0}` },
          { label: '成品待检', value: summary?.pending_finished || 0 },
        ],
      },
      {
        key: 'today',
        title: '今日质量达标',
        value: `${summary?.today_qualified_rate ?? 0}%`,
        subtitle: `今日已检验 ${summary?.total_inspected_today || 0} 批次`,
        icon: <ThunderboltOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
        sideMetrics: [
          { label: '今日报检', value: summary?.total_inspected_today || 0 },
          {
            label: '状态',
            value: summary && summary.today_qualified_rate >= 98 ? '优良' : '受控',
          },
        ],
      },
      {
        key: 'month',
        title: '本月合格率',
        value: `${summary?.month_qualified_rate ?? 0}%`,
        subtitle: `环比上月 ${summary?.last_month_qualified_rate || 0}%`,
        icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        sideMetrics: [
          { label: '上月同期', value: `${summary?.last_month_qualified_rate || 0}%` },
          {
            label: '趋势',
            value:
              summary && summary.month_qualified_rate >= (summary.last_month_qualified_rate || 0) ? '↑' : '↓',
          },
        ],
      },
    ],
    [summary, pendingTotal, navigate],
  );

  const shortcuts: ModuleShortcutDef[] = [
    {
      key: 'incoming',
      title: '来料检验',
      icon: <DatabaseOutlined style={{ fontSize: 20, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/quality-management/incoming-inspection',
    },
    {
      key: 'process',
      title: '过程检验',
      icon: <PartitionOutlined style={{ fontSize: 20, color: '#722ed1' }} />,
      path: '/apps/kuaizhizao/quality-management/process-inspection',
    },
    {
      key: 'finished',
      title: '成品检验',
      icon: <SafetyCertificateOutlined style={{ fontSize: 20, color: '#52c41a' }} />,
      path: '/apps/kuaizhizao/quality-management/finished-goods-inspection',
    },
    {
      key: 'plans',
      title: '质检方案',
      icon: <FileDoneOutlined style={{ fontSize: 20, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/quality-management/inspection-plans',
    },
  ];

  const chartData = useMemo(
    () =>
      (summary?.daily_pass_rate_trend || []).map((d) => ({
        date: d.date.slice(5),
        rate: d.rate,
      })),
    [summary],
  );

  const trendConfig = useMemo(() => {
    const rows = chartData.length ? chartData : [{ date: '-', rate: 0 }];
    const rates = chartData.map((d) => d.rate);
    const hasRates = rates.length > 0;
    const minR = hasRates ? Math.min(...rates) : 0;
    const maxR = hasRates ? Math.max(...rates) : 100;
    const pad = 5;
    return {
      data: rows,
      xField: 'date',
      yField: 'rate',
      smooth: true,
      animation: false,
      padding: 'auto' as const,
      color: '#1890ff',
      point: { size: 4, shape: 'diamond' as const },
      label: { style: { fill: '#aaa' } },
      yAxis: hasRates
        ? { min: Math.max(0, minR - pad), max: Math.min(100, maxR + pad) }
        : { min: 0, max: 100 },
    };
  }, [chartData]);

  return (
    <ModuleCenterLayout
      loading={summaryLoading && !summary}
      kpiRow={<ModuleKpiRow items={kpis} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      actionRow={
        <>
          <ModuleActionPanel title="质检待办" lg={8} loading={todosLoading}>
            <ModuleTodoList items={qualityTodos} emptyText="暂无质检待办" />
          </ModuleActionPanel>
          <ModuleActionPanel
            title="质量异常处置"
            lg={16}
            extra={
              <Button
                type="link"
                onClick={() => navigate('/apps/kuaizhizao/production-execution/quality-exceptions')}
              >
                全部
              </Button>
            }
          >
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {anomalies.length === 0 ? (
                <Text type="secondary">暂无质量异常</Text>
              ) : (
                anomalies.map((item) => (
                  <div
                    key={`${item.inspection_type}-${item.inspection_id}`}
                    style={{
                      padding: '12px 8px',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(INSPECTION_LIST_PATH[item.inspection_type] || '/')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Tag color={anomalySeverity(item) === 'high' ? 'red' : 'orange'}>
                        {INSPECTION_TYPE_LABEL[item.inspection_type]}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(item.inspection_time).fromNow()}
                      </Text>
                    </div>
                    <Text strong style={{ display: 'block', marginBottom: 2 }}>
                      {item.material_name || item.inspection_code}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.nonconformance_reason || '质量判定不合格'}
                    </Text>
                  </div>
                ))
              )}
            </div>
          </ModuleActionPanel>
        </>
      }
      chartRow={
        <ModuleChartRow>
          <ModuleChartPanel
            title={
              <Space>
                <BarChartOutlined />
                <span>质量合格率趋势</span>
              </Space>
            }
            lg={24}
          >
            <Suspense fallback={<Skeleton active />}>
              <PassRateLineChart {...trendConfig} height={300} />
            </Suspense>
          </ModuleChartPanel>
        </ModuleChartRow>
      }
    />
  );
};

export default InspectionCenter;
