/**
 * 从生产工单取单开生产领料 — 独立 Tab 页
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  App,
  Button,
  Card,
  Col,
  Form,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Typography,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  DocumentFormPageLayout,
  MODAL_CONFIG,
  PAGE_SPACING,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { workOrderApi } from '../../../services/work-order';
import { warehouseApi } from '../../../services/warehouse-execution';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { formatDateBySiteSetting, formatQuantity } from '../../../../../utils/format';
import { formatQuantityWithUnit } from '../../../../../utils/materialUnitDisplay';
import {
  MaterialUnitSelect,
  fetchMaterialForUnitSelectCache,
} from '../../../../../components/material-unit-select';
import { recalculateQuantityOnUnitChange } from '../../../../../components/quantity-with-unit/formHelpers';
import {
  OutboundEntryOperatorField,
  OutboundEntryRemarksSection,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
  useOutboundOperatorSelect,
} from './outboundEntryShared';
import { getOutboundIssueTypeLabel } from './outboundHubTypes';
import { OUTBOUND_LIST_PATH, outboundWorkOrderEntryPath } from './outboundPaths';
import {
  navigateLeavingPullEntry,
  pullEntryTabKey,
} from '../shared/pullEntryCloseTab';
import {
  draftOptionalNumber,
  mergeMaterialIssueQuantities,
  mergeRecordMaps,
  usePullEntryFormDraft,
} from '../shared/pullEntryFormDraft';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import type { PushPreviewResponse } from '../../../services/sales-order';
import {
  loadConfirmPreviewMaterialMeta,
  type ConfirmPreviewMaterialMeta,
} from './outboundItemTracking';
import {
  loadBatchOptionsByMaterialId,
  loadInStockSerialOptions,
  resolveOutboundConfirmBatchValue,
  sumInventoryPickOptionQty,
  type InventoryPickOption,
} from './outboundConfirmInventoryOptions';
import {
  allocateBatchQuantitiesFifo,
  coerceBatchAllocationsDraft,
  isValidOutboundBatchAllocations,
  type OutboundBatchAllocation,
} from './outboundBatchAllocation';
import OutboundBatchAllocationField from './OutboundBatchAllocationField';
import OutboundSerialPickerField from './OutboundSerialPickerField';

type PickLine = {
  key: number;
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  requiredQuantity: number;
  pickedQuantity: number;
  pendingQuantity: number;
  issueQuantity: number;
};

function lineBatchKey(materialId: number, warehouseId?: number): string {
  return `${materialId}_${warehouseId ?? 0}`;
}

const OutboundWorkOrderPullEntryPage: React.FC = () => {
  const { t } = useTranslation();
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'outbound.pull_from_work_order');
  const { woId: woIdParam } = useParams<{ woId: string }>();
  const woId = Number(woIdParam);
  const navigate = useNavigate();
  const location = useLocation();
  const { message: messageApi } = App.useApp();
  const operatorHook = useOutboundOperatorSelect();
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const productionPickingAuditRequired = useAuditRequired('production_picking', false);
  const initRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState<Record<string, unknown> | null>(null);
  const [previewSummary, setPreviewSummary] = useState<string | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [lineWh, setLineWh] = useState<Record<number, number>>({});
  const [batchAllocations, setBatchAllocations] = useState<Record<number, OutboundBatchAllocation[]>>(
    {},
  );
  const [serials, setSerials] = useState<Record<number, string[]>>({});
  const [materialMeta, setMaterialMeta] = useState<Record<number, ConfirmPreviewMaterialMeta>>({});
  const [batchOptionsByKey, setBatchOptionsByKey] = useState<Record<string, InventoryPickOption[]>>({});
  const [batchOptionsLoading, setBatchOptionsLoading] = useState(false);
  const [serialOptionsByUuid, setSerialOptionsByUuid] = useState<Record<string, InventoryPickOption[]>>({});
  const [serialOptionsLoading, setSerialOptionsLoading] = useState(false);
  const [batchWhModalOpen, setBatchWhModalOpen] = useState(false);
  const [batchWhSelectedId, setBatchWhSelectedId] = useState<number | undefined>();
  const [batchWhApplying, setBatchWhApplying] = useState(false);
  const [notes, setNotes] = useState('');
  const [pickLines, setPickLines] = useState<PickLine[]>([]);
  const [maxQuantities, setMaxQuantities] = useState<Record<number, number>>({});
  const { bindSnapshot, persistNow, clearDraft, applyDraftOnce } = usePullEntryFormDraft(
    'kuaizhizao:outbound-work-order-pull',
  );

  const pagePath = Number.isFinite(woId) && woId > 0 ? outboundWorkOrderEntryPath(woId) : OUTBOUND_LIST_PATH;
  const woCode = String(workOrder?.code ?? workOrder?.work_order_code ?? '');
  const pageTitle = woCode
    ? `${pullFromWorkOrderAction.label} — ${woCode}`
    : pullFromWorkOrderAction.label;

  const totalIssueQty = useMemo(
    () => pickLines.reduce((sum, line) => sum + Number(line.issueQuantity || 0), 0),
    [pickLines],
  );

  const applyLineWarehouse = useCallback((lineIds: number[], warehouseId: number) => {
    if (!lineIds.length) return;
    const idSet = new Set(lineIds);
    setLineWh((prev) => {
      const next = { ...prev };
      lineIds.forEach((id) => {
        next[id] = warehouseId;
      });
      return next;
    });
    setBatchAllocations((prev) => {
      const next = { ...prev };
      lineIds.forEach((id) => {
        delete next[id];
      });
      return next;
    });
    // 选仓后：本次发料仍为 0 时填可领数量（非 BOM 总需求，避免把已领部分再发一次）
    setPickLines((prev) =>
      prev.map((row) => {
        if (!idSet.has(row.materialId)) return row;
        if (Number(row.issueQuantity || 0) > 0) return row;
        const pending = Number(row.pendingQuantity || 0);
        if (pending <= 0) return row;
        return { ...row, issueQuantity: pending };
      }),
    );
  }, []);

  const handleBatchApplyWarehouse = useCallback(
    async (warehouseId: number) => {
      const lineIds = pickLines.map((line) => line.materialId);
      if (!lineIds.length) {
        messageApi.warning(t('app.kuaizhizao.warehouseInbound.msg.noLinesToSetWarehouse'));
        return;
      }
      applyLineWarehouse(lineIds, warehouseId);
      messageApi.success(
        t('app.kuaizhizao.warehouseOutbound.entry.batchWarehouseApplied', { count: lineIds.length }),
      );
    },
    [applyLineWarehouse, messageApi, pickLines, t],
  );

  const handleBatchWhModalConfirm = async () => {
    if (batchWhSelectedId == null || !(batchWhSelectedId > 0)) {
      messageApi.warning(t('app.kuaizhizao.warehouseOutbound.msg.selectWarehouse'));
      return;
    }
    setBatchWhApplying(true);
    try {
      await handleBatchApplyWarehouse(batchWhSelectedId);
      setBatchWhModalOpen(false);
    } finally {
      setBatchWhApplying(false);
    }
  };

  useEffect(() => {
    const pairs = pickLines
      .map((line) => ({ materialId: line.materialId, warehouseId: lineWh[line.materialId] }))
      .filter((p) => p.warehouseId != null && p.warehouseId > 0);
    if (!pairs.length) {
      setBatchOptionsByKey({});
      return;
    }

    let cancelled = false;
    void (async () => {
      setBatchOptionsLoading(true);
      try {
        const next: Record<string, InventoryPickOption[]> = {};
        await Promise.all(
          pairs.map(async ({ materialId, warehouseId }) => {
            const key = lineBatchKey(materialId, warehouseId);
            const map = await loadBatchOptionsByMaterialId(
              [materialId],
              warehouseId,
              (batch, qty, warehouseName) =>
                warehouseName
                  ? t('app.kuaizhizao.warehouseOutbound.confirm.batchAvailableWithWh', {
                      batch,
                      qty,
                      warehouse: warehouseName,
                    })
                  : t('app.kuaizhizao.warehouseOutbound.confirm.batchAvailable', { batch, qty }),
            );
            next[key] = map[materialId] ?? [];
          }),
        );
        if (!cancelled) setBatchOptionsByKey(next);
      } catch {
        if (!cancelled) setBatchOptionsByKey({});
      } finally {
        if (!cancelled) setBatchOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lineWh, pickLines, t]);

  useEffect(() => {
    const uuids = [
      ...new Set(
        pickLines
          .map((line) => materialMeta[line.materialId]?.materialUuid)
          .filter((uuid): uuid is string => !!uuid),
      ),
    ];
    if (!uuids.length) {
      setSerialOptionsByUuid({});
      return;
    }

    let cancelled = false;
    void (async () => {
      setSerialOptionsLoading(true);
      try {
        const next: Record<string, InventoryPickOption[]> = {};
        await Promise.all(
          uuids.map(async (uuid) => {
            next[uuid] = await loadInStockSerialOptions(uuid);
          }),
        );
        if (!cancelled) setSerialOptionsByUuid(next);
      } catch {
        if (!cancelled) setSerialOptionsByUuid({});
      } finally {
        if (!cancelled) setSerialOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickLines, materialMeta]);

  useEffect(() => {
    if (!pickLines.length) return;
    setBatchAllocations((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const line of pickLines) {
        const meta = materialMeta[line.materialId];
        if (!meta?.batchManaged) continue;
        const whId = lineWh[line.materialId];
        if (!(whId > 0)) continue;
        const opts = batchOptionsByKey[lineBatchKey(line.materialId, whId)] ?? [];
        if (!opts.length) continue;
        const current = prev[line.materialId] ?? [];
        const issueQty = Number(line.issueQuantity || 0);
        // 仅一条在库批号且尚未选择时自动带出，并按本次发料分摊
        if (!current.length) {
          if (opts.length !== 1) continue;
          const resolved = resolveOutboundConfirmBatchValue(undefined, opts);
          if (!resolved) continue;
          next[line.materialId] = allocateBatchQuantitiesFifo(issueQty, [resolved], opts);
          changed = true;
          continue;
        }
        // 本次发料变化时，在已选批号间重新 FIFO 分摊（保留批号选择）
        const nos = current.map((a) => a.batchNo);
        const redistributed = allocateBatchQuantitiesFifo(issueQty, nos, opts, current);
        const same =
          redistributed.length === current.length &&
          redistributed.every(
            (a, i) =>
              a.batchNo === current[i]?.batchNo &&
              Math.abs(a.quantity - (current[i]?.quantity ?? 0)) < 1e-6,
          );
        if (!same) {
          next[line.materialId] = redistributed;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [batchOptionsByKey, lineWh, materialMeta, pickLines]);

  const lineColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'materialCode', width: 120 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'materialName', ellipsis: true },
      {
        title: t('common.unit'),
        dataIndex: 'unit',
        width: 88,
        align: 'center' as const,
        render: (_: unknown, line: PickLine) => (
          <MaterialUnitSelect
            materialId={line.materialId}
            value={line.unit}
            size="small"
            noStyle
            onChange={(newUnit) => {
              void (async () => {
                const material = await fetchMaterialForUnitSelectCache(line.materialId);
                setPickLines((prev) =>
                  prev.map((row) => {
                    if (row.materialId !== line.materialId) return row;
                    const convert = (qty: number) =>
                      recalculateQuantityOnUnitChange({
                        material,
                        currentQuantity: qty,
                        oldUnit: row.unit,
                        newUnit,
                      });
                    const pending = convert(row.pendingQuantity);
                    setMaxQuantities((mq) => ({ ...mq, [line.materialId]: pending }));
                    return {
                      ...row,
                      unit: newUnit,
                      requiredQuantity: convert(row.requiredQuantity),
                      pickedQuantity: convert(row.pickedQuantity),
                      pendingQuantity: pending,
                      issueQuantity: convert(row.issueQuantity),
                    };
                  }),
                );
              })();
            }}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.entry.requiredQty'),
        dataIndex: 'requiredQuantity',
        width: 120,
        align: 'right' as const,
        render: (value: number, line: PickLine) => formatQuantityWithUnit(value, line.unit),
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.pull.colPickedQty'),
        dataIndex: 'pickedQuantity',
        width: 120,
        align: 'right' as const,
        render: (value: number, line: PickLine) => formatQuantityWithUnit(value, line.unit),
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.pull.colPickableQty'),
        dataIndex: 'pendingQuantity',
        width: 120,
        align: 'right' as const,
        render: (value: number, line: PickLine) => formatQuantityWithUnit(value, line.unit),
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.pull.colCurrentStock'),
        key: 'currentStock',
        width: 100,
        align: 'right' as const,
        render: (_: unknown, line: PickLine) => {
          const whId = lineWh[line.materialId];
          if (!(whId > 0)) return '—';
          if (batchOptionsLoading) return '…';
          const stock = sumInventoryPickOptionQty(
            batchOptionsByKey[lineBatchKey(line.materialId, whId)],
          );
          const insufficient = stock < line.pendingQuantity;
          return (
            <Typography.Text type={insufficient ? 'danger' : undefined}>
              {formatQuantity(stock)}
            </Typography.Text>
          );
        },
      },
      {
        title: (
          <>
            {t('app.kuaizhizao.warehouseOutbound.col.warehouseName')}
            <Typography.Text type="danger"> *</Typography.Text>
          </>
        ),
        key: 'warehouse',
        width: 160,
        render: (_: unknown, line: PickLine) => (
          <Select
            style={{ width: '100%', minWidth: 140 }}
            placeholder={t('app.kuaizhizao.warehouseOutbound.msg.selectWarehouse')}
            showSearch
            optionFilterProp="label"
            options={warehouseOptions}
            value={lineWh[line.materialId]}
            onChange={(nv) => {
              const wh = Number(nv);
              if (!(wh > 0)) return;
              applyLineWarehouse([line.materialId], wh);
            }}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.col.batchNo'),
        key: 'batch',
        width: 220,
        render: (_: unknown, line: PickLine) => {
          const meta = materialMeta[line.materialId];
          if (!meta?.batchManaged) return '—';
          const whId = lineWh[line.materialId];
          if (!(whId > 0)) return '—';
          const opts = batchOptionsByKey[lineBatchKey(line.materialId, whId)] ?? [];
          const materialLabel = [line.materialCode, line.materialName].filter(Boolean).join(' - ');
          return (
            <OutboundBatchAllocationField
              value={batchAllocations[line.materialId] ?? []}
              onChange={(next) =>
                setBatchAllocations((prev) => ({
                  ...prev,
                  [line.materialId]: next,
                }))
              }
              options={opts}
              totalQuantity={Number(line.issueQuantity || 0)}
              loading={batchOptionsLoading}
              materialLabel={materialLabel}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.col.serialNo'),
        key: 'serial',
        width: 160,
        render: (_: unknown, line: PickLine) => {
          const meta = materialMeta[line.materialId];
          if (!meta?.serialManaged) return '—';
          const qty = Number(line.issueQuantity || 0);
          const uuid = meta.materialUuid;
          const opts = uuid ? serialOptionsByUuid[uuid] ?? [] : [];
          const materialLabel = [line.materialCode, line.materialName].filter(Boolean).join(' - ');
          return (
            <OutboundSerialPickerField
              value={serials[line.materialId] ?? []}
              onChange={(next) => setSerials((prev) => ({ ...prev, [line.materialId]: next }))}
              options={opts}
              maxCount={qty > 0 ? qty : undefined}
              loading={serialOptionsLoading}
              materialLabel={materialLabel}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.entry.thisIssue'),
        key: 'issueQuantity',
        width: 140,
        render: (_: unknown, line: PickLine) => (
          <InputNumber
            min={0}
            max={line.pendingQuantity}
            value={line.issueQuantity}
            onChange={(v) => {
              const qty = Number(v ?? 0);
              setPickLines((prev) =>
                prev.map((row) =>
                  row.key === line.key ? { ...row, issueQuantity: qty } : row,
                ),
              );
            }}
            style={{ width: '100%' }}
          />
        ),
      },
      { title: t('common.unit'), dataIndex: 'unit', width: 60 },
    ],
    [
      applyLineWarehouse,
      batchAllocations,
      batchOptionsByKey,
      batchOptionsLoading,
      lineWh,
      materialMeta,
      serialOptionsByUuid,
      serialOptionsLoading,
      serials,
      t,
      warehouseOptions,
    ],
  );

  const leavePage = useCallback(() => {
    clearDraft();
    navigateLeavingPullEntry(
      navigate,
      OUTBOUND_LIST_PATH,
      pullEntryTabKey(location.pathname, location.search),
    );
  }, [clearDraft, navigate, location.pathname, location.search]);

  useEffect(() => {
    bindSnapshot(() => ({
      lineWh,
      batchAllocations,
      serials,
      notes,
      receiverUuid: operatorHook.receiverUuid,
      receiverName: operatorHook.receiverName,
      issueQuantities: Object.fromEntries(pickLines.map((line) => [line.materialId, line.issueQuantity])),
      maxQuantities,
    }));
    persistNow();
  }, [
    lineWh,
    batchAllocations,
    serials,
    notes,
    pickLines,
    maxQuantities,
    operatorHook.receiverUuid,
    operatorHook.receiverName,
    bindSnapshot,
    persistNow,
  ]);

  useEffect(() => {
    if (!(Number.isFinite(woId) && woId > 0)) {
      messageApi.error(t('app.kuaizhizao.warehouseOutbound.entry.invalidWorkOrder'));
      leavePage();
    }
  }, [woId, leavePage, messageApi, t]);

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
    if (!Number.isFinite(woId) || woId <= 0 || initRef.current) return;
    initRef.current = true;
    void (async () => {
      setLoading(true);
      try {
        const [woRaw, whRes, previewRaw] = await Promise.all([
          workOrderApi.get(String(woId)),
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
          workOrderApi.previewPushProductionPicking(woId) as Promise<PushPreviewResponse>,
        ]);
        if (previewRaw?.has_blocking_issues) {
          messageApi.warning(previewRaw.blocking_reason || t('app.kuaizhizao.warehouseOutbound.pull.woPreviewNoLines'));
          leavePage();
          return;
        }
        const previewItems = previewRaw?.items ?? [];
        if (!previewItems.length) {
          messageApi.warning(t('app.kuaizhizao.warehouseOutbound.pull.woPreviewNoLines'));
          leavePage();
          return;
        }
        setWorkOrder(woRaw as Record<string, unknown>);
        setWarehouseOptions(mapWarehouseSelectOptions(whRes));
        setPreviewSummary(previewRaw.summary ?? null);
        const maxMap: Record<number, number> = {};
        const lines = previewItems.map((row) => {
          const materialId = Number(row.item_id);
          const pending = Number(row.max_push_quantity ?? 0);
          maxMap[materialId] = pending;
          return {
            key: materialId,
            materialId,
            materialCode: String(row.material_code ?? ''),
            materialName: String(row.material_name ?? ''),
            unit: String(row.material_unit ?? ''),
            requiredQuantity: Number(row.quantity ?? 0),
            pickedQuantity: Number(row.pushed_quantity ?? 0),
            pendingQuantity: pending,
            issueQuantity: 0,
          };
        });
        setPickLines(lines);
        setMaxQuantities(maxMap);
        const meta = await loadConfirmPreviewMaterialMeta(
          lines.map((line) => ({
            id: line.materialId,
            material_id: line.materialId,
            material_code: line.materialCode,
          })),
        );
        setMaterialMeta(meta);
        applyDraftOnce((draft) => {
          // 兼容历史草稿：曾把表头「默认仓」写成 defaultWarehouseId / warehouseId
          const legacyHeaderWhId = draftOptionalNumber(draft.defaultWarehouseId ?? draft.warehouseId);
          if (typeof draft.notes === 'string') setNotes(draft.notes);
          if (draft.maxQuantities) {
            setMaxQuantities((prev) => mergeRecordMaps(prev, draft.maxQuantities as Record<number, number>));
          }
          if (draft.lineWh) {
            setLineWh(mergeRecordMaps({}, draft.lineWh as Record<number, number>));
          } else if (legacyHeaderWhId != null) {
            setLineWh(Object.fromEntries(lines.map((line) => [line.materialId, legacyHeaderWhId])));
          }
          const draftBatchRaw = (draft.batchAllocations ?? draft.batchNumbers) as
            | Record<number, unknown>
            | undefined;
          if (draftBatchRaw) {
            const restored: Record<number, OutboundBatchAllocation[]> = {};
            for (const [midStr, raw] of Object.entries(draftBatchRaw)) {
              const mid = Number(midStr);
              if (!(mid > 0)) continue;
              const issueQty = Number(
                (draft.issueQuantities as Record<number, number> | undefined)?.[mid] ?? 0,
              );
              const allocs = coerceBatchAllocationsDraft(raw, issueQty);
              if (allocs?.length) restored[mid] = allocs;
            }
            if (Object.keys(restored).length) setBatchAllocations(restored);
          }
          if (draft.serials) {
            setSerials(mergeRecordMaps({}, draft.serials as Record<number, string[]>));
          }
          operatorHook.restoreReceiver(
            typeof draft.receiverUuid === 'string' ? draft.receiverUuid : undefined,
            typeof draft.receiverName === 'string' ? draft.receiverName : undefined,
          );
          if (draft.issueQuantities) {
            setPickLines((prev) =>
              mergeMaterialIssueQuantities(prev, draft.issueQuantities as Record<number, number>),
            );
          }
        });
      } catch (e: unknown) {
        messageApi.error((e as Error)?.message || t('app.kuaizhizao.warehouseOutbound.entry.loadWorkOrderFailed'));
        leavePage();
      } finally {
        setLoading(false);
      }
    })();
  }, [woId, leavePage, messageApi, t, applyDraftOnce, operatorHook.restoreReceiver]);

  const submit = async (mode: 'draft' | 'confirm') => {
    const activeLines = pickLines.filter((line) => line.issueQuantity > 0);
    if (!activeLines.length) {
      messageApi.warning(t('app.kuaizhizao.warehouseOutbound.entry.fillIssueQty'));
      return;
    }
    for (const line of activeLines) {
      const max = Number(maxQuantities[line.materialId] ?? line.pendingQuantity ?? 0);
      if (line.issueQuantity > max) {
        messageApi.error(
          t('app.kuaizhizao.warehouseOutbound.entry.qtyExceedsPending', {
            material: line.materialCode || line.materialName,
            max,
          }),
        );
        return;
      }
      const wh = lineWh[line.materialId];
      if (wh == null || !(wh > 0)) {
        messageApi.error(
          t('app.kuaizhizao.salesOrder.pushShipmentSelectLineWarehouse', {
            material: line.materialCode || line.materialName || line.materialId,
          }),
        );
        return;
      }
      const meta = materialMeta[line.materialId];
      if (mode === 'confirm' && meta?.batchManaged) {
        const opts = batchOptionsByKey[lineBatchKey(line.materialId, wh)] ?? [];
        const allocs = batchAllocations[line.materialId] ?? [];
        if (!isValidOutboundBatchAllocations(allocs, opts, line.issueQuantity)) {
          messageApi.error(
            t('app.kuaizhizao.warehouseOutbound.confirm.batchAllocationRequired', {
              material: line.materialCode || line.materialName,
              qty: line.issueQuantity,
              batches: opts.map((o) => o.value).join('、') || '—',
            }),
          );
          return;
        }
      }
      if (mode === 'confirm' && meta?.serialManaged) {
        const pickedSerials = serials[line.materialId] ?? [];
        if (pickedSerials.length !== line.issueQuantity) {
          messageApi.error(
            t('app.kuaizhizao.warehouseOutbound.entry.serialCountMismatch', {
              material: line.materialCode || line.materialName,
              required: line.issueQuantity,
              actual: pickedSerials.length,
            }),
          );
          return;
        }
      }
      // 序列号物料暂不支持同一次领料拆多批（序列归属批号需一一对应）
      if (
        meta?.serialManaged &&
        (batchAllocations[line.materialId] ?? []).filter((a) => Number(a.quantity) > 0).length > 1
      ) {
        messageApi.error(
          t('app.kuaizhizao.warehouseOutbound.confirm.batchSerialMultiNotSupported', {
            material: line.materialCode || line.materialName,
          }),
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const submitLines = activeLines.flatMap((line) => {
        const whId = lineWh[line.materialId];
        const whOpt = warehouseOptions.find((o) => o.value === whId);
        const lineSerials = serials[line.materialId] ?? [];
        const meta = materialMeta[line.materialId];
        const allocs = (batchAllocations[line.materialId] ?? []).filter(
          (a) => String(a.batchNo).trim() && Number(a.quantity) > 0,
        );
        const base = {
          material_id: line.materialId,
          material_code: line.materialCode,
          material_name: line.materialName,
          material_unit: line.unit || '个',
          warehouse_id: whId,
          warehouse_name: whOpt?.name,
          serial_numbers: lineSerials.length ? lineSerials : undefined,
        };
        // 批号管理：按批拆行（同物料多批 → 多条 ProductionPickingItem）
        if (meta?.batchManaged && allocs.length > 0) {
          return allocs.map((a) => ({
            ...base,
            issue_quantity: a.quantity,
            batch_number: a.batchNo,
          }));
        }
        return [
          {
            ...base,
            issue_quantity: line.issueQuantity,
            batch_number: undefined as string | undefined,
          },
        ];
      });
      const created = await warehouseApi.productionPicking.pullFromWorkOrder({
        work_order_id: woId,
        picker_name: operatorHook.receiverName.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: submitLines,
      });
      if (created?.id == null) {
        messageApi.error(t('app.kuaizhizao.warehouseOutbound.entry.noPickingId'));
        return;
      }
      invalidateMenuBadgeCounts();
      clearDraft();
      if (mode === 'confirm') {
        if (productionPickingAuditRequired) {
          messageApi.success(
            t('app.kuaizhizao.warehouseOutbound.picking.createdPendingAudit', {
              code: created.picking_code ? `：${created.picking_code}` : '',
            }),
          );
          leavePage();
        } else {
          navigateLeavingPullEntry(
            navigate,
            OUTBOUND_LIST_PATH,
            pullEntryTabKey(location.pathname, location.search),
            {
              outboundDirectConfirm: {
                id: Number(created.id),
                outbound_type: 'production_picking',
              },
            },
          );
        }
      } else {
        messageApi.success(
          t('app.kuaizhizao.warehouseOutbound.entry.draftPickingCreated', {
            code: created.picking_code ? `：${created.picking_code}` : '',
          }),
        );
        leavePage();
      }
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } };
      messageApi.error(err?.message || err?.response?.data?.detail || t('common.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DocumentFormPageLayout
      header={
        <>
          <Space align="center" size={8}>
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label={t('common.back')} onClick={leavePage} />
            <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
              {pageTitle}
            </Typography.Title>
          </Space>
          <Space wrap>
            <Button disabled={submitting || loading} onClick={leavePage}>
              {t('common.cancel')}
            </Button>
            <Button loading={submitting} disabled={loading || pickLines.length === 0} onClick={() => void submit('draft')}>
              {t('app.kuaizhizao.warehouseOutbound.action.generateDraft')}
            </Button>
            <Button type="primary" loading={submitting} disabled={loading || pickLines.length === 0} onClick={() => void submit('confirm')}>
              {t('app.kuaizhizao.warehouseOutbound.action.confirmOutbound')}
            </Button>
          </Space>
        </>
      }
    >
      <Spin spinning={loading}>
        <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
          {workOrder && (
            <Form layout="vertical" requiredMark={false}>
              <Row gutter={16}>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.field.outboundType')}>
                    <ReadOnlyFormValue value={getOutboundIssueTypeLabel(t, 'production_picking')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.col.workOrderCode')}>
                    <ReadOnlyFormValue value={woCode} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.product')}>
                    <ReadOnlyFormValue value={String(workOrder.product_name ?? workOrder.name ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.workOrderStatus')}>
                    <ReadOnlyFormValue value={String(workOrder.status ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.plannedQty')}>
                    <ReadOnlyFormValue value={String(workOrder.quantity ?? '')} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Form.Item label={t('app.kuaizhizao.warehouseOutbound.entry.plannedStart')}>
                    <ReadOnlyFormValue
                      value={
                        workOrder.planned_start_date
                          ? formatDateBySiteSetting(String(workOrder.planned_start_date))
                          : undefined
                      }
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <OutboundEntryOperatorField hook={operatorHook} />
                </Col>
                <Col xs={24}>
                  <OutboundEntryRemarksSection value={notes} onChange={setNotes} />
                </Col>
              </Row>
            </Form>
          )}
          <div className="uni-table-detail" style={{ marginTop: PAGE_SPACING.BLOCK_GAP }}>
            <UniTableDetailHeader
              title={t('app.kuaizhizao.warehouseOutbound.entry.issueDetails')}
              headerExtra={
                <Space wrap size={8}>
                  {previewSummary ? (
                    <Typography.Text type="secondary">
                      {previewSummary}
                      {totalIssueQty > 0 ? ` / 本次领料 ${totalIssueQty}` : ''}
                    </Typography.Text>
                  ) : null}
                  <Button size="small" onClick={() => setBatchWhModalOpen(true)} disabled={!pickLines.length}>
                    {t('app.kuaizhizao.warehouseOutbound.entry.batchSetLineWarehouse')}
                  </Button>
                </Space>
              }
            />
            <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
            <div className="uni-table-detail-body">
              <div className="uni-table-detail-scroll">
                <Table
                  className="uni-detail-table warehouse-detail-table"
                  size="small"
                  rowKey="key"
                  pagination={false}
                  scroll={{ x: 1600 }}
                  dataSource={pickLines}
                  columns={lineColumns}
                  locale={{ emptyText: t('app.kuaizhizao.warehouseOutbound.pull.woPreviewNoLines') }}
                />
              </div>
            </div>
          </div>
        </Card>
      </Spin>
      <Modal
        {...MODAL_CONFIG}
        title={t('app.kuaizhizao.warehouseOutbound.entry.batchSetLineWarehouse')}
        open={batchWhModalOpen}
        onCancel={() => setBatchWhModalOpen(false)}
        onOk={() => void handleBatchWhModalConfirm()}
        confirmLoading={batchWhApplying}
        destroyOnHidden
      >
        <Select
          style={{ width: '100%' }}
          placeholder={t('app.kuaizhizao.warehouseOutbound.msg.selectWarehouse')}
          showSearch
          optionFilterProp="label"
          options={warehouseOptions}
          value={batchWhSelectedId}
          onChange={(v) => setBatchWhSelectedId(Number(v))}
        />
      </Modal>
    </DocumentFormPageLayout>
  );
};

export default OutboundWorkOrderPullEntryPage;
