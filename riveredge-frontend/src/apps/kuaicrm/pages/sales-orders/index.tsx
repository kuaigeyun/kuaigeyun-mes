/**
 * 销售订单管理页面
 * 
 * 提供订单的 CRUD 功能，包括列表展示、创建、编辑、删除、审批等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormDigit, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message, Input } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { salesOrderApi } from '../../services/process';
import type { SalesOrder, SalesOrderCreate, SalesOrderUpdate, ApprovalStatus } from '../../types/process';

/**
 * 销售订单管理列表页面组件
 */
const SalesOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentOrderUuid, setCurrentOrderUuid] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<SalesOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑订单）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  // 审批相关状态
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [approvalStatusVisible, setApprovalStatusVisible] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | null>(null);
  const [approvalStatusLoading, setApprovalStatusLoading] = useState(false);

  /**
   * 处理新建订单
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentOrderUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '待审批',
      priority: '普通',
      orderDate: new Date().toISOString(),
    });
  };

  /**
   * 处理编辑订单
   */
  const handleEdit = async (record: SalesOrder) => {
    try {
      setIsEdit(true);
      setCurrentOrderUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await salesOrderApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        orderNo: detail.orderNo,
        orderDate: detail.orderDate,
        customerId: detail.customerId,
        opportunityId: detail.opportunityId,
        status: detail.status,
        totalAmount: detail.totalAmount,
        deliveryDate: detail.deliveryDate,
        priority: detail.priority,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取订单详情失败');
    }
  };

  /**
   * 处理删除订单
   */
  const handleDelete = async (record: SalesOrder) => {
    try {
      await salesOrderApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: SalesOrder) => {
    try {
      setCurrentOrderUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await salesOrderApi.get(record.uuid);
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
  const handleSubmitApproval = async (record: SalesOrder) => {
    setApprovalModalVisible(true);
  };

  /**
   * 确认提交审批
   */
  const handleConfirmSubmitApproval = async (processCode: string) => {
    if (!currentOrderUuid) return;
    
    try {
      await salesOrderApi.submitApproval(currentOrderUuid, processCode);
      messageApi.success('提交审批成功');
      setApprovalModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '提交审批失败');
    }
  };

  /**
   * 处理查看审批状态
   */
  const handleViewApprovalStatus = async (record: SalesOrder) => {
    try {
      setApprovalStatusVisible(true);
      setApprovalStatusLoading(true);
      
      const status = await salesOrderApi.getApprovalStatus(record.uuid);
      setApprovalStatus(status);
    } catch (error: any) {
      messageApi.error(error.message || '获取审批状态失败');
    } finally {
      setApprovalStatusLoading(false);
    }
  };

  /**
   * 处理取消审批
   */
  const handleCancelApproval = async (record: SalesOrder) => {
    Modal.confirm({
      title: '取消审批',
      content: '确定要取消此订单的审批吗？',
      onOk: async () => {
        try {
          await salesOrderApi.cancelApproval(record.uuid);
          messageApi.success('取消审批成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '取消审批失败');
        }
      },
    });
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: SalesOrderCreate | SalesOrderUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentOrderUuid) {
        await salesOrderApi.update(currentOrderUuid, values as SalesOrderUpdate);
        messageApi.success('更新成功');
      } else {
        await salesOrderApi.create(values as SalesOrderCreate);
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
  const columns: ProColumns<SalesOrder>[] = [
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
      title: '订单日期',
      dataIndex: 'orderDate',
      width: 120,
      valueType: 'date',
    },
    {
      title: '客户ID',
      dataIndex: 'customerId',
      width: 100,
    },
    {
      title: '订单金额',
      dataIndex: 'totalAmount',
      width: 120,
      sorter: true,
      render: (amount) => `¥${amount?.toLocaleString() || 0}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待审批': { text: <Tag color="orange">待审批</Tag> },
        '已审批': { text: <Tag color="green">已审批</Tag> },
        '生产中': { text: <Tag color="blue">生产中</Tag> },
        '已交付': { text: <Tag color="success">已交付</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
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
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
      valueType: 'select',
      valueEnum: {
        '普通': { text: '普通' },
        '紧急': { text: <Tag color="orange">紧急</Tag> },
        '加急': { text: <Tag color="red">加急</Tag> },
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {!record.approvalInstanceId && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setCurrentOrderUuid(record.uuid);
                handleSubmitApproval(record);
              }}
            >
              提交审批
            </Button>
          )}
          {record.approvalInstanceId && (
            <>
              <Button
                type="link"
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => {
                  setCurrentOrderUuid(record.uuid);
                  handleViewApprovalStatus(record);
                }}
              >
                审批状态
              </Button>
              {record.approvalStatus === 'pending' && (
                <Button
                  type="link"
                  size="small"
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleCancelApproval(record)}
                >
                  取消审批
                </Button>
              )}
            </>
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
      <UniTable<SalesOrder>
        headerTitle="销售订单管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await salesOrderApi.list({
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
        title={isEdit ? '编辑订单' : '新建订单'}
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
          <ProFormDigit
            name="customerId"
            label="客户ID"
            rules={[{ required: true, message: '请输入客户ID' }]}
            placeholder="请输入客户ID"
          />
          <ProFormDigit
            name="totalAmount"
            label="订单金额"
            rules={[{ required: true, message: '请输入订单金额' }]}
            placeholder="请输入订单金额"
            fieldProps={{
              prefix: '¥',
              precision: 2,
            }}
          />
          <ProFormDatePicker
            name="deliveryDate"
            label="交期要求"
            placeholder="请选择交期要求"
          />
          <ProFormSelect
            name="priority"
            label="优先级"
            options={[
              { label: '普通', value: '普通' },
              { label: '紧急', value: '紧急' },
              { label: '加急', value: '加急' },
            ]}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="订单详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : orderDetail ? (
          <ProDescriptions<SalesOrder>
            column={1}
            dataSource={orderDetail}
            columns={[
              { title: '订单编号', dataIndex: 'orderNo' },
              { title: '订单日期', dataIndex: 'orderDate', valueType: 'dateTime' },
              { title: '客户ID', dataIndex: 'customerId' },
              { title: '订单金额', dataIndex: 'totalAmount', render: (amount) => `¥${amount?.toLocaleString() || 0}` },
              { title: '状态', dataIndex: 'status' },
              { title: '审批状态', dataIndex: 'approvalStatus' },
              { title: '交期要求', dataIndex: 'deliveryDate', valueType: 'dateTime' },
              { title: '优先级', dataIndex: 'priority' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>

      {/* 提交审批 Modal */}
      <Modal
        title="提交订单审批"
        open={approvalModalVisible}
        onOk={() => {
          const processCode = (document.getElementById('processCode') as HTMLInputElement)?.value;
          if (!processCode) {
            messageApi.warning('请输入审批流程代码');
            return;
          }
          handleConfirmSubmitApproval(processCode);
        }}
        onCancel={() => setApprovalModalVisible(false)}
      >
        <Input
          id="processCode"
          placeholder="请输入审批流程代码（如：sales_order_approval）"
        />
      </Modal>

      {/* 审批状态 Drawer */}
      <Drawer
        title="审批状态"
        open={approvalStatusVisible}
        onClose={() => setApprovalStatusVisible(false)}
        width={600}
      >
        {approvalStatusLoading ? (
          <div>加载中...</div>
        ) : approvalStatus && approvalStatus.hasApproval ? (
          <div>
            <ProDescriptions
              column={1}
              dataSource={approvalStatus.approvalInstance}
              columns={[
                { title: '审批标题', dataIndex: 'title' },
                { title: '审批状态', dataIndex: 'status' },
                { title: '当前节点', dataIndex: 'currentNode' },
                { title: '提交时间', dataIndex: 'submittedAt', valueType: 'dateTime' },
                { title: '完成时间', dataIndex: 'completedAt', valueType: 'dateTime' },
              ]}
            />
            {approvalStatus.histories && approvalStatus.histories.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4>审批历史</h4>
                {approvalStatus.histories.map((history, index) => (
                  <div key={index} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5' }}>
                    <div>操作：{history.action}</div>
                    <div>时间：{history.action_at}</div>
                    {history.comment && <div>备注：{history.comment}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>暂无审批信息</div>
        )}
      </Drawer>
    </div>
  );
};

export default SalesOrdersPage;
