/**
 * 工程变更管理页面
 * 
 * 提供工程变更的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { engineeringChangeApi } from '../../services/process';
import type { EngineeringChange, EngineeringChangeCreate, EngineeringChangeUpdate } from '../../types/process';

/**
 * 工程变更管理列表页面组件
 */
const EngineeringChangesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentChangeUuid, setCurrentChangeUuid] = useState<string | null>(null);
  const [changeDetail, setChangeDetail] = useState<EngineeringChange | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑变更）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建变更
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentChangeUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      priority: '普通',
      status: '待审批',
    });
  };

  /**
   * 处理编辑变更
   */
  const handleEdit = async (record: EngineeringChange) => {
    try {
      setIsEdit(true);
      setCurrentChangeUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await engineeringChangeApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        changeNo: detail.changeNo,
        changeType: detail.changeType,
        changeReason: detail.changeReason,
        changeContent: detail.changeContent,
        changeImpact: detail.changeImpact,
        priority: detail.priority,
        productId: detail.productId,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取变更详情失败');
    }
  };

  /**
   * 处理删除变更
   */
  const handleDelete = async (record: EngineeringChange) => {
    try {
      await engineeringChangeApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: EngineeringChange) => {
    try {
      setCurrentChangeUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await engineeringChangeApi.get(record.uuid);
      setChangeDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取变更详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: EngineeringChangeCreate | EngineeringChangeUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentChangeUuid) {
        await engineeringChangeApi.update(currentChangeUuid, values as EngineeringChangeUpdate);
        messageApi.success('更新成功');
      } else {
        await engineeringChangeApi.create(values as EngineeringChangeCreate);
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
  const columns: ProColumns<EngineeringChange>[] = [
    {
      title: '变更编号',
      dataIndex: 'changeNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.changeNo}</a>
      ),
    },
    {
      title: '变更类型',
      dataIndex: 'changeType',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '待审批': { text: <Tag color="orange">待审批</Tag> },
        '审批中': { text: <Tag color="blue">审批中</Tag> },
        '已批准': { text: <Tag color="green">已批准</Tag> },
        '执行中': { text: <Tag color="cyan">执行中</Tag> },
        '已完成': { text: <Tag color="success">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 80,
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
            title="确定要删除这条变更吗？"
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
      <UniTable<EngineeringChange>
        headerTitle="工程变更管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await engineeringChangeApi.list({
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
            新建变更
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑工程变更' : '新建工程变更'}
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
            name="changeNo"
            label="变更编号"
            rules={[{ required: true, message: '请输入变更编号' }]}
            placeholder="请输入变更编号"
          />
          <ProFormSelect
            name="changeType"
            label="变更类型"
            options={[
              { label: '设计变更', value: '设计变更' },
              { label: '工艺变更', value: '工艺变更' },
              { label: '材料变更', value: '材料变更' },
            ]}
            rules={[{ required: true, message: '请选择变更类型' }]}
          />
          <ProFormTextArea
            name="changeReason"
            label="变更原因"
            rules={[{ required: true, message: '请输入变更原因' }]}
            placeholder="请输入变更原因"
          />
          <ProFormTextArea
            name="changeContent"
            label="变更内容"
            rules={[{ required: true, message: '请输入变更内容' }]}
            placeholder="请输入变更内容"
          />
          <ProFormTextArea
            name="changeImpact"
            label="变更影响分析"
            placeholder="请输入变更影响分析"
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
        title="工程变更详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : changeDetail ? (
          <ProDescriptions<EngineeringChange>
            column={1}
            dataSource={changeDetail}
            columns={[
              { title: '变更编号', dataIndex: 'changeNo' },
              { title: '变更类型', dataIndex: 'changeType' },
              { title: '变更原因', dataIndex: 'changeReason' },
              { title: '变更内容', dataIndex: 'changeContent' },
              { title: '变更影响分析', dataIndex: 'changeImpact' },
              { title: '优先级', dataIndex: 'priority' },
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

export default EngineeringChangesPage;
