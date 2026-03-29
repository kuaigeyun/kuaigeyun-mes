import React, { useMemo, Suspense, lazy } from 'react';
import { App, Card, Row, Col, Statistic, Button, Space, Typography, Tag, Spin, Empty, Skeleton } from 'antd';
import {
  ArrowRightOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useRequest } from 'ahooks';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { qualityApi, type QualityAnomalyItem } from '../../../services/quality-execution';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const PassRateLineChart = lazy(async () => {
  const { Line } = await import('@ant-design/charts');
  return {
    default: (props: React.ComponentProps<typeof Line>) => <Line {...props} />,
  };
});

const { Text } = Typography;

const INSPECTION_TYPE_LABEL: Record<string, string> = {
  incoming: '来料',
  process: '过程',
  finished: '成品',
};

const INSPECTION_LIST_PATH: Record<string, string> = {
  incoming: '/apps/kuaizhizao/quality-management/incoming-inspection',
  process: '/apps/kuaizhizao/quality-management/process-inspection',
  finished: '/apps/kuaizhizao/quality-management/finished-goods-inspection',
};

function anomalySeverity(a: QualityAnomalyItem): 'high' | 'medium' | 'low' {
  const iq = Number(a.inspection_quantity) || 0;
  const uq = Number(a.unqualified_quantity) || 0;
  if (iq <= 0) return 'low';
  const ratio = uq / iq;
  if (ratio >= 0.5) return 'high';
  if (ratio >= 0.2) return 'medium';
  return 'low';
}

const InspectionCenter: React.FC = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const {
    data: summary,
    loading: summaryLoading,
  } = useRequest(() => qualityApi.qualityStatistics.getInspectionCenterSummary(), {
    onError: (e: any) => message.error(e?.message || '加载质检中心数据失败'),
  });

  const {
    data: anomaliesResp,
    loading: anomaliesLoading,
  } = useRequest(() => qualityApi.qualityStatistics.getAnomalies({ limit: 12 }), {
    onError: (e: any) => message.error(e?.message || '加载质量异常失败'),
  });

  const anomalies = anomaliesResp?.anomalies ?? [];

  const chartData = useMemo(
    () =>
      (summary?.daily_pass_rate_trend || []).map((d) => ({
        date: d.date.slice(5),
        rate: d.rate,
      })),
    [summary]
  );

  const trendConfig = useMemo(() => {
    const rows = chartData.length ? chartData : [{ date: '-', rate: 0 }];
    const rates = chartData.map((d) => d.rate);
    const hasRates = rates.length > 0;
    const minR = hasRates ? Math.min(...rates) : 0;
    const maxR = hasRates ? Math.max(...rates) : 100;
    const pad = 5;
    return {
      data: rows,
      xField: 'date',
      yField: 'rate',
      smooth: true,
      animation: false,
      padding: 'auto' as const,
      color: '#1890ff',
      point: { size: 4, shape: 'diamond' as const },
      label: { style: { fill: '#aaa' } },
      yAxis: hasRates
        ? { min: Math.max(0, minR - pad), max: Math.min(100, maxR + pad) }
        : { min: 0, max: 100 },
    };
  }, [chartData]);

  const toolCards = [
    {
      title: '追溯查询',
      desc: '全生命周期追溯',
      icon: <ArrowRightOutlined />,
      color: '#1890ff',
      path: '/apps/kuaizhizao/quality-management/traceability',
    },
    {
      title: '质检方案',
      desc: '标准与方法定义',
      icon: <ArrowRightOutlined />,
      color: '#722ed1',
      path: '/apps/kuaizhizao/quality-management/inspection-plans',
    },
    {
      title: '不合格品处理',
      desc: 'MRB评审流程',
      icon: <ArrowRightOutlined />,
      color: '#faad14',
      path: '/apps/kuaizhizao/production-execution/quality-exceptions',
    },
    {
      title: '异常跟踪',
      desc: '8D改进闭环',
      icon: <ArrowRightOutlined />,
      color: '#ff4d4f',
      path: '/apps/kuaizhizao/production-execution/exception-process',
    },
  ];

  /** 与计划中心、仓储看板 KPI 统一的卡片体（略松排版） */
  const kpiCardBodyStyle = { padding: '22px 24px' as const, minHeight: 184 };

  const kpiSkeleton = (
    <Card style={{ borderRadius: 12 }} styles={{ body: { ...kpiCardBodyStyle } }}>
      <Skeleton active paragraph={{ rows: 2 }} />
    </Card>
  );

  return (
    <div style={{ minHeight: '100%', padding: '16px 0', overflow: 'visible' }}>
      <div>
        <Row gutter={[18, 18]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={8}>
            {summaryLoading && !summary ? (
              kpiSkeleton
            ) : (
              <Card
                hoverable
                onClick={() => navigate('/apps/kuaizhizao/quality-management/incoming-inspection')}
                style={{
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
                }}
                styles={{ body: { ...kpiCardBodyStyle, color: '#fff' } }}
              >
                <Statistic
                  styles={{ title: { marginBottom: 10 } }}
                  title={<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)' }}>来料待检</span>}
                  value={summary?.pending_incoming ?? 0}
                  valueStyle={{ color: '#fff', fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}
                  prefix={<ClockCircleOutlined style={{ fontSize: 20, opacity: 0.95 }} />}
                  suffix={
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', marginLeft: 10 }}>张单据</span>
                  }
                />
                <div
                  style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>关联仓库收货通知</Text>
                  <ArrowRightOutlined />
                </div>
              </Card>
            )}
          </Col>
          <Col xs={24} lg={8}>
            {summaryLoading && !summary ? (
              kpiSkeleton
            ) : (
              <Card
                hoverable
                onClick={() => navigate('/apps/kuaizhizao/quality-management/process-inspection')}
                style={{
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
                }}
                styles={{ body: { ...kpiCardBodyStyle, color: '#fff' } }}
              >
                <Statistic
                  styles={{ title: { marginBottom: 10 } }}
                  title={<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)' }}>过程待检</span>}
                  value={summary?.pending_process ?? 0}
                  valueStyle={{ color: '#fff', fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}
                  prefix={<ThunderboltOutlined style={{ fontSize: 20, opacity: 0.95 }} />}
                  suffix={
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', marginLeft: 10 }}>道工序</span>
                  }
                />
                <div
                  style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>现场首检/巡检</Text>
                  <ArrowRightOutlined />
                </div>
              </Card>
            )}
          </Col>
          <Col xs={24} lg={8}>
            {summaryLoading && !summary ? (
              kpiSkeleton
            ) : (
              <Card
                hoverable
                onClick={() => navigate('/apps/kuaizhizao/quality-management/finished-goods-inspection')}
                style={{
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
                }}
                styles={{ body: { ...kpiCardBodyStyle, color: '#fff' } }}
              >
                <Statistic
                  styles={{ title: { marginBottom: 10 } }}
                  title={<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)' }}>成品待检</span>}
                  value={summary?.pending_finished ?? 0}
                  valueStyle={{ color: '#fff', fontSize: 34, fontWeight: 700, lineHeight: 1.2 }}
                  prefix={<CheckCircleOutlined style={{ fontSize: 20, opacity: 0.95 }} />}
                  suffix={
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', marginLeft: 10 }}>批次</span>
                  }
                />
                <div
                  style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>入库前终检</Text>
                  <ArrowRightOutlined />
                </div>
              </Card>
            )}
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="stretch">
          <Col span={16}>
            <Card
              title={
                <span>
                  <BarChartOutlined style={{ marginRight: 8 }} />
                  质量合格率趋势
                </span>
              }
              extra={
                <Button type="link" onClick={() => navigate('/apps/kuaizhizao/quality-management/incoming-inspection')}>
                  详细分析
                </Button>
              }
              style={{ borderRadius: 12 }}
            >
              <div style={{ height: 350 }}>
                {summaryLoading && !summary ? (
                  <div style={{ height: 350, paddingTop: 8 }}>
                    <Skeleton active paragraph={{ rows: 6 }} />
                  </div>
                ) : (
                  <Suspense
                    fallback={
                      <div style={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Spin />
                      </div>
                    }
                  >
                    <PassRateLineChart {...trendConfig} height={350} />
                  </Suspense>
                )}
              </div>
            </Card>
          </Col>
          <Col span={8} style={{ display: 'flex' }}>
            <Card
              title={
                <span>
                  <AlertOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
                  最近质量异常
                </span>
              }
              styles={{
                body: {
                  padding: 0,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                },
              }}
              style={{
                borderRadius: 12,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <div style={{ flex: 1, overflow: 'auto', padding: '12px', minHeight: 350 }}>
                {anomaliesLoading ? (
                  <Skeleton active paragraph={{ rows: 8 }} />
                ) : anomalies.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已记录的不合格检验" />
                ) : (
                  anomalies.map((item) => {
                    const level = anomalySeverity(item);
                    const typeLabel = INSPECTION_TYPE_LABEL[item.inspection_type] || item.inspection_type;
                    const msg =
                      item.nonconformance_reason ||
                      item.material_name ||
                      item.inspection_code ||
                      '不合格记录';
                    const timeStr = item.inspection_time ? dayjs(item.inspection_time).fromNow() : '';
                    const path = INSPECTION_LIST_PATH[item.inspection_type] || INSPECTION_LIST_PATH.incoming;
                    return (
                      <div
                        key={`${item.inspection_type}-${item.inspection_id}`}
                        style={{
                          padding: '12px',
                          borderBottom: '1px solid var(--river-divider-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                        }}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(path)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') navigate(path);
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <Space>
                            <Tag color={level === 'high' ? 'red' : level === 'medium' ? 'orange' : 'blue'}>
                              {typeLabel}
                            </Tag>
                            <Text strong ellipsis>
                              {msg}
                            </Text>
                          </Space>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.inspection_code}
                            {timeStr ? ` · ${timeStr}` : ''}
                          </Text>
                        </div>
                        <Button type="text" icon={<RightOutlined />} aria-label="进入列表" />
                      </div>
                    );
                  })
                )}
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <Button type="link" onClick={() => navigate('/apps/kuaizhizao/production-execution/quality-exceptions')}>
                    查看所有异常
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <div style={{ marginTop: 16, marginBottom: 16, overflow: 'visible' }}>
          <Row gutter={[16, 16]}>
            {toolCards.map((tool) => (
              <Col span={6} key={tool.path}>
                <Card hoverable style={{ borderRadius: 12 }} onClick={() => navigate(tool.path)}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: `${tool.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16,
                      }}
                    >
                      <div style={{ color: tool.color, fontSize: 24 }}>{tool.icon}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{tool.title}</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {tool.desc}
                      </Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>
    </div>
  );
};

export default InspectionCenter;
