/**
 * 生产订单管理页面
 * 
 * 提供生产订单的 CRUD 功能，包括列表展示、创建、编辑、删除、确认下发等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { orderApi } from '../../services/process';
import type { Order, OrderCreate, OrderUpdate } from '../../types/process';

/**
 * 生产订单管理列表页面组件
 */
const OrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentOrderUuid, setCurrentOrderUuid] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑订单）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建订单
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOrderUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      orderType: '计划订单',
      priority: '中',
      status: '草稿',
    });
  };

  /**
   * 处理编辑订单
   */
  const handleEdit = async (record: Order) => {
    try {
      setIsEdit(true);
      setCurrentOrderUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await orderApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        orderNo: detail.orderNo,
        orderType: detail.orderType,
        productId: detail.productId,
        productName: detail.productName,
        quantity: detail.quantity,
        plannedStartDate: detail.plannedStartDate,
        plannedEndDate: detail.plannedEndDate,
        routeId: detail.routeId,
        routeName: detail.routeName,
        priority: detail.priority,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取订单详情失败');
    }
  };

  /**
   * 处理删除订单
   */
  const handleDelete = async (record: Order) => {
    try {
      await orderApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Order) => {
    try {
      setCurrentOrderUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await orderApi.get(record.uuid);
      setOrderDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取订单详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理确认下发
   */
  const handleConfirm = async (record: Order) => {
    Modal.confirm({
      title: '确认下发',
      content: `确定要下发生产订单 ${record.orderNo} 到车间吗？`,
      onOk: async () => {
        try {
          await orderApi.confirm(record.uuid);
          messageApi.success('下发成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '下发失败');
        }
      },
    });
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: OrderCreate | OrderUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentOrderUuid) {
        await orderApi.update(currentOrderUuid, values as OrderUpdate);
        messageApi.success('更新成功');
      } else {
        await orderApi.create(values as OrderCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Order>[] = [
    {
      title: '订单编号',
      dataIndex: 'orderNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.orderNo}</a>
      ),
    },
    {
      title: '订单类型',
      dataIndex: 'orderType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '计划订单': { text: '计划订单' },
        '紧急订单': { text: '紧急订单' },
        '返工订单': { text: '返工订单' },
      },
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '计划数量',
      dataIndex: 'quantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '完成数量',
      dataIndex: 'completedQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已确认': { text: <Tag color="blue">已确认</Tag> },
        '已下发': { text: <Tag color="cyan">已下发</Tag> },
        '执行中': { text: <Tag color="purple">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
        '已取消': { text: <Tag color="red">已取消</Tag> },
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '高': { text: <Tag color="red">高</Tag> },
        '中': { text: <Tag color="orange">中</Tag> },
        '低': { text: <Tag color="default">低</Tag> },
      },
    },
    {
      title: '计划开始日期',
      dataIndex: 'plannedStartDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {record.status === '已确认' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleConfirm(record)}
            >
              确认下发
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条订单吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px', margin: 0, boxSizing: 'border-box' }}>
      <UniTable<Order>
        headerTitle="生产订单管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await orderApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length,
          };
        }}
        rowKey="uuid"
        search={{
          labelWidth: 'auto',
        }}
        toolBarRender={() => [
          <Button
            type="primary"
            key="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建订单
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑生产订单' : '新建生产订单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
            },
            submitButtonProps: {
              loading: formLoading,
            },
          }}
        >
          <ProFormText
            name="orderNo"
            label="订单编号"
            rules={[{ required: true, message: '请输入订单编号' }]}
            placeholder="请输入订单编号"
          />
          <ProFormSelect
            name="orderType"
            label="订单类型"
            options={[
              { label: '计划订单', value: '计划订单' },
              { label: '紧急订单', value: '紧急订单' },
              { label: '返工订单', value: '返工订单' },
            ]}
          />
          <ProFormText
            name="productId"
            label="产品ID"
            rules={[{ required: true, message: '请输入产品ID' }]}
            placeholder="请输入产品ID"
          />
          <ProFormText
            name="productName"
            label="产品名称"
            rules={[{ required: true, message: '请输入产品名称' }]}
            placeholder="请输入产品名称"
          />
          <ProFormText
            name="quantity"
            label="计划数量"
            rules={[{ required: true, message: '请输入计划数量' }]}
            placeholder="请输入计划数量"
          />
          <ProFormDatePicker
            name="plannedStartDate"
            label="计划开始日期"
            placeholder="请选择计划开始日期"
          />
          <ProFormDatePicker
            name="plannedEndDate"
            label="计划结束日期"
            placeholder="请选择计划结束日期"
          />
          <ProFormSelect
            name="priority"
            label="优先级"
            options={[
              { label: '高', value: '高' },
              { label: '中', value: '中' },
              { label: '低', value: '低' },
            ]}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="生产订单详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : orderDetail ? (
          <ProDescriptions<Order>
            column={1}
            dataSource={orderDetail}
            columns={[
              { title: '订单编号', dataIndex: 'orderNo' },
              { title: '订单类型', dataIndex: 'orderType' },
              { title: '产品ID', dataIndex: 'productId' },
              { title: '产品名称', dataIndex: 'productName' },
              { title: '计划数量', dataIndex: 'quantity', valueType: 'digit' },
              { title: '完成数量', dataIndex: 'completedQuantity', valueType: 'digit' },
              { title: '状态', dataIndex: 'status' },
              { title: '优先级', dataIndex: 'priority' },
              { title: '计划开始日期', dataIndex: 'plannedStartDate', valueType: 'dateTime' },
              { title: '计划结束日期', dataIndex: 'plannedEndDate', valueType: 'dateTime' },
              { title: '实际开始日期', dataIndex: 'actualStartDate', valueType: 'dateTime' },
              { title: '实际结束日期', dataIndex: 'actualEndDate', valueType: 'dateTime' },
              { title: '工艺路线', dataIndex: 'routeName' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default OrdersPage;
