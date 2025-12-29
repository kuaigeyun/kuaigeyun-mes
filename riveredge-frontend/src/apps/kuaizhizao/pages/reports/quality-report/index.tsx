/**
 * 质量报表页面
 *
 * 提供质量合格率统计、质量趋势分析等功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, Row, Col, Statistic, Table, Select, DatePicker, Space, Tag, Progress } from 'antd';
import { DownloadOutlined, BarChartOutlined, LineChartOutlined, PieChartOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { Line, Bar, Pie } from '@ant-design/charts';

// 质量报表接口定义
interface QualityReportItem {
  id: number;
  inspectionType: 'incoming' | 'process' | 'finished';
  inspectionCode: string;
  productCode: string;
  productName: string;
  batchNo: string;
  totalQuantity: number;
  qualifiedQuantity: number;
  unqualifiedQuantity: number;
  qualifiedRate: number;
  inspectorName: string;
  inspectionDate: string;
  status: 'qualified' | 'unqualified' | 'conditional';
  defectTypes?: string[];
  remarks?: string;
}

interface QualityTrendData {
  month: string;
  incomingQualified: number;
  processQualified: number;
  finishedQualified: number;
  overallQualified: number;
}

const QualityReportPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 报表参数状态
  const [reportType, setReportType] = useState<'summary' | 'trend' | 'analysis'>('summary');
  const [dateRange, setDateRange] = useState<[string, string]>(['2025-01-01', '2025-12-31']);
  const [inspectionType, setInspectionType] = useState<string>('all');

  // 统计数据状态
  const [stats, setStats] = useState({
    totalInspections: 1250,
    qualifiedInspections: 1180,
    unqualifiedInspections: 70,
    overallQualifiedRate: 94.4,
    incomingQualifiedRate: 96.2,
    processQualifiedRate: 93.8,
    finishedQualifiedRate: 95.1,
  });

  // 图表数据状态
  const [trendData, setTrendData] = useState<QualityTrendData[]>([
    { month: '01月', incomingQualified: 95.5, processQualified: 92.1, finishedQualified: 94.8, overallQualified: 94.1 },
    { month: '02月', incomingQualified: 96.8, processQualified: 94.5, finishedQualified: 95.2, overallQualified: 95.5 },
    { month: '03月', incomingQualified: 95.2, processQualified: 93.2, finishedQualified: 94.9, overallQualified: 94.4 },
    { month: '04月', incomingQualified: 97.1, processQualified: 95.8, finishedQualified: 96.3, overallQualified: 96.4 },
    { month: '05月', incomingQualified: 96.5, processQualified: 94.9, finishedQualified: 95.8, overallQualified: 95.7 },
    { month: '06月', incomingQualified: 97.8, processQualified: 96.2, finishedQualified: 96.9, overallQualified: 97.0 },
  ]);

  // 质量问题分布
  const [defectDistribution, setDefectDistribution] = useState([
    { type: '尺寸偏差', count: 25, percentage: 35.7 },
    { type: '表面缺陷', count: 18, percentage: 25.7 },
    { type: '功能异常', count: 12, percentage: 17.1 },
    { type: '材质问题', count: 10, percentage: 14.3 },
    { type: '其他', count: 5, percentage: 7.1 },
  ]);

  // 表格列定义
  const columns: ProColumns<QualityReportItem>[] = [
    {
      title: '检验类型',
      dataIndex: 'inspectionType',
      width: 100,
      render: (type) => {
        const typeMap = {
          incoming: { text: '来料检验', color: 'blue' },
          process: { text: '过程检验', color: 'green' },
          finished: { text: '成品检验', color: 'purple' },
        };
        const config = typeMap[type as keyof typeof typeMap] || typeMap.incoming;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '检验单号',
      dataIndex: 'inspectionCode',
      width: 140,
      ellipsis: true,
    },
    {
      title: '产品编码',
      dataIndex: 'productCode',
      width: 120,
    },
    {
      title: '产品名称',
      dataIndex: 'productName',
      width: 150,
      ellipsis: true,
    },
    {
      title: '批次号',
      dataIndex: 'batchNo',
      width: 100,
    },
    {
      title: '检验数量',
      dataIndex: 'totalQuantity',
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
      dataIndex: 'unqualifiedQuantity',
      width: 100,
      align: 'right',
      render: (text) => <span style={{ color: text > 0 ? '#f5222d' : '#52c41a' }}>{text}</span>,
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
      title: '检验状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap = {
          qualified: { text: '合格', color: 'success' },
          unqualified: { text: '不合格', color: 'error' },
          conditional: { text: '条件合格', color: 'warning' },
        };
        const config = statusMap[status as keyof typeof statusMap] || statusMap.qualified;
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '检验员',
      dataIndex: 'inspectorName',
      width: 100,
    },
    {
      title: '检验日期',
      dataIndex: 'inspectionDate',
      width: 120,
      valueType: 'date',
    },
    {
      title: '缺陷类型',
      dataIndex: 'defectTypes',
      width: 150,
      render: (types) => (
        types && types.length > 0 ? (
          <div>
            {types.map((type, index) => (
              <Tag key={index} size="small" color="orange" style={{ marginBottom: '2px' }}>
                {type}
              </Tag>
            ))}
          </div>
        ) : (
          <span style={{ color: '#999' }}>无</span>
        )
      ),
    },
  ];

  // 质量趋势图配置
  const trendConfig = {
    data: trendData.flatMap(item => [
      { month: item.month, type: '来料检验', value: item.incomingQualified },
      { month: item.month, type: '过程检验', value: item.processQualified },
      { month: item.month, type: '成品检验', value: item.finishedQualified },
      { month: item.month, type: '总体合格率', value: item.overallQualified },
    ]),
    xField: 'month',
    yField: 'value',
    seriesField: 'type',
    smooth: true,
    point: {
      size: 3,
    },
    tooltip: {
      formatter: (data: any) => ({
        name: data.type,
        value: `${data.value}%`,
      }),
    },
  };

  // 缺陷分布饼图配置
  const defectPieConfig = {
    data: defectDistribution,
    angleField: 'count',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
    tooltip: {
      formatter: (data: any) => ({
        name: data.type,
        value: `${data.count}次 (${data.percentage}%)`,
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
  const handleReportTypeChange = (type: 'summary' | 'trend' | 'analysis') => {
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
                title="总检验数"
                value={stats.totalInspections}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="合格检验"
                value={stats.qualifiedInspections}
                suffix={`/ ${stats.totalInspections}`}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="不合格检验"
                value={stats.unqualifiedInspections}
                suffix={`/ ${stats.totalInspections}`}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="总体合格率"
                value={stats.overallQualifiedRate}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="来料合格率"
                value={stats.incomingQualifiedRate}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="成品合格率"
                value={stats.finishedQualifiedRate}
                suffix="%"
                precision={1}
                valueStyle={{ color: '#52c41a' }}
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
            <Select.Option value="summary">质量汇总</Select.Option>
            <Select.Option value="trend">质量趋势</Select.Option>
            <Select.Option value="analysis">质量分析</Select.Option>
          </Select>

          <span>检验类型：</span>
          <Select value={inspectionType} onChange={setInspectionType} style={{ width: 120 }}>
            <Select.Option value="all">全部</Select.Option>
            <Select.Option value="incoming">来料检验</Select.Option>
            <Select.Option value="process">过程检验</Select.Option>
            <Select.Option value="finished">成品检验</Select.Option>
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
        <UniTable<QualityReportItem>
          headerTitle="质量检验汇总报表"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 模拟数据
            const mockData: QualityReportItem[] = [
              {
                id: 1,
                inspectionType: 'incoming',
                inspectionCode: 'IQ20251229001',
                productCode: 'RAW001',
                productName: '螺丝A',
                batchNo: 'BATCH001',
                totalQuantity: 1000,
                qualifiedQuantity: 985,
                unqualifiedQuantity: 15,
                qualifiedRate: 98.5,
                inspectorName: '张三',
                inspectionDate: '2025-12-29',
                status: 'qualified',
                defectTypes: ['尺寸偏差', '表面缺陷'],
                remarks: '个别产品尺寸超出公差范围',
              },
              {
                id: 2,
                inspectionType: 'process',
                inspectionCode: 'PQ20251229001',
                productCode: 'FIN001',
                productName: '产品A',
                batchNo: 'BATCH001',
                totalQuantity: 100,
                qualifiedQuantity: 95,
                unqualifiedQuantity: 5,
                qualifiedRate: 95.0,
                inspectorName: '李四',
                inspectionDate: '2025-12-29',
                status: 'qualified',
                defectTypes: ['功能异常'],
                remarks: '部分产品功能测试未通过',
              },
              {
                id: 3,
                inspectionType: 'finished',
                inspectionCode: 'FQ20251229001',
                productCode: 'FIN001',
                productName: '产品A',
                batchNo: 'BATCH001',
                totalQuantity: 98,
                qualifiedQuantity: 96,
                unqualifiedQuantity: 2,
                qualifiedRate: 98.0,
                inspectorName: '王五',
                inspectionDate: '2025-12-29',
                status: 'qualified',
                defectTypes: ['表面缺陷'],
                remarks: '包装外观有瑕疵',
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

      {reportType === 'trend' && (
        <div>
          <Row gutter={16}>
            <Col span={24}>
              <Card title="质量合格率趋势分析" style={{ marginBottom: 16 }}>
                <Line {...trendConfig} />
              </Card>
            </Col>
          </Row>

          <Card title="质量趋势详细数据">
            <Table
              size="small"
              columns={[
                { title: '月份', dataIndex: 'month', width: 80 },
                { title: '来料合格率', dataIndex: 'incomingQualified', align: 'right' as const, render: (rate: number) => `${rate}%` },
                { title: '过程合格率', dataIndex: 'processQualified', align: 'right' as const, render: (rate: number) => `${rate}%` },
                { title: '成品合格率', dataIndex: 'finishedQualified', align: 'right' as const, render: (rate: number) => `${rate}%` },
                { title: '总体合格率', dataIndex: 'overallQualified', align: 'right' as const, render: (rate: number) => `${rate}%` },
              ]}
              dataSource={trendData}
              pagination={false}
            />
          </Card>
        </div>
      )}

      {reportType === 'analysis' && (
        <Row gutter={16}>
          <Col span={12}>
            <Card title="质量问题分布">
              <Pie {...defectPieConfig} />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="质量KPI指标">
              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>总体合格率目标</span>
                    <span>95%</span>
                  </div>
                  <Progress
                    percent={stats.overallQualifiedRate}
                    success={{ percent: 95 }}
                    strokeColor="#52c41a"
                    showInfo={false}
                  />
                  <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '12px', color: '#666' }}>
                    当前: {stats.overallQualifiedRate}% {stats.overallQualifiedRate >= 95 ? '✅ 达标' : '❌ 未达标'}
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>来料合格率</span>
                    <span>{stats.incomingQualifiedRate}%</span>
                  </div>
                  <Progress
                    percent={stats.incomingQualifiedRate}
                    strokeColor="#1890ff"
                    showInfo={false}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>过程合格率</span>
                    <span>{stats.processQualifiedRate}%</span>
                  </div>
                  <Progress
                    percent={stats.processQualifiedRate}
                    strokeColor="#faad14"
                    showInfo={false}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>成品合格率</span>
                    <span>{stats.finishedQualifiedRate}%</span>
                  </div>
                  <Progress
                    percent={stats.finishedQualifiedRate}
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

export default QualityReportPage;
