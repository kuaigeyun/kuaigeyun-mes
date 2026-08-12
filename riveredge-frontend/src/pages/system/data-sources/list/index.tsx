/**
 * 数据源管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的数据源。
 * 支持数据源的 CRUD 操作和连接测试功能。
 */

import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormSelect, ProFormDependency, ProFormDigit, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../../components/safe-pro-form-select';
import { App, Popconfirm, Tag, Space, Badge, Typography, Alert, Tooltip, Card, Button, theme, Descriptions } from 'antd';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderSystemActiveTag, renderSystemTypeMarker } from '../../utils/systemListPresentation';
import { DeleteOutlined, EyeOutlined, DatabaseOutlined, ThunderboltOutlined, EditOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { rowActionKind } from '../../../../components/uni-action';
import { flushDrawerOpen, ListPageTemplate, FormModalTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../components/uni-detail';
import DataSourceConnectorMarket from '../DataSourceConnectorMarket';
import DatabaseBrandIcon from '../DatabaseBrandIcon';
import type { ConnectorDefinition } from '../connectors';
import {
  getDataSourceTypeSelectOptions,
  getDataSourceTypeDisplay,
  CONNECTOR_DEFINITIONS,
  DATA_SOURCE_STANDARD_DB_FORM_TYPES,
  DATA_SOURCE_SEARCH_FORM_TYPES,
} from '../connectors';
import {
  getDataSourceList,
  getDataSourceListAllMatching,
  getDataSourceByUuid,
  createDataSource,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  testDataSourceConfig,
  ensureSystemDefaultDataSource,
  DataSource,
  CreateDataSourceData,
  UpdateDataSourceData,
} from '../../../../services/dataSource';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../utils/spreadsheetImportTemplate';

type DataSourceDetail = DataSource & { related_datasets?: unknown[] };

function coerceImportedDataSourceType(raw: string): string {
  const lower = String(raw).trim().toLowerCase();
  const aliasMap: Record<string, string> = {
    postgres: 'postgresql',
    mongo: 'mongodb',
    mssql: 'sqlserver',
    mariadb: 'mariadb',
    presto: 'trino',
    prestosql: 'trino',
    es: 'elasticsearch',
  };
  if (aliasMap[lower]) return aliasMap[lower];
  const known = CONNECTOR_DEFINITIONS.find((c) => c.type === lower);
  if (known) return known.type;
  return 'postgresql';
}
import { getDatasetList } from '../../../../services/dataset';
import { updateIntegrationConfig } from '../../../../services/integrationConfig';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { extractProTableSort, mergeListKeyword, mapIntegrationConfigListSortField } from '../../../../utils/tableQueryKey';
import { downloadRecordsAsXlsx } from '../../../../utils/exportRecordsXlsx';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { useToken } = theme;

/**
 * 获取数据源类型展示（filled Tag 颜色与文案）
 */
const getTypeInfo = (type: string) => ({
  ...getDataSourceTypeDisplay(type),
  icon: <DatabaseBrandIcon typeOrId={type} size={14} />,
});

type TFunction = (key: string) => string;

/**
 * 获取连接状态显示（需传入 t 以支持 i18n）
 */
const getConnectionStatus = (dataSource: DataSource, t: TFunction): { status: 'success' | 'error' | 'warning' | 'default'; text: string } => {
  if (!dataSource.is_active) {
    return { status: 'default', text: t('pages.system.dataSources.statusDisabled') };
  }
  if (dataSource.is_connected) {
    return { status: 'success', text: t('pages.system.dataSources.statusConnected') };
  }
  if (dataSource.last_error) {
    return { status: 'error', text: t('pages.system.dataSources.statusFailed') };
  }
  return { status: 'warning', text: t('pages.system.dataSources.statusNotConnected') };
};

/**
 * 数据源管理列表页面组件
 */
const DataSourceListPage: React.FC = () => {
  const { t, i18n } = useTranslation();

  const dataSourceImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'name',
            required: true,
            labelKey: 'pages.system.dataSources.labelName',
            aliases: ['数据源名称'],
          },
          {
            field: 'code',
            required: true,
            labelKey: 'pages.system.dataSources.labelCode',
            aliases: ['数据源代码'],
          },
          {
            field: 'type',
            required: true,
            labelKey: 'pages.system.dataSources.labelType',
            aliases: ['数据源类型'],
          },
          {
            field: 'description',
            labelKey: 'pages.system.dataSources.columnDescription',
            aliases: ['备注', '描述'],
          },
          {
            field: 'is_active',
            labelKey: 'pages.system.dataSources.columnActive',
            aliases: ['启用状态'],
          },
          {
            field: 'config_json',
            labelKey: 'pages.system.dataSources.detailColumnConfig',
            aliases: ['连接配置(JSON)'],
          },
        ],
        [
          t('pages.system.dataSources.importExampleName'),
          t('pages.system.dataSources.importExampleCode'),
          t('pages.system.dataSources.importExampleType'),
          '',
          t('pages.system.dataSources.enabled'),
          t('pages.system.dataSources.importExampleConfig'),
        ],
      ),
    [t, i18n.language],
  );
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const actionRef = useRef<ActionType>(null);
  const dataSourceDetailReqRef = useRef(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentDataSourceUuid, setCurrentDataSourceUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<DataSourceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [ensuringDefault, setEnsuringDefault] = useState(false);
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
   * 加载系统默认数据源（应用主库）
   */
  const handleEnsureSystemDefault = async () => {
    try {
      setEnsuringDefault(true);
      const result = await ensureSystemDefaultDataSource();
      if (result.created) {
        messageApi.success(t('pages.system.dataSources.loadDefaultSuccessCreated'));
      } else if (result.restored) {
        messageApi.success(t('pages.system.dataSources.loadDefaultSuccessRestored'));
      } else {
        messageApi.info(t('pages.system.dataSources.loadDefaultAlreadyExists'));
      }
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.dataSources.loadDefaultFailed'));
    } finally {
      setEnsuringDefault(false);
    }
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
      messageApi.error(error.message || t('pages.system.dataSources.getDetailFailed'));
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: DataSource) => {
    const req = ++dataSourceDetailReqRef.current;
    flushDrawerOpen(() => {
      setDrawerVisible(true);
      setDetailData(null);
      setDetailLoading(true);
    });
    try {
      const [detail, dsList] = await Promise.all([
        getDataSourceByUuid(record.uuid),
        getDatasetList({ data_source_uuid: record.uuid, page_size: 50 }),
      ]);
      if (dataSourceDetailReqRef.current !== req) return;
      setDetailData({ ...detail, related_datasets: dsList.items } as DataSourceDetail);
    } catch (error: any) {
      if (dataSourceDetailReqRef.current === req) {
        messageApi.error(error.message || t('pages.system.dataSources.getDetailFailed'));
      }
    } finally {
      if (dataSourceDetailReqRef.current === req) {
        setDetailLoading(false);
      }
    }
  };

  /**
   * 批量启用/禁用
   */
  const handleBatchStatus = async (enable: boolean) => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.dataSources.selectToOperate'));
      return;
    }
    try {
      let done = 0;
      for (const uuid of selectedRowKeys) {
        await updateIntegrationConfig(String(uuid), { is_active: enable });
        done++;
      }
      const action = enable ? t('pages.system.dataSources.enabled') : t('pages.system.dataSources.disabled');
      messageApi.success(t('pages.system.dataSources.batchStatusSuccess', { action, count: done }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.dataSources.operationFailed'));
    }
  };

  /**
   * 批量测试连接
   */
  const handleBatchTest = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning(t('pages.system.dataSources.selectToTest'));
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
    messageApi.info(t('pages.system.dataSources.testComplete', { ok, fail }));
    actionRef.current?.reload();
  };

  /**
   * 处理删除数据源
   */
  const handleDelete = async (record: DataSource) => {
    try {
      await deleteDataSource(record.uuid);
      messageApi.success(t('pages.system.dataSources.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataSources.deleteFailed'));
    }
  };

  /**
   * 批量删除数据源
   */
  const handleBatchDelete = async (keys: React.Key[]) => {
    try {
      let done = 0;
      let fail = 0;
      for (const uuid of keys) {
        try {
          await deleteDataSource(String(uuid));
          done++;
        } catch {
          fail++;
        }
      }
      if (fail > 0) {
        messageApi.warning(t('pages.system.dataSources.batchDeleteDone', { done, fail }));
      } else {
        messageApi.success(t('pages.system.dataSources.batchDeleteSuccessCount', { count: done }));
      }
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.dataSources.batchDeleteFailed'));
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
        if (result.verification_level === 'config_only') {
          messageApi.warning(result.message || t('pages.system.dataSources.testSuccess'));
        } else {
          messageApi.success(result.message || t('pages.system.dataSources.testSuccess'));
        }
      } else {
        messageApi.error(result.message || t('pages.system.dataSources.testFailed'));
      }
    } catch (error: any) {
      if (error?.errorFields) {
        messageApi.warning(t('pages.system.dataSources.fillConfigFirst'));
      } else {
        messageApi.error(error?.message || t('pages.system.dataSources.testFailed'));
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
        if (result.verification_level === 'config_only') {
          messageApi.warning(result.message || t('pages.system.dataSources.testSuccess'));
        } else {
          messageApi.success(result.message || t('pages.system.dataSources.testSuccess'));
        }
      } else {
        messageApi.error(result.message || t('pages.system.dataSources.testFailed'));
      }
      actionRef.current?.reload();
    } catch (error: any) {
       messageApi.error(error.message || t('pages.system.dataSources.testFailed'));
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
      if (config.username !== undefined && [...DATA_SOURCE_STANDARD_DB_FORM_TYPES, ...DATA_SOURCE_SEARCH_FORM_TYPES, 'oracle', 'sqlserver'].includes(type)) {
        config.user = config.username;
      }
      if (type === 'sqlserver') {
        if (config.encryption === '' || config.encryption === undefined || config.encryption === null) {
          delete config.encryption;
        }
        if (config.tds_version === '' || config.tds_version === undefined || config.tds_version === null) {
          delete config.tds_version;
        }
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
        messageApi.success(t('pages.system.dataSources.updateSuccess'));
      } else {
        await createDataSource({
          name,
          code,
          type,
          description,
          config,
          is_active,
        } as CreateDataSourceData);
        messageApi.success(t('pages.system.dataSources.createSuccess'));
      }
      
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataSources.operationFailed'));
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
      { title: t('pages.system.dataSources.statTotal'), value: stats.total, valueStyle: { color: '#1890ff' } },
      { title: t('pages.system.dataSources.statConnected'), value: stats.connected, valueStyle: { color: '#52c41a' } },
      { title: t('pages.system.dataSources.statDisconnected'), value: stats.disconnected, valueStyle: { color: '#ff4d4f' } },
      { title: t('pages.system.dataSources.statInactive'), value: stats.inactive, valueStyle: { color: '#faad14' } },
    ];
  }, [allDataSources, t]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (dataSource: DataSource) => {
    const typeInfo = getTypeInfo(dataSource.type);
    const connectionStatus = getConnectionStatus(dataSource, t);
    
    return (
      <Card
        key={dataSource.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip {...rowActionKind('read')} key="view" title={t('pages.system.dataSources.viewDetail')}>
            <EyeOutlined
              onClick={() => handleView(dataSource)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          ...(dataSource.is_editable !== false ? [
            <Tooltip {...rowActionKind('update')} key="edit" title={t('pages.system.dataSources.editDataSource')}>
              <EditOutlined
                onClick={() => handleEdit(dataSource)}
                style={{ fontSize: 16 }}
              />
            </Tooltip>,
          ] : []),
          <Tooltip {...rowActionKind('read')} key="test" title={t('pages.system.dataSources.testConnection')}>
            <ThunderboltOutlined
              onClick={() => handleTestConnection(dataSource)}
              style={{ fontSize: 16, color: '#1890ff' }}
            />
          </Tooltip>,
          ...(dataSource.is_editable !== false ? [
            <Popconfirm {...rowActionKind('delete')}
              key="delete"
              title={t('pages.system.dataSources.deleteConfirmTitle')}
              onConfirm={() => handleDelete(dataSource)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Tooltip title={t('pages.system.dataSources.deleteTooltip')}>
                <DeleteOutlined
                  style={{ fontSize: 16, color: '#ff4d4f' }}
                />
              </Tooltip>
            </Popconfirm>,
          ] : []),
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <Space size="small">
                <Text strong style={{ fontSize: 16 }}>
                  {dataSource.name}
                </Text>
                {dataSource.is_system_default && (
                  <Tag color="blue">{t('pages.system.dataSources.systemDefault', '系统默认')}</Tag>
                )}
              </Space>
              <Tag color={typeInfo.color} variant="filled" icon={typeInfo.icon}>
                {typeInfo.text}
              </Tag>
            </div>
            
            {dataSource.code && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('pages.system.dataSources.codePrefix')}{dataSource.code}
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
        
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataSources.connectionStatusLabel')}</Text>
              <Badge
                status={connectionStatus.status}
                text={connectionStatus.text}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataSources.statusLabel')}</Text>
              <Tag color={dataSource.is_active ? 'success' : 'default'}>
                {dataSource.is_active ? t('pages.system.dataSources.enabled') : t('pages.system.dataSources.disabled')}
              </Tag>
            </div>
            
            {dataSource.last_connected_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataSources.lastConnectedLabel')}</Text>
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
  const columns = useMemo<ProColumns<DataSource>[]>(() => alignProColumns([
    {
      title: t('pages.system.dataSources.columnName'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
      render: (_, record) => (
        <Space size="small">
          <span>{record.name}</span>
          {record.is_system_default && (
            renderSystemTypeMarker(t('pages.system.dataSources.systemDefault', '系统默认'), 'processing')
          )}
        </Space>
      ),
    },
    {
      title: t('pages.system.dataSources.columnCode'),
      dataIndex: 'code',
      width: 150,
      minWidth: 150,
      uniTableKeepWidth: true,
      resizable: false,
    },
    {
      title: t('pages.system.dataSources.columnType'),
      dataIndex: 'type',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'select',
      valueEnum: Object.fromEntries(
        CONNECTOR_DEFINITIONS.map((c) => [c.type, { text: c.name }]),
      ),
      render: (_, record) => {
        const typeInfo = getTypeInfo(record.type);
        return renderSystemTypeMarker(typeInfo.text, typeInfo.color);
      },
    },
    {
      title: t('pages.system.dataSources.columnDescription'),
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('pages.system.dataSources.columnConnectionStatus'),
      dataIndex: 'is_connected',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.dataSources.statusConnected'), status: 'Success' },
        false: { text: t('pages.system.dataSources.statusNotConnected'), status: 'Default' },
      },
      render: (_, record) => (
        <Space>
          {record.is_connected ? (
            <Badge status="success" text={t('pages.system.dataSources.statusConnected')} />
          ) : (
            <Badge status="default" text={t('pages.system.dataSources.statusNotConnected')} />
          )}
          {record.last_error && (
            renderSystemTypeMarker(t('pages.system.dataSources.errorTag'), 'error')
          )}
        </Space>
      ),
    },
    {
      title: t('pages.system.dataSources.columnActive'),
      dataIndex: 'is_active',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.dataSources.enabled'), status: 'Success' },
        false: { text: t('pages.system.dataSources.disabled'), status: 'Default' },
      },
      render: (_, record) =>
        renderSystemActiveTag(t, record.is_active, 'pages.system.dataSources.enabled', 'pages.system.dataSources.disabled'),
    },
    {
      title: t('pages.system.dataSources.columnLastConnected'),
      dataIndex: 'last_connected_at',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.dataSources.columnCreatedAt'),
      dataIndex: 'created_at',
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: t('pages.system.dataSources.columnActions'),
      key: 'action',
      valueType: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const actions: React.ReactNode[] = [
          <Button
            key="view"
            {...rowActionKind('read')}
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('pages.system.dataSources.view')}
          </Button>,
        ];
        if (record.is_editable !== false) {
          actions.push(
            <Button
              key="edit"
              {...rowActionKind('update')}
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              {t('pages.system.dataSources.edit')}
            </Button>,
          );
        }
        actions.push(
          <Button
            key="test"
            {...rowActionKind('read')}
            type="link"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={() => handleTestConnection(record)}
          >
            {t('pages.system.dataSources.testConnection')}
          </Button>,
        );
        if (record.is_editable !== false) {
          actions.push(
            <Popconfirm
              key="delete"
              {...rowActionKind('delete')}
              title={t('pages.system.dataSources.deleteConfirmTitle')}
              onConfirm={() => handleDelete(record)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" size="small" icon={<DeleteOutlined />} danger>
                {t('pages.system.dataSources.delete')}
              </Button>
            </Popconfirm>,
          );
        }
        return actions;
      },
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [t, handleView, handleEdit, handleTestConnection, handleDelete]);

  /**
   * 详情列定义
   */
  const detailColumns = [
    {
      title: t('pages.system.dataSources.detailColumnName'),
      dataIndex: 'name',
      render: (_, record: DataSource) => (
        <Space size="small">
          <span>{record.name}</span>
          {record.is_system_default && (
            <Tag color="blue">{t('pages.system.dataSources.systemDefault', '系统默认')}</Tag>
          )}
        </Space>
      ),
    },
    { title: t('pages.system.dataSources.detailColumnCode'), dataIndex: 'code' },
    {
      title: t('pages.system.dataSources.detailColumnType'),
      dataIndex: 'type',
      render: (_, record: DataSource) => {
        const value = record.type;
        const typeInfo = getTypeInfo(value);
        return <Tag color={typeInfo.color} variant="filled">{typeInfo.text}</Tag>;
      },
    },
    { title: t('pages.system.dataSources.detailColumnDescription'), dataIndex: 'description' },
    {
      title: t('pages.system.dataSources.detailColumnRelatedDatasets'),
      dataIndex: 'related_datasets',
      render: (_, record: DataSourceDetail) => {
        const list = (record.related_datasets || []) as unknown[];
        if (list.length === 0) return <span style={{ color: '#999' }}>{t('pages.system.dataSources.noDatasets')}</span>;
        return (
          <Space orientation="vertical" size={4}>
            {list.slice(0, 10).map((d: any) => (
              <Tag key={d.uuid}>{d.name} ({d.code})</Tag>
            ))}
            {list.length > 10 && <span style={{ color: '#999' }}>{t('pages.system.dataSources.andMoreCount', { count: list.length })}</span>}
          </Space>
        );
      },
    },
    {
      title: t('pages.system.dataSources.detailColumnConfig'),
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
      title: t('pages.system.dataSources.detailColumnConnectionStatus'),
      dataIndex: 'is_connected',
      render: (value: boolean) => (
        <Space>
          {value ? (
            <Badge status="success" text={t('pages.system.dataSources.statusConnected')} />
          ) : (
            <Badge status="default" text={t('pages.system.dataSources.statusNotConnected')} />
          )}
        </Space>
      ),
    },
    {
      title: t('pages.system.dataSources.detailColumnActive'),
      dataIndex: 'is_active',
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'default'}>
          {value ? t('pages.system.dataSources.enabled') : t('pages.system.dataSources.disabled')}
        </Tag>
      ),
    },
    { title: t('pages.system.dataSources.detailColumnLastConnected'), dataIndex: 'last_connected_at', valueType: 'dateTime' },
    {
      title: t('pages.system.dataSources.detailColumnLastError'),
      dataIndex: 'last_error',
      render: (value: any) => value ? <Tag color="error">{value}</Tag> : '-',
    },
    { title: t('pages.system.dataSources.detailColumnCreatedAt'), dataIndex: 'created_at', valueType: 'dateTime' },
    { title: t('pages.system.dataSources.detailColumnUpdatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<DataSource>
          columnPersistenceId="pages.system.data-sources.list-v1"
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            const { sortBy, sortOrder } = extractProTableSort(sort);
            const apiParams: any = {
              page: params.current || 1,
              page_size: params.pageSize || 20,
              sort_by: mapIntegrationConfigListSortField(sortBy),
              sort_order: sortOrder,
            };

            const kw = mergeListKeyword(searchFormValues, 'search');
            if (kw) {
              apiParams.search = kw;
            }

            if (searchFormValues?.type) {
              apiParams.type = searchFormValues.type;
            }

            if (searchFormValues?.is_active !== undefined && searchFormValues.is_active !== '' && searchFormValues.is_active !== null) {
              apiParams.is_active = searchFormValues.is_active;
            }

            try {
              const [result, wideItems] = await Promise.all([
                getDataSourceList(apiParams),
                getDataSourceListAllMatching({
                  search: apiParams.search,
                  type: apiParams.type,
                  is_active: apiParams.is_active,
                }),
              ]);
              setAllDataSources(wideItems);

              return {
                data: result.items,
                success: true,
                total: result.total,
              };
            } catch (error: any) {
              console.error('获取数据源列表失败:', error);
              messageApi.error(error?.message || t('pages.system.dataSources.loadListFailed'));
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
          createButtonText={t('pages.system.dataSources.createButton')}
          toolBarActionsAfterCreate={[
            <Button
              {...rowActionKind('create')}
              key="ensure-system-default"
              icon={<DatabaseOutlined />}
              loading={ensuringDefault}
              onClick={handleEnsureSystemDefault}
            >
              {t('pages.system.dataSources.loadDefault')}
            </Button>,
          ]}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          rowSelectionGetCheckboxProps={(record) =>
            record.is_system_default ? { disabled: true } : {}
          }
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('pages.system.dataSources.batchDelete')}
          deleteConfirmTitle={t('pages.system.dataSources.batchDeleteTitle')}
          deleteConfirmDescription={(c) => t('pages.system.dataSources.batchDeleteDescription', { count: c })}
          toolBarRender={() =>
            selectedRowKeys.length > 0
              ? [
                  <Button {...rowActionKind('read')} key="batch-test" onClick={handleBatchTest}>{t('pages.system.dataSources.batchTest')}</Button>,
                  <Button {...rowActionKind('update')} key="batch-enable" onClick={() => handleBatchStatus(true)}>{t('pages.system.dataSources.batchEnable')}</Button>,
                  <Button {...rowActionKind('update')} key="batch-disable" onClick={() => handleBatchStatus(false)}>{t('pages.system.dataSources.batchDisable')}</Button>,
                ]
              : []
          }
          showImportButton
          onImport={async (data) => {
            if (!data || data.length < 2) {
              messageApi.warning(t('pages.system.dataSources.fillImportData'));
              return;
            }
            const headers = (data[0] || []).map((h: any) => String(h || '').trim());
            const headerIndexMap = resolveFactoryImportHeaderIndexMap(
              headers,
              dataSourceImportTemplate.importHeaderMap,
            );
            const rows = data.slice(2).filter((row: any[]) =>
              row?.some((c: any) => c != null && String(c).trim() !== ''),
            );
            let done = 0;
            const ts = Date.now();
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              const obj: Record<string, any> = {};
              for (const [field, idx] of Object.entries(headerIndexMap)) {
                if (row[idx] != null) obj[field] = row[idx];
              }
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
                  type: coerceImportedDataSourceType(String(obj.type)),
                  config,
                  description: obj.description ? String(obj.description) : undefined,
                  is_active: obj.is_active !== 'false' && obj.is_active !== '0' && obj.is_active !== '',
                });
                done++;
              }
            }
            messageApi.success(t('pages.system.dataSources.importSuccessCount', { count: done }));
            actionRef.current?.reload();
          }}
          importHeaders={dataSourceImportTemplate.importHeaders}
          importExampleRow={dataSourceImportTemplate.importExampleRow}
          importFieldMap={dataSourceImportTemplate.importHeaderMap}
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
              messageApi.warning(t('pages.system.dataSources.noDataToExport'));
              return;
            }
            await downloadRecordsAsXlsx(
              items as Array<Record<string, unknown>>,
              `data-sources-${new Date().toISOString().slice(0, 10)}.xlsx`,
            );
            messageApi.success(t('pages.system.dataSources.exportSuccess'));
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
        title={isEdit ? t('pages.system.dataSources.modalEdit') : t('pages.system.dataSources.modalCreate')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid
        extraFooter={
          <Button
            type="default"
            icon={<ThunderboltOutlined />}
            loading={testingConnection}
            onClick={handleTestConnectionInForm}
          >
            {t('pages.system.dataSources.testConnection')}
          </Button>
        }
      >
        <ProFormText
          name="code"
          label={t('pages.system.dataSources.labelCode')}
          rules={[
            { required: true, message: t('pages.system.dataSources.codeRequired') },
            { pattern: /^[a-z0-9_]+$/, message: t('pages.system.dataSources.codePattern') },
          ]}
          placeholder={t('pages.system.dataSources.codePlaceholder')}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="name"
          label={t('pages.system.dataSources.labelName')}
          rules={[{ required: true, message: t('pages.system.dataSources.nameRequired') }]}
          placeholder={t('pages.system.dataSources.namePlaceholder')}
          colProps={{ span: 12 }}
        />
        <SafeProFormSelect
          name="type"
          label={t('pages.system.dataSources.labelType')}
          rules={[{ required: true, message: t('pages.system.dataSources.typeRequired') }]}
          options={getDataSourceTypeSelectOptions()}
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormDependency name={['type']}>
            {({ type }) => {
              if (!type) return null;

              if (type === 'sqlserver') {
                return (
                  <>
                    <ProFormText
                      name="host"
                      label={t('pages.system.dataSources.labelHost')}
                      placeholder={t('pages.system.dataSources.sqlserverHostPlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.hostRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormSelect
                      name="encryption"
                      label={t('pages.system.dataSources.labelSqlServerEncryption')}
                      tooltip={t('pages.system.dataSources.sqlserverEncryptionTooltip')}
                      allowClear
                      options={[
                        { label: t('pages.system.dataSources.sqlserverEncryptionDefault'), value: '' },
                        { label: t('pages.system.dataSources.sqlserverEncryptionOff'), value: 'off' },
                        { label: t('pages.system.dataSources.sqlserverEncryptionRequest'), value: 'request' },
                        { label: t('pages.system.dataSources.sqlserverEncryptionRequire'), value: 'require' },
                        { label: t('pages.system.dataSources.sqlserverEncryptionDriverDefault'), value: 'default' },
                      ]}
                      fieldProps={{ optionFilterProp: 'label' }}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit name="port" hidden initialValue={1433} />
                    <ProFormText
                      name="database"
                      label={t('pages.system.dataSources.labelDatabase')}
                      placeholder={t('pages.system.dataSources.databasePlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.databaseRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText
                      name="username"
                      label={t('pages.system.dataSources.labelUsername')}
                      placeholder={t('pages.system.dataSources.usernamePlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.usernameRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText.Password
                      name="password"
                      label={t('pages.system.dataSources.labelPassword')}
                      placeholder={t('pages.system.dataSources.passwordPlaceholder')}
                      colProps={{ span: 12 }}
                    />
                    <ProFormSelect
                      name="tds_version"
                      label={t('pages.system.dataSources.labelSqlServerTdsVersion')}
                      tooltip={t('pages.system.dataSources.sqlserverTdsVersionTooltip')}
                      allowClear
                      options={[
                        { label: t('pages.system.dataSources.sqlserverTdsDefault'), value: '' },
                        { label: '7.0', value: '7.0' },
                        { label: '7.1', value: '7.1' },
                        { label: '7.2', value: '7.2' },
                        { label: '7.3', value: '7.3' },
                        { label: '7.4', value: '7.4' },
                        { label: '8.0', value: '8.0' },
                      ]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="login_timeout"
                      label={t('pages.system.dataSources.labelSqlServerLoginTimeout')}
                      tooltip={t('pages.system.dataSources.sqlserverLoginTimeoutTooltip')}
                      initialValue={15}
                      fieldProps={{ min: 1, max: 120, precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              if ([...DATA_SOURCE_STANDARD_DB_FORM_TYPES, 'oracle'].includes(type)) {
                return (
                  <>
                    <ProFormText
                      name="host"
                      label={t('pages.system.dataSources.labelHost')}
                      placeholder={t('pages.system.dataSources.hostPlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.hostRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="port"
                      label={t('pages.system.dataSources.labelPort')}
                      placeholder={
                        type === 'mysql' || type === 'mariadb' ? '3306' :
                        type === 'postgresql' || type === 'timescaledb' ? '5432' :
                        type === 'oracle' ? '1521' :
                        type === 'clickhouse' ? '8123' :
                        type === 'doris' || type === 'starrocks' ? '9030' :
                        type === 'influxdb' ? '8086' :
                        type === 'tidb' ? '4000' :
                        type === 'oceanbase' ? '2881' :
                        type === 'opengauss' || type === 'gaussdb' ? '5432' :
                        type === 'dameng' ? '5236' :
                        type === 'kingbase' ? '54321' :
                        type === 'gbase' ? '5258' :
                        type === 'sequoiadb' ? '11810' :
                        type === 'tdengine' ? '6030' :
                        type === 'couchbase' ? '8091' :
                        type === 'druid' ? '8082' :
                        type === 'trino' ? '8080' :
                        type === 'milvus' ? '19530' :
                        '5432'
                      }
                      rules={[{ required: true, message: t('pages.system.dataSources.portRequired') }]}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText
                      name="database"
                      label={t('pages.system.dataSources.labelDatabase')}
                      placeholder={t('pages.system.dataSources.databasePlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.databaseRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText
                      name="username"
                      label={t('pages.system.dataSources.labelUsername')}
                      placeholder={t('pages.system.dataSources.usernamePlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.usernameRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText.Password
                      name="password"
                      label={t('pages.system.dataSources.labelPassword')}
                      placeholder={t('pages.system.dataSources.passwordPlaceholder')}
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
                      label={t('pages.system.dataSources.labelHost')}
                      placeholder={t('pages.system.dataSources.hostPlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.hostRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="port"
                      label={t('pages.system.dataSources.labelPort')}
                      placeholder="27017"
                      rules={[{ required: true, message: t('pages.system.dataSources.portRequired') }]}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText
                      name="database"
                      label={t('pages.system.dataSources.labelDatabase')}
                      placeholder="admin"
                      rules={[{ required: true, message: t('pages.system.dataSources.databaseRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <SafeProFormSelect
                      name="auth_source"
                      label={t('pages.system.dataSources.labelAuthSource')}
                      options={[{ label: 'admin', value: 'admin' }, { label: 'default', value: 'default' }]}
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              if (type === 'redis' || type === 'keydb') {
                return (
                  <>
                    <ProFormText
                      name="host"
                      label={t('pages.system.dataSources.labelHost')}
                      placeholder={t('pages.system.dataSources.hostPlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.hostRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="port"
                      label={t('pages.system.dataSources.labelPort')}
                      placeholder="6379"
                      rules={[{ required: true, message: t('pages.system.dataSources.portRequired') }]}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText.Password
                      name="password"
                      label={t('pages.system.dataSources.labelPassword')}
                      placeholder={t('pages.system.dataSources.passwordPlaceholderShort')}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="db"
                      label={t('pages.system.dataSources.labelDbIndex')}
                      initialValue={0}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              if ((DATA_SOURCE_SEARCH_FORM_TYPES as readonly string[]).includes(type)) {
                return (
                  <>
                    <ProFormText
                      name="host"
                      label={t('pages.system.dataSources.labelHost')}
                      placeholder={t('pages.system.dataSources.hostPlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.hostRequired') }]}
                      colProps={{ span: 18 }}
                    />
                    <ProFormDigit
                      name="port"
                      label={t('pages.system.dataSources.labelPort')}
                      placeholder="9200"
                      initialValue={9200}
                      rules={[{ required: true, message: t('pages.system.dataSources.portRequired') }]}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 6 }}
                    />
                    <ProFormText
                      name="username"
                      label={t('pages.system.dataSources.labelUsername')}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText.Password
                      name="password"
                      label={t('pages.system.dataSources.labelPassword')}
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              if (type === 'sqlite') {
                return (
                  <ProFormText
                    name="file_path"
                    label={t('pages.system.dataSources.labelFilePath')}
                    placeholder={t('pages.system.dataSources.filePathPlaceholder')}
                    rules={[{ required: true, message: t('pages.system.dataSources.filePathRequired') }]}
                    colProps={{ span: 24 }}
                  />
                );
              }

              if (type === 'prometheus' || type === 'memcached' || type === 'etcd' || type === 'chroma') {
                return (
                  <>
                    <ProFormText
                      name="host"
                      label={t('pages.system.dataSources.labelHost')}
                      placeholder={t('pages.system.dataSources.hostPlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.hostRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="port"
                      label={t('pages.system.dataSources.labelPort')}
                      placeholder={
                        type === 'prometheus' ? '9090' :
                        type === 'memcached' ? '11211' :
                        type === 'etcd' ? '2379' : '8000'
                      }
                      rules={[{ required: true, message: t('pages.system.dataSources.portRequired') }]}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              if (type === 'qdrant' || type === 'weaviate') {
                return (
                  <>
                    <ProFormText
                      name="host"
                      label={t('pages.system.dataSources.labelHost')}
                      placeholder={t('pages.system.dataSources.hostPlaceholder')}
                      rules={[{ required: true, message: t('pages.system.dataSources.hostRequired') }]}
                      colProps={{ span: 12 }}
                    />
                    <ProFormDigit
                      name="port"
                      label={t('pages.system.dataSources.labelPort')}
                      placeholder={type === 'qdrant' ? '6333' : '8080'}
                      rules={[{ required: true, message: t('pages.system.dataSources.portRequired') }]}
                      fieldProps={{ precision: 0, style: { width: '100%' } }}
                      colProps={{ span: 12 }}
                    />
                    <ProFormText.Password
                      name="api_key"
                      label={t('pages.system.dataSources.labelApiKey')}
                      colProps={{ span: 24 }}
                    />
                  </>
                );
              }

              return (
                <Alert title={t('pages.system.dataSources.typeFormNotSupported', { type })} type="info" />
              );
            }}
          </ProFormDependency>
        <ProFormTextArea
          name="description"
          label={t('pages.system.dataSources.labelDescription')}
          placeholder={t('pages.system.dataSources.descriptionPlaceholder')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
        <ProFormSwitch name="is_active" label={t('pages.system.dataSources.labelActive')} colProps={{ span: 12 }} />
      </FormModalTemplate>

      {/* 连接器市场 */}
      <DataSourceConnectorMarket
        open={connectorMarketVisible}
        onClose={() => setConnectorMarketVisible(false)}
        onSelect={handleConnectorSelect}
      />

      {/* 查看详情 Drawer */}
      <UniDetail
        title={t('pages.system.dataSources.detailTitle')}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        basic={
          detailData ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns as any, detailData)} />
          ) : null
        }
        extra={
          detailData && (
            <Space>
              {detailData.is_editable !== false && (
                <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(detailData); }}>
                  {t('pages.system.dataSources.edit')}
                </Button>
              )}
              <Button icon={<ThunderboltOutlined />} onClick={() => handleTestConnection(detailData)}>
                {t('pages.system.dataSources.testConnection')}
              </Button>
              {detailData.is_editable !== false && (
                <Popconfirm
                  title={t('pages.system.dataSources.deleteConfirmTitle')}
                  onConfirm={() => { handleDelete(detailData); setDrawerVisible(false); }}
                  okText={t('common.confirm')}
                  cancelText={t('common.cancel')}
                >
                  <Button danger icon={<DeleteOutlined />}>{t('pages.system.dataSources.delete')}</Button>
                </Popconfirm>
              )}
            </Space>
          )
        }
      />
    </>
  );
};

export default DataSourceListPage;
