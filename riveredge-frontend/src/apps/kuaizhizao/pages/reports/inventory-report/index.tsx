/**
 * 库存报表页面
 *
 * 提供库存查询、库存周转率分析等功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, Row, Col, Statistic, Table, Select, DatePicker, Space, Tag } from 'antd';
import { DownloadOutlined, BarChartOutlined, LineChartOutlined, PieChartOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { Line, Bar, Pie } from '@ant-design/charts';
import { ListPageTemplate, StatCard } from '../../../../../components/layout-templates/ListPageTemplate';

// 库存报表接口定义
interface InventoryReportItem {
  material_code?: string;
  material_name?: string;
  category?: string;
  warehouse_name?: string;
  current_stock?: number;
  available_stock?: number;
  reserved_stock?: number;
  min_stock?: number;
  max_stock?: number;
  unit?: string;
  unit_price?: number;
  total_value?: number;
  turnover_rate?: number;
  turnover_days?: number;
  last_inbound_date?: string;
  last_outbound_date?: string;
  status?: 'normal' | 'low' | 'high' | 'out_of_stock';
}

interface InventoryTurnoverData {
  month: string;
  inbound: number;
  outbound: number;
  turnoverRate: number;
}

const InventoryReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 报表参数状态
  const [reportType, setReportType] = useState<'summary' | 'turnover' | 'analysis'>('summary');
  const [dateRange, setDateRange] = useState<[string, string]>(['2025-01-01', '2025-12-31']);

  // 统计数据状态
  const [stats, setStats] = useState({
    totalItems: 245,
    totalValue: 1256800,
    lowStockItems: 12,
    outOfStockItems: 3,
    highStockItems: 8,
    normalStockItems: 222,
  });

  // 图表数据状态
  const [turnoverData, setTurnoverData] = useState<InventoryTurnoverData[]>([
    { month: '01月', inbound: 1200, outbound: 1100, turnoverRate: 4.2 },
    { month: '02月', inbound: 1350, outbound: 1250, turnoverRate: 4.8 },
    { month: '03月', inbound: 1180, outbound: 1300, turnoverRate: 3.9 },
    { month: '04月', inbound: 1420, outbound: 1380, turnoverRate: 5.1 },
    { month: '05月', inbound: 1280, outbound: 1200, turnoverRate: 4.5 },
    { month: '06月', inbound: 1500, outbound: 1450, turnoverRate: 5.8 },
  ]);

  // 库存分布数据
  const [stockDistribution, setStockDistribution] = useState([
    { type: '正常库存', value: 222, percentage: 90.6 },
    { type: '库存不足', value: 12, percentage: 4.9 },
    { type: '库存过高', value: 8, percentage: 3.3 },
    { type: '缺货', value: 3, percentage: 1.2 },
  ]);

  // 表格列定义
  const columns: ProColumns<InventoryReportItem>[] = [
    {
      title: '物料编码',
      dataIndex: 'material_code',
      width: 120,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '物料名称',
      dataIndex: 'material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
    },
    {
      title: '当前库存',
      dataIndex: 'current_stock',
      width: 100,
      align: 'right',
      render: (text, record) => (
        <span style={{
          color: record.status === 'low' ? '#faad14' :
                 record.status === 'high' ? '#1890ff' :
                 record.status === 'out_of_stock' ? '#f5222d' : '#52c41a'
        }}>
          {text} {record.unit}
        </span>
      ),
    },
    {
      title: '可用库存',
      dataIndex: 'available_stock',
      width: 100,
      align: 'right',
    },
    {
      title: '预留库存',
      dataIndex: 'reserved_stock',
      width: 100,
      align: 'right',
    },
    {
      title: '最低库存',
      dataIndex: 'minStock',
      width: 100,
      align: 'right',
    },
    {
      title: '最高库存',
      dataIndex: 'maxStock',
      width: 100,
      align: 'right',
    },
    {
      title: '库存状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          normal: { text: '正常', color: 'success' },
          low: { text: '库存不足', color: 'warning' },
          high: { text: '库存过高', color: 'processing' },
          out_of_stock: { text: '缺货', color: 'error' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap.normal;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '周转率',
      dataIndex: 'turnoverRate',
      width: 80,
      align: 'right',
      render: (rate) => `${rate?.toFixed(1) || 0}次`,
    },
    {
      title: '周转天数',
      dataIndex: 'turnoverDays',
      width: 90,
      align: 'right',
      render: (days) => `${days || 0}天`,
    },
    {
      title: '总价值',
      dataIndex: 'totalValue',
      width: 120,
      align: 'right',
      render: (value) => `¥${value?.toLocaleString() || 0}`,
    },
  ];

  // 周转率趋势图配置
  const turnoverConfig = {
    data: turnoverData,
    xField: 'month',
    yField: 'turnoverRate',
    seriesField: 'type',
    smooth: true,
    point: {
      size: 5,
      shape: 'diamond',
    },
    tooltip: {
      formatter: (data: any) => ({
        name: '周转率',
        value: `${data.turnoverRate}次`,
      }),
    },
  };

  // 库存分布饼图配置
  const pieConfig = {
    data: stockDistribution,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
    tooltip: {
      formatter: (data: any) => ({
        name: data.type,
        value: `${data.value}项 (${data.percentage}%)`,
      }),
    },
    interactions: [
      {
        type: 'element-active',
      },
    ],
  };

  // 处理导出
  const handleExport = () => {
    messageApi.success('报表导出功能开发中...');
  };

  // 处理报表类型切换
  const handleReportTypeChange = (type: 'summary' | 'turnover' | 'analysis') => {
    setReportType(type);
  };

  // 统计卡片数据
  const statCards: StatCard[] = [
    {
      title: '总物料品种',
      value: stats.totalItems,
      prefix: <BarChartOutlined />,
      valueStyle: { color: '#1890ff' },
    },
    {
      title: '库存总价值',
      value: stats.totalValue,
      prefix: '¥',
      valueStyle: { color: '#52c41a' },
    },
    {
      title: '库存不足',
      value: stats.lowStockItems,
      suffix: '项',
      valueStyle: { color: '#faad14' },
    },
    {
      title: '缺货项目',
      value: stats.outOfStockItems,
      suffix: '项',
      valueStyle: { color: '#f5222d' },
    },
  ];

  return (
    <ListPageTemplate statCards={statCards}>

      {/* 报表控制面板 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <span>报表类型：</span>
          <Select value={reportType} onChange={handleReportTypeChange} style={{ width: 120 }}>
            <Select.Option value="summary">库存汇总</Select.Option>
            <Select.Option value="turnover">周转分析</Select.Option>
            <Select.Option value="analysis">库存分析</Select.Option>
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
      {reportType === 'summary' && (
        <UniTable<InventoryReportItem>
          headerTitle="库存汇总报表"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据
            const mockData: InventoryReportItem[] = [
              {
                id: 1,
                materialCode: 'RAW001',
                materialName: '螺丝A',
                category: '原材料',
                warehouseName: '原材料仓库',
                currentStock: 1500,
                availableStock: 1400,
                reservedStock: 100,
                minStock: 200,
                maxStock: 3000,
                unit: '个',
                unitPrice: 2.5,
                totalValue: 3750,
                turnoverRate: 4.2,
                turnoverDays: 25,
                lastInboundDate: '2025-12-20',
                lastOutboundDate: '2025-12-28',
                status: 'normal',
              },
              {
                id: 2,
                materialCode: 'RAW002',
                materialName: '螺母B',
                category: '原材料',
                warehouseName: '原材料仓库',
                currentStock: 50,
                availableStock: 50,
                reservedStock: 0,
                minStock: 100,
                maxStock: 2000,
                unit: '个',
                unitPrice: 1.8,
                totalValue: 90,
                turnoverRate: 2.1,
                turnoverDays: 48,
                lastInboundDate: '2025-12-15',
                lastOutboundDate: '2025-12-25',
                status: 'low',
              },
              {
                id: 3,
                materialCode: 'FIN001',
                materialName: '产品A',
                category: '成品',
                warehouseName: '成品仓库',
                currentStock: 0,
                availableStock: 0,
                reservedStock: 0,
                minStock: 10,
                maxStock: 500,
                unit: '个',
                unitPrice: 150,
                totalValue: 0,
                turnoverRate: 0,
                turnoverDays: 0,
                lastInboundDate: '2025-12-10',
                lastOutboundDate: '2025-12-28',
                status: 'out_of_stock',
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

      {reportType === 'turnover' && (
        <div>
          <Row gutter={16}>
            <Col span={24}>
              <Card title="库存周转率趋势" style={{ marginBottom: 16 }}>
                <Line {...turnoverConfig} />
              </Card>
            </Col>
          </Row>

          <Card title="周转率详细数据">
            <Table
              size="small"
              columns={[
                { title: '月份', dataIndex: 'month', width: 80 },
                { title: '入库数量', dataIndex: 'inbound', align: 'right' as const },
                { title: '出库数量', dataIndex: 'outbound', align: 'right' as const },
                {
                  title: '周转率',
                  dataIndex: 'turnoverRate',
                  align: 'right' as const,
                  render: (rate: number) => `${rate}次`
                },
              ]}
              dataSource={turnoverData}
              pagination={false}
            />
          </Card>
        </div>
      )}

      {reportType === 'analysis' && (
        <Row gutter={16}>
          <Col span={12}>
            <Card title="库存状态分布">
              <Pie {...pieConfig} />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="库存预警分析">
              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <Tag color="success">正常库存: {stats.normalStockItems}项 ({((stats.normalStockItems / stats.totalItems) * 100).toFixed(1)}%)</Tag>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <Tag color="warning">库存不足: {stats.lowStockItems}项 ({((stats.lowStockItems / stats.totalItems) * 100).toFixed(1)}%)</Tag>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <Tag color="processing">库存过高: {stats.highStockItems}项 ({((stats.highStockItems / stats.totalItems) * 100).toFixed(1)}%)</Tag>
                </div>
                <div>
                  <Tag color="error">缺货项目: {stats.outOfStockItems}项 ({((stats.outOfStockItems / stats.totalItems) * 100).toFixed(1)}%)</Tag>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}
    </ListPageTemplate>
  );
};

export default InventoryReportPage;
