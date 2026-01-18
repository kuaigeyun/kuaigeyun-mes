/**
 * RiverEdge SaaS 多组织框架 - 工作台页面
 *
 * 用户工作台，提供快捷入口、消息通知、待办事项等功能
 * 参考 Ant Design Pro 工作台最佳实践
 *
 * Author: Luigi Lu
 * Date: 2025-12-30
 */

import React, { useState, useMemo } from 'react';
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
  App,
  Modal,
  Tree,
  message as antdMessage,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  ShopOutlined,
  SettingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { DashboardTemplate, type QuickAction } from '../../../components/layout-templates';
import { getTodos, getStatistics, getDashboard, handleTodo, type TodoItem, type StatisticsResponse } from '../../../services/dashboard';
import { getMenuTree, type MenuTree } from '../../../services/menu';
import { getUserPreference, updateUserPreference } from '../../../services/userPreference';
import { ManufacturingIcons } from '../../../utils/manufacturingIcons';
import * as LucideIcons from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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


/**
 * 渲染菜单图标
 */
const renderMenuIcon = (menu: MenuTree): React.ReactNode => {
  if (!menu.icon) {
    return <ShopOutlined />;
  }

  // 尝试从 Lucide Icons 获取
  const lucideIconMap: Record<string, React.ComponentType<any>> = {
    'AppstoreOutlined': ManufacturingIcons.appstore,
    'ControlOutlined': ManufacturingIcons.control,
    'ShopOutlined': ManufacturingIcons.shop,
    'FileTextOutlined': ManufacturingIcons.fileCode,
    'DatabaseOutlined': ManufacturingIcons.database,
    'MonitorOutlined': ManufacturingIcons.monitor,
    'GlobalOutlined': ManufacturingIcons.global,
    'ApiOutlined': ManufacturingIcons.api,
    'CodeOutlined': ManufacturingIcons.code,
    'PrinterOutlined': ManufacturingIcons.printer,
    'HistoryOutlined': ManufacturingIcons.history,
    'UnorderedListOutlined': ManufacturingIcons.list,
    'CalendarOutlined': ManufacturingIcons.calendar,
    'PlayCircleOutlined': ManufacturingIcons.playCircle,
    'InboxOutlined': ManufacturingIcons.inbox,
    'SafetyOutlined': ManufacturingIcons.safety,
    'ShoppingOutlined': ManufacturingIcons.shop,
    'UserSwitchOutlined': ManufacturingIcons.userSwitch,
    'SettingOutlined': ManufacturingIcons.mdSettings,
    'BellOutlined': ManufacturingIcons.bell,
    'LoginOutlined': ManufacturingIcons.login,
    'UserOutlined': ManufacturingIcons.user,
    'TeamOutlined': ManufacturingIcons.team,
  };

  // 先检查预定义映射
  if (lucideIconMap[menu.icon]) {
    const IconComponent = lucideIconMap[menu.icon];
    return React.createElement(IconComponent, { size: 24 });
  }

  // 尝试直接从 Lucide Icons 中获取
  const iconName = menu.icon as string;
  let DirectIcon = (LucideIcons as any)[iconName];
  
  if (!DirectIcon) {
    const pascalCaseName = iconName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
    DirectIcon = (LucideIcons as any)[pascalCaseName];
  }

  if (DirectIcon) {
    return React.createElement(DirectIcon, { size: 24 });
  }

  // 默认图标
  return <ShopOutlined />;
};

/**
 * 将菜单树转换为树形数据
 */
const convertMenuTreeToTreeData = (menus: MenuTree[]): DataNode[] => {
  return menus
    .filter(menu => menu.path && !menu.is_external) // 只显示有路径且非外部链接的菜单
    .map(menu => ({
      title: menu.name,
      key: menu.uuid,
      icon: renderMenuIcon(menu),
      children: menu.children ? convertMenuTreeToTreeData(menu.children) : undefined,
      isLeaf: !menu.children || menu.children.length === 0,
    }));
};

/**
 * 快捷操作项接口（用于存储）
 */
interface QuickActionItem {
  menu_uuid: string;
  menu_name: string;
  menu_path: string;
  menu_icon?: string;
  sort_order: number;
}

/**
 * 工作台页面组件
 */
export default function DashboardPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedMenuKeys, setSelectedMenuKeys] = useState<React.Key[]>([]);

  // 获取通知（暂时保留模拟数据）
  const { data: notifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 60000,
  });

  // 获取待办事项（使用真实API）
  const { data: todosData, isLoading: todosLoading, refetch: refetchTodos } = useQuery({
    queryKey: ['dashboard-todos'],
    queryFn: () => getTodos(20),
    refetchInterval: 30000,
  });

  // 获取统计数据（使用真实API）
  const { data: statistics, isLoading: statisticsLoading } = useQuery({
    queryKey: ['dashboard-statistics'],
    queryFn: getStatistics,
    refetchInterval: 60000,
  });

  // 获取菜单树
  const { data: menuTree, isLoading: menuTreeLoading } = useQuery({
    queryKey: ['dashboard-menu-tree'],
    queryFn: () => getMenuTree({ is_active: true }),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 获取用户偏好设置
  const { data: userPreference, refetch: refetchUserPreference } = useQuery({
    queryKey: ['dashboard-user-preference'],
    queryFn: getUserPreference,
    staleTime: 5 * 60 * 1000,
  });

  // 更新用户偏好设置
  const updatePreferenceMutation = useMutation({
    mutationFn: (data: { preferences: Record<string, any> }) => updateUserPreference(data),
    onSuccess: () => {
      message.success('快捷操作配置已保存');
      refetchUserPreference();
      setConfigModalVisible(false);
    },
    onError: (error: any) => {
      message.error(`保存失败: ${error.message || '未知错误'}`);
    },
  });

  // 从菜单树中查找菜单项
  const findMenuInTree = (menus: MenuTree[], uuid: string): MenuTree | null => {
    for (const menu of menus) {
      if (menu.uuid === uuid) {
        return menu;
      }
      if (menu.children) {
        const found = findMenuInTree(menu.children, uuid);
        if (found) return found;
      }
    }
    return null;
  };

  // 构建快捷操作列表
  const quickActions = useMemo(() => {
    if (!userPreference?.preferences?.dashboard_quick_actions || !menuTree) {
      // 如果没有配置，返回默认快捷操作
      return [
        {
          title: '用户管理',
          icon: <UserOutlined />,
          onClick: () => navigate('/system/users'),
          type: 'default' as const,
        },
        {
          title: '角色管理',
          icon: <TeamOutlined />,
          onClick: () => navigate('/system/roles'),
          type: 'default' as const,
        },
        {
          title: '部门管理',
          icon: <ShopOutlined />,
          onClick: () => navigate('/system/departments'),
          type: 'default' as const,
        },
      ];
    }

    const actions: QuickActionItem[] = userPreference.preferences.dashboard_quick_actions;
    return actions
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((action) => {
        const menu = findMenuInTree(menuTree, action.menu_uuid);
        if (!menu || !menu.path) {
          return null;
        }

        return {
          title: action.menu_name || menu.name,
          icon: renderMenuIcon(menu),
          onClick: () => navigate(menu.path!),
          type: 'default' as const,
        };
      })
      .filter((action): action is QuickAction => action !== null);
  }, [userPreference, menuTree, navigate]);

  // 打开配置模态框
  const handleOpenConfig = () => {
    if (!userPreference?.preferences?.dashboard_quick_actions) {
      setSelectedMenuKeys([]);
    } else {
      const actions: QuickActionItem[] = userPreference.preferences.dashboard_quick_actions;
      setSelectedMenuKeys(actions.map(a => a.menu_uuid));
    }
    setConfigModalVisible(true);
  };

  // 保存快捷操作配置
  const handleSaveQuickActions = () => {
    if (!menuTree) return;

    const selectedMenus = selectedMenuKeys
      .map(key => findMenuInTree(menuTree, key as string))
      .filter((menu): menu is MenuTree => menu !== null && !!menu.path && !menu.is_external);

    const quickActions: QuickActionItem[] = selectedMenus.map((menu, index) => ({
      menu_uuid: menu.uuid,
      menu_name: menu.name,
      menu_path: menu.path!,
      menu_icon: menu.icon,
      sort_order: index,
    }));

    updatePreferenceMutation.mutate({
      preferences: {
        ...userPreference?.preferences,
        dashboard_quick_actions: quickActions,
      },
    });
  };

  // 处理待办事项
  const handleTodoMutation = useMutation({
    mutationFn: ({ todoId, action }: { todoId: string; action: string }) => handleTodo(todoId, action),
    onSuccess: (data: any) => {
      message.success(data.message || '处理成功');
      // 如果有跳转链接，自动跳转
      if (data.redirect) {
        navigate(data.redirect);
      } else {
        refetchTodos();
      }
    },
    onError: (error: any) => {
      message.error(`处理失败: ${error.message || '未知错误'}`);
    },
  });

  const todos = todosData?.items || [];

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

  // 树形数据
  const treeData = useMemo(() => {
    if (!menuTree) return [];
    return convertMenuTreeToTreeData(menuTree);
  }, [menuTree]);

  return (
    <>
      <DashboardTemplate
        quickActions={quickActions}
        showConfigButton={true}
        onConfigClick={handleOpenConfig}
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
                  // 跳转到待办事项列表页面（如果存在）或工单列表页面
                  navigate('/apps/kuaizhizao/production-execution/work-orders');
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
                      if (item.link) {
                        navigate(item.link);
                      }
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
                      {item.description && (
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
                          {item.description}
                        </Text>
                      )}
                      {item.due_date && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          截止日期：{dayjs(item.due_date).format('YYYY-MM-DD')}
                        </Text>
                      )}
                      <div style={{ marginTop: 8 }}>
                        <Button
                          size="small"
                          type="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTodoMutation.mutate({ todoId: item.id, action: 'handle' });
                          }}
                        >
                          处理
                        </Button>
                      </div>
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

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 生产统计 */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title="生产统计"
            loading={statisticsLoading}
            style={{ height: '100%', cursor: 'pointer' }}
            onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
          >
            {statistics?.production && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">工单总数</Text>
                  <Title level={2} style={{ margin: 0 }}>
                    {statistics.production.total}
                  </Title>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">已完成</Text>
                  <Title level={3} style={{ margin: 0, color: '#52c41a' }}>
                    {statistics.production.completed}
                  </Title>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">进行中</Text>
                  <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
                    {statistics.production.in_progress}
                  </Title>
                </div>
                <div>
                  <Text type="secondary">完成率</Text>
                  <Title level={3} style={{ margin: 0 }}>
                    {statistics.production.completion_rate}%
                  </Title>
                </div>
                {statistics.production.total > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: '已完成', value: statistics.production.completed },
                            { name: '进行中', value: statistics.production.in_progress },
                            { name: '其他', value: statistics.production.total - statistics.production.completed - statistics.production.in_progress },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill="#52c41a" />
                          <Cell fill="#1890ff" />
                          <Cell fill="#d9d9d9" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>

        {/* 库存统计 */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title="库存统计"
            loading={statisticsLoading}
            style={{ height: '100%', cursor: 'pointer' }}
            onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inventory')}
          >
            {statistics?.inventory && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">库存总量</Text>
                  <Title level={2} style={{ margin: 0 }}>
                    {statistics.inventory.total_quantity}
                  </Title>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">库存价值</Text>
                  <Title level={3} style={{ margin: 0 }}>
                    ¥{statistics.inventory.total_value.toLocaleString()}
                  </Title>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">周转率</Text>
                  <Title level={3} style={{ margin: 0 }}>
                    {statistics.inventory.turnover_rate}
                  </Title>
                </div>
                <div>
                  <Text type="secondary">预警数量</Text>
                  <Title level={3} style={{ margin: 0, color: statistics.inventory.alert_count > 0 ? '#ff4d4f' : '#52c41a' }}>
                    {statistics.inventory.alert_count}
                  </Title>
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* 质量统计 */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title="质量统计"
            loading={statisticsLoading}
            style={{ height: '100%', cursor: 'pointer' }}
            onClick={() => navigate('/apps/kuaizhizao/quality-management')}
          >
            {statistics?.quality && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">质量合格率</Text>
                  <Title level={2} style={{ margin: 0, color: statistics.quality.quality_rate >= 95 ? '#52c41a' : '#ff4d4f' }}>
                    {statistics.quality.quality_rate}%
                  </Title>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary">异常总数</Text>
                  <Title level={3} style={{ margin: 0 }}>
                    {statistics.quality.total_exceptions}
                  </Title>
                </div>
                <div>
                  <Text type="secondary">待处理异常</Text>
                  <Title level={3} style={{ margin: 0, color: statistics.quality.open_exceptions > 0 ? '#ff4d4f' : '#52c41a' }}>
                    {statistics.quality.open_exceptions}
                  </Title>
                </div>
                {statistics.quality.total_exceptions > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={[
                          { name: '总异常', value: statistics.quality.total_exceptions },
                          { name: '待处理', value: statistics.quality.open_exceptions },
                          { name: '已处理', value: statistics.quality.total_exceptions - statistics.quality.open_exceptions },
                        ]}
                      >
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#1890ff" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>
      </DashboardTemplate>

      {/* 快捷操作配置模态框 */}
      <Modal
        title="配置快捷操作"
        open={configModalVisible}
        onOk={handleSaveQuickActions}
        onCancel={() => setConfigModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
        confirmLoading={updatePreferenceMutation.isPending}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            请选择要添加到快捷操作的菜单项。只能选择有路径的菜单项。
          </Text>
        </div>
        <Tree
          checkable
          checkedKeys={selectedMenuKeys}
          onCheck={(checkedKeys) => {
            setSelectedMenuKeys(checkedKeys as React.Key[]);
          }}
          treeData={treeData}
          showIcon
          checkStrictly
          defaultExpandAll
          style={{ maxHeight: 400, overflow: 'auto' }}
        />
      </Modal>
    </>
  );
}
