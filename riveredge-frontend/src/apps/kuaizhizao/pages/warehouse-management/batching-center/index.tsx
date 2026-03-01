/**
 * 配料中心页面
 *
 * 按工单或生产计划，从主仓/线边仓拣选物料并按 BOM 配好，供产线使用。
 * 配料是提前准备、集中调配的仓储作业，区别于生产领料（工单直接领料）。
 *
 * Author: Luigi Lu
 * Date: 2026-02-28
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormTextArea, ProFormDatePicker, ProFormDigit, ProFormRadio, ProFormDependency, ProFormList, ProFormGroup } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Card, Table } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { batchingOrderApi } from '../../../services/batching-order';
import { getBatchingOrderStageName } from '../../../utils/batchingOrderLifecycle';
import { workOrderApi } from '../../../services/production';
import { materialApi } from '../../../../master-data/services/material';
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
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<BatchingOrder | null>(null);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const formRef = useRef<any>(null);

  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const materials = await materialApi.list({ isActive: true });
        setMaterialList(materials?.data || materials?.items || materials || []);
      } catch (error) {
        console.error('加载物料列表失败:', error);
      }
    };
    loadMaterials();
  }, []);

  const handleCreate = () => {
    setCreateModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      create_mode: 'from_work_order',
      batching_date: dayjs(),
    });
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
        const itemPayload = items.map((it: any) => {
          const mat = materialList.find((m: any) => m.id === it.material_id);
          return {
            material_id: it.material_id,
            material_code: mat?.code || '',
            material_name: mat?.name || '',
            unit: mat?.unit || '',
            required_quantity: it.required_quantity,
            warehouse_id: values.warehouse_id,
            warehouse_name: values._warehouse_name || '',
          };
        });
        await batchingOrderApi.create({ ...orderData, items: itemPayload });
        messageApi.success('配料单创建成功');
      }
      setCreateModalVisible(false);
      formRef.current?.resetFields();
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
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, record) => {
        const stageName = getBatchingOrderStageName(record.status);
        const colorMap: Record<string, string> = {
          草稿: 'default',
          配料中: 'processing',
          已完成: 'success',
          已取消: 'error',
        };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
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
      <UniTable<BatchingOrder>
        headerTitle="配料单"
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
              <ProFormList
                name="items"
                label="配料明细"
                creatorButtonProps={{ creatorButtonText: '添加明细' }}
                min={1}
                colProps={{ span: 24 }}
              >
                <ProFormGroup>
                  <ProFormSelect
                    name="material_id"
                    label="物料"
                    placeholder="请选择物料"
                    rules={[{ required: true, message: '请选择物料' }]}
                    options={materialList.map((m: any) => ({
                      label: `${m.code || ''} - ${m.name || ''}`,
                      value: m.id,
                    }))}
                    fieldProps={{ showSearch: true }}
                  />
                  <ProFormDigit
                    name="required_quantity"
                    label="需求数量"
                    placeholder="请输入数量"
                    rules={[{ required: true, message: '请输入数量' }]}
                    min={0.0001}
                    fieldProps={{ precision: 4 }}
                  />
                </ProFormGroup>
              </ProFormList>
            ) : null
          }
        </ProFormDependency>
        <UniWarehouseSelect
          name="warehouse_id"
          label="拣选仓库"
          placeholder="请选择拣选源仓库"
          required
          onChange={(val, wh) => formRef.current?.setFieldsValue({ _warehouse_name: wh?.name })}
        />
        <UniWarehouseSelect
          name="target_warehouse_id"
          label="目标线边仓（可选）"
          placeholder="请选择目标线边仓"
          onChange={(val, wh) => formRef.current?.setFieldsValue({ _target_warehouse_name: wh?.name })}
        />
        <ProFormDatePicker
          name="batching_date"
          label="配料日期"
          rules={[{ required: true, message: '请选择配料日期' }]}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

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
        {currentOrder?.items && currentOrder.items.length > 0 && (
          <Card title="配料明细" style={{ marginTop: 16 }}>
            <Table
              columns={[
                { title: '物料编码', dataIndex: 'material_code', width: 120 },
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

export default BatchingCenterPage;
