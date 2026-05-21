/**
 * 配料中心统一任务队列（主动备料 + 叫料 + 配料单 + 倒冲预警）
 */
import React, { useEffect, useRef, useState } from 'react';
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
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { apiRequest } from '../../../../../services/api';
import { warehouseApi } from '../../../services/warehouse-execution';
import { batchingOrderApi } from '../../../services/batching-order';
import { getBatchingOrderStageName } from '../../../utils/batchingOrderLifecycle';
import { WorkOrderScoreCell } from '../../../components/WorkOrderScoreCell';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';

type BatchPickOption = { value: string; label: string };

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
  material_unit?: string;
  caller_name?: string;
  created_at?: string;
  updated_at?: string;
  score_breakdown?: Record<string, unknown>;
  suggested_warehouse_id?: number;
  suggested_warehouse_name?: string;
  items?: Record<string, unknown>[];
  error_message?: string;
};

const TASK_TYPE_MAP: Record<string, { text: string; color: string }> = {
  proactive_prep: { text: '主动备料', color: 'blue' },
  material_call: { text: '现场叫料', color: 'orange' },
  batching_draft: { text: '配料单', color: 'green' },
  backflush_alert: { text: '倒冲预警', color: 'red' },
};

const PROACTIVE_PREP_STATUS: Record<string, string> = {
  pending_prep: '待配料',
};

const MATERIAL_CALL_STATUS: Record<string, string> = {
  pending: '待处理',
  processing: '配料中',
  partial: '部分送达',
  completed: '已完成',
  cancelled: '已取消',
  picking: '配料中',
};

const BACKFLUSH_STATUS: Record<string, string> = {
  failed: '倒冲失败',
  success: '倒冲成功',
};

function formatTaskStatusLabel(r: BatchingTaskRow): string {
  const st = String(r.status ?? '').trim();
  if (!st) return '-';
  switch (r.task_type) {
    case 'proactive_prep':
      return PROACTIVE_PREP_STATUS[st] ?? st;
    case 'material_call':
      return MATERIAL_CALL_STATUS[st] ?? st;
    case 'batching_draft':
      return getBatchingOrderStageName(st);
    case 'backflush_alert':
      return BACKFLUSH_STATUS[st] ?? st;
    default:
      return st;
  }
}

function formatTaskDateTime(value?: string): string {
  if (!value) return '-';
  const d = dayjs(value);
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm:ss') : value;
}

type Props = {
  onCreate?: () => void;
  onOpenBatchingDetail?: (orderId: number) => void;
  onRefreshBatchingList?: () => void;
};

const BatchingTaskQueue: React.FC<Props> = ({ onCreate, onOpenBatchingDetail, onRefreshBatchingList }) => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeMode, setCompleteMode] = useState<'material_call' | 'batching'>('material_call');
  const [completingRecord, setCompletingRecord] = useState<BatchingTaskRow | null>(null);
  const [batchingItems, setBatchingItems] = useState<any[]>([]);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [completeForm] = Form.useForm();
  const [batchOptionsByMaterialId, setBatchOptionsByMaterialId] = useState<Record<number, BatchPickOption[]>>({});
  const [batchOptionsLoading, setBatchOptionsLoading] = useState(false);

  const reload = () => {
    actionRef.current?.reload();
    invalidateMenuBadgeCounts();
    onRefreshBatchingList?.();
  };

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
      processing: '已开始配料',
      completed: '叫料已完成',
      cancelled: '叫料已取消',
    };
    messageApi.success(statusMap[status] || '操作成功');
    reload();
  };

  const openMaterialCallComplete = (record: BatchingTaskRow) => {
    const items = Array.isArray(record?.items) ? record.items : [];
    if (items.length === 0) {
      Modal.confirm({
        title: '确认完成',
        content: '该叫料单无明细行，确认标记为已完成？',
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
        messageApi.info('所有明细已配料完成');
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
      completeForm.setFieldsValue(initial);
      setCompleteOpen(true);
      reload();
    } catch (e: any) {
      messageApi.error(e.message || '加载配料单失败');
    }
  };

  const handleSyncBatchingDraft = async (record: BatchingTaskRow) => {
    try {
      const detail = await batchingOrderApi.syncFromWorkOrder(record.task_id);
      const count = detail?.items?.length ?? 0;
      messageApi.success(count > 0 ? `已同步 ${count} 项缺料` : '当前无待配料缺料行');
      reload();
    } catch (e: any) {
      messageApi.error(e.message || '同步缺料失败');
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
          messageApi.warning('请填写全部明细的批号');
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
            messageApi.warning(`请填写 ${it.material_name ?? it.material_code} 的批号，或关闭「本次配料」跳过`);
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
          messageApi.warning('请至少选择一项进行配料');
          return;
        }
        const result = await batchingOrderApi.confirm(String(completingRecord.task_id), { item_batches });
        const st = (result as { status?: string })?.status;
        messageApi.success(st === 'completed' ? '配料确认成功' : '部分配料完成，剩余行可继续配料');
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
      await batchingOrderApi.pullFromWorkOrder({
        work_order_id: record.work_order_id,
        warehouse_id: record.suggested_warehouse_id,
        warehouse_name: record.suggested_warehouse_name,
        allow_existing_draft: true,
      });
      messageApi.success('已生成配料单');
      reload();
    } catch (e: any) {
      messageApi.error(e.message || '生成配料单失败');
    }
  };

  const handleBackflushRetry = async (record: BatchingTaskRow) => {
    try {
      await warehouseApi.backflushRecords.retry(String(record.task_id));
      messageApi.success('倒冲重试已提交');
      reload();
    } catch (e: any) {
      messageApi.error(e.message || '重试失败');
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
            row.warehouse_name === '主仓' ||
            (typeof row.id === 'number' && row.id >= 1_000_000 && row.id < 2_000_000);
          if (!isMainBatch) continue;
          const qty = Number(row.quantity ?? 0);
          if (qty <= 0) continue;
          const bn = String(row.batch_no ?? '').trim();
          if (!bn) continue;
          if (!map[mid]) map[mid] = [];
          if (map[mid].some((o) => o.value === bn)) continue;
          map[mid].push({ value: bn, label: `${bn}（可用 ${qty}）` });
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
  }, [completeOpen, completeMode, completingRecord?.task_id, batchingItems]);

  const columns: ProColumns<BatchingTaskRow>[] = [
    {
      title: '任务类型',
      dataIndex: 'task_type',
      width: 110,
      valueType: 'select',
      valueEnum: {
        proactive_prep: { text: '主动备料' },
        material_call: { text: '现场叫料' },
        batching_draft: { text: '配料单' },
        backflush_alert: { text: '倒冲预警' },
      },
      render: (_, r) => {
        const m = TASK_TYPE_MAP[r.task_type] ?? { text: r.task_type, color: 'default' };
        return <Tag color={m.color}>{m.text}</Tag>;
      },
    },
    {
      title: '单号/工单',
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
      title: '产品/物料',
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
      title: '备料分',
      dataIndex: 'picking_score',
      width: 120,
      hideInSearch: true,
      render: (_, r) => (
        <WorkOrderScoreCell
          score={r.picking_score}
          rankBand={r.picking_rank_band}
          breakdown={r.score_breakdown}
        />
      ),
    },
    {
      title: '齐套率',
      dataIndex: 'kitting_rate',
      width: 90,
      hideInSearch: true,
      render: (_, r) =>
        r.kitting_rate != null ? <Tag color="green">{Math.round(r.kitting_rate)}%</Tag> : '-',
    },
    {
      title: '数量',
      dataIndex: 'requested_quantity',
      width: 90,
      hideInSearch: true,
      align: 'right',
      render: (_, r) =>
        r.requested_quantity != null
          ? `${r.requested_quantity}${r.material_unit ? ` ${r.material_unit}` : ''}`
          : '-',
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      valueType: 'select',
      valueEnum: {
        low: { text: '低' },
        normal: { text: '正常' },
        high: { text: '高' },
        urgent: { text: '紧急' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      hideInSearch: true,
      render: (_, r) => {
        const label = formatTaskStatusLabel(r);
        if (r.sla_overdue) {
          return (
            <Space size={4}>
              <Tag color="error">超时</Tag>
              <span>{label}</span>
            </Space>
          );
        }
        return label;
      },
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 180,
      hideInSearch: true,
      render: (_, r) => formatTaskDateTime(r.updated_at || r.created_at),
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const st = record.status === 'picking' ? 'processing' : record.status;
        if (record.task_type === 'proactive_prep') {
          return (
            <Button type="link" size="small" onClick={() => handleProactivePrep(record)}>
              一键配料
            </Button>
          );
        }
        if (record.task_type === 'material_call') {
          return (
            <Space>
              {st === 'pending' && (
                <Button
                  type="link"
                  size="small"
                  icon={<ClockCircleOutlined />}
                  onClick={() => handleMaterialCallUpdate(record.task_id, 'processing')}
                >
                  开始配料
                </Button>
              )}
              {(st === 'processing' || st === 'partial') && (
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{ color: '#52c41a' }}
                  onClick={() => openMaterialCallComplete(record)}
                >
                  完成
                </Button>
              )}
              {['pending', 'processing', 'partial', 'picking'].includes(record.status ?? '') && (
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    Modal.confirm({
                      title: '确认取消',
                      content: '确认要取消该叫料请求吗？',
                      onOk: () => handleMaterialCallUpdate(record.task_id, 'cancelled'),
                    });
                  }}
                >
                  取消
                </Button>
              )}
            </Space>
          );
        }
        if (record.task_type === 'batching_draft') {
          return (
            <Space>
              <Button type="link" size="small" onClick={() => onOpenBatchingDetail?.(record.task_id)}>
                详情
              </Button>
              {['draft', 'picking'].includes(record.status ?? '') && (
                <>
                  <Button
                    type="link"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => handleSyncBatchingDraft(record)}
                  >
                    刷新缺料
                  </Button>
                  <Button type="link" size="small" onClick={() => openBatchingConfirm(record)}>
                    {record.status === 'picking' ? '继续配料' : '确认配料'}
                  </Button>
                </>
              )}
            </Space>
          );
        }
        if (record.task_type === 'backflush_alert') {
          return (
            <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleBackflushRetry(record)}>
              重试倒冲
            </Button>
          );
        }
        return null;
      },
    },
  ];

  const completeItems: any[] =
    completeMode === 'material_call'
      ? Array.isArray(completingRecord?.items)
        ? completingRecord!.items!
        : []
      : batchingItems;

  const completeBatchColumns: ColumnsType<any> =
    completeMode === 'batching'
      ? [
          { title: '物料', key: 'mat', render: (_, it) => `${it.material_code ?? ''} ${it.material_name ?? ''}`.trim() },
          {
            title: '本次配料',
            key: 'pick',
            width: 88,
            align: 'center',
            render: (_, it) => (
              <Form.Item name={`pick_${it.id}`} valuePropName="checked" initialValue style={{ marginBottom: 0 }}>
                <Switch size="small" checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            ),
          },
          {
            title: '数量',
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
            title: '批号',
            key: 'batch',
            width: 240,
            render: (_, it: any) => (
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev[`pick_${it.id}`] !== cur[`pick_${it.id}`]}>
                {({ getFieldValue }) => {
                  const enabled = getFieldValue(`pick_${it.id}`) !== false;
                  if (!enabled) {
                    return (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        本次不配料
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
                        placeholder="下拉选择或扫描/输入批号"
                        notFoundContent={batchOptionsLoading ? '加载批次…' : '无主仓可选批次，请手输'}
                      />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            ),
          },
        ]
      : [
          { title: '物料', key: 'mat', render: (_, it) => `${it.material_code ?? ''} ${it.material_name ?? ''}`.trim() },
          {
            title: '数量',
            key: 'qty',
            width: 100,
            align: 'right',
            render: (_, it) => it.requested_quantity ?? it.required_quantity ?? '-',
          },
          {
            title: '批号',
            key: 'batch',
            width: 260,
            render: (_, it: any) => {
              const opts = batchOptionsByMaterialId[it.material_id] ?? [];
              return (
                <Form.Item
                  name={`batch_${it.id}`}
                  rules={[{ required: true, message: '请选择或输入批号' }]}
                  style={{ marginBottom: 0 }}
                >
                  <AutoComplete
                    size="small"
                    allowClear
                    options={opts}
                    placeholder="下拉选择或扫描/输入批号"
                    notFoundContent={batchOptionsLoading ? '加载批次…' : '无主仓可选批次，请手输'}
                  />
                </Form.Item>
              );
            },
          },
        ];

  return (
    <>
      <Modal
        title={
          completeMode === 'material_call'
            ? '确认完成叫料'
            : completingRecord?.status === 'picking'
              ? '继续配料（主仓→线边）'
              : '确认配料（主仓→线边）'
        }
        open={completeOpen}
        okText="确认"
        cancelText="取消"
        confirmLoading={completeSubmitting}
        destroyOnClose
        width={840}
        onCancel={() => {
          setCompleteOpen(false);
          setCompletingRecord(null);
        }}
        onOk={submitComplete}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          {completeMode === 'batching'
            ? '可关闭「本次配料」跳过部分行，或调整数量；至少需确认一行。未指定批号时按配置中心 FIFO 策略出库。'
            : '请核对批号；未指定时按配置中心 FIFO 策略出库。'}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
          仓储参数见 <Link to="/system/config-center">配置中心</Link>。
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
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.batching-center.tasks"
        showAdvancedSearch
        polling={10000}
        scroll={{ x: 1400 }}
        toolBarRender={
          onCreate
            ? () => [
                <Button key="create" type="primary" icon={<PlusOutlined />} onClick={onCreate}>
                  新建配料单
                </Button>,
              ]
            : undefined
        }
        expandable={{
          rowExpandable: (r) => r.task_type === 'material_call' && Array.isArray(r.items) && r.items.length > 0,
          expandedRowRender: (r) => (
            <Table
              size="small"
              pagination={false}
              rowKey={(it: any) => String(it.id ?? it.material_id)}
              dataSource={r.items ?? []}
              columns={[
                { title: '行', dataIndex: 'line_no', width: 56 },
                {
                  title: '物料',
                  key: 'mat',
                  render: (_: unknown, it: any) =>
                    `${it.material_code ?? ''} ${it.material_name ?? ''}`.trim(),
                },
                { title: '需求', dataIndex: 'requested_quantity', align: 'right', width: 100 },
                { title: '已送', dataIndex: 'delivered_quantity', align: 'right', width: 100 },
              ]}
            />
          ),
        }}
        request={async (params) => {
          try {
            const res = await batchingOrderApi.listTasks({
              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
              limit: params.pageSize ?? 20,
              task_type: params.task_type,
              status: params.status,
              work_order_code: params.doc_code || params.work_order_code,
              priority: params.priority,
            });
            return {
              data: res.items ?? [],
              total: res.total ?? 0,
              success: true,
            };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
      />
    </>
  );
};

export default BatchingTaskQueue;
