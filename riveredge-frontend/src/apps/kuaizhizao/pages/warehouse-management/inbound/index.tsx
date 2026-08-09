/**
 * 入库管理页面
 *
 * 提供入库单的管理功能，支持多种入库类型：采购入库、成品入库（产品入库）、生产退料等。
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useNavigate, useLocation } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProForm, ProFormItem, type ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, InputNumber, Input, Typography, Select, Spin, Descriptions, Empty, Upload, theme as AntdTheme } from 'antd';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import {
  EyeOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  RollbackOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { MaterialUnitSelect, prefetchMaterialsForUnitSelect } from '../../../../../components/material-unit-select';
import { useTranslation } from 'react-i18next';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { ListPageTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { UniPullLoadButton } from '../../../../../components/uni-pull';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useGlobalStore } from '../../../../../stores';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../WarehouseTraceBriefFooter';
import {
  warehouseApi,
  outsourceMaterialReceiptApi,
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
} from '../../../services/production';
import { LinkedIqcPanel, LinkedFqcPanel } from '../../quality-management/components/LinkedInspectionPanel';
import { getInboundLifecycle } from '../../../utils/inboundLifecycle';
import {
  warehouseApi as masterWarehouseApi,
  storageAreaApi,
  storageLocationApi,
} from '../../../../master-data/services/warehouse';
import { materialApi, materialBatchApi, materialSerialApi } from '../../../../master-data/services/material';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { SerialNumbersImportTrigger } from '../../../../../components/serial-numbers-import';
import {
  loadConfirmPreviewMaterialMeta,
  type ConfirmPreviewMaterialMeta,
} from './inboundItemTracking';
import { buildKuaizhizaoPullCreateMenuItems } from '../../../constants/documentActionRegistry';
import { customerMaterialRegistrationApi } from '../../../services/customer-material-registration';
import {formatDateBySiteSetting, formatDateTimeBySiteSetting, formatQuantity} from '../../../../../utils/format';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import {
  DocumentPushProgressBar,
  DOCUMENT_PROGRESS_COLUMN_WIDTH,
  ratioToPushProgressPercent,
} from '../../sales-management/shared/DocumentPushProgressBar';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import InboundQuickPullModals, {
  type InboundQuickPullModalsRef,
} from './InboundQuickPullModals';
import type {
  InboundPullEntryNavigationState,
  PurchaseReceiptEntryHandoff,
} from './inboundPullEntryTypes';
import { fetchInboundHubList } from './inboundListAggregate';
import { fetchInboundHubDetail } from './inboundHubDetail';
import { fetchPurchaseReceiptIqcEnsure } from './inboundPurchaseIqcGate';
import { PurchaseReceiptIqcReviewModal } from './PurchaseReceiptIqcReviewModal';
import { fetchCustomerMaterialIqcEnsure } from './inboundCustomerMaterialIqcGate';
import { CustomerMaterialIqcReviewModal } from './CustomerMaterialIqcReviewModal';
import {
  fetchFinishedGoodsReceiptFqcEnsure,
  fetchSemiFinishedGoodsReceiptFqcEnsure,
} from './inboundFinishedGoodsFqcGate';
import { FinishedGoodsReceiptFqcReviewModal } from './FinishedGoodsReceiptFqcReviewModal';
import type {
  EnsureIqcForPurchaseReceiptResult,
  EnsureIqcForCustomerMaterialRegistrationResult,
  EnsureFqcForFinishedGoodsReceiptResult,
} from '../../../services/quality-execution';
import {
  type InboundHubOrder,
  type InboundReceiptType,
  inboundReceiptTypeLabel,
  inboundReceiptTypeSegmentOptions,
  isInboundConfirmable,
  inboundConfirmCapabilityReasonMessage,
  inboundSourceDocNo,
  resolveInboundHubOperator,
} from './inboundHubTypes';
import { inboundReceiptTypeMarkerValueEnum, renderInboundReceiptTypeMarkerTag } from '../shared/warehouseMarkerTags';
import {
  normalizeInboundHubDetail,
  resolveInboundHubDetailItems,
  resolveInboundHubStatusLabel,
  resolveInboundHubStatusTagColor,
} from './inboundHubNormalize';
import { MarkerTag, StatusTag } from '../../../../../constants/statusBadges';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { inboundReceiptTypeToPrintDocumentType } from '../../../utils/kuaizhizaoPrintConfig';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildInboundHubStatusValueEnum,
  resolveInboundHubListParams,
} from '../../../utils/warehouseListCore';

interface InboundOrder extends InboundHubOrder {
  workshop_name?: string;
  notes?: string;
  attachments?: { uid?: string; name?: string; url?: string }[];
  review_status?: string;
  items?: InboundOrderItem[];
}

interface InboundOrderItem {
  id?: number;
  tenant_id?: number;
  receipt_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  purchase_order_item_id?: number;
  receipt_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  batch_number?: string;
  serial_numbers?: string[];
  return_quantity?: number;
  status?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  location_id?: number;
  location_code?: string;
}

/** 单位列展示：直接显示物料单位码，避免 DictionaryLabel 请求 unit 字典（未配置时 404） */
function formatInboundMaterialUnit(val: unknown): string {
  if (val == null || val === '') return '-';
  return String(val);
}

function renderInboundDetailUnitCell(row: InboundOrderItem): React.ReactNode {
  if (row.material_id != null) {
    return (
      <MaterialUnitSelect
        materialId={row.material_id}
        value={row.material_unit ?? row.unit}
        size="small"
        disabled
        noStyle
      />
    );
  }
  return formatInboundMaterialUnit(row.material_unit ?? row.unit);
}

function formatInboundDateDisplay(record: InboundOrder): string {
  const dateOnly = record.receipt_date ?? record.registration_date;
  if (dateOnly) return formatDateBySiteSetting(dateOnly);
  const timeValue =
    record.receipt_time ?? record.return_time ?? record.received_at ?? record.returned_at;
  if (timeValue) return formatDateTimeBySiteSetting(timeValue);
  return '-';
}

/** 列表「时间」列：优先完整业务时刻，无时刻再回落业务日 */
function formatInboundDateTimeDisplay(record: InboundOrder): string {
  const timeValue =
    record.receipt_time ?? record.return_time ?? record.received_at ?? record.returned_at;
  if (timeValue) return formatDateTimeBySiteSetting(timeValue);
  const dateOnly = record.receipt_date ?? record.registration_date;
  if (dateOnly) return formatDateBySiteSetting(dateOnly);
  return '-';
}

/**
 * 对「已启用批号管理且当前批号为空」的明细，按主数据物料默认批号规则生成批号（每行独立一条，便于多行同料多批次）。
 */
async function prefetchPurchasePreviewBatchNumbers(
  items: any[] | undefined,
  initialBatch: Record<number, string>
): Promise<Record<number, string>> {
  const out: Record<number, string> = { ...initialBatch };
  const rowsNeed = (items || []).filter((it) => {
    if (it?.id == null) return false;
    const id = Number(it.id);
    const existing = String(out[id] ?? it.batch_number ?? '').trim();
    return !existing && String(it.material_code || '').trim() !== '';
  });
  if (rowsNeed.length === 0) return out;

  const codes = [...new Set(rowsNeed.map((it) => String(it.material_code || '').trim()))];
  const materialByCode = new Map<
    string,
    { uuid: string; batchManaged: boolean; defaultBatchRuleId: number | null }
  >();

  await Promise.all(
    codes.map(async (code) => {
      try {
        const res = await materialApi.list({ code, limit: 1 });
        const m = res.items?.[0] ?? null;
        if (!m?.uuid) return;
        const batchManaged = !!(m.batchManaged ?? (m as any).batch_managed);
        const defaultBatchRuleId =
          (m.defaultBatchRuleId ?? (m as any).default_batch_rule_id ?? null) as number | null;
        materialByCode.set(code, {
          uuid: m.uuid,
          batchManaged,
          defaultBatchRuleId:
            defaultBatchRuleId != null && Number(defaultBatchRuleId) > 0 ? Number(defaultBatchRuleId) : null,
        });
      } catch {
        /* 主数据不可用时跳过自动批号 */
      }
    })
  );

  /** 同物料多行：先同步算好每行 offset，避免 Promise.all 并发导致多行同取 offset=0 */
  const previewOffsetByCode = new Map<string, number>();
  const rowPreviewOffset = new Map<number, number>();
  for (const it of rowsNeed) {
    const code = String(it.material_code || '').trim();
    const id = Number(it.id);
    const n = previewOffsetByCode.get(code) ?? 0;
    rowPreviewOffset.set(id, n);
    previewOffsetByCode.set(code, n + 1);
  }
  await Promise.all(
    rowsNeed.map(async (it) => {
      const id = Number(it.id);
      const code = String(it.material_code || '').trim();
      const meta = materialByCode.get(code);
      if (!meta?.batchManaged || !meta.uuid) return;
      const off = rowPreviewOffset.get(id) ?? 0;
      try {
        const res = await materialBatchApi.generate(meta.uuid, {
          ruleId: meta.defaultBatchRuleId != null ? meta.defaultBatchRuleId : undefined,
          preview: true,
          previewOffset: off,
        });
        if (res?.batch_no) out[id] = res.batch_no;
      } catch {
        /* 生成失败则保留空，由用户手工填写 */
      }
    })
  );

  return out;
}

/** 对「已启用序列号管理且当前无序列号」的明细，按主数据默认序列号规则自动生成 */
async function prefetchPurchasePreviewSerialNumbers(
  items: any[] | undefined,
  initialSerial: Record<number, string[]>,
  materialMeta: Record<number, ConfirmPreviewMaterialMeta>,
  qtyMap: Record<number, number>,
): Promise<Record<number, string[]>> {
  const out: Record<number, string[]> = { ...initialSerial };
  const rowsNeed = (items || []).filter((it) => {
    if (it?.id == null) return false;
    const id = Number(it.id);
    if ((out[id]?.length ?? 0) > 0) return false;
    const meta = materialMeta[id];
    if (!meta?.serialManaged || !meta.materialUuid) return false;
    return Number(qtyMap[id] ?? 0) > 0;
  });
  if (rowsNeed.length === 0) return out;

  await Promise.all(
    rowsNeed.map(async (it) => {
      const id = Number(it.id);
      const meta = materialMeta[id];
      if (!meta?.materialUuid) return;
      const count = Math.max(1, Math.floor(Number(qtyMap[id] ?? 0)));
      if (count > 100) return;
      try {
        const res = await materialSerialApi.generate(meta.materialUuid, count, {
          ruleId: meta.defaultSerialRuleId ?? undefined,
        });
        if (res?.serial_nos?.length) out[id] = res.serial_nos;
      } catch {
        /* 生成失败则保留空，由用户手动录入 */
      }
    }),
  );

  return out;
}

/** 编码与名称相同时只显示其一，避免「ZB-01-01 ZB-01-01」重复 */
function formatStorageAreaOrLocationLabel(code?: string, name?: string): string {
  const c = (code || '').trim();
  const n = (name || '').trim();
  if (c && n && c === n) return c;
  return [c, n].filter(Boolean).join(' ').trim();
}

/** 按仓库拉取库区下全部库位，供确认入库预览行内选择；展示为「库区 - 库位」 */
async function fetchStorageLocationsForWarehouse(
  warehouseId: number
): Promise<{ value: number; label: string; code: string }[]> {
  const saRes = await storageAreaApi.list({
    warehouse_id: warehouseId,
    limit: 500,
    is_active: true,
  } as any);
  const areas = (saRes as { items?: { id: number; code?: string; name?: string }[] })?.items ?? [];
  const parts = await Promise.all(
    areas.map(async (a) => {
      const locRes = await storageLocationApi.list({
        storage_area_id: a.id,
        limit: 500,
        is_active: true,
      } as any);
      const locs = (locRes as { items?: { id: number; code?: string; name?: string }[] })?.items ?? [];
      const areaLabel = formatStorageAreaOrLocationLabel(a.code, a.name) || `库区${a.id}`;
      return locs.map((l) => {
        const locLabel = formatStorageAreaOrLocationLabel(l.code, l.name) || String(l.id);
        return {
          value: l.id,
          label: `${areaLabel} - ${locLabel}`,
          code: String(l.code || ''),
        };
      });
    })
  );
  return parts.flat().sort((a, b) => a.label.localeCompare(b.label));
}

const INBOUND_DETAIL_ITEMS_MIN_WIDTH = 1280;

function renderInboundDetailSerialCell(t: (key: string, options?: { count?: number }) => string, val: unknown): string {
  if (!Array.isArray(val) || val.length === 0) return '—';
  return t('app.kuaizhizao.warehouseInbound.detail.serialCount', { count: val.length });
}

const PURCHASE_RECEIPT_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_purchase_receipts';
const PRODUCTION_RETURN_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_production_returns';
const FINISHED_GOODS_RECEIPT_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_finished_goods_receipts';

function inboundDocumentTrackingType(
  order: InboundOrder,
):
  | 'purchase_receipt'
  | 'finished_goods_receipt'
  | 'semi_finished_goods_receipt'
  | 'production_return'
  | undefined {
  if (order.receipt_type === 'purchase') return 'purchase_receipt';
  if (order.receipt_type === 'finished_goods') return 'finished_goods_receipt';
  if (order.receipt_type === 'semi_finished_goods') return 'semi_finished_goods_receipt';
  if (order.receipt_type === 'production_return') return 'production_return';
  return undefined;
}

/** 列表行状态（兼容大小写/空格） */
function inboundRowStatus(record: InboundOrder): string {
  const v = record?.status ?? (record as Record<string, unknown>)?.document_status;
  return String(v ?? '').trim();
}

/** 已入账库存的入库类单据（可撤回冲减库存） */
function isInboundStockPosted(record: InboundOrder): boolean {
  const s = inboundRowStatus(record);
  const sl = s.toLowerCase();
  if (record.receipt_type === 'production_return') {
    return s === '已退料';
  }
  if (record.receipt_type === 'customer_material') {
    return s === 'processed' || s === '已入库';
  }
  if (record.receipt_type === 'sales_return') {
    return s === '已退货' || sl === 'completed';
  }
  if (record.receipt_type === 'material_return') {
    return s === '已归还' || sl === 'completed';
  }
  return (
    s === '已入库' ||
    s === '已退货' ||
    s === '已退料' ||
    s === '已归还' ||
    s === '已完成' ||
    s === '已确认' ||
    sl === 'completed' ||
    sl === 'posted'
  );
}

const INBOUND_DELETABLE_TYPES = new Set([
  'production_return',
  'purchase',
  'finished_goods',
  'semi_finished_goods',
  'sales_return',
  'other_inbound',
  'material_return',
]);

/** 与行内删除按钮一致：可确认态 + 类型支持删除 */
function isInboundDeletable(record: InboundOrder): boolean {
  if (!record.id || !isInboundConfirmable(record)) return false;
  return INBOUND_DELETABLE_TYPES.has(String(record.receipt_type ?? ''));
}

async function deleteInboundDocument(record: InboundOrder): Promise<void> {
  if (record.receipt_type === 'purchase') {
    await warehouseApi.purchaseReceipt.delete(String(record.id));
  } else if (record.receipt_type === 'finished_goods') {
    await warehouseApi.finishedGoodsReceipt.delete(String(record.id));
  } else if (record.receipt_type === 'semi_finished_goods') {
    await warehouseApi.semiFinishedGoodsReceipt.delete(String(record.id));
  } else if (record.receipt_type === 'production_return') {
    await warehouseApi.productionReturn.delete(String(record.id));
  } else if (record.receipt_type === 'sales_return') {
    await warehouseApi.salesReturn.delete(String(record.id));
  } else if (record.receipt_type === 'other_inbound') {
    await warehouseApi.otherInbound.delete(String(record.id));
  } else if (record.receipt_type === 'material_return') {
    await warehouseApi.materialReturn.delete(String(record.id));
  } else {
    throw new Error('unsupported_inbound_delete_type');
  }
}

function renderInboundRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return nodes;
}

const InboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const inboundDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const searchFormRef = useRef<ProFormInstance>();
  const quickPullRef = useRef<InboundQuickPullModalsRef>(null);
  const receiptTypeFilterRef = useRef<string>('all');
  const [receiptTypeFilter, setReceiptTypeFilter] = useState<string>('all');
  const handleCreate = useCallback(() => {
    quickPullRef.current?.open('work_order');
  }, []);
  useNewShortcut(handleCreate);

  const handleReceiptTypeFilterChange = useCallback((value: string) => {
    const next = value || 'all';
    // 同步写入 ref，避免 setState 后立刻 reload 仍读到旧筛选值
    receiptTypeFilterRef.current = next;
    setReceiptTypeFilter(next);
    searchFormRef.current?.setFieldsValue({
      receipt_type: next === 'all' ? undefined : next,
    });
    actionRef.current?.reload();
  }, []);

  const receiptTypeSelect = useMemo(
    () => (
      <Select
        value={receiptTypeFilter}
        options={inboundReceiptTypeSegmentOptions(t)}
        onChange={(v) => handleReceiptTypeFilterChange(String(v))}
        popupMatchSelectWidth={false}
        style={{ width: 160 }}
      />
    ),
    [t, receiptTypeFilter, handleReceiptTypeFilterChange],
  );
  const pullLoadLabel = useMemo(
    () => withSingleNewShortcutHint(t('components.uniPull.loadFromDocument')),
    [t],
  );
  const inboundPerms = useResourcePermissions('kuaizhizao:inbound');
  const currentUser = useCurrentUser();
  const packingBindingPerms = useResourcePermissions('kuaizhizao:production-execution-packing-binding');
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const handledDirectConfirmKeyRef = useRef<string | null>(null);

  const {
    customFields: purchaseReceiptListCustomFields,
    generateCustomFieldColumns: generatePurchaseReceiptCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichPurchaseReceiptRecordsWithCustomFields,
    customFieldValues: purchaseReceiptDetailCustomFieldValues,
    loadFieldValuesForDetail: loadPurchaseReceiptFieldValuesForDetail,
    resetDetailFieldValues: resetPurchaseReceiptDetailFieldValues,
  } = useCustomFieldsForList<InboundOrder>({ tableName: PURCHASE_RECEIPT_CUSTOM_FIELD_TABLE });

  const {
    customFields: productionReturnListCustomFields,
    generateCustomFieldColumns: generateProductionReturnCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichProductionReturnRecordsWithCustomFields,
    customFieldValues: productionReturnDetailCustomFieldValues,
    loadFieldValuesForDetail: loadProductionReturnFieldValuesForDetail,
    resetDetailFieldValues: resetProductionReturnDetailFieldValues,
  } = useCustomFieldsForList<InboundOrder>({ tableName: PRODUCTION_RETURN_CUSTOM_FIELD_TABLE });

  const {
    customFields: finishedGoodsReceiptListCustomFields,
    generateCustomFieldColumns: generateFinishedGoodsReceiptCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichFinishedGoodsReceiptRecordsWithCustomFields,
    customFieldValues: finishedGoodsReceiptDetailCustomFieldValues,
    loadFieldValuesForDetail: loadFinishedGoodsReceiptFieldValuesForDetail,
    resetDetailFieldValues: resetFinishedGoodsReceiptDetailFieldValues,
  } = useCustomFieldsForList<InboundOrder>({ tableName: FINISHED_GOODS_RECEIPT_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (purchaseReceiptListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [purchaseReceiptListCustomFields.length]);

  useEffect(() => {
    if (productionReturnListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [productionReturnListCustomFields.length]);

  useEffect(() => {
    if (finishedGoodsReceiptListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [finishedGoodsReceiptListCustomFields.length]);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<InboundOrder | null>(null);
  const [inboundTrackingRefreshKey, setInboundTrackingRefreshKey] = useState(0);
  const [editableReceiptQuantities, setEditableReceiptQuantities] = useState<Record<number, number>>({});
  const [savingPurchaseReceipt, setSavingPurchaseReceipt] = useState(false);
  const [purchaseReceiptAttachments, setPurchaseReceiptAttachments] = useState<any[]>([]);

  const [purchaseConfirmPreviewOpen, setPurchaseConfirmPreviewOpen] = useState(false);
  const [purchaseConfirmPreviewLoading, setPurchaseConfirmPreviewLoading] = useState(false);
  const [purchaseConfirmPreviewSubmitting, setPurchaseConfirmPreviewSubmitting] = useState(false);
  const [purchaseConfirmPreviewDetail, setPurchaseConfirmPreviewDetail] = useState<InboundOrder | null>(null);
  const [simpleConfirmPreviewOpen, setSimpleConfirmPreviewOpen] = useState(false);
  const [simpleConfirmPreviewLoading, setSimpleConfirmPreviewLoading] = useState(false);
  const [simpleConfirmPreviewSubmitting, setSimpleConfirmPreviewSubmitting] = useState(false);
  const [simpleConfirmPreviewTarget, setSimpleConfirmPreviewTarget] = useState<InboundOrder | null>(null);
  const [simpleConfirmPreviewDetail, setSimpleConfirmPreviewDetail] = useState<Record<string, unknown> | null>(null);
  const [purchaseConfirmLineWh, setPurchaseConfirmLineWh] = useState<Record<number, number>>({});
  const [purchaseConfirmLineLoc, setPurchaseConfirmLineLoc] = useState<Record<number, number | undefined>>({});
  const [purchaseConfirmLineLocCode, setPurchaseConfirmLineLocCode] = useState<Record<number, string>>({});
  const [locOptionsByWarehouse, setLocOptionsByWarehouse] = useState<
    Record<number, { value: number; label: string; code: string }[]>
  >({});
  const [purchaseConfirmPreviewQty, setPurchaseConfirmPreviewQty] = useState<Record<number, number>>({});
  const [purchaseConfirmPreviewBatch, setPurchaseConfirmPreviewBatch] = useState<Record<number, string>>({});
  const [purchaseConfirmPreviewSerial, setPurchaseConfirmPreviewSerial] = useState<Record<number, string[]>>({});
  const [purchaseConfirmMaterialMeta, setPurchaseConfirmMaterialMeta] = useState<Record<number, ConfirmPreviewMaterialMeta>>({});
  const [purchaseConfirmGeneratingSerialId, setPurchaseConfirmGeneratingSerialId] = useState<number | null>(null);
  const [purchaseConfirmWarehouseOptions, setPurchaseConfirmWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);

  const [iqcReviewOpen, setIqcReviewOpen] = useState(false);
  const [iqcReviewLoading, setIqcReviewLoading] = useState(false);
  const [iqcReviewEnsure, setIqcReviewEnsure] = useState<EnsureIqcForPurchaseReceiptResult | null>(null);
  const [iqcReviewPurchaseReceiptId, setIqcReviewPurchaseReceiptId] = useState<number | string | undefined>();
  const [cmIqcReviewOpen, setCmIqcReviewOpen] = useState(false);
  const [cmIqcReviewLoading, setCmIqcReviewLoading] = useState(false);
  const [cmIqcReviewEnsure, setCmIqcReviewEnsure] = useState<EnsureIqcForCustomerMaterialRegistrationResult | null>(null);
  const [cmIqcReviewRegistrationId, setCmIqcReviewRegistrationId] = useState<number | string | undefined>();
  const [fqcReviewOpen, setFqcReviewOpen] = useState(false);
  const [fqcReviewLoading, setFqcReviewLoading] = useState(false);
  const [fqcReviewEnsure, setFqcReviewEnsure] = useState<EnsureFqcForFinishedGoodsReceiptResult | null>(null);
  const [fqcReviewFinishedGoodsReceiptId, setFqcReviewFinishedGoodsReceiptId] = useState<number | string | undefined>();
  const pendingConfirmRecordRef = useRef<InboundOrder | null>(null);
  const pendingConfirmHandoffRef = useRef<PurchaseReceiptEntryHandoff | undefined>(undefined);

  const productionReturnConfirmFormRef = useRef<ProFormInstance>();
  const {
    customFields: productionReturnFormCustomFields,
    customFieldValues: productionReturnFormCustomFieldValues,
    extractFormValues: extractProductionReturnFormValues,
    saveCustomFieldValues: saveProductionReturnCustomFieldValues,
    loadFieldValues: loadProductionReturnFormFieldValues,
    resetFieldValues: resetProductionReturnFormFieldValues,
  } = useCustomFields({
    tableName: PRODUCTION_RETURN_CUSTOM_FIELD_TABLE,
    loadWhenOpen: true,
    open:
      purchaseConfirmPreviewOpen &&
      purchaseConfirmPreviewDetail?.receipt_type === 'production_return',
  });

  const inboundDocTrackingType = currentOrder
    ? inboundDocumentTrackingType(currentOrder)
    : undefined;
  const inboundTracking = useDocumentTracking(inboundDocTrackingType, currentOrder?.id, inboundTrackingRefreshKey);

  const handleDetail = async (record: InboundOrder) => {
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setCurrentOrder(null);
    try {
      let detailData: any;
      if (record.receipt_type === 'purchase') {
        detailData = await warehouseApi.purchaseReceipt.get(record.id!.toString());
      } else if (record.receipt_type === 'finished_goods') {
        detailData = await warehouseApi.finishedGoodsReceipt.get(record.id!.toString());
      } else if (record.receipt_type === 'semi_finished_goods') {
        detailData = await warehouseApi.semiFinishedGoodsReceipt.get(record.id!.toString());
      } else if (record.receipt_type === 'production_return') {
        detailData = await warehouseApi.productionReturn.get(record.id!.toString());
      } else if (record.receipt_type === 'customer_material') {
        detailData = await customerMaterialRegistrationApi.get(record.id!.toString());
      } else if (record.receipt_type === 'sales_return') {
        detailData = await warehouseApi.salesReturn.get(record.id!.toString());
      } else if (record.receipt_type === 'other_inbound') {
        detailData = await warehouseApi.otherInbound.get(record.id!.toString());
      } else if (record.receipt_type === 'material_return') {
        detailData = await warehouseApi.materialReturn.get(record.id!.toString());
      } else if (record.receipt_type === 'outsource_receipt') {
        detailData = await outsourceMaterialReceiptApi.get(record.id!.toString());
      } else if (record.receipt_type === 'outsource_material_return') {
        detailData = await outsourceMaterialReturnApi.get(record.id!.toString());
      } else if (record.receipt_type === 'outsource_product_return') {
        detailData = await outsourceProductReturnApi.get(record.id!.toString());
      }
      if (detailData) {
        await prefetchMaterialsForUnitSelect((detailData.items || []).map((it: any) => it?.material_id));
        if (record.receipt_type === 'purchase') {
          const quantities: Record<number, number> = {};
          (detailData.items || []).forEach((it: any) => {
            if (it?.id != null) quantities[it.id] = Number(it.receipt_quantity ?? 0);
          });
          setEditableReceiptQuantities(quantities);
          setPurchaseReceiptAttachments(mapAttachmentsToUploadList(detailData.attachments));
        } else {
          setEditableReceiptQuantities({});
          setPurchaseReceiptAttachments([]);
        }
        setCurrentOrder(
          normalizeInboundHubDetail(record.receipt_type!, detailData as Record<string, unknown>, record),
        );
        setInboundTrackingRefreshKey((k) => k + 1);
        if (record.receipt_type === 'purchase' && record.id != null) {
          await loadPurchaseReceiptFieldValuesForDetail(record.id);
        } else if (record.receipt_type === 'production_return' && record.id != null) {
          await loadProductionReturnFieldValuesForDetail(record.id);
        } else if (record.receipt_type === 'finished_goods' && record.id != null) {
          await loadFinishedGoodsReceiptFieldValuesForDetail(record.id);
        }
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ??
        error?.response?.data?.message ??
        error?.message ??
        t('app.kuaizhizao.warehouseInbound.msg.loadDetailFailed');
      messageApi.error(typeof msg === 'string' ? msg : t('app.kuaizhizao.warehouseInbound.msg.loadDetailFailed'));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const isEditablePurchaseReceipt = (order?: InboundOrder | null) =>
    order?.receipt_type === 'purchase' && ['草稿', 'draft', 'DRAFT', '待入库'].includes(String(order?.status || ''));

  const handleSavePurchaseReceiptQuantities = async () => {
    if (!currentOrder?.id || currentOrder?.receipt_type !== 'purchase') return;
    const items = (currentOrder.items || []) as InboundOrderItem[];
    if (!items.length) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.msg.noEditableLines'));
      return;
    }
    const mappedItems = items
      .filter((it) => it.material_id != null)
      .map((it) => {
        const rowId = Number(it.id);
        const qty = Number(editableReceiptQuantities[rowId] ?? it.receipt_quantity ?? 0);
        if (!(qty > 0)) {
          throw new Error(
            t('app.kuaizhizao.warehouseInbound.msg.actualQtyMustBePositive', {
              material: it.material_code || it.material_name || '-',
            }),
          );
        }
        const unitPrice = Number(it.unit_price ?? 0);
        const qualified = Number(it.qualified_quantity ?? it.receipt_quantity ?? qty);
        const unqualified = Number(it.unqualified_quantity ?? 0);
        return {
          purchase_order_item_id: Number(it.purchase_order_item_id ?? 0),
          material_id: Number(it.material_id),
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec || undefined,
          material_unit: it.material_unit || it.unit || '个',
          receipt_quantity: qty,
          unit_price: unitPrice,
          total_amount: Number((qty * unitPrice).toFixed(2)),
          qualified_quantity: Number((qualified + unqualified > qty ? qty : qualified).toFixed(2)),
          unqualified_quantity: Number((qualified + unqualified > qty ? 0 : unqualified).toFixed(2)),
          batch_number: it.batch_number || undefined,
          location_code: it.location_code || undefined,
          serial_numbers: it.serial_numbers?.length ? it.serial_numbers : undefined,
          status: it.status || currentOrder.status || '草稿',
          notes: it.notes || undefined,
        };
      });

    setSavingPurchaseReceipt(true);
    try {
      await warehouseApi.purchaseReceipt.update(String(currentOrder.id), {
        purchase_order_id: Number(currentOrder.purchase_order_id || 0),
        purchase_order_code: currentOrder.purchase_order_code || '',
        supplier_id: Number(currentOrder.supplier_id || 0),
        supplier_name: currentOrder.supplier_name || '',
        warehouse_id: Number(currentOrder.warehouse_id || 0),
        warehouse_name: currentOrder.warehouse_name || '',
        status: currentOrder.status || '草稿',
        review_status: currentOrder.review_status || '待审核',
        notes: currentOrder.notes || undefined,
        attachments: normalizeDocumentAttachments(purchaseReceiptAttachments),
        items: mappedItems,
      });
      const detail = await warehouseApi.purchaseReceipt.get(String(currentOrder.id));
      setCurrentOrder(
        normalizeInboundHubDetail('purchase', detail as Record<string, unknown>, currentOrder),
      );
      const quantities: Record<number, number> = {};
      ((detail as any).items || []).forEach((it: any) => {
        if (it?.id != null) quantities[it.id] = Number(it.receipt_quantity ?? 0);
      });
      setEditableReceiptQuantities(quantities);
      messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.actualQtySaved'));
      invalidateMenuBadgeCounts();
      setInboundTrackingRefreshKey((k) => k + 1);

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || error?.response?.data?.detail || t('app.kuaizhizao.warehouseInbound.msg.saveFailed'));
    } finally {
      setSavingPurchaseReceipt(false);
    }
  };

  const resetPurchaseConfirmPreview = () => {
    setPurchaseConfirmPreviewOpen(false);
    setPurchaseConfirmPreviewDetail(null);
    setPurchaseConfirmPreviewQty({});
    setPurchaseConfirmPreviewBatch({});
    setPurchaseConfirmPreviewSerial({});
    setPurchaseConfirmMaterialMeta({});
    setPurchaseConfirmGeneratingSerialId(null);
    setPurchaseConfirmLineWh({});
    setPurchaseConfirmLineLoc({});
    setPurchaseConfirmLineLocCode({});
    setLocOptionsByWarehouse({});
    productionReturnConfirmFormRef.current?.resetFields();
    resetProductionReturnFormFieldValues();
  };

  /** 打开采购入库确认预览（加载最新详情，合并抽屉内未保存的实际数量） */
  const handleConfirmPreviewGenerateSerial = async (rowId: number, qty: number): Promise<string[] | void> => {
    const meta = purchaseConfirmMaterialMeta[rowId];
    if (!meta?.serialManaged || !meta.materialUuid) return;
    const count = Math.max(1, Math.floor(Number(qty) || 1));
    if (count > 100) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.msg.serialMax100'));
      return;
    }
    setPurchaseConfirmGeneratingSerialId(rowId);
    try {
      const res = await materialSerialApi.generate(meta.materialUuid, count, {
        ruleId: meta.defaultSerialRuleId ?? undefined,
      });
      setPurchaseConfirmPreviewSerial((prev) => ({ ...prev, [rowId]: res.serial_nos }));
      messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.serialGenerated', { count: res.count }));
      return res.serial_nos;
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.warehouseInbound.msg.serialGenerateFailed'));
    } finally {
      setPurchaseConfirmGeneratingSerialId(null);
    }
  };

  const proceedOpenConfirmPreview = async (
    record: InboundOrder,
    purchaseReceiptHandoff?: PurchaseReceiptEntryHandoff,
  ) => {
    if (!record.id) return;

    setPurchaseConfirmPreviewOpen(true);
    setPurchaseConfirmPreviewLoading(true);
    try {
      const fetchDetail = async () => {
        const idStr = String(record.id);
        if (record.receipt_type === 'finished_goods') return warehouseApi.finishedGoodsReceipt.get(idStr);
        if (record.receipt_type === 'semi_finished_goods')
          return warehouseApi.semiFinishedGoodsReceipt.get(idStr);
        if (record.receipt_type === 'production_return') return warehouseApi.productionReturn.get(idStr);
        return warehouseApi.purchaseReceipt.get(idStr);
      };

      const [whRes, detailData] = await Promise.all([
        masterWarehouseApi.list({ is_active: true, limit: 500 }),
        fetchDetail(),
      ]);
      const whList = Array.isArray(whRes) ? whRes : (whRes as any)?.data ?? (whRes as any)?.items ?? whRes ?? [];
      const materialById = await prefetchMaterialsForUnitSelect((detailData.items || []).map((it: any) => it?.material_id));
      setPurchaseConfirmWarehouseOptions(
        (Array.isArray(whList) ? whList : []).map((w: any) => ({
          label: `${w.code || ''} ${w.name || ''}`.trim() || String(w.id),
          value: w.id,
          name: w.name || '',
        }))
      );
      const qty: Record<number, number> = {};
      const batch: Record<number, string> = {};
      const serial: Record<number, string[]> = {};
      const lineWh: Record<number, number> = {};
      const lineLoc: Record<number, number | undefined> = {};
      const lineLocLb: Record<number, string> = {};
      const headerWh =
        detailData.warehouse_id != null && Number(detailData.warehouse_id) > 0
          ? Number(detailData.warehouse_id)
          : undefined;
      (detailData.items || []).forEach((it: any) => {
        if (it?.id == null) return;
        const id = Number(it.id);
        const fromDrawer =
          currentOrder?.id === record.id && currentOrder?.receipt_type === 'purchase'
            ? editableReceiptQuantities[id]
            : undefined;
        qty[id] = fromDrawer != null ? Number(fromDrawer) : Number(it.receipt_quantity ?? it.return_quantity ?? 0);
        batch[id] = String(it.batch_number ?? '');
        const poItemIdForBatch = Number(it.purchase_order_item_id ?? 0);
        if (purchaseReceiptHandoff && poItemIdForBatch > 0) {
          const handoffBatch = purchaseReceiptHandoff.lineBatchByPoItemId[poItemIdForBatch];
          if (handoffBatch) batch[id] = handoffBatch;
        }
        const existingSerial = Array.isArray(it.serial_numbers)
          ? it.serial_numbers.filter((s: unknown) => String(s ?? '').trim())
          : [];
        if (existingSerial.length) serial[id] = existingSerial.map(String);
        if (purchaseReceiptHandoff && poItemIdForBatch > 0) {
          const handoffSerial = purchaseReceiptHandoff.lineSerialByPoItemId[poItemIdForBatch];
          if (handoffSerial?.length) serial[id] = handoffSerial;
        }
        let rowWh =
          it.warehouse_id != null && Number(it.warehouse_id) > 0 ? Number(it.warehouse_id) : undefined;
        
        if (rowWh == null && it.material_id) {
          const material = materialById.get(String(it.material_id));
          const defWhs = material?.defaults?.defaultWarehouses;
          if (defWhs && defWhs.length > 0) {
            const sortedWhs = [...defWhs].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
            if (sortedWhs.length > 0 && sortedWhs[0].warehouseId > 0) {
              rowWh = sortedWhs[0].warehouseId;
            }
          }
        }

        if (rowWh == null) {
          rowWh = headerWh;
        }

        const poItemId = Number(it.purchase_order_item_id ?? 0);
        if (purchaseReceiptHandoff && poItemId > 0) {
          const handoffWh = purchaseReceiptHandoff.lineWhByPoItemId[poItemId];
          if (handoffWh != null && handoffWh > 0) rowWh = handoffWh;
        }

        if (rowWh != null) lineWh[id] = rowWh;
        if (it.location_id != null && Number(it.location_id) > 0) lineLoc[id] = Number(it.location_id);
        if (it.location_code) lineLocLb[id] = String(it.location_code);
        if (purchaseReceiptHandoff && poItemId > 0) {
          const handoffLoc = purchaseReceiptHandoff.lineLocByPoItemId[poItemId];
          if (handoffLoc != null && handoffLoc > 0) lineLoc[id] = handoffLoc;
          const handoffLocCode = purchaseReceiptHandoff.lineLocCodeByPoItemId[poItemId];
          if (handoffLocCode) lineLocLb[id] = handoffLocCode;
        }
      });
      setPurchaseConfirmPreviewDetail({ ...detailData, receipt_type: record.receipt_type });
      setPurchaseConfirmLineWh(lineWh);
      setPurchaseConfirmLineLoc(lineLoc);
      setPurchaseConfirmLineLocCode(lineLocLb);
      setLocOptionsByWarehouse({});
      setPurchaseConfirmPreviewQty(qty);
      const [batchPrefilled, materialMeta] = await Promise.all([
        prefetchPurchasePreviewBatchNumbers(detailData.items, batch),
        loadConfirmPreviewMaterialMeta(detailData.items || [], materialById),
      ]);
      const serialPrefilled = await prefetchPurchasePreviewSerialNumbers(
        detailData.items,
        serial,
        materialMeta,
        qty,
      );
      setPurchaseConfirmPreviewBatch(batchPrefilled);
      setPurchaseConfirmPreviewSerial(serialPrefilled);
      setPurchaseConfirmMaterialMeta(materialMeta);
      const uniqueWh = [...new Set(Object.values(lineWh))];
      await Promise.all(
        uniqueWh.map(async (wid) => {
          const opts = await fetchStorageLocationsForWarehouse(wid);
          setLocOptionsByWarehouse((prev) => ({ ...prev, [wid]: opts }));
        })
      );
      if (record.receipt_type === 'production_return' && record.id != null) {
        const fieldFormValues = await loadProductionReturnFormFieldValues(record.id);
        productionReturnConfirmFormRef.current?.setFieldsValue(fieldFormValues);
      }
    } catch {
      messageApi.error(t('app.kuaizhizao.warehouseInbound.msg.loadConfirmPreviewFailed'));
      resetPurchaseConfirmPreview();
    } finally {
      setPurchaseConfirmPreviewLoading(false);
    }
  };

  const openConfirmPreview = async (
    record: InboundOrder,
    purchaseReceiptHandoff?: PurchaseReceiptEntryHandoff,
  ) => {
    if (!record.id) return;
    if (record.receipt_type === 'purchase') {
      pendingConfirmRecordRef.current = record;
      pendingConfirmHandoffRef.current = purchaseReceiptHandoff;
      setIqcReviewPurchaseReceiptId(record.id);
      setIqcReviewEnsure(null);
      setIqcReviewOpen(true);
      setIqcReviewLoading(true);
      try {
        const ensure = await fetchPurchaseReceiptIqcEnsure(record.id);
        setIqcReviewEnsure(ensure);
      } catch (e: any) {
        setIqcReviewOpen(false);
        pendingConfirmRecordRef.current = null;
        pendingConfirmHandoffRef.current = undefined;
        messageApi.error(
          e?.message || e?.response?.data?.detail || t('app.kuaizhizao.warehouseInbound.iqc.ensureFailed'),
        );
      } finally {
        setIqcReviewLoading(false);
      }
      return;
    }
    if (record.receipt_type === 'finished_goods') {
      pendingConfirmRecordRef.current = record;
      pendingConfirmHandoffRef.current = purchaseReceiptHandoff;
      setFqcReviewFinishedGoodsReceiptId(record.id);
      setFqcReviewEnsure(null);
      setFqcReviewOpen(true);
      setFqcReviewLoading(true);
      try {
        const ensure = await fetchFinishedGoodsReceiptFqcEnsure(record.id);
        setFqcReviewEnsure(ensure);
      } catch (e: any) {
        setFqcReviewOpen(false);
        pendingConfirmRecordRef.current = null;
        pendingConfirmHandoffRef.current = undefined;
        messageApi.error(
          e?.message || e?.response?.data?.detail || t('app.kuaizhizao.warehouseInbound.fqc.ensureFailed'),
        );
      } finally {
        setFqcReviewLoading(false);
      }
      return;
    }
    if (record.receipt_type === 'semi_finished_goods') {
      pendingConfirmRecordRef.current = record;
      pendingConfirmHandoffRef.current = purchaseReceiptHandoff;
      setFqcReviewFinishedGoodsReceiptId(record.id);
      setFqcReviewEnsure(null);
      setFqcReviewOpen(true);
      setFqcReviewLoading(true);
      try {
        const ensure = await fetchSemiFinishedGoodsReceiptFqcEnsure(record.id);
        setFqcReviewEnsure(ensure);
      } catch (e: any) {
        setFqcReviewOpen(false);
        pendingConfirmRecordRef.current = null;
        pendingConfirmHandoffRef.current = undefined;
        messageApi.error(
          e?.message || e?.response?.data?.detail || t('app.kuaizhizao.warehouseInbound.fqc.ensureFailed'),
        );
      } finally {
        setFqcReviewLoading(false);
      }
      return;
    }
    if (
      record.receipt_type === 'outsource_receipt' ||
      record.receipt_type === 'sales_return' ||
      record.receipt_type === 'other_inbound' ||
      record.receipt_type === 'material_return'
    ) {
      await openSimpleConfirmPreview(record);
      return;
    }
    await proceedOpenConfirmPreview(record, purchaseReceiptHandoff);
  };

  const openCustomerMaterialIqcReview = async (record: InboundOrder) => {
    if (!record.id) return;
    pendingConfirmRecordRef.current = record;
    setCmIqcReviewRegistrationId(record.id);
    setCmIqcReviewEnsure(null);
    setCmIqcReviewOpen(true);
    setCmIqcReviewLoading(true);
    try {
      const ensure = await fetchCustomerMaterialIqcEnsure(record.id);
      setCmIqcReviewEnsure(ensure);
    } catch (e: any) {
      setCmIqcReviewOpen(false);
      pendingConfirmRecordRef.current = null;
      messageApi.error(
        e?.message || e?.response?.data?.detail || t('app.kuaizhizao.warehouseInbound.cmIqc.ensureFailed'),
      );
    } finally {
      setCmIqcReviewLoading(false);
    }
  };

  const handleCmIqcReviewContinue = async () => {
    const record = pendingConfirmRecordRef.current;
    setCmIqcReviewOpen(false);
    setCmIqcReviewEnsure(null);
    setCmIqcReviewRegistrationId(undefined);
    pendingConfirmRecordRef.current = null;
    if (!record?.id) return;
    try {
      await customerMaterialRegistrationApi.process(String(record.id));
      messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.customerMaterialConfirmed'));
      invalidateMenuBadgeCounts();
      await actionRef.current?.reload?.();
    } catch (e: any) {
      messageApi.error(
        e?.message || e?.response?.data?.detail || t('app.kuaizhizao.warehouseInbound.msg.confirmFailed'),
      );
    }
  };

  const handleCmIqcReviewCancel = () => {
    setCmIqcReviewOpen(false);
    setCmIqcReviewEnsure(null);
    setCmIqcReviewRegistrationId(undefined);
    pendingConfirmRecordRef.current = null;
  };

  const handleFqcReviewContinue = async () => {
    const record = pendingConfirmRecordRef.current;
    const handoff = pendingConfirmHandoffRef.current;
    setFqcReviewOpen(false);
    setFqcReviewEnsure(null);
    pendingConfirmRecordRef.current = null;
    pendingConfirmHandoffRef.current = undefined;
    if (!record) return;
    await proceedOpenConfirmPreview(record, handoff);
  };

  const handleFqcReviewCancel = () => {
    setFqcReviewOpen(false);
    setFqcReviewEnsure(null);
    pendingConfirmRecordRef.current = null;
    pendingConfirmHandoffRef.current = undefined;
  };

  const handleIqcReviewContinue = async () => {
    const record = pendingConfirmRecordRef.current;
    const handoff = pendingConfirmHandoffRef.current;
    setIqcReviewOpen(false);
    setIqcReviewEnsure(null);
    pendingConfirmRecordRef.current = null;
    pendingConfirmHandoffRef.current = undefined;
    if (!record) return;
    await proceedOpenConfirmPreview(record, handoff);
  };

  const handleIqcReviewCancel = () => {
    setIqcReviewOpen(false);
    setIqcReviewEnsure(null);
    pendingConfirmRecordRef.current = null;
    pendingConfirmHandoffRef.current = undefined;
  };

  useEffect(() => {
    const dc = (location.state as InboundPullEntryNavigationState | null)?.inboundDirectConfirm;
    if (!dc?.id) return;
    const key = `${dc.receipt_type}:${dc.id}`;
    if (handledDirectConfirmKeyRef.current === key) return;
    handledDirectConfirmKeyRef.current = key;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    if (dc.receipt_type === 'outsource_receipt') {
      messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.outsourceReceiptConfirmed'));
      invalidateMenuBadgeCounts();
      void actionRef.current?.reload?.();
      return;
    }
    void openConfirmPreview(
      { id: dc.id, receipt_type: dc.receipt_type } as InboundOrder,
      dc.purchaseReceiptHandoff,
    );
  }, [location.state, location.pathname, location.search, navigate]);

  const submitConfirmPreview = async () => {
    const order = purchaseConfirmPreviewDetail;
    if (!order?.id) return;
    const items = (order.items || []) as InboundOrderItem[];
    if (!items.length) {
      messageApi.warning(t('app.kuaizhizao.warehouseInbound.msg.noInboundLines'));
      return;
    }

    let productionReturnCustomData: Record<string, any> = {};
    if (order.receipt_type === 'production_return') {
      const cfValues = await productionReturnConfirmFormRef.current?.validateFieldsReturnFormatValue?.();
      if (!cfValues) {
        await productionReturnConfirmFormRef.current?.validateFields();
        return;
      }
      productionReturnCustomData = extractProductionReturnFormValues(cfValues).customData;
    }

    let mappedItems: any[];
    try {
      mappedItems = items
        .filter((it) => it.material_id != null)
        .map((it) => {
          const rowId = Number(it.id);
          const qty = Number(purchaseConfirmPreviewQty[rowId] ?? it.receipt_quantity ?? it.return_quantity ?? 0);
          if (!(qty > 0)) {
            throw new Error(t('app.kuaizhizao.warehouseInbound.msg.actualQtyMustBePositive', { material: it.material_code || it.material_name || '-' }));
          }
          const lineWh = purchaseConfirmLineWh[rowId];
          if (lineWh == null || !(lineWh > 0)) {
            throw new Error(t('app.kuaizhizao.warehouseInbound.msg.selectWarehouseForMaterial', { material: it.material_code || it.material_name || '-' }));
          }
          const unitPrice = Number(it.unit_price ?? 0);
          const qualified = Number(it.qualified_quantity ?? it.receipt_quantity ?? qty);
          const unqualified = Number(it.unqualified_quantity ?? 0);
          const batchStr = (purchaseConfirmPreviewBatch[rowId] ?? it.batch_number ?? '').trim();
          const serialList = purchaseConfirmPreviewSerial[rowId];
          const lineMeta = purchaseConfirmMaterialMeta[rowId];
          if (lineMeta?.serialManaged) {
            const expected = Math.floor(qty);
            const actual = serialList?.length ?? 0;
            if (actual !== expected) {
              throw new Error(
                `物料 ${it.material_code || it.material_name || '-'} 需要 ${expected} 个序列号（当前 ${actual} 个）`,
              );
            }
          }
          const whOpt = purchaseConfirmWarehouseOptions.find((o) => o.value === lineWh);
          const locId = purchaseConfirmLineLoc[rowId];
          const locCode = purchaseConfirmLineLocCode[rowId];
          const mapped: any = {
            item_id: rowId,
            material_id: Number(it.material_id),
            material_code: it.material_code || '',
            material_name: it.material_name || '',
            material_spec: it.material_spec || undefined,
            material_unit: it.material_unit || it.unit || '个',
            receipt_quantity: qty,
            unit_price: unitPrice,
            total_amount: Number((qty * unitPrice).toFixed(2)),
            qualified_quantity: Number((qualified + unqualified > qty ? qty : qualified).toFixed(2)),
            unqualified_quantity: Number((qualified + unqualified > qty ? 0 : unqualified).toFixed(2)),
            batch_number: batchStr || undefined,
            serial_numbers: serialList?.length ? serialList : undefined,
            warehouse_id: lineWh,
            warehouse_name: whOpt?.name ?? '',
            location_id: locId != null && locId > 0 ? locId : undefined,
            location_code: locCode || undefined,
            status: it.status || order.status || '草稿',
            notes: it.notes || undefined,
          };
          if (order.receipt_type === 'purchase') {
            mapped.purchase_order_item_id = Number(it.purchase_order_item_id ?? 0);
          }
          return mapped;
        });
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.warehouseInbound.msg.checkLines'));
      return;
    }

    const headerWh = Number(mappedItems[0]?.warehouse_id || order.warehouse_id || 0);
    const headerWhName =
      purchaseConfirmWarehouseOptions.find((o) => o.value === headerWh)?.name ?? order.warehouse_name ?? '';

    setPurchaseConfirmPreviewSubmitting(true);
    try {
      if (order.receipt_type === 'purchase') {
        await warehouseApi.purchaseReceipt.update(String(order.id), {
          purchase_order_id: Number(order.purchase_order_id || 0),
          purchase_order_code: order.purchase_order_code || '',
          supplier_id: Number(order.supplier_id || 0),
          supplier_name: order.supplier_name || '',
          warehouse_id: headerWh > 0 ? headerWh : Number(order.warehouse_id || 0),
          warehouse_name: headerWhName,
          status: order.status || '草稿',
          review_status: order.review_status || '待审核',
          notes: order.notes || undefined,
          attachments: normalizeDocumentAttachments(purchaseReceiptAttachments),
          items: mappedItems,
        });
        // 后端 update 会全量删除并重建明细，明细 id 会变；确认入库须用最新 id，否则 confirm 内按 item_id 更新无法命中
        const refreshed = await warehouseApi.purchaseReceipt.get(String(order.id));
        const refItems = (refreshed as any)?.items || [];
        const orderedSource = items.filter((it) => it.material_id != null);
        if (refItems.length !== orderedSource.length) {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.msg.lineCountMismatch'));
          return;
        }
        if (refItems.some((it: any) => it?.id == null || !(Number(it.id) > 0))) {
          messageApi.error(t('app.kuaizhizao.warehouseInbound.msg.lineIdAbnormal'));
          return;
        }
        const confirmItems = orderedSource.map((src, idx) => {
          const refIt = refItems[idx];
          const rowId = Number(src.id);
          const lineWh = purchaseConfirmLineWh[rowId];
          const whOpt = purchaseConfirmWarehouseOptions.find((o) => o.value === lineWh);
          const batchStr = (purchaseConfirmPreviewBatch[rowId] ?? '').trim();
          const serialList = purchaseConfirmPreviewSerial[rowId];
          const locId = purchaseConfirmLineLoc[rowId];
          const locCode = purchaseConfirmLineLocCode[rowId];
          return {
            item_id: Number(refIt.id),
            warehouse_id: lineWh,
            warehouse_name: whOpt?.name ?? '',
            location_id: locId != null && locId > 0 ? locId : undefined,
            location_code: locCode || undefined,
            batch_number: batchStr || undefined,
            serial_numbers: serialList?.length ? serialList : undefined,
          };
        });
        await warehouseApi.purchaseReceipt.confirm(String(order.id), {
          warehouse_id: headerWh,
          warehouse_name: headerWhName,
          items: confirmItems,
        });
      } else if (order.receipt_type === 'finished_goods') {
        await warehouseApi.finishedGoodsReceipt.confirm(String(order.id), {
           warehouse_id: headerWh,
           warehouse_name: headerWhName,
           items: mappedItems,
        });
      } else if (order.receipt_type === 'semi_finished_goods') {
        await warehouseApi.semiFinishedGoodsReceipt.confirm(String(order.id), {
          warehouse_id: headerWh,
          warehouse_name: headerWhName,
          items: mappedItems,
        });
      } else if (order.receipt_type === 'production_return') {
        await warehouseApi.productionReturn.confirm(String(order.id), {
           warehouse_id: headerWh,
           warehouse_name: headerWhName,
           items: mappedItems,
        });
        if (Object.keys(productionReturnCustomData).length > 0) {
          await saveProductionReturnCustomFieldValues(order.id, productionReturnCustomData);
        }
      }
      messageApi.success(
        order.receipt_type === 'production_return' ? t('app.kuaizhizao.warehouseInbound.msg.returnConfirmSuccess') : t('app.kuaizhizao.warehouseInbound.msg.inboundConfirmSuccess'),
      );
      resetPurchaseConfirmPreview();
      invalidateMenuBadgeCounts();

      await actionRef.current?.reload?.();
      if (currentOrder?.id === order.id && currentOrder?.receipt_type === order.receipt_type) {
        try {
          let detailData: any;
          if (order.receipt_type === 'purchase') detailData = await warehouseApi.purchaseReceipt.get(String(order.id));
          else if (order.receipt_type === 'finished_goods')
            detailData = await warehouseApi.finishedGoodsReceipt.get(String(order.id));
          else if (order.receipt_type === 'semi_finished_goods')
            detailData = await warehouseApi.semiFinishedGoodsReceipt.get(String(order.id));
          else detailData = await warehouseApi.productionReturn.get(String(order.id));

          setCurrentOrder(
            normalizeInboundHubDetail(order.receipt_type!, detailData as Record<string, unknown>, order),
          );
          const quantities: Record<number, number> = {};
          (detailData.items || []).forEach((it: any) => {
            if (it?.id != null) quantities[it.id] = Number(it.receipt_quantity ?? 0);
          });
          setEditableReceiptQuantities(quantities);
          if (order.receipt_type === 'purchase' && order.id != null) {
            await loadPurchaseReceiptFieldValuesForDetail(order.id);
          } else if (order.receipt_type === 'production_return' && order.id != null) {
            await loadProductionReturnFieldValuesForDetail(order.id);
          } else if (order.receipt_type === 'finished_goods' && order.id != null) {
            await loadFinishedGoodsReceiptFieldValuesForDetail(order.id);
          }
        } catch {
          /* ignore */
        }
      }
      setInboundTrackingRefreshKey((k) => k + 1);
    } catch (error: any) {
      messageApi.error(error?.message || error?.response?.data?.detail || t('app.kuaizhizao.warehouseInbound.msg.confirmFailed'));
      throw error;
    } finally {
      setPurchaseConfirmPreviewSubmitting(false);
    }
  };

  /**
   * 处理确认入库/退料
   */
  const resetSimpleConfirmPreview = useCallback(() => {
    setSimpleConfirmPreviewOpen(false);
    setSimpleConfirmPreviewTarget(null);
    setSimpleConfirmPreviewDetail(null);
    setSimpleConfirmPreviewLoading(false);
    setSimpleConfirmPreviewSubmitting(false);
  }, []);

  const openSimpleConfirmPreview = useCallback(
    async (record: InboundOrder) => {
      if (!record.id) return;
      setSimpleConfirmPreviewOpen(true);
      setSimpleConfirmPreviewLoading(true);
      setSimpleConfirmPreviewSubmitting(false);
      setSimpleConfirmPreviewTarget(record);
      setSimpleConfirmPreviewDetail(null);
      try {
        const detail = await fetchInboundHubDetail(record);
        if (!detail) {
          throw new Error(t('app.kuaizhizao.warehouseInbound.msg.loadConfirmPreviewFailed'));
        }
        setSimpleConfirmPreviewDetail(detail);
      } catch (error: unknown) {
        const err = error as { message?: string };
        messageApi.error(err?.message || t('app.kuaizhizao.warehouseInbound.msg.loadConfirmPreviewFailed'));
        resetSimpleConfirmPreview();
      } finally {
        setSimpleConfirmPreviewLoading(false);
      }
    },
    [messageApi, resetSimpleConfirmPreview, t],
  );

  const submitSimpleConfirmPreview = useCallback(async () => {
    const record = simpleConfirmPreviewTarget;
    if (!record?.id || !simpleConfirmPreviewDetail) return;
    setSimpleConfirmPreviewSubmitting(true);
    try {
      const id = String(record.id);
      if (record.receipt_type === 'sales_return') {
        await warehouseApi.salesReturn.confirm(id);
        messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.salesReturnConfirmed'));
      } else if (record.receipt_type === 'other_inbound') {
        await warehouseApi.otherInbound.confirm(id);
        messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.otherInboundConfirmed'));
      } else if (record.receipt_type === 'material_return') {
        await warehouseApi.materialReturn.confirm(id);
        messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.materialReturnConfirmed'));
      } else if (record.receipt_type === 'outsource_receipt') {
        await outsourceMaterialReceiptApi.complete(id);
        messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.outsourceReceiptConfirmed'));
      } else {
        throw new Error(t('app.kuaizhizao.warehouseInbound.msg.unsupportedReceiptType'));
      }
      resetSimpleConfirmPreview();
      invalidateMenuBadgeCounts();
      await actionRef.current?.reload?.();
      if (currentOrder?.id === record.id && currentOrder?.receipt_type === record.receipt_type) {
        setDetailDrawerVisible(false);
        setCurrentOrder(null);
      }
      setInboundTrackingRefreshKey((k) => k + 1);
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { data?: { detail?: string } } };
      messageApi.error(
        err?.response?.data?.detail || err?.message || t('app.kuaizhizao.warehouseInbound.msg.confirmFailed'),
      );
    } finally {
      setSimpleConfirmPreviewSubmitting(false);
    }
  }, [
    currentOrder?.id,
    currentOrder?.receipt_type,
    invalidateMenuBadgeCounts,
    messageApi,
    resetSimpleConfirmPreview,
    simpleConfirmPreviewDetail,
    simpleConfirmPreviewTarget,
    t,
  ]);

  const handleConfirm = async (record: InboundOrder) => {
    if (!isInboundConfirmable(record)) {
      messageApi.warning(
        inboundConfirmCapabilityReasonMessage(record, t) ||
          t('app.kuaizhizao.warehouseInbound.msg.notConfirmable'),
      );
      return;
    }
    const code = record.receipt_code || record.return_code || '';
    if (record.receipt_type === 'customer_material') {
      await openCustomerMaterialIqcReview(record);
      return;
    }
    if (
      record.receipt_type === 'sales_return' ||
      record.receipt_type === 'other_inbound' ||
      record.receipt_type === 'material_return' ||
      record.receipt_type === 'outsource_receipt'
    ) {
      await openSimpleConfirmPreview(record);
      return;
    }
    if (
      record.receipt_type === 'outsource_material_return' ||
      record.receipt_type === 'outsource_product_return'
    ) {
      messageApi.warning(
        inboundConfirmCapabilityReasonMessage(record, t) ||
          t('app.kuaizhizao.warehouseInbound.msg.useConfirmPreviewForOutsource'),
      );
      return;
    }
    await openConfirmPreview(record);
  };

  /**
   * 撤回已入库/已退料：后端按明细冲减即时库存
   */
  const handleWithdrawInbound = async (record: InboundOrder) => {
    const code = record.receipt_code || record.return_code || '';
    const isReturn = record.receipt_type === 'production_return';
    Modal.confirm({
      title: isReturn ? t('app.kuaizhizao.warehouseInbound.confirm.withdrawReturn.title') : t('app.kuaizhizao.warehouseInbound.confirm.withdrawInbound.title'),
      content: t('app.kuaizhizao.warehouseInbound.confirm.withdraw.content', { code }),
      okText: t('app.kuaizhizao.warehouseInbound.action.withdraw'),
      okType: 'danger',
      onOk: async () => {
        try {
          if (record.receipt_type === 'finished_goods') {
            await warehouseApi.finishedGoodsReceipt.withdraw(String(record.id));
          } else if (record.receipt_type === 'semi_finished_goods') {
            await warehouseApi.semiFinishedGoodsReceipt.withdraw(String(record.id));
          } else if (record.receipt_type === 'purchase') {
            await warehouseApi.purchaseReceipt.withdraw(String(record.id));
          } else if (record.receipt_type === 'customer_material') {
            await customerMaterialRegistrationApi.withdraw(String(record.id));
          } else {
            await warehouseApi.productionReturn.withdraw(String(record.id));
          }
          messageApi.success(isReturn ? t('app.kuaizhizao.warehouseInbound.msg.withdrawReturnSuccess') : t('app.kuaizhizao.warehouseInbound.msg.withdrawInboundSuccess'));
          invalidateMenuBadgeCounts();

          await actionRef.current?.reload?.();
          if (currentOrder?.id === record.id && currentOrder?.receipt_type === record.receipt_type) {
            try {
              let detailData: any;
              if (record.receipt_type === 'finished_goods') {
                detailData = await warehouseApi.finishedGoodsReceipt.get(String(record.id));
              } else if (record.receipt_type === 'semi_finished_goods') {
                detailData = await warehouseApi.semiFinishedGoodsReceipt.get(String(record.id));
              } else if (record.receipt_type === 'purchase') {
                detailData = await warehouseApi.purchaseReceipt.get(String(record.id));
              } else {
                detailData = await warehouseApi.productionReturn.get(String(record.id));
              }
              if (detailData) {
                setCurrentOrder(
                  normalizeInboundHubDetail(
                    record.receipt_type!,
                    detailData as Record<string, unknown>,
                    record,
                  ),
                );
                if (record.receipt_type === 'purchase' && record.id != null) {
                  await loadPurchaseReceiptFieldValuesForDetail(record.id);
                } else if (record.receipt_type === 'production_return' && record.id != null) {
                  await loadProductionReturnFieldValuesForDetail(record.id);
                } else if (record.receipt_type === 'finished_goods' && record.id != null) {
                  await loadFinishedGoodsReceiptFieldValuesForDetail(record.id);
                }
              }
            } catch {
              /* ignore */
            }
          }
          setInboundTrackingRefreshKey((k) => k + 1);
        } catch (error: any) {
          messageApi.error(error?.message || error?.response?.data?.detail || t('app.kuaizhizao.warehouseInbound.msg.withdrawFailed'));
        }
      },
    });
  };

  /**
   * 处理删除：采购/成品仅草稿或待入库；生产退料为待退料（与行内按钮一致）
   */
  const listRowsRef = useRef<Map<string, InboundOrder>>(new Map());
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const inboundRowKey = (record: InboundOrder) => `${record.receipt_type}::${record.id}`;

  const isInboundPrintable = useCallback(
    (record: InboundOrder) =>
      !!record.id &&
      !!inboundReceiptTypeToPrintDocumentType(record.receipt_type) &&
      inboundPerms.canPrint &&
      record.capabilities?.print?.allowed !== false,
    [inboundPerms.canPrint],
  );

  const selectedInboundForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => listRowsRef.current.get(String(key)))
        .filter((row): row is InboundOrder => row != null),
    [selectedRowKeys],
  );

  const canToolbarPrint =
    selectedRowKeys.length === 1 &&
    !!selectedInboundForBatch[0] &&
    isInboundPrintable(selectedInboundForBatch[0]);

  const handlePrint = (record: InboundOrder) => {
    if (!record.id) return;
    const printDocType = inboundReceiptTypeToPrintDocumentType(record.receipt_type);
    if (!printDocType) return;
    openPrint({ documentType: printDocType, documentId: record.id });
  };

  const handleDelete = async (record: InboundOrder) => {
    const code = String(record.receipt_code || record.return_code || '');
    const typeLabel =
      (record.receipt_type
        ? inboundReceiptTypeLabel(t, record.receipt_type as InboundReceiptType)
        : t('app.kuaizhizao.warehouseInbound.fallbackDoc'));
    Modal.confirm({
      title: t('app.kuaizhizao.warehouseInbound.confirm.delete.title', { type: typeLabel }),
      content: t('app.kuaizhizao.warehouseInbound.confirm.delete.content', { code: code || '-' }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteInboundDocument(record);
          messageApi.success(t('app.kuaizhizao.warehouseInbound.msg.deleteSuccess'));
          invalidateMenuBadgeCounts();

          await actionRef.current?.reload?.();
        } catch (error: any) {
          const msg =
            error?.response?.data?.detail ??
            error?.response?.data?.message ??
            error?.message ??
            t('app.kuaizhizao.warehouseInbound.msg.deleteFailed');
          messageApi.error(typeof msg === 'string' ? msg : t('app.kuaizhizao.warehouseInbound.msg.deleteFailed'));
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    const rows = keys
      .map((k) => listRowsRef.current.get(String(k)))
      .filter((r): r is InboundOrder => !!r && isInboundDeletable(r));
    if (rows.length === 0) {
      messageApi.warning(t('app.kuaizhizao.warehouseCommon.batchDeleteNoneDeletable'));
      return;
    }
    try {
      for (const row of rows) {
        await deleteInboundDocument(row);
      }
      messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: rows.length }));
      invalidateMenuBadgeCounts();
      await actionRef.current?.reload?.();
    } catch (error: any) {
      const msg =
        error?.response?.data?.detail ??
        error?.response?.data?.message ??
        error?.message ??
        t('app.kuaizhizao.warehouseCommon.batchDeleteFailed');
      messageApi.error(typeof msg === 'string' ? msg : t('app.kuaizhizao.warehouseCommon.batchDeleteFailed'));
    }
  };

  /**
   * 表格列定义
   */
  const getInboundStackedPrimary = (record: InboundOrder): string => {
    if (record.receipt_type === 'customer_material' && (record as any).customer_name) {
      return String((record as any).customer_name);
    }
    if (record.receipt_type === 'purchase' && record.supplier_name) {
      return String(record.supplier_name);
    }
    if (record.work_order_code) return String(record.work_order_code);
    if (record.picking_code) return String(record.picking_code);
    if (record.warehouse_name) return String(record.warehouse_name);
    return t('app.kuaizhizao.warehouseInbound.fallbackDoc');
  };

  const purchaseReceiptCustomFieldColumns = generatePurchaseReceiptCustomFieldColumns();
  const productionReturnCustomFieldColumns = generateProductionReturnCustomFieldColumns();
  const finishedGoodsReceiptCustomFieldColumns = generateFinishedGoodsReceiptCustomFieldColumns();
  const columns: ProColumns<InboundOrder>[] = useMemo(
  () => alignProColumns<InboundOrder>([
    {
      title: t('app.kuaizhizao.warehouseInbound.col.subjectDocNo'),
      key: 'receipt_code',
      dataIndex: ['receipt_code', 'return_code'],
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={getInboundStackedPrimary(record)}
          secondary={String(record.receipt_code || record.return_code || '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.docNo'),
      dataIndex: ['receipt_code', 'return_code'],
      hideInTable: true,
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.receiptType'),
      dataIndex: 'receipt_type',
      width: 100,
      hideInSearch: true,
      valueEnum: inboundReceiptTypeMarkerValueEnum(t),
      render: (_, record) => renderInboundReceiptTypeMarkerTag(t, record.receipt_type),
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.status'),
      dataIndex: 'status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: buildInboundHubStatusValueEnum(t),
      initialValue: 'pending',
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.sourceDocNo'),
      key: 'sourceDocNo',
      dataIndex: 'source_doc_no',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => inboundSourceDocNo(record) || '-',
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.supplier'),
      dataIndex: 'supplier_name',
      hideInTable: true,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      render: formatQuantity,
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.totalItems'),
      dataIndex: 'total_items',
      width: 100,
      align: 'right',
      sorter: true,
      render: (v: number | null | undefined) => (v != null ? v : '-'),
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.receiptProgress'),
      dataIndex: 'receipt_progress',
      width: DOCUMENT_PROGRESS_COLUMN_WIDTH,
      uniTableKeepWidth: true,
      hideInSearch: true,
      render: (_, record) => {
        let required = Number(record.total_quantity ?? 0);
        const posted = isInboundStockPosted(record);
        let done = posted ? required : 0;
        if (!(required > 0) && posted) {
          required = 1;
          done = 1;
        }
        if (!(required > 0) && !(done > 0)) return '-';
        const percent = ratioToPushProgressPercent(done, required);
        return (
          <DocumentPushProgressBar
            percent={percent}
            tooltip={t('app.kuaizhizao.warehouseInbound.col.receiptProgressTip', {
              done: formatQuantity(done),
              required: formatQuantity(required),
              percent,
            })}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.warehouse'),
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.warehouseInbound.col.time'),
      key: 'biz_time_operator',
      dataIndex: 'biz_time_operator',
      width: 148,
      uniTableKeepWidth: true,
      hideInSearch: true,
      sorter: true,
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={formatInboundDateTimeDisplay(record)}
          secondary={resolveInboundHubOperator(record) || '-'}
          secondaryCopyable={false}
          primaryBold={false}
        />
      ),
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    {
      title: t('app.kuaizhizao.warehouseInbound.col.lifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getInboundLifecycle(record as Record<string, unknown>);
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
    ...purchaseReceiptCustomFieldColumns,
    ...productionReturnCustomFieldColumns,
    ...finishedGoodsReceiptCustomFieldColumns,
    {
      title: t('app.kuaizhizao.warehouseInbound.col.actions'),
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const posted = isInboundStockPosted(record);
        const confirmable = isInboundConfirmable(record);
        const confirmReason = inboundConfirmCapabilityReasonMessage(record, t);
        const canConfirm = confirmable && (inboundPerms.canAction?.('approve') ?? false);
        const nodes: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="detail" onClick={() => handleDetail(record)} />,
        ];
        if (record.receipt_type === 'finished_goods' && record.id && packingBindingPerms.canRead) {
          nodes.push(
            <Button
              {...rowActionKind('execute')}
              {...rowActionLabelKeep()}
              key="packing-binding"
              onClick={() =>
                navigate(
                  `/apps/kuaizhizao/production-execution/packing-binding?action=bind&source_type=finished_goods_receipt&source_id=${record.id}`,
                )
              }
            >
              {t('app.kuaizhizao.packingBinding.title')}
            </Button>
          );
        }
        if (canConfirm) {
          nodes.push(
            <Button
              {...rowActionKind('execute')}
              {...rowActionLabelKeep()}
              key="confirm"
              onClick={() => void handleConfirm(record)}
            >
              {record.receipt_type === 'production_return' ? t('app.kuaizhizao.warehouseInbound.action.confirmReturn') : t('app.kuaizhizao.warehouseInbound.action.confirmInbound')}
            </Button>
          );
          if (
            inboundPerms.canDelete &&
            isInboundDeletable(record)
          ) {
            nodes.push(
              <Button {...rowActionKind('delete')} key="delete" onClick={() => handleDelete(record)} />
            );
          }
        } else if (!posted && confirmReason) {
          nodes.push(
            <Button
              {...rowActionKind('execute')}
              {...rowActionLabelKeep()}
              key="confirm-disabled"
              disabled
              title={confirmReason}
            >
              {record.receipt_type === 'production_return' ? t('app.kuaizhizao.warehouseInbound.action.confirmReturn') : t('app.kuaizhizao.warehouseInbound.action.confirmInbound')}
            </Button>
          );
        }
        if (posted && (inboundPerms.canAction?.('revoke') ?? false)) {
          nodes.push(
            <Button
              {...rowActionKind('revoke')}
              {...rowActionLabelKeep()}
              key="withdraw"
              onClick={() => handleWithdrawInbound(record)}
            >
              {record.receipt_type === 'production_return' ? t('app.kuaizhizao.warehouseInbound.action.withdrawReturn') : t('app.kuaizhizao.warehouseInbound.action.withdrawInbound')}
            </Button>
          );
        }
        return nodes;
      },
    },
  ], WAREHOUSE_DOC_LIST_FIELD_RANK),
  [
    t,
    navigate,
    purchaseReceiptCustomFieldColumns,
    productionReturnCustomFieldColumns,
    finishedGoodsReceiptCustomFieldColumns,
    inboundPerms,
    packingBindingPerms.canRead,
  ],
  );

  const inboundDetailCollaboration = useMemo(() => {
    if (!currentOrder) return undefined;
    const lifecycle = getInboundLifecycle(currentOrder);
    const mainStages = lifecycle.mainStages ?? [];
    if (mainStages.length === 0) return undefined;
    return (
      <UniLifecycleStepper
        steps={mainStages}
        status={lifecycle.status}
        showLabels
        nextStepSuggestions={lifecycle.nextStepSuggestions}
        hideNextStepSuggestions
      />
    );
  }, [currentOrder]);

  const inboundTraceDocument = useMemo(() => {
    if (!currentOrder || !inboundDocTrackingType || currentOrder.id == null) return undefined;
    return {
      documentType: inboundDocTrackingType,
      documentId: currentOrder.id,
      selfDocumentId: currentOrder.id,
      renderBriefActions: (doc: Parameters<typeof WarehouseTraceBriefPrimaryActions>[0]['doc']) => (
        <WarehouseTraceBriefPrimaryActions
          doc={doc}
          t={t}
          navigate={navigate}
          closeDrawer={() => {
            setDetailDrawerVisible(false);
            setCurrentOrder(null);
            setEditableReceiptQuantities({});
          }}
        />
      ),
    };
  }, [currentOrder, inboundDocTrackingType, navigate, t]);

  const inboundDetailSupplementary = useMemo(() => {
    if (!currentOrder) return undefined;
    const nodes: React.ReactNode[] = [];
    if (
      currentOrder.receipt_type === 'purchase' &&
      hasCustomFieldsDetailContent(purchaseReceiptListCustomFields, purchaseReceiptDetailCustomFieldValues)
    ) {
      nodes.push(
        <CustomFieldsDetailSection
          key="purchase-custom-fields"
          customFields={purchaseReceiptListCustomFields}
          customFieldValues={purchaseReceiptDetailCustomFieldValues}
        />,
      );
    }
    if (
      currentOrder.receipt_type === 'production_return' &&
      hasCustomFieldsDetailContent(productionReturnListCustomFields, productionReturnDetailCustomFieldValues)
    ) {
      nodes.push(
        <CustomFieldsDetailSection
          key="production-return-custom-fields"
          customFields={productionReturnListCustomFields}
          customFieldValues={productionReturnDetailCustomFieldValues}
        />,
      );
    }
    if (
      currentOrder.receipt_type === 'finished_goods' &&
      hasCustomFieldsDetailContent(finishedGoodsReceiptListCustomFields, finishedGoodsReceiptDetailCustomFieldValues)
    ) {
      nodes.push(
        <CustomFieldsDetailSection
          key="finished-goods-custom-fields"
          customFields={finishedGoodsReceiptListCustomFields}
          customFieldValues={finishedGoodsReceiptDetailCustomFieldValues}
        />,
      );
    }
    if (currentOrder.notes) {
      nodes.push(
        <Descriptions
          key="notes"
          column={3}
          size="small"
          style={nodes.length > 0 ? { marginTop: 16 } : undefined}
          items={[
            {
              key: 'notes',
              label: t('app.kuaizhizao.warehouseInbound.field.notes'),
              span: 3,
              children: currentOrder.notes,
            },
          ]}
        />,
      );
    }
    if (currentOrder.receipt_type === 'purchase' && currentOrder.id) {
      nodes.push(
        <div key="iqc" style={{ marginTop: nodes.length > 0 ? 16 : undefined }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('app.kuaizhizao.warehouseInbound.section.iqc')}
          </Typography.Text>
          <LinkedIqcPanel
            purchaseReceiptId={currentOrder.id}
            active={detailDrawerVisible}
            onNavigate={(path) => {
              setDetailDrawerVisible(false);
              navigate(path);
            }}
          />
        </div>,
      );
    }
    if (currentOrder.receipt_type === 'customer_material' && currentOrder.id) {
      nodes.push(
        <div key="iqc-cm" style={{ marginTop: nodes.length > 0 ? 16 : undefined }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('app.kuaizhizao.warehouseInbound.section.iqc')}
          </Typography.Text>
          <LinkedIqcPanel
            customerMaterialRegistrationId={currentOrder.id}
            active={detailDrawerVisible}
            onNavigate={(path) => {
              setDetailDrawerVisible(false);
              navigate(path);
            }}
          />
        </div>,
      );
    }
    if (
      (currentOrder.receipt_type === 'finished_goods' || currentOrder.receipt_type === 'semi_finished_goods') &&
      currentOrder.work_order_id
    ) {
      nodes.push(
        <div key="fqc" style={{ marginTop: nodes.length > 0 ? 16 : undefined }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('app.kuaizhizao.warehouseInbound.section.fqc')}
          </Typography.Text>
          <LinkedFqcPanel
            workOrderId={currentOrder.work_order_id}
            active={detailDrawerVisible}
            onNavigate={(path) => {
              setDetailDrawerVisible(false);
              navigate(path);
            }}
          />
        </div>,
      );
    }
    if (nodes.length === 0) return undefined;
    return <>{nodes}</>;
  }, [
    currentOrder,
    detailDrawerVisible,
    finishedGoodsReceiptDetailCustomFieldValues,
    finishedGoodsReceiptListCustomFields,
    navigate,
    productionReturnDetailCustomFieldValues,
    productionReturnListCustomFields,
    purchaseReceiptDetailCustomFieldValues,
    purchaseReceiptListCustomFields,
    t,
  ]);

  const inboundDetailLinesTitle = useMemo(() => {
    if (!currentOrder) return undefined;
    return currentOrder.receipt_type === 'production_return'
      ? t('app.kuaizhizao.warehouseInbound.section.returnDetails')
      : t('app.kuaizhizao.warehouseInbound.section.detailInfo');
  }, [currentOrder, t]);

  const inboundDetailItems = useMemo(
    () => (currentOrder ? resolveInboundHubDetailItems(currentOrder) : []),
    [currentOrder],
  );

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('app.kuaizhizao.warehouseInbound.title')}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.inbound.v3"
        actionRef={actionRef}
        formRef={searchFormRef}
        rowKey={inboundRowKey}
        columns={columns}
        showAdvancedSearch={true}
        beforeSearchButtons={receiptTypeSelect}
        pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        enableRowSelection={inboundPerms.canDelete || inboundPerms.canPrint}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton={inboundPerms.canDelete}
        rowSelectionGetCheckboxProps={(record) => ({
          disabled: !isInboundDeletable(record) && !isInboundPrintable(record),
        })}
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) =>
          t('app.kuaizhizao.warehouseCommon.batchDeleteConfirm', {
            count,
            noun: t('app.kuaizhizao.warehouseInbound.title'),
          })
        }
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const typeFilter = receiptTypeFilterRef.current;
            const listParams = resolveInboundHubListParams(
              {
                ...(searchFormValues as Record<string, unknown>),
                receipt_type: typeFilter === 'all' ? undefined : typeFilter,
              },
              sort,
            );
            const result = await fetchInboundHubList(
              {
                ...(params as Record<string, unknown>),
                ...listParams,
              },
              {
              enrichPurchaseReceiptRecordsWithCustomFields,
              enrichFinishedGoodsReceiptRecordsWithCustomFields,
              enrichProductionReturnRecordsWithCustomFields,
            },
              currentUser,
            );
            const next = new Map<string, InboundOrder>();
            for (const row of result.data ?? []) {
              next.set(inboundRowKey(row), row);
            }
            listRowsRef.current = next;
            return result;
          } catch {
            messageApi.error(t('app.kuaizhizao.warehouseInbound.msg.loadListFailed'));
            return { data: [], success: false, total: 0 };
          }
        }}
        toolBarRender={() => {
          const pullMenuItems = buildKuaizhizaoPullCreateMenuItems(t, [
            {
              actionKey: 'purchase_receipt.pull_from_purchase_order',
              onClick: () => quickPullRef.current?.open('purchase_order'),
            },
            {
              actionKey: 'purchase_receipt.pull_from_receipt_notice',
              onClick: () => quickPullRef.current?.open('receipt_notice'),
            },
            {
              actionKey: 'inbound.pull_from_work_order',
              onClick: () => quickPullRef.current?.open('work_order'),
            },
            {
              actionKey: 'inbound.pull_from_work_order_for_production_return',
              onClick: () => quickPullRef.current?.open('production_return'),
            },
            {
              actionKey: 'inbound.pull_from_sales_order',
              onClick: () => quickPullRef.current?.open('sales_return'),
            },
            {
              actionKey: 'inbound.pull_from_outsource_work_order',
              onClick: () => quickPullRef.current?.open('outsource'),
            },
          ]);
          return [
            <UniPullLoadButton
              key="inbound-pull-load"
              compactKey="inbound-pull-load"
              label={pullLoadLabel}
              menuItems={pullMenuItems}
              type="primary"
              variant="solid"
            />,
          ];
        }}
        toolBarActionsAfterBatch={
          inboundPerms.canPrint
            ? [
                <Button
                  key="inbound-toolbar-print"
                  icon={<PrinterOutlined />}
                  disabled={!canToolbarPrint}
                  onClick={() => {
                    const row = selectedInboundForBatch[0];
                    if (row) handlePrint(row);
                  }}
                >
                  {t('components.uniAction.print')}
                </Button>,
              ]
            : []
        }
        scroll={{ x: 2000 }}
      />

      <InboundQuickPullModals
        ref={quickPullRef}
        onSuccess={() => {
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
        }}
      />

      <Modal
        title={
          purchaseConfirmPreviewDetail?.receipt_type === 'production_return'
            ? t('app.kuaizhizao.warehouseInbound.confirmPreview.titleReturn')
            : t('app.kuaizhizao.warehouseInbound.confirmPreview.titleInbound')
        }
        open={purchaseConfirmPreviewOpen}
        onCancel={() => {
          if (!purchaseConfirmPreviewSubmitting) resetPurchaseConfirmPreview();
        }}
        onOk={submitConfirmPreview}
        confirmLoading={purchaseConfirmPreviewSubmitting}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        style={{ maxWidth: 'min(1400px, calc(100vw - 48px))' }}
        okText={
          purchaseConfirmPreviewDetail?.receipt_type === 'production_return' ? t('app.kuaizhizao.warehouseInbound.action.confirmReturn') : t('app.kuaizhizao.warehouseInbound.action.confirmInbound')
        }
        destroyOnHidden
      >
        <Spin spinning={purchaseConfirmPreviewLoading}>
          <p style={{ marginBottom: 12, color: '#666' }}>
            {t('app.kuaizhizao.warehouseInbound.confirmPreview.description')}
          </p>
          <Table
            size="small"
            pagination={false}
            scroll={{ x: 1000 }}
            rowKey={(r) => (r.id != null ? String(r.id) : `m-${r.material_id}`)}
            dataSource={(purchaseConfirmPreviewDetail?.items || []) as InboundOrderItem[]}
            columns={[
              { title: t('app.kuaizhizao.warehouseInbound.col.materialCode'), dataIndex: 'material_code', width: 100, ellipsis: true },
              { title: t('app.kuaizhizao.warehouseInbound.col.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
              {
                title: t('app.kuaizhizao.warehouseInbound.col.warehouse'),
                dataIndex: 'warehouse_id',
                width: 150,
                render: (_: unknown, row: InboundOrderItem) => {
                  if (row.id == null) return '-';
                  const rid = Number(row.id);
                  const v = purchaseConfirmLineWh[rid];
                  return (
                    <Select
                      style={{ width: '100%', minWidth: 118 }}
                      placeholder={t('app.kuaizhizao.warehouseInbound.field.select')}
                      showSearch
                      optionFilterProp="label"
                      value={v}
                      options={purchaseConfirmWarehouseOptions}
                      onChange={async (nv) => {
                        setPurchaseConfirmLineWh((prev) => ({ ...prev, [rid]: nv }));
                        setPurchaseConfirmLineLoc((prev) => {
                          const next = { ...prev };
                          delete next[rid];
                          return next;
                        });
                        setPurchaseConfirmLineLocCode((prev) => {
                          const next = { ...prev };
                          delete next[rid];
                          return next;
                        });
                        const opts = await fetchStorageLocationsForWarehouse(nv);
                        setLocOptionsByWarehouse((prev) => ({ ...prev, [nv]: opts }));
                      }}
                      disabled={purchaseConfirmPreviewLoading}
                    />
                  );
                },
              },
              {
                title: t('app.kuaizhizao.warehouseInbound.col.location'),
                dataIndex: 'location_id',
                width: 150,
                render: (_: unknown, row: InboundOrderItem) => {
                  if (row.id == null) return '-';
                  const rid = Number(row.id);
                  const wh = purchaseConfirmLineWh[rid];
                  const locOpts = wh != null ? locOptionsByWarehouse[wh] ?? [] : [];
                  const locVal = purchaseConfirmLineLoc[rid];
                  return (
                    <Select
                      style={{ width: '100%', minWidth: 118 }}
                      placeholder={wh != null ? t('app.kuaizhizao.warehouseInbound.field.optional') : t('app.kuaizhizao.warehouseInbound.field.selectWarehouseFirst')}
                      showSearch
                      allowClear
                      optionFilterProp="label"
                      value={locVal}
                      options={locOpts}
                      onDropdownVisibleChange={(open) => {
                        if (open && wh != null && !locOptionsByWarehouse[wh]?.length) {
                          void fetchStorageLocationsForWarehouse(wh).then((opts) =>
                            setLocOptionsByWarehouse((p) => ({ ...p, [wh]: opts }))
                          );
                        }
                      }}
                      onChange={(v) => {
                        setPurchaseConfirmLineLoc((prev) => ({ ...prev, [rid]: v ?? undefined }));
                        const o = locOpts.find((x) => x.value === v);
                        setPurchaseConfirmLineLocCode((prev) => {
                          const next = { ...prev };
                          if (v == null) delete next[rid];
                          else next[rid] = o?.code ?? '';
                          return next;
                        });
                      }}
                      disabled={purchaseConfirmPreviewLoading || wh == null}
                    />
                  );
                },
              },
              {
                title: t('app.kuaizhizao.warehouseInbound.col.actualQty'),
                dataIndex: 'receipt_quantity',
                width: 100,
                align: 'right' as const,
                render: (_: unknown, row: InboundOrderItem) => {
                  if (row.id == null) return '-';
                  const rid = Number(row.id);
                  return (
                    <InputNumber
                      min={0.01}
                      precision={2}
                      value={purchaseConfirmPreviewQty[rid]}
                      onChange={(v) =>
                        setPurchaseConfirmPreviewQty((prev) => ({ ...prev, [rid]: Number(v) || 0 }))
                      }
                      style={{ width: 88 }}
                      size="small"
                    />
                  );
                },
              },
              {
                title: t('app.kuaizhizao.warehouseInbound.col.unit'),
                dataIndex: 'material_unit',
                width: 72,
                render: (_: unknown, row: InboundOrderItem) => {
                  if (row.material_id == null) return '-';
                  return (
                    <MaterialUnitSelect
                      materialId={row.material_id}
                      value={row.material_unit ?? row.unit}
                      size="small"
                      disabled
                      noStyle
                    />
                  );
                },
              },
              {
                title: t('app.kuaizhizao.warehouseInbound.col.batchNo'),
                dataIndex: 'batch_number',
                width: 138,
                render: (_: unknown, row: InboundOrderItem) => {
                  if (row.id == null) return '-';
                  const rid = Number(row.id);
                  return (
                    <Input
                      placeholder={t('app.kuaizhizao.warehouseInbound.field.optional')}
                      value={purchaseConfirmPreviewBatch[rid] ?? ''}
                      onChange={(e) =>
                        setPurchaseConfirmPreviewBatch((prev) => ({ ...prev, [rid]: e.target.value }))
                      }
                      size="small"
                    />
                  );
                },
              },
              {
                title: t('app.kuaizhizao.warehouseInbound.col.serialNo'),
                dataIndex: 'serial_numbers',
                width: 150,
                render: (_: unknown, row: InboundOrderItem) => {
                  if (row.id == null) return '-';
                  const rid = Number(row.id);
                  const meta = purchaseConfirmMaterialMeta[rid];
                  if (!meta?.serialManaged) return '—';
                  const qty = Number(
                    purchaseConfirmPreviewQty[rid] ?? row.receipt_quantity ?? row.return_quantity ?? 0,
                  );
                  const serials = purchaseConfirmPreviewSerial[rid] ?? [];
                  return (
                    <SerialNumbersImportTrigger
                      serials={serials}
                      expectedCount={qty > 0 ? qty : undefined}
                      materialLabel={row.material_code || row.material_name}
                      generateLoading={purchaseConfirmGeneratingSerialId === rid}
                      onSerialsChange={(next) =>
                        setPurchaseConfirmPreviewSerial((prev) => ({ ...prev, [rid]: next }))
                      }
                      onGenerate={
                        qty > 0 && !purchaseConfirmPreviewLoading
                          ? () => handleConfirmPreviewGenerateSerial(rid, qty)
                          : undefined
                      }
                    />
                  );
                },
              },
            ]}
          />
          {purchaseConfirmPreviewDetail?.receipt_type === 'production_return' ? (
            <ProForm
              formRef={productionReturnConfirmFormRef}
              submitter={false}
              layout="vertical"
              style={{ marginTop: 16 }}
            >
              <CustomFieldsFormSection
                customFields={productionReturnFormCustomFields}
                customFieldValues={productionReturnFormCustomFieldValues}
                gridColumns={1}
              />
            </ProForm>
          ) : null}
        </Spin>
      </Modal>

      <Modal
        title={
          simpleConfirmPreviewTarget?.receipt_type === 'sales_return'
            ? t('app.kuaizhizao.warehouseInbound.confirm.salesReturn.title')
            : simpleConfirmPreviewTarget?.receipt_type === 'other_inbound'
              ? t('app.kuaizhizao.warehouseInbound.confirm.otherInbound.title')
              : simpleConfirmPreviewTarget?.receipt_type === 'material_return'
                ? t('app.kuaizhizao.warehouseInbound.confirm.materialReturn.title')
                : t('app.kuaizhizao.warehouseInbound.confirm.outsourceReceipt.title')
        }
        open={simpleConfirmPreviewOpen}
        onCancel={() => {
          if (!simpleConfirmPreviewSubmitting) resetSimpleConfirmPreview();
        }}
        onOk={() => void submitSimpleConfirmPreview()}
        confirmLoading={simpleConfirmPreviewSubmitting}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        style={{ maxWidth: 'min(1400px, calc(100vw - 48px))' }}
        okText={
          simpleConfirmPreviewTarget?.receipt_type === 'production_return'
            ? t('app.kuaizhizao.warehouseInbound.action.confirmReturn')
            : t('app.kuaizhizao.warehouseInbound.action.confirmInbound')
        }
        destroyOnHidden
        okButtonProps={{
          disabled: simpleConfirmPreviewLoading || !simpleConfirmPreviewDetail,
        }}
      >
        <Spin spinning={simpleConfirmPreviewLoading}>
          <p style={{ marginBottom: 12, color: '#666' }}>
            {t('app.kuaizhizao.warehouseInbound.simpleConfirmPreview.description')}
          </p>
          {simpleConfirmPreviewTarget?.receipt_type === 'outsource_receipt' ? (
            <Descriptions
              size="small"
              column={2}
              items={[
                {
                  key: 'code',
                  label: t('app.kuaizhizao.warehouseInbound.col.docNo'),
                  children: String(simpleConfirmPreviewDetail?.code || simpleConfirmPreviewTarget.receipt_code || '—'),
                },
                {
                  key: 'quantity',
                  label: t('app.kuaizhizao.warehouseInbound.col.quantity'),
                  children: String(simpleConfirmPreviewDetail?.quantity ?? simpleConfirmPreviewTarget.total_quantity ?? '—'),
                },
                {
                  key: 'warehouse',
                  label: t('app.kuaizhizao.warehouseInbound.col.warehouse'),
                  children: String(
                    simpleConfirmPreviewDetail?.warehouse_name || simpleConfirmPreviewTarget.warehouse_name || '—',
                  ),
                },
              ]}
            />
          ) : (
            <Table
              size="small"
              pagination={false}
              scroll={{ x: 720 }}
              rowKey={(row, index) => String((row as { id?: number }).id ?? index)}
              dataSource={
                Array.isArray(simpleConfirmPreviewDetail?.items)
                  ? (simpleConfirmPreviewDetail?.items as Record<string, unknown>[])
                  : []
              }
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
              columns={[
                {
                  title: t('app.kuaizhizao.warehouseInbound.col.materialCode'),
                  dataIndex: 'material_code',
                  width: 120,
                  ellipsis: true,
                },
                {
                  title: t('app.kuaizhizao.warehouseInbound.col.materialName'),
                  dataIndex: 'material_name',
                  width: 160,
                  ellipsis: true,
                },
                {
                  title: t('app.kuaizhizao.warehouseInbound.col.quantity'),
                  key: 'qty',
                  width: 100,
                  align: 'right',
                  render: (_: unknown, row: Record<string, unknown>) =>
                    Number(row.receipt_quantity ?? row.return_quantity ?? row.quantity ?? 0),
                },
                {
                  title: t('app.kuaizhizao.warehouseInbound.col.warehouse'),
                  dataIndex: 'warehouse_name',
                  width: 140,
                  ellipsis: true,
                  render: (v: unknown, row: Record<string, unknown>) =>
                    String(v || simpleConfirmPreviewDetail?.warehouse_name || simpleConfirmPreviewTarget?.warehouse_name || '—'),
                },
              ]}
            />
          )}
        </Spin>
      </Modal>

      <DetailDrawerTemplate
        title={`${currentOrder?.receipt_type === 'production_return' ? t('app.kuaizhizao.warehouseInbound.detail.productionReturnTitle') : t('app.kuaizhizao.warehouseInbound.detail.title')} - ${currentOrder?.receipt_code || currentOrder?.return_code || ''}`}
        open={detailDrawerVisible}
        zIndex={inboundDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentOrder(null);
          setEditableReceiptQuantities({});
          setPurchaseReceiptAttachments([]);
          resetPurchaseReceiptDetailFieldValues();
          resetProductionReturnDetailFieldValues();
          resetFinishedGoodsReceiptDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        loading={detailLoading}
        extra={
          currentOrder ? (
            <Space>
              {isInboundConfirmable(currentOrder) ? (
                <>
                  {isEditablePurchaseReceipt(currentOrder) && (
                    <Button onClick={handleSavePurchaseReceiptQuantities} loading={savingPurchaseReceipt}>
                      {t('app.kuaizhizao.warehouseInbound.action.saveActualQty')}
                    </Button>
                  )}
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => void handleConfirm(currentOrder)}
                  >
                    {currentOrder.receipt_type === 'production_return'
                      ? t('app.kuaizhizao.warehouseInbound.action.confirmReturn')
                      : t('app.kuaizhizao.warehouseInbound.action.confirmInbound')}
                  </Button>
                </>
              ) : !isInboundStockPosted(currentOrder) &&
                inboundConfirmCapabilityReasonMessage(currentOrder, t) ? (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled
                  title={inboundConfirmCapabilityReasonMessage(currentOrder, t)}
                >
                  {currentOrder.receipt_type === 'production_return'
                    ? t('app.kuaizhizao.warehouseInbound.action.confirmReturn')
                    : t('app.kuaizhizao.warehouseInbound.action.confirmInbound')}
                </Button>
              ) : null}
              {isInboundStockPosted(currentOrder) && (
                <Button
                  danger
                  icon={<RollbackOutlined />}
                  onClick={() => handleWithdrawInbound(currentOrder)}
                >
                  {currentOrder.receipt_type === 'production_return'
                    ? t('app.kuaizhizao.warehouseInbound.action.withdrawReturn')
                    : t('app.kuaizhizao.warehouseInbound.action.withdrawInbound')}
                </Button>
              )}
            </Space>
          ) : null
        }
        basic={
          currentOrder ? (
            <Descriptions
              column={3}
              size="small"
              items={[
                {
                  key: 'code',
                  label: t('app.kuaizhizao.warehouseInbound.col.docNo'),
                  children: (
                    <Typography.Text copyable={{ text: String(currentOrder.receipt_code || currentOrder.return_code || '') }}>
                      {currentOrder.receipt_code || currentOrder.return_code || '-'}
                    </Typography.Text>
                  ),
                },
                {
                  key: 'type',
                  label: t('app.kuaizhizao.warehouseInbound.field.type'),
                  children: renderInboundReceiptTypeMarkerTag(t, currentOrder.receipt_type),
                },
                {
                  key: 'status',
                  label: t('app.kuaizhizao.warehouseInbound.field.status'),
                  children: (
                    <StatusTag color={resolveInboundHubStatusTagColor(currentOrder.status)}>
                      {resolveInboundHubStatusLabel(t, currentOrder.status, currentOrder.receipt_type)}
                    </StatusTag>
                  ),
                },
                ...(currentOrder.supplier_name
                  ? [{ key: 'supplier', label: t('app.kuaizhizao.warehouseInbound.field.supplier'), children: currentOrder.supplier_name }]
                  : []),
                ...(currentOrder.purchase_order_code
                  ? [{ key: 'po', label: t('app.kuaizhizao.warehouseInbound.field.purchaseOrderCode'), children: currentOrder.purchase_order_code }]
                  : []),
                ...(currentOrder.work_order_code
                  ? [{ key: 'wo', label: t('app.kuaizhizao.warehouseInbound.field.workOrderCode'), children: currentOrder.work_order_code }]
                  : []),
                ...(currentOrder.picking_code
                  ? [{ key: 'pick', label: t('app.kuaizhizao.warehouseInbound.field.pickingCode'), children: currentOrder.picking_code }]
                  : []),
                ...(currentOrder.workshop_name
                  ? [{ key: 'ws', label: t('app.kuaizhizao.warehouseInbound.field.workshop'), children: currentOrder.workshop_name }]
                  : []),
                {
                  key: 'wh',
                  label: t('app.kuaizhizao.warehouseInbound.field.warehouse'),
                  children: currentOrder.warehouse_name ?? '-',
                },
                {
                  key: 'date',
                  label: t('app.kuaizhizao.warehouseInbound.field.date'),
                  children: formatInboundDateDisplay(currentOrder),
                },
                {
                  key: 'op',
                  label: t('app.kuaizhizao.warehouseInbound.field.operator'),
                  children: resolveInboundHubOperator(currentOrder) || '-',
                },
              ]}
            />
          ) : undefined
        }
        collaboration={inboundDetailCollaboration}
        traceDocument={inboundTraceDocument}
        supplementary={inboundDetailSupplementary}
        linesTitle={inboundDetailLinesTitle}
        lines={
          currentOrder ? (
            <>
                <style>{`
                  .inbound-detail-drawer-items .ant-table-wrapper .ant-table-body,
                  .inbound-detail-drawer-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                `}</style>
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                {inboundDetailItems.length > 0 ? (
                  <div
                    className="inbound-detail-drawer-items"
                    style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                  >
                    <Table
                      className="warehouse-detail-table"
                      size="small"
                      tableLayout="fixed"
                      style={{ minWidth: INBOUND_DETAIL_ITEMS_MIN_WIDTH }}
                      rowKey={(r, idx) => (r.id != null ? String(r.id) : `m-${r.material_id ?? idx}`)}
                      pagination={false}
                      bordered
                      columns={
                        currentOrder.receipt_type === 'production_return'
                          ? [
                              { title: t('app.kuaizhizao.warehouseInbound.col.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
                              { title: t('app.kuaizhizao.warehouseInbound.col.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
                              {
                                title: t('app.kuaizhizao.warehouseInbound.col.unit'),
                                dataIndex: 'material_unit',
                                width: 72,
                                render: (_: unknown, row: InboundOrderItem) => renderInboundDetailUnitCell(row),
                              },
                              {
                                title: t('app.kuaizhizao.warehouseInbound.col.returnQty'),
                                dataIndex: 'return_quantity',
                                width: 100,
                                align: 'right' as const,
                                render: formatQuantity,
                              },
                              { title: t('app.kuaizhizao.warehouseInbound.col.warehouseName'), dataIndex: 'warehouse_name', width: 120, ellipsis: true },
                              { title: t('app.kuaizhizao.warehouseInbound.col.locationCode'), dataIndex: 'location_code', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                              { title: t('app.kuaizhizao.warehouseInbound.col.batchNumber'), dataIndex: 'batch_number', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                            ]
                          : currentOrder.receipt_type === 'purchase'
                            ? [
                                { title: t('app.kuaizhizao.warehouseInbound.col.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
                                { title: t('app.kuaizhizao.warehouseInbound.col.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
                                {
                                  title: t('app.kuaizhizao.warehouseInbound.col.actualQty'),
                                  dataIndex: 'receipt_quantity',
                                  width: 140,
                                  align: 'right' as const,
                                  render: (_: any, row: InboundOrderItem) => {
                                    const editable = isEditablePurchaseReceipt(currentOrder) && row.id != null;
                                    if (!editable) return formatQuantity(row.receipt_quantity);
                                    const rid = Number(row.id);
                                    return (
                                      <InputNumber
                                        min={0.01}
                                        precision={2}
                                        value={editableReceiptQuantities[rid] ?? Number(row.receipt_quantity ?? 0)}
                                        onChange={(v) =>
                                          setEditableReceiptQuantities((prev) => ({ ...prev, [rid]: Number(v) || 0 }))
                                        }
                                        style={{ width: 110 }}
                                        size="small"
                                      />
                                    );
                                  },
                                },
                                {
                                  title: t('app.kuaizhizao.warehouseInbound.col.unit'),
                                  dataIndex: 'material_unit',
                                  width: 72,
                                  render: (_: unknown, row: InboundOrderItem) => renderInboundDetailUnitCell(row),
                                },
                                { title: t('app.kuaizhizao.warehouseInbound.col.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' as const },
                                { title: t('app.kuaizhizao.warehouseInbound.col.amount'), dataIndex: 'total_amount', width: 100, align: 'right' as const },
                                { title: t('app.kuaizhizao.warehouseInbound.col.locationCode'), dataIndex: 'location_code', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                                { title: t('app.kuaizhizao.warehouseInbound.col.batchNumber'), dataIndex: 'batch_number', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                                {
                                  title: t('app.kuaizhizao.warehouseInbound.col.serialNo'),
                                  dataIndex: 'serial_numbers',
                                  width: 88,
                                  render: (v: unknown) => renderInboundDetailSerialCell(t, v),
                                },
                              ]
                            : [
                                { title: t('app.kuaizhizao.warehouseInbound.col.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
                                { title: t('app.kuaizhizao.warehouseInbound.col.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
                                {
                                  title: t('app.kuaizhizao.warehouseInbound.col.quantity'),
                                  dataIndex: 'receipt_quantity',
                                  width: 100,
                                  align: 'right' as const,
                                  render: formatQuantity,
                                },
                                {
                                  title: t('app.kuaizhizao.warehouseInbound.col.unit'),
                                  dataIndex: 'material_unit',
                                  width: 72,
                                  render: (_: unknown, row: InboundOrderItem) => renderInboundDetailUnitCell(row),
                                },
                                { title: t('app.kuaizhizao.warehouseInbound.col.locationCode'), dataIndex: 'location_code', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                                { title: t('app.kuaizhizao.warehouseInbound.col.batchNumber'), dataIndex: 'batch_number', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                              ]
                      }
                      dataSource={inboundDetailItems}
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseInbound.detail.noDetails')} />
                )}

            </>
          ) : undefined
        }
        timeline={
          currentOrder?.id != null ? (
            <>
              {inboundTracking.loading && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin />
                </div>
              )}
              {inboundTracking.error && !inboundTracking.loading && (
                <Typography.Text type="danger">{inboundTracking.error}</Typography.Text>
              )}
              {inboundTracking.data && !inboundTracking.loading && (
                <DocumentTrackingTimelineBody data={inboundTracking.data} />
              )}
              {!inboundTracking.loading && !inboundTracking.data && !inboundTracking.error && (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseInbound.detail.noOperationLog')} />
              )}
            </>
          ) : undefined
        }
      />
      <PurchaseReceiptIqcReviewModal
        open={iqcReviewOpen}
        loading={iqcReviewLoading}
        purchaseReceiptId={iqcReviewPurchaseReceiptId}
        ensure={iqcReviewEnsure}
        t={t}
        navigate={navigate}
        onCancel={handleIqcReviewCancel}
        onContinue={() => void handleIqcReviewContinue()}
      />
      <CustomerMaterialIqcReviewModal
        open={cmIqcReviewOpen}
        loading={cmIqcReviewLoading}
        registrationId={cmIqcReviewRegistrationId}
        ensure={cmIqcReviewEnsure}
        t={t}
        navigate={navigate}
        onCancel={handleCmIqcReviewCancel}
        onContinue={() => void handleCmIqcReviewContinue()}
      />
      <FinishedGoodsReceiptFqcReviewModal
        open={fqcReviewOpen}
        loading={fqcReviewLoading}
        finishedGoodsReceiptId={fqcReviewFinishedGoodsReceiptId}
        ensure={fqcReviewEnsure}
        t={t}
        navigate={navigate}
        onCancel={handleFqcReviewCancel}
        onContinue={() => void handleFqcReviewContinue()}
      />
      {PrintModal}
    </ListPageTemplate>
  );
};

export default InboundPage;
