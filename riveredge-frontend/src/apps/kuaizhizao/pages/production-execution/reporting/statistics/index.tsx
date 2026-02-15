/**
 * 报工统计分析页面
 *
 * 提供报工数据统计分析功能，包括效率分析、工时统计、异常分析等。
 *
 * @author Luigi Lu
 * @date 2025-01-04
 */

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Button, Space, Table, Tag } from 'antd';
import { Line, Bar, Column } from '@ant-design/charts';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { reportingApi } from '../../../../services/production';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface ReportingStatistics {
  total_count: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  total_reported_quantity: number;
  total_qualified_quantity: number;
  total_unqualified_quantity: number;
  total_work_hours: number;
  qualification_rate: number;
  unqualified_rate: number;
  avg_quantity_per_hour: number;
  operation_stats: Array<{
    operation_name: string;
    count: number;
    reported_quantity: number;
    qualified_quantity: number;
    work_hours: number;
    qualification_rate: number;
  }>;
  worker_stats: Array<{
    worker_name: string;
    count: number;
    reported_quantity: number;
    qualified_quantity: number;
    work_hours: number;
    qualification_rate: number;
  }>;
}

const ReportingStatisticsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [statistics, setStatistics] = useState<ReportingStatistics | null>(null);

  /**
   * 加载统计数据
   */
  const loadStatistics = async () => {
    try {
      setLoading(true);
      const [startDate, endDate] = dateRange;
      const result = await reportingApi.getStatistics({
        date_start: startDate.format('YYYY-MM-DD'),
        date_end: endDate.format('YYYY-MM-DD'),
      });
      setStatistics(result as any);
    } catch (error: any) {
      messageApi.error(error.message || '加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  /**
   * 处理日期范围变化
   */
  const handleDateRangeChange = (dates: [Dayjs, Dayjs] | null) => {
    if (dates) {
      setDateRange(dates);
    }
  };

  /**
   * 处理刷新
   */
  const handleRefresh = () => {
    loadStatistics();
  };

  /**
   * 处理导出
   */
  const handleExport = () => {
    messageApi.info('导出功能开发中');
  };

  // 工序统计表格列
  const operationColumns = [
    {
      title: '工序名称',
      dataIndex: 'operation_name',
      key: 'operation_name',
    },
    {
      title: '报工次数',
      dataIndex: 'count',
      key: 'count',
      align: 'right' as const,
    },
    {
      title: '报工数量',
      dataIndex: 'reported_quantity',
      key: 'reported_quantity',
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      key: 'qualified_quantity',
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '工时（小时）',
      dataIndex: 'work_hours',
      key: 'work_hours',
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '合格率',
      dataIndex: 'qualification_rate',
      key: 'qualification_rate',
      align: 'right' as const,
      render: (value: number) => (
        <Tag color={value >= 95 ? 'green' : value >= 90 ? 'orange' : 'red'}>
          {value.toFixed(2)}%
        </Tag>
      ),
    },
  ];

  // 操作工统计表格列
  const workerColumns = [
    {
      title: '操作工姓名',
      dataIndex: 'worker_name',
      key: 'worker_name',
    },
    {
      title: '报工次数',
      dataIndex: 'count',
      key: 'count',
      align: 'right' as const,
    },
    {
      title: '报工数量',
      dataIndex: 'reported_quantity',
      key: 'reported_quantity',
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      key: 'qualified_quantity',
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '工时（小时）',
      dataIndex: 'work_hours',
      key: 'work_hours',
      align: 'right' as const,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: '合格率',
      dataIndex: 'qualification_rate',
      key: 'qualification_rate',
      align: 'right' as const,
      render: (value: number) => (
        <Tag color={value >= 95 ? 'green' : value >= 90 ? 'orange' : 'red'}>
          {value.toFixed(2)}%
        </Tag>
      ),
    },
  ];

  return (
    <div>
      {/* 筛选条件 */}
      <Card style={{ marginBottom: 12 }}>
        <Space>
          <span>日期范围：</span>
          <RangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            format="YYYY-MM-DD"
          />
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            查询
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出
          </Button>
        </Space>
      </Card>

      {/* 统计概览 */}
      {statistics && (
        <>
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总报工次数"
                  value={statistics.total_count}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总报工数量"
                  value={statistics.total_reported_quantity}
                  precision={2}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="合格率"
                  value={statistics.qualification_rate}
                  precision={2}
                  suffix="%"
                  valueStyle={{
                    color: statistics.qualification_rate >= 95 ? '#52c41a' : statistics.qualification_rate >= 90 ? '#faad14' : '#ff4d4f',
                  }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总工时（小时）"
                  value={statistics.total_work_hours}
                  precision={2}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="待审核"
                  value={statistics.pending_count}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已审核"
                  value={statistics.approved_count}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="平均效率（件/小时）"
                  value={statistics.avg_quantity_per_hour}
                  precision={2}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="不合格率"
                  value={statistics.unqualified_rate}
                  precision={2}
                  suffix="%"
                  valueStyle={{
                    color: statistics.unqualified_rate <= 5 ? '#52c41a' : statistics.unqualified_rate <= 10 ? '#faad14' : '#ff4d4f',
                  }}
                />
              </Card>
            </Col>
          </Row>

          {/* 图表展示 */}
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Card title="按工序统计（Top 10）">
                <Bar
                  data={statistics.operation_stats}
                  xField="operation_name"
                  yField="reported_quantity"
                  height={300}
                  label={{
                    position: 'middle',
                    style: { fill: '#FFFFFF', opacity: 0.6 },
                  }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="按操作工统计（Top 10）">
                <Bar
                  data={statistics.worker_stats}
                  xField="worker_name"
                  yField="reported_quantity"
                  height={300}
                  label={{
                    position: 'middle',
                    style: { fill: '#FFFFFF', opacity: 0.6 },
                  }}
                />
              </Card>
            </Col>
          </Row>

          {/* 按工序统计表格 */}
          <Card title="按工序统计详情（Top 10）" style={{ marginBottom: 12 }}>
            <Table
              columns={operationColumns}
              dataSource={statistics.operation_stats}
              rowKey="operation_name"
              pagination={false}
              size="small"
            />
          </Card>

          {/* 按操作工统计表格 */}
          <Card title="按操作工统计详情（Top 10）">
            <Table
              columns={workerColumns}
              dataSource={statistics.worker_stats}
              rowKey="worker_name"
              pagination={false}
              size="small"
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default ReportingStatisticsPage;

