/**
 * 单据执行效率分析页面
 *
 * 提供单据执行效率分析功能，包括平均耗时、瓶颈节点、优化建议等。
 *
 * @author Luigi Lu
 * @date 2026-01-15
 */

import React, { useState, useEffect } from 'react';
import {
  App,
  Row,
  Col,
  Statistic,
  Table,
  Select,
  DatePicker,
  Space,
  Alert,
  List,
  Spin,
  Descriptions,
  Typography,
  Divider,
  Timeline,
} from 'antd';
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { ListPageTemplate, DetailDrawerSection } from '../../../../../components/layout-templates';
import { Column } from '@ant-design/charts';
import { apiRequest } from '../../../../../services/api';
import dayjs, { Dayjs } from 'dayjs';
import { formatDateTime } from '../../../../../utils/format';

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

const docTypeLabel = (t?: string) =>
  t === 'work_order' ? '工单' : t === 'purchase_order' ? '采购订单' : t === 'sales_order' ? '销售订单' : '全部';

const DocumentEfficiencyPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [efficiencyData, setEfficiencyData] = useState<EfficiencyData | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string>('');

  const [documentType, setDocumentType] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()]);

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
      setLastLoadedAt(formatDateTime(new Date(), 'YYYY-MM-DD HH:mm:ss'));
    } catch (error: any) {
      messageApi.error(error.message || '加载效率分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEfficiencyData();
  }, [documentType, dateRange]);

  const nodeStatsConfig = efficiencyData?.node_statistics
    ? {
        data: efficiencyData.node_statistics.map((node) => ({
          node: node.node_name,
          avg_hours: node.avg_hours,
        })),
        xField: 'node',
        yField: 'avg_hours',
        label: {
          position: 'top' as const,
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

  const bottleneckColumns = [
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
  ];

  const nodeDetailColumns = [
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
  ];

  return (
    <ListPageTemplate>
      <Spin spinning={loading}>
        <DetailDrawerSection title="查询条件">
          <Space wrap>
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
        </DetailDrawerSection>

        {efficiencyData && (
          <>
            <DetailDrawerSection title="基本信息">
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="单据类型">{docTypeLabel(documentType)}</Descriptions.Item>
                <Descriptions.Item label="时间范围">
                  {dateRange[0].format('YYYY-MM-DD')} ~ {dateRange[1].format('YYYY-MM-DD')}
                </Descriptions.Item>
              </Descriptions>
              <Divider style={{ margin: '16px 0' }} />
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Statistic
                    title="平均耗时"
                    value={efficiencyData.average_duration_hours || 0}
                    suffix="小时"
                    styles={{ content: {color: 'var(--ant-color-primary)' } }}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="瓶颈节点数"
                    value={efficiencyData.bottleneck_nodes?.length || 0}
                    suffix="个"
                    styles={{ content: {color: 'var(--ant-color-error)' } }}
                  />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title="优化建议数"
                    value={efficiencyData.optimization_suggestions?.length || 0}
                    suffix="条"
                    styles={{ content: {color: 'var(--ant-color-warning)' } }}
                  />
                </Col>
              </Row>
            </DetailDrawerSection>

            <DetailDrawerSection title="生命周期">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                本页为分析型统计视图，无单据生命周期与上下游关联；筛选条件变更将自动刷新数据。
              </Typography.Paragraph>
            </DetailDrawerSection>

            <DetailDrawerSection title="明细信息">
              {efficiencyData.bottleneck_nodes && efficiencyData.bottleneck_nodes.length > 0 && (
                <>
                  <Typography.Title level={5} style={{ marginTop: 0 }}>
                    瓶颈节点分析
                  </Typography.Title>
                  <div style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 16 }}>
                    <Table
                      size="small"
                      columns={bottleneckColumns}
                      dataSource={efficiencyData.bottleneck_nodes}
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                    />
                  </div>
                </>
              )}

              {efficiencyData.optimization_suggestions && efficiencyData.optimization_suggestions.length > 0 && (
                <>
                  <Typography.Title level={5}>优化建议</Typography.Title>
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
                </>
              )}

              {nodeStatsConfig && (
                <>
                  <Typography.Title level={5}>节点耗时统计</Typography.Title>
                  <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                    <Column {...nodeStatsConfig} height={300} />
                  </div>
                </>
              )}

              {efficiencyData.node_statistics && efficiencyData.node_statistics.length > 0 && (
                <>
                  <Typography.Title level={5} style={{ marginTop: nodeStatsConfig ? 16 : 0 }}>
                    节点详细统计
                  </Typography.Title>
                  <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                    <Table
                      size="small"
                      columns={nodeDetailColumns}
                      dataSource={efficiencyData.node_statistics}
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                    />
                  </div>
                </>
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title="操作记录" marginBottom={0}>
              <Timeline
                items={[
                  {
                    color: 'blue',
                    children: <>数据刷新 · {lastLoadedAt || '-'}</>,
                  },
                ]}
              />
            </DetailDrawerSection>
          </>
        )}
      </Spin>
    </ListPageTemplate>
  );
};

export default DocumentEfficiencyPage;
