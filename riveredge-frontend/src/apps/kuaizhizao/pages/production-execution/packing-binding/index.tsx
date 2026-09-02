import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
/**
 * 装箱打包绑定管理页面
 *
 * 提供装箱打包绑定记录的管理功能，包括查看、更新、删除等。
 * 归属生产管理：产线末端打包/装箱时记录每箱内含产品批次，用于出货追溯。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormDigit,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Alert,
  Button,
  Popconfirm,
  Row,
  Col,
  Descriptions,
  Typography,
  Empty,
  Spin,
  Modal,
  Table,
  Space,
  theme as AntdTheme,
  Tag,
} from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, QrcodeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchButton } from '../../../../../components/uni-batch';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { packingBindingBatchPrintAllowed } from '../../../../../hooks/useDocumentCapabilities';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
  type StatCard,
} from '../../../../../components/layout-templates';
import { SimpleSparkline } from '../../../../../components';
import { packingBindingApi } from '../../../services/packing-binding';
import { warehouseApi } from '../../../services/production';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';

import { qrcodeApi } from '../../../../../services/qrcode';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { getPackingBindingLifecycle, buildPackingBindingMethodValueEnum, resolvePackingBindingListMethodParams, buildPackingBindingSourceValueEnum, resolvePackingBindingListSourceParams } from '../../../utils/packingBindingLifecycle';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, alignDescriptionColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  MaterialStackedCell,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

/** 与后端 DECIMAL(12,2) 一致 */
const MAX_PACKING_QUANTITY = 9999999999.99;

interface PackingBinding {
  id?: number;
  uuid?: string;
  finished_goods_receipt_id?: number;
  sales_delivery_id?: number;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  product_serial_no?: string;
  packing_material_id?: number;
  packing_material_code?: string;
  packing_material_name?: string;
  packing_quantity?: number;
  box_no?: string;
  binding_method?: string;
  barcode?: string;
  bound_by?: number;
  bound_by_name?: string;
  bound_at?: string;
  remarks?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    update?: { allowed?: boolean; reason?: string };
    delete?: { allowed?: boolean; reason?: string };
    print?: { allowed?: boolean; reason?: string };
  };
}

interface PackingBindingPageResult {
  data: PackingBinding[];
  total: number;
  success: boolean;
}

interface PackingTaskPoolItem {
  id: number;
  delivery_code: string;
  customer_name: string;
  review_status: string;
  status: string;
  updated_at: string;
}

interface PackingTaskPoolResult {
  pending_review: number;
  pending_outbound: number;
  total: number;
  items: PackingTaskPoolItem[];
}

type PackingBindingSourceType = 'sales_delivery' | 'finished_goods_receipt';

interface PackingBindingSourceItemOption {
  key: string;
  productId: number;
  productCode?: string;
  productName?: string;
  productSerialNo?: string;
  maxQuantity?: number;
}

const PACKING_QTY_KEYS = [
  'pending_quantity',
  'available_quantity',
  'delivery_quantity',
  'receipt_quantity',
  'qualified_quantity',
  'quantity',
];

function resolvePositiveNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function isNotFoundError(error: any): boolean {
  const status = Number(error?.response?.status ?? error?.status);
  return status === 404;
}

function buildPackingSourceItemOptions(detail: Record<string, unknown> | undefined): PackingBindingSourceItemOption[] {
  const lines = Array.isArray(detail?.items) ? (detail.items as Array<Record<string, unknown>>) : [];
  return lines
    .map((line, index) => {
      const productId = Number(line.product_id ?? line.material_id ?? line.finished_product_id);
      if (!Number.isFinite(productId) || productId <= 0) {
        return null;
      }
      const productCode = typeof line.product_code === 'string'
        ? line.product_code
        : typeof line.material_code === 'string'
          ? line.material_code
          : undefined;
      const productName = typeof line.product_name === 'string'
        ? line.product_name
        : typeof line.material_name === 'string'
          ? line.material_name
          : undefined;
      const productSerialNo = typeof line.product_serial_no === 'string' ? line.product_serial_no : undefined;
      const maxQuantity = PACKING_QTY_KEYS
        .map((key) => resolvePositiveNumber(line[key]))
        .find((value) => value != null);
      const lineKey = String(line.id ?? `${productId}-${index}`);
      return {
        key: lineKey,
        productId,
        productCode,
        productName,
        productSerialNo,
        maxQuantity,
      } satisfies PackingBindingSourceItemOption;
    })
    .filter((option): option is PackingBindingSourceItemOption => option != null);
}

function renderPbRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return nodes;
}


const PB_STAT_SPARK_1 = [3, 4, 5, 4, 6, 5, 7];
const PB_STAT_SPARK_2 = [2, 3, 2, 4, 3, 5, 4];
const PB_STAT_SPARK_3 = [1, 2, 1, 2, 1, 2, 2];

const PB_RESOURCE = 'kuaizhizao:production-execution-packing-binding';

function buildPackingQuantityRules(t: (key: string, options?: Record<string, unknown>) => string, required = true) {
  const rules: Array<{ required?: boolean; message?: string; validator?: (_: unknown, value: number) => Promise<void> }> = [];
  if (required) {
    rules.push({ required: true, message: t('app.kuaizhizao.packingBinding.ruleEnterPackingQty') });
  }
  rules.push({
    validator: (_rule, value) => {
      if (value == null || value === '') {
        return Promise.resolve();
      }
      const n = Number(value);
      if (!Number.isFinite(n) || n <= 0) {
        return Promise.reject(new Error(t('app.kuaizhizao.packingBinding.rulePackingQtyPositive')));
      }
      if (n > MAX_PACKING_QUANTITY) {
        return Promise.reject(
          new Error(t('app.kuaizhizao.packingBinding.rulePackingQtyMax', { max: MAX_PACKING_QUANTITY })),
        );
      }
      return Promise.resolve();
    },
  });
  return rules;
}

const PackingBindingPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const packingBindingDetailDrawerZIndex = token.zIndexPopupBase;
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<PackingBinding[]>([]);
  const packingBindingPerms = useResourcePermissions(PB_RESOURCE);
  const selectedBindingsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is PackingBinding => row != null),
    [selectedRowKeys],
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const getBindingSourceLabel = useCallback(
    (record: PackingBinding) => {
      if (record.sales_delivery_id) return t('app.kuaizhizao.packingBinding.sourceSalesDelivery');
      if (record.finished_goods_receipt_id) return t('app.kuaizhizao.packingBinding.sourceFinishedGoodsReceipt');
      return t('app.kuaizhizao.packingBinding.sourceOther');
    },
    [t],
  );

  const bindingMethodTag = useCallback(
    (m?: string) => {
      const v = (m || '').trim();
      if (v === 'scan') return <MarkerTag color="success">{t('app.kuaizhizao.packingBinding.bindingMethodScan')}</MarkerTag>;
      if (v === 'manual') return <MarkerTag color="geekblue">{t('app.kuaizhizao.packingBinding.bindingMethodManual')}</MarkerTag>;
      return v ? <MarkerTag color="default">{v}</MarkerTag> : '-';
    },
    [t],
  );

  const packingQuantityRules = useMemo(() => buildPackingQuantityRules(t), [t]);

  const bindingSourceTag = useCallback(
    (record: PackingBinding) => {
      const label = getBindingSourceLabel(record);
      const color = record.sales_delivery_id ? 'orange' : record.finished_goods_receipt_id ? 'success' : 'default';
      return <MarkerTag color={color}>{label}</MarkerTag>;
    },
    [getBindingSourceLabel],
  );

  const getErrorMessage = useCallback(
    (error: any, fallbackKey: string) => error?.message || t(fallbackKey),
    [t],
  );

  const [statsVersion, setStatsVersion] = useState(0);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const createFormRef = useRef<any>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createSourceType, setCreateSourceType] = useState<PackingBindingSourceType | null>(null);
  const [createSourceId, setCreateSourceId] = useState<number | null>(null);
  const [createSourceLoading, setCreateSourceLoading] = useState(false);
  const [createSourceItems, setCreateSourceItems] = useState<PackingBindingSourceItemOption[]>([]);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentBinding, setCurrentBinding] = useState<PackingBinding | null>(null);

  const [pbTrackingRefreshKey, setPbTrackingRefreshKey] = useState(0);

  const handleDetail = useCallback(async (record: PackingBinding) => {
    try {
      const detail = await packingBindingApi.get(record.id!.toString());
      setCurrentBinding(detail);
      setDetailDrawerVisible(true);
      setPbTrackingRefreshKey((k) => k + 1);
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.fetchDetailFailed'));
    }
  }, [messageApi]);

  const [localStats, setLocalStats] = useState({ total: 0, scan: 0, manual: 0 });
  const [taskPoolVisible, setTaskPoolVisible] = useState(false);
  const [taskPoolLoading, setTaskPoolLoading] = useState(false);
  const [taskPool, setTaskPool] = useState<PackingTaskPoolResult>({
    pending_review: 0,
    pending_outbound: 0,
    total: 0,
    items: [],
  });

  const refreshLocalStats = useCallback(async () => {
    try {
      const stats = await packingBindingApi.statistics();
      setLocalStats({
        total: Number(stats?.total || 0),
        scan: Number(stats?.scan || 0),
        manual: Number(stats?.manual || 0),
      });
    } catch {
      setLocalStats({ total: 0, scan: 0, manual: 0 });
    }
  }, []);

  const openTaskPool = useCallback(async () => {
    setTaskPoolVisible(true);
    setTaskPoolLoading(true);
    try {
      const result = await packingBindingApi.taskPool({ limit: 20 });
      setTaskPool({
        pending_review: Number(result?.pending_review || 0),
        pending_outbound: Number(result?.pending_outbound || 0),
        total: Number(result?.total || 0),
        items: Array.isArray(result?.items) ? result.items : [],
      });
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.taskPoolFetchFailed'));
    } finally {
      setTaskPoolLoading(false);
    }
  }, [getErrorMessage, messageApi]);

  const closeCreateModal = useCallback(() => {
    setCreateModalVisible(false);
    setCreateSourceType(null);
    setCreateSourceId(null);
    setCreateSourceItems([]);
    setCreateSourceLoading(false);
    createFormRef.current?.resetFields();
  }, []);

  const handleSourceItemChange = useCallback((lineKey: string | undefined) => {
    if (!lineKey) return;
    const selected = createSourceItems.find((item) => item.key === lineKey);
    if (!selected) return;
    const nextValues: Record<string, unknown> = {
      product_id: selected.productId,
      product_code: selected.productCode,
      product_name: selected.productName,
      product_serial_no: selected.productSerialNo,
    };
    if (selected.maxQuantity != null) {
      nextValues.packing_quantity = selected.maxQuantity;
    }
    createFormRef.current?.setFieldsValue(nextValues);
  }, [createSourceItems]);

  const openCreateFromSource = useCallback(async (sourceType: PackingBindingSourceType, sourceId: number) => {
    if (!packingBindingPerms.canRead && !packingBindingPerms.canCreate) {
      messageApi.error(t('app.kuaizhizao.packingBinding.noCreatePermission'));
      return;
    }
    try {
      const existing = sourceType === 'sales_delivery'
        ? await packingBindingApi.getByDelivery(String(sourceId))
        : await packingBindingApi.getByReceipt(String(sourceId));
      if (existing?.id != null) {
        await handleDetail(existing as PackingBinding);
        return;
      }
    } catch (error: any) {
      if (!isNotFoundError(error)) {
        messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.loadSourceFailed'));
        return;
      }
    }
    if (!packingBindingPerms.canCreate) {
      messageApi.error(t('app.kuaizhizao.packingBinding.noCreatePermission'));
      return;
    }
    setCreateModalVisible(true);
    setCreateSourceType(sourceType);
    setCreateSourceId(sourceId);
    setCreateSourceLoading(true);
    try {
      const detail = sourceType === 'sales_delivery'
        ? await warehouseApi.salesDelivery.get(String(sourceId))
        : await warehouseApi.finishedGoodsReceipt.get(String(sourceId));
      const itemOptions = buildPackingSourceItemOptions(detail as Record<string, unknown> | undefined);
      if (itemOptions.length === 0) {
        messageApi.warning(t('app.kuaizhizao.packingBinding.noBindableItems'));
        closeCreateModal();
        return;
      }
      setCreateSourceItems(itemOptions);
      const preferred = itemOptions[0];
      createFormRef.current?.setFieldsValue({
        source_item_key: preferred.key,
        product_id: preferred.productId,
        product_code: preferred.productCode,
        product_name: preferred.productName,
        product_serial_no: preferred.productSerialNo,
        packing_quantity: preferred.maxQuantity ?? undefined,
        binding_method: 'manual',
      });
    } catch (error: any) {
      closeCreateModal();
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.loadSourceFailed'));
    } finally {
      setCreateSourceLoading(false);
    }
  }, [closeCreateModal, getErrorMessage, handleDetail, messageApi, packingBindingPerms.canCreate, packingBindingPerms.canRead, t]);

  useEffect(() => {
    void refreshLocalStats();
  }, [statsVersion, refreshLocalStats]);


  const packingTracking = useDocumentTracking(
    detailDrawerVisible && currentBinding?.id ? 'packing_binding' : undefined,
    currentBinding?.id,
    pbTrackingRefreshKey,
  );
  const packingDetailLifecycle = useMemo(
    () => (currentBinding ? getPackingBindingLifecycle(currentBinding as Record<string, unknown>) : null),
    [currentBinding],
  );
  const packingNextSteps = packingDetailLifecycle?.nextStepSuggestions;
  const packingShowNextInTitle = Boolean(packingNextSteps?.length);

  const [currentBindingId, setCurrentBindingId] = useState<number | null>(null);

  useEffect(() => {
    const boxUuid = searchParams.get('uuid');
    const boxNo = searchParams.get('box_no');
    const action = searchParams.get('action');

    if (action === 'detail' && (boxUuid || boxNo)) {
      const load = async () => {
        try {
          // 先按 uuid 精确匹配（新协议），找不到再回退箱号模糊匹配（兼容旧参数）
          if (boxUuid) {
            const byUuid = await packingBindingApi.list({ uuid: boxUuid, skip: 0, limit: 1 });
            if (Array.isArray(byUuid) && byUuid.length > 0) {
              await handleDetail(byUuid[0]);
              setSearchParams({}, { replace: true });
              return;
            }
          }
          const fallbackBoxNo = boxNo || boxUuid;
          const byBoxNo = await packingBindingApi.list({ box_no: fallbackBoxNo, skip: 0, limit: 1 });
          if (Array.isArray(byBoxNo) && byBoxNo.length > 0) {
            await handleDetail(byBoxNo[0]);
            setSearchParams({}, { replace: true });
            return;
          }
          messageApi.warning(t('app.kuaizhizao.packingBinding.recordNotFound'));
        } catch {
          messageApi.error(t('app.kuaizhizao.packingBinding.fetchRecordFailed'));
        }
      };
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action !== 'bind') return;
    const sourceTypeRaw = searchParams.get('source_type');
    const sourceId = Number(searchParams.get('source_id'));
    if (
      (sourceTypeRaw === 'sales_delivery' || sourceTypeRaw === 'finished_goods_receipt')
      && Number.isFinite(sourceId)
      && sourceId > 0
    ) {
      void openCreateFromSource(sourceTypeRaw, sourceId);
    } else {
      messageApi.warning(t('app.kuaizhizao.packingBinding.invalidSourceParam'));
    }
    setSearchParams({}, { replace: true });
  }, [messageApi, openCreateFromSource, searchParams, setSearchParams, t]);

  const handleCreateSubmit = useCallback(async (values: Record<string, unknown>) => {
    if (!createSourceType || createSourceId == null) {
      messageApi.error(t('app.kuaizhizao.packingBinding.invalidSourceParam'));
      return false;
    }
    const productId = Number(values.product_id);
    if (!Number.isFinite(productId) || productId <= 0) {
      messageApi.error(t('app.kuaizhizao.packingBinding.ruleSelectSourceItem'));
      return false;
    }
    const payload = {
      product_id: productId,
      product_code: values.product_code,
      product_name: values.product_name,
      product_serial_no: values.product_serial_no,
      packing_material_code: values.packing_material_code,
      packing_material_name: values.packing_material_name,
      packing_quantity: values.packing_quantity,
      box_no: values.box_no,
      binding_method: values.binding_method,
      barcode: values.barcode,
      remarks: values.remarks,
    };
    try {
      if (createSourceType === 'sales_delivery') {
        await packingBindingApi.createFromDelivery(String(createSourceId), payload);
      } else {
        await packingBindingApi.createFromReceipt(String(createSourceId), payload);
      }
      messageApi.success(t('app.kuaizhizao.packingBinding.createSuccess'));
      closeCreateModal();
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      if (taskPoolVisible) {
        await openTaskPool();
      }
      return true;
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.createFailed'));
      return false;
    }
  }, [
    closeCreateModal,
    createSourceId,
    createSourceType,
    getErrorMessage,
    invalidateMenuBadgeCounts,
    messageApi,
    openTaskPool,
    t,
    taskPoolVisible,
  ]);

  const handleBatchGenerateQRCode = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.packingBinding.selectForQrcode'));
      return;
    }

    const failed: string[] = [];
    let successCount = 0;
    for (const key of selectedRowKeys) {
      try {
        const binding = await packingBindingApi.get(String(key));
        await qrcodeApi.generateBox({
          box_uuid: binding.box_no || binding.uuid || '',
          box_code: binding.box_no || '',
          material_codes: binding.product_code ? [binding.product_code] : [],
        });
        successCount += 1;
      } catch (error: any) {
        failed.push(`${String(key)}: ${getErrorMessage(error, 'app.kuaizhizao.packingBinding.generateFailed')}`);
      }
    }
    if (failed.length === 0) {
      messageApi.success(t('app.kuaizhizao.packingBinding.qrcodeSuccess', { count: successCount }));
      return;
    }
    messageApi.warning(t('app.kuaizhizao.packingBinding.qrcodePartial', { success: successCount, failed: failed.length }));
    getAntdModal().error({
      title: t('app.kuaizhizao.packingBinding.qrcodeBatchFailedTitle'),
      content: (
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {failed.map((msg) => (
            <div key={msg}>{msg}</div>
          ))}
        </div>
      ),
      width: 640,
    });
  };


  const handleEdit = useCallback(async (record: PackingBinding) => {
    try {
      setCurrentBindingId(record.id!);
      setEditModalVisible(true);
      const detail = await packingBindingApi.get(record.id!.toString());
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        packing_quantity: detail.packing_quantity,
        box_no: detail.box_no,
        remarks: detail.remarks,
        attachments: mapAttachmentsToUploadList(detail.attachments),
      });
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.fetchDetailFailed'));
    }
  }, [messageApi]);

  const handleEditSubmit = async (values: any) => {
    try {
      if (!currentBindingId) {
        messageApi.error(t('app.kuaizhizao.packingBinding.idNotFound'));
        return;
      }

      await packingBindingApi.update(currentBindingId.toString(), {
        packing_quantity: values.packing_quantity,
        box_no: values.box_no,
        remarks: values.remarks,
        attachments: normalizeDocumentAttachments(values.attachments),
      });
      messageApi.success(t('app.kuaizhizao.packingBinding.updateSuccess'));
      const oid = currentBindingId;
      setEditModalVisible(false);
      setCurrentBindingId(null);
      formRef.current?.resetFields();
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (oid != null && currentBinding?.id === oid) {
        try {
          const fresh = await packingBindingApi.get(String(oid));
          setCurrentBinding(fresh);
          setPbTrackingRefreshKey((k) => k + 1);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.updateFailed'));
      throw error;
    }
  };

  const handleDeleteOne = async (record: PackingBinding) => {
    try {
      await packingBindingApi.delete(record.id!.toString());
      messageApi.success(t('app.kuaizhizao.packingBinding.deleteSuccess'));
      if (currentBinding?.id === record.id) {
        setDetailDrawerVisible(false);
        setCurrentBinding(null);
      }
      setSelectedRowKeys([]);
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.deleteFailed'));
    }
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.packingBinding.selectToDelete'));
      return;
    }
    const failed: string[] = [];
    let successCount = 0;
    for (const key of keys) {
      try {
        await packingBindingApi.delete(String(key));
        successCount += 1;
      } catch (error: any) {
        failed.push(`${String(key)}: ${getErrorMessage(error, 'common.deleteFailed')}`);
      }
    }
    try {
      setSelectedRowKeys([]);
      if (currentBinding?.id != null && keys.map(Number).includes(currentBinding.id)) {
        setDetailDrawerVisible(false);
        setCurrentBinding(null);
      }
      actionRef.current?.reload();
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();
      if (failed.length === 0) {
        messageApi.success(t('app.kuaizhizao.packingBinding.batchDeleteSuccess', { count: successCount }));
        return;
      }
      messageApi.warning(t('app.kuaizhizao.packingBinding.batchDeletePartial', { success: successCount, failed: failed.length }));
      getAntdModal().error({
        title: t('app.kuaizhizao.packingBinding.batchDeleteFailedTitle'),
        content: (
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {failed.map((msg) => (
              <div key={msg}>{msg}</div>
            ))}
          </div>
        ),
        width: 640,
      });
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.batchDeleteFailed'));
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<PackingBinding>[] = useMemo(
    () =>
      alignDescriptionColumns([
      {
        title: t('app.kuaizhizao.packingBinding.colBoxNo'),
        dataIndex: 'box_no',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.box_no ?? '') }}>{r.box_no ?? '-'}</Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colProductCode'),
        dataIndex: 'product_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.product_code ?? '') }}>{r.product_code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.packingBinding.colProductName'), dataIndex: 'product_name' },
      {
        title: t('app.kuaizhizao.packingBinding.colProductSerialNo'),
        dataIndex: 'product_serial_no',
        render: (val) => val || '-',
      },
      { title: t('app.kuaizhizao.packingBinding.colPackingQty'), dataIndex: 'packing_quantity', valueType: 'digit' },
      {
        title: t('app.kuaizhizao.packingBinding.colPackingMaterialCode'),
        dataIndex: 'packing_material_code',
        render: (val) => val || '-',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colPackingMaterialName'),
        dataIndex: 'packing_material_name',
        render: (val) => val || '-',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBindingMethod'),
        dataIndex: 'binding_method',
        render: (_, r) => bindingMethodTag(r.binding_method),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBarcode'),
        dataIndex: 'barcode',
        render: (val) =>
          val ? <Typography.Text copyable={{ text: String(val) }}>{String(val)}</Typography.Text> : '-',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colFinishedGoodsReceiptId'),
        dataIndex: 'finished_goods_receipt_id',
        render: (val) => (val != null ? String(val) : '-'),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colSalesDeliveryId'),
        dataIndex: 'sales_delivery_id',
        render: (val) => (val != null ? String(val) : '-'),
      },
      { title: t('app.kuaizhizao.packingBinding.colBoundBy'), dataIndex: 'bound_by_name' },
      { title: t('app.kuaizhizao.packingBinding.colBoundAt'), dataIndex: 'bound_at', valueType: 'dateTime' },
      {
        title: t('common.remark'),
        dataIndex: 'remarks',
        span: 3,
      },
    ] as ProDescriptionsItemProps<PackingBinding>[]),
    [bindingMethodTag, t],
  );

  const renderPbRowActionNodes = useCallback(
    (record: PackingBinding): React.ReactNode[] => {
      const nodes: React.ReactNode[] = [];
      nodes.push(
        <Button {...rowActionKind('read')}
          key="detail"
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            void handleDetail(record);
          }}
        >
          {t('common.detail')}
        </Button>
      );
      nodes.push(
        <Button {...rowActionKind('update')}
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            void handleEdit(record);
          }}
        >
          {t('common.edit')}
        </Button>
      );
      nodes.push(
        <Popconfirm {...rowActionKind('delete')}
          key="del"
          title={t('app.kuaizhizao.packingBinding.confirmDeleteOne')}
          onConfirm={() => void handleDeleteOne(record)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => e.stopPropagation()}
          >
            {t('common.delete')}
          </Button>
        </Popconfirm>
      );
      return nodes;
    },
    [handleDetail, handleEdit, t],
  );

  const packingBindingMethodValueEnum = useMemo(() => buildPackingBindingMethodValueEnum(t), [t]);
  const packingBindingSourceValueEnum = useMemo(() => buildPackingBindingSourceValueEnum(t), [t]);

  const columns: ProColumns<PackingBinding>[] = useMemo(
    () => alignProColumns<PackingBinding>([
      {
        title: t('app.kuaizhizao.packingBinding.colBoundAt'),
        dataIndex: 'bound_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        hideInSearch: false,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        hideInSearch: false,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBoxNo'),
        dataIndex: 'box_no',
        width: 168,
        minWidth: 168,
        uniTableKeepWidth: true,
        uniTablePrimaryFlex: false,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        hideInSearch: false,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.box_no ?? '') }} ellipsis>
            {r.box_no ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: `${t('app.kuaizhizao.packingBinding.colProductName')}/${t('app.kuaizhizao.packingBinding.colProductCode')}`,
        key: 'product_stacked',
        dataIndex: 'product_name',
        // 无行项目明细：产品名码叠列吃掉视口剩余（RemainderFlex）
        minWidth: 200,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: false,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (
          <MaterialStackedCell material_name={r.product_name} material_code={r.product_code} />
        ),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colProductCode'),
        dataIndex: 'product_code',
        hideInTable: true,
        sorter: true,
        hideInSearch: false,
      },
      {
        title: t('app.kuaizhizao.packingBinding.colProductName'),
        dataIndex: 'product_name',
        hideInTable: true,
        sorter: true,
        hideInSearch: false,
      },
      {
        title: t('app.kuaizhizao.packingBinding.colProductSerialNo'),
        dataIndex: 'product_serial_no',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: false,
        render: (_, r) => r.product_serial_no || '-',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colPackingQty'),
        dataIndex: 'packing_quantity',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        align: 'right',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.packingBinding.colPackingMaterial'),
        dataIndex: 'packing_material_name',
        width: 140,
        minWidth: 140,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: false,
        render: (_, r) => r.packing_material_name || '-',
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBindingMethod'),
        dataIndex: 'binding_method',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: false,
        valueType: 'select',
        valueEnum: packingBindingMethodValueEnum,
        render: (_, r) => bindingMethodTag(r.binding_method),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colSource'),
        dataIndex: 'source_type',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: false,
        valueType: 'select',
        valueEnum: packingBindingSourceValueEnum,
        render: (_, r) => bindingSourceTag(r),
      },
      {
        title: `${t('app.kuaizhizao.packingBinding.colBoundBy')}/${t('app.kuaizhizao.packingBinding.colBoundAt')}`,
        key: 'bound_stacked',
        dataIndex: 'bound_at',
        width: 168,
        minWidth: 168,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={r.bound_by_name?.trim() || '-'}
            secondary={r.bound_at ? formatDateTime(r.bound_at, 'YYYY-MM-DD HH:mm') : '-'}
            secondaryCopyable={false}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBoundBy'),
        dataIndex: 'bound_by_name',
        hideInTable: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.packingBinding.colBoundAt'),
        dataIndex: 'bound_at',
        valueType: 'dateTime',
        hideInTable: true,
        sorter: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<PackingBinding>(t),
      {
        title: t('app.kuaizhizao.packingBinding.colLifecycle'),
        key: 'lifecycle',
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getPackingBindingLifecycle(record as Record<string, unknown>);
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
        render: (_, record) =>
          renderPbRowActions(renderPbRowActionNodes(record), `pb-${record.id ?? 'row'}`),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [bindingMethodTag, bindingSourceTag, packingBindingMethodValueEnum, packingBindingSourceValueEnum, renderPbRowActionNodes, t],
  );

  const handleRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    _filter: Record<string, React.ReactText[] | null>,
    searchFormValues?: Record<string, unknown>,
  ) => {
    try {
      const s = searchFormValues ?? {};
      const methodParams = resolvePackingBindingListMethodParams(s);
      const sourceParams = resolvePackingBindingListSourceParams(s);
      const { sortBy, sortOrder } = extractProTableSort(sort);
      const orderBy =
        sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
      const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : '';

      const apiParams: Parameters<typeof packingBindingApi.listPage>[0] = {
        skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
        limit: params.pageSize ?? 20,
        ...methodParams,
        ...sourceParams,
        order_by: orderBy,
        receipt_id: params.receipt_id,
        product_id: params.product_id,
        uuid: params.uuid as string | undefined,
      };

      if (fuzzyKeyword) {
        apiParams.keyword = fuzzyKeyword;
      } else {
        if (s.box_no != null && String(s.box_no).trim()) {
          apiParams.box_no = String(s.box_no).trim();
        }
        if (s.product_code != null && String(s.product_code).trim()) {
          apiParams.product_code = String(s.product_code).trim();
        }
        if (s.product_name != null && String(s.product_name).trim()) {
          apiParams.product_name = String(s.product_name).trim();
        }
        if (s.product_serial_no != null && String(s.product_serial_no).trim()) {
          apiParams.product_serial_no = String(s.product_serial_no).trim();
        }
        if (s.packing_material_name != null && String(s.packing_material_name).trim()) {
          apiParams.packing_material_name = String(s.packing_material_name).trim();
        }
      }

      const boundRange = s.bound_at_range as [unknown, unknown] | undefined;
      if (boundRange && Array.isArray(boundRange) && boundRange[0]) {
        apiParams.bound_at_start_date = formatDateTime(boundRange[0] as string | Date, 'YYYY-MM-DD');
        apiParams.bound_at_end_date = boundRange[1]
          ? formatDateTime(boundRange[1] as string | Date, 'YYYY-MM-DD')
          : apiParams.bound_at_start_date;
      }

      const createdRange = s.created_at_range as [unknown, unknown] | undefined;
      if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
        apiParams.created_start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
        apiParams.created_end_date = createdRange[1]
          ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
          : apiParams.created_start_date;
      }

      const result = (await packingBindingApi.listPage(apiParams)) as PackingBindingPageResult;
      const data = Array.isArray(result?.data) ? result.data : [];
      return {
        data,
        success: result.success !== false,
        total: Number(result?.total || 0),
      };
    } catch (error: any) {
      messageApi.error(getErrorMessage(error, 'app.kuaizhizao.packingBinding.fetchListFailed'));
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  const statCards: StatCard[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.packingBinding.statTotal'),
        value: localStats.total,
        valueStyle: { color: token.colorPrimary },
        backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_1} color={token.colorPrimary} />,
      },
      {
        title: t('app.kuaizhizao.packingBinding.statScan'),
        value: localStats.scan,
        valueStyle: { color: token.colorSuccess },
        backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_2} color={token.colorSuccess} />,
      },
      {
        title: t('app.kuaizhizao.packingBinding.statManual'),
        value: localStats.manual,
        valueStyle: { color: token.colorWarning },
        backgroundChart: <SimpleSparkline data={PB_STAT_SPARK_3} color={token.colorWarning} />,
      },
    ],
    [localStats.manual, localStats.scan, localStats.total, t, token.colorPrimary, token.colorSuccess, token.colorWarning],
  );

  const taskPoolColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.packingBinding.taskPoolColDeliveryCode'), dataIndex: 'delivery_code', width: 180 },
      { title: t('app.kuaizhizao.packingBinding.taskPoolColCustomer'), dataIndex: 'customer_name', width: 200 },
      { title: t('app.kuaizhizao.packingBinding.taskPoolColReviewStatus'), dataIndex: 'review_status', width: 120 },
      { title: t('app.kuaizhizao.packingBinding.taskPoolColDocStatus'), dataIndex: 'status', width: 120 },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('common.actions'),
        dataIndex: 'actions',
        width: 120,
        fixed: 'right' as const,
        render: (_: unknown, row: PackingTaskPoolItem) => (
          <Button
            {...rowActionKind('execute')}
            {...rowActionLabelKeep()}
            type="link"
            size="small"
            disabled={!packingBindingPerms.canCreate}
            onClick={() => void openCreateFromSource('sales_delivery', row.id)}
          >
            {t('app.kuaizhizao.packingBinding.actionGoBind')}
          </Button>
        ),
      },
    ],
    [openCreateFromSource, packingBindingPerms.canCreate, t],
  );

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailBaseColumns,
    currentBinding,
    'packing_binding',
  );

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('app.kuaizhizao.packingBinding.scopeAlert')}
        />
        <UniTable<PackingBinding>
          headerTitle={t('app.kuaizhizao.packingBinding.title')}
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.packingBinding)}
          columnPersistenceId="apps.kuaizhizao.pages.production-execution.packing-binding-width-v1"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField="binding_method"
          pinnedTabsValueEnum={packingBindingMethodValueEnum}
          request={handleRequest}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
        enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={true}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.packingBinding.confirmBatchDelete', { count })}
          toolBarActionsAfterCreate={[
            <Button {...rowActionKind('read')} key="task-pool" onClick={() => void openTaskPool()}>
              {t('app.kuaizhizao.packingBinding.taskPoolButton')}
            </Button>,
          ]}
          toolBarActionsAfterDelete={[
            <UniBatchButton
              key="packing-binding-batch-qrcode"
              selectedRowKeys={selectedRowKeys}
              size="medium"
              icon={<QrcodeOutlined />}
              disabled={
                selectedBindingsForBatch.length > 0 &&
                !packingBindingBatchPrintAllowed(
                  selectedBindingsForBatch,
                  packingBindingPerms.canPrint,
                )
              }
              onAction={() => void handleBatchGenerateQRCode()}
            >
              {t('app.kuaizhizao.packingBinding.batchGenerateQrcode')}
            </UniBatchButton>,
          ]}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={t('app.kuaizhizao.packingBinding.createTitle')}
        open={createModalVisible}
        onClose={closeCreateModal}
        onFinish={handleCreateSubmit}
        formRef={createFormRef}
        {...MODAL_CONFIG}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={t('app.kuaizhizao.packingBinding.sourceHint', {
            source: createSourceType === 'sales_delivery'
              ? t('app.kuaizhizao.packingBinding.sourceSalesDelivery')
              : t('app.kuaizhizao.packingBinding.sourceFinishedGoodsReceipt'),
            id: createSourceId ?? '-',
          })}
        />
        <ProFormSelect
          name="source_item_key"
          label={t('app.kuaizhizao.packingBinding.fieldSourceItem')}
          placeholder={t('app.kuaizhizao.packingBinding.placeholderSourceItem')}
          rules={[{ required: true, message: t('app.kuaizhizao.packingBinding.ruleSelectSourceItem') }]}
          options={createSourceItems.map((item) => ({
            label: item.maxQuantity != null
              ? `${item.productCode || '-'} / ${item.productName || '-'}（${t('app.kuaizhizao.packingBinding.fieldPackingQty')} ${item.maxQuantity}）`
              : `${item.productCode || '-'} / ${item.productName || '-'}`,
            value: item.key,
          }))}
          fieldProps={{
            showSearch: true,
            onChange: (value) => handleSourceItemChange(value as string),
          }}
        />
        <ProFormText
          name="product_code"
          label={t('app.kuaizhizao.packingBinding.colProductCode')}
          fieldProps={{ readOnly: true }}
        />
        <ProFormText
          name="product_name"
          label={t('app.kuaizhizao.packingBinding.colProductName')}
          fieldProps={{ readOnly: true }}
        />
        <ProFormText name="product_serial_no" label={t('app.kuaizhizao.packingBinding.colProductSerialNo')} />
        <ProFormText name="packing_material_code" label={t('app.kuaizhizao.packingBinding.colPackingMaterialCode')} />
        <ProFormText name="packing_material_name" label={t('app.kuaizhizao.packingBinding.colPackingMaterialName')} />
        <ProFormDigit
          name="packing_quantity"
          label={t('app.kuaizhizao.packingBinding.fieldPackingQty')}
          placeholder={t('app.kuaizhizao.packingBinding.placeholderPackingQty')}
          rules={packingQuantityRules}
          min={0.01}
          max={MAX_PACKING_QUANTITY}
          fieldProps={{ precision: 2, step: 0.01 }}
        />
        <ProFormText name="box_no" label={t('app.kuaizhizao.packingBinding.fieldBoxNo')} />
        <ProFormSelect
          name="binding_method"
          label={t('app.kuaizhizao.packingBinding.colBindingMethod')}
          initialValue="manual"
          options={[
            { label: t('app.kuaizhizao.packingBinding.bindingMethodManual'), value: 'manual' },
            { label: t('app.kuaizhizao.packingBinding.bindingMethodScan'), value: 'scan' },
          ]}
        />
        <ProFormText name="barcode" label={t('app.kuaizhizao.packingBinding.colBarcode')} />
        <ProFormTextArea
          name="remarks"
          label={t('common.remark')}
          placeholder={t('app.kuaizhizao.packingBinding.placeholderRemarks')}
          fieldProps={{ rows: 3 }}
        />
        <ProFormText name="product_id" hidden />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaizhizao.packingBinding.editTitle')}
        open={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setCurrentBindingId(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleEditSubmit}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <ProFormDigit
          name="packing_quantity"
          label={t('app.kuaizhizao.packingBinding.fieldPackingQty')}
          placeholder={t('app.kuaizhizao.packingBinding.placeholderPackingQty')}
          rules={packingQuantityRules}
          min={0.01}
          max={MAX_PACKING_QUANTITY}
          fieldProps={{ precision: 2, step: 0.01 }}
        />
        <ProFormText
          name="box_no"
          label={t('app.kuaizhizao.packingBinding.fieldBoxNo')}
          placeholder={t('app.kuaizhizao.packingBinding.placeholderBoxNo')}
        />
        <ProFormTextArea
          name="remarks"
          label={t('common.remark')}
          placeholder={t('app.kuaizhizao.packingBinding.placeholderRemarks')}
          fieldProps={{ rows: 3 }}
        />
        <DocumentAttachmentsField category="packing_binding_attachments" />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.packingBinding.detailTitle')}${currentBinding?.box_no ? ` - ${currentBinding.box_no}` : ''}`}
        open={detailDrawerVisible}
        zIndex={packingBindingDetailDrawerZIndex}
        size={DRAWER_CONFIG.HALF_WIDTH}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentBinding(null);
        }}
        extra={
          currentBinding ? (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => void handleEdit(currentBinding)}>
                {t('common.edit')}
              </Button>
              <Popconfirm
                title={t('app.kuaizhizao.packingBinding.confirmDeleteOne')}
                onConfirm={() => void handleDeleteOne(currentBinding)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button danger icon={<DeleteOutlined />}>
                  {t('common.delete')}
                </Button>
              </Popconfirm>
            </Space>
          ) : null
        }
        collaborationTitleSuffix={
          currentBinding && packingShowNextInTitle ? (
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {t('common.next')}：
              {packingNextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
            </Typography.Text>
          ) : undefined
        }
        basic={
          currentBinding ? (
            <Descriptions
              column={3}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        collaboration={
          currentBinding && (packingDetailLifecycle?.mainStages ?? []).length > 0 ? (
            <UniLifecycleStepper
              steps={packingDetailLifecycle!.mainStages ?? []}
              status={packingDetailLifecycle!.status}
              showLabels
              nextStepSuggestions={packingDetailLifecycle!.nextStepSuggestions}
              hideNextStepSuggestions={packingShowNextInTitle}
            />
          ) : null
        }
        timeline={
          currentBinding ? (
            packingTracking.data && !packingTracking.loading ? (
              <DocumentTrackingTimelineBody data={packingTracking.data} />
            ) : packingTracking.error ? (
              <Typography.Text type="danger">{packingTracking.error}</Typography.Text>
            ) : !packingTracking.loading ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('components.documentTrackingPanel.noOperations')} />
            ) : null
          ) : undefined
        }
        traceDocument={
          currentBinding?.id != null
            ? {
                documentType: 'packing_binding',
                documentId: currentBinding.id,
                selfDocumentId: currentBinding.id,
                renderBriefActions: (doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailDrawerVisible(false);
                      setCurrentBinding(null);
                    }}
                  />
                ),
              }
            : undefined
        }
      />

      <Modal
        title={t('app.kuaizhizao.packingBinding.taskPoolTitle')}
        open={taskPoolVisible}
        onCancel={() => setTaskPoolVisible(false)}
        footer={null}
        width={920}
      >
        <Alert
          showIcon
          type="info"
          title={t('app.kuaizhizao.packingBinding.taskPoolSummary', {
            pendingReview: taskPool.pending_review,
            pendingOutbound: taskPool.pending_outbound,
            total: taskPool.total,
          })}
          style={{ marginBottom: 12 }}
        />
        <Table<PackingTaskPoolItem>
          rowKey="id"
          loading={taskPoolLoading}
          dataSource={taskPool.items}
          pagination={false}
          size="small"
          columns={taskPoolColumns}
        />
      </Modal>
    </>
  );
};

export default PackingBindingPage;
