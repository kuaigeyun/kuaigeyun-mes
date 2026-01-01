/**
 * RiverEdge SaaS 多组织框架 - 工作台页面
 *
 * 用户工作台，提供快捷入口、消息通知、待办事项等功能
 * 参考 Ant Design Pro 工作台最佳实践
 *
 * Author: Luigi Lu
 * Date: 2025-12-30
 */

import React from 'react';
import {
  Card,
  Row,
  Col,
  Avatar,
  Typography,
  Space,
  Tag,
  Button,
  Badge,
  Empty,
  App
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { DashboardTemplate, type QuickAction } from '../../../components/layout-templates';

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

// 快捷操作配置（转换为 DashboardTemplate 格式）
const getQuickActions = (navigate: (path: string) => void): QuickAction[] => [
  {
    title: '用户管理',
    icon: <UserOutlined />,
    onClick: () => navigate('/system/users'),
    type: 'default',
  },
  {
    title: '角色管理',
    icon: <TeamOutlined />,
    onClick: () => navigate('/system/roles'),
    type: 'default',
  },
  {
    title: '部门管理',
    icon: <ShopOutlined />,
    onClick: () => navigate('/system/departments'),
    type: 'default',
  },
];

/**
 * 工作台页面组件
 */
export default function DashboardPage() {
  const { message } = App.useApp();
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
    <DashboardTemplate
      quickActions={getQuickActions(navigate)}
    >
      {/* 欢迎区域 */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large">
          <Avatar size={64} style={{ backgroundColor: '#1890ff' }}>
            U
          </Avatar>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
              欢迎使用 RiverEdge SaaS
            </Title>
            <Text type="secondary">
              今天是 {dayjs().format('YYYY年MM月DD日 dddd')}
            </Text>
          </div>
        </Space>
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
              <Button
                type="link"
                size="small"
                onClick={() => {
                  message.info('通知中心功能开发中');
                }}
              >
                查看全部 <RightOutlined />
              </Button>
            }
            style={{ height: '100%' }}
          >
            {notifications && notifications.length > 0 ? (
              <div>
                {notifications.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px 0',
                      borderBottom: index < notifications.length - 1 ? '1px solid #f0f0f0' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                    }}
                    onClick={() => {
                      // TODO: 处理点击通知
                    }}
                  >
                    <Avatar
                      style={{
                        backgroundColor: item.read ? '#f0f0f0' : '#1890ff',
                        marginRight: 12,
                        flexShrink: 0,
                      }}
                    >
                      <BellOutlined />
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: 4 }}>
                        <Space>
                          <Text strong={!item.read}>{item.title}</Text>
                          {!item.read && <Badge dot />}
                        </Space>
                      </div>
                      <div style={{ marginBottom: 4 }}>{item.content}</div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />
                        {dayjs(item.time).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    </div>
                  </div>
                ))}
              </div>
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
              <Button
                type="link"
                size="small"
                onClick={() => {
                  message.info('待办事项功能开发中');
                }}
              >
                查看全部 <RightOutlined />
              </Button>
            }
            style={{ height: '100%' }}
          >
            {todos && todos.length > 0 ? (
              <div>
                {todos.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px 0',
                      borderBottom: index < todos.length - 1 ? '1px solid #f0f0f0' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                    }}
                    onClick={() => {
                      // TODO: 处理点击待办
                    }}
                  >
                    <Avatar
                      style={{
                        backgroundColor: '#f0f0f0',
                        marginRight: 12,
                        flexShrink: 0,
                      }}
                    >
                      <ClockCircleOutlined />
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text>{item.title}</Text>
                        <Tag color={priorityColorMap[item.priority]}>
                          {priorityTextMap[item.priority]}优先级
                        </Tag>
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        截止日期：{dayjs(item.dueDate).format('YYYY-MM-DD')}
                      </Text>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无待办事项" />
            )}
          </Card>
        </Col>
      </Row>
    </DashboardTemplate>
  );
}
