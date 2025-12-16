/**
 * 资源调度管理页面
 * 
 * 提供资源调度的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions, ProFormDigit, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { resourceSchedulingApi } from '../../services/process';
import type { ResourceScheduling, ResourceSchedulingCreate, ResourceSchedulingUpdate } from '../../types/process';

/**
 * 资源调度管理列表页面组件
 */
const ResourceSchedulingsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSchedulingUuid, setCurrentSchedulingUuid] = useState<string | null>(null);
  const [schedulingDetail, setSchedulingDetail] = useState<ResourceScheduling | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑资源调度）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建资源调度
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentSchedulingUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      availabilityStatus: '可用',
      schedulingStatus: '待调度',
      status: '草稿',
    });
  };

  /**
   * 处理编辑资源调度
   */
  const handleEdit = async (record: ResourceScheduling) => {
    try {
      setIsEdit(true);
      setCurrentSchedulingUuid(record.uuid);
      setModalVisible(true);
      
      // 获取资源调度详情
      const detail = await resourceSchedulingApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        schedulingNo: detail.schedulingNo,
        schedulingName: detail.schedulingName,
        resourceType: detail.resourceType,
        resourceId: detail.resourceId,
        resourceName: detail.resourceName,
        planId: detail.planId,
        planUuid: detail.planUuid,
        planNo: detail.planNo,
        scheduledStartDate: detail.scheduledStartDate,
        scheduledEndDate: detail.scheduledEndDate,
        actualStartDate: detail.actualStartDate,
        actualEndDate: detail.actualEndDate,
        availabilityStatus: detail.availabilityStatus,
        schedulingStatus: detail.schedulingStatus,
        optimizationSuggestion: detail.optimizationSuggestion,
        status: detail.status,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取资源调度详情失败');
    }
  };

  /**
   * 处理删除资源调度
   */
  const handleDelete = async (record: ResourceScheduling) => {
    try {
      await resourceSchedulingApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ResourceScheduling) => {
    try {
      setCurrentSchedulingUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await resourceSchedulingApi.get(record.uuid);
      setSchedulingDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取资源调度详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ResourceSchedulingCreate | ResourceSchedulingUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentSchedulingUuid) {
        await resourceSchedulingApi.update(currentSchedulingUuid, values as ResourceSchedulingUpdate);
        messageApi.success('更新成功');
      } else {
        await resourceSchedulingApi.create(values as ResourceSchedulingCreate);
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
  const columns: ProColumns<ResourceScheduling>[] = [
    {
      title: '调度编号',
      dataIndex: 'schedulingNo',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.schedulingNo}</a>
      ),
    },
    {
      title: '调度名称',
      dataIndex: 'schedulingName',
      width: 200,
      ellipsis: true,
    },
    {
      title: '资源类型',
      dataIndex: 'resourceType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '设备': { text: '设备' },
        '人员': { text: '人员' },
        '物料': { text: '物料' },
        '工装夹具': { text: '工装夹具' },
        '模具': { text: '模具' },
      },
    },
    {
      title: '资源名称',
      dataIndex: 'resourceName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '计划编号',
      dataIndex: 'planNo',
      width: 150,
      ellipsis: true,
    },
    {
      title: '调度开始日期',
      dataIndex: 'scheduledStartDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '调度结束日期',
      dataIndex: 'scheduledEndDate',
      width: 150,
      valueType: 'dateTime',
    },
    {
      title: '可用性状态',
      dataIndex: 'availabilityStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '可用': { text: <Tag color="green">可用</Tag> },
        '不可用': { text: <Tag color="red">不可用</Tag> },
        '部分可用': { text: <Tag color="orange">部分可用</Tag> },
      },
    },
    {
      title: '调度状态',
      dataIndex: 'schedulingStatus',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '待调度': { text: <Tag color="default">待调度</Tag> },
        '已调度': { text: <Tag color="blue">已调度</Tag> },
        '执行中': { text: <Tag color="processing">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '草稿': { text: <Tag color="default">草稿</Tag> },
        '执行中': { text: <Tag color="processing">执行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
      },
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
            title="确定要删除这条资源调度吗？"
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
      <UniTable<ResourceScheduling>
        headerTitle="资源调度管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await resourceSchedulingApi.list({
            skip,
            limit: pageSize,
            ...rest,
          });
          return {
            data,
            success: true,
            total: data.length, // TODO: 后端需要返回总数
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
            新建资源调度
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑资源调度' : '新建资源调度'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
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
            name="schedulingNo"
            label="调度编号"
            rules={[{ required: true, message: '请输入调度编号' }]}
            placeholder="请输入调度编号"
            disabled={isEdit}
          />
          <ProFormText
            name="schedulingName"
            label="调度名称"
            rules={[{ required: true, message: '请输入调度名称' }]}
            placeholder="请输入调度名称"
          />
          <ProFormSelect
            name="resourceType"
            label="资源类型"
            options={[
              { label: '设备', value: '设备' },
              { label: '人员', value: '人员' },
              { label: '物料', value: '物料' },
              { label: '工装夹具', value: '工装夹具' },
              { label: '模具', value: '模具' },
            ]}
            rules={[{ required: true, message: '请选择资源类型' }]}
          />
          <ProFormDigit
            name="resourceId"
            label="资源ID"
            placeholder="请输入资源ID"
          />
          <ProFormText
            name="resourceName"
            label="资源名称"
            placeholder="请输入资源名称"
          />
          <ProFormDigit
            name="planId"
            label="计划ID"
            placeholder="请输入计划ID"
          />
          <ProFormText
            name="planUuid"
            label="计划UUID"
            placeholder="请输入计划UUID"
          />
          <ProFormText
            name="planNo"
            label="计划编号"
            placeholder="请输入计划编号"
          />
          <ProFormDatePicker
            name="scheduledStartDate"
            label="调度开始日期"
            placeholder="请选择调度开始日期"
          />
          <ProFormDatePicker
            name="scheduledEndDate"
            label="调度结束日期"
            placeholder="请选择调度结束日期"
          />
          <ProFormDatePicker
            name="actualStartDate"
            label="实际开始日期"
            placeholder="请选择实际开始日期"
          />
          <ProFormDatePicker
            name="actualEndDate"
            label="实际结束日期"
            placeholder="请选择实际结束日期"
          />
          <ProFormSelect
            name="availabilityStatus"
            label="可用性状态"
            options={[
              { label: '可用', value: '可用' },
              { label: '不可用', value: '不可用' },
              { label: '部分可用', value: '部分可用' },
            ]}
            initialValue="可用"
          />
          <ProFormSelect
            name="schedulingStatus"
            label="调度状态"
            options={[
              { label: '待调度', value: '待调度' },
              { label: '已调度', value: '已调度' },
              { label: '执行中', value: '执行中' },
              { label: '已完成', value: '已完成' },
            ]}
            initialValue="待调度"
          />
          <ProFormTextArea
            name="optimizationSuggestion"
            label="优化建议"
            placeholder="请输入优化建议"
          />
          <ProFormSelect
            name="status"
            label="状态"
            options={[
              { label: '草稿', value: '草稿' },
              { label: '执行中', value: '执行中' },
              { label: '已完成', value: '已完成' },
            ]}
            initialValue="草稿"
          />
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="请输入备注信息"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="资源调度详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : schedulingDetail ? (
          <ProDescriptions<ResourceScheduling>
            column={1}
            dataSource={schedulingDetail}
            columns={[
              { title: '调度编号', dataIndex: 'schedulingNo' },
              { title: '调度名称', dataIndex: 'schedulingName' },
              { title: '资源类型', dataIndex: 'resourceType' },
              { title: '资源ID', dataIndex: 'resourceId' },
              { title: '资源名称', dataIndex: 'resourceName' },
              { title: '计划ID', dataIndex: 'planId' },
              { title: '计划UUID', dataIndex: 'planUuid' },
              { title: '计划编号', dataIndex: 'planNo' },
              { title: '调度开始日期', dataIndex: 'scheduledStartDate', valueType: 'dateTime' },
              { title: '调度结束日期', dataIndex: 'scheduledEndDate', valueType: 'dateTime' },
              { title: '实际开始日期', dataIndex: 'actualStartDate', valueType: 'dateTime' },
              { title: '实际结束日期', dataIndex: 'actualEndDate', valueType: 'dateTime' },
              { title: '可用性状态', dataIndex: 'availabilityStatus' },
              { title: '调度状态', dataIndex: 'schedulingStatus' },
              { title: '优化建议', dataIndex: 'optimizationSuggestion' },
              { title: '状态', dataIndex: 'status' },
              { title: '备注', dataIndex: 'remark' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default ResourceSchedulingsPage;

