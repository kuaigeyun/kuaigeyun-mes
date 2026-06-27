/**
 * 采购申请管理页面
 */

import React, { useRef, useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Table, Form as AntForm, Input, InputNumber, Select, Row, Col, Checkbox, Descriptions, Empty, Spin, Typography, DatePicker, Modal, Card, theme } from 'antd';
import {
  EyeOutlined,
  CheckOutlined,
  EditOutlined,
  SwapOutlined,
  FileSearchOutlined,
  DeleteOutlined,
  CopyOutlined,
  PlusOutlined,
  SendOutlined,
  AppstoreAddOutlined,
  ArrowLeftOutlined,
  ImportOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniAuditBatchMenuButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, DetailDrawerActions, MODAL_CONFIG, DRAWER_CONFIG, DocumentFormPageLayout, DocumentFormPageHeaderActions, DOCUMENT_DETAIL_PAGE_TITLE_STYLE, PAGE_SPACING } from '../../../../../components/layout-templates';
import { setCustomPageTitle, removeCustomPageTitle } from '../../../../../utils/customPageTitle';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { MaterialUnitSelect, prefetchMaterialsForUnitSelect } from '../../../../../components/material-unit-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { downloadFile } from '../../../../../utils';

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
  PurchaseRequisition,
  PurchaseRequisitionItem,
} from '../../../services/purchase-requisition';
import { createInquiryFromRequisition } from '../../../services/purchase-inquiry';
import {
  listDemandComputations,
  pushToPurchaseRequisition,
  getPushOptions,
} from '../../../services/demand-computation';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import {
  buildPurchaseRequisitionLifecycleValueEnum,
  getPurchaseRequisitionLifecycle,
  resolvePurchaseRequisitionListLifecycleParams,
} from '../../../utils/purchaseRequisitionLifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { formatPurchaseRequisitionSourceType } from '../../../utils/purchaseRequisitionSourceType';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { useDocumentTracking, DocumentTrackingTimelineBody } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import { ROUTES } from '../../../constants/routes';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../../../stores';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { DetailLifecycleCollaborationBlock } from '../../../../../components/uni-audit/DetailAuditPhaseRow';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { formatDateTime } from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';

/** 采购申请详情只读明细表最小横向宽度 */
const PURCHASE_REQUISITION_DETAIL_ITEMS_MIN_WIDTH = 980;

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

type PullDemandComputationCandidate = {
  id: number;
  computation_code?: string;
  business_mode?: string;
  computation_status?: string;
  created_at?: string;
  updated_at?: string;
  has_purchase_items?: boolean;
  can_push_requisition?: boolean;
  disabled_reason?: string;
};

function renderPurchaseRequisitionRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return nodes;
}

function canPushPurchaseRequisition(record: PurchaseRequisition): boolean {
  const lifecycle = (record as PurchaseRequisition & { lifecycle?: Record<string, unknown> }).lifecycle;
  const flowClass = String(lifecycle?.flow_class ?? lifecycle?.current_stage_key ?? '').trim();
  return flowClass === 'approved' || flowClass === 'partial';
}

const PURCHASE_REQUISITION_RESOURCE = 'kuaizhizao:purchase-requisition';

const PURCHASE_REQUISITION_LIST_PATH = '/apps/kuaizhizao/purchase-management/purchase-requisitions';
const PURCHASE_REQUISITION_CREATE_PATH = `${PURCHASE_REQUISITION_LIST_PATH}/new`;
const purchaseRequisitionEditPath = (id: number | string) => `${PURCHASE_REQUISITION_LIST_PATH}/${id}/edit`;

const PurchaseRequisitionsPage: React.FC = () => {
  const { t } = useTranslation();
  const pushToPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'purchase_order.pull_from_requisition');
  const pushToInquiryAction = resolveKuaizhizaoDocumentAction(t, 'purchase_inquiry.pull_from_requisition');
  const pullFromDemandComputationAction = resolveKuaizhizaoDocumentAction(t, 'purchase_requisition.pull_from_demand_computation');
  const currentUser = useGlobalStore((s) => s.currentUser);
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
  const formPageInitKeyRef = useRef<string | null>(null);
  const { token } = theme.useToken();
  const prqDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<PurchaseRequisition[]>([]);
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
  const leavePurchaseRequisitionFormPage = useCallback(() => {
    navigate(PURCHASE_REQUISITION_LIST_PATH);
  }, [navigate]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentReq, setCurrentReq] = useState<PurchaseRequisition | null>(null);
  const [supplierList, setSupplierList] = useState<Array<{ id: number; code?: string; name: string }>>([]);
  const createFormRef = useRef<any>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const [prTrackingRefreshKey, setPrTrackingRefreshKey] = useState(0);

  const prTracking = useDocumentTracking(
    detailVisible ? 'purchase_requisition' : undefined,
    detailVisible ? currentReq?.id : undefined,
    prTrackingRefreshKey,
  );

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
    (selected: Material[]) => {
      const isEmptyItemRow = (row: any) => {
        if (row == null) return true;
        if (row.material_id != null && row.material_id !== '') return false;
        const code = row.material_code;
        return code == null || String(code).trim() === '';
      };
      const rowFromMaterial = (m: Material) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        unit: m.baseUnit ?? '件',
        quantity: 1,
        suggested_unit_price: 0,
        required_date: undefined,
        demand_computation_item_id: undefined,
        supplier_id: undefined,
        notes: undefined,
      });
      const queue = selected.map(rowFromMaterial);
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
          const unit = String(row[2] || '').trim();
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
    [messageApi, t],
  );

  const handleCopyRequisitionCode = useCallback(
    (code: string) => {
      if (!code) return;
      void navigator.clipboard
        .writeText(code)
        .then(() => messageApi.success(t('common.copySuccess')))
        .catch(() => messageApi.error(t('common.copyFailed')));
    },
    [messageApi, t]
  );

  const initialCreateItems = INITIAL_CREATE_ITEMS;

  const loadPurchaseRequisitionEditForm = useCallback(
    async (id: number) => {
      void ensureSupplierList();
      setPreviewCode(null);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      createFormRef.current?.resetFields();
      try {
        const detail = await getPurchaseRequisition(id);
        const status = (detail.status ?? '').toString().trim();
        if (!['草稿', 'draft', 'DRAFT'].includes(status)) {
          messageApi.error(t('app.kuaizhizao.purchaseRequisition.onlyDraftEditable'));
          navigate(PURCHASE_REQUISITION_LIST_PATH);
          return;
        }
        setTimeout(() => {
          createFormRef.current?.setFieldsValue({
            requisition_code: detail.requisition_code ?? '',
            requisition_name: detail.requisition_name,
            requisition_date: detail.requisition_date ? dayjs(detail.requisition_date) : dayjs(),
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
          });
        }, 0);
      } catch {
        messageApi.error(t('app.kuaizhizao.purchaseRequisition.loadFailed'));
        navigate(PURCHASE_REQUISITION_LIST_PATH);
      }
    },
    [messageApi, ensureSupplierList, navigate, t],
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

  const initPurchaseRequisitionCreateForm = useCallback(async () => {
    void ensureSupplierList();
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    createFormRef.current?.resetFields();
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
          setTimeout(() => {
            createFormRef.current?.setFieldsValue({
              requisition_code: preview ?? '',
              requisition_date: dayjs(),
              items: initialCreateItems,
            });
          }, 100);
        } catch (e) {
          console.warn('采购申请编号预生成失败:', e);
          setPreviewCode(null);
          setTimeout(() => {
            createFormRef.current?.setFieldsValue({
              requisition_date: dayjs(),
              items: initialCreateItems,
            });
          }, 100);
        }
      } else {
        setPreviewCode(null);
        setTimeout(() => {
          createFormRef.current?.setFieldsValue({
            requisition_date: dayjs(),
            items: initialCreateItems,
          });
        }, 100);
      }
    } catch {
      const ruleCode = getPageRuleCode('kuaizhizao-purchase-requisition');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(isAutoGenerateEnabled('kuaizhizao-purchase-requisition'));
      if (isAutoGenerateEnabled('kuaizhizao-purchase-requisition') && ruleCode) {
        testGenerateCode({ rule_code: ruleCode })
          .then((res) => {
            const preview = res.code;
            setPreviewCode(preview ?? null);
            setTimeout(() => {
              createFormRef.current?.setFieldsValue({
                requisition_code: preview ?? '',
                requisition_date: dayjs(),
                items: initialCreateItems,
              });
            }, 100);
          })
          .catch((e) => {
            console.warn('采购申请编号预生成失败:', e);
            setPreviewCode(null);
            setTimeout(() => {
              createFormRef.current?.setFieldsValue({
                requisition_date: dayjs(),
                items: initialCreateItems,
              });
            }, 100);
          });
      } else {
        setPreviewCode(null);
        setTimeout(() => {
          createFormRef.current?.setFieldsValue({
            requisition_date: dayjs(),
            items: initialCreateItems,
          });
        }, 100);
      }
    }
  }, [ensureSupplierList]);

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

  const pullFromComputationColumns: ProColumns<PullDemandComputationCandidate>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseRequisition.pull.computationCode'), dataIndex: 'computation_code', width: 220, ellipsis: true },
      { title: t('app.kuaizhizao.purchaseRequisition.pull.businessMode'), dataIndex: 'business_mode', width: 110, align: 'center' },
      { title: t('app.kuaizhizao.purchaseRequisition.pull.computationStatus'), dataIndex: 'computation_status', width: 110, align: 'center' },
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at',
        width: 180,
        render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 180,
        render: (v) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaizhizao.purchaseRequisition.pull.convertStatus'),
        key: 'convert_status',
        width: 180,
        align: 'center',
        render: (_, record) =>
          record.can_push_requisition === false ? (
            <Tag color="gold">{record.disabled_reason || t('app.kuaizhizao.purchaseRequisition.pull.cannotCreate')}</Tag>
          ) : (
            <Tag color="success">{t('app.kuaizhizao.purchaseRequisition.pull.canCreate')}</Tag>
          ),
      },
    ],
    [t],
  );

  const pullFromComputationQuery = useUniPullQuery<PullDemandComputationCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const kw = keyword.trim();
        const listRes = await listDemandComputations({
          skip: 0,
          limit: 50,
          computation_status: '完成',
          computation_code: kw || undefined,
        });
        const rows = listRes?.data || [];
        const candidates = await Promise.all(
          rows
            .filter((row) => row.id != null)
            .map(async (row) => {
              let hasPurchaseItems = true;
              let canPushRequisition = true;
              let disabledReason: string | undefined;
              try {
                const options = await getPushOptions(row.id!);
                hasPurchaseItems = !!options.has_purchase_items;
                canPushRequisition = hasPurchaseItems && (options.purchase_choices || []).includes('requisition');
                if (!hasPurchaseItems) {
                  disabledReason = t('app.kuaizhizao.purchaseRequisition.pull.noPurchaseItems');
                } else if (!canPushRequisition) {
                  disabledReason = t('app.kuaizhizao.purchaseRequisition.pull.requisitionExists');
                }
              } catch {
                // capability probe failure should not block selectable rows
              }
              return {
                id: row.id!,
                computation_code: row.computation_code,
                business_mode: row.business_mode,
                computation_status: row.computation_status,
                created_at: row.created_at,
                updated_at: row.updated_at,
                has_purchase_items: hasPurchaseItems,
                can_push_requisition: canPushRequisition,
                disabled_reason: disabledReason,
              } as PullDemandComputationCandidate;
            }),
        );
        const start = (page - 1) * pageSize;
        return { data: candidates.slice(start, start + pageSize), total: candidates.length };
      } catch (error: any) {
        messageApi.error(error?.response?.data?.detail || error?.message || t('app.kuaizhizao.purchaseRequisition.pull.failed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => record.can_push_requisition === false,
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0]);
      const selected = rows[0];
      if (!selectedId || selectedId <= 0) {
        messageApi.warning(t('app.kuaizhizao.purchaseRequisition.pull.selectComputation'));
        return;
      }
      if (selected && selected.can_push_requisition === false) {
        messageApi.warning(selected.disabled_reason || t('app.kuaizhizao.purchaseRequisition.pull.computationUnavailable'));
        return;
      }
      const res = await pushToPurchaseRequisition(selectedId);
      messageApi.success(res?.message || t('app.kuaizhizao.purchaseRequisition.pull.success'));
      actionRef.current?.reload();
      invalidateMenuBadgeCounts();
      pullFromComputationQuery.closeModal();
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
    notes?: string;
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
          notes: values.notes,
          attachments: normalizeDocumentAttachments(values.attachments),
          items: mapItemsForApi(validItems),
        });
        messageApi.success(t('common.save'));
        setEffectiveRuleCode(null);
        setEffectiveAutoGen(null);
        createFormRef.current?.resetFields();
        invalidateMenuBadgeCounts();
        if (isFormPage) {
          navigate(PURCHASE_REQUISITION_LIST_PATH);
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
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: mapItemsForApi(validItems),
      });
      messageApi.success(t('common.createSuccess'));
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      createFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      if (isFormPage) {
        navigate(PURCHASE_REQUISITION_LIST_PATH);
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

  const handleSubmitRequisition = (record: PurchaseRequisition) => {
    if (!record.id) return;
    modalApi.confirm({
      title: t('app.kuaizhizao.purchaseRequisition.submitTitle'),
      content: purchaseRequestAuditEnabled ? t('app.kuaizhizao.purchaseRequisition.submitContentAudit') : t('app.kuaizhizao.purchaseRequisition.submitContentAuto'),
      onOk: async () => {
        try {
          await submitPurchaseRequisition(record.id!);
          messageApi.success(t('app.kuaizhizao.purchaseRequisition.submitSuccess'));
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          if (currentReq?.id === record.id) {
            const refreshed = await getPurchaseRequisition(record.id!);
            setCurrentReq(refreshed);
          }
        } catch (e: any) {
          messageApi.error(e?.response?.data?.detail || t('app.kuaizhizao.purchaseRequisition.submitFailed'));
        }
      },
    });
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

  const canUseToolbarPush = selectedRequisitionForToolbar
    ? canPushPurchaseRequisition(selectedRequisitionForToolbar)
    : false;
  const toolbarPushDisabledReason = useMemo(() => {
    if (selectedRowKeys.length === 0) {
      return t('app.kuaizhizao.purchaseRequisition.push.selectOne', { defaultValue: '请先选择一条采购申请' });
    }
    if (selectedRowKeys.length !== 1) {
      return t('app.kuaizhizao.purchaseRequisition.push.singleOnly', {
        count: selectedRowKeys.length,
        defaultValue: '下推仅支持单条，请仅保留一条选中记录',
      });
    }
    if (!selectedRequisitionForToolbar) {
      return t('app.kuaizhizao.purchaseRequisition.push.rowUnavailable', { defaultValue: '当前选中记录不可用，请刷新后重试' });
    }
    if (!canUseToolbarPush) {
      const lifecycle = (selectedRequisitionForToolbar as PurchaseRequisition & { lifecycle?: Record<string, unknown> }).lifecycle;
      const flowClass = String(lifecycle?.flow_class ?? lifecycle?.current_stage_key ?? '-').trim() || '-';
      return t('app.kuaizhizao.purchaseRequisition.push.flowBlocked', {
        flowClass,
        defaultValue: `当前流转类为 ${flowClass}，不可下推`,
      });
    }
    return undefined;
  }, [canUseToolbarPush, selectedRequisitionForToolbar, selectedRowKeys.length, t]);

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

  const handleConvert = async (record: PurchaseRequisition) => {
    try {
      const suppliers = await ensureSupplierList();
      if (!suppliers.length) {
        messageApi.warning(t('app.kuaizhizao.purchaseRequisition.maintainSupplierFirst'));
        return;
      }
      const detail = await getPurchaseRequisition(record.id!);
      const allItems = detail.items || [];
      const unconverted = allItems.filter((i) => !i.purchase_order_id);
      if (unconverted.length === 0) {
        messageApi.info(t('app.kuaizhizao.purchaseRequisition.noPushLines'));
        return;
      }
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

      modalApi.confirm({
        title: t('app.kuaizhizao.purchaseRequisition.pushPOTitle'),
        icon: null,
        width: MODAL_CONFIG.EXTRA_LARGE_WIDTH,
        content: (
          <ConvertForm
            items={allItems}
            unconvertedIds={unconverted.map((i) => i.id!).filter(Boolean)}
            suppliers={suppliers}
            formRef={convertFormRef}
          />
        ),
        onOk: async () => {
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
            return Promise.reject();
          }
          const missing = selectedIds.some((id) => !itemSuppliers[id]);
          if (missing) {
            messageApi.error(t('app.kuaizhizao.purchaseRequisition.selectLineSupplier'));
            return Promise.reject();
          }
          const invalidPrice = selectedIds.some((id) => {
            const price = itemUnitPrices[id];
            return price == null || !Number.isFinite(price) || price < 0;
          });
          if (invalidPrice) {
            messageApi.error(t('app.kuaizhizao.purchaseRequisition.convert.invalidUnitPrice'));
            return Promise.reject();
          }
          try {
            const res = await convertToPurchaseOrder(record.id!, {
              item_ids: selectedIds,
              supplier_id: supplierId || undefined,
              supplier_name: supplierName || undefined,
              item_quantities: itemQuantities,
              item_unit_prices: Object.fromEntries(
                selectedIds.map((id) => [id, itemUnitPrices[id] ?? 0]),
              ),
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
          } catch (e: unknown) {
            messageApi.error(getApiErrorMessage(e, t('app.kuaizhizao.purchaseRequisition.pushFailed')));
            return Promise.reject();
          }
        },
      });
    } catch {
      messageApi.error(t('app.kuaizhizao.purchaseRequisition.loadDetailFailed'));
    }
  };

  const handleCreateInquiry = async (record: PurchaseRequisition) => {
    try {
      const detail = await getPurchaseRequisition(record.id!);
      const unconverted = (detail.items ?? []).filter((i) => !i.purchase_order_id);
      if (unconverted.length === 0) {
        messageApi.info(t('app.kuaizhizao.purchaseRequisition.noInquiryLines'));
        return;
      }
      modalApi.confirm({
        title: t('app.kuaizhizao.purchaseRequisition.pushInquiryTitle'),
        content: t('app.kuaizhizao.purchaseRequisition.pushInquiryContent', { count: unconverted.length }),
        onOk: async () => {
          const doc = await createInquiryFromRequisition(record.id!, {
            item_ids: unconverted.map((i) => i.id!).filter(Boolean),
          });
          messageApi.success(t('app.kuaizhizao.purchaseRequisition.inquiryCreated', { code: doc.inquiry_code }));
          navigate(`${ROUTES.PURCHASE_INQUIRIES}?inquiryId=${doc.id}`);
          actionRef.current?.reload();
        },
      });
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail?.message ?? e?.message ?? t('app.kuaizhizao.purchaseRequisition.inquiryCreateFailed'));
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
          await handleConvert({ ...detail, id: requisitionId });
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
          await handleCreateInquiry({ ...detail, id: requisitionId });
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
  }, [searchParams, location.pathname, navigate, messageApi, ensureSupplierList, t]);

  const toolbarPushMenuItems = useMemo(
    () =>
      selectedRequisitionForToolbar && canUseToolbarPush
        ? buildUniPushMenuItems([
            {
              key: 'push-purchase-order',
              label: pushToPurchaseOrderAction.label,
              icon: <SwapOutlined />,
              onClick: () => {
                void handleConvert(selectedRequisitionForToolbar);
              },
            },
            {
              key: 'push-inquiry',
              label: pushToInquiryAction.label,
              icon: <FileSearchOutlined />,
              onClick: () => {
                void handleCreateInquiry(selectedRequisitionForToolbar);
              },
            },
          ])
        : [],
    [selectedRequisitionForToolbar, canUseToolbarPush, pushToPurchaseOrderAction.label, pushToInquiryAction.label],
  );

  const handleDeleteOne = (record: PurchaseRequisition) => {
    if (record.status !== '草稿') return;
    modalApi.confirm({
      title: t('app.kuaizhizao.purchaseRequisition.confirmDelete'),
      content: t('app.kuaizhizao.purchaseRequisition.confirmDeleteContent', { code: record.requisition_code }),
      onOk: async () => {
        try {
          await deletePurchaseRequisition(record.id!);
          messageApi.success(t('common.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.response?.data?.detail || t('common.deleteFailed'));
        }
      },
    });
  };

  const columns: ProColumns<PurchaseRequisition>[] = useMemo(() => [
    // 仅高级搜索、不在表身展示；必须放在最前，避免夹在可滚动列与右侧 fixed 列之间导致固定列顺序异常
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.requiredDateRange'),
      dataIndex: 'required_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
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
    { title: t('app.kuaizhizao.purchaseRequisition.col.sourceCode'), dataIndex: 'source_code', width: 132, hideInSearch: false, ellipsis: true },
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.sourceType'),
      dataIndex: 'source_type',
      width: 120,
      hideInSearch: false,
      ellipsis: true,
      valueEnum: {
        DemandComputation: {
          text: formatPurchaseRequisitionSourceType('DemandComputation', t),
        },
      },
      render: (_, record) => formatPurchaseRequisitionSourceType(record.source_type, t),
    },
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.requiredDate'),
      dataIndex: 'required_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    { title: t('app.kuaizhizao.purchaseRequisition.col.itemCount'), dataIndex: 'items_count', width: 80, align: 'center', hideInSearch: true },
    { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime', width: 160, hideInSearch: true },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
    },
    ...(purchaseRequisitionAuditColumn ? [purchaseRequisitionAuditColumn] : []),
    {
      title: t('app.kuaizhizao.purchaseRequisition.col.lifecycle'),
      key: 'lifecycle',
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      fixed: 'right',
      align: 'center',
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
      width: 280,
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
              onSuccess={() => actionRef.current?.reload()}
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
  ], [t, purchaseRequestAuditEnabled, purchaseRequisitionAuditColumn, lifecycleValueEnum, handleDetail, handleEdit, handleDeleteOne]);

  const renderPurchaseRequisitionForm = () => (
    <>
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
                getForm: () => formRef.current,
                fieldName: 'required_date',
                baseFieldName: 'requisition_date',
                t,
              })}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            {editingId != null ? (
              <ProFormText name="applicant_name" label={t('app.kuaizhizao.purchaseRequisition.form.applicant')} disabled />
            ) : (
              <AntForm.Item label={t('app.kuaizhizao.purchaseRequisition.form.applicant')}>
                <Typography.Text>{currentUser?.full_name || currentUser?.username || '—'}</Typography.Text>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('app.kuaizhizao.purchaseRequisition.form.applicantHint')}
                  </Typography.Text>
                </div>
              </AntForm.Item>
            )}
          </Col>
          <Col span={12} />
        </Row>
        {/* 申请明细：与销售订单 Modal 同款 — AntForm.List + Table + 内联样式 + 操作列 fixed right */}
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
                                      unit: 'baseUnit',
                                    }}
                                    fallbackOption={fallback}
                                    formItemProps={{ style: { margin: 0 } }}
                                    showQuickCreate
                                    showAdvancedSearch
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
                          return (
                            <AntForm.Item name={[index, 'unit']} style={{ margin: 0 }}>
                              <MaterialUnitSelect materialId={materialId} size="small" noStyle />
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
                        <InputNumber placeholder={t('app.kuaizhizao.purchaseRequisition.form.quantity')} min={0} precision={2} style={{ width: '100%' }} size="small" />
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
                              <InputNumber placeholder="0" min={0} precision={2} style={{ width: 80 }} size="small" />
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
        <DocumentAttachmentsField category="purchase_requisition_attachments" />
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.common.fieldNotes')} placeholder={t('app.kuaizhizao.purchaseRequisition.form.notesPlaceholder')} />
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
          <Card styles={{ body: { padding: PAGE_SPACING.PADDING } }}>
            <div className="form-modal-content-inner">
              <ProForm
                formRef={createFormRef}
                layout="vertical"
                submitter={false}
                scrollToFirstError
                onFinish={handleModalSubmit}
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
          </Card>
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
            exampleRow={['MAT001', 'Spec X', t('app.kuaizhizao.purchaseRequisition.import.exampleUnit'), '10', '100', '2026-03-01', '']}
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
          columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-requisitions"
          actionRef={actionRef}
          request={async (params: any, _sort: any, _filter: any, searchFormValues?: Record<string, any>) => {
            const s = searchFormValues || {};
            const lifecycleParams = resolvePurchaseRequisitionListLifecycleParams(
              searchFormValues,
              params,
            );
            const res = await listPurchaseRequisitions({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              ...lifecycleParams,
              source_type: s.source_type,
              keyword: s.keyword,
              requisition_code: s.requisition_code,
              requisition_name: s.requisition_name,
              required_date_from: s.required_date_from,
              required_date_to: s.required_date_to,
            });
            tableRowsRef.current = res.data || [];
            return {
              data: res.data || [],
              total: res.total || 0,
              success: res.success ?? true,
            };
          }}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          columns={columns}
          rowKey="id"
          showAdvancedSearch={true}
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
              menuItems={[
                {
                  key: 'pull-from-demand-computation',
                  label: pullFromDemandComputationAction.label,
                  onClick: () => {
                    pullFromComputationQuery.openModal();
                  },
                },
              ]}
            />,
            <UniPushToolbarButton
              key={`purchase-requisition-push-${selectedRequisitionForToolbar?.id ?? 'none'}`}
              menuItems={toolbarPushMenuItems}
              disabled={!selectedRequisitionForToolbar || !canUseToolbarPush}
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
              const res = await listPurchaseRequisitions({ skip: 0, limit: 10000 });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: PurchaseRequisition) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning(t('common.noDataToExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              downloadFile(blob, `purchase-requisitions-${new Date().toISOString().slice(0, 10)}.json`);
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
        onSelectedRowKeysChange={pullFromComputationQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromComputationQuery.isRowDisabled}
        searchDraft={pullFromComputationQuery.searchDraft}
        onSearchDraftChange={pullFromComputationQuery.setSearchDraft}
        onSearchApply={pullFromComputationQuery.handleSearchApply}
        onSearchClear={pullFromComputationQuery.handleSearchClear}
        appliedKeyword={pullFromComputationQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.purchaseRequisition.pull.searchPlaceholder')}
        page={pullFromComputationQuery.page}
        pageSize={pullFromComputationQuery.pageSize}
        total={pullFromComputationQuery.total}
        onPageChange={pullFromComputationQuery.handlePageChange}
        okText={t('app.kuaizhizao.purchaseRequisition.pull.ok')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />


      <DetailDrawerTemplate
        title={t('app.kuaizhizao.purchaseRequisition.detailTitle', { code: currentReq?.requisition_code || '' })}
        open={detailVisible}
        zIndex={prqDetailDrawerZIndex}
        onClose={() => {
          setDetailVisible(false);
          setCurrentReq(null);
        }}
        dataSource={currentReq || undefined}
        columns={[]}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          currentReq && (
            <DetailDrawerActions
              items={[
                {
                  key: 'edit',
                  visible: ['草稿', 'draft', 'DRAFT'].includes((currentReq.status ?? '').toString().trim()),
                  render: () => (
                    <Button
                      type="link"
                      size="small"
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
                  key: 'submit',
                  visible: ['草稿', 'draft', 'DRAFT'].includes((currentReq.status ?? '').toString().trim()),
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => currentReq && handleSubmitRequisition(currentReq)}
                    >
                      {t('components.uniAction.submit')}
                    </Button>
                  ),
                },
                { key: 'workflow', visible: true, render: () => (
                  <UniWorkflowActions {...rowActionKind('skip')}
                    record={currentReq}
                    entityName={t('app.kuaizhizao.purchaseRequisition.entityName')}
                    statusField="status"
                    reviewStatusField="review_status"
                    draftStatuses={['草稿', 'draft']}
                    pendingStatuses={['待审核', 'pending_review']}
                    approvedStatuses={['已通过', '已审核', '部分转单', '全部转单', 'audited', 'approved']}
                    rejectedStatuses={['已驳回', 'rejected']}
                    theme="default"
                    size="small"
                    confirmMessages={{ revoke: t('app.kuaizhizao.purchaseRequisition.workflowRevokeConfirm') }}
                    onSuccess={async () => {
                      invalidateMenuBadgeCounts();

                      actionRef.current?.reload();
                      setPrTrackingRefreshKey((k) => k + 1);
                      if (currentReq?.id) {
                        try {
                          const res = await getPurchaseRequisition(currentReq.id);
                          setCurrentReq(res);
                        } catch { /* ignore */ }
                      }
                    }}
                  />
                ) },
                {
                  key: 'convert',
                  visible: canPushPurchaseRequisition(currentReq),
                  render: () => (
                    <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleConvert(currentReq)}>
                      {pushToPurchaseOrderAction.label}
                    </Button>
                  ),
                },
                {
                  key: 'create-inquiry',
                  visible: canPushPurchaseRequisition(currentReq),
                  render: () => (
                    <Button type="link" size="small" icon={<FileSearchOutlined />} onClick={() => handleCreateInquiry(currentReq)}>
                      {pushToInquiryAction.label}
                    </Button>
                  ),
                },
                {
                  key: 'fixStatus',
                  visible: ['全部转单', 'FULL_CONVERTED'].includes(currentReq.status ?? ''),
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      onClick={async () => {
                        if (!currentReq?.id) return;
                        try {
                          const res = await fixPurchaseRequisitionStatus(currentReq.id);
                          setCurrentReq(res);
                          setPrTrackingRefreshKey((k) => k + 1);
                          invalidateMenuBadgeCounts();

                          actionRef.current?.reload();
                          messageApi.success(t('app.kuaizhizao.purchaseRequisition.statusFixed'));
                        } catch (e: any) {
                          messageApi.error(e?.response?.data?.detail || t('app.kuaizhizao.purchaseRequisition.fixFailed'));
                        }
                      }}
                    >
                      {t('app.kuaizhizao.purchaseRequisition.fixStatus')}
                    </Button>
                  ),
                },
              ]}
            />
          )
        }
        customContent={
          currentReq && (
            <>
              <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={(() => {
                    const lc = getPurchaseRequisitionLifecycle(currentReq, purchaseRequestAuditEnabled);
                    const stageName = lc.stageName ?? currentReq.status ?? '草稿';
                    const fmtDate = (v: string | undefined) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-');
                    const fmtDt = (v: string | undefined) => (v ? formatDateTime(v, 'YYYY-MM-DD HH:mm:ss') : '-');
                    return [
                      {
                        key: 'code',
                        label: t('app.kuaizhizao.purchaseRequisition.col.code'),
                        children: (
                          <Space size={4}>
                            <span>{currentReq.requisition_code ?? '-'}</span>
                            {currentReq.requisition_code ? (
                              <Button
                                type="link"
                                size="small"
                                icon={<CopyOutlined style={{ fontSize: 12 }} />}
                                onClick={() => handleCopyRequisitionCode(currentReq.requisition_code!)}
                                aria-label={t('app.kuaizhizao.purchaseRequisition.form.copyCodeAria')}
                              />
                            ) : null}
                          </Space>
                        ),
                      },
                      { key: 'name', label: t('app.kuaizhizao.purchaseRequisition.col.name'), children: currentReq.requisition_name ?? '-' },
                      {
                        key: 'status',
                        label: t('common.status'),
                        children: <Tag {...getDocumentLifecycleStageTagProps(stageName)}>{stageName}</Tag>,
                      },
                      { key: 'src', label: t('app.kuaizhizao.purchaseRequisition.col.sourceCode'), children: currentReq.source_code ?? '-' },
                      {
                        key: 'stype',
                        label: t('app.kuaizhizao.purchaseRequisition.col.sourceType'),
                        children: formatPurchaseRequisitionSourceType(currentReq.source_type, t),
                      },
                      { key: 'reqd', label: t('app.kuaizhizao.purchaseRequisition.col.requiredDate'), children: fmtDate(currentReq.required_date) },
                      {
                        key: 'notes',
                        label: t('app.kuaizhizao.common.fieldNotes'),
                        span: 3,
                        children: currentReq.notes?.trim() ? currentReq.notes : '-',
                      },
                      { key: 'rd', label: t('app.kuaizhizao.purchaseRequisition.form.date'), children: fmtDate(currentReq.requisition_date) },
                      { key: 'applicant', label: t('app.kuaizhizao.purchaseRequisition.form.applicant'), children: currentReq.applicant_name ?? '-' },
                      { key: 'cat', label: t('common.createdAt'), children: fmtDt(currentReq.created_at) },
                      { key: 'uat', label: t('common.updatedAt'), children: fmtDt(currentReq.updated_at) },
                    ];
                  })()}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionCollaboration')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getPurchaseRequisitionLifecycle(currentReq, purchaseRequestAuditEnabled);
                    const mainStages = lifecycle.mainStages ?? [];
                    return (
                      <DetailLifecycleCollaborationBlock
                        record={currentReq}
                        auditEnabled={purchaseRequestAuditEnabled}
                      >
                        {mainStages.length > 0 && (
                          <UniLifecycleStepper
                            steps={mainStages}
                            status={lifecycle.status}
                            showLabels
                            nextStepSuggestions={lifecycle.nextStepSuggestions}
                            hideNextStepSuggestions
                          />
                        )}
                      </DetailLifecycleCollaborationBlock>
                    );
                  })()}
                  {currentReq.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType="purchase_requisition"
                      documentId={currentReq.id}
                      active={detailVisible}
                      selfDocumentId={currentReq.id}
                      renderBriefActions={(doc) => (
                        <WarehouseTraceBriefPrimaryActions
                          doc={doc}
                          t={t}
                          navigate={navigate}
                          closeDrawer={() => {
                            setDetailVisible(false);
                            setCurrentReq(null);
                          }}
                        />
                      )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
                <style>{`
                  .purchase-requisition-detail-drawer-items .ant-table-wrapper .ant-table-body,
                  .purchase-requisition-detail-drawer-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                `}</style>
                {currentReq.items && currentReq.items.length > 0 ? (
                  <div
                    className="purchase-requisition-detail-drawer-items"
                    style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                  >
                    <Table
                      size="small"
                      rowKey="id"
                      tableLayout="fixed"
                      style={{ minWidth: PURCHASE_REQUISITION_DETAIL_ITEMS_MIN_WIDTH }}
                      pagination={false}
                      dataSource={currentReq.items}
                      columns={[
                        { title: t('app.kuaizhizao.purchaseRequisition.col.materialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: t('app.kuaizhizao.purchaseRequisition.col.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                        { title: t('app.kuaizhizao.purchaseRequisition.col.spec'), dataIndex: 'material_spec', width: 120, ellipsis: true },
                        { title: t('app.kuaizhizao.purchaseRequisition.col.quantity'), dataIndex: 'quantity', width: 88, align: 'right' },
                        {
                          title: t('app.kuaizhizao.purchaseRequisition.col.unit'),
                          dataIndex: 'unit',
                          width: 100,
                          ellipsis: true,
                          render: (_: unknown, record: PurchaseRequisitionItem) => (
                            <MaterialUnitSelect
                              materialId={record.material_id}
                              value={record.unit}
                              disabled
                              size="small"
                              noStyle
                            />
                          ),
                        },
                        {
                          title: t('app.kuaizhizao.purchaseRequisition.col.suggestedPrice'),
                          dataIndex: 'suggested_unit_price',
                          width: 140,
                          align: 'right',
                          render: (v: number) => `¥${Number(v || 0).toFixed(2)}`,
                        },
                        {
                          title: t('app.kuaizhizao.purchaseRequisition.col.requiredDate'),
                          dataIndex: 'required_date',
                          width: 120,
                          ellipsis: true,
                          render: (v: string | undefined) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
                        },
                        {
                          title: t('app.kuaizhizao.purchaseRequisition.col.converted'),
                          dataIndex: 'purchase_order_id',
                          width: 80,
                          render: (v: number | undefined) => (v ? <Tag color="success">{t('app.kuaizhizao.purchaseRequisition.convertedYes')}</Tag> : <Tag>{t('app.kuaizhizao.purchaseRequisition.convertedNo')}</Tag>),
                        },
                      ]}
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.salesOrder.emptyItems')} />
                )}
              </DetailDrawerSection>

              {currentReq.id != null && (
                <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
                  {prTracking.loading && (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                      <Spin />
                    </div>
                  )}
                  {prTracking.error && !prTracking.loading && (
                    <Typography.Text type="danger">{prTracking.error}</Typography.Text>
                  )}
                  {prTracking.data && !prTracking.loading && (
                    <DocumentTrackingTimelineBody data={prTracking.data} />
                  )}
                </DetailDrawerSection>
              )}
            </>
          )
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
    return (qty * price).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
          { title: t('app.kuaizhizao.purchaseRequisition.convert.col.demandQty'), dataIndex: 'quantity', width: 88, align: 'right', render: (v: any) => Number(v ?? 0) },
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
                  precision={4}
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
