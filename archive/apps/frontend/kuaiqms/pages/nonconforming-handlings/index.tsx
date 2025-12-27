/**
 * 不合格品处理管理页面
 * 
 * 提供不合格品处理的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { nonconformingHandlingApi } from '../../services/process';
import type { NonconformingHandling, NonconformingHandlingCreate, NonconformingHandlingUpdate } from '../../types/process';

/**
 * 不合格品处理管理列表页面组件
 */
const NonconformingHandlingsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentHandlingUuid, setCurrentHandlingUuid] = useState<string | null>(null);
  const [handlingDetail, setHandlingDetail] = useState<NonconformingHandling | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑处理）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建处理
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentHandlingUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '待处理',
    });
  };

  /**
   * 处理编辑处理
   */
  const handleEdit = async (record: NonconformingHandling) => {
    try {
      setIsEdit(true);
      setCurrentHandlingUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await nonconformingHandlingApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        handlingNo: detail.handlingNo,
        handlingType: detail.handlingType,
        handlingPlan: detail.handlingPlan,
        handlingExecutorName: detail.handlingExecutorName,
        handlingDate: detail.handlingDate,
        handlingResult: detail.handlingResult,
        handlingQuantity: detail.handlingQuantity,
        remark: detail.remark,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取处理详情失败');
    }
  };

  /**
   * 处理删除处理
   */
  const handleDelete = async (record: NonconformingHandling) => {
    try {
      await nonconformingHandlingApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: NonconformingHandling) => {
    try {
      setCurrentHandlingUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await nonconformingHandlingApi.get(record.uuid);
      setHandlingDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取处理详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: NonconformingHandlingCreate | NonconformingHandlingUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentHandlingUuid) {
        await nonconformingHandlingApi.update(currentHandlingUuid, values as NonconformingHandlingUpdate);
        messageApi.success('更新成功');
      } else {
        await nonconformingHandlingApi.create(values as NonconformingHandlingCreate);
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
  const columns: ProColumns<NonconformingHandling>[] = [
    {
      title: '处理单编号',
      dataIndex: 'handlingNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.handlingNo}</a>
      ),
    },
    {
      title: '处理类型',
      dataIndex: 'handlingType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '返工': { text: <Tag color="orange">返工</Tag> },
        '返修': { text: <Tag color="red">返修</Tag> },
        '报废': { text: <Tag color="default">报废</Tag> },
        '让步接收': { text: <Tag color="warning">让步接收</Tag> },
      },
    },
    {
      title: '处理执行人',
      dataIndex: 'handlingExecutorName',
      width: 120,
    },
    {
      title: '处理结果',
      dataIndex: 'handlingResult',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '成功': { text: <Tag color="success">成功</Tag> },
        '失败': { text: <Tag color="error">失败</Tag> },
        '部分成功': { text: <Tag color="warning">部分成功</Tag> },
      },
    },
    {
      title: '处理数量',
      dataIndex: 'handlingQuantity',
      width: 120,
      valueType: 'digit',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待处理': { text: <Tag color="default">待处理</Tag> },
        '处理中': { text: <Tag color="processing">处理中</Tag> },
        '已完成': { text: <Tag color="success">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '处理日期',
      dataIndex: 'handlingDate',
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
            title="确定要删除这条处理吗？"
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
      <UniTable<NonconformingHandling>
        headerTitle="不合格品处理管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await nonconformingHandlingApi.list({
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
            新建处理
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑不合格品处理' : '新建不合格品处理'}
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
            name="handlingNo"
            label="处理单编号"
            rules={[{ required: true, message: '请输入处理单编号' }]}
            placeholder="请输入处理单编号"
          />
          <ProFormSelect
            name="handlingType"
            label="处理类型"
            rules={[{ required: true, message: '请选择处理类型' }]}
            options={[
              { label: '返工', value: '返工' },
              { label: '返修', value: '返修' },
              { label: '报废', value: '报废' },
              { label: '让步接收', value: '让步接收' },
            ]}
          />
          <ProFormTextArea
            name="handlingPlan"
            label="处理方案"
            rules={[{ required: true, message: '请输入处理方案' }]}
            placeholder="请输入处理方案"
          />
          <ProFormText
            name="handlingExecutorName"
            label="处理执行人"
            placeholder="请输入处理执行人"
          />
          <ProFormDatePicker
            name="handlingDate"
            label="处理日期"
            placeholder="请选择处理日期"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="不合格品处理详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : handlingDetail ? (
          <ProDescriptions<NonconformingHandling>
            column={1}
            dataSource={handlingDetail}
            columns={[
              { title: '处理单编号', dataIndex: 'handlingNo' },
              { title: '处理类型', dataIndex: 'handlingType' },
              { title: '处理方案', dataIndex: 'handlingPlan' },
              { title: '处理执行人', dataIndex: 'handlingExecutorName' },
              { title: '处理结果', dataIndex: 'handlingResult' },
              { title: '处理数量', dataIndex: 'handlingQuantity', valueType: 'digit' },
              { title: '状态', dataIndex: 'status' },
              { title: '处理日期', dataIndex: 'handlingDate', valueType: 'dateTime' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default NonconformingHandlingsPage;
