/**
 * 运营中心 - 系统状态监控页面
 * 
 * 平台级系统状态监控，用于展示系统运行状态、资源使用情况等。
 * 仅超级管理员可见。
 */

import { useState } from 'react';
import { PageContainer } from '@ant-design/pro-components';
import {
  Card,
  Row,
  Col,
  Typography,
  Spin,
  Tag,
  Progress,
  Alert,
  Space,
  Divider,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  getSystemStatus,
  getSystemResources,
  getSystemInfo,
  type SystemStatus,
  type SystemResources,
  type SystemInfo,
} from '@/services/superadmin';
import { useQuery } from '@tanstack/react-query';

const { Text } = Typography;

/**
 * 系统状态监控页面组件
 */
export default function SystemMonitoringPage() {
  const autoRefresh = true; // 自动刷新开关
  const refreshInterval = 30000; // 30秒刷新一次

  /**
   * 获取浏览器信息
   */
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    
    // 检测浏览器类型和版本
    if (userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Edg') === -1) {
      browserName = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (userAgent.indexOf('Firefox') > -1) {
      browserName = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') === -1) {
      browserName = 'Safari';
      const match = userAgent.match(/Version\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (userAgent.indexOf('Edg') > -1) {
      browserName = 'Edge';
      const match = userAgent.match(/Edg\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident') > -1) {
      browserName = 'IE';
      const match = userAgent.match(/(?:MSIE |rv:)(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    }

    return {
      browser: `${browserName} ${browserVersion}`,
      userAgent: userAgent,
      language: navigator.language || 'Unknown',
      languages: navigator.languages?.join(', ') || 'Unknown',
      platform: navigator.platform || 'Unknown',
      cookieEnabled: navigator.cookieEnabled ? '是' : '否',
      onLine: navigator.onLine ? '在线' : '离线',
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      screenColorDepth: window.screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  };

  const [browserInfo] = useState(getBrowserInfo());

  /**
   * 获取系统运行状态
   */
  const {
    data: systemStatus,
    isLoading: statusLoading,
  } = useQuery<SystemStatus>({
    queryKey: ['systemStatus'],
    queryFn: getSystemStatus,
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  /**
   * 获取系统资源使用情况
   */
  const {
    data: systemResources,
    isLoading: resourcesLoading,
  } = useQuery<SystemResources>({
    queryKey: ['systemResources'],
    queryFn: getSystemResources,
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  /**
   * 获取系统环境信息
   */
  const {
    data: systemInfo,
    isLoading: infoLoading,
  } = useQuery<SystemInfo>({
    queryKey: ['systemInfo'],
    queryFn: getSystemInfo,
    refetchInterval: autoRefresh ? refreshInterval * 2 : false, // 系统信息变化不频繁，刷新间隔更长
  });

  /**
   * 获取状态标签
   */
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Tag color="success" icon={<CheckCircleOutlined />}>健康</Tag>;
      case 'warning':
        return <Tag color="warning" icon={<WarningOutlined />}>警告</Tag>;
      case 'error':
        return <Tag color="error" icon={<CloseCircleOutlined />}>错误</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  /**
   * 获取状态文本（中文）
   */
  const getStatusText = (status: string): string => {
    switch (status) {
      case 'healthy':
        return '健康';
      case 'warning':
        return '警告';
      case 'error':
        return '错误';
      default:
        return status;
    }
  };

  /**
   * 格式化运行时间
   */
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  };

  /**
   * 验证并格式化百分比数据
   * 确保返回有效的数字值
   */
  const validatePercent = (value: any, defaultValue: number = 0): number => {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return defaultValue;
    }
    return Math.max(0, Math.min(100, value));
  };

  /**
   * 验证并格式化大小数据
   * 确保返回有效的数字值
   */
  const validateSize = (value: any, defaultValue: number = 0): number => {
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
      return defaultValue;
    }
    return Math.max(0, value);
  };

  /**
   * 根据百分比获取颜色
   */
  const getPercentColor = (percent: number): string => {
    return percent >= 80 ? '#ff4d4f' : percent >= 60 ? '#faad14' : '#52c41a';
  };

  /**
   * 渲染资源使用率圆环图
   */
  const ResourceGauge = ({
    percent,
    title,
    color,
    used,
    total
  }: {
    percent: number;
    title: string;
    color: string;
    used?: number;
    total?: number;
  }) => {
    return (
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ marginBottom: 16 }}>
          <Progress
            type="circle"
            percent={percent}
            strokeColor={color}
            strokeWidth={12}
            size={120}
            format={(percent) => (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 'bold', color }}>{percent}%</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{title}</div>
              </div>
            )}
          />
        </div>
        {used !== undefined && total !== undefined && (
          <div style={{ fontSize: 12, color: '#666' }}>
            {used.toFixed(0)} / {total.toFixed(0)} MB
          </div>
        )}
      </div>
    );
  };

  const loading = statusLoading || resourcesLoading || infoLoading;

  return (
    <PageContainer
      title="系统状态监控"
      subTitle="平台系统运行状态和资源使用情况"
      loading={loading}
      extra={[
        <Space key="actions">
          <Text type="secondary">
            {autoRefresh ? '自动刷新：30秒' : '自动刷新：已关闭'}
          </Text>
        </Space>,
      ]}
    >
      <Spin spinning={loading}>
        {/* 系统运行状态 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }} align="stretch">
          <Col xs={24} lg={8}>
            <Card title="系统运行状态" loading={statusLoading} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {systemStatus && (
                <Space direction="vertical" style={{ width: '100%', flex: 1, justifyContent: 'space-between' }} size="middle">
                  <div>
                    <Text strong>整体状态：</Text>
                    {getStatusTag(systemStatus.status)}
                  </div>
                  <div>
                    <Text strong>数据库：</Text>
                    <Tag color={systemStatus.database === 'healthy' ? 'success' : 'error'} icon={systemStatus.database === 'healthy' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                      {getStatusText(systemStatus.database)}
                    </Tag>
                  </div>
                  <div>
                    <Text strong>Redis：</Text>
                    <Tag color={systemStatus.redis === 'healthy' ? 'success' : 'error'} icon={systemStatus.redis === 'healthy' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                      {getStatusText(systemStatus.redis)}
                    </Tag>
                  </div>
                  <div>
                    <Text strong>运行时间：</Text>
                    <Text>{formatUptime(systemStatus.uptime_seconds)}</Text>
                  </div>
                  {systemStatus.start_time && (
                    <div>
                      <Text strong>启动时间：</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {new Date(systemStatus.start_time).toLocaleString()}
                      </Text>
                    </div>
                  )}
                  {systemStatus.updated_at && (
                    <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f0f0f0' }}>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        更新时间：{new Date(systemStatus.updated_at).toLocaleString()}
                      </Text>
                    </div>
                  )}
                </Space>
              )}
            </Card>
          </Col>

          {/* 系统资源使用情况 */}
          <Col xs={24} lg={16}>
            <Card title="系统资源使用情况" loading={resourcesLoading} style={{ height: '100%' }}>
              {systemResources &&
               typeof systemResources.cpu_percent === 'number' &&
               typeof systemResources.memory_percent === 'number' &&
               typeof systemResources.disk_percent === 'number' ? (
                <>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                      <div style={{ textAlign: 'center' }}>
                        {(() => {
                          const cpuPercent = validatePercent(systemResources.cpu_percent);
                          return <ResourceGauge percent={cpuPercent} title="CPU" color={getPercentColor(cpuPercent)} />;
                        })()}
                        {systemStatus?.cpu_count !== undefined && (
                          <div style={{ fontSize: 12, color: '#666', marginTop: -16 }}>
                            {systemStatus.cpu_count}
                            {systemStatus.cpu_count_logical && systemStatus.cpu_count_logical !== systemStatus.cpu_count
                              ? ` (${systemStatus.cpu_count_logical} 逻辑)`
                              : ''}
                          </div>
                        )}
                      </div>
                    </Col>
                    <Col xs={24} sm={8}>
                      <div style={{ textAlign: 'center' }}>
                        {(() => {
                          const memoryPercent = validatePercent(systemResources.memory_percent);
                          const memoryUsed = validateSize(systemResources.memory_used_mb);
                          const memoryTotal = validateSize(systemResources.memory_total_mb);
                          return (
                            <ResourceGauge
                              percent={memoryPercent}
                              title="内存"
                              color={getPercentColor(memoryPercent)}
                              used={memoryUsed}
                              total={memoryTotal}
                            />
                          );
                        })()}
                      </div>
                    </Col>
                    <Col xs={24} sm={8}>
                      <div style={{ textAlign: 'center' }}>
                        {(() => {
                          const diskPercent = validatePercent(systemResources.disk_percent);
                          const diskUsed = validateSize(systemResources.disk_used_mb);
                          const diskTotal = validateSize(systemResources.disk_total_mb);
                          return (
                            <ResourceGauge
                              percent={diskPercent}
                              title="磁盘"
                              color={getPercentColor(diskPercent)}
                              used={diskUsed}
                              total={diskTotal}
                            />
                          );
                        })()}
                      </div>
                    </Col>
                  </Row>
                </>
              ) : (
                <Alert
                  message="无法获取系统资源数据"
                  description="系统资源监控数据暂时不可用，请稍后刷新页面重试。"
                  type="warning"
                  showIcon
                />
              )}
            </Card>
          </Col>
        </Row>

        {/* 系统环境信息 */}
        {systemInfo && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }} align="stretch">
            <Col xs={24} lg={12}>
              <Card title="系统环境信息" loading={infoLoading} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Space direction="vertical" style={{ width: '100%', flex: 1, justifyContent: 'space-between' }} size="middle">
                  <div>
                    <Text strong>Python 版本：</Text>
                    <Text>{systemInfo.python_version}</Text>
                  </div>
                  <div>
                    <Text strong>操作系统：</Text>
                    <Text>{systemInfo.system} {systemInfo.release}</Text>
                  </div>
                  <div>
                    <Text strong>平台：</Text>
                    <Text>{systemInfo.platform}</Text>
                  </div>
                  <div>
                    <Text strong>架构：</Text>
                    <Text>{systemInfo.architecture}</Text>
                  </div>
                  <div>
                    <Text strong>主机名：</Text>
                    <Text>{systemInfo.hostname}</Text>
                  </div>
                  <div>
                    <Text strong>处理器：</Text>
                    <Text>{systemInfo.processor || 'N/A'}</Text>
                  </div>
                  {systemInfo.process && !systemInfo.process.error && (
                    <>
                      <Divider style={{ margin: '8px 0' }} />
                      <div>
                        <Text strong>进程 ID：</Text>
                        <Text>{systemInfo.process.pid}</Text>
                      </div>
                      <div>
                        <Text strong>进程名称：</Text>
                        <Text>{systemInfo.process.name}</Text>
                      </div>
                      <div>
                        <Text strong>进程状态：</Text>
                        <Tag color="success">{systemInfo.process.status}</Tag>
                      </div>
                      <div>
                        <Text strong>线程数：</Text>
                        <Text>{systemInfo.process.num_threads}</Text>
                      </div>
                      <div>
                        <Text strong>内存使用：</Text>
                        <Text>
                          RSS: {systemInfo.process.memory_info_mb.rss.toFixed(2)} MB / 
                          VMS: {systemInfo.process.memory_info_mb.vms.toFixed(2)} MB
                        </Text>
                      </div>
                    </>
                  )}
                </Space>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="网络与浏览器信息" loading={infoLoading} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Space direction="vertical" style={{ width: '100%', flex: 1, justifyContent: 'space-between' }} size="middle">
                  <div>
                    <Text strong style={{ fontSize: '14px', marginBottom: 8, display: 'block' }}>网络统计</Text>
                    {systemInfo.network && !systemInfo.network.error ? (
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <div>
                          <Text type="secondary">发送：</Text>
                          <Text>
                            {systemInfo.network.bytes_sent
                              ? `${(systemInfo.network.bytes_sent / (1024 * 1024)).toFixed(2)} MB`
                              : 'N/A'}
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary">接收：</Text>
                          <Text>
                            {systemInfo.network.bytes_recv
                              ? `${(systemInfo.network.bytes_recv / (1024 * 1024)).toFixed(2)} MB`
                              : 'N/A'}
                          </Text>
                        </div>
                        <div>
                          <Text type="secondary">发送包数：</Text>
                          <Text>{systemInfo.network.packets_sent?.toLocaleString() || 'N/A'}</Text>
                        </div>
                        <div>
                          <Text type="secondary">接收包数：</Text>
                          <Text>{systemInfo.network.packets_recv?.toLocaleString() || 'N/A'}</Text>
                        </div>
                        {(systemInfo.network.errin !== undefined || systemInfo.network.errout !== undefined || 
                          systemInfo.network.dropin !== undefined || systemInfo.network.dropout !== undefined) && (
                          <>
                            <Divider style={{ margin: '8px 0' }} />
                            <div>
                              <Text strong style={{ fontSize: '12px' }}>网络错误统计：</Text>
                            </div>
                            {systemInfo.network.errin !== undefined && systemInfo.network.errin > 0 && (
                              <div>
                                <Text type="secondary">接收错误：</Text>
                                <Tag color="error">{systemInfo.network.errin.toLocaleString()}</Tag>
                              </div>
                            )}
                            {systemInfo.network.errout !== undefined && systemInfo.network.errout > 0 && (
                              <div>
                                <Text type="secondary">发送错误：</Text>
                                <Tag color="error">{systemInfo.network.errout.toLocaleString()}</Tag>
                              </div>
                            )}
                            {systemInfo.network.dropin !== undefined && systemInfo.network.dropin > 0 && (
                              <div>
                                <Text type="secondary">接收丢包：</Text>
                                <Tag color="warning">{systemInfo.network.dropin.toLocaleString()}</Tag>
                              </div>
                            )}
                            {systemInfo.network.dropout !== undefined && systemInfo.network.dropout > 0 && (
                              <div>
                                <Text type="secondary">发送丢包：</Text>
                                <Tag color="warning">{systemInfo.network.dropout.toLocaleString()}</Tag>
                              </div>
                            )}
                            {(systemInfo.network.errin === 0 && systemInfo.network.errout === 0 && 
                              systemInfo.network.dropin === 0 && systemInfo.network.dropout === 0) && (
                              <div>
                                <Text type="secondary" style={{ fontSize: '12px' }}>无网络错误</Text>
                              </div>
                            )}
                          </>
                        )}
                      </Space>
                    ) : (
                      <Alert
                        message="无法获取网络信息"
                        description={systemInfo.network?.error || '网络信息暂时不可用'}
                        type="warning"
                        showIcon
                      />
                    )}
                  </div>
                  
                  <Divider style={{ margin: '12px 0' }} />
                  
                  <div>
                    <Text strong style={{ fontSize: '14px', marginBottom: 8, display: 'block' }}>浏览器信息</Text>
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <div>
                        <Text type="secondary">浏览器：</Text>
                        <Text>{browserInfo.browser}</Text>
                      </div>
                      <div>
                        <Text type="secondary">平台：</Text>
                        <Text>{browserInfo.platform}</Text>
                      </div>
                      <div>
                        <Text type="secondary">语言：</Text>
                        <Text>{browserInfo.language}</Text>
                        {browserInfo.languages && browserInfo.languages !== browserInfo.language && (
                          <Text type="secondary" style={{ marginLeft: 8, fontSize: '12px' }}>
                            ({browserInfo.languages})
                          </Text>
                        )}
                      </div>
                      <div>
                        <Text type="secondary">时区：</Text>
                        <Text code style={{ fontSize: '12px' }}>{browserInfo.timezone}</Text>
                      </div>
                      <div>
                        <Text type="secondary">屏幕：</Text>
                        <Text>
                          {browserInfo.screenWidth} × {browserInfo.screenHeight} ({browserInfo.screenColorDepth} 位)
                        </Text>
                      </div>
                      <div>
                        <Text type="secondary">Cookie：</Text>
                        <Tag color={browserInfo.cookieEnabled === '是' ? 'success' : 'error'}>
                          {browserInfo.cookieEnabled}
                        </Tag>
                        <Text type="secondary" style={{ marginLeft: 8 }}>网络：</Text>
                        <Tag color={browserInfo.onLine === '在线' ? 'success' : 'error'}>
                          {browserInfo.onLine}
                        </Tag>
                      </div>
                    </Space>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        )}

      </Spin>
    </PageContainer>
  );
}

