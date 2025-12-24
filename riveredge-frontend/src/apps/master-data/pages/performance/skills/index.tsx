/**
 * 技能管理页面
 * 
 * 提供技能的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProDescriptions } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Drawer, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { skillApi } from '../../../services/performance';
import type { Skill, SkillCreate, SkillUpdate } from '../../../types/performance';

/**
 * 技能管理列表页面组件
 */
const SkillsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSkillUuid, setCurrentSkillUuid] = useState<string | null>(null);
  const [skillDetail, setSkillDetail] = useState<Skill | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Modal 相关状态（创建/编辑技能）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  /**
   * 处理新建技能
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentSkillUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      isActive: true,
    });
  };

  /**
   * 处理编辑技能
   */
  const handleEdit = async (record: Skill) => {
    try {
      setIsEdit(true);
      setCurrentSkillUuid(record.uuid);
      setModalVisible(true);
      
      // 获取技能详情
      const detail = await skillApi.get(record.uuid);
      formRef.current?.setFieldsValue({
        code: detail.code,
        name: detail.name,
        category: detail.category,
        description: detail.description,
        isActive: detail.isActive,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取技能详情失败');
    }
  };

  /**
   * 处理删除技能
   */
  const handleDelete = async (record: Skill) => {
    try {
      await skillApi.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理打开详情
   */
  const handleOpenDetail = async (record: Skill) => {
    try {
      setCurrentSkillUuid(record.uuid);
      setDrawerVisible(true);
      setDetailLoading(true);
      
      const detail = await skillApi.get(record.uuid);
      setSkillDetail(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取技能详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理关闭详情
   */
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setCurrentSkillUuid(null);
    setSkillDetail(null);
  };

  /**
   * 处理提交表单（创建/更新技能）
   */
  const handleSubmit = async (values: any) => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentSkillUuid) {
        // 更新技能
        await skillApi.update(currentSkillUuid, values as SkillUpdate);
        messageApi.success('更新成功');
      } else {
        // 创建技能
        await skillApi.create(values as SkillCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || (isEdit ? '更新失败' : '创建失败'));
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理关闭 Modal
   */
  const handleCloseModal = () => {
    setModalVisible(false);
    formRef.current?.resetFields();
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Skill>[] = [
    {
      title: '技能编码',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
    },
    {
      title: '技能名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '技能分类',
      dataIndex: 'category',
      width: 150,
      hideInSearch: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '启用状态',
      dataIndex: 'isActive',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.isActive ? 'success' : 'default'}>
          {record.isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
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
            onClick={() => handleOpenDetail(record)}
          >
            详情
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
            title="确定要删除这个技能吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
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
    <>
      <UniTable<Skill>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 启用状态筛选
          if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) {
            apiParams.isActive = searchFormValues.isActive;
          }
          
          // 分类筛选
          if (searchFormValues?.category !== undefined && searchFormValues.category !== '' && searchFormValues.category !== null) {
            apiParams.category = searchFormValues.category;
          }
          
          try {
            const result = await skillApi.list(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,
            };
          } catch (error: any) {
            console.error('获取技能列表失败:', error);
            messageApi.error(error?.message || '获取技能列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowKey="uuid"
        showAdvancedSearch={true}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建技能
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 详情 Drawer */}
      <Drawer
        title="技能详情"
        size={720}
        open={drawerVisible}
        onClose={handleCloseDetail}
      >
        <ProDescriptions<Skill>
          dataSource={skillDetail}
          loading={detailLoading}
          column={2}
          columns={[
            {
              title: '技能编码',
              dataIndex: 'code',
            },
            {
              title: '技能名称',
              dataIndex: 'name',
            },
            {
              title: '技能分类',
              dataIndex: 'category',
            },
            {
              title: '描述',
              dataIndex: 'description',
              span: 2,
            },
            {
              title: '启用状态',
              dataIndex: 'isActive',
              render: (_, record) => (
                <Tag color={record.isActive ? 'success' : 'default'}>
                  {record.isActive ? '启用' : '禁用'}
                </Tag>
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              valueType: 'dateTime',
            },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              valueType: 'dateTime',
            },
          ]}
        />
      </Drawer>

      {/* 创建/编辑技能 Modal */}
      <Modal
        title={isEdit ? '编辑技能' : '新建技能'}
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={800}
        destroyOnHidden
      >
        <ProForm
          formRef={formRef}
          loading={formLoading}
          onFinish={handleSubmit}
          submitter={{
            searchConfig: {
              submitText: isEdit ? '更新' : '创建',
              resetText: '取消',
            },
            resetButtonProps: {
              onClick: handleCloseModal,
            },
          }}
          initialValues={{
            isActive: true,
          }}
          layout="vertical"
          grid={true}
          rowProps={{ gutter: 16 }}
        >
          <ProFormText
            name="code"
            label="技能编码"
            placeholder="请输入技能编码"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入技能编码' },
              { max: 50, message: '技能编码不能超过50个字符' },
            ]}
            fieldProps={{
              style: { textTransform: 'uppercase' },
            }}
          />
          <ProFormText
            name="name"
            label="技能名称"
            placeholder="请输入技能名称"
            colProps={{ span: 12 }}
            rules={[
              { required: true, message: '请输入技能名称' },
              { max: 200, message: '技能名称不能超过200个字符' },
            ]}
          />
          <ProFormText
            name="category"
            label="技能分类"
            placeholder="请输入技能分类"
            colProps={{ span: 12 }}
            rules={[
              { max: 50, message: '技能分类不能超过50个字符' },
            ]}
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入描述"
            colProps={{ span: 24 }}
            fieldProps={{
              rows: 4,
              maxLength: 500,
            }}
          />
          <ProFormSwitch
            name="isActive"
            label="是否启用"
            colProps={{ span: 12 }}
          />
        </ProForm>
      </Modal>
    </>
  );
};

export default SkillsPage;
