/**
 * 质量检验任务管理页面
 * 
 * 提供质量检验任务的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { inspectionTaskApi } from '../../services/process';
import type { InspectionTask, InspectionTaskCreate, InspectionTaskUpdate } from '../../types/process';

/**
 * 质量检验任务管理列表页面组件
 */
const InspectionTasksPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentTaskUuid, setCurrentTaskUuid] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<InspectionTask | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑任务）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建任务
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentTaskUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      priority: '中',
      status: '待检验',
    });
  };

  /**
   * 处理编辑任务
   */
  const handleEdit = async (record: InspectionTask) => {
    try {
      setIsEdit(true);
      setCurrentTaskUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await inspectionTaskApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        taskNo: detail.taskNo,
        inspectionType: detail.inspectionType,
        materialId: detail.materialId,
        materialName: detail.materialName,
        quantity: detail.quantity,
        inspectorId: detail.inspectorId,
        inspectorName: detail.inspectorName,
        plannedInspectionDate: detail.plannedInspectionDate,
        priority: detail.priority,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取任务详情失败');
    }
  };

  /**
   * 处理删除任务
   */
  const handleDelete = async (record: InspectionTask) => {
    try {
      await inspectionTaskApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: InspectionTask) => {
    try {
      setCurrentTaskUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await inspectionTaskApi.get(record.uuid);
      setTaskDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取任务详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: InspectionTaskCreate | InspectionTaskUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentTaskUuid) {
        await inspectionTaskApi.update(currentTaskUuid, values as InspectionTaskUpdate);
        messageApi.success('更新成功');
      } else {
        await inspectionTaskApi.create(values as InspectionTaskCreate);
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
  const columns: ProColumns<InspectionTask>[] = [
    {
      title: '任务编号',
      dataIndex: 'taskNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.taskNo}</a>
      ),
    },
    {
      title: '检验类型',
      dataIndex: 'inspectionType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '来料检验': { text: <Tag color="blue">来料检验</Tag> },
        '过程检验': { text: <Tag color="green">过程检验</Tag> },
        '成品检验': { text: <Tag color="purple">成品检验</Tag> },
        '委外来料检验': { text: <Tag color="orange">委外来料检验</Tag> },
      },
    },
    {
      title: '物料名称',
      dataIndex: 'materialName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '检验数量',
      dataIndex: 'quantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '检验员',
      dataIndex: 'inspectorName',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待检验': { text: <Tag color="default">待检验</Tag> },
        '检验中': { text: <Tag color="processing">检验中</Tag> },
        '已完成': { text: <Tag color="success">已完成</Tag> },
        '已取消': { text: <Tag color="error">已取消</Tag> },
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
      title: '计划检验日期',
      dataIndex: 'plannedInspectionDate',
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
            title="确定要删除这条任务吗？"
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
      <UniTable<InspectionTask>
        headerTitle="质量检验任务管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await inspectionTaskApi.list({
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
            新建任务
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑质量检验任务' : '新建质量检验任务'}
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
            name="taskNo"
            label="任务编号"
            rules={[{ required: true, message: '请输入任务编号' }]}
            placeholder="请输入任务编号"
          />
          <ProFormSelect
            name="inspectionType"
            label="检验类型"
            rules={[{ required: true, message: '请选择检验类型' }]}
            options={[
              { label: '来料检验', value: '来料检验' },
              { label: '过程检验', value: '过程检验' },
              { label: '成品检验', value: '成品检验' },
              { label: '委外来料检验', value: '委外来料检验' },
            ]}
          />
          <ProFormText
            name="materialId"
            label="物料ID"
            rules={[{ required: true, message: '请输入物料ID' }]}
            placeholder="请输入物料ID"
          />
          <ProFormText
            name="materialName"
            label="物料名称"
            rules={[{ required: true, message: '请输入物料名称' }]}
            placeholder="请输入物料名称"
          />
          <ProFormText
            name="quantity"
            label="检验数量"
            rules={[{ required: true, message: '请输入检验数量' }]}
            placeholder="请输入检验数量"
          />
          <ProFormDatePicker
            name="plannedInspectionDate"
            label="计划检验日期"
            placeholder="请选择计划检验日期"
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
        title="质量检验任务详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : taskDetail ? (
          <ProDescriptions<InspectionTask>
            column={1}
            dataSource={taskDetail}
            columns={[
              { title: '任务编号', dataIndex: 'taskNo' },
              { title: '检验类型', dataIndex: 'inspectionType' },
              { title: '物料名称', dataIndex: 'materialName' },
              { title: '检验数量', dataIndex: 'quantity', valueType: 'digit' },
              { title: '检验员', dataIndex: 'inspectorName' },
              { title: '状态', dataIndex: 'status' },
              { title: '优先级', dataIndex: 'priority' },
              { title: '计划检验日期', dataIndex: 'plannedInspectionDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default InspectionTasksPage;
