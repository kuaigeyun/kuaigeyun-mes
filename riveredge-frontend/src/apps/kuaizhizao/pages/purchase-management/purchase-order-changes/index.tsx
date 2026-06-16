/**
 * 采购变更单
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Descriptions, Form, Input, Modal, Space, Tag } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, PlusOutlined, RollbackOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
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
import {
  buildOrderChangeLifecycleValueEnum,
  getOrderChangeLifecycle,
  isOrderChangeDraft,
  resolveOrderChangeListLifecycleParams,
} from '../../../utils/orderChangeLifecycle';
import { formatOrderChangeCategory } from '../../../utils/orderChangeCategory';
import { OrderChangeItemsTable } from '../../../components/order-change/OrderChangeItemsTable';
import { OrderChangeImpactModal } from '../../../components/order-change/OrderChangeImpactModal';
import { OrderChangeSourceOrderPickerModal } from '../../../components/order-change/OrderChangeSourceOrderPickerModal';
import type { OrderChangeSourceOrderOption } from '../../../utils/orderChangeSourceOrder';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';

const PurchaseOrderChangesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>();
  const auditEnabled = useAuditRequired('kuaizhizao', 'purchase-order-change');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrderChange | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [editItems, setEditItems] = useState<PurchaseOrderChange['items']>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedSourceOrder, setSelectedSourceOrder] = useState<OrderChangeSourceOrderOption | null>(null);
  const [createReason, setCreateReason] = useState(() => t('app.kuaizhizao.purchaseOrderChange.defaultReason'));
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactData, setImpactData] = useState<Awaited<ReturnType<typeof previewPurchaseOrderChangeImpact>> | null>(null);
  const [pendingSubmitId, setPendingSubmitId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const openCreate = useCallback(() => {
    setSelectedSourceOrder(null);
    setCreateReason(t('app.kuaizhizao.purchaseOrderChange.defaultReason'));
    setCreateOpen(true);
  }, [t]);
  useNewShortcut(openCreate);

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
    await updatePurchaseOrderChange(editingId!, {
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
    });
    message.success(t('common.updateSuccess'));
    setEditOpen(false);
    setPendingEditFormValues(null);
    actionRef.current?.reload();
  };

  const handleCreateFromOrder = async (orderId: number, reason: string) => {
    const doc = await createPurchaseOrderChangeFromOrder(orderId, reason);
    message.success(t('app.kuaizhizao.purchaseOrderChange.created', { code: doc.change_code }));
    setCreateOpen(false);
    actionRef.current?.reload();
    await openEdit(doc);
  };

  useEffect(() => {
    const sourceId = searchParams.get('source_order_id');
    if (sourceId) {
      handleCreateFromOrder(Number(sourceId), t('app.kuaizhizao.purchaseOrderChange.defaultReason')).finally(() => {
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
      {
        title: t('app.kuaizhizao.purchaseOrderChange.colLifecycle'),
        dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
        valueType: 'select',
        valueEnum: orderChangeLifecycleValueEnum,
        render: (_, record) => {
          const lc = getOrderChangeLifecycle(record as Record<string, unknown>, t);
          const tag = getDocumentLifecycleStageTagProps(lc.stageName ?? '-');
          return <Tag color={tag.color}>{lc.stageName}</Tag>;
        },
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
    [message, modal, orderChangeLifecycleValueEnum, t],
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

  const handleBatchSubmit = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning(t('app.kuaizhizao.purchaseOrderChange.selectToSubmit'));
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
        await submitPurchaseOrderChange(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.purchaseOrderChange.batchSubmitSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.purchaseOrderChange.batchSubmitPartial', { count: failed }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message, t]);

  const handleBatchApprove = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning(t('app.kuaizhizao.purchaseOrderChange.selectToApprove'));
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
        await approvePurchaseOrderChange(id, true);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.purchaseOrderChange.batchApproveSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.purchaseOrderChange.batchApprovePartial', { count: failed }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message, t]);

  const handleBatchWithdraw = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning(t('app.kuaizhizao.purchaseOrderChange.selectToWithdraw'));
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
        await withdrawPurchaseOrderChange(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.purchaseOrderChange.batchWithdrawSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.purchaseOrderChange.batchWithdrawPartial', { count: failed }));
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
            {t('app.kuaizhizao.purchaseOrderChange.createFromOrder') + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.purchaseOrderChange.confirmBatchDelete', { count })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="purchase-order-change-batch-menu"
            selectedRowKeys={selectedRowKeys}
            menuItems={[
              {
                key: 'submit',
                label: t('app.kuaizhizao.purchaseOrderChange.batchSubmit'),
                icon: <SendOutlined />,
                onClick: handleBatchSubmit,
              },
              ...(auditEnabled
                ? [
                    {
                      key: 'approve',
                      label: t('app.kuaizhizao.purchaseOrderChange.batchApprove'),
                      icon: <CheckOutlined />,
                      onClick: handleBatchApprove,
                    },
                  ]
                : []),
              {
                key: 'withdraw',
                label: t('app.kuaizhizao.purchaseOrderChange.batchWithdraw'),
                icon: <RollbackOutlined />,
                onClick: handleBatchWithdraw,
              },
            ]}
          />,
        ]}
      />

      <Modal
        title={t('app.kuaizhizao.purchaseOrderChange.createModalTitle')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          if (!selectedSourceOrder?.id) {
            message.warning(t('app.kuaizhizao.purchaseOrderChange.selectPurchaseOrder'));
            return;
          }
          await handleCreateFromOrder(selectedSourceOrder.id, createReason);
        }}
        {...MODAL_CONFIG}
      >
        <Form layout="vertical">
          <Form.Item label={t('app.kuaizhizao.purchaseOrderChange.purchaseOrderLabel')} required>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                readOnly
                placeholder={t('app.kuaizhizao.purchaseOrderChange.selectPurchaseOrderPlaceholder')}
                value={
                  selectedSourceOrder
                    ? `${selectedSourceOrder.order_code}${selectedSourceOrder.partner_name ? ` - ${selectedSourceOrder.partner_name}` : ''}`
                    : ''
                }
              />
              <Button type="primary" onClick={() => setPickerOpen(true)}>
                {t('app.kuaizhizao.purchaseOrderChange.select')}
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label={t('app.kuaizhizao.purchaseOrderChange.colChangeReason')} required>
            <Input.TextArea rows={2} value={createReason} onChange={(e) => setCreateReason(e.target.value)} />
          </Form.Item>
        </Form>
      </Modal>

      <OrderChangeSourceOrderPickerModal
        open={pickerOpen}
        docType="purchase"
        onCancel={() => setPickerOpen(false)}
        onSelect={(order) => {
          setSelectedSourceOrder(order);
          setPickerOpen(false);
        }}
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
                autoApproveWhenSubmit={!auditEnabled}
                workflowAuditEnabled={auditEnabled}
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
            <UniLifecycle {...getOrderChangeLifecycle(detail as Record<string, unknown>, t)} />
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
                {detail.applied_at ? dayjs(detail.applied_at).format('YYYY-MM-DD HH:mm') : '-'}
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
