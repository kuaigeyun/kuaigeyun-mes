/**
 * RiverEdge SaaS 多租户框架 - 仪表盘页面
 *
 * 系统首页，展示系统概览信息和统计数据
 */

import { PageContainer } from '@ant-design/pro-components';
import { Card, Row, Col, Statistic, Progress, List, Avatar, Typography } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  RiseOutlined,
  FallOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useGlobalStore } from '@/app';

// 模拟数据API（实际项目中替换为真实API调用）
const fetchDashboardStats = async () => {
  // 模拟API调用延迟
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    totalUsers: 128,
    totalTenants: 12,
    totalDataRecords: 15420,
    installedPlugins: 8,
    userGrowth: 12.5,
    tenantGrowth: 8.3,
    activeUsers: 89,
    systemHealth: 98.5,
  };
};

const fetchRecentActivities = async () => {
  await new Promise(resolve => setTimeout(resolve, 800));

  return [
    {
      id: 1,
      type: 'user_created',
      message: '新用户注册：张三',
      time: '2025-11-19 14:30:00',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=张三',
    },
    {
      id: 2,
      type: 'tenant_created',
      message: '新租户注册：ABC科技有限公司',
      time: '2025-11-19 13:45:00',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=ABC',
    },
    {
      id: 3,
      type: 'plugin_installed',
      message: '插件安装：MES生产管理插件',
      time: '2025-11-19 12:20:00',
      avatar: 'https://api.dicebear.com/7.x/icons/svg?seed=plugin',
    },
  ];
};

/**
 * 仪表盘页面组件
 */
export default function DashboardPage() {
  const { currentUser } = useGlobalStore();
  const { Title, Text } = Typography;

  // 获取统计数据
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // 30秒刷新一次
  });

  // 获取最近活动
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ['recentActivities'],
    queryFn: fetchRecentActivities,
    refetchInterval: 60000, // 1分钟刷新一次
  });

  return (
    <PageContainer
      title="仪表盘"
      subTitle={`欢迎回来，${currentUser?.username || '用户'}`}
      breadcrumb={{}}
      extra={[
        <Text key="last-update" type="secondary">
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          数据更新时间：{new Date().toLocaleString()}
        </Text>
      ]}
    >
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="总用户数"
              value={stats?.totalUsers || 0}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              suffix={
                stats?.userGrowth ? (
                  <span style={{ color: '#52c41a', fontSize: '14px' }}>
                    <RiseOutlined /> +{stats.userGrowth}%
                  </span>
                ) : null
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="总租户数"
              value={stats?.totalTenants || 0}
              prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
              suffix={
                stats?.tenantGrowth ? (
                  <span style={{ color: '#52c41a', fontSize: '14px' }}>
                    <RiseOutlined /> +{stats.tenantGrowth}%
                  </span>
                ) : null
              }
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="数据总量"
              value={stats?.totalDataRecords || 0}
              prefix={<DatabaseOutlined style={{ color: '#fa8c16' }} />}
              suffix="条"
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="已安装插件"
              value={stats?.installedPlugins || 0}
              prefix={<AppstoreOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* 系统状态和活动 */}
      <Row gutter={[16, 16]}>
        {/* 系统健康状态 */}
        <Col xs={24} lg={12}>
          <Card
            title="系统健康状态"
            loading={statsLoading}
            extra={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <Progress
                    type="circle"
                    percent={stats?.systemHealth || 0}
                    strokeColor="#52c41a"
                    size={80}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text strong>系统健康度</Text>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ textAlign: 'center' }}>
                  <Progress
                    type="circle"
                    percent={((stats?.activeUsers || 0) / (stats?.totalUsers || 1)) * 100}
                    strokeColor="#1890ff"
                    size={80}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text strong>活跃用户率</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {stats?.activeUsers || 0} / {stats?.totalUsers || 0}
                    </Text>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 最近活动 */}
        <Col xs={24} lg={12}>
          <Card
            title="最近活动"
            loading={activitiesLoading}
            extra={<ClockCircleOutlined />}
          >
            <List
              dataSource={activities || []}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar src={item.avatar} size="small" />}
                    title={<Text strong>{item.message}</Text>}
                    description={
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {item.time}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 快速操作区域 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="快速操作">
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={8} lg={6}>
                <Card size="small" hoverable style={{ textAlign: 'center' }}>
                  <UserOutlined style={{ fontSize: '24px', color: '#1890ff', marginBottom: 8 }} />
                  <div>添加用户</div>
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={6}>
                <Card size="small" hoverable style={{ textAlign: 'center' }}>
                  <TeamOutlined style={{ fontSize: '24px', color: '#722ed1', marginBottom: 8 }} />
                  <div>创建租户</div>
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={6}>
                <Card size="small" hoverable style={{ textAlign: 'center' }}>
                  <AppstoreOutlined style={{ fontSize: '24px', color: '#52c41a', marginBottom: 8 }} />
                  <div>安装插件</div>
                </Card>
              </Col>
              <Col xs={12} sm={8} lg={6}>
                <Card size="small" hoverable style={{ textAlign: 'center' }}>
                  <DatabaseOutlined style={{ fontSize: '24px', color: '#fa8c16', marginBottom: 8 }} />
                  <div>数据备份</div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}

