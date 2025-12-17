/**
 * 消息配置管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的消息配置。
 * 支持消息配置的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '@/components/SafeProFormSelect';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import {
  getMessageConfigList,
  getMessageConfigByUuid,
  createMessageConfig,
  updateMessageConfig,
  deleteMessageConfig,
  MessageConfig,
  CreateMessageConfigData,
  UpdateMessageConfigData,
} from '../../../../services/messageConfig';

const { TextArea } = Input;

/**
 * 消息配置管理列表页面组件
 */
const MessageConfigListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑消息配置）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMessageConfigUuid, setCurrentMessageConfigUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [messageType, setMessageType] = useState<'email' | 'sms' | 'internal' | 'push'>('email');
  const [configJson, setConfigJson] = useState<string>('{}');
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<MessageConfig | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 处理新建消息配置
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMessageConfigUuid(null);
    setMessageType('email');
    setConfigJson('{}');
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'email',
      is_active: true,
      is_default: false,
    });
  };

  /**
   * 处理编辑消息配置
   */
  const handleEdit = async (record: MessageConfig) => {
    try {
      setIsEdit(true);
      setCurrentMessageConfigUuid(record.uuid);
      setMessageType(record.type);
      setModalVisible(true);
      
      // 获取消息配置详情
      const detail = await getMessageConfigByUuid(record.uuid);
      setConfigJson(JSON.stringify(detail.config, null, 2));
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        is_active: detail.is_active,
        is_default: detail.is_default,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取消息配置详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: MessageConfig) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getMessageConfigByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取消息配置详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除消息配置
   */
  const handleDelete = async (record: MessageConfig) => {
    try {
      await deleteMessageConfig(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新消息配置）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      // 解析配置 JSON
      let config: Record<string, any> = {};
      try {
        config = JSON.parse(configJson);
      } catch (e) {
        messageApi.error('配置 JSON 格式不正确');
        return;
      }
      
      if (isEdit && currentMessageConfigUuid) {
        await updateMessageConfig(currentMessageConfigUuid, {
          name: values.name,
          description: values.description,
          config: config,
          is_active: values.is_active,
          is_default: values.is_default,
        } as UpdateMessageConfigData);
        messageApi.success('更新成功');
      } else {
        await createMessageConfig({
          name: values.name,
          code: values.code,
          type: values.type,
          description: values.description,
          config: config,
          is_active: values.is_active,
          is_default: values.is_default,
        } as CreateMessageConfigData);
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
  const columns: ProColumns<MessageConfig>[] = [
    {
      title: '配置名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '配置代码',
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
      title: '默认配置',
      dataIndex: 'is_default',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '是', status: 'Success' },
        false: { text: '否', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_default ? 'success' : 'default'}>
          {record.is_default ? '是' : '否'}
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
            title="确定要删除这个消息配置吗？"
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
      <UniTable<MessageConfig>
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
            const result = await getMessageConfigList(apiParams);
            return {
              data: result,
              success: true,
              total: result.length,  // 简化实现，实际应该从后端返回总数
            };
          } catch (error: any) {
            console.error('获取消息配置列表失败:', error);
            messageApi.error(error?.message || '获取消息配置列表失败');
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
            新建消息配置
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑消息配置 Modal */}
      <Modal
        title={isEdit ? '编辑消息配置' : '新建消息配置'}
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
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
            placeholder="请输入配置名称"
          />
          <ProFormText
            name="code"
            label="配置代码"
            rules={[
              { required: true, message: '请输入配置代码' },
              { pattern: /^[a-z0-9_]+$/, message: '配置代码只能包含小写字母、数字和下划线' },
            ]}
            placeholder="请输入配置代码（唯一标识，如：email_default）"
            disabled={isEdit}
          />
          <SafeProFormSelect
            name="type"
            label="消息类型"
            rules={[{ required: true, message: '请选择消息类型' }]}
            options={[
              { label: '邮件', value: 'email' },
              { label: '短信', value: 'sms' },
              { label: '站内信', value: 'internal' },
              { label: '推送通知', value: 'push' },
            ]}
            fieldProps={{
              onChange: (value) => {
                setMessageType(value);
                // 根据类型设置默认配置
                const defaultConfigs: Record<string, Record<string, any>> = {
                  email: {
                    smtp_host: 'smtp.example.com',
                    smtp_port: 587,
                    smtp_username: '',
                    smtp_password: '',
                    smtp_use_tls: true,
                    from_email: '',
                    from_name: 'RiverEdge',
                  },
                  sms: {
                    provider: 'aliyun',
                    access_key_id: '',
                    access_key_secret: '',
                    sign_name: 'RiverEdge',
                    region: 'cn-hangzhou',
                  },
                  internal: {},
                  push: {},
                };
                setConfigJson(JSON.stringify(defaultConfigs[value] || {}, null, 2));
              },
            }}
            disabled={isEdit}
          />
          <ProFormTextArea
            name="description"
            label="配置描述"
            placeholder="请输入配置描述"
          />
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              配置信息（JSON）
            </label>
            <TextArea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={10}
              placeholder='请输入配置信息（JSON 格式），例如：{"smtp_host": "smtp.example.com", "smtp_port": 587, "smtp_username": "user@example.com", "smtp_password": "password"}'
              style={{ fontFamily: 'monospace' }}
            />
          </div>
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
          <ProFormSwitch
            name="is_default"
            label="是否默认配置"
          />
        </ProForm>
      </Modal>

      {/* 查看详情 Drawer */}
      <Drawer
        title="消息配置详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={700}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<MessageConfig>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '配置名称',
                dataIndex: 'name',
              },
              {
                title: '配置代码',
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
                title: '配置描述',
                dataIndex: 'description',
              },
              {
                title: '配置信息',
                dataIndex: 'config',
                render: (value) => (
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '300px',
                    fontSize: 12,
                  }}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ),
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
                title: '默认配置',
                dataIndex: 'is_default',
                render: (value) => (
                  <Tag color={value ? 'success' : 'default'}>
                    {value ? '是' : '否'}
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

export default MessageConfigListPage;

