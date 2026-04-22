/**
 * 运营看板 - 平台运营驾驶舱
 *
 * 科幻蓝风格三栏布局：
 * - 左栏：组织状态分布（上） / 组织套餐分布（下）
 * - 中栏：核心指标装饰（上） / 注册·登录趋势（下）
 * - 右栏：注册地区 TOP10（上） / 登录地区 TOP10（下）
 *
 * 数据全部接入平台监控 API：
 *  - GET /infra/monitoring/tenants/statistics
 *  - GET /infra/monitoring/users/statistics
 *  - GET /infra/monitoring/access/statistics
 *
 * 仅平台超级管理员可见。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Radio,
  Skeleton,
  Space,
  Tooltip,
  Typography,
  App,
} from 'antd';
import {
  AppstoreOutlined,
  BarChartOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  ExclamationCircleOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  LineChartOutlined,
  LoginOutlined,
  PieChartOutlined,
  ReloadOutlined,
  RocketOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { Column, Line, Pie } from '@ant-design/charts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/en';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { useTranslation } from 'react-i18next';

import { ListPageTemplate } from '../../../components/layout-templates';
import { SciFiPanelFrame } from '../../system/dashboard/analysis/components/SciFiPanelFrame';
import { SciFiTitleBackground } from '../../../components/SciFiTitleBackground/SciFiTitleBackground';
import {
  accent,
  businessBoardChartTheme,
} from '../../system/dashboard/analysis/chartTheme';
import { useSiteLogoUrl } from '../../../hooks/useSiteLogoUrl';
import {
  getAccessStatistics,
  getTenantStatistics,
  getUserStatistics,
} from '../../../services/superadmin';
import { getToken, getUserInfo } from '../../../utils/auth';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

type TimeRangeType = 'today' | 'week' | 'month' | 'custom';

const clockFont =
  '"JetBrains Mono", "SF Mono", "Cascadia Code", Consolas, "Liberation Mono", ui-monospace, monospace';

const PANEL_TITLE_STYLE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#bae6fd',
  letterSpacing: 0.35,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 6,
  flexShrink: 0,
  lineHeight: 1.35,
};

const PANEL_TITLE_ICON: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: '#e0f2fe',
  fontSize: 15,
  background: 'linear-gradient(155deg, rgba(56, 189, 248, 0.32) 0%, rgba(15, 23, 42, 0.78) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.45)',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
};

const CHART_HOST: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  width: '100%',
  position: 'relative',
  overflow: 'hidden',
  boxSizing: 'border-box',
};

const TitleIconBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={PANEL_TITLE_ICON}>{children}</span>
);

interface HeroKpiTile {
  id: string;
  label: string;
  value: number;
  sub?: string;
  color: string;
  icon: React.ReactNode;
}

/** 中栏装饰：中心核心指标 + 4 个 KPI 卫星 */
const SciFiHeroDecoration: React.FC<{
  t: (key: string, opts?: Record<string, unknown>) => string;
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  dauToday: number;
  loginsToday: number;
  newRegToday: number;
}> = ({ t, totalTenants, activeTenants, totalUsers, dauToday, loginsToday, newRegToday }) => {
  const activeRate =
    totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 1000) / 10 : 0;

  const tiles: HeroKpiTile[] = [
    {
      id: 'users',
      label: t('pages.infra.operation.board.kpiUsers'),
      value: totalUsers,
      color: accent.cyan,
      icon: <TeamOutlined />,
    },
    {
      id: 'dau',
      label: t('pages.infra.operation.board.kpiDau'),
      value: dauToday,
      color: accent.emerald,
      icon: <ThunderboltOutlined />,
    },
    {
      id: 'logins',
      label: t('pages.infra.operation.board.kpiLoginsToday'),
      value: loginsToday,
      color: accent.amber,
      icon: <LoginOutlined />,
    },
    {
      id: 'reg',
      label: t('pages.infra.operation.board.kpiRegToday'),
      value: newRegToday,
      color: accent.violet,
      icon: <UserAddOutlined />,
    },
  ];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: '8px 18px',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        @keyframes heroRingSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes heroRingSpinReverse {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(-360deg); }
        }
        @keyframes heroCorePulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.92; }
          50% { transform: translate(-50%, -50%) scale(1.04); opacity: 1; }
        }
        @keyframes heroTileFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .op-hero-ring { position: absolute; top: 50%; left: 50%; border-radius: 50%; pointer-events: none; }
        .op-hero-tile { animation: heroTileFloat 8s ease-in-out infinite; }
      `}</style>

      {/* 背景雷达环 */}
      <div
        className="op-hero-ring"
        style={{
          width: 'clamp(240px, 32vmin, 360px)',
          height: 'clamp(240px, 32vmin, 360px)',
          border: '1px dashed rgba(56, 189, 248, 0.35)',
          animation: 'heroRingSpin 38s linear infinite',
        }}
      />
      <div
        className="op-hero-ring"
        style={{
          width: 'clamp(170px, 22vmin, 250px)',
          height: 'clamp(170px, 22vmin, 250px)',
          border: '1px solid rgba(56, 189, 248, 0.22)',
          background:
            'radial-gradient(circle, rgba(56,189,248,0.08) 0%, rgba(15,23,42,0) 70%)',
          animation: 'heroRingSpinReverse 56s linear infinite',
        }}
      />
      <div
        className="op-hero-ring"
        style={{
          width: 'clamp(240px, 32vmin, 360px)',
          height: 'clamp(240px, 32vmin, 360px)',
          boxShadow:
            '0 0 48px rgba(56,189,248,0.18), inset 0 0 36px rgba(56,189,248,0.12)',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* 中心核心 */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'clamp(130px, 17vmin, 190px)',
          height: 'clamp(130px, 17vmin, 190px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 30% 25%, rgba(56,189,248,0.35) 0%, rgba(14,165,233,0.2) 42%, rgba(15,23,42,0.9) 80%)',
          border: '1px solid rgba(56, 189, 248, 0.55)',
          boxShadow:
            '0 0 38px rgba(56,189,248,0.45), inset 0 0 22px rgba(56,189,248,0.35)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          color: '#f8fafc',
          animation: 'heroCorePulse 5s ease-in-out infinite',
        }}
      >
        <Text
          style={{
            color: '#7dd3fc',
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          {t('pages.infra.operation.board.kpiTenants')}
        </Text>
        <div
          style={{
            fontFamily: clockFont,
            fontSize: 'clamp(30px, 4.2vmin, 48px)',
            fontWeight: 700,
            color: '#e0f2fe',
            lineHeight: 1.05,
            marginTop: 2,
            textShadow: '0 0 14px rgba(56,189,248,0.55)',
          }}
        >
          {totalTenants.toLocaleString()}
        </div>
        <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
          {t('pages.infra.operation.board.kpiActiveTenants')} {activeTenants.toLocaleString()}
          <span style={{ color: accent.emerald, marginLeft: 8 }}>
            {activeRate}%
          </span>
        </Text>
      </div>

      {/* 4 个 KPI 卫星 — 绝对定位在四角，避免布局错乱 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        {[
          { ...tiles[0], pos: { top: '8%', left: '4%' } },
          { ...tiles[1], pos: { top: '8%', right: '4%' } },
          { ...tiles[2], pos: { bottom: '8%', left: '4%' } },
          { ...tiles[3], pos: { bottom: '8%', right: '4%' } },
        ].map((tile, i) => (
          <div
            key={tile.id}
            className="op-hero-tile"
            style={{
              position: 'absolute',
              ...tile.pos,
              minWidth: 126,
              maxWidth: 170,
              padding: '8px 12px',
              borderRadius: 10,
              background: `linear-gradient(145deg, ${tile.color}22 0%, rgba(15, 23, 42, 0.85) 100%)`,
              border: `1px solid ${tile.color}55`,
              boxShadow: `0 4px 18px rgba(0,0,0,0.35), inset 0 1px 0 ${tile.color}33`,
              color: '#f8fafc',
              pointerEvents: 'auto',
              animationDelay: `${i * 1.8}s`,
              backdropFilter: 'blur(6px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: tile.color,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              <span>{tile.icon}</span>
              <span>{tile.label}</span>
            </div>
            <div
              style={{
                fontFamily: clockFont,
                fontSize: 20,
                fontWeight: 700,
                color: '#f8fafc',
                lineHeight: 1.15,
              }}
            >
              {tile.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function OperationsDashboard() {
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const siteLogoUrl = useSiteLogoUrl();
  const containerRef = useRef<HTMLDivElement>(null);

  const hasToken = !!getToken();
  const userInfo = getUserInfo();
  const isInfraSuperAdmin = userInfo?.user_type === 'infra_superadmin';

  // Local clock + fullscreen state
  const [currentTime, setCurrentTime] = useState(dayjs().format('YYYY-MM-DD HH:mm:ss'));
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filters
  const [timeRangeType, setTimeRangeType] = useState<TimeRangeType>('today');
  const [customDateRange, setCustomDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshInterval = 30_000;

  // Locale for dayjs
  useEffect(() => {
    const currentLang = i18n.language || 'zh-CN';
    dayjs.locale(currentLang === 'en-US' ? 'en' : 'zh-cn');
  }, [i18n.language]);

  // Live clock
  useEffect(() => {
    const timer = window.setInterval(
      () => setCurrentTime(dayjs().format('YYYY-MM-DD HH:mm:ss')),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  // Fullscreen observer
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const getDateRange = useCallback((): { start?: string; end?: string } => {
    const now = dayjs();
    let start: Dayjs | null = null;
    let end: Dayjs | null = now;

    switch (timeRangeType) {
      case 'today':
        start = now.startOf('day');
        break;
      case 'week':
        start = now.startOf('week');
        break;
      case 'month':
        start = now.startOf('month');
        break;
      case 'custom':
        if (customDateRange && customDateRange[0] && customDateRange[1]) {
          start = customDateRange[0].startOf('day');
          end = customDateRange[1].endOf('day');
        }
        break;
    }

    return {
      start: start ? start.toISOString() : undefined,
      end: end ? end.toISOString() : undefined,
    };
  }, [timeRangeType, customDateRange]);

  const dateRange = getDateRange();

  const userStatsQueryKey = useMemo(
    () => [
      'userStatistics',
      timeRangeType,
      customDateRange?.[0]?.format('YYYY-MM-DD'),
      customDateRange?.[1]?.format('YYYY-MM-DD'),
    ],
    [timeRangeType, customDateRange],
  );
  const accessStatsQueryKey = useMemo(
    () => [
      'accessStatistics',
      timeRangeType,
      customDateRange?.[0]?.format('YYYY-MM-DD'),
      customDateRange?.[1]?.format('YYYY-MM-DD'),
    ],
    [timeRangeType, customDateRange],
  );

  // ---- Queries (real data) ---------------------------------------------------
  const {
    data: tenantStats,
    isLoading: loadingTenants,
    error: tenantError,
    refetch: refetchTenants,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['tenantStatistics', timeRangeType, customDateRange],
    queryFn: async () => getTenantStatistics(),
    enabled: hasToken && isInfraSuperAdmin,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
    placeholderData: (previous) => previous,
    refetchInterval: autoRefresh ? autoRefreshInterval : false,
  });

  const {
    data: userStats,
    isLoading: loadingUsers,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: userStatsQueryKey,
    queryFn: async () =>
      getUserStatistics({ start: dateRange.start, end: dateRange.end }),
    enabled: hasToken && isInfraSuperAdmin,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
    refetchInterval: autoRefresh ? autoRefreshInterval : false,
  });

  const {
    data: accessStats,
    isLoading: loadingAccess,
    refetch: refetchAccess,
  } = useQuery({
    queryKey: accessStatsQueryKey,
    queryFn: async () =>
      getAccessStatistics({ start: dateRange.start, end: dateRange.end }),
    enabled: hasToken && isInfraSuperAdmin,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
    refetchInterval: autoRefresh ? autoRefreshInterval : false,
  });

  const loading = loadingTenants || loadingUsers || loadingAccess;
  const hasCachedData = !!tenantError && !!tenantStats;

  useEffect(() => {
    if (hasToken && isInfraSuperAdmin) {
      queryClient.prefetchQuery({
        queryKey: ['tenantStatistics', 'today', null],
        queryFn: async () => getTenantStatistics(),
        staleTime: 60_000,
      });
    }
  }, [hasToken, isInfraSuperAdmin, queryClient]);

  const handleRefresh = useCallback(() => {
    refetchTenants();
    refetchUsers();
    refetchAccess();
    messageApi.success(t('pages.infra.operation.refreshSuccess'));
  }, [refetchTenants, refetchUsers, refetchAccess, messageApi, t]);

  // ---- Chart data ------------------------------------------------------------
  const statusChartData = useMemo(() => {
    if (!tenantStats) return [] as Array<{ name: string; value: number; color: string }>;
    return [
      {
        name: t('pages.infra.admin.statusActive'),
        value: tenantStats.by_status?.active || 0,
        color: accent.emerald,
      },
      {
        name: t('pages.infra.admin.statusInactive'),
        value: tenantStats.by_status?.inactive || 0,
        color: accent.amber,
      },
      {
        name: t('pages.infra.tenant.statusExpired'),
        value: tenantStats.by_status?.expired || 0,
        color: accent.rose,
      },
      {
        name: t('pages.infra.tenant.statusSuspended'),
        value: tenantStats.by_status?.suspended || 0,
        color: accent.slate,
      },
    ].filter((item) => item.value > 0);
  }, [tenantStats, t]);

  const planChartData = useMemo(() => {
    if (!tenantStats) return [] as Array<{ name: string; value: number; color: string }>;
    const total = tenantStats.total || 0;
    const basic = tenantStats.by_plan?.basic || 0;
    const professional = tenantStats.by_plan?.professional || 0;
    const enterprise = tenantStats.by_plan?.enterprise || 0;
    const trial = Math.max(0, total - basic - professional - enterprise);
    return [
      { name: t('pages.infra.operation.planBasic'), value: basic, color: accent.cyan },
      {
        name: t('pages.infra.operation.planProfessional'),
        value: professional,
        color: accent.violet,
      },
      {
        name: t('pages.infra.operation.planEnterprise'),
        value: enterprise,
        color: accent.emerald,
      },
      { name: t('pages.infra.operation.planTrial'), value: trial, color: accent.amber },
    ].filter((item) => item.value > 0);
  }, [tenantStats, t]);

  // 注册 & 登录趋势：合并为双系列折线图
  const trendData = useMemo(() => {
    const map = new Map<string, { date: string; value: number; metric: string }>();
    const pushPoint = (date: string, value: number, metric: string) => {
      map.set(`${date}-${metric}`, { date, value, metric });
    };
    const regLabel = t('pages.infra.operation.board.trendRegistration');
    const loginLabel = t('pages.infra.operation.board.trendLogin');
    userStats?.registration_trend?.forEach((d) => pushPoint(d.date, d.count, regLabel));
    accessStats?.login_trend?.forEach((d) => pushPoint(d.date, d.count, loginLabel));
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [userStats?.registration_trend, accessStats?.login_trend, t]);

  const topRegions = (src?: Record<string, number>) => {
    if (!src) return [] as Array<{ name: string; value: number; color: string }>;
    const palette = [
      accent.cyan,
      accent.emerald,
      accent.violet,
      accent.amber,
      accent.rose,
      '#38bdf8',
      '#2dd4bf',
      '#f472b6',
      '#fb923c',
      accent.slate,
    ];
    return Object.entries(src)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value], i) => ({ name, value, color: palette[i % palette.length] }));
  };

  const registrationRegionChartData = useMemo(
    () => topRegions(userStats?.by_region),
    [userStats?.by_region],
  );
  const loginRegionChartData = useMemo(
    () => topRegions(accessStats?.by_region),
    [accessStats?.by_region],
  );

  // ---- Export ---------------------------------------------------------------
  const handleExport = useCallback(() => {
    if (!tenantStats && !userStats && !accessStats) {
      messageApi.warning(t('pages.infra.operation.noDataExport'));
      return;
    }
    try {
      const rows: string[][] = [];
      rows.push([t('pages.infra.operation.exportStatsTitle'), '']);
      rows.push([t('pages.infra.operation.exportTime'), dayjs().format('llll')]);
      rows.push([
        t('pages.infra.operation.timeRangeLabel'),
        timeRangeType === 'custom' && customDateRange
          ? `${customDateRange[0]?.format('ll')}${t(
              'pages.infra.operation.dateRangeConnector',
            )}${customDateRange[1]?.format('ll')}`
          : timeRangeType === 'today'
          ? t('pages.infra.operation.timeRangeToday')
          : timeRangeType === 'week'
          ? t('pages.infra.operation.timeRangeWeek')
          : timeRangeType === 'month'
          ? t('pages.infra.operation.timeRangeMonth')
          : t('pages.infra.operation.timeRangeAll'),
      ]);
      rows.push([]);

      if (tenantStats) {
        rows.push([t('pages.infra.operation.coreMetrics'), '']);
        rows.push([t('pages.infra.operation.totalTenants'), String(tenantStats.total || 0)]);
        rows.push([
          t('pages.infra.operation.activeTenants'),
          String(tenantStats.by_status?.active || 0),
        ]);
        rows.push([
          t('pages.infra.operation.inactiveTenants'),
          String(tenantStats.by_status?.inactive || 0),
        ]);
        rows.push([
          t('pages.infra.operation.expiredTenants'),
          String(tenantStats.by_status?.expired || 0),
        ]);
        rows.push([
          t('pages.infra.operation.suspendedTenants'),
          String(tenantStats.by_status?.suspended || 0),
        ]);
        rows.push([]);
        rows.push([t('pages.infra.operation.planDistribution'), '']);
        planChartData.forEach((item) => rows.push([item.name, String(item.value)]));
        rows.push([]);
      }

      if (userStats) {
        rows.push([t('pages.infra.operation.userStats'), '']);
        rows.push([t('pages.infra.operation.totalUsers'), String(userStats.total_users || 0)]);
        rows.push([
          t('pages.infra.operation.newRegistrationsToday'),
          String(userStats.new_today || 0),
        ]);
        rows.push([
          t('pages.infra.operation.newRegistrationsWeek'),
          String(userStats.new_week || 0),
        ]);
        rows.push([
          t('pages.infra.operation.newRegistrationsMonth'),
          String(userStats.new_month || 0),
        ]);
      }
      if (accessStats) {
        rows.push([t('pages.infra.operation.loginsToday'), String(accessStats.logins_today || 0)]);
        rows.push([t('pages.infra.operation.dauToday'), String(accessStats.dau_today || 0)]);
        rows.push([t('pages.infra.operation.totalLogins'), String(accessStats.total_logins || 0)]);
      }

      if (registrationRegionChartData.length) {
        rows.push([]);
        rows.push([
          t('pages.infra.operation.registrationRegion'),
          t('pages.infra.operation.countLabel'),
        ]);
        registrationRegionChartData.forEach((it) =>
          rows.push([it.name, String(it.value)]),
        );
      }
      if (loginRegionChartData.length) {
        rows.push([]);
        rows.push([
          t('pages.infra.operation.loginRegion'),
          t('pages.infra.operation.countLabel'),
        ]);
        loginRegionChartData.forEach((it) => rows.push([it.name, String(it.value)]));
      }

      const csvContent = rows
        .map((row) =>
          row
            .map((cell) => {
              const s = String(cell ?? '');
              if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return `"${s.replace(/"/g, '""')}"`;
              }
              return s;
            })
            .join(','),
        )
        .join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('pages.infra.operation.exportStatsTitle')}_${dayjs().format(
        'YYYYMMDD_HHmmss',
      )}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      messageApi.success(t('pages.infra.operation.exportSuccess'));
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : t('pages.infra.operation.unknownError');
      messageApi.error(t('pages.infra.operation.exportFailed', { message: msg }));
    }
  }, [
    tenantStats,
    userStats,
    accessStats,
    timeRangeType,
    customDateRange,
    planChartData,
    registrationRegionChartData,
    loginRegionChartData,
    messageApi,
    t,
  ]);

  // ---- Permission fallback --------------------------------------------------
  if (!hasToken || !isInfraSuperAdmin) {
    return (
      <ListPageTemplate>
        <Card>
          <Empty
            description={
              <Space direction="vertical" size="small" align="center">
                <Text type="warning" strong>
                  {!hasToken
                    ? t('pages.infra.operation.loginFirst')
                    : t('pages.infra.operation.noPermission')}
                </Text>
                <Text type="secondary">
                  {!hasToken
                    ? t('pages.infra.operation.loginHint')
                    : t('pages.infra.operation.noPermissionHint')}
                </Text>
                {!hasToken && (
                  <Button type="primary" href="/platform">
                    {t('pages.infra.operation.goLogin')}
                  </Button>
                )}
              </Space>
            }
          />
        </Card>
      </ListPageTemplate>
    );
  }

  // ---- Sci-fi board layout --------------------------------------------------
  const totalTenants = tenantStats?.total || 0;
  const activeTenants = tenantStats?.by_status?.active || 0;
  const totalUsers = userStats?.total_users || 0;
  const dauToday = accessStats?.dau_today || 0;
  const loginsToday = accessStats?.logins_today || 0;
  const newRegToday = userStats?.new_today || 0;

  const lastUpdatedLabel =
    tenantStats?.updated_at
      ? dayjs(tenantStats.updated_at).format('HH:mm:ss')
      : dataUpdatedAt
      ? dayjs(dataUpdatedAt).format('HH:mm:ss')
      : '--:--:--';

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 'calc(100vh - 140px)',
        background: '#020617',
        backgroundImage: `
          linear-gradient(rgba(56, 189, 248, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56, 189, 248, 0.035) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        borderRadius: isFullscreen ? 0 : 10,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 70% 45% at 50% -15%, rgba(56, 189, 248, 0.1), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* ───────── Header ───────── */}
      <header
        style={{
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <SciFiTitleBackground />
        </div>
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: 12,
            padding: '10px 18px',
          }}
        >
          <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center' }}>
            <img
              src={siteLogoUrl}
              alt=""
              style={{
                height: 34,
                maxWidth: 160,
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/img/logo.png';
              }}
            />
          </div>
          <div style={{ textAlign: 'center', minWidth: 0, maxWidth: 'min(52vw, 520px)' }}>
            <Title
              level={4}
              style={{
                color: '#f8fafc',
                margin: 0,
                fontWeight: 700,
                fontSize: 28,
                lineHeight: 1.25,
                letterSpacing: 0.4,
              }}
              ellipsis
            >
              {t('pages.infra.operation.board.title')}
            </Title>
            <Text
              style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginTop: 2 }}
              ellipsis
            >
              {t('pages.infra.operation.board.subtitle')}
            </Text>
          </div>
          <div
            style={{
              justifySelf: 'end',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 10px',
                borderRadius: 999,
                border: `1px solid ${accent.emerald}55`,
                background: `${accent.emerald}1f`,
                color: accent.emerald,
                fontSize: 11,
                letterSpacing: 0.8,
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: accent.emerald,
                  boxShadow: `0 0 8px ${accent.emerald}`,
                }}
              />
              {t('pages.infra.operation.board.live')}
            </span>
            <time
              dateTime={currentTime}
              style={{
                color: '#ffffff',
                fontSize: 15,
                fontWeight: 500,
                fontFamily: clockFont,
                letterSpacing: 0.5,
                whiteSpace: 'nowrap',
              }}
            >
              {currentTime}
            </time>
            <Tooltip
              title={
                isFullscreen
                  ? t('pages.infra.operation.board.exitFullscreen')
                  : t('pages.infra.operation.board.fullscreen')
              }
            >
              <Button
                type="text"
                icon={
                  isFullscreen ? (
                    <FullscreenExitOutlined style={{ fontSize: 18 }} />
                  ) : (
                    <FullscreenOutlined style={{ fontSize: 18 }} />
                  )
                }
                onClick={toggleFullscreen}
                style={{ color: accent.cyan }}
                aria-label={
                  isFullscreen
                    ? t('pages.infra.operation.board.exitFullscreen')
                    : t('pages.infra.operation.board.fullscreen')
                }
              />
            </Tooltip>
          </div>
        </div>
      </header>

      {/* ───────── Toolbar ───────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          flexShrink: 0,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderBottom: '1px solid rgba(56, 189, 248, 0.1)',
          background:
            'linear-gradient(180deg, rgba(12, 25, 41, 0.35) 0%, rgba(2, 6, 23, 0) 100%)',
        }}
      >
        <Space size={10} wrap>
          <Text style={{ color: '#7dd3fc', fontSize: 12, letterSpacing: 0.4 }}>
            {t('pages.infra.operation.timeRange')}
          </Text>
          <Radio.Group
            size="small"
            value={timeRangeType}
            onChange={(e) => {
              setTimeRangeType(e.target.value as TimeRangeType);
              if (e.target.value !== 'custom') setCustomDateRange(null);
            }}
          >
            <Radio.Button value="today">{t('pages.infra.operation.today')}</Radio.Button>
            <Radio.Button value="week">{t('pages.infra.operation.week')}</Radio.Button>
            <Radio.Button value="month">{t('pages.infra.operation.month')}</Radio.Button>
            <Radio.Button value="custom">{t('pages.infra.operation.custom')}</Radio.Button>
          </Radio.Group>
          {timeRangeType === 'custom' && (
            <RangePicker
              size="small"
              value={customDateRange}
              onChange={(dates) =>
                setCustomDateRange(dates as [Dayjs | null, Dayjs | null] | null)
              }
              style={{ width: 240 }}
            />
          )}
        </Space>
        <Space size={8} wrap>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('pages.infra.operation.dataUpdatedAt')}：
            <span style={{ color: '#e0f2fe', fontFamily: clockFont }}>
              {lastUpdatedLabel}
            </span>
            {hasCachedData && (
              <span style={{ color: accent.amber, marginLeft: 6 }}>
                {t('pages.infra.operation.cachedLabel')}
              </span>
            )}
          </Text>
          <Tooltip
            title={
              autoRefresh
                ? t('pages.infra.operation.autoRefreshTooltipOn')
                : t('pages.infra.operation.autoRefreshTooltipOff')
            }
          >
            <Button
              size="small"
              type={autoRefresh ? 'primary' : 'default'}
              icon={<ReloadOutlined spin={autoRefresh} />}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh
                ? t('pages.infra.operation.autoRefreshOn')
                : t('pages.infra.operation.autoRefresh')}
            </Button>
          </Tooltip>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            {t('pages.infra.operation.refresh')}
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleExport}>
            {t('pages.infra.operation.export')}
          </Button>
        </Space>
      </div>

      {/* ───────── Body: 3 columns ───────── */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          gap: 10,
          padding: '12px 12px 14px',
          boxSizing: 'border-box',
        }}
      >
        {/* ===== Left column ===== */}
        <div
          style={{
            flex: '3 1 0',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <SciFiPanelFrame rimConverge="sw" style={{ flex: '1 1 0', minHeight: 180 }}>
            <div style={PANEL_TITLE_STYLE}>
              <TitleIconBadge>
                <PieChartOutlined />
              </TitleIconBadge>
              {t('pages.infra.operation.statusDistribution')}
            </div>
            <div style={{ ...CHART_HOST, minHeight: 150 }}>
              {loadingTenants && !tenantStats ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : statusChartData.length > 0 ? (
                <Pie
                  autoFit
                  appendPadding={6}
                  data={statusChartData}
                  angleField="value"
                  colorField="name"
                  innerRadius={0.62}
                  radius={0.86}
                  theme={businessBoardChartTheme}
                  color={statusChartData.map((d) => d.color)}
                  label={{
                    text: 'value',
                    style: { fill: '#f8fafc', fontSize: 11, fontWeight: 'bold' },
                  }}
                  legend={
                    {
                      position: 'right',
                      layout: 'vertical',
                      itemSpacing: 6,
                      itemName: { style: { fill: '#cbd5e1', fontSize: 11 } },
                      color: {
                        position: 'right',
                        itemLabelFill: '#cbd5e1',
                        itemLabelFontSize: 11,
                      },
                    } as any
                  }
                />
              ) : (
                <Empty
                  description={
                    <span style={{ color: '#64748b' }}>
                      {t('pages.infra.operation.noData')}
                    </span>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </div>
          </SciFiPanelFrame>

          <SciFiPanelFrame rimConverge="sw" style={{ flex: '1 1 0', minHeight: 180 }}>
            <div style={PANEL_TITLE_STYLE}>
              <TitleIconBadge>
                <AppstoreOutlined />
              </TitleIconBadge>
              {t('pages.infra.operation.planDistribution')}
            </div>
            <div style={{ ...CHART_HOST, minHeight: 150 }}>
              {loadingTenants && !tenantStats ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : planChartData.length > 0 ? (
                <Column
                  autoFit
                  appendPadding={6}
                  data={planChartData}
                  xField="name"
                  yField="value"
                  colorField="name"
                  theme={businessBoardChartTheme}
                  color={planChartData.map((d) => d.color)}
                  columnStyle={{ radius: [6, 6, 0, 0] }}
                  axis={{
                    x: {
                      labelFill: '#cbd5e1',
                      labelFontSize: 11,
                      lineStroke: 'rgba(255,255,255,0.15)',
                    },
                    y: {
                      labelFill: '#cbd5e1',
                      labelFontSize: 10,
                      gridStroke: 'rgba(255,255,255,0.06)',
                    },
                  }}
                  label={{
                    text: 'value',
                    position: 'top',
                    style: { fill: '#f8fafc', fontSize: 11, fontWeight: 500 },
                    dy: -8,
                  }}
                  legend={false}
                />
              ) : (
                <Empty
                  description={
                    <span style={{ color: '#64748b' }}>
                      {t('pages.infra.operation.noData')}
                    </span>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </div>
          </SciFiPanelFrame>
        </div>

        {/* ===== Middle column ===== */}
        <div
          style={{
            flex: '4 1 0',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {/* 上：装饰区 */}
          <div
            style={{
              flex: '1 1 0',
              minHeight: 260,
              position: 'relative',
              overflow: 'visible',
              boxSizing: 'border-box',
              borderRadius: 10,
              border: '1px solid rgba(56, 189, 248, 0.18)',
              background:
                'radial-gradient(120% 120% at 50% 0%, rgba(15, 23, 42, 0.6) 0%, rgba(2, 6, 23, 0.7) 70%)',
              boxShadow: '0 10px 28px rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(56,189,248,0.15)',
            }}
          >
            {/* 顶部标签 */}
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#bae6fd',
                fontSize: 12,
                letterSpacing: 1.1,
                textTransform: 'uppercase',
                fontWeight: 600,
                zIndex: 2,
              }}
            >
              <RocketOutlined />
              {t('pages.infra.operation.board.heroCoreLabel')}
            </div>
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 16,
                color: '#7dd3fc',
                fontSize: 11,
                letterSpacing: 1.1,
                textTransform: 'uppercase',
                fontWeight: 600,
                fontFamily: clockFont,
                zIndex: 2,
              }}
            >
              {t('pages.infra.operation.board.heroRingLabel')}
            </div>

            <SciFiHeroDecoration
              t={t}
              totalTenants={totalTenants}
              activeTenants={activeTenants}
              totalUsers={totalUsers}
              dauToday={dauToday}
              loginsToday={loginsToday}
              newRegToday={newRegToday}
            />
          </div>

          {/* 下：趋势 */}
          <SciFiPanelFrame rimConverge="se" style={{ flex: '1 1 0', minHeight: 180 }}>
            <div style={PANEL_TITLE_STYLE}>
              <TitleIconBadge>
                <LineChartOutlined />
              </TitleIconBadge>
              {t('pages.infra.operation.board.trendTitle')}
            </div>
            <div style={{ ...CHART_HOST, minHeight: 150 }}>
              {(loadingUsers || loadingAccess) && !trendData.length ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : trendData.length > 0 ? (
                <Line
                  autoFit
                  appendPadding={6}
                  data={trendData}
                  xField="date"
                  yField="value"
                  seriesField="metric"
                  colorField="metric"
                  shapeField="smooth"
                  theme={businessBoardChartTheme}
                  color={[accent.cyan, accent.emerald]}
                  line={{ size: 2 }}
                  point={{ size: 3, shapeField: 'circle' }}
                  axis={{
                    x: {
                      labelFill: '#cbd5e1',
                      labelFontSize: 10,
                      lineStroke: 'rgba(255,255,255,0.15)',
                    },
                    y: {
                      labelFill: '#cbd5e1',
                      labelFontSize: 10,
                      gridStroke: 'rgba(255,255,255,0.06)',
                    },
                  }}
                  legend={
                    {
                      position: 'top',
                      itemName: { style: { fill: '#cbd5e1', fontSize: 11 } },
                      color: {
                        position: 'top',
                        itemLabelFill: '#cbd5e1',
                        itemLabelFontSize: 11,
                      },
                    } as any
                  }
                />
              ) : (
                <Empty
                  description={
                    <span style={{ color: '#64748b' }}>
                      {t('pages.infra.operation.noData')}
                    </span>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </div>
          </SciFiPanelFrame>
        </div>

        {/* ===== Right column ===== */}
        <div
          style={{
            flex: '3 1 0',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <SciFiPanelFrame rimConverge="se" style={{ flex: '1 1 0', minHeight: 180 }}>
            <div style={PANEL_TITLE_STYLE}>
              <TitleIconBadge>
                <EnvironmentOutlined />
              </TitleIconBadge>
              {t('pages.infra.operation.registrationRegion')}
            </div>
            <div style={{ ...CHART_HOST, minHeight: 150 }}>
              {loadingUsers && !userStats ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : registrationRegionChartData.length > 0 ? (
                <Pie
                  autoFit
                  appendPadding={6}
                  data={registrationRegionChartData}
                  angleField="value"
                  colorField="name"
                  innerRadius={0.58}
                  radius={0.88}
                  theme={businessBoardChartTheme}
                  color={registrationRegionChartData.map((d) => d.color)}
                  label={{
                    text: 'value',
                    style: { fill: '#f8fafc', fontSize: 10, fontWeight: 'bold' },
                  }}
                  legend={
                    {
                      position: 'right',
                      layout: 'vertical',
                      itemSpacing: 4,
                      itemName: { style: { fill: '#cbd5e1', fontSize: 10 } },
                      color: {
                        position: 'right',
                        itemLabelFill: '#cbd5e1',
                        itemLabelFontSize: 10,
                      },
                    } as any
                  }
                />
              ) : (
                <Empty
                  description={
                    <span style={{ color: '#64748b' }}>
                      {t('pages.infra.operation.noData')}
                    </span>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </div>
          </SciFiPanelFrame>

          <SciFiPanelFrame rimConverge="se" style={{ flex: '1 1 0', minHeight: 180 }}>
            <div style={PANEL_TITLE_STYLE}>
              <TitleIconBadge>
                <BarChartOutlined />
              </TitleIconBadge>
              {t('pages.infra.operation.loginRegion')}
            </div>
            <div style={{ ...CHART_HOST, minHeight: 150 }}>
              {loadingAccess && !accessStats ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : loginRegionChartData.length > 0 ? (
                <Pie
                  autoFit
                  appendPadding={6}
                  data={loginRegionChartData}
                  angleField="value"
                  colorField="name"
                  innerRadius={0.58}
                  radius={0.88}
                  theme={businessBoardChartTheme}
                  color={loginRegionChartData.map((d) => d.color)}
                  label={{
                    text: 'value',
                    style: { fill: '#f8fafc', fontSize: 10, fontWeight: 'bold' },
                  }}
                  legend={
                    {
                      position: 'right',
                      layout: 'vertical',
                      itemSpacing: 4,
                      itemName: { style: { fill: '#cbd5e1', fontSize: 10 } },
                      color: {
                        position: 'right',
                        itemLabelFill: '#cbd5e1',
                        itemLabelFontSize: 10,
                      },
                    } as any
                  }
                />
              ) : (
                <Empty
                  description={
                    <span style={{ color: '#64748b' }}>
                      {t('pages.infra.operation.noData')}
                    </span>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </div>
          </SciFiPanelFrame>
        </div>
      </div>

      {tenantError && !hasCachedData && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 12,
            right: 12,
            zIndex: 20,
            padding: '6px 12px',
            borderRadius: 6,
            background: 'rgba(220, 38, 38, 0.18)',
            border: '1px solid rgba(220, 38, 38, 0.35)',
            color: '#fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
          }}
        >
          <span>
            <ExclamationCircleOutlined style={{ marginRight: 6 }} />
            {t('pages.infra.operation.loadFailed')}：
            {tenantError instanceof Error
              ? tenantError.message
              : t('pages.infra.operation.networkError')}
          </span>
          <Button
            size="small"
            type="text"
            onClick={() => refetchTenants()}
            style={{ color: '#fecaca' }}
          >
            {t('pages.infra.operation.retry')}
          </Button>
        </div>
      )}
    </div>
  );
}
