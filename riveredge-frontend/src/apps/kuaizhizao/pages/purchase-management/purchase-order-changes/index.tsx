/**
 * 采购变更单
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Descriptions, Form, Input, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { LinkedDocumentCode } from '../../../../../components/linked-document-code';
import { UniAuditBatchMenuButton } from '../../../../../components/uni-batch';
import {
  UniPullQueryModal,
  UNI_PULL_QUERY_MAX_FETCH_LIMIT,
  pagePullCandidates,
  renderPullQueryDocStatus,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG,   useDetailDrawerDescriptionItems } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { alignProColumns, alignDescriptionColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import {
  approvePurchaseOrderChange,
  createPurchaseOrderChangeFromOrder,
  deletePurchaseOrderChange,
  getPurchaseOrderChange,
  listPurchaseOrderChanges,
  previewPurchaseOrderChangeImpact,
  submitPurchaseOrderChange,
  updatePurchaseOrderChange,
  withdrawPurchaseOrderChange,
  type PurchaseOrderChange,
} from '../../../services/purchase-order-change';
import { listPurchaseOrders, type PurchaseOrder } from '../../../services/purchase';
import {
  buildOrderChangeLifecycleValueEnum,
  getOrderChangeLifecycle,
  resolveOrderChangeListLifecycleParams,
} from '../../../utils/orderChangeLifecycle';
import { formatOrderChangeCategory, ORDER_CHANGE_CATEGORY_LABELS } from '../../../utils/orderChangeCategory';
import {formatDateTime, formatNumber} from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import { OrderChangeItemsTable } from '../../../components/order-change/OrderChangeItemsTable';
import { OrderChangeImpactModal } from '../../../components/order-change/OrderChangeImpactModal';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';

const PURCHASE_ORDER_CHANGE_RESOURCE = 'kuaizhizao:purchase-order-change';

type PullPurchaseOrderCandidate = PurchaseOrder & {
  id: number;
  order_code: string;
};

const PurchaseOrderChangesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const pullFromPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'purchase_order_change.pull_from_purchase_order');
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>();
  const invalidateMenuBadge = useInvalidateMenuBadgeCounts();
  const reloadTable = useCallback(() => {
    invalidateMenuBadge();
    actionRef.current?.reload();
  }, [invalidateMenuBadge]);
  const tableRowsRef = useRef<PurchaseOrderChange[]>([]);
  const pullQueryCloseRef = useRef<(() => void) | null>(null);
  const auditEnabled = useAuditRequired('kuaizhizao', 'purchase-order-change');
  const purchaseOrderChangePerms = useResourcePermissions(PURCHASE_ORDER_CHANGE_RESOURCE);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrderChange | null>(null);
  const [changeTrackingRefreshKey, setChangeTrackingRefreshKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [editItems, setEditItems] = useState<PurchaseOrderChange['items']>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createReason, setCreateReason] = useState(() => t('app.kuaizhizao.purchaseOrderChange.defaultReason'));
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactData, setImpactData] = useState<Awaited<ReturnType<typeof previewPurchaseOrderChangeImpact>> | null>(null);
  const [pendingSubmitId, setPendingSubmitId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const selectedChangesForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is PurchaseOrderChange => row != null),
    [selectedRowKeys],
  );

  const purchaseOrderChangeAuditBatchHandlers = useMemo(
    () => ({
      submit: (id: number) => submitPurchaseOrderChange(id),
      withdraw: (id: number) => withdrawPurchaseOrderChange(id),
      approve: (id: number) => approvePurchaseOrderChange(id, true),
    }),
    [],
  );

  const handlePurchaseOrderChangeAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    reloadTable();
  }, [reloadTable]);

  const openDetail = async (record: PurchaseOrderChange) => {
    const full = await getPurchaseOrderChange(record.id!);
    setDetail(full);
    setDetailOpen(true);
  };

  const openEdit = async (record: PurchaseOrderChange) => {
    const full = await getPurchaseOrderChange(record.id!);
    setEditingId(full.id!);
    setEditItems(full.items ?? []);
    setPendingEditFormValues({
      change_reason: full.change_reason,
      notes: full.notes,
      attachments: mapAttachmentsToUploadList(full.attachments),
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    const values = await editForm.validateFields();
    const payload = {
      change_reason: values.change_reason,
      notes: values.notes,
      attachments: normalizeDocumentAttachments(values.attachments),
      items: (editItems ?? []).map((item, idx) => ({
        id: item.id,
        line_no: item.line_no ?? idx + 1,
        source_item_id: item.source_item_id,
        change_type: item.change_type ?? 'QUANTITY',
        material_id: item.material_id,
        material_code: item.material_code,
        material_name: item.material_name,
        material_spec: item.material_spec,
        material_unit: item.material_unit,
        before_quantity: item.before_quantity,
        after_quantity: item.after_quantity,
        before_unit_price: item.before_unit_price,
        after_unit_price: item.after_unit_price,
        before_delivery_date: item.before_delivery_date,
        after_delivery_date: item.after_delivery_date,
        notes: item.notes,
      })),
    };
    if (!editingId) {
      message.error(t('app.kuaizhizao.purchaseOrderChange.selectPurchaseOrder'));
      return;
    }
    await updatePurchaseOrderChange(editingId, payload);
    message.success(t('common.updateSuccess'));
    setEditOpen(false);
    setPendingEditFormValues(null);
    reloadTable();
  };

  const createChangeFromPurchaseOrder = useCallback(
    async (orderId: number) => {
      try {
        const created = await createPurchaseOrderChangeFromOrder(
          orderId,
          createReason.trim() || t('app.kuaizhizao.purchaseOrderChange.defaultReason'),
        );
        message.success(t('app.kuaizhizao.purchaseOrderChange.created', { code: created.change_code }));
        await openEdit(created);
        reloadTable();
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrderChange.pull.createFailed')));
      }
    },
    [createReason, message, openEdit, reloadTable, t],
  );

  const isPullChangeOrderSourceSelectable = useCallback(
    (record: { capabilities?: { create_change_order?: { allowed?: boolean } } }) =>
      record.capabilities?.create_change_order?.allowed === true,
    [],
  );

  const pullDocumentScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromPurchaseOrderQuery = useUniPullQuery<PullPurchaseOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullChangeOrderSourceSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const result = await listPurchaseOrders({
          skip: 0,
          limit: UNI_PULL_QUERY_MAX_FETCH_LIMIT,
          keyword: keyword.trim() || undefined,
        });
        const rows = (result.data || []).filter(
          (order): order is PullPurchaseOrderCandidate => order.id != null && !!order.order_code,
        );
        return pagePullCandidates(rows, scope, page, pageSize, isPullChangeOrderSourceSelectable);
      } catch (error: unknown) {
        message.error(getApiErrorMessage(error, t('app.kuaizhizao.orderChange.loadPurchaseOrdersFailed')));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys) => {
      const orderId = Number(keys[0]);
      if (!orderId || orderId <= 0) {
        message.warning(t('app.kuaizhizao.purchaseOrderChange.selectPurchaseOrder'));
        return;
      }
      pullQueryCloseRef.current?.();
      await createChangeFromPurchaseOrder(orderId);
    },
  });

  pullQueryCloseRef.current = pullFromPurchaseOrderQuery.closeModal;

  const pullPurchaseOrderColumns: ProColumns<PullPurchaseOrderCandidate>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.orderChange.colOrderCode'), dataIndex: 'order_code', width: 160 },
      {
        title: t('path.suppliers'),
        dataIndex: 'supplier_name',
        ellipsis: true,
        render: (value: string) => value || '-',
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.orderDate'),
        dataIndex: 'order_date',
        width: 120,
        render: (value: string) => (value ? formatDateTime(value, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.purchaseOrder.col.deliveryDate'),
        dataIndex: 'delivery_date',
        width: 120,
        render: (value: string) => (value ? formatDateTime(value, 'YYYY-MM-DD') : '-'),
      },
      {
        title: t('app.kuaizhizao.orderChange.colAmount'),
        dataIndex: 'total_amount',
        width: 120,
        align: 'right',
        render: (value: number | undefined) =>
          value != null
            ? Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '-',
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 100,
        align: 'center' as const,
        render: (v) => renderPullQueryDocStatus(t, v),
      },
    ],
    [t],
  );

  const openCreate = useCallback(() => {
    setCreateReason(t('app.kuaizhizao.purchaseOrderChange.defaultReason'));
    pullFromPurchaseOrderQuery.openModal();
  }, [pullFromPurchaseOrderQuery, t]);
  useNewShortcut(openCreate);

  useEffect(() => {
    const sourceId = searchParams.get('source_order_id');
    if (sourceId) {
      void createChangeFromPurchaseOrder(Number(sourceId));
      searchParams.delete('source_order_id');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSubmitWithPreview = async (id: number) => {
    setPendingSubmitId(id);
    setImpactLoading(true);
    setImpactOpen(true);
    try {
      setImpactData(await previewPurchaseOrderChangeImpact(id));
    } catch (e: any) {
      message.error(e?.message ?? t('app.kuaizhizao.purchaseOrderChange.impactPreviewFailed'));
      setImpactOpen(false);
    } finally {
      setImpactLoading(false);
    }
  };

  const confirmSubmit = async () => {
    if (!pendingSubmitId) return;
    await submitPurchaseOrderChange(pendingSubmitId);
    message.success(t('app.kuaizhizao.purchaseOrderChange.submitSuccess'));
    setImpactOpen(false);
    setPendingSubmitId(null);
    reloadTable();
    if (detail?.id === pendingSubmitId) setDetail(await getPurchaseOrderChange(pendingSubmitId));
  };

  const orderChangeLifecycleValueEnum = useMemo(
    () => buildOrderChangeLifecycleValueEnum(t),
    [t],
  );
  const [suppliers, setSuppliers] = useState<Array<{ id: number; name?: string; code?: string }>>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSuppliersLoading(true);
      try {
        const res = await supplierApi.list({ limit: 1000, isActive: true });
        const list = Array.isArray(res) ? res : (res as { data?: typeof suppliers })?.data ?? [];
        if (!cancelled) setSuppliers(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setSuppliers([]);
      } finally {
        if (!cancelled) setSuppliersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const changeSupplierSearchOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: Number(s.id),
        label: [s.name, s.code].filter(Boolean).join(' - ') || String(s.id),
      })),
    [suppliers],
  );

  const changeCategoryValueEnum = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(ORDER_CHANGE_CATEGORY_LABELS).map(([key, label]) => [key, { text: label }]),
      ),
    [],
  );

  const purchaseOrderChangeAuditColumn = useMemo(
    () => createListAuditPhaseColumn<PurchaseOrderChange>({ t, auditEnabled }),
    [t, auditEnabled],
  );
  const renderDeltaAmount = useCallback((value: unknown) => {
    if (value == null) return '-';
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    const text = `${amount > 0 ? '+' : ''}${formatNumber(amount, 2)}`;
    const color = amount > 0 ? '#52c41a' : amount < 0 ? '#ff4d4f' : undefined;
    return <span style={{ color }}>{text}</span>;
  }, []);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<PurchaseOrderChange>[]>(
    () =>
      alignDescriptionColumns([
        { title: t('app.kuaizhizao.purchaseOrderChange.colChangeCode'), dataIndex: 'change_code' },
        {
          title: t('app.kuaizhizao.purchaseOrderChange.colSourceOrderCode'),
          dataIndex: 'source_order_code',
          render: (_, record) => (
            <LinkedDocumentCode
              documentType="purchase_order"
              documentId={record.source_order_id}
              code={record.source_order_code}
            />
          ),
        },
        {
          title: t('app.kuaizhizao.purchaseOrderChange.colVersion'),
          dataIndex: 'change_version',
          render: (_, record) => (record.change_version != null ? `V${record.change_version}` : '-'),
        },
        {
          title: t('app.kuaizhizao.purchaseOrderChange.supplier'),
          dataIndex: 'supplier_name',
        },
        {
          title: t('app.kuaizhizao.purchaseOrderChange.colCategory'),
          dataIndex: 'change_category',
          render: (_, record) => formatOrderChangeCategory(record.change_category),
        },
        {
          title: t('app.kuaizhizao.purchaseOrderChange.colBeforeAmount'),
          dataIndex: 'before_total_amount',
          render: (_, record) => formatNumber(record.before_total_amount, 2),
        },
        {
          title: t('app.kuaizhizao.purchaseOrderChange.colAfterAmount'),
          dataIndex: 'after_total_amount',
          render: (_, record) => formatNumber(record.after_total_amount, 2),
        },
        {
          title: t('app.kuaizhizao.purchaseOrderChange.colDeltaAmount'),
          dataIndex: 'delta_amount',
          render: (_, record) => renderDeltaAmount(record.delta_amount),
        },
        {
          title: t('app.kuaizhizao.purchaseOrderChange.colAppliedAt'),
          dataIndex: 'applied_at',
          valueType: 'dateTime',
        },
        {
          title: t('app.kuaizhizao.purchaseOrderChange.colChangeReason'),
          dataIndex: 'change_reason',
          span: 3,
        },
        {
          title: t('app.kuaizhizao.purchaseOrderChange.notes'),
          dataIndex: 'notes',
          span: 3,
        },
      ] as ProDescriptionsItemProps<PurchaseOrderChange>[]),
    [renderDeltaAmount, t],
  );

  const changeLifecycle = useMemo(
    () => (detail ? getOrderChangeLifecycle(detail as Record<string, unknown>, t) : null),
    [detail, t],
  );
  const changeNextSteps = changeLifecycle?.nextStepSuggestions;
  const changeShowNextInTitle = Boolean(changeNextSteps?.length);
  const changeTracking = useDocumentTracking(
    detailOpen && detail?.id ? 'purchase_order_change' : undefined,
    detail?.id,
    changeTrackingRefreshKey,
  );

  const detailCollaboration = useMemo(() => {
    if (!detail || !changeLifecycle) return undefined;
    const mainStages = changeLifecycle.mainStages ?? [];
    if (!mainStages.length) return undefined;
    return (
      <UniLifecycleStepper
        steps={mainStages}
        status={changeLifecycle.status}
        showLabels
        nextStepSuggestions={changeLifecycle.nextStepSuggestions}
        hideNextStepSuggestions={changeShowNextInTitle}
      />
    );
  }, [detail, changeLifecycle, changeShowNextInTitle]);

  const columns: ProColumns<PurchaseOrderChange>[] = useMemo(
    () => alignProColumns<PurchaseOrderChange>([
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colSupplierChangeCode'),
        key: 'change_code',
        dataIndex: 'change_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        sorter: true,
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.supplier_name ?? '')}
            secondary={String(record.change_code ?? '')}
          />
        ),
      },
      { title: t('app.kuaizhizao.purchaseOrderChange.colChangeCode'), dataIndex: 'change_code', hideInTable: true, hideInSearch: false },
      {
        title: t('app.kuaizhizao.purchaseOrderChange.supplier'),
        dataIndex: 'supplier_id',
        hideInTable: true,
        valueType: 'select',
        fieldProps: {
          showSearch: true,
          optionFilterProp: 'label',
          loading: suppliersLoading,
          options: changeSupplierSearchOptions,
          placeholder: t('app.kuaizhizao.purchaseOrderChange.supplier'),
        },
      },
      { title: t('app.kuaizhizao.purchaseOrderChange.supplier'), dataIndex: 'supplier_name', hideInTable: true, hideInSearch: true, ellipsis: true },
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colSourceOrder'),
        dataIndex: 'source_order_code',
        width: 180,
        minWidth: 180,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: false,
        sorter: true,
        hideInSearch: false,
        render: (_, record) => (
          <LinkedDocumentCode
            documentType="purchase_order"
            documentId={record.source_order_id}
            code={record.source_order_code}
          />
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colChangeReason'),
        dataIndex: 'change_reason',
        minWidth: 180,
        ellipsis: true,
        hideInSearch: true,
        uniTablePrimaryFlex: true,
      },
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colCategory'),
        dataIndex: 'change_category',
        width: 100,
        sorter: true,
        valueType: 'select',
        valueEnum: changeCategoryValueEnum,
        render: (_, r) => (
          <Tag color="blue" bordered={false}>
            {formatOrderChangeCategory(r.change_category)}
          </Tag>
        ),
      },
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colDeltaAmount'),
        dataIndex: 'delta_amount',
        width: 100,
        sorter: true,
        hideInSearch: true,
        align: 'right',
        render: (_, r) => renderDeltaAmount(r.delta_amount),
      },
      ...buildDocumentAuditColumns<PurchaseOrderChange>(t),
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
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colAppliedAt'),
        dataIndex: 'applied_at',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.applied_at ? formatDateTime(r.applied_at, 'YYYY-MM-DD HH:mm') : '-'),
      },
      ...(purchaseOrderChangeAuditColumn ? [purchaseOrderChangeAuditColumn] : []),
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colLifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        fixed: 'right',
        valueType: 'select',
        valueEnum: orderChangeLifecycleValueEnum,
        render: (_, record) => (
          <ListUniLifecycleCell
            lifecycle={getOrderChangeLifecycle(record as Record<string, unknown>, t)}
          />
        ),
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        fixed: 'right',
        render: (_, record) => [
          <Button {...rowActionKind('read')} key="view" onClick={() => openDetail(record)}>
            {t('common.detail')}
          </Button>,
          record.capabilities?.update?.allowed && purchaseOrderChangePerms.canUpdate ? (
            <Button {...rowActionKind('update')} key="edit" onClick={() => openEdit(record)}>
              {t('common.edit')}
            </Button>
          ) : null,
          record.capabilities?.delete?.allowed && purchaseOrderChangePerms.canDelete ? (
            <Button {...rowActionKind('delete')}
              key="del"
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                modal.confirm({
                  title: t('app.kuaizhizao.purchaseOrderChange.confirmDelete'),
                  onOk: async () => {
                    await deletePurchaseOrderChange(record.id!);
                    message.success(t('app.kuaizhizao.purchaseOrderChange.deleted'));
                    reloadTable();
                  },
                });
              }}
            >
              {t('common.delete')}
            </Button>
          ) : null,
        ],
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [message, modal, orderChangeLifecycleValueEnum, purchaseOrderChangeAuditColumn, purchaseOrderChangePerms.canDelete, purchaseOrderChangePerms.canUpdate, changeCategoryValueEnum, changeSupplierSearchOptions, suppliersLoading, t, renderDeltaAmount],
  );

  const request = useCallback(
    async (
      params: Record<string, unknown>,
      sort?: Record<string, 'ascend' | 'descend' | null>,
      _filter?: unknown,
      searchFormValues?: Record<string, unknown>,
    ) => {
      const sf = searchFormValues ?? {};
      const lifecycleParams = resolveOrderChangeListLifecycleParams(sf, params);
      const { sortBy, sortOrder } = extractProTableSort(sort);
      const orderBy =
        sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
      const fuzzyKeyword = typeof sf.keyword === 'string' ? sf.keyword.trim() : '';
      const changeCode = sf.change_code != null ? String(sf.change_code).trim() : '';
      const apiParams: import('../../../services/purchase-order-change').PurchaseOrderChangeListParams = {
        skip: ((Number(params.current) || 1) - 1) * (Number(params.pageSize) || 20),
        limit: Number(params.pageSize) || 20,
        ...lifecycleParams,
        order_by: orderBy,
        source_order_id: params.source_order_id as number | undefined,
      };
      if (fuzzyKeyword) {
        apiParams.keyword = fuzzyKeyword;
      } else if (changeCode) {
        apiParams.change_code = changeCode;
      }
      if (sf.supplier_id != null && sf.supplier_id !== '') {
        apiParams.supplier_id = Number(sf.supplier_id);
      }
      if (sf.change_category != null && sf.change_category !== '') {
        apiParams.change_category = String(sf.change_category);
      }
      const sourceOrderCode =
        sf.source_order_code != null ? String(sf.source_order_code).trim() : '';
      if (sourceOrderCode) apiParams.source_order_code = sourceOrderCode;
      const createdRange = sf.created_at_range as [unknown, unknown] | undefined;
      if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
        apiParams.start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
        apiParams.end_date = createdRange[1]
          ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
          : apiParams.start_date;
      }
      const res = await listPurchaseOrderChanges(apiParams);
      return { data: res.items ?? [], success: true, total: res.total ?? 0 };
    },
    [],
  );

  const handleBatchDelete = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning(t('app.kuaizhizao.purchaseOrderChange.selectToDelete'));
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
        await deletePurchaseOrderChange(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.purchaseOrderChange.batchDeleteSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.purchaseOrderChange.batchDeletePartial', { count: failed }));
    setSelectedRowKeys([]);
    reloadTable();
  }, [message, t]);

  const timeconfigBasicItems = useDetailDrawerDescriptionItems(
    detailBasicColumns.filter((col) => {
                  if (col.dataIndex !== 'notes') return true;
                  const notes = String(detail.notes ?? '').trim();
                  return notes.length > 0;
                }),
                detail,
    'purchase_order_change',
  );

  return (
    <ListPageTemplate>
      <UniTable<PurchaseOrderChange>
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={columns}
        request={request}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-order-changes.list-v1"
        pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
        pinnedTabsValueEnum={orderChangeLifecycleValueEnum}
        showAdvancedSearch={true}
        skipFuzzyPinyinClientFilter
        toolBarRender={() => [
          <Button {...rowActionKind('create')}
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
          >
            {pullFromPurchaseOrderAction.label + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.purchaseOrderChange.confirmBatchDelete', { count })}
        toolBarActionsAfterDelete={[
          <UniAuditBatchMenuButton
            key="purchase-order-change-batch-menu"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedChangesForBatch}
            auditEnabled={auditEnabled}
            permGates={purchaseOrderChangePerms}
            handlers={purchaseOrderChangeAuditBatchHandlers}
            onSuccess={handlePurchaseOrderChangeAuditBatchSuccess}
            toolBarButtonSize="middle"
          />,
        ]}
      />

      <UniPullQueryModal<PullPurchaseOrderCandidate>
        title={pullFromPurchaseOrderAction.label}
        open={pullFromPurchaseOrderQuery.open}
        onCancel={pullFromPurchaseOrderQuery.closeModal}
        onOk={pullFromPurchaseOrderQuery.handleConfirm}
        okText={t('common.next')}
        rowKey="id"
        columns={pullPurchaseOrderColumns}
        dataSource={pullFromPurchaseOrderQuery.dataSource}
        loading={pullFromPurchaseOrderQuery.loading}
        confirmLoading={pullFromPurchaseOrderQuery.confirmLoading}
        selectionType={pullFromPurchaseOrderQuery.selectionType}
        selectedRowKeys={pullFromPurchaseOrderQuery.selectedRowKeys}
        selectedRows={pullFromPurchaseOrderQuery.selectedRows}
        onSelectedRowKeysChange={pullFromPurchaseOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromPurchaseOrderQuery.isRowDisabled}
        searchDraft={pullFromPurchaseOrderQuery.searchDraft}
        onSearchDraftChange={pullFromPurchaseOrderQuery.setSearchDraft}
        onSearchApply={pullFromPurchaseOrderQuery.handleSearchApply}
        onSearchClear={pullFromPurchaseOrderQuery.handleSearchClear}
        appliedKeyword={pullFromPurchaseOrderQuery.appliedKeyword}
        page={pullFromPurchaseOrderQuery.page}
        pageSize={pullFromPurchaseOrderQuery.pageSize}
        total={pullFromPurchaseOrderQuery.total}
        onPageChange={pullFromPurchaseOrderQuery.handlePageChange}
        scopeOptions={pullFromPurchaseOrderQuery.scopeOptions}
        scope={pullFromPurchaseOrderQuery.scope}
        onScopeChange={pullFromPurchaseOrderQuery.handleScopeChange}
        searchPlaceholder={t('app.kuaizhizao.orderChange.searchOrderPlaceholder', {
          orderLabel: t('app.kuaizhizao.purchaseOrderChange.purchaseOrderLabel'),
          partnerLabel: t('path.suppliers'),
        })}
        emptyText={t('app.kuaizhizao.orderChange.emptyNoEligibleOrders', {
          orderLabel: t('app.kuaizhizao.purchaseOrderChange.purchaseOrderLabel'),
        })}
        emptySearchText={t('app.kuaizhizao.orderChange.emptyNoSearchResults', {
          orderLabel: t('app.kuaizhizao.purchaseOrderChange.purchaseOrderLabel'),
        })}
        okButtonProps={{
          disabled:
            pullFromPurchaseOrderQuery.selectedRowKeys.length === 0 ||
            pullFromPurchaseOrderQuery.hasDisabledSelection ||
            pullFromPurchaseOrderQuery.loading,
        }}
        alert={
          <Form layout="vertical">
            <Form.Item label={t('app.kuaizhizao.purchaseOrderChange.colChangeReason')} required style={{ marginBottom: 0 }}>
              <Input.TextArea
                rows={2}
                value={createReason}
                onChange={(e) => setCreateReason(e.target.value)}
              />
            </Form.Item>
          </Form>
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.purchaseOrderChange.editTitle')}
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
      >
        <ProFormTextArea name="change_reason" label={t('app.kuaizhizao.purchaseOrderChange.colChangeReason')} rules={[{ required: true }]} />
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.purchaseOrderChange.notes')} />
        <DocumentAttachmentsField category="purchase_order_change_attachments" />
        <OrderChangeItemsTable items={editItems ?? []} editable onChange={setEditItems} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.purchaseOrderChange.detailTitle', { code: detail?.change_code ?? '' })}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detail ? (
            <Space size="small">
              {detail.capabilities?.submit?.allowed &&
              detail.capabilities?.preview_impact?.allowed &&
              purchaseOrderChangePerms.canAction?.('submit') ? (
                <Button icon={<ThunderboltOutlined />} onClick={() => runSubmitWithPreview(detail.id!)}>
                  {t('app.kuaizhizao.purchaseOrderChange.submit')}
                </Button>
              ) : null}
              {detail.capabilities?.update?.allowed && purchaseOrderChangePerms.canUpdate ? (
                <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detail); }}>
                  {t('common.edit')}
                </Button>
              ) : null}
              <UniWorkflowActions {...rowActionKind('skip')}
                record={detail}
                entityName={t('app.kuaizhizao.purchaseOrderChange.entityName')}
                resourcePrefix={PURCHASE_ORDER_CHANGE_RESOURCE}
                unifiedAudit
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={['DRAFT', '草稿']}
                pendingStatuses={['PENDING_REVIEW', '待审核']}
                approvedStatuses={['AUDITED', '已审核', 'APPLIED', '已生效']}
                rejectedStatuses={['REJECTED', '已驳回']}
                theme="default"
                onSuccess={async () => {
                  reloadTable();
                  setChangeTrackingRefreshKey((k) => k + 1);
                  if (detail.id) setDetail(await getPurchaseOrderChange(detail.id));
                }}
              />
            </Space>
          ) : null
        }
        collaborationTitleSuffix={
          changeShowNextInTitle ? (
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {t('components.uniLifecycle.nextStep')}：
              {changeNextSteps!.join(t('components.uniLifecycle.nextStepSeparator'))}
            </Typography.Text>
          ) : undefined
        }
        collaborationAuditRecord={detail}
        collaboration={detailCollaboration}
        basic={
          detail ? (
            <Descriptions
              column={3}
              size="small"
              items={timeconfigBasicItems}
            />
          ) : undefined
        }
        lines={detail ? <OrderChangeItemsTable items={detail.items ?? []} /> : undefined}
        timeline={
          detail ? (
            changeTracking.data && !changeTracking.loading ? (
              <DocumentTrackingTimelineBody data={changeTracking.data} />
            ) : changeTracking.error ? (
              <Typography.Text type="danger">{changeTracking.error}</Typography.Text>
            ) : null
          ) : null
        }
        traceDocument={
          detail?.id != null
            ? {
                documentType: 'purchase_order_change',
                documentId: detail.id,
                selfDocumentId: detail.id,
              }
            : undefined
        }
      />

      <OrderChangeImpactModal
        open={impactOpen}
        loading={impactLoading}
        impact={impactData}
        onClose={() => {
          setImpactOpen(false);
          setPendingSubmitId(null);
        }}
        onConfirm={confirmSubmit}
      />
    </ListPageTemplate>
  );
};

export default PurchaseOrderChangesPage;
