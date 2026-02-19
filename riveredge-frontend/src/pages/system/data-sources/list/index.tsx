/**
 * 数据源管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的数据源。
 * 支持数据源的 CRUD 操作和连接测试功能。
 */

import React, { useRef, useState, useMemo } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDependency, ProFormDigit, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Tag, Space, Badge, Typography, Alert, Tooltip, Card, Button, Dropdown, Modal } from 'antd';
import { DeleteOutlined, EyeOutlined, DatabaseOutlined, ThunderboltOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import DataSourceConnectorMarket from '../DataSourceConnectorMarket';
import type { ConnectorDefinition } from '../connectors';
import {
  getDataSourceList,
  getDataSourceByUuid,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  testDataSourceConfig,
  DataSource,
  CreateDataSourceData,
  UpdateDataSourceData,
} from '../../../../services/dataSource';
import { getDatasetList } from '../../../../services/dataset';
import { updateIntegrationConfig } from '../../../../services/integrationConfig';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

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
    oracle: { color: 'red', text: 'Oracle', icon: <DatabaseOutlined /> },
    sqlserver: { color: 'blue', text: 'SQL Server', icon: <DatabaseOutlined /> },
    redis: { color: 'volcano', text: 'Redis', icon: <DatabaseOutlined /> },
    clickhouse: { color: 'orange', text: 'ClickHouse', icon: <DatabaseOutlined /> },
    influxdb: { color: 'cyan', text: 'InfluxDB', icon: <DatabaseOutlined /> },
    doris: { color: 'geekblue', text: 'Doris', icon: <DatabaseOutlined /> },
    starrocks: { color: 'purple', text: 'StarRocks', icon: <DatabaseOutlined /> },
    elasticsearch: { color: 'green', text: 'Elasticsearch', icon: <DatabaseOutlined /> },
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
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<DataSource | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [allDataSources, setAllDataSources] = useState<DataSource[]>([]);
  const [connectorMarketVisible, setConnectorMarketVisible] = useState(false);
  const formRef = useRef<ProFormInstance>();

  /**
   * 处理新建数据源 - 先展示连接器市场
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDataSourceUuid(null);
    setConnectorMarketVisible(true);
  };

  /**
   * 从连接器市场选择后，打开表单并预填类型
   */
  const handleConnectorSelect = (connector: ConnectorDefinition) => {
    setFormInitialValues({
      type: connector.type,
      is_active: true,
      ...connector.defaultConfig,
    });
    setModalVisible(true);
  };

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const handleEdit = async (record: DataSource) => {
    try {
      setIsEdit(true);
      setCurrentDataSourceUuid(record.uuid);
      
      // 获取数据源详情
      const detail = await getDataSourceByUuid(record.uuid);
      
      const config = detail.config || {};
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        is_active: detail.is_active,
        ...config,
        username: config.username ?? config.user,
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
      const [detail, dsList] = await Promise.all([
        getDataSourceByUuid(record.uuid),
        getDatasetList({ data_source_uuid: record.uuid, page_size: 50 }),
      ]);
      setDetailData({ ...detail, related_datasets: dsList.items });
    } catch (error: any) {
      messageApi.error(error.message || '获取数据源详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 批量启用/禁用
   */
  const handleBatchStatus = async (enable: boolean) => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要操作的数据源');
      return;
    }
    try {
      let done = 0;
      for (const uuid of selectedRowKeys) {
        await updateIntegrationConfig(String(uuid), { is_active: enable });
        done++;
      }
      messageApi.success(`已${enable ? '启用' : '禁用'} ${done} 个数据源`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '操作失败');
    }
  };

  /**
   * 批量测试连接
   */
  const handleBatchTest = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要测试的数据源');
      return;
    }
    let ok = 0;
    let fail = 0;
    for (const uuid of selectedRowKeys) {
      try {
        const r = await testDataSourceConnection(String(uuid));
        if (r.success) ok++;
        else fail++;
      } catch {
        fail++;
      }
    }
    messageApi.info(`测试完成：成功 ${ok}，失败 ${fail}`);
    actionRef.current?.reload();
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
   * 表单内测试连接（保存前）
   */
  const handleTestConnectionInForm = async () => {
    try {
      const values = await formRef.current?.validateFields();
      if (!values) return;
      const { type, ...restConfig } = values;
      const config = restConfig;
      setTestingConnection(true);
      const result = await testDataSourceConfig({ type, config });
      if (result.success) {
        messageApi.success(result.message || '连接测试成功');
      } else {
        messageApi.error(result.message || '连接测试失败');
      }
    } catch (error: any) {
      if (error?.errorFields) {
        messageApi.warning('请先填写完整的连接配置');
      } else {
        messageApi.error(error?.message || '连接测试失败');
      }
    } finally {
      setTestingConnection(false);
    }
  };

  /**
   * 处理测试连接（列表/卡片操作）
   */
  const handleTestConnection = async (record: DataSource) => {
    try {
      // setTestingUuid(record.uuid);
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
      // setTestingUuid(null);
    }
  };

  /**
   * 处理提交表单（创建/更新数据源）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      const { name, code, description, type, is_active, ...restConfig } = values;
      const config = { ...restConfig };
      if (config.username !== undefined && ['postgresql', 'mysql', 'oracle', 'sqlserver', 'clickhouse', 'influxdb', 'doris', 'starrocks', 'elasticsearch', 'Database'].includes(type)) {
        config.user = config.username;
      }
      
      if (isEdit && currentDataSourceUuid) {
        await updateDataSource(currentDataSourceUuid, {
          name,
          code,
          description,
          type,
          config,
          is_active,
        } as UpdateDataSourceData);
        messageApi.success('更新成功');
      } else {
        await createDataSource({
          name,
          code,
          type,
          description,
          config,
          is_active,
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
  const renderCard = (dataSource: DataSource) => {
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
          <Tooltip key="edit" title="编辑数据源">
            <EditOutlined
              onClick={() => handleEdit(dataSource)}
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
        postgresql: { text: 'PostgreSQL' },
        mysql: { text: 'MySQL' },
        mongodb: { text: 'MongoDB' },
        oracle: { text: 'Oracle' },
        sqlserver: { text: 'SQL Server' },
        redis: { text: 'Redis' },
        clickhouse: { text: 'ClickHouse' },
        influxdb: { text: 'InfluxDB' },
        doris: { text: 'Doris' },
        starrocks: { text: 'StarRocks' },
        elasticsearch: { text: 'Elasticsearch' },
        api: { text: 'API' },
        OAuth: { text: 'OAuth' },
        Webhook: { text: 'Webhook' },
        Database: { text: 'Database' },
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
    {
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'test',
                  icon: <ThunderboltOutlined />,
                  label: '测试连接',
                  onClick: () => handleTestConnection(record),
                },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: '删除',
                  danger: true,
                  onClick: () => {
                    Modal.confirm({
                      title: '确定要删除这个数据源吗？',
                      okText: '确定',
                      cancelText: '取消',
                      okType: 'danger',
                      onOk: () => handleDelete(record),
                    });
                  },
                },
              ],
            }}
          >
            <Button type="link" size="small" icon={<MoreOutlined />}>
              更多
            </Button>
          </Dropdown>
        </Space>
      ),
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
      render: (value: any) => {
        const typeInfo = getTypeInfo(value);
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: '数据源描述',
      dataIndex: 'description',
    },
    {
      title: '关联数据集',
      dataIndex: 'related_datasets',
      render: (value: any) => {
        const list = value || [];
        if (list.length === 0) return <span style={{ color: '#999' }}>无</span>;
        return (
          <Space direction="vertical" size={4}>
            {list.slice(0, 10).map((d: any) => (
              <Tag key={d.uuid}>{d.name} ({d.code})</Tag>
            ))}
            {list.length > 10 && <span style={{ color: '#999' }}>等 {list.length} 个</span>}
          </Space>
        );
      },
    },
    {
      title: '连接配置',
      dataIndex: 'config',
      render: (value: any) => {
        const sensitiveKeys = ['password', 'token', 'basic_pass', 'client_secret'];
        const masked = value ? { ...value } : {};
        sensitiveKeys.forEach((k) => {
          if (masked[k]) masked[k] = '****';
        });
        return (
          <pre style={{
            margin: 0,
            padding: '8px',
            backgroundColor: '#f5f5f5',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '300px',
            fontSize: 12,
          }}>
            {JSON.stringify(masked, null, 2)}
          </pre>
        );
      },
    },
    {
      title: '连接状态',
      dataIndex: 'is_connected',
      render: (value: any) => (
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
      render: (value: any) => (
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
      render: (value: any) => value ? (
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
          createButtonText="新建数据源"
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          toolBarRender={() =>
            selectedRowKeys.length > 0
              ? [
                  <Button key="batch-test" onClick={handleBatchTest}>批量测试连接</Button>,
                  <Button key="batch-enable" onClick={() => handleBatchStatus(true)}>批量启用</Button>,
                  <Button key="batch-disable" onClick={() => handleBatchStatus(false)}>批量禁用</Button>,
                ]
              : []
          }
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning('请填写导入数据');
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').replace(/^\*/, '').trim());
            const rows = data.slice(1).filter((row: any[]) => row.some((c: any) => c != null && String(c).trim()));
            const fieldMap: Record<string, string> = {
              '数据源名称': 'name', 'name': 'name',
              '数据源代码': 'code', 'code': 'code',
              '数据源类型': 'type', 'type': 'type',
              '描述': 'description', 'description': 'description',
              '启用状态': 'is_active', 'is_active': 'is_active',
              '连接配置(JSON)': 'config_json', 'config_json': 'config_json',
            };
            let done = 0;
            const ts = Date.now();
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const obj: Record<string, any> = {};
              headers.forEach((h, idx) => {
                const field = fieldMap[h] || fieldMap[h?.trim()];
                if (field && row[idx] != null) obj[field] = row[idx];
              });
              if (obj.name && obj.code && obj.type) {
                let config: Record<string, any> = {};
                if (obj.config_json) {
                  try {
                    config = JSON.parse(String(obj.config_json));
                  } catch {
                    config = {};
                  }
                }
                await createDataSource({
                  name: String(obj.name),
                  code: `${String(obj.code).replace(/[^a-z0-9_]/g, '_').slice(0, 30)}_${ts}${i}`,
                  type: String(obj.type),
                  config,
                  description: obj.description ? String(obj.description) : undefined,
                  is_active: obj.is_active !== 'false' && obj.is_active !== '0' && obj.is_active !== '',
                });
                done++;
              }
            }
            messageApi.success(`成功导入 ${done} 个数据源`);
            actionRef.current?.reload();
          }}
          importHeaders={['*数据源名称', '*数据源代码', '*数据源类型', '描述', '启用状态', '连接配置(JSON)']}
          importExampleRow={['示例数据源', 'example_db', 'postgresql', '选填', '是', '{}']}
          showExportButton
          onExport={async (type, keys, pageData) => {
            let items: DataSource[] = [];
            if (type === 'selected' && keys?.length) {
              items = await Promise.all(keys.map((k) => getDataSourceByUuid(String(k))));
            } else if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else {
              const res = await getDataSourceList({ page: 1, page_size: 1000 });
              items = res.items;
            }
            if (items.length === 0) {
              messageApi.warning('暂无数据可导出');
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `data-sources-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success('导出成功');
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
        formRef={formRef}
        extraFooter={
          <ProFormDependency name={['type']}>
            {({ type }) => {
              if (!type || !['postgresql', 'mysql', 'mongodb', 'oracle', 'sqlserver', 'redis', 'clickhouse', 'influxdb', 'doris', 'starrocks', 'elasticsearch', 'api', 'Database'].includes(type)) return null;
              return (
                <Button
                  type="default"
                  icon={<ThunderboltOutlined />}
                  loading={testingConnection}
                  onClick={handleTestConnectionInForm}
                >
                  测试连接
                </Button>
              );
            }}
          </ProFormDependency>
        }
      >
        <ProFormText
          name="name"
          label="数据源名称"
          rules={[{ required: true, message: '请输入数据源名称' }]}
          placeholder="请输入数据源名称"
          colProps={{ span: 12 }}
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
          colProps={{ span: 12 }}
        />
        <SafeProFormSelect
          name="type"
          label="数据源类型"
          rules={[{ required: true, message: '请选择数据源类型' }]}
          options={[
            { label: 'PostgreSQL', value: 'postgresql' },
            { label: 'MySQL', value: 'mysql' },
            { label: 'MongoDB', value: 'mongodb' },
            { label: 'Oracle', value: 'oracle' },
            { label: 'SQL Server', value: 'sqlserver' },
            { label: 'Redis', value: 'redis' },
            { label: 'ClickHouse', value: 'clickhouse' },
            { label: 'InfluxDB', value: 'influxdb' },
            { label: 'Apache Doris', value: 'doris' },
            { label: 'StarRocks', value: 'starrocks' },
            { label: 'Elasticsearch', value: 'elasticsearch' },
            { label: 'API (通用 REST)', value: 'api' },
            { label: 'OAuth 认证', value: 'OAuth' },
            { label: 'Webhook 回调', value: 'Webhook' },
            { label: 'Database (通用)', value: 'Database' },
          ]}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormDependency name={['type']}>
            {({ type }) => {
              if (!type) return null;

              if (['postgresql', 'mysql', 'oracle', 'sqlserver', 'clickhouse', 'influxdb', 'doris', 'starrocks', 'Database'].includes(type)) {
                return (
                  <>
                    <ProFormText
                      name="host"
                      label="主机地址"
                      placeholder="localhost"
                      rules={[{ required: true, message: '请输入主机地址' }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="port"
                      label="端口"
                      placeholder={
                        type === 'mysql' ? '3306' : 
                        type === 'postgresql' ? '5432' :
                        type === 'oracle' ? '1521' :
                        type === 'sqlserver' ? '1433' :
                        type === 'clickhouse' ? '8123' :
                        type === 'doris' || type === 'starrocks' ? '9030' :
                        type === 'influxdb' ? '8086' : '5432'
                      }
                      rules={[{ required: true, message: '请输入端口' }]}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText
                      name="database"
                      label="数据库名"
                      placeholder="请输入数据库名称"
                      rules={[{ required: true, message: '请输入数据库名' }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText
                      name="username"
                      label="用户名"
                      placeholder="user"
                      rules={[{ required: true, message: '请输入用户名' }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText.Password
                      name="password"
                      label="密码"
                      placeholder="选填（部分数据库可免密）"
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              if (type === 'mongodb') {
                return (
                  <>
                    <ProFormText
                      name="host"
                      label="主机地址"
                      placeholder="localhost"
                      rules={[{ required: true, message: '请输入主机地址' }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="port"
                      label="端口"
                      placeholder="27017"
                      rules={[{ required: true, message: '请输入端口' }]}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText
                      name="database"
                      label="数据库名"
                      placeholder="admin"
                      rules={[{ required: true, message: '请输入数据库名' }]}
                      colProps={{ span: 12 }}
                    />
                    <SafeProFormSelect
                      name="auth_source"
                      label="认证库"
                      options={[{ label: 'admin', value: 'admin' }, { label: 'default', value: 'default' }]}
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              if (type === 'redis') {
                return (
                  <>
                    <ProFormText
                      name="host"
                      label="主机地址"
                      placeholder="localhost"
                      rules={[{ required: true, message: '请输入主机地址' }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="port"
                      label="端口"
                      placeholder="6379"
                      rules={[{ required: true, message: '请输入端口' }]}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText.Password
                      name="password"
                      label="密码"
                      placeholder="选填"
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="db"
                      label="DB Index"
                      initialValue={0}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              if (type === 'elasticsearch') {
                return (
                  <>
                    <ProFormText
                      name="host"
                      label="主机地址"
                      placeholder="localhost"
                      rules={[{ required: true, message: '请输入主机地址' }]}
                      colProps={{ span: 18 }}
                    />
                    <ProFormDigit
                      name="port"
                      label="端口"
                      placeholder="9200"
                      initialValue={9200}
                      rules={[{ required: true, message: '请输入端口' }]}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 6 }}
                    />
                    <ProFormText
                      name="username"
                      label="用户名"
                      colProps={{ span: 12 }}
                    />
                    <ProFormText.Password
                      name="password"
                      label="密码"
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              if (type === 'api') {
                return (
                  <>
                    <ProFormText
                      name="base_url"
                      label="Base URL"
                      placeholder="https://api.example.com/v1"
                      rules={[{ required: true, message: '请输入 Base URL' }]}
                      colProps={{ span: 24 }}
                    />
                    <ProFormSelect
                      name="auth_type"
                      label="认证方式"
                      options={[
                        { value: 'none', label: '无' },
                        { value: 'bearer', label: 'Bearer Token' },
                        { value: 'basic', label: 'Basic Auth' },
                        { value: 'header', label: 'Custom Header' },
                      ]}
                      initialValue="bearer"
                      colProps={{ span: 12 }}
                    />
                    <ProFormDependency name={['auth_type']}>
                      {({ auth_type }) => {
                        if (auth_type === 'bearer') {
                          return <ProFormText.Password name="token" label="Token" placeholder="选填" colProps={{ span: 12 }} />;
                        }
                        if (auth_type === 'basic') {
                          return (
                            <>
                              <ProFormText name="basic_user" label="User" colProps={{ span: 12 }} />
                              <ProFormText.Password name="basic_pass" label="Password" colProps={{ span: 12 }} />
                            </>
                          );
                        }
                        return null;
                      }}
                    </ProFormDependency>
                  </>
                );
              }

              return (
                <Alert message={`暂未为 ${type} 类型提供可视化表单，请联系管理员。`} type="info" />
              );
            }}
          </ProFormDependency>
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="选填"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch name="is_active" label="是否启用" colProps={{ span: 12 }} />
      </FormModalTemplate>

      {/* 连接器市场 */}
      <DataSourceConnectorMarket
        open={connectorMarketVisible}
        onClose={() => setConnectorMarketVisible(false)}
        onSelect={handleConnectorSelect}
      />

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate<DataSource>
        title="数据源详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={(detailData || {}) as DataSource}
        columns={detailColumns as any}
        extra={
          detailData && (
            <Space>
              <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(detailData); }}>
                编辑
              </Button>
              <Button icon={<ThunderboltOutlined />} onClick={() => handleTestConnection(detailData)}>
                测试连接
              </Button>
              <Popconfirm
                title="确定要删除这个数据源吗？"
                onConfirm={() => { handleDelete(detailData); setDrawerVisible(false); }}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          )
        }
      />
    </>
  );
};

export default DataSourceListPage;
