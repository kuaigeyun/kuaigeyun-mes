/**
 * 数据备份页面
 * 
 * 用于查看和管理系统数据备份。
 * 支持创建备份、恢复备份、删除备份等功能。
 */

import React, { useState, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { rowActionKind, rowActionLabelKeep } from '../../../components/uni-action';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '../../../hooks/useCurrentUser';
import {
  ActionType,
  ProColumns,
  ProForm,
  ProFormDependency,
  ProFormText,
  type ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import SafeProFormSelect from '../../../components/safe-pro-form-select';
import { App, Card, Tag, Space, Modal, Descriptions, Popconfirm, Button, Badge, Typography, Alert, Progress, Tooltip, theme, Upload, InputNumber, Form, Select } from 'antd';
import { getTenantList, TenantStatus } from '../../../services/tenant';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../apps/kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { renderSystemStatusTag, renderSystemTypeMarker } from '../utils/systemListPresentation';
import { StatCardTrendArea } from '../../../components/common/StatCardTrendArea';
import { EyeOutlined, ReloadOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, SyncOutlined, SettingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../components/layout-templates';
import { SystemMasterDetailDrawer } from '../shared/systemMasterDetailDrawer';
import { getApiErrorMessage } from '../../../utils/errorHandler';
import { resolveDataBackupListFilter } from '../../../utils/systemUniTableListFilters';
import {
  getBackups,
  createBackup,
  uploadBackup,
  getBackupDetail,
  restoreBackup,
  deleteBackup,
  startBackupDownload,
  getBackupWorkerHealth,
  reclaimStalledBackups,
  pollRestoreStatus,
  DataBackup,
  BackupWorkerHealth,
  CreateDataBackupData,
} from '../../../services/dataBackup';
import { getTenantId } from '../../../utils/auth';
import { formatDateTime, todaySiteDateString } from '../../../utils/format';
import { downloadRecordsAsXlsx } from '../../../utils/exportRecordsXlsx';
import { buildListPageHelpViewConfig } from '../../../components/page-help-wiki';
import BackupPolicyModal from './BackupPolicyModal';

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
  const currentUser = useCurrentUser();
  const isInfraAdmin = Boolean(currentUser?.is_infra_admin);
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

  const getBackupTenantScopeText = (scope?: string | null): string => {
    if (scope === 'all') {
      return t('pages.system.dataBackups.backupScopeAllLabel');
    }
    return t('pages.system.dataBackups.backupScopeTenantLabel');
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
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [restoreBackupRecord, setRestoreBackupRecord] = useState<DataBackup | null>(null);
  const [restoreTenantOptions, setRestoreTenantOptions] = useState<{ value: number; label: string }[]>([]);
  const [form] = ProForm.useForm();
  const [restoreForm] = Form.useForm();
  const [allBackups, setAllBackups] = useState<DataBackup[]>([]); // 用于统计
  const [workerHealth, setWorkerHealth] = useState<BackupWorkerHealth | null>(null);
  const [workerHealthLoading, setWorkerHealthLoading] = useState(false);
  const [reclaiming, setReclaiming] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [hasActiveBackupJobs, setHasActiveBackupJobs] = useState(false);
  const [policyModalVisible, setPolicyModalVisible] = useState(false);
  const boundTenantId = (() => {
    const fromUser = currentUser?.tenant_id;
    if (fromUser != null && Number.isFinite(Number(fromUser)) && Number(fromUser) > 0) {
      return Number(fromUser);
    }
    const fromStore = getTenantId();
    if (fromStore != null && Number.isFinite(fromStore) && fromStore > 0) {
      return fromStore;
    }
    return null;
  })();
  const boundTenantName =
    typeof currentUser?.tenant_name === 'string' ? currentUser.tenant_name : null;

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

  const handleReclaimStalled = async () => {
    setReclaiming(true);
    try {
      const result = await reclaimStalledBackups();
      messageApi.success(
        t('pages.system.dataBackups.reclaimSuccess', {
          redispatched: result.redispatched,
          failedRunning: result.failed_running,
        }),
      );
      await loadWorkerHealth(true);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.dataBackups.reclaimFailed'));
    } finally {
      setReclaiming(false);
    }
  };

  React.useEffect(() => {
    loadWorkerHealth(true);
    const timer = window.setInterval(() => {
      loadWorkerHealth(true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadWorkerHealth]);

  // 有进行中的备份时刷新列表，驱动进度条更新
  React.useEffect(() => {
    if (!hasActiveBackupJobs) return;
    const timer = window.setInterval(() => {
      actionRef.current?.reload();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [hasActiveBackupJobs]);

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
  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getBackupDetail(uuid);
      setCurrentBackup(detail);
    } catch (error) {
      setCurrentBackup(null);
      setDetailError(getApiErrorMessage(error, t('pages.system.dataBackups.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewDetail = async (record: DataBackup) => {
    detailRetryUuidRef.current = record.uuid;
    setDetailDrawerVisible(true);
    setCurrentBackup(null);
    setDetailError(null);
    void loadDetail(record.uuid);
  };

  /**
   * 创建备份
   */
  const handleCreate = async (
    values: Pick<CreateDataBackupData, 'name' | 'include_files' | 'backup_scope' | 'target_tenant_id'>,
  ) => {
    setSubmitting(true);
    try {
      const boundTenantId = currentUser?.tenant_id ?? getTenantId();
      const formValues = {
        ...values,
        ...(typeof form.getFieldsValue === 'function' ? form.getFieldsValue(true) : {}),
      } as typeof values;
      let backupScope: CreateDataBackupData['backup_scope'] = 'tenant';
      if (isInfraAdmin) {
        backupScope = formValues.backup_scope === 'all' ? 'all' : 'tenant';
      } else if (boundTenantId == null) {
        messageApi.error(t('pages.system.dataBackups.createNeedTenant'));
        return;
      }

      let targetTenantId: number | undefined;
      if (backupScope === 'tenant' && isInfraAdmin) {
        const raw = formValues.target_tenant_id ?? form.getFieldValue?.('target_tenant_id');
        const selected = raw != null ? Number(raw) : NaN;
        if (Number.isFinite(selected) && selected > 0) {
          targetTenantId = selected;
        } else if (boundTenantId != null) {
          targetTenantId = Number(boundTenantId);
        } else {
          messageApi.error(t('pages.system.dataBackups.targetTenantRequired'));
          return;
        }
      }

      await createBackup({
        name: formValues.name,
        backup_type: 'full',
        backup_scope: backupScope,
        include_files: formValues.include_files ?? true,
        ...(targetTenantId != null ? { target_tenant_id: targetTenantId } : {}),
      });
      messageApi.success(t('pages.system.dataBackups.createSuccess'));
      setCreateModalVisible(false);
      form.resetFields();
      setHasActiveBackupJobs(true);
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
  const loadRestoreTenantOptions = React.useCallback(async (keyword?: string) => {
    try {
      const resp = await getTenantList(
        {
          page: 1,
          page_size: 100,
          status: TenantStatus.ACTIVE,
          keyword: keyword || undefined,
          sort: 'id',
          order: 'asc',
        },
        true,
      );
      setRestoreTenantOptions(
        (resp.items ?? []).map((tenant) => ({
          value: Number(tenant.id),
          label: `${tenant.name} (#${tenant.id})`,
        })),
      );
    } catch {
      setRestoreTenantOptions([]);
    }
  }, []);

  const handleRestore = async (record: DataBackup) => {
    try {
      const detail = await getBackupDetail(record.uuid);
      if (detail.file_available === false) {
        messageApi.error(t('pages.system.dataBackups.fileNotOnServer'));
        return;
      }
      setRestoreBackupRecord(detail);
      const inferredSource = detail.source_tenant_id ?? detail.tenant_id ?? undefined;
      const inferredTarget =
        currentUser?.tenant_id ?? getTenantId() ?? detail.tenant_id ?? undefined;
      restoreForm.setFieldsValue({
        source_tenant_id: inferredSource,
        target_tenant_id: inferredTarget != null ? Number(inferredTarget) : undefined,
      });
      if (isInfraAdmin && detail.backup_scope === 'tenant') {
        void loadRestoreTenantOptions();
      }
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
    const targetTenantId =
      values.target_tenant_id != null
        ? Number(values.target_tenant_id)
        : currentUser?.tenant_id != null
          ? Number(currentUser.tenant_id)
          : getTenantId() != null
            ? Number(getTenantId())
            : undefined;
    const restoringUuid = restoreBackupRecord.uuid;
    try {
      const result = await restoreBackup(restoringUuid, true, true, sourceTenantId, targetTenantId);
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

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    try {
      await Promise.all(keys.map((key) => deleteBackup(String(key))));
      messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      loadWorkerHealth(true);
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.dataBackups.deleteFailed'));
      actionRef.current?.reload();
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
    return renderSystemStatusTag(statusInfo.text, statusInfo.color);
  };

  const renderBackupProgress = React.useCallback((record: DataBackup) => {
    const isActive = record.status === 'pending' || record.status === 'running';
    if (!isActive && record.status !== 'success' && record.status !== 'failed') {
      return <Text type="secondary">-</Text>;
    }
    const percent =
      record.status === 'success'
        ? 100
        : record.status === 'failed'
          ? Math.max(0, Number(record.progress) || 0)
          : record.status === 'pending'
            ? Math.max(0, Number(record.progress) || 0)
            : Math.min(99, Math.max(0, Number(record.progress) || 0));
    const status =
      record.status === 'success' ? 'success' : record.status === 'failed' ? 'exception' : 'active';
    return (
      <div style={{ minWidth: 120 }}>
        <Progress percent={percent} size="small" status={status} />
      </div>
    );
  }, []);

  const getBackupTypeInfo = (backupType: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      full: { color: 'blue', text: t('pages.system.dataBackups.typeFull') },
      incremental: { color: 'green', text: t('pages.system.dataBackups.typeIncremental') },
    };
    return typeMap[backupType] || { color: 'default', text: backupType };
  };

  const getBackupTypeTag = (backupType: string) => {
    const typeInfo = getBackupTypeInfo(backupType);
    return renderSystemTypeMarker(typeInfo.text, typeInfo.color);
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
            <Tooltip title={t('common.delete')}>
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
              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.dataBackups.labelTenantScope')}</Text>
              <Text style={{ fontSize: 12 }}>{getBackupTenantScopeText(backup.backup_scope)}</Text>
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
            
            {renderBackupProgress(backup)}
            
            {backup.error_message && (
              <Alert
                title={backup.error_message}
                type="error"
                showIcon
                style={{ fontSize: 11, marginTop: 8 }}
                closable={false}
              />
            )}

            {backup.restore_error_message && (
              <Alert
                title={backup.restore_error_message}
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
  const columns = useMemo<ProColumns<DataBackup>[]>(() => alignProColumns([
    {
      // 名称长短不一：唯一 RemainderFlex
      title: t('pages.system.dataBackups.columnName'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      minWidth: 180,
      uniTableRemainderFlex: true,
      uniTablePrimaryFlex: true,
      resizable: false,
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
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
    },
    {
      title: t('pages.system.dataBackups.columnTenantScope'),
      dataIndex: 'backup_scope',
      key: 'backup_scope',
      width: 140,
      minWidth: 140,
      uniTableKeepWidth: true,
      resizable: false,
      valueEnum: {
        tenant: { text: t('pages.system.dataBackups.backupScopeTenantLabel') },
        all: { text: t('pages.system.dataBackups.backupScopeAllLabel') },
      },
      render: (_: unknown, record: DataBackup) => getBackupTenantScopeText(record.backup_scope),
    },
    {
      title: t('pages.system.dataBackups.columnScope'),
      dataIndex: 'include_files',
      key: 'include_files',
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      valueType: 'select',
      valueEnum: {
        true: { text: t('pages.system.dataBackups.contentDataAndFiles') },
        false: { text: t('pages.system.dataBackups.contentDataOnly') },
      },
      render: (_: unknown, record: DataBackup) => getBackupContentScopeText(record.include_files),
    },
    {
      title: t('pages.system.dataBackups.columnRestoreStatus'),
      dataIndex: 'restore_status',
      key: 'restore_status',
      search: false,
      render: (_: any, record: DataBackup) => getRestoreStatusTag(record.restore_status, record.restore_error_message),
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
    },
    {
      title: t('pages.system.dataBackups.columnFileSize'),
      dataIndex: 'file_size',
      key: 'file_size',
      search: false,
      render: (_: any, record: DataBackup) => formatFileSize(record.file_size),
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
    },
    {
      title: t('pages.system.dataBackups.columnStorage'),
      dataIndex: 'storage_label',
      key: 'storage_label',
      search: false,
      width: 120,
      minWidth: 120,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_: unknown, record: DataBackup) =>
        record.storage_label || t('pages.system.dataBackups.policyStorageLocal'),
    },
    {
      title: t('pages.system.dataBackups.columnTriggerSource'),
      dataIndex: 'trigger_source',
      key: 'trigger_source',
      search: false,
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      render: (_: unknown, record: DataBackup) =>
        record.trigger_source === 'scheduled'
          ? t('pages.system.dataBackups.triggerScheduled')
          : t('pages.system.dataBackups.triggerManual'),
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      sorter: true,
      search: false,
      width: 180,
      minWidth: 180,
      uniTableKeepWidth: true,
      resizable: false,
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'lifecycle',
      valueEnum: {
        pending: { text: t('pages.system.dataBackups.statusPending') },
        running: { text: t('pages.system.dataBackups.statusRunning') },
        success: { text: t('pages.system.dataBackups.statusSuccess') },
        failed: { text: t('pages.system.dataBackups.statusFailed') },
      },
      render: (_: any, record: DataBackup) => getStatusTag(record.status),
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      fixed: 'right',
      hideInSearch: true,
    },
    {
      title: t('pages.system.dataBackups.columnProgress'),
      dataIndex: 'progress',
      key: 'progress',
      search: false,
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      fixed: 'right',
      render: (_: unknown, record: DataBackup) => renderBackupProgress(record),
    },
    {
      title: t('common.actions'),
      key: 'action',
      fixed: 'right',
      hideInSearch: true,
      render: (_: any, record: DataBackup) => {
        const actions: React.ReactNode[] = [
          <Button {...rowActionKind('read')} key="view" onClick={() => handleViewDetail(record)} />,
        ];
        if (record.status === 'success') {
          actions.push(
            <Button
              {...rowActionKind('skip')}
              {...rowActionLabelKeep()}
              key="download"
              onClick={() => handleDownload(record)}
            >
              {t('pages.system.dataBackups.downloadBackup')}
            </Button>,
          );
          actions.push(
            <Button
              {...rowActionKind('skip')}
              {...rowActionLabelKeep()}
              key="restore"
              onClick={() => handleRestore(record)}
            >
              {t('pages.system.dataBackups.restore')}
            </Button>,
          );
        }
        actions.push(
          <Popconfirm
            key="delete"
            title={t('pages.system.dataBackups.deleteConfirmTitle')}
            onConfirm={() => handleDelete(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button {...rowActionKind('delete')} />
          </Popconfirm>,
        );
        return actions;
      },
    },
  ], GLOBAL_DOC_LIST_FIELD_RANK), [t, handleViewDetail, handleDownload, handleRestore, handleDelete, renderBackupProgress]);

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
    { title: t('pages.system.dataBackups.columnTenantScope'), dataIndex: 'backup_scope', render: (_, r) => getBackupTenantScopeText(r.backup_scope) },
    { title: t('pages.system.dataBackups.columnScope'), dataIndex: 'include_files', render: (_, r) => getBackupContentScopeText(r.include_files) },
    {
      title: t('pages.system.dataBackups.restoreSourceTenantLabel'),
      dataIndex: 'source_tenant_id',
      render: (_, r) => (r.source_tenant_id != null ? r.source_tenant_id : '-'),
    },
    { title: t('common.status'), dataIndex: 'status', render: (_, r) => getStatusTag(r.status) },
    {
      title: t('pages.system.dataBackups.columnProgress'),
      dataIndex: 'progress',
      render: (_, r) => renderBackupProgress(r),
    },
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
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: t('common.updatedAt'),
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
  ];

  const restoreTargetTenantIdWatched = Form.useWatch('target_tenant_id', restoreForm);
  const restoreTargetTenantId =
    restoreTargetTenantIdWatched ?? currentUser?.tenant_id ?? getTenantId();
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
          columnPersistenceId="pages.system.data-backups.list-v3"
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
            
            const { current, pageSize } = params;
            const filter = resolveDataBackupListFilter(searchFormValues);
            
            try {
              // 获取当前页数据
              const response = await getBackups({
                page: current || 1,
                page_size: pageSize || 20,
                backup_type: filter.backup_type,
                status: filter.status,
                keyword: filter.keyword,
              });
              
              const isActiveJob = (item: DataBackup) =>
                item.status === 'pending' || item.status === 'running';
              const markActiveJobs = (items: DataBackup[]) => {
                const nextActive = items.some(isActiveJob);
                setHasActiveBackupJobs(nextActive);
                if (!nextActive) {
                  void loadWorkerHealth(true);
                }
              };
              // 进度轮询时只合并当前页，禁止每 2.5s 再拉 1000 条（全平台包曾拖死页面）
              if ((current || 1) === 1 && !hasActiveBackupJobs) {
                try {
                  const allResponse = await getBackups({
                    page: 1,
                    page_size: 1000,
                  });
                  setAllBackups(allResponse.items);
                  markActiveJobs(allResponse.items);
                } catch (e) {
                  setAllBackups(response.items);
                  markActiveJobs(response.items);
                }
              } else {
                markActiveJobs(response.items);
                setAllBackups((prev) => {
                  if (!prev.length) return response.items;
                  const byUuid = new Map(response.items.map((item) => [item.uuid, item]));
                  const merged = prev.map((item) => byUuid.get(item.uuid) ?? item);
                  for (const item of response.items) {
                    if (!prev.some((p) => p.uuid === item.uuid)) {
                      merged.unshift(item);
                    }
                  }
                  return merged;
                });
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
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText={t('common.batchDelete')}
          deleteConfirmTitle={t('pages.system.dataBackups.batchDeleteTitle')}
          deleteConfirmDescription={(c) =>
            t('pages.system.dataBackups.batchDeleteDescription', { count: c })
          }
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          toolBarRender={() => [
            <Space key="worker-status" size="medium">
              <Tooltip
                title={
                  <Space orientation="vertical" size={2}>
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
              {workerHealth?.status === 'backlog' ? (
                <Button type="primary" loading={reclaiming} onClick={() => void handleReclaimStalled()}>
                  {t('pages.system.dataBackups.reclaimStalled')}
                </Button>
              ) : null}
            </Space>,
          ]}
          showImportButton={false}
          showExportButton={true}
          exportButtonText={t('pages.system.dataBackups.downloadBackup')}
          rightToolBarActionsBeforeExport={[
            <Button
              key="policy"
              icon={<SettingOutlined />}
              onClick={() => setPolicyModalVisible(true)}
            >
              {t('pages.system.dataBackups.policyButton')}
            </Button>,
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
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              await downloadRecordsAsXlsx(
                items as Array<Record<string, unknown>>,
                `data-backups-${todaySiteDateString()}.xlsx`,
              );
              messageApi.success(t('pages.system.dataBackups.exportSuccess', { count: items.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('common.exportFailed'));
            }
          }}
          viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('system.dataBackups')}
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
        {isInfraAdmin ? (
          <>
            <SafeProFormSelect
              name="backup_scope"
              label={t('pages.system.dataBackups.labelTenantScope')}
              rules={[{ required: true, message: t('pages.system.dataBackups.tenantScopeRequired') }]}
              initialValue="tenant"
              options={[
                { label: t('pages.system.dataBackups.backupScopeTenantLabel'), value: 'tenant' },
                { label: t('pages.system.dataBackups.backupScopeAllLabel'), value: 'all' },
              ]}
              placeholder={t('pages.system.dataBackups.tenantScopePlaceholder')}
              extra={t('pages.system.dataBackups.backupScopeAllHint')}
            />
            <ProFormDependency name={['backup_scope']}>
              {({ backup_scope }) =>
                backup_scope === 'tenant' ? (
                  <SafeProFormSelect
                    name="target_tenant_id"
                    label={t('pages.system.dataBackups.labelTargetTenant')}
                    rules={[{ required: true, message: t('pages.system.dataBackups.targetTenantRequired') }]}
                    initialValue={currentUser?.tenant_id ?? getTenantId() ?? undefined}
                    showSearch
                    placeholder={t('pages.system.dataBackups.targetTenantPlaceholder')}
                    request={async ({ keyWords }) => {
                      const resp = await getTenantList(
                        {
                          page: 1,
                          page_size: 100,
                          status: TenantStatus.ACTIVE,
                          keyword: keyWords || undefined,
                          sort: 'id',
                          order: 'asc',
                        },
                        true,
                      );
                      return (resp.items ?? []).map((tenant) => ({
                        value: Number(tenant.id),
                        label: `${tenant.name} (#${tenant.id})`,
                      }));
                    }}
                  />
                ) : null
              }
            </ProFormDependency>
          </>
        ) : null}
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

        {restoreBackupRecord?.backup_scope === 'all' && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={t('pages.system.dataBackups.restoreAllScopeHint')}
          />
        )}

        {restoreBackupRecord?.include_files === false && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            title={t('pages.system.dataBackups.restoreDataOnlyHint')}
          />
        )}

        {isTenantBackupRestore && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title={t('pages.system.dataBackups.restoreTenantMappingTitle')}
              description={t('pages.system.dataBackups.restorePlatformSafeHint')}
            />

            {!isInfraAdmin && (
              <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
                <Descriptions.Item label={t('pages.system.dataBackups.restoreTargetTenantLabel')}>
                  {t('pages.system.dataBackups.restoreTargetTenantDesc', {
                    id: restoreTargetTenantId ?? '-',
                  })}
                </Descriptions.Item>
              </Descriptions>
            )}

            <Form form={restoreForm} layout="vertical">
              {isInfraAdmin ? (
                <Form.Item
                  name="target_tenant_id"
                  label={t('pages.system.dataBackups.labelTargetTenant')}
                  extra={t('pages.system.dataBackups.restoreTargetTenantExtra')}
                  rules={[
                    {
                      required: true,
                      message: t('pages.system.dataBackups.restoreTargetTenantRequired'),
                    },
                  ]}
                >
                  <Select
                    showSearch
                    optionFilterProp="label"
                    allowClear
                    placeholder={t('pages.system.dataBackups.targetTenantPlaceholder')}
                    options={restoreTenantOptions}
                    onSearch={(keyword) => {
                      void loadRestoreTenantOptions(keyword);
                    }}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              ) : null}
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
                title={t('pages.system.dataBackups.restoreMigrationHint', {
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
                title={t('pages.system.dataBackups.restoreSameTenantHint')}
              />
            )}
          </>
        )}
      </Modal>

      {/* 备份详情 Drawer */}
      <SystemMasterDetailDrawer
        title={t('pages.system.dataBackups.detailTitle')}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentBackup(null);
          setDetailError(null);
        }}
        detail={currentBackup}
        detailColumns={detailColumns}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
      />
      <BackupPolicyModal
        open={policyModalVisible}
        onClose={() => setPolicyModalVisible(false)}
        isInfraAdmin={isInfraAdmin}
        boundTenantId={boundTenantId}
        boundTenantName={boundTenantName}
      />
    </>
  );
};

export default DataBackupsPage;
