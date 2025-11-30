/**
 * 系统监控页面
 *
 * 用于查看系统监控信息，包括服务器状态、CPU、内存、磁盘等
 */

import { ProCard, ProDescriptions, StatisticCard } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Alert, Tag, Progress } from 'antd';
import {
  DesktopOutlined,
  ControlOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { getSystemInfo, type SystemInfo } from '../../../services/tenant';

/**
 * 格式化字节大小
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 格式化运行时间
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days}天 ${hours}小时 ${minutes}分钟`;
}

/**
 * 监控管理页面组件
 */
export default function MonitoringPage() {
  // 获取系统信息
  const { data: systemInfo, isLoading, error } = useQuery({
    queryKey: ['systemInfo'],
    queryFn: getSystemInfo,
    refetchInterval: 30000, // 每30秒刷新一次
  });

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="获取系统信息失败"
          description="无法连接到系统监控服务，请稍后重试"
          type="error"
          showIcon
        />
      </div>
    );
  }

  const info = systemInfo || {
    hostname: '未知',
    platform: '未知',
    platform_version: '未知',
    architecture: '未知',
    python_version: '未知',
    uptime: 0,
    cpu: { count: 0, usage_percent: 0, load_average: [0, 0, 0] },
    memory: { total: 0, available: 0, used: 0, usage_percent: 0 },
    disk: { total: 0, used: 0, free: 0, usage_percent: 0 },
    network: { interfaces: [] },
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 系统概览 */}
      
      <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={6}>
          <StatisticCard
            statistic={{
              title: '运行时间',
              value: formatUptime(info.uptime),
              icon: <ClockCircleOutlined />,
            }}
            style={{ height: '120px' }}
          >
            <div style={{ marginTop: 8 }}>
              <Tag color="green">正常运行</Tag>
            </div>
          </StatisticCard>
        </Col>
        
        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            statistic={{
              title: 'CPU使用率',
              value: info.cpu.usage_percent,
              suffix: '%',
              icon: <ControlOutlined />,
            }}
            style={{ height: '120px' }}
          >
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '12px', color: '#666' }}>
                核心数: {info.cpu.count} | 负载: {info.cpu.load_average.map(load => load.toFixed(2)).join(', ')}
              </div>
            </div>
          </StatisticCard>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            statistic={{
              title: '内存使用率',
              value: info.memory.usage_percent,
              suffix: '%',
              icon: <DatabaseOutlined />,
            }}
            style={{ height: '120px' }}
          >
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '12px', color: '#666' }}>
                已用: {formatBytes(info.memory.used)} | 总共: {formatBytes(info.memory.total)}
              </div>
            </div>
          </StatisticCard>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <StatisticCard
            statistic={{
              title: '磁盘使用率',
              value: info.disk.usage_percent,
              suffix: '%',
              icon: <DatabaseOutlined />,
            }}
            style={{ height: '120px' }}
          >
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: '12px', color: '#666' }}>
                已用: {formatBytes(info.disk.used)} | 总共: {formatBytes(info.disk.total)}
              </div>
            </div>
          </StatisticCard>
        </Col>

      </Row>

      <br />

      {/* 详细监控信息 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <ProCard title="CPU 详情" loading={isLoading}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>CPU 使用率</span>
                <span>{info.cpu.usage_percent.toFixed(1)}%</span>
              </div>
              <Progress
                percent={info.cpu.usage_percent}
                status={info.cpu.usage_percent > 80 ? 'exception' : 'active'}
                strokeColor={info.cpu.usage_percent > 80 ? '#ff4d4f' : '#1890ff'}
              />
            </div>

            <ProDescriptions
              column={1}
              dataSource={info.cpu}
              columns={[
                {
                  title: 'CPU 核心数',
                  dataIndex: 'count',
                },
                {
                  title: '平均负载 (1分钟)',
                  dataIndex: 'load_average',
                  render: (_, record) => record.load_average[0].toFixed(2),
                },
                {
                  title: '平均负载 (5分钟)',
                  dataIndex: 'load_average',
                  render: (_, record) => record.load_average[1].toFixed(2),
                },
                {
                  title: '平均负载 (15分钟)',
                  dataIndex: 'load_average',
                  render: (_, record) => record.load_average[2].toFixed(2),
                },
              ]}
            />
          </ProCard>
        </Col>

        <Col xs={24} lg={12}>
          <ProCard title="内存详情" loading={isLoading}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>内存使用率</span>
                <span>{info.memory.usage_percent.toFixed(1)}%</span>
              </div>
              <Progress
                percent={info.memory.usage_percent}
                status={info.memory.usage_percent > 90 ? 'exception' : 'active'}
                strokeColor={info.memory.usage_percent > 90 ? '#ff4d4f' : '#52c41a'}
              />
            </div>

            <ProDescriptions
              column={1}
              dataSource={info.memory}
              columns={[
                {
                  title: '总内存',
                  dataIndex: 'total',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: '已用内存',
                  dataIndex: 'used',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: '可用内存',
                  dataIndex: 'available',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: '使用率',
                  dataIndex: 'usage_percent',
                  render: (text) => `${Number(text).toFixed(1)}%`,
                },
              ]}
            />
          </ProCard>
        </Col>

        <Col xs={24} lg={12}>
          <ProCard title="磁盘详情" loading={isLoading}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>磁盘使用率</span>
                <span>{info.disk.usage_percent.toFixed(1)}%</span>
              </div>
              <Progress
                percent={info.disk.usage_percent}
                status={info.disk.usage_percent > 90 ? 'exception' : 'active'}
                strokeColor={info.disk.usage_percent > 90 ? '#ff4d4f' : '#722ed1'}
              />
            </div>

            <ProDescriptions
              column={1}
              dataSource={info.disk}
              columns={[
                {
                  title: '总容量',
                  dataIndex: 'total',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: '已用空间',
                  dataIndex: 'used',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: '可用空间',
                  dataIndex: 'free',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: '使用率',
                  dataIndex: 'usage_percent',
                  render: (text) => `${Number(text).toFixed(1)}%`,
                },
              ]}
            />
          </ProCard>
        </Col>

        <Col xs={24} lg={12}>
          <ProCard title="系统信息" loading={isLoading}>
            <div style={{ marginBottom: 14, height: 15 }} />
            <ProDescriptions
              column={1}
              dataSource={info}
              columns={[
                {
                  title: '主机名',
                  dataIndex: 'hostname',
                },
                {
                  title: '操作系统',
                  dataIndex: 'platform',
                },
                {
                  title: '系统版本',
                  dataIndex: 'platform_version',
                },
                {
                  title: '系统架构',
                  dataIndex: 'architecture',
                },
                {
                  title: 'Python版本',
                  dataIndex: 'python_version',
                },
              ]}
            />
          </ProCard>
        </Col>

      </Row>
    </div>
  );
}
