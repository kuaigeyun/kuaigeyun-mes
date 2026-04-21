/**
 * 运营中心 - 运营看板页面
 * 
 * 平台级运营看板，用于展示平台整体运营数据。
 * 仅超级管理员可见。
 * 
 * 详细的三层结构设计说明请参考：架构设计文档
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Typography, 
  Button, 
  Space, 
  Radio, 
  DatePicker,
  Skeleton,
  Empty,
  theme,
  Tooltip,
  App,
} from 'antd';
import { ListPageTemplate, MultiTabListPageTemplate, STAT_CARD_CONFIG } from '../../../components/layout-templates';
import {
  ApartmentOutlined,
  UserOutlined,
  RiseOutlined,
  FallOutlined,
  ReloadOutlined,
  DownloadOutlined,
  PieChartOutlined,
  BarChartOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { Pie, Column, Line } from '@ant-design/charts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTenantStatistics, getUserStatistics, getAccessStatistics } from '../../../services/superadmin';
import { getToken, getUserInfo } from '../../../utils/auth';
import { useTranslation } from 'react-i18next';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';

// 扩展 dayjs 插件
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

const { Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * 时间范围类型
 */
type TimeRangeType = 'today' | 'week' | 'month' | 'custom';

/**
 * 运营看板页面组件
 */
export default function OperationsDashboard() {
  const { token } = theme.useToken();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  
  // 检查是否有 Token 和平台超级管理员权限
  const hasToken = !!getToken();
  const userInfo = getUserInfo();
  const isInfraSuperAdmin = userInfo?.user_type === 'infra_superadmin';
  
  // 根据当前语言设置 dayjs locale
  useEffect(() => {
    const currentLang = i18n.language || 'zh-CN';
    if (currentLang === 'en-US') {
      dayjs.locale('en');
    } else {
      dayjs.locale('zh-cn');
    }
  }, [i18n.language]);
  
  // 时间范围筛选状态
  const [timeRangeType, setTimeRangeType] = useState<TimeRangeType>('today');
  const [customDateRange, setCustomDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  
  // 自动刷新状态
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30000); // 默认30秒

  // Tab 切换状态
  const [activeTabKey, setActiveTabKey] = useState<string>('organization');
  
  /**
   * 计算时间范围
   */
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

  // 稳定的 queryKey：避免 dateRange.end 含毫秒导致每帧变化，引发无限请求
  const userStatsQueryKey = useMemo(
    () => ['userStatistics', timeRangeType, customDateRange?.[0]?.format('YYYY-MM-DD'), customDateRange?.[1]?.format('YYYY-MM-DD')],
    [timeRangeType, customDateRange],
  );
  const accessStatsQueryKey = useMemo(
    () => ['accessStatistics', timeRangeType, customDateRange?.[0]?.format('YYYY-MM-DD'), customDateRange?.[1]?.format('YYYY-MM-DD')],
    [timeRangeType, customDateRange],
  );

  /**
   * 使用 React Query 获取统计数据（支持缓存和自动刷新）
   * 包含降级方案：API 失败时显示缓存数据
   */
  const { 
    data: statistics, 
    isLoading: loading, 
    error, 
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['tenantStatistics', timeRangeType, customDateRange],
    queryFn: async () => {
      const data = await getTenantStatistics();
      return data;
    },
    enabled: hasToken && isInfraSuperAdmin,
    staleTime: 60000,
    gcTime: 300000,
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: userStats, isLoading: loadingUser, refetch: refetchUser } = useQuery({
    queryKey: userStatsQueryKey,
    queryFn: async () => getUserStatistics({ start: dateRange.start, end: dateRange.end }),
    enabled: hasToken && isInfraSuperAdmin,
    staleTime: 60000,
    gcTime: 300000,
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });

  const { data: accessStats, isLoading: loadingAccess, refetch: refetchAccess } = useQuery({
    queryKey: accessStatsQueryKey,
    queryFn: async () => getAccessStatistics({ start: dateRange.start, end: dateRange.end }),
    enabled: hasToken && isInfraSuperAdmin,
    staleTime: 60000,
    gcTime: 300000,
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
  });
  
  // 降级方案：如果 API 失败但有缓存数据，使用缓存数据
  const displayStatistics = error && statistics ? statistics : statistics;
  const hasCachedData = error && statistics;
  
  /**
   * 数据预加载：在组件挂载时预加载数据（如果用户有权限）
   */
  useEffect(() => {
    if (hasToken && isInfraSuperAdmin) {
      // 预加载默认时间范围的数据
      queryClient.prefetchQuery({
        queryKey: ['tenantStatistics', 'today', null],
        queryFn: async () => {
          const data = await getTenantStatistics();
          return data;
        },
        staleTime: 60000,
      });
    }
  }, [hasToken, isInfraSuperAdmin, queryClient]);
  
  /**
   * 自动刷新逻辑
   */
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetch();
      refetchUser();
      refetchAccess();
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, autoRefreshInterval, refetch, refetchUser, refetchAccess]);
  
  /**
   * 处理手动刷新
   */
  const handleRefresh = useCallback(() => {
    refetch();
    refetchUser();
    refetchAccess();
    messageApi.success(t('pages.infra.operation.refreshSuccess'));
  }, [refetch, refetchUser, refetchAccess, messageApi, t]);
  
  /**
   * 准备图表数据
   */
  const statusChartData = useMemo(() => {
    if (!displayStatistics) return [];
    
    return [
      { name: t('pages.infra.admin.statusActive'), value: displayStatistics.by_status?.active || 0, color: '#52c41a' },
      { name: t('pages.infra.admin.statusInactive'), value: displayStatistics.by_status?.inactive || 0, color: '#faad14' },
      { name: t('pages.infra.tenant.statusExpired'), value: displayStatistics.by_status?.expired || 0, color: '#ff4d4f' },
      { name: t('pages.infra.tenant.statusSuspended'), value: displayStatistics.by_status?.suspended || 0, color: '#8c8c8c' },
    ].filter(item => item.value > 0);
  }, [displayStatistics, t]);
  
  const planChartData = useMemo(() => {
    if (!displayStatistics) return [];

    const trial = (displayStatistics.total || 0) -
                  (displayStatistics.by_plan?.basic || 0) -
                  (displayStatistics.by_plan?.professional || 0) -
                  (displayStatistics.by_plan?.enterprise || 0);

    return [
      { name: t('pages.infra.operation.planBasic'), value: displayStatistics.by_plan?.basic || 0, color: '#1890ff' },
      { name: t('pages.infra.operation.planProfessional'), value: displayStatistics.by_plan?.professional || 0, color: '#722ed1' },
      { name: t('pages.infra.operation.planEnterprise'), value: displayStatistics.by_plan?.enterprise || 0, color: '#52c41a' },
      { name: t('pages.infra.operation.planTrial'), value: trial, color: '#faad14' },
    ].filter(item => item.value > 0);
  }, [displayStatistics, t]);

  const registrationRegionChartData = useMemo(() => {
    if (!userStats?.by_region) return [];
    const colors = ['#1890ff', '#52c41a', '#722ed1', '#faad14', '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb', '#8c8c8c'];
    return Object.entries(userStats.by_region).map(([region, value], i) => ({
      name: region,
      value,
      color: colors[i % colors.length],
    })).filter(item => item.value > 0);
  }, [userStats?.by_region]);

  const registrationTrendData = useMemo(() => {
    if (!userStats?.registration_trend?.length) return [];
    return userStats.registration_trend.map((d) => ({ date: d.date, count: d.count }));
  }, [userStats?.registration_trend]);

  const loginTrendData = useMemo(() => {
    if (!accessStats?.login_trend?.length) return [];
    return accessStats.login_trend.map((d) => ({ date: d.date, count: d.count }));
  }, [accessStats?.login_trend]);

  const loginRegionChartData = useMemo(() => {
    if (!accessStats?.by_region) return [];
    const colors = ['#1890ff', '#52c41a', '#722ed1', '#faad14', '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb', '#8c8c8c'];
    return Object.entries(accessStats.by_region).map(([region, value], i) => ({
      name: region,
      value,
      color: colors[i % colors.length],
    })).filter(item => item.value > 0);
  }, [accessStats?.by_region]);
  
  /**
   * 处理数据导出（CSV 格式）
   */
  const handleExport = useCallback(() => {
    if (!displayStatistics && !userStats && !accessStats) {
      messageApi.warning(t('pages.infra.operation.noDataExport'));
      return;
    }
    
    try {
      // 准备导出数据
      const exportData: string[][] = [];
      
      // 添加标题行
      exportData.push([t('pages.infra.operation.exportStatsTitle'), '']);
      // 使用国际化日期格式
      exportData.push([t('pages.infra.operation.exportTime'), dayjs().format('llll')]);
      exportData.push([t('pages.infra.operation.timeRangeLabel'), timeRangeType === 'custom' && customDateRange 
        ? `${customDateRange[0]?.format('ll')}${t('pages.infra.operation.dateRangeConnector')}${customDateRange[1]?.format('ll')}`
        : timeRangeType === 'today' ? t('pages.infra.operation.timeRangeToday')
        : timeRangeType === 'week' ? t('pages.infra.operation.timeRangeWeek')
        : timeRangeType === 'month' ? t('pages.infra.operation.timeRangeMonth')
        : t('pages.infra.operation.timeRangeAll')]);
      if (hasCachedData) {
        exportData.push([t('pages.infra.operation.exportDataStatus'), t('pages.infra.operation.cachedData')]);
      }
      exportData.push([]); // 空行

      // 组织核心指标
      if (displayStatistics) {
        exportData.push([t('pages.infra.operation.coreMetrics'), '']);
        exportData.push([t('pages.infra.operation.totalTenants'), String(displayStatistics.total || 0)]);
        exportData.push([t('pages.infra.operation.activeTenants'), String(displayStatistics.by_status?.active || 0)]);
        exportData.push([t('pages.infra.operation.inactiveTenants'), String(displayStatistics.by_status?.inactive || 0)]);
        exportData.push([t('pages.infra.operation.expiredTenants'), String(displayStatistics.by_status?.expired || 0)]);
        exportData.push([t('pages.infra.operation.suspendedTenants'), String(displayStatistics.by_status?.suspended || 0)]);
        exportData.push([]); // 空行

        exportData.push([t('pages.infra.operation.statusDistribution'), '']);
        exportData.push([t('pages.infra.operation.statusLabel'), t('pages.infra.operation.countLabel')]);
        if (statusChartData.length > 0) {
          statusChartData.forEach(item => {
            exportData.push([item.name, String(item.value)]);
          });
        } else {
          exportData.push([t('pages.infra.operation.noData'), '0']);
        }
        exportData.push([]); // 空行

        exportData.push([t('pages.infra.operation.planDistribution'), '']);
        exportData.push([t('pages.infra.tenant.plan'), t('pages.infra.operation.countLabel')]);
        if (planChartData.length > 0) {
          planChartData.forEach(item => {
            exportData.push([item.name, String(item.value)]);
          });
        } else {
          exportData.push([t('pages.infra.operation.noData'), '0']);
        }
        exportData.push([]); // 空行
      }

      // 用户与访问统计
      if (userStats || accessStats) {
        exportData.push([t('pages.infra.operation.userStats'), '']);
        if (userStats) {
          exportData.push([t('pages.infra.operation.totalUsers'), String(userStats.total_users || 0)]);
          exportData.push([t('pages.infra.operation.newRegistrationsToday'), String(userStats.new_today || 0)]);
          exportData.push([t('pages.infra.operation.newRegistrationsWeek'), String(userStats.new_week || 0)]);
          exportData.push([t('pages.infra.operation.newRegistrationsMonth'), String(userStats.new_month || 0)]);
        }
        if (accessStats) {
          exportData.push([t('pages.infra.operation.loginsToday'), String(accessStats.logins_today || 0)]);
          exportData.push([t('pages.infra.operation.dauToday'), String(accessStats.dau_today || 0)]);
          exportData.push(['Total logins', String(accessStats.total_logins || 0)]);
          exportData.push(['Success logins', String(accessStats.success_count || 0)]);
          exportData.push(['Failed logins', String(accessStats.failed_count || 0)]);
        }
        if (userStats?.by_region && Object.keys(userStats.by_region).length > 0) {
          exportData.push([]);
          exportData.push([t('pages.infra.operation.registrationRegion'), '']);
          exportData.push([t('pages.infra.operation.statusLabel'), t('pages.infra.operation.countLabel')]);
          Object.entries(userStats.by_region).forEach(([region, v]) => {
            exportData.push([region, String(v)]);
          });
        }
        if (accessStats?.by_region && Object.keys(accessStats.by_region).length > 0) {
          exportData.push([]);
          exportData.push([t('pages.infra.operation.loginRegion'), '']);
          exportData.push([t('pages.infra.operation.statusLabel'), t('pages.infra.operation.countLabel')]);
          Object.entries(accessStats.by_region).forEach(([region, v]) => {
            exportData.push([region, String(v)]);
          });
        }
        exportData.push([]); // 空行
      }

      // 数据更新时间（使用国际化格式）
      if (displayStatistics?.updated_at) {
        exportData.push([t('pages.infra.operation.dataUpdatedAt'), dayjs(displayStatistics.updated_at).format('llll')]);
      } else if (dataUpdatedAt) {
        exportData.push([t('pages.infra.operation.dataUpdatedAt'), dayjs(dataUpdatedAt).format('llll') + t('pages.infra.operation.cachedLabel')]);
      }
      
      // 转换为 CSV 格式
      const csvContent = exportData
        .map(row => row.map(cell => {
          // 处理包含逗号、引号或换行符的单元格
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(','))
        .join('\n');
      
      // 添加 BOM 以支持中文（UTF-8 with BOM）
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('pages.infra.operation.exportStatsTitle')}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      messageApi.success(t('pages.infra.operation.exportSuccess'));
    } catch (error: any) {
      console.error('导出失败:', error);
      messageApi.error(t('pages.infra.operation.exportFailed', { message: error.message || t('pages.infra.operation.unknownError') }));
    }
  }, [displayStatistics, userStats, accessStats, timeRangeType, customDateRange, statusChartData, planChartData, hasCachedData, dataUpdatedAt, messageApi, t]);

  /** 数据更新时间展示 */
  const dataUpdateFooter = hasToken && isInfraSuperAdmin && (displayStatistics?.updated_at || dataUpdatedAt || userStats?.updated_at || accessStats?.updated_at) && (
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
      <Space>
        <Text type="secondary">
          {t('pages.infra.operation.dataUpdatedAt')}：{displayStatistics?.updated_at
            ? dayjs(displayStatistics.updated_at).format('llll')
            : userStats?.updated_at
              ? dayjs(userStats.updated_at).format('llll')
              : dataUpdatedAt
                ? dayjs(dataUpdatedAt).format('llll')
                : t('pages.infra.operation.sourceUnknown')}
          {hasCachedData && <Text type="warning" style={{ marginLeft: 8 }}>{t('pages.infra.operation.cachedLabel')}</Text>}
        </Text>
        {autoRefresh && !error && <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{t('pages.infra.operation.autoRefreshing')}</Text>}
      </Space>
    </div>
  );

  /** 页面头部：标题 + 工具栏 */
  const pageHeader = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, marginBottom: 4 }}>{t('pages.infra.operation.title')}</h2>
        <Text type="secondary">{t('pages.infra.operation.subtitle')}</Text>
      </div>
      <Space size="middle" wrap>
        <Space>
          <Text type="secondary">{t('pages.infra.operation.timeRange')}</Text>
          <Radio.Group
            value={timeRangeType}
            onChange={(e) => {
              setTimeRangeType(e.target.value);
              if (e.target.value !== 'custom') {
                setCustomDateRange(null);
              }
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
              onChange={(dates) => setCustomDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
              style={{ width: 240 }}
            />
          )}
        </Space>
        <Space>
          <Tooltip title={autoRefresh ? t('pages.infra.operation.autoRefreshTooltipOn') : t('pages.infra.operation.autoRefreshTooltipOff')}>
            <Button
              type={autoRefresh ? 'primary' : 'default'}
              icon={<ReloadOutlined spin={autoRefresh} />}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? t('pages.infra.operation.autoRefreshOn') : t('pages.infra.operation.autoRefresh')}
            </Button>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            {t('pages.infra.operation.refresh')}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            {t('pages.infra.operation.export')}
          </Button>
        </Space>
      </Space>
    </div>
  );

  // 未登录或权限不足：使用 ListPageTemplate 展示提示
  if (!hasToken || !isInfraSuperAdmin) {
    return (
      <ListPageTemplate>
        {pageHeader}
        <div style={{ marginTop: 24 }}>
          <Card>
            <Empty
              description={
                <Space direction="vertical" size="small" align="center">
                  <Text type="warning" strong>
                    {!hasToken ? t('pages.infra.operation.loginFirst') : t('pages.infra.operation.noPermission')}
                  </Text>
                  <Text type="secondary">
                    {!hasToken ? t('pages.infra.operation.loginHint') : t('pages.infra.operation.noPermissionHint')}
                  </Text>
                  {!hasToken && (
                    <Button type="primary" href="/platform">
                      {t('pages.infra.operation.goLogin')}
                    </Button>
                  )}
                </Space>
              }
            />
          </Card>
        </div>
      </ListPageTemplate>
    );
  }

  return (
    <MultiTabListPageTemplate
      header={
        <>
          {pageHeader}
          {error && (
            <Card style={{ marginTop: 24 }}>
              {hasCachedData ? (
                <Space direction="vertical" size="small" align="center" style={{ width: '100%' }}>
                  <Text type="warning" strong>⚠️ {t('pages.infra.operation.loadFailedCached')}</Text>
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {t('pages.infra.operation.dataUpdatedAt')}：{dataUpdatedAt ? dayjs(dataUpdatedAt).format('llll') : t('pages.infra.operation.sourceUnknown')}
                  </Text>
                  <Button size="small" onClick={() => refetch()}>{t('pages.infra.operation.reload')}</Button>
                </Space>
              ) : (
                <Empty
                  description={
                    <Space direction="vertical" size="small" align="center">
                      <Text type="danger" strong>{t('pages.infra.operation.loadFailed')}</Text>
                      <Text type="secondary">{error instanceof Error ? error.message : t('pages.infra.operation.networkError')}</Text>
                      <Button size="small" onClick={() => refetch()}>{t('pages.infra.operation.retry')}</Button>
                    </Space>
                  }
                />
              )}
            </Card>
          )}
        </>
      }
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      padding={24}
      tabs={[
        {
          key: 'organization',
          label: (
            <Space>
              <ApartmentOutlined />
              {t('pages.infra.operation.tabOrganization')}
            </Space>
          ),
          children: (
                <>
                  {loading && !displayStatistics ? (
                    <Row gutter={[16, 16]}>
                      {[1, 2, 3, 4].map((i) => (
                        <Col xs={24} sm={12} lg={6} key={i}>
                          <Card><Skeleton active paragraph={{ rows: 1 }} /></Card>
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <>
                      {displayStatistics && (
                        <div style={{ marginBottom: 24 }}>
                          <Row gutter={STAT_CARD_CONFIG.GUTTER}>
                            <Col span={6}>
                              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                                <Statistic title={t('pages.infra.operation.totalTenants')} value={displayStatistics.total || 0} prefix={<ApartmentOutlined />} styles={{ content: { color: '#1890ff' } }} />
                              </Card>
                            </Col>
                            <Col span={6}>
                              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                                <Statistic title={t('pages.infra.operation.activeTenants')} value={displayStatistics.by_status?.active || 0} prefix={<RiseOutlined />} styles={{ content: { color: '#52c41a' } }} />
                              </Card>
                            </Col>
                            <Col span={6}>
                              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                                <Statistic title={t('pages.infra.operation.inactiveTenants')} value={displayStatistics.by_status?.inactive || 0} prefix={<FallOutlined />} styles={{ content: { color: '#faad14' } }} />
                              </Card>
                            </Col>
                            <Col span={6}>
                              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                                <Statistic title={t('pages.infra.operation.suspendedTenants')} value={displayStatistics.by_status?.suspended || 0} prefix={<ApartmentOutlined />} styles={{ content: { color: '#ff4d4f' } }} />
                              </Card>
                            </Col>
                          </Row>
                        </div>
                      )}
                      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={24} lg={12}>
                          <Card title={<Space><PieChartOutlined /><span>{t('pages.infra.operation.statusDistribution')}</span></Space>} loading={loading}>
                            {statusChartData.length > 0 ? (
                              <div style={{ height: 300 }}>
                                <Pie data={statusChartData} angleField="value" colorField="name" color={(d: { name: string }) => statusChartData.find((x) => x.name === d.name)?.color ?? '#1890ff'} radius={0.8}
                                  tooltip={{ fields: ['name', 'value'] }} />
                              </div>
                            ) : (
                              <Empty description={t('pages.infra.operation.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                          </Card>
                        </Col>
                        <Col xs={24} lg={12}>
                          <Card title={<Space><BarChartOutlined /><span>{t('pages.infra.operation.planDistribution')}</span></Space>} loading={loading}>
                            {planChartData.length > 0 ? (
                              <div style={{ height: 300 }}>
                                <Column data={planChartData} xField="name" yField="value" color={(d: { color?: string }) => d.color ?? '#1890ff'} columnStyle={{ radius: [0, 4, 4, 0] }} xAxis={{ label: { autoRotate: true } }} tooltip={{ fields: ['name', 'value'] }} />
                              </div>
                            ) : (
                              <Empty description={t('pages.infra.operation.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                          </Card>
                        </Col>
                      </Row>
                      {!loading && !displayStatistics && !error && <Empty description={t('pages.infra.operation.noData')} />}
                    </>
                  )}
                  {dataUpdateFooter}
                </>
              ),
        },
        {
          key: 'user',
          label: (
            <Space>
              <UserOutlined />
              {t('pages.infra.operation.tabUser')}
            </Space>
          ),
          children: (
                <>
                  {(loadingUser || loadingAccess) && !userStats && !accessStats ? (
                    <Row gutter={[16, 16]}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Col xs={24} sm={12} lg={6} key={i}>
                          <Card><Skeleton active paragraph={{ rows: 1 }} /></Card>
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <>
                      {(userStats || accessStats) && (
                        <div style={{ marginBottom: 24 }}>
                          <Row gutter={STAT_CARD_CONFIG.GUTTER}>
                            <Col span={5}>
                              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                                <Statistic title={t('pages.infra.operation.totalUsers')} value={userStats?.total_users ?? 0} prefix={<UserOutlined />} styles={{ content: { color: '#1890ff' } }} />
                              </Card>
                            </Col>
                            <Col span={5}>
                              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                                <Statistic title={t('pages.infra.operation.newRegistrationsToday')} value={userStats?.new_today ?? 0} styles={{ content: { color: '#52c41a' } }} />
                              </Card>
                            </Col>
                            <Col span={5}>
                              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                                <Statistic title={t('pages.infra.operation.loginsToday')} value={accessStats?.logins_today ?? 0} styles={{ content: { color: '#722ed1' } }} />
                              </Card>
                            </Col>
                            <Col span={5}>
                              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                                <Statistic title={t('pages.infra.operation.dauToday')} value={accessStats?.dau_today ?? 0} styles={{ content: { color: '#faad14' } }} />
                              </Card>
                            </Col>
                            <Col span={4}>
                              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                                <Statistic title={t('pages.infra.operation.totalLogins')} value={accessStats?.total_logins ?? 0} styles={{ content: { color: '#13c2c2' } }} />
                              </Card>
                            </Col>
                          </Row>
                        </div>
                      )}
                      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={24} lg={12}>
                          <Card title={<Space><LineChartOutlined /><span>{t('pages.infra.operation.registrationTrend')}</span></Space>} loading={loadingUser}>
                            {registrationTrendData.length > 0 ? (
                              <div style={{ height: 300 }}>
                                <Line data={registrationTrendData} xField="date" yField="count" smooth xAxis={{ label: { autoRotate: true } }} tooltip={{ fields: ['date', 'count'] }} />
                              </div>
                            ) : (
                              <Empty description={t('pages.infra.operation.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                          </Card>
                        </Col>
                        <Col xs={24} lg={12}>
                          <Card title={<Space><LineChartOutlined /><span>{t('pages.infra.operation.loginTrend')}</span></Space>} loading={loadingAccess}>
                            {loginTrendData.length > 0 ? (
                              <div style={{ height: 300 }}>
                                <Line data={loginTrendData} xField="date" yField="count" smooth xAxis={{ label: { autoRotate: true } }} tooltip={{ fields: ['date', 'count'] }} />
                              </div>
                            ) : (
                              <Empty description={t('pages.infra.operation.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                          </Card>
                        </Col>
                      </Row>
                      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                        <Col xs={24} lg={12}>
                          <Card title={<Space><PieChartOutlined /><span>{t('pages.infra.operation.registrationRegion')}</span></Space>} loading={loadingUser}>
                            {registrationRegionChartData.length > 0 ? (
                              <div style={{ height: 300 }}>
                                <Pie data={registrationRegionChartData} angleField="value" colorField="name" color={(d: { name: string }) => registrationRegionChartData.find((x) => x.name === d.name)?.color ?? '#1890ff'} radius={0.8}
                                  tooltip={{ fields: ['name', 'value'] }} />
                              </div>
                            ) : (
                              <Empty description={t('pages.infra.operation.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                          </Card>
                        </Col>
                        <Col xs={24} lg={12}>
                          <Card title={<Space><PieChartOutlined /><span>{t('pages.infra.operation.loginRegion')}</span></Space>} loading={loadingAccess}>
                            {loginRegionChartData.length > 0 ? (
                              <div style={{ height: 300 }}>
                                <Pie data={loginRegionChartData} angleField="value" colorField="name" color={(d: { name: string }) => loginRegionChartData.find((x) => x.name === d.name)?.color ?? '#1890ff'} radius={0.8}
                                  tooltip={{ fields: ['name', 'value'] }} />
                              </div>
                            ) : (
                              <Empty description={t('pages.infra.operation.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                          </Card>
                        </Col>
                      </Row>
                      {!loadingUser && !loadingAccess && !userStats && !accessStats && <Empty description={t('pages.infra.operation.noData')} />}
                    </>
                  )}
                  {dataUpdateFooter}
                </>
              ),
        },
      ]}
    />
  );
}

