/**
 * 数据备份管理 - 卡片视图组件
 * 
 * 提供卡片布局的数据备份展示界面，支持备份状态可视化、统计仪表盘和策略配置
 */

import React, { useState, useEffect, useRef } from 'react';
import { App, Card, Tag, Space, Button, Modal, Descriptions, Popconfirm, Statistic, Row, Col, Badge, Typography, Empty, Tooltip, Alert, Progress, Divider } from 'antd';
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
  const { message: messageApi } = App.useApp();
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
      handleError(error, '加载备份列表失败');
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
      handleError(error, '获取备份详情失败');
    }
  };

  /**
   * 恢复备份
   */
  const handleRestore = async (backup: DataBackup) => {
    try {
      const result = await restoreBackup(backup.uuid, true);
      if (result.success) {
        handleSuccess(result.message || '备份恢复成功');
        loadBackups();
      } else {
        handleError(new Error(result.error || '备份恢复失败'), '备份恢复失败');
      }
    } catch (error: any) {
      handleError(error, '备份恢复失败');
    }
  };

  /**
   * 删除备份
   */
  const handleDelete = async (backup: DataBackup) => {
    try {
      await deleteBackup(backup.uuid);
      handleSuccess('删除成功');
      loadBackups();
    } catch (error: any) {
      handleError(error, '删除失败');
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
    const typeMap: Record<string, { color: string; text: string }> = {
      full: { color: 'blue', text: '全量' },
      incremental: { color: 'green', text: '增量' },
    };
    return typeMap[type] || { color: 'default', text: type };
  };

  /**
   * 获取备份状态显示
   */
  const getStatusInfo = (status: string): { 
    status: 'success' | 'error' | 'processing' | 'default'; 
    text: string;
  } => {
    const statusMap: Record<string, { status: 'success' | 'error' | 'processing' | 'default'; text: string }> = {
      pending: { status: 'default', text: '待执行' },
      running: { status: 'processing', text: '执行中' },
      success: { status: 'success', text: '成功' },
      failed: { status: 'error', text: '失败' },
    };
    return statusMap[status] || { status: 'default', text: status };
  };

  /**
   * 获取备份范围文本
   */
  const getBackupScopeText = (scope: string): string => {
    const scopeMap: Record<string, string> = {
      all: '全部',
      tenant: '组织',
      table: '表',
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
        title="数据备份管理"
        extra={[
          <Button
            key="strategy"
            icon={<SettingOutlined />}
            onClick={handleGoToStrategy}
          >
            备份策略配置
          </Button>,
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={loadBackups}
            loading={loading}
          >
            刷新
          </Button>,
        ]}
      >
        {/* 统计仪表盘 */}
        <Card style={{ marginBottom: 16 }} title="备份统计">
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="总备份数"
                value={stats.total}
                prefix={<DatabaseOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="成功备份"
                value={stats.success}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="失败备份"
                value={stats.failed}
                prefix={<CloseCircleOutlined />}
                styles={{ content: { color: '#ff4d4f' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="执行中"
                value={stats.running}
                prefix={<ClockCircleOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="全量备份"
                value={stats.full}
                prefix={<DatabaseOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="增量备份"
                value={stats.incremental}
                prefix={<DatabaseOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="总备份大小"
                value={formatFileSize(stats.totalSize)}
                prefix={<CloudDownloadOutlined />}
                styles={{ content: { color: '#722ed1' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="成功备份大小"
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
                        <Tooltip key="view" title="查看详情">
                          <EyeOutlined
                            onClick={() => handleViewDetail(backup)}
                            style={{ fontSize: 16 }}
                          />
                        </Tooltip>,
                        backup.status === 'success' ? (
                          <Tooltip key="restore" title="恢复备份">
                            <ReloadOutlined
                              onClick={() => {
                                Modal.confirm({
                                  title: '确定要恢复此备份吗？',
                                  content: '此操作将覆盖当前数据库数据，请谨慎操作！',
                                  okText: '确定',
                                  cancelText: '取消',
                                  onOk: () => handleRestore(backup),
                                });
                              }}
                              style={{ fontSize: 16, color: '#1890ff' }}
                            />
                          </Tooltip>
                        ) : null,
                        <Popconfirm
                          key="delete"
                          title="确定要删除这个备份吗？"
                          onConfirm={() => handleDelete(backup)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Tooltip title="删除">
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
                            <Text type="secondary" style={{ fontSize: 12 }}>备份范围：</Text>
                            <Text style={{ fontSize: 12 }}>{getBackupScopeText(backup.backup_scope)}</Text>
                          </div>
                        </Space>
                      </div>
                      
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>状态：</Text>
                            <Badge
                              status={statusInfo.status}
                              text={statusInfo.text}
                            />
                          </div>
                          
                          {backup.file_size && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>文件大小：</Text>
                              <Text style={{ fontSize: 12 }}>{formatFileSize(backup.file_size)}</Text>
                            </div>
                          )}
                          
                          {backup.started_at && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>开始时间：</Text>
                              <Text style={{ fontSize: 12 }}>
                                {dayjs(backup.started_at).format('MM-DD HH:mm')}
                              </Text>
                            </div>
                          )}
                          
                          {backup.completed_at && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>完成时间：</Text>
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
            <Empty description="暂无备份记录" />
          )}
        </Card>
      </PageContainer>

      {/* 备份详情 Modal */}
      <Modal
        title="备份详情"
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
            <Descriptions.Item label="备份名称">
              {currentBackup.name}
            </Descriptions.Item>
            <Descriptions.Item label="备份类型">
              <Tag color={getBackupTypeTag(currentBackup.backup_type).color}>
                {getBackupTypeTag(currentBackup.backup_type).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="备份范围">
              {getBackupScopeText(currentBackup.backup_scope)}
            </Descriptions.Item>
            {currentBackup.backup_tables && currentBackup.backup_tables.length > 0 && (
              <Descriptions.Item label="备份表">
                {currentBackup.backup_tables.join(', ')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="状态">
              <Badge
                status={getStatusInfo(currentBackup.status).status}
                text={getStatusInfo(currentBackup.status).text}
              />
            </Descriptions.Item>
            <Descriptions.Item label="文件路径">
              {currentBackup.file_path || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="文件大小">
              {formatFileSize(currentBackup.file_size)}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {currentBackup.started_at
                ? dayjs(currentBackup.started_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间">
              {currentBackup.completed_at
                ? dayjs(currentBackup.completed_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            {currentBackup.error_message && (
              <Descriptions.Item label="错误信息">
                <Alert
                  message={currentBackup.error_message}
                  type="error"
                  showIcon
                  style={{ fontSize: 12 }}
                />
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">
              {dayjs(currentBackup.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(currentBackup.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </>
  );
};

export default CardView;

