/**
 * RiverEdge SaaS 多组织框架 - 工作台页面
 *
 * 用户工作台，提供快捷入口、消息通知、待办事项等功能
 * 参考 Ant Design Pro 工作台最佳实践
 */

import { PageContainer } from '@ant-design/pro-components';
import { 
  Card, 
  Row, 
  Col, 
  List, 
  Avatar, 
  Typography, 
  Space, 
  Tag,
  Button,
  Badge,
  Empty
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  FileTextOutlined,
  SettingOutlined,
  BellOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  ShopOutlined,
  ExperimentOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useGlobalStore } from '@/app';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// 模拟数据API（实际项目中替换为真实API调用）
const fetchNotifications = async () => {
  await new Promise(resolve => setTimeout(resolve, 800));
  return [
    {
      id: 1,
      type: 'system',
      title: '系统维护通知',
      content: '系统将于今晚 22:00-24:00 进行维护升级',
      time: '2025-11-19 14:30:00',
      read: false,
    },
    {
      id: 2,
      type: 'task',
      title: '生产计划审核',
      content: '您有 3 个生产计划待审核',
      time: '2025-11-19 13:45:00',
      read: false,
    },
    {
      id: 3,
      type: 'message',
      title: '新消息',
      content: '张三给您发送了一条消息',
      time: '2025-11-19 12:20:00',
      read: true,
    },
  ];
};

const fetchTodos = async () => {
  await new Promise(resolve => setTimeout(resolve, 800));
  return [
    {
      id: 1,
      title: '审核生产计划 #20251119001',
      priority: 'high',
      dueDate: '2025-11-20',
      status: 'pending',
    },
    {
      id: 2,
      title: '完成质量检验报告',
      priority: 'medium',
      dueDate: '2025-11-21',
      status: 'pending',
    },
    {
      id: 3,
      title: '更新库存盘点数据',
      priority: 'low',
      dueDate: '2025-11-22',
      status: 'pending',
    },
  ];
};

// 快捷操作配置
const quickActions = [
  {
    key: 'production',
    title: '生产管理',
    icon: <ShopOutlined />,
    path: '/mes/production',
    description: '生产计划、工单管理',
  },
  {
    key: 'quality',
    title: '质量管理',
    icon: <ExperimentOutlined />,
    path: '/mes/quality',
    description: '质检单、不良品管理',
  },
  {
    key: 'inventory',
    title: '库存管理',
    icon: <DatabaseOutlined />,
    path: '/mes/inventory',
    description: '原材料、成品库',
  },
  {
    key: 'users',
    title: '用户管理',
    icon: <UserOutlined />,
    path: '/users',
    description: '用户列表、权限管理',
  },
  {
    key: 'roles',
    title: '角色管理',
    icon: <TeamOutlined />,
    path: '/roles',
    description: '角色配置、权限分配',
  },
  {
    key: 'system',
    title: '系统配置',
    icon: <SettingOutlined />,
    path: '/system',
    description: '系统参数设置',
  },
];


/**
 * 工作台页面组件
 */
export default function DashboardPage() {
  const { currentUser } = useGlobalStore();
  const navigate = useNavigate();

  // 获取通知
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 60000,
  });

  // 获取待办事项
  const { data: todos, isLoading: todosLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
    refetchInterval: 30000,
  });

  // 未读通知数量
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  // 优先级颜色映射
  const priorityColorMap: Record<string, string> = {
    high: 'error',
    medium: 'warning',
    low: 'default',
  };

  // 优先级文本映射
  const priorityTextMap: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };

  return (
    <PageContainer
      title="工作台"
      breadcrumb={{}}
    >
      {/* 欢迎区域 */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large">
          <Avatar size={64} style={{ backgroundColor: '#1890ff' }}>
            {currentUser?.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
              欢迎回来，{currentUser?.username || '用户'}
            </Title>
            <Text type="secondary">
              今天是 {dayjs().format('YYYY年MM月DD日 dddd')}
            </Text>
          </div>
        </Space>
      </Card>

      {/* 快捷操作 */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            <span>快捷操作</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={[12, 12]}>
          {quickActions.map((action) => (
            <Col xs={12} sm={6} lg={3} key={action.key}>
              <Card
                hoverable
                onClick={() => navigate(action.path)}
                style={{
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
                bodyStyle={{ padding: '16px 8px' }}
              >
                <div
                  style={{
                    fontSize: '24px',
                    marginBottom: 8,
                    color: '#1890ff',
                  }}
                >
                  {action.icon}
                </div>
                <Text strong style={{ fontSize: '14px' }}>
                  {action.title}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 消息通知和待办事项 */}
      <Row gutter={[16, 16]}>
        {/* 消息通知 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <BellOutlined />
                <span>消息通知</span>
                {unreadCount > 0 && (
                  <Badge count={unreadCount} />
                )}
              </Space>
            }
            loading={notificationsLoading}
            extra={
              <Button type="link" size="small" onClick={() => navigate('/notifications')}>
                查看全部 <RightOutlined />
              </Button>
            }
            style={{ height: '100%' }}
          >
            {notifications && notifications.length > 0 ? (
              <List
                dataSource={notifications}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      padding: '12px 0',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      // TODO: 处理点击通知
                    }}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{
                            backgroundColor: item.read ? '#f0f0f0' : '#1890ff',
                          }}
                        >
                          <BellOutlined />
                        </Avatar>
                      }
                      title={
                        <Space>
                          <Text strong={!item.read}>{item.title}</Text>
                          {!item.read && <Badge dot />}
                        </Space>
                      }
                      description={
                        <div>
                          <div style={{ marginBottom: 4 }}>{item.content}</div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {dayjs(item.time).format('YYYY-MM-DD HH:mm')}
                          </Text>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无消息" />
            )}
          </Card>
        </Col>

        {/* 待办事项 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined />
                <span>待办事项</span>
                {todos && todos.length > 0 && (
                  <Badge count={todos.length} />
                )}
              </Space>
            }
            loading={todosLoading}
            extra={
              <Button type="link" size="small" onClick={() => navigate('/todos')}>
                查看全部 <RightOutlined />
              </Button>
            }
            style={{ height: '100%' }}
          >
            {todos && todos.length > 0 ? (
              <List
                dataSource={todos}
                renderItem={(item) => (
                  <List.Item
                    style={{
                      padding: '12px 0',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      // TODO: 处理点击待办
                    }}
                    actions={[
                      <Tag
                        key="priority"
                        color={priorityColorMap[item.priority]}
                      >
                        {priorityTextMap[item.priority]}优先级
                      </Tag>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{
                            backgroundColor: '#f0f0f0',
                          }}
                        >
                          <ClockCircleOutlined />
                        </Avatar>
                      }
                      title={
                        <Space>
                          <Text>{item.title}</Text>
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          截止日期：{dayjs(item.dueDate).format('YYYY-MM-DD')}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="暂无待办事项" />
            )}
          </Card>
        </Col>
      </Row>

    </PageContainer>
  );
}
