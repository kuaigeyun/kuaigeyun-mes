/**
 * 委外订单管理页面
 * 
 * 提供委外订单的 CRUD 功能，包括列表展示、创建、编辑、删除、进度更新等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormInstance, ProDescriptions, ProFormDigit } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message, Progress } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { outsourcingOrderApi } from '../../services/process';
import type { OutsourcingOrder, OutsourcingOrderCreate, OutsourcingOrderUpdate } from '../../types/process';

/**
 * 委外订单管理列表页面组件
 */
const OutsourcingOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentOrderUuid, setCurrentOrderUuid] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<OutsourcingOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑订单）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  
  // 进度更新 Modal
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressValue, setProgressValue] = useState(0);

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
      progress: 0,
    });
  };

  /**
   * 处理编辑订单
   */
  const handleEdit = async (record: OutsourcingOrder) => {
    try {
      setIsEdit(true);
      setCurrentOrderUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await outsourcingOrderApi.get(record.uuid);
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
  const handleDelete = async (record: OutsourcingOrder) => {
    try {
      await outsourcingOrderApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: OutsourcingOrder) => {
    try {
      setCurrentOrderUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await outsourcingOrderApi.get(record.uuid);
      setOrderDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取订单详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理更新进度
   */
  const handleUpdateProgress = async (record: OutsourcingOrder) => {
    setCurrentOrderUuid(record.uuid);
    setProgressValue(record.progress);
    setProgressModalVisible(true);
  };

  /**
   * 提交进度更新
   */
  const handleSubmitProgress = async () => {
    if (!currentOrderUuid) return;
    
    try {
      await outsourcingOrderApi.updateProgress(currentOrderUuid, progressValue);
      messageApi.success('进度更新成功');
      setProgressModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '进度更新失败');
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: OutsourcingOrderCreate | OutsourcingOrderUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentOrderUuid) {
        await outsourcingOrderApi.update(currentOrderUuid, values as OutsourcingOrderUpdate);
        messageApi.success('更新成功');
      } else {
        await outsourcingOrderApi.create(values as OutsourcingOrderCreate);
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
  const columns: ProColumns<OutsourcingOrder>[] = [
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
        '部分完成': { text: <Tag color="purple">部分完成</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
        '已取消': { text: <Tag color="red">已取消</Tag> },
      },
    },
    {
      title: '完成进度',
      dataIndex: 'progress',
      width: 150,
      render: (progress) => (
        <Progress percent={progress} size="small" />
      ),
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
          {record.status === '执行中' && (
            <Button
              type="link"
              size="small"
              icon={<SyncOutlined />}
              onClick={() => handleUpdateProgress(record)}
            >
              更新进度
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
      <UniTable<OutsourcingOrder>
        headerTitle="委外订单管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await outsourcingOrderApi.list({
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
        title={isEdit ? '编辑委外订单' : '新建委外订单'}
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
            label="委外供应商ID"
            rules={[{ required: true, message: '请输入委外供应商ID' }]}
            placeholder="请输入委外供应商ID"
          />
          <ProFormText
            name="totalAmount"
            label="订单总金额"
            placeholder="请输入订单总金额"
          />
          <ProFormDatePicker
            name="deliveryDate"
            label="交期要求"
            placeholder="请选择交期要求"
          />
        </ProForm>
      </Modal>

      {/* 进度更新 Modal */}
      <Modal
        title="更新委外订单进度"
        open={progressModalVisible}
        onOk={handleSubmitProgress}
        onCancel={() => setProgressModalVisible(false)}
        okText="更新"
        cancelText="取消"
      >
        <ProFormDigit
          label="完成进度"
          value={progressValue}
          onChange={(value) => setProgressValue(value || 0)}
          min={0}
          max={100}
          fieldProps={{
            suffix: '%',
          }}
        />
        <Progress percent={progressValue} style={{ marginTop: 16 }} />
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="委外订单详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : orderDetail ? (
          <ProDescriptions<OutsourcingOrder>
            column={1}
            dataSource={orderDetail}
            columns={[
              { title: '订单编号', dataIndex: 'orderNo' },
              { title: '供应商ID', dataIndex: 'supplierId' },
              { title: '订单日期', dataIndex: 'orderDate', valueType: 'dateTime' },
              { title: '状态', dataIndex: 'status' },
              { title: '完成进度', dataIndex: 'progress', render: (progress) => `${progress}%` },
              { title: '订单金额', dataIndex: 'totalAmount', valueType: 'money' },
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

export default OutsourcingOrdersPage;
