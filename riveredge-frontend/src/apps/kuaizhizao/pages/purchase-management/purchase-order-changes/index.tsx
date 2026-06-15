/**
 * 采购变更单
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Descriptions, Form, Input, Modal, Space, Tag } from 'antd';
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
  const [createReason, setCreateReason] = useState('订单变更');
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactData, setImpactData] = useState<Awaited<ReturnType<typeof previewPurchaseOrderChangeImpact>> | null>(null);
  const [pendingSubmitId, setPendingSubmitId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const openCreate = useCallback(() => {
    setSelectedSourceOrder(null);
    setCreateReason('订单变更');
    setCreateOpen(true);
  }, []);
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
    message.success('保存成功');
    setEditOpen(false);
    setPendingEditFormValues(null);
    actionRef.current?.reload();
  };

  const handleCreateFromOrder = async (orderId: number, reason: string) => {
    const doc = await createPurchaseOrderChangeFromOrder(orderId, reason);
    message.success(`已创建变更单 ${doc.change_code}`);
    setCreateOpen(false);
    actionRef.current?.reload();
    await openEdit(doc);
  };

  useEffect(() => {
    const sourceId = searchParams.get('source_order_id');
    if (sourceId) {
      handleCreateFromOrder(Number(sourceId), '订单变更').finally(() => {
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
      message.error(e?.message ?? '影响预览失败');
      setImpactOpen(false);
    } finally {
      setImpactLoading(false);
    }
  };

  const confirmSubmit = async () => {
    if (!pendingSubmitId) return;
    await submitPurchaseOrderChange(pendingSubmitId);
    message.success('提交成功');
    setImpactOpen(false);
    setPendingSubmitId(null);
    actionRef.current?.reload();
    if (detail?.id === pendingSubmitId) setDetail(await getPurchaseOrderChange(pendingSubmitId));
  };

  const columns: ProColumns<PurchaseOrderChange>[] = [
    {
      title: '供应商 / 变更单号',
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
    { title: '变更单号', dataIndex: 'change_code', hideInTable: true, copyable: true },
    { title: '供应商', dataIndex: 'supplier_name', hideInTable: true, ellipsis: true },
    { title: '原采购订单', dataIndex: 'source_order_code', width: 140 },
    { title: '版本', dataIndex: 'change_version', width: 70 },
    {
      title: '变更类别',
      dataIndex: 'change_category',
      width: 100,
      render: (_, r) => formatOrderChangeCategory(r.change_category),
    },
    {
      title: '差额',
      dataIndex: 'delta_amount',
      width: 100,
      render: (_, r) => (r.delta_amount != null ? Number(r.delta_amount).toFixed(2) : '-'),
    },
    {
      title: '生命周期',
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      valueType: 'select',
      valueEnum: buildOrderChangeLifecycleValueEnum(),
      render: (_, record) => {
        const lc = getOrderChangeLifecycle(record as Record<string, unknown>);
        const tag = getDocumentLifecycleStageTagProps(lc.stageName ?? '-');
        return <Tag color={tag.color}>{lc.stageName}</Tag>;
      },
    },
    { title: '变更原因', dataIndex: 'change_reason', ellipsis: true, hideInSearch: true },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_, record) => [
            <Button {...rowActionKind('read')} key="view" onClick={() => openDetail(record)}>
              详情
            </Button>,
            isOrderChangeDraft(record) ? (
              <Button {...rowActionKind('update')} key="edit" onClick={() => openEdit(record)}>
                编辑
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
                    title: '确认删除？',
                    onOk: async () => {
                      await deletePurchaseOrderChange(record.id!);
                      message.success('已删除');
                      actionRef.current?.reload();
                    },
                  });
                }}
              >
                删除
              </Button>
            ) : null,
          ],
    },
  ];

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
      message.warning('请先选择需要删除的记录');
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
    if (success > 0) message.success(`已删除 ${success} 条采购变更单`);
    if (failed > 0) message.warning(`${failed} 条删除失败（仅草稿可删除）`);
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message]);

  const handleBatchSubmit = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning('请先选择需要提交的记录');
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
    if (success > 0) message.success(`已提交 ${success} 条采购变更单`);
    if (failed > 0) message.warning(`${failed} 条提交失败（仅草稿可提交）`);
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message]);

  const handleBatchApprove = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning('请先选择需要审核的记录');
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
    if (success > 0) message.success(`已审核 ${success} 条采购变更单`);
    if (failed > 0) message.warning(`${failed} 条审核失败（仅待审核可操作）`);
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message]);

  const handleBatchWithdraw = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning('请先选择需要撤回的记录');
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
    if (success > 0) message.success(`已撤回 ${success} 条采购变更单`);
    if (failed > 0) message.warning(`${failed} 条撤回失败`);
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message]);

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
        pinnedTabsValueEnum={buildOrderChangeLifecycleValueEnum()}
        toolBarRender={() => [
          <Button {...rowActionKind('create')}
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
          >
            {'选单创建' + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => `确认删除选中的 ${count} 条采购变更单？`}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="purchase-order-change-batch-menu"
            selectedRowKeys={selectedRowKeys}
            menuItems={[
              {
                key: 'submit',
                label: '批量提交',
                icon: <SendOutlined />,
                onClick: handleBatchSubmit,
              },
              ...(auditEnabled
                ? [
                    {
                      key: 'approve',
                      label: '批量审核通过',
                      icon: <CheckOutlined />,
                      onClick: handleBatchApprove,
                    },
                  ]
                : []),
              {
                key: 'withdraw',
                label: '批量撤回',
                icon: <RollbackOutlined />,
                onClick: handleBatchWithdraw,
              },
            ]}
          />,
        ]}
      />

      <Modal
        title="从采购订单创建变更单"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          if (!selectedSourceOrder?.id) {
            message.warning('请选择采购订单');
            return;
          }
          await handleCreateFromOrder(selectedSourceOrder.id, createReason);
        }}
        {...MODAL_CONFIG}
      >
        <Form layout="vertical">
          <Form.Item label="采购订单" required>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                readOnly
                placeholder="请点击右侧选择采购订单"
                value={
                  selectedSourceOrder
                    ? `${selectedSourceOrder.order_code}${selectedSourceOrder.partner_name ? ` - ${selectedSourceOrder.partner_name}` : ''}`
                    : ''
                }
              />
              <Button type="primary" onClick={() => setPickerOpen(true)}>
                选择
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item label="变更原因" required>
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
        title="编辑采购变更单"
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
        <ProFormTextArea name="change_reason" label="变更原因" rules={[{ required: true }]} />
        <ProFormTextArea name="notes" label="备注" />
        <DocumentAttachmentsField category="purchase_order_change_attachments" />
        <OrderChangeItemsTable items={editItems ?? []} editable onChange={setEditItems} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`采购变更单 - ${detail?.change_code ?? ''}`}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH ?? DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detail ? (
            <Space>
              {isOrderChangeDraft(detail) && (
                <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detail); }}>
                  编辑
                </Button>
              )}
              {isOrderChangeDraft(detail) && (
                <Button icon={<ThunderboltOutlined />} onClick={() => runSubmitWithPreview(detail.id!)}>
                  提交
                </Button>
              )}
              <UniWorkflowActions {...rowActionKind('skip')}
                record={detail}
                entityName="采购变更单"
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
            <UniLifecycle {...getOrderChangeLifecycle(detail as Record<string, unknown>)} />
            <Descriptions column={2} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="原单号">{detail.source_order_code}</Descriptions.Item>
              <Descriptions.Item label="版本">V{detail.change_version}</Descriptions.Item>
              <Descriptions.Item label="供应商">{detail.supplier_name}</Descriptions.Item>
              <Descriptions.Item label="变更类别">
                {formatOrderChangeCategory(detail.change_category)}
              </Descriptions.Item>
              <Descriptions.Item label="变更前金额">{detail.before_total_amount}</Descriptions.Item>
              <Descriptions.Item label="变更后金额">{detail.after_total_amount}</Descriptions.Item>
              <Descriptions.Item label="差额">{detail.delta_amount}</Descriptions.Item>
              <Descriptions.Item label="生效时间">
                {detail.applied_at ? dayjs(detail.applied_at).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="变更原因" span={2}>
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
