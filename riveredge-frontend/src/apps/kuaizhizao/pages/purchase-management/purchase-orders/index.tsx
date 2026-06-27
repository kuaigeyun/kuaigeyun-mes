/**
 * 采购订单管理页面
 *
 * 提供采购订单的创建、编辑、查看和审批功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import type { DescriptionsProps } from 'antd';
import { App, Button, Tag, Space, Modal, Row, Col, Table, Empty, Timeline, Divider, Form as AntForm, Input, InputNumber, DatePicker, List, Typography, theme, Dropdown, Descriptions, Spin, Card, Select, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleTwoTone, CloseCircleTwoTone, DownOutlined, FileTextOutlined, InboxOutlined, RollbackOutlined, AppstoreAddOutlined, ArrowLeftOutlined, ImportOutlined, PrinterOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { getDataDictionaryByCode, getDictionaryItemList, type DictionaryItem } from '../../../../../services/dataDictionary';
import { mapSystemDictionaryItemOptions, resolveSystemDictionaryItemLabel } from '../../../../../utils/systemDictionaryI18n';
import { getFileDownloadUrl } from '../../../../../services/file';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniAuditBatchMenuButton, UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerInlineFullChain,
  DetailDrawerActions,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  DocumentFormPageLayout,
  DocumentFormPageHeaderActions,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  PAGE_SPACING,
  type StatCard,
} from '../../../../../components/layout-templates';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import {
  DOCUMENT_DETAIL_COL_WIDTH,
  DOCUMENT_DETAIL_DATE_PICKER_STYLE,
  DOCUMENT_DETAIL_NUM_COL,
  DOCUMENT_DETAIL_CONTROL_SIZE,
  DOCUMENT_DETAIL_TABLE_PROPS,
  DOCUMENT_DETAIL_TEXT_COL,
  DocumentDetailTableStyles,
  TaxRateBatchColumnTitle,
  TaxRateDetailCell,
} from '../../../components/document-detail-table/documentDetailTable';
import { DocumentAmountSummary } from '../../../components/document-amount-summary/DocumentAmountSummary';
import { SimpleSparkline } from '../../../../../components';
import CodeField from '../../../../../components/code-field';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import type { Material } from '../../../../master-data/types/material';
import FeeDetailsTable from '../../../../../components/FeeDetailsTable';
import PriceTypeSwitch, { type PriceTypeValue } from '../../../../../components/price-type-switch/PriceTypeSwitch';
import { setFormPriceType } from '../../../../../utils/priceTypeSwitch';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';
import {
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder,
  deletePurchaseOrder, approvePurchaseOrder, submitPurchaseOrder,
  withdrawPurchaseOrder,
  revokePurchaseOrder,
  pushPurchaseOrderToReceipt, pushPurchaseOrderToReceiptPreview,
  pushPurchaseOrderToReceiptNotice, pushPurchaseOrderToInvoice, pushPurchaseOrderToPurchaseReturn,
  pullPurchaseOrderFromInquiry, getPurchaseOrderStatistics, expeditePurchaseOrder,
  PurchaseOrder, PurchaseOrderItem
} from '../../../services/purchase';
import {
  listPurchaseRequisitions,
  getPurchaseRequisition,
  convertToPurchaseOrder,
  type PurchaseRequisition,
} from '../../../services/purchase-requisition';
import {
  listPurchaseInquiries,
  getPurchaseInquiry,
  type PurchaseInquiry,
} from '../../../services/purchase-inquiry';
import { listPurchaseOrderChangesByOrder, type PurchaseOrderChange } from '../../../services/purchase-order-change';
import LandingCostAllocationModal from './LandingCostAllocationModal';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import {
  getMaterialDefaultTaxRate,
  pickPurchaseUnitPrice,
  resolveSupplierPurchasePricesBatch,
} from '../../../../master-data/utils/resolve-partner-material-price';
import { getApprovalStatus, ApprovalStatusResponse } from '../../../../../services/approvalInstance';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';

const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { searchUserDisplay, type User } from '../../../../../services/user';
import { useGlobalStore } from '../../../../../stores';
import { displayItemsToUsers } from '../../../../../utils/userDisplay';
import {
  DocumentStatus,
  ReviewStatusEnum,
  getStatusDisplay,
  getReviewStatusDisplay,
  isDraftStatus,
  isAuditedStatus,
} from '../../../constants/documentStatus';
import { resolveStatusTagDisplayProps } from '../../../../../constants/statusBadges';
import { getPurchaseOrderLifecycle, buildPurchaseOrderLifecycleValueEnum, resolvePurchaseOrderListLifecycleParams, isPurchaseOrderDeliveryOverdue } from '../../../utils/purchaseOrderLifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import type { SubStage } from '../../../../../components/uni-lifecycle/types';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  purchaseOrderBatchPushReceiptNoticeAllowed,
} from '../../../../../hooks/useDocumentCapabilities';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { SupplierSelectDropdown } from '../../../../master-data/components/SupplierSelectDropdown';
import { batchImport } from '../../../../../utils/batchOperations';
import { ROUTES } from '../../../constants/routes';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { fetchStorageLocationsForWarehouse } from '../../warehouse-management/inbound/inboundPoReceiptEntryUtils';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';

/** 与后端 DocumentStatus / ReviewStatus 及中文存量值对齐，供 UniWorkflowActions 识别 */
const PO_WORKFLOW_DRAFT_STATUSES = ['草稿', 'draft', 'DRAFT', DocumentStatus.DRAFT];
/** 仅匹配主状态「待审核」，勿包含 review 的 PENDING：新建草稿默认 review_status=PENDING，否则会误显「审核」按钮 */
const PO_WORKFLOW_PENDING_STATUSES = [
  '待审核',
  'pending_review',
  'PENDING_REVIEW',
  DocumentStatus.PENDING_REVIEW,
];
const PO_WORKFLOW_APPROVED_STATUSES = [
  '已审核',
  'audited',
  '审核通过',
  '已确认',
  DocumentStatus.AUDITED,
  DocumentStatus.CONFIRMED,
  ReviewStatusEnum.APPROVED,
];
const PO_WORKFLOW_REJECTED_STATUSES = [
  '已驳回',
  'rejected',
  'REJECTED',
  DocumentStatus.REJECTED,
  ReviewStatusEnum.REJECTED,
];

/** 指标卡迷你图默认序列：模块级稳定引用，避免每次 render 新数组触发图表无限 update（G2 interval 报错） */
const PO_STAT_SPARKLINE_ARRIVAL = [60, 75, 80, 78, 85, 90, 88];
const PO_STAT_SPARKLINE_ANNUAL = [1000, 2000, 1500, 3000, 2500, 4000, 3500];
const PO_STAT_SPARKLINE_SUPPLIER = [92, 95, 88, 96, 94, 98, 95];
const PO_STAT_SPARKLINE_OVERDUE = [5, 8, 3, 12, 7, 15, 10];

/** 详情只读明细表最小宽度（外层横滚） */
const PO_DETAIL_ITEMS_MIN_WIDTH = 1200;

/** 与销售订单 Uni-detail 一致：生命周期（协作）区块标题旁展示「下一步」建议 */
const PurchaseOrderCollaborationTitleSuffix: React.FC<{
  lifecycle: ReturnType<typeof getPurchaseOrderLifecycle> | null;
}> = ({ lifecycle }) => {
  const { t } = useTranslation();
  const next = lifecycle?.nextStepSuggestions;
  if (!next?.length) return null;
  return (
    <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
      {t('components.uniLifecycle.nextStep')}：
      {next.join(t('components.uniLifecycle.nextStepSeparator'))}
    </Typography.Text>
  );
};

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

function renderPurchaseOrderRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return nodes;
}

// 使用从服务文件导入的接口
type PurchaseOrderDetail = PurchaseOrder;
// PurchaseOrderItem 已在导入中定义

type PullPurchaseRequisitionLineCandidate = {
  key: string;
  requisition_id: number;
  requisition_code: string;
  requisition_name?: string;
  applicant_name?: string;
  requisition_date?: string;
  requisition_status?: string;
  review_status?: string;
  item_id: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  unit?: string;
  quantity: number;
  required_date?: string;
  supplier_id?: number;
  supplier_name?: string;
  purchase_order_id?: number;
  converted: boolean;
};

type PullPurchaseInquiryLineCandidate = {
  key: string;
  inquiry_id: number;
  inquiry_code: string;
  inquiry_name?: string;
  buyer_name?: string;
  inquiry_date?: string;
  inquiry_status?: string;
  review_status?: string;
  item_id: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  unit?: string;
  quantity: number;
  required_date?: string;
  supplier_id?: number;
  supplier_name?: string;
  purchase_order_id?: number;
  converted: boolean;
};

const defaultOrderItem = {
  material_id: undefined,
  material_code: '',
  material_name: '',
  material_spec: '',
  unit: '件',
  ordered_quantity: 1,
  unit_price: 0,
  tax_rate: 0,
  required_date: undefined,
};

/** 安全提取金额数值（兼容 number、string、{ value } 对象） */
function formatAmount(val: unknown): string {
  const num =
    typeof val === 'number' && !isNaN(val)
      ? val
      : val && typeof val === 'object' && 'value' in val && typeof (val as { value?: unknown }).value === 'number'
        ? (val as { value: number }).value
        : parseFloat(String(val ?? 0));
  return (isNaN(num) ? 0 : num).toLocaleString();
}

const ORDER_TYPE_FALLBACK_ITEMS: Pick<DictionaryItem, 'value' | 'label' | 'is_system_managed' | 'sort_order'>[] = [
  { value: '标准采购', label: '标准采购', is_system_managed: true, sort_order: 0 },
  { value: '框架协议', label: '框架协议', is_system_managed: true, sort_order: 1 },
];

const PURCHASE_ORDER_RESOURCE = 'kuaizhizao:purchase-order';

const PURCHASE_ORDER_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_purchase_orders';

const PURCHASE_ORDER_LIST_PATH = '/apps/kuaizhizao/purchase-management/purchase-orders';
const PURCHASE_ORDER_CREATE_PATH = `${PURCHASE_ORDER_LIST_PATH}/new`;
const purchaseOrderEditPath = (id: number) => `${PURCHASE_ORDER_LIST_PATH}/${id}/edit`;

const PurchaseOrdersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const purchaseOrderAuditEnabled = useAuditRequired('purchase_order', false);
  const purchaseOrderPerms = useResourcePermissions(PURCHASE_ORDER_RESOURCE);
  const { token } = theme.useToken();
  const purchaseOrderDetailDrawerZIndex = token.zIndexPopupBase;
  const navigate = useNavigate();
  const location = useLocation();
  const isCreatePage = location.pathname.endsWith('/purchase-orders/new');
  const editRouteMatch = location.pathname.match(/\/purchase-orders\/(\d+)\/edit$/);
  const editRouteId = editRouteMatch ? Number(editRouteMatch[1]) : null;
  const isEditPage = editRouteId != null && Number.isFinite(editRouteId) && editRouteId > 0;
  const isFormPage = isCreatePage || isEditPage;
  const formPageInitializedRef = useRef(false);
  const { message: messageApi } = App.useApp();
  const pullFromRequisitionAction = resolveKuaizhizaoDocumentAction(t, 'purchase_order.pull_from_requisition');
  const pullFromInquiryAction = resolveKuaizhizaoDocumentAction(t, 'purchase_order.pull_from_inquiry');
  const pushToReceiptNoticeAction = resolveKuaizhizaoDocumentAction(t, 'receipt_notice.pull_from_purchase_order');
  const pushToReceiptAction = resolveKuaizhizaoDocumentAction(t, 'purchase_receipt.pull_from_purchase_order');
  const pushToInvoiceAction = resolveKuaizhizaoDocumentAction(t, 'purchase_invoice.pull_from_purchase_order');
  const pushToPurchaseReturnAction = resolveKuaizhizaoDocumentAction(t, 'purchase_return.pull_from_purchase_order');
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<PurchaseOrder[]>([]);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();

  const purchaseOrderImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', labelKey: 'app.kuaizhizao.purchaseOrder.import.code', aliases: ['订单编号', '编号'] },
          {
            field: 'supplier',
            required: true,
            labelKey: 'app.kuaizhizao.purchaseOrder.import.supplierName',
            aliases: ['供应商', '供应商名称'],
          },
          {
            field: 'date',
            required: true,
            labelKey: 'app.kuaizhizao.purchaseOrder.import.orderDate',
            aliases: ['订单日期', '日期'],
          },
          {
            field: 'material',
            required: true,
            labelKey: 'app.kuaizhizao.purchaseOrder.import.materialCode',
            aliases: ['物料', '物料编号'],
          },
          { field: 'quantity', required: true, labelKey: 'app.kuaizhizao.purchaseOrder.import.quantity', aliases: ['数量'] },
          { field: 'unitPrice', labelKey: 'app.kuaizhizao.purchaseOrder.import.unitPrice', aliases: ['单价'] },
          { field: 'delivery', labelKey: 'app.kuaizhizao.purchaseOrder.import.deliveryDate', aliases: ['交货日期'] },
          { field: 'notes', labelKey: 'app.kuaizhizao.purchaseOrder.import.notes', aliases: ['备注'] },
        ],
        [
          t('app.kuaizhizao.purchaseOrder.importExample.code'),
          t('app.kuaizhizao.purchaseOrder.importExample.supplierName'),
          t('app.kuaizhizao.purchaseOrder.importExample.orderDate'),
          t('app.kuaizhizao.purchaseOrder.importExample.materialCode'),
          t('app.kuaizhizao.purchaseOrder.importExample.quantity'),
          t('app.kuaizhizao.purchaseOrder.importExample.unitPrice'),
          t('app.kuaizhizao.purchaseOrder.importExample.deliveryDate'),
          '',
        ],
      ),
    [t, i18n.language],
  );

  const tableSearchFormRef = useRef<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [highlightDeliveryOverdue, setHighlightDeliveryOverdue] = useState(false);

  const selectedOrdersForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is PurchaseOrder => row != null),
    [selectedRowKeys],
  );

  const purchaseOrderHighlightOverdueToolbar = useMemo(
    () => (
      <Space key="highlight-overdue-switch" align="center">
        <Switch checked={highlightDeliveryOverdue} onChange={setHighlightDeliveryOverdue} />
        <span style={{ fontSize: 13, color: 'var(--ant-color-text)' }}>
          {t('app.kuaizhizao.purchaseOrder.highlightOverdue')}
        </span>
      </Space>
    ),
    [highlightDeliveryOverdue, t],
  );

  const purchaseOrderAuditBatchHandlers = useMemo(
    () => ({
      submit: (id: number) => submitPurchaseOrder(id),
      withdraw: (id: number) => withdrawPurchaseOrder(id),
      approve: (id: number) => approvePurchaseOrder(id, { approved: true, review_remarks: '' }),
      revoke: (id: number) => revokePurchaseOrder(id),
    }),
    [],
  );

  const handlePurchaseOrderAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  }, [invalidateMenuBadgeCounts]);

  const leavePurchaseOrderFormPage = useCallback(() => {
    navigate(PURCHASE_ORDER_LIST_PATH);
  }, [navigate]);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<PurchaseOrder | null>(null);
  const formRef = useRef<any>(null);

  const {
    customFields: purchaseOrderFormCustomFields,
    customFieldValues: purchaseOrderFormCustomFieldValues,
    loadFieldValues: loadPurchaseOrderFormFieldValues,
    extractFormValues: extractPurchaseOrderFormValues,
    saveCustomFieldValues: savePurchaseOrderCustomFieldValues,
    resetFieldValues: resetPurchaseOrderFormFieldValues,
  } = useCustomFields({ tableName: PURCHASE_ORDER_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: isFormPage });

  const {
    customFields: purchaseOrderListCustomFields,
    generateCustomFieldColumns: generatePurchaseOrderCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichPurchaseOrderRecordsWithCustomFields,
    customFieldValues: purchaseOrderDetailCustomFieldValues,
    loadFieldValuesForDetail: loadPurchaseOrderFieldValuesForDetail,
    resetDetailFieldValues: resetPurchaseOrderDetailFieldValues,
  } = useCustomFieldsForList<PurchaseOrder>({ tableName: PURCHASE_ORDER_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (purchaseOrderListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [purchaseOrderListCustomFields.length]);

  /** 标记是否在保存后自动提交（草稿转正式） */
  const submitAfterSaveRef = useRef(false);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [orderDetail, setOrderDetail] = useState<PurchaseOrderDetail | null>(null);
  const [orderChangeHistory, setOrderChangeHistory] = useState<PurchaseOrderChange[]>([]);
  const [poTrackingRefreshKey, setPoTrackingRefreshKey] = useState(0);
  const purchaseOrderTracking = useDocumentTracking(
    detailDrawerVisible && orderDetail?.id ? 'purchase_order' : undefined,
    orderDetail?.id,
    poTrackingRefreshKey,
  );

  const purchaseOrderLifecycle = useMemo(
    () => (orderDetail ? getPurchaseOrderLifecycle(orderDetail, purchaseOrderAuditEnabled) : null),
    [orderDetail, purchaseOrderAuditEnabled],
  );

  useEffect(() => {
    if (!orderDetail?.id) {
      setOrderChangeHistory([]);
      return;
    }
    listPurchaseOrderChangesByOrder(orderDetail.id).then(setOrderChangeHistory).catch(() => setOrderChangeHistory([]));
  }, [orderDetail?.id]);

  const lifecycleValueEnum = useMemo(
    () => buildPurchaseOrderLifecycleValueEnum(t, purchaseOrderAuditEnabled),
    [t, purchaseOrderAuditEnabled],
  );
  const purchaseOrderAuditColumn = useMemo(
    () => createListAuditPhaseColumn<PurchaseOrder>({ t, auditEnabled: purchaseOrderAuditEnabled }),
    [t, purchaseOrderAuditEnabled],
  );

  // 供应商列表、订单类型、币种
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [orderTypeOptions, setOrderTypeOptions] = useState<Array<{ label: string; value: string }>>(() =>
    mapSystemDictionaryItemOptions('ORDER_TYPE', ORDER_TYPE_FALLBACK_ITEMS as DictionaryItem[], t),
  );
  const [orderTypeLoading, setOrderTypeLoading] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const currentUser = useGlobalStore((s) => s.currentUser);
  const [usersLoading, setUsersLoading] = useState(false);

  // 审批流程相关状态
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatusResponse | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);

  // 下推入库 Modal
  const [pushToReceiptVisible, setPushToReceiptVisible] = useState(false);
  const [pushToNoticeVisible, setPushToNoticeVisible] = useState(false);
  const [pushToReturnVisible, setPushToReturnVisible] = useState(false);
  const [landingCostModalVisible, setLandingCostModalVisible] = useState(false);

  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['purchaseOrderStatistics'] });
  };

  useEffect(() => {
    const loadSuppliers = async () => {
      setSuppliersLoading(true);
      try {
        const res = await apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', { params: { limit: 1000, is_active: true } });
        const list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
        setSupplierList(Array.isArray(list) ? list : []);
      } catch {
        setSupplierList([]);
      } finally {
        setSuppliersLoading(false);
      }
    };
    const loadUsers = async () => {
      setUsersLoading(true);
      try {
        const res = await searchUserDisplay({ page_size: 200, is_active: true });
        setUsers(displayItemsToUsers(res.items || []));
      } catch {
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };
    loadSuppliers();
    loadUsers();
  }, [currentUser]);

  useEffect(() => {
    const loadOrderType = async () => {
      setOrderTypeLoading(true);
      try {
        const dict = await getDataDictionaryByCode('ORDER_TYPE');
        const items = await getDictionaryItemList(dict.uuid, true);
        const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
        setOrderTypeOptions(mapSystemDictionaryItemOptions('ORDER_TYPE', sorted, t));
      } catch {
        setOrderTypeOptions(
          mapSystemDictionaryItemOptions('ORDER_TYPE', ORDER_TYPE_FALLBACK_ITEMS as DictionaryItem[], t),
        );
        messageApi.info(t('app.kuaizhizao.purchaseOrder.orderTypeFallback'));
      } finally {
        setOrderTypeLoading(false);
      }
    };
    const loadCurrency = async () => {
      setCurrencyLoading(true);
      try {
        const dict = await getDataDictionaryByCode('CURRENCY');
        const items = await getDictionaryItemList(dict.uuid, true);
        setCurrencyOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setCurrencyOptions([{ label: t('app.kuaizhizao.purchaseOrder.currencyCny'), value: 'CNY' }, { label: t('app.kuaizhizao.purchaseOrder.currencyUsd'), value: 'USD' }, { label: t('app.kuaizhizao.purchaseOrder.currencyEur'), value: 'EUR' }]);
      } finally {
        setCurrencyLoading(false);
      }
    };
    loadOrderType();
    loadCurrency();
  }, [t, messageApi]);

  const { data: statistics } = useQuery({
    queryKey: ['purchaseOrderStatistics'],
    queryFn: getPurchaseOrderStatistics,
  });

  // 下推入库 Modal
  const [feeTypeOptions, setFeeTypeOptions] = useState<any[]>([]);

  useEffect(() => {
    getDataDictionaryByCode('FEE_TYPE')
      .then((dict) => getDictionaryItemList(dict.uuid))
      .then((res) => {
        setFeeTypeOptions(res || []);
      })
      .catch(() => {
        setFeeTypeOptions([]);
      });
  }, []);

  const appendPurchaseItemsFromMaterials = useCallback(
    async (selected: Material[]) => {
      if (!selected?.length) return;
      const mainDelivery = formRef.current?.getFieldValue('delivery_date');
      const defaultDate =
        mainDelivery != null ? (dayjs.isDayjs(mainDelivery) ? mainDelivery : dayjs(mainDelivery)) : dayjs();
      const supplierId = formRef.current?.getFieldValue('supplier_id');
      const orderDate = formRef.current?.getFieldValue('order_date');
      const asOf = orderDate != null ? (dayjs.isDayjs(orderDate) ? orderDate : dayjs(orderDate)) : dayjs();

      const resolveMap = new Map<number, Awaited<ReturnType<typeof resolveSupplierPurchasePricesBatch>>[number]>();
      if (supplierId && selected.length) {
        try {
          const items = await resolveSupplierPurchasePricesBatch(
            Number(supplierId),
            selected.map((m) => m.id),
            asOf,
          );
          selected.forEach((m, i) => {
            if (items[i]) resolveMap.set(m.id, items[i]);
          });
        } catch {
          /* 回退物料默认价 */
        }
      }

      const current = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));
      const newRows = selected.map((m) => {
        const resolved = resolveMap.get(m.id);
        const taxR = resolved?.taxRate != null ? Number(resolved.taxRate) : getMaterialDefaultTaxRate(m);
        const price = pickPurchaseUnitPrice(m, resolved);
        return {
          material_id: m.id,
          material_code: m.mainCode ?? m.code ?? '',
          material_name: m.name ?? '',
          material_spec: m.specification ?? '',
          unit: m.baseUnit ?? '件',
          ordered_quantity: 1,
          unit_price: price,
          tax_rate: taxR,
          required_date: defaultDate,
        };
      });
      const firstRow = current?.[0];
      const firstRowEmpty =
        current.length === 1 &&
        !firstRow?.material_id &&
        !(firstRow?.material_code && String(firstRow.material_code).trim()) &&
        !(firstRow?.material_name && String(firstRow.material_name).trim());

      if (firstRowEmpty) {
        formRef.current?.setFieldsValue({ items: [newRows[0], ...newRows.slice(1)] });
      } else {
        formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      }
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const handleItemImport = useCallback(
    (data: any[][]) => {
      const rows = data.slice(2);
      const mainDelivery = formRef.current?.getFieldValue('delivery_date');
      const defaultDate =
        mainDelivery != null ? (dayjs.isDayjs(mainDelivery) ? mainDelivery : dayjs(mainDelivery)) : dayjs();
      const newItems = rows
        .map((row) => {
          const materialCode = String(row[0] || '').trim();
          const spec = String(row[1] || '').trim();
          const unit = String(row[2] || '').trim();
          const quantity = parseFloat(row[3]) || 0;
          const price = parseFloat(row[4]) || 0;
          const requiredDate = row[5];

          if (!materialCode) return null;

          return {
            material_code: materialCode,
            material_name: '',
            material_spec: spec,
            unit: unit || '件',
            ordered_quantity: quantity || 1,
            unit_price: price,
            tax_rate: 0,
            required_date: requiredDate
              ? dayjs(requiredDate).isValid()
                ? dayjs(requiredDate)
                : defaultDate
              : defaultDate,
          };
        })
        .filter((it): it is NonNullable<typeof it> => it !== null);

      if (newItems.length === 0) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.importNoValidData'));
        return;
      }

      const currentItems = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));
      formRef.current?.setFieldsValue({ items: [...currentItems, ...newItems] });
      messageApi.success(t('app.kuaizhizao.salesOrder.importSuccessItems', { count: newItems.length }));
      setImportModalVisible(false);
    },
    [messageApi],
  );

  const [pushToReceiptOrder, setPushToReceiptOrder] = useState<PurchaseOrderDetail | null>(null);
  const [pushToReceiptQuantities, setPushToReceiptQuantities] = useState<Record<number, number>>({});
  const [pushToReceiptBatchNumbers, setPushToReceiptBatchNumbers] = useState<Record<number, string>>({});
  const [pushToReceiptWarehouseId, setPushToReceiptWarehouseId] = useState<number | undefined>();
  const [pushToReceiptWarehouseOptions, setPushToReceiptWarehouseOptions] = useState<
    { label: string; value: number }[]
  >([]);
  const [pushToReceiptLineWh, setPushToReceiptLineWh] = useState<Record<number, number>>({});
  const [pushToReceiptLineLoc, setPushToReceiptLineLoc] = useState<Record<number, number | undefined>>({});
  const [pushToReceiptLineLocCode, setPushToReceiptLineLocCode] = useState<Record<number, string>>({});
  const [pushToReceiptLocOptionsByWh, setPushToReceiptLocOptionsByWh] = useState<
    Record<number, { value: number; label: string; code: string }[]>
  >({});
  const [pushToReceiptPreviewLoading, setPushToReceiptPreviewLoading] = useState(false);
  const [pushToReceiptLoading, setPushToReceiptLoading] = useState(false);

  // 下推收货通知 Modal 相关详情状态
  const [pushToNoticeOrder, setPushToNoticeOrder] = useState<PurchaseOrderDetail | null>(null);
  const [pushToNoticeQuantities, setPushToNoticeQuantities] = useState<Record<number, number>>({});
  const [pushToReturnOrder, setPushToReturnOrder] = useState<PurchaseOrderDetail | null>(null);
  const [pushToReturnQuantities, setPushToReturnQuantities] = useState<Record<number, number>>({});
  const [pushToReturnWarehouseId, setPushToReturnWarehouseId] = useState<number | undefined>(undefined);
  const [pushToReturnWarehouseName, setPushToReturnWarehouseName] = useState('');
  const [pushToReturnLoading, setPushToReturnLoading] = useState(false);
  const [landingCostOrder, setLandingCostOrder] = useState<PurchaseOrder | null>(null);

  /** 列表列顺序：金额/数量/时间在前；生命周期固定倒数第二；操作列最后（与 UI_Standard 一致） */
  const purchaseOrderCustomFieldColumns = generatePurchaseOrderCustomFieldColumns();
  const columns: ProColumns<PurchaseOrder>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.purchaseOrder.col.supplierAndOrder'),
      key: 'order_code',
      dataIndex: 'order_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.supplier_name ?? '')}
          secondary={String(r.order_code ?? '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.orderCode'),
      dataIndex: 'order_code',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.supplier'),
      dataIndex: 'supplier_name',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.buyer'),
      dataIndex: 'buyer_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.orderDate'),
      dataIndex: 'order_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.deliveryDate'),
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.orderAmount'),
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text: any) => `¥${formatAmount(text)}`,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
    },
    ...(purchaseOrderAuditColumn ? [purchaseOrderAuditColumn] : []),
    {
      title: t('app.kuaizhizao.purchaseOrder.col.lifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      fixed: 'right',
      align: 'left',
      valueType: 'select',
      valueEnum: lifecycleValueEnum,
      render: (_: any, record: PurchaseOrder) => (
        <ListUniLifecycleCell lifecycle={getPurchaseOrderLifecycle(record, purchaseOrderAuditEnabled)} />
      ),
    },
    ...purchaseOrderCustomFieldColumns,
    {
      title: t('common.actions'),
      fixed: 'right',
      hideInSearch: true,
      valueType: 'option',
      render: (_: any, record: PurchaseOrder) => {
        const canEdit = record.capabilities?.update?.allowed === true && purchaseOrderPerms.canUpdate;
        const canDelete = record.capabilities?.delete?.allowed === true && purchaseOrderPerms.canDelete;
        const parts: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="d" onClick={() => handleDetail(record)}>
            {t('common.detail')}
          </Button>,
        ];
        if (canEdit) {
          parts.push(
            <Button {...rowActionKind('update')} key="e" onClick={() => handleEdit(record)}>
              {t('common.edit')}
            </Button>,
          );
        }
        if (canDelete) {
          parts.push(
            <Button {...rowActionKind('delete')} key="del" onClick={() => handleDelete(record)}>
              {t('common.delete')}
            </Button>,
          );
        }
        parts.push(
          <UniWorkflowActions {...rowActionKind('skip')}
            key="wf"
            record={record}
            entityName={t('app.kuaizhizao.purchaseOrder.entityName')}
            entityType="purchase_order"
            unifiedAudit
            resourcePrefix="kuaizhizao:purchase-order"
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={PO_WORKFLOW_DRAFT_STATUSES}
            pendingStatuses={PO_WORKFLOW_PENDING_STATUSES}
            approvedStatuses={PO_WORKFLOW_APPROVED_STATUSES}
            rejectedStatuses={PO_WORKFLOW_REJECTED_STATUSES}
            submitActionLabel={t('app.kuaizhizao.purchaseOrder.submitForReview')}
            theme="link"
            size="small"
            onSuccess={() => {
              invalidateStatistics();
              invalidateMenuBadgeCounts();

              actionRef.current?.reload();
            }}
          />
        );
        return parts;
      },
    },
  ], [t, purchaseOrderAuditEnabled, lifecycleValueEnum, purchaseOrderAuditColumn, purchaseOrderCustomFieldColumns, purchaseOrderPerms]);

  const [pushToNoticeLoading, setPushToNoticeLoading] = useState(false);
  const [pushToInvoiceLoading, setPushToInvoiceLoading] = useState(false);

  // 处理详情查看
  const handleDetail = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      setOrderDetail(detail as PurchaseOrderDetail);

      // 获取审批流程状态和记录（采购审批流程增强）
      await loadApprovalData(record.id!);

      setDetailDrawerVisible(true);
      setPoTrackingRefreshKey((k) => k + 1);
      if (record.id != null) {
        await loadPurchaseOrderFieldValuesForDetail(record.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.purchaseOrder.detailFailed'));
    }
  };

  // 加载审批流程数据
  const loadApprovalData = async (orderId: number) => {
    setApprovalLoading(true);
    try {
      const status = await getApprovalStatus('purchase_order', orderId);
      setApprovalStatus(status);
    } catch (error) {
      console.error('获取审批流程数据失败:', error);
      setApprovalStatus(null);
    } finally {
      setApprovalLoading(false);
    }
  };

  // 打开下推入库 Modal（加载订单明细，初始化可编辑数量，预拉批号）
  const handlePushToReceipt = async (record: PurchaseOrder) => {
    try {
      const [detail, whRes] = await Promise.all([
        getPurchaseOrder(record.id!),
        masterWarehouseApi.list({ is_active: true, limit: 500 }),
      ]);
      const items = (detail.items || []).filter(
        (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
      );
      if (items.length === 0) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.allReceived'));
        return;
      }
      const whList = Array.isArray(whRes) ? whRes : (whRes as { items?: unknown[] })?.items ?? [];
      const warehouseOptions = (Array.isArray(whList) ? whList : []).map((w) => {
        const row = w as { id: number; code?: string; name?: string };
        const label = `${row.code || ''} ${row.name || ''}`.trim() || String(row.id);
        return { label, value: row.id };
      });
      if (warehouseOptions.length === 0) {
        messageApi.error(t('app.kuaizhizao.purchaseOrder.pushReceiptNoWarehouse'));
        return;
      }
      const quantities: Record<number, number> = {};
      items.forEach((it: PurchaseOrderItem) => {
        if (it.id != null) {
          quantities[it.id] = Number(it.outstanding_quantity ?? 0);
        }
      });
      setPushToReceiptOrder(detail as PurchaseOrderDetail);
      setPushToReceiptQuantities(quantities);
      setPushToReceiptWarehouseOptions(warehouseOptions);
      setPushToReceiptLineWh({});
      setPushToReceiptLineLoc({});
      setPushToReceiptLineLocCode({});
      setPushToReceiptLocOptionsByWh({});
      const defaultWhId = warehouseOptions.length === 1 ? warehouseOptions[0].value : undefined;
      setPushToReceiptWarehouseId(defaultWhId);
      if (defaultWhId != null) {
        const lineWh: Record<number, number> = {};
        items.forEach((it: PurchaseOrderItem) => {
          if (it.id != null) lineWh[it.id] = defaultWhId;
        });
        setPushToReceiptLineWh(lineWh);
        void fetchStorageLocationsForWarehouse(defaultWhId).then((opts) =>
          setPushToReceiptLocOptionsByWh((prev) => ({ ...prev, [defaultWhId]: opts })),
        );
      }
      setPushToReceiptBatchNumbers({});
      setPushToReceiptVisible(true);
      setPushToReceiptPreviewLoading(true);
      try {
        const preview = await pushPurchaseOrderToReceiptPreview(record.id!, quantities);
        const batchMap: Record<number, string> = {};
        (preview.items || []).forEach((it: { item_id: number; batch_number?: string }) => {
          if (it.batch_number) batchMap[it.item_id] = it.batch_number;
        });
        setPushToReceiptBatchNumbers(batchMap);
      } catch {
        // 预览失败不影响弹窗展示，批号将在确认时生成
      } finally {
        setPushToReceiptPreviewLoading(false);
      }
    } catch {
      messageApi.error(t('app.kuaizhizao.purchaseOrder.loadDetailFailed'));
    }
  };

  // 确认下推入库
  const handlePushToReceiptConfirm = async () => {
    if (!pushToReceiptOrder?.id) return;
    const items = (pushToReceiptOrder.items || []).filter(
      (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
    );
    let hasPositiveQty = false;
    for (const it of items) {
      if (it.id == null) continue;
      const qty = pushToReceiptQuantities[it.id] ?? 0;
      const max = Number(it.outstanding_quantity ?? 0);
      if (qty <= 0) continue;
      hasPositiveQty = true;
      if (qty > max) {
        messageApi.error(t('app.kuaizhizao.purchaseOrder.qtyExceedsUnreceived', { material: it.material_code || it.material_name, max }));
        return;
      }
      const lineWh = pushToReceiptLineWh[it.id];
      if (lineWh == null || !(lineWh > 0)) {
        messageApi.error(t('app.kuaizhizao.purchaseOrder.pushReceiptSelectLineWarehouse', { material: it.material_code || it.material_name || '-' }));
        return;
      }
    }
    if (!hasPositiveQty) {
      messageApi.warning(t('app.kuaizhizao.purchaseOrder.pushReceiptQtyRequired'));
      return;
    }
    const batchNumbers: Record<number, string> = {};
    const lineWhByPoItemId: Record<number, number> = {};
    const lineLocByPoItemId: Record<number, number> = {};
    const lineLocCodeByPoItemId: Record<number, string> = {};
    let headerWarehouseId: number | undefined;
    items.forEach((it: PurchaseOrderItem) => {
      if (it.id == null) return;
      const qty = pushToReceiptQuantities[it.id] ?? 0;
      if (qty <= 0) return;
      const lineWh = pushToReceiptLineWh[it.id];
      if (lineWh == null || !(lineWh > 0)) return;
      lineWhByPoItemId[it.id] = lineWh;
      if (headerWarehouseId == null) headerWarehouseId = lineWh;
      const locId = pushToReceiptLineLoc[it.id];
      if (locId != null && locId > 0) {
        lineLocByPoItemId[it.id] = locId;
        const locCode = pushToReceiptLineLocCode[it.id];
        if (locCode) lineLocCodeByPoItemId[it.id] = locCode;
      }
      if (pushToReceiptBatchNumbers[it.id]) {
        batchNumbers[it.id] = pushToReceiptBatchNumbers[it.id];
      }
    });
    setPushToReceiptLoading(true);
    try {
      const result = await pushPurchaseOrderToReceipt(
        pushToReceiptOrder.id,
        pushToReceiptQuantities,
        Object.keys(batchNumbers).length > 0 ? batchNumbers : undefined,
        {
          warehouseId: headerWarehouseId,
          lineWarehouses: lineWhByPoItemId,
          lineLocationIds: lineLocByPoItemId,
          lineLocationCodes: lineLocCodeByPoItemId,
        },
      );
      const receiptId = Number(result?.id);
      if (!Number.isFinite(receiptId) || receiptId <= 0) {
        messageApi.error(t('app.kuaizhizao.purchaseOrder.pushReceiptFailed'));
        return;
      }
      messageApi.success(t('app.kuaizhizao.purchaseOrder.pushReceiptSuccess', { code: result.receipt_code || t('app.kuaizhizao.purchaseOrder.createdFallback') }));
      setPushToReceiptVisible(false);
      setPushToReceiptOrder(null);
      setPushToReceiptQuantities({});
      setPushToReceiptBatchNumbers({});
      setPushToReceiptWarehouseId(undefined);
      setPushToReceiptWarehouseOptions([]);
      setPushToReceiptLineWh({});
      setPushToReceiptLineLoc({});
      setPushToReceiptLineLocCode({});
      setPushToReceiptLocOptionsByWh({});
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (detailDrawerVisible && orderDetail?.id === pushToReceiptOrder.id) {
        getPurchaseOrder(pushToReceiptOrder.id).then(setOrderDetail);
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.purchaseOrder.pushReceiptFailed'));
    } finally {
      setPushToReceiptLoading(false);
    }
  };

  // 打开下推收货通知 Modal
  const handlePushToNotice = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      const items = (detail.items || []).filter((it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0);
      if (items.length === 0) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.allReceived'));
        return;
      }
      const quantities: Record<number, number> = {};
      items.forEach((it: PurchaseOrderItem) => {
        if (it.id != null) quantities[it.id] = Number(it.outstanding_quantity ?? 0);
      });
      setPushToNoticeOrder(detail as PurchaseOrderDetail);
      setPushToNoticeQuantities(quantities);
      setPushToNoticeVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.purchaseOrder.loadDetailFailed'));
    }
  };

  // 确认下推收货通知
  const handlePushToNoticeConfirm = async () => {
    if (!pushToNoticeOrder?.id) return;
    const items = (pushToNoticeOrder.items || []).filter((it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0);
    for (const it of items) {
      if (it.id == null) continue;
      const qty = pushToNoticeQuantities[it.id] ?? 0;
      const max = Number(it.outstanding_quantity ?? 0);
      if (qty <= 0) continue;
      if (qty > max) {
        messageApi.error(t('app.kuaizhizao.purchaseOrder.qtyExceedsNotice', { material: it.material_code || it.material_name, max }));
        return;
      }
    }
    setPushToNoticeLoading(true);
    try {
      const result = await pushPurchaseOrderToReceiptNotice(pushToNoticeOrder.id, pushToNoticeQuantities);
      messageApi.success(t('app.kuaizhizao.purchaseOrder.pushNoticeSuccess', { code: result.notice_code || t('app.kuaizhizao.purchaseOrder.createdFallback') }));
      setPushToNoticeVisible(false);
      setPushToNoticeOrder(null);
      setPushToNoticeQuantities({});
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (detailDrawerVisible && orderDetail?.id === pushToNoticeOrder.id) {
        getPurchaseOrder(pushToNoticeOrder.id).then(setOrderDetail);
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.purchaseOrder.pushNoticeFailed'));
    } finally {
      setPushToNoticeLoading(false);
    }
  };

  // 下推采购发票（直接调用，无需数量选择）
  const handlePushToInvoice = async (record: PurchaseOrder) => {
    setPushToInvoiceLoading(true);
    try {
      const result = await pushPurchaseOrderToInvoice(record.id!);
      messageApi.success(t('app.kuaizhizao.purchaseOrder.pushInvoiceSuccess', { code: result.invoice_code || t('app.kuaizhizao.purchaseOrder.createdFallback') }));
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (detailDrawerVisible && orderDetail?.id === record.id) {
        getPurchaseOrder(record.id!).then(setOrderDetail);
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.purchaseOrder.pushInvoiceFailed'));
    } finally {
      setPushToInvoiceLoading(false);
    }
  };

  const handlePushToReturn = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      const items = (detail.items || []).filter((it: PurchaseOrderItem) => Number(it.received_quantity ?? 0) > 0);
      if (items.length === 0) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.noReturnableQty'));
        return;
      }
      const quantities: Record<number, number> = {};
      items.forEach((it: PurchaseOrderItem) => {
        if (it.id != null) quantities[it.id] = Number(it.received_quantity ?? 0);
      });
      setPushToReturnOrder(detail as PurchaseOrderDetail);
      setPushToReturnQuantities(quantities);
      setPushToReturnVisible(true);
    } catch {
      messageApi.error(t('app.kuaizhizao.purchaseOrder.loadDetailFailed'));
    }
  };

  const handlePushToReturnConfirm = async () => {
    if (!pushToReturnOrder?.id) return;
    if (!pushToReturnWarehouseId || pushToReturnWarehouseId <= 0) {
      messageApi.warning(t('app.kuaizhizao.purchaseOrder.returnWarehouseRequired'));
      return;
    }
    const items = (pushToReturnOrder.items || []).filter((it: PurchaseOrderItem) => Number(it.received_quantity ?? 0) > 0);
    for (const it of items) {
      if (it.id == null) continue;
      const qty = pushToReturnQuantities[it.id] ?? 0;
      const max = Number(it.received_quantity ?? 0);
      if (qty <= 0) continue;
      if (qty > max) {
        messageApi.error(t('app.kuaizhizao.purchaseOrder.qtyExceedsReturnable', { material: it.material_code || it.material_name, max }));
        return;
      }
    }
    setPushToReturnLoading(true);
    try {
      const result = await pushPurchaseOrderToPurchaseReturn({
        purchase_order_id: pushToReturnOrder.id,
        warehouse_id: pushToReturnWarehouseId,
        warehouse_name: pushToReturnWarehouseName || undefined,
        return_quantities: pushToReturnQuantities,
      });
      messageApi.success(t('app.kuaizhizao.purchaseOrder.pushReturnSuccess', { code: result.return_code || t('app.kuaizhizao.purchaseOrder.createdFallback') }));
      setPushToReturnVisible(false);
      setPushToReturnOrder(null);
      setPushToReturnQuantities({});
      setPushToReturnWarehouseId(undefined);
      setPushToReturnWarehouseName('');
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (detailDrawerVisible && orderDetail?.id === pushToReturnOrder.id) {
        getPurchaseOrder(pushToReturnOrder.id).then(setOrderDetail);
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.purchaseOrder.pushReturnFailed'));
    } finally {
      setPushToReturnLoading(false);
    }
  };

  const selectedOrderForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return tableRowsRef.current.find((row) => row.id === id) ?? null;
  }, [selectedRowKeys]);

  const buildToolbarPushMenuItems = useCallback(
    (record: PurchaseOrder) => {
      const pushEnabled = isAuditedStatus(record.status);
      return buildUniPushMenuItems([
        {
          key: 'receipt-notice',
          label: pushToReceiptNoticeAction.label,
          icon: <FileTextOutlined />,
          disabled: !pushEnabled,
          onClick: () => {
            if (!pushEnabled) return;
            void handlePushToNotice(record);
          },
        },
        {
          key: 'receipt',
          label: pushToReceiptAction.label,
          icon: <InboxOutlined />,
          disabled: !pushEnabled,
          onClick: () => {
            if (!pushEnabled) return;
            void handlePushToReceipt(record);
          },
        },
        {
          key: 'invoice',
          label: pushToInvoiceAction.label,
          icon: <FileTextOutlined />,
          disabled: !pushEnabled,
          onClick: () => {
            if (!pushEnabled) return;
            void handlePushToInvoice(record);
          },
        },
        {
          key: 'purchase-return',
          label: pushToPurchaseReturnAction.label,
          icon: <RollbackOutlined />,
          disabled: !pushEnabled,
          onClick: () => {
            if (!pushEnabled) return;
            void handlePushToReturn(record);
          },
        },
      ]);
    },
    [
      handlePushToInvoice,
      handlePushToNotice,
      handlePushToReceipt,
      handlePushToReturn,
      pushToInvoiceAction.label,
      pushToPurchaseReturnAction.label,
      pushToReceiptAction.label,
      pushToReceiptNoticeAction.label,
    ],
  );

  const toolbarPushMenuItems = useMemo(
    () => (selectedOrderForToolbar ? buildToolbarPushMenuItems(selectedOrderForToolbar) : []),
    [buildToolbarPushMenuItems, selectedOrderForToolbar],
  );

  const canUseToolbarPush =
    !!selectedOrderForToolbar &&
    isAuditedStatus(selectedOrderForToolbar.status) &&
    toolbarPushMenuItems.some((it) => (it as { type?: string; disabled?: boolean }).type !== 'divider' && !(it as { disabled?: boolean }).disabled);

  // 处理删除
  const handleDelete = async (record: PurchaseOrder) => {
    Modal.confirm({
      title: t('app.kuaizhizao.purchaseOrder.deleteTitle'),
      content: t('app.kuaizhizao.purchaseOrder.deleteContent', { code: record.order_code }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deletePurchaseOrder(record.id!);
          messageApi.success(t('app.kuaizhizao.purchaseOrder.deleteSuccess'));
          invalidateStatistics();
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.purchaseOrder.deleteFailed'));
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    try {
      for (const k of keys) {
        await deletePurchaseOrder(Number(k));
      }
      messageApi.success(t('app.kuaizhizao.purchaseOrder.batchDeleteSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      invalidateStatistics();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.purchaseOrder.batchDeleteFailed'));
    }
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload: Partial<PurchaseOrder> = {
          order_date: row.order_date || row.orderDate,
          delivery_date: row.delivery_date || row.deliveryDate,
          supplier_id: row.supplier_id ?? row.supplierId,
          supplier_name: row.supplier_name || row.supplierName,
          total_amount: row.total_amount ?? row.totalAmount,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await createPurchaseOrder(payload);
        successCount += 1;
      }
      messageApi.success(t('app.kuaizhizao.purchaseOrder.syncSuccess', { count: successCount }));
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.purchaseOrder.syncFailed'));
    }
  };

  const handleListImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.kuaizhizao.purchaseOrder.importEmpty'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''));

    if (rows.length === 0) {
      messageApi.warning(t('app.kuaizhizao.purchaseOrder.importNoRows'));
      return;
    }

    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      purchaseOrderImportTemplate.importHeaderMap,
    );
    const idx = {
      code: headerIndexMap['code'] ?? -1,
      supplier: headerIndexMap['supplier'] ?? -1,
      date: headerIndexMap['date'] ?? -1,
      material: headerIndexMap['material'] ?? -1,
      qty: headerIndexMap['quantity'] ?? -1,
      price: headerIndexMap['unitPrice'] ?? -1,
      delivery: headerIndexMap['delivery'] ?? -1,
      notes: headerIndexMap['notes'] ?? -1,
    };

    if (idx.supplier < 0 || idx.date < 0 || idx.material < 0 || idx.qty < 0) {
      messageApi.error(t('app.kuaizhizao.purchaseOrder.importMissingColumns'));
      return;
    }

    const [matRes, _] = await Promise.all([
      apiRequest<unknown>('/apps/master-data/materials', { params: { limit: 5000, is_active: true } }),
      Promise.resolve(),
    ]);
    const matList = Array.isArray(matRes) ? matRes : (matRes as any)?.data ?? (matRes as any)?.items ?? [];

    const errors: Array<{ row: number; message: string }> = [];
    const groupMap = new Map<string, { code?: string; supplier: string; date: string; items: any[] }>();

    rows.forEach((row: any[], i: number) => {
      const rowNum = i + 3;
      const supplierName = (row[idx.supplier] ?? '').toString().trim();
      const dateVal = (row[idx.date] ?? '').toString().trim();
      const materialCode = (row[idx.material] ?? '').toString().trim();
      const qtyVal = row[idx.qty];
      const qty = Number(qtyVal);
      if (!supplierName) {
        errors.push({ row: rowNum, message: t('app.kuaizhizao.purchaseOrder.importRowSupplierRequired') });
        return;
      }
      if (!dateVal) {
        errors.push({ row: rowNum, message: t('app.kuaizhizao.purchaseOrder.importRowOrderDateRequired') });
        return;
      }
      if (!materialCode) {
        errors.push({ row: rowNum, message: t('app.kuaizhizao.purchaseOrder.importRowMaterialRequired') });
        return;
      }
      if (isNaN(qty) || qty <= 0) {
        errors.push({ row: rowNum, message: t('app.kuaizhizao.purchaseOrder.importRowQtyRequired') });
        return;
      }

      const mat = (Array.isArray(matList) ? matList : []).find((m: any) => (m.mainCode || m.code || '').toUpperCase() === materialCode.toUpperCase());
      if (!mat) {
        errors.push({ row: rowNum, message: t('app.kuaizhizao.purchaseOrder.importRowMaterialNotFound', { code: materialCode }) });
        return;
      }

      const code = idx.code >= 0 ? (row[idx.code] ?? '').toString().trim() : '';
      const price = idx.price >= 0 ? (Number(row[idx.price]) || 0) : 0;
      const delivery = idx.delivery >= 0 ? (row[idx.delivery] ?? '').toString().trim() : undefined;
      const notes = idx.notes >= 0 ? (row[idx.notes] ?? '').toString().trim() : undefined;

      const groupKey = code || `${supplierName}|${dateVal}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { code: code || undefined, supplier: supplierName, date: dateVal, items: [] });
      }
      const g = groupMap.get(groupKey)!;
      g.items.push({
        material_id: mat.id,
        material_code: mat.mainCode || mat.code,
        material_name: mat.name,
        material_spec: mat.specification || '',
        unit: mat.baseUnit || '件',
        ordered_quantity: qty,
        unit_price: price,
        required_date: delivery || undefined,
        notes: notes || undefined,
      });
    });

    if (errors.length > 0) {
      Modal.warning({
        title: t('app.kuaizhizao.purchaseOrder.importValidationTitle'),
        width: 600,
        content: (
          <div>
            <p>{t('app.kuaizhizao.purchaseOrder.importValidationIntro')}</p>
            <List size="small" dataSource={errors} renderItem={(item) => (
              <List.Item><Typography.Text type="danger">{t('app.kuaizhizao.purchaseOrder.importRowError', { row: item.row, message: item.message })}</Typography.Text></List.Item>
            )} />
          </div>
        ),
      });
      return;
    }

    const toImport: Partial<PurchaseOrder>[] = [];
    groupMap.forEach((g) => {
      const supp = supplierList.find((s: any) => ((s.name || s.code || '').trim() === g.supplier.trim()) || ((s.supplier_name || '').trim() === g.supplier.trim()));
      toImport.push({
        order_code: g.code,
        order_date: g.date,
        supplier_id: supp?.id,
        supplier_name: g.supplier,
        status: '草稿',
        items: g.items,
      });
    });

    if (toImport.length === 0) {
      messageApi.warning(t('app.kuaizhizao.purchaseOrder.importNoData'));
      return;
    }

    try {
      const result = await batchImport({
        items: toImport,
        importFn: async (item) => createPurchaseOrder(item),
        title: t('app.kuaizhizao.purchaseOrder.importingTitle'),
        concurrency: 3,
      });

      if (result.failureCount > 0) {
        Modal.warning({
          title: t('app.kuaizhizao.purchaseOrder.importPartialTitle'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('app.kuaizhizao.purchaseOrder.importPartialSummary', { success: result.successCount, failed: result.failureCount })}</strong></p>
              {result.errors.length > 0 && (
                <List size="small" dataSource={result.errors} renderItem={(e) => (
                  <List.Item><Typography.Text type="danger">{t('app.kuaizhizao.purchaseOrder.importPartialRowError', { row: e.row, error: e.error })}</Typography.Text></List.Item>
                )} />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.kuaizhizao.purchaseOrder.importSuccess', { count: result.successCount }));
      }
      if (result.successCount > 0) {
        invalidateStatistics();
        invalidateMenuBadgeCounts();

        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.purchaseOrder.importFailed'));
    }
  };

  async function initPurchaseOrderEditForm(orderId: number) {
    try {
      const detail = await getPurchaseOrder(orderId);
      setIsEdit(true);
      setCurrentOrder(detail);
      const items = (detail.items || []).map((it: any) => ({
        material_id: it.material_id ?? it.materialId,
        material_code: it.material_code || it.materialCode || '',
        material_name: it.material_name || it.materialName || '',
        material_spec: it.material_spec || '',
        unit: it.unit || '件',
        ordered_quantity: Number(it.ordered_quantity ?? it.orderedQuantity) || 0,
        unit_price: Number(it.unit_price ?? it.unitPrice) || 0,
        tax_rate: 0,
        required_date: it.required_date || it.requiredDate ? dayjs(it.required_date || it.requiredDate) : undefined,
      }));
      window.setTimeout(() => {
        formRef.current?.setFieldsValue({
          order_code: detail.order_code,
          supplier_id: detail.supplier_id,
          supplier_name: detail.supplier_name,
          supplier_contact: detail.supplier_contact,
          supplier_phone: detail.supplier_phone,
          order_date: detail.order_date,
          delivery_date: detail.delivery_date,
          order_type: detail.order_type || '标准采购',
          price_type: 'tax_exclusive',
          buyer_id: detail.buyer_id,
          buyer_name: detail.buyer_name,
          notes: detail.notes,
          attachments: (detail as any).attachments || [],
          fee_details: (detail as any).fee_details || [],
          items: items.length > 0 ? items : [defaultOrderItem],
        });
        loadPurchaseOrderFormFieldValues(orderId).then((fieldFormValues) => {
          formRef.current?.setFieldsValue(fieldFormValues);
        });
      }, 100);
    } catch {
      messageApi.error(t('app.kuaizhizao.purchaseOrder.detailFailed'));
      navigate(PURCHASE_ORDER_LIST_PATH);
    }
  }

  function initPurchaseOrderCreateForm() {
    setIsEdit(false);
    setCurrentOrder(null);
    resetPurchaseOrderFormFieldValues();
    formRef.current?.resetFields();
    window.setTimeout(() => {
      formRef.current?.setFieldsValue({ items: [defaultOrderItem], price_type: 'tax_exclusive' });
    }, 0);
  }

  const handleEdit = (record: PurchaseOrder) => {
    if (!record.id) return;
    navigate(purchaseOrderEditPath(record.id));
  };

  const handleCreate = () => {
    navigate(PURCHASE_ORDER_CREATE_PATH);
  };

  useEffect(() => {
    if (!isFormPage) {
      formPageInitializedRef.current = false;
      return;
    }
    const titleKey = isCreatePage
      ? 'app.kuaizhizao.menu.purchase-management.purchase-orders.new'
      : 'app.kuaizhizao.menu.purchase-management.purchase-orders.edit';
    const title = t(titleKey);
    const sp = new URLSearchParams(location.search || '');
    sp.delete('_refresh');
    const cleanSearch = sp.toString();
    const tabKey = location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
    setCustomPageTitle(location.pathname, title);
    setCustomPageTitle(tabKey, title);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, path: location.pathname, title },
      }),
    );
    return () => {
      removeCustomPageTitle(location.pathname);
      removeCustomPageTitle(tabKey);
    };
  }, [isFormPage, isCreatePage, location.pathname, location.search, t]);

  useEffect(() => {
    if (!isFormPage || formPageInitializedRef.current) return;
    formPageInitializedRef.current = true;
    if (isCreatePage) {
      initPurchaseOrderCreateForm();
    } else if (editRouteId) {
      void initPurchaseOrderEditForm(editRouteId);
    }
  }, [isFormPage, isCreatePage, editRouteId]);

  const pullFromRequisitionQuery = useUniPullQuery<PullPurchaseRequisitionLineCandidate>({
    rowKey: 'key',
    selectionType: 'checkbox',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const result = await listPurchaseRequisitions({
          skip: 0,
          limit: 30,
          keyword: keyword.trim() || undefined,
        });
        const rows: PurchaseRequisition[] = Array.isArray(result) ? result : (result as any).data || [];
        const details = await Promise.all(
          rows
            .filter((row) => row.id && row.requisition_code)
            .slice(0, 30)
            .map(async (row) => {
              try {
                const detail = await getPurchaseRequisition(Number(row.id));
                const status = detail.status || '';
                const canUseStatus = ['已通过', '部分转单', '全部转单'].includes(status);
                if (!canUseStatus) return [] as PullPurchaseRequisitionLineCandidate[];
                return (detail.items || [])
                  .filter((item) => item.id != null)
                  .map((item) => ({
                    key: `${detail.id}-${item.id}`,
                    requisition_id: Number(detail.id),
                    requisition_code: detail.requisition_code || '',
                    requisition_name: detail.requisition_name || '',
                    applicant_name: detail.applicant_name || '',
                    requisition_date: detail.requisition_date || '',
                    requisition_status: status,
                    review_status: detail.review_status || '',
                    item_id: Number(item.id),
                    material_code: item.material_code || '',
                    material_name: item.material_name || '',
                    material_spec: item.material_spec || '',
                    unit: item.unit || '',
                    quantity: Number(item.quantity || 0),
                    required_date: item.required_date || detail.required_date || '',
                    supplier_id: item.supplier_id ?? undefined,
                    supplier_name: undefined,
                    purchase_order_id: item.purchase_order_id ?? undefined,
                    converted: !!item.purchase_order_id,
                  }));
              } catch {
                return [] as PullPurchaseRequisitionLineCandidate[];
              }
            }),
        );
        const all = details.flat();
        const start = (page - 1) * pageSize;
        return { data: all.slice(start, start + pageSize), total: all.length };
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaizhizao.purchaseOrder.loadRequisitionListFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => record.converted,
    onConfirm: async (keys, rows) => {
      const selectedLines = rows.filter((line) => keys.includes(line.key));
      if (!selectedLines.length) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.selectRequisitionLinesFirst'));
        return;
      }
      try {
        const grouped = selectedLines.reduce<Record<number, PullPurchaseRequisitionLineCandidate[]>>((acc, line) => {
          if (!acc[line.requisition_id]) acc[line.requisition_id] = [];
          acc[line.requisition_id].push(line);
          return acc;
        }, {});
        const createdCodes: string[] = [];
        for (const [ridText, lines] of Object.entries(grouped)) {
          const requisitionId = Number(ridText);
          const itemIds = lines.map((line) => line.item_id);
          const itemQuantities = Object.fromEntries(lines.map((line) => [line.item_id, Number(line.quantity || 0)]));
          const itemSuppliers = Object.fromEntries(
            lines.filter((line) => line.supplier_id != null).map((line) => [line.item_id, Number(line.supplier_id)]),
          );
          const res = await convertToPurchaseOrder(requisitionId, {
            item_ids: itemIds,
            item_quantities: itemQuantities,
            item_suppliers: itemSuppliers,
          });
          if (res.purchase_orders?.length) {
            res.purchase_orders.forEach((po) => {
              if (po.purchase_order_code) createdCodes.push(po.purchase_order_code);
            });
          } else if (res.purchase_order_code) {
            createdCodes.push(res.purchase_order_code);
          }
        }
        messageApi.success(t('app.kuaizhizao.purchaseOrder.createdFromRequisition', { target: pullFromRequisitionAction.targetLabel, codes: createdCodes.join('、') }));
        invalidateMenuBadgeCounts();
        invalidateStatistics();
        actionRef.current?.reload();
        pullFromRequisitionQuery.closeModal();
      } catch (error: any) {
        messageApi.error(error?.response?.data?.detail || error?.message || t('app.kuaizhizao.purchaseOrder.createFromRequisitionFailed', { source: pullFromRequisitionAction.sourceLabel, target: pullFromRequisitionAction.targetLabel }));
      }
    },
  });

  const pullFromInquiryQuery = useUniPullQuery<PullPurchaseInquiryLineCandidate>({
    rowKey: 'key',
    selectionType: 'checkbox',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const result = await listPurchaseInquiries({
          skip: 0,
          limit: 30,
          keyword: keyword.trim() || undefined,
        });
        const rows: PurchaseInquiry[] = Array.isArray(result) ? result : (result as any).data || [];
        const details = await Promise.all(
          rows
            .filter((row) => row.id && row.inquiry_code)
            .slice(0, 30)
            .map(async (row) => {
              try {
                const detail = await getPurchaseInquiry(Number(row.id));
                const status = detail.status || '';
                const canUseStatus =
                  status === 'AWARDED' ||
                  status === '已定标' ||
                  status === '部分转单' ||
                  status === 'PARTIALLY_CONVERTED';
                if (!canUseStatus) return [] as PullPurchaseInquiryLineCandidate[];
                return (detail.items || [])
                  .filter((item) => item.id != null)
                  .map((item) => {
                    const converted = !!item.purchase_order_id || !item.awarded_supplier_id;
                    return {
                      key: `${detail.id}-${item.id}`,
                      inquiry_id: Number(detail.id),
                      inquiry_code: detail.inquiry_code || '',
                      inquiry_name: detail.inquiry_name || '',
                      buyer_name: detail.buyer_name || '',
                      inquiry_date: detail.inquiry_date || '',
                      inquiry_status: status,
                      review_status: detail.review_status || '',
                      item_id: Number(item.id),
                      material_code: item.material_code || '',
                      material_name: item.material_name || '',
                      material_spec: item.material_spec || '',
                      unit: item.unit || '',
                      quantity: Number(item.quantity || 0),
                      required_date: item.required_date || '',
                      supplier_id: item.awarded_supplier_id ?? undefined,
                      supplier_name: undefined,
                      purchase_order_id: item.purchase_order_id ?? undefined,
                      converted,
                    } satisfies PullPurchaseInquiryLineCandidate;
                  });
              } catch {
                return [] as PullPurchaseInquiryLineCandidate[];
              }
            }),
        );
        const all = details.flat();
        const start = (page - 1) * pageSize;
        return { data: all.slice(start, start + pageSize), total: all.length };
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaizhizao.purchaseOrder.loadRequisitionListFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => record.converted,
    onConfirm: async (keys, rows) => {
      const selectedLines = rows.filter((line) => keys.includes(line.key));
      if (!selectedLines.length) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.selectRequisitionLinesFirst'));
        return;
      }
      try {
        const grouped = selectedLines.reduce<Record<number, PullPurchaseInquiryLineCandidate[]>>((acc, line) => {
          if (!acc[line.inquiry_id]) acc[line.inquiry_id] = [];
          acc[line.inquiry_id].push(line);
          return acc;
        }, {});
        const createdCodes: string[] = [];
        for (const [inquiryIdText, lines] of Object.entries(grouped)) {
          const inquiryId = Number(inquiryIdText);
          const res = await pullPurchaseOrderFromInquiry({
            inquiry_id: inquiryId,
            item_ids: lines.map((line) => line.item_id),
          });
          if (res.purchase_orders?.length) {
            res.purchase_orders.forEach((po) => {
              if (po.purchase_order_code) createdCodes.push(po.purchase_order_code);
            });
          }
        }
        messageApi.success(
          t('app.kuaizhizao.purchaseOrder.createdFromRequisition', {
            target: pullFromInquiryAction.targetLabel,
            codes: createdCodes.join('、'),
          }),
        );
        invalidateMenuBadgeCounts();
        invalidateStatistics();
        actionRef.current?.reload();
        pullFromInquiryQuery.closeModal();
      } catch (error: any) {
        messageApi.error(
          error?.response?.data?.detail ||
            error?.message ||
            t('app.kuaizhizao.purchaseOrder.createFromRequisitionFailed', {
              source: pullFromInquiryAction.sourceLabel,
              target: pullFromInquiryAction.targetLabel,
            }),
        );
      }
    },
  });

  // 处理表单提交（创建/更新）
  const handleFormSubmit = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractPurchaseOrderFormValues(values);
      Object.keys(values).forEach((key) => {
        if (key.startsWith('custom_')) delete values[key];
      });
      Object.assign(values, standardValues);

      const normalizedItems = normalizeFormListItems<any>(values.items);
      const validItems = normalizedItems.filter(
        (it: any) => it.material_id && (Number(it.ordered_quantity) || 0) > 0
      );
      if (!validItems.length) {
        messageApi.error(t('app.kuaizhizao.purchaseOrder.atLeastOneItem'));
        throw new Error(t('app.kuaizhizao.purchaseOrder.atLeastOneItem'));
      }

      const data = { ...values };
      // 处理附件
      const formAttachments = data.attachments || [];
      data.attachments = formAttachments.map((f: any) => {
        if (f.response) {
          if (Array.isArray(f.response) && f.response.length > 0) {
            return { uid: f.response[0].uuid, name: f.response[0].original_name, status: 'done', url: getFileDownloadUrl(f.response[0].uuid) };
          }
          if (f.response.uuid) {
            return { uid: f.response.uuid, name: f.response.original_name, status: 'done', url: getFileDownloadUrl(f.response.uuid) };
          }
        }
        return { uid: f.uid, name: f.name, status: 'done', url: f.url };
      });

      const priceType = data.price_type ?? 'tax_exclusive';
      data.currency = data.currency || 'CNY';

      const itemsPayload = validItems.map((it: any) => {
        const qty = Number(it.ordered_quantity) || 0;
        let price = Number(it.unit_price) || 0;
        const taxRate = Number(it.tax_rate) || 0;
        if (priceType === 'tax_inclusive' && price > 0 && taxRate >= 0) {
          price = price / (1 + taxRate / 100);
        }
        const reqDate = it.required_date;
        const dateStr = reqDate ? (dayjs.isDayjs(reqDate) ? reqDate.format('YYYY-MM-DD') : String(reqDate).slice(0, 10)) : undefined;
        if (!dateStr) {
          messageApi.error(t('app.kuaizhizao.purchaseOrder.lineRequiredDateMissing', { row: validItems.indexOf(it) + 1 }));
          throw new Error(t('app.kuaizhizao.purchaseOrder.form.requiredDateRequired'));
        }
        const totalPrice = qty * price;
        return {
          material_id: Number(it.material_id),
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec || null,
          ordered_quantity: qty,
          unit: it.unit || '件',
          unit_price: price,
          total_price: totalPrice,
          received_quantity: 0,
          outstanding_quantity: qty,
          required_date: dateStr,
          inspection_required: true,
          notes: it.notes || null,
        };
      });

      const totalAmount = itemsPayload.reduce((s: number, it: any) => s + Number(it.total_price), 0);
      const firstTaxRate = validItems[0] ? Number(validItems[0].tax_rate) || 0 : 0;
      data.tax_rate = priceType === 'tax_inclusive' ? (firstTaxRate > 1 ? firstTaxRate / 100 : firstTaxRate) : 0;
      data.tax_amount = totalAmount * data.tax_rate;
      data.net_amount = totalAmount + data.tax_amount;

      // 计算费用总额
      const feeDetails = normalizeFormListItems<any>(values.fee_details);
      const totalFeeAmount = feeDetails.reduce((sum: number, fee: any) => {
        return sum + (Number(fee.amount) || 0);
      }, 0);
      data.total_fee_amount = totalFeeAmount;
      data.fee_details = feeDetails;

      let orderId: number | undefined;
      if (isEdit && currentOrder?.id) {
        await updatePurchaseOrder(currentOrder.id, { ...data, items: itemsPayload });
        orderId = currentOrder.id;
        if (!submitAfterSaveRef.current) {
          messageApi.success(t('app.kuaizhizao.purchaseOrder.updateSuccess'));
        }
      } else {
        const created = await createPurchaseOrder({ ...data, items: itemsPayload });
        orderId = (created as any)?.id;
        if (!submitAfterSaveRef.current) {
          messageApi.success(t('app.kuaizhizao.purchaseOrder.createSuccess'));
        }
      }

      if (orderId != null) {
        await savePurchaseOrderCustomFieldValues(orderId, customData);
      }

      if (submitAfterSaveRef.current && orderId) {
        try {
          const afterSubmit = await submitPurchaseOrder(orderId);
          const st = (afterSubmit as PurchaseOrder | undefined)?.status;
          if (isAuditedStatus(st)) {
            messageApi.success(isEdit ? t('app.kuaizhizao.purchaseOrder.saveSubmitAutoApproved') : t('app.kuaizhizao.purchaseOrder.createSubmitAutoApproved'));
          } else {
            messageApi.success(isEdit ? t('app.kuaizhizao.purchaseOrder.saveSubmitPending') : t('app.kuaizhizao.purchaseOrder.createSubmitPending'));
          }
        } catch (submitErr: any) {
          messageApi.warning(t('app.kuaizhizao.purchaseOrder.saveSubmitFailed', { message: submitErr?.message || t('common.operationFailed') }));
        }
        submitAfterSaveRef.current = false;
      }

      if (isFormPage) {
        navigate(PURCHASE_ORDER_LIST_PATH);
      } else {
        setModalVisible(false);
      }
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      submitAfterSaveRef.current = false;
      if (error?.message && !error.message.includes(t('app.kuaizhizao.purchaseOrder.atLeastOneItem')) && !error.message.includes(t('app.kuaizhizao.purchaseOrder.form.requiredDateRequired'))) {
        messageApi.error(error.message || t('common.operationFailed'));
      }
      throw error;
    }
  };

  // 详情列定义
  const detailColumns: ProDescriptionsItemProps<PurchaseOrderDetail>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.purchaseOrder.col.orderCode'),
      dataIndex: 'order_code',
      render: (_: unknown, entity: PurchaseOrderDetail) => (
        <Typography.Text copyable={{ text: String(entity.order_code ?? '') }}>{entity.order_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.supplier'),
      dataIndex: 'supplier_name',
      render: (_: unknown, entity: PurchaseOrderDetail) => entity.supplier_name ?? '—',
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.orderType'),
      dataIndex: 'order_type',
      render: (_: unknown, entity: PurchaseOrderDetail) =>
        resolveSystemDictionaryItemLabel(
          'ORDER_TYPE',
          { value: entity.order_type ?? '', label: entity.order_type ?? '', is_system_managed: true },
          t,
        ) || '—',
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.orderDate'),
      dataIndex: 'order_date',
      valueType: 'date',
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.deliveryDate'),
      dataIndex: 'delivery_date',
      valueType: 'date',
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      render: (status: any) => {
        const config = getStatusDisplay(status);
        return <Tag {...resolveStatusTagDisplayProps(config)}>{config.text}</Tag> as any;
      },
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.reviewStatus'),
      dataIndex: 'review_status',
      render: (status: any) => {
        const config = getReviewStatusDisplay(status);
        return <Tag color={config.color}>{config.text}</Tag> as any;
      },
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.orderAmount'),
      dataIndex: 'total_amount',
      render: (text: any) => `¥${formatAmount(text)}`,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.taxRate'),
      dataIndex: 'tax_rate',
      render: (text: any) => text ? `${text}%` : '-',
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.taxAmount'),
      dataIndex: 'tax_amount',
      render: (text: any) => (text != null && text !== '') ? `¥${formatAmount(text)}` : '-',
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.inclAmount'),
      dataIndex: 'net_amount',
      render: (text: any) => (text != null && text !== '') ? `¥${formatAmount(text)}` : '-',
    },
  ], [t]);

  const detailNotesColumn: ProDescriptionsItemProps<PurchaseOrderDetail> = useMemo(() => ({
    title: t('app.kuaizhizao.common.fieldNotes'),
    dataIndex: 'notes',
    span: 3,
    render: (text: any) => text || '-',
  }), [t]);

  const statCards: StatCard[] = statistics
    ? [
        {
          title: t('app.kuaizhizao.purchase.statArrivalRate'),
          value: statistics.monthly_arrival_rate ?? 0,
          suffix: '%',
          valueStyle: { color: token.colorPrimary },
          description: (
            <div style={{ color: '#52c41a' }}>
              {t('app.kuaizhizao.purchase.statDeltaVsYesterday')}
            </div>
          ),
          backgroundChart: (
            <SimpleSparkline
              data={statistics?.trends?.arrival_rate || [...PO_STAT_SPARKLINE_ARRIVAL]}
              color={token.colorPrimary}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.purchase.statPendingReview'),
          value: statistics.pending_review_count ?? 0,
          valueStyle: (statistics.pending_review_count ?? 0) > 0 ? { color: '#faad14' } : undefined,
          description:
            (statistics.pending_review_count ?? 0) > 0
              ? t('app.kuaizhizao.purchase.statNeedImmediateReview')
              : t('app.kuaizhizao.purchase.statNothingPending'),
          onClick:
            (statistics.pending_review_count ?? 0) > 0
              ? () => {
                  tableSearchFormRef.current?.setFieldsValue?.({ status: 'PENDING_REVIEW' });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
        {
          title: t('app.kuaizhizao.purchase.statAnnualTotal'),
          value: statistics.annual_total_amount ?? 0,
          prefix: '¥',
          precision: 2,
          valueStyle: { color: '#2f54eb' },
          description: (
            <div style={{ color: (statistics as any).annual_total_yoy >= 0 ? '#52c41a' : '#ff4d4f' }}>
              {t('app.kuaizhizao.purchase.statVsLastYear', {
                value: (statistics as any).annual_total_yoy
                  ? `${(statistics as any).annual_total_yoy > 0 ? '+' : ''}${(statistics as any).annual_total_yoy}%`
                  : '+0%',
              })}
            </div>
          ),
          backgroundChart: (
            <SimpleSparkline
              data={statistics?.trends?.annual_total || [...PO_STAT_SPARKLINE_ANNUAL]}
              color="#2f54eb"
            />
          ),
        },
        {
          title: t('app.kuaizhizao.purchase.statSupplierOnTime'),
          value: statistics.supplier_on_time_rate ?? 0,
          suffix: '%',
          valueStyle: { color: '#52c41a' },
          backgroundChart: (
            <SimpleSparkline data={PO_STAT_SPARKLINE_SUPPLIER} color="#52c41a" />
          ),
        },
        {
          title: t('app.kuaizhizao.purchase.statOverdue'),
          value: statistics.overdue_count ?? 0,
          valueStyle: (statistics.overdue_count ?? 0) > 0 ? { color: token.colorError } : undefined,
          description: (statistics.overdue_count ?? 0) > 0 ? (
            <div style={{ color: token.colorError }}>
              {t('app.kuaizhizao.purchase.statOverdueAmount', {
                amount: ((statistics.overdue_count ?? 0) * 1200).toLocaleString(),
              })}
            </div>
          ) : null,
          backgroundChart: (
            <SimpleSparkline
              data={PO_STAT_SPARKLINE_OVERDUE}
              color={token.colorError}
            />
          ),
        },
      ]
    : [
        {
          title: t('app.kuaizhizao.purchase.statArrivalRate'),
          value: 0,
          suffix: '%',
          valueStyle: { color: token.colorPrimary },
        },
        {
          title: t('app.kuaizhizao.purchase.statPendingReview'),
          value: 0,
        },
        {
          title: t('app.kuaizhizao.purchase.statAnnualTotal'),
          value: 0,
          prefix: '¥',
          precision: 2,
          valueStyle: { color: '#2f54eb' },
        },
        {
          title: t('app.kuaizhizao.purchase.statSupplierOnTime'),
          value: 0,
          suffix: '%',
          valueStyle: { color: '#52c41a' },
        },
        {
          title: t('app.kuaizhizao.purchase.statOverdue'),
          value: 0,
        },
      ];

  const triggerPurchaseOrderPrimarySubmit = useCallback(async () => {
    try {
      await formRef.current?.validateFields();
      submitAfterSaveRef.current = !!(
        isCreatePage || (isEditPage && isDraftStatus(currentOrder?.status))
      );
      formRef.current?.submit();
    } catch (err: any) {
      if (err?.errorFields?.length) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.fillRequiredBeforeSubmit'));
      }
    }
  }, [currentOrder?.status, isCreatePage, isEditPage, messageApi, t]);

  const handleSaveDraft = useCallback(async () => {
    try {
      await formRef.current?.validateFields();
      submitAfterSaveRef.current = false;
      formRef.current?.submit();
    } catch (err: any) {
      if (err?.errorFields?.length) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.fillRequiredBeforeSubmit'));
      }
    }
  }, [messageApi, t]);

  useSubmitShortcut(() => void triggerPurchaseOrderPrimarySubmit(), isFormPage);

  const purchaseOrderFormItemContent = (
    <>
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-purchase-order"
              name="order_code"
              label={t('app.kuaizhizao.purchaseOrder.form.orderCode')}
              required={true}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
              disabled={isEdit}
              context={{}}
            />
          </Col>
          <Col span={6}>
            <ProFormDatePicker
              name="order_date"
              label={t('app.kuaizhizao.purchaseOrder.form.orderDate')}
              placeholder={t('app.kuaizhizao.purchaseOrder.form.orderDateRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.purchaseOrder.form.orderDateRequired') }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={6}>
            <ProFormDatePicker
              name="delivery_date"
              label={t('app.kuaizhizao.purchaseOrder.form.requiredDate')}
              placeholder={t('app.kuaizhizao.purchaseOrder.form.requiredDateRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.purchaseOrder.form.requiredDateRequired') }]}
              fieldProps={buildFutureDateShortcutFieldProps({
                getForm: () => formRef.current,
                fieldName: 'delivery_date',
                baseFieldName: 'order_date',
                t,
              })}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProForm.Item
              name="supplier_id"
              label={t('app.kuaizhizao.purchaseOrder.form.supplier')}
              rules={[{ required: true, message: t('app.kuaizhizao.purchaseOrder.form.supplierRequired') }]}
            >
              <SupplierSelectDropdown
                placeholder={t('app.kuaizhizao.purchaseOrder.form.supplierRequired')}
                style={{ width: '100%' }}
                suppliers={supplierList}
                loading={suppliersLoading}
                onSuppliersChange={setSupplierList}
                autoLoad={false}
                onSupplierPick={(s) => {
                  if (s) {
                    formRef.current?.setFieldsValue({
                      supplier_name: s.name ?? (s as any).supplier_name,
                      supplier_contact: (s as any).contact_person ?? s.contactPerson ?? (s as any).supplier_contact,
                      supplier_phone: s.phone ?? (s as any).supplier_phone,
                      buyer_id: (s as any).buyerId || (s as any).buyer_id,
                      buyer_name: (s as any).buyerName || (s as any).buyer_name,
                    });
                  } else {
                    formRef.current?.setFieldsValue({
                      supplier_name: undefined,
                      supplier_contact: undefined,
                      supplier_phone: undefined,
                      buyer_id: undefined,
                      buyer_name: undefined,
                    });
                  }
                }}
              />
            </ProForm.Item>
          </Col>
          <Col span={6}>
            <ProFormText
              name="supplier_contact"
              label={t('app.kuaizhizao.purchaseOrder.form.contact')}
              placeholder={t('app.kuaizhizao.purchaseOrder.form.contactPlaceholder')}
            />
          </Col>
          <Col span={6}>
            <ProFormText
              name="supplier_phone"
              label={t('app.kuaizhizao.purchaseOrder.form.phone')}
              placeholder={t('app.kuaizhizao.purchaseOrder.form.phonePlaceholder')}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProForm.Item name="order_type" label={t('app.kuaizhizao.purchaseOrder.form.orderType')} initialValue="标准采购">
              <UniDropdown
                placeholder={t('app.kuaizhizao.purchaseOrder.form.orderTypePlaceholder')}
                options={orderTypeOptions}
                loading={orderTypeLoading}
              />
            </ProForm.Item>
          </Col>
          <Col span={6}>
            <ProForm.Item name="buyer_id" label={t('app.kuaizhizao.purchaseOrder.form.buyer')}>
              <UniDropdown
                placeholder={t('app.kuaizhizao.purchaseOrder.form.buyerPlaceholder')}
                showSearch
                allowClear
                loading={usersLoading}
                options={users.map(u => ({ label: u.full_name || u.username, value: u.id }))}
                onChange={(_val, opt: any) => {
                  formRef.current?.setFieldsValue({ buyer_name: opt?.label });
                }}
              />
            </ProForm.Item>
            <AntForm.Item name="buyer_name" hidden><Input /></AntForm.Item>
          </Col>
          <Col span={6}>
            <ProForm.Item name="currency" label={t('app.kuaizhizao.purchaseOrder.form.currency')} initialValue="CNY">
              <UniDropdown
                placeholder={t('app.kuaizhizao.purchaseOrder.form.currencyPlaceholder')}
                options={currencyOptions}
                loading={currencyLoading}
              />
            </ProForm.Item>
          </Col>
          <CustomFieldsFormSection
            customFields={purchaseOrderFormCustomFields}
            customFieldValues={purchaseOrderFormCustomFieldValues}
            gridColumns={4}
            embedInParentRow
          />
        </Row>

        <ProFormText name="price_type" hidden initialValue="tax_exclusive" />

        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.price_type !== curr?.price_type}>
          {({ getFieldValue: getFormValue }: any) => {
            const rawPriceType = getFormValue('price_type');
            const priceType = rawPriceType === 'tax_inclusive' ? 'tax_inclusive' : 'tax_exclusive';
            const showTaxColumns = priceType === 'tax_inclusive';
            return (
              <>
              <DocumentDetailTableStyles />
              <UniTableDetail
                name="items"
                title={t('app.kuaizhizao.purchaseOrder.form.itemsTitle')}
                required
                requiredMessage={t('app.kuaizhizao.purchaseOrder.form.itemsRequired')}
                leftExtra={(
                  <PriceTypeSwitch
                    checked={priceType === 'tax_inclusive'}
                    checkedChildren={t('app.kuaizhizao.purchaseOrder.form.taxIncl')}
                    unCheckedChildren={t('app.kuaizhizao.purchaseOrder.form.taxExcl')}
                    onChange={(nextChecked) => {
                      setFormPriceType(formRef.current, nextChecked ? 'tax_inclusive' : 'tax_exclusive');
                    }}
                  />
                )}
                headerExtra={(
                  <Space size={8}>
                    <Button
                      type="default"
                      icon={<ImportOutlined />}
                      onClick={() => setImportModalVisible(true)}
                    >
                      {t('app.kuaizhizao.purchaseOrder.form.importItems')}
                    </Button>
                    <Button
                      type="default"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const mainDelivery = formRef.current?.getFieldValue('delivery_date');
                        const defaultDate =
                          mainDelivery != null
                            ? dayjs.isDayjs(mainDelivery)
                              ? mainDelivery
                              : dayjs(mainDelivery)
                            : dayjs();
                        const items = [...normalizeFormListItems<any>(formRef.current?.getFieldValue('items'))];
                        items.push({
                          ...defaultOrderItem,
                          tax_rate: 0,
                          required_date: defaultDate,
                        });
                        formRef.current?.setFieldsValue({ items });
                      }}
                    >
                      {t('app.kuaizhizao.purchaseOrder.form.addLine')}
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
                columns={[
                {
                  title: t('app.kuaizhizao.purchaseOrder.form.material'),
                  dataIndex: 'material_id',
                  width: DOCUMENT_DETAIL_COL_WIDTH.material,
                  ...DOCUMENT_DETAIL_TEXT_COL,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                        {({ getFieldValue }: any) => {
                          const row = normalizeFormListItems<any>(getFieldValue('items'))[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback = mid && (row?.material_code || row?.material_name)
                            ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                            : undefined;
                          return (
                            <UniMaterialSelect
                              name={[index, 'material_id']}
                              label=""
                              placeholder={t('app.kuaizhizao.salesOrder.selectMaterial')}
                              required
                              size={DOCUMENT_DETAIL_CONTROL_SIZE}
                              listFieldKey={index}
                              listFieldName="items"
                              fillMapping={{
                                material_code: 'mainCode',
                                material_name: 'name',
                                material_spec: 'specification',
                                unit: 'baseUnit',
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
                    title: t('app.kuaizhizao.purchaseOrder.form.spec'),
                    dataIndex: 'material_spec',
                    width: DOCUMENT_DETAIL_COL_WIDTH.spec,
                    ...DOCUMENT_DETAIL_TEXT_COL,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                        <Input placeholder={t('app.kuaizhizao.purchaseOrder.form.spec')} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.purchaseOrder.form.unit'),
                    dataIndex: 'unit',
                    width: DOCUMENT_DETAIL_COL_WIDTH.unit,
                    ...DOCUMENT_DETAIL_TEXT_COL,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                        {({ getFieldValue }) => {
                          const materialId = getFieldValue(['items', index, 'material_id']);
                          return (
                            <AntForm.Item name={[index, 'unit']} style={{ margin: 0 }}>
                              <MaterialUnitSelect 
                                materialId={materialId} 
                                size={DOCUMENT_DETAIL_CONTROL_SIZE} 
                                noStyle 
                              />
                            </AntForm.Item>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.purchaseOrder.form.quantity'),
                    dataIndex: 'ordered_quantity',
                    width: DOCUMENT_DETAIL_COL_WIDTH.quantity,
                    ...DOCUMENT_DETAIL_NUM_COL,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'ordered_quantity']} rules={[{ required: true, message: t('common.required') }, { type: 'number', min: 0.01, message: t('app.kuaizhizao.salesOrder.quantityMinHint') }]} style={{ margin: 0 }}>
                        <InputNumber placeholder={t('app.kuaizhizao.purchaseOrder.form.quantity')} min={0} precision={2} style={{ width: '100%' }} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: showTaxColumns ? t('app.kuaizhizao.purchaseOrder.col.taxUnitPrice') : t('app.kuaizhizao.purchaseOrder.col.unitPrice'),
                    dataIndex: 'unit_price',
                    width: DOCUMENT_DETAIL_COL_WIDTH.unitPrice,
                    ...DOCUMENT_DETAIL_NUM_COL,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) =>
                          prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id ||
                          prev?.items?.[index]?.unit_price !== curr?.items?.[index]?.unit_price
                        }
                      >
                        {() => (
                          <AntForm.Item name={[index, 'unit_price']} rules={[{ required: true, message: t('common.required') }, { type: 'number', min: 0, message: t('app.kuaizhizao.purchaseOrder.form.gteZero') }]} style={{ margin: 0 }}>
                            <InputNumber
                              placeholder={showTaxColumns ? t('app.kuaizhizao.purchaseOrder.col.taxUnitPrice') : t('app.kuaizhizao.purchaseOrder.col.unitPrice')}
                              min={0}
                              precision={2}
                              prefix="¥"
                              style={{ width: '100%' }}
                              size={DOCUMENT_DETAIL_CONTROL_SIZE}
                            />
                          </AntForm.Item>
                        )}
                      </AntForm.Item>
                    ),
                  },
                  ...(showTaxColumns
                    ? [
                        {
                          title: t('app.kuaizhizao.purchaseOrder.col.exclAmount'),
                          width: DOCUMENT_DETAIL_COL_WIDTH.exclAmount,
                          ...DOCUMENT_DETAIL_NUM_COL,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                              {({ getFieldValue }: any) => {
                                const row = normalizeFormListItems<any>(getFieldValue('items'))[index];
                                const qty = Number(row?.ordered_quantity) || 0;
                                const price = Number(row?.unit_price) || 0;
                                const taxRate = Number(row?.tax_rate) || 0;
                                const exclAmt = price > 0 ? (qty * price) / (1 + taxRate / 100) : 0;
                                return <span>¥{exclAmt.toFixed(2)}</span>;
                              }}
                            </AntForm.Item>
                          ),
                        },
                        {
                          title: (
                            <TaxRateBatchColumnTitle
                              onBatch={() => {
                                const items = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));
                                if (items.length === 0) return;
                                const rate = prompt(t('app.kuaizhizao.salesOrder.taxRateBatch'), '13');
                                if (rate != null && rate !== '') {
                                  const num = Math.round(parseFloat(rate));
                                  if (!Number.isNaN(num) && num >= 0 && num <= 100) {
                                    const next = items.map((it: any) => ({ ...it, tax_rate: num }));
                                    formRef.current?.setFieldsValue({ items: next });
                                  }
                                }
                              }}
                            />
                          ),
                          dataIndex: 'tax_rate',
                          width: DOCUMENT_DETAIL_COL_WIDTH.taxRate,
                          ...DOCUMENT_DETAIL_NUM_COL,
                          onCell: () => ({ className: 'quotation-tax-rate-col' }),
                          render: (_: any, __: any, index: number) => <TaxRateDetailCell index={index} />,
                        },
                        {
                          title: t('app.kuaizhizao.purchaseOrder.col.taxAmount'),
                          width: DOCUMENT_DETAIL_COL_WIDTH.taxAmount,
                          ...DOCUMENT_DETAIL_NUM_COL,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                              {({ getFieldValue }: any) => {
                                const row = normalizeFormListItems<any>(getFieldValue('items'))[index];
                                const qty = Number(row?.ordered_quantity) || 0;
                                const price = Number(row?.unit_price) || 0;
                                const taxRate = Number(row?.tax_rate) || 0;
                                const exclAmt = price > 0 ? (qty * price) / (1 + taxRate / 100) : 0;
                                const taxAmt = exclAmt * (taxRate / 100);
                                return <span>¥{taxAmt.toFixed(2)}</span>;
                              }}
                            </AntForm.Item>
                          ),
                        },
                      ]
                    : []),
                  {
                    title: showTaxColumns ? t('app.kuaizhizao.purchaseOrder.col.inclTotal') : t('app.kuaizhizao.purchaseOrder.col.totalPrice'),
                    width: DOCUMENT_DETAIL_COL_WIDTH.lineAmount,
                    ...DOCUMENT_DETAIL_NUM_COL,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                        {({ getFieldValue }: any) => {
                          const row = normalizeFormListItems<any>(getFieldValue('items'))[index];
                          const qty = Number(row?.ordered_quantity) || 0;
                          const price = Number(row?.unit_price) || 0;
                          const taxRate = Number(row?.tax_rate) || 0;
                          const exclAmt = showTaxColumns && price > 0 ? (qty * price) / (1 + taxRate / 100) : qty * price;
                          const taxAmt = showTaxColumns ? exclAmt * (taxRate / 100) : 0;
                          const totalIncl = exclAmt + taxAmt;
                          return <span>¥{totalIncl.toFixed(2)}</span>;
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.purchaseOrder.col.requiredDelivery'),
                    dataIndex: 'required_date',
                    width: DOCUMENT_DETAIL_COL_WIDTH.deliveryDate,
                    ...DOCUMENT_DETAIL_TEXT_COL,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'required_date']} rules={[{ required: true, message: t('common.required') }]} style={{ margin: 0 }}>
                        <FutureDatePicker
                          size={DOCUMENT_DETAIL_CONTROL_SIZE}
                          style={DOCUMENT_DETAIL_DATE_PICKER_STYLE}
                          format="YYYY-MM-DD"
                          getForm={() => formRef.current}
                          baseFieldName="order_date"
                          t={t}
                          onApply={(date) =>
                            formRef.current?.setFieldValue?.(['items', index, 'required_date'], date)
                          }
                        />
                      </AntForm.Item>
                    ),
                  },
                ]}
                disabledAdd
                minRows={1}
                initialValue={{ ...defaultOrderItem, tax_rate: 0, required_date: dayjs() }}
                tableProps={DOCUMENT_DETAIL_TABLE_PROPS}
              />
              </>
            );
          }}
        </AntForm.Item>

        <FeeDetailsTable name="fee_details" label={t('app.kuaizhizao.salesOrder.feeDetailsFormLabel')} />

        <AntForm.Item
          noStyle
          shouldUpdate={(prev: any, curr: any) =>
            prev?.items !== curr?.items ||
            prev?.fee_details !== curr?.fee_details ||
            prev?.price_type !== curr?.price_type
          }
        >
          {({ getFieldValue }: { getFieldValue: (n: string) => any }) => (
            <DocumentAmountSummary variant="purchase" getFieldValue={getFieldValue} quantityField="ordered_quantity" />
          )}
        </AntForm.Item>

        <ProFormText name="supplier_name" hidden />
        <DocumentAttachmentsField
          category="purchase_order_attachments"
          label={t('app.kuaizhizao.purchaseOrder.form.attachments')}
        />
        <ProFormTextArea
          name="notes"
          label={t('app.kuaizhizao.purchaseOrder.form.notes')}
          placeholder={t('app.kuaizhizao.purchaseOrder.form.notesPlaceholder')}
          fieldProps={{ rows: 3 }}
        />
    </>
  );

  const purchaseOrderFormAuxModals = (
    <>
        <UniMaterialBatchPicker
          open={materialPickerOpen}
          onCancel={() => setMaterialPickerOpen(false)}
          onConfirm={appendPurchaseItemsFromMaterials}
        />
      <Suspense fallback={null}>
        <LazyUniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleItemImport}
          title={t('app.kuaizhizao.purchaseOrder.importItemsTitle')}
          headers={[t('app.kuaizhizao.purchaseOrder.importItems.materialCode'), t('app.kuaizhizao.purchaseOrder.importItems.spec'), t('app.kuaizhizao.purchaseOrder.importItems.unit'), t('app.kuaizhizao.purchaseOrder.importItems.quantity'), t('app.kuaizhizao.purchaseOrder.importItems.unitPrice'), t('app.kuaizhizao.purchaseOrder.importItems.requiredDate')]}
          exampleRow={['MAT001', 'Spec X', t('app.kuaizhizao.purchaseOrder.importItems.exampleUnit'), '10', '100', '2026-03-01']}
        />
      </Suspense>
    </>
  );

  if (isFormPage) {
    const canSubmitAfterSave =
      isCreatePage || (isEditPage && isDraftStatus(currentOrder?.status));
    return (
      <>
        <DocumentFormPageLayout
          header={
            <>
            <Space align="center" size={8}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                aria-label={t('common.back')}
                onClick={leavePurchaseOrderFormPage}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {isCreatePage
                  ? t('app.kuaizhizao.menu.purchase-management.purchase-orders.new')
                  : t('app.kuaizhizao.menu.purchase-management.purchase-orders.edit')}
              </Typography.Title>
            </Space>
            <DocumentFormPageHeaderActions
              onCancel={leavePurchaseOrderFormPage}
              onSaveDraft={() => void handleSaveDraft()}
              onPrimarySubmit={() => void triggerPurchaseOrderPrimarySubmit()}
              isCreatePage={isCreatePage}
              canSubmitAfterSave={canSubmitAfterSave}
              showSaveDraft={canSubmitAfterSave}
            />
            </>
          }
        >
          <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
            <div className="form-modal-content-inner">
              <ProForm
                formRef={formRef}
                layout="vertical"
                submitter={false}
                scrollToFirstError
                onFinish={handleFormSubmit}
                onFinishFailed={({ errorFields }) => {
                  const first = errorFields?.[0];
                  const errText = first?.errors?.filter(Boolean)[0];
                  messageApi.error(errText || t('components.layoutTemplates.formModal.checkFormHint'));
                }}
                initialValues={isCreatePage ? { items: [defaultOrderItem], price_type: 'tax_exclusive' } : undefined}
              >
                {purchaseOrderFormItemContent}
              </ProForm>
            </div>
          </Card>
        </DocumentFormPageLayout>
        {purchaseOrderFormAuxModals}
      </>
    );
  }

  return (
    <>
      <style>{`
        .purchase-order-row-overdue td.ant-table-cell {
          background: var(--ant-color-warning-bg) !important;
        }
      `}</style>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PurchaseOrder>
          columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-orders"
          headerTitle={t('app.kuaizhizao.menu.purchase-management.purchase-orders')}
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          rowKey="id"
          rowClassName={(record) =>
            highlightDeliveryOverdue && isPurchaseOrderDeliveryOverdue(record, purchaseOrderAuditEnabled)
              ? 'purchase-order-row-overdue'
              : ''
          }
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton={false}
          createButtonText={t('app.kuaizhizao.menu.purchase-management.purchase-orders.new')}
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-purchase-order-with-pull"
              createIcon={<PlusOutlined />}
              createLabel={t('app.kuaizhizao.menu.purchase-management.purchase-orders.new')}
              onCreate={handleCreate}
              menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                {
                  key: 'pull-from-requisition',
                  actionKey: 'purchase_order.pull_from_requisition',
                  onClick: pullFromRequisitionQuery.openModal,
                },
                {
                  key: 'pull-from-inquiry',
                  actionKey: 'purchase_order.pull_from_inquiry',
                  onClick: pullFromInquiryQuery.openModal,
                },
              ])}
            />,
            <UniPushToolbarButton
              key={`purchase-order-push-${selectedOrderForToolbar?.id ?? 'none'}`}
              menuItems={toolbarPushMenuItems}
              disabled={!selectedOrderForToolbar || !canUseToolbarPush}
            />,
          ]}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.purchaseOrder.confirmBatchDelete', { count })}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="purchase-order-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedOrdersForBatch}
              auditEnabled={purchaseOrderAuditEnabled}
              permGates={purchaseOrderPerms}
              handlers={purchaseOrderAuditBatchHandlers}
              onSuccess={handlePurchaseOrderAuditBatchSuccess}
              toolBarButtonSize="middle"
            />,
          ]}
          toolBarActionsAfterBatch={[
            <UniCapabilityBatchButton
              key="purchase-order-push-receipt-notice"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedOrdersForBatch}
              capabilityKey="push_receipt_notice"
              permAllowed={purchaseOrderPerms.canAction?.('execute') ?? false}
              batchAllowed={purchaseOrderBatchPushReceiptNoticeAllowed}
              onRun={(id) => pushPurchaseOrderToReceiptNotice(id)}
              notAllowedMessage={t('app.kuaizhizao.purchaseOrder.batchPushNoticePartial', { count: 1 })}
              onSuccess={handlePurchaseOrderAuditBatchSuccess}
              labels={{
                single: t('app.kuaizhizao.purchaseOrder.batchPushNotice'),
                batch: t('app.kuaizhizao.purchaseOrder.batchPushNotice'),
              }}
              icon={<FileTextOutlined />}
              size="middle"
            />,
            <UniCapabilityBatchButton
              key="purchase-order-print"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedOrdersForBatch}
              capabilityKey="print"
              permAllowed={purchaseOrderPerms.canPrint}
              batchAllowed={(records, perm) =>
                Boolean(perm) && records.some((record) => record.capabilities?.print?.allowed === true)
              }
              singleOnly
              onRun={async (id) => {
                openPrint({ documentType: 'purchase_order', documentId: id });
              }}
              labels={{
                single: t('components.uniAction.print'),
                batch: t('components.uniAction.print'),
              }}
              icon={<PrinterOutlined />}
              size="middle"
            />,
          ]}
          showImportButton={true}
          onImport={handleListImport}
          importHeaders={purchaseOrderImportTemplate.importHeaders}
          importExampleRow={purchaseOrderImportTemplate.importExampleRow}
          importFieldMap={purchaseOrderImportTemplate.importHeaderMap}
          importFieldRules={{
            supplier: { required: true },
            date: { required: true },
            material: { required: true },
            quantity: { required: true },
          }}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listPurchaseOrders({ skip: 0, limit: 10000 });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              const blob = new window.Blob([window.JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `purchase-orders-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              window.URL.revokeObjectURL(url);
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          toolbar={{ actions: [purchaseOrderHighlightOverdueToolbar] }}
          request={async (params, _sort, _filter, searchFormValues) => {
            try {
              const apiParams: Record<string, unknown> = {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                keyword: params.keyword,
              };
              const lifecycleMapped = resolvePurchaseOrderListLifecycleParams(
                searchFormValues,
                params,
              );
              if (lifecycleMapped.status) apiParams.status = lifecycleMapped.status;
              if (lifecycleMapped.review_status) apiParams.review_status = lifecycleMapped.review_status;
              const response = await listPurchaseOrders(apiParams as Parameters<typeof listPurchaseOrders>[0]);
              tableRowsRef.current = response.data || [];
              const enriched = await enrichPurchaseOrderRecordsWithCustomFields(response.data || []);
              return {
                data: enriched,
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error(t('app.kuaizhizao.purchaseOrder.listFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          scroll={{ x: 1400 }}
        />
      </ListPageTemplate>

      <UniPullQueryModal<PullPurchaseRequisitionLineCandidate>
        open={pullFromRequisitionQuery.open}
        title={pullFromRequisitionAction.label}
        onCancel={pullFromRequisitionQuery.closeModal}
        onOk={pullFromRequisitionQuery.handleConfirm}
        rowKey="key"
        columns={[
              { title: t('app.kuaizhizao.purchaseOrder.col.requisitionCode'), dataIndex: 'requisition_code', width: 170 },
              { title: t('app.kuaizhizao.purchaseOrder.col.requisitionName'), dataIndex: 'requisition_name', width: 160, ellipsis: true, render: (v: string) => v || '-' },
              { title: t('app.kuaizhizao.purchaseOrder.col.materialCode'), dataIndex: 'material_code', width: 140, ellipsis: true, render: (v: string) => v || '-' },
              { title: t('app.kuaizhizao.purchaseOrder.col.materialName'), dataIndex: 'material_name', width: 170, ellipsis: true, render: (v: string) => v || '-' },
              { title: t('app.kuaizhizao.purchaseOrder.col.spec'), dataIndex: 'material_spec', width: 140, ellipsis: true, render: (v: string) => v || '-' },
              { title: t('app.kuaizhizao.purchaseOrder.col.quantity'), dataIndex: 'quantity', width: 90, align: 'right' },
              { title: t('app.kuaizhizao.purchaseOrder.col.unit'), dataIndex: 'unit', width: 70, render: (v: string) => v || '-' },
              { title: t('app.kuaizhizao.purchaseOrder.col.demandDate'), dataIndex: 'required_date', width: 120, render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
              { title: t('app.kuaizhizao.purchaseOrder.col.applicant'), dataIndex: 'applicant_name', width: 100, render: (v: string) => v || '-' },
              {
                title: t('common.status'),
                dataIndex: 'requisition_status',
                width: 100,
                render: (v: string) => <Tag color={v?.includes('转单') ? 'gold' : 'blue'}>{v || '-'}</Tag>,
              },
              {
                title: t('app.kuaizhizao.purchaseOrder.col.review'),
                dataIndex: 'review_status',
                width: 100,
                render: (v: string) => {
                  const approved = v === 'APPROVED' || v === '已通过' || v === '审核通过';
                  const rejected = v === 'REJECTED' || v === '已驳回';
                  return <Tag color={approved ? 'green' : rejected ? 'red' : 'default'}>{v || '-'}</Tag>;
                },
              },
              {
                title: t('app.kuaizhizao.purchaseOrder.col.supplier'),
                width: 160,
                render: (_: unknown, record: PullPurchaseRequisitionLineCandidate) =>
                  record.supplier_id ? t('app.kuaizhizao.purchaseOrder.pull.supplierAssigned', { id: record.supplier_id }) : t('app.kuaizhizao.purchaseOrder.pull.supplierPending'),
              },
              {
                title: t('app.kuaizhizao.purchaseOrder.col.convertStatus'),
                width: 180,
                render: (_: unknown, record: PullPurchaseRequisitionLineCandidate) =>
                  record.converted ? (
                    <Tag color="gold">{t('app.kuaizhizao.purchaseOrder.pull.convertedTag', { id: record.purchase_order_id })}</Tag>
                  ) : (
                    <Tag color="green">{t('app.kuaizhizao.purchaseOrder.pull.convertibleTag')}</Tag>
                  ),
              },
            ]}
        dataSource={pullFromRequisitionQuery.dataSource}
        loading={pullFromRequisitionQuery.loading}
        confirmLoading={pullFromRequisitionQuery.confirmLoading}
        selectionType={pullFromRequisitionQuery.selectionType}
        selectedRowKeys={pullFromRequisitionQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromRequisitionQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromRequisitionQuery.isRowDisabled}
        searchDraft={pullFromRequisitionQuery.searchDraft}
        onSearchDraftChange={pullFromRequisitionQuery.setSearchDraft}
        onSearchApply={pullFromRequisitionQuery.handleSearchApply}
        onSearchClear={pullFromRequisitionQuery.handleSearchClear}
        appliedKeyword={pullFromRequisitionQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.purchaseOrder.pull.searchPlaceholder')}
        emptyText={t('app.kuaizhizao.purchaseOrder.pull.empty')}
        emptySearchText={t('app.kuaizhizao.purchaseOrder.pull.emptySearch')}
        page={pullFromRequisitionQuery.page}
        pageSize={pullFromRequisitionQuery.pageSize}
        total={pullFromRequisitionQuery.total}
        onPageChange={pullFromRequisitionQuery.handlePageChange}
        okText={t('app.kuaizhizao.purchaseOrder.pull.ok')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        footerHint={(
          <Typography.Text type="secondary">
            {t('app.kuaizhizao.purchaseOrder.pull.selectedSummary', { count: pullFromRequisitionQuery.selectedCount })}
          </Typography.Text>
        )}
      />

      <UniPullQueryModal<PullPurchaseInquiryLineCandidate>
        open={pullFromInquiryQuery.open}
        title={pullFromInquiryAction.label}
        onCancel={pullFromInquiryQuery.closeModal}
        onOk={pullFromInquiryQuery.handleConfirm}
        rowKey="key"
        columns={[
              { title: t('app.kuaizhizao.purchaseOrder.col.requisitionCode'), dataIndex: 'inquiry_code', width: 170 },
              { title: t('app.kuaizhizao.purchaseOrder.col.requisitionName'), dataIndex: 'inquiry_name', width: 160, ellipsis: true, render: (v: string) => v || '-' },
              { title: t('app.kuaizhizao.purchaseOrder.col.materialCode'), dataIndex: 'material_code', width: 140, ellipsis: true, render: (v: string) => v || '-' },
              { title: t('app.kuaizhizao.purchaseOrder.col.materialName'), dataIndex: 'material_name', width: 170, ellipsis: true, render: (v: string) => v || '-' },
              { title: t('app.kuaizhizao.purchaseOrder.col.spec'), dataIndex: 'material_spec', width: 140, ellipsis: true, render: (v: string) => v || '-' },
              { title: t('app.kuaizhizao.purchaseOrder.col.quantity'), dataIndex: 'quantity', width: 90, align: 'right' },
              { title: t('app.kuaizhizao.purchaseOrder.col.unit'), dataIndex: 'unit', width: 70, render: (v: string) => v || '-' },
              { title: t('app.kuaizhizao.purchaseOrder.col.demandDate'), dataIndex: 'required_date', width: 120, render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
              { title: t('app.kuaizhizao.purchaseOrder.col.applicant'), dataIndex: 'buyer_name', width: 100, render: (v: string) => v || '-' },
              {
                title: t('common.status'),
                dataIndex: 'inquiry_status',
                width: 100,
                render: (v: string) => <Tag color={v?.includes('转单') ? 'gold' : 'blue'}>{v || '-'}</Tag>,
              },
              {
                title: t('app.kuaizhizao.purchaseOrder.col.review'),
                dataIndex: 'review_status',
                width: 100,
                render: (v: string) => {
                  const approved = v === 'APPROVED' || v === '已通过' || v === '审核通过';
                  const rejected = v === 'REJECTED' || v === '已驳回';
                  return <Tag color={approved ? 'green' : rejected ? 'red' : 'default'}>{v || '-'}</Tag>;
                },
              },
              {
                title: t('app.kuaizhizao.purchaseOrder.col.supplier'),
                width: 160,
                render: (_: unknown, record: PullPurchaseInquiryLineCandidate) =>
                  record.supplier_id ? t('app.kuaizhizao.purchaseOrder.pull.supplierAssigned', { id: record.supplier_id }) : t('app.kuaizhizao.purchaseOrder.pull.supplierPending'),
              },
              {
                title: t('app.kuaizhizao.purchaseOrder.col.convertStatus'),
                width: 180,
                render: (_: unknown, record: PullPurchaseInquiryLineCandidate) =>
                  record.converted ? (
                    <Tag color="gold">{t('app.kuaizhizao.purchaseOrder.pull.convertedTag', { id: record.purchase_order_id })}</Tag>
                  ) : (
                    <Tag color="green">{t('app.kuaizhizao.purchaseOrder.pull.convertibleTag')}</Tag>
                  ),
              },
            ]}
        dataSource={pullFromInquiryQuery.dataSource}
        loading={pullFromInquiryQuery.loading}
        confirmLoading={pullFromInquiryQuery.confirmLoading}
        selectionType={pullFromInquiryQuery.selectionType}
        selectedRowKeys={pullFromInquiryQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromInquiryQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromInquiryQuery.isRowDisabled}
        searchDraft={pullFromInquiryQuery.searchDraft}
        onSearchDraftChange={pullFromInquiryQuery.setSearchDraft}
        onSearchApply={pullFromInquiryQuery.handleSearchApply}
        onSearchClear={pullFromInquiryQuery.handleSearchClear}
        appliedKeyword={pullFromInquiryQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.purchaseOrder.pull.searchPlaceholder')}
        emptyText={t('app.kuaizhizao.purchaseOrder.pull.empty')}
        emptySearchText={t('app.kuaizhizao.purchaseOrder.pull.emptySearch')}
        page={pullFromInquiryQuery.page}
        pageSize={pullFromInquiryQuery.pageSize}
        total={pullFromInquiryQuery.total}
        onPageChange={pullFromInquiryQuery.handlePageChange}
        okText={t('app.kuaizhizao.purchaseOrder.pull.ok')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        footerHint={(
          <Typography.Text type="secondary">
            {t('app.kuaizhizao.purchaseOrder.pull.selectedSummary', { count: pullFromInquiryQuery.selectedCount })}
          </Typography.Text>
        )}
      />


      <LandingCostAllocationModal
        visible={landingCostModalVisible}
        onCancel={() => {
          setLandingCostModalVisible(false);
          setLandingCostOrder(null);
        }}
        onSuccess={() => {
          setLandingCostModalVisible(false);
          setLandingCostOrder(null);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        }}
        orderId={landingCostOrder?.id || 0}
        orderCode={landingCostOrder?.order_code || ''}
      />

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.purchaseOrder.detailTitle', { code: orderDetail?.order_code || '' })}
        open={detailDrawerVisible}
        zIndex={purchaseOrderDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setOrderDetail(null);
          setApprovalStatus(null);
          resetPurchaseOrderDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        collaborationTitleSuffix={
          orderDetail ? <PurchaseOrderCollaborationTitleSuffix lifecycle={purchaseOrderLifecycle} /> : null
        }
        extra={
          orderDetail && (
            <DetailDrawerActions
              items={[
                {
                  key: 'edit',
                  visible: orderDetail.capabilities?.update?.allowed === true && purchaseOrderPerms.canUpdate,
                  render: () => (
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setDetailDrawerVisible(false); handleEdit(orderDetail); }}>
                      {t('common.edit')}
                    </Button>
                  ),
                },
                {
                  key: 'workflow',
                  render: () => (
                    <UniWorkflowActions {...rowActionKind('skip')}
                      record={orderDetail}
                      entityName={t('app.kuaizhizao.purchaseOrder.entityName')}
                      entityType="purchase_order"
                      unifiedAudit
                      resourcePrefix="kuaizhizao:purchase-order"
                      statusField="status"
                      reviewStatusField="review_status"
                      draftStatuses={PO_WORKFLOW_DRAFT_STATUSES}
                      pendingStatuses={PO_WORKFLOW_PENDING_STATUSES}
                      approvedStatuses={PO_WORKFLOW_APPROVED_STATUSES}
                      rejectedStatuses={PO_WORKFLOW_REJECTED_STATUSES}
                      submitActionLabel={t('app.kuaizhizao.purchaseOrder.submitForReview')}
                      theme="link"
                      size="small"
                      onSuccess={() => {
                        invalidateStatistics();
                        actionRef.current?.reload();
                        loadApprovalData(orderDetail.id!);
                        getPurchaseOrder(orderDetail.id!).then(setOrderDetail);
                        setPoTrackingRefreshKey((k) => k + 1);
                      }}
                    />
                  ),
                },
                {
                  key: 'push',
                  visible: isAuditedStatus(orderDetail.status),
                  render: () => (
                    <Dropdown {...rowActionKind('skip')}
                      menu={{
                        items: [
                          { key: 'receipt-notice', label: pushToReceiptNoticeAction.label, icon: <FileTextOutlined />, onClick: () => handlePushToNotice(orderDetail) },
                          { key: 'receipt', label: pushToReceiptAction.label, icon: <InboxOutlined />, onClick: () => handlePushToReceipt(orderDetail) },
                          { key: 'invoice', label: pushToInvoiceAction.label, icon: <FileTextOutlined />, onClick: () => handlePushToInvoice(orderDetail) },
                          { key: 'purchase-return', label: pushToPurchaseReturnAction.label, icon: <RollbackOutlined />, onClick: () => handlePushToReturn(orderDetail) },
                        ],
                      }}
                    >
                      <Button type="link" size="small" icon={<CheckCircleOutlined />} style={{ color: '#722ed1' }}>
                        {t('app.kuaizhizao.purchaseOrder.push.dropdown')} <DownOutlined />
                      </Button>
                    </Dropdown>
                  ),
                },
                {
                  key: 'create-change',
                  visible: isAuditedStatus(orderDetail.status),
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() =>
                        navigate(
                          `/apps/kuaizhizao/purchase-management/purchase-order-changes?source_order_id=${orderDetail.id}`,
                        )
                      }
                    >
                      {t('app.kuaizhizao.purchaseOrder.createChange')}
                    </Button>
                  ),
                },
                {
                  key: 'expedite',
                  visible: orderDetail.status === 'AUDITED' || orderDetail.status === 'CONFIRMED' || orderDetail.status === '已审核' || orderDetail.status === '已确认',
                  render: () => (
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<ClockCircleOutlined />} 
                      style={{ color: '#faad14' }}
                      onClick={async () => {
                        try {
                          await expeditePurchaseOrder(orderDetail.id!);
                          messageApi.success(t('app.kuaizhizao.purchaseOrder.expediteSuccess'));
                        } catch (err: any) {
                          messageApi.error(err.message || t('app.kuaizhizao.purchaseOrder.expediteFailed'));
                        }
                      }}
                    >
                      {t('app.kuaizhizao.purchaseOrder.expedite')}
                    </Button>
                  ),
                },
                {
                  key: 'delete',
                  visible: orderDetail.capabilities?.delete?.allowed === true && purchaseOrderPerms.canDelete,
                  render: () => (
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(orderDetail)}>
                      {t('common.delete')}
                    </Button>
                  ),
                },
                {
                  key: 'print',
                  visible: orderDetail.id != null && purchaseOrderPerms.canPrint,
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      icon={<PrinterOutlined />}
                      onClick={() => openPrint({ documentType: 'purchase_order', documentId: orderDetail.id! })}
                    >
                      {t('components.uniAction.print')}
                    </Button>
                  ),
                },
              ]}
            />
          )
        }
        basic={
          orderDetail ? (
            <>
              <Descriptions
                column={3}
                size="small"
                items={buildDescriptionItemsFromColumns(orderDetail, detailColumns)}
              />
              {orderDetail.fee_details && orderDetail.fee_details.length > 0 && (
                <>
                  <Divider style={{ margin: '16px 0' }} />
                  <Typography.Title level={5} style={{ margin: '0 0 8px' }}>
                    {t('app.kuaizhizao.salesOrder.feeDetailsTitle')}
                  </Typography.Title>
                  <div style={{ marginBottom: 12 }}>
                    <Typography.Text type="secondary">
                      {t('app.kuaizhizao.purchaseOrder.totalFeeAmount')}：<strong>¥{formatAmount(orderDetail.total_fee_amount)}</strong>
                    </Typography.Text>
                  </div>
                  <Table
                    size="small"
                    columns={[
                      {
                        title: t('app.kuaizhizao.salesOrder.feeType'),
                        dataIndex: 'type',
                        width: 120,
                        render: (val) => {
                          const opt = feeTypeOptions.find((o: any) => o.value === val);
                          return opt?.label || val;
                        },
                      },
                      {
                        title: t('app.kuaizhizao.purchaseOrder.col.orderAmount'),
                        dataIndex: 'amount',
                        width: 120,
                        align: 'right',
                        render: (val) => `¥${formatAmount(val)}`,
                      },
                      {
                        title: t('app.kuaizhizao.salesOrder.feeBearer'),
                        dataIndex: 'bearer',
                        width: 100,
                        render: (val) => (val === 'our_side' ? t('app.kuaizhizao.salesOrder.feeBearerOurSide') : t('app.kuaizhizao.salesOrder.feeBearerCounterparty')),
                      },
                      { title: t('app.kuaizhizao.common.fieldNotes'), dataIndex: 'notes' },
                    ]}
                    dataSource={orderDetail.fee_details}
                    rowKey={(_: any, i?: number) => i ?? 0}
                    pagination={false}
                    bordered
                  />
                </>
              )}
              {hasCustomFieldsDetailContent(purchaseOrderListCustomFields, purchaseOrderDetailCustomFieldValues) ? (
                <div style={{ marginTop: 16 }}>
                  <CustomFieldsDetailSection
                    customFields={purchaseOrderListCustomFields}
                    customFieldValues={purchaseOrderDetailCustomFieldValues}
                  />
                </div>
              ) : null}
              <Descriptions
                column={3}
                size="small"
                style={{ marginTop: 16 }}
                items={buildDescriptionItemsFromColumns(orderDetail, [detailNotesColumn])}
              />
            </>
          ) : null
        }
        collaboration={
          orderDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {purchaseOrderLifecycle && (purchaseOrderLifecycle.mainStages ?? []).length > 0 ? (
                <UniLifecycleStepper
                  steps={purchaseOrderLifecycle.mainStages ?? []}
                  status={purchaseOrderLifecycle.status}
                  showLabels
                  nextStepSuggestions={purchaseOrderLifecycle.nextStepSuggestions}
                  hideNextStepSuggestions={Boolean(purchaseOrderLifecycle.nextStepSuggestions?.length)}
                />
              ) : null}
              {orderDetail.id != null ? (
                <DetailDrawerInlineFullChain
                  documentType="purchase_order"
                  documentId={orderDetail.id}
                  active={detailDrawerVisible}
                  selfDocumentId={orderDetail.id}
                  renderBriefActions={(doc) => (
                    <>
                      {doc.document_type === 'purchase_requisition' ? (
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            setDetailDrawerVisible(false);
                            navigate(ROUTES.PURCHASE_REQUISITIONS);
                          }}
                        >
                          {t('components.documentTrackingPanel.traceBriefOpenPurchaseRequisition')}
                        </Button>
                      ) : null}
                      {doc.document_type === 'receipt_notice' ? (
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            setDetailDrawerVisible(false);
                            navigate(ROUTES.RECEIPT_NOTICES);
                          }}
                        >
                          {t('components.documentTrackingPanel.traceBriefOpenReceiptNotice')}
                        </Button>
                      ) : null}
                      {doc.document_type === 'purchase_return' ? (
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            setDetailDrawerVisible(false);
                            navigate(ROUTES.PURCHASE_RETURNS);
                          }}
                        >
                          {t('components.documentTrackingPanel.traceBriefOpenPurchaseReturn')}
                        </Button>
                      ) : null}
                      {doc.document_type === 'purchase_invoice' ? (
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            setDetailDrawerVisible(false);
                            navigate(`/apps/kuaicaiwu/finance-management/purchase-invoices/${doc.document_id}`);
                          }}
                        >
                          {t('components.documentTrackingPanel.traceBriefOpenPurchaseInvoice')}
                        </Button>
                      ) : null}
                      {doc.document_type === 'payable' ? (
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            setDetailDrawerVisible(false);
                            navigate(`/apps/kuaicaiwu/finance-management/payables/${doc.document_id}`);
                          }}
                        >
                          {t('components.documentTrackingPanel.traceBriefOpenPayable')}
                        </Button>
                      ) : null}
                      {doc.document_type === 'payment' ? (
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => {
                            setDetailDrawerVisible(false);
                            navigate('/apps/kuaicaiwu/finance-management/payments');
                          }}
                        >
                          {t('components.documentTrackingPanel.traceBriefOpenPayment')}
                        </Button>
                      ) : null}
                    </>
                  )}
                />
              ) : null}
            </div>
          ) : null
        }
        lines={
          orderDetail ? (
            <>
              {orderDetail.items && orderDetail.items.length > 0 ? (
                  <Table
                    size="small"
                    tableLayout="fixed"
                    style={{ minWidth: PO_DETAIL_ITEMS_MIN_WIDTH }}
                    columns={[
                      { title: t('app.kuaizhizao.purchaseOrder.col.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
                      { title: t('app.kuaizhizao.purchaseOrder.col.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true },
                      { title: t('app.kuaizhizao.purchaseOrder.col.orderedQty'), dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                      { title: t('app.kuaizhizao.purchaseOrder.col.unit'), dataIndex: 'unit', width: 60 },
                      {
                        title: t('app.kuaizhizao.purchaseOrder.col.unitPrice'),
                        dataIndex: 'unit_price',
                        width: 100,
                        align: 'right',
                        render: (text) => `¥${text}`,
                      },
                      {
                        title: t('app.kuaizhizao.purchaseOrder.col.totalPrice'),
                        dataIndex: 'total_price',
                        width: 120,
                        align: 'right',
                        render: (text) => `¥${text?.toLocaleString()}`,
                      },
                      { title: t('app.kuaizhizao.purchaseOrder.col.receivedQty'), dataIndex: 'received_quantity', width: 100, align: 'right' },
                      { title: t('app.kuaizhizao.purchaseOrder.col.outstandingQty'), dataIndex: 'outstanding_quantity', width: 100, align: 'right' },
                      { title: t('app.kuaizhizao.purchaseOrder.form.requiredDate'), dataIndex: 'required_date', width: 120 },
                      {
                        title: t('app.kuaizhizao.purchaseOrder.col.inspectionRequired'),
                        dataIndex: 'inspection_required',
                        width: 100,
                        render: (val) => (val ? t('app.kuaizhizao.purchaseRequisition.convertedYes') : t('app.kuaizhizao.purchaseRequisition.convertedNo')),
                      },
                    ]}
                    dataSource={orderDetail.items}
                    pagination={false}
                    rowKey="id"
                    bordered
                  />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.salesOrder.emptyItems')} />
              )}
            </>
          ) : null
        }
        timeline={
          orderDetail?.id ? (
            <>
              {purchaseOrderTracking.loading && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin />
                </div>
              )}
              {purchaseOrderTracking.error && !purchaseOrderTracking.loading && (
                <Typography.Text type="danger">{purchaseOrderTracking.error}</Typography.Text>
              )}
              {purchaseOrderTracking.data && !purchaseOrderTracking.loading && (
                <DocumentTrackingTimelineBody data={purchaseOrderTracking.data} />
              )}

              <Divider style={{ margin: '16px 0' }} />
              <Typography.Title level={5} style={{ margin: '0 0 8px' }}>{t('app.kuaizhizao.purchaseOrder.changeHistoryTitle')}</Typography.Title>
              {orderChangeHistory.length ? (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={orderChangeHistory}
                  columns={[
                    { title: t('app.kuaizhizao.purchaseOrder.col.changeCode'), dataIndex: 'change_code' },
                    { title: t('app.kuaizhizao.purchaseOrder.col.changeVersion'), dataIndex: 'change_version', width: 70 },
                    { title: t('app.kuaizhizao.purchaseOrder.col.deltaAmount'), dataIndex: 'delta_amount', width: 100 },
                    { title: t('common.status'), dataIndex: 'status', width: 100 },
                    { title: t('app.kuaizhizao.purchaseOrder.col.appliedAt'), dataIndex: 'applied_at', width: 160, render: (v: string) => v || '-' },
                  ]}
                />
              ) : (
                <Typography.Text type="secondary">{t('app.kuaizhizao.purchaseOrder.emptyChanges')}</Typography.Text>
              )}

              {approvalStatus && approvalStatus.has_flow && (
                <Spin spinning={approvalLoading}>
                  <>
                    <Divider style={{ margin: '16px 0' }} />
                    <div
                      style={{
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        {t('app.kuaizhizao.purchaseOrder.approvalFlowTitle')}
                      </Typography.Title>
                      <Tag
                        color={
                          approvalStatus.status === 'approved'
                            ? 'success'
                            : approvalStatus.status === 'rejected'
                              ? 'error'
                              : 'processing'
                        }
                      >
                        {approvalStatus.status === 'approved'
                          ? t('app.kuaizhizao.purchaseOrder.approvalPassed')
                          : approvalStatus.status === 'rejected'
                            ? t('app.kuaizhizao.purchaseOrder.approvalRejected')
                            : t('app.kuaizhizao.purchaseOrder.approvalInProgress')}
                      </Tag>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      {approvalStatus.current_node && (
                        <div>
                          <strong>{t('app.kuaizhizao.purchaseOrder.currentNode')}</strong>
                          <Tag color="blue">{approvalStatus.current_node}</Tag>
                        </div>
                      )}
                    </div>
                    {approvalStatus?.history && approvalStatus.history.length > 0 && (
                      <div>
                        <Divider titlePlacement="left">{t('app.kuaizhizao.purchaseOrder.approvalRecords')}</Divider>
                        <Timeline
                          items={approvalStatus.history.map((h) => {
                            const isPassed = h.action === 'approve';
                            const isRejected = h.action === 'reject';
                            return {
                              icon: isPassed ? (
                                <CheckCircleTwoTone twoToneColor="#52c41a" />
                              ) : isRejected ? (
                                <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                              ) : (
                                <ClockCircleOutlined style={{ color: '#1890ff' }} />
                              ),
                              color: isPassed ? 'green' : isRejected ? 'red' : 'blue',
                              content: (
                                <div>
                                  <div style={{ marginBottom: 4 }}>
                                    <Tag color={isPassed ? 'success' : isRejected ? 'error' : 'processing'}>
                                      {isPassed ? t('app.kuaizhizao.purchaseOrder.approvalPass') : isRejected ? t('app.kuaizhizao.purchaseOrder.approvalReject') : h.action || '-'}
                                    </Tag>
                                  </div>
                                  <div style={{ color: '#666', fontSize: '12px', marginBottom: 4 }}>
                                    {h.action_at && t('app.kuaizhizao.purchaseOrder.approvalTime', { time: h.action_at })}
                                  </div>
                                  {h.comment && (
                                    <div style={{ color: '#999', fontSize: '12px', marginTop: 4 }}>
                                      {t('app.kuaizhizao.purchaseOrder.approvalComment', { comment: h.comment })}
                                    </div>
                                  )}
                                </div>
                              ),
                            };
                          })}
                        />
                      </div>
                    )}
                    {(!approvalStatus?.history || approvalStatus.history.length === 0) && approvalStatus?.has_flow && (
                      <Empty
                        description={t('app.kuaizhizao.purchaseOrder.emptyApprovalRecords')}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        style={{ margin: '20px 0' }}
                      />
                    )}
                  </>
                </Spin>
              )}
            </>
          ) : null
        }
      />

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title={t('app.kuaizhizao.purchaseOrder.syncFromDatasetTitle')}
      />

      {/* 下推入库 Modal：标准 Modal，采购数量可编辑 */}
      <Modal
        title={pushToReceiptAction.label}
        open={pushToReceiptVisible}
        onCancel={() => {
          setPushToReceiptVisible(false);
          setPushToReceiptOrder(null);
          setPushToReceiptQuantities({});
          setPushToReceiptBatchNumbers({});
          setPushToReceiptWarehouseId(undefined);
          setPushToReceiptWarehouseOptions([]);
          setPushToReceiptLineWh({});
          setPushToReceiptLineLoc({});
          setPushToReceiptLineLocCode({});
          setPushToReceiptLocOptionsByWh({});
        }}
        onOk={handlePushToReceiptConfirm}
        confirmLoading={pushToReceiptLoading}
        okText={t('app.kuaizhizao.purchaseOrder.confirmPush')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        destroyOnHidden
      >
        {pushToReceiptOrder && (
          <div>
            <p style={{ marginBottom: 16 }}>
              {t('app.kuaizhizao.purchaseOrder.pushReceiptIntro', { code: pushToReceiptOrder.order_code })}
            </p>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                  {t('app.kuaizhizao.purchaseOrder.pushReceiptDefaultWarehouse')}
                </Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder={t('app.kuaizhizao.purchaseOrder.pushReceiptBatchWarehousePlaceholder')}
                  showSearch
                  allowClear
                  optionFilterProp="label"
                  value={pushToReceiptWarehouseId}
                  options={pushToReceiptWarehouseOptions}
                  onChange={(value) => {
                    setPushToReceiptWarehouseId(value ?? undefined);
                    if (value == null) return;
                    const lineIds = (pushToReceiptOrder.items || [])
                      .filter((it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0 && it.id != null)
                      .map((it) => it.id!);
                    setPushToReceiptLineWh((prev) => {
                      const next = { ...prev };
                      lineIds.forEach((id) => {
                        next[id] = value;
                      });
                      return next;
                    });
                    setPushToReceiptLineLoc((prev) => {
                      const next = { ...prev };
                      lineIds.forEach((id) => {
                        delete next[id];
                      });
                      return next;
                    });
                    setPushToReceiptLineLocCode((prev) => {
                      const next = { ...prev };
                      lineIds.forEach((id) => {
                        delete next[id];
                      });
                      return next;
                    });
                    void fetchStorageLocationsForWarehouse(value).then((opts) =>
                      setPushToReceiptLocOptionsByWh((prev) => ({ ...prev, [value]: opts })),
                    );
                  }}
                />
              </Col>
            </Row>
            <Table
              size="small"
              dataSource={(pushToReceiptOrder.items || []).filter(
                (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
              )}
              rowKey="id"
              pagination={false}
              scroll={{ x: 1200 }}
              columns={[
                { title: t('app.kuaizhizao.purchaseOrder.col.materialCode'), dataIndex: 'material_code', width: 110 },
                { title: t('app.kuaizhizao.purchaseOrder.col.materialName'), dataIndex: 'material_name', width: 140, ellipsis: true },
                { title: t('app.kuaizhizao.purchaseOrder.col.orderedQty'), dataIndex: 'ordered_quantity', width: 90, align: 'right' },
                { title: t('app.kuaizhizao.purchaseOrder.col.receivedQty'), dataIndex: 'received_quantity', width: 80, align: 'right' },
                { title: t('app.kuaizhizao.purchaseOrder.col.outstandingQty'), dataIndex: 'outstanding_quantity', width: 80, align: 'right' },
                {
                  title: (
                    <>
                      {t('app.kuaizhizao.purchaseOrder.pushReceiptWarehouse')}
                      <Typography.Text type="danger"> *</Typography.Text>
                    </>
                  ),
                  width: 150,
                  render: (_: unknown, record: PurchaseOrderItem) =>
                    record.id != null ? (
                      <Select
                        style={{ width: '100%', minWidth: 130 }}
                        placeholder={t('app.kuaizhizao.purchaseOrder.pushReceiptSelectWarehouse')}
                        showSearch
                        optionFilterProp="label"
                        value={pushToReceiptLineWh[record.id]}
                        options={pushToReceiptWarehouseOptions}
                        onChange={(nv) => {
                          const rid = record.id!;
                          setPushToReceiptLineWh((prev) => ({ ...prev, [rid]: nv }));
                          setPushToReceiptLineLoc((prev) => {
                            const next = { ...prev };
                            delete next[rid];
                            return next;
                          });
                          setPushToReceiptLineLocCode((prev) => {
                            const next = { ...prev };
                            delete next[rid];
                            return next;
                          });
                          void fetchStorageLocationsForWarehouse(nv).then((opts) =>
                            setPushToReceiptLocOptionsByWh((prev) => ({ ...prev, [nv]: opts })),
                          );
                        }}
                      />
                    ) : null,
                },
                {
                  title: t('app.kuaizhizao.purchaseOrder.pushReceiptLocation'),
                  width: 150,
                  render: (_: unknown, record: PurchaseOrderItem) => {
                    if (record.id == null) return null;
                    const rid = record.id;
                    const wh = pushToReceiptLineWh[rid];
                    const locOpts = wh != null ? pushToReceiptLocOptionsByWh[wh] ?? [] : [];
                    return (
                      <Select
                        style={{ width: '100%', minWidth: 130 }}
                        placeholder={
                          wh != null
                            ? t('app.kuaizhizao.purchaseOrder.pushReceiptSelectLocation')
                            : t('app.kuaizhizao.purchaseOrder.pushReceiptSelectWarehouseFirst')
                        }
                        showSearch
                        allowClear
                        optionFilterProp="label"
                        value={pushToReceiptLineLoc[rid]}
                        options={locOpts}
                        disabled={wh == null}
                        onDropdownVisibleChange={(open) => {
                          if (open && wh != null && !pushToReceiptLocOptionsByWh[wh]?.length) {
                            void fetchStorageLocationsForWarehouse(wh).then((opts) =>
                              setPushToReceiptLocOptionsByWh((prev) => ({ ...prev, [wh]: opts })),
                            );
                          }
                        }}
                        onChange={(v) => {
                          setPushToReceiptLineLoc((prev) => ({ ...prev, [rid]: v ?? undefined }));
                          const o = locOpts.find((x) => x.value === v);
                          setPushToReceiptLineLocCode((prev) => {
                            const next = { ...prev };
                            if (v == null) delete next[rid];
                            else next[rid] = o?.code ?? '';
                            return next;
                          });
                        }}
                      />
                    );
                  },
                },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.batchNo'),
                  width: 120,
                  render: (_: any, record: PurchaseOrderItem) =>
                    record.id != null ? (pushToReceiptBatchNumbers[record.id] ?? (pushToReceiptPreviewLoading ? t('app.kuaizhizao.purchaseOrder.loading') : '-')) : '-',
                },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.receiptQty'),
                  width: 110,
                  align: 'right',
                  render: (_: any, record: PurchaseOrderItem) => (record.id != null ? (
                    <InputNumber
                      min={0}
                      max={Number(record.outstanding_quantity ?? 0)}
                      value={pushToReceiptQuantities[record.id] ?? 0}
                      onChange={(v) =>
                        setPushToReceiptQuantities((prev) => ({
                          ...prev,
                          [record.id!]: Number(v) || 0,
                        }))
                      }
                      style={{ width: 88 }}
                    />
                  ) : null),
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* 下推收货通知 Modal */}
      <Modal
        title={pushToReceiptNoticeAction.label}
        open={pushToNoticeVisible}
        onCancel={() => {
          setPushToNoticeVisible(false);
          setPushToNoticeOrder(null);
          setPushToNoticeQuantities({});
        }}
        onOk={handlePushToNoticeConfirm}
        confirmLoading={pushToNoticeLoading}
        okText={t('app.kuaizhizao.purchaseOrder.confirmPush')}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnHidden
      >
        {pushToNoticeOrder && (
          <div>
            <p style={{ marginBottom: 16 }}>
              {t('app.kuaizhizao.purchaseOrder.pushNoticeIntro', { code: pushToNoticeOrder.order_code })}
            </p>
            <Table
              size="small"
              dataSource={(pushToNoticeOrder.items || []).filter(
                (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
              )}
              rowKey="id"
              pagination={false}
              scroll={{ x: 700 }}
              columns={[
                { title: t('app.kuaizhizao.purchaseOrder.col.materialCode'), dataIndex: 'material_code', width: 120 },
                { title: t('app.kuaizhizao.purchaseOrder.col.materialName'), dataIndex: 'material_name', width: 150 },
                { title: t('app.kuaizhizao.purchaseOrder.col.orderedQty'), dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                { title: t('app.kuaizhizao.purchaseOrder.col.receivedQty'), dataIndex: 'received_quantity', width: 90, align: 'right' },
                { title: t('app.kuaizhizao.purchaseOrder.col.outstandingQty'), dataIndex: 'outstanding_quantity', width: 90, align: 'right' },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.noticeQty'),
                  width: 140,
                  align: 'right',
                  render: (_: any, record: PurchaseOrderItem) => (record.id != null ? (
                    <InputNumber
                      min={0}
                      max={Number(record.outstanding_quantity ?? 0)}
                      value={pushToNoticeQuantities[record.id] ?? 0}
                      onChange={(v) =>
                        setPushToNoticeQuantities((prev) => ({
                          ...prev,
                          [record.id!]: Number(v) || 0,
                        }))
                      }
                      style={{ width: 100 }}
                    />
                  ) : null),
                },
              ]}
            />
          </div>
        )}
      </Modal>

      <Modal
        title={pushToPurchaseReturnAction.label}
        open={pushToReturnVisible}
        onCancel={() => {
          setPushToReturnVisible(false);
          setPushToReturnOrder(null);
          setPushToReturnQuantities({});
          setPushToReturnWarehouseId(undefined);
          setPushToReturnWarehouseName('');
        }}
        onOk={handlePushToReturnConfirm}
        confirmLoading={pushToReturnLoading}
        okText={t('app.kuaizhizao.purchaseOrder.confirmPush')}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnHidden
      >
        {pushToReturnOrder && (
          <div>
            <p style={{ marginBottom: 12 }}>
              {t('app.kuaizhizao.purchaseOrder.pushReturnIntro', { code: pushToReturnOrder.order_code })}
            </p>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={8}>
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  value={pushToReturnWarehouseId}
                  onChange={(v) => setPushToReturnWarehouseId(Number(v) || undefined)}
                  placeholder={t('app.kuaizhizao.purchaseOrder.returnWarehouseIdPlaceholder')}
                />
              </Col>
              <Col span={16}>
                <Input
                  value={pushToReturnWarehouseName}
                  onChange={(e) => setPushToReturnWarehouseName(e.target.value)}
                  placeholder={t('app.kuaizhizao.purchaseOrder.returnWarehouseNamePlaceholder')}
                />
              </Col>
            </Row>
            <Table
              size="small"
              dataSource={(pushToReturnOrder.items || []).filter((it: PurchaseOrderItem) => (it.received_quantity ?? 0) > 0)}
              rowKey="id"
              pagination={false}
              scroll={{ x: 700 }}
              columns={[
                { title: t('app.kuaizhizao.purchaseOrder.col.materialCode'), dataIndex: 'material_code', width: 120 },
                { title: t('app.kuaizhizao.purchaseOrder.col.materialName'), dataIndex: 'material_name', width: 150 },
                { title: t('app.kuaizhizao.purchaseOrder.col.orderedQty'), dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                { title: t('app.kuaizhizao.purchaseOrder.col.receivedQty'), dataIndex: 'received_quantity', width: 90, align: 'right' },
                {
                  title: t('app.kuaizhizao.purchaseOrder.col.returnQty'),
                  width: 140,
                  align: 'right',
                  render: (_: any, record: PurchaseOrderItem) => (record.id != null ? (
                    <InputNumber
                      min={0}
                      max={Number(record.received_quantity ?? 0)}
                      value={pushToReturnQuantities[record.id] ?? 0}
                      onChange={(v) =>
                        setPushToReturnQuantities((prev) => ({
                          ...prev,
                          [record.id!]: Number(v) || 0,
                        }))
                      }
                      style={{ width: 100 }}
                    />
                  ) : null),
                },
              ]}
            />
          </div>
        )}
      </Modal>
      {PrintModal}
    </>
  );
};

export default PurchaseOrdersPage;




