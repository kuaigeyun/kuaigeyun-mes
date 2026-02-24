/**
 * 数据集管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的数据集。
 * 支持数据集的 CRUD 操作和查询执行功能。
 */

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      messageApi.error(error.message || t('pages.system.datasets.getDetailFailed'));
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
      messageApi.error(error.message || t('pages.system.datasets.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 批量启用/禁用
   */
  const handleBatchStatus = async (enable: boolean) => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.datasets.selectToOperate'));
      return;
    }
    try {
      let done = 0;
      for (const uuid of selectedRowKeys) {
        await updateDataset(String(uuid), { is_active: enable });
        done++;
      }
      messageApi.success(t('pages.system.datasets.batchStatusSuccess', { action: enable ? t('pages.system.datasets.enabled') : t('pages.system.datasets.disabled'), count: done }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.datasets.operationFailed'));
    }
  };

  /**
   * 处理删除数据集
   */
  const handleDelete = async (record: Dataset) => {
    try {
      await deleteDataset(record.uuid);
      messageApi.success(t('pages.system.datasets.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.datasets.deleteFailed'));
    }
  };

  /**
   * 批量删除数据集
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.datasets.selectToDelete'));
      return;
    }
    Modal.confirm({
      title: t('pages.system.datasets.confirmBatchDelete', { count: selectedRowKeys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
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
            messageApi.warning(t('pages.system.datasets.batchDeletePartial', { done, fail }));
          } else {
            messageApi.success(t('pages.system.datasets.batchDeleteSuccess', { count: done }));
          }
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || t('pages.system.datasets.batchDeleteFailed'));
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
      messageApi.success(t('pages.system.datasets.copySuccess'));
      actionRef.current?.reload();
      navigate(`/system/datasets/designer?uuid=${created.uuid}`);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.datasets.copyFailed'));
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
        messageApi.success(t('pages.system.datasets.executeSuccess'));
      } else {
        messageApi.error(result.error || t('pages.system.datasets.executeFailed'));
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.datasets.executeFailed'));
      setExecuteResult({
        success: false,
        data: [],
        total: 0,
        columns: [],
        elapsed_time: 0,
        error: error.message || t('pages.system.datasets.executeFailed'),
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
        messageApi.success(t('pages.system.datasets.updateSuccess'));
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
        messageApi.success(t('pages.system.datasets.createSuccess'));
        setModalVisible(false);
        setFormInitialValues(undefined);
        actionRef.current?.reload();
        navigate(`/system/datasets/designer?uuid=${created.uuid}`);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.datasets.operationFailed'));
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
      title: t('pages.system.datasets.columnName'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: t('pages.system.datasets.columnCode'),
      dataIndex: 'code',
      width: 150,
    },
    {
      title: t('pages.system.datasets.columnDataConnection'),
      dataIndex: 'data_source_uuid',
      width: 200,
      hideInSearch: true,
      render: (_, record) => {
        const conn = dataConnectionsFlat.find(c => c.uuid === record.data_source_uuid);
        return conn ? conn.name : record.data_source_uuid;
      },
    },
    {
      title: t('pages.system.datasets.columnQueryType'),
      dataIndex: 'query_type',
      width: 120,
      valueType: 'select',
      valueEnum: {
        sql: { text: t('pages.system.datasets.queryTypeSql'), status: 'Success' },
        api: { text: t('pages.system.datasets.queryTypeApi'), status: 'Processing' },
      },
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          sql: { color: 'blue', text: t('pages.system.datasets.queryTypeSql') },
          api: { color: 'orange', text: t('pages.system.datasets.queryTypeApi') },
        };
        const typeInfo = typeMap[record.query_type] || { color: 'default', text: record.query_type };
        return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
      },
    },
    {
      title: t('pages.system.datasets.columnDescription'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.datasets.columnEnabled'),
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.datasets.enabled'), status: 'Success' },
        false: { text: t('pages.system.datasets.disabled'), status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? t('pages.system.datasets.enabled') : t('pages.system.datasets.disabled')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.datasets.columnLastExecuted'),
      dataIndex: 'last_executed_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.datasets.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.datasets.columnActions'),
      valueType: 'option',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<FormOutlined />} onClick={() => handleDesign(record)}>
            {t('pages.system.datasets.design')}
          </Button>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            {t('pages.system.datasets.view')}
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            {t('pages.system.datasets.edit')}
          </Button>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'execute',
                  icon: <PlayCircleOutlined />,
                  label: t('pages.system.datasets.executeQuery'),
                  onClick: () => handleExecute(record),
                },
                {
                  key: 'copy',
                  icon: <CopyOutlined />,
                  label: t('pages.system.datasets.copy'),
                  onClick: () => handleCopy(record),
                },
                {
                  key: 'delete',
                  icon: <DeleteOutlined />,
                  label: t('pages.system.datasets.delete'),
                  danger: true,
                  onClick: () => {
                    Modal.confirm({
                      title: t('pages.system.datasets.confirmDelete'),
                      okText: t('common.confirm'),
                      cancelText: t('common.cancel'),
                      okType: 'danger',
                      onOk: () => handleDelete(record),
                    });
                  },
                },
              ],
            }}
          >
            <Button type="link" size="small" icon={<MoreOutlined />} loading={executingUuid === record.uuid}>
              {t('pages.system.datasets.more')}
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
              messageApi.error(error?.message || t('pages.system.datasets.loadListFailed'));
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
          createButtonText={t('pages.system.datasets.createButton')}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.datasets.batchDelete')}
          toolBarRender={() =>
            selectedRowKeys.length > 0
              ? [
                  <Button key="batch-enable" onClick={() => handleBatchStatus(true)}>{t('pages.system.datasets.batchEnable')}</Button>,
                  <Button key="batch-disable" onClick={() => handleBatchStatus(false)}>{t('pages.system.datasets.batchDisable')}</Button>,
                ]
              : []
          }
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning(t('pages.system.datasets.fillImportData'));
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
            messageApi.success(t('pages.system.datasets.importSuccess', { count: done }));
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
              messageApi.warning(t('pages.system.datasets.noDataToExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `datasets-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(t('pages.system.datasets.exportSuccess'));
          }}
        />
      </ListPageTemplate>

      {/* 创建/编辑数据集 Modal */}
      <FormModalTemplate
        title={isEdit ? t('pages.system.datasets.modalEdit') : t('pages.system.datasets.modalCreate')}
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
          label={t('pages.system.datasets.labelName')}
          rules={[{ required: true, message: t('pages.system.datasets.nameRequired') }]}
          placeholder={t('pages.system.datasets.namePlaceholder')}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="code"
          label={t('pages.system.datasets.labelCode')}
          rules={[
            { required: true, message: t('pages.system.datasets.codeRequired') },
            { pattern: /^[a-z0-9_]+$/, message: t('pages.system.datasets.codePattern') },
          ]}
          placeholder={t('pages.system.datasets.codePlaceholder')}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        {!isEdit && (
          <SafeProFormSelect
            name="data_source_uuid"
            label={t('pages.system.datasets.labelDataConnection')}
            rules={[{ required: true, message: t('pages.system.datasets.dataConnectionRequired') }]}
            options={dataConnectionGroups}
            colProps={{ span: 12 }}
          />
        )}
        <ProFormTextArea
          name="description"
          label={t('pages.system.datasets.labelDescription')}
          placeholder={t('pages.system.datasets.descriptionOptional')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch name="is_active" label={t('pages.system.datasets.labelEnabled')} colProps={{ span: 12 }} />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <DetailDrawerTemplate
        title={t('pages.system.datasets.detailTitle')}
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
                {t('pages.system.datasets.edit')}
              </Button>
              <Button
                icon={<PlayCircleOutlined />}
                loading={executingUuid === detailData.uuid}
                onClick={() => handleExecute(detailData)}
              >
                {t('pages.system.datasets.executeQuery')}
              </Button>
              <Popconfirm
                title={t('pages.system.datasets.confirmDelete')}
                onConfirm={() => {
                  handleDelete(detailData);
                  setDrawerVisible(false);
                }}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
              >
                <Button danger icon={<DeleteOutlined />}>
                  {t('pages.system.datasets.delete')}
                </Button>
              </Popconfirm>
            </Space>
          )
        }
        columns={[
          {
            title: t('pages.system.datasets.columnName'),
            dataIndex: 'name',
          },
          {
            title: t('pages.system.datasets.columnCode'),
            dataIndex: 'code',
          },
          {
            title: t('pages.system.datasets.columnDataConnection'),
            dataIndex: 'data_source_uuid',
            render: (value: string) => {
              const conn = dataConnectionsFlat.find(c => c.uuid === value);
              return conn ? `${conn.name} (${conn.type})` : value;
            },
          },
          {
            title: t('pages.system.datasets.columnQueryType'),
            dataIndex: 'query_type',
            render: (value: string) => {
              const typeMap: Record<string, string> = {
                sql: t('pages.system.datasets.queryTypeSql'),
                api: t('pages.system.datasets.queryTypeApi'),
              };
              return typeMap[value] || value;
            },
          },
          {
            title: t('pages.system.datasets.labelDescription'),
            dataIndex: 'description',
          },
          {
            title: t('pages.system.datasets.columnQueryConfig'),
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
            title: t('pages.system.datasets.columnEnabled'),
            dataIndex: 'is_active',
            render: (value: boolean) => (
              <Tag color={value ? 'success' : 'default'}>
                {value ? t('pages.system.datasets.enabled') : t('pages.system.datasets.disabled')}
              </Tag>
            ),
          },
          {
            title: t('pages.system.datasets.columnLastExecuted'),
            dataIndex: 'last_executed_at',
            valueType: 'dateTime',
          },
          {
            title: t('pages.system.datasets.columnLastError'),
            dataIndex: 'last_error',
            render: (value: string) => value ? (
              <Tag color="error">{value}</Tag>
            ) : '-',
          },
          {
            title: t('pages.system.datasets.columnCreatedAt'),
            dataIndex: 'created_at',
            valueType: 'dateTime',
          },
          {
            title: t('pages.system.datasets.columnUpdatedAt'),
            dataIndex: 'updated_at',
            valueType: 'dateTime',
          },
        ]}
      />

      {/* 执行查询结果 Modal */}
      <Modal
        title={t('pages.system.datasets.executeResultTitle')}
        open={executeVisible}
        onCancel={() => setExecuteVisible(false)}
        footer={[
          <Button key="close" onClick={() => setExecuteVisible(false)}>
            {t('pages.system.datasets.close')}
          </Button>,
        ]}
        width={1000}
      >
        {executeLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            {t('pages.system.datasets.executing')}
          </div>
        ) : executeResult ? (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Badge status={executeResult.success ? 'success' : 'error'} />
              <span>{executeResult.success ? t('pages.system.datasets.executeSuccessShort') : t('pages.system.datasets.executeFailedShort')}</span>
              <span>{t('pages.system.datasets.elapsedTime')}: {executeResult.elapsed_time}s</span>
              {executeResult.total !== undefined && (
                <span>{t('pages.system.datasets.totalRows')}: {executeResult.total}</span>
              )}
            </Space>
            {executeResult.error && (
              <div style={{ marginBottom: 16, padding: '8px', backgroundColor: '#fff2f0', borderRadius: '4px' }}>
                <Tag color="error">{t('pages.system.datasets.errorLabel')}: {executeResult.error}</Tag>
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
                {t('pages.system.datasets.emptyResult')}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default DatasetListPage;

