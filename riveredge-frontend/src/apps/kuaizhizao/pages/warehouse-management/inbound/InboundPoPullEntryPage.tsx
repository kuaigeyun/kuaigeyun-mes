/**
 * 从采购订单取单开入库单 — 独立 Tab 页（基本信息 + 明细录入）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space, Spin, Table, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { prefetchMaterialsForUnitSelect } from '../../../../../components/material-unit-select';
import { SerialNumbersImportTrigger } from '../../../../../components/serial-numbers-import';
import {
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  DocumentFormPageLayout,
  MODAL_CONFIG,
  PAGE_SPACING,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { materialSerialApi } from '../../../../master-data/services/material';
import {
  getPurchaseOrder,
  pushPurchaseOrderToReceipt,
  pushPurchaseOrderToReceiptPreview,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from '../../../services/purchase';
import { warehouseApi } from '../../../services/warehouse-execution';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { formatDateBySiteSetting } from '../../../../../utils/format';
import { loadConfirmPreviewMaterialMeta, type ConfirmPreviewMaterialMeta } from './inboundItemTracking';
import {
  enrichPurchaseOrderItemsMaterial,
  fetchStorageLocationsForWarehouse,
  getOutstandingPoItems,
  normalizePurchaseOrderDetail,
} from './inboundPoReceiptEntryUtils';
import type { PurchaseReceiptEntryHandoff } from './inboundPullEntryTypes';
import {
  InboundEntryAttachmentsSection,
  InboundEntryReceiverField,
  InboundEntryRemarksSection,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
  useInboundReceiverSelect,
} from './inboundEntryShared';
import { inboundReceiptTypeLabel } from './inboundHubTypes';
import { INBOUND_LIST_PATH, inboundPoEntryPath } from './inboundPaths';
import {
  draftDayjs,
  draftOptionalNumber,
  mergeRecordMaps,
  usePullEntryFormDraft,
} from '../shared/pullEntryFormDraft';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

const InboundPoPullEntryPage: React.FC = () => {
  const { poId: poIdParam } = useParams<{ poId: string }>();
  const poId = Number(poIdParam);
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const { t } = useTranslation();
  const pullFromPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'purchase_receipt.pull_from_purchase_order');
  const receiverHook = useInboundReceiverSelect();
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const initRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [batchNumbers, setBatchNumbers] = useState<Record<number, string>>({});
  const [lineWh, setLineWh] = useState<Record<number, number>>({});
  const [lineLoc, setLineLoc] = useState<Record<number, number | undefined>>({});
  const [lineLocCode, setLineLocCode] = useState<Record<number, string>>({});
  const [locOptionsByWh, setLocOptionsByWh] = useState<
    Record<number, { value: number; label: string; code: string }[]>
  >({});
  const [materialMeta, setMaterialMeta] = useState<Record<number, ConfirmPreviewMaterialMeta>>({});
  const [serials, setSerials] = useState<Record<number, string[]>>({});
  const [generatingSerialId, setGeneratingSerialId] = useState<number | null>(null);
  const [batchWhModalOpen, setBatchWhModalOpen] = useState(false);
  const [batchWhSelectedId, setBatchWhSelectedId] = useState<number | undefined>();
  const [batchWhApplying, setBatchWhApplying] = useState(false);
  const [receiptTime, setReceiptTime] = useState(() => dayjs());
  const [deliveryNote, setDeliveryNote] = useState('');
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<number | undefined>();
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptAttachments, setReceiptAttachments] = useState<any[]>([]);
  const { bindSnapshot, persistNow, clearDraft, applyDraftOnce } = usePullEntryFormDraft(
    'kuaizhizao:inbound-po-pull',
  );

  const outstandingItems = useMemo(() => getOutstandingPoItems(order), [order]);
  const totalReceiptQty = useMemo(
    () =>
      outstandingItems.reduce((sum, it) => {
        if (it.id == null) return sum;
        return sum + Number(quantities[it.id] ?? 0);
      }, 0),
    [outstandingItems, quantities],
  );
  const pagePath = Number.isFinite(poId) && poId > 0 ? inboundPoEntryPath(poId) : INBOUND_LIST_PATH;
  const pageTitle = order?.order_code
    ? `${pullFromPurchaseOrderAction.label} — ${order.order_code}`
    : pullFromPurchaseOrderAction.label;

  const leavePage = useCallback(() => {
    clearDraft();
    navigate(INBOUND_LIST_PATH);
  }, [clearDraft, navigate]);

  useEffect(() => {
    bindSnapshot(() => ({
      quantities,
      batchNumbers,
      lineWh,
      lineLoc,
      lineLocCode,
      serials,
      defaultWarehouseId,
      receiptTime,
      deliveryNote,
      receiptNotes,
      receiverUuid: receiverHook.receiverUuid,
      receiverName: receiverHook.receiverName,
    }));
    persistNow();
  }, [
    quantities,
    batchNumbers,
    lineWh,
    lineLoc,
    lineLocCode,
    serials,
    defaultWarehouseId,
    receiptTime,
    deliveryNote,
    receiptNotes,
    receiverHook.receiverUuid,
    receiverHook.receiverName,
    bindSnapshot,
    persistNow,
  ]);

  const applyLineWarehouse = useCallback(async (lineIds: number[], warehouseId: number) => {
    if (!lineIds.length) return;
    setLineWh((prev) => {
      const next = { ...prev };
      lineIds.forEach((id) => {
        next[id] = warehouseId;
      });
      return next;
    });
    setLineLoc((prev) => {
      const next = { ...prev };
      lineIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    setLineLocCode((prev) => {
      const next = { ...prev };
      lineIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    const opts = await fetchStorageLocationsForWarehouse(warehouseId);
    setLocOptionsByWh((prev) => ({ ...prev, [warehouseId]: opts }));
  }, []);

  const handleBatchApplyWarehouse = useCallback(
    async (warehouseId: number) => {
      const lineIds = outstandingItems
        .filter((it) => it.id != null)
        .map((it) => it.id!);
      if (!lineIds.length) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.msg.noLinesToSetWarehouse'));
        return;
      }
      await applyLineWarehouse(lineIds, warehouseId);
      setDefaultWarehouseId(warehouseId);
      messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.batchWarehouseApplied', { count: lineIds.length }));
    },
    [applyLineWarehouse, messageApi, outstandingItems, t],
  );

  const handleBatchWhModalConfirm = async () => {
    if (batchWhSelectedId == null || !(batchWhSelectedId > 0)) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.field.selectWarehouse'));
      return;
    }
    setBatchWhApplying(true);
    try {
      await handleBatchApplyWarehouse(batchWhSelectedId);
      setBatchWhModalOpen(false);
      setBatchWhSelectedId(undefined);
    } finally {
      setBatchWhApplying(false);
    }
  };

  useEffect(() => {
    if (!(Number.isFinite(poId) && poId > 0)) {
      messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.purchase.invalidPo'));
      leavePage();
    }
  }, [poId, leavePage, messageApi]);

  useEffect(() => {
    setCustomPageTitle(pagePath, pageTitle);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: pagePath, path: pagePath, title: pageTitle },
      }),
    );
    return () => {
      removeCustomPageTitle(pagePath);
    };
  }, [pagePath, pageTitle]);

  useEffect(() => {
    if (!Number.isFinite(poId) || poId <= 0 || initRef.current) return;
    initRef.current = true;
    void (async () => {
      setLoading(true);
      try {
        const [detailRaw, whRes] = await Promise.all([
          getPurchaseOrder(poId),
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
        ]);
        let detail = normalizePurchaseOrderDetail(detailRaw);
        setWarehouseOptions(mapWarehouseSelectOptions(whRes));
        const items = getOutstandingPoItems(detail);
        if (!items.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.purchase.allReceived'));
          leavePage();
          return;
        }
        const materialById = await prefetchMaterialsForUnitSelect(items.map((it) => it.material_id));
        detail = {
          ...detail,
          items: enrichPurchaseOrderItemsMaterial(detail.items || [], materialById),
        };
        const enrichedOutstanding = getOutstandingPoItems(detail);
        const qtyMap: Record<number, number> = {};
        enrichedOutstanding.forEach((it) => {
          if (it.id != null) qtyMap[it.id] = Number(it.outstanding_quantity ?? 0);
        });
        const headerWh =
          (detail as PurchaseOrder & { warehouse_id?: number }).warehouse_id != null
          && Number((detail as PurchaseOrder & { warehouse_id?: number }).warehouse_id) > 0
            ? Number((detail as PurchaseOrder & { warehouse_id?: number }).warehouse_id)
            : undefined;
        const whMap: Record<number, number> = {};
        enrichedOutstanding.forEach((it) => {
          if (it.id == null) return;
          let rowWh: number | undefined;
          if (it.material_id) {
            const material = materialById.get(String(it.material_id));
            const defWhs = material?.defaults?.defaultWarehouses;
            if (defWhs?.length) {
              const sorted = [...defWhs].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
              if (sorted[0]?.warehouseId > 0) rowWh = sorted[0].warehouseId;
            }
          }
          if (rowWh == null) rowWh = headerWh;
          if (rowWh != null) whMap[it.id] = rowWh;
        });
        setOrder(detail);
        setQuantities(qtyMap);
        setLineWh(whMap);
        const whValues = [...new Set(Object.values(whMap))];
        if (whValues.length === 1) setDefaultWarehouseId(whValues[0]);
        setPreviewLoading(true);
        const uniqueWh = [...new Set(Object.values(whMap))];
        void pushPurchaseOrderToReceiptPreview(poId, qtyMap)
          .then((preview) => {
            const batchMap: Record<number, string> = {};
            (preview.items || []).forEach((it: { item_id: number; batch_number?: string }) => {
              if (it.batch_number) batchMap[it.item_id] = it.batch_number;
            });
            setBatchNumbers(batchMap);
          })
          .catch(() => {
            /* 批号预览失败时可手工填写 */
          })
          .finally(() => setPreviewLoading(false));
        try {
          const [meta, ...locOptsList] = await Promise.all([
            loadConfirmPreviewMaterialMeta(enrichedOutstanding),
            ...uniqueWh.map(async (wid) => ({ wid, opts: await fetchStorageLocationsForWarehouse(wid) })),
          ]);
          setMaterialMeta(meta);
          const locByWh: Record<number, { value: number; label: string; code: string }[]> = {};
          locOptsList.forEach((entry) => {
            locByWh[entry.wid] = entry.opts;
          });
          setLocOptionsByWh(locByWh);
        } catch {
          /* 物料属性或库位加载失败不阻断录入 */
        }
        applyDraftOnce((draft) => {
          if (draft.quantities) {
            setQuantities((prev) => mergeRecordMaps(prev, draft.quantities as Record<number, number>));
          }
          if (draft.batchNumbers) {
            setBatchNumbers((prev) => mergeRecordMaps(prev, draft.batchNumbers as Record<number, string>));
          }
          if (draft.lineWh) {
            setLineWh((prev) => mergeRecordMaps(prev, draft.lineWh as Record<number, number>));
          }
          if (draft.lineLoc) {
            setLineLoc((prev) => ({ ...prev, ...(draft.lineLoc as Record<number, number | undefined>) }));
          }
          if (draft.lineLocCode) {
            setLineLocCode((prev) => mergeRecordMaps(prev, draft.lineLocCode as Record<number, string>));
          }
          if (draft.serials) {
            setSerials((prev) => ({ ...prev, ...(draft.serials as Record<number, string[]>) }));
          }
          const whId = draftOptionalNumber(draft.defaultWarehouseId);
          if (whId != null) setDefaultWarehouseId(whId);
          if (draft.receiptTime) setReceiptTime(draftDayjs(draft.receiptTime));
          if (typeof draft.deliveryNote === 'string') setDeliveryNote(draft.deliveryNote);
          if (typeof draft.receiptNotes === 'string') setReceiptNotes(draft.receiptNotes);
          receiverHook.restoreReceiver(
            typeof draft.receiverUuid === 'string' ? draft.receiverUuid : undefined,
            typeof draft.receiverName === 'string' ? draft.receiverName : undefined,
          );
        });
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || t('app.kuaizhizao.warehouseInbound.entry.purchase.loadFailed'));
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [poId, leavePage, messageApi, applyDraftOnce, receiverHook.restoreReceiver]);

  const handleGenerateSerial = async (poItemId: number, qty: number) => {
    const meta = materialMeta[poItemId];
    if (!meta?.serialManaged || !meta.materialUuid) return;
    const count = Math.max(1, Math.floor(Number(qty) || 1));
    if (count > 100) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.msg.serialMax100'));
      return;
    }
    setGeneratingSerialId(poItemId);
    try {
      const res = await materialSerialApi.generate(meta.materialUuid, count, {
        ruleId: meta.defaultSerialRuleId ?? undefined,
      });
      setSerials((prev) => ({ ...prev, [poItemId]: res.serial_nos }));
      messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.serialGenerated', { count: res.count }));
    } catch (e: unknown) {
      messageApi.error((e as Error)?.message || t('app.kuaizhizao.warehouseInbound.msg.serialGenerateFailed'));
    } finally {
      setGeneratingSerialId(null);
    }
  };

  const buildHandoff = (): PurchaseReceiptEntryHandoff => {
    const handoff: PurchaseReceiptEntryHandoff = {
      lineWhByPoItemId: {},
      lineLocByPoItemId: {},
      lineLocCodeByPoItemId: {},
      lineBatchByPoItemId: {},
      lineSerialByPoItemId: {},
    };
    outstandingItems.forEach((it) => {
      if (it.id == null || (quantities[it.id] ?? 0) <= 0) return;
      const id = it.id;
      if (lineWh[id] != null) handoff.lineWhByPoItemId[id] = lineWh[id];
      if (lineLoc[id] != null) handoff.lineLocByPoItemId[id] = lineLoc[id];
      if (lineLocCode[id]) handoff.lineLocCodeByPoItemId[id] = lineLocCode[id];
      const batchStr = (batchNumbers[id] ?? '').trim();
      if (batchStr) handoff.lineBatchByPoItemId[id] = batchStr;
      const sn = serials[id];
      if (sn?.length) handoff.lineSerialByPoItemId[id] = sn;
    });
    return handoff;
  };

  const saveReceiptHeader = async (receiptId: number) => {
    if (!order?.id) return;
    const whIds = [...new Set(Object.values(lineWh).filter((id) => id > 0))];
    const headerWhId = defaultWarehouseId ?? whIds[0];
    const whOpt = warehouseOptions.find((o) => o.value === headerWhId);
    if (!headerWhId || !whOpt) return;
    await warehouseApi.purchaseReceipt.update(String(receiptId), {
      purchase_order_id: Number(order.id),
      purchase_order_code: order.order_code || '',
      supplier_id: Number(order.supplier_id || 0),
      supplier_name: order.supplier_name || '',
      warehouse_id: headerWhId,
      warehouse_name: whOpt.name,
      receipt_time: receiptTime?.toISOString(),
      receiver_name: receiverHook.receiverName.trim() || undefined,
      delivery_note: deliveryNote.trim() || undefined,
      notes: receiptNotes.trim() || undefined,
      attachments: normalizeDocumentAttachments(receiptAttachments),
      status: '草稿',
    });
  };

  const submit = async (mode: 'draft' | 'confirm') => {
    if (!order?.id) return;
    let hasPositiveQty = false;
    for (const it of outstandingItems) {
      if (it.id == null) continue;
      const qty = quantities[it.id] ?? 0;
      const max = Number(it.outstanding_quantity ?? 0);
      if (qty <= 0) continue;
      hasPositiveQty = true;
      if (qty > max) {
        messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.purchase.qtyExceedsOutstanding', { material: it.material_code || it.material_name, max }));
        return;
      }
    }
    if (!hasPositiveQty) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.entry.purchase.fillReceiptQty'));
      return;
    }
    if (mode === 'confirm') {
      for (const it of outstandingItems) {
        if (it.id == null) continue;
        if ((quantities[it.id] ?? 0) <= 0) continue;
        const wh = lineWh[it.id];
        if (wh == null || !(wh > 0)) {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.msg.selectWarehouseForMaterial', { material: it.material_code || it.material_name || '-' }));
          return;
        }
      }
    }
    const batchPayload: Record<number, string> = {};
    const lineWhPayload: Record<number, number> = {};
    const lineLocIdPayload: Record<number, number> = {};
    const lineLocCodePayload: Record<number, string> = {};
    let headerWhId: number | undefined;
    outstandingItems.forEach((it) => {
      if (it.id == null || (quantities[it.id] ?? 0) <= 0) return;
      const id = it.id;
      if (lineWh[id] != null && lineWh[id] > 0) {
        lineWhPayload[id] = lineWh[id];
        if (headerWhId == null) headerWhId = lineWh[id];
      }
      if (lineLoc[id] != null && lineLoc[id] > 0) lineLocIdPayload[id] = lineLoc[id];
      if (lineLocCode[id]) lineLocCodePayload[id] = lineLocCode[id];
      if (batchNumbers[id]) batchPayload[id] = batchNumbers[id];
    });
    setSubmitting(true);
    try {
      const created = (await pushPurchaseOrderToReceipt(
        order.id,
        quantities,
        Object.keys(batchPayload).length > 0 ? batchPayload : undefined,
        {
          warehouseId: headerWhId ?? defaultWarehouseId,
          lineWarehouses: lineWhPayload,
          lineLocationIds: lineLocIdPayload,
          lineLocationCodes: lineLocCodePayload,
        },
      )) as { id?: number; receipt_code?: string };
      if (created?.id == null) {
        messageApi.error(t('app.kuaizhizao.warehouseInbound.entry.purchase.noReceiptId'));
        return;
      }
      await saveReceiptHeader(Number(created.id));
      invalidateMenuBadgeCounts();
      clearDraft();
      if (mode === 'confirm') {
        navigate(INBOUND_LIST_PATH, {
          state: {
            inboundDirectConfirm: {
              id: Number(created.id),
              receipt_type: 'purchase',
              purchaseReceiptHandoff: buildHandoff(),
            },
          },
        });
      } else {
        messageApi.success(
          t('app.kuaizhizao.warehouseInbound.entry.purchase.draftCreated', {
            code: created.receipt_code
              ? t('app.kuaizhizao.warehouseInbound.entry.purchase.draftCreatedSuffix', { code: created.receipt_code })
              : '',
          }),
        );
        leavePage();
      }
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } };
      messageApi.error(err?.message || err?.response?.data?.detail || t('app.kuaizhizao.warehouseInbound.msg.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDefaultWarehouseChange = (warehouseId: number) => {
    setDefaultWarehouseId(warehouseId);
    const lineIds = outstandingItems.filter((it) => it.id != null).map((it) => it.id!);
    void applyLineWarehouse(lineIds, warehouseId);
  };

  const entryColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.warehouseInbound.col.materialCode'),
        dataIndex: 'material_code',
        width: 120,
        ellipsis: true,
        render: (v: unknown, record: PurchaseOrderItem) => String(v || record.material_code || '—'),
      },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.materialName'),
        dataIndex: 'material_name',
        width: 150,
        ellipsis: true,
        render: (v: unknown, record: PurchaseOrderItem) => String(v || record.material_name || '—'),
      },
      { title: t('app.kuaizhizao.warehouseInbound.col.purchaseQty'), dataIndex: 'ordered_quantity', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseInbound.col.receivedQty'), dataIndex: 'received_quantity', width: 90, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseInbound.col.outstandingQty'), dataIndex: 'outstanding_quantity', width: 90, align: 'right' as const },
      {
        title: (
          <span>
            {t('app.kuaizhizao.warehouseInbound.col.warehouse')}
            <Button
              type="link"
              size="small"
              style={{ padding: '0 4px', height: 'auto' }}
              onClick={() => {
                setBatchWhSelectedId(undefined);
                setBatchWhModalOpen(true);
              }}
            >
              {t('app.kuaizhizao.warehouseInbound.action.batch')}
            </Button>
          </span>
        ),
        width: 150,
        render: (_: unknown, record: PurchaseOrderItem) =>
          record.id != null ? (
            <Select
              style={{ width: '100%', minWidth: 118 }}
              placeholder={t('app.kuaizhizao.warehouseInbound.field.select')}
              showSearch
              optionFilterProp="label"
              value={lineWh[record.id]}
              options={warehouseOptions}
              onChange={(nv) => {
                void applyLineWarehouse([record.id!], nv);
              }}
            />
          ) : null,
      },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.location'),
        width: 150,
        render: (_: unknown, record: PurchaseOrderItem) => {
          if (record.id == null) return null;
          const rid = record.id;
          const wh = lineWh[rid];
          const locOpts = wh != null ? locOptionsByWh[wh] ?? [] : [];
          return (
            <Select
              style={{ width: '100%', minWidth: 118 }}
              placeholder={wh != null ? t('app.kuaizhizao.warehouseInbound.field.optional') : t('app.kuaizhizao.warehouseInbound.field.selectWarehouseFirst')}
              showSearch
              allowClear
              optionFilterProp="label"
              value={lineLoc[rid]}
              options={locOpts}
              onDropdownVisibleChange={(open) => {
                if (open && wh != null && !locOptionsByWh[wh]?.length) {
                  void fetchStorageLocationsForWarehouse(wh).then((opts) =>
                    setLocOptionsByWh((p) => ({ ...p, [wh]: opts })),
                  );
                }
              }}
              onChange={(v) => {
                setLineLoc((prev) => ({ ...prev, [rid]: v ?? undefined }));
                const o = locOpts.find((x) => x.value === v);
                setLineLocCode((prev) => {
                  const next = { ...prev };
                  if (v == null) delete next[rid];
                  else next[rid] = o?.code ?? '';
                  return next;
                });
              }}
              disabled={wh == null}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.batchNo'),
        width: 130,
        render: (_: unknown, record: PurchaseOrderItem) => {
          if (record.id == null) return '—';
          const rid = record.id;
          if (previewLoading && !batchNumbers[rid]) return t('app.kuaizhizao.warehouseInbound.field.loading');
          return (
            <Input
              placeholder={t('app.kuaizhizao.warehouseInbound.field.optional')}
              value={batchNumbers[rid] ?? ''}
              onChange={(e) => setBatchNumbers((prev) => ({ ...prev, [rid]: e.target.value }))}
              size="small"
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.serialNo'),
        width: 150,
        render: (_: unknown, record: PurchaseOrderItem) => {
          if (record.id == null) return '—';
          const rid = record.id;
          const meta = materialMeta[rid];
          if (!meta?.serialManaged) return '—';
          const qty = Number(quantities[rid] ?? 0);
          return (
            <SerialNumbersImportTrigger
              serials={serials[rid] ?? []}
              expectedCount={qty > 0 ? qty : undefined}
              materialLabel={record.material_code || record.material_name}
              generateLoading={generatingSerialId === rid}
              onSerialsChange={(next) => setSerials((prev) => ({ ...prev, [rid]: next }))}
              onGenerate={
                qty > 0 && !previewLoading ? () => handleGenerateSerial(rid, qty) : undefined
              }
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.warehouseInbound.col.thisReceipt'),
        width: 130,
        align: 'right' as const,
        render: (_: unknown, record: PurchaseOrderItem) =>
          record.id != null ? (
            <InputNumber
              min={0}
              max={Number(record.outstanding_quantity ?? 0)}
              precision={4}
              value={quantities[record.id] ?? 0}
              onChange={(v) => setQuantities((prev) => ({ ...prev, [record.id!]: Number(v) || 0 }))}
              style={{ width: 110 }}
            />
          ) : null,
      },
    ],
    [
      t,
      applyLineWarehouse,
      batchNumbers,
      generatingSerialId,
      lineLoc,
      lineLocCode,
      lineWh,
      locOptionsByWh,
      materialMeta,
      previewLoading,
      quantities,
      serials,
      warehouseOptions,
    ],
  );

  return (
    <DocumentFormPageLayout
      header={
        <>
          <Space align="center" size={8}>
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label={t('app.kuaizhizao.warehouseInbound.action.back')} onClick={leavePage} />
            <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
              {pageTitle}
            </Typography.Title>
          </Space>
          <Space wrap>
            <Button disabled={submitting || loading} onClick={leavePage}>
              {t('app.kuaizhizao.warehouseInbound.action.cancel')}
            </Button>
            <Button loading={submitting} disabled={loading} onClick={() => void submit('draft')}>
              {t('app.kuaizhizao.warehouseInbound.action.generateDraft')}
            </Button>
            <Button type="primary" loading={submitting} disabled={loading} onClick={() => void submit('confirm')}>
              {t('app.kuaizhizao.warehouseInbound.action.confirmInbound')}
            </Button>
          </Space>
        </>
      }
    >
      <Spin spinning={loading}>
        <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
          <div className="form-modal-content-inner">
            {order && (
              <Form layout="vertical" requiredMark={false}>
                <Row gutter={16}>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.inboundType')}>
                      <ReadOnlyFormValue value={inboundReceiptTypeLabel(t, 'purchase')} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.sourceDocNo')}>
                      <ReadOnlyFormValue value={order.order_code} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.supplier')}>
                      <ReadOnlyFormValue value={order.supplier_name} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.buyer')}>
                      <ReadOnlyFormValue value={order.buyer_name} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.orderDate')}>
                      <ReadOnlyFormValue
                        value={order.order_date ? formatDateBySiteSetting(order.order_date) : undefined}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.requiredDeliveryDate')}>
                      <ReadOnlyFormValue
                        value={order.delivery_date ? formatDateBySiteSetting(order.delivery_date) : undefined}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.orderStatus')}>
                      <ReadOnlyFormValue value={order.status} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.currency')}>
                      <ReadOnlyFormValue value={order.currency} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.receiptDate')}>
                      <DatePicker
                        style={{ width: '100%' }}
                        value={receiptTime}
                        onChange={(v) => setReceiptTime(v ?? dayjs())}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <InboundEntryReceiverField hook={receiverHook} />
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.defaultWarehouse')}>
                      <Select
                        style={{ width: '100%' }}
                        placeholder={t('app.kuaizhizao.warehouseInbound.field.applyToAllLines')}
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        value={defaultWarehouseId}
                        options={warehouseOptions}
                        onChange={(v) => {
                          if (v != null) handleDefaultWarehouseChange(v);
                          else setDefaultWarehouseId(undefined);
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.deliveryNote')}>
                      <Input
                        placeholder={t('app.kuaizhizao.warehouseInbound.field.deliveryNotePlaceholder')}
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        maxLength={100}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.supplierContact')}>
                      <ReadOnlyFormValue value={order.supplier_contact} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.contactPhone')}>
                      <ReadOnlyFormValue value={order.supplier_phone} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.totalQty')}>
                      <ReadOnlyFormValue value={totalReceiptQty.toLocaleString()} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12} lg={6}>
                    <Form.Item label={t('app.kuaizhizao.warehouseInbound.field.orderNotes')}>
                      <ReadOnlyFormValue value={order.notes} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )}

            <div className="uni-table-detail" style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
              <UniTableDetailHeader title={t('app.kuaizhizao.warehouseInbound.section.inboundDetails')} required />
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <div className="uni-table-detail-body">
                <div className="uni-table-detail-scroll">
                  <Table
                    className="uni-detail-table warehouse-detail-table"
                    size="small"
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: 1280 }}
                    dataSource={outstandingItems}
                    columns={entryColumns}
                  />
                </div>
              </div>
            </div>

            {order && (
              <Form layout="vertical" requiredMark={false} style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
                <InboundEntryAttachmentsSection
                  category="purchase_receipt_attachments"
                  fileList={receiptAttachments}
                  onChange={setReceiptAttachments}
                />
                <InboundEntryRemarksSection value={receiptNotes} onChange={setReceiptNotes} />
              </Form>
            )}
          </div>
        </Card>
      </Spin>

      <Modal
        title={t('app.kuaizhizao.warehouseInbound.entry.purchase.batchWarehouseTitle')}
        open={batchWhModalOpen}
        onCancel={() => {
          if (batchWhApplying) return;
          setBatchWhModalOpen(false);
          setBatchWhSelectedId(undefined);
        }}
        onOk={() => {
          void handleBatchWhModalConfirm();
        }}
        confirmLoading={batchWhApplying}
        okText={t('app.kuaizhizao.warehouseInbound.action.applyToAllLines')}
        cancelText={t('app.kuaizhizao.warehouseInbound.action.cancel')}
        width={MODAL_CONFIG.SMALL_WIDTH}
        destroyOnHidden
      >
        <Select
          style={{ width: '100%' }}
          placeholder={t('app.kuaizhizao.warehouseInbound.field.selectWarehouse')}
          showSearch
          optionFilterProp="label"
          value={batchWhSelectedId}
          options={warehouseOptions}
          onChange={setBatchWhSelectedId}
        />
      </Modal>
    </DocumentFormPageLayout>
  );
};

export default InboundPoPullEntryPage;
