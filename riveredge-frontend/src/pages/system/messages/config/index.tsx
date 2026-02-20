/**
 * 消息配置管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的消息配置。
 * 支持消息配置的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormInstance, ProFormDependency, ProFormDigit, ProFormGroup } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal, Input } from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined, 
  PlusOutlined,
  MailOutlined, 
  MessageOutlined, 
  GlobalOutlined, 
  SettingOutlined, 
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getMessageConfigList,
  getMessageConfigByUuid,
  createMessageConfig,
  updateMessageConfig,
  deleteMessageConfig,
  MessageConfig,
  CreateMessageConfigData,
  UpdateMessageConfigData,
  testMessageConfig,
} from '../../../../services/messageConfig';


/**
 * 消息配置管理列表页面组件
 */
const MessageConfigListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑消息配置）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMessageConfigUuid, setCurrentMessageConfigUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
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
      // 获取消息配置详情
      const detail = await getMessageConfigByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        is_active: detail.is_active,
        is_default: detail.is_default,
        ...detail.config, // 将配置项展开到表单字段中
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
   * 处理批量删除消息配置
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await deleteMessageConfig(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || '删除失败');
            }
          }

          if (successCount > 0) {
            messageApi.success(`成功删除 ${successCount} 条记录`);
          }
          if (failCount > 0) {
            messageApi.error(`删除失败 ${failCount} 条记录${errors.length > 0 ? '：' + errors.join('; ') : ''}`);
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新消息配置）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 提取技术配置字段
      const config: Record<string, any> = {};
      const { name, code, type, description, is_active, is_default, ...technicalConfig } = values;
      Object.assign(config, technicalConfig);
      
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
      if (error?.name === 'ValidationError') {
         // Form validation failed, handled by ProForm
      } else {
        messageApi.error(error.message || '操作失败');
      }
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理配置测试
   */
  const handleTest = async () => {
    try {
      const values = await formRef.current?.validateFields();
      if (!values) return;

      const { name: _n, code: _c, type, description: _d, is_active: _a, is_default: _def, ...config } = values;
      
      let testTarget = '';
      Modal.confirm({
        title: '消息配置测试',
        icon: null,
        content: (
          <div style={{ marginTop: 16 }}>
            <p>请输入用于接收测试消息的{type === 'email' ? '邮箱' : '手机号'}：</p>
            <Input 
              placeholder={type === 'email' ? 'your-email@example.com' : '接收者手机号'} 
              onChange={(e) => { testTarget = e.target.value; }}
            />
          </div>
        ),
        onOk: async () => {
          if (!testTarget) {
            messageApi.warning('请输入测试目标地址');
            return Promise.reject();
          }
          
          const hide = messageApi.loading('正在发送测试消息...', 0);
          try {
            const result = await testMessageConfig({
              type,
              config,
              target: testTarget,
            });
            hide();
            if (result.success) {
              messageApi.success(result.message);
            } else {
              Modal.error({
                title: '测试失败',
                content: (
                  <div>
                    <p>{result.message}</p>
                    {result.error_detail && (
                      <pre style={{ 
                        marginTop: 8, 
                        padding: 8, 
                        background: '#fff2f0', 
                        border: '1px solid #ffccc7',
                        borderRadius: 4,
                        fontSize: 12,
                        maxHeight: 200,
                        overflow: 'auto'
                      }}>
                        {result.error_detail}
                      </pre>
                    )}
                  </div>
                ),
              });
            }
          } catch (error: any) {
            hide();
            messageApi.error(`发起测试请求失败: ${error.message}`);
          }
        },
      });
    } catch (e) {
      messageApi.warning('请先完善配置信息再进行测试');
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

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: '配置名称', dataIndex: 'name' },
    { title: '配置代码', dataIndex: 'code' },
    {
      title: '消息类型',
      dataIndex: 'type',
      render: (value: string) => {
        const typeMap: Record<string, string> = {
          email: '邮件',
          sms: '短信',
          internal: '站内信',
          push: '推送通知',
        };
        return typeMap[value] || value;
      },
    },
    { title: '配置描述', dataIndex: 'description' },
    {
      title: '配置信息',
      dataIndex: 'config',
      render: (value: Record<string, any>) => (
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
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '默认配置',
      dataIndex: 'is_default',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? '是' : '否'}
        </Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<MessageConfig>
        actionRef={actionRef}
        columns={columns}
        request={async (params, _sort, _filter, searchFormValues) => {
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
        showCreateButton
        createButtonText="新建消息配置"
        onCreate={handleCreate}
        enableRowSelection
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteButtonText="批量删除"
        showImportButton={false}
        showExportButton={true}
        onExport={async (type, keys, pageData) => {
          try {
            const allData = await getMessageConfigList({ skip: 0, limit: 10000 });
            let items = Array.isArray(allData) ? allData : [];
            if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else if (type === 'selected' && keys?.length) {
              items = items.filter((d: any) => keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning('暂无数据可导出');
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `message-configs-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(`已导出 ${items.length} 条记录`);
          } catch (error: any) {
            messageApi.error(error?.message || '导出失败');
          }
        }}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
        }}
        />
      </ListPageTemplate>

      {/* 创建/编辑消息配置 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑消息配置' : '新建消息配置'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={formLoading}
        width={720}
      >
        <div style={{ padding: '0 4px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 20,
            padding: '8px 12px',
            background: 'rgba(22, 119, 255, 0.04)',
            borderRadius: 8,
            border: '1px solid rgba(22, 119, 255, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AppstoreOutlined style={{ color: '#1677ff' }} />
              <span style={{ fontWeight: 600, color: '#1f1f1f' }}>基础信息</span>
            </div>
            <Button 
              size="small" 
              type="primary"
              ghost
              icon={<ThunderboltOutlined />}
              onClick={handleTest}
            >
              连接测试
            </Button>
          </div>

          <ProFormGroup grid colProps={{ span: 24 }}>
            <ProFormText
              name="name"
              label="配置名称"
              rules={[{ required: true, message: '请输入配置名称' }]}
              placeholder="例如：公司企业邮箱"
              colProps={{ md: 12, xs: 24 }}
              fieldProps={{ prefix: <SettingOutlined style={{ color: '#bfbfbf' }} /> }}
            />
            <ProFormText
              name="code"
              label="配置代码"
              rules={[
                { required: true, message: '请输入配置代码' },
                { pattern: /^[A-Z0-9_]+$/, message: '建议使用大写字母、数字和下划线' },
              ]}
              placeholder="例如：EMAIL_OFFICE"
              disabled={isEdit}
              colProps={{ md: 12, xs: 24 }}
              fieldProps={{ prefix: <GlobalOutlined style={{ color: '#bfbfbf' }} /> }}
            />
            
            <SafeProFormSelect
              name="type"
              label="消息类型"
              rules={[{ required: true, message: '请选择消息类型' }]}
              options={[
                { label: '邮件 (Email)', value: 'email' },
                { label: '短信 (SMS)', value: 'sms' },
                { label: '站内信 (Internal)', value: 'internal' },
                { label: '推送通知 (Push)', value: 'push' },
              ]}
              disabled={isEdit}
              colProps={{ md: 12, xs: 24 }}
            />

            <ProFormSwitch 
              name="is_active" 
              label="启用状态" 
              colProps={{ md: 6, xs: 12 }} 
            />
            <ProFormSwitch 
              name="is_default" 
              label="默认配置" 
              colProps={{ md: 6, xs: 12 }} 
            />
          </ProFormGroup>

          <ProFormDependency name={['type']}>
            {({ type }) => {
              if (type === 'email') {
                return (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      marginBottom: 16,
                      color: '#1f1f1f',
                      fontWeight: 600 
                    }}>
                      <MailOutlined style={{ color: '#1677ff' }} />
                      <span>SMTP 邮件服务器配置</span>
                    </div>
                    <ProFormGroup grid>
                      <ProFormText
                        name="smtp_host"
                        label="SMTP 域名"
                        rules={[{ required: true }]}
                        placeholder="例如：smtp.exmail.qq.com"
                        colProps={{ md: 18, xs: 24 }}
                      />
                      <ProFormDigit
                        name="smtp_port"
                        label="端口"
                        rules={[{ required: true }]}
                        placeholder="例如：465"
                        colProps={{ md: 6, xs: 24 }}
                      />
                      <ProFormText
                        name="smtp_username"
                        label="邮箱账号"
                        rules={[{ required: true, type: 'email' }]}
                        placeholder="your-account@example.com"
                        colProps={{ md: 12, xs: 24 }}
                      />
                      <ProFormText.Password
                        name="smtp_password"
                        label="授权码/密码"
                        rules={[{ required: true }]}
                        placeholder="请输入邮箱授权码"
                        colProps={{ md: 12, xs: 24 }}
                      />
                      <ProFormText
                        name="from_name"
                        label="发件人显示名称"
                        placeholder="RiverEdge 系统"
                        colProps={{ md: 12, xs: 24 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', height: 60 }}>
                        <ProFormSwitch
                          name="smtp_use_tls"
                          label="SSL/TLS 加密"
                          initialValue={true}
                        />
                      </div>
                    </ProFormGroup>
                  </div>
                );
              }
              if (type === 'sms') {
                return (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      marginBottom: 16,
                      color: '#1f1f1f',
                      fontWeight: 600 
                    }}>
                      <MessageOutlined style={{ color: '#1677ff' }} />
                      <span>短信服务配置</span>
                    </div>
                    <ProFormGroup grid>
                      <SafeProFormSelect
                        name="provider"
                        label="服务商"
                        initialValue="aliyun"
                        options={[
                          { label: '阿里云', value: 'aliyun' },
                          { label: '腾讯云', value: 'tencent' },
                        ]}
                        colProps={{ span: 24 }}
                      />
                      <ProFormText
                        name="access_key_id"
                        label="AccessKey ID"
                        rules={[{ required: true }]}
                        placeholder="请输入云服务商 AccessKey"
                        colProps={{ md: 12, xs: 24 }}
                        fieldProps={{ prefix: <SafetyCertificateOutlined style={{ color: '#bfbfbf' }} /> }}
                      />
                      <ProFormText.Password
                        name="access_key_secret"
                        label="AccessKey Secret"
                        rules={[{ required: true }]}
                        placeholder="请输入 AccessKey Secret"
                        colProps={{ md: 12, xs: 24 }}
                      />
                      <ProFormText
                        name="sign_name"
                        label="短信签名"
                        placeholder="例如：华为"
                        colProps={{ md: 12, xs: 24 }}
                        fieldProps={{ prefix: <CheckCircleOutlined style={{ color: '#bfbfbf' }} /> }}
                      />
                      <ProFormText
                        name="region"
                        label="地域 (Region)"
                        placeholder="例如：cn-hangzhou"
                        colProps={{ md: 12, xs: 24 }}
                      />
                    </ProFormGroup>
                  </div>
                );
              }
              return null;
            }}
          </ProFormDependency>

          <div style={{ marginTop: 24 }}>
            <ProFormTextArea
              name="description"
              label="配置描述"
              placeholder="请输入对此配置的用途说明或备注"
              fieldProps={{ rows: 2 }}
            />
          </div>
        </div>
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate<MessageConfig>
        title="消息配置详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData || undefined}
        columns={detailColumns}
        column={1}
      />
    </>
  );
};

export default MessageConfigListPage;

