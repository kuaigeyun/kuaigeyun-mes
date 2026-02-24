/**
 * 数据源管理 - 卡片视图组件
 * 
 * 提供卡片布局的数据源展示界面
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Card, Tag, Space, Button, Modal, Descriptions, Popconfirm, Statistic, Row, Col, Badge, Typography, Empty, Tooltip, Progress, Alert, theme } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, ThunderboltOutlined, ReloadOutlined, DatabaseOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  getDataSourceList,
  getDataSourceByUuid,
  updateDataSource,
  deleteDataSource,
  testDataSourceConnection,
  DataSource,
  DataSourceListResponse,
  TestConnectionResponse,
} from '../../../services/dataSource';
import { handleError, handleSuccess } from '../../../utils/errorHandler';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { useToken } = theme;

/**
 * 卡片视图组件
 */
const CardView: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const [loading, setLoading] = useState(false);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentDataSource, setCurrentDataSource] = useState<DataSource | null>(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [testingUuid, setTestingUuid] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 加载数据源列表
   */
  const loadDataSources = async () => {
    setLoading(true);
    try {
      const response: DataSourceListResponse = await getDataSourceList({
        page: 1,
        page_size: 1000, // 加载所有数据源
      });
      setDataSources(response.items);
    } catch (error: any) {
      handleError(error, t('pages.system.dataSources.loadListFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadDataSources();
  }, []);

  /**
   * 设置自动刷新（每60秒刷新一次）
   */
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      loadDataSources();
    }, 60000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  /**
   * 查看数据源详情
   */
  const handleViewDetail = async (dataSource: DataSource) => {
    try {
      const detail = await getDataSourceByUuid(dataSource.uuid);
      setCurrentDataSource(detail);
      setDetailModalVisible(true);
    } catch (error: any) {
      handleError(error, t('pages.system.dataSources.getDetailFailed'));
    }
  };

  /**
   * 测试数据源连接
   */
  const handleTestConnection = async (dataSource: DataSource) => {
    try {
      setTestingUuid(dataSource.uuid);
      setTestModalVisible(true);
      setTestResult(null);
      
      const result = await testDataSourceConnection(dataSource.uuid);
      setTestResult(result);
      
      if (result.success) {
        handleSuccess(result.message || t('pages.system.dataSources.testSuccess'));
        loadDataSources();
      } else {
        handleError(new Error(result.message || t('pages.system.dataSources.testFailed')), t('pages.system.dataSources.testFailed'));
      }
    } catch (error: any) {
      handleError(error, t('pages.system.dataSources.testFailed'));
      setTestResult({
        success: false,
        message: error.message || t('pages.system.dataSources.testFailed'),
        elapsed_time: 0,
      });
    } finally {
      setTestingUuid(null);
    }
  };

  /**
   * 删除数据源
   */
  const handleDelete = async (dataSource: DataSource) => {
    try {
      await deleteDataSource(dataSource.uuid);
      handleSuccess(t('pages.system.dataSources.deleteSuccess'));
      loadDataSources();
    } catch (error: any) {
      handleError(error, t('pages.system.dataSources.deleteFailed'));
    }
  };

  /**
   * 获取数据源类型图标和颜色
   */
  const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
    const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      postgresql: { 
        color: 'blue', 
        text: 'PostgreSQL',
        icon: <DatabaseOutlined />,
      },
      mysql: { 
        color: 'orange', 
        text: 'MySQL',
        icon: <DatabaseOutlined />,
      },
      mongodb: { 
        color: 'green', 
        text: 'MongoDB',
        icon: <DatabaseOutlined />,
      },
      api: { 
        color: 'default', 
        text: 'API',
        icon: <DatabaseOutlined />,
      },
    };
    return typeMap[type] || { color: 'default', text: type, icon: <DatabaseOutlined /> };
  };

  /**
   * 获取连接状态显示（i18n）
   */
  const getConnectionStatus = (dataSource: DataSource): { status: 'success' | 'error' | 'warning' | 'default'; text: string } => {
    if (!dataSource.is_active) return { status: 'default', text: t('pages.system.dataSources.statusDisabled') };
    if (dataSource.is_connected) return { status: 'success', text: t('pages.system.dataSources.statusConnected') };
    if (dataSource.last_error) return { status: 'error', text: t('pages.system.dataSources.statusFailed') };
    return { status: 'warning', text: t('pages.system.dataSources.statusNotConnected') };
  };

  /**
   * 计算统计信息
   */
  const stats = {
    total: dataSources.length,
    connected: dataSources.filter((ds) => ds.is_connected && ds.is_active).length,
    disconnected: dataSources.filter((ds) => !ds.is_connected && ds.is_active).length,
    inactive: dataSources.filter((ds) => !ds.is_active).length,
    byType: dataSources.reduce((acc, ds) => {
      acc[ds.type] = (acc[ds.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <>
      <PageContainer
        title={t('pages.system.dataSources.cardView.pageTitle')}
        extra={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={loadDataSources}
            loading={loading}
          >
            {t('pages.system.dataSources.cardView.refresh')}
          </Button>,
        ]}
      >
        {/* 统计卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataSources.statTotal')}
                value={stats.total}
                prefix={<DatabaseOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataSources.statConnected')}
                value={stats.connected}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataSources.statDisconnected')}
                value={stats.disconnected}
                prefix={<CloseCircleOutlined />}
                styles={{ content: { color: '#ff4d4f' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.dataSources.statInactive')}
                value={stats.inactive}
                prefix={<ExclamationCircleOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            </Col>
          </Row>
          {Object.keys(stats.byType).length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${token.colorBorder}` }}>
              <Text type="secondary" style={{ marginRight: 8 }}>{t('pages.system.dataSources.cardView.statsByType')}</Text>
              <Space wrap>
                {Object.entries(stats.byType).map(([type, count]) => {
                  const typeInfo = getTypeInfo(type);
                  return (
                    <Tag key={type} color={typeInfo.color} icon={typeInfo.icon}>
                      {typeInfo.text}: {count}
                    </Tag>
                  );
                })}
              </Space>
            </div>
          )}
        </Card>

        {/* 数据源卡片列表 */}
        <Card loading={loading}>
          {dataSources.length > 0 ? (
            <Row gutter={[16, 16]}>
              {dataSources.map((dataSource) => {
                const typeInfo = getTypeInfo(dataSource.type);
                const connectionStatus = getConnectionStatus(dataSource);
                
                return (
                  <Col key={dataSource.uuid} xs={24} sm={12} md={8} lg={6} xl={6}>
                    <Card
                      hoverable
                      style={{ height: '100%' }}
                      actions={[
                        <Tooltip key="view" title={t('pages.system.dataSources.viewDetail')}>
                          <EyeOutlined
                            onClick={() => handleViewDetail(dataSource)}
                            style={{ fontSize: 16 }}
                          />
                        </Tooltip>,
                        <Tooltip key="test" title={t('pages.system.dataSources.testConnection')}>
                          <ThunderboltOutlined
                            onClick={() => handleTestConnection(dataSource)}
                            style={{ fontSize: 16, color: '#1890ff' }}
                          />
                        </Tooltip>,
                        <Popconfirm
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
                      ]}
                    >
                      <div style={{ marginBottom: 16 }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 16 }}>
                              {dataSource.name}
                            </Text>
                            <Tag color={typeInfo.color} icon={typeInfo.icon}>
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
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
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
                  </Col>
                );
              })}
            </Row>
          ) : (
            <Empty description={t('pages.system.dataSources.cardView.empty')} />
          )}
        </Card>
      </PageContainer>

      {/* 数据源详情 Modal */}
      <Modal
        title={t('pages.system.dataSources.detailTitle')}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentDataSource(null);
        }}
        footer={null}
        size={800}
      >
        {currentDataSource && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label={t('pages.system.dataSources.detailColumnName')}>
              {currentDataSource.name}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataSources.detailColumnCode')}>
              {currentDataSource.code}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataSources.detailColumnType')}>
              <Tag color={getTypeInfo(currentDataSource.type).color}>
                {getTypeInfo(currentDataSource.type).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataSources.detailColumnDescription')}>
              {currentDataSource.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataSources.detailColumnConfig')}>
              <pre style={{
                margin: 0,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '300px',
                fontSize: 12,
              }}>
                {JSON.stringify(currentDataSource.config, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataSources.detailColumnConnectionStatus')}>
              <Badge
                status={getConnectionStatus(currentDataSource).status}
                text={getConnectionStatus(currentDataSource).text}
              />
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataSources.detailColumnActive')}>
              <Tag color={currentDataSource.is_active ? 'success' : 'default'}>
                {currentDataSource.is_active ? t('pages.system.dataSources.enabled') : t('pages.system.dataSources.disabled')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataSources.detailColumnLastConnected')}>
              {currentDataSource.last_connected_at
                ? dayjs(currentDataSource.last_connected_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            {currentDataSource.last_error && (
              <Descriptions.Item label={t('pages.system.dataSources.detailColumnLastError')}>
                <Alert
                  message={currentDataSource.last_error}
                  type="error"
                  showIcon
                  style={{ fontSize: 12 }}
                />
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('pages.system.dataSources.detailColumnCreatedAt')}>
              {dayjs(currentDataSource.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.dataSources.detailColumnUpdatedAt')}>
              {dayjs(currentDataSource.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 连接测试 Modal */}
      <Modal
        title={t('pages.system.dataSources.cardView.testModalTitle')}
        open={testModalVisible}
        onCancel={() => {
          setTestModalVisible(false);
          setTestResult(null);
          setTestingUuid(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setTestModalVisible(false);
            setTestResult(null);
            setTestingUuid(null);
          }}>
            {t('pages.system.dataSources.cardView.close')}
          </Button>,
        ]}
        size={600}
      >
        {testingUuid && !testResult && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Progress type="circle" percent={100} status="active" />
            <div style={{ marginTop: 16 }}>
              <Text>{t('pages.system.dataSources.cardView.testing')}</Text>
            </div>
          </div>
        )}
        
        {testResult && (
          <div>
            <Alert
              message={testResult.success ? t('pages.system.dataSources.testSuccess') : t('pages.system.dataSources.testFailed')}
              description={testResult.message}
              type={testResult.success ? 'success' : 'error'}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Descriptions column={1} bordered>
              <Descriptions.Item label={t('pages.system.dataSources.cardView.testResultLabel')}>
                <Tag color={testResult.success ? 'success' : 'error'}>
                  {testResult.success ? t('pages.system.dataSources.cardView.resultSuccess') : t('pages.system.dataSources.cardView.resultFailure')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.system.dataSources.cardView.responseTimeLabel')}>
                {testResult.elapsed_time}ms
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.system.dataSources.cardView.messageLabel')}>
                {testResult.message}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </>
  );
};

export default CardView;

