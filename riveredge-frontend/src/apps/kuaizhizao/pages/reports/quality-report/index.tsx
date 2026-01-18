/**
 * 质量报表页面
 *
 * 提供质量合格率统计、质量趋势分析等功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, Row, Col, Statistic, Table, Select, DatePicker, Space, Tag, Progress, Spin } from 'antd';
import { DownloadOutlined, BarChartOutlined, LineChartOutlined, PieChartOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { Line, Bar, Pie } from '@ant-design/charts';
import { ListPageTemplate, StatCard } from '../../../../../components/layout-templates/ListPageTemplate';
import { qualityApi } from '../../../services/production';
import { exportReport } from '../../../services/reports';
import dayjs from 'dayjs';

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
  const [dateRange, setDateRange] = useState<[string, string]>([
    dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
    dayjs().format('YYYY-MM-DD')
  ]);
  const [inspectionType, setInspectionType] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  // 统计数据状态
  const [stats, setStats] = useState({
    totalInspections: 0,
    qualifiedInspections: 0,
    unqualifiedInspections: 0,
    overallQualifiedRate: 0,
    incomingQualifiedRate: 0,
    processQualifiedRate: 0,
    finishedQualifiedRate: 0,
  });

  // 图表数据状态
  const [trendData, setTrendData] = useState<QualityTrendData[]>([]);

  // 质量问题分布
  const [defectDistribution, setDefectDistribution] = useState([
    { type: '尺寸偏差', count: 0, percentage: 0 },
    { type: '表面缺陷', count: 0, percentage: 0 },
    { type: '功能异常', count: 0, percentage: 0 },
    { type: '材质问题', count: 0, percentage: 0 },
    { type: '其他', count: 0, percentage: 0 },
  ]);

  // 报表数据
  const [reportData, setReportData] = useState<QualityReportItem[]>([]);

  // 加载统计数据
  const loadStatistics = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (inspectionType !== 'all') {
        params.inspection_type = inspectionType;
      }
      if (dateRange[0]) {
        params.start_date = dateRange[0];
      }
      if (dateRange[1]) {
        params.end_date = dateRange[1];
      }

      const response = await qualityApi.qualityStatistics.getStatistics(params);
      const data = response || {};

      // 更新统计数据
      const totalInspections = data.total_inspections || 0;
      const qualifiedQuantity = data.qualified_quantity || 0;
      const unqualifiedQuantity = data.unqualified_quantity || 0;
      const qualifiedRate = data.qualified_rate || 0;

      setStats({
        totalInspections,
        qualifiedInspections: Math.round(qualifiedQuantity * (qualifiedRate / 100)),
        unqualifiedInspections: Math.round(unqualifiedQuantity),
        overallQualifiedRate: Number(qualifiedRate.toFixed(2)),
        incomingQualifiedRate: data.by_type?.incoming?.qualified_rate 
          ? Number(data.by_type.incoming.qualified_rate.toFixed(2)) 
          : 0,
        processQualifiedRate: data.by_type?.process?.qualified_rate 
          ? Number(data.by_type.process.qualified_rate.toFixed(2)) 
          : 0,
        finishedQualifiedRate: data.by_type?.finished?.qualified_rate 
          ? Number(data.by_type.finished.qualified_rate.toFixed(2)) 
          : 0,
      });
    } catch (error: any) {
      messageApi.error(error.message || '加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载质量异常数据
  const loadAnomalies = async () => {
    try {
      const params: any = {};
      if (inspectionType !== 'all') {
        params.inspection_type = inspectionType;
      }
      if (dateRange[0]) {
        params.start_date = dateRange[0];
      }
      if (dateRange[1]) {
        params.end_date = dateRange[1];
      }

      const response = await qualityApi.qualityStatistics.getAnomalies(params);
      const anomalies = response?.anomalies || [];

      // 转换为报表数据格式
      const items: QualityReportItem[] = anomalies.map((item: any) => ({
        id: item.inspection_id,
        inspectionType: item.inspection_type,
        inspectionCode: item.inspection_code,
        productCode: item.material_code,
        productName: item.material_name,
        batchNo: item.batch_no || '-',
        totalQuantity: item.inspection_quantity,
        qualifiedQuantity: item.qualified_quantity,
        unqualifiedQuantity: item.unqualified_quantity,
        qualifiedRate: item.inspection_quantity > 0
          ? Number((item.qualified_quantity / item.inspection_quantity * 100).toFixed(2))
          : 0,
        inspectorName: item.inspector_name || '-',
        inspectionDate: item.inspection_time ? dayjs(item.inspection_time).format('YYYY-MM-DD HH:mm') : '-',
        status: item.quality_status === '合格' ? 'qualified' : 'unqualified',
        defectTypes: item.nonconformance_reason ? [item.nonconformance_reason] : [],
        remarks: item.remarks,
      }));

      setReportData(items);
    } catch (error: any) {
      messageApi.error(error.message || '加载质量异常数据失败');
    }
  };

  // 加载质量报表数据
  const loadQualityReport = async () => {
    try {
      const params: any = {
        report_type: reportType === 'summary' ? 'analysis' : reportType === 'trend' ? 'trend' : 'analysis',
      };
      if (dateRange[0]) {
        params.date_start = dateRange[0];
      }
      if (dateRange[1]) {
        params.date_end = dateRange[1];
      }

      const response = await qualityApi.qualityStatistics.getReport(params);
      
      // 处理趋势数据
      if (response.trend_data) {
        const trendItems: QualityTrendData[] = response.trend_data.map((item: any) => ({
          month: item.month || item.period,
          incomingQualified: item.incoming_qualified_rate || 0,
          processQualified: item.process_qualified_rate || 0,
          finishedQualified: item.finished_qualified_rate || 0,
          overallQualified: item.overall_qualified_rate || 0,
        }));
        setTrendData(trendItems);
      }

      // 处理缺陷分布数据
      if (response.defect_distribution) {
        const total = response.defect_distribution.reduce((sum: number, item: any) => sum + (item.count || 0), 0);
        const distribution = response.defect_distribution.map((item: any) => ({
          type: item.type || item.defect_type,
          count: item.count || 0,
          percentage: total > 0 ? Number((item.count / total * 100).toFixed(1)) : 0,
        }));
        setDefectDistribution(distribution);
      }
    } catch (error: any) {
      messageApi.error(error.message || '加载质量报表数据失败');
    }
  };

  // 初始化加载数据
  useEffect(() => {
    loadStatistics();
    loadAnomalies();
    if (reportType === 'trend' || reportType === 'analysis') {
      loadQualityReport();
    }
  }, [dateRange, inspectionType, reportType]);

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
  const handleExport = async () => {
    try {
      setLoading(true);
      await exportReport('quality', {
        report_type: reportType === 'summary' ? 'analysis' : reportType === 'trend' ? 'trend' : 'analysis',
        date_start: dateRange[0],
        date_end: dateRange[1],
        filters: {
          inspection_type: inspectionType !== 'all' ? inspectionType : undefined,
        },
      });
      messageApi.success('报表导出成功');
    } catch (error: any) {
      messageApi.error(error.message || '报表导出失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理报表类型切换
  const handleReportTypeChange = (type: 'summary' | 'trend' | 'analysis') => {
    setReportType(type);
    if (type === 'trend' || type === 'analysis') {
      loadQualityReport();
    }
  };

  // 处理刷新
  const handleRefresh = () => {
    loadStatistics();
    loadAnomalies();
    if (reportType === 'trend' || reportType === 'analysis') {
      loadQualityReport();
    }
  };

  // 统计卡片数据
  const statCards: StatCard[] = [
    {
      title: '总检验数',
      value: stats.totalInspections,
      prefix: <CheckCircleOutlined />,
      valueStyle: { color: '#1890ff' },
    },
    {
      title: '合格检验',
      value: stats.qualifiedInspections,
      suffix: `/ ${stats.totalInspections}`,
      valueStyle: { color: '#52c41a' },
    },
    {
      title: '不合格检验',
      value: stats.unqualifiedInspections,
      suffix: `/ ${stats.totalInspections}`,
      valueStyle: { color: '#f5222d' },
    },
    {
      title: '总体合格率',
      value: stats.overallQualifiedRate,
      suffix: '%',
      valueStyle: { color: '#52c41a' },
    },
    {
      title: '来料合格率',
      value: stats.incomingQualifiedRate,
      suffix: '%',
      valueStyle: { color: '#1890ff' },
    },
    {
      title: '过程合格率',
      value: stats.processQualifiedRate,
      suffix: '%',
      valueStyle: { color: '#1890ff' },
    },
    {
      title: '成品合格率',
      value: stats.finishedQualifiedRate,
      suffix: '%',
      valueStyle: { color: '#1890ff' },
    },
  ];

  return (
    <ListPageTemplate statCards={statCards}>

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
            value={dateRange.map(date => date ? dayjs(date) : null) as any}
            onChange={(dates) => {
              if (dates) {
                setDateRange([
                  dates[0]?.format('YYYY-MM-DD') || '',
                  dates[1]?.format('YYYY-MM-DD') || ''
                ]);
              }
            }}
          />

          <Button onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
            导出报表
          </Button>
        </Space>
      </Card>

      {/* 报表内容 */}
      <Spin spinning={loading}>
        {reportType === 'summary' && (
          <UniTable<QualityReportItem>
          headerTitle="质量检验汇总报表"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            // 使用真实数据
            return {
              data: reportData,
              success: true,
              total: reportData.length,
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
    </ListPageTemplate>
  );
};

export default QualityReportPage;
