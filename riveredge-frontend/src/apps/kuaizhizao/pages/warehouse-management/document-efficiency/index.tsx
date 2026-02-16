/**
 * 单据执行效率分析页面
 *
 * 提供单据执行效率分析功能，包括平均耗时、瓶颈节点、优化建议等。
 *
 * @author Luigi Lu
 * @date 2026-01-15
 */

import React, { useState, useEffect } from 'react';
import { App, Card, Row, Col, Statistic, Table, Select, DatePicker, Space, Tag, Alert, List } from 'antd';
import { BarChartOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { Bar, Column } from '@ant-design/charts';
import { apiRequest } from '../../../../../services/api';
import dayjs, { Dayjs } from 'dayjs';

interface EfficiencyData {
  average_duration_hours?: number;
  bottleneck_nodes?: Array<{
    node_code: string;
    node_name: string;
    count: number;
    avg_hours: number;
    max_hours: number;
    min_hours: number;
  }>;
  optimization_suggestions?: Array<{
    type: string;
    node_name: string;
    suggestion: string;
    current_avg_hours?: number;
    max_hours?: number;
    avg_hours?: number;
  }>;
  node_statistics?: Array<{
    node_code: string;
    node_name: string;
    count: number;
    avg_hours: number;
    max_hours: number;
    min_hours: number;
  }>;
}

const DocumentEfficiencyPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [efficiencyData, setEfficiencyData] = useState<EfficiencyData | null>(null);

  // 查询参数
  const [documentType, setDocumentType] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);

  /**
   * 加载效率分析数据
   */
  const loadEfficiencyData = async () => {
    try {
      setLoading(true);
      const result = await apiRequest('/apps/kuaizhizao/documents/efficiency', {
        method: 'GET',
        params: {
          document_type: documentType,
          date_start: dateRange[0].format('YYYY-MM-DD'),
          date_end: dateRange[1].format('YYYY-MM-DD'),
        },
      });
      setEfficiencyData(result);
    } catch (error: any) {
      messageApi.error(error.message || '加载效率分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEfficiencyData();
  }, [documentType, dateRange]);

  /**
   * 节点统计图表配置
   */
  const nodeStatsConfig = efficiencyData?.node_statistics
    ? {
        data: efficiencyData.node_statistics.map((node) => ({
          node: node.node_name,
          avg_hours: node.avg_hours,
        })),
        xField: 'node',
        yField: 'avg_hours',
        label: {
          position: 'top',
          formatter: (data: any) => `${data.avg_hours.toFixed(2)}h`,
        },
        tooltip: {
          formatter: (data: any) => ({
            name: '平均耗时',
            value: `${data.avg_hours.toFixed(2)}小时`,
          }),
        },
      }
    : null;

  return (
    <ListPageTemplate>
      {/* 查询条件 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>单据类型：</span>
          <Select
            value={documentType}
            onChange={setDocumentType}
            style={{ width: 150 }}
            allowClear
            placeholder="全部"
          >
            <Select.Option value="work_order">工单</Select.Option>
            <Select.Option value="purchase_order">采购订单</Select.Option>
            <Select.Option value="sales_order">销售订单</Select.Option>
          </Select>

          <span>时间范围：</span>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              } else {
                setDateRange([dayjs().subtract(30, 'day'), dayjs()]);
              }
            }}
          />
        </Space>
      </Card>

      {/* 统计概览 */}
      {efficiencyData && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="平均耗时"
                  value={efficiencyData.average_duration_hours || 0}
                  suffix="小时"
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="瓶颈节点数"
                  value={efficiencyData.bottleneck_nodes?.length || 0}
                  suffix="个"
                  valueStyle={{ color: '#f5222d' }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="优化建议数"
                  value={efficiencyData.optimization_suggestions?.length || 0}
                  suffix="条"
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 瓶颈节点 */}
          {efficiencyData.bottleneck_nodes && efficiencyData.bottleneck_nodes.length > 0 && (
            <Card title="瓶颈节点分析" style={{ marginBottom: 16 }}>
              <Table
                size="small"
                columns={[
                  { title: '节点名称', dataIndex: 'node_name', width: 150 },
                  { title: '执行次数', dataIndex: 'count', width: 100, align: 'right' as const },
                  {
                    title: '平均耗时',
                    dataIndex: 'avg_hours',
                    width: 120,
                    align: 'right' as const,
                    render: (value: number) => `${value.toFixed(2)}小时`,
                  },
                  {
                    title: '最长耗时',
                    dataIndex: 'max_hours',
                    width: 120,
                    align: 'right' as const,
                    render: (value: number) => `${value.toFixed(2)}小时`,
                  },
                  {
                    title: '最短耗时',
                    dataIndex: 'min_hours',
                    width: 120,
                    align: 'right' as const,
                    render: (value: number) => `${value.toFixed(2)}小时`,
                  },
                ]}
                dataSource={efficiencyData.bottleneck_nodes}
                pagination={false}
              />
            </Card>
          )}

          {/* 优化建议 */}
          {efficiencyData.optimization_suggestions && efficiencyData.optimization_suggestions.length > 0 && (
            <Card title="优化建议" style={{ marginBottom: 16 }}>
              <List
                dataSource={efficiencyData.optimization_suggestions}
                renderItem={(item) => (
                  <List.Item>
                    <Alert
                      title={item.node_name}
                      description={item.suggestion}
                      type={item.type === 'bottleneck' ? 'warning' : 'info'}
                      icon={item.type === 'bottleneck' ? <WarningOutlined /> : <CheckCircleOutlined />}
                      showIcon
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}

          {/* 节点统计图表 */}
          {nodeStatsConfig && (
            <Card title="节点耗时统计" style={{ marginBottom: 16 }}>
              <Column {...nodeStatsConfig} height={300} />
            </Card>
          )}

          {/* 节点详细统计 */}
          {efficiencyData.node_statistics && efficiencyData.node_statistics.length > 0 && (
            <Card title="节点详细统计">
              <Table
                size="small"
                columns={[
                  { title: '节点名称', dataIndex: 'node_name', width: 150 },
                  { title: '执行次数', dataIndex: 'count', width: 100, align: 'right' as const },
                  {
                    title: '平均耗时',
                    dataIndex: 'avg_hours',
                    width: 120,
                    align: 'right' as const,
                    render: (value: number) => `${value.toFixed(2)}小时`,
                  },
                  {
                    title: '最长耗时',
                    dataIndex: 'max_hours',
                    width: 120,
                    align: 'right' as const,
                    render: (value: number) => `${value.toFixed(2)}小时`,
                  },
                  {
                    title: '最短耗时',
                    dataIndex: 'min_hours',
                    width: 120,
                    align: 'right' as const,
                    render: (value: number) => `${value.toFixed(2)}小时`,
                  },
                ]}
                dataSource={efficiencyData.node_statistics}
                pagination={false}
              />
            </Card>
          )}
        </>
      )}
    </ListPageTemplate>
  );
};

export default DocumentEfficiencyPage;
