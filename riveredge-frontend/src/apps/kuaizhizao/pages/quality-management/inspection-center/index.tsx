import React, { useMemo, Suspense, lazy } from 'react';
import { App, Card, Row, Col, Button, Space, Typography, Tag, Spin, Empty, Skeleton } from 'antd';
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  AlertOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  FileDoneOutlined,
  PartitionOutlined,
  DatabaseOutlined,
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

  const shortcuts = [
    {
      title: '来料检验',
      icon: <DatabaseOutlined style={{ fontSize: 20, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/quality-management/incoming-inspection',
    },
    {
      title: '过程检验',
      icon: <PartitionOutlined style={{ fontSize: 20, color: '#722ed1' }} />,
      path: '/apps/kuaizhizao/quality-management/process-inspection',
    },
    {
      title: '成品检验',
      icon: <SafetyCertificateOutlined style={{ fontSize: 20, color: '#52c41a' }} />,
      path: '/apps/kuaizhizao/quality-management/finished-goods-inspection',
    },
    {
      title: '质检方案',
      icon: <FileDoneOutlined style={{ fontSize: 20, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/quality-management/inspection-plans',
    },
  ];

  const kpiCardBodyStyle = { padding: '16px 20px', minHeight: 140, display: 'flex', alignItems: 'center' };

  const kpiSideBlock = (items: { label: string; value: string | number }[]) => (
    <div style={{
      marginLeft: 'auto',
      paddingLeft: 20,
      borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minWidth: 100
    }}>
      {items.map((it, idx) => (
        <div key={idx}>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 2 }}>{it.label}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{it.value}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '0 0 16px', overflow: 'visible' }}>
      <Spin spinning={summaryLoading && !summary}>
        <Row gutter={[16, 16]}>
          {/* KPI 区 */}
          <Col span={24}>
            <Row gutter={[18, 18]} align="stretch">
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
                    boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <ClockCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>待检任务总数</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {(summary?.pending_incoming || 0) + (summary?.pending_process || 0) + (summary?.pending_finished || 0)}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        当前所有待检单据/工序
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '来料/过程', value: `${summary?.pending_incoming || 0} / ${summary?.pending_process || 0}` },
                      { label: '成品待检', value: summary?.pending_finished || 0 },
                    ])}
                  </div>
                </Card>
              </Col>

              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
                    boxShadow: '0 4px 12px rgba(114, 46, 209, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <ThunderboltOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>今日质量达标</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {summary?.today_qualified_rate ?? 0}%
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        今日已检验 {summary?.total_inspected_today || 0} 批次
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '今日报检', value: summary?.total_inspected_today || 0 },
                      { label: '状态', value: (summary && summary.today_qualified_rate >= 98) ? '优良' : '受控' },
                    ])}
                  </div>
                </Card>
              </Col>

              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
                    boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>本月合格率</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {summary?.month_qualified_rate ?? 0}%
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        环比上月 {summary?.last_month_qualified_rate || 0}%
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '上月同期', value: `${summary?.last_month_qualified_rate || 0}%` },
                      { label: '趋势', value: (summary && summary.month_qualified_rate >= (summary.last_month_qualified_rate || 0)) ? '↑' : '↓' },
                    ])}
                  </div>
                </Card>
              </Col>
            </Row>
          </Col>

          {/* 快捷按钮 */}
          <Col span={24}>
            <Row gutter={[16, 16]}>
              {shortcuts.map((sc) => (
                <Col xs={12} sm={12} md={6} key={sc.path}>
                  <Card
                    hoverable
                    onClick={() => navigate(sc.path)}
                    styles={{ body: { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 } }}
                    style={{ borderRadius: 10 }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: 10,
                      background: 'rgba(0,0,0,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {sc.icon}
                    </div>
                    <Text strong style={{ fontSize: 14 }}>{sc.title}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>

          {/* 图表与异常 */}
          <Col xs={24} lg={16}>
            <Card
              title={<Space><BarChartOutlined /><span>质量合格率趋势</span></Space>}
              style={{ borderRadius: 12, height: '100%' }}
              styles={{ body: { padding: 8 } }}
            >
              <div style={{ height: 350 }}>
                <Suspense fallback={<Skeleton active />}>
                  <PassRateLineChart {...trendConfig} height={350} />
                </Suspense>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              title={<Space><AlertOutlined style={{ color: '#ff4d4f' }} /><span>质量异常记录</span></Space>}
              extra={<Button type="link" onClick={() => navigate('/apps/kuaizhizao/production-execution/quality-exceptions')}>全部</Button>}
              style={{ borderRadius: 12, height: '100%' }}
              styles={{ body: { padding: 8 } }}
            >
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {anomalies.map((item) => (
                  <div
                    key={`${item.inspection_type}-${item.inspection_id}`}
                    style={{
                      padding: '12px 8px',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer'
                    }}
                    onClick={() => navigate(INSPECTION_LIST_PATH[item.inspection_type] || '/')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Tag color={anomalySeverity(item) === 'high' ? 'red' : 'orange'}>
                        {INSPECTION_TYPE_LABEL[item.inspection_type]}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(item.inspection_time).fromNow()}</Text>
                    </div>
                    <Text strong style={{ display: 'block', marginBottom: 2 }}>{item.material_name || item.inspection_code}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.nonconformance_reason || '质量判定不合格'}</Text>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default InspectionCenter;
