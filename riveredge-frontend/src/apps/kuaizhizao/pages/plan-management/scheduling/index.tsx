/**
 * 可视排产页面
 *
 * 基于甘特图拖拽调整工单/工序计划时间；待排工单区展示全部可排工单及排产问题。
 * MRP/LRP 运算请前往「需求计算」页面。
 */

import React, { useRef, useState, useCallback, lazy, Suspense, useMemo, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Card, Modal, Switch, Spin, Typography, Alert, InputNumber, Divider, Tour, ConfigProvider, Tooltip, Table, Select } from 'antd';
import type { ThemeConfig } from 'antd/es/theme/interface';
import { useRequest } from 'ahooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import {
  workOrderApi,
  schedulingConfigApi,
  visualSchedulingApi,
  SchedulingConstraints,
  VisualSchedulingBoardScan,
  VisualSchedulingMissingSetting,
} from '../../../services/production';
import { mesDashboardService } from '../../../services/dashboard';
import { rollingSchedulingApi } from '../../../services/rolling-scheduling';
import type { ViewMode, WorkOrderForGantt, WorkstationResource } from '../../../components/GanttSchedulingChart/types';
import { stationResourceId } from '../../../components/GanttSchedulingChart/stationResourceUtils';
import { factoryListItems, workstationApi, workCenterApi } from '../../../../master-data/services/factory';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { ROUTES } from '../../../constants/routes';
import dayjs from 'dayjs';
import {formatDateTime, formatQuantity} from '../../../../../utils/format';
import SchedulingHeaderBand from './components/SchedulingHeaderBand';
import SchedulingBoardDropZone from './components/SchedulingBoardDropZone';
import { collectWorkOrderDiagnosticIssues } from './components/schedulingPoolDiagnostics';
import SchedulingPoolToolbar from './components/SchedulingPoolToolbar';
import SchedulingWorkOrderPrepModal, {
  type SchedulingWorkOrderPrepValues,
} from './components/SchedulingWorkOrderPrepModal';
import SchedulingOperationEditDrawer, {
  type SchedulingOperationEditContext,
} from './components/SchedulingOperationEditDrawer';
import { convertEngineProposalToAiProposal } from './convertEngineProposal';
import { applySchedulingAiProposal } from './applySchedulingAiProposal';
import buildSchedulingGanttToolbar from './components/SchedulingGanttToolbar';
import {
  SchedulingAiAssistantDrawer,
  SchedulingAiAssistantTrigger,
} from './components/SchedulingAiAssistantDrawer';
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
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { searchUserDisplay } from '../../../../../services/user';
import { displayItemsToUsers } from '../../../../../utils/userDisplay';
import { getEquipmentList } from '../../../../../services/equipment';
import { getMoldList } from '../../../../../services/mold';
import { toApiDateTimeString } from '../../../../../utils/formDate';
const GANTT_WORK_ORDER_LIMIT = 500;

const GANTT_TASK_LEVEL = 'station' as const;

/** 待排表格统一字号；行高沿用改字体前的 Table token（与甘特图 32px 行对齐） */
const SCHEDULING_POOL_FONT_SIZE = 13;
const SCHEDULING_POOL_ROW_HEIGHT = 32;

const SCHEDULING_POOL_TABLE_THEME: ThemeConfig = {
  components: {
    Table: {
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
  setup_changeover_hours: 1,
  schedule_mode: 'forward',
  material_hard_constraint: false,
};

function pickVisualSchedulingConstraints(constraints: SchedulingConstraints): SchedulingConstraints {
  return {
    consider_human: constraints.consider_human,
    consider_equipment: constraints.consider_equipment,
    consider_material: constraints.consider_material,
    consider_mold_tool: constraints.consider_mold_tool,
    freeze_horizon_days: constraints.freeze_horizon_days ?? 2,
    rolling_horizon_days: constraints.rolling_horizon_days ?? 14,
    setup_changeover_hours: constraints.setup_changeover_hours ?? 1,
    schedule_mode: constraints.schedule_mode === 'backward' ? 'backward' : 'forward',
    material_hard_constraint: Boolean(constraints.material_hard_constraint),
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

function applyOperationStationUpdates(
  list: WorkOrderForGantt[],
  updates: Array<{ operation_id: number; assigned_station_id: number }>
): WorkOrderForGantt[] {
  if (updates.length === 0) return list;
  const byOpId = new Map(updates.map((u) => [u.operation_id, u.assigned_station_id]));
  return list.map((wo) => {
    if (!wo.operations?.length) return wo;
    let changed = false;
    const operations = wo.operations.map((op) => {
      const opId = op.id;
      if (opId == null) return op;
      const stationId = byOpId.get(opId);
      if (stationId == null) return op;
      changed = true;
      return { ...op, assigned_station_id: stationId };
    });
    return changed ? { ...wo, operations } : wo;
  });
}

const SchedulingPage: React.FC = () => {
  const { t } = useTranslation();
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
  const [poolOverdueOnly, setPoolOverdueOnly] = useState(false);
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
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiSuggestedPoolOrderIds, setAiSuggestedPoolOrderIds] = useState<number[]>([]);
  const [autoRescheduleLoading, setAutoRescheduleLoading] = useState(false);
  const [missingSettingsModalOpen, setMissingSettingsModalOpen] = useState(false);
  const [missingSettingsRows, setMissingSettingsRows] = useState<
    Array<{
      operation_id: number;
      work_order_id: number;
      work_order_code: string;
      operation_name: string;
      work_center_id?: number | null;
      needHours: boolean;
      needStation: boolean;
      setup_time: number | null;
      standard_time: number | null;
      assigned_station_id: number | null;
    }>
  >([]);
  const [missingSettingsSaving, setMissingSettingsSaving] = useState(false);
  const [pendingAutoRescheduleIds, setPendingAutoRescheduleIds] = useState<number[] | null>(null);
  const [operationEditContext, setOperationEditContext] = useState<SchedulingOperationEditContext | null>(null);
  const [operationEditOpen, setOperationEditOpen] = useState(false);
  const [schedulingWorkers, setSchedulingWorkers] = useState<Array<{ id: number; name: string; code?: string }>>([]);
  const [schedulingEquipments, setSchedulingEquipments] = useState<Array<{ id: number; name: string; code?: string }>>([]);
  const [schedulingMolds, setSchedulingMolds] = useState<Array<{ id: number; name: string; code?: string }>>([]);
  const draftWoUpdatesRef = useRef(
    new Map<number, { work_order_id: number; planned_start_date: string; planned_end_date: string }>()
  );
  const draftOpUpdatesRef = useRef(
    new Map<number, { operation_id: number; planned_start_date: string; planned_end_date: string }>()
  );
  const draftStationUpdatesRef = useRef(
    new Map<number, { operation_id: number; assigned_station_id: number }>()
  );
  const undoStackRef = useRef<WorkOrderForGantt[][]>([]);
  const schedulingPerms = useResourcePermissions('kuaizhizao:plan-management-scheduling');
  const canScheduleUpdate = schedulingPerms.canUpdate;

  const syncDraftPendingCount = useCallback(() => {
    setDraftPendingCount(
      draftWoUpdatesRef.current.size + draftOpUpdatesRef.current.size + draftStationUpdatesRef.current.size
    );
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
  }, [poolAppliedKeyword, poolStatusFilter, poolOverdueOnly]);

  useEffect(() => {
    let cancelled = false;
    const loadResources = async () => {
      try {
        const [usersRes, equipmentRes, moldsRes] = await Promise.all([
          searchUserDisplay({ is_active: true, page_size: 200 }).catch(() => ({ items: [] })),
          getEquipmentList({ is_active: true, limit: 200 }).catch(() => ({ items: [] })),
          getMoldList({ is_active: true, limit: 200 }).catch(() => ({ items: [] })),
        ]);
        if (cancelled) return;
        const users = displayItemsToUsers(usersRes?.items || []);
        setSchedulingWorkers(
          users.map((u) => ({
            id: Number(u.id),
            name: String(u.full_name || u.username || u.id),
            code: u.username,
          }))
        );
        setSchedulingEquipments(
          (equipmentRes?.items || []).map((item: any) => ({
            id: Number(item.id),
            name: String(item.name || item.id),
            code: item.code,
          }))
        );
        setSchedulingMolds(
          (moldsRes?.items || []).map((item: any) => ({
            id: Number(item.id),
            name: String(item.name || item.id),
            code: item.code,
          }))
        );
      } catch {
        if (!cancelled) {
          setSchedulingWorkers([]);
          setSchedulingEquipments([]);
          setSchedulingMolds([]);
        }
      }
    };
    void loadResources();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePoolSearch = useCallback(() => {
    setPoolAppliedKeyword(poolKeyword.trim());
  }, [poolKeyword]);

  const handlePoolReset = useCallback(() => {
    setPoolKeyword('');
    setPoolAppliedKeyword('');
    setPoolStatusFilter('all');
    setPoolOverdueOnly(false);
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
            formatDateTime(wo.planned_start_date, 'YYYY-MM-DD') === filterPlanDate,
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
      ganttWorkOrders.filter((wo) => {
        if (poolStatusFilter !== 'all' && wo.status !== poolStatusFilter) return false;
        if (poolOverdueOnly) {
          if (!wo.planned_end_date || !dayjs(wo.planned_end_date).isBefore(dayjs())) return false;
        }
        return matchesPoolKeyword(wo, poolAppliedKeyword);
      }),
    [ganttWorkOrders, poolAppliedKeyword, poolOverdueOnly, poolStatusFilter]
  );

  const workOrderDiagnosticsById = useMemo(() => {
    const map = new Map<number, ReturnType<typeof collectWorkOrderDiagnosticIssues>>();
    for (const wo of ganttWorkOrders) {
      const issues = collectWorkOrderDiagnosticIssues(wo, boardScan, t);
      if (issues.length > 0) map.set(wo.id, issues);
    }
    return map;
  }, [boardScan, ganttWorkOrders, t]);

  const poolWorkOrderIds = useMemo(
    () => poolWorkOrders.map((wo) => wo.id),
    [poolWorkOrders]
  );

  const aiSuggestedPoolRankById = useMemo(() => {
    const map = new Map<number, number>();
    aiSuggestedPoolOrderIds.forEach((id, index) => map.set(id, index + 1));
    return map;
  }, [aiSuggestedPoolOrderIds]);

  const handleAiSelectSuggested = useCallback((order: number[]) => {
    setSelectedRowKeys(order);
    setAiSuggestedPoolOrderIds(order);
    setFocusTaskId(null);
  }, []);

  const handleAiSelectOverdue = useCallback(() => {
    const overdueIds = poolWorkOrders
      .filter((wo) => wo.planned_end_date && dayjs(wo.planned_end_date).isBefore(dayjs()))
      .map((wo) => wo.id);
    setSelectedRowKeys(overdueIds);
    setFocusTaskId(null);
    if (overdueIds.length === 0) {
      messageApi.info(t('app.kuaizhizao.scheduling.aiAssist.noOverdueInPool'));
    }
  }, [messageApi, poolWorkOrders, t]);

  const poolWorkOrdersRef = useRef(poolWorkOrders);
  poolWorkOrdersRef.current = poolWorkOrders;

  const handleAiPoolReorder = useCallback((order: number[]) => {
    setAiSuggestedPoolOrderIds(order);
  }, []);

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

  const buildMissingSettingsRows = useCallback(
    (gaps: VisualSchedulingMissingSetting[]) => {
      const byOp = new Map<
        number,
        {
          operation_id: number;
          work_order_id: number;
          work_order_code: string;
          operation_name: string;
          work_center_id?: number | null;
          needHours: boolean;
          needStation: boolean;
          setup_time: number | null;
          standard_time: number | null;
          assigned_station_id: number | null;
        }
      >();
      for (const gap of gaps) {
        const existing = byOp.get(gap.operation_id) ?? {
          operation_id: gap.operation_id,
          work_order_id: gap.work_order_id,
          work_order_code: gap.work_order_code,
          operation_name: gap.operation_name || String(gap.operation_id),
          work_center_id: gap.work_center_id,
          needHours: false,
          needStation: false,
          setup_time: null as number | null,
          standard_time: null as number | null,
          assigned_station_id: null as number | null,
        };
        if (gap.field === 'setup_time' || gap.field === 'standard_time') {
          existing.needHours = true;
          if (gap.field === 'setup_time') {
            existing.setup_time =
              gap.suggested != null && gap.suggested !== '' ? Number(gap.suggested) : 0;
          }
          if (gap.field === 'standard_time') {
            existing.standard_time =
              gap.suggested != null && gap.suggested !== '' ? Number(gap.suggested) : 1;
          }
        }
        if (gap.field === 'assigned_station_id') {
          existing.needStation = true;
        }
        byOp.set(gap.operation_id, existing);
      }
      return Array.from(byOp.values());
    },
    [],
  );

  const openMissingSettingsModal = useCallback(
    (gaps: VisualSchedulingMissingSetting[], continueAutoRescheduleIds?: number[]) => {
      setMissingSettingsRows(buildMissingSettingsRows(gaps));
      setPendingAutoRescheduleIds(continueAutoRescheduleIds ?? null);
      setMissingSettingsModalOpen(true);
    },
    [buildMissingSettingsRows],
  );

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
        const woLabel = t('app.kuaizhizao.scheduling.batch.label.workOrderDates');
        const opLabel = t('app.kuaizhizao.scheduling.batch.label.operationDates');
        if (woUpdates.length > 0) {
          const woResult = await workOrderApi.batchUpdateDates(woUpdates);
          ensureBatchUpdatesPersisted(woResult, woUpdates.length, woLabel, t);
          reportBatchUpdateResult(messageApi, woLabel, woResult, t);
          mutateGanttWorkOrders((prev) => applyWorkOrderDateUpdates(prev ?? [], woUpdates));
        }
        if (opUpdates.length > 0) {
          const opResult = await workOrderApi.batchUpdateOperationDates(opUpdates);
          ensureBatchUpdatesPersisted(opResult, opUpdates.length, opLabel, t);
          reportBatchUpdateResult(messageApi, opLabel, opResult, t);
          mutateGanttWorkOrders((prev) => applyOperationDateUpdates(prev ?? [], opUpdates));
        }
        if (filterPlanDate) {
          const woIds = new Set<number>(woUpdates.map((u) => u.work_order_id));
          if (opUpdates.length > 0) {
            (ganttWorkOrders || []).forEach((wo) => {
              const opIds = new Set((wo.operations || []).map((o) => o.id));
              if (opUpdates.some((u) => opIds.has(u.operation_id))) {
                woIds.add(wo.id);
              }
            });
          }
          if (woIds.size > 0) {
            await rollingSchedulingApi.syncFromAps({
              plan_date: filterPlanDate,
              work_order_ids: [...woIds],
            });
          }
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
          title: t('app.kuaizhizao.scheduling.msg.conflictTitle'),
          content: (
            <div>
              <p>{t('app.kuaizhizao.scheduling.msg.conflictContent', { count: validation.conflict_count })}</p>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{preview}</pre>
            </div>
          ),
          okText: t('app.kuaizhizao.scheduling.msg.saveAnyway'),
          cancelText: t('common.cancel'),
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
    [
      filterPlanDate,
      ganttWorkOrders,
      messageApi,
      modal,
      mutateGanttWorkOrders,
      refreshBoardScan,
      refreshPlanReliability,
      t,
    ]
  );

  const handleApplyDraft = useCallback(async () => {
    const woUpdates = [...draftWoUpdatesRef.current.values()];
    const opUpdates = [...draftOpUpdatesRef.current.values()];
    const stationUpdates = [...draftStationUpdatesRef.current.values()];
    if (woUpdates.length === 0 && opUpdates.length === 0 && stationUpdates.length === 0) {
      messageApi.info(t('app.kuaizhizao.scheduling.msg.noDraftChanges'));
      return;
    }
    const persistDraft = async () => {
      const woLabel = t('app.kuaizhizao.scheduling.batch.label.workOrderDates');
      const opLabel = t('app.kuaizhizao.scheduling.batch.label.operationDates');
      const stationLabel = t('app.kuaizhizao.scheduling.batch.label.operationStations');
      if (woUpdates.length > 0) {
        const woResult = await workOrderApi.batchUpdateDates(woUpdates);
        ensureBatchUpdatesPersisted(woResult, woUpdates.length, woLabel, t);
        reportBatchUpdateResult(messageApi, woLabel, woResult, t);
        mutateGanttWorkOrders((prev) => applyWorkOrderDateUpdates(prev ?? [], woUpdates));
      }
      if (opUpdates.length > 0) {
        const opResult = await workOrderApi.batchUpdateOperationDates(opUpdates);
        ensureBatchUpdatesPersisted(opResult, opUpdates.length, opLabel, t);
        reportBatchUpdateResult(messageApi, opLabel, opResult, t);
        mutateGanttWorkOrders((prev) => applyOperationDateUpdates(prev ?? [], opUpdates));
      }
      if (stationUpdates.length > 0) {
        const result = await workOrderApi.batchUpdateOperationStations(stationUpdates);
        reportBatchUpdateResult(messageApi, stationLabel, {
          updated: result.updated,
          skipped_frozen: result.skipped_frozen,
          skipped_freeze_window: [],
          failed: result.failed,
        }, t);
        mutateGanttWorkOrders((prev) => applyOperationStationUpdates(prev ?? [], stationUpdates));
      }
      if (filterPlanDate) {
        const woIds = new Set<number>(woUpdates.map((u) => u.work_order_id));
        if (opUpdates.length > 0 || stationUpdates.length > 0) {
          const opIdSet = new Set([
            ...opUpdates.map((u) => u.operation_id),
            ...stationUpdates.map((u) => u.operation_id),
          ]);
          (ganttWorkOrders || []).forEach((wo) => {
            if ((wo.operations || []).some((o) => o.id != null && opIdSet.has(o.id))) {
              woIds.add(wo.id);
            }
          });
        }
        if (woIds.size > 0) {
          await rollingSchedulingApi.syncFromAps({
            plan_date: filterPlanDate,
            work_order_ids: [...woIds],
          });
        }
      }
      actionRef.current?.reload();
      refreshBoardScan();
      refreshPlanReliability();
    };
    try {
      const validation = await visualSchedulingApi.validateAdjustments({
        work_order_updates: woUpdates,
        operation_updates: opUpdates,
        operation_station_updates: stationUpdates,
      });
      if (validation.valid) {
        await persistDraft();
      } else {
        const preview = (validation.conflicts || []).slice(0, 5).map((c) => c.message).join('\n');
        await new Promise<void>((resolve, reject) => {
          modal.confirm({
            title: t('app.kuaizhizao.scheduling.msg.conflictTitle'),
            content: (
              <div>
                <p>{t('app.kuaizhizao.scheduling.msg.conflictContent', { count: validation.conflict_count })}</p>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{preview}</pre>
              </div>
            ),
            okText: t('app.kuaizhizao.scheduling.msg.saveAnyway'),
            cancelText: t('common.cancel'),
            onOk: async () => {
              try {
                await persistDraft();
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            onCancel: () => reject(new Error('cancelled')),
          });
        });
      }
      draftWoUpdatesRef.current.clear();
      draftOpUpdatesRef.current.clear();
      draftStationUpdatesRef.current.clear();
      undoStackRef.current = [];
      syncDraftPendingCount();
      refreshGantt();
    } catch (e: any) {
      if (e?.message !== 'cancelled') {
        messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.applyFailed'));
        refreshGantt();
      }
    }
  }, [
    filterPlanDate,
    ganttWorkOrders,
    messageApi,
    modal,
    mutateGanttWorkOrders,
    refreshBoardScan,
    refreshGantt,
    refreshPlanReliability,
    syncDraftPendingCount,
    t,
  ]);

  const handleUndoDraft = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) {
      messageApi.info(t('app.kuaizhizao.scheduling.msg.noUndoStep'));
      return;
    }
    mutateGanttWorkOrders(prev);
    draftWoUpdatesRef.current.clear();
    draftOpUpdatesRef.current.clear();
    draftStationUpdatesRef.current.clear();
    syncDraftPendingCount();
    messageApi.success(t('app.kuaizhizao.scheduling.msg.undoSuccess'));
  }, [messageApi, mutateGanttWorkOrders, syncDraftPendingCount, t]);

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
          messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.scheduleUpdateFailed'));
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
      t,
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
          messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.operationUpdateFailed'));
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
      t,
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
          planned_start_date: toApiDateTimeString(dayjs(wo.planned_start_date).add(days, 'day')),
          planned_end_date: toApiDateTimeString(dayjs(wo.planned_end_date).add(days, 'day')),
        }));
      if (updates.length === 0) {
        messageApi.warning(t('app.kuaizhizao.scheduling.msg.batchShiftNoValid'));
        return;
      }
      setBatchActionLoading(true);
      try {
        await confirmAndPersist(updates, []);
        refreshGantt();
      } catch (e: any) {
        if (e?.message !== 'cancelled') messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.batchShiftFailed'));
      } finally {
        setBatchActionLoading(false);
      }
    },
    [confirmAndPersist, freezeAnchor, ganttWorkOrders, messageApi, refreshGantt, schedulingConstraints.freeze_horizon_days, selectedWorkOrderIds, t]
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
          messageApi.error(preview || t('app.kuaizhizao.scheduling.msg.stationValidationFailed'));
          refreshGantt();
          return;
        }
        const result = await workOrderApi.batchUpdateOperationStations(updates);
        const stationLabel = t('app.kuaizhizao.scheduling.batch.label.operationStations');
        reportBatchUpdateResult(messageApi, stationLabel, {
          updated: result.updated,
          skipped_frozen: result.skipped_frozen,
          skipped_freeze_window: [],
          failed: result.failed,
        }, t);
        refreshGantt();
        refreshBoardScan();
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.stationReassignFailed'));
        refreshGantt();
      }
    },
    [canScheduleUpdate, messageApi, refreshBoardScan, refreshGantt, t]
  );

  const handleSchedulingQuickAction = useCallback(
    async (
      action: 'confirm_delay' | 'to_exception' | 'apply_unfreeze',
      _title: string,
      reason: string,
      successPrefix: string,
    ) => {
      if (!canScheduleUpdate || selectedWorkOrderIds.length === 0) return;
      const ids = selectedWorkOrderIds.slice(0, 50);
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
          t('app.kuaizhizao.scheduling.msg.quickActionResult', {
            prefix: successPrefix,
            updated: updatedCount,
            converted: convertedCount,
            unfreezed: unfreezedCount,
            skipped: skippedCount,
            failedPart:
              failCount > 0
                ? t('app.kuaizhizao.scheduling.msg.quickActionResultFailed', { count: failCount })
                : '',
          })
        );
        refreshGantt();
        refreshBoardScan();
    actionRef.current?.reload();
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.quickActionFailed'));
      } finally {
        setQuickActionLoading(false);
      }
    },
    [canScheduleUpdate, messageApi, refreshBoardScan, refreshGantt, selectedWorkOrderIds, t]
  );

  const handleConfirmDelay = useCallback(async () => {
    await handleSchedulingQuickAction(
      'confirm_delay',
      t('app.kuaizhizao.scheduling.msg.confirmDelayTitle'),
      t('app.kuaizhizao.scheduling.msg.confirmDelayReason'),
      t('app.kuaizhizao.scheduling.msg.confirmDelaySuccess')
    );
  }, [handleSchedulingQuickAction, t]);

  const handleToException = useCallback(async () => {
    await handleSchedulingQuickAction(
      'to_exception',
      t('app.kuaizhizao.scheduling.msg.toExceptionTitle'),
      t('app.kuaizhizao.scheduling.msg.toExceptionReason'),
      t('app.kuaizhizao.scheduling.msg.toExceptionSuccess')
    );
  }, [handleSchedulingQuickAction, t]);

  const handleApplyUnfreeze = useCallback(async () => {
    await handleSchedulingQuickAction(
      'apply_unfreeze',
      t('app.kuaizhizao.scheduling.msg.applyUnfreezeTitle'),
      t('app.kuaizhizao.scheduling.msg.applyUnfreezeReason'),
      t('app.kuaizhizao.scheduling.msg.applyUnfreezeSuccess')
    );
  }, [handleSchedulingQuickAction, t]);

  const applyEngineProposalToDraft = useCallback(
    async (scope: 'selected' | 'overdue' | 'unscheduled', workOrderIds: number[]) => {
      if (!canScheduleUpdate || workOrderIds.length === 0) return false;
      setAutoRescheduleLoading(true);
      try {
        const res = await visualSchedulingApi.autoReschedule({
          work_order_ids: workOrderIds,
          scope,
          plan_date: filterPlanDate,
        });
        const proposal = convertEngineProposalToAiProposal(res.proposal);
        if ((res.proposal.unfreezed?.length ?? 0) > 0) {
          refreshGantt();
        }
        if (proposal.warnings.length > 0) {
          messageApi.info(proposal.warnings.slice(0, 3).join('；'));
        }
        return applySchedulingAiProposal({
          proposal,
          draftWoUpdatesRef,
          draftOpUpdatesRef,
          draftStationUpdatesRef,
          mutateGanttWorkOrders,
          pushUndoSnapshot,
          syncDraftPendingCount,
          setDraftMode,
          message: messageApi,
          t,
        });
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.autoRescheduleFailed'));
        return false;
      } finally {
        setAutoRescheduleLoading(false);
      }
    },
    [
      canScheduleUpdate,
      draftOpUpdatesRef,
      draftStationUpdatesRef,
      draftWoUpdatesRef,
      filterPlanDate,
      messageApi,
      mutateGanttWorkOrders,
      pushUndoSnapshot,
      refreshGantt,
      syncDraftPendingCount,
      t,
    ]
  );

  const handleAutoReschedule = useCallback(async () => {
    const ids = selectedWorkOrderIds.slice(0, 50);
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const relatedGaps = (boardScan?.missing_settings ?? []).filter((g) => idSet.has(g.work_order_id));
    if (relatedGaps.length > 0) {
      openMissingSettingsModal(relatedGaps, ids);
      return;
    }
    await applyEngineProposalToDraft('selected', ids);
  }, [applyEngineProposalToDraft, boardScan?.missing_settings, openMissingSettingsModal, selectedWorkOrderIds]);

  const handleMissingSettingsBackfill = useCallback(async () => {
    if (!canScheduleUpdate) return;
    for (const row of missingSettingsRows) {
      if (row.needHours) {
        const setup = Number(row.setup_time ?? 0);
        const std = Number(row.standard_time ?? 0);
        if (!(setup > 0 || std > 0)) {
          messageApi.warning(
            t('app.kuaizhizao.scheduling.msg.missingHoursRequired', {
              code: row.work_order_code,
              op: row.operation_name,
            }),
          );
          return;
        }
      }
      if (row.needStation && !(Number(row.assigned_station_id) > 0)) {
        messageApi.warning(
          t('app.kuaizhizao.scheduling.msg.missingStationRequired', {
            code: row.work_order_code,
            op: row.operation_name,
          }),
        );
        return;
      }
    }
    setMissingSettingsSaving(true);
    try {
      const items = missingSettingsRows.map((row) => {
        const patch: {
          operation_id: number;
          setup_time?: number;
          standard_time?: number;
          assigned_station_id?: number;
        } = { operation_id: row.operation_id };
        if (row.needHours) {
          patch.setup_time = Number(row.setup_time ?? 0);
          patch.standard_time = Number(row.standard_time ?? 0);
        }
        if (row.needStation && row.assigned_station_id) {
          patch.assigned_station_id = Number(row.assigned_station_id);
        }
        return patch;
      });
      await visualSchedulingApi.backfillOperationSettings(items);
      messageApi.success(t('app.kuaizhizao.scheduling.msg.missingBackfillSuccess'));
      setMissingSettingsModalOpen(false);
      refreshGantt();
      refreshBoardScan();
      const continueIds = pendingAutoRescheduleIds;
      setPendingAutoRescheduleIds(null);
      if (continueIds?.length) {
        await applyEngineProposalToDraft('selected', continueIds);
      }
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || e?.message || t('app.kuaizhizao.scheduling.msg.missingBackfillFailed'));
    } finally {
      setMissingSettingsSaving(false);
    }
  }, [
    applyEngineProposalToDraft,
    canScheduleUpdate,
    messageApi,
    missingSettingsRows,
    pendingAutoRescheduleIds,
    refreshBoardScan,
    refreshGantt,
    t,
  ]);

  const handleRescheduleForward = useCallback(async () => {
    const ids = selectedWorkOrderIds.slice(0, 50);
    if (ids.length === 0) return;
    await applyEngineProposalToDraft('overdue', ids);
  }, [applyEngineProposalToDraft, selectedWorkOrderIds]);

  const handleGanttOperationSelect = useCallback(
    (operationId: number, workOrderId: number | null) => {
      if (!workOrderId) return;
      const wo = ganttWorkOrders.find((item) => item.id === workOrderId);
      if (!wo) return;
      setOperationEditContext({ workOrder: wo, operationId });
    },
    [ganttWorkOrders]
  );

  const handleGanttOperationDoubleClick = useCallback(
    (operationId: number, workOrderId: number | null) => {
      if (!workOrderId) return;
      const wo = ganttBoardWorkOrders.find((item) => item.id === workOrderId)
        ?? ganttWorkOrders.find((item) => item.id === workOrderId);
      if (!wo) return;
      setOperationEditContext({ workOrder: wo, operationId });
      setOperationEditOpen(true);
    },
    [ganttBoardWorkOrders, ganttWorkOrders]
  );

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
          throw new Error(preview || t('app.kuaizhizao.scheduling.msg.validationFailed'));
        }
        const stationResult = await workOrderApi.batchUpdateOperationStations(operationStationUpdates);
        const stationLabel = t('app.kuaizhizao.scheduling.batch.label.operationStations');
        ensureBatchUpdatesPersisted(
          {
            updated: stationResult.updated,
            skipped_frozen: stationResult.skipped_frozen,
            skipped_freeze_window: [],
            failed: stationResult.failed,
          },
          operationStationUpdates.length,
          stationLabel,
          t
        );
        reportBatchUpdateResult(messageApi, stationLabel, {
          updated: stationResult.updated,
          skipped_frozen: stationResult.skipped_frozen,
          skipped_freeze_window: [],
          failed: stationResult.failed,
        }, t);
      }
      if (operationDateUpdates.length > 0) {
        const validation = await visualSchedulingApi.validateAdjustments({
          operation_updates: operationDateUpdates,
        });
        if (!validation.valid) {
          const preview = (validation.conflicts || []).slice(0, 3).map((c) => c.message).join('\n');
          throw new Error(preview || t('app.kuaizhizao.scheduling.msg.validationFailed'));
        }
        const opLabel = t('app.kuaizhizao.scheduling.batch.label.operationDates');
        const opResult = await workOrderApi.batchUpdateOperationDates(operationDateUpdates);
        ensureBatchUpdatesPersisted(opResult, operationDateUpdates.length, opLabel, t);
        reportBatchUpdateResult(messageApi, opLabel, opResult, t);
      }
    },
    [messageApi, t]
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
          t('app.kuaizhizao.scheduling.msg.stationsSavedPending', {
            pending: result.pendingOperations.length,
            scheduledPart:
              result.operationDateUpdates.length > 0
                ? t('app.kuaizhizao.scheduling.msg.stationsSavedScheduledPart', {
                    count: result.operationDateUpdates.length,
                  })
                : '',
          })
        );
      } else if (result.operationDateUpdates.length > 0) {
        messageApi.success(
          t('app.kuaizhizao.scheduling.msg.savedToGantt', { count: result.operationDateUpdates.length })
        );
      } else {
        messageApi.success(t('app.kuaizhizao.scheduling.msg.stationsSavedDisplay'));
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
      t,
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
        messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.loadOperationsFailed'));
        setPrepModalOpen(false);
        setPrepModalWorkOrder(null);
        setPrepModalMissing([]);
        setPrepModalOperationsNeedingStation([]);
      } finally {
        setPrepModalLoading(false);
      }
    },
    [messageApi, t]
  );

  const handleDropWorkOrderToBoard = useCallback(
    async (workOrderId: number) => {
      if (!canScheduleUpdate) return;
      const wo = ganttWorkOrders.find((item) => item.id === workOrderId);
      if (!wo) {
        messageApi.warning(t('app.kuaizhizao.scheduling.msg.workOrderNotFound'));
        return;
      }
      const alreadyOnBoard = isWorkOrderScheduledOnBoard(wo);
      if (alreadyOnBoard && !workOrderNeedsSchedulingPrep(wo)) {
        messageApi.info(t('app.kuaizhizao.scheduling.msg.alreadyOnBoard'));
        return;
      }
      if (workOrderNeedsSchedulingPrep(wo)) {
        await openSchedulingPrepModal(wo);
        return;
      }
      try {
        await completeDropWorkOrderToBoard(wo);
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.dropFailed'));
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
      t,
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

        if (values.operationDates.length > 0 || values.operationStations.length > 0) {
          await persistOperationScheduling(values.operationDates, values.operationStations);
        }
        if (values.operationAssignments.length > 0) {
          await workOrderApi.batchUpdateOperationAssignments(values.operationAssignments);
        }

        const assignmentByOp = new Map(values.operationAssignments.map((item) => [item.operation_id, item]));
        const workerNameById = new Map(schedulingWorkers.map((w) => [w.id, w.name]));
        const equipmentNameById = new Map(schedulingEquipments.map((e) => [e.id, e.name]));
        const moldNameById = new Map(schedulingMolds.map((m) => [m.id, m.name]));
        const updatedOpsWithAssignments = updatedOps.map((op) => {
          if (op.id == null) return op;
          const patch = assignmentByOp.get(op.id);
          if (!patch) return op;
          return {
            ...op,
            assigned_worker_id: patch.assigned_worker_id ?? op.assigned_worker_id,
            assigned_worker_name:
              patch.assigned_worker_id != null
                ? workerNameById.get(patch.assigned_worker_id) ?? op.assigned_worker_name
                : op.assigned_worker_name,
            assigned_equipment_id: patch.assigned_equipment_id ?? op.assigned_equipment_id,
            assigned_equipment_name:
              patch.assigned_equipment_id != null
                ? equipmentNameById.get(patch.assigned_equipment_id) ?? op.assigned_equipment_name
                : op.assigned_equipment_name,
            assigned_mold_id: patch.assigned_mold_id ?? op.assigned_mold_id,
            assigned_mold_name:
              patch.assigned_mold_id != null
                ? moldNameById.get(patch.assigned_mold_id) ?? op.assigned_mold_name
                : op.assigned_mold_name,
          };
        });

        const updatedWo: WorkOrderForGantt = {
          ...prepModalWorkOrder,
          planned_start_date: woPlannedStart,
          planned_end_date: woPlannedEnd,
          operations: updatedOpsWithAssignments,
        };

        setSelectedRowKeys([updatedWo.id]);
        const focusTask = pickFocusOperationTaskId(updatedWo);
        if (focusTask) {
          setFocusTaskId(focusTask);
        }
        messageApi.success(
          t('app.kuaizhizao.scheduling.msg.savedToGantt', {
            count: values.operationDates.length || updatedOps.length,
          })
        );
        refreshBoardScan();
    actionRef.current?.reload();
        await refreshGanttPreservingWorkOrder(updatedWo);

        setPrepModalOpen(false);
        setPrepModalWorkOrder(null);
        setPrepModalMissing([]);
        setPrepModalOperationsNeedingStation([]);
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.savePrepFailed'));
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
      schedulingEquipments,
      schedulingMolds,
      schedulingWorkers,
      t,
    ]
  );

  const handleBatchFreeze = useCallback(async () => {
    if (selectedWorkOrderIds.length === 0) return;
    setBatchActionLoading(true);
    try {
      await Promise.all(
        selectedWorkOrderIds
          .slice(0, 50)
          .map((id) => workOrderApi.freeze(String(id), { freeze_reason: t('app.kuaizhizao.scheduling.msg.freezeReason') }))
      );
      messageApi.success(t('app.kuaizhizao.scheduling.msg.batchFreezeSuccess'));
      refreshGantt();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.batchFreezeFailed'));
    } finally {
      setBatchActionLoading(false);
    }
  }, [messageApi, refreshGantt, selectedWorkOrderIds, t]);

  const handleBatchUnfreeze = useCallback(async () => {
    if (selectedWorkOrderIds.length === 0) return;
    setBatchActionLoading(true);
    try {
      await Promise.all(selectedWorkOrderIds.slice(0, 50).map((id) => workOrderApi.unfreeze(String(id))));
      messageApi.success(t('app.kuaizhizao.scheduling.msg.batchUnfreezeSuccess'));
      refreshGantt();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.scheduling.msg.batchUnfreezeFailed'));
    } finally {
      setBatchActionLoading(false);
    }
  }, [messageApi, refreshGantt, selectedWorkOrderIds, t]);

  const handleRefreshAll = useCallback(() => {
    refreshGantt();
    refreshBoardScan();
    refreshPlanReliability();
  }, [refreshBoardScan, refreshGantt, refreshPlanReliability]);

  const columns: ProColumns<WorkOrderForGantt>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.scheduling.col.workOrderCode'),
        dataIndex: 'code',
        width: 130,
        ellipsis: true,
        fixed: 'left',
        render: (_: unknown, record) => {
          const rank = aiSuggestedPoolRankById.get(record.id);
          return (
            <Space size={4}>
              <span>{record.code}</span>
              {rank != null ? (
                <Tag color="processing" className="scheduling-pool-ai-rank">
                  {t('app.kuaizhizao.scheduling.aiAssist.poolRank', { rank })}
                </Tag>
              ) : null}
            </Space>
          );
        },
      },
      {
        title: t('app.kuaizhizao.scheduling.col.operationCount'),
        width: 64,
        align: 'center',
        render: (_: unknown, record) => {
          const count = countWorkOrderOperations(record);
          return count > 0 ? count : <Typography.Text type="secondary">0</Typography.Text>;
        },
      },
      {
        title: t('app.kuaizhizao.scheduling.col.scheduledOpCount'),
        width: 88,
        align: 'center',
        render: (_: unknown, record) => {
          const total = countWorkOrderOperations(record);
          const scheduled = countScheduledOperations(record);
          if (total <= 0) {
            return <Typography.Text type="secondary">0</Typography.Text>;
          }
          const label = String(scheduled);
          const tooltip = t('app.kuaizhizao.scheduling.col.scheduledOpsTooltip', { scheduled, total });
          if (scheduled >= total) {
            return (
              <Tooltip title={tooltip}>
                <Typography.Text>{label}</Typography.Text>
              </Tooltip>
            );
          }
          return (
            <Tooltip title={tooltip}>
              <Typography.Text type={scheduled > 0 ? undefined : 'secondary'}>{label}</Typography.Text>
            </Tooltip>
          );
        },
      },
      { title: t('app.kuaizhizao.scheduling.col.productName'), dataIndex: 'product_name', width: 120, ellipsis: true },
      { title: t('common.quantity'), dataIndex: 'quantity', width: 72, align: 'right' , render: formatQuantity },
      { title: t('app.kuaizhizao.scheduling.col.plannedStart'), dataIndex: 'planned_start_date', valueType: 'dateTime', width: 148 },
      { title: t('app.kuaizhizao.scheduling.col.plannedEnd'), dataIndex: 'planned_end_date', valueType: 'dateTime', width: 148 },
      {
        title: t('app.kuaizhizao.scheduling.col.overdue'),
        width: 72,
        align: 'center',
        render: (_: unknown, record) => {
          if (!record.planned_end_date) {
            return <Typography.Text type="secondary">{t('app.kuaizhizao.scheduling.common.dash')}</Typography.Text>;
          }
          const overdue = dayjs(record.planned_end_date).isBefore(dayjs());
          return overdue ? (
            <Tag color="error">{t('app.kuaizhizao.scheduling.col.overdueTag')}</Tag>
          ) : (
            <Typography.Text type="secondary">{t('app.kuaizhizao.scheduling.common.dash')}</Typography.Text>
          );
        },
      },
      {
        title: t('app.kuaizhizao.scheduling.col.schedulingIssues'),
        width: 180,
        ellipsis: true,
        render: (_: unknown, record) => {
          const issues = workOrderDiagnosticsById.get(record.id);
          if (!issues?.length) {
            return <Typography.Text type="secondary">{t('app.kuaizhizao.scheduling.common.dash')}</Typography.Text>;
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
        title: t('app.kuaizhizao.scheduling.col.frozen'),
        dataIndex: 'is_frozen',
        width: 72,
        align: 'center',
        render: (_: unknown, record: { is_frozen?: boolean }) =>
          record.is_frozen ? (
            <Tag color="purple">{t('app.kuaizhizao.scheduling.col.frozenTag')}</Tag>
          ) : (
            <Typography.Text type="secondary">{t('app.kuaizhizao.scheduling.common.dash')}</Typography.Text>
          ),
      },
      {
        title: t('app.kuaizhizao.scheduling.col.priority'),
        dataIndex: 'priority',
        width: 80,
        align: 'center',
        render: (priority: any) => {
          const val = String(priority || '');
          const colorMap: Record<string, string> = { urgent: 'red', high: 'orange', normal: 'blue', low: 'default' };
          const textMap: Record<string, string> = {
            urgent: t('app.kuaizhizao.scheduling.priority.urgent'),
            high: t('app.kuaizhizao.scheduling.priority.high'),
            normal: t('app.kuaizhizao.scheduling.priority.normal'),
            low: t('app.kuaizhizao.scheduling.priority.low'),
          };
          return <Tag color={colorMap[val] || 'default'}>{textMap[val] || val}</Tag>;
        },
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        valueEnum: {
          draft: { text: t('app.kuaizhizao.scheduling.status.draft'), status: 'default' },
          released: { text: t('app.kuaizhizao.scheduling.status.released'), status: 'processing' },
          in_progress: { text: t('app.kuaizhizao.scheduling.status.inProgress'), status: 'processing' },
        },
      },
    ],
    [aiSuggestedPoolRankById, t, workOrderDiagnosticsById]
  );

  const discardDraftAndClose = useCallback(() => {
    draftWoUpdatesRef.current.clear();
    draftOpUpdatesRef.current.clear();
    draftStationUpdatesRef.current.clear();
    undoStackRef.current = [];
    syncDraftPendingCount();
    setDraftMode(false);
    refreshGantt();
  }, [refreshGantt, syncDraftPendingCount]);

  const schedulingActionCount = Math.min(selectedWorkOrderIds.length, 50);
  const schedulingOverdueCount = useMemo(
    () =>
      selectedWorkOrders.filter(
        (wo) => wo.planned_end_date && dayjs(wo.planned_end_date).isBefore(dayjs()),
      ).length,
    [selectedWorkOrders],
  );
  const poolQuickActionDescription = useMemo(
    () =>
      schedulingOverdueCount > 0
        ? t('app.kuaizhizao.scheduling.msg.quickActionConfirmOverdue', {
            count: schedulingActionCount,
            overdue: schedulingOverdueCount,
          })
        : t('app.kuaizhizao.scheduling.msg.quickActionConfirm', { count: schedulingActionCount }),
    [schedulingActionCount, schedulingOverdueCount, t],
  );
  const schedulingConfirmOkText = t('app.kuaizhizao.scheduling.common.confirm');

  const ganttToolbarNodes = buildSchedulingGanttToolbar({
    t,
    ganttViewMode,
    shiftDays,
    selectedWorkOrderCount: selectedWorkOrderIds.length,
    batchActionLoading,
    canUpdate: canScheduleUpdate,
    draftMode,
    draftPendingCount,
    onDraftModeChange: setDraftMode,
    draftCloseConfirm: {
      title: t('app.kuaizhizao.scheduling.draft.closeTitle'),
      description: t('app.kuaizhizao.scheduling.draft.closeContent', { count: draftPendingCount }),
      okText: t('app.kuaizhizao.scheduling.draft.discardAndClose'),
      onConfirm: discardDraftAndClose,
    },
    onApplyDraft: handleApplyDraft,
    onUndoDraft: handleUndoDraft,
    onRefresh: handleRefreshAll,
    onOpenConfig: () => setConfigDrawerOpen(true),
    onBatchFreeze: handleBatchFreeze,
    onBatchUnfreeze: handleBatchUnfreeze,
    onBatchShift: handleBatchShift,
    onShiftDaysChange: setShiftDays,
    onViewModeChange: (mode) => {
      setGanttViewMode(mode);
      setScrollToTodayToken((n) => n + 1);
    },
    onScrollToToday: () => setScrollToTodayToken((n) => n + 1),
    aiTrigger: <SchedulingAiAssistantTrigger onOpen={() => setAiDrawerOpen(true)} />,
    onAutoReschedule: handleAutoReschedule,
    autoRescheduleConfirm: {
      title: t('app.kuaizhizao.scheduling.msg.autoRescheduleTitle'),
      description: t('app.kuaizhizao.scheduling.msg.autoRescheduleConfirm', { count: schedulingActionCount }),
      okText: schedulingConfirmOkText,
    },
    onEditOperation: () => {
      if (!operationEditContext) return;
      setOperationEditOpen(true);
    },
    autoRescheduleLoading,
    canEditOperation: operationEditContext != null,
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
            title: t('app.kuaizhizao.scheduling.tour.fullscreenTitle'),
            description: t('app.kuaizhizao.scheduling.tour.fullscreenDescription'),
            target: () => document.querySelector('.uni-tabs-fullscreen-button') as HTMLElement,
          },
        ]}
      />
      <SchedulingHeaderBand
        constraints={schedulingConstraints}
        selectedWorkOrderCount={selectedWorkOrderIds.length}
        selectedOperationCount={selectedOperationCount}
        resourceViewStats={resourceViewStats}
        legendMetrics={topLegendMetrics}
        planReliabilityLoading={planReliabilityLoading}
        planReliability={planReliability}
        missingSettingsCount={
          boardScan?.missing_settings_count ?? boardScan?.missing_settings?.length ?? 0
        }
        missingSettingsActionDisabled={!canScheduleUpdate}
        onMissingSettingsClick={() => openMissingSettingsModal(boardScan?.missing_settings ?? [])}
      />
      {filterWorkOrderIds?.length ? (
        <Alert
          type="info"
          showIcon
          closable
          style={{ marginBottom: 12 }}
          title={t('app.kuaizhizao.scheduling.alert.fromCoordinationCenter', { count: filterWorkOrderIds.length })}
          action={
            <Button size="small" onClick={() => navigate('/apps/kuaizhizao/plan-management/dashboard')}>
              {t('app.kuaizhizao.scheduling.alert.returnCoordinationCenter')}
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
          title={t('app.kuaizhizao.scheduling.alert.filterByPlanDate', { date: filterPlanDate })}
          action={
            <Button
              size="small"
              onClick={() => navigate(`/apps/kuaizhizao/plan-management/rolling-scheduling?plan_date=${filterPlanDate}`)}
            >
              {t('app.kuaizhizao.scheduling.alert.returnRollingPlan')}
            </Button>
          }
        />
      ) : null}
      {ganttWorkOrders.length >= GANTT_WORK_ORDER_LIMIT && !filterWorkOrderIds?.length ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('app.kuaizhizao.scheduling.alert.ganttLimitWarning', { limit: GANTT_WORK_ORDER_LIMIT })}
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
                    <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.scheduling.pool.loadingGantt')}</div>
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
                  onViewModeChange={(mode) => {
                    setGanttViewMode(mode);
                    setScrollToTodayToken((n) => n + 1);
                  }}
                  onBatchUpdate={canScheduleUpdate ? handleGanttBatchUpdate : undefined}
                  onBatchUpdateOperations={canScheduleUpdate ? handleGanttBatchUpdateOperations : undefined}
                  onBatchUpdateOperationStations={
                    canScheduleUpdate ? handleBatchUpdateOperationStations : undefined
                  }
                  onWorkOrderSelect={handleGanttWorkOrderSelect}
                  onOperationSelect={handleGanttOperationSelect}
                  onOperationDoubleClick={handleGanttOperationDoubleClick}
                  onRefresh={refreshGantt}
                  canUpdate={canScheduleUpdate}
                  nonDraggableTaskIds={nonDraggableTaskIds}
                  onBlockedDragAttempt={(taskId) => {
                    const text = String(taskId);
                    if (text === lastBlockedTaskId) return;
                    setLastBlockedTaskId(text);
                    messageApi.warning(t('app.kuaizhizao.scheduling.msg.freezeDragBlocked'));
                  }}
                />
              </Suspense>
            </SchedulingBoardDropZone>
            <div className="scheduling-pending-pool aps-pool-card-compact">
              <div className="scheduling-pending-pool__main">
                <span className="scheduling-pending-pool__title-wrap">
                  <Typography.Text strong className="scheduling-pending-pool__title">
                    {t('app.kuaizhizao.scheduling.pool.title')}
                  </Typography.Text>
                  <span
                    className="scheduling-pending-pool__count"
                    aria-label={t('app.kuaizhizao.scheduling.pool.countAriaLabel', { count: poolWorkOrders.length })}
                  >
                    {poolWorkOrders.length}
                  </span>
                </span>
                {canScheduleUpdate ? (
                  <>
                    <Typography.Text type="secondary" className="scheduling-pending-pool__hint">
                      {t('app.kuaizhizao.scheduling.pool.hint')}
                    </Typography.Text>
                    <span className="scheduling-pending-pool__sep" aria-hidden>
                      -
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
                  columns={alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK)}
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
                      onRescheduleForward={handleRescheduleForward}
                      confirmDelayConfirm={{
                        title: t('app.kuaizhizao.scheduling.msg.confirmDelayTitle'),
                        description: poolQuickActionDescription,
                        okText: schedulingConfirmOkText,
                      }}
                      toExceptionConfirm={{
                        title: t('app.kuaizhizao.scheduling.msg.toExceptionTitle'),
                        description: poolQuickActionDescription,
                        okText: schedulingConfirmOkText,
                      }}
                      applyUnfreezeConfirm={{
                        title: t('app.kuaizhizao.scheduling.msg.applyUnfreezeTitle'),
                        description: poolQuickActionDescription,
                        okText: schedulingConfirmOkText,
                      }}
                      rescheduleForwardConfirm={{
                        title: t('app.kuaizhizao.scheduling.msg.rescheduleForwardTitle'),
                        description: t('app.kuaizhizao.scheduling.msg.rescheduleForwardConfirm', {
                          count: schedulingActionCount,
                        }),
                        okText: schedulingConfirmOkText,
                      }}
                      overdueOnly={poolOverdueOnly}
                      onOverdueOnlyChange={setPoolOverdueOnly}
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
                    if (aiSuggestedPoolRankById.has(record.id)) {
                      classes.push('scheduling-pool-row--ai-suggested');
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
        workers={schedulingWorkers}
        equipments={schedulingEquipments}
        molds={schedulingMolds}
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
        open={missingSettingsModalOpen}
        destroyOnHidden
        title={t('app.kuaizhizao.scheduling.msg.missingSettingsTitle')}
        width={960}
        onCancel={() => {
          setMissingSettingsModalOpen(false);
          setPendingAutoRescheduleIds(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setMissingSettingsModalOpen(false);
              setPendingAutoRescheduleIds(null);
            }}
          >
            {t('common.cancel')}
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={missingSettingsSaving}
            disabled={!canScheduleUpdate}
            onClick={() => void handleMissingSettingsBackfill()}
          >
            {pendingAutoRescheduleIds?.length
              ? t('app.kuaizhizao.scheduling.msg.missingBackfillAndReschedule')
              : t('app.kuaizhizao.scheduling.msg.missingBackfill')}
          </Button>,
        ]}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('app.kuaizhizao.scheduling.msg.missingSettingsHint')}
        />
        <Table
          size="small"
          rowKey="operation_id"
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          dataSource={missingSettingsRows}
          columns={[
            {
              title: t('app.kuaizhizao.scheduling.table.workOrderCode'),
              dataIndex: 'work_order_code',
              width: 140,
            },
            {
              title: t('app.kuaizhizao.scheduling.table.operation'),
              dataIndex: 'operation_name',
              ellipsis: true,
            },
            {
              title: t('app.kuaizhizao.scheduling.msg.setupHours'),
              width: 120,
              render: (_, row) =>
                row.needHours ? (
                  <InputNumber
                    min={0}
                    step={0.1}
                    style={{ width: '100%' }}
                    value={row.setup_time}
                    onChange={(v) =>
                      setMissingSettingsRows((prev) =>
                        prev.map((r) =>
                          r.operation_id === row.operation_id
                            ? { ...r, setup_time: v == null ? null : Number(v) }
                            : r,
                        ),
                      )
                    }
                  />
                ) : (
                  '—'
                ),
            },
            {
              title: t('app.kuaizhizao.scheduling.msg.standardHours'),
              width: 120,
              render: (_, row) =>
                row.needHours ? (
                  <InputNumber
                    min={0}
                    step={0.1}
                    style={{ width: '100%' }}
                    value={row.standard_time}
                    onChange={(v) =>
                      setMissingSettingsRows((prev) =>
                        prev.map((r) =>
                          r.operation_id === row.operation_id
                            ? { ...r, standard_time: v == null ? null : Number(v) }
                            : r,
                        ),
                      )
                    }
                  />
                ) : (
                  '—'
                ),
            },
            {
              title: t('app.kuaizhizao.scheduling.msg.station'),
              width: 200,
              render: (_, row) => {
                if (!row.needStation) return '—';
                const wcId =
                  row.work_center_id != null && Number(row.work_center_id) > 0
                    ? Number(row.work_center_id)
                    : null;
                let candidates = workstationResources;
                if (wcId != null) {
                  const wc = schedulingWorkCenters.find((item) => item.id === wcId);
                  const allowed = new Set((wc?.workstationIds ?? []).filter((id) => id > 0));
                  if (allowed.size > 0) {
                    candidates = workstationResources.filter((s) => allowed.has(s.id));
                  }
                }
                return (
                  <Select
                    style={{ width: '100%' }}
                    allowClear
                    options={candidates.map((s) => ({
                      value: s.id,
                      label: s.code ? `${s.code} ${s.name}` : s.name,
                    }))}
                    value={row.assigned_station_id ?? undefined}
                    onChange={(v) =>
                      setMissingSettingsRows((prev) =>
                        prev.map((r) =>
                          r.operation_id === row.operation_id
                            ? { ...r, assigned_station_id: v == null ? null : Number(v) }
                            : r,
                        ),
                      )
                    }
                  />
                );
              },
            },
          ]}
        />
      </Modal>

      <SchedulingOperationEditDrawer
        open={operationEditOpen}
        context={operationEditContext}
        workstations={workstationResources}
        workers={schedulingWorkers}
        equipments={schedulingEquipments}
        molds={schedulingMolds}
        canUpdate={canScheduleUpdate}
        onClose={() => setOperationEditOpen(false)}
        onSaved={() => {
          refreshGantt();
          refreshBoardScan();
    actionRef.current?.reload();
        }}
      />

      <Modal
        title={t('app.kuaizhizao.scheduling.config.title')}
        width={560}
        open={configDrawerOpen}
        onCancel={() => setConfigDrawerOpen(false)}
        footer={
          <Space>
            <Button
              onClick={() => {
                setSchedulingConstraints(DEFAULT_SCHEDULING_CONSTRAINTS);
              }}
            >
              {t('app.kuaizhizao.scheduling.config.restoreDefault')}
            </Button>
            <Button
              type="primary"
              loading={configSaving}
              disabled={!canScheduleUpdate}
              onClick={async () => {
                try {
                  setConfigSaving(true);
                  await schedulingConfigApi.upsertDefault(pickVisualSchedulingConstraints(schedulingConstraints));
                  messageApi.success(t('app.kuaizhizao.scheduling.msg.configSaved'));
                  setConfigDrawerOpen(false);
                  refreshBoardScan();
                } catch (e: any) {
                  messageApi.error(e?.message || t('common.saveFailed'));
                } finally {
                  setConfigSaving(false);
                }
              }}
            >
              {t('common.confirm')}
            </Button>
          </Space>
        }
      >
        <div style={{ padding: '12px 0' }}>
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('app.kuaizhizao.scheduling.config.freezeWindowDays')}</span>
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
              {t('app.kuaizhizao.scheduling.config.freezeWindowHint')}
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('app.kuaizhizao.scheduling.config.scanHorizonDays')}</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('app.kuaizhizao.scheduling.config.changeoverHours')}</span>
              <InputNumber
                size="small"
                min={0}
                max={12}
                step={0.5}
                value={schedulingConstraints.setup_changeover_hours}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({
                    ...c,
                    setup_changeover_hours: Number(v ?? 0),
                  }))
                }
              />
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: -8 }}>
              {t('app.kuaizhizao.scheduling.config.changeoverHoursHint')}
            </Typography.Text>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('app.kuaizhizao.scheduling.config.scheduleMode')}</span>
              <Select
                size="small"
                style={{ width: 140 }}
                value={schedulingConstraints.schedule_mode || 'forward'}
                options={[
                  { value: 'forward', label: t('app.kuaizhizao.scheduling.config.scheduleModeForward') },
                  { value: 'backward', label: t('app.kuaizhizao.scheduling.config.scheduleModeBackward') },
                ]}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({
                    ...c,
                    schedule_mode: v === 'backward' ? 'backward' : 'forward',
                  }))
                }
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t('app.kuaizhizao.scheduling.config.materialHardConstraint')}</span>
              <Switch
                checked={Boolean(schedulingConstraints.material_hard_constraint)}
                onChange={(v) =>
                  setSchedulingConstraints((c) => ({ ...c, material_hard_constraint: v }))
                }
              />
            </div>
            <Divider style={{ margin: '4px 0' }} />
            <div style={{ fontWeight: 500 }}>{t('app.kuaizhizao.scheduling.config.workHoursTitle')}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: -8 }}>
              {t('app.kuaizhizao.scheduling.config.workHoursHint')}
            </Typography.Text>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, alignSelf: 'flex-start' }}
              onClick={() => {
                setConfigDrawerOpen(false);
                navigate(ROUTES.PERF_WORK_CALENDAR);
              }}
            >
              {t('app.kuaizhizao.scheduling.config.workHoursLink')}
            </Button>
            <Divider style={{ margin: '4px 0' }} />
            <div style={{ fontWeight: 500 }}>{t('app.kuaizhizao.scheduling.config.dragValidationTitle')}</div>
            {(['consider_human', 'consider_equipment', 'consider_material', 'consider_mold_tool'] as const).map((key) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {key === 'consider_human' && t('app.kuaizhizao.scheduling.config.considerHuman')}
                  {key === 'consider_equipment' && t('app.kuaizhizao.scheduling.config.considerEquipment')}
                  {key === 'consider_material' && t('app.kuaizhizao.scheduling.config.considerMaterial')}
                  {key === 'consider_mold_tool' && t('app.kuaizhizao.scheduling.config.considerMoldTool')}
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

      <SchedulingAiAssistantDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        canUpdate={canScheduleUpdate}
        context={{
          poolWorkOrderIds,
          selectedWorkOrderIds,
          planDate: filterPlanDate,
          boardScan,
          workOrders: ganttWorkOrders,
        }}
        draftWoUpdatesRef={draftWoUpdatesRef}
        draftOpUpdatesRef={draftOpUpdatesRef}
        draftStationUpdatesRef={draftStationUpdatesRef}
        mutateGanttWorkOrders={mutateGanttWorkOrders}
        pushUndoSnapshot={pushUndoSnapshot}
        syncDraftPendingCount={syncDraftPendingCount}
        setDraftMode={setDraftMode}
        onPoolReorder={handleAiPoolReorder}
        onSelectSuggested={handleAiSelectSuggested}
        onSelectOverdue={handleAiSelectOverdue}
      />
    </ListPageTemplate>
  );
};

export default SchedulingPage;
