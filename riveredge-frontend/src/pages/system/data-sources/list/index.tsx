/**
 * 数据源管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的数据源。
 * 支持数据源的 CRUD 操作和连接测试功能。
 */

import React, { useRef, useState, useMemo } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Badge, Typography, Alert, Tooltip, Card } from 'antd';
import { DeleteOutlined, EyeOutlined, DatabaseOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getDataSourceList,
  getDataSourceByUuid,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  DataSource,
  CreateDataSourceData,
  UpdateDataSourceData,
} from '../../../../services/dataSource';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

/**
 * 获取数据源类型图标和颜色
 */
const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
  const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
    postgresql: { 
      color: 'blue', 
      text: 'PostgreSQL',
      icon: <DatabaseOutlined />,
    },
    mysql: { 
      color: 'orange', 
      text: 'MySQL',
      icon: <DatabaseOutlined />,
    },
    mongodb: { 
      color: 'green', 
      text: 'MongoDB',
      icon: <DatabaseOutlined />,
    },
    api: { 
      color: 'cyan', 
      text: 'API',
      icon: <ThunderboltOutlined />,
    },
    OAuth: {
      color: 'purple',
      text: 'OAuth',
      icon: <ThunderboltOutlined />,
    },
    Webhook: {
      color: 'magenta',
      text: 'Webhook',
      icon: <ThunderboltOutlined />,
    },
    Database: {
      color: 'gold',
      text: 'Database',
      icon: <DatabaseOutlined />,
    },
  };
  return typeMap[type] || { color: 'default', text: type, icon: <DatabaseOutlined /> };
};

/**
 * 获取连接状态显示
 */
const getConnectionStatus = (dataSource: DataSource): { status: 'success' | 'error' | 'warning' | 'default'; text: string } => {
  if (!dataSource.is_active) {
    return { status: 'default', text: '已禁用' };
  }
  
  if (dataSource.is_connected) {
    return { status: 'success', text: '已连接' };
  }
  
  if (dataSource.last_error) {
    return { status: 'error', text: '连接失败' };
  }
  
  return { status: 'warning', text: '未连接' };
};

/**
 * 数据源管理列表页面组件
 */
const DataSourceListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentDataSourceUuid, setCurrentDataSourceUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [dataSourceType, setDataSourceType] = useState<string>('postgresql');
  const [configJson, setConfigJson] = useState<string>('{}');
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<DataSource | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 测试连接状态
  const [testingUuid, setTestingUuid] = useState<string | null>(null);
  const [allDataSources, setAllDataSources] = useState<DataSource[]>([]); // 用于统计

  /**
   * 处理新建数据源
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDataSourceUuid(null);
    setDataSourceType('postgresql');
    setConfigJson('{}');
    setFormInitialValues({
      type: 'postgresql',
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑数据源
   */
  const handleEdit = async (record: DataSource) => {
    try {
      setIsEdit(true);
      setCurrentDataSourceUuid(record.uuid);
      setDataSourceType(record.type);
      
      // 获取数据源详情
      const detail = await getDataSourceByUuid(record.uuid);
      setConfigJson(JSON.stringify(detail.config, null, 2));
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        is_active: detail.is_active,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取数据源详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: DataSource) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getDataSourceByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取数据源详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除数据源
   */
  const handleDelete = async (record: DataSource) => {
    try {
      await deleteDataSource(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理测试连接
   */
  const handleTestConnection = async (record: DataSource) => {
    try {
      setTestingUuid(record.uuid);
      const result = await testDataSourceConnection(record.uuid);
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
   * 处理提交表单（创建/更新数据源）
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
      
      if (isEdit && currentDataSourceUuid) {
        await updateDataSource(currentDataSourceUuid, {
          name: values.name,
          code: values.code,
          description: values.description,
          type: values.type,
          config: config,
          is_active: values.is_active,
        } as UpdateDataSourceData);
        messageApi.success('更新成功');
      } else {
        await createDataSource({
          name: values.name,
          code: values.code,
          type: values.type,
          description: values.description,
          config: config,
          is_active: values.is_active,
        } as CreateDataSourceData);
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
    if (allDataSources.length === 0) return undefined;
    
    const stats = {
      total: allDataSources.length,
      connected: allDataSources.filter((ds) => ds.is_connected && ds.is_active).length,
      disconnected: allDataSources.filter((ds) => !ds.is_connected && ds.is_active).length,
      inactive: allDataSources.filter((ds) => !ds.is_active).length,
      byType: allDataSources.reduce((acc, ds) => {
        acc[ds.type] = (acc[ds.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return [
      {
        title: '总数据源数',
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
  }, [allDataSources]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (dataSource: DataSource, index: number) => {
    const typeInfo = getTypeInfo(dataSource.type);
    const connectionStatus = getConnectionStatus(dataSource);
    
    return (
      <Card
        key={dataSource.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip key="view" title="查看详情">
            <EyeOutlined
              onClick={() => handleView(dataSource)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          <Tooltip key="test" title="测试连接">
            <ThunderboltOutlined
              onClick={() => handleTestConnection(dataSource)}
              style={{ fontSize: 16, color: '#1890ff' }}
            />
          </Tooltip>,
          <Popconfirm
            key="delete"
            title="确定要删除这个数据源吗？"
            onConfirm={() => handleDelete(dataSource)}
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
                {dataSource.name}
              </Text>
              <Tag color={typeInfo.color} icon={typeInfo.icon}>
                {typeInfo.text}
              </Tag>
            </div>
            
            {dataSource.code && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                代码: {dataSource.code}
              </Text>
            )}
            
            {dataSource.description && (
              <Paragraph
                ellipsis={{ rows: 2, expandable: false }}
                style={{ marginBottom: 0, fontSize: 12 }}
              >
                {dataSource.description}
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
              <Tag color={dataSource.is_active ? 'success' : 'default'}>
                {dataSource.is_active ? '启用' : '禁用'}
              </Tag>
            </div>
            
            {dataSource.last_connected_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>最后连接：</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(dataSource.last_connected_at).fromNow()}
                </Text>
              </div>
            )}
            
            {dataSource.last_error && (
              <Alert
                message={dataSource.last_error}
                type="error"
                showIcon
                style={{ fontSize: 11, marginTop: 8 }}
                closable={false}
              />
            )}
          </Space>
        </div>
      </Card>
    );
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<DataSource>[] = [
    {
      title: '数据源名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '数据源代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '数据源类型',
      dataIndex: 'type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        postgresql: { text: 'PostgreSQL', status: 'Success' },
        mysql: { text: 'MySQL', status: 'Processing' },
        mongodb: { text: 'MongoDB', status: 'Warning' },
        api: { text: 'API', status: 'Default' },
        OAuth: { text: 'OAuth', status: 'Default' },
        Webhook: { text: 'Webhook', status: 'Default' },
        Database: { text: 'Database', status: 'Default' },
      },
      render: (_, record) => {
        const typeInfo = getTypeInfo(record.type);
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
      title: '数据源名称',
      dataIndex: 'name',
    },
    {
      title: '数据源代码',
      dataIndex: 'code',
    },
    {
      title: '数据源类型',
      dataIndex: 'type',
      render: (value: string) => {
        const typeInfo = getTypeInfo(value);
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '数据源描述',
      dataIndex: 'description',
    },
    {
      title: '连接配置',
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
        <UniTable<DataSource>
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            // 处理搜索参数
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
            };
            
            // 搜索关键词
            if (searchFormValues?.search) {
              apiParams.search = searchFormValues.search;
            }
            
            // 类型筛选
            if (searchFormValues?.type) {
              apiParams.type = searchFormValues.type;
            }
            
            // 启用状态筛选
            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
              apiParams.is_active = searchFormValues.is_active;
            }
            
            try {
              const result = await getDataSourceList(apiParams);
              
              // 同时获取所有数据用于统计（如果当前页是第一页）
              if ((params.current || 1) === 1) {
                try {
                  const allResult = await getDataSourceList({ page: 1, page_size: 1000 });
                  setAllDataSources(allResult.items);
                } catch (e) {
                  // 忽略统计数据的错误
                }
              }
              
              return {
                data: result.items,
                success: true,
                total: result.total,
              };
            } catch (error: any) {
              console.error('获取数据源列表失败:', error);
              messageApi.error(error?.message || '获取数据源列表失败');
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
          viewTypes={['table', 'help']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard,
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑数据源 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑数据源' : '新建数据源'}
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
          label="数据源名称"
          rules={[{ required: true, message: '请输入数据源名称' }]}
          placeholder="请输入数据源名称"
        />
        <ProFormText
          name="code"
          label="数据源代码"
          rules={[
            { required: true, message: '请输入数据源代码' },
            { pattern: /^[a-z0-9_]+$/, message: '数据源代码只能包含小写字母、数字和下划线' },
          ]}
          placeholder="请输入数据源代码（唯一标识，如：main_db）"
          disabled={isEdit}
        />
        <SafeProFormSelect
          name="type"
          label="数据源类型"
          rules={[{ required: true, message: '请选择数据源类型' }]}
          options={[
            { label: 'PostgreSQL', value: 'postgresql' },
            { label: 'MySQL', value: 'mysql' },
            { label: 'MongoDB', value: 'mongodb' },
            { label: 'API (通用 REST)', value: 'api' },
            { label: 'OAuth 认证', value: 'OAuth' },
            { label: 'Webhook 回调', value: 'Webhook' },
            { label: 'Database (通用)', value: 'Database' },
          ]}
          fieldProps={{
            onChange: (value) => {
              setDataSourceType(value);
              // 根据类型设置默认配置
              const defaultConfigs: Record<string, Record<string, any>> = {
                postgresql: {
                  host: 'localhost',
                  port: 5432,
                  database: '',
                  username: '',
                  password: '',
                  pool_size: 10,
                },
                mysql: {
                  host: 'localhost',
                  port: 3306,
                  database: '',
                  username: '',
                  password: '',
                  charset: 'utf8mb4',
                },
                mongodb: {
                  host: 'localhost',
                  port: 27017,
                  database: '',
                  username: '',
                  password: '',
                },
                api: {
                  base_url: '',
                  auth_type: 'bearer',
                  token: '',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                },
                OAuth: {
                  client_id: '',
                  client_secret: '',
                  authorization_url: '',
                  token_url: '',
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
          label="数据源描述"
          placeholder="请输入数据源描述"
        />
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
            连接配置（JSON）
          </label>
          <TextArea
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            rows={10}
            placeholder='请输入连接配置（JSON 格式），例如：{"host": "localhost", "port": 5432, "database": "mydb", "username": "user", "password": "password"}'
            style={{ fontFamily: CODE_FONT_FAMILY }}
          />
        </div>
        <ProFormSwitch
          name="is_active"
          label="是否启用"
        />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate<DataSource>
        title="数据源详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={(detailData || {}) as DataSource}
        columns={detailColumns}
      />
    </>
  );
};

export default DataSourceListPage;
