/**
 * 使用情况分析和优化建议推送页面
 * 
 * 提供使用情况分析和优化建议推送功能
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { Card, Tabs, Table, Tag, Space, Button, Typography, Statistic, Progress, Alert, List } from 'antd';
import { ReloadOutlined, FileTextOutlined, BulbOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { analyzeFunctionUsage, analyzeDataQuality, analyzePerformance, generateUsageReport, FunctionUsageAnalysis, DataQualityAnalysis, PerformanceAnalysis, UsageReport } from '../../../services/usageAnalysis';
import { getSuggestions, OptimizationSuggestion } from '../../../services/optimizationSuggestion';

const { Title, Paragraph, Text } = Typography;

/**
 * 使用情况分析和优化建议推送页面组件
 */
const UsageAnalysisPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [functionUsage, setFunctionUsage] = useState<FunctionUsageAnalysis | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQualityAnalysis | null>(null);
  const [performance, setPerformance] = useState<PerformanceAnalysis | null>(null);
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<string>('function');

  /**
   * 加载功能使用分析
   */
  const loadFunctionUsage = async () => {
    try {
      setLoading(true);
      const data = await analyzeFunctionUsage();
      setFunctionUsage(data);
    } catch (error: any) {
      messageApi.error(error.message || '加载功能使用分析失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载数据质量分析
   */
  const loadDataQuality = async () => {
    try {
      setLoading(true);
      const data = await analyzeDataQuality();
      setDataQuality(data);
    } catch (error: any) {
      messageApi.error(error.message || '加载数据质量分析失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载性能分析
   */
  const loadPerformance = async () => {
    try {
      setLoading(true);
      const data = await analyzePerformance();
      setPerformance(data);
    } catch (error: any) {
      messageApi.error(error.message || '加载性能分析失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 生成使用情况分析报告
   */
  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      const data = await generateUsageReport();
      setUsageReport(data);
      messageApi.success('报告生成成功');
    } catch (error: any) {
      messageApi.error(error.message || '生成报告失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载优化建议
   */
  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const data = await getSuggestions();
      setSuggestions(data);
    } catch (error: any) {
      messageApi.error(error.message || '加载优化建议失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    if (activeTab === 'function') {
      loadFunctionUsage();
    } else if (activeTab === 'data') {
      loadDataQuality();
    } else if (activeTab === 'performance') {
      loadPerformance();
    } else if (activeTab === 'suggestions') {
      loadSuggestions();
    }
  }, [activeTab]);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>使用情况分析和优化建议推送</Title>
      <Paragraph>
        分析系统使用情况，提供优化建议，持续改进系统。
      </Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'function',
            label: '功能使用分析',
            children: (
              <Card
                title="功能使用分析"
                extra={
                  <Button icon={<ReloadOutlined />} onClick={loadFunctionUsage}>刷新</Button>
                }
                loading={loading}
              >
                {functionUsage && (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <Title level={4}>统计信息</Title>
                      <Space size="large">
                        <Statistic title="总功能数" value={functionUsage.summary.total_functions} />
                        <Statistic title="总使用次数" value={functionUsage.summary.total_usage_count} />
                        <Statistic title="使用人数" value={functionUsage.summary.total_user_count} />
                        <Statistic title="未使用功能数" value={functionUsage.summary.unused_count} />
                        <Statistic title="高频功能数" value={functionUsage.summary.high_frequency_count} />
                      </Space>
                    </div>
                  </Space>
                )}
              </Card>
            ),
          },
          {
            key: 'data',
            label: '数据质量分析',
            children: (
              <Card
                title="数据质量分析"
                extra={
                  <Button icon={<ReloadOutlined />} onClick={loadDataQuality}>刷新</Button>
                }
                loading={loading}
              >
                {dataQuality && (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <Title level={4}>数据质量评分</Title>
                      <Progress
                        type="circle"
                        percent={dataQuality.overall_score}
                        format={(percent) => `${percent}分`}
                        strokeColor={{
                          '0%': '#ff4d4f',
                          '50%': '#faad14',
                          '100%': '#52c41a',
                        }}
                      />
                    </div>
                  </Space>
                )}
              </Card>
            ),
          },
          {
            key: 'performance',
            label: '性能分析',
            children: (
              <Card
                title="性能分析"
                extra={
                  <Button icon={<ReloadOutlined />} onClick={loadPerformance}>刷新</Button>
                }
                loading={loading}
              >
                {performance && (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <Title level={4}>响应时间</Title>
                      <Space size="large">
                        <Statistic title="平均响应时间" value={performance.response_time.avg} suffix="ms" />
                        <Statistic title="P95响应时间" value={performance.response_time.p95} suffix="ms" />
                        <Statistic title="P99响应时间" value={performance.response_time.p99} suffix="ms" />
                        <Statistic title="最大响应时间" value={performance.response_time.max} suffix="ms" />
                      </Space>
                    </div>
                  </Space>
                )}
              </Card>
            ),
          },
          {
            key: 'suggestions',
            label: '优化建议',
            children: (
              <Card
                title="优化建议推送"
                extra={
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={loadSuggestions}>刷新</Button>
                    <Button type="primary" icon={<FileTextOutlined />} onClick={handleGenerateReport}>
                      生成报告
                    </Button>
                  </Space>
                }
                loading={loading}
              >
                {suggestions.length > 0 ? (
                  <List
                    dataSource={suggestions}
                    renderItem={(item) => (
                      <List.Item>
                        <Card style={{ width: '100%' }}>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <div>
                              <Tag color={item.priority === 'high' ? 'red' : item.priority === 'medium' ? 'orange' : 'blue'}>
                                {item.priority === 'high' ? '高优先级' : item.priority === 'medium' ? '中优先级' : '低优先级'}
                              </Tag>
                              <Tag>{item.category}</Tag>
                              <Text strong>{item.title}</Text>
                            </div>
                            <Text>{item.description}</Text>
                            <Text type="secondary">建议操作：{item.action}</Text>
                          </Space>
                        </Card>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Alert message="暂无优化建议" type="info" showIcon />
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default UsageAnalysisPage;
