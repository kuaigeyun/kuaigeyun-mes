import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Form as AntForm, Modal, Row, Select, Space, Table, Tag, Typography, Descriptions } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, PlayCircleOutlined, SnippetsOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import {
  DRAWER_CONFIG,
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  WAREHOUSE_DETAIL_TABLE_STYLES,
  useDetailDrawerDescriptionItems,
  detailDrawerBasicColumn,
} from '../../../../../components/layout-templates';
import type { LifecycleResult } from '../../../../../components/uni-lifecycle/types';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import type { LifecycleTranslateFn } from '../../../utils/lifecycleI18n';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { resolveListLifecycleStageFromSearch } from '../../../../../utils/listLifecycleStage';
import { assemblyTemplateApi } from '../../../services/assembly-template';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { StatusTag } from '../../../../../constants/statusBadges';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useTranslation } from 'react-i18next';
import { formatQuantity, formatPrice, formatAmount } from '../../../../../utils/format';
import { formDateRangeFormItemProps, toApiDateTimeString, nowSiteDateTimeString } from '../../../../../utils/formDate';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildWarehouseWorkflowStatusValueEnum,
  normalizeWarehouseListResponse,
  resolveAssemblyDisassemblyOrderListParams,
} from '../../../utils/warehouseListCore';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { alignDescriptionColumns, alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from './warehouseDocListFieldRank';
import {
  DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
  renderDocumentLineMaterialsPreview,
} from '../../sales-management/shared/documentLineMaterialsPreview';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { materialApi } from '../../../../master-data/services/material';
import type { Material } from '../../../../master-data/types/material';
import {
  loadBatchOptionsByMaterialId,
  type InventoryPickOption,
} from '../outbound/outboundConfirmInventoryOptions';
import OutboundBatchAllocationField from '../outbound/OutboundBatchAllocationField';
import {
  coerceBatchAllocationsDraft,
  isValidOutboundBatchAllocations,
  type OutboundBatchAllocation,
} from '../outbound/outboundBatchAllocation';
import {
  isMaterialBatchEntryEnabled,
  useWarehouseTrackingFlags,
} from './warehouseTrackingFlags';

type OrderLike = {
  id?: number;
  code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  product_material_id?: number;
  product_material_name?: string;
  product_batch_number?: string;
  total_quantity?: number;
  total_items?: number;
  status?: string;
  remarks?: string;
  updated_at?: string;
  executed_by_name?: string;
  executed_at?: string;
  items?: ItemLike[];
  [key: string]: any;
};

type ItemLike = {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
  batch_number?: string;
  status?: string;
  remarks?: string;
  [key: string]: any;
};

type OrderApi = {
  list: (params?: any) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  get: (id: string) => Promise<any>;
  createItem: (orderId: string, data: any) => Promise<any>;
  updateItem: (orderId: string, itemId: string, data: any) => Promise<any>;
  deleteItem: (orderId: string, itemId: string) => Promise<any>;
  execute: (orderId: string) => Promise<any>;
  applyTemplate?: (
    orderId: string,
    data: { template_id: number; replace_existing: boolean }
  ) => Promise<any>;
};

type PageConfig = {
  headerTitle: string;
  persistenceId: string;
  createButtonText: string;
  createModalTitle: string;
  detailTitlePrefix: string;
  dateField: string;
  dateLabel: string;
  actionNoun: string;
  executeActionLabel: string;
  createSuccessText: string;
  updateSuccessText?: string;
  addItemSuccessText: string;
  updateItemSuccessText?: string;
  executeSuccessText: string;
  deleteSuccessNoun: string;
  quantityLabel: string;
  listEmptyText: string;
  orderCodeLabel: string;
  itemDoneStatus: string;
  attachmentCategory: string;
  getLifecycle: (record: Record<string, unknown>, t: LifecycleTranslateFn) => LifecycleResult;
  /** manifest 资源前缀；拆卸单页须传 disassembly 模块 */
  permissionResource?: string;
  enableTemplateApply?: boolean;
  /** product=拆卸扣成品；items=组装扣组件 */
  stockConsumeKind: 'product' | 'items';
};

const orderStatusKeys: Record<string, { key: string; color: string }> = {
  draft: { key: 'app.kuaizhizao.warehouseCommon.statusDraft', color: 'default' },
  in_progress: { key: 'app.kuaizhizao.warehouseCommon.statusInProgress', color: 'processing' },
  completed: { key: 'app.kuaizhizao.warehouseCommon.statusCompleted', color: 'success' },
  cancelled: { key: 'app.kuaizhizao.warehouseCommon.statusCancelled', color: 'error' },
};

const itemStatusKeys: Record<string, { key: string; color: string }> = {
  pending: { key: 'app.kuaizhizao.warehouseCommon.statusPending', color: 'default' },
  consumed: { key: 'app.kuaizhizao.warehouseCommon.itemStatusConsumed', color: 'success' },
  produced: { key: 'app.kuaizhizao.warehouseCommon.itemStatusProduced', color: 'success' },
};

export const AssemblyDisassemblyOrdersPage: React.FC<{
  api: OrderApi;
  config: PageConfig;
}> = ({ api, config }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const orderPerms = useResourcePermissions(
    config.permissionResource ?? 'kuaizhizao:warehouse-management-assembly-orders',
  );
  const canExecuteOrder = orderPerms.canAction?.('execute') ?? false;
  const canApplyTemplate = config.enableTemplateApply ? canExecuteOrder : false;

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OrderLike | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderLike | null>(null);
  const [editingItem, setEditingItem] = useState<ItemLike | null>(null);
  const [templateOptions, setTemplateOptions] = useState<
    { label: string; value: number; productMaterialId?: number }[]
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
  const [productBatchManaged, setProductBatchManaged] = useState(false);
  const [productBatchOptions, setProductBatchOptions] = useState<InventoryPickOption[]>([]);
  const [productBatchLoading, setProductBatchLoading] = useState(false);
  const [itemBatchManaged, setItemBatchManaged] = useState(false);
  const [itemBatchOptions, setItemBatchOptions] = useState<InventoryPickOption[]>([]);
  const [itemBatchAllocs, setItemBatchAllocs] = useState<OutboundBatchAllocation[]>([]);
  const [itemBatchLoading, setItemBatchLoading] = useState(false);
  const trackingFlags = useWarehouseTrackingFlags();

  const resolveMaterialBatchManaged = async (
    material?: Material | null,
    materialId?: number,
  ): Promise<boolean> => {
    let managed = !!(material?.batchManaged ?? (material as { batch_managed?: boolean } | null | undefined)?.batch_managed);
    const uuid = String(material?.uuid ?? '').trim();
    if (uuid) {
      try {
        const full = await materialApi.get(uuid);
        managed = !!full.batchManaged;
      } catch {
        // keep picker / list flag
      }
      return isMaterialBatchEntryEnabled(trackingFlags, managed);
    }
    const id = Number(materialId ?? material?.id ?? 0);
    if (id > 0) {
      try {
        const res = await materialApi.list({ ids: [id], limit: 1 });
        const row = res.items?.[0];
        if (row) managed = !!row.batchManaged;
      } catch {
        // keep prior flag
      }
    }
    return isMaterialBatchEntryEnabled(trackingFlags, managed);
  };

  const loadProductBatchOptions = async (
    materialId?: number,
    warehouseId?: number,
  ): Promise<InventoryPickOption[]> => {
    if (config.stockConsumeKind !== 'product' || !materialId || !warehouseId) {
      setProductBatchOptions([]);
      return [];
    }
    setProductBatchLoading(true);
    try {
      const map = await loadBatchOptionsByMaterialId([materialId], warehouseId);
      const options = map[materialId] ?? [];
      setProductBatchOptions(options);
      return options;
    } catch {
      setProductBatchOptions([]);
      return [];
    } finally {
      setProductBatchLoading(false);
    }
  };

  const loadItemBatchOptions = async (
    materialId?: number,
    warehouseId?: number,
  ): Promise<InventoryPickOption[]> => {
    if (config.stockConsumeKind !== 'items' || !materialId || !warehouseId) {
      setItemBatchOptions([]);
      return [];
    }
    setItemBatchLoading(true);
    try {
      const map = await loadBatchOptionsByMaterialId([materialId], warehouseId);
      const options = map[materialId] ?? [];
      setItemBatchOptions(options);
      return options;
    } catch {
      setItemBatchOptions([]);
      return [];
    } finally {
      setItemBatchLoading(false);
    }
  };

  const syncProductOutboundBatch = async (
    material: Material | undefined,
    materialId?: number,
    warehouseId?: number,
    preferBatch?: string,
  ) => {
    if (config.stockConsumeKind !== 'product') {
      setProductBatchManaged(false);
      setProductBatchOptions([]);
      return;
    }
    const enabled = await resolveMaterialBatchManaged(material, materialId);
    setProductBatchManaged(enabled);
    if (!enabled) {
      setProductBatchOptions([]);
      createFormRef.current?.setFieldsValue({ product_batch_number: undefined });
      return;
    }
    const mid = Number(materialId ?? material?.id ?? createFormRef.current?.getFieldValue('product_material_id'));
    const wid = Number(warehouseId ?? createFormRef.current?.getFieldValue('warehouse_id'));
    const options = await loadProductBatchOptions(mid, wid);
    const preferred = String(preferBatch ?? createFormRef.current?.getFieldValue('product_batch_number') ?? '').trim();
    let next: string | undefined;
    if (preferred && options.some((o) => o.value === preferred)) {
      next = preferred;
    } else if (options.length === 1) {
      next = options[0].value;
    } else {
      next = undefined;
    }
    createFormRef.current?.setFieldsValue({ product_batch_number: next });
  };

  const syncItemOutboundBatch = async (
    material: Material | undefined,
    materialId?: number,
    preferBatch?: string,
  ) => {
    if (config.stockConsumeKind !== 'items') {
      setItemBatchManaged(false);
      setItemBatchOptions([]);
      return;
    }
    const enabled = await resolveMaterialBatchManaged(material, materialId);
    setItemBatchManaged(enabled);
    if (!enabled) {
      setItemBatchOptions([]);
      setItemBatchAllocs([]);
      itemFormRef.current?.setFieldsValue({ batch_number: undefined });
      return;
    }
    const mid = Number(materialId ?? material?.id ?? itemFormRef.current?.getFieldValue('material_id'));
    const wid = Number(currentOrder?.warehouse_id ?? 0);
    const options = await loadItemBatchOptions(mid, wid);
    const qty = Number(itemFormRef.current?.getFieldValue('quantity') ?? 0);
    const preferred = String(preferBatch ?? itemFormRef.current?.getFieldValue('batch_number') ?? '').trim();
    const seeded = coerceBatchAllocationsDraft(preferred, qty);
    if (seeded?.length && isValidOutboundBatchAllocations(seeded, options, qty)) {
      setItemBatchAllocs(seeded);
      itemFormRef.current?.setFieldsValue({ batch_number: seeded[0]?.batchNo });
    } else {
      setItemBatchAllocs([]);
      itemFormRef.current?.setFieldsValue({ batch_number: undefined });
    }
  };

  const resetProductBatchUi = () => {
    setProductBatchManaged(false);
    setProductBatchOptions([]);
  };

  const resetItemBatchUi = () => {
    setItemBatchManaged(false);
    setItemBatchOptions([]);
    setItemBatchAllocs([]);
  };

  const loadTemplateOptions = async (productMaterialId?: number) => {
    if (!config.enableTemplateApply) return;
    try {
      const result = await assemblyTemplateApi.list({
        limit: 200,
        is_active: true,
        product_material_id: productMaterialId,
      });
      const items = result.items || [];
      setTemplateOptions(
        items.map((item: any) => ({
          label: `${item.template_code} - ${item.template_name}`,
          value: item.id,
          productMaterialId: item.product_material_id,
        }))
      );
    } catch {
      setTemplateOptions([]);
    }
  };

  useEffect(() => {
    if (config.enableTemplateApply) {
      void loadTemplateOptions();
    }
  }, [config.enableTemplateApply]);

  const reloadList = () => actionRef.current?.reload();

  const refreshCurrentOrder = async (orderId?: number) => {
    const targetId = orderId ?? currentOrder?.id;
    if (!targetId) return;
    try {
      const fresh = await api.get(String(targetId));
      setCurrentOrder(fresh as OrderLike);
    } catch {
      // keep current drawer content unchanged when refresh fails
    }
  };

  const openCreateModal = () => {
    setEditingOrder(null);
    resetProductBatchUi();
    setCreateModalVisible(true);
    setTimeout(() => {
      createFormRef.current?.resetFields();
      createFormRef.current?.setFieldsValue({
        [config.dateField]: dayjs(),
        total_quantity: 1,
      });
      if (config.enableTemplateApply) {
        void loadTemplateOptions();
      }
    }, 0);
  };
  useNewShortcut(openCreateModal);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(config.createButtonText),
    [config.createButtonText],
  );

  const openEditOrderModal = (order: OrderLike) => {
    setEditingOrder(order);
    setCreateModalVisible(true);
    setTimeout(() => {
      createFormRef.current?.resetFields();
      createFormRef.current?.setFieldsValue({
        warehouse_id: order.warehouse_id,
        warehouse_name: order.warehouse_name,
        _warehouse_name: order.warehouse_name,
        [config.dateField]: order[config.dateField] ? dayjs(order[config.dateField]) : dayjs(),
        product_material_id: order.product_material_id,
        product_material_code: order.product_material_code,
        product_material_name: order.product_material_name,
        product_batch_number: order.product_batch_number,
        total_quantity: order.total_quantity ?? 1,
        assembly_template_id: order.assembly_template_id,
        remarks: order.remarks,
        attachments: mapAttachmentsToUploadList(order.attachments),
      });
      if (config.enableTemplateApply) {
        void loadTemplateOptions(order.product_material_id);
      }
      void syncProductOutboundBatch(
        undefined,
        order.product_material_id,
        order.warehouse_id,
        order.product_batch_number,
      );
    }, 0);
  };

  const submitCreateOrder = async (values: any) => {
    try {
      const payload = {
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name || values._warehouse_name || '',
        [config.dateField]: toApiDateTimeString(values[config.dateField]) ?? nowSiteDateTimeString(),
        product_material_id: values.product_material_id,
        product_material_code: values.product_material_code || '',
        product_material_name: values.product_material_name || '',
        product_batch_number: values.product_batch_number || undefined,
        total_quantity: Number(values.total_quantity || 0),
        assembly_template_id: values.assembly_template_id || undefined,
        remarks: values.remarks,
        attachments: normalizeDocumentAttachments(values.attachments),
      };
      if (editingOrder?.id) {
        await api.update(String(editingOrder.id), payload);
        messageApi.success(config.updateSuccessText || t('app.kuaizhizao.warehouseCommon.updateSuccess', { noun: config.actionNoun }));
      } else {
        await api.create(payload);
        messageApi.success(config.createSuccessText);
      }
      setCreateModalVisible(false);
      setEditingOrder(null);
      createFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      reloadList();
      if (currentOrder?.id && editingOrder?.id === currentOrder.id) {
        await refreshCurrentOrder(currentOrder.id);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.createFailed', { noun: config.actionNoun }));
      throw error;
    }
  };

  const openDetailDrawer = async (record: OrderLike) => {
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setCurrentOrder(null);
    try {
      const detail = await api.get(String(record.id));
      setCurrentOrder(detail as OrderLike);
      setSelectedTemplateId(detail.assembly_template_id ?? undefined);
      if (config.enableTemplateApply && detail.product_material_id) {
        await loadTemplateOptions(detail.product_material_id);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.detailLoadFailed', { noun: config.actionNoun }));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const applyTemplateToOrder = async (order: OrderLike, templateId: number, replaceExisting: boolean) => {
    if (!order.id || !api.applyTemplate) return;
    try {
      const updated = await api.applyTemplate(String(order.id), {
        template_id: templateId,
        replace_existing: replaceExisting,
      });
      messageApi.success(t('app.kuaizhizao.assemblyOrder.applyTemplateSuccess'));
      setCurrentOrder(updated as OrderLike);
      setSelectedTemplateId(templateId);
      invalidateMenuBadgeCounts();
      reloadList();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.assemblyOrder.applyTemplateFailed'));
    }
  };

  const confirmApplyTemplate = (order: OrderLike) => {
    if (!selectedTemplateId) {
      messageApi.warning(t('app.kuaizhizao.assemblyOrder.selectTemplateFirst'));
      return;
    }
    if (!order.total_quantity || Number(order.total_quantity) <= 0) {
      messageApi.warning(t('app.kuaizhizao.assemblyOrder.enterQuantityBeforeTemplate', { label: config.quantityLabel }));
      return;
    }
    const pendingCount = Array.isArray(order.items)
      ? order.items.filter((item) => item.status === 'pending').length
      : Number(order.total_items || 0);
    const runApply = (replaceExisting: boolean) => {
      void applyTemplateToOrder(order, selectedTemplateId, replaceExisting);
    };
    if (pendingCount > 0) {
      getAntdModal().confirm({
        title: t('app.kuaizhizao.assemblyOrder.applyTemplateTitle'),
        content: t('app.kuaizhizao.assemblyOrder.applyTemplateConfirm'),
        onOk: () => runApply(true),
      });
      return;
    }
    runApply(false);
  };

  const executeconfirmDeleteOrder = async (record: OrderLike) => {
    try {
          await api.delete(String(record.id));
          messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteOrderSuccess', { noun: config.deleteSuccessNoun }));
          invalidateMenuBadgeCounts();
          if (currentOrder?.id === record.id) {
            setDetailDrawerVisible(false);
            setCurrentOrder(null);
          }
          reloadList();
        } catch (error: any) {
          messageApi.error(error?.message || t('common.deleteFailed'));
        }
  };

  const openItemModal = (record: OrderLike, item?: ItemLike) => {
    setCurrentOrderId(record.id ?? null);
    setEditingItem(item ?? null);
    resetItemBatchUi();
    setItemModalVisible(true);
    setTimeout(() => {
      itemFormRef.current?.resetFields();
      if (item) {
        itemFormRef.current?.setFieldsValue({
          material_id: item.material_id,
          material_code: item.material_code,
          material_name: item.material_name,
          batch_number: item.batch_number,
          quantity: item.quantity,
          unit_price: item.unit_price,
          remarks: item.remarks,
        });
        void syncItemOutboundBatch(undefined, item.material_id, item.batch_number);
      }
    }, 0);
  };

  const submitCreateItem = async (values: any) => {
    try {
      if (!currentOrderId) {
        messageApi.error(t('app.kuaizhizao.warehouseCommon.orderIdMissing', { noun: config.actionNoun }));
        return;
      }
      const itemQty = Number(values.quantity || 0);
      if (
        config.stockConsumeKind === 'items' &&
        itemBatchManaged &&
        !editingItem?.id &&
        !isValidOutboundBatchAllocations(itemBatchAllocs, itemBatchOptions, itemQty)
      ) {
        messageApi.error(
          t('app.kuaizhizao.warehouseCommon.batchRequiredOutbound', {
            defaultValue: '请按批号分摊出库数量',
          }),
        );
        return;
      }
      if (editingItem?.id) {
        await api.updateItem(String(currentOrderId), String(editingItem.id), {
          quantity: itemQty,
          unit_price: Number(values.unit_price || 0),
          batch_number: values.batch_number || undefined,
          remarks: values.remarks,
        });
        messageApi.success(config.updateItemSuccessText || t('app.kuaizhizao.warehouseCommon.updateItemSuccess', { noun: config.actionNoun }));
      } else {
        const batchLines =
          config.stockConsumeKind === 'items' &&
          itemBatchManaged &&
          itemBatchAllocs.length
            ? itemBatchAllocs.filter((a) => String(a.batchNo).trim() && Number(a.quantity) > 0)
            : [{ batchNo: String(values.batch_number ?? ''), quantity: itemQty }];
        for (const line of batchLines) {
          await api.createItem(String(currentOrderId), {
            material_id: values.material_id,
            material_code: values.material_code || '',
            material_name: values.material_name || '',
            quantity: line.quantity,
            unit_price: Number(values.unit_price || 0),
            batch_number: line.batchNo || undefined,
            remarks: values.remarks,
          });
        }
        messageApi.success(config.addItemSuccessText);
      }
      setItemModalVisible(false);
      setCurrentOrderId(null);
      setEditingItem(null);
      itemFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      reloadList();
      await refreshCurrentOrder(currentOrderId);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.addItemFailed'));
      throw error;
    }
  };

  const executeconfirmDeleteItem = async (order: OrderLike, item: ItemLike) => {
    try {
          if (!order.id || !item.id) return;
          await api.deleteItem(String(order.id), String(item.id));
          messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteItemSuccess'));
          invalidateMenuBadgeCounts();
          reloadList();
          await refreshCurrentOrder(order.id);
        } catch (error: any) {
          messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.deleteItemFailed'));
        }
  };

  const executeconfirmExecuteOrder = async (record: OrderLike) => {
    try {
          await api.execute(String(record.id));
          messageApi.success(config.executeSuccessText);
          invalidateMenuBadgeCounts();
          reloadList();
          await refreshCurrentOrder(record.id);
        } catch (error: any) {
          messageApi.error(error?.message || t('app.kuaizhizao.warehouseCommon.executeFailed', { action: config.executeActionLabel }));
        }
  };

  const workflowStatusValueEnum = useMemo(() => buildWarehouseWorkflowStatusValueEnum(t), [t]);

  const columns: ProColumns<OrderLike>[] = useMemo(
    () => alignProColumns<OrderLike>([
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: workflowStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: config.dateLabel,
      dataIndex: `${config.dateField}_range`,
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 30 } as ProColumns['search'],
    },
    {
      title: config.orderCodeLabel,
      dataIndex: 'code',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      search: { order: 40 } as ProColumns['search'],
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colWarehouse'),
      dataIndex: 'warehouse_name',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) =>
        r.warehouse_name != null && r.warehouse_name !== '' ? String(r.warehouse_name) : '-',
    },
    {
      title: config.dateLabel,
      dataIndex: config.dateField,
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colProductMaterial'),
      dataIndex: 'product_material_name',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) =>
        r.product_material_name != null && r.product_material_name !== ''
          ? String(r.product_material_name)
          : '-',
    },
    {
      title: t('app.kuaizhizao.common.colLineMaterials'),
      ...DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
      render: (_, r) => renderDocumentLineMaterialsPreview(r.items, t),
    },
    {
      title: config.quantityLabel,
      dataIndex: 'total_quantity',
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: formatQuantity,
    },
    ...buildDocumentAuditColumns<OrderLike>(t),
    {
      title: t('app.kuaizhizao.warehouseCommon.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = config.getLifecycle(record as Record<string, unknown>, t);
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
      title: t('common.actions'),
      key: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <Space>
          <Button {...rowActionKind('read')} onClick={() => openDetailDrawer(record)} />
          {record.status === 'draft' && (
            <>
              <Button {...rowActionKind('update')} onClick={() => openEditOrderModal(record)} />
              <Button {...rowActionKind('create')} {...rowActionLabelKeep()} onClick={() => openItemModal(record)}>
                {t('app.kuaizhizao.warehouseCommon.addItem')}
              </Button>
              {canExecuteOrder ? (
                <ActionConfirmPopconfirm title={config.executeActionLabel} description={t('app.kuaizhizao.warehouseCommon.executeConfirmContent', {
        action: config.executeActionLabel,
        code: record.code,
      })} onConfirm={() => executeconfirmExecuteOrder(record)}>
              <Button
                {...rowActionKind('execute')}
                {...rowActionLabelKeep()}
                onClick={(e) => e.stopPropagation()}
              >
                {config.executeActionLabel}
              </Button>
            </ActionConfirmPopconfirm>
              ) : null}
              <ActionConfirmPopconfirm title={t('app.kuaizhizao.warehouseCommon.deleteOrderTitle', { noun: config.actionNoun })} description={t('app.kuaizhizao.warehouseCommon.deleteOrderConfirm', { noun: config.actionNoun, code: record.code })} onConfirm={() => executeconfirmDeleteOrder(record)}>
              <Button {...rowActionKind('delete')} onClick={(e) => e.stopPropagation()} />
            </ActionConfirmPopconfirm>
            </>
          )}
        </Space>
      ),
    },
  ], WAREHOUSE_DOC_LIST_FIELD_RANK),
    [config, t, workflowStatusValueEnum],
  );

  const detailColumns = useMemo(
    () => alignDescriptionColumns([
    { title: config.orderCodeLabel, dataIndex: 'code' },
    { title: t('app.kuaizhizao.warehouseCommon.colWarehouse'), dataIndex: 'warehouse_name' },
    { title: config.dateLabel, dataIndex: config.dateField, valueType: 'date' },
    { title: t('app.kuaizhizao.warehouseCommon.colProductMaterial'), dataIndex: 'product_material_name' },
    ...(config.stockConsumeKind === 'product'
      ? [{ title: t('app.kuaizhizao.warehouseCommon.colBatchNo'), dataIndex: 'product_batch_number' as const }]
      : []),
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (status) => {
        const mapped = orderStatusKeys[String(status ?? '')];
        if (mapped) {
          return <StatusTag color={mapped.color}>{t(mapped.key)}</StatusTag>;
        }
        return renderDocumentStatusTag(String(status ?? '-'), String(status ?? ''));
      },
    },
    { title: config.quantityLabel, dataIndex: 'total_quantity', render: formatQuantity },
    { title: t('app.kuaizhizao.warehouseCommon.colComponentCount'), dataIndex: 'total_items' },
    ...(config.enableTemplateApply
      ? [{ title: t('app.kuaizhizao.assemblyOrder.assemblyTemplate'), dataIndex: 'assembly_template_code' as const }]
      : []),
    { title: t('app.kuaizhizao.warehouseCommon.colExecutor'), dataIndex: 'executed_by_name' },
    { title: t('app.kuaizhizao.warehouseCommon.colExecutedAt'), dataIndex: 'executed_at', valueType: 'dateTime' },
    { title: t('common.remark'), dataIndex: 'remarks', span: 3 },
  ]),
    [config, t],
  );

  const detailCollaboration = useMemo(() => {
    if (!currentOrder) return undefined;
    const lifecycle = config.getLifecycle(currentOrder as Record<string, unknown>, t);
    const mainStages = lifecycle.mainStages ?? [];
    if (!mainStages.length) return undefined;
    return (
      <UniLifecycleStepper
        steps={mainStages}
        status={lifecycle.status}
        showLabels
        nextStepSuggestions={lifecycle.nextStepSuggestions}
      />
    );
  }, [config, currentOrder, t]);

  const detailSupplementary = useMemo(() => {
    if (
      !config.enableTemplateApply ||
      !canApplyTemplate ||
      !currentOrder ||
      currentOrder.status !== 'draft' ||
      !api.applyTemplate
    ) {
      return undefined;
    }
    return (
      <>
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          {t('app.kuaizhizao.assemblyOrder.applyTemplate')}
        </Typography.Text>
        <Space wrap>
          <Select
            style={{ minWidth: 280 }}
            placeholder={t('app.kuaizhizao.assemblyOrder.selectTemplatePlaceholder')}
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
            options={templateOptions.filter(
              (opt) =>
                !currentOrder.product_material_id ||
                !opt.productMaterialId ||
                opt.productMaterialId === currentOrder.product_material_id,
            )}
            allowClear
          />
          <Button icon={<SnippetsOutlined />} onClick={() => confirmApplyTemplate(currentOrder)}>
            {t('app.kuaizhizao.assemblyOrder.applyTemplate')}
          </Button>
        </Space>
      </>
    );
  }, [api.applyTemplate, canApplyTemplate, config.enableTemplateApply, confirmApplyTemplate, currentOrder, selectedTemplateId, t, templateOptions]);

  const detailItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseCommon.colComponentCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseCommon.colComponentName'), dataIndex: 'material_name', width: 150 },
      ...(config.stockConsumeKind === 'items'
        ? [{ title: t('app.kuaizhizao.warehouseCommon.colBatchNo'), dataIndex: 'batch_number', width: 120 }]
        : []),
      { title: t('common.quantity'), dataIndex: 'quantity', width: 90, align: 'right' as const, render: formatQuantity },
      {
        title: t('app.kuaizhizao.warehouseCommon.colUnitPrice'),
        dataIndex: 'unit_price',
        width: 90,
        align: 'right' as const,
        render: (value: unknown) => formatPrice(value),
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colAmount'),
        dataIndex: 'amount',
        width: 90,
        align: 'right' as const,
        render: (value: unknown) => formatAmount(value),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 90,
        render: (status: unknown) => {
          const mapped = itemStatusKeys[String(status ?? '')];
          if (mapped) {
            return <StatusTag color={mapped.color}>{t(mapped.key)}</StatusTag>;
          }
          if (String(status ?? '') === config.itemDoneStatus) {
            return (
              <StatusTag color="success">
                {config.itemDoneStatus === 'consumed'
                  ? t('app.kuaizhizao.warehouseCommon.itemStatusConsumed')
                  : t('app.kuaizhizao.warehouseCommon.itemStatusProduced')}
              </StatusTag>
            );
          }
          return renderDocumentStatusTag(String(status ?? '-'), String(status ?? ''));
        },
      },
      { title: t('common.remark'), dataIndex: 'remarks' },
      {
        title: t('common.actions'),
        width: 150,
        render: (_: unknown, item: ItemLike) =>
          currentOrder?.status === 'draft' ? (
            <Space size={0}>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openItemModal(currentOrder, item)}>
                {t('common.edit')}
              </Button>
              <ActionConfirmPopconfirm title={t('app.kuaizhizao.warehouseCommon.deleteItemTitle')} description={t('app.kuaizhizao.warehouseCommon.deleteItemConfirm', {
        name: item.material_code || item.material_name || item.id,
      })} onConfirm={() => executeconfirmDeleteItem(currentOrder, item)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>
                {t('common.delete')}
              </Button>
            </ActionConfirmPopconfirm>
            </Space>
          ) : null,
      },
    ],
    [config.itemDoneStatus, currentOrder, t],
  );

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailColumns,
    currentOrder,
    'assembly_disassembly',
  );

  return (
    <ListPageTemplate>
      <UniTable<OrderLike>
        headerTitle={config.headerTitle}
        columnPersistenceId={config.persistenceId}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch
        pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        showCreateButton
        createButtonText={createButtonLabel}
        onCreate={openCreateModal}
        enableRowSelection
        showDeleteButton
        onDelete={async (keys) => {
          getAntdModal().confirm({
            title: t('app.kuaizhizao.warehouseCommon.batchDeleteTitle', { noun: config.actionNoun }),
            content: t('app.kuaizhizao.warehouseCommon.batchDeleteConfirm', { count: keys.length, noun: config.actionNoun }),
            onOk: async () => {
              try {
                for (const key of keys) {
      await api.delete(String(key));
                }
                messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: keys.length }));
                invalidateMenuBadgeCounts();
                reloadList();
              } catch (error: any) {
                messageApi.error(error?.message || t('common.deleteFailed'));
              }
            },
          });
        }}
        request={async (params, sort, _filter, searchFormValues) => {
          const lifecycleStage = resolveListLifecycleStageFromSearch(searchFormValues, params);
          const listParams = resolveAssemblyDisassemblyOrderListParams(searchFormValues, sort, {
            dateField: config.dateField as 'assembly_date' | 'disassembly_date',
          });
          const result = await api.list({
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize,
            ...listParams,
            status: lifecycleStage ?? listParams.status,
          });
          const { data, total } = normalizeWarehouseListResponse(result);
          return { data, success: true, total };
        }}
        locale={{ emptyText: config.listEmptyText }}
      />

      <FormModalTemplate
        title={editingOrder ? t('app.kuaizhizao.warehouseCommon.editOrderTitle', { noun: config.actionNoun }) : config.createModalTitle}
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingOrder(null);
          resetProductBatchUi();
          createFormRef.current?.resetFields();
        }}
        onFinish={submitCreateOrder}
        formRef={createFormRef}
        grid={false}
        {...MODAL_CONFIG}
      >
        <Row gutter={16}>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.warehouseCommon.colWarehouse')}
              placeholder={t('app.kuaizhizao.warehouseCommon.selectWarehouse')}
              required
              onChange={(value, warehouse) => {
                createFormRef.current?.setFieldsValue({
                  _warehouse_name: warehouse?.name ?? '',
                  warehouse_name: warehouse?.name ?? '',
                  product_batch_number: undefined,
                });
                const materialId = Number(createFormRef.current?.getFieldValue('product_material_id'));
                if (config.stockConsumeKind === 'product' && materialId) {
                  void syncProductOutboundBatch(undefined, materialId, value);
                }
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name={config.dateField}
              label={config.dateLabel}
              rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.selectDate', { label: config.dateLabel }) }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <UniMaterialSelect
          name="product_material_id"
          label={t('app.kuaizhizao.warehouseCommon.colProductMaterial')}
          placeholder={t('app.kuaizhizao.warehouseCommon.selectMaterial')}
          required
          showQuickCreate
          showAdvancedSearch
          fillMapping={{
            product_material_code: 'mainCode',
            product_material_name: 'name',
          }}
          onChange={(value, material) => {
            const mid = Array.isArray(value) ? value[0] : value;
            createFormRef.current?.setFieldsValue({ product_batch_number: undefined });
            if (config.enableTemplateApply) {
              void loadTemplateOptions(typeof mid === 'number' ? mid : undefined);
              createFormRef.current?.setFieldsValue({ assembly_template_id: undefined });
            }
            const mat = Array.isArray(material) ? material[0] : material;
            void syncProductOutboundBatch(mat, typeof mid === 'number' ? mid : undefined);
          }}
        />
        {config.stockConsumeKind === 'product' && productBatchManaged && (
          <AntForm.Item
            name="product_batch_number"
            label={t('app.kuaizhizao.warehouseCommon.colBatchNo')}
            rules={[
              {
                required: true,
                message: t('app.kuaizhizao.warehouseCommon.batchRequiredOutbound'),
              },
            ]}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              loading={productBatchLoading}
              placeholder={t('app.kuaizhizao.warehouseCommon.selectBatchPlaceholder')}
              options={productBatchOptions}
              notFoundContent={
                productBatchLoading
                  ? undefined
                  : t('app.kuaizhizao.warehouseCommon.batchOptionsEmpty')
              }
            />
          </AntForm.Item>
        )}
        {config.enableTemplateApply && (
          <AntForm.Item name="assembly_template_id" label={t('app.kuaizhizao.assemblyOrder.assemblyTemplate')}>
            <Select
              allowClear
              placeholder={t('app.kuaizhizao.assemblyOrder.selectTemplateOptional')}
              options={templateOptions}
            />
          </AntForm.Item>
        )}
        <ProFormDigit
          name="total_quantity"
          label={config.quantityLabel}
          rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.enterField', { label: config.quantityLabel }) }]}
          min={0.01}
          fieldProps={{ precision: 2 }}
        />
        <DocumentAttachmentsField category={config.attachmentCategory} />
        <ProFormTextArea name="remarks" label={t('common.remark')} placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')} fieldProps={{ rows: 3 }} />
        <AntForm.Item name="_warehouse_name" hidden />
        <AntForm.Item name="warehouse_name" hidden />
        <AntForm.Item name="product_material_code" hidden />
        <AntForm.Item name="product_material_name" hidden />
      </FormModalTemplate>

      <FormModalTemplate
        title={editingItem ? t('app.kuaizhizao.warehouseCommon.editItemTitle', { noun: config.actionNoun }) : t('app.kuaizhizao.warehouseCommon.addItemTitle', { noun: config.actionNoun })}
        open={itemModalVisible}
        onClose={() => {
          setItemModalVisible(false);
          setCurrentOrderId(null);
          setEditingItem(null);
          resetItemBatchUi();
          itemFormRef.current?.resetFields();
        }}
        onFinish={submitCreateItem}
        formRef={itemFormRef}
        {...MODAL_CONFIG}
      >
        <UniMaterialSelect
          name="material_id"
          label={t('app.kuaizhizao.warehouseCommon.componentMaterial')}
          placeholder={t('app.kuaizhizao.warehouseCommon.selectComponentMaterial')}
          required
          disabled={!!editingItem}
          showQuickCreate
          showAdvancedSearch
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
          }}
          onChange={(value, material) => {
            const mid = Array.isArray(value) ? value[0] : value;
            itemFormRef.current?.setFieldsValue({ batch_number: undefined });
            const mat = Array.isArray(material) ? material[0] : material;
            void syncItemOutboundBatch(mat, typeof mid === 'number' ? mid : undefined);
          }}
        />
        {config.stockConsumeKind === 'items' && itemBatchManaged && editingItem ? (
          <AntForm.Item
            name="batch_number"
            label={t('app.kuaizhizao.warehouseCommon.colBatchNo')}
            rules={[
              {
                required: true,
                message: t('app.kuaizhizao.warehouseCommon.batchRequiredOutbound'),
              },
            ]}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              loading={itemBatchLoading}
              placeholder={t('app.kuaizhizao.warehouseCommon.selectBatchPlaceholder')}
              options={itemBatchOptions}
              notFoundContent={
                itemBatchLoading
                  ? undefined
                  : t('app.kuaizhizao.warehouseCommon.batchOptionsEmpty')
              }
            />
          </AntForm.Item>
        ) : null}
        {config.stockConsumeKind === 'items' && itemBatchManaged && !editingItem ? (
          <AntForm.Item label={t('app.kuaizhizao.warehouseCommon.colBatchNo')} required>
            <OutboundBatchAllocationField
              value={itemBatchAllocs}
              onChange={(next) => {
                setItemBatchAllocs(next);
                itemFormRef.current?.setFieldsValue({ batch_number: next[0]?.batchNo });
              }}
              options={itemBatchOptions}
              totalQuantity={Number(itemFormRef.current?.getFieldValue('quantity') ?? 0)}
              loading={itemBatchLoading}
            />
          </AntForm.Item>
        ) : null}
        <ProFormDigit
          name="quantity"
          label={t('common.quantity')}
          rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.enterQuantity') }]}
          min={0.01}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit name="unit_price" label={t('app.kuaizhizao.warehouseCommon.colUnitPrice')} min={0} fieldProps={{ precision: 2 }} />
        <ProFormTextArea name="remarks" label={t('common.remark')} placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')} fieldProps={{ rows: 3 }} />
        <AntForm.Item name="material_code" hidden />
        <AntForm.Item name="material_name" hidden />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`${config.detailTitlePrefix}${currentOrder?.code ? ` - ${currentOrder.code}` : ''}`}
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentOrder(null);
        }}
        size={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          currentOrder?.status === 'draft' ? (
            <Space>
              <Button size="small" onClick={() => openEditOrderModal(currentOrder)}>
                {t('app.kuaizhizao.warehouseCommon.editMainOrder')}
              </Button>
              <Button size="small" onClick={() => openItemModal(currentOrder)}>
                {t('app.kuaizhizao.warehouseCommon.addItem')}
              </Button>
              <Button size="small" type="primary" onClick={() => confirmExecuteOrder(currentOrder)}>
                {config.executeActionLabel}
              </Button>
            </Space>
          ) : null
        }
        basic={
          currentOrder ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        collaboration={detailCollaboration}
        supplementary={detailSupplementary}
        linesTitle={t('app.kuaizhizao.warehouseCommon.colDetail')}
        lines={
          currentOrder ? (
            currentOrder.items && currentOrder.items.length > 0 ? (
              <>
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                <Table<ItemLike>
                  className="warehouse-detail-table"
                  size="small"
                  rowKey="id"
                  pagination={false}
                  columns={detailItemColumns}
                  dataSource={currentOrder.items}
                />
              </>
            ) : (
              <Typography.Text type="secondary">{t('app.kuaizhizao.warehouseCommon.noDetailHint')}</Typography.Text>
            )
          ) : undefined
        }
      />
    </ListPageTemplate>
  );
};

