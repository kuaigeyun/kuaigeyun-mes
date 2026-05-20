/**
 * 配料中心页面
 *
 * 按工单或生产计划，从主仓/线边仓拣选物料并按 BOM 配好，供产线使用。
 * 配料是提前准备、集中调配的仓储作业，区别于生产领料（工单直接领料）。
 *
 * Author: Luigi Lu
 * Date: 2026-02-28
 */

import React, { useRef, useState, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProFormSelect, ProFormTextArea, ProFormDatePicker, ProFormRadio, ProFormDependency, ProFormItem } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Card, Table, Form as AntForm, InputNumber, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined, EyeOutlined, CheckCircleOutlined, BellOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { warehouseApi } from '../../../services/warehouse-execution';
import { List, Typography, Progress } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, MODAL_CONFIG, DRAWER_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { batchingOrderApi } from '../../../services/batching-order';
import { getBatchingOrderStageName, getBatchingOrderLifecycle } from '../../../utils/batchingOrderLifecycle';
import { workOrderApi } from '../../../services/production';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

interface BatchingOrder {
  id?: number;
  uuid?: string;
  code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  work_order_id?: number;
  work_order_code?: string;
  batching_date?: string;
  status?: string;
  total_items?: number;
  target_warehouse_id?: number;
  target_warehouse_name?: string;
  remarks?: string;
  executed_by?: number;
  executed_by_name?: string;
  executed_at?: string;
  created_at?: string;
  updated_at?: string;
  items?: BatchingOrderItem[];
}

interface BatchingOrderItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  unit?: string;
  required_quantity?: number;
  picked_quantity?: number;
  status?: string;
}

const BatchingCenterPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<BatchingOrder | null>(null);
  const formRef = useRef<any>(null);
  const defaultBatchingItem = { material_id: undefined, material_code: '', material_name: '', material_unit: '', required_quantity: 1 };

  const appendBatchingItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        ...defaultBatchingItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = (workOrderId?: number) => {
    setCreateModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        create_mode: 'from_work_order',
        batching_date: dayjs(),
        work_order_id: workOrderId,
        items: [defaultBatchingItem],
      });
    }, 0);
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      if (values.create_mode === 'from_work_order') {
        if (!values.work_order_id) {
          messageApi.error('请选择工单');
          throw new Error('请选择工单');
        }
        await batchingOrderApi.pullFromWorkOrder({
          work_order_id: values.work_order_id,
          warehouse_id: values.warehouse_id,
          warehouse_name: values._warehouse_name || '',
          batching_date: values.batching_date?.toISOString?.() || new Date().toISOString(),
          target_warehouse_id: values.target_warehouse_id || undefined,
          target_warehouse_name: values._target_warehouse_name || undefined,
          remarks: values.remarks,
        });
        messageApi.success('从工单生成配料单成功');
      } else {
        const items = values.items || [];
        if (items.length === 0) {
          messageApi.error('手工创建时请至少添加一条配料明细');
          throw new Error('请添加配料明细');
        }
        const orderData: any = {
          warehouse_id: values.warehouse_id,
          warehouse_name: values._warehouse_name || '',
          batching_date: values.batching_date?.toISOString?.() || new Date().toISOString(),
          remarks: values.remarks,
        };
        const itemPayload = items.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          unit: it.material_unit || '',
          required_quantity: Number(it.required_quantity) || 0,
          warehouse_id: values.warehouse_id,
          warehouse_name: values._warehouse_name || '',
        }));
        await batchingOrderApi.create({ ...orderData, items: itemPayload });
        messageApi.success('配料单创建成功');
      }
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message && !error.message.includes('请选择') && !error.message.includes('请添加')) {
        messageApi.error(error.message || '创建配料单失败');
      }
      throw error;
    }
  };

  const handleDetail = async (record: BatchingOrder) => {
    try {
      const detail = await batchingOrderApi.get(record.id!.toString());
      setCurrentOrder(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取配料单详情失败');
    }
  };

  const handleConfirm = async (record: BatchingOrder) => {
    Modal.confirm({
      title: '确认配料',
      content: `确定要确认配料单 "${record.code}" 吗？确认后将扣减主仓库存。`,
      onOk: async () => {
        try {
          await batchingOrderApi.confirm(record.id!.toString());
          messageApi.success('配料确认成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '确认配料失败');
        }
      },
    });
  };

  const columns: ProColumns<BatchingOrder>[] = [
    {
      title: '配料单号',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '工单号',
      dataIndex: 'work_order_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: '配料日期',
      dataIndex: 'batching_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '物料种类',
      dataIndex: 'total_items',
      width: 100,
      align: 'right',
    },
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
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getBatchingOrderLifecycle(record as Record<string, unknown>);
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
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          {(record.status === 'draft' || record.status === 'picking') && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record)}
              style={{ color: '#52c41a' }}
            >
              确认配料
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <MaterialPrepReminders onCreateBatching={handleCreate} />
      <UniTable<BatchingOrder>
        headerTitle="配料单"
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.batching-center"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条配料单吗？仅草稿状态的配料单可删除。`,
            onOk: async () => {
              try {
                for (const id of keys) {
                  await batchingOrderApi.delete(String(id));
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                invalidateMenuBadgeCounts();

                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error?.message || '删除失败');
              }
            },
          });
        }}
        showCreateButton={true}
        createButtonText="新建配料单"
        onCreate={handleCreate}
        request={async (params) => {
          try {
            const result = await batchingOrderApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              code: params.code,
              warehouse_id: params.warehouse_id,
              work_order_id: params.work_order_id,
              status: params.status,
              keyword: (params as any).keyword,
            });
            return {
              data: result.items || [],
              success: true,
              total: result.total || 0,
            };
          } catch (error) {
            return { data: [], success: false, total: 0 };
          }
        }}
        scroll={{ x: 1800 }}
      />

      {/* 新建配料单 Modal */}
      <FormModalTemplate
        title="新建配料单"
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateSubmit}
        formRef={formRef}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        grid={false}
      >
        <ProFormRadio.Group
          name="create_mode"
          label="创建方式"
          options={[
            { label: '从工单生成', value: 'from_work_order' },
            { label: '手工创建', value: 'manual' },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormDependency name={['create_mode']}>
          {({ create_mode }) =>
            create_mode === 'from_work_order' ? (
              <ProFormSelect
                name="work_order_id"
                label="工单"
                placeholder="请选择工单"
                rules={[{ required: true, message: '请选择工单' }]}
                fieldProps={{
                  showSearch: true,
                  filterOption: (input: string, option: any) =>
                    option?.label?.toLowerCase().includes(input.toLowerCase()),
                }}
                request={async () => {
                  const res = await workOrderApi.list({ status: 'in_progress', limit: 200 });
                  const items = res?.items || res?.data || [];
                  return items.map((wo: any) => ({
                    label: `${wo.code || ''} - ${wo.name || ''}`,
                    value: wo.id,
                  }));
                }}
              />
            ) : null
          }
        </ProFormDependency>
        <ProFormDependency name={['create_mode']}>
          {({ create_mode }) =>
            create_mode === 'manual' ? (
              <div className="uni-table-detail" style={{ width: '100%' }}>
                <UniTableDetailHeader title="配料明细" required />
                <AntForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: '请至少添加一条配料明细' }]}>
                  <AntForm.List name="items">
                    {(fields, { add, remove }) => {
                      const cols = [
                        {
                          title: '物料',
                          dataIndex: 'material_id',
                          width: 260,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                              {({ getFieldValue }: any) => {
                                const row = getFieldValue('items')?.[index];
                                const mid = row?.material_id ? Number(row.material_id) : null;
                                const fallback = mid && (row?.material_code || row?.material_name)
                                  ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                                  : undefined;
                                return (
                                  <div className="warehouse-detail-material-cell">
                                    <UniMaterialSelect
                                      name={[index, 'material_id']}
                                      label=""
                                      placeholder="请选择物料"
                                      required
                                      size="small"
                                      listFieldKey={index}
                                      listFieldName="items"
                                      fillMapping={{
                                        material_code: 'mainCode',
                                        material_name: 'name',
                                        material_unit: 'baseUnit',
                                      }}
                                      fallbackOption={fallback}
                                      formItemProps={{ style: { margin: 0 } }}
                                      showQuickCreate
                                      showAdvancedSearch
                                    />
                                  </div>
                                );
                              }}
                            </AntForm.Item>
                          ),
                        },
                        {
                          title: '需求数量',
                          dataIndex: 'required_quantity',
                          width: 120,
                          align: 'right' as const,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item name={[index, 'required_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.0001, message: '>0' }]} style={{ margin: 0 }}>
                              <InputNumber placeholder="数量" min={0} precision={4} style={{ width: '100%' }} size="small" />
                            </AntForm.Item>
                          ),
                        },
                        {
                          title: '操作',
                          width: 60,
                          render: (_: any, __: any, index: number) => (
                            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                          ),
                        },
                      ];
                      const totalWidth = cols.reduce((s, c) => s + (c.width as number || 0), 0);
                      return (
                        <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                          <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                          <div style={{ width: '100%', overflowX: 'auto' }}>
                            <Table
                              className="warehouse-detail-table"
                              size="small"
                              dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                              rowKey="key"
                              pagination={false}
                              columns={cols}
                              scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                              style={{ width: '100%', margin: 0 }}
                              footer={() => (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                                  <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultBatchingItem)}>
                                    添加明细
                                  </Button>
                                  <Button
                                    type="default"
                                    icon={<ShoppingOutlined />}
                                    style={{ flex: 1, minWidth: 120 }}
                                    onClick={() => setMaterialPickerOpen(true)}
                                  >
                                    {t('app.kuaizhizao.common.materialBatchSelect')}
                                  </Button>
                                </div>
                              )}
                            />
                          </div>
                        </div>
                      );
                    }}
                  </AntForm.List>
                </AntForm.Item>
              </div>
            ) : null
          }
        </ProFormDependency>
        <Row gutter={16}>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label="拣选仓库"
              placeholder="请选择拣选源仓库"
              required
              onChange={(val, wh) => formRef.current?.setFieldsValue({ _warehouse_name: wh?.name })}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="target_warehouse_id"
              label="目标线边仓（可选）"
              placeholder="请选择目标线边仓"
              onChange={(val, wh) => formRef.current?.setFieldsValue({ _target_warehouse_name: wh?.name })}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="batching_date"
              label="配料日期"
              rules={[{ required: true, message: '请选择配料日期' }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12} />
        </Row>
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendBatchingItemsFromMaterials}
      />

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="配料单详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentOrder(null);
        }}
        dataSource={currentOrder || {}}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[
          { title: '配料单号', dataIndex: 'code' },
          { title: '仓库', dataIndex: 'warehouse_name' },
          { title: '工单号', dataIndex: 'work_order_code' },
          { title: '配料日期', dataIndex: 'batching_date', valueType: 'date' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (_, entity) => {
              const stageName = getBatchingOrderStageName(entity?.status);
              return <Tag>{stageName}</Tag>;
            },
          },
          { title: '物料种类', dataIndex: 'total_items' },
          { title: '目标线边仓', dataIndex: 'target_warehouse_name' },
          { title: '备注', dataIndex: 'remarks' },
          { title: '执行人', dataIndex: 'executed_by_name' },
          { title: '执行时间', dataIndex: 'executed_at', valueType: 'dateTime' },
        ]}
      >
        <DetailDrawerSection title="生命周期">
          {(() => {
            const lifecycle = getBatchingOrderLifecycle(currentOrder as unknown as Record<string, unknown>);
            const mainStages = lifecycle.mainStages ?? [];
            if (mainStages.length === 0) return null;
            return (
              <UniLifecycleStepper
                steps={mainStages}
                status={lifecycle.status}
                showLabels
                nextStepSuggestions={lifecycle.nextStepSuggestions}
              />
            );
          })()}
        </DetailDrawerSection>
        {currentOrder?.items && currentOrder.items.length > 0 && (
          <Card title="配料明细" style={{ marginTop: 16 }}>
            <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
            <Table
              className="warehouse-detail-table"
              columns={[
                { title: '物料编号', dataIndex: 'material_code', width: 120 },
                { title: '物料名称', dataIndex: 'material_name', width: 150 },
                { title: '需求数量', dataIndex: 'required_quantity', width: 100, align: 'right' },
                { title: '已拣数量', dataIndex: 'picked_quantity', width: 100, align: 'right' },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 100,
                  render: (status: string) => {
                    const map: Record<string, string> = { pending: '待拣', picked: '已拣' };
                    return <Tag>{map[status] ?? status}</Tag>;
                  },
                },
              ]}
              dataSource={currentOrder.items}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        )}
      </DetailDrawerTemplate>
    </ListPageTemplate>
  );
};

/**
 * 主动备料提醒组件
 */
const MaterialPrepReminders: React.FC<{ onCreateBatching: (workOrderId: number) => void }> = ({
  onCreateBatching,
}) => {
  const { data: reminders, isLoading } = useQuery({
    queryKey: ['materialPrepReminders'],
    queryFn: () => warehouseApi.productionPicking.getMaterialPrepReminders({ limit: 5 }),
    staleTime: 30000,
  });

  if (!reminders?.items?.length) return null;

  return (
    <Card
      size="small"
      title={
        <Space>
          <BellOutlined style={{ color: '#faad14' }} />
          <Typography.Text strong>智能备料提醒 (齐套工单)</Typography.Text>
        </Space>
      }
      style={{ marginBottom: 16, border: '1px solid #ffe58f', background: '#fffbe6' }}
      styles={{ body: { padding: '0 12px' } }}
    >
      <List
        size="small"
        loading={isLoading}
        dataSource={reminders.items}
        renderItem={(item: any) => (
          <List.Item
            extra={
              <Button type="primary" size="small" onClick={() => onCreateBatching(item.work_order_id)}>
                立即配料
              </Button>
            }
          >
            <List.Item.Meta
              title={
                <Space>
                  <Typography.Text code>{item.work_order_code}</Typography.Text>
                  <Tag color="green">齐套率 {Math.round(item.kitting_rate * 100)}%</Tag>
                </Space>
              }
              description={
                <Space size="large" style={{ fontSize: '12px', color: '#666' }}>
                  <span>推荐仓库: {item.suggested_warehouse_name || '主仓'}</span>
                  <span>计划开始: {item.planned_start_date ? dayjs(item.planned_start_date).format('MM-DD HH:mm') : '-'}</span>
                </Space>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
};

export default BatchingCenterPage;
