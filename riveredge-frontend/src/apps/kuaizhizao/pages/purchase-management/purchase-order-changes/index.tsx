/**
 * 采购变更单
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Alert, Button, Descriptions, Empty, Form, Input, Modal, Space, Spin, Table, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
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
  previewPurchaseOrderChangeFromOrder,
  previewPurchaseOrderChangeImpact,
  submitPurchaseOrderChange,
  updatePurchaseOrderChange,
  withdrawPurchaseOrderChange,
  type PurchaseOrderChange,
} from '../../../services/purchase-order-change';
import { listPurchaseOrders, type DocumentPushPreview, type PurchaseOrder } from '../../../services/purchase';
import {
  buildOrderChangeLifecycleValueEnum,
  getOrderChangeLifecycle,
  resolveOrderChangeListLifecycleParams,
} from '../../../utils/orderChangeLifecycle';
import { formatOrderChangeCategory } from '../../../utils/orderChangeCategory';
import { OrderChangeItemsTable } from '../../../components/order-change/OrderChangeItemsTable';
import { OrderChangeImpactModal } from '../../../components/order-change/OrderChangeImpactModal';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { formatDateTime } from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { purchaseOrderCapabilityReasonMessage } from '../../../../../hooks/useDocumentCapabilities';

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
  const tableRowsRef = useRef<PurchaseOrderChange[]>([]);
  const pullQueryCloseRef = useRef<(() => void) | null>(null);
  const auditEnabled = useAuditRequired('kuaizhizao', 'purchase-order-change');
  const purchaseOrderChangePerms = useResourcePermissions(PURCHASE_ORDER_CHANGE_RESOURCE);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrderChange | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [editItems, setEditItems] = useState<PurchaseOrderChange['items']>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createReason, setCreateReason] = useState(() => t('app.kuaizhizao.purchaseOrderChange.defaultReason'));
  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewConfirming, setPullPreviewConfirming] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pullPreviewOrderId, setPullPreviewOrderId] = useState<number | null>(null);
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
    actionRef.current?.reload();
  };

  const resetPullPreviewModal = useCallback(() => {
    setPullPreviewOpen(false);
    setPullPreviewData(null);
    setPullPreviewOrderId(null);
  }, []);

  const showPullCreatePreview = useCallback(
    (orderId: number) => {
      setPullPreviewOpen(true);
      setPullPreviewLoading(true);
      setPullPreviewConfirming(false);
      setPullPreviewData(null);
      setPullPreviewOrderId(orderId);
      previewPurchaseOrderChangeFromOrder(orderId)
        .then((res) => setPullPreviewData(res))
        .catch((error: unknown) => {
          message.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrderChange.pull.previewFailed')));
          resetPullPreviewModal();
        })
        .finally(() => setPullPreviewLoading(false));
    },
    [message, resetPullPreviewModal, t],
  );

  const handlePullPreviewConfirm = useCallback(async () => {
    if (!pullPreviewOrderId || !pullPreviewData) return;
    if (pullPreviewData.has_blocking_issues) return;
    setPullPreviewConfirming(true);
    try {
      const created = await createPurchaseOrderChangeFromOrder(
        pullPreviewOrderId,
        createReason.trim() || t('app.kuaizhizao.purchaseOrderChange.defaultReason'),
      );
      message.success(t('app.kuaizhizao.purchaseOrderChange.created', { code: created.change_code }));
      resetPullPreviewModal();
      await openEdit(created);
      actionRef.current?.reload();
    } catch (error: unknown) {
      message.error(getApiErrorMessage(error, t('app.kuaizhizao.purchaseOrderChange.pull.createFailed')));
    } finally {
      setPullPreviewConfirming(false);
    }
  }, [createReason, message, openEdit, pullPreviewData, pullPreviewOrderId, resetPullPreviewModal, t]);

  const pullFromPurchaseOrderQuery = useUniPullQuery<PullPurchaseOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    isRowDisabled: (record) => record.capabilities?.create_change_order?.allowed !== true,
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const skip = (page - 1) * pageSize;
        const result = await listPurchaseOrders({
          skip,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        const rows = (result.data || []).filter(
          (order): order is PullPurchaseOrderCandidate => order.id != null && !!order.order_code,
        );
        return { data: rows, total: result.total ?? rows.length };
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
      showPullCreatePreview(orderId);
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
      showPullCreatePreview(Number(sourceId));
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
    [message, modal, orderChangeLifecycleValueEnum, purchaseOrderChangeAuditColumn, purchaseOrderChangePerms.canDelete, purchaseOrderChangePerms.canUpdate, t],
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
        okText={t('common.next')}
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

      <Modal
        title={pullFromPurchaseOrderAction.label}
        open={pullPreviewOpen}
        destroyOnClose
        width={1100}
        onCancel={resetPullPreviewModal}
        okText={t('common.create')}
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
                message={purchaseOrderCapabilityReasonMessage(pullPreviewData.blocking_reason, t)}
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
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right' },
                  { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right' },
                  { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right' },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseOrderChange.pull.previewNoLines')} />
            )}
            {pullPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pullPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

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
        width={DRAWER_CONFIG.LARGE_WIDTH ?? DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detail ? (
            <Space>
              {detail.capabilities?.update?.allowed && purchaseOrderChangePerms.canUpdate ? (
                <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detail); }}>
                  {t('common.edit')}
                </Button>
              ) : null}
              {detail.capabilities?.submit?.allowed &&
              detail.capabilities?.preview_impact?.allowed &&
              purchaseOrderChangePerms.canAction?.('submit') ? (
                <Button icon={<ThunderboltOutlined />} onClick={() => runSubmitWithPreview(detail.id!)}>
                  {t('app.kuaizhizao.purchaseOrderChange.submit')}
                </Button>
              ) : null}
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
