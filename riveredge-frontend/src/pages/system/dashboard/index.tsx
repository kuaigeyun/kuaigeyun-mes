/**
 * RiverEdge SaaS 多组织框架 - 工作台页面
 *
 * 用户工作台，提供快捷入口、待办事项等功能（消息入口在顶栏）
 * 参考 Ant Design Pro 工作台最佳实践
 * 按照工作台设计规划文档实现
 *
 * Author: Luigi Lu
 * Date: 2026-01-21
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeDashboardTodos } from '../../../utils/dashboardTodoI18n';
import {
  Card,
  Row,
  Col,
  Grid,
  Avatar,
  Typography,
  Space,
  Button,
  Badge,
  Empty,
  App,
  theme,
  Tabs,
} from 'antd';
import {
  ClockCircleOutlined,
  RightOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { DashboardTemplate } from '../../../components/layout-templates';
import { PAGE_SPACING } from '../../../components/layout-templates/constants';
import { QuickEntryGrid, type QuickEntryItem } from '../../../components/quick-entry/QuickEntryGrid';
import {
  resolveQuickEntryDisplayItems,
  findMenuInTree,
} from '../../../components/quick-entry/quickEntryItems';
import { convertMenuTreeToTreeData } from '../../../components/quick-entry/convertMenuTreeToTreeData';
import { renderQuickEntryMenuIcon } from '../../../components/quick-entry/renderQuickEntryMenuIcon';
import { 
  getTodos, 
  getStatistics, 
  handleTodo, 
  getProductionBroadcast,
  type TodoItem,
  type TodoListResponse,
  type ProductionBroadcastItem,
} from '../../../services/dashboard';
import { useNavigationMenuTreeQuery } from '../../../hooks/useNavigationMenuTreeQuery';
import {
  extractAppCodeFromPath,
  getAppDisplayName,
  translateAppMenuItemName,
  translateMenuName,
} from '../../../utils/menuTranslation';
import type { UserPreference } from '../../../services/userPreference';
import { useUserPreferenceStore } from '../../../stores/userPreferenceStore';
import { getAvatarUrl, getAvatarText, getCachedAvatarUrl } from '../../../utils/avatar';
import { useGlobalStore } from '../../../stores';
import { useThemeStore } from '../../../stores/themeStore';
import { getUserInfo } from '../../../utils/auth';
import { getUserByUuid, getUserList } from '../../../services/user';
import { getWeatherAdaptiveTint } from '../../../components/weather/weatherBackground';
import type { WeatherData } from '../../../services/weather';
import { formatLunarDate } from '../../../utils/lunarDate';
import {
  DashboardCalendarWeatherClock,
  DASHBOARD_CALENDAR_WIDGET_HEIGHT,
} from './DashboardCalendarWeatherClock';
import { DashboardWelcomeBar } from './DashboardWelcomeBar';
import { DashboardSectionCard } from './DashboardSectionCard';
import { formatTimeInTimezone } from '../../../utils/formatTimeInTimezone';
import { formatDateTime } from '../../../utils/format';
import { getPlatformVersion } from '../../../services/platformSettings';
import { useConfigStore } from '../../../stores/configStore';
import DashboardKpiPanel, {
  type DashboardTimeRange,
} from './DashboardKpiPanel';
import DashboardOperationCardsPanel from './DashboardOperationCardsPanel';
import { DashboardUsageTipsCarousel } from './DashboardUsageTipsCarousel';
import { MobileWorkplace } from './MobileWorkplace';
import { useTouchScreen } from '../../../hooks/useTouchScreen';
import { useAutoGuide } from '../../../components/onboarding-guide/useAutoGuide';



const { Title, Text } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;


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

function ProductionBroadcastOperatorAvatar({
  avatarUuid,
  displayName,
}: {
  avatarUuid?: string | null;
  displayName: string;
}) {
  const { token } = useToken();
  const [src, setSrc] = useState<string | undefined>(() =>
    avatarUuid ? getCachedAvatarUrl(avatarUuid) : undefined,
  );

  useEffect(() => {
    if (!avatarUuid) {
      setSrc(undefined);
      return;
    }
    const cached = getCachedAvatarUrl(avatarUuid);
    if (cached) {
      setSrc(cached);
      return;
    }
    let cancelled = false;
    getAvatarUrl(avatarUuid)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [avatarUuid]);

  return (
    <Avatar
      size={30}
      src={src}
      style={{
        backgroundColor: token.colorPrimaryBg,
        color: token.colorPrimary,
        flexShrink: 0,
      }}
    >
      {getAvatarText(displayName)}
    </Avatar>
  );
}

/** 待办 Tabs：数量为 0 的分类不展示；有数据时显示「分类 (数量)」 */
function formatDashboardTodoTabLabel(title: string, count: number): string {
  return count > 0 ? `${title} (${count})` : title;
}

function filterDashboardTodoTabItems<T extends { key: string }>(
  items: T[],
  countByKey: Record<string, number>,
): T[] {
  return items.filter((tab) => tab.key === 'all' || (countByKey[tab.key] ?? 0) > 0);
}

function renderDashboardSimpleTodoList(
  items: TodoItem[],
  emptyDescription: string,
  onNavigate: (link: string) => void,
) {
  if (items.length === 0) {
    return <Empty description={emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }
  return (
    <div className="dashboard-feed-list">
      {items.map((item) => (
        <div
          key={item.id}
          className="dashboard-feed-item dashboard-feed-item--interactive"
          onClick={() => item.link && onNavigate(item.link)}
        >
          <div className="dashboard-feed-item__title">{item.title}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * 工作台页面组件
 */
export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { token } = useToken();
  const screens = useBreakpoint();
  const touchScreen = useTouchScreen();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  /** 工作台卡片圆角（阴影见 global.less `.dashboard-section__card`） */
  const dashboardCardRadius = token.borderRadiusLG;
  /** 底部待办 / 最新操作两卡统一固定高度（整张 Card，含标题栏），列表在卡片内滚动 */
  const dashboardBottomThreeCardsFixedHeight = 500;
  /** 工作台：主 Row gutter、纵向 flex gap、相邻区块 margin 与 antd 默认 gutter 对齐，统一 16px */
  const DASHBOARD_LAYOUT_GUTTER = 16;

  /** 左侧顶区（欢迎行 + KPI）= 右侧日历高度；用于下方区块对齐 */
  const dashboardLeftTopHeight = DASHBOARD_CALENDAR_WIDGET_HEIGHT;
  /** 右侧下区高度随快捷入口内容自适应（版本卡紧跟其下） */

  /** 卡片内列表区：占满 body 剩余空间并滚动 */
  const bottomCardListScrollBoxStyle: React.CSSProperties = {
    flex: '1 1 0%',
    minHeight: 0,
    overflowX: 'hidden',
    overflowY: 'auto',
  };
  const currentUser = useGlobalStore((s) => s.currentUser);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  /** 天气数据：用于首行天气区块背景渐变 */
  const [weatherForDashboard, setWeatherForDashboard] = useState<WeatherData | null>(null);

  // 时间范围筛选器状态
  const [timeRange, setTimeRange] = useState<DashboardTimeRange>('last30days');
  const [todoActiveTab, setTodoActiveTab] = useState('all');

  const calendarDayKey = currentTime.format('YYYY-MM-DD');
  const lunarDateStr = useMemo(
    () => formatLunarDate(dayjs(calendarDayKey, 'YYYY-MM-DD')),
    [calendarDayKey],
  );

  // 触发新手引导：工作台
  useAutoGuide('dashboard');
  
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
    staleTime: 5 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
  });
  const resolvedUserDetail = userDetail || userDetailFallback;

  const displayTimezone =
    useConfigStore((s) => s.configs?.timezone) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'Asia/Shanghai';

  const { data: platformVersion } = useQuery({
    queryKey: ['platformVersion'],
    queryFn: getPlatformVersion,
    staleTime: 5 * 60 * 1000,
  });

  const buildTimeDisplay = useMemo(
    () => formatTimeInTimezone(platformVersion?.build_time, displayTimezone),
    [platformVersion?.build_time, displayTimezone],
  );

  const copyPlatformCommit = useCallback(() => {
    const raw = (platformVersion?.git_commit || '').trim();
    if (!raw) return;
    void navigator.clipboard.writeText(raw).then(() => {
      message.success(t('pages.dashboard.copyCommitSuccess'));
    });
  }, [platformVersion?.git_commit, message, t]);

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

  // 获取待办事项（使用真实API）
  // 列表上限 50：9 个 Tab × 最多 5 条展示 = 45，50 足够且显著降低后端/序列化成本
  const { data: todosResult, isLoading: todosLoading, refetch: refetchTodos } = useQuery<TodoListResponse>({
    queryKey: ['dashboard-todos'],
    queryFn: () => getTodos(50),
    refetchInterval: 60000,
  });

  const todos = useMemo(() => todosResult?.items || [], [todosResult]);
  const localizedTodos = useMemo(
    () => localizeDashboardTodos(todos, t),
    [todos, t, i18n.language],
  );
  const todosWorkOrder = useMemo(() => localizedTodos.filter((x) => x.type === 'work_order'), [localizedTodos]);
  const todosQualityInspection = useMemo(
    () => localizedTodos.filter((x) => x.type === 'quality_inspection'),
    [localizedTodos],
  );
  const todosWarehouse = useMemo(() => localizedTodos.filter((x) => x.type === 'warehouse'), [localizedTodos]);
  const todosOutbound = useMemo(() => localizedTodos.filter((x) => x.type === 'outbound'), [localizedTodos]);
  const todosPurchase = useMemo(() => localizedTodos.filter((x) => x.type === 'purchase'), [localizedTodos]);
  const todosSales = useMemo(() => localizedTodos.filter((x) => x.type === 'sales'), [localizedTodos]);
  const todosEquipment = useMemo(() => localizedTodos.filter((x) => x.type === 'equipment'), [localizedTodos]);
  const todosException = useMemo(() => localizedTodos.filter((x) => x.type === 'exception'), [localizedTodos]);

  const dashboardTodoTabCountByKey = useMemo(
    () => ({
      sales: todosSales.length,
      purchase: todosPurchase.length,
      work_order: todosWorkOrder.length,
      exception: todosException.length,
      quality_inspection: todosQualityInspection.length,
      equipment: todosEquipment.length,
      warehouse: todosWarehouse.length,
      outbound: todosOutbound.length,
    }),
    [
      todosSales.length,
      todosPurchase.length,
      todosWorkOrder.length,
      todosException.length,
      todosQualityInspection.length,
      todosEquipment.length,
      todosWarehouse.length,
      todosOutbound.length,
    ],
  );

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
      default:
        return {
          dateStart: now.format('YYYY-MM-DD'),
          dateEnd: now.format('YYYY-MM-DD'),
        };
    }
  }, [timeRange]);

  // 获取统计数据（使用真实API）
  const { data: statistics } = useQuery({
    queryKey: ['dashboard-statistics', getDateRange.dateStart, getDateRange.dateEnd],
    queryFn: () => getStatistics(getDateRange.dateStart, getDateRange.dateEnd),
    refetchInterval: 60000,
  });

  // 获取菜单树（菜单管理）
  // 与 BasicLayout 的 useUnifiedMenuData 共用同一 queryKey（含 tenant_id + permission_version），
  // 避免工作台与侧边栏重复拉 navigation-tree（在 staleTime 内 react-query 命中同一缓存）
  const { data: menuTree, isLoading: menuTreeLoading } = useNavigationMenuTreeQuery();

  // 蓝图设置已下线；菜单可见性完全由 is_active + 权限控制。
  const quickEntryMenuTree = useMemo(() => menuTree || [], [menuTree]);

  // 获取生产播报（使用真实API）
  const { data: productionBroadcastData, isLoading: productionBroadcastLoading } = useQuery<ProductionBroadcastItem[]>({
    queryKey: ['production-broadcast'],
    queryFn: () => getProductionBroadcast(10),
    refetchInterval: 60000,
  });

  const productionBroadcast = useMemo(() => {
    if (!Array.isArray(productionBroadcastData)) return [];
    return productionBroadcastData.slice(0, 10);
  }, [productionBroadcastData]);

  // 用户偏好：复用 useUserPreferenceStore（app.tsx / themeStore / i18n 初始化时已 fetch 过），避免首屏再发一次 /personal/user-preferences
  const userPreferenceRaw = useUserPreferenceStore((s) => s.preferences);
  const userPreferenceInitialized = useUserPreferenceStore((s) => s.initialized);
  const userPreferenceLoading = useUserPreferenceStore((s) => s.loading);
  const fetchPreferences = useUserPreferenceStore((s) => s.fetchPreferences);

  // store 若尚未初始化（直达链接首次打开等场景），主动拉一次；内部已有 initialized/loading 去重
  useEffect(() => {
    if (!userPreferenceInitialized && !userPreferenceLoading) {
      fetchPreferences();
    }
  }, [userPreferenceInitialized, userPreferenceLoading, fetchPreferences]);

  const userPreference = useMemo<UserPreference | undefined>(
    () => (userPreferenceInitialized ? ({ preferences: userPreferenceRaw } as UserPreference) : undefined),
    [userPreferenceInitialized, userPreferenceRaw],
  );
  const quickEntryLoading = (!userPreferenceInitialized && userPreferenceLoading) || menuTreeLoading;

  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);

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

  // 快捷入口数据准备
  const quickEntryItems = useMemo(() => {
    if (quickEntryLoading) {
      return [];
    }
    const quickEntriesFromPref = userPreference?.preferences?.dashboard_quick_entries as QuickEntryItem[] | undefined;
    return resolveQuickEntryDisplayItems(
      quickEntryMenuTree,
      quickEntriesFromPref,
      t,
      10,
    );
  }, [quickEntryLoading, userPreference, quickEntryMenuTree, t]);

  // 快捷入口菜单树数据
  const quickEntryMenuTreeData = useMemo(() => {
    if (!quickEntryMenuTree.length) return [];
    return convertMenuTreeToTreeData(quickEntryMenuTree, t);
  }, [quickEntryMenuTree, t]);

  // 手机端工作台切换逻辑：触屏竖屏强制切换，或 PC 端浏览器宽度不足（< 1000px）时切换，确保布局始终美观
  const isWidthTooNarrow = (typeof window !== 'undefined' && window.innerWidth < 1200);
  if ((touchScreen.isTouchScreenMode && touchScreen.isPortrait) || isWidthTooNarrow) {
    return (
      <MobileWorkplace
        userInfo={{ ...userInfo, ...resolvedUserDetail }}
        avatarUrl={avatarUrl}
        greeting={t(getGreetingKey())}
        currentTime={currentTime}
        lunarDateStr={lunarDateStr}
        statistics={statistics}
        todos={localizedTodos}
        quickEntries={quickEntryItems}
        isDark={isDark}
        onTodoHandle={(id) => handleTodoMutation.mutate({ todoId: id, action: 'handle' })}
        onWeatherChange={setWeatherForDashboard}
        weatherData={weatherForDashboard}
      />
    );
  }

  return (
    <>
      <DashboardTemplate
        quickActions={[]}
        showConfigButton={false}
        style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
      <div
        style={{
          flex: 1,
          width: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          padding: 0,
          overflow: 'hidden',
        }}
      >
      {/* 左右两大组：左 19（欢迎行 + KPI + 下区）；右 5（日历天气时钟 + 快捷 + 版本） */}
      <Row gutter={[DASHBOARD_LAYOUT_GUTTER, DASHBOARD_LAYOUT_GUTTER]} align="stretch" className="dashboard-main-body" style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <Col xs={24} lg={19} className="dashboard-main-scroll-col" style={{ display: 'flex', flexDirection: 'column', gap: DASHBOARD_LAYOUT_GUTTER, minHeight: 0, minWidth: 0 }}>
          <div
            className="dashboard-left-top-block"
            style={{
              height: dashboardLeftTopHeight,
              minHeight: dashboardLeftTopHeight,
              maxHeight: dashboardLeftTopHeight,
              display: 'flex',
              flexDirection: 'column',
              gap: DASHBOARD_LAYOUT_GUTTER,
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            <DashboardWelcomeBar
              greeting={t(getGreetingKey())}
              userName={userName}
              isDark={isDark}
              cardRadius={dashboardCardRadius}
              backgroundTint={getWeatherAdaptiveTint(weatherForDashboard, isDark)}
            />
            <DashboardKpiPanel
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
              statistics={statistics}
              isDark={isDark}
              t={t}
              navigate={navigate}
              cardRadius={dashboardCardRadius}
              layoutGutter={DASHBOARD_LAYOUT_GUTTER}
              fillHeight
            />
          </div>

          <DashboardOperationCardsPanel
            cardRadius={dashboardCardRadius}
            isDark={isDark}
            t={t}
            onNavigate={navigate}
          />

          <Row
              gutter={[DASHBOARD_LAYOUT_GUTTER, DASHBOARD_LAYOUT_GUTTER]}
              className="dashboard-four-cards-row dashboard-bento-main-row"
              wrap={window.innerWidth < 1000}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'stretch',
              }}
            >
        <style>{`
          .dashboard-four-cards-row .ant-col { display: flex; align-items: stretch; min-height: 0; }
          .dashboard-four-cards-row .dashboard-section { width: 100%; }
          .dashboard-four-cards-row .dashboard-section__card.ant-card { min-height: 0; display: flex; flex-direction: column; }
          .dashboard-four-cards-row .dashboard-section__card .ant-card-body { flex: 1 1 0%; overflow: hidden; min-height: 0; display: flex; flex-direction: column; }
          /* 待办 Tabs：占满 body 剩余高度，仅在内容区滚动，不顶破卡片 */
          .dashboard-four-cards-row .dashboard-bottom-card-tabs.ant-tabs {
            flex: 1 1 0%;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .dashboard-four-cards-row .dashboard-bottom-card-tabs .ant-tabs-nav { flex-shrink: 0; margin-bottom: 0; }
          .dashboard-four-cards-row .dashboard-bottom-card-tabs .ant-tabs-content-holder {
            flex: 1 1 0%;
            min-height: 0;
            overflow: hidden !important;
          }
          .dashboard-four-cards-row .dashboard-bottom-card-tabs .ant-tabs-content,
          .dashboard-four-cards-row .dashboard-bottom-card-tabs .ant-tabs-content-top {
            height: 100%;
            overflow: hidden;
          }
          /* 待办 Tabs 与 内容区：可滚动但不显示滚动条 */
          .dashboard-four-cards-row .dashboard-bottom-card-tabs .ant-tabs-tabpane {
            height: 100%;
            overflow: auto;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE/Edge */
          }
          .dashboard-four-cards-row .dashboard-bottom-card-tabs .ant-tabs-tabpane::-webkit-scrollbar {
            display: none; /* Chrome/Safari */
            width: 0;
            height: 0;
          }
          /* 核心列表容器：统一隐藏滚动条 */
          .dashboard-bottom-card-scroll,
          .dashboard-bottom-card-tabs .ant-tabs-tabpane {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          .dashboard-bottom-card-scroll::-webkit-scrollbar,
          .dashboard-bottom-card-tabs .ant-tabs-tabpane::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
        `}</style>

        {/* 最新操作（生产播报）：大屏在左，md=10 / 待办 md=14 */}
        <Col
          xs={24}
          sm={12}
          md={10}
          lg={10}
          style={{ display: 'flex', minHeight: 0, width: '100%' }}
        >
          <DashboardSectionCard
            height={dashboardBottomThreeCardsFixedHeight}
            cardRadius={dashboardCardRadius}
            className="dashboard-section--feed"
            loading={productionBroadcastLoading}
            title={t('pages.dashboard.latestOperations')}
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => {
                  navigate('/apps/kuaizhizao/production-execution/reporting');
                }}
              >
                {t('pages.dashboard.viewAll')} <RightOutlined />
              </Button>
            }
          >
            {productionBroadcast && productionBroadcast.length > 0 ? (
              <div className="dashboard-bottom-card-scroll dashboard-feed-list" style={bottomCardListScrollBoxStyle}>
                {productionBroadcast.map((item) => (
                  <div
                    key={item.id}
                    className="dashboard-feed-item dashboard-feed-item--interactive"
                    onClick={() => {
                      navigate(`/apps/kuaizhizao/production-execution/reporting?work_order=${item.work_order_no}`);
                    }}
                  >
                    <div className="dashboard-feed-item__row">
                      <div className="dashboard-feed-item__main">
                        <p className="dashboard-feed-item__title">
                          {item.operator_name} | {item.process_name}
                        </p>
                      </div>
                      <span className="dashboard-feed-item__time">
                        {item.created_at ? formatDateTime(item.created_at, 'MM-DD HH:mm') : item.date}
                      </span>
                    </div>
                    <div className="dashboard-feed-item__row">
                      <p className="dashboard-feed-item__meta dashboard-feed-item__main">
                        {`${item.work_order_no}${item.product_name ? ` · ${item.product_name}` : ''}`}
                      </p>
                      <div className="dashboard-feed-item__stats">
                        <span className="dashboard-feed-item__stat--ok">
                          {t('pages.dashboard.qualified')} {item.qualified_quantity.toFixed(0)}
                        </span>
                        {item.unqualified_quantity > 0 ? (
                          <span className="dashboard-feed-item__stat--bad">
                            {t('pages.dashboard.unqualified')} {item.unqualified_quantity.toFixed(0)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty 
                  description={t('pages.dashboard.emptyBroadcast')} 
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </DashboardSectionCard>
        </Col>

        {/* 待办事项：大屏在右，md=14 */}
        <Col
          xs={24}
          sm={12}
          md={14}
          lg={14}
          style={{ display: 'flex', minHeight: 0, width: '100%' }}
        >
          <DashboardSectionCard
            height={dashboardBottomThreeCardsFixedHeight}
            cardRadius={dashboardCardRadius}
            className="dashboard-section--with-tabs"
            loading={todosLoading}
            title={
              <Space size={8}>
                <span>{t('pages.dashboard.todoList')}</span>
                {todos && todos.length > 0 ? <Badge count={todos.length} /> : null}
              </Space>
            }
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
          >
            {/*
              待办分类 Tab 顺序与 `src/apps/kuaizhizao/manifest.json` → menu_config.children 的 sort_order 一致：
              销售(1) → 采购(3) → 生产执行(4)：工单、异常 → 质量(5) → 设备(6) → 仓储(7)：入库侧、出库。
              计划(2)、绩效(10) 等模块无对应待办类型，不占用 Tab。
            */}
            <Tabs
              className="dashboard-bottom-card-tabs"
              style={{ flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}
              activeKey={todoActiveTab}
              onChange={setTodoActiveTab}
              items={filterDashboardTodoTabItems(
                [
                {
                  key: 'all',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabAll'), localizedTodos.length),
                  children: (
                    <div className="dashboard-feed-list">
                      {localizedTodos.length > 0 ? (
                        localizedTodos.map((item) => (
                          <div
                            key={item.id}
                            className="dashboard-todo-item"
                            onClick={() => {
                              if (item.link) {
                                navigate(item.link);
                              }
                            }}
                          >
                            <div className="dashboard-todo-item__main">
                              <p className="dashboard-todo-item__title">{item.title}</p>
                              {item.description ? (
                                <span className="dashboard-todo-item__desc">{item.description}</span>
                              ) : null}
                              {item.due_date ? (
                                <span className="dashboard-todo-item__desc">
                                  {t('pages.dashboard.dueDateShort', {
                                    date: formatDateTime(item.due_date, 'YYYY-MM-DD'),
                                  })}
                                </span>
                              ) : null}
                            </div>
                            <Button
                              size="small"
                              type="primary"
                              className="dashboard-todo-item__action"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTodoMutation.mutate({ todoId: item.id, action: 'handle' });
                              }}
                            >
                              {t('pages.dashboard.handle')}
                            </Button>
                          </div>
                        ))
                      ) : (
                        <Empty description={t('pages.dashboard.emptyTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'sales',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabSales'), todosSales.length),
                  children: renderDashboardSimpleTodoList(
                    todosSales,
                    t('pages.dashboard.emptySalesTodo'),
                    (link) => navigate(link),
                  ),
                },
                {
                  key: 'purchase',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabPurchase'), todosPurchase.length),
                  children: renderDashboardSimpleTodoList(
                    todosPurchase,
                    t('pages.dashboard.emptyPurchaseTodo'),
                    (link) => navigate(link),
                  ),
                },
                {
                  key: 'work_order',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabWorkOrder'), todosWorkOrder.length),
                  children: renderDashboardSimpleTodoList(
                    todosWorkOrder,
                    t('pages.dashboard.emptyWorkOrderTodo'),
                    (link) => navigate(link),
                  ),
                },
                {
                  key: 'exception',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabException'), todosException.length),
                  children: renderDashboardSimpleTodoList(
                    todosException,
                    t('pages.dashboard.emptyExceptionTodo'),
                    (link) => navigate(link),
                  ),
                },
                {
                  key: 'quality_inspection',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabQualityInspection'), todosQualityInspection.length),
                  children: renderDashboardSimpleTodoList(
                    todosQualityInspection,
                    t('pages.dashboard.emptyQualityInspectionTodo'),
                    (link) => navigate(link),
                  ),
                },
                {
                  key: 'equipment',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabEquipment'), todosEquipment.length),
                  children: renderDashboardSimpleTodoList(
                    todosEquipment,
                    t('pages.dashboard.emptyEquipmentTodo'),
                    (link) => navigate(link),
                  ),
                },
                {
                  key: 'warehouse',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabWarehouse'), todosWarehouse.length),
                  children: renderDashboardSimpleTodoList(
                    todosWarehouse,
                    t('pages.dashboard.emptyWarehouseTodo'),
                    (link) => navigate(link),
                  ),
                },
                {
                  key: 'outbound',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabOutbound'), todosOutbound.length),
                  children: renderDashboardSimpleTodoList(
                    todosOutbound,
                    t('pages.dashboard.emptyOutboundTodo'),
                    (link) => navigate(link),
                  ),
                },
              ],
                dashboardTodoTabCountByKey,
              )}
            />
          </DashboardSectionCard>
        </Col>

      </Row>
        </Col>

        <Col xs={24} lg={5} className="dashboard-main-scroll-col" style={{ display: 'flex', flexDirection: 'column', gap: DASHBOARD_LAYOUT_GUTTER, minHeight: 0, minWidth: 0 }}>
          <DashboardCalendarWeatherClock
            currentTime={currentTime}
            isDark={isDark}
            cardRadius={dashboardCardRadius}
            lunarDateStr={lunarDateStr}
            t={t}
            onWeatherChange={setWeatherForDashboard}
          />
          {/* 右侧下区：快捷入口 + 使用小提示/版本 */}
          <div
            className="dashboard-right-bottom-section"
            style={{
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: DASHBOARD_LAYOUT_GUTTER,
            }}
          >
            <QuickEntryGrid
              title={t('pages.dashboard.quickEntry')}
              items={quickEntryItems}
              loading={quickEntryLoading}
              menuTree={quickEntryMenuTreeData}
              showConfig={true}
              onSave={async (items: QuickEntryItem[]) => {
                const serializableItems = items.map(({ menu_icon, ...rest }) => rest);
                await updatePreferences({ dashboard_quick_entries: serializableItems });
              }}
              isDark={isDark}
              renderMenuIcon={(menuUuid: string) => {
                if (!quickEntryMenuTree.length) return <ShopOutlined />;
                const menu = findMenuInTree(quickEntryMenuTree, menuUuid);
                return menu ? renderQuickEntryMenuIcon(menu) : <ShopOutlined />;
              }}
            />
            <DashboardUsageTipsCarousel
              t={t}
              cardRadius={dashboardCardRadius}
              gitCommit={platformVersion?.git_commit}
              buildTimeDisplay={buildTimeDisplay}
              onCopyCommit={copyPlatformCommit}
            />
          </div>

        </Col>
      </Row>
      </div>
      </div>

      </DashboardTemplate>

    </>
  );
}
