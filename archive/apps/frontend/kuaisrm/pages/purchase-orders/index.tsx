/**
 * 采购订单管理页面
 * 
 * 提供采购订单的 CRUD 功能，包括列表展示、创建、编辑、删除、审批等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { purchaseOrderApi } from '../../services/process';
import type { PurchaseOrder, PurchaseOrderCreate, PurchaseOrderUpdate } from '../../types/process';

/**
 * 采购订单管理列表页面组件
 */
const PurchaseOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentOrderUuid, setCurrentOrderUuid] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<PurchaseOrder | null>(null);
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
      currency: 'CNY',
      status: '草稿',
    });
  };

  /**
   * 处理编辑订单
   */
  const handleEdit = async (record: PurchaseOrder) => {
    try {
      setIsEdit(true);
      setCurrentOrderUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await purchaseOrderApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        orderNo: detail.orderNo,
        orderDate: detail.orderDate,
        supplierId: detail.supplierId,
        totalAmount: detail.totalAmount,
        currency: detail.currency,
        deliveryDate: detail.deliveryDate,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取订单详情失败');
    }
  };

  /**
   * 处理删除订单
   */
  const handleDelete = async (record: PurchaseOrder) => {
    try {
      await purchaseOrderApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: PurchaseOrder) => {
    try {
      setCurrentOrderUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await purchaseOrderApi.get(record.uuid);
      setOrderDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取订单详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交审批
   */
  const handleSubmitApproval = async (record: PurchaseOrder) => {
    Modal.confirm({
      title: '提交采购订单审批',
      content: '请输入审批流程代码',
      // TODO: 实现流程代码输入
      onOk: async () => {
        try {
          await purchaseOrderApi.submitApproval(record.uuid, 'purchase_order_approval');
          messageApi.success('提交审批成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '提交审批失败');
        }
      },
    });
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: PurchaseOrderCreate | PurchaseOrderUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentOrderUuid) {
        await purchaseOrderApi.update(currentOrderUuid, values as PurchaseOrderUpdate);
        messageApi.success('更新成功');
      } else {
        await purchaseOrderApi.create(values as PurchaseOrderCreate);
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
  const columns: ProColumns<PurchaseOrder>[] = [
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
      title: '供应商ID',
      dataIndex: 'supplierId',
      width: 100,
    },
    {
      title: '订单日期',
      dataIndex: 'orderDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '待审批': { text: <Tag color="orange">待审批</Tag> },
        '已审批': { text: <Tag color="blue">已审批</Tag> },
        '执行中': { text: <Tag color="cyan">执行中</Tag> },
        '部分到货': { text: <Tag color="purple">部分到货</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
        '已取消': { text: <Tag color="red">已取消</Tag> },
      },
    },
    {
      title: '审批状态',
      dataIndex: 'approvalStatus',
      width: 100,
      render: (status) => {
        if (!status) return '-';
        const statusMap: Record<string, { color: string; text: string }> = {
          pending: { color: 'orange', text: '审批中' },
          approved: { color: 'green', text: '已通过' },
          rejected: { color: 'red', text: '已拒绝' },
          cancelled: { color: 'default', text: '已取消' },
        };
        const statusInfo = statusMap[status] || { color: 'default', text: status };
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      },
    },
    {
      title: '订单金额',
      dataIndex: 'totalAmount',
      width: 120,
      valueType: 'money',
    },
    {
      title: '交期要求',
      dataIndex: 'deliveryDate',
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
          {!record.approvalInstanceId && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleSubmitApproval(record)}
            >
              提交审批
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
      <UniTable<PurchaseOrder>
        headerTitle="采购订单管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await purchaseOrderApi.list({
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
        title={isEdit ? '编辑采购订单' : '新建采购订单'}
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
          <ProFormDatePicker
            name="orderDate"
            label="订单日期"
            rules={[{ required: true, message: '请选择订单日期' }]}
          />
          <ProFormText
            name="supplierId"
            label="供应商ID"
            rules={[{ required: true, message: '请输入供应商ID' }]}
            placeholder="请输入供应商ID"
          />
          <ProFormText
            name="totalAmount"
            label="订单总金额"
            placeholder="请输入订单总金额"
          />
          <ProFormSelect
            name="currency"
            label="币种"
            options={[
              { label: 'CNY', value: 'CNY' },
              { label: 'USD', value: 'USD' },
              { label: 'EUR', value: 'EUR' },
            ]}
          />
          <ProFormDatePicker
            name="deliveryDate"
            label="交期要求"
            placeholder="请选择交期要求"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="采购订单详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : orderDetail ? (
          <ProDescriptions<PurchaseOrder>
            column={1}
            dataSource={orderDetail}
            columns={[
              { title: '订单编号', dataIndex: 'orderNo' },
              { title: '供应商ID', dataIndex: 'supplierId' },
              { title: '订单日期', dataIndex: 'orderDate', valueType: 'dateTime' },
              { title: '状态', dataIndex: 'status' },
              { title: '审批状态', dataIndex: 'approvalStatus' },
              { title: '订单金额', dataIndex: 'totalAmount', valueType: 'money' },
              { title: '币种', dataIndex: 'currency' },
              { title: '交期要求', dataIndex: 'deliveryDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default PurchaseOrdersPage;
