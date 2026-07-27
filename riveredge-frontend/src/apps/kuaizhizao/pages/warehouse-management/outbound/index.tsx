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
import { App, Button, Tag, Space, Modal, Card, Table, Tooltip, Typography, Spin, Empty, Upload, Select, theme as AntdTheme } from 'antd';
import { CheckCircleOutlined, RollbackOutlined, PrinterOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
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

import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { UniPullLoadButton } from '../../../../../components/uni-pull';
import {
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../WarehouseTraceBriefFooter';
import { warehouseApi, workOrderApi, outsourceMaterialIssueApi } from '../../../services/production';
import { LinkedOqcPanel } from '../../quality-management/components/LinkedInspectionPanel';
import { getOutboundLifecycle } from '../../../utils/outboundLifecycle';
import dayjs from 'dayjs';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { buildKuaizhizaoPullCreateMenuItems } from '../../../constants/documentActionRegistry';
import { uploadMultipleFiles } from '../../../../../services/file';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
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
  DOCUMENT_PROGRESS_COLUMN_WIDTH,
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
import {
  type OutboundHubOrder,
  type OutboundIssueType,
  getOutboundIssueTypeLabel,
  outboundIssueTypeSegmentOptions,
  isOutboundConfirmable,
  isOutboundWithdrawable,
  OUTBOUND_POSTED_STATUSES,
  outboundConfirmCapabilityReasonMessage,
  outboundWithdrawCapabilityReasonMessage,
  mapOutsourceIssueToOutbound,
  outboundDocumentCode,
  outboundSourceDocNo,
  resolveOutboundHubDateRaw,
  resolveOutboundHubOperator,
} from './outboundHubTypes';
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
}

function outboundDocumentTrackingType(
  order: OutboundOrder,
): 'production_picking' | 'sales_delivery' | 'other_outbound' | 'material_borrow' | undefined {
  if (order.outbound_type === 'sales_delivery') return 'sales_delivery';
  if (order.outbound_type === 'production_picking') return 'production_picking';
  if (order.outbound_type === 'other_outbound') return 'other_outbound';
  if (order.outbound_type === 'material_borrow') return 'material_borrow';
  return undefined;
}

const SALES_DELIVERY_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_sales_deliveries';
const PRODUCTION_PICKING_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_production_pickings';

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

  useEffect(() => {
    if (salesDeliveryListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [salesDeliveryListCustomFields.length]);

  useEffect(() => {
    if (productionPickingListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [productionPickingListCustomFields.length]);

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OutboundOrder | null>(null);
  const [salesDeliveryAttachments, setSalesDeliveryAttachments] = useState<any[]>([]);
  const [savingSalesDeliveryAttachments, setSavingSalesDeliveryAttachments] = useState(false);
  const [outboundTrackingRefreshKey, setOutboundTrackingRefreshKey] = useState(0);

  const [executionConfig, setExecutionConfig] = useState<any>(null);
  const outboundPerms = useResourcePermissions('kuaizhizao:outbound');
  const packingBindingPerms = useResourcePermissions('kuaizhizao:production-execution-packing-binding');

  const [confirmPreviewOpen, setConfirmPreviewOpen] = useState(false);
  const [confirmPreviewRecord, setConfirmPreviewRecord] = useState<OutboundOrder | null>(null);

  const outboundDocTrackingType = currentOrder ? outboundDocumentTrackingType(currentOrder) : undefined;
  const outboundTracking = useDocumentTracking(outboundDocTrackingType, currentOrder?.id, outboundTrackingRefreshKey);

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
    navigate(location.pathname, { replace: true, state: null });
    openConfirmPreview({ id: dc.id, outbound_type: dc.outbound_type });
  }, [location.pathname, location.state, navigate, openConfirmPreview]);

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
        setDetailDrawerVisible(true);
        setOutboundTrackingRefreshKey((k) => k + 1);
        return;
      }
      setCurrentOrder(detailData ? { ...detailData, outbound_type: record.outbound_type } : null);
      if (record.outbound_type === 'sales_delivery') {
        setSalesDeliveryAttachments(mapAttachmentsToUploadList((detailData as OutboundOrder)?.attachments));
      } else {
        setSalesDeliveryAttachments([]);
      }
      setDetailDrawerVisible(true);
      setOutboundTrackingRefreshKey((k) => k + 1);
      if (record.outbound_type === 'sales_delivery' && record.id != null) {
        await loadSalesDeliveryFieldValuesForDetail(record.id);
      } else if (record.outbound_type === 'production_picking' && record.id != null) {
        await loadProductionPickingFieldValuesForDetail(record.id);
      }
    } catch {
      messageApi.error(t('app.kuaizhizao.warehouseOutbound.msg.loadDetailFailed'));
    }
  };

  const isEditableSalesDelivery = (order?: OutboundOrder | null) =>
    order?.outbound_type === 'sales_delivery' &&
    ['draft', '草稿', '待出库'].includes(String(order?.status || ''));

  const handleSaveSalesDeliveryAttachments = async () => {
    if (!currentOrder?.id || !isEditableSalesDelivery(currentOrder)) return;
    setSavingSalesDeliveryAttachments(true);
    try {
      await warehouseApi.salesDelivery.update(String(currentOrder.id), {
        customer_id: Number(currentOrder.customer_id || 0),
        customer_name: currentOrder.customer_name || '',
        warehouse_id: Number(currentOrder.warehouse_id || 0),
        warehouse_name: currentOrder.warehouse_name || '',
        notes: currentOrder.notes || undefined,
        attachments: normalizeDocumentAttachments(salesDeliveryAttachments),
      });
      const detail = await warehouseApi.salesDelivery.get(String(currentOrder.id));
      setCurrentOrder({ ...detail, outbound_type: 'sales_delivery' });
      setSalesDeliveryAttachments(mapAttachmentsToUploadList(detail.attachments));
      messageApi.success(t('app.kuaizhizao.warehouseOutbound.msg.attachmentsSaved'));
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseOutbound.msg.saveAttachmentsFailed'));
    } finally {
      setSavingSalesDeliveryAttachments(false);
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const outboundRowKey = (record: OutboundOrder) => `${record.outbound_type}::${record.id}`;

  const isOutboundDeletable = (record: OutboundOrder) =>
    isOutboundConfirmable(record) &&
    (record.outbound_type === 'production_picking' ||
      record.outbound_type === 'sales_delivery' ||
      record.outbound_type === 'other_outbound' ||
      record.outbound_type === 'material_borrow');

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
        .map((key) => listRowsRef.current.get(String(key)))
        .filter((row): row is OutboundOrder => row != null),
    [selectedRowKeys],
  );

  const canToolbarPrint =
    selectedRowKeys.length === 1 &&
    !!selectedOutboundForBatch[0] &&
    isOutboundPrintable(selectedOutboundForBatch[0]);

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
      .map((k) => listRowsRef.current.get(String(k)))
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

  const pickingDetailColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.requiredQty'), dataIndex: 'required_quantity', width: 100, align: 'right' as const , render: formatQuantity },
      { title: t('app.kuaizhizao.warehouseOutbound.col.pickedQty'), dataIndex: 'picked_quantity', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseOutbound.col.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.warehouseName'), dataIndex: 'warehouse_name', width: 120 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.batchNo'), dataIndex: 'batch_number', width: 100 },
    ],
    [t],
  );

  const deliveryDetailColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.materialName'), dataIndex: 'material_name', width: 150 },
      { title: t('app.kuaizhizao.warehouseOutbound.col.deliveryQty'), dataIndex: 'delivery_quantity', width: 100, align: 'right' as const },
      { title: t('app.kuaizhizao.warehouseOutbound.col.unit'), dataIndex: 'material_unit', width: 60 },
      { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes' },
    ],
    [t],
  );

  const columns: ProColumns<OutboundOrder>[] = useMemo(
    () => alignProColumns<OutboundOrder>([
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.subjectDocNo'),
      key: 'delivery_code',
      dataIndex: ['delivery_code', 'picking_code'],
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={getOutboundStackedPrimary(record)}
          secondary={String(record.delivery_code || record.picking_code || '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.outboundCode'),
      dataIndex: ['delivery_code', 'picking_code'],
      hideInTable: true,
      sorter: true,
    },
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.outboundType'),
      dataIndex: 'outbound_type',
      width: 100,
      sorter: true,
      hideInSearch: true,
      valueEnum: {
        production_picking: { text: getOutboundIssueTypeLabel(t, 'production_picking'), status: 'processing' },
        sales_delivery: { text: getOutboundIssueTypeLabel(t, 'sales_delivery'), status: 'success' },
        outsource_issue: { text: getOutboundIssueTypeLabel(t, 'outsource_issue'), status: 'warning' },
        other_outbound: { text: getOutboundIssueTypeLabel(t, 'other_outbound'), status: 'default' },
        material_borrow: { text: getOutboundIssueTypeLabel(t, 'material_borrow'), status: 'default' },
      },
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
      width: DOCUMENT_PROGRESS_COLUMN_WIDTH,
      uniTableKeepWidth: true,
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
      title: t('app.kuaizhizao.warehouseOutbound.col.time'),
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
    {
      title: t('app.kuaizhizao.warehouseOutbound.col.lifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
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
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
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
          {isOutboundConfirmable(record) && record.outbound_type !== 'outsource_issue' && (
            <Tooltip
              title={
                record.outbound_type === 'production_picking' &&
                executionConfig &&
                executionConfig.current_user_can_confirm_picking === false
                  ? t('app.kuaizhizao.warehouseOutbound.msg.noConfirmPickingPermission')
                  : undefined
              }
            >
              <Button
                {...rowActionKind('execute')}
                {...rowActionLabelKeep()}
                onClick={() => void handleConfirm(record)}
                disabled={
                  record.outbound_type === 'production_picking' &&
                  executionConfig &&
                  executionConfig.current_user_can_confirm_picking === false
                }
              >
                {t('app.kuaizhizao.warehouseOutbound.action.confirmOutbound')}
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
      outboundPerms,
      packingBindingPerms.canRead,
      salesDeliveryCustomFieldColumns,
      productionPickingCustomFieldColumns,
    ],
  );

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
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const typeFilter = outboundTypeFilterRef.current;
            const listParams = resolveOutboundHubListParams(
              {
                ...(searchFormValues as Record<string, unknown>),
                outbound_type: typeFilter === 'all' ? undefined : typeFilter,
              },
              sort,
            );
            const result = await fetchOutboundHubList(
              {
                ...(params as Record<string, unknown>),
                ...listParams,
              },
              {
              enrichProductionPickingRecordsWithCustomFields,
              enrichSalesDeliveryRecordsWithCustomFields,
            });
            const next = new Map<string, OutboundOrder>();
            for (const row of result.data ?? []) {
              next.set(outboundRowKey(row), row);
            }
            listRowsRef.current = next;
            return result;
          } catch {
            messageApi.error(t('app.kuaizhizao.warehouseOutbound.msg.loadListFailed'));
            return { data: [], success: false, total: 0 };
          }
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
                    const row = selectedOutboundForBatch[0];
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

      <OutboundQuickPullModals ref={quickPullRef} onSuccess={() => actionRef.current?.reload()} />

      <OutboundConfirmPreviewModal
        open={confirmPreviewOpen}
        record={confirmPreviewRecord}
        executionConfig={executionConfig}
        onClose={closeConfirmPreview}
        onSuccess={() => void handleConfirmPreviewSuccess()}
      />

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.warehouseOutbound.detail.title')} - ${currentOrder?.delivery_code || currentOrder?.picking_code || ''}`}
        open={detailDrawerVisible}
        zIndex={outboundDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentOrder(null);
          setSalesDeliveryAttachments([]);
          resetSalesDeliveryDetailFieldValues();
          resetProductionPickingDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        extra={
          currentOrder ? (
            <Space>
              {isOutboundConfirmable(currentOrder) && currentOrder.outbound_type !== 'outsource_issue' && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={() => void handleConfirm(currentOrder)}
                  disabled={
                    currentOrder.outbound_type === 'production_picking' &&
                    executionConfig &&
                    executionConfig.current_user_can_confirm_picking === false
                  }
                >
                  {t('app.kuaizhizao.warehouseOutbound.action.confirmOutbound')}
                </Button>
              )}
              {isOutboundWithdrawable(currentOrder) && currentOrder.outbound_type !== 'outsource_issue' && (
                <Button danger icon={<RollbackOutlined />} onClick={() => handleWithdraw(currentOrder)}>
                  {t('app.kuaizhizao.warehouseOutbound.action.withdraw')}
                </Button>
              )}
            </Space>
          ) : null
        }
        customContent={
          currentOrder ? (
            <div style={{ padding: '16px 0' }}>
              <Card title={t('app.kuaizhizao.warehouseOutbound.section.basicInfo')} style={{ marginBottom: 16 }}>
                <p><strong>{t('app.kuaizhizao.warehouseOutbound.field.outboundCode')}：</strong>{currentOrder.delivery_code || currentOrder.picking_code}</p>
                <p><strong>{t('app.kuaizhizao.warehouseOutbound.field.outboundType')}：</strong>
                  <Tag color={
                    currentOrder.outbound_type === 'production_picking' ? 'processing'
                      : currentOrder.outbound_type === 'outsource_issue' ? 'warning'
                        : 'success'
                  }>
                    {currentOrder.outbound_type
                      ? getOutboundIssueTypeLabel(t, currentOrder.outbound_type)
                      : ''}
                  </Tag>
                </p>
                <p><strong>{t('app.kuaizhizao.warehouseOutbound.col.status')}：</strong>
                  <Tag color={
                    currentOrder.status === '已完成' ? 'success' :
                      currentOrder.status === '已确认' ? 'processing' :
                        currentOrder.status === '已取消' ? 'error' : 'default'
                  }>
                    {currentOrder.status}
                  </Tag>
                </p>
                {currentOrder.customer_name && (
                  <p><strong>{t('app.kuaizhizao.warehouseOutbound.col.customer')}：</strong>{currentOrder.customer_name}</p>
                )}
                {currentOrder.work_order_code && (
                  <p><strong>{t('app.kuaizhizao.warehouseOutbound.col.workOrderCode')}：</strong>{currentOrder.work_order_code}</p>
                )}
                <p><strong>{t('app.kuaizhizao.warehouseOutbound.field.warehouse')}：</strong>{currentOrder.warehouse_name}</p>
                <p>
                  <strong>{t('app.kuaizhizao.warehouseOutbound.col.outboundDate')}：</strong>
                  {(() => {
                    const raw = resolveOutboundHubDateRaw(currentOrder);
                    return raw ? formatDateTimeBySiteSetting(raw as string) : '-';
                  })()}
                </p>
                <p>
                  <strong>{t('app.kuaizhizao.warehouseOutbound.col.operator')}：</strong>
                  {resolveOutboundHubOperator(currentOrder) || '-'}
                </p>
                <p><strong>{t('app.kuaizhizao.warehouseOutbound.col.totalQty')}：</strong>{currentOrder.total_quantity}</p>
                <p><strong>{t('app.kuaizhizao.warehouseOutbound.col.totalSku')}：</strong>{currentOrder.total_items}</p>
                {currentOrder.outbound_type === 'sales_delivery' &&
                hasCustomFieldsDetailContent(salesDeliveryListCustomFields, salesDeliveryDetailCustomFieldValues) ? (
                  <div style={{ marginTop: 12 }}>
                    <CustomFieldsDetailSection
                      customFields={salesDeliveryListCustomFields}
                      customFieldValues={salesDeliveryDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                {currentOrder.outbound_type === 'production_picking' &&
                hasCustomFieldsDetailContent(
                  productionPickingListCustomFields,
                  productionPickingDetailCustomFieldValues,
                ) ? (
                  <div style={{ marginTop: 12 }}>
                    <CustomFieldsDetailSection
                      customFields={productionPickingListCustomFields}
                      customFieldValues={productionPickingDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                {currentOrder.notes && (
                  <p style={{ marginTop: 12 }}><strong>{t('app.kuaizhizao.common.fieldNotes')}：</strong>{currentOrder.notes}</p>
                )}
                {currentOrder.outbound_type === 'sales_delivery' ? (
                  <div style={{ marginTop: 12 }}>
                    <Typography.Text strong>{t('app.kuaizhizao.warehouseOutbound.section.attachments')}</Typography.Text>
                    {isEditableSalesDelivery(currentOrder) ? (
                      <>
                        <Upload
                          fileList={salesDeliveryAttachments}
                          onChange={({ fileList }) => setSalesDeliveryAttachments(fileList)}
                          customRequest={async (options) => {
                            try {
                              const res = await uploadMultipleFiles([options.file as File], {
                                category: 'sales_delivery_attachments',
                              });
                              options.onSuccess?.(res[0], options.file as any);
                            } catch (err) {
                              options.onError?.(err as Error);
                            }
                          }}
                          multiple
                          style={{ marginTop: 8, display: 'block' }}
                        >
                          <Button>{t('app.kuaizhizao.warehouseOutbound.action.uploadAttachments')}</Button>
                        </Upload>
                        <Button
                          size="small"
                          style={{ marginTop: 8 }}
                          loading={savingSalesDeliveryAttachments}
                          onClick={handleSaveSalesDeliveryAttachments}
                        >
                          {t('app.kuaizhizao.warehouseOutbound.action.saveAttachments')}
                        </Button>
                      </>
                    ) : (currentOrder.attachments?.length ?? 0) > 0 ? (
                      <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                        {(currentOrder.attachments ?? []).map((file) => (
                          <li key={file.uid ?? file.name}>
                            <a href={file.url} target="_blank" rel="noreferrer">
                              {file.name ?? t('app.kuaizhizao.warehouseOutbound.detail.attachmentFallback')}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        {t('app.kuaizhizao.warehouseOutbound.detail.noAttachments')}
                      </Typography.Text>
                    )}
                  </div>
                ) : null}
              </Card>

              <DetailDrawerSection title={t('app.kuaizhizao.warehouseOutbound.section.lifecycle')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getOutboundLifecycle(currentOrder as Record<string, unknown>, t);
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
                  {currentOrder.id != null && outboundDocumentTrackingType(currentOrder) ? (
                    <DetailDrawerInlineFullChain
                      documentType={outboundDocumentTrackingType(currentOrder)!}
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
                          }}
                        />
                      )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              {currentOrder.outbound_type === 'sales_delivery' && currentOrder.id ? (
                <DetailDrawerSection title={t('app.kuaizhizao.warehouseOutbound.section.oqc')}>
                  <LinkedOqcPanel
                    salesDeliveryId={currentOrder.id}
                    active={detailDrawerVisible}
                    onNavigate={(path) => {
                      setDetailDrawerVisible(false);
                      setCurrentOrder(null);
                      navigate(path);
                    }}
                  />
                </DetailDrawerSection>
              ) : null}

              {currentOrder.items && currentOrder.items.length > 0 && (
                <Card title={t('app.kuaizhizao.warehouseOutbound.section.outboundDetails')}>
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
                </Card>
              )}

              {currentOrder?.id && (
                <DetailDrawerSection title={t('app.kuaizhizao.warehouseOutbound.section.operationLog')}>
                  {outboundTracking.loading && (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                      <Spin />
                    </div>
                  )}
                  {outboundTracking.error && !outboundTracking.loading && (
                    <Typography.Text type="danger">{outboundTracking.error}</Typography.Text>
                  )}
                  {outboundTracking.data && !outboundTracking.loading && (
                    <DocumentTrackingTimelineBody data={outboundTracking.data} />
                  )}
                  {!outboundTracking.loading && !outboundTracking.data && !outboundTracking.error && (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.warehouseOutbound.detail.noOperationLog')} />
                  )}
                </DetailDrawerSection>
              )}
            </div>
          ) : null
        }
      />
      {PrintModal}
    </ListPageTemplate>
  );
};

export default OutboundPage;
