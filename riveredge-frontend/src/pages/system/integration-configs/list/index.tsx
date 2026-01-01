/**
 * 集成设置列表页面
 * 
 * 用于系统管理员查看和管理组织内的集成配置。
 * 支持集成配置的 CRUD 操作和连接测试功能。
 */

import React, { useRef, useState, useMemo } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Badge, Typography, Tooltip, Card } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, ApiOutlined, LinkOutlined } from '@ant-design/icons';
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
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

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
const getConnectionStatus = (integration: IntegrationConfig): { status: 'success' | 'error' | 'warning' | 'default'; text: string } => {
  if (!integration.is_active) {
    return { status: 'default', text: '已禁用' };
  }
  
  if (integration.is_connected) {
    return { status: 'success', text: '已连接' };
  }
  
  if (integration.last_error) {
    return { status: 'error', text: '连接失败' };
  }
  
  return { status: 'warning', text: '未连接' };
};

/**
 * 集成设置列表页面组件
 */
const IntegrationConfigListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
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
      messageApi.error(error.message || '获取集成配置详情失败');
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
      messageApi.error(error.message || '获取集成配置详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除集成配置
   */
  const handleDelete = async (record: IntegrationConfig) => {
    try {
      await deleteIntegrationConfig(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理测试连接
   */
  const handleTestConnection = async (record: IntegrationConfig) => {
    try {
      setTestingUuid(record.uuid);
      const result = await testConnection(record.uuid);
      if (result.success) {
        messageApi.success(result.message || '连接测试成功');
      } else {
        messageApi.error(result.message || '连接测试失败');
      }
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '连接测试失败');
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
        messageApi.error('配置 JSON 格式不正确');
        throw new Error('配置 JSON 格式不正确');
      }
      
      if (isEdit && currentIntegrationUuid) {
        await updateIntegrationConfig(currentIntegrationUuid, {
          name: values.name,
          description: values.description,
          config: config,
          is_active: values.is_active,
        } as IntegrationConfigUpdate);
        messageApi.success('更新成功');
      } else {
        await createIntegrationConfig({
          name: values.name,
          code: values.code,
          type: values.type,
          description: values.description,
          config: config,
          is_active: values.is_active,
        } as IntegrationConfigCreate);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
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
        title: '总集成数',
        value: stats.total,
        valueStyle: { color: '#1890ff' },
      },
      {
        title: '已连接',
        value: stats.connected,
        valueStyle: { color: '#52c41a' },
      },
      {
        title: '未连接',
        value: stats.disconnected,
        valueStyle: { color: '#ff4d4f' },
      },
      {
        title: '已禁用',
        value: stats.inactive,
        valueStyle: { color: '#faad14' },
      },
    ];
  }, [allIntegrations]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (integration: IntegrationConfig, index: number) => {
    const typeInfo = getTypeInfo(integration.type);
    const connectionStatus = getConnectionStatus(integration);
    
    return (
      <Card
        key={integration.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip key="view" title="查看详情">
            <EyeOutlined
              onClick={() => handleView(integration)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          <Tooltip key="test" title="测试连接">
            <ApiOutlined
              onClick={() => handleTestConnection(integration)}
              style={{ fontSize: 16, color: '#1890ff' }}
            />
          </Tooltip>,
          <Popconfirm
            key="delete"
            title="确定要删除这个集成配置吗？"
            onConfirm={() => handleDelete(integration)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
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
                代码: {integration.code}
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
        
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>连接状态：</Text>
              <Badge
                status={connectionStatus.status}
                text={connectionStatus.text}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>启用状态：</Text>
              <Tag color={integration.is_active ? 'success' : 'default'}>
                {integration.is_active ? '启用' : '禁用'}
              </Tag>
            </div>
            
            {integration.last_connected_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>最后连接：</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(integration.last_connected_at).fromNow()}
                </Text>
              </div>
            )}
            
            {integration.last_error && (
              <div style={{ marginTop: 8 }}>
                <Text type="danger" style={{ fontSize: 11 }}>
                  错误: {integration.last_error}
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
      title: '集成名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '集成代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '集成类型',
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
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '连接状态',
      dataIndex: 'is_connected',
      width: 120,
      valueType: 'select',
      valueEnum: {
        true: { text: '已连接', status: 'Success' },
        false: { text: '未连接', status: 'Default' },
      },
      render: (_, record) => (
        <Space>
          {record.is_connected ? (
            <Badge status="success" text="已连接" />
          ) : (
            <Badge status="default" text="未连接" />
          )}
          {record.last_error && (
            <Tag color="error" style={{ fontSize: 11 }}>
              错误
            </Tag>
          )}
        </Space>
      ),
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
      title: '最后连接时间',
      dataIndex: 'last_connected_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '创建时间',
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
      title: '集成名称',
      dataIndex: 'name',
    },
    {
      title: '集成代码',
      dataIndex: 'code',
    },
    {
      title: '集成类型',
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
      title: '集成描述',
      dataIndex: 'description',
    },
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
      title: '连接状态',
      dataIndex: 'is_connected',
      render: (value: boolean) => (
        <Space>
          {value ? (
            <Badge status="success" text="已连接" />
          ) : (
            <Badge status="default" text="未连接" />
          )}
        </Space>
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
      title: '最后连接时间',
      dataIndex: 'last_connected_at',
      valueType: 'dateTime',
    },
    {
      title: '最后错误',
      dataIndex: 'last_error',
      render: (value: string) => value ? (
        <Tag color="error">{value}</Tag>
      ) : '-',
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
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
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
              messageApi.error(error?.message || '获取集成配置列表失败');
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
          onCreate={handleCreate}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          viewTypes={['table', 'card']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard,
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑集成配置 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑集成配置' : '新建集成配置'}
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
          label="集成名称"
          rules={[{ required: true, message: '请输入集成名称' }]}
          placeholder="请输入集成名称"
        />
        <ProFormText
          name="code"
          label="集成代码"
          rules={[
            { required: true, message: '请输入集成代码' },
            { pattern: /^[a-z0-9_]+$/, message: '集成代码只能包含小写字母、数字和下划线' },
          ]}
          placeholder="请输入集成代码（唯一标识，如：wechat_oauth）"
          disabled={isEdit}
        />
        <SafeProFormSelect
          name="type"
          label="集成类型"
          rules={[{ required: true, message: '请选择集成类型' }]}
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
          label="集成描述"
          placeholder="请输入集成描述"
        />
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            配置信息（JSON）
          </label>
          <Input.TextArea
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            rows={10}
            placeholder='请输入配置信息（JSON 格式），例如：{"url": "https://api.example.com", "method": "GET", "headers": {}}'
            style={{ fontFamily: 'monospace' }}
          />
        </div>
        <ProFormSwitch
          name="is_active"
          label="是否启用"
        />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate<IntegrationConfig>
        title="集成配置详情"
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
