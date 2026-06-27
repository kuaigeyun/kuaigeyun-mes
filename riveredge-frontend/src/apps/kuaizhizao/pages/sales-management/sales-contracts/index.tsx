/**

 * 销售合同管理

 */



import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';

import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { toApiDateString } from '../../../../../utils/formDate';
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

  Button,

  Checkbox,

  Col,

  Descriptions,

  Drawer,

  Empty,

  Form as AntForm,

  Input,

  InputNumber,

  Modal,
  Card,

  Row,

  Space,

  Spin,

  Table,

  Tag,

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

  StopOutlined,

  SendOutlined,

  ArrowLeftOutlined,

  ImportOutlined,

  FileTextOutlined,

  PrinterOutlined,

  RollbackOutlined,

} from '@ant-design/icons';

import dayjs from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';

import {

  DetailDrawerTemplate,

  DetailDrawerInlineFullChain,

  DRAWER_CONFIG,

  ListPageTemplate,

  MODAL_CONFIG,

  DocumentFormPageLayout,
  DocumentFormPageHeaderActions,

  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,

  PAGE_SPACING,

} from '../../../../../components/layout-templates';

import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniAuditBatchMenuButton, UniCapabilityBatchButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';

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
import {
  salesContractCapabilityReasonMessage,
  salesContractHasToolbarPushActions,
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

import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../shared/listAuditPhaseColumn';

import salesContractApi, {

  type SalesContract,

  type SalesContractChange,

  type SalesContractPaymentSummary,

} from '../../../services/sales-contract';
import { listQuotations, type Quotation, type QuotationCapabilities } from '../../../services/quotation';

import { SalesContractItemsFormTable } from './SalesContractItemsFormTable';
import {
  alignDescriptionColumns,
  alignProColumns,
  getSalesCommonFormLabels,
  SALES_DOC_DETAIL_BASIC_FIELD_RANK,
  SALES_DOC_LIST_FIELD_RANK,
} from '../shared/documentFieldAlignment';
import { buildDescriptionItemsFromColumns } from '../shared/descriptionItems';
import { applyCustomerFormFields } from '../shared/applyCustomerFormFields';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { testGenerateCode, getCodeRulePageConfig, generateCode } from '../../../../../services/codeRule';
import SalesContractTermsManageModal from './SalesContractTermsManageModal';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import {
  buildTermTemplatesFromGroupItems,
  extractPlaceholdersFromTerms,
  resolveTermsWithPlaceholders,
} from './contract-term-placeholders';
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

import {

  calcContractLineAmounts,

  convertUnitPriceByPriceType,

  defaultContractItem,

  resolveContractLineMaterialFields,

} from './contract-line-items-shared';

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

const STATUS_COLOR: Record<string, string> = {

  草稿: 'default',

  待审核: 'processing',

  已生效: 'success',

  执行中: 'blue',

  已关闭: 'default',

  已到期: 'warning',

};



type ReleaseRow = {

  item_id: number;

  selected: boolean;

  release_quantity: number;

  remaining_quantity: number;

  material_code: string;

  material_name: string;

  contract_quantity: number;

  released_quantity: number;

  material_unit: string;

};



const SALES_CONTRACT_LIST_PATH = '/apps/kuaizhizao/sales-management/sales-contracts';
const SALES_CONTRACT_CREATE_PATH = `${SALES_CONTRACT_LIST_PATH}/new`;
const salesContractEditPath = (id: number) => `${SALES_CONTRACT_LIST_PATH}/${id}/edit`;

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

  const { t } = useTranslation();
  const pullFromQuotationAction = resolveKuaizhizaoDocumentAction(t, 'sales_contract.pull_from_quotation');
  const pushToSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'sales_order.pull_from_sales_contract');
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
  const contractImportHeaders = useMemo(
    () => [
      t('app.kuaizhizao.salesContract.importHeaders.materialCode'),
      t('app.kuaizhizao.salesContract.importHeaders.spec'),
      t('app.kuaizhizao.salesContract.importHeaders.unit'),
      t('app.kuaizhizao.salesContract.importHeaders.quantity'),
      t('app.kuaizhizao.salesContract.importHeaders.unitPrice'),
      t('app.kuaizhizao.salesContract.importHeaders.deliveryDate'),
      t('app.kuaizhizao.salesContract.importHeaders.notes'),
    ],
    [t],
  );
  const contractImportExampleRow = useMemo(
    () => [
      'MAT001',
      'Spec X',
      t('app.kuaizhizao.salesContract.defaultUnit'),
      '100',
      '1.5',
      '2026-03-01',
      '',
    ],
    [t],
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

  const [materialList, setMaterialList] = useState<Material[]>([]);

  const [contractEditingIncl, setContractEditingIncl] = useState<{ index: number; value: number | null } | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);

  const [detail, setDetail] = useState<SalesContract | null>(null);
  const permDeniedTitle = t('common.noPermission');
  const detailCapabilityGates = useSalesContractCapabilities(detail, contractPerms, t, permDeniedTitle);

  const [detailLoading, setDetailLoading] = useState(false);

  const [paymentSummary, setPaymentSummary] = useState<SalesContractPaymentSummary | null>(null);

  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);



  const [releaseModalOpen, setReleaseModalOpen] = useState(false);

  const [releaseTarget, setReleaseTarget] = useState<SalesContract | null>(null);

  const [releaseRows, setReleaseRows] = useState<ReleaseRow[]>([]);

  const [releaseSubmitting, setReleaseSubmitting] = useState(false);



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
  const leaveSalesContractFormPage = useCallback(() => {
    navigate(SALES_CONTRACT_LIST_PATH);
  }, [navigate]);

  const termPlaceholderKeys = useMemo(
    () => extractPlaceholdersFromTerms(termTemplateTerms),
    [termTemplateTerms],
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
      const resolved = resolveTermsWithPlaceholders(templates, placeholderValues);
      setTermsPreview(resolved);
    },
    [],
  );

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
      navigate(SALES_CONTRACT_LIST_PATH);
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
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
          pullable_only: scope === 'pullable',
          pull_target: 'sales_contract',
        });
        const rows: Quotation[] = Array.isArray(result) ? result : result.data || [];
        return {
          data: mapPullQuotationRows(rows),
          total: Array.isArray(result) ? rows.length : Number(result.total ?? rows.length),
        };
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
        actionRef.current?.reload();
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
              code: record.contract_code || record.contract_id || '-',
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
        navigate(SALES_CONTRACT_LIST_PATH);
      } else {
        setEditingId(null);
        actionRef.current?.reload();
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

    Modal.confirm({

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

          actionRef.current?.reload();

        } catch (e: any) {

          messageApi.error(e?.message || t('common.deleteFailed'));

        }

      },

    });

  };



  const contractCodeAutoEnabled = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-sales-contract');

  const renderCreateForm = () => (

    <>

      <Row gutter={16}>

        <Col span={12}>

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

        <Col span={12}>

          <ProForm.Item name="customer_id" label={t('app.kuaizhizao.salesContract.customer')} rules={[{ required: true, message: t('app.kuaizhizao.salesContract.selectCustomerRequired') }]}>

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

      </Row>

      <ProFormText name="customer_name" hidden />
      <ProFormText name="price_type" hidden initialValue={DEFAULT_SALES_PRICE_TYPE} />

      <Row gutter={16}>

        <Col span={5}>

          <ProFormText name="salesman_name" label={salesCommonLabels.salesman} placeholder={t('app.kuaizhizao.salesContract.salesmanPlaceholder')} fieldProps={{ style: { width: '100%' } }} />

        </Col>

        <Col span={5}>

          <ProFormDatePicker

            name="contract_date"

            label={t('app.kuaizhizao.salesContract.contractDate')}

            rules={[{ required: true, message: t('app.kuaizhizao.salesContract.contractDateRequired') }]}

            fieldProps={{ style: { width: '100%' } }}

          />

        </Col>

        <Col span={5}>

          <ProFormDatePicker name="valid_from" label={t('app.kuaizhizao.salesContract.validFrom')} fieldProps={{ style: { width: '100%' } }} />

        </Col>

        <Col span={5}>

          <ProFormDatePicker name="valid_to" label={t('app.kuaizhizao.salesContract.validTo')} fieldProps={buildFutureDateShortcutFieldProps({ getForm: () => formRef.current, fieldName: 'valid_to', baseFieldName: 'contract_date', t })} />

        </Col>

        <Col span={4}>

          <DictionarySelect

            dictionaryCode="SHIPPING_METHOD"

            name="shipping_method"

            label={t('app.kuaizhizao.salesOrder.shippingMethod')}

            placeholder={t('app.kuaizhizao.salesContract.selectShippingMethod')}

            formRef={formRef}

            valueEqualsLabel={false}

          />

        </Col>

      </Row>

      <Row gutter={16}>

        <Col span={4}>

          <ProFormText name="customer_contact" label={salesCommonLabels.contact} />

        </Col>

        <Col span={4}>

          <ProFormText name="customer_phone" label={salesCommonLabels.phone} />

        </Col>

        <Col span={8}>

          <ProFormText name="shipping_address" label={t('app.kuaizhizao.salesOrder.shippingAddress')} placeholder={t('app.kuaizhizao.salesContract.shippingAddressPlaceholder')} />

        </Col>

        <Col span={4}>

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

      <div style={{ marginTop: 16 }}>

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

                    <Table size="small" bordered pagination={false} rowKey="key" dataSource={fields} columns={msCols as any} scroll={{ x: 'max-content' }} />

                  ) : null}

                  <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 8 }} onClick={() => add({ ...defaultMilestone })}>

                    {t('app.kuaizhizao.salesContract.addPaymentNode')}

                  </Button>

                </>

              );

            }}

          </AntForm.List>

        </ProForm.Item>

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

                  {term.content}

                </Typography.Paragraph>

              </div>

            ))}

          </Card>

        )}

        <DocumentAttachmentsField category="sales_contract_attachments" />

        <ProFormTextArea name="notes" label={t('app.kuaizhizao.salesOrder.notes')} fieldProps={{ rows: 2 }} />

      </div>

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



  const reload = () => actionRef.current?.reload();



  const refreshDetail = async (id: number) => {

    const data = await salesContractApi.get(id);

    setDetail(data);

    void loadPaymentSummary(id);

    setTrackingRefreshKey((k) => k + 1);

    reload();

  };



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
    actionRef.current?.reload();
  }, []);

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
    actionRef.current?.reload();
  }, [contractPerms.canDelete, messageApi, t]);

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



  const openReleaseModal = async (record: SalesContract) => {

    try {

      const full = await salesContractApi.get(record.id!);

      const rows: ReleaseRow[] = (full.items ?? [])

        .filter((it) => it.id != null && remainingItemQty(it) > 0)

        .map((it) => {

          const remaining = remainingItemQty(it);

          return {

            item_id: it.id!,

            selected: true,

            release_quantity: remaining,

            remaining_quantity: remaining,

            material_code: it.material_code,

            material_name: it.material_name,

            contract_quantity: Number(it.contract_quantity ?? 0),

            released_quantity: Number(it.released_quantity ?? 0),

            material_unit: it.material_unit,

          };

        });

      if (!rows.length) {

        messageApi.warning(t('app.kuaizhizao.salesContract.noReleasableLines'));

        return;

      }

      setReleaseTarget(full);

      setReleaseRows(rows);

      setReleaseModalOpen(true);

    } catch (e: any) {

      messageApi.error(e?.message || t('app.kuaizhizao.salesContract.loadItemsFailed'));

    }

  };



  const handleReleaseSubmit = async () => {

    if (!releaseTarget?.id) return;

    const lines = releaseRows

      .filter((r) => r.selected && r.release_quantity > 0)

      .map((r) => ({ item_id: r.item_id, release_quantity: r.release_quantity }));

    if (!lines.length) {

      messageApi.error(t('app.kuaizhizao.salesContract.selectReleaseLine'));

      return;

    }

    setReleaseSubmitting(true);

    try {

      const res = await salesContractApi.convertToOrder(releaseTarget.id, { release_lines: lines });

      const orderId = (res.sales_order as any)?.id;

      const orderCode = (res.sales_order as any)?.order_code || '';

      messageApi.success(t('app.kuaizhizao.salesContract.orderGenerated', { code: orderCode }));

      setReleaseModalOpen(false);

      setReleaseTarget(null);

      setReleaseRows([]);

      if (detail?.id === releaseTarget.id) await refreshDetail(releaseTarget.id);

      else reload();

      navigate('/apps/kuaizhizao/sales-management/sales-orders', {

        state: orderId ? { openSalesOrderId: orderId } : undefined,

      });

    } catch (e: any) {

      messageApi.error(e?.message || t('app.kuaizhizao.salesContract.pushOrderFailed'));

    } finally {

      setReleaseSubmitting(false);

    }

  };

  const selectedContractForPush = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const selectedId = Number(selectedRowKeys[0]);
    if (!Number.isFinite(selectedId) || selectedId <= 0) return null;
    return tableRowsRef.current.find((row) => Number(row.id) === selectedId) ?? null;
  }, [selectedRowKeys]);

  const canUseToolbarPush =
    !!selectedContractForPush && salesContractHasToolbarPushActions(selectedContractForPush);

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
    await openReleaseModal(record);
  }, [messageApi, openReleaseModal, selectedContractForPush]);

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
        disabled={selectedRowKeys.length !== 1 || !canUseToolbarPush}
        menuItems={buildUniPushMenuItems([
          {
            key: 'push-to-sales-order',
            label: pushToSalesOrderAction.label,
            onClick: () => void handleToolbarPushToOrder(),
          },
        ])}
      />,
    ],
    [
      canUseToolbarPush,
      handleCreate,
      handlePullFromQuotation,
      handleToolbarPushToOrder,
      selectedRowKeys,
      pushToSalesOrderAction.label,
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

      messageApi.error(e?.message || t('app.kuaizhizao.salesOrder.operationFailed'));

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

        valueType: 'select',

        valueEnum: {
          single: { text: contractTypeLabels.single },
          framework: { text: contractTypeLabels.framework },
        },

        render: (_, r) => contractTypeLabels[r.contract_type as keyof typeof contractTypeLabels] || r.contract_type,

      },

      {
        title: t('app.kuaizhizao.salesContract.customer'),
        dataIndex: 'customer_name',
        ellipsis: true,
        hideInTable: true,
        fieldProps: { placeholder: t('field.customer.name') },
      },

      {
        title: t('app.kuaizhizao.salesContract.contractDate'),
        dataIndex: 'contract_date',
        width: 120,
        uniTableKeepWidth: true,
        valueType: 'date',
      },

      {
        title: t('app.kuaizhizao.salesContract.validUntil'),
        dataIndex: 'valid_to',
        width: 120,
        uniTableKeepWidth: true,
        valueType: 'date',
      },

      {
        title: t('app.kuaizhizao.salesContract.contractAmount'),
        dataIndex: 'total_amount',
        width: 120,
        uniTableKeepWidth: true,
        align: 'right',
        valueType: 'money',
      },

      {

        title: t('app.kuaizhizao.salesContract.released'),

        dataIndex: 'released_amount',

        width: 120,

        uniTableKeepWidth: true,

        align: 'right',

        render: (_, r) => `¥${Number(r.released_amount ?? 0).toLocaleString()}`,

      },

      ...(contractAuditColumn ? [contractAuditColumn] : []),

      {

        title: t('app.kuaizhizao.salesOrder.lifecycle'),

        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,

        fixed: 'right',

        align: 'left',

        valueType: 'select',

        valueEnum: contractLifecycleValueEnum,

        render: (_, r) => renderLifecycleCell(r),

      },

      {

        title: t('common.actions'),

        valueType: 'option',

        minWidth: 120,

        fixed: 'right',

        hideInSearch: true,

        render: (_, record) => {
          const canEdit = record.capabilities?.update?.allowed === true && contractPerms.canUpdate;
          const canDelete = record.capabilities?.delete?.allowed === true && contractPerms.canDelete;
          const parts: React.ReactNode[] = [
            <Button {...rowActionKind('read')} key="view" onClick={() => openDetail(record.id!)}>
              {t('app.kuaizhizao.salesOrder.viewDetail')}
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
      statusLabels,
      renderContractStatus,
      contractPerms.canDelete,
      contractPerms.canPrint,
      contractPerms.canUpdate,
    ],

  );
  const alignedListColumns = useMemo(
    () => alignProColumns(columns, SALES_DOC_LIST_FIELD_RANK),
    [columns],
  );



  const detailBasicColumns: ProDescriptionsItemProps<SalesContract>[] = useMemo(
    () => [
    { title: t('app.kuaizhizao.salesContract.contractCode'), dataIndex: 'contract_code' },

    {

      title: t('app.kuaizhizao.salesContract.contractType'),

      dataIndex: 'contract_type',

      render: (_, r) => contractTypeLabels[r.contract_type as keyof typeof contractTypeLabels] || r.contract_type,

    },

    {

      title: t('app.kuaizhizao.salesOrder.status'),

      dataIndex: 'status',

      render: (_, r) => (

        <Tag color={STATUS_COLOR[r.status || ''] || 'default'}>{renderContractStatus(r.status)}</Tag>

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

    {

      title: t('app.kuaizhizao.salesContract.sourceQuotation'),

      dataIndex: 'quotation_code',

      render: (_, r) =>

        r.quotation_code && r.quotation_id ? (

          <Button

            type="link"

            size="small"

            style={{ padding: 0, height: 'auto' }}

            onClick={() =>

              navigate('/apps/kuaizhizao/sales-management/quotations', {

                state: { openQuotationId: r.quotation_id },

              })

            }

          >

            {r.quotation_code}

          </Button>

        ) : (

          r.quotation_code || '—'

        ),

    },

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

    { title: t('app.kuaizhizao.salesOrder.notes'), dataIndex: 'notes', span: 3 },

  ],
    [t, contractTypeLabels, salesCommonLabels, renderContractStatus, navigate],
  );
  const alignedDetailBasicColumns = useMemo(
    () => alignDescriptionColumns(detailBasicColumns, SALES_DOC_DETAIL_BASIC_FIELD_RANK),
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
          <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
            <div className="form-modal-content-inner">
              <ProForm
                formRef={formRef}
                layout="vertical"
                submitter={false}
                scrollToFirstError
                onFinish={(values) => handleFormSubmit(values, { asDraft: false })}
                onFinishFailed={({ errorFields }) => {
                  const first = errorFields?.[0];
                  const text = first?.errors?.filter(Boolean)[0];
                  messageApi.error(text || t('components.layoutTemplates.formModal.checkFormHint'));
                }}
                initialValues={isCreatePage ? { items: [{ ...defaultContractItem }], discount_amount: 0, price_type: DEFAULT_SALES_PRICE_TYPE } : undefined}
              >
                {renderCreateForm()}
              </ProForm>
            </div>
          </Card>
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
          />
        </Suspense>
      </>
    );
  }

  return (

    <ListPageTemplate>

      <UniTable<SalesContract>

        actionRef={actionRef}

        rowKey="id"

        permissionResource={SALES_CONTRACT_RESOURCE}

        columnPersistenceId="apps.kuaizhizao.pages.sales-management.sales-contracts"

        columns={alignedListColumns}

        showAdvancedSearch

        selectedRowKeys={selectedRowKeys}

        onRowSelectionChange={setSelectedRowKeys}

        enableRowSelection

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

        onExport={async (type, keys, pageData) => {
          try {
            const res = await salesContractApi.list({ skip: 0, limit: 10000 });
            let items = res.items || [];
            if (type === 'currentPage' && pageData?.length) {
              items = pageData as SalesContract[];
            } else if (type === 'selected' && keys?.length) {
              items = items.filter((d) => d.id != null && keys.includes(d.id));
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaizhizao.salesContract.noExportData'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales-contracts-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('app.kuaizhizao.salesContract.exportSuccess', { count: items.length }));
          } catch (error: any) {
            messageApi.error(error?.message || t('app.kuaizhizao.salesContract.exportFailed'));
          }
        }}

        request={async (params, _sort, _filter, searchFormValues) => {

          const lifecycleParams = resolveSalesContractListLifecycleParams(searchFormValues, params);

          const res = await salesContractApi.list({

            skip: ((params.current || 1) - 1) * (params.pageSize || 20),

            limit: params.pageSize || 20,

            keyword: searchFormValues?.keyword,

            status: lifecycleParams.status ?? searchFormValues?.status,

            contract_type: searchFormValues?.contract_type,

          });

          return { data: res.items || [], success: true, total: res.total || 0 };

        }}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}

        scroll={{ x: 'max-content' }}

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

            <Space wrap>

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
                onSuccess={() => {
                  reload();
                  if (detail.id != null) void refreshDetail(detail.id);
                }}
              />

              {!detailCapabilityGates.pushToSalesOrder.disabled && (
                <Button type="primary" icon={<ShoppingOutlined />} onClick={() => openReleaseModal(detail)}>
                  {pushToSalesOrderAction.label}
                </Button>
              )}

              {!detailCapabilityGates.createChange.disabled && (
                <Button icon={<FormOutlined />} onClick={openChangeDrawer}>{t('app.kuaizhizao.salesContract.contractChange')}</Button>
              )}

              {!detailCapabilityGates.close.disabled && (
                <Button icon={<StopOutlined />} onClick={() => setCloseModalOpen(true)}>{t('app.kuaizhizao.salesContract.closeContract')}</Button>
              )}
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

              items={buildDescriptionItemsFromColumns(detail, alignedDetailBasicColumns, { column: 3 })}

            />

          ) : undefined

        }

        collaborationMetrics={

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

        collaborationLifecycle={

          detail ? (

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {detailLifecycle?.mainStages?.length ? (

                <UniLifecycleStepper
                  steps={detailLifecycle.mainStages}
                  status={detailLifecycle.status}
                  showLabels
                  nextStepSuggestions={detailLifecycle.nextStepSuggestions}
                  hideNextStepSuggestions
                />

              ) : null}

              {detail.id != null ? (

                <DetailDrawerInlineFullChain

                  documentType="sales_contract"

                  documentId={detail.id}

                  active={detailOpen}

                  selfDocumentId={detail.id}

                />

              ) : null}

            </div>

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

                      { title: t('app.kuaizhizao.salesOrder.status'), dataIndex: 'status' },

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

            { title: t('app.kuaizhizao.salesOrder.status'), dataIndex: 'status', width: 90, render: (v) => renderContractStatus(v) },

            {

              title: t('common.actions'),

              width: 160,

              render: (_, r) => (

                <Space size={0}>

                  {r.status === '草稿' ? (

                    <Button type="link" size="small" onClick={() => handleChangeAction(r.id, 'submit')}>{t('app.kuaizhizao.salesOrder.submitOrder')}</Button>

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

        title={pushToSalesOrderAction.label}

        open={releaseModalOpen}

        width={MODAL_CONFIG.LARGE_WIDTH}

        okText={t('app.kuaizhizao.salesContract.confirmRelease')}

        confirmLoading={releaseSubmitting}

        onOk={handleReleaseSubmit}

        onCancel={() => {

          setReleaseModalOpen(false);

          setReleaseTarget(null);

          setReleaseRows([]);

        }}

        destroyOnHidden

      >

        <Typography.Paragraph type="secondary">

          {t('app.kuaizhizao.salesContract.releaseHint', { code: releaseTarget?.contract_code })}

        </Typography.Paragraph>

        <Table

          size="small"

          rowKey="item_id"

          pagination={false}

          dataSource={releaseRows}

          columns={[

            {

              title: t('app.kuaizhizao.salesContract.select'),

              width: 60,

              render: (_, r, index) => (

                <Checkbox

                  checked={r.selected}

                  onChange={(e) => {

                    const next = [...releaseRows];

                    next[index] = { ...next[index], selected: e.target.checked };

                    setReleaseRows(next);

                  }}

                />

              ),

            },

            { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },

            { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', ellipsis: true },

            { title: t('app.kuaizhizao.salesContract.contractQuantity'), dataIndex: 'contract_quantity', width: 90, align: 'right' as const },

            { title: t('app.kuaizhizao.salesContract.released'), dataIndex: 'released_quantity', width: 80, align: 'right' as const },

            { title: t('app.kuaizhizao.salesContract.remaining'), dataIndex: 'remaining_quantity', width: 80, align: 'right' as const },

            {

              title: t('app.kuaizhizao.salesContract.thisRelease'),

              width: 120,

              render: (_, r, index) => (

                <InputNumber

                  min={0.0001}

                  max={r.remaining_quantity}

                  value={r.release_quantity}

                  disabled={!r.selected}

                  size="small"

                  style={{ width: '100%' }}

                  onChange={(v) => {

                    const next = [...releaseRows];

                    next[index] = { ...next[index], release_quantity: Number(v) || 0 };

                    setReleaseRows(next);

                  }}

                />

              ),

            },

            { title: t('app.kuaizhizao.salesOrder.unit'), dataIndex: 'material_unit', width: 60 },

          ]}

        />

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


