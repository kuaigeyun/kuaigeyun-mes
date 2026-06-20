/**
 * 平台看板 - 平台运营数据概览
 *
 * 优化为标准、简洁、实用为主的看板布局：
 * - 顶部核心 KPI 卡片
 * - 核心趋势系列图表
 * - 状态分布与套餐分布
 * - 地域 TOP 10 列表
 *
 * 仅平台超级管理员可见。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Radio,
  Skeleton,
  Space,
  Typography,
  App,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LineChartOutlined,
  PieChartOutlined,
  ReloadOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  LoginOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { Column, Line, Pie } from '@ant-design/charts';
import { useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { useTranslation } from 'react-i18next';

import { ListPageTemplate } from '../../../components/layout-templates';
import {
  getAccessStatistics,
  getTenantStatistics,
  getUserStatistics,
} from '../../../services/superadmin';
import { getToken, getUserInfo, isInfraSuperAdminUser } from '../../../utils/auth';
import { formatDateTime } from '../../../utils/format';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

const { Text } = Typography;
const { RangePicker } = DatePicker;

type TimeRangeType = 'today' | 'week' | 'month' | 'custom';

// 简洁样式定义
const CARD_STYLE: React.CSSProperties = {
  height: '100%',
  borderRadius: 8,
};

const CHART_HEIGHT = 300;

export default function OperationsDashboard() {
  const { message: messageApi } = App.useApp();
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const hasToken = !!getToken();
  const userInfo = getUserInfo();
  const isInfraSuperAdmin = isInfraSuperAdminUser(userInfo);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timeRangeType, setTimeRangeType] = useState<TimeRangeType>('month');
  const [customDateRange, setCustomDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshInterval = 30_000;

  // Locale for dayjs
  useEffect(() => {
    const currentLang = i18n.language || 'zh-CN';
    dayjs.locale(currentLang === 'en-US' ? 'en' : 'zh-cn');
  }, [i18n.language]);

  // Fullscreen observer
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const getDateRange = useCallback((): { start?: string; end?: string } => {
    const now = dayjs();
    let start: Dayjs | null = null;
    let end: Dayjs | null = now;

    switch (timeRangeType) {
      case 'today':
        start = now.startOf('day');
        break;
      case 'week':
        start = now.startOf('week');
        break;
      case 'month':
        start = now.startOf('month');
        break;
      case 'custom':
        if (customDateRange && customDateRange[0] && customDateRange[1]) {
          start = customDateRange[0].startOf('day');
          end = customDateRange[1].endOf('day');
        }
        break;
    }

    return {
      start: start ? start.toISOString() : undefined,
      end: end ? end.toISOString() : undefined,
    };
  }, [timeRangeType, customDateRange]);

  const dateRange = getDateRange();

  // Queries
  const {
    data: tenantStats,
    isLoading: loadingTenants,
    error: tenantError,
    refetch: refetchTenants,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['tenantStatistics', timeRangeType, customDateRange],
    queryFn: async () => getTenantStatistics(),
    enabled: hasToken && isInfraSuperAdmin,
    staleTime: 60_000,
    refetchInterval: autoRefresh ? autoRefreshInterval : false,
  });

  const {
    data: userStats,
    isLoading: loadingUsers,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['userStatistics', timeRangeType, customDateRange?.[0]?.format('YYYY-MM-DD')],
    queryFn: async () => getUserStatistics({ start: dateRange.start, end: dateRange.end }),
    enabled: hasToken && isInfraSuperAdmin,
    staleTime: 60_000,
    refetchInterval: autoRefresh ? autoRefreshInterval : false,
  });

  const {
    data: accessStats,
    isLoading: loadingAccess,
    refetch: refetchAccess,
  } = useQuery({
    queryKey: ['accessStatistics', timeRangeType, customDateRange?.[0]?.format('YYYY-MM-DD')],
    queryFn: async () => getAccessStatistics({ start: dateRange.start, end: dateRange.end }),
    enabled: hasToken && isInfraSuperAdmin,
    staleTime: 60_000,
    refetchInterval: autoRefresh ? autoRefreshInterval : false,
  });

  const loading = loadingTenants || loadingUsers || loadingAccess;

  const handleRefresh = useCallback(() => {
    refetchTenants();
    refetchUsers();
    refetchAccess();
    messageApi.success(t('pages.infra.operation.refreshSuccess'));
  }, [refetchTenants, refetchUsers, refetchAccess, messageApi, t]);

  // Chart Data Processing
  const statusChartData = useMemo(() => {
    if (!tenantStats) return [];
    return [
      { name: t('pages.infra.admin.statusActive'), value: tenantStats.by_status?.active || 0 },
      { name: t('pages.infra.admin.statusInactive'), value: tenantStats.by_status?.inactive || 0 },
      { name: t('pages.infra.tenant.statusExpired'), value: tenantStats.by_status?.expired || 0 },
      { name: t('pages.infra.tenant.statusSuspended'), value: tenantStats.by_status?.suspended || 0 },
    ].filter((item) => item.value > 0);
  }, [tenantStats, t]);

  const planChartData = useMemo(() => {
    if (!tenantStats) return [];
    const total = tenantStats.total || 0;
    const basic = tenantStats.by_plan?.basic || 0;
    const professional = tenantStats.by_plan?.professional || 0;
    const enterprise = tenantStats.by_plan?.enterprise || 0;
    const trial = Math.max(0, total - basic - professional - enterprise);
    return [
      { name: t('pages.infra.operation.planBasic'), value: basic },
      { name: t('pages.infra.operation.planProfessional'), value: professional },
      { name: t('pages.infra.operation.planEnterprise'), value: enterprise },
      { name: t('pages.infra.operation.planTrial'), value: trial },
    ].filter((item) => item.value > 0);
  }, [tenantStats, t]);

  const trendData = useMemo(() => {
    const list: { date: string; value: number; type: string }[] = [];
    const regLabel = t('pages.infra.operation.board.trendRegistration');
    const loginLabel = t('pages.infra.operation.board.trendLogin');
    userStats?.registration_trend?.forEach((d: { date: string; count: number }) =>
      list.push({ date: d.date, value: d.count, type: regLabel }),
    );
    accessStats?.login_trend?.forEach((d: { date: string; count: number }) =>
      list.push({ date: d.date, value: d.count, type: loginLabel }),
    );
    return list.sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [userStats?.registration_trend, accessStats?.login_trend, t]);

  const topRegions = (src?: Record<string, number>) => {
    if (!src) return [];
    return Object.entries(src)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  };

  const registrationRegionData = useMemo(() => topRegions(userStats?.by_region), [userStats?.by_region]);

  useEffect(() => {
    if (tenantError) {
      messageApi.error(t('pages.infra.operation.loadFailed'));
    }
  }, [tenantError, messageApi, t]);

  const handleExport = useCallback(() => {
    if (!tenantStats && !userStats && !accessStats) {
      messageApi.warning(t('pages.infra.operation.noDataExport'));
      return;
    }
    try {
      const rows: string[][] = [];
      rows.push([t('pages.infra.operation.exportStatsTitle'), '']);
      rows.push([t('pages.infra.operation.exportTime'), formatDateTime(new Date(), 'llll')]);
      rows.push([]);

      if (tenantStats) {
        rows.push([t('pages.infra.operation.coreMetrics'), '']);
        rows.push([t('pages.infra.operation.totalTenants'), String(tenantStats.total || 0)]);
        rows.push([t('pages.infra.operation.activeTenants'), String(tenantStats.by_status?.active || 0)]);
        rows.push([]);
        rows.push([t('pages.infra.operation.planDistribution'), '']);
        planChartData.forEach((item) => rows.push([item.name, String(item.value)]));
        rows.push([]);
      }

      const csvContent = rows
        .map((row) =>
          row
            .map((cell) => {
              const s = String(cell ?? '');
              if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
              }
              return s;
            })
            .join(','),
        )
        .join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('pages.infra.operation.exportStatsTitle')}_${formatDateTime(new Date(), 'YYYYMMDD_HHmmss')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      messageApi.success(t('pages.infra.operation.exportSuccess'));
    } catch (err) {
      messageApi.error(t('pages.infra.operation.exportFailed', { message: String(err) }));
    }
  }, [tenantStats, userStats, accessStats, planChartData, t, messageApi]);

  if (!hasToken || !isInfraSuperAdmin) {
    return (
      <ListPageTemplate>
        <Card>
          <Empty description={t('pages.infra.operation.noPermission')} />
        </Card>
      </ListPageTemplate>
    );
  }

  return (
    <ListPageTemplate>
      <div ref={containerRef} style={{ paddingBottom: 24 }}>
        {/* 标题 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: 20 }}>{t('pages.infra.operation.board.title')}</Text>
        </div>

        {/* 顶部工具栏 */}
        <Card styles={{ body: {padding: '12px 24px' } }} style={{ marginBottom: 16 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space size="large">
                <Radio.Group
                  value={timeRangeType}
                  onChange={(e) => {
                    setTimeRangeType(e.target.value);
                    if (e.target.value !== 'custom') setCustomDateRange(null);
                  }}
                >
                  <Radio.Button value="today">{t('pages.infra.operation.today')}</Radio.Button>
                  <Radio.Button value="week">{t('pages.infra.operation.week')}</Radio.Button>
                  <Radio.Button value="month">{t('pages.infra.operation.month')}</Radio.Button>
                  <Radio.Button value="custom">{t('pages.infra.operation.custom')}</Radio.Button>
                </Radio.Group>
                {timeRangeType === 'custom' && (
                  <RangePicker
                    value={customDateRange}
                    onChange={(dates) => setCustomDateRange(dates as [Dayjs | null, Dayjs | null])}
                  />
                )}
              </Space>
            </Col>
            <Col>
              <Space>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('pages.infra.operation.dataUpdatedAt')}：
                  {formatDateTime(dataUpdatedAt, 'HH:mm:ss')}
                </Text>
                <Button 
                  icon={<ReloadOutlined spin={autoRefresh} />} 
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  type={autoRefresh ? 'primary' : 'default'}
                >
                  {autoRefresh ? t('pages.infra.operation.autoRefreshOn') : t('pages.infra.operation.autoRefresh')}
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
                  {t('pages.infra.operation.refresh')}
                </Button>
                <Button icon={<DownloadOutlined />} onClick={handleExport}>
                  {t('pages.infra.operation.export')}
                </Button>
                <Button
                  icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                  onClick={toggleFullscreen}
                />
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 核心 KPI 卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={4}>
            <Card style={CARD_STYLE} styles={{ body: {padding: 16 } }}>
              <Statistic
                title={t('pages.infra.operation.totalTenants')}
                value={tenantStats?.total || 0}
                prefix={<AppstoreOutlined style={{ color: '#1890ff' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card style={CARD_STYLE} styles={{ body: {padding: 16 } }}>
              <Statistic
                title={t('pages.infra.operation.activeTenants')}
                value={tenantStats?.by_status?.active || 0}
                styles={{ content: {color: '#52c41a' } }}
                prefix={<RocketOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card style={CARD_STYLE} styles={{ body: {padding: 16 } }}>
              <Statistic
                title={t('pages.infra.operation.totalUsers')}
                value={userStats?.total_users || 0}
                prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card style={CARD_STYLE} styles={{ body: {padding: 16 } }}>
              <Statistic
                title={t('pages.infra.operation.dauToday')}
                value={accessStats?.dau_today || 0}
                prefix={<ThunderboltOutlined style={{ color: '#faad14' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card style={CARD_STYLE} styles={{ body: {padding: 16 } }}>
              <Statistic
                title={t('pages.infra.operation.loginsToday')}
                value={accessStats?.logins_today || 0}
                prefix={<LoginOutlined style={{ color: '#13c2c2' }} />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card style={CARD_STYLE} styles={{ body: {padding: 16 } }}>
              <Statistic
                title={t('pages.infra.operation.newRegistrationsToday')}
                value={userStats?.new_today || 0}
                prefix={<UserAddOutlined style={{ color: '#eb2f96' }} />}
              />
            </Card>
          </Col>
        </Row>

        {/* 趋势图表区 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Card title={<span><LineChartOutlined style={{ marginRight: 8 }} />{t('pages.infra.operation.board.trendTitle')}</span>} style={CARD_STYLE}>
              <div style={{ height: 320 }}>
                {loading ? <Skeleton active /> : trendData.length > 0 ? (
                  <Line
                    data={trendData}
                    xField="date"
                    yField="value"
                    seriesField="type"
                    smooth
                    animation={{ appear: { animation: 'path-in', duration: 1000 } }}
                  />
                ) : <Empty />}
              </div>
            </Card>
          </Col>
        </Row>

        {/* 分布与地域 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card title={<span><PieChartOutlined style={{ marginRight: 8 }} />{t('pages.infra.operation.statusDistribution')}</span>} style={CARD_STYLE}>
              <div style={{ height: CHART_HEIGHT }}>
                {statusChartData.length > 0 ? (
                  <Pie
                    data={statusChartData}
                    angleField="value"
                    colorField="name"
                    radius={0.8}
                    innerRadius={0.6}
                    label={{ type: 'inner', offset: '-50%', content: '{value}', style: { textAlign: 'center', fontSize: 14 } }}
                  />
                ) : <Empty />}
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title={<span><BarChartOutlined style={{ marginRight: 8 }} />{t('pages.infra.operation.planDistribution')}</span>} style={CARD_STYLE}>
              <div style={{ height: CHART_HEIGHT }}>
                {planChartData.length > 0 ? (
                  <Column
                    data={planChartData}
                    xField="name"
                    yField="value"
                    label={{ position: 'center', style: { fill: '#FFFFFF', opacity: 0.6 } }}
                  />
                ) : <Empty />}
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title={<span><EnvironmentOutlined style={{ marginRight: 8 }} />{t('pages.infra.operation.registrationRegion')}</span>} style={CARD_STYLE}>
              <div style={{ height: CHART_HEIGHT, overflowY: 'auto' }}>
                {registrationRegionData.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {registrationRegionData.map((item, index) => (
                      <li key={item.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: index < registrationRegionData.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                        <Space size="middle">
                          <Text strong style={{ color: index < 3 ? '#ff4d4f' : '#8c8c8c' }}>{index + 1}</Text>
                          <Text>{item.name}</Text>
                        </Space>
                        <Text strong>{item.value}</Text>
                      </li>
                    ))}
                  </ul>
                ) : <Empty />}
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </ListPageTemplate>
  );
}
