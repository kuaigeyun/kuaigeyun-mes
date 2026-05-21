/**
 * 报价单管理页面
 *
 * 提供报价单的创建、查看、编辑、删除和转销售订单功能。
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useInvalidateSalesOrderList } from '../../../../../hooks/useInvalidateSalesOrderList';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useNavigate, useLocation } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, InputNumber, Input, Row, Col, DatePicker, List, Typography, theme as AntdTheme, Descriptions, Empty, Spin, Tooltip, Switch } from 'antd';
import type { DescriptionsProps } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SwapOutlined, PrinterOutlined, ImportOutlined, AppstoreAddOutlined, SendOutlined, CommentOutlined, RollbackOutlined, CheckOutlined, CloseCircleOutlined, UndoOutlined, BranchesOutlined, ReloadOutlined, FileTextOutlined, FormOutlined } from '@ant-design/icons';
import { ProForm, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerInlineFullChain, DRAWER_CONFIG, FormModalTemplate, MODAL_CONFIG, MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET, MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import type { SubStage } from '../../../../../components/uni-lifecycle/types';
import { AmountDisplay } from '../../../../../components/permission';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import {
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertQuotationToOrder,
  submitQuotation,
  withdrawQuotation,
  approveQuotation,
  rejectQuotation,
  revokeReviewQuotation,
  confirmCustomerQuotation,
  reopenQuotation,
  revokePushQuotation,
  createQuotationRevision,
  printQuotation,
  recordQuotationPrint,
  Quotation,
} from '../../../services/quotation';
import { getSalesOrder, type SalesOrder } from '../../../services/sales-order';
import { SalesOrderDetailBody } from '../sales-orders/components/SalesOrderDetailBody';
import { getQuotationLifecycle } from '../../../utils/quotationLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import {
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { apiRequest } from '../../../../../services/api';
import type { DocumentPrintApiResult } from '../../../../../utils/printResponseHelpers';
import { getPrintTemplateList, type PrintTemplate } from '../../../../../services/printTemplate';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import dayjs from 'dayjs';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { batchImport } from '../../../../../utils/batchOperations';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../../../../stores/configStore';
import { useGlobalStore } from '../../../../../stores';
import { CustomerFollowUpFormModal, type CustomerFollowUpPreset } from '../../../components/CustomerFollowUpFormModal';
import { RE_STATUS_BADGE_DRAFT, resolveStatusTagDisplayProps } from '../../../../../constants/statusBadges';
import { UniPdfPreview } from '../../../../../components/uni-preview';

const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport }))
);
const LazySyncFromDatasetModal = lazy(() => import('../../../../../components/sync-from-dataset-modal'));

/** 详情/列表状态 Tag：与生命周期主轴文案一致（含待审核等子态） */
function getQuotationStatusTagProps(record: Quotation, auditRequired: boolean): { text: string; color: string } {
  const lc = getQuotationLifecycle(record, auditRequired);
  if (lc.status === 'exception') return { text: lc.stageName, color: 'error' };
  if (lc.status === 'success') return { text: lc.stageName, color: 'success' };
  const activeKey = lc.mainStages?.find((s) => s.status === 'active')?.key;
  if (activeKey === 'draft') return { text: lc.stageName, color: RE_STATUS_BADGE_DRAFT };
  if (activeKey === 'converted') return { text: lc.stageName, color: 'success' };
  return { text: lc.stageName, color: 'processing' };
}

/** 列表快速筛选：DB status → 生命周期展示（筛选值仍为后端 status） */
const QUOTATION_STATUS_FILTER_ENUM = {
  草稿: { text: '草稿' },
  已发送: { text: '已报价' },
  已接受: { text: '客户确认' },
  已转订单: { text: '已转订单' },
  已拒绝: { text: '已驳回' },
} as const;

type QuotationListScope = 'all' | 'mine' | 'department';

/** 与后端 LEGACY_PENDING_VALUES 一致 */
const PENDING_REVIEW_STATUSES = new Set(['待审核', 'PENDING', 'PENDING_REVIEW']);

function isApprovedReview(rs: string | undefined): boolean {
  const r = (rs || '').trim();
  return ['已通过', 'APPROVED', '审核通过', '通过', '已审核'].includes(r);
}

function canWithdrawQuotation(q: Quotation, auditRequired: boolean): boolean {
  if (!auditRequired) return false;
  return q.status === '已发送' && PENDING_REVIEW_STATUSES.has((q.review_status || '').trim());
}

function canApproveQuotation(q: Quotation, auditRequired: boolean): boolean {
  if (!auditRequired) return false;
  if (q.status !== '已发送') return false;
  const rs = (q.review_status || '').trim();
  return PENDING_REVIEW_STATUSES.has(rs) || rs === '';
}

function canRejectQuotation(q: Quotation, auditRequired: boolean): boolean {
  return canApproveQuotation(q, auditRequired);
}

function canRevokeReviewQuotation(q: Quotation, auditRequired: boolean): boolean {
  if (!auditRequired) return false;
  return q.status === '已发送' && isApprovedReview(q.review_status);
}

/** 未开审核时：已发送即可客户确认（不依赖 review_status 是否「已通过」） */
function canConfirmCustomerQuotation(q: Quotation, auditRequired: boolean): boolean {
  if (q.status !== '已发送') return false;
  if (!auditRequired) return true;
  return isApprovedReview(q.review_status);
}

function canReopenQuotation(q: Quotation): boolean {
  return q.status === '已拒绝';
}

function canRevokePushQuotation(q: Quotation): boolean {
  return q.status === '已转订单' && q.conversion_downstream_missing === true;
}

function canDeleteQuotation(q: Quotation): boolean {
  if (q.conversion_downstream_missing === true) return true;
  if (q.status === '已转订单') return false;
  if (q.sales_order_id != null && Number(q.sales_order_id) > 0) return false;
  return true;
}

/** 系列已有更新修订版，不可再从旧版下推 */
function isQuotationSuperseded(q: Quotation): boolean {
  return (
    q.is_latest_in_series === false &&
    q.superseded_by_id != null &&
    Number(q.superseded_by_id) > 0
  );
}

/** 允许「转订单」：已接受；或开审核且已发送并已审核通过；或已转单但下游已删可重新下推 */
function canConvertQuotation(q: Quotation, auditRequired: boolean): boolean {
  if (q.is_latest_in_series === false) return false;
  if (q.status === '已拒绝') return false;
  if (q.status === '已转订单') {
    return q.conversion_downstream_missing === true;
  }
  if (q.status === '已接受') return true;
  if (q.status === '已发送') {
    if (!auditRequired) return false;
    return isApprovedReview(q.review_status);
  }
  return false;
}

/** 生成PDF报价：与后端 print 门禁一致；未开审核时「已发送」也可生成 */
function canPrintFormalQuotation(q: Quotation, auditRequired: boolean): boolean {
  const st = (q.status || '').trim();
  if (st === '已接受' || st === '已转订单') return true;
  if (st === '已发送') {
    if (!auditRequired) return true;
    return isApprovedReview(q.review_status);
  }
  return false;
}

/** 新建修订版：非草稿的最新系列行 */
function canCreateRevision(q: Quotation): boolean {
  if (q.is_latest_in_series === false) return false;
  if ((q.status || '').trim() === '草稿') return false;
  return true;
}

/** ProForm 提交时日期可能是 dayjs、字符串或 Date，避免直接调用 .format 报错 */
function toApiDateString(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  if (dayjs.isDayjs(v)) return v.isValid() ? v.format('YYYY-MM-DD') : undefined;
  const d = dayjs(v as string | Date | number);
  return d.isValid() ? d.format('YYYY-MM-DD') : undefined;
}

/** 有效期快捷选项：以报价日期为基准（未填则取今天） */
function resolveQuotationDateBase(formRef: React.RefObject<{ getFieldValue?: (name: string) => unknown } | null>) {
  const qd = formRef.current?.getFieldValue?.('quotation_date');
  if (dayjs.isDayjs(qd) && qd.isValid()) return qd.startOf('day');
  if (qd != null && qd !== '') {
    const d = dayjs(qd as string | Date | number);
    if (d.isValid()) return d.startOf('day');
  }
  return dayjs().startOf('day');
}

const QUOTATION_DATE_SHORTCUTS: { label: string; resolve: (base: dayjs.Dayjs) => dayjs.Dayjs }[] = [
  { label: '7天', resolve: (base) => base.add(7, 'day') },
  { label: '15天', resolve: (base) => base.add(15, 'day') },
  { label: '一个月', resolve: (base) => base.add(1, 'month') },
  { label: '月底', resolve: (base) => base.endOf('month') },
];

function buildQuotationDateShortcutPickerProps(
  formRef: React.RefObject<{ setFieldsValue?: (v: Record<string, unknown>) => void; getFieldValue?: (name: string) => unknown } | null>,
  fieldName: 'valid_until' | 'delivery_date',
) {
  return {
    style: { width: '100%' },
    showToday: false,
    renderExtraFooter: () => (
      <Space wrap size={[0, 0]} style={{ padding: '6px 4px', width: '100%', justifyContent: 'center' }}>
        {QUOTATION_DATE_SHORTCUTS.map(({ label, resolve }) => (
          <Button
            key={label}
            type="link"
            size="small"
            onClick={() => {
              const base = resolveQuotationDateBase(formRef);
              formRef.current?.setFieldsValue?.({ [fieldName]: resolve(base) });
            }}
          >
            {label}
          </Button>
        ))}
      </Space>
    ),
  };
}

/** 将 ProDescriptions 列配置转为 Ant Design Descriptions items（与 detailDrawerDescriptionItems 一致） */
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

/** 报价明细表最小横向滚动宽度（避免列换行，以横向滚动为主） */
const QUOTATION_DETAIL_ITEMS_SCROLL_X = 1060;

/** 报价单详情内打开下游销售订单时：二层抽屉宽度（zIndex 见组件内 token.zIndexPopupBase + 50） */
const LINKED_DOCUMENT_DRAWER_WIDTH = '45%';

/** 列表树形行（antd Table children） */
type QuotationTableRow = Quotation & { children?: QuotationTableRow[] };

/** 同一系列的分组键：优先后端 series_code；否则从编号剥 `-Vn` 后缀 */
function quotationSeriesGroupKey(r: Quotation): string {
  const series = (r.quotation_series_code || '').trim();
  if (series) return series;
  const qc = String(r.quotation_code || '').trim();
  if (!qc) return `__id_${r.id ?? 'unknown'}`;
  const m = qc.match(/^(.*)-V(\d+)$/i);
  if (m) return m[1];
  return qc;
}

function pickQuotationSeriesParent(group: Quotation[]): Quotation {
  const latest = group.find((x) => x.is_latest_in_series === true);
  if (latest) return latest;
  return group.reduce((a, b) => ((b.version_no ?? 0) > (a.version_no ?? 0) ? b : a));
}

/**
 * 将当前页的扁平列表按系列合成树：父行为「最新版」（或 version 最高），其余版本为子行。
 * 仅作用于本页数据；跨分页的系列只在同一页内合并。
 */
function buildQuotationSeriesTree(rows: Quotation[]): QuotationTableRow[] {
  if (!rows?.length) return [];
  const groups = new Map<string, Quotation[]>();
  const firstIndex = new Map<string, number>();
  rows.forEach((r, i) => {
    const k = quotationSeriesGroupKey(r);
    if (!firstIndex.has(k)) firstIndex.set(k, i);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  });
  /** 子行须严格剔除可能由后端附带的 children（即使为 []），否则 antd Table 会把该行当作可展开行，
   *  渲染出隐形的展开占位符，导致行高 / 缩进与同级兄弟节点不一致。 */
  const stripChildren = (q: Quotation): QuotationTableRow => {
    const { ...rest } = q as Quotation & { children?: unknown };
    delete (rest as { children?: unknown }).children;
    return rest as QuotationTableRow;
  };
  const roots: QuotationTableRow[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      roots.push(stripChildren(group[0]));
      continue;
    }
    const parent = pickQuotationSeriesParent(group);
    const children = group
      .filter((x) => x.id !== parent.id)
      .sort((a, b) => (b.version_no ?? 0) - (a.version_no ?? 0))
      .map(stripChildren);
    roots.push({ ...stripChildren(parent), children });
  }
  roots.sort((a, b) => (firstIndex.get(quotationSeriesGroupKey(a)) ?? 0) - (firstIndex.get(quotationSeriesGroupKey(b)) ?? 0));
  return roots;
}

function flattenQuotationTableRows(rows: QuotationTableRow[]): Quotation[] {
  const out: Quotation[] = [];
  const walk = (r: QuotationTableRow) => {
    const { children, ...rest } = r;
    out.push(rest);
    children?.forEach(walk);
  };
  rows.forEach(walk);
  return out;
}

function renderQuotationRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

const toSafeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toCents = (value: unknown): number => Math.round(toSafeNumber(value) * 100);
const fromCents = (cents: number): number => cents / 100;

/** 与销售订单明细价税列一致；数量字段为 quote_quantity */
const calcQuotationLineAmounts = (
  qtyInput: unknown,
  priceInput: unknown,
  taxRateInput: unknown,
  priceTypeInput?: string,
) => {
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

/** 与销售订单明细表同一套 Table + Form.List 用法；物料列样式见 .quotation-detail-table */
const QuotationMaterialSelectCell: React.FC<{ index: number }> = ({ index }) => {
  const form = Form.useFormInstance();
  const row = Form.useWatch(['items', index]);
  const mid =
    row?.material_id != null && row?.material_id !== ''
      ? Number(row.material_id)
      : null;
  const fallback =
    mid != null &&
    Number.isFinite(mid) &&
    (row?.material_code || row?.material_name)
      ? {
          value: mid,
          label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid),
        }
      : undefined;
  /** 主数据默认售价为不含税；表单为含税单价时需换算，与切换价类时的 convert 一致 */
  const onMaterialPicked = useCallback(
    (_val: number | undefined, material: Material | undefined) => {
      if (!material) return;
      const pt = form.getFieldValue('price_type') ?? 'tax_exclusive';
      if (pt !== 'tax_inclusive') return;
      const raw = Number(form.getFieldValue(['items', index, 'unit_price'])) || 0;
      const taxR = Number(form.getFieldValue(['items', index, 'tax_rate'])) || 0;
      form.setFieldValue(
        ['items', index, 'unit_price'],
        convertUnitPriceByPriceType(raw, taxR, 'tax_exclusive', 'tax_inclusive'),
      );
    },
    [form, index],
  );
  return (
    <div
      className="quotation-material-cell"
      style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <UniMaterialSelect
          name={[index, 'material_id']}
          label=""
          placeholder="请选择物料（支持名称/编号搜索）"
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
            tax_rate: 'defaults.defaultTaxRate' as any,
          }}
          fallbackOption={fallback}
          formItemProps={{ style: { margin: 0 } }}
          showQuickCreate
          showAdvancedSearch
          onChange={onMaterialPicked}
        />
      </div>
    </div>
  );
};

/** 不含税模式下仅展示未税金额列；含税模式下列为可编辑价税合计，本组件仅用于不含税简化列 */
const QuotationAmountCell: React.FC<{ index: number }> = ({ index }) => {
  const row = Form.useWatch(['items', index]);
  const priceType = Form.useWatch('price_type') ?? 'tax_exclusive';
  const line = calcQuotationLineAmounts(row?.quote_quantity, row?.unit_price, row?.tax_rate, priceType);
  return <AmountDisplay resource="sales_order" value={line.excl} />;
};

const QuotationFormSummary: React.FC = () => {
  const items = Form.useWatch('items');
  const priceType = Form.useWatch('price_type') ?? 'tax_exclusive';
  const { token } = AntdTheme.useToken();
  const totalQuantity = items?.reduce((sum: number, it: any) => sum + (Number(it?.quote_quantity) || 0), 0) || 0;
  let totalExcl = 0;
  let totalIncl = 0;
  for (const it of items || []) {
    const line = calcQuotationLineAmounts(it?.quote_quantity, it?.unit_price, it?.tax_rate, priceType);
    totalExcl += line.excl;
    totalIncl += line.incl;
  }

  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 24,
        padding: '12px 12px 16px',
        background: token.colorFillAlter,
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: 24,
      }}
    >
      <span>总数量: <Typography.Text strong>{totalQuantity}</Typography.Text></span>
      {priceType === 'tax_exclusive' ? (
        <>
          <span>
            未税总额:{' '}
            <Typography.Text strong>
              <AmountDisplay resource="sales_order" value={totalExcl} />
            </Typography.Text>
          </span>
          {Math.abs(totalIncl - totalExcl) > 0.005 && (
            <span>
              价税合计(含税):{' '}
              <Typography.Text strong type="danger">
                <AmountDisplay resource="sales_order" value={totalIncl} />
              </Typography.Text>
            </span>
          )}
        </>
      ) : (
        <span>
          价税合计:{' '}
          <Typography.Text strong type="danger">
            <AmountDisplay resource="sales_order" value={totalIncl} />
          </Typography.Text>
        </span>
      )}
    </div>
  );
};

const QuotationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const quotationDetailDrawerZIndex = token.zIndexPopupBase;
  const linkedSalesOrderDrawerZIndex = token.zIndexPopupBase + 50;
  const quotationElevatedModalZIndex = token.zIndexPopupBase + MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET;
  const quotationNestedElevatedPopupZIndex = quotationElevatedModalZIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET;
  const navigate = useNavigate();
  const location = useLocation();
  const { message: messageApi } = App.useApp();
  const defaultQuotationCurrency = useConfigStore((s) => {
    const c = s.configs.default_currency;
    return typeof c === 'string' && c.trim() !== '' ? c.trim() : 'CNY';
  });
  const actionRef = useRef<ActionType>(null);
  const lastQuotationsFlatCacheRef = useRef<Quotation[]>([]);
  const listScopeSkipReloadRef = useRef(true);
  const listScopeDefaultAppliedRef = useRef(false);
  const currentUser = useGlobalStore((s) => s.currentUser);
  const [listScopeFilter, setListScopeFilter] = useState<QuotationListScope>('mine');
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const invalidateSalesOrderList = useInvalidateSalesOrderList();
  const tableSearchFormRef = useRef<any>(null);
  const [listTotal, setListTotal] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [quotationDetail, setQuotationDetail] = useState<Quotation | null>(null);
  const quotationTracking = useDocumentTracking(
    detailDrawerVisible && quotationDetail ? 'quotation' : undefined,
    quotationDetail?.id
  );
  /** 默认 false：配置未加载时不应误判为「已开审核」，否则会出现未开审核仍显示「撤回审核」等 */
  const quotationAuditRequired = useAuditRequired('quotation', false);
  const salesOrderAuditRequired = useAuditRequired('sales_order', false);
  const quotationLifecycleDetail = useMemo(
    () => (quotationDetail ? getQuotationLifecycle(quotationDetail, quotationAuditRequired) : null),
    [quotationDetail, quotationAuditRequired],
  );
  const quotationNextSteps = quotationLifecycleDetail?.nextStepSuggestions;
  const hideQuotationStepperNextRow = Boolean(quotationNextSteps?.length);
  const showQuotationLifecycleNextInTitle =
    Boolean(quotationNextSteps?.length) && !quotationDetail?.conversion_downstream_missing;
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [pdfPreviewVisible, setPdfPreviewVisible] = useState(false);
  const [pdfPreviewBlobUrl, setPdfPreviewBlobUrl] = useState<string | null>(null);
  const [pdfPreviewFileName, setPdfPreviewFileName] = useState<string>('报价单.pdf');
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printingRecord, setPrintingRecord] = useState<Quotation | null>(null);
  const [printTemplates, setPrintTemplates] = useState<PrintTemplate[]>([]);
  const [selectedPrintTemplateUuid, setSelectedPrintTemplateUuid] = useState<string | undefined>(undefined);
  const [printSubmitting, setPrintSubmitting] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null);
  const formRef = useRef<any>(null);
  const lastPriceTypeRef = useRef<'tax_exclusive' | 'tax_inclusive'>('tax_exclusive');
  const [quotationEditingIncl, setQuotationEditingIncl] = useState<{ index: number; value: number | null } | null>(
    null,
  );
  const quotationEditingInclValueRef = useRef<number | null>(null);

  const handleQuotationPriceTypeToggle = useCallback((checked: boolean) => {
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
        unit_price: convertUnitPriceByPriceType(row?.unit_price, row?.tax_rate, currentType, nextType),
      }));
      formRef.current?.setFieldsValue({ items: convertedItems, price_type: nextType });
    } else {
      formRef.current?.setFieldsValue({ price_type: nextType });
    }
    setQuotationEditingIncl(null);
    quotationEditingInclValueRef.current = null;
    lastPriceTypeRef.current = nextType;
  }, []);

  const [customerList, setCustomerList] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [userList, setUserList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [customerEditUuid, setCustomerEditUuid] = useState<string | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  /** 发货方式字典选项（数据字典 SHIPPING_METHOD） */
  const [shippingMethodOptions, setShippingMethodOptions] = useState<Array<{ label: string; value: string }>>([]);
  /** 付款条件字典选项（数据字典 PAYMENT_TERMS） */
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpPreset, setFollowUpPreset] = useState<CustomerFollowUpPreset | null>(null);
  /** 报价单详情内点击下游销售订单：二层只读抽屉 */
  const [linkedSalesOrderDrawerOpen, setLinkedSalesOrderDrawerOpen] = useState(false);
  const [linkedSalesOrder, setLinkedSalesOrder] = useState<SalesOrder | null>(null);
  const [linkedSalesOrderLoading, setLinkedSalesOrderLoading] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingRecord, setRejectingRecord] = useState<Quotation | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  useEffect(() => {
    if (listScopeDefaultAppliedRef.current || !currentUser) return;
    listScopeDefaultAppliedRef.current = true;
    setListScopeFilter(
      currentUser.is_tenant_admin || currentUser.is_infra_admin ? 'all' : 'mine',
    );
  }, [currentUser]);

  useEffect(() => {
    if (listScopeSkipReloadRef.current) {
      listScopeSkipReloadRef.current = false;
      return;
    }
    actionRef.current?.reload();
  }, [listScopeFilter]);

  useEffect(() => {
    const load = async () => {
      setCustomersLoading(true);
      setUsersLoading(true);
      try {
        const [custRes, matRes, userRes] = await Promise.all([
          apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 1000, is_active: true } }),
          apiRequest<unknown>('/apps/master-data/materials', { params: { limit: 1000, is_active: true } }),
          apiRequest<unknown>('/core/users', { params: { limit: 1000, is_active: true } }),
        ]);
        const custList = Array.isArray(custRes) ? custRes : (custRes as any)?.data ?? (custRes as any)?.items ?? [];
        const matList = Array.isArray(matRes) ? matRes : (matRes as any)?.data ?? (matRes as any)?.items ?? [];
        const usrList = Array.isArray(userRes) ? userRes : (userRes as any)?.data ?? (userRes as any)?.items ?? [];
        setCustomerList(Array.isArray(custList) ? custList : []);
        setMaterialList(Array.isArray(matList) ? matList : []);
        setUserList(Array.isArray(usrList) ? usrList : []);
      } catch {
        setCustomerList([]);
        setMaterialList([]);
        setUserList([]);
      } finally {
        setCustomersLoading(false);
        setUsersLoading(false);
      }
    };
    load();
  }, []);

  const applyCustomerToQuotationForm = useCallback(
    (c: Record<string, any>) => {
      if (!c) return;
      const sId = c.salesmanId ?? c.salesman_id;
      const salesman = userList.find((u) => u.id === sId);
      const sName =
        c.salesmanName ?? c.salesman_name ?? (salesman ? salesman.full_name || salesman.username : '');
      formRef.current?.setFieldsValue({
        customer_id: c.id ?? c.customer_id,
        customer_name: c.name ?? c.customer_name,
        customer_contact: c.contactPerson ?? c.contact_person ?? c.contact ?? c.customer_contact,
        customer_phone: c.phone ?? c.customer_phone,
        salesman_id: sId,
        salesman_name: sName,
        shipping_address:
          c.deliveryAddress ??
          c.delivery_address ??
          c.address ??
          c.shipping_address ??
          '',
      });
    },
    [userList],
  );

  const openCustomerFormForCreate = useCallback(() => {
    setCustomerEditUuid(null);
    setCustomerFormOpen(true);
  }, []);

  const openCustomerFormForEdit = useCallback(
    (customerId: unknown) => {
      const c = customerList.find((x: any) => (x.id ?? x.customer_id) === customerId);
      const uuid = c?.uuid;
      if (!uuid) {
        messageApi.warning('无法编辑该客户，请刷新客户列表后重试');
        return;
      }
      setCustomerEditUuid(String(uuid));
      setCustomerFormOpen(true);
    },
    [customerList, messageApi],
  );

  useEffect(() => {
    const loadShippingMethod = async () => {
      try {
        const dict = await getDataDictionaryByCode('SHIPPING_METHOD');
        const items = await getDictionaryItemList(dict.uuid, true);
        setShippingMethodOptions(
          items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value }))
        );
      } catch (e: any) {
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
        setPaymentTermsOptions([]);
      }
    };
    loadShippingMethod();
    loadPaymentTerms();
  }, []);

  /** 高级搜索与列表列统一定义，避免 dataIndex 重复 */
  const columns: ProColumns<Quotation>[] = [
    {
      title: '报价单编号',
      key: 'quotation_code',
      dataIndex: 'quotation_code',
      /** 树形展开 + 复制占宽；关闭列级 ellipsis，避免 rc-table 与 Typography 双重省略号 */
      width: 240,
      /** 统一由列定义控制宽度：禁用该列拖拽改宽，避免持久化覆盖 */
      resizable: false,
      ellipsis: false,
      fixed: 'left',
      order: 10,
      fieldProps: { placeholder: '支持模糊匹配' },
      render: (_, r) => {
        const code = String(r.quotation_code ?? '-');
        return (
          <Typography.Text copyable={{ text: code }} style={{ whiteSpace: 'nowrap' }}>
            {code}
          </Typography.Text>
        );
      },
    },
    {
      title: t('app.kuaizhizao.quotation.colSeries'),
      dataIndex: 'quotation_series_code',
      width: 140,
      ellipsis: true,
      hideInSearch: true,
      hideInTable: true,
      order: 12,
      render: (_, r) => r.quotation_series_code || r.quotation_code || '-',
    },
    {
      title: t('app.kuaizhizao.quotation.colVersion'),
      dataIndex: 'version_no',
      width: 88,
      hideInSearch: true,
      order: 13,
      render: (_, r) => t('app.kuaizhizao.quotation.versionDisplay', { n: r.version_no ?? 1 }),
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      width: 260,
      ellipsis: true,
      order: 20,
      fieldProps: { placeholder: '客户名称' },
    },
    {
      title: '报价日期',
      dataIndex: 'quotation_date',
      width: 110,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: '报价日期范围',
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: { placeholder: ['开始日期', '结束日期'] },
      order: 30,
    },
    {
      title: '销售员',
      dataIndex: 'salesman_name',
      width: 100,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 110,
      align: 'right',
      hideInSearch: true,
      render: (_, r) => <AmountDisplay resource="sales_order" value={r.total_amount} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      hideInTable: true,
      valueEnum: QUOTATION_STATUS_FILTER_ENUM,
      order: 40,
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
      dataIndex: 'lifecycle',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getQuotationLifecycle(record, quotationAuditRequired);
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
      title: '操作',
      minWidth: 120,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const parts: React.ReactNode[] = [
          <Button key="d" type="link" size="small" onClick={() => handleDetail(record.id!)}>
            详情
          </Button>,
        ];
        const canEdit = record.status === '草稿';
        const deletable = canDeleteQuotation(record);
        parts.push(
          <Button key="e" type="link" size="small" disabled={!canEdit} onClick={() => canEdit && handleEdit(record)}>
            编辑
          </Button>
        );
        parts.push(
          <Button key="del" type="link" size="small" danger disabled={!deletable} onClick={() => deletable && handleDelete(record)}>
            删除
          </Button>
        );
        if (record.status === '草稿') {
          parts.push(
            <Button key="sub" type="link" size="small" onClick={() => handleSubmit(record)}>
              提交
            </Button>
          );
        }
        if (canWithdrawQuotation(record, quotationAuditRequired)) {
          parts.push(
            <Button key="w" type="link" size="small" onClick={() => handleWithdraw(record)}>
              撤回
            </Button>
          );
        }
        if (canApproveQuotation(record, quotationAuditRequired)) {
          parts.push(
            <Button key="ap" type="link" size="small" onClick={() => handleApprove(record)}>
              审核通过
            </Button>
          );
        }
        if (canRejectQuotation(record, quotationAuditRequired)) {
          parts.push(
            <Button key="rj" type="link" size="small" onClick={() => openRejectModal(record)}>
              驳回
            </Button>
          );
        }
        if (canRevokeReviewQuotation(record, quotationAuditRequired)) {
          parts.push(
            <Button key="rv" type="link" size="small" onClick={() => handleRevokeReview(record)}>
              撤回审核
            </Button>
          );
        }
        if (canReopenQuotation(record)) {
          parts.push(
            <Button key="ro" type="link" size="small" onClick={() => handleReopen(record)}>
              重新编辑
            </Button>
          );
        }
        if (canRevokePushQuotation(record)) {
          parts.push(
            <Button key="rp" type="link" size="small" onClick={() => handleRevokePush(record)}>
              撤回下推
            </Button>
          );
        }
        if (record.customer_id != null && Number.isFinite(Number(record.customer_id))) {
          parts.push(
            <Button key="fu" type="link" size="small" onClick={() => openFollowUpFromQuotation(record)}>
              {t('app.kuaizhizao.customerFollowUp.addFollowUpFromDocument')}
            </Button>
          );
        }
        return renderQuotationRowActions(parts, `q-${record.id ?? 'row'}`);
      },
    },
  ];

  // columns 定义已合并

  const handleDetail = async (id: number) => {
    try {
      const res = await getQuotation(id);
      if (res) {
        setQuotationDetail(res);
        setDetailDrawerVisible(true);
      }
    } catch (e: any) {
      messageApi.error('获取报价单详情失败');
    }
  };

  /** 从销售订单全链路浮层「打开报价单」跳转携带 state，到达本页后自动打开详情 */
  useEffect(() => {
    const raw = (location.state as { openQuotationDetailId?: unknown } | null)?.openQuotationDetailId;
    const id = typeof raw === 'number' ? raw : raw != null ? Number(raw) : NaN;
    if (!Number.isFinite(id) || id <= 0) return;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    void (async () => {
      try {
        const res = await getQuotation(id);
        if (res) {
          setQuotationDetail(res);
          setDetailDrawerVisible(true);
        }
      } catch {
        messageApi.error('获取报价单详情失败');
      }
    })();
  }, [location.state, location.pathname, location.search, navigate, messageApi]);

  const openFollowUpFromQuotation = (record: Quotation) => {
    const cid = record.customer_id;
    if (cid == null || !Number.isFinite(Number(cid))) {
      messageApi.warning(t('app.kuaizhizao.customerFollowUp.needCustomerForFollowUp'));
      return;
    }
    setFollowUpPreset({
      customer_id: Number(cid),
      quotation_id: record.id != null ? record.id : undefined,
      quotation_code: record.quotation_code ?? undefined,
    });
    setFollowUpModalOpen(true);
  };

  const handleEdit = async (record: Quotation) => {
    try {
      const detail = await getQuotation(record.id!, true);
      setQuotationDetail(detail);
      setEditingId(record.id!);
      setModalVisible(true);
      // Modal 使用 destroyOnHidden：挂载前 setFieldsValue 会丢。弹窗打开后再写入。
      const editValues = {
        quotation_code: detail.quotation_code,
        quotation_date: detail.quotation_date ? dayjs(detail.quotation_date) : undefined,
        valid_until: detail.valid_until ? dayjs(detail.valid_until) : undefined,
        delivery_date: detail.delivery_date ? dayjs(detail.delivery_date) : undefined,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        salesman_id: detail.salesman_id,
        salesman_name: detail.salesman_name,
        shipping_address: detail.shipping_address,
        shipping_method: detail.shipping_method,
        payment_terms: detail.payment_terms,
        currency_code: detail.currency_code ?? defaultQuotationCurrency,
        notes: detail.notes,
        price_type: detail.price_type === 'tax_inclusive' ? 'tax_inclusive' : 'tax_exclusive',
        items: (detail.items || []).map((it) => ({
          material_id: it.material_id!,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec,
          material_unit: it.material_unit || '',
          quote_quantity: Number(it.quote_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          tax_rate: Number(it.tax_rate) || 0,
          delivery_date: it.delivery_date ? dayjs(it.delivery_date) : undefined,
          notes: it.notes,
        })),
      };
      setTimeout(() => {
        formRef.current?.setFieldsValue(editValues);
        lastPriceTypeRef.current =
          editValues.price_type === 'tax_inclusive' ? 'tax_inclusive' : 'tax_exclusive';
      }, 50);
    } catch {
      messageApi.error('获取报价单详情失败');
    }
  };

  const handleDelete = (record: Quotation) => {
    Modal.confirm({
      title: '删除报价单',
      content: `确定要删除报价单 "${record.quotation_code}" 吗？`,
      onOk: async () => {
        try {
          await deleteQuotation(record.id!);
          messageApi.success('删除成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleItemImport = (data: any[][]) => {
    const priceTypeForm = formRef.current?.getFieldValue('price_type') ?? 'tax_exclusive';
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

        const material = materialList.find((m: any) => (m.main_code ?? m.mainCode ?? m.code) === materialCode);
        const taxR =
          Number(material?.defaults?.defaultTaxRate ?? material?.defaults?.default_tax_rate) || 0;
        let unitPrice = price || Number(material?.defaults?.defaultSalePrice ?? material?.default_sale_price) || 0;
        if (priceTypeForm === 'tax_inclusive' && unitPrice > 0) {
          unitPrice = convertUnitPriceByPriceType(unitPrice, taxR, 'tax_exclusive', 'tax_inclusive');
        }

        return {
          material_id: material?.id ?? material?.material_id,
          material_code: material?.main_code ?? material?.mainCode ?? material?.code ?? materialCode,
          material_name: material?.name ?? material?.material_name ?? '',
          material_spec: material?.specification ?? material?.material_spec ?? spec,
          material_unit: material?.base_unit ?? material?.baseUnit ?? material?.material_unit ?? unit,
          quote_quantity: quantity,
          unit_price: unitPrice,
          tax_rate: taxR,
          delivery_date: deliveryDate ? (dayjs(deliveryDate).isValid() ? dayjs(deliveryDate) : undefined) : undefined,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null && (it.material_id !== undefined || it.material_code !== ''));

    if (newItems.length === 0) {
      messageApi.warning('未检测到有效数据（请确保物料编号不为空）');
      return;
    }

    const currentItems = formRef.current?.getFieldValue('items') || [];
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    messageApi.success(`成功导入 ${newItems.length} 条明细`);
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    try {
      for (const k of keys) {
        await deleteQuotation(Number(k));
      }
      messageApi.success(`已删除 ${keys.length} 条报价单`);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      setSelectedRowKeys([]);
    } catch (error: any) {
      messageApi.error(error.message || '批量删除失败');
      throw error;
    }
  };

  const handleBatchOperation = async (
    keys: React.Key[],
    actionName: string,
    action: (id: number) => Promise<any>
  ) => {
    if (keys.length === 0) return;
    let successCount = 0;
    let failedCount = 0;
    const failedItems: Array<{ id: number; error: string }> = [];
    for (const k of keys) {
      const id = Number(k);
      try {
        await action(id);
        successCount += 1;
      } catch (error: any) {
        failedCount += 1;
        failedItems.push({ id, error: error?.message || `${actionName}失败` });
      }
    }
    if (failedCount === 0) {
      messageApi.success(`${actionName}成功：${successCount} 条`);
    } else {
      messageApi.warning(`${actionName}完成：成功 ${successCount} 条，失败 ${failedCount} 条`);
      if (failedItems.length > 0) {
        console.error(`${actionName}失败详情:`, failedItems);
      }
    }
    invalidateMenuBadgeCounts();

    actionRef.current?.reload();
    setSelectedRowKeys([]);
  };

  const handleBatchApprove = (keys: React.Key[]) =>
    handleBatchOperation(keys, '批量审核通过', (id) => approveQuotation(id));
  const handleBatchConfirmCustomer = (keys: React.Key[]) =>
    handleBatchOperation(keys, '批量客户确认', (id) => confirmCustomerQuotation(id));

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload: Partial<Quotation> = {
          quotation_code: row.quotation_code || row.quotationCode,
          quotation_date: row.quotation_date || row.quotationDate,
          customer_name: row.customer_name || row.customerName,
          total_amount: row.total_amount ?? row.totalAmount,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await createQuotation(payload, {
          autoSubmit: (payload.status || '草稿') !== '草稿',
        });
        successCount += 1;
      }
      messageApi.success(`已同步 ${successCount} 条报价单`);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
  };

  /**
   * 处理列表页批量导入报价单
   * 导入格式：报价单编号, 客户名称, 报价日期, 物料编号, 数量, 单价, 交货日期, 备注
   * 同一报价单编号的多行会合并为一条报价单的多个明细
   */
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
      code: col('报价单编号') >= 0 ? col('报价单编号') : col('编号'),
      customer: col('客户名称') >= 0 ? col('客户名称') : col('客户'),
      date: col('报价日期') >= 0 ? col('报价日期') : col('日期'),
      material: col('物料编号') >= 0 ? col('物料编号') : col('物料'),
      qty: col('数量') >= 0 ? col('数量') : -1,
      price: col('单价') >= 0 ? col('单价') : -1,
      delivery: col('交货日期') >= 0 ? col('交货日期') : -1,
      notes: col('备注') >= 0 ? col('备注') : -1,
    };

    if (idx.customer < 0 || idx.date < 0 || idx.material < 0 || idx.qty < 0) {
      messageApi.error('缺少必需列：客户名称、报价日期、物料编号、数量');
      return;
    }

    const errors: Array<{ row: number; message: string }> = [];
    const groupMap = new Map<string, { code?: string; customer: string; date: string; items: any[] }>();

    rows.forEach((row: any[], i: number) => {
      const rowNum = i + 3;
      const customerName = (row[idx.customer] ?? '').toString().trim();
      const dateVal = (row[idx.date] ?? '').toString().trim();
      const materialCode = (row[idx.material] ?? '').toString().trim();
      const qtyVal = row[idx.qty];
      const qty = Number(qtyVal);
      if (!customerName) {
        errors.push({ row: rowNum, message: '客户名称不能为空' });
        return;
      }
      if (!dateVal) {
        errors.push({ row: rowNum, message: '报价日期不能为空' });
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

      const mat = materialList.find((m: any) => (m.mainCode || m.code || '').toUpperCase() === materialCode.toUpperCase());
      if (!mat) {
        errors.push({ row: rowNum, message: `未找到物料：${materialCode}` });
        return;
      }

      const code = idx.code >= 0 ? (row[idx.code] ?? '').toString().trim() : '';
      const price = idx.price >= 0 ? (Number(row[idx.price]) || 0) : 0;
      const delivery = idx.delivery >= 0 ? (row[idx.delivery] ?? '').toString().trim() : undefined;
      const notes = idx.notes >= 0 ? (row[idx.notes] ?? '').toString().trim() : undefined;

      const groupKey = code || `${customerName}|${dateVal}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { code: code || undefined, customer: customerName, date: dateVal, items: [] });
      }
      const g = groupMap.get(groupKey)!;
      g.items.push({
        material_id: mat.id,
        material_code: mat.mainCode || mat.code,
        material_name: mat.name,
        material_spec: mat.specification || '',
        material_unit: mat.baseUnit || '件',
        quote_quantity: qty,
        unit_price: price,
        tax_rate: 0,
        delivery_date: delivery || undefined,
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
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">第 {item.row} 行：{item.message}</Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      });
      return;
    }

    const toImport: Partial<Quotation>[] = [];
    groupMap.forEach((g) => {
      const cust = customerList.find((c: any) => ((c.name || c.code || '').trim() === g.customer.trim()) || ((c.customer_name || '').trim() === g.customer.trim()));
      toImport.push({
        quotation_code: g.code,
        quotation_date: g.date,
        customer_id: cust?.id,
        customer_name: g.customer,
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
        importFn: async (item) =>
          createQuotation(item, {
            autoSubmit: (item.status || '草稿') !== '草稿',
          }),
        title: '正在导入报价单',
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
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(e) => (
                    <List.Item><Typography.Text type="danger">第 {e.row} 行：{e.error}</Typography.Text></List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(`成功导入 ${result.successCount} 条报价单`);
      }
      if (result.successCount > 0) {
        invalidateMenuBadgeCounts();

        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || '导入失败');
    }
  };

  const handleConvert = (record: Quotation) => {
    Modal.confirm({
      title: '转为销售订单',
      content: `确定要将报价单 "${record.quotation_code}" 转为销售订单吗？转换后将创建新的销售订单并建立关联。`,
      onOk: async () => {
        try {
          const res = await convertQuotationToOrder(record.id!);
          const salesOrderId = res.sales_order?.id;
          const orderCode = res.sales_order?.order_code || '';
          messageApi.success({
            content: (
              <span>
                已转为销售订单：
                {salesOrderId ? (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={async () => {
                      setLinkedSalesOrderDrawerOpen(true);
                      setLinkedSalesOrder(null);
                      setLinkedSalesOrderLoading(true);
                      try {
                        const data = await getSalesOrder(salesOrderId, true, true);
                        setLinkedSalesOrder(data);
                      } catch (e: any) {
                        messageApi.error(e?.message || e?.detail || '加载销售订单失败');
                        setLinkedSalesOrderDrawerOpen(false);
                      } finally {
                        setLinkedSalesOrderLoading(false);
                      }
                    }}
                  >
                    {orderCode}
                  </Button>
                ) : (
                  orderCode
                )}
              </span>
            ),
            duration: 6,
          });
          invalidateMenuBadgeCounts();
          invalidateSalesOrderList();

          actionRef.current?.reload();
          closeQuotationDetailDrawer();
        } catch (error: any) {
          messageApi.error(error.message || '转订单失败');
        }
      },
    });
  };

  const handleSubmit = (record: Quotation) => {
    Modal.confirm({
      title: '提交报价单',
      content: quotationAuditRequired
        ? `确定提交报价单「${record.quotation_code || record.id}」？提交后状态将变为「已报价」；若业务蓝图要求审核，将进入待审核。`
        : `确定提交报价单「${record.quotation_code || record.id}」？提交后状态将变为「已报价」。`,
      onOk: async () => {
        try {
          const updated = await submitQuotation(record.id!);
          messageApi.success('提交成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (error: any) {
          messageApi.error(error?.message || error?.detail || '提交失败');
        }
      },
    });
  };

  const handleWithdraw = (record: Quotation) => {
    Modal.confirm({
      title: '撤回报价单',
      content: `确定撤回「${record.quotation_code || record.id}」？将恢复为草稿，可继续编辑或删除。`,
      onOk: async () => {
        try {
          const updated = await withdrawQuotation(record.id!);
          messageApi.success('已撤回');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (error: any) {
          messageApi.error(error?.message || error?.detail || '撤回失败');
        }
      },
    });
  };

  const openRejectModal = (record: Quotation) => {
    setRejectingRecord(record);
    setRejectRemarks('');
    setRejectModalOpen(true);
  };

  const submitReject = async () => {
    if (!rejectingRecord?.id) return;
    try {
      const updated = await rejectQuotation(rejectingRecord.id, {
        review_remarks: rejectRemarks.trim() || undefined,
      });
      messageApi.success('已驳回');
      setRejectModalOpen(false);
      setRejectingRecord(null);
      setRejectRemarks('');
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      setQuotationDetail((prev) => (prev?.id === rejectingRecord.id ? updated : prev));
    } catch (e: any) {
      messageApi.error(e?.message || e?.detail || '驳回失败');
    }
  };

  const handleApprove = (record: Quotation) => {
    Modal.confirm({
      title: '审核通过',
      content: `确定审核通过报价单「${record.quotation_code || record.id}」？`,
      onOk: async () => {
        try {
          const updated = await approveQuotation(record.id!);
          messageApi.success('审核已通过');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handleRevokeReview = (record: Quotation) => {
    Modal.confirm({
      title: '撤回审核',
      content: '确定撤回审核？将回到待审核，需重新审核。',
      onOk: async () => {
        try {
          const updated = await revokeReviewQuotation(record.id!);
          messageApi.success('已撤回审核');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handleConfirmCustomer = (record: Quotation) => {
    Modal.confirm({
      title: '客户确认',
      content: '标记为「客户确认」，表示报价已获客户认可，可继续下推销售订单。',
      onOk: async () => {
        try {
          const updated = await confirmCustomerQuotation(record.id!);
          messageApi.success('已标记客户确认');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handleReopen = (record: Quotation) => {
    Modal.confirm({
      title: '重新编辑',
      content: '将报价单恢复为草稿，修改后可再次提交。',
      onOk: async () => {
        try {
          const updated = await reopenQuotation(record.id!);
          messageApi.success('已恢复草稿');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handleRevokePush = (record: Quotation) => {
    Modal.confirm({
      title: '撤回下推',
      content: '解除与已删除销售订单的关联，恢复为「客户确认」，可再次转销售订单。',
      onOk: async () => {
        try {
          const updated = await revokePushQuotation(record.id!);
          messageApi.success('已撤回下推');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handleRevision = (record: Quotation) => {
    Modal.confirm({
      title: t('app.kuaizhizao.quotation.saveAsRevision'),
      content: t('app.kuaizhizao.quotation.saveAsRevisionHint'),
      onOk: async () => {
        try {
          const created = await createQuotationRevision(record.id!);
          messageApi.success(
            `已创建新版本${created.quotation_code ? `：${created.quotation_code}` : ''}`
          );
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          // 创建新版后直接进入编辑 Modal（与“新建”一致），不再跳详情抽屉。
          setDetailDrawerVisible(false);
          await handleEdit(created);
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || '操作失败');
        }
      },
    });
  };

  const handlePrint = async (record: Quotation) => {
    try {
      const templates = await getPrintTemplateList({
        is_active: true,
        document_type: 'quotation',
      });
      setPrintTemplates(templates || []);
      const defaultTpl = templates.find((t) => t.is_default) ?? templates[0];
      setSelectedPrintTemplateUuid(defaultTpl?.uuid);
    } catch {
      setPrintTemplates([]);
      setSelectedPrintTemplateUuid(undefined);
    }
    setPrintingRecord(record);
    setPrintModalVisible(true);
  };

  const handleOpenPrintTemplateDesign = () => {
    if (selectedPrintTemplateUuid) {
      navigate(`/system/print-templates/design/${selectedPrintTemplateUuid}`);
      return;
    }
    navigate('/system/print-templates');
  };

  const selectedPrintTemplate = useMemo(
    () => printTemplates.find((tpl) => tpl.uuid === selectedPrintTemplateUuid),
    [printTemplates, selectedPrintTemplateUuid],
  );

  const handleToolbarPrint = useCallback(
    async (keys: React.Key[]) => {
      if (!keys || keys.length !== 1) return;
      const numericId = Number(keys[0]);
      if (!Number.isFinite(numericId) || numericId <= 0) {
        messageApi.warning('请选择一条有效记录');
        return;
      }
      try {
        const latest = await getQuotation(numericId);
        if (!canPrintFormalQuotation(latest, quotationAuditRequired)) {
          messageApi.warning(t('app.kuaizhizao.quotation.formalPrintDenied'));
          return;
        }
        await handlePrint(latest);
      } catch (error: any) {
        messageApi.error(error?.message || '加载报价单失败');
      }
    },
    [handlePrint, messageApi, quotationAuditRequired, t]
  );

  const handleToolbarRevision = useCallback(
    async (keys: React.Key[]) => {
      if (!keys || keys.length !== 1) return;
      const numericId = Number(keys[0]);
      if (!Number.isFinite(numericId) || numericId <= 0) {
        messageApi.warning('请选择一条有效记录');
        return;
      }
      try {
        const latest = await getQuotation(numericId);
        if (!canCreateRevision(latest)) {
          messageApi.warning('仅系列最新且非草稿的报价单可创建新版');
          return;
        }
        handleRevision(latest);
      } catch (error: any) {
        messageApi.error(error?.message || '加载报价单失败');
      }
    },
    [handleRevision, messageApi]
  );

  const selectedQuotationForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const numericId = Number(selectedRowKeys[0]);
    if (!Number.isFinite(numericId) || numericId <= 0) return null;
    return lastQuotationsFlatCacheRef.current.find((q) => q.id === numericId) ?? null;
  }, [selectedRowKeys]);

  const buildToolbarPushMenuItems = useCallback(
    (record: Quotation) => {
      const superseded = isQuotationSuperseded(record);
      const convertible = canConvertQuotation(record, quotationAuditRequired);
      return buildUniPushMenuItems([
        {
          key: 'sales-order',
          label: '转销售订单',
          icon: <SwapOutlined />,
          disabled: superseded || !convertible,
          title: superseded ? '该报价单已有修订版，请从最新修订版转销售订单' : undefined,
          onClick: () => {
            if (superseded || !convertible) return;
            void (async () => {
              try {
                const latest = await getQuotation(record.id!);
                handleConvert(latest);
              } catch (error: any) {
                messageApi.error(error?.message || '加载报价单失败');
              }
            })();
          },
        },
      ]);
    },
    [handleConvert, messageApi, quotationAuditRequired],
  );

  const toolbarPushMenuItems = useMemo(
    () => (selectedQuotationForToolbar ? buildToolbarPushMenuItems(selectedQuotationForToolbar) : []),
    [buildToolbarPushMenuItems, selectedQuotationForToolbar],
  );

  const handleConfirmPrint = async () => {
    const record = printingRecord;
    if (!record) return;
    const qid = record.id;
    if (qid == null) {
      messageApi.warning('报价单 ID 无效');
      return;
    }

    const safeCode = String(record.quotation_code || record.id || 'quotation').replace(
      /[/\\?%*:|"<>]/g,
      '-',
    );
    const fileName = `生成PDF_${safeCode}.pdf`;

    const openPdfPreview = (blobUrl: string) => {
      setPdfPreviewBlobUrl(blobUrl);
      setPdfPreviewFileName(fileName);
      setPdfPreviewVisible(true);
    };

    try {
      setPrintSubmitting(true);
      const result: DocumentPrintApiResult = await printQuotation(qid, {
        templateUuid: selectedPrintTemplateUuid,
        outputFormat: 'pdf',
        responseFormat: 'json',
      });
      const raw = result?.content || '';
      if (
        result?.content_encoding === 'base64' &&
        result?.mime_type === 'application/pdf' &&
        raw
      ) {
        const binary = atob(raw);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        openPdfPreview(blobUrl);
        setPrintModalVisible(false);
        setPrintingRecord(null);
        void recordQuotationPrint(qid).catch(() => undefined);
        messageApi.success('已打开预览');
        return;
      }
      messageApi.warning('打印内容为空');
    } catch (error: any) {
      messageApi.error(error.message || '打印失败');
    } finally {
      setPrintSubmitting(false);
    }
  };

  /**
   * 处理新建报价单
   * 参考销售订单：先打开弹窗，再请求 testGenerateCode 预填编号（不占用序号）
   */
  const defaultQuoteItem = {
    material_id: undefined,
    material_code: '',
    material_name: '',
    material_spec: '',
    material_unit: '件',
    quote_quantity: 1,
    unit_price: undefined,
    tax_rate: 0,
    delivery_date: undefined,
    notes: '',
  };

  const handleCreate = async () => {
    formRef.current?.resetFields();
    setEditingId(null);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    setModalVisible(true);
    setTimeout(() => {
      lastPriceTypeRef.current = 'tax_exclusive';
      formRef.current?.setFieldsValue({
        items: [defaultQuoteItem],
        currency_code: defaultQuotationCurrency,
        price_type: 'tax_exclusive',
      });
    }, 100);
    try {
      const config = await getCodeRulePageConfig('kuaizhizao-quotation');
      const autoGen = config?.autoGenerate ?? isAutoGenerateEnabled('kuaizhizao-quotation');
      const ruleCode = config?.ruleCode ?? getPageRuleCode('kuaizhizao-quotation');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(autoGen);
      if (autoGen && ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ quotation_code: preview ?? '' });
        } catch (e) {
          console.warn('报价单编号预生成失败:', e);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
    } catch {
      const ruleCode = getPageRuleCode('kuaizhizao-quotation');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(isAutoGenerateEnabled('kuaizhizao-quotation'));
      if (isAutoGenerateEnabled('kuaizhizao-quotation') && ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ quotation_code: preview ?? '' });
        } catch (e) {
          console.warn('报价单编号预生成失败:', e);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
    }
  };

  const submitCreate = async (values: any, options?: { asDraft?: boolean }) => {
    const validItems = (values.items || []).filter(
      (it: any) =>
        it.material_id && Number(it.quote_quantity) > 0 && Number(it.unit_price) > 0,
    );
    if (!validItems.length) {
      messageApi.error(t('app.kuaizhizao.quotation.validLineHint'));
      throw new Error(t('app.kuaizhizao.quotation.validLineHint'));
    }
    let quotationCode = values.quotation_code;
    const submitRuleCode = effectiveRuleCode || getPageRuleCode('kuaizhizao-quotation');
    const submitAutoEnabled = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-quotation');
    if (submitAutoEnabled && submitRuleCode && (quotationCode === previewCode || !quotationCode)) {
      try {
        const codeResponse = await generateCode({ rule_code: submitRuleCode });
        quotationCode = codeResponse.code;
      } catch (e) {
        console.warn('报价单编号正式生成失败，使用当前值:', e);
      }
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    const customerName = cust?.name ?? cust?.customer_name ?? values.customer_name ?? '';
    await createQuotation(
      {
        quotation_code: quotationCode || undefined,
        quotation_date: toApiDateString(values.quotation_date),
        valid_until: toApiDateString(values.valid_until),
        delivery_date: toApiDateString(values.delivery_date),
        customer_id: values.customer_id,
        customer_name: customerName,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        salesman_id: values.salesman_id,
        salesman_name: values.salesman_name,
        shipping_address: values.shipping_address,
        shipping_method: values.shipping_method,
        payment_terms: values.payment_terms,
        currency_code: values.currency_code ?? defaultQuotationCurrency,
        notes: values.notes,
        price_type: values.price_type === 'tax_inclusive' ? 'tax_inclusive' : 'tax_exclusive',
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_spec: it.material_spec,
          material_unit: it.material_unit,
          quote_quantity: it.quote_quantity,
          unit_price: it.unit_price,
          tax_rate: it.tax_rate ?? 0,
          delivery_date: toApiDateString(it.delivery_date),
          notes: it.notes,
        })),
      },
      { autoSubmit: !options?.asDraft },
    );
    messageApi.success(options?.asDraft ? t('app.kuaizhizao.quotation.savedDraft') : '创建成功');
    setModalVisible(false);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    invalidateMenuBadgeCounts();

    actionRef.current?.reload();
  };

  const handleSaveDraft = async () => {
    try {
      const values = await formRef.current?.validateFields();
      if (values) await submitCreate(values, { asDraft: true });
    } catch (err: any) {
      if (err?.errorFields?.length) {
        messageApi.warning(err?.message ?? t('app.kuaizhizao.quotation.completeRequired'));
      } else if (err?.message !== t('app.kuaizhizao.quotation.validLineHint')) {
        messageApi.error(err?.message ?? t('app.kuaizhizao.quotation.completeRequired'));
      }
    }
  };

  const submitEdit = async (values: any) => {
    if (!editingId) return;
    const validItems = (values.items || []).filter(
      (it: any) =>
        it.material_id && Number(it.quote_quantity) > 0 && Number(it.unit_price) > 0,
    );
    if (!validItems.length) {
      messageApi.error(t('app.kuaizhizao.quotation.validLineHint'));
      throw new Error(t('app.kuaizhizao.quotation.validLineHint'));
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    const customerName = cust?.name ?? cust?.customer_name ?? values.customer_name ?? '';
    await updateQuotation(editingId, {
      quotation_date: toApiDateString(values.quotation_date),
      valid_until: toApiDateString(values.valid_until),
      delivery_date: toApiDateString(values.delivery_date),
      customer_id: values.customer_id,
      customer_name: customerName,
      customer_contact: values.customer_contact,
      customer_phone: values.customer_phone,
      salesman_id: values.salesman_id,
      salesman_name: values.salesman_name,
      shipping_address: values.shipping_address,
      shipping_method: values.shipping_method,
      payment_terms: values.payment_terms,
      currency_code: values.currency_code ?? defaultQuotationCurrency,
      notes: values.notes,
      price_type: values.price_type === 'tax_inclusive' ? 'tax_inclusive' : 'tax_exclusive',
      items: validItems.map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quote_quantity: it.quote_quantity,
        unit_price: it.unit_price,
        tax_rate: it.tax_rate ?? 0,
        delivery_date: toApiDateString(it.delivery_date),
        notes: it.notes,
      })),
    });
    messageApi.success('更新成功');
    setModalVisible(false);
    setEditingId(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    invalidateMenuBadgeCounts();

    actionRef.current?.reload();
  };

  /** 详情-基本信息：顺序按相近职能分组（单据标识 → 客户 → 商务条款 → 交货 → 关联 → 系统） */
  const detailBasicColumns: ProDescriptionsItemProps<Quotation>[] = [
    // —— 单据标识与状态 ——
    { title: '报价单编号', dataIndex: 'quotation_code' },
    {
      title: t('app.kuaizhizao.quotation.colVersion'),
      dataIndex: 'version_no',
      render: (_: unknown, r: Quotation) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{t('app.kuaizhizao.quotation.versionDisplay', { n: r.version_no ?? 1 })}</span>
          {r.is_latest_in_series === false ? (
            <Tag>{t('app.kuaizhizao.quotation.historyTag')}</Tag>
          ) : (
            <Tag color="blue">{t('app.kuaizhizao.quotation.latestTag')}</Tag>
          )}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, r) => {
        const c = getQuotationStatusTagProps(r, quotationAuditRequired);
        return <Tag {...resolveStatusTagDisplayProps(c)}>{c.text}</Tag>;
      },
    },
    // —— 客户信息 ——
    { title: '客户', dataIndex: 'customer_name' },
    { title: '联系人', dataIndex: 'customer_contact' },
    { title: '电话', dataIndex: 'customer_phone' },
    // —— 商务条款（日期、金额、支付、本方责任人）——
    { title: '报价日期', dataIndex: 'quotation_date', valueType: 'date' },
    { title: '有效期至', dataIndex: 'valid_until', valueType: 'date' },
    {
      title: '是否含税',
      dataIndex: 'price_type',
      render: (_: unknown, r: Quotation) =>
        r.price_type === 'tax_inclusive' ? '含税单价' : '不含税单价',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      render: (_, r) => <AmountDisplay resource="sales_order" value={r.total_amount} />,
    },
    {
      title: '币种',
      dataIndex: 'currency_code',
      render: (_: unknown, record: Quotation) => (
        <DictionaryLabel dictionaryCode="CURRENCY" value={record.currency_code || defaultQuotationCurrency} />
      ),
    },
    {
      title: '付款条件',
      dataIndex: 'payment_terms',
      render: (_, record) => {
        const val = record.payment_terms;
        const opt = paymentTermsOptions.find((o) => o.value === val);
        return opt?.label ?? val ?? '-';
      },
    },
    { title: '销售员', dataIndex: 'salesman_name' },
    // —— 交货履约 ——
    { title: '预计交货日期', dataIndex: 'delivery_date', valueType: 'date' },
    {
      title: '发货方式',
      dataIndex: 'shipping_method',
      render: (_, record) => {
        const val = record.shipping_method;
        const opt = shippingMethodOptions.find((o) => o.value === val);
        return opt?.label ?? val ?? '-';
      },
    },
    { title: '收货地址', dataIndex: 'shipping_address', span: 3 },
    // —— 关联与其它 ——
    { title: '关联销售订单', dataIndex: 'sales_order_code' },
    { title: '备注', dataIndex: 'notes', span: 3 },
    // —— 系统信息 ——
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  const openLinkedSalesOrderDrawer = useCallback(
    async (id: number) => {
      setLinkedSalesOrderDrawerOpen(true);
      setLinkedSalesOrder(null);
      setLinkedSalesOrderLoading(true);
      try {
        const data = await getSalesOrder(id, true, true);
        setLinkedSalesOrder(data);
      } catch (e: any) {
        messageApi.error(e?.message || e?.detail || '加载销售订单失败');
        setLinkedSalesOrderDrawerOpen(false);
      } finally {
        setLinkedSalesOrderLoading(false);
      }
    },
    [messageApi]
  );

  const closeLinkedSalesOrderDrawer = useCallback(() => {
    setLinkedSalesOrderDrawerOpen(false);
    setLinkedSalesOrder(null);
    setLinkedSalesOrderLoading(false);
  }, []);

  const closeQuotationDetailDrawer = useCallback(() => {
    closeLinkedSalesOrderDrawer();
    setDetailDrawerVisible(false);
    setQuotationDetail(null);
  }, [closeLinkedSalesOrderDrawer]);

  const appendQuotationItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const pt = formRef.current?.getFieldValue('price_type') ?? 'tax_exclusive';
      const mainDelivery = formRef.current?.getFieldValue('delivery_date');
      const defaultDelivery =
        mainDelivery != null ? (dayjs.isDayjs(mainDelivery) ? mainDelivery : dayjs(mainDelivery)) : dayjs();
      const rowFromMaterial = (m: Material) => {
        const taxR = Number((m as any).defaults?.defaultTaxRate ?? (m as any).defaults?.default_tax_rate) || 0;
        let up = Number((m as any).defaults?.defaultSalePrice ?? (m as any).default_sale_price) || 0;
        if (pt === 'tax_inclusive' && up > 0) {
          up = convertUnitPriceByPriceType(up, taxR, 'tax_exclusive', 'tax_inclusive');
        }
        return {
          material_id: m.id,
          material_code: m.mainCode ?? m.code ?? '',
          material_name: m.name ?? '',
          material_spec: m.specification ?? '',
          material_unit: m.baseUnit ?? '',
          quote_quantity: 1,
          unit_price: up,
          tax_rate: taxR,
          delivery_date: defaultDelivery,
          notes: '',
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
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const formItemContent = (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="quotation_code"
            label="报价单编号"
            placeholder={isAutoGenerateEnabled('kuaizhizao-quotation') ? '编号将根据编号规则自动生成，可修改' : '请输入报价单编号'}
            fieldProps={{ disabled: !!editingId }}
            rules={[{ required: true, whitespace: true, message: '请输入报价单编号' }]}
          />
        </Col>
        <Col span={12}>
          <ProForm.Item name="customer_id" label="客户名称" rules={[{ required: true, message: '请选择客户' }]}>
            <UniDropdown
              placeholder="请选择客户"
              showSearch
              allowClear
              loading={customersLoading}
              style={{ width: '100%' }}
              options={customerList.map((c: any) => ({
                value: c.id ?? c.customer_id,
                label: `${c.code ?? c.customer_code ?? ''} - ${c.name ?? c.customer_name ?? ''}`.trim() || String(c.id ?? c.customer_id),
              }))}
              onChange={(value) => {
                const c = customerList.find((x: any) => (x.id ?? x.customer_id) === value);
                if (c) applyCustomerToQuotationForm(c);
              }}
              quickCreate={{
                label: '快速新建',
                onClick: openCustomerFormForCreate,
              }}
              quickEdit={{
                label: '编辑客户',
                onEdit: (value) => openCustomerFormForEdit(value),
              }}
              advancedSearch={{
                label: '高级搜索',
                fields: [
                  { name: 'code', label: '客户编号' },
                  { name: 'name', label: '客户名称' },
                  { name: 'contactPerson', label: '联系人' },
                ],
                onSearch: async (values) => {
                  let list: any[] = [];
                  try {
                    const res = await customerApi.list({ limit: 200, skip: 0 });
                    list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
                  } catch {
                    return [];
                  }
                  let filtered = list;
                  if (values.code?.trim()) {
                    const k = values.code.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.code ?? '').toLowerCase().includes(k));
                  }
                  if (values.name?.trim()) {
                    const k = values.name.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.name ?? '').toLowerCase().includes(k));
                  }
                  if (values.contactPerson?.trim()) {
                    const k = values.contactPerson.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.contactPerson ?? '').toLowerCase().includes(k));
                  }
                  return filtered.map((c: any) => ({
                    value: c.id ?? c.uuid,
                    label: `${c.code ?? ''} - ${c.name ?? ''}`.trim() || String(c.id ?? c.uuid),
                  }));
                },
              }}
            />
          </ProForm.Item>
        </Col>
      </Row>
      {/* 归属业务员 + 日期 + 发货方式：五列等分（各约 20%） */}
      <Row gutter={16}>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProForm.Item name="salesman_id" label="归属业务员">
            <UniDropdown
              placeholder="请选择归属业务员"
              showSearch
              allowClear
              loading={usersLoading}
              style={{ width: '100%' }}
              options={userList.map((u: any) => ({
                value: u.id,
                label: u.full_name || u.username,
              }))}
              onChange={(_val, opt: any) => {
                formRef.current?.setFieldsValue({ salesman_name: opt?.label });
              }}
            />
          </ProForm.Item>
          <Form.Item name="salesman_name" hidden>
            <Input />
          </Form.Item>
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProFormDatePicker
            name="quotation_date"
            label="报价日期"
            rules={[{ required: true }]}
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProFormDatePicker
            name="valid_until"
            label="有效期至"
            fieldProps={buildQuotationDateShortcutPickerProps(formRef, 'valid_until')}
          />
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProFormDatePicker
            name="delivery_date"
            label="预计交货日期"
            fieldProps={buildQuotationDateShortcutPickerProps(formRef, 'delivery_date')}
          />
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <DictionarySelect
            dictionaryCode="SHIPPING_METHOD"
            name="shipping_method"
            label="发货方式"
            placeholder="请选择发货方式"
            formRef={formRef}
            simpleQuickCreate
            quickCreatePopoverZIndex={quotationNestedElevatedPopupZIndex}
          />
        </Col>
      </Row>
      {/* 联系人 1/6 · 电话 1/6 · 地址 1/3 · 付款条件 1/6 · 币种 1/6 */}
      <Row gutter={16}>
        <Col span={4}>
          <ProFormText name="customer_contact" label="联系人" />
        </Col>
        <Col span={4}>
          <ProFormText name="customer_phone" label="联系人电话" />
        </Col>
        <Col span={8}>
          <ProFormText name="shipping_address" label="收货地址" placeholder="请输入收货地址" />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="PAYMENT_TERMS"
            name="payment_terms"
            label="付款条件"
            placeholder="请选择付款条件"
            formRef={formRef}
            simpleQuickCreate
            quickCreatePopoverZIndex={quotationNestedElevatedPopupZIndex}
          />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="CURRENCY"
            name="currency_code"
            label="币种"
            placeholder="请选择币种"
            formRef={formRef}
            initialValue={defaultQuotationCurrency}
            valueEqualsLabel={false}
            quickCreatePopoverZIndex={quotationNestedElevatedPopupZIndex}
          />
        </Col>
      </Row>
      <ProFormText name="customer_name" hidden />

      <div className="uni-table-detail">
        <UniTableDetailHeader
          title="物料明细"
          required
          leftExtra={(
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
                onChange={handleQuotationPriceTypeToggle}
              />
            </ProForm.Item>
          )}
          onImport={() => setImportModalVisible(true)}
          importText="导入明细"
        />
        <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.price_type !== curr?.price_type}>
          {({ getFieldValue }: any) => {
            const priceType = getFieldValue('price_type') ?? 'tax_exclusive';
            const showTaxColumns = priceType === 'tax_inclusive';
            return (
              <Form.Item
                name="items"
                noStyle
                rules={[{ type: 'array' as const, min: 1, message: '请至少添加一条明细' }]}
              >
                <Form.List name="items">
                  {(fields, { add, remove }) => {
                    const quotationDetailColumns = [
                      {
                        title: '物料',
                        dataIndex: 'material_id',
                        width: 260,
                        render: (_: unknown, __: unknown, index: number) => (
                          <QuotationMaterialSelectCell index={index} />
                        ),
                      },
                      {
                        title: '规格',
                        dataIndex: 'material_spec',
                        width: 120,
                        render: (_: unknown, __: unknown, index: number) => (
                          <Form.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                            <Input placeholder="规格" size="small" />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '单位',
                        dataIndex: 'material_unit',
                        width: 100,
                        render: (_: unknown, __: unknown, index: number) => (
                          <Form.Item
                            noStyle
                            shouldUpdate={(prev: any, curr: any) =>
                              prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id
                            }
                          >
                            {({ getFieldValue: gf }) => {
                              const materialId = gf(['items', index, 'material_id']);
                              return (
                                <Form.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                                  <MaterialUnitSelect materialId={materialId} size="small" noStyle />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        ),
                      },
                      {
                        title: '数量',
                        dataIndex: 'quote_quantity',
                        width: 100,
                        align: 'right' as const,
                        render: (_: unknown, __: unknown, index: number) => (
                          <Form.Item
                            name={[index, 'quote_quantity']}
                            rules={[{ required: true, message: '必填' }]}
                            style={{ margin: 0 }}
                          >
                            <InputNumber
                              placeholder="数量"
                              min={0.01}
                              precision={2}
                              style={{ width: '100%' }}
                              size="small"
                            />
                          </Form.Item>
                        ),
                      },
                      {
                        title:
                          priceType === 'tax_inclusive'
                            ? t('app.kuaizhizao.salesOrder.unitPriceColumnTaxInclusive')
                            : t('app.kuaizhizao.salesOrder.unitPriceColumnTaxExclusive'),
                        dataIndex: 'unit_price',
                        width: 100,
                        align: 'right' as const,
                        render: (_: unknown, __: unknown, index: number) => (
                          <Form.Item
                            name={[index, 'unit_price']}
                            style={{ margin: 0 }}
                            rules={[
                              { required: true, message: t('app.kuaizhizao.salesOrder.unitPriceRequired') },
                              {
                                validator: (_: unknown, value: unknown) => {
                                  const n = Number(value);
                                  if (value == null || value === '') {
                                    return Promise.resolve();
                                  }
                                  if (Number.isNaN(n) || n <= 0) {
                                    return Promise.reject(new Error(t('app.kuaizhizao.salesOrder.unitPricePositive')));
                                  }
                                  return Promise.resolve();
                                },
                              },
                            ]}
                          >
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
                              size="small"
                            />
                          </Form.Item>
                        ),
                      },
                      ...(showTaxColumns
                        ? [
                            {
                              title: t('app.kuaizhizao.salesOrder.exclAmount'),
                              width: 110,
                              align: 'right' as const,
                              render: (_: unknown, __: unknown, index: number) => (
                                <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                  {({ getFieldValue: gf2 }: any) => {
                                    const itemsVal = gf2('items') ?? [];
                                    const row = itemsVal[index];
                                    const line = calcQuotationLineAmounts(
                                      row?.quote_quantity,
                                      row?.unit_price,
                                      row?.tax_rate,
                                      priceType,
                                    );
                                    return <AmountDisplay resource="sales_order" value={line.excl} />;
                                  }}
                                </Form.Item>
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
                                  <Button
                                    type="link"
                                    size="small"
                                    style={{ padding: '0 4px', height: 'auto' }}
                                    onClick={() => {
                                      const itemsVal = formRef.current?.getFieldValue('items') ?? [];
                                      if (itemsVal.length === 0) return;
                                      const rate = prompt(t('app.kuaizhizao.salesOrder.taxRateBatch'), '13');
                                      if (rate != null && rate !== '') {
                                        const num = parseFloat(rate);
                                        if (!Number.isNaN(num) && num >= 0 && num <= 100) {
                                          const next = itemsVal.map((it: any) => ({ ...it, tax_rate: num }));
                                          formRef.current?.setFieldsValue({ items: next });
                                        }
                                      }
                                    }}
                                  >
                                    {t('app.kuaizhizao.salesOrder.batch')}
                                  </Button>
                                </span>
                              ),
                              dataIndex: 'tax_rate',
                              width: 120,
                              align: 'right' as const,
                              render: (_: unknown, __: unknown, index: number) => (
                                <Form.Item name={[index, 'tax_rate']} initialValue={0} style={{ margin: 0 }}>
                                  <InputNumber
                                    placeholder="0"
                                    min={0}
                                    max={100}
                                    precision={2}
                                    addonAfter="%"
                                    style={{ width: '100%' }}
                                    size="small"
                                  />
                                </Form.Item>
                              ),
                            },
                            {
                              title: t('app.kuaizhizao.salesOrder.taxAmount'),
                              width: 100,
                              align: 'right' as const,
                              render: (_: unknown, __: unknown, index: number) => (
                                <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                  {({ getFieldValue: gf2 }: any) => {
                                    const itemsVal = gf2('items') ?? [];
                                    const row = itemsVal[index];
                                    const line = calcQuotationLineAmounts(
                                      row?.quote_quantity,
                                      row?.unit_price,
                                      row?.tax_rate,
                                      priceType,
                                    );
                                    return <AmountDisplay resource="sales_order" value={line.tax} />;
                                  }}
                                </Form.Item>
                              ),
                            },
                          ]
                        : []),
                      {
                        title: showTaxColumns
                          ? t('app.kuaizhizao.salesOrder.inclAmount')
                          : t('app.kuaizhizao.salesOrder.exclAmount'),
                        width: 120,
                        align: 'right' as const,
                        render: (_: unknown, __: unknown, index: number) =>
                          showTaxColumns ? (
                            <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                              {({ getFieldValue: gf2 }: any) => {
                                const itemsVal = gf2('items') ?? [];
                                const row = itemsVal[index];
                                const qty = Number(row?.quote_quantity) || 0;
                                const taxRate = Number(row?.tax_rate) || 0;
                                const line = calcQuotationLineAmounts(
                                  row?.quote_quantity,
                                  row?.unit_price,
                                  row?.tax_rate,
                                  priceType,
                                );
                                const totalIncl = line.incl;
                                const isEditing = quotationEditingIncl?.index === index;
                                const displayValue = isEditing ? quotationEditingIncl.value : totalIncl;
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
                                      quotationEditingInclValueRef.current = v;
                                      setQuotationEditingIncl({ index, value: v });
                                    }}
                                    onFocus={() => {
                                      setQuotationEditingIncl((prev) =>
                                        prev?.index === index ? prev : { index, value: totalIncl },
                                      );
                                      quotationEditingInclValueRef.current = totalIncl;
                                    }}
                                    onBlur={() => {
                                      const incl = quotationEditingInclValueRef.current;
                                      if (quotationEditingIncl?.index === index && incl != null && qty > 0) {
                                        const factor = 1 + taxRate / 100;
                                        const newPrice =
                                          priceType === 'tax_inclusive'
                                            ? incl / qty
                                            : (factor > 0 ? incl / factor : incl) / qty;
                                        const next = [...itemsVal];
                                        next[index] = { ...row, unit_price: newPrice };
                                        formRef.current?.setFieldsValue({ items: next });
                                      }
                                      setQuotationEditingIncl(null);
                                    }}
                                  />
                                );
                              }}
                            </Form.Item>
                          ) : (
                            <QuotationAmountCell index={index} />
                          ),
                      },
                      {
                        title: '交货日期',
                        dataIndex: 'delivery_date',
                        width: 130,
                        render: (_: unknown, __: unknown, index: number) => (
                          <Form.Item name={[index, 'delivery_date']} style={{ margin: 0 }}>
                            <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '备注',
                        dataIndex: 'notes',
                        width: 120,
                        render: (_: unknown, __: unknown, index: number) => (
                          <Form.Item name={[index, 'notes']} style={{ margin: 0 }}>
                            <Input placeholder="备注" size="small" />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '操作',
                        width: 70,
                        fixed: 'right' as const,
                        onHeaderCell: () => ({ className: 'quotation-fixed-op-header' }),
                        render: (_: unknown, __: unknown, index: number) => (
                          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                            删除
                          </Button>
                        ),
                      },
                    ];
                    const totalWidth = quotationDetailColumns.reduce((s, c) => s + (Number(c.width) || 0), 0);
                    return (
                      <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                        {/* 通用表格样式（thead/fix-right/border 等）已迁移到 uni-table-detail/index.less，
                            外层 <div className="uni-table-detail"> 即可生效；这里只保留业务专属的两条：
                            1) 物料列让 Select 占满；2) 数字/文本输入选中态颜色。 */}
                        <style>{`
                    .quotation-detail-table .quotation-material-cell .ant-form-item,
                    .quotation-detail-table .quotation-material-cell .ant-form-item-control,
                    .quotation-detail-table .quotation-material-cell .ant-form-item-control-input,
                    .quotation-detail-table .quotation-material-cell .ant-select {
                      width: 100% !important;
                      min-width: 0;
                    }
                    .quotation-detail-table .ant-input-number-input::selection,
                    .quotation-detail-table .ant-input::selection {
                      background-color: var(--ant-color-primary, #1677ff);
                      color: #fff;
                      border-radius: 0;
                    }
                  `}</style>
                        <div style={{ width: '100%', overflowX: 'auto' }}>
                          <Table
                            className="quotation-detail-table"
                            size="small"
                            dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                            rowKey="key"
                            pagination={false}
                            columns={quotationDetailColumns}
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
                                    add({
                                      material_id: undefined,
                                      material_code: '',
                                      material_name: '',
                                      material_spec: '',
                                      material_unit: '',
                                      quote_quantity: 1,
                                      unit_price: undefined,
                                      tax_rate: 0,
                                      delivery_date: undefined,
                                      notes: '',
                                    });
                                  }}
                                >
                                  添加明细
                                </Button>
                                <Button
                                  type="default"
                                  icon={<AppstoreAddOutlined />}
                                  style={{ flex: 1, minWidth: 120 }}
                                  onClick={() => setMaterialPickerOpen(true)}
                                >
                                  {t('app.kuaizhizao.common.materialBatchSelect')}
                                </Button>
                              </div>
                            )}
                          />
                        </div>
                      </div>
                    );
                  }}
                </Form.List>
              </Form.Item>
            );
          }}
        </Form.Item>
      </div>
      <QuotationFormSummary />
      <ProFormTextArea name="notes" label="备注" fieldProps={{ rows: 2 }} />
      <UniMaterialBatchPicker
        open={materialPickerOpen}
        zIndex={quotationNestedElevatedPopupZIndex}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendQuotationItemsFromMaterials}
      />
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          className="kuaizhizao-quotations-table"
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.quotations"
          tanstackQuery={{
            queryKeyPrefix: ['apps.kuaizhizao.pages.sales-management.quotations', listScopeFilter],
          }}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          headerTitle="报价单"
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          beforeSearchButtons={
            <ThemedSegmented
              key="quotation-list-scope"
              surfaceBackground
              size="middle"
              value={listScopeFilter}
              onChange={(v) => setListScopeFilter(v as QuotationListScope)}
              options={[
                { label: t('app.kuaizhizao.quotation.listScopeAll'), value: 'all' },
                { label: t('app.kuaizhizao.quotation.listScopeMine'), value: 'mine' },
                { label: t('app.kuaizhizao.quotation.listScopeDepartment'), value: 'department' },
              ]}
            />
          }
          toolBarButtonSize="middle"
          showCreateButton
          createButtonText="新建报价单"
          onCreate={handleCreate}
          toolBarActionsAfterCreate={[
            <UniPushToolbarButton
              key={`quotation-push-${selectedQuotationForToolbar?.id ?? 'none'}`}
              menuItems={toolbarPushMenuItems}
              disabled={!selectedQuotationForToolbar}
            />,
          ]}
          enableRowSelection
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条报价单吗？`}
          toolBarActionsAfterDelete={[
            <UniBatchMenuButton
              key="quotation-batch-menu"
              selectedRowKeys={selectedRowKeys}
              menuItems={[
                {
                  key: 'confirmCustomer',
                  label: '批量客户确认',
                  icon: <CommentOutlined />,
                  requireConfirm: true,
                  confirmTitle: '批量客户确认',
                  confirmDescription: (count) =>
                    `确定将选中的 ${count} 条报价单标记为「客户确认」吗？仅「已报价」且符合确认条件的单据会成功。`,
                  onClick: handleBatchConfirmCustomer,
                },
                ...(quotationAuditRequired
                  ? [
                      {
                        key: 'approve',
                        label: '批量审核通过',
                        icon: <CheckOutlined />,
                        onClick: handleBatchApprove,
                      },
                    ]
                  : []),
              ]}
              toolBarButtonSize="middle"
            />,
          ]}
          toolBarActionsAfterBatch={[
            <Button
              key="quotation-revision"
              icon={<BranchesOutlined />}
              size="middle"
              disabled={selectedRowKeys.length !== 1}
              onClick={() => void handleToolbarRevision(selectedRowKeys)}
            >
              {t('app.kuaizhizao.quotation.saveAsRevision')}
            </Button>,
            <Button
              key="quotation-print"
              icon={<PrinterOutlined />}
              size="middle"
              disabled={selectedRowKeys.length !== 1}
              onClick={() => void handleToolbarPrint(selectedRowKeys)}
            >
              {t('app.kuaizhizao.quotation.formalPrint')}
            </Button>,
          ]}
          showImportButton={true}
          onImport={handleListImport}
          importHeaders={['报价单编号', '客户名称', '报价日期', '物料编号', '数量', '单价', '交货日期', '备注']}
          importExampleRow={['QT001', '客户A', '2025-03-08', 'MAT001', '10', '100', '2025-04-01', '']}
          importFieldMap={{
            '报价单编号': 'quotation_code',
            '客户名称': 'customer_name',
            '报价日期': 'quotation_date',
            '物料编号': 'material_code',
            '数量': 'quote_quantity',
            '单价': 'unit_price',
            '交货日期': 'delivery_date',
            '备注': 'notes',
          }}
          importFieldRules={{
            customer_name: { required: true },
            quotation_date: { required: true },
            material_code: { required: true },
            quote_quantity: { required: true },
          }}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listQuotations({ skip: 0, limit: 10000, list_scope: listScopeFilter });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = flattenQuotationTableRows(pageData as QuotationTableRow[]);
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `quotations-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params, _sort, _filter, searchFormValues) => {
            try {
              const dr = searchFormValues?.date_range as [unknown, unknown] | undefined;
              let startDate: string | undefined;
              let endDate: string | undefined;
              if (dr && Array.isArray(dr) && dr[0]) {
                startDate = dayjs(dr[0] as string | Date).format('YYYY-MM-DD');
                endDate = dr[1] ? dayjs(dr[1] as string | Date).format('YYYY-MM-DD') : startDate;
              }
              const response = await listQuotations({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: searchFormValues?.status,
                keyword: searchFormValues?.keyword,
                quotation_code: searchFormValues?.quotation_code,
                customer_name: searchFormValues?.customer_name,
                start_date: startDate,
                end_date: endDate,
                list_scope: listScopeFilter,
              });
              setListTotal(response.total ?? 0);
              const flat = response.data || [];
              lastQuotationsFlatCacheRef.current = flat;
              return {
                data: buildQuotationSeriesTree(flat),
                success: true,
                total: response.total ?? 0,
              };
            } catch {
              messageApi.error('获取报价单列表失败');
              setListTotal(0);
              return { data: [], success: false, total: 0 };
            }
          }}
          expandable={{
            defaultExpandAllRows: true,
            indentSize: 16,
          }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`报价单详情${quotationDetail?.quotation_code ? ` - ${quotationDetail.quotation_code}` : ''}`}
        open={detailDrawerVisible}
        zIndex={quotationDetailDrawerZIndex}
        onClose={closeQuotationDetailDrawer}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          quotationDetail && (
            <Space wrap>
              {canDeleteQuotation(quotationDetail) && (
                <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(quotationDetail)}>删除</Button>
              )}
              {quotationDetail.status === '草稿' && (
                <Button icon={<SendOutlined />} onClick={() => handleSubmit(quotationDetail)}>提交</Button>
              )}
              {canWithdrawQuotation(quotationDetail, quotationAuditRequired) && (
                <Button icon={<RollbackOutlined />} onClick={() => handleWithdraw(quotationDetail)}>撤回</Button>
              )}
              {canApproveQuotation(quotationDetail, quotationAuditRequired) && (
                <Button icon={<CheckOutlined />} onClick={() => handleApprove(quotationDetail)}>审核通过</Button>
              )}
              {canRejectQuotation(quotationDetail, quotationAuditRequired) && (
                <Button icon={<CloseCircleOutlined />} onClick={() => openRejectModal(quotationDetail)}>驳回</Button>
              )}
              {canRevokeReviewQuotation(quotationDetail, quotationAuditRequired) && (
                <Button icon={<UndoOutlined />} onClick={() => handleRevokeReview(quotationDetail)}>撤回审核</Button>
              )}
              {canConfirmCustomerQuotation(quotationDetail, quotationAuditRequired) && (
                <Button icon={<SendOutlined />} onClick={() => handleConfirmCustomer(quotationDetail)}>客户确认</Button>
              )}
              {canReopenQuotation(quotationDetail) && (
                <Button icon={<EditOutlined />} onClick={() => handleReopen(quotationDetail)}>重新编辑</Button>
              )}
              {canConvertQuotation(quotationDetail, quotationAuditRequired) && (
                <Button type="primary" icon={<SwapOutlined />} onClick={() => handleConvert(quotationDetail)}>转销售订单</Button>
              )}
              {canRevokePushQuotation(quotationDetail) && (
                <Button icon={<RollbackOutlined />} onClick={() => handleRevokePush(quotationDetail)}>撤回下推</Button>
              )}
              {canCreateRevision(quotationDetail) && (
                <Button icon={<BranchesOutlined />} onClick={() => handleRevision(quotationDetail)}>
                  {t('app.kuaizhizao.quotation.saveAsRevision')}
                </Button>
              )}
              <Tooltip
                title={
                  canPrintFormalQuotation(quotationDetail, quotationAuditRequired)
                    ? t('app.kuaizhizao.quotation.formalPrint')
                    : t('app.kuaizhizao.quotation.formalPrintDenied')
                }
              >
                <Button
                  icon={<PrinterOutlined />}
                  disabled={!canPrintFormalQuotation(quotationDetail, quotationAuditRequired)}
                  onClick={() =>
                    canPrintFormalQuotation(quotationDetail, quotationAuditRequired) &&
                    handlePrint(quotationDetail)
                  }
                >
                  {t('app.kuaizhizao.quotation.formalPrint')}
                </Button>
              </Tooltip>
            </Space>
          )
        }
        basic={
          quotationDetail ? (
            <Descriptions
              column={3}
              size="small"
              items={buildDescriptionItemsFromColumns(quotationDetail, detailBasicColumns)}
            />
          ) : undefined
        }
        collaborationTitleSuffix={
          showQuotationLifecycleNextInTitle ? (
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {t('components.uniLifecycle.nextStep')}：
              {quotationNextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
            </Typography.Text>
          ) : undefined
        }
        collaborationLifecycle={
          quotationDetail && quotationLifecycleDetail
            ? (() => {
                const lifecycle = quotationLifecycleDetail;
                const mainStages = lifecycle.mainStages ?? [];
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {mainStages.length > 0 ? (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                        hideNextStepSuggestions={hideQuotationStepperNextRow}
                      />
                    ) : null}
                    {quotationDetail.id != null ? (
                      <DetailDrawerInlineFullChain
                        documentType="quotation"
                        documentId={quotationDetail.id}
                        active={detailDrawerVisible}
                        selfDocumentId={quotationDetail.id}
                        renderBriefActions={(doc) =>
                          doc.document_type === 'sales_order' ? (
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => openLinkedSalesOrderDrawer(doc.document_id)}
                            >
                              {t('components.documentTrackingPanel.traceBriefOpenSalesOrder')}
                            </Button>
                          ) : null
                        }
                      />
                    ) : null}
                  </div>
                );
              })()
            : undefined
        }
        lines={
          quotationDetail ? (
            <>
              {quotationDetail.items && quotationDetail.items.length > 0 ? (
                <Table
                    size="small"
                    rowKey="id"
                    tableLayout="fixed"
                    style={{ minWidth: QUOTATION_DETAIL_ITEMS_SCROLL_X }}
                    columns={(() => {
                      const pt = quotationDetail.price_type ?? 'tax_exclusive';
                      const showTax = pt === 'tax_inclusive';
                      type LineIt = NonNullable<Quotation['items']>[number];
                      return [
                        { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: '物料名称', dataIndex: 'material_name', width: 160, ellipsis: true },
                        { title: '规格', dataIndex: 'material_spec', width: 120, ellipsis: true },
                        {
                          title: '单位',
                          dataIndex: 'material_unit',
                          width: 72,
                          ellipsis: true,
                          render: (v: string) => <DictionaryLabel dictionaryCode="MATERIAL_UNIT" value={v} />,
                        },
                        { title: '报价数量', dataIndex: 'quote_quantity', width: 100, align: 'right' as const },
                        {
                          title: '单价',
                          dataIndex: 'unit_price',
                          width: 100,
                          align: 'right' as const,
                          render: (v: number) => <AmountDisplay resource="sales_order" value={v} />,
                        },
                        ...(showTax
                          ? [
                              {
                                title: '不含税金额',
                                key: 'line_excl',
                                width: 100,
                                align: 'right' as const,
                                render: (_: unknown, it: LineIt) => {
                                  const line = calcQuotationLineAmounts(
                                    it.quote_quantity,
                                    it.unit_price,
                                    it.tax_rate,
                                    pt,
                                  );
                                  return <AmountDisplay resource="sales_order" value={line.excl} />;
                                },
                              },
                              {
                                title: '税率(%)',
                                dataIndex: 'tax_rate',
                                width: 72,
                                align: 'right' as const,
                              },
                              {
                                title: '税额',
                                key: 'line_tax',
                                width: 90,
                                align: 'right' as const,
                                render: (_: unknown, it: LineIt) => {
                                  const line = calcQuotationLineAmounts(
                                    it.quote_quantity,
                                    it.unit_price,
                                    it.tax_rate,
                                    pt,
                                  );
                                  return <AmountDisplay resource="sales_order" value={line.tax} />;
                                },
                              },
                            ]
                          : []),
                        {
                          title: showTax ? '价税合计' : '未税金额',
                          key: 'line_amount_display',
                          width: 100,
                          align: 'right' as const,
                          render: (_: unknown, it: LineIt) => {
                            const line = calcQuotationLineAmounts(
                              it.quote_quantity,
                              it.unit_price,
                              it.tax_rate,
                              pt,
                            );
                            return (
                              <AmountDisplay
                                resource="sales_order"
                                value={showTax ? line.incl : line.excl}
                              />
                            );
                          },
                        },
                        { title: '交货日期', dataIndex: 'delivery_date', width: 120, ellipsis: true },
                        { title: '备注', dataIndex: 'notes', width: 160, ellipsis: true },
                      ];
                    })()}
                    dataSource={quotationDetail.items}
                    pagination={false}
                  />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
              )}
            </>
          ) : undefined
        }
        timeline={
          quotationDetail?.id != null ? (
            <>
              {quotationTracking.loading && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin />
                </div>
              )}
              {quotationTracking.error && !quotationTracking.loading && (
                <Typography.Text type="danger">{quotationTracking.error}</Typography.Text>
              )}
              {quotationTracking.data && !quotationTracking.loading && (
                <DocumentTrackingTimelineBody data={quotationTracking.data} />
              )}
            </>
          ) : undefined
        }
      />

      <DetailDrawerTemplate
        title={`销售订单详情${linkedSalesOrder?.order_code ? ` - ${linkedSalesOrder.order_code}` : ''}`}
        open={linkedSalesOrderDrawerOpen}
        onClose={closeLinkedSalesOrderDrawer}
        width={LINKED_DOCUMENT_DRAWER_WIDTH}
        zIndex={linkedSalesOrderDrawerZIndex}
        extra={
          <Button
            type="link"
            size="small"
            onClick={() => {
              closeLinkedSalesOrderDrawer();
              navigate('/apps/kuaizhizao/sales-management/sales-orders');
            }}
          >
            前往销售订单管理
          </Button>
        }
        plainBody={
          linkedSalesOrder ? (
            <SalesOrderDetailBody
              order={linkedSalesOrder}
              auditRequired={salesOrderAuditRequired}
            />
          ) : linkedSalesOrderLoading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : null
        }
      />

      <FormModalTemplate
        title={editingId != null ? '编辑报价单' : '新建报价单'}
        open={modalVisible}
        zIndex={quotationElevatedModalZIndex}
        onClose={() => { setModalVisible(false); setEditingId(null); setEffectiveRuleCode(null); setEffectiveAutoGen(null); }}
        onFinish={async (values) => {
          if (editingId != null) await submitEdit(values);
          else await submitCreate(values);
        }}
        isEdit={editingId != null}
        formRef={formRef}
        width={1200}
        layout="vertical"
        extraFooter={
          editingId == null ? (
            <Button onClick={() => void handleSaveDraft()}>{t('app.kuaizhizao.quotation.saveDraft')}</Button>
          ) : undefined
        }
        initialValues={editingId == null ? { quotation_date: dayjs(), currency_code: defaultQuotationCurrency } : undefined}
        onValuesChange={(changed, _all) => {
          if ('customer_id' in changed && changed.customer_id != null) {
            const c = customerList.find((x: any) => (x.id ?? x.customer_id) === changed.customer_id);
            if (c) {
              const sId = c.salesmanId ?? c.salesman_id;
              const salesman = userList.find((u) => u.id === sId);
              const sName = c.salesmanName ?? c.salesman_name ?? (salesman ? (salesman.full_name || salesman.username) : '');
              formRef.current?.setFieldsValue({
                customer_name: c.name ?? c.customer_name,
                customer_contact: c.contactPerson ?? c.contact_person ?? c.contact ?? c.customer_contact,
                customer_phone: c.phone ?? c.customer_phone,
                salesman_id: sId,
                salesman_name: sName,
              });
            }
          }
        }}
      >
        {formItemContent}
      </FormModalTemplate>

      <CustomerFormModal
        open={customerFormOpen}
        zIndex={quotationNestedElevatedPopupZIndex}
        onClose={() => {
          setCustomerFormOpen(false);
          setCustomerEditUuid(null);
        }}
        editUuid={customerEditUuid}
        onSuccess={(customer) => {
          setCustomerList((prev) => {
            const matchKey = customer.uuid ?? customer.id;
            const idx = prev.findIndex((c) => (c.uuid ?? c.id) === matchKey);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...customer };
              return next;
            }
            return [...prev, customer];
          });
          applyCustomerToQuotationForm(customer as Record<string, any>);
          setCustomerFormOpen(false);
          setCustomerEditUuid(null);
        }}
      />

      <Suspense fallback={null}>
        <LazySyncFromDatasetModal
          open={syncModalVisible}
          zIndex={quotationElevatedModalZIndex}
          onClose={() => setSyncModalVisible(false)}
          onConfirm={handleSyncConfirm}
          title="从数据集同步报价单"
        />

        <LazyUniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleItemImport}
          title="导入报价明细"
          headers={['物料编号', '规格', '单位', '数量', '单价', '交货日期']}
          exampleRow={['MAT001', 'Spec X', 'PCS', '100', '1.5', '2026-03-01']}
        />
      </Suspense>

      <CustomerFollowUpFormModal
        open={followUpModalOpen}
        zIndex={quotationElevatedModalZIndex}
        editing={null}
        preset={followUpPreset}
        onClose={() => {
          setFollowUpModalOpen(false);
          setFollowUpPreset(null);
        }}
      />

      <Modal
        title="驳回报价单"
        open={rejectModalOpen}
        zIndex={quotationElevatedModalZIndex}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        onOk={submitReject}
        onCancel={() => {
          setRejectModalOpen(false);
          setRejectingRecord(null);
          setRejectRemarks('');
        }}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
          报价单：{rejectingRecord?.quotation_code ?? rejectingRecord?.id ?? '-'}
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          value={rejectRemarks}
          onChange={(e) => setRejectRemarks(e.target.value)}
          placeholder="可选：驳回原因"
          maxLength={500}
          showCount
        />
      </Modal>

      <Modal
        open={printModalVisible}
        title="选择打印模板"
        width={MODAL_CONFIG.TINY_WIDTH}
        zIndex={quotationElevatedModalZIndex}
        onCancel={() => {
          if (printSubmitting) return;
          setPrintModalVisible(false);
          setPrintingRecord(null);
        }}
        onOk={handleConfirmPrint}
        okText="预览打印"
        okButtonProps={{ icon: <PrinterOutlined /> }}
        confirmLoading={printSubmitting}
        destroyOnHidden
        styles={{ body: { paddingTop: 4, paddingBottom: 8 } }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorFillAlter} 100%)`,
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                right: -24,
                top: -24,
                width: 88,
                height: 88,
                borderRadius: '50%',
                background: `${token.colorPrimary}12`,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: token.borderRadius,
                background: token.colorBgContainer,
                border: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: token.colorPrimary,
                fontSize: 18,
                flexShrink: 0,
                boxShadow: token.boxShadowTertiary,
              }}
            >
              <FileTextOutlined />
            </div>
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                当前报价单
              </Typography.Text>
              <Typography.Text
                strong
                style={{
                  fontSize: 16,
                  letterSpacing: 0.4,
                  fontVariantNumeric: 'tabular-nums',
                  color: token.colorText,
                }}
              >
                {printingRecord?.quotation_code ?? printingRecord?.id ?? '-'}
              </Typography.Text>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px 12px',
              borderRadius: token.borderRadiusLG,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
              boxShadow: token.boxShadowTertiary,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Space size={6}>
                <PrinterOutlined style={{ color: token.colorPrimary, fontSize: 14 }} />
                <Typography.Text strong>打印模板</Typography.Text>
              </Space>
              <Button
                type="link"
                size="small"
                icon={<FormOutlined />}
                onClick={handleOpenPrintTemplateDesign}
                style={{
                  padding: '0 8px',
                  height: 26,
                  borderRadius: token.borderRadiusSM,
                  background: token.colorPrimaryBg,
                  flexShrink: 0,
                }}
              >
                {t('app.kuaizhizao.quotation.printTemplateDesign')}
              </Button>
            </div>
            {printTemplates.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无可用打印模板"
                style={{ margin: '8px 0 4px' }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxHeight: 260,
                  overflowY: 'auto',
                  paddingRight: 2,
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPrintTemplateUuid(undefined)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPrintTemplateUuid(undefined);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: token.borderRadius,
                    border: `1px solid ${selectedPrintTemplateUuid == null ? token.colorPrimary : token.colorBorderSecondary}`,
                    background: selectedPrintTemplateUuid == null ? token.colorPrimaryBg : token.colorFillAlter,
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: token.borderRadiusSM,
                      background: token.colorBgContainer,
                      border: `1px solid ${token.colorBorderSecondary}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: token.colorTextSecondary,
                      flexShrink: 0,
                    }}
                  >
                    <PrinterOutlined />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Typography.Text strong>系统默认模板</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
                      由后端自动匹配报价单默认模板
                    </Typography.Text>
                  </div>
                  {selectedPrintTemplateUuid == null ? (
                    <CheckOutlined style={{ color: token.colorPrimary, flexShrink: 0 }} />
                  ) : null}
                </div>
                {printTemplates.map((tpl) => {
                  const selected = selectedPrintTemplateUuid === tpl.uuid;
                  return (
                    <div
                      key={tpl.uuid}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPrintTemplateUuid(tpl.uuid)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedPrintTemplateUuid(tpl.uuid);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: token.borderRadius,
                        border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
                        background: selected ? token.colorPrimaryBg : token.colorFillAlter,
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: token.borderRadiusSM,
                          background: token.colorBgContainer,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: selected ? token.colorPrimary : token.colorTextSecondary,
                          flexShrink: 0,
                        }}
                      >
                        <FileTextOutlined />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Space size={6} wrap>
                          <Typography.Text strong ellipsis style={{ maxWidth: 280 }}>
                            {tpl.name}
                          </Typography.Text>
                          {tpl.is_default ? <Tag color="blue" style={{ margin: 0 }}>默认</Tag> : null}
                        </Space>
                        {tpl.description ? (
                          <Typography.Text
                            type="secondary"
                            ellipsis
                            style={{ fontSize: 12, display: 'block', marginTop: 2 }}
                          >
                            {tpl.description}
                          </Typography.Text>
                        ) : (
                          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
                            {tpl.code}
                          </Typography.Text>
                        )}
                      </div>
                      {selected ? <CheckOutlined style={{ color: token.colorPrimary, flexShrink: 0 }} /> : null}
                    </div>
                  );
                })}
              </div>
            )}
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, marginTop: 10, display: 'block', lineHeight: 1.5 }}
            >
              {selectedPrintTemplate
                ? `已选「${selectedPrintTemplate.name}」，预览后将生成 PDF 报价文件`
                : '将使用系统默认报价单模板生成 PDF'}
            </Typography.Text>
          </div>
        </Space>
      </Modal>

      <UniPdfPreview
        open={pdfPreviewVisible}
        title={pdfPreviewFileName}
        src={pdfPreviewBlobUrl || undefined}
        inset={16}
        onDownload={() => {
          if (pdfPreviewBlobUrl) {
            const a = document.createElement('a');
            a.href = pdfPreviewBlobUrl;
            a.download = pdfPreviewFileName;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
        }}
        onPrint={() => {
          try {
            window.print();
          } catch {
            // no-op
          }
        }}
        onClose={() => {
          setPdfPreviewVisible(false);
          if (pdfPreviewBlobUrl) {
            URL.revokeObjectURL(pdfPreviewBlobUrl);
            setPdfPreviewBlobUrl(null);
          }
        }}
      />
    </>
  );
};

export default QuotationsPage;
