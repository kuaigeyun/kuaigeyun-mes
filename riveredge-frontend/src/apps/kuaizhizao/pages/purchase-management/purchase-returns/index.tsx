/**
 * 采购退货单管理页面
 *
 * 提供采购退货单的查看、确认退货与删除；列表与详情遵循 UI_Standard / riveredge-detail-drawer-ui。
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState, useMemo, useEffect, useCallback, lazy, Suspense } from 'react';
import type { TFunction } from 'i18next';
import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormDatePicker,
  ProFormTextArea,
  ProFormSelect,
  ProFormInstance,
} from '@ant-design/pro-components';
import type { DescriptionsProps } from 'antd';
import {
  App,
  Alert,
  Button,
  Tag,
  Modal,
  Table,
  Typography,
  Descriptions,
  Empty,
  Dropdown,
  Space,
  Row,
  Col,
  Form as AntForm,
  InputNumber,
  Input,
  Select,
  Spin,
  theme,
} from 'antd';
import { EyeOutlined, CheckCircleOutlined, EditOutlined, PlusOutlined, AppstoreAddOutlined, ImportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  FormModalTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  DetailDrawerActions,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import {
  DOCUMENT_DETAIL_COL_WIDTH,
  DOCUMENT_DETAIL_CONTROL_SIZE,
  DOCUMENT_DETAIL_NUM_COL,
  DOCUMENT_DETAIL_TABLE_PROPS,
  DOCUMENT_DETAIL_TEXT_COL,
  DocumentDetailTableStyles,
} from '../../../components/document-detail-table/documentDetailTable';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import type { Material } from '../../../../master-data/types/material';
import { SimpleSparkline } from '../../../../../components';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { qualityApi, warehouseApi } from '../../../services/production';
import { listPurchaseOrders, previewPushToPurchaseReturn, pushPurchaseOrderToPurchaseReturn, type DocumentPushPreview, type PurchaseOrder } from '../../../services/purchase';
import type { PurchaseReturn, PurchaseReturnDetail, PurchaseReturnItem } from '../../../services/purchase-return';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  purchaseReturnBatchConfirmAllowed,
  purchaseReturnBatchWithdrawAllowed,
  purchaseOrderCapabilityReasonMessage,
  qualityInspectionCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';
import { useWarehouseLocationOptions } from '../../../hooks/useWarehouseLocationOptions';
import { supplierApi, getDictionaryOptions } from '../../../../master-data/services/supply-chain';
import { initializeSystemDictionaries } from '../../../../../services/dataDictionary';
import {
  buildPurchaseReturnLifecycleValueEnum,
  getPurchaseReturnLifecycle,
  LIST_LIFECYCLE_STAGE_FIELD,
  resolvePurchaseReturnListLifecycleParams,
} from '../../../utils/purchaseReturnLifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import type { PurchaseReturnListParams } from '../../../services/purchase-return';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { formatDateTime, formatNumber, formatQuantity } from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

const PURCHASE_RETURN_RESOURCE = 'kuaizhizao:purchase-return';

const PURCHASE_RETURN_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_purchase_returns';

const PR_DETAIL_ITEMS_MIN_WIDTH = 1000;

const RETURN_REASON_VALUES = [
  'QUALITY_ISSUE',
  'SPEC_MISMATCH',
  'QTY_ERROR',
  'PACKAGE_DAMAGE',
  'CUSTOMER_CANCEL',
  'OTHER',
];
const RETURN_TYPE_VALUES = ['EXCHANGE', 'REFUND', 'REWORK', 'SCRAP_RETURN', 'OTHER'];
const SHIPPING_METHOD_VALUES = ['EXPRESS', 'LOGISTICS', 'SELF_PICKUP', 'DEDICATED', 'AIR', 'SEA'];

const DICT_VALUE_TO_KEY: Record<string, string> = {
  QUALITY_ISSUE: 'qualityIssue',
  SPEC_MISMATCH: 'specMismatch',
  QTY_ERROR: 'qtyError',
  PACKAGE_DAMAGE: 'packageDamage',
  CUSTOMER_CANCEL: 'customerCancel',
  OTHER: 'other',
  EXCHANGE: 'exchange',
  REFUND: 'refund',
  REWORK: 'rework',
  SCRAP_RETURN: 'scrapReturn',
  EXPRESS: 'express',
  LOGISTICS: 'logistics',
  SELF_PICKUP: 'selfPickup',
  DEDICATED: 'dedicated',
  AIR: 'air',
  SEA: 'sea',
};

function buildDictFallbackOptions(t: TFunction, values: string[]) {
  return values.map((value) => {
    const dictKey = DICT_VALUE_TO_KEY[value] ?? value.toLowerCase();
    return {
      label: t(`app.kuaizhizao.purchaseReturn.dict.${dictKey}`),
      value,
    };
  });
}

function getImportRowValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
}

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD');
    }
    if (col.render && dataSource != null) {
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

function renderPurchaseReturnRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, { keyPrefix });
}

type PullPurchaseOrderCandidate = PurchaseOrder & {
  id: number;
  order_code?: string;
};

type PullIncomingInspectionCandidate = {
  id: number;
  inspection_code?: string;
  purchase_receipt_code?: string;
  supplier_name?: string;
  material_name?: string;
  status?: string;
  quality_status?: string;
  unqualified_quantity?: number;
  updated_at?: string;
  capabilities?: {
    push_purchase_return?: { allowed?: boolean; reason?: string | null };
  };
};

const PurchaseReturnsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const pullFromPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'purchase_return.pull_from_purchase_order');
  const pullFromIncomingInspectionAction = resolveKuaizhizaoDocumentAction(
    t,
    'purchase_return.pull_from_incoming_inspection',
  );
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const purchaseReturnDetailDrawerZIndex = token.zIndexPopupBase;
  const defaultUnit = t('app.kuaizhizao.purchaseReturn.defaultUnit');
  const fallbackReturnReasonOptions = useMemo(
    () => buildDictFallbackOptions(t, RETURN_REASON_VALUES),
    [t, i18n.language],
  );
  const fallbackReturnTypeOptions = useMemo(
    () => buildDictFallbackOptions(t, RETURN_TYPE_VALUES),
    [t, i18n.language],
  );
  const fallbackShippingMethodOptions = useMemo(
    () => buildDictFallbackOptions(t, SHIPPING_METHOD_VALUES),
    [t, i18n.language],
  );

  const getReturnStatusLabel = (status?: string) => {
    if (!status) return '-';
    const statusLabelMap: Record<string, string> = {
      '待退货': t('app.kuaizhizao.purchaseReturn.statusPending'),
      '已退货': t('app.kuaizhizao.purchaseReturn.statusReturned'),
      '已取消': t('app.kuaizhizao.purchaseReturn.statusCancelled'),
      '草稿': t('app.kuaizhizao.purchaseReturn.statusDraft'),
    };
    return statusLabelMap[status] ?? status;
  };

  const getReviewStatusLabel = (status?: string) => {
    if (!status) return '-';
    const reviewLabelMap: Record<string, string> = {
      '待审核': t('app.kuaizhizao.purchaseReturn.reviewPending'),
      '审核通过': t('app.kuaizhizao.purchaseReturn.reviewApproved'),
      '审核驳回': t('app.kuaizhizao.purchaseReturn.reviewRejected'),
    };
    return reviewLabelMap[status] ?? status;
  };

  const returnStatusMap = useMemo(
    () => ({
      待退货: { text: t('app.kuaizhizao.purchaseReturn.statusPending'), color: 'default' },
      已退货: { text: t('app.kuaizhizao.purchaseReturn.statusReturned'), color: 'success' },
      已取消: { text: t('app.kuaizhizao.purchaseReturn.statusCancelled'), color: 'error' },
      草稿: { text: t('app.kuaizhizao.purchaseReturn.statusDraft'), color: 'default' },
    }),
    [t, i18n.language],
  );

  const reviewStatusMap = useMemo(
    () => ({
      待审核: { text: t('app.kuaizhizao.purchaseReturn.reviewPending'), color: 'default' },
      审核通过: { text: t('app.kuaizhizao.purchaseReturn.reviewApproved'), color: 'success' },
      审核驳回: { text: t('app.kuaizhizao.purchaseReturn.reviewRejected'), color: 'error' },
    }),
    [t, i18n.language],
  );
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<PurchaseReturn[]>([]);
  const purchaseReturnLifecycleValueEnum = useMemo(() => buildPurchaseReturnLifecycleValueEnum(t), [t]);
  const [supplierList, setSupplierList] = useState<Array<{ id: number; name?: string; code?: string }>>([]);

  useEffect(() => {
    supplierApi.list({ limit: 1000, isActive: true }).then((res) => {
      const list = Array.isArray(res) ? res : (res as { data?: typeof supplierList })?.data ?? [];
      setSupplierList(Array.isArray(list) ? list : []);
    }).catch(() => setSupplierList([]));
  }, []);

  const purchaseReturnSupplierSearchOptions = useMemo(
    () =>
      supplierList.map((s) => ({
        value: Number(s.id),
        label: [s.name, s.code].filter(Boolean).join(' · ') || String(s.id),
      })),
    [supplierList],
  );

  const pullPoQueryCloseRef = useRef<(() => void) | null>(null);
  const pullIiQueryCloseRef = useRef<(() => void) | null>(null);
  const purchaseReturnPerms = useResourcePermissions(PURCHASE_RETURN_RESOURCE);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const queryClient = useQueryClient();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const selectedReturnsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is PurchaseReturn => row != null),
    [selectedRowKeys],
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDetail, setEditingDetail] = useState<PurchaseReturnDetail | null>(null);
  const [pendingFormValues, setPendingFormValues] = useState<Record<string, any> | null>(null);
  const [pullWarehouseId, setPullWarehouseId] = useState<number | undefined>(undefined);
  const [pullWarehouseName, setPullWarehouseName] = useState('');
  const [pullPoPreviewOpen, setPullPoPreviewOpen] = useState(false);
  const [pullPoPreviewLoading, setPullPoPreviewLoading] = useState(false);
  const [pullPoPreviewConfirming, setPullPoPreviewConfirming] = useState(false);
  const [pullPoPreviewData, setPullPoPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pullPoPreviewOrderId, setPullPoPreviewOrderId] = useState<number | null>(null);
  const [pullPoSelectedItemIds, setPullPoSelectedItemIds] = useState<number[]>([]);
  const [pullIiPreviewOpen, setPullIiPreviewOpen] = useState(false);
  const [pullIiPreviewLoading, setPullIiPreviewLoading] = useState(false);
  const [pullIiPreviewConfirming, setPullIiPreviewConfirming] = useState(false);
  const [pullIiPreviewData, setPullIiPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pullIiPreviewInspectionId, setPullIiPreviewInspectionId] = useState<number | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const formRef = useRef<ProFormInstance>(null);

  const {
    customFields: purchaseReturnFormCustomFields,
    customFieldValues: purchaseReturnFormCustomFieldValues,
    loadFieldValues: loadPurchaseReturnFormFieldValues,
    extractFormValues: extractPurchaseReturnFormValues,
    saveCustomFieldValues: savePurchaseReturnCustomFieldValues,
    resetFieldValues: resetPurchaseReturnFormFieldValues,
  } = useCustomFields({ tableName: PURCHASE_RETURN_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: purchaseReturnListCustomFields,
    generateCustomFieldColumns: generatePurchaseReturnCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichPurchaseReturnRecordsWithCustomFields,
    customFieldValues: purchaseReturnDetailCustomFieldValues,
    loadFieldValuesForDetail: loadPurchaseReturnFieldValuesForDetail,
    resetDetailFieldValues: resetPurchaseReturnDetailFieldValues,
  } = useCustomFieldsForList<PurchaseReturn>({ tableName: PURCHASE_RETURN_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (purchaseReturnListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [purchaseReturnListCustomFields.length]);

  const {
    selectedWarehouseId,
    locationOptions,
    updateSelectedWarehouseId,
    resetSelectedWarehouseId,
  } = useWarehouseLocationOptions();
  const [returnReasonOptions, setReturnReasonOptions] = useState(fallbackReturnReasonOptions);
  const [returnTypeOptions, setReturnTypeOptions] = useState(fallbackReturnTypeOptions);
  const [shippingMethodOptions, setShippingMethodOptions] = useState(fallbackShippingMethodOptions);
  const [dictOptionsLoading, setDictOptionsLoading] = useState(false);

  const invalidatePurchaseReturnStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['purchaseReturnStatistics'] });
  };

  const { data: prStats } = useQuery({
    queryKey: ['purchaseReturnStatistics'],
    queryFn: () => warehouseApi.purchaseReturn.statistics(),
  });

  useEffect(() => {
    if (!modalVisible) return;
    let cancelled = false;
    (async () => {
      setDictOptionsLoading(true);
      const loadAll = async () => {
        const [reason, rtype, ship] = await Promise.all([
          getDictionaryOptions('RETURN_REASON'),
          getDictionaryOptions('RETURN_TYPE'),
          getDictionaryOptions('SHIPPING_METHOD'),
        ]);
        return { reason, rtype, ship };
      };
      try {
        let { reason, rtype, ship } = await loadAll();
        if (!cancelled && (reason.length === 0 || rtype.length === 0 || ship.length === 0)) {
          try {
            await initializeSystemDictionaries();
            if (!cancelled) ({ reason, rtype, ship } = await loadAll());
          } catch (e) {
            console.warn('initializeSystemDictionaries failed:', e);
          }
        }
        if (!cancelled) {
          setReturnReasonOptions(reason.length ? reason : fallbackReturnReasonOptions);
          setReturnTypeOptions(rtype.length ? rtype : fallbackReturnTypeOptions);
          setShippingMethodOptions(ship.length ? ship : fallbackShippingMethodOptions);
        }
      } finally {
        if (!cancelled) setDictOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalVisible, fallbackReturnReasonOptions, fallbackReturnTypeOptions, fallbackShippingMethodOptions]);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<PurchaseReturnDetail | null>(null);
  const [prRetTrackingRefreshKey, setPrRetTrackingRefreshKey] = useState(0);
  const purchaseReturnTracking = useDocumentTracking(
    detailDrawerVisible && returnDetail?.id ? 'purchase_return' : undefined,
    returnDetail?.id,
    prRetTrackingRefreshKey,
  );

  const handleDetail = async (record: PurchaseReturn) => {
    try {
      const detail = await warehouseApi.purchaseReturn.get(record.id!.toString());
      setReturnDetail(detail as PurchaseReturnDetail);
      setDetailDrawerVisible(true);
      setPrRetTrackingRefreshKey((k) => k + 1);
      if (record.id != null) {
        await loadPurchaseReturnFieldValuesForDetail(record.id);
      }
    } catch {
      messageApi.error(t('app.kuaizhizao.purchaseReturn.detailFailed'));
    }
  };

  const handleConfirm = async (record: PurchaseReturn) => {
    Modal.confirm({
      title: t('app.kuaizhizao.purchaseReturn.confirmTitle'),
      content: t('app.kuaizhizao.purchaseReturn.confirmContent', { code: record.return_code }),
      onOk: async () => {
        try {
          await warehouseApi.purchaseReturn.confirm(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.purchaseReturn.confirmSuccess'));
          invalidatePurchaseReturnStatistics();
          if (returnDetail?.id === record.id) {
            const fresh = await warehouseApi.purchaseReturn.get(record.id!.toString());
            setReturnDetail(fresh as PurchaseReturnDetail);
            setPrRetTrackingRefreshKey((k) => k + 1);
          }
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.purchaseReturn.confirmFailed'));
        }
      },
    });
  };

  const handleCreate = () => {
    setEditingId(null);
    setEditingDetail(null);
    resetPurchaseReturnFormFieldValues();
    resetSelectedWarehouseId();
    setPendingFormValues({
      return_time: dayjs(),
      items: [],
    });
    setModalVisible(true);
  };
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.purchaseReturn.create')),
    [t],
  );

  const resetPullPoPreviewModal = useCallback(() => {
    setPullPoPreviewOpen(false);
    setPullPoPreviewData(null);
    setPullPoPreviewOrderId(null);
    setPullPoSelectedItemIds([]);
  }, []);

  const showPullPoPreview = useCallback(
    (orderId: number) => {
      setPullPoPreviewOpen(true);
      setPullPoPreviewLoading(true);
      setPullPoPreviewConfirming(false);
      setPullPoPreviewData(null);
      setPullPoPreviewOrderId(orderId);
      setPullPoSelectedItemIds([]);
      previewPushToPurchaseReturn(orderId)
        .then((res) => {
          setPullPoPreviewData(res);
          const ids = (res.items || [])
            .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
            .map((row) => Number(row.item_id));
          setPullPoSelectedItemIds(ids);
        })
        .catch((error: unknown) => {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseReturn.pull.previewFailed')));
          resetPullPoPreviewModal();
        })
        .finally(() => setPullPoPreviewLoading(false));
    },
    [messageApi, resetPullPoPreviewModal, t],
  );

  const handlePullPoPreviewConfirm = useCallback(async () => {
    if (!pullPoPreviewOrderId || !pullPoPreviewData) return;
    if (pullPoPreviewData.has_blocking_issues) return;
    if (!pullWarehouseId || pullWarehouseId <= 0) {
      messageApi.warning(t('app.kuaizhizao.purchaseReturn.selectWarehouse'));
      return;
    }
    const rowById = new Map(
      (pullPoPreviewData.items || []).map((row) => [Number(row.item_id), row]),
    );
    const selectedIds = pullPoSelectedItemIds.filter((id) => {
      const row = rowById.get(id);
      return row && Number(row.max_push_quantity ?? 0) > 0;
    });
    if (!selectedIds.length) {
      messageApi.warning(t('app.kuaizhizao.purchaseReturn.pull.selectLinesFirst'));
      return;
    }
    const returnQuantities = Object.fromEntries(
      selectedIds.map((id) => [id, Number(rowById.get(id)?.max_push_quantity ?? 0)]),
    );
    setPullPoPreviewConfirming(true);
    try {
      await pushPurchaseOrderToPurchaseReturn({
        purchase_order_id: pullPoPreviewOrderId,
        warehouse_id: pullWarehouseId,
        warehouse_name: pullWarehouseName || undefined,
        return_quantities: returnQuantities,
      });
      messageApi.success(
        t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
          source: pullFromPurchaseOrderAction.sourceLabel,
          target: pullFromPurchaseOrderAction.targetLabel,
        }),
      );
      invalidatePurchaseReturnStatistics();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      resetPullPoPreviewModal();
    } catch (error: unknown) {
      messageApi.error(
        getApiErrorMessage(
          error,
          t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
            source: pullFromPurchaseOrderAction.sourceLabel,
            target: pullFromPurchaseOrderAction.targetLabel,
          }),
        ),
      );
    } finally {
      setPullPoPreviewConfirming(false);
    }
  }, [
    invalidateMenuBadgeCounts,
    invalidatePurchaseReturnStatistics,
    messageApi,
    pullFromPurchaseOrderAction.sourceLabel,
    pullFromPurchaseOrderAction.targetLabel,
    pullPoPreviewData,
    pullPoPreviewOrderId,
    pullPoSelectedItemIds,
    pullWarehouseId,
    pullWarehouseName,
    resetPullPoPreviewModal,
    t,
  ]);

  const resetPullIiPreviewModal = useCallback(() => {
    setPullIiPreviewOpen(false);
    setPullIiPreviewData(null);
    setPullIiPreviewInspectionId(null);
  }, []);

  const showPullIiPreview = useCallback(
    (inspectionId: number) => {
      setPullIiPreviewOpen(true);
      setPullIiPreviewLoading(true);
      setPullIiPreviewConfirming(false);
      setPullIiPreviewData(null);
      setPullIiPreviewInspectionId(inspectionId);
      qualityApi.incomingInspection.previewPushToPurchaseReturn(String(inspectionId))
        .then((res) => setPullIiPreviewData(res as DocumentPushPreview))
        .catch((error: unknown) => {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseReturn.pull.previewFailed')));
          resetPullIiPreviewModal();
        })
        .finally(() => setPullIiPreviewLoading(false));
    },
    [messageApi, resetPullIiPreviewModal, t],
  );

  const handlePullIiPreviewConfirm = useCallback(async () => {
    if (!pullIiPreviewInspectionId || !pullIiPreviewData) return;
    if (pullIiPreviewData.has_blocking_issues) return;
    setPullIiPreviewConfirming(true);
    try {
      await qualityApi.incomingInspection.pushToPurchaseReturn(String(pullIiPreviewInspectionId));
      messageApi.success(
        t('app.kuaizhizao.shipmentNotice.createFromSourceSuccess', {
          source: pullFromIncomingInspectionAction.sourceLabel,
          target: pullFromIncomingInspectionAction.targetLabel,
        }),
      );
      invalidatePurchaseReturnStatistics();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      resetPullIiPreviewModal();
    } catch (error: unknown) {
      messageApi.error(
        getApiErrorMessage(
          error,
          t('app.kuaizhizao.shipmentNotice.createFromSourceFailed', {
            source: pullFromIncomingInspectionAction.sourceLabel,
            target: pullFromIncomingInspectionAction.targetLabel,
          }),
        ),
      );
    } finally {
      setPullIiPreviewConfirming(false);
    }
  }, [
    invalidateMenuBadgeCounts,
    invalidatePurchaseReturnStatistics,
    messageApi,
    pullFromIncomingInspectionAction.sourceLabel,
    pullFromIncomingInspectionAction.targetLabel,
    pullIiPreviewData,
    pullIiPreviewInspectionId,
    resetPullIiPreviewModal,
    t,
  ]);

  const pullFromPurchaseOrderQuery = useUniPullQuery<PullPurchaseOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const skip = (page - 1) * pageSize;
        const poRes = await listPurchaseOrders({
          skip,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        const rows = (poRes?.data || []).filter(
          (row): row is PullPurchaseOrderCandidate => row.id != null,
        );
        return { data: rows, total: poRes?.total ?? rows.length };
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrder.listFailed')));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => record.capabilities?.push_purchase_return?.allowed !== true,
    onConfirm: async (keys) => {
      const selectedId = Number(keys[0]);
      if (!selectedId) {
        messageApi.warning(
          t('app.kuaizhizao.shipmentNotice.selectSource', { source: pullFromPurchaseOrderAction.sourceLabel }),
        );
        return;
      }
      if (!pullWarehouseId || pullWarehouseId <= 0) {
        messageApi.warning(t('app.kuaizhizao.purchaseReturn.selectWarehouse'));
        return;
      }
      pullPoQueryCloseRef.current?.();
      showPullPoPreview(selectedId);
    },
  });

  pullPoQueryCloseRef.current = pullFromPurchaseOrderQuery.closeModal;

  const pullFromIncomingInspectionQuery = useUniPullQuery<PullIncomingInspectionCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const response = await qualityApi.incomingInspection.list({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        const list = Array.isArray(response)
          ? response
          : (response as { data?: unknown[]; items?: unknown[] })?.data
            ?? (response as { items?: unknown[] })?.items
            ?? [];
        const rows = (Array.isArray(list) ? list : []) as PullIncomingInspectionCandidate[];
        return {
          data: rows,
          total: Number((response as { total?: number })?.total ?? rows.length),
        };
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.quality.common.messages.loadListFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => record.capabilities?.push_purchase_return?.allowed !== true,
    onConfirm: async (keys) => {
      const selectedId = Number(keys[0]);
      if (!selectedId) {
        messageApi.warning(
          t('app.kuaizhizao.shipmentNotice.selectSource', {
            source: pullFromIncomingInspectionAction.sourceLabel,
          }),
        );
        return;
      }
      pullIiQueryCloseRef.current?.();
      showPullIiPreview(selectedId);
    },
  });

  pullIiQueryCloseRef.current = pullFromIncomingInspectionQuery.closeModal;

  const handleEdit = async (record: PurchaseReturn) => {
    if (record.capabilities?.update?.allowed !== true) {
      messageApi.warning(t('app.kuaizhizao.purchaseReturn.editOnlyPending'));
      return;
    }
    try {
      const detail = (await warehouseApi.purchaseReturn.get(record.id!.toString())) as PurchaseReturnDetail;
      setEditingId(record.id!);
      setEditingDetail(detail);
      updateSelectedWarehouseId(detail.warehouse_id ?? null);
      setPendingFormValues({
        supplier_id: detail.supplier_id,
        supplier_name: detail.supplier_name,
        warehouse_id: detail.warehouse_id,
        warehouse_name: detail.warehouse_name,
        return_time: detail.return_time ? dayjs(detail.return_time) : dayjs(),
        return_reason: detail.return_reason,
        return_type: detail.return_type,
        shipping_method: detail.shipping_method,
        notes: detail.notes,
        attachments: mapAttachmentsToUploadList(detail.attachments),
        items: (detail.items || []).map((it) => ({
          material_id: (it as any).material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          return_quantity: it.return_quantity,
          unit_price: it.unit_price,
          batch_number: it.batch_number,
          location_code: it.location_code,
          notes: it.notes,
          purchase_receipt_item_id: (it as any).purchase_receipt_item_id,
          material_spec: (it as any).material_spec,
          material_unit: (it as any).material_unit ?? defaultUnit,
        })),
      });
      if (record.id != null) {
        window.setTimeout(() => {
          loadPurchaseReturnFormFieldValues(record.id!).then((fieldFormValues) => {
            formRef.current?.setFieldsValue(fieldFormValues);
          });
        }, 100);
      }
      setModalVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.purchaseReturn.loadDetailFailed'));
    }
  };

  const handleWithdraw = async (record: PurchaseReturn) => {
    Modal.confirm({
      title: t('app.kuaizhizao.purchaseReturn.withdrawTitle'),
      content: t('app.kuaizhizao.purchaseReturn.withdrawContent', { code: record.return_code }),
      onOk: async () => {
        try {
          await warehouseApi.purchaseReturn.withdraw(record.id!.toString());
          messageApi.success(t('app.kuaizhizao.purchaseReturn.withdrawSuccess'));
          invalidatePurchaseReturnStatistics();
          invalidateMenuBadgeCounts();
          if (returnDetail?.id === record.id) {
            const fresh = await warehouseApi.purchaseReturn.get(record.id!.toString());
            setReturnDetail(fresh as PurchaseReturnDetail);
            setPrRetTrackingRefreshKey((k) => k + 1);
          }
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.purchaseReturn.withdrawFailed'));
        }
      },
    });
  };

  const buildPurchaseReturnItemsPayload = (items: any[]) =>
    (items || []).map((it) => {
      const qty = Number(it.return_quantity ?? 0);
      const price = Number(it.unit_price ?? 0);
      const total = Number((it.total_amount != null ? it.total_amount : qty * price).toFixed(2));
      return {
        purchase_receipt_item_id: it.purchase_receipt_item_id ?? undefined,
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_spec: it.material_spec ?? undefined,
        material_unit: it.material_unit || defaultUnit,
        return_quantity: qty,
        unit_price: price,
        total_amount: total,
        batch_number: it.batch_number ?? undefined,
        location_code: it.location_code ?? undefined,
        notes: it.notes ?? undefined,
      };
    });

  const onFinish = async (values: any) => {
    try {
      const { customData, standardValues } = extractPurchaseReturnFormValues(values);
      const itemsPayload = buildPurchaseReturnItemsPayload(standardValues.items);
      const returnTime =
        standardValues.return_time && typeof standardValues.return_time.format === 'function'
          ? standardValues.return_time.format('YYYY-MM-DD')
          : standardValues.return_time;
      let recordId: number | undefined;
      if (editingId) {
        const detail = editingDetail;
        if (!detail || detail.capabilities?.update?.allowed !== true) {
          messageApi.warning(t('app.kuaizhizao.purchaseReturn.editNotAllowed'));
          return;
        }
        await warehouseApi.purchaseReturn.update(editingId.toString(), {
          supplier_id: standardValues.supplier_id,
          supplier_name: standardValues.supplier_name ?? detail.supplier_name,
          warehouse_id: standardValues.warehouse_id,
          warehouse_name: standardValues.warehouse_name ?? detail.warehouse_name,
          return_time: returnTime,
          return_reason: standardValues.return_reason ?? null,
          return_type: standardValues.return_type ?? detail.return_type ?? '质量问题',
          shipping_method: standardValues.shipping_method ?? null,
          tracking_number: detail.tracking_number ?? null,
          shipping_address: detail.shipping_address ?? null,
          notes: standardValues.notes ?? null,
          attachments: normalizeDocumentAttachments(standardValues.attachments),
          purchase_receipt_id: detail.purchase_receipt_id ?? null,
          purchase_receipt_code: detail.purchase_receipt_code ?? null,
          purchase_order_id: detail.purchase_order_id ?? null,
          purchase_order_code: detail.purchase_order_code ?? null,
          status: detail.status,
          items: itemsPayload,
        });
        recordId = editingId;
        messageApi.success(t('app.kuaizhizao.purchaseReturn.updateSuccess'));
      } else {
        const created = await warehouseApi.purchaseReturn.create({
          ...standardValues,
          return_time: returnTime,
          attachments: normalizeDocumentAttachments(standardValues.attachments),
          items: itemsPayload,
        });
        recordId = (created as any)?.id;
        messageApi.success(t('app.kuaizhizao.purchaseReturn.createSuccess'));
      }
      if (recordId != null) {
        await savePurchaseReturnCustomFieldValues(recordId, customData);
      }
      setModalVisible(false);
      resetPurchaseReturnFormFieldValues();
      setEditingId(null);
      setEditingDetail(null);
      setPendingFormValues(null);
      resetSelectedWarehouseId();
      invalidatePurchaseReturnStatistics();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.purchaseReturn.operationFailed'));
    }
  };

  const appendItemsFromMaterials = (materials: Material[]) => {
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const newItems = materials.map((m) => ({
      material_id: m.id,
      material_code: m.mainCode,
      material_name: m.name,
      material_spec: m.specification,
      material_unit: m.baseUnit,
      return_quantity: 1,
      unit_price: m.defaults?.defaultPurchasePrice ?? 0,
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    setMaterialPickerOpen(false);
  };

  const handleImport = (data: any[]) => {
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const materialCodeKeys = [
      t('app.kuaizhizao.purchaseReturn.import.materialCode'),
      t('app.kuaizhizao.purchaseOrder.import.materialCode'),
      '物料编号',
    ];
    const returnQuantityKeys = [
      t('app.kuaizhizao.purchaseReturn.import.returnQuantity'),
      '退货数量',
    ];
    const unitPriceKeys = [
      t('app.kuaizhizao.purchaseReturn.import.unitPrice'),
      t('app.kuaizhizao.purchaseOrder.import.unitPrice'),
      '单价',
    ];
    const batchNumberKeys = [
      t('app.kuaizhizao.purchaseReturn.import.batchNumber'),
      '批次号',
    ];
    const locationKeys = [
      t('app.kuaizhizao.purchaseReturn.import.location'),
      '库位',
    ];
    const notesKeys = [
      t('app.kuaizhizao.purchaseReturn.import.notes'),
      '备注',
    ];
    const newItems = data.map((row) => ({
      material_code: getImportRowValue(row, materialCodeKeys),
      return_quantity: Number(getImportRowValue(row, returnQuantityKeys) || 1),
      unit_price: Number(getImportRowValue(row, unitPriceKeys) || 0),
      batch_number: getImportRowValue(row, batchNumberKeys),
      location_code: getImportRowValue(row, locationKeys),
      notes: getImportRowValue(row, notesKeys),
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    setImportModalVisible(false);
  };

  const detailColumns: ProDescriptionsItemProps<PurchaseReturnDetail>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseReturn.colReturnCode'),
        dataIndex: 'return_code',
        render: (_, entity) => (
          <Typography.Text copyable={{ text: String(entity.return_code ?? '') }}>{entity.return_code ?? '-'}</Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.colPurchaseReceiptCode'),
        dataIndex: 'purchase_receipt_code',
        render: (_, entity) => {
          const code = String(entity.purchase_receipt_code ?? '').trim();
          if (!code) return '-';
          return <Typography.Text copyable={{ text: code }}>{code}</Typography.Text>;
        },
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.colPurchaseOrderCode'),
        dataIndex: 'purchase_order_code',
        render: (_, entity) => {
          const code = String(entity.purchase_order_code ?? '').trim();
          if (!code) return '-';
          return <Typography.Text copyable={{ text: code }}>{code}</Typography.Text>;
        },
      },
      { title: t('app.kuaizhizao.purchaseReturn.supplier'), dataIndex: 'supplier_name' },
      { title: t('app.kuaizhizao.purchaseReturn.colWarehouse'), dataIndex: 'warehouse_name' },
      {
        title: t('app.kuaizhizao.purchaseReturn.returnStatus'),
        dataIndex: 'status',
        render: (status) => {
          const config = returnStatusMap[(status as string) || ''] || { text: getReturnStatusLabel(status as string), color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.reviewStatus'),
        dataIndex: 'review_status',
        render: (status) => {
          const config = reviewStatusMap[(status as string) || ''] || { text: getReviewStatusLabel(status as string), color: 'default' };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      { title: t('app.kuaizhizao.purchaseReturn.returnReason'), dataIndex: 'return_reason' },
      { title: t('app.kuaizhizao.purchaseReturn.returnType'), dataIndex: 'return_type' },
      { title: t('app.kuaizhizao.purchaseReturn.totalQuantity'), dataIndex: 'total_quantity', render: formatQuantity },
      {
        title: t('app.kuaizhizao.purchaseReturn.totalAmount'),
        dataIndex: 'total_amount',
        render: (text: any) => (text != null && text !== '' ? `¥${formatNumber(text, 2)}` : '-'),
      },
      { title: t('app.kuaizhizao.purchaseReturn.returnTime'), dataIndex: 'return_time', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.purchaseReturn.returner'), dataIndex: 'returner_name' },
      { title: t('app.kuaizhizao.purchaseReturn.reviewer'), dataIndex: 'reviewer_name' },
      { title: t('app.kuaizhizao.purchaseReturn.reviewTime'), dataIndex: 'review_time', valueType: 'dateTime' },
    ],
    [getReturnStatusLabel, getReviewStatusLabel, returnStatusMap, reviewStatusMap, t, i18n.language],
  );

  const detailNotesColumn: ProDescriptionsItemProps<PurchaseReturnDetail> = useMemo(
    () => ({
      title: t('app.kuaizhizao.common.fieldNotes'),
      dataIndex: 'notes',
      span: 3,
      render: (text: any) => text || '-',
    }),
    [t, i18n.language],
  );

  const purchaseReturnCustomFieldColumns = generatePurchaseReturnCustomFieldColumns();

  const statCards: StatCard[] = useMemo(() => {
    const s = prStats;
    const z = [0, 0, 0, 0, 0, 0, 0];
    return [
      {
        title: t('app.kuaizhizao.purchaseReturn.statTotal'),
        value: s?.total_count ?? 0,
        valueStyle: { color: token.colorPrimary },
        backgroundChart: <SimpleSparkline data={s?.trend_total?.length ? s.trend_total : z} color={token.colorPrimary} />,
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.statusPending'),
        value: s?.pending_count ?? 0,
        valueStyle: { color: token.colorWarning },
        backgroundChart: <SimpleSparkline data={s?.trend_pending?.length ? s.trend_pending : z} color={token.colorWarning} />,
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.statusReturned'),
        value: s?.done_count ?? 0,
        valueStyle: { color: token.colorSuccess },
        backgroundChart: <SimpleSparkline data={s?.trend_done?.length ? s.trend_done : z} color={token.colorSuccess} />,
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.statusCancelled'),
        value: s?.cancelled_count ?? 0,
        valueStyle: { color: token.colorError },
        backgroundChart: <SimpleSparkline data={s?.trend_cancelled?.length ? s.trend_cancelled : z} color={token.colorError} />,
      },
    ];
  }, [prStats, t, token, i18n.language]);

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) return;
    try {
      for (const id of keys) {
        await warehouseApi.purchaseReturn.delete(String(id));
      }
      messageApi.success(t('app.kuaizhizao.purchaseReturn.batchDeleteSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      invalidatePurchaseReturnStatistics();
      if (returnDetail?.id != null && keys.includes(returnDetail.id)) {
        setReturnDetail(null);
        setDetailDrawerVisible(false);
      }
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.purchaseReturn.deleteFailed'));
    }
  };

  const columns: ProColumns<PurchaseReturn>[] = useMemo(
    () => alignProColumns<PurchaseReturn>([
      {
        title: t('app.kuaizhizao.purchaseReturn.returnTime'),
        dataIndex: 'return_time_range',
        valueType: 'dateRange',
        hideInTable: true,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.colSupplierReturnCode'),
        key: 'return_code',
        dataIndex: 'return_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        sorter: true,
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.supplier_name ?? '')}
            secondary={String(r.return_code ?? '')}
          />
        ),
      },
      { title: t('app.kuaizhizao.purchaseReturn.colReturnCode'), dataIndex: 'return_code', hideInTable: true, hideInSearch: false },
      {
        title: t('app.kuaizhizao.purchaseReturn.supplier'),
        dataIndex: 'supplier_id',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          showSearch: true,
          optionFilterProp: 'label',
          options: purchaseReturnSupplierSearchOptions,
          placeholder: t('app.kuaizhizao.purchaseReturn.supplier'),
        },
      },
      { title: t('app.kuaizhizao.purchaseReturn.supplier'), dataIndex: 'supplier_name', hideInTable: true, hideInSearch: true },
      {
        title: t('app.kuaizhizao.purchaseReturn.colPurchaseReceiptCode'),
        dataIndex: 'purchase_receipt_code',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: false,
        ellipsis: true,
        render: (_, r) => {
          const code = String(r.purchase_receipt_code ?? '').trim();
          if (!code) return '-';
          return (
            <Typography.Text copyable={{ text: code }} ellipsis>
              {code}
            </Typography.Text>
          );
        },
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.colPurchaseOrderCode'),
        dataIndex: 'purchase_order_code',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: false,
        ellipsis: true,
        render: (_, r) => {
          const code = String(r.purchase_order_code ?? '').trim();
          if (!code) return '-';
          return (
            <Typography.Text copyable={{ text: code }} ellipsis>
              {code}
            </Typography.Text>
          );
        },
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.colWarehouse'),
        dataIndex: 'warehouse_name',
        width: 140,
        ellipsis: true,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.totalQuantity'),
        dataIndex: 'total_quantity',
        width: 100,
        align: 'right',
        sorter: true,
        hideInSearch: true,
        render: formatQuantity,
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.totalAmount'),
        dataIndex: 'total_amount',
        width: 120,
        align: 'right',
        sorter: true,
        hideInSearch: true,
        render: (text: any) => (text != null && text !== '' ? `¥${formatNumber(text, 2)}` : '-'),
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.returnTime'),
        dataIndex: 'return_time',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.return_time ? formatDateTime(r.return_time, 'YYYY-MM-DD HH:mm') : '-'),
      },
      ...buildDocumentAuditColumns<PurchaseReturn>(t),
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.reviewStatus'),
        dataIndex: 'review_status',
        width: 96,
        fixed: 'right',
        align: 'center',
        hideInSearch: true,
        render: (status: any) => {
          const config = reviewStatusMap[status as keyof typeof reviewStatusMap] || reviewStatusMap['待审核'];
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.colLifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        fixed: 'right',
        align: 'left',
        valueType: 'select',
        valueEnum: purchaseReturnLifecycleValueEnum,
        render: (_, record) => (
          <ListUniLifecycleCell lifecycle={getPurchaseReturnLifecycle(record, t)} />
        ),
      },
      ...purchaseReturnCustomFieldColumns,
      {
        title: t('common.actions'),
        width: 220,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => {
          const parts: React.ReactNode[] = [
            <Button {...rowActionKind('read')}
              key="d"
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDetail(record);
              }}
            >
              {t('common.detail')}
            </Button>,
          ];
          if (record.capabilities?.update?.allowed === true && purchaseReturnPerms.canUpdate) {
            parts.push(
              <Button {...rowActionKind('update')}
                key="e"
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
          }
          if (record.capabilities?.confirm?.allowed === true && (purchaseReturnPerms.canAction?.('submit') ?? false)) {
            parts.push(
              <Button {...rowActionKind('read')}
                key="c"
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ color: '#52c41a' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleConfirm(record);
                }}
              >
                {t('app.kuaizhizao.purchaseReturn.confirmReturn')}
              </Button>
            );
          }
          if (record.capabilities?.withdraw?.allowed === true && (purchaseReturnPerms.canAction?.('revoke') ?? false)) {
            parts.push(
              <Button {...rowActionKind('skip')}
                key="w"
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleWithdraw(record);
                }}
              >
                {t('app.kuaizhizao.purchaseReturn.withdrawConfirm')}
              </Button>
            );
          }
          return renderPurchaseReturnRowActions(parts, `purchase-return-actions-${record.id ?? 'row'}`);
        },
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [
      handleConfirm,
      handleDetail,
      handleEdit,
      handleWithdraw,
      purchaseReturnCustomFieldColumns,
      purchaseReturnLifecycleValueEnum,
      purchaseReturnSupplierSearchOptions,
      reviewStatusMap,
      t,
      i18n.language,
    ],
  );

  const formItemColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.shipmentNotice.import.materialName'),
        dataIndex: 'material_id',
        width: DOCUMENT_DETAIL_COL_WIDTH.material,
        ...DOCUMENT_DETAIL_TEXT_COL,
        render: (_: unknown, __: unknown, index: number) => (
          <UniMaterialSelect
            name={[index, 'material_id']}
            label=""
            placeholder={t('common.selectMaterial')}
            required
            size={DOCUMENT_DETAIL_CONTROL_SIZE}
            listFieldKey={index}
            listFieldName="items"
            fillMapping={{
              material_code: 'mainCode',
              material_name: 'name',
              material_spec: 'specification',
              material_unit: 'baseUnit',
            }}
            showAdvancedSearch
          skipFuzzyPinyinClientFilter
          />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.batchNumber'),
        dataIndex: 'batch_number',
        width: 150,
        ...DOCUMENT_DETAIL_TEXT_COL,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'batch_number']} noStyle>
            <Input size={DOCUMENT_DETAIL_CONTROL_SIZE} placeholder={t('app.kuaizhizao.purchaseReturn.batchNumberPlaceholder')} />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.location'),
        dataIndex: 'location_code',
        width: 180,
        ...DOCUMENT_DETAIL_TEXT_COL,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'location_code']} noStyle>
            <Select
              options={locationOptions}
              placeholder={selectedWarehouseId ? t('app.kuaizhizao.purchaseReturn.selectLocation') : t('app.kuaizhizao.purchaseReturn.selectWarehouseFirst')}
              style={{ width: '100%' }}
              size={DOCUMENT_DETAIL_CONTROL_SIZE}
              showSearch
              optionFilterProp="label"
              allowClear
              disabled={!selectedWarehouseId}
            />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.returnQuantity'),
        dataIndex: 'return_quantity',
        width: DOCUMENT_DETAIL_COL_WIDTH.quantity,
        ...DOCUMENT_DETAIL_NUM_COL,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'return_quantity']} noStyle>
            <InputNumber size={DOCUMENT_DETAIL_CONTROL_SIZE} style={{ width: '100%' }} min={1} />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.unitPrice'),
        dataIndex: 'unit_price',
        width: DOCUMENT_DETAIL_COL_WIDTH.unitPrice,
        ...DOCUMENT_DETAIL_NUM_COL,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'unit_price']} noStyle>
            <InputNumber size={DOCUMENT_DETAIL_CONTROL_SIZE} style={{ width: '100%' }} min={0} prefix="¥" />
          </AntForm.Item>
        ),
      },
    ],
    [locationOptions, selectedWarehouseId, t, i18n.language],
  );

  const detailItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseReturn.import.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
      { title: t('app.kuaizhizao.shipmentNotice.import.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
      { title: t('app.kuaizhizao.purchaseReturn.returnQuantity'), dataIndex: 'return_quantity', width: 100, align: 'right' as const , render: formatQuantity },
      {
        title: t('app.kuaizhizao.purchaseReturn.unitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        align: 'right' as const,
        render: (text: number) => `¥${text || 0}`,
      },
      {
        title: t('app.kuaizhizao.purchaseReturn.amount'),
        dataIndex: 'total_amount',
        width: 100,
        align: 'right' as const,
        render: (text: number) => `¥${text || 0}`,
      },
      { title: t('app.kuaizhizao.purchaseReturn.import.batchNumber'), dataIndex: 'batch_number', width: 120 },
      { title: t('app.kuaizhizao.purchaseReturn.location'), dataIndex: 'location_code', width: 100 },
    ],
    [t, i18n.language],
  );

  const pullPurchaseOrderColumns = useMemo<ProColumns<PullPurchaseOrderCandidate>[]>(
    () => [
      { title: t('app.kuaizhizao.purchaseOrder.col.orderCode'), dataIndex: 'order_code', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.receiptNotice.supplier'), dataIndex: 'supplier_name', width: 180, ellipsis: true },
      { title: t('common.status'), dataIndex: 'status', width: 120, align: 'center' },
      { title: t('app.kuaizhizao.purchaseOrder.col.orderDate'), dataIndex: 'order_date', width: 130, render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
      { title: t('app.kuaizhizao.purchaseOrder.col.deliveryDate'), dataIndex: 'delivery_date', width: 130, render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', width: 180, render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-') },
    ],
    [t, i18n.language],
  );

  const pullIncomingInspectionColumns = useMemo<ProColumns<PullIncomingInspectionCandidate>[]>(
    () => [
      { title: t('app.kuaizhizao.quality.common.columns.inspectionCode'), dataIndex: 'inspection_code', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.purchaseReturn.colPurchaseReceiptCode'), dataIndex: 'purchase_receipt_code', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.receiptNotice.supplier'), dataIndex: 'supplier_name', width: 180, ellipsis: true },
      { title: t('app.kuaizhizao.purchaseOrder.col.materialName'), dataIndex: 'material_name', ellipsis: true },
      { title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'), dataIndex: 'unqualified_quantity', width: 120, align: 'right', render: (v) => formatQuantity(v) },
      { title: t('app.kuaizhizao.quality.common.columns.qualityStatus'), dataIndex: 'quality_status', width: 120, align: 'center', render: (v) => v || '-' },
      { title: t('app.kuaizhizao.quality.common.columns.inspectionStatus'), dataIndex: 'status', width: 120, align: 'center', render: (v) => v || '-' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', width: 180, render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-') },
    ],
    [t],
  );

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PurchaseReturn>
          headerTitle={t('app.kuaizhizao.purchaseReturn.title')}
          columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-returns"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
          pinnedTabsValueEnum={purchaseReturnLifecycleValueEnum}
          showCreateButton={false}
          createButtonText={createButtonLabel}
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              key="purchase-return-pull-create"
              compactKey="purchase-return-pull-create"
              createIcon={<PlusOutlined />}
              createLabel={createButtonLabel}
              onCreate={handleCreate}
              menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                {
                  key: 'pull-from-purchase-order',
                  actionKey: 'purchase_return.pull_from_purchase_order',
                  onClick: pullFromPurchaseOrderQuery.openModal,
                },
                {
                  key: 'pull-from-incoming-inspection',
                  actionKey: 'purchase_return.pull_from_incoming_inspection',
                  onClick: pullFromIncomingInspectionQuery.openModal,
                },
              ])}
            />,
          ]}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const sf = searchFormValues ?? {};
              const lifecycleParams = resolvePurchaseReturnListLifecycleParams(sf, params);
              const { sortBy, sortOrder } = extractProTableSort(sort);
              const orderBy =
                sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
              const fuzzyKeyword = typeof sf.keyword === 'string' ? sf.keyword.trim() : '';
              const apiParams: PurchaseReturnListParams = {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...lifecycleParams,
                order_by: orderBy,
              };
              if (fuzzyKeyword) {
                apiParams.keyword = fuzzyKeyword;
              } else if (sf.return_code != null && String(sf.return_code).trim()) {
                apiParams.return_code = String(sf.return_code).trim();
              }
              if (sf.supplier_id != null && sf.supplier_id !== '') {
                apiParams.supplier_id = Number(sf.supplier_id);
              }
              const receiptCode =
                sf.purchase_receipt_code != null ? String(sf.purchase_receipt_code).trim() : '';
              if (receiptCode) apiParams.purchase_receipt_code = receiptCode;
              const orderCode =
                sf.purchase_order_code != null ? String(sf.purchase_order_code).trim() : '';
              if (orderCode) apiParams.purchase_order_code = orderCode;
              const returnRange = sf.return_time_range as [unknown, unknown] | undefined;
              if (returnRange && Array.isArray(returnRange) && returnRange[0]) {
                apiParams.return_start_date = formatDateTime(returnRange[0] as string | Date, 'YYYY-MM-DD');
                apiParams.return_end_date = returnRange[1]
                  ? formatDateTime(returnRange[1] as string | Date, 'YYYY-MM-DD')
                  : apiParams.return_start_date;
              }
              const createdRange = sf.created_at_range as [unknown, unknown] | undefined;
              if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
                apiParams.created_start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
                apiParams.created_end_date = createdRange[1]
                  ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
                  : apiParams.created_start_date;
              }
              const response = await warehouseApi.purchaseReturn.list(apiParams);
              const list = response?.data ?? [];
              const enriched = await enrichPurchaseReturnRecordsWithCustomFields(list);
              return {
                data: enriched,
                success: true,
                total: response?.total ?? enriched.length,
              };
            } catch {
              messageApi.error(t('app.kuaizhizao.purchaseReturn.listFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={true}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.purchaseReturn.confirmBatchDelete', { count })}
          toolBarActionsAfterBatch={[
            <UniCapabilityBatchButton
              key="purchase-return-confirm"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedReturnsForBatch}
              capabilityKey="confirm"
              permAllowed={purchaseReturnPerms.canAction?.('submit') ?? false}
              batchAllowed={purchaseReturnBatchConfirmAllowed}
              onRun={(id) => warehouseApi.purchaseReturn.confirm(String(id))}
              notAllowedMessage={t('app.kuaizhizao.purchaseReturn.batchConfirmPartial', { count: 1 })}
              onSuccess={() => {
                setSelectedRowKeys([]);
                invalidatePurchaseReturnStatistics();
                invalidateMenuBadgeCounts();
                actionRef.current?.reload();
              }}
              requireConfirm
              labels={{
                single: t('app.kuaizhizao.purchaseReturn.confirmReturn'),
                batch: t('app.kuaizhizao.purchaseReturn.batchConfirm'),
                singleConfirmTitle: t('app.kuaizhizao.purchaseReturn.confirmTitle'),
              }}
              icon={<CheckCircleOutlined />}
              size="middle"
              color="green"
              variant="solid"
            />,
            <UniCapabilityBatchButton
              key="purchase-return-withdraw"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedReturnsForBatch}
              capabilityKey="withdraw"
              permAllowed={purchaseReturnPerms.canAction?.('revoke') ?? false}
              batchAllowed={purchaseReturnBatchWithdrawAllowed}
              onRun={(id) => warehouseApi.purchaseReturn.withdraw(String(id))}
              notAllowedMessage={t('app.kuaizhizao.purchaseReturn.batchWithdrawPartial', { count: 1 })}
              onSuccess={() => {
                setSelectedRowKeys([]);
                invalidatePurchaseReturnStatistics();
                invalidateMenuBadgeCounts();
                actionRef.current?.reload();
              }}
              requireConfirm
              labels={{
                single: t('app.kuaizhizao.purchaseReturn.withdrawConfirm'),
                batch: t('app.kuaizhizao.purchaseReturn.batchWithdraw'),
              }}
              icon={<EditOutlined />}
              size="middle"
              color="orange"
              variant="solid"
            />,
          ]}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          scroll={{ x: 1500 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editingId ? t('app.kuaizhizao.purchaseReturn.editTitle') : t('app.kuaizhizao.purchaseReturn.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingId(null);
          setEditingDetail(null);
          setPendingFormValues(null);
          resetPurchaseReturnFormFieldValues();
          resetSelectedWarehouseId();
        }}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingFormValues) {
              formRef.current?.setFieldsValue(pendingFormValues);
            }
            return;
          }
          formRef.current?.resetFields?.();
          setPendingFormValues(null);
          resetSelectedWarehouseId();
        }}
        onFinish={onFinish}
        formRef={formRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <Row gutter={16}>
          <Col span={8}>
            <ProFormSelect
              name="supplier_id"
              label={t('app.kuaizhizao.purchaseReturn.supplier')}
              placeholder={t('app.kuaizhizao.purchaseReturn.selectSupplier')}
              required
              request={async () => {
                const res = await supplierApi.list({ limit: 1000, isActive: true });
                const list = Array.isArray(res) ? res : (res as any)?.data || (res as any)?.items || [];
                return list.map((s: any) => ({
                  label: s.name || s.supplier_name || s.code || t('app.kuaizhizao.purchaseReturn.supplierFallback', { id: s.id }),
                  value: s.id ?? s.supplier_id,
                }));
              }}
              fieldProps={{
                showSearch: true,
                optionFilterProp: 'label',
                onChange: (_, option) => {
                  formRef.current?.setFieldsValue({ supplier_name: (option as any)?.label ?? '' });
                },
              }}
              rules={[{ required: true, message: t('app.kuaizhizao.purchaseReturn.selectSupplier') }]}
            />
            <ProFormText name="supplier_name" hidden />
          </Col>
          <Col span={8}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.purchaseReturn.returnWarehouse')}
              placeholder={t('app.kuaizhizao.purchaseReturn.selectWarehouse')}
              required
              onChange={(value, wh) => {
                formRef.current?.setFieldsValue({ warehouse_name: (wh as any)?.name ?? '' });
                updateSelectedWarehouseId(value);
              }}
              rules={[{ required: true, message: t('app.kuaizhizao.purchaseReturn.selectWarehouse') }]}
            />
            <ProFormText name="warehouse_name" hidden />
          </Col>
          <Col span={8}>
            <ProFormDatePicker
              name="return_time"
              label={t('app.kuaizhizao.purchaseReturn.returnDate')}
              required
              fieldProps={{ style: { width: '100%' } }}
              initialValue={dayjs()}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <ProFormSelect
              name="return_reason"
              label={t('app.kuaizhizao.purchaseReturn.returnReason')}
              placeholder={t('app.kuaizhizao.purchaseReturn.selectReturnReason')}
              options={returnReasonOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="return_type"
              label={t('app.kuaizhizao.purchaseReturn.returnType')}
              placeholder={t('app.kuaizhizao.purchaseReturn.selectReturnType')}
              options={returnTypeOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="shipping_method"
              label={t('app.kuaizhizao.purchaseReturn.shippingMethod')}
              placeholder={t('app.kuaizhizao.purchaseReturn.selectShippingMethod')}
              options={shippingMethodOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <CustomFieldsFormSection
            customFields={purchaseReturnFormCustomFields}
            customFieldValues={purchaseReturnFormCustomFieldValues}
            gridColumns={3}
            embedInParentRow
          />
        </Row>

        <DocumentDetailTableStyles />
        <UniTableDetail
          name="items"
          title={t('app.kuaizhizao.purchaseReturn.itemsTitle')}
          required
          requiredMessage={t('app.kuaizhizao.purchaseReturn.itemsRequired')}
          headerExtra={(
            <Space size={8}>
              <Button
                type="default"
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                {t('common.importDetail')}
              </Button>
              <Button
                type="default"
                icon={<PlusOutlined />}
                onClick={() => {
                  const items = [...(formRef.current?.getFieldValue('items') ?? [])];
                  items.push({ return_quantity: 1, unit_price: 0 });
                  formRef.current?.setFieldsValue({ items });
                }}
              >
                {t('common.addDetail')}
              </Button>
              <Button
                type="default"
                icon={<AppstoreAddOutlined />}
                onClick={() => setMaterialPickerOpen(true)}
              >
                {t('app.kuaizhizao.common.materialBatchSelect')}
              </Button>
            </Space>
          )}
          columns={formItemColumns}
          disabledAdd
          initialValue={{ return_quantity: 1, unit_price: 0 }}
          tableProps={DOCUMENT_DETAIL_TABLE_PROPS}
        />

        <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.purchaseReturn.notesPlaceholder')} fieldProps={{ rows: 3 }} />
        <DocumentAttachmentsField category="purchase_return_attachments" />
      </FormModalTemplate>

      <UniPullQueryModal<PullPurchaseOrderCandidate>
        open={pullFromPurchaseOrderQuery.open}
        title={pullFromPurchaseOrderAction.label}
        onCancel={pullFromPurchaseOrderQuery.closeModal}
        onOk={pullFromPurchaseOrderQuery.handleConfirm}
        rowKey="id"
        columns={pullPurchaseOrderColumns}
        dataSource={pullFromPurchaseOrderQuery.dataSource}
        loading={pullFromPurchaseOrderQuery.loading}
        confirmLoading={pullFromPurchaseOrderQuery.confirmLoading}
        selectionType={pullFromPurchaseOrderQuery.selectionType}
        selectedRowKeys={pullFromPurchaseOrderQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromPurchaseOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromPurchaseOrderQuery.isRowDisabled}
        searchDraft={pullFromPurchaseOrderQuery.searchDraft}
        onSearchDraftChange={pullFromPurchaseOrderQuery.setSearchDraft}
        onSearchApply={pullFromPurchaseOrderQuery.handleSearchApply}
        onSearchClear={pullFromPurchaseOrderQuery.handleSearchClear}
        appliedKeyword={pullFromPurchaseOrderQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.purchaseOrder.pull.searchPlaceholder')}
        page={pullFromPurchaseOrderQuery.page}
        pageSize={pullFromPurchaseOrderQuery.pageSize}
        total={pullFromPurchaseOrderQuery.total}
        onPageChange={pullFromPurchaseOrderQuery.handlePageChange}
        okText={t('common.next')}
        filterExtra={(
          <UniWarehouseSelect
            label={t('app.kuaizhizao.purchaseReturn.returnWarehouse')}
            placeholder={t('app.kuaizhizao.purchaseReturn.selectWarehouse')}
            value={pullWarehouseId}
            onChange={(value, warehouse) => {
              const nextId = Number(value);
              setPullWarehouseId(Number.isFinite(nextId) && nextId > 0 ? nextId : undefined);
              setPullWarehouseName((warehouse as any)?.name ?? '');
            }}
          />
        )}
        okButtonProps={{ disabled: !pullWarehouseId || pullWarehouseId <= 0 }}
      />

      <UniPullQueryModal<PullIncomingInspectionCandidate>
        open={pullFromIncomingInspectionQuery.open}
        title={pullFromIncomingInspectionAction.label}
        onCancel={pullFromIncomingInspectionQuery.closeModal}
        onOk={pullFromIncomingInspectionQuery.handleConfirm}
        rowKey="id"
        columns={pullIncomingInspectionColumns}
        dataSource={pullFromIncomingInspectionQuery.dataSource}
        loading={pullFromIncomingInspectionQuery.loading}
        confirmLoading={pullFromIncomingInspectionQuery.confirmLoading}
        selectionType={pullFromIncomingInspectionQuery.selectionType}
        selectedRowKeys={pullFromIncomingInspectionQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromIncomingInspectionQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromIncomingInspectionQuery.isRowDisabled}
        searchDraft={pullFromIncomingInspectionQuery.searchDraft}
        onSearchDraftChange={pullFromIncomingInspectionQuery.setSearchDraft}
        onSearchApply={pullFromIncomingInspectionQuery.handleSearchApply}
        onSearchClear={pullFromIncomingInspectionQuery.handleSearchClear}
        appliedKeyword={pullFromIncomingInspectionQuery.appliedKeyword}
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        page={pullFromIncomingInspectionQuery.page}
        pageSize={pullFromIncomingInspectionQuery.pageSize}
        total={pullFromIncomingInspectionQuery.total}
        onPageChange={pullFromIncomingInspectionQuery.handlePageChange}
        okText={t('common.next')}
      />

      <Modal
        title={pullFromPurchaseOrderAction.label}
        open={pullPoPreviewOpen}
        destroyOnClose
        width={1100}
        onCancel={resetPullPoPreviewModal}
        okText={pullFromPurchaseOrderAction.label}
        cancelText={t('common.cancel')}
        confirmLoading={pullPoPreviewConfirming}
        onOk={() => void handlePullPoPreviewConfirm()}
        okButtonProps={{
          disabled:
            pullPoPreviewLoading ||
            !pullPoPreviewData ||
            !!pullPoPreviewData?.has_blocking_issues,
        }}
      >
        {pullPoPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pullPoPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPoPreviewData.summary}</p>
            {pullPoPreviewData.has_blocking_issues && pullPoPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={purchaseOrderCapabilityReasonMessage(pullPoPreviewData.blocking_reason, t)}
              />
            ) : null}
            {pullPoPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pullPoPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                rowSelection={{
                  selectedRowKeys: pullPoSelectedItemIds.map(String),
                  onChange: (keys) => setPullPoSelectedItemIds(keys.map((k) => Number(k))),
                  getCheckboxProps: (row) => ({
                    disabled: Number(row.max_push_quantity ?? 0) <= 0,
                  }),
                }}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseReturn.pull.previewNoLines')} />
            )}
            {pullPoPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pullPoPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={pullFromIncomingInspectionAction.label}
        open={pullIiPreviewOpen}
        destroyOnClose
        width={900}
        onCancel={resetPullIiPreviewModal}
        okText={pullFromIncomingInspectionAction.label}
        cancelText={t('common.cancel')}
        confirmLoading={pullIiPreviewConfirming}
        onOk={() => void handlePullIiPreviewConfirm()}
        okButtonProps={{
          disabled:
            pullIiPreviewLoading ||
            !pullIiPreviewData ||
            !!pullIiPreviewData?.has_blocking_issues,
        }}
      >
        {pullIiPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pullIiPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullIiPreviewData.summary}</p>
            {pullIiPreviewData.has_blocking_issues && pullIiPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={qualityInspectionCapabilityReasonMessage(pullIiPreviewData.blocking_reason, t)}
              />
            ) : null}
            {pullIiPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pullIiPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'), dataIndex: 'max_push_quantity', width: 120, align: 'right', render: formatQuantity },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseReturn.pull.previewNoLines')} />
            )}
            {pullIiPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pullIiPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendItemsFromMaterials}
      />

      <Suspense fallback={null}>
        <LazyUniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleImport}
          title={t('app.kuaizhizao.purchaseReturn.importTitle')}
          headers={[
            t('app.kuaizhizao.purchaseReturn.import.materialCode'),
            t('app.kuaizhizao.purchaseReturn.import.returnQuantity'),
            t('app.kuaizhizao.purchaseReturn.import.unitPrice'),
            t('app.kuaizhizao.purchaseReturn.import.batchNumber'),
            t('app.kuaizhizao.purchaseReturn.import.location'),
            t('app.kuaizhizao.purchaseReturn.import.notes'),
          ]}
          exampleRow={['MAT001', '10', '99.5', 'B20260117001', 'A01-01-01', t('app.kuaizhizao.purchaseReturn.import.notesExample')]}
        />
      </Suspense>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.purchaseReturn.detailTitle', {
          suffix: returnDetail?.return_code ? ` - ${returnDetail.return_code}` : '',
        })}
        open={detailDrawerVisible}
        zIndex={purchaseReturnDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setReturnDetail(null);
          resetPurchaseReturnDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={returnDetail || undefined}
        extra={
          returnDetail ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'edit',
                  visible: returnDetail.capabilities?.update?.allowed === true && purchaseReturnPerms.canUpdate,
                  render: () => (
                    <Button {...rowActionKind('update')} size="small" onClick={() => void handleEdit(returnDetail)}>
                      {t('common.edit')}
                    </Button>
                  ),
                },
                {
                  key: 'confirm',
                  visible:
                    returnDetail.capabilities?.confirm?.allowed === true &&
                    (purchaseReturnPerms.canAction?.('submit') ?? false),
                  render: () => (
                    <Button
                      {...rowActionKind('submit')}
                      size="small"
                      onClick={() => handleConfirm(returnDetail)}
                    >
                      {t('app.kuaizhizao.purchaseReturn.confirmReturn')}
                    </Button>
                  ),
                },
                {
                  key: 'withdraw',
                  visible:
                    returnDetail.capabilities?.withdraw?.allowed === true &&
                    (purchaseReturnPerms.canAction?.('revoke') ?? false),
                  render: () => (
                    <Button {...rowActionKind('revoke')} size="small" onClick={() => void handleWithdraw(returnDetail)}>
                      {t('app.kuaizhizao.purchaseReturn.withdrawConfirm')}
                    </Button>
                  ),
                },
              ]}
            />
          ) : null
        }
        customContent={
          returnDetail && (
            <>
              <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(returnDetail, detailColumns)}
                />
                {hasCustomFieldsDetailContent(purchaseReturnListCustomFields, purchaseReturnDetailCustomFieldValues) ? (
                  <div style={{ marginTop: 16 }}>
                    <CustomFieldsDetailSection
                      customFields={purchaseReturnListCustomFields}
                      customFieldValues={purchaseReturnDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                <Descriptions
                  column={3}
                  size="small"
                  style={{ marginTop: 16 }}
                  items={buildDescriptionItemsFromColumns(returnDetail, [detailNotesColumn])}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getPurchaseReturnLifecycle(returnDetail, t);
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
                  {returnDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='purchase_return'
                      documentId={returnDetail.id}
                      active={detailDrawerVisible}
                      selfDocumentId={returnDetail.id}
                      renderBriefActions={(doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailDrawerVisible(false);
                      setReturnDetail(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
                <style>{`
                  .purchase-return-detail-items .ant-table-wrapper .ant-table-body,
                  .purchase-return-detail-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                `}</style>
                {returnDetail.items && returnDetail.items.length > 0 ? (
                  <div
                    className="purchase-return-detail-items"
                    style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                  >
                    <Table
                      size="small"
                      tableLayout="fixed"
                      style={{ minWidth: PR_DETAIL_ITEMS_MIN_WIDTH }}
                      columns={detailItemColumns}
                      dataSource={returnDetail.items}
                      pagination={false}
                      rowKey="id"
                      bordered
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseReturn.emptyItems')} />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
                {purchaseReturnTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {purchaseReturnTracking.error && !purchaseReturnTracking.loading && (
                  <Typography.Text type="danger">{purchaseReturnTracking.error}</Typography.Text>
                )}
                {purchaseReturnTracking.data && !purchaseReturnTracking.loading && (
                  <DocumentTrackingTimelineBody data={purchaseReturnTracking.data} />
                )}
                {!purchaseReturnTracking.loading && !purchaseReturnTracking.data && !purchaseReturnTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.shipmentNotice.noOperationRecords')} />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      />
    </>
  );
};

export default PurchaseReturnsPage;
