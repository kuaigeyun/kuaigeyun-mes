/**
 * 消息配置管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的消息配置。
 * 支持消息配置的 CRUD 操作。
 */

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      messageApi.error(error.message || t('pages.system.messageConfig.getDetailFailed'));
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
      messageApi.error(error.message || t('pages.system.messageConfig.getDetailFailed'));
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
      messageApi.success(t('pages.system.messageConfig.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.messageConfig.deleteFailed'));
    }
  };

  /**
   * 处理批量删除消息配置
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.selectFirst'));
      return;
    }

    Modal.confirm({
      title: t('pages.system.messageConfig.batchDeleteConfirmTitle'),
      content: t('pages.system.messageConfig.batchDeleteConfirmContent', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
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
              errors.push(error.message || t('pages.system.messageConfig.deleteFailed'));
            }
          }

          if (successCount > 0) {
            messageApi.success(t('pages.system.messageConfig.batchDeleteSuccessCount', { count: successCount }));
          }
          if (failCount > 0) {
            messageApi.error(t('pages.system.messageConfig.batchDeleteFailCount', { count: failCount }) + (errors.length > 0 ? '：' + errors.join('; ') : ''));
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.messageConfig.batchDeleteFailed'));
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
        messageApi.success(t('pages.system.messageConfig.updateSuccess'));
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
        messageApi.success(t('pages.system.messageConfig.createSuccess'));
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.name === 'ValidationError') {
         // Form validation failed, handled by ProForm
      } else {
        messageApi.error(error.message || t('pages.system.messageConfig.operationFailed'));
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
        title: t('pages.system.messageConfig.testTitle'),
        icon: null,
        content: (
          <div style={{ marginTop: 16 }}>
            <p>{t('pages.system.messageConfig.testInputLabel', { target: type === 'email' ? t('pages.system.messageConfig.testTargetEmail') : t('pages.system.messageConfig.testTargetPhone') })}</p>
            <Input 
              placeholder={type === 'email' ? t('pages.system.messageConfig.testTargetPlaceholderEmail') : t('pages.system.messageConfig.testTargetPlaceholderPhone')} 
              onChange={(e) => { testTarget = e.target.value; }}
            />
          </div>
        ),
        onOk: async () => {
          if (!testTarget) {
            messageApi.warning(t('pages.system.messageConfig.testInputRequired'));
            return Promise.reject();
          }
          
          const hide = messageApi.loading(t('pages.system.messageConfig.testSending'), 0);
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
                title: t('pages.system.messageConfig.testFailed'),
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
            messageApi.error(t('pages.system.messageConfig.testRequestFailed', { message: error.message }));
          }
        },
      });
    } catch (e) {
      messageApi.warning(t('pages.system.messageConfig.completeConfigFirst'));
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<MessageConfig>[] = [
    {
      title: t('pages.system.messageConfig.name'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: t('pages.system.messageConfig.code'),
      dataIndex: 'code',
      width: 150,
    },
    {
      title: t('pages.system.messageConfig.type'),
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        email: { text: t('pages.system.messageConfig.typeEmail'), status: 'Success' },
        sms: { text: t('pages.system.messageConfig.typeSms'), status: 'Processing' },
        internal: { text: t('pages.system.messageConfig.typeInternal'), status: 'Warning' },
        push: { text: t('pages.system.messageConfig.typePush'), status: 'Default' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          email: { color: 'blue', text: t('pages.system.messageConfig.typeEmail') },
          sms: { color: 'orange', text: t('pages.system.messageConfig.typeSms') },
          internal: { color: 'green', text: t('pages.system.messageConfig.typeInternal') },
          push: { color: 'default', text: t('pages.system.messageConfig.typePush') },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.messageConfig.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.messageConfig.activeStatus'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.applications.enabled'), status: 'Success' },
        false: { text: t('pages.system.applications.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.applications.enabled') : t('pages.system.applications.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.messageConfig.defaultConfig'),
      dataIndex: 'is_default',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('field.customField.yes'), status: 'Success' },
        false: { text: t('field.customField.no'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_default ? 'success' : 'default'}>
          {record.is_default ? t('field.customField.yes') : t('field.customField.no')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.messageConfig.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.messageConfig.actions'),
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
            {t('pages.system.messageConfig.view')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('pages.system.messageConfig.edit')}
          </Button>
          <Popconfirm
            title={t('pages.system.messageConfig.deleteConfirm')}
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              {t('pages.system.messageConfig.delete')}
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
    { title: t('pages.system.messageConfig.name'), dataIndex: 'name' },
    { title: t('pages.system.messageConfig.code'), dataIndex: 'code' },
    {
      title: t('pages.system.messageConfig.type'),
      dataIndex: 'type',
      render: (value: string) => {
        const typeMap: Record<string, string> = {
          email: t('pages.system.messageConfig.typeEmail'),
          sms: t('pages.system.messageConfig.typeSms'),
          internal: t('pages.system.messageConfig.typeInternal'),
          push: t('pages.system.messageConfig.typePush'),
        };
        return typeMap[value] || value;
      },
    },
    { title: t('pages.system.messageConfig.configDescription'), dataIndex: 'description' },
    {
      title: t('pages.system.messageConfig.configInfo'),
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
      title: t('pages.system.messageConfig.activeStatus'),
      dataIndex: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? t('pages.system.applications.enabled') : t('pages.system.applications.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.messageConfig.defaultConfig'),
      dataIndex: 'is_default',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? t('field.customField.yes') : t('field.customField.no')}
        </Tag>
      ),
    },
    { title: t('pages.system.messageConfig.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('pages.system.messageConfig.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
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
            messageApi.error(error?.message || t('pages.system.messageConfig.loadListFailed'));
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
        createButtonText={t('pages.system.messageConfig.createButton')}
        onCreate={handleCreate}
        enableRowSelection
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteButtonText={t('pages.system.messageConfig.batchDeleteButton')}
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
              messageApi.warning(t('pages.system.messageConfig.noDataExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `message-configs-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('pages.system.messageConfig.exportSuccessCount', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.messageConfig.exportFailed'));
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
        title={isEdit ? t('pages.system.messageConfig.editTitle') : t('pages.system.messageConfig.createTitle')}
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
              <span style={{ fontWeight: 600, color: '#1f1f1f' }}>{t('pages.system.messageConfig.sectionBasic')}</span>
            </div>
            <Button 
              size="small" 
              type="primary"
              ghost
              icon={<ThunderboltOutlined />}
              onClick={handleTest}
            >
              {t('pages.system.messageConfig.testConnection')}
            </Button>
          </div>

          <ProFormGroup grid colProps={{ span: 24 }}>
            <ProFormText
              name="name"
              label={t('pages.system.messageConfig.name')}
              rules={[{ required: true, message: t('pages.system.messageConfig.nameRequired') }]}
              placeholder={t('pages.system.messageConfig.namePlaceholder')}
              colProps={{ md: 12, xs: 24 }}
              fieldProps={{ prefix: <SettingOutlined style={{ color: '#bfbfbf' }} /> }}
            />
            <ProFormText
              name="code"
              label={t('pages.system.messageConfig.code')}
              rules={[
                { required: true, message: t('pages.system.messageConfig.codeRequired') },
                { pattern: /^[A-Z0-9_]+$/, message: t('pages.system.messageConfig.codePattern') },
              ]}
              placeholder={t('pages.system.messageConfig.codePlaceholder')}
              disabled={isEdit}
              colProps={{ md: 12, xs: 24 }}
              fieldProps={{ prefix: <GlobalOutlined style={{ color: '#bfbfbf' }} /> }}
            />
            
            <SafeProFormSelect
              name="type"
              label={t('pages.system.messageConfig.type')}
              rules={[{ required: true, message: t('pages.system.messageConfig.typeRequired') }]}
              options={[
                { label: t('pages.system.messageConfig.typeEmailOption'), value: 'email' },
                { label: t('pages.system.messageConfig.typeSmsOption'), value: 'sms' },
                { label: t('pages.system.messageConfig.typeInternalOption'), value: 'internal' },
                { label: t('pages.system.messageConfig.typePushOption'), value: 'push' },
              ]}
              disabled={isEdit}
              colProps={{ md: 12, xs: 24 }}
            />

            <ProFormSwitch 
              name="is_active" 
              label={t('pages.system.messageConfig.activeStatus')} 
              colProps={{ md: 6, xs: 12 }} 
            />
            <ProFormSwitch 
              name="is_default" 
              label={t('pages.system.messageConfig.defaultConfig')} 
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
                      <span>{t('pages.system.messageConfig.smtpSection')}</span>
                    </div>
                    <ProFormGroup grid>
                      <ProFormText
                        name="smtp_host"
                        label={t('pages.system.messageConfig.smtpHost')}
                        rules={[{ required: true }]}
                        placeholder={t('pages.system.messageConfig.smtpHostPlaceholder')}
                        colProps={{ md: 18, xs: 24 }}
                      />
                      <ProFormDigit
                        name="smtp_port"
                        label={t('pages.system.messageConfig.smtpPort')}
                        rules={[{ required: true }]}
                        placeholder={t('pages.system.messageConfig.smtpPortPlaceholder')}
                        colProps={{ md: 6, xs: 24 }}
                      />
                      <ProFormText
                        name="smtp_username"
                        label={t('pages.system.messageConfig.smtpUsername')}
                        rules={[{ required: true, type: 'email' }]}
                        placeholder="your-account@example.com"
                        colProps={{ md: 12, xs: 24 }}
                      />
                      <ProFormText.Password
                        name="smtp_password"
                        label={t('pages.system.messageConfig.smtpPassword')}
                        rules={[{ required: true }]}
                        placeholder={t('pages.system.messageConfig.smtpPasswordPlaceholder')}
                        colProps={{ md: 12, xs: 24 }}
                      />
                      <ProFormText
                        name="from_name"
                        label={t('pages.system.messageConfig.fromName')}
                        placeholder={t('pages.system.messageConfig.fromNamePlaceholder')}
                        colProps={{ md: 12, xs: 24 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', height: 60 }}>
                        <ProFormSwitch
                          name="smtp_use_tls"
                          label={t('pages.system.messageConfig.smtpUseTls')}
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
                      <span>{t('pages.system.messageConfig.smsSection')}</span>
                    </div>
                    <ProFormGroup grid>
                      <SafeProFormSelect
                        name="provider"
                        label={t('pages.system.messageConfig.provider')}
                        initialValue="aliyun"
                        options={[
                          { label: t('pages.system.messageConfig.providerAliyun'), value: 'aliyun' },
                          { label: t('pages.system.messageConfig.providerTencent'), value: 'tencent' },
                        ]}
                        colProps={{ span: 24 }}
                      />
                      <ProFormText
                        name="access_key_id"
                        label={t('pages.system.messageConfig.accessKeyId')}
                        rules={[{ required: true }]}
                        placeholder={t('pages.system.messageConfig.accessKeyIdPlaceholder')}
                        colProps={{ md: 12, xs: 24 }}
                        fieldProps={{ prefix: <SafetyCertificateOutlined style={{ color: '#bfbfbf' }} /> }}
                      />
                      <ProFormText.Password
                        name="access_key_secret"
                        label={t('pages.system.messageConfig.accessKeySecret')}
                        rules={[{ required: true }]}
                        placeholder={t('pages.system.messageConfig.accessKeySecretPlaceholder')}
                        colProps={{ md: 12, xs: 24 }}
                      />
                      <ProFormText
                        name="sign_name"
                        label={t('pages.system.messageConfig.signName')}
                        placeholder={t('pages.system.messageConfig.signNamePlaceholder')}
                        colProps={{ md: 12, xs: 24 }}
                        fieldProps={{ prefix: <CheckCircleOutlined style={{ color: '#bfbfbf' }} /> }}
                      />
                      <ProFormText
                        name="region"
                        label={t('pages.system.messageConfig.region')}
                        placeholder={t('pages.system.messageConfig.regionPlaceholder')}
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
              label={t('pages.system.messageConfig.configDescription')}
              placeholder={t('pages.system.messageConfig.configDescriptionPlaceholder')}
              fieldProps={{ rows: 2 }}
            />
          </div>
        </div>
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate<MessageConfig>
        title={t('pages.system.messageConfig.detailTitle')}
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

