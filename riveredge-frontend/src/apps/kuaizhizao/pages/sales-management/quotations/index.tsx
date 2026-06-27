import { rowActionKind, rowActionAddFollowUpFromDocument } from '../../../../../components/uni-action';
/**
 * 报价单管理页面
 *
 * 提供报价单的创建、查看、编辑、删除和转销售订单功能。
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useInvalidateSalesOrderList } from '../../../../../hooks/useInvalidateSalesOrderList';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, InputNumber, Input, Row, Col, DatePicker, List, Typography, theme as AntdTheme, Descriptions, Empty, Spin, Tooltip, Card } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SwapOutlined, PrinterOutlined, ImportOutlined, AppstoreAddOutlined, SendOutlined, CommentOutlined, RollbackOutlined, CheckOutlined, CloseCircleOutlined, UndoOutlined, BranchesOutlined, ReloadOutlined, FileTextOutlined, FormOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { ProForm, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { UniTable, invalidateUniTableListCache } from '../../../../../components/uni-table';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { UniBatchButton, UniAuditBatchMenuButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import {
  MaterialUnitSelect,
  prefetchMaterialsForUnitSelect,
  registerMaterialsForUnitSelect,
} from '../../../../../components/material-unit-select';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import PriceTypeSwitch, { type PriceTypeValue } from '../../../../../components/price-type-switch/PriceTypeSwitch';
import { deferConvertLineItemsByPriceType, setFormPriceType } from '../../../../../utils/priceTypeSwitch';
import {
  DEFAULT_SALES_PRICE_TYPE,
  normalizeSalesPriceType,
  salesFormPriceType,
} from '../shared/salesPriceType';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import { getMaterialField } from '../../../../../components/uni-material-batch-picker/utils';
import type { Material } from '../../../../master-data/types/material';
import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';
import { customerApi, unwrapSupplyPagedList } from '../../../../master-data/services/supply-chain';
import {
  applySalesDocumentLineMaterialPricing,
  getMaterialDefaultTaxRate,
  resolveMaterialForPricing,
  resolveOrderLineSalePrice,
  resolveSalesDocumentMaterialLinesPricing,
} from '../../../../master-data/utils/resolve-partner-material-price';
import { OrderLineVariantAttributesCell } from '../../../../master-data/components/OrderLineVariantAttributesCell';
import { parseVariantAttributesValue } from '../../../../master-data/components/VariantAttributeFields';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerInlineFullChain, DRAWER_CONFIG, MODAL_CONFIG, MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET, MODAL_NESTED_ABOVE_PARENT_OFFSET, PAGE_SPACING, DocumentFormPageLayout, DocumentFormPageHeaderActions, DOCUMENT_DETAIL_PAGE_TITLE_STYLE } from '../../../../../components/layout-templates';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../shared/listAuditPhaseColumn';
import { DetailLifecycleCollaborationBlock } from '../../../../../components/uni-audit/DetailAuditPhaseRow';
import { AmountDisplay } from '../../../../../components/permission';
import { DocumentAmountSummaryWatch } from '../../../components/document-amount-summary/DocumentAmountSummary';
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
  cancelCustomerConfirmQuotation,
  reopenQuotation,
  revokePushQuotation,
  createQuotationRevision,
  recordQuotationPrint,
  Quotation,
} from '../../../services/quotation';
import { getSalesOrder, type SalesOrder } from '../../../services/sales-order';
import { salesContractApi } from '../../../services/sales-contract';
import { SalesOrderDetailBody } from '../sales-orders/components/SalesOrderDetailBody';
import { getQuotationLifecycle } from '../../../utils/quotationLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import {
  DocumentTrackingTimelineBody,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { apiRequest } from '../../../../../services/api';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { batchImport } from '../../../../../utils/batchOperations';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import { formDateFormItemProps, formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import { useTranslation } from 'react-i18next';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../../utils/spreadsheetImportTemplate';
import { useConfigStore } from '../../../../../stores/configStore';
import { useGlobalStore } from '../../../../../stores';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  isQuotationRowSelectable,
  quotationBatchDeleteAllowed,
  quotationCanPushToSalesOrder,
  quotationCapabilityAllowed,
  quotationCapabilityReasonMessage,
  useQuotationCapabilities,
} from '../../../../../hooks/useDocumentCapabilities';
import { hasModulePermission, hasReviewPermission } from '../../../../../utils/permissionContract';
import { searchUserDisplay, type User } from '../../../../../services/user';
import { displayItemsToUsers, normalizeUserDisplayName } from '../../../../../utils/userDisplay';
import { CustomerFollowUpFormModal, type CustomerFollowUpPreset } from '../../../components/CustomerFollowUpFormModal';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import {
  DOCUMENT_DETAIL_CONTROL_SIZE,
  DOCUMENT_DETAIL_TABLE_PROPS,
  TaxRateBatchColumnTitle,
  TaxRateDetailCell,
} from '../../../components/document-detail-table/documentDetailTable';
import { RE_STATUS_BADGE_DRAFT, resolveStatusTagDisplayProps } from '../../../../../constants/statusBadges';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import {
  alignDescriptionColumns,
  alignProColumns,
  getSalesCommonFormLabels,
  SALES_DOC_DETAIL_BASIC_FIELD_RANK,
  SALES_DOC_LIST_FIELD_RANK,
} from '../shared/documentFieldAlignment';
import { buildDescriptionItemsFromColumns } from '../shared/descriptionItems';
import { applyCustomerFormFields } from '../shared/applyCustomerFormFields';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

const QUOTATION_LIST_PATH = '/apps/kuaizhizao/sales-management/quotations';
const QUOTATION_TABLE_CACHE_ID = 'apps.kuaizhizao.pages.sales-management.quotations';
const QUOTATION_CREATE_PATH = `${QUOTATION_LIST_PATH}/new`;
const quotationEditPath = (id: number) => `${QUOTATION_LIST_PATH}/${id}/edit`;
import { KUAIZHIZAO_QUOTATION_FIELD_RESOURCE as QUOTATION_FIELD_RESOURCE } from '../../../../../constants/fieldPermissionResources';

const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport }))
);
const LazySyncFromDatasetModal = lazy(() => import('../../../../../components/sync-from-dataset-modal'));

/** 详情/列表状态 Tag：与生命周期主轴文案一致（含待审核等子态） */
function getQuotationStatusTagProps(
  record: Quotation,
  auditRequired: boolean,
  t: (key: string, options?: Record<string, unknown>) => string,
): { text: string; color: string } {
  const lc = getQuotationLifecycle(record, auditRequired, t);
  if (lc.status === 'exception') return { text: lc.stageName, color: 'error' };
  if (lc.status === 'success') return { text: lc.stageName, color: 'success' };
  const activeKey = lc.mainStages?.find((s) => s.status === 'active')?.key;
  if (activeKey === 'draft') return { text: lc.stageName, color: RE_STATUS_BADGE_DRAFT };
  if (activeKey === 'converted') return { text: lc.stageName, color: 'success' };
  return { text: lc.stageName, color: 'processing' };
}

/** 列表快速筛选：DB status → 生命周期展示（筛选值仍为后端 status） */
function getQuotationStatusFilterEnum(t: (key: string) => string) {
  return {
    草稿: { text: t('app.kuaizhizao.quotation.statusFilter.draft') },
    已发送: { text: t('app.kuaizhizao.quotation.statusFilter.sent') },
    已接受: { text: t('app.kuaizhizao.quotation.statusFilter.accepted') },
    已转订单: { text: t('app.kuaizhizao.quotation.statusFilter.converted') },
    已拒绝: { text: t('app.kuaizhizao.quotation.statusFilter.rejected') },
  } as const;
}

type QuotationListScope = 'all' | 'mine' | 'department';

/** 列表数据范围默认值：管理员看全部，其余看「我的」（与 main 中 persist 预水合后的 currentUser 一致） */
function resolveDefaultQuotationListScope(): QuotationListScope {
  const u = useGlobalStore.getState().currentUser;
  if (u?.is_tenant_admin || u?.is_infra_admin) return 'all';
  return 'mine';
}

function quotationStatusNorm(q: Quotation): string {
  return (q.status || '').trim();
}

/** 系列已有更新修订版，不可再从旧版下推 */
function isQuotationSuperseded(q: Quotation): boolean {
  return (
    q.is_latest_in_series === false &&
    q.superseded_by_id != null &&
    Number(q.superseded_by_id) > 0
  );
}

/** ProForm 提交时日期可能是 dayjs、字符串或 Date，避免直接调用 .format 报错 */
function toApiDateString(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  if (dayjs.isDayjs(v)) return v.isValid() ? v.format('YYYY-MM-DD') : undefined;
  const d = dayjs(v as string | Date | number);
  return d.isValid() ? d.format('YYYY-MM-DD') : undefined;
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
  return nodes;
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

/** 报价明细表：表头左对齐，表身文字左 / 数字右 */
const QUOTATION_DETAIL_TEXT_COL = { align: 'left' as const };
const QUOTATION_DETAIL_NUM_COL = {
  align: 'right' as const,
  onHeaderCell: () => ({ style: { textAlign: 'left' as const } }),
};
const QUOTATION_DETAIL_AMOUNT_STYLE: React.CSSProperties = { display: 'block', textAlign: 'right' };

/** 归属业务员：与销售订单一致，用 display API 选项并在无匹配时用 salesman_name 回显 */
const QuotationSalesmanField: React.FC<{ userList: User[]; loading: boolean }> = ({ userList, loading }) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const salesmanId = Form.useWatch('salesman_id', form);
  const salesmanName = Form.useWatch('salesman_name', form);

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
  }, [userList, salesmanId, salesmanName]);

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
      <Form.Item name="salesman_name" hidden>
        <Input />
      </Form.Item>
    </>
  );
};

const QuotationMaterialSelectCell: React.FC<{
  index: number;
  materialList: Material[];
  sourceType?: string;
}> = ({
  index,
  materialList,
  sourceType,
}) => {
  const { t } = useTranslation();
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
  const onMaterialPicked = useCallback(
    (_val: number | undefined, material: Material | undefined) => {
      if (!material) return;
      form.setFieldValue(
        ['items', index, '_sourceType'],
        (material as any)?.sourceType || (material as any)?.source_type,
      );
      form.setFieldValue(['items', index, '_masterMaterialUuid'], material.uuid);
      form.setFieldValue(['items', index, 'variant_attributes'], undefined);
      void applySalesDocumentLineMaterialPricing(form, index, material, {
        materialList,
        asOfField: 'quotation_date',
      });
    },
    [form, index, materialList],
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
          placeholder={t('app.kuaizhizao.quotation.form.selectMaterial')}
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
          fallbackOption={fallback}
          formItemProps={{ style: { margin: 0 } }}
          showQuickCreate
          showAdvancedSearch
          sourceType={sourceType}
          onChange={onMaterialPicked}
        />
        <Form.Item name={[index, 'material_code']} hidden>
          <Input />
        </Form.Item>
        <Form.Item name={[index, 'material_name']} hidden>
          <Input />
        </Form.Item>
      </div>
    </div>
  );
};

/** 不含税模式下仅展示未税金额列；含税模式下列为可编辑价税合计，本组件仅用于不含税简化列 */
const QuotationAmountCell: React.FC<{ index: number }> = ({ index }) => {
  const row = Form.useWatch(['items', index]);
  const priceType = salesFormPriceType(Form.useWatch('price_type'));
  const line = calcQuotationLineAmounts(row?.quote_quantity, row?.unit_price, row?.tax_rate, priceType);
  return (
    <AmountDisplay
      resource={QUOTATION_FIELD_RESOURCE}
      fieldName="amount_without_tax"
      value={line.excl}
      style={QUOTATION_DETAIL_AMOUNT_STYLE}
    />
  );
};

function resolveQuotationLineMaterialFields(
  it: any,
  materialList: any[],
): { material_code: string; material_name: string } {
  const mid = it?.material_id != null ? Number(it.material_id) : NaN;
  const matched = Number.isFinite(mid)
    ? materialList.find((m: any) => Number(m.id) === mid)
    : undefined;
  const material_code =
    String(it?.material_code ?? '').trim() ||
    String(getMaterialField(matched ?? {}, 'mainCode') ?? getMaterialField(matched ?? {}, 'code') ?? '').trim();
  const material_name =
    String(it?.material_name ?? '').trim() ||
    String(getMaterialField(matched ?? {}, 'name') ?? '').trim();
  return { material_code, material_name };
}

function mapQuotationSubmitItem(it: any, materialList: any[]) {
  const { material_code, material_name } = resolveQuotationLineMaterialFields(it, materialList);
  return {
    material_id: it.material_id,
    material_code,
    material_name,
    material_spec: it.material_spec,
    material_unit: it.material_unit,
    quote_quantity: it.quote_quantity,
    unit_price: it.unit_price,
    tax_rate: it.tax_rate ?? 0,
    variant_attributes: parseVariantAttributesValue(it.variant_attributes) ?? it.variant_attributes,
    delivery_date: toApiDateString(it.delivery_date),
    notes: it.notes,
  };
}

const QuotationFormSummary: React.FC = () => (
  <DocumentAmountSummaryWatch variant="lines" quantityField="quote_quantity" />
);

const QUOTATION_RESOURCE = 'kuaizhizao:quotation';
const SALES_CONTRACT_RESOURCE = 'kuaizhizao:sales-contract';
const SALES_CONTRACT_LIST_PATH = '/apps/kuaizhizao/sales-management/sales-contracts';
const salesContractEditPath = (id: number) => `${SALES_CONTRACT_LIST_PATH}/${id}/edit`;

const QuotationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const pushToSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'sales_order.pull_from_quotation');
  const pushToSalesContractAction = resolveKuaizhizaoDocumentAction(t, 'sales_contract.pull_from_quotation');
  const salesCommonFormLabels = useMemo(() => getSalesCommonFormLabels(t), [t]);
  const quotationStatusFilterEnum = useMemo(() => getQuotationStatusFilterEnum(t), [t]);
  const { token } = AntdTheme.useToken();
  const quotationDetailDrawerZIndex = token.zIndexPopupBase;
  const linkedSalesOrderDrawerZIndex = token.zIndexPopupBase + 50;
  const quotationElevatedModalZIndex = token.zIndexPopupBase + MODAL_ABOVE_DETAIL_SIDECHAIN_OFFSET;
  const quotationNestedElevatedPopupZIndex = quotationElevatedModalZIndex + MODAL_NESTED_ABOVE_PARENT_OFFSET;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isCreatePage = location.pathname.endsWith('/quotations/new');
  const editRouteMatch = location.pathname.match(/\/quotations\/(\d+)\/edit$/);
  const editRouteId = editRouteMatch ? Number(editRouteMatch[1]) : null;
  const isEditPage = editRouteId != null && Number.isFinite(editRouteId) && editRouteId > 0;
  const isFormPage = isCreatePage || isEditPage;
  const formPageInitializedRef = useRef(false);
  const { message: messageApi } = App.useApp();
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal({
    onAfterPrint: async (target) => {
      await recordQuotationPrint(target.documentId).catch(() => undefined);
    },
  });
  const defaultQuotationCurrency = useConfigStore((s) => {
    const c = s.configs.default_currency;
    return typeof c === 'string' && c.trim() !== '' ? c.trim() : 'CNY';
  });
  const actionRef = useRef<ActionType>(null);
  const lastQuotationsFlatCacheRef = useRef<Quotation[]>([]);
  const pendingListReloadRef = useRef(false);
  const queryClient = useQueryClient();
  const [listScopeFilter, setListScopeFilter] = useState<QuotationListScope>(resolveDefaultQuotationListScope);
  const listScopeFilterRef = useRef(listScopeFilter);
  listScopeFilterRef.current = listScopeFilter;
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const invalidateSalesOrderList = useInvalidateSalesOrderList();

  const quotationImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', labelKey: 'app.kuaizhizao.quotation.import.code', aliases: ['报价单编号', '编号'] },
          {
            field: 'customer',
            required: true,
            labelKey: 'app.kuaizhizao.quotation.import.customerName',
            aliases: ['客户', '客户名称'],
          },
          {
            field: 'date',
            required: true,
            labelKey: 'app.kuaizhizao.quotation.import.quotationDate',
            aliases: ['报价日期', '日期'],
          },
          {
            field: 'material',
            required: true,
            labelKey: 'app.kuaizhizao.quotation.import.materialCode',
            aliases: ['产品', '产品编号'],
          },
          { field: 'quantity', required: true, labelKey: 'app.kuaizhizao.quotation.import.quantity', aliases: ['数量'] },
          { field: 'unitPrice', labelKey: 'app.kuaizhizao.quotation.import.unitPrice', aliases: ['单价'] },
          { field: 'delivery', labelKey: 'app.kuaizhizao.quotation.import.deliveryDate', aliases: ['交货日期'] },
          { field: 'notes', labelKey: 'app.kuaizhizao.quotation.import.notes', aliases: ['备注'] },
        ],
        [
          t('app.kuaizhizao.quotation.importExample.code'),
          t('app.kuaizhizao.quotation.importExample.customerName'),
          t('app.kuaizhizao.quotation.importExample.quotationDate'),
          t('app.kuaizhizao.quotation.importExample.materialCode'),
          t('app.kuaizhizao.quotation.importExample.quantity'),
          t('app.kuaizhizao.quotation.importExample.unitPrice'),
          t('app.kuaizhizao.quotation.importExample.deliveryDate'),
          '',
        ],
      ),
    [t, i18n.language],
  );
  const tableSearchFormRef = useRef<any>(null);
  const [listTotal, setListTotal] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  /** 列表当前页扁平数据（唯一源：UniTable onTableDataChange，与表格展示一致） */
  const [tableQuotationsFlat, setTableQuotationsFlat] = useState<Quotation[]>([]);
  const invalidateQuotationListCache = useCallback(() => {
    invalidateUniTableListCache(queryClient, QUOTATION_TABLE_CACHE_ID);
    lastQuotationsFlatCacheRef.current = [];
    setTableQuotationsFlat([]);
  }, [queryClient]);
  const scheduleQuotationListReload = useCallback(() => {
    invalidateQuotationListCache();
    pendingListReloadRef.current = true;
  }, [invalidateQuotationListCache]);
  const reloadQuotationList = useCallback(() => {
    invalidateQuotationListCache();
    actionRef.current?.reloadAndRest?.() ?? actionRef.current?.reload?.();
  }, [invalidateQuotationListCache]);
  const clearTableSelection = useCallback(() => {
    actionRef.current?.clearSelected?.();
    setSelectedRowKeys([]);
  }, []);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [quotationDetail, setQuotationDetail] = useState<Quotation | null>(null);
  const quotationTracking = useDocumentTracking(
    detailDrawerVisible && quotationDetail ? 'quotation' : undefined,
    quotationDetail?.id
  );
  /** 默认 false：配置未加载时不应误判为「已开审核」，否则会出现未开审核仍显示「撤回提交」等 */
  const quotationAuditRequired = useAuditRequired('quotation', false);
  const salesOrderAuditRequired = useAuditRequired('sales_order', false);
  const quotationLifecycleDetail = useMemo(
    () => (quotationDetail ? getQuotationLifecycle(quotationDetail, quotationAuditRequired, t) : null),
    [quotationDetail, quotationAuditRequired, t],
  );
  const quotationNextSteps = quotationLifecycleDetail?.nextStepSuggestions;
  const hideQuotationStepperNextRow = Boolean(quotationNextSteps?.length);
  const showQuotationLifecycleNextInTitle =
    Boolean(quotationNextSteps?.length) && !quotationDetail?.conversion_downstream_missing;
  const [syncModalVisible, setSyncModalVisible] = useState(false);

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [pendingCreateCustomerId, setPendingCreateCustomerId] = useState<number | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null);
  const formRef = useRef<any>(null);
  const lastPriceTypeRef = useRef<PriceTypeValue>(DEFAULT_SALES_PRICE_TYPE);
  const [quotationEditingIncl, setQuotationEditingIncl] = useState<{ index: number; value: number | null } | null>(
    null,
  );
  const quotationEditingInclValueRef = useRef<number | null>(null);

  const handleQuotationPriceTypeChange = useCallback((nextChecked: boolean) => {
    const nextType: PriceTypeValue = nextChecked ? 'tax_inclusive' : 'tax_exclusive';
    const fromType: PriceTypeValue = nextChecked ? 'tax_exclusive' : 'tax_inclusive';
    setFormPriceType(formRef.current, nextType);
    lastPriceTypeRef.current = nextType;
    setQuotationEditingIncl(null);
    quotationEditingInclValueRef.current = null;
    deferConvertLineItemsByPriceType(formRef.current, fromType, nextType, convertUnitPriceByPriceType);
  }, []);

  const [customerList, setCustomerList] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [userList, setUserList] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [productScope, setProductScope] = useState<'make' | 'all'>('make');
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
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
  const leaveQuotationFormPage = useCallback(() => {
    navigate(QUOTATION_LIST_PATH);
  }, [navigate]);

  const handleListScopeFilterChange = useCallback((v: QuotationListScope) => {
    if (v === listScopeFilterRef.current) return;
    listScopeFilterRef.current = v;
    setListScopeFilter(v);
    actionRef.current?.reload();
  }, []);

  const currentUser = useGlobalStore((s) => s.currentUser);
  const quotationPerms = useResourcePermissions(QUOTATION_RESOURCE);
  const salesContractPerms = useResourcePermissions(SALES_CONTRACT_RESOURCE);
  const permDeniedTitle = t('common.permissionDenied');
  const detailCapabilityGates = useQuotationCapabilities(
    quotationDetail,
    quotationPerms,
    salesContractPerms,
    t,
    permDeniedTitle,
  );
  const canSubmitQuotation = hasModulePermission(currentUser ?? undefined, QUOTATION_RESOURCE, 'submit');
  const canRevokeQuotation = hasModulePermission(currentUser ?? undefined, QUOTATION_RESOURCE, 'revoke');
  const canReviewQuotation = hasReviewPermission(currentUser ?? undefined, QUOTATION_RESOURCE);

  useEffect(() => {
    let cancelled = false;
    const loadCustomers = async () => {
      setCustomersLoading(true);
      try {
        const result = await customerApi.list({ limit: 1000, isActive: true });
        if (!cancelled) {
          setCustomerList(unwrapSupplyPagedList(result));
        }
      } catch {
        if (!cancelled) setCustomerList([]);
      } finally {
        if (!cancelled) setCustomersLoading(false);
      }
    };
    const loadMaterials = async () => {
      try {
        const matRes = await apiRequest<unknown>('/apps/master-data/materials', {
          params: { limit: 1000, is_active: true },
        });
        if (cancelled) return;
        const matList = Array.isArray(matRes) ? matRes : (matRes as any)?.data ?? (matRes as any)?.items ?? [];
        const list = Array.isArray(matList) ? matList : [];
        registerMaterialsForUnitSelect(list);
        setMaterialList(list);
      } catch {
        if (!cancelled) setMaterialList([]);
      }
    };
    const loadUsers = async () => {
      setUsersLoading(true);
      try {
        const userRes = await searchUserDisplay({ page: 1, page_size: 200, is_active: true });
        if (!cancelled) {
          setUserList(displayItemsToUsers(userRes.items || []));
        }
      } catch {
        if (!cancelled) setUserList([]);
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    };
    void loadCustomers();
    void loadMaterials();
    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    if (materialList.length > 0) {
      registerMaterialsForUnitSelect(materialList);
    }
  }, [materialList]);

  const applyCustomerToQuotationForm = useCallback(
    (c: Record<string, any> | null) => {
      applyCustomerFormFields(formRef, c, {
        users: userList,
        customerList,
        includeCustomerId: true,
      });
    },
    [userList, customerList],
  );

  const applyCustomerById = useCallback(
    (customerId: number) => {
      const customer = customerList.find((x: any) => Number(x.id ?? x.customer_id) === Number(customerId));
      if (!customer) return false;
      applyCustomerToQuotationForm(customer as Record<string, any>);
      return true;
    },
    [customerList, applyCustomerToQuotationForm],
  );

  useEffect(() => {
    if (isFormPage) return;
    if (!pendingListReloadRef.current) return;
    pendingListReloadRef.current = false;
    const timer = window.setTimeout(() => {
      actionRef.current?.reloadAndRest?.() ?? actionRef.current?.reload?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isFormPage, location.pathname]);

  useEffect(() => {
    if (!isFormPage) {
      formPageInitializedRef.current = false;
      return;
    }
    const titleKey = isCreatePage
      ? 'app.kuaizhizao.menu.sales-management.quotations.new'
      : 'app.kuaizhizao.menu.sales-management.quotations.edit';
    const title = t(titleKey);
    const searchParams = new URLSearchParams(location.search || '');
    searchParams.delete('_refresh');
    const cleanSearch = searchParams.toString();
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
      const raw = searchParams.get('customerId');
      const customerId = raw != null ? Number(raw) : NaN;
      void initQuotationCreateForm(
        Number.isFinite(customerId) && customerId > 0 ? { customerId } : undefined,
      );
    } else if (editRouteId) {
      void initQuotationEditForm(editRouteId);
    }
  }, [isFormPage, isCreatePage, editRouteId, searchParams]);

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
  const quotationAuditColumn = createListAuditPhaseColumn<Quotation>({
    t,
    auditEnabled: quotationAuditRequired,
  });
  const columns: ProColumns<Quotation>[] = [
    {
      title: t('app.kuaizhizao.quotation.colCustomerQuotation'),
      key: 'quotation_code',
      dataIndex: 'quotation_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      order: 10,
      fieldProps: { placeholder: t('app.kuaizhizao.quotation.fuzzyMatchPlaceholder') },
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.customer_name ?? '')}
          secondary={String(r.quotation_code ?? '')}
        />
      ),
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
      title: t('app.kuaizhizao.customerFollowUp.colCustomer'),
      dataIndex: 'customer_name',
      width: 260,
      ellipsis: true,
      hideInTable: true,
      order: 20,
      fieldProps: { placeholder: t('field.customer.name') },
    },
    {
      title: t('app.kuaizhizao.quotation.colSalesman'),
      dataIndex: 'salesman_name',
      width: 100,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => normalizeUserDisplayName(r.salesman_name) || '-',
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
      title: t('app.kuaizhizao.quotation.colQuotationDate'),
      dataIndex: 'quotation_date',
      width: 110,
      valueType: 'date',
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.quotation.colDateRange'),
      dataIndex: 'date_range',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: { placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')] },
      formItemProps: formDateRangeFormItemProps,
      order: 30,
    },
    {
      title: t('app.kuaizhizao.quotation.colTotalAmount'),
      dataIndex: 'total_amount',
      width: 110,
      align: 'right',
      hideInSearch: true,
      render: (_, r) => <AmountDisplay resource={QUOTATION_FIELD_RESOURCE} fieldName="total_amount" value={r.total_amount} />,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      valueType: 'select',
      hideInTable: true,
      valueEnum: quotationStatusFilterEnum,
      order: 40,
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 168,
      uniTableKeepWidth: true,
      hideInSearch: true,
      defaultSortOrder: 'descend',
    },
    ...(quotationAuditColumn ? [quotationAuditColumn] : []),
    {
      title: t('app.kuaizhizao.quotation.colLifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => (
        <ListUniLifecycleCell
          lifecycle={getQuotationLifecycle(record, quotationAuditRequired, t)}
          withSubStages
        />
      ),
    },
    {
      title: t('common.actions'),
      minWidth: 120,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const parts: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="d" onClick={() => handleDetail(record.id!)}>
            {t('common.detail')}
          </Button>,
        ];
        const canEdit = record.capabilities?.update?.allowed === true && quotationPerms.canUpdate;
        const deletable = record.capabilities?.delete?.allowed === true && quotationPerms.canDelete;
        if (canEdit) {
          parts.push(
            <Button {...rowActionKind('update')} key="e" onClick={() => handleEdit(record)}>
              {t('common.edit')}
            </Button>,
          );
        }
        if (deletable) {
          parts.push(
            <Button {...rowActionKind('delete')} key="del" onClick={() => handleDelete(record)}>
              {t('common.delete')}
            </Button>,
          );
        }
        parts.push(
          <UniWorkflowActions
            key="quotation-workflow"
            {...rowActionKind('skip')}
            record={record}
            entityName={t('app.kuaizhizao.quotation.entityName')}
            auditNodeKey="quotation"
            resourcePrefix="kuaizhizao:quotation"
            unifiedAudit
            statusField="status"
            reviewStatusField="review_status"
            pendingStatuses={['待审核', 'pending_review', 'PENDING_REVIEW', '已发送', 'sent']}
            approvedStatuses={['已审核', '审核通过', 'approved', 'APPROVED']}
            rejectedStatuses={['已驳回', 'rejected', 'REJECTED']}
            onSuccess={() => {
              actionRef.current?.reload();
              if (quotationDetail?.id === record.id) {
                void loadQuotationDetail(record.id!);
              }
            }}
          />
        );
        if (record.capabilities?.reopen?.allowed === true && quotationPerms.canUpdate) {
          parts.push(
            <Button {...rowActionKind('read')} key="ro" onClick={() => handleReopen(record)}>
              {t('app.kuaizhizao.quotation.reopenEdit')}
            </Button>
          );
        }
        if (record.capabilities?.revoke_push?.allowed === true && quotationPerms.canUpdate) {
          parts.push(
            <Button {...rowActionKind('skip')} key="rp" icon={<RollbackOutlined />} onClick={() => handleRevokePush(record)}>
              {t('app.kuaizhizao.quotation.revokePush')}
            </Button>
          );
        }
        if (record.customer_id != null && Number.isFinite(Number(record.customer_id))) {
          parts.push(
            <Button {...rowActionAddFollowUpFromDocument()} key="fu" onClick={() => openFollowUpFromQuotation(record)} />
          );
        }
        return parts;
      },
    },
  ];
  const alignedListColumns = alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK);

  // columns 定义已合并

  const handleDetail = async (id: number) => {
    try {
      const res = await getQuotation(id);
      if (res) {
        setQuotationDetail(res);
        setDetailDrawerVisible(true);
      }
    } catch (e: any) {
      messageApi.error(t('app.kuaizhizao.quotation.detailFailed'));
    }
  };

  const loadQuotationDetail = useCallback(
    async (id: number) => {
      try {
        const res = await getQuotation(id);
        if (res) setQuotationDetail(res);
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.quotation.detailFailed'));
      }
    },
    [messageApi, t],
  );

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
        messageApi.error(t('app.kuaizhizao.quotation.detailFailed'));
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

  const handleEdit = (record: Quotation) => {
    if (!record.id) return;
    navigate(quotationEditPath(record.id));
  };

  const handleDelete = (record: Quotation) => {
    Modal.confirm({
      title: t('app.kuaizhizao.quotation.deleteModalTitle'),
      content: t('app.kuaizhizao.quotation.confirmDelete', { code: record.quotation_code }),
      onOk: async () => {
        try {
          await deleteQuotation(record.id!);
          messageApi.success(t('common.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setSelectedRowKeys((prev) => prev.filter((k) => Number(k) !== record.id!));
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  const handleItemImport = (data: any[][]) => {
    const priceTypeForm = salesFormPriceType(formRef.current?.getFieldValue('price_type'));
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
        const taxR = material ? getMaterialDefaultTaxRate(material) : 0;
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
      messageApi.warning(t('app.kuaizhizao.salesOrder.noValidData'));
      return;
    }

    const currentItems = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    messageApi.success(t('app.kuaizhizao.salesOrder.importSuccessItems', { count: newItems.length }));
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    const deletableKeys = keys.filter((k) => {
      const q = resolveQuotationByRowKey(k);
      return q != null && q.capabilities?.delete?.allowed === true && quotationPerms.canDelete;
    });
    if (deletableKeys.length === 0) return;
    try {
      for (const k of deletableKeys) {
        await deleteQuotation(Number(k));
      }
      messageApi.success(t('app.kuaizhizao.quotation.batchDeleteSuccess', { count: deletableKeys.length }));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      clearTableSelection();
    } catch (error: any) {
      messageApi.error(error.message || t('common.batchDeleteFailed'));
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
        failedItems.push({ id, error: error?.message || t('app.kuaizhizao.quotation.batchOperationFailed', { action: actionName }) });
      }
    }
    if (failedCount === 0) {
      messageApi.success(t('app.kuaizhizao.quotation.batchOperationSuccess', { action: actionName, count: successCount }));
    } else {
      messageApi.warning(t('app.kuaizhizao.quotation.batchOperationPartial', { action: actionName, success: successCount, failed: failedCount }));
      if (failedItems.length > 0) {
        console.error(`${actionName}失败详情:`, failedItems);
      }
    }
    invalidateMenuBadgeCounts();

    actionRef.current?.reload();
    clearTableSelection();
  };

  const resolveQuotationByRowKey = useCallback(
    (key: React.Key): Quotation | null => {
      const id = Number(key);
      if (!Number.isFinite(id) || id <= 0) return null;
      return (
        tableQuotationsFlat.find((row) => Number(row.id) === id) ??
        lastQuotationsFlatCacheRef.current.find((row) => Number(row.id) === id) ??
        null
      );
    },
    [tableQuotationsFlat],
  );

  const quotationAuditBatchHandlers = useMemo(
    () => ({
      submit: submitQuotation,
      withdraw: withdrawQuotation,
      approve: approveQuotation,
      revoke: revokeReviewQuotation,
    }),
    [],
  );

  const handleQuotationAuditBatchSuccess = useCallback(() => {
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
    clearTableSelection();
  }, [invalidateMenuBadgeCounts, clearTableSelection]);
  const handleBatchConfirmCustomer = (keys: React.Key[]) => {
    const confirmableKeys = keys.filter((key) => {
      const q = resolveQuotationByRowKey(key);
      return q != null && q.capabilities?.confirm_customer?.allowed === true && quotationPerms.canAction?.('execute');
    });
    if (confirmableKeys.length === 0) return;
    return handleBatchOperation(
      confirmableKeys,
      t('app.kuaizhizao.quotation.batchConfirmCustomer'),
      (id) => confirmCustomerQuotation(id),
    );
  };

  const handleBatchCancelCustomerConfirm = (keys: React.Key[]) => {
    const cancelableKeys = keys.filter((key) => {
      const q = resolveQuotationByRowKey(key);
      return (
        q != null &&
        q.capabilities?.cancel_customer_confirm?.allowed === true &&
        quotationPerms.canAction?.('execute')
      );
    });
    if (cancelableKeys.length === 0) return;
    return handleBatchOperation(
      cancelableKeys,
      t('app.kuaizhizao.quotation.batchCancelCustomerConfirm'),
      (id) => cancelCustomerConfirmQuotation(id),
    );
  };

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
      messageApi.success(t('app.kuaizhizao.quotation.syncSuccess', { count: successCount }));
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.syncFailed'));
    }
  };

  /**
   * 处理列表页批量导入报价单
   * 导入格式：报价单编号, 客户名称, 报价日期, 产品编号, 数量, 单价, 交货日期, 备注
   * 同一报价单编号的多行会合并为一条报价单的多个明细
   */
  const handleListImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.kuaizhizao.quotation.importDataInvalid'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''));

    if (rows.length === 0) {
      messageApi.warning(t('app.kuaizhizao.quotation.noImportRows'));
      return;
    }

    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      quotationImportTemplate.importHeaderMap,
    );
    const idx = {
      code: headerIndexMap['code'] ?? -1,
      customer: headerIndexMap['customer'] ?? -1,
      date: headerIndexMap['date'] ?? -1,
      material: headerIndexMap['material'] ?? -1,
      qty: headerIndexMap['quantity'] ?? -1,
      price: headerIndexMap['unitPrice'] ?? -1,
      delivery: headerIndexMap['delivery'] ?? -1,
      notes: headerIndexMap['notes'] ?? -1,
    };

    if (idx.customer < 0 || idx.date < 0 || idx.material < 0 || idx.qty < 0) {
      messageApi.error(t('app.kuaizhizao.quotation.missingRequiredColumns'));
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
        errors.push({ row: rowNum, message: t('app.kuaizhizao.quotation.validation.customerRequired') });
        return;
      }
      if (!dateVal) {
        errors.push({ row: rowNum, message: t('app.kuaizhizao.quotation.validation.dateRequired') });
        return;
      }
      if (!materialCode) {
        errors.push({ row: rowNum, message: t('app.kuaizhizao.quotation.validation.materialRequired') });
        return;
      }
      if (isNaN(qty) || qty <= 0) {
        errors.push({ row: rowNum, message: t('app.kuaizhizao.quotation.validation.qtyPositive') });
        return;
      }

      const mat = materialList.find((m: any) => (m.mainCode || m.code || '').toUpperCase() === materialCode.toUpperCase());
      if (!mat) {
        errors.push({ row: rowNum, message: t('app.kuaizhizao.quotation.validation.materialNotFound', { code: materialCode }) });
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
        title: t('app.kuaizhizao.quotation.validationFailed'),
        width: 600,
        content: (
          <div>
            <p>{t('app.master-data.validationFailedIntro')}</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">{t('app.kuaizhizao.quotation.importRowError', { row: item.row, message: item.message })}</Typography.Text>
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
      messageApi.warning(t('app.kuaizhizao.quotation.noImportData'));
      return;
    }

    try {
      const result = await batchImport({
        items: toImport,
        importFn: async (item) =>
          createQuotation(item, {
            autoSubmit: (item.status || '草稿') !== '草稿',
          }),
        title: t('app.kuaizhizao.quotation.importing'),
        concurrency: 3,
      });

      if (result.failureCount > 0) {
        Modal.warning({
          title: t('app.kuaizhizao.quotation.importPartialTitle'),
          width: 600,
          content: (
            <div>
              <p><strong>{t('app.kuaizhizao.quotation.importResult', { success: result.successCount, failed: result.failureCount })}</strong></p>
              {result.errors.length > 0 && (
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(e) => (
                    <List.Item><Typography.Text type="danger">{t('app.kuaizhizao.quotation.importRowError', { row: e.row, message: e.error })}</Typography.Text></List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(t('app.kuaizhizao.quotation.importSuccess', { count: result.successCount }));
      }
      if (result.successCount > 0) {
        invalidateMenuBadgeCounts();

        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('common.importFailed'));
    }
  };

  const handleConvert = (record: Quotation) => {
    Modal.confirm({
      title: t('app.kuaizhizao.quotation.convertToSalesOrder'),
      content: t('app.kuaizhizao.quotation.convertConfirm', { code: record.quotation_code }),
      onOk: async () => {
        try {
          const res = await convertQuotationToOrder(record.id!);
          const salesOrderId = res.sales_order?.id;
          const orderCode = res.sales_order?.order_code || '';
          messageApi.success({
            content: (
              <span>
                {t('app.kuaizhizao.quotation.convertedToSalesOrder')}
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
                        messageApi.error(e?.message || e?.detail || t('app.kuaizhizao.quotation.loadSalesOrderFailed'));
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
          messageApi.error(error.message || t('app.kuaizhizao.quotation.convertFailed'));
        }
      },
    });
  };

  const handleConvertToContract = (record: Quotation) => {
    Modal.confirm({
      title: t('app.kuaizhizao.quotation.pushToSalesContract'),
      content: t('app.kuaizhizao.quotation.pushToSalesContractConfirm', { code: record.quotation_code }),
      onOk: async () => {
        try {
          const contract = await salesContractApi.convertFromQuotation(record.id!);
          const contractId = contract.id;
          const contractCode = contract.contract_code || '';
          messageApi.success({
            content: (
              <span>
                {t('app.kuaizhizao.quotation.pushedToSalesContract')}
                {contractId ? (
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => navigate(salesContractEditPath(contractId))}
                  >
                    {contractCode}
                  </Button>
                ) : (
                  contractCode
                )}
              </span>
            ),
            duration: 6,
          });
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          if (quotationDetail?.id === record.id) {
            void loadQuotationDetail(record.id!);
          }
        } catch (error: any) {
          messageApi.error(error?.message || t('app.kuaizhizao.quotation.pushToSalesContractFailed'));
        }
      },
    });
  };

  // 统一审核动作由 UniWorkflowActions 接管（提交/撤回提交/审核/驳回/撤销审核）

  const handleConfirmCustomer = (record: Quotation) => {
    Modal.confirm({
      title: t('app.kuaizhizao.quotation.customerConfirm'),
      content: t('app.kuaizhizao.quotation.customerConfirmContent'),
      onOk: async () => {
        try {
          const updated = await confirmCustomerQuotation(record.id!);
          messageApi.success(t('app.kuaizhizao.quotation.customerConfirmSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || t('common.operationFailed'));
        }
      },
    });
  };

  const handleCancelCustomerConfirm = (record: Quotation) => {
    Modal.confirm({
      title: t('app.kuaizhizao.quotation.cancelCustomerConfirm'),
      content: t('app.kuaizhizao.quotation.cancelCustomerConfirmContent'),
      onOk: async () => {
        try {
          const updated = await cancelCustomerConfirmQuotation(record.id!);
          messageApi.success(t('app.kuaizhizao.quotation.cancelCustomerConfirmSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || t('common.operationFailed'));
        }
      },
    });
  };

  const handleReopen = (record: Quotation) => {
    Modal.confirm({
      title: t('app.kuaizhizao.quotation.reopenEdit'),
      content: t('app.kuaizhizao.quotation.reopenContent'),
      onOk: async () => {
        try {
          const updated = await reopenQuotation(record.id!);
          messageApi.success(t('app.kuaizhizao.quotation.reopenSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || t('common.operationFailed'));
        }
      },
    });
  };

  const handleRevokePush = (record: Quotation) => {
    Modal.confirm({
      title: t('app.kuaizhizao.quotation.revokePush'),
      content: t('app.kuaizhizao.quotation.revokePushContent'),
      onOk: async () => {
        try {
          const updated = await revokePushQuotation(record.id!);
          messageApi.success(t('app.kuaizhizao.quotation.revokePushSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
          setQuotationDetail((prev) => (prev?.id === record.id ? updated : prev));
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || t('common.operationFailed'));
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
            created.quotation_code
              ? t('app.kuaizhizao.quotation.revisionCreatedWithCode', { code: created.quotation_code })
              : t('app.kuaizhizao.quotation.revisionCreated')
          );
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          // 创建新版后直接进入编辑页（与「新建」一致），不再跳详情抽屉。
          setDetailDrawerVisible(false);
          if (created.id) {
            navigate(quotationEditPath(created.id));
          }
        } catch (e: any) {
          messageApi.error(e?.message || e?.detail || t('common.operationFailed'));
        }
      },
    });
  };

  const handlePrint = useCallback(
    (record: Quotation) => {
      if (!record.id) return;
      openPrint({
        documentType: 'quotation',
        documentId: record.id,
        pdfDownloadFilename: record.quotation_code
          ? `${record.quotation_code}.pdf`
          : `quotation-${record.id}.pdf`,
      });
    },
    [openPrint],
  );

  const handleToolbarPrint = useCallback(
    async (keys: React.Key[]) => {
      if (!keys || keys.length !== 1) return;
      const numericId = Number(keys[0]);
      if (!Number.isFinite(numericId) || numericId <= 0) {
        messageApi.warning(t('app.kuaizhizao.quotation.selectOneValid'));
        return;
      }
      try {
        const latest = await getQuotation(numericId);
        if (!latest.capabilities?.print_formal?.allowed) {
          messageApi.warning(t('app.kuaizhizao.quotation.formalPrintDenied'));
          return;
        }
        await handlePrint(latest);
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaizhizao.quotation.loadFailed'));
      }
    },
    [handlePrint, messageApi, quotationAuditRequired, t],
  );

  const handleToolbarRevision = useCallback(
    async (keys: React.Key[]) => {
      if (!keys || keys.length !== 1) return;
      const numericId = Number(keys[0]);
      if (!Number.isFinite(numericId) || numericId <= 0) {
        messageApi.warning(t('app.kuaizhizao.quotation.selectOneValid'));
        return;
      }
      try {
        const latest = await getQuotation(numericId);
        if (!latest.capabilities?.create_revision?.allowed) {
          messageApi.warning(t('app.kuaizhizao.quotation.revisionOnlyLatest'));
          return;
        }
        handleRevision(latest);
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaizhizao.quotation.loadFailed'));
      }
    },
    [handleRevision, messageApi]
  );

  const selectedQuotationIdForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    return Number.isFinite(id) && id > 0 ? id : null;
  }, [selectedRowKeys]);
  const selectedQuotationForToolbar = useMemo(
    () => (selectedQuotationIdForToolbar ? resolveQuotationByRowKey(selectedQuotationIdForToolbar) : null),
    [selectedQuotationIdForToolbar, resolveQuotationByRowKey],
  );

  /** 工具栏下推：优先用带 capabilities 的详情，避免列表未 enrich 时整组下推被禁用 */
  const [toolbarPushQuotation, setToolbarPushQuotation] = useState<Quotation | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!selectedQuotationIdForToolbar) {
      setToolbarPushQuotation(null);
      return;
    }
    const cached = resolveQuotationByRowKey(selectedQuotationIdForToolbar);
    if (cached?.capabilities?.convert_to_order != null) {
      setToolbarPushQuotation(cached);
      return;
    }
    void getQuotation(selectedQuotationIdForToolbar)
      .then((full) => {
        if (!cancelled) setToolbarPushQuotation(full);
      })
      .catch(() => {
        if (!cancelled) setToolbarPushQuotation(cached);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedQuotationIdForToolbar, resolveQuotationByRowKey, tableQuotationsFlat]);

  const quotationForToolbarPush = toolbarPushQuotation ?? selectedQuotationForToolbar;
  /** 工具栏单选能力判定统一使用「详情能力」优先，避免列表能力字段缺失导致整组按钮误灰。 */
  const toolbarSingleSelectionQuotation = quotationForToolbarPush;

  const quotationRowSelectionGetCheckboxProps = useCallback(
    (record: Quotation) => ({
      disabled: !isQuotationRowSelectable(record, quotationAuditRequired),
    }),
    [quotationAuditRequired],
  );

  /** 工具栏「客户确认」：仅当选中项均可确认（已发送且审核通过/未开审核）时可点 */
  const canToolbarConfirmCustomer = useMemo(() => {
    if (selectedRowKeys.length === 0) return false;
    if (selectedRowKeys.length === 1) {
      const q = toolbarSingleSelectionQuotation;
      return Boolean(q?.capabilities?.confirm_customer?.allowed) && quotationPerms.canAction?.('execute');
    }
    const selected = selectedRowKeys
      .map((key) => resolveQuotationByRowKey(key))
      .filter((q): q is Quotation => q != null);
    if (selected.length !== selectedRowKeys.length) return false;
    return selected.every(
      (q) => q.capabilities?.confirm_customer?.allowed === true && quotationPerms.canAction?.('execute'),
    );
  }, [selectedRowKeys, quotationPerms, resolveQuotationByRowKey, toolbarSingleSelectionQuotation]);

  const canToolbarCancelCustomerConfirm = useMemo(() => {
    if (selectedRowKeys.length === 0) return false;
    if (selectedRowKeys.length === 1) {
      const q = toolbarSingleSelectionQuotation;
      return Boolean(q?.capabilities?.cancel_customer_confirm?.allowed) && quotationPerms.canAction?.('execute');
    }
    const selected = selectedRowKeys
      .map((key) => resolveQuotationByRowKey(key))
      .filter((q): q is Quotation => q != null);
    if (selected.length !== selectedRowKeys.length) return false;
    return selected.every(
      (q) =>
        q.capabilities?.cancel_customer_confirm?.allowed === true &&
        quotationPerms.canAction?.('execute'),
    );
  }, [selectedRowKeys, quotationPerms, resolveQuotationByRowKey, toolbarSingleSelectionQuotation]);

  const selectedQuotationsForToolbar = useMemo(
    () =>
      selectedRowKeys
        .map((key) => resolveQuotationByRowKey(key))
        .filter((q): q is Quotation => q != null),
    [selectedRowKeys, resolveQuotationByRowKey],
  );

  const canToolbarBatchDelete = useMemo(
    () => quotationBatchDeleteAllowed(selectedQuotationsForToolbar, quotationPerms.canDelete),
    [selectedQuotationsForToolbar, quotationPerms.canDelete],
  );

  const canToolbarCreateRevision = useMemo(() => {
    if (selectedRowKeys.length !== 1) return false;
    const q = toolbarSingleSelectionQuotation;
    return q?.capabilities?.create_revision?.allowed === true && quotationPerms.canCreate;
  }, [selectedRowKeys.length, toolbarSingleSelectionQuotation, quotationPerms.canCreate]);

  const canToolbarPrint = useMemo(() => {
    if (selectedRowKeys.length !== 1) return false;
    const q = toolbarSingleSelectionQuotation;
    return q?.capabilities?.print_formal?.allowed === true && quotationPerms.canPrint;
  }, [selectedRowKeys.length, toolbarSingleSelectionQuotation, quotationPerms.canPrint]);

  const handleTableDataChange = useCallback((data: QuotationTableRow[]) => {
    const flat = flattenQuotationTableRows(data);
    lastQuotationsFlatCacheRef.current = flat;
    setTableQuotationsFlat(flat);
  }, []);

  const buildToolbarPushMenuItems = useCallback(
    (record: Quotation) => {
      const superseded = isQuotationSuperseded(record);
      const orderBizAllowed = quotationCapabilityAllowed(record, 'convert_to_order');
      const contractBizAllowed = quotationCapabilityAllowed(record, 'convert_to_contract');
      const orderPushPermAllowed = quotationCanPushToSalesOrder(quotationPerms);
      const convertible = orderBizAllowed && orderPushPermAllowed;
      const contractConvertible = contractBizAllowed;
      const hasContract =
        record.contract_id != null &&
        Number(record.contract_id) > 0 &&
        record.contract_downstream_missing !== true;
      const hasLiveSalesOrder =
        record.sales_order_id != null &&
        Number(record.sales_order_id) > 0 &&
        record.conversion_downstream_missing !== true;
      const notLatest = record.is_latest_in_series === false;
      const orderPushTitle = superseded
        ? t('app.kuaizhizao.quotation.supersededConvertHint')
        : hasContract
          ? t('app.kuaizhizao.quotation.alreadyLinkedContract')
          : notLatest
            ? t('app.kuaizhizao.quotation.historyVersionPushHint')
            : !convertible
              ? !orderBizAllowed
                ? quotationCapabilityReasonMessage(record.capabilities?.convert_to_order?.reason, t) ||
                  t('app.kuaizhizao.quotation.pushBlockedStatus', {
                    status: quotationStatusNorm(record) || '-',
                  })
                : permDeniedTitle
              : undefined;
      const contractPushTitle = superseded
        ? t('app.kuaizhizao.quotation.supersededConvertHint')
        : hasContract
          ? t('app.kuaizhizao.quotation.alreadyLinkedContract')
          : hasLiveSalesOrder
            ? t('app.kuaizhizao.quotation.alreadyLinkedSalesOrder')
            : !contractConvertible
              ? quotationCapabilityReasonMessage(record.capabilities?.convert_to_contract?.reason, t) ||
                t('app.kuaizhizao.quotation.pushBlockedStatus', {
                  status: quotationStatusNorm(record) || '-',
                })
              : !salesContractPerms.canCreate
                ? permDeniedTitle
                : undefined;
      return buildUniPushMenuItems([
        {
          key: 'sales-order',
          label: pushToSalesOrderAction.label,
          icon: <SwapOutlined />,
          disabled: superseded || !convertible,
          title: orderPushTitle,
          onClick: () => {
            if (superseded || !convertible) return;
            void (async () => {
              try {
                const latest = await getQuotation(record.id!);
                handleConvert(latest);
              } catch (error: any) {
                messageApi.error(error?.message || t('app.kuaizhizao.quotation.loadFailed'));
              }
            })();
          },
        },
        {
          key: 'sales-contract',
          label: pushToSalesContractAction.label,
          icon: <FileTextOutlined />,
          disabled: superseded || !contractConvertible || !salesContractPerms.canCreate,
          title: contractPushTitle,
          onClick: () => {
            if (superseded || !contractConvertible || !salesContractPerms.canCreate) return;
            void (async () => {
              try {
                const latest = await getQuotation(record.id!);
                handleConvertToContract(latest);
              } catch (error: any) {
                messageApi.error(error?.message || t('app.kuaizhizao.quotation.loadFailed'));
              }
            })();
          },
        },
      ]);
    },
    [
      handleConvert,
      handleConvertToContract,
      messageApi,
      quotationPerms,
      salesContractPerms.canCreate,
      permDeniedTitle,
      pushToSalesContractAction.label,
      pushToSalesOrderAction.label,
      t,
    ],
  );

  const toolbarPushMenuItems = useMemo(
    () => (quotationForToolbarPush ? buildToolbarPushMenuItems(quotationForToolbarPush) : []),
    [buildToolbarPushMenuItems, quotationForToolbarPush],
  );
  const quotationPushDisabledReason = useMemo(() => {
    if (selectedRowKeys.length === 0) {
      return t('app.kuaizhizao.quotation.push.selectOne', { defaultValue: '请先选择一条报价单' });
    }
    if (selectedRowKeys.length !== 1) {
      return t('app.kuaizhizao.quotation.push.singleOnly', {
        count: selectedRowKeys.length,
        defaultValue: '下推仅支持单条，请仅保留一条选中记录',
      });
    }
    if (!quotationForToolbarPush) {
      return t('app.kuaizhizao.quotation.push.rowUnavailable', {
        defaultValue: '当前选中记录暂不可用，请刷新后重试',
      });
    }
    return undefined;
  }, [quotationForToolbarPush, selectedRowKeys.length, t]);

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
    variant_attributes: undefined,
    delivery_date: undefined,
    notes: '',
  };

  async function initQuotationCreateForm(options?: { customerId?: number }) {
    const prefillCustomerId = options?.customerId;
    formRef.current?.resetFields();
    setEditingId(null);
    setPendingCreateCustomerId(prefillCustomerId ?? null);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    lastPriceTypeRef.current = DEFAULT_SALES_PRICE_TYPE;
    formRef.current?.setFieldsValue({
      items: [defaultQuoteItem],
      currency_code: defaultQuotationCurrency,
      price_type: DEFAULT_SALES_PRICE_TYPE,
      quotation_date: dayjs(),
    });
    setTimeout(() => {
      formRef.current?.setFieldsValue({
        items: [defaultQuoteItem],
        currency_code: defaultQuotationCurrency,
        price_type: DEFAULT_SALES_PRICE_TYPE,
        quotation_date: dayjs(),
      });
      if (prefillCustomerId != null) {
        const applied = applyCustomerById(prefillCustomerId);
        if (!applied) {
          messageApi.info(t('app.kuaizhizao.quotation.customerLoading'));
        } else {
          setPendingCreateCustomerId(null);
        }
      }
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
  }

  async function initQuotationEditForm(quotationId: number) {
    try {
      const detail = await getQuotation(quotationId, true);
      void prefetchMaterialsForUnitSelect((detail.items ?? []).map((it) => it.material_id));
      setEditingId(quotationId);
      const editValues = {
        quotation_code: detail.quotation_code,
        quotation_date: detail.quotation_date ? dayjs(detail.quotation_date) : undefined,
        valid_until: detail.valid_until ? dayjs(detail.valid_until) : undefined,
        delivery_date: detail.delivery_date ? dayjs(detail.delivery_date) : undefined,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        salesman_id: detail.salesman_id != null ? Number(detail.salesman_id) : undefined,
        salesman_name: detail.salesman_name,
        shipping_address: detail.shipping_address,
        shipping_method: detail.shipping_method,
        payment_terms: detail.payment_terms,
        currency_code: detail.currency_code ?? defaultQuotationCurrency,
        notes: detail.notes,
        attachments: mapAttachmentsToUploadList(detail.attachments),
        price_type: normalizeSalesPriceType(detail.price_type),
        discount_amount: Number(detail.discount_amount ?? 0) || 0,
        items: (detail.items || []).map((it) => ({
          material_id: it.material_id!,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec,
          material_unit: it.material_unit || '',
          quote_quantity: Number(it.quote_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          tax_rate: Number(it.tax_rate) || 0,
          variant_attributes: parseVariantAttributesValue((it as any).variant_attributes) ?? (it as any).variant_attributes,
          delivery_date: it.delivery_date ? dayjs(it.delivery_date) : undefined,
          notes: it.notes,
        })),
      };
      setTimeout(() => {
        formRef.current?.setFieldsValue(editValues);
        lastPriceTypeRef.current = normalizeSalesPriceType(editValues.price_type);
      }, 100);
    } catch {
      messageApi.error(t('app.kuaizhizao.quotation.detailFailed'));
      navigate(QUOTATION_LIST_PATH);
    }
  }

  function handleCreate(options?: { customerId?: number }) {
    const qs =
      options?.customerId != null && Number.isFinite(options.customerId)
        ? `?customerId=${options.customerId}`
        : '';
    navigate(`${QUOTATION_CREATE_PATH}${qs}`);
  }

  const submitCreate = async (values: any, options?: { asDraft?: boolean }) => {
    const validItems = normalizeFormListItems<any>(values.items).filter(
      (it: any) =>
        it.material_id && Number(it.quote_quantity) > 0 && Number(it.unit_price) > 0,
    );
    if (!validItems.length) {
      messageApi.error(t('app.kuaizhizao.quotation.validLineHint'));
      throw new Error(t('app.kuaizhizao.quotation.validLineHint'));
    }
    const submitItems = validItems.map((it: any) => mapQuotationSubmitItem(it, materialList));
    const missingMaterialMeta = submitItems.find((it) => !it.material_code || !it.material_name);
    if (missingMaterialMeta) {
      messageApi.error(t('app.kuaizhizao.quotation.lineMaterialMissing'));
      throw new Error(t('app.kuaizhizao.quotation.lineMaterialMissing'));
    }
    let quotationCode = values.quotation_code;
    const submitRuleCode = effectiveRuleCode || getPageRuleCode('kuaizhizao-quotation');
    const submitAutoEnabled = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-quotation');
    if (submitAutoEnabled && submitRuleCode && (quotationCode === previewCode || !quotationCode)) {
      try {
        const codeResponse = await generateCode({ rule_code: submitRuleCode });
        quotationCode = codeResponse.code;
      } catch (e) {
        const msg = getApiErrorMessage(e, t('app.kuaizhizao.quotation.generateCodeFailed'));
        messageApi.error(msg);
        throw e;
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
        salesman_name: normalizeUserDisplayName(values.salesman_name),
        shipping_address: values.shipping_address,
        shipping_method: values.shipping_method,
        payment_terms: values.payment_terms,
        currency_code: values.currency_code ?? defaultQuotationCurrency,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        price_type: normalizeSalesPriceType(values.price_type),
        discount_amount: Number(values.discount_amount ?? 0) || 0,
        items: submitItems,
      },
      { autoSubmit: !options?.asDraft },
    );
    messageApi.success(options?.asDraft ? t('app.kuaizhizao.quotation.savedDraft') : t('common.createSuccess'));
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    invalidateMenuBadgeCounts();

    if (isFormPage) {
      scheduleQuotationListReload();
      navigate(QUOTATION_LIST_PATH);
      return;
    }
    reloadQuotationList();
  };

  const handleSaveDraft = async () => {
    try {
      await formRef.current?.validateFields();
      const values = formRef.current?.getFieldsValue(true);
      if (values) await submitCreate(values, { asDraft: true });
    } catch (err: any) {
      if (err?.errorFields?.length) {
        messageApi.warning(err?.message ?? t('app.kuaizhizao.quotation.completeRequired'));
      } else if (err?.message !== t('app.kuaizhizao.quotation.validLineHint')) {
        messageApi.error(getApiErrorMessage(err, t('app.kuaizhizao.quotation.completeRequired')));
      }
    }
  };

  const handleFormSubmit = async () => {
    const values = formRef.current?.getFieldsValue(true);
    try {
      if (isCreatePage) {
        await submitCreate(values);
      } else {
        await submitEdit(values);
      }
    } catch (err: any) {
      if (err?.errorFields?.length) {
        messageApi.warning(err?.message ?? t('app.kuaizhizao.quotation.completeRequired'));
        return;
      }
      if (err?.message === t('app.kuaizhizao.quotation.validLineHint')) {
        return;
      }
      messageApi.error(getApiErrorMessage(err, isCreatePage ? t('app.kuaizhizao.quotation.createFailed') : t('app.kuaizhizao.quotation.updateFailed')));
    }
  };

  const submitEdit = async (values: any) => {
    if (!editingId) return;
    const validItems = normalizeFormListItems<any>(values.items).filter(
      (it: any) =>
        it.material_id && Number(it.quote_quantity) > 0 && Number(it.unit_price) > 0,
    );
    if (!validItems.length) {
      messageApi.error(t('app.kuaizhizao.quotation.validLineHint'));
      throw new Error(t('app.kuaizhizao.quotation.validLineHint'));
    }
    const submitItems = validItems.map((it: any) => mapQuotationSubmitItem(it, materialList));
    const missingMaterialMeta = submitItems.find((it) => !it.material_code || !it.material_name);
    if (missingMaterialMeta) {
      messageApi.error(t('app.kuaizhizao.quotation.lineMaterialMissing'));
      throw new Error(t('app.kuaizhizao.quotation.lineMaterialMissing'));
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
      salesman_name: normalizeUserDisplayName(values.salesman_name),
      shipping_address: values.shipping_address,
      shipping_method: values.shipping_method,
      payment_terms: values.payment_terms,
      currency_code: values.currency_code ?? defaultQuotationCurrency,
      notes: values.notes,
      attachments: normalizeDocumentAttachments(values.attachments),
      price_type: normalizeSalesPriceType(values.price_type),
      discount_amount: Number(values.discount_amount ?? 0) || 0,
      items: submitItems,
    });
    messageApi.success(t('common.updateSuccess'));
    setEditingId(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    invalidateMenuBadgeCounts();

    if (isFormPage) {
      scheduleQuotationListReload();
      navigate(QUOTATION_LIST_PATH);
      return;
    }
    reloadQuotationList();
  };
  const detailBasicColumns: ProDescriptionsItemProps<Quotation>[] = [
    // —— 单据标识与状态 ——
    { title: t('app.kuaizhizao.quotation.import.code'), dataIndex: 'quotation_code' },
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
      title: t('common.status'),
      dataIndex: 'status',
      render: (_, r) => {
        const c = getQuotationStatusTagProps(r, quotationAuditRequired, t);
        return <Tag {...resolveStatusTagDisplayProps(c)}>{c.text}</Tag>;
      },
    },
    // —— 客户信息 ——
    { title: t('app.kuaizhizao.quotation.form.customer'), dataIndex: 'customer_name' },
    { title: salesCommonFormLabels.contact, dataIndex: 'customer_contact' },
    { title: salesCommonFormLabels.phone, dataIndex: 'customer_phone' },
    // —— 商务条款（日期、金额、支付、本方责任人）——
    { title: t('app.kuaizhizao.quotation.colQuotationDate'), dataIndex: 'quotation_date', valueType: 'date' },
    { title: t('app.kuaizhizao.quotation.form.validUntil'), dataIndex: 'valid_until', valueType: 'date' },
    {
      title: t('app.kuaizhizao.quotation.form.isTaxInclusive'),
      dataIndex: 'price_type',
      render: (_: unknown, r: Quotation) =>
        r.price_type === 'tax_inclusive' ? t('app.kuaizhizao.salesOrder.taxInclusive') : t('app.kuaizhizao.salesOrder.taxExclusive'),
    },
    {
      title: t('app.kuaizhizao.salesOrder.discountAmount'),
      dataIndex: 'discount_amount',
      render: (_, r) =>
        Number(r.discount_amount ?? 0) > 0 ? (
          <AmountDisplay resource={QUOTATION_FIELD_RESOURCE} fieldName="amount" value={r.discount_amount} />
        ) : (
          '-'
        ),
    },
    {
      title: t('app.kuaizhizao.quotation.colTotalAmount'),
      dataIndex: 'total_amount',
      render: (_, r) => <AmountDisplay resource={QUOTATION_FIELD_RESOURCE} fieldName="total_amount" value={r.total_amount} />,
    },
    {
      title: t('app.kuaizhizao.quotation.form.currency'),
      dataIndex: 'currency_code',
      render: (_: unknown, record: Quotation) => (
        <DictionaryLabel dictionaryCode="CURRENCY" value={record.currency_code || defaultQuotationCurrency} />
      ),
    },
    {
      title: t('app.kuaizhizao.salesOrder.paymentTerms'),
      dataIndex: 'payment_terms',
      render: (_, record) => {
        const val = record.payment_terms;
        const opt = paymentTermsOptions.find((o) => o.value === val);
        return opt?.label ?? val ?? '-';
      },
    },
    {
      title: salesCommonFormLabels.salesman,
      dataIndex: 'salesman_name',
      render: (_: unknown, r: Quotation) => normalizeUserDisplayName(r.salesman_name) || '-',
    },
    // —— 交货履约 ——
    { title: t('app.kuaizhizao.quotation.form.expectedDeliveryDate'), dataIndex: 'delivery_date', valueType: 'date' },
    {
      title: t('app.kuaizhizao.salesOrder.shippingMethod'),
      dataIndex: 'shipping_method',
      render: (_, record) => {
        const val = record.shipping_method;
        const opt = shippingMethodOptions.find((o) => o.value === val);
        return opt?.label ?? val ?? '-';
      },
    },
    { title: t('app.kuaizhizao.salesOrder.shippingAddress'), dataIndex: 'shipping_address', span: 3 },
    // —— 关联与其它 ——
    { title: t('app.kuaizhizao.quotation.form.linkedSalesOrder'), dataIndex: 'sales_order_code' },
    { title: t('app.kuaizhizao.salesOrder.notes'), dataIndex: 'notes', span: 3 },
    // —— 系统信息 ——
    { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];
  const alignedDetailBasicColumns = alignDescriptionColumns(
    detailBasicColumns,
    SALES_DOC_DETAIL_BASIC_FIELD_RANK,
  );

  const openLinkedSalesOrderDrawer = useCallback(
    async (id: number) => {
      setLinkedSalesOrderDrawerOpen(true);
      setLinkedSalesOrder(null);
      setLinkedSalesOrderLoading(true);
      try {
        const data = await getSalesOrder(id, true, true);
        setLinkedSalesOrder(data);
      } catch (e: any) {
        messageApi.error(e?.message || e?.detail || t('app.kuaizhizao.quotation.loadSalesOrderFailed'));
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

  const refreshQuotationLinePriceByVariant = useCallback(
    async (index: number, attrs?: Record<string, unknown>) => {
      const customerId = formRef.current?.getFieldValue('customer_id');
      const materialId = formRef.current?.getFieldValue(['items', index, 'material_id']);
      const material = materialList.find((m: any) => m.id === Number(materialId));
      const full = material
        ? await resolveMaterialForPricing(material as Material, materialList as Material[])
        : undefined;
      const quotationDate = formRef.current?.getFieldValue('quotation_date');
      const asOf =
        quotationDate != null ? (dayjs.isDayjs(quotationDate) ? quotationDate : dayjs(quotationDate)) : dayjs();
      const pt = salesFormPriceType(formRef.current?.getFieldValue('price_type'));
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
        formRef.current?.setFieldValue(['items', index, 'unit_price'], up);
        formRef.current?.setFieldValue(['items', index, 'tax_rate'], taxRate);
      }
    },
    [materialList],
  );

  const appendQuotationItemsFromMaterials = useCallback(
    async (selected: Material[]) => {
      const pt = salesFormPriceType(formRef.current?.getFieldValue('price_type'));
      const mainDelivery = formRef.current?.getFieldValue('delivery_date');
      const defaultDelivery =
        mainDelivery != null ? (dayjs.isDayjs(mainDelivery) ? mainDelivery : dayjs(mainDelivery)) : dayjs();
      const customerId = formRef.current?.getFieldValue('customer_id');
      const quotationDate = formRef.current?.getFieldValue('quotation_date');
      const asOf =
        quotationDate != null ? (dayjs.isDayjs(quotationDate) ? quotationDate : dayjs(quotationDate)) : dayjs();

      const priced = await resolveSalesDocumentMaterialLinesPricing(selected, {
        customerId: customerId ? Number(customerId) : undefined,
        asOf,
        priceType: pt,
        materialList: materialList as Material[],
      });

      const rowFromMaterial = (m: Material, pricing: (typeof priced)[number]) => ({
        material_id: m.id,
        material_code: String(getMaterialField(m as Record<string, unknown>, 'mainCode') ?? getMaterialField(m as Record<string, unknown>, 'code') ?? ''),
        material_name: String(getMaterialField(m as Record<string, unknown>, 'name') ?? ''),
        material_spec: String(getMaterialField(m as Record<string, unknown>, 'specification') ?? ''),
        material_unit: String(getMaterialField(m as Record<string, unknown>, 'baseUnit') ?? ''),
        quote_quantity: 1,
        unit_price: pricing.unitPrice,
        tax_rate: pricing.taxRate,
        variant_attributes: undefined,
        _sourceType: m.sourceType ?? (m as any).source_type,
        _masterMaterialUuid: m.uuid,
        delivery_date: defaultDelivery,
        notes: '',
      });
      const isEmptyItemRow = (row: any) => {
        if (row == null) return true;
        if (row.material_id != null && row.material_id !== '') return false;
        const code = row.material_code;
        return code == null || String(code).trim() === '';
      };
      const queue = selected.map((m, idx) => rowFromMaterial(m, priced[idx]));
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
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [materialList, messageApi, t]
  );

  useEffect(() => {
    if (!isCreatePage || pendingCreateCustomerId == null) return;
    if (applyCustomerById(pendingCreateCustomerId)) {
      setPendingCreateCustomerId(null);
    }
  }, [isCreatePage, pendingCreateCustomerId, customerList, applyCustomerById]);

  const quotationFormOnValuesChange = useCallback(
    (changed: Record<string, unknown>, all: Record<string, unknown>) => {
      if ('customer_id' in changed) {
        const customerId = changed.customer_id;
        if (customerId != null) {
          const c = customerList.find((x: any) => Number(x.id ?? x.customer_id) === Number(customerId));
          if (c) {
            applyCustomerFormFields(formRef, c as Record<string, unknown>, {
              users: userList,
              customerList,
            });
          }
        }
      }
    },
    [customerList, userList],
  );

  const triggerQuotationFormSubmit = useCallback(() => {
    requestAnimationFrame(() => {
      const inst = formRef.current;
      if (!inst || typeof inst.submit !== 'function') {
        messageApi.warning(t('components.layoutTemplates.formModal.formNotReady'));
        return;
      }
      inst.submit();
    });
  }, [formRef, messageApi, t]);

  useSubmitShortcut(() => triggerQuotationFormSubmit(), isFormPage);

  const appendEmptyQuotationItem = useCallback(() => {
    const items = [...normalizeFormListItems<any>(formRef.current?.getFieldValue('items'))];
    items.push({
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
    formRef.current?.setFieldsValue({ items });
  }, []);

  const formItemContent = (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="quotation_code"
            label={t('app.kuaizhizao.quotation.import.code')}
            placeholder={isAutoGenerateEnabled('kuaizhizao-quotation') ? t('app.kuaizhizao.quotation.form.codeAutoGenerate') : t('app.kuaizhizao.quotation.form.codeRequired')}
            fieldProps={{ disabled: !!editingId }}
            rules={[{ required: true, whitespace: true, message: t('app.kuaizhizao.quotation.form.codeRequired') }]}
          />
        </Col>
        <Col span={12}>
          <ProForm.Item name="customer_id" label={t('field.customer.name')} rules={[{ required: true, message: t('app.kuaizhizao.quotation.form.selectCustomer') }]}>
            <CustomerSelectDropdown
              hostResource="kuaizhizao:quotation"
              placeholder={t('app.kuaizhizao.quotation.form.selectCustomer')}
              style={{ width: '100%' }}
              customers={customerList}
              loading={customersLoading}
              onCustomersChange={setCustomerList}
              autoLoad={false}
              modalZIndex={quotationNestedElevatedPopupZIndex}
              onCustomerPick={(c) => {
                applyCustomerToQuotationForm(c as Record<string, any> | null);
              }}
            />
          </ProForm.Item>
        </Col>
      </Row>
      {/* 归属业务员 + 日期 + 发货方式：五列等分（24 栅格 5+5+5+5+4） */}
      <Row gutter={16}>
        <Col span={5}>
          <QuotationSalesmanField userList={userList} loading={usersLoading} />
        </Col>
        <Col span={5}>
          <ProFormDatePicker
            name="quotation_date"
            label={t('app.kuaizhizao.quotation.colQuotationDate')}
            rules={[{ required: true }]}
            formItemProps={formDateFormItemProps}
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col span={5}>
          <ProFormDatePicker
            name="valid_until"
            label={t('app.kuaizhizao.quotation.form.validUntil')}
            formItemProps={formDateFormItemProps}
            fieldProps={buildFutureDateShortcutFieldProps({
              getForm: () => formRef.current,
              fieldName: 'valid_until',
              baseFieldName: 'quotation_date',
              t,
            })}
          />
        </Col>
        <Col span={5}>
          <ProFormDatePicker
            name="delivery_date"
            label={t('app.kuaizhizao.quotation.form.expectedDeliveryDate')}
            formItemProps={formDateFormItemProps}
            fieldProps={buildFutureDateShortcutFieldProps({
              getForm: () => formRef.current,
              fieldName: 'delivery_date',
              baseFieldName: 'quotation_date',
              t,
            })}
          />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="SHIPPING_METHOD"
            name="shipping_method"
            label={t('app.kuaizhizao.salesOrder.shippingMethod')}
            placeholder={t('app.kuaizhizao.quotation.form.selectShippingMethod')}
            formRef={formRef}
            simpleQuickCreate
            quickCreatePopoverZIndex={quotationNestedElevatedPopupZIndex}
          />
        </Col>
      </Row>
      {/* 联系人 1/6 · 电话 1/6 · 地址 1/3 · 付款条件 1/6 · 币种 1/6 */}
      <Row gutter={16}>
        <Col span={4}>
          <ProFormText name="customer_contact" label={salesCommonFormLabels.contact} />
        </Col>
        <Col span={4}>
          <ProFormText name="customer_phone" label={salesCommonFormLabels.phone} />
        </Col>
        <Col span={8}>
          <ProFormText name="shipping_address" label={t('app.kuaizhizao.salesOrder.shippingAddress')} placeholder={t('app.kuaizhizao.quotation.form.shippingAddressPlaceholder')} />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="PAYMENT_TERMS"
            name="payment_terms"
            label={t('app.kuaizhizao.salesOrder.paymentTerms')}
            placeholder={t('app.kuaizhizao.quotation.form.selectPaymentTerms')}
            formRef={formRef}
            simpleQuickCreate
            quickCreatePopoverZIndex={quotationNestedElevatedPopupZIndex}
          />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="CURRENCY"
            name="currency_code"
            label={t('app.kuaizhizao.quotation.form.currency')}
            placeholder={t('app.kuaizhizao.quotation.form.selectCurrency')}
            formRef={formRef}
            valueEqualsLabel={false}
            quickCreatePopoverZIndex={quotationNestedElevatedPopupZIndex}
          />
        </Col>
      </Row>
      <ProFormText name="customer_name" hidden />
      <ProFormText name="price_type" hidden initialValue={DEFAULT_SALES_PRICE_TYPE} />

      <Form.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.price_type !== curr?.price_type}>
        {({ getFieldValue }: any) => {
          const priceType = salesFormPriceType(getFieldValue('price_type'));
          const showTaxColumns = priceType === 'tax_inclusive';
          const quotationDetailColumns = [
                      {
                        title: productColumnTitle,
                        dataIndex: 'material_id',
                        width: 280,
                        ...QUOTATION_DETAIL_TEXT_COL,
                        render: (_: unknown, __: unknown, index: number) => (
                          <QuotationMaterialSelectCell
                            index={index}
                            materialList={materialList as Material[]}
                            sourceType={materialSourceType}
                          />
                        ),
                      },
                      {
                        title: t('app.kuaizhizao.salesOrder.variantAttributes'),
                        dataIndex: 'variant_attributes',
                        width: 240,
                        ...QUOTATION_DETAIL_TEXT_COL,
                        render: (_: unknown, __: unknown, index: number) =>
                          formRef.current ? (
                            <OrderLineVariantAttributesCell
                              form={formRef.current}
                              rowIndex={index}
                              materials={materialList as Material[]}
                              onAttributesChange={(attrs) =>
                                refreshQuotationLinePriceByVariant(index, attrs)
                              }
                            />
                          ) : null,
                      },
                      {
                        title: t('app.kuaizhizao.salesOrder.spec'),
                        dataIndex: 'material_spec',
                        width: 140,
                        ...QUOTATION_DETAIL_TEXT_COL,
                        render: (_: unknown, __: unknown, index: number) => (
                          <Form.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                            <Input placeholder={t('app.kuaizhizao.salesOrder.spec')} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                          </Form.Item>
                        ),
                      },
                      {
                        title: t('app.kuaizhizao.salesOrder.unit'),
                        dataIndex: 'material_unit',
                        width: 108,
                        ...QUOTATION_DETAIL_TEXT_COL,
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
                                  <MaterialUnitSelect materialId={materialId} size={DOCUMENT_DETAIL_CONTROL_SIZE} noStyle />
                                </Form.Item>
                              );
                            }}
                          </Form.Item>
                        ),
                      },
                      {
                        title: t('app.kuaizhizao.salesOrder.quantity'),
                        dataIndex: 'quote_quantity',
                        width: 112,
                        ...QUOTATION_DETAIL_NUM_COL,
                        render: (_: unknown, __: unknown, index: number) => (
                          <Form.Item
                            name={[index, 'quote_quantity']}
                            rules={[{ required: true, message: t('common.required') }]}
                            style={{ margin: 0 }}
                          >
                            <InputNumber
                              placeholder={t('app.kuaizhizao.salesOrder.quantity')}
                              min={0.01}
                              precision={2}
                              style={{ width: '100%' }}
                              size={DOCUMENT_DETAIL_CONTROL_SIZE}
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
                        width: 132,
                        ...QUOTATION_DETAIL_NUM_COL,
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
                              size={DOCUMENT_DETAIL_CONTROL_SIZE}
                            />
                          </Form.Item>
                        ),
                      },
                      ...(showTaxColumns
                        ? [
                            {
                              title: t('app.kuaizhizao.salesOrder.exclAmount'),
                              width: 120,
                              ...QUOTATION_DETAIL_NUM_COL,
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
                                    return (
                                      <AmountDisplay
                                        resource={QUOTATION_FIELD_RESOURCE}
                                        fieldName="amount_without_tax"
                                        value={line.excl}
                                        style={QUOTATION_DETAIL_AMOUNT_STYLE}
                                      />
                                    );
                                  }}
                                </Form.Item>
                              ),
                            },
                          ]
                        : []),
                      ...(showTaxColumns
                        ? [
                            {
                              title: <TaxRateBatchColumnTitle onBatch={() => {
                                const itemsVal = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));
                                if (itemsVal.length === 0) return;
                                const rate = prompt(t('app.kuaizhizao.salesOrder.taxRateBatch'), '13');
                                if (rate != null && rate !== '') {
                                  const num = Math.round(parseFloat(rate));
                                  if (!Number.isNaN(num) && num >= 0 && num <= 100) {
                                    const next = itemsVal.map((it: any) => ({ ...it, tax_rate: num }));
                                    formRef.current?.setFieldsValue({ items: next });
                                  }
                                }
                              }} />,
                              dataIndex: 'tax_rate',
                              width: 108,
                              ...QUOTATION_DETAIL_NUM_COL,
                              onCell: () => ({ className: 'quotation-tax-rate-col' }),
                              render: (_: unknown, __: unknown, index: number) => (
                                <TaxRateDetailCell index={index} />
                              ),
                            },
                            {
                              title: t('app.kuaizhizao.salesOrder.taxAmount'),
                              width: 112,
                              ...QUOTATION_DETAIL_NUM_COL,
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
                                    return (
                                      <AmountDisplay
                                        resource={QUOTATION_FIELD_RESOURCE}
                                        fieldName="tax_amount"
                                        value={line.tax}
                                        style={QUOTATION_DETAIL_AMOUNT_STYLE}
                                      />
                                    );
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
                        width: 132,
                        ...QUOTATION_DETAIL_NUM_COL,
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
                                    size={DOCUMENT_DETAIL_CONTROL_SIZE}
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
                        title: t('app.kuaizhizao.salesOrder.deliveryDate'),
                        dataIndex: 'delivery_date',
                        width: 152,
                        ...QUOTATION_DETAIL_TEXT_COL,
                        render: (_: unknown, __: unknown, index: number) => (
                          <Form.Item
                            name={[index, 'delivery_date']}
                            style={{ margin: 0 }}
                            {...formDateFormItemProps}
                          >
                            <FutureDatePicker
                              size={DOCUMENT_DETAIL_CONTROL_SIZE}
                              style={{ width: '100%', minWidth: 140 }}
                              format="YYYY-MM-DD"
                              getForm={() => formRef.current}
                              baseFieldName="quotation_date"
                              t={t}
                              onApply={(date) =>
                                formRef.current?.setFieldValue?.(['items', index, 'delivery_date'], date)
                              }
                            />
                          </Form.Item>
                        ),
                      },
                      {
                        title: t('app.kuaizhizao.salesOrder.notes'),
                        dataIndex: 'notes',
                        width: 140,
                        ...QUOTATION_DETAIL_TEXT_COL,
                        render: (_: unknown, __: unknown, index: number) => (
                          <Form.Item name={[index, 'notes']} style={{ margin: 0 }}>
                            <Input placeholder={t('app.kuaizhizao.salesOrder.notes')} size={DOCUMENT_DETAIL_CONTROL_SIZE} />
                          </Form.Item>
                        ),
                      },
                    ];
          return (
            <>
              {/* 业务专属样式：1) 产品列让 Select 占满；2) 数字/文本输入选中态颜色。 */}
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
                    .quotation-detail-table td.ant-table-cell-align-right .ant-input-number-input {
                      text-align: right;
                    }
                    .quotation-detail-table td.quotation-tax-rate-col {
                      overflow: hidden;
                    }
                    .quotation-detail-table .quotation-tax-rate-cell,
                    .quotation-detail-table .quotation-tax-rate-cell .ant-form-item,
                    .quotation-detail-table .quotation-tax-rate-cell .ant-form-item-control-input {
                      max-width: 100%;
                      min-width: 0;
                    }
                    .quotation-detail-table .quotation-tax-rate-cell .ant-input-number-group-wrapper {
                      display: flex;
                      width: 100%;
                      max-width: 100%;
                    }
                    .quotation-detail-table .quotation-tax-rate-cell .ant-input-number {
                      flex: 1 1 auto;
                      min-width: 0;
                      width: auto !important;
                    }
                    .quotation-detail-table .quotation-tax-rate-cell .ant-input-number-group-addon {
                      flex: 0 0 auto;
                      padding-inline: 6px;
                    }
                  `}</style>
              <UniTableDetail
                name="items"
                title={t('app.kuaizhizao.quotation.form.itemsTitle')}
                required
                leftExtra={(
                  <PriceTypeSwitch
                    checked={priceType === 'tax_inclusive'}
                    onChange={handleQuotationPriceTypeChange}
                  />
                )}
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
                      onClick={appendEmptyQuotationItem}
                    >
                      {t('common.addDetail')}
                    </Button>
                    <Button
                      type="default"
                      icon={<AppstoreAddOutlined />}
                      onClick={() => setMaterialPickerOpen(true)}
                    >
                      {t('app.kuaizhizao.sales.common.productBatchSelect')}
                    </Button>
                  </Space>
                )}
                requiredMessage={t('app.kuaizhizao.quotation.form.itemsRequired')}
                columns={quotationDetailColumns}
                disabledAdd
                initialValue={{
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
                }}
                tableProps={DOCUMENT_DETAIL_TABLE_PROPS}
              />
            </>
          );
        }}
      </Form.Item>
      <QuotationFormSummary />
      <DocumentAttachmentsField category="quotation_attachments" />
      <ProFormTextArea name="notes" label={t('app.kuaizhizao.salesOrder.notes')} fieldProps={{ rows: 2 }} />
      <UniMaterialBatchPicker
        hostResource="kuaizhizao:quotation"
        open={materialPickerOpen}
        zIndex={quotationNestedElevatedPopupZIndex}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendQuotationItemsFromMaterials}
      />
    </>
  );

  const quotationFormModals = (
    <>
      <Suspense fallback={null}>
        <LazyUniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleItemImport}
          title={t('app.kuaizhizao.quotation.importItemsTitle')}
          headers={[t('app.kuaizhizao.salesOrder.materialCode'), t('app.kuaizhizao.salesOrder.spec'), t('app.kuaizhizao.salesOrder.unit'), t('app.kuaizhizao.salesOrder.quantity'), t('app.kuaizhizao.salesOrder.unitPrice'), t('app.kuaizhizao.salesOrder.deliveryDate')]}
          exampleRow={['MAT001', 'Spec X', 'PCS', '100', '1.5', '2026-03-01']}
        />
      </Suspense>
    </>
  );

  if (isFormPage) {
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
                onClick={leaveQuotationFormPage}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {isCreatePage
                  ? t('app.kuaizhizao.menu.sales-management.quotations.new')
                  : t('app.kuaizhizao.menu.sales-management.quotations.edit')}
              </Typography.Title>
            </Space>
            <DocumentFormPageHeaderActions
              onCancel={leaveQuotationFormPage}
              onSaveDraft={() => void handleSaveDraft()}
              onPrimarySubmit={triggerQuotationFormSubmit}
              isCreatePage={isCreatePage}
              showSaveDraft={isCreatePage}
              canSubmitAfterSave={isCreatePage}
            />
            </>
          }
        >
          <Card className="quotation-create-form-card" styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
            <div className="form-modal-content-inner">
              <ProForm
                formRef={formRef}
                layout="vertical"
                submitter={false}
                scrollToFirstError
                onFinish={handleFormSubmit}
                onFinishFailed={({ errorFields }) => {
                  const first = errorFields?.[0];
                  const text = first?.errors?.filter(Boolean)[0];
                  messageApi.error(text || t('components.layoutTemplates.formModal.checkFormHint'));
                }}
                onValuesChange={quotationFormOnValuesChange}
                initialValues={
                  isCreatePage
                    ? {
                        quotation_date: dayjs(),
                        currency_code: defaultQuotationCurrency,
                        price_type: DEFAULT_SALES_PRICE_TYPE,
                        discount_amount: 0,
                      }
                    : undefined
                }
              >
                {formItemContent}
              </ProForm>
            </div>
          </Card>
        </DocumentFormPageLayout>
        {quotationFormModals}
      </>
    );
  }

  return (
    <>
      <ListPageTemplate>
        <UniTable
          className="kuaizhizao-quotations-table"
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.quotations"
          permissionResource={QUOTATION_FIELD_RESOURCE}
          tanstackQuery={{
            queryKeyPrefix: ['apps.kuaizhizao.pages.sales-management.quotations', listScopeFilter],
          }}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          headerTitle={t('app.kuaizhizao.quotation.title')}
          formRef={tableSearchFormRef}
          actionRef={actionRef}
          rowKey="id"
          columns={alignedListColumns}
          onTableDataChange={handleTableDataChange}
          showAdvancedSearch
          beforeSearchButtons={
            <ThemedSegmented
              key="quotation-list-scope"
              surfaceBackground
              size="middle"
              value={listScopeFilter}
              onChange={(v) => handleListScopeFilterChange(v as QuotationListScope)}
              options={[
                { label: t('app.kuaizhizao.quotation.listScopeAll'), value: 'all' },
                { label: t('app.kuaizhizao.quotation.listScopeMine'), value: 'mine' },
                { label: t('app.kuaizhizao.quotation.listScopeDepartment'), value: 'department' },
              ]}
            />
          }
          toolBarButtonSize="middle"
          showCreateButton
          createButtonText={t('app.kuaizhizao.quotation.createButton')}
          onCreate={handleCreate}
          toolBarActionsAfterCreate={[
            <UniPushToolbarButton
              key={`quotation-push-${quotationForToolbarPush?.id ?? 'none'}`}
              menuItems={toolbarPushMenuItems}
              disabled={!quotationForToolbarPush}
              disabledReason={quotationPushDisabledReason}
            />,
          ]}
          enableRowSelection
          rowSelectionGetCheckboxProps={quotationRowSelectionGetCheckboxProps}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonDisabled={!canToolbarBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.quotation.confirmBatchDelete', { count })}
          toolBarActionsAfterDelete={
            quotationAuditRequired
              ? [
                  <UniAuditBatchMenuButton
                    key="quotation-batch-menu"
                    selectedRowKeys={selectedRowKeys}
                    selectedRecords={selectedQuotationsForToolbar}
                    auditEnabled={quotationAuditRequired}
                    permGates={quotationPerms}
                    handlers={quotationAuditBatchHandlers}
                    onSuccess={handleQuotationAuditBatchSuccess}
                    toolBarButtonSize="middle"
                  />,
                ]
              : []
          }
          toolBarActionsAfterBatch={[
            <UniBatchButton
              key="quotation-confirm-customer"
              selectedRowKeys={selectedRowKeys}
              onAction={handleBatchConfirmCustomer}
              disabled={!canToolbarConfirmCustomer}
              icon={<CommentOutlined />}
              size="middle"
              color="green"
              variant="solid"
              requireConfirm
              confirmTitle={(count) =>
                count === 1
                  ? t('app.kuaizhizao.quotation.customerConfirm')
                  : t('app.kuaizhizao.quotation.batchConfirm')
              }
              confirmDescription={(count) =>
                count === 1
                  ? t('app.kuaizhizao.quotation.customerConfirmContent')
                  : t('app.kuaizhizao.quotation.batchConfirmCustomerConfirm', { count })
              }
            >
              {selectedRowKeys.length <= 1
                ? t('app.kuaizhizao.quotation.customerConfirm')
                : t('app.kuaizhizao.quotation.batchConfirm')}
            </UniBatchButton>,
            <UniBatchButton
              key="quotation-cancel-customer-confirm"
              selectedRowKeys={selectedRowKeys}
              onAction={handleBatchCancelCustomerConfirm}
              disabled={!canToolbarCancelCustomerConfirm}
              icon={<CloseCircleOutlined />}
              size="middle"
              color="orange"
              variant="solid"
              requireConfirm
              confirmTitle={(count) =>
                count === 1
                  ? t('app.kuaizhizao.quotation.cancelCustomerConfirm')
                  : t('app.kuaizhizao.quotation.batchCancelCustomerConfirm')
              }
              confirmDescription={(count) =>
                count === 1
                  ? t('app.kuaizhizao.quotation.cancelCustomerConfirmContent')
                  : t('app.kuaizhizao.quotation.batchCancelCustomerConfirmContent', { count })
              }
            >
              {selectedRowKeys.length <= 1
                ? t('app.kuaizhizao.quotation.cancelCustomerConfirm')
                : t('app.kuaizhizao.quotation.batchCancelCustomerConfirm')}
            </UniBatchButton>,
            <Button
              key="toolbar-revision-direct"
              icon={<BranchesOutlined />}
              disabled={!canToolbarCreateRevision}
              onClick={() => void handleToolbarRevision(selectedRowKeys)}
            >
              {t('app.kuaizhizao.quotation.saveAsRevision')}
            </Button>,
            <Button
              key="toolbar-print-direct"
              icon={<PrinterOutlined />}
              disabled={!canToolbarPrint}
              onClick={() => void handleToolbarPrint(selectedRowKeys)}
            >
              {t('app.kuaizhizao.quotation.formalPrint')}
            </Button>,
          ]}
          showImportButton={true}
          onImport={handleListImport}
          importHeaders={quotationImportTemplate.importHeaders}
          importExampleRow={quotationImportTemplate.importExampleRow}
          importFieldMap={quotationImportTemplate.importHeaderMap}
          importFieldRules={{
            customer: { required: true },
            date: { required: true },
            material: { required: true },
            quantity: { required: true },
          }}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listQuotations({ skip: 0, limit: 10000, list_scope: listScopeFilterRef.current });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = flattenQuotationTableRows(pageData as QuotationTableRow[]);
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `quotations-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
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
                startDate = formatDateTime(dr[0] as string | Date, 'YYYY-MM-DD');
                endDate = dr[1] ? formatDateTime(dr[1] as string | Date, 'YYYY-MM-DD') : startDate;
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
                list_scope: listScopeFilterRef.current,
              });
              setListTotal(response.total ?? 0);
              const flat = response.data || [];
              lastQuotationsFlatCacheRef.current = flat;
              setTableQuotationsFlat(flat);
              return {
                data: buildQuotationSeriesTree(flat),
                success: true,
                total: response.total ?? 0,
              };
            } catch {
              messageApi.error(t('app.kuaizhizao.quotation.listFailed'));
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
        title={quotationDetail?.quotation_code ? t('app.kuaizhizao.quotation.detailTitleWithCode', { code: quotationDetail.quotation_code }) : t('app.kuaizhizao.quotation.detailTitle')}
        open={detailDrawerVisible}
        zIndex={quotationDetailDrawerZIndex}
        onClose={closeQuotationDetailDrawer}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          quotationDetail && (
            <Space wrap>
              {!detailCapabilityGates.delete.disabled && (
                <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(quotationDetail)}>{t('common.delete')}</Button>
              )}
              <UniWorkflowActions
                {...rowActionKind('skip')}
                record={quotationDetail}
                entityName={t('app.kuaizhizao.quotation.entityName')}
                auditNodeKey="quotation"
                resourcePrefix="kuaizhizao:quotation"
                unifiedAudit
                theme="default"
                statusField="status"
                reviewStatusField="review_status"
                pendingStatuses={['待审核', 'pending_review', 'PENDING_REVIEW', '已发送', 'sent']}
                approvedStatuses={['已审核', '审核通过', 'approved', 'APPROVED']}
                rejectedStatuses={['已驳回', 'rejected', 'REJECTED']}
                onSuccess={() => {
                  actionRef.current?.reload();
                  void loadQuotationDetail(quotationDetail.id!);
                }}
              />
              {!detailCapabilityGates.confirmCustomer.disabled && (
                <Button color="green" variant="solid" icon={<SendOutlined />} onClick={() => handleConfirmCustomer(quotationDetail)}>{t('app.kuaizhizao.quotation.customerConfirm')}</Button>
              )}
              {!detailCapabilityGates.cancelCustomerConfirm.disabled && (
                <Button color="orange" variant="solid" icon={<CloseCircleOutlined />} onClick={() => handleCancelCustomerConfirm(quotationDetail)}>{t('app.kuaizhizao.quotation.cancelCustomerConfirm')}</Button>
              )}
              {!detailCapabilityGates.reopen.disabled && (
                <Button icon={<EditOutlined />} onClick={() => handleReopen(quotationDetail)}>{t('app.kuaizhizao.quotation.reopenEdit')}</Button>
              )}
              {!detailCapabilityGates.revokePush.disabled && (
                <Button icon={<RollbackOutlined />} onClick={() => handleRevokePush(quotationDetail)}>{t('app.kuaizhizao.quotation.revokePush')}</Button>
              )}
              {!detailCapabilityGates.createRevision.disabled && (
                <Button icon={<BranchesOutlined />} onClick={() => handleRevision(quotationDetail)}>
                  {t('app.kuaizhizao.quotation.saveAsRevision')}
                </Button>
              )}
              <Tooltip
                title={
                  detailCapabilityGates.printFormal.disabled
                    ? detailCapabilityGates.printFormal.title || t('app.kuaizhizao.quotation.formalPrintDenied')
                    : t('app.kuaizhizao.quotation.formalPrint')
                }
              >
                <Button
                  icon={<PrinterOutlined />}
                  disabled={detailCapabilityGates.printFormal.disabled}
                  onClick={() =>
                    !detailCapabilityGates.printFormal.disabled && handlePrint(quotationDetail)
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
              items={buildDescriptionItemsFromColumns(quotationDetail, alignedDetailBasicColumns, { column: 3 })}
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
                  <DetailLifecycleCollaborationBlock record={quotationDetail} auditEnabled={quotationAuditRequired}>
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
                  </DetailLifecycleCollaborationBlock>
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
                      const pt = normalizeSalesPriceType(quotationDetail.price_type);
                      const showTax = pt === 'tax_inclusive';
                      type LineIt = NonNullable<Quotation['items']>[number];
                      return [
                        { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true, ...QUOTATION_DETAIL_TEXT_COL },
                        { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true, ...QUOTATION_DETAIL_TEXT_COL },
                        { title: t('app.kuaizhizao.salesOrder.spec'), dataIndex: 'material_spec', width: 120, ellipsis: true, ...QUOTATION_DETAIL_TEXT_COL },
                        {
                          title: t('app.kuaizhizao.salesOrder.unit'),
                          dataIndex: 'material_unit',
                          width: 72,
                          ellipsis: true,
                          ...QUOTATION_DETAIL_TEXT_COL,
                          render: (v: string) => <DictionaryLabel dictionaryCode="MATERIAL_UNIT" value={v} />,
                        },
                        { title: t('app.kuaizhizao.quotation.form.quoteQuantity'), dataIndex: 'quote_quantity', width: 100, ...QUOTATION_DETAIL_NUM_COL },
                        {
                          title: t('app.kuaizhizao.salesOrder.unitPrice'),
                          dataIndex: 'unit_price',
                          width: 100,
                          ...QUOTATION_DETAIL_NUM_COL,
                          render: (v: number) => (
                            <AmountDisplay
                              resource={QUOTATION_FIELD_RESOURCE}
                              fieldName="unit_price"
                              value={v}
                              style={QUOTATION_DETAIL_AMOUNT_STYLE}
                            />
                          ),
                        },
                        ...(showTax
                          ? [
                              {
                                title: t('app.kuaizhizao.salesOrder.exclAmount'),
                                key: 'line_excl',
                                width: 100,
                                ...QUOTATION_DETAIL_NUM_COL,
                                render: (_: unknown, it: LineIt) => {
                                  const line = calcQuotationLineAmounts(
                                    it.quote_quantity,
                                    it.unit_price,
                                    it.tax_rate,
                                    pt,
                                  );
                                  return (
                                    <AmountDisplay
                                      resource={QUOTATION_FIELD_RESOURCE}
                                      fieldName="amount_without_tax"
                                      value={line.excl}
                                      style={QUOTATION_DETAIL_AMOUNT_STYLE}
                                    />
                                  );
                                },
                              },
                              {
                                title: t('app.kuaizhizao.salesOrder.taxRate'),
                                dataIndex: 'tax_rate',
                                width: 108,
                                ...QUOTATION_DETAIL_NUM_COL,
                              },
                              {
                                title: t('app.kuaizhizao.salesOrder.taxAmount'),
                                key: 'line_tax',
                                width: 90,
                                ...QUOTATION_DETAIL_NUM_COL,
                                render: (_: unknown, it: LineIt) => {
                                  const line = calcQuotationLineAmounts(
                                    it.quote_quantity,
                                    it.unit_price,
                                    it.tax_rate,
                                    pt,
                                  );
                                  return (
                                    <AmountDisplay
                                      resource={QUOTATION_FIELD_RESOURCE}
                                      fieldName="tax_amount"
                                      value={line.tax}
                                      style={QUOTATION_DETAIL_AMOUNT_STYLE}
                                    />
                                  );
                                },
                              },
                            ]
                          : []),
                        {
                          title: showTax ? t('app.kuaizhizao.salesOrder.inclAmount') : t('app.kuaizhizao.salesOrder.exclAmount'),
                          key: 'line_amount_display',
                          width: 100,
                          ...QUOTATION_DETAIL_NUM_COL,
                          render: (_: unknown, it: LineIt) => {
                            const line = calcQuotationLineAmounts(
                              it.quote_quantity,
                              it.unit_price,
                              it.tax_rate,
                              pt,
                            );
                            return (
                              <AmountDisplay
                                resource={QUOTATION_FIELD_RESOURCE}
                                fieldName={showTax ? 'amount_with_tax' : 'amount_without_tax'}
                                value={showTax ? line.incl : line.excl}
                                style={QUOTATION_DETAIL_AMOUNT_STYLE}
                              />
                            );
                          },
                        },
                        { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', width: 120, ellipsis: true, ...QUOTATION_DETAIL_TEXT_COL },
                        { title: t('app.kuaizhizao.salesOrder.notes'), dataIndex: 'notes', width: 160, ellipsis: true, ...QUOTATION_DETAIL_TEXT_COL },
                      ];
                    })()}
                    dataSource={quotationDetail.items}
                    pagination={false}
                  />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.quotation.noDetailItems')} />
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
        title={linkedSalesOrder?.order_code ? t('app.kuaizhizao.quotation.linkedSalesOrderDetailTitleWithCode', { code: linkedSalesOrder.order_code }) : t('app.kuaizhizao.quotation.linkedSalesOrderDetailTitle')}
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
            {t('app.kuaizhizao.quotation.gotoSalesOrders')}
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

      {quotationFormModals}

      <Suspense fallback={null}>
        <LazySyncFromDatasetModal
          open={syncModalVisible}
          zIndex={quotationElevatedModalZIndex}
          onClose={() => setSyncModalVisible(false)}
          onConfirm={handleSyncConfirm}
          title={t('app.kuaizhizao.quotation.syncFromDataset')}
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

      {PrintModal}

    </>
  );
};

export default QuotationsPage;
