/**

 * 销售合同管理

 */


import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';

import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useLeaveFormTab } from '../../../../../components/uni-tabs/navigateClosingTab';

import { useTranslation } from 'react-i18next';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { toApiDateString, formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { deferConvertLineItemsByPriceType, setFormPriceType } from '../../../../../utils/priceTypeSwitch';
import {
  DEFAULT_SALES_PRICE_TYPE,
  normalizeSalesPriceType,
  salesFormPriceType,
} from '../shared/salesPriceType';
import type { PriceTypeValue } from '../../../../../components/price-type-switch/PriceTypeSwitch';

import type { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';

import {

  ProForm,

  ProFormDatePicker,

  ProFormDigit,

  ProFormSelect,

  ProFormText,

  ProFormTextArea,

} from '@ant-design/pro-components';

import {

  App,

  Alert,

  Button,

  Col,

  Descriptions,

  Drawer,

  Empty,

  Form as AntForm,

  Input,

  InputNumber,

  List,
  Modal,
  Card,

  Radio,

  Row,

  Space,

  Spin,

  Switch,

  Table,

  Tag,

  Tooltip,

  Typography,

} from 'antd';

import {

  CheckOutlined,

  CloseOutlined,

  DeleteOutlined,

  EditOutlined,

  EyeOutlined,

  FormOutlined,

  PlusOutlined,

  ShoppingOutlined,
  ToolOutlined,

  StopOutlined,

  SendOutlined,

  ArrowLeftOutlined,

  ImportOutlined,

  FileTextOutlined,

  PrinterOutlined,

  RollbackOutlined,

} from '@ant-design/icons';

import dayjs from 'dayjs';
import { formatDateTime, formatQuantity, todaySiteDateString } from '../../../../../utils/format';
import { QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';

import {

  DetailDrawerTemplate,

  DRAWER_CONFIG,

  ListPageTemplate,

  MODAL_CONFIG,

  DocumentFormPageLayout,
  DocumentFormPageHeaderActions,
  DetailDrawerSection,

  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  useDetailDrawerDescriptionItems,

} from '../../../../../components/layout-templates';
import { DOCUMENT_SUBLINE_TABLE_PROPS } from '../../../../../components/document-subline-table';

import { UniTable, readPersistedUniTableViewType } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UNI_TABLE_STACKED_BADGE_DATE_COLUMN_DEFAULTS,
  MaterialStackedCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniAuditBatchMenuButton, UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import {
  UniPullQueryModal,
  UNI_PULL_QUERY_MAX_FETCH_LIMIT,
  pagePullCandidates,
  renderPullQueryDocStatus,
  renderPullQueryReviewStatus,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';

import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';

import {
  resolveMaterialForPricing,
  resolveOrderLineSalePrice,
  resolveSalesDocumentMaterialLinesPricing,
} from '../../../../master-data/utils/resolve-partner-material-price';

import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';

import { DictionarySelect } from '../../../../../components/dictionary-select';

import { DictionaryLabel } from '../../../../../components/dictionary-label';

import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_SALES_CONTRACT_FIELD_RESOURCE as SC } from '../../../constants/fieldPermissionResources';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useImportDictionaryOptions } from '../../../../../hooks/useImportDictionaryOptions';
import { pickImportExampleValue } from '../../../../../utils/loadImportDictionaryValues';
import { useImportMaterialUnitOptions } from '../../../../master-data/hooks/useImportMaterialUnitOptions';
import {
  salesContractCapabilityReasonMessage,
  salesContractBatchDeleteAllowed,
  salesContractBatchPrintAllowed,
  quotationCapabilityAllowed,
  quotationCapabilityReasonMessage,
  useSalesContractCapabilities,
} from '../../../../../hooks/useDocumentCapabilities';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';

import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';

import {

  DocumentTrackingTimelineBody,

  useDocumentTracking,

} from '../../../../../components/document-tracking-panel';

import type { Material } from '../../../../master-data/types/material';

import { customerApi } from '../../../../master-data/services/supply-chain';

import { materialApi } from '../../../../master-data/services/material';

import {
  buildSalesContractLifecycleValueEnum,
  getSalesContractLifecycle,
  resolveSalesContractListLifecycleParams,
} from '../../../utils/salesContractLifecycle';

import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';

import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../shared/listAuditPhaseColumn';

import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import salesContractApi, {
  type SalesContract,
  type SalesContractChange,
  type SalesContractItem,
  type SalesContractPaymentSummary,
  type SalesContractPushPreviewResponse,
} from '../../../services/sales-contract';
import { listQuotations, type Quotation, type QuotationCapabilities } from '../../../services/quotation';

import { SalesContractItemsFormTable } from './SalesContractItemsFormTable';
import {
  alignDescriptionColumns,
  alignProColumns,
  getSalesCommonFormLabels,
  GLOBAL_DOC_DETAIL_TABLE_FIELD_RANK,
  SALES_DOC_LIST_FIELD_RANK,
} from '../shared/documentFieldAlignment';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_DEFAULTS, DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS, ratioToPushProgressPercent } from '../shared/DocumentPushProgressBar';
import {
  collectSalesContractPushDocuments,
  salesContractOrderPushPercent,
} from '../shared/pushProgress';
import { applyCustomerFormFields } from '../shared/applyCustomerFormFields';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { flattenDocumentDetailRows, resolveDetailTableViewMode } from '../../shared/detailTableFlatRows';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { testGenerateCode, getCodeRulePageConfig, generateCode } from '../../../../../services/codeRule';
import SalesContractTermsManageModal from './SalesContractTermsManageModal';
import { ContractTermPreviewContent } from './ContractTermPreviewContent';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  buildTermTemplatesFromGroupItems,
  extractFieldBindingsFromTerms,
  extractPlaceholdersFromTerms,
  resolveContractTermFieldBindings,
  resolveTermsWithPlaceholders,
  type ContractTermFieldBindingContext,
} from './contract-term-placeholders';
import { formatBusinessDateOnly } from '../../../../../utils/format';
import {
  salesContractTermApi,
  type SalesContractTermSnapshot,
} from '../../../services/sales-contract-term';
import {
  buildKuaizhizaoPullCreateMenuItems,
  resolveKuaizhizaoDocumentAction,
} from '../../../constants/documentActionRegistry';

const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);

import { importInChunksViaPerItemCreate } from '../../../../../utils/chunkedBulkImport';
import {
  buildContractListImportTemplate,
  parseContractListImport,
} from './contractListImport';

import {
  calcContractLineAmounts,

  convertUnitPriceByPriceType,

  defaultContractItem,

  resolveContractLineMaterialFields,

} from './contract-line-items-shared';
import { getAntdModal } from '../../../../../utils/antdAppApis';

const SALES_CONTRACT_RESOURCE = SC;

const CONTRACT_ITEMS_REQUIRED = 'contract_items_required';


function remainingItemQty(item: { contract_quantity?: number; released_quantity?: number }): number {

  return Math.max(0, Number(item.contract_quantity ?? 0) - Number(item.released_quantity ?? 0));

}

const defaultMilestone = {
  milestone_name: '',
  planned_date: undefined as string | undefined,
  planned_amount: undefined as number | undefined,
  planned_ratio: undefined as number | undefined,
  billing_trigger: 'milestone',
  notes: '',
};


type ContractPushTarget = 'sales_order' | 'work_order';


const SALES_CONTRACT_LIST_PATH = '/apps/kuaizhizao/sales-management/sales-contracts';
const SALES_CONTRACT_CREATE_PATH = `${SALES_CONTRACT_LIST_PATH}/new`;
const salesContractEditPath = (id: number) => `${SALES_CONTRACT_LIST_PATH}/${id}/edit`;

type SalesContractItemRow = SalesContractItem & {
  _rowKey: string;
  contract_id: number;
  contract_code?: string;
  customer_name?: string;
  contract_date?: string;
  status?: string;
  review_status?: string;
  lifecycle?: Record<string, unknown>;
};

const SALES_CONTRACT_LIST_PERSISTENCE_ID =
  'apps.kuaizhizao.pages.sales-management.sales-contracts.v2';

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
  contract_id?: number;
  contract_code?: string;
  capabilities?: QuotationCapabilities;
};

const isPullQuotationSelectable = (record: PullQuotationCandidate): boolean =>
  quotationCapabilityAllowed(record as Quotation, 'convert_to_contract');

const SalesContractsPage: React.FC = () => {

  const navigate = useNavigate();

  const location = useLocation();

  const [searchParams] = useSearchParams();

  const isCreatePage = location.pathname.endsWith('/sales-contracts/new');
  const editRouteMatch = location.pathname.match(/\/sales-contracts\/(\d+)\/edit$/);
  const editRouteId = editRouteMatch ? Number(editRouteMatch[1]) : null;
  const isEditPage = editRouteId != null && Number.isFinite(editRouteId) && editRouteId > 0;
  const isFormPage = isCreatePage || isEditPage;

  const formPageInitializedRef = useRef(false);

  const { message: messageApi } = App.useApp();

  const { t, i18n } = useTranslation();
  const pullFromQuotationAction = resolveKuaizhizaoDocumentAction(t, 'sales_contract.pull_from_quotation');
  const pushToSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'sales_order.pull_from_sales_contract');
  const pushToWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'work_order.pull_from_sales_contract');
  const salesCommonLabels = useMemo(() => getSalesCommonFormLabels(t), [t]);
  const contractTypeLabels = useMemo(
    () => ({
      single: t('app.kuaizhizao.salesContract.contractTypeSingle'),
      framework: t('app.kuaizhizao.salesContract.contractTypeFramework'),
    }),
    [t],
  );
  const contractLifecycleValueEnum = useMemo(
    () => buildSalesContractLifecycleValueEnum(t),
    [t],
  );
  const statusLabels = useMemo(
    () => ({
      草稿: t('app.kuaizhizao.salesContract.statusDraft'),
      待审核: t('app.kuaizhizao.salesContract.statusPending'),
      已生效: t('app.kuaizhizao.salesContract.statusActive'),
      执行中: t('app.kuaizhizao.salesContract.statusExecuting'),
      已完成: t('app.kuaizhizao.salesContract.statusCompleted'),
      已关闭: t('app.kuaizhizao.salesContract.statusClosed'),
      已到期: t('app.kuaizhizao.salesContract.statusExpired'),
    }),
    [t],
  );
  const changeTypeLabels = useMemo(
    () => ({
      amendment: t('app.kuaizhizao.salesContract.changeTypeAmendment'),
      amount_change: t('app.kuaizhizao.salesContract.changeTypeAmount'),
      extension: t('app.kuaizhizao.salesContract.changeTypeExtension'),
    }),
    [t],
  );
  const materialUnitImport = useImportMaterialUnitOptions();
  const contractImportDict = useImportDictionaryOptions([
    'CURRENCY',
    'SHIPPING_METHOD',
    'PAYMENT_TERMS',
  ]);
  const contractLineUnitOptions = materialUnitImport.options;
  const contractImportDictBag = useMemo(
    () => ({
      ...contractImportDict,
      MATERIAL_UNIT: materialUnitImport.options,
      parseDict: (code: string, raw?: string | null) =>
        code === 'MATERIAL_UNIT'
          ? materialUnitImport.parse(raw)
          : contractImportDict.parseDict(code, raw),
    }),
    [contractImportDict, materialUnitImport.options, materialUnitImport.parse],
  );
  const contractLineImportColumnOptions = useMemo(
    () => [
      undefined,
      undefined,
      contractLineUnitOptions,
      undefined,
      undefined,
      undefined,
      undefined,
    ],
    [contractLineUnitOptions],
  );
  const contractListImportTemplate = useMemo(
    () => buildContractListImportTemplate(t, contractImportDictBag),
    [t, i18n.language, contractImportDictBag],
  );
  const contractImportHeaders = useMemo(
    () => [
      t('app.kuaizhizao.salesContract.importHeaders.materialCode'),
      t('app.kuaizhizao.salesContract.importHeaders.spec'),
      t('common.unit'),
      t('common.quantity'),
      t('app.kuaizhizao.salesContract.importHeaders.unitPrice'),
      t('app.kuaizhizao.salesContract.importHeaders.deliveryDate'),
      t('common.remark'),
    ],
    [t],
  );
  const contractImportExampleRow = useMemo(
    () => [
      'MAT001',
      'Spec X',
      pickImportExampleValue(contractLineUnitOptions, t('app.kuaizhizao.salesContract.defaultUnit')),
      '100',
      '1.5',
      '2026-03-01',
      '',
    ],
    [t, contractLineUnitOptions],
  );
  const renderContractStatus = useCallback(
    (status: string | undefined) => statusLabels[status as keyof typeof statusLabels] ?? status ?? '—',
    [statusLabels],
  );
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();

  const contractPerms = useResourcePermissions(SALES_CONTRACT_RESOURCE);
  const contractAuditRequired = useAuditRequired('sales_contract', false);
  const contractAuditColumn = useMemo(
    () => createListAuditPhaseColumn<SalesContract>({ t, auditEnabled: contractAuditRequired }),
    [t, contractAuditRequired],
  );

  const actionRef = useRef<ActionType>();
  const invalidateMenuBadge = useInvalidateMenuBadgeCounts();
  const [viewTypeState, setViewTypeState] = useState<'table' | 'detailTable' | 'help'>(() =>
    readPersistedUniTableViewType(SALES_CONTRACT_LIST_PERSISTENCE_ID, 'table', [
      'table',
      'detailTable',
      'help',
    ]) as 'table' | 'detailTable' | 'help',
  );
  const dataViewMode = resolveDetailTableViewMode(viewTypeState);
  const dataViewModeRef = useRef(dataViewMode);
  useEffect(() => {
    dataViewModeRef.current = dataViewMode;
  }, [dataViewMode]);

  const formRef = useRef<ProFormInstance>();

  const changeFormRef = useRef<ProFormInstance>();

  const contractEditingInclValueRef = useRef<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null);

  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const [customerList, setCustomerList] = useState<any[]>([]);
  const contractCustomerSearchOptions = useMemo(
    () =>
      customerList.map((c: { id?: number; customer_id?: number; name?: string; customer_name?: string; code?: string }) => ({
        value: Number(c.id ?? c.customer_id),
        label: String(c.name ?? c.customer_name ?? c.code ?? ''),
      })),
    [customerList],
  );

  const [materialList, setMaterialList] = useState<Material[]>([]);

  const [contractEditingIncl, setContractEditingIncl] = useState<{ index: number; value: number | null } | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);

  const [detail, setDetail] = useState<SalesContract | null>(null);
  const permDeniedTitle = t('common.noPermission');
  const detailCapabilityGates = useSalesContractCapabilities(detail, contractPerms, t, permDeniedTitle);

  const [detailLoading, setDetailLoading] = useState(false);

  const [paymentSummary, setPaymentSummary] = useState<SalesContractPaymentSummary | null>(null);

  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);


  const [pushPreviewOpen, setPushPreviewOpen] = useState(false);
  const [pushPreviewLoading, setPushPreviewLoading] = useState(false);
  const [pushPreviewConfirming, setPushPreviewConfirming] = useState(false);
  const [pushPreviewData, setPushPreviewData] = useState<SalesContractPushPreviewResponse | null>(null);
  const [pushPreviewTarget, setPushPreviewTarget] = useState<ContractPushTarget | null>(null);
  const [pushPreviewRecord, setPushPreviewRecord] = useState<SalesContract | null>(null);
  const [pushSelectedItemIds, setPushSelectedItemIds] = useState<number[]>([]);
  const [pushQuantities, setPushQuantities] = useState<Record<number, number>>({});
  const [workOrderPushMode, setWorkOrderPushMode] = useState<'draft' | 'confirm'>('draft');


  const [closeModalOpen, setCloseModalOpen] = useState(false);

  const [closeReason, setCloseReason] = useState('');


  const [changeDrawerOpen, setChangeDrawerOpen] = useState(false);

  const [changes, setChanges] = useState<SalesContractChange[]>([]);

  const [changesLoading, setChangesLoading] = useState(false);

  const [changeSubmitting, setChangeSubmitting] = useState(false);

  const [termsManageOpen, setTermsManageOpen] = useState(false);
  const [termGroupOptions, setTermGroupOptions] = useState<{ label: string; value: number }[]>([]);
  const [termTemplateTerms, setTermTemplateTerms] = useState<SalesContractTermSnapshot[]>([]);
  const [termPlaceholderValues, setTermPlaceholderValues] = useState<Record<string, string>>({});
  const [termsPreview, setTermsPreview] = useState<SalesContractTermSnapshot[]>([]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<SalesContract[]>([]);

  const selectedContractsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is SalesContract => row != null),
    [selectedRowKeys],
  );
  const leaveSalesContractFormPage = useLeaveFormTab(SALES_CONTRACT_LIST_PATH);

  const termPlaceholderKeys = useMemo(
    () => extractPlaceholdersFromTerms(termTemplateTerms),
    [termTemplateTerms],
  );

  const termFieldBindingKeys = useMemo(
    () => extractFieldBindingsFromTerms(termTemplateTerms),
    [termTemplateTerms],
  );

  const termFieldBindingContext = useMemo(
    (): ContractTermFieldBindingContext => ({
      dictionaryLabelsByCode: {
        PAYMENT_TERMS: contractImportDict.packs.PAYMENT_TERMS?.labelByCode,
        SHIPPING_METHOD: contractImportDict.packs.SHIPPING_METHOD?.labelByCode,
        CURRENCY: contractImportDict.packs.CURRENCY?.labelByCode,
      },
      contractTypeLabels: {
        single: t('app.kuaizhizao.salesContract.contractTypeSingle'),
        framework: t('app.kuaizhizao.salesContract.contractTypeFramework'),
      },
      formatDate: (value) => formatBusinessDateOnly(value as string, ''),
    }),
    [contractImportDict.packs, t],
  );


  const contractTracking = useDocumentTracking(

    detailOpen && detail?.id ? 'sales_contract' : undefined,

    detail?.id,

    trackingRefreshKey,

  );


  useEffect(() => {

    customerApi

      .list({ limit: 1000, isActive: true })

      .then((cust) => {

        setCustomerList(Array.isArray(cust) ? cust : (cust as any)?.data || (cust as any)?.items || []);

      })

      .catch((e) => console.error('加载客户失败', e));

    materialApi

      .list({ limit: 500, isActive: true })

      .then((res) => setMaterialList(res?.items ?? []))

      .catch((e) => console.error('加载产品失败', e));

  }, []);

  const loadTermGroupOptions = useCallback(async () => {
    try {
      const res = await salesContractTermApi.listGroups({ limit: 500, is_active: true });
      setTermGroupOptions(
        (res.items || []).map((g) => ({
          label: g.group_name,
          value: g.id!,
        })),
      );
    } catch (e) {
      console.error('加载条款组失败', e);
      setTermGroupOptions([]);
    }
  }, []);

  const syncTermsPreview = useCallback(
    (templates: SalesContractTermSnapshot[], placeholderValues: Record<string, string>) => {
      const formValues = formRef.current?.getFieldsValue(true) ?? {};
      const requestedFields = extractFieldBindingsFromTerms(templates);
      const fieldBindings = resolveContractTermFieldBindings(
        formValues,
        termFieldBindingContext,
        requestedFields.length ? requestedFields : undefined,
      );
      const resolved = resolveTermsWithPlaceholders(templates, placeholderValues, fieldBindings);
      setTermsPreview(resolved);
    },
    [termFieldBindingContext],
  );

  const handleContractFormValuesChange = useCallback(
    (changedValues: Record<string, unknown>) => {
      if (!termTemplateTerms.length || !termFieldBindingKeys.length) return;
      const affectsBindings = Object.keys(changedValues).some((key) => termFieldBindingKeys.includes(key));
      if (!affectsBindings) return;
      syncTermsPreview(termTemplateTerms, termPlaceholderValues);
    },
    [termTemplateTerms, termFieldBindingKeys, termPlaceholderValues, syncTermsPreview],
  );

  useEffect(() => {
    if (!termTemplateTerms.length) return;
    syncTermsPreview(termTemplateTerms, termPlaceholderValues);
  }, [contractImportDict.packs, termTemplateTerms, termPlaceholderValues, syncTermsPreview]);

  const applyTermGroupPreview = useCallback(
    async (groupId: number | undefined | null, existingTerms?: SalesContractTermSnapshot[]) => {
      if (!groupId) {
        setTermTemplateTerms([]);
        setTermPlaceholderValues({});
        setTermsPreview([]);
        return;
      }
      if (existingTerms?.length) {
        const templates = existingTerms.map((term) => ({
          ...term,
          template_content: term.template_content ?? term.content,
        }));
        const mergedValues: Record<string, string> = {};
        for (const term of existingTerms) {
          if (term.placeholder_values) {
            Object.assign(mergedValues, term.placeholder_values);
          }
        }
        setTermTemplateTerms(templates);
        setTermPlaceholderValues(mergedValues);
        syncTermsPreview(templates, mergedValues);
        return;
      }
      try {
        const group = await salesContractTermApi.getGroup(groupId);
        const templates = buildTermTemplatesFromGroupItems(group.items || []);
        setTermTemplateTerms(templates);
        setTermPlaceholderValues({});
        syncTermsPreview(templates, {});
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.salesContract.loadTermGroupFailed'));
        setTermTemplateTerms([]);
        setTermPlaceholderValues({});
        setTermsPreview([]);
      }
    },
    [messageApi, syncTermsPreview],
  );

  const handleTermPlaceholderChange = useCallback(
    (key: string, value: string) => {
      setTermPlaceholderValues((prev) => {
        const next = { ...prev, [key]: value };
        syncTermsPreview(termTemplateTerms, next);
        return next;
      });
    },
    [termTemplateTerms, syncTermsPreview],
  );

  useEffect(() => {
    if (isFormPage || termsManageOpen) {
      loadTermGroupOptions();
    }
  }, [isFormPage, termsManageOpen, loadTermGroupOptions]);


  const handleContractPriceTypeChange = useCallback((nextChecked: boolean) => {
    const nextType: PriceTypeValue = nextChecked ? 'tax_inclusive' : 'tax_exclusive';
    const fromType: PriceTypeValue = nextChecked ? 'tax_exclusive' : 'tax_inclusive';
    setFormPriceType(formRef.current, nextType);
    deferConvertLineItemsByPriceType(formRef.current, fromType, nextType, convertUnitPriceByPriceType);
  }, []);


  const refreshContractLinePriceByVariant = useCallback(

    async (index: number, attrs?: Record<string, unknown>) => {

      const customerId = formRef.current?.getFieldValue('customer_id');

      const materialId = formRef.current?.getFieldValue(['items', index, 'material_id']);

      const material = materialList.find((m) => m.id === Number(materialId));

      const contractDate = formRef.current?.getFieldValue('contract_date');

      const asOf =

        contractDate != null ? (dayjs.isDayjs(contractDate) ? contractDate : dayjs(contractDate)) : dayjs();

      const pt = salesFormPriceType(formRef.current?.getFieldValue('price_type'));

      const full = material
        ? await resolveMaterialForPricing(material, materialList)
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

    [materialList],

  );


  const appendContractItemsFromMaterials = useCallback(

    async (selected: Material[]) => {

      const current = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));

      const customerId = formRef.current?.getFieldValue('customer_id');

      const contractDate = formRef.current?.getFieldValue('contract_date');

      const asOf =

        contractDate != null ? (dayjs.isDayjs(contractDate) ? contractDate : dayjs(contractDate)) : dayjs();

      const pt = salesFormPriceType(formRef.current?.getFieldValue('price_type'));

      const priced = await resolveSalesDocumentMaterialLinesPricing(selected, {

        customerId: customerId ? Number(customerId) : undefined,

        asOf,

        priceType: pt,

        materialList,

      });

      const newRows = selected.map((m, i) => ({

        material_id: m.id,

        material_code: m.mainCode ?? (m as any).code ?? '',

        material_name: m.name ?? '',

        material_spec: m.specification ?? '',

        material_unit: m.baseUnit ?? t('app.kuaizhizao.salesContract.defaultUnit'),

        contract_quantity: 1,

        unit_price: priced[i].unitPrice,

        tax_rate: priced[i].taxRate,

      }));

      if (current.length === 1 && !current[0].material_id && !current[0].material_code) {

        formRef.current?.setFieldsValue({ items: newRows });

      } else {

        formRef.current?.setFieldsValue({ items: [...current, ...newRows] });

      }

      messageApi.success(t('app.kuaizhizao.salesContract.materialsAdded', { count: selected.length }));

    },

    [materialList, messageApi, t],

  );

  const handleItemImport = useCallback(
    (data: any[][]) => {
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
          const notes = String(row[6] || '').trim();

          if (!materialCode) return null;

          const material = materialList.find(
            (m) => (m.mainCode ?? (m as any).code) === materialCode,
          );
          const taxR =
            Number((material as any)?.defaults?.defaultTaxRate ?? (material as any)?.defaults?.default_tax_rate) || 0;
          let unitPrice =
            price ||
            Number(
              (material as any)?.defaults?.defaultSalePrice ?? (material as any)?.defaults?.default_sale_price,
            ) ||
            0;
          if (priceTypeForm === 'tax_inclusive' && unitPrice > 0) {
            unitPrice = convertUnitPriceByPriceType(unitPrice, taxR, 'tax_exclusive', 'tax_inclusive');
          }

          return {
            material_id: material?.id,
            material_code: material?.mainCode ?? (material as any)?.code ?? materialCode,
            material_name: material?.name ?? '',
            material_spec: material?.specification ?? spec,
            material_unit: material?.baseUnit ?? unit,
            contract_quantity: quantity || 1,
            unit_price: unitPrice,
            tax_rate: taxR,
            delivery_date: deliveryDate && dayjs(deliveryDate).isValid() ? dayjs(deliveryDate) : undefined,
            notes: notes || '',
          };
        })
        .filter((it): it is NonNullable<typeof it> => it !== null && (it.material_id != null || it.material_code !== ''));

      if (newItems.length === 0) {
        messageApi.warning(t('app.kuaizhizao.salesContract.importNoValidData'));
        return;
      }

      const currentItems = normalizeFormListItems<any>(formRef.current?.getFieldValue('items'));
      formRef.current?.setFieldsValue({ items: [...currentItems, ...newItems] });
      messageApi.success(t('app.kuaizhizao.salesOrder.importSuccessItems', { count: newItems.length }));
      setImportModalVisible(false);
    },
    [materialList, messageApi, t],
  );

  const handleListImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning(t('app.kuaizhizao.quotation.importDataInvalid'));
      return;
    }
    const rows = (data.slice(2) as any[][]).filter((row) =>
      row?.some((c) => c != null && String(c).trim() !== ''),
    );
    if (rows.length === 0) {
      messageApi.warning(t('app.kuaizhizao.quotation.noImportRows'));
      return;
    }

    const { errors, items: toImport } = parseContractListImport(data, {
      t,
      importHeaderMap: contractListImportTemplate.importHeaderMap,
      customers: customerList,
      materials: materialList,
      parseDict: contractImportDictBag.parseDict,
    });

    if (errors.length > 0) {
      getAntdModal().warning({
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
                  <Typography.Text type="danger">
                    {t('app.kuaizhizao.quotation.importRowError', {
                      row: item.row,
                      message: item.message,
                    })}
                  </Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      });
      return;
    }

    if (toImport.length === 0) {
      messageApi.warning(t('app.kuaizhizao.quotation.noImportData'));
      return;
    }

    try {
      const result = await importInChunksViaPerItemCreate({
        items: toImport,
        createOne: async (item, _index) => salesContractApi.create(item, false),
        title: t('app.kuaizhizao.salesContract.listImport.importing'),
        chunkSize: 100,
        concurrency: 4,
      });

      if (result.failureCount > 0) {
        getAntdModal().warning({
          title: t('app.kuaizhizao.quotation.importPartialTitle'),
          width: 600,
          content: (
            <div>
              <p>
                <strong>
                  {t('app.kuaizhizao.quotation.importResult', {
                    success: result.successCount,
                    failed: result.failureCount,
                  })}
                </strong>
              </p>
              {result.errors.length > 0 && (
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(e) => (
                    <List.Item>
                      <Typography.Text type="danger">
                        {t('app.kuaizhizao.quotation.importRowError', {
                          row: e.row,
                          message: e.error,
                        })}
                      </Typography.Text>
                    </List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(
          t('app.kuaizhizao.quotation.importSuccess', { count: result.successCount }),
        );
      }
      if (result.successCount > 0) {
        reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('common.importFailed'));
    }
  };


  const buildFormPayload = (values: any) => {

    const validItems = normalizeFormListItems<any>(values.items).filter(

      (it: any) => it.material_id && Number(it.contract_quantity) > 0 && Number(it.unit_price) >= 0,

    );

    if (!validItems.length) {

      messageApi.error(t('app.kuaizhizao.salesContract.itemsRequired'));

      throw new Error(CONTRACT_ITEMS_REQUIRED);

    }

    const missingMaterialMeta = validItems.find((it: any) => {
      const resolved = resolveContractLineMaterialFields(it, materialList);
      return !resolved.material_code || !resolved.material_name || !resolved.material_unit;
    });
    if (missingMaterialMeta) {
      messageApi.error(t('app.kuaizhizao.salesContract.lineMaterialMissing'));
      throw new Error('contract_line_material_missing');
    }

    const customerId = Number(values.customer_id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      messageApi.error(t('app.kuaizhizao.salesContract.selectCustomerRequired'));
      throw new Error('contract_customer_required');
    }

    const contractDate = toApiDateString(values.contract_date);
    if (!contractDate) {
      messageApi.error(t('app.kuaizhizao.salesContract.contractDateRequired'));
      throw new Error('contract_date_required');
    }

    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === customerId);

    const customerName = (cust?.name ?? cust?.customer_name ?? values.customer_name ?? '').trim();
    if (!customerName) {
      messageApi.error(t('app.kuaizhizao.salesContract.selectCustomerRequired'));
      throw new Error('contract_customer_name_required');
    }

    const milestoneRows = normalizeFormListItems<any>(values.milestones).filter(
      (ms: any) =>
        ms?.milestone_name?.trim() ||
        ms?.planned_date ||
        ms?.planned_amount != null ||
        ms?.planned_ratio != null,
    );
    const invalidMilestone = milestoneRows.find(
      (ms: any) => ms?.milestone_name?.trim() && !toApiDateString(ms.planned_date),
    );
    if (invalidMilestone) {
      messageApi.error(t('app.kuaizhizao.salesContract.milestonePlannedDateRequired'));
      throw new Error('contract_milestone_date_required');
    }

    const milestones = milestoneRows
      .filter((ms: any) => ms?.milestone_name?.trim() && toApiDateString(ms.planned_date))
      .map((ms: any) => ({
        milestone_name: String(ms.milestone_name).trim(),
        planned_date: toApiDateString(ms.planned_date)!,
        planned_amount: ms.planned_amount != null ? Number(ms.planned_amount) : 0,
        planned_ratio: ms.planned_ratio != null ? Number(ms.planned_ratio) : undefined,
        billing_trigger: ms.billing_trigger || 'milestone',
        notes: ms.notes,
      }));

    return {

      contract_type: values.contract_type || 'single',

      customer_id: customerId,

      customer_name: customerName,

      customer_contact: values.customer_contact,

      customer_phone: values.customer_phone,

      contract_date: contractDate,

      valid_from: toApiDateString(values.valid_from),

      valid_to: toApiDateString(values.valid_to),

      price_type: normalizeSalesPriceType(values.price_type),

      currency_code: values.currency_code || 'CNY',

      salesman_name: values.salesman_name,

      shipping_address: values.shipping_address,

      shipping_method: values.shipping_method,

      payment_terms: values.payment_terms,

      term_group_id: values.term_group_id || undefined,

      contract_terms: termsPreview.length ? termsPreview : undefined,

      notes: values.notes,

      attachments: normalizeDocumentAttachments(values.attachments),

      discount_amount: Number(values.discount_amount ?? 0) || 0,

      items: validItems.map((it: any) => {
        const resolved = resolveContractLineMaterialFields(it, materialList);
        return {
          material_id: Number(it.material_id),

          material_code: resolved.material_code,

          material_name: resolved.material_name,

          material_spec: it.material_spec,

          material_unit: resolved.material_unit,

          contract_quantity: Number(it.contract_quantity),

          unit_price: Number(it.unit_price),

          tax_rate: Number(it.tax_rate ?? 0),

          total_amount: calcContractLineAmounts(

            it.contract_quantity,

            it.unit_price,

            it.tax_rate,

            values.price_type,

          ).incl,

          delivery_date: toApiDateString(it.delivery_date),

          variant_attributes: it.variant_attributes,

          notes: it.notes,
        };
      }),

      milestones,

    };

  };


  async function initSalesContractCreateForm() {
    setEditingId(null);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    formRef.current?.resetFields();
    setTimeout(() => {
      formRef.current?.setFieldsValue({
        contract_type: 'single',
        contract_date: dayjs(),
        valid_from: dayjs(),
        price_type: DEFAULT_SALES_PRICE_TYPE,
        currency_code: 'CNY',
        discount_amount: 0,
        items: [{ ...defaultContractItem }],
        milestones: [],
        term_group_id: undefined,
      });
      setTermTemplateTerms([]);
      setTermPlaceholderValues({});
      setTermsPreview([]);
    }, 100);
    const applyPreviewCode = async (ruleCode: string, contractDate?: dayjs.Dayjs) => {
      try {
        const codeResponse = await testGenerateCode({
          rule_code: ruleCode,
          context: contractDate ? { date: toApiDateString(contractDate) } : undefined,
        });
        const preview = codeResponse.code;
        setPreviewCode(preview ?? null);
        formRef.current?.setFieldsValue({ contract_code: preview ?? '' });
      } catch (error: unknown) {
        console.warn('销售合同编号预生成失败:', error);
        setPreviewCode(null);
      }
    };
    try {
      const config = await getCodeRulePageConfig('kuaizhizao-sales-contract');
      const autoGen = config?.autoGenerate ?? isAutoGenerateEnabled('kuaizhizao-sales-contract');
      const ruleCode = config?.ruleCode ?? getPageRuleCode('kuaizhizao-sales-contract');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(autoGen);
      if (autoGen && ruleCode) {
        await applyPreviewCode(ruleCode, dayjs());
      }
    } catch {
      const ruleCode = getPageRuleCode('kuaizhizao-sales-contract');
      const autoGen = isAutoGenerateEnabled('kuaizhizao-sales-contract');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(autoGen);
      if (autoGen && ruleCode) {
        await applyPreviewCode(ruleCode, dayjs());
      }
    }
  }

  async function initSalesContractEditForm(contractId: number) {
    try {
      const data = await salesContractApi.get(contractId);
      setEditingId(contractId);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          contract_code: data.contract_code,
          contract_type: data.contract_type || 'single',
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          customer_contact: data.customer_contact,
          customer_phone: data.customer_phone,
          contract_date: data.contract_date ? dayjs(data.contract_date) : undefined,
          valid_from: data.valid_from ? dayjs(data.valid_from) : undefined,
          valid_to: data.valid_to ? dayjs(data.valid_to) : undefined,
          price_type: normalizeSalesPriceType(data.price_type),
          currency_code: data.currency_code || 'CNY',
          discount_amount: Number(data.discount_amount ?? 0) || 0,
          salesman_name: data.salesman_name,
          shipping_address: data.shipping_address,
          shipping_method: data.shipping_method,
          payment_terms: data.payment_terms,
          notes: data.notes,
          attachments: mapAttachmentsToUploadList(data.attachments),
          items: (data.items ?? []).length
            ? data.items!.map((it) => ({
                ...it,
                delivery_date: it.delivery_date ? dayjs(it.delivery_date) : undefined,
              }))
            : [{ ...defaultContractItem }],
          milestones: (data.milestones ?? []).map((ms) => ({
            ...ms,
            planned_date: ms.planned_date ? dayjs(ms.planned_date) : undefined,
          })),
          term_group_id: data.term_group_id,
          contract_terms: data.contract_terms,
        });
        applyTermGroupPreview(data.term_group_id, data.contract_terms as SalesContractTermSnapshot[] | undefined);
      }, 100);
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.salesContract.loadContractFailed'));
      leaveSalesContractFormPage();
    }
  }

  const handleCreate = () => {
    navigate(SALES_CONTRACT_CREATE_PATH);
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
        contract_id: q.contract_id ? Number(q.contract_id) : undefined,
        contract_code: q.contract_code || '',
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
          skip: 0,
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          keyword: keyword.trim() || undefined,
        });
        const rows: Quotation[] = Array.isArray(result) ? result : result.data || [];
        return pagePullCandidates(mapPullQuotationRows(rows), scope, page, pageSize, isPullQuotationSelectable);
      } catch (error: any) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.salesOrder.loadQuotationsFailed')));
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
          quotationCapabilityReasonMessage(selected.capabilities?.convert_to_contract?.reason, t) ||
          t('app.kuaizhizao.salesOrder.pullQuotationNotAllowed');
        messageApi.warning(reason);
        return;
      }
      try {
        const result = await salesContractApi.pullSalesContractFromQuotation(selectedId);
        messageApi.success(
          result?.message ||
            t('app.kuaizhizao.salesOrder.createdFromQuotation', {
              code: result?.sales_contract?.contract_code || '',
            }),
        );
        pullFromQuotationQuery.closeModal();
        reload();
        if (result?.sales_contract?.id) {
          void openDetail(Number(result.sales_contract.id));
        }
      } catch (error: any) {
        messageApi.error(
          getApiErrorMessage(
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
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        align: 'center' as const,
        render: (v) => renderPullQueryDocStatus(t, v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.reviewStatus'),
        dataIndex: 'review_status',
        width: 120,
        render: (v) => renderPullQueryReviewStatus(t, v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.salesman'),
        dataIndex: 'salesman_name',
        width: 120,
        ellipsis: true,
        render: (v: string) => v || '-',
      },
      {
        title: t('app.kuaizhizao.salesOrder.duplicateGuardHint'),
        width: 260,
        render: (_: unknown, record: PullQuotationCandidate) => {
          if (isPullQuotationSelectable(record)) {
            return t('app.kuaizhizao.salesOrder.canCreate');
          }
          if (record.contract_id) {
            return t('app.kuaizhizao.salesOrder.alreadyCreated', {
              code: record.contract_code || '-',
            });
          }
          const reason = quotationCapabilityReasonMessage(
            record.capabilities?.convert_to_contract?.reason,
            t,
          );
          return reason || t('app.kuaizhizao.salesOrder.pullQuotationNotAllowed');
        },
      },
    ],
    [t],
  );

  const selectedPullQuotation = pullFromQuotationQuery.selectedRows[0];
  const selectedPullQuotationNotPullable = !!(
    selectedPullQuotation && !isPullQuotationSelectable(selectedPullQuotation)
  );

  const handlePullFromQuotation = () => {
    pullFromQuotationQuery.openModal();
  };

  const handleEdit = (record: SalesContract) => {
    if (!record.id) return;
    navigate(salesContractEditPath(record.id));
  };

  useEffect(() => {
    if (!isFormPage) {
      formPageInitializedRef.current = false;
      return;
    }
    const titleKey = isCreatePage
      ? 'app.kuaizhizao.menu.sales-management.sales-contracts.new'
      : 'app.kuaizhizao.menu.sales-management.sales-contracts.edit';
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
      void initSalesContractCreateForm();
    } else if (editRouteId) {
      void initSalesContractEditForm(editRouteId);
    }
  }, [isFormPage, isCreatePage, editRouteId]);

  const triggerContractFormSubmit = () => formRef.current?.submit?.();

  useSubmitShortcut(() => triggerContractFormSubmit(), isFormPage);


  const handleFormSubmit = async (values: any, options?: { asDraft?: boolean }) => {
    const asDraft = options?.asDraft ?? false;
    try {
      let submitValues = values;
      if (isCreatePage) {
        const submitRuleCode = effectiveRuleCode || getPageRuleCode('kuaizhizao-sales-contract');
        const submitAutoEnabled = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-sales-contract');
        const contractCode = submitValues.contract_code;
        if (
          submitAutoEnabled &&
          submitRuleCode &&
          (contractCode === previewCode || !contractCode)
        ) {
          try {
            const codeResponse = await generateCode({
              rule_code: submitRuleCode,
              context: submitValues.contract_date
                ? { date: toApiDateString(submitValues.contract_date) }
                : undefined,
            });
            submitValues = { ...submitValues, contract_code: codeResponse.code };
          } catch (err: unknown) {
            messageApi.error(
              getApiErrorMessage(err, t('app.kuaizhizao.salesContract.generateCodeFailed')),
            );
            return;
          }
        }
      }
      const payload = buildFormPayload(submitValues);
      if (isCreatePage && submitValues.contract_code?.trim()) {
        payload.contract_code = submitValues.contract_code.trim();
      }

      if (editingId) {
        await salesContractApi.update(editingId, payload);
        if (!asDraft) {
          await salesContractApi.submit(editingId);
          messageApi.success(t('app.kuaizhizao.salesContract.saveAndSubmit'));
        } else {
          messageApi.success(t('app.kuaizhizao.salesContract.savedDraft'));
        }
      } else {
        await salesContractApi.create(payload, !asDraft);
        messageApi.success(
          asDraft
            ? t('app.kuaizhizao.salesContract.savedDraft')
            : t('app.kuaizhizao.salesContract.created'),
        );
      }

      if (isFormPage) {
        leaveSalesContractFormPage();
      } else {
        setEditingId(null);
        reload();
        if (detail?.id === editingId) openDetail(editingId);
      }
    } catch (err: any) {
      if (err?.message === CONTRACT_ITEMS_REQUIRED) {
        return;
      }
      if (
        err?.message === 'contract_line_material_missing' ||
        err?.message === 'contract_customer_required' ||
        err?.message === 'contract_date_required' ||
        err?.message === 'contract_customer_name_required' ||
        err?.message === 'contract_milestone_date_required'
      ) {
        return;
      }
      if (err?.errorFields?.length) {
        messageApi.warning(err?.message ?? t('components.layoutTemplates.formModal.checkFormHint'));
        return;
      }
      messageApi.error(
        getApiErrorMessage(
          err,
          asDraft ? t('app.kuaizhizao.salesContract.saveDraftFailed') : t('app.kuaizhizao.salesContract.createFailed'),
        ),
      );
    }
  };

  const handleSaveDraft = async () => {
    try {
      const values = await formRef.current?.validateFields();
      if (values) await handleFormSubmit(values, { asDraft: true });
    } catch (err: any) {
      if (err?.errorFields?.length) {
        messageApi.warning(err?.message ?? t('components.layoutTemplates.formModal.checkFormHint'));
      } else if (err?.message) {
        messageApi.error(err.message);
      }
    }
  };


  const handleDeleteDraft = (record: SalesContract) => {

    getAntdModal().confirm({

      title: t('app.kuaizhizao.salesContract.deleteTitle'),

      content: t('app.kuaizhizao.salesContract.deleteDraftConfirm', {
        code: record.contract_code || record.id,
      }),

      okText: t('common.delete'),

      okButtonProps: { danger: true },

      onOk: async () => {

        try {

          await salesContractApi.remove(record.id!);

          messageApi.success(t('app.kuaizhizao.salesContract.deleted'));

          if (detail?.id === record.id) setDetailOpen(false);

          reload();

        } catch (e: any) {

          messageApi.error(e?.message || t('common.deleteFailed'));

        }

      },

    });

  };


  const contractCodeAutoEnabled = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-sales-contract');

  const renderCreateForm = () => (
    <>
      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionBasic')}>
        <div className="document-form-untitled-groups">
          <div className="document-form-untitled-group">
            <Row gutter={16}>
              <Col span={8}>
                <ProFormText
                  name="contract_code"
                  label={t('app.kuaizhizao.salesContract.contractCode')}
                  placeholder={
                    contractCodeAutoEnabled
                      ? t('app.kuaizhizao.salesContract.contractCodeAutoPlaceholder')
                      : t('app.kuaizhizao.salesContract.contractCodeRequired')
                  }
                  rules={[{ required: true, whitespace: true, message: t('app.kuaizhizao.salesContract.contractCodeRequired') }]}
                  fieldProps={{ disabled: isEditPage }}
                />
              </Col>
              <Col span={8}>
                <ProForm.Item
                  name="customer_id"
                  label={t('app.kuaizhizao.salesContract.customer')}
                  rules={[{ required: true, message: t('app.kuaizhizao.salesContract.selectCustomerRequired') }]}
                >
                  <CustomerSelectDropdown
                    placeholder={t('app.kuaizhizao.salesContract.selectCustomer')}
                    style={{ width: '100%' }}
                    customers={customerList}
                    onCustomersChange={setCustomerList}
                    autoLoad={false}
                    onCustomerPick={(cust) => {
                      applyCustomerFormFields(formRef, cust as Record<string, unknown> | null, {
                        customerList,
                      });
                    }}
                  />
                </ProForm.Item>
              </Col>
              <Col span={8}>
                <ProFormText
                  name="salesman_name"
                  label={salesCommonLabels.salesman}
                  placeholder={t('app.kuaizhizao.salesContract.salesmanPlaceholder')}
                  fieldProps={{ style: { width: '100%' } }}
                />
              </Col>
            </Row>
          </div>
          <div className="document-form-untitled-group">
            <Row gutter={16}>
              <Col span={8}>
                <ProFormDatePicker
                  name="contract_date"
                  label={t('app.kuaizhizao.salesContract.contractDate')}
                  rules={[{ required: true, message: t('app.kuaizhizao.salesContract.contractDateRequired') }]}
                  fieldProps={{ style: { width: '100%' } }}
                />
              </Col>
              <Col span={8}>
                <ProFormDatePicker
                  name="valid_from"
                  label={t('app.kuaizhizao.salesContract.validFrom')}
                  fieldProps={{ style: { width: '100%' } }}
                />
              </Col>
              <Col span={8}>
                <ProFormDatePicker
                  name="valid_to"
                  label={t('app.kuaizhizao.salesContract.validTo')}
                  fieldProps={buildFutureDateShortcutFieldProps({
                    getForm: () => formRef.current,
                    fieldName: 'valid_to',
                    baseFieldName: 'contract_date',
                    t,
                  })}
                />
              </Col>
            </Row>
          </div>
          <div className="document-form-untitled-group">
            <Row gutter={16}>
              <Col span={5}>
                <DictionarySelect
                  dictionaryCode="SHIPPING_METHOD"
                  name="shipping_method"
                  label={t('app.kuaizhizao.salesOrder.shippingMethod')}
                  placeholder={t('app.kuaizhizao.salesContract.selectShippingMethod')}
                  formRef={formRef}
                  valueEqualsLabel={false}
                />
              </Col>
              <Col span={5}>
                <ProFormText name="customer_contact" label={salesCommonLabels.contact} />
              </Col>
              <Col span={5}>
                <ProFormText name="customer_phone" label={salesCommonLabels.phone} />
              </Col>
              <Col span={5}>
                <DictionarySelect
                  dictionaryCode="PAYMENT_TERMS"
                  name="payment_terms"
                  label={t('app.kuaizhizao.salesOrder.paymentTerms')}
                  placeholder={t('app.kuaizhizao.salesContract.selectPaymentTerms')}
                  formRef={formRef}
                  valueEqualsLabel={false}
                />
              </Col>
              <Col span={4}>
                <DictionarySelect
                  dictionaryCode="CURRENCY"
                  name="currency_code"
                  label={t('app.kuaizhizao.salesContract.currency')}
                  placeholder={t('app.kuaizhizao.salesContract.selectCurrency')}
                  formRef={formRef}
                  initialValue="CNY"
                  valueEqualsLabel={false}
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={24}>
                <ProFormText
                  name="shipping_address"
                  label={t('app.kuaizhizao.salesOrder.shippingAddress')}
                  placeholder={t('app.kuaizhizao.salesContract.shippingAddressPlaceholder')}
                />
              </Col>
            </Row>
          </div>
          <div className="document-form-untitled-group">
            <Row gutter={16}>
              <Col span={12}>
                <ProFormSelect
                  name="contract_type"
                  label={t('app.kuaizhizao.salesContract.contractType')}
                  rules={[{ required: true, message: t('app.kuaizhizao.salesContract.contractTypeRequired') }]}
                  options={[
                    { label: t('app.kuaizhizao.salesContract.contractTypeSingle'), value: 'single' },
                    { label: t('app.kuaizhizao.salesContract.contractTypeFramework'), value: 'framework' },
                  ]}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="term_group_id"
                  label={t('app.kuaizhizao.salesContract.terms.selectGroup')}
                  placeholder={t('app.kuaizhizao.salesContract.terms.selectGroupPlaceholder')}
                  options={termGroupOptions}
                  fieldProps={{
                    allowClear: true,
                    onChange: (val: number) => {
                      applyTermGroupPreview(val);
                    },
                  }}
                />
              </Col>
            </Row>
          </div>
        </div>
        <ProFormText name="customer_name" hidden />
        <ProFormText name="price_type" hidden initialValue={DEFAULT_SALES_PRICE_TYPE} />
      </DetailDrawerSection>

      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionLines')}>
        <SalesContractItemsFormTable
          formRef={formRef}
          materialList={materialList}
          onOpenMaterialPicker={() => setMaterialPickerOpen(true)}
          onOpenImport={() => {
            if (!contractPerms.canImport) {
              messageApi.warning(t('app.kuaizhizao.salesContract.noImportPermission'));
              return;
            }
            setImportModalVisible(true);
          }}
          showImportButton={contractPerms.canImport}
          onPriceTypeChange={handleContractPriceTypeChange}
          onRefreshLinePriceByVariant={refreshContractLinePriceByVariant}
          editingIncl={contractEditingIncl}
          setEditingIncl={setContractEditingIncl}
          editingInclValueRef={contractEditingInclValueRef}
        />

        <ProForm.Item label={t('app.kuaizhizao.salesContract.paymentPlanOptional')} colon={false} style={{ marginTop: 16 }}>
          <AntForm.List name="milestones">
            {(fields, { add, remove }) => {
              const msCols = [
                {
                  title: t('app.kuaizhizao.salesContract.milestoneName'),
                  width: 160,
                  render: (_: unknown, __: unknown, index: number) => (
                    <ProFormText
                      name={[index, 'milestone_name']}
                      placeholder={t('app.kuaizhizao.salesContract.milestoneNamePlaceholder')}
                      formItemProps={{ style: { margin: 0 } }}
                    />
                  ),
                },
                {
                  title: t('app.kuaizhizao.salesContract.plannedDate'),
                  width: 140,
                  render: (_: unknown, __: unknown, index: number) => (
                    <ProFormDatePicker
                      name={[index, 'planned_date']}
                      fieldProps={buildFutureDateShortcutFieldProps({
                        getForm: () => formRef.current,
                        fieldName: 'planned_date',
                        baseFieldName: 'contract_date',
                        t,
                        onApply: (date) =>
                          formRef.current?.setFieldValue?.(['milestones', index, 'planned_date'], date),
                      })}
                      formItemProps={{ style: { margin: 0 } }}
                    />
                  ),
                },
                {
                  title: t('app.kuaizhizao.salesContract.plannedAmount'),
                  width: 120,
                  render: (_: unknown, __: unknown, index: number) => (
                    <ProFormDigit
                      name={[index, 'planned_amount']}
                      min={0}
                      fieldProps={{ style: { width: '100%' } }}
                      formItemProps={{ style: { margin: 0 } }}
                    />
                  ),
                },
                {
                  title: t('app.kuaizhizao.salesContract.ratioPercent'),
                  width: 100,
                  render: (_: unknown, __: unknown, index: number) => (
                    <ProFormDigit
                      name={[index, 'planned_ratio']}
                      min={0}
                      max={100}
                      fieldProps={{ style: { width: '100%' } }}
                      formItemProps={{ style: { margin: 0 } }}
                    />
                  ),
                },
                {
                  title: t('app.kuaizhizao.salesContract.billingTrigger'),
                  width: 120,
                  render: (_: unknown, __: unknown, index: number) => (
                    <ProFormSelect
                      name={[index, 'billing_trigger']}
                      options={[
                        { label: t('app.kuaizhizao.salesContract.billingTriggerMilestone'), value: 'milestone' },
                        { label: t('app.kuaizhizao.salesContract.billingTriggerDelivery'), value: 'delivery' },
                      ]}
                      formItemProps={{ style: { margin: 0 } }}
                    />
                  ),
                },
                {
                  title: t('common.actions'),
                  width: 60,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} />
                  ),
                },
              ];
              return (
                <>
                  {fields.length > 0 ? (
                    <Table
                      {...DOCUMENT_SUBLINE_TABLE_PROPS}
                      rowKey="key"
                      dataSource={fields}
                      columns={msCols as any}
                      scroll={{ x: 'max-content' }}
                    />
                  ) : null}
                  <Button
                    type="dashed"
                    block
                    icon={<PlusOutlined />}
                    style={{ marginTop: 8 }}
                    onClick={() => add({ ...defaultMilestone })}
                  >
                    {t('app.kuaizhizao.salesContract.addPaymentNode')}
                  </Button>
                </>
              );
            }}
          </AntForm.List>
        </ProForm.Item>

        {termFieldBindingKeys.length > 0 && (
          <Card
            size="small"
            title={t('app.kuaizhizao.salesContract.terms.fieldBindingAutoTitle')}
            style={{ marginBottom: 16 }}
          >
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {t('app.kuaizhizao.salesContract.terms.fieldBindingAutoHint')}
            </Typography.Paragraph>
            <Space size={[8, 8]} wrap>
              {termFieldBindingKeys.map((field) => (
                <Tag key={field} color="blue">
                  {t('app.kuaizhizao.salesContract.terms.fieldBindingItem', { field })}
                </Tag>
              ))}
            </Space>
          </Card>
        )}

        {termPlaceholderKeys.length > 0 && (
          <Card
            size="small"
            title={t('app.kuaizhizao.salesContract.terms.placeholderFillTitle')}
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[16, 12]}>
              {termPlaceholderKeys.map((key) => (
                <Col key={key} span={8}>
                  <div style={{ marginBottom: 4 }}>
                    <Typography.Text type="secondary">{key}</Typography.Text>
                  </div>
                  <Input
                    value={termPlaceholderValues[key] ?? ''}
                    placeholder={t('app.kuaizhizao.salesContract.terms.placeholderInputHint', { name: key })}
                    onChange={(e) => handleTermPlaceholderChange(key, e.target.value)}
                  />
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {termsPreview.length > 0 && (
          <Card
            size="small"
            title={t('app.kuaizhizao.salesContract.terms.previewTitle')}
            style={{ marginBottom: 16 }}
          >
            {termsPreview.map((term, idx) => (
              <div key={`${term.term_item_id ?? idx}-${term.term_name}`} style={{ marginBottom: 12 }}>
                <Typography.Text strong>
                  {idx + 1}. {term.term_name}
                </Typography.Text>
                <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                  <ContractTermPreviewContent content={term.content ?? ''} />
                </Typography.Paragraph>
              </div>
            ))}
          </Card>
        )}

        <ProFormTextArea name="notes" label={t('common.remark')} fieldProps={{ rows: 2 }} />
      </DetailDrawerSection>

      <DetailDrawerSection
        titleAccent
        title={t('app.uniDetail.sectionAttachments')}
        marginBottom={0}
      >
        <DocumentAttachmentsField category="sales_contract_attachments" label={false} />
      </DetailDrawerSection>
    </>
  );


  const loadPaymentSummary = async (id: number) => {

    try {

      const summary = await salesContractApi.paymentSummary(id);

      setPaymentSummary(summary);

    } catch {

      setPaymentSummary(null);

    }

  };


  const openDetail = async (id: number) => {

    setDetailLoading(true);

    setDetailOpen(true);

    setPaymentSummary(null);

    try {

      const data = await salesContractApi.get(id);

      setDetail(data);

      void loadPaymentSummary(id);

    } catch (e: any) {

      messageApi.error(e?.message || t('app.kuaizhizao.salesContract.loadDetailFailed'));

      setDetailOpen(false);

    } finally {

      setDetailLoading(false);

    }

  };


  useEffect(() => {

    const raw = (location.state as { openContractId?: unknown } | null)?.openContractId;

    const id = typeof raw === 'number' ? raw : raw != null ? Number(raw) : NaN;

    if (!Number.isFinite(id) || id <= 0) return;

    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });

    void openDetail(id);

  }, [location.state, location.pathname, location.search, navigate]);


  const reload = useCallback(() => {
    invalidateMenuBadge();
    actionRef.current?.reload();
  }, [invalidateMenuBadge]);

  const refreshDetail = async (id: number) => {
    const data = await salesContractApi.get(id);
    setDetail(data);
    void loadPaymentSummary(id);
    setTrackingRefreshKey((k) => k + 1);
    reload();
  };

  /** 审核流动作成功后：刷新列表；若详情抽屉正打开同一单据则同步详情/生命周期 */
  const handleContractWorkflowSuccess = useCallback(
    (contractId?: number) => {
      reload();
      const openId = detail?.id;
      const targetId = contractId ?? openId;
      if (detailOpen && targetId != null && (contractId == null || openId === contractId)) {
        void refreshDetail(targetId);
      }
    },
    // refreshDetail/reload 依赖稳定的 actionRef；detail/detailOpen 决定是否同步抽屉
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshDetail 每次 render 新建，刻意用最新闭包
    [detail?.id, detailOpen, reload],
  );

  // 统一审核动作由 UniWorkflowActions 接管（提交/撤回提交/审核/驳回/撤销审核）

  const handlePrint = (record: SalesContract) => {
    if (!record.id) return;
    openPrint({ documentType: 'sales_contract', documentId: record.id });
  };

  const contractAuditBatchHandlers = useMemo(
    () => ({
      submit: (id: number) => salesContractApi.submit(id),
      withdraw: (id: number) => salesContractApi.withdraw(id),
      approve: (id: number) => salesContractApi.approve(id),
      revoke: (id: number) => salesContractApi.revokeReview(id),
    }),
    [],
  );

  const handleContractAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    reload();
    if (detailOpen && detail?.id != null) {
      void refreshDetail(detail.id);
    }
  }, [detail?.id, detailOpen, reload]);

  const handleBatchDeleteDrafts = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.salesContract.selectToDelete'));
      return;
    }
    const selected = keys
      .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
      .filter((row): row is SalesContract => row != null);
    if (
      selected.length > 0 &&
      !salesContractBatchDeleteAllowed(selected, contractPerms.canDelete)
    ) {
      messageApi.warning(t('app.kuaizhizao.salesContract.batchDeleteNotAllowed'));
      return;
    }
    let success = 0;
    let failed = 0;
    for (const key of keys) {
      const id = Number(key);
      if (!Number.isFinite(id) || id <= 0) {
        failed += 1;
        continue;
      }
      try {
        await salesContractApi.remove(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) messageApi.success(t('app.kuaizhizao.salesContract.batchDeleteSuccess', { count: success }));
    if (failed > 0) messageApi.warning(t('app.kuaizhizao.salesContract.batchDeletePartial', { count: failed }));
    setSelectedRowKeys([]);
    reload();
  }, [contractPerms.canDelete, messageApi, reload, t]);

  const handleCloseContract = async () => {

    if (!detail?.id) return;

    try {

      await salesContractApi.close(detail.id, closeReason.trim() || undefined);

      messageApi.success(t('app.kuaizhizao.salesContract.closed'));

      setCloseModalOpen(false);

      setCloseReason('');

      await refreshDetail(detail.id);

    } catch (e: any) {

      messageApi.error(e?.message || t('app.kuaizhizao.salesContract.closeFailed'));

    }

  };


  const resetPushPreviewModal = () => {
    setPushPreviewOpen(false);
    setPushPreviewData(null);
    setPushPreviewRecord(null);
    setPushPreviewTarget(null);
    setPushSelectedItemIds([]);
    setPushQuantities({});
    setWorkOrderPushMode('draft');
  };

  const showContractPushPreview = useCallback(
    (record: SalesContract, target: ContractPushTarget) => {
      if (!record.id) return;
      setPushPreviewOpen(true);
      setPushPreviewLoading(true);
      setPushPreviewConfirming(false);
      setPushPreviewData(null);
      setPushPreviewTarget(target);
      setPushPreviewRecord(record);
      setPushSelectedItemIds([]);
      setPushQuantities({});
      const fetchPreview =
        target === 'sales_order'
          ? () => salesContractApi.previewPushToSalesOrder(record.id!)
          : () => salesContractApi.previewPushToWorkOrder(record.id!);
      void fetchPreview()
        .then((res) => {
          setPushPreviewData(res);
          const defaultIds: number[] = [];
          const qtyMap: Record<number, number> = {};
          (res.items || []).forEach((row) => {
            const itemId = Number(row.item_id);
            const maxQty = Number(row.max_push_quantity ?? 0);
            if (!Number.isFinite(itemId) || itemId <= 0 || maxQty <= 0) return;
            defaultIds.push(itemId);
            qtyMap[itemId] = maxQty;
          });
          setPushSelectedItemIds(defaultIds);
          setPushQuantities(qtyMap);
          if (target === 'work_order') {
            setWorkOrderPushMode(res.push_mode_default === 'confirm' ? 'confirm' : 'draft');
          }
        })
        .catch((error: any) => {
          messageApi.error(
            error?.message || error?.detail || t('app.kuaizhizao.salesContract.pushPreviewFailed'),
          );
          resetPushPreviewModal();
        })
        .finally(() => setPushPreviewLoading(false));
    },
    [messageApi, t],
  );

  const handlePushPreviewConfirm = async () => {
    if (!pushPreviewRecord?.id || !pushPreviewData || !pushPreviewTarget) return;
    if (pushPreviewData.has_blocking_issues && pushPreviewData.blocking_reason) {
      const reason =
        salesContractCapabilityReasonMessage(pushPreviewData.blocking_reason as string, t) ||
        t('app.kuaizhizao.salesContract.pushOrderStatusRequired');
      messageApi.warning(reason);
      return;
    }

    const rowById = new Map(
      (pushPreviewData.items || []).map((row) => [Number(row.item_id), row]),
    );
    const selectedIds = pushSelectedItemIds.filter((id) => rowById.has(id));
    if (!selectedIds.length) {
      messageApi.warning(t('app.kuaizhizao.salesContract.pushPreviewSelectAtLeastOne'));
      return;
    }

    const lines: { item_id: number; release_quantity: number }[] = [];
    const blockingIssues: string[] = [];
    for (const itemId of selectedIds) {
      const row = rowById.get(itemId);
      const qty = Number(pushQuantities[itemId] ?? 0);
      const maxQty = Number(row?.max_push_quantity ?? 0);
      if (!Number.isFinite(qty) || qty <= 0) {
        messageApi.warning(
          t('app.kuaizhizao.salesOrder.pushQtyInvalid', { code: row?.material_code || itemId }),
        );
        return;
      }
      if (Number.isFinite(maxQty) && maxQty > 0 && qty > maxQty) {
        messageApi.warning(
          t('app.kuaizhizao.salesOrder.pushQtyExceedsRemaining', { code: row?.material_code || itemId }),
        );
        return;
      }
      if (Array.isArray(row?.blocking_issues) && row.blocking_issues.length > 0) {
        blockingIssues.push(...row.blocking_issues.map((m) => String(m)));
      }
      lines.push({ item_id: itemId, release_quantity: qty });
    }

    if (
      pushPreviewTarget === 'work_order' &&
      workOrderPushMode === 'confirm' &&
      blockingIssues.length > 0
    ) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.masterDataMissingForConfirmPush'));
      return;
    }

    setPushPreviewConfirming(true);
    try {
      if (pushPreviewTarget === 'work_order') {
        const res = await salesContractApi.pushToWorkOrder(pushPreviewRecord.id, {
          release_lines: lines,
          push_mode: workOrderPushMode,
        });
        messageApi.success(res?.message || t('app.kuaizhizao.salesContract.workOrderGenerated'));
      } else {
        const res = await salesContractApi.convertToOrder(pushPreviewRecord.id, { release_lines: lines });
        const orderId = (res.sales_order as { id?: number })?.id;
        const orderCode = (res.sales_order as { order_code?: string })?.order_code || '';
        messageApi.success(t('app.kuaizhizao.salesContract.orderGenerated', { code: orderCode }));
        navigate('/apps/kuaizhizao/sales-management/sales-orders', {
          state: orderId ? { openSalesOrderId: orderId } : undefined,
        });
      }
      resetPushPreviewModal();
      if (detail?.id === pushPreviewRecord.id) await refreshDetail(pushPreviewRecord.id);
      else reload();
    } catch (e: any) {
      messageApi.error(
        e?.message ||
          (pushPreviewTarget === 'work_order'
            ? t('app.kuaizhizao.salesContract.pushWorkOrderFailed')
            : t('app.kuaizhizao.salesContract.pushOrderFailed')),
      );
    } finally {
      setPushPreviewConfirming(false);
    }
  };

  const selectedContractForPush = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const selectedId = Number(selectedRowKeys[0]);
    if (!Number.isFinite(selectedId) || selectedId <= 0) return null;
    return tableRowsRef.current.find((row) => Number(row.id) === selectedId) ?? null;
  }, [selectedRowKeys]);

  const resolveContractPushOrderReason = useCallback(
    (record: typeof selectedContractForPush) => {
      if (!record) return undefined;
      if (!record.capabilities?.push_to_sales_order?.allowed) {
        return (
          salesContractCapabilityReasonMessage(record.capabilities?.push_to_sales_order?.reason, t) ||
          t('app.kuaizhizao.salesContract.pushOrderStatusRequired')
        );
      }
      return undefined;
    },
    [t],
  );

  const resolveContractPushWorkOrderReason = useCallback(
    (record: typeof selectedContractForPush) => {
      if (!record) return undefined;
      if (!record.capabilities?.push_to_work_order?.allowed) {
        return (
          salesContractCapabilityReasonMessage(record.capabilities?.push_to_work_order?.reason, t) ||
          t('app.kuaizhizao.salesContract.pushOrderStatusRequired')
        );
      }
      return undefined;
    },
    [t],
  );

  const contractToolbarPushDisabledReason = useMemo(() => {
    if (selectedRowKeys.length === 0) {
      return t('app.kuaizhizao.salesContract.selectContract');
    }
    if (selectedRowKeys.length !== 1) {
      return t('app.kuaizhizao.demandComputation.pushSingleOnly');
    }
    if (!selectedContractForPush) {
      return t('app.kuaizhizao.demandComputation.selectedNotInList');
    }
    return undefined;
  }, [selectedContractForPush, selectedRowKeys.length, t]);

  const handleToolbarPushToOrder = useCallback(async () => {
    const record = selectedContractForPush;
    if (!record?.id) {
      messageApi.warning(t('app.kuaizhizao.salesContract.selectContract'));
      return;
    }
    if (!record.capabilities?.push_to_sales_order?.allowed) {
      messageApi.warning(
        salesContractCapabilityReasonMessage(record.capabilities?.push_to_sales_order?.reason, t) ||
          t('app.kuaizhizao.salesContract.pushOrderStatusRequired'),
      );
      return;
    }
    await showContractPushPreview(record, 'sales_order');
  }, [messageApi, selectedContractForPush, showContractPushPreview, t]);

  const handleToolbarPushToWorkOrder = useCallback(async () => {
    const record = selectedContractForPush;
    if (!record?.id) {
      messageApi.warning(t('app.kuaizhizao.salesContract.selectContract'));
      return;
    }
    if (!record.capabilities?.push_to_work_order?.allowed) {
      messageApi.warning(
        salesContractCapabilityReasonMessage(record.capabilities?.push_to_work_order?.reason, t) ||
          t('app.kuaizhizao.salesContract.pushOrderStatusRequired'),
      );
      return;
    }
    showContractPushPreview(record, 'work_order');
  }, [messageApi, selectedContractForPush, showContractPushPreview, t]);

  const salesContractToolbarRenderItems = useMemo(
    () => [
      <UniPullCreateToolbar
        key="create-sales-contract-with-pull"
        compactKey="create-sales-contract-with-pull"
        createIcon={<PlusOutlined />}
        createLabel={t('app.kuaizhizao.salesContract.create')}
        onCreate={handleCreate}
        menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
          {
            key: 'pull-from-quotation',
            actionKey: 'sales_contract.pull_from_quotation',
            onClick: handlePullFromQuotation,
          },
        ])}
      />,
      <UniPushToolbarButton
        key={`sales-contract-push-toolbar-${selectedRowKeys.join('-') || 'none'}`}
        disabled={selectedRowKeys.length !== 1 || !selectedContractForPush}
        disabledReason={contractToolbarPushDisabledReason}
        menuItems={buildUniPushMenuItems([
          {
            key: 'push-to-sales-order',
            label: pushToSalesOrderAction.label,
            disabled: !!resolveContractPushOrderReason(selectedContractForPush),
            title: resolveContractPushOrderReason(selectedContractForPush),
            onClick: () => void handleToolbarPushToOrder(),
          },
          {
            key: 'push-to-work-order',
            label: pushToWorkOrderAction.label,
            disabled: !!resolveContractPushWorkOrderReason(selectedContractForPush),
            title: resolveContractPushWorkOrderReason(selectedContractForPush),
            onClick: () => void handleToolbarPushToWorkOrder(),
          },
        ])}
      />,
    ],
    [
      contractToolbarPushDisabledReason,
      handleCreate,
      handlePullFromQuotation,
      handleToolbarPushToOrder,
      handleToolbarPushToWorkOrder,
      pushToSalesOrderAction.label,
      pushToWorkOrderAction.label,
      resolveContractPushOrderReason,
      resolveContractPushWorkOrderReason,
      selectedContractForPush,
      selectedRowKeys,
      t,
    ],
  );


  const loadChanges = async (contractId: number) => {

    setChangesLoading(true);

    try {

      const list = await salesContractApi.listChanges(contractId);

      setChanges(Array.isArray(list) ? list : []);

    } catch (e: any) {

      messageApi.error(e?.message || t('app.kuaizhizao.salesContract.loadChangesFailed'));

      setChanges([]);

    } finally {

      setChangesLoading(false);

    }

  };


  const openChangeDrawer = () => {

    if (!detail?.id) return;

    setChangeDrawerOpen(true);

    changeFormRef.current?.resetFields();

    changeFormRef.current?.setFieldsValue({ change_type: 'amendment', delta_amount: 0 });

    void loadChanges(detail.id);

  };


  const handleCreateChange = async (values: any) => {

    if (!detail?.id) return;

    setChangeSubmitting(true);

    try {

      await salesContractApi.createChange(detail.id, {

        change_type: values.change_type,

        delta_amount: Number(values.delta_amount ?? 0),

        new_valid_to: toApiDateString(values.new_valid_to),

        reason: values.reason,

      });

      messageApi.success(t('app.kuaizhizao.salesContract.changeCreated'));

      changeFormRef.current?.resetFields();

      changeFormRef.current?.setFieldsValue({ change_type: 'amendment', delta_amount: 0 });

      await loadChanges(detail.id);

    } catch (e: any) {

      messageApi.error(e?.message || t('app.kuaizhizao.salesContract.createChangeFailed'));

    } finally {

      setChangeSubmitting(false);

    }

  };


  const handleChangeAction = async (changeId: number, action: 'submit' | 'approve' | 'reject') => {

    if (!detail?.id) return;

    try {

      if (action === 'submit') await salesContractApi.submitChange(changeId);

      else if (action === 'approve') await salesContractApi.approveChange(changeId);

      else await salesContractApi.rejectChange(changeId);

      messageApi.success(t('app.kuaizhizao.salesContract.actionSuccess'));

      await loadChanges(detail.id);

      await refreshDetail(detail.id);

    } catch (e: any) {

      messageApi.error(e?.message || t('common.operationFailed'));

    }

  };


  const handleGenerateReceivable = async (milestoneId: number) => {

    if (!detail?.id) return;

    try {

      await salesContractApi.generateMilestoneReceivable(detail.id, milestoneId);

      messageApi.success(t('app.kuaizhizao.salesContract.receivableGenerated'));

      await refreshDetail(detail.id);

      void loadPaymentSummary(detail.id);

    } catch (e: any) {

      messageApi.error(e?.message || t('app.kuaizhizao.salesContract.generateReceivableFailed'));

    }

  };


  const renderLifecycleCell = (record: SalesContract) => (
    <ListUniLifecycleCell lifecycle={getSalesContractLifecycle(record as Record<string, unknown>, t)} />
  );


  const columns: ProColumns<SalesContract>[] = useMemo(

    () => [

      {
        title: `${t('app.kuaizhizao.salesContract.customer')} / ${t('app.kuaizhizao.salesContract.contractCode')}`,
        key: 'contract_code',
        dataIndex: 'contract_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        sorter: true,
        fieldProps: { placeholder: t('app.kuaizhizao.salesContract.contractCode') },
        render: (_, r) => (
          <UniTableStackedPrimaryCell
            primary={String(r.customer_name ?? '')}
            secondary={String(r.contract_code ?? '')}
          />
        ),
      },

      {

        title: t('app.kuaizhizao.salesContract.contractType'),

        dataIndex: 'contract_type',

        width: 100,

        uniTableKeepWidth: true,

        sorter: true,

        valueType: 'select',

        valueEnum: {
          single: { text: contractTypeLabels.single },
          framework: { text: contractTypeLabels.framework },
        },

        render: (_, r) => (
          <Tag color="blue" bordered={false}>
            {contractTypeLabels[r.contract_type as keyof typeof contractTypeLabels] || r.contract_type}
          </Tag>
        ),

      },

      {
        title: t('app.kuaizhizao.salesContract.customer'),
        dataIndex: 'customer_id',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          showSearch: true,
          optionFilterProp: 'label',
          options: contractCustomerSearchOptions,
          placeholder: t('field.customer.name'),
        },
      },

      {
        title: t('app.kuaizhizao.salesContract.contractDate'),
        key: 'contract_date_valid_to_stacked',
        dataIndex: 'contract_date',
        ...UNI_TABLE_STACKED_BADGE_DATE_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={record.contract_date ? formatDateTime(record.contract_date, 'YYYY-MM-DD') : '-'}
            secondary={record.valid_to ? formatDateTime(record.valid_to, 'YYYY-MM-DD') : '-'}
            secondaryCopyable={false}
            uniformText
            primaryBadge={t('common.start')}
            secondaryBadge={t('common.end')}
          />
        ),
      },

      {
        title: t('app.kuaizhizao.salesContract.contractDate'),
        dataIndex: 'contract_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },

      {
        title: t('app.kuaizhizao.salesOrder.totalQuantity'),
        dataIndex: 'total_quantity',
        width: 100,
        uniTableKeepWidth: true,
        align: 'right',
        sorter: true,
        hideInSearch: true,
        render: formatQuantity,
      },

      {
        title: t('app.kuaizhizao.salesContract.contractAmount'),
        dataIndex: 'total_amount',
        width: 120,
        uniTableKeepWidth: true,
        align: 'right',
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          `¥${Number(r.total_amount).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
      },

      {

        title: t('app.kuaizhizao.salesContract.released'),

        dataIndex: 'released_amount',

        width: 120,

        uniTableKeepWidth: true,

        align: 'right',

        sorter: true,

        hideInSearch: true,

        render: (_, r) =>
          `¥${Number(r.released_amount).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,

      },

      {
        title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
        dataIndex: 'order_push_progress',
        ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
        render: (_, r) => {
          const totalQty = Number(r.total_quantity ?? 0);
          const releasedQty = Number(r.released_quantity ?? 0);
          const percent = salesContractOrderPushPercent(releasedQty, totalQty);
          return (
            <DocumentPushProgressBar
              percent={percent}
              tooltip={t('app.kuaizhizao.salesManagement.pushProgress.orderReleaseTooltip', {
                percent,
                pushed: releasedQty,
                total: totalQty,
              })}
              documents={collectSalesContractPushDocuments(
                r.released_sales_order_codes,
                t('components.documentTrackingPanel.docType.sales_order'),
              )}
              formatMoreDocs={(count) =>
                t('app.kuaizhizao.salesManagement.pushProgress.moreDocs', { count })
              }
            />
          );
        },
      },

      ...buildDocumentAuditColumns<SalesContract>(t),

      ...(contractAuditColumn ? [contractAuditColumn] : []),

      {

        title: t('app.kuaizhizao.salesOrder.lifecycle'),

        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,

        fixed: 'right',

        valueType: 'select',

        valueEnum: contractLifecycleValueEnum,

        render: (_, r) => renderLifecycleCell(r),

      },

      {

        title: t('common.actions'),

        valueType: 'option',



        fixed: 'right',
        hideInSearch: true,

        render: (_, record) => {
          const canEdit = record.capabilities?.update?.allowed === true && contractPerms.canUpdate;
          const canDelete = record.capabilities?.delete?.allowed === true && contractPerms.canDelete;
          const parts: React.ReactNode[] = [
            <Button {...rowActionKind('read')} key="view" onClick={() => openDetail(record.id!)}>
              {t('common.detail')}
            </Button>,
          ];
          if (canEdit) {
            parts.push(
              <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>
                {t('common.edit')}
              </Button>,
            );
          }
          if (canDelete) {
            parts.push(
              <Button {...rowActionKind('delete')} key="del" onClick={() => handleDeleteDraft(record)}>
                {t('common.delete')}
              </Button>,
            );
          }
          parts.push(
            <UniWorkflowActions
              key="contract-workflow"
              {...rowActionKind('skip')}
              record={record}
              entityName={t('app.kuaizhizao.salesContract.entityName')}
              auditNodeKey="sales_contract"
              resourcePrefix="kuaizhizao:sales-contract"
              unifiedAudit
              statusField="status"
              reviewStatusField="review_status"
              pendingStatuses={['待审核', 'pending_review', 'PENDING_REVIEW', '已发送', 'sent']}
              approvedStatuses={['已审核', '已确认', '审核通过', 'approved', 'APPROVED']}
              rejectedStatuses={['已驳回', 'rejected', 'REJECTED']}
              onSuccess={() => handleContractWorkflowSuccess(record.id)}
            />,
          );
          return parts;
        },

      },

    ],

    [
      t,
      contractAuditColumn,
      contractTypeLabels,
      contractCustomerSearchOptions,
      contractLifecycleValueEnum,
      statusLabels,
      renderContractStatus,
      contractPerms.canDelete,
      contractPerms.canPrint,
      contractPerms.canUpdate,
      handleContractWorkflowSuccess,
    ],

  );
  const alignedListColumns = useMemo(
    () => alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK),
    [columns],
  );

  const detailTableColumns: ProColumns<SalesContractItemRow>[] = useMemo(
    () =>
      alignProColumns<SalesContractItemRow>(
        [
      {
        title: `${t('app.kuaizhizao.salesContract.customer')} / ${t('app.kuaizhizao.salesContract.contractCode')}`,
        key: 'contract_code',
        dataIndex: 'contract_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: false,
        fieldProps: { placeholder: t('app.kuaizhizao.salesContract.contractCode') },
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.customer_name ?? '')}
            secondary={String(record.contract_code ?? '')}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.salesContract.contractCode'),
        dataIndex: 'contract_code',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialName'),
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
        title: t('app.kuaizhizao.salesOrder.materialCode'),
        dataIndex: 'material_code',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.salesContract.contractQuantity'),
        dataIndex: 'contract_quantity',
        width: 120,
        align: 'right',
        render: (val: unknown, record) => (
          <QuantityWithUnitDisplay quantity={val} unit={record.material_unit} />
        ),
      },
      {
        title: t('app.kuaizhizao.salesContract.unitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        align: 'right',
        render: (_, r) =>
          `¥${Number(r.unit_price ?? 0).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
      },
      {
        title: t('app.kuaizhizao.salesContract.contractAmount'),
        dataIndex: 'total_amount',
        width: 110,
        align: 'right',
        render: (_, r) =>
          `¥${Number(r.total_amount ?? 0).toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
      },
      {
        title: t('app.kuaizhizao.salesOrder.deliveryDate'),
        dataIndex: 'delivery_date',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_: unknown, row) =>
          row.delivery_date ? formatDateTime(row.delivery_date, 'YYYY-MM-DD') : '-',
      },
      {
        title: t('app.kuaizhizao.salesContract.contractDate'),
        dataIndex: 'contract_date',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_: unknown, row) =>
          row.contract_date ? formatDateTime(row.contract_date, 'YYYY-MM-DD') : '-',
      },
      {
        title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
        key: 'line_release_progress',
        ...DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS,
        render: (_: unknown, record) => {
          const ordered = Number(record.contract_quantity ?? 0);
          const released = Number(record.released_quantity ?? 0);
          const percent = ratioToPushProgressPercent(released, ordered);
          return (
            <DocumentPushProgressBar
              percent={percent}
              tooltip={t('app.kuaizhizao.salesManagement.pushProgress.orderReleaseTooltip', {
                percent,
                pushed: released,
                total: ordered,
              })}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.salesOrder.lifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        fixed: 'right',
        hideInSearch: false,
        valueEnum: contractLifecycleValueEnum,
        render: (_, record) => (
          <ListUniLifecycleCell
            lifecycle={getSalesContractLifecycle(record as Record<string, unknown>, t)}
          />
        ),
      },
        ],
        GLOBAL_DOC_DETAIL_TABLE_FIELD_RANK,
      ),
    [contractLifecycleValueEnum, t],
  );


  const detailBasicColumns: ProDescriptionsItemProps<SalesContract>[] = useMemo(
    () => [
    { title: t('app.kuaizhizao.salesContract.contractCode'), dataIndex: 'contract_code' },

    {

      title: t('app.kuaizhizao.salesContract.contractType'),

      dataIndex: 'contract_type',

      render: (_, r) => (
        <Tag color="blue" variant="filled">
          {contractTypeLabels[r.contract_type as keyof typeof contractTypeLabels] || r.contract_type}
        </Tag>
      ),

    },

    { title: t('app.kuaizhizao.salesContract.customer'), dataIndex: 'customer_name' },

    { title: salesCommonLabels.contact, dataIndex: 'customer_contact' },

    { title: salesCommonLabels.phone, dataIndex: 'customer_phone' },

    { title: t('app.kuaizhizao.salesContract.contractDate'), dataIndex: 'contract_date', valueType: 'date' },

    { title: t('app.kuaizhizao.salesContract.validFrom'), dataIndex: 'valid_from', valueType: 'date' },

    { title: t('app.kuaizhizao.salesContract.validTo'), dataIndex: 'valid_to', valueType: 'date' },

    {

      title: t('app.kuaizhizao.salesContract.priceTypeLabel'),

      dataIndex: 'price_type',

      render: (_, r) =>
        r.price_type === 'tax_inclusive'
          ? t('app.kuaizhizao.salesContract.priceTypeTaxInclusive')
          : t('app.kuaizhizao.salesContract.priceTypeTaxExclusive'),

    },

    {

      title: t('app.kuaizhizao.salesOrder.discountAmount'),

      dataIndex: 'discount_amount',

      render: (_, r) =>
        Number(r.discount_amount ?? 0) > 0 ? (
          <AmountDisplay resource={SC} fieldName="amount" value={r.discount_amount} />
        ) : (
          '-'
        ),

    },

    {

      title: t('app.kuaizhizao.salesOrder.totalQuantity'),

      dataIndex: 'total_quantity',

      render: formatQuantity,

    },

    {

      title: t('app.kuaizhizao.salesContract.contractAmount'),

      dataIndex: 'total_amount',

      render: (_, r) => <AmountDisplay resource={SC} fieldName="total_amount" value={r.total_amount} />,

    },

    {

      title: t('app.kuaizhizao.salesContract.releasedAmount'),

      dataIndex: 'released_amount',

      render: (_, r) => <AmountDisplay resource={SC} fieldName="amount" value={r.released_amount} />,

    },

    {

      title: t('app.kuaizhizao.salesContract.remainingAmount'),

      dataIndex: 'remaining_amount',

      render: (_, r) => <AmountDisplay resource={SC} fieldName="amount" value={r.remaining_amount} />,

    },

    {

      title: t('app.kuaizhizao.salesContract.currency'),

      dataIndex: 'currency_code',

      render: (_, r) => (

        <DictionaryLabel dictionaryCode="CURRENCY" value={r.currency_code || 'CNY'} />

      ),

    },

    {

      title: t('app.kuaizhizao.salesOrder.paymentTerms'),

      dataIndex: 'payment_terms',

      render: (_, r) => (

        <DictionaryLabel dictionaryCode="PAYMENT_TERMS" value={r.payment_terms} />

      ),

    },

    { title: salesCommonLabels.salesman, dataIndex: 'salesman_name' },

    {

      title: t('app.kuaizhizao.salesOrder.shippingMethod'),

      dataIndex: 'shipping_method',

      render: (_, r) => (

        <DictionaryLabel dictionaryCode="SHIPPING_METHOD" value={r.shipping_method} />

      ),

    },

    { title: t('app.kuaizhizao.salesContract.sourceQuotation'), dataIndex: 'quotation_code', key: 'quotation_code_link' },

    { title: t('app.kuaizhizao.salesOrder.shippingAddress'), dataIndex: 'shipping_address', span: 3 },

    {
      title: t('app.kuaizhizao.salesContract.terms.selectGroup'),
      dataIndex: 'term_group_name',
      span: 3,
      render: (_, r) =>
        r.term_group_name ? (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <span>{r.term_group_name}</span>
            {(r.contract_terms as SalesContractTermSnapshot[] | undefined)?.map((term, idx) => (
              <div key={`${term.term_item_id ?? idx}`}>
                <Typography.Text strong>
                  {idx + 1}. {term.term_name}
                </Typography.Text>
                <Typography.Paragraph style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>
                  {term.content}
                </Typography.Paragraph>
              </div>
            ))}
          </Space>
        ) : (
          '—'
        ),
    },

    { title: t('common.remark'), dataIndex: 'notes', span: 3 },

  ],
    [t, contractTypeLabels, salesCommonLabels],
  );
  const alignedDetailBasicColumns = useMemo(
    () => alignDescriptionColumns(detailBasicColumns),
    [detailBasicColumns],
  );


  const detailLifecycle = useMemo(
    () => (detail ? getSalesContractLifecycle(detail as Record<string, unknown>, t) : null),
    [detail, t],
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
                onClick={leaveSalesContractFormPage}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {isCreatePage
                  ? t('app.kuaizhizao.menu.sales-management.sales-contracts.new')
                  : t('app.kuaizhizao.menu.sales-management.sales-contracts.edit')}
              </Typography.Title>
            </Space>
            <DocumentFormPageHeaderActions
              onCancel={leaveSalesContractFormPage}
              onSaveDraft={() => void handleSaveDraft()}
              onPrimarySubmit={triggerContractFormSubmit}
              isCreatePage={isCreatePage}
            />
            </>
          }
        >
          <div className="form-modal-content-inner">
              <ProForm
                formRef={formRef}
                layout="vertical"
                submitter={false}
                scrollToFirstError
                onValuesChange={handleContractFormValuesChange}
                onFinish={(values) => handleFormSubmit(values, { asDraft: false })}
                onFinishFailed={({ errorFields }) => {
                  const first = errorFields?.[0];
                  const msg = first?.errors?.filter(Boolean)[0];
                  messageApi.error(msg || t('components.layoutTemplates.formModal.checkFormHint'));
                }}
                initialValues={isCreatePage ? { items: [{ ...defaultContractItem }], discount_amount: 0, price_type: DEFAULT_SALES_PRICE_TYPE } : undefined}
              >
                {renderCreateForm()}
              </ProForm>
            </div>
        </DocumentFormPageLayout>
        <UniMaterialBatchPicker
          open={materialPickerOpen}
          onCancel={() => setMaterialPickerOpen(false)}
          onConfirm={(selected) => {
            appendContractItemsFromMaterials(selected);
            setMaterialPickerOpen(false);
          }}
        />
        <Suspense fallback={null}>
          <LazyUniImport
            visible={importModalVisible}
            onCancel={() => setImportModalVisible(false)}
            onConfirm={handleItemImport}
            title={t('app.kuaizhizao.salesContract.importItemsTitle')}
            headers={contractImportHeaders}
            exampleRow={contractImportExampleRow}
            columnOptions={contractLineImportColumnOptions}
          />
        </Suspense>
      </>
    );
  }

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    alignedDetailBasicColumns, detail,
    'sales_contract',
  );

  return (

    <ListPageTemplate>

      <UniTable<SalesContract>

        actionRef={actionRef}

        rowKey={dataViewMode === 'detail' ? '_rowKey' : 'id'}

        permissionResource={SALES_CONTRACT_RESOURCE}

        columnPersistenceId={SALES_CONTRACT_LIST_PERSISTENCE_ID}

        columns={alignedListColumns}

        viewTypes={['table', 'detailTable', 'help']}

        defaultViewType={viewTypeState === 'help' ? 'table' : viewTypeState}

        helpViewConfig={{

          content: (

            <div style={{ lineHeight: 1.8 }}>

              <p>

                <strong>{t('components.uniTable.viewTable')}</strong>

                {t('app.kuaizhizao.salesContract.helpTableView')}

              </p>

              <p>

                <strong>{t('components.uniTable.viewDetailTable')}</strong>

                {t('app.kuaizhizao.salesContract.helpDetailTableView')}

              </p>

            </div>

          ),

        }}

        onViewTypeChange={(v) => {

          dataViewModeRef.current = resolveDetailTableViewMode(v as 'table' | 'detailTable' | 'help');

          setViewTypeState(v as 'table' | 'detailTable' | 'help');

          setTimeout(() => actionRef.current?.reload(), 0);

        }}

        detailTableColumns={detailTableColumns}

        showAdvancedSearch

        skipFuzzyPinyinClientFilter

        selectedRowKeys={selectedRowKeys}

        onRowSelectionChange={setSelectedRowKeys}

        enableRowSelection={viewTypeState !== 'detailTable'}

        headerTitle={

          <Space>

            <span>{t('app.kuaizhizao.salesContract.title')}</span>

            <Button type="link" size="small" onClick={() => navigate('/apps/kuaizhizao/sales-management/quotations')}>

              {t('app.kuaizhizao.salesContract.fromQuotationLink')}

            </Button>

          </Space>

        }

        showCreateButton={false}
        createButtonText={t('app.kuaizhizao.salesContract.create')}
        onCreate={handleCreate}
        toolBarRender={() => salesContractToolbarRenderItems}

        showDeleteButton={contractPerms.canDelete}
        onDelete={handleBatchDeleteDrafts}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.salesContract.batchDeleteConfirm', { count })}
        toolBarActionsAfterDelete={[
          <UniAuditBatchMenuButton
            key="sales-contract-batch-menu"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedContractsForBatch}
            auditEnabled={contractAuditRequired}
            permGates={contractPerms}
            handlers={contractAuditBatchHandlers}
            onSuccess={handleContractAuditBatchSuccess}
            toolBarButtonSize="middle"
          />,
        ]}
        toolBarActionsAfterBatch={[
          <Button {...rowActionKind('update')} key="terms-manage" onClick={() => setTermsManageOpen(true)}>
            {t('app.kuaizhizao.salesContract.terms.manageBtn')}
          </Button>,
          ...(contractPerms.canPrint
            ? [
                <UniCapabilityBatchButton
                  key="contract-batch-print"
                  selectedRowKeys={selectedRowKeys}
                  selectedRecords={selectedContractsForBatch}
                  capabilityKey="print"
                  permAllowed={contractPerms.canPrint}
                  batchAllowed={(recs, perm) => salesContractBatchPrintAllowed(recs, perm)}
                  singleOnly
                  onRun={async (id) => {
                    const latest = await salesContractApi.get(id, false);
                    if (!latest.capabilities?.print?.allowed) {
                      throw new Error(t('app.kuaizhizao.salesContract.printNotAllowed'));
                    }
                    await handlePrint(latest);
                  }}
                  notAllowedMessage={t('app.kuaizhizao.salesContract.printNotAllowed')}
                  labels={{
                    single: t('components.uniAction.print'),
                    batch: t('components.uniAction.print'),
                  }}
                  icon={<PrinterOutlined />}
                  size="middle"
                />,
              ]
            : []),
        ]}

        showExportButton={contractPerms.canExport}
        showImportButton={contractPerms.canCreate}
        onImport={handleListImport}
        importHeaders={contractListImportTemplate.importHeaders}
        importExampleRow={contractListImportTemplate.importExampleRow}
        importColumnOptions={contractListImportTemplate.importColumnOptions}
        importFieldMap={contractListImportTemplate.importHeaderMap}

        onExport={async (type, keys, pageData) => {
          try {
            let items = await fetchAllListItems((p) => salesContractApi.list(p));
            if (type === 'currentPage' && pageData?.length) {
              items = pageData as SalesContract[];
            } else if (type === 'selected' && keys?.length) {
              items = items.filter((d) => d.id != null && keys.includes(d.id));
            }
            if (items.length === 0) {
              messageApi.warning(t('common.exportNoData'));
              return;
            }
            await downloadRecordsAsXlsx(
              items as Array<Record<string, unknown>>,
              `sales-contracts-${todaySiteDateString()}.xlsx`,
            );
            messageApi.success(t('app.kuaizhizao.salesContract.exportSuccess', { count: items.length }));
          } catch (error: any) {
            messageApi.error(error?.message || t('common.exportFailed'));
          }
        }}

        request={async (params, sort, _filter, searchFormValues) => {

          const lifecycleParams = resolveSalesContractListLifecycleParams(searchFormValues, params);
          const dr = searchFormValues?.contract_date_range as [unknown, unknown] | undefined;
          let startDate: string | undefined;
          let endDate: string | undefined;
          if (dr && Array.isArray(dr) && dr[0]) {
            startDate = formatDateTime(dr[0] as string | Date, 'YYYY-MM-DD');
            endDate = dr[1] ? formatDateTime(dr[1] as string | Date, 'YYYY-MM-DD') : startDate;
          }
          const { sortBy, sortOrder } = extractProTableSort(sort);
          const orderBy =
            sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
          const keyword =
            typeof searchFormValues?.keyword === 'string'
              ? searchFormValues.keyword.trim() || undefined
              : undefined;

          const res = await salesContractApi.list({

            skip: ((params.current || 1) - 1) * (params.pageSize || 20),

            limit: params.pageSize || 20,

            keyword,

            contract_code:
              typeof searchFormValues?.contract_code === 'string'
                ? searchFormValues.contract_code.trim() || undefined
                : undefined,

            status: lifecycleParams.status ?? searchFormValues?.status,

            contract_type: searchFormValues?.contract_type,

            customer_id:
              searchFormValues?.customer_id != null && searchFormValues.customer_id !== ''
                ? Number(searchFormValues.customer_id)
                : undefined,

            start_date: startDate,

            end_date: endDate,

            order_by: orderBy,

            include_items: dataViewModeRef.current === 'detail',

          });

          const contracts = res.items || [];
          // 行缓存唯一真源：onTableDataChange（prefetchNextPage 也会走本 request，禁止在此覆盖）
          if (dataViewModeRef.current === 'order') {
            return { data: contracts, success: true, total: res.total || 0 };
          }
          const flatRows = flattenDocumentDetailRows<SalesContract, SalesContractItem>({
            headers: contracts,
            getHeaderId: (h) => h.id,
            getItems: (h) => h.items,
            buildRowKey: (h, item, index) =>
              item?.id ? `sc-${h.id}-item-${item.id}` : `sc-${h.id}-idx-${index}`,
            mapItemRow: (h, item) => ({
              ...item,
              contract_id: h.id ?? 0,
              contract_code: h.contract_code,
              customer_name: h.customer_name,
              contract_date: h.contract_date,
              status: h.status,
              review_status: h.review_status,
              lifecycle: h.lifecycle,
            }),
            mapEmptyHeaderRow: (h) => ({
              contract_id: h.id ?? 0,
              contract_code: h.contract_code,
              customer_name: h.customer_name,
              material_id: 0,
              material_code: '-',
              material_name: '-',
              material_unit: '',
              contract_quantity: 0,
              unit_price: 0,
              total_amount: 0,
              status: h.status,
              review_status: h.review_status,
              contract_date: h.contract_date,
              lifecycle: h.lifecycle,
            }),
          }) as SalesContractItemRow[];
          return { data: flatRows, success: true, total: res.total || 0 };

        }}
        onTableDataChange={(rows) => {
          if (dataViewModeRef.current === 'order') {
            tableRowsRef.current = rows as SalesContract[];
          }
        }}

      />


      <DetailDrawerTemplate

        title={
          detail?.contract_code
            ? t('app.kuaizhizao.salesContract.detailWithCode', { code: detail.contract_code })
            : t('app.kuaizhizao.salesContract.detail')
        }

        open={detailOpen}

        onClose={() => {

          setDetailOpen(false);

          setDetail(null);

          setPaymentSummary(null);

        }}

        width={DRAWER_CONFIG.HALF_WIDTH}

        loading={detailLoading}

        extra={

          detail ? (

            <Space size="small">

              {!detailCapabilityGates.createChange.disabled && (
                <Button icon={<FormOutlined />} onClick={openChangeDrawer}>{t('app.kuaizhizao.salesContract.contractChange')}</Button>
              )}

              {!detailCapabilityGates.close.disabled && (
                <Button icon={<StopOutlined />} onClick={() => setCloseModalOpen(true)}>{t('app.kuaizhizao.salesContract.closeContract')}</Button>
              )}
              {!detailCapabilityGates.update.disabled && (
                <Button icon={<EditOutlined />} onClick={() => handleEdit(detail)}>{t('common.edit')}</Button>
              )}
              {!detailCapabilityGates.delete.disabled && (
                <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteDraft(detail)}>{t('common.delete')}</Button>
              )}

              <UniWorkflowActions
                {...rowActionKind('skip')}
                record={detail}
                entityName={t('app.kuaizhizao.salesContract.entityName')}
                theme="default"
                auditNodeKey="sales_contract"
                resourcePrefix="kuaizhizao:sales-contract"
                unifiedAudit
                statusField="status"
                reviewStatusField="review_status"
                pendingStatuses={['待审核', 'pending_review', 'PENDING_REVIEW', '已发送', 'sent']}
                approvedStatuses={['已审核', '已确认', '审核通过', 'approved', 'APPROVED']}
                rejectedStatuses={['已驳回', 'rejected', 'REJECTED']}
                onSuccess={() => handleContractWorkflowSuccess(detail.id)}
              />

              {!detailCapabilityGates.print.disabled && (
                <Button icon={<PrinterOutlined />} onClick={() => void handlePrint(detail)}>{t('components.uniAction.print')}</Button>
              )}

            </Space>

          ) : null

        }

        basic={

          detail ? (

            <Descriptions

              column={3}

              size="small"

              items={timeconfigBasicItems}

            />

          ) : undefined

        }

        collaborationAuditRecord={detail}

        collaboration={
          detail && detailLifecycle?.mainStages?.length ? (
            <UniLifecycleStepper
              steps={detailLifecycle.mainStages}
              status={detailLifecycle.status}
              showLabels
              nextStepSuggestions={detailLifecycle.nextStepSuggestions}
              hideNextStepSuggestions
            />
          ) : undefined
        }

        supplementaryTitle={t('app.kuaizhizao.salesContract.paymentSummary')}

        supplementary={
          paymentSummary ? (
            <Descriptions column={3} size="small" bordered>
              <Descriptions.Item label={t('app.kuaizhizao.salesContract.totalContractAmount')}>¥{Number(paymentSummary.total_amount ?? 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesContract.plannedMilestones')}>¥{Number(paymentSummary.planned_milestone_amount ?? 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesContract.invoiced')}>¥{Number(paymentSummary.invoiced_amount ?? 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesContract.collected')}>¥{Number(paymentSummary.collected_amount ?? 0).toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesContract.pendingInvoice')}>¥{Number(paymentSummary.pending_amount ?? 0).toFixed(2)}</Descriptions.Item>
            </Descriptions>
          ) : undefined
        }

        lines={

          detail ? (

            <>

              {detail.items?.length ? (

                <Table

                  size="small"

                  rowKey="id"

                  pagination={false}

                  scroll={{ x: 'max-content' }}

                  dataSource={detail.items}

                  columns={[

                    { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },

                    { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', ellipsis: true },

                    { title: t('app.kuaizhizao.salesContract.contractQuantity'), dataIndex: 'contract_quantity', width: 100, align: 'right' as const },

                    { title: t('app.kuaizhizao.salesContract.released'), dataIndex: 'released_quantity', width: 100, align: 'right' as const },

                    {

                      title: t('app.kuaizhizao.salesContract.remaining'),

                      width: 100,
                      align: 'right' as const,

                      render: (_, r) => remainingItemQty(r),

                    },

                    { title: t('app.kuaizhizao.salesContract.unitPrice'), dataIndex: 'unit_price', width: 100, align: 'right' as const, render: (v) => `¥${Number(v).toFixed(2)}` },

                    { title: t('app.kuaizhizao.salesContract.amount'), dataIndex: 'total_amount', width: 120, align: 'right' as const, render: (v) => `¥${Number(v).toFixed(2)}` },

                  ]}

                />

              ) : null}

              {detail.milestones?.length ? (

                <div style={{ marginTop: detail.items?.length ? 16 : 0 }}>

                  <Typography.Title level={5} style={{ marginBottom: 8 }}>

                    {t('app.kuaizhizao.salesContract.paymentMilestones')}

                  </Typography.Title>

                  <Table

                    size="small"

                    rowKey="id"

                    pagination={false}

                    dataSource={detail.milestones}

                    columns={[

                      { title: t('app.kuaizhizao.salesContract.milestone'), dataIndex: 'milestone_name' },

                      { title: t('app.kuaizhizao.salesContract.plannedDate'), dataIndex: 'planned_date', render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '—') },

                      { title: t('app.kuaizhizao.salesContract.plannedAmount'), dataIndex: 'planned_amount', render: (v) => `¥${Number(v ?? 0).toFixed(2)}` },

                      { title: t('common.status'), dataIndex: 'status' },

                      { title: t('app.kuaizhizao.salesContract.receivableDoc'), dataIndex: 'receivable_code', render: (v) => v || '—' },

                      {

                        title: t('common.actions'),

                        width: 100,

                        render: (_, r) =>

                          r.id && r.status !== 'collected' && !r.receivable_id ? (

                            <Button type="link" size="small" onClick={() => handleGenerateReceivable(r.id!)}>

                              {t('app.kuaizhizao.salesContract.generateReceivable')}

                            </Button>

                          ) : null,

                      },

                    ]}

                  />

                </div>

              ) : null}

            </>

          ) : undefined

        }

        timeline={

          contractTracking.loading ? (

            <div style={{ textAlign: 'center', padding: 24 }}>

              <Spin />

            </div>

          ) : contractTracking.error ? (

            <Typography.Text type="danger">{contractTracking.error}</Typography.Text>

          ) : contractTracking.data ? (

            <DocumentTrackingTimelineBody data={contractTracking.data} />

          ) : (

            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.salesContract.noOperationRecords')} />

          )

        }

      
        traceDocument={
          detail?.id != null
            ? {
                documentType: 'sales_contract',
                documentId: detail.id,
                selfDocumentId: detail.id
              }
            : undefined
        }
      />


      <Drawer

        title={
          detail?.contract_code
            ? t('app.kuaizhizao.salesContract.changeTitleWithCode', { code: detail.contract_code })
            : t('app.kuaizhizao.salesContract.changeTitle')
        }

        open={changeDrawerOpen}

        onClose={() => setChangeDrawerOpen(false)}

        size={640}

        destroyOnHidden

      >

        <ProForm

          formRef={changeFormRef}

          layout="vertical"

          submitter={{

            searchConfig: { submitText: t('app.kuaizhizao.salesContract.createChange') },

            submitButtonProps: { loading: changeSubmitting },

          }}

          onFinish={handleCreateChange}

        >

          <ProFormSelect

            name="change_type"

            label={t('app.kuaizhizao.salesContract.changeType')}

            options={[

              { label: t('app.kuaizhizao.salesContract.changeTypeAmendment'), value: 'amendment' },

              { label: t('app.kuaizhizao.salesContract.changeTypeAmount'), value: 'amount_change' },

              { label: t('app.kuaizhizao.salesContract.changeTypeExtension'), value: 'extension' },

            ]}

            rules={[{ required: true }]}

          />

          <ProForm.Item name="delta_amount" label={t('app.kuaizhizao.salesContract.deltaAmount')} initialValue={0}>
            <InputNumber style={{ width: '100%' }} precision={2} />
          </ProForm.Item>

          <ProFormDatePicker name="new_valid_to" label={t('app.kuaizhizao.salesContract.newValidTo')} fieldProps={buildFutureDateShortcutFieldProps({ getForm: () => formRef.current, fieldName: 'new_valid_to', baseFieldName: 'contract_date', t })} />

          <ProFormTextArea name="reason" label={t('app.kuaizhizao.salesContract.changeReason')} fieldProps={{ rows: 3 }} />

        </ProForm>

        <Typography.Title level={5} style={{ marginTop: 24 }}>{t('app.kuaizhizao.salesContract.changeRecords')}</Typography.Title>

        <Table

          size="small"

          rowKey="id"

          loading={changesLoading}

          pagination={false}

          dataSource={changes}

          columns={[

            { title: t('app.kuaizhizao.salesContract.changeCode'), dataIndex: 'change_code', width: 140 },

            { title: t('app.kuaizhizao.salesContract.changeTypeCol'), dataIndex: 'change_type', width: 100, render: (v) => changeTypeLabels[v as keyof typeof changeTypeLabels] ?? v },

            { title: t('app.kuaizhizao.salesContract.deltaAmount'), dataIndex: 'delta_amount', render: (v) => `¥${Number(v ?? 0).toFixed(2)}` },

            { title: t('common.status'), dataIndex: 'status', width: 90, render: (v) => renderContractStatus(v) },

            {

              title: t('common.actions'),

              width: 160,

              render: (_, r) => (

                <Space size={0}>

                  {r.status === '草稿' ? (

                    <Button type="link" size="small" onClick={() => handleChangeAction(r.id, 'submit')}>{t('common.submit')}</Button>

                  ) : null}

                  {r.status === '待审核' ? (

                    <>

                      <Button type="link" size="small" onClick={() => handleChangeAction(r.id, 'approve')}>{t('app.kuaizhizao.salesContract.approve')}</Button>

                      <Button type="link" size="small" danger onClick={() => handleChangeAction(r.id, 'reject')}>{t('app.kuaizhizao.salesContract.reject')}</Button>

                    </>

                  ) : null}

                </Space>

              ),

            },

          ]}

        />

      </Drawer>


      <Modal
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pushPreviewOpen}
        width={1100}
        onCancel={resetPushPreviewModal}
        okText={t('app.kuaizhizao.salesOrder.confirmPush')}
        cancelText={t('common.cancel')}
        confirmLoading={pushPreviewConfirming}
        onOk={handlePushPreviewConfirm}
        okButtonProps={{
          disabled:
            pushPreviewLoading ||
            !pushPreviewData ||
            (!!pushPreviewData?.has_blocking_issues && !!pushPreviewData?.blocking_reason),
        }}
        destroyOnHidden
      >
        {pushPreviewLoading ? (
          <div
            style={{
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>
              {t('app.kuaizhizao.salesOrder.loadingPreview')}
            </div>
          </div>
        ) : pushPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushPreviewData.summary}</p>
            {pushPreviewData.has_blocking_issues && pushPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  salesContractCapabilityReasonMessage(pushPreviewData.blocking_reason, t) ||
                  t('app.kuaizhizao.salesContract.pushOrderStatusRequired')
                }
              />
            ) : null}
            {pushPreviewTarget === 'work_order' ? (
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary" style={{ marginRight: 12 }}>
                  {t('app.kuaizhizao.salesOrder.pushModeLabel')}
                </Typography.Text>
                <Radio.Group
                  value={workOrderPushMode}
                  onChange={(e) => setWorkOrderPushMode(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  size="small"
                  options={[
                    { label: t('app.kuaizhizao.salesOrder.pushModeDraft'), value: 'draft' },
                    { label: t('app.kuaizhizao.salesOrder.pushModeConfirm'), value: 'confirm' },
                  ]}
                />
              </div>
            ) : null}
            {pushPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 1040 }}
                columns={[
                  {
                    title: t('common.select'),
                    width: 64,
                    render: (_: unknown, row) => {
                      const itemId = Number(row.item_id);
                      const maxQty = Number(row.max_push_quantity ?? 0);
                      const disabled =
                        !Number.isFinite(maxQty) ||
                        maxQty <= 0 ||
                        (!!pushPreviewData.has_blocking_issues && !!pushPreviewData.blocking_reason);
                      return (
                        <Switch
                          size="small"
                          disabled={disabled}
                          checked={pushSelectedItemIds.includes(itemId)}
                          onChange={(checked) => {
                            setPushSelectedItemIds((prev) =>
                              checked
                                ? Array.from(new Set([...prev, itemId]))
                                : prev.filter((id) => id !== itemId),
                            );
                          }}
                        />
                      );
                    },
                  },
                  {
                    title: t('app.kuaizhizao.salesOrder.materialCode'),
                    dataIndex: 'material_code',
                    width: 120,
                    ellipsis: true,
                  },
                  {
                    title: t('app.kuaizhizao.salesOrder.materialName'),
                    dataIndex: 'material_name',
                    width: 140,
                    ellipsis: true,
                  },
                  {
                    title: t('app.kuaizhizao.salesContract.contractQuantity'),
                    dataIndex: 'quantity',
                    width: 88,
                    align: 'right',
                    render: formatQuantity,
                  },
                  {
                    title: t('app.kuaizhizao.salesOrder.colPushedQty'),
                    dataIndex: 'pushed_quantity',
                    width: 88,
                    align: 'right',
                    render: formatQuantity,
                  },
                  {
                    title: t('app.kuaizhizao.salesOrder.colPushableQty'),
                    dataIndex: 'max_push_quantity',
                    width: 88,
                    align: 'right',
                    render: formatQuantity,
                  },
                  {
                    title: t('app.kuaizhizao.salesContract.thisRelease'),
                    width: 120,
                    render: (_: unknown, row) => {
                      const itemId = Number(row.item_id);
                      const maxQty = Number(row.max_push_quantity ?? 0);
                      const selected = pushSelectedItemIds.includes(itemId);
                      return (
                        <InputNumber
                          min={0.0001}
                          max={maxQty > 0 ? maxQty : undefined}
                          value={pushQuantities[itemId]}
                          disabled={!selected || maxQty <= 0}
                          size="small"
                          style={{ width: '100%' }}
                          onChange={(v) => {
                            setPushQuantities((prev) => ({
                              ...prev,
                              [itemId]: Number(v) || 0,
                            }));
                          }}
                        />
                      );
                    },
                  },
                  {
                    title: t('common.unit'),
                    dataIndex: 'material_unit',
                    width: 60,
                  },
                  ...(pushPreviewTarget === 'work_order'
                    ? [
                        {
                          title: t('app.kuaizhizao.salesContract.pushPreviewBlocking'),
                          width: 200,
                          ellipsis: true,
                          render: (_: unknown, row: SalesContractPushPreviewResponse['items'][number]) =>
                            row.blocking_issues?.length ? row.blocking_issues.join('；') : '-',
                        },
                      ]
                    : []),
                ]}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('app.kuaizhizao.salesContract.pushPreviewNoLines')}
              />
            )}
            {pushPreviewData.tip ? (
              <p
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  color: 'var(--ant-color-text-secondary)',
                  fontSize: 12,
                }}
              >
                {pushPreviewData.tip}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>


      <Modal

        title={t('app.kuaizhizao.salesContract.closeContract')}

        open={closeModalOpen}

        okText={t('app.kuaizhizao.salesContract.confirmClose')}

        onOk={handleCloseContract}

        onCancel={() => {

          setCloseModalOpen(false);

          setCloseReason('');

        }}

        destroyOnHidden

      >

        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>

          {t('app.kuaizhizao.salesContract.contractLabel', { code: detail?.contract_code ?? detail?.id ?? '-' })}

        </Typography.Paragraph>

        <Input.TextArea

          rows={3}

          value={closeReason}

          onChange={(e) => setCloseReason(e.target.value)}

          placeholder={t('app.kuaizhizao.salesContract.closeReasonPlaceholder')}

          maxLength={500}

          showCount

        />

      </Modal>


      <UniPullQueryModal<PullQuotationCandidate>
        title={pullFromQuotationAction.label}
        open={pullFromQuotationQuery.open}
        onCancel={pullFromQuotationQuery.closeModal}
        onOk={pullFromQuotationQuery.handleConfirm}
        okText={t('app.kuaizhizao.salesContract.create')}
        rowKey="id"
        columns={pullQuotationColumns}
        dataSource={pullFromQuotationQuery.dataSource}
        loading={pullFromQuotationQuery.loading}
        confirmLoading={pullFromQuotationQuery.confirmLoading}
        selectionType={pullFromQuotationQuery.selectionType}
        selectedRowKeys={pullFromQuotationQuery.selectedRowKeys}
        selectedRows={pullFromQuotationQuery.selectedRows}
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
      />

      {PrintModal}


      <UniMaterialBatchPicker

        open={materialPickerOpen}

        onCancel={() => setMaterialPickerOpen(false)}

        onConfirm={(selected) => {

          appendContractItemsFromMaterials(selected);

          setMaterialPickerOpen(false);

        }}

      />

      <SalesContractTermsManageModal
        open={termsManageOpen}
        onClose={() => {
          setTermsManageOpen(false);
          loadTermGroupOptions();
        }}
      />

    </ListPageTemplate>

  );

};


export default SalesContractsPage;


