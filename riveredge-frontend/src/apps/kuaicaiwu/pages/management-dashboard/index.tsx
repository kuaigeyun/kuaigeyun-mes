import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Spin, Typography, Space, Divider } from 'antd';
import { Pie } from '@ant-design/charts';
import { 
  RocketOutlined, 
  SafetyCertificateOutlined, 
  LineChartOutlined, 
  HistoryOutlined,
  AlertOutlined 
} from '@ant-design/icons';
import { managementReportService } from '../../services/management-report';

const { Title, Text } = Typography;

const ManagementDashboard: React.FC = () => {
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['financialKpis'],
    queryFn: () => managementReportService.getKPIs(30),
  });

  const { data: qualityLoss, isLoading: loadingQuality } = useQuery({
    queryKey: ['qualityLoss'],
    queryFn: () => managementReportService.getQualityLoss(30),
  });

  const { data: efficiency, isLoading: loadingEfficiency } = useQuery({
    queryKey: ['laborEfficiency'],
    queryFn: () => managementReportService.getLaborEfficiency(30),
  });

  const { data: wip, isLoading: loadingWIP } = useQuery({
    queryKey: ['wipValuation'],
    queryFn: () => managementReportService.getWIPValuation(),
  });

  if (loadingKpis || loadingQuality || loadingEfficiency || loadingWIP) {
    return (
      <div style={{ padding: 100, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: 'var(--ant-color-text-secondary)' }}>载入数字化经营看板...</div>
      </div>
    );
  }

  // 账龄数据转换
  const agingData = kpis ? Object.entries(kpis.receivable_aging).map(([key, val]) => ({
    type: key,
    value: val.amount,
  })) : [];

  const agingConfig = {
    appendPadding: 10,
    data: agingData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}',
    },
    interactions: [{ type: 'element-active' }],
  };

  return (
    <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100vh' }}>
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <Title level={2}>数字化经营决策看板 <Text type="secondary" style={{ fontSize: '14px', fontWeight: 'normal' }}>近 30 天经营快报</Text></Title>

        {/* 核心 KPI 卡片 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} hoverable>
              <Statistic
                title="DSO (应收账款周转天数)"
                value={kpis?.dso}
                precision={1}
                suffix="天"
                valueStyle={{ color: '#3f8600' }}
                prefix={<LineChartOutlined />}
              />
              <Text type="secondary">资金回笼效率指标</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} hoverable>
              <Statistic
                title="利润率 (Gross Margin)"
                value={kpis ? kpis.gross_margin_rate * 100 : 0}
                precision={2}
                suffix="%"
                valueStyle={{ color: '#cf1322' }}
                prefix={<RocketOutlined />}
              />
              <Text type="secondary">本期销售盈利水平</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} hoverable>
              <Statistic
                title="人效产出比"
                value={efficiency?.labor_efficiency_rate}
                precision={1}
                suffix="%"
                valueStyle={{ color: '#1890ff' }}
                prefix={<SafetyCertificateOutlined />}
              />
              <Text type="secondary">标时/实时 对比</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} hoverable>
              <Statistic
                title="WIP 在制品估值"
                value={wip?.estimated_wip_value}
                precision={0}
                valueStyle={{ color: '#faad14' }}
                prefix={<Space size={4}><HistoryOutlined />¥</Space>}
              />
              <Text type="secondary">车间在产资金沉淀</Text>
            </Card>
          </Col>
        </Row>

        <Divider />

        {/* 深度分析图表 */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card title="应收账款账龄分布 (AR Aging)" bordered={false}>
              <Pie {...agingConfig} />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card 
              title="质量损失分析 (COPQ)" 
              bordered={false} 
              extra={<Text type="danger"><AlertOutlined /> 异常预警</Text>}
            >
              <Row>
                <Col span={12}>
                  <Statistic title="报废直接金额" value={qualityLoss?.scrap_cost} prefix="¥" precision={2} />
                </Col>
                <Col span={12}>
                  <Statistic title="不合格品数" value={qualityLoss?.unqualified_quantity} suffix="PCS" />
                </Col>
              </Row>
              <div style={{ marginTop: 24, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff1f0', borderRadius: 8 }}>
                 <Text type="danger" strong>质量损失金额占销售额比重过高，建议排查制程缺陷</Text>
              </div>
            </Card>
          </Col>
        </Row>
      </Space>
    </div>
  );
};

export default ManagementDashboard;
