/**
 * 数据备份页面
 * 
 * 用于查看和管理系统数据备份。
 * 支持创建备份、恢复备份、删除备份等功能。
 */

import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { App, Card, Tag, Space, message, Modal, Descriptions, Popconfirm, Button, Badge, Typography, Alert, Progress, Tooltip, theme } from 'antd';
import { EyeOutlined, PlusOutlined, ReloadOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../components/layout-templates';
import {
  getBackups,
  createBackup,
  getBackupDetail,
  restoreBackup,
  deleteBackup,
  downloadBackup,
  DataBackup,
  DataBackupListResponse,
  CreateDataBackupData,
} from '../../../services/dataBackup';
import { useGlobalStore } from '../../../stores';
import dayjs from 'dayjs';

const { Text } = Typography;
const { useToken } = theme;

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};


/**
 * 数据备份页面组件
 */
const DataBackupsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const actionRef = React.useRef<ActionType>(null);

  const getStatusInfo = (status: string): { status: 'success' | 'error' | 'processing' | 'default'; text: string } => {
    const statusMap: Record<string, { status: 'success' | 'error' | 'processing' | 'default'; text: string }> = {
      pending: { status: 'default', text: t('pages.system.dataBackups.statusPending') },
      running: { status: 'processing', text: t('pages.system.dataBackups.statusRunning') },
      success: { status: 'success', text: t('pages.system.dataBackups.statusSuccess') },
      failed: { status: 'error', text: t('pages.system.dataBackups.statusFailed') },
    };
    return statusMap[status] || { status: 'default', text: status };
  };

  const getBackupScopeText = (scope: string): string => {
    const scopeMap: Record<string, string> = {
      all: t('pages.system.dataBackups.scopeAll'),
      tenant: t('pages.system.dataBackups.scopeTenant'),
      table: t('pages.system.dataBackups.scopeTable'),
    };
    return scopeMap[scope] || scope;
  };
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentBackup, setCurrentBackup] = useState<DataBackup | null>(null);
  const [formRef] = ProForm.useForm();
  const [allBackups, setAllBackups] = useState<DataBackup[]>([]); // 用于统计

  /**
   * 查看备份详情
   */
  const handleViewDetail = async (record: DataBackup) => {
    try {
      const detail = await getBackupDetail(record.uuid);
      setCurrentBackup(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataBackups.getDetailFailed'));
    }
  };

  /**
   * 创建备份
   */
  const handleCreate = async (values: CreateDataBackupData) => {
    try {
      await createBackup(values);
      messageApi.success(t('pages.system.dataBackups.createSuccess'));
      setCreateModalVisible(false);
      formRef.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataBackups.createFailed'));
    }
  };

  /**
   * 恢复备份
   */
  const handleRestore = async (record: DataBackup) => {
    try {
      const result = await restoreBackup(record.uuid, true);
      if (result.success) {
        messageApi.success(result.message || t('pages.system.dataBackups.restoreSuccess'));
        actionRef.current?.reload();
      } else {
        messageApi.error(result.error || t('pages.system.dataBackups.restoreFailed'));
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataBackups.restoreFailed'));
    }
  };

  /**
   * 删除备份
   */
  const handleDelete = async (record: DataBackup) => {
    try {
      await deleteBackup(record.uuid);
      messageApi.success(t('pages.system.dataBackups.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataBackups.deleteFailed'));
    }
  };

  /**
   * 下载备份
   */
  const handleDownload = async (record: DataBackup) => {
    try {
      const blob = await downloadBackup(record.uuid);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.name || 'backup'}_${record.uuid.slice(0, 8)}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      messageApi.success(t('pages.system.dataBackups.downloadStarted'));
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataBackups.downloadFailed'));
    }
  };

  /**
   * 备份状态标签
   */
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: t('pages.system.dataBackups.statusPending') },
      running: { color: 'processing', text: t('pages.system.dataBackups.statusRunning') },
      success: { color: 'success', text: t('pages.system.dataBackups.statusSuccess') },
      failed: { color: 'error', text: t('pages.system.dataBackups.statusFailed') },
    };
    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  const getBackupTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      full: { color: 'blue', text: t('pages.system.dataBackups.typeFull') },
      incremental: { color: 'green', text: t('pages.system.dataBackups.typeIncremental') },
    };
    const typeInfo = typeMap[type] || { color: 'default', text: type };
    return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
  };

  /**
   * 计算统计信息
   */
  const statCards = useMemo(() => {
    if (allBackups.length === 0) return undefined;
    
    const stats = {
      total: allBackups.length,
      success: allBackups.filter((b) => b.status === 'success').length,
      failed: allBackups.filter((b) => b.status === 'failed').length,
      running: allBackups.filter((b) => b.status === 'running').length,
      totalSize: allBackups.reduce((sum, b) => sum + (b.file_size || 0), 0),
    };

    return [
      { title: t('pages.system.dataBackups.statTotal'), value: stats.total, valueStyle: { color: '#1890ff' } },
      { title: t('pages.system.dataBackups.statSuccess'), value: stats.success, valueStyle: { color: '#52c41a' } },
      { title: t('pages.system.dataBackups.statFailed'), value: stats.failed, valueStyle: { color: '#ff4d4f' } },
      { title: t('pages.system.dataBackups.statRunning'), value: stats.running, valueStyle: { color: '#1890ff' } },
      { title: t('pages.system.dataBackups.statTotalSize'), value: formatFileSize(stats.totalSize), valueStyle: { color: '#722ed1' } },
    ];
  }, [allBackups, t]);

  /**
   * 卡片渲染函数
   */
  const renderCard = (backup: DataBackup, index: number) => {
    const typeInfo = getBackupTypeTag(backup.backup_type);
    const statusInfo = getStatusInfo(backup.status);
    
    return (
      <Card
        key={backup.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip key="view" title={t('pages.system.dataBackups.viewDetail')}>
            <EyeOutlined
              onClick={() => handleViewDetail(backup)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          backup.status === 'success' ? (
            <Tooltip key="download" title={t('pages.system.dataBackups.downloadBackup')}>
              <DownloadOutlined
                onClick={() => handleDownload(backup)}
                style={{ fontSize: 16, color: '#52c41a' }}
              />
            </Tooltip>
          ) : null,
          backup.status === 'success' ? (
            <Tooltip key="restore" title={t('pages.system.dataBackups.restoreBackup')}>
              <ReloadOutlined
                onClick={() => {
                  Modal.confirm({
                    title: t('pages.system.dataBackups.restoreConfirmTitle'),
                    content: t('pages.system.dataBackups.restoreConfirmContent'),
                    okText: t('common.confirm'),
                    cancelText: t('common.cancel'),
                    onOk: () => handleRestore(backup),
                  });
                }}
                style={{ fontSize: 16, color: '#1890ff' }}
              />
            </Tooltip>
          ) : null,
          <Popconfirm
            key="delete"
            title={t('pages.system.dataBackups.deleteConfirmTitle')}
            onConfirm={() => handleDelete(backup)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Tooltip title={t('pages.system.dataBackups.deleteTooltip')}>
              <DeleteOutlined
                style={{ fontSize: 16, color: '#ff4d4f' }}
              />
            </Tooltip>
          </Popconfirm>,
        ].filter(Boolean)}
      >
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 16 }}>
                {backup.name}
              </Text>
              <Tag color={typeInfo.color}>
                {typeInfo.text}
              </Tag>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataBackups.labelScope')}</Text>
              <Text style={{ fontSize: 12 }}>{getBackupScopeText(backup.backup_scope)}</Text>
            </div>
          </Space>
        </div>
        
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataBackups.labelStatus')}</Text>
              <Badge
                status={statusInfo.status}
                text={statusInfo.text}
              />
            </div>
            
            {backup.file_size && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataBackups.labelFileSize')}</Text>
                <Text style={{ fontSize: 12 }}>{formatFileSize(backup.file_size)}</Text>
              </div>
            )}
            
            {backup.started_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataBackups.labelStartedAt')}</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(backup.started_at).format('MM-DD HH:mm')}
                </Text>
              </div>
            )}
            
            {backup.completed_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataBackups.labelCompletedAt')}</Text>
                <Text style={{ fontSize: 12 }}>
                  {dayjs(backup.completed_at).format('MM-DD HH:mm')}
                </Text>
              </div>
            )}
            
            {backup.status === 'running' && (
              <Progress percent={50} status="active" size="small" />
            )}
            
            {backup.error_message && (
              <Alert
                message={backup.error_message}
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
  const columns: ProColumns<DataBackup>[] = [
    {
      title: t('pages.system.dataBackups.columnName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: 200,
    },
    {
      title: t('pages.system.dataBackups.columnType'),
      dataIndex: 'backup_type',
      key: 'backup_type',
      valueEnum: {
        full: { text: t('pages.system.dataBackups.typeFull') },
        incremental: { text: t('pages.system.dataBackups.typeIncremental') },
      },
      render: (_: any, record: DataBackup) => getBackupTypeTag(record.backup_type),
      width: 100,
    },
    {
      title: t('pages.system.dataBackups.columnScope'),
      dataIndex: 'backup_scope',
      key: 'backup_scope',
      valueEnum: {
        all: { text: t('pages.system.dataBackups.scopeAll') },
        tenant: { text: t('pages.system.dataBackups.scopeTenant') },
        table: { text: t('pages.system.dataBackups.scopeTable') },
      },
      width: 100,
    },
    {
      title: t('pages.system.dataBackups.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      valueEnum: {
        pending: { text: t('pages.system.dataBackups.statusPending') },
        running: { text: t('pages.system.dataBackups.statusRunning') },
        success: { text: t('pages.system.dataBackups.statusSuccess') },
        failed: { text: t('pages.system.dataBackups.statusFailed') },
      },
      render: (_: any, record: DataBackup) => getStatusTag(record.status),
      width: 100,
    },
    {
      title: t('pages.system.dataBackups.columnFileSize'),
      dataIndex: 'file_size',
      key: 'file_size',
      search: false,
      render: (_: any, record: DataBackup) => formatFileSize(record.file_size),
      width: 120,
    },
    {
      title: t('pages.system.dataBackups.columnCreatedAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      sorter: true,
      search: false,
      width: 180,
    },
    {
      title: t('pages.system.dataBackups.columnActions'),
      key: 'option',
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_: any, record: DataBackup) => [
        <Button key="view" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>{t('pages.system.dataBackups.viewDetail')}</Button>,
        record.status === 'success' && (
          <Button key="download" type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(record)}>{t('pages.system.dataBackups.downloadBackup')}</Button>
        ),
        record.status === 'success' && (
          <Button
            key="restore"
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              Modal.confirm({
                title: t('pages.system.dataBackups.restoreConfirmTitle'),
                content: t('pages.system.dataBackups.restoreConfirmContent'),
                okText: t('common.confirm'),
                cancelText: t('common.cancel'),
                onOk: () => handleRestore(record),
              });
            }}
          >
            {t('pages.system.dataBackups.restore')}
          </Button>
        ),
        <Popconfirm
          key="delete"
          title={t('pages.system.dataBackups.deleteConfirmTitle')}
          onConfirm={() => handleDelete(record)}
          okText={t('common.confirm')}
          cancelText={t('common.cancel')}
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>{t('pages.system.dataBackups.delete')}</Button>
        </Popconfirm>,
      ].filter(Boolean),
    },
  ];

  /**
   * 详情列定义
   */
  const detailColumns = [
    { title: t('pages.system.dataBackups.columnName'), dataIndex: 'name' },
    { title: t('pages.system.dataBackups.columnType'), dataIndex: 'backup_type', render: (value: string) => getBackupTypeTag(value) },
    { title: t('pages.system.dataBackups.columnScope'), dataIndex: 'backup_scope', render: (value: string) => getBackupScopeText(value) },
    { title: t('pages.system.dataBackups.columnStatus'), dataIndex: 'status', render: (value: string) => getStatusTag(value) },
    { title: t('pages.system.dataBackups.columnFilePath'), dataIndex: 'file_path', render: (value: string) => value || '-' },
    { title: t('pages.system.dataBackups.columnFileSize'), dataIndex: 'file_size', render: (value: number) => formatFileSize(value) },
    { title: t('pages.system.dataBackups.columnStartedAt'), dataIndex: 'started_at', valueType: 'dateTime' },
    { title: t('pages.system.dataBackups.columnCompletedAt'), dataIndex: 'completed_at', valueType: 'dateTime' },
    { title: t('pages.system.dataBackups.columnError'), dataIndex: 'error_message', render: (value: string) => value || '-' },
    {
      title: t('pages.system.dataBackups.columnCreatedAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: t('pages.system.dataBackups.columnUpdatedAt'),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<DataBackup>
          actionRef={actionRef}
          columns={columns}
          request={async (params, sort, _filter, searchFormValues) => {
            // 检查 currentUser，如果用户未登录则直接返回空数据
            if (!currentUser) {
              return {
                data: [],
                success: true,
                total: 0,
              };
            }
            
            const { current, pageSize, backup_type, backup_scope, status, ...rest } = params;
            
            try {
              // 获取当前页数据
              const response = await getBackups({
                page: current || 1,
                page_size: pageSize || 20,
                backup_type: backup_type as string | undefined,
                backup_scope: backup_scope as string | undefined,
                status: status as string | undefined,
              });
              
              // 同时获取所有数据用于统计（如果当前页是第一页，获取所有数据）
              if ((current || 1) === 1) {
                try {
                  const allResponse = await getBackups({
                    page: 1,
                    page_size: 1000,
                  });
                  setAllBackups(allResponse.items);
                } catch (e) {
                  // 忽略统计数据的错误
                }
              }
              
              return {
                data: response.items,
                success: true,
                total: response.total,
              };
            } catch (error: any) {
              // 如果是 401 错误，返回空数据而不是抛出错误
              if (error?.response?.status === 401) {
                return {
                  data: [],
                  success: true,
                  total: 0,
                };
              }
              messageApi.error(error.message || t('pages.system.dataBackups.loadListFailed'));
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
          createButtonText={t('pages.system.dataBackups.createButton')}
          onCreate={() => setCreateModalVisible(true)}
          showImportButton={false}
          showExportButton={true}
          onExport={async (type, keys, pageData) => {
            try {
              let items: DataBackup[] = [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else {
                const res = await getBackups({ page: 1, page_size: 10000 });
                items = res.items;
                if (type === 'selected' && keys?.length) {
                  items = items.filter((d) => keys.includes(d.uuid));
                }
              }
              if (items.length === 0) {
                messageApi.warning(t('pages.system.dataBackups.noDataToExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `data-backups-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('pages.system.dataBackups.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('pages.system.dataBackups.exportFailed'));
            }
          }}
          viewTypes={['table', 'help']}
          defaultViewType="table"
          cardViewConfig={{
            renderCard,
          }}
        />
      </ListPageTemplate>

      {/* 创建备份 Modal */}
      <FormModalTemplate
        title={t('pages.system.dataBackups.createModalTitle')}
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.resetFields();
        }}
        onFinish={handleCreate}
        isEdit={false}
        loading={false}
      >
        <ProFormText
          name="name"
          label={t('pages.system.dataBackups.labelName')}
          rules={[{ required: true, message: t('pages.system.dataBackups.nameRequired') }]}
          placeholder={t('pages.system.dataBackups.namePlaceholder')}
        />
        <SafeProFormSelect
          name="backup_type"
          label={t('pages.system.dataBackups.labelType')}
          rules={[{ required: true, message: t('pages.system.dataBackups.typeRequired') }]}
          options={[
            { label: t('pages.system.dataBackups.typeFullLabel'), value: 'full' },
            { label: t('pages.system.dataBackups.typeIncrementalLabel'), value: 'incremental' },
          ]}
          placeholder={t('pages.system.dataBackups.typePlaceholder')}
        />
        <SafeProFormSelect
          name="backup_scope"
          label={t('pages.system.dataBackups.labelScopeField')}
          rules={[{ required: true, message: t('pages.system.dataBackups.scopeRequired') }]}
          options={[
            ...(currentUser?.is_infra_admin ? [{ label: t('pages.system.dataBackups.scopeAllLabel'), value: 'all' }] : []),
            { label: t('pages.system.dataBackups.scopeTenantLabel'), value: 'tenant' },
            { label: t('pages.system.dataBackups.scopeTableLabel'), value: 'table' },
          ]}
          placeholder={t('pages.system.dataBackups.scopePlaceholder')}
        />
      </FormModalTemplate>

      {/* 备份详情 Drawer */}
      <DetailDrawerTemplate<DataBackup>
        title={t('pages.system.dataBackups.detailTitle')}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentBackup(null);
        }}
        dataSource={currentBackup || {}}
        columns={detailColumns}
      />
    </>
  );
};

export default DataBackupsPage;
