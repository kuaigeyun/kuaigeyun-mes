/**
 * 现场叫料监控页面
 * 
 * 仓库端用于实时查看并处理来自生产现场的叫料请求。
 * 支持 待处理 -> 配料中 -> 已完成 的状态流转。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Typography, Table, Form, AutoComplete } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import { apiRequest } from '../../../../../services/api';
import { warehouseApi } from '../../../services/warehouse-execution';
import { getMaterialCallLifecycle } from '../../../utils/materialCallLifecycle';

type BatchPickOption = { value: string; label: string };

const MaterialCallsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completingRecord, setCompletingRecord] = useState<any>(null);
  const [completeSubmitting, setCompleteSubmitting] = useState(false);
  const [completeForm] = Form.useForm();
  const [batchOptionsByMaterialId, setBatchOptionsByMaterialId] = useState<Record<number, BatchPickOption[]>>({});
  const [batchOptionsLoading, setBatchOptionsLoading] = useState(false);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  /**
   * 处理叫料请求状态流转
   */
  const handleHandleCall = async (
    id: number,
    status: 'processing' | 'completed' | 'cancelled',
    completion_batches?: { item_id: number; batch_no: string }[],
  ) => {
    try {
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
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  const openCompleteModal = (record: any) => {
    const items = Array.isArray(record?.items) ? record.items : [];
    if (items.length === 0) {
      Modal.confirm({
        title: '确认完成',
        content: '该叫料单无明细行，确认标记为已完成？',
        onOk: async () => {
          await handleHandleCall(record.id, 'completed');
        },
      });
      return;
    }
    setCompletingRecord(record);
    completeForm.resetFields();
    setCompleteOpen(true);
  };

  const submitCompleteWithBatches = async () => {
    if (!completingRecord?.id) return;
    const items: any[] = Array.isArray(completingRecord.items) ? completingRecord.items : [];
    try {
      const vals = await completeForm.validateFields();
      const completion_batches = items.map((it) => ({
        item_id: it.id,
        batch_no: String(vals[`batch_${it.id}`] ?? '').trim(),
      }));
      if (completion_batches.some((b) => !b.batch_no)) {
        messageApi.warning('请填写全部明细的批号');
        return;
      }
      setCompleteSubmitting(true);
      await handleHandleCall(completingRecord.id, 'completed', completion_batches);
      setCompleteOpen(false);
      setCompletingRecord(null);
    } catch {
      /* 校验失败或接口错误（错误提示已在 handleHandleCall 中抛出前展示） */
    } finally {
      setCompleteSubmitting(false);
    }
  };

  /** 打开完成弹窗后加载主仓可用批次，供下拉选择（仍可手输/扫码覆盖） */
  useEffect(() => {
    if (!completeOpen || !completingRecord?.items?.length) {
      setBatchOptionsByMaterialId({});
      return;
    }
    const mids = [
      ...new Set(
        completingRecord.items.map((x: { material_id?: number }) => x.material_id).filter(Boolean) as number[],
      ),
    ];
    if (!mids.length) return;

    let cancelled = false;
    (async () => {
      setBatchOptionsLoading(true);
      try {
        const res = await apiRequest<{ items?: Record<string, unknown>[] }>(
          '/apps/kuaizhizao/reports/inventory/batch-query',
          {
            method: 'GET',
            params: { material_ids: mids, include_expired: false },
          },
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
          if (row.status === '已过期' || row.status === '无库存') continue;
          const bn = String(row.batch_no ?? '').trim();
          if (!bn) continue;
          if (!map[mid]) map[mid] = [];
          if (map[mid].some((o) => o.value === bn)) continue;
          map[mid].push({ value: bn, label: `${bn}（可用 ${qty}）` });
        }
        for (const k of Object.keys(map)) {
          map[+k].sort((a, b) => a.value.localeCompare(b.value, 'zh-CN'));
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
  }, [completeOpen, completingRecord?.id]);

  const columns: ProColumns[] = [
    {
      title: '叫料单号',
      dataIndex: 'code',
      width: 140,
      fixed: 'left',
      render: (_, r: any) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '关联工单',
      dataIndex: 'work_order_code',
      width: 140,
      render: (_, r: any) => (
        <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }} ellipsis>
          {r.work_order_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '叫料类型',
      dataIndex: 'call_type',
      width: 110,
      hideInSearch: true,
      render: (_, r: any) => (
        <DictionaryLabel dictionaryCode="MATERIAL_CALL_TYPE" value={r.call_type} notFoundPlaceholder="—" />
      ),
    },
    {
      title: '叫料原因',
      dataIndex: 'call_reason',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r: any) =>
        (r.call_type === 'CUSTOM_SELECTION' || r.call_type === 'SINGLE_MATERIAL') && r.call_reason ? (
          <DictionaryLabel dictionaryCode="MATERIAL_CALL_REASON" value={r.call_reason} notFoundPlaceholder="—" />
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: '物料信息',
      key: 'material',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.material_name}</div>
          <div style={{ fontSize: '11px', color: '#666' }}>{record.material_code}</div>
        </div>
      ),
    },
    {
      title: '叫料数量',
      dataIndex: 'requested_quantity',
      width: 100,
      align: 'right',
      render: (val, record: any) => {
        const q = val ?? record.quantity ?? record.requested_quantity;
        return (
          <Typography.Text strong>
            {q} {record.unit || record.material_unit || ''}
          </Typography.Text>
        );
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      valueType: 'select',
      valueEnum: {
        low: { text: '低', status: 'Default' },
        normal: { text: '正常', status: 'Processing' },
        high: { text: '高', status: 'Warning' },
        urgent: { text: '紧急', status: 'Error' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: {
        pending: { text: '待处理', status: 'Warning' },
        processing: { text: '配料中', status: 'Processing' },
        partial: { text: '部分送达', status: 'Processing' },
        completed: { text: '已完成', status: 'Success' },
        cancelled: { text: '已取消', status: 'Default' },
      },
    },
    {
      title: '叫料人',
      dataIndex: 'caller_name',
      width: 100,
      render: (_, r: any) => r.caller_name ?? r.created_by_name ?? '-',
    },
    {
      title: '叫料时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, r: any) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      ellipsis: true,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 140,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getMaterialCallLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record: any) => {
        const st = record.status === 'picking' ? 'processing' : record.status;
        return (
          <Space>
            {st === 'pending' && (
              <Button
                type="link"
                size="small"
                icon={<ClockCircleOutlined />}
                onClick={() => handleHandleCall(record.id, 'processing')}
              >
                开始配料
              </Button>
            )}
            {(st === 'processing' || st === 'partial') && (
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => openCompleteModal(record)}
                style={{ color: '#52c41a' }}
              >
                完成
              </Button>
            )}
            {['pending', 'processing', 'partial', 'picking'].includes(record.status) && (
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  Modal.confirm({
                    title: '确认取消',
                    content: '确认要取消该叫料请求吗？',
                    onOk: async () => {
                      await handleHandleCall(record.id, 'cancelled');
                    },
                  });
                }}
              >
                取消
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const completeItems: any[] = Array.isArray(completingRecord?.items) ? completingRecord.items : [];

  const completeBatchColumns: ColumnsType<any> = [
    {
      title: '行',
      dataIndex: 'line_no',
      width: 52,
      align: 'center',
    },
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 112,
      ellipsis: true,
      render: (v) => v ?? '—',
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      ellipsis: true,
      render: (v) => v ?? '—',
    },
    {
      title: '需求数量',
      key: 'qty',
      width: 128,
      align: 'right',
      render: (_, it) =>
        it.requested_quantity != null
          ? `${it.requested_quantity}${it.material_unit ? ` ${it.material_unit}` : ''}`
          : '—',
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
              filterOption={(input, option) => {
                const q = (input || '').toLowerCase();
                const lab = String(option?.label ?? '').toLowerCase();
                const val = String(option?.value ?? '').toLowerCase();
                return lab.includes(q) || val.includes(q);
              }}
              notFoundContent={batchOptionsLoading ? '加载批次…' : '无主仓可选批次，请手输'}
            />
          </Form.Item>
        );
      },
    },
  ];

  return (
    <ListPageTemplate>
      <Modal
        title="确认完成叫料"
        open={completeOpen}
        okText="确认完成"
        cancelText="取消"
        confirmLoading={completeSubmitting}
        destroyOnClose
        width={840}
        styles={{ body: { paddingTop: 12 } }}
        onCancel={() => {
          setCompleteOpen(false);
          setCompletingRecord(null);
        }}
        onOk={submitCompleteWithBatches}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          请核对实物标签上的批号：可从下拉选择主仓可用批次，或直接扫描/输入。启用批号管理的物料将按所填批号出库。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
          先进先出（FIFO）、后进先出（LIFO）等出库策略在{' '}
          <Link to="/system/config-center">系统 → 配置中心</Link> 的仓储参数中维护（如「先进先出」「后进先出」开关），用于未指定批号时的分摊与防呆校验；本页指定批号后以所选批号为准。
        </Typography.Paragraph>
        {completingRecord?.code ? (
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            叫料单号：<Typography.Text strong>{completingRecord.code}</Typography.Text>
          </Typography.Text>
        ) : null}
        <Form form={completeForm} component={false}>
          <Table<any>
            size="small"
            rowKey={(it) => String(it.id ?? `${it.material_id}-${it.line_no}`)}
            columns={completeBatchColumns}
            dataSource={completeItems}
            pagination={false}
            scroll={{ x: 680, y: Math.min(completeItems.length * 46 + 40, 420) }}
          />
        </Form>
      </Modal>
      <UniTable
        headerTitle="现场叫料实时监控"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.material-calls"
        showAdvancedSearch={true}
        expandable={{
          rowExpandable: (r: any) => Array.isArray(r?.items) && r.items.length > 0,
          expandedRowRender: (r: any) => (
            <Table
              size="small"
              pagination={false}
              rowKey={(it: any) => String(it.id ?? `${it.material_id}-${it.line_no}`)}
              dataSource={r.items ?? []}
              columns={[
                {
                  title: '行',
                  dataIndex: 'line_no',
                  width: 56,
                },
                {
                  title: '物料',
                  key: 'mat',
                  render: (_: unknown, it: any) =>
                    `${it.material_code ?? ''} ${it.material_name ?? ''}`.trim() || '—',
                },
                {
                  title: '需求',
                  dataIndex: 'requested_quantity',
                  align: 'right',
                  width: 100,
                },
                {
                  title: '已送',
                  dataIndex: 'delivered_quantity',
                  align: 'right',
                  width: 100,
                },
              ]}
            />
          ),
        }}
        request={async (params) => {
          try {
            const res = await warehouseApi.materialCall.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              status: params.status,
              work_order_code: params.work_order_code,
            });
            const rows = Array.isArray(res) ? res : (res as { items?: unknown[] })?.items ?? [];
            const pageSize = params.pageSize || 20;
            const skip = (params.current! - 1) * pageSize;
            const total = Array.isArray(res)
              ? rows.length < pageSize
                ? skip + rows.length
                : skip + rows.length + 1
              : (res as { total?: number }).total ?? rows.length;
            return {
              data: rows as any[],
              total,
              success: true,
            };
          } catch (error) {
            return { data: [], success: false, total: 0 };
          }
        }}
        polling={10000}
        scroll={{ x: 1400 }}
      />
    </ListPageTemplate>
  );
};

export default MaterialCallsPage;
