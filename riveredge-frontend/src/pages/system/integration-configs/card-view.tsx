/**
 * 集成设置 - 卡片视图组件
 * 
 * 提供卡片布局的集成配置展示界面，按集成类型分组
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Card, Tag, Space, Button, Modal, Descriptions, Popconfirm, Statistic, Row, Col, Badge, Typography, Empty, Tooltip, Progress, Alert, Collapse, Divider, theme } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, ApiOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, LinkOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  getIntegrationConfigList,
  getIntegrationConfigByUuid,
  updateIntegrationConfig,
  deleteIntegrationConfig,
  testConnection,
  IntegrationConfig,
  TestConnectionResponse,
} from '../../../services/integrationConfig';
import { handleError, handleSuccess } from '../../../utils/errorHandler';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { useToken } = theme;

/**
 * 卡片视图组件
 */
const CardView: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = useToken();
  const [loading, setLoading] = useState(false);
  const [integrationConfigs, setIntegrationConfigs] = useState<IntegrationConfig[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentIntegration, setCurrentIntegration] = useState<IntegrationConfig | null>(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [testingUuid, setTestingUuid] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 加载集成配置列表
   */
  const loadIntegrationConfigs = async () => {
    setLoading(true);
    try {
      const configs = await getIntegrationConfigList();
      setIntegrationConfigs(configs);
    } catch (error: any) {
      handleError(error, t('pages.system.integrationConfigs.getListFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadIntegrationConfigs();
  }, []);

  /**
   * 设置自动刷新（每60秒刷新一次）
   */
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      loadIntegrationConfigs();
    }, 60000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  /**
   * 查看集成配置详情
   */
  const handleViewDetail = async (integration: IntegrationConfig) => {
    try {
      const detail = await getIntegrationConfigByUuid(integration.uuid);
      setCurrentIntegration(detail);
      setDetailModalVisible(true);
    } catch (error: any) {
      handleError(error, t('pages.system.integrationConfigs.getDetailFailed'));
    }
  };

  /**
   * 测试集成连接
   */
  const handleTestConnection = async (integration: IntegrationConfig) => {
    try {
      setTestingUuid(integration.uuid);
      setTestModalVisible(true);
      setTestResult(null);
      
      const result = await testConnection(integration.uuid);
      setTestResult(result);
      
      if (result.success) {
        handleSuccess(result.message || t('pages.system.integrationConfigs.testSuccess'));
        // 刷新列表以更新连接状态
        loadIntegrationConfigs();
      } else {
        handleError(new Error(result.message || t('pages.system.integrationConfigs.testFailed')), t('pages.system.integrationConfigs.testFailed'));
      }
    } catch (error: any) {
      handleError(error, t('pages.system.integrationConfigs.testFailed'));
      setTestResult({
        success: false,
        message: error.message || t('pages.system.integrationConfigs.testFailed'),
        error: error.message,
      });
    } finally {
      setTestingUuid(null);
    }
  };

  /**
   * 删除集成配置
   */
  const handleDelete = async (integration: IntegrationConfig) => {
    try {
      await deleteIntegrationConfig(integration.uuid);
      handleSuccess(t('pages.system.integrationConfigs.deleteSuccess'));
      loadIntegrationConfigs();
    } catch (error: any) {
      handleError(error, t('pages.system.integrationConfigs.deleteFailed'));
    }
  };

  /**
   * 获取集成类型图标和颜色
   */
  const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
    const typeMap: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
      OAuth: { 
        color: 'default', 
        text: 'OAuth',
        icon: <LinkOutlined />,
      },
      API: { 
        color: 'blue', 
        text: 'API',
        icon: <ApiOutlined />,
      },
      Webhook: { 
        color: 'green', 
        text: 'Webhook',
        icon: <LinkOutlined />,
      },
      Database: { 
        color: 'orange', 
        text: 'Database',
        icon: <ApiOutlined />,
      },
    };
    return typeMap[type] || { color: 'default', text: type, icon: <ApiOutlined /> };
  };

  /**
   * 获取连接状态显示
   */
  const getConnectionStatus = (integration: IntegrationConfig): { status: 'success' | 'error' | 'warning' | 'default'; text: string } => {
    if (!integration.is_active) {
      return { status: 'default', text: t('pages.system.integrationConfigs.statusDisabled') };
  }
  if (integration.is_connected) {
    return { status: 'success', text: t('pages.system.integrationConfigs.statusConnected') };
  }
  if (integration.last_error) {
    return { status: 'error', text: t('pages.system.integrationConfigs.statusFailed') };
  }
  return { status: 'warning', text: t('pages.system.integrationConfigs.statusDisconnected') };
};

  /**
   * 按类型分组集成配置
   */
  const groupedByType = integrationConfigs.reduce((acc, integration) => {
    if (!acc[integration.type]) {
      acc[integration.type] = [];
    }
    acc[integration.type].push(integration);
    return acc;
  }, {} as Record<string, IntegrationConfig[]>);

  /**
   * 计算统计信息
   */
  const stats = {
    total: integrationConfigs.length,
    connected: integrationConfigs.filter((ic) => ic.is_connected && ic.is_active).length,
    disconnected: integrationConfigs.filter((ic) => !ic.is_connected && ic.is_active).length,
    inactive: integrationConfigs.filter((ic) => !ic.is_active).length,
    byType: integrationConfigs.reduce((acc, ic) => {
      acc[ic.type] = (acc[ic.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  /**
   * 类型顺序（用于排序）
   */
  const typeOrder = ['OAuth', 'API', 'Webhook', 'Database'];

  return (
    <>
      <PageContainer
        title={t('pages.system.integrationConfigs.cardViewTitle')}
        extra={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={loadIntegrationConfigs}
            loading={loading}
          >
            {t('pages.system.integrationConfigs.refresh')}
          </Button>,
        ]}
      >
        {/* 统计卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.integrationConfigs.totalCount')}
                value={stats.total}
                prefix={<ApiOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.integrationConfigs.connectedCount')}
                value={stats.connected}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.integrationConfigs.disconnectedCount')}
                value={stats.disconnected}
                prefix={<CloseCircleOutlined />}
                styles={{ content: { color: '#ff4d4f' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.integrationConfigs.disabledCount')}
                value={stats.inactive}
                prefix={<ExclamationCircleOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            </Col>
          </Row>
          {Object.keys(stats.byType).length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${token.colorBorder}` }}>
              <Text type="secondary" style={{ marginRight: 8 }}>{t('pages.system.integrationConfigs.byTypeStats')}</Text>
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

        {/* 按类型分组的集成配置卡片 */}
        <Card loading={loading}>
          {integrationConfigs.length > 0 ? (
            <Collapse
              defaultActiveKey={typeOrder.filter((type) => groupedByType[type]?.length > 0)}
              style={{ background: 'transparent' }}
            >
              {typeOrder.map((type) => {
                const configs = groupedByType[type] || [];
                if (configs.length === 0) return null;
                
                const typeInfo = getTypeInfo(type);
                const typeStats = {
                  total: configs.length,
                  connected: configs.filter((ic) => ic.is_connected && ic.is_active).length,
                  disconnected: configs.filter((ic) => !ic.is_connected && ic.is_active).length,
                };

                return (
                  <Panel
                    key={type}
                    header={
                      <Space>
                        <Tag color={typeInfo.color} icon={typeInfo.icon} style={{ margin: 0 }}>
                          {typeInfo.text}
                        </Tag>
                        <Text type="secondary">
                          {t('pages.system.integrationConfigs.itemsCount', { count: typeStats.total })}
                        </Text>
                        <Divider orientation="vertical" />
                        <Badge status="success" text={`${t('pages.system.integrationConfigs.connectedLabel')}: ${typeStats.connected}`} />
                        <Badge status="warning" text={`${t('pages.system.integrationConfigs.disconnectedLabel')}: ${typeStats.disconnected}`} />
                      </Space>
                    }
                  >
                    <Row gutter={[16, 16]}>
                      {configs.map((integration) => {
                        const connectionStatus = getConnectionStatus(integration);
                        
                        return (
                          <Col key={integration.uuid} xs={24} sm={12} md={8} lg={6} xl={6}>
                            <Card
                              hoverable
                              style={{ height: '100%' }}
                              actions={[
                                <Tooltip title={t('pages.system.integrationConfigs.viewDetail')}>
                                  <EyeOutlined
                                    key="view"
                                    onClick={() => handleViewDetail(integration)}
                                    style={{ fontSize: 16 }}
                                  />
                                </Tooltip>,
                                <Tooltip title={t('pages.system.integrationConfigs.testConnection')}>
                                  <ApiOutlined
                                    key="test"
                                    onClick={() => handleTestConnection(integration)}
                                    style={{ fontSize: 16, color: '#1890ff' }}
                                  />
                                </Tooltip>,
                                <Popconfirm
                                  key="delete"
                                  title={t('pages.system.integrationConfigs.confirmDelete')}
                                  onConfirm={() => handleDelete(integration)}
                                  okText={t('common.confirm')}
                                  cancelText={t('common.cancel')}
                                >
                                  <Tooltip title={t('pages.system.integrationConfigs.delete')}>
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
                                      {integration.name}
                                    </Text>
                                    <Tag color={typeInfo.color} icon={typeInfo.icon}>
                                      {typeInfo.text}
                                    </Tag>
                                  </div>
                                  
                                  {integration.code && (
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                      {t('pages.system.integrationConfigs.code')}: {integration.code}
                                    </Text>
                                  )}
                                  
                                  {integration.description && (
                                    <Paragraph
                                      ellipsis={{ rows: 2, expandable: false }}
                                      style={{ marginBottom: 0, fontSize: 12 }}
                                    >
                                      {integration.description}
                                    </Paragraph>
                                  )}
                                </Space>
                              </div>
                              
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.integrationConfigs.connectionStatus')}：</Text>
                                    <Badge
                                      status={connectionStatus.status}
                                      text={connectionStatus.text}
                                    />
                                  </div>
                                  
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.integrationConfigs.enableStatus')}：</Text>
                                    <Tag color={integration.is_active ? 'success' : 'default'}>
                                      {integration.is_active ? t('pages.system.integrationConfigs.enabled') : t('pages.system.integrationConfigs.disabled')}
                                    </Tag>
                                  </div>
                                  
                                  {integration.last_connected_at && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.integrationConfigs.lastConnection')}：</Text>
                                      <Text style={{ fontSize: 12 }}>
                                        {dayjs(integration.last_connected_at).fromNow()}
                                      </Text>
                                    </div>
                                  )}
                                  
                                  {integration.last_error && (
                                    <Alert
                                      message={integration.last_error}
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
                  </Panel>
                );
              })}
            </Collapse>
          ) : (
            <Empty description={t('pages.system.integrationConfigs.noData')} />
          )}
        </Card>
      </PageContainer>

      {/* 集成配置详情 Modal */}
      <Modal
        title={t('pages.system.integrationConfigs.detailTitle')}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentIntegration(null);
        }}
        footer={null}
        size={800}
      >
        {currentIntegration && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label={t('pages.system.integrationConfigs.name')}>
              {currentIntegration.name}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.integrationConfigs.codeLabel')}>
              {currentIntegration.code}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.integrationConfigs.type')}>
              <Tag color={getTypeInfo(currentIntegration.type).color}>
                {getTypeInfo(currentIntegration.type).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.integrationConfigs.description')}>
              {currentIntegration.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.integrationConfigs.configInfo')}>
              <pre style={{
                margin: 0,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '300px',
                fontSize: 12,
              }}>
                {JSON.stringify(currentIntegration.config, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.integrationConfigs.connectionStatusLabel')}>
              <Badge
                status={getConnectionStatus(currentIntegration).status}
                text={getConnectionStatus(currentIntegration).text}
              />
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.integrationConfigs.enableStatusLabel')}>
              <Tag color={currentIntegration.is_active ? 'success' : 'default'}>
                {currentIntegration.is_active ? t('pages.system.integrationConfigs.enabled') : t('pages.system.integrationConfigs.disabled')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.integrationConfigs.lastConnectionTime')}>
              {currentIntegration.last_connected_at
                ? dayjs(currentIntegration.last_connected_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            {currentIntegration.last_error && (
              <Descriptions.Item label={t('pages.system.integrationConfigs.lastError')}>
                <Alert
                  message={currentIntegration.last_error}
                  type="error"
                  showIcon
                  style={{ fontSize: 12 }}
                />
              </Descriptions.Item>
            )}
            <Descriptions.Item label={t('pages.system.integrationConfigs.createdAt')}>
              {dayjs(currentIntegration.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.integrationConfigs.updatedAt')}>
              {dayjs(currentIntegration.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 连接测试 Modal */}
      <Modal
        title={t('pages.system.integrationConfigs.testModalTitle')}
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
            {t('pages.system.integrationConfigs.close')}
          </Button>,
        ]}
        size={600}
      >
        {testingUuid && !testResult && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Progress type="circle" percent={100} status="active" />
            <div style={{ marginTop: 16 }}>
              <Text>{t('pages.system.integrationConfigs.testing')}</Text>
            </div>
          </div>
        )}
        
        {testResult && (
          <div>
            <Alert
              message={testResult.success ? t('pages.system.integrationConfigs.testSuccess') : t('pages.system.integrationConfigs.testFailed')}
              description={testResult.message}
              type={testResult.success ? 'success' : 'error'}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Descriptions column={1} bordered>
              <Descriptions.Item label={t('pages.system.integrationConfigs.testResult')}>
                <Tag color={testResult.success ? 'success' : 'error'}>
                  {testResult.success ? t('pages.system.integrationConfigs.success') : t('pages.system.integrationConfigs.fail')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('pages.system.integrationConfigs.message')}>
                {testResult.message}
              </Descriptions.Item>
              {testResult.data && (
                <Descriptions.Item label={t('pages.system.integrationConfigs.responseData')}>
                  <pre style={{
                    margin: 0,
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    fontSize: 12,
                  }}>
                    {JSON.stringify(testResult.data, null, 2)}
                  </pre>
                </Descriptions.Item>
              )}
              {testResult.error && (
                <Descriptions.Item label={t('pages.system.integrationConfigs.errorInfo')}>
                  <Alert
                    message={testResult.error}
                    type="error"
                    showIcon
                    style={{ fontSize: 12 }}
                  />
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </>
  );
};

export default CardView;

