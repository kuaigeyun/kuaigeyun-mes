/**
 * 数据源管理 - 卡片视图组件
 * 
 * 提供卡片布局的数据源展示界面
 */

import React, { useState, useEffect, useRef } from 'react';
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
      handleError(error, '加载数据源列表失败');
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
      handleError(error, '获取数据源详情失败');
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
        handleSuccess(result.message || '连接测试成功');
        // 刷新列表以更新连接状态
        loadDataSources();
      } else {
        handleError(new Error(result.message || '连接测试失败'), '连接测试失败');
      }
    } catch (error: any) {
      handleError(error, '连接测试失败');
      setTestResult({
        success: false,
        message: error.message || '连接测试失败',
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
      handleSuccess('删除成功');
      loadDataSources();
    } catch (error: any) {
      handleError(error, '删除失败');
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
   * 获取连接状态显示
   */
  const getConnectionStatus = (dataSource: DataSource): { status: 'success' | 'error' | 'warning' | 'default'; text: string } => {
    if (!dataSource.is_active) {
      return { status: 'default', text: '已禁用' };
    }
    
    if (dataSource.is_connected) {
      return { status: 'success', text: '已连接' };
    }
    
    if (dataSource.last_error) {
      return { status: 'error', text: '连接失败' };
    }
    
    return { status: 'warning', text: '未连接' };
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
        title="数据源管理"
        extra={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={loadDataSources}
            loading={loading}
          >
            刷新
          </Button>,
        ]}
      >
        {/* 统计卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="总数据源数"
                value={stats.total}
                prefix={<DatabaseOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="已连接"
                value={stats.connected}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="未连接"
                value={stats.disconnected}
                prefix={<CloseCircleOutlined />}
                styles={{ content: { color: '#ff4d4f' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title="已禁用"
                value={stats.inactive}
                prefix={<ExclamationCircleOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            </Col>
          </Row>
          {Object.keys(stats.byType).length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${token.colorBorder}` }}>
              <Text type="secondary" style={{ marginRight: 8 }}>按类型统计：</Text>
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
                        <Tooltip title="查看详情">
                          <EyeOutlined
                            key="view"
                            onClick={() => handleViewDetail(dataSource)}
                            style={{ fontSize: 16 }}
                          />
                        </Tooltip>,
                        <Tooltip title="测试连接">
                          <ThunderboltOutlined
                            key="test"
                            onClick={() => handleTestConnection(dataSource)}
                            style={{ fontSize: 16, color: '#1890ff' }}
                          />
                        </Tooltip>,
                        <Popconfirm
                          key="delete"
                          title="确定要删除这个数据源吗？"
                          onConfirm={() => handleDelete(dataSource)}
                          okText="确定"
                          cancelText="取消"
                        >
                          <Tooltip title="删除">
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
                              代码: {dataSource.code}
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
                            <Text type="secondary" style={{ fontSize: 12 }}>连接状态：</Text>
                            <Badge
                              status={connectionStatus.status}
                              text={connectionStatus.text}
                            />
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>启用状态：</Text>
                            <Tag color={dataSource.is_active ? 'success' : 'default'}>
                              {dataSource.is_active ? '启用' : '禁用'}
                            </Tag>
                          </div>
                          
                          {dataSource.last_connected_at && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>最后连接：</Text>
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
            <Empty description="暂无数据源" />
          )}
        </Card>
      </PageContainer>

      {/* 数据源详情 Modal */}
      <Modal
        title="数据源详情"
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
            <Descriptions.Item label="数据源名称">
              {currentDataSource.name}
            </Descriptions.Item>
            <Descriptions.Item label="数据源代码">
              {currentDataSource.code}
            </Descriptions.Item>
            <Descriptions.Item label="数据源类型">
              <Tag color={getTypeInfo(currentDataSource.type).color}>
                {getTypeInfo(currentDataSource.type).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="数据源描述">
              {currentDataSource.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="连接配置">
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
            <Descriptions.Item label="连接状态">
              <Badge
                status={getConnectionStatus(currentDataSource).status}
                text={getConnectionStatus(currentDataSource).text}
              />
            </Descriptions.Item>
            <Descriptions.Item label="启用状态">
              <Tag color={currentDataSource.is_active ? 'success' : 'default'}>
                {currentDataSource.is_active ? '启用' : '禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="最后连接时间">
              {currentDataSource.last_connected_at
                ? dayjs(currentDataSource.last_connected_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            {currentDataSource.last_error && (
              <Descriptions.Item label="最后错误">
                <Alert
                  message={currentDataSource.last_error}
                  type="error"
                  showIcon
                  style={{ fontSize: 12 }}
                />
              </Descriptions.Item>
            )}
            <Descriptions.Item label="创建时间">
              {dayjs(currentDataSource.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {dayjs(currentDataSource.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 连接测试 Modal */}
      <Modal
        title="连接测试"
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
            关闭
          </Button>,
        ]}
        size={600}
      >
        {testingUuid && !testResult && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Progress type="circle" percent={100} status="active" />
            <div style={{ marginTop: 16 }}>
              <Text>正在测试连接...</Text>
            </div>
          </div>
        )}
        
        {testResult && (
          <div>
            <Alert
              message={testResult.success ? '连接测试成功' : '连接测试失败'}
              description={testResult.message}
              type={testResult.success ? 'success' : 'error'}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Descriptions column={1} bordered>
              <Descriptions.Item label="测试结果">
                <Tag color={testResult.success ? 'success' : 'error'}>
                  {testResult.success ? '成功' : '失败'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="响应时间">
                {testResult.elapsed_time}ms
              </Descriptions.Item>
              <Descriptions.Item label="消息">
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

