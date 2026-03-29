import React from 'react';
import { Card, Row, Col, Progress, Table, Tag, Typography, Empty, Badge } from 'antd';
import { useRequest } from 'ahooks';
import { ProCard } from '@ant-design/pro-components';
import { BuildOutlined, AlertOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../../../services/api';

const { Text } = Typography;

type SummaryShape = {
  material_readiness: any[];
  resource_load: any[];
  delivery_risks: any[];
  total_wip_count: number;
  total_risk_count: number;
};

const ProductionControlTower: React.FC = () => {
  const navigate = useNavigate();
  const { data: summary, loading } = useRequest(async () => {
    return apiRequest('/apps/kuaizhizao/production-control/summary');
  }, {
    pollingInterval: 30000, // 每 30 秒轮询一次
  });

  if (!summary && loading) {
    return (
      <div style={{ padding: '16px 0', overflow: 'visible' }}>
        <Card loading />
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{ padding: '16px 0', overflow: 'visible' }}>
        <Empty description="暂无管控数据" />
      </div>
    );
  }

  const s = summary as SummaryShape;
  const readinessList = s.material_readiness || [];
  const risks = s.delivery_risks || [];
  const delayedCount = risks.filter((r: any) => r.risk_type === 'delayed').length;
  const clashCount = risks.length - delayedCount;
  const avgReadiness =
    readinessList.length > 0
      ? Number(
          (readinessList.reduce((acc: number, cur: any) => acc + (cur.readiness_rate ?? 0), 0) / readinessList.length).toFixed(1)
        )
      : 100;
  const notFullyKitted = readinessList.filter((r: any) => (r.readiness_rate ?? 0) < 100).length;

  const navigateToWorkOrder = (code: string) => {
    navigate(`/apps/kuaizhizao/production-execution/work-orders?code=${code}`);
  };

  /** 与质检中心、仓储看板 KPI 统一的卡片体（略松排版） */
  const kpiCardBodyStyle: React.CSSProperties = {
    padding: '22px 24px',
    color: '#fff',
    minHeight: 184,
    display: 'flex',
    alignItems: 'center',
  };

  const kpiSideBlock = (lines: { label: string; value: React.ReactNode }[]) => (
    <div
      style={{
        flexShrink: 0,
        paddingLeft: 18,
        marginLeft: 8,
        borderLeft: '1px solid rgba(255, 255, 255, 0.28)',
        minWidth: 82,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {lines.map((line) => (
        <div key={String(line.label)}>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', lineHeight: 1.25 }}>{line.label}</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginTop: 2 }}>{line.value}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: '16px 0', overflow: 'visible' }}>
      <Row gutter={[16, 16]}>
        {/* 核心指标：横向紧凑布局，右侧补充真实数据避免大面积留白 */}
        <Col span={24}>
          <Row gutter={[18, 18]} align="stretch">
            <Col xs={24} lg={8} style={{ display: 'flex' }}>
              <Card
                hoverable
                onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
                style={{
                  flex: 1,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
                  boxShadow: '0 4px 12px rgba(24, 144, 255, 0.15)',
                }}
                styles={{ body: { ...kpiCardBodyStyle, flex: 1 } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <BuildOutlined style={{ fontSize: 24, color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.35 }}>
                      在制工单总数
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                      {s.total_wip_count}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8, lineHeight: 1.45 }}>
                      已下达 / 执行中工单；下方齐套表实时跟踪物料
                    </div>
                  </div>
                  {kpiSideBlock([
                    { label: '齐套视图', value: readinessList.length },
                    { label: '未齐套', value: notFullyKitted },
                  ])}
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8} style={{ display: 'flex' }}>
              <Card
                style={{
                  flex: 1,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
                  boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
                }}
                styles={{ body: { ...kpiCardBodyStyle, flex: 1 } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.35 }}>
                      异常风险订单
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                      {s.total_risk_count}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8, lineHeight: 1.45 }}>
                      {s.total_risk_count > 0 ? '含延期与交付冲突，详见下方交期风险表' : '当前暂无交期延期风险'}
                    </div>
                  </div>
                  {kpiSideBlock([
                    { label: '已延期', value: delayedCount },
                    { label: '交付风险', value: clashCount },
                  ])}
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8} style={{ display: 'flex' }}>
              <Card
                style={{
                  flex: 1,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
                  boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)',
                }}
                styles={{ body: { ...kpiCardBodyStyle, flex: 1 } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircleOutlined style={{ fontSize: 24, color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.35 }}>
                      平均齐套率
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                      {avgReadiness}
                      <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 4 }}>%</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8, lineHeight: 1.45 }}>
                      基于齐套监控列表加权平均；无数据时默认 100%
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, width: 68, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Progress
                      type="circle"
                      percent={avgReadiness}
                      size={60}
                      strokeColor="#fff"
                      trailColor="rgba(255, 255, 255, 0.18)"
                      format={(p) => <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{p}</span>}
                    />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </Col>

        {/* 齐套性分析表 */}
        <Col span={12}>
          <ProCard title="工单齐套性监控 (前10)" headerBordered style={{ height: '100%' }}>
            <Table
              size="small"
              dataSource={summary.material_readiness.slice(0, 10)}
              pagination={false}
              rowKey="work_order_id"
              columns={[
                { 
                  title: '工单', 
                  dataIndex: 'work_order_code', 
                  width: 120,
                  render: (text: string) => (
                    <a onClick={() => navigateToWorkOrder(text)}>{text}</a>
                  )
                },
                { title: '产品', dataIndex: 'product_name', ellipsis: true },
                { 
                  title: '齐套进度', 
                  dataIndex: 'readiness_rate', 
                  width: 140,
                  render: (val: number) => (
                    <Progress 
                        percent={val} 
                        size="small" 
                        status={val === 100 ? 'success' : val < 50 ? 'exception' : 'active'} 
                        strokeColor={val === 100 ? '#52c41a' : val >= 80 ? '#faad14' : '#ff4d4f'}
                    />
                  )
                },
                { 
                  title: '缺料', 
                  dataIndex: 'shortage_count', 
                  width: 60,
                  render: (count: number) => count > 0 ? <Tag color="error">{count} 种</Tag> : <Badge status="success" text="齐套" />
                }
              ]}
            />
          </ProCard>
        </Col>

        {/* 资源负荷热图 */}
        <Col span={12}>
          <ProCard title="工作中心负荷预警 (未来14天)" headerBordered style={{ height: '100%' }}>
            {summary.resource_load.map((wc: any) => (
              <div key={wc.work_center_id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text strong>{wc.work_center_name}</Text>
                  <Text type="secondary">{wc.load_hours} / {wc.capacity_hours} hrs ({wc.load_rate}%)</Text>
                </div>
                <Progress 
                  percent={Math.min(wc.load_rate, 100)} 
                  strokeColor={wc.load_rate > 90 ? '#ff4d4f' : wc.load_rate > 70 ? '#faad14' : '#52c41a'}
                  status={wc.load_rate > 100 ? 'exception' : 'normal'}
                />
              </div>
            ))}
            {summary.resource_load.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无负荷数据" />}
          </ProCard>
        </Col>

        {/* 交期风险订单 */}
        <Col span={24}>
          <ProCard title="交期风险追踪" headerBordered collapsible defaultCollapsed={false}>
            <Table
              size="small"
              dataSource={summary.delivery_risks}
              pagination={{ pageSize: 5 }}
              rowKey="work_order_id"
              columns={[
                { 
                  title: '风险类型', 
                  dataIndex: 'risk_type', 
                  width: 100,
                  render: (val: string) => <Tag color={val === 'delayed' ? 'volcano' : 'warning'}>{val === 'delayed' ? '实际延期' : '预计风险'}</Tag>
                },
                { 
                  title: '工单编号', 
                  dataIndex: 'work_order_code', 
                  width: 140,
                  render: (text: string) => (
                    <a onClick={() => navigateToWorkOrder(text)}>{text}</a>
                  )
                },
                { title: '产品', dataIndex: 'product_name' },
                { title: '计划结束', dataIndex: 'planned_end_date', width: 120 },
                { title: '异常说明', dataIndex: 'risk_desc', render: (text: string) => <Text type="danger">{text}</Text> }
              ]}
            />
          </ProCard>
        </Col>
      </Row>
    </div>
  );
};

export default ProductionControlTower;
