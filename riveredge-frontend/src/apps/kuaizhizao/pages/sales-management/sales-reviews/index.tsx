/**
 * 订单评审列表与详情
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  Alert,
  App,
  Button,
  Descriptions,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Result,
  Space,
  Spin,
  Table,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';
import {
  DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
  renderDocumentLineMaterialsPreview,
} from '../shared/documentLineMaterialsPreview';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  useDetailDrawerDescriptionItems,
} from '../../../../../components/layout-templates';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { UniBatchButton, UniAuditBatchMenuButton } from '../../../../../components/uni-batch';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import {
  quotationCapabilityAllowed,
  quotationCapabilityReasonMessage,
} from '../../../../../hooks/useDocumentCapabilities';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { formatDateTime, formatBusinessDateOnly, todaySiteDateString, formatAmount } from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  renderSalesReviewRiskMarkerTag,
  renderSalesReviewStatusTag,
  renderSalesReviewUrgencyMarkerTag,
  translateSalesReviewStatus,
} from '../../../utils/salesReviewPresentation';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import {
  UniPullQueryModal,
  UNI_PULL_QUERY_MAX_FETCH_LIMIT,
  pagePullCandidates,
  renderPullQueryDocStatus,
  renderPullQueryReviewStatus,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';
import {
  alignProColumns,
  alignDescriptionColumns,
  GLOBAL_DOC_LIST_FIELD_RANK,
  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
} from '../shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  salesReviewApi,
  type SalesReview,
  type SalesReviewListItem,
  type SalesReviewPushPreview,
} from '../../../services/sales-review';
import {
  listQuotations,
  type Quotation,
  type QuotationCapabilities,
} from '../../../services/quotation';
import { SalesReviewFormModal } from './FormModal';
import { SalesReviewReviewModal } from './ReviewModal';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import {
  SalesReviewDeptOpinionsPanel,
  validateDeptOpinionForm,
} from './DeptOpinionsPanel';

type SalesReviewBatchRecord = SalesReviewListItem & {
  capabilities: {
    submit: { allowed: boolean };
    withdraw_submit: { allowed: boolean };
  };
};

function synthesizeSalesReviewBatchCapabilities(row: SalesReviewListItem): SalesReviewBatchRecord {
  return {
    ...row,
    capabilities: {
      submit: { allowed: row.status === 'draft' || row.status === 'rejected' },
      withdraw_submit: { allowed: row.status === 'reviewing' },
    },
  };
}

const SALES_REVIEW_RESOURCE = 'kuaizhizao:sales-review';
const COLUMN_PERSISTENCE_ID = 'apps.kuaizhizao.pages.sales-management.sales-reviews-width-v2';

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
  sales_review_id?: number;
  sales_review_code?: string;
  capabilities?: QuotationCapabilities;
};

const isPullQuotationSelectable = (record: PullQuotationCandidate): boolean =>
  quotationCapabilityAllowed(record as Quotation, 'convert_to_sales_review');

function canEditStatus(status?: string): boolean {
  return status === 'draft' || status === 'rejected';
}

/** 与后端 delete 允许状态一致 */
function canDeleteStatus(status?: string): boolean {
  return status === 'draft' || status === 'rejected' || status === 'cancelled';
}

const SalesReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const pullFromQuotationAction = resolveKuaizhizaoDocumentAction(t, 'sales_review.pull_from_quotation');
  const pushToSalesOrderAction = resolveKuaizhizaoDocumentAction(t, 'sales_order.pull_from_sales_review');
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const actionRef = useRef<ActionType>(null);
  const detailIdRef = useRef<number | null>(null);
  const tableRowsRef = useRef<SalesReviewListItem[]>([]);
  const perms = useResourcePermissions(SALES_REVIEW_RESOURCE);
  const canSubmit = perms.canAction?.('submit') ?? false;
  const canApprove = perms.canAction?.('approve') ?? false;
  const canReject = perms.canAction?.('reject') ?? false;
  const canRevoke = perms.canAction?.('revoke') ?? false;
  const canExecute = perms.canAction?.('execute') ?? false;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalesReview | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<SalesReview | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [opinionForms, setOpinionForms] = useState<Record<string, { result: 'pass' | 'fail'; opinion: string }>>({});
  const [pushPreview, setPushPreview] = useState<SalesReviewPushPreview | null>(null);
  const [pushPreviewOpen, setPushPreviewOpen] = useState(false);
  const [pushTargetId, setPushTargetId] = useState<number | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewModalId, setReviewModalId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const reloadTable = () => actionRef.current?.reload();

  const clearTableSelection = useCallback(() => {
    actionRef.current?.clearSelected?.();
    setSelectedRowKeys([]);
  }, []);

  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is SalesReviewListItem => row != null)
        .map(synthesizeSalesReviewBatchCapabilities),
    [selectedRowKeys],
  );

  const canToolbarBatchDelete = useMemo(
    () =>
      Boolean(perms.canDelete) &&
      selectedRecordsForBatch.length > 0 &&
      selectedRecordsForBatch.some((row) => canDeleteStatus(row.status)),
    [perms.canDelete, selectedRecordsForBatch],
  );

  const canToolbarBatchReject = useMemo(
    () =>
      Boolean(canReject) &&
      selectedRecordsForBatch.length > 0 &&
      selectedRecordsForBatch.some((row) => row.status === 'reviewing'),
    [canReject, selectedRecordsForBatch],
  );

  const selectedSingleReview = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return tableRowsRef.current.find((row) => Number(row.id) === id) ?? null;
  }, [selectedRowKeys]);

  const canToolbarPush = Boolean(
    selectedSingleReview &&
      canExecute &&
      selectedSingleReview.status === 'passed' &&
      !selectedSingleReview.sales_order_code,
  );

  const canToolbarPrint = Boolean(selectedSingleReview && perms.canPrint);

  const pushDisabledReason = useMemo(() => {
    if (selectedRowKeys.length === 0) {
      return t('app.kuaizhizao.salesReview.push.selectOne');
    }
    if (selectedRowKeys.length !== 1) {
      return t('app.kuaizhizao.salesReview.push.singleOnly', { count: selectedRowKeys.length });
    }
    if (!canToolbarPush) {
      return t('app.kuaizhizao.salesReview.push.notAllowed');
    }
    return undefined;
  }, [canToolbarPush, selectedRowKeys.length, t]);

  const openPrintForReview = useCallback(
    (record: { id: number; review_code?: string | null }) => {
      if (!record.id) return;
      openPrint({
        documentType: 'sales_review',
        documentId: record.id,
        pdfDownloadFilename: record.review_code
          ? `${record.review_code}.pdf`
          : `sales-review-${record.id}.pdf`,
      });
    },
    [openPrint],
  );

  const loadDetail = useCallback(
    async (id: number) => {
      detailIdRef.current = id;
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailError(null);
      setDetail(null);
      try {
        const row = await salesReviewApi.get(id);
        if (detailIdRef.current !== id) return;
        setDetail(row);
      } catch (err) {
        if (detailIdRef.current !== id) return;
        setDetailError(getApiErrorMessage(err, t('app.kuaizhizao.salesReview.loadFailed')));
      } finally {
        if (detailIdRef.current === id) setDetailLoading(false);
      }
    },
    [t],
  );

  const refreshDetail = useCallback(async () => {
    const id = detailIdRef.current;
    if (id == null) return;
    try {
      const row = await salesReviewApi.get(id);
      setDetail(row);
      setDetailError(null);
    } catch (err) {
      setDetailError(getApiErrorMessage(err, t('app.kuaizhizao.salesReview.loadFailed')));
    }
  }, [t]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openReviewModal = useCallback((record: SalesReviewListItem | SalesReview) => {
    if (record.status !== 'reviewing') return;
    setReviewModalId(record.id);
    setReviewModalOpen(true);
  }, []);

    const openEdit = async (record: SalesReviewListItem | SalesReview) => {
    try {
      const full = 'items' in record && record.items ? (record as SalesReview) : await salesReviewApi.get(record.id);
      setEditing(full);
      setModalOpen(true);
    } catch (err) {
      message.error(getApiErrorMessage(err, t('app.kuaizhizao.salesReview.loadFailed')));
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setDetail(null);
    setDetailError(null);
    detailIdRef.current = null;
    setOpinionForms({});
  };

  const handleDelete = useCallback(
    async (record: { id: number }, options?: { closeDrawer?: boolean }) => {
      try {
        await salesReviewApi.remove(record.id);
        message.success(t('common.deleteSuccess'));
        if (options?.closeDrawer) closeDetail();
        clearTableSelection();
        reloadTable();
      } catch (err) {
        message.error(getApiErrorMessage(err, t('common.deleteFailed')));
      }
    },
    [clearTableSelection, message, t],
  );

  const handleBatchDelete = useCallback(
    async (keys: React.Key[]) => {
      if (!perms.canDelete) return;
      const deletable = keys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is SalesReviewListItem => row != null && canDeleteStatus(row.status));
      if (deletable.length === 0) return;
      let success = 0;
      let failed = 0;
      for (const row of deletable) {
        try {
          await salesReviewApi.remove(row.id);
          success += 1;
        } catch {
          failed += 1;
        }
      }
      if (success > 0) {
        message.success(t('app.kuaizhizao.salesReview.batchDeleteSuccess', { count: success }));
      }
      if (failed > 0) {
        message.warning(
          t('app.kuaizhizao.salesReview.batchOperationPartial', {
            action: t('common.delete'),
            success,
            failed,
          }),
        );
      }
      clearTableSelection();
      reloadTable();
    },
    [clearTableSelection, message, perms.canDelete, t],
  );

  const handleBatchReject = useCallback(
    async (keys: React.Key[]) => {
      if (!canReject) return;
      const eligible = keys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is SalesReviewListItem => row != null && row.status === 'reviewing');
      if (eligible.length === 0) return;
      let success = 0;
      let failed = 0;
      for (const row of eligible) {
        try {
          await salesReviewApi.reject(row.id);
          success += 1;
        } catch {
          failed += 1;
        }
      }
      const actionLabel = t('app.kuaizhizao.salesReview.actionReject');
      if (success > 0) {
        message.success(
          t('app.kuaizhizao.salesReview.batchOperationSuccess', { action: actionLabel, count: success }),
        );
      }
      if (failed > 0) {
        message.warning(
          t('app.kuaizhizao.salesReview.batchOperationPartial', {
            action: actionLabel,
            success,
            failed,
          }),
        );
      }
      clearTableSelection();
      reloadTable();
    },
    [canReject, clearTableSelection, message, t],
  );

  const salesReviewAuditBatchHandlers = useMemo(
    () => ({
      submit: (id: number) => salesReviewApi.issue(id),
      withdraw: (id: number) => salesReviewApi.withdraw(id),
    }),
    [],
  );

  const handleAuditBatchSuccess = useCallback(() => {
    clearTableSelection();
    reloadTable();
    if (detailOpen && detailIdRef.current != null) {
      void refreshDetail();
    }
  }, [clearTableSelection, detailOpen, refreshDetail]);

  const runDetailAction = async (fn: () => Promise<SalesReview>, successKey: string) => {
    setActionLoading(true);
    try {
      const row = await fn();
      setDetail(row);
      message.success(t(successKey));
      reloadTable();
    } catch (err) {
      message.error(getApiErrorMessage(err, t('common.operationFailed')));
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssue = () => {
    if (!detail) return;
    void runDetailAction(() => salesReviewApi.issue(detail.id), 'app.kuaizhizao.salesReview.issueSuccess');
  };

  const handleIssueFromList = useCallback(
    async (record: SalesReviewListItem) => {
      if (!canSubmit || (record.status !== 'draft' && record.status !== 'rejected')) return;
      try {
        await salesReviewApi.issue(record.id);
        message.success(t('app.kuaizhizao.salesReview.issueSuccess'));
        clearTableSelection();
        reloadTable();
        if (detailOpen && detailIdRef.current === record.id) {
          void refreshDetail();
        }
      } catch (err) {
        message.error(getApiErrorMessage(err, t('common.operationFailed')));
      }
    },
    [canSubmit, clearTableSelection, detailOpen, message, refreshDetail, t],
  );

  const handleWithdraw = () => {
    if (!detail) return;
    void runDetailAction(
      () => salesReviewApi.withdraw(detail.id),
      'app.kuaizhizao.salesReview.withdrawSuccess',
    );
  };

  const handleReject = () => {
    if (!detail) return;
    let reason = '';
    getAntdModal().confirm({
      title: t('app.kuaizhizao.salesReview.rejectConfirm'),
      content: (
        <Input.TextArea
          rows={3}
          placeholder={t('app.kuaizhizao.salesReview.rejectReasonPlaceholder')}
          onChange={(e) => {
            reason = e.target.value;
          }}
        />
      ),
      onOk: () =>
        runDetailAction(
          () => salesReviewApi.reject(detail.id, reason),
          'app.kuaizhizao.salesReview.rejectSuccess',
        ),
    });
  };

  const openPushPreview = async (id?: number) => {
    const targetId = id ?? detail?.id ?? null;
    if (targetId == null) return;
    setPushTargetId(targetId);
    setActionLoading(true);
    try {
      const preview = await salesReviewApi.previewPushToSalesOrder(targetId);
      setPushPreview(preview);
      setPushPreviewOpen(true);
    } catch (err) {
      message.error(getApiErrorMessage(err, t('common.operationFailed')));
      setPushTargetId(null);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmPush = async () => {
    if (pushTargetId == null) return;
    setActionLoading(true);
    try {
      const result = await salesReviewApi.pushToSalesOrder(pushTargetId);
      if (!result.success) {
        message.error(result.message || t('common.operationFailed'));
        return;
      }
      message.success(
        result.sales_order_code
          ? t('app.kuaizhizao.salesReview.pushSuccessWithCode', { code: result.sales_order_code })
          : result.message || t('app.kuaizhizao.salesReview.pushSuccess'),
      );
      setPushPreviewOpen(false);
      setPushTargetId(null);
      if (detailOpen && detailIdRef.current === pushTargetId) {
        await refreshDetail();
      }
      clearTableSelection();
      reloadTable();
    } catch (err) {
      message.error(getApiErrorMessage(err, t('common.operationFailed')));
    } finally {
      setActionLoading(false);
    }
  };

  const submitDeptOpinion = async (deptCode: string) => {
    if (!detail) return;
    const formState = opinionForms[deptCode] || { result: 'pass' as const, opinion: '' };
    const invalid = validateDeptOpinionForm(
      formState,
      t('app.kuaizhizao.salesReview.failOpinionRequired'),
      t('app.kuaizhizao.salesReview.reviewerRequired'),
    );
    if (invalid) {
      message.error(invalid);
      return;
    }
    setActionLoading(true);
    try {
      const row = await salesReviewApi.submitDeptOpinion(detail.id, deptCode, {
        result: formState.result,
        opinion: formState.opinion || null,
        reviewed_by: formState.reviewed_by ?? null,
      });
      setDetail(row);
      message.success(t('app.kuaizhizao.salesReview.deptOpinionSuccess'));
      setOpinionForms((prev) => {
        const next = { ...prev };
        delete next[deptCode];
        return next;
      });
      reloadTable();
    } catch (err) {
      message.error(getApiErrorMessage(err, t('common.operationFailed')));
    } finally {
      setActionLoading(false);
    }
  };

  useNewShortcut(openCreate);

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
        sales_review_id: q.sales_review_id ? Number(q.sales_review_id) : undefined,
        sales_review_code: q.sales_review_code || '',
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
      } catch (err) {
        message.error(getApiErrorMessage(err, t('app.kuaizhizao.salesOrder.loadQuotationsFailed')));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0]);
      const selected = rows[0];
      if (!selectedId || selectedId <= 0) {
        message.warning(t('app.kuaizhizao.salesOrder.selectQuotationFirst'));
        return;
      }
      if (selected && !isPullQuotationSelectable(selected)) {
        const reason =
          quotationCapabilityReasonMessage(selected.capabilities?.convert_to_sales_review?.reason, t) ||
          t('app.kuaizhizao.salesOrder.pullQuotationNotAllowed');
        message.warning(reason);
        return;
      }
      try {
        const result = await salesReviewApi.pullFromQuotation(selectedId);
        const reviewCode = result?.sales_review?.review_code || '';
        message.success(
          result?.message ||
            t('app.kuaizhizao.salesReview.createdFromQuotation', {
              defaultValue: '已从报价单创建订单评审：{{code}}',
              code: reviewCode,
            }),
        );
        pullFromQuotationQuery.closeModal();
        reloadTable();
      } catch (err) {
        message.error(
          getApiErrorMessage(
            err,
            t('app.kuaizhizao.salesOrder.pullCreateFailed', {
              source: pullFromQuotationAction.sourceLabel,
              target: pullFromQuotationAction.targetLabel,
            }),
          ),
        );
        throw err;
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
            ? formatAmount(v)
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
        width: 100,
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
          if (record.sales_review_id) {
            return t('app.kuaizhizao.salesOrder.alreadyCreated', {
              code: record.sales_review_code || '-',
            });
          }
          const reason = quotationCapabilityReasonMessage(
            record.capabilities?.convert_to_sales_review?.reason,
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

  const statusFilterSkipReloadRef = useRef(true);
  useEffect(() => {
    if (statusFilterSkipReloadRef.current) {
      statusFilterSkipReloadRef.current = false;
      return;
    }
    actionRef.current?.reload();
  }, [statusFilter]);

  const columns: ProColumns<SalesReviewListItem>[] = useMemo(() => {
    const cols = [
          {
            title: t('app.kuaizhizao.salesReview.colReviewCode'),
            dataIndex: 'keyword',
            hideInTable: true,
            order: 1,
            fieldProps: {
              placeholder: t('app.kuaizhizao.salesReview.keywordPlaceholder'),
            },
          },
          {
            title: t('app.kuaizhizao.salesReview.colReviewCode'),
            dataIndex: 'review_code',
            key: 'review_code',
            width: 240,
            minWidth: 240,
            uniTableKeepWidth: true,
            uniTablePrimaryFlex: false,
            resizable: false,
            fixed: 'left',
            sorter: true,
            hideInSearch: true,
            render: (_, row) => (
              <UniTableStackedPrimaryCell
                primary={row.customer_name || '—'}
                secondary={row.review_code || '—'}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.salesReview.colCustomer'),
            dataIndex: 'customer_name',
            hideInTable: true,
            hideInSearch: true,
          },
          {
            title: t('app.kuaizhizao.salesReview.colProjectName'),
            dataIndex: 'project_name',
            hideInSearch: true,
            width: 200,
            minWidth: 200,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            sorter: true,
          },
          {
            title: t('app.kuaizhizao.salesReview.colUrgency'),
            dataIndex: 'urgency',
            hideInSearch: true,
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, row) => renderSalesReviewUrgencyMarkerTag(t, row.urgency),
          },
          {
            title: t('app.kuaizhizao.salesReview.colRiskLevel'),
            dataIndex: 'risk_level',
            hideInSearch: true,
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, row) => renderSalesReviewRiskMarkerTag(t, row.risk_level),
          },
          {
            title: t('app.kuaizhizao.salesReview.colDeliveryDate'),
            dataIndex: 'delivery_date',
            hideInSearch: true,
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            sorter: true,
            render: (_, row) => (row.delivery_date ? formatBusinessDateOnly(row.delivery_date) : '—'),
          },
          {
            title: t('app.kuaizhizao.common.colLineMaterials'),
            ...DOCUMENT_LINE_MATERIALS_COLUMN_WIDTH_FLAGS,
            render: (_, row) => renderDocumentLineMaterialsPreview(row.items, t),
          },
          {
            title: t('app.kuaizhizao.salesReview.colTotalAmount'),
            dataIndex: 'total_amount',
            hideInSearch: true,
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            align: 'right',
            render: (_, row) => {
              const n = Number(row.total_amount);
              return Number.isFinite(n) ? n.toFixed(2) : '—';
            },
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            key: 'lifecycle',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => renderSalesReviewStatusTag(t, row.status),
          },
          {
            title: t('app.kuaizhizao.salesReview.colSalesman'),
            dataIndex: 'salesman_name',
            hideInSearch: true,
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
          },
          ...buildDocumentAuditColumns(t),
          {
            title: t('common.actions'),
            key: 'action',
            fixed: 'right',
            hideInSearch: true,
            render: (_: unknown, record: SalesReviewListItem) => {
              const parts: React.ReactNode[] = [
                <Button
                  {...rowActionKind('read')}
                  key="d"
                  onClick={() => void loadDetail(record.id)}
                />,
              ];
              if (canApprove && record.status === 'reviewing') {
                parts.push(
                  <Button
                    {...rowActionKind('approve')}
                    {...rowActionLabelKeep()}
                    key="review"
                    onClick={() => openReviewModal(record)}
                  >
                    {t('app.kuaizhizao.salesReview.actionReview')}
                  </Button>,
                );
              }
              if (canSubmit && (record.status === 'draft' || record.status === 'rejected')) {
                parts.push(
                  <Button
                    {...rowActionKind('submit')}
                    {...rowActionLabelKeep()}
                    key="issue"
                    onClick={() => void handleIssueFromList(record)}
                  >
                    {t('app.kuaizhizao.salesReview.actionIssue')}
                  </Button>,
                );
              }
              if (perms.canUpdate && canEditStatus(record.status)) {
                parts.push(
                  <Button
                    {...rowActionKind('update')}
                    key="e"
                    onClick={() => void openEdit(record)}
                  />,
                );
              }
              if (perms.canDelete && canDeleteStatus(record.status)) {
                parts.push(
                  <Popconfirm
                    key="del"
                    {...rowActionKind('delete')}
                    title={t('app.kuaizhizao.salesReview.deleteConfirm')}
                    onConfirm={() => void handleDelete(record)}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>,
                );
              }
              return parts;
            },
          },
    ];
    return alignProColumns(cols as any, GLOBAL_DOC_LIST_FIELD_RANK) as ProColumns<SalesReviewListItem>[];
  }, [
    t,
    loadDetail,
    openReviewModal,
    handleIssueFromList,
    handleDelete,
    canApprove,
    canSubmit,
    perms.canUpdate,
    perms.canDelete,
  ]);

  const detailBasicColumns: ProDescriptionsItemProps<SalesReview>[] = useMemo(() => {
    const cols: ProDescriptionsItemProps<SalesReview>[] = [
          { title: t('app.kuaizhizao.salesReview.colReviewCode'), dataIndex: 'review_code' },
          { title: t('app.kuaizhizao.salesReview.colCustomer'), dataIndex: 'customer_name' },
          { title: t('app.kuaizhizao.salesReview.colProjectName'), dataIndex: 'project_name' },
          { title: t('app.kuaizhizao.salesReview.fieldContact'), dataIndex: 'customer_contact' },
          { title: t('app.kuaizhizao.salesReview.fieldPhone'), dataIndex: 'customer_phone' },
          {
            title: t('app.kuaizhizao.salesReview.fieldReviewDate'),
            dataIndex: 'review_date',
            render: (_, row) => (row.review_date ? formatBusinessDateOnly(row.review_date) : '—'),
          },
          {
            title: t('app.kuaizhizao.salesReview.fieldDeliveryDate'),
            dataIndex: 'delivery_date',
            render: (_, row) => (row.delivery_date ? formatBusinessDateOnly(row.delivery_date) : '—'),
          },
          {
            title: t('app.kuaizhizao.salesReview.fieldUrgency'),
            dataIndex: 'urgency',
            render: (_, row) => renderSalesReviewUrgencyMarkerTag(t, row.urgency),
          },
          {
            title: t('app.kuaizhizao.salesReview.fieldRiskLevel'),
            dataIndex: 'risk_level',
            render: (_, row) => renderSalesReviewRiskMarkerTag(t, row.risk_level),
          },
          { title: t('app.kuaizhizao.salesReview.fieldSettlement'), dataIndex: 'settlement_method' },
          { title: t('app.kuaizhizao.salesReview.fieldPaymentCycle'), dataIndex: 'payment_cycle' },
          {
            title: t('app.kuaizhizao.salesReview.colTotalAmount'),
            dataIndex: 'total_amount',
            render: (_, row) => {
              const n = Number(row.total_amount);
              return Number.isFinite(n) ? n.toFixed(2) : '—';
            },
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            render: (_, row) => renderSalesReviewStatusTag(t, row.status),
          },
          { title: t('app.kuaizhizao.salesReview.colSalesman'), dataIndex: 'salesman_name' },
          { title: t('app.kuaizhizao.salesReview.colSalesOrder'), dataIndex: 'sales_order_code' },
          { title: t('common.remark'), dataIndex: 'remarks', span: 3 },
    ];
    return alignDescriptionColumns(cols as any, GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK) as ProDescriptionsItemProps<SalesReview>[];
  }, [t]);

  const lineColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.salesReview.colMaterialCode'), dataIndex: 'material_code', width: 120, ellipsis: true },
      { title: t('app.kuaizhizao.salesReview.colMaterialName'), dataIndex: 'material_name', ellipsis: true },
      {
        title: t('common.quantity'),
        dataIndex: 'quantity',
        width: 90,
        align: 'right' as const,
      },
      {
        title: t('app.kuaizhizao.salesReview.colUnitPrice'),
        dataIndex: 'unit_price',
        width: 100,
        align: 'right' as const,
        render: (v: unknown) => {
          const n = Number(v);
          return Number.isFinite(n) ? n.toFixed(2) : '—';
        },
      },
      {
        title: t('app.kuaizhizao.salesReview.colAmount'),
        dataIndex: 'amount',
        width: 110,
        align: 'right' as const,
        render: (v: unknown) => {
          const n = Number(v);
          return Number.isFinite(n) ? n.toFixed(2) : '—';
        },
      },
    ],
    [t],
  );

  const detailExtra = detail ? (
    <Space size="small" wrap>
      {perms.canUpdate && canEditStatus(detail.status) ? (
        <Button icon={<EditOutlined />} onClick={() => void openEdit(detail)}>
          {t('common.edit')}
        </Button>
      ) : null}
      {perms.canDelete && canDeleteStatus(detail.status) ? (
        <Popconfirm
          title={t('app.kuaizhizao.salesReview.deleteConfirm')}
          onConfirm={() => void handleDelete(detail, { closeDrawer: true })}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button danger icon={<DeleteOutlined />}>
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ) : null}
      {perms.canPrint ? (
        <Button icon={<PrinterOutlined />} onClick={() => openPrintForReview(detail)}>
          {t('components.uniAction.print')}
        </Button>
      ) : null}
      {canSubmit && (detail.status === 'draft' || detail.status === 'rejected') ? (
        <Button type="primary" loading={actionLoading} onClick={handleIssue}>
          {t('app.kuaizhizao.salesReview.actionIssue')}
        </Button>
      ) : null}
      {canRevoke && detail.status === 'reviewing' ? (
        <ActionConfirmPopconfirm
          title={t('app.kuaizhizao.salesReview.withdrawConfirm')}
          onConfirm={handleWithdraw}
        >
          <Button loading={actionLoading} onClick={(e) => e.stopPropagation()}>
            {t('app.kuaizhizao.salesReview.actionWithdraw')}
          </Button>
        </ActionConfirmPopconfirm>
      ) : null}
      {canReject && detail.status === 'reviewing' ? (
        <Button danger loading={actionLoading} onClick={handleReject}>
          {t('app.kuaizhizao.salesReview.actionReject')}
        </Button>
      ) : null}
      {canExecute && detail.status === 'passed' && !detail.sales_order_id ? (
        <Button type="primary" loading={actionLoading} onClick={() => void openPushPreview(detail.id)}>
          {t('app.kuaizhizao.salesReview.actionPush')}
        </Button>
      ) : null}
    </Space>
  ) : undefined;

  const contentReady = Boolean(detail);
  const showError = Boolean(detailError) && !contentReady && !detailLoading;
  const showLoading = detailLoading || (!contentReady && !showError && detailOpen);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailBasicColumns,
    detail!,
    'sales_review',
  );

  return (
    <>
      <ListPageTemplate style={{ padding: 0 }}>
        <UniTable<SalesReviewListItem>
          columnPersistenceId={COLUMN_PERSISTENCE_ID}
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.salesReview)}
          permissionResource={SALES_REVIEW_RESOURCE}
          headerTitle={t('app.kuaizhizao.menu.sales-management.sales-reviews')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          options={{ reload: true, density: true, setting: true }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          beforeSearchButtons={
            <ThemedSegmented
              key="status-scope"
              surfaceBackground
              size="medium"
              value={statusFilter}
              onChange={(v) => setStatusFilter(String(v))}
              options={[
                { label: t('app.kuaizhizao.salesReview.filterAll'), value: 'all' },
                { label: translateSalesReviewStatus(t, 'draft'), value: 'draft' },
                { label: translateSalesReviewStatus(t, 'reviewing'), value: 'reviewing' },
                { label: translateSalesReviewStatus(t, 'passed'), value: 'passed' },
                { label: translateSalesReviewStatus(t, 'rejected'), value: 'rejected' },
                { label: translateSalesReviewStatus(t, 'closed'), value: 'closed' },
                { label: translateSalesReviewStatus(t, 'cancelled'), value: 'cancelled' },
              ]}
            />
          }
          toolBarButtonSize="medium"
          toolBarRender={() => {
            const items: React.ReactNode[] = [];
            if (perms.canCreate) {
              items.push(
                <UniPullCreateToolbar
                  key="create-sales-review-with-pull"
                  compactKey="create-sales-review-with-pull"
                  createIcon={<PlusOutlined />}
                  createLabel={t('app.kuaizhizao.salesReview.createButton') + NEW_SHORTCUT_HINT}
                  onCreate={openCreate}
                  menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
                    {
                      key: 'pull-from-quotation',
                      actionKey: 'sales_review.pull_from_quotation',
                      onClick: handlePullFromQuotation,
                    },
                  ])}
                />,
              );
            }
            items.push(
              <UniPushToolbarButton
                key={`sales-review-push-${selectedRowKeys.join('-') || 'none'}`}
                disabled={selectedRowKeys.length !== 1 || !canToolbarPush}
                disabledReason={pushDisabledReason}
                menuItems={buildUniPushMenuItems([
                  {
                    key: 'push-to-sales-order',
                    label: pushToSalesOrderAction.label,
                    disabled: !canToolbarPush,
                    title: canToolbarPush ? undefined : t('app.kuaizhizao.salesReview.push.notAllowed'),
                    onClick: () => {
                      if (!selectedSingleReview || !canToolbarPush) return;
                      void openPushPreview(selectedSingleReview.id);
                    },
                  },
                ])}
              />,
            );
            return items;
          }}
          showDeleteButton={perms.canDelete}
          onDelete={handleBatchDelete}
          deleteButtonDisabled={!canToolbarBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.salesReview.confirmBatchDelete', { count })}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="sales-review-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedRecordsForBatch}
              permGates={perms}
              handlers={salesReviewAuditBatchHandlers}
              onSuccess={handleAuditBatchSuccess}
              toolBarButtonSize="medium"
            />,
          ]}
          toolBarActionsAfterBatch={[
            <UniBatchButton
              key="sales-review-batch-reject"
              selectedRowKeys={selectedRowKeys}
              onAction={handleBatchReject}
              disabled={!canToolbarBatchReject}
              danger
              size="medium"
              requireConfirm
              confirmTitle={(count) => t('app.kuaizhizao.salesReview.batchRejectConfirm', { count })}
            >
              {t('app.kuaizhizao.salesReview.batchReject')}
            </UniBatchButton>,
            ...(perms.canPrint
              ? [
                  <Button
                    key="toolbar-print"
                    icon={<PrinterOutlined />}
                    disabled={!canToolbarPrint}
                    size="medium"
                    onClick={() => {
                      if (!selectedSingleReview) return;
                      openPrintForReview(selectedSingleReview);
                    }}
                  >
                    {t('components.uniAction.print')}
                  </Button>,
                ]
              : []),
          ]}
          showExportButton={perms.canExport}
          onExport={async (type, keys, pageData) => {
            try {
              let items =
                type === 'currentPage' && pageData?.length
                  ? (pageData as SalesReviewListItem[])
                  : await fetchAllListItems((p) =>
                      salesReviewApi.list({
                        ...p,
                        status: statusFilter === 'all' ? undefined : statusFilter,
                      }),
                    );
              if (type === 'selected' && keys?.length) {
                items = items.filter((d) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                message.warning(t('app.kuaizhizao.salesReview.noExportData'));
                return;
              }
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `sales-reviews-${todaySiteDateString()}.xlsx`,
              );
              message.success(t('app.kuaizhizao.salesReview.exportSuccess', { count: items.length }));
            } catch (err) {
              message.error(getApiErrorMessage(err, t('common.exportFailed')));
            }
          }}
          request={async (params, sort, _filter, searchFormValues) => {
            const keyword =
              typeof searchFormValues?.keyword === 'string'
                ? searchFormValues.keyword.trim() || undefined
                : undefined;
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const orderBy =
              sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
            try {
              const res = await salesReviewApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword,
                status: statusFilter === 'all' ? undefined : statusFilter,
                order_by: orderBy,
                include_items: true,
              });
              return {
                data: res.items || [],
                success: true,
                total: res.total ?? 0,
              };
            } catch (err) {
              message.error(getApiErrorMessage(err, t('app.kuaizhizao.salesReview.loadFailed')));
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.salesReview.detailTitle', {
          suffix: detail?.review_code ? ` - ${detail.review_code}` : '',
        })}
        open={detailOpen}
        onClose={closeDetail}
        size={DRAWER_CONFIG.HALF_WIDTH}
        loading={showLoading}
        extra={contentReady ? detailExtra : undefined}
        basic={
          showError ? (
            <Result
              status="error"
              title={t('app.kuaizhizao.salesReview.loadFailed')}
              subTitle={detailError || undefined}
              extra={
                detailIdRef.current != null ? (
                  <Button type="primary" onClick={() => void loadDetail(detailIdRef.current!)}>
                    {t('app.kuaizhizao.salesReview.retry')}
                  </Button>
                ) : undefined
              }
            />
          ) : contentReady ? (
            <Descriptions
              column={3}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        linesTitle={t('app.kuaizhizao.salesReview.itemsTitle')}
        lines={
          contentReady ? (
            (detail!.items || []).length ? (
              <Table
                size="small"
                rowKey={(r) => String(r.id ?? `${r.material_code}-${r.line_no}`)}
                pagination={false}
                columns={lineColumns}
                dataSource={detail!.items || []}
              />
            ) : (
              <Empty description={t('app.kuaizhizao.salesReview.itemsEmpty')} />
            )
          ) : undefined
        }
        collaborationTitle={t('app.kuaizhizao.salesReview.deptOpinionsTitle')}
        collaboration={
          contentReady ? (
            <SalesReviewDeptOpinionsPanel
              review={detail!}
              canApprove={canApprove}
              opinionForms={opinionForms}
              setOpinionForms={setOpinionForms}
              actionLoading={actionLoading}
              onSubmitDept={submitDeptOpinion}
            />
          ) : showLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : undefined
        }
      />

      <SalesReviewFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSuccess={(row) => {
          reloadTable();
          if (detailOpen && detailIdRef.current === row.id) {
            setDetail(row);
          }
        }}
      />

      <SalesReviewReviewModal
        open={reviewModalOpen}
        reviewId={reviewModalId}
        canApprove={canApprove}
        onClose={() => {
          setReviewModalOpen(false);
          setReviewModalId(null);
        }}
        onSuccess={(row) => {
          reloadTable();
          if (detailOpen && detailIdRef.current === row.id) {
            setDetail(row);
          }
        }}
      />

      <Modal
        title={t('app.kuaizhizao.salesReview.pushPreviewTitle')}
        open={pushPreviewOpen}
        onCancel={() => {
          setPushPreviewOpen(false);
          setPushTargetId(null);
        }}
        destroyOnHidden
        confirmLoading={actionLoading}
        onOk={() => void confirmPush()}
        okButtonProps={{ disabled: pushPreview != null && !pushPreview.can_push }}
        okText={t('app.kuaizhizao.salesReview.actionPush')}
      >
        {pushPreview ? (
          <Space orientation="vertical" style={{ width: '100%' }}>
            {!pushPreview.can_push ? (
              <Alert type="warning" showIcon title={pushPreview.blocking_reason || t('common.operationFailed')} />
            ) : (
              <Alert type="info" showIcon title={t('app.kuaizhizao.salesReview.pushPreviewHint')} />
            )}
            <Descriptions size="small" column={1}>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.colReviewCode')}>
                {pushPreview.review_code}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.colCustomer')}>
                {pushPreview.customer_name}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.colItemCount')}>
                {pushPreview.item_count}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesReview.colTotalAmount')}>
                {Number(pushPreview.total_amount).toFixed(2)}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        ) : (
          <Spin />
        )}
      </Modal>

      <UniPullQueryModal<PullQuotationCandidate>
        title={pullFromQuotationAction.label}
        open={pullFromQuotationQuery.open}
        onCancel={pullFromQuotationQuery.closeModal}
        onOk={pullFromQuotationQuery.handleConfirm}
        okText={t('app.kuaizhizao.salesReview.createButton')}
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
        alert={
          selectedPullQuotationNotPullable && selectedPullQuotation
            ? (
              <Alert
                type="warning"
                showIcon
                title={
                  selectedPullQuotation.sales_review_id
                    ? t('app.kuaizhizao.salesOrder.pullDuplicateAlert', {
                        source: pullFromQuotationAction.sourceLabel,
                        target: pullFromQuotationAction.targetLabel,
                      })
                    : quotationCapabilityReasonMessage(
                        selectedPullQuotation.capabilities?.convert_to_sales_review?.reason,
                        t,
                      ) || t('app.kuaizhizao.salesOrder.pullQuotationNotAllowed')
                }
                description={
                  selectedPullQuotation.sales_review_id
                    ? t('app.kuaizhizao.salesOrder.alreadyCreated', {
                        code: selectedPullQuotation.sales_review_code || '-',
                      })
                    : undefined
                }
              />
            )
            : undefined
        }
      />

      {PrintModal}
    </>
  );
};

export default SalesReviewsPage;
