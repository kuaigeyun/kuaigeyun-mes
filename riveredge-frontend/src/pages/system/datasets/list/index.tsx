/**
 * 数据集管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的数据集。
 * 支持数据集的 CRUD 操作和查询执行功能。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormTextArea,
  ProFormSwitch,
  ProFormSelect,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Button, Tag, Space, Modal, Badge, Table, Descriptions } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlayCircleOutlined, CopyOutlined, HighlightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../components/uni-table';
import { flushDrawerOpen, ListPageTemplate, FormModalTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
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
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../utils/spreadsheetImportTemplate';
import {
  getDataConnectionsForDataset,
  IntegrationConfig,
} from '../../../../services/integrationConfig';
import { rowActionKind } from '../../../../components/uni-action';

/**
 * 数据集管理列表页面组件
 */
const DatasetListPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const datasetDetailReqRef = useRef(0);
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

  const datasetImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'name', required: true, labelKey: 'pages.system.datasets.importHeaderName' },
          { field: 'code', required: true, labelKey: 'pages.system.datasets.importHeaderCode' },
          {
            field: 'dataSourceUuid',
            required: true,
            labelKey: 'pages.system.datasets.importHeaderDataSourceUuid',
          },
          { field: 'queryType', required: true, labelKey: 'pages.system.datasets.importHeaderQueryType' },
          { field: 'description', labelKey: 'pages.system.datasets.importHeaderDescription', aliases: ['描述'] },
          { field: 'isActive', labelKey: 'pages.system.datasets.importHeaderEnabled', aliases: ['启用状态'] },
          {
            field: 'queryConfigJson',
            required: true,
            labelKey: 'pages.system.datasets.importHeaderQueryConfigJson',
            aliases: ['查询配置(JSON)'],
          },
        ],
        [
          t('pages.system.datasets.importExampleName'),
          'example_ds',
          'uuid-of-data-source',
          'sql',
          t('pages.system.datasets.importExampleDescription'),
          t('pages.system.datasets.importExampleEnabled'),
          t('pages.system.datasets.importExampleQueryConfigJson'),
        ],
      ),
    [t, i18n.language],
  );

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
        console.error(error);
        messageApi.error(
          error?.message || t('pages.system.datasets.loadDataConnectionsFailed'),
        );
      }
    };
    loadDataConnections();
  }, [messageApi, t]);

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
        output_type: detail.output_type ?? 'list',
        display_config: detail.display_config ? JSON.stringify(detail.display_config, null, 2) : '',
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
    const req = ++datasetDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const detail = await getDatasetByUuid(record.uuid);
      if (datasetDetailReqRef.current !== req) return;
      setDetailData(detail);
    } catch (error: any) {
      if (datasetDetailReqRef.current === req) {
        messageApi.error(error.message || t('pages.system.datasets.getDetailFailed'));
      }
    } finally {
      if (datasetDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  const datasetDetailDescColumns = useMemo<ProDescriptionsItemProps<Dataset>[]>(
    () => [
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
        render: (_, record) => {
          const value = String(record.data_source_uuid ?? '');
          const conn = dataConnectionsFlat.find((c) => c.uuid === value);
          return conn ? `${conn.name} (${conn.type})` : value;
        },
      },
      {
        title: t('pages.system.datasets.columnQueryType'),
        dataIndex: 'query_type',
        render: (_, record) => {
          const value = String(record.query_type ?? '');
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
        render: (_, record) => (
          <pre
            style={{
              margin: 0,
              padding: '8px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '300px',
              fontSize: 12,
            }}
          >
            {JSON.stringify(record.query_config ?? {}, null, 2)}
          </pre>
        ),
      },
      {
        title: t('pages.system.datasets.columnEnabled'),
        dataIndex: 'is_active',
        render: (_, record) => (
          <Tag color={record.is_active ? 'success' : 'default'}>
            {record.is_active ? t('pages.system.datasets.enabled') : t('pages.system.datasets.disabled')}
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
        render: (_, record) => (record.last_error ? <Tag color="error">{record.last_error}</Tag> : t('common.dash')),
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
    ],
    [t, dataConnectionsFlat]
  );

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
        const updateData: UpdateDatasetData = {
          name: values.name,
          code: String(values.code ?? '').trim(),
          description: values.description,
          is_active: values.is_active,
        };
        if (values.output_type) updateData.output_type = values.output_type;
        if (values.display_config) {
          try {
            updateData.display_config = JSON.parse(values.display_config);
          } catch {
            // 忽略无效 JSON
          }
        }
        await updateDataset(currentDatasetUuid, updateData);
        messageApi.success(t('pages.system.datasets.updateSuccess'));
        setModalVisible(false);
        setFormInitialValues(undefined);
        actionRef.current?.reload();
      } else {
        const createData: CreateDatasetData = {
          name: values.name,
          code: values.code,
          query_type: 'sql',
          query_config: {},
          description: values.description,
          data_source_uuid: values.data_source_uuid,
          is_active: values.is_active,
        };
        if (values.output_type) createData.output_type = values.output_type;
        if (values.display_config) {
          try {
            createData.display_config = JSON.parse(values.display_config);
          } catch {
            // 忽略无效 JSON
          }
        }
        const created = await createDataset(createData);
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
      title: t('pages.system.datasets.columnOutputType'),
      dataIndex: 'output_type',
      width: 120,
      hideInSearch: true,
      render: (_, record) => {
        const typeMap: Record<string, { color: string; text: string }> = {
          list: { color: 'default', text: t('pages.system.datasets.outputTypeList') },
          metric: { color: 'blue', text: t('pages.system.datasets.outputTypeMetric') },
          multi_metric: { color: 'green', text: t('pages.system.datasets.outputTypeMultiMetric') },
        };
        const ot = (record as any).output_type || 'list';
        const info = typeMap[ot] || { color: 'default', text: ot };
        return <Tag color={info.color}>{info.text}</Tag>;
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
      fixed: 'right',
      uniActionRenderOptions: { directMax: 5 },
      render: (_, record) => [
            <Button key="view" {...rowActionKind('read')} onClick={() => handleView(record)}>
              {t('pages.system.datasets.view')}
            </Button>,
            <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
              {t('pages.system.datasets.edit')}
            </Button>,
            <Button key="design" {...rowActionKind('update')} onClick={() => handleDesign(record)} data-action-priority={2}>
              {t('pages.system.datasets.design')}
            </Button>,
            <Button
              key="execute"
              {...rowActionKind('execute')}
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={executingUuid === record.uuid}
              onClick={() => handleExecute(record)}
            >
              {t('pages.system.datasets.executeQuery')}
            </Button>,
            <Button key="copy" {...rowActionKind('create')} onClick={() => handleCopy(record)}>
              {t('pages.system.datasets.copy')}
            </Button>,
            <Popconfirm
              key="delete"
              {...rowActionKind('delete')}
              title={t('pages.system.datasets.confirmDelete')}
              onConfirm={() => handleDelete(record)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                {t('pages.system.datasets.delete')}
              </Button>
            </Popconfirm>,
          ],
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Dataset>
          columnPersistenceId="pages.system.datasets.list"
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
            // 输出类型筛选
            if (searchFormValues?.output_type) {
              apiParams.output_type = searchFormValues.output_type;
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
              console.error(error);
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
                  <Button {...rowActionKind('update')} key="batch-enable" onClick={() => handleBatchStatus(true)}>{t('pages.system.datasets.batchEnable')}</Button>,
                  <Button {...rowActionKind('update')} key="batch-disable" onClick={() => handleBatchStatus(false)}>{t('pages.system.datasets.batchDisable')}</Button>,
                ]
              : []
          }
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning(t('pages.system.datasets.fillImportData'));
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').trim());
            const rows = data.slice(2).filter((row: any[]) =>
              row.some((c: any) => c != null && String(c).trim()),
            );
            const headerIndexMap = resolveFactoryImportHeaderIndexMap(
              headers,
              datasetImportTemplate.importHeaderMap,
            );
            const val = (row: any[], field: string) => {
              const idx = headerIndexMap[field];
              return idx !== undefined && row[idx] != null ? row[idx] : undefined;
            };
            let done = 0;
            const ts = Date.now();
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const name = val(row, 'name');
              const code = val(row, 'code');
              const dataSourceUuid = val(row, 'dataSourceUuid');
              if (name && code && dataSourceUuid) {
                let queryConfig: Record<string, any> = {};
                const queryConfigJson = val(row, 'queryConfigJson');
                if (queryConfigJson) {
                  try {
                    queryConfig = JSON.parse(String(queryConfigJson));
                  } catch {
                    queryConfig = {};
                  }
                }
                const queryTypeRaw = val(row, 'queryType');
                const queryType = queryTypeRaw === 'api' ? 'api' : 'sql';
                const isActiveRaw = val(row, 'isActive');
                await createDataset({
                  name: String(name),
                  code: `${String(code).replace(/[^a-z0-9_]/g, '_').slice(0, 30)}_${ts}${i}`,
                  data_source_uuid: String(dataSourceUuid),
                  query_type: queryType,
                  query_config: queryConfig,
                  description: val(row, 'description') ? String(val(row, 'description')) : undefined,
                  is_active:
                    isActiveRaw !== 'false' && isActiveRaw !== '0' && isActiveRaw !== '',
                });
                done++;
              }
            }
            messageApi.success(t('pages.system.datasets.importSuccess', { count: done }));
            actionRef.current?.reload();
          }}
          importHeaders={datasetImportTemplate.importHeaders}
          importExampleRow={datasetImportTemplate.importExampleRow}
          importFieldMap={datasetImportTemplate.importHeaderMap}
          showExportButton
          onExport={async (type, keys, pageData) => {
            let items: Dataset[] = [];
            if (type === 'selected' && keys?.length) {
              items = await Promise.all(keys.map((k) => getDatasetByUuid(String(k))));
            } else if (type === 'currentPage' && pageData?.length) {
              items = pageData;
            } else {
              const pageSize = 100;
              const collected: Dataset[] = [];
              let page = 1;
              const maxPages = 100;
              while (page <= maxPages) {
                const res = await getDatasetList({ page, page_size: pageSize });
                collected.push(...res.items);
                if (res.items.length < pageSize || collected.length >= res.total) break;
                page += 1;
              }
              items = collected;
            }
            if (items.length === 0) {
              messageApi.warning(t('pages.system.datasets.noDataToExport'));
              return;
            }
            const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = t('pages.system.datasets.exportFileName', {
              date: new Date().toISOString().slice(0, 10),
            });
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
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <ProFormText
          name="code"
          label={t('pages.system.datasets.labelCode')}
          rules={[
            { required: true, message: t('pages.system.datasets.codeRequired') },
            { pattern: /^[a-z0-9_]+$/, message: t('pages.system.datasets.codePattern') },
          ]}
          placeholder={t('pages.system.datasets.codePlaceholder')}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="name"
          label={t('pages.system.datasets.labelName')}
          rules={[{ required: true, message: t('pages.system.datasets.nameRequired') }]}
          placeholder={t('pages.system.datasets.namePlaceholder')}
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
        <ProFormSelect
          name="output_type"
          label={t('pages.system.datasets.labelOutputType')}
          initialValue="list"
          options={[
            { label: t('pages.system.datasets.outputTypeList'), value: 'list' },
            { label: t('pages.system.datasets.outputTypeMetric'), value: 'metric' },
            { label: t('pages.system.datasets.outputTypeMultiMetric'), value: 'multi_metric' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="display_config"
          label={t('pages.system.datasets.labelDisplayConfig')}
          placeholder={t('pages.system.datasets.displayConfigPlaceholder')}
          colProps={{ span: 24 }}
          fieldProps={{ rows: 4 }}
        />
        <ProFormTextArea
          name="description"
          label={t('pages.system.datasets.labelRemark')}
          placeholder={t('pages.system.datasets.remarkOptional')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch name="is_active" label={t('pages.system.datasets.labelEnabled')} colProps={{ span: 12 }} />
      </FormModalTemplate>

      {/* 查看详情 Drawer */}
      <UniDetail
        title={t('pages.system.datasets.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
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
        basic={
          detailData ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(datasetDetailDescColumns, detailData)} />
          ) : null
        }
      />

      {/* 执行查询结果 Modal */}
      <Modal
        title={t('pages.system.datasets.executeResultTitle')}
        open={executeVisible}
        onCancel={() => setExecuteVisible(false)}
        footer={[
          <Button {...rowActionKind('close')} key="close" onClick={() => setExecuteVisible(false)}>
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
