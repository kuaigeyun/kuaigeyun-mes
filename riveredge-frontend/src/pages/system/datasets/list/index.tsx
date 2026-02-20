/**
 * 数据集管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的数据集。
 * 支持数据集的 CRUD 操作和查询执行功能。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal, Badge, Table, Dropdown } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlayCircleOutlined, MoreOutlined, CopyOutlined, FormOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
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
  getDataConnectionsForDataset,
  IntegrationConfig,
} from '../../../../services/integrationConfig';

/**
 * 数据集管理列表页面组件
 */
const DatasetListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  
  // Modal 相关状态（创建/编辑数据集）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentDatasetUuid, setCurrentDatasetUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [dataConnectionGroups, setDataConnectionGroups] = useState<{ label: string; options: { label: string; value: string }[] }[]>([]);
  const [dataConnectionsFlat, setDataConnectionsFlat] = useState<IntegrationConfig[]>([]);
  
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
   * 加载数据连接列表（合并数据源 + 应用连接器）
   */
  useEffect(() => {
    const loadDataConnections = async () => {
      try {
        const { groups, items } = await getDataConnectionsForDataset();
        setDataConnectionGroups(groups);
        setDataConnectionsFlat(items);
      } catch (error: any) {
        console.error('加载数据连接列表失败:', error);
      }
    };
    loadDataConnections();
  }, []);

  /**
   * 处理新建数据集（仅创建记录，不配置查询，创建后跳转设计器）
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentDatasetUuid(null);
    setFormInitialValues({
      is_active: true,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑数据集（仅编辑基本信息，查询配置在设计器中）
   */
  const handleEdit = async (record: Dataset) => {
    try {
      setIsEdit(true);
      setCurrentDatasetUuid(record.uuid);
      const detail = await getDatasetByUuid(record.uuid);
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        is_active: detail.is_active,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取数据集详情失败');
    }
  };

  /**
   * 处理设计数据集（跳转到设计器，新建 tab）
   */
  const handleDesign = (record: Dataset) => {
    navigate(`/system/datasets/designer?uuid=${record.uuid}`);
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
   * 批量启用/禁用
   */
  const handleBatchStatus = async (enable: boolean) => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要操作的数据集');
      return;
    }
    try {
      let done = 0;
      for (const uuid of selectedRowKeys) {
        await updateDataset(String(uuid), { is_active: enable });
        done++;
      }
      messageApi.success(`已${enable ? '启用' : '禁用'} ${done} 个数据集`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '操作失败');
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
   * 批量删除数据集
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的数据集');
      return;
    }
    Modal.confirm({
      title: `确定要删除选中的 ${selectedRowKeys.length} 个数据集吗？`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let done = 0;
          let fail = 0;
          for (const uuid of selectedRowKeys) {
            try {
              await deleteDataset(String(uuid));
              done++;
            } catch {
              fail++;
            }
          }
          if (fail > 0) {
            messageApi.warning(`删除完成：成功 ${done} 个，失败 ${fail} 个`);
          } else {
            messageApi.success(`已删除 ${done} 个数据集`);
          }
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理复制数据集（创建副本后跳转设计器）
   */
  const handleCopy = async (record: Dataset) => {
    try {
      const detail = await getDatasetByUuid(record.uuid);
      const created = await createDataset({
        name: `${detail.name} (副本)`,
        code: `${detail.code}_copy_${Date.now().toString(36)}`,
        query_type: detail.query_type,
        query_config: detail.query_config || {},
        description: detail.description,
        data_source_uuid: detail.data_source_uuid,
        is_active: true,
      } as CreateDatasetData);
      messageApi.success('复制成功，即将打开设计器');
      actionRef.current?.reload();
      navigate(`/system/datasets/designer?uuid=${created.uuid}`);
    } catch (error: any) {
      messageApi.error(error?.message || '复制数据集失败');
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
   * 新建：仅名称、代码、数据连接、描述、启用状态，创建后跳转设计器
   * 编辑：仅基本信息
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentDatasetUuid) {
        await updateDataset(currentDatasetUuid, {
          name: values.name,
          description: values.description,
          is_active: values.is_active,
        } as UpdateDatasetData);
        messageApi.success('更新成功');
        setModalVisible(false);
        setFormInitialValues(undefined);
        actionRef.current?.reload();
      } else {
        const created = await createDataset({
          name: values.name,
          code: values.code,
          query_type: 'sql',
          query_config: {},
          description: values.description,
          data_source_uuid: values.data_source_uuid,
          is_active: values.is_active,
        } as CreateDatasetData);
        messageApi.success('创建成功，即将打开设计器');
        setModalVisible(false);
        setFormInitialValues(undefined);
        actionRef.current?.reload();
        navigate(`/system/datasets/designer?uuid=${created.uuid}`);
      }
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
      title: '数据连接',
      dataIndex: 'data_source_uuid',
      width: 200,
      hideInSearch: true,
      render: (_, record) => {
        const conn = dataConnectionsFlat.find(c => c.uuid === record.data_source_uuid);
        return conn ? conn.name : record.data_source_uuid;
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
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<FormOutlined />} onClick={() => handleDesign(record)}>
            设计
          </Button>
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
                  key: 'execute',
                  icon: <PlayCircleOutlined />,
                  label: '执行查询',
                  onClick: () => handleExecute(record),
                },
                {
                  key: 'copy',
                  icon: <CopyOutlined />,
                  label: '复制',
                  onClick: () => handleCopy(record),
                },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: '删除',
                  danger: true,
                  onClick: () => {
                    Modal.confirm({
                      title: '确定要删除这个数据集吗？',
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
            <Button type="link" size="small" icon={<MoreOutlined />} loading={executingUuid === record.uuid}>
              更多
            </Button>
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
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
          showCreateButton
          onCreate={handleCreate}
          createButtonText="新建数据集"
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText="批量删除"
          toolBarRender={() =>
            selectedRowKeys.length > 0
              ? [
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
              '数据集名称': 'name', 'name': 'name',
              '数据集代码': 'code', 'code': 'code',
              '数据连接UUID': 'data_source_uuid', 'data_source_uuid': 'data_source_uuid',
              '查询类型': 'query_type', 'query_type': 'query_type',
              '描述': 'description', 'description': 'description',
              '启用状态': 'is_active', 'is_active': 'is_active',
              '查询配置(JSON)': 'query_config_json', 'query_config_json': 'query_config_json',
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
              if (obj.name && obj.code && obj.data_source_uuid) {
                let queryConfig: Record<string, any> = {};
                if (obj.query_config_json) {
                  try {
                    queryConfig = JSON.parse(String(obj.query_config_json));
                  } catch {
                    queryConfig = {};
                  }
                }
                const queryType = obj.query_type === 'api' ? 'api' : 'sql';
                await createDataset({
                  name: String(obj.name),
                  code: `${String(obj.code).replace(/[^a-z0-9_]/g, '_').slice(0, 30)}_${ts}${i}`,
                  data_source_uuid: String(obj.data_source_uuid),
                  query_type: queryType,
                  query_config: queryConfig,
                  description: obj.description ? String(obj.description) : undefined,
                  is_active: obj.is_active !== 'false' && obj.is_active !== '0' && obj.is_active !== '',
                });
                done++;
              }
            }
            messageApi.success(`成功导入 ${done} 个数据集`);
            actionRef.current?.reload();
          }}
          importHeaders={['*数据集名称', '*数据集代码', '*数据连接UUID', '*查询类型', '描述', '启用状态', '*查询配置(JSON)']}
          importExampleRow={['示例数据集', 'example_ds', 'uuid-of-data-source', 'sql', '选填', '是', '{"sql":"SELECT 1","parameters":{}}']}
          showExportButton
          onExport={async (type, keys, pageData) => {
            let items: Dataset[] = [];
            if (type === 'selected' && keys?.length) {
              items = await Promise.all(keys.map((k) => getDatasetByUuid(String(k))));
            } else if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else {
              const res = await getDatasetList({ page: 1, page_size: 1000 });
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
            a.download = `datasets-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success('导出成功');
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑数据集 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑数据集' : '新建数据集'}
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
          label="数据集名称"
          rules={[{ required: true, message: '请输入数据集名称' }]}
          placeholder="请输入数据集名称"
          colProps={{ span: 12 }}
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
          colProps={{ span: 12 }}
        />
        {!isEdit && (
          <SafeProFormSelect
            name="data_source_uuid"
            label="数据连接"
            rules={[{ required: true, message: '请选择数据连接' }]}
            options={dataConnectionGroups}
            colProps={{ span: 12 }}
          />
        )}
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="选填"
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch name="is_active" label="是否启用" colProps={{ span: 12 }} />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate
        title="数据集详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={detailData}
        extra={
          detailData && (
            <Space>
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  setDrawerVisible(false);
                  handleEdit(detailData);
                }}
              >
                编辑
              </Button>
              <Button
                icon={<PlayCircleOutlined />}
                loading={executingUuid === detailData.uuid}
                onClick={() => handleExecute(detailData)}
              >
                执行查询
              </Button>
              <Popconfirm
                title="确定要删除这个数据集吗？"
                onConfirm={() => {
                  handleDelete(detailData);
                  setDrawerVisible(false);
                }}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          )
        }
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
            title: '数据连接',
            dataIndex: 'data_source_uuid',
            render: (value: string) => {
              const conn = dataConnectionsFlat.find(c => c.uuid === value);
              return conn ? `${conn.name} (${conn.type})` : value;
            },
          },
          {
            title: '查询类型',
            dataIndex: 'query_type',
            render: (value: string) => {
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
            title: '最后执行时间',
            dataIndex: 'last_executed_at',
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
        width={1000}
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

