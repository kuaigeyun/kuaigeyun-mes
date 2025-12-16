/**
 * 设计变更管理页面
 * 
 * 提供设计变更的 CRUD 功能，包括列表展示、创建、编辑、删除、审批等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { designChangeApi } from '../../services/process';
import type { DesignChange, DesignChangeCreate, DesignChangeUpdate } from '../../types/process';

/**
 * 设计变更管理列表页面组件
 */
const DesignChangesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentChangeUuid, setCurrentChangeUuid] = useState<string | null>(null);
  const [changeDetail, setChangeDetail] = useState<DesignChange | null>(null);
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
  const handleEdit = async (record: DesignChange) => {
    try {
      setIsEdit(true);
      setCurrentChangeUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await designChangeApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        changeNo: detail.changeNo,
        changeType: detail.changeType,
        changeReason: detail.changeReason,
        changeContent: detail.changeContent,
        changeScope: detail.changeScope,
        priority: detail.priority,
        productId: detail.productId,
        bomId: detail.bomId,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取变更详情失败');
    }
  };

  /**
   * 处理删除变更
   */
  const handleDelete = async (record: DesignChange) => {
    try {
      await designChangeApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: DesignChange) => {
    try {
      setCurrentChangeUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await designChangeApi.get(record.uuid);
      setChangeDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取变更详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交审批
   */
  const handleSubmitApproval = async (record: DesignChange) => {
    Modal.confirm({
      title: '提交设计变更审批',
      content: '请输入审批流程代码',
      // TODO: 实现流程代码输入
      onOk: async () => {
        try {
          await designChangeApi.submitApproval(record.uuid, 'design_change_approval');
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
  const handleSubmit = async (values: DesignChangeCreate | DesignChangeUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentChangeUuid) {
        await designChangeApi.update(currentChangeUuid, values as DesignChangeUpdate);
        messageApi.success('更新成功');
      } else {
        await designChangeApi.create(values as DesignChangeCreate);
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
  const columns: ProColumns<DesignChange>[] = [
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
      valueType: 'select',
      valueEnum: {
        '设计变更': { text: '设计变更' },
        '工艺变更': { text: '工艺变更' },
        '材料变更': { text: '材料变更' },
      },
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
      <UniTable<DesignChange>
        headerTitle="设计变更管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await designChangeApi.list({
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
        title={isEdit ? '编辑设计变更' : '新建设计变更'}
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
            name="changeScope"
            label="变更影响范围"
            placeholder="请输入变更影响范围"
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
        title="设计变更详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : changeDetail ? (
          <ProDescriptions<DesignChange>
            column={1}
            dataSource={changeDetail}
            columns={[
              { title: '变更编号', dataIndex: 'changeNo' },
              { title: '变更类型', dataIndex: 'changeType' },
              { title: '变更原因', dataIndex: 'changeReason' },
              { title: '变更内容', dataIndex: 'changeContent' },
              { title: '变更影响范围', dataIndex: 'changeScope' },
              { title: '优先级', dataIndex: 'priority' },
              { title: '状态', dataIndex: 'status' },
              { title: '审批状态', dataIndex: 'approvalStatus' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default DesignChangesPage;
