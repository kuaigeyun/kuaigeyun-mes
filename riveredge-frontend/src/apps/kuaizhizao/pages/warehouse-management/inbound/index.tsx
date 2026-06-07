/**
 * 入库管理页面
 *
 * 提供入库单的管理功能，支持多种入库类型：采购入库、成品入库（产品入库）、生产退料等。
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormItem } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Row, Col, Form as AntForm, InputNumber, Input, Typography, Select, Spin, Descriptions, Empty, theme as AntdTheme, Dropdown } from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  InboxOutlined,
  ShoppingOutlined,
  RollbackOutlined,
  DownOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { MaterialUnitSelect, prefetchMaterialsForUnitSelect, materialCache } from '../../../../../components/material-unit-select';
import type { Material } from '../../../../master-data/types/material';
import { useTranslation } from 'react-i18next';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../WarehouseTraceBriefFooter';
import CodeField from '../../../../../components/code-field';
import dayjs from 'dayjs';
import { warehouseApi, workOrderApi } from '../../../services/production';
import { LinkedIqcPanel } from '../../quality-management/components/LinkedInspectionPanel';
import { getInboundLifecycle } from '../../../utils/inboundLifecycle';
import {
  warehouseApi as masterWarehouseApi,
  storageAreaApi,
  storageLocationApi,
} from '../../../../master-data/services/warehouse';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import { getPurchaseOrder, listPurchaseOrders, pushPurchaseOrderToReceipt } from '../../../services/purchase';
import { receiptNoticeApi } from '../../../services/receipt-notice';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { materialApi, materialBatchApi } from '../../../../master-data/services/material';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { buildKuaizhizaoPullCreateMenuItems, getKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

// 统一的入库单接口（结合采购入库、成品入库、生产退料）
interface InboundOrder {
  id?: number;
  tenant_id?: number;
  receipt_code?: string;
  return_code?: string;
  receipt_type?: 'purchase' | 'finished_goods' | 'semi_finished_goods' | 'production_return';
  status?: string;
  receipt_date?: string;
  return_time?: string;
  supplier_id?: number;
  supplier_name?: string;
  work_order_id?: number;
  work_order_code?: string;
  picking_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  workshop_name?: string;
  received_by?: string;
  returner_name?: string;
  total_quantity?: number;
  total_items?: number;
  notes?: string;
  review_status?: string;
  purchase_order_id?: number;
  purchase_order_code?: string;
  created_at?: string;
  updated_at?: string;
  items?: InboundOrderItem[];
  [key: string]: any;
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
  status?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  location_id?: number;
  location_code?: string;
}

type PullReceiptNoticeCandidate = {
  id: number;
  notice_code?: string;
  purchase_order_code?: string;
  supplier_name?: string;
  warehouse_name?: string;
  status?: string;
  updated_at?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  converted?: boolean;
};

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

const INBOUND_DETAIL_ITEMS_MIN_WIDTH = 1100;

function inboundDocumentTrackingType(
  order: InboundOrder
):
  | 'purchase_receipt'
  | 'finished_goods_receipt'
  | 'semi_finished_goods_receipt'
  | 'production_return' {
  if (order.receipt_type === 'purchase') return 'purchase_receipt';
  if (order.receipt_type === 'finished_goods') return 'finished_goods_receipt';
  if (order.receipt_type === 'semi_finished_goods') return 'semi_finished_goods_receipt';
  return 'production_return';
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
  return (
    s === '已入库' ||
    s === '已完成' ||
    sl === 'completed' ||
    sl === 'posted'
  );
}

function renderInboundRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

const InboundPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const pullFromReceiptNoticeAction = getKuaizhizaoDocumentAction('purchase_receipt.pull_from_receipt_notice');
  const pullFromPurchaseOrderAction = getKuaizhizaoDocumentAction('inbound.pull_from_purchase_order');
  const pullFromWorkOrderAction = getKuaizhizaoDocumentAction('inbound.pull_from_work_order');
  const navigate = useNavigate();
  const { token } = AntdTheme.useToken();
  const inboundDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  // Modal 相关状态（创建入库单）
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [inboundType, setInboundType] = useState<string>('purchase');

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<InboundOrder | null>(null);
  const [inboundTrackingRefreshKey, setInboundTrackingRefreshKey] = useState(0);
  const [editableReceiptQuantities, setEditableReceiptQuantities] = useState<Record<number, number>>({});
  const [savingPurchaseReceipt, setSavingPurchaseReceipt] = useState(false);

  /** 采购入库确认前预览：仓库、明细数量与批号 */
  const [purchaseConfirmPreviewOpen, setPurchaseConfirmPreviewOpen] = useState(false);
  const [purchaseConfirmPreviewLoading, setPurchaseConfirmPreviewLoading] = useState(false);
  const [purchaseConfirmPreviewSubmitting, setPurchaseConfirmPreviewSubmitting] = useState(false);
  const [purchaseConfirmPreviewDetail, setPurchaseConfirmPreviewDetail] = useState<InboundOrder | null>(null);
  /** 行级入库仓库、库位（确认预览） */
  const [purchaseConfirmLineWh, setPurchaseConfirmLineWh] = useState<Record<number, number>>({});
  const [purchaseConfirmLineLoc, setPurchaseConfirmLineLoc] = useState<Record<number, number | undefined>>({});
  /** 与库位主数据一致的编码，写入明细 location_code */
  const [purchaseConfirmLineLocCode, setPurchaseConfirmLineLocCode] = useState<Record<number, string>>({});
  const [locOptionsByWarehouse, setLocOptionsByWarehouse] = useState<
    Record<number, { value: number; label: string; code: string }[]>
  >({});
  const [purchaseConfirmPreviewQty, setPurchaseConfirmPreviewQty] = useState<Record<number, number>>({});
  const [purchaseConfirmPreviewBatch, setPurchaseConfirmPreviewBatch] = useState<Record<number, string>>({});
  const [purchaseConfirmWarehouseOptions, setPurchaseConfirmWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);

  // 批量入库 Modal
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchForm] = AntForm.useForm();
  const [batchInboundType, setBatchInboundType] = useState<'finished_goods' | 'purchase'>('finished_goods');
  const [workOrderOptions, setWorkOrderOptions] = useState<{ label: string; value: number }[]>([]);
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState<{ label: string; value: number }[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [pullFromReceiptNoticeVisible, setPullFromReceiptNoticeVisible] = useState(false);
  const [pullReceiptNoticeLoading, setPullReceiptNoticeLoading] = useState(false);
  const [pullReceiptNoticeSubmitting, setPullReceiptNoticeSubmitting] = useState(false);
  const [pullReceiptNoticeKeyword, setPullReceiptNoticeKeyword] = useState('');
  const [pullReceiptNoticeCandidates, setPullReceiptNoticeCandidates] = useState<PullReceiptNoticeCandidate[]>([]);
  const [selectedPullReceiptNoticeId, setSelectedPullReceiptNoticeId] = useState<number | null>(null);

  // 新建入库单：仓库、供应商选项
  const [createWarehouseOptions, setCreateWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [purchaseSourceType, setPurchaseSourceType] = useState<'purchase_order' | 'receipt_notice'>('purchase_order');
  const [purchaseSourceOptions, setPurchaseSourceOptions] = useState<{ label: string; value: number }[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

  const inboundDocTrackingType = currentOrder
    ? inboundDocumentTrackingType(currentOrder)
    : undefined;
  const inboundTracking = useDocumentTracking(inboundDocTrackingType, currentOrder?.id, inboundTrackingRefreshKey);

  const defaultPurchaseItem = {
    purchase_order_item_id: 0,
    material_id: undefined,
    material_code: '',
    material_name: '',
    material_unit: '',
    receipt_quantity: 1,
    unit_price: 0,
    qualified_quantity: 1,
    unqualified_quantity: 0,
  };

  const appendPurchaseInboundItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        ...defaultPurchaseItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const handleCreate = () => {
    setInboundType('purchase');
    setCreateModalVisible(true);
  };

  useNewShortcut(handleCreate);

  /** 新建入库单：加载仓库、供应商 */
  useEffect(() => {
    if (!createModalVisible) return;
    const load = async () => {
      try {
        const [whRes, supRes] = await Promise.all([
          masterWarehouseApi.list({ is_active: true, limit: 500 }),
          supplierApi.list({ limit: 500 }),
        ]);
        const whList = Array.isArray(whRes) ? whRes : (whRes as any)?.data ?? (whRes as any)?.items ?? whRes ?? [];
        setCreateWarehouseOptions(
          (Array.isArray(whList) ? whList : []).map((w: any) => ({
            label: `${w.code || ''} ${w.name || ''}`.trim() || String(w.id),
            value: w.id,
            name: w.name || '',
          }))
        );
        const supList = Array.isArray(supRes) ? supRes : (supRes as any)?.data ?? (supRes as any)?.items ?? supRes ?? [];
        setSupplierOptions(
          (Array.isArray(supList) ? supList : []).map((s: any) => ({
            label: `${s.code || ''} ${s.name || ''}`.trim() || String(s.id ?? s.uuid),
            value: s.id,
            name: s.name || '',
          }))
        );
      } catch {
        setCreateWarehouseOptions([]);
        setSupplierOptions([]);
      }
    };
    load();
  }, [createModalVisible]);

  useEffect(() => {
    if (!createModalVisible || inboundType !== 'purchase') return;
    const loadSources = async () => {
      try {
        setSourceLoading(true);
        if (purchaseSourceType === 'purchase_order') {
          const poRes = await listPurchaseOrders({ skip: 0, limit: 500 });
          const poData = (poRes as any)?.data ?? (poRes as any)?.items ?? poRes ?? [];
          const poList = Array.isArray(poData) ? poData : [];
          const eligible = poList.filter((po: any) => ['已审核', '已确认', 'AUDITED', 'CONFIRMED'].includes(po.status));
          setPurchaseSourceOptions(
            eligible.map((po: any) => ({
              value: Number(po.id),
              label: `${po.order_code || po.code || po.id} - ${po.supplier_name || '-'}`,
            }))
          );
        } else {
          const rnRes = await receiptNoticeApi.list({ skip: 0, limit: 500 });
          const rnData = (rnRes as any)?.data ?? (rnRes as any)?.items ?? rnRes ?? [];
          const rnList = Array.isArray(rnData) ? rnData : [];
          const eligible = rnList.filter((n: any) => ['待收货', '已通知'].includes(n.status));
          setPurchaseSourceOptions(
            eligible.map((n: any) => ({
              value: Number(n.id),
              label: `${n.notice_code || n.id} - ${n.supplier_name || '-'}`,
            }))
          );
        }
      } catch {
        setPurchaseSourceOptions([]);
      } finally {
        setSourceLoading(false);
      }
    };
    loadSources();
  }, [createModalVisible, inboundType, purchaseSourceType]);

  const loadPurchaseBySource = async () => {
    if (inboundType !== 'purchase') return;
    const sourceId = formRef.current?.getFieldValue?.('source_id');
    if (!sourceId) {
      messageApi.warning('请先选择源单据');
      return;
    }
    try {
      setSourceLoading(true);
      if (purchaseSourceType === 'purchase_order') {
        const detail: any = await getPurchaseOrder(Number(sourceId));
        const mappedItems = (detail.items || [])
          .filter((it: any) => Number(it.outstanding_quantity ?? it.ordered_quantity ?? 0) > 0)
          .map((it: any) => ({
            purchase_order_item_id: Number(it.id || 0),
            material_id: Number(it.material_id),
            material_code: it.material_code || '',
            material_name: it.material_name || '',
            material_spec: it.material_spec || '',
            material_unit: it.unit || '个',
            receipt_quantity: Number(it.outstanding_quantity ?? it.ordered_quantity ?? 0),
            unit_price: Number(it.unit_price ?? 0),
            qualified_quantity: Number(it.outstanding_quantity ?? it.ordered_quantity ?? 0),
            unqualified_quantity: 0,
          }));
        if (!mappedItems.length) {
          messageApi.warning('该采购单暂无可入库明细');
          return;
        }
        formRef.current?.setFieldsValue?.({
          purchase_order_id: Number(detail.id || 0),
          purchase_order_code: detail.order_code || '',
          supplier_id: detail.supplier_id,
          items: mappedItems,
          notes: detail.notes || undefined,
        });
      } else {
        const detail: any = await receiptNoticeApi.get(String(sourceId));
        const mappedItems = (detail.items || [])
          .filter((it: any) => Number(it.notice_quantity ?? 0) > 0)
          .map((it: any) => ({
            purchase_order_item_id: Number(it.purchase_order_item_id || 0),
            material_id: Number(it.material_id),
            material_code: it.material_code || '',
            material_name: it.material_name || '',
            material_spec: it.material_spec || '',
            material_unit: it.material_unit || '个',
            receipt_quantity: Number(it.notice_quantity ?? 0),
            unit_price: Number(it.unit_price ?? 0),
            qualified_quantity: Number(it.notice_quantity ?? 0),
            unqualified_quantity: 0,
          }));
        if (!mappedItems.length) {
          messageApi.warning('该收货通知单暂无可入库明细');
          return;
        }
        formRef.current?.setFieldsValue?.({
          purchase_order_id: Number(detail.purchase_order_id || 0),
          purchase_order_code: detail.purchase_order_code || '',
          warehouse_id: detail.warehouse_id || undefined,
          supplier_id: detail.supplier_id,
          items: mappedItems,
          notes: detail.notes || undefined,
        });
      }
      messageApi.success('已按源单据载入入库明细');
    } catch (e: any) {
      messageApi.error(e?.message || e?.response?.data?.detail || '载入源单据失败');
    } finally {
      setSourceLoading(false);
    }
  };

  /** 批量入库：加载工单、采购订单、仓库 */
  useEffect(() => {
    if (!batchModalVisible) return;
    const load = async () => {
      try {
        const [woRes, poRes, whRes] = await Promise.all([
          workOrderApi.list({ skip: 0, limit: 500 }),
          listPurchaseOrders({ skip: 0, limit: 500 }),
          masterWarehouseApi.list({ is_active: true }),
        ]);
        const woList = Array.isArray(woRes) ? woRes : (woRes as any)?.data ?? (woRes as any)?.items ?? [];
        const eligibleWo = woList.filter(
          (wo: any) => ['进行中', '已完成', 'in_progress', 'completed'].includes(wo.status)
        );
        setWorkOrderOptions(
          eligibleWo.map((wo: any) => ({
            label: `${wo.code || wo.id} - ${wo.product_name || wo.name || '-'}`,
            value: wo.id,
          }))
        );
        const poData = (poRes as any)?.data ?? (poRes as any)?.items ?? poRes ?? [];
        const poList = Array.isArray(poData) ? poData : [];
        const eligiblePo = poList.filter(
          (po: any) => ['已审核', '已确认', 'AUDITED', 'CONFIRMED'].includes(po.status)
        );
        setPurchaseOrderOptions(
          eligiblePo.map((po: any) => ({
            label: `${po.order_code || po.code || po.id} - ${po.supplier_name || '-'}`,
            value: po.id,
          }))
        );
        const whList = Array.isArray(whRes) ? whRes : (whRes as any)?.data ?? (whRes as any)?.items ?? whRes ?? [];
        setWarehouseOptions(
          (Array.isArray(whList) ? whList : []).map((w: any) => ({
            label: `${w.code || ''} ${w.name || ''}`.trim() || String(w.id),
            value: w.id,
            name: w.name || '',
          }))
        );
      } catch {
        setWorkOrderOptions([]);
        setPurchaseOrderOptions([]);
        setWarehouseOptions([]);
      }
    };
    load();
  }, [batchModalVisible]);

  /** 批量入库提交 */
  const handleBatchSubmit = async () => {
    try {
      const values = await batchForm.validateFields();
      const type = values.batch_inbound_type || batchInboundType;
      setBatchSubmitting(true);

      if (type === 'purchase') {
        const orderIds = values.purchase_order_ids as number[];
        if (!orderIds?.length) {
          messageApi.warning('请选择至少一个采购订单');
          return;
        }
        let success = 0;
        for (const id of orderIds) {
          try {
            await pushPurchaseOrderToReceipt(id);
            success++;
          } catch (e: any) {
            messageApi.warning(`采购订单 ${id} 下推失败：${e?.message || e?.response?.data?.detail || '未知错误'}`);
          }
        }
        messageApi.success(`批量采购入库成功，共创建 ${success} 张采购入库单`);
      } else {
        const workOrderIds = values.work_order_ids as number[];
        const warehouseId = values.warehouse_id as number;
        const wh = warehouseOptions.find((w) => w.value === warehouseId);
        if (!workOrderIds?.length) {
          messageApi.warning('请选择至少一个工单');
          return;
        }
        if (!warehouseId) {
          messageApi.warning('请选择入库仓库');
          return;
        }
        const result = await warehouseApi.finishedGoodsReceipt.batchReceipt({
          work_order_ids: workOrderIds,
          warehouse_id: warehouseId,
          warehouse_name: wh?.name,
        });
        const list = Array.isArray(result) ? result : (result as any)?.data ?? (result as any)?.items ?? [];
        const semiN = list.filter((r: any) => r?.inbound_doc_kind === 'semi_finished_goods').length;
        const fgN = list.length - semiN;
        messageApi.success(
          `批量生产入库成功，共 ${list.length} 张（成品 ${fgN}、半成品 ${semiN}，按 BOM 子件角色自动分流）`
        );
      }
      setBatchModalVisible(false);
      batchForm.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || e?.response?.data?.detail || '批量入库失败');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const loadPullReceiptNoticeCandidates = useCallback(async (keyword: string = '') => {
    setPullReceiptNoticeLoading(true);
    try {
      const kw = keyword.trim().toLowerCase();
      const rnRes = await receiptNoticeApi.list({ skip: 0, limit: 500 });
      const rnData = (rnRes as any)?.data ?? (rnRes as any)?.items ?? rnRes ?? [];
      const rnList = Array.isArray(rnData) ? rnData : [];
      const candidates = rnList
        .filter((n: any) => ['待收货', '已通知'].includes(String(n?.status || '')))
        .filter((n: any) => {
          if (!kw) return true;
          const text = `${n.notice_code || ''} ${n.purchase_order_code || ''} ${n.supplier_name || ''}`.toLowerCase();
          return text.includes(kw);
        })
        .map((n: any) => ({
          id: Number(n.id),
          notice_code: n.notice_code,
          purchase_order_code: n.purchase_order_code,
          supplier_name: n.supplier_name,
          warehouse_name: n.warehouse_name,
          status: n.status,
          updated_at: n.updated_at,
          purchase_receipt_id: n.purchase_receipt_id,
          purchase_receipt_code: n.purchase_receipt_code,
          converted: !!n.purchase_receipt_id,
        }));
      setPullReceiptNoticeCandidates(candidates);
    } catch {
      setPullReceiptNoticeCandidates([]);
    } finally {
      setPullReceiptNoticeLoading(false);
    }
  }, []);

  const handlePullFromReceiptNotice = useCallback(async () => {
    setPullFromReceiptNoticeVisible(true);
    setPullReceiptNoticeKeyword('');
    setSelectedPullReceiptNoticeId(null);
    await loadPullReceiptNoticeCandidates('');
  }, [loadPullReceiptNoticeCandidates]);

  const handlePullFromReceiptNoticeConfirm = useCallback(async () => {
    if (!selectedPullReceiptNoticeId) {
      messageApi.warning(`请选择${pullFromReceiptNoticeAction.sourceLabel}`);
      return;
    }
    const selected = pullReceiptNoticeCandidates.find((x) => x.id === selectedPullReceiptNoticeId);
    if (selected?.converted) {
      messageApi.warning(`该${pullFromReceiptNoticeAction.sourceLabel}已创建${pullFromReceiptNoticeAction.targetLabel}，请勿重复创建`);
      return;
    }
    setPullReceiptNoticeSubmitting(true);
    try {
      const created: any = await warehouseApi.purchaseReceipt.pullFromReceiptNotice({
        receipt_notice_id: selectedPullReceiptNoticeId,
      });
      messageApi.success(`已从${pullFromReceiptNoticeAction.sourceLabel}创建${pullFromReceiptNoticeAction.targetLabel}${created?.receipt_code ? `：${created.receipt_code}` : ''}`);
      setPullFromReceiptNoticeVisible(false);
      setSelectedPullReceiptNoticeId(null);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message =
        (typeof detail === 'string' ? detail : detail?.message) ||
        error?.message ||
        `从${pullFromReceiptNoticeAction.sourceLabel}创建${pullFromReceiptNoticeAction.targetLabel}失败`;
      messageApi.error(message);
    } finally {
      setPullReceiptNoticeSubmitting(false);
    }
  }, [actionRef, invalidateMenuBadgeCounts, messageApi, pullReceiptNoticeCandidates, selectedPullReceiptNoticeId]);

  /**
   * 处理查看详情
   */
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
      }
      if (detailData) {
        await prefetchMaterialsForUnitSelect((detailData.items || []).map((it: any) => it?.material_id));
        if (record.receipt_type === 'purchase') {
          const quantities: Record<number, number> = {};
          (detailData.items || []).forEach((it: any) => {
            if (it?.id != null) quantities[it.id] = Number(it.receipt_quantity ?? 0);
          });
          setEditableReceiptQuantities(quantities);
        } else {
          setEditableReceiptQuantities({});
        }
        setCurrentOrder({ ...detailData, receipt_type: record.receipt_type });
        setDetailDrawerVisible(true);
        setInboundTrackingRefreshKey((k) => k + 1);
      }
    } catch {
      messageApi.error('获取入库单详情失败');
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
    setPurchaseConfirmLineWh({});
    setPurchaseConfirmLineLoc({});
    setPurchaseConfirmLineLocCode({});
    setLocOptionsByWarehouse({});
  };

  /** 打开采购入库确认预览（加载最新详情，合并抽屉内未保存的实际数量） */
  const openConfirmPreview = async (record: InboundOrder) => {
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
      await prefetchMaterialsForUnitSelect((detailData.items || []).map((it: any) => it?.material_id));
      setPurchaseConfirmWarehouseOptions(
        (Array.isArray(whList) ? whList : []).map((w: any) => ({
          label: `${w.code || ''} ${w.name || ''}`.trim() || String(w.id),
          value: w.id,
          name: w.name || '',
        }))
      );
      const qty: Record<number, number> = {};
      const batch: Record<number, string> = {};
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
        qty[id] = fromDrawer != null ? Number(fromDrawer) : Number(it.receipt_quantity ?? 0);
        batch[id] = String(it.batch_number ?? '');
        let rowWh =
          it.warehouse_id != null && Number(it.warehouse_id) > 0 ? Number(it.warehouse_id) : undefined;
        
        if (rowWh == null && it.material_id) {
          const material = materialCache[String(it.material_id)];
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

        if (rowWh != null) lineWh[id] = rowWh;
        if (it.location_id != null && Number(it.location_id) > 0) lineLoc[id] = Number(it.location_id);
        if (it.location_code) lineLocLb[id] = String(it.location_code);
      });
      setPurchaseConfirmPreviewDetail({ ...detailData, receipt_type: record.receipt_type });
      setPurchaseConfirmLineWh(lineWh);
      setPurchaseConfirmLineLoc(lineLoc);
      setPurchaseConfirmLineLocCode(lineLocLb);
      setLocOptionsByWarehouse({});
      setPurchaseConfirmPreviewQty(qty);
      const batchPrefilled = await prefetchPurchasePreviewBatchNumbers(detailData.items, batch);
      setPurchaseConfirmPreviewBatch(batchPrefilled);
      const uniqueWh = [...new Set(Object.values(lineWh))];
      await Promise.all(
        uniqueWh.map(async (wid) => {
          const opts = await fetchStorageLocationsForWarehouse(wid);
          setLocOptionsByWarehouse((prev) => ({ ...prev, [wid]: opts }));
        })
      );
    } catch {
      messageApi.error('加载入库单详情失败');
      resetPurchaseConfirmPreview();
    } finally {
      setPurchaseConfirmPreviewLoading(false);
    }
  };

  const submitConfirmPreview = async () => {
    const order = purchaseConfirmPreviewDetail;
    if (!order?.id) return;
    const items = (order.items || []) as InboundOrderItem[];
    if (!items.length) {
      messageApi.warning('暂无可入库明细');
      return;
    }
    let mappedItems: any[];
    try {
      mappedItems = items
        .filter((it) => it.material_id != null)
        .map((it) => {
          const rowId = Number(it.id);
          const qty = Number(purchaseConfirmPreviewQty[rowId] ?? it.receipt_quantity ?? 0);
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
          const locId = purchaseConfirmLineLoc[rowId];
          const locCode = purchaseConfirmLineLocCode[rowId];
          return {
            item_id: Number(refIt.id),
            warehouse_id: lineWh,
            warehouse_name: whOpt?.name ?? '',
            location_id: locId != null && locId > 0 ? locId : undefined,
            location_code: locCode || undefined,
            batch_number: batchStr || undefined,
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
      }
      messageApi.success('入库确认成功，库存已更新');
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
      record.receipt_type === 'purchase'
        ? '采购入库单'
        : record.receipt_type === 'finished_goods'
          ? '成品入库单'
          : record.receipt_type === 'semi_finished_goods'
            ? '半成品入库单'
            : '生产退料单';
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
    if (record.receipt_type === 'purchase' && record.supplier_name) {
      return String(record.supplier_name);
    }
    if (record.work_order_code) return String(record.work_order_code);
    if (record.picking_code) return String(record.picking_code);
    if (record.warehouse_name) return String(record.warehouse_name);
    return '入库单';
  };

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
      valueEnum: {
        purchase: { text: '采购入库', status: 'processing' },
        finished_goods: { text: '成品入库', status: 'success' },
        semi_finished_goods: { text: '半成品入库', status: 'default' },
        production_return: { text: '生产退料', status: 'warning' },
      },
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
      render: (_, record) => record.receipt_date || record.return_time || '-',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
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
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const st = inboundRowStatus(record);
        const stLower = st.toLowerCase();
        const posted = isInboundStockPosted(record);
        const pending =
          !posted &&
          (stLower === 'draft' ||
            st === '草稿' ||
            st === '待入库' ||
            st === '待退料');
        const nodes: React.ReactNode[] = [
          <Button
            key="detail"
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>,
        ];
        if (pending) {
          nodes.push(
            <Button
              key="confirm"
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record)}
              style={{ color: '#52c41a' }}
            >
              {record.receipt_type === 'production_return' ? '确认退料' : '确认入库'}
            </Button>
          );
          if (
            record.receipt_type === 'production_return' ||
            record.receipt_type === 'purchase' ||
            record.receipt_type === 'finished_goods' ||
            record.receipt_type === 'semi_finished_goods'
          ) {
            nodes.push(
              <Button
                key="delete"
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              >
                删除
              </Button>
            );
          }
        }
        if (posted) {
          nodes.push(
            <Button
              key="withdraw"
              type="link"
              size="small"
              danger
              icon={<RollbackOutlined />}
              onClick={() => handleWithdrawInbound(record)}
            >
              {record.receipt_type === 'production_return' ? '撤回退料' : '撤回入库'}
            </Button>
          );
        }
        return renderInboundRowActions(nodes, `inbound-${record.receipt_type}-${record.id}`);
      },
    },
  ];

  const handleFormFinish = async (values: any) => {
    try {
      if (values.type === 'purchase' || inboundType === 'purchase') {
        const items = (values.items ?? []).filter(
          (it: any) => it.material_id && (Number(it.receipt_quantity) || 0) > 0
        );
        if (items.length === 0) {
          messageApi.warning('请至少添加一条有效物料明细');
          throw new Error('请至少添加一条有效物料明细');
        }
        const wh = createWarehouseOptions.find((w) => w.value === values.warehouse_id);
        const sup = supplierOptions.find((s) => s.value === values.supplier_id);
        if (!wh || !sup) {
          messageApi.warning('请选择入库仓库和供应商');
          throw new Error('请选择入库仓库和供应商');
        }
        const payload = {
          receipt_code: values.receipt_code || undefined,
          purchase_order_id: values.purchase_order_id ?? 0,
          purchase_order_code: values.purchase_order_code || '手动',
          supplier_id: sup.value,
          supplier_name: sup.name,
          warehouse_id: wh.value,
          warehouse_name: wh.name,
          notes: values.notes,
          items: items.map((it: any) => ({
            purchase_order_item_id: it.purchase_order_item_id ?? 0,
            material_id: it.material_id,
            material_code: it.material_code,
            material_name: it.material_name,
            material_spec: it.material_spec || undefined,
            material_unit: it.material_unit || '个',
            receipt_quantity: Number(it.receipt_quantity) || 0,
            unit_price: Number(it.unit_price) || 0,
            qualified_quantity: Number(it.qualified_quantity ?? it.receipt_quantity ?? 0) || 0,
            unqualified_quantity: Number(it.unqualified_quantity ?? 0) || 0,
          })),
        };
        await warehouseApi.purchaseReceipt.create(payload);
      }
      messageApi.success('入库单创建成功');
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.message !== '请至少添加一条有效物料明细') {
        messageApi.error(error?.message || error?.response?.data?.detail || '操作失败');
      }
      throw error;
    }
  };

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
            const skip = ((params.current || 1) - 1) * (params.pageSize || 20);
            const limit = params.pageSize || 20;
            const listParams = { skip, limit, ...params, keyword: (params as any).keyword };

            // 并行获取采购入库单、成品/半成品入库单、生产退料单
            const [purchaseRes, finishedRes, semiRes, returnRes] = await Promise.all([
              warehouseApi.purchaseReceipt.list(listParams),
              warehouseApi.finishedGoodsReceipt.list(listParams),
              warehouseApi.semiFinishedGoodsReceipt.list(listParams),
              warehouseApi.productionReturn.list(listParams),
            ]);

            // 后端可能直接返回数组，或 { data/items: [] } 格式
            const toList = (r: any) => (Array.isArray(r) ? r : r?.data ?? r?.items ?? []);
            const purchaseData = toList(purchaseRes).map((item: any) => ({
              ...item,
              receipt_type: 'purchase' as const,
            }));
            const finishedData = toList(finishedRes).map((item: any) => ({
              ...item,
              receipt_type: 'finished_goods' as const,
            }));
            const semiData = toList(semiRes).map((item: any) => ({
              ...item,
              receipt_type: 'semi_finished_goods' as const,
            }));
            const returnData = toList(returnRes).map((item: any) => ({
              ...item,
              receipt_type: 'production_return' as const,
              receipt_code: item.return_code,
            }));

            const combinedData = [...purchaseData, ...finishedData, ...semiData, ...returnData];
            combinedData.sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());

            const total =
              (typeof purchaseRes?.total === 'number' ? purchaseRes.total : purchaseData.length) +
              (typeof finishedRes?.total === 'number' ? finishedRes.total : finishedData.length) +
              (typeof semiRes?.total === 'number' ? semiRes.total : semiData.length) +
              (typeof returnRes?.total === 'number' ? returnRes.total : returnData.length);

            return {
              data: combinedData,
              success: true,
              total,
            };
          } catch {
            messageApi.error('获取入库单列表失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条入库单吗？`,
            onOk: async () => {
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
            },
          });
        }}
        toolBarRender={() => [
          <UniPullCreateToolbar
            compactKey="create-inbound-with-pull"
            createIcon={<PlusOutlined />}
            createLabel={'新建入库单' + NEW_SHORTCUT_HINT}
            onCreate={handleCreate}
            menuItems={buildKuaizhizaoPullCreateMenuItems([
              {
                key: 'pull-from-purchase-order',
                actionKey: 'inbound.pull_from_purchase_order',
                onClick: () => {
                  batchForm.resetFields();
                  setBatchInboundType('purchase');
                  setBatchModalVisible(true);
                },
              },
              {
                key: 'pull-from-receipt-notice',
                actionKey: 'purchase_receipt.pull_from_receipt_notice',
                onClick: () => {
                  void handlePullFromReceiptNotice();
                },
              },
              {
                key: 'pull-from-work-order',
                actionKey: 'inbound.pull_from_work_order',
                onClick: () => {
                  batchForm.resetFields();
                  setBatchInboundType('finished_goods');
                  setBatchModalVisible(true);
                },
              },
            ])}
          />,
          <Button
            key="batch"
            icon={<InboxOutlined />}
            onClick={() => {
              batchForm.resetFields();
              setBatchInboundType('finished_goods');
              setBatchModalVisible(true);
            }}
          >
            批量入库
          </Button>,
        ]}
        scroll={{ x: 2000 }}
      />

      <FormModalTemplate
        title="新建入库单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onFinish={handleFormFinish}
        isEdit={false}
        initialValues={{ type: 'purchase' }}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            {inboundType === 'purchase' && (
              <CodeField
                pageCode="kuaizhizao-purchase-receipt"
                name="receipt_code"
                label="采购入库单编号"
                required={true}
                autoGenerateOnCreate={true}
                showGenerateButton={false}
                context={{}}
              />
            )}
            {(inboundType === 'production' || inboundType === 'initial') && (
              <CodeField
                pageCode="kuaizhizao-warehouse-finished-goods-inbound"
                name="receipt_code"
                label="成品入库单编号"
                required={true}
                autoGenerateOnCreate={true}
                showGenerateButton={false}
                context={{}}
              />
            )}
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="type"
              label="入库类型"
              placeholder="请选择入库类型"
              rules={[{ required: true, message: '请选择入库类型' }]}
              options={[
                { label: '采购入库', value: 'purchase' },
                { label: '生产入库', value: 'production' },
                { label: '退货入库', value: 'return' },
                { label: '初始入库', value: 'initial' },
              ]}
              fieldProps={{
                onChange: (value: string) => setInboundType(value),
              }}
            />
          </Col>
        </Row>
        {inboundType === 'purchase' && (
          <>
            <Row gutter={16}>
              <Col span={8}>
                <ProFormSelect
                  name="source_type"
                  label="源单据类型"
                  initialValue="purchase_order"
                  options={[
                    { label: '采购单', value: 'purchase_order' },
                    { label: '收货通知单', value: 'receipt_notice' },
                  ]}
                  fieldProps={{
                    onChange: (v: 'purchase_order' | 'receipt_notice') => {
                      setPurchaseSourceType(v);
                      formRef.current?.setFieldsValue?.({ source_id: undefined });
                    },
                  }}
                />
              </Col>
              <Col span={10}>
                <ProFormSelect
                  name="source_id"
                  label="选择源单据"
                  placeholder={purchaseSourceType === 'purchase_order' ? '请选择采购单' : '请选择收货通知单'}
                  options={purchaseSourceOptions}
                  fieldProps={{
                    loading: sourceLoading,
                    showSearch: true,
                    filterOption: (i: any, o: any) => (o?.label ?? '').toString().toLowerCase().includes((i ?? '').toLowerCase()),
                  }}
                />
              </Col>
              <Col span={6}>
                <ProFormItem label=" " style={{ marginBottom: 0 }}>
                  <Button onClick={loadPurchaseBySource} loading={sourceLoading} style={{ width: '100%' }}>
                    载入源单据
                  </Button>
                </ProFormItem>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormSelect
                  name="warehouse_id"
                  label="入库仓库"
                  placeholder="请选择入库仓库"
                  rules={[{ required: true, message: '请选择入库仓库' }]}
                  options={createWarehouseOptions}
                  fieldProps={{ showSearch: true, filterOption: (i: any, o: any) => (o?.label ?? '').toString().toLowerCase().includes((i ?? '').toLowerCase()) }}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="supplier_id"
                  label="供应商"
                  placeholder="请选择供应商"
                  rules={[{ required: true, message: '请选择供应商' }]}
                  options={supplierOptions}
                  fieldProps={{ showSearch: true, filterOption: (i: any, o: any) => (o?.label ?? '').toString().toLowerCase().includes((i ?? '').toLowerCase()) }}
                />
              </Col>
            </Row>
            <div className="uni-table-detail" style={{ width: '100%' }}>
              <UniTableDetailHeader title="入库明细" required />
              <AntForm.List name="items" initialValue={[defaultPurchaseItem]}>
                {(fields, { add, remove }) => (
                    <div>
                      <Table
                        size="small"
                        pagination={false}
                        scroll={{ x: 700 }}
                        dataSource={fields}
                        rowKey={(field) => field.key}
                        columns={[
                          {
                            title: '物料',
                            dataIndex: 'material_id',
                            width: 260,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                                {({ getFieldValue }: any) => {
                                  const row = getFieldValue('items')?.[index];
                                  const mid = row?.material_id ? Number(row.material_id) : null;
                                  const fallback = mid && (row?.material_code || row?.material_name)
                                    ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                                    : undefined;
                                  return (
                                    <UniMaterialSelect
                                      name={[index, 'material_id']}
                                      label=""
                                      placeholder="请选择物料"
                                      required
                                      size="small"
                                      listFieldKey={index}
                                      listFieldName="items"
                                      fillMapping={{
                                        material_code: 'mainCode',
                                        material_name: 'name',
                                        material_unit: 'baseUnit',
                                      }}
                                      fallbackOption={fallback}
                                      formItemProps={{ style: { margin: 0 } }}
                                      showQuickCreate
                                      showAdvancedSearch
                                    />
                                  );
                                }}
                              </AntForm.Item>
                            ),
                          },
                          {
                            title: '单位',
                            dataIndex: 'material_unit',
                            width: 100,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                                {({ getFieldValue }) => {
                                  const materialId = getFieldValue(['items', index, 'material_id']);
                                  return (
                                    <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                                      <MaterialUnitSelect 
                                        materialId={materialId} 
                                        size="small" 
                                        noStyle 
                                      />
                                    </AntForm.Item>
                                  );
                                }}
                              </AntForm.Item>
                            ),
                          },
                          {
                            title: '数量',
                            dataIndex: 'receipt_quantity',
                            width: 100,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle name={[index, 'receipt_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]}>
                                <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                              </AntForm.Item>
                            ),
                          },
                          {
                            title: '单价',
                            dataIndex: 'unit_price',
                            width: 100,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle name={[index, 'unit_price']}>
                                <InputNumber placeholder="0" min={0} precision={2} style={{ width: '100%' }} size="small" />
                              </AntForm.Item>
                            ),
                          },
                          {
                            title: '操作',
                            width: 60,
                            render: (_: any, __: any, index: number) => (
                              <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                            ),
                          },
                        ]}
                      />
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%', marginTop: 8 }}>
                        <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultPurchaseItem)}>
                          添加明细
                        </Button>
                        <Button
                          type="default"
                          icon={<ShoppingOutlined />}
                          style={{ flex: 1, minWidth: 120 }}
                          onClick={() => setMaterialPickerOpen(true)}
                        >
                          {t('app.kuaizhizao.common.materialBatchSelect')}
                        </Button>
                      </div>
                    </div>
                  )}
                </AntForm.List>
            </div>
            <ProFormItem name="notes" label="备注">
              <Input.TextArea rows={2} placeholder="可选" />
            </ProFormItem>
          </>
        )}
        {(inboundType === 'production' || inboundType === 'initial' || inboundType === 'return') && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormSelect
                  name="warehouse"
                  label="入库仓库"
                  placeholder="请选择入库仓库"
                  rules={[{ required: true, message: '请选择入库仓库' }]}
                  options={[
                    { label: '原材料仓库', value: 'raw-materials' },
                    { label: '半成品仓库', value: 'semi-finished' },
                    { label: '成品仓库', value: 'finished-goods' },
                  ]}
                />
              </Col>
              <Col span={12}>
                <ProFormText name="supplier" label="供应商" placeholder="选择供应商" />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormText name="workOrder" label="关联工单" placeholder="选择工单" />
              </Col>
              <Col span={12}>
                <ProFormText
                  name="batch_number"
                  label="批号"
                  placeholder="请输入批号（批号管理物料必填）"
                  tooltip="如果所选物料启用了批号管理，此字段为必填"
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormDatePicker
                  name="expiry_date"
                  label="有效期"
                  placeholder="请选择有效期"
                  tooltip="有保质期要求的物料需要填写有效期"
                />
              </Col>
              <Col span={12} />
            </Row>
          </>
        )}
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendPurchaseInboundItemsFromMaterials}
      />

      <Modal
        title="批量入库"
        open={batchModalVisible}
        onCancel={() => setBatchModalVisible(false)}
        onOk={handleBatchSubmit}
        confirmLoading={batchSubmitting}
        width={520}
        okText="确认入库"
      >
        <p style={{ marginBottom: 16, color: '#666' }}>
          根据上游单据批量创建入库单。生产入库：从工单下推（按 BOM 子件角色自动分为成品/半成品入库单）；采购入库：从采购订单下推。
        </p>
        <AntForm form={batchForm} layout="vertical" initialValues={{ batch_inbound_type: 'finished_goods' }}>
          <AntForm.Item
            name="batch_inbound_type"
            label="入库类型"
            rules={[{ required: true }]}
          >
            <ProFormSelect
              options={[
                { label: '生产入库（从工单，成品/半成品自动分流）', value: 'finished_goods' },
                { label: '采购入库（从采购订单）', value: 'purchase' },
              ]}
              fieldProps={{
                onChange: (v: string) => setBatchInboundType(v as 'finished_goods' | 'purchase'),
              }}
            />
          </AntForm.Item>
          {batchInboundType === 'finished_goods' && (
            <>
              <AntForm.Item
                name="work_order_ids"
                label="选择工单"
                rules={[{ required: true, message: '请选择至少一个工单' }]}
              >
                <ProFormSelect
                  mode="multiple"
                  placeholder="请选择工单（进行中/已完成且有报工）"
                  options={workOrderOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </AntForm.Item>
              <AntForm.Item
                name="warehouse_id"
                label="入库仓库"
                rules={[{ required: true, message: '请选择入库仓库' }]}
              >
                <ProFormSelect
                  placeholder="请选择仓库"
                  options={warehouseOptions}
                  fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
                />
              </AntForm.Item>
            </>
          )}
          {batchInboundType === 'purchase' && (
            <AntForm.Item
              name="purchase_order_ids"
              label="选择采购订单"
              rules={[{ required: true, message: '请选择至少一个采购订单' }]}
            >
              <ProFormSelect
                mode="multiple"
                placeholder="请选择采购订单（已审核/已确认且有未入库数量）"
                options={purchaseOrderOptions}
                fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
              />
            </AntForm.Item>
          )}
        </AntForm>
      </Modal>

      <Modal
        title={pullFromReceiptNoticeAction.label}
        open={pullFromReceiptNoticeVisible}
        onCancel={() => {
          if (pullReceiptNoticeSubmitting) return;
          setPullFromReceiptNoticeVisible(false);
          setSelectedPullReceiptNoticeId(null);
        }}
        onOk={() => {
          void handlePullFromReceiptNoticeConfirm();
        }}
        confirmLoading={pullReceiptNoticeSubmitting}
        width={1240}
        okText="创建采购入库单"
        destroyOnHidden
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="按通知单号/采购订单号/供应商搜索"
            value={pullReceiptNoticeKeyword}
            onChange={(e) => setPullReceiptNoticeKeyword(e.target.value)}
            onSearch={(value) => {
              setPullReceiptNoticeKeyword(value);
              void loadPullReceiptNoticeCandidates(value);
            }}
            enterButton="搜索"
          />
          <Table<PullReceiptNoticeCandidate>
            rowKey="id"
            loading={pullReceiptNoticeLoading}
            dataSource={pullReceiptNoticeCandidates}
            pagination={false}
            scroll={{ x: 1160, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullReceiptNoticeId ? [selectedPullReceiptNoticeId] : [],
              onChange: (keys) => {
                const next = Number(keys?.[0]);
                if (Number.isFinite(next)) setSelectedPullReceiptNoticeId(next);
                else setSelectedPullReceiptNoticeId(null);
              },
              getCheckboxProps: (record) => ({ disabled: !!record.converted }),
            }}
            onRow={(record) => ({
              onClick: () => {
                if (record.converted) return;
                setSelectedPullReceiptNoticeId(record.id);
              },
            })}
            columns={[
              { title: '收货通知单号', dataIndex: 'notice_code', width: 180, ellipsis: true },
              { title: '采购订单号', dataIndex: 'purchase_order_code', width: 180, ellipsis: true },
              { title: '供应商', dataIndex: 'supplier_name', width: 180, ellipsis: true },
              { title: '目标仓库', dataIndex: 'warehouse_name', width: 150, ellipsis: true, render: (v) => v || '-' },
              { title: '通知状态', dataIndex: 'status', width: 120, align: 'center' },
              { title: '更新时间', dataIndex: 'updated_at', width: 180, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-') },
              {
                title: '转单状态',
                key: 'convert_status',
                width: 170,
                align: 'center',
                render: (_, r) =>
                  r.converted ? (
                    <Tag color="gold">{`已创建：${r.purchase_receipt_code || r.purchase_receipt_id}`}</Tag>
                  ) : (
                    <Tag color="success">可创建</Tag>
                  ),
              },
            ]}
          />
        </Space>
      </Modal>

      <Modal
        title="确认入库预览"
        open={purchaseConfirmPreviewOpen}
        onCancel={() => {
          if (!purchaseConfirmPreviewSubmitting) resetPurchaseConfirmPreview();
        }}
        onOk={submitConfirmPreview}
        confirmLoading={purchaseConfirmPreviewSubmitting}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        okText="确认入库"
        destroyOnHidden
      >
        <Spin spinning={purchaseConfirmPreviewLoading}>
          <p style={{ marginBottom: 12, color: '#666' }}>
            请逐行核对入库仓库、库位（可选）与明细数量、批号后再确认；确认后将按行更新库存。
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
            ]}
          />
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
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        extra={
          currentOrder ? (
            <Space>
              {(currentOrder.status === 'draft' ||
                currentOrder.status === '待退料' ||
                currentOrder.status === '草稿' ||
                currentOrder.status === '待入库') && (
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
                          {currentOrder.receipt_type === 'purchase'
                            ? '采购入库'
                            : currentOrder.receipt_type === 'finished_goods'
                              ? '成品入库'
                              : currentOrder.receipt_type === 'semi_finished_goods'
                                ? '半成品入库'
                                : '生产退料'}
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
                      children: currentOrder.receipt_date || currentOrder.return_time || '-',
                    },
                    {
                      key: 'op',
                      label: '操作员',
                      children: currentOrder.received_by || currentOrder.returner_name || '-',
                    },
                    ...(currentOrder.notes
                      ? [{ key: 'notes', label: '备注', span: 3, children: currentOrder.notes }]
                      : []),
                  ]}
                />
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
                  {currentOrder.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType={inboundDocumentTrackingType(currentOrder)}
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
                  ) : null}
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
                              { title: '批次号', dataIndex: 'batch_number', width: 100, ellipsis: true },
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
                                { title: '批次号', dataIndex: 'batch_number', width: 100, ellipsis: true },
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
                                { title: '批次号', dataIndex: 'batch_number', width: 100, ellipsis: true },
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
