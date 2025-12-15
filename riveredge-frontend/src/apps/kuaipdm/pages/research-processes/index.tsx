/**
 * 研发流程管理页面
 * 
 * 提供研发流程的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { researchProcessApi } from '../../services/process';
import type { ResearchProcess, ResearchProcessCreate, ResearchProcessUpdate } from '../../types/process';

/**
 * 研发流程管理列表页面组件
 */
const ResearchProcessesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentProcessUuid, setCurrentProcessUuid] = useState<string | null>(null);
  const [processDetail, setProcessDetail] = useState<ResearchProcess | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑流程）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建流程
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentProcessUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '进行中',
    });
  };

  /**
   * 处理编辑流程
   */
  const handleEdit = async (record: ResearchProcess) => {
    try {
      setIsEdit(true);
      setCurrentProcessUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await researchProcessApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        processNo: detail.processNo,
        processName: detail.processName,
        processType: detail.processType,
        productId: detail.productId,
        projectId: detail.projectId,
        ownerId: detail.ownerId,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取流程详情失败');
    }
  };

  /**
   * 处理删除流程
   */
  const handleDelete = async (record: ResearchProcess) => {
    try {
      await researchProcessApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: ResearchProcess) => {
    try {
      setCurrentProcessUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await researchProcessApi.get(record.uuid);
      setProcessDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取流程详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: ResearchProcessCreate | ResearchProcessUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentProcessUuid) {
        await researchProcessApi.update(currentProcessUuid, values as ResearchProcessUpdate);
        messageApi.success('更新成功');
      } else {
        await researchProcessApi.create(values as ResearchProcessCreate);
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
  const columns: ProColumns<ResearchProcess>[] = [
    {
      title: '流程编号',
      dataIndex: 'processNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.processNo}</a>
      ),
    },
    {
      title: '流程名称',
      dataIndex: 'processName',
      width: 200,
    },
    {
      title: '流程类型',
      dataIndex: 'processType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        'IPD': { text: 'IPD' },
        'CMMI': { text: 'CMMI' },
        'APQP': { text: 'APQP' },
      },
    },
    {
      title: '当前阶段',
      dataIndex: 'currentStage',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '进行中': { text: <Tag color="blue">进行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已暂停': { text: <Tag color="orange">已暂停</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
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
            title="确定要删除这条流程吗？"
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
      <UniTable<ResearchProcess>
        headerTitle="研发流程管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await researchProcessApi.list({
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
            新建流程
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑研发流程' : '新建研发流程'}
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
            name="processNo"
            label="流程编号"
            rules={[{ required: true, message: '请输入流程编号' }]}
            placeholder="请输入流程编号"
          />
          <ProFormText
            name="processName"
            label="流程名称"
            rules={[{ required: true, message: '请输入流程名称' }]}
            placeholder="请输入流程名称"
          />
          <ProFormSelect
            name="processType"
            label="流程类型"
            options={[
              { label: 'IPD', value: 'IPD' },
              { label: 'CMMI', value: 'CMMI' },
              { label: 'APQP', value: 'APQP' },
            ]}
            rules={[{ required: true, message: '请选择流程类型' }]}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="研发流程详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : processDetail ? (
          <ProDescriptions<ResearchProcess>
            column={1}
            dataSource={processDetail}
            columns={[
              { title: '流程编号', dataIndex: 'processNo' },
              { title: '流程名称', dataIndex: 'processName' },
              { title: '流程类型', dataIndex: 'processType' },
              { title: '当前阶段', dataIndex: 'currentStage' },
              { title: '状态', dataIndex: 'status' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default ResearchProcessesPage;
