/**
 * 消息模板管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的消息模板。
 * 支持消息模板的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
import {
  getMessageTemplateList,
  getMessageTemplateByUuid,
  createMessageTemplate,
  updateMessageTemplate,
  deleteMessageTemplate,
  MessageTemplate,
  CreateMessageTemplateData,
  UpdateMessageTemplateData,
} from '../../../../services/messageTemplate';

/**
 * 消息模板管理列表页面组件
 */
const MessageTemplateListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑消息模板）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMessageTemplateUuid, setCurrentMessageTemplateUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<MessageTemplate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建消息模板
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMessageTemplateUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'email',
      is_active: true,
    });
  };

  /**
   * 处理编辑消息模板
   */
  const handleEdit = async (record: MessageTemplate) => {
    try {
      setIsEdit(true);
      setCurrentMessageTemplateUuid(record.uuid);
      setModalVisible(true);
      
      // 获取消息模板详情
      const detail = await getMessageTemplateByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        subject: detail.subject,
        content: detail.content,
        variables: detail.variables ? JSON.stringify(detail.variables, null, 2) : '',
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取消息模板详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: MessageTemplate) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getMessageTemplateByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取消息模板详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除消息模板
   */
  const handleDelete = async (record: MessageTemplate) => {
    try {
      await deleteMessageTemplate(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新消息模板）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      // 解析变量 JSON
      let variables: Record<string, any> | undefined = undefined;
      if (values.variables) {
        try {
          variables = JSON.parse(values.variables);
        } catch (e) {
          messageApi.error('变量 JSON 格式不正确');
          return;
        }
      }
      
      if (isEdit && currentMessageTemplateUuid) {
        await updateMessageTemplate(currentMessageTemplateUuid, {
          name: values.name,
          description: values.description,
          subject: values.subject,
          content: values.content,
          variables: variables,
          is_active: values.is_active,
        } as UpdateMessageTemplateData);
        messageApi.success('更新成功');
      } else {
        await createMessageTemplate({
          name: values.name,
          code: values.code,
          type: values.type,
          description: values.description,
          subject: values.subject,
          content: values.content,
          variables: variables,
          is_active: values.is_active,
        } as CreateMessageTemplateData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MessageTemplate>[] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '模板代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '消息类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        email: { text: '邮件', status: 'Success' },
        sms: { text: '短信', status: 'Processing' },
        internal: { text: '站内信', status: 'Warning' },
        push: { text: '推送通知', status: 'Default' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          email: { color: 'blue', text: '邮件' },
          sms: { color: 'orange', text: '短信' },
          internal: { color: 'green', text: '站内信' },
          push: { color: 'default', text: '推送通知' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '主题',
      dataIndex: 'subject',
      ellipsis: true,
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
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
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
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
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
            title="确定要删除这个消息模板吗？"
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
      <UniTable<MessageTemplate>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
          // 处理搜索参数
          const apiParams: any = {
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
          };
          
          // 消息类型筛选
          if (searchFormValues?.type) {
            apiParams.type = searchFormValues.type;
          }
          
          // 启用状态筛选
          if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
            apiParams.is_active = searchFormValues.is_active;
          }
          
          try {
            const result = await getMessageTemplateList(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,  // 简化实现，实际应该从后端返回总数
            };
          } catch (error: any) {
            console.error('获取消息模板列表失败:', error);
            messageApi.error(error?.message || '获取消息模板列表失败');
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
            新建消息模板
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑消息模板 Modal */}
      <Modal
        title={isEdit ? '编辑消息模板' : '新建消息模板'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={formLoading}
        size={800}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
            placeholder="请输入模板名称"
          />
          <ProFormText
            name="code"
            label="模板代码"
            rules={[
              { required: true, message: '请输入模板代码' },
              { pattern: /^[a-z0-9_]+$/, message: '模板代码只能包含小写字母、数字和下划线' },
            ]}
            placeholder="请输入模板代码（唯一标识，如：welcome_email）"
            disabled={isEdit}
          />
          <ProFormSelect
            name="type"
            label="消息类型"
            rules={[{ required: true, message: '请选择消息类型' }]}
            options={[
              { label: '邮件', value: 'email' },
              { label: '短信', value: 'sms' },
              { label: '站内信', value: 'internal' },
              { label: '推送通知', value: 'push' },
            ]}
            disabled={isEdit}
          />
          <ProFormText
            name="subject"
            label="主题"
            placeholder="请输入主题（邮件、推送通知）"
          />
          <ProFormTextArea
            name="content"
            label="模板内容"
            rules={[{ required: true, message: '请输入模板内容' }]}
            placeholder="请输入模板内容（支持变量，如：{name}、{code}）"
            fieldProps={{
              rows: 6,
            }}
          />
          <ProFormTextArea
            name="variables"
            label="模板变量定义（JSON）"
            placeholder='请输入模板变量定义（JSON 格式），例如：{"name": "用户名称", "code": "验证码"}'
            fieldProps={{
              rows: 4,
            }}
          />
          <ProFormTextArea
            name="description"
            label="模板描述"
            placeholder="请输入模板描述"
          />
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
        </ProForm>
      </Modal>

      {/* 查看详情 Drawer */}
      <Drawer
        title="消息模板详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={700}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<MessageTemplate>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '模板名称',
                dataIndex: 'name',
              },
              {
                title: '模板代码',
                dataIndex: 'code',
              },
              {
                title: '消息类型',
                dataIndex: 'type',
                render: (value) => {
                  const typeMap: Record<string, string> = {
                    email: '邮件',
                    sms: '短信',
                    internal: '站内信',
                    push: '推送通知',
                  };
                  return typeMap[value] || value;
                },
              },
              {
                title: '主题',
                dataIndex: 'subject',
              },
              {
                title: '模板内容',
                dataIndex: 'content',
                render: (value) => (
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {value}
                  </pre>
                ),
              },
              {
                title: '模板变量',
                dataIndex: 'variables',
                render: (value) => value ? (
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 12,
                  }}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ) : '-',
              },
              {
                title: '模板描述',
                dataIndex: 'description',
              },
              {
                title: '启用状态',
                dataIndex: 'is_active',
                render: (value) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                valueType: 'dateTime',
              },
              {
                title: '更新时间',
                dataIndex: 'updated_at',
                valueType: 'dateTime',
              },
            ]}
          />
        )}
      </Drawer>
    </>
  );
};

export default MessageTemplateListPage;

