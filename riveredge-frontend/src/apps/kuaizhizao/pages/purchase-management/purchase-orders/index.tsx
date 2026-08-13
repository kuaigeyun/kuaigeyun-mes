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
import { useLeaveFormTab } from '../../../../../components/uni-tabs/navigateClosingTab';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import type { DescriptionsProps } from 'antd';
import { App, Button, Tag, Space, Modal, Row, Col, Table, Empty, Timeline, Divider, Form as AntForm, Input, InputNumber, DatePicker, List, Typography, theme, Dropdown, Descriptions, Spin, Select, Switch, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import {
  pickImportExampleValue,
} from '../../../../../utils/loadImportDictionaryValues';
import { useImportDictionaryOptions } from '../../../../../hooks/useImportDictionaryOptions';
import { useImportMaterialUnitOptions } from '../../../../master-data/hooks/useImportMaterialUnitOptions';
import {
  buildImportPriceTypeOptions,
  parseImportPriceType,
} from '../../sales-management/shared/salesPriceType';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleTwoTone, CloseCircleTwoTone, DownOutlined, FileTextOutlined, AppstoreAddOutlined, ArrowLeftOutlined, ImportOutlined, PrinterOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { getDataDictionaryByCode, getDictionaryItemList, type DictionaryItem } from '../../../../../services/dataDictionary';
import { mapSystemDictionaryItemOptions, resolveSystemDictionaryItemLabel } from '../../../../../utils/systemDictionaryI18n';
import { getFileDownloadUrl } from '../../../../../services/file';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { UniTable, readPersistedUniTableViewType, type UniTableRequestMeta} from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UniTableStackedLineBadge,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  MaterialStackedCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniAuditBatchMenuButton, UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerActions,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  DocumentFormPageLayout,
  DocumentFormPageHeaderActions,
  DetailDrawerSection,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
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
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { buildUniPushMenuItems, buildUniPushToolbarDisabledReason, UniPushToolbarButton } from '../../../../../components/uni-push';
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
import { DocumentLineUnitSelect } from '../../../../../components/quantity-with-unit';
import { resolveMaterialScenarioUnit } from '../../../../../utils/materialScenarioUnit';
import type { Material } from '../../../../master-data/types/material';
import FeeDetailsTable from '../../../../../components/FeeDetailsTable';
import PriceTypeSwitch, { type PriceTypeValue } from '../../../../../components/price-type-switch/PriceTypeSwitch';
import { setFormPriceType } from '../../../../../utils/priceTypeSwitch';
import dayjs from 'dayjs';
import { formatDateTime, formatQuantity } from '../../../../../utils/format';
import { QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import {
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder,
  deletePurchaseOrder, approvePurchaseOrder, submitPurchaseOrder,
  withdrawPurchaseOrder,
  revokePurchaseOrder,
  pushPurchaseOrderToReceipt,
  pushPurchaseOrderToReceiptNotice, pushPurchaseOrderToInvoice, pushPurchaseOrderToPurchaseReturn,
  pullPurchaseOrderFromInquiry, getPurchaseOrderStatistics,
  previewPushToReceiptNotice, previewPushToReceipt, previewPushToInvoice, previewPushToPurchaseReturn,
  type DocumentPushPreview,
  PurchaseOrder, PurchaseOrderItem
} from '../../../services/purchase';
import {
  listPurchaseRequisitions,
  convertToPurchaseOrder,
  previewPushToPurchaseOrder,
  type PurchaseRequisition,
  type DocumentPushPreview as RequisitionDocumentPushPreview,
} from '../../../services/purchase-requisition';
import {
  listPurchaseInquiries,
  previewPushInquiryToPurchaseOrder,
  type PurchaseInquiry,
} from '../../../services/purchase-inquiry';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  purchaseInquiryCapabilityReasonMessage,
  purchaseOrderCapabilityReasonMessage,
  purchaseRequisitionCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';
import { listPurchaseOrderChangesByOrder, type PurchaseOrderChange } from '../../../services/purchase-order-change';
import LandingCostAllocationModal from './LandingCostAllocationModal';
import { bankAccountService, type BankAccount } from '../../../../kuaicaiwu/services/finance/bank-account';
import { formatBankAccountOptionLabel } from '../../../../kuaicaiwu/utils/financeSharedOptions';
import { formatApiErrorDetail } from '../../../../../services/api';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import {
  applyPurchaseDocumentLineMaterialPricing,
  resolvePurchaseDocumentMaterialLinesPricing,
} from '../../../../master-data/utils/resolve-partner-material-price';
import { getApprovalStatus, ApprovalStatusResponse } from '../../../../../services/approvalInstance';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';

const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { searchUserDisplay, type User } from '../../../../../services/user';
import {
  referenceDisplayToIdOptions,
  searchReferenceDisplay,
} from '../../../../../utils/referenceDisplay';
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
import { PurchaseOrderAiCreateTrigger } from './components/PurchaseOrderAiCreateDrawer';
import { useKuaiaiEntryAvailable } from '../../../../kuaiai/hooks/useKuaiaiEntryAvailable';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import {
  alignProColumns,
  GLOBAL_DOC_DETAIL_TABLE_FIELD_RANK,
  SALES_DOC_LIST_FIELD_RANK,
} from '../../sales-management/shared/documentFieldAlignment';
import {
  DocumentPushProgressBar,
  DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
  DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS,
  ratioToPushProgressPercent,
} from '../../sales-management/shared/DocumentPushProgressBar';
import { collectPurchaseOrderPushDocuments } from '../../sales-management/shared/pushProgress';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import type { SubStage } from '../../../../../components/uni-lifecycle/types';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useNumericPrecision } from '../../../../../hooks/useNumericPrecision';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  purchaseOrderBatchPushReceiptNoticeAllowed,
} from '../../../../../hooks/useDocumentCapabilities';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { SupplierSelectDropdown } from '../../../../master-data/components/SupplierSelectDropdown';
import { batchImport } from '../../../../../utils/batchOperations';
import { ROUTES } from '../../../constants/routes';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { warehouseApi as masterWarehouseApi } from '../../../../master-data/services/warehouse';
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';

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

/** 采购明细行（订单 + 明细合并，用于明细表格平铺） */
type PurchaseOrderItemRow = PurchaseOrderItem & {
  _rowKey: string;
  purchase_order_id: number;
  order_code?: string;
  supplier_name?: string;
  buyer_name?: string;
  order_date?: string;
  delivery_date?: string;
  total_quantity?: number;
  total_amount?: number;
  status?: string;
  review_status?: string;
  receipt_progress?: number;
  downstream_push_progress?: number;
  downstream_receipt_notice_codes?: string[];
  downstream_purchase_receipt_codes?: string[];
};

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

type PullPurchaseRequisitionCandidate = {
  id: number;
  requisition_code?: string;
  requisition_name?: string;
  applicant_name?: string;
  requisition_date?: string;
  status?: string;
  required_date?: string;
  items_count?: number;
  capabilities?: PurchaseRequisition['capabilities'];
};

type PullPurchaseInquiryCandidate = {
  id: number;
  inquiry_code?: string;
  inquiry_name?: string;
  buyer_name?: string;
  inquiry_date?: string;
  status?: string;
  items_count?: number;
  capabilities?: PurchaseInquiry['capabilities'];
};

type PushPreviewKind = 'receipt_notice' | 'receipt' | 'invoice' | 'purchase_return';

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
  const { quantity: quantityDecimals, price: priceDecimals, amount: amountDecimals } = useNumericPrecision();
  const kuaiaiAvailable = useKuaiaiEntryAvailable();
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
  /** 列表当前页数据（唯一源：UniTable onTableDataChange，与表格展示一致） */
  const [tableOrders, setTableOrders] = useState<PurchaseOrder[]>([]);
  const purchaseOrderListPersistenceId =
    'apps.kuaizhizao.pages.purchase-management.purchase-orders.v5';
  const [viewTypeState, setViewTypeState] = useState<'table' | 'detailTable' | 'help'>(() =>
    readPersistedUniTableViewType(purchaseOrderListPersistenceId, 'table', [
      'table',
      'detailTable',
      'help',
    ]) as 'table' | 'detailTable' | 'help',
  );
  const dataViewMode = viewTypeState === 'table' ? 'order' : 'detail';
  const dataViewModeRef = useRef(dataViewMode);
  useEffect(() => {
    dataViewModeRef.current = dataViewMode;
  }, [dataViewMode]);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();

  const materialUnitImport = useImportMaterialUnitOptions();
  const purchaseOrderImportDict = useImportDictionaryOptions(['CURRENCY', 'ORDER_TYPE']);
  const purchaseOrderLineUnitOptions = materialUnitImport.options;
  const purchaseOrderLineImportColumnOptions = useMemo(
    () => [undefined, undefined, purchaseOrderLineUnitOptions, undefined, undefined, undefined],
    [purchaseOrderLineUnitOptions],
  );
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
          { field: 'supplierContact', labelKey: 'app.kuaizhizao.purchaseOrder.import.supplierContact', aliases: ['供应商联系人'] },
          { field: 'supplierPhone', labelKey: 'app.kuaizhizao.purchaseOrder.import.supplierPhone', aliases: ['供应商电话'] },
          { field: 'orderType', labelKey: 'app.kuaizhizao.purchaseOrder.import.orderType', aliases: ['订单类型'] , options: purchaseOrderImportDict.ORDER_TYPE },
          { field: 'buyer', labelKey: 'app.kuaizhizao.purchaseOrder.import.buyer', aliases: ['采购员'] },
          { field: 'currency', labelKey: 'app.kuaizhizao.quotation.form.currency', aliases: ['币种'] , options: purchaseOrderImportDict.CURRENCY },
          { field: 'priceType', labelKey: 'app.kuaizhizao.salesOrder.priceType', aliases: ['价格类型'] , options: buildImportPriceTypeOptions(t) },
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
          '',
          pickImportExampleValue(purchaseOrderImportDict.ORDER_TYPE, ''),
          '',
          pickImportExampleValue(purchaseOrderImportDict.CURRENCY, 'CNY'),
          pickImportExampleValue(buildImportPriceTypeOptions(t), t('app.kuaizhizao.salesContract.priceTypeTaxInclusive')),
          '',
        ],
      ),
    [t, i18n.language, purchaseOrderImportDict],
  );

  const tableSearchFormRef = useRef<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [highlightDeliveryOverdue, setHighlightDeliveryOverdue] = useState(false);

  const selectedOrdersForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableOrders.find((row) => String(row.id) === String(key)))
        .filter((row): row is PurchaseOrder => row != null),
    [selectedRowKeys, tableOrders],
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

  const leavePurchaseOrderFormPage = useLeaveFormTab(PURCHASE_ORDER_LIST_PATH);
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
    () => (orderDetail ? getPurchaseOrderLifecycle(orderDetail, purchaseOrderAuditEnabled, t) : null),
    [orderDetail, purchaseOrderAuditEnabled, t],
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
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const bankAccountOptions = useMemo(
    () =>
      bankAccounts.map((a) => ({
        label: formatBankAccountOptionLabel(a),
        value: a.id,
      })),
    [bankAccounts],
  );
  const [users, setUsers] = useState<User[]>([]);
  const currentUser = useCurrentUser();
  const [usersLoading, setUsersLoading] = useState(false);

  // 审批流程相关状态
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatusResponse | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);

  // 下推退货 Modal
  const [pushToReturnVisible, setPushToReturnVisible] = useState(false);
  const [landingCostModalVisible, setLandingCostModalVisible] = useState(false);

  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['purchaseOrderStatistics'] });
  };

  useEffect(() => {
    if (!isFormPage) return;
    const loadSuppliers = async () => {
      setSuppliersLoading(true);
      try {
        const res = await apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', {
          params: { limit: 200, is_active: true },
        });
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
        const res = await searchUserDisplay({ page_size: 100, is_active: true });
        setUsers(displayItemsToUsers(res.items || []));
      } catch {
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };
    const loadBankAccounts = async () => {
      try {
        const res = await bankAccountService.list({ limit: 200, is_active: true });
        setBankAccounts(res.data || []);
      } catch (e: unknown) {
        setBankAccounts([]);
        const err = e as { response?: { data?: { detail?: unknown } }; message?: string };
        messageApi.error(
          formatApiErrorDetail(err?.response?.data?.detail) ||
            err?.message ||
            t('app.kuaizhizao.purchaseOrder.loadBankAccountsFailed'),
        );
      }
    };
    loadSuppliers();
    loadUsers();
    loadBankAccounts();
  }, [currentUser, messageApi, t, isFormPage]);

  const purchaseOrderSupplierSearchOptions = useMemo(
    () =>
      supplierList.map((s: { id?: number; name?: string; code?: string; supplier_name?: string }) => ({
        value: Number(s.id),
        label: [s.name ?? s.supplier_name, s.code].filter(Boolean).join(' - ') || String(s.id),
      })),
    [supplierList],
  );

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
      const priceType = String(formRef.current?.getFieldValue('price_type') ?? 'tax_exclusive');

      const priced = await resolvePurchaseDocumentMaterialLinesPricing(selected, {
        supplierId: supplierId ? Number(supplierId) : undefined,
        asOf,
        priceType,
      });

      const current = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));
      const newRows = priced.map(({ material: m, unitPrice, taxRate }) => ({
        material_id: (m as Material).id,
        material_code: (m as Material).mainCode ?? (m as Material).code ?? '',
        material_name: (m as Material).name ?? '',
        material_spec: (m as Material).specification ?? '',
        unit: resolveMaterialScenarioUnit(m as Material, 'purchase'),
        ordered_quantity: 1,
        unit_price: unitPrice,
        tax_rate: taxRate,
        required_date: defaultDate,
      }));
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
          const unitRaw = String(row[2] || '').trim();
          const unit = materialUnitImport.parse(unitRaw) || unitRaw;
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
    [messageApi, materialUnitImport, t],
  );

  // 下推退货 Modal 相关详情状态
  const [pushToReturnOrder, setPushToReturnOrder] = useState<PurchaseOrderDetail | null>(null);
  const [pushToReturnQuantities, setPushToReturnQuantities] = useState<Record<number, number>>({});
  const [pushToReturnWarehouseId, setPushToReturnWarehouseId] = useState<number | undefined>(undefined);
  const [pushToReturnWarehouseName, setPushToReturnWarehouseName] = useState('');
  const [pushToReturnLoading, setPushToReturnLoading] = useState(false);
  const [landingCostOrder, setLandingCostOrder] = useState<PurchaseOrder | null>(null);

  /** 列表列顺序：金额/数量/时间在前；生命周期固定倒数第二；操作列最后（与 UI_Standard 一致） */
  const purchaseOrderCustomFieldColumns = generatePurchaseOrderCustomFieldColumns();
  const orderColumns: ProColumns<PurchaseOrder>[] = useMemo(() => alignProColumns<PurchaseOrder>([
    {
      title: t('app.kuaizhizao.purchaseOrder.col.orderDate'),
      dataIndex: 'order_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.deliveryDate'),
      dataIndex: 'delivery_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.supplierAndOrder'),
      key: 'order_code',
      dataIndex: 'order_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      sorter: true,
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
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.supplier'),
      dataIndex: 'supplier_id',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        filterOption: false,
        placeholder: t('app.kuaizhizao.purchaseOrder.col.supplier'),
      },
      debounceTime: 300,
      request: async ({ keyWords }) => {
        const res = await searchReferenceDisplay({
          resource: 'master-data:supply-chain:supplier',
          hostResource: 'kuaizhizao:purchase-order',
          keyword: typeof keyWords === 'string' ? keyWords.trim() : undefined,
          pageSize: 20,
        });
        return referenceDisplayToIdOptions(res.items);
      },
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.supplier'),
      dataIndex: 'supplier_name',
      hideInTable: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.buyer'),
      dataIndex: 'buyer_id',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        filterOption: false,
        placeholder: t('app.kuaizhizao.purchaseOrder.col.buyer'),
      },
      debounceTime: 300,
      request: async ({ keyWords }) => {
        const res = await searchUserDisplay({
          page: 1,
          page_size: 20,
          is_active: true,
          keyword: typeof keyWords === 'string' ? keyWords.trim() || undefined : undefined,
        });
        return (res.items || []).map((u) => ({
          label: u.label || u.full_name || u.username || String(u.id),
          value: u.id,
        }));
      },
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.buyer'),
      dataIndex: 'buyer_name',
      width: 120,
      sorter: true,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.orderDate'),
      key: 'order_date_delivery_date_stacked',
      dataIndex: 'order_date',
      width: 148,
      uniTableKeepWidth: true,
      sorter: true,
      defaultSortOrder: 'descend',
      hideInSearch: true,
      render: (_: any, record: PurchaseOrder) => (
        <UniTableStackedPrimaryCell
          primary={record.order_date ? formatDateTime(record.order_date, 'YYYY-MM-DD') : '-'}
          secondary={record.delivery_date ? formatDateTime(record.delivery_date, 'YYYY-MM-DD') : '-'}
          secondaryCopyable={false}
          uniformText
          primaryBadge={t('common.start')}
          secondaryBadge={t('common.end')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
      dataIndex: 'downstream_push_progress',
      ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
      render: (_: any, record: PurchaseOrder) => {
        const percent = Number(record.downstream_push_progress ?? 0);
        return (
          <DocumentPushProgressBar
            percent={percent}
            tooltip={t('app.kuaizhizao.salesManagement.pushProgress.percentOnly', {
              percent: Math.round(percent),
            })}
            documents={collectPurchaseOrderPushDocuments(record, {
              receiptNotice: t('components.documentTrackingPanel.docType.receipt_notice'),
              purchaseReceipt: t('components.documentTrackingPanel.docType.purchase_receipt'),
            })}
            formatMoreDocs={(count) =>
              t('app.kuaizhizao.salesManagement.pushProgress.moreDocs', { count })
            }
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.receiptProgress'),
      dataIndex: 'receipt_progress',
      ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
      render: (_: any, record: PurchaseOrder) => {
        const percent = Number(record.receipt_progress ?? 0);
        return (
          <DocumentPushProgressBar
            percent={percent}
            tooltip={t('app.kuaizhizao.salesManagement.pushProgress.percentOnly', {
              percent: Math.round(percent),
            })}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.orderAmount'),
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (text: any) => `¥${formatAmount(text)}`,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: formatQuantity,
    },
    ...buildDocumentAuditColumns<PurchaseOrder>(t),
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
    ...(purchaseOrderAuditColumn ? [purchaseOrderAuditColumn] : []),
    {
      title: t('app.kuaizhizao.purchaseOrder.col.lifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      fixed: 'right',
      valueType: 'select',
      valueEnum: lifecycleValueEnum,
      render: (_: any, record: PurchaseOrder) => (
        <ListUniLifecycleCell lifecycle={getPurchaseOrderLifecycle(record, purchaseOrderAuditEnabled, t)} />
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
              if (detailDrawerVisible && orderDetail?.id === record.id && record.id != null) {
                void getPurchaseOrder(record.id).then((d) => {
                  setOrderDetail(d);
                  setPoTrackingRefreshKey((k) => k + 1);
                });
              }
            }}
          />
        );
        return parts;
      },
    },
  ], SALES_DOC_LIST_FIELD_RANK), [t, purchaseOrderAuditEnabled, lifecycleValueEnum, purchaseOrderAuditColumn, purchaseOrderCustomFieldColumns, purchaseOrderPerms, purchaseOrderSupplierSearchOptions, detailDrawerVisible, orderDetail?.id]);

  /** 明细表格列序：GLOBAL_DOC_DETAIL_TABLE_FIELD_RANK（禁止套用 LIST rank） */
  const detailTableColumns: ProColumns<PurchaseOrderItemRow>[] = useMemo(
    () =>
      alignProColumns<PurchaseOrderItemRow>(
        [
      {
        title: t('app.kuaizhizao.purchaseOrder.col.supplierAndOrder'),
        key: 'order_code',
        dataIndex: 'order_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: false,
        fieldProps: { placeholder: t('app.kuaizhizao.purchaseOrder.col.orderCode') },
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.supplier_name ?? '')}
            secondary={String(record.order_code ?? '')}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.supplier'),
        dataIndex: 'supplier_id',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          showSearch: true,
          filterOption: false,
          placeholder: t('app.kuaizhizao.purchaseOrder.col.supplier'),
        },
        debounceTime: 300,
        request: async ({ keyWords }) => {
          const res = await searchReferenceDisplay({
            resource: 'master-data:supply-chain:supplier',
            hostResource: 'kuaizhizao:purchase-order',
            keyword: typeof keyWords === 'string' ? keyWords.trim() : undefined,
            pageSize: 20,
          });
          return referenceDisplayToIdOptions(res.items);
        },
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.materialName'),
        key: 'material_display',
        dataIndex: 'material_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, record) => (
          <MaterialStackedCell
            material_name={record.material_name}
            material_code={record.material_code}
            material_spec={record.material_spec}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.materialCode'),
        dataIndex: 'material_code',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.spec'),
        dataIndex: 'material_spec',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.quantity'),
        dataIndex: 'ordered_quantity',
        width: 120,
        align: 'right',
        render: (val: unknown, record: PurchaseOrderItemRow) => (
          <QuantityWithUnitDisplay quantity={val} unit={record.unit} />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.unitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        align: 'right',
        render: (text: unknown) => `¥${formatAmount(text)}`,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.totalPrice'),
        dataIndex: 'total_price',
        width: 110,
        align: 'right',
        render: (text: unknown) => `¥${formatAmount(text)}`,
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.receivedQty'),
        dataIndex: 'received_quantity',
        width: 90,
        align: 'right',
        render: (text: unknown) => formatQuantity(text),
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.outstandingQty'),
        dataIndex: 'outstanding_quantity',
        width: 90,
        align: 'right',
        render: (text: unknown) => formatQuantity(text),
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.requiredDelivery'),
        dataIndex: 'required_date',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_: unknown, row: PurchaseOrderItemRow) => {
          const raw = row.required_date;
          const text = raw ? formatDateTime(raw, 'YYYY-MM-DD') : '-';
          const overdue = isPurchaseOrderDeliveryOverdue(
            {
              delivery_date: row.required_date || row.delivery_date,
              status: row.status,
              review_status: row.review_status,
            } as PurchaseOrder,
            purchaseOrderAuditEnabled,
          );
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <span>{text}</span>
              {overdue ? (
                <UniTableStackedLineBadge tone="danger">
                  {t('app.kuaizhizao.purchaseOrder.overdueBadge')}
                </UniTableStackedLineBadge>
              ) : null}
            </span>
          );
        },
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.lineReceiptProgress'),
        key: 'line_receipt_progress',
        dataIndex: 'line_receipt_progress',
        ...DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS,
        render: (_: unknown, record: PurchaseOrderItemRow) => {
          const ordered = Number(record.ordered_quantity ?? 0);
          const received = Number(record.received_quantity ?? 0);
          const percent = ratioToPushProgressPercent(received, ordered);
          return (
            <DocumentPushProgressBar
              percent={percent}
              tooltip={t('app.kuaizhizao.purchaseOrder.col.receiptProgressTip', {
                received: formatQuantity(received),
                ordered: formatQuantity(ordered),
                percent,
              })}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.lifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        fixed: 'right',
        hideInSearch: false,
        valueType: 'select',
        valueEnum: lifecycleValueEnum,
        render: (_: unknown, record: PurchaseOrderItemRow) => {
          const orderRecord = {
            id: record.purchase_order_id,
            status: record.status,
            review_status: record.review_status,
            receipt_progress: record.receipt_progress,
            downstream_push_progress: record.downstream_push_progress,
          } as PurchaseOrder;
          return (
            <ListUniLifecycleCell
              lifecycle={getPurchaseOrderLifecycle(orderRecord, purchaseOrderAuditEnabled, t)}
            />
          );
        },
      },
        ],
        GLOBAL_DOC_DETAIL_TABLE_FIELD_RANK,
      ),
    [t, purchaseOrderAuditEnabled, lifecycleValueEnum, purchaseOrderSupplierSearchOptions],
  );

  const columns = (dataViewMode === 'detail' ? detailTableColumns : orderColumns) as ProColumns<any>[];

  const [pushToInvoiceLoading, setPushToInvoiceLoading] = useState(false);

  const pullQueryCloseRef = useRef<(() => void) | null>(null);

  const [pullRequisitionPreviewOpen, setPullRequisitionPreviewOpen] = useState(false);
  const [pullRequisitionPreviewLoading, setPullRequisitionPreviewLoading] = useState(false);
  const [pullRequisitionPreviewConfirming, setPullRequisitionPreviewConfirming] = useState(false);
  const [pullRequisitionPreviewData, setPullRequisitionPreviewData] = useState<RequisitionDocumentPushPreview | null>(null);
  const [pullRequisitionPreviewId, setPullRequisitionPreviewId] = useState<number | null>(null);
  const [pullRequisitionSelectedItemIds, setPullRequisitionSelectedItemIds] = useState<number[]>([]);

  const [pullInquiryPreviewOpen, setPullInquiryPreviewOpen] = useState(false);
  const [pullInquiryPreviewLoading, setPullInquiryPreviewLoading] = useState(false);
  const [pullInquiryPreviewConfirming, setPullInquiryPreviewConfirming] = useState(false);
  const [pullInquiryPreviewData, setPullInquiryPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pullInquiryPreviewId, setPullInquiryPreviewId] = useState<number | null>(null);
  const [pullInquirySelectedItemIds, setPullInquirySelectedItemIds] = useState<number[]>([]);

  const [pushPreviewOpen, setPushPreviewOpen] = useState(false);
  const [pushPreviewKind, setPushPreviewKind] = useState<PushPreviewKind | null>(null);
  const [pushPreviewLoading, setPushPreviewLoading] = useState(false);
  const [pushPreviewConfirming, setPushPreviewConfirming] = useState(false);
  const [pushPreviewData, setPushPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pushPreviewTarget, setPushPreviewTarget] = useState<PurchaseOrder | null>(null);
  const [pushPreviewSelectedItemIds, setPushPreviewSelectedItemIds] = useState<number[]>([]);
  const [pushPreviewQuantities, setPushPreviewQuantities] = useState<Record<number, number>>({});
  const [pushPreviewLineWh, setPushPreviewLineWh] = useState<Record<number, number>>({});
  const [pushPreviewWarehouseOptions, setPushPreviewWarehouseOptions] = useState<Array<{ label: string; value: number }>>([]);

  const pushPreviewModalTitle = useMemo(() => {
    if (pushPreviewKind === 'receipt_notice') return pushToReceiptNoticeAction.label;
    if (pushPreviewKind === 'receipt') return pushToReceiptAction.label;
    if (pushPreviewKind === 'invoice') return pushToInvoiceAction.label;
    if (pushPreviewKind === 'purchase_return') return pushToPurchaseReturnAction.label;
    return t('app.kuaizhizao.salesOrder.pushPreviewTitle');
  }, [
    pushPreviewKind,
    pushToInvoiceAction.label,
    pushToPurchaseReturnAction.label,
    pushToReceiptAction.label,
    pushToReceiptNoticeAction.label,
    t,
  ]);

  const pushPreviewQtyColumnTitles = useMemo(() => {
    if (pushPreviewKind === 'receipt_notice' || pushPreviewKind === 'receipt') {
      return {
        quantity: t('app.kuaizhizao.purchaseOrder.col.orderedQty'),
        pushed: t('app.kuaizhizao.purchaseOrder.col.receivedQty'),
        pushable: t('app.kuaizhizao.purchaseOrder.col.outstandingQty'),
      };
    }
    if (pushPreviewKind === 'purchase_return') {
      return {
        quantity: t('app.kuaizhizao.salesOrder.quantity'),
        pushed: t('app.kuaizhizao.salesOrder.colPushedQty'),
        pushable: t('app.kuaizhizao.salesOrder.colPushableQty'),
      };
    }
    return {
      quantity: t('app.kuaizhizao.salesOrder.quantity'),
      pushed: t('app.kuaizhizao.salesOrder.colPushedQty'),
      pushable: t('app.kuaizhizao.salesOrder.colPushableQty'),
    };
  }, [pushPreviewKind, t]);

  const pushPreviewConfirmLabel =
    pushPreviewKind === 'receipt_notice' || pushPreviewKind === 'receipt'
      ? t('app.kuaizhizao.salesOrder.confirmPush')
      : t('common.confirm');

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

  const resetPushPreviewModal = useCallback(() => {
    setPushPreviewOpen(false);
    setPushPreviewKind(null);
    setPushPreviewData(null);
    setPushPreviewTarget(null);
    setPushPreviewSelectedItemIds([]);
    setPushPreviewQuantities({});
    setPushPreviewLineWh({});
    setPushPreviewWarehouseOptions([]);
  }, []);

  const resetPullRequisitionPreviewModal = useCallback(() => {
    setPullRequisitionPreviewOpen(false);
    setPullRequisitionPreviewData(null);
    setPullRequisitionPreviewId(null);
    setPullRequisitionSelectedItemIds([]);
  }, []);

  const resetPullInquiryPreviewModal = useCallback(() => {
    setPullInquiryPreviewOpen(false);
    setPullInquiryPreviewData(null);
    setPullInquiryPreviewId(null);
    setPullInquirySelectedItemIds([]);
  }, []);

  const openPushReturnWarehouseModal = useCallback(
    async (record: PurchaseOrder, quantities: Record<number, number>) => {
      const detail = await getPurchaseOrder(record.id!);
      const items = (detail.items || []).filter(
        (it: PurchaseOrderItem) => it.id != null && (quantities[it.id] ?? 0) > 0,
      );
      if (items.length === 0) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.noReturnableQty'));
        return;
      }
      setPushToReturnOrder(detail as PurchaseOrderDetail);
      setPushToReturnQuantities(quantities);
      setPushToReturnVisible(true);
    },
    [messageApi, t],
  );

  const loadPushPreview = useCallback(
    async (record: PurchaseOrder, kind: PushPreviewKind) => {
      if (!record.id) return;
      setPushPreviewOpen(true);
      setPushPreviewKind(kind);
      setPushPreviewTarget(record);
      setPushPreviewConfirming(false);
      setPushPreviewSelectedItemIds([]);
      setPushPreviewQuantities({});
      setPushPreviewLineWh({});
      setPushPreviewWarehouseOptions([]);
      setPushPreviewLoading(true);
      setPushPreviewData(null);
      try {
        let preview: DocumentPushPreview;
        if (kind === 'receipt_notice') {
          preview = await previewPushToReceiptNotice(record.id);
        } else if (kind === 'receipt') {
          preview = await previewPushToReceipt(record.id);
        } else if (kind === 'invoice') {
          preview = await previewPushToInvoice(record.id);
        } else {
          preview = await previewPushToPurchaseReturn(record.id);
        }
        setPushPreviewData(preview);
        const rows = preview.items || [];
        const ids: number[] = [];
        const qtyMap: Record<number, number> = {};
        const lineWh: Record<number, number> = {};
        rows.forEach((row) => {
          const itemId = Number(row.item_id);
          if (!Number.isFinite(itemId) || itemId <= 0) return;
          const defaultQty = Number(row.max_push_quantity ?? 0);
          if (Number.isFinite(defaultQty) && defaultQty > 0) {
            ids.push(itemId);
          }
          qtyMap[itemId] = Number.isFinite(defaultQty) && defaultQty > 0 ? defaultQty : 0;
          const whId = Number(row.warehouse_id);
          if (Number.isFinite(whId) && whId > 0) {
            lineWh[itemId] = whId;
          }
        });
        setPushPreviewSelectedItemIds(ids);
        setPushPreviewQuantities(qtyMap);
        setPushPreviewLineWh(lineWh);
        if (kind === 'receipt_notice' || kind === 'receipt') {
          const whRes = await masterWarehouseApi.list({ is_active: true, limit: 500 });
          const whList = Array.isArray(whRes) ? whRes : (whRes as { items?: unknown[] })?.items ?? [];
          const warehouseOptions = (Array.isArray(whList) ? whList : []).map((w) => {
            const row = w as { id: number; code?: string; name?: string };
            const label = `${row.code || ''} ${row.name || ''}`.trim() || String(row.id);
            return { label, value: row.id };
          });
          setPushPreviewWarehouseOptions(warehouseOptions);
        }
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrder.push.previewFailed')));
        resetPushPreviewModal();
      } finally {
        setPushPreviewLoading(false);
      }
    },
    [messageApi, resetPushPreviewModal, t],
  );

  const handlePushPreviewConfirm = useCallback(async () => {
    if (!pushPreviewTarget?.id || !pushPreviewData || !pushPreviewKind) return;
    if (pushPreviewData.has_blocking_issues) return;
    const rowById = new Map(
      (pushPreviewData.items || []).map((row) => [Number(row.item_id), row]),
    );
    const selectedIds = pushPreviewSelectedItemIds.filter((id) => {
      const row = rowById.get(id);
      return row && Number(row.max_push_quantity ?? 0) > 0;
    });
    if (pushPreviewKind !== 'invoice' && !selectedIds.length) {
      messageApi.warning(t('app.kuaizhizao.purchaseOrder.push.selectLinesFirst'));
      return;
    }

    const needsLineWarehouse =
      pushPreviewKind === 'receipt_notice' ||
      pushPreviewKind === 'receipt' ||
      !!pushPreviewData.line_warehouse_required;

    const quantities: Record<number, number> = {};
    const lineWarehouses: Record<number, number> = {};
    if (pushPreviewKind !== 'invoice') {
      for (const id of selectedIds) {
        const row = rowById.get(id);
        const qty = Number(pushPreviewQuantities[id] ?? 0);
        const maxQty = Number(row?.max_push_quantity ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) {
          messageApi.warning(
            t('app.kuaizhizao.salesOrder.pushQtyInvalid', { code: row?.material_code || id }),
          );
          return;
        }
        if (Number.isFinite(maxQty) && maxQty > 0 && qty > maxQty) {
          messageApi.warning(
            t('app.kuaizhizao.salesOrder.pushQtyExceedsRemaining', { code: row?.material_code || id }),
          );
          return;
        }
        if (needsLineWarehouse) {
          const lineWh = pushPreviewLineWh[id];
          if (lineWh == null || !(lineWh > 0)) {
            messageApi.warning(
              t('app.kuaizhizao.purchaseOrder.pushReceiptSelectLineWarehouse', {
                material: row?.material_code || row?.material_name || id,
              }),
            );
            return;
          }
          lineWarehouses[id] = lineWh;
        }
        quantities[id] = qty;
      }
    }

    const target = pushPreviewTarget;
    const kind = pushPreviewKind;

    if (kind === 'receipt_notice') {
      setPushPreviewConfirming(true);
      try {
        const result = await pushPurchaseOrderToReceiptNotice(target.id!, {
          selected_item_ids: selectedIds,
          notice_quantities: quantities,
          line_warehouses: lineWarehouses,
        });
        messageApi.success(
          t('app.kuaizhizao.purchaseOrder.pushNoticeSuccess', {
            code: result.notice_code || t('app.kuaizhizao.purchaseOrder.createdFallback'),
          }),
        );
        resetPushPreviewModal();
        invalidateStatistics();
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
        if (detailDrawerVisible && orderDetail?.id === target.id) {
          getPurchaseOrder(target.id!).then(setOrderDetail);
        }
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrder.pushNoticeFailed')));
      } finally {
        setPushPreviewConfirming(false);
      }
      return;
    }

    if (kind === 'receipt') {
      setPushPreviewConfirming(true);
      try {
        let headerWarehouseId: number | undefined;
        for (const id of selectedIds) {
          const wh = lineWarehouses[id];
          if (wh != null && wh > 0 && headerWarehouseId == null) {
            headerWarehouseId = wh;
          }
        }
        const result = await pushPurchaseOrderToReceipt(target.id!, quantities, undefined, {
          warehouseId: headerWarehouseId,
          lineWarehouses,
        });
        const receiptId = Number(result?.id);
        if (!Number.isFinite(receiptId) || receiptId <= 0) {
          messageApi.error(t('app.kuaizhizao.purchaseOrder.pushReceiptFailed'));
          return;
        }
        messageApi.success(
          t('app.kuaizhizao.purchaseOrder.pushReceiptSuccess', {
            code: result.receipt_code || t('app.kuaizhizao.purchaseOrder.createdFallback'),
          }),
        );
        resetPushPreviewModal();
        invalidateStatistics();
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
        if (detailDrawerVisible && orderDetail?.id === target.id) {
          getPurchaseOrder(target.id!).then(setOrderDetail);
        }
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrder.pushReceiptFailed')));
      } finally {
        setPushPreviewConfirming(false);
      }
      return;
    }

    if (kind === 'purchase_return') {
      resetPushPreviewModal();
      await openPushReturnWarehouseModal(target, quantities);
      return;
    }
    resetPushPreviewModal();
    setPushToInvoiceLoading(true);
    try {
      const result = await pushPurchaseOrderToInvoice(target.id!);
      messageApi.success(t('app.kuaizhizao.purchaseOrder.pushInvoiceSuccess', { code: result.invoice_code || t('app.kuaizhizao.purchaseOrder.createdFallback') }));
      invalidateStatistics();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      if (detailDrawerVisible && orderDetail?.id === target.id) {
        getPurchaseOrder(target.id!).then(setOrderDetail);
      }
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrder.pushInvoiceFailed')));
    } finally {
      setPushToInvoiceLoading(false);
    }
  }, [
    detailDrawerVisible,
    invalidateMenuBadgeCounts,
    invalidateStatistics,
    messageApi,
    openPushReturnWarehouseModal,
    orderDetail?.id,
    pushPreviewData,
    pushPreviewKind,
    pushPreviewLineWh,
    pushPreviewQuantities,
    pushPreviewSelectedItemIds,
    pushPreviewTarget,
    resetPushPreviewModal,
    t,
  ]);

  const handlePushToReceipt = useCallback(
    (record: PurchaseOrder) => {
      void loadPushPreview(record, 'receipt');
    },
    [loadPushPreview],
  );

  const handlePushToNotice = useCallback(
    (record: PurchaseOrder) => {
      void loadPushPreview(record, 'receipt_notice');
    },
    [loadPushPreview],
  );

  const handlePushToInvoice = useCallback(
    (record: PurchaseOrder) => {
      void loadPushPreview(record, 'invoice');
    },
    [loadPushPreview],
  );

  const handlePushToReturn = useCallback(
    (record: PurchaseOrder) => {
      void loadPushPreview(record, 'purchase_return');
    },
    [loadPushPreview],
  );

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
    return tableOrders.find((row) => String(row.id) === String(selectedRowKeys[0])) ?? null;
  }, [selectedRowKeys, tableOrders]);

  const buildToolbarPushMenuItems = useCallback((record: PurchaseOrder) => {
      const capReason = (cap?: { allowed?: boolean; reason?: string | null }) =>
        cap?.allowed === true ? undefined : purchaseOrderCapabilityReasonMessage(cap?.reason, t);
      return buildUniPushMenuItems([
        {
          key: 'receipt-notice',
          label: pushToReceiptNoticeAction.label,
          disabled: record.capabilities?.push_receipt_notice?.allowed !== true,
          title: capReason(record.capabilities?.push_receipt_notice),
          onClick: () => {
            if (record.capabilities?.push_receipt_notice?.allowed !== true) return;
            handlePushToNotice(record);
          },
        },
        {
          key: 'receipt',
          label: pushToReceiptAction.label,
          disabled: record.capabilities?.push_receipt?.allowed !== true,
          title: capReason(record.capabilities?.push_receipt),
          onClick: () => {
            if (record.capabilities?.push_receipt?.allowed !== true) return;
            handlePushToReceipt(record);
          },
        },
        {
          key: 'invoice',
          label: pushToInvoiceAction.label,
          disabled: record.capabilities?.push_invoice?.allowed !== true,
          title: capReason(record.capabilities?.push_invoice),
          onClick: () => {
            if (record.capabilities?.push_invoice?.allowed !== true) return;
            handlePushToInvoice(record);
          },
        },
        {
          key: 'purchase-return',
          label: pushToPurchaseReturnAction.label,
          disabled: record.capabilities?.push_purchase_return?.allowed !== true,
          title: capReason(record.capabilities?.push_purchase_return),
          onClick: () => {
            if (record.capabilities?.push_purchase_return?.allowed !== true) return;
            handlePushToReturn(record);
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
      t,
    ],
  );

  const toolbarPushMenuItems = useMemo(
    () => (selectedOrderForToolbar ? buildToolbarPushMenuItems(selectedOrderForToolbar) : buildUniPushMenuItems([])),
    [buildToolbarPushMenuItems, selectedOrderForToolbar],
  );

  const purchaseOrderToolbarPushDisabledReason = useMemo(() => {
    const base = buildUniPushToolbarDisabledReason(t, {
      selectedCount: selectedRowKeys.length,
      hasSelectedRecord: !!selectedOrderForToolbar,
    });
    if (base) return base;
    const caps = selectedOrderForToolbar?.capabilities;
    const anyAllowed =
      caps?.push_receipt_notice?.allowed === true ||
      caps?.push_receipt?.allowed === true ||
      caps?.push_invoice?.allowed === true ||
      caps?.push_purchase_return?.allowed === true;
    if (!anyAllowed) {
      return (
        purchaseOrderCapabilityReasonMessage(
          caps?.push_receipt_notice?.reason ||
            caps?.push_receipt?.reason ||
            caps?.push_invoice?.reason ||
            caps?.push_purchase_return?.reason,
          t,
        ) || t('app.kuaizhizao.purchaseOrder.push.noActions')
      );
    }
    return undefined;
  }, [selectedOrderForToolbar, selectedRowKeys.length, t]);

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
      supplierContact: headerIndexMap['supplierContact'] ?? -1,
      supplierPhone: headerIndexMap['supplierPhone'] ?? -1,
      orderType: headerIndexMap['orderType'] ?? -1,
      buyer: headerIndexMap['buyer'] ?? -1,
      currency: headerIndexMap['currency'] ?? -1,
      priceType: headerIndexMap['priceType'] ?? -1,
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
        groupMap.set(groupKey, {
          code: code || undefined,
          supplier: supplierName,
          date: dateVal,
          supplierContact: idx.supplierContact >= 0 ? String(row[idx.supplierContact] ?? '').trim() || undefined : undefined,
          supplierPhone: idx.supplierPhone >= 0 ? String(row[idx.supplierPhone] ?? '').trim() || undefined : undefined,
          orderType: idx.orderType >= 0 ? purchaseOrderImportDict.parseDict('ORDER_TYPE', String(row[idx.orderType] ?? '').trim()) || undefined : undefined,
          buyer: idx.buyer >= 0 ? String(row[idx.buyer] ?? '').trim() || undefined : undefined,
          currency: idx.currency >= 0 ? purchaseOrderImportDict.parseDict('CURRENCY', String(row[idx.currency] ?? '').trim()) || undefined : undefined,
          priceType: idx.priceType >= 0 ? parseImportPriceType(String(row[idx.priceType] ?? '').trim(), t) : undefined,
          items: [],
        });
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
        supplier_contact: g.supplierContact,
        supplier_phone: g.supplierPhone,
        order_type: g.orderType,
        buyer_name: g.buyer,
        currency: g.currency,
        price_type: g.priceType,
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
          prepayment_amount: detail.prepayment_amount,
          prepayment_bank_account_id: detail.prepayment_bank_account_id,
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
      leavePurchaseOrderFormPage();
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

  const showPullRequisitionPreview = useCallback(
    (requisitionId: number) => {
      setPullRequisitionPreviewOpen(true);
      setPullRequisitionPreviewConfirming(false);
      setPullRequisitionPreviewId(requisitionId);
      setPullRequisitionSelectedItemIds([]);
      setPullRequisitionPreviewLoading(true);
      setPullRequisitionPreviewData(null);
      previewPushToPurchaseOrder(requisitionId)
        .then((preview) => {
          setPullRequisitionPreviewData(preview);
          setPullRequisitionSelectedItemIds(
            (preview.items || [])
              .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
              .map((row) => Number(row.item_id)),
          );
        })
        .catch((error: unknown) => {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrder.pull.previewFailed')));
          resetPullRequisitionPreviewModal();
        })
        .finally(() => setPullRequisitionPreviewLoading(false));
    },
    [messageApi, resetPullRequisitionPreviewModal, t],
  );

  const handlePullRequisitionPreviewConfirm = useCallback(async () => {
    if (!pullRequisitionPreviewId || !pullRequisitionPreviewData) return;
    if (pullRequisitionPreviewData.has_blocking_issues) return;
    const rowById = new Map(
      (pullRequisitionPreviewData.items || []).map((row) => [Number(row.item_id), row]),
    );
    const selectedIds = pullRequisitionSelectedItemIds.filter((id) => {
      const row = rowById.get(id);
      return row && Number(row.max_push_quantity ?? 0) > 0;
    });
    if (!selectedIds.length) {
      messageApi.warning(t('app.kuaizhizao.purchaseOrder.selectRequisitionLinesFirst'));
      return;
    }
    setPullRequisitionPreviewConfirming(true);
    try {
      const itemQuantities = Object.fromEntries(
        selectedIds.map((id) => [id, Number(rowById.get(id)?.max_push_quantity ?? 0)]),
      );
      const itemSuppliers = Object.fromEntries(
        selectedIds
          .filter((id) => rowById.get(id)?.supplier_id != null)
          .map((id) => [id, Number(rowById.get(id)!.supplier_id)]),
      );
      const res = await convertToPurchaseOrder(pullRequisitionPreviewId, {
        item_ids: selectedIds,
        item_quantities: itemQuantities,
        item_suppliers: itemSuppliers,
      });
      const createdCodes: string[] = [];
      if (res.purchase_orders?.length) {
        res.purchase_orders.forEach((po) => {
          if (po.purchase_order_code) createdCodes.push(po.purchase_order_code);
        });
      } else if (res.purchase_order_code) {
        createdCodes.push(res.purchase_order_code);
      }
      messageApi.success(
        t('app.kuaizhizao.purchaseOrder.createdFromRequisition', {
          target: pullFromRequisitionAction.targetLabel,
          codes: createdCodes.join('、'),
        }),
      );
      invalidateMenuBadgeCounts();
      invalidateStatistics();
      actionRef.current?.reload();
      resetPullRequisitionPreviewModal();
    } catch (error: unknown) {
      messageApi.error(
        getApiErrorMessage(
          error,
          t('app.kuaizhizao.purchaseOrder.createFromRequisitionFailed', {
            source: pullFromRequisitionAction.sourceLabel,
            target: pullFromRequisitionAction.targetLabel,
          }),
        ),
      );
    } finally {
      setPullRequisitionPreviewConfirming(false);
    }
  }, [
    invalidateMenuBadgeCounts,
    invalidateStatistics,
    messageApi,
    pullFromRequisitionAction.sourceLabel,
    pullFromRequisitionAction.targetLabel,
    pullRequisitionPreviewData,
    pullRequisitionPreviewId,
    pullRequisitionSelectedItemIds,
    resetPullRequisitionPreviewModal,
    t,
  ]);

  const showPullInquiryPreview = useCallback(
    (inquiryId: number) => {
      setPullInquiryPreviewOpen(true);
      setPullInquiryPreviewConfirming(false);
      setPullInquiryPreviewId(inquiryId);
      setPullInquirySelectedItemIds([]);
      setPullInquiryPreviewLoading(true);
      setPullInquiryPreviewData(null);
      previewPushInquiryToPurchaseOrder(inquiryId)
        .then((preview) => {
          setPullInquiryPreviewData(preview);
          setPullInquirySelectedItemIds(
            (preview.items || [])
              .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
              .map((row) => Number(row.item_id)),
          );
        })
        .catch((error: unknown) => {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrder.pull.previewFailed')));
          resetPullInquiryPreviewModal();
        })
        .finally(() => setPullInquiryPreviewLoading(false));
    },
    [messageApi, resetPullInquiryPreviewModal, t],
  );

  const handlePullInquiryPreviewConfirm = useCallback(async () => {
    if (!pullInquiryPreviewId || !pullInquiryPreviewData) return;
    if (pullInquiryPreviewData.has_blocking_issues) return;
    const rowById = new Map(
      (pullInquiryPreviewData.items || []).map((row) => [Number(row.item_id), row]),
    );
    const selectedIds = pullInquirySelectedItemIds.filter((id) => {
      const row = rowById.get(id);
      return row && Number(row.max_push_quantity ?? 0) > 0;
    });
    if (!selectedIds.length) {
      messageApi.warning(t('app.kuaizhizao.purchaseOrder.selectInquiryLinesFirst'));
      return;
    }
    setPullInquiryPreviewConfirming(true);
    try {
      const res = await pullPurchaseOrderFromInquiry({
        inquiry_id: pullInquiryPreviewId,
        item_ids: selectedIds,
      });
      const createdCodes: string[] = [];
      if (res.purchase_orders?.length) {
        res.purchase_orders.forEach((po) => {
          if (po.purchase_order_code) createdCodes.push(po.purchase_order_code);
        });
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
      resetPullInquiryPreviewModal();
    } catch (error: unknown) {
      messageApi.error(
        getApiErrorMessage(
          error,
          t('app.kuaizhizao.purchaseOrder.createFromRequisitionFailed', {
            source: pullFromInquiryAction.sourceLabel,
            target: pullFromInquiryAction.targetLabel,
          }),
        ),
      );
    } finally {
      setPullInquiryPreviewConfirming(false);
    }
  }, [
    invalidateMenuBadgeCounts,
    invalidateStatistics,
    messageApi,
    pullFromInquiryAction.sourceLabel,
    pullFromInquiryAction.targetLabel,
    pullInquiryPreviewData,
    pullInquiryPreviewId,
    pullInquirySelectedItemIds,
    resetPullInquiryPreviewModal,
    t,
  ]);

  const pullRequisitionColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseOrder.col.requisitionCode'), dataIndex: 'requisition_code', width: 170 },
      { title: t('app.kuaizhizao.purchaseOrder.col.requisitionName'), dataIndex: 'requisition_name', width: 180, ellipsis: true, render: (v: string) => v || '-' },
      { title: t('app.kuaizhizao.purchaseOrder.col.applicant'), dataIndex: 'applicant_name', width: 110, render: (v: string) => v || '-' },
      { title: t('app.kuaizhizao.purchaseOrder.col.demandDate'), dataIndex: 'required_date', width: 120, render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
      { title: t('common.status'), dataIndex: 'status', width: 110, render: (v: string) => v || '-' },
      { title: t('app.kuaizhizao.purchaseRequisition.col.itemCount'), dataIndex: 'items_count', width: 90, align: 'right' as const, render: (v: number) => v ?? '-' },
    ],
    [t],
  );

  const pullInquiryColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseOrder.col.inquiryCode'), dataIndex: 'inquiry_code', width: 170 },
      { title: t('app.kuaizhizao.purchaseOrder.col.inquiryName'), dataIndex: 'inquiry_name', width: 180, ellipsis: true, render: (v: string) => v || '-' },
      { title: t('app.kuaizhizao.purchaseOrder.col.buyer'), dataIndex: 'buyer_name', width: 110, render: (v: string) => v || '-' },
      { title: t('app.kuaizhizao.purchaseOrder.col.inquiryDate'), dataIndex: 'inquiry_date', width: 120, render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
      { title: t('common.status'), dataIndex: 'status', width: 110, render: (v: string) => v || '-' },
      { title: t('app.kuaizhizao.purchaseRequisition.col.itemCount'), dataIndex: 'items_count', width: 90, align: 'right' as const, render: (v: number) => v ?? '-' },
    ],
    [t],
  );

  const isPullPurchaseOrderSourceSelectable = useCallback(
    (record: { capabilities?: { push_purchase_order?: { allowed?: boolean } } }) =>
      record.capabilities?.push_purchase_order?.allowed === true,
    [],
  );

  const pullDocumentScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromRequisitionQuery = useUniPullQuery<PullPurchaseRequisitionCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const result = await listPurchaseRequisitions({
          skip: 0,
          limit: 200,
          keyword: keyword.trim() || undefined,
        });
        const rows = (result.data ?? []).filter((row) => row.id != null) as PullPurchaseRequisitionCandidate[];
        const filtered = filterByPullScope(rows, scope, isPullPurchaseOrderSourceSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrder.loadRequisitionListFailed')));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => !isPullPurchaseOrderSourceSelectable(record),
    onConfirm: async (keys) => {
      const requisitionId = Number(keys[0]);
      if (!requisitionId || requisitionId <= 0) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.selectRequisitionFirst'));
        return;
      }
      pullQueryCloseRef.current?.();
      showPullRequisitionPreview(requisitionId);
    },
  });

  pullQueryCloseRef.current = pullFromRequisitionQuery.closeModal;

  const pullFromInquiryQuery = useUniPullQuery<PullPurchaseInquiryCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const result = await listPurchaseInquiries({
          skip: 0,
          limit: 200,
          keyword: keyword.trim() || undefined,
        });
        const rows = (result.data ?? []).filter((row) => row.id != null) as PullPurchaseInquiryCandidate[];
        const filtered = filterByPullScope(rows, scope, isPullPurchaseOrderSourceSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrder.loadInquiryListFailed')));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => !isPullPurchaseOrderSourceSelectable(record),
    onConfirm: async (keys) => {
      const inquiryId = Number(keys[0]);
      if (!inquiryId || inquiryId <= 0) {
        messageApi.warning(t('app.kuaizhizao.purchaseOrder.selectInquiryFirst'));
        return;
      }
      pullQueryCloseRef.current?.();
      showPullInquiryPreview(inquiryId);
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
        leavePurchaseOrderFormPage();
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
      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionBasic')}>
        <div className="document-form-untitled-groups">
          <div className="document-form-untitled-group">
            <Row gutter={16}>
              <Col span={8}>
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
              <Col span={8}>
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
              <Col span={8}>
                <ProForm.Item name="buyer_id" label={t('app.kuaizhizao.purchaseOrder.form.buyer')}>
                  <UniDropdown
                    placeholder={t('app.kuaizhizao.purchaseOrder.form.buyerPlaceholder')}
                    showSearch
                    allowClear
                    loading={usersLoading}
                    options={users.map((u) => ({ label: u.full_name || u.username, value: u.id }))}
                    onChange={(_val, opt: any) => {
                      formRef.current?.setFieldsValue({ buyer_name: opt?.label });
                    }}
                  />
                </ProForm.Item>
                <AntForm.Item name="buyer_name" hidden>
                  <Input />
                </AntForm.Item>
              </Col>
            </Row>
          </div>
          <div className="document-form-untitled-group">
            <Row gutter={16}>
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
              <Col span={6}>
                <ProForm.Item
                  name="prepayment_amount"
                  label={t('app.kuaizhizao.purchaseOrder.form.prepaymentAmount')}
                >
                  <InputNumber
                    min={0}
                    precision={2}
                    style={{ width: '100%' }}
                    placeholder={t('app.kuaizhizao.purchaseOrder.form.prepaymentAmountPlaceholder')}
                  />
                </ProForm.Item>
              </Col>
              <Col span={6}>
                <ProFormSelect
                  name="prepayment_bank_account_id"
                  label={t('app.kuaizhizao.purchaseOrder.form.prepaymentBankAccount')}
                  options={bankAccountOptions}
                  showSearch
                  allowClear
                  placeholder={t('app.kuaizhizao.purchaseOrder.form.prepaymentBankAccountPlaceholder')}
                />
              </Col>
            </Row>
          </div>
          <div className="document-form-untitled-group">
            <Row gutter={16}>
              <Col span={6}>
                <ProForm.Item name="order_type" label={t('app.kuaizhizao.purchaseOrder.form.orderType')} initialValue="标准采购">
                  <UniDropdown
                    placeholder={t('app.kuaizhizao.purchaseOrder.form.orderTypePlaceholder')}
                    options={orderTypeOptions}
                    loading={orderTypeLoading}
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
              <Col span={6}>
                <ProForm.Item name="currency" label={t('app.kuaizhizao.purchaseOrder.form.currency')} initialValue="CNY">
                  <UniDropdown
                    placeholder={t('app.kuaizhizao.purchaseOrder.form.currencyPlaceholder')}
                    options={currencyOptions}
                    loading={currencyLoading}
                  />
                </ProForm.Item>
              </Col>
            </Row>
          </div>
          <CustomFieldsFormSection
            customFields={purchaseOrderFormCustomFields}
            customFieldValues={purchaseOrderFormCustomFieldValues}
            gridColumns={4}
          />
        </div>
        <ProFormText name="supplier_name" hidden />
        <ProFormText name="price_type" hidden initialValue="tax_exclusive" />
      </DetailDrawerSection>

      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionLines')}>
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
                              }}
                              onChange={(_val, material) => {
                                if (!material) return;
                                formRef.current?.setFieldValue(
                                  ['items', index, 'unit'],
                                  resolveMaterialScenarioUnit(material, 'purchase'),
                                );
                                void applyPurchaseDocumentLineMaterialPricing(
                                  formRef.current,
                                  index,
                                  material,
                                  { asOfField: 'order_date', unitPriceField: 'unit_price' },
                                );
                              }}
                              fallbackOption={fallback}
                              formItemProps={{ style: { margin: 0 } }}
                              showQuickCreate
                              showAdvancedSearch
                            skipFuzzyPinyinClientFilter
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
                          if (!formRef.current) return null;
                          return (
                            <AntForm.Item name={[index, 'unit']} style={{ margin: 0 }}>
                              <DocumentLineUnitSelect
                                form={formRef.current}
                                listName="items"
                                rowIndex={index}
                                fields={{ quantity: 'ordered_quantity', unit: 'unit' }}
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
                        <InputNumber placeholder={t('app.kuaizhizao.purchaseOrder.form.quantity')} min={0} precision={quantityDecimals} style={{ width: '100%' }} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
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
                              precision={priceDecimals}
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
                                return <span>¥{exclAmt.toFixed(amountDecimals)}</span>;
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
                                return <span>¥{taxAmt.toFixed(amountDecimals)}</span>;
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
                          return <span>¥{totalIncl.toFixed(amountDecimals)}</span>;
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

        <ProFormTextArea
          name="notes"
          label={t('app.kuaizhizao.purchaseOrder.form.notes')}
          placeholder={t('app.kuaizhizao.purchaseOrder.form.notesPlaceholder')}
          fieldProps={{ rows: 3 }}
        />
      </DetailDrawerSection>

      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionAttachments')} marginBottom={0}>
        <DocumentAttachmentsField
          category="purchase_order_attachments"
          label={false}
        />
      </DetailDrawerSection>
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
          exampleRow={['MAT001', 'Spec X', pickImportExampleValue(purchaseOrderLineUnitOptions, t('app.kuaizhizao.purchaseOrder.importItems.exampleUnit')), '10', '100', '2026-03-01']}
          columnOptions={purchaseOrderLineImportColumnOptions}
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
            <Space wrap align="center">
              <DocumentFormPageHeaderActions
                onCancel={leavePurchaseOrderFormPage}
                onSaveDraft={() => void handleSaveDraft()}
                onPrimarySubmit={() => void triggerPurchaseOrderPrimarySubmit()}
                isCreatePage={isCreatePage}
                canSubmitAfterSave={canSubmitAfterSave}
                showSaveDraft={canSubmitAfterSave}
              />
              {isCreatePage && kuaiaiAvailable ? (
                <PurchaseOrderAiCreateTrigger formRef={formRef} />
              ) : null}
            </Space>
            </>
          }
        >
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
          columnPersistenceId={purchaseOrderListPersistenceId}
          headerTitle={t('app.kuaizhizao.menu.purchase-management.purchase-orders')}
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          viewTypes={['table', 'detailTable', 'help']}
          defaultViewType={viewTypeState === 'help' ? 'table' : viewTypeState}
          onViewTypeChange={(v) => {
            const nextMode = v === 'table' ? 'order' : 'detail';
            dataViewModeRef.current = nextMode;
            setViewTypeState(v as 'table' | 'detailTable' | 'help');
            setSelectedRowKeys([]);
            setTimeout(() => actionRef.current?.reload(), 0);
          }}
          detailTableColumns={detailTableColumns}
          helpViewConfig={{
            content: (
              <div style={{ lineHeight: 1.8 }}>
                <p>
                  <strong>{t('components.uniTable.viewTable')}</strong>
                  {t('app.kuaizhizao.purchaseOrder.helpTableView')}
                </p>
                <p>
                  <strong>{t('components.uniTable.viewDetailTable')}</strong>
                  {t('app.kuaizhizao.purchaseOrder.helpDetailTableView')}
                </p>
              </div>
            ),
          }}
          rowKey={dataViewMode === 'detail' ? '_rowKey' : 'id'}
          rowClassName={(record) => {
            if (!highlightDeliveryOverdue) return '';
            if (dataViewMode === 'order') {
              return isPurchaseOrderDeliveryOverdue(record as PurchaseOrder, purchaseOrderAuditEnabled)
                ? 'purchase-order-row-overdue'
                : '';
            }
            const row = record as PurchaseOrderItemRow;
            return isPurchaseOrderDeliveryOverdue(
              {
                delivery_date: row.required_date || row.delivery_date,
                status: row.status,
                review_status: row.review_status,
              } as PurchaseOrder,
              purchaseOrderAuditEnabled,
            )
              ? 'purchase-order-row-overdue'
              : '';
          }}
          columns={columns}
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
          pinnedTabsValueEnum={lifecycleValueEnum}
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
              disabled={selectedRowKeys.length !== 1 || !selectedOrderForToolbar}
              disabledReason={purchaseOrderToolbarPushDisabledReason}
            />,
          ]}
          enableRowSelection={viewTypeState !== 'detailTable'}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          onTableDataChange={setTableOrders}
          showDeleteButton={viewTypeState !== 'detailTable'}
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
          showImportButton={viewTypeState !== 'detailTable'}
          onImport={handleListImport}
          importHeaders={purchaseOrderImportTemplate.importHeaders}
          importExampleRow={purchaseOrderImportTemplate.importExampleRow}
          importColumnOptions={purchaseOrderImportTemplate.importColumnOptions}
          importFieldMap={purchaseOrderImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const flattenOrders = (orders: PurchaseOrder[]): Array<Record<string, unknown>> => {
                if (dataViewModeRef.current !== 'detail') {
                  return orders as Array<Record<string, unknown>>;
                }
                const flatRows: Array<Record<string, unknown>> = [];
                for (const order of orders) {
                  const items = order.items ?? [];
                  if (items.length === 0) {
                    flatRows.push({
                      _rowKey: `order-${order.id}-empty`,
                      purchase_order_id: order.id,
                      order_code: order.order_code,
                      supplier_name: order.supplier_name,
                      material_code: '-',
                      material_name: '-',
                      ordered_quantity: 0,
                    });
                  } else {
                    items.forEach((item, idx) => {
                      flatRows.push({
                        ...item,
                        _rowKey: item.id
                          ? `order-${order.id}-item-${item.id}`
                          : `order-${order.id}-idx-${idx}`,
                        purchase_order_id: order.id,
                        order_code: order.order_code,
                        supplier_name: order.supplier_name,
                        buyer_name: order.buyer_name,
                        order_date: order.order_date,
                        delivery_date: order.delivery_date,
                        status: order.status,
                        review_status: order.review_status,
                      });
                    });
                  }
                }
                return flatRows;
              };

              let orders = await fetchAllListItems((p) =>
                listPurchaseOrders({
                  ...p,
                  include_items: dataViewModeRef.current === 'detail',
                }),
              );
              let toExport: Array<Record<string, unknown>>;
              if (type === 'currentPage' && pageData?.length) {
                toExport = pageData as Array<Record<string, unknown>>;
              } else if (type === 'selected' && keys?.length) {
                if (dataViewModeRef.current === 'detail') {
                  toExport = flattenOrders(orders).filter((r) => keys.includes(String(r._rowKey)));
                } else {
                  toExport = (orders as PurchaseOrder[]).filter(
                    (d) => d.id != null && keys.includes(d.id),
                  ) as Array<Record<string, unknown>>;
                }
              } else {
                toExport = flattenOrders(orders);
              }
              if (toExport.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              await downloadRecordsAsXlsx(
                toExport,
                `purchase-orders-${new Date().toISOString().slice(0, 10)}.xlsx`,
              );
              messageApi.success(t('common.exportSuccess', { count: toExport.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          showSyncButton={viewTypeState !== 'detailTable'}
          onSync={() => setSyncModalVisible(true)}
          toolbar={{ actions: [purchaseOrderHighlightOverdueToolbar] }}
          request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
            try {
              const sf = searchFormValues ?? {};
              const { sortBy, sortOrder } = extractProTableSort(sort);
              const orderBy =
                sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
              const fuzzyKeyword = typeof sf.keyword === 'string' ? sf.keyword.trim() : '';
              const apiParams: Record<string, unknown> = {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                order_by: orderBy,
              };
              const lifecycleMapped = resolvePurchaseOrderListLifecycleParams(sf, params);
              if (lifecycleMapped.status) apiParams.status = lifecycleMapped.status;
              if (lifecycleMapped.review_status) apiParams.review_status = lifecycleMapped.review_status;
              if (fuzzyKeyword) {
                apiParams.keyword = fuzzyKeyword;
              } else if (sf.order_code != null && String(sf.order_code).trim()) {
                apiParams.order_code = String(sf.order_code).trim();
              }
              if (sf.supplier_id != null && sf.supplier_id !== '') {
                apiParams.supplier_id = Number(sf.supplier_id);
              }
              const orderDateRange = sf.order_date_range as [unknown, unknown] | undefined;
              if (orderDateRange && Array.isArray(orderDateRange) && orderDateRange[0]) {
                apiParams.order_date_from = formatDateTime(orderDateRange[0] as string | Date, 'YYYY-MM-DD');
                apiParams.order_date_to = orderDateRange[1]
                  ? formatDateTime(orderDateRange[1] as string | Date, 'YYYY-MM-DD')
                  : apiParams.order_date_from;
              }
              const deliveryDateRange = sf.delivery_date_range as [unknown, unknown] | undefined;
              if (deliveryDateRange && Array.isArray(deliveryDateRange) && deliveryDateRange[0]) {
                apiParams.delivery_date_from = formatDateTime(deliveryDateRange[0] as string | Date, 'YYYY-MM-DD');
                apiParams.delivery_date_to = deliveryDateRange[1]
                  ? formatDateTime(deliveryDateRange[1] as string | Date, 'YYYY-MM-DD')
                  : apiParams.delivery_date_from;
              }
              const createdRange = sf.created_at_range as [unknown, unknown] | undefined;
              if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
                apiParams.created_start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
                apiParams.created_end_date = createdRange[1]
                  ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
                  : apiParams.created_start_date;
              }
              apiParams.include_items = dataViewModeRef.current === 'detail';

              const toFlatRows = (orders: PurchaseOrder[]): PurchaseOrderItemRow[] => {
                const flatRows: PurchaseOrderItemRow[] = [];
                for (const order of orders) {
                  const items = order.items ?? [];
                  if (items.length === 0) {
                    flatRows.push({
                      _rowKey: `order-${order.id}-empty`,
                      purchase_order_id: order.id ?? 0,
                      order_code: order.order_code,
                      supplier_name: order.supplier_name,
                      buyer_name: order.buyer_name,
                      order_date: order.order_date,
                      delivery_date: order.delivery_date,
                      total_quantity: order.total_quantity,
                      total_amount: order.total_amount,
                      status: order.status,
                      review_status: order.review_status,
                      receipt_progress: order.receipt_progress,
                      downstream_push_progress: order.downstream_push_progress,
                      material_id: 0,
                      material_code: '-',
                      material_name: '-',
                      ordered_quantity: 0,
                      unit: '',
                      unit_price: 0,
                      total_price: 0,
                    } as PurchaseOrderItemRow);
                  } else {
                    items.forEach((item, idx) => {
                      flatRows.push({
                        ...item,
                        _rowKey: item.id
                          ? `order-${order.id}-item-${item.id}`
                          : `order-${order.id}-idx-${idx}`,
                        purchase_order_id: order.id ?? 0,
                        order_code: order.order_code,
                        supplier_name: order.supplier_name,
                        buyer_name: order.buyer_name,
                        order_date: order.order_date,
                        delivery_date: order.delivery_date,
                        total_quantity: order.total_quantity,
                        total_amount: order.total_amount,
                        status: order.status,
                        review_status: order.review_status,
                        receipt_progress: order.receipt_progress,
                        downstream_push_progress: order.downstream_push_progress,
                      } as PurchaseOrderItemRow);
                    });
                  }
                }
                return flatRows;
              };

              const formatListResponse = async (orders: PurchaseOrder[], total: number) => {
                if (dataViewModeRef.current === 'order') {
                  const enriched = meta?.purpose === 'prefetch'
                    ? orders
                    : await enrichPurchaseOrderRecordsWithCustomFields(orders);
                  return { data: enriched, success: true, total };
                }
                return { data: toFlatRows(orders), success: true, total };
              };

              const response = await listPurchaseOrders(
                apiParams as Parameters<typeof listPurchaseOrders>[0],
              );
              const orders = response.data || [];
              const total = response.total || 0;
              return formatListResponse(orders, total);
            } catch (error) {
              messageApi.error(t('app.kuaizhizao.purchaseOrder.listFailed'));
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
        />
      </ListPageTemplate>

      <UniPullQueryModal<PullPurchaseRequisitionCandidate>
        open={pullFromRequisitionQuery.open}
        title={pullFromRequisitionAction.label}
        onCancel={pullFromRequisitionQuery.closeModal}
        onOk={pullFromRequisitionQuery.handleConfirm}
        rowKey="id"
        columns={pullRequisitionColumns}
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
        searchPlaceholder={t('app.kuaizhizao.purchaseOrder.pull.searchRequisitionPlaceholder')}
        emptyText={t('app.kuaizhizao.purchaseOrder.pull.emptyRequisition')}
        emptySearchText={t('app.kuaizhizao.purchaseOrder.pull.emptyRequisitionSearch')}
        page={pullFromRequisitionQuery.page}
        pageSize={pullFromRequisitionQuery.pageSize}
        total={pullFromRequisitionQuery.total}
        onPageChange={pullFromRequisitionQuery.handlePageChange}
        scopeOptions={pullFromRequisitionQuery.scopeOptions}
        scope={pullFromRequisitionQuery.scope}
        onScopeChange={pullFromRequisitionQuery.handleScopeChange}
        okText={t('common.next')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      <UniPullQueryModal<PullPurchaseInquiryCandidate>
        open={pullFromInquiryQuery.open}
        title={pullFromInquiryAction.label}
        onCancel={pullFromInquiryQuery.closeModal}
        onOk={pullFromInquiryQuery.handleConfirm}
        rowKey="id"
        columns={pullInquiryColumns}
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
        searchPlaceholder={t('app.kuaizhizao.purchaseOrder.pull.searchInquiryPlaceholder')}
        emptyText={t('app.kuaizhizao.purchaseOrder.pull.emptyInquiry')}
        emptySearchText={t('app.kuaizhizao.purchaseOrder.pull.emptyInquirySearch')}
        page={pullFromInquiryQuery.page}
        pageSize={pullFromInquiryQuery.pageSize}
        total={pullFromInquiryQuery.total}
        onPageChange={pullFromInquiryQuery.handlePageChange}
        scopeOptions={pullFromInquiryQuery.scopeOptions}
        scope={pullFromInquiryQuery.scope}
        onScopeChange={pullFromInquiryQuery.handleScopeChange}
        okText={t('common.next')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      <Modal
        title={pullFromRequisitionAction.label}
        open={pullRequisitionPreviewOpen}
        destroyOnClose
        width={1100}
        onCancel={resetPullRequisitionPreviewModal}
        okText={pullFromRequisitionAction.label}
        cancelText={t('common.cancel')}
        confirmLoading={pullRequisitionPreviewConfirming}
        onOk={() => void handlePullRequisitionPreviewConfirm()}
        okButtonProps={{
          disabled:
            pullRequisitionPreviewLoading ||
            !pullRequisitionPreviewData ||
            !!pullRequisitionPreviewData?.has_blocking_issues,
        }}
      >
        {pullRequisitionPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pullRequisitionPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullRequisitionPreviewData.summary}</p>
            {pullRequisitionPreviewData.has_blocking_issues && pullRequisitionPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  purchaseRequisitionCapabilityReasonMessage(pullRequisitionPreviewData.blocking_reason, t) ||
                  t('app.kuaizhizao.purchaseOrder.createFromRequisitionFailed', {
                    source: pullFromRequisitionAction.sourceLabel,
                    target: pullFromRequisitionAction.targetLabel,
                  })
                }
              />
            ) : null}
            {pullRequisitionPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pullRequisitionPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                rowSelection={{
                  selectedRowKeys: pullRequisitionSelectedItemIds.map(String),
                  onChange: (keys) => setPullRequisitionSelectedItemIds(keys.map((k) => Number(k))),
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
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseOrder.pull.previewNoLines')} />
            )}
            {pullRequisitionPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pullRequisitionPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={pullFromInquiryAction.label}
        open={pullInquiryPreviewOpen}
        destroyOnClose
        width={1100}
        onCancel={resetPullInquiryPreviewModal}
        okText={pullFromInquiryAction.label}
        cancelText={t('common.cancel')}
        confirmLoading={pullInquiryPreviewConfirming}
        onOk={() => void handlePullInquiryPreviewConfirm()}
        okButtonProps={{
          disabled:
            pullInquiryPreviewLoading ||
            !pullInquiryPreviewData ||
            !!pullInquiryPreviewData?.has_blocking_issues,
        }}
      >
        {pullInquiryPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pullInquiryPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullInquiryPreviewData.summary}</p>
            {pullInquiryPreviewData.has_blocking_issues && pullInquiryPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  purchaseInquiryCapabilityReasonMessage(pullInquiryPreviewData.blocking_reason, t) ||
                  t('app.kuaizhizao.purchaseOrder.createFromRequisitionFailed', {
                    source: pullFromInquiryAction.sourceLabel,
                    target: pullFromInquiryAction.targetLabel,
                  })
                }
              />
            ) : null}
            {pullInquiryPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pullInquiryPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                rowSelection={{
                  selectedRowKeys: pullInquirySelectedItemIds.map(String),
                  onChange: (keys) => setPullInquirySelectedItemIds(keys.map((k) => Number(k))),
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
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseOrder.pull.previewNoLines')} />
            )}
            {pullInquiryPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pullInquiryPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={pushPreviewModalTitle}
        open={pushPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        styles={{ body: { maxHeight: MODAL_CONFIG.BODY_MAX_HEIGHT, overflow: 'auto' } }}
        onCancel={resetPushPreviewModal}
        okText={pushPreviewConfirmLabel}
        cancelText={t('common.cancel')}
        confirmLoading={pushPreviewConfirming}
        onOk={() => void handlePushPreviewConfirm()}
        okButtonProps={{
          disabled:
            pushPreviewLoading ||
            !pushPreviewData ||
            !!pushPreviewData?.has_blocking_issues ||
            (pushPreviewKind !== 'invoice' && pushPreviewSelectedItemIds.length === 0),
        }}
      >
        {pushPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pushPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushPreviewData.summary}</p>
            {pushPreviewData.has_blocking_issues && pushPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={purchaseOrderCapabilityReasonMessage(pushPreviewData.blocking_reason, t) || t('app.kuaizhizao.purchaseOrder.push.previewFailed')}
              />
            ) : null}
            {pushPreviewKind !== 'invoice' && pushPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                tableLayout="fixed"
                columns={[
                  {
                    title: t('common.select'),
                    dataIndex: 'item_id',
                    key: 'select',
                    width: 64,
                    render: (_: unknown, row: DocumentPushPreview['items'][number]) => {
                      const itemId = Number(row?.item_id);
                      if (!Number.isFinite(itemId) || itemId <= 0) return null;
                      const maxQty = Number(row?.max_push_quantity ?? 0);
                      const disabled = !Number.isFinite(maxQty) || maxQty <= 0;
                      return (
                        <Switch
                          size="small"
                          disabled={disabled}
                          checked={pushPreviewSelectedItemIds.includes(itemId)}
                          onChange={(checked) => {
                            setPushPreviewSelectedItemIds((prev) =>
                              checked ? Array.from(new Set([...prev, itemId])) : prev.filter((id) => id !== itemId),
                            );
                          }}
                        />
                      );
                    },
                  },
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 140, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 200, ellipsis: true },
                  { title: pushPreviewQtyColumnTitles.quantity, dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: pushPreviewQtyColumnTitles.pushed, dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: pushPreviewQtyColumnTitles.pushable, dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                  ...(pushPreviewKind === 'receipt_notice' || pushPreviewKind === 'receipt'
                    ? [
                        {
                          title: (
                            <>
                              {t('app.kuaizhizao.purchaseOrder.pushReceiptWarehouse')}
                              <Typography.Text type="danger"> *</Typography.Text>
                            </>
                          ),
                          key: 'warehouse_id',
                          width: 200,
                          render: (_: unknown, row: DocumentPushPreview['items'][number]) => {
                            const itemId = Number(row?.item_id);
                            if (!Number.isFinite(itemId) || itemId <= 0) return null;
                            const selected = pushPreviewSelectedItemIds.includes(itemId);
                            return (
                              <Select
                                style={{ width: '100%', minWidth: 140 }}
                                placeholder={t('app.kuaizhizao.purchaseOrder.pushReceiptSelectWarehouse')}
                                showSearch
                                optionFilterProp="label"
                                disabled={!selected}
                                value={pushPreviewLineWh[itemId]}
                                options={pushPreviewWarehouseOptions}
                                onChange={(nv) => {
                                  setPushPreviewLineWh((prev) => ({ ...prev, [itemId]: Number(nv) }));
                                }}
                              />
                            );
                          },
                        },
                        {
                          title: t('app.kuaizhizao.salesOrder.colPushQty'),
                          key: 'push_qty',
                          width: 120,
                          align: 'right' as const,
                          render: (_: unknown, row: DocumentPushPreview['items'][number]) => {
                            const itemId = Number(row?.item_id);
                            if (!Number.isFinite(itemId) || itemId <= 0) return null;
                            const maxQty = Number(row?.max_push_quantity ?? 0);
                            const selected = pushPreviewSelectedItemIds.includes(itemId);
                            return (
                              <InputNumber
                                min={0}
                                max={maxQty > 0 ? maxQty : undefined}
                                disabled={!selected || maxQty <= 0}
                                value={pushPreviewQuantities[itemId] ?? 0}
                                onChange={(v) => {
                                  setPushPreviewQuantities((prev) => ({
                                    ...prev,
                                    [itemId]: Number(v) || 0,
                                  }));
                                }}
                                style={{ width: 100 }}
                              />
                            );
                          },
                        },
                      ]
                    : pushPreviewKind === 'purchase_return'
                      ? [
                          {
                            title: t('app.kuaizhizao.salesOrder.colPushQty'),
                            key: 'push_qty',
                            width: 120,
                            align: 'right' as const,
                            render: (_: unknown, row: DocumentPushPreview['items'][number]) => {
                              const itemId = Number(row?.item_id);
                              if (!Number.isFinite(itemId) || itemId <= 0) return null;
                              const maxQty = Number(row?.max_push_quantity ?? 0);
                              const selected = pushPreviewSelectedItemIds.includes(itemId);
                              return (
                                <InputNumber
                                  min={0}
                                  max={maxQty > 0 ? maxQty : undefined}
                                  disabled={!selected || maxQty <= 0}
                                  value={pushPreviewQuantities[itemId] ?? 0}
                                  onChange={(v) => {
                                    setPushPreviewQuantities((prev) => ({
                                      ...prev,
                                      [itemId]: Number(v) || 0,
                                    }));
                                  }}
                                  style={{ width: 100 }}
                                />
                              );
                            },
                          },
                        ]
                      : []),
                ]}
              />
            ) : pushPreviewKind === 'invoice' && pushPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 860 }}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.purchaseOrder.col.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseOrder.pull.previewNoLines')} />
            )}
            {pushPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pushPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

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
        collaborationAuditRecord={orderDetail}
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
                  key: 'create-change',
                  visible: orderDetail.capabilities?.create_change_order?.allowed === true,
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
                      { title: t('app.kuaizhizao.purchaseOrder.col.materialName'), dataIndex: 'material_name', width: 150, ellipsis: true, render: (_, record) => record.material_name || record.materialName || '—' },
                      { title: t('app.kuaizhizao.purchaseOrder.col.orderedQty'), dataIndex: 'ordered_quantity', width: 120, align: 'right' , render: (val, row) => <QuantityWithUnitDisplay quantity={val} unit={row.unit} /> },
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
                      { title: t('app.kuaizhizao.purchaseOrder.col.receivedQty'), dataIndex: 'received_quantity', width: 120, align: 'right', render: (val, row) => <QuantityWithUnitDisplay quantity={val} unit={row.unit} /> },
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
      
                        traceDocument={
                          orderDetail?.id != null
                            ? {
                                documentType: 'purchase_order',
                                documentId: orderDetail.id,
                                selfDocumentId: orderDetail.id,
                              renderBriefActions: (doc) => (
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
                  )
                              }
                            : undefined
                        }
      />

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title={t('app.kuaizhizao.purchaseOrder.syncFromDatasetTitle')}
      />

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
                { title: t('app.kuaizhizao.purchaseOrder.col.orderedQty'), dataIndex: 'ordered_quantity', width: 100, align: 'right' , render: formatQuantity },
                { title: t('app.kuaizhizao.purchaseOrder.col.receivedQty'), dataIndex: 'received_quantity', width: 90, align: 'right', render: formatQuantity },
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


