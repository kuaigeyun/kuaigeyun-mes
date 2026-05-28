/**
 * 销售变更单
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Descriptions, Form, Input, Modal, Space, Tag } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
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
import { OrderChangeItemsTable } from '../../../components/order-change/OrderChangeItemsTable';
import { OrderChangeImpactModal } from '../../../components/order-change/OrderChangeImpactModal';
import { OrderChangeSourceOrderPickerModal } from '../../../components/order-change/OrderChangeSourceOrderPickerModal';
import type { OrderChangeSourceOrderOption } from '../../../utils/orderChangeSourceOrder';

const SalesOrderChangesPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>();
  const auditEnabled = useAuditRequired('kuaizhizao', 'sales-order-change');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<SalesOrderChange | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [editItems, setEditItems] = useState<SalesOrderChange['items']>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedSourceOrder, setSelectedSourceOrder] = useState<OrderChangeSourceOrderOption | null>(null);
  const [createReason, setCreateReason] = useState('订单变更');
  const [impactOpen, setImpactOpen] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactData, setImpactData] = useState<Awaited<ReturnType<typeof previewSalesOrderChangeImpact>> | null>(null);
  const [pendingSubmitId, setPendingSubmitId] = useState<number | null>(null);

  const openDetail = async (record: SalesOrderChange) => {
    const full = await getSalesOrderChange(record.id!);
    setDetail(full);
    setDetailOpen(true);
  };

  const openEdit = async (record: SalesOrderChange) => {
    const full = await getSalesOrderChange(record.id!);
    setEditingId(full.id!);
    setEditItems(full.items ?? []);
    editForm.setFieldsValue({
      change_reason: full.change_reason,
      notes: full.notes,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    const values = await editForm.validateFields();
    await updateSalesOrderChange(editingId!, {
      change_reason: values.change_reason,
      notes: values.notes,
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
    actionRef.current?.reload();
  };

  const handleCreateFromOrder = async (orderId: number, reason: string) => {
    const doc = await createSalesOrderChangeFromOrder(orderId, reason);
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
      const impact = await previewSalesOrderChangeImpact(id);
      setImpactData(impact);
    } catch (e: any) {
      message.error(e?.message ?? '影响预览失败');
      setImpactOpen(false);
    } finally {
      setImpactLoading(false);
    }
  };

  const confirmSubmit = async () => {
    if (!pendingSubmitId) return;
    await submitSalesOrderChange(pendingSubmitId);
    message.success('提交成功');
    setImpactOpen(false);
    setPendingSubmitId(null);
    actionRef.current?.reload();
    if (detail?.id === pendingSubmitId) {
      setDetail(await getSalesOrderChange(pendingSubmitId));
    }
  };

  const columns: ProColumns<SalesOrderChange>[] = [
    { title: '变更单号', dataIndex: 'change_code', width: 160, copyable: true },
    { title: '原销售订单', dataIndex: 'source_order_code', width: 140 },
    { title: '版本', dataIndex: 'change_version', width: 70 },
    { title: '客户', dataIndex: 'customer_name', ellipsis: true },
    { title: '变更类别', dataIndex: 'change_category', width: 100 },
    {
      title: '差额',
      dataIndex: 'delta_amount',
      width: 100,
      render: (_, r) => (r.delta_amount != null ? Number(r.delta_amount).toFixed(2) : '-'),
    },
    {
      title: '生命周期',
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      width: 120,
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
      render: (_, record) =>
        renderRowActionsOverflow(
          [
            <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>,
            isOrderChangeDraft(record) ? (
              <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                编辑
              </Button>
            ) : null,
            isOrderChangeDraft(record) ? (
              <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => {
                modal.confirm({
                  title: '确认删除？',
                  onOk: async () => {
                    await deleteSalesOrderChange(record.id!);
                    message.success('已删除');
                    actionRef.current?.reload();
                  },
                });
              }}>
                删除
              </Button>
            ) : null,
          ],
          `soc-${record.id}`,
        ),
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

  return (
    <ListPageTemplate>
      <UniTable<SalesOrderChange>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={request}
        columnPersistenceId="apps.kuaizhizao.pages.sales-management.sales-order-changes"
        pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
        pinnedTabsValueEnum={buildOrderChangeLifecycleValueEnum()}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedSourceOrder(null);
              setCreateReason('订单变更');
              setCreateOpen(true);
            }}
          >
            选单创建
          </Button>,
        ]}
      />

      <Modal
        title="从销售订单创建变更单"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={async () => {
          if (!selectedSourceOrder?.id) {
            message.warning('请选择销售订单');
            return;
          }
          await handleCreateFromOrder(selectedSourceOrder.id, createReason);
        }}
        {...MODAL_CONFIG}
      >
        <Form layout="vertical">
          <Form.Item label="销售订单" required>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                readOnly
                placeholder="请点击右侧选择销售订单"
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
        docType="sales"
        onCancel={() => setPickerOpen(false)}
        onSelect={(order) => {
          setSelectedSourceOrder(order);
          setPickerOpen(false);
        }}
      />

      <FormModalTemplate
        title="编辑销售变更单"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onFinish={handleSaveEdit}
        form={editForm}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      >
        <ProFormTextArea name="change_reason" label="变更原因" rules={[{ required: true }]} />
        <ProFormTextArea name="notes" label="备注" />
        <OrderChangeItemsTable items={editItems ?? []} editable onChange={setEditItems} />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`销售变更单 - ${detail?.change_code ?? ''}`}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH ?? DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detail ? (
            <Space>
              {isOrderChangeDraft(detail) && (
                <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); openEdit(detail); }}>编辑</Button>
              )}
              {isOrderChangeDraft(detail) && (
                <Button icon={<ThunderboltOutlined />} onClick={() => runSubmitWithPreview(detail.id!)}>提交</Button>
              )}
              <UniWorkflowActions
                record={detail}
                entityName="销售变更单"
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={['DRAFT', '草稿']}
                pendingStatuses={['PENDING_REVIEW', '待审核']}
                approvedStatuses={['AUDITED', '已审核', 'APPLIED', '已生效']}
                rejectedStatuses={['REJECTED', '已驳回']}
                autoApproveWhenSubmit={!auditEnabled}
                workflowAuditEnabled={auditEnabled}
                actions={{
                  approve: (id, approved, reason) => approveSalesOrderChange(id, approved, reason),
                  revoke: withdrawSalesOrderChange,
                }}
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
            <UniLifecycle {...getOrderChangeLifecycle(detail as Record<string, unknown>)} />
            <Descriptions column={2} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="原单号">{detail.source_order_code}</Descriptions.Item>
              <Descriptions.Item label="版本">V{detail.change_version}</Descriptions.Item>
              <Descriptions.Item label="客户">{detail.customer_name}</Descriptions.Item>
              <Descriptions.Item label="变更类别">{detail.change_category}</Descriptions.Item>
              <Descriptions.Item label="变更前金额">{detail.before_total_amount}</Descriptions.Item>
              <Descriptions.Item label="变更后金额">{detail.after_total_amount}</Descriptions.Item>
              <Descriptions.Item label="差额">{detail.delta_amount}</Descriptions.Item>
              <Descriptions.Item label="生效时间">{detail.applied_at ? dayjs(detail.applied_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
              <Descriptions.Item label="变更原因" span={2}>{detail.change_reason}</Descriptions.Item>
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
