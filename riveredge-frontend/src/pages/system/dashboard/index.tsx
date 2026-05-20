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
import {
  Card,
  Row,
  Col,
  Grid,
  Avatar,
  Typography,
  Space,
  Tag,
  Button,
  Badge,
  Empty,
  App,
  theme,
  Tabs,
} from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  ShopOutlined,
  PlayCircleOutlined,
  AppstoreOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { DashboardTemplate } from '../../../components/layout-templates';
import { PAGE_SPACING } from '../../../components/layout-templates/constants';
import { QuickEntryGrid, type QuickEntryItem } from '../../../components/quick-entry/QuickEntryGrid';
import {
  buildQuickEntriesFromMenuTree,
  findMenuInTree,
  getTranslatedMenuTitle,
} from '../../../components/quick-entry/quickEntryItems';
import {
  getQuickEntryIconByPath,
  renderQuickEntryMenuIcon,
} from '../../../components/quick-entry/renderQuickEntryMenuIcon';
import { 
  getTodos, 
  getStatistics, 
  handleTodo, 
  getProductionBroadcast,
  type TodoListResponse,
  type ProductionBroadcastItem,
} from '../../../services/dashboard';
import { getUserMessageStats, type UserMessageStats } from '../../../services/userMessage';
import { getNavigationMenuTree, type MenuTree } from '../../../services/menu';
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
import WeatherWidget from '../../../components/weather/WeatherWidget';
import { getWeatherCardGradient, getWeatherAdaptiveTint } from '../../../components/weather/weatherBackground';
import type { WeatherData } from '../../../services/weather';
import { formatLunarDate } from '../../../utils/lunarDate';
import { formatTimeInTimezone } from '../../../utils/formatTimeInTimezone';
import { getPlatformVersion } from '../../../services/platformSettings';
import { useConfigStore } from '../../../stores/configStore';
import { getUserTaskStats, getUserTasks, type UserTask } from '../../../services/userTask';
import WorkplaceToolkit from './WorkplaceToolkit';
import {
  dashboardTopBarUserCardBackground,
  getDashboardTopBarCardBorder,
  getDashboardTopBarCardShadow,
  getDashboardTopBarTheme,
} from './dashboardTopBarTheme';
import { MobileWorkplace } from './MobileWorkplace';
import { useTouchScreen } from '../../../hooks/useTouchScreen';
import { useAutoGuide } from '../../../components/onboarding-guide/useAutoGuide';



const { Title, Text } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;


const convertMenuTreeToTreeData = (
  menus: MenuTree[],
  t: (key: string, options?: any) => string,
): DataNode[] => {
  const convertNode = (menu: MenuTree): DataNode | null => {
    if (menu.is_external) return null;

    const children = (menu.children || [])
      .map(convertNode)
      .filter((item): item is DataNode => item !== null);

    const hasValidPath = !!menu.path && menu.path !== '/system/dashboard/workplace';
    // 无路由且无可用子节点时，整节点不展示
    if (!hasValidPath && children.length === 0) return null;

    return {
      title: getTranslatedMenuTitle(menu, t),
      key: menu.uuid,
      icon: renderQuickEntryMenuIcon(menu),
      path: menu.path, // 添加 path 信息，供 QuickEntryGrid 保存时校验
      children: children.length > 0 ? children : undefined,
      isLeaf: children.length === 0,
      // 目录节点可展开但不可勾选；仅有真实路由的菜单可选
      disabled: !hasValidPath,
    } as DataNode;
  };

  return menus
    .map(convertNode)
    .filter((item): item is DataNode => item !== null);
};

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

function DashboardLcdClock({
  time,
  inline,
  isDark,
  systemCount = 0,
  personalCount = 0,
  onAlarmClick,
  alertType = 'none',
}: {
  time: dayjs.Dayjs;
  inline?: boolean;
  isDark?: boolean;
  systemCount?: number;
  personalCount?: number;
  onAlarmClick?: () => void;
  alertType?: 'system' | 'personal' | 'none';
}) {
  const hour24 = time.get('hour');
  const hourStr = hour24.toString().padStart(2, '0');
  const minuteStr = time.get('minute').toString().padStart(2, '0');
  const secondStr = time.get('second').toString().padStart(2, '0');

  const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const currentDayIdx = (time.get('day') + 6) % 7;

  // 仿真设计：表盘背景和数字颜色随系统暗色主题切换
  const lcdTextDim = isDark ? 'rgba(74, 222, 128, 0.05)' : 'rgba(0,0,0,0.06)';
  const lcdTextActive = isDark ? '#4ade80' : '#2C3D4F';

  const timeText = `${hourStr}:${minuteStr}:${secondStr}`;

  // 决定闹钟图标的颜色和动画
  const isAlerting = alertType !== 'none';
  const isSystemAlert = alertType === 'system';
  const hasPending = systemCount > 0 || personalCount > 0;

  let alarmColor = lcdTextActive;
  let alarmFilter = 'none';
  let alarmClass = '';

  if (isAlerting) {
    if (isSystemAlert) {
      alarmColor = '#ff4d4f';
      alarmFilter = 'drop-shadow(0 0 8px #ff4d4f)';
      alarmClass = 'lcd-alarm-flash';
    } else {
      alarmColor = isDark ? '#9ca3af' : '#6b7280';
      alarmFilter = isDark
        ? 'drop-shadow(0 0 8px #9ca3af)'
        : 'drop-shadow(0 0 5px rgba(107, 114, 128, 0.4))';
      alarmClass = 'lcd-alarm-flash-gray';
    }
  } else if (systemCount > 0) {
    alarmColor = isDark ? '#f87171' : '#ef4444';
    alarmFilter = 'drop-shadow(0 0 5px rgba(239, 68, 68, 0.4))';
    alarmClass = 'lcd-alarm-pulse';
  } else if (personalCount > 0) {
    alarmColor = isDark ? 'rgba(74, 222, 128, 0.8)' : '#2C3D4F';
    alarmClass = 'lcd-alarm-pulse';
  }

  return (
    <div
      style={{
        width: '100%',
        height: inline ? 64 : 64,
        /* 仿真表盘：暗色 VFD；亮色浅灰 LCD */
        background: isDark
          ? `linear-gradient(180deg, #0a1f16 0%, #06140e 100%)`
          : `linear-gradient(180deg, #E0E2E5 0%, #D1D4D9 100%)`,
        borderRadius: 8,
        padding: '0 12px',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        border: isDark
          ? `1px solid rgba(74, 222, 128, 0.3)`
          : `1px solid rgba(0,0,0,0.15)`,
        boxShadow: isDark
          ? `inset 0 2px 10px rgba(0,0,0,0.5), 0 0 10px rgba(74, 222, 128, 0.1)`
          : `inset 0 2px 4px rgba(0,0,0,0.15), inset 0 0 10px rgba(0,0,0,0.05), 0 1px 0 rgba(255,255,255,0.1)`,
        flexShrink: 0,
        gap: 4,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 表盘玻璃反光效果 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '45%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none',
          opacity: isDark ? 0.35 : 0.6,
        }}
      />
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          flexShrink: 0, // ⚠️ 防止小屏挤压
          opacity: (hasPending || isAlerting) ? 1 : 0.3,
          cursor: onAlarmClick ? 'pointer' : 'default',
          position: 'relative',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={onAlarmClick}
      >
        <ClockCircleOutlined 
          style={{ 
            fontSize: inline ? 12 : 20, 
            color: alarmColor,
            filter: alarmFilter,
          }} 
          className={alarmClass}
        />
        {systemCount > 0 && (
          <Badge 
            count={systemCount} 
            size="small" 
            offset={[2, -2]}
            style={{ 
              backgroundColor: '#ef4444',
              boxShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
              fontSize: '10px',
              height: '14px',
              lineHeight: '14px',
              minWidth: '14px',
              padding: '0 4px',
              border: 'none',
              borderRadius: '7px'
            }}
          />
        )}
        
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes lcd-alarm-pulse {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 0.8; }
          }
          .lcd-alarm-pulse {
            animation: lcd-alarm-pulse 2s infinite ease-in-out;
          }
          @keyframes lcd-alarm-flash {
            0% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
            100% { opacity: 0.2; transform: scale(1); }
          }
          .lcd-alarm-flash {
            animation: lcd-alarm-flash 0.5s infinite ease-in-out;
            color: #ff4d4f !important;
          }
          @keyframes lcd-alarm-flash-gray {
            0% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.15); }
            100% { opacity: 0.3; transform: scale(1); }
          }
          .lcd-alarm-flash-gray {
            animation: lcd-alarm-flash-gray 0.8s infinite ease-in-out;
          }
        `}} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0, // ⚠️ 保护时间数字不被挤压
          height: '100%',
        }}
      >
        <span
          style={{
            color: isDark ? '#7DE8AE' : '#516B86',
            fontSize: inline ? 28 : 34,
            fontWeight: 800,
            paddingTop: 6,
            letterSpacing: inline ? '0.06em' : '0.08em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            fontFamily:
              '"Inter Tight", "DIN Alternate", "Bahnschrift", "Segoe UI", "Arial Black", "PingFang SC", "Microsoft YaHei", sans-serif',
            textShadow: isDark
              ? '0 0 7px rgba(125, 232, 174, 0.2)'
              : '0 1px 0 rgba(255,255,255,0.55)',
          }}
        >
          {timeText}
        </span>
      </div>

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        fontSize: 6.5, 
        fontWeight: 800,
        gap: 0.5,
        borderLeft: `1px solid ${isDark ? 'rgba(74,222,128,0.12)' : 'rgba(0,0,0,0.06)'}`,
        paddingLeft: 6
      }}>
        {weekdays.map((day, idx) => (
          <span 
            key={day} 
            style={{ 
              color: idx === currentDayIdx ? lcdTextActive : lcdTextDim,
              lineHeight: 1,
            }}
          >
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}




function formatDashboardMetric(n: number | undefined | null): string {
  if (n == null || Number.isNaN(Number(n))) return '0';
  return Number(n).toLocaleString();
}

function formatDashboardRate(n: number | undefined | null): string {
  if (n == null || Number.isNaN(Number(n))) return '0';
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** 指标卡主数值语义（用于配色） */
type DashboardKpiMainSemantic =
  | 'work_order_total'
  | 'work_order_wip'
  | 'completion_rate'
  | 'output_quantity'
  | 'inventory_alert'
  | 'quality_rate';

function resolveDashboardKpiMainColor(
  semantic: DashboardKpiMainSemantic | undefined,
  rawNumeric: number | undefined | null,
  isDark: boolean,
  token: ReturnType<typeof theme.useToken>['token'],
): string {
  if (!semantic) {
    return isDark ? '#ffffff' : '#18181b';
  }
  const n = rawNumeric == null || Number.isNaN(Number(rawNumeric)) ? 0 : Number(rawNumeric);

  switch (semantic) {
    case 'work_order_total':
      return isDark ? '#93c5fd' : token.colorPrimary;
    case 'work_order_wip':
      return isDark ? '#5eead4' : '#0891b2';
    case 'completion_rate':
      if (n >= 85) return isDark ? '#86efac' : token.colorSuccess;
      if (n >= 50) return isDark ? '#fcd34d' : token.colorWarning;
      return isDark ? '#fca5a5' : token.colorError;
    case 'output_quantity':
      return isDark ? '#fdba74' : '#ea580c';
    case 'inventory_alert':
      if (n > 0) return isDark ? '#fca5a5' : token.colorError;
      return isDark ? '#86efac' : token.colorSuccess;
    case 'quality_rate':
      if (n >= 95) return isDark ? '#86efac' : '#15803d';
      if (n >= 80) return isDark ? '#bef264' : token.colorSuccess;
      if (n >= 60) return isDark ? '#fcd34d' : token.colorWarning;
      return isDark ? '#fca5a5' : token.colorError;
    default:
      return isDark ? '#ffffff' : '#18181b';
  }
}

type KpiRichSide = { label: string; value: React.ReactNode };

/** 指标卡：左主数值 + 说明、竖线、右侧两项副指标（与设计稿一致） */
function DashboardKpiRichCard({
  gradient,
  title,
  mainValue,
  mainSuffix,
  subtitle,
  rightTop,
  rightBottom,
  onClick,
  isDark,
  mainSemantic,
  mainNumeric,
}: {
  gradient: string;
  title: string;
  mainValue: React.ReactNode;
  mainSuffix?: string;
  subtitle: string;
  rightTop: KpiRichSide;
  rightBottom: KpiRichSide;
  onClick?: () => void;
  isDark?: boolean;
  /** 主指标语义色（与业务含义一致：总量/在制/达成/预警/质量等） */
  mainSemantic?: DashboardKpiMainSemantic;
  /** 用于阈值配色（完成率%、质量%、预警条数等） */
  mainNumeric?: number | null;
}) {
  const { token } = useToken();
  const mainColor = resolveDashboardKpiMainColor(mainSemantic, mainNumeric, !!isDark, token);
  const text = {
    title: isDark ? 'rgba(255,255,255,0.8)' : '#64748b',
    main: mainColor,
    secondary: isDark ? 'rgba(255,255,255,0.9)' : '#475569',
    /** 右侧副指标：刻意弱于左侧主数，避免抢视觉 */
    rightLabel: isDark ? 'rgba(255,255,255,0.52)' : '#94a3b8',
    rightValue: isDark ? 'rgba(255,255,255,0.72)' : '#64748b',
    muted: isDark ? 'rgba(255,255,255,0.6)' : '#94a3b8',
    divider: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15, 23, 42, 0.07)',
  } as const;

  return (
    <Card
      variant="borderless"
      hoverable
      onClick={onClick}
      style={{
        borderRadius: token.borderRadiusLG,
        border: 'none',
        boxShadow: token.boxShadowTertiary,
        background: gradient,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
      styles={{
        body: {
          padding: '16px 12px', // 稍微紧凑点
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 10,
          position: 'relative',
          zIndex: 1,
          minHeight: 0,
          borderRadius: token.borderRadiusLG,
        },
      }}
    >
      <div
        style={{
          flex: '1 1 0',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 2,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Text style={{ fontSize: 14, color: text.title, fontWeight: 500, lineHeight: 1.35 }}>
          {title}
        </Text>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 30,
              color: text.main,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
            }}
          >
            {mainValue}
          </span>
          {mainSuffix ? (
            <span
              style={{
                fontSize: 15,
                color: text.main,
                fontWeight: 600,
                opacity: isDark ? 0.92 : 0.88,
              }}
            >
              {mainSuffix}
            </span>
          ) : null}
        </div>
        <Text
          style={{
            fontSize: 11,
            color: text.muted,
            marginTop: 2,
            lineHeight: 1.45,
            display: 'block',
          }}
        >
          {subtitle}
        </Text>
      </div>
      <div
        style={{
          width: 1,
          flexShrink: 0,
          background: text.divider,
          alignSelf: 'stretch',
        }}
        aria-hidden
      />
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 10,
          textAlign: 'right',
          flexShrink: 0,
          minWidth: 50,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: text.rightLabel,
              fontWeight: 400,
              marginBottom: 1,
              lineHeight: 1.35,
              letterSpacing: '0.01em',
            }}
          >
            {rightTop.label}
          </div>
          <div
            style={{
              fontSize: 15,
              color: text.rightValue,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.25,
              letterSpacing: '0.01em',
            }}
          >
            {rightTop.value}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              color: text.rightLabel,
              fontWeight: 400,
              marginBottom: 1,
              lineHeight: 1.35,
              letterSpacing: '0.01em',
            }}
          >
            {rightBottom.label}
          </div>
          <div
            style={{
              fontSize: 15,
              color: text.rightValue,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.25,
              letterSpacing: '0.01em',
            }}
          >
            {rightBottom.value}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** 生产播报列表行：操作员头像（优先已上传头像，否则姓名首字） */
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

/** 待办 Tabs：数量为 0 时不展示括号与数字，仅保留分类名 */
function formatDashboardTodoTabLabel(title: string, count: number): string {
  return count > 0 ? `${title} (${count})` : title;
}

/**
 * 工作台页面组件
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { token } = useToken();
  const screens = useBreakpoint();
  const touchScreen = useTouchScreen();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  // 欢迎条右侧仅保留「实时消息」；待办在下方专用卡片展示，xxl 以下隐藏整块避免顶栏拥挤
  const showUserStatTiles = !!screens.xxl;
  // 首行宽度不足时，日历卡仅显示模拟时钟，避免撑高布局
  const showCalendarText = !!screens.xxl;
  /** 工作台卡片：圆角与阴影与 Ant Design 系统 token 一致，阴影用较轻的 tertiary */
  const dashboardCardRadius = token.borderRadiusLG;
  const dashboardCardShadow = token.boxShadowTertiary;
  // 首行四卡统一固定高度
  const dashboardTopCardHeight = 126;
  /** 指标卡统一固定高度 */
  const dashboardKpiCardHeight = 126;
  /** 底部待办 / 最新操作两卡统一固定高度（整张 Card，含标题栏），列表在卡片内滚动 */
  const dashboardBottomThreeCardsFixedHeight = 500;
  /** 工作台：主 Row gutter、纵向 flex gap、相邻区块 margin 与 antd 默认 gutter 对齐，统一 16px */
  const DASHBOARD_LAYOUT_GUTTER = 16;
  
  /** 计算右侧栏（快捷入口 + 版本号）需要对齐左侧（指标卡 * 2 + 待办）的总高度 */
  const dashboardKpiRowHeight = (dashboardKpiCardHeight * 2) + DASHBOARD_LAYOUT_GUTTER;
  const dashboardRightSectionHeight = dashboardKpiRowHeight + DASHBOARD_LAYOUT_GUTTER + dashboardBottomThreeCardsFixedHeight;

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
  const [timeRange, setTimeRange] = useState<
    'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'last7days' | 'last30days'
  >('last30days');

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
    positionName ? { key: 'position', text: positionName } : null,
    roleNames.length ? { key: 'roles', text: roleNames.join('、') } : null,
  ].filter(Boolean) as Array<{ key: string; text: string }>;

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

  // 消息未读数：复用 BasicLayout 的 ['userMessageStats'] 缓存，避免重复拉 20 条消息列表
  // 同 queryKey + 相同 queryFn，30s staleTime 内由 react-query 命中缓存，不会真正发起请求
  // 消息未读数：复用 BasicLayout 的 ['userMessageStats'] 缓存，避免重复拉 20 条消息列表
  // 同 queryKey + 相同 queryFn，30s staleTime 内由 react-query 命中缓存，不会真正发起请求
  const [systemTaskCount, setSystemTaskCount] = useState<number>(0);
  const [personalTaskCount, setPersonalTaskCount] = useState<number>(0);
  const [pendingTasks, setPendingTasks] = useState<UserTask[]>([]);

  const loadTasksData = useCallback(async () => {
    try {
      // 1. 获取任务统计（用于 LCD 闹钟气泡）
      const stats = await getUserTaskStats();
      setSystemTaskCount((stats as any).pending_system || 0);
      setPersonalTaskCount((stats as any).pending_personal || 0);

      // 2. 获取任务列表（用于检查提醒时间）
      const tasksRes = await getUserTasks({ status: 'pending', page_size: 50 });
      setPendingTasks(tasksRes.items || []);
    } catch (err) {
      console.warn('获取任务数据失败:', err);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadTasksData();
    })();
    // 每 2 分钟刷新一次任务列表
    const timer = setInterval(loadTasksData, 120000);
    return () => clearInterval(timer);
  }, [loadTasksData]);

  // 实时的告警状态与类型：检查是否有任何任务到达了提醒时间
  const alertType = useMemo(() => {
    const activeAlerts = pendingTasks.filter(task => 
      task.remind_at && !dayjs(task.remind_at).isAfter(currentTime)
    );
    
    if (activeAlerts.length === 0) return 'none';
    
    // 如果有任何一个系统任务告警（无 is_personal 标记），定为 system 类型
    const hasSystemAlert = activeAlerts.some(task => !task.data?.is_personal);
    return hasSystemAlert ? 'system' : 'personal';
  }, [pendingTasks, currentTime]);

  const { data: messageStats } = useQuery<UserMessageStats>({
    queryKey: ['userMessageStats'],
    queryFn: () => getUserMessageStats(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  // 获取待办事项（使用真实API）
  // 列表上限 50：9 个 Tab × 最多 5 条展示 = 45，50 足够且显著降低后端/序列化成本
  const { data: todosResult, isLoading: todosLoading, refetch: refetchTodos } = useQuery<TodoListResponse>({
    queryKey: ['dashboard-todos'],
    queryFn: () => getTodos(50),
    refetchInterval: 60000,
  });

  const todos = useMemo(() => todosResult?.items || [], [todosResult]);
  const todosWorkOrder = useMemo(() => todos.filter((x) => x.type === 'work_order'), [todos]);
  const todosQualityInspection = useMemo(() => todos.filter((x) => x.type === 'quality_inspection'), [todos]);
  const todosWarehouse = useMemo(() => todos.filter((x) => x.type === 'warehouse'), [todos]);
  const todosOutbound = useMemo(() => todos.filter((x) => x.type === 'outbound'), [todos]);
  const todosPurchase = useMemo(() => todos.filter((x) => x.type === 'purchase'), [todos]);
  const todosSales = useMemo(() => todos.filter((x) => x.type === 'sales'), [todos]);
  const todosEquipment = useMemo(() => todos.filter((x) => x.type === 'equipment'), [todos]);
  const todosException = useMemo(() => todos.filter((x) => x.type === 'exception'), [todos]);

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
  // 与 BasicLayout 的 useUnifiedMenuData 共用 queryKey ['navigationMenuTree']，
  // 避免工作台与侧边栏重复拉 /menus/tree（在 staleTime 内 react-query 会命中缓存）
  const { data: menuTree, isLoading: menuTreeLoading } = useQuery({
    queryKey: ['navigationMenuTree'],
    queryFn: () => getNavigationMenuTree(),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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

  // 未读通知数量（复用顶栏 userMessageStats 接口，无需再拉消息列表）
  const unreadCount = messageStats?.unread ?? 0;

  // 快捷入口数据准备
  const quickEntryItems = useMemo(() => {
    if (quickEntryLoading) {
      return [];
    }
    const quickEntriesFromPref = userPreference?.preferences?.dashboard_quick_entries as QuickEntryItem[] | undefined;

    if (Array.isArray(quickEntriesFromPref) && quickEntriesFromPref.length > 0) {
      return quickEntriesFromPref
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((entry) => {
          const menu = quickEntryMenuTree.length ? findMenuInTree(quickEntryMenuTree, entry.menu_uuid) : null;
          const resolvedPath = entry.menu_path || menu?.path || '';
          if (!resolvedPath) return null;

          return {
            ...entry,
            menu_name: entry.menu_name || (menu ? getTranslatedMenuTitle(menu, t) : ''),
            menu_path: resolvedPath,
            menu_icon: menu ? renderQuickEntryMenuIcon(menu) : getMenuIconByPath(resolvedPath, entry.menu_name),
          };
        })
        .filter((item): item is any => item !== null);
    }

    if (!quickEntryMenuTree.length) {
      return [];
    }

    return buildQuickEntriesFromMenuTree(quickEntryMenuTree, renderQuickEntryMenuIcon, t, 10);
  }, [quickEntryLoading, userPreference, quickEntryMenuTree, t]);

  // 优先级文本映射（i18n）
  const priorityTextMap: Record<string, string> = useMemo(() => ({
    high: t('pages.dashboard.priorityHigh'),
    critical: t('pages.dashboard.priorityHigh'),
    medium: t('pages.dashboard.priorityMedium'),
    low: t('pages.dashboard.priorityLow'),
  }), [t]);

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
        todos={todos}
        quickEntries={quickEntryItems}
        isDark={isDark}
        onTodoHandle={(id) => handleTodoMutation.mutate({ todoId: id, action: 'handle' })}
        onWeatherChange={setWeatherForDashboard}
        weatherData={weatherForDashboard}
      />
    );
  }

  const priorityColorMap: Record<string, string> = {
    high: 'error',
    critical: 'error',
    medium: 'warning',
    low: 'default',
  };

  const messageStatTile = (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/personal/messages')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/personal/messages');
        }
      }}
      style={{
        padding: '4px 12px',
        cursor: 'pointer',
        minWidth: 92,
        whiteSpace: 'nowrap',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Space size={4} align="center" wrap={false}>
        <BellOutlined style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', flexShrink: 0 }} />
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.95)', margin: 0, whiteSpace: 'nowrap' }}>
          {t('pages.dashboard.realtimeMessages')}
        </Text>
      </Space>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#ffffff',
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
        }}
      >
        {unreadCount}
      </div>
    </div>
  );

  return (
    <>
      <DashboardTemplate
        quickActions={[]}
        showConfigButton={false}
        style={{ flex: '0 0 auto', minHeight: 0 }}
      >
      {/* 高度随内容，避免 flex:1 在固定高度标签区内撑出底部留白；超高由 uni-tabs-content 滚动 */}
      <div
        style={{
          flex: '0 0 auto',
          width: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          overflowY: 'visible',
        }}
      >
      {/* 边距在滚动层内侧，避免略超出卡片的装饰（灯泡等）被裁切 */}
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          /* 边距现在由 UniTabs 统一处理，不再在此单独定义，确保与系统其他页面行为一致 */
          padding: 0,
        }}
      >
      {/* 左右两大组：左 19（顶行三卡 + KPI + 下区）；右 5（时钟 + 快捷 + 版本） */}
      <Row gutter={[DASHBOARD_LAYOUT_GUTTER, DASHBOARD_LAYOUT_GUTTER]} align="stretch" className="dashboard-main-body" style={{ flexShrink: 0 }}>
        <Col xs={24} lg={19} style={{ display: 'flex', flexDirection: 'column', gap: DASHBOARD_LAYOUT_GUTTER, minHeight: 0, minWidth: 0 }}>
      {/* 第一行便当：人员 / 天气 / 工业工具；md+ 用 24 栅格 span 10+7+7（勿用 flex 数字，否则按 grow 分剩余空间，比例会偏） */}
      <Row
        gutter={[DASHBOARD_LAYOUT_GUTTER, DASHBOARD_LAYOUT_GUTTER]}
        align="stretch"
        className="dashboard-bento-top-row"
        style={{ flexShrink: 0 }}
      >
        <Col xs={24} md={10} style={{ display: 'flex' }}>
          <Card
            style={{
              marginTop: 0,
              flex: 1,
              width: '100%',
              height: dashboardTopCardHeight,
              minHeight: dashboardTopCardHeight,
              maxHeight: dashboardTopCardHeight,
              borderRadius: dashboardCardRadius,
              border: getDashboardTopBarCardBorder(isDark),
              background: dashboardTopBarUserCardBackground(token.colorPrimary, isDark),
              boxShadow: getDashboardTopBarCardShadow(isDark),
              overflow: 'hidden',
            }}
            styles={{
              body: {
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%',
                minHeight: 0,
                overflow: 'hidden',
                borderRadius: dashboardCardRadius,
                position: 'relative',
              },
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 'min(85%, 650px)',
                pointerEvents: 'none',
                zIndex: 0,
                /* 终极密集版赛博帷幕：14条跨维度交织曲线。通过极细微的线宽变化实现如同“数字极光”般的深邃纹理 */
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='120' viewBox='0 0 400 120' preserveAspectRatio='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M400 0 C 250 0, 150 120, 0 120' stroke='white' fill='none' stroke-width='3.5' stroke-opacity='0.28' /%3E%3Cpath d='M340 0 C 200 0, 100 100, 0 100' stroke='white' fill='none' stroke-width='2.4' stroke-opacity='0.20' /%3E%3Cpath d='M400 35 C 280 35, 180 115, 100 115' stroke='white' fill='none' stroke-width='1.8' stroke-opacity='0.16' /%3E%3Cpath d='M280 0 C 160 0, 60 85, 0 85' stroke='white' fill='none' stroke-width='1.5' stroke-opacity='0.14' /%3E%3Cpath d='M400 75 C 320 75, 120 110, 0 110' stroke='white' fill='none' stroke-width='1.2' stroke-opacity='0.12' /%3E%3Cpath d='M360 0 C 220 0, 80 105, 20 105' stroke='white' fill='none' stroke-width='1.0' stroke-opacity='0.10' /%3E%3Cpath d='M400 15 C 300 15, 200 45, 0 45' stroke='white' fill='none' stroke-width='0.8' stroke-opacity='0.08' /%3E%3Cpath d='M390 0 C 290 0, 150 115, 60 115' stroke='white' fill='none' stroke-width='0.7' stroke-opacity='0.08' /%3E%3Cpath d='M220 0 C 120 0, 40 70, 0 70' stroke='white' fill='none' stroke-width='0.6' stroke-opacity='0.07' /%3E%3Cpath d='M400 55 C 340 55, 240 85, 0 85' stroke='white' fill='none' stroke-width='0.5' stroke-opacity='0.06' /%3E%3Cpath d='M400 95 C 350 95, 250 110, 110 110' stroke='white' fill='none' stroke-width='0.5' stroke-opacity='0.05' /%3E%3Cpath d='M150 0 C 85 0, 35 55, 0 55' stroke='white' fill='none' stroke-width='0.4' stroke-opacity='0.05' /%3E%3Cpath d='M400 10 C 310 10, 200 40, 60 40' stroke='white' fill='none' stroke-width='0.4' stroke-opacity='0.04' /%3E%3Cpath d='M290 0 C 200 0, 110 65, 55 65' stroke='white' fill='none' stroke-width='0.3' stroke-opacity='0.04' /%3E%3C/svg%3E")`,
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                opacity: isDark ? 0.35 : 0.6,
                maskImage: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.4) 15%, #000 100%)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.3) 15%, #000 100%)',
              }}
            />
            <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  width: '100%',
                  flexWrap: 'nowrap',
                }}
              >
                <Space size="large" align="center" style={{ minWidth: 0, width: '100%' }}>
                  <div
                    style={{
                      position: 'relative',
                      padding: 4,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.12)',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.22)',
                      flexShrink: 0, // ⚠️ 极致保护：外层 div 不缩
                    }}
                  >
                    <Avatar
                      size={64}
                      src={avatarUrl}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        color: token.colorPrimary,
                        fontSize: 24,
                        fontWeight: 'bold',
                        border: '2px solid #ffffff',
                        flexShrink: 0, // ⚠️ 极致保护：Avatar 自身不缩
                      }}
                    >
                      {getAvatarText(currentUser?.full_name || userInfo?.full_name, currentUser?.username || userInfo?.username)}
                    </Avatar>
                  </div>
                  <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <Title
                      level={4}
                      style={{
                        margin: '0 0 8px 0',
                        fontWeight: 700,
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t(getGreetingKey())}，{userName}
                    </Title>
                    <Space wrap={false} size={8} style={{ width: '100%', overflow: 'hidden', flexWrap: 'nowrap' }}>
                      {identityChips.map((chip) => (
                        <Tag
                          key={chip.key}
                          style={{
                            marginInlineEnd: 0,
                            color: 'rgba(255,255,255,0.92)',
                            background: 'rgba(255,255,255,0.14)',
                            border: '1px solid rgba(255,255,255,0.28)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {chip.text}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                </Space>
                {showUserStatTiles ? (
                  <Space size={0} wrap={false} style={{ flexShrink: 0 }} align="center">
                    {messageStatTile}
                  </Space>
                ) : null}
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={7} style={{ display: 'flex' }}>
          <Card
            style={{
              flex: 1,
              width: '100%',
              minHeight: dashboardTopCardHeight,
              height: dashboardTopCardHeight,
              maxHeight: dashboardTopCardHeight,
              borderRadius: dashboardCardRadius,
              border: getDashboardTopBarCardBorder(isDark),
              background: getWeatherCardGradient(weatherForDashboard, isDark),
              boxShadow: getDashboardTopBarCardShadow(isDark),
              overflow: 'hidden',
            }}
            styles={{
              body: {
                padding: '12px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100%',
                borderRadius: dashboardCardRadius,
              },
            }}
          >
            <WeatherWidget tone={isDark ? 'dark' : 'light'} onWeatherChange={setWeatherForDashboard} />
          </Card>
        </Col>
        <Col xs={24} md={7} style={{ display: 'flex', overflow: 'visible' }}>
          <WorkplaceToolkit
            cardHeight={dashboardTopCardHeight}
            cardRadius={dashboardCardRadius}
            backgroundTint={getWeatherAdaptiveTint(weatherForDashboard, isDark)}
            isDark={isDark}
          />
        </Col>
      </Row>

          <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', minWidth: 0 }}>
            <Row
              gutter={[DASHBOARD_LAYOUT_GUTTER, DASHBOARD_LAYOUT_GUTTER]}
              wrap={true} // ⚠️ 允许换行，防止跨宽度挤压变形
              align="stretch"
              className="dashboard-kpi-strip-row"
              style={{ flexShrink: 0 }}
            >
              <Col
                xs={24}
                sm={24}
                md={24}
                lg={24}
                xl={3}
                xxl={3}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  alignSelf: 'stretch',
                  minHeight: 0,
                }}
                className="dashboard-date-strip dashboard-date-strip--bare"
              >
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    minHeight: 0,
                    overflowY: 'auto',
                  }}
                >
                  <div className="dashboard-date-strip-buttons-wrap">
                    {(
                      [
                        { key: 'today' as const, label: t('pages.dashboard.timeToday') },
                        { key: 'yesterday' as const, label: t('pages.dashboard.timeYesterday') },
                        { key: 'thisWeek' as const, label: t('pages.dashboard.timeThisWeek') },
                        { key: 'thisMonth' as const, label: t('pages.dashboard.timeThisMonth') },
                        { key: 'last7days' as const, label: t('pages.dashboard.timeLast7Days') },
                        { key: 'last30days' as const, label: t('pages.dashboard.timeLast30Days') },
                      ] as const
                    ).map(({ key, label }) => (
                      <Button
                        key={key}
                        type={timeRange === key ? 'primary' : 'default'}
                        size="small"
                        className="dashboard-date-strip-btn"
                        style={{
                          flex: '1 1 auto',
                          minWidth: screens.xl ? '100%' : '80px',
                          margin: screens.xl ? '0 0 8px 0' : '0 4px 4px 0',
                          minHeight: 0,
                          height: 'auto',
                        }}
                        onClick={() => setTimeRange(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} md={12} lg={8} xl={7} xxl={7} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: DASHBOARD_LAYOUT_GUTTER }}>
                {/* 工单总数 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0, height: dashboardKpiCardHeight }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'var(--ant-colorBgContainer)' : '#ffffff'}
                    title={t('pages.dashboard.statWorkOrderTotal')}
                    mainValue={formatDashboardMetric(statistics?.production?.total)}
                    mainSuffix={t('pages.dashboard.unitOrder')}
                    subtitle={t('pages.dashboard.kpiSubWorkOrdersInRange')}
                    rightTop={{
                      label: t('pages.dashboard.kpiSideCompleted'),
                      value: `${formatDashboardMetric(statistics?.production?.completed)}${t('pages.dashboard.unitOrder')}`,
                    }}
                    rightBottom={{
                      label: t('pages.dashboard.kpiSideInProgress'),
                      value: `${formatDashboardMetric(statistics?.production?.in_progress)}${t('pages.dashboard.unitOrder')}`,
                    }}
                    isDark={isDark}
                    mainSemantic="work_order_total"
                    mainNumeric={statistics?.production?.total ?? null}
                    onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
                  />
                </div>

                {/* 完工数量 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0, height: dashboardKpiCardHeight }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'var(--ant-colorBgContainer)' : '#ffffff'}
                    title={t('pages.dashboard.statCompletedQuantity')}
                    mainValue={formatDashboardMetric(statistics?.production?.completed_quantity)}
                    mainSuffix={t('pages.dashboard.unitPiece')}
                    subtitle={t('pages.dashboard.kpiSubOutputInRange')}
                    rightTop={{
                      label: t('pages.dashboard.statCapacityRate'),
                      value: `${formatDashboardRate(statistics?.production?.capacity_achievement_rate)}%`,
                    }}
                    rightBottom={{
                      label: t('pages.dashboard.kpiSideClosedWorkOrders'),
                      value: `${formatDashboardMetric(statistics?.production?.completed)}${t('pages.dashboard.unitOrder')}`,
                    }}
                    isDark={isDark}
                    mainSemantic="output_quantity"
                    mainNumeric={statistics?.production?.completed_quantity ?? null}
                    onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
                  />
                </div>

              </Col>
              <Col xs={24} sm={12} md={12} lg={8} xl={7} xxl={7} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: DASHBOARD_LAYOUT_GUTTER }}>
                {/* 进行中工单 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0, height: dashboardKpiCardHeight }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'var(--ant-colorBgContainer)' : '#ffffff'}
                    title={t('pages.dashboard.statWorkOrderInProgress')}
                    mainValue={formatDashboardMetric(statistics?.production?.in_progress)}
                    mainSuffix={t('pages.dashboard.unitOrder')}
                    subtitle={t('pages.dashboard.kpiSubWorkOrdersExecuting')}
                    rightTop={{
                      label: t('pages.dashboard.kpiSideCompleted'),
                      value: `${formatDashboardMetric(statistics?.production?.completed)}${t('pages.dashboard.unitOrder')}`,
                    }}
                    rightBottom={{
                      label: t('pages.dashboard.statWorkOrderCompletion'),
                      value: `${formatDashboardRate(statistics?.production?.completion_rate)}%`,
                    }}
                    isDark={isDark}
                    mainSemantic="work_order_wip"
                    mainNumeric={statistics?.production?.in_progress ?? null}
                    onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders?status=in_progress')}
                  />
                </div>

                {/* 库存预警 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0, height: dashboardKpiCardHeight }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'var(--ant-colorBgContainer)' : '#ffffff'}
                    title={t('pages.dashboard.statInventoryAlert')}
                    mainValue={formatDashboardMetric(statistics?.inventory?.alert_count)}
                    mainSuffix={t('pages.dashboard.unitAlert')}
                    subtitle={t('pages.dashboard.kpiSubInventoryAlerts')}
                    rightTop={{
                      label: t('pages.dashboard.kpiSideTurnoverRate'),
                      value: `${formatDashboardRate(statistics?.inventory?.turnover_rate)}%`,
                    }}
                    rightBottom={{
                      label: t('pages.dashboard.kpiSideStockQuantity'),
                      value: formatDashboardMetric(statistics?.inventory?.total_quantity),
                    }}
                    isDark={isDark}
                    mainSemantic="inventory_alert"
                    mainNumeric={statistics?.inventory?.alert_count ?? null}
                    onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inventory')}
                  />
                </div>

              </Col>
              <Col xs={24} sm={12} md={12} lg={8} xl={7} xxl={7} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: DASHBOARD_LAYOUT_GUTTER }}>
                {/* 工单完成率 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0, height: dashboardKpiCardHeight }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'var(--ant-colorBgContainer)' : '#ffffff'}
                    title={t('pages.dashboard.statWorkOrderCompletion')}
                    mainValue={formatDashboardRate(statistics?.production?.completion_rate)}
                    mainSuffix="%"
                    subtitle={t('pages.dashboard.kpiSubCompletionByOrders')}
                    rightTop={{
                      label: t('pages.dashboard.kpiSideCompletedOrders'),
                      value: `${formatDashboardMetric(statistics?.production?.completed)}${t('pages.dashboard.unitOrder')}`,
                    }}
                    rightBottom={{
                      label: t('pages.dashboard.kpiSideTotalOrders'),
                      value: `${formatDashboardMetric(statistics?.production?.total)}${t('pages.dashboard.unitOrder')}`,
                    }}
                    isDark={isDark}
                    onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders?status=completed')}
                  />
                </div>

                {/* 质量概览 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0, height: dashboardKpiCardHeight }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'var(--ant-colorBgContainer)' : '#ffffff'}
                    title={t('pages.dashboard.statQualitySummary')}
                    mainValue={formatDashboardRate(statistics?.quality?.quality_rate)}
                    mainSuffix="%"
                    subtitle={t('pages.dashboard.kpiSubQualityInRange')}
                    rightTop={{
                      label: t('pages.dashboard.statQualityOpenSuffix'),
                      value: formatDashboardMetric(statistics?.quality?.open_exceptions),
                    }}
                    rightBottom={{
                      label: t('pages.dashboard.kpiSideTotalExceptions'),
                      value: formatDashboardMetric(statistics?.quality?.total_exceptions),
                    }}
                    isDark={isDark}
                    mainSemantic="quality_rate"
                    mainNumeric={statistics?.quality?.quality_rate ?? null}
                    onClick={() => navigate('/apps/kuaizhizao/quality-management')}
                  />
                </div>

              </Col>
            </Row>
            <Row
              gutter={[DASHBOARD_LAYOUT_GUTTER, DASHBOARD_LAYOUT_GUTTER]}
              className="dashboard-four-cards-row dashboard-bento-main-row"
              wrap={window.innerWidth < 1000}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'stretch',
                marginTop: DASHBOARD_LAYOUT_GUTTER,
              }}
            >
        <style>{`
          .dashboard-four-cards-row .ant-col { display: flex; align-items: stretch; min-height: 0; }
          .dashboard-four-cards-row .ant-card { min-height: 0; display: flex; flex-direction: column; }
          .dashboard-four-cards-row .ant-card .ant-card-body { flex: 1 1 0%; overflow: hidden; min-height: 0; display: flex; flex-direction: column; }
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
          .dashboard-bottom-card-tabs .ant-tabs-tabpane,
          .dashboard-kpi-strip-row * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          .dashboard-bottom-card-scroll::-webkit-scrollbar,
          .dashboard-bottom-card-tabs .ant-tabs-tabpane::-webkit-scrollbar,
          .dashboard-kpi-strip-row *::-webkit-scrollbar {
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
          style={{ display: 'flex', minHeight: 0 }}
        >
          <Card
            title={
              <Space>
                <PlayCircleOutlined />
                <span>{t('pages.dashboard.latestOperations')}</span>
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
            style={{
              width: '100%',
              borderRadius: dashboardCardRadius,
              boxShadow: dashboardCardShadow,
              height: dashboardBottomThreeCardsFixedHeight,
              minHeight: dashboardBottomThreeCardsFixedHeight,
              maxHeight: dashboardBottomThreeCardsFixedHeight,
            }}
            styles={{ 
              body: {
                flex: '1 1 0%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                padding: '0 24px 24px 24px',
                minHeight: 0,
              }
            }}
          >
            {productionBroadcast && productionBroadcast.length > 0 ? (
              <div className="dashboard-bottom-card-scroll" style={bottomCardListScrollBoxStyle}>
                {productionBroadcast.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 0',
                      borderBottom: index < productionBroadcast.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                    onClick={() => {
                      navigate(`/apps/kuaizhizao/production-execution/reporting?work_order=${item.work_order_no}`);
                    }}
                  >
                    <ProductionBroadcastOperatorAvatar
                      avatarUuid={item.operator_avatar}
                      displayName={item.operator_name}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 第 1 行：人员/工序 + 时间 */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4,
                          minWidth: 0,
                        }}
                      >
                        <Text strong style={{ fontSize: 14, flex: 1, minWidth: 0 }} ellipsis>
                          {item.operator_name} | {item.process_name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13, flexShrink: 0 }}>
                          {item.created_at ? dayjs(item.created_at).format('MM-DD HH:mm') : item.date}
                        </Text>
                      </div>
                      {/* 第 2 行：工单 + 产品（省略） + 合格/不合格 */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          minWidth: 0,
                        }}
                      >
                        <Text
                          type="secondary"
                          style={{ fontSize: 13, flex: 1, minWidth: 0, lineHeight: 1.45 }}
                          ellipsis={{ tooltip: true }}
                        >
                          {`${item.work_order_no}${item.product_name ? ` · ${item.product_name}` : ''}`}
                        </Text>
                        <Space size={6} style={{ flexShrink: 0 }}>
                          <Text type="success" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                            {t('pages.dashboard.qualified')} {item.qualified_quantity.toFixed(0)}
                          </Text>
                          {item.unqualified_quantity > 0 && (
                            <Text type="danger" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                              {t('pages.dashboard.unqualified')} {item.unqualified_quantity.toFixed(0)}
                            </Text>
                          )}
                        </Space>
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
          </Card>
        </Col>

        {/* 待办事项：大屏在右，md=14 */}
        <Col
          xs={24}
          sm={12}
          md={14}
          lg={14}
          style={{ display: 'flex', minHeight: 0 }}
        >
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
            style={{
              width: '100%',
              borderRadius: dashboardCardRadius,
              boxShadow: dashboardCardShadow,
              height: dashboardBottomThreeCardsFixedHeight,
              minHeight: dashboardBottomThreeCardsFixedHeight,
              maxHeight: dashboardBottomThreeCardsFixedHeight,
            }}
            styles={{ 
              body: {
                flex: '1 1 0%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                padding: '0 24px 24px 24px',
                minHeight: 0,
              }
            }}
          >
            {/*
              待办分类 Tab 顺序与 `src/apps/kuaizhizao/manifest.json` → menu_config.children 的 sort_order 一致：
              销售(1) → 采购(3) → 生产执行(4)：工单、异常 → 质量(5) → 设备(6) → 仓储(7)：入库侧、出库。
              计划(2)、绩效(10) 等模块无对应待办类型，不占用 Tab。
            */}
            <Tabs
              className="dashboard-bottom-card-tabs"
              style={{ flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}
              defaultActiveKey="all"
              items={[
                {
                  key: 'all',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabAll'), todos.length),
                  children: (
                    <div>
                      {todos.length > 0 ? (
                        <div>
                          {todos.map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < todos.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
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
                                  flexShrink: 0,
                                }}
                              >
                                <ClockCircleOutlined />
                              </Avatar>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    gap: 8,
                                    rowGap: 4,
                                    marginBottom: item.description || item.due_date ? 4 : 0,
                                  }}
                                >
                                  <Text strong={item.priority === 'high'} style={{ marginBottom: 0 }}>
                                    {item.title}
                                  </Text>
                                  <Tag color={priorityColorMap[item.priority]} style={{ margin: 0 }}>
                                    {priorityTextMap[item.priority]}{t('pages.dashboard.priorityLabel')}
                                  </Tag>
                                </div>
                                {item.description && (
                                  <Text type="secondary" style={{ fontSize: '14px', display: 'block', marginBottom: 4 }}>
                                    {item.description}
                                  </Text>
                                )}
                                {item.due_date && (
                                  <Text type="secondary" style={{ fontSize: '14px' }}>
                                    {t('pages.dashboard.dueDate')}：{dayjs(item.due_date).format('YYYY-MM-DD')}
                                  </Text>
                                )}
                              </div>
                              <Button
                                size="small"
                                type="primary"
                                style={{ flexShrink: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTodoMutation.mutate({ todoId: item.id, action: 'handle' });
                                }}
                              >
                                {t('pages.dashboard.handle')}
                              </Button>
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
                  key: 'sales',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabSales'), todosSales.length),
                  children: (
                    <div>
                      {todosSales.length > 0 ? (
                        <div>
                          {todosSales.map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < todosSales.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
                                cursor: 'pointer',
                              }}
                              onClick={() => item.link && navigate(item.link)}
                            >
                              <Text>{item.title}</Text>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty description={t('pages.dashboard.emptySalesTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'purchase',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabPurchase'), todosPurchase.length),
                  children: (
                    <div>
                      {todosPurchase.length > 0 ? (
                        <div>
                          {todosPurchase.map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < todosPurchase.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
                                cursor: 'pointer',
                              }}
                              onClick={() => item.link && navigate(item.link)}
                            >
                              <Text>{item.title}</Text>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty description={t('pages.dashboard.emptyPurchaseTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'work_order',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabWorkOrder'), todosWorkOrder.length),
                  children: (
                    <div>
                      {todosWorkOrder.length > 0 ? (
                        <div>
                          {todosWorkOrder.map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < todosWorkOrder.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabException'), todosException.length),
                  children: (
                    <div>
                      {todosException.length > 0 ? (
                        <div>
                          {todosException.map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < todosException.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                {
                  key: 'quality_inspection',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabQualityInspection'), todosQualityInspection.length),
                  children: (
                    <div>
                      {todosQualityInspection.length > 0 ? (
                        <div>
                          {todosQualityInspection.map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < todosQualityInspection.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
                                cursor: 'pointer',
                              }}
                              onClick={() => item.link && navigate(item.link)}
                            >
                              <Text>{item.title}</Text>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty description={t('pages.dashboard.emptyQualityInspectionTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'equipment',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabEquipment'), todosEquipment.length),
                  children: (
                    <div>
                      {todosEquipment.length > 0 ? (
                        <div>
                          {todosEquipment.map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < todosEquipment.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
                                cursor: 'pointer',
                              }}
                              onClick={() => item.link && navigate(item.link)}
                            >
                              <Text>{item.title}</Text>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty description={t('pages.dashboard.emptyEquipmentTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'warehouse',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabWarehouse'), todosWarehouse.length),
                  children: (
                    <div>
                      {todosWarehouse.length > 0 ? (
                        <div>
                          {todosWarehouse.map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < todosWarehouse.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
                                cursor: 'pointer',
                              }}
                              onClick={() => item.link && navigate(item.link)}
                            >
                              <Text>{item.title}</Text>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty description={t('pages.dashboard.emptyWarehouseTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </div>
                  ),
                },
                {
                  key: 'outbound',
                  label: formatDashboardTodoTabLabel(t('pages.dashboard.tabOutbound'), todosOutbound.length),
                  children: (
                    <div>
                      {todosOutbound.length > 0 ? (
                        <div>
                          {todosOutbound.map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < todosOutbound.length - 1 ? `1px solid ${token.colorBorder}` : 'none',
                                cursor: 'pointer',
                              }}
                              onClick={() => item.link && navigate(item.link)}
                            >
                              <Text>{item.title}</Text>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Empty description={t('pages.dashboard.emptyOutboundTodo')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>

      </Row>
          </div>
        </Col>

        <Col xs={24} lg={5} style={{ display: 'flex', flexDirection: 'column', gap: DASHBOARD_LAYOUT_GUTTER, minHeight: 0, minWidth: 0 }}>
          <Card
            className="dashboard-clock-date-card"
            style={{
              flexShrink: 0,
              width: '100%',
              minHeight: dashboardTopCardHeight,
              height: dashboardTopCardHeight,
              maxHeight: dashboardTopCardHeight,
              borderRadius: dashboardCardRadius,
              background: getWeatherAdaptiveTint(weatherForDashboard, isDark)
                ? `${getWeatherAdaptiveTint(weatherForDashboard, isDark)}, ${getDashboardTopBarTheme(isDark).clockCardBackground}`
                : getDashboardTopBarTheme(isDark).clockCardBackground,
              border: getDashboardTopBarCardBorder(isDark),
              boxShadow: getDashboardTopBarCardShadow(isDark),
              overflow: 'hidden',
              position: 'relative',
            }}
            styles={{
              body: {
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 0,
                background: 'transparent',
                borderRadius: dashboardCardRadius,
              },
            }}
          >
            <DashboardLcdClock
              time={currentTime}
              isDark={isDark}
              systemCount={systemTaskCount}
              personalCount={personalTaskCount}
              alertType={alertType}
              onAlarmClick={() => navigate('/personal/tasks')}
            />
            {showCalendarText ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Text
                  style={{
                    fontSize: 13,
                    color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(24,24,27,0.78)',
                    lineHeight: 1.35,
                    margin: 0,
                  }}
                >
                  {currentTime.format(t('pages.dashboard.dateFormatFull'))}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: isDark ? 'rgba(255,255,255,0.48)' : 'rgba(24,24,27,0.48)',
                    lineHeight: 1.35,
                  }}
                >
                  {t('pages.dashboard.lunarLabel')} {lunarDateStr}
                </Text>
              </div>
            ) : null}
          </Card>
          {/* 右侧下区：快捷入口 + 版本号，固定高度对齐左侧 */}
          <div
            className="dashboard-right-bottom-section"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              height: screens.lg ? dashboardRightSectionHeight : 'auto',
              maxHeight: screens.lg ? dashboardRightSectionHeight : 'none',
              overflow: 'hidden',
            }}
          >
            <div
              className="dashboard-bento-left-quick"
              style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <QuickEntryGrid
                title={
                  <Space>
                    <AppstoreOutlined />
                    <span>{t('pages.dashboard.quickEntry')}</span>
                  </Space>
                }
                items={quickEntryItems}
                loading={quickEntryLoading}
                menuTree={quickEntryMenuTreeData}
                showConfig={true}
                onSave={async (items: QuickEntryItem[]) => {
                  // 偏好设置需要可 JSON 序列化，不能保存 ReactNode（menu_icon）
                  const serializableItems = items.map(({ menu_icon, ...rest }) => rest);
                  // updatePreferences 直接写入 useUserPreferenceStore，组件会因 store 变更自动重渲染，无需再 invalidate queries
                  await updatePreferences({ dashboard_quick_entries: serializableItems });
                }}
                isDark={isDark}
                renderMenuIcon={(menuUuid: string) => {
                  if (!quickEntryMenuTree.length) return <ShopOutlined />;
                  const menu = findMenuInTree(quickEntryMenuTree, menuUuid);
                  return menu ? renderQuickEntryMenuIcon(menu) : <ShopOutlined />;
                }}
              />
            </div>
            <Card
              size="small"
              style={{
                borderRadius: dashboardCardRadius,
                boxShadow: dashboardCardShadow,
                flexShrink: 0,
                marginTop: DASHBOARD_LAYOUT_GUTTER,
              }}
              styles={{ body: { padding: '10px 14px', borderRadius: dashboardCardRadius } }}
            >
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Space size={4} align="center" wrap>
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    {t('pages.dashboard.versionLabel')}
                  </Text>
                  <Text code style={{ fontSize: 13 }}>
                    {(platformVersion?.git_commit || '').trim() || '—'}
                  </Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    disabled={!(platformVersion?.git_commit || '').trim()}
                    onClick={copyPlatformCommit}
                    aria-label={t('pages.dashboard.copyCommitAria')}
                  />
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('pages.dashboard.buildTimeLabel')}: {buildTimeDisplay}
                </Text>
              </Space>
            </Card>
          </div>

        </Col>
      </Row>
      </div>
      </div>

      </DashboardTemplate>

    </>
  );
}
