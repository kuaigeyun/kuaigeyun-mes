/**
 * 工单管理页面
 * 
 * 提供工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { workOrderApi } from '../../services/process';
import type { WorkOrder, WorkOrderCreate, WorkOrderUpdate } from '../../types/process';

/**
 * 工单管理列表页面组件
 */
const WorkOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentWorkOrderUuid, setCurrentWorkOrderUuid] = useState<string | null>(null);
  const [workOrderDetail, setWorkOrderDetail] = useState<WorkOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑工单）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建工单
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentWorkOrderUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '草稿',
    });
  };

  /**
   * 处理编辑工单
   */
  const handleEdit = async (record: WorkOrder) => {
    try {
      setIsEdit(true);
      setCurrentWorkOrderUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await workOrderApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        workOrderNo: detail.workOrderNo,
        productId: detail.productId,
        productName: detail.productName,
        quantity: detail.quantity,
        plannedStartDate: detail.plannedStartDate,
        plannedEndDate: detail.plannedEndDate,
        workCenterId: detail.workCenterId,
        workCenterName: detail.workCenterName,
        operatorId: detail.operatorId,
        operatorName: detail.operatorName,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取工单详情失败');
    }
  };

  /**
   * 处理删除工单
   */
  const handleDelete = async (record: WorkOrder) => {
    try {
      await workOrderApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: WorkOrder) => {
    try {
      setCurrentWorkOrderUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await workOrderApi.get(record.uuid);
      setWorkOrderDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取工单详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: WorkOrderCreate | WorkOrderUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentWorkOrderUuid) {
        await workOrderApi.update(currentWorkOrderUuid, values as WorkOrderUpdate);
        messageApi.success('更新成功');
      } else {
        await workOrderApi.create(values as WorkOrderCreate);
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
  const columns: ProColumns<WorkOrder>[] = [
    {
      title: '工单编号',
      dataIndex: 'workOrderNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.workOrderNo}</a>
      ),
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
      title: '不良品数量',
      dataIndex: 'defectiveQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '当前工序',
      dataIndex: 'currentOperation',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '已下发': { text: <Tag color="cyan">已下发</Tag> },
        '执行中': { text: <Tag color="purple">执行中</Tag> },
        '暂停': { text: <Tag color="orange">暂停</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
        '已取消': { text: <Tag color="red">已取消</Tag> },
      },
    },
    {
      title: '工作中心',
      dataIndex: 'workCenterName',
      width: 150,
    },
    {
      title: '操作员',
      dataIndex: 'operatorName',
      width: 100,
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
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条工单吗？"
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
      <UniTable<WorkOrder>
        headerTitle="工单管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await workOrderApi.list({
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
            新建工单
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑工单' : '新建工单'}
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
            name="workOrderNo"
            label="工单编号"
            rules={[{ required: true, message: '请输入工单编号' }]}
            placeholder="请输入工单编号"
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
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="工单详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : workOrderDetail ? (
          <ProDescriptions<WorkOrder>
            column={1}
            dataSource={workOrderDetail}
            columns={[
              { title: '工单编号', dataIndex: 'workOrderNo' },
              { title: '产品名称', dataIndex: 'productName' },
              { title: '计划数量', dataIndex: 'quantity', valueType: 'digit' },
              { title: '完成数量', dataIndex: 'completedQuantity', valueType: 'digit' },
              { title: '不良品数量', dataIndex: 'defectiveQuantity', valueType: 'digit' },
              { title: '当前工序', dataIndex: 'currentOperation' },
              { title: '状态', dataIndex: 'status' },
              { title: '工作中心', dataIndex: 'workCenterName' },
              { title: '操作员', dataIndex: 'operatorName' },
              { title: '计划开始日期', dataIndex: 'plannedStartDate', valueType: 'dateTime' },
              { title: '计划结束日期', dataIndex: 'plannedEndDate', valueType: 'dateTime' },
              { title: '实际开始日期', dataIndex: 'actualStartDate', valueType: 'dateTime' },
              { title: '实际结束日期', dataIndex: 'actualEndDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default WorkOrdersPage;
