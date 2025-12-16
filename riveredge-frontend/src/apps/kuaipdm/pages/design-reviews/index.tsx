/**
 * 设计评审管理页面
 * 
 * 提供设计评审的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormDatePicker, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni-table';
import { designReviewApi } from '../../services/process';
import type { DesignReview, DesignReviewCreate, DesignReviewUpdate } from '../../types/process';

/**
 * 设计评审管理列表页面组件
 */
const DesignReviewsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentReviewUuid, setCurrentReviewUuid] = useState<string | null>(null);
  const [reviewDetail, setReviewDetail] = useState<DesignReview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑评审）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建评审
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentReviewUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      status: '计划中',
    });
  };

  /**
   * 处理编辑评审
   */
  const handleEdit = async (record: DesignReview) => {
    try {
      setIsEdit(true);
      setCurrentReviewUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await designReviewApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        reviewNo: detail.reviewNo,
        reviewType: detail.reviewType,
        reviewStage: detail.reviewStage,
        productId: detail.productId,
        reviewDate: detail.reviewDate,
        reviewContent: detail.reviewContent,
        reviewers: detail.reviewers,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取评审详情失败');
    }
  };

  /**
   * 处理删除评审
   */
  const handleDelete = async (record: DesignReview) => {
    try {
      await designReviewApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: DesignReview) => {
    try {
      setCurrentReviewUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await designReviewApi.get(record.uuid);
      setReviewDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取评审详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: DesignReviewCreate | DesignReviewUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentReviewUuid) {
        await designReviewApi.update(currentReviewUuid, values as DesignReviewUpdate);
        messageApi.success('更新成功');
      } else {
        await designReviewApi.create(values as DesignReviewCreate);
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
  const columns: ProColumns<DesignReview>[] = [
    {
      title: '评审编号',
      dataIndex: 'reviewNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.reviewNo}</a>
      ),
    },
    {
      title: '评审类型',
      dataIndex: 'reviewType',
      width: 120,
    },
    {
      title: '评审阶段',
      dataIndex: 'reviewStage',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        '计划中': { text: <Tag color="blue">计划中</Tag> },
        '进行中': { text: <Tag color="orange">进行中</Tag> },
        '已完成': { text: <Tag color="green">已完成</Tag> },
        '已关闭': { text: <Tag color="default">已关闭</Tag> },
      },
    },
    {
      title: '评审结论',
      dataIndex: 'conclusion',
      width: 120,
      render: (conclusion) => {
        if (!conclusion) return '-';
        const conclusionMap: Record<string, { color: string; text: string }> = {
          '通过': { color: 'green', text: '通过' },
          '有条件通过': { color: 'orange', text: '有条件通过' },
          '不通过': { color: 'red', text: '不通过' },
        };
        const info = conclusionMap[conclusion] || { color: 'default', text: conclusion };
        return <Tag color={info.color}>{info.text}</Tag>;
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
            title="确定要删除这条评审吗？"
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
      <UniTable<DesignReview>
        headerTitle="设计评审管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await designReviewApi.list({
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
            新建评审
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑设计评审' : '新建设计评审'}
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
            name="reviewNo"
            label="评审编号"
            rules={[{ required: true, message: '请输入评审编号' }]}
            placeholder="请输入评审编号"
          />
          <ProFormSelect
            name="reviewType"
            label="评审类型"
            options={[
              { label: '概念评审', value: '概念评审' },
              { label: '设计评审', value: '设计评审' },
              { label: '样机评审', value: '样机评审' },
            ]}
            rules={[{ required: true, message: '请选择评审类型' }]}
          />
          <ProFormText
            name="reviewStage"
            label="评审阶段"
            placeholder="请输入评审阶段"
          />
          <ProFormDatePicker
            name="reviewDate"
            label="评审日期"
            placeholder="请选择评审日期"
          />
          <ProFormTextArea
            name="reviewContent"
            label="评审内容"
            placeholder="请输入评审内容"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="设计评审详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : reviewDetail ? (
          <ProDescriptions<DesignReview>
            column={1}
            dataSource={reviewDetail}
            columns={[
              { title: '评审编号', dataIndex: 'reviewNo' },
              { title: '评审类型', dataIndex: 'reviewType' },
              { title: '评审阶段', dataIndex: 'reviewStage' },
              { title: '评审日期', dataIndex: 'reviewDate', valueType: 'dateTime' },
              { title: '状态', dataIndex: 'status' },
              { title: '评审结论', dataIndex: 'conclusion' },
              { title: '评审内容', dataIndex: 'reviewContent' },
              { title: '评审结果', dataIndex: 'reviewResult' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default DesignReviewsPage;
