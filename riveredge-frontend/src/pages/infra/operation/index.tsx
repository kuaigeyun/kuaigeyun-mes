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
  App
} from 'antd';
import { ListPageTemplate, STAT_CARD_CONFIG } from '../../../components/layout-templates';
import {
  ApartmentOutlined,
  // UserOutlined,
  // DatabaseOutlined,
  // CloudServerOutlined,
  RiseOutlined,
  FallOutlined,
  ReloadOutlined,
  DownloadOutlined,
  PieChartOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { Pie, Column } from '@ant-design/charts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTenantStatistics } from '../../../services/superadmin';
// import type { TenantStatistics } from '../../../services/superadmin';
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
      // const dateRange = getDateRange();
      // 注意：当前后端 API 不支持时间范围参数，这里先预留接口
      // 后续后端支持时，可以传递 dateRange 参数
      const data = await getTenantStatistics();
      return data;
    },
    enabled: hasToken && isInfraSuperAdmin, // 只有登录的平台超级管理员才能获取数据
    staleTime: 60000, // 数据在 60 秒内视为新鲜
    gcTime: 300000, // 缓存保留 5 分钟
    retry: false, // 401 错误不重试
    refetchOnWindowFocus: false, // 避免未登录时频繁请求
    throwOnError: false, // 不抛出错误，由组件处理
    // 降级方案：即使 API 失败，也返回缓存数据（如果有）
    placeholderData: (previousData) => previousData, // 使用缓存数据作为占位符
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
    }, autoRefreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, autoRefreshInterval, refetch]);
  
  /**
   * 处理手动刷新
   */
  const handleRefresh = useCallback(() => {
    refetch();
    messageApi.success(t('pages.infra.operation.refreshSuccess'));
  }, [refetch, messageApi, t]);
  
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
  
  /**
   * 处理数据导出（CSV 格式）
   */
  const handleExport = useCallback(() => {
    if (!displayStatistics) {
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
      
      // 核心指标
      exportData.push([t('pages.infra.operation.coreMetrics'), '']);
      exportData.push([t('pages.infra.operation.totalTenants'), String(displayStatistics.total || 0)]);
      exportData.push([t('pages.infra.operation.activeTenants'), String(displayStatistics.by_status?.active || 0)]);
      exportData.push([t('pages.infra.operation.inactiveTenants'), String(displayStatistics.by_status?.inactive || 0)]);
      exportData.push([t('pages.infra.operation.expiredTenants'), String(displayStatistics.by_status?.expired || 0)]);
      exportData.push([t('pages.infra.operation.suspendedTenants'), String(displayStatistics.by_status?.suspended || 0)]);
      exportData.push([]); // 空行
      
      // 组织状态分布
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
      
      // 组织套餐分布
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
      
      // 数据更新时间（使用国际化格式）
      if (displayStatistics.updated_at) {
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
  }, [displayStatistics, timeRangeType, customDateRange, statusChartData, planChartData, hasCachedData, dataUpdatedAt, messageApi, t]);

  return (
    <ListPageTemplate>
      {/* 页面头部工具栏 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, marginBottom: 4 }}>{t('pages.infra.operation.title')}</h2>
          <Text type="secondary">{t('pages.infra.operation.subtitle')}</Text>
        </div>
        <Space size="middle">
          {/* 时间范围筛选 */}
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
          
          {/* 操作按钮 */}
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
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              {t('pages.infra.operation.refresh')}
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              {t('pages.infra.operation.export')}
            </Button>
          </Space>
        </Space>
      </div>

      {/* 统计卡片区域 - 手动渲染以确保在标题下方 */}
      {displayStatistics && hasToken && isInfraSuperAdmin && (
        <div style={{ marginBottom: 24 }}>
          <Row gutter={STAT_CARD_CONFIG.GUTTER}>
            <Col span={6}>
              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                <Statistic
                  title={t('pages.infra.operation.totalTenants')}
                  value={displayStatistics.total || 0}
                  prefix={<ApartmentOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                <Statistic
                  title={t('pages.infra.operation.activeTenants')}
                  value={displayStatistics.by_status?.active || 0}
                  prefix={<RiseOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                <Statistic
                  title={t('pages.infra.operation.inactiveTenants')}
                  value={displayStatistics.by_status?.inactive || 0}
                  prefix={<FallOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card styles={{ body: { padding: '20px 24px 8px 24px' } }}>
                <Statistic
                  title={t('pages.infra.operation.suspendedTenants')}
                  value={displayStatistics.by_status?.suspended || 0}
                  prefix={<ApartmentOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      )}
      {/* 未登录或权限不足提示 */}
      {(!hasToken || !isInfraSuperAdmin) && (
        <Card style={{ marginBottom: 24 }}>
          <Empty
            description={
              <Space direction="vertical" size="small" align="center">
                <Text type="warning" strong>
                  {!hasToken ? t('pages.infra.operation.loginFirst') : t('pages.infra.operation.noPermission')}
                </Text>
                <Text type="secondary">
                  {!hasToken 
                    ? t('pages.infra.operation.loginHint') 
                    : t('pages.infra.operation.noPermissionHint')}
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
      )}
      
      {/* 错误提示（如果有缓存数据，显示警告而不是错误） */}
      {error && hasToken && isInfraSuperAdmin && (
        <Card style={{ marginBottom: 24 }}>
          {hasCachedData ? (
            <Space direction="vertical" size="small" align="center" style={{ width: '100%' }}>
              <Text type="warning" strong>
                ⚠️ {t('pages.infra.operation.loadFailedCached')}
              </Text>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {t('pages.infra.operation.dataUpdatedAt')}：{dataUpdatedAt ? dayjs(dataUpdatedAt).format('llll') : t('pages.infra.monitoring.unknown')}
              </Text>
              <Button size="small" onClick={() => refetch()}>
                {t('pages.infra.operation.reload')}
              </Button>
            </Space>
          ) : (
            <Empty
              description={
                <Space direction="vertical" size="small" align="center">
                  <Text type="danger" strong>{t('pages.infra.operation.loadFailed')}</Text>
                  <Text type="secondary">
                    {error instanceof Error ? error.message : t('pages.infra.operation.networkError')}
                  </Text>
                  <Button size="small" onClick={() => refetch()}>
                    {t('pages.infra.operation.retry')}
                  </Button>
                </Space>
              }
            />
          )}
        </Card>
      )}
      
      {/* 加载状态 */}
      {loading && !displayStatistics && hasToken && isInfraSuperAdmin ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4].map((i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card>
                <Skeleton active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <>
        {/* 组织状态分布 - 使用图表 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <PieChartOutlined />
                  <span>{t('pages.infra.operation.statusDistribution')}</span>
                </Space>
              }
              loading={loading}
            >
              {statusChartData.length > 0 ? (
                <div style={{ height: 300 }}>
                  <Pie
                    data={statusChartData}
                    angleField="value"
                    colorField="name"
                    color={(datum: { name: string }) => statusChartData.find((d) => d.name === datum.name)?.color ?? '#1890ff'}
                    radius={0.8}
                    label={{ type: 'outer', formatter: (_: any, item: any) => `${item.name}: ${((item.value / (statusChartData.reduce((s, d) => s + d.value, 0) || 1)) * 100).toFixed(0)}%` }}
                    tooltip={{ fields: ['name', 'value'] }}
                  />
                </div>
              ) : (
                <Empty description={t('pages.infra.operation.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <BarChartOutlined />
                  <span>{t('pages.infra.operation.planDistribution')}</span>
                </Space>
              }
              loading={loading}
            >
              {planChartData.length > 0 ? (
                <div style={{ height: 300 }}>
                  <Column
                    data={planChartData}
                    xField="name"
                    yField="value"
                    color={(datum: { color?: string }) => datum.color ?? '#1890ff'}
                    columnStyle={{ radius: [0, 4, 4, 0] }}
                    xAxis={{ label: { autoRotate: true } }}
                    tooltip={{ fields: ['name', 'value'] }}
                  />
                </div>
              ) : (
                <Empty description={t('pages.infra.operation.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>

            {/* 数据更新时间 */}
            {(displayStatistics?.updated_at || dataUpdatedAt) && (
              <Card style={{ marginTop: 24 }}>
                <Space>
                  <Text type="secondary">
                    {t('pages.infra.operation.dataUpdatedAt')}：{displayStatistics?.updated_at 
                      ? dayjs(displayStatistics.updated_at).format('llll')
                      : dataUpdatedAt 
                        ? dayjs(dataUpdatedAt).format('llll')
                        : t('pages.infra.monitoring.unknown')}
                    {hasCachedData && (
                      <Text type="warning" style={{ marginLeft: 8 }}>
                        {t('pages.infra.operation.cachedLabel')}
                      </Text>
                    )}
                  </Text>
                  {autoRefresh && !error && (
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      {t('pages.infra.operation.autoRefreshing')}
                    </Text>
                  )}
                </Space>
              </Card>
            )}
        </>
      )}
      
      {/* 有权限但无数据 */}
      {!loading && !error && !displayStatistics && hasToken && isInfraSuperAdmin && (
        <Card>
          <Empty description={t('pages.infra.operation.noData')} />
        </Card>
      )}
    </ListPageTemplate>
  );
}

