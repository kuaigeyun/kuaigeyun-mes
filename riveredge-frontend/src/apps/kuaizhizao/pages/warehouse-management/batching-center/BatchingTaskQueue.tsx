/**
 * 物料中心任务队列（线边备料执行 / 产线补料 / 备料建议 / 倒冲异常）
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  App,
  Button,
  Space,
  Modal,
  Typography,
  Table,
  Form,
  AutoComplete,
  Tag,
  Switch,
  InputNumber,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import { UniTable } from '../../../../../components/uni-table';
import { apiRequest } from '../../../../../services/api';
import { sumInventoryPickOptionQty } from '../outbound/outboundConfirmInventoryOptions';
import { warehouseApi } from '../../../services/warehouse-execution';
import { batchingOrderApi } from '../../../services/batching-order';
import { getBatchingOrderStageName } from '../../../utils/batchingOrderLifecycle';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { getBatchingTaskTypeLabel, type BatchingTaskTabKey } from './materialCenterTabs';
import type { MaterialCenterDetailRequest } from './materialCenterDetail';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import {
  normalizeWarehouseListResponse,
  resolveBatchingCenterTaskListParams,
} from '../../../utils/warehouseListCore';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useBatchingPullFromWorkOrder } from './useBatchingPullFromWorkOrder';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { formatDateTime, formatQuantity } from '../../../../../utils/format';
import {
  DocumentPushProgressBar,
  DOCUMENT_PROGRESS_COLUMN_WIDTH,
  ratioToPushProgressPercent,
} from '../../sales-management/shared/DocumentPushProgressBar';

type BatchPickOption = { value: string; label: string; quantity?: number };

export type BatchingTaskRow = {
  task_type: string;
  task_id: number;
  doc_code?: string;
  work_order_id?: number;
  work_order_code?: string;
  product_name?: string;
  picking_score?: number;
  picking_rank_band?: string;
  kitting_rate?: number;
  shortage_summary?: string;
  priority?: string;
  sla_overdue?: boolean;
  status?: string;
  material_name?: string;
  material_code?: string;
  requested_quantity?: number;
  total_items?: number;
  delivered_quantity?: number;
  material_unit?: string;
  caller_name?: string;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
  needed_at?: string;
  target_warehouse_name?: string;
  score_breakdown?: Record<string, unknown>;
  suggested_warehouse_id?: number;
  suggested_warehouse_name?: string;
  items?: Record<string, unknown>[];
  error_message?: string;
};

export type { BatchingTaskTabKey } from './materialCenterTabs';

function formatTaskStatusLabel(r: BatchingTaskRow, t: (key: string) => string): string {
  const st = String(r.status ?? '').trim();
  if (!st) return '-';
  switch (r.task_type) {
    case 'proactive_prep':
      if (st === 'ready_to_prep') {
        return t('app.kuaizhizao.warehouseCommon.statusReadyToPrep');
      }
      if (st === 'pending_prep') {
        return t('app.kuaizhizao.warehouseCommon.statusPendingPrep');
      }
      return st;
    case 'material_call': {
      const map: Record<string, string> = {
        pending: t('app.kuaizhizao.warehouseCommon.statusPending'),
        processing: t('app.kuaizhizao.warehouseCommon.statusPicking'),
        partial: t('app.kuaizhizao.warehouseCommon.statusPartial'),
        completed: t('app.kuaizhizao.warehouseCommon.statusCompleted'),
        cancelled: t('app.kuaizhizao.warehouseCommon.statusCancelled'),
        picking: t('app.kuaizhizao.warehouseCommon.statusPicking'),
      };
      return map[st] ?? st;
    }
    case 'batching_draft':
      return getBatchingOrderStageName(st);
    case 'backflush_alert': {
      const map: Record<string, string> = {
        failed: t('app.kuaizhizao.warehouseCommon.statusBackflushFailed'),
        success: t('app.kuaizhizao.warehouseCommon.statusBackflushSuccess'),
      };
      return map[st] ?? st;
    }
    default:
      return st;
  }
}

function resolveTaskPriorityTagColor(priority?: string): string {
  const normalized = String(priority ?? '').trim().toLowerCase();
  if (normalized === 'urgent') return 'red';
  if (normalized === 'high') return 'orange';
  if (normalized === 'low') return 'default';
  return 'blue';
}

function resolveTaskStatusTagColor(taskType: string, status?: string): string {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (taskType === 'backflush_alert') {
    if (normalized === 'failed') return 'error';
    if (normalized === 'success') return 'success';
    return 'default';
  }
  if (normalized === 'completed' || normalized === '已完成') return 'success';
  if (normalized === 'processing' || normalized === 'partial' || normalized === 'picking') return 'processing';
  if (
    normalized === 'pending' ||
    normalized === 'draft' ||
    normalized === 'pending_prep' ||
    normalized === 'ready_to_prep'
  ) {
    return 'warning';
  }
  if (normalized === 'cancelled' || normalized === '已取消') return 'default';
  return 'default';
}

type Props = {
  taskType: BatchingTaskTabKey;
  onCreate?: () => void;
  onOpenDetail?: (request: MaterialCenterDetailRequest) => void;
  canRead?: boolean;
  onRefreshBatchingList?: () => void;
  /** 分栏场景：外部变更后递增以触发本表 reload */
  listReloadKey?: number;
  /** 本表任务变更后通知（如左栏生成备料单后刷新右栏） */
  onTasksChanged?: () => void;
  /** 仅展示指定工单的备料单（右栏主从联动） */
  workOrderCodeFilter?: string;
};

const BatchingTaskQueue: React.FC<Props> = ({
  taskType,
  onCreate,
  onOpenDetail,
  canRead = true,
  onRefreshBatchingList,
  listReloadKey,
  onTasksChanged,
  workOrderCodeFilter,
}) => {
  const { t } = useTranslation();
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'batching_order.pull_from_work_order');
  const { message: messageApi } = App.useApp();
  const taskTypeLabel = useMemo(() => getBatchingTaskTypeLabel(t), [t]);
  const taskTypeMap = useMemo(
    () => ({
      batching_draft: { text: taskTypeLabel.batching_draft, color: 'green' },
      material_call: { text: taskTypeLabel.material_call, color: 'orange' },
      proactive_prep: { text: taskTypeLabel.proactive_prep, color: 'blue' },
      backflush_alert: { text: taskTypeLabel.backflush_alert, color: 'red' },
      line_side_prep: {
        text: t('app.kuaizhizao.batchingCenter.tab.lineSidePrep'),
        color: 'green',
      },
    }),
    [taskTypeLabel, t],
  );
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeMode, setCompleteMode] = useState<'material_call' | 'batching'>('material_call');
  const [completingRecord, setCompletingRecord] = useState<BatchingTaskRow | null>(null);
  const [batchingItems, setBatchingItems] = useState<any[]>([]);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [completeForm] = Form.useForm();
  const [pendingCompleteFormValues, setPendingCompleteFormValues] = useState<Record<string, unknown> | null>(null);
  const [batchOptionsByMaterialId, setBatchOptionsByMaterialId] = useState<Record<number, BatchPickOption[]>>({});
  const [batchOptionsLoading, setBatchOptionsLoading] = useState(false);

  const reload = () => {
    actionRef.current?.reload();
    invalidateMenuBadgeCounts();
    onRefreshBatchingList?.();
    onTasksChanged?.();
  };

  const { pullFromWorkOrder, lineSideWarehouseModal } = useBatchingPullFromWorkOrder({
    onSuccess: reload,
  });

  useEffect(() => {
    if (listReloadKey == null || listReloadKey <= 0) return;
    actionRef.current?.reload();
  }, [listReloadKey]);

  const handleMaterialCallUpdate = async (
    id: number,
    status: 'processing' | 'completed' | 'cancelled',
    completion_batches?: { item_id: number; batch_no: string }[],
  ) => {
    const payload: Record<string, unknown> = { status };
    if (status === 'completed' && completion_batches?.length) {
      payload.completion_batches = completion_batches;
    }
    await warehouseApi.materialCall.update(id, payload);
    const statusMap: Record<string, string> = {
      processing: t('app.kuaizhizao.batchingCenter.msg.pickingStarted'),
      completed: t('app.kuaizhizao.batchingCenter.msg.callCompleted'),
      cancelled: t('app.kuaizhizao.batchingCenter.msg.callCancelled'),
    };
    messageApi.success(statusMap[status] || t('app.kuaizhizao.warehouseCommon.operationSuccess'));
    reload();
  };

  const openMaterialCallComplete = (record: BatchingTaskRow) => {
    const items = Array.isArray(record?.items) ? record.items : [];
    if (items.length === 0) {
      Modal.confirm({
        title: t('app.kuaizhizao.batchingCenter.confirmCompleteTitle'),
        content: t('app.kuaizhizao.batchingCenter.confirmCompleteNoItems'),
        onOk: async () => handleMaterialCallUpdate(record.task_id, 'completed'),
      });
      return;
    }
    setCompleteMode('material_call');
    setCompletingRecord(record);
    completeForm.resetFields();
    setCompleteOpen(true);
  };

  const openBatchingConfirm = async (record: BatchingTaskRow) => {
    try {
      const detail = await batchingOrderApi.syncFromWorkOrder(record.task_id);
      const allItems = detail?.items ?? [];
      const pendingItems = allItems.filter((it: { status?: string }) => it.status !== 'picked');
      if (!pendingItems.length) {
        messageApi.info(t('app.kuaizhizao.batchingCenter.allItemsPicked'));
        reload();
        return;
      }
      setCompleteMode('batching');
      setCompletingRecord(record);
      setBatchingItems(pendingItems);
      completeForm.resetFields();
      const initial: Record<string, unknown> = {};
      for (const it of pendingItems) {
        const required = Number(it.required_quantity ?? 0);
        const picked = Number(it.picked_quantity ?? 0);
        const remaining = Math.max(required - picked, 0);
        initial[`pick_${it.id}`] = true;
        initial[`qty_${it.id}`] = remaining > 0 ? remaining : required;
      }
      setPendingCompleteFormValues(initial);
      setCompleteOpen(true);
      reload();
    } catch (e: any) {
      messageApi.error(e.message || t('app.kuaizhizao.batchingCenter.loadBatchingFailed'));
    }
  };

  const handleSyncBatchingDraft = async (record: BatchingTaskRow) => {
    try {
      const detail = await batchingOrderApi.syncFromWorkOrder(record.task_id);
      const count = detail?.items?.length ?? 0;
      messageApi.success(count > 0 ? t('app.kuaizhizao.batchingCenter.syncShortageSuccess', { count }) : t('app.kuaizhizao.batchingCenter.syncShortageEmpty'));
      reload();
    } catch (e: any) {
      messageApi.error(e.message || t('app.kuaizhizao.batchingCenter.syncShortageFailed'));
    }
  };

  const submitComplete = async () => {
    if (!completingRecord) return;
    try {
      const vals = await completeForm.validateFields();
      setCompleteSubmitting(true);
      if (completeMode === 'material_call') {
        const items: any[] = Array.isArray(completingRecord.items) ? completingRecord.items : [];
        const completion_batches = items.map((it) => ({
          item_id: it.id,
          batch_no: String(vals[`batch_${it.id}`] ?? '').trim(),
        }));
        if (completion_batches.some((b) => !b.batch_no)) {
          messageApi.warning(t('app.kuaizhizao.batchingCenter.fillAllBatchNos'));
          return;
        }
        await handleMaterialCallUpdate(completingRecord.task_id, 'completed', completion_batches);
      } else {
        const item_batches: {
          item_id: number;
          batch_no?: string;
          pick_quantity?: number;
          skip: boolean;
        }[] = [];
        for (const it of batchingItems) {
          const pick = vals[`pick_${it.id}`] !== false;
          if (!pick) {
            item_batches.push({ item_id: it.id, skip: true });
            continue;
          }
          const qty = Number(vals[`qty_${it.id}`] ?? it.required_quantity ?? 0);
          if (!Number.isFinite(qty) || qty <= 0) {
            item_batches.push({ item_id: it.id, skip: true });
            continue;
          }
          const batch_no = String(vals[`batch_${it.id}`] ?? '').trim();
          if (!batch_no) {
            messageApi.warning(t('app.kuaizhizao.batchingCenter.fillBatchOrSkip', { name: it.material_name ?? it.material_code }));
            return;
          }
          item_batches.push({
            item_id: it.id,
            batch_no,
            pick_quantity: qty,
            skip: false,
          });
        }
        if (!item_batches.some((b) => !b.skip)) {
          messageApi.warning(t('app.kuaizhizao.batchingCenter.selectAtLeastOnePick'));
          return;
        }
        const result = await batchingOrderApi.confirm(String(completingRecord.task_id), { item_batches });
        const st = (result as { status?: string })?.status;
        messageApi.success(st === 'completed' ? t('app.kuaizhizao.batchingCenter.confirmPickSuccess') : t('app.kuaizhizao.batchingCenter.confirmPickPartial'));
        reload();
      }
      setCompleteOpen(false);
      setCompletingRecord(null);
    } catch {
      /* validation or api */
    } finally {
      setCompleteSubmitting(false);
    }
  };

  const handleProactivePrep = async (record: BatchingTaskRow) => {
    try {
      await pullFromWorkOrder({
        work_order_id: record.work_order_id,
        allow_existing_draft: true,
      });
    } catch (e: unknown) {
      messageApi.error(
        getApiErrorMessage(e, t('app.kuaizhizao.batchingCenter.generateBatchingFailed')),
      );
    }
  };

  const handleBackflushRetry = async (record: BatchingTaskRow) => {
    try {
      await warehouseApi.backflushRecords.retry(String(record.task_id));
      messageApi.success(t('app.kuaizhizao.batchingCenter.backflushRetrySubmitted'));
      reload();
    } catch (e: any) {
      messageApi.error(e.message || t('app.kuaizhizao.batchingCenter.backflushRetryFailed'));
    }
  };

  useEffect(() => {
    if (!completeOpen) {
      setBatchOptionsByMaterialId({});
      return;
    }
    const items =
      completeMode === 'material_call'
        ? (completingRecord?.items ?? [])
        : batchingItems;
    if (!items.length) return;

    const mids = [
      ...new Set(items.map((x: { material_id?: number }) => x.material_id).filter(Boolean) as number[]),
    ];
    if (!mids.length) return;

    let cancelled = false;
    (async () => {
      setBatchOptionsLoading(true);
      try {
        const res = await apiRequest<{ items?: Record<string, unknown>[] }>(
          '/apps/kuaizhizao/reports/inventory/batch-query',
          { method: 'GET', params: { material_ids: mids, include_expired: false } },
        );
        const rows = res.items ?? [];
        const map: Record<number, BatchPickOption[]> = {};
        for (const row of rows) {
          const mid = row.material_id as number;
          if (!mid) continue;
          const isMainBatch =
            row.warehouse_name === t('app.kuaizhizao.batchingCenter.mainWarehouse') ||
            (typeof row.id === 'number' && row.id >= 1_000_000 && row.id < 2_000_000);
          if (!isMainBatch) continue;
          const qty = Number(row.quantity ?? 0);
          if (qty <= 0) continue;
          const bn = String(row.batch_no ?? '').trim();
          if (!bn) continue;
          if (!map[mid]) map[mid] = [];
          if (map[mid].some((o) => o.value === bn)) continue;
          map[mid].push({
            value: bn,
            label: t('app.kuaizhizao.batchingCenter.batchAvailable', { batchNo: bn, qty }),
            quantity: qty,
          });
        }
        if (!cancelled) setBatchOptionsByMaterialId(map);
      } catch {
        if (!cancelled) setBatchOptionsByMaterialId({});
      } finally {
        if (!cancelled) setBatchOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [completeOpen, completeMode, completingRecord?.task_id, batchingItems, t]);

  const columns: ProColumns<BatchingTaskRow>[] = useMemo(
    () => [
    {
      title: t('app.kuaizhizao.warehouseCommon.colTaskType'),
      dataIndex: 'task_type',
      width: 110,
      // 合并「线边备料」列表含建议+备料单，需展示行来源
      hideInTable: taskType !== 'line_side_prep',
      hideInSearch: true,
      valueType: 'select',
      valueEnum: {
        batching_draft: { text: taskTypeLabel.batching_draft },
        material_call: { text: taskTypeLabel.material_call },
        proactive_prep: { text: taskTypeLabel.proactive_prep },
        backflush_alert: { text: taskTypeLabel.backflush_alert },
      },
      render: (_, r) => {
        const m = taskTypeMap[r.task_type as keyof typeof taskTypeMap] ?? { text: r.task_type, color: 'default' };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colDocCode'),
      dataIndex: 'doc_code',
      width: 140,
      render: (_, r) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text copyable={{ text: String(r.doc_code ?? '') }}>{r.doc_code ?? '-'}</Typography.Text>
          {r.work_order_code && r.task_type !== 'proactive_prep' ? (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {r.work_order_code}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colProductOrMaterial'),
      key: 'material',
      width: 180,
      hideInSearch: true,
      render: (_, r) => {
        if (r.task_type === 'proactive_prep') return r.product_name ?? r.shortage_summary ?? '-';
        if (r.task_type === 'batching_draft') {
          return (
            <div>
              <div style={{ fontWeight: 500 }}>{r.product_name ?? '-'}</div>
              {r.shortage_summary ? (
                <div style={{ fontSize: 11, color: '#666' }}>{r.shortage_summary}</div>
              ) : null}
            </div>
          );
        }
        if (r.task_type === 'backflush_alert') return `${r.material_code ?? ''} ${r.material_name ?? ''}`.trim();
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{r.material_name ?? r.shortage_summary ?? '-'}</div>
            {r.material_code ? (
              <div style={{ fontSize: 11, color: '#666' }}>{r.material_code}</div>
            ) : null}
          </div>
        );
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colKittingRate'),
      dataIndex: 'kitting_rate',
      width: 90,
      hideInSearch: true,
      // 齐套率仅对线边备料（建议+执行）有意义；产线补料是局部需求，后端不计算齐套率
      hideInTable: taskType === 'material_call' || taskType === 'backflush_alert',
      render: (_, r) =>
        r.kitting_rate != null ? <Tag color="green">{Math.round(r.kitting_rate)}%</Tag> : '-',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colSkuCount'),
      dataIndex: 'total_items',
      width: 72,
      hideInSearch: true,
      align: 'right',
      // 品种：线边备料（建议/备料单）与产线补料有意义；倒冲异常为单物料行
      hideInTable: taskType === 'backflush_alert',
      render: (_, r) => (r.total_items != null ? r.total_items : '-'),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colQuantity'),
      dataIndex: 'requested_quantity',
      width: 90,
      hideInSearch: true,
      align: 'right',
      // 数量：工单计划产量（线边备料）或补料需求量
      render: (_, r) =>
        r.requested_quantity != null
          ? `${r.requested_quantity}${r.material_unit ? ` ${r.material_unit}` : ''}`
          : '-',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colDeliveryFulfillment'),
      dataIndex: 'fulfillment_progress',
      width: DOCUMENT_PROGRESS_COLUMN_WIDTH,
      uniTableKeepWidth: true,
      hideInSearch: true,
      // 送达进度仅产线补料有「已送/需求」语义；线边备料执行是仓内拣料，不展示以免整列全为 -
      hideInTable: taskType !== 'material_call',
      render: (_, r) => {
        if (r.task_type !== 'material_call') return '-';
        const requested = Number(r.requested_quantity ?? 0);
        const delivered = Number(r.delivered_quantity ?? 0);
        if (!(requested > 0) && !(delivered > 0)) return '-';
        const percent = ratioToPushProgressPercent(delivered, requested);
        return (
          <DocumentPushProgressBar
            percent={percent}
            tooltip={t('app.kuaizhizao.warehouseCommon.colDeliveryFulfillmentTip', {
              delivered: formatQuantity(delivered),
              requested: formatQuantity(requested),
              percent,
            })}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colTargetLineSideWarehouse'),
      dataIndex: 'target_warehouse_name',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      hideInTable: taskType === 'backflush_alert',
      render: (_, r) => r.target_warehouse_name || r.suggested_warehouse_name || '-',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colNeededAt'),
      dataIndex: 'needed_at',
      width: 132,
      uniTableKeepWidth: true,
      hideInSearch: true,
      // 需求时间仅补料单有 needed_at
      hideInTable: taskType !== 'material_call',
      render: (_, r) => (r.needed_at ? formatDateTime(r.needed_at) : '-'),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colPriority'),
      dataIndex: 'priority',
      width: 90,
      valueType: 'select',
      valueEnum: {
        low: { text: t('app.kuaizhizao.warehouseCommon.priorityLow') },
        normal: { text: t('app.kuaizhizao.warehouseCommon.priorityNormal') },
        high: { text: t('app.kuaizhizao.warehouseCommon.priorityHigh') },
        urgent: { text: t('app.kuaizhizao.warehouseCommon.priorityUrgent') },
      },
      render: (_, r) => (
        <Tag color={resolveTaskPriorityTagColor(r.priority)}>
          {r.priority
            ? t(
                r.priority === 'low'
                  ? 'app.kuaizhizao.warehouseCommon.priorityLow'
                  : r.priority === 'high'
                    ? 'app.kuaizhizao.warehouseCommon.priorityHigh'
                    : r.priority === 'urgent'
                      ? 'app.kuaizhizao.warehouseCommon.priorityUrgent'
                      : 'app.kuaizhizao.warehouseCommon.priorityNormal',
              )
            : t('app.kuaizhizao.warehouseCommon.priorityNormal')}
        </Tag>
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      width: 110,
      hideInSearch: true,
      render: (_, r) => {
        const label = formatTaskStatusLabel(r, t);
        const statusTag = <Tag color={resolveTaskStatusTagColor(r.task_type, r.status)}>{label}</Tag>;
        if (r.sla_overdue) {
          return (
            <Space size={4}>
              <Tag color="error">{t('app.kuaizhizao.warehouseCommon.slaOverdue')}</Tag>
              {statusTag}
            </Space>
          );
        }
        return statusTag;
      },
    },
    ...buildDocumentAuditColumns<BatchingTaskRow>(t),
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const actions: React.ReactNode[] = [];
        const st = record.status === 'picking' ? 'processing' : record.status;
        const keyPrefix = `material-center-${record.task_type}-${record.task_id}`;
        if (record.task_type === 'proactive_prep') {
          if ((record.kitting_rate ?? 0) > 0) {
            actions.push(
              <Button
                key="create-batching"
                {...rowActionKind('execute')}
                size="small"
                onClick={() => handleProactivePrep(record)}
              >
                {pullFromWorkOrderAction.label}
              </Button>,
            );
          }
          return renderRowActionsOverflow(actions, { keyPrefix });
        }
        if (record.task_type === 'material_call') {
          if (canRead) {
            actions.push(
              <Button
                key="material-call-detail"
                {...rowActionKind('read')}
                size="small"
                onClick={() => onOpenDetail?.({ kind: 'material_call', id: record.task_id })}
              >
                {t('app.kuaizhizao.warehouseCommon.detail')}
              </Button>,
            );
          }
          if (st === 'pending') {
            actions.push(
              <Button
                key="start-picking"
                {...rowActionKind('execute')}
                size="small"
                icon={<ClockCircleOutlined />}
                onClick={() => handleMaterialCallUpdate(record.task_id, 'processing')}
              >
                {t('app.kuaizhizao.batchingCenter.startPicking')}
              </Button>,
            );
          }
          if (st === 'processing' || st === 'partial') {
            actions.push(
              <Button
                key="complete-call"
                {...rowActionKind('complete')}
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => openMaterialCallComplete(record)}
              >
                {t('app.kuaizhizao.warehouseCommon.complete')}
              </Button>,
            );
          }
          if (['pending', 'processing', 'partial', 'picking'].includes(record.status ?? '')) {
            actions.push(
              <Button
                key="cancel-call"
                {...rowActionKind('revoke')}
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: t('app.kuaizhizao.batchingCenter.confirmCancelTitle'),
                    content: t('app.kuaizhizao.batchingCenter.confirmCancelCall'),
                    onOk: () => handleMaterialCallUpdate(record.task_id, 'cancelled'),
                  });
                }}
              >
                {t('app.kuaizhizao.warehouseCommon.cancel')}
              </Button>,
            );
          }
          return actions.length ? renderRowActionsOverflow(actions, { keyPrefix }) : null;
        }
        if (record.task_type === 'batching_draft') {
          if (canRead) {
            actions.push(
              <Button
                key="batching-detail"
                {...rowActionKind('read')}
                size="small"
                onClick={() => onOpenDetail?.({ kind: 'batching_order', id: record.task_id })}
              >
                {t('app.kuaizhizao.warehouseCommon.detail')}
              </Button>,
            );
          }
          if (['draft', 'picking'].includes(record.status ?? '')) {
            actions.push(
              <Button
                key="refresh-shortage"
                {...rowActionKind('recycle')}
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleSyncBatchingDraft(record)}
              >
                {t('app.kuaizhizao.batchingCenter.refreshShortage')}
              </Button>,
            );
            actions.push(
              <Button
                key="confirm-batching"
                {...rowActionKind('execute')}
                size="small"
                onClick={() => openBatchingConfirm(record)}
              >
                {record.status === 'picking' ? t('app.kuaizhizao.batchingCenter.continuePickingAction') : t('app.kuaizhizao.batchingCenter.confirmPickingAction')}
              </Button>,
            );
          }
          return renderRowActionsOverflow(actions, { keyPrefix });
        }
        if (record.task_type === 'backflush_alert') {
          if (canRead) {
            actions.push(
              <Button
                key="backflush-detail"
                {...rowActionKind('read')}
                size="small"
                onClick={() => onOpenDetail?.({ kind: 'backflush_record', id: record.task_id })}
              >
                {t('app.kuaizhizao.warehouseCommon.detail')}
              </Button>,
            );
          }
          actions.push(
            <Button
              key="retry-backflush"
              {...rowActionKind('execute')}
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleBackflushRetry(record)}
            >
              {t('app.kuaizhizao.batchingCenter.retryBackflush')}
            </Button>,
          );
          return renderRowActionsOverflow(actions, { keyPrefix });
        }
        return null;
      },
    },
  ],
    [t, taskType, taskTypeLabel, taskTypeMap, onOpenDetail, canRead, pullFromWorkOrderAction.label],
  );

  const completeItems: any[] =
    completeMode === 'material_call'
      ? Array.isArray(completingRecord?.items)
        ? completingRecord!.items!
        : []
      : batchingItems;

  const completeBatchColumns: ColumnsType<any> = useMemo(
    () =>
      completeMode === 'batching'
        ? [
            { title: t('app.kuaizhizao.warehouseCommon.colMaterial'), key: 'mat', render: (_, it) => `${it.material_code ?? ''} ${it.material_name ?? ''}`.trim() },
            {
              title: t('app.kuaizhizao.batchingCenter.thisPick'),
              key: 'pick',
              width: 88,
              align: 'center',
              render: (_, it) => (
                <Form.Item name={`pick_${it.id}`} valuePropName="checked" initialValue style={{ marginBottom: 0 }}>
                  <Switch size="small" checkedChildren={t('app.kuaizhizao.warehouseCommon.yes')} unCheckedChildren={t('app.kuaizhizao.warehouseCommon.no')} />
                </Form.Item>
              ),
            },
            {
              title: t('app.kuaizhizao.warehouseCommon.colQuantity'),
              key: 'qty',
              width: 120,
              align: 'right',
              render: (_, it) => (
                <Form.Item noStyle shouldUpdate={(prev, cur) => prev[`pick_${it.id}`] !== cur[`pick_${it.id}`]}>
                  {({ getFieldValue }) => {
                    const enabled = getFieldValue(`pick_${it.id}`) !== false;
                    const maxQty = Number(it.required_quantity ?? 0);
                    return (
                      <Form.Item name={`qty_${it.id}`} style={{ marginBottom: 0 }}>
                        <InputNumber
                          size="small"
                          min={0}
                          max={maxQty > 0 ? maxQty : undefined}
                          precision={2}
                          disabled={!enabled}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              ),
            },
            {
              title: t('app.kuaizhizao.warehouseOutbound.col.stockQty'),
              key: 'stockQty',
              width: 100,
              align: 'right',
              render: (_, it) => {
                const mid = Number(it.material_id);
                if (!Number.isFinite(mid) || mid <= 0) return '—';
                if (batchOptionsLoading) return '…';
                const stock = sumInventoryPickOptionQty(batchOptionsByMaterialId[mid]);
                const need = Number(it.required_quantity ?? 0);
                const insufficient = need > 0 && stock < need;
                return (
                  <Typography.Text type={insufficient ? 'danger' : undefined} strong={insufficient}>
                    {formatQuantity(stock)}
                  </Typography.Text>
                );
              },
            },
            {
              title: t('app.kuaizhizao.warehouseCommon.colBatchNo'),
              key: 'batch',
              width: 240,
              render: (_, it: any) => (
                <Form.Item noStyle shouldUpdate={(prev, cur) => prev[`pick_${it.id}`] !== cur[`pick_${it.id}`]}>
                  {({ getFieldValue }) => {
                    const enabled = getFieldValue(`pick_${it.id}`) !== false;
                    if (!enabled) {
                      return (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {t('app.kuaizhizao.batchingCenter.skipThisPick')}
                        </Typography.Text>
                      );
                    }
                    const opts = batchOptionsByMaterialId[it.material_id] ?? [];
                    return (
                      <Form.Item name={`batch_${it.id}`} style={{ marginBottom: 0 }}>
                        <AutoComplete
                          size="small"
                          allowClear
                          options={opts}
                          placeholder={t('app.kuaizhizao.batchingCenter.batchPlaceholder')}
                          notFoundContent={batchOptionsLoading ? t('app.kuaizhizao.batchingCenter.loadingBatches') : t('app.kuaizhizao.batchingCenter.noMainWarehouseBatch')}
                        />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              ),
            },
          ]
        : [
            { title: t('app.kuaizhizao.warehouseCommon.colMaterial'), key: 'mat', render: (_, it) => `${it.material_code ?? ''} ${it.material_name ?? ''}`.trim() },
            {
              title: t('app.kuaizhizao.warehouseCommon.colQuantity'),
              key: 'qty',
              width: 100,
              align: 'right',
              render: (_, it) => it.requested_quantity ?? it.required_quantity ?? '-',
            },
            {
              title: t('app.kuaizhizao.warehouseOutbound.col.stockQty'),
              key: 'stockQty',
              width: 100,
              align: 'right',
              render: (_, it) => {
                const mid = Number(it.material_id);
                if (!Number.isFinite(mid) || mid <= 0) return '—';
                if (batchOptionsLoading) return '…';
                const stock = sumInventoryPickOptionQty(batchOptionsByMaterialId[mid]);
                const need = Number(it.requested_quantity ?? it.required_quantity ?? 0);
                const insufficient = need > 0 && stock < need;
                return (
                  <Typography.Text type={insufficient ? 'danger' : undefined} strong={insufficient}>
                    {formatQuantity(stock)}
                  </Typography.Text>
                );
              },
            },
            {
              title: t('app.kuaizhizao.warehouseCommon.colBatchNo'),
              key: 'batch',
              width: 260,
              render: (_, it: any) => {
                const opts = batchOptionsByMaterialId[it.material_id] ?? [];
                return (
                  <Form.Item
                    name={`batch_${it.id}`}
                    rules={[{ required: true, message: t('app.kuaizhizao.batchingCenter.selectOrEnterBatch') }]}
                    style={{ marginBottom: 0 }}
                  >
                    <AutoComplete
                      size="small"
                      allowClear
                      options={opts}
                      placeholder={t('app.kuaizhizao.batchingCenter.batchPlaceholder')}
                      notFoundContent={batchOptionsLoading ? t('app.kuaizhizao.batchingCenter.loadingBatches') : t('app.kuaizhizao.batchingCenter.noMainWarehouseBatch')}
                    />
                  </Form.Item>
                );
              },
            },
          ],
    [batchOptionsByMaterialId, batchOptionsLoading, completeMode, t],
  );

  return (
    <>
      <Modal
        title={
          completeMode === 'material_call'
            ? t('app.kuaizhizao.batchingCenter.confirmCompleteCall')
            : completingRecord?.status === 'picking'
              ? t('app.kuaizhizao.batchingCenter.continuePicking')
              : t('app.kuaizhizao.batchingCenter.confirmPicking')
        }
        open={completeOpen}
        okText={t('app.kuaizhizao.warehouseCommon.confirm')}
        cancelText={t('app.kuaizhizao.warehouseCommon.cancel')}
        confirmLoading={completeSubmitting}
        destroyOnHidden
        width={840}
        onCancel={() => {
          setCompleteOpen(false);
          setCompletingRecord(null);
          setPendingCompleteFormValues(null);
        }}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingCompleteFormValues) {
              completeForm.setFieldsValue(pendingCompleteFormValues);
            }
            return;
          }
          completeForm.resetFields();
          setPendingCompleteFormValues(null);
        }}
        onOk={submitComplete}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          {completeMode === 'batching'
            ? t('app.kuaizhizao.batchingCenter.batchingHint')
            : t('app.kuaizhizao.batchingCenter.callHint')}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          {t('app.kuaizhizao.batchingCenter.configCenterHint')}{' '}
          <Link to="/system/config-center">{t('app.kuaizhizao.batchingCenter.configCenter')}</Link>
        </Typography.Paragraph>
        <Form form={completeForm} component={false}>
          <Table
            size="small"
            rowKey={(it) => String(it.id ?? it.material_id)}
            columns={completeBatchColumns}
            dataSource={completeItems}
            pagination={false}
            scroll={{ y: 320 }}
          />
        </Form>
      </Modal>

      <UniTable<BatchingTaskRow>
        actionRef={actionRef}
        rowKey={(r) => `${r.task_type}-${r.task_id}`}
        columns={columns}
        columnPersistenceId={`apps.kuaizhizao.pages.warehouse-management.batching-center.tasks.${taskType}.v3`}
        showAdvancedSearch
        polling={false}
        scroll={{ x: 1400 }}
        showCreateButton={Boolean(onCreate)}
        onCreate={onCreate}
        createButtonText={t('app.kuaizhizao.batchingCenter.createBatchingOrder')}
        expandable={{
          rowExpandable: (r) => r.task_type === 'material_call' && Array.isArray(r.items) && r.items.length > 0,
          expandedRowRender: (r) => (
            <Table
              size="small"
              pagination={false}
              rowKey={(it: any) => String(it.id ?? it.material_id)}
              dataSource={r.items ?? []}
              columns={[
                { title: t('app.kuaizhizao.warehouseCommon.colLineNo'), dataIndex: 'line_no', width: 56 },
                {
                  title: t('app.kuaizhizao.warehouseCommon.colMaterialCode'),
                  dataIndex: 'material_code',
                  width: 140,
                  render: (value: unknown, it: any) =>
                    String(value ?? '').trim() || String(it.material_id ?? '-'),
                },
                {
                  title: t('app.kuaizhizao.warehouseCommon.colMaterialName'),
                  dataIndex: 'material_name',
                  width: 180,
                  render: (value: unknown) => String(value ?? '').trim() || '-',
                },
                {
                  title: t('app.kuaizhizao.warehouseCommon.colUnit'),
                  dataIndex: 'material_unit',
                  width: 90,
                  render: (value: unknown) => String(value ?? '').trim() || '-',
                },
                {
                  title: t('app.kuaizhizao.warehouseCommon.colDemandQty'),
                  dataIndex: 'requested_quantity',
                  align: 'right',
                  width: 110,
                  render: (value: unknown) => formatQuantity(value),
                },
                {
                  title: t('app.kuaizhizao.warehouseCommon.colDeliveredQty'),
                  dataIndex: 'delivered_quantity',
                  align: 'right',
                  width: 110,
                  render: (value: unknown) => formatQuantity(value),
                },
                {
                  title: t('app.kuaizhizao.warehouseInbound.col.pendingQty'),
                  key: 'pending_quantity',
                  align: 'right',
                  width: 110,
                  render: (_: unknown, it: any) =>
                    formatQuantity(
                      Number(it.requested_quantity ?? 0) - Number(it.delivered_quantity ?? 0),
                    ),
                },
              ]}
            />
          ),
        }}
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const listParams = resolveBatchingCenterTaskListParams(searchFormValues, sort);
            const res = await batchingOrderApi.listTasks({
              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
              limit: params.pageSize ?? 20,
              task_type: taskType,
              ...listParams,
              ...(workOrderCodeFilter
                ? { work_order_code: workOrderCodeFilter }
                : {}),
            });
            const { data, total } = normalizeWarehouseListResponse(res);
            return { data, total, success: true };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        params={{ workOrderCodeFilter: workOrderCodeFilter || '' }}
        skipFuzzyPinyinClientFilter
      />
      {lineSideWarehouseModal}
    </>
  );
};

export default BatchingTaskQueue;
