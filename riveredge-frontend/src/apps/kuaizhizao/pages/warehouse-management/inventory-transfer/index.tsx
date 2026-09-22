/**
 * 库存调拨管理页面
 *
 * 提供库存调拨单的管理功能，包括创建调拨单、添加明细、执行调拨等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  filterWarehouseTrackingColumns,
  isMaterialBatchEntryEnabled,
  useWarehouseTrackingFlags,
} from '../shared/warehouseTrackingFlags';
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
import { useNumericPrecisionPlaces } from '../../../../../hooks/useNumericPrecision';
import { useSearchParams } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Space, Modal, message, Table, Row, Col, Typography, Tag, Form as AntForm, Input, InputNumber, Select, Descriptions } from 'antd';
import { PlusOutlined, EyeOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate,   useDetailDrawerDescriptionItems, detailDrawerBasicColumn, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { inventoryTransferApi } from '../../../services/inventory-transfer';
import { getInventoryTransferLifecycle } from '../../../utils/inventoryTransferLifecycle';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { storageAreaApi, storageLocationApi } from '../../../../master-data/services/warehouse';
import dayjs from 'dayjs';
import { resolveListLifecycleStageFromSearch } from '../../../../../utils/listLifecycleStage';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { DocumentLineUnitSelect, QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import {formatDateTime, formatQuantity, formatCurrencyAmount, formatCurrencyPrice} from '../../../../../utils/format';
import { formDateRangeFormItemProps, toApiDateTimeString, nowSiteDateTimeString } from '../../../../../utils/formDate';
import { alignDescriptionColumns, alignProColumns } from '../../sales-management/shared/documentFieldAlignment';
import { WAREHOUSE_DOC_LIST_FIELD_RANK } from '../shared/warehouseDocListFieldRank';
import { renderInventoryTransferModeMarkerTag } from '../shared/warehouseMarkerTags';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
  renderDocumentLineMaterialsPreview,
} from '../../sales-management/shared/documentLineMaterialsPreview';
import {
  WAREHOUSE_DOC_PINNED_STATUS_FIELD,
  buildInventoryTransferModeValueEnum,
  buildWarehouseWorkflowStatusValueEnum,
  normalizeWarehouseListResponse,
  resolveInventoryTransferListParams,
} from '../../../utils/warehouseListCore';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
interface InventoryTransfer {
  id?: number;
  uuid?: string;
  code?: string;
  from_warehouse_id?: number;
  from_warehouse_name?: string;
  to_warehouse_id?: number;
  to_warehouse_name?: string;
  transfer_date?: string;
  status?: string;
  total_items?: number;
  total_quantity?: number;
  total_amount?: number;
  transfer_reason?: string;
  remarks?: string;
  executed_by?: number;
  executed_by_name?: string;
  executed_at?: string;
  created_at?: string;
  updated_at?: string;
  transfer_mode?: 'transfer' | 'bin_relocation';
  items?: InventoryTransferItem[];
}

interface InventoryTransferItem {
  id?: number;
  uuid?: string;
  transfer_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  from_warehouse_id?: number;
  from_storage_area_id?: number;
  from_storage_area_code?: string;
  from_location_id?: number;
  from_location_code?: string;
  to_warehouse_id?: number;
  to_storage_area_id?: number;
  to_storage_area_code?: string;
  to_location_id?: number;
  to_location_code?: string;
  batch_no?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
  status?: string;
  remarks?: string;
}

const defaultTransferItem = {
  id: undefined as number | undefined,
  material_id: undefined as number | undefined,
  material_code: '',
  material_name: '',
  material_unit: '',
  quantity: undefined as number | undefined,
  unit_price: 0,
  from_storage_area_id: undefined as number | undefined,
  from_location_id: undefined as number | undefined,
  to_storage_area_id: undefined as number | undefined,
  to_location_id: undefined as number | undefined,
  batch_no: undefined as string | undefined,
  batch_managed: false,
};

const InventoryTransferPage: React.FC = () => {
  const { t } = useTranslation();
  const trackingFlags = useWarehouseTrackingFlags();
  const quantityDecimals = useNumericPrecisionPlaces('quantity');
  const [searchParams] = useSearchParams();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const deepLinkOpenedRef = useRef(false);
  const deepLinkFilterRef = useRef<{ id?: number; uuid?: string }>({});

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  // Modal 相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTransferId, setEditingTransferId] = useState<number | null>(null);
  const editOriginalItemsRef = useRef<InventoryTransferItem[]>([]);
  const pendingModalHydrationRef = useRef<
    | { kind: 'create' }
    | { kind: 'edit'; detail: InventoryTransfer; items: InventoryTransferItem[] }
    | null
  >(null);
  const suppressWarehouseItemClearRef = useRef(false);
  const createFromWarehouseRef = useRef<number | undefined>(undefined);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [createTransferMode, setCreateTransferMode] = useState<'transfer' | 'bin_relocation'>('transfer');
  const formRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);
  const [rowBatchOptions, setRowBatchOptions] = useState<Record<number, InventoryPickOption[]>>({});
  const [rowBatchAllocs, setRowBatchAllocs] = useState<Record<number, OutboundBatchAllocation[]>>({});
  const [itemModalBatchAllocs, setItemModalBatchAllocs] = useState<OutboundBatchAllocation[]>([]);
  const [rowBatchManaged, setRowBatchManaged] = useState<Record<number, boolean>>({});
  const [itemModalBatchOptions, setItemModalBatchOptions] = useState<InventoryPickOption[]>([]);
  const [itemModalBatchManaged, setItemModalBatchManaged] = useState(false);
  const [itemModalBatchLoading, setItemModalBatchLoading] = useState(false);
  const [itemModalFromWarehouseId, setItemModalFromWarehouseId] = useState<number | undefined>();

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentTransfer, setCurrentTransfer] = useState<InventoryTransfer | null>(null);

  // 仓库列表状态 (交由 UniWarehouseSelect 管理)
  const [storageAreaList, setStorageAreaList] = useState<any[]>([]);
  const [storageLocationList, setStorageLocationList] = useState<any[]>([]);
  // 当前调拨单ID（用于添加明细）
  const [currentTransferId, setCurrentTransferId] = useState<number | null>(null);
  const [currentItemTransferMode, setCurrentItemTransferMode] = useState<'transfer' | 'bin_relocation'>('transfer');
  const [selectedCreateWarehouseId, setSelectedCreateWarehouseId] = useState<number | undefined>();

  const resolveAreaMeta = (areaId?: number) => {
    const area = storageAreaList.find((a: any) => a.id === areaId);
    return { id: areaId, code: area?.code as string | undefined };
  };

  const resolveLocationMeta = (locationId?: number) => {
    const loc = storageLocationList.find((l: any) => l.id === locationId);
    return { id: locationId, code: loc?.code as string | undefined };
  };

  const resolveMaterialBatchManaged = async (
    material?: Material | null,
    materialId?: number,
  ): Promise<boolean> => {
    let managed = !!(material?.batchManaged ?? (material as { batch_managed?: boolean } | null | undefined)?.batch_managed);
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

  const syncRowBatchOptions = async (
    rowIndex: number,
    materialId?: number,
    warehouseId?: number,
    preferBatch?: string,
  ) => {
    const managed = await resolveMaterialBatchManaged(undefined, materialId);
    setRowBatchManaged((prev) => ({ ...prev, [rowIndex]: managed }));
    formRef.current?.setFieldValue(['items', rowIndex, 'batch_managed'], managed);
    if (!managed || !materialId || !warehouseId) {
      setRowBatchOptions((prev) => ({ ...prev, [rowIndex]: [] }));
      setRowBatchAllocs((prev) => {
        const next = { ...prev };
        delete next[rowIndex];
        return next;
      });
      formRef.current?.setFieldValue(['items', rowIndex, 'batch_no'], undefined);
      return;
    }
    const map = await loadBatchOptionsByMaterialId([materialId], warehouseId);
    const options = map[materialId] ?? [];
    setRowBatchOptions((prev) => ({ ...prev, [rowIndex]: options }));
    const qty = Number(formRef.current?.getFieldValue(['items', rowIndex, 'quantity']) ?? 0);
    const preferred = String(preferBatch ?? formRef.current?.getFieldValue(['items', rowIndex, 'batch_no']) ?? '').trim();
    const seeded = coerceBatchAllocationsDraft(preferred, qty);
    if (seeded?.length && isValidOutboundBatchAllocations(seeded, options, qty)) {
      setRowBatchAllocs((prev) => ({ ...prev, [rowIndex]: seeded }));
      formRef.current?.setFieldValue(['items', rowIndex, 'batch_no'], seeded[0]?.batchNo);
    } else {
      setRowBatchAllocs((prev) => ({ ...prev, [rowIndex]: prev[rowIndex] ?? [] }));
    }
  };

  const syncItemModalBatchOptions = async (
    material?: Material,
    materialId?: number,
    warehouseId?: number,
    preferBatch?: string,
  ) => {
    const managed = await resolveMaterialBatchManaged(material, materialId);
    setItemModalBatchManaged(managed);
    if (!managed || !materialId || !warehouseId) {
      setItemModalBatchOptions([]);
      setItemModalBatchAllocs([]);
      itemFormRef.current?.setFieldsValue({ batch_no: undefined });
      return;
    }
    setItemModalBatchLoading(true);
    try {
      const map = await loadBatchOptionsByMaterialId([materialId], warehouseId);
      const options = map[materialId] ?? [];
      setItemModalBatchOptions(options);
      const qty = Number(itemFormRef.current?.getFieldValue('quantity') ?? 0);
      const preferred = String(preferBatch ?? itemFormRef.current?.getFieldValue('batch_no') ?? '').trim();
      const seeded = coerceBatchAllocationsDraft(preferred, qty);
      if (seeded?.length && isValidOutboundBatchAllocations(seeded, options, qty)) {
        setItemModalBatchAllocs(seeded);
        itemFormRef.current?.setFieldsValue({ batch_no: seeded[0]?.batchNo });
      } else {
        setItemModalBatchAllocs([]);
      }
    } finally {
      setItemModalBatchLoading(false);
    }
  };

  const clearCreateFormItemMaterials = () => {
    const items = formRef.current?.getFieldValue('items') || [];
    formRef.current?.setFieldsValue({
      items: (Array.isArray(items) ? items : []).map((row: Record<string, unknown>) => ({
        ...defaultTransferItem,
        id: row.id,
        from_storage_area_id: row.from_storage_area_id,
        from_location_id: row.from_location_id,
        to_storage_area_id: row.to_storage_area_id,
        to_location_id: row.to_location_id,
      })),
    });
    setRowBatchOptions({});
    setRowBatchAllocs({});
    setRowBatchManaged({});
  };

  const resetCreateModalState = () => {
    setCreateModalVisible(false);
    setIsEditMode(false);
    setEditingTransferId(null);
    editOriginalItemsRef.current = [];
    pendingModalHydrationRef.current = null;
    suppressWarehouseItemClearRef.current = false;
    createFromWarehouseRef.current = undefined;
    setSelectedCreateWarehouseId(undefined);
    setRowBatchOptions({});
    setRowBatchAllocs({});
    setRowBatchManaged({});
    formRef.current?.resetFields();
  };

  const hydrateCreateModalForm = async (
    payload: { kind: 'create' } | { kind: 'edit'; detail: InventoryTransfer; items: InventoryTransferItem[] },
  ) => {
    suppressWarehouseItemClearRef.current = true;
    setRowBatchOptions({});
    setRowBatchAllocs({});
    setRowBatchManaged({});

    if (payload.kind === 'create') {
      createFromWarehouseRef.current = undefined;
      setCreateTransferMode('transfer');
      setSelectedCreateWarehouseId(undefined);
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        transfer_date: dayjs(),
        transfer_mode: 'transfer',
        items: [{ ...defaultTransferItem }],
      });
      suppressWarehouseItemClearRef.current = false;
      return;
    }

    const { detail, items: detailItems } = payload;
    const mode =
      detail.transfer_mode ||
      (detail.from_warehouse_id === detail.to_warehouse_id ? 'bin_relocation' : 'transfer');
    createFromWarehouseRef.current = detail.from_warehouse_id;
    setCreateTransferMode(mode);
    setSelectedCreateWarehouseId(detail.from_warehouse_id);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      transfer_mode: mode,
      from_warehouse_id: detail.from_warehouse_id,
      to_warehouse_id: detail.to_warehouse_id,
      _from_warehouse_name: detail.from_warehouse_name,
      _to_warehouse_name: detail.to_warehouse_name,
      transfer_date: detail.transfer_date ? dayjs(detail.transfer_date) : dayjs(),
      transfer_reason: detail.transfer_reason,
      remarks: detail.remarks,
      attachments: detail.attachments,
      items: (detailItems.length ? detailItems : [{ ...defaultTransferItem }]).map((it) => ({
        id: it.id,
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_unit: it.material_unit,
        quantity: it.quantity,
        unit_price: it.unit_price,
        from_storage_area_id: it.from_storage_area_id,
        from_location_id: it.from_location_id,
        to_storage_area_id: it.to_storage_area_id,
        to_location_id: it.to_location_id,
        batch_no: it.batch_no,
        batch_managed: false,
      })),
    });
    for (let i = 0; i < detailItems.length; i += 1) {
      const it = detailItems[i];
      await syncRowBatchOptions(i, it.material_id, detail.from_warehouse_id, it.batch_no);
    }
    suppressWarehouseItemClearRef.current = false;
  };

  const handleModalAfterOpenChange = useCallback((open: boolean) => {
    if (!open) return;
    const pending = pendingModalHydrationRef.current;
    if (!pending) return;
    pendingModalHydrationRef.current = null;
    void hydrateCreateModalForm(pending);
  }, []);

  const buildItemPayload = (
    it: Record<string, unknown>,
    header: { from_warehouse_id: number; to_warehouse_id: number },
  ) => {
    const fromArea = resolveAreaMeta(it.from_storage_area_id as number | undefined);
    const toArea = resolveAreaMeta(it.to_storage_area_id as number | undefined);
    const fromLoc = resolveLocationMeta(it.from_location_id as number | undefined);
    const toLoc = resolveLocationMeta(it.to_location_id as number | undefined);
    return {
      material_id: it.material_id,
      material_code: it.material_code || '',
      material_name: it.material_name || '',
      material_unit: it.material_unit || '',
      from_warehouse_id: header.from_warehouse_id,
      to_warehouse_id: header.to_warehouse_id,
      from_storage_area_id: fromArea.id,
      from_storage_area_code: fromArea.code,
      from_location_id: fromLoc.id,
      from_location_code: fromLoc.code,
      to_storage_area_id: toArea.id,
      to_storage_area_code: toArea.code,
      to_location_id: toLoc.id,
      to_location_code: toLoc.code,
      batch_no: it.batch_no || undefined,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      remarks: it.remarks,
    };
  };

  const expandTransferItemsWithBatchAllocs = (
    items: Record<string, unknown>[],
    batchManagedByRow: Record<number, boolean>,
    batchAllocsByRow: Record<number, OutboundBatchAllocation[]>,
  ): Record<string, unknown>[] =>
    items.flatMap((it, index) => {
      if (!it.material_id || !(Number(it.quantity) || 0) > 0) return [];
      const managed = batchManagedByRow[index] ?? !!it.batch_managed;
      const allocs = (batchAllocsByRow[index] ?? []).filter(
        (a) => String(a.batchNo).trim() && Number(a.quantity) > 0,
      );
      if (managed && allocs.length > 0) {
        return allocs.map((a, allocIdx) => ({
          ...it,
          id: allocs.length > 1 ? (allocIdx === 0 ? it.id : undefined) : it.id,
          batch_no: a.batchNo,
          quantity: a.quantity,
        }));
      }
      return [it];
    });

  const validateTransferItems = (
    items: Record<string, unknown>[],
    mode: 'transfer' | 'bin_relocation',
    batchManagedByRow: Record<number, boolean>,
    batchOptionsByRow: Record<number, InventoryPickOption[]>,
    batchAllocsByRow: Record<number, OutboundBatchAllocation[]>,
  ) => {
    const valid = items.filter((it) => it.material_id && (Number(it.quantity) || 0) > 0);
    if (!valid.length) {
      messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgNoValidItems'));
      throw new Error('no items');
    }
    for (let index = 0; index < items.length; index += 1) {
      const it = items[index];
      if (!it.material_id || !(Number(it.quantity) || 0) > 0) continue;
      const managed = batchManagedByRow[index] ?? !!it.batch_managed;
      if (managed) {
        const qty = Number(it.quantity ?? 0);
        const options = batchOptionsByRow[index] ?? [];
        const allocs = batchAllocsByRow[index] ?? [];
        if (!isValidOutboundBatchAllocations(allocs, options, qty)) {
          const label = String(it.material_code || it.material_name || '').trim() || `#${index + 1}`;
          messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgBatchRequired', { material: label }));
          throw new Error('batch required');
        }
      }
    }
    if (mode === 'bin_relocation') {
      for (const it of valid) {
        if (!it.from_storage_area_id || !it.from_location_id || !it.to_storage_area_id || !it.to_location_id) {
          messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgBinAreasRequired'));
          throw new Error('bin_relocation areas required');
        }
        if (it.from_location_id === it.to_location_id) {
          messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgSameLocationError'));
          throw new Error('same location');
        }
      }
    }
    return valid;
  };

  // 加载仓库逻辑移除

  useEffect(() => {
    if (!createModalVisible && !itemModalVisible) return;
    const loadStorageMetadata = async () => {
      const [areas, locations] = await Promise.all([
        storageAreaApi.list({ limit: 1000, is_active: true }),
        storageLocationApi.list({ limit: 1000, is_active: true }),
      ]);
      setStorageAreaList(areas?.items || []);
      setStorageLocationList(locations?.items || []);
    };
    loadStorageMetadata();
  }, [createModalVisible, itemModalVisible]);

  /**
   * 处理创建调拨单
   */
  const handleCreate = () => {
    setIsEditMode(false);
    setEditingTransferId(null);
    editOriginalItemsRef.current = [];
    pendingModalHydrationRef.current = { kind: 'create' };
    setCreateModalVisible(true);
  };

  const handleEdit = async (record: InventoryTransfer) => {
    if (record.id == null) return;
    try {
      const detail = await inventoryTransferApi.get(record.id.toString());
      if (detail.status !== 'draft') {
        messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgEditDraftOnly'));
        return;
      }
      const detailItems: InventoryTransferItem[] = Array.isArray(detail.items) ? detail.items : [];
      setIsEditMode(true);
      setEditingTransferId(detail.id ?? null);
      editOriginalItemsRef.current = detailItems;
      pendingModalHydrationRef.current = { kind: 'edit', detail, items: detailItems };
      setCreateModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.inventoryTransfer.msgGetDetailFailed'));
    }
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.inventoryTransfer.createButton')),
    [t],
  );

  /**
   * 处理提交创建调拨单
   */
  const handleCreateSubmit = async (values: any) => {
    try {
      const mode = values.transfer_mode || 'transfer';
      if (mode === 'transfer' && values.from_warehouse_id === values.to_warehouse_id) {
        messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgSameWarehouseError'));
        throw new Error('跨仓调拨时，调出仓库和调入仓库不能相同');
      }
      if (mode === 'bin_relocation' && values.from_warehouse_id !== values.to_warehouse_id) {
        messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgBinSameWarehouseRequired'));
        throw new Error('库内移位时，调出仓库和调入仓库必须相同');
      }

      validateTransferItems(
        values.items || [],
        mode,
        rowBatchManaged,
        rowBatchOptions,
        rowBatchAllocs,
      );
      const validItems = expandTransferItemsWithBatchAllocs(
        (values.items || []).filter((it: Record<string, unknown>) => it.material_id && (Number(it.quantity) || 0) > 0),
        rowBatchManaged,
        rowBatchAllocs,
      );
      const header = {
        from_warehouse_id: values.from_warehouse_id,
        to_warehouse_id: values.to_warehouse_id,
      };

      if (isEditMode && editingTransferId) {
        await inventoryTransferApi.update(editingTransferId.toString(), {
          from_warehouse_id: values.from_warehouse_id,
          from_warehouse_name: values._from_warehouse_name || '',
          to_warehouse_id: values.to_warehouse_id,
          to_warehouse_name: values._to_warehouse_name || '',
          transfer_date: toApiDateTimeString(values.transfer_date) ?? nowSiteDateTimeString(),
          transfer_reason: values.transfer_reason,
          remarks: values.remarks,
          attachments: normalizeDocumentAttachments(values.attachments),
          allow_same_warehouse: mode === 'bin_relocation',
        });

        const originalItems = editOriginalItemsRef.current;
        const keptIds = new Set(
          validItems.map((it) => it.id).filter((id): id is number => typeof id === 'number' && id > 0),
        );
        for (const orig of originalItems) {
          if (orig.id && !keptIds.has(orig.id)) {
            await inventoryTransferApi.deleteItem(editingTransferId.toString(), orig.id.toString());
          }
        }
        const originalById = new Map(
          originalItems.filter((row) => row.id).map((row) => [Number(row.id), row]),
        );
        for (const it of validItems) {
          const payload = buildItemPayload(it, header);
          const itemId = typeof it.id === 'number' ? it.id : Number(it.id);
          if (itemId > 0) {
            const original = originalById.get(itemId);
            if (original && Number(original.material_id) !== Number(it.material_id)) {
              await inventoryTransferApi.deleteItem(editingTransferId.toString(), String(itemId));
              await inventoryTransferApi.createItem(editingTransferId.toString(), {
                transfer_id: editingTransferId,
                ...payload,
              });
            } else {
              await inventoryTransferApi.updateItem(editingTransferId.toString(), String(itemId), payload);
            }
          } else {
            await inventoryTransferApi.createItem(editingTransferId.toString(), {
              transfer_id: editingTransferId,
              ...payload,
            });
          }
        }
        messageApi.success(t('app.kuaizhizao.inventoryTransfer.msgUpdateSuccess'));
        resetCreateModalState();
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
        return;
      }

      const payload = {
        from_warehouse_id: values.from_warehouse_id,
        from_warehouse_name: values._from_warehouse_name || '',
        to_warehouse_id: values.to_warehouse_id,
        to_warehouse_name: values._to_warehouse_name || '',
        transfer_date: toApiDateTimeString(values.transfer_date) ?? nowSiteDateTimeString(),
        transfer_reason: values.transfer_reason,
        remarks: values.remarks,
        attachments: normalizeDocumentAttachments(values.attachments),
        allow_same_warehouse: mode === 'bin_relocation',
        items: validItems.map((it) => buildItemPayload(it, header)),
      };
      if (mode === 'bin_relocation') {
        await inventoryTransferApi.createBinTransfer(payload);
        messageApi.success(t('app.kuaizhizao.inventoryTransfer.msgBinCreateSuccess'));
      } else {
        await inventoryTransferApi.create(payload);
        messageApi.success(t('app.kuaizhizao.inventoryTransfer.msgCreateSuccess'));
      }
      resetCreateModalState();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (
        error.message !== '跨仓调拨时，调出仓库和调入仓库不能相同' &&
        error.message !== '库内移位时，调出仓库和调入仓库必须相同' &&
        error.message !== 'no items' &&
        error.message !== 'bin_relocation areas required' &&
        error.message !== 'same location' &&
        error.message !== 'batch required'
      ) {
        messageApi.error(
          error.message ||
            (isEditMode
              ? t('app.kuaizhizao.inventoryTransfer.msgUpdateFailed')
              : t('app.kuaizhizao.inventoryTransfer.msgCreateFailed')),
        );
      }
      throw error;
    }
  };

  const handleDetail = useCallback(async (record: InventoryTransfer) => {
    if (record.id == null) return;
    setDetailDrawerVisible(true);
    setDetailLoading(true);
    setCurrentTransfer(null);
    try {
      const detail = await inventoryTransferApi.get(record.id.toString());
      setCurrentTransfer(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.inventoryTransfer.msgGetDetailFailed'));
      setDetailDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    const idRaw = searchParams.get('id')?.trim();
    const uuidRaw = searchParams.get('uuid')?.trim();
    deepLinkFilterRef.current = {
      id: idRaw && Number(idRaw) > 0 ? Number(idRaw) : undefined,
      uuid: uuidRaw || undefined,
    };
    if (!idRaw && !uuidRaw) {
      deepLinkOpenedRef.current = false;
      actionRef.current?.reload();
      return;
    }
    if (deepLinkOpenedRef.current) {
      actionRef.current?.reload();
      return;
    }
    deepLinkOpenedRef.current = true;
    void (async () => {
      try {
        if (idRaw) {
          const id = Number(idRaw);
          if (Number.isFinite(id) && id > 0) {
            await handleDetail({ id });
            return;
          }
        }
        if (uuidRaw) {
          const result = await inventoryTransferApi.list({ keyword: uuidRaw, limit: 100 });
          const { data } = normalizeWarehouseListResponse(result);
          const hit = data.find((row: InventoryTransfer) => String(row.uuid) === uuidRaw);
          if (hit) {
            await handleDetail(hit);
          }
        }
      } catch {
        messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgGetDetailFailed'));
      } finally {
    actionRef.current?.reload();
      }
    })();
  }, [searchParams, handleDetail, messageApi, t]);

  /**
   * 处理执行调拨
   */
  const executeExecute = async (record: InventoryTransfer) => {
    try {
          await inventoryTransferApi.execute(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.inventoryTransfer.msgExecuteSuccess'));
          invalidateMenuBadgeCounts();
    actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.inventoryTransfer.msgExecuteFailed'));
        }
  };

  /**
   * 处理添加调拨明细
   */
  const handleAddItem = (record: InventoryTransfer) => {
    setCurrentTransferId(record.id!);
    setItemModalVisible(true);
    setCurrentItemTransferMode(
      record.transfer_mode || (record.from_warehouse_id === record.to_warehouse_id ? 'bin_relocation' : 'transfer')
    );
    setItemModalFromWarehouseId(record.from_warehouse_id);
    setItemModalBatchOptions([]);
    setItemModalBatchAllocs([]);
    setItemModalBatchManaged(false);
    itemFormRef.current?.resetFields();
    itemFormRef.current?.setFieldsValue({
      from_warehouse_id: record.from_warehouse_id,
      to_warehouse_id: record.to_warehouse_id,
    });
  };

  /**
   * 处理提交添加调拨明细
   */
  const handleAddItemSubmit = async (values: any) => {
    try {
      if (!currentTransferId) {
        messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgTransferIdNotFound'));
        return;
      }

      const materialCode = String(values.material_code || '').trim();
      const materialName = String(values.material_name || '').trim();
      if (!values.material_id || !materialCode) {
        messageApi.error(t('app.kuaizhizao.warehouseCommon.materialNotFound'));
        return;
      }

      if (currentItemTransferMode === 'bin_relocation') {
        if (!values.from_storage_area_id || !values.from_location_id || !values.to_storage_area_id || !values.to_location_id) {
          messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgBinAreasSelectRequired'));
          return;
        }
        if (values.from_location_id === values.to_location_id) {
          messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgSameLocationError'));
          return;
        }
      }

      const itemQty = Number(values.quantity ?? 0);
      if (
        itemModalBatchManaged &&
        !isValidOutboundBatchAllocations(itemModalBatchAllocs, itemModalBatchOptions, itemQty)
      ) {
        messageApi.error(t('app.kuaizhizao.inventoryTransfer.msgBatchRequired', { material: materialCode || materialName }));
        return;
      }

      const fromArea = resolveAreaMeta(values.from_storage_area_id);
      const toArea = resolveAreaMeta(values.to_storage_area_id);
      const fromLocation = resolveLocationMeta(values.from_location_id);
      const toLocation = resolveLocationMeta(values.to_location_id);

      const batchLines =
        itemModalBatchManaged && itemModalBatchAllocs.length
          ? itemModalBatchAllocs.filter((a) => String(a.batchNo).trim() && Number(a.quantity) > 0)
          : [{ batchNo: String(values.batch_no ?? ''), quantity: itemQty }];
      for (const line of batchLines) {
        await inventoryTransferApi.createItem(currentTransferId.toString(), {
          transfer_id: currentTransferId,
          material_id: values.material_id,
          material_code: materialCode,
          material_name: materialName,
          from_warehouse_id: values.from_warehouse_id,
          from_storage_area_id: fromArea.id,
          from_storage_area_code: fromArea.code,
          from_location_id: fromLocation.id,
          from_location_code: fromLocation.code,
          to_warehouse_id: values.to_warehouse_id,
          to_storage_area_id: toArea.id,
          to_storage_area_code: toArea.code,
          to_location_id: toLocation.id,
          to_location_code: toLocation.code,
          batch_no: line.batchNo || undefined,
          quantity: line.quantity,
          unit_price: values.unit_price || 0,
          remarks: values.remarks,
        });
      }
      messageApi.success(t('app.kuaizhizao.inventoryTransfer.msgAddItemSuccess'));
      setItemModalVisible(false);
      setCurrentTransferId(null);
      itemFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.inventoryTransfer.msgAddItemFailed'));
      throw error;
    }
  };

  /**
   * 表格列定义
   */
  const workflowStatusValueEnum = useMemo(() => buildWarehouseWorkflowStatusValueEnum(t), [t]);
  const transferModeValueEnum = useMemo(() => buildInventoryTransferModeValueEnum(t), [t]);

  const columns: ProColumns<InventoryTransfer>[] = useMemo(() => alignProColumns<InventoryTransfer>([
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
      title: t('app.kuaizhizao.inventoryTransfer.colTransferMode'),
      dataIndex: 'transfer_mode',
      valueType: 'select',
      valueEnum: transferModeValueEnum,
      hideInTable: true,
      search: { order: 30 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.inventoryTransfer.colTransferDate'),
      dataIndex: 'transfer_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 40 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colTransferCode'),
      dataIndex: 'code',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      search: { order: 50 } as ProColumns['search'],
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.inventoryTransfer.colTransferMode'),
      dataIndex: 'transfer_mode',
      ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
      sorter: true,
      hideInSearch: true,
      render: (_, record) => renderInventoryTransferModeMarkerTag(t, record.transfer_mode),
    },

    {
      title: t('app.kuaizhizao.warehouseReports.colFromWarehouse'),
      dataIndex: 'from_warehouse_name',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) =>
        r.from_warehouse_name != null && r.from_warehouse_name !== ''
          ? String(r.from_warehouse_name)
          : '-',
    },
    {
      title: t('app.kuaizhizao.warehouseReports.colToWarehouse'),
      dataIndex: 'to_warehouse_name',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) =>
        r.to_warehouse_name != null && r.to_warehouse_name !== ''
          ? String(r.to_warehouse_name)
          : '-',
    },
    {
      title: t('app.kuaizhizao.inventoryTransfer.colTransferDate'),
      dataIndex: 'transfer_date',
      width: 132,
      minWidth: 132,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.common.colLineMaterials'),
      ...DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
      render: (_, r) => renderDocumentLineMaterialsPreview(r.items, t),
    },
      {
        title: t('app.kuaizhizao.inventoryTransfer.colTotalQty'),
        dataIndex: 'total_quantity',
        width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => formatQuantity(r.total_quantity),
      },
    {
      title: t('app.kuaizhizao.inventoryTransfer.colTotalAmount'),
      dataIndex: 'total_amount',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (_, record) => formatCurrencyAmount(record.total_amount),
    },
    ...buildDocumentAuditColumns<InventoryTransfer>(t),
    {
      title: t('app.kuaizhizao.warehouseCommon.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getInventoryTransferLifecycle(record as Record<string, unknown>, t);
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
          <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
          {record.status === 'draft' && (
            <>
              <Button {...rowActionKind('update')} onClick={() => handleEdit(record)} />
              <Button {...rowActionKind('create')} {...rowActionLabelKeep()} onClick={() => handleAddItem(record)}>
                {t('app.kuaizhizao.inventoryTransfer.actionAddItem')}
              </Button>
              <ActionConfirmPopconfirm title={t('app.kuaizhizao.inventoryTransfer.msgExecuteTitle')} description={t('app.kuaizhizao.inventoryTransfer.msgExecuteContent', { code: record.code })} onConfirm={() => executeExecute(record)}>
              <Button
                {...rowActionKind('execute')}
                {...rowActionLabelKeep()}
                onClick={(e) => e.stopPropagation()}
              >
                {t('app.kuaizhizao.inventoryTransfer.actionExecute')}
              </Button>
            </ActionConfirmPopconfirm>
            </>
          )}
          {record.status === 'in_progress' && (
            <Button {...rowActionKind('create')} {...rowActionLabelKeep()} onClick={() => handleAddItem(record)}>
              {t('app.kuaizhizao.inventoryTransfer.actionAddItem')}
            </Button>
          )}
        </Space>
      ),
    },
  ], WAREHOUSE_DOC_LIST_FIELD_RANK), [t, workflowStatusValueEnum, transferModeValueEnum]);

  const getAreaOptions = (warehouseId?: number) =>
    storageAreaList
      .filter((a: any) => !warehouseId || a.warehouseId === warehouseId)
      .map((a: any) => ({ label: `${a.code} - ${a.name}`, value: a.id }));

  const getLocationOptions = (storageAreaId?: number) =>
    storageLocationList
      .filter((l: any) => !storageAreaId || l.storageAreaId === storageAreaId)
      .map((l: any) => ({ label: `${l.code} - ${l.name}`, value: l.id }));

  const detailBasicColumns = useMemo(
    () => alignDescriptionColumns([
      { title: t('app.kuaizhizao.warehouseReports.colTransferCode'), dataIndex: 'code' },
      { title: t('app.kuaizhizao.warehouseReports.colFromWarehouse'), dataIndex: 'from_warehouse_name' },
      { title: t('app.kuaizhizao.warehouseReports.colToWarehouse'), dataIndex: 'to_warehouse_name' },
      { title: t('app.kuaizhizao.inventoryTransfer.colTransferDate'), dataIndex: 'transfer_date', valueType: 'date' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (s) => {
          const map: Record<string, { textKey: string; color: string }> = {
            draft: { textKey: 'app.kuaizhizao.warehouseCommon.statusDraft', color: 'default' },
            in_progress: { textKey: 'app.kuaizhizao.inventoryTransfer.statusInProgress', color: 'processing' },
            completed: { textKey: 'app.kuaizhizao.warehouseCommon.statusCompleted', color: 'success' },
            cancelled: { textKey: 'app.kuaizhizao.warehouseCommon.statusCancelled', color: 'error' },
          };
          const c = map[(s as string) || ''] || { textKey: '', color: 'default' };
          return <Tag color={c.color}>{c.textKey ? t(c.textKey) : (s as string) || '-'}</Tag>;
        },
      },
      { title: t('app.kuaizhizao.inventoryTransfer.colTotalItems'), dataIndex: 'total_items' },
      { title: t('app.kuaizhizao.inventoryTransfer.colTotalQty'), dataIndex: 'total_quantity', render: formatQuantity },
      {
        title: t('app.kuaizhizao.inventoryTransfer.colTotalAmount'),
        dataIndex: 'total_amount',
        render: (_dom, entity) => formatCurrencyAmount(entity.total_amount),
      },
      { title: t('app.kuaizhizao.inventoryTransfer.formTransferReason'), dataIndex: 'transfer_reason' },
      { title: t('common.remark'), dataIndex: 'remarks', span: 3 },
    ]),
    [t],
  );

  const transferDetailItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.warehouseCommon.colMaterialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.warehouseReports.colMaterialName'), dataIndex: 'material_name', width: 150 },
      { title: t('common.unit'), dataIndex: 'material_unit', width: 72 },
      {
        title: t('app.kuaizhizao.inventoryTransfer.formTransferQty'),
        dataIndex: 'quantity',
        width: 120,
        align: 'right' as const,
        render: (value: number, row: InventoryTransferItem) => (
          <QuantityWithUnitDisplay quantity={value} unit={row.material_unit} />
        ),
      },
      {
        title: t('app.kuaizhizao.inventoryTransfer.colFromAreaLocation'),
        width: 160,
        render: (_: unknown, row: InventoryTransferItem) =>
          [row.from_storage_area_code, row.from_location_code].filter(Boolean).join(' / ') || '-',
      },
      {
        title: t('app.kuaizhizao.inventoryTransfer.colToAreaLocation'),
        width: 160,
        render: (_: unknown, row: InventoryTransferItem) =>
          [row.to_storage_area_code, row.to_location_code].filter(Boolean).join(' / ') || '-',
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colUnitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        align: 'right' as const,
        render: (value: number | string) => formatCurrencyPrice(value),
      },
      {
        title: t('app.kuaizhizao.warehouseCommon.colAmount'),
        dataIndex: 'amount',
        width: 100,
        align: 'right' as const,
        render: (value: number | string) => formatCurrencyAmount(value),
      },
      { title: t('app.kuaizhizao.warehouseReports.colBatchNo'), dataIndex: 'batch_no', width: 100 },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        render: (status: string) => {
          const statusMap: Record<string, { text: string; color: string }> = {
            pending: { text: t('app.kuaizhizao.inventoryTransfer.statusItemPending'), color: 'default' },
            transferred: { text: t('app.kuaizhizao.inventoryTransfer.statusItemTransferred'), color: 'success' },
          };
          const statusInfo = statusMap[status] || { text: status, color: 'default' };
          return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
        },
      },
    ],
    [t],
  );

  const detailCollaboration = useMemo(() => {
    if (!currentTransfer) return undefined;
    const lifecycle = getInventoryTransferLifecycle(currentTransfer as Record<string, unknown>, t);
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
  }, [currentTransfer, t]);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailBasicColumns, currentTransfer,
    'inventory_transfer',
  );

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle={t('app.kuaizhizao.inventoryTransfer.headerTitle')}
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.inventoryTransfer)}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.inventory-transfer-width-v3"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        pinnedTabsField={WAREHOUSE_DOC_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        showCreateButton={true}
        createButtonText={createButtonLabel}
        onCreate={handleCreate}
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const lifecycleStage = resolveListLifecycleStageFromSearch(searchFormValues, params);
            const listParams = resolveInventoryTransferListParams(searchFormValues, sort);
            const result = await inventoryTransferApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              ...listParams,
              status: lifecycleStage ?? listParams.status,
            });
            const { data, total } = normalizeWarehouseListResponse(result);
            const deepLink = deepLinkFilterRef.current;
            let rows = data;
            if (deepLink.id) {
              rows = rows.filter((row) => row.id === deepLink.id);
            } else if (deepLink.uuid) {
              rows = rows.filter((row) => String(row.uuid) === deepLink.uuid);
            }
            return {
              data: rows,
              success: true,
              total: deepLink.id || deepLink.uuid ? rows.length : total,
            };
          } catch {
            return { data: [], success: false, total: 0 };
          }
        }}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            for (const id of keys) {
              await inventoryTransferApi.delete(String(id));
            }
            messageApi.success(t('app.kuaizhizao.warehouseCommon.deleteSuccess', { count: keys.length }));
            invalidateMenuBadgeCounts();
    actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error.message || t('common.deleteFailed'));
          }
        }}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.inventoryTransfer.deleteConfirm', { count })}
      />

      {/* 创建调拨单Modal */}
      <FormModalTemplate
        title={
          isEditMode
            ? t('app.kuaizhizao.inventoryTransfer.modalEdit')
            : t('app.kuaizhizao.inventoryTransfer.modalCreate')
        }
        open={createModalVisible}
        onClose={resetCreateModalState}
        onFinish={handleCreateSubmit}
        afterOpenChange={handleModalAfterOpenChange}
        formRef={formRef}
        grid={false}
        isEdit={isEditMode}
        width={createTransferMode === 'bin_relocation' ? MODAL_CONFIG.EXTRA_LARGE_WIDTH : MODAL_CONFIG.LARGE_WIDTH}
        {...MODAL_CONFIG}
      >
        <ProFormSelect
          name="transfer_mode"
          label={t('app.kuaizhizao.inventoryTransfer.formTransferMode')}
          initialValue="transfer"
          rules={[{ required: true, message: t('app.kuaizhizao.inventoryTransfer.formTransferModeRequired') }]}
          options={[
            { label: t('app.kuaizhizao.inventoryTransfer.transferModeCross'), value: 'transfer' },
            { label: t('app.kuaizhizao.inventoryTransfer.transferModeBinRelocationSame'), value: 'bin_relocation' },
          ]}
          fieldProps={{
            disabled: isEditMode,
            onChange: (v: 'transfer' | 'bin_relocation') => {
              setCreateTransferMode(v);
              if (v === 'bin_relocation') {
                const fromId = formRef.current?.getFieldValue?.('from_warehouse_id');
                const fromName = formRef.current?.getFieldValue?.('_from_warehouse_name');
                if (fromId) {
                  formRef.current?.setFieldsValue({
                    to_warehouse_id: fromId,
                    _to_warehouse_name: fromName || '',
                  });
                }
              }
            },
          }}
        />
        <Row gutter={16}>
          <Col span={12}>
            <UniWarehouseSelect
              name="from_warehouse_id"
              label={t('app.kuaizhizao.warehouseReports.colFromWarehouse')}
              placeholder={t('app.kuaizhizao.inventoryTransfer.formFromWarehousePlaceholder')}
              required
              onChange={(value, warehouse) => {
                const warehouseName = String(warehouse?.name ?? '').trim();
                const warehouseId = typeof value === 'number' ? value : Number(value);
                const resolvedId = Number.isFinite(warehouseId) && warehouseId > 0 ? warehouseId : undefined;
                formRef.current?.setFieldsValue({ _from_warehouse_name: warehouseName });
                setSelectedCreateWarehouseId(resolvedId);
                if (createTransferMode === 'bin_relocation') {
                  formRef.current?.setFieldsValue({
                    to_warehouse_id: value,
                    _to_warehouse_name: warehouseName,
                  });
                }
                if (suppressWarehouseItemClearRef.current) {
                  createFromWarehouseRef.current = resolvedId;
                  return;
                }
                const previousId = createFromWarehouseRef.current;
                createFromWarehouseRef.current = resolvedId;
                if (previousId !== undefined && previousId === resolvedId) {
                  return;
                }
                clearCreateFormItemMaterials();
              }}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="to_warehouse_id"
              label={createTransferMode === 'bin_relocation' ? t('app.kuaizhizao.inventoryTransfer.formToWarehouseSame') : t('app.kuaizhizao.warehouseReports.colToWarehouse')}
              placeholder={createTransferMode === 'bin_relocation' ? t('app.kuaizhizao.inventoryTransfer.formToWarehouseSamePlaceholder') : t('app.kuaizhizao.inventoryTransfer.formToWarehousePlaceholder')}
              required
              disabled={createTransferMode === 'bin_relocation'}
              onChange={(_, warehouse) =>
                formRef.current?.setFieldsValue({
                  _to_warehouse_name: String(warehouse?.name ?? '').trim(),
                })
              }
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="transfer_date"
              label={t('app.kuaizhizao.inventoryTransfer.colTransferDate')}
              rules={[{ required: true, message: t('app.kuaizhizao.inventoryTransfer.formTransferDateRequired') }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12} />
        </Row>
        <div className="uni-table-detail" style={{ width: '100%' }}>
          <UniTableDetailHeader title={t('app.kuaizhizao.inventoryTransfer.detailItemsTitle')} required />
          <AntForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: t('app.kuaizhizao.inventoryTransfer.msgMinOneItem') }]}>
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const baseCols = [
                  {
                    title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
                    dataIndex: 'material_id',
                    width: 240,
                    render: (_: unknown, __: unknown, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index] !== curr?.items?.[index]}>
                        {({ getFieldValue }: { getFieldValue: (name: string) => unknown }) => {
                          const row = (getFieldValue('items') as Record<string, unknown>[] | undefined)?.[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback = mid && (row?.material_code || row?.material_name)
                            ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                            : undefined;
                          return (
                            <div className="warehouse-detail-material-cell">
                              <UniMaterialSelect
                                name={[index, 'material_id']}
                                label=""
                                placeholder={
                                  selectedCreateWarehouseId
                                    ? t('app.kuaizhizao.warehouseCommon.selectMaterial')
                                    : t('app.kuaizhizao.inventoryTransfer.formSelectFromWarehouseFirst')
                                }
                                required
                                size="small"
                                disabled={!selectedCreateWarehouseId}
                                warehouseId={selectedCreateWarehouseId}
                                listFieldKey={index}
                                listFieldName="items"
                                fillMapping={{
                                  material_code: 'mainCode',
                                  material_name: 'name',
                                  material_unit: 'baseUnit',
                                }}
                                fallbackOption={fallback}
                                formItemProps={{ style: { margin: 0 } }}
                                showQuickCreate={false}
                                showAdvancedSearch
                                onChange={(_val, material) => {
                                  void syncRowBatchOptions(
                                    index,
                                    material && !Array.isArray(material) ? Number(material.id) : undefined,
                                    selectedCreateWarehouseId,
                                  );
                                }}
                              />
                            </div>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('common.unit'),
                    dataIndex: 'material_unit',
                    width: 88,
                    render: (_: unknown, __: unknown, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                        {({ getFieldValue }: { getFieldValue: (name: string | (string | number)[]) => unknown }) => {
                          const materialId = getFieldValue(['items', index, 'material_id']) as number | undefined;
                          if (!formRef.current) return null;
                          return (
                            <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                              <DocumentLineUnitSelect
                                form={formRef.current}
                                listName="items"
                                rowIndex={index}
                                fields={{ quantity: 'quantity', unit: 'material_unit' }}
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
                    title: t('common.quantity'),
                    dataIndex: 'quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: unknown, __: unknown, index: number) => (
                      <AntForm.Item
                        name={[index, 'quantity']}
                        rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.required') }, { type: 'number', min: 0.01, message: t('app.kuaizhizao.batchingCenter.qtyGtZero') }]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber placeholder={t('common.quantity')} min={0} precision={quantityDecimals} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                ];
                const binCols = createTransferMode === 'bin_relocation'
                  ? [
                      {
                        title: t('app.kuaizhizao.inventoryTransfer.colFromStorageArea'),
                        dataIndex: 'from_storage_area_id',
                        width: 150,
                        render: (_: unknown, __: unknown, index: number) => (
                          <AntForm.Item
                            name={[index, 'from_storage_area_id']}
                            rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.selectRequired') }]}
                            style={{ margin: 0 }}
                          >
                            <Select
                              options={getAreaOptions(selectedCreateWarehouseId)}
                              placeholder={t('app.kuaizhizao.inventoryTransfer.colFromStorageArea')}
                              size="small"
                              showSearch
                              optionFilterProp="label"
                              onChange={() => {
                                const items = formRef.current?.getFieldValue('items') || [];
                                items[index] = { ...items[index], from_location_id: undefined };
                                formRef.current?.setFieldsValue({ items });
                              }}
                            />
                          </AntForm.Item>
                        ),
                      },
                      {
                        title: t('app.kuaizhizao.inventoryTransfer.colFromLocation'),
                        dataIndex: 'from_location_id',
                        width: 150,
                        render: (_: unknown, __: unknown, index: number) => (
                          <AntForm.Item noStyle shouldUpdate>
                            {({ getFieldValue }: { getFieldValue: (name: (string | number)[]) => unknown }) => (
                              <AntForm.Item
                                name={[index, 'from_location_id']}
                                rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.selectRequired') }]}
                                style={{ margin: 0 }}
                              >
                                <Select
                                  options={getLocationOptions(getFieldValue(['items', index, 'from_storage_area_id']) as number | undefined)}
                                  placeholder={t('app.kuaizhizao.inventoryTransfer.colFromLocation')}
                                  size="small"
                                  showSearch
                                  optionFilterProp="label"
                                />
                              </AntForm.Item>
                            )}
                          </AntForm.Item>
                        ),
                      },
                      {
                        title: t('app.kuaizhizao.inventoryTransfer.colToStorageArea'),
                        dataIndex: 'to_storage_area_id',
                        width: 150,
                        render: (_: unknown, __: unknown, index: number) => (
                          <AntForm.Item
                            name={[index, 'to_storage_area_id']}
                            rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.selectRequired') }]}
                            style={{ margin: 0 }}
                          >
                            <Select
                              options={getAreaOptions(selectedCreateWarehouseId)}
                              placeholder={t('app.kuaizhizao.inventoryTransfer.colToStorageArea')}
                              size="small"
                              showSearch
                              optionFilterProp="label"
                              onChange={() => {
                                const items = formRef.current?.getFieldValue('items') || [];
                                items[index] = { ...items[index], to_location_id: undefined };
                                formRef.current?.setFieldsValue({ items });
                              }}
                            />
                          </AntForm.Item>
                        ),
                      },
                      {
                        title: t('app.kuaizhizao.inventoryTransfer.colToLocation'),
                        dataIndex: 'to_location_id',
                        width: 150,
                        render: (_: unknown, __: unknown, index: number) => (
                          <AntForm.Item noStyle shouldUpdate>
                            {({ getFieldValue }: { getFieldValue: (name: (string | number)[]) => unknown }) => (
                              <AntForm.Item
                                name={[index, 'to_location_id']}
                                rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.selectRequired') }]}
                                style={{ margin: 0 }}
                              >
                                <Select
                                  options={getLocationOptions(getFieldValue(['items', index, 'to_storage_area_id']) as number | undefined)}
                                  placeholder={t('app.kuaizhizao.inventoryTransfer.colToLocation')}
                                  size="small"
                                  showSearch
                                  optionFilterProp="label"
                                />
                              </AntForm.Item>
                            )}
                          </AntForm.Item>
                        ),
                      },
                    ]
                  : [];
                const tailCols = [
                  {
                    title: t('app.kuaizhizao.warehouseReports.colBatchNo'),
                    dataIndex: 'batch_no',
                    width: 260,
                    render: (_: unknown, __: unknown, index: number) => (
                      <AntForm.Item noStyle shouldUpdate>
                        {() => {
                          const managed = rowBatchManaged[index];
                          const options = rowBatchOptions[index] ?? [];
                          const qty = Number(formRef.current?.getFieldValue(['items', index, 'quantity']) ?? 0);
                          if (!managed) {
                            return (
                              <AntForm.Item name={[index, 'batch_no']} style={{ margin: 0 }}>
                                <Input placeholder={t('app.kuaizhizao.warehouseCommon.optional')} size="small" disabled />
                              </AntForm.Item>
                            );
                          }
                          return (
                            <OutboundBatchAllocationField
                              value={rowBatchAllocs[index] ?? []}
                              onChange={(next) => {
                                setRowBatchAllocs((prev) => ({ ...prev, [index]: next }));
                                formRef.current?.setFieldValue(
                                  ['items', index, 'batch_no'],
                                  next[0]?.batchNo,
                                );
                              }}
                              options={options}
                              totalQuantity={qty}
                            />
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('common.actions'),
                    width: 60,
                    render: (_: unknown, __: unknown, index: number) => (
                      <Button
                        type="link"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          remove(index);
                          setTimeout(() => {
                            setRowBatchOptions({});
                            setRowBatchAllocs({});
                            setRowBatchManaged({});
                            const items = formRef.current?.getFieldValue('items') || [];
                            items.forEach((row: Record<string, unknown>, rowIndex: number) => {
                              const materialId = Number(row.material_id);
                              if (Number.isFinite(materialId) && materialId > 0) {
                                void syncRowBatchOptions(
                                  rowIndex,
                                  materialId,
                                  selectedCreateWarehouseId,
                                  String(row.batch_no ?? ''),
                                );
                              }
                            });
                          }, 0);
                        }}
                        disabled={fields.length <= 1}
                      />
                    ),
                  },
                ];
                const cols = [...baseCols, ...binCols, ...filterWarehouseTrackingColumns(tailCols, trackingFlags)];
                const totalWidth = cols.reduce((s, c) => s + ((c.width as number) || 0), 0);
                return (
                  <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <Table
                        className="warehouse-detail-table"
                        size="small"
                        dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                        rowKey="key"
                        pagination={false}
                        columns={cols}
                        scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                        style={{ width: '100%', margin: 0 }}
                        footer={() => (
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            block
                            onClick={() => add({ ...defaultTransferItem })}
                          >
                            {t('app.kuaizhizao.inventoryTransfer.actionAddItem')}
                          </Button>
                        )}
                      />
                    </div>
                  </div>
                );
              }}
            </AntForm.List>
          </AntForm.Item>
        </div>
        <ProFormTextArea
          name="transfer_reason"
          label={t('app.kuaizhizao.inventoryTransfer.formTransferReason')}
          placeholder={t('app.kuaizhizao.inventoryTransfer.formTransferReasonPlaceholder')}
          fieldProps={{ rows: 3 }}
        />
        <DocumentAttachmentsField category="inventory_transfer_attachments" />
        <ProFormTextArea
          name="remarks"
          label={t('common.remark')}
          placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 添加调拨明细Modal */}
      <FormModalTemplate
        title={t('app.kuaizhizao.inventoryTransfer.modalAddItem')}
        open={itemModalVisible}
        onClose={() => {
          setItemModalVisible(false);
          setCurrentTransferId(null);
          setItemModalFromWarehouseId(undefined);
          setItemModalBatchOptions([]);
          setItemModalBatchManaged(false);
          itemFormRef.current?.resetFields();
        }}
        onFinish={handleAddItemSubmit}
        formRef={itemFormRef}
        {...MODAL_CONFIG}
      >
        <UniMaterialSelect
          name="material_id"
          label={t('app.kuaizhizao.warehouseCommon.colMaterial')}
          placeholder={
            itemModalFromWarehouseId
              ? t('app.kuaizhizao.warehouseCommon.selectMaterial')
              : t('app.kuaizhizao.inventoryTransfer.formSelectFromWarehouseFirst')
          }
          required
          disabled={!itemModalFromWarehouseId}
          warehouseId={itemModalFromWarehouseId}
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
          }}
          showQuickCreate={false}
          showAdvancedSearch
          onChange={(_val, material) => {
            void syncItemModalBatchOptions(
              material && !Array.isArray(material) ? material : undefined,
              material && !Array.isArray(material) ? Number(material.id) : undefined,
              itemModalFromWarehouseId,
            );
          }}
        />
        <AntForm.Item name="material_code" hidden />
        <AntForm.Item name="material_name" hidden />
        <ProFormDigit
          name="quantity"
          label={t('app.kuaizhizao.inventoryTransfer.formTransferQty')}
          placeholder={t('app.kuaizhizao.inventoryTransfer.formTransferQtyPlaceholder')}
          rules={[{ required: true, message: t('app.kuaizhizao.inventoryTransfer.formTransferQtyRequired') }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit
          name="unit_price"
          label={t('app.kuaizhizao.warehouseCommon.colUnitPrice')}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <Row gutter={16}>
          <Col span={12}>
            <AntForm.Item noStyle shouldUpdate>
              {() => (
                <ProFormSelect
                  name="from_storage_area_id"
                  label={t('app.kuaizhizao.inventoryTransfer.colFromStorageArea')}
                  placeholder={t('app.kuaizhizao.inventoryTransfer.formFromStorageAreaPlaceholder')}
                  rules={
                    currentItemTransferMode === 'bin_relocation'
                      ? [{ required: true, message: t('app.kuaizhizao.inventoryTransfer.msgBinFromAreaRequired') }]
                      : undefined
                  }
                  options={getAreaOptions(itemFormRef.current?.getFieldValue?.('from_warehouse_id'))}
                  fieldProps={{
                    showSearch: true,
                    onChange: () => {
                      itemFormRef.current?.setFieldsValue({ from_location_id: undefined });
                    },
                  }}
                />
              )}
            </AntForm.Item>
          </Col>
          <Col span={12}>
            <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev.from_storage_area_id !== curr.from_storage_area_id}>
              {() => (
                <ProFormSelect
                  name="from_location_id"
                  label={t('app.kuaizhizao.inventoryTransfer.colFromLocation')}
                  placeholder={t('app.kuaizhizao.inventoryTransfer.formFromLocationPlaceholder')}
                  rules={
                    currentItemTransferMode === 'bin_relocation'
                      ? [{ required: true, message: t('app.kuaizhizao.inventoryTransfer.msgBinFromLocationRequired') }]
                      : undefined
                  }
                  options={getLocationOptions(itemFormRef.current?.getFieldValue?.('from_storage_area_id'))}
                  fieldProps={{ showSearch: true }}
                />
              )}
            </AntForm.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <AntForm.Item noStyle shouldUpdate>
              {() => (
                <ProFormSelect
                  name="to_storage_area_id"
                  label={t('app.kuaizhizao.inventoryTransfer.colToStorageArea')}
                  placeholder={t('app.kuaizhizao.inventoryTransfer.formToStorageAreaPlaceholder')}
                  rules={
                    currentItemTransferMode === 'bin_relocation'
                      ? [{ required: true, message: t('app.kuaizhizao.inventoryTransfer.msgBinToAreaRequired') }]
                      : undefined
                  }
                  options={getAreaOptions(itemFormRef.current?.getFieldValue?.('to_warehouse_id'))}
                  fieldProps={{
                    showSearch: true,
                    onChange: () => {
                      itemFormRef.current?.setFieldsValue({ to_location_id: undefined });
                    },
                  }}
                />
              )}
            </AntForm.Item>
          </Col>
          <Col span={12}>
            <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev.to_storage_area_id !== curr.to_storage_area_id}>
              {() => (
                <ProFormSelect
                  name="to_location_id"
                  label={t('app.kuaizhizao.inventoryTransfer.colToLocation')}
                  placeholder={t('app.kuaizhizao.inventoryTransfer.formToLocationPlaceholder')}
                  rules={
                    currentItemTransferMode === 'bin_relocation'
                      ? [{ required: true, message: t('app.kuaizhizao.inventoryTransfer.msgBinToLocationRequired') }]
                      : undefined
                  }
                  options={getLocationOptions(itemFormRef.current?.getFieldValue?.('to_storage_area_id'))}
                  fieldProps={{ showSearch: true }}
                />
              )}
            </AntForm.Item>
          </Col>
        </Row>
        <ProFormText name="from_location_code" hidden />
        <ProFormText name="to_location_code" hidden />
        {itemModalBatchManaged ? (
          <>
            <AntForm.Item label={t('app.kuaizhizao.warehouseReports.colBatchNo')} required>
              <OutboundBatchAllocationField
                value={itemModalBatchAllocs}
                onChange={(next) => {
                  setItemModalBatchAllocs(next);
                  itemFormRef.current?.setFieldsValue({ batch_no: next[0]?.batchNo });
                }}
                options={itemModalBatchOptions}
                totalQuantity={Number(itemFormRef.current?.getFieldValue('quantity') ?? 0)}
                loading={itemModalBatchLoading}
              />
            </AntForm.Item>
            <ProFormText name="batch_no" hidden />
          </>
        ) : (
          <ProFormText
            name="batch_no"
            label={t('app.kuaizhizao.inventoryTransfer.formBatchNoOptional')}
            placeholder={t('app.kuaizhizao.warehouseCommon.optional')}
            disabled
          />
        )}
        <ProFormTextArea
          name="remarks"
          label={t('common.remark')}
          placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.inventoryTransfer.detailTitle')}${currentTransfer?.code ? ` - ${currentTransfer.code}` : ''}`}
        open={detailDrawerVisible}
        loading={detailLoading}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentTransfer(null);
        }}
        size={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          currentTransfer ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        collaboration={detailCollaboration}
        traceDocument={
          currentTransfer?.id
            ? {
                documentType: 'inventory_transfer',
                documentId: currentTransfer.id,
                selfDocumentId: currentTransfer.id,
              }
            : undefined
        }
        linesTitle={t('app.kuaizhizao.inventoryTransfer.detailItemsTitle')}
        lines={
          currentTransfer?.items && currentTransfer.items.length > 0 ? (
            <>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                columns={transferDetailItemColumns}
                dataSource={currentTransfer.items}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </>
          ) : undefined
        }
      />
    </ListPageTemplate>
  );
};

export default InventoryTransferPage;
