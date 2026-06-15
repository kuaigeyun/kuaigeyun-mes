/**
 * 出库管理页面
 *
 * 提供出库单的管理功能，支持多种出库类型：生产领料、销售出库、退货出库等。
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProForm, ProFormSelect, type ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table, Tooltip, Typography, Spin, Empty, Upload, theme as AntdTheme } from 'antd';
import { EyeOutlined, CheckCircleOutlined, InboxOutlined, RollbackOutlined, PrinterOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';

import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { UniPullLoadButton } from '../../../../../components/uni-pull';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import {
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../WarehouseTraceBriefFooter';
import { warehouseApi, workOrderApi, outsourceMaterialIssueApi } from '../../../services/production';
import { LinkedOqcPanel } from '../../quality-management/components/LinkedInspectionPanel';
import { getOutboundLifecycle } from '../../../utils/outboundLifecycle';
import dayjs from 'dayjs';
import { listSalesOrders } from '../../../services/sales-order';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { buildKuaizhizaoPullCreateMenuItems } from '../../../constants/documentActionRegistry';
import { uploadMultipleFiles } from '../../../../../services/file';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import OutboundQuickPullModals, { type OutboundQuickPullModalsRef } from './OutboundQuickPullModals';
import OutboundConfirmPreviewModal from './OutboundConfirmPreviewModal';
import { fetchOutboundHubList } from './outboundListAggregate';
import { batchConfirmOutboundDocuments, withdrawOutboundDocument } from './outboundBatchConfirm';
import {
  type OutboundHubOrder,
  type OutboundIssueType,
  OUTBOUND_ISSUE_TYPE_LABELS,
  isOutboundConfirmable,
  isOutboundWithdrawable,
  mapOutsourceIssueToOutbound,
  outboundDocumentCode,
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

interface WaveMergedItem {
  warehouse_name?: string;
  location_code?: string;
  material_code?: string;
  material_name?: string;
  total_quantity?: number;
  unit?: string;
  source_pickings?: string[];
}

interface WavePickingResult {
  wave_code: string;
  source_picking_ids: number[];
  total_items: number;
  merged_items: WaveMergedItem[];
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
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = AntdTheme.useToken();
  const outboundDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const quickPullRef = useRef<OutboundQuickPullModalsRef>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();

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

  // 批量出库 Modal
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const batchFormRef = useRef<ProFormInstance>();
  const [batchOutboundType, setBatchOutboundType] = useState<'production_picking' | 'sales_delivery'>('production_picking');

  const {
    customFields: productionPickingFormCustomFields,
    customFieldValues: productionPickingFormCustomFieldValues,
    extractFormValues: extractProductionPickingFormValues,
    saveCustomFieldValues: saveProductionPickingCustomFieldValues,
    resetFieldValues: resetProductionPickingFormFieldValues,
  } = useCustomFields({
    tableName: PRODUCTION_PICKING_CUSTOM_FIELD_TABLE,
    loadWhenOpen: true,
    open: batchModalVisible && batchOutboundType === 'production_picking',
  });

  const {
    customFields: salesDeliveryFormCustomFields,
    customFieldValues: salesDeliveryFormCustomFieldValues,
    extractFormValues: extractSalesDeliveryFormValues,
    saveCustomFieldValues: saveSalesDeliveryCustomFieldValues,
    resetFieldValues: resetSalesDeliveryFormFieldValues,
  } = useCustomFields({
    tableName: SALES_DELIVERY_CUSTOM_FIELD_TABLE,
    loadWhenOpen: true,
    open: batchModalVisible && batchOutboundType === 'sales_delivery',
  });

  const [workOrderOptions, setWorkOrderOptions] = useState<{ label: string; value: number }[]>([]);
  const [salesOrderOptions, setSalesOrderOptions] = useState<{ label: string; value: number }[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<{ label: string; value: number; name: string }[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [executionConfig, setExecutionConfig] = useState<any>(null);
  const [selectedOutboundKeys, setSelectedOutboundKeys] = useState<React.Key[]>([]);
  const [waveModalVisible, setWaveModalVisible] = useState(false);
  const [waveGenerating, setWaveGenerating] = useState(false);
  const [waveResult, setWaveResult] = useState<WavePickingResult | null>(null);

  const [confirmPreviewOpen, setConfirmPreviewOpen] = useState(false);
  const [confirmPreviewRecord, setConfirmPreviewRecord] = useState<OutboundOrder | null>(null);
  const [batchConfirmSubmitting, setBatchConfirmSubmitting] = useState(false);

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

  useEffect(() => {
    const dc = (location.state as OutboundPullEntryNavigationState | null)?.outboundDirectConfirm;
    if (!dc?.id || !dc.outbound_type) return;
    navigate(location.pathname, { replace: true, state: null });
    openConfirmPreview({ id: dc.id, outbound_type: dc.outbound_type });
  }, [location.pathname, location.state, navigate, openConfirmPreview]);

  /** 批量出库：加载工单、销售订单、仓库 */
  useEffect(() => {
    if (!batchModalVisible) return;
    const load = async () => {
      try {
        const [woRes, soRes, whRes] = await Promise.all([
          workOrderApi.list({ skip: 0, limit: 500 }),
          listSalesOrders({ skip: 0, limit: 500 }),
          masterWarehouseApi.list({ is_active: true }),
        ]);
        const woList = Array.isArray(woRes) ? woRes : (woRes as any)?.data ?? (woRes as any)?.items ?? [];
        const eligibleWo = woList.filter(
          (wo: any) => ['已下达', '进行中', 'released', 'in_progress'].includes(wo.status)
        );
        setWorkOrderOptions(
          eligibleWo.map((wo: any) => ({
            label: `${wo.code || wo.id} - ${wo.product_name || wo.name || '-'}`,
            value: wo.id,
          }))
        );
        const soData = (soRes as any)?.data ?? (soRes as any)?.items ?? soRes ?? [];
        const soList = Array.isArray(soData) ? soData : [];
        const eligibleSo = soList.filter(
          (so: any) => ['已审核', '已确认', 'AUDITED', 'CONFIRMED'].includes(so.status)
        );
        setSalesOrderOptions(
          eligibleSo.map((so: any) => ({
            label: `${so.order_code || so.code || so.id} - ${so.customer_name || '-'}`,
            value: so.id,
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
        setSalesOrderOptions([]);
        setWarehouseOptions([]);
      }
    };
    load();
  }, [batchModalVisible]);

  /** 关闭批量出库弹窗并重置表单 */
  const resetBatchOutboundModal = () => {
    setBatchModalVisible(false);
    batchFormRef.current?.resetFields();
    resetProductionPickingFormFieldValues();
    resetSalesDeliveryFormFieldValues();
  };

  /** 批量出库提交 */
  const handleBatchOutboundSubmit = async () => {
    try {
      const values = await batchFormRef.current?.validateFieldsReturnFormatValue?.();
      if (!values) {
        await batchFormRef.current?.validateFields();
        return;
      }
      const type = (values.batch_outbound_type || batchOutboundType) as 'production_picking' | 'sales_delivery';
      setBatchSubmitting(true);

      const { customData } =
        type === 'sales_delivery'
          ? extractSalesDeliveryFormValues(values)
          : extractProductionPickingFormValues(values);

      const saveCustomFieldsToCreated = async (recordIds: number[]) => {
        if (Object.keys(customData).length === 0) return;
        const saveFn =
          type === 'sales_delivery'
            ? saveSalesDeliveryCustomFieldValues
            : saveProductionPickingCustomFieldValues;
        for (const recordId of recordIds) {
          if (recordId > 0) {
            await saveFn(recordId, customData);
          }
        }
      };

      if (type === 'sales_delivery') {
        const orderIds = values.sales_order_ids as number[];
        const warehouseId = values.warehouse_id as number;
        const wh = warehouseOptions.find((w) => w.value === warehouseId);
        if (!orderIds?.length) {
          messageApi.warning('请选择至少一个销售订单');
          return;
        }
        if (!warehouseId) {
          messageApi.warning('请选择出库仓库');
          return;
        }
        let success = 0;
        const createdIds: number[] = [];
        for (const id of orderIds) {
          try {
            const created = await warehouseApi.salesDelivery.pullFromSalesOrder({
              sales_order_id: id,
              warehouse_id: warehouseId,
              warehouse_name: wh?.name,
            });
            const recordId = Number((created as { id?: number })?.id ?? 0);
            if (recordId > 0) createdIds.push(recordId);
            success++;
          } catch (e: any) {
            messageApi.warning(`销售订单 ${id} 上拉失败：${e?.message || e?.response?.data?.detail || '未知错误'}`);
          }
        }
        await saveCustomFieldsToCreated(createdIds);
        messageApi.success(`批量销售出库成功，共创建 ${success} 张销售出库单`);
      } else {
        const workOrderIds = values.work_order_ids as number[];
        const warehouseId = values.warehouse_id as number;
        const wh = warehouseOptions.find((w) => w.value === warehouseId);
        if (!workOrderIds?.length) {
          messageApi.warning('请选择至少一个工单');
          return;
        }
        if (!warehouseId) {
          messageApi.warning('请选择出库仓库');
          return;
        }
        const result = await warehouseApi.productionPicking.batchPick({
          work_order_ids: workOrderIds,
          warehouse_id: warehouseId,
          warehouse_name: wh?.name,
        });
        const list = Array.isArray(result) ? result : (result as any)?.data ?? (result as any)?.items ?? [];
        const createdIds = list
          .map((row: { id?: number }) => Number(row?.id ?? 0))
          .filter((id: number) => id > 0);
        await saveCustomFieldsToCreated(createdIds);
        messageApi.success(`批量生产领料成功，共创建 ${list.length} 张领料单`);
      }
      resetBatchOutboundModal();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || e?.response?.data?.detail || '批量出库失败');
    } finally {
      setBatchSubmitting(false);
    }
  };

  const handleCreate = () => {
    quickPullRef.current?.open('work_order');
  };

  useNewShortcut(handleCreate);

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
      messageApi.error('获取出库单详情失败');
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
      messageApi.success('附件已保存');
    } catch (error: any) {
      messageApi.error(error?.message || '保存附件失败');
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

  const handleBatchConfirm = async (keys: React.Key[]) => {
    if (!keys.length) {
      messageApi.warning('请先选择待出库单据');
      return;
    }
    const records = keys
      .map((key) => {
        const [type, id] = String(key).split('::');
        return { outbound_type: type as OutboundIssueType, id: Number(id) } as OutboundOrder;
      })
      .filter((r) => r.id && isOutboundConfirmable(r));
    if (!records.length) {
      messageApi.warning('所选单据均不可确认出库');
      return;
    }
    setBatchConfirmSubmitting(true);
    try {
      const result = await batchConfirmOutboundDocuments(records);
      if (result.success > 0) {
        messageApi.success(`成功确认 ${result.success} 张出库单`);
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
      }
      if (result.failed.length) {
        messageApi.warning(
          `${result.failed.length} 张失败：${result.failed.slice(0, 3).map((f) => f.message).join('；')}`,
        );
      }
    } finally {
      setBatchConfirmSubmitting(false);
    }
  };

  const handleWithdraw = (record: OutboundOrder) => {
    Modal.confirm({
      title: '撤回出库',
      content: `确定撤回单据 "${outboundDocumentCode(record)}" 吗？系统将回冲库存并恢复待出库状态。`,
      onOk: async () => {
        try {
          await withdrawOutboundDocument(record);
          messageApi.success('撤回成功');
          invalidateMenuBadgeCounts();
          await refreshOrderAfterConfirm(record);
        } catch (e: unknown) {
          const err = e as { message?: string; response?: { data?: { detail?: string } } };
          messageApi.error(err?.message || err?.response?.data?.detail || '撤回失败');
        }
      },
    });
  };

  const handlePrint = async (record: OutboundOrder) => {
    if (!record.id) return;
    try {
      const id = String(record.id);
      if (record.outbound_type === 'sales_delivery') {
        await warehouseApi.salesDelivery.print(id);
      } else if (record.outbound_type === 'other_outbound') {
        await warehouseApi.otherOutbound.print(id);
      } else if (record.outbound_type === 'material_borrow') {
        await warehouseApi.materialBorrow.print(id);
      } else {
        messageApi.warning('该类型暂不支持打印');
        return;
      }
      messageApi.success('已发送打印请求');
    } catch (e: unknown) {
      const err = e as { message?: string };
      messageApi.error(err?.message || '打印失败');
    }
  };

  const handleConfirm = async (record: OutboundOrder) => {
    if (record.outbound_type === 'outsource_issue') return;
    openConfirmPreview(record);
  };

  const selectedProductionPickingIds = useMemo(
    () =>
      selectedOutboundKeys
        .map((key) => String(key).split('::'))
        .filter(([type, id]) => type === 'production_picking' && Number(id) > 0)
        .map(([, id]) => Number(id)),
    [selectedOutboundKeys],
  );

  const handleGenerateWave = async () => {
    if (!selectedProductionPickingIds.length) {
      messageApi.warning('请先勾选生产领料单');
      return;
    }
    try {
      setWaveGenerating(true);
      const result = await warehouseApi.wavePicking.generate({
        picking_ids: selectedProductionPickingIds,
      });
      setWaveResult(result as WavePickingResult);
      setWaveModalVisible(true);
      messageApi.success('波次拣货单生成成功');
    } catch (e: any) {
      messageApi.error(e?.message || '生成波次拣货单失败');
    } finally {
      setWaveGenerating(false);
    }
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
    return '出库单';
  };

  const salesDeliveryCustomFieldColumns = generateSalesDeliveryCustomFieldColumns();
  const productionPickingCustomFieldColumns = generateProductionPickingCustomFieldColumns();
  const columns: ProColumns<OutboundOrder>[] = [
    {
      title: '主体 / 单号',
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
      title: '出库单号',
      dataIndex: ['delivery_code', 'picking_code'],
      hideInTable: true,
    },
    {
      title: '出库类型',
      dataIndex: 'outbound_type',
      width: 100,
      valueEnum: {
        production_picking: { text: OUTBOUND_ISSUE_TYPE_LABELS.production_picking, status: 'processing' },
        sales_delivery: { text: OUTBOUND_ISSUE_TYPE_LABELS.sales_delivery, status: 'success' },
        outsource_issue: { text: OUTBOUND_ISSUE_TYPE_LABELS.outsource_issue, status: 'warning' },
        other_outbound: { text: OUTBOUND_ISSUE_TYPE_LABELS.other_outbound, status: 'default' },
        material_borrow: { text: OUTBOUND_ISSUE_TYPE_LABELS.material_borrow, status: 'default' },
      },
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      hideInTable: true,
      ellipsis: true,
    },
    {
      title: '工单号',
      dataIndex: 'work_order_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: '出库数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '出库品种',
      dataIndex: 'total_items',
      width: 100,
      align: 'right',
    },
    {
      title: '出库仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作员',
      dataIndex: 'delivered_by',
      width: 100,
      ellipsis: true,
    },
    {
      title: '出库日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
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
        const lifecycle = getOutboundLifecycle(record as Record<string, unknown>);
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
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {isOutboundConfirmable(record) && record.outbound_type !== 'outsource_issue' && (
            <Tooltip
              title={
                record.outbound_type === 'production_picking' &&
                executionConfig &&
                executionConfig.current_user_can_confirm_picking === false
                  ? '当前业务配置下，您无权限确认生产领料'
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
                确认出库
              </Button>
            </Tooltip>
          )}
          {isOutboundWithdrawable(record) && record.outbound_type !== 'outsource_issue' && (
            <Button {...rowActionKind('revoke')} {...rowActionLabelKeep()} onClick={() => handleWithdraw(record)}>
              撤回
            </Button>
          )}
          {['sales_delivery', 'other_outbound', 'material_borrow'].includes(String(record.outbound_type)) &&
            isOutboundWithdrawable(record) && (
            <Button {...rowActionKind('print')} onClick={() => void handlePrint(record)} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="出库管理"
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.outbound"
        actionRef={actionRef}
        rowKey={(record) => `${record.outbound_type}::${record.id}`}
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            return await fetchOutboundHubList(params as Record<string, unknown>, {
              enrichProductionPickingRecordsWithCustomFields,
              enrichSalesDeliveryRecordsWithCustomFields,
            });
          } catch {
            messageApi.error('获取出库单列表失败');
            return { data: [], success: false, total: 0 };
          }
        }}
        enableRowSelection={true}
        selectedRowKeys={selectedOutboundKeys}
        onRowSelectionChange={setSelectedOutboundKeys}
        rowSelectionGetCheckboxProps={(record) => ({ disabled: !isOutboundConfirmable(record) })}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            for (const key of keys) {
              const [type, id] = String(key).split('::');
              if (type === 'production_picking') {
                await warehouseApi.productionPicking.delete(id);
              } else if (type === 'sales_delivery') {
                await warehouseApi.salesDelivery.delete(id);
              } else if (type === 'other_outbound') {
                await warehouseApi.otherOutbound.delete(id);
              } else if (type === 'material_borrow') {
                await warehouseApi.materialBorrow.delete(id);
              }
            }
            messageApi.success(`成功删除 ${keys.length} 条记录`);
            invalidateMenuBadgeCounts();
            actionRef.current?.reload();
          } catch (error: unknown) {
            const err = error as { message?: string };
            messageApi.error(err?.message || '删除失败');
          }
        }}
        deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条出库单吗？`}
        toolBarRender={() => [
          <UniPullLoadButton
            key="pull"
            compactKey="outbound-pull-load"
            type="primary"
            variant="solid"
            menuItems={buildKuaizhizaoPullCreateMenuItems([
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
                actionKey: 'outbound.pull_from_sales_order',
                onClick: () => quickPullRef.current?.open('sales_order'),
              },
              {
                actionKey: 'outbound.pull_from_outsource_work_order',
                onClick: () => quickPullRef.current?.open('outsource'),
              },
            ])}
          />,
        ]}
        toolBarActionsAfterBatch={[
          <UniBatchMenuButton
            key="batch-confirm"
            selectedRowKeys={selectedOutboundKeys}
            buttonText="批量操作"
            disabled={batchConfirmSubmitting}
            menuItems={[
              {
                key: 'batch-confirm',
                label: batchConfirmSubmitting ? '确认中…' : '批量确认出库',
                requireConfirm: true,
                confirmTitle: (count) => `确认批量出库 ${count} 张单据`,
                confirmDescription: '将按单据类型调用对应确认接口；不可确认的单据会跳过并汇总失败原因。',
                onClick: handleBatchConfirm,
              },
            ]}
          />,
        ]}
        toolBarActionsAfterDelete={[
          <Button
            key="batch"
            icon={<InboxOutlined />}
            onClick={() => {
              batchFormRef.current?.resetFields();
              resetProductionPickingFormFieldValues();
              resetSalesDeliveryFormFieldValues();
              setBatchOutboundType('production_picking');
              setBatchModalVisible(true);
            }}
          >
            批量出库
          </Button>,
          <Button
            key="wave-picking"
            loading={waveGenerating}
            disabled={!selectedProductionPickingIds.length}
            onClick={handleGenerateWave}
          >
            生成波次拣货单
          </Button>,
        ]}
        scroll={{ x: 2000 }}
      />

      <Modal
        title="批量出库"
        open={batchModalVisible}
        onCancel={resetBatchOutboundModal}
        onOk={handleBatchOutboundSubmit}
        confirmLoading={batchSubmitting}
        width={520}
        okText="确认出库"
      >
        <p style={{ marginBottom: 16, color: '#666' }}>
          根据上游单据批量创建出库单。生产领料：从工单下推；销售出库：从销售订单上拉。
        </p>
        <ProForm
          formRef={batchFormRef}
          submitter={false}
          layout="vertical"
          initialValues={{ batch_outbound_type: 'production_picking' }}
        >
          <ProFormSelect
            name="batch_outbound_type"
            label="出库类型"
            rules={[{ required: true }]}
            options={[
              { label: '生产领料（从工单）', value: 'production_picking' },
              { label: '销售出库（从销售订单）', value: 'sales_delivery' },
            ]}
            fieldProps={{
              onChange: (v: string) => setBatchOutboundType(v as 'production_picking' | 'sales_delivery'),
            }}
          />
          {batchOutboundType === 'production_picking' && (
            <>
              <ProFormSelect
                name="work_order_ids"
                label="选择工单"
                rules={[{ required: true, message: '请选择至少一个工单' }]}
                mode="multiple"
                placeholder="请选择工单（已下达/进行中）"
                options={workOrderOptions}
                fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
              />
              <ProFormSelect
                name="warehouse_id"
                label="出库仓库"
                rules={[{ required: true, message: '请选择出库仓库' }]}
                placeholder="请选择仓库"
                options={warehouseOptions}
                fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
              />
              <CustomFieldsFormSection
                customFields={productionPickingFormCustomFields}
                customFieldValues={productionPickingFormCustomFieldValues}
                gridColumns={1}
              />
            </>
          )}
          {batchOutboundType === 'sales_delivery' && (
            <>
              <ProFormSelect
                name="sales_order_ids"
                label="选择销售订单"
                rules={[{ required: true, message: '请选择至少一个销售订单' }]}
                mode="multiple"
                placeholder="请选择销售订单（已审核/已确认）"
                options={salesOrderOptions}
                fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
              />
              <ProFormSelect
                name="warehouse_id"
                label="出库仓库"
                rules={[{ required: true, message: '请选择出库仓库' }]}
                placeholder="请选择仓库"
                options={warehouseOptions}
                fieldProps={{ showSearch: true, filterOption: (input, opt) => (opt?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()) }}
              />
              <CustomFieldsFormSection
                customFields={salesDeliveryFormCustomFields}
                customFieldValues={salesDeliveryFormCustomFieldValues}
                gridColumns={1}
              />
            </>
          )}
        </ProForm>
      </Modal>

      <OutboundQuickPullModals ref={quickPullRef} onSuccess={() => actionRef.current?.reload()} />

      <OutboundConfirmPreviewModal
        open={confirmPreviewOpen}
        record={confirmPreviewRecord}
        executionConfig={executionConfig}
        onClose={() => {
          setConfirmPreviewOpen(false);
          setConfirmPreviewRecord(null);
        }}
        onSuccess={() => void handleConfirmPreviewSuccess()}
      />

      <Modal
        title={`波次拣货单${waveResult?.wave_code ? ` - ${waveResult.wave_code}` : ''}`}
        open={waveModalVisible}
        footer={null}
        width={980}
        onCancel={() => setWaveModalVisible(false)}
      >
        <Typography.Paragraph type="secondary">
          已合并 {waveResult?.source_picking_ids?.length || 0} 张生产领料单，生成 {waveResult?.total_items || 0} 条拣货路线。
        </Typography.Paragraph>
        <Table<WaveMergedItem>
          size="small"
          rowKey={(row, idx) => `${row.material_code || 'm'}-${row.location_code || 'l'}-${idx}`}
          dataSource={waveResult?.merged_items || []}
          pagination={false}
          columns={[
            { title: '仓库', dataIndex: 'warehouse_name', width: 130 },
            { title: '库位', dataIndex: 'location_code', width: 120, render: (v) => v || '-' },
            { title: '物料编码', dataIndex: 'material_code', width: 130 },
            { title: '物料名称', dataIndex: 'material_name' },
            {
              title: '需求数量',
              dataIndex: 'total_quantity',
              width: 130,
              align: 'right',
              render: (v, row) => `${Number(v || 0)} ${row.unit || ''}`.trim(),
            },
            {
              title: '来源领料单',
              dataIndex: 'source_pickings',
              width: 260,
              render: (v: string[]) => (Array.isArray(v) ? v.join('、') : '-'),
            },
          ]}
        />
      </Modal>

      <DetailDrawerTemplate
        title={`出库单详情 - ${currentOrder?.delivery_code || currentOrder?.picking_code || ''}`}
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
                  确认出库
                </Button>
              )}
              {isOutboundWithdrawable(currentOrder) && currentOrder.outbound_type !== 'outsource_issue' && (
                <Button danger icon={<RollbackOutlined />} onClick={() => handleWithdraw(currentOrder)}>
                  撤回
                </Button>
              )}
            </Space>
          ) : null
        }
        customContent={
          currentOrder ? (
            <div style={{ padding: '16px 0' }}>
              <Card title="基本信息" style={{ marginBottom: 16 }}>
                <p><strong>出库单号：</strong>{currentOrder.delivery_code || currentOrder.picking_code}</p>
                <p><strong>出库类型：</strong>
                  <Tag color={
                    currentOrder.outbound_type === 'production_picking' ? 'processing'
                      : currentOrder.outbound_type === 'outsource_issue' ? 'warning'
                        : 'success'
                  }>
                    {currentOrder.outbound_type === 'production_picking'
                      ? OUTBOUND_ISSUE_TYPE_LABELS.production_picking
                      : currentOrder.outbound_type === 'outsource_issue'
                        ? OUTBOUND_ISSUE_TYPE_LABELS.outsource_issue
                        : currentOrder.outbound_type === 'other_outbound'
                          ? OUTBOUND_ISSUE_TYPE_LABELS.other_outbound
                          : currentOrder.outbound_type === 'material_borrow'
                            ? OUTBOUND_ISSUE_TYPE_LABELS.material_borrow
                            : OUTBOUND_ISSUE_TYPE_LABELS.sales_delivery}
                  </Tag>
                </p>
                <p><strong>状态：</strong>
                  <Tag color={
                    currentOrder.status === '已完成' ? 'success' :
                      currentOrder.status === '已确认' ? 'processing' :
                        currentOrder.status === '已取消' ? 'error' : 'default'
                  }>
                    {currentOrder.status}
                  </Tag>
                </p>
                {currentOrder.customer_name && (
                  <p><strong>客户：</strong>{currentOrder.customer_name}</p>
                )}
                {currentOrder.work_order_code && (
                  <p><strong>工单号：</strong>{currentOrder.work_order_code}</p>
                )}
                <p><strong>出库仓库：</strong>{currentOrder.warehouse_name}</p>
                <p><strong>出库日期：</strong>{currentOrder.delivery_date}</p>
                <p><strong>操作员：</strong>{currentOrder.delivered_by}</p>
                <p><strong>总数量：</strong>{currentOrder.total_quantity}</p>
                <p><strong>总品种：</strong>{currentOrder.total_items}</p>
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
                  <p style={{ marginTop: 12 }}><strong>备注：</strong>{currentOrder.notes}</p>
                )}
                {currentOrder.outbound_type === 'sales_delivery' ? (
                  <div style={{ marginTop: 12 }}>
                    <Typography.Text strong>附件</Typography.Text>
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
                          <Button>上传附件</Button>
                        </Upload>
                        <Button
                          size="small"
                          style={{ marginTop: 8 }}
                          loading={savingSalesDeliveryAttachments}
                          onClick={handleSaveSalesDeliveryAttachments}
                        >
                          保存附件
                        </Button>
                      </>
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
              </Card>

              {/* 生命周期 */}
              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getOutboundLifecycle(currentOrder as Record<string, unknown>);
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
                <DetailDrawerSection title="出货检验 (OQC)">
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

              {/* 出库单明细 */}
              {currentOrder.items && currentOrder.items.length > 0 && (
                <Card title="出库明细">
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
                        ? [
                            { title: '物料编号', dataIndex: 'material_code', width: 120 },
                            { title: '物料名称', dataIndex: 'material_name', width: 150 },
                            { title: '需求数量', dataIndex: 'required_quantity', width: 100, align: 'right' as const },
                            { title: '已领数量', dataIndex: 'picked_quantity', width: 100, align: 'right' as const },
                            { title: '单位', dataIndex: 'material_unit', width: 60 },
                            { title: '仓库', dataIndex: 'warehouse_name', width: 120 },
                            { title: '批次号', dataIndex: 'batch_number', width: 100 },
                          ]
                        : [
                            { title: '物料编号', dataIndex: 'material_code', width: 120 },
                            { title: '物料名称', dataIndex: 'material_name', width: 150 },
                            { title: '出库数量', dataIndex: 'delivery_quantity', width: 100, align: 'right' as const },
                            { title: '单位', dataIndex: 'material_unit', width: 60 },
                            { title: '备注', dataIndex: 'notes' },
                          ]
                    }
                    dataSource={currentOrder.items}
                  />
                </Card>
              )}

              {/* 操作记录 */}
              {currentOrder?.id && (
                <DetailDrawerSection title="操作记录">
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
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                  )}
                </DetailDrawerSection>
              )}
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default OutboundPage;
