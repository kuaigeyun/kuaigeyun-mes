/**
 * 数据备份页面
 * 
 * 用于查看和管理系统数据备份。
 * 支持创建备份、恢复备份、删除备份等功能。
 */

import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';
import { rowActionKind } from '../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormText,
  ProFormSelect,
  ProFormInstance,
  type ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { App, Card, Tag, Space, message, Modal, Descriptions, Popconfirm, Button, Badge, Typography, Alert, Progress, Tooltip, theme, Upload, InputNumber, Form } from 'antd';
import { StatCardTrendArea } from '../../../components/common/StatCardTrendArea';
import { EyeOutlined, PlusOutlined, ReloadOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, SyncOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../components/uni-detail';
import {
  getBackups,
  createBackup,
  uploadBackup,
  getBackupDetail,
  restoreBackup,
  deleteBackup,
  startBackupDownload,
  getBackupWorkerHealth,
  pollRestoreStatus,
  DataBackup,
  BackupWorkerHealth,
  DataBackupListResponse,
  CreateDataBackupData,
} from '../../../services/dataBackup';
import { useGlobalStore } from '../../../stores';
import { getTenantId } from '../../../utils/auth';
import { formatDateTime } from '../../../utils/format';

function formatFileSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}


/**
 * 数据备份页面组件
 */
const DataBackupsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const { Text } = Typography;
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

  const getRestoreStatusTag = (restoreStatus?: string | null, errorMessage?: string | null) => {
    if (!restoreStatus) return <Text type="secondary">-</Text>;
    const info = getStatusInfo(restoreStatus);
    const badge = <Badge status={info.status} text={info.text} />;
    if (restoreStatus === 'failed' && errorMessage) {
      return <Tooltip title={errorMessage}>{badge}</Tooltip>;
    }
    return badge;
  };

  const getBackupScopeText = (scope: string): string => {
    const scopeMap: Record<string, string> = {
      all: t('pages.system.dataBackups.scopeAll'),
      tenant: t('pages.system.dataBackups.scopeTenant'),
      table: t('pages.system.dataBackups.scopeTable'),
    };
    return scopeMap[scope] || scope;
  };

  const getBackupContentScopeText = (includeFiles?: boolean | null): string => {
    if (includeFiles === false) {
      return t('pages.system.dataBackups.contentDataOnly');
    }
    return t('pages.system.dataBackups.contentDataAndFiles');
  };
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentBackup, setCurrentBackup] = useState<DataBackup | null>(null);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [restoreBackupRecord, setRestoreBackupRecord] = useState<DataBackup | null>(null);
  const [form] = ProForm.useForm();
  const [restoreForm] = Form.useForm();
  const [allBackups, setAllBackups] = useState<DataBackup[]>([]); // 用于统计
  const [workerHealth, setWorkerHealth] = useState<BackupWorkerHealth | null>(null);
  const [workerHealthLoading, setWorkerHealthLoading] = useState(false);

  const loadWorkerHealth = React.useCallback(async (silent: boolean = true) => {
    if (!silent) {
      setWorkerHealthLoading(true);
    }
    try {
      const health = await getBackupWorkerHealth();
      setWorkerHealth(health);
    } catch (error: any) {
      if (!silent) {
        messageApi.error(error?.message || t('pages.system.dataBackups.workerHealthLoadFailed'));
      }
    } finally {
      if (!silent) {
        setWorkerHealthLoading(false);
      }
    }
  }, [messageApi, t]);

  React.useEffect(() => {
    loadWorkerHealth(true);
    const timer = window.setInterval(() => {
      loadWorkerHealth(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadWorkerHealth]);

  const workerHealthMeta = useMemo(() => {
    if (!workerHealth) {
      return {
        badgeStatus: 'default' as const,
        label: t('pages.system.dataBackups.workerStatusUnknown'),
      };
    }

    const statusMap: Record<BackupWorkerHealth['status'], { badgeStatus: 'success' | 'error' | 'warning' | 'default'; label: string }> = {
      online: { badgeStatus: 'success', label: t('pages.system.dataBackups.workerStatusOnline') },
      backlog: { badgeStatus: 'warning', label: t('pages.system.dataBackups.workerStatusBacklog') },
      idle: { badgeStatus: 'default', label: t('pages.system.dataBackups.workerStatusIdle') },
    };

    return statusMap[workerHealth.status] || {
      badgeStatus: 'default',
      label: t('pages.system.dataBackups.workerStatusUnknown'),
    };
  }, [workerHealth, t]);

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
  const handleCreate = async (values: Pick<CreateDataBackupData, 'name' | 'include_files'>) => {
    setSubmitting(true);
    try {
      await createBackup({
        name: values.name,
        backup_type: 'full',
        backup_scope: 'tenant',
        include_files: values.include_files ?? true,
      });
      messageApi.success(t('pages.system.dataBackups.createSuccess'));
      setCreateModalVisible(false);
      form.resetFields();
      actionRef.current?.reload();
      loadWorkerHealth(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataBackups.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 恢复备份（租户级备份需确认导出租户编号）
   */
  const handleRestore = async (record: DataBackup) => {
    try {
      const detail = await getBackupDetail(record.uuid);
      if (detail.file_available === false) {
        messageApi.error(t('pages.system.dataBackups.fileNotOnServer'));
        return;
      }
      setRestoreBackupRecord(detail);
      const inferredSource = detail.source_tenant_id ?? detail.tenant_id ?? undefined;
      restoreForm.setFieldsValue({ source_tenant_id: inferredSource });
      setRestoreModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataBackups.getDetailFailed'));
    }
  };

  const handleRestoreConfirm = async () => {
    if (!restoreBackupRecord) return;
    const values = await restoreForm.validateFields().catch(() => null);
    if (!values) return;
    const sourceTenantId = values.source_tenant_id != null ? Number(values.source_tenant_id) : undefined;
    const restoringUuid = restoreBackupRecord.uuid;
    try {
      const result = await restoreBackup(restoringUuid, true, true, sourceTenantId);
      if (result.success) {
        messageApi.info(result.message || t('pages.system.dataBackups.restoreSuccess'));
        setRestoreModalVisible(false);
        setRestoreBackupRecord(null);
        actionRef.current?.reload();
        loadWorkerHealth(true);
        void pollRestoreStatus(restoringUuid, {
          onSuccess: () => {
            messageApi.success(t('pages.system.dataBackups.restoreCompletedSuccess'));
            actionRef.current?.reload();
          },
          onFailed: (errorMessage) => {
            messageApi.error(errorMessage || t('pages.system.dataBackups.restoreFailed'));
            actionRef.current?.reload();
          },
          onTimeout: () => {
            messageApi.warning(t('pages.system.dataBackups.restorePollingTimeout'));
            actionRef.current?.reload();
          },
        });
      } else {
        messageApi.error(result.error || t('pages.system.dataBackups.restoreFailed'));
      }
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataBackups.restoreFailed'));
    }
  };

  /**
   * 上传备份文件
   */
  const handleUpload = async (file: File, name?: string) => {
    try {
      setUploading(true);
      await uploadBackup(file, name || file.name.replace(/\.zip$/i, ''));
      messageApi.success(t('pages.system.dataBackups.uploadSuccess'));
      setUploadModalVisible(false);
      actionRef.current?.reload();
      loadWorkerHealth(true);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.dataBackups.uploadFailed'));
    } finally {
      setUploading(false);
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
      loadWorkerHealth(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataBackups.deleteFailed'));
    }
  };

  /**
   * 下载备份（浏览器原生流式下载，立即弹出保存对话框）
   */
  const handleDownload = async (record: DataBackup) => {
    if (record.file_available === false) {
      messageApi.error(t('pages.system.dataBackups.fileNotOnServer'));
      return;
    }
    try {
      await startBackupDownload(
        record.uuid,
        `${record.name || 'backup'}_${record.uuid.slice(0, 8)}.zip`,
      );
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

  const getBackupTypeInfo = (backupType: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      full: { color: 'blue', text: t('pages.system.dataBackups.typeFull') },
      incremental: { color: 'green', text: t('pages.system.dataBackups.typeIncremental') },
    };
    return typeMap[backupType] || { color: 'default', text: backupType };
  };

  const getBackupTypeTag = (backupType: string) => {
    const typeInfo = getBackupTypeInfo(backupType);
    return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>;
  };

  /**
   * 计算统计信息
   */
  const statCards = useMemo(() => {
    const renderDOD = (today?: number, yesterday?: number) => {
      if (today === undefined || yesterday === undefined) return null;
      const diff = today - yesterday;
      const color = diff > 0 ? '#cf1322' : diff < 0 ? '#3f8600' : 'rgba(0, 0, 0, 0.45)';
      const icon = diff > 0 ? '↑' : diff < 0 ? '↓' : '';
      return (
        <span style={{ marginLeft: 8, fontSize: 13, color }}>
          <span style={{ color: 'rgba(0,0,0,0.45)' }}>较昨日</span> {icon} {Math.abs(diff)}
        </span>
      );
    };

    const todayStr = formatDateTime(new Date(), 'YYYY-MM-DD');
    const yesterdayStr = formatDateTime(dayjs().subtract(1, 'day').toDate(), 'YYYY-MM-DD');
    let today_backups = 0;
    let yesterday_backups = 0;
    const trend_data = [] as Array<{ date: string; value: number }>;

    // 计算最近7天的备份数据趋势
    for (let i = 6; i >= 0; i--) {
      const dateStr = formatDateTime(dayjs().subtract(i, 'day').toDate(), 'YYYY-MM-DD');
      const count = allBackups.filter((b) => formatDateTime(b.created_at, 'YYYY-MM-DD') === dateStr).length;
      trend_data.push({ date: dateStr, value: count });
      if (dateStr === todayStr) today_backups = count;
      if (dateStr === yesterdayStr) yesterday_backups = count;
    }

    // 始终返回卡片结构，避免数据加载前后产生的布局抖动
    const stats = {
      total: allBackups.length,
      success: allBackups.filter((b) => b.status === 'success').length,
      failed: allBackups.filter((b) => b.status === 'failed').length,
      running: allBackups.filter((b) => b.status === 'running').length,
      totalSize: allBackups.reduce((sum, b) => sum + (b.file_size || 0), 0),
    };

    return [
      { 
        title: t('pages.system.dataBackups.statTotal'), 
        value: stats.total, 
        valueStyle: { color: '#1890ff' },
        description: (
          <div>
            今日备份: {today_backups} {renderDOD(today_backups, yesterday_backups)}
          </div>
        ),
        backgroundChart: trend_data.length ? <StatCardTrendArea data={trend_data} color="#1890ff" /> : undefined,
      },
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
    const typeInfo = getBackupTypeInfo(backup.backup_type);
    const statusInfo = getStatusInfo(backup.status);
    
    return (
      <Card
        key={backup.uuid}
        hoverable
        style={{ height: '100%' }}
        actions={[
          <Tooltip {...rowActionKind('read')} key="view" title={t('pages.system.dataBackups.viewDetail')}>
            <EyeOutlined
              onClick={() => handleViewDetail(backup)}
              style={{ fontSize: 16 }}
            />
          </Tooltip>,
          backup.status === 'success' ? (
            <Tooltip {...rowActionKind('read')} key="download" title={t('pages.system.dataBackups.downloadBackup')}>
              <DownloadOutlined
                onClick={() => handleDownload(backup)}
                style={{ fontSize: 16, color: '#52c41a' }}
              />
            </Tooltip>
          ) : null,
          backup.status === 'success' ? (
            <Tooltip {...rowActionKind('update')} key="restore" title={t('pages.system.dataBackups.restoreBackup')}>
              <ReloadOutlined
                onClick={() => handleRestore(backup)}
                style={{ fontSize: 16, color: '#1890ff' }}
              />
            </Tooltip>
          ) : null,
          <Popconfirm {...rowActionKind('delete')}
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
          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
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
              <Text style={{ fontSize: 12 }}>{getBackupContentScopeText(backup.include_files)}</Text>
            </div>
          </Space>
        </div>
        
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataBackups.labelStatus')}</Text>
              <Badge
                status={statusInfo.status}
                text={statusInfo.text}
              />
            </div>

            {backup.restore_status && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataBackups.columnRestoreStatus')}</Text>
                {getRestoreStatusTag(backup.restore_status, backup.restore_error_message)}
              </div>
            )}
            
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
                  {formatDateTime(backup.started_at, 'MM-DD HH:mm')}
                </Text>
              </div>
            )}
            
            {backup.completed_at && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataBackups.labelCompletedAt')}</Text>
                <Text style={{ fontSize: 12 }}>
                  {formatDateTime(backup.completed_at, 'MM-DD HH:mm')}
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

            {backup.restore_error_message && (
              <Alert
                message={backup.restore_error_message}
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
      dataIndex: 'include_files',
      key: 'include_files',
      width: 120,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.dataBackups.contentDataAndFiles') },
        false: { text: t('pages.system.dataBackups.contentDataOnly') },
      },
      render: (_: unknown, record: DataBackup) => getBackupContentScopeText(record.include_files),
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
      title: t('pages.system.dataBackups.columnRestoreStatus'),
      dataIndex: 'restore_status',
      key: 'restore_status',
      search: false,
      render: (_: any, record: DataBackup) => getRestoreStatusTag(record.restore_status, record.restore_error_message),
      width: 110,
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
      fixed: 'right',
      render: (_: any, record: DataBackup) => {
        const actions: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="view" onClick={() => handleViewDetail(record)}>
            {t('common.detail')}
          </Button>,
        ];
        if (record.status === 'success') {
          actions.push(
            <Button {...rowActionKind('read')}
              key="download"
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            >
              {t('pages.system.dataBackups.downloadBackup')}
            </Button>,
          );
          actions.push(
            <Button {...rowActionKind('update')} key="restore" onClick={() => handleRestore(record)}>
              {t('pages.system.dataBackups.restore')}
            </Button>,
          );
        }
        actions.push(
          <Popconfirm {...rowActionKind('delete')}
            key="delete"
            title={t('pages.system.dataBackups.deleteConfirmTitle')}
            onConfirm={() => handleDelete(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('pages.system.dataBackups.delete')}
            </Button>
          </Popconfirm>,
        );
        return actions;
      },
    },
  ];

  /**
   * 详情列定义
   */
  const getSourceTypeTag = (sourceType?: string) => {
    if (sourceType === 'uploaded') {
      return <Tag color="orange">{t('pages.system.dataBackups.sourceUploaded')}</Tag>;
    }
    return <Tag color="blue">{t('pages.system.dataBackups.sourceGenerated')}</Tag>;
  };

  const detailColumns: ProDescriptionsItemProps<DataBackup>[] = [
    { title: t('pages.system.dataBackups.columnName'), dataIndex: 'name' },
    { title: t('pages.system.dataBackups.columnSource'), dataIndex: 'source_type', render: (_, r) => getSourceTypeTag(r.source_type) },
    { title: t('pages.system.dataBackups.columnType'), dataIndex: 'backup_type', render: (_, r) => getBackupTypeTag(r.backup_type) },
    { title: t('pages.system.dataBackups.columnScope'), dataIndex: 'include_files', render: (_, r) => getBackupContentScopeText(r.include_files) },
    {
      title: t('pages.system.dataBackups.restoreSourceTenantLabel'),
      dataIndex: 'source_tenant_id',
      render: (_, r) => (r.source_tenant_id != null ? r.source_tenant_id : '-'),
    },
    { title: t('pages.system.dataBackups.columnStatus'), dataIndex: 'status', render: (_, r) => getStatusTag(r.status) },
    { title: t('pages.system.dataBackups.columnRestoreStatus'), dataIndex: 'restore_status', render: (_, r) => getRestoreStatusTag(r.restore_status, r.restore_error_message) },
    { title: t('pages.system.dataBackups.columnFilePath'), dataIndex: 'file_path', render: (_, r) => r.file_path || '-' },
    { title: t('pages.system.dataBackups.columnFileSize'), dataIndex: 'file_size', render: (_, r) => formatFileSize(r.file_size) },
    { title: t('pages.system.dataBackups.columnStartedAt'), dataIndex: 'started_at', valueType: 'dateTime' },
    { title: t('pages.system.dataBackups.columnCompletedAt'), dataIndex: 'completed_at', valueType: 'dateTime' },
    { title: t('pages.system.dataBackups.columnError'), dataIndex: 'error_message', render: (_, r) => r.error_message || '-' },
    { title: t('pages.system.dataBackups.columnRestoreStartedAt'), dataIndex: 'restore_started_at', valueType: 'dateTime' },
    { title: t('pages.system.dataBackups.columnRestoreCompletedAt'), dataIndex: 'restore_completed_at', valueType: 'dateTime' },
    { title: t('pages.system.dataBackups.columnRestoreError'), dataIndex: 'restore_error_message', render: (_, r) => r.restore_error_message || '-' },
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

  const restoreTargetTenantId = currentUser?.tenant_id ?? getTenantId();
  const restoreSourceTenantId = Form.useWatch('source_tenant_id', restoreForm);
  const isTenantBackupRestore = restoreBackupRecord?.backup_scope === 'tenant';
  const showMigrationHint =
    isTenantBackupRestore
    && restoreSourceTenantId != null
    && restoreTargetTenantId != null
    && Number(restoreSourceTenantId) !== Number(restoreTargetTenantId);
  const showSameTenantHint =
    isTenantBackupRestore
    && restoreSourceTenantId != null
    && restoreTargetTenantId != null
    && Number(restoreSourceTenantId) === Number(restoreTargetTenantId);

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<DataBackup>
          columnPersistenceId="pages.system.data-backups"
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
          toolBarRender={() => [
            <Space key="worker-status" size="middle">
              <Tooltip
                title={
                  <Space direction="vertical" size={2}>
                    <Text style={{ color: '#fff' }}>{t('pages.system.dataBackups.workerStatusTitle')}: {workerHealthMeta.label}</Text>
                    <Text style={{ color: '#fff' }}>{t('pages.system.dataBackups.workerStatusPending')}: {workerHealth?.pending_total ?? '-'}</Text>
                    <Text style={{ color: '#fff' }}>{t('pages.system.dataBackups.workerStatusStalledPending')}: {workerHealth?.pending_stalled ?? '-'}</Text>
                    <Text style={{ color: '#fff' }}>{t('pages.system.dataBackups.workerStatusRunningCount')}: {workerHealth?.running_count ?? '-'}</Text>
                    <Text style={{ color: '#fff' }}>{t('pages.system.dataBackups.workerStatusLastChecked')}: {workerHealth?.checked_at ? formatDateTime(workerHealth.checked_at, 'YYYY-MM-DD HH:mm:ss') : '-'}</Text>
                  </Space>
                }
              >
                <Badge status={workerHealthMeta.badgeStatus} text={`${t('pages.system.dataBackups.workerStatusTitle')}: ${workerHealthMeta.label}`} />
              </Tooltip>
              <Button
                icon={<SyncOutlined spin={workerHealthLoading} />}
                loading={workerHealthLoading}
                onClick={() => loadWorkerHealth(false)}
              >
                {t('pages.system.dataBackups.workerStatusRefresh')}
              </Button>
            </Space>,
          ]}
          showImportButton={false}
          showExportButton={true}
          exportButtonText={t('pages.system.dataBackups.downloadBackup')}
          rightToolBarActionsBeforeExport={[
            <Button {...rowActionKind('import')}
              key="upload"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalVisible(true)}
            >
              {t('pages.system.dataBackups.uploadButton')}
            </Button>,
          ]}
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
          form.resetFields();
        }}
        onFinish={handleCreate}
        isEdit={false}
        loading={submitting}
        form={form}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <ProFormText
          name="name"
          label={t('pages.system.dataBackups.labelName')}
          rules={[{ required: true, message: t('pages.system.dataBackups.nameRequired') }]}
          placeholder={t('pages.system.dataBackups.namePlaceholder')}
        />
        <SafeProFormSelect
          name="include_files"
          label={t('pages.system.dataBackups.labelContentScope')}
          rules={[{ required: true, message: t('pages.system.dataBackups.contentScopeRequired') }]}
          initialValue={true}
          options={[
            { label: t('pages.system.dataBackups.contentDataAndFilesLabel'), value: true },
            { label: t('pages.system.dataBackups.contentDataOnlyLabel'), value: false },
          ]}
          placeholder={t('pages.system.dataBackups.contentScopePlaceholder')}
        />
      </FormModalTemplate>

      {/* 上传备份 Modal */}
      <Modal
        title={t('pages.system.dataBackups.uploadModalTitle')}
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
        destroyOnHidden
      >
        <Upload.Dragger
          accept=".zip"
          maxCount={1}
          beforeUpload={(file) => {
            handleUpload(file, file.name.replace(/\.zip$/i, ''));
            return false; // 阻止默认上传
          }}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
          </p>
          <p className="ant-upload-text">{t('pages.system.dataBackups.uploadHint')}</p>
        </Upload.Dragger>
      </Modal>

      {/* 恢复备份 Modal */}
      <Modal
        title={t('pages.system.dataBackups.restoreConfirmTitle')}
        open={restoreModalVisible}
        onCancel={() => {
          setRestoreModalVisible(false);
          setRestoreBackupRecord(null);
          restoreForm.resetFields();
        }}
        onOk={handleRestoreConfirm}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        destroyOnHidden
        width={520}
      >
        <div style={{ marginBottom: 16 }}>
          <p>{restoreBackupRecord?.source_type === 'uploaded' ? t('pages.system.dataBackups.restoreUploadedConfirmContent') : t('pages.system.dataBackups.restoreConfirmContent')}</p>
          <p style={{ marginTop: 8, color: 'var(--ant-color-text-secondary)' }}>
            {t('pages.system.dataBackups.preRestoreBackupHint')}
          </p>
        </div>

        {restoreBackupRecord?.include_files === false && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('pages.system.dataBackups.restoreDataOnlyHint')}
          />
        )}

        {isTenantBackupRestore && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('pages.system.dataBackups.restoreTenantMappingTitle')}
              description={t('pages.system.dataBackups.restorePlatformSafeHint')}
            />

            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('pages.system.dataBackups.restoreTargetTenantLabel')}>
                {t('pages.system.dataBackups.restoreTargetTenantDesc', {
                  id: restoreTargetTenantId ?? '-',
                })}
              </Descriptions.Item>
            </Descriptions>

            <Form form={restoreForm} layout="vertical">
              <Form.Item
                name="source_tenant_id"
                label={t('pages.system.dataBackups.restoreSourceTenantLabel')}
                extra={t('pages.system.dataBackups.restoreSourceTenantExtra')}
                rules={[
                  {
                    required: true,
                    message: t('pages.system.dataBackups.restoreSourceTenantRequired'),
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  precision={0}
                  placeholder={t('pages.system.dataBackups.restoreSourceTenantPlaceholder')}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Form>

            {showMigrationHint && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message={t('pages.system.dataBackups.restoreMigrationHint', {
                  source: restoreSourceTenantId,
                  target: restoreTargetTenantId,
                })}
              />
            )}

            {showSameTenantHint && (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message={t('pages.system.dataBackups.restoreSameTenantHint')}
              />
            )}
          </>
        )}
      </Modal>

      {/* 备份详情 Drawer */}
      <UniDetail
        title={t('pages.system.dataBackups.detailTitle')}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentBackup(null);
        }}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={currentBackup ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, currentBackup)} />
          ) : null}
      />
    </>
  );
};

export default DataBackupsPage;
