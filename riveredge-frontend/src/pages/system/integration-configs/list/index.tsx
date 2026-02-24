/**
 * 数据连接列表页面
 *
 * 配置外部 API 或数据库连接，用于与 MES、计划、仓储等模块数据对齐。
 * 支持连接配置的 CRUD 操作和连接测试功能。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Badge, Typography, Tooltip, Card, theme } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, ApiOutlined, LinkOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getIntegrationConfigList,
  getIntegrationConfigByUuid,
  createIntegrationConfig,
  updateIntegrationConfig,
  deleteIntegrationConfig,
  testConnection,
  IntegrationConfig,
  IntegrationConfigCreate,
  IntegrationConfigUpdate,
} from '../../../../services/integrationConfig';
import ConnectionWizard from '../ConnectionWizard';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { TextArea } = Input;
const { Text, Paragraph } = Typography;
const { useToken } = theme;

/**
 * 获取集成类型图标和颜色
 */
const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
  const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    OAuth: { 
      color: 'default', 
      text: 'OAuth',
      icon: <LinkOutlined />,
    },
    API: { 
      color: 'blue', 
      text: 'API',
      icon: <ApiOutlined />,
    },
    Webhook: { 
      color: 'green', 
      text: 'Webhook',
      icon: <LinkOutlined />,
    },
    Database: { 
      color: 'orange', 
      text: 'Database',
      icon: <ApiOutlined />,
    },
  };
  return typeMap[type] || { color: 'default', text: type, icon: <ApiOutlined /> };
};

/**
 * 获取连接状态显示
 */
const getConnectionStatus = (t: (key: string) => string, integration: IntegrationConfig): { status: 'success' | 'error' | 'warning' | 'default'; text: string } => {
  if (!integration.is_active) {
    return { status: 'default', text: t('pages.system.integrationConfigs.statusDisabled') };
  }
  if (integration.is_connected) {
    return { status: 'success', text: t('pages.system.integrationConfigs.statusConnected') };
  }
  if (integration.last_error) {
    return { status: 'error', text: t('pages.system.integrationConfigs.statusFailed') };
  }
  return { status: 'warning', text: t('pages.system.integrationConfigs.statusDisconnected') };
};

/**
 * 集成设置列表页面组件
 */
const IntegrationConfigListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [allIntegrations, setAllIntegrations] = useState<IntegrationConfig[]>([]); // 用于统计
  
  // Modal 相关状态（创建/编辑集成配置）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentIntegrationUuid, setCurrentIntegrationUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [integrationType, setIntegrationType] = useState<'OAuth' | 'API' | 'Webhook' | 'Database'>('API');
  const [configJson, setConfigJson] = useState<string>('{}');
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<IntegrationConfig | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 测试连接状态
  const [testingUuid, setTestingUuid] = useState<string | null>(null);
  // 连接向导
  const [wizardVisible, setWizardVisible] = useState(false);

  /**
   * 处理新建集成配置
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentIntegrationUuid(null);
    setIntegrationType('API');
    setConfigJson('{}');
    setFormInitialValues({
      type: 'API',
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑集成配置
   */
  const handleEdit = async (record: IntegrationConfig) => {
    try {
      setIsEdit(true);
      setCurrentIntegrationUuid(record.uuid);
      setIntegrationType(record.type);
      
      // 获取集成配置详情
      const detail = await getIntegrationConfigByUuid(record.uuid);
      setConfigJson(JSON.stringify(detail.config, null, 2));
      setFormInitialValues({
        name: detail.name,
        description: detail.description,
        type: detail.type,
        is_active: detail.is_active,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.integrationConfigs.getDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: IntegrationConfig) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getIntegrationConfigByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.integrationConfigs.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除集成配置
   */
  /**
   * 处理删除集成配置
   */
  const handleDelete = async (record: IntegrationConfig) => {
    try {
      await deleteIntegrationConfig(record.uuid);
      messageApi.success(t('pages.system.integrationConfigs.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.integrationConfigs.deleteFailed'));
    }
  };

  /**
   * 处理批量删除集成配置
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.integrationConfigs.selectToDelete'));
      return;
    }

    Modal.confirm({
      title: t('pages.system.integrationConfigs.confirmBatchDelete'),
      content: t('pages.system.integrationConfigs.confirmBatchDeleteContent', { count: selectedRowKeys.length }),
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
              await deleteIntegrationConfig(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('pages.system.integrationConfigs.deleteFailed'));
            }
          }

          if (successCount > 0) {
            messageApi.success(t('pages.system.integrationConfigs.batchDeleteSuccess', { count: successCount }));
          }
          if (failCount > 0) {
            messageApi.error(t('pages.system.integrationConfigs.batchDeleteFailed', { count: failCount }) + (errors.length > 0 ? ': ' + errors.join('; ') : ''));
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.integrationConfigs.batchDeleteError'));
        }
      },
    });
  };

  /**
   * 处理测试连接
   */
  const handleTestConnection = async (record: IntegrationConfig) => {
    try {
      setTestingUuid(record.uuid);
      const result = await testConnection(record.uuid);
      if (result.success) {
        messageApi.success(result.message || t('pages.system.integrationConfigs.testSuccess'));
      } else {
        messageApi.error(result.message || t('pages.system.integrationConfigs.testFailed'));
      }
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.integrationConfigs.testFailed'));
    } finally {
      setTestingUuid(null);
    }
  };

  /**
   * 处理提交表单（创建/更新集成配置）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      // 解析配置 JSON
      let config: Record<string, any> = {};
      try {
        config = JSON.parse(configJson);
      } catch (e) {
        messageApi.error(t('pages.system.integrationConfigs.configJsonInvalid'));
        throw new Error(t('pages.system.integrationConfigs.configJsonInvalid'));
      }
      
      if (isEdit && currentIntegrationUuid) {
        await updateIntegrationConfig(currentIntegrationUuid, {
          name: values.name,
          description: values.description,
          config: config,
          is_active: values.is_active,
        } as IntegrationConfigUpdate);
        messageApi.success(t('pages.system.integrationConfigs.updateSuccess'));
      } else {
        await createIntegrationConfig({
          name: values.name,
          code: values.code,
          type: values.type,
          description: values.description,
          config: config,
          is_active: values.is_active,
        } as IntegrationConfigCreate);
        messageApi.success(t('pages.system.integrationConfigs.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.integrationConfigs.operationFailed'));
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 计算统计信息
   */
  const statCards = useMemo(() => {
    if (allIntegrations.length === 0) return undefined;
    
    const stats = {
      total: allIntegrations.length,
      connected: allIntegrations.filter((ic) => ic.is_connected && ic.is_active).length,
      disconnected: allIntegrations.filter((ic) => !ic.is_connected && ic.is_active).length,
      inactive: allIntegrations.filter((ic) => !ic.is_active).length,
    };

    return [
      {
        title: t('pages.system.integrationConfigs.totalCount'),
        value: stats.total,
        valueStyle: { color: '#1890ff' },
      },
      {
        title: t('pages.system.integrationConfigs.connectedCount'),
        value: stats.connected,
        valueStyle: { color: '#52c41a' },
      },
      {
        title: t('pages.system.integrationConfigs.disconnectedCount'),
        value: stats.disconnected,
        valueStyle: { color: '#ff4d4f' },
      },
      {
        title: t('pages.system.integrationConfigs.disabledCount'),
        value: stats.inactive,
        valueStyle: { color: '#faad14' },
      },
    ];
  }, [allIntegrations, t]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (integration: IntegrationConfig, index: number) => {
    const typeInfo = getTypeInfo(integration.type);
    const connectionStatus = getConnectionStatus(t, integration);
    
    return (
      <Card
        key={integration.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip key="view" title={t('pages.system.integrationConfigs.viewDetail')}>
            <EyeOutlined
              onClick={() => handleView(integration)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          <Tooltip key="test" title={t('pages.system.integrationConfigs.testConnection')}>
            <ApiOutlined
              onClick={() => handleTestConnection(integration)}
              style={{ fontSize: 16, color: '#1890ff' }}
            />
          </Tooltip>,
          <Popconfirm
            key="delete"
            title={t('pages.system.integrationConfigs.confirmDelete')}
            onConfirm={() => handleDelete(integration)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Tooltip title={t('pages.system.integrationConfigs.delete')}>
              <DeleteOutlined
                style={{ fontSize: 16, color: '#ff4d4f' }}
              />
            </Tooltip>
          </Popconfirm>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 16 }}>
                {integration.name}
              </Text>
              <Tag color={typeInfo.color} icon={typeInfo.icon}>
                {typeInfo.text}
              </Tag>
            </div>
            
            {integration.code && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('pages.system.integrationConfigs.code')}: {integration.code}
              </Text>
            )}
            
            {integration.description && (
              <Paragraph
                ellipsis={{ rows: 2, expandable: false }}
                style={{ marginBottom: 0, fontSize: 12 }}
              >
                {integration.description}
              </Paragraph>
            )}
          </Space>
        </div>
        
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.integrationConfigs.connectionStatus')}：</Text>
              <Badge
                status={connectionStatus.status}
                text={connectionStatus.text}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.integrationConfigs.enableStatus')}：</Text>
              <Tag color={integration.is_active ? 'success' : 'default'}>
                {integration.is_active ? t('pages.system.integrationConfigs.enabled') : t('pages.system.integrationConfigs.disabled')}
              </Tag>
            </div>
            
            {integration.last_connected_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.integrationConfigs.lastConnection')}：</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(integration.last_connected_at).fromNow()}
                </Text>
              </div>
            )}
            
            {integration.last_error && (
              <div style={{ marginTop: 8 }}>
                <Text type="danger" style={{ fontSize: 11 }}>
                  {t('pages.system.integrationConfigs.error')}: {integration.last_error}
                </Text>
              </div>
            )}
          </Space>
        </div>
      </Card>
    );
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<IntegrationConfig>[] = [
    {
      title: t('pages.system.integrationConfigs.name'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: t('pages.system.integrationConfigs.codeLabel'),
      dataIndex: 'code',
      width: 150,
    },
    {
      title: t('pages.system.integrationConfigs.type'),
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        OAuth: { text: 'OAuth', status: 'Default' },
        API: { text: 'API', status: 'Processing' },
        Webhook: { text: 'Webhook', status: 'Success' },
        Database: { text: 'Database', status: 'Warning' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          OAuth: { color: 'default', text: 'OAuth' },
          API: { color: 'blue', text: 'API' },
          Webhook: { color: 'green', text: 'Webhook' },
          Database: { color: 'orange', text: 'Database' },
        };
        const typeInfo = typeMap[record.type] || { color: 'default', text: record.type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.integrationConfigs.description'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.integrationConfigs.connectionStatusLabel'),
      dataIndex: 'is_connected',
      width: 120,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.integrationConfigs.statusConnected'), status: 'Success' },
        false: { text: t('pages.system.integrationConfigs.statusDisconnected'), status: 'Default' },
      },
      render: (_, record) => (
        <Space>
          {record.is_connected ? (
            <Badge status="success" text={t('pages.system.integrationConfigs.statusConnected')} />
          ) : (
            <Badge status="default" text={t('pages.system.integrationConfigs.statusDisconnected')} />
          )}
          {record.last_error && (
            <Tag color="error" style={{ fontSize: 11 }}>
              {t('pages.system.integrationConfigs.error')}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('pages.system.integrationConfigs.enableStatusLabel'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.integrationConfigs.enabled'), status: 'Success' },
        false: { text: t('pages.system.integrationConfigs.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.integrationConfigs.enabled') : t('pages.system.integrationConfigs.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.integrationConfigs.lastConnectionTime'),
      dataIndex: 'last_connected_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.integrationConfigs.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns = [
    {
      title: t('pages.system.integrationConfigs.name'),
      dataIndex: 'name',
    },
    {
      title: t('pages.system.integrationConfigs.codeLabel'),
      dataIndex: 'code',
    },
    {
      title: t('pages.system.integrationConfigs.type'),
      dataIndex: 'type',
      render: (value: string) => {
        const typeMap: Record<string, string> = {
          OAuth: 'OAuth',
          API: 'API',
          Webhook: 'Webhook',
          Database: 'Database',
        };
        return typeMap[value] || value;
      },
    },
    {
      title: t('pages.system.integrationConfigs.description'),
      dataIndex: 'description',
    },
    {
      title: t('pages.system.integrationConfigs.configInfo'),
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
      title: t('pages.system.integrationConfigs.connectionStatusLabel'),
      dataIndex: 'is_connected',
      render: (value: boolean) => (
        <Space>
          {value ? (
            <Badge status="success" text={t('pages.system.integrationConfigs.statusConnected')} />
          ) : (
            <Badge status="default" text={t('pages.system.integrationConfigs.statusDisconnected')} />
          )}
        </Space>
      ),
    },
    {
      title: t('pages.system.integrationConfigs.enableStatusLabel'),
      dataIndex: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? t('pages.system.integrationConfigs.enabled') : t('pages.system.integrationConfigs.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.integrationConfigs.lastConnectionTime'),
      dataIndex: 'last_connected_at',
      valueType: 'dateTime',
    },
    {
      title: t('pages.system.integrationConfigs.lastError'),
      dataIndex: 'last_error',
      render: (value: string) => value ? (
        <Tag color="error">{value}</Tag>
      ) : '-',
    },
    {
      title: t('pages.system.integrationConfigs.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: t('pages.system.integrationConfigs.updatedAt'),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <>
          <Paragraph type="secondary" style={{ marginBottom: 16 }}>
            {t('pages.system.integrationConfigs.subtitle')}
          </Paragraph>
          <UniTable<IntegrationConfig>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            // 处理搜索参数（不传skip和limit，让后端返回所有数据，前端进行分页）
            const apiParams: any = {};
            
            // 状态筛选
            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
              apiParams.is_active = searchFormValues.is_active;
            }
            
            // 类型筛选
            if (searchFormValues?.type) {
              apiParams.type = searchFormValues.type;
            }
            
            try {
              // 获取所有数据（集成配置数量通常不会太多）
              const allData = await getIntegrationConfigList(apiParams);
              
              // 同时保存所有数据用于统计
              setAllIntegrations(allData);
              
              // 前端进行分页处理
              const page = params.current || 1;
              const pageSize = params.pageSize || 20;
              const startIndex = (page - 1) * pageSize;
              const endIndex = startIndex + pageSize;
              const paginatedData = allData.slice(startIndex, endIndex);
              
              return {
                data: paginatedData,
                success: true,
                total: allData.length,
              };
            } catch (error: any) {
              console.error('获取集成配置列表失败:', error);
              messageApi.error(error?.message || t('pages.system.integrationConfigs.getListFailed'));
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
          createButtonText={t('pages.system.integrationConfigs.createButton')}
          onCreate={handleCreate}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.integrationConfigs.batchDelete')}
          toolBarRender={() => [
            <Button key="wizard" icon={<ThunderboltOutlined />} onClick={() => setWizardVisible(true)}>
              {t('pages.system.integrationConfigs.createByWizard')}
            </Button>,
          ]}
          showImportButton
          showExportButton
          onExport={async (type, keys, pageData) => {
            let items: IntegrationConfig[] = [];
            if (type === 'selected' && keys?.length) {
              items = await Promise.all(keys.map((k) => getIntegrationConfigByUuid(String(k))));
            } else if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else {
              items = await getIntegrationConfigList({ skip: 0, limit: 10000 });
            }
            if (items.length === 0) {
              messageApi.warning(t('pages.system.integrationConfigs.exportNoData'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `integration-configs-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('pages.system.integrationConfigs.exportSuccess'));
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard,
          }}
        />
        </>
      </ListPageTemplate>

      {/* 创建/编辑集成配置 Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.integrationConfigs.editModalTitle') : t('pages.system.integrationConfigs.createModalTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <ProFormText
          name="name"
          label={t('pages.system.integrationConfigs.name')}
          rules={[{ required: true, message: t('pages.system.integrationConfigs.nameRequired') }]}
          placeholder={t('pages.system.integrationConfigs.namePlaceholder')}
        />
        <ProFormText
          name="code"
          label={t('pages.system.integrationConfigs.codeLabel')}
          rules={[
            { required: true, message: t('pages.system.integrationConfigs.codeRequired') },
            { pattern: /^[a-z0-9_]+$/, message: t('pages.system.integrationConfigs.codePattern') },
          ]}
          placeholder={t('pages.system.integrationConfigs.codePlaceholder')}
          disabled={isEdit}
        />
        <SafeProFormSelect
          name="type"
          label={t('pages.system.integrationConfigs.type')}
          rules={[{ required: true, message: t('pages.system.integrationConfigs.typeRequired') }]}
          options={[
            { label: 'OAuth', value: 'OAuth' },
            { label: 'API', value: 'API' },
            { label: 'Webhook', value: 'Webhook' },
            { label: 'Database', value: 'Database' },
          ]}
          fieldProps={{
            onChange: (value) => {
              setIntegrationType(value);
              // 根据类型设置默认配置
              const defaultConfigs: Record<string, Record<string, any>> = {
                OAuth: {
                  client_id: '',
                  client_secret: '',
                  authorization_url: '',
                  token_url: '',
                },
                API: {
                  url: '',
                  method: 'GET',
                  headers: {},
                },
                Webhook: {
                  url: '',
                  method: 'POST',
                  headers: {},
                },
                Database: {
                  host: '',
                  port: 5432,
                  database: '',
                  user: '',
                  password: '',
                },
              };
              setConfigJson(JSON.stringify(defaultConfigs[value] || {}, null, 2));
            },
          }}
          disabled={isEdit}
        />
        <ProFormTextArea
          name="description"
          label={t('pages.system.integrationConfigs.description')}
          placeholder={t('pages.system.integrationConfigs.descPlaceholder')}
        />
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            {t('pages.system.integrationConfigs.configJsonLabel')}
          </label>
          <Input.TextArea
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            rows={10}
            placeholder={t('pages.system.integrationConfigs.configJsonPlaceholder')}
            style={{ fontFamily: CODE_FONT_FAMILY }}
          />
        </div>
        <ProFormSwitch
          name="is_active"
          label={t('pages.system.integrationConfigs.isActive')}
        />
      </FormModalTemplate>

      {/* 连接向导 */}
      <ConnectionWizard
        open={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onSuccess={() => {
          actionRef.current?.reload();
        }}
      />

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate<IntegrationConfig>
        title={t('pages.system.integrationConfigs.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailData || {}}
        columns={detailColumns}
      />
    </>
  );
};

export default IntegrationConfigListPage;
