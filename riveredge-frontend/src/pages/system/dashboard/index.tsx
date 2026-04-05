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
  BulbOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { DashboardTemplate } from '../../../components/layout-templates';
import { PAGE_SPACING } from '../../../components/layout-templates/constants';
import { QuickEntryGrid, type QuickEntryItem } from '../../../components/quick-entry/QuickEntryGrid';
import { 
  getTodos, 
  getStatistics, 
  handleTodo, 
  getUserMessages,
  markMessagesRead,
  getProductionBroadcast,
  type TodoListResponse,
  type NotificationItem,
  type ProductionBroadcastItem,
} from '../../../services/dashboard';
import { getMenuTree, type MenuTree } from '../../../services/menu';
import { getBusinessConfig } from '../../../services/businessConfig';
import { filterMenuByBusinessConfig } from '../../../utils/menuBusinessFilter';
import {
  extractAppCodeFromPath,
  getAppDisplayName,
  translateAppMenuItemName,
  translateMenuName,
} from '../../../utils/menuTranslation';
import { getUserPreference, type UserPreference } from '../../../services/userPreference';
import { useUserPreferenceStore } from '../../../stores/userPreferenceStore';
import { ManufacturingIcons } from '../../../utils/manufacturingIcons';
import { getAvatarUrl, getAvatarText } from '../../../utils/avatar';
import { useGlobalStore } from '../../../stores';
import { useThemeStore } from '../../../stores/themeStore';
import { getUserInfo } from '../../../utils/auth';
import { getUserByUuid, getUserList } from '../../../services/user';
import WeatherWidget from '../../../components/weather/WeatherWidget';
import { getWeatherCardGradient } from '../../../components/weather/weatherBackground';
import type { WeatherData } from '../../../services/weather';
import { formatLunarDate } from '../../../utils/lunarDate';
import { APP_VERSION } from '../../../constants/version';
import * as LucideIcons from 'lucide-react';

const { Title, Text } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;


/**
 * 渲染菜单图标
 */
const renderMenuIcon = (menu: MenuTree): React.ReactNode => {
  const resolveIconByPath = (path?: string): React.ComponentType<any> | null => {
    if (!path) return null;
    const p = path.toLowerCase();
    const segments = p.split('/').filter(Boolean);
    const appCode = segments[1] || '';
    const moduleCode = segments[2] || '';

    // 1) 先按业务关键词精确匹配（单据优先）
    if (p.includes('work-order')) return LucideIcons.FileText;
    if (p.includes('reporting') || p.includes('report')) return LucideIcons.FileBarChart2;
    if (p.includes('inventory')) return LucideIcons.Boxes;
    if (p.includes('inbound') || p.includes('receipt') || p.includes('putaway')) return LucideIcons.ArrowDownToLine;
    if (p.includes('outbound') || p.includes('shipment') || p.includes('picking')) return LucideIcons.ArrowUpFromLine;
    if (p.includes('transfer') || p.includes('allocation')) return LucideIcons.ArrowLeftRight;
    if (p.includes('warning') || p.includes('alert')) return LucideIcons.AlertTriangle;
    if (p.includes('quality') || p.includes('inspection') || p.includes('iqc') || p.includes('oqc')) return LucideIcons.ClipboardCheck;
    if (p.includes('purchase')) return LucideIcons.ShoppingCart;
    if (p.includes('sales')) return LucideIcons.ReceiptText;
    if (p.includes('plan') || p.includes('scheduling')) return LucideIcons.CalendarClock;
    if (p.includes('equipment') || p.includes('maintenance')) return LucideIcons.Wrench;
    if (p.includes('master-data') || p.includes('base-data')) return LucideIcons.Database;

    // 2) 按模块匹配（保证全量菜单都能落到主题一致图标）
    const moduleIconMap: Record<string, React.ComponentType<any>> = {
      'sales-management': LucideIcons.ReceiptText,
      'purchase-management': LucideIcons.ShoppingCart,
      'warehouse-management': LucideIcons.Boxes,
      'production-execution': LucideIcons.FileText,
      'quality-management': LucideIcons.ClipboardCheck,
      'equipment-management': LucideIcons.Wrench,
      'plan-management': LucideIcons.CalendarClock,
      'performance-management': LucideIcons.Target,
      reports: LucideIcons.BarChart3,
      analytics: LucideIcons.BarChart3,
      'analysis-center': LucideIcons.BarChart3,
      'master-data': LucideIcons.Database,
    };
    if (moduleCode && moduleIconMap[moduleCode]) {
      return moduleIconMap[moduleCode];
    }

    // 3) 按应用匹配（最终兜底）
    const appIconMap: Record<string, React.ComponentType<any>> = {
      kuaicrm: LucideIcons.Users,
      kuaipdm: LucideIcons.Layers,
      kuaizhizao: LucideIcons.Factory,
      kuaichain: LucideIcons.GitBranch,
      kuaicaiwu: LucideIcons.Calculator,
      kuaireport: LucideIcons.BarChart3,
      'master-data': LucideIcons.Database,
      kuaiai: LucideIcons.Sparkles,
    };
    return appIconMap[appCode] || null;
  };

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
    // 业务单据相关（补全快捷入口常见场景）
    'FileSearchOutlined': LucideIcons.FileSearch,
    'FileDoneOutlined': LucideIcons.FileCheck,
    'FileAddOutlined': LucideIcons.FilePlus2,
    'FileProtectOutlined': LucideIcons.FileLock2,
    'FileExclamationOutlined': LucideIcons.FileWarning,
    'FileSyncOutlined': LucideIcons.FileClock,
    'ReconciliationOutlined': LucideIcons.ClipboardCheck,
    'AuditOutlined': LucideIcons.ClipboardCheck,
    'ContainerOutlined': LucideIcons.Boxes,
    'WarningOutlined': LucideIcons.AlertTriangle,
    'AlertOutlined': LucideIcons.AlertTriangle,
    'SwapOutlined': LucideIcons.ArrowLeftRight,
    'ImportOutlined': LucideIcons.ArrowDownToLine,
    'ExportOutlined': LucideIcons.ArrowUpFromLine,
  };
  const lowerCaseIconMap: Record<string, React.ComponentType<any>> = {
    order: LucideIcons.FileText,
    workorder: LucideIcons.FileText,
    work_order: LucideIcons.FileText,
    report: LucideIcons.FileBarChart2,
    reporting: LucideIcons.FileBarChart2,
    inventory: LucideIcons.Boxes,
    inbound: LucideIcons.ArrowDownToLine,
    outbound: LucideIcons.ArrowUpFromLine,
    transfer: LucideIcons.ArrowLeftRight,
    warning: LucideIcons.AlertTriangle,
    quality: LucideIcons.ClipboardCheck,
    inspection: LucideIcons.ClipboardCheck,
    purchase: LucideIcons.ShoppingCart,
    sales: LucideIcons.ReceiptText,
    plan: LucideIcons.CalendarClock,
    equipment: LucideIcons.Wrench,
    warehouse: LucideIcons.Boxes,
    production: LucideIcons.Factory,
    masterdata: LucideIcons.Database,
    'master-data': LucideIcons.Database,
  };

  // 先检查预定义映射
  if (menu.icon && lucideIconMap[menu.icon]) {
    const IconComponent = lucideIconMap[menu.icon];
    return React.createElement(IconComponent, { size: 24 });
  }

  // 尝试直接从 Lucide Icons 中获取
  if (menu.icon) {
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

    const normalizedIconName = iconName.toLowerCase().replace(/[\s-_]/g, '');
    if (lowerCaseIconMap[normalizedIconName]) {
      const IconComponent = lowerCaseIconMap[normalizedIconName];
      return React.createElement(IconComponent, { size: 24 });
    }
  }

  const pathIcon = resolveIconByPath(menu.path);
  if (pathIcon) {
    return React.createElement(pathIcon, { size: 24 });
  }

  // 最终兜底图标（主题一致）
  return React.createElement(LucideIcons.LayoutGrid, { size: 24 });
};

/**
 * 将菜单树转换为树形数据
 */
const getTranslatedMenuTitle = (
  menu: MenuTree,
  t: (key: string, options?: any) => string,
): string => {
  const findFirstPath = (children?: MenuTree[]): string | undefined => {
    if (!children?.length) return undefined;
    for (const child of children) {
      if (child.path) return child.path;
      const nested = findFirstPath(child.children);
      if (nested) return nested;
    }
    return undefined;
  };

  const effectivePath = menu.path || findFirstPath(menu.children);
  const appCode = extractAppCodeFromPath(effectivePath);

  if (effectivePath?.startsWith('/apps/')) {
    const translated = translateAppMenuItemName(menu.name, effectivePath, t, menu.children);
    // 仅应用根节点使用统一应用名，避免覆盖二/三级菜单真实翻译
    const isAppRootByPath = !!appCode && (menu.path || '').replace(/\/$/, '') === `/apps/${appCode}`;
    const isAppRootByNameKey = typeof menu.name === 'string' && /^app\.[a-z0-9-]+\.name$/i.test(menu.name);
    if (appCode && (isAppRootByPath || isAppRootByNameKey)) {
      const appDisplayName = getAppDisplayName(appCode, t, translated || menu.name);
      if (appDisplayName && appDisplayName.trim() !== '') {
        return appDisplayName;
      }
    }
    return translated;
  }
  return translateMenuName(menu.name, t, effectivePath);
};

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
      icon: renderMenuIcon(menu),
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
 * 从真实菜单树提取快捷入口候选（优先业务系统 /apps 路由）
 */
const buildQuickEntriesFromMenuTree = (
  menus: MenuTree[],
  renderIcon: (menu: MenuTree) => React.ReactNode,
  t: (key: string, options?: any) => string,
  limit = 10,
): QuickEntryItem[] => {
  const allPathMenus: MenuTree[] = [];

  const walk = (nodes: MenuTree[]) => {
    nodes.forEach((menu) => {
      if (menu.children?.length) {
        walk(menu.children);
      }
      if (menu.path && !menu.is_external && menu.path !== '/system/dashboard/workplace') {
        allPathMenus.push(menu);
      }
    });
  };

  walk(menus);

  const uniqueMenus = Array.from(
    new Map(allPathMenus.map((menu) => [menu.uuid, menu])).values(),
  );
  const businessMenus = uniqueMenus.filter((menu) => menu.path?.startsWith('/apps/'));
  const sourceMenus = businessMenus.length > 0 ? businessMenus : uniqueMenus;
  const priorityPatterns = [
    '/production-execution/work-orders',
    '/production-execution/reporting',
    '/warehouse-management/inventory',
    '/warehouse-management/inbound',
    '/warehouse-management/outbound',
    '/quality-management',
    '/equipment-management/equipment',
    '/equipment-management/maintenance',
    '/plan-management',
    '/master-data',
  ];

  const sortedMenus = [...sourceMenus].sort((a, b) => {
    const aPath = a.path || '';
    const bPath = b.path || '';
    const aPriority = priorityPatterns.findIndex((pattern) => aPath.includes(pattern));
    const bPriority = priorityPatterns.findIndex((pattern) => bPath.includes(pattern));
    const aRank = aPriority === -1 ? Number.MAX_SAFE_INTEGER : aPriority;
    const bRank = bPriority === -1 ? Number.MAX_SAFE_INTEGER : bPriority;
    if (aRank !== bRank) return aRank - bRank;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  return sortedMenus.slice(0, limit).map((menu, index) => ({
    menu_uuid: menu.uuid,
    menu_name: getTranslatedMenuTitle(menu, t),
    menu_path: menu.path || '',
    menu_icon: renderIcon(menu),
    sort_order: index,
  }));
};

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

/** 工作台日期区块：扁平模拟时钟（配色参考浅灰表盘 + 炭灰指针） */
const ANALOG_CLOCK = {
  face: '#E0E0E0',
  outer: '#F0F2F5',
  primary: '#2C3E50',
  muted: '#A0A0A0',
} as const;

function DashboardLcdClock({ time, compact, inline }: { time: dayjs.Dayjs; compact?: boolean; inline?: boolean }) {
  const { token } = useToken();
  const hour = time.hour();
  const minute = time.minute();
  const second = time.second();
  const ms = time.millisecond();

  const smoothSecond = second + ms / 1000;
  const hourDeg = (hour % 12) * 30 + minute * 0.5;
  const minuteDeg = minute * 6 + smoothSecond * (6 / 60);
  const secondDeg = smoothSecond * 6;

  /** inline：外框为圆角正方形，内留 2px，表盘略放大 */
  const inlineBox = compact ? 90 : 104;
  const size = inline ? inlineBox - 4 : compact ? 108 : 132;
  const cx = 50;
  const cy = 50;

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isMajor = i % 5 === 0;
    const a = (i * 6 - 90) * (Math.PI / 180);
    const r1 = isMajor ? 41 : 43;
    const r2 = isMajor ? 36 : 40.5;
    const x1 = cx + Math.cos(a) * r1;
    const y1 = cy + Math.sin(a) * r1;
    const x2 = cx + Math.cos(a) * r2;
    const y2 = cy + Math.sin(a) * r2;
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={isMajor ? ANALOG_CLOCK.primary : ANALOG_CLOCK.muted}
        strokeWidth={isMajor ? 1.4 : 0.55}
        strokeLinecap="round"
        opacity={isMajor ? 1 : 0.85}
      />
    );
  });

  return (
    <div
      style={{
        ...(inline
          ? {
              width: inlineBox,
              height: inlineBox,
              flexShrink: 0,
              borderRadius: token.borderRadiusLG,
              padding: 2,
            }
          : {
              width: '100%',
              borderRadius: token.borderRadiusLG,
              padding: compact ? '8px 10px' : '10px 12px',
            }),
        background: ANALOG_CLOCK.outer,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ display: 'block', maxWidth: '100%', height: 'auto', verticalAlign: 'middle' }}
        aria-hidden
      >
        <circle cx={cx} cy={cy} r={44} fill={ANALOG_CLOCK.face} />
        {ticks}
        {/* 指针默认朝 12 点（-Y），rotate(deg) 为从 12 点顺时针 */}
        <g transform={`rotate(${hourDeg} ${cx} ${cy})`}>
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - 20}
            stroke={ANALOG_CLOCK.primary}
            strokeWidth={3.2}
            strokeLinecap="round"
          />
        </g>
        <g transform={`rotate(${minuteDeg} ${cx} ${cy})`}>
          <line
            x1={cx}
            y1={cy}
            x2={cx}
            y2={cy - 28}
            stroke={ANALOG_CLOCK.primary}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </g>
        <g transform={`rotate(${secondDeg} ${cx} ${cy})`}>
          <line
            x1={cx}
            y1={cy + 6}
            x2={cx}
            y2={cy - 32}
            stroke={ANALOG_CLOCK.muted}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
        </g>
        <circle cx={cx} cy={cy} r={2.4} fill={ANALOG_CLOCK.primary} />
      </svg>
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
}) {
  const { token } = useToken();
  const text = {
    title: isDark ? 'rgba(255,255,255,0.8)' : '#64748b',
    main: isDark ? '#ffffff' : '#0f172a',
    secondary: isDark ? 'rgba(255,255,255,0.9)' : '#475569',
    muted: isDark ? 'rgba(255,255,255,0.6)' : '#94a3b8',
    divider: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15, 23, 42, 0.1)',
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
          padding: '18px 18px',
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 14,
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
              lineHeight: 1.15,
            }}
          >
            {mainValue}
          </span>
          {mainSuffix ? (
            <span style={{ fontSize: 14, color: text.secondary }}>{mainSuffix}</span>
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
          gap: 11,
          textAlign: 'right',
          minWidth: 64,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div>
          <div style={{ fontSize: 14, color: text.title, marginBottom: 2, lineHeight: 1.3 }}>
            {rightTop.label}
          </div>
          <div
            style={{
              fontSize: 18,
              color: text.secondary,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {rightTop.value}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, color: text.title, marginBottom: 2, lineHeight: 1.3 }}>
            {rightBottom.label}
          </div>
          <div
            style={{
              fontSize: 18,
              color: text.secondary,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.2,
            }}
          >
            {rightBottom.value}
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * 工作台页面组件
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useToken();
  const screens = useBreakpoint();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  // 右侧两个小统计卡在空间不足时优先隐藏，避免欢迎区内容换行
  const showUserStatTiles = !!screens.xxl;
  // 首行宽度不足时，日历卡仅显示模拟时钟，避免撑高布局
  const showCalendarText = !!screens.xxl;
  /** 工作台卡片：圆角与阴影与 Ant Design 系统 token 一致，阴影用较轻的 tertiary */
  const dashboardCardRadius = token.borderRadiusLG;
  const dashboardCardShadow = token.boxShadowTertiary;
  // 首行四卡统一固定高度
  const dashboardTopCardHeight = 126;
  const currentUser = useGlobalStore((s) => s.currentUser);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  /**
   * 三列底部卡片最小高度（待办/消息/最新报工）：
   * 视口高度 - 顶栏 - 标签栏 - 页面上下边距 - 顶部便当行 - 指标+日历行 - 行间距
   */
  const dashboardBottomCardsMinHeight =
    'calc(100vh - var(--header-height, 56px) - var(--tabs-height, 56px) - 452px)';

  /** 天气数据：用于首行天气区块背景渐变 */
  const [weatherForDashboard, setWeatherForDashboard] = useState<WeatherData | null>(null);

  // 时间范围筛选器状态
  const [timeRange, setTimeRange] = useState<
    'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'last7days' | 'last30days'
  >('thisMonth');

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
  const calendarDayKey = currentTime.format('YYYY-MM-DD');
  const lunarDateStr = useMemo(
    () => formatLunarDate(dayjs(calendarDayKey, 'YYYY-MM-DD')),
    [calendarDayKey],
  );
  
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
  const { data: notificationsData, isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery<NotificationItem[]>({
    queryKey: ['user-messages'],
    queryFn: () => getUserMessages(1, 20, false), // 获取前20条消息，包括已读和未读
    refetchInterval: 60000, // 每60秒自动刷新
    retry: 2, // 失败时重试2次
  });

  const notifications = useMemo(() => Array.isArray(notificationsData) ? notificationsData : [], [notificationsData]);

  // 获取待办事项（使用真实API）
  const { data: todosResult, isLoading: todosLoading, refetch: refetchTodos } = useQuery<TodoListResponse>({
    queryKey: ['dashboard-todos'],
    queryFn: () => getTodos(20),
    refetchInterval: 30000,
  });

  const todos = useMemo(() => todosResult?.items || [], [todosResult]);

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
  const { data: menuTree, isLoading: menuTreeLoading } = useQuery({
    queryKey: ['dashboard-menu-tree'],
    queryFn: () => getMenuTree({ is_active: true }),
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 获取业务配置（蓝图设置），用于菜单过滤
  const { data: businessConfig, isLoading: businessConfigLoading } = useQuery({
    queryKey: ['businessConfig'],
    queryFn: getBusinessConfig,
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  // 按蓝图设置过滤菜单树，与侧边栏保持一致
  const filteredMenuTree = useMemo(() => {
    if (!menuTree) return [];
    return filterMenuByBusinessConfig(menuTree, businessConfig ?? undefined);
  }, [menuTree, businessConfig]);
  // 快捷入口兜底：若业务过滤结果为空，回退到原始菜单树，避免刷新后整块空白
  const quickEntryMenuTree = useMemo(() => {
    if (filteredMenuTree.length > 0) return filteredMenuTree;
    return menuTree || [];
  }, [filteredMenuTree, menuTree]);

  // 获取生产播报（使用真实API）
  const { data: productionBroadcastData, isLoading: productionBroadcastLoading } = useQuery<ProductionBroadcastItem[]>({
    queryKey: ['production-broadcast'],
    queryFn: () => getProductionBroadcast(5),
    refetchInterval: 60000,
  });

  const productionBroadcast = useMemo(() => Array.isArray(productionBroadcastData) ? productionBroadcastData : [], [productionBroadcastData]);

  // 获取用户偏好设置
  const { data: userPreference, isLoading: userPreferenceLoading } = useQuery<UserPreference>({
    queryKey: ['dashboard-user-preference'],
    queryFn: getUserPreference,
    staleTime: 5 * 60 * 1000,
  });
  const quickEntryLoading = userPreferenceLoading || menuTreeLoading || (!!currentUser && businessConfigLoading);

  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);

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
  const getMenuIconByPath = (menuPath: string, menuName?: string): React.ReactNode => {
    const pseudoMenu = {
      uuid: menuPath || 'quick-entry',
      tenant_id: 0,
      name: menuName || menuPath || '',
      path: menuPath,
      sort_order: 0,
      is_active: true,
      is_external: false,
      created_at: '',
      updated_at: '',
      children: [],
    } as MenuTree;
    return renderMenuIcon(pseudoMenu);
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

  // 未读通知数量
  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

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
        padding: '4px 12px 4px 14px',
        cursor: 'pointer',
        minWidth: 92,
        whiteSpace: 'nowrap',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        borderLeft: '1px solid rgba(255,255,255,0.32)',
      }}
    >
      <Space size={4} align="center" wrap={false}>
        <BellOutlined style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', flexShrink: 0 }} />
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: 0, whiteSpace: 'nowrap' }}>
          {t('pages.dashboard.realtimeMessages')}
        </Text>
      </Space>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#fff',
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
        }}
      >
        {unreadCount}
      </div>
    </div>
  );

  const todoStatTile = (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/apps/kuaizhizao/production-execution/work-orders');
        }
      }}
      style={{
        padding: '4px 0 4px 14px',
        cursor: 'pointer',
        minWidth: 92,
        whiteSpace: 'nowrap',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        borderLeft: '1px solid rgba(255,255,255,0.32)',
      }}
    >
      <Space size={4} align="center" wrap={false}>
        <ClockCircleOutlined style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', flexShrink: 0 }} />
        <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: 0, whiteSpace: 'nowrap' }}>
          {t('pages.dashboard.todoPendingShort')}
        </Text>
      </Space>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#fff',
          marginTop: 4,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
        }}
      >
        {todos.length}
      </div>
    </div>
  );

  return (
    <>
      <DashboardTemplate
        quickActions={[]}
        showConfigButton={false}
      >
      {/* 欢迎条+指标条+4卡 占满 uni-tabs-content 高度，不滚动，布局固定 */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 边距在 overflow 内侧，避免略超出卡片的装饰（灯泡等）被裁切 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          /* 顶略小于左右：标签区已有 margin-top，这里只补够防裁切（灯泡 top:-9px、阴影） */
          padding: `16px ${PAGE_SPACING.PADDING}px ${PAGE_SPACING.PADDING}px ${PAGE_SPACING.PADDING}px`,
        }}
      >
      {/* 第一行便当：人员 / 操作提示 / 日期+钟 / 天气；xl 栅格 9+5+5+5=24 */}
      <Row
        gutter={[16, 16]}
        align="stretch"
        className="dashboard-bento-top-row"
        style={{ marginBottom: 16, flexShrink: 0 }}
      >
        <Col xs={24} sm={12} lg={12} xl={9} style={{ display: 'flex' }}>
          <Card
            style={{
              marginTop: 0,
              flex: 1,
              width: '100%',
              height: dashboardTopCardHeight,
              minHeight: dashboardTopCardHeight,
              maxHeight: dashboardTopCardHeight,
              borderRadius: dashboardCardRadius,
              border: 'none',
              background: `linear-gradient(145deg, ${token.colorPrimary} 0%, ${token.colorPrimaryActive} 100%)`,
              boxShadow: dashboardCardShadow,
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
              },
            }}
          >
            <div style={{ width: '100%' }}>
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
                <Space size="large" align="center">
                  <div
                    style={{
                      position: 'relative',
                      padding: 4,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.2)',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
                      flexShrink: 0,
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
                        border: '2px solid rgba(255,255,255,0.85)',
                      }}
                    >
                      {!avatarUrl && getAvatarText(currentUser?.full_name || userInfo?.full_name, currentUser?.username || userInfo?.username)}
                    </Avatar>
                  </div>
                  <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <Title
                      level={4}
                      style={{
                        margin: '0 0 8px 0',
                        fontWeight: 700,
                        color: '#fff',
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
                            color: 'rgba(255,255,255,0.95)',
                            background: 'rgba(255,255,255,0.18)',
                            border: '1px solid rgba(255,255,255,0.35)',
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
                    {todoStatTile}
                  </Space>
                ) : null}
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={12} xl={5} style={{ display: 'flex' }}>
          <Card
            style={{
              flex: 1,
              width: '100%',
              minHeight: dashboardTopCardHeight,
              height: dashboardTopCardHeight,
              maxHeight: dashboardTopCardHeight,
              borderRadius: dashboardCardRadius,
              border: 'none',
              background: getWeatherCardGradient(weatherForDashboard),
              boxShadow: dashboardCardShadow,
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
            <WeatherWidget onWeatherChange={setWeatherForDashboard} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={12} xl={5} style={{ display: 'flex' }}>
          <Card
            className="dashboard-clock-date-card"
            style={{
              flex: 1,
              width: '100%',
              minHeight: dashboardTopCardHeight,
              height: dashboardTopCardHeight,
              maxHeight: dashboardTopCardHeight,
              borderRadius: dashboardCardRadius,
              border: `1px solid ${token.colorBorderSecondary}`,
              boxShadow: dashboardCardShadow,
              overflow: 'hidden',
            }}
            styles={{
              body: {
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: showCalendarText ? 'flex-start' : 'center',
                gap: 14,
                minHeight: 0,
                /* 背景由 .dashboard-clock-date-card 极浅渐变提供 */
                background: 'transparent',
                /* Ant Design 无标题时 body 默认仅下圆角，白底会露出上直角 */
                borderRadius: dashboardCardRadius,
              },
            }}
          >
            <DashboardLcdClock time={currentTime} compact={false} inline />
            {showCalendarText ? (
              <Space orientation="vertical" size={2} style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: token.colorTextSecondary,
                    lineHeight: 1.35,
                    margin: 0,
                  }}
                >
                  {currentTime.format(t('pages.dashboard.dateFormatFull'))}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: token.colorTextTertiary ?? token.colorTextSecondary,
                    lineHeight: 1.35,
                    margin: 0,
                  }}
                >
                  {t('pages.dashboard.lunarLabel')} {lunarDateStr}
                </Text>
              </Space>
            ) : null}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={12} xl={5} style={{ display: 'flex', overflow: 'visible' }}>
          <div
            className="dashboard-workplace-tip-card"
            style={{
              flex: 1,
              width: '100%',
              minHeight: dashboardTopCardHeight,
              height: dashboardTopCardHeight,
              maxHeight: dashboardTopCardHeight,
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              alignSelf: 'stretch',
              overflow: 'visible',
              borderRadius: dashboardCardRadius,
              boxShadow: dashboardCardShadow,
            }}
          >
            <div className="dashboard-workplace-tip-bulb-wrap" aria-hidden>
              <BulbOutlined
                style={{
                  fontSize: 46,
                  color: token.colorWarning,
                  display: 'block',
                }}
              />
            </div>
            <div
              className="dashboard-workplace-tip-body"
              style={{
                width: '100%',
                color: token.colorText,
                lineHeight: 1.6,
              }}
            >
              <Text strong style={{ fontSize: 14, color: token.colorText, display: 'block', marginBottom: 6 }}>
                {t('pages.dashboard.workplaceTips')}
              </Text>
              <div
                key={tipIndex}
                className="dashboard-workplace-tip-text"
                style={{
                  animation: 'workplace-tip-in 0.4s ease-out',
                }}
              >
                <Text type="secondary" style={{ fontSize: 14, display: 'block' }}>
                  {currentTip}
                </Text>
              </div>
            </div>
            <style>{`
              @keyframes workplace-tip-in {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </div>
        </Col>
        
      </Row>

      {/* 主区：左侧快捷+版本 | 右侧 KPI + 日期条 + 三列表（示意图） */}
      <Row gutter={[16, 16]} align="stretch" className="dashboard-main-body" style={{ flex: 1, minHeight: 0 }}>
        <Col xs={24} lg={5} style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, minWidth: 0 }}>
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
              items={useMemo(() => {
                if (quickEntryLoading) {
                  return [];
                }
                const quickEntries = userPreference?.preferences?.dashboard_quick_entries as QuickEntryItem[] | undefined;

                // 用户偏好优先：只要有保存项，始终优先展示用户自己的快捷入口
                if (Array.isArray(quickEntries) && quickEntries.length > 0) {
                  return quickEntries
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((entry) => {
                      const menu = quickEntryMenuTree.length ? findMenuInTree(quickEntryMenuTree, entry.menu_uuid) : null;
                      const resolvedPath = entry.menu_path || menu?.path || '';
                      if (!resolvedPath) return null;

                      return {
                        ...entry,
                        menu_name: entry.menu_name || (menu ? getTranslatedMenuTitle(menu, t) : ''),
                        menu_path: resolvedPath,
                        menu_icon: menu ? renderMenuIcon(menu) : getMenuIconByPath(resolvedPath, entry.menu_name),
                      };
                    })
                    .filter((item): item is any => item !== null);
                }

                if (!quickEntryMenuTree.length) {
                  return [];
                }

                // 无用户配置时：直接使用真实业务菜单生成快捷入口
                return buildQuickEntriesFromMenuTree(quickEntryMenuTree, renderMenuIcon, t, 10);
              }, [quickEntryLoading, userPreference, quickEntryMenuTree, t])}
              loading={quickEntryLoading}
              menuTree={useMemo(() => {
                if (!quickEntryMenuTree.length) return [];
                return convertMenuTreeToTreeData(quickEntryMenuTree, t);
              }, [quickEntryMenuTree, t])}
              showConfig={true}
              onSave={async (items: QuickEntryItem[]) => {
                // 偏好设置需要可 JSON 序列化，不能保存 ReactNode（menu_icon）
                const serializableItems = items.map(({ menu_icon, ...rest }) => rest);
                await updatePreferences({ dashboard_quick_entries: serializableItems });
                queryClient.invalidateQueries({ queryKey: ['dashboard-user-preference'] });
              }}
              renderMenuIcon={(menuUuid: string) => {
                if (!quickEntryMenuTree.length) return <ShopOutlined />;
                const menu = findMenuInTree(quickEntryMenuTree, menuUuid);
                return menu ? renderMenuIcon(menu) : <ShopOutlined />;
              }}
            />
          </div>
          <Card
            size="small"
            style={{ borderRadius: dashboardCardRadius, boxShadow: dashboardCardShadow, flexShrink: 0 }}
            styles={{ body: { padding: '10px 14px', borderRadius: dashboardCardRadius } }}
          >
            <Text type="secondary" style={{ fontSize: 14 }}>
              {t('pages.dashboard.versionLabel')} v{APP_VERSION}
            </Text>
          </Card>
        </Col>

        {/* 主体第二块：19；内部再分两层 7773 / 7710 */}
        <Col xs={24} lg={19} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <Row
              gutter={[16, 16]}
              wrap={!screens.lg}
              align="stretch"
              className="dashboard-kpi-strip-row"
              style={{ flexShrink: 0 }}
            >
              <Col xs={24} lg={7} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 工单总数 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'linear-gradient(102deg, #1d2633 0%, #1a2230 45%, #161e2b 100%)' : 'linear-gradient(102deg, #eef2f7 0%, #e6edf6 45%, #dfe8f3 100%)'}
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
                    onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
                  />
                </div>
                {/* 完工数量 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'linear-gradient(102deg, #2a261f 0%, #252118 50%, #201c15 100%)' : 'linear-gradient(102deg, #f7f4ef 0%, #f0ebe4 50%, #e8e2d9 100%)'}
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
                    onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders')}
                  />
                </div>
              </Col>
              <Col xs={24} lg={7} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 进行中工单 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'linear-gradient(102deg, #1c2a31 0%, #18262d 50%, #15222a 100%)' : 'linear-gradient(102deg, #ecf4f7 0%, #e3eef4 50%, #dbe8ef 100%)'}
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
                    onClick={() => navigate('/apps/kuaizhizao/production-execution/work-orders?status=in_progress')}
                  />
                </div>
                {/* 库存预警 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'linear-gradient(102deg, #23272d 0%, #1f2329 50%, #1b1f24 100%)' : 'linear-gradient(102deg, #f1f3f5 0%, #eaecef 50%, #e3e6ea 100%)'}
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
                    onClick={() => navigate('/apps/kuaizhizao/warehouse-management/inventory')}
                  />
                </div>
              </Col>
              <Col xs={24} lg={7} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 工单完成率 */}
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'linear-gradient(102deg, #1f2a26 0%, #1a2521 48%, #15201c 100%)' : 'linear-gradient(102deg, #f0f5f2 0%, #e8f0eb 48%, #dfe9e3 100%)'}
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
                <div style={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
                  <DashboardKpiRichCard
                    gradient={isDark ? 'linear-gradient(102deg, #292327 0%, #241f23 48%, #1f1a1e 100%)' : 'linear-gradient(102deg, #f5f1f3 0%, #ede8ec 48%, #e6dfe5 100%)'}
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
                    onClick={() => navigate('/apps/kuaizhizao/quality-management')}
                  />
                </div>
              </Col>
              <Col
                xs={24}
                lg={3}
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
                        block
                        className="dashboard-date-strip-btn"
                        style={{ flex: '1 1 0', minHeight: 0, height: 'auto' }}
                        onClick={() => setTimeRange(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </Col>
            </Row>
            <Row
              gutter={[16, 16]}
              className="dashboard-four-cards-row dashboard-bento-main-row"
              wrap={!screens.lg}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'stretch',
                marginTop: 16,
                // 强制底部三卡占满剩余工作区高度，避免出现底部大片空白
                height: 'auto',
                maxHeight: 'none',
                minHeight: dashboardBottomCardsMinHeight,
              }}
            >
        <style>{`
          .dashboard-four-cards-row .ant-col { display: flex; height: 100%; }
          .dashboard-four-cards-row .ant-card { height: 100%; display: flex; flex-direction: column; }
          .dashboard-four-cards-row .ant-card .ant-card-body { flex: 1; overflow: auto; min-height: 0; }
        `}</style>

        {/* 待办事项 */}
        <Col
          xs={24}
          sm={12}
          md={8}
          lg={7}
          style={{ display: 'flex' }}
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
              minHeight: dashboardBottomCardsMinHeight,
              height: '100%',
            }}
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
                                  <Text type="secondary" style={{ fontSize: '14px', display: 'block', marginBottom: 4 }}>
                                    {item.description}
                                  </Text>
                                )}
                                {item.due_date && (
                                  <Text type="secondary" style={{ fontSize: '14px' }}>
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

        {/* 消息通知 */}
        <Col
          xs={24}
          sm={12}
          md={8}
          lg={7}
          style={{ display: 'flex' }}
        >
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
            style={{
              width: '100%',
              borderRadius: dashboardCardRadius,
              boxShadow: dashboardCardShadow,
              minHeight: dashboardBottomCardsMinHeight,
              height: '100%',
            }}
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
                        <Text strong={!item.read} style={{ fontSize: 14 }}>{item.title}</Text>
                        {!item.read && <Badge dot />}
                      </Space>
                    </div>
                    <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                      {item.content}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      {dayjs(item.time).format('MM-DD HH:mm')}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                description="暂无消息通知"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '40px 0' }}
              />
            )}
          </Card>
        </Col>

        {/* 最新操作（生产播报） */}
        <Col
          xs={24}
          sm={12}
          md={8}
          lg={10}
          style={{ display: 'flex' }}
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
              minHeight: dashboardBottomCardsMinHeight,
              height: '100%',
            }}
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
                        <Text strong style={{ fontSize: 14 }}>
                          {item.operator_name} | {item.process_name}
                        </Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 14 }}>
                        {item.created_at ? dayjs(item.created_at).format('MM-DD HH:mm') : item.date}
                      </Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                      {t('pages.dashboard.labelWorkOrderNo')}：{item.work_order_no}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                      {t('pages.dashboard.labelProduct')}：{item.product_code} | {item.product_name}
                    </Text>
                    <Space>
                      <Text type="success" style={{ fontSize: 14 }}>
                        {t('pages.dashboard.qualified')} {item.qualified_quantity.toFixed(0)}
                      </Text>
                      {item.unqualified_quantity > 0 && (
                        <Text type="danger" style={{ fontSize: 14 }}>
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
      </Row>
          </div>
        </Col>
      </Row>
      </div>
      </div>

      </DashboardTemplate>

    </>
  );
}
