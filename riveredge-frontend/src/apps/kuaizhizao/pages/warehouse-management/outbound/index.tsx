/**
 * 出库管理页面
 *
 * 提供出库单的管理功能，支持多种出库类型：生产领料、销售出库、退货出库等。
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, type ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Tooltip, Typography, Spin, Empty, Select, Input, InputNumber, theme as AntdTheme } from 'antd';
import { CheckCircleOutlined, PlayCircleOutlined, RollbackOutlined, PrinterOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta } from '../../../../../components/uni-table';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';

import { ListPageTemplate, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { UniPullLoadButton } from '../../../../../components/uni-pull';
import { OutboundDetailDrawer } from './components/OutboundDetailDrawer';
import { WarehouseTraceBriefPrimaryActions } from '../WarehouseTraceBriefFooter';
import { warehouseApi, workOrderApi, outsourceMaterialIssueApi } from '../../../services/production';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { mapWarehouseSelectOptions, type WarehouseSelectOption } from './outboundEntryShared';
import { LinkedOqcPanel } from '../../quality-management/components/LinkedInspectionPanel';
import { getOutboundLifecycle } from '../../../utils/outboundLifecycle';
import dayjs from 'dayjs';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { buildKuaizhizaoPullCreateMenuItems } from '../../../constants/documentActionRegistry';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { outboundTypeToPrintDocumentType } from '../../../utils/kuaizhizaoPrintConfig';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import OutboundQuickPullModals, { type OutboundQuickPullModalsRef } from './OutboundQuickPullModals';
import OutboundConfirmPreviewModal from './OutboundConfirmPreviewModal';
import { formatDateTime, formatDateTimeBySiteSetting, formatQuantity } from '../../../../../utils/format';
import { alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  DocumentPushProgressBar,
  DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
  ratioToPushProgressPercent,
} from '../../sales-management/shared/DocumentPushProgressBar';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildOutboundHubStatusValueEnum,
  resolveOutboundHubListParams,
} from '../../../utils/warehouseListCore';
import { fetchOutboundHubList } from './outboundListAggregate';
import { withdrawOutboundDocument, deleteOutboundDocument } from './outboundHubWithdraw';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { isAdminBypass } from '../../../../../utils/permission';
import { useGlobalStore } from '../../../../../stores';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { isManualAuditEnabled } from '../../../../../utils/auditMode';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import {
  type OutboundHubOrder,
  type OutboundIssueType,
  getOutboundIssueTypeLabel,
  outboundIssueTypeSegmentOptions,
  isOutboundConfirmable,
  isOutboundWithdrawable,
  isOutboundDeletable,
  isOutboundEditable,
  OUTBOUND_POSTED_STATUSES,
  outboundConfirmCapabilityReasonMessage,
  outboundWithdrawCapabilityReasonMessage,
  outboundUpdateCapabilityReasonMessage,
  mapOutsourceIssueToOutbound,
  outboundDocumentCode,
  outboundSourceDocNo,
  resolveOutboundHubDateRaw,
  resolveOutboundHubOperator,
  outboundDocumentTrackingType,
} from './outboundHubTypes';
import { outboundIssueTypeMarkerValueEnum, renderOutboundIssueTypeMarkerTag } from '../shared/warehouseMarkerTags';
import { StatusTag } from '../../../../../constants/statusBadges';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import type { OutboundPullEntryNavigationState } from './outboundPullEntryTypes';

interface OutboundOrder extends OutboundHubOrder {
  items?: OutboundOrderItem[];
}

interface OutboundOrderItem {
  id?: number;
  tenant_id?: number;
  delivery_id?: number; // 销售出库单明细ID
  picking_id?: number; // 生产领料单明细ID
  material_id?: number;
  material_code?: string;
  material_name?: string;
  quantity?: number;
  unit?: string;
  notes?: string;
  required_quantity?: number;
  picked_quantity?: number;
  warehouse_id?: number;
  warehouse_name?: string;
  batch_number?: string;
  material_unit?: string;
  delivery_quantity?: number;
}

const SALES_DELIVERY_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_sales_deliveries';
const PRODUCTION_PICKING_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_production_pickings';
const OUTBOUND_RESOURCE = 'kuaizhizao:outbound';

/** UniWorkflowActions 状态集合（与后端 review_status / status 对齐；领料/销售出库共用） */
const OUTBOUND_WORKFLOW_DRAFT_STATUSES = ['草稿', 'draft'];
const OUTBOUND_WORKFLOW_PENDING_STATUSES = ['待审核', 'pending_review', 'pending_approval', 'PENDING'];
const OUTBOUND_WORKFLOW_APPROVED_STATUSES = ['已通过', '审核通过', 'approved', 'APPROVED'];
const OUTBOUND_WORKFLOW_REJECTED_STATUSES = ['已驳回', '审核驳回', 'rejected', 'REJECTED'];

const OutboundPage: React.FC = () => {
  const { t } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = AntdTheme.useToken();
  const outboundDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const searchFormRef = useRef<ProFormInstance>();
  const quickPullRef = useRef<OutboundQuickPullModalsRef>(null);
  const outboundTypeFilterRef = useRef<string>('all');
  const [outboundTypeFilter, setOutboundTypeFilter] = useState<string>('all');
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();

  const handleOutboundTypeFilterChange = useCallback((value: string) => {
    const next = value || 'all';
    // 同步写入 ref，避免 setState 后立刻 reload 仍读到旧筛选值
    outboundTypeFilterRef.current = next;
    setOutboundTypeFilter(next);
    searchFormRef.current?.setFieldsValue({
      outbound_type: next === 'all' ? undefined : next,
    });
    actionRef.current?.reload();
  }, []);

  const outboundTypeSelect = useMemo(
    () => (
      <Select
        value={outboundTypeFilter}
        options={outboundIssueTypeSegmentOptions(t)}
        onChange={(v) => handleOutboundTypeFilterChange(String(v))}
        popupMatchSelectWidth={false}
        style={{ width: 140 }}
      />
    ),
    [t, outboundTypeFilter, handleOutboundTypeFilterChange],
  );

  const {
    customFields: salesDeliveryListCustomFields,
    generateCustomFieldColumns: generateSalesDeliveryCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichSalesDeliveryRecordsWithCustomFields,
    customFieldValues: salesDeliveryDetailCustomFieldValues,
    loadFieldValuesForDetail: loadSalesDeliveryFieldValuesForDetail,
    resetDetailFieldValues: resetSalesDeliveryDetailFieldValues,
  } = useCustomFieldsForList<OutboundOrder>({ tableName: SALES_DELIVERY_CUSTOM_FIELD_TABLE });

  const {
    customFields: productionPickingListCustomFields,
    generateCustomFieldColumns: generateProductionPickingCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichProductionPickingRecordsWithCustomFields,
    customFieldValues: productionPickingDetailCustomFieldValues,
    loadFieldValuesForDetail: loadProductionPickingFieldValuesForDetail,
    resetDetailFieldValues: resetProductionPickingDetailFieldValues,
  } = useCustomFieldsForList<OutboundOrder>({ tableName: PRODUCTION_PICKING_CUSTOM_FIELD_TABLE });

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OutboundOrder | null>(null);
  const [outboundTrackingRefreshKey, setOutboundTrackingRefreshKey] = useState(0);
  const detailRetryRecordRef = useRef<OutboundOrder | null>(null);
  const [editablePickingQuantities, setEditablePickingQuantities] = useState<Record<number, number>>({});
  const [editablePickingWarehouses, setEditablePickingWarehouses] = useState<
    Record<number, { id: number; name: string }>
  >({});
  const [editablePickingBatches, setEditablePickingBatches] = useState<Record<number, string>>({});
  const [editablePickingNotes, setEditablePickingNotes] = useState('');
  const [savingPickingEdit, setSavingPickingEdit] = useState(false);
  const [pickingWarehouseOptions, setPickingWarehouseOptions] = useState<WarehouseSelectOption[]>([]);

  const [executionConfig, setExecutionConfig] = useState<any>(null);
  const outboundPerms = useResourcePermissions('kuaizhizao:outbound');
  const inboundPerms = useResourcePermissions('kuaizhizao:inbound');
  const currentUser = useCurrentUser();
  const packingBindingPerms = useResourcePermissions('kuaizhizao:production-execution-packing-binding');

  const [confirmPreviewOpen, setConfirmPreviewOpen] = useState(false);
  const [confirmPreviewRecord, setConfirmPreviewRecord] = useState<OutboundOrder | null>(null);
  const handledDirectConfirmKeyRef = useRef<string | null>(null);
  const productionPickingAuditEnabled = useAuditRequired('production_picking', false);
  const salesDeliveryAuditEnabled = useAuditRequired('sales_delivery', false);
  const outboundAuditColumnEnabled = productionPickingAuditEnabled || salesDeliveryAuditEnabled;
  const outboundAuditColumn = useMemo(
    () =>
      createListAuditPhaseColumn<OutboundOrder>({
        t,
        auditEnabled: outboundAuditColumnEnabled,
      }),
    [t, outboundAuditColumnEnabled],
  );

  const canUpdateProductionPicking = useCallback(
    () => Boolean(inboundPerms.canUpdate || outboundPerms.canUpdate),
    [inboundPerms.canUpdate, outboundPerms.canUpdate],
  );

  const isEditableProductionPicking = useCallback(
    (order?: OutboundOrder | null) =>
      !!order &&
      order.outbound_type === 'production_picking' &&
      isOutboundEditable(order) &&
      canUpdateProductionPicking(),
    [canUpdateProductionPicking],
  );

  const initProductionPickingEditState = useCallback((detailData: Record<string, unknown>) => {
    const quantities: Record<number, number> = {};
    const warehouses: Record<number, { id: number; name: string }> = {};
    const batches: Record<number, string> = {};
    ((detailData.items as OutboundOrderItem[] | undefined) || []).forEach((it) => {
      if (it?.id == null) return;
      const rid = Number(it.id);
      quantities[rid] = Number(it.required_quantity ?? 0);
      warehouses[rid] = {
        id: Number(it.warehouse_id ?? 0),
        name: String(it.warehouse_name ?? ''),
      };
      batches[rid] = String(it.batch_number ?? '');
    });
    setEditablePickingQuantities(quantities);
    setEditablePickingWarehouses(warehouses);
    setEditablePickingBatches(batches);
    setEditablePickingNotes(String(detailData.notes ?? ''));
  }, []);

  const resetProductionPickingEditState = useCallback(() => {
    setEditablePickingQuantities({});
    setEditablePickingWarehouses({});
    setEditablePickingBatches({});
    setEditablePickingNotes('');
    setPickingWarehouseOptions([]);
  }, []);

  const handleProductionPickingAuditSuccess = useCallback(async () => {
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
    if (currentOrder?.outbound_type === 'production_picking' && currentOrder.id != null) {
      try {
        const updated = await warehouseApi.productionPicking.get(String(currentOrder.id));
        const merged = {
          ...(updated as OutboundOrder),
          outbound_type: 'production_picking' as const,
        };
        setCurrentOrder(merged);
        initProductionPickingEditState(updated as Record<string, unknown>);
        setOutboundTrackingRefreshKey((k) => k + 1);
      } catch {
        /* 详情刷新失败不影响列表 */
      }
    }
  }, [currentOrder, invalidateMenuBadgeCounts, initProductionPickingEditState]);

  const handleSalesDeliveryAuditSuccess = useCallback(async () => {
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
    if (currentOrder?.outbound_type === 'sales_delivery' && currentOrder.id != null) {
      try {
        const updated = await warehouseApi.salesDelivery.get(String(currentOrder.id));
        setCurrentOrder({
          ...(updated as OutboundOrder),
          outbound_type: 'sales_delivery',
        });
        setOutboundTrackingRefreshKey((k) => k + 1);
      } catch {
        /* 详情刷新失败不影响列表 */
      }
    }
  }, [currentOrder, invalidateMenuBadgeCounts]);

  const outboundDocTrackingType = currentOrder ? outboundDocumentTrackingType(currentOrder) : undefined;

  useEffect(() => {
    const loadExecutionConfig = async () => {
      try {
        const cfg = await workOrderApi.getExecutionConfig();
        setExecutionConfig(cfg);
      } catch {
        setExecutionConfig(null);
      }
    };
    loadExecutionConfig();
  }, []);

  const openConfirmPreview = useCallback((record: OutboundOrder) => {
    setConfirmPreviewRecord(record);
    setConfirmPreviewOpen(true);
  }, []);

  const closeConfirmPreview = useCallback(() => {
    setConfirmPreviewOpen(false);
    setConfirmPreviewRecord(null);
  }, []);

  useEffect(() => {
    const dc = (location.state as OutboundPullEntryNavigationState | null)?.outboundDirectConfirm;
    if (!dc?.id || !dc.outbound_type) return;
    const key = `${dc.outbound_type}:${dc.id}`;
    if (handledDirectConfirmKeyRef.current === key) return;
    handledDirectConfirmKeyRef.current = key;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    openConfirmPreview({ id: dc.id, outbound_type: dc.outbound_type });
  }, [location.pathname, location.search, location.state, navigate, openConfirmPreview]);

  const handleCreate = () => {
    quickPullRef.current?.open('work_order');
  };

  useNewShortcut(handleCreate);
  const pullLoadLabel = useMemo(
    () => withSingleNewShortcutHint(t('components.uniPull.loadFromDocument')),
    [t],
  );

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: OutboundOrder) => {
    detailRetryRecordRef.current = record;
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setDetailError(null);
    setCurrentOrder(null);
    resetProductionPickingEditState();
    try {
      let detailData;
      if (record.outbound_type === 'production_picking') {
        detailData = await warehouseApi.productionPicking.get(record.id!.toString());
      } else if (record.outbound_type === 'sales_delivery') {
        detailData = await warehouseApi.salesDelivery.get(record.id!.toString());
      } else if (record.outbound_type === 'other_outbound') {
        detailData = await warehouseApi.otherOutbound.get(record.id!.toString());
      } else if (record.outbound_type === 'material_borrow') {
        detailData = await warehouseApi.materialBorrow.get(record.id!.toString());
      } else if (record.outbound_type === 'outsource_issue') {
        const raw = await outsourceMaterialIssueApi.get(record.id!.toString());
        detailData = mapOutsourceIssueToOutbound(raw as Record<string, unknown>);
        setCurrentOrder({ ...detailData, items: detailData.items as OutboundOrderItem[] });
        setOutboundTrackingRefreshKey((k) => k + 1);
        return;
      }
      const merged = detailData
        ? ({ ...detailData, outbound_type: record.outbound_type } as OutboundOrder)
        : null;
      setCurrentOrder(merged);
      if (record.outbound_type === 'production_picking' && detailData) {
        initProductionPickingEditState(detailData as Record<string, unknown>);
        if (isOutboundEditable(merged as OutboundHubOrder) && canUpdateProductionPicking()) {
          try {
            const whRes = await masterWarehouseApi.list({ is_active: true, limit: 500 });
            setPickingWarehouseOptions(mapWarehouseSelectOptions(whRes));
          } catch (e: unknown) {
            const err = e as { message?: string };
            messageApi.error(err?.message || t('app.kuaizhizao.warehouseOutbound.msg.loadWarehouseFailed'));
          }
        }
      }
      setOutboundTrackingRefreshKey((k) => k + 1);
      if (record.outbound_type === 'sales_delivery' && record.id != null) {
        await loadSalesDeliveryFieldValuesForDetail(record.id);
      } else if (record.outbound_type === 'production_picking' && record.id != null) {
        await loadProductionPickingFieldValuesForDetail(record.id);
      }
    } catch {
      const text = t('app.kuaizhizao.warehouseOutbound.msg.loadDetailFailed');
      setDetailError(text);
      messageApi.error(text);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveProductionPickingEdit = async () => {
    if (!currentOrder?.id || currentOrder.outbound_type !== 'production_picking') return;
    if (!isEditableProductionPicking(currentOrder)) {
      messageApi.warning(
        outboundUpdateCapabilityReasonMessage(currentOrder, t) ||
          t('app.kuaizhizao.warehouseOutbound.msg.pickingEditFailed'),
      );
      return;
    }
    const items = (currentOrder.items || []) as OutboundOrderItem[];
    if (!items.length) {
      messageApi.warning(t('app.kuaizhizao.warehouseOutbound.msg.noEditableLines'));
      return;
    }
    try {
      const mappedItems = items
        .filter((it) => it.id != null)
        .map((it) => {
          const rid = Number(it.id);
          const qty = Number(editablePickingQuantities[rid] ?? it.required_quantity ?? 0);
          if (!(qty > 0)) {
            throw new Error(
              t('app.kuaizhizao.warehouseOutbound.msg.requiredQtyMustBePositive', {
                material: it.material_code || it.material_name || '-',
              }),
            );
          }
          const wh = editablePickingWarehouses[rid];
          const warehouseId = Number(wh?.id ?? it.warehouse_id ?? 0);
          if (!(warehouseId > 0)) {
            throw new Error(
              t('app.kuaizhizao.warehouseOutbound.msg.selectLineWarehouse', {
                material: it.material_code || it.material_name || '-',
              }),
            );
          }
          return {
            id: rid,
            required_quantity: qty,
            warehouse_id: warehouseId,
            warehouse_name: String(wh?.name ?? it.warehouse_name ?? ''),
            batch_number: editablePickingBatches[rid] ?? it.batch_number ?? '',
          };
        });

      setSavingPickingEdit(true);
      await warehouseApi.productionPicking.update(String(currentOrder.id), {
        notes: editablePickingNotes,
        items: mappedItems,
      });
      const detail = await warehouseApi.productionPicking.get(String(currentOrder.id));
      const merged = { ...(detail as OutboundOrder), outbound_type: 'production_picking' as const };
      setCurrentOrder(merged);
      initProductionPickingEditState(detail as Record<string, unknown>);
      messageApi.success(t('app.kuaizhizao.warehouseOutbound.msg.pickingEditSaved'));
      invalidateMenuBadgeCounts();
      setOutboundTrackingRefreshKey((k) => k + 1);
      actionRef.current?.reload();
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { data?: { detail?: string } } };
      messageApi.error(
        err?.message || err?.response?.data?.detail || t('app.kuaizhizao.warehouseOutbound.msg.pickingEditFailed'),
      );
    } finally {
      setSavingPickingEdit(false);
    }
  };

  const refreshOrderAfterConfirm = async (record: OutboundOrder) => {
    actionRef.current?.reload();
    if (currentOrder?.id === record.id) {
      try {
        let detailData: Record<string, unknown> | undefined;
        const id = record.id!.toString();
        if (record.outbound_type === 'production_picking') {
          detailData = (await warehouseApi.productionPicking.get(id)) as Record<string, unknown>;
        } else if (record.outbound_type === 'sales_delivery') {
          detailData = (await warehouseApi.salesDelivery.get(id)) as Record<string, unknown>;
        } else if (record.outbound_type === 'other_outbound') {
          detailData = (await warehouseApi.otherOutbound.get(id)) as Record<string, unknown>;
        } else if (record.outbound_type === 'material_borrow') {
          detailData = (await warehouseApi.materialBorrow.get(id)) as Record<string, unknown>;
        }
        if (detailData) {
          setCurrentOrder({ ...detailData, outbound_type: record.outbound_type } as OutboundOrder);
          if (record.outbound_type === 'sales_delivery' && record.id != null) {
            await loadSalesDeliveryFieldValuesForDetail(record.id);
          } else if (record.outbound_type === 'production_picking' && record.id != null) {
            await loadProductionPickingFieldValuesForDetail(record.id);
          }
        }
      } catch {
        /* ignore */
      }
    }
    setOutboundTrackingRefreshKey((k) => k + 1);
  };

  const handleConfirmPreviewSuccess = async () => {
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
    if (confirmPreviewRecord && currentOrder?.id === confirmPreviewRecord.id) {
      await refreshOrderAfterConfirm(confirmPreviewRecord);
    }
    setOutboundTrackingRefreshKey((k) => k + 1);
  };

  const handleWithdraw = (record: OutboundOrder) => {
    if (!isOutboundWithdrawable(record)) {
      messageApi.warning(
        outboundWithdrawCapabilityReasonMessage(record, t) ||
          t('app.kuaizhizao.warehouseOutbound.msg.withdrawFailed'),
      );
      return;
    }
    Modal.confirm({
      title: t('app.kuaizhizao.warehouseOutbound.msg.withdrawTitle'),
      content: t('app.kuaizhizao.warehouseOutbound.msg.withdrawConfirm', { code: outboundDocumentCode(record) }),
      onOk: async () => {
        try {
          await withdrawOutboundDocument(record);
          messageApi.success(t('app.kuaizhizao.warehouseOutbound.msg.withdrawSuccess'));
          invalidateMenuBadgeCounts();
          await refreshOrderAfterConfirm(record);
        } catch (e: unknown) {
          const err = e as { message?: string; response?: { data?: { detail?: string } } };
          messageApi.error(err?.message || err?.response?.data?.detail || t('app.kuaizhizao.warehouseOutbound.msg.withdrawFailed'));
        }
      },
    });
  };

  const handlePrint = (record: OutboundOrder) => {
    if (!record.id) return;
    const docType = outboundTypeToPrintDocumentType(record.outbound_type);
    if (!docType) {
      messageApi.warning(t('app.kuaizhizao.warehouseOutbound.msg.printNotSupported'));
      return;
    }
    openPrint({ documentType: docType, documentId: record.id });
  };

  const listRowsRef = useRef<Map<string, OutboundOrder>>(new Map());
  /** 列表数据写入 ref 后递增，驱动选中行解析重算（避免仅改 ref 时打印按钮不刷新） */
  const [listRowsVersion, setListRowsVersion] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const outboundRowKey = (record: OutboundOrder) => `${record.outbound_type}::${record.id}`;

  const parseOutboundRowKey = useCallback((key: React.Key): { type: string; id: number } | null => {
    const raw = String(key ?? '');
    const sep = raw.indexOf('::');
    if (sep <= 0) return null;
    const type = raw.slice(0, sep);
    const id = Number(raw.slice(sep + 2));
    if (!type || !Number.isFinite(id) || id <= 0) return null;
    return { type, id };
  }, []);

  const resolveOutboundRowByKey = useCallback(
    (key: React.Key): OutboundOrder | undefined => {
      const raw = String(key ?? '');
      const direct = listRowsRef.current.get(raw);
      if (direct) return direct;
      const parsed = parseOutboundRowKey(key);
      if (!parsed) return undefined;
      for (const row of listRowsRef.current.values()) {
        if (String(row.outbound_type) === parsed.type && Number(row.id) === parsed.id) {
          return row;
        }
      }
      return undefined;
    },
    [parseOutboundRowKey, listRowsVersion],
  );

  const getOutboundConfirmLabel = (record: OutboundOrder) =>
    record.outbound_type === 'production_picking'
      ? t('app.kuaizhizao.warehouseOutbound.action.confirmPicking')
      : t('app.kuaizhizao.warehouseOutbound.action.confirmOutbound');

  const canRunOutboundConfirm = (record: OutboundOrder): boolean => {
    if (record.outbound_type === 'production_picking') {
      return (
        (inboundPerms.canAction?.('execute') ?? false) ||
        (outboundPerms.canAction?.('execute') ?? false)
      );
    }
    if (record.outbound_type === 'sales_delivery') {
      return outboundPerms.canAction?.('execute') ?? false;
    }
    return outboundPerms.canAction?.('execute') ?? outboundPerms.canUpdate;
  };

  const getOutboundConfirmBlockedReason = (record: OutboundOrder): string | undefined => {
    if (
      record.outbound_type === 'production_picking' &&
      executionConfig &&
      executionConfig.current_user_can_confirm_picking === false &&
      !isAdminBypass(currentUser)
    ) {
      return t('app.kuaizhizao.warehouseOutbound.msg.noConfirmPickingPermission');
    }
    if (!canRunOutboundConfirm(record)) {
      return t('app.kuaizhizao.warehouseOutbound.msg.noConfirmExecutePermission');
    }
    return undefined;
  };

  const isOutboundPrintable = useCallback(
    (record: OutboundOrder) =>
      !!record.id &&
      !!outboundTypeToPrintDocumentType(record.outbound_type) &&
      outboundPerms.canPrint &&
      record.capabilities?.print?.allowed !== false,
    [outboundPerms.canPrint],
  );

  const selectedOutboundForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => resolveOutboundRowByKey(key))
        .filter((row): row is OutboundOrder => row != null),
    [selectedRowKeys, resolveOutboundRowByKey],
  );

  const canToolbarPrint = useMemo(() => {
    if (!outboundPerms.canPrint || selectedRowKeys.length !== 1) return false;
    const row = selectedOutboundForBatch[0];
    if (row) return isOutboundPrintable(row);
    // listRowsRef 偶发未命中时，仍按复合 rowKey 判断类型是否可打印
    const parsed = parseOutboundRowKey(selectedRowKeys[0]);
    return !!parsed && !!outboundTypeToPrintDocumentType(parsed.type as OutboundOrder['outbound_type']);
  }, [
    outboundPerms.canPrint,
    selectedRowKeys,
    selectedOutboundForBatch,
    isOutboundPrintable,
    parseOutboundRowKey,
  ]);

  const handleDelete = (record: OutboundOrder) => {
    const code = outboundDocumentCode(record);
    Modal.confirm({
      title: t('app.kuaizhizao.warehouseOutbound.msg.deleteConfirmOne'),
      content: t('app.kuaizhizao.warehouseOutbound.msg.withdrawConfirm', { code }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteOutboundDocument(record);
          messageApi.success(t('common.deleteSuccess'));
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          if (currentOrder?.id === record.id && currentOrder?.outbound_type === record.outbound_type) {
            setDetailDrawerVisible(false);
            setCurrentOrder(null);
          }
        } catch (e: unknown) {
          const err = e as { message?: string; response?: { data?: { detail?: string } } };
          messageApi.error(err?.message || err?.response?.data?.detail || t('app.kuaizhizao.warehouseOutbound.msg.deleteFailed'));
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    const rows = keys
      .map((k) => resolveOutboundRowByKey(k))
      .filter((r): r is OutboundOrder => !!r && isOutboundDeletable(r));
    if (rows.length === 0) {
      messageApi.warning(t('app.kuaizhizao.warehouseCommon.batchDeleteNoneDeletable'));
      return;
    }
    try {
      for (const row of rows) {
        await deleteOutboundDocument(row);
      }
      messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: rows.length }));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (e: unknown) {
      const err = e as { message?: string; response?: { data?: { detail?: string } } };
      messageApi.error(err?.message || err?.response?.data?.detail || t('app.kuaizhizao.warehouseCommon.batchDeleteFailed'));
    }
  };

  const handleConfirm = async (record: OutboundOrder) => {
    if (record.outbound_type === 'outsource_issue') return;
    if (!isOutboundConfirmable(record)) {
      messageApi.warning(
        outboundConfirmCapabilityReasonMessage(record, t) ||
          t('app.kuaizhizao.warehouseOutbound.msg.noneConfirmable'),
      );
      return;
    }
    openConfirmPreview(record);
  };

  /**
   * 表格列定义
   */
  const getOutboundStackedPrimary = (record: OutboundOrder): string => {
    if (record.outbound_type === 'sales_delivery' && record.customer_name) {
      return String(record.customer_name);
    }
    if (record.work_order_code) return String(record.work_order_code);
    if (record.customer_name) return String(record.customer_name);
    return t('app.kuaizhizao.warehouseOutbound.fallbackDoc');
  };

  const salesDeliveryCustomFieldColumns = generateSalesDeliveryCustomFieldColumns();
  const productionPickingCustomFieldColumns = generateProductionPickingCustomFieldColumns();

  const pickingDetailEditable = isEditableProductionPicking(currentOrder);

  const pickingDetailColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'material_name', width: 150 },
      {
        title: t('app.kuaizhizao.warehouseOutbound.col.requiredQty'),
        dataIndex: 'required_quantity',
        width: pickingDetailEditable ? 120 : 100,
        align: 'right' as const,
        render: (_: unknown, row: OutboundOrderItem) => {
          if (!pickingDetailEditable || row.id == null) {
            return formatQuantity(row.required_quantity);
          }
          const rid = Number(row.id);
          return (
            <InputNumber
              min={0.01}
              precision={2}
              value={editablePickingQuantities[rid] ?? Number(row.required_quantity ?? 0)}
              onChange={(v) =>
                setEditablePickingQuantities((prev) => ({ ...prev, [rid]: Number(v) || 0 }))
              }
              style={{ width: 100 }}
              size="small"
            />
          );
        },
      },
      { title: t('app.kuaizhizao.warehouseOutbound.col.pickedQty'), dataIndex: 'picked_quantity', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseOutbound.col.unit'), dataIndex: 'material_unit', width: 60 },
      {
        title: t('app.kuaizhizao.warehouseOutbound.col.warehouseName'),
        dataIndex: 'warehouse_name',
        width: pickingDetailEditable ? 160 : 120,
        render: (_: unknown, row: OutboundOrderItem) => {
          if (!pickingDetailEditable || row.id == null) {
            return row.warehouse_name || '-';
          }
          const rid = Number(row.id);
          const current = editablePickingWarehouses[rid];
          return (
            <Select
              size="small"
              style={{ width: 140 }}
              options={pickingWarehouseOptions}
              value={current?.id > 0 ? current.id : undefined}
              placeholder={t('app.kuaizhizao.warehouseOutbound.msg.selectWarehouse')}
              onChange={(value, option) => {
                const opt = option as { label?: string; name?: string } | undefined;
                const name =
                  (typeof opt?.label === 'string' ? opt.label : undefined) ||
                  opt?.name ||
                  pickingWarehouseOptions.find((o) => o.value === value)?.name ||
                  '';
                setEditablePickingWarehouses((prev) => ({
                  ...prev,
                  [rid]: { id: Number(value), name },
                }));
              }}
              showSearch
              optionFilterProp="label"
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.warehouseOutbound.col.batchNo'),
        dataIndex: 'batch_number',
        width: pickingDetailEditable ? 120 : 100,
        render: (_: unknown, row: OutboundOrderItem) => {
          if (!pickingDetailEditable || row.id == null) {
            return row.batch_number || '-';
          }
          const rid = Number(row.id);
          return (
            <Input
              size="small"
              value={editablePickingBatches[rid] ?? ''}
              onChange={(e) =>
                setEditablePickingBatches((prev) => ({ ...prev, [rid]: e.target.value }))
              }
            />
          );
        },
      },
    ],
    [
      t,
      pickingDetailEditable,
      editablePickingQuantities,
      editablePickingWarehouses,
      editablePickingBatches,
      pickingWarehouseOptions,
    ],
  );

  const deliveryDetailColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.deliveryQty'), dataIndex: 'delivery_quantity', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseOutbound.col.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.batchNo'), dataIndex: 'batch_number', width: 100 },
      { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes' },
    ],
    [t],
  );

  const columns: ProColumns<OutboundOrder>[] = useMemo(
    () => alignProColumns<OutboundOrder>([
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.subjectDocNo'),
      key: 'subject_doc',
      dataIndex: ['delivery_code', 'picking_code'],
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      hideInSearch: true,
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={getOutboundStackedPrimary(record)}
          secondary={String(record.delivery_code || record.picking_code || '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.subjectDocNo'),
      dataIndex: 'keyword',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.outboundCode'),
      dataIndex: 'delivery_code',
      hideInTable: true,
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.outboundType'),
      dataIndex: 'outbound_type',
      width: 100,
      sorter: true,
      hideInSearch: true,
      valueEnum: outboundIssueTypeMarkerValueEnum(t),
      render: (_, record) => renderOutboundIssueTypeMarkerTag(t, record.outbound_type),
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.status'),
      dataIndex: 'status',
      hideInTable: true,
      valueType: 'select',
      valueEnum: buildOutboundHubStatusValueEnum(t),
      initialValue: 'pending',
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.customer'),
      dataIndex: 'customer_name',
      hideInTable: true,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.sourceDocNo'),
      key: 'sourceDocNo',
      dataIndex: 'source_doc_no',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => outboundSourceDocNo(record) || '-',
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      render: formatQuantity,
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.totalItems'),
      dataIndex: 'total_items',
      width: 100,
      align: 'right',
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.outboundProgress'),
      dataIndex: 'fulfillment_progress',
      ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
      hideInSearch: true,
      render: (_, record) => {
        let done = 0;
        let required = 0;
        if (record.outbound_type === 'production_picking') {
          required = Number(record.required_quantity_total ?? record.total_quantity ?? 0);
          done = Number(record.picked_quantity_total ?? 0);
        } else {
          required = Number(record.total_quantity ?? 0);
          const posted = OUTBOUND_POSTED_STATUSES.has(String(record.status || '').trim());
          done = posted ? required : 0;
          if (!(required > 0) && posted) {
            required = 1;
            done = 1;
          }
        }
        if (!(required > 0) && !(done > 0)) return '-';
        const percent = ratioToPushProgressPercent(done, required);
        return (
          <DocumentPushProgressBar
            percent={percent}
            tooltip={t('app.kuaizhizao.warehouseOutbound.col.outboundProgressTip', {
              done: formatQuantity(done),
              required: formatQuantity(required),
              percent,
            })}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.warehouse'),
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.operatorPerson'),
      key: 'biz_time_operator',
      dataIndex: 'biz_time_operator',
      width: 148,
      uniTableKeepWidth: true,
      hideInSearch: true,
      sorter: true,
      render: (_, record) => {
        const raw = resolveOutboundHubDateRaw(record);
        return (
          <UniTableStackedPrimaryCell
            primary={resolveOutboundHubOperator(record) || '-'}
            secondary={raw ? formatDateTimeBySiteSetting(raw as string) : '-'}
            secondaryCopyable={false}
            primaryBold={false}
          />
        );
      },
    },
    ...buildDocumentAuditColumns<Record<string, unknown>>(t),
    ...(outboundAuditColumnEnabled ? [outboundAuditColumn] : []),
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.lifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getOutboundLifecycle(record as Record<string, unknown>, t);
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
    ...salesDeliveryCustomFieldColumns,
    ...productionPickingCustomFieldColumns,
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.actions'),
      width: 300,
      fixed: 'right',
      hideInSearch: true,
      search: false,
      render: (_, record) => (
        <Space wrap>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.outbound_type === 'production_picking' &&
            isOutboundEditable(record) &&
            canUpdateProductionPicking() && (
              <Button {...rowActionKind('update')} onClick={() => void handleDetail(record)} />
            )}
          {record.outbound_type === 'sales_delivery' && record.id && packingBindingPerms.canRead && (
            <Button
              {...rowActionKind('execute')}
              {...rowActionLabelKeep()}
              onClick={() =>
                navigate(
                  `/apps/kuaizhizao/production-execution/packing-binding?action=bind&source_type=sales_delivery&source_id=${record.id}`,
                )
              }
            >
              {t('app.kuaizhizao.packingBinding.title')}
            </Button>
          )}
          {record.outbound_type === 'production_picking' && productionPickingAuditEnabled ? (
            <UniWorkflowActions
              {...rowActionKind('skip')}
              key="pp-workflow"
              record={record}
              entityName={t('app.kuaizhizao.warehouseOutbound.picking.entityName')}
              entityType="production_picking"
              auditNodeKey="production_picking"
              unifiedAudit
              resourcePrefix={OUTBOUND_RESOURCE}
              statusField="status"
              reviewStatusField="review_status"
              draftStatuses={OUTBOUND_WORKFLOW_DRAFT_STATUSES}
              pendingStatuses={OUTBOUND_WORKFLOW_PENDING_STATUSES}
              approvedStatuses={OUTBOUND_WORKFLOW_APPROVED_STATUSES}
              rejectedStatuses={OUTBOUND_WORKFLOW_REJECTED_STATUSES}
              theme="link"
              size="small"
              onSuccess={() => {
                void handleProductionPickingAuditSuccess();
              }}
              confirmMessages={{
                submit: isManualAuditEnabled(record.audit)
                  ? t('app.kuaizhizao.warehouseOutbound.picking.submitConfirmAudit')
                  : t('app.kuaizhizao.warehouseOutbound.picking.submitConfirmAuto'),
              }}
            />
          ) : null}
          {record.outbound_type === 'sales_delivery' && salesDeliveryAuditEnabled ? (
            <UniWorkflowActions
              {...rowActionKind('skip')}
              key="sd-workflow"
              record={record}
              entityName={t('app.kuaizhizao.warehouseOutbound.delivery.entityName')}
              entityType="sales_delivery"
              auditNodeKey="sales_delivery"
              unifiedAudit
              resourcePrefix={OUTBOUND_RESOURCE}
              statusField="status"
              reviewStatusField="review_status"
              draftStatuses={OUTBOUND_WORKFLOW_DRAFT_STATUSES}
              pendingStatuses={OUTBOUND_WORKFLOW_PENDING_STATUSES}
              approvedStatuses={OUTBOUND_WORKFLOW_APPROVED_STATUSES}
              rejectedStatuses={OUTBOUND_WORKFLOW_REJECTED_STATUSES}
              theme="link"
              size="small"
              onSuccess={() => {
                void handleSalesDeliveryAuditSuccess();
              }}
              confirmMessages={{
                submit: isManualAuditEnabled(record.audit)
                  ? t('app.kuaizhizao.warehouseOutbound.delivery.submitConfirmAudit')
                  : t('app.kuaizhizao.warehouseOutbound.delivery.submitConfirmAuto'),
              }}
            />
          ) : null}
          {isOutboundConfirmable(record) && record.outbound_type !== 'outsource_issue' && (
            <Tooltip
              title={getOutboundConfirmBlockedReason(record)}
              data-row-action-visible-when-disabled={true}
            >
              <Button
                {...rowActionKind('skip')}
                {...rowActionLabelKeep()}
                className="ant-btn-row-action ant-btn-row-action-success"
                icon={
                  record.outbound_type === 'production_picking' ? (
                    <CheckCircleOutlined />
                  ) : (
                    <PlayCircleOutlined />
                  )
                }
                type={record.outbound_type === 'production_picking' ? 'primary' : undefined}
                onClick={() => void handleConfirm(record)}
                disabled={!!getOutboundConfirmBlockedReason(record)}
              >
                {getOutboundConfirmLabel(record)}
              </Button>
            </Tooltip>
          )}
          {isOutboundWithdrawable(record) && record.outbound_type !== 'outsource_issue' && (
            <Button {...rowActionKind('revoke')} {...rowActionLabelKeep()} onClick={() => handleWithdraw(record)}>
              {t('app.kuaizhizao.warehouseOutbound.action.withdraw')}
            </Button>
          )}
          {isOutboundDeletable(record) && outboundPerms.canDelete && (
            <Button {...rowActionKind('delete')} onClick={() => handleDelete(record)} />
          )}
        </Space>
      ),
    },
  ], WAREHOUSE_DOC_LIST_FIELD_RANK),
    [
      t,
      executionConfig,
      handleDetail,
      handleConfirm,
      handleWithdraw,
      handleDelete,
      navigate,
      inboundPerms,
      outboundPerms,
      canUpdateProductionPicking,
      getOutboundConfirmBlockedReason,
      getOutboundConfirmLabel,
      canRunOutboundConfirm,
      packingBindingPerms.canRead,
      currentUser,
      salesDeliveryCustomFieldColumns,
      productionPickingCustomFieldColumns,
      outboundAuditColumn,
      outboundAuditColumnEnabled,
      productionPickingAuditEnabled,
      salesDeliveryAuditEnabled,
      handleProductionPickingAuditSuccess,
      handleSalesDeliveryAuditSuccess,
    ],
  );

  const outboundTraceDocument = useMemo(() => {
    if (!currentOrder?.id || !outboundDocTrackingType) return undefined;
    return {
      documentType: outboundDocTrackingType,
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
          }}
        />
      ),
    };
  }, [currentOrder, outboundDocTrackingType, navigate, t]);

  const outboundDetailSupplementary = useMemo(() => {
    if (!currentOrder) return undefined;
    const nodes: React.ReactNode[] = [];
    if (
      currentOrder.outbound_type === 'sales_delivery' &&
      hasCustomFieldsDetailContent(salesDeliveryListCustomFields, salesDeliveryDetailCustomFieldValues)
    ) {
      nodes.push(
        <CustomFieldsDetailSection
          key="sales-custom-fields"
          customFields={salesDeliveryListCustomFields}
          customFieldValues={salesDeliveryDetailCustomFieldValues}
        />,
      );
    }
    if (
      currentOrder.outbound_type === 'production_picking' &&
      hasCustomFieldsDetailContent(productionPickingListCustomFields, productionPickingDetailCustomFieldValues)
    ) {
      nodes.push(
        <CustomFieldsDetailSection
          key="picking-custom-fields"
          customFields={productionPickingListCustomFields}
          customFieldValues={productionPickingDetailCustomFieldValues}
        />,
      );
    }
    // 备注已展示在基本信息区，不再 supplementary 重复
    if (currentOrder.outbound_type === 'sales_delivery' && currentOrder.id) {
      nodes.push(
        <div key="oqc" style={{ marginTop: nodes.length > 0 ? 16 : undefined }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            {t('app.kuaizhizao.warehouseOutbound.section.oqc')}
          </Typography.Text>
          <LinkedOqcPanel
            salesDeliveryId={currentOrder.id}
            active={detailDrawerVisible}
            onNavigate={(path) => {
              setDetailDrawerVisible(false);
              setCurrentOrder(null);
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
    navigate,
    productionPickingDetailCustomFieldValues,
    productionPickingListCustomFields,
    salesDeliveryDetailCustomFieldValues,
    salesDeliveryListCustomFields,
    t,
  ]);

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('app.kuaizhizao.warehouseOutbound.title')}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.outbound.v3"
        actionRef={actionRef}
        formRef={searchFormRef}
        rowKey={outboundRowKey}
        columns={columns}
        showAdvancedSearch={true}
        beforeSearchButtons={outboundTypeSelect}
        pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        enableRowSelection={outboundPerms.canDelete || outboundPerms.canPrint}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton={outboundPerms.canDelete}
        rowSelectionGetCheckboxProps={(record) => ({
          disabled: !isOutboundDeletable(record) && !isOutboundPrintable(record),
        })}
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) =>
          t('app.kuaizhizao.warehouseCommon.batchDeleteConfirm', {
            count,
            noun: t('app.kuaizhizao.warehouseOutbound.title'),
          })
        }
        request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
          try {
            const typeFilter = outboundTypeFilterRef.current;
            const listParams = resolveOutboundHubListParams(
              {
                ...(searchFormValues as Record<string, unknown>),
                outbound_type: typeFilter === 'all' ? undefined : typeFilter,
              },
              sort,
            );
            const skipEnrich = meta?.purpose === 'prefetch';
            const passthrough = async <T,>(rows: T[]) => rows;
            const result = await fetchOutboundHubList(
              {
                ...(params as Record<string, unknown>),
                ...listParams,
              },
              {
                enrichProductionPickingRecordsWithCustomFields: skipEnrich
                  ? passthrough
                  : enrichProductionPickingRecordsWithCustomFields,
                enrichSalesDeliveryRecordsWithCustomFields: skipEnrich
                  ? passthrough
                  : enrichSalesDeliveryRecordsWithCustomFields,
              },
              currentUser,
            );
            return result;
          } catch {
            messageApi.error(t('app.kuaizhizao.warehouseOutbound.msg.loadListFailed'));
            return { data: [], success: false, total: 0 };
          }
        }}
        onTableDataChange={(rows) => {
          const next = new Map<string, OutboundOrder>();
          for (const row of rows) {
            next.set(outboundRowKey(row), row);
          }
          listRowsRef.current = next;
          setListRowsVersion((v) => v + 1);
        }}
        toolBarRender={() => [
          <UniPullLoadButton
            key="pull"
            compactKey="outbound-pull-load"
            label={pullLoadLabel}
            type="primary"
            variant="solid"
            menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
              {
                actionKey: 'sales_delivery.pull_from_shipment_notice',
                onClick: () => quickPullRef.current?.open('shipment_notice'),
              },
              {
                key: 'pull-from-work-order',
                actionKey: 'outbound.pull_from_work_order',
                onClick: () => quickPullRef.current?.open('work_order'),
              },
              {
                key: 'pull-from-sales-order',
                actionKey: 'sales_delivery.pull_from_sales_order',
                onClick: () => quickPullRef.current?.open('sales_order'),
              },
              {
                actionKey: 'outbound.pull_from_outsource_work_order',
                onClick: () => quickPullRef.current?.open('outsource'),
              },
            ])}
          />,
        ]}
        toolBarActionsAfterBatch={
          outboundPerms.canPrint
            ? [
                <Button
                  key="outbound-toolbar-print"
                  icon={<PrinterOutlined />}
                  disabled={!canToolbarPrint}
                  onClick={() => {
                    const key = selectedRowKeys[0];
                    const row =
                      selectedOutboundForBatch[0] ??
                      (key != null ? resolveOutboundRowByKey(key) : undefined);
                    if (row) {
                      handlePrint(row);
                      return;
                    }
                    const parsed = key != null ? parseOutboundRowKey(key) : null;
                    const docType = parsed
                      ? outboundTypeToPrintDocumentType(parsed.type as OutboundOrder['outbound_type'])
                      : null;
                    if (parsed && docType) {
                      openPrint({ documentType: docType, documentId: parsed.id });
                      return;
                    }
                    messageApi.warning(t('app.kuaizhizao.warehouseOutbound.msg.printNotSupported'));
                  }}
                >
                  {t('components.uniAction.print')}
                </Button>,
              ]
            : []
        }
      />

      <OutboundQuickPullModals ref={quickPullRef} onSuccess={() => actionRef.current?.reload()} />

      <OutboundConfirmPreviewModal
        open={confirmPreviewOpen}
        record={confirmPreviewRecord}
        executionConfig={executionConfig}
        onClose={closeConfirmPreview}
        onSuccess={() => void handleConfirmPreviewSuccess()}
      />

      <OutboundDetailDrawer
        open={detailDrawerVisible}
        zIndex={outboundDetailDrawerZIndex}
        order={currentOrder}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const record = detailRetryRecordRef.current;
          if (record) void handleDetail(record);
        }}
        trackingRefreshKey={outboundTrackingRefreshKey}
        notesEditor={
          currentOrder && isEditableProductionPicking(currentOrder) ? (
            <Input.TextArea
              rows={2}
              value={editablePickingNotes}
              onChange={(e) => setEditablePickingNotes(e.target.value)}
              placeholder={t('app.kuaizhizao.common.fieldNotes')}
            />
          ) : undefined
        }
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentOrder(null);
          setDetailError(null);
          resetProductionPickingEditState();
          resetSalesDeliveryDetailFieldValues();
          resetProductionPickingDetailFieldValues();
        }}
        extra={
          currentOrder ? (
            <Space>
              {isEditableProductionPicking(currentOrder) ? (
                <Button onClick={() => void handleSaveProductionPickingEdit()} loading={savingPickingEdit}>
                  {t('app.kuaizhizao.warehouseOutbound.action.savePickingEdit')}
                </Button>
              ) : null}
              {currentOrder.outbound_type === 'production_picking' && productionPickingAuditEnabled ? (
                <UniWorkflowActions
                  record={currentOrder}
                  entityName={t('app.kuaizhizao.warehouseOutbound.picking.entityName')}
                  entityType="production_picking"
                  auditNodeKey="production_picking"
                  unifiedAudit
                  resourcePrefix={OUTBOUND_RESOURCE}
                  statusField="status"
                  reviewStatusField="review_status"
                  draftStatuses={OUTBOUND_WORKFLOW_DRAFT_STATUSES}
                  pendingStatuses={OUTBOUND_WORKFLOW_PENDING_STATUSES}
                  approvedStatuses={OUTBOUND_WORKFLOW_APPROVED_STATUSES}
                  rejectedStatuses={OUTBOUND_WORKFLOW_REJECTED_STATUSES}
                  onSuccess={() => {
                    void handleProductionPickingAuditSuccess();
                  }}
                  confirmMessages={{
                    submit: isManualAuditEnabled(currentOrder.audit)
                      ? t('app.kuaizhizao.warehouseOutbound.picking.submitConfirmAudit')
                      : t('app.kuaizhizao.warehouseOutbound.picking.submitConfirmAuto'),
                  }}
                />
              ) : null}
              {currentOrder.outbound_type === 'sales_delivery' && salesDeliveryAuditEnabled ? (
                <UniWorkflowActions
                  record={currentOrder}
                  entityName={t('app.kuaizhizao.warehouseOutbound.delivery.entityName')}
                  entityType="sales_delivery"
                  auditNodeKey="sales_delivery"
                  unifiedAudit
                  resourcePrefix={OUTBOUND_RESOURCE}
                  statusField="status"
                  reviewStatusField="review_status"
                  draftStatuses={OUTBOUND_WORKFLOW_DRAFT_STATUSES}
                  pendingStatuses={OUTBOUND_WORKFLOW_PENDING_STATUSES}
                  approvedStatuses={OUTBOUND_WORKFLOW_APPROVED_STATUSES}
                  rejectedStatuses={OUTBOUND_WORKFLOW_REJECTED_STATUSES}
                  onSuccess={() => {
                    void handleSalesDeliveryAuditSuccess();
                  }}
                  confirmMessages={{
                    submit: isManualAuditEnabled(currentOrder.audit)
                      ? t('app.kuaizhizao.warehouseOutbound.delivery.submitConfirmAudit')
                      : t('app.kuaizhizao.warehouseOutbound.delivery.submitConfirmAuto'),
                  }}
                />
              ) : null}
              {isOutboundConfirmable(currentOrder) && currentOrder.outbound_type !== 'outsource_issue' && (
                <Tooltip title={getOutboundConfirmBlockedReason(currentOrder)}>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={() => void handleConfirm(currentOrder)}
                    disabled={!!getOutboundConfirmBlockedReason(currentOrder)}
                  >
                    {getOutboundConfirmLabel(currentOrder)}
                  </Button>
                </Tooltip>
              )}
              {isOutboundWithdrawable(currentOrder) && currentOrder.outbound_type !== 'outsource_issue' && (
                <Button danger icon={<RollbackOutlined />} onClick={() => handleWithdraw(currentOrder)}>
                  {t('app.kuaizhizao.warehouseOutbound.action.withdraw')}
                </Button>
              )}
            </Space>
          ) : null
        }
        traceDocument={outboundTraceDocument}
        supplementary={outboundDetailSupplementary}
        linesTitle={t('app.kuaizhizao.warehouseOutbound.section.outboundDetails')}
        lines={
          currentOrder?.items && currentOrder.items.length > 0 ? (
            <>
<style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                  <Table
                    className="warehouse-detail-table"
                    size="small"
                    rowKey={(record, idx) => {
                      const r = record as OutboundOrderItem;
                      return r.id != null ? String(r.id) : `row-${idx ?? 0}`;
                    }}
                    pagination={false}
                    columns={
                      currentOrder.outbound_type === 'production_picking'
                        ? pickingDetailColumns
                        : deliveryDetailColumns
                    }
                    dataSource={currentOrder.items}
                  />
            </>
          ) : undefined
        }
      />
      {PrintModal}
    </ListPageTemplate>
  );
};

export default OutboundPage;
