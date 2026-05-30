/**
 * 采购订单管理页面
 *
 * 提供采购订单的创建、编辑、查看和审批功能
 *
 * @author RiverEdge Team
 * @date 2025-12-30
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormUploadButton } from '@ant-design/pro-components';
import type { DescriptionsProps } from 'antd';
import { App, Button, Tag, Space, Modal, Row, Col, Table, Empty, Timeline, Divider, Form as AntForm, Input, InputNumber, DatePicker, Switch, List, Typography, theme, Dropdown, Descriptions, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleTwoTone, CloseCircleTwoTone, SendOutlined, DownOutlined, FileTextOutlined, InboxOutlined, DollarOutlined, RollbackOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import { apiRequest } from '../../../../../services/api';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { getFileDownloadUrl, uploadMultipleFiles } from '../../../../../services/file';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerInlineFullChain, DetailDrawerActions, MODAL_CONFIG, DRAWER_CONFIG, type StatCard } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { SimpleSparkline } from '../../../../../components';
import CodeField from '../../../../../components/code-field';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import type { Material } from '../../../../master-data/types/material';
import FeeDetailsTable from '../../../../../components/FeeDetailsTable';
import dayjs from 'dayjs';
import {
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder,
  deletePurchaseOrder, approvePurchaseOrder, submitPurchaseOrder,
  pushPurchaseOrderToReceipt, pushPurchaseOrderToReceiptPreview,
  pushPurchaseOrderToReceiptNotice, pushPurchaseOrderToInvoice, pushPurchaseOrderToPurchaseReturn,
  getPurchaseOrderStatistics, expeditePurchaseOrder,
  PurchaseOrder, PurchaseOrderItem
} from '../../../services/purchase';
import {
  listPurchaseRequisitions,
  getPurchaseRequisition,
  convertToPurchaseOrder,
  type PurchaseRequisition,
} from '../../../services/purchase-requisition';
import { listPurchaseOrderChangesByOrder, type PurchaseOrderChange } from '../../../services/purchase-order-change';
import { PriceHistoryInsight } from './ProcurementEmpowermentComponents';
import LandingCostAllocationModal from './LandingCostAllocationModal';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import {
  getMaterialDefaultTaxRate,
  pickPurchaseUnitPrice,
  resolveSupplierPurchasePricesBatch,
} from '../../../../master-data/utils/resolve-partner-material-price';
import { getApprovalStatus, ApprovalStatusResponse } from '../../../../../services/approvalInstance';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
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
import { getPurchaseOrderLifecycle, buildPurchaseOrderLifecycleValueEnum, resolvePurchaseOrderListLifecycleParams } from '../../../utils/purchaseOrderLifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import type { SubStage } from '../../../../../components/uni-lifecycle/types';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { SupplierFormModal } from '../../../../master-data/components/SupplierFormModal';
import { batchImport } from '../../../../../utils/batchOperations';
import { ROUTES } from '../../../constants/routes';
import { buildKuaizhizaoPullCreateMenuItems, getKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

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
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
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
  return renderRowActionsOverflow(nodes, keyPrefix);
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

function formatMoneyYuan(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `¥${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** 数值输入框宽度自适应：按内容长度估算，并限制在合理区间 */
function adaptiveNumberInputStyle(
  value: unknown,
  options?: { minCh?: number; maxCh?: number; extraCh?: number; reservePx?: number }
): React.CSSProperties {
  const minCh = options?.minCh ?? 8;
  const maxCh = options?.maxCh ?? 14;
  const extraCh = options?.extraCh ?? 3;
  const reservePx = options?.reservePx ?? 0;
  const text = String(value ?? '');
  const ch = Math.max(minCh, Math.min(maxCh, text.length + extraCh));
  return {
    width: reservePx > 0 ? `calc(${ch}ch + ${reservePx}px)` : `${ch}ch`,
    maxWidth: '100%',
  };
}

/** 与采购明细表格中价税逻辑一致，用于表单内实时汇总 */
function computePurchaseOrderFormTotals(
  items: any[] | undefined,
  feeDetails: any[] | undefined,
  priceType: string | undefined,
) {
  const pt = priceType ?? 'tax_exclusive';
  const rows = Array.isArray(items) ? items : [];
  let goodsExcl = 0;
  let taxAmount = 0;
  let goodsIncl = 0;

  for (const row of rows) {
    const qty = Number(row?.ordered_quantity) || 0;
    const price = Number(row?.unit_price) || 0;
    const taxRate = Number(row?.tax_rate) || 0;
    if (pt === 'tax_inclusive' && price > 0) {
      const exclAmt = (qty * price) / (1 + taxRate / 100);
      const taxAmt = exclAmt * (taxRate / 100);
      goodsExcl += exclAmt;
      taxAmount += taxAmt;
      goodsIncl += exclAmt + taxAmt;
    } else {
      const exclAmt = qty * price;
      goodsExcl += exclAmt;
      goodsIncl += exclAmt;
    }
  }

  let otherSideFees = 0;
  let ourSideFees = 0;
  for (const fee of feeDetails || []) {
    const amt = Number(fee?.amount) || 0;
    if (fee?.bearer === 'other_side') otherSideFees += amt;
    else ourSideFees += amt;
  }

  const estimatedPayable = goodsIncl + otherSideFees;
  // 对方承担费用不计入我方总成本
  const estimatedTotalCost = goodsIncl + ourSideFees;

  return {
    goodsExcl,
    taxAmount,
    goodsIncl,
    otherSideFees,
    ourSideFees,
    estimatedPayable,
    estimatedTotalCost,
  };
}

/** 费用明细下方：货值 / 税额 / 含税货值 / 对方费用 / 我方成本 / 预计应付 / 预计总成本 */
const PurchaseOrderFeeTotalsSummary: React.FC<{
  getFieldValue: (name: string) => any;
}> = ({ getFieldValue }) => {
  const { token } = theme.useToken();
  const sums = computePurchaseOrderFormTotals(
    getFieldValue('items'),
    getFieldValue('fee_details'),
    getFieldValue('price_type'),
  );

  const cells: { label: string; hint?: string; value: number; tone?: 'neutral' | 'our' | 'other' }[] = [
    { label: '货值', hint: '不含税货款合计', value: sums.goodsExcl, tone: 'neutral' },
    { label: '税额', value: sums.taxAmount, tone: 'neutral' },
    { label: '含税货值', value: sums.goodsIncl, tone: 'neutral' },
    { label: '对方费用', value: sums.otherSideFees, tone: 'other' },
    { label: '我方成本', value: sums.ourSideFees, tone: 'our' },
    { label: '预计应付', hint: '含税货值 + 对方费用', value: sums.estimatedPayable, tone: 'other' },
    { label: '预计总成本', hint: '含税货值 + 我方成本', value: sums.estimatedTotalCost, tone: 'our' },
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
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
        金额汇总
      </Typography.Text>
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
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: 1.3 }}>
              {c.label}
            </Typography.Text>
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

const ORDER_TYPE_FALLBACK: Array<{ label: string; value: string }> = [
  { label: '标准采购', value: '标准采购' },
  { label: '框架协议', value: '框架协议' },
];

const PurchaseOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const purchaseOrderAuditEnabled = useAuditRequired('purchase_order', false);
  const { token } = theme.useToken();
  const purchaseOrderDetailDrawerZIndex = token.zIndexPopupBase;
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const pullFromRequisitionAction = getKuaizhizaoDocumentAction('purchase_order.pull_from_requisition');
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const lastOrdersCacheRef = useRef<PurchaseOrder[]>([]);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const tableSearchFormRef = useRef<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<PurchaseOrder | null>(null);
  const formRef = useRef<any>(null);
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

  // 供应商列表、订单类型、币种
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [orderTypeOptions, setOrderTypeOptions] = useState<Array<{ label: string; value: string }>>(ORDER_TYPE_FALLBACK);
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
  const [supplierCreateVisible, setSupplierCreateVisible] = useState(false);
  const [pullFromRequisitionVisible, setPullFromRequisitionVisible] = useState(false);
  const [pullRequisitionLoading, setPullRequisitionLoading] = useState(false);
  const [pullRequisitionSubmitting, setPullRequisitionSubmitting] = useState(false);
  const [pullRequisitionKeyword, setPullRequisitionKeyword] = useState('');
  const [selectedPullRequisitionLineKeys, setSelectedPullRequisitionLineKeys] = useState<React.Key[]>([]);
  const [pullRequisitionLineCandidates, setPullRequisitionLineCandidates] = useState<PullPurchaseRequisitionLineCandidate[]>([]);

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
        setOrderTypeOptions(
          items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })),
        );
      } catch {
        setOrderTypeOptions(ORDER_TYPE_FALLBACK);
        messageApi.info('订单类型数据字典未配置，已使用内置选项');
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
        setCurrencyOptions([{ label: '人民币(CNY)', value: 'CNY' }, { label: '美元(USD)', value: 'USD' }, { label: '欧元(EUR)', value: 'EUR' }]);
      } finally {
        setCurrencyLoading(false);
      }
    };
    loadOrderType();
    loadCurrency();
  }, []);

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

      const current = formRef.current?.getFieldValue('items') ?? [];
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

  const [pushToReceiptOrder, setPushToReceiptOrder] = useState<PurchaseOrderDetail | null>(null);
  const [pushToReceiptQuantities, setPushToReceiptQuantities] = useState<Record<number, number>>({});
  const [pushToReceiptBatchNumbers, setPushToReceiptBatchNumbers] = useState<Record<number, string>>({});
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
  const columns: ProColumns<PurchaseOrder>[] = [
    {
      title: '供应商 / 订单',
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
      title: '订单编号',
      dataIndex: 'order_code',
      hideInTable: true,
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      hideInTable: true,
    },
    {
      title: '采购员',
      dataIndex: 'buyer_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '订单金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text: any) => `¥${formatAmount(text)}`,
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
    },
    {
      title: '生命周期',
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      fixed: 'right',
      align: 'left',
      valueType: 'select',
      valueEnum: lifecycleValueEnum,
      render: (_: any, record: PurchaseOrder) => {
        const lifecycle = getPurchaseOrderLifecycle(record, purchaseOrderAuditEnabled);
        const activeStage = lifecycle.mainStages?.find((s: SubStage) => s.status === 'active');
        const displayLabel = activeStage?.label ?? lifecycle.stageName;
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={displayLabel}
            status={lifecycle.status}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      hideInSearch: true,
      render: (_: any, record: PurchaseOrder) => {
        const parts: React.ReactNode[] = [
          <Button key="d" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>,
          <Button key="e" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>,
        ];
        if (isDraftStatus(record.status)) {
          parts.push(
            <Button key="submit" type="link" size="small" icon={<SendOutlined />} onClick={() => handleSubmitOrder(record)}>
              提交
            </Button>
          );
          parts.push(
            <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
              删除
            </Button>
          );
        }
        parts.push(
          <UniWorkflowActions
            key="wf"
            record={record}
            entityName="采购订单"
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={PO_WORKFLOW_DRAFT_STATUSES}
            pendingStatuses={PO_WORKFLOW_PENDING_STATUSES}
            approvedStatuses={PO_WORKFLOW_APPROVED_STATUSES}
            rejectedStatuses={PO_WORKFLOW_REJECTED_STATUSES}
            submitActionLabel="提交审核"
            theme="link"
            size="small"
            actions={{
              approve: (id) => approvePurchaseOrder(id, { approved: true, review_remarks: '' }),
              reject: (id, reason) => approvePurchaseOrder(id, { approved: false, review_remarks: reason || '' }),
            }}
            onSuccess={() => {
              invalidateStatistics();
              invalidateMenuBadgeCounts();

              actionRef.current?.reload();
            }}
          />
        );
        return renderPurchaseOrderRowActions(parts, `po-${record.id ?? 'row'}`);
      },
    },
  ];

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
    } catch (error) {
      messageApi.error('获取采购订单详情失败');
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
      const detail = await getPurchaseOrder(record.id!);
      const items = (detail.items || []).filter(
        (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
      );
      if (items.length === 0) {
        messageApi.warning('采购单已全部入库，无可下推明细');
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
      setPushToReceiptVisible(true);
      setPushToReceiptBatchNumbers({});
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
      messageApi.error('加载采购订单详情失败');
    }
  };

  // 确认下推入库
  const handlePushToReceiptConfirm = async () => {
    if (!pushToReceiptOrder?.id) return;
    const items = (pushToReceiptOrder.items || []).filter(
      (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
    );
    for (const it of items) {
      if (it.id == null) continue;
      const qty = pushToReceiptQuantities[it.id] ?? 0;
      const max = Number(it.outstanding_quantity ?? 0);
      if (qty <= 0) continue;
      if (qty > max) {
        messageApi.error(`物料 ${it.material_code || it.material_name} 的入库数量不能超过未入库数量 ${max}`);
        return;
      }
    }
    const batchNumbers: Record<number, string> = {};
    items.forEach((it: PurchaseOrderItem) => {
      if (it.id != null && (pushToReceiptQuantities[it.id] ?? 0) > 0 && pushToReceiptBatchNumbers[it.id]) {
        batchNumbers[it.id] = pushToReceiptBatchNumbers[it.id];
      }
    });
    setPushToReceiptLoading(true);
    try {
      const result = await pushPurchaseOrderToReceipt(pushToReceiptOrder.id, pushToReceiptQuantities, Object.keys(batchNumbers).length > 0 ? batchNumbers : undefined);
      messageApi.success(`成功生成采购入库单：${result.receipt_code || '已创建'}`);
      setPushToReceiptVisible(false);
      setPushToReceiptOrder(null);
      setPushToReceiptQuantities({});
      setPushToReceiptBatchNumbers({});
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (detailDrawerVisible && orderDetail?.id === pushToReceiptOrder.id) {
        getPurchaseOrder(pushToReceiptOrder.id).then(setOrderDetail);
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || '下推采购入库失败');
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
        messageApi.warning('采购单已全部入库，无可下推明细');
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
      messageApi.error('加载采购订单详情失败');
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
        messageApi.error(`物料 ${it.material_code || it.material_name} 的通知数量不能超过未入库数量 ${max}`);
        return;
      }
    }
    setPushToNoticeLoading(true);
    try {
      const result = await pushPurchaseOrderToReceiptNotice(pushToNoticeOrder.id, pushToNoticeQuantities);
      messageApi.success(`成功生成收货通知单：${result.notice_code || '已创建'}`);
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
      messageApi.error(error?.response?.data?.detail || error.message || '下推收货通知失败');
    } finally {
      setPushToNoticeLoading(false);
    }
  };

  // 下推采购发票（直接调用，无需数量选择）
  const handlePushToInvoice = async (record: PurchaseOrder) => {
    setPushToInvoiceLoading(true);
    try {
      const result = await pushPurchaseOrderToInvoice(record.id!);
      messageApi.success(`成功生成采购发票：${result.invoice_code || '已创建'}，请前往财务管理完善发票号码等信息`);
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      if (detailDrawerVisible && orderDetail?.id === record.id) {
        getPurchaseOrder(record.id!).then(setOrderDetail);
      }
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || '下推采购发票失败');
    } finally {
      setPushToInvoiceLoading(false);
    }
  };

  const handlePushToReturn = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      const items = (detail.items || []).filter((it: PurchaseOrderItem) => Number(it.received_quantity ?? 0) > 0);
      if (items.length === 0) {
        messageApi.warning('采购单暂无可退货数量（已到货数量为 0）');
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
      messageApi.error('加载采购订单详情失败');
    }
  };

  const handlePushToReturnConfirm = async () => {
    if (!pushToReturnOrder?.id) return;
    if (!pushToReturnWarehouseId || pushToReturnWarehouseId <= 0) {
      messageApi.warning('请先填写退货仓库ID');
      return;
    }
    const items = (pushToReturnOrder.items || []).filter((it: PurchaseOrderItem) => Number(it.received_quantity ?? 0) > 0);
    for (const it of items) {
      if (it.id == null) continue;
      const qty = pushToReturnQuantities[it.id] ?? 0;
      const max = Number(it.received_quantity ?? 0);
      if (qty <= 0) continue;
      if (qty > max) {
        messageApi.error(`物料 ${it.material_code || it.material_name} 的退货数量不能超过可退数量 ${max}`);
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
      messageApi.success(`成功生成采购退货单：${result.return_code || '已创建'}`);
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
      messageApi.error(error?.response?.data?.detail || error.message || '下推采购退货失败');
    } finally {
      setPushToReturnLoading(false);
    }
  };

  const selectedOrderForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return lastOrdersCacheRef.current.find((row) => row.id === id) ?? null;
  }, [selectedRowKeys]);

  const buildToolbarPushMenuItems = useCallback(
    (record: PurchaseOrder) => {
      const pushEnabled = isAuditedStatus(record.status);
      return buildUniPushMenuItems([
        {
          key: 'receipt-notice',
          label: '收货通知',
          icon: <FileTextOutlined />,
          disabled: !pushEnabled,
          onClick: () => {
            if (!pushEnabled) return;
            void handlePushToNotice(record);
          },
        },
        {
          key: 'receipt',
          label: '采购入库',
          icon: <InboxOutlined />,
          disabled: !pushEnabled,
          onClick: () => {
            if (!pushEnabled) return;
            void handlePushToReceipt(record);
          },
        },
        {
          key: 'invoice',
          label: '采购发票',
          icon: <DollarOutlined />,
          disabled: !pushEnabled,
          onClick: () => {
            if (!pushEnabled) return;
            void handlePushToInvoice(record);
          },
        },
        {
          key: 'purchase-return',
          label: '采购退货单',
          icon: <RollbackOutlined />,
          disabled: !pushEnabled,
          onClick: () => {
            if (!pushEnabled) return;
            void handlePushToReturn(record);
          },
        },
      ]);
    },
    [handlePushToInvoice, handlePushToNotice, handlePushToReceipt, handlePushToReturn],
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
      title: '删除采购订单',
      content: `确定要删除采购订单 "${record.order_code}" 吗？此操作不可恢复。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await deletePurchaseOrder(record.id!);
          messageApi.success('采购订单删除成功');
          invalidateStatistics();
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '采购订单删除失败');
        }
      },
    });
  };

  const handleSubmitOrder = (record: PurchaseOrder) => {
    if (!record.id) return;
    Modal.confirm({
      title: '提交采购订单',
      content: '确认提交该采购订单吗？',
      onOk: async () => {
        try {
          await submitPurchaseOrder(record.id!);
          messageApi.success('提交成功');
          invalidateStatistics();
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          if (detailDrawerVisible && orderDetail?.id === record.id) {
            const refreshed = await getPurchaseOrder(record.id!);
            setOrderDetail(refreshed);
          }
        } catch (error: any) {
          messageApi.error(error?.message || '提交失败');
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条采购订单吗？`,
      okType: 'danger',
      onOk: async () => {
        try {
          for (const k of keys) {
            await deletePurchaseOrder(Number(k));
          }
          messageApi.success(`已删除 ${keys.length} 条采购订单`);
          setSelectedRowKeys([]);
          invalidateStatistics();
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
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
      messageApi.success(`已同步 ${successCount} 条采购订单`);
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
  };

  const handleListImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning('导入数据为空或格式不正确');
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''));

    if (rows.length === 0) {
      messageApi.warning('没有可导入的数据行（请从第3行开始填写）');
      return;
    }

    const col = (name: string) => headers.findIndex((h: string) => (h || '').replace(/\*+/, '').trim() === name || (h || '').trim() === name);
    const idx = {
      code: col('订单编号') >= 0 ? col('订单编号') : col('编号'),
      supplier: col('供应商名称') >= 0 ? col('供应商名称') : col('供应商'),
      date: col('订单日期') >= 0 ? col('订单日期') : col('日期'),
      material: col('物料编号') >= 0 ? col('物料编号') : col('物料'),
      qty: col('数量') >= 0 ? col('数量') : -1,
      price: col('单价') >= 0 ? col('单价') : -1,
      delivery: col('交货日期') >= 0 ? col('交货日期') : -1,
      notes: col('备注') >= 0 ? col('备注') : -1,
    };

    if (idx.supplier < 0 || idx.date < 0 || idx.material < 0 || idx.qty < 0) {
      messageApi.error('缺少必需列：供应商名称、订单日期、物料编号、数量');
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
        errors.push({ row: rowNum, message: '供应商名称不能为空' });
        return;
      }
      if (!dateVal) {
        errors.push({ row: rowNum, message: '订单日期不能为空' });
        return;
      }
      if (!materialCode) {
        errors.push({ row: rowNum, message: '物料编号不能为空' });
        return;
      }
      if (isNaN(qty) || qty <= 0) {
        errors.push({ row: rowNum, message: '数量必须大于0' });
        return;
      }

      const mat = (Array.isArray(matList) ? matList : []).find((m: any) => (m.mainCode || m.code || '').toUpperCase() === materialCode.toUpperCase());
      if (!mat) {
        errors.push({ row: rowNum, message: `未找到物料：${materialCode}` });
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
        title: '数据验证失败',
        width: 600,
        content: (
          <div>
            <p>以下行存在错误，请修正后重新导入：</p>
            <List size="small" dataSource={errors} renderItem={(item) => (
              <List.Item><Typography.Text type="danger">第 {item.row} 行：{item.message}</Typography.Text></List.Item>
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
      messageApi.warning('没有可导入的数据');
      return;
    }

    try {
      const result = await batchImport({
        items: toImport,
        importFn: async (item) => createPurchaseOrder(item),
        title: '正在导入采购订单',
        concurrency: 3,
      });

      if (result.failureCount > 0) {
        Modal.warning({
          title: '导入完成（部分失败）',
          width: 600,
          content: (
            <div>
              <p><strong>导入结果：成功 {result.successCount} 条，失败 {result.failureCount} 条</strong></p>
              {result.errors.length > 0 && (
                <List size="small" dataSource={result.errors} renderItem={(e) => (
                  <List.Item><Typography.Text type="danger">第 {e.row} 行：{e.error}</Typography.Text></List.Item>
                )} />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(`成功导入 ${result.successCount} 条采购订单`);
      }
      if (result.successCount > 0) {
        invalidateStatistics();
        invalidateMenuBadgeCounts();

        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || '导入失败');
    }
  };

  // 处理编辑
  const handleEdit = async (record: PurchaseOrder) => {
    try {
      const detail = await getPurchaseOrder(record.id!);
      setIsEdit(true);
      setCurrentOrder(detail);
      setModalVisible(true);
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
      }, 100);
    } catch (error) {
      messageApi.error('获取采购订单详情失败');
    }
  };

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOrder(null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({ items: [defaultOrderItem], price_type: 'tax_exclusive' });
    }, 0);
  };

  const loadPullRequisitionCandidates = async (keyword: string = '') => {
    setPullRequisitionLoading(true);
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
      setPullRequisitionLineCandidates(details.flat());
    } catch (error: any) {
      messageApi.error(error?.message || '加载采购申请列表失败');
      setPullRequisitionLineCandidates([]);
    } finally {
      setPullRequisitionLoading(false);
    }
  };

  const handlePullFromRequisition = () => {
    setPullRequisitionKeyword('');
    setSelectedPullRequisitionLineKeys([]);
    setPullRequisitionLineCandidates([]);
    setPullFromRequisitionVisible(true);
    loadPullRequisitionCandidates('');
  };

  const handlePullFromRequisitionConfirm = async () => {
    const selectedLines = pullRequisitionLineCandidates.filter((line) => selectedPullRequisitionLineKeys.includes(line.key));
    if (!selectedLines.length) {
      messageApi.warning('请先选择采购申请明细');
      return;
    }
    try {
      setPullRequisitionSubmitting(true);
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

      messageApi.success(createdCodes.length ? `已创建${pullFromRequisitionAction.targetLabel}：${createdCodes.join('、')}` : `已从${pullFromRequisitionAction.sourceLabel}明细创建${pullFromRequisitionAction.targetLabel}`);
      setPullFromRequisitionVisible(false);
      invalidateMenuBadgeCounts();
      invalidateStatistics();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error?.message || `从${pullFromRequisitionAction.sourceLabel}创建${pullFromRequisitionAction.targetLabel}失败`);
    } finally {
      setPullRequisitionSubmitting(false);
    }
  };

  // 处理表单提交（创建/更新）
  const handleFormSubmit = async (values: any): Promise<void> => {
    try {
      const validItems = (values.items ?? []).filter(
        (it: any) => it.material_id && (Number(it.ordered_quantity) || 0) > 0
      );
      if (!validItems.length) {
        messageApi.error('请至少添加一条有效采购明细（选择物料并填写数量）');
        throw new Error('请至少添加一条有效采购明细');
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
          messageApi.error(`第 ${validItems.indexOf(it) + 1} 行：请选择要求到货日期`);
          throw new Error('请填写要求到货日期');
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
      const feeDetails = values.fee_details ?? [];
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
          messageApi.success('采购订单更新成功');
        }
      } else {
        const created = await createPurchaseOrder({ ...data, items: itemsPayload });
        orderId = (created as any)?.id;
        if (!submitAfterSaveRef.current) {
          messageApi.success('采购订单创建成功');
        }
      }

      if (submitAfterSaveRef.current && orderId) {
        try {
          const afterSubmit = await submitPurchaseOrder(orderId);
          const st = (afterSubmit as PurchaseOrder | undefined)?.status;
          if (isAuditedStatus(st)) {
            messageApi.success(isEdit ? '采购订单已保存并提交，已自动审核通过' : '采购订单已创建并提交，已自动审核通过');
          } else {
            messageApi.success(isEdit ? '采购订单已保存并提交审核' : '采购订单已创建并提交审核');
          }
        } catch (submitErr: any) {
          messageApi.warning(`保存成功，但提交失败：${submitErr?.message || '未知错误'}。您可在列表中点击「提交审核」重试。`);
        }
        submitAfterSaveRef.current = false;
      }

      setModalVisible(false);
      invalidateStatistics();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      submitAfterSaveRef.current = false;
      if (error?.message && !error.message.includes('请至少添加') && !error.message.includes('要求到货')) {
        messageApi.error(error.message || '操作失败');
      }
      throw error;
    }
  };

  // 详情列定义
  const detailColumns: ProDescriptionsItemProps<PurchaseOrderDetail>[] = [
    {
      title: '订单编号',
      dataIndex: 'order_code',
      render: (_: unknown, entity: PurchaseOrderDetail) => (
        <Typography.Text copyable={{ text: String(entity.order_code ?? '') }}>{entity.order_code ?? '-'}</Typography.Text>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      render: (_: unknown, entity: PurchaseOrderDetail) => entity.supplier_name ?? '—',
    },
    {
      title: '订单类型',
      dataIndex: 'order_type',
    },
    {
      title: '订单日期',
      dataIndex: 'order_date',
      valueType: 'date',
    },
    {
      title: '交货日期',
      dataIndex: 'delivery_date',
      valueType: 'date',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: any) => {
        const config = getStatusDisplay(status);
        return <Tag {...resolveStatusTagDisplayProps(config)}>{config.text}</Tag> as any;
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      render: (status: any) => {
        const config = getReviewStatusDisplay(status);
        return <Tag color={config.color}>{config.text}</Tag> as any;
      },
    },
    {
      title: '订单金额',
      dataIndex: 'total_amount',
      render: (text: any) => `¥${formatAmount(text)}`,
    },
    {
      title: '税率',
      dataIndex: 'tax_rate',
      render: (text: any) => text ? `${text}%` : '-',
    },
    {
      title: '税额',
      dataIndex: 'tax_amount',
      render: (text: any) => (text != null && text !== '') ? `¥${formatAmount(text)}` : '-',
    },
    {
      title: '含税金额',
      dataIndex: 'net_amount',
      render: (text: any) => (text != null && text !== '') ? `¥${formatAmount(text)}` : '-',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      span: 3,
      render: (text: any) => text || '-',
    },
  ];

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
                  tableSearchFormRef.current?.setFieldsValue?.({ lifecycle: '待审核' });
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

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<PurchaseOrder>
          columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-orders"
          headerTitle="采购订单"
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton={false}
          createButtonText="新建采购订单"
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-purchase-order-with-pull"
              createIcon={<PlusOutlined />}
              createLabel="新建采购订单"
              onCreate={handleCreate}
              menuItems={buildKuaizhizaoPullCreateMenuItems([
                {
                  key: 'pull-from-requisition',
                  actionKey: 'purchase_order.pull_from_requisition',
                  onClick: handlePullFromRequisition,
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
          showDeleteButton
          onDelete={handleBatchDelete}
          showImportButton={true}
          onImport={handleListImport}
          importHeaders={['订单编号', '供应商名称', '订单日期', '物料编号', '数量', '单价', '交货日期', '备注']}
          importExampleRow={['PO001', '供应商A', '2025-03-08', 'MAT001', '10', '100', '2025-04-01', '']}
          importFieldMap={{
            '订单编号': 'order_code',
            '供应商名称': 'supplier_name',
            '订单日期': 'order_date',
            '物料编号': 'material_code',
            '数量': 'ordered_quantity',
            '单价': 'unit_price',
            '交货日期': 'delivery_date',
            '备注': 'notes',
          }}
          importFieldRules={{
            supplier_name: { required: true },
            order_date: { required: true },
            material_code: { required: true },
            ordered_quantity: { required: true },
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
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new window.Blob([window.JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `purchase-orders-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              window.URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
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
              lastOrdersCacheRef.current = response.data || [];
              return {
                data: response.data || [],
                success: response.success !== false,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取采购订单列表失败');
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

      <Modal
        title={pullFromRequisitionAction.label}
        open={pullFromRequisitionVisible}
        width={MODAL_CONFIG.LARGE_WIDTH}
        onCancel={() => setPullFromRequisitionVisible(false)}
        onOk={handlePullFromRequisitionConfirm}
        okText="创建采购订单"
        cancelText="取消"
        okButtonProps={{ disabled: selectedPullRequisitionLineKeys.length === 0 || pullRequisitionLoading }}
        confirmLoading={pullRequisitionSubmitting}
        destroyOnHidden
      >
        <Space orientation="vertical" style={{ width: '100%', marginTop: 12 }} size={12}>
          <Input.Search
            allowClear
            value={pullRequisitionKeyword}
            placeholder="搜索采购申请明细（申请单号/申请名称）"
            enterButton="搜索"
            onChange={(e) => setPullRequisitionKeyword(e.target.value)}
            onSearch={(value) => {
              const keyword = value?.trim?.() || '';
              setPullRequisitionKeyword(keyword);
              loadPullRequisitionCandidates(keyword);
            }}
          />
          <Table<PullPurchaseRequisitionLineCandidate>
            rowKey="key"
            loading={pullRequisitionLoading}
            size="small"
            pagination={false}
            locale={{ emptyText: pullRequisitionKeyword ? '未找到匹配采购申请明细' : '暂无可选采购申请明细' }}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedPullRequisitionLineKeys,
              onChange: (keys) => {
                setSelectedPullRequisitionLineKeys(keys);
              },
              getCheckboxProps: (record) => ({
                disabled: record.converted,
              }),
            }}
            onRow={(record) => ({
              onClick: () => {
                if (record.converted) return;
                const selected = selectedPullRequisitionLineKeys.includes(record.key);
                setSelectedPullRequisitionLineKeys((prev) =>
                  selected ? prev.filter((k) => k !== record.key) : [...prev, record.key],
                );
              },
            })}
            columns={[
              { title: '申请单号', dataIndex: 'requisition_code', width: 170 },
              { title: '申请名称', dataIndex: 'requisition_name', width: 160, ellipsis: true, render: (v: string) => v || '-' },
              { title: '物料编码', dataIndex: 'material_code', width: 140, ellipsis: true, render: (v: string) => v || '-' },
              { title: '物料名称', dataIndex: 'material_name', width: 170, ellipsis: true, render: (v: string) => v || '-' },
              { title: '规格', dataIndex: 'material_spec', width: 140, ellipsis: true, render: (v: string) => v || '-' },
              { title: '数量', dataIndex: 'quantity', width: 90, align: 'right' },
              { title: '单位', dataIndex: 'unit', width: 70, render: (v: string) => v || '-' },
              { title: '需求日期', dataIndex: 'required_date', width: 120, render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
              { title: '申请人', dataIndex: 'applicant_name', width: 100, render: (v: string) => v || '-' },
              {
                title: '状态',
                dataIndex: 'requisition_status',
                width: 100,
                render: (v: string) => <Tag color={v?.includes('转单') ? 'gold' : 'blue'}>{v || '-'}</Tag>,
              },
              {
                title: '审核',
                dataIndex: 'review_status',
                width: 100,
                render: (v: string) => {
                  const approved = v === 'APPROVED' || v === '已通过' || v === '审核通过';
                  const rejected = v === 'REJECTED' || v === '已驳回';
                  return <Tag color={approved ? 'green' : rejected ? 'red' : 'default'}>{v || '-'}</Tag>;
                },
              },
              {
                title: '供应商',
                width: 160,
                render: (_: unknown, record: PullPurchaseRequisitionLineCandidate) =>
                  record.supplier_id ? `已指定(${record.supplier_id})` : '待定（草稿中补充）',
              },
              {
                title: '转单状态',
                width: 180,
                render: (_: unknown, record: PullPurchaseRequisitionLineCandidate) =>
                  record.converted ? (
                    <Tag color="gold">已转采购订单#{record.purchase_order_id}</Tag>
                  ) : (
                    <Tag color="green">可转单</Tag>
                  ),
              },
            ]}
            dataSource={pullRequisitionLineCandidates}
            scroll={{ x: 1600, y: 320 }}
          />
          <Typography.Text type="secondary">
            已选择 {selectedPullRequisitionLineKeys.length} 条明细，将按采购申请与供应商自动拆分创建采购订单草稿。
          </Typography.Text>
        </Space>
      </Modal>

      {/* 创建/编辑采购订单 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑采购订单' : '新建采购订单'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentOrder(null);
          submitAfterSaveRef.current = false;
          formRef.current?.resetFields();
        }}
        onFinish={handleFormSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
        initialValues={!isEdit ? { items: [defaultOrderItem] } : undefined}
        extraFooter={
          (isEdit && isDraftStatus(currentOrder?.status)) || !isEdit ? (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={async () => {
                try {
                  await formRef.current?.validateFields();
                  submitAfterSaveRef.current = true;
                  formRef.current?.submit();
                } catch (err: any) {
                  if (err?.errorFields?.length) {
                    messageApi.warning('请完善必填项后再提交');
                  }
                }
              }}
            >
              {isEdit ? '保存并提交' : '创建并提交'}
            </Button>
          ) : undefined
        }
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-purchase-order"
              name="order_code"
              label="采购订单编号"
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
              label="订单日期"
              placeholder="请选择订单日期"
              rules={[{ required: true, message: '请选择订单日期' }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={6}>
            <ProFormDatePicker
              name="delivery_date"
              label="要求到货日期"
              placeholder="请选择要求到货日期"
              rules={[{ required: true, message: '请选择要求到货日期' }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProForm.Item
              name="supplier_id"
              label="供应商"
              rules={[{ required: true, message: '请选择供应商' }]}
            >
              <UniDropdown
                placeholder="请选择供应商"
                showSearch
                allowClear
                loading={suppliersLoading}
                style={{ width: '100%' }}
                options={supplierList.map((s: any) => ({
                  value: s.id ?? s.supplier_id,
                  label: `${s.code ?? s.supplier_code ?? ''} - ${s.name ?? s.supplier_name ?? ''}`.trim() || String(s.id ?? s.supplier_id),
                }))}
                onChange={(v) => {
                  const s = supplierList.find((x: any) => (x.id ?? x.supplier_id) === v);
                  if (s) {
                    formRef.current?.setFieldsValue({
                      supplier_name: s.name ?? s.supplier_name,
                      supplier_contact: s.contact_person ?? s.contactPerson ?? s.supplier_contact,
                      supplier_phone: s.phone ?? s.supplier_phone,
                      buyer_id: s.buyerId || s.buyer_id,
                      buyer_name: s.buyerName || s.buyer_name,
                    });
                  }
                }}
                quickCreate={{
                  label: '快速新建',
                  onClick: () => setSupplierCreateVisible(true),
                }}
                advancedSearch={{
                  label: '高级搜索',
                  fields: [
                    { name: 'code', label: '供应商编号' },
                    { name: 'name', label: '供应商名称' },
                    { name: 'contact_person', label: '联系人' },
                  ],
                  onSearch: async (values) => {
                    try {
                      // 这里假设 supplierApi.list 支持这些过滤参数，通常后端是支持的
                      const res = await supplierApi.list({ ...values, limit: 100 });
                      const list = Array.isArray(res) ? res : (res as any)?.data || [];
                      return list.map((s: any) => ({
                        value: s.id ?? s.supplier_id,
                        label: `${s.code ?? s.supplier_code ?? ''} - ${s.name ?? s.supplier_name ?? ''}`.trim() || String(s.id ?? s.supplier_id),
                      }));
                    } catch {
                      return [];
                    }
                  },
                }}
              />
            </ProForm.Item>
          </Col>
          <Col span={6}>
            <ProFormText
              name="supplier_contact"
              label="联系人"
              placeholder="请输入联系人"
            />
          </Col>
          <Col span={6}>
            <ProFormText
              name="supplier_phone"
              label="联系电话"
              placeholder="请输入联系电话"
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProForm.Item name="order_type" label="订单类型" initialValue="标准采购">
              <UniDropdown
                placeholder="请选择订单类型"
                options={orderTypeOptions}
                loading={orderTypeLoading}
              />
            </ProForm.Item>
          </Col>
          <Col span={6}>
            <ProForm.Item name="buyer_id" label="采购员">
              <UniDropdown
                placeholder="请选择采购员"
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
            <ProForm.Item name="currency" label="币种" initialValue="CNY">
              <UniDropdown
                placeholder="请选择币种"
                options={currencyOptions}
                loading={currencyLoading}
              />
            </ProForm.Item>
          </Col>
          <Col span={12} />
        </Row>

        {/* 已生效/执行中订单须通过变更单修改，不再支持直改填写变更原因 */}
        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.price_type !== curr?.price_type}>
          {({ getFieldValue: getFormValue }: any) => {
            const priceType = getFormValue('price_type') ?? 'tax_exclusive';
            const showTaxColumns = priceType === 'tax_inclusive';
            return (
              <UniTableDetail
                name="items"
                title="采购明细"
                required
                requiredMessage="请至少添加一条采购明细"
                leftExtra={(
                  <ProForm.Item
                    name="price_type"
                    initialValue="tax_exclusive"
                    noStyle
                    valuePropName="checked"
                    getValueProps={(v: string) => ({ checked: v === 'tax_inclusive' })}
                    getValueFromEvent={(checked: boolean) => (checked ? 'tax_inclusive' : 'tax_exclusive')}
                  >
                    <Switch checkedChildren="含税" unCheckedChildren="不含税" />
                  </ProForm.Item>
                )}
                headerExtra={(
                  <Space size={8}>
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        const mainDelivery = formRef.current?.getFieldValue('delivery_date');
                        const defaultDate =
                          mainDelivery != null
                            ? dayjs.isDayjs(mainDelivery)
                              ? mainDelivery
                              : dayjs(mainDelivery)
                            : dayjs();
                        const items = [...(formRef.current?.getFieldValue('items') ?? [])];
                        items.push({
                          ...defaultOrderItem,
                          tax_rate: 0,
                          required_date: defaultDate,
                        });
                        formRef.current?.setFieldsValue({ items });
                      }}
                    >
                      添加明细
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
                  title: '物料',
                  dataIndex: 'material_id',
                  width: 250,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback = mid && (row?.material_code || row?.material_name)
                            ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                            : undefined;
                          return (
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
                    title: '规格',
                    dataIndex: 'material_spec',
                    width: 120,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                        <Input placeholder="规格" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '单位',
                    dataIndex: 'unit',
                    width: 100,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                        {({ getFieldValue }) => {
                          const materialId = getFieldValue(['items', index, 'material_id']);
                          return (
                            <AntForm.Item name={[index, 'unit']} style={{ margin: 0 }}>
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
                    title: '数量',
                    dataIndex: 'ordered_quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'ordered_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                        <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: showTaxColumns ? '含税单价' : '单价',
                    dataIndex: 'unit_price',
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) =>
                          prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id ||
                          prev?.items?.[index]?.unit_price !== curr?.items?.[index]?.unit_price
                        }
                      >
                        {({ getFieldValue }: any) => {
                          const items = getFieldValue('items') ?? [];
                          const row = items[index];
                          return (
                            <Space size={4}>
                              <AntForm.Item name={[index, 'unit_price']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0, message: '≥0' }]} style={{ margin: 0 }}>
                                <InputNumber
                                  placeholder={showTaxColumns ? '含税单价' : '单价'}
                                  min={0}
                                  precision={2}
                                  prefix="¥"
                                  style={adaptiveNumberInputStyle(row?.unit_price, { minCh: 9, maxCh: 16, extraCh: 5, reservePx: 28 })}
                                  size="small"
                                />
                              </AntForm.Item>
                              {row?.material_id && <PriceHistoryInsight materialId={row.material_id} currentPrice={Number(row.unit_price) || 0} />}
                            </Space>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  ...(showTaxColumns
                    ? [
                        {
                          title: '不含税金额',
                          align: 'right' as const,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                              {({ getFieldValue }: any) => {
                                const items = getFieldValue('items') ?? [];
                                const row = items[index];
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
                            <span>
                              税率(%)
                              <Button
                                type="link"
                                size="small"
                                style={{ padding: '0 4px', height: 'auto' }}
                                onClick={() => {
                                  const items = formRef.current?.getFieldValue('items') ?? [];
                                  if (items.length === 0) return;
                                  const rate = prompt('批量设置税率', '13');
                                  if (rate != null && rate !== '') {
                                    const num = parseFloat(rate);
                                    if (!isNaN(num) && num >= 0 && num <= 100) {
                                      const next = items.map((it: any) => ({ ...it, tax_rate: num }));
                                      formRef.current?.setFieldsValue({ items: next });
                                    }
                                  }
                                }}
                              >
                                批量
                              </Button>
                            </span>
                          ),
                          dataIndex: 'tax_rate',
                          align: 'right' as const,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index]?.tax_rate !== curr?.items?.[index]?.tax_rate}>
                              {({ getFieldValue }: any) => {
                                const items = getFieldValue('items') ?? [];
                                const row = items[index];
                                return (
                                  <AntForm.Item name={[index, 'tax_rate']} initialValue={0} style={{ margin: 0 }}>
                                    <InputNumber
                                      placeholder="0"
                                      min={0}
                                      max={100}
                                      precision={2}
                                      addonAfter="%"
                                      style={adaptiveNumberInputStyle(row?.tax_rate, { minCh: 7, maxCh: 11, extraCh: 3 })}
                                      size="small"
                                    />
                                  </AntForm.Item>
                                );
                              }}
                            </AntForm.Item>
                          ),
                        },
                        {
                          title: '税额',
                          align: 'right' as const,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                              {({ getFieldValue }: any) => {
                                const items = getFieldValue('items') ?? [];
                                const row = items[index];
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
                    title: showTaxColumns ? '价税合计' : '总价',
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                        {({ getFieldValue }: any) => {
                          const items = getFieldValue('items') ?? [];
                          const row = items[index];
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
                    title: '要求到货',
                    dataIndex: 'required_date',
                    width: 120,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'required_date']} rules={[{ required: true, message: '必填' }]} style={{ margin: 0 }}>
                        <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                      </AntForm.Item>
                    ),
                  },
                ]}
                disabledAdd
                minRows={1}
                initialValue={{ ...defaultOrderItem, tax_rate: 0, required_date: dayjs() }}
                tableProps={{
                  size: 'small',
                  tableLayout: 'auto',
                  scroll: { x: 'max-content' },
                }}
              />
            );
          }}
        </AntForm.Item>

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
            <PurchaseOrderFeeTotalsSummary getFieldValue={getFieldValue} />
          )}
        </AntForm.Item>

        <ProFormText name="supplier_name" hidden />
        <ProFormUploadButton
          name="attachments"
          label="附件"
          max={10}
          fieldProps={{
            multiple: true,
            customRequest: async (options) => {
              try {
                const res = await uploadMultipleFiles([options.file as File], { category: 'purchase_order_attachments' });
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
          placeholder="请输入备注信息"
          fieldProps={{ rows: 3 }}
        />
        <UniMaterialBatchPicker
          open={materialPickerOpen}
          onCancel={() => setMaterialPickerOpen(false)}
          onConfirm={appendPurchaseItemsFromMaterials}
        />
      </FormModalTemplate>

      <SupplierFormModal
        open={supplierCreateVisible}
        onClose={() => setSupplierCreateVisible(false)}
        editUuid={null}
        onSuccess={(supplier) => {
          setSupplierList((prev) => [...prev, supplier]);
          formRef.current?.setFieldsValue({
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            supplier_contact: supplier.contactPerson,
            supplier_phone: supplier.phone,
          });
          setSupplierCreateVisible(false);
        }}
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
        title={`采购订单详情 - ${orderDetail?.order_code || ''}`}
        open={detailDrawerVisible}
        zIndex={purchaseOrderDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setOrderDetail(null);
          setApprovalStatus(null);
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
                  visible: isDraftStatus(orderDetail.status),
                  render: () => (
                    <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setDetailDrawerVisible(false); handleEdit(orderDetail); }}>
                      编辑
                    </Button>
                  ),
                },
                {
                  key: 'submit',
                  visible: isDraftStatus(orderDetail.status),
                  render: () => (
                    <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleSubmitOrder(orderDetail)}>
                      提交
                    </Button>
                  ),
                },
                {
                  key: 'workflow',
                  render: () => (
                    <UniWorkflowActions
                      record={orderDetail}
                      entityName="采购订单"
                      statusField="status"
                      reviewStatusField="review_status"
                      draftStatuses={PO_WORKFLOW_DRAFT_STATUSES}
                      pendingStatuses={PO_WORKFLOW_PENDING_STATUSES}
                      approvedStatuses={PO_WORKFLOW_APPROVED_STATUSES}
                      rejectedStatuses={PO_WORKFLOW_REJECTED_STATUSES}
                      submitActionLabel="提交审核"
                      theme="link"
                      size="small"
                      actions={{
                        approve: (id) => approvePurchaseOrder(id, { approved: true, review_remarks: '' }),
                        reject: (id, reason) => approvePurchaseOrder(id, { approved: false, review_remarks: reason || '' }),
                      }}
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
                    <Dropdown
                      menu={{
                        items: [
                          { key: 'receipt-notice', label: '收货通知', icon: <FileTextOutlined />, onClick: () => handlePushToNotice(orderDetail) },
                          { key: 'receipt', label: '采购入库', icon: <InboxOutlined />, onClick: () => handlePushToReceipt(orderDetail) },
                          { key: 'invoice', label: '采购发票', icon: <DollarOutlined />, onClick: () => handlePushToInvoice(orderDetail) },
                          { key: 'purchase-return', label: '采购退货单', icon: <RollbackOutlined />, onClick: () => handlePushToReturn(orderDetail) },
                        ],
                      }}
                    >
                      <Button type="link" size="small" icon={<CheckCircleOutlined />} style={{ color: '#722ed1' }}>
                        下推 <DownOutlined />
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
                      创建变更单
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
                          messageApi.success('催单提醒已发出');
                        } catch (err: any) {
                          messageApi.error(err.message || '催单失败');
                        }
                      }}
                    >
                      一键催单
                    </Button>
                  ),
                },
                {
                  key: 'delete',
                  visible: isDraftStatus(orderDetail.status),
                  render: () => (
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(orderDetail)}>
                      删除
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
                    费用明细
                  </Typography.Title>
                  <div style={{ marginBottom: 12 }}>
                    <Typography.Text type="secondary">
                      总费用金额：<strong>¥{formatAmount(orderDetail.total_fee_amount)}</strong>
                    </Typography.Text>
                  </div>
                  <Table
                    size="small"
                    columns={[
                      {
                        title: '费用类型',
                        dataIndex: 'type',
                        width: 120,
                        render: (val) => {
                          const opt = feeTypeOptions.find((o: any) => o.value === val);
                          return opt?.label || val;
                        },
                      },
                      {
                        title: '金额',
                        dataIndex: 'amount',
                        width: 120,
                        align: 'right',
                        render: (val) => `¥${formatAmount(val)}`,
                      },
                      {
                        title: '承担方',
                        dataIndex: 'bearer',
                        width: 100,
                        render: (val) => (val === 'our_side' ? '我方' : '对方'),
                      },
                      { title: '备注', dataIndex: 'notes' },
                    ]}
                    dataSource={orderDetail.fee_details}
                    rowKey={(_: any, i?: number) => i ?? 0}
                    pagination={false}
                    bordered
                  />
                </>
              )}
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
                          {t('components.documentTrackingPanel.traceBriefOpenPurchaseRequisition', {
                            defaultValue: '前往采购申请',
                          })}
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
                          {t('components.documentTrackingPanel.traceBriefOpenReceiptNotice', { defaultValue: '前往收货通知' })}
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
                          {t('components.documentTrackingPanel.traceBriefOpenPurchaseReturn', { defaultValue: '前往采购退货' })}
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
                      { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                      { title: '物料名称', dataIndex: 'material_name', width: 150, ellipsis: true },
                      { title: '采购数量', dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                      { title: '单位', dataIndex: 'unit', width: 60 },
                      {
                        title: '单价',
                        dataIndex: 'unit_price',
                        width: 100,
                        align: 'right',
                        render: (text) => `¥${text}`,
                      },
                      {
                        title: '总价',
                        dataIndex: 'total_price',
                        width: 120,
                        align: 'right',
                        render: (text) => `¥${text?.toLocaleString()}`,
                      },
                      { title: '已到货', dataIndex: 'received_quantity', width: 100, align: 'right' },
                      { title: '未到货', dataIndex: 'outstanding_quantity', width: 100, align: 'right' },
                      { title: '要求到货日期', dataIndex: 'required_date', width: 120 },
                      {
                        title: '是否检验',
                        dataIndex: 'inspection_required',
                        width: 100,
                        render: (val) => (val ? '是' : '否'),
                      },
                    ]}
                    dataSource={orderDetail.items}
                    pagination={false}
                    rowKey="id"
                    bordered
                  />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
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
              <Typography.Title level={5} style={{ margin: '0 0 8px' }}>变更历史</Typography.Title>
              {orderChangeHistory.length ? (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={orderChangeHistory}
                  columns={[
                    { title: '变更单号', dataIndex: 'change_code' },
                    { title: '版本', dataIndex: 'change_version', width: 70 },
                    { title: '差额', dataIndex: 'delta_amount', width: 100 },
                    { title: '状态', dataIndex: 'status', width: 100 },
                    { title: '生效时间', dataIndex: 'applied_at', width: 160, render: (v: string) => v || '-' },
                  ]}
                />
              ) : (
                <Typography.Text type="secondary">暂无变更单</Typography.Text>
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
                        审批流程
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
                          ? '已通过'
                          : approvalStatus.status === 'rejected'
                            ? '已驳回'
                            : '进行中'}
                      </Tag>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      {approvalStatus.current_node && (
                        <div>
                          <strong>当前节点：</strong>
                          <Tag color="blue">{approvalStatus.current_node}</Tag>
                        </div>
                      )}
                    </div>
                    {approvalStatus?.history && approvalStatus.history.length > 0 && (
                      <div>
                        <Divider titlePlacement="left">审批记录</Divider>
                        <Timeline
                          items={approvalStatus.history.map((h) => {
                            const isPassed = h.action === 'approve';
                            const isRejected = h.action === 'reject';
                            return {
                              dot: isPassed ? (
                                <CheckCircleTwoTone twoToneColor="#52c41a" />
                              ) : isRejected ? (
                                <CloseCircleTwoTone twoToneColor="#ff4d4f" />
                              ) : (
                                <ClockCircleOutlined style={{ color: '#1890ff' }} />
                              ),
                              color: isPassed ? 'green' : isRejected ? 'red' : 'blue',
                              children: (
                                <div>
                                  <div style={{ marginBottom: 4 }}>
                                    <Tag color={isPassed ? 'success' : isRejected ? 'error' : 'processing'}>
                                      {isPassed ? '通过' : isRejected ? '驳回' : h.action || '-'}
                                    </Tag>
                                  </div>
                                  <div style={{ color: '#666', fontSize: '12px', marginBottom: 4 }}>
                                    {h.action_at && `审核时间：${h.action_at}`}
                                  </div>
                                  {h.comment && (
                                    <div style={{ color: '#999', fontSize: '12px', marginTop: 4 }}>
                                      审核意见：{h.comment}
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
                        description="暂无审批记录"
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
        title="从数据集同步采购订单"
      />

      {/* 下推入库 Modal：标准 Modal，采购数量可编辑 */}
      <Modal
        title="下推到采购入库"
        open={pushToReceiptVisible}
        onCancel={() => {
          setPushToReceiptVisible(false);
          setPushToReceiptOrder(null);
          setPushToReceiptQuantities({});
          setPushToReceiptBatchNumbers({});
        }}
        onOk={handlePushToReceiptConfirm}
        confirmLoading={pushToReceiptLoading}
        okText="确认下推"
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnHidden
      >
        {pushToReceiptOrder && (
          <div>
            <p style={{ marginBottom: 16 }}>
              从采购订单 <strong>{pushToReceiptOrder.order_code}</strong> 下推生成采购入库单，可修改各明细的入库数量（不超过未入库数量）：
            </p>
            <Table
              size="small"
              dataSource={(pushToReceiptOrder.items || []).filter(
                (it: PurchaseOrderItem) => (it.outstanding_quantity ?? 0) > 0
              )}
              rowKey="id"
              pagination={false}
              scroll={{ x: 700 }}
              columns={[
                { title: '物料编号', dataIndex: 'material_code', width: 120 },
                { title: '物料名称', dataIndex: 'material_name', width: 150 },
                { title: '采购数量', dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                { title: '已到货', dataIndex: 'received_quantity', width: 90, align: 'right' },
                { title: '未到货', dataIndex: 'outstanding_quantity', width: 90, align: 'right' },
                {
                  title: '批号',
                  width: 140,
                  render: (_: any, record: PurchaseOrderItem) =>
                    record.id != null ? (pushToReceiptBatchNumbers[record.id] ?? (pushToReceiptPreviewLoading ? '加载中...' : '-')) : '-',
                },
                {
                  title: '入库数量',
                  width: 140,
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
                      style={{ width: 100 }}
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
        title="下推到收货通知"
        open={pushToNoticeVisible}
        onCancel={() => {
          setPushToNoticeVisible(false);
          setPushToNoticeOrder(null);
          setPushToNoticeQuantities({});
        }}
        onOk={handlePushToNoticeConfirm}
        confirmLoading={pushToNoticeLoading}
        okText="确认下推"
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnHidden
      >
        {pushToNoticeOrder && (
          <div>
            <p style={{ marginBottom: 16 }}>
              从采购订单 <strong>{pushToNoticeOrder.order_code}</strong> 下推生成收货通知单，可修改各明细的通知数量（不超过未入库数量）：
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
                { title: '物料编号', dataIndex: 'material_code', width: 120 },
                { title: '物料名称', dataIndex: 'material_name', width: 150 },
                { title: '采购数量', dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                { title: '已到货', dataIndex: 'received_quantity', width: 90, align: 'right' },
                { title: '未到货', dataIndex: 'outstanding_quantity', width: 90, align: 'right' },
                {
                  title: '通知数量',
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
        title="下推到采购退货"
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
        okText="确认下推"
        width={MODAL_CONFIG.STANDARD_WIDTH}
        destroyOnHidden
      >
        {pushToReturnOrder && (
          <div>
            <p style={{ marginBottom: 12 }}>
              从采购订单 <strong>{pushToReturnOrder.order_code}</strong> 下推生成采购退货单，可修改各明细退货数量（不超过已到货数量）：
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
              dataSource={(pushToReturnOrder.items || []).filter((it: PurchaseOrderItem) => (it.received_quantity ?? 0) > 0)}
              rowKey="id"
              pagination={false}
              scroll={{ x: 700 }}
              columns={[
                { title: '物料编号', dataIndex: 'material_code', width: 120 },
                { title: '物料名称', dataIndex: 'material_name', width: 150 },
                { title: '采购数量', dataIndex: 'ordered_quantity', width: 100, align: 'right' },
                { title: '已到货', dataIndex: 'received_quantity', width: 90, align: 'right' },
                {
                  title: '退货数量',
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
    </>
  );
};

export default PurchaseOrdersPage;




