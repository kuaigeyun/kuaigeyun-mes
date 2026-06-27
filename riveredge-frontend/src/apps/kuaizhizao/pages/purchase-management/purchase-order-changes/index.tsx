/**
 * 采购变更单
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Descriptions, Form, Input, Space, Tag } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, PlusOutlined, RollbackOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniAuditBatchMenuButton } from '../../../../../components/uni-batch';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { ListUniLifecycleCell } from '../../sales-management/shared/ListUniLifecycleCell';
import { DetailLifecycleCollaborationBlock } from '../../../../../components/uni-audit/DetailAuditPhaseRow';
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
import { getPurchaseOrder, listPurchaseOrders, type PurchaseOrder } from '../../../services/purchase';
import {
  buildOrderChangeLifecycleValueEnum,
  getOrderChangeLifecycle,
  isOrderChangeDraft,
  resolveOrderChangeListLifecycleParams,
} from '../../../utils/orderChangeLifecycle';
import { formatOrderChangeCategory } from '../../../utils/orderChangeCategory';
import { OrderChangeItemsTable } from '../../../components/order-change/OrderChangeItemsTable';
import { OrderChangeImpactModal } from '../../../components/order-change/OrderChangeImpactModal';
import { isSourceOrderEligibleForChange } from '../../../utils/orderChangeSourceOrder';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { formatDateTime } from '../../../../../utils/format';

const PURCHASE_ORDER_CHANGE_RESOURCE = 'kuaizhizao:purchase-order-change';

type PullPurchaseOrderCandidate = {
  id: number;
  order_code: string;
  supplier_name?: string;
  order_date?: string;
  delivery_date?: string;
  total_amount?: number;
  status?: string;
  review_status?: string;
  buyer_name?: string;
};

const isPullPurchaseOrderSelectable = (record: PullPurchaseOrderCandidate): boolean =>
  isSourceOrderEligibleForChange(record.status, record.review_status);

const PurchaseOrderChangesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const pullFromPurchaseOrderAction = resolveKuaizhizaoDocumentAction(t, 'purchase_order_change.pull_from_purchase_order');
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<PurchaseOrderChange[]>([]);
  const auditEnabled = useAuditRequired('kuaizhizao', 'purchase-order-change');
  const purchaseOrderChangePerms = useResourcePermissions(PURCHASE_ORDER_CHANGE_RESOURCE);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrderChange | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [editItems, setEditItems] = useState<PurchaseOrderChange['items']>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creatingSourceOrderId, setCreatingSourceOrderId] = useState<number | null>(null);
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
    actionRef.current?.reload();
  }, []);

  const openDetail = async (record: PurchaseOrderChange) => {
    const full = await getPurchaseOrderChange(record.id!);
    setDetail(full);
    setDetailOpen(true);
  };

  const openEdit = async (record: PurchaseOrderChange) => {
    const full = await getPurchaseOrderChange(record.id!);
    setEditingId(full.id!);
    setCreatingSourceOrderId(null);
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
    if (editingId) {
      await updatePurchaseOrderChange(editingId, payload);
      message.success(t('common.updateSuccess'));
    } else {
      if (!creatingSourceOrderId) {
        message.error(t('app.kuaizhizao.purchaseOrderChange.selectPurchaseOrder'));
        return;
      }
      const created = await createPurchaseOrderChangeFromOrder(
        creatingSourceOrderId,
        values.change_reason || t('app.kuaizhizao.purchaseOrderChange.defaultReason'),
      );
      await updatePurchaseOrderChange(created.id!, payload);
      message.success(t('app.kuaizhizao.purchaseOrderChange.created', { code: created.change_code }));
    }
    setEditOpen(false);
    setPendingEditFormValues(null);
    setCreatingSourceOrderId(null);
    actionRef.current?.reload();
  };

  const openCreateFromOrder = async (orderId: number, reason: string) => {
    const order = await getPurchaseOrder(orderId);
    setEditingId(null);
    setCreatingSourceOrderId(orderId);
    setEditItems(
      (order.items ?? []).map((item, idx) => ({
        line_no: idx + 1,
        source_item_id: item.id,
        change_type: 'QUANTITY',
        material_id: item.material_id,
        material_code: item.material_code,
        material_name: item.material_name,
        material_spec: item.material_spec,
        material_unit: item.unit,
        before_quantity: item.ordered_quantity,
        after_quantity: item.ordered_quantity,
        before_unit_price: item.unit_price,
        after_unit_price: item.unit_price,
        before_delivery_date: item.required_date,
        after_delivery_date: item.required_date,
        notes: item.notes,
      })),
    );
    setPendingEditFormValues({
      change_reason: reason || t('app.kuaizhizao.purchaseOrderChange.defaultReason'),
      notes: '',
      attachments: [],
    });
    setEditOpen(true);
  };

  const mapPullPurchaseOrderRows = useCallback((rows: PurchaseOrder[]): PullPurchaseOrderCandidate[] => {
    return rows
      .filter((order) => order.id && order.order_code)
      .map((order) => ({
        id: Number(order.id),
        order_code: String(order.order_code),
        supplier_name: order.supplier_name || '',
        order_date: order.order_date || '',
        delivery_date: order.delivery_date || '',
        total_amount: order.total_amount != null ? Number(order.total_amount) : undefined,
        status: order.status || '',
        review_status: order.review_status || '',
        buyer_name: order.buyer_name || '',
      }));
  }, []);

  const pullFromPurchaseOrderScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromPurchaseOrderQuery = useUniPullQuery<PullPurchaseOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullFromPurchaseOrderScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullPurchaseOrderSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const result = await listPurchaseOrders({
          skip: 0,
          limit: 100,
          keyword: keyword.trim() || undefined,
        });
        const rows = mapPullPurchaseOrderRows(result.data || []);
        const filtered = scope === 'pullable' ? rows.filter(isPullPurchaseOrderSelectable) : rows;
        const begin = (page - 1) * pageSize;
        const end = begin + pageSize;
        return {
          data: filtered.slice(begin, end),
          total: filtered.length,
        };
      } catch (error: any) {
        message.error(error?.message ?? t('app.kuaizhizao.orderChange.loadPurchaseOrdersFailed'));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selectedId = Number(keys[0]);
      const selected = rows[0];
      if (!selectedId || selectedId <= 0) {
        message.warning(t('app.kuaizhizao.purchaseOrderChange.selectPurchaseOrder'));
        return;
      }
      if (selected && !isPullPurchaseOrderSelectable(selected)) {
        message.warning(t('app.kuaizhizao.purchaseOrderChange.selectPurchaseOrder'));
        return;
      }
      await openCreateFromOrder(
        selectedId,
        createReason || t('app.kuaizhizao.purchaseOrderChange.defaultReason'),
      );
      pullFromPurchaseOrderQuery.closeModal();
    },
  });

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
        render: (value: string) => value || '-',
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
      openCreateFromOrder(Number(sourceId), t('app.kuaizhizao.purchaseOrderChange.defaultReason')).finally(() => {
        searchParams.delete('source_order_id');
        setSearchParams(searchParams, { replace: true });
      });
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
    actionRef.current?.reload();
    if (detail?.id === pendingSubmitId) setDetail(await getPurchaseOrderChange(pendingSubmitId));
  };

  const orderChangeLifecycleValueEnum = useMemo(
    () => buildOrderChangeLifecycleValueEnum(t),
    [t],
  );
  const purchaseOrderChangeAuditColumn = useMemo(
    () => createListAuditPhaseColumn<PurchaseOrderChange>({ t, auditEnabled }),
    [t, auditEnabled],
  );

  const columns: ProColumns<PurchaseOrderChange>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colSupplierChangeCode'),
        key: 'change_code',
        dataIndex: 'change_code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        fixed: 'left',
        render: (_, record) => (
          <UniTableStackedPrimaryCell
            primary={String(record.supplier_name ?? '')}
            secondary={String(record.change_code ?? '')}
          />
        ),
      },
      { title: t('app.kuaizhizao.purchaseOrderChange.colChangeCode'), dataIndex: 'change_code', hideInTable: true, copyable: true },
      { title: t('app.kuaizhizao.purchaseOrderChange.supplier'), dataIndex: 'supplier_name', hideInTable: true, ellipsis: true },
      { title: t('app.kuaizhizao.purchaseOrderChange.colSourceOrder'), dataIndex: 'source_order_code', width: 140 },
      { title: t('app.kuaizhizao.purchaseOrderChange.colVersion'), dataIndex: 'change_version', width: 70 },
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colCategory'),
        dataIndex: 'change_category',
        width: 100,
        render: (_, r) => formatOrderChangeCategory(r.change_category),
      },
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colDeltaAmount'),
        dataIndex: 'delta_amount',
        width: 100,
        render: (_, r) => (r.delta_amount != null ? Number(r.delta_amount).toFixed(2) : '-'),
      },
      ...(purchaseOrderChangeAuditColumn ? [purchaseOrderChangeAuditColumn] : []),
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colLifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        valueType: 'select',
        valueEnum: orderChangeLifecycleValueEnum,
        render: (_, record) => (
          <ListUniLifecycleCell
            lifecycle={getOrderChangeLifecycle(record as Record<string, unknown>, t)}
          />
        ),
      },
      { title: t('app.kuaizhizao.purchaseOrderChange.colChangeReason'), dataIndex: 'change_reason', ellipsis: true, hideInSearch: true },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 180,
        fixed: 'right',
        render: (_, record) => [
          <Button {...rowActionKind('read')} key="view" onClick={() => openDetail(record)}>
            {t('common.detail')}
          </Button>,
          isOrderChangeDraft(record) ? (
            <Button {...rowActionKind('update')} key="edit" onClick={() => openEdit(record)}>
              {t('common.edit')}
            </Button>
          ) : null,
          isOrderChangeDraft(record) ? (
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
                    actionRef.current?.reload();
                  },
                });
              }}
            >
              {t('common.delete')}
            </Button>
          ) : null,
        ],
      },
    ],
    [auditEnabled, message, modal, orderChangeLifecycleValueEnum, purchaseOrderChangeAuditColumn, t],
  );

  const request = useCallback(async (params: Record<string, unknown>) => {
    const apiParams = resolveOrderChangeListLifecycleParams(params, params);
    const list = await listPurchaseOrderChanges({
      skip: ((params.current as number) - 1) * (params.pageSize as number),
      limit: params.pageSize as number,
      source_order_id: params.source_order_id as number | undefined,
      lifecycle_stage: apiParams.lifecycle_stage,
    });
    return { data: list, success: true, total: list.length };
  }, []);

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
    actionRef.current?.reload();
  }, [message, t]);

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
        columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-order-changes"
        pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
        pinnedTabsValueEnum={orderChangeLifecycleValueEnum}
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
        okText={t('common.create')}
        rowKey="id"
        columns={pullPurchaseOrderColumns}
        dataSource={pullFromPurchaseOrderQuery.dataSource}
        loading={pullFromPurchaseOrderQuery.loading}
        confirmLoading={pullFromPurchaseOrderQuery.confirmLoading}
        selectionType={pullFromPurchaseOrderQuery.selectionType}
        selectedRowKeys={pullFromPurchaseOrderQuery.selectedRowKeys}
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
        onClose={() => {
          setEditOpen(false);
          setCreatingSourceOrderId(null);
        }}
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
        width={DRAWER_CONFIG.LARGE_WIDTH ?? DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detail ? (
            <Space>
              {isOrderChangeDraft(detail) && (
                <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detail); }}>
                  {t('common.edit')}
                </Button>
              )}
              {isOrderChangeDraft(detail) && (
                <Button icon={<ThunderboltOutlined />} onClick={() => runSubmitWithPreview(detail.id!)}>
                  {t('app.kuaizhizao.purchaseOrderChange.submit')}
                </Button>
              )}
              <UniWorkflowActions {...rowActionKind('skip')}
                record={detail}
                entityName={t('app.kuaizhizao.purchaseOrderChange.entityName')}
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={['DRAFT', '草稿']}
                pendingStatuses={['PENDING_REVIEW', '待审核']}
                approvedStatuses={['AUDITED', '已审核', 'APPLIED', '已生效']}
                rejectedStatuses={['REJECTED', '已驳回']}
                onSuccess={async () => {
                  actionRef.current?.reload();
                  if (detail.id) setDetail(await getPurchaseOrderChange(detail.id));
                }}
              />
            </Space>
          ) : null
        }
      >
        {detail && (
          <>
            <DetailLifecycleCollaborationBlock record={detail} auditEnabled={auditEnabled}>
              <UniLifecycle {...getOrderChangeLifecycle(detail as Record<string, unknown>, t)} />
            </DetailLifecycleCollaborationBlock>
            <Descriptions column={2} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label={t('app.kuaizhizao.purchaseOrderChange.colSourceOrderCode')}>{detail.source_order_code}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.purchaseOrderChange.colVersion')}>V{detail.change_version}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.purchaseOrderChange.supplier')}>{detail.supplier_name}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.purchaseOrderChange.colCategory')}>
                {formatOrderChangeCategory(detail.change_category)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.purchaseOrderChange.colBeforeAmount')}>{detail.before_total_amount}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.purchaseOrderChange.colAfterAmount')}>{detail.after_total_amount}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.purchaseOrderChange.colDeltaAmount')}>{detail.delta_amount}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.purchaseOrderChange.colAppliedAt')}>
                {detail.applied_at ? formatDateTime(detail.applied_at, 'YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.purchaseOrderChange.colChangeReason')} span={2}>
                {detail.change_reason}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <OrderChangeItemsTable items={detail.items ?? []} />
            </div>
          </>
        )}
      </DetailDrawerTemplate>

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
