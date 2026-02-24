/**
 * 系统监控页面
 *
 * 用于查看系统监控信息，包括服务器状态、CPU、内存、磁盘等
 */

import { ProCard, ProDescriptions } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { Alert, Tag, Progress } from 'antd';
import { ListPageTemplate } from '../../../components/layout-templates';
import {
  DesktopOutlined,
  ControlOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { getSystemInfo, type SystemInfo } from '../../../services/tenant';
import { useTranslation } from 'react-i18next';

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
 * 监控管理页面组件
 */
export default function MonitoringPage() {
  const { t } = useTranslation();
  // 获取系统信息
  const { data: systemInfo, isLoading, error } = useQuery({
    queryKey: ['systemInfo'],
    queryFn: getSystemInfo,
    refetchInterval: 30000, // 每30秒刷新一次
  });

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return t('pages.infra.monitoring.uptimeFormat', { days, hours, minutes });
  };

  if (error) {
    return (
      <ListPageTemplate>
        <Alert
          message={t('pages.infra.monitoring.fetchFailed')}
          description={t('pages.infra.monitoring.fetchFailedDesc')}
          type="error"
          showIcon
        />
      </ListPageTemplate>
    );
  }

  const info = systemInfo || {
    hostname: t('pages.infra.monitoring.unknown'),
    platform: t('pages.infra.monitoring.unknown'),
    platform_version: t('pages.infra.monitoring.unknown'),
    architecture: t('pages.infra.monitoring.unknown'),
    python_version: t('pages.infra.monitoring.unknown'),
    uptime: 0,
    cpu: { count: 0, usage_percent: 0, load_average: [0, 0, 0] },
    memory: { total: 0, available: 0, used: 0, usage_percent: 0 },
    disk: { total: 0, used: 0, free: 0, usage_percent: 0 },
    network: { interfaces: [] },
  };

  return (
    <ListPageTemplate
      statCards={[
        {
          title: t('pages.infra.monitoring.uptime'),
          value: formatUptime(info.uptime),
          prefix: <ClockCircleOutlined />,
          valueStyle: { color: '#52c41a' },
        },
        {
          title: t('pages.infra.monitoring.cpuUsage'),
          value: `${info.cpu.usage_percent.toFixed(1)}%`,
          prefix: <ControlOutlined />,
          valueStyle: { color: info.cpu.usage_percent > 80 ? '#ff4d4f' : '#1890ff' },
          suffix: `${t('pages.infra.monitoring.cores')}: ${info.cpu.count}`,
        },
        {
          title: t('pages.infra.monitoring.memoryUsage'),
          value: `${info.memory.usage_percent.toFixed(1)}%`,
          prefix: <DatabaseOutlined />,
          valueStyle: { color: info.memory.usage_percent > 90 ? '#ff4d4f' : '#52c41a' },
          suffix: `${t('pages.infra.monitoring.used')}: ${formatBytes(info.memory.used)}`,
        },
        {
          title: t('pages.infra.monitoring.diskUsage'),
          value: `${info.disk.usage_percent.toFixed(1)}%`,
          prefix: <DatabaseOutlined />,
          valueStyle: { color: info.disk.usage_percent > 90 ? '#ff4d4f' : '#722ed1' },
          suffix: `${t('pages.infra.monitoring.used')}: ${formatBytes(info.disk.used)}`,
        },
      ]}
    >

      {/* 详细监控信息 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
        <div>
          <ProCard title={t('pages.infra.monitoring.cpuDetail')} loading={isLoading}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>{t('pages.infra.monitoring.cpuUsageLabel')}</span>
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
                  title: t('pages.infra.monitoring.cpuCores'),
                  dataIndex: 'count',
                },
                {
                  title: t('pages.infra.monitoring.loadAvg1'),
                  dataIndex: 'load_average',
                  render: (_, record) => record.load_average[0].toFixed(2),
                },
                {
                  title: t('pages.infra.monitoring.loadAvg5'),
                  dataIndex: 'load_average',
                  render: (_, record) => record.load_average[1].toFixed(2),
                },
                {
                  title: t('pages.infra.monitoring.loadAvg15'),
                  dataIndex: 'load_average',
                  render: (_, record) => record.load_average[2].toFixed(2),
                },
              ]}
            />
          </ProCard>
        </div>

        <div>
          <ProCard title={t('pages.infra.monitoring.memoryDetail')} loading={isLoading}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>{t('pages.infra.monitoring.memoryUsageLabel')}</span>
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
                  title: t('pages.infra.monitoring.totalMemory'),
                  dataIndex: 'total',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: t('pages.infra.monitoring.usedMemory'),
                  dataIndex: 'used',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: t('pages.infra.monitoring.availableMemory'),
                  dataIndex: 'available',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: t('pages.infra.monitoring.usageRate'),
                  dataIndex: 'usage_percent',
                  render: (text) => `${Number(text).toFixed(1)}%`,
                },
              ]}
            />
          </ProCard>
        </div>

        <div>
          <ProCard title={t('pages.infra.monitoring.diskDetail')} loading={isLoading}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span>{t('pages.infra.monitoring.diskUsageLabel')}</span>
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
                  title: t('pages.infra.monitoring.totalDisk'),
                  dataIndex: 'total',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: t('pages.infra.monitoring.usedDisk'),
                  dataIndex: 'used',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: t('pages.infra.monitoring.freeDisk'),
                  dataIndex: 'free',
                  render: (text) => formatBytes(Number(text)),
                },
                {
                  title: t('pages.infra.monitoring.usageRate'),
                  dataIndex: 'usage_percent',
                  render: (text) => `${Number(text).toFixed(1)}%`,
                },
              ]}
            />
          </ProCard>
        </div>

        <div>
          <ProCard title={t('pages.infra.monitoring.systemInfo')} loading={isLoading}>
            <div style={{ marginBottom: 14, height: 15 }} />
            <ProDescriptions
              column={1}
              dataSource={info}
              columns={[
                {
                  title: t('pages.infra.monitoring.hostname'),
                  dataIndex: 'hostname',
                },
                {
                  title: t('pages.infra.monitoring.platform'),
                  dataIndex: 'platform',
                },
                {
                  title: t('pages.infra.monitoring.platformVersion'),
                  dataIndex: 'platform_version',
                },
                {
                  title: t('pages.infra.monitoring.architecture'),
                  dataIndex: 'architecture',
                },
                {
                  title: t('pages.infra.monitoring.pythonVersion'),
                  dataIndex: 'python_version',
                },
              ]}
            />
          </ProCard>
        </div>
      </div>
    </ListPageTemplate>
  );
}
