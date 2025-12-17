/**
 * 数据源管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的数据源。
 * 支持数据源的 CRUD 操作和连接测试功能。
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '@/components/SafeProFormSelect';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Badge, Tabs } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, DatabaseOutlined, ThunderboltOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import CardView from '../card-view';
import { UniTable } from '../../../../components/uni-table';
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
  TestConnectionResponse,
} from '../../../../services/dataSource';

const { TextArea } = Input;

/**
 * 数据源管理列表页面组件
 */
const DataSourceListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  
  // Modal 相关状态（创建/编辑数据源）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentDataSourceUuid, setCurrentDataSourceUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [dataSourceType, setDataSourceType] = useState<'postgresql' | 'mysql' | 'mongodb' | 'api'>('postgresql');
  const [configJson, setConfigJson] = useState<string>('{}');
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<DataSource | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 测试连接状态
  const [testingUuid, setTestingUuid] = useState<string | null>(null);

  /**
   * 处理新建数据源
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDataSourceUuid(null);
    setDataSourceType('postgresql');
    setConfigJson('{}');
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      type: 'postgresql',
      is_active: true,
    });
  };

  /**
   * 处理编辑数据源
   */
  const handleEdit = async (record: DataSource) => {
    try {
      setIsEdit(true);
      setCurrentDataSourceUuid(record.uuid);
      setDataSourceType(record.type);
      setModalVisible(true);
      
      // 获取数据源详情
      const detail = await getDataSourceByUuid(record.uuid);
      setConfigJson(JSON.stringify(detail.config, null, 2));
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        type: detail.type,
        is_active: detail.is_active,
      });
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
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          postgresql: { color: 'blue', text: 'PostgreSQL' },
          mysql: { color: 'orange', text: 'MySQL' },
          mongodb: { color: 'green', text: 'MongoDB' },
          api: { color: 'default', text: 'API' },
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
            icon={<ThunderboltOutlined />}
            loading={testingUuid === record.uuid}
            onClick={() => handleTestConnection(record)}
          >
            测试
          </Button>
          <Popconfirm
            title="确定要删除这个数据源吗？"
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
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            新建数据源
          </Button>
        )}
      </div>

      {/* 卡片视图 */}
      {viewMode === 'card' && <CardView />}

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <UniTable<DataSource>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, _filter, searchFormValues) => {
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
            新建数据源
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        />
      )}

      {/* 创建/编辑数据源 Modal */}
      <Modal
        title={isEdit ? '编辑数据源' : '新建数据源'}
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
              { label: 'API', value: 'api' },
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
              style={{ fontFamily: 'monospace' }}
            />
          </div>
          <ProFormSwitch
            name="is_active"
            label="是否启用"
          />
        </ProForm>
      </Modal>

      {/* 查看详情 Drawer */}
      <Drawer
        title="数据源详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={700}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<DataSource>
            column={1}
            dataSource={detailData}
            columns={[
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
                render: (value) => {
                  const typeMap: Record<string, string> = {
                    postgresql: 'PostgreSQL',
                    mysql: 'MySQL',
                    mongodb: 'MongoDB',
                    api: 'API',
                  };
                  return typeMap[value] || value;
                },
              },
              {
                title: '数据源描述',
                dataIndex: 'description',
              },
              {
                title: '连接配置',
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
                title: '连接状态',
                dataIndex: 'is_connected',
                render: (value) => (
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
                render: (value) => (
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
                render: (value) => value ? (
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
        )}
      </Drawer>
    </>
  );
};

export default DataSourceListPage;

