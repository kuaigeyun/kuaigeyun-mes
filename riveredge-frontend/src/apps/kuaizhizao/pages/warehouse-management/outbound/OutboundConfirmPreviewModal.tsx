/**
 * 出库 Hub — 统一确认预览 Modal（批号/库位/序列号）
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, App, Button, Form, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import {
  warehouseApi,
  type EnsureOqcForSalesDeliveryLineSummary,
  type EnsureOqcForSalesDeliveryResult,
} from '../../../services/warehouse-execution';
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
  loadAvailableQtyByMaterialId,
  loadBatchOptionsByMaterialId,
  loadInStockSerialOptions,
  normalizeOutboundBatchNo,
  resolveOutboundConfirmBatchValue,
  type InventoryPickOption,
} from './outboundConfirmInventoryOptions';
import OutboundSerialPickerField from './OutboundSerialPickerField';
import { formatQuantity } from '../../../../../utils/format';
import { useGlobalStore } from '../../../../../stores';
import { isAdminBypass } from '../../../../../utils/permission';

const OQC_INSPECTION_PATH = '/apps/kuaizhizao/quality-management/oqc-inspection';

function inventoryLookupKey(
  outboundType: OutboundIssueType | undefined,
  it: Record<string, unknown>,
): number {
  if (outboundType === 'production_picking') return Number(it.id);
  return Number(it.material_id);
}

/**
 * 生产领料确认数量：待领时 issue 写入 required_quantity、picked_quantity=0；
 * 不可用 `picked ?? required`（0 不会落到 required，会导致明细被滤空）。
 */
function productionPickingConfirmQty(it: Record<string, unknown>): number {
  const picked = Number(it.picked_quantity);
  if (Number.isFinite(picked) && picked > 0) return picked;
  const required = Number(it.required_quantity);
  return Number.isFinite(required) && required > 0 ? required : 0;
}

function lineWarehouseId(
  it: Record<string, unknown>,
  fallbackWhId: number,
): number {
  const lineWh = Number(it.warehouse_id ?? 0);
  return lineWh > 0 ? lineWh : fallbackWhId;
}

function renderOqcOutboundTag(
  t: (key: string) => string,
  row: EnsureOqcForSalesDeliveryLineSummary | undefined,
) {
  if (!row) return '—';
  if (!row.oqc_required) {
    return <Tag>{t('app.kuaizhizao.warehouseOutbound.oqcReview.notRequired')}</Tag>;
  }
  return row.can_outbound ? (
    <Tag color="success">{t('app.kuaizhizao.warehouseOutbound.oqcReview.canOutbound')}</Tag>
  ) : (
    <Tag color="warning">{t('app.kuaizhizao.warehouseOutbound.oqcReview.pendingOutbound')}</Tag>
  );
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const currentUser = useCurrentUser();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [materialMeta, setMaterialMeta] = useState<Record<number, ConfirmPreviewMaterialMeta>>({});
  const [batchOptionsByMaterialId, setBatchOptionsByMaterialId] = useState<
    Record<number, InventoryPickOption[]>
  >({});
  const [stockQtyByMaterialId, setStockQtyByMaterialId] = useState<Record<number, number>>({});
  const [stockQtyLoading, setStockQtyLoading] = useState(false);
  const [batchOptionsLoading, setBatchOptionsLoading] = useState(false);
  const [serialOptionsByLineId, setSerialOptionsByLineId] = useState<
    Record<number, InventoryPickOption[]>
  >({});
  const [serialOptionsLoading, setSerialOptionsLoading] = useState(false);
  const [locationOptionsByWh, setLocationOptionsByWh] = useState<
    Record<number, { value: number; label: string; code: string }[]>
  >({});
  const [oqcEnsure, setOqcEnsure] = useState<EnsureOqcForSalesDeliveryResult | null>(null);
  const [oqcEnsureLoading, setOqcEnsureLoading] = useState(false);

  const outboundType = record?.outbound_type;
  const recordId = record?.id;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const oqcByLineId = useMemo(() => {
    const map: Record<number, EnsureOqcForSalesDeliveryLineSummary> = {};
    for (const row of oqcEnsure?.line_summaries ?? []) {
      map[row.delivery_item_id] = row;
    }
    return map;
  }, [oqcEnsure]);

  const oqcBlocksConfirm =
    outboundType === 'sales_delivery' &&
    oqcEnsure != null &&
    oqcEnsure.can_confirm_outbound !== true;

  const activeLines: Record<string, unknown>[] = useMemo(() => {
    const items = Array.isArray(detail?.items) ? detail!.items as Record<string, unknown>[] : [];
    if (outboundType === 'sales_delivery') {
      return items.filter((it) => Number(it.delivery_quantity ?? 0) > 0);
    }
    if (outboundType === 'production_picking') {
      return items.filter((it) => productionPickingConfirmQty(it) > 0);
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
      executionConfig.current_user_can_confirm_picking !== false ||
      isAdminBypass(currentUser)
    ) {
      return;
    }
    messageApi.warning(t('app.kuaizhizao.warehouseOutbound.msg.noConfirmPickingPermission'));
    onCloseRef.current();
  }, [open, outboundType, executionConfig, currentUser, messageApi, t]);

  useEffect(() => {
    if (!open || recordId == null || !outboundType) {
      setDetail(null);
      setOqcEnsure(null);
      form.resetFields();
      return;
    }
    const hubRecord = { id: recordId, outbound_type: outboundType, warehouse_id: record?.warehouse_id };
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setOqcEnsure(null);
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

        const itemRows = Array.isArray(detailData.items) ? detailData.items as Record<string, unknown>[] : [];
        const warehouseIds = new Set<number>();
        const headerWhId = Number(detailData.warehouse_id ?? record?.warehouse_id ?? 0);
        if (headerWhId > 0) warehouseIds.add(headerWhId);
        for (const it of itemRows) {
          const lineWhId = Number(it.warehouse_id ?? 0);
          if (lineWhId > 0) warehouseIds.add(lineWhId);
        }
        await Promise.all(
          [...warehouseIds].map(async (whId) => {
            try {
              const opts = await fetchStorageLocationsForWarehouse(whId);
              if (!cancelled) {
                setLocationOptionsByWh((prev) => ({ ...prev, [whId]: opts }));
              }
            } catch {
              /* optional */
            }
          }),
        );

        if (outboundType === 'sales_delivery') {
          setOqcEnsureLoading(true);
          try {
            const ensure = await warehouseApi.salesDelivery.ensureOqc(String(recordId));
            if (!cancelled) setOqcEnsure(ensure);
          } catch (e: unknown) {
            if (!cancelled) {
              const err = e as { message?: string; response?: { data?: { detail?: string } } };
              messageApi.error(
                err?.message ||
                  err?.response?.data?.detail ||
                  t('app.kuaizhizao.warehouseOutbound.oqcReview.ensureFailed'),
              );
            }
          } finally {
            if (!cancelled) setOqcEnsureLoading(false);
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
      setStockQtyByMaterialId({});
      return;
    }
    const allMids = [
      ...new Set(
        activeLines.map((x) => Number(x.material_id)).filter((mid) => Number.isFinite(mid) && mid > 0),
      ),
    ];
    const batchMids = [
      ...new Set(
        activeLines
          .filter((it) => materialMeta[Number(it.id)]?.batchManaged)
          .map((x) => Number(x.material_id))
          .filter((mid) => Number.isFinite(mid) && mid > 0),
      ),
    ];
    if (!allMids.length) {
      setBatchOptionsByMaterialId({});
      setStockQtyByMaterialId({});
      return;
    }

    let cancelled = false;
    void (async () => {
      setBatchOptionsLoading(batchMids.length > 0);
      setStockQtyLoading(true);
      try {
        if (outboundType === 'production_picking') {
          const batchMap: Record<number, InventoryPickOption[]> = {};
          const stockMap: Record<number, number> = {};
          await Promise.all(
            activeLines.map(async (it) => {
              const lineId = Number(it.id);
              const mid = Number(it.material_id);
              if (!Number.isFinite(lineId) || !Number.isFinite(mid) || mid <= 0) return;
              const headerWh = Number(detail?.warehouse_id ?? record?.warehouse_id ?? 0);
              const whFilterRaw = lineWarehouseId(it, headerWh);
              const whFilter = whFilterRaw > 0 ? whFilterRaw : undefined;
              const stock = await loadAvailableQtyByMaterialId([mid], whFilter);
              stockMap[lineId] = stock[mid] ?? 0;
              if (materialMeta[lineId]?.batchManaged) {
                const batchByMid = await loadBatchOptionsByMaterialId(
                  [mid],
                  whFilter,
                  (batch, qty, warehouseName) =>
                    warehouseName
                      ? t('app.kuaizhizao.warehouseOutbound.confirm.batchAvailableWithWh', {
                          batch,
                          qty,
                          warehouse: warehouseName,
                        })
                      : t('app.kuaizhizao.warehouseOutbound.confirm.batchAvailable', { batch, qty }),
                );
                batchMap[lineId] = batchByMid[mid] ?? [];
              }
            }),
          );
          if (cancelled) return;
          setStockQtyByMaterialId(stockMap);
          setBatchOptionsByMaterialId(batchMap);
          return;
        }

        const wid = Number(detail?.warehouse_id ?? record?.warehouse_id ?? 0);
        const whFilter = wid > 0 ? wid : undefined;
        // 库存数量必须与过账扣减一致（仅在库 MaterialBatch）；禁止 summary_only 虚高。
        const [stockMap, batchMap] = await Promise.all([
          loadAvailableQtyByMaterialId(allMids, whFilter),
          batchMids.length
            ? loadBatchOptionsByMaterialId(
                batchMids,
                whFilter,
                (batch, qty, warehouseName) =>
                  warehouseName
                    ? t('app.kuaizhizao.warehouseOutbound.confirm.batchAvailableWithWh', {
                        batch,
                        qty,
                        warehouse: warehouseName,
                      })
                    : t('app.kuaizhizao.warehouseOutbound.confirm.batchAvailable', { batch, qty }),
              )
            : Promise.resolve({} as Record<number, InventoryPickOption[]>),
        ]);
        if (cancelled) return;
        setStockQtyByMaterialId(stockMap);
        setBatchOptionsByMaterialId(batchMap);
      } catch {
        if (!cancelled) {
          setBatchOptionsByMaterialId({});
          setStockQtyByMaterialId({});
        }
      } finally {
        if (!cancelled) {
          setBatchOptionsLoading(false);
          setStockQtyLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeLines, materialMeta, detail?.id, detail?.warehouse_id, record?.warehouse_id, outboundType, t]);

  useEffect(() => {
    if (!open || batchOptionsLoading || !activeLines.length) return;
    const patches: Record<string, unknown> = {};
    for (const it of activeLines) {
      const lineId = Number(it.id);
      const meta = materialMeta[lineId];
      if (!meta?.batchManaged) continue;
      const lookupKey = inventoryLookupKey(outboundType, it);
      const opts = batchOptionsByMaterialId[lookupKey] ?? [];
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
  }, [open, activeLines, materialMeta, batchOptionsByMaterialId, batchOptionsLoading, form, outboundType]);

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
      const qty = productionPickingConfirmQty(it);
      return `${qty || ''}${it.material_unit ? ` ${it.material_unit}` : ''}`;
    }
    if (outboundType === 'other_outbound') {
      return `${it.outbound_quantity ?? ''}${it.material_unit ? ` ${it.material_unit}` : ''}`;
    }
    if (outboundType === 'material_borrow') {
      return `${it.borrow_quantity ?? ''}${it.material_unit ? ` ${it.material_unit}` : ''}`;
    }
    return String(it.quantity ?? '—');
  };

  const lineOutboundQty = (it: Record<string, unknown>): number => {
    if (outboundType === 'sales_delivery') return Number(it.delivery_quantity ?? 0);
    if (outboundType === 'production_picking') {
      return productionPickingConfirmQty(it);
    }
    if (outboundType === 'other_outbound') return Number(it.outbound_quantity ?? 0);
    if (outboundType === 'material_borrow') return Number(it.borrow_quantity ?? 0);
    return Number(it.quantity ?? 0);
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
        title: t('app.kuaizhizao.warehouseOutbound.col.stockQty'),
        key: 'stockQty',
        width: 110,
        align: 'right',
        render: (_: unknown, it) => {
          const lookupKey = inventoryLookupKey(outboundType, it);
          const mid = Number(it.material_id);
          if (!Number.isFinite(mid) || mid <= 0) return '—';
          if (stockQtyLoading) return '…';
          const stock = stockQtyByMaterialId[lookupKey];
          if (stock == null) return '—';
          const need = lineOutboundQty(it);
          const unit = String(it.material_unit ?? '').trim();
          const text = `${formatQuantity(stock)}${unit ? ` ${unit}` : ''}`;
          const insufficient = need > 0 && stock < need;
          return (
            <Typography.Text type={insufficient ? 'danger' : undefined} strong={insufficient}>
              {text}
            </Typography.Text>
          );
        },
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
          const lineWh = lineWarehouseId(it, whId);
          const lineLocOptions = lineWh > 0 ? locationOptionsByWh[lineWh] ?? [] : locOptions;
          return (
            <Form.Item name={`location_${lineId}`} style={{ marginBottom: 0 }}>
              <Select
                size="small"
                allowClear
                placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectLocationPlaceholder')}
                options={lineLocOptions.map((o) => ({ value: o.value, label: o.label }))}
                onChange={(v) => {
                  const picked = lineLocOptions.find((o) => o.value === v);
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
          const opts = batchOptionsByMaterialId[inventoryLookupKey(outboundType, it)] ?? [];
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
          const qty = lineOutboundQty(it);
          const opts = serialOptionsByLineId[lineId] ?? [];
          const materialLabel = [it.material_code, it.material_name].filter(Boolean).join(' - ');
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
      ...(outboundType === 'sales_delivery'
        ? ([
            {
              title: t('app.kuaizhizao.warehouseOutbound.oqcReview.colStatus'),
              key: 'oqc',
              width: 200,
              render: (_: unknown, it: Record<string, unknown>) => {
                const lineId = Number(it.id);
                const row = oqcByLineId[lineId];
                if (oqcEnsureLoading && !row) {
                  return t('app.kuaizhizao.warehouseOutbound.oqcReview.loading');
                }
                if (!row?.oqc_required) {
                  return renderOqcOutboundTag(t, row);
                }
                const statusText = !row.inspection_status
                  ? t('app.kuaizhizao.warehouseOutbound.oqcReview.statusNotCreated')
                  : [row.inspection_status, row.quality_status].filter(Boolean).join(' / ');
                return (
                  <Space size={4} wrap>
                    {renderOqcOutboundTag(t, row)}
                    {row.inspection_code ? (
                      <Typography.Link
                        onClick={() => {
                          onClose();
                          navigate(
                            `${OQC_INSPECTION_PATH}?sales_delivery_id=${recordId}${
                              row.inspection_id ? `&oqc_inspection_id=${row.inspection_id}` : ''
                            }`,
                          );
                        }}
                      >
                        {row.inspection_code}
                      </Typography.Link>
                    ) : (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {statusText}
                      </Typography.Text>
                    )}
                  </Space>
                );
              },
            },
          ] as ColumnsType<Record<string, unknown>>)
        : []),
    ],
    [
      batchOptionsByMaterialId,
      batchOptionsLoading,
      form,
      locationOptionsByWh,
      materialMeta,
      navigate,
      oqcByLineId,
      oqcEnsureLoading,
      onClose,
      outboundType,
      recordId,
      serialOptionsByLineId,
      serialOptionsLoading,
      stockQtyByMaterialId,
      stockQtyLoading,
      t,
      whId,
      whName,
    ],
  );

  const handleSubmit = async () => {
    if (!record?.id || !record.outbound_type || !detail) return;
    if (oqcBlocksConfirm) {
      messageApi.warning(
        oqcEnsure?.message || t('app.kuaizhizao.warehouseOutbound.oqcReview.blockedHint'),
      );
      return;
    }
    const vals = form.getFieldsValue(true);

    for (const it of activeLines) {
      const lineId = Number(it.id);
      const meta = materialMeta[lineId];
      const lookupKey = inventoryLookupKey(outboundType, it);
      const qty = lineOutboundQty(it);
      const opts = batchOptionsByMaterialId[lookupKey] ?? [];

      if (!meta?.batchManaged) {
        const available =
          opts.length > 0
            ? opts.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0)
            : Number(stockQtyByMaterialId[lookupKey] ?? 0);
        if (qty > 0 && !stockQtyLoading && available < qty) {
          messageApi.error(
            t('app.kuaizhizao.warehouseOutbound.confirm.batchQtyInsufficient', {
              material: String(it.material_code ?? ''),
              batch: opts.length ? opts.map((o) => o.value).join('、') : '—',
              available,
              required: qty,
            }),
          );
          return;
        }
        continue;
      }
      const batchRaw = vals[`batch_${lineId}`];
      if (!isValidOutboundBatchSelection(batchRaw, opts)) {
        const code = String(it.material_code ?? '');
        if (!opts.length) {
          messageApi.error(
            t('app.kuaizhizao.warehouseOutbound.confirm.batchNotInStock', {
              material: code,
              warehouse:
                String(it.warehouse_name ?? '').trim() ||
                whName ||
                t('app.kuaizhizao.warehouseOutbound.field.selectWarehouse'),
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

    // sales_delivery 的 item_batches 已由 buildOutboundConfirmPayloadFromForm 生成：
    // 空批号保持空串，禁止再 normalize 成 DEFAULT（会误走指定批号扣库，且与「未选批号」语义冲突）。

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

  const goInspectOqc = () => {
    onClose();
    navigate(`${OQC_INSPECTION_PATH}?sales_delivery_id=${recordId}`);
  };

  return (
    <Modal
      title={`${t('app.kuaizhizao.warehouseOutbound.confirm.title')} — ${typeLabel}`}
      open={open}
      confirmLoading={submitting}
      destroyOnHidden
      width={outboundType === 'sales_delivery' ? 1320 : 1200}
      styles={{ body: { paddingTop: 12, maxHeight: '78vh', overflowY: 'auto' } }}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          {outboundType === 'sales_delivery' && oqcEnsure?.requires_oqc && oqcBlocksConfirm ? (
            <Button type="primary" onClick={goInspectOqc}>
              {t('app.kuaizhizao.warehouseOutbound.oqcReview.goInspect')}
            </Button>
          ) : null}
          <Button
            type="primary"
            loading={submitting}
            disabled={oqcBlocksConfirm || oqcEnsureLoading}
            onClick={() => void handleSubmit()}
          >
            {t('app.kuaizhizao.warehouseOutbound.action.confirmAndPost')}
          </Button>
        </Space>
      }
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
      {outboundType === 'sales_delivery' && oqcEnsure?.created_count ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('app.kuaizhizao.warehouseOutbound.oqcReview.autoCreated', {
            count: oqcEnsure.created_count,
          })}
        />
      ) : null}
      {outboundType === 'sales_delivery' && oqcBlocksConfirm && oqcEnsure?.message ? (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={oqcEnsure.message} />
      ) : null}
      {record ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          {t('app.kuaizhizao.warehouseOutbound.detail.docNo')}：
          <Typography.Text strong>
            {outboundDocumentCode({
              ...record,
              ...(detail
                ? {
                    picking_code: (detail.picking_code as string | undefined) ?? record.picking_code,
                    delivery_code: (detail.delivery_code as string | undefined) ?? record.delivery_code,
                    outbound_code: (detail.outbound_code as string | undefined) ?? record.outbound_code,
                    borrow_code: (detail.borrow_code as string | undefined) ?? record.borrow_code,
                    issue_code: (detail.issue_code as string | undefined) ?? record.issue_code,
                  }
                : null),
            })}
          </Typography.Text>
        </Typography.Text>
      ) : null}
      <Form form={form} component={false}>
        <Table
          size="small"
          loading={loading || oqcEnsureLoading}
          rowKey={(it) => String(it.id ?? `${it.material_id}-${it.material_code}`)}
          columns={columns}
          dataSource={activeLines}
          pagination={false}
          scroll={{
            x: outboundType === 'sales_delivery' ? 1380 : 1180,
            y: Math.min(Math.max(activeLines.length * 52 + 40, 360), 560),
          }}
        />
      </Form>
    </Modal>
  );
};

export default OutboundConfirmPreviewModal;
