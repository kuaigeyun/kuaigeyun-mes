/**
 * 销售变更单
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Descriptions, Form, Input, Modal, Space } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, RollbackOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import {
  approveSalesOrderChange,
  createSalesOrderChangeFromOrder,
  deleteSalesOrderChange,
  getSalesOrderChange,
  listSalesOrderChanges,
  previewSalesOrderChangeImpact,
  submitSalesOrderChange,
  updateSalesOrderChange,
  withdrawSalesOrderChange,
  type SalesOrderChange,
} from '../../../services/sales-order-change';
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
import { ListUniLifecycleCell } from '../shared/ListUniLifecycleCell';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';

const SalesOrderChangesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>();
  const auditEnabled = useAuditRequired('kuaizhizao', 'sales-order-change');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<SalesOrderChange | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [editItems, setEditItems] = useState<SalesOrderChange['items']>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedSourceOrder, setSelectedSourceOrder] = useState<OrderChangeSourceOrderOption | null>(null);
  const [createReason, setCreateReason] = useState(() => t('app.kuaizhizao.salesOrderChange.defaultReason'));
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactData, setImpactData] = useState<Awaited<ReturnType<typeof previewSalesOrderChangeImpact>> | null>(null);
  const [pendingSubmitId, setPendingSubmitId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const openCreate = useCallback(() => {
    setSelectedSourceOrder(null);
    setCreateReason(t('app.kuaizhizao.salesOrderChange.defaultReason'));
    setCreateOpen(true);
  }, [t]);
  useNewShortcut(openCreate);

  const openDetail = async (record: SalesOrderChange) => {
    const full = await getSalesOrderChange(record.id!);
    setDetail(full);
    setDetailOpen(true);
  };

  const openEdit = async (record: SalesOrderChange) => {
    const full = await getSalesOrderChange(record.id!);
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
    await updateSalesOrderChange(editingId!, {
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
    const doc = await createSalesOrderChangeFromOrder(orderId, reason);
    message.success(t('app.kuaizhizao.salesOrderChange.created', { code: doc.change_code }));
    setCreateOpen(false);
    actionRef.current?.reload();
    await openEdit(doc);
  };

  useEffect(() => {
    const sourceId = searchParams.get('source_order_id');
    if (sourceId) {
      handleCreateFromOrder(Number(sourceId), t('app.kuaizhizao.salesOrderChange.defaultReason')).finally(() => {
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
      const impact = await previewSalesOrderChangeImpact(id);
      setImpactData(impact);
    } catch (e: any) {
      message.error(e?.message ?? t('app.kuaizhizao.salesOrderChange.impactPreviewFailed'));
      setImpactOpen(false);
    } finally {
      setImpactLoading(false);
    }
  };

  const confirmSubmit = async () => {
    if (!pendingSubmitId) return;
    await submitSalesOrderChange(pendingSubmitId);
    message.success(t('app.kuaizhizao.salesOrderChange.submitSuccess'));
    setImpactOpen(false);
    setPendingSubmitId(null);
    actionRef.current?.reload();
    if (detail?.id === pendingSubmitId) {
      setDetail(await getSalesOrderChange(pendingSubmitId));
    }
  };

  const orderChangeLifecycleValueEnum = useMemo(
    () => buildOrderChangeLifecycleValueEnum(t),
    [t],
  );

  const columns: ProColumns<SalesOrderChange>[] = [
    {
      title: t('app.kuaizhizao.salesOrderChange.colCustomerChangeCode'),
      key: 'change_code',
      dataIndex: 'change_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.customer_name ?? '')}
          secondary={String(record.change_code ?? '')}
        />
      ),
    },
    { title: t('app.kuaizhizao.salesOrderChange.colChangeCode'), dataIndex: 'change_code', hideInTable: true, copyable: true },
    { title: t('app.kuaizhizao.customerFollowUp.colCustomer'), dataIndex: 'customer_name', hideInTable: true, ellipsis: true },
    { title: t('app.kuaizhizao.salesOrderChange.colSourceOrder'), dataIndex: 'source_order_code', width: 140 },
    { title: t('app.kuaizhizao.salesOrderChange.colVersion'), dataIndex: 'change_version', width: 70 },
    {
      title: t('app.kuaizhizao.salesOrderChange.colCategory'),
      dataIndex: 'change_category',
      width: 100,
      render: (_, r) => formatOrderChangeCategory(r.change_category),
    },
    {
      title: t('app.kuaizhizao.salesOrderChange.colDeltaAmount'),
      dataIndex: 'delta_amount',
      width: 100,
      render: (_, r) => (r.delta_amount != null ? Number(r.delta_amount).toFixed(2) : '-'),
    },
    {
      title: t('app.kuaizhizao.salesOrderChange.colLifecycle'),
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      valueType: 'select',
      valueEnum: orderChangeLifecycleValueEnum,
      render: (_, record) => (
        <ListUniLifecycleCell
          lifecycle={getOrderChangeLifecycle(record as Record<string, unknown>, t)}
        />
      ),
    },
    { title: t('app.kuaizhizao.salesOrderChange.colChangeReason'), dataIndex: 'change_reason', ellipsis: true, hideInSearch: true },
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
              <Button {...rowActionKind('delete')} key="del" onClick={() => {
                modal.confirm({
                  title: t('app.kuaizhizao.salesOrderChange.confirmDelete'),
                  onOk: async () => {
                    await deleteSalesOrderChange(record.id!);
                    message.success(t('app.kuaizhizao.salesOrderChange.deleted'));
                    actionRef.current?.reload();
                  },
                });
              }}>
                {t('common.delete')}
              </Button>
            ) : null,
          ],
    },
  ];

  const request = useCallback(async (params: Record<string, unknown>) => {
    const apiParams = resolveOrderChangeListLifecycleParams(params, params);
    const list = await listSalesOrderChanges({
      skip: ((params.current as number) - 1) * (params.pageSize as number),
      limit: params.pageSize as number,
      source_order_id: params.source_order_id as number | undefined,
      lifecycle_stage: apiParams.lifecycle_stage,
    });
    return { data: list, success: true, total: list.length };
  }, []);

  const handleBatchDelete = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning(t('app.kuaizhizao.salesOrderChange.selectToDelete'));
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
        await deleteSalesOrderChange(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.salesOrderChange.batchDeleteSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.salesOrderChange.batchDeletePartial', { count: failed }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message, t]);

  const handleBatchSubmit = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning(t('app.kuaizhizao.salesOrderChange.selectToSubmit'));
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
        await submitSalesOrderChange(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.salesOrderChange.batchSubmitSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.salesOrderChange.batchSubmitPartial', { count: failed }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message, t]);

  const handleBatchApprove = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning(t('app.kuaizhizao.salesOrderChange.selectToApprove'));
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
        await approveSalesOrderChange(id, true);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.salesOrderChange.batchApproveSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.salesOrderChange.batchApprovePartial', { count: failed }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message, t]);

  const handleBatchWithdraw = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning(t('app.kuaizhizao.salesOrderChange.selectToWithdraw'));
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
        await withdrawSalesOrderChange(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.salesOrderChange.batchWithdrawSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.salesOrderChange.batchWithdrawPartial', { count: failed }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message, t]);

  return (
    <ListPageTemplate>
      <UniTable<SalesOrderChange>
        actionRef={actionRef}
        rowKey="id"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        columns={columns}
        request={request}
        columnPersistenceId="apps.kuaizhizao.pages.sales-management.sales-order-changes"
        pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
        pinnedTabsValueEnum={orderChangeLifecycleValueEnum}
        toolBarRender={() => [
          <Button {...rowActionKind('create')}
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
          >
            {t('app.kuaizhizao.salesOrderChange.createFromOrder') + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.salesOrderChange.confirmBatchDelete', { count })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="sales-order-change-batch-menu"
            selectedRowKeys={selectedRowKeys}
            menuItems={[
              {
                key: 'submit',
                label: t('app.kuaizhizao.salesOrderChange.batchSubmit'),
                icon: <SendOutlined />,
                onClick: handleBatchSubmit,
              },
              ...(auditEnabled
                ? [
                    {
                      key: 'approve',
                      label: t('app.kuaizhizao.salesOrderChange.batchApprove'),
                      icon: <CheckOutlined />,
                      onClick: handleBatchApprove,
                    },
                  ]
                : []),
              {
                key: 'withdraw',
                label: t('app.kuaizhizao.salesOrderChange.batchWithdraw'),
                icon: <RollbackOutlined />,
                onClick: handleBatchWithdraw,
              },
            ]}
          />,
        ]}
      />

      <Modal
        title={t('app.kuaizhizao.salesOrderChange.createModalTitle')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          if (!selectedSourceOrder?.id) {
            message.warning(t('app.kuaizhizao.salesOrderChange.selectSalesOrder'));
            return;
          }
          await handleCreateFromOrder(selectedSourceOrder.id, createReason);
        }}
        {...MODAL_CONFIG}
      >
        <Form layout="vertical">
          <Form.Item label={t('app.kuaizhizao.salesOrderChange.salesOrderLabel')} required>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                readOnly
                placeholder={t('app.kuaizhizao.salesOrderChange.selectSalesOrderPlaceholder')}
                value={
                  selectedSourceOrder
                    ? `${selectedSourceOrder.order_code}${selectedSourceOrder.partner_name ? ` - ${selectedSourceOrder.partner_name}` : ''}`
                    : ''
                }
              />
              <Button type="primary" onClick={() => setPickerOpen(true)}>
                {t('app.kuaizhizao.salesOrderChange.select')}
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label={t('app.kuaizhizao.salesOrderChange.colChangeReason')} required>
            <Input.TextArea rows={2} value={createReason} onChange={(e) => setCreateReason(e.target.value)} />
          </Form.Item>
        </Form>
      </Modal>

      <OrderChangeSourceOrderPickerModal
        open={pickerOpen}
        docType="sales"
        onCancel={() => setPickerOpen(false)}
        onSelect={(order) => {
          setSelectedSourceOrder(order);
          setPickerOpen(false);
        }}
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.salesOrderChange.editTitle')}
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
        <ProFormTextArea name="change_reason" label={t('app.kuaizhizao.salesOrderChange.colChangeReason')} rules={[{ required: true }]} />
        <ProFormTextArea name="notes" label={t('app.kuaizhizao.salesOrderChange.notes')} />
        <DocumentAttachmentsField category="sales_order_change_attachments" />
        <OrderChangeItemsTable items={editItems ?? []} editable onChange={setEditItems} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.salesOrderChange.detailTitle', { code: detail?.change_code ?? '' })}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH ?? DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detail ? (
            <Space>
              {isOrderChangeDraft(detail) && (
                <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detail); }}>{t('common.edit')}</Button>
              )}
              {isOrderChangeDraft(detail) && (
                <Button icon={<ThunderboltOutlined />} onClick={() => runSubmitWithPreview(detail.id!)}>{t('app.kuaizhizao.salesOrderChange.submit')}</Button>
              )}
              <UniWorkflowActions {...rowActionKind('skip')}
                record={detail}
                entityName={t('app.kuaizhizao.salesOrderChange.entityName')}
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
                  if (detail.id) setDetail(await getSalesOrderChange(detail.id));
                }}
              />
            </Space>
          ) : null
        }
      >
        {detail && (
          <>
            {(() => {
              const lc = getOrderChangeLifecycle(detail as Record<string, unknown>, t);
              const mainStages = lc.mainStages ?? [];
              if (!mainStages.length) return null;
              return (
                <UniLifecycleStepper
                  steps={mainStages}
                  status={lc.status}
                  showLabels
                  nextStepSuggestions={lc.nextStepSuggestions}
                  hideNextStepSuggestions
                />
              );
            })()}
            <Descriptions column={2} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colSourceOrderCode')}>{detail.source_order_code}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colVersion')}>V{detail.change_version}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.customerFollowUp.colCustomer')}>{detail.customer_name}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colCategory')}>
                {formatOrderChangeCategory(detail.change_category)}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colBeforeAmount')}>{detail.before_total_amount}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colAfterAmount')}>{detail.after_total_amount}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colDeltaAmount')}>{detail.delta_amount}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colAppliedAt')}>{detail.applied_at ? dayjs(detail.applied_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.salesOrderChange.colChangeReason')} span={2}>{detail.change_reason}</Descriptions.Item>
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
        onClose={() => { setImpactOpen(false); setPendingSubmitId(null); }}
        onConfirm={confirmSubmit}
      />
    </ListPageTemplate>
  );
};

export default SalesOrderChangesPage;
