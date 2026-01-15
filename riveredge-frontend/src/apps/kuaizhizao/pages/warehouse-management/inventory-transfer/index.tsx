/**
 * 库存调拨管理页面
 *
 * 提供库存调拨单的管理功能，包括创建调拨单、添加明细、执行调拨等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Card, Table } from 'antd';
import { PlusOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { inventoryTransferApi } from '../../../services/inventory-transfer';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';

interface InventoryTransfer {
  id?: number;
  uuid?: string;
  code?: string;
  from_warehouse_id?: number;
  from_warehouse_name?: string;
  to_warehouse_id?: number;
  to_warehouse_name?: string;
  transfer_date?: string;
  status?: string;
  total_items?: number;
  total_quantity?: number;
  total_amount?: number;
  transfer_reason?: string;
  remarks?: string;
  executed_by?: number;
  executed_by_name?: string;
  executed_at?: string;
  created_at?: string;
  updated_at?: string;
  items?: InventoryTransferItem[];
}

interface InventoryTransferItem {
  id?: number;
  uuid?: string;
  transfer_id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  from_warehouse_id?: number;
  from_location_id?: number;
  from_location_code?: string;
  to_warehouse_id?: number;
  to_location_id?: number;
  to_location_code?: string;
  batch_no?: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
  status?: string;
  remarks?: string;
}

const InventoryTransferPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const itemFormRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentTransfer, setCurrentTransfer] = useState<InventoryTransfer | null>(null);

  // 仓库列表状态
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  // 物料列表状态
  const [materialList, setMaterialList] = useState<any[]>([]);
  // 当前调拨单ID（用于添加明细）
  const [currentTransferId, setCurrentTransferId] = useState<number | null>(null);

  /**
   * 加载仓库列表
   */
  React.useEffect(() => {
    const loadWarehouses = async () => {
      try {
        // TODO: 调用仓库API获取仓库列表
        // const warehouses = await warehouseApi.list();
        // setWarehouseList(warehouses || []);
        setWarehouseList([
          { id: 1, name: '原材料仓库' },
          { id: 2, name: '成品仓库' },
          { id: 3, name: '半成品仓库' },
        ]);
      } catch (error) {
        console.error('加载仓库列表失败:', error);
      }
    };
    loadWarehouses();
  }, []);

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
   * 处理创建调拨单
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      transfer_date: dayjs(),
    });
  };

  /**
   * 处理提交创建调拨单
   */
  const handleCreateSubmit = async (values: any) => {
    try {
      if (values.from_warehouse_id === values.to_warehouse_id) {
        messageApi.error('调出仓库和调入仓库不能相同');
        throw new Error('调出仓库和调入仓库不能相同');
      }

      await inventoryTransferApi.create({
        from_warehouse_id: values.from_warehouse_id,
        from_warehouse_name: warehouseList.find((w: any) => w.id === values.from_warehouse_id)?.name || '',
        to_warehouse_id: values.to_warehouse_id,
        to_warehouse_name: warehouseList.find((w: any) => w.id === values.to_warehouse_id)?.name || '',
        transfer_date: values.transfer_date?.toISOString() || new Date().toISOString(),
        transfer_reason: values.transfer_reason,
        remarks: values.remarks,
      });
      messageApi.success('调拨单创建成功');
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== '调出仓库和调入仓库不能相同') {
        messageApi.error(error.message || '创建调拨单失败');
      }
      throw error;
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: InventoryTransfer) => {
    try {
      const detail = await inventoryTransferApi.get(record.id!.toString());
      setCurrentTransfer(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取调拨单详情失败');
    }
  };

  /**
   * 处理执行调拨
   */
  const handleExecute = async (record: InventoryTransfer) => {
    Modal.confirm({
      title: '执行调拨',
      content: `确定要执行调拨单 "${record.code}" 吗？执行后将更新库存。`,
      onOk: async () => {
        try {
          await inventoryTransferApi.execute(record.id!.toString());
          messageApi.success('调拨执行成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '执行调拨失败');
        }
      },
    });
  };

  /**
   * 处理添加调拨明细
   */
  const handleAddItem = (record: InventoryTransfer) => {
    setCurrentTransferId(record.id!);
    setItemModalVisible(true);
    itemFormRef.current?.resetFields();
    // 自动填充调出和调入仓库
    itemFormRef.current?.setFieldsValue({
      from_warehouse_id: record.from_warehouse_id,
      to_warehouse_id: record.to_warehouse_id,
    });
  };

  /**
   * 处理提交添加调拨明细
   */
  const handleAddItemSubmit = async (values: any) => {
    try {
      if (!currentTransferId) {
        messageApi.error('调拨单ID不存在');
        return;
      }

      const material = materialList.find((m: any) => m.id === values.material_id);
      if (!material) {
        messageApi.error('物料不存在');
        return;
      }

      await inventoryTransferApi.createItem(currentTransferId.toString(), {
        transfer_id: currentTransferId,
        material_id: values.material_id,
        material_code: material.code,
        material_name: material.name,
        from_warehouse_id: values.from_warehouse_id,
        from_location_id: values.from_location_id,
        from_location_code: values.from_location_code,
        to_warehouse_id: values.to_warehouse_id,
        to_location_id: values.to_location_id,
        to_location_code: values.to_location_code,
        batch_no: values.batch_no,
        quantity: values.quantity,
        unit_price: values.unit_price || 0,
        remarks: values.remarks,
      });
      messageApi.success('调拨明细添加成功');
      setItemModalVisible(false);
      setCurrentTransferId(null);
      itemFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '添加调拨明细失败');
      throw error;
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<InventoryTransfer>[] = [
    {
      title: '调拨单号',
      dataIndex: 'code',
      width: 150,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '调出仓库',
      dataIndex: 'from_warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '调入仓库',
      dataIndex: 'to_warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '调拨日期',
      dataIndex: 'transfer_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        in_progress: { text: '调拨中', status: 'processing' },
        completed: { text: '已完成', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '调拨物料总数',
      dataIndex: 'total_items',
      width: 120,
      align: 'right',
    },
    {
      title: '调拨总数量',
      dataIndex: 'total_quantity',
      width: 120,
      align: 'right',
    },
    {
      title: '调拨总金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (_, record) => `¥${record.total_amount?.toFixed(2) || '0.00'}`,
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
                icon={<PlusOutlined />}
                onClick={() => handleAddItem(record)}
              >
                添加明细
              </Button>
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleExecute(record)}
                style={{ color: '#52c41a' }}
              >
                执行调拨
              </Button>
            </>
          )}
          {record.status === 'in_progress' && (
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => handleAddItem(record)}
            >
              添加明细
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="库存调拨管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        showCreateButton={true}
        onCreate={handleCreate}
        request={async (params) => {
          try {
            const result = await inventoryTransferApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              code: params.code,
              from_warehouse_id: params.from_warehouse_id,
              to_warehouse_id: params.to_warehouse_id,
              status: params.status,
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
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建调拨单Modal */}
      <FormModalTemplate
        title="创建调拨单"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateSubmit}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <ProFormSelect
          name="from_warehouse_id"
          label="调出仓库"
          placeholder="请选择调出仓库"
          rules={[{ required: true, message: '请选择调出仓库' }]}
          options={warehouseList.map((w: any) => ({
            label: w.name,
            value: w.id,
          }))}
        />
        <ProFormSelect
          name="to_warehouse_id"
          label="调入仓库"
          placeholder="请选择调入仓库"
          rules={[{ required: true, message: '请选择调入仓库' }]}
          options={warehouseList.map((w: any) => ({
            label: w.name,
            value: w.id,
          }))}
        />
        <ProFormDatePicker
          name="transfer_date"
          label="调拨日期"
          rules={[{ required: true, message: '请选择调拨日期' }]}
          fieldProps={{
            style: { width: '100%' },
          }}
        />
        <ProFormTextArea
          name="transfer_reason"
          label="调拨原因"
          placeholder="请输入调拨原因"
          fieldProps={{ rows: 3 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 添加调拨明细Modal */}
      <FormModalTemplate
        title="添加调拨明细"
        open={itemModalVisible}
        onCancel={() => {
          setItemModalVisible(false);
          setCurrentTransferId(null);
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
          name="quantity"
          label="调拨数量"
          placeholder="请输入调拨数量"
          rules={[{ required: true, message: '请输入调拨数量' }]}
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
          name="from_location_code"
          label="调出库位编码（可选）"
          placeholder="请输入调出库位编码"
        />
        <ProFormText
          name="to_location_code"
          label="调入库位编码（可选）"
          placeholder="请输入调入库位编码"
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

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title="调拨单详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentTransfer(null);
        }}
        dataSource={currentTransfer || {}}
        columns={[
          {
            title: '调拨单号',
            dataIndex: 'code',
          },
          {
            title: '调出仓库',
            dataIndex: 'from_warehouse_name',
          },
          {
            title: '调入仓库',
            dataIndex: 'to_warehouse_name',
          },
          {
            title: '调拨日期',
            dataIndex: 'transfer_date',
            valueType: 'date',
          },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
              draft: { text: '草稿', status: 'default' },
              in_progress: { text: '调拨中', status: 'processing' },
              completed: { text: '已完成', status: 'success' },
              cancelled: { text: '已取消', status: 'error' },
            },
          },
          {
            title: '调拨物料总数',
            dataIndex: 'total_items',
          },
          {
            title: '调拨总数量',
            dataIndex: 'total_quantity',
          },
          {
            title: '调拨总金额',
            dataIndex: 'total_amount',
            render: (value: number) => `¥${value?.toFixed(2) || '0.00'}`,
          },
          {
            title: '调拨原因',
            dataIndex: 'transfer_reason',
          },
          {
            title: '备注',
            dataIndex: 'remarks',
          },
        ]}
      >
        {currentTransfer && currentTransfer.items && currentTransfer.items.length > 0 && (
          <Card title="调拨明细" style={{ marginTop: 16 }}>
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
                  title: '调拨数量',
                  dataIndex: 'quantity',
                  width: 100,
                  align: 'right',
                },
                {
                  title: '单价',
                  dataIndex: 'unit_price',
                  width: 100,
                  align: 'right',
                  render: (value: number) => `¥${value?.toFixed(2) || '0.00'}`,
                },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  width: 100,
                  align: 'right',
                  render: (value: number) => `¥${value?.toFixed(2) || '0.00'}`,
                },
                {
                  title: '批次号',
                  dataIndex: 'batch_no',
                  width: 100,
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  width: 100,
                  render: (status: string) => {
                    const statusMap: Record<string, { text: string; color: string }> = {
                      pending: { text: '待调拨', color: 'default' },
                      transferred: { text: '已调拨', color: 'success' },
                    };
                    const statusInfo = statusMap[status] || { text: status, color: 'default' };
                    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
                  },
                },
              ]}
              dataSource={currentTransfer.items}
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

export default InventoryTransferPage;
