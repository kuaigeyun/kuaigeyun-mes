/**
 * 生产报表页面
 *
 * 提供工单绩效分析、生产效率分析等功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, Row, Col, Statistic, Table, Select, DatePicker, Space, Tag, Progress } from 'antd';
import { DownloadOutlined, BarChartOutlined, LineChartOutlined, PieChartOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { Line, Bar, Column } from '@ant-design/charts';

// 生产报表接口定义
interface ProductionReportItem {
  id: number;
  workOrderCode: string;
  productName: string;
  plannedQuantity: number;
  actualQuantity: number;
  qualifiedQuantity: number;
  defectiveQuantity: number;
  completionRate: number;
  qualifiedRate: number;
  plannedStartDate: string;
  actualStartDate?: string;
  plannedEndDate: string;
  actualEndDate?: string;
  plannedDuration: number; // 计划工时(小时)
  actualDuration: number; // 实际工时(小时)
  efficiency: number; // 生产效率(%)
  status: 'completed' | 'in_progress' | 'delayed' | 'cancelled';
  delayDays: number;
}

interface ProductionEfficiencyData {
  month: string;
  plannedOutput: number;
  actualOutput: number;
  efficiency: number;
}

const ProductionReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 报表参数状态
  const [reportType, setReportType] = useState<'performance' | 'efficiency' | 'analysis'>('performance');
  const [dateRange, setDateRange] = useState<[string, string]>(['2025-01-01', '2025-12-31']);

  // 统计数据状态
  const [stats, setStats] = useState({
    totalWorkOrders: 156,
    completedWorkOrders: 142,
    onTimeCompletion: 128,
    averageEfficiency: 92.5,
    averageQualifiedRate: 98.2,
    totalDelayDays: 45,
  });

  // 图表数据状态
  const [efficiencyData, setEfficiencyData] = useState<ProductionEfficiencyData[]>([
    { month: '01月', plannedOutput: 1200, actualOutput: 1150, efficiency: 95.8 },
    { month: '02月', plannedOutput: 1350, actualOutput: 1280, efficiency: 94.8 },
    { month: '03月', plannedOutput: 1180, actualOutput: 1220, efficiency: 103.4 },
    { month: '04月', plannedOutput: 1420, actualOutput: 1380, efficiency: 97.2 },
    { month: '05月', plannedOutput: 1280, actualOutput: 1240, efficiency: 96.9 },
    { month: '06月', plannedOutput: 1500, actualOutput: 1480, efficiency: 98.7 },
  ]);

  // 工单状态分布
  const [workOrderStatus, setWorkOrderStatus] = useState([
    { status: '已完成', count: 142, percentage: 91.0, color: '#52c41a' },
    { status: '进行中', count: 12, percentage: 7.7, color: '#1890ff' },
    { status: '延期', count: 2, percentage: 1.3, color: '#faad14' },
  ]);

  // 表格列定义
  const columns: ProColumns<ProductionReportItem>[] = [
    {
      title: '工单编号',
      dataIndex: 'workOrderCode',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '计划数量',
      dataIndex: 'plannedQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '实际数量',
      dataIndex: 'actualQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '合格数量',
      dataIndex: 'qualifiedQuantity',
      width: 100,
      align: 'right',
    },
    {
      title: '不合格数量',
      dataIndex: 'defectiveQuantity',
      width: 100,
      align: 'right',
      render: (text) => <span style={{ color: text > 0 ? '#f5222d' : '#52c41a' }}>{text}</span>,
    },
    {
      title: '完成率',
      dataIndex: 'completionRate',
      width: 100,
      align: 'center',
      render: (rate) => (
        <Progress
          type="circle"
          percent={rate}
          width={40}
          strokeColor={rate >= 100 ? '#52c41a' : rate >= 80 ? '#1890ff' : '#faad14'}
        />
      ),
    },
    {
      title: '合格率',
      dataIndex: 'qualifiedRate',
      width: 100,
      align: 'center',
      render: (rate) => (
        <span style={{ color: rate >= 95 ? '#52c41a' : rate >= 90 ? '#faad14' : '#f5222d' }}>
          {rate}%
        </span>
      ),
    },
    {
      title: '计划工时',
      dataIndex: 'plannedDuration',
      width: 100,
      align: 'right',
      render: (hours) => `${hours}小时`,
    },
    {
      title: '实际工时',
      dataIndex: 'actualDuration',
      width: 100,
      align: 'right',
      render: (hours) => `${hours}小时`,
    },
    {
      title: '生产效率',
      dataIndex: 'efficiency',
      width: 100,
      align: 'center',
      render: (efficiency) => (
        <span style={{ color: efficiency >= 95 ? '#52c41a' : efficiency >= 85 ? '#faad14' : '#f5222d' }}>
          {efficiency}%
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          completed: { text: '已完成', color: 'success' },
          in_progress: { text: '进行中', color: 'processing' },
          delayed: { text: '延期', color: 'warning' },
          cancelled: { text: '已取消', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap.completed;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '延期天数',
      dataIndex: 'delayDays',
      width: 100,
      align: 'right',
      render: (days) => (
        <span style={{ color: days > 0 ? '#f5222d' : '#52c41a' }}>
          {days > 0 ? `${days}天` : '-'}
        </span>
      ),
    },
  ];

  // 生产效率趋势图配置
  const efficiencyConfig = {
    data: efficiencyData,
    xField: 'month',
    yField: 'efficiency',
    seriesField: 'type',
    smooth: true,
    point: {
      size: 5,
      shape: 'diamond',
    },
    tooltip: {
      formatter: (data: any) => ({
        name: '生产效率',
        value: `${data.efficiency}%`,
      }),
    },
  };

  // 产量对比柱状图配置
  const outputConfig = {
    data: efficiencyData.flatMap(item => [
      { month: item.month, type: '计划产量', value: item.plannedOutput },
      { month: item.month, type: '实际产量', value: item.actualOutput },
    ]),
    xField: 'month',
    yField: 'value',
    seriesField: 'type',
    isGroup: true,
    columnStyle: {
      radius: [4, 4, 0, 0],
    },
    tooltip: {
      formatter: (data: any) => ({
        name: data.type,
        value: data.value,
      }),
    },
  };

  // 处理导出
  const handleExport = () => {
    messageApi.success('报表导出功能开发中...');
  };

  // 处理报表类型切换
  const handleReportTypeChange = (type: 'performance' | 'efficiency' | 'analysis') => {
    setReportType(type);
  };

  return (
    <div>
      {/* 统计卡片 */}
      <div style={{ padding: '16px 16px 0 16px' }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Card>
              <Statistic
                title="总工单数"
                value={stats.totalWorkOrders}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="已完成"
                value={stats.completedWorkOrders}
                suffix={`/ ${stats.totalWorkOrders}`}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="准时完成"
                value={stats.onTimeCompletion}
                suffix={`/ ${stats.completedWorkOrders}`}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="平均效率"
                value={stats.averageEfficiency}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="平均合格率"
                value={stats.averageQualifiedRate}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="总延期天数"
                value={stats.totalDelayDays}
                suffix="天"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* 报表控制面板 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>报表类型：</span>
          <Select value={reportType} onChange={handleReportTypeChange} style={{ width: 120 }}>
            <Select.Option value="performance">工单绩效</Select.Option>
            <Select.Option value="efficiency">生产效率</Select.Option>
            <Select.Option value="analysis">生产分析</Select.Option>
          </Select>

          <span>时间范围：</span>
          <DatePicker.RangePicker
            value={dateRange.map(date => date ? new Date(date) : null) as any}
            onChange={(dates) => {
              if (dates) {
                setDateRange([
                  dates[0]?.format('YYYY-MM-DD') || '',
                  dates[1]?.format('YYYY-MM-DD') || ''
                ]);
              }
            }}
          />

          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出报表
          </Button>
        </Space>
      </Card>

      {/* 报表内容 */}
      {reportType === 'performance' && (
        <UniTable<ProductionReportItem>
          headerTitle="工单绩效分析报表"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据
            const mockData: ProductionReportItem[] = [
              {
                id: 1,
                workOrderCode: 'WO20241201001',
                productName: '产品A',
                plannedQuantity: 100,
                actualQuantity: 98,
                qualifiedQuantity: 96,
                defectiveQuantity: 2,
                completionRate: 98,
                qualifiedRate: 98.0,
                plannedStartDate: '2025-12-01',
                actualStartDate: '2025-12-01',
                plannedEndDate: '2025-12-03',
                actualEndDate: '2025-12-03',
                plannedDuration: 24,
                actualDuration: 26,
                efficiency: 92.3,
                status: 'completed',
                delayDays: 0,
              },
              {
                id: 2,
                workOrderCode: 'WO20241201002',
                productName: '产品B',
                plannedQuantity: 50,
                actualQuantity: 52,
                qualifiedQuantity: 51,
                defectiveQuantity: 1,
                completionRate: 104,
                qualifiedRate: 98.1,
                plannedStartDate: '2025-12-02',
                actualStartDate: '2025-12-02',
                plannedEndDate: '2025-12-04',
                actualEndDate: '2025-12-05',
                plannedDuration: 16,
                actualDuration: 18,
                efficiency: 95.8,
                status: 'completed',
                delayDays: 1,
              },
              {
                id: 3,
                workOrderCode: 'WO20241201003',
                productName: '产品C',
                plannedQuantity: 80,
                actualQuantity: 45,
                qualifiedQuantity: 43,
                defectiveQuantity: 2,
                completionRate: 56.3,
                qualifiedRate: 95.6,
                plannedStartDate: '2025-12-03',
                actualStartDate: '2025-12-03',
                plannedEndDate: '2025-12-05',
                actualEndDate: undefined,
                plannedDuration: 20,
                actualDuration: 15,
                efficiency: 88.9,
                status: 'in_progress',
                delayDays: 0,
              },
            ];

            return {
              data: mockData,
              success: true,
              total: mockData.length,
            };
          }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          scroll={{ x: 1400 }}
        />
      )}

      {reportType === 'efficiency' && (
        <div>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="生产效率趋势" style={{ marginBottom: 16 }}>
                <Line {...efficiencyConfig} />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="产量对比分析" style={{ marginBottom: 16 }}>
                <Column {...outputConfig} />
              </Card>
            </Col>
          </Row>

          <Card title="效率详细数据">
            <Table
              size="small"
              columns={[
                { title: '月份', dataIndex: 'month', width: 80 },
                { title: '计划产量', dataIndex: 'plannedOutput', align: 'right' as const },
                { title: '实际产量', dataIndex: 'actualOutput', align: 'right' as const },
                {
                  title: '生产效率',
                  dataIndex: 'efficiency',
                  align: 'right' as const,
                  render: (efficiency: number) => `${efficiency}%`
                },
              ]}
              dataSource={efficiencyData}
              pagination={false}
            />
          </Card>
        </div>
      )}

      {reportType === 'analysis' && (
        <Row gutter={16}>
          <Col span={12}>
            <Card title="工单状态分布">
              <div style={{ padding: '20px' }}>
                {workOrderStatus.map((item, index) => (
                  <div key={index} style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>{item.status}</span>
                      <span>{item.count}单 ({item.percentage}%)</span>
                    </div>
                    <Progress
                      percent={item.percentage}
                      strokeColor={item.color}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="生产KPI指标">
              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>准时交付率</span>
                    <span>{((stats.onTimeCompletion / stats.completedWorkOrders) * 100).toFixed(1)}%</span>
                  </div>
                  <Progress
                    percent={(stats.onTimeCompletion / stats.completedWorkOrders) * 100}
                    strokeColor="#52c41a"
                    showInfo={false}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>生产效率</span>
                    <span>{stats.averageEfficiency}%</span>
                  </div>
                  <Progress
                    percent={stats.averageEfficiency}
                    strokeColor="#1890ff"
                    showInfo={false}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>产品质量合格率</span>
                    <span>{stats.averageQualifiedRate}%</span>
                  </div>
                  <Progress
                    percent={stats.averageQualifiedRate}
                    strokeColor="#52c41a"
                    showInfo={false}
                  />
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default ProductionReportPage;
