/**
 * RiverEdge SaaS 多组织框架 - 工作台页面
 *
 * 用户工作台，提供快捷入口、消息通知、待办事项等功能
 * 参考 Ant Design Pro 工作台最佳实践
 * 按照工作台设计规划文档实现
 *
 * Author: Luigi Lu
 * Date: 2026-01-21
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Tabs,

  message as antdMessage,
  theme,
  Segmented,
  DatePicker,
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

  PlayCircleOutlined,
  WarningOutlined,
  SafetyOutlined,
  FileTextOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  ShoppingOutlined,

  ArrowUpOutlined,
  AppstoreOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { DashboardTemplate, type QuickAction } from '../../../components/layout-templates';
import { QuickEntryGrid, type QuickEntryItem } from '../../../components/quick-entry/QuickEntryGrid';
import { 
  getTodos, 
  getStatistics, 
  getDashboard, 
  handleTodo, 
  getUserMessages,
  markMessagesRead,
  getProductionBroadcast,
  type TodoItem, 
  type StatisticsResponse,
  type NotificationItem,
  type ProductionBroadcastItem,
} from '../../../services/dashboard';
import { getMenuTree, type MenuTree } from '../../../services/menu';
import { getUserPreference } from '../../../services/userPreference';
import { useUserPreferenceStore } from '../../../stores/userPreferenceStore';
import { ManufacturingIcons } from '../../../utils/manufacturingIcons';
import { getAvatarUrl, getAvatarText } from '../../../utils/avatar';
import { useGlobalStore } from '../../../stores';
import { getUserInfo } from '../../../utils/auth';
import { getUserByUuid, getUserList } from '../../../services/user';
import WeatherWidget from '../../../components/weather/WeatherWidget';
import * as LucideIcons from 'lucide-react';

const { Title, Text } = Typography;
const { useToken } = theme;


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
      path: menu.path, // 添加path信息，供QuickEntryGrid使用
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

/** 工作台 TIPS 的 i18n 键（共 12 条，随机展示一条） */
const WORKPLACE_TIP_KEYS = [
  'pages.dashboard.tip1', 'pages.dashboard.tip2', 'pages.dashboard.tip3', 'pages.dashboard.tip4',
  'pages.dashboard.tip5', 'pages.dashboard.tip6', 'pages.dashboard.tip7', 'pages.dashboard.tip8',
  'pages.dashboard.tip9', 'pages.dashboard.tip10', 'pages.dashboard.tip11', 'pages.dashboard.tip12',
];

/**
 * 获取问候语 i18n 键（精细时间段划分，按北京时间）
 */
const getGreetingKey = (): string => {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6) return 'pages.dashboard.greetingEarlyMorning';
  if (hour >= 6 && hour < 9) return 'pages.dashboard.greetingMorning';
  if (hour >= 9 && hour < 12) return 'pages.dashboard.greetingLateMorning';
  if (hour >= 12 && hour < 13) return 'pages.dashboard.greetingNoon';
  if (hour >= 13 && hour < 17) return 'pages.dashboard.greetingAfternoon';
  if (hour >= 17 && hour < 18) return 'pages.dashboard.greetingEvening';
  return 'pages.dashboard.greetingNight';
};

/**
 * 工作台页面组件
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useToken();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [selectedMenuKeys, setSelectedMenuKeys] = useState<React.Key[]>([]);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  
  // 时间范围筛选器状态
  const [timeRange, setTimeRange] = useState<'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'last7days' | 'last30days' | 'custom'>('thisMonth');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  // 工作台小 TIPS：每 10 秒随机换一条（避免与当前相同）
  const [tipIndex, setTipIndex] = useState(() =>
    Math.floor(Math.random() * WORKPLACE_TIP_KEYS.length),
  );
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => {
        let next = Math.floor(Math.random() * WORKPLACE_TIP_KEYS.length);
        if (WORKPLACE_TIP_KEYS.length > 1) {
          while (next === prev) next = Math.floor(Math.random() * WORKPLACE_TIP_KEYS.length);
        }
        return next;
      });
    }, 10000);
    return () => clearInterval(timer);
  }, []);
  const currentTip = t(WORKPLACE_TIP_KEYS[tipIndex]);
  
  // 实时更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 获取用户信息
  const userInfo = useMemo(() => getUserInfo(), []);
  const userName = currentUser?.full_name || currentUser?.username || userInfo?.full_name || userInfo?.username || t('pages.dashboard.userFallback');

  const currentUsername = currentUser?.username || userInfo?.username;
  const currentUserUuid = (currentUser as any)?.uuid || userInfo?.uuid;

  // 获取用户详情（优先按 uuid）
  const { data: userDetail } = useQuery({
    queryKey: ['user-detail', currentUserUuid],
    queryFn: () => getUserByUuid(currentUserUuid as string),
    enabled: !!currentUserUuid && !((currentUser as any)?.is_infra_admin),
  });
  // 兜底：老会话可能没有 uuid，按用户名反查当前用户详情
  const { data: userDetailFallback } = useQuery({
    queryKey: ['user-detail-by-username', currentUsername],
    queryFn: async () => {
      const response = await getUserList({ username: currentUsername, page: 1, page_size: 20 });
      const exact = response.items.find((u: any) => u.username === currentUsername);
      return exact || response.items[0];
    },
    enabled: !currentUserUuid && !!currentUsername && !((currentUser as any)?.is_infra_admin),
  });
  const resolvedUserDetail = userDetail || userDetailFallback;
  const deptName =
    resolvedUserDetail?.department?.name ||
    (currentUser as any)?.department?.name ||
    userInfo?.department?.name ||
    (currentUser as any)?.department_name ||
    userInfo?.department_name;
  const positionName =
    resolvedUserDetail?.position?.name ||
    (currentUser as any)?.position?.name ||
    userInfo?.position?.name ||
    (currentUser as any)?.position_name ||
    userInfo?.position_name;
  const roleNames = (
    resolvedUserDetail?.roles ||
    (currentUser as any)?.roles ||
    userInfo?.roles ||
    []
  )
    .map((role: any) => (typeof role === 'string' ? role : role?.name))
    .filter(Boolean);
  const identityChips = [
    deptName ? { key: 'dept', text: deptName } : null,
    positionName ? { key: 'position', text: positionName } : null,
    roleNames.length ? { key: 'roles', text: roleNames.join('、') } : null,
  ].filter(Boolean) as Array<{ key: string; text: string }>;

  // 加载用户头像 - 使用与 BasicLayout 和 LockScreen 相同的逻辑
  useEffect(() => {
    const loadAvatarUrl = async () => {
      const userInfoFromStorage = getUserInfo();
      const avatarUuid = (currentUser as any)?.avatar || userInfoFromStorage?.avatar;
      
      if (avatarUuid) {
        try {
          const url = await getAvatarUrl(avatarUuid);
          if (url) {
            setAvatarUrl(url);
          } else {
            setAvatarUrl(undefined);
          }
        } catch (error) {
          console.error('加载头像 URL 失败:', error);
          setAvatarUrl(undefined);
        }
      } else {
        // 如果 currentUser 和 userInfo 都没有 avatar，尝试从个人资料 API 获取
        let foundAvatar = false;
        if (currentUser) {
          try {
            const { getUserProfile } = await import('../../../services/userProfile');
            const profile = await getUserProfile();
            if (profile.avatar) {
              const url = await getAvatarUrl(profile.avatar);
              if (url) {
                setAvatarUrl(url);
                foundAvatar = true;
              }
            }
          } catch (error) {
            // 静默失败，不影响其他功能
          }
        }
        
        // 只有在确实没有找到头像时才清空
        if (!foundAvatar) {
          setAvatarUrl(undefined);
        }
      }
    };
    
    if (currentUser) {
      loadAvatarUrl();
    }
  }, [currentUser]);

  // 获取用户消息通知（接入真实API）
  const { data: notifications, isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery({
    queryKey: ['user-messages'],
    queryFn: () => getUserMessages(1, 20, false), // 获取前20条消息，包括已读和未读
    refetchInterval: 60000, // 每60秒自动刷新
    retry: 2, // 失败时重试2次
    onError: (error: any) => {
      console.error('获取用户消息失败:', error);
      // 静默失败，不显示错误提示，避免影响用户体验
    },
  });

  // 获取待办事项（使用真实API）
  const { data: todosData, isLoading: todosLoading, refetch: refetchTodos } = useQuery({
    queryKey: ['dashboard-todos'],
    queryFn: () => getTodos(20),
    refetchInterval: 30000,
  });

  // 计算时间范围
  const getDateRange = useMemo(() => {
    const now = dayjs();
    switch (timeRange) {
      case 'today':
        return {
          dateStart: now.format('YYYY-MM-DD'),
          dateEnd: now.format('YYYY-MM-DD'),
        };
      case 'yesterday':
        const yesterday = now.subtract(1, 'day');
        return {
          dateStart: yesterday.format('YYYY-MM-DD'),
          dateEnd: yesterday.format('YYYY-MM-DD'),
        };
      case 'thisWeek':
        return {
          dateStart: now.startOf('week').format('YYYY-MM-DD'),
          dateEnd: now.endOf('week').format('YYYY-MM-DD'),
        };
      case 'thisMonth':
        return {
          dateStart: now.startOf('month').format('YYYY-MM-DD'),
          dateEnd: now.endOf('month').format('YYYY-MM-DD'),
        };
      case 'last7days':
        return {
          dateStart: now.subtract(6, 'day').format('YYYY-MM-DD'),
          dateEnd: now.format('YYYY-MM-DD'),
        };
      case 'last30days':
        return {
          dateStart: now.subtract(29, 'day').format('YYYY-MM-DD'),
          dateEnd: now.format('YYYY-MM-DD'),
        };
      case 'custom':
        if (customDateRange && customDateRange[0] && customDateRange[1]) {
          return {
            dateStart: customDateRange[0].format('YYYY-MM-DD'),
            dateEnd: customDateRange[1].format('YYYY-MM-DD'),
          };
        }
        return {
          dateStart: now.format('YYYY-MM-DD'),
          dateEnd: now.format('YYYY-MM-DD'),
        };
      default:
        return {
          dateStart: now.format('YYYY-MM-DD'),
          dateEnd: now.format('YYYY-MM-DD'),
        };
    }
  }, [timeRange, customDateRange]);

  // 获取统计数据（使用真实API）
  const { data: statistics, isLoading: statisticsLoading } = useQuery({
    queryKey: ['dashboard-statistics', getDateRange.dateStart, getDateRange.dateEnd],
    queryFn: () => getStatistics(getDateRange.dateStart, getDateRange.dateEnd),
    refetchInterval: 60000,
  });

  // 获取菜单树
  const { data: menuTree, isLoading: menuTreeLoading } = useQuery({
    queryKey: ['dashboard-menu-tree'],
    queryFn: () => getMenuTree({ is_active: true }),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 获取生产实时播报
  const { data: productionBroadcast, isLoading: productionBroadcastLoading } = useQuery({
    queryKey: ['dashboard-production-broadcast'],
    queryFn: () => getProductionBroadcast(10),
    refetchInterval: 30000, // 每30秒自动刷新
  });

  // 获取用户偏好设置
  const { data: userPreference, refetch: refetchUserPreference } = useQuery({
    queryKey: ['dashboard-user-preference'],
    queryFn: getUserPreference,
    staleTime: 5 * 60 * 1000,
  });

  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);

  // 更新用户偏好设置（通过 store 统一入口，避免与 userPreferenceStore 不同步）
  const updatePreferenceMutation = useMutation({
    mutationFn: async (prefs: Record<string, any>) => {
      await updatePreferences(prefs);
    },
    onSuccess: () => {
      message.success(t('pages.dashboard.quickActionsSaved'));
      refetchUserPreference();
      setConfigModalVisible(false);
    },
    onError: (error: any) => {
      message.error(t('pages.dashboard.saveFailed', { message: error.message || t('pages.dashboard.unknownError') }));
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
          title: t('menu.system.users'),
          icon: <UserOutlined />,
          onClick: () => navigate('/system/users'),
          type: 'default' as const,
        },
        {
          title: t('menu.system.roles'),
          icon: <TeamOutlined />,
          onClick: () => navigate('/system/roles'),
          type: 'default' as const,
        },
        {
          title: t('menu.system.departments'),
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
  }, [userPreference, menuTree, navigate, t]);

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
      dashboard_quick_actions: quickActions,
    });
  };

  // 处理待办事项
  const handleTodoMutation = useMutation({
    mutationFn: ({ todoId, action }: { todoId: string; action: string }) => handleTodo(todoId, action),
    onSuccess: (data: any) => {
      message.success(data.message || t('pages.dashboard.handleSuccess'));
      // 如果有跳转链接，自动跳转
      if (data.redirect) {
        navigate(data.redirect);
      } else {
        refetchTodos();
      }
    },
    onError: (error: any) => {
      message.error(t('pages.dashboard.handleFailed', { message: error.message || t('pages.dashboard.unknownError') }));
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

  // 优先级文本映射（i18n）
  const priorityTextMap: Record<string, string> = useMemo(() => ({
    high: t('pages.dashboard.priorityHigh'),
    medium: t('pages.dashboard.priorityMedium'),
    low: t('pages.dashboard.priorityLow'),
  }), [t]);

  // 树形数据
  const treeData = useMemo(() => {
    if (!menuTree) return [];
    return convertMenuTreeToTreeData(menuTree);
  }, [menuTree]);

  return (
    <>
      <DashboardTemplate
        quickActions={[]}
        showConfigButton={false}
      >
      {/* 欢迎条+指标条+4卡 占满 uni-tabs-content 高度，不滚动，布局固定 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 欢迎区域 - 增强设计 */}
      <Card
        style={{
          marginTop: 0,
          marginBottom: 22,
          flexShrink: 0,
          background: `linear-gradient(135deg, ${token.colorPrimary} 0%, ${token.colorPrimary}dd 100%)`,
          border: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
        styles={{ body: { padding: '32px 24px' } }}
        className="welcome-banner-card"
      >
        <Row align="middle" justify="space-between">
          <Col flex="auto">
            <Space size="large">
              <span
                style={{
                  display: 'inline-flex',
                  padding: 4,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.95)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), inset 0 0 0 2px rgba(255, 255, 255, 0.5)',
                }}
              >
                <Avatar
                  size={64}
                  src={avatarUrl}
                  style={{
                    backgroundColor: avatarUrl ? 'transparent' : '#ffffff',
                    color: token.colorPrimary,
                    fontSize: 24,
                    fontWeight: 'bold',
                  }}
                >
                  {!avatarUrl && getAvatarText(currentUser?.full_name || userInfo?.full_name, currentUser?.username || userInfo?.username)}
                </Avatar>
              </span>
              <div>
                <Title 
                  level={3} 
                  style={{ 
                    margin: 0, 
                    marginBottom: 8,
                    color: '#ffffff',
                  }}
                >
                  {t(getGreetingKey())}，{userName}
                </Title>
                <Space size="middle" wrap>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 14 }}>
                    {currentTime.format(t('pages.dashboard.dateFormatFull'))}
                  </Text>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 14, fontWeight: 500 }}>
                    {currentTime.format('HH:mm:ss')}
                  </Text>
                  {identityChips.map((chip) => (
                    <Tag
                      key={chip.key}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        color: '#ffffff',
                        background: 'rgba(255, 255, 255, 0.16)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 999,
                        padding: '2px 10px',
                        marginInlineEnd: 0,
                      }}
                    >
                      {chip.text}
                    </Tag>
                  ))}
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            <Row align="middle" gutter={24}>
              {/* 天气预报 */}
              <Col>
                <WeatherWidget />
              </Col>
              

            </Row>
          </Col>
        </Row>
      </Card>

      {/* 生产指标 - 参考设计 */}
      <div style={{ marginBottom: 22, flexShrink: 0 }}>
        {/* 左侧 TIPS + 右侧时间范围筛选器 */}
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col flex="1" style={{ minWidth: 0 }}>
            <Space size="small" style={{ color: token.colorTextSecondary, fontSize: 13 }} align="start">
              <BulbOutlined style={{ color: token.colorWarning, marginTop: 2 }} />
              <span
                key={tipIndex}
                style={{
                  display: 'inline-block',
                  maxWidth: '100%',
                  animation: 'workplace-tip-in 0.4s ease-out',
                }}
              >
                <Text type="secondary" ellipsis style={{ maxWidth: '100%', display: 'block' }}>
                  {currentTip}
                </Text>
              </span>
            </Space>
            <style>{`
              @keyframes workplace-tip-in {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </Col>
          <Col>
            <Space>
              <Segmented
                value={timeRange}
                onChange={(value) => {
                  setTimeRange(value as typeof timeRange);
                  if (value !== 'custom') {
                    setCustomDateRange(null);
                  }
                }}
                options={[
                  { label: t('pages.dashboard.timeToday'), value: 'today' },
                  { label: t('pages.dashboard.timeYesterday'), value: 'yesterday' },
                  { label: t('pages.dashboard.timeThisWeek'), value: 'thisWeek' },
                  { label: t('pages.dashboard.timeThisMonth'), value: 'thisMonth' },
                  { label: t('pages.dashboard.timeLast7Days'), value: 'last7days' },
                  { label: t('pages.dashboard.timeLast30Days'), value: 'last30days' },
                  { label: t('pages.dashboard.timeCustom'), value: 'custom' },
                ]}
              />
              {timeRange === 'custom' && (
                <DatePicker.RangePicker
                  value={customDateRange}
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setCustomDateRange([dates[0], dates[1]]);
                    } else {
                      setCustomDateRange(null);
                    }
                  }}
                  format="YYYY-MM-DD"
                />
              )}
            </Space>
          </Col>
        </Row>

        {/* 生产指标卡片 - 参考设计，渐变背景，白色文字 */}
        <Row gutter={[16, 16]} style={{ display: 'flex', alignItems: 'stretch' }}>
        {/* 工单总数 */}
        <Col xs={24} sm={12} md={8} lg={8} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
          <Card
            hoverable
            loading={statisticsLoading}
            style={{
              borderRadius: token.borderRadius,
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
            styles={{ body: { padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 } }}
            onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
          >
            {/* 背景图标 */}
            <FileTextOutlined 
              style={{ 
                position: 'absolute',
                right: 16,
                top: 16,
                fontSize: 80,
                color: 'rgba(255, 255, 255, 0.15)',
                zIndex: 0,
              }} 
            />
            <Space orientation="vertical" size="small" style={{ width: '100%', flex: 1, position: 'relative', zIndex: 2 }}>
              <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: 500 }}>
                {t('pages.dashboard.statWorkOrderTotal')}
              </Text>
              <Title level={2} style={{ margin: 0, color: '#ffffff', fontWeight: 700 }}>
                {statistics?.production?.total || 0}
                <Text style={{ fontSize: 20, fontWeight: 'normal', marginLeft: 4, color: '#ffffff' }}>{t('pages.dashboard.unitOrder')}</Text>
              </Title>
            </Space>
          </Card>
        </Col>

        {/* 进行中工单 */}
        <Col xs={24} sm={12} md={8} lg={8} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
          <Card
            hoverable
            loading={statisticsLoading}
            style={{
              borderRadius: token.borderRadius,
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
            styles={{ body: { padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 } }}
            onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders?status=in_progress')}
          >
            {/* 背景图标 */}
            <PlayCircleOutlined 
              style={{ 
                position: 'absolute',
                right: 16,
                top: 16,
                fontSize: 80,
                color: 'rgba(255, 255, 255, 0.15)',
                zIndex: 0,
              }} 
            />
            <Space orientation="vertical" size="small" style={{ width: '100%', flex: 1, position: 'relative', zIndex: 2 }}>
              <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: 500 }}>
                {t('pages.dashboard.statWorkOrderInProgress')}
              </Text>
              <Title level={2} style={{ margin: 0, color: '#ffffff', fontWeight: 700 }}>
                {statistics?.production?.in_progress || 0}
                <Text style={{ fontSize: 20, fontWeight: 'normal', marginLeft: 4, color: '#ffffff' }}>{t('pages.dashboard.unitOrder')}</Text>
              </Title>
            </Space>
          </Card>
        </Col>

        {/* 工单完成率 */}
        <Col xs={24} sm={12} md={8} lg={8} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
          <Card
            hoverable
            loading={statisticsLoading}
            style={{
              borderRadius: token.borderRadius,
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
            styles={{ body: { padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 } }}
            onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders?status=completed')}
          >
            {/* 背景图标 */}
            <CheckCircleOutlined 
              style={{ 
                position: 'absolute',
                right: 16,
                top: 16,
                fontSize: 80,
                color: 'rgba(255, 255, 255, 0.15)',
                zIndex: 0,
              }} 
            />
            <Space orientation="vertical" size="small" style={{ width: '100%', flex: 1, position: 'relative', zIndex: 2 }}>
              <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: 500 }}>
                {t('pages.dashboard.statWorkOrderCompletion')}
              </Text>
              <Title level={2} style={{ margin: 0, color: '#ffffff', fontWeight: 700 }}>
                {statistics?.production?.completion_rate || 0}%
              </Title>
            </Space>
          </Card>
        </Col>

        {/* 完工数量 */}
        <Col xs={24} sm={12} md={8} lg={8} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
          <Card
            hoverable
            loading={statisticsLoading}
            style={{
              borderRadius: token.borderRadius,
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
            styles={{ body: { padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 } }}
            onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
          >
            {/* 背景图标 */}
            <CheckCircleOutlined 
              style={{ 
                position: 'absolute',
                right: 16,
                top: 16,
                fontSize: 80,
                color: 'rgba(255, 255, 255, 0.15)',
                zIndex: 0,
              }} 
            />
            <Space orientation="vertical" size="small" style={{ width: '100%', flex: 1, position: 'relative', zIndex: 2 }}>
              <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: 500 }}>
                {t('pages.dashboard.statCompletedQuantity')}
              </Text>
              <Title level={2} style={{ margin: 0, color: '#ffffff', fontWeight: 700 }}>
                {statistics?.production?.completed_quantity || 0}
                <Text style={{ fontSize: 20, fontWeight: 'normal', marginLeft: 4, color: '#ffffff' }}>{t('pages.dashboard.unitPiece')}</Text>
              </Title>
            </Space>
          </Card>
        </Col>

        {/* 产能达成率 */}
        <Col xs={24} sm={12} md={8} lg={8} style={{ display: 'flex', flex: 1, minWidth: 0 }}>
          <Card
            hoverable
            loading={statisticsLoading}
            style={{
              borderRadius: token.borderRadius,
              border: 'none',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
            styles={{ body: { padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 } }}
            onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
          >
            {/* 背景图标 */}
            <BarChartOutlined 
              style={{ 
                position: 'absolute',
                right: 16,
                top: 16,
                fontSize: 80,
                color: 'rgba(255, 255, 255, 0.15)',
                zIndex: 0,
              }} 
            />
            <Space orientation="vertical" size="small" style={{ width: '100%', flex: 1, position: 'relative', zIndex: 2 }}>
              <Text style={{ fontSize: 14, color: '#ffffff', fontWeight: 500 }}>
                {t('pages.dashboard.statCapacityRate')}
              </Text>
              <Title level={2} style={{ margin: 0, color: '#ffffff', fontWeight: 700 }}>
                {statistics?.production?.capacity_achievement_rate || 0}%
              </Title>
            </Space>
          </Card>
        </Col>

        </Row>
      </div>

      {/* 快捷入口、生产实时播报、待办事项、消息通知 - calc 高度正好适配视口，无滚动 */}
      <Row 
        gutter={[16, 16]} 
        className="dashboard-four-cards-row"
        style={{ 
          height: 'calc(100vh - 56px - 30px - 192px - 198px)',
          minHeight: 0,
          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        <style>{`
          .dashboard-four-cards-row .ant-col { display: flex; height: 100%; }
          .dashboard-four-cards-row .ant-card { height: 100%; display: flex; flex-direction: column; }
          .dashboard-four-cards-row .ant-card .ant-card-body { flex: 1; overflow: auto; min-height: 0; }
        `}</style>
        {/* 快捷入口 - iOS风格（占25%） */}
        <Col xs={24} sm={12} md={6} lg={6} style={{ display: 'flex' }}>
          <QuickEntryGrid
            title={
              <Space>
                <AppstoreOutlined />
                <span>{t('pages.dashboard.quickEntry')}</span>
              </Space>
            }
            items={useMemo(() => {
              // 从用户偏好设置中获取快捷入口配置
              const quickEntries = userPreference?.preferences?.dashboard_quick_entries as QuickEntryItem[] | undefined;
              
              if (quickEntries && quickEntries.length > 0 && menuTree) {
                return quickEntries
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((entry) => {
                    const menu = findMenuInTree(menuTree, entry.menu_uuid);
                    if (!menu || !menu.path) return null;
                    
                    return {
                      ...entry,
                      menu_name: entry.menu_name || menu.name,
                      menu_path: entry.menu_path || menu.path,
                      menu_icon: renderMenuIcon(menu),
                    };
                  })
                  .filter((item): item is QuickEntryItem => item !== null);
              }
              
              // 默认快捷入口
              const defaultEntries: QuickEntryItem[] = [
                { menu_uuid: 'work-orders', menu_name: t('pages.dashboard.defaultWorkOrders'), menu_path: '/apps/kuaizhizao/production-execution/work-orders', menu_icon: <FileTextOutlined />, sort_order: 0 },
                { menu_uuid: 'inventory', menu_name: t('pages.dashboard.defaultInventory'), menu_path: '/apps/kuaizhizao/warehouse-management/inventory', menu_icon: <DatabaseOutlined />, sort_order: 1 },
                { menu_uuid: 'quality', menu_name: t('pages.dashboard.defaultQuality'), menu_path: '/apps/kuaizhizao/quality-management', menu_icon: <SafetyOutlined />, sort_order: 2 },
                { menu_uuid: 'equipment', menu_name: t('pages.dashboard.defaultEquipment'), menu_path: '/apps/kuaizhizao/equipment-management/equipment', menu_icon: <SettingOutlined />, sort_order: 3 },
                { menu_uuid: 'plan', menu_name: t('pages.dashboard.defaultPlan'), menu_path: '/apps/kuaizhizao/plan-management', menu_icon: <CheckCircleOutlined />, sort_order: 4 },
              ];
              
              return defaultEntries;
            }, [userPreference, menuTree, t])}
            menuTree={useMemo(() => {
              if (!menuTree) return [];
              return convertMenuTreeToTreeData(menuTree);
            }, [menuTree])}
            showConfig={true}
            onSave={async (items: QuickEntryItem[]) => {
              await updatePreferences({ dashboard_quick_entries: items });
              queryClient.invalidateQueries({ queryKey: ['dashboard-user-preference'] });
            }}
            renderMenuIcon={(menuUuid: string) => {
              if (!menuTree) return <ShopOutlined />;
              const menu = findMenuInTree(menuTree, menuUuid);
              return menu ? renderMenuIcon(menu) : <ShopOutlined />;
            }}
          />
        </Col>

        {/* 实时播报（占25%） */}
        <Col xs={24} sm={12} md={6} lg={6} style={{ display: 'flex' }}>
          <Card
            title={
              <Space>
                <PlayCircleOutlined />
                <span>{t('pages.dashboard.realtimeReport')}</span>
              </Space>
            }
            loading={productionBroadcastLoading}
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => {
                  navigate('/apps/kuaizhizao/production-execution/reporting');
                }}
              >
                {t('pages.dashboard.viewMore')} <RightOutlined />
              </Button>
            }
            style={{ width: '100%' }}
            styles={{ 
              body: {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                padding: '0 24px 24px 24px',
                minHeight: 0,
              }
            }}
          >
            {productionBroadcast && productionBroadcast.length > 0 ? (
              <div>
                {productionBroadcast.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 0',
                      borderBottom: index < productionBroadcast.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      navigate(`/apps/kuaizhizao/production-execution/reporting?work_order=${item.work_order_no}`);
                    }}
                  >
                    <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <Text strong style={{ fontSize: 13 }}>
                          {item.operator_name} | {item.process_name}
                        </Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.created_at ? dayjs(item.created_at).format('MM-DD HH:mm') : item.date}
                      </Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      {t('pages.dashboard.labelWorkOrderNo')}：{item.work_order_no}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      {t('pages.dashboard.labelProduct')}：{item.product_code} | {item.product_name}
                    </Text>
                    <Space>
                      <Text type="success" style={{ fontSize: 12 }}>
                        {t('pages.dashboard.qualified')} {item.qualified_quantity.toFixed(0)}
                      </Text>
                      {item.unqualified_quantity > 0 && (
                        <Text type="danger" style={{ fontSize: 12 }}>
                          {t('pages.dashboard.unqualified')} {item.unqualified_quantity.toFixed(0)}
                        </Text>
                      )}
                    </Space>
                  </div>
                ))}
              </div>
            ) : (
              <Empty 
                description={t('pages.dashboard.emptyBroadcast')} 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '40px 0' }}
              />
            )}
          </Card>
        </Col>

        {/* 待办事项（占25%） */}
        <Col xs={24} sm={12} md={6} lg={6} style={{ display: 'flex' }}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined />
                <span>{t('pages.dashboard.todoList')}</span>
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
                  navigate('/apps/kuaizhizao/production-execution/work-orders');
                }}
              >
                {t('pages.dashboard.viewAll')} <RightOutlined />
              </Button>
            }
            style={{ width: '100%' }}
            styles={{ 
              body: {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                padding: '0 24px 24px 24px',
                minHeight: 0,
              }
            }}
          >
            <Tabs
              defaultActiveKey="all"
              items={[
                {
                  key: 'all',
                  label: `${t('pages.dashboard.tabAll')} (${todos.length})`,
                  children: (
                    <div style={{ flex: 1, overflow: 'auto', maxHeight: '400px' }}>
                      {todos.length > 0 ? (
                        <div>
                          {todos.slice(0, 5).map((item, index) => (
                            <div
                              key={index}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todos.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                                  backgroundColor: token.colorPrimaryBg,
                                  color: token.colorPrimary,
                                  marginRight: 12,
                                  flexShrink: 0,
                                }}
                              >
                                <ClockCircleOutlined />
                              </Avatar>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text strong={item.priority === 'high'}>{item.title}</Text>
                                  <Tag color={priorityColorMap[item.priority]}>
                                    {priorityTextMap[item.priority]}{t('pages.dashboard.priorityLabel')}
                                  </Tag>
                                </div>
                                {item.description && (
                                  <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>
                                    {item.description}
                                  </Text>
                                )}
                                {item.due_date && (
                                  <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {t('pages.dashboard.dueDate')}：{dayjs(item.due_date).format('YYYY-MM-DD')}
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
                                    {t('pages.dashboard.handle')}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty description={t('pages.dashboard.emptyTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'work_order',
                  label: `${t('pages.dashboard.tabWorkOrder')} (${todos.filter(t => t.type === 'work_order').length})`,
                  children: (
                    <div>
                      {todos.filter(t => t.type === 'work_order').length > 0 ? (
                        <div>
                          {todos.filter(t => t.type === 'work_order').slice(0, 5).map((item, index) => (
                            <div
                              key={index}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todos.filter(t => t.type === 'work_order').length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
                                cursor: 'pointer',
                              }}
                              onClick={() => item.link && navigate(item.link)}
                            >
                              <Text>{item.title}</Text>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty description={t('pages.dashboard.emptyWorkOrderTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'exception',
                  label: `${t('pages.dashboard.tabException')} (${todos.filter(t => t.type === 'exception').length})`,
                  children: (
                    <div>
                      {todos.filter(t => t.type === 'exception').length > 0 ? (
                        <div>
                          {todos.filter(t => t.type === 'exception').slice(0, 5).map((item, index) => (
                            <div
                              key={index}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todos.filter(t => t.type === 'exception').length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
                                cursor: 'pointer',
                              }}
                              onClick={() => item.link && navigate(item.link)}
                            >
                              <Text>{item.title}</Text>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty description={t('pages.dashboard.emptyExceptionTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* 消息通知（占25%） */}
        <Col xs={24} sm={12} md={6} lg={6} style={{ display: 'flex' }}>
          <Card
            title={
              <Space>
                <BellOutlined />
                <span>{t('pages.dashboard.messageNotify')}</span>
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
                  navigate('/personal/messages');
                }}
              >
                {t('pages.dashboard.viewAll')} <RightOutlined />
              </Button>
            }
            style={{ width: '100%' }}
            styles={{ 
              body: {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                padding: '0 24px 24px 24px',
                minHeight: 0,
              }
            }}
          >
            {notifications && notifications.length > 0 ? (
              <div>
                {notifications.slice(0, 5).map((item, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px 0',
                      borderBottom: index < Math.min(notifications.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={async () => {
                      // 点击通知时标记为已读
                      if (!item.read) {
                        try {
                          await markMessagesRead([item.id]);
                          // 刷新通知列表
                          refetchNotifications();
                        } catch (error) {
                          console.error('标记消息已读失败:', error);
                        }
                      }
                    }}
                  >
                    <div style={{ marginBottom: 4 }}>
                      <Space>
                        <Text strong={!item.read} style={{ fontSize: 13 }}>{item.title}</Text>
                        {!item.read && <Badge dot />}
                      </Space>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                      {item.content}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(item.time).format('MM-DD HH:mm')}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description={t('pages.dashboard.emptyMessage')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>
      </div>

      </DashboardTemplate>

      {/* 快捷操作配置模态框 */}
      <Modal
        title={t('pages.dashboard.configQuickActions')}
        open={configModalVisible}
        onOk={handleSaveQuickActions}
        onCancel={() => setConfigModalVisible(false)}
        okText={t('pages.dashboard.save')}
        cancelText={t('pages.dashboard.cancel')}
        width={600}
        confirmLoading={updatePreferenceMutation.isPending}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            {t('pages.dashboard.configQuickActionsHint')}
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
