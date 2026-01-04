/**
 * 单据执行效率分析页面
 *
 * 提供单据执行效率分析功能，包括平均耗时、瓶颈分析、优化建议等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useState, useEffect } from 'react';
import { Card, Statistic, Table, Tag, Alert, DatePicker, Select, Space, Button } from 'antd';
import { App } from 'antd';
import { Column, Pie } from '@ant-design/charts';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { apiRequest } from '../../../../../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

/**
 * 效率分析数据接口定义
 */
interface EfficiencyAnalysis {
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
    node_name?: string;
    current_avg_hours?: number;
    max_hours?: number;
    avg_hours?: number;
    suggestion: string;
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

/**
 * 单据执行效率分析页面组件
 */
const DocumentEfficiencyPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [efficiencyData, setEfficiencyData] = useState<EfficiencyAnalysis | null>(null);
  const [documentType, setDocumentType] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  /**
   * 加载效率分析数据
   */
  const loadEfficiencyData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (documentType) {
        params.document_type = documentType;
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.date_start = dateRange[0].toISOString();
        params.date_end = dateRange[1].toISOString();
      }

      const result = await apiRequest('/apps/kuaizhizao/documents/efficiency', {
        method: 'GET',
        params,
      });
      setEfficiencyData(result);
    } catch (error) {
      messageApi.error('获取效率分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEfficiencyData();
  }, []);

  /**
   * 节点统计表格列定义
   */
  const nodeStatisticsColumns = [
    {
      title: '节点名称',
      dataIndex: 'node_name',
      key: 'node_name',
      width: 150,
    },
    {
      title: '执行次数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      align: 'right' as const,
    },
    {
      title: '平均耗时（小时）',
      dataIndex: 'avg_hours',
      key: 'avg_hours',
      width: 150,
      align: 'right' as const,
      render: (value: number) => value?.toFixed(2) || '-',
    },
    {
      title: '最长耗时（小时）',
      dataIndex: 'max_hours',
      key: 'max_hours',
      width: 150,
      align: 'right' as const,
      render: (value: number) => value?.toFixed(2) || '-',
    },
    {
      title: '最短耗时（小时）',
      dataIndex: 'min_hours',
      key: 'min_hours',
      width: 150,
      align: 'right' as const,
      render: (value: number) => value?.toFixed(2) || '-',
    },
  ];

  return (
    <ListPageTemplate>
      <div style={{ padding: '24px' }}>
        {/* 筛选条件 */}
        <Card style={{ marginBottom: 16 }}>
          <Space>
            <Select
              placeholder="单据类型"
              style={{ width: 150 }}
              allowClear
              value={documentType}
              onChange={setDocumentType}
            >
              <Option value="work_order">工单</Option>
              <Option value="purchase_order">采购订单</Option>
              <Option value="sales_order">销售订单</Option>
            </Select>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            />
            <Button type="primary" onClick={loadEfficiencyData} loading={loading}>
              查询
            </Button>
          </Space>
        </Card>

        {/* 平均耗时统计 */}
        <Card title="平均耗时统计" style={{ marginBottom: 16 }} loading={loading}>
          <Statistic
            title="平均耗时"
            value={efficiencyData?.average_duration_hours || 0}
            precision={2}
            suffix="小时"
          />
        </Card>

        {/* 瓶颈节点分析 */}
        {efficiencyData?.bottleneck_nodes && efficiencyData.bottleneck_nodes.length > 0 && (
          <Card title="瓶颈节点分析" style={{ marginBottom: 16 }} loading={loading}>
            <Table
              columns={nodeStatisticsColumns}
              dataSource={efficiencyData.bottleneck_nodes}
              rowKey="node_code"
              pagination={false}
              size="small"
            />
          </Card>
        )}

        {/* 优化建议 */}
        {efficiencyData?.optimization_suggestions && efficiencyData.optimization_suggestions.length > 0 && (
          <Card title="优化建议" style={{ marginBottom: 16 }} loading={loading}>
            {efficiencyData.optimization_suggestions.map((suggestion, index) => (
              <Alert
                key={index}
                message={suggestion.suggestion}
                type={suggestion.type === 'bottleneck' ? 'warning' : 'info'}
                style={{ marginBottom: 8 }}
              />
            ))}
          </Card>
        )}

        {/* 节点统计图表 */}
        {efficiencyData?.node_statistics && efficiencyData.node_statistics.length > 0 && (
          <Card title="节点耗时统计" style={{ marginBottom: 16 }} loading={loading}>
            <Column
              data={efficiencyData.node_statistics}
              xField="node_name"
              yField="avg_hours"
              height={300}
            />
          </Card>
        )}

        {/* 节点统计表格 */}
        {efficiencyData?.node_statistics && efficiencyData.node_statistics.length > 0 && (
          <Card title="节点详细统计" loading={loading}>
            <Table
              columns={nodeStatisticsColumns}
              dataSource={efficiencyData.node_statistics}
              rowKey="node_code"
              pagination={false}
            />
          </Card>
        )}
      </div>
    </ListPageTemplate>
  );
};

export default DocumentEfficiencyPage;

