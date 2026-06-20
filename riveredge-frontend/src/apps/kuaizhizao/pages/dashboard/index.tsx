import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  StatisticCard, 
  ProList, 
  ProCard
} from '@ant-design/pro-components';
import { 
  Row, Col, List, Tag, Badge, Typography, Space, Progress, Timeline, 
  Card, Empty, Spin, Divider, theme
} from 'antd';
import { 
  ClockCircleOutlined, 
  ThunderboltOutlined, 
  DeploymentUnitOutlined, 
  CarryOutOutlined,
  SoundOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { mesDashboardService } from '../../services/dashboard';
import { UniDashboard } from '../../../../components/uni-dashboard';
import dayjs from 'dayjs';
import { formatDateTime } from '../../../../utils/format';

const { Text, Title, Link } = Typography;
const { useToken } = theme;

const MESDashboard: React.FC = () => {
  const { token } = useToken();
  const dashboardCardStyle = { borderRadius: token.borderRadiusLG };
  // 1. 获取基础统计
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['mesStatistics'],
    queryFn: () => mesDashboardService.getStatistics(),
  });

  // 2. 获取待办任务
  const { data: todos, isLoading: todosLoading } = useQuery({
    queryKey: ['mesTodos'],
    queryFn: () => mesDashboardService.getTodos(10),
  });

  // 3. 获取实时播报
  const { data: broadcast } = useQuery({
    queryKey: ['mesBroadcast'],
    queryFn: () => mesDashboardService.getProductionBroadcast(8),
    refetchInterval: 30000, // 每 30 秒轮询一次
  });

  // 4. 获取工序进度
  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ['mesProcessProgress'],
    queryFn: () => mesDashboardService.getProcessProgress(true),
  });

  // 5. 获取管理指标
  const { data: metrics } = useQuery({
    queryKey: ['mesManagementMetrics'],
    queryFn: () => mesDashboardService.getManagementMetrics(),
  });

  if (statsLoading || todosLoading || progressLoading) {
    return (
      <UniDashboard>
        <div style={{ padding: 100, textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: 'var(--ant-color-text-secondary)' }}>正在加载车间实时看板...</div>
        </div>
      </UniDashboard>
    );
  }

  return (
    <UniDashboard>
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <Title level={3}>车间数字化看板 <Text type="secondary" style={{ fontSize: '14px' }}>实时生产执行监控与辅助决策</Text></Title>

        {/* 核心指标行 */}
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <StatisticCard
              style={dashboardCardStyle}
              statistic={{
                title: '工单完成率',
                value: stats?.production?.completion_rate || 0,
                suffix: '%',
                precision: 1,
                icon: <CarryOutOutlined style={{ color: '#1890ff' }} />,
              }}
              footer={
                <Space>
                  <Text type="secondary">正在执行</Text>
                  <Text strong>{stats?.production?.in_progress || 0}</Text>
                  <Divider type="vertical" />
                  <Text type="secondary">本月已结</Text>
                  <Text strong>{stats?.production?.completed || 0}</Text>
                </Space>
              }
            />
          </Col>
          <Col span={6}>
            <StatisticCard
              style={dashboardCardStyle}
              statistic={{
                title: '平均生产周期',
                value: metrics?.average_production_cycle || 0,
                suffix: '天',
                precision: 1,
                icon: <ClockCircleOutlined style={{ color: '#52c41a' }} />,
              }}
              footer={<Text type="secondary">从计划下达到入库平均耗时</Text>}
            />
          </Col>
          <Col span={6}>
              <StatisticCard
                style={dashboardCardStyle}
                statistic={{
                  title: '制程良率 (Yield)',
                  value: 100 - (stats?.production?.defect_rate || 0),
                  suffix: '%',
                  precision: 2,
                  icon: <ThunderboltOutlined style={{ color: '#faad14' }} />,
                }}
                footer={
                  <Space>
                    <Text type="secondary">报废金额占生产总值比</Text>
                    {stats?.production?.defect_rate > 5 && <Badge status="error" text="预警" />}
                  </Space>
                }
              />
          </Col>
          <Col span={6}>
            <StatisticCard
              style={dashboardCardStyle}
              statistic={{
                title: '准交率 (OTD)',
                value: metrics?.on_time_delivery_rate || 0,
                suffix: '%',
                precision: 1,
                icon: <DeploymentUnitOutlined style={{ color: '#eb2f96' }} />,
              }}
              footer={<Text type="secondary">按时交付订单占比</Text>}
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          {/* 左侧：待办与广播 */}
          <Col span={16}>
            <Space orientation="vertical" style={{ width: '100%' }} size="large">
              {/* 在制工序进展 */}
              <ProCard title="在制工序进展监控" extra={<Link>查看全部工单</Link>} bordered style={dashboardCardStyle}>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <List
                    itemLayout="horizontal"
                    dataSource={progress?.items || []}
                    renderItem={(item: any) => (
                      <List.Item extra={
                        <div style={{ width: 120 }}>
                          <Progress percent={item.current_progress} size="small" status={item.status === 'in_progress' ? 'active' : 'normal'} />
                        </div>
                      }>
                        <List.Item.Meta
                          title={<b>{item.process_name} <Text type="secondary" style={{ fontWeight: 'normal' }}>({item.process_id})</Text></b>}
                          description={
                            <Space split={<Divider type="vertical" />}>
                              <span>合格: <Text type="success">{item.qualified_quantity}</Text></span>
                              <span>异常: <Text type="danger">{item.unqualified_quantity}</Text></span>
                              <span>任务数: {item.task_count}</span>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                  {(!progress?.items || progress.items.length === 0) && <Empty description="暂无在制工序" />}
                </div>
              </ProCard>

              {/* 我的待办事项 */}
              <ProCard title="我的待办事项" extra={<Badge count={todos?.total} overflowCount={99} />} bordered style={dashboardCardStyle}>
                 <ProList
                    dataSource={todos?.items || []}
                    metas={{
                      title: { dataIndex: 'title' },
                      description: { dataIndex: 'description' },
                      subTitle: {
                        render: (_, record: any) => (
                           <Space>
                              <Tag color={record.priority === 'high' ? 'red' : 'blue'}>
                                {record.priority === 'high' ? '紧急' : '普通'}
                              </Tag>
                              <Text type="secondary">{dayjs(record.created_at).fromNow()}</Text>
                           </Space>
                        )
                      },
                      actions: {
                        render: (_, record: any) => [
                          <Link key="handle" href={record.link}>处理 <ArrowRightOutlined /></Link>
                        ]
                      }
                    }}
                 />
              </ProCard>
            </Space>
          </Col>

          {/* 右侧：实时广播与动态 */}
          <Col span={8}>
            <ProCard 
              title={<span><SoundOutlined /> 生产执行实时动态</span>} 
              bordered 
              headerBordered
              style={dashboardCardStyle}
            >
              {(!broadcast?.items || broadcast.items.length === 0) ? (
                <Empty description="暂无动态" />
              ) : (
                <Timeline 
                  mode="left" 
                  items={broadcast.items.map((item: any) => ({
                    key: item.id,
                    label: formatDateTime(item.created_at, 'HH:mm'),
                    color: item.unqualified_quantity > 0 ? 'red' : 'green',
                    content: (
                      <>
                        <Text strong>{item.operator_name}</Text> 在工序 <Text style={{ color: '#1890ff' }}>{item.process_name}</Text> 完成报工
                        <div style={{ marginTop: 4 }}>
                          <Text type="secondary">产品: {item.product_name}</Text>
                          <br />
                          <Badge status="success" text={`合格: ${item.qualified_quantity}`} />
                          {item.unqualified_quantity > 0 && (
                            <Badge status="error" text={` 不合格: ${item.unqualified_quantity}`} style={{ marginLeft: 16 }} />
                          )}
                        </div>
                      </>
                    )
                  }))}
                />
              )}
            </ProCard>

            <Divider dashed />

            {/* 快速入口 */}
            <ProCard title="快速协同入口" bordered headStyle={{ borderBottom: 'none' }} style={dashboardCardStyle}>
               <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Card size="small" hoverable style={{ textAlign: 'center', background: '#e6f7ff', ...dashboardCardStyle }}>
                        <ThunderboltOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                        <div style={{ marginTop: 8 }}>异常上报</div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" hoverable style={{ textAlign: 'center', background: '#f6ffed', ...dashboardCardStyle }}>
                        <CarryOutOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                        <div style={{ marginTop: 8 }}>工单报工</div>
                    </Card>
                  </Col>
               </Row>
            </ProCard>
          </Col>
        </Row>
      </Space>
    </UniDashboard>
  );
};

export default MESDashboard;
