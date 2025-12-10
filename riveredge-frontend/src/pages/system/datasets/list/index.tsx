/**
 * 数据集管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的数据集。
 * 支持数据集的 CRUD 操作和查询执行功能。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal, message, Input, Badge, Table } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined, PlayCircleOutlined, DatabaseOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
import {
  getDatasetList,
  getDatasetByUuid,
  createDataset,
  updateDataset,
  deleteDataset,
  executeDatasetQuery,
  Dataset,
  CreateDatasetData,
  UpdateDatasetData,
  ExecuteQueryResponse,
} from '../../../../services/dataset';
import {
  getDataSourceList,
  DataSource,
} from '../../../../services/dataSource';

const { TextArea } = Input;

/**
 * 数据集管理列表页面组件
 */
const DatasetListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑数据集）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentDatasetUuid, setCurrentDatasetUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [queryType, setQueryType] = useState<'sql' | 'api'>('sql');
  const [queryConfigJson, setQueryConfigJson] = useState<string>('{}');
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Dataset | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // 查询执行状态
  const [executeVisible, setExecuteVisible] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executeResult, setExecuteResult] = useState<ExecuteQueryResponse | null>(null);
  const [executingUuid, setExecutingUuid] = useState<string | null>(null);

  /**
   * 加载数据源列表
   */
  useEffect(() => {
    const loadDataSources = async () => {
      try {
        const result = await getDataSourceList({ page: 1, page_size: 1000 });
        setDataSources(result.items);
      } catch (error: any) {
        console.error('加载数据源列表失败:', error);
      }
    };
    loadDataSources();
  }, []);

  /**
   * 处理新建数据集
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDatasetUuid(null);
    setQueryType('sql');
    setQueryConfigJson('{}');
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      query_type: 'sql',
      is_active: true,
    });
  };

  /**
   * 处理编辑数据集
   */
  const handleEdit = async (record: Dataset) => {
    try {
      setIsEdit(true);
      setCurrentDatasetUuid(record.uuid);
      setQueryType(record.query_type);
      setModalVisible(true);
      
      // 获取数据集详情
      const detail = await getDatasetByUuid(record.uuid);
      setQueryConfigJson(JSON.stringify(detail.query_config, null, 2));
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        query_type: detail.query_type,
        data_source_uuid: detail.data_source_uuid,
        is_active: detail.is_active,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取数据集详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Dataset) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getDatasetByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取数据集详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除数据集
   */
  const handleDelete = async (record: Dataset) => {
    try {
      await deleteDataset(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理执行查询
   */
  const handleExecute = async (record: Dataset) => {
    try {
      setExecutingUuid(record.uuid);
      setExecuteLoading(true);
      setExecuteVisible(true);
      setExecuteResult(null);
      
      const result = await executeDatasetQuery(record.uuid, {
        limit: 100,
        offset: 0,
      });
      
      setExecuteResult(result);
      if (result.success) {
        messageApi.success('查询执行成功');
      } else {
        messageApi.error(result.error || '查询执行失败');
      }
    } catch (error: any) {
      messageApi.error(error.message || '查询执行失败');
      setExecuteResult({
        success: false,
        data: [],
        total: 0,
        columns: [],
        elapsed_time: 0,
        error: error.message || '查询执行失败',
      });
    } finally {
      setExecuteLoading(false);
      setExecutingUuid(null);
    }
  };

  /**
   * 处理提交表单（创建/更新数据集）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
      // 解析查询配置 JSON
      let queryConfig: Record<string, any> = {};
      try {
        queryConfig = JSON.parse(queryConfigJson);
      } catch (e) {
        messageApi.error('查询配置 JSON 格式不正确');
        return;
      }
      
      if (isEdit && currentDatasetUuid) {
        await updateDataset(currentDatasetUuid, {
          name: values.name,
          code: values.code,
          description: values.description,
          query_type: values.query_type,
          query_config: queryConfig,
          is_active: values.is_active,
        } as UpdateDatasetData);
        messageApi.success('更新成功');
      } else {
        await createDataset({
          name: values.name,
          code: values.code,
          query_type: values.query_type,
          description: values.description,
          query_config: queryConfig,
          data_source_uuid: values.data_source_uuid,
          is_active: values.is_active,
        } as CreateDatasetData);
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
  const columns: ProColumns<Dataset>[] = [
    {
      title: '数据集名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '数据集代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '数据源',
      dataIndex: 'data_source_uuid',
      width: 200,
      hideInSearch: true,
      render: (_, record) => {
        const dataSource = dataSources.find(ds => ds.uuid === record.data_source_uuid);
        return dataSource ? dataSource.name : record.data_source_uuid;
      },
    },
    {
      title: '查询类型',
      dataIndex: 'query_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        sql: { text: 'SQL', status: 'Success' },
        api: { text: 'API', status: 'Processing' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          sql: { color: 'blue', text: 'SQL' },
          api: { color: 'orange', text: 'API' },
        };
        const typeInfo = typeMap[record.query_type] || { color: 'default', text: record.query_type };
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
      title: '最后执行时间',
      dataIndex: 'last_executed_at',
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
      width: 300,
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
            icon={<PlayCircleOutlined />}
            loading={executingUuid === record.uuid}
            onClick={() => handleExecute(record)}
          >
            执行
          </Button>
          <Popconfirm
            title="确定要删除这个数据集吗？"
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
      <UniTable<Dataset>
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
          
          // 查询类型筛选
          if (searchFormValues?.query_type) {
            apiParams.query_type = searchFormValues.query_type;
          }
          
          // 数据源筛选
          if (searchFormValues?.data_source_uuid) {
            apiParams.data_source_uuid = searchFormValues.data_source_uuid;
          }
          
          // 启用状态筛选
          if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
            apiParams.is_active = searchFormValues.is_active;
          }
          
          try {
            const result = await getDatasetList(apiParams);
            return {
              data: result.items,
              success: true,
              total: result.total,
            };
          } catch (error: any) {
            console.error('获取数据集列表失败:', error);
            messageApi.error(error?.message || '获取数据集列表失败');
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
            新建数据集
          </Button>,
        ]}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 创建/编辑数据集 Modal */}
      <Modal
        title={isEdit ? '编辑数据集' : '新建数据集'}
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
            label="数据集名称"
            rules={[{ required: true, message: '请输入数据集名称' }]}
            placeholder="请输入数据集名称"
          />
          <ProFormText
            name="code"
            label="数据集代码"
            rules={[
              { required: true, message: '请输入数据集代码' },
              { pattern: /^[a-z0-9_]+$/, message: '数据集代码只能包含小写字母、数字和下划线' },
            ]}
            placeholder="请输入数据集代码（唯一标识，如：user_list）"
            disabled={isEdit}
          />
          <ProFormSelect
            name="data_source_uuid"
            label="数据源"
            rules={[{ required: true, message: '请选择数据源' }]}
            options={dataSources.map(ds => ({
              label: `${ds.name} (${ds.type})`,
              value: ds.uuid,
            }))}
            disabled={isEdit}
          />
          <ProFormSelect
            name="query_type"
            label="查询类型"
            rules={[{ required: true, message: '请选择查询类型' }]}
            options={[
              { label: 'SQL', value: 'sql' },
              { label: 'API', value: 'api' },
            ]}
            fieldProps={{
              onChange: (value) => {
                setQueryType(value);
                // 根据类型设置默认配置
                const defaultConfigs: Record<string, Record<string, any>> = {
                  sql: {
                    sql: 'SELECT * FROM table_name WHERE condition = :param',
                    parameters: {
                      param: 'value',
                    },
                  },
                  api: {
                    endpoint: '/api/data',
                    method: 'GET',
                    params: {},
                    headers: {},
                  },
                };
                setQueryConfigJson(JSON.stringify(defaultConfigs[value] || {}, null, 2));
              },
            }}
            disabled={isEdit}
          />
          <ProFormTextArea
            name="description"
            label="数据集描述"
            placeholder="请输入数据集描述"
          />
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              查询配置（JSON）
            </label>
            <TextArea
              value={queryConfigJson}
              onChange={(e) => setQueryConfigJson(e.target.value)}
              rows={10}
              placeholder={queryType === 'sql' 
                ? '请输入 SQL 查询配置（JSON 格式），例如：{"sql": "SELECT * FROM users WHERE status = :status", "parameters": {"status": "active"}}'
                : '请输入 API 查询配置（JSON 格式），例如：{"endpoint": "/api/users", "method": "GET", "params": {"status": "active"}}'
              }
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
        title="数据集详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={700}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions<Dataset>
            column={1}
            dataSource={detailData}
            columns={[
              {
                title: '数据集名称',
                dataIndex: 'name',
              },
              {
                title: '数据集代码',
                dataIndex: 'code',
              },
              {
                title: '数据源',
                dataIndex: 'data_source_uuid',
                render: (value) => {
                  const dataSource = dataSources.find(ds => ds.uuid === value);
                  return dataSource ? `${dataSource.name} (${dataSource.type})` : value;
                },
              },
              {
                title: '查询类型',
                dataIndex: 'query_type',
                render: (value) => {
                  const typeMap: Record<string, string> = {
                    sql: 'SQL',
                    api: 'API',
                  };
                  return typeMap[value] || value;
                },
              },
              {
                title: '数据集描述',
                dataIndex: 'description',
              },
              {
                title: '查询配置',
                dataIndex: 'query_config',
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
                title: '最后执行时间',
                dataIndex: 'last_executed_at',
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

      {/* 执行查询结果 Modal */}
      <Modal
        title="查询执行结果"
        open={executeVisible}
        onCancel={() => setExecuteVisible(false)}
        footer={[
          <Button key="close" onClick={() => setExecuteVisible(false)}>
            关闭
          </Button>,
        ]}
        size={1000}
      >
        {executeLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            执行中...
          </div>
        ) : executeResult ? (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Badge status={executeResult.success ? 'success' : 'error'} />
              <span>{executeResult.success ? '执行成功' : '执行失败'}</span>
              <span>耗时: {executeResult.elapsed_time}s</span>
              {executeResult.total !== undefined && (
                <span>总行数: {executeResult.total}</span>
              )}
            </Space>
            {executeResult.error && (
              <div style={{ marginBottom: 16, padding: '8px', backgroundColor: '#fff2f0', borderRadius: '4px' }}>
                <Tag color="error">错误: {executeResult.error}</Tag>
              </div>
            )}
            {executeResult.success && executeResult.data && executeResult.data.length > 0 && (
              <Table
                dataSource={executeResult.data}
                columns={executeResult.columns?.map(col => ({
                  title: col,
                  dataIndex: col,
                  key: col,
                })) || []}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                }}
                scroll={{ x: 'max-content' }}
                size="small"
              />
            )}
            {executeResult.success && (!executeResult.data || executeResult.data.length === 0) && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                查询结果为空
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default DatasetListPage;

