import React, { useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Card, Col, Form as AntForm, Modal, Row, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import {
  DRAWER_CONFIG,
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { resolveListLifecycleStageFromSearch } from '../../../../../utils/listLifecycleStage';

type OrderLike = {
  id?: number;
  code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  product_material_name?: string;
  total_quantity?: number;
  total_items?: number;
  status?: string;
  remarks?: string;
  updated_at?: string;
  executed_by_name?: string;
  executed_at?: string;
  items?: ItemLike[];
  [key: string]: any;
};

type ItemLike = {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
  status?: string;
  remarks?: string;
  [key: string]: any;
};

type OrderApi = {
  list: (params?: any) => Promise<any>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  get: (id: string) => Promise<any>;
  createItem: (orderId: string, data: any) => Promise<any>;
  updateItem: (orderId: string, itemId: string, data: any) => Promise<any>;
  deleteItem: (orderId: string, itemId: string) => Promise<any>;
  execute: (orderId: string) => Promise<any>;
  delete: (id: string) => Promise<any>;
};

type PageConfig = {
  headerTitle: string;
  persistenceId: string;
  createButtonText: string;
  createModalTitle: string;
  detailTitlePrefix: string;
  dateField: string;
  dateLabel: string;
  actionNoun: string;
  executeActionLabel: string;
  createSuccessText: string;
  updateSuccessText?: string;
  addItemSuccessText: string;
  updateItemSuccessText?: string;
  executeSuccessText: string;
  deleteSuccessNoun: string;
  quantityLabel: string;
  listEmptyText: string;
  itemDoneStatus: string;
  getLifecycle: (record: Record<string, unknown>) => {
    percent: number;
    stageName: string;
    status: 'normal' | 'warning' | 'exception' | 'success' | 'active';
    subStages?: string[];
  };
};

const orderStatusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  in_progress: { text: '进行中', color: 'processing' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'error' },
  草稿: { text: '草稿', color: 'default' },
  进行中: { text: '进行中', color: 'processing' },
  已完成: { text: '已完成', color: 'success' },
  已取消: { text: '已取消', color: 'error' },
};

const itemStatusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'default' },
  consumed: { text: '已消耗', color: 'success' },
  produced: { text: '已产出', color: 'success' },
};

export const AssemblyDisassemblyOrdersPage: React.FC<{
  api: OrderApi;
  config: PageConfig;
}> = ({ api, config }) => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<OrderLike | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderLike | null>(null);
  const [editingItem, setEditingItem] = useState<ItemLike | null>(null);

  const reloadList = () => actionRef.current?.reload();

  const refreshCurrentOrder = async (orderId?: number) => {
    const targetId = orderId ?? currentOrder?.id;
    if (!targetId) return;
    try {
      const fresh = await api.get(String(targetId));
      setCurrentOrder(fresh as OrderLike);
    } catch {
      // keep current drawer content unchanged when refresh fails
    }
  };

  const openCreateModal = () => {
    setEditingOrder(null);
    setCreateModalVisible(true);
    setTimeout(() => {
      createFormRef.current?.resetFields();
      createFormRef.current?.setFieldsValue({
        [config.dateField]: dayjs(),
        total_quantity: 1,
      });
    }, 0);
  };

  const openEditOrderModal = (order: OrderLike) => {
    setEditingOrder(order);
    setCreateModalVisible(true);
    setTimeout(() => {
      createFormRef.current?.resetFields();
      createFormRef.current?.setFieldsValue({
        warehouse_id: order.warehouse_id,
        warehouse_name: order.warehouse_name,
        _warehouse_name: order.warehouse_name,
        [config.dateField]: order[config.dateField] ? dayjs(order[config.dateField]) : dayjs(),
        product_material_id: order.product_material_id,
        product_material_code: order.product_material_code,
        product_material_name: order.product_material_name,
        total_quantity: order.total_quantity ?? 1,
        remarks: order.remarks,
      });
    }, 0);
  };

  const submitCreateOrder = async (values: any) => {
    try {
      const orderDate = dayjs(values[config.dateField]);
      const payload = {
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name || values._warehouse_name || '',
        [config.dateField]: orderDate.isValid() ? orderDate.toISOString() : new Date().toISOString(),
        product_material_id: values.product_material_id,
        product_material_code: values.product_material_code || '',
        product_material_name: values.product_material_name || '',
        total_quantity: Number(values.total_quantity || 0),
        remarks: values.remarks,
      };
      if (editingOrder?.id) {
        await api.update(String(editingOrder.id), payload);
        messageApi.success(config.updateSuccessText || `${config.actionNoun}更新成功`);
      } else {
        await api.create(payload);
        messageApi.success(config.createSuccessText);
      }
      setCreateModalVisible(false);
      setEditingOrder(null);
      createFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      reloadList();
      if (currentOrder?.id && editingOrder?.id === currentOrder.id) {
        await refreshCurrentOrder(currentOrder.id);
      }
    } catch (error: any) {
      messageApi.error(error?.message || `${config.actionNoun}${editingOrder ? '更新' : '新增'}失败`);
      throw error;
    }
  };

  const openDetailDrawer = async (record: OrderLike) => {
    try {
      const detail = await api.get(String(record.id));
      setCurrentOrder(detail as OrderLike);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error?.message || `${config.actionNoun}详情加载失败`);
    }
  };

  const confirmDeleteOrder = async (record: OrderLike) => {
    Modal.confirm({
      title: `删除${config.actionNoun}`,
      content: `确定删除 ${config.actionNoun} "${record.code}" 吗？`,
      onOk: async () => {
        try {
          await api.delete(String(record.id));
          messageApi.success(`删除${config.deleteSuccessNoun}成功`);
          invalidateMenuBadgeCounts();
          if (currentOrder?.id === record.id) {
            setDetailDrawerVisible(false);
            setCurrentOrder(null);
          }
          reloadList();
        } catch (error: any) {
          messageApi.error(error?.message || `删除${config.actionNoun}失败`);
        }
      },
    });
  };

  const openItemModal = (record: OrderLike, item?: ItemLike) => {
    setCurrentOrderId(record.id ?? null);
    setEditingItem(item ?? null);
    setItemModalVisible(true);
    setTimeout(() => {
      itemFormRef.current?.resetFields();
      if (item) {
        itemFormRef.current?.setFieldsValue({
          material_id: item.material_id,
          material_code: item.material_code,
          material_name: item.material_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          remarks: item.remarks,
        });
      }
    }, 0);
  };

  const submitCreateItem = async (values: any) => {
    try {
      if (!currentOrderId) {
        messageApi.error(`${config.actionNoun}ID不存在`);
        return;
      }
      if (editingItem?.id) {
        await api.updateItem(String(currentOrderId), String(editingItem.id), {
          quantity: Number(values.quantity || 0),
          unit_price: Number(values.unit_price || 0),
          remarks: values.remarks,
        });
        messageApi.success(config.updateItemSuccessText || `${config.actionNoun}明细更新成功`);
      } else {
        await api.createItem(String(currentOrderId), {
          material_id: values.material_id,
          material_code: values.material_code || '',
          material_name: values.material_name || '',
          quantity: Number(values.quantity || 0),
          unit_price: Number(values.unit_price || 0),
          remarks: values.remarks,
        });
        messageApi.success(config.addItemSuccessText);
      }
      setItemModalVisible(false);
      setCurrentOrderId(null);
      setEditingItem(null);
      itemFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      reloadList();
      await refreshCurrentOrder(currentOrderId);
    } catch (error: any) {
      messageApi.error(error?.message || '添加明细失败');
      throw error;
    }
  };

  const confirmDeleteItem = (order: OrderLike, item: ItemLike) => {
    Modal.confirm({
      title: '删除明细',
      content: `确定删除明细 "${item.material_code || item.material_name || item.id}" 吗？`,
      onOk: async () => {
        try {
          if (!order.id || !item.id) return;
          await api.deleteItem(String(order.id), String(item.id));
          messageApi.success('明细删除成功');
          invalidateMenuBadgeCounts();
          reloadList();
          await refreshCurrentOrder(order.id);
        } catch (error: any) {
          messageApi.error(error?.message || '明细删除失败');
        }
      },
    });
  };

  const confirmExecuteOrder = (record: OrderLike) => {
    const itemCount = Array.isArray(record.items) ? record.items.length : Number(record.total_items || 0);
    if (itemCount <= 0) {
      messageApi.warning(`请先为${config.actionNoun}添加至少一条明细，再执行。`);
      return;
    }
    Modal.confirm({
      title: config.executeActionLabel,
      content: `确定${config.executeActionLabel} "${record.code}" 吗？系统将更新库存。`,
      onOk: async () => {
        try {
          await api.execute(String(record.id));
          messageApi.success(config.executeSuccessText);
          invalidateMenuBadgeCounts();
          reloadList();
          await refreshCurrentOrder(record.id);
        } catch (error: any) {
          messageApi.error(error?.message || `${config.executeActionLabel}失败`);
        }
      },
    });
  };

  const columns: ProColumns<OrderLike>[] = [
    {
      title: `${config.actionNoun}单号`,
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    { title: config.dateLabel, dataIndex: config.dateField, valueType: 'date', width: 120 },
    { title: '成品物料', dataIndex: 'product_material_name', width: 160, ellipsis: true },
    { title: config.quantityLabel, dataIndex: 'total_quantity', width: 110, align: 'right' },
    { title: '组件数', dataIndex: 'total_items', width: 90, align: 'right' },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = config.getLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 260,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetailDrawer(record)}>
            详情
          </Button>
          {record.status === 'draft' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditOrderModal(record)}>
                编辑
              </Button>
              <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openItemModal(record)}>
                添加明细
              </Button>
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                style={{ color: '#52c41a' }}
                onClick={() => confirmExecuteOrder(record)}
              >
                {config.executeActionLabel}
              </Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDeleteOrder(record)}>
                删除
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const detailColumns: ProDescriptionsItemProps<OrderLike>[] = [
    { title: `${config.actionNoun}单号`, dataIndex: 'code' },
    { title: '仓库', dataIndex: 'warehouse_name' },
    { title: config.dateLabel, dataIndex: config.dateField, valueType: 'date' },
    { title: '成品物料', dataIndex: 'product_material_name' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const mapped = orderStatusMap[String(status ?? '')] || { text: String(status ?? '-'), color: 'default' };
        return <Tag color={mapped.color}>{mapped.text}</Tag>;
      },
    },
    { title: config.quantityLabel, dataIndex: 'total_quantity' },
    { title: '组件数', dataIndex: 'total_items' },
    { title: '执行人', dataIndex: 'executed_by_name' },
    { title: '执行时间', dataIndex: 'executed_at', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'remarks', span: 2 },
  ];

  return (
    <ListPageTemplate>
      <UniTable<OrderLike>
        headerTitle={config.headerTitle}
        columnPersistenceId={config.persistenceId}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch
        showCreateButton
        createButtonText={config.createButtonText}
        onCreate={openCreateModal}
        enableRowSelection
        showDeleteButton
        onDelete={async (keys) => {
          Modal.confirm({
            title: `确认批量删除${config.actionNoun}`,
            content: `确定要删除选中的 ${keys.length} 条${config.actionNoun}吗？`,
            onOk: async () => {
              try {
                for (const key of keys) {
                  await api.delete(String(key));
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                invalidateMenuBadgeCounts();
                reloadList();
              } catch (error: any) {
                messageApi.error(error?.message || '删除失败');
              }
            },
          });
        }}
        request={async (params, _sort, _filter, searchFormValues) => {
          const lifecycleStage = resolveListLifecycleStageFromSearch(searchFormValues, params);
          const result = await api.list({
            skip: (params.current! - 1) * params.pageSize!,
            limit: params.pageSize,
            code: params.code,
            warehouse_id: params.warehouse_id,
            status: lifecycleStage ?? params.status,
            keyword: (params as any).keyword,
          });
          return {
            data: result.items || result.data || [],
            success: true,
            total: result.total || 0,
          };
        }}
        locale={{ emptyText: config.listEmptyText }}
        scroll={{ x: 1800 }}
      />

      <FormModalTemplate
        title={editingOrder ? `编辑${config.actionNoun}` : config.createModalTitle}
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingOrder(null);
          createFormRef.current?.resetFields();
        }}
        onFinish={submitCreateOrder}
        formRef={createFormRef}
        grid={false}
        {...MODAL_CONFIG}
      >
        <Row gutter={16}>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label="仓库"
              placeholder="请选择仓库"
              required
              onChange={(_, option) => {
                createFormRef.current?.setFieldsValue({
                  _warehouse_name: option?.name ?? '',
                  warehouse_name: option?.name ?? '',
                });
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name={config.dateField}
              label={config.dateLabel}
              rules={[{ required: true, message: `请选择${config.dateLabel}` }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <UniMaterialSelect
          name="product_material_id"
          label="成品物料"
          placeholder="请选择成品物料"
          required
          showQuickCreate
          showAdvancedSearch
          fillMapping={{
            product_material_code: 'mainCode',
            product_material_name: 'name',
          }}
        />
        <ProFormDigit
          name="total_quantity"
          label={config.quantityLabel}
          rules={[{ required: true, message: `请输入${config.quantityLabel}` }]}
          min={0.01}
          fieldProps={{ precision: 2 }}
        />
        <ProFormTextArea name="remarks" label="备注" placeholder="请输入备注" fieldProps={{ rows: 3 }} />
        <AntForm.Item name="_warehouse_name" hidden />
        <AntForm.Item name="warehouse_name" hidden />
        <AntForm.Item name="product_material_code" hidden />
        <AntForm.Item name="product_material_name" hidden />
      </FormModalTemplate>

      <FormModalTemplate
        title={editingItem ? `编辑${config.actionNoun}明细` : `添加${config.actionNoun}明细`}
        open={itemModalVisible}
        onClose={() => {
          setItemModalVisible(false);
          setCurrentOrderId(null);
          setEditingItem(null);
          itemFormRef.current?.resetFields();
        }}
        onFinish={submitCreateItem}
        formRef={itemFormRef}
        {...MODAL_CONFIG}
      >
        <UniMaterialSelect
          name="material_id"
          label="组件物料"
          placeholder="请选择组件物料"
          required
          disabled={!!editingItem}
          showQuickCreate
          showAdvancedSearch
          fillMapping={{
            material_code: 'mainCode',
            material_name: 'name',
          }}
        />
        <ProFormDigit
          name="quantity"
          label="数量"
          rules={[{ required: true, message: '请输入数量' }]}
          min={0.01}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit name="unit_price" label="单价" min={0} fieldProps={{ precision: 2 }} />
        <ProFormTextArea name="remarks" label="备注" placeholder="请输入备注" fieldProps={{ rows: 3 }} />
        <AntForm.Item name="material_code" hidden />
        <AntForm.Item name="material_name" hidden />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`${config.detailTitlePrefix}${currentOrder?.code ? ` - ${currentOrder.code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentOrder(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={currentOrder || {}}
        columns={detailColumns}
        customContent={
          currentOrder?.items && currentOrder.items.length > 0 ? (
            <Card
              title="明细"
              extra={
                currentOrder.status === 'draft' ? (
                  <Space>
                    <Button size="small" onClick={() => openEditOrderModal(currentOrder)}>
                      编辑主单
                    </Button>
                    <Button size="small" onClick={() => openItemModal(currentOrder)}>
                      添加明细
                    </Button>
                    <Button size="small" type="primary" onClick={() => confirmExecuteOrder(currentOrder)}>
                      {config.executeActionLabel}
                    </Button>
                  </Space>
                ) : undefined
              }
            >
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table<ItemLike>
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '组件编码', dataIndex: 'material_code', width: 120 },
                  { title: '组件名称', dataIndex: 'material_name', width: 150 },
                  { title: '数量', dataIndex: 'quantity', width: 90, align: 'right' },
                  {
                    title: '单价',
                    dataIndex: 'unit_price',
                    width: 90,
                    align: 'right',
                    render: (value) => Number(value || 0).toFixed(2),
                  },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    width: 90,
                    align: 'right',
                    render: (value) => Number(value || 0).toFixed(2),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 90,
                    render: (status) => {
                      const mapped =
                        itemStatusMap[String(status ?? '')] ||
                        (String(status ?? '') === config.itemDoneStatus
                          ? { text: config.itemDoneStatus, color: 'success' }
                          : { text: String(status ?? '-'), color: 'default' });
                      return <Tag color={mapped.color}>{mapped.text}</Tag>;
                    },
                  },
                  { title: '备注', dataIndex: 'remarks' },
                  {
                    title: '操作',
                    width: 150,
                    render: (_, item) =>
                      currentOrder.status === 'draft' ? (
                        <Space size={0}>
                          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openItemModal(currentOrder, item)}>
                            编辑
                          </Button>
                          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => confirmDeleteItem(currentOrder, item)}>
                            删除
                          </Button>
                        </Space>
                      ) : null,
                  },
                ]}
                dataSource={currentOrder.items}
              />
            </Card>
          ) : (
            <Card title="明细">
              <Typography.Text type="secondary">暂无明细，请先添加。</Typography.Text>
            </Card>
          )
        }
      />
    </ListPageTemplate>
  );
};

