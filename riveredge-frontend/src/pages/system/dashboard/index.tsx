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

import React, { useState, useMemo, useEffect, useCallback, Suspense, lazy } from 'react';
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
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { DashboardTemplate } from '../../../components/layout-templates';
import { PAGE_SPACING } from '../../../components/layout-templates/constants';
import { QuickEntryGrid, type QuickEntryItem } from '../../../components/quick-entry/QuickEntryGrid';
import { 
  getTodos, 
  getStatistics, 
  handleTodo, 
  getProductionBroadcast,
  type TodoListResponse,
  type ProductionBroadcastItem,
} from '../../../services/dashboard';
import { getUserMessageStats, type UserMessageStats } from '../../../services/userMessage';
import { getMenuTree, type MenuTree } from '../../../services/menu';
import {
  extractAppCodeFromPath,
  getAppDisplayName,
  translateAppMenuItemName,
  translateMenuName,
} from '../../../utils/menuTranslation';
import type { UserPreference } from '../../../services/userPreference';
import { useUserPreferenceStore } from '../../../stores/userPreferenceStore';
import { ManufacturingIcons } from '../../../utils/manufacturingIcons';
import { getAvatarUrl, getAvatarText, getCachedAvatarUrl } from '../../../utils/avatar';
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
import { getUserTaskStats, getUserTasks, type UserTask } from '../../../services/userTask';

const LottiePlayer = lazy(() => import('lottie-react').then((m) => ({ default: m.default })));

const { Title, Text, Paragraph } = Typography;
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
      kuaizhizao: LucideIcons.Factory,
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

function DashboardLcdClock({ 
  time, 
  inline, 
  isDark, 
  systemCount = 0, 
  personalCount = 0,
  onAlarmClick,
  alertType = 'none' 
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

  // 仿真设计：表盘背景和数字颜色随系统“关灯”而变
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
      alarmColor = isDark ? '#9ca3af' : '#6b7280'; // 灰色
      alarmFilter = isDark ? 'drop-shadow(0 0 8px #9ca3af)' : 'drop-shadow(0 0 5px rgba(107, 114, 128, 0.4))';
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
        /* 仿真表盘：暗黑时 VFD，明亮时 LCD */
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
        border: isDark ? `1px solid rgba(74, 222, 128, 0.3)` : `1px solid rgba(0,0,0,0.15)`,
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
          top: 0, left: 0, right: 0, height: '45%', 
          background: 'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none',
          opacity: 0.6
        }} 
      />
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
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
            textShadow: isDark ? '0 0 7px rgba(125, 232, 174, 0.2)' : '0 1px 0 rgba(255,255,255,0.55)',
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
        borderLeft: `1px solid rgba(0,0,0,0.06)`,
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
    return isDark ? '#ffffff' : '#0f172a';
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
      return isDark ? '#ffffff' : '#0f172a';
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
  /** 底部待办 / 最新操作两卡统一固定高度（整张 Card，含标题栏），列表在卡片内滚动 */
  const dashboardBottomThreeCardsFixedHeight = 500;
  /** 卡片内列表区：占满 body 剩余空间并滚动 */
  const bottomCardListScrollBoxStyle: React.CSSProperties = {
    flex: '1 1 0%',
    minHeight: 0,
    overflowX: 'hidden',
    overflowY: 'auto',
  };
  const currentUser = useGlobalStore((s) => s.currentUser);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [tipAnimationData, setTipAnimationData] = useState<object | null>(null);

  // 加载提示动画
  useEffect(() => {
    import('../../../../static/lottie/tips.json').then((m) => setTipAnimationData(m.default));
  }, []);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
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
  // 与 BasicLayout 的 useUnifiedMenuData 共用 queryKey ['applicationMenus']，
  // 避免工作台与侧边栏重复拉 /menus/tree（在 staleTime 内 react-query 会命中缓存）
  const { data: menuTree, isLoading: menuTreeLoading } = useQuery({
    queryKey: ['applicationMenus'],
    queryFn: () => getMenuTree({ is_active: true }),
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

  // 未读通知数量（复用顶栏 userMessageStats 接口，无需再拉消息列表）
  const unreadCount = messageStats?.unread ?? 0;

  // 优先级颜色映射
  const priorityColorMap: Record<string, string> = {
    high: 'error',
    critical: 'error',
    medium: 'warning',
    low: 'default',
  };

  // 优先级文本映射（i18n）
  const priorityTextMap: Record<string, string> = useMemo(() => ({
    high: t('pages.dashboard.priorityHigh'),
    critical: t('pages.dashboard.priorityHigh'),
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
          /* 顶/左右留白；底边 0 贴内容区底，避免底部两卡下方大块留白 */
          padding: `16px ${PAGE_SPACING.PADDING}px 0 ${PAGE_SPACING.PADDING}px`,
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
              /* 继续调浅：从深黑灰向更有质感的钛金灰进阶 */
              background: 'linear-gradient(135deg, #636e7b 0%, #545e6b 100%)',
              border: '1px solid #788699',
              boxShadow: `
                0 4px 12px rgba(0,0,0,0.1), 
                inset 0 1px 0 rgba(255,255,255,0.2)
              `,
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
                    color: 'rgba(255,255,255,0.85)', // 始终浅色文字，因为卡片始终深色
                    lineHeight: 1.35,
                    margin: 0,
                  }}
                >
                  {currentTime.format(t('pages.dashboard.dateFormatFull'))}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.45)', // 始终浅色文字
                    lineHeight: 1.35,
                  }}
                >
                  {t('pages.dashboard.lunarLabel')} {lunarDateStr}
                </Text>
              </div>
            ) : null}
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={12} xl={5} style={{ display: 'flex', overflow: 'visible' }}>
          <Card
            className="dashboard-workplace-tip-card"
            variant="borderless"
            style={{
              flex: 1,
              width: '100%',
              minHeight: dashboardTopCardHeight,
              height: dashboardTopCardHeight,
              maxHeight: dashboardTopCardHeight,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignSelf: 'stretch',
              overflow: 'hidden',
              borderRadius: dashboardCardRadius, // 圆角跟随系统
              /* 拟真便利贴：纸张暖黄渐变 */
              background: 'linear-gradient(135deg, #fffde6 0%, #fff3b0 100%)',
              border: '1px solid #ffe58f',
              boxShadow: `
                2px 4px 12px rgba(0,0,0,0.08), 
                0 0 1px rgba(0,0,0,0.05)
              `,
            }}
            styles={{
              body: {
                padding: '4px 14px 4px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                height: '100%',
                position: 'relative',
              },
            }}
          >
            <div 
              style={{ 
                position: 'absolute',
                left: 0,
                top: 16,
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }} 
              aria-hidden
            >
              {tipAnimationData ? (
                <Suspense fallback={<div style={{ width: 40, height: 40 }} />}>
                  <LottiePlayer
                    animationData={tipAnimationData}
                    loop
                    style={{ width: 64, height: 64 }}
                  />
                </Suspense>
              ) : (
                <div style={{ width: 40, height: 40 }} />
              )}
            </div>
            <div
              className="dashboard-workplace-tip-body"
              style={{
                flex: 1,
                minWidth: 0,
                color: token.colorText,
                lineHeight: 1.45,
                paddingLeft: 46,
                paddingTop: 0, // 文本贴顶
              }}
            >
              <Text strong style={{ fontSize: 13.5, color: '#856404', display: 'block', marginBottom: 2 }}>
                {t('pages.dashboard.workplaceTips')}
              </Text>
              <Paragraph
                key={tipIndex}
                ellipsis={{ rows: 3 }}
                style={{ 
                  fontSize: 13, 
                  lineHeight: 1.5, 
                  marginBottom: 0,
                  color: '#927238',
                  animation: 'workplace-tip-in 0.4s ease-out',
                }}
              >
                {currentTip}
              </Paragraph>
            </div>
            <style>{`
              @keyframes workplace-tip-in {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </Card>
        </Col>
        
      </Row>

      {/* 主区：左侧快捷+版本 | 右侧 KPI + 日期条 + 三列表（示意图） */}
      <Row gutter={[16, 16]} align="stretch" className="dashboard-main-body" style={{ flexShrink: 0 }}>
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
                // updatePreferences 直接写入 useUserPreferenceStore，组件会因 store 变更自动重渲染，无需再 invalidate queries
                await updatePreferences({ dashboard_quick_entries: serializableItems });
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
          <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', minWidth: 0 }}>
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
                    mainSemantic="work_order_total"
                    mainNumeric={statistics?.production?.total ?? null}
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
                    mainSemantic="output_quantity"
                    mainNumeric={statistics?.production?.completed_quantity ?? null}
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
                    mainSemantic="work_order_wip"
                    mainNumeric={statistics?.production?.in_progress ?? null}
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
                    mainSemantic="inventory_alert"
                    mainNumeric={statistics?.inventory?.alert_count ?? null}
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
                    mainSemantic="quality_rate"
                    mainNumeric={statistics?.quality?.quality_rate ?? null}
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
                flexShrink: 0,
                display: 'flex',
                alignItems: 'stretch',
                marginTop: 16,
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
          .dashboard-four-cards-row .dashboard-bottom-card-tabs .ant-tabs-tabpane {
            height: 100%;
            overflow: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .dashboard-four-cards-row .dashboard-bottom-card-tabs .ant-tabs-tabpane::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }
          /* 最新操作列表：可滚动但不显示滚动条 */
          .dashboard-four-cards-row .dashboard-bottom-card-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .dashboard-four-cards-row .dashboard-bottom-card-scroll::-webkit-scrollbar {
            display: none;
            width: 0;
            height: 0;
          }
        `}</style>

        {/* 待办事项 */}
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
                          {todos.slice(0, 5).map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todos.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                          {todosSales.slice(0, 5).map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todosSales.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                          {todosPurchase.slice(0, 5).map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todosPurchase.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                          {todosWorkOrder.slice(0, 5).map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todosWorkOrder.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                          {todosException.slice(0, 5).map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todosException.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                          {todosQualityInspection.slice(0, 5).map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todosQualityInspection.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                          {todosEquipment.slice(0, 5).map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todosEquipment.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                          {todosWarehouse.slice(0, 5).map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todosWarehouse.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
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
                          {todosOutbound.slice(0, 5).map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                padding: '12px 0',
                                borderBottom: index < Math.min(todosOutbound.length, 5) - 1 ? `1px solid ${token.colorBorder}` : 'none',
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


        {/* 最新操作（生产播报） */}
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
                      alignItems: 'flex-start',
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
