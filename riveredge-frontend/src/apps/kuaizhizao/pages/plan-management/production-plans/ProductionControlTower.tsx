import React from 'react';
import { Card, Row, Col, Progress, Table, Tag, Typography, Space, Spin, Empty } from 'antd';
import { useRequest } from 'ahooks';
import {
  RocketOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  SafetyOutlined,
  ToolOutlined,
  AuditOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../../../services/api';

const { Text } = Typography;

type SummaryShape = {
  material_readiness: any[];
  resource_load: any[];
  delivery_risks: any[];
  total_wip_count: number;
  total_risk_count: number;
  // 以下是新增或对应的统计字段（假设后端返回 stats 对象或扁平化）
  stats?: {
    total_count: number;
    pending_review_count: number;
    executed_count: number;
    overdue_plans_count: number;
  }
};

const ProductionControlTower: React.FC = () => {
  const navigate = useNavigate();
  const { data: summary, loading } = useRequest(async () => {
    return apiRequest('/apps/kuaizhizao/production-control/summary');
  }, {
    pollingInterval: 30000,
  });

  const s = summary as SummaryShape | undefined;

  const readinessList = s?.material_readiness || [];
  const risks = s?.delivery_risks || [];
  const delayedCount = risks.filter((r: any) => r.risk_type === 'delayed').length;
  const avgReadiness =
    readinessList.length > 0
      ? Number(
          (readinessList.reduce((acc: number, cur: any) => acc + (cur.readiness_rate ?? 0), 0) / readinessList.length).toFixed(1)
        )
      : 100;
  const notFullyKitted = readinessList.filter((r: any) => (r.readiness_rate ?? 0) < 100).length;

  const kpiCardBodyStyle: React.CSSProperties = {
    padding: '16px 20px',
    minHeight: 140,
    display: 'flex',
    alignItems: 'center',
  };

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

  const shortcuts = [
    {
      title: '需求运算',
      icon: <RocketOutlined style={{ fontSize: 20, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/plan-management/demand-computations',
    },
    {
      title: '生产计划',
      icon: <ScheduleOutlined style={{ fontSize: 20, color: '#722ed1' }} />,
      path: '/apps/kuaizhizao/plan-management/production-plans',
    },
    {
      title: '缺料预警',
      icon: <AlertOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />,
      path: '/apps/kuaizhizao/warehouse-management/inventory-alert',
    },
    {
      title: '主生产排程',
      icon: <AppstoreOutlined style={{ fontSize: 20, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/plan-management/production-plans',
    },
    {
      title: '工单下放',
      icon: <SafetyOutlined style={{ fontSize: 20, color: '#52c41a' }} />,
      path: '/apps/kuaizhizao/production-execution/work-orders',
    },
    {
      title: '报工看板',
      icon: <DashboardOutlined style={{ fontSize: 20, color: '#13c2c2' }} />,
      path: '/apps/kuaizhizao/production-execution/report-center',
    },
  ];

  return (
    <div style={{ padding: '0 0 16px', overflow: 'visible' }}>
      <Spin spinning={loading && !s}>
        <Row gutter={[16, 16]}>
          {/* KPI 区 */}
          <Col span={24}>
            <Row gutter={[18, 18]} align="stretch">
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/plan-management/production-plans')}
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
                      <AuditOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>生产计划总数</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.stats?.total_count ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        所有层级计划累计
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '待审核', value: s?.stats?.pending_review_count ?? 0 },
                      { label: '已下达', value: s?.stats?.executed_count ?? 0 },
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
                    background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
                    boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <AlertOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>交付风险预控</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.total_risk_count ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        含延期与产能瓶颈风险
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '逾期计划', value: s?.stats?.overdue_plans_count ?? 0 },
                      { label: '延期单据', value: delayedCount },
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
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>平均齐套进度</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {avgReadiness}%
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        在制工单 {s?.total_wip_count ?? 0} 个
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '欠料工单', value: notFullyKitted },
                      { label: '预计齐套', value: readinessList.length - notFullyKitted },
                    ])}
                  </div>
                </Card>
              </Col>
            </Row>
          </Col>

          {/* 快捷按钮 (6 宫格) */}
          <Col span={24}>
            <Row gutter={[16, 16]}>
              {shortcuts.map((sc) => (
                <Col xs={12} sm={8} md={4} key={sc.path}>
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
                    <Text strong style={{ fontSize: 13 }}>{sc.title}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Col>

          {/* 业务台账区 */}
          <Col xs={24} lg={12}>
            <Card
              title={<Space><ToolOutlined /><span>工单齐套监控</span></Space>}
              style={{ borderRadius: 12, height: '100%' }}
              styles={{ body: { padding: 8 } }}
            >
              <Table
                size="small"
                dataSource={readinessList.slice(0, 10)}
                pagination={false}
                rowKey="work_order_id"
                columns={[
                  { title: '工单', dataIndex: 'work_order_code', ellipsis: true },
                  { title: '进度', dataIndex: 'readiness_rate', width: 120, render: (v) => <Progress percent={v} size="small" /> },
                  { 
                    title: '缺料', 
                    dataIndex: 'shortage_count', 
                    width: 60,
                    render: (count: number) => count > 0 ? <Tag color="error">{count} 种</Tag> : <Badge />
                  }
                ]}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title={<Space><AlertOutlined style={{ color: '#ff4d4f' }} /><span>交期风险追踪</span></Space>}
              style={{ borderRadius: 12, height: '100%' }}
              styles={{ body: { padding: 8 } }}
            >
              <Table
                size="small"
                dataSource={risks.slice(0, 5)}
                pagination={false}
                rowKey="work_order_id"
                columns={[
                  { title: '风险', dataIndex: 'risk_type', width: 80, render: (v) => <Tag color={v === 'delayed' ? 'red' : 'orange'}>{v === 'delayed' ? '逾期' : '风险'}</Tag> },
                  { title: '工单', dataIndex: 'work_order_code', ellipsis: true },
                  { title: '计划结束', dataIndex: 'planned_end_date', width: 110 },
                ]}
                locale={{ emptyText: <Empty style={{ padding: 40 }} description="当前暂无交期风险" /> }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

const Badge: React.FC = () => (
  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52c41a' }} />
);

export default ProductionControlTower;
