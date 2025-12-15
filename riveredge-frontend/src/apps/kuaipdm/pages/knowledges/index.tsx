/**
 * 知识管理页面
 * 
 * 提供知识管理的 CRUD 功能，包括列表展示、创建、编辑、删除、点赞等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, LikeOutlined } from '@ant-design/icons';
import { UniTable } from '@/components/uni_table';
import { knowledgeApi } from '../../services/process';
import type { Knowledge, KnowledgeCreate, KnowledgeUpdate } from '../../types/process';

/**
 * 知识管理列表页面组件
 */
const KnowledgesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentKnowledgeUuid, setCurrentKnowledgeUuid] = useState<string | null>(null);
  const [knowledgeDetail, setKnowledgeDetail] = useState<Knowledge | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑知识）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建知识
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentKnowledgeUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isPublic: false,
    });
  };

  /**
   * 处理编辑知识
   */
  const handleEdit = async (record: Knowledge) => {
    try {
      setIsEdit(true);
      setCurrentKnowledgeUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await knowledgeApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        knowledgeNo: detail.knowledgeNo,
        knowledgeType: detail.knowledgeType,
        title: detail.title,
        content: detail.content,
        category: detail.category,
        tags: detail.tags,
        isPublic: detail.isPublic,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取知识详情失败');
    }
  };

  /**
   * 处理删除知识
   */
  const handleDelete = async (record: Knowledge) => {
    try {
      await knowledgeApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Knowledge) => {
    try {
      setCurrentKnowledgeUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await knowledgeApi.get(record.uuid);
      setKnowledgeDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取知识详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理点赞知识
   */
  const handleLike = async (record: Knowledge) => {
    try {
      await knowledgeApi.like(record.uuid);
      messageApi.success('点赞成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '点赞失败');
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: KnowledgeCreate | KnowledgeUpdate) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentKnowledgeUuid) {
        await knowledgeApi.update(currentKnowledgeUuid, values as KnowledgeUpdate);
        messageApi.success('更新成功');
      } else {
        await knowledgeApi.create(values as KnowledgeCreate);
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
  const columns: ProColumns<Knowledge>[] = [
    {
      title: '知识编号',
      dataIndex: 'knowledgeNo',
      width: 150,
      fixed: 'left',
      render: (_, record) => (
        <a onClick={() => handleOpenDetail(record)}>{record.knowledgeNo}</a>
      ),
    },
    {
      title: '知识标题',
      dataIndex: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '知识类型',
      dataIndex: 'knowledgeType',
      width: 120,
      valueType: 'select',
      valueEnum: {
        '技术知识': { text: '技术知识' },
        '设计经验': { text: '设计经验' },
        '最佳实践': { text: '最佳实践' },
        '专利': { text: '专利' },
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
    },
    {
      title: '查看次数',
      dataIndex: 'viewCount',
      width: 100,
      sorter: true,
    },
    {
      title: '点赞数',
      dataIndex: 'likeCount',
      width: 100,
      sorter: true,
    },
    {
      title: '评分',
      dataIndex: 'rating',
      width: 80,
      render: (rating) => rating ? `${rating}分` : '-',
    },
    {
      title: '是否公开',
      dataIndex: 'isPublic',
      width: 100,
      render: (isPublic) => (
        <Tag color={isPublic ? 'green' : 'default'}>
          {isPublic ? '公开' : '私有'}
        </Tag>
      ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<LikeOutlined />}
            onClick={() => handleLike(record)}
          >
            点赞 ({record.likeCount})
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条知识吗？"
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
      <UniTable<Knowledge>
        headerTitle="知识管理"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { current = 1, pageSize = 20, ...rest } = params;
          const skip = (current - 1) * pageSize;
          const data = await knowledgeApi.list({
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
            新建知识
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑知识' : '新建知识'}
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
            name="knowledgeNo"
            label="知识编号"
            rules={[{ required: true, message: '请输入知识编号' }]}
            placeholder="请输入知识编号"
          />
          <ProFormSelect
            name="knowledgeType"
            label="知识类型"
            options={[
              { label: '技术知识', value: '技术知识' },
              { label: '设计经验', value: '设计经验' },
              { label: '最佳实践', value: '最佳实践' },
              { label: '专利', value: '专利' },
            ]}
            rules={[{ required: true, message: '请选择知识类型' }]}
          />
          <ProFormText
            name="title"
            label="知识标题"
            rules={[{ required: true, message: '请输入知识标题' }]}
            placeholder="请输入知识标题"
          />
          <ProFormTextArea
            name="content"
            label="知识内容"
            rules={[{ required: true, message: '请输入知识内容' }]}
            placeholder="请输入知识内容"
            fieldProps={{
              rows: 6,
            }}
          />
          <ProFormText
            name="category"
            label="知识分类"
            placeholder="请输入知识分类"
          />
          <ProFormSwitch
            name="isPublic"
            label="是否公开"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="知识详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={600}
      >
        {detailLoading ? (
          <div>加载中...</div>
        ) : knowledgeDetail ? (
          <ProDescriptions<Knowledge>
            column={1}
            dataSource={knowledgeDetail}
            columns={[
              { title: '知识编号', dataIndex: 'knowledgeNo' },
              { title: '知识标题', dataIndex: 'title' },
              { title: '知识类型', dataIndex: 'knowledgeType' },
              { title: '知识分类', dataIndex: 'category' },
              { title: '知识内容', dataIndex: 'content' },
              { title: '查看次数', dataIndex: 'viewCount' },
              { title: '点赞数', dataIndex: 'likeCount' },
              { title: '评分', dataIndex: 'rating' },
              { title: '是否公开', dataIndex: 'isPublic', render: (isPublic) => isPublic ? '公开' : '私有' },
              { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
            ]}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default KnowledgesPage;
