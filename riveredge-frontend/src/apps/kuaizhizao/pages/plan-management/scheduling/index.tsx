/**
 * 计划排程页面
 *
 * 工单级排产：基于已有工单进行排产，考虑设备/产能约束。
 * 计划日期由生产计划给出，排产日期为考虑产能后的实际执行时间。
 *
 * 注意：MRP/LRP 运算结果请前往「需求计算」页面查看和操作。
 */

import React, { useRef, useState, useCallback, lazy, Suspense, useMemo, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Modal, Switch, Spin, Typography, Alert, InputNumber, Select, Input, Divider, Tour, Collapse } from 'antd';
import { ScheduleOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import {
  workOrderApi,
  advancedSchedulingApi,
  schedulingConfigApi,
  schedulingScenarioApi,
  SchedulingConstraints,
  SchedulingObjective,
  SchedulingScenario,
} from '../../../services/production';
import { mesDashboardService } from '../../../services/dashboard';
import { WorkOrderScoreCell } from '../../../components/WorkOrderScoreCell';
import type { ViewMode, WorkOrderForGantt, GanttTaskLevel } from '../../../components/GanttSchedulingChart/types';
import dayjs from 'dayjs';
import SchedulingHeaderBand from './components/SchedulingHeaderBand';
import SchedulingDiagnosticsTabs from './components/SchedulingDiagnosticsTabs';
import buildSchedulingGanttToolbar from './components/SchedulingGanttToolbar';
import './delfoi-style.less';

const GanttSchedulingChart = lazy(() => import('../../../components/GanttSchedulingChart'));

/** 从计划起止推算工时；无计划区间时回退简化估算（与后端排产占位一致） */
function estimateWorkOrderPlanHours(wo: WorkOrderForGantt): number {
  if (wo.planned_start_date && wo.planned_end_date) {
    const hours = dayjs(wo.planned_end_date).diff(dayjs(wo.planned_start_date), 'hour', true);
    if (hours > 0) return hours;
  }
  return (Number(wo.quantity) || 1) * 0.1;
}

function applyWorkOrderDateUpdates(
  list: WorkOrderForGantt[],
  updates: Array<{ work_order_id: number; planned_start_date: string; planned_end_date: string }>
): WorkOrderForGantt[] {
  if (updates.length === 0) return list;
  const byId = new Map(updates.map((u) => [u.work_order_id, u]));
  return list.map((wo) => {
    const patch = byId.get(wo.id);
    if (!patch) return wo;
    return {
      ...wo,
      planned_start_date: patch.planned_start_date,
      planned_end_date: patch.planned_end_date,
    };
  });
}

function applyOperationDateUpdates(
  list: WorkOrderForGantt[],
  updates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>
): WorkOrderForGantt[] {
  if (updates.length === 0) return list;
  const byOpId = new Map(updates.map((u) => [u.operation_id, u]));
  return list.map((wo) => {
    if (!wo.operations?.length) return wo;
    let changed = false;
    const operations = wo.operations.map((op) => {
      const opId = op.id;
      if (opId == null) return op;
      const patch = byOpId.get(opId);
      if (!patch) return op;
      changed = true;
      return {
        ...op,
        planned_start_date: patch.planned_start_date,
        planned_end_date: patch.planned_end_date,
      };
    });
    return changed ? { ...wo, operations } : wo;
  });
}

/** 默认排程约束（含 4M 人机料法开关） */
const DEFAULT_SCHEDULING_CONSTRAINTS = {
  priority_weight: 0.3,
  due_date_weight: 0.3,
  capacity_weight: 0.2,
  setup_time_weight: 0.2,
  optimize_objective: 'min_makespan' as const,
  consider_human: true,
  consider_equipment: true,
  consider_material: true,
  consider_mold_tool: true,
  scheduling_window_days: 14,
  daily_capacity_hours: 24,
  freeze_horizon_days: 2,
  rolling_horizon_days: 14,
  bottleneck_first: true,
  bottleneck_work_center_ids: [] as number[],
  consider_setup_family: true,
  setup_changeover_hours: 1,
  local_reschedule_hours: 72,
} satisfies SchedulingConstraints;

const SCHEDULING_OBJECTIVE_LABELS: Record<SchedulingObjective, string> = {
  min_makespan: '最小完工时间',
  min_total_time: '最小总时长',
  min_setup_time: '最少换线时间',
  min_tardiness: '最小延期',
};
const SCHEDULING_FULLSCREEN_TIP_SESSION_KEY = 'kuaizhizao.scheduling.fullscreen.tip.tour.v2.shown';

const SchedulingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterWorkOrderIds = useMemo(() => {
    const raw = searchParams.get('work_order_ids');
    if (!raw) return undefined;
    const ids = raw.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n) && n > 0);
    return ids.length > 0 ? ids : undefined;
  }, [searchParams]);

  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>('month');
  const [ganttTaskLevel, setGanttTaskLevel] = useState<GanttTaskLevel>('operation');
  const [fullscreenTourOpen, setFullscreenTourOpen] = useState(false);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [schedulingConstraints, setSchedulingConstraints] = useState(DEFAULT_SCHEDULING_CONSTRAINTS);
  const [configSaving, setConfigSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [tableFilterState, setTableFilterState] = useState<Record<string, any>>({});
  const [lastBlockedTaskId, setLastBlockedTaskId] = useState<string>('');
  const [scenarioModalOpen, setScenarioModalOpen] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarios, setScenarios] = useState<SchedulingScenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<number>();
  const [scenarioDraftName, setScenarioDraftName] = useState('');
  const [bottleneckInput, setBottleneckInput] = useState('');
  const [lastRunPayload, setLastRunPayload] = useState<{
    statistics?: any;
    unscheduled_orders?: Array<{ work_order_id: number; work_order_code: string; reason: string }>;
    conflicts?: Array<{ type?: string; work_order_code?: string; message?: string }>;
  } | null>(null);

  const selectedWorkOrderIds = useMemo(
    () => selectedRowKeys.map((k) => Number(k)).filter((n) => !Number.isNaN(n) && n > 0),
    [selectedRowKeys]
  );

  const buildWorkOrderParams = useCallback(
    (query: Record<string, any>, paging?: { skip: number; limit: number }) => ({
      skip: paging?.skip ?? 0,
      limit: paging?.limit ?? 500,
      status: query.status,
      code: query.code,
      keyword: query.keyword,
      workshop_id: query.workshop_id,
      work_center_id: query.work_center_id,
      include_operations: true,
      include_scores: true,
      include_readiness: false,
    }),
    []
  );

  const {
    data: ganttWorkOrders = [] as WorkOrderForGantt[],
    loading: ganttLoading,
    run: refreshGantt,
    mutate: mutateGanttWorkOrders,
  } = useRequest(
    async () => {
      const res = await workOrderApi.list(buildWorkOrderParams(tableFilterState));
      let list = Array.isArray(res) ? res : (res?.data ?? []);
      if (filterWorkOrderIds?.length) {
        const idSet = new Set(filterWorkOrderIds);
        list = list.filter((wo: WorkOrderForGantt) => idSet.has(wo.id));
      }
      return list as WorkOrderForGantt[];
    },
    { refreshDeps: [filterWorkOrderIds, tableFilterState, buildWorkOrderParams] }
  );

  useEffect(() => {
    if (filterWorkOrderIds?.length) {
      setSelectedRowKeys(filterWorkOrderIds);
    }
  }, [filterWorkOrderIds]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    try {
      if (sessionStorage.getItem(SCHEDULING_FULLSCREEN_TIP_SESSION_KEY) === '1') return undefined;
      timer = setInterval(() => {
        attempts += 1;
        const el = document.querySelector('.uni-tabs-fullscreen-button');
        if (el) {
          setFullscreenTourOpen(true);
          if (timer) clearInterval(timer);
        } else if (attempts >= 60 && timer) {
          clearInterval(timer);
        }
      }, 200);
    } catch {
      // ignore storage failure
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  // 加载默认排程配置（若有）
  useRequest(
    async () => {
      const res = await schedulingConfigApi.getDefault();
      const config = res?.data;
      if (config?.constraints) {
        setSchedulingConstraints((prev) => ({ ...prev, ...config.constraints }));
        const ids = config.constraints.bottleneck_work_center_ids || [];
        setBottleneckInput(Array.isArray(ids) ? ids.join(',') : '');
      }
      return config;
    },
    { refreshDeps: [] }
  );

  const { data: scoreConfig } = useRequest(async () => workOrderApi.getScoreConfig(), {
    refreshDeps: [],
  });
  const { data: planReliability, loading: planReliabilityLoading, run: refreshPlanReliability } = useRequest(
    async () => mesDashboardService.getPlanReliability(),
    { refreshDeps: [] }
  );

  const dailyLoadPreview = useMemo(() => {
    const map = new Map<string, number>();
    for (const wo of ganttWorkOrders) {
      if (!wo.planned_start_date) continue;
      const day = dayjs(wo.planned_start_date).format('MM-DD');
      const hours = estimateWorkOrderPlanHours(wo);
      map.set(day, (map.get(day) || 0) + hours);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 7)
      .map(([day, hours]) => ({
        day,
        hours: Math.round(hours * 10) / 10,
        rate: Math.min(100, Math.round((hours / 24) * 100)),
      }));
  }, [ganttWorkOrders]);

  const nonDraggableTaskIds = useMemo(() => {
    const ids: Array<number | string> = [];
    ganttWorkOrders.forEach((wo) => {
      if (!wo.is_frozen) return;
      ids.push(wo.id);
      (wo.operations || []).forEach((op) => {
        if (op.id != null) ids.push(`op-${op.id}`);
      });
    });
    return ids;
  }, [ganttWorkOrders]);

  const topLegendMetrics = useMemo(() => {
    const now = dayjs();
    const freezeAnchor = dayjs().add(Number(schedulingConstraints.freeze_horizon_days || 0), 'day').endOf('day');
    const manualFrozenCount = ganttWorkOrders.filter((wo) => Boolean(wo.is_frozen)).length;
    const freezeWindowLockedCount = ganttWorkOrders.filter((wo) => {
      if (wo.is_frozen || !wo.planned_start_date) return false;
      return dayjs(wo.planned_start_date).isBefore(freezeAnchor) || dayjs(wo.planned_start_date).isSame(freezeAnchor);
    }).length;
    const totalLockedCount = manualFrozenCount + freezeWindowLockedCount;
    const highRiskCount = ganttWorkOrders.filter((wo) => {
      const overdue = wo.planned_end_date
        ? dayjs(wo.planned_end_date).isBefore(now) && wo.status !== 'completed'
        : false;
      return overdue || wo.priority === 'urgent';
    }).length;
    const executableCount = Math.max(0, ganttWorkOrders.length - totalLockedCount);
    const bottleneckCount = Array.isArray(lastRunPayload?.statistics?.bottleneck_work_centers)
      ? lastRunPayload?.statistics?.bottleneck_work_centers?.length
      : schedulingConstraints.bottleneck_work_center_ids.length;
    const setupSwitchCount = Number(lastRunPayload?.statistics?.setup_changeover_count || 0);
    return {
      totalLockedCount,
      manualFrozenCount,
      freezeWindowLockedCount,
      executableCount,
      highRiskCount,
      bottleneckCount,
      setupSwitchCount,
    };
  }, [
    ganttWorkOrders,
    lastRunPayload?.statistics,
    schedulingConstraints.bottleneck_work_center_ids,
    schedulingConstraints.freeze_horizon_days,
  ]);

  const resourceViewStats = useMemo(() => {
    const workCenterCount = new Set(ganttWorkOrders.map((wo) => wo.work_center_name).filter(Boolean)).size;
    const equipmentSet = new Set<string>();
    let taskCount = 0;
    ganttWorkOrders.forEach((wo) => {
      if (wo.assigned_equipment_name) equipmentSet.add(wo.assigned_equipment_name);
      const ops = wo.operations || [];
      if (ops.length > 0) {
        taskCount += ops.length;
        ops.forEach((op) => {
          if (op.assigned_equipment_name) equipmentSet.add(op.assigned_equipment_name);
        });
      } else {
        taskCount += 1;
      }
    });
    return {
      workCenterCount,
      equipmentCount: equipmentSet.size,
      taskCount,
    };
  }, [ganttWorkOrders]);


  const loadScenarios = useCallback(async () => {
    setScenarioLoading(true);
    try {
      const res = await schedulingScenarioApi.list({ skip: 0, limit: 50 });
      const rows = Array.isArray(res) ? res : (res?.data ?? []);
      setScenarios(rows);
      if (!activeScenarioId && rows[0]?.id) {
        setActiveScenarioId(rows[0].id);
      }
    } catch (e: any) {
      messageApi.error(e?.message || '加载场景失败');
    } finally {
      setScenarioLoading(false);
    }
  }, [activeScenarioId, messageApi]);

  const openScenarioModal = useCallback(async () => {
    setScenarioModalOpen(true);
    await loadScenarios();
  }, [loadScenarios]);

  const handleOptimize = useCallback(async () => {
    try {
      setOptimizing(true);
      const objective = schedulingConstraints.optimize_objective || 'min_makespan';
      const result = await advancedSchedulingApi.optimizeSchedule({
        optimization_params: {
          optimization_objective: objective,
          max_iterations: 200,
          convergence_threshold: 0.01,
        },
      });
      messageApi.success(
        `优化完成：迭代 ${result?.iterations ?? 0} 次，改进 ${(Number(result?.improvement || 0) * 100).toFixed(1)}%，冲突 ${result?.conflict_count ?? 0}，未排 ${result?.unscheduled_count ?? 0}`
      );
      setLastRunPayload((prev) => ({
        statistics: {
          ...(prev?.statistics || {}),
          optimize_iterations: result?.iterations ?? 0,
          optimize_improvement: result?.improvement ?? 0,
          conflict_count: result?.conflict_count ?? 0,
          unscheduled_count: result?.unscheduled_count ?? 0,
        },
        unscheduled_orders: prev?.unscheduled_orders || [],
        conflicts: prev?.conflicts || [],
      }));
      actionRef.current?.reload();
      refreshGantt();
      refreshPlanReliability();
    } catch (e: any) {
      messageApi.error(e?.message || '优化排程失败');
    } finally {
      setOptimizing(false);
    }
  }, [messageApi, refreshGantt, refreshPlanReliability, schedulingConstraints.optimize_objective]);

  const handleLocalReschedule = useCallback(async () => {
    if (selectedWorkOrderIds.length === 0) {
      messageApi.warning('请先选择需要局部重排的工单');
      return;
    }
    try {
      const result = await advancedSchedulingApi.recalculateImpacted({
        trigger_type: 'manual',
        work_order_ids: selectedWorkOrderIds,
        lookahead_hours: schedulingConstraints.local_reschedule_hours || 72,
        apply_results: true,
      });
      const stats = result?.result?.statistics || {};
      messageApi.success(
        `局部重排完成：影响 ${stats.impacted_count ?? result?.impacted_work_order_ids?.length ?? 0} 个工单，排产 ${stats.scheduled_count ?? 0}`
      );
      setLastRunPayload({
        statistics: stats,
        unscheduled_orders: result?.result?.unscheduled_orders || [],
        conflicts: result?.result?.conflicts || [],
      });
      actionRef.current?.reload();
      refreshGantt();
      refreshPlanReliability();
    } catch (e: any) {
      messageApi.error(e?.message || '局部重排失败');
    }
  }, [messageApi, refreshGantt, refreshPlanReliability, schedulingConstraints.local_reschedule_hours, selectedWorkOrderIds]);

  /**
   * 处理智能排产
   */
  const handleAutoSchedule = async () => {
    const selectedIds = selectedRowKeys.length > 0
      ? (selectedRowKeys as number[])
      : undefined;

    try {
      const result = await advancedSchedulingApi.intelligentScheduling({
        work_order_ids: selectedIds,
        constraints: schedulingConstraints,
      });

      if (result.statistics.scheduled_count > 0) {
        messageApi.success(
          `智能排产完成：成功排产 ${result.statistics.scheduled_count} 个工单，排产成功率 ${(result.statistics.scheduling_rate * 100).toFixed(1)}%`
        );
        messageApi.info(
          <span>
            可返回{' '}
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              onClick={() => navigate('/apps/kuaizhizao/plan-management/dashboard')}
            >
              生产协调中心
            </Button>{' '}
            查看下达进度
          </span>,
          6,
        );
      } else {
        messageApi.warning('智能排产完成，但没有工单可以排产');
      }

      if (result.unscheduled_orders?.length > 0) {
        Modal.warning({
          title: '部分工单无法排产',
          content: (
            <div>
              <p>以下工单无法排产：</p>
              <ul>
                {result.unscheduled_orders.slice(0, 5).map((order: any) => (
                  <li key={order.work_order_id}>
                    {order.work_order_code}: {order.reason}
                  </li>
                ))}
                {result.unscheduled_orders.length > 5 && (
                  <li>... 还有 {result.unscheduled_orders.length - 5} 个工单</li>
                )}
              </ul>
            </div>
          ),
        });
      }
      setLastRunPayload({
        statistics: result.statistics,
        unscheduled_orders: result.unscheduled_orders || [],
        conflicts: result.conflicts || [],
      });

      actionRef.current?.reload();
      refreshGantt();
    } catch (error: any) {
      messageApi.error(error?.message || '智能排产失败');
    }
  };

  const handleGanttBatchUpdate = useCallback(
    async (updates: Array<{ work_order_id: number; planned_start_date: string; planned_end_date: string }>) => {
      const validUpdates = updates
        .map((u) => ({
          ...u,
          work_order_id: Number((u as any).work_order_id),
        }))
        .filter((u) => Number.isInteger(u.work_order_id) && u.work_order_id > 0);
      if (validUpdates.length === 0) return;
      mutateGanttWorkOrders((prev) => applyWorkOrderDateUpdates(prev ?? [], validUpdates));
      try {
        await workOrderApi.batchUpdateDates(validUpdates);
        messageApi.success('排程已更新');
        actionRef.current?.reload();
      } catch (e: any) {
        messageApi.error(e?.message || '排程更新失败');
        refreshGantt();
        throw e;
      }
    },
    [messageApi, mutateGanttWorkOrders, refreshGantt]
  );

  const handleGanttBatchUpdateOperations = useCallback(
    async (updates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>) => {
      const validUpdates = updates
        .map((u) => ({
          ...u,
          operation_id: Number((u as any).operation_id),
        }))
        .filter((u) => Number.isInteger(u.operation_id) && u.operation_id > 0);
      if (validUpdates.length === 0) return;
      mutateGanttWorkOrders((prev) => applyOperationDateUpdates(prev ?? [], validUpdates));
      try {
        await workOrderApi.batchUpdateOperationDates(validUpdates);
        messageApi.success('工序排程已更新');
        actionRef.current?.reload();
      } catch (e: any) {
        messageApi.error(e?.message || '工序排程更新失败');
        refreshGantt();
        throw e;
      }
    },
    [messageApi, mutateGanttWorkOrders, refreshGantt]
  );

  const columns: ProColumns<any>[] = [
    {
      title: '工单编号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '工单名称',
      dataIndex: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 80,
      align: 'right',
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '工作中心',
      dataIndex: 'work_center_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '权重分',
      dataIndex: 'scheduling_score',
      width: 88,
      align: 'center',
      render: (_: any, record: any) => (
        <WorkOrderScoreCell
          score={record.scheduling_score}
          breakdown={record.scheduling_score_breakdown}
        />
      ),
    },
    {
      title: '冻结',
      dataIndex: 'is_frozen',
      width: 72,
      align: 'center',
      render: (_: unknown, record: { is_frozen?: boolean }) =>
        record.is_frozen ? <Tag color="purple">冻结</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      align: 'center',
      render: (priority: any) => {
        const val = String(priority || '');
        const colorMap: Record<string, string> = {
          urgent: 'red',
          high: 'orange',
          normal: 'blue',
          low: 'default',
        };
        const textMap: Record<string, string> = {
          urgent: '紧急',
          high: '高',
          normal: '普通',
          low: '低',
        };
        return <Tag color={colorMap[val] || 'default'}>{textMap[val] || val}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        released: { text: '已下达', status: 'processing' },
        in_progress: { text: '生产中', status: 'processing' },
        completed: { text: '已完成', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
  ];

  const ganttToolbarNodes = buildSchedulingGanttToolbar({
    ganttTaskLevel,
    ganttViewMode,
    ganttWorkOrderCount: ganttWorkOrders.length,
    resourceViewStats,
    optimizing,
    scenarioLoading,
    onRefresh: refreshGantt,
    onAutoSchedule: handleAutoSchedule,
    onOptimize: handleOptimize,
    onLocalReschedule: handleLocalReschedule,
    onOpenScenario: openScenarioModal,
    onTaskLevelChange: setGanttTaskLevel,
    onViewModeChange: setGanttViewMode,
  });

  return (
    <ListPageTemplate>
      <Tour
        open={fullscreenTourOpen}
        onClose={() => {
          setFullscreenTourOpen(false);
          try {
            sessionStorage.setItem(SCHEDULING_FULLSCREEN_TIP_SESSION_KEY, '1');
          } catch {
            // ignore storage failure
          }
        }}
        placement="left"
        steps={[
          {
            title: '建议全屏排程',
            description: '点击这里进入全屏，可显著增加甘特图与调度操作空间。',
            target: () => document.querySelector('.uni-tabs-fullscreen-button') as HTMLElement,
          },
        ]}
      />
      <SchedulingHeaderBand
        constraints={schedulingConstraints}
        selectedWorkOrderCount={selectedWorkOrderIds.length}
        objectiveLabels={SCHEDULING_OBJECTIVE_LABELS}
        legendMetrics={topLegendMetrics}
        planReliabilityLoading={planReliabilityLoading}
        planReliability={planReliability}
      />
      {filterWorkOrderIds?.length ? (
        <Alert
          type="info"
          showIcon
          closable
          style={{ marginBottom: 12 }}
          message={`已从协调中心带入 ${filterWorkOrderIds.length} 个工单进行排程`}
          action={
            <Button size="small" onClick={() => navigate('/apps/kuaizhizao/plan-management/dashboard')}>
              返回协调中心
            </Button>
          }
        />
      ) : null}
      <div className="aps-main-layout">
        <div className="aps-block aps-block-gantt">
          <Card
            style={{ marginTop: 16 }}
            title={ganttToolbarNodes.title}
            extra={ganttToolbarNodes.extra}
          >
            <Suspense
              fallback={
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 16 }}>
                  <Spin size="large" />
                  <div style={{ color: 'var(--ant-color-primary)' }}>加载甘特图…</div>
                </div>
              }
            >
              <GanttSchedulingChart
                workOrders={ganttWorkOrders}
                loading={ganttLoading}
                viewMode={ganttViewMode}
                taskLevel={ganttTaskLevel}
                onViewModeChange={setGanttViewMode}
                onBatchUpdate={handleGanttBatchUpdate}
                onBatchUpdateOperations={handleGanttBatchUpdateOperations}
                onRefresh={refreshGantt}
                nonDraggableTaskIds={nonDraggableTaskIds}
                onBlockedDragAttempt={(taskId) => {
                  const text = String(taskId);
                  if (text === lastBlockedTaskId) return;
                  setLastBlockedTaskId(text);
                  messageApi.warning('冻结工单禁止拖拽排程，请先解冻后调整');
                }}
              />
            </Suspense>
          </Card>
        </div>
        <div className="aps-block aps-block-support">
          <Card size="small" style={{ marginTop: 12 }}>
            <Collapse
              ghost
              className="aps-support-collapse"
              defaultActiveKey={['diagnostics']}
              items={[
                {
                  key: 'diagnostics',
                  label: `排程诊断区（本次未排 ${lastRunPayload?.unscheduled_orders?.length || 0} / 冲突 ${lastRunPayload?.conflicts?.length || 0}）`,
                  children: <SchedulingDiagnosticsTabs lastRunPayload={lastRunPayload} dailyLoadPreview={dailyLoadPreview} />,
                },
                {
                  key: 'table',
                  label: '工单工作池（筛选与批量操作）',
                  children: (
                    <UniTable
                      columnPersistenceId="apps.kuaizhizao.pages.plan-management.scheduling"
                      headerTitle="工单工作池"
                      actionRef={actionRef}
                      rowKey="id"
                      columns={columns}
                      showAdvancedSearch={true}
                      request={async (params: any) => {
                        const queryState = {
                          status: params.status,
                          code: params.code,
                          keyword: params.keyword,
                          workshop_id: params.workshop_id,
                          work_center_id: params.work_center_id,
                        };
                        setTableFilterState((prev) => {
                          const prevKey = JSON.stringify(prev);
                          const nextKey = JSON.stringify(queryState);
                          return prevKey === nextKey ? prev : queryState;
                        });
                        const res = await workOrderApi.list(
                          buildWorkOrderParams(queryState, {
                            skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                            limit: params.pageSize ?? 20,
                          })
                        );
                        let data = Array.isArray(res) ? res : (res?.data ?? res?.items ?? []);
                        if (filterWorkOrderIds?.length) {
                          const idSet = new Set(filterWorkOrderIds);
                          data = data.filter((row: { id?: number }) => row.id != null && idSet.has(row.id));
                        }
                        const total = filterWorkOrderIds?.length
                          ? data.length
                          : (res?.total ?? (Array.isArray(data) ? data.length : 0));
                        return {
                          data: Array.isArray(data) ? data : [],
                          success: true,
                          total: typeof total === 'number' ? total : 0,
                        };
                      }}
                      rowSelection={{
                        selectedRowKeys,
                        onChange: setSelectedRowKeys,
                      }}
                      toolBarRender={() => [
                        <Button
                          key="auto-schedule"
                          type="primary"
                          icon={<ScheduleOutlined />}
                          onClick={handleAutoSchedule}
                        >
                          智能排产
                        </Button>,
                        <Button
                          key="refresh-scores"
                          icon={<ReloadOutlined />}
                          onClick={async () => {
                            try {
                              await workOrderApi.batchRefreshScores({ scenarios: ['scheduling', 'picking'] });
                              messageApi.success('权重分已触发重算');
                              actionRef.current?.reload();
                              refreshGantt();
                            } catch (e: any) {
                              messageApi.error(e?.message || '重算失败');
                            }
                          }}
                        >
                          重算权重分
                        </Button>,
                        <Button
                          key="config"
                          icon={<SettingOutlined />}
                          onClick={() => setConfigDrawerOpen(true)}
                        >
                          排程配置
                        </Button>,
                      ]}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>

      <Modal
        title="场景沙盘"
        width={680}
        open={scenarioModalOpen}
        onCancel={() => setScenarioModalOpen(false)}
        footer={
          <Space>
            <Button
              loading={scenarioLoading}
              onClick={async () => {
                const name = (scenarioDraftName || `场景-${dayjs().format('MMDD-HHmm')}`).trim();
                const workOrderIds = selectedWorkOrderIds.length > 0
                  ? selectedWorkOrderIds
                  : (filterWorkOrderIds || []);
                try {
                  setScenarioLoading(true);
                  const created = await schedulingScenarioApi.create({
                    name,
                    description: '来自排程页的草案场景',
                    work_order_ids: workOrderIds,
                    constraints: schedulingConstraints,
                    objective: schedulingConstraints.optimize_objective,
                  });
                  messageApi.success(`场景已创建：${created?.name || name}`);
                  setScenarioDraftName('');
                  await loadScenarios();
                  if (created?.id) setActiveScenarioId(created.id);
                } catch (e: any) {
                  messageApi.error(e?.message || '创建场景失败');
                } finally {
                  setScenarioLoading(false);
                }
              }}
            >
              新建场景
            </Button>
            <Button
              type="primary"
              loading={scenarioLoading}
              onClick={async () => {
                if (!activeScenarioId) {
                  messageApi.warning('请先选择场景');
                  return;
                }
                try {
                  setScenarioLoading(true);
                  const ran = await schedulingScenarioApi.run(activeScenarioId, {
                    apply_objective: schedulingConstraints.optimize_objective,
                  });
                  messageApi.success(
                    `场景重排完成：排产 ${ran?.metrics?.scheduled_count ?? 0}，冲突 ${ran?.metrics?.conflict_count ?? 0}`
                  );
                  await loadScenarios();
                } catch (e: any) {
                  messageApi.error(e?.message || '运行场景失败');
                } finally {
                  setScenarioLoading(false);
                }
              }}
            >
              运行场景
            </Button>
            <Button
              loading={scenarioLoading}
              onClick={async () => {
                if (!activeScenarioId) {
                  messageApi.warning('请先选择场景');
                  return;
                }
                try {
                  setScenarioLoading(true);
                  const published = await schedulingScenarioApi.publish(activeScenarioId);
                  messageApi.success(`场景已发布：${published?.name || activeScenarioId}`);
                  actionRef.current?.reload();
                  refreshGantt();
                  await loadScenarios();
                } catch (e: any) {
                  messageApi.error(e?.message || '发布场景失败');
                } finally {
                  setScenarioLoading(false);
                }
              }}
            >
              发布到正式计划
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input
            placeholder="新场景名称（留空自动生成）"
            value={scenarioDraftName}
            onChange={(e) => setScenarioDraftName(e.target.value)}
          />
          <Select
            showSearch
            placeholder="选择已有场景"
            value={activeScenarioId}
            style={{ width: '100%' }}
            options={scenarios.map((s) => ({
              label: `${s.name}（${s.status}）`,
              value: s.id,
            }))}
            onChange={(v) => setActiveScenarioId(v)}
          />
          <Divider style={{ margin: '6px 0' }} />
          {(() => {
            const active = scenarios.find((s) => s.id === activeScenarioId);
            if (!active) return <Typography.Text type="secondary">暂无场景，请先创建。</Typography.Text>;
            const metrics = active.metrics || {};
            return (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Typography.Text strong>{active.name}</Typography.Text>
                <Typography.Text type="secondary">
                  状态：{active.status} ｜ 目标：{active.objective} ｜ 工单数：{active.work_order_ids?.length || 0}
                </Typography.Text>
                <Typography.Text>
                  指标：排产 {metrics.scheduled_count ?? 0}，未排 {metrics.unscheduled_count ?? 0}，冲突 {metrics.conflict_count ?? 0}
                </Typography.Text>
              </Space>
            );
          })()}
        </Space>
      </Modal>

      {/* 排程配置 Modal - 4M 人机料法可配置 */}
      <Modal
        title="排程配置"
        width={400}
        open={configDrawerOpen}
        onCancel={() => setConfigDrawerOpen(false)}
        footer={
          <Space>
            <Button
              onClick={() => {
                setSchedulingConstraints(DEFAULT_SCHEDULING_CONSTRAINTS);
                setBottleneckInput('');
              }}
            >
              恢复默认
            </Button>
            <Button
              type="primary"
              loading={configSaving}
              onClick={async () => {
                try {
                  setConfigSaving(true);
                  await schedulingConfigApi.upsertDefault(schedulingConstraints);
                  messageApi.success('排程配置已保存');
                  setConfigDrawerOpen(false);
                } catch (e: any) {
                  messageApi.error(e?.message || '排程配置保存失败');
                } finally {
                  setConfigSaving(false);
                }
              }}
            >
              确定
            </Button>
          </Space>
        }
      >
        <div style={{ padding: '12px 0' }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>人机料法约束（4M）</div>
          <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 16 }}>
            勾选表示排程时考虑该约束，取消勾选则忽略（适合资源有限的中小企业按实情选择）
          </div>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>优化目标</span>
              <Select
                size="small"
                style={{ width: 160 }}
                value={schedulingConstraints.optimize_objective}
                options={[
                  { label: '最小完工时间', value: 'min_makespan' },
                  { label: '最小总时长', value: 'min_total_time' },
                  { label: '最少换线时间', value: 'min_setup_time' },
                  { label: '最小延期', value: 'min_tardiness' },
                ]}
                onChange={(v: SchedulingObjective) =>
                  setSchedulingConstraints((c) => ({ ...c, optimize_objective: v }))
                }
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>排程窗口（天）</span>
              <InputNumber
                size="small"
                min={1}
                max={90}
                value={schedulingConstraints.scheduling_window_days}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({
                    ...c,
                    scheduling_window_days: Number(v || DEFAULT_SCHEDULING_CONSTRAINTS.scheduling_window_days),
                  }))
                }
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>每日产能（小时）</span>
              <InputNumber
                size="small"
                min={1}
                max={24}
                value={schedulingConstraints.daily_capacity_hours}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({
                    ...c,
                    daily_capacity_hours: Number(v || DEFAULT_SCHEDULING_CONSTRAINTS.daily_capacity_hours),
                  }))
                }
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>冻结窗口（天）</span>
              <InputNumber
                size="small"
                min={0}
                max={30}
                value={schedulingConstraints.freeze_horizon_days}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({
                    ...c,
                    freeze_horizon_days: Number(v ?? DEFAULT_SCHEDULING_CONSTRAINTS.freeze_horizon_days),
                  }))
                }
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>滚动窗口（天）</span>
              <InputNumber
                size="small"
                min={1}
                max={120}
                value={schedulingConstraints.rolling_horizon_days}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({
                    ...c,
                    rolling_horizon_days: Number(v || DEFAULT_SCHEDULING_CONSTRAINTS.rolling_horizon_days),
                  }))
                }
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>局部重排窗口（小时）</span>
              <InputNumber
                size="small"
                min={1}
                max={240}
                value={schedulingConstraints.local_reschedule_hours}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({
                    ...c,
                    local_reschedule_hours: Number(v || DEFAULT_SCHEDULING_CONSTRAINTS.local_reschedule_hours),
                  }))
                }
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>人：考虑人员约束</span>
              <Switch
                checked={schedulingConstraints.consider_human}
                onChange={(v) => setSchedulingConstraints((c) => ({ ...c, consider_human: v }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>机：考虑设备约束</span>
              <Switch
                checked={schedulingConstraints.consider_equipment}
                onChange={(v) => setSchedulingConstraints((c) => ({ ...c, consider_equipment: v }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>料：考虑物料齐套</span>
              <Switch
                checked={schedulingConstraints.consider_material}
                onChange={(v) => setSchedulingConstraints((c) => ({ ...c, consider_material: v }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>法：考虑模具/工装占用</span>
              <Switch
                checked={schedulingConstraints.consider_mold_tool}
                onChange={(v) => setSchedulingConstraints((c) => ({ ...c, consider_mold_tool: v }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>瓶颈优先排程</span>
              <Switch
                checked={schedulingConstraints.bottleneck_first}
                onChange={(v) => setSchedulingConstraints((c) => ({ ...c, bottleneck_first: v }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>考虑换型族连续排产</span>
              <Switch
                checked={schedulingConstraints.consider_setup_family}
                onChange={(v) => setSchedulingConstraints((c) => ({ ...c, consider_setup_family: v }))}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>换型切换工时</span>
              <InputNumber
                size="small"
                min={0}
                max={12}
                value={schedulingConstraints.setup_changeover_hours}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({
                    ...c,
                    setup_changeover_hours: Number(v ?? DEFAULT_SCHEDULING_CONSTRAINTS.setup_changeover_hours),
                  }))
                }
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>瓶颈工作中心ID（逗号分隔，可空自动识别）</span>
              <Input
                size="small"
                placeholder="如：101,102"
                value={bottleneckInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setBottleneckInput(value);
                  const ids = value
                    .split(',')
                    .map((s) => Number(s.trim()))
                    .filter((n) => !Number.isNaN(n) && n > 0);
                  setSchedulingConstraints((c) => ({ ...c, bottleneck_work_center_ids: ids }));
                }}
              />
            </div>
          </Space>
          {scoreConfig?.profiles?.scheduling && (
            <>
              <div style={{ marginTop: 24, marginBottom: 8, fontWeight: 500 }}>权重分配置</div>
              <div style={{ color: '#8c8c8c', fontSize: 12, marginBottom: 12 }}>
                可在「参数设置 → 计划管理」中开启/关闭权重打分与编辑权重模板
              </div>
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {Object.entries(scoreConfig.profiles.scheduling.weights || {}).map(([key, weight]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{key}</span>
                    <span>{((Number(weight) || 0) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </Space>
            </>
          )}
        </div>
      </Modal>
    </ListPageTemplate>
  );
};

export default SchedulingPage;
