/**
 * 采购申请管理页面
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useLeaveFormTab } from '../../../../../components/uni-tabs/navigateClosingTab';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Table, Form as AntForm, Input, InputNumber, Select, Row, Col, Checkbox, Empty, Spin, Typography, DatePicker, Modal, theme, Alert, Switch } from 'antd';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import {
  EyeOutlined,
  CheckOutlined,
  EditOutlined,
  SwapOutlined,
  FileSearchOutlined,
  DeleteOutlined,
  PlusOutlined,
  SendOutlined,
  AppstoreAddOutlined,
  ArrowLeftOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable, readPersistedUniTableViewType } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  MaterialStackedCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniAuditBatchMenuButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, buildUniPushToolbarDisabledReason, UniPushToolbarButton } from '../../../../../components/uni-push';
import {
  UniPullQueryModal,
  isPullableScope,
  renderPullCapabilityTag,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { SourceDocumentCode } from '../../../../../components/linked-document-code/SourceDocumentCode';
import { ListPageTemplate, DetailDrawerSection, DetailDrawerActions, MODAL_CONFIG, DocumentFormPageLayout, DocumentFormPageHeaderActions, DOCUMENT_DETAIL_PAGE_TITLE_STYLE } from '../../../../../components/layout-templates';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { MaterialUnitSelect, prefetchMaterialsForUnitSelect } from '../../../../../components/material-unit-select';
import { DocumentLineUnitSelect } from '../../../../../components/quantity-with-unit';
import { resolveMaterialScenarioUnit } from '../../../../../utils/materialScenarioUnit';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import {
  EquipmentPersonSelect,
  resolveUserUuidById,
} from '../../../components/EquipmentPersonSelect';
import type { Material } from '../../../../master-data/types/material';
import {
  applyPurchaseDocumentLineMaterialPricing,
  resolvePurchaseDocumentMaterialLinesPricing,
} from '../../../../master-data/utils/resolve-partner-material-price';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { downloadFile } from '../../../../../utils';
import { pickImportExampleValue } from '../../../../../utils/loadImportDictionaryValues';
import { useImportMaterialUnitOptions } from '../../../../master-data/hooks/useImportMaterialUnitOptions';

const LazyUniImport = lazy(() =>
  import('../../../../../components/uni-import').then((m) => ({ default: m.UniImport })),
);
import {
  listPurchaseRequisitions,
  getPurchaseRequisition,
  createPurchaseRequisition,
  updatePurchaseRequisition,
  deletePurchaseRequisition,
  submitPurchaseRequisition,
  approvePurchaseRequisition,
  withdrawPurchaseRequisition,
  withdrawPurchaseRequisitionSubmit,
  fixPurchaseRequisitionStatus,
  convertToPurchaseOrder,
  previewPushToPurchaseOrder,
  previewPushToInquiry,
  pullPurchaseRequisitionFromDemandComputationItems,
  PurchaseRequisition,
  PurchaseRequisitionItem,
  type DocumentPushPreview,
} from '../../../services/purchase-requisition';
import { createInquiryFromRequisition } from '../../../services/purchase-inquiry';
import {
  listDemandComputationPurchasePullLines,
  listDemandComputations,
  type DemandComputationPurchasePullLine,
} from '../../../services/demand-computation';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import {
  buildPurchaseRequisitionLifecycleValueEnum,
  getPurchaseRequisitionLifecycle,
  resolvePurchaseRequisitionListLifecycleParams,
} from '../../../utils/purchaseRequisitionLifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { formatPurchaseRequisitionSourceType } from '../../../utils/purchaseRequisitionSourceType';
import { renderDemandBusinessModeMarkerTag } from '../../../utils/businessMode';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_DEFAULTS, DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS, ratioToPushProgressPercent } from '../../sales-management/shared/DocumentPushProgressBar';
import { flattenDocumentDetailRows, resolveDetailTableViewMode } from '../../shared/detailTableFlatRows';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  PurchaseRequisitionDetailDrawer,
  PURCHASE_REQUISITION_WORKFLOW_PROPS,
} from './components/PurchaseRequisitionDetailDrawer';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import { ROUTES } from '../../../constants/routes';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../../../stores';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useNumericPrecision } from '../../../../../hooks/useNumericPrecision';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { formatBusinessDateOnly, formatDateTime, formatNumber, formatQuantity, todaySiteDateString } from '../../../../../utils/format';
import { QuantityWithUnitDisplay } from '../../../../../components/quantity-with-unit';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import {
  purchaseRequisitionCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  buildDocumentCreateDraftKey,
  clearDocumentFormDraft,
  getDocumentFormDraft,
  setDocumentFormDraft,
} from '../../../../../utils/documentFormDraftCache';

const INITIAL_PR_FORM_ITEM_ROW = {
  material_id: undefined,
  material_code: '',
  material_name: '',
  material_spec: '',
  unit: '件',
  quantity: 1,
  suggested_unit_price: 0,
  required_date: undefined,
  demand_computation_item_id: undefined,
  supplier_id: undefined,
  notes: undefined,
};

const INITIAL_CREATE_ITEMS = [{ ...INITIAL_PR_FORM_ITEM_ROW }];

type PurchaseRequisitionItemRow = PurchaseRequisitionItem & {
  _rowKey: string;
  requisition_id: number;
  requisition_code?: string;
  requisition_name?: string;
  source_type?: string;
  source_code?: string;
  status?: string;
  review_status?: string;
  downstream_push_progress?: number;
  lifecycle?: Record<string, unknown>;
};

const PURCHASE_REQUISITION_LIST_PERSISTENCE_ID =
  'apps.kuaizhizao.pages.purchase-management.purchase-requisitions.v4';

type PullDemandComputationCandidate = DemandComputationPurchasePullLine;

function renderPurchaseRequisitionRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return nodes;
}

const PURCHASE_REQUISITION_RESOURCE = 'kuaizhizao:purchase-requisition';

const PURCHASE_REQUISITION_LIST_PATH = '/apps/kuaizhizao/purchase-management/purchase-requisitions';
const PURCHASE_REQUISITION_CREATE_PATH = `${PURCHASE_REQUISITION_LIST_PATH}/new`;
const purchaseRequisitionEditPath = (id: number | string) => `${PURCHASE_REQUISITION_LIST_PATH}/${id}/edit`;

const PurchaseRequisitionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { quantity: quantityDecimals, price: priceDecimals, amount: amountDecimals } = useNumericPrecision();
  const pushToPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'purchase_order.pull_from_requisition');
  const pushToInquiryAction = resolveKuaizhizaoDocumentAction(t, 'purchase_inquiry.pull_from_requisition');
  const pullFromDemandComputationAction = resolveKuaizhizaoDocumentAction(t, 'purchase_requisition.pull_from_demand_computation');
  const currentUser = useCurrentUser();
  const purchaseRequestAuditEnabled = useAuditRequired('purchase_request', false);
  const purchaseRequisitionPerms = useResourcePermissions(PURCHASE_REQUISITION_RESOURCE);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isCreatePage = location.pathname.endsWith('/purchase-requisitions/new');
  const editRouteMatch = location.pathname.match(/\/purchase-requisitions\/(\d+)\/edit$/);
  const editRouteId = editRouteMatch ? Number(editRouteMatch[1]) : null;
  const isEditPage = editRouteId != null && Number.isFinite(editRouteId) && editRouteId > 0;
  const isFormPage = isCreatePage || isEditPage;
  const editingId = isEditPage ? editRouteId : null;
  const prFormDraftKey = useMemo(
    () =>
      isFormPage
        ? buildDocumentCreateDraftKey('kuaizhizao:purchase-requisition', location.pathname, location.search)
        : null,
    [isFormPage, location.pathname, location.search],
  );
  const formPageInitKeyRef = useRef<string | null>(null);
  const { token } = theme.useToken();
  const prqDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<PurchaseRequisition[]>([]);
  const [viewTypeState, setViewTypeState] = useState<'table' | 'detailTable' | 'help'>(() =>
    readPersistedUniTableViewType(PURCHASE_REQUISITION_LIST_PERSISTENCE_ID, 'table', [
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
  const deepLinkHandledRef = useRef<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const selectedRequisitionsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is PurchaseRequisition => row != null),
    [selectedRowKeys],
  );

  const purchaseRequisitionAuditBatchHandlers = useMemo(
    () => ({
      submit: (id: number) => submitPurchaseRequisition(id),
      withdraw: (id: number) => withdrawPurchaseRequisitionSubmit(id),
      approve: (id: number) => approvePurchaseRequisition(id, { approved: true, review_remarks: '' }),
      revoke: (id: number) => withdrawPurchaseRequisition(id),
    }),
    [],
  );
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();

  const handlePurchaseRequisitionAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  }, [invalidateMenuBadgeCounts]);
  const leavePurchaseRequisitionFormPage = useLeaveFormTab(PURCHASE_REQUISITION_LIST_PATH);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentReq, setCurrentReq] = useState<PurchaseRequisition | null>(null);
  const [supplierList, setSupplierList] = useState<Array<{ id: number; code?: string; name: string }>>([]);
  const createFormRef = useRef<any>(null);
  /** 程序化回填（服务端/草稿）期间禁止 onValuesChange 写草稿，避免空价覆盖手填 */
  const prFormHydratingRef = useRef(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const materialUnitImport = useImportMaterialUnitOptions();
  const requisitionLineUnitOptions = materialUnitImport.options;
  const requisitionLineImportColumnOptions = useMemo(
    () => [
      undefined,
      undefined,
      requisitionLineUnitOptions,
      undefined,
      undefined,
      undefined,
      undefined,
    ],
    [requisitionLineUnitOptions],
  );


  const [pushPoPreviewOpen, setPushPoPreviewOpen] = useState(false);
  const [pushPoPreviewLoading, setPushPoPreviewLoading] = useState(false);
  const [pushPoPreviewConfirming, setPushPoPreviewConfirming] = useState(false);
  const [pushPoPreviewData, setPushPoPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pushPoTarget, setPushPoTarget] = useState<PurchaseRequisition | null>(null);
  const [pushPoDetailItems, setPushPoDetailItems] = useState<PurchaseRequisitionItem[]>([]);
  const [pushPoSuppliers, setPushPoSuppliers] = useState<Array<{ id: number; code?: string; name: string }>>([]);

  const [pushInquiryPreviewOpen, setPushInquiryPreviewOpen] = useState(false);
  const [pushInquiryPreviewLoading, setPushInquiryPreviewLoading] = useState(false);
  const [pushInquiryPreviewConfirming, setPushInquiryPreviewConfirming] = useState(false);
  const [pushInquiryPreviewData, setPushInquiryPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pushInquiryTarget, setPushInquiryTarget] = useState<PurchaseRequisition | null>(null);
  const [pushInquirySelectedItemIds, setPushInquirySelectedItemIds] = useState<number[]>([]);
  const [pullSourceComputationId, setPullSourceComputationId] = useState<number | undefined>();
  const pullSourceComputationIdRef = useRef<number | undefined>(undefined);
  const [pullSourceOptions, setPullSourceOptions] = useState<Array<{ value: number; label: string }>>([]);

  const [prTrackingRefreshKey, setPrTrackingRefreshKey] = useState(0);

  const ensureSupplierList = useCallback(async (): Promise<Array<{ id: number; code?: string; name: string }>> => {
    if (supplierList.length > 0) return supplierList;
    try {
      const res: any = await supplierApi.list?.({ isActive: true, limit: 500 } as any);
      const list = Array.isArray(res) ? res : res?.data || res?.results || res?.items || [];
      setSupplierList(list);
      return list;
    } catch {
      setSupplierList([]);
      return [];
    }
  }, [supplierList]);


  const appendRequisitionItemsFromMaterials = useCallback(
    async (selected: Material[]) => {
      if (!selected?.length) return;
      const isEmptyItemRow = (row: any) => {
        if (row == null) return true;
        if (row.material_id != null && row.material_id !== '') return false;
        const code = row.material_code;
        return code == null || String(code).trim() === '';
      };
      const requisitionDate = createFormRef.current?.getFieldValue('requisition_date');
      const asOf =
        requisitionDate != null
          ? dayjs.isDayjs(requisitionDate)
            ? requisitionDate
            : dayjs(requisitionDate)
          : dayjs();
      const priced = await resolvePurchaseDocumentMaterialLinesPricing(selected, { asOf });
      const queue = priced.map(({ material: m, unitPrice }) => ({
        material_id: (m as Material).id,
        material_code: (m as Material).mainCode ?? (m as Material).code ?? '',
        material_name: (m as Material).name ?? '',
        material_spec: (m as Material).specification ?? '',
        unit: resolveMaterialScenarioUnit(m as Material, 'purchase'),
        quantity: 1,
        suggested_unit_price: unitPrice,
        required_date: undefined,
        demand_computation_item_id: undefined,
        supplier_id: undefined,
        notes: undefined,
      }));
      const items = [...(createFormRef.current?.getFieldValue('items') ?? [])].map((row: any) => ({ ...row }));
      for (let i = 0; i < items.length && queue.length > 0; i++) {
        if (isEmptyItemRow(items[i])) {
          items[i] = queue.shift()!;
        }
      }
      while (queue.length > 0) {
        items.push(queue.shift()!);
      }
      createFormRef.current?.setFieldsValue({ items });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const handleItemImport = useCallback(
    (data: any[][]) => {
      const rows = data.slice(2);
      const newItems = rows
        .map((row) => {
          const materialCode = String(row[0] || '').trim();
          const spec = String(row[1] || '').trim();
          const unitRaw = String(row[2] || '').trim();
          const unit = materialUnitImport.parse(unitRaw) || unitRaw;
          const quantity = parseFloat(row[3]) || 0;
          const suggestedPrice = parseFloat(row[4]) || 0;
          const requiredDate = row[5];
          const notes = String(row[6] || '').trim();

          if (!materialCode) return null;

          return {
            ...INITIAL_PR_FORM_ITEM_ROW,
            material_code: materialCode,
            material_spec: spec,
            unit: unit || '件',
            quantity: quantity || 1,
            suggested_unit_price: suggestedPrice,
            required_date: requiredDate && dayjs(requiredDate).isValid() ? dayjs(requiredDate) : undefined,
            notes: notes || undefined,
          };
        })
        .filter((it): it is NonNullable<typeof it> => it !== null);

      if (newItems.length === 0) {
        messageApi.warning(t('app.kuaizhizao.purchaseRequisition.importNoValidData'));
        return;
      }

      const currentItems = createFormRef.current?.getFieldValue('items') || [];
      createFormRef.current?.setFieldsValue({ items: [...currentItems, ...newItems] });
      messageApi.success(t('app.kuaizhizao.salesOrder.importSuccessItems', { count: newItems.length }));
      setImportModalVisible(false);
    },
    [messageApi, materialUnitImport, t],
  );

  const initialCreateItems = INITIAL_CREATE_ITEMS;

  const loadPurchaseRequisitionEditForm = useCallback(
    async (id: number) => {
      void ensureSupplierList();
      setPreviewCode(null);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      // 先取出草稿，避免回填服务端空价时 onValuesChange 把草稿冲掉
      const draftSnapshot =
        prFormDraftKey ? getDocumentFormDraft<Record<string, unknown>>(prFormDraftKey) : null;
      prFormHydratingRef.current = true;
      try {
        createFormRef.current?.resetFields();
        const detail = await getPurchaseRequisition(id);
        const status = (detail.status ?? '').toString().trim();
        if (!['草稿', 'draft', 'DRAFT'].includes(status)) {
          messageApi.error(t('app.kuaizhizao.purchaseRequisition.onlyDraftEditable'));
          leavePurchaseRequisitionFormPage();
          return;
        }
        const applicantUuid = await resolveUserUuidById(detail.applicant_id);
        const baseValues = {
          requisition_code: detail.requisition_code ?? '',
          requisition_name: detail.requisition_name,
          requisition_date: detail.requisition_date ? dayjs(detail.requisition_date) : dayjs(),
          applicant_uuid: applicantUuid,
          applicant_id: detail.applicant_id,
          applicant_name: detail.applicant_name ?? '',
          required_date: detail.required_date ? dayjs(detail.required_date) : undefined,
          notes: detail.notes,
          attachments: mapAttachmentsToUploadList(detail.attachments),
          items:
            detail.items && detail.items.length > 0
              ? detail.items.map((it) => ({
                  material_id: it.material_id,
                  material_code: it.material_code ?? '',
                  material_name: it.material_name ?? '',
                  material_spec: it.material_spec ?? '',
                  unit: it.unit ?? '件',
                  quantity: Number(it.quantity ?? 1),
                  suggested_unit_price: Number(it.suggested_unit_price ?? 0),
                  required_date: it.required_date ? dayjs(it.required_date) : undefined,
                  demand_computation_item_id: it.demand_computation_item_id,
                  supplier_id: it.supplier_id,
                  notes: it.notes,
                }))
              : [{ ...INITIAL_PR_FORM_ITEM_ROW }],
        };
        createFormRef.current?.setFieldsValue(baseValues);
        if (draftSnapshot && Object.keys(draftSnapshot).length > 0) {
          createFormRef.current?.setFieldsValue(draftSnapshot);
        }
      } catch {
        messageApi.error(t('app.kuaizhizao.purchaseRequisition.loadFailed'));
        leavePurchaseRequisitionFormPage();
      } finally {
        prFormHydratingRef.current = false;
      }
    },
    [messageApi, ensureSupplierList, leavePurchaseRequisitionFormPage, t, prFormDraftKey],
  );

  const handleEdit = useCallback(
    (record: PurchaseRequisition) => {
      const s = (record.status ?? '').toString().trim();
      if (!['草稿', 'draft', 'DRAFT'].includes(s) || record.id == null) return;
      navigate(purchaseRequisitionEditPath(record.id));
    },
    [navigate],
  );

  const lifecycleValueEnum = useMemo(
    () => buildPurchaseRequisitionLifecycleValueEnum(purchaseRequestAuditEnabled),
    [purchaseRequestAuditEnabled],
  );
  const purchaseRequisitionAuditColumn = useMemo(
    () => createListAuditPhaseColumn<PurchaseRequisition>({ t, auditEnabled: purchaseRequestAuditEnabled }),
    [t, purchaseRequestAuditEnabled],
  );
  const resolveRequisitionPushPercent = useCallback((record: PurchaseRequisition): number => {
    const stageName = String(getPurchaseRequisitionLifecycle(record, purchaseRequestAuditEnabled).stageName ?? '').trim();
    const status = String(record.status ?? '').trim();
    if (stageName === '全部转单' || status === '全部转单' || status === 'FULL_CONVERTED') return 100;
    if (stageName === '部分转单' || status === '部分转单' || status === 'PARTIAL_CONVERTED') return 50;
    return 0;
  }, [purchaseRequestAuditEnabled]);

  const defaultApplicantFields = useCallback(() => {
    if (!currentUser) return {};
    return {
      applicant_uuid: currentUser.uuid,
      applicant_id: currentUser.id,
      applicant_name: currentUser.full_name || currentUser.username || '',
    };
  }, [currentUser]);

  const applyCreateFormDefaults = useCallback(
    (values: Record<string, unknown>) => {
      prFormHydratingRef.current = true;
      try {
        createFormRef.current?.setFieldsValue({
          ...defaultApplicantFields(),
          ...values,
        });
      } finally {
        prFormHydratingRef.current = false;
      }
    },
    [defaultApplicantFields],
  );

  const initPurchaseRequisitionCreateForm = useCallback(async () => {
    void ensureSupplierList();
    const draft = prFormDraftKey ? getDocumentFormDraft(prFormDraftKey) : null;
    if (draft && Object.keys(draft).length > 0) {
      applyCreateFormDefaults(draft);
      return;
    }
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    prFormHydratingRef.current = true;
    try {
      createFormRef.current?.resetFields();
    } finally {
      prFormHydratingRef.current = false;
    }
    try {
      const config = await getCodeRulePageConfig('kuaizhizao-purchase-requisition');
      const autoGen = config?.autoGenerate ?? isAutoGenerateEnabled('kuaizhizao-purchase-requisition');
      const ruleCode = config?.ruleCode ?? getPageRuleCode('kuaizhizao-purchase-requisition');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(autoGen);
      if (autoGen && ruleCode) {
        try {
          const res = await testGenerateCode({ rule_code: ruleCode });
          const preview = res.code;
          setPreviewCode(preview ?? null);
          applyCreateFormDefaults({
            requisition_code: preview ?? '',
            requisition_date: dayjs(),
            items: initialCreateItems,
          });
        } catch (e) {
          console.warn('采购申请编号预生成失败:', e);
          setPreviewCode(null);
          applyCreateFormDefaults({
            requisition_date: dayjs(),
            items: initialCreateItems,
          });
        }
      } else {
        setPreviewCode(null);
        applyCreateFormDefaults({
          requisition_date: dayjs(),
          items: initialCreateItems,
        });
      }
    } catch {
      const ruleCode = getPageRuleCode('kuaizhizao-purchase-requisition');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(isAutoGenerateEnabled('kuaizhizao-purchase-requisition'));
      if (isAutoGenerateEnabled('kuaizhizao-purchase-requisition') && ruleCode) {
        try {
          const res = await testGenerateCode({ rule_code: ruleCode });
          const preview = res.code;
          setPreviewCode(preview ?? null);
          applyCreateFormDefaults({
            requisition_code: preview ?? '',
            requisition_date: dayjs(),
            items: initialCreateItems,
          });
        } catch (e) {
          console.warn('采购申请编号预生成失败:', e);
          setPreviewCode(null);
          applyCreateFormDefaults({
            requisition_date: dayjs(),
            items: initialCreateItems,
          });
        }
      } else {
        setPreviewCode(null);
        applyCreateFormDefaults({
          requisition_date: dayjs(),
          items: initialCreateItems,
        });
      }
    }
  }, [ensureSupplierList, prFormDraftKey, applyCreateFormDefaults, initialCreateItems]);

  const handleCreate = () => {
    navigate(PURCHASE_REQUISITION_CREATE_PATH);
  };

  useEffect(() => {
    if (!isFormPage) {
      formPageInitKeyRef.current = null;
      return;
    }
    const title = isCreatePage
      ? t('app.kuaizhizao.menu.purchase-management.purchase-requisitions.new')
      : t('app.kuaizhizao.menu.purchase-management.purchase-requisitions.edit');
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
    if (!isFormPage) return;
    const initKey = isCreatePage ? 'create' : `edit-${editRouteId}`;
    if (formPageInitKeyRef.current === initKey) return;
    formPageInitKeyRef.current = initKey;
    if (isCreatePage) {
      void initPurchaseRequisitionCreateForm();
    } else if (editRouteId != null) {
      void loadPurchaseRequisitionEditForm(editRouteId);
    }
  }, [isFormPage, isCreatePage, editRouteId, initPurchaseRequisitionCreateForm, loadPurchaseRequisitionEditForm]);

  useEffect(() => {
    if (!isFormPage || !prFormDraftKey) return;
    return () => {
      const values = createFormRef.current?.getFieldsValue?.(true);
      if (values && Object.keys(values).length > 0) {
        setDocumentFormDraft(prFormDraftKey, values);
      }
    };
  }, [isFormPage, prFormDraftKey]);

  const pullFromComputationColumns: ProColumns<PullDemandComputationCandidate>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseRequisition.pull.computationCode'),
        dataIndex: 'computation_code',
        width: 168,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.salesOrder.materialName'),
        dataIndex: 'material_name',
        ellipsis: true,
        render: (_, record) => (
          <MaterialStackedCell
            material_name={record.material_name}
            material_code={record.material_code}
            material_spec={record.material_spec}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.pull.businessMode'),
        dataIndex: 'business_mode',
        width: 100,
        align: 'center',
        render: (v) => renderDemandBusinessModeMarkerTag(t, v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.quantity'),
        dataIndex: 'suggested_quantity',
        width: 100,
        align: 'right',
        render: (v) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.colShippedQty'),
        dataIndex: 'pushed_quantity',
        width: 100,
        align: 'right',
        render: (v) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.salesOrder.colShippableQty'),
        dataIndex: 'remaining_quantity',
        width: 100,
        align: 'right',
        render: (v) => formatQuantity(v),
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.col.requiredDate'),
        dataIndex: 'required_date',
        width: 112,
        render: (v) => (v ? formatBusinessDateOnly(v) : '-'),
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.pull.convertStatus'),
        key: 'convert_status',
        width: 100,
        align: 'center',
        render: (_, record) =>
          renderPullCapabilityTag(
            Number(record.remaining_quantity ?? 0) > 0,
            t('app.kuaizhizao.purchaseRequisition.pull.canCreate'),
            t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate'),
          ),
      },
    ],
    [t],
  );

  const isPullComputationSelectable = useCallback(
    (record: PullDemandComputationCandidate) => Number(record.remaining_quantity ?? 0) > 0,
    [],
  );

  const pullDocumentScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromComputationQuery = useUniPullQuery<PullDemandComputationCandidate>({
    rowKey: 'id',
    selectionType: 'checkbox',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    onOpen: () => {
      pullSourceComputationIdRef.current = undefined;
      setPullSourceComputationId(undefined);
      void listDemandComputations({
        skip: 0,
        limit: 100,
        computation_status: '完成',
        view: 'options',
      })
        .then((res) => {
          setPullSourceOptions(
            (res?.data ?? [])
              .filter((row) => row.id != null && row.computation_code)
              .map((row) => ({ value: row.id!, label: String(row.computation_code) })),
          );
        })
        .catch((error: unknown) => {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseRequisition.pull.loadSourceFailed')));
          setPullSourceOptions([]);
        });
    },
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const listRes = await listDemandComputationPurchasePullLines({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
          computation_id: pullSourceComputationIdRef.current,
          pullable_only: isPullableScope(scope),
        });
        return { data: listRes?.data ?? [], total: listRes?.total ?? 0 };
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseRequisition.pull.failed')));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => !isPullComputationSelectable(record),
    onConfirm: async (_keys, rows) => {
      const selectedIds = rows
        .filter((row) => isPullComputationSelectable(row))
        .map((row) => Number(row.id))
        .filter((id) => id > 0);
      if (!selectedIds.length) {
        messageApi.warning(t('app.kuaizhizao.purchaseRequisition.pull.selectLinesFirst'));
        return;
      }
      try {
        const res = await pullPurchaseRequisitionFromDemandComputationItems(selectedIds);
        messageApi.success(res?.message || t('app.kuaizhizao.purchaseRequisition.pull.success'));
        pullFromComputationQuery.closeModal();
        actionRef.current?.reload();
        invalidateMenuBadgeCounts();
      } catch (error: unknown) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseRequisition.pull.failed')));
      }
    },
  });

  const mapItemsForApi = (
    validItems: Array<{
      material_id?: number;
      material_code?: string;
      material_name?: string;
      material_spec?: string;
      unit?: string;
      quantity?: number;
      suggested_unit_price?: number;
      required_date?: any;
      demand_computation_item_id?: number;
      supplier_id?: number;
      notes?: string;
    }>
  ) =>
    validItems.map((i) => ({
      material_id: i.material_id!,
      material_code: i.material_code || '',
      material_name: i.material_name || '',
      material_spec: i.material_spec,
      unit: i.unit || '件',
      quantity: Number(i.quantity) || 0,
      suggested_unit_price: Number(i.suggested_unit_price) || 0,
      required_date: i.required_date?.format?.('YYYY-MM-DD') ?? i.required_date ?? undefined,
      demand_computation_item_id: i.demand_computation_item_id,
      supplier_id: i.supplier_id ?? undefined,
      notes: typeof i.notes === 'string' && i.notes.trim() ? i.notes.trim() : undefined,
    }));

  const handleModalSubmit = async (values: {
    requisition_code?: string;
    requisition_name?: string;
    requisition_date?: any;
    required_date?: any;
    applicant_id?: number;
    applicant_name?: string;
    notes?: string;
    attachments?: unknown;
    items?: Array<{
      material_id?: number;
      material_code?: string;
      material_name?: string;
      material_spec?: string;
      unit?: string;
      quantity?: number;
      suggested_unit_price?: number;
      required_date?: any;
      demand_computation_item_id?: number;
      supplier_id?: number;
      notes?: string;
    }>;
  }) => {
    const requisitionDate =
      values.requisition_date?.format?.('YYYY-MM-DD') ?? values.requisition_date ?? undefined;
    const requiredDate = values.required_date?.format?.('YYYY-MM-DD') ?? values.required_date;
    const validItems = (values.items ?? []).filter((i) => i.material_id && (Number(i.quantity) || 0) > 0);
    if (validItems.length === 0) {
      messageApi.error(t('app.kuaizhizao.purchaseRequisition.atLeastOneItem'));
      return;
    }
    if (editingId != null) {
      try {
        await updatePurchaseRequisition(editingId, {
          requisition_name: values.requisition_name,
          requisition_date: requisitionDate,
          required_date: requiredDate,
          applicant_id: values.applicant_id,
          applicant_name: values.applicant_name,
          notes: values.notes,
          attachments: normalizeDocumentAttachments(values.attachments),
          items: mapItemsForApi(validItems),
        });
        messageApi.success(t('common.save'));
        if (prFormDraftKey) clearDocumentFormDraft(prFormDraftKey);
        setEffectiveRuleCode(null);
        setEffectiveAutoGen(null);
        createFormRef.current?.resetFields();
        invalidateMenuBadgeCounts();
        if (isFormPage) {
          leavePurchaseRequisitionFormPage();
        }
        actionRef.current?.reload();
      } catch (e: any) {
        const d = e?.response?.data?.detail;
        messageApi.error(typeof d === 'string' ? d : d?.message || t('common.saveFailed'));
        throw e;
      }
      return;
    }
    let requisitionCode = values.requisition_code;
    const ruleCode = effectiveRuleCode || getPageRuleCode('kuaizhizao-purchase-requisition');
    const autoGen = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-purchase-requisition');
    if (autoGen && ruleCode && (requisitionCode === previewCode || !requisitionCode)) {
      try {
        const res = await generateCode({ rule_code: ruleCode });
        requisitionCode = res.code;
      } catch (e) {
        console.warn('采购申请编号正式生成失败，使用当前值:', e);
      }
    }
    try {
      await createPurchaseRequisition({
        requisition_code: requisitionCode || undefined,
        requisition_name: values.requisition_name,
        requisition_date: requisitionDate,
        required_date: requiredDate,
        applicant_id: values.applicant_id,
        applicant_name: values.applicant_name,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: mapItemsForApi(validItems),
      });
      messageApi.success(t('common.createSuccess'));
      if (prFormDraftKey) clearDocumentFormDraft(prFormDraftKey);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      createFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      if (isFormPage) {
        leavePurchaseRequisitionFormPage();
      }
      actionRef.current?.reload();
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      messageApi.error(typeof d === 'string' ? d : d?.message || t('common.createFailed'));
      throw e;
    }
  };

  const handleDetail = async (record: PurchaseRequisition) => {
    try {
      void ensureSupplierList();
      const detail = await getPurchaseRequisition(record.id!);
      void prefetchMaterialsForUnitSelect((detail.items ?? []).map((i) => i.material_id));
      setCurrentReq(detail);
      setDetailVisible(true);
      setPrTrackingRefreshKey((k) => k + 1);
    } catch {
      messageApi.error(t('app.kuaizhizao.purchaseRequisition.detailFailed'));
    }
  };

  // handleSubmit removed as it is redundant with UniWorkflowActions

  const convertFormRef = React.useRef<{
    selectedIds: number[];
    supplierId: number;
    supplierName: string;
    itemQuantities: Record<number, number>;
    itemUnitPrices: Record<number, number>;
    itemSuppliers: Record<number, number>;
    persistDefaultSupplier: boolean;
  }>({
    selectedIds: [],
    supplierId: 0,
    supplierName: '',
    itemQuantities: {},
    itemUnitPrices: {},
    itemSuppliers: {},
    persistDefaultSupplier: false,
  });

  const selectedRequisitionForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return tableRowsRef.current.find((row) => row.id === id) ?? null;
  }, [selectedRowKeys]);

  const canPushPurchaseOrder = !!selectedRequisitionForToolbar?.capabilities?.push_purchase_order?.allowed;
  const canPushInquiry = !!selectedRequisitionForToolbar?.capabilities?.push_inquiry?.allowed;
  const toolbarPushDisabledReason = useMemo(() => {
    const base = buildUniPushToolbarDisabledReason(t, {
      selectedCount: selectedRowKeys.length,
      hasSelectedRecord: !!selectedRequisitionForToolbar,
    });
    if (base) return base;
    if (selectedRequisitionForToolbar && !canPushPurchaseOrder && !canPushInquiry) {
      return (
        purchaseRequisitionCapabilityReasonMessage(
          selectedRequisitionForToolbar.capabilities?.push_purchase_order?.reason
            || selectedRequisitionForToolbar.capabilities?.push_inquiry?.reason,
          t,
        ) || t('app.kuaizhizao.purchaseRequisition.push.flowBlocked', { flowClass: '-' })
      );
    }
    return undefined;
  }, [canPushInquiry, canPushPurchaseOrder, selectedRequisitionForToolbar, selectedRowKeys.length, t]);

  const resetPushPoPreviewModal = useCallback(() => {
    setPushPoPreviewOpen(false);
    setPushPoPreviewData(null);
    setPushPoTarget(null);
    setPushPoDetailItems([]);
    setPushPoSuppliers([]);
  }, []);

  const resetPushInquiryPreviewModal = useCallback(() => {
    setPushInquiryPreviewOpen(false);
    setPushInquiryPreviewData(null);
    setPushInquiryTarget(null);
    setPushInquirySelectedItemIds([]);
  }, []);

  const setupConvertFormFromDetail = useCallback(
    (
      allItems: PurchaseRequisitionItem[],
      unconverted: PurchaseRequisitionItem[],
      suppliers: Array<{ id: number; code?: string; name: string }>,
    ) => {
      const defaultSupplierId = unconverted[0]?.supplier_id || suppliers[0]?.id;
      const quantities: Record<number, number> = {};
      const unitPrices: Record<number, number> = {};
      unconverted.forEach((i) => {
        if (i.id != null) {
          quantities[i.id] = Number(i.quantity ?? 0);
          unitPrices[i.id] = Number(i.suggested_unit_price ?? 0);
        }
      });
      convertFormRef.current = {
        selectedIds: unconverted.map((i) => i.id!).filter(Boolean),
        supplierId: defaultSupplierId || 0,
        supplierName: suppliers.find((s) => s.id === defaultSupplierId)?.name || suppliers[0]?.name || '',
        itemQuantities: quantities,
        itemUnitPrices: unitPrices,
        itemSuppliers: {},
        persistDefaultSupplier: false,
      };
    },
    [],
  );

  const openPushPoPreview = useCallback(
    async (record: PurchaseRequisition) => {
      if (!record.id) return;
      setPushPoPreviewOpen(true);
      setPushPoPreviewLoading(true);
      setPushPoPreviewConfirming(false);
      setPushPoPreviewData(null);
      setPushPoTarget(record);
      setPushPoDetailItems([]);
      setPushPoSuppliers([]);
      try {
        const preview = await previewPushToPurchaseOrder(record.id);
        setPushPoPreviewData(preview);
        if (preview.has_blocking_issues) return;
        const suppliers = await ensureSupplierList();
        if (!suppliers.length) {
          messageApi.warning(t('app.kuaizhizao.purchaseRequisition.maintainSupplierFirst'));
          resetPushPoPreviewModal();
          return;
        }
        const detail = await getPurchaseRequisition(record.id);
        const pushableIds = new Set((preview.items || []).map((row) => Number(row.item_id)));
        const allItems = detail.items || [];
        const unconverted = allItems.filter((i) => i.id != null && pushableIds.has(i.id!) && !i.purchase_order_id);
        if (unconverted.length === 0) {
          messageApi.info(t('app.kuaizhizao.purchaseRequisition.noPushLines'));
          resetPushPoPreviewModal();
          return;
        }
        setupConvertFormFromDetail(allItems, unconverted, suppliers);
        setPushPoDetailItems(allItems);
        setPushPoSuppliers(suppliers);
      } catch (error: any) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseRequisition.loadDetailFailed')));
        resetPushPoPreviewModal();
      } finally {
        setPushPoPreviewLoading(false);
      }
    },
    [ensureSupplierList, messageApi, resetPushPoPreviewModal, setupConvertFormFromDetail, t],
  );

  const handlePushPoPreviewConfirm = useCallback(async () => {
    if (!pushPoTarget?.id || !pushPoPreviewData || pushPoPreviewData.has_blocking_issues) return;
    const {
      selectedIds,
      supplierId,
      supplierName,
      itemQuantities,
      itemUnitPrices,
      itemSuppliers,
      persistDefaultSupplier,
    } = convertFormRef.current;
    if (selectedIds.length === 0) {
      messageApi.error(t('app.kuaizhizao.purchaseRequisition.selectPushLines'));
      return;
    }
    if (selectedIds.some((id) => !itemSuppliers[id])) {
      messageApi.error(t('app.kuaizhizao.purchaseRequisition.selectLineSupplier'));
      return;
    }
    if (
      selectedIds.some((id) => {
        const price = itemUnitPrices[id];
        return price == null || !Number.isFinite(price) || price < 0;
      })
    ) {
      messageApi.error(t('app.kuaizhizao.purchaseRequisition.convert.invalidUnitPrice'));
      return;
    }
    setPushPoPreviewConfirming(true);
    try {
      const res = await convertToPurchaseOrder(pushPoTarget.id, {
        item_ids: selectedIds,
        supplier_id: supplierId || undefined,
        supplier_name: supplierName || undefined,
        item_quantities: itemQuantities,
        item_unit_prices: Object.fromEntries(selectedIds.map((id) => [id, itemUnitPrices[id] ?? 0])),
        item_suppliers: Object.fromEntries(selectedIds.map((id) => [id, itemSuppliers[id]])),
        persist_default_supplier_to_material: persistDefaultSupplier,
      });
      const pos = res.purchase_orders?.length
        ? res.purchase_orders
        : [{ purchase_order_id: res.purchase_order_id, purchase_order_code: res.purchase_order_code, supplier_id: supplierId }];
      const codes = pos.map((p) => p.purchase_order_code).filter(Boolean).join('、');
      messageApi.success(
        codes
          ? `${res.message || t('app.kuaizhizao.purchaseRequisition.pushSuccess')}：${codes}`
          : (res.message || t('app.kuaizhizao.purchaseRequisition.pushSuccess')),
        6,
      );
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
      resetPushPoPreviewModal();
      setSelectedRowKeys([]);
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseRequisition.pushFailed')));
    } finally {
      setPushPoPreviewConfirming(false);
    }
  }, [invalidateMenuBadgeCounts, messageApi, pushPoPreviewData, pushPoTarget, resetPushPoPreviewModal, t]);

  const openPushInquiryPreview = useCallback(
    async (record: PurchaseRequisition) => {
      if (!record.id) return;
      setPushInquiryPreviewOpen(true);
      setPushInquiryPreviewLoading(true);
      setPushInquiryPreviewConfirming(false);
      setPushInquiryPreviewData(null);
      setPushInquiryTarget(record);
      setPushInquirySelectedItemIds([]);
      try {
        const preview = await previewPushToInquiry(record.id);
        setPushInquiryPreviewData(preview);
        const ids = (preview.items || [])
          .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
          .map((row) => Number(row.item_id));
        setPushInquirySelectedItemIds(ids);
      } catch (error: any) {
        messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseRequisition.loadDetailFailed')));
        resetPushInquiryPreviewModal();
      } finally {
        setPushInquiryPreviewLoading(false);
      }
    },
    [messageApi, resetPushInquiryPreviewModal, t],
  );

  const handlePushInquiryPreviewConfirm = useCallback(async () => {
    if (!pushInquiryTarget?.id || !pushInquiryPreviewData || pushInquiryPreviewData.has_blocking_issues) return;
    const selectedIds = pushInquirySelectedItemIds.filter((id) =>
      (pushInquiryPreviewData.items || []).some((row) => Number(row.item_id) === id && Number(row.max_push_quantity ?? 0) > 0),
    );
    if (!selectedIds.length) {
      messageApi.warning(t('app.kuaizhizao.purchaseRequisition.selectPushLines'));
      return;
    }
    setPushInquiryPreviewConfirming(true);
    try {
      const doc = await createInquiryFromRequisition(pushInquiryTarget.id, { item_ids: selectedIds });
      messageApi.success(t('app.kuaizhizao.purchaseRequisition.inquiryCreated', { code: doc.inquiry_code }));
      navigate(`${ROUTES.PURCHASE_INQUIRIES}?inquiryId=${doc.id}`);
      actionRef.current?.reload();
      resetPushInquiryPreviewModal();
      setSelectedRowKeys([]);
    } catch (error: any) {
      messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseRequisition.inquiryCreateFailed')));
    } finally {
      setPushInquiryPreviewConfirming(false);
    }
  }, [
    messageApi,
    navigate,
    pushInquiryPreviewData,
    pushInquirySelectedItemIds,
    pushInquiryTarget,
    resetPushInquiryPreviewModal,
    t,
  ]);

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) return;
    try {
      for (const id of keys) {
        await deletePurchaseRequisition(Number(id));
      }
      messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || t('common.deleteFailed'));
    }
  };

  /** 协调看板深链：requisitionId + action=pushPO */
  useEffect(() => {
    const requisitionIdRaw = searchParams.get('requisitionId');
    if (!requisitionIdRaw) return;

    const action = searchParams.get('action');
    const linkKey = `${requisitionIdRaw}:${action ?? ''}`;
    if (deepLinkHandledRef.current === linkKey) return;

    const requisitionId = Number(requisitionIdRaw);
    if (Number.isNaN(requisitionId) || requisitionId <= 0) return;

    deepLinkHandledRef.current = linkKey;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('requisitionId');
    nextParams.delete('action');
    const nextSearch = nextParams.toString();
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
      { replace: true },
    );

    if (action === 'pushPO') {
      setSelectedRowKeys([requisitionId]);
      void (async () => {
        try {
          await ensureSupplierList();
          const detail = await getPurchaseRequisition(requisitionId);
          void prefetchMaterialsForUnitSelect((detail.items ?? []).map((i) => i.material_id));
          setCurrentReq(detail);
          await openPushPoPreview({ ...detail, id: requisitionId });
        } catch {
          messageApi.error(t('app.kuaizhizao.purchaseRequisition.openFailed'));
        }
      })();
      return;
    }

    if (action === 'pushInquiry') {
      setSelectedRowKeys([requisitionId]);
      void (async () => {
        try {
          const detail = await getPurchaseRequisition(requisitionId);
          void prefetchMaterialsForUnitSelect((detail.items ?? []).map((i) => i.material_id));
          setCurrentReq(detail);
          await openPushInquiryPreview({ ...detail, id: requisitionId });
        } catch {
          messageApi.error(t('app.kuaizhizao.purchaseRequisition.openFailed'));
        }
      })();
      return;
    }

    void (async () => {
      try {
        const detail = await getPurchaseRequisition(requisitionId);
        void prefetchMaterialsForUnitSelect((detail.items ?? []).map((i) => i.material_id));
        setCurrentReq(detail);
        setDetailVisible(true);
        setPrTrackingRefreshKey((k) => k + 1);
      } catch {
        messageApi.error(t('app.kuaizhizao.purchaseRequisition.openFailed'));
        deepLinkHandledRef.current = null;
      }
    })();
  }, [searchParams, location.pathname, navigate, messageApi, ensureSupplierList, openPushInquiryPreview, openPushPoPreview, t]);

  const toolbarPushMenuItems = useMemo(() => {
    const pushPoBlockedReason = selectedRequisitionForToolbar && !canPushPurchaseOrder
      ? purchaseRequisitionCapabilityReasonMessage(
          selectedRequisitionForToolbar.capabilities?.push_purchase_order?.reason,
          t,
        )
      : undefined;
    const pushInquiryBlockedReason = selectedRequisitionForToolbar && !canPushInquiry
      ? purchaseRequisitionCapabilityReasonMessage(
          selectedRequisitionForToolbar.capabilities?.push_inquiry?.reason,
          t,
        )
      : undefined;
    return buildUniPushMenuItems([
      {
        key: 'push-purchase-order',
        label: pushToPurchaseOrderAction.label,
        disabled: !selectedRequisitionForToolbar || !canPushPurchaseOrder,
        title: pushPoBlockedReason,
        onClick: () => {
          if (selectedRequisitionForToolbar && canPushPurchaseOrder) {
            void openPushPoPreview(selectedRequisitionForToolbar);
          }
        },
      },
      {
        key: 'push-inquiry',
        label: pushToInquiryAction.label,
        disabled: !selectedRequisitionForToolbar || !canPushInquiry,
        title: pushInquiryBlockedReason,
        onClick: () => {
          if (selectedRequisitionForToolbar && canPushInquiry) {
            void openPushInquiryPreview(selectedRequisitionForToolbar);
          }
        },
      },
    ]);
  }, [
    canPushInquiry,
    canPushPurchaseOrder,
    openPushInquiryPreview,
    openPushPoPreview,
    pushToInquiryAction.label,
    pushToPurchaseOrderAction.label,
    selectedRequisitionForToolbar,
    t,
  ]);

  const handleDeleteOne = (record: PurchaseRequisition) => {
    if (record.status !== '草稿') return;
    modalApi.confirm({
      title: t('app.kuaizhizao.purchaseRequisition.confirmDelete'),
      content: t('app.kuaizhizao.purchaseRequisition.confirmDeleteContent', { code: record.requisition_code }),
      onOk: async () => {
        try {
          await deletePurchaseRequisition(record.id!);
          messageApi.success(t('common.deleteSuccess'));
          if (currentReq?.id === record.id) {
            setDetailVisible(false);
            setCurrentReq(null);
          }
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.response?.data?.detail || t('common.deleteFailed'));
        }
      },
    });
  };

  const columns: ProColumns<PurchaseRequisition>[] = useMemo(() => alignProColumns<PurchaseRequisition>([
    // 仅高级搜索、不在表身展示；必须放在最前，避免夹在可滚动列与右侧 fixed 列之间导致固定列顺序异常
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.requiredDateRange'),
      dataIndex: 'required_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
      search: {
        transform: (value: any) => {
          if (!value || !Array.isArray(value)) return {};
          const [a, b] = value;
          return {
            required_date_from: a ? formatDateTime(a, 'YYYY-MM-DD') : undefined,
            required_date_to: b ? formatDateTime(b, 'YYYY-MM-DD') : undefined,
          };
        },
      },
    },
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.nameAndCode'),
      key: 'requisition_code',
      dataIndex: 'requisition_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      width: 320,
      minWidth: 320,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: false,
      onCell: () => ({
        style: {
          maxWidth: 320,
          overflow: 'hidden',
        },
      }),
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.requisition_name ?? '')}
          secondary={String(record.requisition_code ?? '')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.code'),
      dataIndex: 'requisition_code',
      hideInTable: true,
      hideInSearch: false,
    },
    { title: t('app.kuaizhizao.purchaseRequisition.col.name'), dataIndex: 'requisition_name', hideInTable: true, hideInSearch: false, ellipsis: true },
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.sourceCode'),
      dataIndex: 'source_code',
      hideInTable: true,
      hideInSearch: false,
      ellipsis: true,
    },
    {
      title: `${t('app.kuaizhizao.purchaseRequisition.col.sourceType')} / ${t('app.kuaizhizao.purchaseRequisition.col.sourceCode')}`,
      dataIndex: 'source_type',
      width: 180,
      uniTableKeepWidth: true,
      hideInSearch: false,
      ellipsis: true,
      valueEnum: {
        DemandComputation: {
          text: formatPurchaseRequisitionSourceType('DemandComputation', t),
        },
      },
      render: (_, record) => {
        const sourceCode = String(record.source_code ?? '').trim();
        if (!sourceCode) {
          return t('app.kuaizhizao.purchaseRequisition.col.sourceTypeActiveRequest');
        }
        return (
          <Space direction="vertical" size={0} style={{ lineHeight: 1.35 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatPurchaseRequisitionSourceType(record.source_type, t)}
            </Typography.Text>
            <SourceDocumentCode
              sourceType={record.source_type}
              sourceId={record.source_id}
              sourceCode={sourceCode}
            />
          </Space>
        );
      },
    },
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.requiredDate'),
      dataIndex: 'required_date',
      valueType: 'date',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
      dataIndex: 'downstream_push_progress',
      ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
      render: (_, record) => (
        <DocumentPushProgressBar percent={resolveRequisitionPushPercent(record)} />
      ),
    },
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.quantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
      hideInSearch: true,
      render: (_, record) =>
        formatQuantity(record.total_quantity),
    },
    {
      title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      hideInSearch: true,
      render: (_, record) =>
        record.total_amount != null ? `¥${formatNumber(record.total_amount, 2)}` : '-',
    },
    ...buildDocumentAuditColumns<PurchaseRequisition>(t),
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
    ...(purchaseRequisitionAuditColumn ? [purchaseRequisitionAuditColumn] : []),
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.lifecycle'),
      key: 'lifecycle',
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      fixed: 'right',
      hideInSearch: false,
      valueEnum: lifecycleValueEnum,
      render: (_, record) => (
        <ListUniLifecycleCell
          lifecycle={getPurchaseRequisitionLifecycle(record, purchaseRequestAuditEnabled)}
          withSubStages
        />
      ),
    },
    {
      title: t('common.actions'),
      key: 'option',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const s = (record.status ?? '').toString().trim();
        const isDraft = ['草稿', 'draft', 'DRAFT'].includes(s);
        const parts: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="d" onClick={() => handleDetail(record)}>
            {t('common.detail')}
          </Button>,
        ];
        if (isDraft) {
          parts.push(
            <Button {...rowActionKind('update')} key="e" onClick={() => handleEdit(record)}>
              {t('common.edit')}
            </Button>
          );
        }
        parts.push(
          <span {...rowActionKind('skip')} key="wf">
            <UniWorkflowActions {...rowActionKind('skip')}
              record={record}
              entityName={t('app.kuaizhizao.purchaseRequisition.entityName')}
              statusField="status"
              reviewStatusField="review_status"
              draftStatuses={['草稿', 'draft', 'DRAFT']}
              pendingStatuses={['待审核', 'pending_review', 'PENDING_REVIEW']}
              approvedStatuses={['已通过', '已审核', '部分转单', '全部转单', 'audited', 'approved', 'AUDITED', 'PARTIAL_CONVERTED', 'FULL_CONVERTED']}
              rejectedStatuses={['已驳回', 'rejected', 'REJECTED']}
              theme="link"
              size="small"
              confirmMessages={{ revoke: t('app.kuaizhizao.purchaseRequisition.workflowRevokeConfirm') }}
              onSuccess={() => {
                invalidateMenuBadgeCounts();
                actionRef.current?.reload();
                if (detailVisible && currentReq?.id === record.id && record.id != null) {
                  void getPurchaseRequisition(record.id)
                    .then((res) => {
                      setCurrentReq(res);
                      setPrTrackingRefreshKey((k) => k + 1);
                    })
                    .catch(() => {});
                }
              }}
            />
          </span>
        );
        if (isDraft) {
          parts.push(
            <Button {...rowActionKind('delete')} key="del" onClick={() => handleDeleteOne(record)}>
              {t('common.delete')}
            </Button>
          );
        }
        return parts;
      },
    },
  ], SALES_DOC_LIST_FIELD_RANK), [t, purchaseRequestAuditEnabled, purchaseRequisitionAuditColumn, lifecycleValueEnum, handleDetail, handleEdit, handleDeleteOne, resolveRequisitionPushPercent, detailVisible, currentReq?.id, invalidateMenuBadgeCounts]);

  const detailTableColumns: ProColumns<PurchaseRequisitionItemRow>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseRequisition.col.nameAndCode'),
        key: 'requisition_code',
        dataIndex: 'requisition_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        hideInSearch: false,
        fieldProps: { placeholder: t('app.kuaizhizao.purchaseRequisition.col.code') },
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.requisition_name ?? '')}
            secondary={String(record.requisition_code ?? '')}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.col.code'),
        dataIndex: 'requisition_code',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.col.name'),
        dataIndex: 'requisition_name',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.col.materialName'),
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
        title: t('app.kuaizhizao.purchaseRequisition.col.materialCode'),
        dataIndex: 'material_code',
        hideInTable: true,
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.col.quantity'),
        dataIndex: 'quantity',
        width: 120,
        align: 'right',
        render: (val: unknown, record) => (
          <QuantityWithUnitDisplay quantity={val} unit={record.unit} />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.col.suggestedPrice'),
        dataIndex: 'suggested_unit_price',
        width: 100,
        align: 'right',
        render: (text: unknown) =>
          text != null ? `¥${formatNumber(text, priceDecimals)}` : '-',
      },
      {
        title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
        key: 'line_amount',
        width: 110,
        align: 'right',
        render: (_: unknown, record) => {
          const qty = Number(record.quantity ?? 0);
          const price = Number(record.suggested_unit_price ?? 0);
          return `¥${formatNumber(qty * price, amountDecimals)}`;
        },
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.col.requiredDate'),
        dataIndex: 'required_date',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        render: (_: unknown, row) =>
          row.required_date ? formatDateTime(row.required_date, 'YYYY-MM-DD') : '-',
      },
      {
        title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
        key: 'line_push_progress',
        ...DETAIL_TABLE_PROGRESS_COLUMN_DEFAULTS,
        render: (_: unknown, record) => {
          const ordered = Number(record.quantity ?? 0);
          const pushed =
            Number(record.converted_quantity_confirmed ?? 0) +
            Number(record.converted_quantity_draft ?? 0);
          const percent = ratioToPushProgressPercent(pushed, ordered);
          return (
            <DocumentPushProgressBar
              percent={percent}
              tooltip={t('app.kuaizhizao.salesManagement.pushProgress.percentOnly', { percent })}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.col.lifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        fixed: 'right',
        hideInSearch: false,
        valueEnum: lifecycleValueEnum,
        render: (_: unknown, record) => (
          <ListUniLifecycleCell
            lifecycle={getPurchaseRequisitionLifecycle(record as PurchaseRequisition, purchaseRequestAuditEnabled)}
            withSubStages
          />
        ),
      },
    ],
    [t, lifecycleValueEnum, purchaseRequestAuditEnabled, priceDecimals, amountDecimals],
  );

  const renderPurchaseRequisitionForm = () => (
    <>
      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionBasic')}>
        <div className="document-form-untitled-groups">
          <div className="document-form-untitled-group">
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="requisition_code"
              label={t('app.kuaizhizao.purchaseRequisition.form.code')}
              disabled={editingId != null}
              placeholder={
                editingId != null
                  ? t('app.kuaizhizao.purchaseRequisition.form.codeDraftLocked')
                  : isAutoGenerateEnabled('kuaizhizao-purchase-requisition')
                    ? t('app.kuaizhizao.purchaseRequisition.form.codeAuto')
                    : t('app.kuaizhizao.purchaseRequisition.form.codeManual')
              }
              rules={[{ required: true, message: t('app.kuaizhizao.purchaseRequisition.form.codeManual') }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="requisition_name" label={t('app.kuaizhizao.purchaseRequisition.form.name')} placeholder={t('app.kuaizhizao.purchaseRequisition.form.namePlaceholder')} />
          </Col>
        </Row>
          </div>
          <div className="document-form-untitled-group">
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="requisition_date"
              label={t('app.kuaizhizao.purchaseRequisition.form.date')}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="required_date"
              label={t('app.kuaizhizao.purchaseRequisition.form.requiredDate')}
              fieldProps={buildFutureDateShortcutFieldProps({
                getForm: () => createFormRef.current,
                fieldName: 'required_date',
                baseFieldName: 'requisition_date',
                t,
              })}
            />
          </Col>
        </Row>
          </div>
          <div className="document-form-untitled-group">
        <Row gutter={16}>
          <Col span={12}>
            <EquipmentPersonSelect
              uuidFieldName="applicant_uuid"
              idFieldName="applicant_id"
              nameFieldName="applicant_name"
              label={t('app.kuaizhizao.purchaseRequisition.form.applicant')}
              formRef={createFormRef}
              required
            />
          </Col>
          <Col span={12} />
        </Row>
          </div>
        </div>
      </DetailDrawerSection>

      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionLines')}>
        <UniTableDetail
          name="items"
          title={t('app.kuaizhizao.purchaseRequisition.form.itemsTitle')}
          required
          requiredMessage={t('app.kuaizhizao.purchaseRequisition.form.itemsRequired')}
          headerExtra={(
            <Space size={8}>
              <Button
                type="default"
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                {t('app.kuaizhizao.purchaseRequisition.form.importItems')}
              </Button>
              <Button
                type="default"
                icon={<PlusOutlined />}
                onClick={() => {
                  const items = [...(createFormRef.current?.getFieldValue('items') ?? [])];
                  items.push({ ...INITIAL_PR_FORM_ITEM_ROW });
                  createFormRef.current?.setFieldsValue({ items });
                }}
              >
                {t('app.kuaizhizao.purchaseRequisition.form.addLine')}
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
                    title: t('app.kuaizhizao.purchaseRequisition.form.material'),
                    dataIndex: 'material_id',
                    width: 220,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}
                      >
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback =
                            mid && (row?.material_code || row?.material_name)
                              ? {
                                  value: mid,
                                  label:
                                    `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid),
                                }
                              : undefined;
                          return (
                            <>
                              <div
                                className="uni-detail-material-cell"
                                style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}
                              >
                                <div style={{ flex: 1, minWidth: 200 }}>
                                  <UniMaterialSelect
                                    name={[index, 'material_id']}
                                    label=""
                                    placeholder={t('app.kuaizhizao.salesOrder.selectMaterial')}
                                    required
                                    size="small"
                                    listFieldKey={index}
                                    listFieldName="items"
                                    fillMapping={{
                                      material_code: 'mainCode',
                                      material_name: 'name',
                                      material_spec: 'specification',
                                    }}
                                    onChange={(_val, material) => {
                                      if (!material) return;
                                      createFormRef.current?.setFieldValue(
                                        ['items', index, 'unit'],
                                        resolveMaterialScenarioUnit(material, 'purchase'),
                                      );
                                      void applyPurchaseDocumentLineMaterialPricing(
                                        createFormRef.current,
                                        index,
                                        material,
                                        {
                                          asOfField: 'requisition_date',
                                          unitPriceField: 'suggested_unit_price',
                                          includeTaxRate: false,
                                        },
                                      );
                                    }}
                                    fallbackOption={fallback}
                                    formItemProps={{ style: { margin: 0 } }}
                                    showQuickCreate
                                    showAdvancedSearch
                                  skipFuzzyPinyinClientFilter
                                  />
                                </div>
                              </div>
                              <AntForm.Item name={[index, 'demand_computation_item_id']} hidden>
                                <Input type="hidden" />
                              </AntForm.Item>
                            </>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.purchaseRequisition.form.spec'),
                    dataIndex: 'material_spec',
                    width: 120,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                        <Input placeholder={t('app.kuaizhizao.purchaseRequisition.form.spec')} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.purchaseRequisition.form.unit'),
                    dataIndex: 'unit',
                    width: 100,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) =>
                          prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id
                        }
                      >
                        {({ getFieldValue }) => {
                          const materialId = getFieldValue(['items', index, 'material_id']);
                          if (!createFormRef.current) return null;
                          return (
                            <AntForm.Item name={[index, 'unit']} style={{ margin: 0 }}>
                              <DocumentLineUnitSelect
                                form={createFormRef.current}
                                listName="items"
                                rowIndex={index}
                                fields={{ quantity: 'quantity', unit: 'unit' }}
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
                    title: t('app.kuaizhizao.purchaseRequisition.form.quantity'),
                    dataIndex: 'quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        name={[index, 'quantity']}
                        rules={[
                          { required: true, message: t('common.required') },
                          { type: 'number', min: 0.01, message: t('app.kuaizhizao.purchaseRequisition.form.quantityMin') },
                        ]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber placeholder={t('app.kuaizhizao.purchaseRequisition.form.quantity')} min={0} precision={quantityDecimals} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.purchaseRequisition.form.suggestedPrice'),
                    dataIndex: 'suggested_unit_price',
                    width: 130,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) =>
                          prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id
                        }
                      >
                        {({ getFieldValue }: any) => {
                          return (
                            <AntForm.Item name={[index, 'suggested_unit_price']} style={{ margin: 0 }}>
                              <InputNumber placeholder="0" min={0} precision={priceDecimals} style={{ width: 80 }} size="small" />
                            </AntForm.Item>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.purchaseRequisition.form.suggestedSupplier'),
                    dataIndex: 'supplier_id',
                    width: 160,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'supplier_id']} style={{ margin: 0 }}>
                        <Select
                          allowClear
                          placeholder={t('app.kuaizhizao.purchaseRequisition.form.optional')}
                          size="small"
                          style={{ width: '100%' }}
                          options={supplierList.map((s) => ({ label: s.name, value: s.id }))}
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.purchaseRequisition.form.lineDelivery'),
                    dataIndex: 'required_date',
                    width: 118,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'required_date']} style={{ margin: 0 }}>
                        <FutureDatePicker
                          size="small"
                          style={{ width: '100%' }}
                          placeholder={t('app.kuaizhizao.purchaseRequisition.form.optional')}
                          getForm={() => formRef.current}
                          baseFieldName="requisition_date"
                          t={t}
                          onApply={(date) =>
                            formRef.current?.setFieldValue?.(['items', index, 'required_date'], date)
                          }
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: t('app.kuaizhizao.purchaseRequisition.form.lineNotes'),
                    dataIndex: 'notes',
                    width: 120,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'notes']} style={{ margin: 0 }}>
                        <Input placeholder={t('app.kuaizhizao.common.fieldNotes')} size="small" />
                      </AntForm.Item>
                    ),
                  },
                ]}
          disabledAdd
          minRows={1}
          initialValue={{ ...INITIAL_PR_FORM_ITEM_ROW }}
          tableProps={{
            className: 'purchase-requisition-detail-table',
            size: 'small',
            style: { width: '100%', margin: 0 },
          }}
        />
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.purchaseRequisition.form.notesPlaceholder')} />
      </DetailDrawerSection>

      <DetailDrawerSection titleAccent title={t('app.uniDetail.sectionAttachments')} marginBottom={0}>
        <DocumentAttachmentsField category="purchase_requisition_attachments" label={false} />
      </DetailDrawerSection>
    </>
  );

  const triggerPurchaseRequisitionFormSubmit = () => createFormRef.current?.submit?.();

  useSubmitShortcut(() => triggerPurchaseRequisitionFormSubmit(), isFormPage);

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
                onClick={leavePurchaseRequisitionFormPage}
              />
              <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
                {isCreatePage
                  ? t('app.kuaizhizao.menu.purchase-management.purchase-requisitions.new')
                  : t('app.kuaizhizao.menu.purchase-management.purchase-requisitions.edit')}
              </Typography.Title>
            </Space>
            <DocumentFormPageHeaderActions
              onCancel={leavePurchaseRequisitionFormPage}
              onSaveDraft={triggerPurchaseRequisitionFormSubmit}
              onPrimarySubmit={triggerPurchaseRequisitionFormSubmit}
              isCreatePage={isCreatePage}
              showSaveDraft={false}
            />
            </>
          }
        >
          <div className="form-modal-content-inner">
              <ProForm
                formRef={createFormRef}
                layout="vertical"
                submitter={false}
                scrollToFirstError
                onFinish={handleModalSubmit}
                onValuesChange={() => {
                  if (prFormHydratingRef.current || !prFormDraftKey) return;
                  const values = createFormRef.current?.getFieldsValue?.(true);
                  if (values && Object.keys(values).length > 0) {
                    setDocumentFormDraft(prFormDraftKey, values);
                  }
                }}
                onFinishFailed={({ errorFields }) => {
                  const first = errorFields?.[0];
                  const errText = first?.errors?.filter(Boolean)[0];
                  messageApi.error(errText || t('components.layoutTemplates.formModal.checkFormHint'));
                }}
                initialValues={{ items: initialCreateItems }}
              >
                {renderPurchaseRequisitionForm()}
              </ProForm>
            </div>
        </DocumentFormPageLayout>
        <UniMaterialBatchPicker
          open={materialPickerOpen}
          onCancel={() => setMaterialPickerOpen(false)}
          onConfirm={appendRequisitionItemsFromMaterials}
        />
        <Suspense fallback={null}>
          <LazyUniImport
            visible={importModalVisible}
            onCancel={() => setImportModalVisible(false)}
            onConfirm={handleItemImport}
            title={t('app.kuaizhizao.purchaseRequisition.import.title')}
            headers={[t('app.kuaizhizao.purchaseRequisition.import.materialCode'), t('app.kuaizhizao.purchaseRequisition.import.spec'), t('app.kuaizhizao.purchaseRequisition.import.unit'), t('app.kuaizhizao.purchaseRequisition.import.quantity'), t('app.kuaizhizao.purchaseRequisition.import.suggestedPrice'), t('app.kuaizhizao.purchaseRequisition.import.lineDelivery'), t('app.kuaizhizao.purchaseRequisition.import.lineNotes')]}
            exampleRow={['MAT001', 'Spec X', pickImportExampleValue(requisitionLineUnitOptions, t('app.kuaizhizao.purchaseRequisition.import.exampleUnit')), '10', '100', '2026-03-01', '']}
            columnOptions={requisitionLineImportColumnOptions}
          />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle={t('app.kuaizhizao.menu.purchase-management.purchase-requisitions')}
          columnPersistenceId={PURCHASE_REQUISITION_LIST_PERSISTENCE_ID}
          actionRef={actionRef}
          viewTypes={['table', 'detailTable', 'help']}
          defaultViewType={viewTypeState === 'help' ? 'table' : viewTypeState}
          helpViewConfig={{
            content: (
              <div style={{ lineHeight: 1.8 }}>
                <p>
                  <strong>{t('components.uniTable.viewTable')}</strong>
                  {t('app.kuaizhizao.purchaseRequisition.helpTableView')}
                </p>
                <p>
                  <strong>{t('components.uniTable.viewDetailTable')}</strong>
                  {t('app.kuaizhizao.purchaseRequisition.helpDetailTableView')}
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
          request={async (params: any, sort: any, _filter: any, searchFormValues?: Record<string, any>) => {
            const s = searchFormValues ?? {};
            const lifecycleParams = resolvePurchaseRequisitionListLifecycleParams(
              searchFormValues,
              params,
            );
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : '';
            const apiParams: Parameters<typeof listPurchaseRequisitions>[0] = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              ...lifecycleParams,
              order_by: orderBy,
              source_type: s.source_type,
              required_date_from: s.required_date_from,
              required_date_to: s.required_date_to,
              include_items: dataViewModeRef.current === 'detail',
            };
            if (fuzzyKeyword) {
              apiParams.keyword = fuzzyKeyword;
            } else {
              if (s.requisition_code != null && String(s.requisition_code).trim()) {
                apiParams.requisition_code = String(s.requisition_code).trim();
              }
              if (s.requisition_name != null && String(s.requisition_name).trim()) {
                apiParams.requisition_name = String(s.requisition_name).trim();
              }
            }
            const createdRange = s.created_at_range as [unknown, unknown] | undefined;
            if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
              apiParams.created_start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
              apiParams.created_end_date = createdRange[1]
                ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
                : apiParams.created_start_date;
            }
            const res = await listPurchaseRequisitions(apiParams);
            const requisitions = res.data || [];
            const total = res.total || 0;
            // 行缓存唯一真源：onTableDataChange（prefetch 会走本 request，禁止在此覆盖）
            if (dataViewModeRef.current === 'order') {
              return { data: requisitions, success: res.success ?? true, total };
            }
            const flatRows = flattenDocumentDetailRows<PurchaseRequisition, PurchaseRequisitionItem>({
              headers: requisitions,
              getHeaderId: (h) => h.id,
              getItems: (h) => h.items,
              buildRowKey: (h, item, index) =>
                item?.id
                  ? `req-${h.id}-item-${item.id}`
                  : `req-${h.id}-idx-${index}`,
              mapItemRow: (h, item) => ({
                ...item,
                requisition_id: h.id ?? 0,
                requisition_code: h.requisition_code,
                requisition_name: h.requisition_name,
                source_type: h.source_type,
                source_code: h.source_code,
                status: h.status,
                review_status: h.review_status,
                downstream_push_progress: h.downstream_push_progress,
                lifecycle: h.lifecycle,
              }),
              mapEmptyHeaderRow: (h) => ({
                requisition_id: h.id ?? 0,
                requisition_code: h.requisition_code,
                requisition_name: h.requisition_name,
                material_id: 0,
                material_code: '-',
                material_name: '-',
                unit: '',
                quantity: 0,
                suggested_unit_price: 0,
                status: h.status,
                review_status: h.review_status,
                lifecycle: h.lifecycle,
              }),
            }) as PurchaseRequisitionItemRow[];
            return { data: flatRows, success: res.success ?? true, total };
          }}
          onTableDataChange={(rows) => {
            if (dataViewModeRef.current === 'order') {
              tableRowsRef.current = rows as PurchaseRequisition[];
            }
          }}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          columns={columns}
          rowKey={dataViewMode === 'detail' ? '_rowKey' : 'id'}
          enableRowSelection={viewTypeState !== 'detailTable'}
          showAdvancedSearch={true}
          skipFuzzyPinyinClientFilter
          pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
          pinnedTabsValueEnum={lifecycleValueEnum}
          search={false}
          showCreateButton={false}
          createButtonText={t('app.kuaizhizao.menu.purchase-management.purchase-requisitions.new')}
          onCreate={handleCreate}
          toolBarRender={() => [
            <UniPullCreateToolbar
              compactKey="create-purchase-requisition-with-pull"
              createIcon={<PlusOutlined />}
              createLabel={t('app.kuaizhizao.menu.purchase-management.purchase-requisitions.new')}
              onCreate={handleCreate}
              menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                {
                  key: 'pull-from-demand-computation',
                  actionKey: 'purchase_requisition.pull_from_demand_computation',
                  onClick: () => {
                    pullFromComputationQuery.openModal();
                  },
                },
              ])}
            />,
            <UniPushToolbarButton
              key={`purchase-requisition-push-${selectedRequisitionForToolbar?.id ?? 'none'}`}
              menuItems={toolbarPushMenuItems}
              disabled={selectedRowKeys.length !== 1 || !selectedRequisitionForToolbar}
              disabledReason={toolbarPushDisabledReason}
            />,
          ]}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.purchaseRequisition.confirmBatchDelete', { count })}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="purchase-requisition-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedRequisitionsForBatch}
              auditEnabled={purchaseRequestAuditEnabled}
              permGates={purchaseRequisitionPerms}
              handlers={purchaseRequisitionAuditBatchHandlers}
              onSuccess={handlePurchaseRequisitionAuditBatchSuccess}
              toolBarButtonSize="middle"
            />,
          ]}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              let items = await fetchAllListItems((p) => listPurchaseRequisitions(p));
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: PurchaseRequisition) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `purchase-requisitions-${todaySiteDateString()}.xlsx`,
              );
              messageApi.success(t('common.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
        />
      </ListPageTemplate>

      <UniPullQueryModal<PullDemandComputationCandidate>
        open={pullFromComputationQuery.open}
        title={pullFromDemandComputationAction.label}
        onCancel={pullFromComputationQuery.closeModal}
        onOk={pullFromComputationQuery.handleConfirm}
        rowKey="id"
        columns={pullFromComputationColumns}
        dataSource={pullFromComputationQuery.dataSource}
        loading={pullFromComputationQuery.loading}
        confirmLoading={pullFromComputationQuery.confirmLoading}
        selectionType={pullFromComputationQuery.selectionType}
        selectedRowKeys={pullFromComputationQuery.selectedRowKeys}
        selectedRows={pullFromComputationQuery.selectedRows}
        onSelectedRowKeysChange={pullFromComputationQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromComputationQuery.isRowDisabled}
        searchDraft={pullFromComputationQuery.searchDraft}
        onSearchDraftChange={pullFromComputationQuery.setSearchDraft}
        onSearchApply={pullFromComputationQuery.handleSearchApply}
        onSearchClear={pullFromComputationQuery.handleSearchClear}
        appliedKeyword={pullFromComputationQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.purchaseRequisition.pull.searchPlaceholder')}
        filterExtra={(
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('app.kuaizhizao.purchaseRequisition.pull.sourceDocPlaceholder')}
            style={{ width: 220, flexShrink: 0 }}
            value={pullSourceComputationId}
            options={pullSourceOptions}
            onChange={(value) => {
              const nextId = Number(value);
              const next = Number.isFinite(nextId) && nextId > 0 ? nextId : undefined;
              pullSourceComputationIdRef.current = next;
              setPullSourceComputationId(next);
              pullFromComputationQuery.handleSelectedRowKeysChange([], []);
              pullFromComputationQuery.handleSearchApply(pullFromComputationQuery.appliedKeyword);
            }}
          />
        )}
        getRowLabel={(row) =>
          [row.computation_code, row.material_code].filter(Boolean).join(' ')
        }
        page={pullFromComputationQuery.page}
        pageSize={pullFromComputationQuery.pageSize}
        total={pullFromComputationQuery.total}
        onPageChange={pullFromComputationQuery.handlePageChange}
        scopeOptions={pullFromComputationQuery.scopeOptions}
        scope={pullFromComputationQuery.scope}
        onScopeChange={pullFromComputationQuery.handleScopeChange}
        okText={t('app.kuaizhizao.purchaseRequisition.pull.ok')}
      />

      <Modal
        title={pushToPurchaseOrderAction.label}
        open={pushPoPreviewOpen}
        destroyOnHidden
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPushPoPreviewModal}
        okText={pushToPurchaseOrderAction.label}
        cancelText={t('common.cancel')}
        confirmLoading={pushPoPreviewConfirming}
        onOk={() => void handlePushPoPreviewConfirm()}
        okButtonProps={{
          disabled:
            pushPoPreviewLoading ||
            !pushPoPreviewData ||
            !!pushPoPreviewData?.has_blocking_issues ||
            pushPoDetailItems.length === 0,
        }}
      >
        {pushPoPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pushPoPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushPoPreviewData.summary}</p>
            {pushPoPreviewData.has_blocking_issues && pushPoPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  purchaseRequisitionCapabilityReasonMessage(pushPoPreviewData.blocking_reason, t) ||
                  t('app.kuaizhizao.purchaseRequisition.pushFailed')
                }
              />
            ) : null}
            {pushPoDetailItems.length > 0 && pushPoSuppliers.length > 0 ? (
              <ConvertForm
                items={pushPoDetailItems}
                unconvertedIds={(pushPoPreviewData.items || [])
                  .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
                  .map((row) => Number(row.item_id))}
                suppliers={pushPoSuppliers}
                formRef={convertFormRef}
              />
            ) : null}
            {pushPoPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pushPoPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={pushToInquiryAction.label}
        open={pushInquiryPreviewOpen}
        destroyOnHidden
        width={1100}
        onCancel={resetPushInquiryPreviewModal}
        okText={pushToInquiryAction.label}
        cancelText={t('common.cancel')}
        confirmLoading={pushInquiryPreviewConfirming}
        onOk={() => void handlePushInquiryPreviewConfirm()}
        okButtonProps={{
          disabled:
            pushInquiryPreviewLoading ||
            !pushInquiryPreviewData ||
            !!pushInquiryPreviewData?.has_blocking_issues,
        }}
      >
        {pushInquiryPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pushInquiryPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushInquiryPreviewData.summary}</p>
            {pushInquiryPreviewData.has_blocking_issues && pushInquiryPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  purchaseRequisitionCapabilityReasonMessage(pushInquiryPreviewData.blocking_reason, t) ||
                  t('app.kuaizhizao.purchaseRequisition.inquiryCreateFailed')
                }
              />
            ) : null}
            {pushInquiryPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushInquiryPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                columns={[
                  {
                    title: t('common.select'),
                    dataIndex: 'item_id',
                    width: 64,
                    render: (_: unknown, row) => {
                      const itemId = Number(row.item_id);
                      const maxQty = Number(row.max_push_quantity ?? 0);
                      const disabled = !Number.isFinite(maxQty) || maxQty <= 0;
                      return (
                        <Switch
                          size="small"
                          disabled={disabled}
                          checked={pushInquirySelectedItemIds.includes(itemId)}
                          onChange={(checked) => {
                            setPushInquirySelectedItemIds((prev) =>
                              checked ? Array.from(new Set([...prev, itemId])) : prev.filter((id) => id !== itemId),
                            );
                          }}
                        />
                      );
                    },
                  },
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right', render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right', render: formatQuantity },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseRequisition.noInquiryLines')} />
            )}
            {pushInquiryPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pushInquiryPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <PurchaseRequisitionDetailDrawer
        open={detailVisible}
        zIndex={prqDetailDrawerZIndex}
        onClose={() => {
          setDetailVisible(false);
          setCurrentReq(null);
        }}
        requisition={currentReq}
        trackingRefreshKey={prTrackingRefreshKey}
        extra={
          currentReq ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'fixStatus',
                  visible: ['全部转单', 'FULL_CONVERTED'].includes(currentReq.status ?? ''),
                  render: () => (
                    <Button
                      onClick={async () => {
                        if (!currentReq?.id) return;
                        try {
                          const res = await fixPurchaseRequisitionStatus(currentReq.id);
                          setCurrentReq(res);
                          setPrTrackingRefreshKey((k) => k + 1);
                          invalidateMenuBadgeCounts();
                          actionRef.current?.reload();
                          messageApi.success(t('app.kuaizhizao.purchaseRequisition.statusFixed'));
                        } catch (e: unknown) {
                          const err = e as { response?: { data?: { detail?: string } } };
                          messageApi.error(err?.response?.data?.detail || t('app.kuaizhizao.purchaseRequisition.fixFailed'));
                        }
                      }}
                    >
                      {t('app.kuaizhizao.purchaseRequisition.fixStatus')}
                    </Button>
                  ),
                },
                {
                  key: 'edit',
                  visible:
                    currentReq.capabilities?.update?.allowed === true && purchaseRequisitionPerms.canUpdate,
                  render: () => (
                    <Button
                      {...rowActionKind('update')}
                      icon={<EditOutlined />}
                      onClick={() => {
                        const r = currentReq;
                        setDetailVisible(false);
                        if (r) void handleEdit(r);
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                  ),
                },
                {
                  key: 'delete',
                  visible:
                    currentReq.capabilities?.delete?.allowed === true && purchaseRequisitionPerms.canDelete,
                  render: () => (
                    <Button
                      {...rowActionKind('delete')}
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteOne(currentReq)}
                    >
                      {t('common.delete')}
                    </Button>
                  ),
                },
                {
                  key: 'workflow',
                  render: () => (
                    <UniWorkflowActions
                      {...rowActionKind('skip')}
                      record={currentReq}
                      entityName={t('app.kuaizhizao.purchaseRequisition.entityName')}
                      {...PURCHASE_REQUISITION_WORKFLOW_PROPS}
                      theme="default"
                      confirmMessages={{ revoke: t('app.kuaizhizao.purchaseRequisition.workflowRevokeConfirm') }}
                      onSuccess={async () => {
                        invalidateMenuBadgeCounts();
                        actionRef.current?.reload();
                        setPrTrackingRefreshKey((k) => k + 1);
                        if (currentReq?.id) {
                          try {
                            setCurrentReq(await getPurchaseRequisition(currentReq.id));
                          } catch (e: unknown) {
                            const err = e as { message?: string };
                            messageApi.error(err?.message || t('app.kuaizhizao.purchaseRequisition.detailFailed'));
                          }
                        }
                      }}
                    />
                  ),
                },
              ]}
            />
          ) : null
        }
      />
      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendRequisitionItemsFromMaterials}
      />
    </>
  );
};

const ConvertForm: React.FC<{
  items: PurchaseRequisitionItem[];
  unconvertedIds: number[];
  suppliers: Array<{ id: number; code?: string; name: string }>;
  formRef: React.MutableRefObject<{
    selectedIds: number[];
    supplierId: number;
    supplierName: string;
    itemQuantities: Record<number, number>;
    itemUnitPrices: Record<number, number>;
    itemSuppliers: Record<number, number>;
    persistDefaultSupplier: boolean;
  }>;
}> = ({ items, unconvertedIds, suppliers, formRef }) => {
  const { t } = useTranslation();
  const { quantity: quantityDecimals, price: priceDecimals, amount: amountDecimals } = useNumericPrecision();
  const fallbackSupplierId = suppliers[0]?.id || 0;
  const [selected, setSelected] = useState<number[]>(unconvertedIds);
  const [batchSupplierId, setBatchSupplierId] = useState<number>(() => {
    const first = items.find((i) => i.id != null && unconvertedIds.includes(i.id) && !i.purchase_order_id);
    return first?.supplier_id || fallbackSupplierId;
  });
  const [rowSuppliers, setRowSuppliers] = useState<Record<number, number>>(() => {
    const m: Record<number, number> = {};
    items.forEach((i) => {
      if (i.id == null || i.purchase_order_id || !unconvertedIds.includes(i.id)) return;
      m[i.id] = i.supplier_id || fallbackSupplierId;
    });
    return m;
  });
  const [quantities, setQuantities] = useState<Record<number, number>>(() => {
    const q: Record<number, number> = {};
    items.filter((i) => !i.purchase_order_id).forEach((i) => {
      if (i.id != null) q[i.id] = Number(i.quantity ?? 0);
    });
    return q;
  });
  const [unitPrices, setUnitPrices] = useState<Record<number, number>>(() => {
    const p: Record<number, number> = {};
    items.filter((i) => !i.purchase_order_id).forEach((i) => {
      if (i.id != null) p[i.id] = Number(i.suggested_unit_price ?? 0);
    });
    return p;
  });
  const [persistDefault, setPersistDefault] = useState(false);
  const hasSuppliers = suppliers && suppliers.length > 0;

  const formatLineAmount = (itemId: number) => {
    const qty = quantities[itemId] ?? 0;
    const price = unitPrices[itemId] ?? 0;
    return (qty * price).toLocaleString('zh-CN', {
      minimumFractionDigits: amountDecimals,
      maximumFractionDigits: amountDecimals,
    });
  };

  const applyBatchToSelected = () => {
    const selectedSet = new Set(selected);
    setRowSuppliers((prev) => {
      const next = { ...prev };
      items.forEach((i) => {
        if (i.id == null || !selectedSet.has(i.id) || i.purchase_order_id || !unconvertedIds.includes(i.id)) return;
        next[i.id] = batchSupplierId;
      });
      return next;
    });
  };

  const hasBatchTargetRows = selected.some((id) => {
    const i = items.find((x) => x.id === id);
    return i != null && i.id != null && !i.purchase_order_id && unconvertedIds.includes(i.id);
  });

  useEffect(() => {
    formRef.current.selectedIds = selected;
    formRef.current.itemQuantities = quantities;
    formRef.current.itemUnitPrices = unitPrices;
    formRef.current.itemSuppliers = rowSuppliers;
    formRef.current.persistDefaultSupplier = persistDefault;
    const firstSelectedId = selected[0];
    const head = firstSelectedId ? rowSuppliers[firstSelectedId] : batchSupplierId;
    const currentSupplierId = (head || batchSupplierId || 0) as number;
    formRef.current.supplierId = currentSupplierId;
    formRef.current.supplierName = suppliers.find((x) => x.id === currentSupplierId)?.name || '';
  }, [selected, quantities, unitPrices, rowSuppliers, persistDefault, batchSupplierId, suppliers, formRef]);

  const supplierOptions = suppliers.map((s) => ({
    label: `${s.code ? `${s.code} - ` : ''}${s.name}`.trim(),
    value: s.id,
  }));

  return (
    <div style={{ margin: 0 }}>
      {hasSuppliers && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#666', whiteSpace: 'nowrap' }}>{t('app.kuaizhizao.purchaseRequisition.convert.batchSupplier')}</span>
          <Select
            style={{ minWidth: 220, flex: 1 }}
            placeholder={t('app.kuaizhizao.purchaseRequisition.convert.batchPlaceholder')}
            value={batchSupplierId || undefined}
            onChange={(v: number) => setBatchSupplierId(v)}
            options={supplierOptions}
          />
          <Button type="default" onClick={applyBatchToSelected} disabled={!hasBatchTargetRows}>
            {t('app.kuaizhizao.purchaseRequisition.convert.applyToSelected')}
          </Button>
        </div>
      )}
      {!hasSuppliers && (
        <p style={{ color: 'var(--ant-color-warning)', margin: '0 0 12px 0' }}>{t('app.kuaizhizao.purchaseRequisition.convert.noSuppliers')}</p>
      )}
      <div style={{ marginBottom: 12 }}>
        <Checkbox checked={persistDefault} onChange={(e) => setPersistDefault(e.target.checked)}>
          {t('app.kuaizhizao.purchaseRequisition.convert.persistSupplier')}
        </Checkbox>
      </div>
      <Table
        size="small"
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as number[]),
          getCheckboxProps: (record: PurchaseRequisitionItem) => ({
            disabled: record.purchase_order_id != null,
          }),
        }}
        columns={[
          {
            title: t('app.kuaizhizao.purchaseRequisition.convert.col.material'),
            key: 'material',
            width: 200,
            render: (_: unknown, record: PurchaseRequisitionItem) => (
              <UniTableStackedPrimaryCell
                primary={record.material_name || '-'}
                secondary={record.material_code || '-'}
                secondaryCopyable={Boolean(record.material_code)}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.purchaseRequisition.convert.col.supplier'),
            width: 380,
            render: (_: unknown, record: PurchaseRequisitionItem) =>
              record.id != null && !record.purchase_order_id ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  <Select
                    style={{ flex: '1 1 auto', minWidth: 0 }}
                    placeholder={t('app.kuaizhizao.purchaseRequisition.convert.selectSupplier')}
                    value={rowSuppliers[record.id] || undefined}
                    onChange={(v: number) => setRowSuppliers((prev) => ({ ...prev, [record.id!]: v }))}
                    options={supplierOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </div>
              ) : record.purchase_order_id ? (
                '-'
              ) : null,
          },
          { title: t('app.kuaizhizao.purchaseRequisition.convert.col.demandQty'), dataIndex: 'quantity', width: 88, align: 'right', render: (v: any) => formatQuantity(v) },
          {
            title: t('app.kuaizhizao.purchaseRequisition.convert.col.pushedQty'),
            width: 120,
            align: 'right',
            render: (_: unknown, record: PurchaseRequisitionItem) => {
              const draft = Number(record.converted_quantity_draft ?? 0);
              const confirmed = Number(record.converted_quantity_confirmed ?? 0);
              if (draft === 0 && confirmed === 0) return 0;
              const parts: string[] = [];
              if (draft > 0) parts.push(t('app.kuaizhizao.purchaseRequisition.convert.draftQty', { qty: draft }));
              if (confirmed > 0) parts.push(t('app.kuaizhizao.purchaseRequisition.convert.confirmedQty', { qty: confirmed }));
              return parts.join(' / ');
            },
          },
          { title: t('app.kuaizhizao.purchaseRequisition.convert.col.moq'), width: 88, align: 'right', render: () => '-' },
          {
            title: t('app.kuaizhizao.purchaseRequisition.convert.col.thisPushQty'),
            width: 120,
            align: 'right',
            render: (_: unknown, record: PurchaseRequisitionItem) =>
              record.id != null && !record.purchase_order_id ? (
                <InputNumber
                  min={0.01}
                  precision={quantityDecimals}
                  value={quantities[record.id] ?? Number(record.quantity ?? 0)}
                  onChange={(v) => setQuantities((prev) => ({ ...prev, [record.id!]: Number(v) || 0 }))}
                  style={{ width: 100 }}
                />
              ) : record.purchase_order_id ? (
                '-'
              ) : null,
          },
          {
            title: t('app.kuaizhizao.purchaseRequisition.convert.col.unitPrice'),
            width: 120,
            align: 'right',
            render: (_: unknown, record: PurchaseRequisitionItem) =>
              record.id != null && !record.purchase_order_id ? (
                <InputNumber
                  min={0}
                  precision={priceDecimals}
                  value={unitPrices[record.id] ?? Number(record.suggested_unit_price ?? 0)}
                  onChange={(v) => setUnitPrices((prev) => ({ ...prev, [record.id!]: Number(v) || 0 }))}
                  style={{ width: 100 }}
                />
              ) : record.purchase_order_id ? (
                '-'
              ) : null,
          },
          {
            title: t('app.kuaizhizao.purchaseRequisition.convert.col.lineAmount'),
            width: 110,
            align: 'right',
            render: (_: unknown, record: PurchaseRequisitionItem) =>
              record.id != null && !record.purchase_order_id ? (
                <Typography.Text>{formatLineAmount(record.id)}</Typography.Text>
              ) : (
                '-'
              ),
          },
        ]}
        dataSource={items}
        pagination={false}
        rowKey="id"
        scroll={{ x: 1280 }}
      />
    </div>
  );
};

export default PurchaseRequisitionsPage;
