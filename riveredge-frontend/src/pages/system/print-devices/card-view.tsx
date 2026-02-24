/**
 * 打印设备管理 - 卡片视图组件
 * 
 * 提供卡片布局的打印设备展示界面，支持设备状态可视化和测试功能
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Card, Tag, Space, Button, Modal, Descriptions, Popconfirm, Statistic, Row, Col, Badge, Typography, Empty, Tooltip, Alert, Progress, Divider, theme } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, PrinterOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, PrinterFilled } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  getPrintDeviceList,
  getPrintDeviceByUuid,
  updatePrintDevice,
  deletePrintDevice,
  testPrintDevice,
  printWithDevice,
  PrintDevice,
  PrintDeviceTestResponse,
  PrintDevicePrintResponse,
} from '../../../services/printDevice';
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
  const [devices, setDevices] = useState<PrintDevice[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<PrintDevice | null>(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testResult, setTestResult] = useState<PrintDeviceTestResponse | null>(null);
  const [testingUuid, setTestingUuid] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 加载打印设备列表
   */
  const loadDevices = async () => {
    setLoading(true);
    try {
      const data = await getPrintDeviceList();
      setDevices(data);
    } catch (error: any) {
      handleError(error, t('pages.system.printDevices.loadListFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    loadDevices();
  }, []);

  /**
   * 设置自动刷新（每60秒刷新一次）
   */
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      loadDevices();
    }, 60000);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  /**
   * 查看设备详情
   */
  const handleViewDetail = async (device: PrintDevice) => {
    try {
      const detail = await getPrintDeviceByUuid(device.uuid);
      setCurrentDevice(detail);
      setDetailModalVisible(true);
    } catch (error: any) {
      handleError(error, t('pages.system.printDevices.getDetailFailed'));
    }
  };

  /**
   * 测试设备连接
   */
  const handleTestDevice = async (device: PrintDevice) => {
    try {
      setTestingUuid(device.uuid);
      setTestModalVisible(true);
      setTestResult(null);
      setTestLoading(true);
      
      const result = await testPrintDevice(device.uuid);
      setTestResult(result);
      
      if (result.success) {
        handleSuccess(result.message || t('pages.system.printDevices.testSuccess'));
        // 刷新列表以更新设备状态
        loadDevices();
      } else {
        handleError(new Error(result.error || t('pages.system.printDevices.testFailed')), t('pages.system.printDevices.testFailed'));
      }
    } catch (error: any) {
      handleError(error, t('pages.system.printDevices.testFailed'));
      setTestResult({
        success: false,
        error: error.message || t('pages.system.printDevices.testFailed'),
      });
    } finally {
      setTestLoading(false);
      setTestingUuid(null);
    }
  };

  /**
   * 删除设备
   */
  const handleDelete = async (device: PrintDevice) => {
    try {
      await deletePrintDevice(device.uuid);
      handleSuccess(t('pages.system.printDevices.deleteSuccess'));
      loadDevices();
    } catch (error: any) {
      handleError(error, t('pages.system.printDevices.deleteFailed'));
    }
  };

  /**
   * 获取设备类型图标和颜色
   */
  const getTypeInfo = (type: string): { color: string; text: string; icon: React.ReactNode } => {
    const typeMap: Record<string, { color: string; textKey: string; icon: React.ReactNode }> = {
      local: { color: 'blue', textKey: 'pages.system.printDevices.typeLocal', icon: <PrinterFilled /> },
      network: { color: 'green', textKey: 'pages.system.printDevices.typeNetwork', icon: <PrinterFilled /> },
      cloud: { color: 'purple', textKey: 'pages.system.printDevices.typeCloud', icon: <PrinterFilled /> },
      other: { color: 'default', textKey: 'pages.system.printDevices.typeOther', icon: <PrinterFilled /> },
    };
    const info = typeMap[type] || { color: 'default', textKey: '', icon: <PrinterFilled /> };
    return { ...info, text: info.textKey ? t(info.textKey) : type };
  };

  /**
   * 获取设备状态显示
   */
  const getDeviceStatus = (device: PrintDevice): { 
    status: 'success' | 'error' | 'warning' | 'default'; 
    text: string;
    onlineStatus: 'success' | 'error' | 'default';
    onlineText: string;
  } => {
    if (!device.is_active) {
      return { 
        status: 'default', 
        text: t('pages.system.printDevices.statusDisabled'),
        onlineStatus: 'default',
        onlineText: t('pages.system.printDevices.statusDisabled'),
      };
    }
    if (device.is_online) {
      return { 
        status: 'success', 
        text: t('pages.system.printDevices.statusOnline'),
        onlineStatus: 'success',
        onlineText: t('pages.system.printDevices.statusOnline'),
      };
    }
    return { 
      status: 'error', 
      text: t('pages.system.printDevices.statusOffline'),
      onlineStatus: 'error',
      onlineText: t('pages.system.printDevices.statusOffline'),
    };
  };

  /**
   * 计算统计信息
   */
  const stats = {
    total: devices.length,
    active: devices.filter((d) => d.is_active).length,
    inactive: devices.filter((d) => !d.is_active).length,
    online: devices.filter((d) => d.is_online && d.is_active).length,
    offline: devices.filter((d) => !d.is_online && d.is_active).length,
    default: devices.filter((d) => d.is_default).length,
    byType: devices.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    totalUsage: devices.reduce((sum, d) => sum + (d.usage_count || 0), 0),
  };

  return (
    <>
      <PageContainer
        title={t('pages.system.printDevices.cardViewTitle')}
        extra={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={loadDevices}
            loading={loading}
          >
            {t('pages.system.printDevices.refresh')}
          </Button>,
        ]}
      >
        {/* 统计卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printDevices.statTotal')}
                value={stats.total}
                prefix={<PrinterFilled />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printDevices.statOnline')}
                value={stats.online}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printDevices.statOffline')}
                value={stats.offline}
                prefix={<CloseCircleOutlined />}
                styles={{ content: { color: '#ff4d4f' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printDevices.statTotalUsage')}
                value={stats.totalUsage}
                prefix={<PrinterOutlined />}
                styles={{ content: { color: '#722ed1' } }}
              />
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printDevices.statActive')}
                value={stats.active}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printDevices.statInactive')}
                value={stats.inactive}
                prefix={<ExclamationCircleOutlined />}
                styles={{ content: { color: '#faad14' } }}
              />
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Statistic
                title={t('pages.system.printDevices.statDefault')}
                value={stats.default}
                prefix={<PrinterFilled />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Col>
          </Row>
          {Object.keys(stats.byType).length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${token.colorBorder}` }}>
              <Text type="secondary" style={{ marginRight: 8 }}>{t('pages.system.printDevices.byTypeStats')}</Text>
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

        {/* 设备卡片列表 */}
        <Card loading={loading}>
          {devices.length > 0 ? (
            <Row gutter={[16, 16]}>
              {devices.map((device) => {
                const typeInfo = getTypeInfo(device.type);
                const deviceStatus = getDeviceStatus(device);
                
                return (
                  <Col key={device.uuid} xs={24} sm={12} md={8} lg={6} xl={6}>
                    <Card
                      hoverable
                      style={{ height: '100%' }}
                      actions={[
                        <Tooltip title={t('pages.system.printDevices.viewDetail')}>
                          <EyeOutlined
                            key="view"
                            onClick={() => handleViewDetail(device)}
                            style={{ fontSize: 16 }}
                          />
                        </Tooltip>,
                        <Tooltip title={t('pages.system.printDevices.testConnection')}>
                          <CheckCircleOutlined
                            key="test"
                            onClick={() => handleTestDevice(device)}
                            disabled={!device.is_active}
                            style={{ 
                              fontSize: 16, 
                              color: device.is_active ? '#1890ff' : '#d9d9d9',
                            }}
                          />
                        </Tooltip>,
                        <Popconfirm
                          key="delete"
                          title={t('pages.system.printDevices.deleteConfirmTitle')}
                          onConfirm={() => handleDelete(device)}
                          okText={t('common.confirm')}
                          cancelText={t('common.cancel')}
                        >
                          <Tooltip title={t('pages.system.printDevices.deleteTooltip')}>
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
                              {device.name}
                            </Text>
                            <Tag color={typeInfo.color} icon={typeInfo.icon}>
                              {typeInfo.text}
                            </Tag>
                          </div>
                          
                          {device.code && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {t('pages.system.printDevices.codePrefix')}{device.code}
                            </Text>
                          )}
                          
                          {device.description && (
                            <Paragraph
                              ellipsis={{ rows: 2, expandable: false }}
                              style={{ marginBottom: 0, fontSize: 12 }}
                            >
                              {device.description}
                            </Paragraph>
                          )}
                        </Space>
                      </div>
                      
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${token.colorBorder}` }}>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.onlineStatusLabel')}</Text>
                            <Badge
                              status={deviceStatus.onlineStatus}
                              text={deviceStatus.onlineText}
                            />
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.statusLabel')}</Text>
                            <Tag color={device.is_active ? 'success' : 'default'}>
                              {device.is_active ? t('pages.system.printDevices.enabled') : t('pages.system.printDevices.disabled')}
                            </Tag>
                          </div>
                          
                          {device.is_default && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.defaultLabel')}</Text>
                              <Tag color="processing">{t('pages.system.printDevices.isDefault')}</Tag>
                            </div>
                          )}
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.usageLabel')}</Text>
                            <Text style={{ fontSize: 12 }}>{device.usage_count || 0}</Text>
                          </div>
                          
                          {device.last_connected_at && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.lastConnectedLabel')}</Text>
                              <Text style={{ fontSize: 12 }}>
                                {dayjs(device.last_connected_at).fromNow()}
                              </Text>
                            </div>
                          )}
                          
                          {device.last_used_at && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>{t('pages.system.printDevices.lastUsedLabel')}</Text>
                              <Text style={{ fontSize: 12 }}>
                                {dayjs(device.last_used_at).fromNow()}
                              </Text>
                            </div>
                          )}
                        </Space>
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          ) : (
            <Empty description={t('pages.system.printDevices.noDevices')} />
          )}
        </Card>
      </PageContainer>

      {/* 设备详情 Modal */}
      <Modal
        title={t('pages.system.printDevices.deviceDetail')}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setCurrentDevice(null);
        }}
        footer={null}
        size={800}
      >
        {currentDevice && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label={t('pages.system.printDevices.columnName')}>
              {currentDevice.name}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.columnCode')}>
              {currentDevice.code}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.columnType')}>
              <Tag color={getTypeInfo(currentDevice.type).color}>
                {getTypeInfo(currentDevice.type).text}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.labelDescription')}>
              {currentDevice.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.columnConfig')}>
              <pre style={{
                margin: 0,
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '300px',
                fontSize: 12,
              }}>
                {JSON.stringify(currentDevice.config, null, 2)}
              </pre>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.columnOnline')}>
              <Badge
                status={getDeviceStatus(currentDevice).onlineStatus}
                text={getDeviceStatus(currentDevice).onlineText}
              />
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.columnActive')}>
              <Tag color={currentDevice.is_active ? 'success' : 'default'}>
                {currentDevice.is_active ? t('pages.system.printDevices.enabled') : t('pages.system.printDevices.disabled')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.statDefault')}>
              <Tag color={currentDevice.is_default ? 'processing' : 'default'}>
                {currentDevice.is_default ? t('pages.system.printDevices.isDefault') : t('pages.system.printDevices.no')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.columnUsage')}>
              {currentDevice.usage_count || 0}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.columnLastConnected')}>
              {currentDevice.last_connected_at
                ? dayjs(currentDevice.last_connected_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.columnLastUsed')}>
              {currentDevice.last_used_at
                ? dayjs(currentDevice.last_used_at).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.columnCreatedAt')}>
              {dayjs(currentDevice.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label={t('pages.system.printDevices.columnUpdatedAt')}>
              {dayjs(currentDevice.updated_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 设备测试 Modal */}
      <Modal
        title={t('pages.system.printDevices.testConnectionModal')}
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
            {t('pages.system.printDevices.close')}
          </Button>,
        ]}
        size={600}
      >
        {testLoading && !testResult && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Progress type="circle" percent={100} status="active" />
            <div style={{ marginTop: 16 }}>
              <Text>{t('pages.system.printDevices.testingConnection')}</Text>
            </div>
          </div>
        )}
        
        {testResult && (
          <div>
            <Alert
              message={testResult.success ? t('pages.system.printDevices.testSuccess') : t('pages.system.printDevices.testFailed')}
              description={testResult.message || testResult.error}
              type={testResult.success ? 'success' : 'error'}
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Descriptions column={1} bordered>
              <Descriptions.Item label={t('pages.system.printDevices.testResult')}>
                <Tag color={testResult.success ? 'success' : 'error'}>
                  {testResult.success ? t('pages.system.printDevices.success') : t('pages.system.printDevices.fail')}
                </Tag>
              </Descriptions.Item>
              {testResult.message && (
                <Descriptions.Item label={t('pages.system.printDevices.message')}>
                  {testResult.message}
                </Descriptions.Item>
              )}
              {testResult.error && (
                <Descriptions.Item label={t('pages.system.printDevices.errorInfo')}>
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

