/**
 * 采购询价单
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormDatePicker, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography, Alert } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, EyeOutlined, FormOutlined, PlusOutlined, SwapOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniAuditBatchMenuButton } from '../../../../../components/uni-batch';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, FORM_LAYOUT, MODAL_CONFIG, detailDrawerDescriptionItems } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { buildUniPushMenuItems, buildUniPushToolbarDisabledReason, UniPushToolbarButton } from '../../../../../components/uni-push';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { buildFutureDateShortcutFieldProps, FutureDatePicker } from '../../../../../utils/futureDatePickerShortcuts';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_WIDTH } from '../../sales-management/shared/DocumentPushProgressBar';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import {
  approvePurchaseInquiry,
  awardInquiryQuotes,
  closeInquiryQuoting,
  convertInquiryToPurchaseOrder,
  createInquiryFromRequisition,
  createPurchaseInquiry,
  deletePurchaseInquiry,
  getInquiryComparison,
  getPurchaseInquiry,
  listPurchaseInquiries,
  previewPushInquiryToPurchaseOrder,
  publishPurchaseInquiry,
  submitPurchaseInquiry,
  updatePurchaseInquiry,
  upsertSupplierQuote,
  withdrawPurchaseInquirySubmit,
  withdrawPurchaseInquiryApproval,
  type ComparisonRow,
  type PurchaseInquiry,
  type PurchaseInquiryItem,
  type PurchaseInquiryVendor,
} from '../../../services/purchase-inquiry';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import {
  buildPurchaseInquiryLifecycleValueEnum,
  getPurchaseInquiryLifecycle,
  isInquiryDraft,
  isInquiryPendingCompare,
  isInquiryQuoting,
  resolvePurchaseInquiryListLifecycleParams,
} from '../../../utils/purchaseInquiryLifecycle';
import { listPurchaseRequisitions, previewPushToInquiry, type PurchaseRequisition, type DocumentPushPreview } from '../../../services/purchase-requisition';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import { formatDateTime, formatNumber, formatQuantity } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  purchaseInquiryCapabilityReasonMessage,
  purchaseRequisitionCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';

type PullPurchaseRequisitionCandidate = {
  id: number;
  requisition_code?: string;
  requisition_name?: string;
  applicant_name?: string;
  requisition_date?: string;
  status?: string;
  required_date?: string;
  items_count?: number;
  capabilities?: PurchaseRequisition['capabilities'];
};

const PURCHASE_INQUIRY_RESOURCE = 'kuaizhizao:purchase-inquiry';
/** 仅覆盖 buyer_name：询价单需靠后展示采购员；其余字段用 GLOBAL_DOC_LIST_FIELD_RANK */
const PURCHASE_INQUIRY_LIST_FIELD_RANK = {
  ...SALES_DOC_LIST_FIELD_RANK,
  buyer_name: 59.4,
};

const PurchaseInquiriesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<PurchaseInquiry[]>([]);
  const auditEnabled = useAuditRequired('kuaizhizao', 'purchase-inquiry');
  const purchaseInquiryPerms = useResourcePermissions(PURCHASE_INQUIRY_RESOURCE);
  const pullFromRequisitionAction = resolveKuaizhizaoDocumentAction(t, 'purchase_inquiry.pull_from_requisition');
  const pushToPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'purchase_order.pull_from_inquiry');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseInquiry | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [editItems, setEditItems] = useState<PurchaseInquiryItem[]>([]);
  const [editVendors, setEditVendors] = useState<PurchaseInquiryVendor[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteForm] = Form.useForm();
  const [pendingQuoteFormValues, setPendingQuoteFormValues] = useState<Record<string, unknown> | null>(null);
  const [quoteSupplierId, setQuoteSupplierId] = useState<number | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareInquiryId, setCompareInquiryId] = useState<number | null>(null);
  const [compareRows, setCompareRows] = useState<ComparisonRow[]>([]);
  const [awardSelection, setAwardSelection] = useState<Record<number, number>>({});
  const [supplierOptions, setSupplierOptions] = useState<Array<{ id: number; name: string; code?: string }>>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewConfirming, setPullPreviewConfirming] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pullPreviewRequisitionId, setPullPreviewRequisitionId] = useState<number | null>(null);
  const [pullSelectedItemIds, setPullSelectedItemIds] = useState<number[]>([]);

  const [pushPoPreviewOpen, setPushPoPreviewOpen] = useState(false);
  const [pushPoPreviewLoading, setPushPoPreviewLoading] = useState(false);
  const [pushPoPreviewConfirming, setPushPoPreviewConfirming] = useState(false);
  const [pushPoPreviewData, setPushPoPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pushPoTarget, setPushPoTarget] = useState<PurchaseInquiry | null>(null);
  const [pushPoSelectedItemIds, setPushPoSelectedItemIds] = useState<number[]>([]);

  const pullQueryCloseRef = useRef<(() => void) | null>(null);

  const selectedInquiriesForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is PurchaseInquiry => row != null),
    [selectedRowKeys],
  );

  const purchaseInquiryAuditBatchHandlers = useMemo(
    () => ({
      submit: (id: number) => submitPurchaseInquiry(id),
      withdraw: (id: number) => withdrawPurchaseInquirySubmit(id),
      approve: (id: number) => approvePurchaseInquiry(id, true),
      revoke: (id: number) => withdrawPurchaseInquiryApproval(id),
    }),
    [],
  );

  const handlePurchaseInquiryAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, []);

  const [addVendorModalOpen, setAddVendorModalOpen] = useState(false);
  const [selectedSupplierIdsForAdd, setSelectedSupplierIdsForAdd] = useState<number[]>([]);

  const availableSuppliersForAdd = useMemo(
    () => supplierOptions.filter((s) => !editVendors.some((v) => v.supplier_id === s.id)),
    [supplierOptions, editVendors],
  );

  useEffect(() => {
    void supplierApi.list?.({ isActive: true, limit: 500 } as never).then((res: unknown) => {
      const list = Array.isArray(res) ? res : (res as { data?: Array<{ id: number; name: string; code?: string }> })?.data ?? [];
      setSupplierOptions(list.map((s) => ({ id: s.id, name: s.name, code: s.code })));
    }).catch(() => {});
  }, []);

  const openDetail = async (record: PurchaseInquiry) => {
    const full = await getPurchaseInquiry(record.id!);
    setDetail(full);
    setDetailOpen(true);
  };

  const openEdit = async (record: PurchaseInquiry) => {
    const full = await getPurchaseInquiry(record.id!);
    setEditingId(full.id!);
    setEditItems(full.items ?? []);
    setEditVendors(full.vendors ?? []);
    setPendingEditFormValues({
      inquiry_name: full.inquiry_name,
      inquiry_date: full.inquiry_date ? dayjs(full.inquiry_date) : undefined,
      quote_deadline: full.quote_deadline ? dayjs(full.quote_deadline) : undefined,
      notes: full.notes,
      attachments: mapAttachmentsToUploadList(full.attachments),
      __inquiry_edit_item: (full.items ?? []).map((item) => ({ material_id: item.material_id })),
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    const values = await editForm.validateFields();
    const payload = {
      inquiry_name: values.inquiry_name,
      inquiry_date: values.inquiry_date?.format('YYYY-MM-DD'),
      quote_deadline: values.quote_deadline?.format('YYYY-MM-DD'),
      notes: values.notes,
      attachments: normalizeDocumentAttachments(values.attachments),
      items: editItems.map((item) => ({
        material_id: item.material_id!,
        material_code: item.material_code!,
        material_name: item.material_name!,
        material_spec: item.material_spec,
        unit: item.unit ?? '件',
        quantity: item.quantity!,
        required_date: item.required_date,
        source_requisition_item_id: item.source_requisition_item_id,
        notes: item.notes,
      })),
      vendors: editVendors.map((v) => ({
        supplier_id: v.supplier_id!,
        supplier_name: v.supplier_name!,
        notes: v.notes,
      })),
    };
    if (editingId) {
      await updatePurchaseInquiry(editingId, payload);
      message.success(t('common.updateSuccess'));
    } else {
      const doc = await createPurchaseInquiry(payload);
      message.success(t('app.kuaizhizao.purchaseInquiry.created', { code: doc.inquiry_code }));
    }
    setEditOpen(false);
    setPendingEditFormValues(null);
    actionRef.current?.reload();
  };

  const handleCreate = () => {
    setEditingId(null);
    setEditItems([]);
    setEditVendors([]);
    setPendingEditFormValues({
      inquiry_date: dayjs(),
      attachments: [],
      __inquiry_edit_item: [],
    });
    setEditOpen(true);
  };

  const openQuoteEntry = (inquiry: PurchaseInquiry, supplierId: number) => {
    setQuoteSupplierId(supplierId);
    const existing = inquiry.quotes?.find((q) => q.supplier_id === supplierId);
    quoteForm.resetFields();
    const initial: Record<string, unknown> = {
      quote_date: existing?.quote_date ? dayjs(existing.quote_date) : dayjs(),
      valid_until: existing?.valid_until ? dayjs(existing.valid_until) : undefined,
      notes: existing?.notes,
    };
    (inquiry.items ?? []).forEach((item) => {
      const line = existing?.items?.find((i) => i.inquiry_item_id === item.id);
      initial[`qty_${item.id}`] = line?.quoted_quantity ?? item.quantity;
      initial[`price_${item.id}`] = line?.unit_price ?? 0;
      initial[`date_${item.id}`] = line?.delivery_date ? dayjs(line.delivery_date) : item.required_date ? dayjs(item.required_date) : undefined;
    });
    setPendingQuoteFormValues(initial);
    setQuoteOpen(true);
  };

  const saveQuote = async () => {
    if (!detail?.id || !quoteSupplierId) return;
    const values = await quoteForm.validateFields();
    const vendor = detail.vendors?.find((v) => v.supplier_id === quoteSupplierId);
    await upsertSupplierQuote(detail.id, {
      supplier_id: quoteSupplierId,
      supplier_name: vendor?.supplier_name,
      quote_date: values.quote_date?.format('YYYY-MM-DD'),
      valid_until: values.valid_until?.format('YYYY-MM-DD'),
      notes: values.notes,
      items: (detail.items ?? []).map((item) => ({
        inquiry_item_id: item.id!,
        quoted_quantity: values[`qty_${item.id}`],
        unit_price: values[`price_${item.id}`],
        delivery_date: values[`date_${item.id}`]?.format('YYYY-MM-DD'),
      })),
    });
    message.success(t('app.kuaizhizao.purchaseInquiry.quoteSaved'));
    setQuoteOpen(false);
    setDetail(await getPurchaseInquiry(detail.id));
    actionRef.current?.reload();
  };

  const openCompare = async (inquiry: PurchaseInquiry) => {
    const inquiryId = inquiry.id;
    if (!inquiryId) {
      message.warning(t('app.kuaizhizao.purchaseInquiry.compareAwardMissingInquiry'));
      return;
    }
    const matrix = await getInquiryComparison(inquiryId);
    setCompareInquiryId(inquiryId);
    setCompareRows(matrix.rows);
    const init: Record<number, number> = {};
    matrix.rows.forEach((row) => {
      const awarded = row.cells.find((c) => c.is_awarded && c.quote_item_id);
      if (awarded?.quote_item_id) init[row.inquiry_item_id] = awarded.quote_item_id;
      else {
        const lowest = row.cells.find((c) => c.is_lowest_price && c.quote_item_id);
        if (lowest?.quote_item_id) init[row.inquiry_item_id] = lowest.quote_item_id;
      }
    });
    setAwardSelection(init);
    setCompareOpen(true);
  };

  const confirmAward = async () => {
    if (!compareInquiryId) {
      message.warning(t('app.kuaizhizao.purchaseInquiry.compareAwardMissingInquiry'));
      return;
    }
    const rowCount = compareRows.length;
    const hasSelectableQuote = compareRows.some((row) =>
      row.cells.some((cell) => cell.quote_item_id),
    );
    if (!rowCount || !hasSelectableQuote) {
      message.warning(t('app.kuaizhizao.purchaseInquiry.selectAwardQuoteNoQuote'));
      return;
    }
    const awards = Object.entries(awardSelection)
      .filter(([, quoteItemId]) => quoteItemId)
      .map(([inquiryItemId, quoteItemId]) => ({
        inquiry_item_id: Number(inquiryItemId),
        quote_item_id: Number(quoteItemId),
      }));
    if (!awards.length) {
      message.warning(t('app.kuaizhizao.purchaseInquiry.selectAwardQuote'));
      return;
    }
    if (awards.length < rowCount) {
      message.warning(
        t('app.kuaizhizao.purchaseInquiry.selectAwardQuoteIncomplete', {
          selected: awards.length,
          total: rowCount,
        }),
      );
      return;
    }
    try {
      await awardInquiryQuotes(compareInquiryId, awards);
      message.success(t('app.kuaizhizao.purchaseInquiry.awardSuccess'));
      setCompareOpen(false);
      setCompareInquiryId(null);
      if (detail?.id === compareInquiryId) {
        setDetail(await getPurchaseInquiry(compareInquiryId));
      }
      actionRef.current?.reload();
    } catch (error: unknown) {
      const err = error as { message?: string; response?: { data?: { detail?: string } } };
      message.error(
        err?.response?.data?.detail || err?.message || t('app.kuaizhizao.purchaseInquiry.awardFailed'),
      );
    }
  };

  const resetPullPreviewModal = useCallback(() => {
    setPullPreviewOpen(false);
    setPullPreviewData(null);
    setPullPreviewRequisitionId(null);
    setPullSelectedItemIds([]);
  }, []);

  const showPullCreatePreview = useCallback(
    (requisitionId: number) => {
      setPullPreviewOpen(true);
      setPullPreviewLoading(true);
      setPullPreviewConfirming(false);
      setPullPreviewData(null);
      setPullPreviewRequisitionId(requisitionId);
      setPullSelectedItemIds([]);
      previewPushToInquiry(requisitionId)
        .then((res) => {
          setPullPreviewData(res);
          const ids = (res.items || [])
            .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
            .map((row) => Number(row.item_id));
          setPullSelectedItemIds(ids);
        })
        .catch((error: unknown) => {
          message.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseInquiry.pull.previewFailed')));
          resetPullPreviewModal();
        })
        .finally(() => setPullPreviewLoading(false));
    },
    [message, resetPullPreviewModal, t],
  );

  const handlePullPreviewConfirm = useCallback(async () => {
    if (!pullPreviewRequisitionId || !pullPreviewData) return;
    if (pullPreviewData.has_blocking_issues) return;
    const rowById = new Map(
      (pullPreviewData.items || []).map((row) => [Number(row.item_id), row]),
    );
    const selectedIds = pullSelectedItemIds.filter((id) => {
      const row = rowById.get(id);
      return row && Number(row.max_push_quantity ?? 0) > 0;
    });
    if (!selectedIds.length) {
      message.warning(t('app.kuaizhizao.purchaseInquiry.selectRequisitionLinesFirst'));
      return;
    }
    setPullPreviewConfirming(true);
    try {
      const doc = await createInquiryFromRequisition(pullPreviewRequisitionId, { item_ids: selectedIds });
      message.success(
        doc.inquiry_code
          ? t('app.kuaizhizao.purchaseInquiry.createdFromPullWithCodes', {
              target: pullFromRequisitionAction.targetLabel,
              codes: doc.inquiry_code,
            })
          : t('app.kuaizhizao.purchaseInquiry.createdFromPull', {
              source: pullFromRequisitionAction.sourceLabel,
              target: pullFromRequisitionAction.targetLabel,
            }),
      );
      actionRef.current?.reload();
      resetPullPreviewModal();
      if (doc.id) {
        const full = await getPurchaseInquiry(doc.id);
        await openEdit(full);
      }
    } catch (error: unknown) {
      message.error(
        getApiErrorMessage(
          error,
          t('app.kuaizhizao.purchaseInquiry.createFromPullFailed', {
            source: pullFromRequisitionAction.sourceLabel,
            target: pullFromRequisitionAction.targetLabel,
          }),
        ),
      );
    } finally {
      setPullPreviewConfirming(false);
    }
  }, [
    message,
    openEdit,
    pullFromRequisitionAction.sourceLabel,
    pullFromRequisitionAction.targetLabel,
    pullPreviewData,
    pullPreviewRequisitionId,
    pullSelectedItemIds,
    resetPullPreviewModal,
    t,
  ]);

  const isPullInquirySourceSelectable = useCallback(
    (record: { capabilities?: { push_inquiry?: { allowed?: boolean } } }) =>
      record.capabilities?.push_inquiry?.allowed === true,
    [],
  );

  const pullDocumentScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromRequisitionQuery = useUniPullQuery<PullPurchaseRequisitionCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const result = await listPurchaseRequisitions({
          skip: 0,
          limit: 200,
          keyword: keyword.trim() || undefined,
        });
        const rows = (result.data ?? []).filter((row) => row.id != null) as PullPurchaseRequisitionCandidate[];
        const filtered = filterByPullScope(rows, scope, isPullInquirySourceSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseInquiry.loadRequisitionsFailed')));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (record) => !isPullInquirySourceSelectable(record),
    onConfirm: async (keys) => {
      const requisitionId = Number(keys[0]);
      if (!requisitionId || requisitionId <= 0) {
        message.warning(t('app.kuaizhizao.purchaseInquiry.selectRequisitionFirst'));
        return;
      }
      pullQueryCloseRef.current?.();
      showPullCreatePreview(requisitionId);
    },
  });

  pullQueryCloseRef.current = pullFromRequisitionQuery.closeModal;

  const resetPushPoPreviewModal = useCallback(() => {
    setPushPoPreviewOpen(false);
    setPushPoPreviewData(null);
    setPushPoTarget(null);
    setPushPoSelectedItemIds([]);
  }, []);

  const openPushPoPreview = useCallback(
    async (inquiry: PurchaseInquiry) => {
      if (!inquiry.id) return;
      setPushPoPreviewOpen(true);
      setPushPoPreviewLoading(true);
      setPushPoPreviewConfirming(false);
      setPushPoPreviewData(null);
      setPushPoTarget(inquiry);
      setPushPoSelectedItemIds([]);
      try {
        const preview = await previewPushInquiryToPurchaseOrder(inquiry.id);
        setPushPoPreviewData(preview);
        const ids = (preview.items || [])
          .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
          .map((row) => Number(row.item_id));
        setPushPoSelectedItemIds(ids);
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseInquiry.push.previewFailed')));
        resetPushPoPreviewModal();
      } finally {
        setPushPoPreviewLoading(false);
      }
    },
    [message, resetPushPoPreviewModal, t],
  );

  const handlePushPoPreviewConfirm = useCallback(async () => {
    if (!pushPoTarget?.id || !pushPoPreviewData || pushPoPreviewData.has_blocking_issues) return;
    const rowById = new Map(
      (pushPoPreviewData.items || []).map((row) => [Number(row.item_id), row]),
    );
    const selectedIds = pushPoSelectedItemIds.filter((id) => {
      const row = rowById.get(id);
      return row && Number(row.max_push_quantity ?? 0) > 0;
    });
    if (!selectedIds.length) {
      message.warning(t('app.kuaizhizao.purchaseInquiry.push.selectLines'));
      return;
    }
    setPushPoPreviewConfirming(true);
    try {
      const res = await convertInquiryToPurchaseOrder(pushPoTarget.id, { item_ids: selectedIds });
      message.success(
        t('app.kuaizhizao.purchaseInquiry.purchaseOrdersGenerated', { count: res.purchase_orders?.length ?? 0 }),
      );
      if (detail?.id === pushPoTarget.id) {
        setDetail(await getPurchaseInquiry(pushPoTarget.id));
      }
      actionRef.current?.reload();
      resetPushPoPreviewModal();
      setSelectedRowKeys([]);
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseInquiry.push.failed')));
    } finally {
      setPushPoPreviewConfirming(false);
    }
  }, [
    detail?.id,
    message,
    pushPoPreviewData,
    pushPoSelectedItemIds,
    pushPoTarget,
    resetPushPoPreviewModal,
    t,
  ]);

  const selectedInquiryForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return tableRowsRef.current.find((row) => row.id === id) ?? null;
  }, [selectedRowKeys]);

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) return;
    let success = 0;
    let failed = 0;
    for (const key of keys) {
      const id = Number(key);
      if (!Number.isFinite(id) || id <= 0) {
        failed += 1;
        continue;
      }
      try {
        await deletePurchaseInquiry(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.purchaseInquiry.batchDeleteSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.purchaseInquiry.batchDeletePartial', { count: failed }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const canPushPurchaseOrder = !!selectedInquiryForToolbar?.capabilities?.push_purchase_order?.allowed;

  const toolbarPushDisabledReason = useMemo(() => {
    const base = buildUniPushToolbarDisabledReason(t, {
      selectedCount: selectedRowKeys.length,
      hasSelectedRecord: !!selectedInquiryForToolbar,
    });
    if (base) return base;
    if (selectedInquiryForToolbar && !canPushPurchaseOrder) {
      return (
        purchaseInquiryCapabilityReasonMessage(
          selectedInquiryForToolbar.capabilities?.push_purchase_order?.reason,
          t,
        ) || t('app.kuaizhizao.purchaseInquiry.push.notAwarded')
      );
    }
    return undefined;
  }, [canPushPurchaseOrder, selectedInquiryForToolbar, selectedRowKeys.length, t]);

  const toolbarPushMenuItems = useMemo(
    () =>
      buildUniPushMenuItems([
        {
          key: 'push-purchase-order',
          label: pushToPurchaseOrderAction.label,
          disabled: !selectedInquiryForToolbar || !canPushPurchaseOrder,
          title: !canPushPurchaseOrder && selectedInquiryForToolbar
            ? purchaseInquiryCapabilityReasonMessage(
                selectedInquiryForToolbar.capabilities?.push_purchase_order?.reason,
                t,
              )
            : undefined,
          onClick: () => {
            if (selectedInquiryForToolbar && canPushPurchaseOrder) {
              void openPushPoPreview(selectedInquiryForToolbar);
            }
          },
        },
      ]),
    [canPushPurchaseOrder, openPushPoPreview, pushToPurchaseOrderAction.label, selectedInquiryForToolbar, t],
  );

  useEffect(() => {
    const id = searchParams.get('inquiryId');
    if (id) {
      getPurchaseInquiry(Number(id)).then((doc) => openEdit(doc)).finally(() => {
        searchParams.delete('inquiryId');
        setSearchParams(searchParams, { replace: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const purchaseInquiryLifecycleValueEnum = useMemo(
    () => buildPurchaseInquiryLifecycleValueEnum(t),
    [t],
  );
  const purchaseInquiryAuditColumn = useMemo(
    () => createListAuditPhaseColumn<PurchaseInquiry>({ t, auditEnabled }),
    [t, auditEnabled],
  );
  const resolveInquiryPushPercent = useCallback((record: PurchaseInquiry): number => {
    const stageName = String(getPurchaseInquiryLifecycle(record as Record<string, unknown>).stageName ?? '').trim();
    const status = String(record.status ?? '').trim();
    if (stageName === '已转单' || status === '已转单' || status === 'CONVERTED') return 100;
    return 0;
  }, []);

  const columns: ProColumns<PurchaseInquiry>[] = useMemo(
    () => alignProColumns<PurchaseInquiry>([
    {
      title: t('app.kuaizhizao.purchaseInquiry.colQuoteDeadline'),
      dataIndex: 'quote_deadline_range',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('app.kuaizhizao.purchaseInquiry.colNameInquiryCode'),
      key: 'inquiry_code',
      dataIndex: 'inquiry_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      sorter: true,
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.inquiry_name ?? '')}
          secondary={String(r.inquiry_code ?? '')}
        />
      ),
    },
    { title: t('app.kuaizhizao.purchaseInquiry.colInquiryCode'), dataIndex: 'inquiry_code', hideInTable: true, hideInSearch: false },
    { title: t('app.kuaizhizao.purchaseInquiry.colName'), dataIndex: 'inquiry_name', hideInTable: true, hideInSearch: false, ellipsis: true },
    { title: t('app.kuaizhizao.purchaseInquiry.colSourceCode'), dataIndex: 'source_code', width: 132, uniTableKeepWidth: true, sorter: true, hideInSearch: false, ellipsis: true },
    { title: t('app.kuaizhizao.purchaseInquiry.colBuyer'), dataIndex: 'buyer_name', width: 100, sorter: true, hideInSearch: true },
    {
      title: t('app.kuaizhizao.purchaseInquiry.colQuoteDeadline'),
      dataIndex: 'quote_deadline',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => (r.quote_deadline ? formatDateTime(r.quote_deadline, 'YYYY-MM-DD') : '-'),
    },
    {
      title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
      dataIndex: 'downstream_push_progress',
      width: DOCUMENT_PROGRESS_COLUMN_WIDTH,
      uniTableKeepWidth: true,
      hideInSearch: true,
      render: (_, r) => <DocumentPushProgressBar percent={resolveInquiryPushPercent(r)} />,
    },
    {
      title: t('app.kuaizhizao.purchaseOrder.col.totalQuantity'),
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right' as const,
      hideInSearch: true,
      render: (_, r) => (formatQuantity(r.total_quantity)),
    },
    {
      title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
      dataIndex: 'total_amount',
      width: 120,
      align: 'right' as const,
      hideInSearch: true,
      render: (_, r) => (r.total_amount != null ? `¥${formatNumber(r.total_amount, 2)}` : '-'),
    },
    ...buildDocumentAuditColumns<PurchaseInquiry>(t),
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
    ...(purchaseInquiryAuditColumn ? [purchaseInquiryAuditColumn] : []),
    {
      title: t('app.kuaizhizao.purchaseInquiry.colLifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      width: 170,
      fixed: 'right',
      uniTableKeepWidth: true,
      align: 'left',
      valueType: 'select',
      valueEnum: purchaseInquiryLifecycleValueEnum,
      render: (_, record) => (
        <ListUniLifecycleCell lifecycle={getPurchaseInquiryLifecycle(record as Record<string, unknown>)} />
      ),
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      minWidth: 280,
      fixed: 'right',
      render: (_, record) => {
        const isDraft = isInquiryDraft(record);
        const canUpdate = record.capabilities?.update?.allowed === true && purchaseInquiryPerms.canUpdate;
        const canDelete = record.capabilities?.delete?.allowed === true && purchaseInquiryPerms.canDelete;
        const canSubmit = record.capabilities?.submit?.allowed === true && purchaseInquiryPerms.canUpdate;
        const parts: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="view" onClick={() => openDetail(record)}>
            {t('common.detail')}
          </Button>,
        ];

        if (isDraft) {
          parts.push(
            <Button {...rowActionKind('update')} key="edit" disabled={!canUpdate} onClick={() => canUpdate && openEdit(record)}>
              {t('common.edit')}
            </Button>,
          );
          parts.push(
            <Button
              {...rowActionKind('delete')}
              key="del"
              disabled={!canDelete}
              onClick={() => {
                if (!canDelete) return;
                modal.confirm({
                  title: t('app.kuaizhizao.purchaseInquiry.confirmDelete'),
                  onOk: async () => {
                    await deletePurchaseInquiry(record.id!);
                    message.success(t('app.kuaizhizao.purchaseInquiry.deleted'));
                    actionRef.current?.reload();
                  },
                });
              }}
            >
              {t('common.delete')}
            </Button>,
          );
          parts.push(
            <Button
              {...rowActionKind('submit')}
              key="submit"
              disabled={!canSubmit}
              onClick={async () => {
                if (!canSubmit) return;
                await submitPurchaseInquiry(record.id!);
                message.success(t('app.kuaizhizao.purchaseInquiry.submitSuccess'));
                actionRef.current?.reload();
              }}
            >
              {t('app.kuaizhizao.purchaseInquiry.submit')}
            </Button>,
          );
          parts.push(
            <Button
              {...rowActionKind('release')}
              key="publish"
              disabled={!purchaseInquiryPerms.canUpdate}
              onClick={async () => {
                if (!purchaseInquiryPerms.canUpdate) return;
                await publishPurchaseInquiry(record.id!);
                message.success(t('app.kuaizhizao.purchaseInquiry.publishSuccess'));
                actionRef.current?.reload();
              }}
            >
              {t('app.kuaizhizao.purchaseInquiry.publishInquiry')}
            </Button>,
          );
        }

        if (isInquiryQuoting(record)) {
          parts.push(
            <Button
              {...rowActionKind('update')}
              key="close-quoting"
              disabled={!purchaseInquiryPerms.canUpdate}
              onClick={async () => {
                if (!purchaseInquiryPerms.canUpdate) return;
                await closeInquiryQuoting(record.id!);
                message.success(t('app.kuaizhizao.purchaseInquiry.closeQuotingSuccess'));
                actionRef.current?.reload();
              }}
            >
              {t('app.kuaizhizao.purchaseInquiry.closeQuoting')}
            </Button>,
          );
        }

        if (isInquiryPendingCompare(record) || isInquiryQuoting(record)) {
          parts.push(
            <Button {...rowActionKind('read')} key="compare" onClick={() => void openCompare(record)}>
              {t('app.kuaizhizao.purchaseInquiry.compareAward')}
            </Button>,
          );
        }

        parts.push(
          <UniWorkflowActions
            {...rowActionKind('skip')}
            key="workflow-actions"
            record={record}
            entityName={t('app.kuaizhizao.purchaseInquiry.entityName')}
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={['DRAFT', '草稿']}
            pendingStatuses={['PENDING', 'PENDING_REVIEW', '待审核']}
            approvedStatuses={['APPROVED', '已通过', '审核通过']}
            rejectedStatuses={['REJECTED', '已驳回']}
            onSuccess={() => {
              actionRef.current?.reload();
              if (detailOpen && detail?.id === record.id && record.id != null) {
                void getPurchaseInquiry(record.id)
                  .then(setDetail)
                  .catch(() => {});
              }
            }}
          />,
        );

        return parts;
      },
    },
  ], PURCHASE_INQUIRY_LIST_FIELD_RANK),
    [auditEnabled, detail, detailOpen, message, modal, openCompare, purchaseInquiryAuditColumn, purchaseInquiryLifecycleValueEnum, purchaseInquiryPerms.canDelete, purchaseInquiryPerms.canUpdate, resolveInquiryPushPercent, t],
  );

  const request = useCallback(
    async (
      params: Record<string, unknown>,
      sort?: Record<string, 'ascend' | 'descend' | null>,
      _filter?: Record<string, unknown>,
      searchFormValues?: Record<string, unknown>,
    ) => {
      const sf = searchFormValues ?? {};
      const lifecycleParams = resolvePurchaseInquiryListLifecycleParams(sf, params);
      const { sortBy, sortOrder } = extractProTableSort(sort);
      const orderBy =
        sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
      const fuzzyKeyword = typeof sf.keyword === 'string' ? sf.keyword.trim() : '';
      const apiParams: Parameters<typeof listPurchaseInquiries>[0] = {
        skip: (((params.current as number) || 1) - 1) * ((params.pageSize as number) || 20),
        limit: (params.pageSize as number) || 20,
        ...lifecycleParams,
        order_by: orderBy,
      };
      if (fuzzyKeyword) {
        apiParams.keyword = fuzzyKeyword;
      } else {
        if (sf.inquiry_code != null && String(sf.inquiry_code).trim()) {
          apiParams.inquiry_code = String(sf.inquiry_code).trim();
        }
        if (sf.inquiry_name != null && String(sf.inquiry_name).trim()) {
          apiParams.inquiry_name = String(sf.inquiry_name).trim();
        }
        if (sf.source_code != null && String(sf.source_code).trim()) {
          apiParams.source_code = String(sf.source_code).trim();
        }
      }
      const deadlineRange = sf.quote_deadline_range as [unknown, unknown] | undefined;
      if (deadlineRange && Array.isArray(deadlineRange) && deadlineRange[0]) {
        apiParams.quote_deadline_from = formatDateTime(deadlineRange[0] as string | Date, 'YYYY-MM-DD');
        apiParams.quote_deadline_to = deadlineRange[1]
          ? formatDateTime(deadlineRange[1] as string | Date, 'YYYY-MM-DD')
          : apiParams.quote_deadline_from;
      }
      const createdRange = sf.created_at_range as [unknown, unknown] | undefined;
      if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
        apiParams.created_start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
        apiParams.created_end_date = createdRange[1]
          ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
          : apiParams.created_start_date;
      }
      const list = await listPurchaseInquiries(apiParams);
      tableRowsRef.current = list.data ?? [];
      return { data: list.data ?? [], success: true, total: list.total ?? list.data?.length ?? 0 };
    },
    [],
  );

  const addEditItem = () => {
    setEditItems((prev) => {
      const next = [
        ...prev,
        { material_id: undefined, material_code: '', material_name: '', unit: '件', quantity: 1 },
      ];
      editForm.setFieldValue(
        '__inquiry_edit_item',
        next.map((item) => ({ material_id: item.material_id })),
      );
      return next;
    });
  };

  const openAddVendorModal = () => {
    setSelectedSupplierIdsForAdd([]);
    setAddVendorModalOpen(true);
  };

  const handleConfirmAddVendors = () => {
    if (!selectedSupplierIdsForAdd.length) {
      message.warning(t('app.kuaizhizao.purchaseInquiry.selectSuppliersFirst'));
      return;
    }
    const toAdd = supplierOptions.filter(
      (s) => selectedSupplierIdsForAdd.includes(s.id) && !editVendors.some((v) => v.supplier_id === s.id),
    );
    if (!toAdd.length) {
      message.warning(t('app.kuaizhizao.purchaseInquiry.suppliersAlreadyAdded'));
      return;
    }
    setEditVendors((prev) => [
      ...prev,
      ...toAdd.map((s) => ({ supplier_id: s.id, supplier_name: s.name })),
    ]);
    setAddVendorModalOpen(false);
    setSelectedSupplierIdsForAdd([]);
    message.success(t('app.kuaizhizao.purchaseInquiry.vendorsAdded', { count: toAdd.length }));
  };

  const formatSupplierLabel = useCallback(
    (s: { id: number; name: string; code?: string }) => (s.code ? `${s.code} - ${s.name}` : s.name),
    [],
  );

  const editVendorColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseInquiry.supplier'),
        dataIndex: 'supplier_name',
        render: (name: string, record: PurchaseInquiryVendor) => {
          const matched = supplierOptions.find((s) => s.id === record.supplier_id);
          return matched ? formatSupplierLabel(matched) : name;
        },
      },
      {
        title: t('common.actions'),
        width: 80,
        render: (_: unknown, r: PurchaseInquiryVendor) => (
          <Button type="link" danger size="small" onClick={() => setEditVendors((prev) => prev.filter((v) => v.supplier_id !== r.supplier_id))}>
            {t('app.kuaizhizao.purchaseInquiry.remove')}
          </Button>
        ),
      },
    ],
    [supplierOptions, t, formatSupplierLabel],
  );

  const editItemColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseInquiry.material'),
        width: 280,
        render: (_: unknown, r: PurchaseInquiryItem, idx: number) => (
          <UniMaterialSelect
            name={['__inquiry_edit_item', idx, 'material_id']}
            label=""
            size="small"
            formItemProps={{ style: { margin: 0 } }}
            fallbackOption={
              r.material_id
                ? { value: r.material_id, label: `${r.material_code || ''} - ${r.material_name || ''}`.trim() || String(r.material_id) }
                : undefined
            }
            onChange={(_, mat) => {
              if (!mat) return;
              setEditItems((prev) => {
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  material_id: mat.id,
                  material_code: mat.code,
                  material_name: mat.name,
                  material_spec: mat.spec,
                  unit: mat.unit ?? '件',
                };
                return next;
              });
            }}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseInquiry.quantity'),
        width: 120,
        render: (_: unknown, r: PurchaseInquiryItem, idx: number) => (
          <InputNumber
            min={0}
            size="small"
            style={{ width: '100%' }}
            value={r.quantity}
            onChange={(v) => setEditItems((prev) => {
              const next = [...prev];
              next[idx] = { ...next[idx], quantity: v ?? 0 };
              return next;
            })}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseInquiry.requiredDate'),
        width: 160,
        render: (_: unknown, r: PurchaseInquiryItem, idx: number) => (
          <FutureDatePicker
            size="small"
            style={{ width: '100%' }}
            value={r.required_date ? dayjs(r.required_date) : undefined}
            getForm={() => editForm}
            baseFieldName="inquiry_date"
            t={t}
            onApply={(d) => setEditItems((prev) => {
              const next = [...prev];
              next[idx] = { ...next[idx], required_date: d.format('YYYY-MM-DD') };
              return next;
            })}
            onChange={(d) => setEditItems((prev) => {
              const next = [...prev];
              next[idx] = { ...next[idx], required_date: d?.format('YYYY-MM-DD') };
              return next;
            })}
          />
        ),
      },
      {
        title: t('common.actions'),
        width: 60,
        fixed: 'right' as const,
        render: (_: unknown, __: PurchaseInquiryItem, idx: number) => (
          <Button type="link" danger size="small" onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}>{t('app.kuaizhizao.purchaseInquiry.deleteLine')}</Button>
        ),
      },
    ],
    [t],
  );

  const detailVendorColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseInquiry.supplier'), dataIndex: 'supplier_name', ellipsis: true },
      {
        title: t('app.kuaizhizao.purchaseInquiry.quoteStatus'),
        width: 100,
        render: (_: unknown, v: PurchaseInquiryVendor) => (
          <Tag color={v.status === 'QUOTED' ? 'success' : 'default'}>
            {v.status === 'QUOTED' ? t('app.kuaizhizao.purchaseInquiry.quoted') : t('app.kuaizhizao.purchaseInquiry.pendingQuote')}
          </Tag>
        ),
      },
      {
        title: t('common.actions'),
        width: 160,
        render: (_: unknown, v: PurchaseInquiryVendor) => {
          if (!detail) return null;
          const canQuote = isInquiryQuoting(detail) || isInquiryPendingCompare(detail);
          if (!canQuote) {
            return v.status === 'QUOTED' ? (
              <Typography.Text type="secondary">{t('app.kuaizhizao.purchaseInquiry.recorded')}</Typography.Text>
            ) : (
              <Typography.Text type="secondary">—</Typography.Text>
            );
          }
          const quoted = v.status === 'QUOTED';
          return (
            <Button
              type={quoted ? 'link' : 'primary'}
              size="small"
              icon={<FormOutlined />}
              onClick={() => openQuoteEntry(detail, v.supplier_id!)}
            >
              {quoted ? t('app.kuaizhizao.purchaseInquiry.editQuote') : t('app.kuaizhizao.purchaseInquiry.enterQuoteHere')}
            </Button>
          );
        },
      },
    ],
    [detail, t],
  );

  const detailItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseInquiry.colMaterialCode'), dataIndex: 'material_code', width: 120 },
      { title: t('app.kuaizhizao.purchaseInquiry.colMaterialName'), dataIndex: 'material_name' },
      { title: t('app.kuaizhizao.purchaseInquiry.quantity'), dataIndex: 'quantity', width: 90, render: formatQuantity },
      { title: t('app.kuaizhizao.purchaseInquiry.colUnit'), dataIndex: 'unit', width: 60 },
      { title: t('app.kuaizhizao.purchaseInquiry.requiredDate'), dataIndex: 'required_date', width: 110, render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-') },
    ],
    [t],
  );

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<PurchaseInquiry>[]>(
    () => [
      {
        title: t('app.kuaizhizao.purchaseInquiry.source'),
        dataIndex: 'source_code',
      },
      {
        title: t('app.kuaizhizao.purchaseInquiry.colBuyer'),
        dataIndex: 'buyer_name',
      },
      {
        title: t('app.kuaizhizao.purchaseInquiry.inquiryDate'),
        dataIndex: 'inquiry_date',
        valueType: 'date',
      },
      {
        title: t('app.kuaizhizao.purchaseInquiry.colQuoteDeadline'),
        dataIndex: 'quote_deadline',
        valueType: 'date',
      },
      {
        title: t('app.kuaizhizao.purchaseInquiry.notes'),
        dataIndex: 'notes',
        span: 2,
      },
    ],
    [t],
  );

  const detailCollaboration = useMemo(() => {
    if (!detail) return undefined;
    const lifecycle = getPurchaseInquiryLifecycle(detail as Record<string, unknown>);
    const mainStages = lifecycle.mainStages ?? [];
    if (!mainStages.length) return undefined;
    return (
      <UniLifecycleStepper
        steps={mainStages}
        status={lifecycle.status}
        showLabels
        nextStepSuggestions={lifecycle.nextStepSuggestions}
        hideNextStepSuggestions
      />
    );
  }, [detail]);

  const detailSupplementary = useMemo(() => {
    if (!detail) return undefined;
    return (
      <>
        {isInquiryDraft(detail) ? (
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            {t('app.kuaizhizao.purchaseInquiry.hintAfterPublish')}
          </Typography.Text>
        ) : null}
        {(isInquiryQuoting(detail) || isInquiryPendingCompare(detail)) ? (
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            {t('app.kuaizhizao.purchaseInquiry.hintQuoting')}
          </Typography.Text>
        ) : null}
        {(detail.vendors ?? []).length > 0 ? (
          <Table
            size="small"
            pagination={false}
            rowKey="supplier_id"
            dataSource={detail.vendors ?? []}
            columns={detailVendorColumns}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseInquiry.emptyVendorsInDetail')} />
        )}
      </>
    );
  }, [detail, detailVendorColumns, t]);

  const detailLines = useMemo(() => {
    if (!detail) return undefined;
    return (
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={detail.items ?? []}
        columns={detailItemColumns}
        locale={{ emptyText: t('app.kuaizhizao.salesReturn.emptyItems') }}
      />
    );
  }, [detail, detailItemColumns, t]);

  const quoteItemColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseInquiry.colMaterialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
      { title: t('app.kuaizhizao.purchaseInquiry.colMaterialName'), dataIndex: 'material_name', width: 180, ellipsis: true },
      {
        title: t('app.kuaizhizao.purchaseInquiry.inquiryQuantity'),
        width: 100,
        align: 'right' as const,
        render: (_: unknown, item: PurchaseInquiryItem) => `${item.quantity ?? '-'} ${item.unit ?? ''}`.trim(),
      },
      {
        title: t('app.kuaizhizao.purchaseInquiry.quotedQuantity'),
        width: 110,
        render: (_: unknown, item: PurchaseInquiryItem) => (
          <Form.Item
            name={`qty_${item.id}`}
            style={{ margin: 0 }}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <InputNumber min={0} precision={2} style={{ width: '100%' }} size="small" />
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseInquiry.unitPrice'),
        width: 120,
        render: (_: unknown, item: PurchaseInquiryItem) => (
          <Form.Item
            name={`price_${item.id}`}
            style={{ margin: 0 }}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <InputNumber min={0} precision={4} style={{ width: '100%' }} size="small" />
          </Form.Item>
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseInquiry.promisedDeliveryDate'),
        width: 140,
        render: (_: unknown, item: PurchaseInquiryItem) => (
          <Form.Item name={`date_${item.id}`} style={{ margin: 0 }}>
            <DatePicker style={{ width: '100%' }} size="small" />
          </Form.Item>
        ),
      },
    ],
    [t],
  );

  const compareColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseInquiry.material'), width: 220, render: (_: unknown, r: ComparisonRow) => `${r.material_code} ${r.material_name}` },
      { title: t('app.kuaizhizao.purchaseInquiry.quantity'), dataIndex: 'quantity', width: 80, align: 'right' as const, render: formatQuantity },
      ...(compareRows[0]?.cells ?? []).map((cell, idx) => ({
        title: cell.supplier_name ?? t('app.kuaizhizao.purchaseInquiry.supplierFallback', { index: idx + 1 }),
        width: 148,
        align: 'center' as const,
        render: (_: unknown, row: ComparisonRow) => {
          const c = row.cells[idx];
          if (!c?.quote_item_id) return '-';
          const selected = awardSelection[row.inquiry_item_id] === c.quote_item_id;
          const priceText = c.unit_price != null ? Number(c.unit_price).toFixed(4) : '-';
          return (
            <Space size={4} align="center" wrap={false} style={{ whiteSpace: 'nowrap' }}>
              <Button
                type={selected ? 'primary' : 'default'}
                size="small"
                icon={selected ? <CheckOutlined /> : undefined}
                onClick={() => setAwardSelection((prev) => ({ ...prev, [row.inquiry_item_id]: c.quote_item_id! }))}
                style={c.is_lowest_price && !selected ? { borderColor: '#52c41a', color: '#389e0d' } : undefined}
              >
                {priceText}
              </Button>
              {c.is_lowest_price ? (
                <Tag color="success" style={{ margin: 0, fontSize: 11, lineHeight: '18px', flexShrink: 0 }}>
                  {t('app.kuaizhizao.purchaseInquiry.lowest')}
                </Tag>
              ) : null}
            </Space>
          );
        },
      })),
    ],
    [awardSelection, compareRows, t],
  );

  const pullRequisitionColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.purchaseInquiry.colRequisitionCode'), dataIndex: 'requisition_code', width: 170, ellipsis: true },
      { title: t('app.kuaizhizao.purchaseInquiry.colRequisitionName'), dataIndex: 'requisition_name', width: 180, ellipsis: true, render: (v: string) => v || '-' },
      { title: t('app.kuaizhizao.purchaseInquiry.colApplicant'), dataIndex: 'applicant_name', width: 100, render: (v: string) => v || '-' },
      {
        title: t('app.kuaizhizao.purchaseInquiry.colRequiredDate'),
        dataIndex: 'required_date',
        width: 120,
        render: (v: string) => (v ? formatDateTime(v, 'YYYY-MM-DD') : '-'),
      },
      { title: t('app.kuaizhizao.purchaseInquiry.colItemCount'), dataIndex: 'items_count', width: 90, align: 'right' as const },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 110,
        render: (v: string) => <Tag color={v?.includes('转单') ? 'gold' : 'blue'}>{v || '-'}</Tag>,
      },
      {
        title: t('app.kuaizhizao.purchaseInquiry.colInquiryPullStatus'),
        key: 'pull_status',
        width: 160,
        render: (_: unknown, record: PullPurchaseRequisitionCandidate) =>
          record.capabilities?.push_inquiry?.allowed ? (
            <Tag color="green">{t('app.kuaizhizao.purchaseInquiry.eligibleForInquiry')}</Tag>
          ) : (
            <Tag color="gold">
              {purchaseRequisitionCapabilityReasonMessage(record.capabilities?.push_inquiry?.reason, t)
                || t('app.kuaizhizao.purchaseInquiry.notEligibleForInquiry')}
            </Tag>
          ),
      },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<PurchaseInquiry>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={request}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-inquiries.v2"
        pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
        pinnedTabsValueEnum={purchaseInquiryLifecycleValueEnum}
        showAdvancedSearch={true}
        skipFuzzyPinyinClientFilter
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.purchaseInquiry.confirmBatchDelete', { count })}
        toolBarActionsAfterDelete={[
          <UniAuditBatchMenuButton
            key="purchase-inquiry-batch-menu"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedInquiriesForBatch}
            auditEnabled={auditEnabled}
            permGates={purchaseInquiryPerms}
            handlers={purchaseInquiryAuditBatchHandlers}
            onSuccess={handlePurchaseInquiryAuditBatchSuccess}
            toolBarButtonSize="middle"
          />,
        ]}
        toolBarRender={() => [
          <UniPullCreateToolbar
            key="create-purchase-inquiry-with-pull"
            compactKey="create-purchase-inquiry-with-pull"
            createIcon={<PlusOutlined />}
            createLabel={t('app.kuaizhizao.purchaseInquiry.createInquiry')}
            onCreate={handleCreate}
            menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
              {
                key: 'pull-from-requisition',
                actionKey: 'purchase_inquiry.pull_from_requisition',
                onClick: pullFromRequisitionQuery.openModal,
              },
            ])}
          />,
          <UniPushToolbarButton
            key={`purchase-inquiry-push-${selectedInquiryForToolbar?.id ?? 'none'}`}
            menuItems={toolbarPushMenuItems}
            disabled={selectedRowKeys.length !== 1 || !selectedInquiryForToolbar}
            disabledReason={toolbarPushDisabledReason}
          />,
        ]}
      />

      <FormModalTemplate
        title={editingId ? t('app.kuaizhizao.purchaseInquiry.editTitle') : t('app.kuaizhizao.purchaseInquiry.createModalTitle')}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingEditFormValues) {
              editForm.setFieldsValue(pendingEditFormValues);
            }
            return;
          }
          editForm.resetFields();
          setPendingEditFormValues(null);
        }}
        onFinish={handleSaveEdit}
        form={editForm}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        grid={false}
      >
        <Row gutter={FORM_LAYOUT.GRID_GUTTER}>
          <Col span={10}>
            <ProFormText name="inquiry_name" label={t('app.kuaizhizao.purchaseInquiry.inquiryName')} rules={[{ required: true }]} />
          </Col>
          <Col span={7}>
            <ProFormDatePicker
              name="inquiry_date"
              label={t('app.kuaizhizao.purchaseInquiry.inquiryDate')}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={7}>
            <ProFormDatePicker
              name="quote_deadline"
              label={t('app.kuaizhizao.purchaseInquiry.quoteDeadline')}
              fieldProps={buildFutureDateShortcutFieldProps({
                getForm: () => editForm,
                fieldName: 'quote_deadline',
                baseFieldName: 'inquiry_date',
                t,
              })}
            />
          </Col>
        </Row>

        <div className="uni-table-detail" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>{t('app.kuaizhizao.purchaseInquiry.invitedVendors')}</span>
            {editVendors.length > 0 && (
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={openAddVendorModal}>
                {t('app.kuaizhizao.purchaseInquiry.addVendor')}
              </Button>
            )}
          </div>
          {editVendors.length > 0 ? (
            <Table
              size="small"
              pagination={false}
              rowKey={(r) => r.supplier_id!}
              dataSource={editVendors}
              columns={editVendorColumns}
            />
          ) : (
            <div
              style={{
                padding: 24,
                background: '#fafafa',
                borderRadius: 4,
                border: '1px dashed var(--river-border-color)',
                textAlign: 'center',
                color: '#999',
              }}
            >
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseInquiry.emptyInvitedVendors')} />
              <Button type="primary" ghost icon={<PlusOutlined />} onClick={openAddVendorModal} style={{ marginTop: 12 }}>
                {t('app.kuaizhizao.purchaseInquiry.addVendor')}
              </Button>
            </div>
          )}
        </div>

        <div className="uni-table-detail" style={{ marginBottom: 24 }}>
          <Space style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>{t('app.kuaizhizao.purchaseInquiry.inquiryItems')}</span>
            <Button size="small" onClick={addEditItem}>{t('app.kuaizhizao.purchaseInquiry.addLine')}</Button>
          </Space>
          <Table
            size="small"
            pagination={false}
            style={{ width: '100%' }}
            scroll={{ x: 720 }}
            rowKey={(_, idx) => String(idx)}
            dataSource={editItems}
            columns={editItemColumns}
          />
        </div>

        <ProFormTextArea name="notes" label={t('app.kuaizhizao.purchaseInquiry.notes')} fieldProps={{ rows: 2 }} />
        <DocumentAttachmentsField category="purchase_inquiry_attachments" />
      </FormModalTemplate>

      <Modal
        title={t('app.kuaizhizao.purchaseInquiry.selectVendorTitle')}
        open={addVendorModalOpen}
        onOk={handleConfirmAddVendors}
        onCancel={() => {
          setAddVendorModalOpen(false);
          setSelectedSupplierIdsForAdd([]);
        }}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: selectedSupplierIdsForAdd.length === 0 }}
        destroyOnHidden
      >
        <Select
          mode="multiple"
          placeholder={t('app.kuaizhizao.purchaseInquiry.searchVendorPlaceholder')}
          options={availableSuppliersForAdd.map((s) => ({
            label: formatSupplierLabel(s),
            value: s.id,
          }))}
          value={selectedSupplierIdsForAdd}
          onChange={setSelectedSupplierIdsForAdd}
          style={{ width: '100%' }}
          showSearch
          allowClear
          maxTagCount="responsive"
          filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
          notFoundContent={availableSuppliersForAdd.length === 0 ? t('app.kuaizhizao.purchaseInquiry.noAvailableVendors') : undefined}
        />
        {availableSuppliersForAdd.length === 0 && (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
            {t('app.kuaizhizao.purchaseInquiry.noSuppliersHint')}
          </Typography.Text>
        )}
      </Modal>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.purchaseInquiry.detailTitle', { code: detail?.inquiry_code ?? '' })}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH ?? DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detail ? (
            <Space wrap>
              {isInquiryDraft(detail) && (
                <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); void openEdit(detail); }}>{t('common.edit')}</Button>
              )}
              {isInquiryDraft(detail) && (
                <Button icon={<ThunderboltOutlined />} onClick={async () => {
                  await submitPurchaseInquiry(detail.id!);
                  message.success(t('app.kuaizhizao.purchaseInquiry.submitSuccess'));
                  setDetail(await getPurchaseInquiry(detail.id!));
                  actionRef.current?.reload();
                }}>{t('app.kuaizhizao.purchaseInquiry.submit')}</Button>
              )}
              {isInquiryDraft(detail) && (
                <Button type="primary" onClick={async () => {
                  await publishPurchaseInquiry(detail.id!);
                  message.success(t('app.kuaizhizao.purchaseInquiry.publishSuccess'));
                  setDetail(await getPurchaseInquiry(detail.id!));
                  actionRef.current?.reload();
                }}>{t('app.kuaizhizao.purchaseInquiry.publishInquiry')}</Button>
              )}
              {isInquiryQuoting(detail) && (
                <Button onClick={async () => {
                  await closeInquiryQuoting(detail.id!);
                  message.success(t('app.kuaizhizao.purchaseInquiry.closeQuotingSuccess'));
                  setDetail(await getPurchaseInquiry(detail.id!));
                  actionRef.current?.reload();
                }}>{t('app.kuaizhizao.purchaseInquiry.closeQuoting')}</Button>
              )}
              {(isInquiryPendingCompare(detail) || isInquiryQuoting(detail)) && (
                <Button onClick={() => void openCompare(detail)}>{t('app.kuaizhizao.purchaseInquiry.compareAward')}</Button>
              )}
              <UniWorkflowActions {...rowActionKind('skip')}
                record={detail}
                entityName={t('app.kuaizhizao.purchaseInquiry.entityName')}
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={['DRAFT', '草稿']}
                pendingStatuses={['PENDING', 'PENDING_REVIEW', '待审核']}
                approvedStatuses={['APPROVED', '已通过', '审核通过']}
                rejectedStatuses={['REJECTED', '已驳回']}
                onSuccess={async () => {
                  actionRef.current?.reload();
                  if (detail.id) setDetail(await getPurchaseInquiry(detail.id));
                }}
              />
            </Space>
          ) : null
        }
        basic={
          detail ? (
            <Descriptions
              column={3}
              size="small"
              items={detailDrawerDescriptionItems(
                detailBasicColumns.filter((col) => {
                  if (col.dataIndex !== 'notes') return true;
                  const notes = String(detail.notes ?? '').trim();
                  return notes.length > 0;
                }),
                detail,
              )}
            />
          ) : undefined
        }
        collaboration={detailCollaboration}
        collaborationAuditRecord={detail}
        supplementaryTitle={t('app.kuaizhizao.purchaseInquiry.invitedVendors')}
        supplementary={detailSupplementary}
        linesTitle={t('app.kuaizhizao.purchaseInquiry.inquiryItems')}
        lines={detailLines}
      />

      <Modal
        title={`${t('app.kuaizhizao.purchaseInquiry.enterSupplierQuoteTitle')}${quoteSupplierId && detail?.vendors ? ` - ${detail.vendors.find((v) => v.supplier_id === quoteSupplierId)?.supplier_name ?? ''}` : ''}`}
        open={quoteOpen}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={() => {
          setQuoteOpen(false);
          setPendingQuoteFormValues(null);
        }}
        onOk={() => void saveQuote()}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingQuoteFormValues) {
              quoteForm.setFieldsValue(pendingQuoteFormValues);
            }
            return;
          }
          quoteForm.resetFields();
          setPendingQuoteFormValues(null);
        }}
        destroyOnHidden
      >
        <Form form={quoteForm} layout="vertical">
          <Row gutter={FORM_LAYOUT.GRID_GUTTER}>
            <Col span={12}>
              <Form.Item name="quote_date" label={t('app.kuaizhizao.purchaseInquiry.quoteDate')} rules={[{ required: true, message: t('app.kuaizhizao.purchaseInquiry.selectQuoteDateRequired') }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="valid_until" label={t('app.kuaizhizao.purchaseInquiry.validUntil')}>
                <FutureDatePicker
                  style={{ width: '100%' }}
                  placeholder={t('app.kuaizhizao.purchaseInquiry.selectDatePlaceholder')}
                  getForm={() => quoteForm}
                  baseFieldName="quote_date"
                  fieldName="valid_until"
                  t={t}
                />
              </Form.Item>
            </Col>
          </Row>

          <div className="uni-table-detail" style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>{t('app.kuaizhizao.purchaseInquiry.quoteItems')}</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
              {t('app.kuaizhizao.purchaseInquiry.quoteItemsHint')}
            </Typography.Text>
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              scroll={{ x: 860 }}
              dataSource={detail?.items ?? []}
              columns={quoteItemColumns}
            />
          </div>

          <Form.Item name="notes" label={t('app.kuaizhizao.purchaseInquiry.notes')}>
            <Input.TextArea rows={2} placeholder={t('app.kuaizhizao.purchaseInquiry.quoteNotesPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('app.kuaizhizao.purchaseInquiry.compareAwardTitle')}
        open={compareOpen}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={() => {
          setCompareOpen(false);
          setCompareInquiryId(null);
        }}
        onOk={() => void confirmAward()}
      >
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          {t('app.kuaizhizao.purchaseInquiry.compareAwardHint')}
        </Typography.Text>
        {!compareRows.some((row) => row.cells.some((cell) => cell.quote_item_id)) ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={t('app.kuaizhizao.purchaseInquiry.selectAwardQuoteNoQuote')}
          />
        ) : null}
        <Table
          size="small"
          pagination={false}
          rowKey="inquiry_item_id"
          dataSource={compareRows}
          scroll={{ x: 'max-content' }}
          columns={compareColumns}
        />
      </Modal>

      <UniPullQueryModal<PullPurchaseRequisitionCandidate>
        open={pullFromRequisitionQuery.open}
        title={pullFromRequisitionAction.label}
        onCancel={pullFromRequisitionQuery.closeModal}
        onOk={pullFromRequisitionQuery.handleConfirm}
        rowKey="id"
        columns={pullRequisitionColumns}
        dataSource={pullFromRequisitionQuery.dataSource}
        loading={pullFromRequisitionQuery.loading}
        confirmLoading={pullFromRequisitionQuery.confirmLoading}
        selectionType={pullFromRequisitionQuery.selectionType}
        selectedRowKeys={pullFromRequisitionQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromRequisitionQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromRequisitionQuery.isRowDisabled}
        searchDraft={pullFromRequisitionQuery.searchDraft}
        onSearchDraftChange={pullFromRequisitionQuery.setSearchDraft}
        onSearchApply={pullFromRequisitionQuery.handleSearchApply}
        onSearchClear={pullFromRequisitionQuery.handleSearchClear}
        appliedKeyword={pullFromRequisitionQuery.appliedKeyword}
        searchPlaceholder={t('app.kuaizhizao.purchaseInquiry.searchRequisitionPlaceholder')}
        emptyText={t('app.kuaizhizao.purchaseInquiry.emptyNoRequisitions')}
        emptySearchText={t('app.kuaizhizao.purchaseInquiry.emptyNoRequisitionSearchResults')}
        page={pullFromRequisitionQuery.page}
        pageSize={pullFromRequisitionQuery.pageSize}
        total={pullFromRequisitionQuery.total}
        onPageChange={pullFromRequisitionQuery.handlePageChange}
        scopeOptions={pullFromRequisitionQuery.scopeOptions}
        scope={pullFromRequisitionQuery.scope}
        onScopeChange={pullFromRequisitionQuery.handleScopeChange}
        okText={t('common.next')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      <Modal
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pullPreviewOpen}
        destroyOnClose
        width={1100}
        onCancel={resetPullPreviewModal}
        okText={t('app.kuaizhizao.purchaseInquiry.createInquiryOk')}
        cancelText={t('common.cancel')}
        confirmLoading={pullPreviewConfirming}
        onOk={() => void handlePullPreviewConfirm()}
        okButtonProps={{
          disabled:
            pullPreviewLoading ||
            !pullPreviewData ||
            !!pullPreviewData?.has_blocking_issues,
        }}
      >
        {pullPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pullPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPreviewData.summary}</p>
            {pullPreviewData.has_blocking_issues && pullPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  purchaseRequisitionCapabilityReasonMessage(pullPreviewData.blocking_reason, t)
                    || t('app.kuaizhizao.purchaseInquiry.createFromPullFailed', {
                      source: pullFromRequisitionAction.sourceLabel,
                      target: pullFromRequisitionAction.targetLabel,
                    })
                }
              />
            ) : null}
            {pullPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pullPreviewData.items}
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
                          checked={pullSelectedItemIds.includes(itemId)}
                          onChange={(checked) => {
                            setPullSelectedItemIds((prev) =>
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
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseInquiry.pull.previewNoLines')} />
            )}
            {pullPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pullPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={pushToPurchaseOrderAction.label}
        open={pushPoPreviewOpen}
        destroyOnClose
        width={1100}
        onCancel={resetPushPoPreviewModal}
        okText={pushToPurchaseOrderAction.label}
        cancelText={t('common.cancel')}
        confirmLoading={pushPoPreviewConfirming}
        onOk={() => void handlePushPoPreviewConfirm()}
        okButtonProps={{
          disabled:
            pushPoPreviewLoading ||
            !pushPoPreviewData ||
            !!pushPoPreviewData?.has_blocking_issues,
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
                  purchaseInquiryCapabilityReasonMessage(pushPoPreviewData.blocking_reason, t)
                    || t('app.kuaizhizao.purchaseInquiry.push.failed')
                }
              />
            ) : null}
            {pushPoPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPoPreviewData.items}
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
                          checked={pushPoSelectedItemIds.includes(itemId)}
                          onChange={(checked) => {
                            setPushPoSelectedItemIds((prev) =>
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
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseInquiry.push.previewNoLines')} />
            )}
            {pushPoPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pushPoPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </ListPageTemplate>
  );
};

export default PurchaseInquiriesPage;
