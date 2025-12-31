/**
 * 集成设置列表页面
 * 
 * 用于系统管理员查看和管理组织内的集成配置。
 * 支持集成配置的 CRUD 操作和连接测试功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Badge, Tabs } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import CardView from '../card-view';
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

/**
 * 集成设置列表页面组件
 */
const IntegrationConfigListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  
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
    {
      title: '操作',
      valueType: 'option',
      width: 250,
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
          <Button
            type="link"
            size="small"
            icon={<ApiOutlined />}
            loading={testingUuid === record.uuid}
            onClick={() => handleTestConnection(record)}
          >
            测试
          </Button>
          <Popconfirm
            title="确定要删除这个集成配置吗？"
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
      {/* 视图切换 */}
      <div style={{ 
        padding: '16px 16px 0 16px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <Tabs
          activeKey={viewMode}
          onChange={(key) => setViewMode(key as 'card' | 'list')}
          items={[
            { key: 'card', label: '卡片视图', icon: <AppstoreOutlined /> },
            { key: 'list', label: '列表视图', icon: <UnorderedListOutlined /> },
          ]}
        />
        {viewMode === 'list' && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            新建集成
          </Button>
        )}
      </div>

      {/* 卡片视图 */}
      {viewMode === 'card' && <div style={{ padding: '0 16px 16px 16px' }}><CardView /></div>}

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <ListPageTemplate>
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
            新建集成
          </Button>,
        ]}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
        />
        </ListPageTemplate>
      )}

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
      <DetailDrawerTemplate
        title="集成配置详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailData}
        columns={[
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
        ]}
      />
      </ListPageTemplate>
      )}
    </>
  );
};

export default IntegrationConfigListPage;

