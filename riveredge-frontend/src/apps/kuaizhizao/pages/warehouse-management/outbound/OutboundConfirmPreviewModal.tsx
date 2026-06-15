/**
 * 出库 Hub — 统一确认预览 Modal（批号/库位/序列号）
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { App, AutoComplete, Form, Modal, Select, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SerialNumbersImportTrigger } from '../../../../../components/serial-numbers-import';
import { apiRequest } from '../../../../../services/api';
import { warehouseApi } from '../../../services/warehouse-execution';
import { outsourceMaterialIssueApi } from '../../../services/production';
import { fetchStorageLocationsForWarehouse } from '../inbound/inboundPoReceiptEntryUtils';
import {
  buildOutboundConfirmPayloadFromForm,
  loadConfirmPreviewMaterialMeta,
  type ConfirmPreviewMaterialMeta,
} from './outboundItemTracking';
import type { OutboundHubOrder } from './outboundHubTypes';
import { OUTBOUND_ISSUE_TYPE_LABELS, outboundDocumentCode } from './outboundHubTypes';

type SalesBatchPickOption = { value: string; label: string };

function normalizeBatchFormValue(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw).trim();
  if (typeof raw === 'object' && raw !== null && 'value' in (raw as object)) {
    const v = (raw as { value?: unknown }).value;
    return v != null && v !== '' ? String(v).trim() : '';
  }
  return String(raw).trim();
}

async function fetchOutboundDetail(record: OutboundHubOrder): Promise<Record<string, unknown> | null> {
  const id = String(record.id);
  if (record.outbound_type === 'production_picking') {
    return (await warehouseApi.productionPicking.get(id)) as Record<string, unknown>;
  }
  if (record.outbound_type === 'sales_delivery') {
    return (await warehouseApi.salesDelivery.get(id)) as Record<string, unknown>;
  }
  if (record.outbound_type === 'other_outbound') {
    return (await warehouseApi.otherOutbound.get(id)) as Record<string, unknown>;
  }
  if (record.outbound_type === 'material_borrow') {
    return (await warehouseApi.materialBorrow.get(id)) as Record<string, unknown>;
  }
  if (record.outbound_type === 'outsource_issue') {
    return (await outsourceMaterialIssueApi.get(id)) as Record<string, unknown>;
  }
  return null;
}

function parseConfirmResult(raw: unknown): { status?: string } {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  if (typeof o.status === 'string') return { status: o.status };
  const inner = o.data;
  if (inner && typeof inner === 'object' && typeof (inner as Record<string, unknown>).status === 'string') {
    return { status: (inner as { status: string }).status };
  }
  return {};
}

export type OutboundConfirmPreviewModalProps = {
  open: boolean;
  record: OutboundHubOrder | null;
  executionConfig: { current_user_can_confirm_picking?: boolean } | null;
  onClose: () => void;
  onSuccess: () => void;
};

const OutboundConfirmPreviewModal: React.FC<OutboundConfirmPreviewModalProps> = ({
  open,
  record,
  executionConfig,
  onClose,
  onSuccess,
}) => {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [materialMeta, setMaterialMeta] = useState<Record<number, ConfirmPreviewMaterialMeta>>({});
  const [batchOptionsByMaterialId, setBatchOptionsByMaterialId] = useState<
    Record<number, SalesBatchPickOption[]>
  >({});
  const [batchOptionsLoading, setBatchOptionsLoading] = useState(false);
  const [locationOptionsByWh, setLocationOptionsByWh] = useState<
    Record<number, { value: number; label: string; code: string }[]>
  >({});

  const outboundType = record?.outbound_type;

  const activeLines: Record<string, unknown>[] = useMemo(() => {
    const items = Array.isArray(detail?.items) ? detail!.items as Record<string, unknown>[] : [];
    if (outboundType === 'sales_delivery') {
      return items.filter((it) => Number(it.delivery_quantity ?? 0) > 0);
    }
    if (outboundType === 'production_picking') {
      return items.filter((it) => Number(it.picked_quantity ?? it.required_quantity ?? 0) > 0);
    }
    if (outboundType === 'other_outbound') {
      return items.filter((it) => Number(it.outbound_quantity ?? 0) > 0);
    }
    if (outboundType === 'material_borrow') {
      return items.filter((it) => Number(it.borrow_quantity ?? 0) > 0);
    }
    return items;
  }, [detail, outboundType]);

  useEffect(() => {
    if (!open || !record?.id || !record.outbound_type) {
      setDetail(null);
      form.resetFields();
      return;
    }
    if (
      record.outbound_type === 'production_picking' &&
      executionConfig &&
      executionConfig.current_user_can_confirm_picking === false
    ) {
      messageApi.warning('当前业务配置下，您无权限确认生产领料');
      onClose();
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const detailData = await fetchOutboundDetail(record);
        if (cancelled || !detailData) {
          messageApi.error('获取出库单详情失败');
          onClose();
          return;
        }
        setDetail(detailData);
        const items = Array.isArray(detailData.items) ? detailData.items as Record<string, unknown>[] : [];
        const meta = await loadConfirmPreviewMaterialMeta(
          items.map((it) => ({
            id: Number(it.id),
            material_code: String(it.material_code ?? ''),
            serial_numbers: it.serial_numbers as string[] | null | undefined,
          })),
        );
        if (!cancelled) setMaterialMeta(meta);

        const init: Record<string, unknown> = {};
        items.forEach((it) => {
          const lineId = Number(it.id);
          if (!Number.isFinite(lineId)) return;
          init[`batch_${lineId}`] = it.batch_number ? String(it.batch_number) : '';
          init[`location_${lineId}`] = it.location_id ?? undefined;
          init[`location_code_${lineId}`] = it.location_code ?? '';
          init[`serial_${lineId}`] = Array.isArray(it.serial_numbers) ? it.serial_numbers : [];
        });
        form.setFieldsValue(init);

        const whId = Number(detailData.warehouse_id ?? record.warehouse_id ?? 0);
        if (whId > 0) {
          try {
            const opts = await fetchStorageLocationsForWarehouse(whId);
            setLocationOptionsByWh((prev) => ({ ...prev, [whId]: opts }));
          } catch {
            /* optional */
          }
        }
      } catch {
        if (!cancelled) {
          messageApi.error('加载确认预览失败');
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, record, executionConfig, form, messageApi, onClose]);

  useEffect(() => {
    if (!open || outboundType !== 'sales_delivery' || !Array.isArray(detail?.items) || !detail.items.length) {
      setBatchOptionsByMaterialId({});
      return;
    }
    const active = (detail.items as Record<string, unknown>[]).filter(
      (it) => Number(it.delivery_quantity ?? 0) > 0,
    );
    const mids = [...new Set(active.map((x) => x.material_id).filter(Boolean) as number[])];
    if (!mids.length) return;

    let cancelled = false;
    void (async () => {
      setBatchOptionsLoading(true);
      try {
        const wid = detail.warehouse_id;
        const res = await apiRequest<{ items?: Record<string, unknown>[] }>(
          '/apps/kuaizhizao/reports/inventory/batch-query',
          {
            method: 'GET',
            params: {
              material_ids: mids,
              include_expired: false,
              ...(wid != null && wid !== '' ? { warehouse_id: wid } : {}),
            },
          },
        );
        const rows = res.items ?? [];
        const map: Record<number, SalesBatchPickOption[]> = {};
        for (const row of rows) {
          const mid = row.material_id as number;
          if (!mid) continue;
          const qty = Number(row.quantity ?? 0);
          if (qty <= 0) continue;
          if (row.status === '已过期' || row.status === '无库存') continue;
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
  }, [open, outboundType, detail?.id, detail?.warehouse_id, detail?.items]);

  const qtyColumn = (it: Record<string, unknown>) => {
    if (outboundType === 'sales_delivery') {
      return `${it.delivery_quantity ?? ''}${it.material_unit ? ` ${it.material_unit}` : ''}`;
    }
    if (outboundType === 'production_picking') {
      return `${it.picked_quantity ?? it.required_quantity ?? ''}${it.material_unit ? ` ${it.material_unit}` : ''}`;
    }
    if (outboundType === 'other_outbound') {
      return `${it.outbound_quantity ?? ''}${it.material_unit ? ` ${it.material_unit}` : ''}`;
    }
    if (outboundType === 'material_borrow') {
      return `${it.borrow_quantity ?? ''}${it.material_unit ? ` ${it.material_unit}` : ''}`;
    }
    return String(it.quantity ?? '—');
  };

  const whId = Number(detail?.warehouse_id ?? record?.warehouse_id ?? 0);
  const locOptions = whId > 0 ? locationOptionsByWh[whId] ?? [] : [];

  const columns: ColumnsType<Record<string, unknown>> = [
    {
      title: '行',
      key: 'idx',
      width: 52,
      align: 'center',
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    { title: '物料编码', dataIndex: 'material_code', width: 112, ellipsis: true },
    { title: '物料名称', dataIndex: 'material_name', ellipsis: true },
    {
      title: '出库数量',
      key: 'qty',
      width: 120,
      align: 'right',
      render: (_: unknown, it) => qtyColumn(it),
    },
    {
      title: '库位',
      key: 'location',
      width: 160,
      render: (_: unknown, it) => {
        const lineId = Number(it.id);
        return (
          <Form.Item name={`location_${lineId}`} style={{ marginBottom: 0 }}>
            <Select
              size="small"
              allowClear
              placeholder="选择库位"
              options={locOptions.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(v) => {
                const picked = locOptions.find((o) => o.value === v);
                form.setFieldValue(`location_code_${lineId}`, picked?.code ?? '');
              }}
            />
          </Form.Item>
        );
      },
    },
    {
      title: '批号',
      key: 'batch',
      width: 220,
      render: (_: unknown, it) => {
        const lineId = Number(it.id);
        const opts = batchOptionsByMaterialId[Number(it.material_id)] ?? [];
        return (
          <Form.Item name={`batch_${lineId}`} style={{ marginBottom: 0 }}>
            <AutoComplete
              size="small"
              allowClear
              options={opts}
              placeholder="选择或输入批号"
              filterOption={(input, option) => {
                const q = (input || '').toLowerCase();
                return (
                  String(option?.label ?? '').toLowerCase().includes(q) ||
                  String(option?.value ?? '').toLowerCase().includes(q)
                );
              }}
              notFoundContent={batchOptionsLoading ? '加载批次…' : undefined}
            />
          </Form.Item>
        );
      },
    },
    {
      title: '序列号',
      key: 'serial',
      width: 200,
      render: (_: unknown, it) => {
        const lineId = Number(it.id);
        const meta = materialMeta[lineId];
        if (!meta?.serialManaged) return '—';
        const qty = Number(
          it.delivery_quantity ?? it.picked_quantity ?? it.outbound_quantity ?? it.borrow_quantity ?? 0,
        );
        return (
          <Form.Item noStyle shouldUpdate>
            {() => {
              const serials = (form.getFieldValue(`serial_${lineId}`) as string[] | undefined) ?? [];
              return (
                <SerialNumbersImportTrigger
                  serials={serials}
                  expectedCount={qty > 0 ? qty : undefined}
                  materialLabel={String(it.material_code ?? it.material_name ?? '')}
                  onSerialsChange={(next) => form.setFieldValue(`serial_${lineId}`, next)}
                />
              );
            }}
          </Form.Item>
        );
      },
    },
  ];

  const handleSubmit = async () => {
    if (!record?.id || !record.outbound_type || !detail) return;
    const vals = form.getFieldsValue(true);
    const whName = String(detail.warehouse_name ?? record.warehouse_name ?? '');
    const payload = buildOutboundConfirmPayloadFromForm(
      record.outbound_type,
      activeLines,
      vals,
      whId > 0 ? whId : undefined,
      whName,
    );

    if (record.outbound_type === 'sales_delivery') {
      payload.item_batches = activeLines
        .map((it) => {
          const lineId = Number(it.id);
          const batch = normalizeBatchFormValue(vals[`batch_${lineId}`] ?? it.batch_number);
          return { item_id: lineId, batch_no: batch };
        })
        .filter((row) => Number.isFinite(row.item_id) && row.item_id > 0);
    }

    setSubmitting(true);
    try {
      const id = String(record.id);
      let raw: unknown;
      if (record.outbound_type === 'production_picking') {
        raw = await warehouseApi.productionPicking.confirm(id, payload);
      } else if (record.outbound_type === 'sales_delivery') {
        raw = await warehouseApi.salesDelivery.confirm(id, payload);
      } else if (record.outbound_type === 'other_outbound') {
        raw = await warehouseApi.otherOutbound.confirm(id, payload);
      } else if (record.outbound_type === 'material_borrow') {
        raw = await warehouseApi.materialBorrow.confirm(id, payload);
      } else {
        messageApi.error('该类型不支持确认出库');
        return;
      }
      const updated = parseConfirmResult(raw);
      const st = (updated.status ?? '').trim();
      const posted =
        st === '已出库' ||
        st === '已领料' ||
        st === '已完成' ||
        st === 'completed' ||
        st === '已借出';
      if (!posted && record.outbound_type !== 'production_picking') {
        messageApi.error(`出库未生效（接口返回状态：${st || '未知'}）`);
      } else {
        messageApi.success('出库确认成功，库存已更新');
      }
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } };
      messageApi.error(err?.message || err?.response?.data?.detail || '出库确认失败');
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = record?.outbound_type ? OUTBOUND_ISSUE_TYPE_LABELS[record.outbound_type] : '出库';

  return (
    <Modal
      title={`确认出库 — ${typeLabel}`}
      open={open}
      okText="确认出库并过账"
      cancelText="取消"
      confirmLoading={submitting}
      destroyOnHidden
      width={960}
      styles={{ body: { paddingTop: 12 } }}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        请核对库位、批号与序列号。启用批号/序列号管理的物料在确认时会校验。
      </Typography.Paragraph>
      {outboundType === 'sales_delivery' ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
          先进先出/后进先出等策略见 <Link to="/system/config-center">配置中心 → 仓储参数</Link>。
        </Typography.Paragraph>
      ) : null}
      {record ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          单号：<Typography.Text strong>{outboundDocumentCode(record)}</Typography.Text>
        </Typography.Text>
      ) : null}
      <Form form={form} component={false}>
        <Table
          size="small"
          loading={loading}
          rowKey={(it) => String(it.id ?? `${it.material_id}-${it.material_code}`)}
          columns={columns}
          dataSource={activeLines}
          pagination={false}
          scroll={{ x: 900, y: Math.min(activeLines.length * 52 + 40, 420) }}
        />
      </Form>
    </Modal>
  );
};

export default OutboundConfirmPreviewModal;
