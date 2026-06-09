/**

 * 销售合同管理

 */



import React, { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';

import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../utils/globalSubmitShortcut';

import type { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';

import {

  ProForm,

  ProFormDatePicker,

  ProFormDigit,

  ProFormSelect,

  ProFormText,

  ProFormTextArea,

} from '@ant-design/pro-components';

import type { DescriptionsProps } from 'antd';

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

  SendOutlined,

  ShoppingOutlined,

  StopOutlined,

  ArrowLeftOutlined,

  ImportOutlined,

  FileTextOutlined,

  PrinterOutlined,

  RollbackOutlined,

} from '@ant-design/icons';

import dayjs from 'dayjs';

import {

  DetailDrawerTemplate,

  DetailDrawerInlineFullChain,

  DRAWER_CONFIG,

  ListPageTemplate,

  MODAL_CONFIG,

  DocumentFormPageLayout,

  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,

  PAGE_SPACING,

} from '../../../../../components/layout-templates';

import { UniTable } from '../../../../../components/uni-table';

import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';

import { resolveOrderLineSalePrice } from '../../../../master-data/utils/resolve-partner-material-price';

import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';

import { DictionarySelect } from '../../../../../components/dictionary-select';

import { DictionaryLabel } from '../../../../../components/dictionary-label';

import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_SALES_CONTRACT_FIELD_RESOURCE as SC } from '../../../constants/fieldPermissionResources';
import { useGlobalStore } from '../../../../../stores';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { hasModulePermission, hasReviewPermission } from '../../../../../utils/permissionContract';
import { getPrintTemplateList, type PrintTemplate } from '../../../../../services/printTemplate';
import type { DocumentPrintApiResult } from '../../../../../utils/printResponseHelpers';
import { UniPdfPreview } from '../../../../../components/uni-preview';

import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';

import {

  DocumentTrackingTimelineBody,

  useDocumentTracking,

} from '../../../../../components/document-tracking-panel';

import type { Material } from '../../../../master-data/types/material';

import { customerApi } from '../../../../master-data/services/supply-chain';

import { materialApi } from '../../../../master-data/services/material';

import { parseBackendLifecycle } from '../../../utils/backendLifecycle';

import salesContractApi, {

  type SalesContract,

  type SalesContractChange,

  type SalesContractPaymentSummary,

} from '../../../services/sales-contract';

import { SalesContractItemsFormTable } from './SalesContractItemsFormTable';
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

const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);

import {

  calcContractLineAmounts,

  convertUnitPriceByPriceType,

  defaultContractItem,

} from './contract-line-items-shared';

const SALES_CONTRACT_RESOURCE = SC;

const PENDING_REVIEW_STATUSES = new Set(['待审核', 'PENDING', 'PENDING_REVIEW']);

function isApprovedReview(rs: string | undefined): boolean {
  const r = (rs || '').trim();
  return ['已通过', 'APPROVED', '审核通过', '通过', '已审核'].includes(r);
}

function canWithdrawContract(c: SalesContract): boolean {
  return (c.status || '') === '待审核' && PENDING_REVIEW_STATUSES.has((c.review_status || '').trim());
}

function canApproveContract(c: SalesContract): boolean {
  if ((c.status || '') !== '待审核') return false;
  const rs = (c.review_status || '').trim();
  return PENDING_REVIEW_STATUSES.has(rs) || rs === '';
}

function canRejectContract(c: SalesContract): boolean {
  return canApproveContract(c);
}

function canRevokeContractApproval(c: SalesContract): boolean {
  if ((c.status || '') !== '已生效') return false;
  if (!isApprovedReview(c.review_status)) return false;
  const relQty = Number(c.released_quantity ?? 0);
  const relAmt = Number(c.released_amount ?? 0);
  return relQty <= 0 && relAmt <= 0;
}

function canPrintContract(c: SalesContract): boolean {
  const st = (c.status || '').trim();
  if (!['已生效', '执行中', '已关闭'].includes(st)) return false;
  return isApprovedReview(c.review_status);
}



function toApiDateString(v: unknown): string | undefined {

  if (v == null || v === '') return undefined;

  if (dayjs.isDayjs(v)) return v.format('YYYY-MM-DD');

  if (typeof v === 'string') return v.slice(0, 10);

  return undefined;

}



function buildDescriptionItemsFromColumns<T extends Record<string, any>>(

  dataSource: T,

  cols: ProDescriptionsItemProps<T>[],

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

      content = (col.render as (dom: React.ReactNode, entity: T, i: number) => React.ReactNode)(

        content,

        dataSource,

        index,

      );

    }

    return {

      key: String(col.key ?? col.dataIndex ?? index),

      label: col.title as React.ReactNode,

      children: content !== undefined && content !== null && content !== '' ? content : '—',

      span: col.span ?? 1,

    };

  });

}



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

const CONTRACT_TYPE_MAP: Record<string, string> = {

  single: '单次合同',

  framework: '框架合同',

};



const STATUS_COLOR: Record<string, string> = {

  草稿: 'default',

  待审核: 'processing',

  已生效: 'success',

  执行中: 'blue',

  已关闭: 'default',

  已到期: 'warning',

};



type ReviewAction = 'approve' | 'reject';

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

  const currentUser = useGlobalStore((s) => s.currentUser);
  const contractPerms = useResourcePermissions(SALES_CONTRACT_RESOURCE);
  const canSubmitContract = hasModulePermission(currentUser ?? undefined, SALES_CONTRACT_RESOURCE, 'submit');
  const canRevokeContract = hasModulePermission(currentUser ?? undefined, SALES_CONTRACT_RESOURCE, 'revoke');
  const canReviewContract = hasReviewPermission(currentUser ?? undefined, SALES_CONTRACT_RESOURCE);

  const actionRef = useRef<ActionType>();

  const formRef = useRef<ProFormInstance>();

  const changeFormRef = useRef<ProFormInstance>();

  const contractEditingInclValueRef = useRef<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const [customerList, setCustomerList] = useState<any[]>([]);

  const [materialList, setMaterialList] = useState<Material[]>([]);

  const [contractEditingIncl, setContractEditingIncl] = useState<{ index: number; value: number | null } | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);

  const [detail, setDetail] = useState<SalesContract | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);

  const [paymentSummary, setPaymentSummary] = useState<SalesContractPaymentSummary | null>(null);

  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);



  const [releaseModalOpen, setReleaseModalOpen] = useState(false);

  const [releaseTarget, setReleaseTarget] = useState<SalesContract | null>(null);

  const [releaseRows, setReleaseRows] = useState<ReleaseRow[]>([]);

  const [releaseSubmitting, setReleaseSubmitting] = useState(false);



  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const [reviewAction, setReviewAction] = useState<ReviewAction>('approve');

  const [reviewTarget, setReviewTarget] = useState<SalesContract | null>(null);

  const [reviewRemarks, setReviewRemarks] = useState('');



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
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printSubmitting, setPrintSubmitting] = useState(false);
  const [printTemplates, setPrintTemplates] = useState<PrintTemplate[]>([]);
  const [selectedPrintTemplateUuid, setSelectedPrintTemplateUuid] = useState<string | undefined>();
  const [printingRecord, setPrintingRecord] = useState<SalesContract | null>(null);
  const [pdfPreviewVisible, setPdfPreviewVisible] = useState(false);
  const [pdfPreviewBlobUrl, setPdfPreviewBlobUrl] = useState<string | null>(null);
  const [pdfPreviewFileName, setPdfPreviewFileName] = useState('销售合同.pdf');

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

      .catch((e) => console.error('加载物料失败', e));

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
        messageApi.error(e?.message || '加载条款组失败');
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



  const handleContractPriceTypeToggle = useCallback((checked: boolean) => {

    const nextType = checked ? 'tax_inclusive' : 'tax_exclusive';

    const currentType = formRef.current?.getFieldValue('price_type') ?? 'tax_exclusive';

    if (nextType === currentType) return;

    const items = formRef.current?.getFieldValue('items') ?? [];

    const next = items.map((row: any) => ({

      ...row,

      unit_price: convertUnitPriceByPriceType(row?.unit_price, row?.tax_rate, currentType, nextType),

    }));

    formRef.current?.setFieldsValue({ price_type: nextType, items: next });

  }, []);



  const refreshContractLinePriceByVariant = useCallback(

    async (index: number, attrs?: Record<string, unknown>) => {

      const customerId = formRef.current?.getFieldValue('customer_id');

      const materialId = formRef.current?.getFieldValue(['items', index, 'material_id']);

      const material = materialList.find((m) => m.id === Number(materialId));

      const contractDate = formRef.current?.getFieldValue('contract_date');

      const asOf =

        contractDate != null ? (dayjs.isDayjs(contractDate) ? contractDate : dayjs(contractDate)) : dayjs();

      const pt = formRef.current?.getFieldValue('price_type') ?? 'tax_exclusive';

      const { unitPrice, taxRate } = await resolveOrderLineSalePrice(

        customerId ? Number(customerId) : undefined,

        materialId ? Number(materialId) : undefined,

        attrs,

        material,

        asOf,

      );

      let up = unitPrice;

      if (pt === 'tax_inclusive' && up > 0) {

        up = convertUnitPriceByPriceType(up, taxRate, 'tax_exclusive', 'tax_inclusive');

      }

      const items = [...(formRef.current?.getFieldValue('items') ?? [])];

      if (items[index]) {

        items[index] = { ...items[index], unit_price: up, tax_rate: taxRate };

        formRef.current?.setFieldsValue({ items });

      }

    },

    [materialList],

  );



  const appendContractItemsFromMaterials = useCallback(

    (selected: Material[]) => {

      const current = formRef.current?.getFieldValue('items') ?? [];

      const newRows = selected.map((m) => ({

        material_id: m.id,

        material_code: m.mainCode ?? (m as any).code ?? '',

        material_name: m.name ?? '',

        material_spec: m.specification ?? '',

        material_unit: m.baseUnit ?? '件',

        contract_quantity: 1,

        unit_price: (m as any).defaults?.defaultSalePrice ?? (m as any).defaults?.default_sale_price ?? 0,

        tax_rate: (m as any).defaults?.defaultTaxRate ?? (m as any).defaults?.default_tax_rate ?? 0,

      }));

      if (current.length === 1 && !current[0].material_id && !current[0].material_code) {

        formRef.current?.setFieldsValue({ items: newRows });

      } else {

        formRef.current?.setFieldsValue({ items: [...current, ...newRows] });

      }

      messageApi.success(`已添加 ${selected.length} 个物料`);

    },

    [messageApi],

  );

  const handleItemImport = useCallback(
    (data: any[][]) => {
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
        messageApi.warning('未检测到有效数据（请确保物料编号不为空）');
        return;
      }

      const currentItems = formRef.current?.getFieldValue('items') || [];
      formRef.current?.setFieldsValue({ items: [...currentItems, ...newItems] });
      messageApi.success(`成功导入 ${newItems.length} 条明细`);
      setImportModalVisible(false);
    },
    [materialList, messageApi],
  );

  const buildFormPayload = (values: any) => {

    const validItems = (values.items ?? []).filter(

      (it: any) => it.material_id && Number(it.contract_quantity) > 0 && Number(it.unit_price) >= 0,

    );

    if (!validItems.length) {

      messageApi.error('请至少添加一条有效合同明细');

      throw new Error('请至少添加一条有效合同明细');

    }

    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);

    const customerName = cust?.name ?? cust?.customer_name ?? values.customer_name ?? '';

    return {

      contract_type: values.contract_type || 'single',

      customer_id: values.customer_id,

      customer_name: customerName,

      customer_contact: values.customer_contact,

      customer_phone: values.customer_phone,

      contract_date: toApiDateString(values.contract_date)!,

      valid_from: toApiDateString(values.valid_from),

      valid_to: toApiDateString(values.valid_to),

      price_type: values.price_type === 'tax_inclusive' ? 'tax_inclusive' : 'tax_exclusive',

      currency_code: values.currency_code || 'CNY',

      salesman_name: values.salesman_name,

      shipping_address: values.shipping_address,

      shipping_method: values.shipping_method,

      payment_terms: values.payment_terms,

      term_group_id: values.term_group_id || undefined,

      contract_terms: termsPreview.length ? termsPreview : undefined,

      notes: values.notes,

      attachments: normalizeDocumentAttachments(values.attachments),

      items: validItems.map((it: any) => ({

        material_id: it.material_id,

        material_code: it.material_code,

        material_name: it.material_name,

        material_spec: it.material_spec,

        material_unit: it.material_unit,

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

      })),

      milestones: (values.milestones ?? [])

        .filter((ms: any) => ms?.milestone_name && (ms.planned_date || ms.planned_amount || ms.planned_ratio))

        .map((ms: any) => ({

          milestone_name: ms.milestone_name,

          planned_date: toApiDateString(ms.planned_date)!,

          planned_amount: ms.planned_amount != null ? Number(ms.planned_amount) : undefined,

          planned_ratio: ms.planned_ratio != null ? Number(ms.planned_ratio) : undefined,

          billing_trigger: ms.billing_trigger || 'milestone',

          notes: ms.notes,

        })),

    };

  };



  async function initSalesContractCreateForm() {
    setEditingId(null);
    formRef.current?.resetFields();
    setTimeout(() => {
      formRef.current?.setFieldsValue({
        contract_type: 'single',
        contract_date: dayjs(),
        valid_from: dayjs(),
        price_type: 'tax_exclusive',
        currency_code: 'CNY',
        items: [{ ...defaultContractItem }],
        milestones: [],
        term_group_id: undefined,
      });
      setTermTemplateTerms([]);
      setTermPlaceholderValues({});
      setTermsPreview([]);
    }, 100);
  }

  async function initSalesContractEditForm(contractId: number) {
    try {
      const data = await salesContractApi.get(contractId);
      setEditingId(contractId);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          contract_type: data.contract_type || 'single',
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          customer_contact: data.customer_contact,
          customer_phone: data.customer_phone,
          contract_date: data.contract_date ? dayjs(data.contract_date) : undefined,
          valid_from: data.valid_from ? dayjs(data.valid_from) : undefined,
          valid_to: data.valid_to ? dayjs(data.valid_to) : undefined,
          price_type: data.price_type === 'tax_inclusive' ? 'tax_inclusive' : 'tax_exclusive',
          currency_code: data.currency_code || 'CNY',
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
      messageApi.error(e?.message || '加载合同失败');
      navigate(SALES_CONTRACT_LIST_PATH);
    }
  }

  const handleCreate = () => {
    navigate(SALES_CONTRACT_CREATE_PATH);
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
    const payload = buildFormPayload(values);

    if (editingId) {
      await salesContractApi.update(editingId, payload);
      if (!asDraft) {
        await salesContractApi.submit(editingId);
        messageApi.success(t('app.kuaizhizao.salesContract.saveAndSubmit', '已保存并提交'));
      } else {
        messageApi.success(t('app.kuaizhizao.salesContract.savedDraft', '草稿已保存'));
      }
    } else {
      await salesContractApi.create(payload, !asDraft);
      messageApi.success(
        asDraft
          ? t('app.kuaizhizao.salesContract.savedDraft', '草稿已保存')
          : '销售合同已创建',
      );
    }

    if (isFormPage) {
      navigate(SALES_CONTRACT_LIST_PATH);
    } else {
      setEditingId(null);
      actionRef.current?.reload();
      if (detail?.id === editingId) openDetail(editingId);
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

      title: '删除销售合同',

      content: `确定删除草稿合同「${record.contract_code || record.id}」？此操作不可恢复。`,

      okText: '删除',

      okButtonProps: { danger: true },

      onOk: async () => {

        try {

          await salesContractApi.remove(record.id!);

          messageApi.success('已删除');

          if (detail?.id === record.id) setDetailOpen(false);

          actionRef.current?.reload();

        } catch (e: any) {

          messageApi.error(e?.message || '删除失败');

        }

      },

    });

  };



  const renderCreateForm = () => (

    <>

      <Row gutter={16}>

        <Col span={12}>

          <ProFormSelect

            name="contract_type"

            label="合同类型"

            rules={[{ required: true, message: '请选择合同类型' }]}

            options={[

              { label: '单次合同', value: 'single' },

              { label: '框架合同', value: 'framework' },

            ]}

          />

        </Col>

        <Col span={12}>

          <ProForm.Item name="customer_id" label="客户" rules={[{ required: true, message: '请选择客户' }]}>

            <CustomerSelectDropdown

              placeholder="请选择客户"

              style={{ width: '100%' }}

              customers={customerList}

              onCustomersChange={setCustomerList}

              autoLoad={false}

              onCustomerPick={(cust) => {

                if (cust) {

                  formRef.current?.setFieldsValue({

                    customer_name: cust.name || (cust as any).customer_name,

                    customer_contact: cust.contactPerson ?? (cust as any).contact,

                    customer_phone: cust.phone,

                    shipping_address: cust.address,

                    salesman_name: (cust as any).salesman_name ?? (cust as any).salesmanName,

                  });

                } else {

                  formRef.current?.setFieldsValue({

                    customer_name: undefined,

                    customer_contact: undefined,

                    customer_phone: undefined,

                    shipping_address: undefined,

                    salesman_name: undefined,

                  });

                }

              }}

            />

          </ProForm.Item>

        </Col>

      </Row>

      <ProFormText name="customer_name" hidden />

      <Row gutter={16}>

        <Col flex={1} style={{ minWidth: 0 }}>

          <ProFormText name="salesman_name" label="业务员" placeholder="请输入业务员" />

        </Col>

        <Col flex={1} style={{ minWidth: 0 }}>

          <ProFormDatePicker

            name="contract_date"

            label="签订日期"

            rules={[{ required: true, message: '请选择签订日期' }]}

            fieldProps={{ style: { width: '100%' } }}

          />

        </Col>

        <Col flex={1} style={{ minWidth: 0 }}>

          <ProFormDatePicker name="valid_from" label="生效日期" fieldProps={{ style: { width: '100%' } }} />

        </Col>

        <Col flex={1} style={{ minWidth: 0 }}>

          <ProFormDatePicker name="valid_to" label="失效日期" fieldProps={{ style: { width: '100%' } }} />

        </Col>

        <Col flex={1} style={{ minWidth: 0 }}>

          <DictionarySelect

            dictionaryCode="SHIPPING_METHOD"

            name="shipping_method"

            label="发货方式"

            placeholder="请选择发货方式"

            formRef={formRef}

            valueEqualsLabel={false}

          />

        </Col>

      </Row>

      <Row gutter={16}>

        <Col span={4}>

          <ProFormText name="customer_contact" label="联系人" />

        </Col>

        <Col span={4}>

          <ProFormText name="customer_phone" label="电话" />

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

            valueEqualsLabel={false}

          />

        </Col>

        <Col span={4}>

          <DictionarySelect

            dictionaryCode="CURRENCY"

            name="currency_code"

            label="币种"

            placeholder="请选择币种"

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
            messageApi.warning('无导入权限');
            return;
          }
          setImportModalVisible(true);
        }}
        showImportButton={contractPerms.canImport}

        onPriceTypeToggle={handleContractPriceTypeToggle}

        onRefreshLinePriceByVariant={refreshContractLinePriceByVariant}

        editingIncl={contractEditingIncl}

        setEditingIncl={setContractEditingIncl}

        editingInclValueRef={contractEditingInclValueRef}

      />

      <div style={{ marginTop: 16 }}>

        <ProForm.Item label="收款计划（可选）" colon={false}>

          <AntForm.List name="milestones">

            {(fields, { add, remove }) => {

              const msCols = [

                {

                  title: '里程碑名称',

                  width: 160,

                  render: (_: unknown, __: unknown, index: number) => (

                    <ProFormText

                      name={[index, 'milestone_name']}

                      placeholder="如：预付款"

                      formItemProps={{ style: { margin: 0 } }}

                    />

                  ),

                },

                {

                  title: '计划日期',

                  width: 140,

                  render: (_: unknown, __: unknown, index: number) => (

                    <ProFormDatePicker

                      name={[index, 'planned_date']}

                      fieldProps={{ style: { width: '100%' } }}

                      formItemProps={{ style: { margin: 0 } }}

                    />

                  ),

                },

                {

                  title: '计划金额',

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

                  title: '比例(%)',

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

                  title: '触发方式',

                  width: 120,

                  render: (_: unknown, __: unknown, index: number) => (

                    <ProFormSelect

                      name={[index, 'billing_trigger']}

                      options={[

                        { label: '里程碑', value: 'milestone' },

                        { label: '发货', value: 'delivery' },

                      ]}

                      formItemProps={{ style: { margin: 0 } }}

                    />

                  ),

                },

                {

                  title: '操作',

                  width: 60,

                  render: (_: unknown, __: unknown, index: number) => (

                    <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} />

                  ),

                },

              ];

              return (

                <>

                  {fields.length > 0 ? (

                    <Table size="small" pagination={false} rowKey="key" dataSource={fields} columns={msCols as any} scroll={{ x: 'max-content' }} />

                  ) : null}

                  <Button type="dashed" block icon={<PlusOutlined />} style={{ marginTop: 8 }} onClick={() => add({ ...defaultMilestone })}>

                    添加收款节点

                  </Button>

                </>

              );

            }}

          </AntForm.List>

        </ProForm.Item>

      </div>

      <div style={{ marginTop: 16 }}>

        <Row gutter={16}>

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

        <ProFormTextArea name="notes" label="备注" fieldProps={{ rows: 2 }} />

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

      messageApi.error(e?.message || '加载合同详情失败');

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



  const handleSubmit = async (record: SalesContract) => {

    Modal.confirm({

      title: '提交审核',

      content: `确定提交合同「${record.contract_code || record.id}」？`,

      onOk: async () => {

        try {

          await salesContractApi.submit(record.id!);

          messageApi.success('已提交审核');

          if (detail?.id === record.id) await refreshDetail(record.id!);

          else reload();

        } catch (e: any) {

          messageApi.error(e?.message || '提交失败');

        }

      },

    });

  };



  const openReviewModal = (record: SalesContract, action: ReviewAction) => {

    setReviewTarget(record);

    setReviewAction(action);

    setReviewRemarks('');

    setReviewModalOpen(true);

  };



  const submitReview = async () => {

    if (!reviewTarget?.id) return;

    try {

      if (reviewAction === 'approve') {

        await salesContractApi.approve(reviewTarget.id, reviewRemarks.trim() || undefined);

        messageApi.success('合同已生效');

      } else {

        await salesContractApi.reject(reviewTarget.id, reviewRemarks.trim() || undefined);

        messageApi.success('已驳回');

      }

      setReviewModalOpen(false);

      setReviewTarget(null);

      await refreshDetail(reviewTarget.id);

    } catch (e: any) {

      messageApi.error(e?.message || '操作失败');

    }

  };



  const handleWithdraw = (record: SalesContract) => {
    Modal.confirm({
      title: '撤回提交',
      content: `确定撤回合同「${record.contract_code || record.id}」？撤回后可继续编辑。`,
      onOk: async () => {
        try {
          await salesContractApi.withdraw(record.id!);
          messageApi.success('已撤回');
          if (detail?.id === record.id) await refreshDetail(record.id!);
          else reload();
        } catch (e: any) {
          messageApi.error(e?.message || '撤回失败');
        }
      },
    });
  };

  const handleRevokeReview = (record: SalesContract) => {
    Modal.confirm({
      title: '撤回审核',
      content: `确定撤回合同「${record.contract_code || record.id}」的审核？将回到待审核状态。`,
      onOk: async () => {
        try {
          await salesContractApi.revokeReview(record.id!);
          messageApi.success('已撤回审核');
          if (detail?.id === record.id) await refreshDetail(record.id!);
          else reload();
        } catch (e: any) {
          messageApi.error(e?.message || '撤回审核失败');
        }
      },
    });
  };

  const handlePrint = async (record: SalesContract) => {
    try {
      const templates = await getPrintTemplateList({
        is_active: true,
        document_type: 'sales_contract',
      });
      setPrintTemplates(templates || []);
      const defaultTpl = templates.find((tpl) => tpl.is_default) ?? templates[0];
      setSelectedPrintTemplateUuid(defaultTpl?.uuid);
    } catch {
      setPrintTemplates([]);
      setSelectedPrintTemplateUuid(undefined);
    }
    setPrintingRecord(record);
    setPrintModalVisible(true);
  };

  const handleConfirmPrint = async () => {
    const record = printingRecord;
    if (!record?.id) return;
    const safeCode = String(record.contract_code || record.id).replace(/[/\\?%*:|"<>]/g, '-');
    const fileName = `销售合同_${safeCode}.pdf`;
    try {
      setPrintSubmitting(true);
      const result: DocumentPrintApiResult = await salesContractApi.print(record.id, {
        templateUuid: selectedPrintTemplateUuid,
        outputFormat: 'pdf',
        responseFormat: 'json',
      });
      const raw = result?.content || '';
      if (result?.content_encoding === 'base64' && result?.mime_type === 'application/pdf' && raw) {
        const binary = atob(raw);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        setPdfPreviewBlobUrl(blobUrl);
        setPdfPreviewFileName(fileName);
        setPdfPreviewVisible(true);
        setPrintModalVisible(false);
        setPrintingRecord(null);
        messageApi.success('已打开预览');
        return;
      }
      messageApi.warning('打印内容为空');
    } catch (e: any) {
      messageApi.error(e?.message || '打印失败');
    } finally {
      setPrintSubmitting(false);
    }
  };

  const handleToolbarPrint = async (keys: React.Key[]) => {
    if (!keys || keys.length !== 1) return;
    const numericId = Number(keys[0]);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      messageApi.warning('请选择一条有效记录');
      return;
    }
    try {
      const latest = await salesContractApi.get(numericId, false);
      if (!canPrintContract(latest)) {
        messageApi.warning('仅已审核通过且已生效的合同可打印');
        return;
      }
      await handlePrint(latest);
    } catch (e: any) {
      messageApi.error(e?.message || '加载合同失败');
    }
  };

  const handleCloseContract = async () => {

    if (!detail?.id) return;

    try {

      await salesContractApi.close(detail.id, closeReason.trim() || undefined);

      messageApi.success('合同已关闭');

      setCloseModalOpen(false);

      setCloseReason('');

      await refreshDetail(detail.id);

    } catch (e: any) {

      messageApi.error(e?.message || '关闭失败');

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

        messageApi.warning('没有可释放的明细行');

        return;

      }

      setReleaseTarget(full);

      setReleaseRows(rows);

      setReleaseModalOpen(true);

    } catch (e: any) {

      messageApi.error(e?.message || '加载合同明细失败');

    }

  };



  const handleReleaseSubmit = async () => {

    if (!releaseTarget?.id) return;

    const lines = releaseRows

      .filter((r) => r.selected && r.release_quantity > 0)

      .map((r) => ({ item_id: r.item_id, release_quantity: r.release_quantity }));

    if (!lines.length) {

      messageApi.error('请至少选择一行并填写释放数量');

      return;

    }

    setReleaseSubmitting(true);

    try {

      const res = await salesContractApi.convertToOrder(releaseTarget.id, { release_lines: lines });

      const orderId = (res.sales_order as any)?.id;

      const orderCode = (res.sales_order as any)?.order_code || '';

      messageApi.success(`已生成销售订单 ${orderCode}`);

      setReleaseModalOpen(false);

      setReleaseTarget(null);

      setReleaseRows([]);

      if (detail?.id === releaseTarget.id) await refreshDetail(releaseTarget.id);

      else reload();

      navigate('/apps/kuaizhizao/sales-management/sales-orders', {

        state: orderId ? { openSalesOrderId: orderId } : undefined,

      });

    } catch (e: any) {

      messageApi.error(e?.message || '下推订单失败');

    } finally {

      setReleaseSubmitting(false);

    }

  };



  const loadChanges = async (contractId: number) => {

    setChangesLoading(true);

    try {

      const list = await salesContractApi.listChanges(contractId);

      setChanges(Array.isArray(list) ? list : []);

    } catch (e: any) {

      messageApi.error(e?.message || '加载变更记录失败');

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

      messageApi.success('变更单已创建');

      changeFormRef.current?.resetFields();

      changeFormRef.current?.setFieldsValue({ change_type: 'amendment', delta_amount: 0 });

      await loadChanges(detail.id);

    } catch (e: any) {

      messageApi.error(e?.message || '创建变更失败');

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

      messageApi.success('操作成功');

      await loadChanges(detail.id);

      await refreshDetail(detail.id);

    } catch (e: any) {

      messageApi.error(e?.message || '操作失败');

    }

  };



  const handleGenerateReceivable = async (milestoneId: number) => {

    if (!detail?.id) return;

    try {

      await salesContractApi.generateMilestoneReceivable(detail.id, milestoneId);

      messageApi.success('已生成应收');

      await refreshDetail(detail.id);

      void loadPaymentSummary(detail.id);

    } catch (e: any) {

      messageApi.error(e?.message || '生成应收失败');

    }

  };



  const renderStatusCell = (record: SalesContract) => {

    if (record.lifecycle) {

      const lc = parseBackendLifecycle(record.lifecycle);

      const activeStage = lc.mainStages?.find((s) => s.status === 'active');

      return (

        <UniLifecycle

          percent={lc.percent}

          stageName={activeStage?.label ?? lc.stageName}

          status={lc.status}

          subStages={lc.subStages}

          showLabel

          showCircleTooltip={false}

        />

      );

    }

    return <Tag color={STATUS_COLOR[record.status || ''] || 'default'}>{record.status}</Tag>;

  };



  const columns: ProColumns<SalesContract>[] = useMemo(

    () => [

      { title: '合同编号', dataIndex: 'contract_code', width: 160, ellipsis: true },

      {

        title: '合同类型',

        dataIndex: 'contract_type',

        width: 100,

        valueType: 'select',

        valueEnum: { single: { text: '单次合同' }, framework: { text: '框架合同' } },

        render: (_, r) => CONTRACT_TYPE_MAP[r.contract_type || ''] || r.contract_type,

      },

      { title: '客户', dataIndex: 'customer_name', ellipsis: true },

      { title: '签订日期', dataIndex: 'contract_date', width: 120, valueType: 'date' },

      { title: '有效期至', dataIndex: 'valid_to', width: 120, valueType: 'date' },

      { title: '合同金额', dataIndex: 'total_amount', width: 120, align: 'right', valueType: 'money' },

      {

        title: '已释放',

        dataIndex: 'released_amount',

        width: 120,

        align: 'right',

        render: (_, r) => `¥${Number(r.released_amount ?? 0).toLocaleString()}`,

      },

      {

        title: '状态',

        dataIndex: 'status',

        width: 140,

        valueType: 'select',

        valueEnum: {

          草稿: { text: '草稿' },

          待审核: { text: '待审核' },

          已生效: { text: '已生效' },

          执行中: { text: '执行中' },

          已关闭: { text: '已关闭' },

          已到期: { text: '已到期' },

        },

        render: (_, r) => renderStatusCell(r),

      },

      {

        title: '操作',

        valueType: 'option',

        width: 220,

        render: (_, record) =>

          [

              <Button {...rowActionKind('read')} key="view" onClick={() => openDetail(record.id!)}>

                详情

              </Button>,

              record.status === '草稿' ? (

                contractPerms.canUpdate ? (
                  <Button {...rowActionKind('update')} key="edit" onClick={() => handleEdit(record)}>
                    编辑
                  </Button>
                ) : null

              ) : null,

              record.status === '草稿' ? (

                contractPerms.canDelete ? (
                  <Button {...rowActionKind('delete')} key="del" onClick={() => handleDeleteDraft(record)}>
                    删除
                  </Button>
                ) : null

              ) : null,

              record.status === '草稿' && canSubmitContract ? (

                <Button {...rowActionKind('submit')} key="submit" onClick={() => handleSubmit(record)}>

                  提交

                </Button>

              ) : null,

              canWithdrawContract(record) && canRevokeContract ? (

                <Button {...rowActionKind('revoke')} key="withdraw" onClick={() => handleWithdraw(record)}>

                  撤回

                </Button>

              ) : null,

              canApproveContract(record) && canReviewContract ? (

                <Button {...rowActionKind('audit')} key="approve" onClick={() => openReviewModal(record, 'approve')}>

                  审核

                </Button>

              ) : null,

              canRejectContract(record) && canReviewContract ? (

                <Button {...rowActionKind('reject')} key="reject" onClick={() => openReviewModal(record, 'reject')}>

                  驳回

                </Button>

              ) : null,

              canRevokeContractApproval(record) && canRevokeContract ? (

                <Button {...rowActionKind('revoke')} key="revoke-review" onClick={() => handleRevokeReview(record)}>

                  撤回审核

                </Button>

              ) : null,

              canPrintContract(record) && contractPerms.canPrint ? (

                <Button {...rowActionKind('print')} key="print" onClick={() => void handlePrint(record)}>

                  打印

                </Button>

              ) : null,

              ['已生效', '执行中'].includes(record.status || '') ? (

                <Button {...rowActionKind('release')} key="release" onClick={() => openReleaseModal(record)}>

                  下推订单

                </Button>

              ) : null,

            ].filter(Boolean),

      },

    ],

    [
      canReviewContract,
      canRevokeContract,
      canSubmitContract,
      contractPerms.canDelete,
      contractPerms.canPrint,
      contractPerms.canUpdate,
    ],

  );



  const detailBasicColumns: ProDescriptionsItemProps<SalesContract>[] = [

    { title: '合同编号', dataIndex: 'contract_code' },

    {

      title: '合同类型',

      dataIndex: 'contract_type',

      render: (_, r) => CONTRACT_TYPE_MAP[r.contract_type || ''] || r.contract_type,

    },

    {

      title: '状态',

      dataIndex: 'status',

      render: (_, r) => (

        <Tag color={STATUS_COLOR[r.status || ''] || 'default'}>{r.status || '—'}</Tag>

      ),

    },

    { title: '客户', dataIndex: 'customer_name' },

    { title: '联系人', dataIndex: 'customer_contact' },

    { title: '电话', dataIndex: 'customer_phone' },

    { title: '签订日期', dataIndex: 'contract_date', valueType: 'date' },

    { title: '生效日期', dataIndex: 'valid_from', valueType: 'date' },

    { title: '失效日期', dataIndex: 'valid_to', valueType: 'date' },

    {

      title: '是否含税',

      dataIndex: 'price_type',

      render: (_, r) => (r.price_type === 'tax_inclusive' ? '含税单价' : '不含税单价'),

    },

    {

      title: '合同金额',

      dataIndex: 'total_amount',

      render: (_, r) => <AmountDisplay resource={SC} fieldName="total_amount" value={r.total_amount} />,

    },

    {

      title: '已释放金额',

      dataIndex: 'released_amount',

      render: (_, r) => <AmountDisplay resource={SC} fieldName="amount" value={r.released_amount} />,

    },

    {

      title: '剩余金额',

      dataIndex: 'remaining_amount',

      render: (_, r) => <AmountDisplay resource={SC} fieldName="amount" value={r.remaining_amount} />,

    },

    {

      title: '币种',

      dataIndex: 'currency_code',

      render: (_, r) => (

        <DictionaryLabel dictionaryCode="CURRENCY" value={r.currency_code || 'CNY'} />

      ),

    },

    {

      title: '付款条件',

      dataIndex: 'payment_terms',

      render: (_, r) => (

        <DictionaryLabel dictionaryCode="PAYMENT_TERMS" value={r.payment_terms} />

      ),

    },

    { title: '业务员', dataIndex: 'salesman_name' },

    {

      title: '发货方式',

      dataIndex: 'shipping_method',

      render: (_, r) => (

        <DictionaryLabel dictionaryCode="SHIPPING_METHOD" value={r.shipping_method} />

      ),

    },

    {

      title: '来源报价',

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

    { title: '收货地址', dataIndex: 'shipping_address', span: 3 },

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

    { title: '备注', dataIndex: 'notes', span: 3 },

  ];



  const detailLifecycle = detail?.lifecycle ? parseBackendLifecycle(detail.lifecycle) : null;



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
                onClick={() => navigate(SALES_CONTRACT_LIST_PATH)}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {isCreatePage
                  ? t('app.kuaizhizao.menu.sales-management.sales-contracts.new')
                  : t('app.kuaizhizao.menu.sales-management.sales-contracts.edit')}
              </Typography.Title>
            </Space>
            <Space wrap>
              <Button onClick={() => navigate(SALES_CONTRACT_LIST_PATH)}>{t('common.cancel')}</Button>
              <Button onClick={() => void handleSaveDraft()}>
                {isCreatePage
                  ? t('app.kuaizhizao.salesContract.saveDraft', '保存为草稿')
                  : t('common.save')}
              </Button>
              <Button type="primary" onClick={triggerContractFormSubmit}>
                {isCreatePage
                  ? t('components.layoutTemplates.formModal.submitCreate')
                  : t('app.kuaizhizao.salesContract.saveAndSubmit', '保存并提交')}
                {SUBMIT_SHORTCUT_HINT}
              </Button>
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
                onFinish={(values) => handleFormSubmit(values, { asDraft: false })}
                onFinishFailed={({ errorFields }) => {
                  const first = errorFields?.[0];
                  const text = first?.errors?.filter(Boolean)[0];
                  messageApi.error(text || t('components.layoutTemplates.formModal.checkFormHint'));
                }}
                initialValues={isCreatePage ? { items: [{ ...defaultContractItem }] } : undefined}
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
            title="导入合同明细"
            headers={['物料编号', '规格', '单位', '数量', '单价', '交货日期', '备注']}
            exampleRow={['MAT001', 'Spec X', '件', '100', '1.5', '2026-03-01', '']}
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

        columns={columns}

        showAdvancedSearch

        selectedRowKeys={selectedRowKeys}

        onRowSelectionChange={setSelectedRowKeys}

        rowSelection={{ type: 'checkbox' }}

        headerTitle={

          <Space>

            <span>销售合同</span>

            <Button type="link" size="small" onClick={() => navigate('/apps/kuaizhizao/sales-management/quotations')}>

              从报价单转合同 →

            </Button>

          </Space>

        }

        showCreateButton

        createButtonText="新建合同"

        onCreate={handleCreate}

        toolBarActionsAfterCreate={[
          <Button {...rowActionKind('update')} key="terms-manage" onClick={() => setTermsManageOpen(true)}>
            {t('app.kuaizhizao.salesContract.terms.manageBtn')}
          </Button>,
        ]}

        toolBarActionsAfterBatch={contractPerms.canPrint ? [
          <Button {...rowActionKind('print')}
            key="contract-print"
            icon={<PrinterOutlined />}
            size="middle"
            disabled={selectedRowKeys.length !== 1}
            onClick={() => void handleToolbarPrint(selectedRowKeys)}
          >
            打印合同
          </Button>,
        ] : undefined}

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
              messageApi.warning('暂无数据可导出');
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales-contracts-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(`已导出 ${items.length} 条记录`);
          } catch (error: any) {
            messageApi.error(error?.message || '导出失败');
          }
        }}

        request={async (params, _sort, _filter, searchFormValues) => {

          const res = await salesContractApi.list({

            skip: ((params.current || 1) - 1) * (params.pageSize || 20),

            limit: params.pageSize || 20,

            keyword: searchFormValues?.keyword,

            status: searchFormValues?.status,

            contract_type: searchFormValues?.contract_type,

          });

          return { data: res.items || [], success: true, total: res.total || 0 };

        }}

        scroll={{ x: 'max-content' }}

      />



      <DetailDrawerTemplate

        title={detail?.contract_code ? `销售合同 · ${detail.contract_code}` : '销售合同详情'}

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

              {detail.status === '草稿' && (

                <>

                  {contractPerms.canUpdate ? (
                    <Button icon={<EditOutlined />} onClick={() => handleEdit(detail)}>编辑</Button>
                  ) : null}

                  {contractPerms.canDelete ? (
                    <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteDraft(detail)}>删除</Button>
                  ) : null}

                  {canSubmitContract ? (
                    <Button icon={<SendOutlined />} onClick={() => handleSubmit(detail)}>提交</Button>
                  ) : null}

                </>

              )}

              {canWithdrawContract(detail) && canRevokeContract ? (
                <Button icon={<RollbackOutlined />} onClick={() => handleWithdraw(detail)}>撤回</Button>
              ) : null}

              {canApproveContract(detail) && canReviewContract ? (
                <Button icon={<CheckOutlined />} onClick={() => openReviewModal(detail, 'approve')}>审核通过</Button>
              ) : null}

              {canRejectContract(detail) && canReviewContract ? (
                <Button icon={<CloseOutlined />} onClick={() => openReviewModal(detail, 'reject')}>驳回</Button>
              ) : null}

              {canRevokeContractApproval(detail) && canRevokeContract ? (
                <Button icon={<RollbackOutlined />} onClick={() => handleRevokeReview(detail)}>撤回审核</Button>
              ) : null}

              {canPrintContract(detail) && contractPerms.canPrint ? (
                <Button icon={<PrinterOutlined />} onClick={() => void handlePrint(detail)}>打印</Button>
              ) : null}

              {['已生效', '执行中'].includes(detail.status || '') && (

                <Button type="primary" icon={<ShoppingOutlined />} onClick={() => openReleaseModal(detail)}>

                  下推销售订单

                </Button>

              )}

              {['已生效', '执行中'].includes(detail.status || '') && (

                <Button icon={<FormOutlined />} onClick={openChangeDrawer}>合同变更</Button>

              )}

              {['已生效', '执行中', '已到期'].includes(detail.status || '') && (

                <Button icon={<StopOutlined />} onClick={() => setCloseModalOpen(true)}>关闭合同</Button>

              )}

            </Space>

          ) : null

        }

        basic={

          detail ? (

            <Descriptions

              column={3}

              size="small"

              items={buildDescriptionItemsFromColumns(detail, detailBasicColumns)}

            />

          ) : undefined

        }

        collaborationMetrics={

          paymentSummary ? (

            <Descriptions column={3} size="small" bordered>

              <Descriptions.Item label="合同总额">¥{Number(paymentSummary.total_amount ?? 0).toFixed(2)}</Descriptions.Item>

              <Descriptions.Item label="计划里程碑">¥{Number(paymentSummary.planned_milestone_amount ?? 0).toFixed(2)}</Descriptions.Item>

              <Descriptions.Item label="已开票">¥{Number(paymentSummary.invoiced_amount ?? 0).toFixed(2)}</Descriptions.Item>

              <Descriptions.Item label="已收款">¥{Number(paymentSummary.collected_amount ?? 0).toFixed(2)}</Descriptions.Item>

              <Descriptions.Item label="待开票">¥{Number(paymentSummary.pending_amount ?? 0).toFixed(2)}</Descriptions.Item>

            </Descriptions>

          ) : undefined

        }

        collaborationLifecycle={

          detail ? (

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {detailLifecycle?.mainStages?.length ? (

                <UniLifecycleStepper steps={detailLifecycle.mainStages} />

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

                    { title: '物料编码', dataIndex: 'material_code', width: 120 },

                    { title: '物料名称', dataIndex: 'material_name', ellipsis: true },

                    { title: '合同数量', dataIndex: 'contract_quantity', width: 100, align: 'right' as const },

                    { title: '已释放', dataIndex: 'released_quantity', width: 100, align: 'right' as const },

                    {

                      title: '剩余',

                      width: 100,
                      align: 'right' as const,

                      render: (_, r) => remainingItemQty(r),

                    },

                    { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right' as const, render: (v) => `¥${Number(v).toFixed(2)}` },

                    { title: '金额', dataIndex: 'total_amount', width: 120, align: 'right' as const, render: (v) => `¥${Number(v).toFixed(2)}` },

                  ]}

                />

              ) : null}

              {detail.milestones?.length ? (

                <div style={{ marginTop: detail.items?.length ? 16 : 0 }}>

                  <Typography.Title level={5} style={{ marginBottom: 8 }}>

                    收款里程碑

                  </Typography.Title>

                  <Table

                    size="small"

                    rowKey="id"

                    pagination={false}

                    dataSource={detail.milestones}

                    columns={[

                      { title: '里程碑', dataIndex: 'milestone_name' },

                      { title: '计划日期', dataIndex: 'planned_date', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '—') },

                      { title: '计划金额', dataIndex: 'planned_amount', render: (v) => `¥${Number(v ?? 0).toFixed(2)}` },

                      { title: '状态', dataIndex: 'status' },

                      { title: '应收单', dataIndex: 'receivable_code', render: (v) => v || '—' },

                      {

                        title: '操作',

                        width: 100,

                        render: (_, r) =>

                          r.id && r.status !== 'collected' && !r.receivable_id ? (

                            <Button type="link" size="small" onClick={() => handleGenerateReceivable(r.id!)}>

                              生成应收

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

            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />

          )

        }

      />



      <Drawer

        title={detail?.contract_code ? `合同变更 · ${detail.contract_code}` : '合同变更'}

        open={changeDrawerOpen}

        onClose={() => setChangeDrawerOpen(false)}

        size={640}

        destroyOnHidden

      >

        <ProForm

          formRef={changeFormRef}

          layout="vertical"

          submitter={{

            searchConfig: { submitText: '创建变更' },

            submitButtonProps: { loading: changeSubmitting },

          }}

          onFinish={handleCreateChange}

        >

          <ProFormSelect

            name="change_type"

            label="变更类型"

            options={[

              { label: '合同修订', value: 'amendment' },

              { label: '金额调整', value: 'amount_change' },

              { label: '延期', value: 'extension' },

            ]}

            rules={[{ required: true }]}

          />

          <ProForm.Item name="delta_amount" label="金额变动" initialValue={0}>
            <InputNumber style={{ width: '100%' }} precision={2} />
          </ProForm.Item>

          <ProFormDatePicker name="new_valid_to" label="新失效日期" fieldProps={{ style: { width: '100%' } }} />

          <ProFormTextArea name="reason" label="变更原因" fieldProps={{ rows: 3 }} />

        </ProForm>

        <Typography.Title level={5} style={{ marginTop: 24 }}>变更记录</Typography.Title>

        <Table

          size="small"

          rowKey="id"

          loading={changesLoading}

          pagination={false}

          dataSource={changes}

          columns={[

            { title: '变更单号', dataIndex: 'change_code', width: 140 },

            { title: '类型', dataIndex: 'change_type', width: 100 },

            { title: '金额变动', dataIndex: 'delta_amount', render: (v) => `¥${Number(v ?? 0).toFixed(2)}` },

            { title: '状态', dataIndex: 'status', width: 90 },

            {

              title: '操作',

              width: 160,

              render: (_, r) => (

                <Space size={0}>

                  {r.status === '草稿' ? (

                    <Button type="link" size="small" onClick={() => handleChangeAction(r.id, 'submit')}>提交</Button>

                  ) : null}

                  {r.status === '待审核' ? (

                    <>

                      <Button type="link" size="small" onClick={() => handleChangeAction(r.id, 'approve')}>通过</Button>

                      <Button type="link" size="small" danger onClick={() => handleChangeAction(r.id, 'reject')}>驳回</Button>

                    </>

                  ) : null}

                </Space>

              ),

            },

          ]}

        />

      </Drawer>



      <Modal

        title="下推销售订单"

        open={releaseModalOpen}

        width={MODAL_CONFIG.LARGE_WIDTH}

        okText="确认下推"

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

          合同：{releaseTarget?.contract_code} · 勾选明细并填写本次释放数量

        </Typography.Paragraph>

        <Table

          size="small"

          rowKey="item_id"

          pagination={false}

          dataSource={releaseRows}

          columns={[

            {

              title: '选择',

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

            { title: '物料编码', dataIndex: 'material_code', width: 120 },

            { title: '物料名称', dataIndex: 'material_name', ellipsis: true },

            { title: '合同数量', dataIndex: 'contract_quantity', width: 90, align: 'right' as const },

            { title: '已释放', dataIndex: 'released_quantity', width: 80, align: 'right' as const },

            { title: '剩余', dataIndex: 'remaining_quantity', width: 80, align: 'right' as const },

            {

              title: '本次释放',

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

            { title: '单位', dataIndex: 'material_unit', width: 60 },

          ]}

        />

      </Modal>



      <Modal

        title={reviewAction === 'approve' ? '审核通过' : '驳回合同'}

        open={reviewModalOpen}

        okText={reviewAction === 'approve' ? '确认通过' : '确认驳回'}

        okButtonProps={reviewAction === 'reject' ? { danger: true } : undefined}

        onOk={submitReview}

        onCancel={() => {

          setReviewModalOpen(false);

          setReviewTarget(null);

          setReviewRemarks('');

        }}

        destroyOnHidden

      >

        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>

          合同：{reviewTarget?.contract_code ?? reviewTarget?.id ?? '-'}

        </Typography.Paragraph>

        <Input.TextArea

          rows={3}

          value={reviewRemarks}

          onChange={(e) => setReviewRemarks(e.target.value)}

          placeholder={reviewAction === 'approve' ? '可选：审核意见' : '可选：驳回原因'}

          maxLength={500}

          showCount

        />

      </Modal>



      <Modal

        title="关闭合同"

        open={closeModalOpen}

        okText="确认关闭"

        onOk={handleCloseContract}

        onCancel={() => {

          setCloseModalOpen(false);

          setCloseReason('');

        }}

        destroyOnHidden

      >

        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>

          合同：{detail?.contract_code ?? detail?.id ?? '-'}

        </Typography.Paragraph>

        <Input.TextArea

          rows={3}

          value={closeReason}

          onChange={(e) => setCloseReason(e.target.value)}

          placeholder="可选：关闭原因"

          maxLength={500}

          showCount

        />

      </Modal>



      <Modal
        open={printModalVisible}
        title="选择打印模板"
        width={MODAL_CONFIG.TINY_WIDTH}
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
      >
        <Space orientation="vertical" style={{ width: '100%' }} size={12}>
          <Typography.Text type="secondary">
            合同：{printingRecord?.contract_code ?? printingRecord?.id ?? '-'}
          </Typography.Text>
          {printTemplates.length === 0 ? (
            <Typography.Text type="secondary">暂无可用模板，请先在系统设置中配置 sales_contract 打印模板。</Typography.Text>
          ) : (
            printTemplates.map((tpl) => (
              <Button
                key={tpl.uuid}
                block
                type={selectedPrintTemplateUuid === tpl.uuid ? 'primary' : 'default'}
                onClick={() => setSelectedPrintTemplateUuid(tpl.uuid)}
              >
                {tpl.name}
                {tpl.is_default ? '（默认）' : ''}
              </Button>
            ))
          )}
        </Space>
      </Modal>

      <UniPdfPreview
        open={pdfPreviewVisible}
        blobUrl={pdfPreviewBlobUrl}
        fileName={pdfPreviewFileName}
        onClose={() => {
          setPdfPreviewVisible(false);
          if (pdfPreviewBlobUrl) {
            URL.revokeObjectURL(pdfPreviewBlobUrl);
            setPdfPreviewBlobUrl(null);
          }
        }}
      />

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


