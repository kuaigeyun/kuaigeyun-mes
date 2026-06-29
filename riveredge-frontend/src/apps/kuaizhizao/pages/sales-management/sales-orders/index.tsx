/**
 * 销售订单管理页面
 *
 * 提供销售订单的独立管理功能，支持MTO模式。
 * 销售订单可以下推到需求管理（需求计算）。
 *
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { LIST_PAGE_REFRESH_KEYS, useListPageRefreshStore } from '../../../../../stores/listPageRefreshStore';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Table, Input, InputNumber, Row, Col, Form as AntForm, DatePicker, Spin, Switch, Progress, Tooltip, Dropdown, Select, Segmented, Tag, Alert, Card, Typography, theme as AntdTheme } from 'antd';
import { EyeOutlined, EditOutlined, ArrowDownOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined, RollbackOutlined, FileTextOutlined, SendOutlined, CopyOutlined, BellOutlined, AppstoreAddOutlined, CommentOutlined, StopOutlined, ImportOutlined, PrinterOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  MaterialStackedCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import FeeDetailsTable from '../../../../../components/FeeDetailsTable';
import PriceTypeSwitch, { type PriceTypeValue } from '../../../../../components/price-type-switch/PriceTypeSwitch';
import { deferConvertLineItemsByPriceType, setFormPriceType } from '../../../../../utils/priceTypeSwitch';
import {
  DEFAULT_SALES_PRICE_TYPE,
  normalizeSalesPriceType,
  salesFormPriceType,
} from '../shared/salesPriceType';
import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';
import { MaterialInventoryIndicator } from '../../../components/MaterialInventoryIndicator';
import { MaterialBomIndicator } from '../../../components/MaterialBomIndicator';
import { SalesOrderIndicatorsProvider } from '../../../components/SalesOrderIndicatorsProvider';
import { SalesOrderAiCreateTrigger } from './components/SalesOrderAiCreateDrawer';
import { useKuaiaiEntryAvailable } from '../../../../kuaiai/hooks/useKuaiaiEntryAvailable';
import {
  SalesOrderDetailProvider,
  SalesOrderDetailBasicPane,
  SalesOrderDetailCollaborationPane,
  SalesOrderDetailLinesPane,
  SalesOrderDetailTimelinePane,
  SalesOrderDetailCollaborationTitleSuffix,
} from './components/SalesOrderDetailBody';
import {
  alignProColumns,
  getSalesCommonFormLabels,
  SALES_DOC_LIST_FIELD_RANK,
} from '../shared/documentFieldAlignment';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../shared/listAuditPhaseColumn';
import { getSalesOrderLifecycle, isSalesOrderDeliveryOverdue, isSalesOrderLineDeliveryOverdue, buildSalesOrderLifecycleValueEnum, resolveSalesOrderListLifecycleParams } from '../../../utils/salesOrderLifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import {
  isAuditedStatus,
  isDraftStatus,
  isPendingReviewStatus,
} from '../../../constants/documentStatus';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { strokeColorWithAlpha } from '../../../../../components/common/StatCardTrendArea';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET,
  MODAL_NESTED_ABOVE_PARENT_OFFSET,
  PAGE_SPACING,
  DocumentFormPageLayout,
  DocumentFormPageHeaderActions,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  type StatCard,
} from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { UniAuditBatchMenuButton, UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import {
  DOCUMENT_DETAIL_AMOUNT_STYLE,
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
import { computeSalesDocumentTotals } from '../../../utils/documentLineAmounts';
import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_SALES_ORDER_FIELD_RESOURCE as SO } from '../../../constants/fieldPermissionResources';
import { Area } from '@ant-design/charts';
import {
  listSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  submitSalesOrder,
  approveSalesOrder,
  rejectSalesOrder,
  unapproveSalesOrder,
  previewPushSalesOrderToComputation,
  previewPushSalesOrderToWorkOrder,
  previewPushSalesOrderToShipmentNotice,
  pushSalesOrderToComputation,
  pushSalesOrderToWorkOrder,
  pushSalesOrderToShipmentNotice,
  pushSalesOrderToDelivery,
  pushSalesOrderToInvoice,
  pushSalesOrderToSalesReturn,
  pullSalesOrderFromQuotation,
  pullSalesOrderFromSalesContract,
  withdrawSalesOrderFromComputation,
  createSalesOrderReminder,
  bulkDeleteSalesOrders,
  bulkSubmitSalesOrders,
  bulkApproveSalesOrders,
  bulkWithdrawSalesOrders,
  bulkUnapproveSalesOrders,
  bulkCloseSalesOrders,
  deleteSalesOrder,
  getSalesOrderStatistics,
  SalesOrder,
  SalesOrderItem,
  SalesOrderStatus,
  ReviewStatus,
  type PushPreviewResponse,
} from '../../../services/sales-order';
import { listQuotations, type Quotation, type QuotationCapabilities } from '../../../services/quotation';
import { salesContractApi, type SalesContract, type SalesContractCapabilities } from '../../../services/sales-contract';
import {
  quotationCapabilityAllowed,
  quotationCapabilityReasonMessage,
  useSalesOrderCapabilities,
  salesOrderBatchCloseAllowed,
  salesOrderCapabilityReasonMessage,
  salesOrderHasToolbarPushActions,
} from '../../../../../hooks/useDocumentCapabilities';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

import { materialApi } from '../../../../master-data/services/material';
import type { Material } from '../../../../master-data/types/material';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { workCenterApi, factoryListItems } from '../../../../master-data/services/factory';
import type { Customer } from '../../../../master-data/types/supply-chain';
import {
  applySalesDocumentLineMaterialPricing,
  getMaterialDefaultTaxRate,
  resolveMaterialForPricing,
  resolveOrderLineSalePrice,
  resolveSalesDocumentMaterialLinesPricing,
} from '../../../../master-data/utils/resolve-partner-material-price';
import { OrderLineVariantAttributesCell } from '../../../../master-data/components/OrderLineVariantAttributesCell';
import { parseVariantAttributesValue } from '../../../../master-data/components/VariantAttributeFields';
import dayjs from 'dayjs';
import { formatApiErrorDetail } from '../../../../../services/api';
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import { coerceFormDate, toApiDateString } from '../../../../../utils/formDate';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { getFileDownloadUrl } from '../../../../../services/file';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
/** 用户列表：对接系统管理-用户管理-帐户管理（/core/users） */
import { searchUserDisplay, type User } from '../../../../../services/user';
import { useGlobalStore } from '../../../../../stores';
import { displayItemsToUsers, normalizeUserDisplayName } from '../../../../../utils/userDisplay';
import { useConfigStore } from '../../../../../stores/configStore';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferAfterPaint } from '../../../../../hooks/useDeferAfterPaint';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { isManualAuditEnabled } from '../../../../../utils/auditMode';
import { rowActionKind, rowActionAddFollowUpFromDocument } from '../../../../../components/uni-action';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import { CustomerFollowUpFormModal, type CustomerFollowUpPreset } from '../../../components/CustomerFollowUpFormModal';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { formatDateTime } from '../../../../../utils/format';

/** API 异常 detail 可能是字符串或 { message, trace_id }，不能直接交给 message.error 渲染 */
function salesOrderCatchMessage(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { detail?: unknown } }; message?: unknown };
  return (
    formatApiErrorDetail(e?.response?.data?.detail) ||
    formatApiErrorDetail(e?.message) ||
    fallback
  );
}

/** 销售明细行（订单 + 明细合并，用于平铺表格） */
type SalesOrderItemRow = SalesOrderItem & {
  _rowKey: string;
  sales_order_id: number;
  order_code?: string;
  customer_name?: string;
  order_date?: string;
  order_delivery_date?: string;
  total_quantity?: number;
  total_amount?: number;
  delivery_progress?: number;
  pushed_work_order_quantity?: number;
  remaining_push_quantity?: number;
  work_order_push_progress?: number;
  status?: string;
  review_status?: string;
  pushed_to_computation?: boolean;
  lifecycle?: Record<string, unknown>;
  has_shippable_products?: boolean;
  shippable_quantity?: number;
  /** 生命周期阶段名，用于卡片分组 */
  _lifecycleStage?: string;
  items?: { work_order_id?: number | null }[];
};

type PullQuotationCandidate = {
  id: number;
  quotation_code: string;
  customer_name?: string;
  quotation_date?: string;
  delivery_date?: string;
  total_amount?: number;
  status?: string;
  review_status?: string;
  salesman_name?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  capabilities?: QuotationCapabilities;
};

type PullSalesContractCandidate = {
  id: number;
  contract_code: string;
  customer_name?: string;
  contract_date?: string;
  valid_to?: string;
  total_amount?: number;
  status?: string;
  review_status?: string;
  salesman_name?: string;
  capabilities?: SalesContractCapabilities;
};

const isPullQuotationSelectable = (record: PullQuotationCandidate): boolean =>
  quotationCapabilityAllowed(record as Quotation, 'convert_to_order');

const isPullSalesContractSelectable = (record: PullSalesContractCandidate): boolean =>
  record.capabilities?.push_to_sales_order?.allowed === true;

const toSafeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toCents = (value: unknown): number => Math.round(toSafeNumber(value) * 100);
const fromCents = (cents: number): number => cents / 100;

const resolveSaleUnitConversionFactor = (material: Material | undefined, materialUnit: unknown): number => {
  if (!material) return 1;
  const selectedUnit = String(materialUnit ?? '').trim();
  if (!selectedUnit) return 1;

  const baseUnit = String((material as any).baseUnit ?? (material as any).base_unit ?? '').trim();
  if (!baseUnit || selectedUnit === baseUnit) return 1;

  const unitsCfg = (material as any).units;
  const units = Array.isArray(unitsCfg?.units) ? unitsCfg.units : [];
  const matched = units.find((u: any) => String(u?.unit ?? '').trim() === selectedUnit);
  if (!matched) return 1;

  const numerator = Number(matched?.numerator ?? 1);
  const denominator = Number(matched?.denominator ?? 1);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator <= 0 || denominator <= 0) {
    return 1;
  }
  return numerator / denominator;
};

const calcSalesLineAmounts = (qtyInput: unknown, priceInput: unknown, taxRateInput: unknown, priceTypeInput?: string) => {
  const qty = toSafeNumber(qtyInput);
  const unitPriceCents = toCents(priceInput);
  const taxRate = toSafeNumber(taxRateInput);
  const priceType = salesFormPriceType(priceTypeInput);

  if (priceType === 'tax_inclusive') {
    const inclCents = Math.round(qty * unitPriceCents);
    const exclCents = Math.round(inclCents / (1 + taxRate / 100));
    const taxCents = inclCents - exclCents;
    return {
      excl: fromCents(exclCents),
      tax: fromCents(taxCents),
      incl: fromCents(inclCents),
    };
  }

  const exclCents = Math.round(qty * unitPriceCents);
  const taxCents = Math.round((exclCents * taxRate) / 100);
  return {
    excl: fromCents(exclCents),
    tax: fromCents(taxCents),
    incl: fromCents(exclCents + taxCents),
  };
};

const convertUnitPriceByPriceType = (
  unitPriceInput: unknown,
  taxRateInput: unknown,
  fromPriceType: string,
  toPriceType: string,
): number => {
  const unitPriceCents = toCents(unitPriceInput);
  if (fromPriceType === toPriceType) return fromCents(unitPriceCents);

  const taxRate = toSafeNumber(taxRateInput);
  const factor = 1 + taxRate / 100;
  if (factor <= 0) return fromCents(unitPriceCents);

  if (fromPriceType === 'tax_exclusive' && toPriceType === 'tax_inclusive') {
    return fromCents(Math.round(unitPriceCents * factor));
  }
  if (fromPriceType === 'tax_inclusive' && toPriceType === 'tax_exclusive') {
    return fromCents(Math.round(unitPriceCents / factor));
  }
  return fromCents(unitPriceCents);
};

/** 数据字典未配置时的下拉兜底（与常见 SHIPPING_METHOD / PAYMENT_TERMS 取值兼容） */
function getDefaultShippingMethodOptions(t: (key: string) => string) {
  return [
    { label: t('app.kuaizhizao.salesOrder.defaultShipping.express'), value: 'EXPRESS' },
    { label: t('app.kuaizhizao.salesOrder.defaultShipping.logistics'), value: 'LOGISTICS' },
    { label: t('app.kuaizhizao.salesOrder.defaultShipping.selfPickup'), value: 'SELF_PICKUP' },
    { label: t('app.kuaizhizao.salesOrder.defaultShipping.dedicated'), value: 'DEDICATED' },
  ];
}
function getDefaultPaymentTermsOptions(t: (key: string) => string) {
  return [
    { label: t('app.kuaizhizao.salesOrder.defaultPayment.prepaid'), value: 'PREPAID' },
    { label: t('app.kuaizhizao.salesOrder.defaultPayment.cod'), value: 'COD' },
    { label: t('app.kuaizhizao.salesOrder.defaultPayment.net30'), value: 'NET30' },
    { label: t('app.kuaizhizao.salesOrder.defaultPayment.net60'), value: 'NET60' },
  ];
}

const SALES_ORDER_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_sales_orders';

const SALES_ORDER_LIST_PATH = '/apps/kuaizhizao/sales-management/sales-orders';
const SALES_ORDER_RESOURCE = 'kuaizhizao:sales-order';
const SALES_ORDER_CREATE_PATH = `${SALES_ORDER_LIST_PATH}/new`;
const salesOrderEditPath = (id: number) => `${SALES_ORDER_LIST_PATH}/${id}/edit`;

/** 归属业务员：与报价单一致，无匹配选项时用 salesman_name 回显 */
const SalesOrderSalesmanField: React.FC<{ userList: User[]; loading: boolean }> = ({ userList, loading }) => {
  const { t } = useTranslation();
  const form = AntForm.useFormInstance();
  const salesmanId = AntForm.useWatch('salesman_id', form);
  const salesmanName = AntForm.useWatch('salesman_name', form);

  const options = useMemo(() => {
    const base = userList.map((u) => ({
      value: Number(u.id),
      label: normalizeUserDisplayName(u.full_name || u.username),
    }));
    const sid =
      salesmanId != null && salesmanId !== '' && Number.isFinite(Number(salesmanId))
        ? Number(salesmanId)
        : NaN;
    if (Number.isFinite(sid) && !base.some((o) => o.value === sid)) {
      const label =
        normalizeUserDisplayName(salesmanName) || t('app.kuaizhizao.quotation.userFallback', { id: sid });
      return [{ value: sid, label }, ...base];
    }
    return base;
  }, [userList, salesmanId, salesmanName, t]);

  return (
    <>
      <ProForm.Item
        name="salesman_id"
        label={t('field.customer.salesman')}
        normalize={(v) =>
          v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined
        }
      >
        <UniDropdown
          placeholder={t('field.customer.salesmanPlaceholder')}
          showSearch
          allowClear
          loading={loading}
          style={{ width: '100%' }}
          options={options}
          onChange={(_val, opt: any) => {
            form.setFieldsValue({ salesman_name: opt?.label });
          }}
        />
      </ProForm.Item>
      <AntForm.Item name="salesman_name" hidden><Input /></AntForm.Item>
    </>
  );
};

const SalesOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const kuaiaiAvailable = useKuaiaiEntryAvailable();
  const salesCommonFormLabels = useMemo(() => getSalesCommonFormLabels(t), [t]);
  const defaultSalesOrderCurrency = useConfigStore((s) => {
    const c = s.configs.default_currency;
    return typeof c === 'string' && c.trim() !== '' ? c.trim() : 'CNY';
  });
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const pullFromQuotationAction = resolveKuaizhizaoDocumentAction(t, 'sales_order.pull_from_quotation');
  const pullFromSalesContractAction = resolveKuaizhizaoDocumentAction(t, 'sales_order.pull_from_sales_contract');
  const pushToDemandComputationAction = resolveKuaizhizaoDocumentAction(t, 'demand_computation.pull_from_sales_order');
  const pushToWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'work_order.pull_from_sales_order');
  const pushToSalesInvoiceAction = resolveKuaizhizaoDocumentAction(t, 'sales_invoice.pull_from_sales_order');
  const pushToShipmentNoticeAction = resolveKuaizhizaoDocumentAction(t, 'shipment_notice.pull_from_sales_order');
  const pushToSalesDeliveryAction = resolveKuaizhizaoDocumentAction(t, 'sales_delivery.pull_from_sales_order');
  const pushToSalesReturnAction = resolveKuaizhizaoDocumentAction(t, 'sales_return.pull_from_sales_order');
  const pushToSalesOrderChangeAction = resolveKuaizhizaoDocumentAction(t, 'sales_order_change.pull_from_sales_order');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isCreatePage = location.pathname.endsWith('/sales-orders/new');
  const editRouteMatch = location.pathname.match(/\/sales-orders\/(\d+)\/edit$/);
  const editRouteId = editRouteMatch ? Number(editRouteMatch[1]) : null;
  const isEditPage = editRouteId != null && Number.isFinite(editRouteId) && editRouteId > 0;
  const isFormPage = isCreatePage || isEditPage;
  const formPageInitializedRef = useRef(false);
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);

  const {
    customFields: salesOrderFormCustomFields,
    customFieldValues: salesOrderFormCustomFieldValues,
    loadFieldValues: loadSalesOrderFormFieldValues,
    extractFormValues: extractSalesOrderFormValues,
    saveCustomFieldValues: saveSalesOrderCustomFieldValues,
    resetFieldValues: resetSalesOrderFormFieldValues,
  } = useCustomFields({ tableName: SALES_ORDER_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: isFormPage });

  const {
    customFields: salesOrderListCustomFields,
    generateCustomFieldColumns: generateSalesOrderCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichSalesOrderRecordsWithCustomFields,
    customFieldValues: salesOrderDetailCustomFieldValues,
    loadFieldValuesForDetail: loadSalesOrderFieldValuesForDetail,
    resetDetailFieldValues: resetSalesOrderDetailFieldValues,
  } = useCustomFieldsForList<SalesOrder>({ tableName: SALES_ORDER_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (salesOrderListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [salesOrderListCustomFields.length]);

  /** 表格搜索表单 ref，用于 statCard 点击时设置筛选并刷新 */
  const tableSearchFormRef = useRef<any>(null);
  const rowKeyToOrderIdRef = useRef<Map<string, number>>(new Map());
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const leaveSalesOrderFormPage = useCallback(() => {
    navigate(SALES_ORDER_LIST_PATH);
  }, [navigate]);

  /** 视图切换缓存：始终请求 include_items=true，切换视图时从缓存转换，避免重复请求 */
  const lastOrdersCacheRef = useRef<{ orders: SalesOrder[]; total: number; paramsKey: string } | null>(null);
  /** 订单视图表格当前页数据（唯一源：UniTable onTableDataChange，与表格展示一致） */
  const [tableOrders, setTableOrders] = useState<SalesOrder[]>([]);
  const invalidateOrdersCache = () => {
    lastOrdersCacheRef.current = null;
  };

  /** 将表格 rowKey 解析为销售订单 ID（订单视图 rowKey=id 时可直接数值解析；明细视图走映射表） */
  const resolveOrderIdByRowKey = useCallback((rowKey: React.Key): number | null => {
    const mapped = rowKeyToOrderIdRef.current.get(String(rowKey));
    if (mapped != null) return mapped;
    const numeric = Number(rowKey);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }, []);

  const resolveOrderIdsFromRowKeys = useCallback(
    (keys: React.Key[]): number[] => {
      const seen = new Set<number>();
      const ids: number[] = [];
      for (const k of keys) {
        const id = resolveOrderIdByRowKey(k);
        if (id != null && !seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
      return ids;
    },
    [resolveOrderIdByRowKey],
  );
  /** 刷新左侧菜单销售订单数量徽章 */
  const invalidateMenuBadge = useInvalidateMenuBadgeCounts();
  /** 刷新销售订单统计（指标卡片） */
  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['salesOrderStatistics'] });
  };

  const listRefreshVersion = useListPageRefreshStore(
    (s) => s.versions[LIST_PAGE_REFRESH_KEYS.salesOrders] ?? 0,
  );
  const listRefreshHandledRef = useRef(0);
  useEffect(() => {
    if (listRefreshVersion <= listRefreshHandledRef.current) return;
    listRefreshHandledRef.current = listRefreshVersion;
    invalidateOrdersCache();
    invalidateMenuBadge();
    invalidateStatistics();
    actionRef.current?.reload();
  }, [listRefreshVersion, invalidateMenuBadge]);

  const secondaryStatsReady = useDeferAfterPaint();
  const { data: statistics } = useQuery({
    queryKey: ['salesOrderStatistics', location.pathname],
    queryFn: getSalesOrderStatistics,
    /** 与页面指标错开：先让列表请求发起，再拉聚合统计（趋势图等） */
    enabled: secondaryStatsReady,
  });

  const { token } = AntdTheme.useToken();
  const salesOrderDetailDrawerZIndex = token.zIndexPopupBase;
  const elevatedModalZIndex = token.zIndexPopupBase + MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET;
  const nestedElevatedPopupZIndex = elevatedModalZIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET;
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

  const auditEnabled = useAuditRequired('sales_order', false);
  const salesOrderPerms = useResourcePermissions(SALES_ORDER_RESOURCE);
  const permDeniedTitle = t('common.noPermission');
  const auditEnabledRef = useRef(auditEnabled);
  useEffect(() => {
    if (auditEnabledRef.current === auditEnabled) return;
    auditEnabledRef.current = auditEnabled;
    invalidateOrdersCache();
    invalidateStatistics();
    actionRef.current?.reload();
  }, [auditEnabled]);
  const lifecycleValueEnum = useMemo(
    () => buildSalesOrderLifecycleValueEnum(t, auditEnabled),
    [t, auditEnabled],
  );
  const salesOrderAuditColumn = useMemo(
    () => createListAuditPhaseColumn<SalesOrder>({ t, auditEnabled }),
    [t, auditEnabled],
  );
  const salesOrderLineAuditColumn = useMemo(
    () => createListAuditPhaseColumn<SalesOrderItemRow>({ t, auditEnabled }),
    [t, auditEnabled],
  );
  const salesNodeEnabled = {
    sales_order: true,
    demand_computation: true,
    work_order: true,
    shipment_notice: true,
    invoice: true,
  };
  // 与 UniTable viewTypes 同步：table=订单维度；其余视图键（明细表格、帮助）走明细数据维度
  const [viewTypeState, setViewTypeState] = useState<'table' | 'detailTable' | 'help'>('table');
  const dataViewMode = viewTypeState === 'table' ? 'order' : 'detail';
  /** 视图模式 ref：切换时同步更新，确保 reload 时 request 使用正确模式（避免 setState 异步导致返回订单级数据） */
  const dataViewModeRef = useRef(dataViewMode);
  useEffect(() => {
    dataViewModeRef.current = dataViewMode;
  }, [dataViewMode]);

  const [formEditOrder, setFormEditOrder] = useState<SalesOrder | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  /** 价税合计正在编辑的行：{ index, value }，失焦时反算单价 */
  const [editingIncl, setEditingIncl] = useState<{ index: number; value: number | null } | null>(null);
  const editingInclValueRef = useRef<number | null>(null);
  const lastPriceTypeRef = useRef<PriceTypeValue>(DEFAULT_SALES_PRICE_TYPE);

  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSalesOrder, setCurrentSalesOrder] = useState<SalesOrder | null>(null);
  const detailCapabilityGates = useSalesOrderCapabilities(
    currentSalesOrder,
    salesOrderPerms,
    t,
    permDeniedTitle,
  );
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);

  // 提醒弹窗状态
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [reminderForm] = AntForm.useForm();

  // 产品列表（用于产品选择器）
  const [materials, setMaterials] = useState<Material[]>([]);
  const [productScope, setProductScope] = useState<'make' | 'all'>('make');
  // 客户列表（对接技术数据管理-供应链-客户）
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  // 用户列表（系统管理-用户管理-帐户管理，用于销售员选择）
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  // 新建时预览的订单编号（用于提交时判断是否需正式占号）
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  /** 从 API 获取的编号规则代码（新建时使用，避免本地配置与后端不一致） */
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpPreset, setFollowUpPreset] = useState<CustomerFollowUpPreset | null>(null);
  /** 与客户跟进列表一致：交货逾期行浅色警示背景 */
  const [highlightDeliveryOverdue, setHighlightDeliveryOverdue] = useState(false);
  /** 发货方式字典选项（数据字典 SHIPPING_METHOD） */
  const [shippingMethodOptions, setShippingMethodOptions] = useState<Array<{ label: string; value: string }>>([]);

  /** 付款条件字典选项（数据字典 PAYMENT_TERMS） */
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<Array<{ label: string; value: string }>>([]);

  /**
   * 加载产品列表（无基础资料时使用空数组，不阻塞页面）
   */
  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(Array.isArray(result) ? result : (result as any)?.data ?? (result as any)?.items ?? []);
      } catch {
        setMaterials([]);
      }
    };
    loadMaterials();
  }, []);

  /**
   * 加载客户列表（无基础资料时使用空数组，不阻塞页面）
   */
  React.useEffect(() => {
    const loadCustomers = async () => {
      try {
        setCustomersLoading(true);
        const result = await customerApi.list({ limit: 1000, isActive: true });
        setCustomers(Array.isArray(result) ? result : (result as any)?.data ?? (result as any)?.items ?? []);
      } catch {
        setCustomers([]);
      } finally {
        setCustomersLoading(false);
      }
    };
    loadCustomers();
  }, []);

  /**
   * 加载用户列表（系统管理-用户管理-帐户管理 /core/users）
   * 无用户数据时使用空数组，不阻塞页面
   */
  const currentUser = useGlobalStore((s) => s.currentUser);

  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        setUsersLoading(true);
        const result = await searchUserDisplay({ page: 1, page_size: 100, is_active: true });
        setUsers(displayItemsToUsers(result.items || []));
      } catch {
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };
    void loadUsers();
  }, [currentUser]);

  /**
   * 加载发货方式、付款条件数据字典
   */
  React.useEffect(() => {
    const loadShippingMethod = async () => {
      try {
        const dict = await getDataDictionaryByCode('SHIPPING_METHOD');
        const items = await getDictionaryItemList(dict.uuid, true);
        setShippingMethodOptions(
          items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value }))
        );
      } catch (e: any) {
        setShippingMethodOptions(getDefaultShippingMethodOptions(t));
        messageApi.info(t('app.kuaizhizao.salesOrder.shippingMethodDictFallback'));
      }
    };
    const loadPaymentTerms = async () => {
      try {
        const dict = await getDataDictionaryByCode('PAYMENT_TERMS');
        const items = await getDictionaryItemList(dict.uuid, true);
        setPaymentTermsOptions(
          items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value }))
        );
      } catch (e: any) {
        setPaymentTermsOptions(getDefaultPaymentTermsOptions(t));
        messageApi.info(t('app.kuaizhizao.salesOrder.paymentTermsDictFallback'));
      }
    };
    loadShippingMethod();
    loadPaymentTerms();
  }, [messageApi, t]);

  /**
   * 处理新建销售订单
   * 若启用编号规则，用 testGenerateCode 预填订单编号（不占用序号）
   */
  const defaultOrderItem = { material_id: undefined, material_code: '', material_name: '', material_spec: '', material_unit: '', required_quantity: 1, delivery_date: dayjs(), unit_price: 0, tax_rate: 0, variant_attributes: '', notes: '' };

  async function initSalesOrderCreateForm(options?: { customerId?: number }) {
    setFormEditOrder(null);
    resetSalesOrderFormFieldValues();
    formRef.current?.resetFields();
    setTimeout(() => {
      formRef.current?.setFieldsValue({
        price_type: DEFAULT_SALES_PRICE_TYPE,
        items: [defaultOrderItem],
        order_date: dayjs(),
      });
      lastPriceTypeRef.current = DEFAULT_SALES_PRICE_TYPE;
      const prefillCustomerId = options?.customerId;
      if (prefillCustomerId != null) {
        const c = customers.find((x) => x.id === prefillCustomerId);
        if (c) {
          const sId = (c as any).salesmanId ?? (c as any).salesman_id;
          const salesman = users.find((u) => u.id === sId);
          const sName = normalizeUserDisplayName(
            (c as any).salesmanName ??
            (c as any).salesman_name ??
            (salesman ? (salesman.full_name || salesman.username) : ''),
          );
          formRef.current?.setFieldsValue({
            customer_id: c.id,
            customer_name: c.name ?? (c as any).customer_name,
            customer_contact: (c as any).contactPerson ?? (c as any).contact_person ?? (c as any).contact,
            customer_phone: (c as any).phone ?? (c as any).customer_phone,
            salesman_id: sId,
            salesman_name: normalizeUserDisplayName(sName),
            shipping_address: (c as any).address ?? (c as any).shipping_address,
          });
        }
      }
    }, 100);
    let ruleCode = getPageRuleCode('kuaizhizao-sales-order');
    let autoGenerate = isAutoGenerateEnabled('kuaizhizao-sales-order');
    try {
      const pageConfig = await getCodeRulePageConfig('kuaizhizao-sales-order');
      if (pageConfig?.ruleCode) {
        ruleCode = pageConfig.ruleCode;
        autoGenerate = !!pageConfig.autoGenerate;
      }
    } catch {}
    if (autoGenerate && ruleCode) {
      setEffectiveRuleCode(ruleCode);
      try {
        const codeResponse = await testGenerateCode({
          rule_code: ruleCode,
          check_duplicate: true,
          entity_type: 'sales_order',
        });
        const preview = codeResponse.code;
        setPreviewCode(preview ?? null);
        formRef.current?.setFieldsValue({ order_code: preview ?? '' });
      } catch (error: any) {
        console.warn('销售订单编号预生成失败:', error);
        setPreviewCode(null);
      }
    } else {
      setPreviewCode(null);
      setEffectiveRuleCode(null);
    }
  }

  const handleCreate = (options?: { customerId?: number }) => {
    if (!salesNodeEnabled.sales_order) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.nodeCreateDisabled'));
      return;
    }
    const qs =
      options?.customerId != null && Number.isFinite(options.customerId)
        ? `?customerId=${options.customerId}`
        : '';
    navigate(`${SALES_ORDER_CREATE_PATH}${qs}`);
  };

  useEffect(() => {
    if (!isFormPage) {
      formPageInitializedRef.current = false;
      return;
    }
    const titleKey = isCreatePage
      ? 'app.kuaizhizao.menu.sales-management.sales-orders.new'
      : 'app.kuaizhizao.menu.sales-management.sales-orders.edit';
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

  async function initSalesOrderEditForm(orderId: number) {
    try {
      const data = await getSalesOrder(orderId, true);
      setFormEditOrder(data);
      const items = (data.items || []).map((item: SalesOrderItem) => {
        const mid = item.material_id != null ? Number(item.material_id) : undefined;
        const matchedById = mid ? materials.find((m: any) => m.id === mid) : null;
        const matchedByCodeOrName = !mid
          ? materials.find((m: any) => (m.mainCode || m.main_code || m.code) === item.material_code || m.name === item.material_name)
          : null;
        const matched = matchedById ?? matchedByCodeOrName;
        const materialCode = item.material_code || (matched ? ((matched as any).mainCode || (matched as any).main_code || (matched as any).code) : undefined);
        const base = {
          ...item,
          material_id: mid ?? (matched ? matched.id : undefined),
          material_code: materialCode ?? item.material_code ?? '',
          required_quantity: Number(item.required_quantity) || 0,
          unit_price: item.unit_price != null ? Number(item.unit_price) : undefined,
          tax_rate: item.tax_rate != null ? Number(item.tax_rate) : 0,
          delivery_date: item.delivery_date ? dayjs(item.delivery_date) : undefined,
          variant_attributes: (() => {
            const va = (item as any).variant_attributes;
            return parseVariantAttributesValue(va) ?? (va == null ? undefined : va);
          })(),
        };
        return base;
      });
      const customerId = data.customer_id ?? customers.find(c => c.name === data.customer_name)?.id;
      const salesmanId = data.salesman_id;
      const salesmanName = data.salesman_name;
      const formData = {
        ...data,
        items,
        customer_id: customerId,
        salesman_id: salesmanId,
        salesman_name: salesmanName,
        order_date: data.order_date ? dayjs(data.order_date) : undefined,
        delivery_date: data.delivery_date ? dayjs(data.delivery_date) : undefined,
        attachments: (data as any).attachments || [],
      };
      window.setTimeout(() => {
        formRef.current?.setFieldsValue(formData);
        lastPriceTypeRef.current = normalizeSalesPriceType((formData as any)?.price_type);
        if (orderId != null) {
          loadSalesOrderFormFieldValues(orderId).then((fieldFormValues) => {
            formRef.current?.setFieldsValue(fieldFormValues);
          });
        }
      }, 100);
    } catch (error: any) {
      messageApi.error(t('app.kuaizhizao.salesOrder.detailFailed'));
      console.error('编辑销售订单错误:', error);
      navigate(SALES_ORDER_LIST_PATH);
    }
  }

  useEffect(() => {
    if (!isFormPage || formPageInitializedRef.current) return;
    formPageInitializedRef.current = true;
    if (isCreatePage) {
      if (!salesNodeEnabled.sales_order) {
        messageApi.warning(t('app.kuaizhizao.salesOrder.nodeCreateDisabled'));
        navigate(SALES_ORDER_LIST_PATH);
        return;
      }
      const raw = searchParams.get('customerId');
      const customerId = raw != null ? Number(raw) : NaN;
      void initSalesOrderCreateForm(
        Number.isFinite(customerId) && customerId > 0 ? { customerId } : undefined,
      );
    } else if (editRouteId) {
      void initSalesOrderEditForm(editRouteId);
    }
  }, [isFormPage, isCreatePage, editRouteId, salesNodeEnabled.sales_order, navigate, messageApi, searchParams]);

  /**
   * 处理编辑销售订单
   */
  const handleEdit = (keys: React.Key[]) => {
    if (keys.length !== 1) return;
    const id = Number(keys[0]);
    if (!Number.isFinite(id) || id <= 0) return;
    navigate(salesOrderEditPath(id));
  };

  /**
   * 处理详情查看
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const data = await getSalesOrder(id, true, true);  // includeItems=true, includeDuration=true
        setCurrentSalesOrder(data);

        setDrawerVisible(true);
        if (data.id != null) {
          await loadSalesOrderFieldValuesForDetail(data.id);
        }
      } catch (error: any) {
        messageApi.error(t('app.kuaizhizao.salesOrder.detailFailed'));
      }
    }
  };

  const handlePriceTypeChange = useCallback((nextChecked: boolean) => {
    const nextType: PriceTypeValue = nextChecked ? 'tax_inclusive' : 'tax_exclusive';
    const fromType: PriceTypeValue = nextChecked ? 'tax_exclusive' : 'tax_inclusive';
    setFormPriceType(formRef.current, nextType);
    lastPriceTypeRef.current = nextType;
    setEditingIncl(null);
    editingInclValueRef.current = null;
    deferConvertLineItemsByPriceType(formRef.current, fromType, nextType, convertUnitPriceByPriceType);
  }, []);

  const openFollowUpFromSalesOrder = (record: SalesOrder) => {
    const cid = record.customer_id;
    if (cid == null || Number.isNaN(Number(cid))) {
      messageApi.warning(t('app.kuaizhizao.customerFollowUp.needCustomerForFollowUp'));
      return;
    }
    setFollowUpPreset({
      customer_id: Number(cid),
      sales_order_id: record.id,
      sales_order_code: record.order_code,
    });
    setFollowUpModalOpen(true);
  };

  /**
   * 批量删除（确认由 UniBatchDeleteButton 承担，此处仅执行删除）
   */
  const handleBatchDelete = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.selectToDelete'));
      return;
    }
    const orderIds = resolveOrderIdsFromRowKeys(keys);
    if (orderIds.length === 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.selectToDelete'));
      return;
    }
    try {
      const res = await bulkDeleteSalesOrders(orderIds);
      if (res.failed_count === 0) {
        messageApi.success(t('app.kuaizhizao.salesOrder.deleteSuccess', { count: res.success_count }));
      } else {
        messageApi.warning(
          t('app.kuaizhizao.salesOrder.deletePartial', { success: res.success_count, failed: res.failed_count }),
        );
      }
      invalidateOrdersCache();
      invalidateMenuBadge();
      invalidateStatistics();
      actionRef.current?.reload();
      if (actionRef.current?.clearSelected) actionRef.current.clearSelected();
      setSelectedRowKeys([]);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.salesOrder.deleteFailed'));
      throw error;
    }
  };

  const resolveSelectedOrders = useCallback(
    (keys: React.Key[]): SalesOrder[] => {
      return resolveOrderIdsFromRowKeys(keys)
        .map((id) => tableOrders.find((row) => Number(row.id) === Number(id)))
        .filter((o): o is SalesOrder => o != null);
    },
    [tableOrders, resolveOrderIdsFromRowKeys],
  );

  /**
   * 通用批量操作处理器（关单等非审核 capabilities）
   */
  const handleBulkCapabilityBatchSuccess = useCallback(() => {
    invalidateOrdersCache();
    invalidateMenuBadge();
    invalidateStatistics();
    actionRef.current?.reload();
    if (actionRef.current?.clearSelected) actionRef.current.clearSelected();
    setSelectedRowKeys([]);
  }, [invalidateMenuBadge, invalidateOrdersCache, invalidateStatistics]);

  const salesOrderAuditBulkHandlers = useMemo(
    () => ({
      submit: bulkSubmitSalesOrders,
      withdraw: bulkWithdrawSalesOrders,
      approve: bulkApproveSalesOrders,
      revoke: bulkUnapproveSalesOrders,
    }),
    [],
  );

  const resolveSalesOrderBatchId = useCallback((key: React.Key) => {
    const mapped = rowKeyToOrderIdRef.current.get(String(key));
    if (mapped != null && Number.isFinite(mapped) && mapped > 0) return mapped;
    const id = Number(key);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, []);

  /**
   * 处理删除销售订单（单条，草稿或待审核）
   */
  const handleDeleteSingle = async (id: number) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.salesOrder.confirmDelete'),
      content: t('app.kuaizhizao.salesOrder.deleteConfirm', { count: 1 }),
      okText: t('app.kuaizhizao.salesOrder.okDelete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      zIndex: elevatedModalZIndex,
      onOk: async () => {
        try {
          await deleteSalesOrder(id);
          messageApi.success(t('app.kuaizhizao.salesOrder.deleteSuccess', { count: 1 }));
          invalidateOrdersCache();
          invalidateMenuBadge();
          invalidateStatistics();

          actionRef.current?.reload();
          if (currentSalesOrder?.id === id) {
            setDrawerVisible(false);
            setCurrentSalesOrder(null);
          }
        } catch (error: any) {
          messageApi.error(salesOrderCatchMessage(error, t('app.kuaizhizao.salesOrder.deleteFailed')));
        }
      },
    });
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload: Partial<SalesOrder> = {
          order_date: row.order_date || row.orderDate,
          delivery_date: row.delivery_date || row.deliveryDate,
          customer_id: row.customer_id ?? row.customerId,
          customer_name: row.customer_name || row.customerName,
          total_amount: row.total_amount ?? row.totalAmount,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await createSalesOrder(payload);
        successCount += 1;
      }
      messageApi.success(t('app.kuaizhizao.salesOrder.syncSuccess', { count: successCount }));
      invalidateOrdersCache();
      invalidateMenuBadge();
      invalidateStatistics();

          actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.syncFailed'));
    }
  };

  /**
   * 处理提交表单
   * 新建且启用编号规则时：若订单编号未改或为空，则正式生成编号再创建
   */
  /**
   * 通用保存逻辑（内部使用）
   * @param values 表单数据
   * @param isDraft 是否为草稿（true=保存草稿，false=直接提交）
   */
  const handleSaveInternal = async (values: any, isDraft: boolean) => {
    try {
      const { customData, standardValues } = extractSalesOrderFormValues(values);
      Object.keys(values).forEach((key) => {
        if (key.startsWith('custom_')) delete values[key];
      });
      Object.assign(values, standardValues);

      const validItems = normalizeFormListItems<SalesOrderItem>(values.items).filter(
        (it) => it.material_id && Number((it as any).required_quantity) > 0,
      );
      if (!validItems.length) {
        messageApi.warning(t('app.kuaizhizao.salesOrder.itemsRequired'));
        return;
      }

      // 数据处理：回写客户名称、计算金额
      if (values.customer_id != null && customers.length) {
        const c = customers.find(x => x.id === values.customer_id);
        if (c) values.customer_name = c.name;
      }

      // 销售员：后端只需 salesman_id 和 salesman_name
      // salesman_id 已经在表单中了，salesman_name 也在表单中（隐藏域）

      const q = (it: SalesOrderItem) => Number((it as any).required_quantity) || 0;
      const p = (it: SalesOrderItem) => Number((it as any).unit_price) || 0;
      const taxR = (it: SalesOrderItem) => Number((it as any).tax_rate) || 0;

      // 计算金额汇总（对齐采购订单逻辑）
      values.price_type = values.price_type || DEFAULT_SALES_PRICE_TYPE;
      const feeDetails = values.fee_details ?? [];
      const sums = computeSalesDocumentTotals(
        validItems,
        feeDetails,
        values.price_type,
        'required_quantity',
        values.discount_amount ?? 0,
      );
      values.total_amount = sums.estimatedReceivable;
      values.discount_amount = sums.discountAmount;
      values.total_fee_amount = sums.ourFees + sums.customerFees;

      // 格式化主表日期字段，避免后端报错
      values.order_date = toApiDateString(values.order_date);
      values.delivery_date = toApiDateString(values.delivery_date);
      values.currency_code = values.currency_code ?? defaultSalesOrderCurrency;

      const mainDeliveryStr = toApiDateString(values.delivery_date);
      values.items = validItems.map((it: SalesOrderItem) => {
        const line = calcSalesLineAmounts(q(it), p(it), taxR(it), values.price_type);
        const material = materials.find((m) => m.id === Number((it as any).material_id));
        const conversionFactor = resolveSaleUnitConversionFactor(material, (it as any).material_unit);
        const deliveryDateStr = toApiDateString((it as any).delivery_date) ?? mainDeliveryStr;
        return {
          material_id: (it as any).material_id,
          material_code: (it as any).material_code ?? '',
          material_name: (it as any).material_name ?? '',
          material_spec: (it as any).material_spec,
          variant_attributes: (() => {
            const va = (it as any).variant_attributes;
            if (va == null) return undefined;
            if (typeof va === 'object') return va;
            try { return va ? JSON.parse(va) : undefined; } catch { return undefined; }
          })(),
          material_unit: (it as any).material_unit,
          conversion_factor: conversionFactor,
          required_quantity: q(it),
          delivery_date: deliveryDateStr ?? mainDeliveryStr ?? formatDateTime(dayjs(), 'YYYY-MM-DD'),
          unit_price: p(it),
          tax_rate: taxR(it),
          item_amount: line.incl,
          notes: (it as any).notes,
        };
      });

      // 处理附件
      const formAttachments = values.attachments || [];
      values.attachments = formAttachments.map((f: any) => {
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

      // 新建时若启用编号规则，保存草稿/提交均正式占号，避免预览编号重复导致创建失败
      const ruleCodeToUse = effectiveRuleCode || getPageRuleCode('kuaizhizao-sales-order');
      const shouldAutoGenerateCode =
        isCreatePage &&
        ruleCodeToUse &&
        (isAutoGenerateEnabled('kuaizhizao-sales-order') || effectiveRuleCode) &&
        (values.order_code === previewCode || !values.order_code);
      if (shouldAutoGenerateCode) {
        try {
          const codeResponse = await generateCode({
            rule_code: ruleCodeToUse,
            context: values.order_date ? { order_date: values.order_date } : undefined,
          });
          values.order_code = codeResponse.code;
        } catch (error: any) {
          messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.generateCodeFailed'));
          return;
        }
      }

      let orderId = isEditPage ? editRouteId : null;

      // 1. 创建或更新订单
      let updateRes: any = null;
      if (isEditPage && editRouteId) {
        updateRes = await updateSalesOrder(editRouteId, values);
        orderId = editRouteId;
      } else {
        const res = await createSalesOrder(values);
        orderId = (res as any)?.id;
      }

      if (orderId != null) {
        await saveSalesOrderCustomFieldValues(orderId, customData);
      }

      // 2. 草稿保存直接提示
      if (isDraft) {
         messageApi.success(isEditPage ? t('app.kuaizhizao.salesOrder.updated') : t('app.kuaizhizao.salesOrder.savedDraft'));
      } else if (orderId) {
        // 非草稿（即点击了“提交订单”或“更新”），则按状态决定是否继续提交。
        // 编辑态若 update 后已是待审核/已审核，则无需再次 submit，避免“二次编辑待审核单”重复提交报错。
        const updatedStatus = String(updateRes?.status ?? '').trim();
        const updatedReviewStatus = String(updateRes?.review_status ?? '').trim();
        const alreadyApproved = updateRes != null && (
          isAuditedStatus(updatedStatus) ||
          updatedReviewStatus === ReviewStatus.APPROVED
        );
        const alreadyPendingReview = updateRes != null && (
          isPendingReviewStatus(updatedStatus) ||
          updatedReviewStatus === ReviewStatus.PENDING
        );
        const shouldSubmitAfterSave = !isEditPage || (!alreadyApproved && !alreadyPendingReview);

        if (isEditPage && (alreadyPendingReview || alreadyApproved)) {
          messageApi.success(t('app.kuaizhizao.salesOrder.updated'));
        }

        try {
          const submitRes = shouldSubmitAfterSave
            ? await submitSalesOrder(orderId!)
            : updateRes;
          // 判断后端返回的状态是否已经是“已审核”
          if (shouldSubmitAfterSave) {
            const isApproved = submitRes?.status === 'AUDITED' || submitRes?.status === '已审核';
            const syncTip = submitRes?.demand_synced ? t('app.kuaizhizao.salesOrder.demandSyncTip') : '';
            if (isApproved) {
               messageApi.success(isEditPage ? t('app.kuaizhizao.salesOrder.orderUpdatedAndAutoApproved', { syncTip }) : t('app.kuaizhizao.salesOrder.orderCreatedAndAutoApproved', { syncTip }));
            } else {
               messageApi.success(isEditPage ? t('app.kuaizhizao.salesOrder.orderResubmitted') : t('app.kuaizhizao.salesOrder.orderCreatedAndSubmitted'));
            }
          }
        } catch (submitError: any) {
          messageApi.error(t('app.kuaizhizao.salesOrder.saveSuccessSubmitFailed', { message: submitError.message || t('app.kuaizhizao.salesOrder.unknownError') }));
        }
      }

      setPreviewCode(null);
      setEffectiveRuleCode(null);
      invalidateOrdersCache();
      invalidateMenuBadge();
      invalidateStatistics();

      if (isFormPage) {
        navigate(SALES_ORDER_LIST_PATH);
      }
      actionRef.current?.reload();
      if (orderId && drawerVisible && currentSalesOrder?.id === orderId) {
        refreshDrawerOrder(orderId);
      }
    } catch (error: any) {
      console.error(error);
      messageApi.error(error.message || t('app.kuaizhizao.salesOrder.operationFailed'));
    }
  };

  // (onModalSubmit removed as it was unused)

  const handleSaveDraft = async () => {
    try {
      await formRef.current?.validateFields();
      const values = formRef.current?.getFieldsValue(true);
      if (values) await handleSaveInternal(values, true);
    } catch (err: any) {
      if (err?.errorFields?.length) {
        messageApi.warning(err?.message ?? t('app.kuaizhizao.salesOrder.completeRequired'));
      } else {
        messageApi.error(err?.message ?? t('app.kuaizhizao.salesOrder.operationFailed'));
      }
    }
  };

  /**
   * 处理撤销审核
   * 改由 UniWorkflowActions 组件内部管理，保留空壳防止报错或直接删除
   * （在组件级别已经由 UniWorkflowActions 全面接管了审核和提交操作按钮）
   */

  /** 下推预览弹窗状态 */
  const [pushPreviewOpen, setPushPreviewOpen] = useState(false);
  const [pushPreviewLoading, setPushPreviewLoading] = useState(false);
  const [pushPreviewData, setPushPreviewData] = useState<PushPreviewResponse | null>(null);
  const [pushPreviewAction, setPushPreviewAction] = useState<{
    doPush: (payload?: any) => Promise<any>;
    onSuccess: () => void;
    orderId: number;
  } | null>(null);
  const [pushPreviewConfirming, setPushPreviewConfirming] = useState(false);
  const [workOrderSelectedItemIds, setWorkOrderSelectedItemIds] = useState<number[]>([]);
  const [workOrderPushQuantities, setWorkOrderPushQuantities] = useState<Record<number, number>>({});
  const [workOrderSelectedWorkCenters, setWorkOrderSelectedWorkCenters] = useState<Record<number, number>>({});
  const [workCenterOptions, setWorkCenterOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [workCenterOptionsLoading, setWorkCenterOptionsLoading] = useState(false);
  const [workOrderPushMode, setWorkOrderPushMode] = useState<'draft' | 'confirm'>('draft');
  const [workOrderGranularity, setWorkOrderGranularity] = useState<'grouped' | 'per_unit'>('grouped');
  const [pushToReturnVisible, setPushToReturnVisible] = useState(false);
  const [pushToReturnOrder, setPushToReturnOrder] = useState<SalesOrder | null>(null);
  const [pushToReturnQuantities, setPushToReturnQuantities] = useState<Record<number, number>>({});
  const [pushToReturnWarehouseId, setPushToReturnWarehouseId] = useState<number | undefined>(undefined);
  const [pushToReturnWarehouseName, setPushToReturnWarehouseName] = useState<string>('');
  const [pushToReturnLoading, setPushToReturnLoading] = useState(false);

  /**
   * 打开下推预览：先拉取预览，再展示弹窗
   */
  const showPushPreviewModal = (
    fetchPreview: () => Promise<PushPreviewResponse>,
    doPush: (payload?: any) => Promise<any>,
    onSuccess: () => void,
    orderId: number,
  ) => {
    setPushPreviewOpen(true);
    setPushPreviewLoading(true);
    setPushPreviewData(null);
    setWorkOrderSelectedItemIds([]);
    setWorkOrderPushQuantities({});
    setWorkOrderSelectedWorkCenters({});
    setWorkOrderPushMode('draft');
    setWorkOrderGranularity('grouped');
    setPushPreviewAction({ doPush, onSuccess, orderId });
    const ensureWorkCentersLoaded = async () => {
      if (workCenterOptions.length > 0) return;
      try {
        setWorkCenterOptionsLoading(true);
        const listRes = await workCenterApi.list({ is_active: true, limit: 1000 });
        const rows = factoryListItems(listRes as any);
        setWorkCenterOptions(
          rows
            .filter((r: any) => Number(r?.id) > 0)
            .map((r: any) => ({
              value: Number(r.id),
              label: String(r.name || r.code || r.id),
            })),
        );
      } catch (error: any) {
        messageApi.warning(error?.message || t('app.kuaizhizao.salesOrder.loadProductionLinesFailed'));
      } finally {
        setWorkCenterOptionsLoading(false);
      }
    };
    fetchPreview()
      .then((res) => {
        setPushPreviewData(res);
        if (res?.target_type === 'work_order' || res?.target_type === 'shipment_notice') {
          if (res?.target_type === 'work_order') {
            void ensureWorkCentersLoaded();
          }
          const rows = Array.isArray(res.items) ? res.items : [];
          const ids: number[] = [];
          const qtyMap: Record<number, number> = {};
          rows.forEach((row) => {
            const itemId = Number((row as any).item_id);
            if (!Number.isFinite(itemId) || itemId <= 0) return;
            const defaultQty = Number((row as any).max_push_quantity ?? row.quantity ?? 0);
            if (Number.isFinite(defaultQty) && defaultQty > 0) {
              ids.push(itemId);
            }
            qtyMap[itemId] = Number.isFinite(defaultQty) && defaultQty > 0 ? defaultQty : 0;
          });
          setWorkOrderSelectedItemIds(ids);
          setWorkOrderPushQuantities(qtyMap);
          const defaultMode = res.push_mode_default === 'confirm' ? 'confirm' : 'draft';
          setWorkOrderPushMode(defaultMode);
        }
        setPushPreviewLoading(false);
      })
      .catch((err) => {
        messageApi.error(salesOrderCatchMessage(err, t('app.kuaizhizao.salesOrder.loadPreviewFailed')));
        setPushPreviewOpen(false);
        setPushPreviewLoading(false);
        setWorkOrderSelectedWorkCenters({});
        setWorkOrderGranularity('grouped');
      });
  };

  /** 确认下推（执行实际下推） */
  const handlePushPreviewConfirm = async () => {
    if (!pushPreviewAction || !pushPreviewData) return;
    setPushPreviewConfirming(true);
    try {
      if (pushPreviewData.target_type === 'work_order') {
        const rows = (pushPreviewData.items || []).filter((row: any) => Number(row?.item_id) > 0);
        const rowById = new Map<number, any>();
        rows.forEach((row: any) => rowById.set(Number(row.item_id), row));
        const selectedIds = workOrderSelectedItemIds.filter((id) => rowById.has(id));
        if (!selectedIds.length) {
          const hasPushable = rows.some((row: any) => Number(row?.max_push_quantity ?? 0) > 0);
          messageApi.warning(hasPushable ? t('app.kuaizhizao.salesOrder.selectAtLeastOneLine') : t('app.kuaizhizao.salesOrder.pushQtyFullyUsed'));
          return;
        }
        const selectedQuantities: Record<number, number> = {};
        const selectedWorkCenters: Record<number, number> = {};
        const selectedBlockingIssues: string[] = [];
        for (const id of selectedIds) {
          const row = rowById.get(id);
          const qty = Number(workOrderPushQuantities[id] ?? 0);
          const maxQty = Number(row?.max_push_quantity ?? row?.quantity ?? 0);
          if (!Number.isFinite(qty) || qty <= 0) {
            messageApi.warning(t('app.kuaizhizao.salesOrder.pushQtyInvalid', { code: row?.material_code || id }));
            return;
          }
          if (Number.isFinite(maxQty) && maxQty > 0 && qty > maxQty) {
            messageApi.warning(t('app.kuaizhizao.salesOrder.pushQtyExceedsRemaining', { code: row?.material_code || id }));
            return;
          }
          if (Array.isArray(row?.blocking_issues) && row.blocking_issues.length > 0) {
            selectedBlockingIssues.push(...row.blocking_issues.map((m: string) => String(m)));
          }
          const centerId = Number(workOrderSelectedWorkCenters[id] ?? 0);
          if (Number.isFinite(centerId) && centerId > 0) {
            selectedWorkCenters[id] = centerId;
          }
          selectedQuantities[id] = qty;
        }
        if (workOrderPushMode === 'confirm' && selectedBlockingIssues.length > 0) {
          messageApi.warning(t('app.kuaizhizao.salesOrder.masterDataMissingForConfirmPush'));
          return;
        }
        await pushPreviewAction.doPush({
          push_mode: workOrderPushMode,
          work_order_granularity: workOrderGranularity,
          selected_item_ids: selectedIds,
          selected_quantities: selectedQuantities,
          selected_work_centers: selectedWorkCenters,
        });
      } else if (pushPreviewData.target_type === 'shipment_notice') {
        const rows = (pushPreviewData.items || []).filter((row: any) => Number(row?.item_id) > 0);
        const rowById = new Map<number, any>();
        rows.forEach((row: any) => rowById.set(Number(row.item_id), row));
        const selectedIds = workOrderSelectedItemIds.filter((id) => rowById.has(id));
        if (!selectedIds.length) {
          const hasPushable = rows.some((row: any) => Number(row?.max_push_quantity ?? 0) > 0);
          messageApi.warning(hasPushable ? t('app.kuaizhizao.salesOrder.selectAtLeastOneLine') : t('app.kuaizhizao.salesOrder.shippableQtyFullyUsed'));
          return;
        }
        const selectedQuantities: Record<number, number> = {};
        for (const id of selectedIds) {
          const row = rowById.get(id);
          const qty = Number(workOrderPushQuantities[id] ?? 0);
          const maxQty = Number(row?.max_push_quantity ?? row?.quantity ?? 0);
          if (!Number.isFinite(qty) || qty <= 0) {
            messageApi.warning(t('app.kuaizhizao.salesOrder.pushQtyInvalid', { code: row?.material_code || id }));
            return;
          }
          if (Number.isFinite(maxQty) && maxQty > 0 && qty > maxQty) {
            messageApi.warning(t('app.kuaizhizao.salesOrder.pushQtyExceedsShippable', { code: row?.material_code || id }));
            return;
          }
          selectedQuantities[id] = qty;
        }
        await pushPreviewAction.doPush({
          selected_item_ids: selectedIds,
          selected_quantities: selectedQuantities,
        });
      } else {
        await pushPreviewAction.doPush();
      }
      messageApi.success(t('app.kuaizhizao.salesOrder.pushSuccess'));
      pushPreviewAction.onSuccess();
      setPushPreviewOpen(false);
      setPushPreviewData(null);
      setPushPreviewAction(null);
      setWorkOrderSelectedItemIds([]);
      setWorkOrderPushQuantities({});
      setWorkOrderSelectedWorkCenters({});
      setWorkOrderPushMode('draft');
      setWorkOrderGranularity('grouped');
    } catch (error: any) {
      messageApi.error(salesOrderCatchMessage(error, t('app.kuaizhizao.salesOrder.pushFailed')));
    } finally {
      setPushPreviewConfirming(false);
    }
  };

  /**
   * 处理下推到需求计算（含预览）
   */
  const handlePushToComputation = async (id: number, order?: SalesOrder | null) => {
    if (!order?.capabilities?.push_computation?.allowed) {
      messageApi.warning(
        salesOrderCapabilityReasonMessage(order?.capabilities?.push_computation?.reason, t) ||
          t('app.kuaizhizao.salesOrder.pushRequiresApproved'),
      );
      return;
    }
    showPushPreviewModal(
      () => previewPushSalesOrderToComputation(id),
      () => pushSalesOrderToComputation(id),
      () => refreshDrawerOrder(id),
      id,
    );
  };

  /** 处理下推到发货通知单 */
  const handlePushToShipmentNotice = async (id: number) => {
    if (!salesNodeEnabled.shipment_notice) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.nodeShipmentDisabled'));
      return;
    }
    showPushPreviewModal(
      () => previewPushSalesOrderToShipmentNotice(id),
      (payload?: any) => pushSalesOrderToShipmentNotice(id, payload),
      () => refreshDrawerOrder(id),
      id,
    );
  };

  /** 处理下推到销售发票 */
  const handlePushToInvoice = async (id: number) => {
    if (!salesNodeEnabled.invoice) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.nodeInvoiceDisabled'));
      return;
    }
    modalApi.confirm({
      title: pushToSalesInvoiceAction.label,
      content: t('app.kuaizhizao.salesOrder.pushToInvoiceConfirm'),
      zIndex: elevatedModalZIndex,
      onOk: async () => {
        try {
          const res = await pushSalesOrderToInvoice(id);
          messageApi.success(res?.message || t('app.kuaizhizao.salesOrder.invoiceCreated'));
          refreshDrawerOrder(id);
        } catch (error: any) {
          messageApi.error(salesOrderCatchMessage(error, t('app.kuaizhizao.salesOrder.pushFailed')));
        }
      },
    });
  };

  /** 处理下推到销售出库 */
  const handlePushToDelivery = async (id: number) => {
    modalApi.confirm({
      title: pushToSalesDeliveryAction.label,
      content: t('app.kuaizhizao.salesOrder.pushToDeliveryConfirm'),
      zIndex: elevatedModalZIndex,
      onOk: async () => {
        try {
          const res = await pushSalesOrderToDelivery(id);
          messageApi.success(res?.message || t('app.kuaizhizao.salesOrder.deliveryCreated'));
          refreshDrawerOrder(id);
        } catch (error: any) {
          messageApi.error(salesOrderCatchMessage(error, t('app.kuaizhizao.salesOrder.pushDeliveryFailed')));
        }
      },
    });
  };

  /** 打开下推销售退货弹窗 */
  const handlePushToSalesReturn = async (id: number) => {
    try {
      const detail = await getSalesOrder(id, true, false);
      const items = (detail.items || []).filter((it) => Number(it.delivered_quantity || 0) > 0);
      if (items.length === 0) {
        messageApi.warning(t('app.kuaizhizao.salesOrder.noReturnableQty'));
        return;
      }
      const quantities: Record<number, number> = {};
      items.forEach((it) => {
        if (it.id != null) quantities[it.id] = Number(it.delivered_quantity || 0);
      });
      setPushToReturnOrder(detail);
      setPushToReturnQuantities(quantities);
      setPushToReturnVisible(true);
    } catch (error: any) {
      messageApi.error(salesOrderCatchMessage(error, t('app.kuaizhizao.salesOrder.detailFailed')));
    }
  };

  const handlePushToSalesOrderChange = (id: number) => {
    navigate(`/apps/kuaizhizao/sales-management/sales-order-changes?source_order_id=${id}`);
  };

  /** 确认下推销售退货 */
  const handlePushToSalesReturnConfirm = async () => {
    if (!pushToReturnOrder?.id) return;
    if (!pushToReturnWarehouseId || pushToReturnWarehouseId <= 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.returnWarehouseRequired'));
      return;
    }
    const items = (pushToReturnOrder.items || []).filter((it) => Number(it.delivered_quantity || 0) > 0);
    for (const it of items) {
      if (it.id == null) continue;
      const qty = Number(pushToReturnQuantities[it.id] || 0);
      const max = Number(it.delivered_quantity || 0);
      if (qty <= 0) continue;
      if (qty > max) {
        messageApi.error(t('app.kuaizhizao.salesOrder.returnQtyExceedsMax', { material: it.material_code || it.material_name, max }));
        return;
      }
    }
    setPushToReturnLoading(true);
    try {
      const result = await pushSalesOrderToSalesReturn(pushToReturnOrder.id, {
        warehouse_id: pushToReturnWarehouseId,
        warehouse_name: pushToReturnWarehouseName || undefined,
        return_quantities: pushToReturnQuantities,
      });
      messageApi.success(t('app.kuaizhizao.salesOrder.returnCreated', { code: result?.return_code || t('app.kuaizhizao.salesOrder.createdFallback') }));
      setPushToReturnVisible(false);
      setPushToReturnOrder(null);
      setPushToReturnQuantities({});
      setPushToReturnWarehouseId(undefined);
      setPushToReturnWarehouseName('');
      refreshDrawerOrder(pushToReturnOrder.id);
    } catch (error: any) {
      messageApi.error(salesOrderCatchMessage(error, t('app.kuaizhizao.salesOrder.pushReturnFailed')));
    } finally {
      setPushToReturnLoading(false);
    }
  };

  /** 直推工单（含预览） */
  const handlePushToWorkOrder = async (id: number, _order?: SalesOrder | null) => {
    if (!salesNodeEnabled.work_order) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.nodeWorkOrderDisabled'));
      return;
    }
    showPushPreviewModal(
      () => previewPushSalesOrderToWorkOrder(id),
      () => pushSalesOrderToWorkOrder(id),
      () => refreshDrawerOrder(id),
      id,
    );
  };

  const mapPullQuotationRows = useCallback((rows: Quotation[]): PullQuotationCandidate[] => {
    return rows
      .filter((q) => q.id && q.quotation_code)
      .map((q) => ({
        id: Number(q.id),
        quotation_code: String(q.quotation_code),
        customer_name: q.customer_name || '',
        quotation_date: q.quotation_date || '',
        delivery_date: q.delivery_date || '',
        total_amount: q.total_amount != null ? Number(q.total_amount) : undefined,
        status: q.status || '',
        review_status: q.review_status || '',
        salesman_name: q.salesman_name || '',
        sales_order_id: q.sales_order_id ? Number(q.sales_order_id) : undefined,
        sales_order_code: q.sales_order_code || '',
        capabilities: q.capabilities,
      }));
  }, []);

  const pullFromQuotationScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromQuotationQuery = useUniPullQuery<PullQuotationCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullFromQuotationScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullQuotationSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const result = await listQuotations({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
          pullable_only: scope === 'pullable',
        });
        const rows: Quotation[] = Array.isArray(result) ? result : result.data || [];
        return {
          data: mapPullQuotationRows(rows),
          total: Array.isArray(result) ? rows.length : Number(result.total ?? rows.length),
        };
      } catch (error: any) {
        messageApi.error(salesOrderCatchMessage(error, t('app.kuaizhizao.salesOrder.loadQuotationsFailed')));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0]);
      const selected = rows[0];
      if (!selectedId || selectedId <= 0) {
        messageApi.warning(t('app.kuaizhizao.salesOrder.selectQuotationFirst'));
        return;
      }
      if (selected && !isPullQuotationSelectable(selected)) {
        const reason =
          quotationCapabilityReasonMessage(selected.capabilities?.convert_to_order?.reason, t) ||
          t('app.kuaizhizao.salesOrder.pullQuotationNotAllowed');
        messageApi.warning(reason);
        return;
      }
      try {
        const result = await pullSalesOrderFromQuotation(selectedId);
        messageApi.success(
          result?.message ||
            t('app.kuaizhizao.salesOrder.createdFromQuotation', {
              code: result?.sales_order?.order_code || '',
            }),
        );
        pullFromQuotationQuery.closeModal();
        invalidateMenuBadge();
        invalidateOrdersCache();
        actionRef.current?.reload();
        if (result?.sales_order?.id) {
          refreshDrawerOrder(result.sales_order.id);
        }
      } catch (error: any) {
        messageApi.error(
          salesOrderCatchMessage(
            error,
            t('app.kuaizhizao.salesOrder.pullCreateFailed', {
              source: pullFromQuotationAction.sourceLabel,
              target: pullFromQuotationAction.targetLabel,
            }),
          ),
        );
        throw error;
      }
    },
  });

  const mapPullSalesContractRows = useCallback((rows: SalesContract[]): PullSalesContractCandidate[] => {
    return rows
      .filter((row) => row.id && row.contract_code)
      .map((row) => ({
        id: Number(row.id),
        contract_code: String(row.contract_code),
        customer_name: row.customer_name || '',
        contract_date: row.contract_date || '',
        valid_to: row.valid_to || '',
        total_amount: row.total_amount != null ? Number(row.total_amount) : undefined,
        status: row.status || '',
        review_status: row.review_status || '',
        salesman_name: row.salesman_name || '',
        capabilities: row.capabilities,
      }));
  }, []);

  const pullFromSalesContractScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromSalesContractQuery = useUniPullQuery<PullSalesContractCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullFromSalesContractScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullSalesContractSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const result = await salesContractApi.list({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        const rows = mapPullSalesContractRows(result.items || []);
        const filtered = scope === 'pullable' ? rows.filter(isPullSalesContractSelectable) : rows;
        return {
          data: filtered,
          total: Number(result.total ?? filtered.length),
        };
      } catch (error: any) {
        messageApi.error(salesOrderCatchMessage(error, t('app.kuaizhizao.salesOrder.pullContract.loadFailed')));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0]);
      const selected = rows[0];
      if (!selectedId || selectedId <= 0) {
        messageApi.warning(t('app.kuaizhizao.salesOrder.pullContract.selectFirst'));
        return;
      }
      if (selected && !isPullSalesContractSelectable(selected)) {
        messageApi.warning(selected.capabilities?.push_to_sales_order?.reason || t('app.kuaizhizao.salesOrder.pullContract.notAllowed'));
        return;
      }
      try {
        const result = await pullSalesOrderFromSalesContract(selectedId);
        messageApi.success(
          result?.message ||
            t('app.kuaizhizao.salesOrder.pullContract.success', {
              code: result?.sales_order?.order_code || '',
            }),
        );
        pullFromSalesContractQuery.closeModal();
        invalidateMenuBadge();
        invalidateOrdersCache();
        actionRef.current?.reload();
        if (result?.sales_order?.id) {
          refreshDrawerOrder(result.sales_order.id);
        }
      } catch (error: any) {
        messageApi.error(
          salesOrderCatchMessage(
            error,
            t('app.kuaizhizao.salesOrder.pullCreateFailed', {
              source: pullFromSalesContractAction.sourceLabel,
              target: pullFromSalesContractAction.targetLabel,
            }),
          ),
        );
        throw error;
      }
    },
  });

  const pullQuotationColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.quotation.import.code'), dataIndex: 'quotation_code', width: 180 },
      {
        title: t('app.kuaizhizao.salesOrder.customerName'),
        dataIndex: 'customer_name',
        width: 180,
        ellipsis: true,
        render: (v: string) => v || '-',
      },
      {
        title: t('app.kuaizhizao.quotation.colQuotationDate'),
        dataIndex: 'quotation_date',
        width: 120,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.salesOrder.deliveryDate'),
        dataIndex: 'delivery_date',
        width: 120,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
        dataIndex: 'total_amount',
        width: 130,
        align: 'right' as const,
        render: (v: number | undefined) =>
          v != null
            ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '-',
      },
      {
        title: t('app.kuaizhizao.salesOrder.status'),
        dataIndex: 'status',
        width: 120,
        render: (v: string) => {
          let color: string = 'blue';
          if (v === '已转订单') color = 'gold';
          else if (v === '已接受') color = 'green';
          else if (v === '已拒绝') color = 'red';
          return <Tag color={color}>{v || t('app.kuaizhizao.salesOrder.unknownStatus')}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.reviewStatus'),
        dataIndex: 'review_status',
        width: 100,
        render: (v: string) => {
          const approved = v === 'APPROVED' || v === '已通过' || v === '审核通过';
          const rejected = v === 'REJECTED' || v === '已驳回';
          return <Tag color={approved ? 'green' : rejected ? 'red' : 'default'}>{v || '-'}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.salesman'),
        dataIndex: 'salesman_name',
        width: 120,
        ellipsis: true,
        render: (v: string) => normalizeUserDisplayName(v) || '-',
      },
      {
        title: t('app.kuaizhizao.salesOrder.duplicateGuardHint'),
        width: 260,
        render: (_: unknown, record: PullQuotationCandidate) => {
          if (isPullQuotationSelectable(record)) {
            return t('app.kuaizhizao.salesOrder.canCreate');
          }
          if (record.status === '已转订单' || record.sales_order_id) {
            return t('app.kuaizhizao.salesOrder.alreadyCreated', {
              code: record.sales_order_code || record.sales_order_id || '-',
            });
          }
          const reason = quotationCapabilityReasonMessage(
            record.capabilities?.convert_to_order?.reason,
            t,
          );
          return reason || t('app.kuaizhizao.salesOrder.pullQuotationNotAllowed');
        },
      },
    ],
    [t],
  );

  const pullSalesContractColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.salesContract.contractCode'), dataIndex: 'contract_code', width: 180 },
      {
        title: t('app.kuaizhizao.salesOrder.customerName'),
        dataIndex: 'customer_name',
        width: 180,
        ellipsis: true,
        render: (v: string) => v || '-',
      },
      {
        title: t('app.kuaizhizao.salesContract.contractDate'),
        dataIndex: 'contract_date',
        width: 120,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.salesContract.validUntil'),
        dataIndex: 'valid_to',
        width: 120,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
        dataIndex: 'total_amount',
        width: 130,
        align: 'right' as const,
        render: (v: number | undefined) =>
          v != null
            ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '-',
      },
      {
        title: t('app.kuaizhizao.salesOrder.status'),
        dataIndex: 'status',
        width: 120,
        render: (v: string) => <Tag color={v?.includes('关闭') ? 'default' : 'blue'}>{v || '-'}</Tag>,
      },
      {
        title: t('app.kuaizhizao.salesOrder.reviewStatus'),
        dataIndex: 'review_status',
        width: 100,
        render: (v: string) => {
          const approved = v === 'APPROVED' || v === '已通过' || v === '审核通过';
          const rejected = v === 'REJECTED' || v === '已驳回';
          return <Tag color={approved ? 'green' : rejected ? 'red' : 'default'}>{v || '-'}</Tag>;
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.salesman'),
        dataIndex: 'salesman_name',
        width: 120,
        ellipsis: true,
        render: (v: string) => normalizeUserDisplayName(v) || '-',
      },
      {
        title: t('app.kuaizhizao.salesOrder.duplicateGuardHint'),
        width: 260,
        render: (_: unknown, record: PullSalesContractCandidate) =>
          isPullSalesContractSelectable(record)
            ? t('app.kuaizhizao.salesOrder.canCreate')
            : record.capabilities?.push_to_sales_order?.reason || t('app.kuaizhizao.salesOrder.pullContract.notAllowed'),
      },
    ],
    [t],
  );

  const selectedPullQuotation = pullFromQuotationQuery.selectedRows[0];
  const selectedPullQuotationNotPullable = !!(
    selectedPullQuotation && !isPullQuotationSelectable(selectedPullQuotation)
  );
  const selectedPullSalesContract = pullFromSalesContractQuery.selectedRows[0];
  const selectedPullSalesContractNotPullable = !!(
    selectedPullSalesContract && !isPullSalesContractSelectable(selectedPullSalesContract)
  );

  /** 打开“从报价单创建销售订单”弹窗 */
  const handlePullFromQuotation = () => {
    pullFromQuotationQuery.openModal();
  };

  const handlePullFromSalesContract = () => {
    pullFromSalesContractQuery.openModal();
  };

  /** 打开提醒弹窗 */
  const handleOpenReminder = () => {
    reminderForm.resetFields();
    setReminderModalOpen(true);
  };


  /** 提交提醒 */
  const handleReminderSubmit = async () => {
    if (!currentSalesOrder?.id) return;
    try {
      const values = await reminderForm.validateFields();
      setReminderSubmitting(true);
      await createSalesOrderReminder(currentSalesOrder.id, {
        recipient_user_uuid: values.recipient_user_uuid,
        action_type: values.action_type,
        remarks: values.remarks,
      });
      messageApi.success(t('app.kuaizhizao.salesOrder.reminderSent'));
      setReminderModalOpen(false);
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(salesOrderCatchMessage(error, t('app.kuaizhizao.salesOrder.sendFailed')));
    } finally {
      setReminderSubmitting(false);
    }
  };

  /**
   * 处理撤回需求计算
   * 仅当需求计算尚未下推工单/采购单等下游单据时允许撤回
   */
  const handleWithdrawFromComputation = async (id: number) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.salesOrder.withdrawTitle'),
      content: t('app.kuaizhizao.salesOrder.withdrawConfirm'),
      zIndex: elevatedModalZIndex,
      onOk: async () => {
        try {
          await withdrawSalesOrderFromComputation(id);
          messageApi.success(t('app.kuaizhizao.salesOrder.withdrawSuccess'));
          refreshDrawerOrder(id);
        } catch (error: any) {
          messageApi.error(salesOrderCatchMessage(error, t('app.kuaizhizao.salesOrder.withdrawFailed')));
        }
      },
    });
  };

  /** 刷新抽屉内订单数据并刷新列表 */
  const refreshDrawerOrder = async (id?: number) => {
    const targetId = id ?? currentSalesOrder?.id;
    if (targetId) {
      try {
        const res = await getSalesOrder(targetId, true, true);
        setCurrentSalesOrder(res);
        setTrackingRefreshKey((k) => k + 1);
        await loadSalesOrderFieldValuesForDetail(targetId);
      } catch {
        // 忽略
      }
    }
    invalidateOrdersCache();
          actionRef.current?.reload();
  };

  /**
   * 处理批量导入
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.importDataEmpty'));
      return;
    }

    try {
      // 第一行是表头，从第二行开始是数据
      const headers = data[0];
      const rows = data.slice(1);

      // 字段映射（表头名称 -> 字段名），支持当前语言
      const fieldMap: Record<string, string> = {
        [t('app.kuaizhizao.salesOrder.orderDate')]: 'order_date',
        [t('app.kuaizhizao.salesOrder.deliveryDate')]: 'delivery_date',
        [t('app.kuaizhizao.salesOrder.importHeaderCustomerId')]: 'customer_id',
        [t('app.kuaizhizao.salesOrder.customerName')]: 'customer_name',
        [t('app.kuaizhizao.salesOrder.customerContact')]: 'customer_contact',
        [t('app.kuaizhizao.salesOrder.customerPhone')]: 'customer_phone',
        [t('app.kuaizhizao.salesOrder.importHeaderSalesmanId')]: 'salesman_id',
        [t('app.kuaizhizao.salesOrder.salesman')]: 'salesman_name',
        [t('app.kuaizhizao.salesOrder.shippingAddress')]: 'shipping_address',
        [t('app.kuaizhizao.salesOrder.shippingMethod')]: 'shipping_method',
        [t('app.kuaizhizao.salesOrder.paymentTerms')]: 'payment_terms',
        [t('app.kuaizhizao.salesOrder.notes')]: 'notes',
      };

      // 转换数据
      const salesOrders: Partial<SalesOrder>[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
          continue; // 跳过空行
        }

        const salesOrder: any = {
          status: SalesOrderStatus.DRAFT,
          review_status: ReviewStatus.PENDING,
        };

        // 映射字段
        for (let j = 0; j < headers.length && j < row.length; j++) {
          const header = headers[j]?.toString().trim();
          const value = row[j]?.toString().trim();

          if (!header || !value) continue;

          const fieldName = fieldMap[header];
          if (fieldName) {
            // 处理日期字段
            if (fieldName.includes('date')) {
              salesOrder[fieldName] = value;
            }
            // 处理数字字段
            else if (fieldName.includes('_id')) {
              salesOrder[fieldName] = value ? parseInt(value, 10) : null;
            }
            // 其他字段直接赋值
            else {
              salesOrder[fieldName] = value;
            }
          }
        }

        salesOrders.push(salesOrder);
      }

      if (salesOrders.length === 0) {
        messageApi.warning(t('app.kuaizhizao.salesOrder.noValidRows'));
        return;
      }

      // 批量创建销售订单
      let successCount = 0;
      let failureCount = 0;
      const errors: Array<{ row: number; error: string }> = [];

      for (let i = 0; i < salesOrders.length; i++) {
        const order = salesOrders[i];
        try {
          await createSalesOrder(order);
          successCount++;
        } catch (error: any) {
          failureCount++;
          errors.push({
            row: i + 2, // +2 因为第一行是表头，索引从0开始
            error: error.message || t('app.kuaizhizao.salesOrder.createFailed'),
          });
          console.error('创建销售订单失败:', error);
        }
      }

      if (failureCount === 0) {
        messageApi.success(t('app.kuaizhizao.salesOrder.importSuccess', { count: successCount }));
        invalidateOrdersCache();
        invalidateMenuBadge();
        invalidateStatistics();

          actionRef.current?.reload();
      } else {
        messageApi.warning(
          t('app.kuaizhizao.salesOrder.importPartialSuccess', { success: successCount, failed: failureCount })
        );
        // 显示错误详情
        if (errors.length > 0) {
          const errorMessages = errors
            .slice(0, 10) // 只显示前10个错误
            .map(err => t('app.kuaizhizao.salesOrder.importRowError', { row: err.row, error: err.error }))
            .join('\n');
          modalApi.error({
            title: t('app.kuaizhizao.salesOrder.importErrorDetail'),
            content: <pre style={{ whiteSpace: 'pre-wrap' }}>{errorMessages}</pre>,
            width: 600,
            zIndex: elevatedModalZIndex,
          });
        }
        invalidateOrdersCache();
        invalidateMenuBadge();
        invalidateStatistics();

          actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.salesOrder.batchImportFailed'));
    }
  };

  const handleItemImport = (data: any[][]) => {
    const priceTypeForm = salesFormPriceType(formRef.current?.getFieldValue('price_type'));
    // 假设数据从第3行开始（0:表头, 1:示例）
    const rows = data.slice(2);
    const newItems = rows
      .map((row) => {
        const materialCode = String(row[0] || '').trim();
        const spec = String(row[1] || '').trim();
        const unit = String(row[2] || '').trim();
        const quantity = parseFloat(row[3]) || 0;
        const price = parseFloat(row[4]) || 0;
        const deliveryDate = row[5];

        if (!materialCode) return null;

        const material = materials.find(m => m.mainCode === materialCode || m.code === materialCode);
        const taxR = Number((material as any)?.defaults?.defaultTaxRate ?? (material as any)?.defaults?.default_tax_rate) || 0;
        let unitPrice =
          price ||
          Number(
            (material as any)?.defaults?.defaultSalePrice ??
              (material as any)?.defaults?.default_sale_price ??
              (material as any)?.defaultSalePrice ??
              (material as any)?.default_sale_price,
          ) ||
          0;
        if (priceTypeForm === 'tax_inclusive' && unitPrice > 0) {
          unitPrice = convertUnitPriceByPriceType(unitPrice, taxR, 'tax_exclusive', 'tax_inclusive');
        }

        return {
          material_id: material?.id,
          material_code: material?.mainCode || material?.code || materialCode,
          material_name: material?.name || '',
          material_spec: material?.specification || spec,
          material_unit: material?.baseUnit || unit,
          required_quantity: quantity,
          unit_price: unitPrice,
          delivery_date: deliveryDate ? coerceFormDate(deliveryDate) ?? undefined : undefined,
          tax_rate: taxR,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null && (it.material_id !== undefined || it.material_code !== ''));

    if (newItems.length === 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.noValidData'));
      return;
    }

    const currentItems = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    messageApi.success(t('app.kuaizhizao.salesOrder.importSuccessItems', { count: newItems.length }));
  };

  /** 属性变更后按价格本重算行单价 */
  const refreshOrderLinePriceByVariant = React.useCallback(
    async (index: number, attrs?: Record<string, unknown>) => {
      const customerId = formRef.current?.getFieldValue('customer_id');
      const materialId = formRef.current?.getFieldValue(['items', index, 'material_id']);
      const material = materials.find((m) => m.id === Number(materialId));
      const orderDate = formRef.current?.getFieldValue('order_date');
      const asOf = orderDate != null ? (dayjs.isDayjs(orderDate) ? orderDate : dayjs(orderDate)) : dayjs();
      const pt = salesFormPriceType(formRef.current?.getFieldValue('price_type'));
      const full = material
        ? await resolveMaterialForPricing(material, materials)
        : undefined;
      const { unitPrice, taxRate } = await resolveOrderLineSalePrice(
        customerId ? Number(customerId) : undefined,
        materialId ? Number(materialId) : undefined,
        attrs,
        full,
        asOf,
      );
      let up = unitPrice;
      if (pt === 'tax_inclusive' && up > 0) {
        up = convertUnitPriceByPriceType(up, taxRate, 'tax_exclusive', 'tax_inclusive');
      }
      const items = [...normalizeFormListItems<any>(formRef.current?.getFieldValue('items'))];
      if (items[index]) {
        items[index] = {
          ...items[index],
          unit_price: up,
          tax_rate: taxRate,
          variant_attributes: attrs ?? items[index].variant_attributes,
        };
        formRef.current?.setFieldsValue({ items });
      }
    },
    [materials],
  );

  /** 从产品多选面板批量追加明细行（与「添加明细」默认字段一致，数量默认为 1） */
  const appendOrderItemsFromMaterials = React.useCallback(
    async (selected: Material[]) => {
      const pt = salesFormPriceType(formRef.current?.getFieldValue('price_type'));
      const mainDelivery = formRef.current?.getFieldValue('delivery_date');
      const defaultDelivery = coerceFormDate(mainDelivery) ?? dayjs();
      const customerId = formRef.current?.getFieldValue('customer_id');
      const orderDate = formRef.current?.getFieldValue('order_date');
      const asOf = orderDate != null ? (dayjs.isDayjs(orderDate) ? orderDate : dayjs(orderDate)) : dayjs();

      const priced = await resolveSalesDocumentMaterialLinesPricing(selected, {
        customerId: customerId ? Number(customerId) : undefined,
        asOf,
        priceType: pt,
        materialList: materials,
      });

      const rowFromMaterial = (m: Material, pricing: (typeof priced)[number]) => {
        const mainCode = m.mainCode ?? m.code ?? '';
        const st = m.sourceType ?? (m as any).source_type;
        return {
          material_id: m.id,
          material_code: mainCode,
          material_name: m.name ?? '',
          material_spec: m.specification ?? '',
          material_unit: m.baseUnit ?? '',
          required_quantity: 1,
          delivery_date: defaultDelivery,
          unit_price: pricing.unitPrice,
          tax_rate: pricing.taxRate,
          variant_attributes: undefined,
          _sourceType: st,
          _masterMaterialUuid: m.uuid,
        };
      };
      const isEmptyItemRow = (row: any) => {
        if (row == null) return true;
        if (row.material_id != null && row.material_id !== '') return false;
        const code = row.material_code;
        return code == null || String(code).trim() === '';
      };
      const queue = selected.map((m, i) => rowFromMaterial(m, priced[i]));
      const items = [...normalizeFormListItems<any>(formRef.current?.getFieldValue('items'))].map((row: any) => ({ ...row }));
      for (let i = 0; i < items.length && queue.length > 0; i++) {
        if (isEmptyItemRow(items[i])) {
          items[i] = queue.shift()!;
        }
      }
      while (queue.length > 0) {
        items.push(queue.shift()!);
      }
      formRef.current?.setFieldsValue({ items });
      messageApi.success(t('app.kuaizhizao.salesOrder.materialPickerAdded', { count: selected.length }));
    },
    [messageApi, t, materials],
  );

  const appendEmptyOrderItem = React.useCallback(() => {
    const mainDelivery = formRef.current?.getFieldValue('delivery_date');
    const defaultDelivery = coerceFormDate(mainDelivery) ?? dayjs();
    const items = [...normalizeFormListItems<any>(formRef.current?.getFieldValue('items'))];
    items.push({
      material_id: undefined,
      material_code: '',
      material_name: '',
      material_spec: '',
      material_unit: '',
      required_quantity: 0,
      delivery_date: defaultDelivery,
      unit_price: 0,
      tax_rate: 0,
      variant_attributes: '',
    });
    formRef.current?.setFieldsValue({ items });
  }, []);

  const selectedOrderForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const orderId = resolveOrderIdByRowKey(selectedRowKeys[0]);
    if (!orderId) return null;
    return tableOrders.find((row) => Number(row.id) === Number(orderId)) ?? null;
  }, [selectedRowKeys, resolveOrderIdByRowKey, tableOrders]);

  const handleTableDataChange = useCallback((data: SalesOrder[]) => {
    if (dataViewModeRef.current !== 'order') return;
    setTableOrders(data);
  }, []);

  const selectedOrdersForBatch = useMemo(
    () => resolveSelectedOrders(selectedRowKeys),
    [resolveSelectedOrders, selectedRowKeys],
  );

  const renderPushItemLabelWithReason = useCallback(
    (label: React.ReactNode, disabledReason?: string) =>
      disabledReason ? (
        <Tooltip title={disabledReason}>
          <span>{label}</span>
        </Tooltip>
      ) : (
        label
      ),
    [],
  );

  const getPushMenuItemClassName = useCallback(
    (disabledReason?: string) => (disabledReason ? 'ant-dropdown-menu-item-disabled' : undefined),
    [],
  );

  const buildToolbarPushMenuItems = useCallback((record: SalesOrder) => {
    const resolvePushReason = (
      cap: { allowed?: boolean; reason?: string | null } | undefined,
      permGate: { disabled: boolean; title?: string },
      nodeDisabled?: string,
    ): string | undefined => {
      if (permGate.disabled) return permGate.title ?? permDeniedTitle;
      if (!cap?.allowed) return salesOrderCapabilityReasonMessage(cap?.reason, t);
      if (nodeDisabled) return nodeDisabled;
      return undefined;
    };

    const computationDisabledReason = resolvePushReason(
      record.capabilities?.push_computation,
      { disabled: !salesOrderPerms.canUpdate, title: permDeniedTitle },
      !salesNodeEnabled.demand_computation ? t('app.kuaizhizao.salesOrder.nodeComputationDisabled') : undefined,
    );
    const workOrderDisabledReason = resolvePushReason(
      record.capabilities?.push_work_order,
      { disabled: !salesOrderPerms.canUpdate, title: permDeniedTitle },
      !salesNodeEnabled.work_order ? t('app.kuaizhizao.salesOrder.nodeWorkOrderDisabled') : undefined,
    );
    const invoiceDisabledReason = resolvePushReason(
      record.capabilities?.push_invoice,
      { disabled: !salesOrderPerms.canUpdate, title: permDeniedTitle },
      !salesNodeEnabled.invoice ? t('app.kuaizhizao.salesOrder.nodeInvoiceDisabled') : undefined,
    );
    const shipmentDisabledReason = resolvePushReason(
      record.capabilities?.push_shipment_notice,
      { disabled: !salesOrderPerms.canUpdate, title: permDeniedTitle },
      !salesNodeEnabled.shipment_notice ? t('app.kuaizhizao.salesOrder.nodeShipmentDisabled') : undefined,
    );
    const deliveryDisabledReason = resolvePushReason(
      record.capabilities?.push_sales_delivery,
      { disabled: !salesOrderPerms.canUpdate, title: permDeniedTitle },
      !salesNodeEnabled.shipment_notice ? t('app.kuaizhizao.salesOrder.nodeDeliveryDisabled') : undefined,
    );
    const canPushComputation = !computationDisabledReason;
    const canPushWorkOrder = !workOrderDisabledReason;
    const canPushShipment = !shipmentDisabledReason;
    const canPushDelivery = !deliveryDisabledReason;
    const canPushInvoice = !invoiceDisabledReason;
    const canPushSalesReturn =
      salesOrderPerms.canUpdate && record.capabilities?.push_sales_return?.allowed === true;
    const withdrawComputationDisabledReason = !salesOrderPerms.canUpdate
      ? permDeniedTitle
      : !record.capabilities?.withdraw_computation?.allowed
      ? salesOrderCapabilityReasonMessage(record.capabilities?.withdraw_computation?.reason, t)
      : undefined;
    const canWithdrawComputation = !withdrawComputationDisabledReason;

    return buildUniPushMenuItems([
      {
        key: 'computation',
        label: renderPushItemLabelWithReason(
          pushToDemandComputationAction.label,
          computationDisabledReason,
        ),
        className: getPushMenuItemClassName(computationDisabledReason),
        onClick: () => canPushComputation && handlePushToComputation(record.id!, record),
      },
      {
        key: 'workorder',
        label: renderPushItemLabelWithReason(
          pushToWorkOrderAction.label,
          workOrderDisabledReason,
        ),
        className: getPushMenuItemClassName(workOrderDisabledReason),
        onClick: () => canPushWorkOrder && handlePushToWorkOrder(record.id!, record),
      },
      { type: 'divider' as const },
      {
        key: 'invoice',
        label: renderPushItemLabelWithReason(
          pushToSalesInvoiceAction.label,
          invoiceDisabledReason,
        ),
        className: getPushMenuItemClassName(invoiceDisabledReason),
        onClick: () => canPushInvoice && handlePushToInvoice(record.id!),
      },
      {
        key: 'shipment',
        label: renderPushItemLabelWithReason(
          pushToShipmentNoticeAction.label,
          shipmentDisabledReason,
        ),
        className: getPushMenuItemClassName(shipmentDisabledReason),
        onClick: () => canPushShipment && handlePushToShipmentNotice(record.id!),
      },
      {
        key: 'delivery',
        label: renderPushItemLabelWithReason(
          pushToSalesDeliveryAction.label,
          deliveryDisabledReason,
        ),
        className: getPushMenuItemClassName(deliveryDisabledReason),
        onClick: () => canPushDelivery && handlePushToDelivery(record.id!),
      },
      {
        key: 'sales-return',
        label: pushToSalesReturnAction.label,
        disabled: !canPushSalesReturn,
        onClick: () => canPushSalesReturn && handlePushToSalesReturn(record.id!),
      },
      {
        key: 'sales-order-change',
        label: pushToSalesOrderChangeAction.label,
        disabled: !salesOrderPerms.canUpdate,
        onClick: () => salesOrderPerms.canUpdate && handlePushToSalesOrderChange(record.id!),
      },
      ...(record.pushed_to_computation || record.capabilities?.withdraw_computation?.allowed
        ? [
            { type: 'divider' as const },
            {
              key: 'withdraw',
              label: t('app.kuaizhizao.salesOrder.withdrawComputation'),
              disabled: !canWithdrawComputation,
              onClick: () => canWithdrawComputation && handleWithdrawFromComputation(record.id!),
            },
          ]
        : []),
    ]);
  }, [getPushMenuItemClassName, handlePushToComputation, handlePushToDelivery, handlePushToInvoice, handlePushToSalesOrderChange, handlePushToSalesReturn, handlePushToShipmentNotice, handlePushToWorkOrder, handleWithdrawFromComputation, permDeniedTitle, pushToDemandComputationAction.label, pushToSalesDeliveryAction.label, pushToSalesInvoiceAction.label, pushToSalesOrderChangeAction.label, pushToSalesReturnAction.label, pushToShipmentNoticeAction.label, pushToWorkOrderAction.label, renderPushItemLabelWithReason, salesNodeEnabled.demand_computation, salesNodeEnabled.invoice, salesNodeEnabled.shipment_notice, salesNodeEnabled.work_order, salesOrderPerms.canUpdate, t]);
  const toolbarPushMenuItems = useMemo(
    () => (selectedOrderForToolbar ? buildToolbarPushMenuItems(selectedOrderForToolbar) : []),
    [buildToolbarPushMenuItems, selectedOrderForToolbar]
  );
  const canUseToolbarPush =
    selectedOrderForToolbar != null && salesOrderHasToolbarPushActions(selectedOrderForToolbar);

  const salesOrderHighlightOverdueToolbar = useMemo(
    () => (
      <Space key="highlight-overdue-switch" align="center">
        <Switch checked={highlightDeliveryOverdue} onChange={setHighlightDeliveryOverdue} />
        <span style={{ fontSize: 13, color: 'var(--ant-color-text)' }}>
          {t('app.kuaizhizao.salesOrder.highlightOverdue')}
        </span>
      </Space>
    ),
    [highlightDeliveryOverdue, t],
  );

  const salesOrderToolbarRenderItems = useMemo(
    () => [
      <UniPullCreateToolbar
        key="create-sales-order-with-pull"
        compactKey="create-sales-order-with-pull"
        createIcon={<PlusOutlined />}
        createLabel={t('app.kuaizhizao.salesOrder.create')}
        onCreate={handleCreate}
        menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
          {
            key: 'pull-from-quotation',
            actionKey: 'sales_order.pull_from_quotation',
            onClick: handlePullFromQuotation,
          },
          {
            key: 'pull-from-sales-contract',
            actionKey: 'sales_order.pull_from_sales_contract',
            onClick: handlePullFromSalesContract,
          },
        ])}
      />,
      <UniPushToolbarButton
        key={`push-toolbar-${selectedRowKeys.join('-') || 'none'}`}
        menuItems={toolbarPushMenuItems}
        disabled={selectedRowKeys.length !== 1 || !canUseToolbarPush}
      />,
    ],
    [
      canUseToolbarPush,
      handleCreate,
      handlePullFromSalesContract,
      handlePullFromQuotation,
      selectedOrderForToolbar,
      selectedRowKeys,
      t,
      toolbarPushMenuItems,
    ],
  );

  // 订单视图列（一行一单，可展开明细）
  const salesOrderCustomFieldColumns = generateSalesOrderCustomFieldColumns();
  const orderColumns: ProColumns<SalesOrder>[] = [
    {
      title: t('app.kuaizhizao.salesOrder.colOrderPrimary'),
      key: 'order_code',
      dataIndex: 'order_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left' as const,
      sorter: true,
      hideInSearch: false,
      fieldProps: { placeholder: t('app.kuaizhizao.salesOrder.orderCode') },
      render: (_: unknown, record: SalesOrder) => (
        <UniTableStackedPrimaryCell
          primary={String(record.customer_name ?? '')}
          secondary={String(record.order_code ?? '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.salesOrder.customerName'),
      dataIndex: 'customer_name',
      ellipsis: true,
      sorter: true,
      hideInTable: true,
      hideInSearch: false,
      fieldProps: { placeholder: t('app.kuaizhizao.salesOrder.customerName') },
    },
    {
      title: t('app.kuaizhizao.salesOrder.orderDate'),
      key: 'order_date_delivery_date_stacked',
      dataIndex: 'order_date',
      width: 132,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: false,
      sorter: true,
      hideInSearch: true,
      render: (_: unknown, record: SalesOrder) => {
        const orderDateText = record.order_date ? formatDateTime(record.order_date, 'YYYY-MM-DD') : '-';
        const deliveryDateText = record.delivery_date ? formatDateTime(record.delivery_date, 'YYYY-MM-DD') : '-';
        const overdue = isSalesOrderDeliveryOverdue(record, auditEnabled);
        return (
          <UniTableStackedPrimaryCell
            primary={orderDateText}
            secondary={deliveryDateText}
            secondaryCopyable={false}
            uniformText
            secondaryExtra={
              overdue ? (
                <Tag color="error" style={{ marginInlineEnd: 0, flexShrink: 0 }}>
                  {t('app.kuaizhizao.salesOrder.overdueBadge')}
                </Tag>
              ) : null
            }
          />
        );
      },
    },
    // 订单日期范围（仅搜索）
    { title: t('app.kuaizhizao.salesOrder.orderDate'), dataIndex: 'order_date', valueType: 'dateRange', width: 120, hideInTable: true, hideInSearch: false, fieldProps: { placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')] } },
    {
      title: t('app.kuaizhizao.salesOrder.salesman'),
      dataIndex: 'salesman_id',
      hideInTable: true,
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        options: users.map(u => ({ label: u.full_name || u.username, value: u.id })),
      },
    },
    {
      title: t('app.kuaizhizao.salesOrder.salesman'),
      dataIndex: 'salesman_name',
      width: 100,
      hideInSearch: true,
      render: (_: unknown, record: SalesOrder) => normalizeUserDisplayName(record.salesman_name) || '-',
    },
    {
      title: t('app.kuaizhizao.salesOrder.deliveryDate'),
      dataIndex: 'delivery_date',
      width: 120,
      hideInTable: true,
      sorter: true,
      render: (_: unknown, record: SalesOrder) => {
        const raw = record.delivery_date;
        const text = raw ? formatDateTime(raw, 'YYYY-MM-DD') : '-';
        const overdue = isSalesOrderDeliveryOverdue(record, auditEnabled);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span>{text}</span>
            {overdue ? (
              <Tag color="error" style={{ marginInlineEnd: 0, flexShrink: 0 }}>
                {t('app.kuaizhizao.salesOrder.overdueBadge')}
              </Tag>
            ) : null}
          </span>
        );
      },
    },
    { title: t('app.kuaizhizao.salesOrder.totalQuantity'), dataIndex: 'total_quantity', width: 100, align: 'right' as const, sorter: true },
    { title: t('app.kuaizhizao.salesOrder.totalAmountLabel'), dataIndex: 'total_amount', width: 120, align: 'right' as const, sorter: true, render: (_: unknown, r: SalesOrder) => <AmountDisplay resource={SO} fieldName="total_amount" value={r.total_amount} /> },
    {
      title: t('app.kuaizhizao.salesOrder.pushRatio'),
      dataIndex: 'work_order_push_progress',
      width: 80,
      hideInSearch: true,
      render: (_: unknown, record: SalesOrder) => {
        const totalQty = Number(record.total_quantity ?? 0);
        const pushedQty = Number(record.pushed_work_order_quantity ?? 0);
        const remainingQty = Number(record.remaining_push_quantity ?? Math.max(totalQty - pushedQty, 0));
        const ratio = Number(record.work_order_push_progress ?? (totalQty > 0 ? (pushedQty / totalQty) * 100 : 0));
        const percent = Math.max(0, Math.min(100, ratio));
        return (
          <Tooltip title={t('app.kuaizhizao.salesOrder.pushRatioTooltip', { percent: Math.round(percent), pushed: pushedQty, total: totalQty, remaining: remainingQty })}>
            <Progress percent={Math.round(percent)} size="small" showInfo={false} style={{ margin: 0 }} />
          </Tooltip>
        );
      },
    },
    {
      title: t('app.kuaizhizao.salesOrder.deliveryProgress'),
      dataIndex: 'delivery_progress',
      width: 80,
      render: (_: unknown, record: SalesOrder) => {
        const p = record.delivery_progress ?? 0;
        const percent = Math.min(100, Math.max(0, Number(p)));
        return <Tooltip title={`${Math.round(percent)}%`}><Progress percent={Math.round(percent)} size="small" showInfo={false} style={{ margin: 0 }} /></Tooltip>;
      },
    },
    salesOrderAuditColumn,
    {
      title: t('app.kuaizhizao.salesOrder.lifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      align: 'left' as const,
      fixed: 'right' as const,
      valueType: 'select',
      valueEnum: lifecycleValueEnum,
      render: (_: unknown, record: SalesOrder) => {
        const lifecycle = getSalesOrderLifecycle(record, auditEnabled, t);
        return <ListUniLifecycleCell lifecycle={lifecycle} withSubStages />;
      },
    },
    ...salesOrderCustomFieldColumns,
    {
      title: t('app.kuaizhizao.salesOrder.actions'),
      fixed: 'right' as const,
      valueType: 'option',
      render: (_: any, record: SalesOrder) => {
        const canEdit = record.capabilities?.update?.allowed === true && salesOrderPerms.canUpdate;
        const canDelete = record.capabilities?.delete?.allowed === true && salesOrderPerms.canDelete;
        const parts: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="detail" onClick={() => handleDetail([record.id!])} />,
        ];
        if (canEdit) {
          parts.push(<Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit([record.id!])} />);
        }
        if (canDelete) {
          parts.push(<Button {...rowActionKind('delete')} key="delete" onClick={() => handleDeleteSingle(record.id!)} />);
        }
        parts.push(
          <UniWorkflowActions {...rowActionKind('skip')}
            key="workflow-actions"
            record={record}
            entityName={t('app.kuaizhizao.salesOrder.entityName')}
            entityType="sales_order"
            unifiedAudit
            resourcePrefix="kuaizhizao:sales-order"
            theme="link"
            size="small"
            onSuccess={() => { invalidateOrdersCache(); invalidateMenuBadge(); invalidateStatistics(); actionRef.current?.reload(); }}
            confirmMessages={{
              submit: isManualAuditEnabled(record.audit)
                ? t('app.kuaizhizao.salesOrder.submitConfirmAudit')
                : t('app.kuaizhizao.salesOrder.submitConfirmAuto'),
            }}
          />
        );
        parts.push(
          <Button {...rowActionAddFollowUpFromDocument()} key="follow-up" onClick={() => openFollowUpFromSalesOrder(record)} />,
        );
        return parts;
      },
    },
  ];

  const detailColumns: ProColumns<SalesOrderItemRow>[] = [
    {
      title: t('app.kuaizhizao.salesOrder.colOrderPrimary'),
      key: 'order_code',
      dataIndex: 'order_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left' as const,
      hideInSearch: false,
      fieldProps: { placeholder: t('app.kuaizhizao.salesOrder.orderCode') },
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.customer_name ?? '')}
          secondary={String(record.order_code ?? '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.salesOrder.customerName'),
      dataIndex: 'customer_name',
      ellipsis: true,
      hideInTable: true,
      hideInSearch: false,
      fieldProps: { placeholder: t('app.kuaizhizao.salesOrder.customerName') },
    },
    {
      title: t('app.kuaizhizao.salesOrder.material'),
      key: 'material_name',
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
      title: t('app.kuaizhizao.salesOrder.materialCode'),
      dataIndex: 'material_code',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.salesOrder.materialName'),
      dataIndex: 'material_name',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.salesOrder.materialSpec'),
      dataIndex: 'material_spec',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.salesOrder.unit'),
      dataIndex: 'material_unit',
      width: 72,
      render: (_: unknown, row: SalesOrderItemRow) => (
        <DictionaryLabel dictionaryCode="MATERIAL_UNIT" value={row.material_unit} />
      ),
    },
    {
      title: t('app.kuaizhizao.salesOrder.quantity'),
      dataIndex: 'required_quantity',
      width: 100,
      align: 'right' as const,
      render: (val: any, record: SalesOrderItemRow) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          <MaterialInventoryIndicator materialId={record.material_id} requiredQuantity={record.required_quantity} />
          {val ?? 0}
        </span>
      ),
    },
    { title: t('app.kuaizhizao.salesOrder.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' as const, render: (val: any) => <AmountDisplay resource={SO} fieldName="unit_price" value={val} /> },
    { title: t('app.kuaizhizao.salesOrder.taxRate'), dataIndex: 'tax_rate', width: 70, align: 'right' as const, render: (val: any) => val ?? 0 },
    { title: t('app.kuaizhizao.salesOrder.inclAmount'), dataIndex: 'item_amount', width: 100, align: 'right' as const, render: (val: any) => <AmountDisplay resource={SO} fieldName="amount_with_tax" value={val} /> },
    {
      title: t('app.kuaizhizao.salesOrder.deliveryDate'),
      dataIndex: 'delivery_date',
      width: 150,
      render: (_: unknown, row: SalesOrderItemRow) => {
        const raw = row.delivery_date;
        const text = raw ? formatDateTime(raw, 'YYYY-MM-DD') : '-';
        const overdue = isSalesOrderLineDeliveryOverdue(row, auditEnabled);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span>{text}</span>
            {overdue ? (
              <Tag color="error" style={{ marginInlineEnd: 0, flexShrink: 0 }}>
                {t('app.kuaizhizao.salesOrder.overdueBadge')}
              </Tag>
            ) : null}
          </span>
        );
      },
    },
    { title: t('app.kuaizhizao.salesOrder.deliveredQty'), dataIndex: 'delivered_quantity', width: 90, align: 'right' as const, render: (text: any) => text ?? 0 },
    { title: t('app.kuaizhizao.salesOrder.remainingQty'), dataIndex: 'remaining_quantity', width: 90, align: 'right' as const, render: (text: any) => text ?? 0 },
    {
      title: t('app.kuaizhizao.salesOrder.bomCheck'),
      key: 'bom_check',
      width: 70,
      render: (_: unknown, record: SalesOrderItemRow) => <MaterialBomIndicator materialId={record.material_id} />,
    },
    salesOrderLineAuditColumn,
    {
      title: t('app.kuaizhizao.salesOrder.lifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      hideInSearch: false,
      valueType: 'select',
      valueEnum: lifecycleValueEnum,
      render: (_: unknown, record: SalesOrderItemRow) => {
        const orderRecord = {
          id: record.sales_order_id,
          status: record.status,
          review_status: record.review_status,
          has_shippable_products: record.has_shippable_products,
          shippable_quantity: record.shippable_quantity,
          delivery_progress: record.delivery_progress,
        } as SalesOrder;
        const lifecycle = getSalesOrderLifecycle(orderRecord, auditEnabled, t);
        return <ListUniLifecycleCell lifecycle={lifecycle} withSubStages />;
      },
    },
    // 明细表格视图以每行订单明细为展示维度，纯查看用途，不提供操作按钮
  ];
  const alignedOrderColumns = useMemo(
    () => alignProColumns(orderColumns, SALES_DOC_LIST_FIELD_RANK),
    [orderColumns],
  );
  const alignedDetailColumns = useMemo(
    () => alignProColumns(detailColumns, SALES_DOC_LIST_FIELD_RANK),
    [detailColumns],
  );

  const columns = (dataViewMode === 'detail' ? alignedDetailColumns : alignedOrderColumns) as any[];

  /** 较昨日对比：显示 +x / -x 格式 */
  const renderDOD = (today?: number, yesterday?: number) => {
    if (today === undefined || yesterday === undefined) return null;
    const diff = today - yesterday;
    const color = diff > 0 ? '#cf1322' : diff < 0 ? '#3f8600' : 'rgba(0, 0, 0, 0.45)';
    const text = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0';
    return (
      <span style={{ marginLeft: 8, fontSize: 13, color }}>
        <span style={{ color: 'rgba(0,0,0,0.45)' }}>{t('app.kuaizhizao.salesOrder.statComparedYesterday')}</span> {text}
      </span>
    );
  };

  /** 折线图渲染（Area 面积图 + 渐变填充） */
  const renderTrendChart = (data: { date: string; value: number }[] = [], color: string) => {
    if (!data || data.length === 0) return null;
    return (
      <Area
        data={data}
        xField="date"
        yField="value"
        padding={0}
        axis={false}
        colorField={() => color}
        shapeField="smooth"
        style={{
          fill: `linear-gradient(-90deg, transparent 0%, ${color} 100%)`,
          fillOpacity: 0.1,
          stroke: strokeColorWithAlpha(color),
          lineWidth: 1,
        }}
        autoFit
      />
    );
  };

  const statCards: StatCard[] = statistics
    ? [
        {
          title: t('app.kuaizhizao.salesOrder.statOverdue'),
          value: statistics.overdue_count ?? 0,
          description:
            statistics.overdue_count !== undefined && statistics.yesterday_overdue !== undefined ? (
              <div>
                {t('app.kuaizhizao.salesOrder.statTodayPrefix')}: {statistics.overdue_count}{' '}
                {renderDOD(statistics.overdue_count, statistics.yesterday_overdue)}
              </div>
            ) : undefined,
          valueStyle: { color: '#ff4d4f' },
          backgroundChart: renderTrendChart(statistics.trend_overdue ?? [], '#ff4d4f'),
          onClick:
            (statistics.overdue_count ?? 0) > 0
              ? () => {
                  tableSearchFormRef.current?.setFieldsValue?.({ status: 'in_progress' });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
        {
          title: t('app.kuaizhizao.salesOrder.statTodayNew'),
          value: statistics.today_new_count ?? 0,
          suffix: t('app.kuaizhizao.salesOrder.unitOrders'),
          description:
            statistics.today_new_count !== undefined && statistics.yesterday_today_new !== undefined ? (
              <div>
                {t('app.kuaizhizao.salesOrder.statTodayPrefix')}: {statistics.today_new_count}{' '}
                {renderDOD(statistics.today_new_count, statistics.yesterday_today_new)}
              </div>
            ) : undefined,
          valueStyle: { color: token.colorPrimary },
          backgroundChart: renderTrendChart(statistics.trend_today_new ?? [], token.colorPrimary),
        },
        ...(auditEnabled
          ? [{
              title: t('app.kuaizhizao.salesOrder.lifecyclePendingReview'),
              value: statistics.pending_review_count ?? 0,
              description:
                statistics.pending_review_count !== undefined &&
                statistics.yesterday_pending_review !== undefined ? (
                  <div>
                    {t('app.kuaizhizao.salesOrder.statTodayPrefix')}: {statistics.pending_review_count}{' '}
                    {renderDOD(statistics.pending_review_count, statistics.yesterday_pending_review)}
                  </div>
                ) : (statistics.pending_review_count ?? 0) > 0 ? (
                  <div style={{ color: '#faad14' }}>{t('app.kuaizhizao.salesOrder.statNeedImmediate')}</div>
                ) : undefined,
              valueStyle: (statistics.pending_review_count ?? 0) > 0 ? { color: '#faad14' } : undefined,
              backgroundChart: renderTrendChart(statistics.trend_pending_review ?? [], '#faad14'),
              onClick:
                (statistics.pending_review_count ?? 0) > 0
                  ? () => {
                      tableSearchFormRef.current?.setFieldsValue?.({ status: 'PENDING_REVIEW' });
                      actionRef.current?.reload?.();
                    }
                  : undefined,
            }]
          : []),
        {
          title: t('app.kuaizhizao.salesOrder.statUnfulfilled'),
          value: statistics.unfulfilled_count ?? 0,
          description:
            statistics.unfulfilled_count !== undefined &&
            statistics.yesterday_unfulfilled !== undefined ? (
              <div>
                {t('app.kuaizhizao.salesOrder.statTodayPrefix')}: {statistics.unfulfilled_count}{' '}
                {renderDOD(statistics.unfulfilled_count, statistics.yesterday_unfulfilled)}
              </div>
            ) : undefined,
          valueStyle: { color: '#2f54eb' },
          backgroundChart: renderTrendChart(statistics.trend_unfulfilled ?? [], '#2f54eb'),
        },
        {
          title: t('app.kuaizhizao.salesOrder.statAnnualTotal'),
          value: statistics.annual_total_amount ?? 0,
          prefix: '¥',
          precision: 2,
          valueStyle: { color: token.colorPrimary },
          description: (
            <div style={{ color: (statistics.annual_total_yoy ?? 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
              {t('app.kuaizhizao.salesOrder.statVsLastYear')} {(statistics.annual_total_yoy ?? 0) > 0 ? '+' : ''}
              {statistics.annual_total_yoy ?? 0}%
            </div>
          ),
          backgroundChart: renderTrendChart(statistics.trend_annual ?? [], token.colorPrimary),
        },
      ]
    : [
        {
          title: t('app.kuaizhizao.salesOrder.statOverdue'),
          value: 0,
          valueStyle: { color: '#ff4d4f' },
        },
        {
          title: t('app.kuaizhizao.salesOrder.statTodayNew'),
          value: 0,
          suffix: t('app.kuaizhizao.salesOrder.unitOrders'),
          valueStyle: { color: token.colorPrimary },
        },
        ...(auditEnabled
          ? [{
              title: t('app.kuaizhizao.salesOrder.lifecyclePendingReview'),
              value: 0,
              valueStyle: { color: '#faad14' },
            }]
          : []),
        {
          title: t('app.kuaizhizao.salesOrder.statUnfulfilled'),
          value: 0,
          valueStyle: { color: '#2f54eb' },
        },
        {
          title: t('app.kuaizhizao.salesOrder.statAnnualTotal'),
          value: 0,
          prefix: '¥',
          precision: 2,
          valueStyle: { color: token.colorPrimary },
        },
      ];

  const triggerSalesOrderFormSubmit = () => formRef.current?.submit?.();

  useSubmitShortcut(() => triggerSalesOrderFormSubmit(), isFormPage);

  const salesOrderFormItemContent = (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="order_code"
            label={t('app.kuaizhizao.salesOrder.orderCode')}
            placeholder={isAutoGenerateEnabled('kuaizhizao-sales-order') ? t('app.kuaizhizao.salesOrder.orderCodeAutoPlaceholder') : t('app.kuaizhizao.salesOrder.orderCodePlaceholder')}
            rules={[{ required: true, message: t('app.kuaizhizao.salesOrder.orderCodeRequired') }]}
            fieldProps={{ disabled: isEditPage }}
          />
        </Col>
        <Col span={12}>
          <ProForm.Item
            name="customer_id"
            label={t('app.kuaizhizao.salesOrder.customerName')}
            rules={[{ required: true, message: t('app.kuaizhizao.salesOrder.selectCustomerRequired') }]}
          >
            <CustomerSelectDropdown
              hostResource="kuaizhizao:sales-order"
              placeholder={t('app.kuaizhizao.salesOrder.selectCustomer')}
              style={{ width: '100%' }}
              customers={customers}
              loading={customersLoading}
              onCustomersChange={setCustomers}
              autoLoad={false}
              modalZIndex={nestedElevatedPopupZIndex}
              onCustomerPick={(c) => {
                if (c) {
                  const sIdRaw = (c as any).salesmanId ?? (c as any).salesman_id;
                  const sId =
                    sIdRaw != null && sIdRaw !== '' && Number.isFinite(Number(sIdRaw)) ? Number(sIdRaw) : undefined;
                  const salesman = sId != null ? users.find((u) => Number(u.id) === sId) : undefined;
                  const sName =
                    (c as any).salesmanName ??
                    (c as any).salesman_name ??
                    (salesman ? normalizeUserDisplayName(salesman.full_name || salesman.username) : '');
                  formRef.current?.setFieldsValue({
                    customer_name: c.name ?? (c as any).customer_name,
                    customer_contact: (c as any).contactPerson ?? (c as any).contact_person ?? (c as any).contact,
                    customer_phone: (c as any).phone ?? (c as any).customer_phone,
                    salesman_id: sId,
                    salesman_name: normalizeUserDisplayName(sName),
                    shipping_address:
                      (c as any).deliveryAddress ??
                      (c as any).delivery_address ??
                      (c as any).address ??
                      (c as any).shipping_address ??
                      '',
                  });
                } else {
                  formRef.current?.setFieldsValue({
                    customer_name: undefined,
                    customer_contact: undefined,
                    customer_phone: undefined,
                    salesman_id: undefined,
                    salesman_name: undefined,
                    shipping_address: undefined,
                  });
                }
              }}
            />
          </ProForm.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={6}>
          <SalesOrderSalesmanField userList={users} loading={usersLoading} />
        </Col>
        <Col span={6}>
          <ProFormDatePicker
            name="order_date"
            label={t('app.kuaizhizao.salesOrder.orderDate')}
            rules={[{ required: true, message: t('app.kuaizhizao.salesOrder.orderDateRequired') }]}
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col span={6}>
          <ProFormDatePicker
            name="delivery_date"
            label={t('app.kuaizhizao.salesOrder.deliveryDate')}
            rules={[{ required: true, message: t('app.kuaizhizao.salesOrder.deliveryDateRequired') }]}
            fieldProps={buildFutureDateShortcutFieldProps({
              getForm: () => formRef.current,
              fieldName: 'delivery_date',
              baseFieldName: 'order_date',
              t,
              fieldProps: {
                onChange: (val: unknown) => {
                  const coerced = coerceFormDate(val);
                  if (coerced == null) return;
                  const items = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));
                  if (items.length) {
                    const next = items.map((it: any) => ({ ...it, delivery_date: coerced }));
                    formRef.current?.setFieldsValue({ items: next });
                  }
                },
              },
            })}
          />
        </Col>
        <Col span={6}>
          <DictionarySelect
            dictionaryCode="SHIPPING_METHOD"
            name="shipping_method"
            label={t('app.kuaizhizao.salesOrder.shippingMethod')}
            placeholder={t('app.kuaizhizao.salesOrder.selectShippingMethod')}
            formRef={formRef}
            valueEqualsLabel={false}
          />
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={4}>
          <ProFormText
            name="customer_contact"
            label={salesCommonFormLabels.contact}
            placeholder={t('app.kuaizhizao.salesOrder.contactPlaceholder')}
          />
        </Col>
        <Col span={4}>
          <ProFormText
            name="customer_phone"
            label={salesCommonFormLabels.phone}
            placeholder={t('app.kuaizhizao.salesOrder.phonePlaceholder')}
          />
        </Col>
        <Col span={8}>
          <ProFormText
            name="shipping_address"
            label={t('app.kuaizhizao.salesOrder.shippingAddress')}
            placeholder={t('app.kuaizhizao.salesOrder.shippingAddressPlaceholder')}
          />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="PAYMENT_TERMS"
            name="payment_terms"
            label={t('app.kuaizhizao.salesOrder.paymentTerms')}
            placeholder={t('app.kuaizhizao.salesOrder.selectPaymentTerms')}
            formRef={formRef}
            valueEqualsLabel={false}
          />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="CURRENCY"
            name="currency_code"
            label={t('app.kuaizhizao.quotation.form.currency')}
            placeholder={t('app.kuaizhizao.quotation.form.selectCurrency')}
            formRef={formRef}
            initialValue={defaultSalesOrderCurrency}
            valueEqualsLabel={false}
          />
        </Col>
      </Row>
      <ProFormText name="customer_name" hidden />
      <ProFormText name="price_type" hidden initialValue={DEFAULT_SALES_PRICE_TYPE} />
      <CustomFieldsFormSection
        customFields={salesOrderFormCustomFields}
        customFieldValues={salesOrderFormCustomFieldValues}
        gridColumns={4}
      />

          <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.price_type !== curr?.price_type}>
            {({ getFieldValue: getFormValue }: any) => {
              const priceType = salesFormPriceType(getFormValue('price_type'));
              const showTaxColumns = priceType === 'tax_inclusive';
              const materialSourceType = productScope === 'make' ? 'Make' : undefined;
              const productColumnTitle = (
                <Space size={8} align="center">
                  <span>{t('app.kuaizhizao.salesOrder.material')}</span>
                  <ThemedSegmented
                    size="small"
                    value={productScope}
                    options={[
                      { label: t('app.kuaizhizao.sales.common.productScopeMake'), value: 'make' },
                      { label: t('app.kuaizhizao.sales.common.productScopeAll'), value: 'all' },
                    ]}
                    onChange={(val) => setProductScope((val as 'make' | 'all') ?? 'make')}
                  />
                </Space>
              );
              const orderDetailColumns = [
                    {
                      title: productColumnTitle,
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
                              <div className="uni-detail-material-cell quotation-material-cell" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
                                <MaterialInventoryIndicator
                                  materialId={mid}
                                  requiredQuantity={Number(row?.required_quantity) || 0}
                                />
                                <div style={{ flex: 1, minWidth: 200 }}>
                                  <UniMaterialSelect
                                    name={[index, 'material_id']}
                                    label=""
                                    placeholder={t('app.kuaizhizao.salesOrder.selectMaterial')}
                                    required
                                    size={DOCUMENT_DETAIL_CONTROL_SIZE}
                                    fillMapping={{
                                      material_code: 'mainCode',
                                      material_name: 'name',
                                      material_spec: 'specification',
                                      material_unit: 'baseUnit',
                                    }}
                                    fallbackOption={fallback}
                                    formItemProps={{ style: { margin: 0 } }}
                                    showQuickCreate
                                    showAdvancedSearch
                                    sourceType={materialSourceType}
                                    onChange={(_val, material) => {
                                      if (!material) return;
                                      formRef.current?.setFieldValue(
                                        ['items', index, '_sourceType'],
                                        (material as any)?.sourceType || (material as any)?.source_type,
                                      );
                                      formRef.current?.setFieldValue(
                                        ['items', index, '_masterMaterialUuid'],
                                        material.uuid,
                                      );
                                      formRef.current?.setFieldValue(
                                        ['items', index, 'variant_attributes'],
                                        undefined,
                                      );
                                      void applySalesDocumentLineMaterialPricing(
                                        formRef.current,
                                        index,
                                        material,
                                        { materialList: materials, asOfField: 'order_date' },
                                      );
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          }}
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.variantAttributes'),
                      dataIndex: 'variant_attributes',
                      width: DOCUMENT_DETAIL_COL_WIDTH.variantAttributes,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: any, __: any, index: number) =>
                        formRef.current ? (
                          <OrderLineVariantAttributesCell
                            form={formRef.current}
                            rowIndex={index}
                            materials={materials}
                            onAttributesChange={(attrs) => refreshOrderLinePriceByVariant(index, attrs)}
                          />
                        ) : null,
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.spec'),
                      dataIndex: 'material_spec',
                      width: DOCUMENT_DETAIL_COL_WIDTH.spec,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                          <Input placeholder={t('app.kuaizhizao.salesOrder.spec')} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.unit'),
                      dataIndex: 'material_unit',
                      width: DOCUMENT_DETAIL_COL_WIDTH.unit,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                          {({ getFieldValue }) => {
                            const materialId = getFieldValue(['items', index, 'material_id']);
                            return (
                              <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
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
                      title: t('app.kuaizhizao.salesOrder.quantity'),
                      dataIndex: 'required_quantity',
                      width: DOCUMENT_DETAIL_COL_WIDTH.quantity,
                      ...DOCUMENT_DETAIL_NUM_COL,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'required_quantity']} rules={[{ required: true, message: t('common.required') }, { type: 'number', min: 0.01, message: t('app.kuaizhizao.salesOrder.quantityMinHint') }]} style={{ margin: 0 }}>
                          <InputNumber placeholder={t('app.kuaizhizao.salesOrder.quantity')} min={0} precision={2} style={{ width: '100%' }} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title:
                        priceType === 'tax_inclusive'
                          ? t('app.kuaizhizao.salesOrder.unitPriceColumnTaxInclusive')
                          : t('app.kuaizhizao.salesOrder.unitPriceColumnTaxExclusive'),
                      dataIndex: 'unit_price',
                      width: DOCUMENT_DETAIL_COL_WIDTH.unitPrice,
                      ...DOCUMENT_DETAIL_NUM_COL,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                          {() => (
                            <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                              <InputNumber
                                placeholder={
                                  priceType === 'tax_inclusive'
                                    ? t('app.kuaizhizao.salesOrder.unitPricePlaceholderTaxInclusive')
                                    : t('app.kuaizhizao.salesOrder.unitPricePlaceholder')
                                }
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
                            title: t('app.kuaizhizao.salesOrder.exclAmount'),
                            width: DOCUMENT_DETAIL_COL_WIDTH.exclAmount,
                            ...DOCUMENT_DETAIL_NUM_COL,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                {({ getFieldValue }: any) => {
                                  const items = normalizeFormListItems<any>(getFieldValue('items'));
                                  const row = items[index];
                                  const line = calcSalesLineAmounts(
                                    row?.required_quantity,
                                    row?.unit_price,
                                    row?.tax_rate,
                                    priceType,
                                  );
                                  return (
                                    <AmountDisplay
                                      resource={SO}
                                      fieldName="amount_without_tax"
                                      value={line.excl}
                                      style={DOCUMENT_DETAIL_AMOUNT_STYLE}
                                    />
                                  );
                                }}
                              </AntForm.Item>
                            ),
                          },
                        ]
                      : []),
                    ...(showTaxColumns
                      ? [
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
                            title: t('app.kuaizhizao.salesOrder.taxAmount'),
                            width: DOCUMENT_DETAIL_COL_WIDTH.taxAmount,
                            ...DOCUMENT_DETAIL_NUM_COL,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                {({ getFieldValue }: any) => {
                                  const items = normalizeFormListItems<any>(getFieldValue('items'));
                                  const row = items[index];
                                  const line = calcSalesLineAmounts(
                                    row?.required_quantity,
                                    row?.unit_price,
                                    row?.tax_rate,
                                    priceType,
                                  );
                                  return (
                                    <AmountDisplay
                                      resource={SO} fieldName="tax_amount" value={line.tax}
                                      style={DOCUMENT_DETAIL_AMOUNT_STYLE}
                                    />
                                  );
                                }}
                              </AntForm.Item>
                            ),
                          },
                        ]
                      : []),
                    {
                      title: showTaxColumns
                        ? t('app.kuaizhizao.salesOrder.inclAmount')
                        : t('app.kuaizhizao.salesOrder.exclAmount'),
                      width: DOCUMENT_DETAIL_COL_WIDTH.lineAmount,
                      ...DOCUMENT_DETAIL_NUM_COL,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                          {({ getFieldValue }: any) => {
                            const items = normalizeFormListItems<any>(getFieldValue('items'));
                            const row = items[index];
                            const qty = Number(row?.required_quantity) || 0;
                            const taxRate = Number(row?.tax_rate) || 0;
                            const line = calcSalesLineAmounts(
                              row?.required_quantity,
                              row?.unit_price,
                              row?.tax_rate,
                              priceType,
                            );
                            if (!showTaxColumns) {
                              return (
                                <AmountDisplay
                                  resource={SO}
                                  fieldName="amount_without_tax"
                                  value={line.excl}
                                  style={DOCUMENT_DETAIL_AMOUNT_STYLE}
                                />
                              );
                            }
                            const totalIncl = line.incl;
                            const isEditing = editingIncl?.index === index;
                            const displayValue = isEditing ? editingIncl.value : totalIncl;
                            return (
                              <InputNumber
                                placeholder={t('app.kuaizhizao.salesOrder.inclAmountPlaceholder')}
                                min={0}
                                precision={2}
                                prefix="¥"
                                style={{ width: '100%' }}
                                size={DOCUMENT_DETAIL_CONTROL_SIZE}
                                value={displayValue}
                                onChange={(val) => {
                                  const v = val ?? null;
                                  editingInclValueRef.current = v;
                                  setEditingIncl({ index, value: v });
                                }}
                                onFocus={() => {
                                  setEditingIncl((prev) => (prev?.index === index ? prev : { index, value: totalIncl }));
                                  editingInclValueRef.current = totalIncl;
                                }}
                                onBlur={() => {
                                  const incl = editingInclValueRef.current;
                                  if (editingIncl?.index === index && incl != null && qty > 0) {
                                    const factor = 1 + taxRate / 100;
                                    const newPrice = priceType === 'tax_inclusive'
                                      ? incl / qty
                                      : (factor > 0 ? incl / factor : incl) / qty;
                                    const next = [...items];
                                    next[index] = { ...row, unit_price: newPrice };
                                    formRef.current?.setFieldsValue({ items: next });
                                  }
                                  setEditingIncl(null);
                                }}
                              />
                            );
                          }}
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.deliveryDate'),
                      dataIndex: 'delivery_date',
                      width: DOCUMENT_DETAIL_COL_WIDTH.deliveryDate,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item
                          name={[index, 'delivery_date']}
                          rules={[{ required: true, message: t('common.required') }]}
                          style={{ margin: 0 }}
                          getValueProps={(value) => ({ value: coerceFormDate(value) ?? undefined })}
                          normalize={(value) => coerceFormDate(value) ?? undefined}
                        >
                          <FutureDatePicker
                            size={DOCUMENT_DETAIL_CONTROL_SIZE}
                            style={DOCUMENT_DETAIL_DATE_PICKER_STYLE}
                            format="YYYY-MM-DD"
                            getForm={() => formRef.current}
                            baseFieldName="order_date"
                            t={t}
                            onApply={(date) =>
                              formRef.current?.setFieldValue?.(['items', index, 'delivery_date'], date)
                            }
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.notes'),
                      dataIndex: 'notes',
                      width: DOCUMENT_DETAIL_COL_WIDTH.notes,
                      ...DOCUMENT_DETAIL_TEXT_COL,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'notes']} style={{ margin: 0 }}>
                          <Input placeholder={t('app.kuaizhizao.salesOrder.notes')} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                        </AntForm.Item>
                      ),
                    },
                  ];
              return (
                <>
                <DocumentDetailTableStyles />
                <UniTableDetail
                  name="items"
                  title={t('app.kuaizhizao.salesOrder.orderItems')}
                  required
                  requiredMessage={t('app.kuaizhizao.salesOrder.itemsRequired')}
                  leftExtra={(
                    <PriceTypeSwitch
                      checked={priceType === 'tax_inclusive'}
                      onChange={handlePriceTypeChange}
                    />
                  )}
                  headerExtra={(
                    <Space size={8}>
                      <Button
                        type="default"
                        icon={<ImportOutlined />}
                        onClick={() => setImportModalVisible(true)}
                      >
                        {t('app.kuaizhizao.salesOrder.importItems')}
                      </Button>
                      <Button
                        type="default"
                        icon={<PlusOutlined />}
                        onClick={appendEmptyOrderItem}
                      >
                        {t('app.kuaizhizao.salesOrder.addItem')}
                      </Button>
                      <Button
                        type="default"
                        icon={<AppstoreAddOutlined />}
                        onClick={() => setMaterialPickerOpen(true)}
                      >
                        {t('app.kuaizhizao.salesOrder.selectProducts')}
                      </Button>
                    </Space>
                  )}
                  columns={orderDetailColumns}
                  disabledAdd
                  initialValue={() => {
                    const mainDelivery = formRef.current?.getFieldValue('delivery_date');
                    const defaultDelivery = coerceFormDate(mainDelivery) ?? dayjs();
                    return {
                      material_id: undefined,
                      material_code: '',
                      material_name: '',
                      material_spec: '',
                      material_unit: '',
                      required_quantity: 0,
                      delivery_date: defaultDelivery,
                      unit_price: 0,
                      tax_rate: 0,
                      variant_attributes: '',
                    };
                  }}
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
            prev?.price_type !== curr?.price_type ||
            prev?.discount_amount !== curr?.discount_amount
          }
        >
          {({ getFieldValue }: { getFieldValue: (n: string) => any }) => (
            <DocumentAmountSummary variant="sales" getFieldValue={getFieldValue} quantityField="required_quantity" />
          )}
        </AntForm.Item>

          <DocumentAttachmentsField
            category="sales_order_attachments"
            label={t('app.kuaizhizao.salesOrder.attachments')}
          />

          <ProFormTextArea
            name="notes"
            label={t('app.kuaizhizao.salesOrder.notes')}
            placeholder={t('app.kuaizhizao.salesOrder.notesPlaceholder')}
          />
    </>
  );

  const salesOrderFormAuxModals = (
    <>
        <UniMaterialBatchPicker
          hostResource="kuaizhizao:sales-order"
          open={materialPickerOpen}
          zIndex={nestedElevatedPopupZIndex}
          onCancel={() => setMaterialPickerOpen(false)}
          onConfirm={async (selected) => {
            await appendOrderItemsFromMaterials(selected);
            setMaterialPickerOpen(false);
          }}
        />
        <Suspense fallback={null}>
          <LazyUniImport
            visible={importModalVisible}
            onCancel={() => setImportModalVisible(false)}
            onConfirm={handleItemImport}
            title={t('app.kuaizhizao.salesOrder.importItemsTitle')}
            headers={[t('app.kuaizhizao.salesOrder.materialCode'), t('app.kuaizhizao.salesOrder.spec'), t('app.kuaizhizao.salesOrder.unit'), t('app.kuaizhizao.salesOrder.quantity'), t('app.kuaizhizao.salesOrder.unitPrice'), t('app.kuaizhizao.salesOrder.deliveryDate')]}
            exampleRow={['MAT001', 'Spec X', 'PCS', '100', '1.5', '2026-03-01']}
          />
        </Suspense>
    </>
  );

  if (isFormPage) {
    const canSubmitAfterSave =
      isCreatePage || (isEditPage && isDraftStatus(formEditOrder?.status));
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
                onClick={leaveSalesOrderFormPage}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {isCreatePage
                  ? t('app.kuaizhizao.menu.sales-management.sales-orders.new')
                  : t('app.kuaizhizao.menu.sales-management.sales-orders.edit')}
              </Typography.Title>
            </Space>
            <Space wrap align="center">
              {isCreatePage && kuaiaiAvailable ? (
                <SalesOrderAiCreateTrigger
                  formRef={formRef}
                  customers={customers}
                  materials={materials}
                  users={users}
                  onCustomersChange={setCustomers}
                  onMaterialsChange={setMaterials}
                />
              ) : null}
              <DocumentFormPageHeaderActions
                onCancel={leaveSalesOrderFormPage}
                onSaveDraft={() => void handleSaveDraft()}
                onPrimarySubmit={triggerSalesOrderFormSubmit}
                isCreatePage={isCreatePage}
                canSubmitAfterSave={canSubmitAfterSave}
              />
            </Space>
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
                onFinish={async () => {
                  setModalSubmitting(true);
                  try {
                    const values = formRef.current?.getFieldsValue(true);
                    await handleSaveInternal(values, false);
                  } finally {
                    setModalSubmitting(false);
                  }
                }}
                onFinishFailed={({ errorFields }) => {
                  const first = errorFields?.[0];
                  const text = first?.errors?.filter(Boolean)[0];
                  messageApi.error(text || t('components.layoutTemplates.formModal.checkFormHint'));
                }}
                initialValues={
                  isCreatePage
                    ? {
                        price_type: DEFAULT_SALES_PRICE_TYPE,
                        order_date: dayjs(),
                        currency_code: defaultSalesOrderCurrency,
                        items: [{ ...defaultOrderItem }],
                      }
                    : undefined
                }
              >
                {salesOrderFormItemContent}
              </ProForm>
            </div>
          </Card>
        </DocumentFormPageLayout>
        {salesOrderFormAuxModals}
      </>
    );
  }

  return (
    <>
      <style>{`
        .sales-order-row-overdue td.ant-table-cell {
          background: var(--ant-color-warning-bg) !important;
        }
      `}</style>
      <ListPageTemplate statCards={statCards}>
        <SalesOrderIndicatorsProvider>
        <UniTable
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.sales-orders"
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          onTableDataChange={handleTableDataChange}
          formRef={tableSearchFormRef}
          headerTitle={t('app.kuaizhizao.salesOrder.title')}
          viewTypes={['table', 'detailTable', 'help']}
          defaultViewType="table"
          onViewTypeChange={(v) => {
            const nextMode = v === 'table' ? 'order' : 'detail';
            dataViewModeRef.current = nextMode;
            setViewTypeState(v as 'table' | 'detailTable' | 'help');
            setTimeout(() => actionRef.current?.reload(), 0);
          }}
          detailTableColumns={detailColumns}
          helpViewConfig={{
            content: (
              <div style={{ lineHeight: 1.8 }}>
                <p><strong>{t('components.uniTable.viewTable')}</strong>{t('app.kuaizhizao.salesOrder.helpTableView')}</p>
                <p><strong>{t('components.uniTable.viewDetailTable')}</strong>{t('app.kuaizhizao.salesOrder.helpDetailTableView')}</p>
              </div>
            ),
          }}
          actionRef={actionRef}
          toolBarButtonSize="middle"
          columns={columns}
          rowKey={dataViewMode === 'detail' ? '_rowKey' : 'id'}
          rowClassName={(record) => {
            if (!highlightDeliveryOverdue) return '';
            if (dataViewMode === 'order') {
              return isSalesOrderDeliveryOverdue(record as SalesOrder, auditEnabled) ? 'sales-order-row-overdue' : '';
            }
            return isSalesOrderLineDeliveryOverdue(record as SalesOrderItemRow, auditEnabled)
              ? 'sales-order-row-overdue'
              : '';
          }}
          request={async (params: any, sort: any, _filter: any, searchFormValues: any): Promise<any> => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };
            // 以 lifecycle 为唯一展示入口：搜索时按 lifecycle 阶段映射到后端 status / review_status
            Object.assign(apiParams, resolveSalesOrderListLifecycleParams(searchFormValues, params));
            if (searchFormValues?.customer_name) apiParams.customer_name = searchFormValues.customer_name;
            if (searchFormValues?.order_code) apiParams.order_code = searchFormValues.order_code;
            if (searchFormValues?.keyword) apiParams.keyword = searchFormValues.keyword;
            // 订单日期范围
            if (searchFormValues?.order_date && Array.isArray(searchFormValues.order_date) && searchFormValues.order_date.length === 2) {
              const [start, end] = searchFormValues.order_date;
              if (start) apiParams.start_date = formatDateTime(start, 'YYYY-MM-DD');
              if (end) apiParams.end_date = formatDateTime(end, 'YYYY-MM-DD');
            }
            // 排序
            if (sort && Object.keys(sort).length > 0) {
              const key = Object.keys(sort)[0];
              const order = sort[key];
              if (order) {
                apiParams.order_by = order === 'ascend' ? key : `-${key}`;
              }
            }
            // 始终请求 include_items=true，切换视图时从缓存转换，避免重复请求
            apiParams.include_items = true;
            const paramsKey = JSON.stringify({
              skip: apiParams.skip,
              limit: apiParams.limit,
              status: apiParams.status,
              review_status: apiParams.review_status,
              lifecycle_stage: apiParams.lifecycle_stage,
              customer_name: apiParams.customer_name,
              order_code: apiParams.order_code,
              keyword: apiParams.keyword,
              start_date: apiParams.start_date,
              end_date: apiParams.end_date,
              order_by: apiParams.order_by,
            });

            const toFlatRows = (orders: SalesOrder[]) => {
              const map = new Map<string, number>();
              const flatRows: SalesOrderItemRow[] = [];
              for (const order of orders) {
                const lifecycle = getSalesOrderLifecycle(order as SalesOrder, auditEnabled);
                const stageName = lifecycle.stageName ?? order.status ?? '草稿';
                const items = order.items ?? [];
                if (items.length === 0) {
                  const rowKey = `order-${order.id}-empty`;
                  map.set(rowKey, order.id ?? 0);
                  flatRows.push({
                    _rowKey: rowKey,
                    _lifecycleStage: stageName,
                    sales_order_id: order.id ?? 0,
                    order_code: order.order_code,
                    customer_name: order.customer_name,
                    order_date: order.order_date,
                    order_delivery_date: order.delivery_date,
                    total_quantity: order.total_quantity,
                    total_amount: order.total_amount,
                    delivery_progress: order.delivery_progress,
                    pushed_work_order_quantity: order.pushed_work_order_quantity,
                    remaining_push_quantity: order.remaining_push_quantity,
                    work_order_push_progress: order.work_order_push_progress,
                    status: order.status,
                    review_status: order.review_status,
                    pushed_to_computation: order.pushed_to_computation,
                    has_shippable_products: order.has_shippable_products,
                    shippable_quantity: order.shippable_quantity,
                    material_code: '-',
                    material_name: '-',
                    required_quantity: 0,
                    delivery_date: order.delivery_date ?? '',
                  } as SalesOrderItemRow);
                } else {
                  items.forEach((item: SalesOrderItem, idx: number) => {
                    const rowKey = item.id ? `order-${order.id}-item-${item.id}` : `order-${order.id}-idx-${idx}`;
                    map.set(rowKey, order.id ?? 0);
                    flatRows.push({
                      ...item,
                      _rowKey: rowKey,
                      _lifecycleStage: stageName,
                      sales_order_id: order.id ?? 0,
                      order_code: order.order_code,
                      customer_name: order.customer_name,
                      order_date: order.order_date,
                      order_delivery_date: order.delivery_date,
                      total_quantity: order.total_quantity,
                      total_amount: order.total_amount,
                      delivery_progress: order.delivery_progress,
                      pushed_work_order_quantity: order.pushed_work_order_quantity,
                      remaining_push_quantity: order.remaining_push_quantity,
                      work_order_push_progress: order.work_order_push_progress,
                      status: order.status,
                      review_status: order.review_status,
                      pushed_to_computation: order.pushed_to_computation,
                      has_shippable_products: order.has_shippable_products,
                      shippable_quantity: order.shippable_quantity,
                      material_code: item.material_code ?? '',
                      material_name: item.material_name ?? '',
                      material_spec: item.material_spec ?? '',
                      material_unit: item.material_unit ?? '',
                      required_quantity: item.required_quantity ?? 0,
                      unit_price: item.unit_price,
                      tax_rate: item.tax_rate,
                      item_amount: item.item_amount,
                      delivered_quantity: item.delivered_quantity,
                      remaining_quantity: item.remaining_quantity,
                      delivery_date: item.delivery_date ?? order.delivery_date ?? '',
                    } as SalesOrderItemRow);
                  });
                }
              }
              rowKeyToOrderIdRef.current = map;
              return flatRows;
            };

            try {
              const response = await listSalesOrders(apiParams);
              const orders: SalesOrder[] = Array.isArray(response)
                ? response
                : (response as any).data || [];
              const total: number = (response as any).total ?? orders.length;
              lastOrdersCacheRef.current = { orders, total, paramsKey };
              const mode = dataViewModeRef.current;
              if (mode === 'order') {
                const map = new Map<string, number>();
                orders.forEach(o => {
                  if (o.id) map.set(String(o.id), o.id);
                });
                rowKeyToOrderIdRef.current = map;
                const enriched = await enrichSalesOrderRecordsWithCustomFields(orders);
                return { data: enriched, success: true, total };
              }
              return { data: toFlatRows(orders), success: true, total };
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.getListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          showAdvancedSearch={true}
          enableRowSelection={viewTypeState !== 'detailTable'}
          showCreateButton={false}
          createButtonText={t('app.kuaizhizao.salesOrder.create')}
          onCreate={handleCreate}
          toolBarRender={() => salesOrderToolbarRenderItems}
          showDeleteButton={viewTypeState !== 'detailTable'}
          deleteButtonText={t('app.kuaizhizao.salesOrder.batchDelete')}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={t('app.kuaizhizao.salesOrder.confirmDelete')}
          deleteConfirmDescription={(count) => t('app.kuaizhizao.salesOrder.deleteConfirm', { count })}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="sales-order-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedOrdersForBatch}
              auditEnabled={auditEnabled}
              permGates={salesOrderPerms}
              bulkHandlers={salesOrderAuditBulkHandlers}
              resolveIdFromKey={resolveSalesOrderBatchId}
              onSuccess={handleBulkCapabilityBatchSuccess}
              toolBarButtonSize="middle"
            />,
          ]}
          toolBarActionsAfterBatch={[
            <UniCapabilityBatchButton
              key="sales-order-batch-close"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedOrdersForBatch}
              capabilityKey="close"
              permAllowed={salesOrderPerms.canUpdate}
              batchAllowed={(records, perm) => salesOrderBatchCloseAllowed(records, perm)}
              onRunBulk={bulkCloseSalesOrders}
              onSuccess={handleBulkCapabilityBatchSuccess}
              resolveId={(key) => resolveSalesOrderBatchId(key)}
              notAllowedMessage={t('app.kuaizhizao.salesOrder.batchCloseNotAllowed')}
              requireConfirm
              labels={{
                single: t('app.kuaizhizao.salesOrder.batchClose'),
                batch: t('app.kuaizhizao.salesOrder.batchClose'),
                singleConfirmTitle: t('app.kuaizhizao.salesOrder.batchCloseConfirmTitle'),
                batchConfirmTitle: t('app.kuaizhizao.salesOrder.batchCloseConfirmTitle'),
                batchConfirmDescription: (c) =>
                  t('app.kuaizhizao.salesOrder.batchCloseConfirmDescription', { count: c }),
              }}
              icon={<StopOutlined />}
              size="middle"
            />,
            <UniCapabilityBatchButton
              key="sales-order-batch-print"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedOrdersForBatch}
              capabilityKey="print"
              permAllowed={salesOrderPerms.canPrint}
              batchAllowed={(records, perm) =>
                Boolean(perm) && records.some((record) => record.capabilities?.print?.allowed === true)
              }
              singleOnly
              onRun={async (id) => {
                openPrint({ documentType: 'sales_order', documentId: id });
              }}
              resolveId={(key, record) => resolveSalesOrderBatchId(key, record)}
              labels={{
                single: t('components.uniAction.print'),
                batch: t('components.uniAction.print'),
              }}
              icon={<PrinterOutlined />}
              size="middle"
            />,
          ]}
          // 表头固定；scroll.y 由 UniTable 全局常量模板自动计算（统一行为）
          sticky
          showImportButton={true}
          onImport={handleImport}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listSalesOrders({ skip: 0, limit: 10000, include_items: true });
              const orders = (res as any).data || [];
              const flatRows: SalesOrderItemRow[] = [];
              for (const order of orders) {
                const items = order.items ?? [];
                if (items.length === 0) {
                  flatRows.push({
                    _rowKey: `order-${order.id}-empty`,
                    sales_order_id: order.id,
                    order_code: order.order_code,
                    customer_name: order.customer_name,
                    material_code: '-',
                    material_name: '-',
                    required_quantity: 0,
                    delivery_date: order.delivery_date ?? '',
                  } as SalesOrderItemRow);
                } else {
                  items.forEach((item: SalesOrderItem, idx: number) => {
                    flatRows.push({
                      ...item,
                      _rowKey: item.id ? `order-${order.id}-item-${item.id}` : `order-${order.id}-idx-${idx}`,
                      sales_order_id: order.id,
                      order_code: order.order_code,
                      customer_name: order.customer_name,
                    } as SalesOrderItemRow);
                  });
                }
              }
              let toExport = flatRows;
              if (type === 'currentPage' && pageData?.length) {
                toExport = pageData as SalesOrderItemRow[];
              } else if (type === 'selected' && keys?.length) {
                toExport = flatRows.filter((r) => keys.includes(r._rowKey));
              }
              if (toExport.length === 0) {
                messageApi.warning(t('app.kuaizhizao.salesOrder.noDataToExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sales-order-items-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('app.kuaizhizao.salesOrder.exportSuccess', { count: toExport.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.exportFailed'));
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          toolbar={{ actions: [salesOrderHighlightOverdueToolbar] }}
          importHeaders={[
            t('app.kuaizhizao.salesOrder.orderDate'),
            t('app.kuaizhizao.salesOrder.deliveryDate'),
            t('app.kuaizhizao.salesOrder.importHeaderCustomerId'),
            t('app.kuaizhizao.salesOrder.customerName'),
            t('app.kuaizhizao.salesOrder.customerContact'),
            t('app.kuaizhizao.salesOrder.customerPhone'),
            t('app.kuaizhizao.salesOrder.importHeaderSalesmanId'),
            t('app.kuaizhizao.salesOrder.salesman'),
            t('app.kuaizhizao.salesOrder.shippingAddress'),
            t('app.kuaizhizao.salesOrder.shippingMethod'),
            t('app.kuaizhizao.salesOrder.paymentTerms'),
            t('app.kuaizhizao.salesOrder.notes'),
          ]}
          importExampleRow={[
            '2026-01-01',
            '2026-01-31',
            '',
            t('app.kuaizhizao.salesOrder.importExampleCustomer'),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            t('app.kuaizhizao.salesOrder.importExampleNotes'),
          ]}
        />
        </SalesOrderIndicatorsProvider>
      </ListPageTemplate>

      {/* 详情抽屉：DetailDrawerTemplate + 与报价单一致的分区 */}
      {currentSalesOrder ? (
        <SalesOrderDetailProvider
          order={currentSalesOrder}
          auditRequired={auditEnabled}
          trackingRefreshKey={trackingRefreshKey}
          shippingMethodOptions={shippingMethodOptions}
          paymentTermsOptions={paymentTermsOptions}
          feeTypeOptions={feeTypeOptions}
          customFields={salesOrderListCustomFields}
          customFieldValues={salesOrderDetailCustomFieldValues}
        >
          <DetailDrawerTemplate
            title={
              <Space size={4}>
                <span>{t('app.kuaizhizao.salesOrder.detail')}</span>
                {currentSalesOrder.order_code && (
                  <>
                    <span style={{ color: 'var(--ant-color-text-secondary)', fontWeight: 'normal' }}>
                      {currentSalesOrder.order_code}
                    </span>
                    <Tooltip title={t('field.invitationCode.copy')}>
                      <Button
                        type="link"
                        size="small"
                        icon={<CopyOutlined style={{ fontSize: 12 }} />}
                        onClick={() => {
                          navigator.clipboard.writeText(currentSalesOrder.order_code ?? '').then(
                            () => messageApi.success(t('common.copySuccess')),
                            () => messageApi.error(t('common.copyFailed')),
                          );
                        }}
                      />
                    </Tooltip>
                  </>
                )}
              </Space>
            }
            open={drawerVisible}
            onClose={() => {
              setDrawerVisible(false);
              resetSalesOrderDetailFieldValues();
            }}
            width={DRAWER_CONFIG.HALF_WIDTH}
            zIndex={salesOrderDetailDrawerZIndex}
            collaborationTitleSuffix={<SalesOrderDetailCollaborationTitleSuffix />}
            extra={
              <Space size="small">
                <Button icon={<BellOutlined />} onClick={handleOpenReminder}>
                  {t('app.kuaizhizao.salesOrder.reminder')}
                </Button>
                {!detailCapabilityGates.update.disabled && (
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => {
                      setDrawerVisible(false);
                      handleEdit([currentSalesOrder.id!]);
                    }}
                  >
                    {t('app.kuaizhizao.salesOrder.editAction')}
                  </Button>
                )}
                {!detailCapabilityGates.delete.disabled && (
                  <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteSingle(currentSalesOrder.id!)}>
                    {t('app.kuaizhizao.salesOrder.delete')}
                  </Button>
                )}
                {!detailCapabilityGates.createChangeOrder.disabled && (
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => handlePushToSalesOrderChange(currentSalesOrder.id!)}
                  >
                    {pushToSalesOrderChangeAction.label}
                  </Button>
                )}
                <UniWorkflowActions {...rowActionKind('skip')}
                  record={currentSalesOrder}
                  entityName={t('app.kuaizhizao.salesOrder.entityName')}
                  entityType="sales_order"
                  unifiedAudit
                  resourcePrefix="kuaizhizao:sales-order"
                  theme="default"
                  onSuccess={() => {
                    invalidateMenuBadge();
                    invalidateStatistics();
                    refreshDrawerOrder(currentSalesOrder?.id);
                  }}
                  confirmMessages={{
                    submit: isManualAuditEnabled(currentSalesOrder.audit)
                      ? t('app.kuaizhizao.salesOrder.submitConfirmAudit')
                      : t('app.kuaizhizao.salesOrder.submitConfirmAuto'),
                  }}
                />
                {salesOrderHasToolbarPushActions(currentSalesOrder) && (
                  <Dropdown {...rowActionKind('skip')} menu={{ items: buildToolbarPushMenuItems(currentSalesOrder) }}>
                    <Button icon={<ArrowDownOutlined />}>{t('app.kuaizhizao.salesOrder.push')}</Button>
                  </Dropdown>
                )}
                {currentSalesOrder.id != null && !detailCapabilityGates.print.disabled && (
                  <Button
                    icon={<PrinterOutlined />}
                    onClick={() => openPrint({ documentType: 'sales_order', documentId: currentSalesOrder.id! })}
                  >
                    {t('components.uniAction.print')}
                  </Button>
                )}
              </Space>
            }
            basic={<SalesOrderDetailBasicPane />}
            collaboration={
              <SalesOrderDetailCollaborationPane
                drawerVisible={drawerVisible}
                onCloseDrawer={() => setDrawerVisible(false)}
                navigate={navigate}
                auditEnabled={auditEnabled}
              />
            }
            lines={<SalesOrderDetailLinesPane />}
            timeline={<SalesOrderDetailTimelinePane />}
          />
        </SalesOrderDetailProvider>
      ) : null}

      <UniPullQueryModal<PullQuotationCandidate>
        title={pullFromQuotationAction.label}
        open={pullFromQuotationQuery.open}
        zIndex={elevatedModalZIndex}
        onCancel={pullFromQuotationQuery.closeModal}
        onOk={pullFromQuotationQuery.handleConfirm}
        okText={t('app.kuaizhizao.salesOrder.create')}
        rowKey="id"
        columns={pullQuotationColumns}
        dataSource={pullFromQuotationQuery.dataSource}
        loading={pullFromQuotationQuery.loading}
        confirmLoading={pullFromQuotationQuery.confirmLoading}
        selectionType={pullFromQuotationQuery.selectionType}
        selectedRowKeys={pullFromQuotationQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromQuotationQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromQuotationQuery.isRowDisabled}
        searchDraft={pullFromQuotationQuery.searchDraft}
        onSearchDraftChange={pullFromQuotationQuery.setSearchDraft}
        onSearchApply={pullFromQuotationQuery.handleSearchApply}
        onSearchClear={pullFromQuotationQuery.handleSearchClear}
        appliedKeyword={pullFromQuotationQuery.appliedKeyword}
        page={pullFromQuotationQuery.page}
        pageSize={pullFromQuotationQuery.pageSize}
        total={pullFromQuotationQuery.total}
        onPageChange={pullFromQuotationQuery.handlePageChange}
        scopeOptions={pullFromQuotationQuery.scopeOptions}
        scope={pullFromQuotationQuery.scope}
        onScopeChange={pullFromQuotationQuery.handleScopeChange}
        searchPlaceholder={t('app.kuaizhizao.salesOrder.searchQuotationPlaceholder')}
        emptyText={t('app.kuaizhizao.salesOrder.noQuotationAvailable')}
        emptySearchText={t('app.kuaizhizao.salesOrder.quotationNotFound')}
        okButtonProps={{
          disabled:
            pullFromQuotationQuery.selectedRowKeys.length === 0 ||
            selectedPullQuotationNotPullable ||
            pullFromQuotationQuery.loading,
        }}
        alert={
          selectedPullQuotationNotPullable && selectedPullQuotation
            ? (
              <Alert
                type="warning"
                showIcon
                message={
                  selectedPullQuotation.status === '已转订单' || selectedPullQuotation.sales_order_id
                    ? t('app.kuaizhizao.salesOrder.pullDuplicateAlert', {
                        source: pullFromQuotationAction.sourceLabel,
                        target: pullFromQuotationAction.targetLabel,
                      })
                    : quotationCapabilityReasonMessage(
                        selectedPullQuotation.capabilities?.convert_to_order?.reason,
                        t,
                      ) || t('app.kuaizhizao.salesOrder.pullQuotationNotAllowed')
                }
                description={
                  selectedPullQuotation.status === '已转订单' || selectedPullQuotation.sales_order_id
                    ? t('app.kuaizhizao.salesOrder.linkedSalesOrder', {
                        code:
                          selectedPullQuotation.sales_order_code ||
                          selectedPullQuotation.sales_order_id ||
                          '-',
                      })
                    : undefined
                }
              />
            )
            : undefined
        }
      />

      <UniPullQueryModal<PullSalesContractCandidate>
        title={pullFromSalesContractAction.label}
        open={pullFromSalesContractQuery.open}
        zIndex={elevatedModalZIndex}
        onCancel={pullFromSalesContractQuery.closeModal}
        onOk={pullFromSalesContractQuery.handleConfirm}
        okText={t('app.kuaizhizao.salesOrder.create')}
        rowKey="id"
        columns={pullSalesContractColumns}
        dataSource={pullFromSalesContractQuery.dataSource}
        loading={pullFromSalesContractQuery.loading}
        confirmLoading={pullFromSalesContractQuery.confirmLoading}
        selectionType={pullFromSalesContractQuery.selectionType}
        selectedRowKeys={pullFromSalesContractQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromSalesContractQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromSalesContractQuery.isRowDisabled}
        searchDraft={pullFromSalesContractQuery.searchDraft}
        onSearchDraftChange={pullFromSalesContractQuery.setSearchDraft}
        onSearchApply={pullFromSalesContractQuery.handleSearchApply}
        onSearchClear={pullFromSalesContractQuery.handleSearchClear}
        appliedKeyword={pullFromSalesContractQuery.appliedKeyword}
        page={pullFromSalesContractQuery.page}
        pageSize={pullFromSalesContractQuery.pageSize}
        total={pullFromSalesContractQuery.total}
        onPageChange={pullFromSalesContractQuery.handlePageChange}
        scopeOptions={pullFromSalesContractQuery.scopeOptions}
        scope={pullFromSalesContractQuery.scope}
        onScopeChange={pullFromSalesContractQuery.handleScopeChange}
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        emptyText={t('components.uniPullQuery.empty')}
        emptySearchText={t('components.uniPullQuery.emptySearch')}
        okButtonProps={{
          disabled:
            pullFromSalesContractQuery.selectedRowKeys.length === 0 ||
            selectedPullSalesContractNotPullable ||
            pullFromSalesContractQuery.loading,
        }}
        alert={
          selectedPullSalesContractNotPullable && selectedPullSalesContract
            ? (
              <Alert
                type="warning"
                showIcon
                message={
                  selectedPullSalesContract.capabilities?.push_to_sales_order?.reason ||
                  t('app.kuaizhizao.salesOrder.pullContract.notAllowed')
                }
              />
            )
            : undefined
        }
      />

      <SyncFromDatasetModal
        open={syncModalVisible}
        zIndex={elevatedModalZIndex}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title={t('app.kuaizhizao.salesOrder.syncFromDataset')}
      />

      {/* 提醒弹窗 */}
      <Modal
        title={t('app.kuaizhizao.salesOrder.reminderModalTitle')}
        open={reminderModalOpen}
        zIndex={elevatedModalZIndex}
        onCancel={() => setReminderModalOpen(false)}
        onOk={handleReminderSubmit}
        okText={t('app.kuaizhizao.salesOrder.reminderSend')}
        cancelText={t('common.cancel')}
        confirmLoading={reminderSubmitting}
        destroyOnHidden
      >
        <AntForm form={reminderForm} layout="vertical" style={{ marginTop: 16 }}>
          <AntForm.Item
            name="recipient_user_uuid"
            label={t('app.kuaizhizao.salesOrder.reminderRecipient')}
            rules={[{ required: true, message: t('app.kuaizhizao.salesOrder.reminderRecipientRequired') }]}
          >
            <Select
              placeholder={t('app.kuaizhizao.salesOrder.reminderRecipientPlaceholder')}
              showSearch
              optionFilterProp="label"
              loading={usersLoading}
              options={users.map((u) => ({
                value: u.uuid,
                label: u.full_name ? `${u.full_name} (${u.username})` : u.username,
              }))}
            />
          </AntForm.Item>
          <AntForm.Item
            name="action_type"
            label={t('app.kuaizhizao.salesOrder.reminderAction')}
            rules={[{ required: true, message: t('app.kuaizhizao.salesOrder.reminderActionRequired') }]}
          >
            <Select
              placeholder={t('app.kuaizhizao.salesOrder.reminderActionPlaceholder')}
              options={[
                { value: 'review', label: t('app.kuaizhizao.salesOrder.reminderActionReview') },
                { value: 'delivery', label: t('app.kuaizhizao.salesOrder.reminderActionDelivery') },
                { value: 'invoice', label: t('app.kuaizhizao.salesOrder.reminderActionInvoice') },
                { value: 'follow_up', label: t('app.kuaizhizao.salesOrder.reminderActionFollowUp') },
                { value: 'other', label: t('app.kuaizhizao.salesOrder.reminderActionOther') },
              ]}
            />
          </AntForm.Item>
          <AntForm.Item name="remarks" label={t('app.kuaizhizao.salesOrder.notes')}>
            <Input.TextArea rows={3} placeholder={t('app.kuaizhizao.salesOrder.remarksPlaceholder')} maxLength={500} showCount />
          </AntForm.Item>
        </AntForm>
      </Modal>

      <Modal
        title={pushToSalesReturnAction.label}
        open={pushToReturnVisible}
        zIndex={elevatedModalZIndex}
        onCancel={() => {
          setPushToReturnVisible(false);
          setPushToReturnOrder(null);
          setPushToReturnQuantities({});
          setPushToReturnWarehouseId(undefined);
          setPushToReturnWarehouseName('');
        }}
        onOk={handlePushToSalesReturnConfirm}
        confirmLoading={pushToReturnLoading}
        okText={t('app.kuaizhizao.salesOrder.confirmPush')}
        width={720}
        destroyOnHidden
      >
        {pushToReturnOrder && (
          <>
            <p style={{ marginBottom: 12 }}>
              {t('app.kuaizhizao.salesOrder.pushReturnDescription', { orderCode: pushToReturnOrder.order_code })}
            </p>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={8}>
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  value={pushToReturnWarehouseId}
                  onChange={(v) => setPushToReturnWarehouseId(Number(v) || undefined)}
                  placeholder={t('app.kuaizhizao.salesOrder.returnWarehouseIdPlaceholder')}
                />
              </Col>
              <Col span={16}>
                <Input
                  value={pushToReturnWarehouseName}
                  onChange={(e) => setPushToReturnWarehouseName(e.target.value)}
                  placeholder={t('app.kuaizhizao.salesOrder.returnWarehouseNamePlaceholder')}
                />
              </Col>
            </Row>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={(pushToReturnOrder.items || []).filter((it) => Number(it.delivered_quantity || 0) > 0)}
              columns={[
                { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
                { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 150 },
                { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'required_quantity', width: 100, align: 'right' },
                { title: t('app.kuaizhizao.salesOrder.deliveredQty'), dataIndex: 'delivered_quantity', width: 100, align: 'right' },
                {
                  title: t('app.kuaizhizao.salesOrder.returnQty'),
                  width: 120,
                  align: 'right',
                  render: (_: any, record: SalesOrderItem) => record.id != null ? (
                    <InputNumber
                      min={0}
                      max={Number(record.delivered_quantity || 0)}
                      value={pushToReturnQuantities[record.id] ?? 0}
                      onChange={(v) => setPushToReturnQuantities((prev) => ({ ...prev, [record.id!]: Number(v) || 0 }))}
                      style={{ width: 100 }}
                    />
                  ) : null,
                },
              ]}
            />
          </>
        )}
      </Modal>

      {/* 下推预览弹窗 */}
      <Modal
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pushPreviewOpen}
        zIndex={elevatedModalZIndex}
        onCancel={() => {
          setPushPreviewOpen(false);
          setPushPreviewData(null);
          setPushPreviewAction(null);
          setWorkOrderSelectedItemIds([]);
          setWorkOrderPushQuantities({});
          setWorkOrderSelectedWorkCenters({});
          setWorkOrderPushMode('draft');
          setWorkOrderGranularity('grouped');
        }}
        okText={t('app.kuaizhizao.salesOrder.confirmPush')}
        cancelText={t('common.cancel')}
        width={1200}
        confirmLoading={pushPreviewConfirming}
        onOk={handlePushPreviewConfirm}
        okButtonProps={{ disabled: pushPreviewLoading || !pushPreviewData }}
      >
        {pushPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pushPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushPreviewData.summary}</p>
            {pushPreviewData.target_type === 'work_order' && (
              <div style={{ marginBottom: 10 }}>
                <Space>
                  <span>{t('app.kuaizhizao.salesOrder.pushModeLabel')}</span>
                  <Segmented
                    size="middle"
                    value={workOrderPushMode}
                    onChange={(val) => setWorkOrderPushMode(val as 'draft' | 'confirm')}
                    options={[
                      { label: t('app.kuaizhizao.salesOrder.pushModeDraft'), value: 'draft' },
                      { label: t('app.kuaizhizao.salesOrder.pushModeConfirm'), value: 'confirm' },
                    ]}
                  />
                  <span>{t('app.kuaizhizao.salesOrder.workOrderTypeLabel')}</span>
                  <Segmented
                    size="middle"
                    value={workOrderGranularity}
                    onChange={(val) => setWorkOrderGranularity(val as 'grouped' | 'per_unit')}
                    options={[
                      { label: t('app.kuaizhizao.salesOrder.workOrderTypeGrouped'), value: 'grouped' },
                      { label: t('app.kuaizhizao.salesOrder.workOrderTypePerUnit'), value: 'per_unit' },
                    ]}
                  />
                </Space>
              </div>
            )}
            {pushPreviewData.plan_name_preview && (
              <p style={{ marginBottom: 8, color: 'var(--ant-color-text-secondary)' }}>
                {t('app.kuaizhizao.salesOrder.planName')}：{pushPreviewData.plan_name_preview}
              </p>
            )}
            {pushPreviewData.target_type === 'work_order' && pushPreviewData.has_blocking_issues ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 8 }}
                message={t('app.kuaizhizao.salesOrder.masterDataMissingAlert')}
              />
            ) : null}
            {pushPreviewData.target_type === 'work_order' && pushPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPreviewData.items}
                columns={[
                  {
                    title: t('common.select'),
                    dataIndex: 'item_id',
                    key: 'select',
                    width: 64,
                    render: (_: unknown, row: any) => {
                      const itemId = Number(row?.item_id);
                      if (!Number.isFinite(itemId) || itemId <= 0) return null;
                      const maxQty = Number(row?.max_push_quantity ?? row?.quantity ?? 0);
                      const disabled = !Number.isFinite(maxQty) || maxQty <= 0;
                      return (
                        <Switch
                          size="small"
                          disabled={disabled}
                          checked={workOrderSelectedItemIds.includes(itemId)}
                          onChange={(checked) => {
                            setWorkOrderSelectedItemIds((prev) =>
                              checked ? Array.from(new Set([...prev, itemId])) : prev.filter((id) => id !== itemId),
                            );
                          }}
                        />
                      );
                    },
                  },
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', key: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', key: 'material_name', width: 140, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', key: 'quantity', width: 90, align: 'right' as const },
                  { title: t('app.kuaizhizao.salesOrder.colPushedQty'), dataIndex: 'pushed_quantity', key: 'pushed_quantity', width: 90, align: 'right' as const },
                  { title: t('app.kuaizhizao.salesOrder.colPushableQty'), dataIndex: 'max_push_quantity', key: 'max_push_quantity', width: 90, align: 'right' as const },
                  {
                    title: t('app.kuaizhizao.salesOrder.productionLine'),
                    dataIndex: 'work_center_id',
                    key: 'work_center_id',
                    width: 170,
                    render: (_: unknown, row: any) => {
                      const itemId = Number(row?.item_id);
                      if (!Number.isFinite(itemId) || itemId <= 0) return null;
                      return (
                        <Select
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          placeholder={t('app.kuaizhizao.salesOrder.selectProductionLine')}
                          style={{ width: '100%' }}
                          value={workOrderSelectedWorkCenters[itemId]}
                          options={workCenterOptions}
                          loading={workCenterOptionsLoading}
                          onChange={(val) => {
                            setWorkOrderSelectedWorkCenters((prev) => {
                              const next = { ...prev };
                              const n = Number(val ?? 0);
                              if (Number.isFinite(n) && n > 0) {
                                next[itemId] = n;
                              } else {
                                delete next[itemId];
                              }
                              return next;
                            });
                          }}
                        />
                      );
                    },
                  },
                  {
                    title: t('app.kuaizhizao.salesOrder.colPushQty'),
                    dataIndex: 'push_quantity',
                    key: 'push_quantity',
                    width: 130,
                    render: (_: unknown, row: any) => {
                      const itemId = Number(row?.item_id);
                      const maxQty = Number(row?.max_push_quantity ?? row?.quantity ?? 0);
                      return (
                        <InputNumber
                          min={0}
                          max={Number.isFinite(maxQty) && maxQty > 0 ? maxQty : undefined}
                          precision={2}
                          style={{ width: '100%' }}
                          value={workOrderPushQuantities[itemId]}
                          onChange={(val) => {
                            const next = Number(val ?? 0);
                            setWorkOrderPushQuantities((prev) => ({ ...prev, [itemId]: next }));
                          }}
                        />
                      );
                    },
                  },
                  {
                    title: t('app.kuaizhizao.salesOrder.colMissingItems'),
                    dataIndex: 'blocking_issues',
                    key: 'blocking_issues',
                    width: 220,
                    render: (_: unknown, row: any) => {
                      const issues = Array.isArray(row?.blocking_issues) ? row.blocking_issues : [];
                      if (!issues.length) return <span style={{ color: 'var(--ant-color-success)' }}>-</span>;
                      return (
                        <Tooltip title={issues.join('\n')}>
                          <span style={{ color: 'var(--ant-color-warning)' }}>
                            {issues[0]}
                            {issues.length > 1 ? t('app.kuaizhizao.salesOrder.andMoreItems', { count: issues.length }) : ''}
                          </span>
                        </Tooltip>
                      );
                    },
                  },
                  { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', key: 'delivery_date', width: 110 },
                ]}
                rowKey={(r: any, i) => `${r.item_id || r.material_code}-${i}`}
                pagination={false}
                style={{ marginBottom: 8 }}
              />
            ) : pushPreviewData.target_type === 'shipment_notice' && pushPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPreviewData.items}
                columns={[
                  {
                    title: t('common.select'),
                    dataIndex: 'item_id',
                    key: 'select',
                    width: 64,
                    render: (_: unknown, row: any) => {
                      const itemId = Number(row?.item_id);
                      if (!Number.isFinite(itemId) || itemId <= 0) return null;
                      const maxQty = Number(row?.max_push_quantity ?? row?.quantity ?? 0);
                      const disabled = !Number.isFinite(maxQty) || maxQty <= 0;
                      return (
                        <Switch
                          size="small"
                          disabled={disabled}
                          checked={workOrderSelectedItemIds.includes(itemId)}
                          onChange={(checked) => {
                            setWorkOrderSelectedItemIds((prev) =>
                              checked ? Array.from(new Set([...prev, itemId])) : prev.filter((id) => id !== itemId),
                            );
                          }}
                        />
                      );
                    },
                  },
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', key: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', key: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', key: 'quantity', width: 90, align: 'right' as const },
                  { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'delivered_quantity', key: 'delivered_quantity', width: 90, align: 'right' as const },
                  { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', key: 'max_push_quantity', width: 90, align: 'right' as const },
                  {
                    title: t('app.kuaizhizao.salesOrder.colShipQty'),
                    dataIndex: 'push_quantity',
                    key: 'push_quantity',
                    width: 130,
                    render: (_: unknown, row: any) => {
                      const itemId = Number(row?.item_id);
                      const maxQty = Number(row?.max_push_quantity ?? row?.quantity ?? 0);
                      return (
                        <InputNumber
                          min={0}
                          max={Number.isFinite(maxQty) && maxQty > 0 ? maxQty : undefined}
                          precision={2}
                          style={{ width: '100%' }}
                          value={workOrderPushQuantities[itemId]}
                          onChange={(val) => {
                            const next = Number(val ?? 0);
                            setWorkOrderPushQuantities((prev) => ({ ...prev, [itemId]: next }));
                          }}
                        />
                      );
                    },
                  },
                  { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', key: 'delivery_date', width: 110 },
                ]}
                rowKey={(r: any, i) => `${r.item_id || r.material_code}-${i}`}
                pagination={false}
                style={{ marginBottom: 8 }}
              />
            ) : pushPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPreviewData.items}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', key: 'material_code', width: 120, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', key: 'material_name', width: 140, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', key: 'quantity', width: 80, align: 'right' as const },
                  { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', key: 'delivery_date', width: 100 },
                  ...(pushPreviewData.items[0]?.suggested_action
                    ? [{ title: t('app.kuaizhizao.salesOrder.suggestion'), dataIndex: 'suggested_action', key: 'suggested_action', width: 70 }]
                    : []),
                ]}
                rowKey={(r: any, i) => `${r.material_code}-${i}`}
                pagination={false}
                style={{ marginBottom: 8 }}
              />
            ) : null}
            {pushPreviewData.tip && (
              <p style={{ marginTop: 8, color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
                {pushPreviewData.tip}
              </p>
            )}
          </div>
        ) : null}
      </Modal>

      <CustomerFollowUpFormModal
        open={followUpModalOpen}
        zIndex={elevatedModalZIndex}
        editing={null}
        preset={followUpPreset}
        onClose={() => {
          setFollowUpModalOpen(false);
          setFollowUpPreset(null);
        }}
      />
      {PrintModal}
    </>
  );
};

export default SalesOrdersPage;
