/**
 * 库存盘点管理页面
 *
 * 提供库存盘点单的管理功能，包括创建盘点单、执行盘点、处理差异等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table } from 'antd';
import { PlusOutlined, EyeOutlined, PlayCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { stocktakingApi } from '../../../services/stocktaking';
import { getStocktakingLifecycle } from '../../../utils/stocktakingLifecycle';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';

interface Stocktaking {
  id?: number;
  uuid?: string;
  code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  stocktaking_date?: string;
  status?: string;
  stocktaking_type?: string;
  total_items?: number;
  counted_items?: number;
  total_differences?: number;
  total_difference_amount?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
  items?: StocktakingItem[];
}

interface StocktakingItem {
  id?: number;
  uuid?: string;
  stocktaking_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  warehouse_id?: number;
  location_id?: number;
  location_code?: string;
  batch_no?: string;
  book_quantity?: number;
  actual_quantity?: number;
  difference_quantity?: number;
  unit_price?: number;
  difference_amount?: number;
  counted_by?: number;
  counted_by_name?: string;
  counted_at?: string;
  status?: string;
  remarks?: string;
}

const StocktakingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);
  const executeFormRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentStocktaking, setCurrentStocktaking] = useState<Stocktaking | null>(null);

  // 仓库列表状态 (由 UniWarehouseSelect 内部接管，不再需要手工维护)
  // 物料列表状态
  const [materialList, setMaterialList] = useState<any[]>([]);
  // 当前盘点单ID（用于添加明细）
  const [currentStocktakingId, setCurrentStocktakingId] = useState<number | null>(null);
  // 当前执行盘点的明细ID
  const [currentItemId, setCurrentItemId] = useState<number | null>(null);

  // 仓库加载交由 UniWarehouseSelect

  /**
   * 加载物料列表
   */
  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        const materials = await materialApi.list({ isActive: true });
        setMaterialList(materials || []);
      } catch (error) {
        console.error('加载物料列表失败:', error);
      }
    };
    loadMaterials();
  }, []);

  /**
   * 处理创建盘点单
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      stocktaking_date: dayjs(),
      stocktaking_type: 'full',
    });
  };

  /**
   * 处理提交创建盘点单
   */
  const handleCreateSubmit = async (values: any) => {
    try {
      await stocktakingApi.create({
        warehouse_id: values.warehouse_id,
        warehouse_name: values._warehouse_name || '', // _warehouse_name 可以由 UniWarehouseSelect 暴露或我们在 onChange 截获
        stocktaking_date: values.stocktaking_date?.toISOString() || new Date().toISOString(),
        stocktaking_type: values.stocktaking_type || 'full',
        remarks: values.remarks,
      });
      messageApi.success('盘点单创建成功');
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建盘点单失败');
      throw error;
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: Stocktaking) => {
    try {
      const detail = await stocktakingApi.get(record.id!.toString());
      setCurrentStocktaking(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取盘点单详情失败');
    }
  };

  /**
   * 处理开始盘点
   */
  const handleStart = async (record: Stocktaking) => {
    Modal.confirm({
      title: '开始盘点',
      content: `确定要开始盘点单 "${record.code}" 吗？`,
      onOk: async () => {
        try {
          await stocktakingApi.start(record.id!.toString());
          messageApi.success('盘点已开始');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '开始盘点失败');
        }
      },
    });
  };

  /**
   * 处理添加盘点明细
   */
  const handleAddItem = (record: Stocktaking) => {
    setCurrentStocktakingId(record.id!);
    setItemModalVisible(true);
    itemFormRef.current?.resetFields();
  };

  /**
   * 处理提交添加盘点明细
   */
  const handleAddItemSubmit = async (values: any) => {
    try {
      if (!currentStocktakingId) {
        messageApi.error('盘点单ID不存在');
        return;
      }

      const material = materialList.find((m: any) => m.id === values.material_id);
      if (!material) {
        messageApi.error('物料不存在');
        return;
      }

      await stocktakingApi.createItem(currentStocktakingId.toString(), {
        stocktaking_id: currentStocktakingId,
        material_id: values.material_id,
        material_code: material.code,
        material_name: material.name,
        warehouse_id: values.warehouse_id,
        location_id: values.location_id,
        location_code: values.location_code,
        batch_no: values.batch_no,
        book_quantity: values.book_quantity,
        unit_price: values.unit_price || 0,
        remarks: values.remarks,
      });
      messageApi.success('盘点明细添加成功');
      setItemModalVisible(false);
      setCurrentStocktakingId(null);
      itemFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '添加盘点明细失败');
      throw error;
    }
  };

  /**
   * 处理执行盘点明细
   */
  const handleExecuteItem = (item: StocktakingItem) => {
    setCurrentItemId(item.id!);
    setExecuteModalVisible(true);
    executeFormRef.current?.resetFields();
    executeFormRef.current?.setFieldsValue({
      actual_quantity: item.actual_quantity || item.book_quantity,
      remarks: item.remarks,
    });
  };

  /**
   * 处理提交执行盘点明细
   */
  const handleExecuteItemSubmit = async (values: any) => {
    try {
      if (!currentItemId || !currentStocktaking?.id) {
        messageApi.error('盘点明细ID不存在');
        return;
      }

      await stocktakingApi.executeItem(
        currentStocktaking.id.toString(),
        currentItemId.toString(),
        values.actual_quantity,
        values.remarks
      );
      messageApi.success('盘点明细执行成功');
      setExecuteModalVisible(false);
      setCurrentItemId(null);
      executeFormRef.current?.resetFields();
      // 刷新详情
      if (currentStocktaking) {
        const detail = await stocktakingApi.get(currentStocktaking.id.toString());
        setCurrentStocktaking(detail);
      }
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '执行盘点明细失败');
      throw error;
    }
  };

  /**
   * 处理盘点差异
   */
  const handleAdjust = async (record: Stocktaking) => {
    Modal.confirm({
      title: '处理盘点差异',
      content: `确定要处理盘点单 "${record.code}" 的差异吗？处理后将调整库存。`,
      onOk: async () => {
        try {
          await stocktakingApi.adjust(record.id!.toString());
          messageApi.success('盘点差异处理成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '处理盘点差异失败');
        }
      },
    });
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Stocktaking>[] = [
    {
      title: '盘点单号',
      dataIndex: 'code',
      width: 150,
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
      title: '盘点日期',
      dataIndex: 'stocktaking_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '盘点类型',
      dataIndex: 'stocktaking_type',
      width: 100,
      valueEnum: {
        full: { text: '全盘', status: 'default' },
        partial: { text: '抽盘', status: 'default' },
        cycle: { text: '循环盘点', status: 'default' },
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        in_progress: { text: '盘点中', status: 'processing' },
        completed: { text: '已完成', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
      render: (_, record) => {
        const lifecycle = getStocktakingLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const colorMap: Record<string, string> = { 草稿: 'default', 盘点中: 'processing', 已完成: 'success', 已取消: 'error' };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    {
      title: '盘点物料总数',
      dataIndex: 'total_items',
      width: 120,
      align: 'right',
    },
    {
      title: '已盘点物料数',
      dataIndex: 'counted_items',
      width: 120,
      align: 'right',
    },
    {
      title: '差异总数',
      dataIndex: 'total_differences',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <span style={{ color: record.total_differences! > 0 ? '#ff4d4f' : '#52c41a' }}>
          {record.total_differences || 0}
        </span>
      ),
    },
    {
      title: '差异总金额',
      dataIndex: 'total_difference_amount',
      width: 120,
      align: 'right',
      render: (_, record) => (
        <span style={{ color: record.total_difference_amount! > 0 ? '#ff4d4f' : '#52c41a' }}>
          ¥{record.total_difference_amount?.toFixed(2) || '0.00'}
        </span>
      ),
    },
    {
      title: '操作',
      width: 300,
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
          {record.status === 'draft' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStart(record)}
              >
                开始盘点
              </Button>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleAddItem(record)}
              >
                添加明细
              </Button>
            </>
          )}
          {record.status === 'in_progress' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleAddItem(record)}
              >
                添加明细
              </Button>
              {record.total_differences! > 0 && (
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleAdjust(record)}
                  style={{ color: '#52c41a' }}
                >
                  处理差异
                </Button>
              )}
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="成品盘点"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        showCreateButton={true}
        createButtonText="新建盘点单"
        onCreate={handleCreate}
        request={async (params) => {
          try {
            const result = await stocktakingApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              code: params.code,
              warehouse_id: params.warehouse_id,
              status: params.lifecycle ?? params.status,
              stocktaking_type: params.stocktaking_type,
            });
            return {
              data: result.items || [],
              success: true,
              total: result.total || 0,
            };
          } catch (error) {
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        enableRowSelection={true}
        showDeleteButton={true}
        onDelete={async (keys) => {
          Modal.confirm({
            title: '确认批量删除',
            content: `确定要删除选中的 ${keys.length} 条盘点单吗？`,
            onOk: async () => {
              try {
                for (const id of keys) {
                  await stocktakingApi.delete(String(id));
                }
                messageApi.success(`成功删除 ${keys.length} 条记录`);
                actionRef.current?.reload();
              } catch (error: any) {
                messageApi.error(error.message || '删除失败');
              }
            },
          });
        }}
      />

      {/* 创建盘点单Modal */}
      <FormModalTemplate
        title="创建盘点单"
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateSubmit}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <UniWarehouseSelect
          name="warehouse_id"
          label="仓库"
          placeholder="请选择仓库"
          required
          onChange={(_, option) => {
             // 如果 stocktakingApi.create 确实需要 name，可以在这里附加上一个隐藏字段
             formRef.current?.setFieldsValue({ _warehouse_name: option?.name });
          }}
        />
        <ProFormDatePicker
          name="stocktaking_date"
          label="盘点日期"
          rules={[{ required: true, message: '请选择盘点日期' }]}
          fieldProps={{
            style: { width: '100%' },
          }}
        />
        <ProFormSelect
          name="stocktaking_type"
          label="盘点类型"
          rules={[{ required: true, message: '请选择盘点类型' }]}
          options={[
            { label: '全盘', value: 'full' },
            { label: '抽盘', value: 'partial' },
            { label: '循环盘点', value: 'cycle' },
          ]}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 添加盘点明细Modal */}
      <FormModalTemplate
        title="添加盘点明细"
        open={itemModalVisible}
        onClose={() => {
          setItemModalVisible(false);
          setCurrentStocktakingId(null);
          itemFormRef.current?.resetFields();
        }}
        onFinish={handleAddItemSubmit}
        formRef={itemFormRef}
        {...MODAL_CONFIG}
      >
        <ProFormSelect
          name="material_id"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          options={materialList.map((m: any) => ({
            label: `${m.code} - ${m.name}`,
            value: m.id,
          }))}
          fieldProps={{
            showSearch: true,
            filterOption: (input: string, option: any) =>
              option?.label?.toLowerCase().includes(input.toLowerCase()),
          }}
        />
        <ProFormDigit
          name="book_quantity"
          label="账面数量"
          placeholder="请输入账面数量"
          rules={[{ required: true, message: '请输入账面数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit
          name="unit_price"
          label="单价"
          placeholder="请输入单价"
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormText
          name="location_code"
          label="库位编码（可选）"
          placeholder="请输入库位编码"
        />
        <ProFormText
          name="batch_no"
          label="批次号（可选）"
          placeholder="请输入批次号"
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 执行盘点明细Modal */}
      <FormModalTemplate
        title="执行盘点明细"
        open={executeModalVisible}
        onClose={() => {
          setExecuteModalVisible(false);
          setCurrentItemId(null);
          executeFormRef.current?.resetFields();
        }}
        onFinish={handleExecuteItemSubmit}
        formRef={executeFormRef}
        {...MODAL_CONFIG}
      >
        <ProFormDigit
          name="actual_quantity"
          label="实际数量"
          placeholder="请输入实际数量"
          rules={[{ required: true, message: '请输入实际数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title="盘点单详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentStocktaking(null);
        }}
        dataSource={currentStocktaking || {}}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[
          {
            title: '盘点单号',
            dataIndex: 'code',
          },
          {
            title: '仓库',
            dataIndex: 'warehouse_name',
          },
          {
            title: '盘点日期',
            dataIndex: 'stocktaking_date',
            valueType: 'date',
          },
          {
            title: '盘点类型',
            dataIndex: 'stocktaking_type',
            valueEnum: {
              full: '全盘',
              partial: '抽盘',
              cycle: '循环盘点',
            },
          },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
              draft: { text: '草稿', status: 'default' },
              in_progress: { text: '盘点中', status: 'processing' },
              completed: { text: '已完成', status: 'success' },
              cancelled: { text: '已取消', status: 'error' },
            },
          },
          {
            title: '盘点物料总数',
            dataIndex: 'total_items',
          },
          {
            title: '已盘点物料数',
            dataIndex: 'counted_items',
          },
          {
            title: '差异总数',
            dataIndex: 'total_differences',
          },
          {
            title: '差异总金额',
            dataIndex: 'total_difference_amount',
            render: (dom: React.ReactNode, entity: Stocktaking) => `¥${entity.total_difference_amount?.toFixed(2) || '0.00'}`,
          },
          {
            title: '备注',
            dataIndex: 'remarks',
          },
        ]}
        customContent={
          currentStocktaking && currentStocktaking.items && currentStocktaking.items.length > 0 && (
            <Card title="盘点明细" style={{ marginTop: 16 }}>
              <Table
                columns={[
                  {
                    title: '物料编码',
                    dataIndex: 'material_code',
                    width: 120,
                  },
                  {
                    title: '物料名称',
                    dataIndex: 'material_name',
                    width: 150,
                  },
                  {
                    title: '账面数量',
                    dataIndex: 'book_quantity',
                    width: 100,
                    align: 'right',
                  },
                  {
                    title: '实际数量',
                    dataIndex: 'actual_quantity',
                    width: 100,
                    align: 'right',
                  },
                  {
                    title: '差异数量',
                    dataIndex: 'difference_quantity',
                    width: 100,
                    align: 'right',
                    render: (value: number) => (
                      <span style={{ color: value > 0 ? '#ff4d4f' : value < 0 ? '#1890ff' : '#52c41a' }}>
                        {value > 0 ? '+' : ''}{value?.toFixed(2) || '0.00'}
                      </span>
                    ),
                  },
                  {
                    title: '差异金额',
                    dataIndex: 'difference_amount',
                    width: 100,
                    align: 'right',
                    render: (value: number) => (
                      <span style={{ color: value > 0 ? '#ff4d4f' : value < 0 ? '#1890ff' : '#52c41a' }}>
                        ¥{value?.toFixed(2) || '0.00'}
                      </span>
                    ),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 100,
                    render: (status: string) => {
                      const statusMap: Record<string, { text: string; color: string }> = {
                        pending: { text: '待盘点', color: 'default' },
                        counted: { text: '已盘点', color: 'processing' },
                        adjusted: { text: '已调整', color: 'success' },
                      };
                      const statusInfo = statusMap[status] || { text: status, color: 'default' };
                      return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
                    },
                  },
                  {
                    title: '操作',
                    width: 150,
                    render: (_: any, item: StocktakingItem) => (
                      <Space>
                        {currentStocktaking.status === 'in_progress' && item.status === 'pending' && (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => {
                              setCurrentStocktaking(currentStocktaking);
                              handleExecuteItem(item);
                            }}
                          >
                            执行盘点
                          </Button>
                        )}
                      </Space>
                    ),
                  },
                ]}
                dataSource={currentStocktaking.items}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </Card>
          )
        }
      />
    </ListPageTemplate>
  );
};

export default StocktakingPage;
