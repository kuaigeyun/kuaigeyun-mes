import React from 'react';
import { Card, Row, Col, Progress, Table, Typography, Empty, Tag, Spin, Space, Timeline } from 'antd';
import { useRequest } from 'ahooks';
import { ProCard } from '@ant-design/pro-components';
import { 
  FormOutlined, 
  InteractionOutlined, 
  PlayCircleOutlined,
  AppstoreAddOutlined,
  AlertOutlined,
  DashboardOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { mesDashboardService } from '../../../services/dashboard';
import { workOrderApi } from '../../../services/work-order';

const { Text } = Typography;

const ManufacturingDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // 1. 获取汇总数据
  const { data: summary, loading: summaryLoading } = useRequest(mesDashboardService.getManufacturingSummary);
  
  // 2. 获取最近生产工单
  const { data: recentOrdersResult, loading: ordersLoading } = useRequest(async () => {
     const res = await workOrderApi.list({ limit: 8 });
     return Array.isArray(res) ? res : (res?.items || []);
  });
  
  // 3. 获取最近生产播报 (报工记录)
  const { data: broadcast, loading: broadcastLoading } = useRequest(async () => {
    return mesDashboardService.getProductionBroadcast(10);
  });

  const recentOrders = recentOrdersResult || [];
  const recentBroadcast = (broadcast as any)?.items || [];
  const s = summary as any;

  /** 与其他看板统一的 KPI 卡片样式 */
  const kpiCardBodyStyle: React.CSSProperties = {
    padding: '16px 24px',
    color: '#fff',
    minHeight: 140,
    display: 'flex',
    alignItems: 'center',
    flex: 1,
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

  const shortcuts = [
    {
      title: '工单管理',
      icon: <DashboardOutlined style={{ fontSize: 22, color: '#1890ff' }} />,
      path: '/apps/kuaizhizao/production-execution/work-orders',
    },
    {
      title: '报工终端',
      icon: <PlayCircleOutlined style={{ fontSize: 22, color: '#52c41a' }} />,
      path: '/apps/kuaizhizao/production-execution/reporting',
    },
    {
      title: '批量报工',
      icon: <AppstoreAddOutlined style={{ fontSize: 22, color: '#fa8c16' }} />,
      path: '/apps/kuaizhizao/production-execution/batch-reporting',
    },
    {
      title: '异常处理',
      icon: <AlertOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />,
      path: '/apps/kuaizhizao/production-execution/exception-process',
    },
  ];

  return (
    <div style={{ padding: '0 0 16px', overflow: 'visible' }}>
      <Spin spinning={summaryLoading && !s}>
        <Row gutter={[16, 16]}>
          {/* KPI 区 */}
          <Col span={24}>
            <Row gutter={[18, 18]} align="stretch">
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders?status=draft')}
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
                      <FormOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>待排产工单</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.pending_scheduling ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        草稿状态待排计划任务
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '计划数', value: s?.pending_scheduling ?? 0 },
                    ])}
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
                  hoverable
                  onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders?status=in_progress')}
                  style={{
                    flex: 1,
                    width: '100%',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
                    boxShadow: '0 4px 12px rgba(250, 173, 20, 0.15)',
                  }}
                  styles={{ body: { ...kpiCardBodyStyle } }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, width: '100%' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'rgba(255, 255, 255, 0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <InteractionOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>进行中工单</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.in_progress_count ?? 0}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.72)', marginTop: 8 }}>
                        {s?.rework_count > 0 ? `含有 ${s.rework_count} 个返工/返修工单` : '全部生产线正常运作中'}
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '返工单', value: <span style={{ color: s?.rework_count > 0 ? '#fff' : 'rgba(255,255,255,0.7)' }}>{s?.rework_count ?? 0}</span> },
                    ])}
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8} style={{ display: 'flex' }}>
                <Card
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
                      <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>加工合格率 (今日)</div>
                      <div style={{ fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.2, marginTop: 6 }}>
                        {s?.qualified_rate ?? 0}%
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <Progress
                          percent={s?.qualified_rate ?? 0}
                          showInfo={false}
                          strokeColor="#fff"
                          railColor="rgba(255, 255, 255, 0.2)"
                          strokeWidth={6}
                        />
                      </div>
                    </div>
                    {kpiSideBlock([
                      { label: '今日产出', value: s?.today_output ?? 0 },
                      { label: '待核报工', value: s?.pending_reporting ?? 0 },
                    ])}
                  </div>
                </Card>
              </Col>
            </Row>
          </Col>

          {/* 快捷功能 */}
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

          {/* 业务表格 */}
          <Col xs={24} lg={14}>
            <ProCard
              title="最近生产工单"
              headerBordered
              style={{ height: '100%', borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              bodyStyle={{ padding: 8 }}
              extra={<a onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}>查看全部</a>}
            >
              <Table
                size="small"
                loading={ordersLoading}
                dataSource={recentOrders}
                pagination={false}
                rowKey="id"
                columns={[
                  {
                    title: '工单编号',
                    dataIndex: 'order_code',
                    render: (text, record: any) => <a onClick={() => navigate(`/apps/kuaizhizao/production-execution/work-orders/${record.id}`)}>{text}</a>
                  },
                  { title: '产品', dataIndex: 'material_name', ellipsis: true },
                  { title: '完工/计划', width: 110, render: (_, r: any) => `${r.completed_quantity}/${r.planned_quantity}` },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    width: 90,
                    render: (status) => {
                      let color = 'default';
                      const s = String(status).toLowerCase();
                      if (s.includes('progress') || s.includes('进行中')) color = 'processing';
                      if (s.includes('completed') || s.includes('已完成')) color = 'success';
                      if (s.includes('draft') || s.includes('草稿')) color = 'warning';
                      return <Tag color={color}>{status}</Tag>;
                    }
                  },
                ]}
              />
            </ProCard>
          </Col>

          <Col xs={24} lg={10}>
            <ProCard
              title="实时生产播报"
              headerBordered
              style={{ height: '100%', borderRadius: 12, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}
              bodyStyle={{ padding: 8 }}
            >
              <Timeline 
                style={{ marginTop: 16 }}
                pending={broadcastLoading ? "加载中..." : false}
                items={recentBroadcast.map((item: any) => ({
                  color: item.unqualified_quantity > 0 ? 'red' : 'green',
                  children: (
                    <div style={{ fontSize: 13 }}>
                      <Space>
                        <Text strong>{item.operator_name}</Text>
                        <Text type="secondary">{dayjs(item.created_at).format('HH:mm')}</Text>
                      </Space>
                      <div style={{ marginTop: 4 }}>
                        在 <Text code>{item.process_name}</Text> 报工 
                        <Text type="success" strong> +{item.qualified_quantity} </Text>
                        {item.unqualified_quantity > 0 && <Text type="danger"> (不合格 {item.unqualified_quantity}) </Text>}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 2 }}>
                        工单: {item.work_order_no} | {item.product_name}
                      </div>
                    </div>
                  )
                }))}
              />
            </ProCard>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default ManufacturingDashboard;
