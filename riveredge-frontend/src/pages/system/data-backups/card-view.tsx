/**
 * 数据备份管理 - 卡片视图组件
 * 
 * 提供卡片布局的数据备份展示界面，支持备份状态可视化、统计仪表盘和策略配置
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Card, Tag, Space, Button, Modal, Descriptions, Popconfirm, Statistic, Row, Col, Badge, Typography, Empty, Tooltip, Alert, Progress, Divider, theme } from 'antd';
import { EyeOutlined, DeleteOutlined, ReloadOutlined, CloudDownloadOutlined, SettingOutlined, DatabaseOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  getBackups,
  getBackupDetail,
  restoreBackup,
  deleteBackup,
  DataBackup,
  DataBackupListResponse,
} from '../../../services/dataBackup';
import { handleError, handleSuccess } from '../../../utils/errorHandler';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate } from 'react-router-dom';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
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
 * 卡片视图组件
 */
const CardView: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<DataBackup[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentBackup, setCurrentBackup] = useState<DataBackup | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 加载备份列表
   */
  const loadBackups = async () => {
    setLoading(true);
    try {
      const response: DataBackupListResponse = await getBackups({
        page: 1,
        page_size: 1000, // 加载所有备份
      });
      setBackups(response.items);
    } catch (error: any) {
      handleError(error, t('pages.system.dataBackups.loadListFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadBackups();
  }, []);

  /**
   * 设置自动刷新（每60秒刷新一次）
   */
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      loadBackups();
    }, 60000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  /**
   * 查看备份详情
   */
  const handleViewDetail = async (backup: DataBackup) => {
    try {
      const detail = await getBackupDetail(backup.uuid);
      setCurrentBackup(detail);
      setDetailModalVisible(true);
    } catch (error: any) {
      handleError(error, t('pages.system.dataBackups.getDetailFailed'));
    }
  };

  /**
   * 恢复备份
   */
  const handleRestore = async (backup: DataBackup) => {
    try {
      const result = await restoreBackup(backup.uuid, true);
      if (result.success) {
        handleSuccess(result.message || t('pages.system.dataBackups.restoreSuccess'));
        loadBackups();
      } else {
        handleError(new Error(result.error || t('pages.system.dataBackups.restoreFailed')), t('pages.system.dataBackups.restoreFailed'));
      }
    } catch (error: any) {
      handleError(error, t('pages.system.dataBackups.restoreFailed'));
    }
  };

  /**
   * 删除备份
   */
  const handleDelete = async (backup: DataBackup) => {
    try {
      await deleteBackup(backup.uuid);
      handleSuccess(t('pages.system.dataBackups.deleteSuccess'));
      loadBackups();
    } catch (error: any) {
      handleError(error, t('pages.system.dataBackups.deleteFailed'));
    }
  };

  /**
   * 跳转到备份策略配置
   */
  const handleGoToStrategy = () => {
    navigate('/system/system-parameters?group=backup');
  };

  /**
   * 获取备份类型标签
   */
  const getBackupTypeTag = (type: string): { color: string; text: string } => {
    const typeMap: Record<string, { color: string; textKey: string }> = {
      full: { color: 'blue', textKey: 'pages.system.dataBackups.typeFull' },
      incremental: { color: 'green', textKey: 'pages.system.dataBackups.typeIncremental' },
    };
    const info = typeMap[type] || { color: 'default', textKey: '' };
    return { color: info.color, text: info.textKey ? t(info.textKey) : type };
  };

  const getStatusInfo = (status: string): { 
    status: 'success' | 'error' | 'processing' | 'default'; 
    text: string;
  } => {
    const statusMap: Record<string, { status: 'success' | 'error' | 'processing' | 'default'; textKey: string }> = {
      pending: { status: 'default', textKey: 'pages.system.dataBackups.statusPending' },
      running: { status: 'processing', textKey: 'pages.system.dataBackups.statusRunning' },
      success: { status: 'success', textKey: 'pages.system.dataBackups.statusSuccess' },
      failed: { status: 'error', textKey: 'pages.system.dataBackups.statusFailed' },
    };
    const info = statusMap[status] || { status: 'default', textKey: '' };
    return { status: info.status, text: info.textKey ? t(info.textKey) : status };
  };

  const getBackupScopeText = (scope: string): string => {
    const scopeMap: Record<string, string> = {
      all: t('pages.system.dataBackups.scopeAll'),
      tenant: t('pages.system.dataBackups.scopeTenant'),
      table: t('pages.system.dataBackups.scopeTable'),
    };
    return scopeMap[scope] || scope;
  };

  /**
   * 计算统计信息
   */
  const stats = {
    total: backups.length,
    success: backups.filter((b) => b.status === 'success').length,
    failed: backups.filter((b) => b.status === 'failed').length,
    running: backups.filter((b) => b.status === 'running').length,
    pending: backups.filter((b) => b.status === 'pending').length,
    full: backups.filter((b) => b.backup_type === 'full').length,
    incremental: backups.filter((b) => b.backup_type === 'incremental').length,
    totalSize: backups.reduce((sum, b) => sum + (b.file_size || 0), 0),
    successSize: backups
      .filter((b) => b.status === 'success')
      .reduce((sum, b) => sum + (b.file_size || 0), 0),
  };

  return (
    <>
      <PageContainer
        title={t('pages.system.dataBackups.cardViewTitle')}
        extra={[
          <Button
            key="strategy"
            icon={<SettingOutlined />}
            onClick={handleGoToStrategy}
          >
            {t('pages.system.dataBackups.strategyConfig')}
          </Button>,
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={loadBackups}
            loading={loading}
          >
            {t('pages.system.dataBackups.refresh')}
          </Button>,
        ]}
      >
        {/* 统计仪表盘 */}
        <Card style={{ marginBottom: 16 }} title={t('pages.system.dataBackups.statsTitle')}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataBackups.statTotal')}
                value={stats.total}
                prefix={<DatabaseOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataBackups.statSuccess')}
                value={stats.success}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataBackups.statFailed')}
                value={stats.failed}
                prefix={<CloseCircleOutlined />}
                styles={{ content: { color: '#ff4d4f' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataBackups.statRunning')}
                value={stats.running}
                prefix={<ClockCircleOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataBackups.statFull')}
                value={stats.full}
                prefix={<DatabaseOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataBackups.statIncremental')}
                value={stats.incremental}
                prefix={<DatabaseOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataBackups.statTotalSize')}
                value={formatFileSize(stats.totalSize)}
                prefix={<CloudDownloadOutlined />}
                styles={{ content: { color: '#722ed1' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataBackups.statSuccessSize')}
                value={formatFileSize(stats.successSize)}
                prefix={<CloudDownloadOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
          </Row>
        </Card>

        {/* 备份卡片列表 */}
        <Card loading={loading}>
          {backups.length > 0 ? (
            <Row gutter={[16, 16]}>
              {backups.map((backup) => {
                const typeInfo = getBackupTypeTag(backup.backup_type);
                const statusInfo = getStatusInfo(backup.status);
                
                return (
                  <Col key={backup.uuid} xs={24} sm={12} md={8} lg={6} xl={6}>
                    <Card
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
                  </Col>
                );
              })}
            </Row>
          ) : (
            <Empty description={t('pages.system.dataBackups.noBackups')} />
          )}
        </Card>
      </PageContainer>

      {/* 备份详情 Modal */}
      <Modal
        title={t('pages.system.dataBackups.detailTitle')}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentBackup(null);
        }}
        footer={null}
        size={800}
      >
        {currentBackup && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label={t('pages.system.dataBackups.columnName')}>
              {currentBackup.name}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataBackups.columnType')}>
              <Tag color={getBackupTypeTag(currentBackup.backup_type).color}>
                {getBackupTypeTag(currentBackup.backup_type).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataBackups.columnScope')}>
              {getBackupScopeText(currentBackup.backup_scope)}
            </Descriptions.Item>
            {currentBackup.backup_tables && currentBackup.backup_tables.length > 0 && (
              <Descriptions.Item label={t('pages.system.dataBackups.backupTables')}>
                {currentBackup.backup_tables.join(', ')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('pages.system.dataBackups.columnStatus')}>
              <Badge
                status={getStatusInfo(currentBackup.status).status}
                text={getStatusInfo(currentBackup.status).text}
              />
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataBackups.columnFilePath')}>
              {currentBackup.file_path || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataBackups.columnFileSize')}>
              {formatFileSize(currentBackup.file_size)}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataBackups.columnStartedAt')}>
              {currentBackup.started_at
                ? dayjs(currentBackup.started_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataBackups.columnCompletedAt')}>
              {currentBackup.completed_at
                ? dayjs(currentBackup.completed_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            {currentBackup.error_message && (
              <Descriptions.Item label={t('pages.system.dataBackups.columnError')}>
                <Alert
                  message={currentBackup.error_message}
                  type="error"
                  showIcon
                  style={{ fontSize: 12 }}
                />
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('pages.system.dataBackups.columnCreatedAt')}>
              {dayjs(currentBackup.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataBackups.columnUpdatedAt')}>
              {dayjs(currentBackup.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </>
  );
};

export default CardView;

