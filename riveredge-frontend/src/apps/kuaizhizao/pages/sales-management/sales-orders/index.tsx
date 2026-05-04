/**
 * 销售订单管理页面
 *
 * 提供销售订单的独立管理功能，支持MTO模式。
 * 销售订单可以下推到需求管理（需求计算）。
 *
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormUploadButton } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Table, Input, InputNumber, Row, Col, Form as AntForm, DatePicker, Spin, Switch, Progress, Tooltip, Dropdown, Select, Tag, theme as AntdTheme } from 'antd';
import { EyeOutlined, EditOutlined, ArrowDownOutlined, PlusOutlined, DeleteOutlined, RollbackOutlined, ImportOutlined, FileTextOutlined, SendOutlined, CopyOutlined, BellOutlined, AppstoreAddOutlined, CommentOutlined, ReloadOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import { UniImport } from '../../../../../components/uni-import';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import FeeDetailsTable from '../../../../../components/FeeDetailsTable';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import { MaterialInventoryIndicator } from '../../../components/MaterialInventoryIndicator';
import { MaterialBomIndicator } from '../../../components/MaterialBomIndicator';
import { SalesOrderIndicatorsProvider } from '../../../components/SalesOrderIndicatorsProvider';
import {
  SalesOrderDetailProvider,
  SalesOrderDetailBasicPane,
  SalesOrderDetailCollaborationPane,
  SalesOrderDetailLinesPane,
  SalesOrderDetailTimelinePane,
  SalesOrderDetailCollaborationTitleSuffix,
} from './components/SalesOrderDetailBody';
import { AgileQuotingDrawer } from './components/AgileQuotingDrawer';
import { CalculatorOutlined } from '@ant-design/icons';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import type { SubStage } from '../../../../../components/uni-lifecycle/types';
import { getSalesOrderLifecycle, isSalesOrderDeliveryOverdue, isSalesOrderLineDeliveryOverdue } from '../../../utils/salesOrderLifecycle';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { strokeColorWithAlpha } from '../../../../../components/common/StatCardTrendArea';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET,
  MODAL_NESTED_ABOVE_PARENT_OFFSET,
  type StatCard,
} from '../../../../../components/layout-templates';
import { AmountDisplay } from '../../../../../components/permission';
import { Area } from '@ant-design/charts';
import {
  listSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  submitSalesOrder,
  approveSalesOrder,
  unapproveSalesOrder,
  previewPushSalesOrderToComputation,
  previewPushSalesOrderToWorkOrder,
  pushSalesOrderToComputation,
  pushSalesOrderToWorkOrder,
  pushSalesOrderToShipmentNotice,
  pushSalesOrderToInvoice,
  pushSalesOrderToSalesReturn,
  withdrawSalesOrderFromComputation,
  createSalesOrderReminder,
  bulkDeleteSalesOrders,
  bulkSubmitSalesOrders,
  bulkApproveSalesOrders,
  bulkWithdrawSalesOrders,
  bulkUnapproveSalesOrders,
  deleteSalesOrder,
  getSalesOrderStatistics,
  SalesOrder,
  SalesOrderItem,
  SalesOrderStatus,
  ReviewStatus,
  type PushPreviewResponse,
} from '../../../services/sales-order';

/** 已审核状态值集合（与后端 document_lifecycle _is_approved 一致，用于按钮显示） */
const APPROVED_STATUS_VALUES = ['已审核', SalesOrderStatus.AUDITED, ReviewStatus.APPROVED, '审核通过', '通过', '已通过'] as const;
const isApprovedRecord = (r: SalesOrder) => APPROVED_STATUS_VALUES.some((v) => r.status === v || r.review_status === v);
import { materialApi } from '../../../../master-data/services/material';
import type { Material } from '../../../../master-data/types/material';
import { customerApi } from '../../../../master-data/services/supply-chain';
import type { Customer } from '../../../../master-data/types/supply-chain';
import dayjs from 'dayjs';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { getFileDownloadUrl, uploadMultipleFiles } from '../../../../../services/file';
/** 用户列表：对接系统管理-用户管理-帐户管理（/core/users） */
import { getUserList, type User } from '../../../../../services/user';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferAfterPaint } from '../../../../../hooks/useDeferAfterPaint';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { renderRowActionsOverflow } from '../../../../../components/uni-action';
import { CustomerFollowUpFormModal, type CustomerFollowUpPreset } from '../../../components/CustomerFollowUpFormModal';
import {
  DocumentTrackingRelationsTabsBody,
  TraceLinkedDocumentBrief,
} from '../../../../../components/document-tracking-panel';

/** 销售订单详情抽屉外左侧「关联全链路」浮层布局（zIndex 见页面内 theme.zIndexPopupBase + 1） */
const SALES_ORDER_FULL_CHAIN_FLOAT_MARGIN = 16;
const SALES_ORDER_LEFT_CHAIN_GAP = 16;
const SALES_ORDER_CHAIN_DRAWER_GAP = 16;
const SALES_ORDER_CHAIN_VERTICAL_TRIM =
  SALES_ORDER_FULL_CHAIN_FLOAT_MARGIN * 2 + SALES_ORDER_LEFT_CHAIN_GAP;
const salesOrderChainHalfHeightCss = `calc((100vh - ${SALES_ORDER_CHAIN_VERTICAL_TRIM}px) / 2)`;
const salesOrderChainPanelWidthCss = `calc(50vw - ${SALES_ORDER_FULL_CHAIN_FLOAT_MARGIN * 2 + SALES_ORDER_CHAIN_DRAWER_GAP}px)`;
const salesOrderBriefPanelTopCss = `calc(${SALES_ORDER_FULL_CHAIN_FLOAT_MARGIN}px + (100vh - ${SALES_ORDER_CHAIN_VERTICAL_TRIM}px) / 2 + ${SALES_ORDER_LEFT_CHAIN_GAP}px)`;

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
  status?: string;
  review_status?: string;
  pushed_to_computation?: boolean;
  lifecycle?: Record<string, unknown>;
  /** 生命周期阶段名，用于卡片分组 */
  _lifecycleStage?: string;
  items?: { work_order_id?: number | null }[];
};

/** 明细行是否已挂工单（直推工单路径与需求计算路径互斥） */
function orderHasLineWorkOrders(order: SalesOrder | null | undefined): boolean {
  return !!(order?.items?.some((it) => it?.work_order_id != null && Number(it.work_order_id) > 0));
}

function canOpenDemandComputationPush(order: SalesOrder | null | undefined, nodeEnabled: boolean): boolean {
  if (!nodeEnabled) return false;
  if (order?.pushed_to_computation) return false;
  if (orderHasLineWorkOrders(order)) return false;
  return true;
}

function canOpenDirectWorkOrderPush(order: SalesOrder | null | undefined, nodeEnabled: boolean): boolean {
  if (!nodeEnabled) return false;
  if (order?.pushed_to_computation) return false;
  return true;
}

function formatMoneyYuan(n: number): string {
  return `¥${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  const priceType = priceTypeInput ?? 'tax_exclusive';

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

/** 与销售明细表格中价税逻辑一致，用于表单内实时汇总 */
function computeSalesOrderFormTotals(
  items: any[] | undefined,
  feeDetails: any[] | undefined,
  priceType: string | undefined,
) {
  const pt = priceType ?? 'tax_exclusive';
  const rows = Array.isArray(items) ? items : [];
  let goodsExclCents = 0;
  let taxAmountCents = 0;
  let goodsInclCents = 0;

  for (const row of rows) {
    const line = calcSalesLineAmounts(row?.required_quantity, row?.unit_price, row?.tax_rate, pt);
    goodsExclCents += toCents(line.excl);
    taxAmountCents += toCents(line.tax);
    goodsInclCents += toCents(line.incl);
  }

  let customerFeesCents = 0; // other_side
  let ourFeesCents = 0;      // our_side
  for (const fee of feeDetails || []) {
    const feeCents = toCents(fee?.amount);
    if (fee?.bearer === 'other_side') customerFeesCents += feeCents;
    else ourFeesCents += feeCents;
  }

  // 预计应收 = 含税货值 + 我方垫付 (假设我方垫付的费用最终由客户结算)
  // 如果业务逻辑是我方承担则不计入应收，则此处需调整。参考采购订单逻辑：应付 = 货值 + 对方(供应商)费用
  // 对应到销售：应收 = 货值 + 我方(销售方)垫付费用
  const estimatedReceivableCents = goodsInclCents + ourFeesCents;
  const estimatedNetIncomeCents = goodsInclCents; // 纯货值部分（含税）

  return {
    goodsExcl: fromCents(goodsExclCents),
    taxAmount: fromCents(taxAmountCents),
    goodsIncl: fromCents(goodsInclCents),
    customerFees: fromCents(customerFeesCents),
    ourFees: fromCents(ourFeesCents),
    estimatedReceivable: fromCents(estimatedReceivableCents),
    estimatedNetIncome: fromCents(estimatedNetIncomeCents),
  };
}

/** 费用明细下方：货值 / 税额 / 含税货值 / 客户直付 / 我方垫付 / 预计应收 */
const SalesOrderFeeTotalsSummary: React.FC<{
  getFieldValue: (name: string) => any;
}> = ({ getFieldValue }) => {
  const { token } = AntdTheme.useToken();
  const sums = computeSalesOrderFormTotals(
    getFieldValue('items'),
    getFieldValue('fee_details'),
    getFieldValue('price_type'),
  );

  const cells: { label: string; hint?: string; value: number; tone?: 'neutral' | 'our' | 'other' }[] = [
    { label: '货值', hint: '不含税货款合计', value: sums.goodsExcl, tone: 'neutral' },
    { label: '税额', value: sums.taxAmount, tone: 'neutral' },
    { label: '含税货值', value: sums.goodsIncl, tone: 'neutral' },
    { label: '客户直付', hint: '客户直接支付给第三方的费用', value: sums.customerFees, tone: 'other' },
    { label: '我方垫付', hint: '我方支付并需与客户结算的费用', value: sums.ourFees, tone: 'our' },
    { label: '预计应收', hint: '含税货值 + 我方垫付', value: sums.estimatedReceivable, tone: 'our' },
  ];

  return (
    <div
      style={{
        marginBottom: 24,
        padding: '12px 16px',
        background: token.colorFillAlter,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div style={{ color: token.colorTextSecondary, fontSize: 12, display: 'block', marginBottom: 10 }}>
        金额汇总
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, alignItems: 'stretch', minWidth: 'max-content' }}>
        {cells.map((c) => (
          <div
            key={c.label}
            style={{
              minWidth: 104,
              flex: '0 0 auto',
              padding: '6px 8px',
              background:
                c.tone === 'our'
                  ? token.colorSuccessBg
                  : c.tone === 'other'
                    ? token.colorWarningBg
                    : token.colorBgContainer,
              borderRadius: token.borderRadius,
              border:
                c.tone === 'our'
                  ? `1px solid ${token.colorSuccessBorder}`
                  : c.tone === 'other'
                    ? `1px solid ${token.colorWarningBorder}`
                    : `1px solid ${token.colorBorderSecondary}`,
            }}
            title={c.hint}
          >
            <div style={{ color: token.colorTextSecondary, fontSize: 12, display: 'block', lineHeight: 1.3 }}>
              {c.label}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginTop: 3,
                color:
                  c.tone === 'our'
                    ? token.colorSuccessText
                    : c.tone === 'other'
                      ? token.colorWarningText
                      : token.colorText,
              }}
            >
              {formatMoneyYuan(c.value)}
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
};

const SalesOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  /** 表格搜索表单 ref，用于 statCard 点击时设置筛选并刷新 */
  const tableSearchFormRef = useRef<any>(null);
  const rowKeyToOrderIdRef = useRef<Map<string, number>>(new Map());
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  /** 视图切换缓存：始终请求 include_items=true，切换视图时从缓存转换，避免重复请求 */
  const lastOrdersCacheRef = useRef<{ orders: SalesOrder[]; total: number; paramsKey: string } | null>(null);
  const invalidateOrdersCache = () => { lastOrdersCacheRef.current = null; };
  /** 刷新左侧菜单销售订单数量徽章 */
  const invalidateMenuBadge = useInvalidateMenuBadgeCounts();
  /** 刷新销售订单统计（指标卡片） */
  const invalidateStatistics = () => {
    queryClient.invalidateQueries({ queryKey: ['salesOrderStatistics'] });
  };

  const secondaryStatsReady = useDeferAfterPaint();
  const { data: statistics } = useQuery({
    queryKey: ['salesOrderStatistics', location.pathname],
    queryFn: getSalesOrderStatistics,
    /** 与页面指标错开：先让列表请求发起，再拉聚合统计（趋势图等） */
    enabled: secondaryStatsReady,
  });

  const { token } = AntdTheme.useToken();
  const salesOrderDetailDrawerZIndex = token.zIndexPopupBase;
  const salesOrderChainOverlayZIndex = token.zIndexPopupBase + 1;
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

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  /** 价税合计正在编辑的行：{ index, value }，失焦时反算单价 */
  const [editingIncl, setEditingIncl] = useState<{ index: number; value: number | null } | null>(null);
  const editingInclValueRef = useRef<number | null>(null);
  const lastPriceTypeRef = useRef<'tax_exclusive' | 'tax_inclusive'>('tax_exclusive');

  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSalesOrder, setCurrentSalesOrder] = useState<SalesOrder | null>(null);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);
  /** 抽屉外左侧关联全链路浮层（与报价单详情交互一致） */
  const [fullChainRefreshKey, setFullChainRefreshKey] = useState(0);
  const [fullChainTraceLoading, setFullChainTraceLoading] = useState(false);
  const [fullChainBriefDoc, setFullChainBriefDoc] = useState<{ document_type: string; document_id: number } | null>(
    null,
  );

  // 提醒弹窗状态
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [reminderForm] = AntForm.useForm();

  // 物料列表（用于物料选择器）
  const [materials, setMaterials] = useState<Material[]>([]);
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
  const [customerCreateVisible, setCustomerCreateVisible] = useState(false);
  /** 与客户跟进列表一致：交货逾期行浅色警示背景 */
  const [highlightDeliveryOverdue, setHighlightDeliveryOverdue] = useState(true);
  /** 发货方式字典选项（数据字典 SHIPPING_METHOD） */
  const [shippingMethodOptions, setShippingMethodOptions] = useState<Array<{ label: string; value: string }>>([]);

  // 敏捷核价相关状态
  const [quoteDrawerVisible, setQuoteDrawerVisible] = useState(false);
  const [quoteMaterialId, setQuoteMaterialId] = useState<number | undefined>(undefined);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  /** 付款条件字典选项（数据字典 PAYMENT_TERMS） */
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<Array<{ label: string; value: string }>>([]);

  /**
   * 加载物料列表（无基础资料时使用空数组，不阻塞页面）
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
  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        setUsersLoading(true);
        const result = await getUserList({ page: 1, page_size: 100, is_active: true });
        setUsers(result.items || []);
      } catch {
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    };
    loadUsers();
  }, []);

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
        console.warn('发货方式字典未配置或加载失败:', e?.message || e);
        setShippingMethodOptions([]);
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
        console.warn('付款条件字典未配置或加载失败:', e?.message || e);
        setPaymentTermsOptions([]);
      }
    };
    loadShippingMethod();
    loadPaymentTerms();
  }, []);

  /**
   * 新建弹窗打开后，等表单挂载完成再设置订单日期默认当天；交货日期由用户自行输入
   */
  useEffect(() => {
    if (modalVisible && !isEdit) {
      const timer = setTimeout(() => {
        formRef.current?.setFieldsValue({ order_date: dayjs() });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [modalVisible, isEdit]);

  /**
   * 处理新建销售订单
   * 若启用编号规则，用 testGenerateCode 预填订单编号（不占用序号）
   */
  const defaultOrderItem = { material_id: undefined, material_code: '', material_name: '', material_spec: '', material_unit: '', required_quantity: 1, delivery_date: dayjs(), unit_price: 0, tax_rate: 0, variant_attributes: '' };

  const handleCreate = async () => {
    if (!salesNodeEnabled.sales_order) {
      messageApi.warning('销售订单节点未启用，无法新建');
      return;
    }
    setIsEdit(false);
    setCurrentId(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    setTimeout(() => {
      formRef.current?.setFieldsValue({ price_type: 'tax_exclusive', items: [defaultOrderItem] });
      lastPriceTypeRef.current = 'tax_exclusive';
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
        const codeResponse = await testGenerateCode({ rule_code: ruleCode });
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
  };

  /**
   * 处理编辑销售订单
   */
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setIsEdit(true);
      setCurrentId(id);
      setModalVisible(true);
      try {
        const data = await getSalesOrder(id, true);  // includeItems=true
        // 明细中若缺少 material_id，用物料列表按编号/名称匹配后填入，再一起写入表单
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
              if (va == null) return '';
              return typeof va === 'string' ? va : JSON.stringify(va, null, 2);
            })(),
          };
          return base;
        });
        const customerId = data.customer_id ?? customers.find(c => c.name === data.customer_name)?.id;
        const salesmanId = data.salesman_id;
        const salesmanName = data.salesman_name;

        // 转换主表单的日期字段为 dayjs 对象
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

        formRef.current?.setFieldsValue(formData);
        lastPriceTypeRef.current = ((formData as any)?.price_type === 'tax_inclusive' ? 'tax_inclusive' : 'tax_exclusive');
      } catch (error: any) {
        messageApi.error(t('app.kuaizhizao.salesOrder.detailFailed'));
        console.error('编辑销售订单错误:', error);
      }
    }
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
      } catch (error: any) {
        messageApi.error(t('app.kuaizhizao.salesOrder.detailFailed'));
      }
    }
  };

  const handlePriceTypeToggle = (checked: boolean) => {
    const nextType: 'tax_exclusive' | 'tax_inclusive' = checked ? 'tax_inclusive' : 'tax_exclusive';
    const currentTypeRaw = formRef.current?.getFieldValue?.('price_type') ?? lastPriceTypeRef.current;
    const currentType: 'tax_exclusive' | 'tax_inclusive' =
      currentTypeRaw === 'tax_inclusive' ? 'tax_inclusive' : 'tax_exclusive';
    if (currentType === nextType) {
      lastPriceTypeRef.current = nextType;
      return;
    }

    const items = formRef.current?.getFieldValue?.('items') ?? [];
    if (Array.isArray(items) && items.length > 0) {
      const convertedItems = items.map((row: any) => ({
        ...row,
        unit_price: convertUnitPriceByPriceType(
          row?.unit_price,
          row?.tax_rate,
          currentType,
          nextType,
        ),
      }));
      formRef.current?.setFieldsValue({ items: convertedItems, price_type: nextType });
    } else {
      formRef.current?.setFieldsValue({ price_type: nextType });
    }
    setEditingIncl(null);
    editingInclValueRef.current = null;
    lastPriceTypeRef.current = nextType;
  };

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
   * 处理删除销售订单（批量）
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.selectToDelete'));
      return;
    }
    const orderIds = [...new Set(keys.map((k) => rowKeyToOrderIdRef.current.get(String(k))).filter((id): id is number => id != null))];
    const count = orderIds.length;

    modalApi.confirm({
      title: t('app.kuaizhizao.salesOrder.confirmDelete'),
      content: t('app.kuaizhizao.salesOrder.deleteConfirm', { count }),
      okText: t('app.kuaizhizao.salesOrder.okDelete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      zIndex: elevatedModalZIndex,
      onOk: async () => {
        try {
          const ids = orderIds;
          const res = await bulkDeleteSalesOrders(ids);

          if (res.failed_count === 0) {
            messageApi.success(t('app.kuaizhizao.salesOrder.deleteSuccess', { count: res.success_count }));
          } else {
            messageApi.warning(t('app.kuaizhizao.salesOrder.deletePartial', { success: res.success_count, failed: res.failed_count }));
            if (res.failed_items && res.failed_items.length > 0) {
              const errorMsg = res.failed_items.map(item => `订单ID ${item.id}: ${item.reason}`).join('\n');
              console.error('删除失败详情:', errorMsg);
              // 可以选择显示更详细的错误弹窗
            }
          }
          invalidateOrdersCache();
          invalidateMenuBadge();
          invalidateStatistics();

          actionRef.current?.reload();
          // 清除选中项
          if (actionRef.current?.clearSelected) {
            actionRef.current.clearSelected();
          }
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.salesOrder.deleteFailed'));
        }
      },
    });
  };

  /**
   * 通用批量操作处理器
   */
  const handleBatchOperation = async (
    keys: React.Key[],
    actionName: string,
    operationApi: (ids: number[]) => Promise<any>,
  ) => {
    const orderIds = [...new Set(keys.map((k) => rowKeyToOrderIdRef.current.get(String(k))).filter((id): id is number => id != null))];
    const count = orderIds.length;
    console.log(`[BatchAction] ${actionName} keys:`, keys, 'orderIds:', orderIds);
    if (count === 0) {
      messageApi.warning(t('common.noRecordsSelected', '未找到对应的单据ID'));
      return;
    }

    try {
      const res = await operationApi(orderIds);
      if (res.failed_count === 0) {
        messageApi.success(`${actionName}${t('common.success', '成功')}: ${res.success_count}${t('common.records', '条')}`);
      } else {
        messageApi.warning(`${actionName}${t('common.partialSuccess', '部分成功')}: ${res.success_count}${t('common.success', '成功')}, ${res.failed_count}${t('common.failed', '失败')}`);
        // 打印具体失败原因，供排查
        if (res.failed_items?.length > 0) {
          console.error(`${actionName}失败详情:`, res.failed_items);
        }
      }
      invalidateOrdersCache();
      invalidateMenuBadge();
      invalidateStatistics();

          actionRef.current?.reload();
      if (actionRef.current?.clearSelected) actionRef.current.clearSelected();
      // ⚠️ 关键：受控模式下手动清空选中状态，确保下拉按钮状态刷新
      setSelectedRowKeys([]);
    } catch (error: any) {
      messageApi.error(error.message || `${actionName}${t('common.failed', '失败')}`);
    }
  };

  const handleBatchSubmit = (keys: React.Key[]) => handleBatchOperation(keys, t('app.kuaizhizao.salesOrder.batchSubmit', '批量提交'), bulkSubmitSalesOrders);
  const handleBatchApprove = (keys: React.Key[]) => handleBatchOperation(keys, t('app.kuaizhizao.salesOrder.batchApprove', '批量审核'), bulkApproveSalesOrders);
  const handleBatchWithdraw = (keys: React.Key[]) => handleBatchOperation(keys, t('app.kuaizhizao.salesOrder.batchWithdraw', '批量撤回'), bulkWithdrawSalesOrders);
  const handleBatchUnapprove = (keys: React.Key[]) => handleBatchOperation(keys, t('app.kuaizhizao.salesOrder.batchUnapprove', '批量反审核'), bulkUnapproveSalesOrders);

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
          messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.salesOrder.deleteFailed'));
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
      const items = values.items ?? [];
      if (!items.length) {
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
      values.price_type = values.price_type || 'tax_exclusive';
      const feeDetails = values.fee_details ?? [];
      const sums = computeSalesOrderFormTotals(items, feeDetails, values.price_type);
      values.total_amount = sums.estimatedReceivable;
      values.total_fee_amount = sums.ourFees + sums.customerFees;

      // 格式化主表日期字段，避免后端报错
      if (values.order_date) {
        values.order_date = dayjs(values.order_date).format('YYYY-MM-DD');
      }
      if (values.delivery_date) {
        values.delivery_date = dayjs(values.delivery_date).format('YYYY-MM-DD');
      }

      const mainDeliveryStr = values.delivery_date != null ? dayjs(values.delivery_date).format('YYYY-MM-DD') : undefined;
      values.items = items.map((it: SalesOrderItem) => {
        const line = calcSalesLineAmounts(q(it), p(it), taxR(it), values.price_type);
        const material = materials.find((m) => m.id === Number((it as any).material_id));
        const conversionFactor = resolveSaleUnitConversionFactor(material, (it as any).material_unit);
        const d = (it as any).delivery_date;
        const deliveryDateStr = d != null ? (typeof d === 'string' ? d.slice(0, 10) : dayjs(d).format('YYYY-MM-DD')) : mainDeliveryStr;
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
          delivery_date: deliveryDateStr ?? mainDeliveryStr ?? dayjs().format('YYYY-MM-DD'),
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

      // 如果是直接提交，先生成正式编号（如果配置了规则）
      const ruleCodeToUse = effectiveRuleCode || getPageRuleCode('kuaizhizao-sales-order');
      if (
        !isDraft &&
        !isEdit &&
        ruleCodeToUse &&
        (isAutoGenerateEnabled('kuaizhizao-sales-order') || effectiveRuleCode) &&
        (values.order_code === previewCode || !values.order_code)
      ) {
        try {
          const codeResponse = await generateCode({ rule_code: ruleCodeToUse });
          values.order_code = codeResponse.code;
        } catch (error: any) {
          console.warn('正式生成订单编号失败，使用预览编号:', error);
        }
      }

      let orderId = currentId;

      // 1. 创建或更新订单
      let updateRes: any = null;
      if (isEdit && currentId) {
        updateRes = await updateSalesOrder(currentId, values);
      } else {
        const res = await createSalesOrder(values);
        orderId = (res as any)?.id;
      }

      // 2. 草稿保存直接提示
      if (isDraft) {
         messageApi.success(isEdit ? t('app.kuaizhizao.salesOrder.updated') : t('app.kuaizhizao.salesOrder.savedDraft'));
      } else if (orderId) {
        // 非草稿（即点击了“提交订单”或“更新”），则执行提交。编辑时若 update 已自动审核则跳过 submit，避免重复审核
        const alreadyApproved = updateRes?.status === 'AUDITED' || updateRes?.status === '已审核';
        try {
          const submitRes = alreadyApproved ? updateRes : await submitSalesOrder(orderId!);
          // 判断后端返回的状态是否已经是“已审核”
          const isApproved = submitRes?.status === 'AUDITED' || submitRes?.status === '已审核';
          const syncTip = submitRes?.demand_synced ? t('app.kuaizhizao.salesOrder.demandSyncTip') : '';
          if (isApproved) {
             messageApi.success(isEdit ? t('app.kuaizhizao.salesOrder.orderUpdatedAndAutoApproved', { syncTip }) : t('app.kuaizhizao.salesOrder.orderCreatedAndAutoApproved', { syncTip }));
          } else {
             messageApi.success(isEdit ? t('app.kuaizhizao.salesOrder.orderResubmitted') : t('app.kuaizhizao.salesOrder.orderCreatedAndSubmitted'));
          }
        } catch (submitError: any) {
          messageApi.error(t('app.kuaizhizao.salesOrder.saveSuccessSubmitFailed', { message: submitError.message || t('app.kuaizhizao.salesOrder.unknownError') }));
        }
      }

      setModalVisible(false);
      setPreviewCode(null);
      setEffectiveRuleCode(null);
      invalidateOrdersCache();
      invalidateMenuBadge();
      invalidateStatistics();

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
      const values = await formRef.current?.validateFields();
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
    doPush: () => Promise<any>;
    onSuccess: () => void;
    orderId: number;
  } | null>(null);
  const [pushPreviewConfirming, setPushPreviewConfirming] = useState(false);
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
    doPush: () => Promise<any>,
    onSuccess: () => void,
    orderId: number,
  ) => {
    setPushPreviewOpen(true);
    setPushPreviewLoading(true);
    setPushPreviewData(null);
    setPushPreviewAction({ doPush, onSuccess, orderId });
    fetchPreview()
      .then((res) => {
        setPushPreviewData(res);
        setPushPreviewLoading(false);
      })
      .catch((err) => {
        messageApi.error(err?.response?.data?.detail || err.message || t('app.kuaizhizao.salesOrder.loadPreviewFailed'));
        setPushPreviewOpen(false);
        setPushPreviewLoading(false);
      });
  };

  /** 确认下推（执行实际下推） */
  const handlePushPreviewConfirm = async () => {
    if (!pushPreviewAction || !pushPreviewData) return;
    setPushPreviewConfirming(true);
    try {
      await pushPreviewAction.doPush();
      messageApi.success(t('app.kuaizhizao.salesOrder.pushSuccess'));
      pushPreviewAction.onSuccess();
      setPushPreviewOpen(false);
      setPushPreviewData(null);
      setPushPreviewAction(null);
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || '下推失败');
    } finally {
      setPushPreviewConfirming(false);
    }
  };

  /**
   * 处理下推到需求计算（含预览）
   */
  const handlePushToComputation = async (id: number, order?: SalesOrder | null) => {
    if (!salesNodeEnabled.demand_computation) {
      messageApi.warning('需求计算节点未启用，无法下推');
      return;
    }
    if (order?.pushed_to_computation) return;
    if (orderHasLineWorkOrders(order)) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.pushMutualExclusiveComputationBlocked'));
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
      messageApi.warning('发货通知节点未启用，无法下推');
      return;
    }
    modalApi.confirm({
      title: t('app.kuaizhizao.salesOrder.pushToShipmentTitle'),
      content: t('app.kuaizhizao.salesOrder.pushToShipmentConfirm'),
      zIndex: elevatedModalZIndex,
      onOk: async () => {
        try {
          const res = await pushSalesOrderToShipmentNotice(id);
          messageApi.success(res?.message || t('app.kuaizhizao.salesOrder.shipmentNoticeCreated'));
          refreshDrawerOrder(id);
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.salesOrder.pushFailed'));
        }
      },
    });
  };

  /** 处理下推到销售发票 */
  const handlePushToInvoice = async (id: number) => {
    if (!salesNodeEnabled.invoice) {
      messageApi.warning('销售发票节点未启用，无法下推');
      return;
    }
    modalApi.confirm({
      title: t('app.kuaizhizao.salesOrder.pushToInvoiceTitle'),
      content: t('app.kuaizhizao.salesOrder.pushToInvoiceConfirm'),
      zIndex: elevatedModalZIndex,
      onOk: async () => {
        try {
          const res = await pushSalesOrderToInvoice(id);
          messageApi.success(res?.message || t('app.kuaizhizao.salesOrder.invoiceCreated'));
          refreshDrawerOrder(id);
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.salesOrder.pushFailed'));
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
        messageApi.warning('销售订单暂无可退货数量（已交货数量为 0）');
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
      messageApi.error(error?.response?.data?.detail || error?.message || '加载销售订单详情失败');
    }
  };

  /** 确认下推销售退货 */
  const handlePushToSalesReturnConfirm = async () => {
    if (!pushToReturnOrder?.id) return;
    if (!pushToReturnWarehouseId || pushToReturnWarehouseId <= 0) {
      messageApi.warning('请先填写退货仓库ID');
      return;
    }
    const items = (pushToReturnOrder.items || []).filter((it) => Number(it.delivered_quantity || 0) > 0);
    for (const it of items) {
      if (it.id == null) continue;
      const qty = Number(pushToReturnQuantities[it.id] || 0);
      const max = Number(it.delivered_quantity || 0);
      if (qty <= 0) continue;
      if (qty > max) {
        messageApi.error(`物料 ${it.material_code || it.material_name} 的退货数量不能超过可退数量 ${max}`);
        return;
      }
    }
    setPushToReturnLoading(true);
    try {
      const result = await pushSalesOrderToSalesReturn({
        sales_order_id: pushToReturnOrder.id,
        warehouse_id: pushToReturnWarehouseId,
        warehouse_name: pushToReturnWarehouseName || undefined,
        return_quantities: pushToReturnQuantities,
      });
      messageApi.success(`成功生成销售退货单：${result?.return_code || '已创建'}`);
      setPushToReturnVisible(false);
      setPushToReturnOrder(null);
      setPushToReturnQuantities({});
      setPushToReturnWarehouseId(undefined);
      setPushToReturnWarehouseName('');
      refreshDrawerOrder(pushToReturnOrder.id);
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error?.message || '下推销售退货失败');
    } finally {
      setPushToReturnLoading(false);
    }
  };

  /** 直推工单（含预览） */
  const handlePushToWorkOrder = async (id: number, order?: SalesOrder | null) => {
    if (!salesNodeEnabled.work_order) {
      messageApi.warning('工单节点未启用，无法下推');
      return;
    }
    if (order?.pushed_to_computation) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.pushMutualExclusiveWorkOrderBlocked'));
      return;
    }
    showPushPreviewModal(
      () => previewPushSalesOrderToWorkOrder(id),
      () => pushSalesOrderToWorkOrder(id),
      () => refreshDrawerOrder(id),
      id,
    );
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
      messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.salesOrder.sendFailed'));
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
          messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.salesOrder.withdrawFailed'));
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
        setFullChainRefreshKey((k) => k + 1);
      } catch {
        // 忽略
      }
    }
    invalidateOrdersCache();
          actionRef.current?.reload();
  };

  const onFullChainGraphNodeClick = useCallback(
    (type: string, id: number) => {
      if (!id) return;
      if (type === 'sales_order' && currentSalesOrder?.id != null && id === currentSalesOrder.id) {
        setFullChainBriefDoc(null);
        return;
      }
      setFullChainBriefDoc({ document_type: type, document_id: id });
    },
    [currentSalesOrder?.id],
  );

  useEffect(() => {
    if (drawerVisible && currentSalesOrder?.id != null) {
      setFullChainBriefDoc(null);
    }
  }, [drawerVisible, currentSalesOrder?.id]);



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
        
        return {
          material_id: material?.id,
          material_code: material?.mainCode || material?.code || materialCode,
          material_name: material?.name || '',
          material_spec: material?.specification || spec,
          material_unit: material?.baseUnit || unit,
          required_quantity: quantity,
          unit_price: price,
          delivery_date: deliveryDate ? (dayjs(deliveryDate).isValid() ? dayjs(deliveryDate) : undefined) : undefined,
          tax_rate: 0,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null && (it.material_id !== undefined || it.material_code !== ''));

    if (newItems.length === 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.noValidData'));
      return;
    }

    const currentItems = formRef.current?.getFieldValue('items') || [];
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    messageApi.success(t('app.kuaizhizao.salesOrder.importSuccessItems', { count: newItems.length }));
  };

  /** 从物料多选面板批量追加明细行（与「添加明细」默认字段一致，数量默认为 1） */
  const appendOrderItemsFromMaterials = React.useCallback(
    (selected: Material[]) => {
      const mainDelivery = formRef.current?.getFieldValue('delivery_date');
      const defaultDelivery =
        mainDelivery != null ? (dayjs.isDayjs(mainDelivery) ? mainDelivery : dayjs(mainDelivery)) : dayjs();
      const rowFromMaterial = (m: Material) => {
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
          unit_price: (m as any).defaults?.defaultSalePrice ?? (m as any).defaults?.default_sale_price ?? (m as any).defaultSalePrice ?? (m as any).default_sale_price ?? 0,
          tax_rate: 0,
          variant_attributes: '',
          _sourceType: st,
        };
      };
      const isEmptyItemRow = (row: any) => {
        if (row == null) return true;
        if (row.material_id != null && row.material_id !== '') return false;
        const code = row.material_code;
        return code == null || String(code).trim() === '';
      };
      const queue = selected.map(rowFromMaterial);
      const items = [...(formRef.current?.getFieldValue('items') ?? [])].map((row: any) => ({ ...row }));
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
    [messageApi, t]
  );

  // 订单视图列（一行一单，可展开明细）
  const orderColumns: ProColumns<SalesOrder>[] = [
    {
      title: t('app.kuaizhizao.salesOrder.orderCode'),
      dataIndex: 'order_code',
      width: 150,
      fixed: 'left' as const,
      ellipsis: true,
      sorter: true,
      hideInSearch: false,
      render: (_: unknown, record: SalesOrder) => (
        <Space size={4}>
          <span>{record.order_code ?? '-'}</span>
          <Tooltip title={t('field.invitationCode.copy')}>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined style={{ fontSize: 12 }} />}
              onClick={(e) => {
                e.stopPropagation();
                const text = record.order_code ?? '';
                if (text) {
                  navigator.clipboard.writeText(text).then(
                    () => messageApi.success(t('common.copySuccess')),
                    () => messageApi.error(t('common.copyFailed'))
                  );
                }
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
    { title: t('app.kuaizhizao.salesOrder.customerName'), dataIndex: 'customer_name', width: 150, ellipsis: true, sorter: true, hideInSearch: false },
    { title: t('app.kuaizhizao.salesOrder.orderDate'), dataIndex: 'order_date', valueType: 'date', width: 120, sorter: true, hideInSearch: true },
    // 订单日期范围（仅搜索）
    { title: t('app.kuaizhizao.salesOrder.orderDate'), dataIndex: 'order_date', valueType: 'dateRange', width: 120, hideInTable: true, hideInSearch: false, fieldProps: { placeholder: [t('common.startDate') ?? '开始日期', t('common.endDate') ?? '结束日期'] } },
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
    { title: t('app.kuaizhizao.salesOrder.salesman'), dataIndex: 'salesman_name', width: 100, hideInSearch: true },
    {
      title: t('app.kuaizhizao.salesOrder.deliveryDate'),
      dataIndex: 'delivery_date',
      width: 120,
      sorter: true,
      render: (_: unknown, record: SalesOrder) => {
        const raw = record.delivery_date;
        const text = raw ? dayjs(raw).format('YYYY-MM-DD') : '-';
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
    { title: t('app.kuaizhizao.salesOrder.totalAmountLabel'), dataIndex: 'total_amount', width: 120, align: 'right' as const, sorter: true, render: (_: unknown, r: SalesOrder) => <AmountDisplay resource="sales_order" value={r.total_amount} /> },
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
    {
      title: t('app.kuaizhizao.salesOrder.lifecycle'),
      dataIndex: 'lifecycle',
      width: 100,
      align: 'left' as const,
      fixed: 'right' as const,
      valueType: 'select',
      valueEnum: {
        草稿: { text: t('app.kuaizhizao.salesOrder.lifecycleDraft') },
        待审核: { text: t('app.kuaizhizao.salesOrder.lifecyclePendingReview') },
        已审核: { text: t('app.kuaizhizao.salesOrder.lifecycleAudited') },
        已生效: { text: t('app.kuaizhizao.salesOrder.lifecycleEffective') },
        执行中: { text: t('app.kuaizhizao.salesOrder.lifecycleInProgress') },
        已交货: { text: t('app.kuaizhizao.salesOrder.lifecycleDelivered') },
        发货出库: { text: t('app.kuaizhizao.salesOrder.lifecycleDelivered') },
        已完成: { text: t('app.kuaizhizao.salesOrder.lifecycleCompleted') },
        已驳回: { text: t('app.kuaizhizao.salesOrder.lifecycleRejected') },
        已取消: { text: t('app.kuaizhizao.salesOrder.lifecycleCancelled') },
      },
      render: (_: unknown, record: SalesOrder) => {
        const lifecycle = getSalesOrderLifecycle(record, auditEnabled);
        const activeStage = lifecycle.mainStages?.find((s: SubStage) => s.status === 'active');
        const displayLabel = activeStage?.label ?? lifecycle.stageName;
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={displayLabel}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: t('app.kuaizhizao.salesOrder.actions'),
      width: 260,
      fixed: 'right' as const,
      valueType: 'option',
      render: (_: any, record: SalesOrder) => {
        const lifecycle = getSalesOrderLifecycle(record, auditEnabled);
        const canEdit = ['草稿', '待审核', '已驳回'].includes(lifecycle.stageName ?? '');
        const canDelete = ['草稿', '待审核'].includes(lifecycle.stageName ?? '') || record.status === SalesOrderStatus.DRAFT || record.status === 'PENDING_REVIEW';
        const isDraft = record.status === SalesOrderStatus.DRAFT;
        const parts: React.ReactNode[] = [
          <Button type="link" size="small" onClick={() => handleDetail([record.id!])}>
            {t('app.kuaizhizao.salesOrder.viewDetail')}
          </Button>,
        ];
        parts.push(
          <Tooltip title={!canEdit ? t('app.kuaizhizao.salesOrder.editDisabledTip', { defaultValue: '已审核、已生效或执行中的订单不可编辑' }) : undefined}>
            <span>
              <Button type="link" size="small" disabled={!canEdit} onClick={() => canEdit && handleEdit([record.id!])}>
                {t('app.kuaizhizao.salesOrder.editAction')}
              </Button>
            </span>
          </Tooltip>
        );
        parts.push(
          <Tooltip title={!canDelete ? t('app.kuaizhizao.salesOrder.deleteDisabledTip', { defaultValue: '该状态下的订单不可删除' }) : undefined}>
            <span>
              <Button type="link" danger size="small" disabled={!canDelete} onClick={() => canDelete && handleDeleteSingle(record.id!)}>
                {t('app.kuaizhizao.salesOrder.delete')}
              </Button>
            </span>
          </Tooltip>
        );
        parts.push(
          <UniWorkflowActions
            key="workflow-actions"
            record={record}
            entityName={t('app.kuaizhizao.salesOrder.entityName')}
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={[SalesOrderStatus.DRAFT]}
            pendingStatuses={[ReviewStatus.PENDING, '待审核']}
            approvedStatuses={[...APPROVED_STATUS_VALUES]}
            rejectedStatuses={['已驳回', SalesOrderStatus.REJECTED]}
            autoApproveWhenSubmit={!auditEnabled}
            workflowAuditEnabled={auditEnabled}
            theme="link"
            size="small"
            actions={{ submit: async (id) => submitSalesOrder(id), approve: approveSalesOrder, revoke: unapproveSalesOrder }}
            onSuccess={() => { invalidateOrdersCache(); invalidateMenuBadge(); invalidateStatistics(); actionRef.current?.reload(); }}
            confirmMessages={{ submit: auditEnabled ? t('app.kuaizhizao.salesOrder.submitConfirmAudit') : t('app.kuaizhizao.salesOrder.submitConfirmAuto') }}
          />
        );
        {
          const pushEnabledBase = isApprovedRecord(record);
          const canPushComputation =
            pushEnabledBase && canOpenDemandComputationPush(record, salesNodeEnabled.demand_computation);
          const canPushWorkOrder =
            pushEnabledBase && canOpenDirectWorkOrderPush(record, salesNodeEnabled.work_order);
          const canPushShipment = pushEnabledBase && !!salesNodeEnabled.shipment_notice;
          const canPushInvoice = pushEnabledBase && !!salesNodeEnabled.invoice;
          const canPushSalesReturn = pushEnabledBase;
          const canWithdrawComputation = pushEnabledBase && !!record.pushed_to_computation;
          const pushMenuItems = [
            {
              key: 'computation',
              label: t('app.kuaizhizao.salesOrder.demandComputation'),
              disabled: !canPushComputation,
              onClick: () => canPushComputation && handlePushToComputation(record.id!, record),
            },
            {
              key: 'workorder',
              label: t('app.kuaizhizao.salesOrder.pushToWorkOrder'),
              disabled: !canPushWorkOrder,
              onClick: () => canPushWorkOrder && handlePushToWorkOrder(record.id!, record),
            },
            { type: 'divider' as const },
            {
              key: 'shipment',
              label: t('app.kuaizhizao.salesOrder.shipmentNotice'),
              disabled: !canPushShipment,
              onClick: () => canPushShipment && handlePushToShipmentNotice(record.id!),
            },
            {
              key: 'invoice',
              label: t('app.kuaizhizao.salesOrder.salesInvoice'),
              disabled: !canPushInvoice,
              onClick: () => canPushInvoice && handlePushToInvoice(record.id!),
            },
            {
              key: 'sales-return',
              label: '下推销售退货单',
              disabled: !canPushSalesReturn,
              onClick: () => canPushSalesReturn && handlePushToSalesReturn(record.id!),
            },
            ...(record.pushed_to_computation
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
          ];
          const canUsePush = pushMenuItems.some((it: any) => it.type !== 'divider' && !it.disabled);
          parts.push(
            <Dropdown menu={{ items: pushMenuItems }}>
              <Button type="link" size="small" disabled={!canUsePush}>
                {t('app.kuaizhizao.salesOrder.push')}
              </Button>
            </Dropdown>
          );
        }
        parts.push(
          <Button type="link" size="small" onClick={() => openFollowUpFromSalesOrder(record)}>
            {t('app.kuaizhizao.customerFollowUp.addFollowUpFromDocument')}
          </Button>
        );
        return renderRowActionsOverflow(parts, `sales-order-${record.id ?? 'row'}`);
      },
    },
  ];

  // 表格列：销售明细平铺视图（订单 + 明细）
  const detailColumns: ProColumns<SalesOrderItemRow>[] = [
    {
      title: t('app.kuaizhizao.salesOrder.orderCode'),
      dataIndex: 'order_code',
      width: 140,
      fixed: 'left' as const,
      ellipsis: true,
      render: (_, record) => (
        <Space size={4}>
          <span>{record.order_code ?? '-'}</span>
          <Tooltip title={t('field.invitationCode.copy')}>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined style={{ fontSize: 12 }} />}
              onClick={(e) => {
                e.stopPropagation();
                const text = record.order_code ?? '';
                if (text) {
                  navigator.clipboard.writeText(text).then(
                    () => messageApi.success(t('common.copySuccess')),
                    () => messageApi.error(t('common.copyFailed'))
                  );
                }
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
    { title: t('app.kuaizhizao.salesOrder.customerName'), dataIndex: 'customer_name', width: 130, ellipsis: true, hideInSearch: false },
    { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 110, ellipsis: true },
    { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 140, ellipsis: true },
    { title: t('app.kuaizhizao.salesOrder.materialSpec'), dataIndex: 'material_spec', width: 100, ellipsis: true },
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
    { title: t('app.kuaizhizao.salesOrder.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' as const, render: (val: any) => <AmountDisplay resource="sales_order" value={val} /> },
    { title: t('app.kuaizhizao.salesOrder.taxRate'), dataIndex: 'tax_rate', width: 70, align: 'right' as const, render: (val: any) => val ?? 0 },
    { title: t('app.kuaizhizao.salesOrder.inclAmount'), dataIndex: 'item_amount', width: 100, align: 'right' as const, render: (val: any) => <AmountDisplay resource="sales_order" value={val} /> },
    {
      title: t('app.kuaizhizao.salesOrder.deliveryDate'),
      dataIndex: 'delivery_date',
      width: 150,
      render: (_: unknown, row: SalesOrderItemRow) => {
        const raw = row.delivery_date;
        const text = raw ? dayjs(raw).format('YYYY-MM-DD') : '-';
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
    {
      title: t('app.kuaizhizao.salesOrder.lifecycle'),
      dataIndex: 'lifecycle',
      width: 90,
      hideInSearch: false,
      valueType: 'select',
      valueEnum: {
        草稿: { text: t('app.kuaizhizao.salesOrder.lifecycleDraft') },
        待审核: { text: t('app.kuaizhizao.salesOrder.lifecyclePendingReview') },
        已审核: { text: t('app.kuaizhizao.salesOrder.lifecycleAudited') },
        已生效: { text: t('app.kuaizhizao.salesOrder.lifecycleEffective') },
        执行中: { text: t('app.kuaizhizao.salesOrder.lifecycleInProgress') },
        已交货: { text: t('app.kuaizhizao.salesOrder.lifecycleDelivered') },
        发货出库: { text: t('app.kuaizhizao.salesOrder.lifecycleDelivered') },
        已完成: { text: t('app.kuaizhizao.salesOrder.lifecycleCompleted') },
        已驳回: { text: t('app.kuaizhizao.salesOrder.lifecycleRejected') },
        已取消: { text: t('app.kuaizhizao.salesOrder.lifecycleCancelled') },
      },
      render: (_: unknown, record: SalesOrderItemRow) => {
        const orderRecord = { id: record.sales_order_id, status: record.status, review_status: record.review_status } as SalesOrder;
        const lifecycle = getSalesOrderLifecycle(orderRecord, auditEnabled);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        return <Tag {...getDocumentLifecycleStageTagProps(stageName)}>{stageName}</Tag>;
      },
    },
    // 明细表格视图以每行订单明细为展示维度，纯查看用途，不提供操作按钮
  ];

  const columns = (dataViewMode === 'detail' ? detailColumns : orderColumns) as any[];

  const handleDeleteResolved = dataViewMode === 'order'
    ? async (keys: React.Key[]) => {
        const ids = keys.map((k) => Number(k)).filter((id) => !Number.isNaN(id));
        if (ids.length === 0) {
          messageApi.warning(t('app.kuaizhizao.salesOrder.selectToDelete'));
          return;
        }
        modalApi.confirm({
          title: t('app.kuaizhizao.salesOrder.confirmDelete'),
          content: t('app.kuaizhizao.salesOrder.deleteConfirm', { count: ids.length }),
          okText: t('app.kuaizhizao.salesOrder.okDelete'),
          okType: 'danger',
          cancelText: t('common.cancel'),
          zIndex: elevatedModalZIndex,
          onOk: async () => {
            try {
              const res = await bulkDeleteSalesOrders(ids);
              if (res.failed_count === 0) {
                messageApi.success(t('app.kuaizhizao.salesOrder.deleteSuccess', { count: res.success_count }));
              } else {
                messageApi.warning(t('app.kuaizhizao.salesOrder.deletePartial', { success: res.success_count, failed: res.failed_count }));
              }
              invalidateOrdersCache();
              invalidateMenuBadge();
              invalidateStatistics();

          actionRef.current?.reload();
              if (actionRef.current?.clearSelected) actionRef.current.clearSelected();
            } catch (error: any) {
              messageApi.error(error.message || t('app.kuaizhizao.salesOrder.deleteFailed'));
            }
          },
        });
      }
    : handleDelete;

  /** 较昨日对比：显示 +x / -x 格式 */
  const renderDOD = (today?: number, yesterday?: number) => {
    if (today === undefined || yesterday === undefined) return null;
    const diff = today - yesterday;
    const color = diff > 0 ? '#cf1322' : diff < 0 ? '#3f8600' : 'rgba(0, 0, 0, 0.45)';
    const text = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0';
    return (
      <span style={{ marginLeft: 8, fontSize: 13, color }}>
        <span style={{ color: 'rgba(0,0,0,0.45)' }}>较昨日</span> {text}
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
          title: t('app.kuaizhizao.salesOrder.statOverdue', '逾期未交'),
          value: statistics.overdue_count ?? 0,
          description:
            statistics.overdue_count !== undefined && statistics.yesterday_overdue !== undefined ? (
              <div>
                今日: {statistics.overdue_count}{' '}
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
          title: t('app.kuaizhizao.salesOrder.statTodayNew', '今日新签'),
          value: statistics.today_new_count ?? 0,
          suffix: t('app.kuaizhizao.salesOrder.unitOrders', { defaultValue: '单' }),
          description:
            statistics.today_new_count !== undefined && statistics.yesterday_today_new !== undefined ? (
              <div>
                今日: {statistics.today_new_count}{' '}
                {renderDOD(statistics.today_new_count, statistics.yesterday_today_new)}
              </div>
            ) : undefined,
          valueStyle: { color: token.colorPrimary },
          backgroundChart: renderTrendChart(statistics.trend_today_new ?? [], token.colorPrimary),
        },
        ...(auditEnabled
          ? [{
              title: t('app.kuaizhizao.salesOrder.lifecyclePendingReview', '待审核'),
              value: statistics.pending_review_count ?? 0,
              description:
                statistics.pending_review_count !== undefined &&
                statistics.yesterday_pending_review !== undefined ? (
                  <div>
                    今日: {statistics.pending_review_count}{' '}
                    {renderDOD(statistics.pending_review_count, statistics.yesterday_pending_review)}
                  </div>
                ) : (statistics.pending_review_count ?? 0) > 0 ? (
                  <div style={{ color: '#faad14' }}>需即时处理</div>
                ) : undefined,
              valueStyle: (statistics.pending_review_count ?? 0) > 0 ? { color: '#faad14' } : undefined,
              backgroundChart: renderTrendChart(statistics.trend_pending_review ?? [], '#faad14'),
              onClick:
                (statistics.pending_review_count ?? 0) > 0
                  ? () => {
                      tableSearchFormRef.current?.setFieldsValue?.({ lifecycle: '待审核' });
                      actionRef.current?.reload?.();
                    }
                  : undefined,
            }]
          : []),
        {
          title: t('app.kuaizhizao.salesOrder.statUnfulfilled', '未履约'),
          value: statistics.unfulfilled_count ?? 0,
          description:
            statistics.unfulfilled_count !== undefined &&
            statistics.yesterday_unfulfilled !== undefined ? (
              <div>
                今日: {statistics.unfulfilled_count}{' '}
                {renderDOD(statistics.unfulfilled_count, statistics.yesterday_unfulfilled)}
              </div>
            ) : undefined,
          valueStyle: { color: '#2f54eb' },
          backgroundChart: renderTrendChart(statistics.trend_unfulfilled ?? [], '#2f54eb'),
        },
        {
          title: t('app.kuaizhizao.salesOrder.statAnnualTotal', '本年累计'),
          value: statistics.annual_total_amount ?? 0,
          prefix: '¥',
          precision: 2,
          valueStyle: { color: token.colorPrimary },
          description: (
            <div style={{ color: (statistics.annual_total_yoy ?? 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
              较去年同期 {(statistics.annual_total_yoy ?? 0) > 0 ? '+' : ''}
              {statistics.annual_total_yoy ?? 0}%
            </div>
          ),
          backgroundChart: renderTrendChart(statistics.trend_annual ?? [], token.colorPrimary),
        },
      ]
    : [
        {
          title: t('app.kuaizhizao.salesOrder.statOverdue', '逾期未交'),
          value: 0,
          valueStyle: { color: '#ff4d4f' },
        },
        {
          title: t('app.kuaizhizao.salesOrder.statTodayNew', '今日新签'),
          value: 0,
          suffix: t('app.kuaizhizao.salesOrder.unitOrders', { defaultValue: '单' }),
          valueStyle: { color: token.colorPrimary },
        },
        ...(auditEnabled
          ? [{
              title: t('app.kuaizhizao.salesOrder.lifecyclePendingReview', '待审核'),
              value: 0,
              valueStyle: { color: '#faad14' },
            }]
          : []),
        {
          title: t('app.kuaizhizao.salesOrder.statUnfulfilled', '未履约'),
          value: 0,
          valueStyle: { color: '#2f54eb' },
        },
        {
          title: t('app.kuaizhizao.salesOrder.statAnnualTotal', '本年累计'),
          value: 0,
          prefix: '¥',
          precision: 2,
          valueStyle: { color: token.colorPrimary },
        },
      ];

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
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
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
                <p><strong>表格视图</strong>：按订单维度展示。</p>
                <p><strong>明细表格</strong>：以每行订单明细为展示维度，纯查看用途，支持库存/BOM 检查。</p>
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
            // 以 lifecycle 为唯一展示入口：搜索时按 lifecycle 阶段映射到后端 status
            if (searchFormValues?.lifecycle) {
              const lifecycleToStatus: Record<string, string> = {
                草稿: 'DRAFT',
                待审核: 'PENDING_REVIEW',
                已审核: 'AUDITED',
                已确认: 'CONFIRMED',
                已生效: 'EFFECTIVE',
                执行中: 'IN_PROGRESS',
                已交货: 'DELIVERED',
                发货出库: 'DELIVERED',
                已完成: 'COMPLETED',
                已驳回: 'REJECTED',
                已取消: 'CANCELLED',
              };
              apiParams.status = lifecycleToStatus[searchFormValues.lifecycle] ?? searchFormValues.lifecycle;
            }
            if (searchFormValues?.customer_name) apiParams.customer_name = searchFormValues.customer_name;
            if (searchFormValues?.order_code) apiParams.order_code = searchFormValues.order_code;
            if (searchFormValues?.keyword) apiParams.keyword = searchFormValues.keyword;
            // 订单日期范围
            if (searchFormValues?.order_date && Array.isArray(searchFormValues.order_date) && searchFormValues.order_date.length === 2) {
              const [start, end] = searchFormValues.order_date;
              if (start) apiParams.start_date = dayjs(start).format('YYYY-MM-DD');
              if (end) apiParams.end_date = dayjs(end).format('YYYY-MM-DD');
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
                    status: order.status,
                    review_status: order.review_status,
                    pushed_to_computation: order.pushed_to_computation,
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
                      status: order.status,
                      review_status: order.review_status,
                      pushed_to_computation: order.pushed_to_computation,
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
              const cache = lastOrdersCacheRef.current;
              let orders: SalesOrder[];
              let total: number;

              if (cache?.paramsKey === paramsKey && cache.orders) {
                orders = cache.orders;
                total = cache.total;
              } else {
                const response = await listSalesOrders(apiParams);
                orders = Array.isArray(response) ? response : (response as any).data || [];
                total = (response as any).total ?? orders.length;
                lastOrdersCacheRef.current = { orders, total, paramsKey };
              }

              const mode = dataViewModeRef.current;
              if (mode === 'order') {
                const map = new Map<string, number>();
                orders.forEach(o => {
                  if (o.id) map.set(String(o.id), o.id);
                });
                rowKeyToOrderIdRef.current = map;
                return { data: orders, success: true, total };
              }
              return { data: toFlatRows(orders), success: true, total };
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.getListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          showAdvancedSearch={true}
          enableRowSelection={viewTypeState !== 'detailTable'}
          showCreateButton={true}
          createButtonText={t('app.kuaizhizao.salesOrder.create')}
          onCreate={handleCreate}
          toolBarRender={() => [
            <Space.Compact key={`batch-btn-${selectedRowKeys.length}`}>
              <Button
                disabled={selectedRowKeys.length === 0}
                danger
                onClick={() => handleDeleteResolved(selectedRowKeys)}
              >
                <DeleteOutlined /> {t('app.kuaizhizao.salesOrder.batchDelete', '批量删除')}
              </Button>
              <Dropdown
                disabled={selectedRowKeys.length === 0}
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'submit',
                      label: t('app.kuaizhizao.salesOrder.batchSubmit', '批量提交'),
                      icon: <SendOutlined />,
                      onClick: () => handleBatchSubmit(selectedRowKeys),
                    },
                    {
                      key: 'approve',
                      label: t('app.kuaizhizao.salesOrder.batchApprove', '批量审核'),
                      icon: <FileTextOutlined />,
                      onClick: () => handleBatchApprove(selectedRowKeys),
                    },
                    {
                      key: 'withdraw',
                      label: t('app.kuaizhizao.salesOrder.batchWithdraw', '批量撤回'),
                      icon: <RollbackOutlined />,
                      onClick: () => handleBatchWithdraw(selectedRowKeys),
                    },
                    {
                      key: 'unapprove',
                      label: t('app.kuaizhizao.salesOrder.batchUnapprove', '批量反审核'),
                      icon: <RollbackOutlined />,
                      onClick: () => handleBatchUnapprove(selectedRowKeys),
                    },
                  ],
                }}
              >
                <Button danger icon={<ArrowDownOutlined />} />
              </Dropdown>
            </Space.Compact>,
            <Space key="highlight-overdue-switch" align="center" style={{ marginLeft: 8 }}>
              <Switch checked={highlightDeliveryOverdue} onChange={setHighlightDeliveryOverdue} />
              <span style={{ fontSize: 13, color: 'var(--ant-color-text)' }}>
                {t('app.kuaizhizao.salesOrder.highlightOverdue')}
              </span>
            </Space>,
          ]}
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

      {/* 新建/编辑 Modal：使用标准 FormModalTemplate，统一创建按钮与快捷键 */}
      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.salesOrder.edit') : t('app.kuaizhizao.salesOrder.create')}
        open={modalVisible}
        zIndex={elevatedModalZIndex}
        onClose={() => {
          setModalVisible(false);
          setPreviewCode(null);
          setEffectiveRuleCode(null);
        }}
        onFinish={async (values) => {
          setModalSubmitting(true);
          try {
            await handleSaveInternal(values, false);
          } finally {
            setModalSubmitting(false);
          }
        }}
        isEdit={isEdit}
        formRef={formRef}
        width={1200}
        loading={modalSubmitting}
        grid={false}
        extraFooter={!isEdit ? <Button onClick={handleSaveDraft}>{t('app.kuaizhizao.salesOrder.saveDraft')}</Button> : undefined}
      >
        <Row gutter={16}>
            <Col span={12}>
              <ProFormText
                name="order_code"
                label={
                  <span>
                    订单编号
                    <a
                      href="/system/code-rules"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/system/code-rules');
                      }}
                      style={{ marginLeft: 8, fontSize: 12 }}
                    >
                      编号规则设置
                    </a>
                  </span>
                }
                placeholder={isAutoGenerateEnabled('kuaizhizao-sales-order') ? '编号将根据编号规则自动生成，可修改' : '请输入订单编号'}
                rules={[{ required: true, message: '请输入订单编号' }]}
                fieldProps={{ disabled: isEdit }}
              />
            </Col>
            <Col span={6}>
              <ProFormDatePicker
                name="order_date"
                label="订单日期"
                rules={[{ required: true, message: '请选择订单日期' }]}
                fieldProps={{ style: { width: '100%' } }}
              />
            </Col>
            <Col span={6}>
              <ProFormDatePicker
                name="delivery_date"
                label="交货日期"
                rules={[{ required: true, message: '请选择交货日期' }]}
                fieldProps={{
                  style: { width: '100%' },
                  onChange: (val: any) => {
                    const items = formRef.current?.getFieldValue('items') ?? [];
                    if (items.length && val != null) {
                      const next = items.map((it: any) => ({ ...it, delivery_date: val }));
                      formRef.current?.setFieldsValue({ items: next });
                    }
                  },
                }}
              />
            </Col>
            <Col span={6}>
              <ProForm.Item
                name="customer_id"
                label={
                  <span>
                    客户名称
                    <a
                      href="/apps/master-data/supply-chain/customers"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/apps/master-data/supply-chain/customers');
                      }}
                      style={{ marginLeft: 8, fontSize: 12 }}
                    >
                      客户信息管理
                    </a>
                  </span>
                }
                rules={[{ required: true, message: '请选择客户' }]}
              >
                <UniDropdown
                  placeholder="请选择客户"
                  showSearch
                  allowClear
                  loading={customersLoading}
                  style={{ width: '100%' }}
                  options={customers.map((c) => ({
                    label: (c.code ? `${c.code} - ` : '') + c.name,
                    value: c.id,
                  }))}
                  onChange={(id: number | undefined) => {
                    const c = id ? customers.find((x) => x.id === id) : null;
                    if (c) {
                      const sId = (c as any).salesmanId ?? (c as any).salesman_id;
                      const salesman = users.find((u) => u.id === sId);
                      const sName = (c as any).salesmanName ?? (c as any).salesman_name ?? (salesman ? (salesman.full_name || salesman.username) : '');
                      formRef.current?.setFieldsValue({
                        customer_name: c.name ?? (c as any).customer_name,
                        customer_contact: (c as any).contactPerson ?? (c as any).contact_person ?? (c as any).contact,
                        customer_phone: (c as any).phone ?? (c as any).customer_phone,
                        salesman_id: sId,
                        salesman_name: sName,
                        shipping_address: (c as any).address ?? (c as any).shipping_address,
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
                  quickCreate={{
                    label: '快速新建',
                    onClick: () => setCustomerCreateVisible(true),
                  }}
                  advancedSearch={{
                    label: '高级搜索',
                    fields: [
                      { name: 'code', label: '客户编号' },
                      { name: 'name', label: '客户名称' },
                      { name: 'contactPerson', label: '联系人' },
                    ],
                    onSearch: async (values) => {
                      let list: Customer[] = [];
                      try {
                        const res = await customerApi.list({ limit: 200, skip: 0 });
                        list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
                      } catch {
                        return [];
                      }
                      let filtered = list;
                      if (values.code?.trim()) {
                        const k = values.code.trim().toLowerCase();
                        filtered = filtered.filter((c) => (c.code ?? '').toLowerCase().includes(k));
                      }
                      if (values.name?.trim()) {
                        const k = values.name.trim().toLowerCase();
                        filtered = filtered.filter((c) => (c.name ?? '').toLowerCase().includes(k));
                      }
                      if (values.contactPerson?.trim()) {
                        const k = values.contactPerson.trim().toLowerCase();
                        filtered = filtered.filter((c) => (c.contactPerson ?? '').toLowerCase().includes(k));
                      }
                      return filtered.map((c) => ({
                        value: c.id,
                        label: `${c.code ?? ''} - ${c.name ?? ''}`.trim() || String(c.id),
                      }));
                    },
                  }}
                />
              </ProForm.Item>
            </Col>
            <Col span={6}>
              <ProFormText
                name="customer_contact"
                label="客户联系人"
                placeholder="请输入客户联系人"
              />
            </Col>
            <Col span={6}>
              <ProFormText
                name="customer_phone"
                label="客户电话"
                placeholder="请输入客户电话"
              />
            </Col>
            <Col span={6}>
              <ProForm.Item name="salesman_id" label={t('app.kuaizhizao.salesOrder.salesman')}>
                <UniDropdown
                  placeholder="请选择销售员"
                  showSearch
                  allowClear
                  loading={usersLoading}
                  style={{ width: '100%' }}
                  options={users.map((u) => ({
                    label: u.full_name ? `${u.full_name} (${u.username})` : u.username,
                    value: u.id,
                  }))}
                  onChange={(_val, opt: any) => {
                    formRef.current?.setFieldsValue({ salesman_name: opt?.label });
                  }}
                />
              </ProForm.Item>
              <AntForm.Item name="salesman_name" hidden><Input /></AntForm.Item>
            </Col>
            <Col span={12}>
              <ProFormText
                name="shipping_address"
                label="收货地址"
                placeholder="请输入收货地址"
              />
            </Col>
            <Col span={6}>
              <DictionarySelect
                dictionaryCode="SHIPPING_METHOD"
                name="shipping_method"
                label="发货方式"
                placeholder="请选择发货方式"
                formRef={formRef}
              />
            </Col>
            <Col span={6}>
              <DictionarySelect
                dictionaryCode="PAYMENT_TERMS"
                name="payment_terms"
                label="付款条件"
                placeholder="请选择付款条件"
                formRef={formRef}
              />
            </Col>
          </Row>


          {/* 订单明细：标题 + 价格类型开关 + 导入按钮 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
              <Space align="center" size={12}>
                <span style={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
                  <span style={{ color: '#ff4d4f', marginRight: 4, fontFamily: 'SimSun, sans-serif' }}>*</span>
                  {t('app.kuaizhizao.salesOrder.orderItems')}
                </span>
                <ProForm.Item
                  name="price_type"
                  initialValue="tax_exclusive"
                  noStyle
                  valuePropName="checked"
                  getValueProps={(v: string) => ({ checked: v === 'tax_inclusive' })}
                  getValueFromEvent={(checked: boolean) => (checked ? 'tax_inclusive' : 'tax_exclusive')}
                >
                  <Switch
                    checkedChildren={t('app.kuaizhizao.salesOrder.taxInclusive')}
                    unCheckedChildren={t('app.kuaizhizao.salesOrder.taxExclusive')}
                    onChange={handlePriceTypeToggle}
                  />
                </ProForm.Item>
              </Space>
              <Button 
                size="small" 
                type="link"
                icon={<ImportOutlined />} 
                onClick={() => setImportModalVisible(true)}
              >
                {t('app.kuaizhizao.salesOrder.importItems')}
              </Button>
            </div>
            <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.price_type !== curr?.price_type}>
              {({ getFieldValue: getFormValue }: any) => {
                const priceType = getFormValue('price_type') ?? 'tax_exclusive';
                const showTaxColumns = priceType === 'tax_inclusive';
                return (
            <AntForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: t('app.kuaizhizao.salesOrder.itemsRequired') }]}>
              <AntForm.List name="items">
                {(fields, { add, remove }) => {
                  const orderDetailColumns = [
                    {
                      title: t('app.kuaizhizao.salesOrder.material'),
                      dataIndex: 'material_id',
                      width: 260,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                          {({ getFieldValue }: any) => {
                            const row = getFieldValue('items')?.[index];
                            const mid = row?.material_id ? Number(row.material_id) : null;
                            const fallback = mid && (row?.material_code || row?.material_name)
                              ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                              : undefined;
                            return (
                              <div className="sales-order-material-cell" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
                                <MaterialInventoryIndicator
                                  materialId={mid}
                                  requiredQuantity={Number(row?.required_quantity) || 0}
                                />
                                <div style={{ flex: 1, minWidth: 200 }}>
                                  <UniMaterialSelect
                                    name={[index, 'material_id']}
                                    label=""
                                    placeholder="请选择物料"
                                    required
                                    size="small"
                                    listFieldKey={index}
                                    listFieldName="items"
                                    fillMapping={{
                                      material_code: 'mainCode',
                                      material_name: 'name',
                                      material_spec: 'specification',
                                      material_unit: 'baseUnit',
                                      unit_price: 'defaults.defaultSalePrice' as any,
                                    }}
                                    fallbackOption={fallback}
                                    formItemProps={{ style: { margin: 0 } }}
                                    showQuickCreate
                                    showAdvancedSearch
                                    onChange={(_val, material) => {
                                      if (material) {
                                        formRef.current?.setFieldValue(['items', index, '_sourceType'], (material as any)?.sourceType || (material as any)?.source_type);
                                      }
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
                      width: 140,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                          {({ getFieldValue }: any) => {
                            const row = getFieldValue('items')?.[index];
                            const mid = row?.material_id ? Number(row.material_id) : null;
                            const st = row?._sourceType ?? materials.find((m: any) => m.id === mid)?.sourceType ?? materials.find((m: any) => m.id === mid)?.source_type;
                            const isConfigure = st === 'Configure';
                            if (!isConfigure) return <span style={{ color: '#999' }}>-</span>;
                            return (
                              <AntForm.Item name={[index, 'variant_attributes']} style={{ margin: 0 }}>
                                <Input
                                  placeholder={t('app.kuaizhizao.salesOrder.variantAttributesPlaceholder')}
                                  size="small"
                                  allowClear
                                />
                              </AntForm.Item>
                            );
                          }}
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.spec'),
                      dataIndex: 'material_spec',
                      width: 120,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                          <Input placeholder="规格" size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.unit'),
                      dataIndex: 'material_unit',
                      width: 100,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                          {({ getFieldValue }) => {
                            const materialId = getFieldValue(['items', index, 'material_id']);
                            return (
                              <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                                <MaterialUnitSelect 
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
                      title: t('app.kuaizhizao.salesOrder.quantity'),
                      dataIndex: 'required_quantity',
                      width: 100,
                      align: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'required_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                          <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.unitPrice'),
                      dataIndex: 'unit_price',
                      width: 140,
                      align: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                          {({ getFieldValue }: any) => {
                            const materialId = getFieldValue(['items', index, 'material_id']);
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0, flex: 1 }}>
                                  <InputNumber placeholder={t('app.kuaizhizao.salesOrder.unitPricePlaceholder')} min={0} precision={2} prefix="¥" style={{ width: '100%' }} size="small" />
                                </AntForm.Item>
                                <Tooltip title="敏捷核价">
                                  <Button 
                                    size="small" 
                                    type="text" 
                                    icon={<CalculatorOutlined style={{ color: materialId ? '#1890ff' : '#ccc' }} />} 
                                    onClick={() => {
                                      if (materialId) {
                                        setQuoteMaterialId(materialId);
                                        setActiveItemIndex(index);
                                        setQuoteDrawerVisible(true);
                                      } else {
                                        messageApi.warning('请先选择物料');
                                      }
                                    }}
                                  />
                                </Tooltip>
                              </div>
                            );
                          }}
                        </AntForm.Item>
                      ),
                    },
                    ...(showTaxColumns
                      ? [
                          {
                            title: t('app.kuaizhizao.salesOrder.exclAmount'),
                            width: 110,
                            align: 'right' as const,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                {({ getFieldValue }: any) => {
                                  const items = getFieldValue('items') ?? [];
                                  const row = items[index];
                                  const line = calcSalesLineAmounts(
                                    row?.required_quantity,
                                    row?.unit_price,
                                    row?.tax_rate,
                                    priceType,
                                  );
                                  return <AmountDisplay resource="sales_order" value={line.excl} />;
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
                              <span>
                                {t('app.kuaizhizao.salesOrder.taxRate')}
                                <Button type="link" size="small" style={{ padding: '0 4px', height: 'auto' }} onClick={() => {
                                  const items = formRef.current?.getFieldValue('items') ?? [];
                                  if (items.length === 0) return;
                                  const rate = prompt(t('app.kuaizhizao.salesOrder.taxRateBatch'), '13');
                                  if (rate != null && rate !== '') {
                                    const num = parseFloat(rate);
                                    if (!isNaN(num) && num >= 0 && num <= 100) {
                                      const next = items.map((it: any) => ({ ...it, tax_rate: num }));
                                      formRef.current?.setFieldsValue({ items: next });
                                    }
                                  }
                                }}>
                                  {t('app.kuaizhizao.salesOrder.batch')}
                                </Button>
                              </span>
                            ),
                            dataIndex: 'tax_rate',
                            width: 100,
                            align: 'right' as const,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item name={[index, 'tax_rate']} initialValue={0} style={{ margin: 0 }}>
                                <InputNumber placeholder="0" min={0} max={100} precision={2} addonAfter="%" style={{ width: '100%' }} size="small" />
                              </AntForm.Item>
                            ),
                          },
                          {
                            title: t('app.kuaizhizao.salesOrder.taxAmount'),
                            width: 100,
                            align: 'right' as const,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                {({ getFieldValue }: any) => {
                                  const items = getFieldValue('items') ?? [];
                                  const row = items[index];
                                  const line = calcSalesLineAmounts(
                                    row?.required_quantity,
                                    row?.unit_price,
                                    row?.tax_rate,
                                    priceType,
                                  );
                                  return <AmountDisplay resource="sales_order" value={line.tax} />;
                                }}
                              </AntForm.Item>
                            ),
                          },
                        ]
                      : []),
                    {
                      title: t('app.kuaizhizao.salesOrder.inclAmount'),
                      width: 120,
                      align: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                          {({ getFieldValue }: any) => {
                            const items = getFieldValue('items') ?? [];
                            const row = items[index];
                            const qty = Number(row?.required_quantity) || 0;
                            const taxRate = Number(row?.tax_rate) || 0;
                            const line = calcSalesLineAmounts(
                              row?.required_quantity,
                              row?.unit_price,
                              row?.tax_rate,
                              priceType,
                            );
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
                                size="small"
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
                      width: 130,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'delivery_date']} rules={[{ required: true, message: '必填' }]} style={{ margin: 0 }}>
                          <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '操作',
                      width: 70,
                      fixed: 'right' as const,
                      onHeaderCell: () => ({ className: 'sales-order-fixed-op-header' }),
                      render: (_: any, __: any, index: number) => (
                        <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                          {t('app.kuaizhizao.salesOrder.delete')}
                        </Button>
                      ),
                    },
                  ];
                  const totalWidth = orderDetailColumns.reduce((s, c) => s + (c.width as number || 0), 0);
                  return (
                    <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                      <style>{`
                        .sales-order-detail-table .ant-table-thead > tr > th {
                          background-color: var(--ant-color-fill-alter) !important;
                          font-weight: 600;
                        }
                        /* 固定操作列表头：不透明背景，避免与下拉/相邻列重叠；使用主题变量以兼容暗色模式 */
                        .sales-order-detail-table .ant-table-thead > tr > th.sales-order-fixed-op-header {
                          background: var(--ant-color-fill-alter) !important;
                        }
                        /* 固定操作列 body 单元格背景，随主题变化（暗色模式不再亮白） */
                        .sales-order-detail-table .ant-table-cell-fix-right {
                          background: var(--ant-color-bg-container) !important;
                        }
                        .sales-order-detail-table .ant-table {
                          border-top: 1px solid var(--ant-color-border);
                        }
                        .sales-order-detail-table .ant-table-tbody > tr > td {
                          border-bottom: 1px solid var(--ant-color-border);
                          overflow: visible !important;
                        }
                        /* 物料列：确保 Select 占满可用宽度 */
                        .sales-order-detail-table .sales-order-material-cell .ant-form-item,
                        .sales-order-detail-table .sales-order-material-cell .ant-form-item-control,
                        .sales-order-detail-table .sales-order-material-cell .ant-form-item-control-input,
                        .sales-order-detail-table .sales-order-material-cell .ant-select {
                          width: 100% !important;
                          min-width: 0;
                        }
                        /* 明细行验证错误：仅红色边框提示，不显示文字 */
                        .sales-order-detail-table .ant-form-item-explain,
                        .sales-order-detail-table .ant-form-item-explain-error {
                          display: none !important;
                        }
                        /* 选中文字背景样式 */
                        .sales-order-detail-table .ant-input-number-input::selection,
                        .sales-order-detail-table .ant-input::selection {
                          background-color: var(--ant-color-primary);
                          color: #fff;
                          border-radius: 0;
                        }
                      `}</style>
                      <div style={{ width: '100%', overflowX: 'auto' }}>
                        <Table
                          className="sales-order-detail-table"
                          size="small"
                          dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                          rowKey="key"
                          pagination={false}
                          columns={orderDetailColumns}
                          scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                          style={{ width: '100%', margin: 0 }}
                          footer={() => (
                            <div
                              style={{
                                display: 'flex',
                                gap: 8,
                                width: '100%',
                                flexWrap: 'wrap',
                                boxSizing: 'border-box',
                              }}
                            >
                              <Button
                                type="dashed"
                                icon={<PlusOutlined />}
                                style={{ flex: 1, minWidth: 120 }}
                                onClick={() => {
                                  const mainDelivery = formRef.current?.getFieldValue('delivery_date');
                                  const defaultDelivery =
                                    mainDelivery != null
                                      ? dayjs.isDayjs(mainDelivery)
                                        ? mainDelivery
                                        : dayjs(mainDelivery)
                                      : dayjs();
                                  add({
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
                                }}
                              >
                                {t('app.kuaizhizao.salesOrder.addItem')}
                              </Button>
                              <Button
                                type="default"
                                icon={<AppstoreAddOutlined />}
                                style={{ flex: 1, minWidth: 120 }}
                                onClick={() => setMaterialPickerOpen(true)}
                              >
                                {t('app.kuaizhizao.salesOrder.selectProducts')}
                              </Button>
                            </div>
                          )}
                        />
                      </div>
                    </div>
                  );
                }}
              </AntForm.List>
            </AntForm.Item>
                );
              }}
            </AntForm.Item>
          </div>

        <FeeDetailsTable name="fee_details" label="费用明细（物流/包装等）" />

        <AntForm.Item
          noStyle
          shouldUpdate={(prev: any, curr: any) =>
            prev?.items !== curr?.items ||
            prev?.fee_details !== curr?.fee_details ||
            prev?.price_type !== curr?.price_type
          }
        >
          {({ getFieldValue }: { getFieldValue: (n: string) => any }) => (
            <SalesOrderFeeTotalsSummary getFieldValue={getFieldValue} />
          )}
        </AntForm.Item>

          <ProFormUploadButton
            name="attachments"
            label="附件"
            max={10}
            fieldProps={{
              multiple: true,
              customRequest: async (options) => {
                try {
                  const res = await uploadMultipleFiles([options.file as File], { category: 'sales_order_attachments' });
                  if (options.onSuccess) {
                    options.onSuccess(res[0], options.file as any);
                  }
                } catch (err) {
                  if (options.onError) {
                    options.onError(err as any);
                  }
                }
              }
            }}
          />

          <ProFormTextArea
            name="notes"
            label="备注"
            placeholder="请输入备注"
          />
        <MaterialBatchPickerModal
          open={materialPickerOpen}
          zIndex={nestedElevatedPopupZIndex}
          onCancel={() => setMaterialPickerOpen(false)}
          onConfirm={(selected) => {
            appendOrderItemsFromMaterials(selected);
            setMaterialPickerOpen(false);
          }}
        />
        <UniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleItemImport}
          title={t('app.kuaizhizao.salesOrder.importItemsTitle')}
          headers={[t('app.kuaizhizao.salesOrder.materialCode'), t('app.kuaizhizao.salesOrder.spec'), t('app.kuaizhizao.salesOrder.unit'), t('app.kuaizhizao.salesOrder.quantity'), t('app.kuaizhizao.salesOrder.unitPrice'), t('app.kuaizhizao.salesOrder.deliveryDate')]}
          exampleRow={['MAT001', 'Spec X', 'PCS', '100', '1.5', '2026-03-01']}
        />
      </FormModalTemplate>

      <CustomerFormModal
        open={customerCreateVisible}
        zIndex={nestedElevatedPopupZIndex}
        onClose={() => setCustomerCreateVisible(false)}
        editUuid={null}
        onSuccess={(customer) => {
          setCustomers((prev) => [...prev, customer]);
          const sId = customer.salesmanId ?? (customer as any).salesman_id;
          const salesman = users.find((u) => u.id === sId);
          const sName = customer.salesmanName ?? (customer as any).salesman_name ?? (salesman ? (salesman.full_name || salesman.username) : '');
          formRef.current?.setFieldsValue({
            customer_id: customer.id,
            customer_name: customer.name,
            customer_contact: customer.contactPerson ?? (customer as any).contact_person,
            customer_phone: customer.phone ?? (customer as any).customer_phone,
            salesman_id: sId,
            salesman_name: sName,
          });
          setCustomerCreateVisible(false);
        }}
      />

      {drawerVisible && currentSalesOrder?.id != null ? (
        <>
          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.relationsFullChainTitle')}
            style={{
              position: 'fixed',
              left: SALES_ORDER_FULL_CHAIN_FLOAT_MARGIN,
              top: SALES_ORDER_FULL_CHAIN_FLOAT_MARGIN,
              width: salesOrderChainPanelWidthCss,
              height: salesOrderChainHalfHeightCss,
              zIndex: salesOrderChainOverlayZIndex,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--ant-color-text)',
                    }}
                  >
                    {t('components.documentTrackingPanel.relationsFullChainTitle')}
                  </div>
                </div>
                <Button
                  type="default"
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={fullChainTraceLoading}
                  style={{ flexShrink: 0 }}
                  onClick={() => setFullChainRefreshKey((k) => k + 1)}
                >
                  {t('components.documentRelationGraph.refresh')}
                </Button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <DocumentTrackingRelationsTabsBody
                documentType="sales_order"
                documentId={currentSalesOrder.id}
                refreshKey={fullChainRefreshKey}
                onDocumentClick={onFullChainGraphNodeClick}
                compact
                hideInlineRefresh
                onTraceLoadingChange={setFullChainTraceLoading}
              />
            </div>
          </div>

          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.traceBriefTitle')}
            style={{
              position: 'fixed',
              left: SALES_ORDER_FULL_CHAIN_FLOAT_MARGIN,
              top: salesOrderBriefPanelTopCss,
              width: salesOrderChainPanelWidthCss,
              height: salesOrderChainHalfHeightCss,
              zIndex: salesOrderChainOverlayZIndex,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 8,
                flexShrink: 0,
                color: 'var(--ant-color-text)',
              }}
            >
              {t('components.documentTrackingPanel.traceBriefTitle')}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <TraceLinkedDocumentBrief
                documentType={fullChainBriefDoc?.document_type}
                documentId={fullChainBriefDoc?.document_id}
                compactChrome
              />
            </div>
            {fullChainBriefDoc ? (
              <div
                style={{
                  flexShrink: 0,
                  marginTop: 8,
                  paddingTop: 10,
                  borderTop: '1px solid var(--ant-color-border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <Space wrap>
                  <Button onClick={() => setFullChainBriefDoc(null)}>
                    {t('components.documentTrackingPanel.traceBriefDismiss')}
                  </Button>
                  {fullChainBriefDoc.document_type === 'quotation' ? (
                    <Button
                      type="primary"
                      onClick={() => {
                        setDrawerVisible(false);
                        navigate('/apps/kuaizhizao/sales-management/quotations', {
                          state: { openQuotationDetailId: fullChainBriefDoc.document_id },
                        });
                      }}
                    >
                      {t('components.documentTrackingPanel.traceBriefOpenQuotation')}
                    </Button>
                  ) : null}
                </Space>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {/* 详情抽屉：DetailDrawerTemplate + 与报价单一致的分区 */}
      {currentSalesOrder ? (
        <SalesOrderDetailProvider
          order={currentSalesOrder}
          auditRequired={auditEnabled}
          trackingRefreshKey={trackingRefreshKey}
          shippingMethodOptions={shippingMethodOptions}
          paymentTermsOptions={paymentTermsOptions}
          feeTypeOptions={feeTypeOptions}
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
              setFullChainBriefDoc(null);
            }}
            width={DRAWER_CONFIG.HALF_WIDTH}
            zIndex={salesOrderDetailDrawerZIndex}
            collaborationTitleSuffix={<SalesOrderDetailCollaborationTitleSuffix />}
            extra={
              <Space size="small">
                <Button icon={<BellOutlined />} onClick={handleOpenReminder}>
                  {t('app.kuaizhizao.salesOrder.reminder')}
                </Button>
                {(() => {
                  const lifecycle = getSalesOrderLifecycle(currentSalesOrder, auditEnabled);
                  const canEdit = ['草稿', '待审核', '已驳回'].includes(lifecycle.stageName ?? '');
                  const canDelete =
                    ['草稿', '待审核'].includes(lifecycle.stageName ?? '') ||
                    currentSalesOrder.status === SalesOrderStatus.DRAFT ||
                    currentSalesOrder.status === 'PENDING_REVIEW';
                  return (
                    <>
                      {canEdit && (
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
                      {canDelete && (
                        <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteSingle(currentSalesOrder.id!)}>
                          {t('app.kuaizhizao.salesOrder.delete')}
                        </Button>
                      )}
                    </>
                  );
                })()}
                <UniWorkflowActions
                  record={currentSalesOrder}
                  entityName={t('app.kuaizhizao.salesOrder.entityName')}
                  statusField="status"
                  reviewStatusField="review_status"
                  draftStatuses={[SalesOrderStatus.DRAFT]}
                  pendingStatuses={[ReviewStatus.PENDING, '待审核']}
                  approvedStatuses={[...APPROVED_STATUS_VALUES]}
                  rejectedStatuses={['已驳回', SalesOrderStatus.REJECTED]}
                  autoApproveWhenSubmit={!auditEnabled}
                  workflowAuditEnabled={auditEnabled}
                  theme="default"
                  actions={{
                    submit: async (id) => submitSalesOrder(id),
                    approve: approveSalesOrder,
                    revoke: unapproveSalesOrder,
                  }}
                  onSuccess={() => {
                    invalidateMenuBadge();
                    invalidateStatistics();
                    refreshDrawerOrder(currentSalesOrder?.id);
                  }}
                  confirmMessages={{
                    submit: auditEnabled
                      ? t('app.kuaizhizao.salesOrder.submitConfirmAudit')
                      : t('app.kuaizhizao.salesOrder.submitConfirmAuto'),
                  }}
                />
                {isApprovedRecord(currentSalesOrder) && (
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'computation',
                          label: t('app.kuaizhizao.salesOrder.demandComputation'),
                          icon: <ArrowDownOutlined />,
                          disabled: !canOpenDemandComputationPush(currentSalesOrder as SalesOrder, salesNodeEnabled.demand_computation),
                          onClick: () =>
                            canOpenDemandComputationPush(currentSalesOrder as SalesOrder, salesNodeEnabled.demand_computation) &&
                            handlePushToComputation(currentSalesOrder.id!, currentSalesOrder as SalesOrder),
                        },
                        {
                          key: 'workorder',
                          label: t('app.kuaizhizao.salesOrder.pushToWorkOrder'),
                          icon: <ArrowDownOutlined />,
                          disabled: !canOpenDirectWorkOrderPush(currentSalesOrder as SalesOrder, salesNodeEnabled.work_order),
                          onClick: () =>
                            canOpenDirectWorkOrderPush(currentSalesOrder as SalesOrder, salesNodeEnabled.work_order) &&
                            handlePushToWorkOrder(currentSalesOrder.id!, currentSalesOrder as SalesOrder),
                        },
                        { type: 'divider' },
                        {
                          key: 'shipment',
                          label: t('app.kuaizhizao.salesOrder.shipmentNotice'),
                          icon: <SendOutlined />,
                          disabled: !salesNodeEnabled.shipment_notice,
                          onClick: () => handlePushToShipmentNotice(currentSalesOrder.id!),
                        },
                        {
                          key: 'invoice',
                          label: t('app.kuaizhizao.salesOrder.salesInvoice'),
                          icon: <FileTextOutlined />,
                          disabled: !salesNodeEnabled.invoice,
                          onClick: () => handlePushToInvoice(currentSalesOrder.id!),
                        },
                        {
                          key: 'sales-return',
                          label: '下推销售退货单',
                          icon: <RollbackOutlined />,
                          onClick: () => handlePushToSalesReturn(currentSalesOrder.id!),
                        },
                      ],
                    }}
                  >
                    <Button icon={<ArrowDownOutlined />}>{t('app.kuaizhizao.salesOrder.push')}</Button>
                  </Dropdown>
                )}
                {isApprovedRecord(currentSalesOrder) && currentSalesOrder.pushed_to_computation && (
                  <Button icon={<RollbackOutlined />} onClick={() => handleWithdrawFromComputation(currentSalesOrder.id!)}>
                    {t('app.kuaizhizao.salesOrder.withdrawComputation')}
                  </Button>
                )}
              </Space>
            }
            basic={<SalesOrderDetailBasicPane />}
            collaboration={<SalesOrderDetailCollaborationPane />}
            lines={<SalesOrderDetailLinesPane />}
            timeline={<SalesOrderDetailTimelinePane />}
          />
        </SalesOrderDetailProvider>
      ) : null}

      <SyncFromDatasetModal
        open={syncModalVisible}
        zIndex={elevatedModalZIndex}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title={t('app.kuaizhizao.salesOrder.syncFromDataset')}
      />

      <AgileQuotingDrawer
        open={quoteDrawerVisible}
        zIndex={nestedElevatedPopupZIndex}
        materialId={quoteMaterialId}
        onClose={() => setQuoteDrawerVisible(false)}
        onAdopt={(price) => {
          if (activeItemIndex !== null) {
            const items = formRef.current?.getFieldValue('items') ?? [];
            const next = [...items];
            if (next[activeItemIndex]) {
              next[activeItemIndex] = { ...next[activeItemIndex], unit_price: price };
              formRef.current?.setFieldsValue({ items: next });
              messageApi.success('已采纳建议报价');
            }
          }
        }}
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
        title="下推销售退货单"
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
        okText="确认下推"
        width={720}
        destroyOnHidden
      >
        {pushToReturnOrder && (
          <>
            <p style={{ marginBottom: 12 }}>
              从销售订单 <strong>{pushToReturnOrder.order_code}</strong> 下推生成销售退货单，可调整各明细退货数量（不超过已交货数量）。
            </p>
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={8}>
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  value={pushToReturnWarehouseId}
                  onChange={(v) => setPushToReturnWarehouseId(Number(v) || undefined)}
                  placeholder="退货仓库ID"
                />
              </Col>
              <Col span={16}>
                <Input
                  value={pushToReturnWarehouseName}
                  onChange={(e) => setPushToReturnWarehouseName(e.target.value)}
                  placeholder="退货仓库名称（可选）"
                />
              </Col>
            </Row>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={(pushToReturnOrder.items || []).filter((it) => Number(it.delivered_quantity || 0) > 0)}
              columns={[
                { title: '物料编号', dataIndex: 'material_code', width: 120 },
                { title: '物料名称', dataIndex: 'material_name', width: 150 },
                { title: '订单数量', dataIndex: 'required_quantity', width: 100, align: 'right' },
                { title: '已交货', dataIndex: 'delivered_quantity', width: 100, align: 'right' },
                {
                  title: '退货数量',
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
        }}
        okText={t('app.kuaizhizao.salesOrder.confirmPush')}
        cancelText={t('common.cancel')}
        width={560}
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
            {pushPreviewData.plan_name_preview && (
              <p style={{ marginBottom: 8, color: 'var(--ant-color-text-secondary)' }}>
                {t('app.kuaizhizao.salesOrder.planName')}：{pushPreviewData.plan_name_preview}
              </p>
            )}
            {pushPreviewData.items?.length > 0 && (
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
            )}
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
    </>
  );
};

export default SalesOrdersPage;
