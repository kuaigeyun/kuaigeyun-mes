/**
 * 出库 Hub — 统一确认预览 Modal（批号/库位/序列号）
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { App, Form, Modal, Select, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { warehouseApi } from '../../../services/warehouse-execution';
import { outsourceMaterialIssueApi } from '../../../services/production';
import { fetchStorageLocationsForWarehouse } from '../inbound/inboundPoReceiptEntryUtils';
import {
  buildOutboundConfirmPayloadFromForm,
  loadConfirmPreviewMaterialMeta,
  type ConfirmPreviewMaterialMeta,
} from './outboundItemTracking';
import type { OutboundHubOrder, OutboundIssueType } from './outboundHubTypes';
import { getOutboundIssueTypeLabel, outboundDocumentCode } from './outboundHubTypes';
import {
  isValidOutboundBatchSelection,
  loadBatchOptionsByMaterialId,
  loadInStockSerialOptions,
  normalizeOutboundBatchNo,
  resolveOutboundConfirmBatchValue,
  type InventoryPickOption,
} from './outboundConfirmInventoryOptions';
import OutboundSerialPickerField from './OutboundSerialPickerField';

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
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [materialMeta, setMaterialMeta] = useState<Record<number, ConfirmPreviewMaterialMeta>>({});
  const [batchOptionsByMaterialId, setBatchOptionsByMaterialId] = useState<
    Record<number, InventoryPickOption[]>
  >({});
  const [batchOptionsLoading, setBatchOptionsLoading] = useState(false);
  const [serialOptionsByLineId, setSerialOptionsByLineId] = useState<
    Record<number, InventoryPickOption[]>
  >({});
  const [serialOptionsLoading, setSerialOptionsLoading] = useState(false);
  const [locationOptionsByWh, setLocationOptionsByWh] = useState<
    Record<number, { value: number; label: string; code: string }[]>
  >({});

  const outboundType = record?.outbound_type;
  const recordId = record?.id;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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
    if (
      !open ||
      outboundType !== 'production_picking' ||
      !executionConfig ||
      executionConfig.current_user_can_confirm_picking !== false
    ) {
      return;
    }
    messageApi.warning(t('app.kuaizhizao.warehouseOutbound.msg.noConfirmPickingPermission'));
    onCloseRef.current();
  }, [open, outboundType, executionConfig, messageApi, t]);

  useEffect(() => {
    if (!open || recordId == null || !outboundType) {
      setDetail(null);
      form.resetFields();
      return;
    }
    const hubRecord = { id: recordId, outbound_type: outboundType, warehouse_id: record?.warehouse_id };
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const detailData = await fetchOutboundDetail(hubRecord);
        if (cancelled) return;
        if (!detailData) {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.msg.loadDetailFailed'));
          onCloseRef.current();
          return;
        }
        setDetail(detailData);
        const items = Array.isArray(detailData.items) ? detailData.items as Record<string, unknown>[] : [];
        const meta = await loadConfirmPreviewMaterialMeta(
          items.map((it) => ({
            id: Number(it.id),
            material_id: it.material_id as number | undefined,
            material_code: String(it.material_code ?? ''),
            serial_numbers: it.serial_numbers as string[] | null | undefined,
          })),
        );
        if (cancelled) return;
        setMaterialMeta(meta);

        const init: Record<string, unknown> = {};
        items.forEach((it) => {
          const lineId = Number(it.id);
          if (!Number.isFinite(lineId)) return;
          init[`batch_${lineId}`] = String(it.batch_number ?? '').trim() || undefined;
          init[`location_${lineId}`] = it.location_id ?? undefined;
          init[`location_code_${lineId}`] = it.location_code ?? '';
          init[`serial_${lineId}`] = Array.isArray(it.serial_numbers) ? it.serial_numbers : [];
        });
        form.setFieldsValue(init);

        const whId = Number(detailData.warehouse_id ?? record?.warehouse_id ?? 0);
        if (whId > 0) {
          try {
            const opts = await fetchStorageLocationsForWarehouse(whId);
            if (!cancelled) {
              setLocationOptionsByWh((prev) => ({ ...prev, [whId]: opts }));
            }
          } catch {
            /* optional */
          }
        }
      } catch {
        if (!cancelled) {
          messageApi.error(t('app.kuaizhizao.warehouseOutbound.confirm.loadPreviewFailed'));
          onCloseRef.current();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, recordId, outboundType, record?.warehouse_id, form, messageApi, t]);

  useEffect(() => {
    if (!open || !activeLines.length) {
      setBatchOptionsByMaterialId({});
      return;
    }
    const mids = [
      ...new Set(
        activeLines
          .filter((it) => materialMeta[Number(it.id)]?.batchManaged)
          .map((x) => x.material_id)
          .filter(Boolean) as number[],
      ),
    ];
    if (!mids.length) {
      setBatchOptionsByMaterialId({});
      return;
    }

    let cancelled = false;
    void (async () => {
      setBatchOptionsLoading(true);
      try {
        const wid = Number(detail?.warehouse_id ?? record?.warehouse_id ?? 0);
        const map = await loadBatchOptionsByMaterialId(
          mids,
          wid > 0 ? wid : undefined,
          (batch, qty, warehouseName) =>
            warehouseName
              ? t('app.kuaizhizao.warehouseOutbound.confirm.batchAvailableWithWh', {
                  batch,
                  qty,
                  warehouse: warehouseName,
                })
              : t('app.kuaizhizao.warehouseOutbound.confirm.batchAvailable', { batch, qty }),
        );
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
  }, [open, activeLines, materialMeta, detail?.id, detail?.warehouse_id, record?.warehouse_id, t]);

  useEffect(() => {
    if (!open || batchOptionsLoading || !activeLines.length) return;
    const patches: Record<string, unknown> = {};
    for (const it of activeLines) {
      const lineId = Number(it.id);
      const mid = Number(it.material_id);
      const meta = materialMeta[lineId];
      if (!meta?.batchManaged) continue;
      const opts = batchOptionsByMaterialId[mid] ?? [];
      if (!opts.length) continue;
      const current = form.getFieldValue(`batch_${lineId}`);
      const resolved = resolveOutboundConfirmBatchValue(current ?? it.batch_number, opts);
      if (resolved !== current) {
        patches[`batch_${lineId}`] = resolved;
      }
    }
    if (Object.keys(patches).length) {
      form.setFieldsValue(patches);
    }
  }, [open, activeLines, materialMeta, batchOptionsByMaterialId, batchOptionsLoading, form]);

  useEffect(() => {
    if (!open || !activeLines.length) {
      setSerialOptionsByLineId({});
      return;
    }
    const serialLines = activeLines.filter((it) => {
      const lineId = Number(it.id);
      return materialMeta[lineId]?.serialManaged && materialMeta[lineId]?.materialUuid;
    });
    if (!serialLines.length) {
      setSerialOptionsByLineId({});
      return;
    }

    let cancelled = false;
    void (async () => {
      setSerialOptionsLoading(true);
      try {
        const next: Record<number, InventoryPickOption[]> = {};
        await Promise.all(
          serialLines.map(async (it) => {
            const lineId = Number(it.id);
            const uuid = materialMeta[lineId]?.materialUuid;
            if (!uuid) return;
            next[lineId] = await loadInStockSerialOptions(uuid);
          }),
        );
        if (!cancelled) setSerialOptionsByLineId(next);
      } catch {
        if (!cancelled) setSerialOptionsByLineId({});
      } finally {
        if (!cancelled) setSerialOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeLines, materialMeta]);

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
  const whName = String(detail?.warehouse_name ?? record?.warehouse_name ?? '').trim();
  const locOptions = whId > 0 ? locationOptionsByWh[whId] ?? [] : [];

  const columns: ColumnsType<Record<string, unknown>> = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseOutbound.col.lineNo'),
        key: 'idx',
        width: 52,
        align: 'center',
        render: (_: unknown, __: unknown, index: number) => index + 1,
      },
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'material_name', width: 140, ellipsis: true },
      {
        title: t('app.kuaizhizao.warehouseOutbound.col.deliveryQty'),
        key: 'qty',
        width: 110,
        align: 'right',
        render: (_: unknown, it) => qtyColumn(it),
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.col.warehouseName'),
        key: 'warehouse',
        width: 120,
        ellipsis: true,
        render: (_: unknown, it) =>
          String(it.warehouse_name ?? (whName || '—')),
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.col.location'),
        key: 'location',
        width: 180,
        render: (_: unknown, it) => {
          const lineId = Number(it.id);
          return (
            <Form.Item name={`location_${lineId}`} style={{ marginBottom: 0 }}>
              <Select
                size="small"
                allowClear
                placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectLocationPlaceholder')}
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
        title: t('app.kuaizhizao.warehouseOutbound.col.batchNo'),
        key: 'batch',
        width: 220,
        render: (_: unknown, it) => {
          const lineId = Number(it.id);
          const meta = materialMeta[lineId];
          if (!meta?.batchManaged) return '—';
          const opts = batchOptionsByMaterialId[Number(it.material_id)] ?? [];
          return (
            <Form.Item name={`batch_${lineId}`} style={{ marginBottom: 0 }}>
              <Select
                size="small"
                allowClear
                showSearch
                optionFilterProp="label"
                options={opts}
                placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectBatch')}
                loading={batchOptionsLoading}
                notFoundContent={
                  batchOptionsLoading
                    ? t('app.kuaizhizao.warehouseOutbound.confirm.loadingBatches')
                    : t('app.kuaizhizao.warehouseOutbound.confirm.noBatchAvailable')
                }
              />
            </Form.Item>
          );
        },
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.col.serialNo'),
        key: 'serial',
        width: 200,
        render: (_: unknown, it) => {
          const lineId = Number(it.id);
          const meta = materialMeta[lineId];
          if (!meta?.serialManaged) return '—';
          const qty = Number(
            it.delivery_quantity ?? it.picked_quantity ?? it.outbound_quantity ?? it.borrow_quantity ?? 0,
          );
          const opts = serialOptionsByLineId[lineId] ?? [];
          const materialLabel = [it.material_code, it.material_name].filter(Boolean).join(' · ');
          return (
            <Form.Item name={`serial_${lineId}`} style={{ marginBottom: 0 }}>
              <OutboundSerialPickerField
                options={opts}
                maxCount={qty > 0 ? qty : undefined}
                loading={serialOptionsLoading}
                materialLabel={materialLabel}
              />
            </Form.Item>
          );
        },
      },
    ],
    [
      batchOptionsByMaterialId,
      batchOptionsLoading,
      form,
      locOptions,
      materialMeta,
      outboundType,
      serialOptionsByLineId,
      serialOptionsLoading,
      t,
      whName,
    ],
  );

  const handleSubmit = async () => {
    if (!record?.id || !record.outbound_type || !detail) return;
    const vals = form.getFieldsValue(true);

    for (const it of activeLines) {
      const lineId = Number(it.id);
      const mid = Number(it.material_id);
      const meta = materialMeta[lineId];
      if (!meta?.batchManaged) continue;
      const opts = batchOptionsByMaterialId[mid] ?? [];
      const batchRaw = vals[`batch_${lineId}`];
      if (!isValidOutboundBatchSelection(batchRaw, opts)) {
        const code = String(it.material_code ?? '');
        if (!opts.length) {
          messageApi.error(
            t('app.kuaizhizao.warehouseOutbound.confirm.batchNotInStock', {
              material: code,
              warehouse: whName || t('app.kuaizhizao.warehouseOutbound.field.selectWarehouse'),
            }),
          );
        } else {
          messageApi.error(
            t('app.kuaizhizao.warehouseOutbound.confirm.batchRequired', {
              material: code,
              batches: opts.map((o) => o.value).join('、'),
            }),
          );
        }
        return;
      }
      const qty = Number(
        it.delivery_quantity ?? it.picked_quantity ?? it.outbound_quantity ?? it.borrow_quantity ?? 0,
      );
      const picked = opts.find(
        (o) => o.value === String(batchRaw ?? '').trim() || o.value === normalizeOutboundBatchNo(batchRaw),
      );
      if (picked?.quantity != null && qty > 0 && picked.quantity < qty) {
        messageApi.error(
          t('app.kuaizhizao.warehouseOutbound.confirm.batchQtyInsufficient', {
            material: String(it.material_code ?? ''),
            batch: picked.value,
            available: picked.quantity,
            required: qty,
          }),
        );
        return;
      }
    }

    const payloadWhName = String(detail.warehouse_name ?? record.warehouse_name ?? whName);
    const payload = buildOutboundConfirmPayloadFromForm(
      record.outbound_type,
      activeLines,
      vals,
      whId > 0 ? whId : undefined,
      payloadWhName,
    );

    if (record.outbound_type === 'sales_delivery') {
      payload.item_batches = activeLines
        .map((it) => {
          const lineId = Number(it.id);
          const batchRaw = String(vals[`batch_${lineId}`] ?? it.batch_number ?? '').trim();
          return { item_id: lineId, batch_no: normalizeOutboundBatchNo(batchRaw) };
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
        messageApi.error(t('app.kuaizhizao.warehouseOutbound.confirm.typeNotSupported'));
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
        messageApi.error(t('app.kuaizhizao.warehouseOutbound.confirm.notPosted', { status: st || t('app.kuaizhizao.warehouseOutbound.msg.unknownError') }));
      } else {
        messageApi.success(t('app.kuaizhizao.warehouseOutbound.confirm.success'));
      }
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } };
      messageApi.error(err?.message || err?.response?.data?.detail || t('app.kuaizhizao.warehouseOutbound.confirm.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = record?.outbound_type
    ? getOutboundIssueTypeLabel(t, record.outbound_type as OutboundIssueType)
    : t('app.kuaizhizao.warehouseOutbound.fallbackDoc');

  return (
    <Modal
      title={`${t('app.kuaizhizao.warehouseOutbound.confirm.title')} — ${typeLabel}`}
      open={open}
      okText={t('app.kuaizhizao.warehouseOutbound.action.confirmAndPost')}
      cancelText={t('app.kuaizhizao.warehouseOutbound.action.cancel')}
      confirmLoading={submitting}
      destroyOnHidden
      width={1200}
      styles={{ body: { paddingTop: 12, maxHeight: '78vh', overflowY: 'auto' } }}
      onCancel={onClose}
      onOk={() => void handleSubmit()}
    >
      <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
        {t('app.kuaizhizao.warehouseOutbound.confirm.hint')}
      </Typography.Paragraph>
      {outboundType === 'sales_delivery' ? (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
          {t('app.kuaizhizao.warehouseOutbound.confirm.fifoHint')}{' '}
          <Link to="/system/config-center">{t('app.kuaizhizao.warehouseOutbound.confirm.fifoLink')}</Link>。
        </Typography.Paragraph>
      ) : null}
      {record ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          {t('app.kuaizhizao.warehouseOutbound.detail.docNo')}：
          <Typography.Text strong>{outboundDocumentCode(record)}</Typography.Text>
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
          scroll={{
            x: 1180,
            y: Math.min(Math.max(activeLines.length * 52 + 40, 360), 560),
          }}
        />
      </Form>
    </Modal>
  );
};

export default OutboundConfirmPreviewModal;
