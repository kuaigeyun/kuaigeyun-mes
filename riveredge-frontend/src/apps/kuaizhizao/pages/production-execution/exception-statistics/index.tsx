/**
 * 异常统计分析页面
 *
 * 提供异常统计分析功能，包括缺料异常、延期异常、质量异常的统计信息。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useState, useEffect } from 'react';
import { App, Card, Statistic, Row, Col, DatePicker, Space, message, Button } from 'antd';
import { WarningOutlined, ClockCircleOutlined, BugOutlined, CheckCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';
import { Column, Pie } from '@ant-design/charts';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

/**
 * 异常统计接口定义
 */
interface ExceptionStatistics {
  summary?: {
    total_exceptions?: number;
    total_pending?: number;
    total_resolved?: number;
    resolution_rate?: number;
  };
  material_shortage?: {
    total?: number;
    pending?: number;
    resolved?: number;
    by_level?: Record<string, number>;
  };
  delivery_delay?: {
    total?: number;
    pending?: number;
    resolved?: number;
    by_level?: Record<string, number>;
  };
  quality?: {
    total?: number;
    pending?: number;
    closed?: number;
    by_severity?: Record<string, number>;
  };
}

/**
 * 异常统计分析页面组件
 */
const ExceptionStatisticsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [statistics, setStatistics] = useState<ExceptionStatistics>({});
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  /**
   * 加载统计数据
   */
  const loadStatistics = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.date_start = dateRange[0].format('YYYY-MM-DD');
        params.date_end = dateRange[1].format('YYYY-MM-DD');
      }
      const result = await apiRequest('/apps/kuaizhizao/exceptions/statistics', {
        method: 'GET',
        params,
      });
      setStatistics(result || {});
    } catch (error) {
      messageApi.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, [dateRange]);

  /**
   * 处理刷新
   */
  const handleRefresh = () => {
    loadStatistics();
  };

  /**
   * 处理手动触发异常检测
   */
  const handleTriggerDetection = async () => {
    try {
      setLoading(true);
      await apiRequest('/apps/kuaizhizao/exceptions/detect', {
        method: 'POST',
      });
      messageApi.success('异常检测已触发，请稍后查看结果');
      // 延迟刷新统计数据
      setTimeout(() => {
        loadStatistics();
      }, 2000);
    } catch (error: any) {
      messageApi.error(error.message || '触发异常检测失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ListPageTemplate>
      <div style={{ padding: '24px' }}>
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          {/* 日期筛选和操作 */}
          <Card>
            <Space>
              <span>日期范围：</span>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                format="YYYY-MM-DD"
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleTriggerDetection}
                loading={loading}
              >
                触发异常检测
              </Button>
            </Space>
          </Card>

          {/* 总体统计 */}
          <Card title="总体统计">
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="异常总数"
                  value={statistics.summary?.total_exceptions || 0}
                  prefix={<WarningOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="待处理"
                  value={statistics.summary?.total_pending || 0}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="已解决"
                  value={statistics.summary?.total_resolved || 0}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="解决率"
                  value={statistics.summary?.resolution_rate || 0}
                  suffix="%"
                  precision={2}
                />
              </Col>
            </Row>
          </Card>

          {/* 缺料异常统计 */}
          <Card title="缺料异常统计" loading={loading}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="缺料异常总数"
                  value={statistics.material_shortage?.total || 0}
                  prefix={<WarningOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="待处理"
                  value={statistics.material_shortage?.pending || 0}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="已解决"
                  value={statistics.material_shortage?.resolved || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="按级别分布"
                  value={Object.keys(statistics.material_shortage?.by_level || {}).length}
                />
              </Col>
            </Row>
            {statistics.material_shortage?.by_level && Object.keys(statistics.material_shortage.by_level).length > 0 && (
              <>
                <Row gutter={16} style={{ marginTop: 16 }}>
                  {Object.entries(statistics.material_shortage.by_level).map(([level, count]) => (
                    <Col span={6} key={level}>
                      <Statistic
                        title={`${level === 'critical' ? '紧急' : level === 'high' ? '高' : level === 'medium' ? '中' : '低'}级别`}
                        value={count}
                      />
                    </Col>
                  ))}
                </Row>
                <div style={{ marginTop: 24 }}>
                  <Column
                    data={Object.entries(statistics.material_shortage.by_level).map(([level, count]) => ({
                      level: level === 'critical' ? '紧急' : level === 'high' ? '高' : level === 'medium' ? '中' : '低',
                      count,
                    }))}
                    xField="level"
                    yField="count"
                    label={{
                      position: 'top',
                    }}
                    height={300}
                  />
                </div>
              </>
            )}
          </Card>

          {/* 延期异常统计 */}
          <Card title="延期异常统计" loading={loading}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="延期异常总数"
                  value={statistics.delivery_delay?.total || 0}
                  prefix={<ClockCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="待处理"
                  value={statistics.delivery_delay?.pending || 0}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="已解决"
                  value={statistics.delivery_delay?.resolved || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="按级别分布"
                  value={Object.keys(statistics.delivery_delay?.by_level || {}).length}
                />
              </Col>
            </Row>
            {statistics.delivery_delay?.by_level && Object.keys(statistics.delivery_delay.by_level).length > 0 && (
              <>
                <Row gutter={16} style={{ marginTop: 16 }}>
                  {Object.entries(statistics.delivery_delay.by_level).map(([level, count]) => (
                    <Col span={6} key={level}>
                      <Statistic
                        title={`${level === 'critical' ? '紧急' : level === 'high' ? '高' : level === 'medium' ? '中' : '低'}级别`}
                        value={count}
                      />
                    </Col>
                  ))}
                </Row>
                <div style={{ marginTop: 24 }}>
                  <Column
                    data={Object.entries(statistics.delivery_delay.by_level).map(([level, count]) => ({
                      level: level === 'critical' ? '紧急' : level === 'high' ? '高' : level === 'medium' ? '中' : '低',
                      count,
                    }))}
                    xField="level"
                    yField="count"
                    label={{
                      position: 'top',
                    }}
                    height={300}
                  />
                </div>
              </>
            )}
          </Card>

          {/* 质量异常统计 */}
          <Card title="质量异常统计" loading={loading}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="质量异常总数"
                  value={statistics.quality?.total || 0}
                  prefix={<BugOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="待处理"
                  value={statistics.quality?.pending || 0}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="已关闭"
                  value={statistics.quality?.closed || 0}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="按严重程度分布"
                  value={Object.keys(statistics.quality?.by_severity || {}).length}
                />
              </Col>
            </Row>
            {statistics.quality?.by_severity && Object.keys(statistics.quality.by_severity).length > 0 && (
              <>
                <Row gutter={16} style={{ marginTop: 16 }}>
                  {Object.entries(statistics.quality.by_severity).map(([severity, count]) => (
                    <Col span={6} key={severity}>
                      <Statistic
                        title={`${severity === 'critical' ? '紧急' : severity === 'major' ? '严重' : '轻微'}`}
                        value={count}
                      />
                    </Col>
                  ))}
                </Row>
                <div style={{ marginTop: 24 }}>
                  <Column
                    data={Object.entries(statistics.quality.by_severity).map(([severity, count]) => ({
                      severity: severity === 'critical' ? '紧急' : severity === 'major' ? '严重' : '轻微',
                      count,
                    }))}
                    xField="severity"
                    yField="count"
                    label={{
                      position: 'top',
                    }}
                    height={300}
                  />
                </div>
              </>
            )}
          </Card>

          {/* 异常类型分布饼图 */}
          <Card title="异常类型分布" loading={loading}>
            <Row gutter={16}>
              <Col span={12}>
                <Pie
                  data={[
                    {
                      type: '缺料异常',
                      value: statistics.material_shortage?.total || 0,
                    },
                    {
                      type: '延期异常',
                      value: statistics.delivery_delay?.total || 0,
                    },
                    {
                      type: '质量异常',
                      value: statistics.quality?.total || 0,
                    },
                  ].filter(item => item.value > 0)}
                  angleField="value"
                  colorField="type"
                  radius={0.8}
                  label={{
                    type: 'outer',
                    content: '{name}: {value} ({percentage})',
                  }}
                  height={300}
                />
              </Col>
              <Col span={12}>
                <Pie
                  data={[
                    {
                      type: '待处理',
                      value: statistics.summary?.total_pending || 0,
                    },
                    {
                      type: '已解决',
                      value: statistics.summary?.total_resolved || 0,
                    },
                  ].filter(item => item.value > 0)}
                  angleField="value"
                  colorField="type"
                  radius={0.8}
                  label={{
                    type: 'outer',
                    content: '{name}: {value} ({percentage})',
                  }}
                  height={300}
                />
              </Col>
            </Row>
          </Card>
        </Space>
      </div>
    </ListPageTemplate>
  );
};

export default ExceptionStatisticsPage;

