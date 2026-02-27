/**
 * 库存报表页面
 *
 * 提供库存查询、库存周转率分析等功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, Row, Col, Statistic, Table, Select, DatePicker, Space, Tag } from 'antd';
import { DownloadOutlined, BarChartOutlined, LineChartOutlined, PieChartOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { Line, Bar, Pie, Column } from '@ant-design/charts';
import { ListPageTemplate, StatCard } from '../../../../../components/layout-templates/ListPageTemplate';
import { inventoryAnalysisApi, InventoryAnalysisData, InventoryCostAnalysisData, getInventoryReport, getInventoryStatistics, exportReport } from '../../../services/reports';
import dayjs, { Dayjs } from 'dayjs';

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
  const [loading, setLoading] = useState(false);

  // 报表参数状态
  const [reportType, setReportType] = useState<'summary' | 'turnover' | 'analysis'>('summary');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);

  // 分析数据状态
  const [analysisData, setAnalysisData] = useState<InventoryAnalysisData | null>(null);
  const [costAnalysisData, setCostAnalysisData] = useState<InventoryCostAnalysisData | null>(null);

  const { data: statistics } = useQuery({
    queryKey: ['inventoryStatistics', warehouseId],
    queryFn: () => getInventoryStatistics(warehouseId),
  });

  const stats = {
    totalItems: statistics?.total_items ?? 0,
    totalValue: statistics?.total_value ?? 0,
    lowStockItems: statistics?.low_stock_items ?? 0,
    outOfStockItems: statistics?.out_of_stock_items ?? 0,
    highStockItems: statistics?.high_stock_items ?? 0,
    normalStockItems: statistics?.normal_stock_items ?? 0,
  };

  // 图表数据状态
  const [turnoverData, setTurnoverData] = useState<InventoryTurnoverData[]>([
    { month: '01月', inbound: 1200, outbound: 1100, turnoverRate: 4.2 },
    { month: '02月', inbound: 1350, outbound: 1250, turnoverRate: 4.8 },
    { month: '03月', inbound: 1180, outbound: 1300, turnoverRate: 3.9 },
    { month: '04月', inbound: 1420, outbound: 1380, turnoverRate: 5.1 },
    { month: '05月', inbound: 1280, outbound: 1200, turnoverRate: 4.5 },
    { month: '06月', inbound: 1500, outbound: 1450, turnoverRate: 5.8 },
  ]);

  // 库存分布数据（由统计接口派生）
  const stockDistribution = useMemo(() => {
    const total = stats.normalStockItems + stats.lowStockItems + stats.highStockItems + stats.outOfStockItems;
    if (total === 0) {
      return [
        { type: '正常库存', value: 0, percentage: 0 },
        { type: '库存不足', value: 0, percentage: 0 },
        { type: '库存过高', value: 0, percentage: 0 },
        { type: '缺货', value: 0, percentage: 0 },
      ];
    }
    return [
      { type: '正常库存', value: stats.normalStockItems, percentage: Math.round((stats.normalStockItems / total) * 1000) / 10 },
      { type: '库存不足', value: stats.lowStockItems, percentage: Math.round((stats.lowStockItems / total) * 1000) / 10 },
      { type: '库存过高', value: stats.highStockItems, percentage: Math.round((stats.highStockItems / total) * 1000) / 10 },
      { type: '缺货', value: stats.outOfStockItems, percentage: Math.round((stats.outOfStockItems / total) * 1000) / 10 },
    ];
  }, [stats.normalStockItems, stats.lowStockItems, stats.highStockItems, stats.outOfStockItems]);

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
  const handleExport = async () => {
    try {
      setLoading(true);
      await exportReport('inventory', {
        report_type: reportType,
        date_start: dateRange[0]?.format('YYYY-MM-DD'),
        date_end: dateRange[1]?.format('YYYY-MM-DD'),
        filters: {
          warehouse_id: warehouseId,
        },
      });
      messageApi.success('报表导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '报表导出失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载分析数据
   */
  const loadAnalysisData = async () => {
    try {
      setLoading(true);
      const [analysis, costAnalysis] = await Promise.all([
        inventoryAnalysisApi.getAnalysis({
          date_start: dateRange[0].format('YYYY-MM-DD'),
          date_end: dateRange[1].format('YYYY-MM-DD'),
          warehouse_id: warehouseId,
        }),
        inventoryAnalysisApi.getCostAnalysis({
          date_start: dateRange[0].format('YYYY-MM-DD'),
          date_end: dateRange[1].format('YYYY-MM-DD'),
          warehouse_id: warehouseId,
        }),
      ]);
      setAnalysisData(analysis);
      setCostAnalysisData(costAnalysis);
    } catch (error: any) {
      messageApi.error(error.message || '加载分析数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (reportType === 'analysis' || reportType === 'turnover') {
      loadAnalysisData();
    }
  }, [reportType, dateRange, warehouseId]);

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
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([
                  dayjs(dates[0]),
                  dayjs(dates[1])
                ]);
              } else if (dates === null) {
                // 清空时重置为默认值
                setDateRange([
                  dayjs().subtract(30, 'day'),
                  dayjs(),
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
            try {
              setLoading(true);
              const response = await getInventoryReport({
                report_type: 'summary',
                date_start: dateRange[0]?.format('YYYY-MM-DD'),
                date_end: dateRange[1]?.format('YYYY-MM-DD'),
                filters: {
                  warehouse_id: warehouseId,
                },
                ...params,
              });

              // 转换数据格式
              const data = (response.data || []).map((item, index) => ({
                id: index + 1,
                ...item,
                material_code: item.materialCode,
                material_name: item.materialName,
                warehouse_name: item.warehouseName,
                current_stock: item.currentStock,
                available_stock: item.availableStock,
                reserved_stock: item.reservedStock,
                min_stock: item.minStock,
                max_stock: item.maxStock,
                unit_price: item.unitPrice,
                total_value: item.totalValue,
                turnover_rate: item.turnoverRate,
                turnover_days: item.turnoverDays,
              }));

              return {
                data,
                success: true,
                total: response.summary?.totalItems || data.length,
              };
            } catch (error: any) {
              messageApi.error(error.message || '加载库存报表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            } finally {
              setLoading(false);
            }
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
        <div>
          <Row gutter={16} style={{ marginBottom: 16 }}>
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

          {/* ABC分析 */}
          {analysisData?.abc_analysis && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Card title="A类物料">
                  <Statistic
                    title="数量"
                    value={analysisData.abc_analysis.category_a?.count || 0}
                    suffix="项"
                  />
                  <Statistic
                    title="价值"
                    value={analysisData.abc_analysis.category_a?.value || 0}
                    prefix="¥"
                    style={{ marginTop: 16 }}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Tag color="red">占比: {analysisData.abc_analysis.category_a?.value_percentage || 0}%</Tag>
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card title="B类物料">
                  <Statistic
                    title="数量"
                    value={analysisData.abc_analysis.category_b?.count || 0}
                    suffix="项"
                  />
                  <Statistic
                    title="价值"
                    value={analysisData.abc_analysis.category_b?.value || 0}
                    prefix="¥"
                    style={{ marginTop: 16 }}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Tag color="orange">占比: {analysisData.abc_analysis.category_b?.value_percentage || 0}%</Tag>
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card title="C类物料">
                  <Statistic
                    title="数量"
                    value={analysisData.abc_analysis.category_c?.count || 0}
                    suffix="项"
                  />
                  <Statistic
                    title="价值"
                    value={analysisData.abc_analysis.category_c?.value || 0}
                    prefix="¥"
                    style={{ marginTop: 16 }}
                  />
                  <div style={{ marginTop: 16 }}>
                    <Tag color="blue">占比: {analysisData.abc_analysis.category_c?.value_percentage || 0}%</Tag>
                  </div>
                </Card>
              </Col>
            </Row>
          )}

          {/* 呆滞料分析 */}
          {analysisData?.slow_moving_analysis && (
            <Card title="呆滞料分析">
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Statistic
                    title="呆滞料总数"
                    value={analysisData.slow_moving_analysis.total_count || 0}
                    suffix="项"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="呆滞料总价值"
                    value={analysisData.slow_moving_analysis.total_value || 0}
                    prefix="¥"
                  />
                </Col>
              </Row>
              {analysisData.slow_moving_analysis.materials && analysisData.slow_moving_analysis.materials.length > 0 && (
                <Table
                  size="small"
                  columns={[
                    { title: '物料编码', dataIndex: 'material_code', width: 120 },
                    { title: '物料名称', dataIndex: 'material_name', width: 150 },
                    {
                      title: '库存数量',
                      dataIndex: 'inventory_quantity',
                      align: 'right' as const,
                    },
                    {
                      title: '库存价值',
                      dataIndex: 'inventory_value',
                      align: 'right' as const,
                      render: (value: number) => `¥${value.toLocaleString()}`
                    },
                    {
                      title: '最后出库日期',
                      dataIndex: 'last_outbound_date',
                      width: 120,
                    },
                    {
                      title: '呆滞天数',
                      dataIndex: 'days_since_last_outbound',
                      align: 'right' as const,
                      render: (days: number) => `${days}天`
                    },
                  ]}
                  dataSource={analysisData.slow_moving_analysis.materials}
                  pagination={false}
                />
              )}
            </Card>
          )}

          {/* 库存成本分析 */}
          {costAnalysisData && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={12}>
                <Card title="库存成本概览">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Statistic
                        title="总库存成本"
                        value={costAnalysisData.summary?.total_cost || 0}
                        prefix="¥"
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Col>
                    <Col span={12}>
                      <Statistic
                        title="平均库存成本"
                        value={costAnalysisData.summary?.average_cost || 0}
                        prefix="¥"
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Col>
                  </Row>
                  <div style={{ marginTop: 16 }}>
                    <Tag color={costAnalysisData.summary?.cost_trend === 'increasing' ? 'red' : costAnalysisData.summary?.cost_trend === 'decreasing' ? 'green' : 'default'}>
                      成本趋势: {costAnalysisData.summary?.cost_trend === 'increasing' ? '上升' : costAnalysisData.summary?.cost_trend === 'decreasing' ? '下降' : '稳定'}
                    </Tag>
                  </div>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="按类别成本分布">
                  {costAnalysisData.by_category && costAnalysisData.by_category.length > 0 && (
                    <Pie
                      data={costAnalysisData.by_category.map(item => ({
                        type: item.category,
                        value: item.cost,
                      }))}
                      angleField="value"
                      colorField="type"
                      radius={0.8}
                      label={{
                        type: 'outer',
                        content: '{name} {percentage}',
                      }}
                    />
                  )}
                </Card>
              </Col>
            </Row>
          )}

          {/* 成本趋势图 */}
          {costAnalysisData?.trend_data && costAnalysisData.trend_data.length > 0 && (
            <Card title="库存成本趋势" style={{ marginTop: 16 }}>
              <Line
                data={costAnalysisData.trend_data}
                xField="date"
                yField="cost"
                smooth={true}
                point={{
                  size: 5,
                  shape: 'diamond',
                }}
                tooltip={{
                  formatter: (data: any) => ({
                    name: '库存成本',
                    value: `¥${data.cost.toLocaleString()}`,
                  }),
                }}
              />
            </Card>
          )}
        </div>
      )}
    </ListPageTemplate>
  );
};

export default InventoryReportPage;
