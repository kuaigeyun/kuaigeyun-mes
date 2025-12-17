/**
 * 运营中心 - 运营看板页面
 * 
 * 平台级运营看板，用于展示平台整体运营数据。
 * 仅超级管理员可见。
 * 
 * 详细的三层结构设计说明请参考：架构设计文档
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PageContainer } from '@ant-design/pro-components';
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
import {
  ApartmentOutlined,
  UserOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  RiseOutlined,
  FallOutlined,
  ReloadOutlined,
  DownloadOutlined,
  PieChartOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend, CartesianGrid } from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTenantStatistics } from '../../../services/superadmin';
import type { TenantStatistics } from '../../../services/superadmin';
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
  const { i18n } = useTranslation();
  
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
      const dateRange = getDateRange();
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
    messageApi.success('数据已刷新');
  }, [refetch, messageApi]);
  
  /**
   * 准备图表数据
   */
  const statusChartData = useMemo(() => {
    if (!displayStatistics) return [];
    
    return [
      { name: '激活', value: displayStatistics.by_status?.active || 0, color: '#52c41a' },
      { name: '未激活', value: displayStatistics.by_status?.inactive || 0, color: '#faad14' },
      { name: '已过期', value: displayStatistics.by_status?.expired || 0, color: '#ff4d4f' },
      { name: '已暂停', value: displayStatistics.by_status?.suspended || 0, color: '#8c8c8c' },
    ].filter(item => item.value > 0);
  }, [displayStatistics]);
  
  const planChartData = useMemo(() => {
    if (!displayStatistics) return [];
    
    const trial = (displayStatistics.total || 0) - 
                  (displayStatistics.by_plan?.basic || 0) - 
                  (displayStatistics.by_plan?.professional || 0) - 
                  (displayStatistics.by_plan?.enterprise || 0);
    
    return [
      { name: '基础版', value: displayStatistics.by_plan?.basic || 0, color: '#1890ff' },
      { name: '专业版', value: displayStatistics.by_plan?.professional || 0, color: '#722ed1' },
      { name: '企业版', value: displayStatistics.by_plan?.enterprise || 0, color: '#52c41a' },
      { name: '体验套餐', value: trial, color: '#faad14' },
    ].filter(item => item.value > 0);
  }, [displayStatistics]);
  
  /**
   * 处理数据导出（CSV 格式）
   */
  const handleExport = useCallback(() => {
    if (!displayStatistics) {
      messageApi.warning('暂无数据可导出');
      return;
    }
    
    try {
      // 准备导出数据
      const exportData: string[][] = [];
      
      // 添加标题行
      exportData.push(['运营看板统计数据', '']);
      // 使用国际化日期格式
      exportData.push(['导出时间', dayjs().format('llll')]);
      exportData.push(['时间范围', timeRangeType === 'custom' && customDateRange 
        ? `${customDateRange[0]?.format('ll')} 至 ${customDateRange[1]?.format('ll')}`
        : timeRangeType === 'today' ? '今日'
        : timeRangeType === 'week' ? '本周'
        : timeRangeType === 'month' ? '本月'
        : '全部']);
      if (hasCachedData) {
        exportData.push(['数据状态', '缓存数据（API 加载失败）']);
      }
      exportData.push([]); // 空行
      
      // 核心指标
      exportData.push(['核心指标', '']);
      exportData.push(['总组织数', String(displayStatistics.total || 0)]);
      exportData.push(['激活组织', String(displayStatistics.by_status?.active || 0)]);
      exportData.push(['未激活组织', String(displayStatistics.by_status?.inactive || 0)]);
      exportData.push(['已过期组织', String(displayStatistics.by_status?.expired || 0)]);
      exportData.push(['已暂停组织', String(displayStatistics.by_status?.suspended || 0)]);
      exportData.push([]); // 空行
      
      // 组织状态分布
      exportData.push(['组织状态分布', '']);
      exportData.push(['状态', '数量']);
      if (statusChartData.length > 0) {
        statusChartData.forEach(item => {
          exportData.push([item.name, String(item.value)]);
        });
      } else {
        exportData.push(['暂无数据', '0']);
      }
      exportData.push([]); // 空行
      
      // 组织套餐分布
      exportData.push(['组织套餐分布', '']);
      exportData.push(['套餐类型', '数量']);
      if (planChartData.length > 0) {
        planChartData.forEach(item => {
          exportData.push([item.name, String(item.value)]);
        });
      } else {
        exportData.push(['暂无数据', '0']);
      }
      exportData.push([]); // 空行
      
      // 数据更新时间（使用国际化格式）
      if (displayStatistics.updated_at) {
        exportData.push(['数据更新时间', dayjs(displayStatistics.updated_at).format('llll')]);
      } else if (dataUpdatedAt) {
        exportData.push(['数据更新时间', dayjs(dataUpdatedAt).format('llll') + '（缓存）']);
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
      a.download = `运营看板统计数据_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      messageApi.success('数据导出成功');
    } catch (error: any) {
      console.error('导出失败:', error);
      messageApi.error('导出失败：' + (error.message || '未知错误'));
    }
  }, [displayStatistics, timeRangeType, customDateRange, statusChartData, planChartData, hasCachedData, dataUpdatedAt, messageApi]);

  return (
    <PageContainer
      title="运营看板"
      subTitle="平台级运营数据概览"
      loading={false}
      breadcrumb={false}
      extra={[
        <Space key="actions" size="middle">
          {/* 时间范围筛选 */}
          <Space>
            <Text type="secondary">时间范围：</Text>
            <Radio.Group
              value={timeRangeType}
              onChange={(e) => {
                setTimeRangeType(e.target.value);
                if (e.target.value !== 'custom') {
                  setCustomDateRange(null);
                }
              }}
              size="small"
            >
              <Radio.Button value="today">今日</Radio.Button>
              <Radio.Button value="week">本周</Radio.Button>
              <Radio.Button value="month">本月</Radio.Button>
              <Radio.Button value="custom">自定义</Radio.Button>
            </Radio.Group>
            {timeRangeType === 'custom' && (
              <RangePicker
                value={customDateRange}
                onChange={(dates) => setCustomDateRange(dates as [Dayjs | null, Dayjs | null] | null)}
                size="small"
                style={{ width: 240 }}
              />
            )}
          </Space>
          
          {/* 操作按钮 */}
          <Space>
            <Tooltip title={autoRefresh ? '关闭自动刷新' : '开启自动刷新'}>
              <Button
                type={autoRefresh ? 'primary' : 'default'}
                icon={<ReloadOutlined spin={autoRefresh} />}
                onClick={() => setAutoRefresh(!autoRefresh)}
                size="small"
              >
                {autoRefresh ? '自动刷新中' : '自动刷新'}
              </Button>
            </Tooltip>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
              size="small"
            >
              刷新
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExport}
              size="small"
            >
              导出
            </Button>
          </Space>
        </Space>
      ]}
    >
      {/* 未登录或权限不足提示 */}
      {(!hasToken || !isInfraSuperAdmin) && (
        <Card style={{ marginBottom: 24 }}>
          <Empty
            description={
              <Space direction="vertical" size="small" align="center">
                <Text type="warning" strong>
                  {!hasToken ? '请先登录' : '权限不足'}
                </Text>
                <Text type="secondary">
                  {!hasToken 
                    ? '运营看板需要平台超级管理员权限，请先登录' 
                    : '您没有访问运营看板的权限，需要平台超级管理员权限'}
                </Text>
                {!hasToken && (
                  <Button type="primary" href="/platform">
                    前往登录
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
                ⚠️ 数据加载失败，正在显示缓存数据
              </Text>
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                数据更新时间：{dataUpdatedAt ? dayjs(dataUpdatedAt).format('llll') : '未知'}
              </Text>
              <Button size="small" onClick={() => refetch()}>
                重新加载
              </Button>
            </Space>
          ) : (
            <Empty
              description={
                <Space direction="vertical" size="small" align="center">
                  <Text type="danger" strong>加载数据失败</Text>
                  <Text type="secondary">
                    {error instanceof Error ? error.message : '网络错误，请稍后重试'}
                  </Text>
                  <Button size="small" onClick={() => refetch()}>
                    重试
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
            {/* 核心指标卡片 */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="总组织数"
                    value={displayStatistics?.total || 0}
                    prefix={<ApartmentOutlined />}
                    styles={{ content: { color: '#1890ff' } }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="激活组织"
                    value={displayStatistics?.by_status?.active || 0}
                    prefix={<RiseOutlined />}
                    styles={{ content: { color: '#52c41a' } }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="未激活组织"
                    value={displayStatistics?.by_status?.inactive || 0}
                    prefix={<FallOutlined />}
                    styles={{ content: { color: '#faad14' } }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card>
                  <Statistic
                    title="已暂停组织"
                    value={displayStatistics?.by_status?.suspended || 0}
                    prefix={<ApartmentOutlined />}
                    styles={{ content: { color: '#ff4d4f' } }}
                  />
                </Card>
              </Col>
            </Row>

        {/* 组织状态分布 - 使用图表 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <PieChartOutlined />
                  <span>组织状态分布</span>
                </Space>
              }
              loading={loading}
            >
              {statusChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card 
              title={
                <Space>
                  <BarChartOutlined />
                  <span>组织套餐分布</span>
                </Space>
              }
              loading={loading}
            >
              {planChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={planChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#1890ff">
                      {planChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Card>
          </Col>
        </Row>

            {/* 数据更新时间 */}
            {(displayStatistics?.updated_at || dataUpdatedAt) && (
              <Card style={{ marginTop: 24 }}>
                <Space>
                  <Text type="secondary">
                    数据更新时间：{displayStatistics?.updated_at 
                      ? dayjs(displayStatistics.updated_at).format('llll')
                      : dataUpdatedAt 
                        ? dayjs(dataUpdatedAt).format('llll')
                        : '未知'}
                    {hasCachedData && (
                      <Text type="warning" style={{ marginLeft: 8 }}>
                        （缓存数据）
                      </Text>
                    )}
                  </Text>
                  {autoRefresh && !error && (
                    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                      （自动刷新中...）
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
          <Empty description="暂无数据" />
        </Card>
      )}
    </PageContainer>
  );
}

