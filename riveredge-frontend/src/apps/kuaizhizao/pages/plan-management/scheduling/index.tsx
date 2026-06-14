/**
 * 可视排产页面
 *
 * 基于甘特图拖拽调整工单/工序计划时间；待排工单区展示全部可排工单及排产问题。
 * MRP/LRP 运算请前往「需求计算」页面。
 */

import React, { useRef, useState, useCallback, lazy, Suspense, useMemo, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Modal, Switch, Spin, Typography, Alert, InputNumber, Divider, Tour, ConfigProvider, Tooltip } from 'antd';
import type { ThemeConfig } from 'antd/es/theme/interface';
import { useRequest } from 'ahooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import {
  workOrderApi,
  schedulingConfigApi,
  visualSchedulingApi,
  SchedulingConstraints,
  VisualSchedulingBoardScan,
} from '../../../services/production';
import { mesDashboardService } from '../../../services/dashboard';
import type { ViewMode, WorkOrderForGantt, WorkstationResource } from '../../../components/GanttSchedulingChart/types';
import { stationResourceId } from '../../../components/GanttSchedulingChart/stationResourceUtils';
import { factoryListItems, workstationApi, workCenterApi } from '../../../../master-data/services/factory';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import dayjs from 'dayjs';
import SchedulingHeaderBand from './components/SchedulingHeaderBand';
import SchedulingBoardDropZone from './components/SchedulingBoardDropZone';
import { collectWorkOrderDiagnosticIssues } from './components/schedulingPoolDiagnostics';
import SchedulingPoolToolbar from './components/SchedulingPoolToolbar';
import SchedulingWorkOrderPrepModal, {
  type SchedulingWorkOrderPrepValues,
} from './components/SchedulingWorkOrderPrepModal';
import buildSchedulingGanttToolbar from './components/SchedulingGanttToolbar';
import {
  buildScheduleWorkOrderDrop,
  countScheduledOperations,
  countWorkOrderOperations,
  getWorkOrderSchedulingPrepContext,
  getOperationsForStationPrep,
  isWorkOrderScheduledOnBoard,
  mapOperationForGantt,
  mergeApiWorkOrderWithScheduled,
  mergeScheduledWorkOrderIntoBoard,
  pickFocusOperationTaskId,
  workOrderNeedsSchedulingPrep,
  SCHEDULING_DRAG_WORK_ORDER,
  type OperationNeedingStation,
  type WorkOrderSchedulingMissingField,
} from './schedulingDropUtils';
import {
  buildFreezeAnchor,
  canShiftWorkOrder,
  isWorkOrderSchedulingLocked,
} from './freezeUtils';
import { ensureBatchUpdatesPersisted, reportBatchUpdateResult } from './batchResultUtils';
import {
  isSchedulableWorkOrderStatus,
  matchesPoolKeyword,
  type PoolStatusFilter,
} from './schedulingPoolUtils';
import './delfoi-style.less';

const GANTT_WORK_ORDER_LIMIT = 500;

const GANTT_TASK_LEVEL = 'station' as const;

/** 待排表格统一字号；行高沿用改字体前的 Table token（与甘特图 32px 行对齐） */
const SCHEDULING_POOL_FONT_SIZE = 13;
const SCHEDULING_POOL_ROW_HEIGHT = 32;

const SCHEDULING_POOL_TABLE_THEME: ThemeConfig = {
  components: {
    Table: {
      borderRadius: 0,
      headerBorderRadius: 0,
      cellFontSizeSM: SCHEDULING_POOL_FONT_SIZE,
      cellPaddingBlockSM: Math.floor((SCHEDULING_POOL_ROW_HEIGHT - 20) / 2),
      cellPaddingInlineSM: 8,
    },
    Tag: {
      fontSizeSM: SCHEDULING_POOL_FONT_SIZE,
    },
    Typography: {
      fontSize: SCHEDULING_POOL_FONT_SIZE,
    },
    Pagination: {
      fontSize: SCHEDULING_POOL_FONT_SIZE,
    },
    Badge: {
      fontSize: SCHEDULING_POOL_FONT_SIZE,
      textFontSize: SCHEDULING_POOL_FONT_SIZE,
      textFontSizeSM: SCHEDULING_POOL_FONT_SIZE,
    },
    Segmented: {
      fontSize: SCHEDULING_POOL_FONT_SIZE,
    },
    Input: {
      fontSize: SCHEDULING_POOL_FONT_SIZE,
    },
    Button: {
      fontSize: SCHEDULING_POOL_FONT_SIZE,
    },
  },
};

const GanttSchedulingChart = lazy(() => import('../../../components/GanttSchedulingChart'));

const DEFAULT_SCHEDULING_CONSTRAINTS: SchedulingConstraints = {
  consider_human: true,
  consider_equipment: true,
  consider_material: true,
  consider_mold_tool: true,
  freeze_horizon_days: 2,
  rolling_horizon_days: 14,
};

function pickVisualSchedulingConstraints(constraints: SchedulingConstraints): SchedulingConstraints {
  return {
    consider_human: constraints.consider_human,
    consider_equipment: constraints.consider_equipment,
    consider_material: constraints.consider_material,
    consider_mold_tool: constraints.consider_mold_tool,
    freeze_horizon_days: constraints.freeze_horizon_days ?? 2,
    rolling_horizon_days: constraints.rolling_horizon_days ?? 14,
  };
}

const SCHEDULING_FULLSCREEN_TIP_SESSION_KEY = 'kuaizhizao.scheduling.fullscreen.tip.tour.v3.shown';

function applyWorkOrderDateUpdates(
  list: WorkOrderForGantt[],
  updates: Array<{ work_order_id: number; planned_start_date: string; planned_end_date: string }>
): WorkOrderForGantt[] {
  if (updates.length === 0) return list;
  const byId = new Map(updates.map((u) => [u.work_order_id, u]));
  return list.map((wo) => {
    const patch = byId.get(wo.id);
    if (!patch) return wo;
    return { ...wo, planned_start_date: patch.planned_start_date, planned_end_date: patch.planned_end_date };
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
      return { ...op, planned_start_date: patch.planned_start_date, planned_end_date: patch.planned_end_date };
    });
    return changed ? { ...wo, operations } : wo;
  });
}

const SchedulingPage: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterWorkOrderIds = useMemo(() => {
    const raw = searchParams.get('work_order_ids');
    if (!raw) return undefined;
    const ids = raw.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n) && n > 0);
    return ids.length > 0 ? ids : undefined;
  }, [searchParams]);
  const filterPlanDate = useMemo(() => {
    const raw = searchParams.get('plan_date')?.trim();
    return raw || undefined;
  }, [searchParams]);

  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [ganttViewMode, setGanttViewMode] = useState<ViewMode>('week');
  const [fullscreenTourOpen, setFullscreenTourOpen] = useState(false);
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [schedulingConstraints, setSchedulingConstraints] = useState(DEFAULT_SCHEDULING_CONSTRAINTS);
  const [configSaving, setConfigSaving] = useState(false);
  const [poolKeyword, setPoolKeyword] = useState('');
  const [poolAppliedKeyword, setPoolAppliedKeyword] = useState('');
  const [poolStatusFilter, setPoolStatusFilter] = useState<PoolStatusFilter>('all');
  const [lastBlockedTaskId, setLastBlockedTaskId] = useState<string>('');
  const [shiftDays, setShiftDays] = useState(1);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [quickActionLoading, setQuickActionLoading] = useState(false);
  const [boardScan, setBoardScan] = useState<VisualSchedulingBoardScan | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [scrollToTodayToken, setScrollToTodayToken] = useState(0);
  const [draftMode, setDraftMode] = useState(false);
  const [draftPendingCount, setDraftPendingCount] = useState(0);
  const [prepModalOpen, setPrepModalOpen] = useState(false);
  const [prepModalWorkOrder, setPrepModalWorkOrder] = useState<WorkOrderForGantt | null>(null);
  const [prepModalMissing, setPrepModalMissing] = useState<WorkOrderSchedulingMissingField[]>([]);
  const [prepModalOperationsNeedingStation, setPrepModalOperationsNeedingStation] = useState<
    OperationNeedingStation[]
  >([]);
  const [prepModalSaving, setPrepModalSaving] = useState(false);
  const [prepModalLoading, setPrepModalLoading] = useState(false);
  const draftWoUpdatesRef = useRef(
    new Map<number, { work_order_id: number; planned_start_date: string; planned_end_date: string }>()
  );
  const draftOpUpdatesRef = useRef(
    new Map<number, { operation_id: number; planned_start_date: string; planned_end_date: string }>()
  );
  const undoStackRef = useRef<WorkOrderForGantt[][]>([]);
  const schedulingPerms = useResourcePermissions('plan-management-scheduling');
  const canScheduleUpdate = schedulingPerms.canUpdate;

  const syncDraftPendingCount = useCallback(() => {
    setDraftPendingCount(draftWoUpdatesRef.current.size + draftOpUpdatesRef.current.size);
  }, []);

  const selectedWorkOrderIds = useMemo(
    () => selectedRowKeys.map((k) => Number(k)).filter((n) => !Number.isNaN(n) && n > 0),
    [selectedRowKeys]
  );

  const buildWorkOrderParams = useCallback(
    (query: Record<string, any>, paging?: { skip: number; limit: number }) => ({
      skip: paging?.skip ?? 0,
      limit: paging?.limit ?? 500,
      status: query.status,
      keyword: query.keyword,
      include_operations: true,
      include_scores: false,
      include_readiness: false,
    }),
    []
  );

  useEffect(() => {
    actionRef.current?.reload();
  }, [poolAppliedKeyword, poolStatusFilter]);

  const handlePoolSearch = useCallback(() => {
    setPoolAppliedKeyword(poolKeyword.trim());
  }, [poolKeyword]);

  const handlePoolReset = useCallback(() => {
    setPoolKeyword('');
    setPoolAppliedKeyword('');
    setPoolStatusFilter('all');
  }, []);

  const {
    data: ganttWorkOrders = [] as WorkOrderForGantt[],
    loading: ganttLoading,
    run: refreshGantt,
    mutate: mutateGanttWorkOrders,
  } = useRequest(
    async () => {
      const res = await workOrderApi.list(buildWorkOrderParams({}, { limit: GANTT_WORK_ORDER_LIMIT }));
      let list = Array.isArray(res) ? res : (res?.data ?? []);
      list = list.filter((wo: WorkOrderForGantt) => isSchedulableWorkOrderStatus(wo.status));
      if (filterWorkOrderIds?.length) {
        const idSet = new Set(filterWorkOrderIds);
        list = list.filter((wo: WorkOrderForGantt) => idSet.has(wo.id));
      } else if (filterPlanDate) {
        list = list.filter(
          (wo: WorkOrderForGantt) =>
            wo.planned_start_date &&
            dayjs(wo.planned_start_date).format('YYYY-MM-DD') === filterPlanDate,
        );
      }
      return list as WorkOrderForGantt[];
    },
    { refreshDeps: [filterWorkOrderIds, filterPlanDate, buildWorkOrderParams] }
  );

  const ganttBoardWorkOrders = useMemo(
    () => ganttWorkOrders.filter((wo) => isWorkOrderScheduledOnBoard(wo)),
    [ganttWorkOrders]
  );

  const scheduledBoardWorkOrderIdsKey = useMemo(
    () =>
      ganttBoardWorkOrders
        .map((wo) => wo.id)
        .sort((a, b) => a - b)
        .join(','),
    [ganttBoardWorkOrders]
  );

  const poolWorkOrders = useMemo(
    () =>
      ganttWorkOrders.filter(
        (wo) =>
          (poolStatusFilter === 'all' || wo.status === poolStatusFilter) &&
          matchesPoolKeyword(wo, poolAppliedKeyword)
      ),
    [ganttWorkOrders, poolAppliedKeyword, poolStatusFilter]
  );

  const workOrderDiagnosticsById = useMemo(() => {
    const map = new Map<number, ReturnType<typeof collectWorkOrderDiagnosticIssues>>();
    for (const wo of ganttWorkOrders) {
      const issues = collectWorkOrderDiagnosticIssues(wo, boardScan);
      if (issues.length > 0) map.set(wo.id, issues);
    }
    return map;
  }, [boardScan, ganttWorkOrders]);

  const poolWorkOrdersRef = useRef(poolWorkOrders);
  poolWorkOrdersRef.current = poolWorkOrders;

  useEffect(() => {
    actionRef.current?.reload();
  }, [scheduledBoardWorkOrderIdsKey, poolAppliedKeyword, poolStatusFilter]);

  const pushUndoSnapshot = useCallback(() => {
    undoStackRef.current.push(JSON.parse(JSON.stringify(ganttWorkOrders)) as WorkOrderForGantt[]);
    if (undoStackRef.current.length > 15) undoStackRef.current.shift();
  }, [ganttWorkOrders]);

  const scanBoardWorkOrderIds = useMemo(() => {
    const ids = new Set<number>();
    if (filterWorkOrderIds?.length) {
      filterWorkOrderIds.forEach((id) => ids.add(id));
    } else {
      (ganttWorkOrders ?? []).forEach((wo) => ids.add(wo.id));
    }
    return ids.size > 0 ? [...ids] : undefined;
  }, [filterWorkOrderIds, ganttWorkOrders]);

  const scanBoardWorkOrderIdsKey = useMemo(
    () => (scanBoardWorkOrderIds ?? []).slice().sort((a, b) => a - b).join(','),
    [scanBoardWorkOrderIds]
  );

  const { run: refreshBoardScan } = useRequest(
    async () => {
      const res = await visualSchedulingApi.boardScan({
        horizon_days: schedulingConstraints.rolling_horizon_days || 14,
        work_order_ids: scanBoardWorkOrderIds,
        plan_date: filterPlanDate,
      });
      setBoardScan(res);
      return res;
    },
    {
      refreshDeps: [schedulingConstraints.rolling_horizon_days, scanBoardWorkOrderIdsKey, filterPlanDate],
    }
  );

  useEffect(() => {
    if (filterWorkOrderIds?.length) setSelectedRowKeys(filterWorkOrderIds);
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
        } else if (attempts >= 60 && timer) clearInterval(timer);
      }, 200);
    } catch {
      // ignore
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  useRequest(
    async () => {
      const res = await schedulingConfigApi.getDefault();
      const config = res?.data;
      if (config?.constraints) {
        setSchedulingConstraints((prev) => ({
          ...prev,
          ...pickVisualSchedulingConstraints(config.constraints as SchedulingConstraints),
        }));
      }
      return config;
    },
    { refreshDeps: [] }
  );

  const { data: planReliability, loading: planReliabilityLoading, run: refreshPlanReliability } = useRequest(
    async () => mesDashboardService.getPlanReliability(),
    { refreshDeps: [] }
  );

  const { data: workstationResources = [] as WorkstationResource[] } = useRequest(async () => {
    const res = await workstationApi.list({ is_active: true, limit: 1000 });
    const items = factoryListItems(res);
    return items
      .map((s: { id?: number; name?: string; code?: string }) => ({
        id: Number(s.id),
        name: String(s.name || s.code || s.id),
        code: s.code ? String(s.code) : undefined,
      }))
      .filter((s) => Number.isInteger(s.id) && s.id > 0);
  });

  const { data: schedulingWorkCenters = [] } = useRequest(async () => {
    const res = await workCenterApi.list({ is_active: true, limit: 500 });
    return factoryListItems(res)
      .map(
        (wc: { id?: number; name?: string; code?: string; workstationIds?: number[] }) => ({
          id: Number(wc.id),
          name: String(wc.name || wc.code || wc.id),
          code: wc.code ? String(wc.code) : undefined,
          workstationIds: (wc.workstationIds ?? []).map(Number).filter((id) => id > 0),
        })
      )
      .filter((wc) => Number.isInteger(wc.id) && wc.id > 0);
  });

  const freezeAnchor = useMemo(
    () => buildFreezeAnchor(schedulingConstraints.freeze_horizon_days || 0),
    [schedulingConstraints.freeze_horizon_days]
  );

  const selectedOperationCount = useMemo(() => {
    if (selectedWorkOrderIds.length === 0) return 0;
    const idSet = new Set(selectedWorkOrderIds);
    let count = 0;
    (ganttWorkOrders ?? []).forEach((wo) => {
      if (!idSet.has(wo.id)) return;
      count += (wo.operations || []).filter((o) => o.id != null).length;
    });
    return count;
  }, [ganttWorkOrders, selectedWorkOrderIds]);

  const selectedWorkOrders = useMemo(() => {
    const idSet = new Set(selectedWorkOrderIds);
    return ganttWorkOrders.filter((wo) => idSet.has(wo.id));
  }, [ganttWorkOrders, selectedWorkOrderIds]);

  const nonDraggableTaskIds = useMemo(() => {
    const stationIdsWithOps = new Set<number>();
    (ganttBoardWorkOrders ?? []).forEach((wo) => {
      (wo.operations || []).forEach((op) => {
        if (op.assigned_station_id != null && Number(op.assigned_station_id) > 0) {
          stationIdsWithOps.add(Number(op.assigned_station_id));
        }
      });
    });
    const ids: Array<number | string> = workstationResources
      .filter((s) => !stationIdsWithOps.has(s.id))
      .map((s) => stationResourceId(s.id));
    (ganttBoardWorkOrders ?? []).forEach((wo) => {
      if (!isWorkOrderSchedulingLocked(wo, schedulingConstraints.freeze_horizon_days || 0, freezeAnchor)) {
        return;
      }
      (wo.operations || []).forEach((op) => {
        if (op.id != null) ids.push(`op-${op.id}`);
      });
    });
    return ids;
  }, [freezeAnchor, ganttBoardWorkOrders, schedulingConstraints.freeze_horizon_days, workstationResources]);

  const topLegendMetrics = useMemo(() => {
    const manualFrozenCount = ganttBoardWorkOrders.filter((wo) => Boolean(wo.is_frozen)).length;
    const freezeWindowLockedCount = ganttBoardWorkOrders.filter((wo) => {
      if (wo.is_frozen || !wo.planned_start_date) return false;
      return (
        dayjs(wo.planned_start_date).isBefore(freezeAnchor) ||
        dayjs(wo.planned_start_date).isSame(freezeAnchor)
      );
    }).length;
    const totalLockedCount = new Set(
      ganttBoardWorkOrders
        .filter((wo) => isWorkOrderSchedulingLocked(wo, schedulingConstraints.freeze_horizon_days || 0, freezeAnchor))
        .map((wo) => wo.id)
    ).size;
    return {
      totalLockedCount,
      manualFrozenCount,
      freezeWindowLockedCount,
      executableCount: Math.max(0, ganttBoardWorkOrders.length - totalLockedCount),
      conflictCount: boardScan?.conflict_count ?? 0,
    };
  }, [boardScan, freezeAnchor, ganttBoardWorkOrders, schedulingConstraints.freeze_horizon_days]);

  const resourceViewStats = useMemo(() => {
    let scheduledOpCount = 0;
    (ganttBoardWorkOrders ?? []).forEach((wo) => {
      scheduledOpCount += (wo.operations || []).filter((o) => o.id != null).length;
    });
    return {
      stationCount: workstationResources.length,
      taskCount: scheduledOpCount,
    };
  }, [ganttBoardWorkOrders, workstationResources.length]);

  const confirmAndPersist = useCallback(
    async (
      woUpdates: Array<{ work_order_id: number; planned_start_date: string; planned_end_date: string }>,
      opUpdates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>
    ) => {
      const validation = await visualSchedulingApi.validateAdjustments({
        work_order_updates: woUpdates,
        operation_updates: opUpdates,
      });
      const doSave = async () => {
        if (woUpdates.length > 0) {
          const woResult = await workOrderApi.batchUpdateDates(woUpdates);
          ensureBatchUpdatesPersisted(woResult, woUpdates.length, '工单日期');
          reportBatchUpdateResult(messageApi, '工单日期', woResult);
          mutateGanttWorkOrders((prev) => applyWorkOrderDateUpdates(prev ?? [], woUpdates));
        }
        if (opUpdates.length > 0) {
          const opResult = await workOrderApi.batchUpdateOperationDates(opUpdates);
          ensureBatchUpdatesPersisted(opResult, opUpdates.length, '工序日期');
          reportBatchUpdateResult(messageApi, '工序日期', opResult);
          mutateGanttWorkOrders((prev) => applyOperationDateUpdates(prev ?? [], opUpdates));
        }
        actionRef.current?.reload();
        refreshBoardScan();
        refreshPlanReliability();
      };
      if (validation.valid) {
        await doSave();
        return;
      }
      const preview = (validation.conflicts || []).slice(0, 5).map((c) => c.message).join('\n');
      await new Promise<void>((resolve, reject) => {
        modal.confirm({
          title: '排程存在冲突',
          content: (
            <div>
              <p>检测到 {validation.conflict_count} 项冲突，仍要保存吗？</p>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{preview}</pre>
            </div>
          ),
          okText: '仍要保存',
          cancelText: '取消',
          onOk: async () => {
            try {
              await doSave();
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          onCancel: () => reject(new Error('cancelled')),
        });
      });
    },
    [messageApi, modal, mutateGanttWorkOrders, refreshBoardScan, refreshPlanReliability]
  );

  const handleApplyDraft = useCallback(async () => {
    const woUpdates = [...draftWoUpdatesRef.current.values()];
    const opUpdates = [...draftOpUpdatesRef.current.values()];
    if (woUpdates.length === 0 && opUpdates.length === 0) {
      messageApi.info('暂无待应用的更改');
      return;
    }
    try {
      await confirmAndPersist(woUpdates, opUpdates);
      draftWoUpdatesRef.current.clear();
      draftOpUpdatesRef.current.clear();
      undoStackRef.current = [];
      syncDraftPendingCount();
      refreshGantt();
    } catch (e: any) {
      if (e?.message !== 'cancelled') {
        messageApi.error(e?.message || '应用更改失败');
        refreshGantt();
      }
    }
  }, [confirmAndPersist, messageApi, refreshGantt, syncDraftPendingCount]);

  const handleUndoDraft = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) {
      messageApi.info('无可撤销的暂存步骤');
      return;
    }
    mutateGanttWorkOrders(prev);
    draftWoUpdatesRef.current.clear();
    draftOpUpdatesRef.current.clear();
    syncDraftPendingCount();
    messageApi.success('已撤销上一步暂存');
  }, [messageApi, mutateGanttWorkOrders, syncDraftPendingCount]);

  const handleGanttBatchUpdate = useCallback(
    async (updates: Array<{ work_order_id: number; planned_start_date: string; planned_end_date: string }>) => {
      const validUpdates = updates
        .map((u) => ({ ...u, work_order_id: Number((u as any).work_order_id) }))
        .filter((u) => Number.isInteger(u.work_order_id) && u.work_order_id > 0);
      if (validUpdates.length === 0) return;
      if (draftMode) {
        pushUndoSnapshot();
        mutateGanttWorkOrders((prev) => applyWorkOrderDateUpdates(prev ?? [], validUpdates));
        validUpdates.forEach((u) => draftWoUpdatesRef.current.set(u.work_order_id, u));
        syncDraftPendingCount();
        return;
      }
      try {
        await confirmAndPersist(validUpdates, []);
      } catch (e: any) {
        if (e?.message !== 'cancelled') {
          messageApi.error(e?.message || '排程更新失败');
          refreshGantt();
        }
        throw e;
      }
    },
    [
      confirmAndPersist,
      draftMode,
      messageApi,
      mutateGanttWorkOrders,
      pushUndoSnapshot,
      refreshGantt,
      syncDraftPendingCount,
    ]
  );

  const handleGanttBatchUpdateOperations = useCallback(
    async (updates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>) => {
      const validUpdates = updates
        .map((u) => ({ ...u, operation_id: Number((u as any).operation_id) }))
        .filter((u) => Number.isInteger(u.operation_id) && u.operation_id > 0);
      if (validUpdates.length === 0) return;
      if (draftMode) {
        pushUndoSnapshot();
        mutateGanttWorkOrders((prev) => applyOperationDateUpdates(prev ?? [], validUpdates));
        validUpdates.forEach((u) => draftOpUpdatesRef.current.set(u.operation_id, u));
        syncDraftPendingCount();
        return;
      }
      try {
        await confirmAndPersist([], validUpdates);
      } catch (e: any) {
        if (e?.message !== 'cancelled') {
          messageApi.error(e?.message || '工序排程更新失败');
          refreshGantt();
        }
        throw e;
      }
    },
    [
      confirmAndPersist,
      draftMode,
      messageApi,
      mutateGanttWorkOrders,
      pushUndoSnapshot,
      refreshGantt,
      syncDraftPendingCount,
    ]
  );

  const handleBatchShift = useCallback(
    async (days: number) => {
      if (selectedWorkOrderIds.length === 0 || days === 0) return;
      const idSet = new Set(selectedWorkOrderIds);
      const updates = ganttWorkOrders
        .filter(
          (wo) =>
            idSet.has(wo.id) &&
            canShiftWorkOrder(wo, schedulingConstraints.freeze_horizon_days || 0, freezeAnchor)
        )
        .slice(0, 50)
        .map((wo) => ({
          work_order_id: wo.id,
          planned_start_date: dayjs(wo.planned_start_date).add(days, 'day').toISOString(),
          planned_end_date: dayjs(wo.planned_end_date).add(days, 'day').toISOString(),
        }));
      if (updates.length === 0) {
        messageApi.warning('选中工单无有效计划日期或处于冻结状态');
        return;
      }
      setBatchActionLoading(true);
      try {
        await confirmAndPersist(updates, []);
        refreshGantt();
      } catch (e: any) {
        if (e?.message !== 'cancelled') messageApi.error(e?.message || '批量平移失败');
      } finally {
        setBatchActionLoading(false);
      }
    },
    [confirmAndPersist, freezeAnchor, ganttWorkOrders, messageApi, refreshGantt, schedulingConstraints.freeze_horizon_days, selectedWorkOrderIds]
  );

  const handleGanttWorkOrderSelect = useCallback((workOrderId: number | null) => {
    if (workOrderId == null) {
      setSelectedRowKeys([]);
      return;
    }
    setSelectedRowKeys([workOrderId]);
  }, []);

  const handleFocusTaskConsumed = useCallback(() => {
    setFocusTaskId(null);
  }, []);

  const handleBatchUpdateOperationStations = useCallback(
    async (updates: Array<{ operation_id: number; assigned_station_id: number }>) => {
      if (!canScheduleUpdate || updates.length === 0) return;
      try {
        const validation = await visualSchedulingApi.validateAdjustments({
          operation_station_updates: updates,
        });
        if (!validation.valid) {
          const preview = (validation.conflicts || []).slice(0, 3).map((c) => c.message).join('\n');
          messageApi.error(preview || '改派工位校验未通过');
          refreshGantt();
          return;
        }
        const result = await workOrderApi.batchUpdateOperationStations(updates);
        reportBatchUpdateResult(messageApi, '工序工位', {
          updated: result.updated,
          skipped_frozen: result.skipped_frozen,
          skipped_freeze_window: [],
          failed: result.failed,
        });
        refreshGantt();
        refreshBoardScan();
      } catch (e: any) {
        messageApi.error(e?.message || '改派工位失败');
        refreshGantt();
      }
    },
    [canScheduleUpdate, messageApi, refreshBoardScan, refreshGantt]
  );

  const handleSchedulingQuickAction = useCallback(
    async (
      action: 'confirm_delay' | 'to_exception' | 'apply_unfreeze',
      title: string,
      reason: string,
      successPrefix: string,
    ) => {
      if (!canScheduleUpdate || selectedWorkOrderIds.length === 0) return;
      const ids = selectedWorkOrderIds.slice(0, 50);
      const overdueCount = selectedWorkOrders.filter(
        (wo) => wo.planned_end_date && dayjs(wo.planned_end_date).isBefore(dayjs())
      ).length;
      await new Promise<void>((resolve, reject) => {
        modal.confirm({
          title,
          content:
            overdueCount > 0
              ? `已选 ${ids.length} 张工单，其中 ${overdueCount} 张已逾期。是否继续？`
              : `已选 ${ids.length} 张工单，是否继续？`,
          okText: '确认',
          cancelText: '取消',
          onOk: () => resolve(),
          onCancel: () => reject(new Error('cancelled')),
        });
      });
      setQuickActionLoading(true);
      try {
        const result = await workOrderApi.schedulingQuickAction({
          work_order_ids: ids,
          action,
          reason,
          auto_move_out_of_freeze_window: action !== 'to_exception',
        });
        const failCount = result.failed?.length ?? 0;
        const skippedCount = result.skipped?.length ?? 0;
        const updatedCount = result.updated?.length ?? 0;
        const convertedCount = result.converted_to_exception?.length ?? 0;
        const unfreezedCount = result.unfreezed?.length ?? 0;
        messageApi.success(
          `${successPrefix}：顺延 ${updatedCount}，转异常 ${convertedCount}，解冻 ${unfreezedCount}，跳过 ${skippedCount}${
            failCount > 0 ? `，失败 ${failCount}` : ''
          }`
        );
        refreshGantt();
        refreshBoardScan();
        actionRef.current?.reload();
      } catch (e: any) {
        if (e?.message !== 'cancelled') {
          messageApi.error(e?.message || '快捷处置失败');
        }
      } finally {
        setQuickActionLoading(false);
      }
    },
    [canScheduleUpdate, messageApi, modal, refreshBoardScan, refreshGantt, selectedWorkOrderIds, selectedWorkOrders]
  );

  const handleConfirmDelay = useCallback(async () => {
    await handleSchedulingQuickAction('confirm_delay', '延期确认', '可视排产延期确认', '已完成延期确认');
  }, [handleSchedulingQuickAction]);

  const handleToException = useCallback(async () => {
    await handleSchedulingQuickAction('to_exception', '转异常工单', '可视排产转异常', '已转入异常池');
  }, [handleSchedulingQuickAction]);

  const handleApplyUnfreeze = useCallback(async () => {
    await handleSchedulingQuickAction('apply_unfreeze', '解冻申请', '可视排产解冻申请', '已处理解冻申请');
  }, [handleSchedulingQuickAction]);

  const persistOperationScheduling = useCallback(
    async (
      operationDateUpdates: Array<{ operation_id: number; planned_start_date: string; planned_end_date: string }>,
      operationStationUpdates: Array<{ operation_id: number; assigned_station_id: number }>
    ) => {
      if (operationStationUpdates.length > 0) {
        const validation = await visualSchedulingApi.validateAdjustments({
          operation_station_updates: operationStationUpdates,
          operation_updates: operationDateUpdates,
        });
        if (!validation.valid) {
          const preview = (validation.conflicts || []).slice(0, 3).map((c) => c.message).join('\n');
          throw new Error(preview || '排产校验未通过');
        }
        const stationResult = await workOrderApi.batchUpdateOperationStations(operationStationUpdates);
        ensureBatchUpdatesPersisted(
          {
            updated: stationResult.updated,
            skipped_frozen: stationResult.skipped_frozen,
            skipped_freeze_window: [],
            failed: stationResult.failed,
          },
          operationStationUpdates.length,
          '工序工位'
        );
        reportBatchUpdateResult(messageApi, '工序工位', {
          updated: stationResult.updated,
          skipped_frozen: stationResult.skipped_frozen,
          skipped_freeze_window: [],
          failed: stationResult.failed,
        });
      }
      if (operationDateUpdates.length > 0) {
        const validation = await visualSchedulingApi.validateAdjustments({
          operation_updates: operationDateUpdates,
        });
        if (!validation.valid) {
          const preview = (validation.conflicts || []).slice(0, 3).map((c) => c.message).join('\n');
          throw new Error(preview || '排产校验未通过');
        }
        const opResult = await workOrderApi.batchUpdateOperationDates(operationDateUpdates);
        ensureBatchUpdatesPersisted(opResult, operationDateUpdates.length, '工序日期');
        reportBatchUpdateResult(messageApi, '工序日期', opResult);
      }
    },
    [messageApi]
  );

  const refreshGanttPreservingWorkOrder = useCallback(
    async (scheduledWo: WorkOrderForGantt) => {
      try {
        const res = await workOrderApi.list(buildWorkOrderParams({}, { limit: GANTT_WORK_ORDER_LIMIT }));
        let list = Array.isArray(res) ? res : (res?.data ?? []);
        list = list.filter((wo: WorkOrderForGantt) => isSchedulableWorkOrderStatus(wo.status));
        if (filterWorkOrderIds?.length) {
          const idSet = new Set(filterWorkOrderIds);
          list = list.filter((wo: WorkOrderForGantt) => idSet.has(wo.id));
        }
        const merged = (list as WorkOrderForGantt[]).map((item) =>
          item.id === scheduledWo.id ? mergeApiWorkOrderWithScheduled(item, scheduledWo) : item
        );
        mutateGanttWorkOrders(merged);
      } catch {
        // 保留本地已合并的排产结果
      }
    },
    [buildWorkOrderParams, filterWorkOrderIds, mutateGanttWorkOrders]
  );

  const completeDropWorkOrderToBoard = useCallback(
    async (wo: WorkOrderForGantt) => {
      const boardOrders = ganttWorkOrders.filter(
        (item) => isWorkOrderScheduledOnBoard(item) || item.id === wo.id
      );
      const mergedBoardOrders = boardOrders.map((item) => (item.id === wo.id ? { ...item, ...wo } : item));
      const result = buildScheduleWorkOrderDrop(wo, mergedBoardOrders);
      await persistOperationScheduling(result.operationDateUpdates, result.operationStationUpdates);

      const stationNameById = new Map(
        workstationResources.map((station) => [station.id, station.name])
      );
      const scheduledWo = mergeScheduledWorkOrderIntoBoard(wo, result, stationNameById);

      setSelectedRowKeys([scheduledWo.id]);

      const focusTask = pickFocusOperationTaskId(scheduledWo);
      if (focusTask) {
        setFocusTaskId(focusTask);
      }

      if (result.pendingOperations.length > 0) {
        messageApi.warning(
          `工位已保存，${result.pendingOperations.length} 道工序仍缺工位；${result.operationDateUpdates.length > 0 ? `已排入 ${result.operationDateUpdates.length} 道工序，` : ''}请继续补充`
        );
      } else if (result.operationDateUpdates.length > 0) {
        messageApi.success(`已保存并排入甘特图 ${result.operationDateUpdates.length} 道工序`);
      } else {
        messageApi.success('工位已保存，工序将按工单计划时间展示在甘特图');
      }

      refreshBoardScan();
      actionRef.current?.reload();
      await refreshGanttPreservingWorkOrder(scheduledWo);
    },
    [
      ganttWorkOrders,
      messageApi,
      persistOperationScheduling,
      refreshBoardScan,
      refreshGanttPreservingWorkOrder,
      workstationResources,
    ]
  );

  const openSchedulingPrepModal = useCallback(
    async (wo: WorkOrderForGantt) => {
      setPrepModalLoading(true);
      setPrepModalWorkOrder(wo);
      setPrepModalMissing(getWorkOrderSchedulingPrepContext(wo).missingFields);
      setPrepModalOperationsNeedingStation([]);
      try {
        const fetched = await workOrderApi.getOperations(String(wo.id));
        const rawOps = Array.isArray(fetched)
          ? fetched
          : ((fetched as { operations?: Record<string, unknown>[] })?.operations ?? []);
        const operations = rawOps.map((op) => mapOperationForGantt(op));
        const woWithOps: WorkOrderForGantt = { ...wo, operations };
        setPrepModalWorkOrder(woWithOps);
        setPrepModalMissing(getWorkOrderSchedulingPrepContext(woWithOps).missingFields);
        setPrepModalOperationsNeedingStation(getOperationsForStationPrep(woWithOps));
        setPrepModalOpen(true);
      } catch (e: any) {
        messageApi.error(e?.message || '加载工序失败');
        setPrepModalOpen(false);
        setPrepModalWorkOrder(null);
        setPrepModalMissing([]);
        setPrepModalOperationsNeedingStation([]);
      } finally {
        setPrepModalLoading(false);
      }
    },
    [messageApi]
  );

  const handleDropWorkOrderToBoard = useCallback(
    async (workOrderId: number) => {
      if (!canScheduleUpdate) return;
      const wo = ganttWorkOrders.find((item) => item.id === workOrderId);
      if (!wo) {
        messageApi.warning('未找到该工单');
        return;
      }
      const alreadyOnBoard = isWorkOrderScheduledOnBoard(wo);
      if (alreadyOnBoard && !workOrderNeedsSchedulingPrep(wo)) {
        messageApi.info('该工单已在排产区');
        return;
      }
      if (workOrderNeedsSchedulingPrep(wo)) {
        await openSchedulingPrepModal(wo);
        return;
      }
      try {
        await completeDropWorkOrderToBoard(wo);
      } catch (e: any) {
        messageApi.error(e?.message || '拖入排产失败');
        refreshGantt();
      }
    },
    [
      canScheduleUpdate,
      completeDropWorkOrderToBoard,
      ganttWorkOrders,
      messageApi,
      openSchedulingPrepModal,
      refreshGantt,
    ]
  );

  const handlePrepModalSubmit = useCallback(
    async (values: SchedulingWorkOrderPrepValues) => {
      if (!prepModalWorkOrder) return;
      setPrepModalSaving(true);
      try {
        const needsDateUpdate =
          prepModalMissing.includes('planned_start_date') ||
          prepModalMissing.includes('planned_end_date');
        if (needsDateUpdate && values.planned_start_date && values.planned_end_date) {
          await workOrderApi.update(String(prepModalWorkOrder.id), {
            planned_start_date: values.planned_start_date,
            planned_end_date: values.planned_end_date,
          });
        }

        const stationByOp = new Map(
          values.operationStations.map((item) => [item.operation_id, item.assigned_station_id])
        );
        const dateByOp = new Map(
          values.operationDates.map((item) => [item.operation_id, item])
        );
        const stationNameById = new Map(
          workstationResources.map((station) => [station.id, station.name])
        );
        const updatedOps = (prepModalWorkOrder.operations ?? []).map((op) => {
          if (op.id == null) return op;
          const stationId = stationByOp.get(op.id);
          const datePatch = dateByOp.get(op.id);
          let next = op;
          if (stationId != null) {
            next = {
              ...next,
              assigned_station_id: stationId,
              assigned_station_name: stationNameById.get(stationId) ?? op.assigned_station_name,
            };
          }
          if (datePatch) {
            next = {
              ...next,
              planned_start_date: datePatch.planned_start_date,
              planned_end_date: datePatch.planned_end_date,
            };
          }
          return next;
        });

        const woDatesFromOps = values.operationDates;
        let woPlannedStart = values.planned_start_date ?? prepModalWorkOrder.planned_start_date;
        let woPlannedEnd = values.planned_end_date ?? prepModalWorkOrder.planned_end_date;
        if (woDatesFromOps.length > 0) {
          const starts = woDatesFromOps.map((item) => item.planned_start_date).sort();
          const ends = woDatesFromOps.map((item) => item.planned_end_date).sort();
          woPlannedStart = starts[0];
          woPlannedEnd = ends[ends.length - 1];
        }

        const updatedWo: WorkOrderForGantt = {
          ...prepModalWorkOrder,
          planned_start_date: woPlannedStart,
          planned_end_date: woPlannedEnd,
          operations: updatedOps,
        };

        if (values.operationDates.length > 0 || values.operationStations.length > 0) {
          await persistOperationScheduling(values.operationDates, values.operationStations);
        }

        setSelectedRowKeys([updatedWo.id]);
        const focusTask = pickFocusOperationTaskId(updatedWo);
        if (focusTask) {
          setFocusTaskId(focusTask);
        }
        messageApi.success(`已保存并排入甘特图 ${values.operationDates.length || updatedOps.length} 道工序`);
        refreshBoardScan();
        actionRef.current?.reload();
        await refreshGanttPreservingWorkOrder(updatedWo);

        setPrepModalOpen(false);
        setPrepModalWorkOrder(null);
        setPrepModalMissing([]);
        setPrepModalOperationsNeedingStation([]);
      } catch (e: any) {
        messageApi.error(e?.message || '保存排产信息失败');
      } finally {
        setPrepModalSaving(false);
      }
    },
    [
      messageApi,
      persistOperationScheduling,
      prepModalMissing,
      prepModalWorkOrder,
      refreshBoardScan,
      refreshGanttPreservingWorkOrder,
    ]
  );

  const handleBatchFreeze = useCallback(async () => {
    if (selectedWorkOrderIds.length === 0) return;
    setBatchActionLoading(true);
    try {
      await Promise.all(
        selectedWorkOrderIds.slice(0, 50).map((id) => workOrderApi.freeze(String(id), { freeze_reason: '可视排产锁定' }))
      );
      messageApi.success('已批量冻结选中工单');
      refreshGantt();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '批量冻结失败');
    } finally {
      setBatchActionLoading(false);
    }
  }, [messageApi, refreshGantt, selectedWorkOrderIds]);

  const handleBatchUnfreeze = useCallback(async () => {
    if (selectedWorkOrderIds.length === 0) return;
    setBatchActionLoading(true);
    try {
      await Promise.all(selectedWorkOrderIds.slice(0, 50).map((id) => workOrderApi.unfreeze(String(id))));
      messageApi.success('已批量解冻选中工单');
      refreshGantt();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '批量解冻失败');
    } finally {
      setBatchActionLoading(false);
    }
  }, [messageApi, refreshGantt, selectedWorkOrderIds]);

  const handleRefreshAll = useCallback(() => {
    refreshGantt();
    refreshBoardScan();
    refreshPlanReliability();
  }, [refreshBoardScan, refreshGantt, refreshPlanReliability]);

  const columns: ProColumns<WorkOrderForGantt>[] = [
    { title: '工单编号', dataIndex: 'code', width: 130, ellipsis: true, fixed: 'left' },
    {
      title: '工序数',
      width: 64,
      align: 'center',
      render: (_: unknown, record) => {
        const count = countWorkOrderOperations(record);
        return count > 0 ? count : <Typography.Text type="secondary">0</Typography.Text>;
      },
    },
    {
      title: '已排工序数',
      width: 88,
      align: 'center',
      render: (_: unknown, record) => {
        const total = countWorkOrderOperations(record);
        const scheduled = countScheduledOperations(record);
        if (total <= 0) {
          return <Typography.Text type="secondary">0</Typography.Text>;
        }
        const label = String(scheduled);
        if (scheduled >= total) {
          return (
            <Tooltip title={`${scheduled}/${total} 道工序已排产`}>
              <Typography.Text>{label}</Typography.Text>
            </Tooltip>
          );
        }
        return (
          <Tooltip title={`${scheduled}/${total} 道工序已排产`}>
            <Typography.Text type={scheduled > 0 ? undefined : 'secondary'}>{label}</Typography.Text>
          </Tooltip>
        );
      },
    },
    { title: '产品名称', dataIndex: 'product_name', width: 120, ellipsis: true },
    { title: '数量', dataIndex: 'quantity', width: 72, align: 'right' },
    { title: '计划开始时间', dataIndex: 'planned_start_date', valueType: 'dateTime', width: 148 },
    { title: '计划结束时间', dataIndex: 'planned_end_date', valueType: 'dateTime', width: 148 },
    {
      title: '逾期',
      width: 72,
      align: 'center',
      render: (_: unknown, record) => {
        if (!record.planned_end_date) return <Typography.Text type="secondary">—</Typography.Text>;
        const overdue = dayjs(record.planned_end_date).isBefore(dayjs());
        return overdue ? <Tag color="error">逾期</Tag> : <Typography.Text type="secondary">—</Typography.Text>;
      },
    },
    {
      title: '排产问题',
      width: 180,
      ellipsis: true,
      render: (_: unknown, record) => {
        const issues = workOrderDiagnosticsById.get(record.id);
        if (!issues?.length) {
          return <Typography.Text type="secondary">—</Typography.Text>;
        }
        const visible = issues.slice(0, 2);
        const rest = issues.length - visible.length;
        const tooltip = issues.map((item) => item.label).join('；');
        return (
          <Tooltip title={tooltip}>
            <Space size={4} wrap>
              {visible.map((item) => (
                <Tag key={item.key} color={item.severity === 'error' ? 'error' : 'warning'}>
                  {item.label}
                </Tag>
              ))}
              {rest > 0 ? <Tag>+{rest}</Tag> : null}
            </Space>
          </Tooltip>
        );
      },
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
        const colorMap: Record<string, string> = { urgent: 'red', high: 'orange', normal: 'blue', low: 'default' };
        const textMap: Record<string, string> = { urgent: '紧急', high: '高', normal: '普通', low: '低' };
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
      },
    },
  ];

  const ganttToolbarNodes = buildSchedulingGanttToolbar({
    ganttViewMode,
    resourceViewStats,
    shiftDays,
    selectedWorkOrderCount: selectedWorkOrderIds.length,
    selectedOperationCount,
    batchActionLoading,
    canUpdate: canScheduleUpdate,
    draftMode,
    draftPendingCount,
    onDraftModeChange: (on) => {
      if (!on && draftPendingCount > 0) {
        modal.confirm({
          title: '关闭暂存模式',
          content: `仍有 ${draftPendingCount} 项未应用更改，关闭将丢弃本地暂存。`,
          okText: '丢弃并关闭',
          cancelText: '取消',
          onOk: () => {
            draftWoUpdatesRef.current.clear();
            draftOpUpdatesRef.current.clear();
            undoStackRef.current = [];
            syncDraftPendingCount();
            setDraftMode(false);
            refreshGantt();
          },
        });
        return;
      }
      setDraftMode(on);
    },
    onApplyDraft: handleApplyDraft,
    onUndoDraft: handleUndoDraft,
    onRefresh: handleRefreshAll,
    onOpenConfig: () => setConfigDrawerOpen(true),
    onBatchFreeze: handleBatchFreeze,
    onBatchUnfreeze: handleBatchUnfreeze,
    onBatchShift: handleBatchShift,
    onShiftDaysChange: setShiftDays,
    onViewModeChange: setGanttViewMode,
    onScrollToToday: () => setScrollToTodayToken((n) => n + 1),
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
            // ignore
          }
        }}
        placement="left"
        steps={[
          {
            title: '建议全屏排产',
            description: '拖拽甘特条调整计划 → 查看冲突与负荷 → 冻结锁定本周计划。',
            target: () => document.querySelector('.uni-tabs-fullscreen-button') as HTMLElement,
          },
        ]}
      />
      <SchedulingHeaderBand
        constraints={schedulingConstraints}
        selectedWorkOrderCount={selectedWorkOrderIds.length}
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
          title={`已从协调中心带入 ${filterWorkOrderIds.length} 个工单进行可视排产`}
          action={
            <Button size="small" onClick={() => navigate('/apps/kuaizhizao/plan-management/dashboard')}>
              返回协调中心
            </Button>
          }
        />
      ) : null}
      {filterPlanDate ? (
        <Alert
          type="info"
          showIcon
          closable
          style={{ marginBottom: 12 }}
          title={`已按滚动计划日 ${filterPlanDate} 过滤待排池`}
          action={
            <Button
              size="small"
              onClick={() => navigate(`/apps/kuaizhizao/plan-management/rolling-scheduling?plan_date=${filterPlanDate}`)}
            >
              返回滚动计划
            </Button>
          }
        />
      ) : null}
      {ganttWorkOrders.length >= GANTT_WORK_ORDER_LIMIT && !filterWorkOrderIds?.length ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`甘特图仅展示前 ${GANTT_WORK_ORDER_LIMIT} 条工单，请用筛选或深链缩小范围`}
        />
      ) : null}
      <div className="aps-main-layout">
        <div className="aps-block aps-block-gantt">
          <Card className="aps-gantt-card-compact" style={{ marginTop: 8 }} title={ganttToolbarNodes.title} extra={ganttToolbarNodes.extra}>
            <SchedulingBoardDropZone canUpdate={canScheduleUpdate} onDropWorkOrder={handleDropWorkOrderToBoard}>
              <Suspense
                fallback={
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48, gap: 16 }}>
                    <Spin size="large" />
                    <div style={{ color: 'var(--ant-color-primary)' }}>加载甘特图…</div>
                  </div>
                }
              >
                <GanttSchedulingChart
                  workOrders={ganttBoardWorkOrders}
                  workstations={workstationResources}
                  loading={ganttLoading}
                  viewMode={ganttViewMode}
                  taskLevel={GANTT_TASK_LEVEL}
                  freezeHorizonDays={schedulingConstraints.freeze_horizon_days}
                  focusTaskId={focusTaskId}
                  onFocusTaskConsumed={handleFocusTaskConsumed}
                  scrollToTodayToken={scrollToTodayToken}
                  onViewModeChange={setGanttViewMode}
                  onBatchUpdate={canScheduleUpdate ? handleGanttBatchUpdate : undefined}
                  onBatchUpdateOperations={canScheduleUpdate ? handleGanttBatchUpdateOperations : undefined}
                  onBatchUpdateOperationStations={
                    canScheduleUpdate ? handleBatchUpdateOperationStations : undefined
                  }
                  onWorkOrderSelect={handleGanttWorkOrderSelect}
                  onRefresh={refreshGantt}
                  canUpdate={canScheduleUpdate}
                  nonDraggableTaskIds={nonDraggableTaskIds}
                  onBlockedDragAttempt={(taskId) => {
                    const text = String(taskId);
                    if (text === lastBlockedTaskId) return;
                    setLastBlockedTaskId(text);
                    messageApi.warning('冻结窗内或已冻结工单禁止拖拽，请先解冻或移出冻结窗');
                  }}
                />
              </Suspense>
            </SchedulingBoardDropZone>
            <div className="scheduling-pending-pool aps-pool-card-compact">
              <div className="scheduling-pending-pool__main">
                <span className="scheduling-pending-pool__title-wrap">
                  <Typography.Text strong className="scheduling-pending-pool__title">
                    待排工单区
                  </Typography.Text>
                  <span className="scheduling-pending-pool__count" aria-label={`共 ${poolWorkOrders.length} 条`}>
                    {poolWorkOrders.length}
                  </span>
                </span>
                {canScheduleUpdate ? (
                  <>
                    <Typography.Text type="secondary" className="scheduling-pending-pool__hint">
                      拖拽工单至上方排产区；排产问题列中的缺项可通过补充排产对话框填写
                    </Typography.Text>
                    <span className="scheduling-pending-pool__sep" aria-hidden>
                      ·
                    </span>
                  </>
                ) : null}
              </div>
              <ConfigProvider theme={SCHEDULING_POOL_TABLE_THEME}>
                <UniTable
                  columnPersistenceId="apps.kuaizhizao.pages.plan-management.scheduling.pool"
                  embedded
                  bordered
                  actionRef={actionRef}
                  rowKey="id"
                  columns={columns}
                  showFuzzySearch={false}
                  showAdvancedSearch={false}
                  viewTypes={['table']}
                  pagination={{ size: 'small' }}
                  headerActions={
                    <SchedulingPoolToolbar
                      keyword={poolKeyword}
                      statusFilter={poolStatusFilter}
                      selectedCount={selectedWorkOrderIds.length}
                      canUpdate={canScheduleUpdate}
                      actionLoading={quickActionLoading}
                      onKeywordChange={setPoolKeyword}
                      onStatusFilterChange={setPoolStatusFilter}
                      onSearch={handlePoolSearch}
                      onReset={handlePoolReset}
                      onConfirmDelay={handleConfirmDelay}
                      onToException={handleToException}
                      onApplyUnfreeze={handleApplyUnfreeze}
                    />
                  }
                  request={async (params: any) => {
                    const list = poolWorkOrdersRef.current;
                    const pageSize = params.pageSize ?? 20;
                    const skip = ((params.current ?? 1) - 1) * pageSize;
                    return {
                      data: list.slice(skip, skip + pageSize),
                      success: true,
                      total: list.length,
                    };
                  }}
                  rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => {
                      setSelectedRowKeys(keys);
                      setFocusTaskId(null);
                    },
                  }}
                  onRow={(record) => ({
                    draggable: canScheduleUpdate,
                    onDragStart: (e) => {
                      if (!canScheduleUpdate) return;
                      e.dataTransfer.setData(SCHEDULING_DRAG_WORK_ORDER, String(record.id));
                      e.dataTransfer.effectAllowed = 'move';
                    },
                  })}
                  rowClassName={(record) => {
                    const classes: string[] = [];
                    if (canScheduleUpdate) classes.push('scheduling-pool-row--draggable');
                    if (workOrderDiagnosticsById.has(record.id)) {
                      classes.push('scheduling-pool-row--has-issues');
                    }
                    const rate = record.readiness_rate;
                    if (rate != null && Number(rate) < 100 && schedulingConstraints.consider_material) {
                      classes.push('scheduling-row-material-risk');
                    }
                    return classes.join(' ');
                  }}
                />
              </ConfigProvider>
            </div>
          </Card>
        </div>
      </div>

      <SchedulingWorkOrderPrepModal
        open={prepModalOpen}
        workOrder={prepModalWorkOrder}
        missingFields={prepModalMissing}
        operationsNeedingStation={prepModalOperationsNeedingStation}
        workstations={workstationResources}
        workCenters={schedulingWorkCenters}
        loading={prepModalSaving || prepModalLoading}
        onCancel={() => {
          setPrepModalOpen(false);
          setPrepModalWorkOrder(null);
          setPrepModalMissing([]);
          setPrepModalOperationsNeedingStation([]);
        }}
        onSubmit={handlePrepModalSubmit}
      />

      <Modal
        title="可视排产设置"
        width={400}
        open={configDrawerOpen}
        onCancel={() => setConfigDrawerOpen(false)}
        footer={
          <Space>
            <Button
              onClick={() => {
                setSchedulingConstraints(DEFAULT_SCHEDULING_CONSTRAINTS);
              }}
            >
              恢复默认
            </Button>
            <Button
              type="primary"
              loading={configSaving}
              disabled={!canScheduleUpdate}
              onClick={async () => {
                try {
                  setConfigSaving(true);
                  await schedulingConfigApi.upsertDefault(pickVisualSchedulingConstraints(schedulingConstraints));
                  messageApi.success('排产设置已保存');
                  setConfigDrawerOpen(false);
                  refreshBoardScan();
                } catch (e: any) {
                  messageApi.error(e?.message || '保存失败');
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
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>冻结窗口（天）</span>
              <InputNumber
                size="small"
                min={0}
                max={30}
                value={schedulingConstraints.freeze_horizon_days}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({ ...c, freeze_horizon_days: Number(v ?? 2) }))
                }
              />
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: -8 }}>
              窗口内工单不可拖拽调整，甘特图左侧紫色区域为冻结窗
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>诊断扫描范围（天）</span>
              <InputNumber
                size="small"
                min={1}
                max={120}
                value={schedulingConstraints.rolling_horizon_days}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({ ...c, rolling_horizon_days: Number(v || 14) }))
                }
              />
            </div>
            <Divider style={{ margin: '4px 0' }} />
            <div style={{ fontWeight: 500 }}>拖拽校验（冲突检测）</div>
            {(['consider_human', 'consider_equipment', 'consider_material', 'consider_mold_tool'] as const).map((key) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {key === 'consider_human' && '工位时间重叠'}
                  {key === 'consider_equipment' && '设备时间重叠'}
                  {key === 'consider_material' && '缺料齐套提示'}
                  {key === 'consider_mold_tool' && '模具/工装重叠'}
                </span>
                <Switch
                  checked={schedulingConstraints[key]}
                  onChange={(v) => setSchedulingConstraints((c) => ({ ...c, [key]: v }))}
                />
              </div>
            ))}
          </Space>
        </div>
      </Modal>
    </ListPageTemplate>
  );
};

export default SchedulingPage;
