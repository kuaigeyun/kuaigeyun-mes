/**
 * 入库管理页面
 *
 * 提供入库单的管理功能，支持多种入库类型：采购入库、成品入库（产品入库）、生产退料等。
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useNavigate, useLocation } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProForm, ProFormItem, type ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, InputNumber, Input, Typography, Select, Spin, Descriptions, Empty, Upload, theme as AntdTheme } from 'antd';
import {
  EyeOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  RollbackOutlined,
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
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { UniPullLoadButton } from '../../../../../components/uni-pull';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../WarehouseTraceBriefFooter';
import {
  warehouseApi,
  outsourceMaterialReceiptApi,
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
} from '../../../services/production';
import { LinkedIqcPanel } from '../../quality-management/components/LinkedInspectionPanel';
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
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../../../../utils/format';
import InboundQuickPullModals, {
  type InboundQuickPullModalsRef,
} from './InboundQuickPullModals';
import type {
  InboundPullEntryNavigationState,
  PurchaseReceiptEntryHandoff,
} from './inboundPullEntryTypes';
import { fetchInboundHubList } from './inboundListAggregate';
import { batchConfirmInboundDocuments } from './inboundBatchConfirm';
import {
  type InboundHubOrder,
  type InboundReceiptType,
  INBOUND_RECEIPT_TYPE_LABELS,
  isInboundConfirmable,
  inboundSourceDocNo,
} from './inboundHubTypes';
import { uploadMultipleFiles } from '../../../../../services/file';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';

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

/** 入库明细数量展示（无值时显示 —） */
function formatInboundQty(val: unknown): string {
  if (val == null || val === '') return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
  const dateValue = record.receipt_date;
  if (dateValue) return formatDateBySiteSetting(dateValue);
  const timeValue = record.return_time;
  if (timeValue) return formatDateTimeBySiteSetting(timeValue);
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
        const list = await materialApi.list({ code, limit: 1 });
        const m = Array.isArray(list) && list[0] ? list[0] : null;
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

function renderInboundDetailSerialCell(val: unknown): string {
  if (!Array.isArray(val) || val.length === 0) return '—';
  return `${val.length} 个`;
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

function renderInboundRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return nodes;
}

const InboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const inboundDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const quickPullRef = useRef<InboundQuickPullModalsRef>(null);
  const listDataRef = useRef<InboundOrder[]>([]);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
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
  const [currentOrder, setCurrentOrder] = useState<InboundOrder | null>(null);
  const [inboundTrackingRefreshKey, setInboundTrackingRefreshKey] = useState(0);
  const [editableReceiptQuantities, setEditableReceiptQuantities] = useState<Record<number, number>>({});
  const [savingPurchaseReceipt, setSavingPurchaseReceipt] = useState(false);
  const [purchaseReceiptAttachments, setPurchaseReceiptAttachments] = useState<any[]>([]);

  const [purchaseConfirmPreviewOpen, setPurchaseConfirmPreviewOpen] = useState(false);
  const [purchaseConfirmPreviewLoading, setPurchaseConfirmPreviewLoading] = useState(false);
  const [purchaseConfirmPreviewSubmitting, setPurchaseConfirmPreviewSubmitting] = useState(false);
  const [purchaseConfirmPreviewDetail, setPurchaseConfirmPreviewDetail] = useState<InboundOrder | null>(null);
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

  const handleBatchConfirm = useCallback(
    async (keys: React.Key[]) => {
      const keySet = new Set(keys.map(String));
      const records = listDataRef.current.filter((r) => keySet.has(`${r.receipt_type}::${r.id}`));
      if (!records.length) {
        messageApi.warning('未找到所选单据，请刷新列表后重试');
        return;
      }
      const result = await batchConfirmInboundDocuments(records);
      if (result.success > 0) {
        messageApi.success(`已成功确认 ${result.success} 张单据`);
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
        setSelectedRowKeys([]);
      }
      if (result.failed.length) {
        const detail = result.failed.slice(0, 5).map((f) => f.message).join('；');
        messageApi.error(
          result.failed.length > 5
            ? `${result.failed.length} 张单据确认失败：${detail}…`
            : `确认失败：${detail}`,
        );
      }
    },
    [invalidateMenuBadgeCounts, messageApi],
  );

  const handleDetail = async (record: InboundOrder) => {
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
        setCurrentOrder({ ...detailData, receipt_type: record.receipt_type });
        setDetailDrawerVisible(true);
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
        '获取入库单详情失败';
      messageApi.error(typeof msg === 'string' ? msg : '获取入库单详情失败');
    }
  };

  const isEditablePurchaseReceipt = (order?: InboundOrder | null) =>
    order?.receipt_type === 'purchase' && ['草稿', 'draft', 'DRAFT', '待入库'].includes(String(order?.status || ''));

  const handleSavePurchaseReceiptQuantities = async () => {
    if (!currentOrder?.id || currentOrder?.receipt_type !== 'purchase') return;
    const items = (currentOrder.items || []) as InboundOrderItem[];
    if (!items.length) {
      messageApi.warning('暂无可编辑明细');
      return;
    }
    const mappedItems = items
      .filter((it) => it.material_id != null)
      .map((it) => {
        const rowId = Number(it.id);
        const qty = Number(editableReceiptQuantities[rowId] ?? it.receipt_quantity ?? 0);
        if (!(qty > 0)) {
          throw new Error(`物料 ${it.material_code || it.material_name || '-'} 的实际数量必须大于 0`);
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
      setCurrentOrder({ ...detail, receipt_type: 'purchase' });
      const quantities: Record<number, number> = {};
      ((detail as any).items || []).forEach((it: any) => {
        if (it?.id != null) quantities[it.id] = Number(it.receipt_quantity ?? 0);
      });
      setEditableReceiptQuantities(quantities);
      messageApi.success('实际数量已保存');
      invalidateMenuBadgeCounts();
      setInboundTrackingRefreshKey((k) => k + 1);

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || error?.response?.data?.detail || '保存失败');
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
      messageApi.warning('单次最多生成100个序列号');
      return;
    }
    setPurchaseConfirmGeneratingSerialId(rowId);
    try {
      const res = await materialSerialApi.generate(meta.materialUuid, count, {
        ruleId: meta.defaultSerialRuleId ?? undefined,
      });
      setPurchaseConfirmPreviewSerial((prev) => ({ ...prev, [rowId]: res.serial_nos }));
      messageApi.success(`已生成 ${res.count} 个序列号`);
      return res.serial_nos;
    } catch (e: any) {
      messageApi.error(e?.message || '序列号生成失败');
    } finally {
      setPurchaseConfirmGeneratingSerialId(null);
    }
  };

  const openConfirmPreview = async (
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
        loadConfirmPreviewMaterialMeta(detailData.items || []),
      ]);
      setPurchaseConfirmPreviewBatch(batchPrefilled);
      setPurchaseConfirmPreviewSerial(serial);
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
      messageApi.error('加载入库单详情失败');
      resetPurchaseConfirmPreview();
    } finally {
      setPurchaseConfirmPreviewLoading(false);
    }
  };

  useEffect(() => {
    const dc = (location.state as InboundPullEntryNavigationState | null)?.inboundDirectConfirm;
    if (!dc?.id) return;
    const key = `${dc.receipt_type}:${dc.id}`;
    if (handledDirectConfirmKeyRef.current === key) return;
    handledDirectConfirmKeyRef.current = key;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
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
      messageApi.warning('暂无可入库明细');
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
            throw new Error(`物料 ${it.material_code || it.material_name || '-'} 的实际数量必须大于 0`);
          }
          const lineWh = purchaseConfirmLineWh[rowId];
          if (lineWh == null || !(lineWh > 0)) {
            throw new Error(`请为物料 ${it.material_code || it.material_name || '-'} 选择入库仓库`);
          }
          const unitPrice = Number(it.unit_price ?? 0);
          const qualified = Number(it.qualified_quantity ?? it.receipt_quantity ?? qty);
          const unqualified = Number(it.unqualified_quantity ?? 0);
          const batchStr = (purchaseConfirmPreviewBatch[rowId] ?? it.batch_number ?? '').trim();
          const serialList = purchaseConfirmPreviewSerial[rowId];
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
      messageApi.error(e?.message || '请检查明细');
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
          // #region agent log
          globalThis.fetch('http://127.0.0.1:7807/ingest/b117966e-dad0-4d01-bd6a-e3ba9296abb4', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2f32a1' },
            body: JSON.stringify({
              sessionId: '2f32a1',
              runId: 'pre-fix',
              hypothesisId: 'H6',
              location: 'inbound/index.tsx:submitConfirmPreview',
              message: 'early_exit_row_count',
              data: { receiptId: order.id, refLen: refItems.length, srcLen: orderedSource.length },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          messageApi.error('保存后明细行数不一致，请关闭预览后重试');
          return;
        }
        if (refItems.some((it: any) => it?.id == null || !(Number(it.id) > 0))) {
          // #region agent log
          globalThis.fetch('http://127.0.0.1:7807/ingest/b117966e-dad0-4d01-bd6a-e3ba9296abb4', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2f32a1' },
            body: JSON.stringify({
              sessionId: '2f32a1',
              runId: 'pre-fix',
              hypothesisId: 'H6',
              location: 'inbound/index.tsx:submitConfirmPreview',
              message: 'early_exit_bad_item_id',
              data: { receiptId: order.id },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          messageApi.error('保存后明细 id 异常，请关闭预览后重试');
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
        // #region agent log
        globalThis.fetch('http://127.0.0.1:7807/ingest/b117966e-dad0-4d01-bd6a-e3ba9296abb4', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2f32a1' },
          body: JSON.stringify({
            sessionId: '2f32a1',
            runId: 'pre-fix',
            hypothesisId: 'H1',
            location: 'inbound/index.tsx:submitConfirmPreview',
            message: 'before_confirm',
            data: {
              receiptId: order.id,
              headerWh,
              confirmItemIds: confirmItems.map((c: any) => c.item_id),
              lineWhs: confirmItems.map((c: any) => c.warehouse_id),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
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
        order.receipt_type === 'production_return' ? '退料确认成功，库存已更新' : '入库确认成功，库存已更新',
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

          setCurrentOrder({ ...detailData, receipt_type: order.receipt_type });
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
      // #region agent log
      const det = error?.response?.data?.detail;
      const detailStr =
        typeof det === 'string' ? det : Array.isArray(det) ? JSON.stringify(det).slice(0, 500) : det != null ? JSON.stringify(det).slice(0, 500) : '';
      globalThis.fetch('http://127.0.0.1:7807/ingest/b117966e-dad0-4d01-bd6a-e3ba9296abb4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '2f32a1' },
        body: JSON.stringify({
          sessionId: '2f32a1',
          runId: 'pre-fix',
          hypothesisId: 'H6',
          location: 'inbound/index.tsx:submitConfirmPreview',
          message: 'confirm_catch',
          data: {
            errMsg: String(error?.message || '').slice(0, 400),
            status: error?.response?.status,
            detail: detailStr.slice(0, 500),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      messageApi.error(error?.message || error?.response?.data?.detail || '确认失败');
      throw error;
    } finally {
      setPurchaseConfirmPreviewSubmitting(false);
    }
  };

  /**
   * 处理确认入库/退料
   */
  const handleConfirm = async (record: InboundOrder) => {
    const code = record.receipt_code || record.return_code || '';
    if (record.receipt_type === 'customer_material') {
      Modal.confirm({
        title: '确认代工来料入库',
        content: `确定确认入库单据「${code}」吗？`,
        onOk: async () => {
          await customerMaterialRegistrationApi.process(String(record.id));
          messageApi.success('代工来料已确认入库');
          invalidateMenuBadgeCounts();
          await actionRef.current?.reload?.();
        },
      });
      return;
    }
    if (record.receipt_type === 'sales_return') {
      Modal.confirm({
        title: '确认销售退货入库',
        content: `确定确认入库单据「${code}」吗？`,
        onOk: async () => {
          await warehouseApi.salesReturn.confirm(String(record.id));
          messageApi.success('销售退货已确认入库');
          invalidateMenuBadgeCounts();
          await actionRef.current?.reload?.();
        },
      });
      return;
    }
    if (record.receipt_type === 'other_inbound') {
      Modal.confirm({
        title: '确认其他入库',
        content: `确定确认入库单据「${code}」吗？`,
        onOk: async () => {
          await warehouseApi.otherInbound.confirm(String(record.id));
          messageApi.success('其他入库已确认');
          invalidateMenuBadgeCounts();
          await actionRef.current?.reload?.();
        },
      });
      return;
    }
    if (record.receipt_type === 'material_return') {
      Modal.confirm({
        title: '确认还料入库',
        content: `确定确认还料单据「${code}」吗？`,
        onOk: async () => {
          await warehouseApi.materialReturn.confirm(String(record.id));
          messageApi.success('还料单已确认入库');
          invalidateMenuBadgeCounts();
          await actionRef.current?.reload?.();
        },
      });
      return;
    }
    if (record.receipt_type === 'outsource_receipt') {
      Modal.confirm({
        title: '确认委外收货入库',
        content: `确定确认委外收货单据「${code}」吗？`,
        onOk: async () => {
          await outsourceMaterialReceiptApi.complete(String(record.id));
          messageApi.success('委外收货已确认入库');
          invalidateMenuBadgeCounts();
          await actionRef.current?.reload?.();
        },
      });
      return;
    }
    if (
      record.receipt_type === 'outsource_material_return' ||
      record.receipt_type === 'outsource_product_return'
    ) {
      messageApi.warning('委外退料/退货请使用确认入库预览');
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
      title: isReturn ? '撤回退料' : '撤回入库',
      content: `确定撤回单据「${code}」吗？将按明细冲减即时库存；若某批次库存不足将无法撤回。`,
      okText: '撤回',
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
          messageApi.success(isReturn ? '已撤回退料，库存已冲减' : '已撤回入库，库存已冲减');
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
                setCurrentOrder({ ...detailData, receipt_type: record.receipt_type });
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
          messageApi.error(error?.message || error?.response?.data?.detail || '撤回失败');
        }
      },
    });
  };

  /**
   * 处理删除：采购/成品仅草稿或待入库；生产退料为待退料（与行内按钮一致）
   */
  const handleDelete = async (record: InboundOrder) => {
    const code = String(record.receipt_code || record.return_code || '');
    const typeLabel =
      INBOUND_RECEIPT_TYPE_LABELS[record.receipt_type as InboundReceiptType] || '入库单';
    Modal.confirm({
      title: `删除${typeLabel}`,
      content: `确定要删除「${code || '-'}」吗？删除后不可恢复（未确认入库的单据不涉及库存冲减）。`,
      okType: 'danger',
      onOk: async () => {
        try {
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
            return;
          }
          messageApi.success('删除成功');
          invalidateMenuBadgeCounts();

          await actionRef.current?.reload?.();
        } catch (error: any) {
          const msg =
            error?.response?.data?.detail ??
            error?.response?.data?.message ??
            error?.message ??
            '删除失败';
          messageApi.error(typeof msg === 'string' ? msg : '删除失败');
        }
      },
    });
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
    return '入库单';
  };

  const purchaseReceiptCustomFieldColumns = generatePurchaseReceiptCustomFieldColumns();
  const productionReturnCustomFieldColumns = generateProductionReturnCustomFieldColumns();
  const finishedGoodsReceiptCustomFieldColumns = generateFinishedGoodsReceiptCustomFieldColumns();
  const columns: ProColumns<InboundOrder>[] = [
    {
      title: '主体 / 单号',
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
      title: '单号',
      dataIndex: ['receipt_code', 'return_code'],
      hideInTable: true,
    },
    {
      title: '入库类型',
      dataIndex: 'receipt_type',
      width: 100,
      valueEnum: Object.fromEntries(
        Object.entries(INBOUND_RECEIPT_TYPE_LABELS).map(([key, label]) => [
          key,
          { text: label, status: 'default' as const },
        ]),
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: {
        pending: { text: '待入库' },
        posted: { text: '已入库' },
        all: { text: '全部' },
      },
      initialValue: 'pending',
    },
    {
      title: '来源单号',
      dataIndex: 'source_doc_no',
      width: 140,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => inboundSourceDocNo(record) || '-',
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      hideInTable: true,
      ellipsis: true,
    },
    {
      title: '工单/领料单',
      dataIndex: ['work_order_code', 'picking_code'],
      width: 140,
      ellipsis: true,
      render: (_, record) => [record.work_order_code, record.picking_code].filter(Boolean).join(' / ') || '-',
    },
    {
      title: '入库数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '入库品种',
      dataIndex: 'total_items',
      width: 100,
      align: 'right',
    },
    {
      title: '入库仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作员',
      dataIndex: ['received_by', 'returner_name'],
      width: 100,
      ellipsis: true,
      render: (_, record) => record.received_by || record.returner_name || '-',
    },
    {
      title: '日期',
      dataIndex: ['receipt_date', 'return_time'],
      width: 160,
      render: (_, record) => formatInboundDateDisplay(record),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => formatDateTimeBySiteSetting(r.updated_at),
    },
    {
      title: '生命周期',
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
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const posted = isInboundStockPosted(record);
        const pending = !posted && isInboundConfirmable(record);
        const nodes: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="detail" onClick={() => handleDetail(record)} />,
        ];
        if (pending) {
          nodes.push(
            <Button
              {...rowActionKind('execute')}
              {...rowActionLabelKeep()}
              key="confirm"
              onClick={() => handleConfirm(record)}
            >
              {record.receipt_type === 'production_return' ? '确认退料' : '确认入库'}
            </Button>
          );
          if (
            record.receipt_type === 'production_return' ||
            record.receipt_type === 'purchase' ||
            record.receipt_type === 'finished_goods' ||
            record.receipt_type === 'semi_finished_goods' ||
            record.receipt_type === 'sales_return' ||
            record.receipt_type === 'other_inbound' ||
            record.receipt_type === 'material_return'
          ) {
            nodes.push(
              <Button {...rowActionKind('delete')} key="delete" onClick={() => handleDelete(record)} />
            );
          }
        }
        if (posted) {
          nodes.push(
            <Button
              {...rowActionKind('revoke')}
              {...rowActionLabelKeep()}
              key="withdraw"
              onClick={() => handleWithdrawInbound(record)}
            >
              {record.receipt_type === 'production_return' ? '撤回退料' : '撤回入库'}
            </Button>
          );
        }
        return nodes;
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="入库管理"
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.inbound"
        actionRef={actionRef}
        rowKey={(record) => `${record.receipt_type}::${record.id}`}
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const result = await fetchInboundHubList(params as Record<string, unknown>, {
              enrichPurchaseReceiptRecordsWithCustomFields,
              enrichFinishedGoodsReceiptRecordsWithCustomFields,
              enrichProductionReturnRecordsWithCustomFields,
            });
            listDataRef.current = result.data;
            return result;
          } catch {
            messageApi.error('获取入库单列表失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            for (const key of keys) {
              const [type, id] = String(key).split('::');
              if (type === 'purchase') {
                await warehouseApi.purchaseReceipt.delete(id);
              } else if (type === 'finished_goods') {
                await warehouseApi.finishedGoodsReceipt.delete(id);
              } else if (type === 'semi_finished_goods') {
                await warehouseApi.semiFinishedGoodsReceipt.delete(id);
              } else if (type === 'production_return') {
                await warehouseApi.productionReturn.delete(id);
              } else if (type === 'sales_return') {
                await warehouseApi.salesReturn.delete(id);
              } else if (type === 'other_inbound') {
                await warehouseApi.otherInbound.delete(id);
              } else if (type === 'material_return') {
                await warehouseApi.materialReturn.delete(id);
              }
            }
            messageApi.success(`成功删除 ${keys.length} 条记录`);
            invalidateMenuBadgeCounts();
            actionRef.current?.reload();
          } catch (error: any) {
            const msg =
              error?.response?.data?.detail ??
              error?.response?.data?.message ??
              error?.message ??
              '删除失败';
            messageApi.error(typeof msg === 'string' ? msg : '删除失败');
          }
        }}
        deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条入库单吗？`}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        rowSelectionGetCheckboxProps={(record) => ({ disabled: !isInboundConfirmable(record) })}
        toolBarActionsAfterBatch={[
          <UniBatchMenuButton
            key="inbound-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText="批量操作"
            menuItems={[
              {
                key: 'batch-confirm',
                label: '批量确认入库',
                requireConfirm: true,
                confirmTitle: (count) => `确认批量入库 ${count} 张单据`,
                confirmDescription: '将按单据类型调用对应确认接口；不可确认的单据会跳过并汇总失败原因。',
                onClick: handleBatchConfirm,
              },
            ]}
          />,
        ]}
        toolBarRender={() => {
          const pullMenuItems = buildKuaizhizaoPullCreateMenuItems([
            {
              actionKey: 'inbound.pull_from_purchase_order',
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
              menuItems={pullMenuItems}
              type="primary"
              variant="solid"
            />,
          ];
        }}
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
            ? '确认退料预览'
            : '确认入库预览'
        }
        open={purchaseConfirmPreviewOpen}
        onCancel={() => {
          if (!purchaseConfirmPreviewSubmitting) resetPurchaseConfirmPreview();
        }}
        onOk={submitConfirmPreview}
        confirmLoading={purchaseConfirmPreviewSubmitting}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        okText={
          purchaseConfirmPreviewDetail?.receipt_type === 'production_return' ? '确认退料' : '确认入库'
        }
        destroyOnHidden
      >
        <Spin spinning={purchaseConfirmPreviewLoading}>
          <p style={{ marginBottom: 12, color: '#666' }}>
            请逐行核对入库仓库、库位（可选）、批号与序列号（如物料启用管理）及明细数量后再确认；确认后将按行更新库存。
          </p>
          <Table
            size="small"
            pagination={false}
            scroll={{ x: 1000 }}
            rowKey={(r) => (r.id != null ? String(r.id) : `m-${r.material_id}`)}
            dataSource={(purchaseConfirmPreviewDetail?.items || []) as InboundOrderItem[]}
            columns={[
              { title: '物料编号', dataIndex: 'material_code', width: 100, ellipsis: true },
              { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
              {
                title: '入库仓库',
                dataIndex: 'warehouse_id',
                width: 150,
                render: (_: unknown, row: InboundOrderItem) => {
                  if (row.id == null) return '-';
                  const rid = Number(row.id);
                  const v = purchaseConfirmLineWh[rid];
                  return (
                    <Select
                      style={{ width: '100%', minWidth: 118 }}
                      placeholder="请选择"
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
                title: '库位',
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
                      placeholder={wh != null ? '可选' : '先选仓库'}
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
                title: '实际数量',
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
                title: '单位',
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
                title: '批号',
                dataIndex: 'batch_number',
                width: 138,
                render: (_: unknown, row: InboundOrderItem) => {
                  if (row.id == null) return '-';
                  const rid = Number(row.id);
                  return (
                    <Input
                      placeholder="可选"
                      value={purchaseConfirmPreviewBatch[rid] ?? ''}
                      onChange={(e) =>
                        setPurchaseConfirmPreviewBatch((prev) => ({ ...prev, [rid]: e.target.value }))
                      }
                      size="small"
                    />
                  );
                },
              },
              ...(purchaseConfirmPreviewDetail?.receipt_type === 'purchase'
                ? [
                    {
                      title: '序列号',
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
                  ]
                : []),
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

      <DetailDrawerTemplate
        title={`${currentOrder?.receipt_type === 'production_return' ? '生产退料单' : '入库单'}详情 - ${currentOrder?.receipt_code || currentOrder?.return_code || ''}`}
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
        columns={[]}
        extra={
          currentOrder ? (
            <Space>
              {isInboundConfirmable(currentOrder) && (
                <>
                  {isEditablePurchaseReceipt(currentOrder) && (
                    <Button onClick={handleSavePurchaseReceiptQuantities} loading={savingPurchaseReceipt}>
                      保存实际数量
                    </Button>
                  )}
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => handleConfirm(currentOrder)}
                  >
                    {currentOrder.receipt_type === 'production_return' ? '确认退料' : '确认入库'}
                  </Button>
                </>
              )}
              {isInboundStockPosted(currentOrder) && (
                <Button
                  danger
                  icon={<RollbackOutlined />}
                  onClick={() => handleWithdrawInbound(currentOrder)}
                >
                  {currentOrder.receipt_type === 'production_return' ? '撤回退料' : '撤回入库'}
                </Button>
              )}
            </Space>
          ) : null
        }
        customContent={
          currentOrder ? (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={[
                    {
                      key: 'code',
                      label: '单号',
                      children: (
                        <Typography.Text copyable={{ text: String(currentOrder.receipt_code || currentOrder.return_code || '') }}>
                          {currentOrder.receipt_code || currentOrder.return_code || '-'}
                        </Typography.Text>
                      ),
                    },
                    {
                      key: 'type',
                      label: '类型',
                      children: (
                        <Tag
                          color={
                            currentOrder.receipt_type === 'purchase'
                              ? 'processing'
                              : currentOrder.receipt_type === 'finished_goods'
                                ? 'success'
                                : currentOrder.receipt_type === 'semi_finished_goods'
                                  ? 'blue'
                                  : 'warning'
                          }
                        >
                          {INBOUND_RECEIPT_TYPE_LABELS[currentOrder.receipt_type as InboundReceiptType] || '入库单'}
                        </Tag>
                      ),
                    },
                    {
                      key: 'status',
                      label: '状态',
                      children: (
                        <Tag
                          color={
                            currentOrder.status === '已完成' ||
                            currentOrder.status === '已入库' ||
                            currentOrder.status === '已退料'
                              ? 'success'
                              : currentOrder.status === '已确认' || currentOrder.status === '待退料'
                                ? 'processing'
                                : currentOrder.status === '已取消'
                                  ? 'error'
                                  : 'default'
                          }
                        >
                          {currentOrder.status ?? '-'}
                        </Tag>
                      ),
                    },
                    ...(currentOrder.supplier_name
                      ? [{ key: 'supplier', label: '供应商', children: currentOrder.supplier_name }]
                      : []),
                    ...(currentOrder.purchase_order_code
                      ? [{ key: 'po', label: '采购单号', children: currentOrder.purchase_order_code }]
                      : []),
                    ...(currentOrder.work_order_code
                      ? [{ key: 'wo', label: '工单号', children: currentOrder.work_order_code }]
                      : []),
                    ...(currentOrder.picking_code
                      ? [{ key: 'pick', label: '领料单号', children: currentOrder.picking_code }]
                      : []),
                    ...(currentOrder.workshop_name
                      ? [{ key: 'ws', label: '车间', children: currentOrder.workshop_name }]
                      : []),
                    {
                      key: 'wh',
                      label: '仓库',
                      children: currentOrder.warehouse_name ?? '-',
                    },
                    {
                      key: 'date',
                      label: '日期',
                      children: formatInboundDateDisplay(currentOrder),
                    },
                    {
                      key: 'op',
                      label: '操作员',
                      children: currentOrder.received_by || currentOrder.returner_name || '-',
                    },
                  ]}
                />
                {currentOrder.receipt_type === 'purchase' &&
                hasCustomFieldsDetailContent(purchaseReceiptListCustomFields, purchaseReceiptDetailCustomFieldValues) ? (
                  <div style={{ marginTop: 16 }}>
                    <CustomFieldsDetailSection
                      customFields={purchaseReceiptListCustomFields}
                      customFieldValues={purchaseReceiptDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                {currentOrder.receipt_type === 'production_return' &&
                hasCustomFieldsDetailContent(
                  productionReturnListCustomFields,
                  productionReturnDetailCustomFieldValues,
                ) ? (
                  <div style={{ marginTop: 16 }}>
                    <CustomFieldsDetailSection
                      customFields={productionReturnListCustomFields}
                      customFieldValues={productionReturnDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                {currentOrder.receipt_type === 'finished_goods' &&
                hasCustomFieldsDetailContent(
                  finishedGoodsReceiptListCustomFields,
                  finishedGoodsReceiptDetailCustomFieldValues,
                ) ? (
                  <div style={{ marginTop: 16 }}>
                    <CustomFieldsDetailSection
                      customFields={finishedGoodsReceiptListCustomFields}
                      customFieldValues={finishedGoodsReceiptDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                {currentOrder.notes ? (
                  <Descriptions
                    column={3}
                    size="small"
                    style={{ marginTop: 16 }}
                    items={[{ key: 'notes', label: '备注', span: 3, children: currentOrder.notes }]}
                  />
                ) : null}
                {currentOrder.receipt_type === 'purchase' ? (
                  <div style={{ marginTop: 16 }}>
                    <Typography.Text strong>附件</Typography.Text>
                    {isEditablePurchaseReceipt(currentOrder) ? (
                      <Upload
                        fileList={purchaseReceiptAttachments}
                        onChange={({ fileList }) => setPurchaseReceiptAttachments(fileList)}
                        customRequest={async (options) => {
                          try {
                            const res = await uploadMultipleFiles([options.file as File], {
                              category: 'purchase_receipt_attachments',
                            });
                            options.onSuccess?.(res[0], options.file as any);
                          } catch (err) {
                            options.onError?.(err as Error);
                          }
                        }}
                        multiple
                        style={{ marginTop: 8, display: 'block' }}
                      >
                        <Button>上传附件</Button>
                      </Upload>
                    ) : (currentOrder.attachments?.length ?? 0) > 0 ? (
                      <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                        {(currentOrder.attachments ?? []).map((file) => (
                          <li key={file.uid ?? file.name}>
                            <a href={file.url} target="_blank" rel="noreferrer">
                              {file.name ?? '附件'}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        暂无附件
                      </Typography.Text>
                    )}
                  </div>
                ) : null}
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getInboundLifecycle(currentOrder);
                    const mainStages = lifecycle.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  {(() => {
                    const trackingType = inboundDocumentTrackingType(currentOrder);
                    if (!trackingType || currentOrder.id == null) return null;
                    return (
                    <DetailDrawerInlineFullChain
                      documentType={trackingType}
                      documentId={currentOrder.id}
                      active={detailDrawerVisible}
                      selfDocumentId={currentOrder.id}
                      renderBriefActions={(doc) => (
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
                )}
                    />
                    );
                  })()}
                </div>
              </DetailDrawerSection>

              {currentOrder.receipt_type === 'purchase' && currentOrder.id ? (
                <DetailDrawerSection title="来料检验 (IQC)">
                  <LinkedIqcPanel
                    purchaseReceiptId={currentOrder.id}
                    active={detailDrawerVisible}
                    onNavigate={(path) => {
                      setDetailDrawerVisible(false);
                      navigate(path);
                    }}
                  />
                </DetailDrawerSection>
              ) : null}

              <DetailDrawerSection
                title={currentOrder.receipt_type === 'production_return' ? '退料明细' : '明细信息'}
              >
                <style>{`
                  .inbound-detail-drawer-items .ant-table-wrapper .ant-table-body,
                  .inbound-detail-drawer-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                `}</style>
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                {currentOrder.items && currentOrder.items.length > 0 ? (
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
                              { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                              { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                              {
                                title: '单位',
                                dataIndex: 'material_unit',
                                width: 72,
                                render: (_: unknown, row: InboundOrderItem) => renderInboundDetailUnitCell(row),
                              },
                              {
                                title: '退料数量',
                                dataIndex: 'return_quantity',
                                width: 100,
                                align: 'right' as const,
                              },
                              { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
                              { title: '库位', dataIndex: 'location_code', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                              { title: '批次号', dataIndex: 'batch_number', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                            ]
                          : currentOrder.receipt_type === 'purchase'
                            ? [
                                { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                                { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                                {
                                  title: '实际数量',
                                  dataIndex: 'receipt_quantity',
                                  width: 140,
                                  align: 'right' as const,
                                  render: (_: any, row: InboundOrderItem) => {
                                    const editable = isEditablePurchaseReceipt(currentOrder) && row.id != null;
                                    if (!editable) return Number(row.receipt_quantity ?? 0);
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
                                  title: '单位',
                                  dataIndex: 'material_unit',
                                  width: 72,
                                  render: (_: unknown, row: InboundOrderItem) => renderInboundDetailUnitCell(row),
                                },
                                { title: '单价', dataIndex: 'unit_price', width: 90, align: 'right' as const },
                                { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right' as const },
                                { title: '库位', dataIndex: 'location_code', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                                { title: '批次号', dataIndex: 'batch_number', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                                {
                                  title: '序列号',
                                  dataIndex: 'serial_numbers',
                                  width: 88,
                                  render: (v: unknown) => renderInboundDetailSerialCell(v),
                                },
                              ]
                            : [
                                { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                                { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                                {
                                  title: '数量',
                                  dataIndex: 'receipt_quantity',
                                  width: 100,
                                  align: 'right' as const,
                                },
                                {
                                  title: '单位',
                                  dataIndex: 'material_unit',
                                  width: 72,
                                  render: (_: unknown, row: InboundOrderItem) => renderInboundDetailUnitCell(row),
                                },
                                { title: '库位', dataIndex: 'location_code', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                                { title: '批次号', dataIndex: 'batch_number', width: 100, ellipsis: true, render: (v: unknown) => (v ? String(v) : '—') },
                              ]
                      }
                      dataSource={currentOrder.items}
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
                )}
              </DetailDrawerSection>

              {currentOrder?.id != null && (
                <DetailDrawerSection title="操作记录">
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
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                  )}
                </DetailDrawerSection>
              )}
            </>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default InboundPage;
