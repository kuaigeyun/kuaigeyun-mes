/**
 * RiverEdge SaaS 多组织框架 - 基础布局组件
 * 
 * 使用 ProLayout 实现现代化页面布局，集成状态管理和权限控制
 */

import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Spin, theme } from 'antd';
import { PageLoadingFullscreen } from '../components/page-loading-lottie';
import type { MenuDataItem } from '@ant-design/pro-components';
import {
  LogoutOutlined,
  UserOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  AppstoreOutlined,
  SettingOutlined,
  TranslationOutlined,
  BgColorsOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CloseOutlined,
  LockOutlined,
  BellOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { message, Button, Tooltip, Badge, Avatar, Dropdown, Space, Breadcrumb, Typography, Empty, Divider, Modal, Grid, Skeleton } from 'antd';
import type { MenuProps } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RightOutlined } from '@ant-design/icons';
import { Icon as IconifyIcon, addCollection } from '@iconify/react/dist/offline';
import fluentColorSystemPanelIcons from '../assets/icons/fluent-color-system-panel.json';
import {
  translateMenuName,
  translatePathTitle,
  translateAppMenuItemName,
  extractAppCodeFromPath,
  findMenuTitleWithTranslation,
  resolveAppMenuGroupDisplayName,
  translateMenuItemTitle,
  getMenuDisplayNameOverride,
  isSyncedI18nMenuName,
  type MenuDataItemWithLocaleKey,
} from '../utils/menuTranslation';
import { resolveCustomPageTitle } from '../utils/customPageTitle';
import { prefetchPlugin } from '../utils/pluginLoader';
import { prefetchKuaizhizaoRoute } from '../apps/kuaizhizao/routePrefetch';
import { prefetchMasterDataRoute } from '../apps/master-data/routePrefetch';
import { prefetchSystemRoute, prefetchSystemRoutes } from '../routes/systemRoutePrefetch';
import { PRO_APP_CODES } from '../pages/system/applications/proAppCatalog';
import { layoutShellQueryOptions } from '../config/reactQuery';
import { useDocumentVisible } from '../hooks/useDocumentVisible';
import { useBasicLayoutInlineStyles, type BasicLayoutStyleContext } from './basicLayout/buildInlineLayoutStyles';
import { LayoutStyleInjector } from './basicLayout/LayoutStyleInjector';
import SplitSidebarMenu from './basicLayout/SplitSidebarMenu';
import {
  buildSplitMenuRoots,
  computeSplitSecondaryOpenKeys,
  FLAT_SIDEBAR_WIDTH,
  readSidebarMenuLayoutPref,
  SPLIT_SIDEBAR_WIDTH,
} from './basicLayout/sidebarMenuLayout';
import dayjs from 'dayjs';
import { nextSiteLogoUrlAfterImageError } from '../constants/siteAssets';
import { useSiteLogoUrl } from '../hooks/useSiteLogoUrl';
import { getUserMessageStats, getUserMessages, markMessagesRead, type UserMessage } from '../services/userMessage';
import { formatDateTime } from '../utils/format';

/** 仅注册系统面板用到的 fluent-color 图标，避免整包 ~1.7MB 进 vendor */
addCollection(fluentColorSystemPanelIcons as Parameters<typeof addCollection>[0]);

// 安全的翻译 hook，避免多语言初始化失败导致应用崩溃
const useSafeTranslation = () => {
  try {
    return useTranslation();
  } catch (error) {
    console.warn('i18n initialization failed:', error);
    // 返回最小可用翻译函数，保证页面可渲染
    return {
      t: (key: string, options?: any) => {
        // 如果是中文 key，直接返回
        if (key.includes('zh-CN') || key.includes('中文')) return key;
        // 其他情况返回英文版本或原始 key
        return key;
      },
      i18n: {
        language: 'zh-CN',
        changeLanguage: () => Promise.resolve(),
      }
    };
  }
};
import TenantSelector from '../components/tenant-selector';
import TopBarSearch from '../components/TopBarSearch';
import UniTabs from '../components/uni-tabs';
import TechStackModal from '../components/tech-stack-modal';
import { HeaderClientDownloadButton, HeaderMiniprogramQrButton } from '../components/header-client-download';
import ThemeEditor from '../components/theme-editor';
import IterationFloatButton from '../components/iteration-float-button';
import { RouteTransition } from '../components/route-transition';
const TenantBootstrapModal = React.lazy(() => import('../components/tenant-bootstrap-modal'));
/** AI 助手按需加载，避免动画/AntX 栈进入启动主图 */
const AiAssistant = React.lazy(() => import('../components/ai-assistant'));
import { getTenantById, getPackageConfigs } from '../services/tenant';
import { getToken, clearAuth, getTenantId } from '../utils/auth';
import { resolveIsInfraSuperAdminSession } from '../utils/infraSuperAdminSession';
import { useGlobalStore } from '../stores';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useCurrentUserQuery } from '../hooks/useCurrentUserQuery';
import { buildRestoredUserFromStorage } from '../utils/restoredUser';
import { getLanguageList, Language } from '../services/language';
import { LANGUAGE_MAP, applyLanguageWithPersist } from '../config/i18n';
import i18n from '../config/i18n';
import {
  MenuTree,
  getEffectiveHome,
  getTenantBackendHome,
  EFFECTIVE_HOME_QUERY_KEY,
  TENANT_BACKEND_HOME_QUERY_KEY,
} from '../services/menu';
import { useUnifiedMenuData } from '../hooks/useUnifiedMenuData';
import { ManufacturingIcons } from '../utils/manufacturingIcons';
import { LucideIconByName } from '../utils/lucideDynamicIcon';
import { getAvatarUrl, getAvatarText, getAvatarFontSize, getCachedAvatarUrl, toRelativeIfLocalhost, isTextAvatarDisplay, getTextAvatarCircleStyle, getImageAvatarCircleStyle } from '../utils/avatar';
import { triggerNew, hasNewHandler } from '../utils/globalNewShortcut';
import { triggerSubmit, hasSubmitHandler } from '../utils/globalSubmitShortcut';
import { CODE_FONT_FAMILY } from '../constants/fonts';
import { clearSessionScopedQueries } from '../utils/clearSessionQueries';
import { getInstalledApplicationList } from '../services/application';
import { getChatIntegrationStatus } from '../services/deepseekChat';
import { buildChatIntegrationStatusQueryKey } from '../hooks/useChatIntegrationStatus';
import { hasPermission, resolveUserForMenuPermission } from '../utils/permission';
import { AiAssistantHeaderButton } from './AiAssistantHeaderButton';
import OnboardingGuide from '../components/onboarding-guide';
import { OnboardingWizardEntry } from '../components/onboarding-guide/OnboardingWizardEntry';
import { HeaderQuickEntryPopover } from '../components/quick-entry';
import { useUserPreferenceStore } from '../stores/userPreferenceStore';
import { useConfigStore, resolveEffectiveHomePath, getDefaultTenantHomePath } from '../stores/configStore';
import { useThemeStore } from '../stores/themeStore';
import { getMenuBadgeCounts, type MenuBadgeEntry } from '../services/dashboard';
import { verifyCopyright } from '../utils/copyrightIntegrity';
import { getBuildProvenance, getPlatformSettingsPublic, registerInstallInstance } from '../services/platformSettings';
import { useTouchScreen } from '../hooks/useTouchScreen';
import { buildLoginRedirectPath } from '../utils/tenantDomainAccess';
import { isPlatformAdminLoginPathname, isPlatformInfraPath } from '../utils/platformScope';
import { redirectAfterLogout } from '../utils/loginEntry';

/** 侧栏应用分组标题 → 应用 code（任意应用；key / path） */
function resolveSidebarAppGroupCode(item: {
  key?: React.Key;
  path?: string;
}): string | null {
  const keyStr = String(item.key ?? '');
  const fromKey = keyStr.match(/^app-group-code-(.+)$/)?.[1];
  if (fromKey) return fromKey;

  const path = typeof item.path === 'string' ? item.path : '';
  const fromHash = path.match(/^#app-group-(.+)$/)?.[1];
  if (fromHash) return fromHash;

  return extractAppCodeFromPath(path);
}

function isSidebarAppGroupTitleItem(item: { key?: React.Key; className?: string }): boolean {
  const keyStr = String(item.key ?? '');
  const cls = String(item.className ?? '');
  return (
    cls.includes('menu-group-title-app') ||
    cls.includes('app-menu-container-start') ||
    keyStr.startsWith('app-group-code-') ||
    keyStr.startsWith('app-group-')
  );
}

/** 与 git HEAD 应用分组标题一致；写在标题文字节点上，避开父级灰色 !important 竞争 */
const APP_GROUP_TITLE_TEXT_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--ant-colorPrimary)',
  fontWeight: 700,
  lineHeight: 1.2,
  display: 'inline-flex',
  alignItems: 'center',
};

/**
 * 左侧菜单 path → menu-badge-counts 的 key（与后端 get_menu_badge_counts 一致）
 * 徽章仅两色：逾期(红) > 进行中(蓝)；进行中含 pending+in_progress；皆 0 不显示
 */
const MENU_BADGE_PATH_KEY: Record<string, string> = {
  // 销售
  '/apps/kuaizhizao/sales-management/quotations': 'quotation',
  '/apps/kuaizhizao/sales-management/customer-follow-ups': 'customer_follow_up',
  '/apps/kuaizhizao/sales-management/sales-contracts': 'sales_contract',
  '/apps/kuaizhizao/sales-management/sales-forecasts': 'sales_forecast',
  '/apps/kuaizhizao/sales-management/sales-orders': 'sales_order',
  '/apps/kuaizhizao/sales-management/sales-order-changes': 'sales_order_change',
  '/apps/kuaizhizao/sales-management/shipment-notices': 'shipment_notice',
  '/apps/kuaizhizao/sales-management/sales-returns': 'sales_return',
  // 计划
  '/apps/kuaizhizao/plan-management/demand-management': 'demand',
  '/apps/kuaizhizao/plan-management/demand-computation': 'demand_computation',
  // 采购
  '/apps/kuaizhizao/purchase-management/purchase-requisitions': 'purchase_requisition',
  '/apps/kuaizhizao/purchase-management/purchase-inquiries': 'purchase_inquiry',
  '/apps/kuaizhizao/purchase-management/purchase-orders': 'purchase_order',
  '/apps/kuaizhizao/purchase-management/purchase-order-changes': 'purchase_order_change',
  '/apps/kuaizhizao/purchase-management/receipt-notices': 'receipt_notice',
  '/apps/kuaizhizao/purchase-management/purchase-returns': 'purchase_return',
  '/apps/kuaizhizao/purchase-management/logistics-tracking': 'freight_tracking',
  // 生产
  '/apps/kuaizhizao/production-execution/work-orders': 'work_order',
  '/apps/kuaizhizao/production-execution/reporting': 'reporting_record',
  '/apps/kuaizhizao/production-execution/rework-orders': 'rework_order',
  '/apps/kuaizhizao/production-execution/outsource-management': 'outsource_work_order',
  '/apps/kuaizhizao/production-execution/packing-binding': 'packing_binding',
  '/apps/kuaizhizao/production-execution/material-shortage-exceptions': 'material_shortage_exception',
  '/apps/kuaizhizao/production-execution/delivery-delay-exceptions': 'delivery_delay_exception',
  '/apps/kuaizhizao/production-execution/quality-exceptions': 'quality_exception',
  // 质量
  '/apps/kuaizhizao/quality-management/inspection-center': 'quality_inspection',
  '/apps/kuaizhizao/quality-management/incoming-inspection': 'incoming_inspection',
  '/apps/kuaizhizao/quality-management/process-inspection': 'process_inspection',
  '/apps/kuaizhizao/quality-management/finished-goods-inspection': 'finished_goods_inspection',
  '/apps/kuaizhizao/quality-management/oqc-inspection': 'oqc_inspection',
  '/apps/kuaizhizao/quality-management/inspection-plans': 'inspection_plan',
  // 仓储
  '/apps/kuaizhizao/warehouse-management/inbound': 'inbound',
  '/apps/kuaizhizao/warehouse-management/other-inbound': 'other_inbound',
  '/apps/kuaizhizao/warehouse-management/material-returns': 'material_return',
  '/apps/kuaizhizao/warehouse-management/outbound': 'sales_outbound',
  '/apps/kuaizhizao/warehouse-management/other-outbound': 'other_outbound',
  '/apps/kuaizhizao/warehouse-management/material-borrows': 'material_borrow',
  '/apps/kuaizhizao/warehouse-management/delivery-notes': 'delivery_notice',
  '/apps/kuaizhizao/warehouse-management/batching-center': 'batching_order',
  '/apps/kuaizhizao/warehouse-management/material-calls': 'material_call',
  '/apps/kuaizhizao/warehouse-management/stocktaking': 'stocktaking',
  '/apps/kuaizhizao/warehouse-management/inventory-transfer': 'inventory_transfer',
  '/apps/kuaizhizao/warehouse-management/assembly-orders': 'assembly_order',
  '/apps/kuaizhizao/warehouse-management/disassembly-orders': 'disassembly_order',
  '/apps/kuaizhizao/warehouse-management/customer-material-registration': 'customer_material_registration',
  '/apps/kuaizhizao/warehouse-management/backflush-records': 'backflush_record',
  '/apps/kuaizhizao/warehouse-management/inventory-alert': 'inventory_alert',
  '/apps/kuaizhizao/warehouse-management/replenishment-suggestions': 'replenishment_suggestion',
  // 设备
  '/apps/kuaizhizao/equipment-management/equipment': 'equipment',
  '/apps/kuaizhizao/equipment-management/inspection': 'equipment_inspection',
  '/apps/kuaizhizao/equipment-management/equipment-faults': 'equipment_fault',
  '/apps/kuaizhizao/equipment-management/equipment-repairs': 'equipment_repair',
  '/apps/kuaizhizao/equipment-management/equipment-transfers': 'equipment_transfer',
  '/apps/kuaizhizao/equipment-management/equipment-scrap': 'equipment_scrap',
  '/apps/kuaizhizao/equipment-management/maintenance-plans': 'maintenance_plan',
  '/apps/kuaizhizao/equipment-management/maintenance-reminders': 'maintenance_reminder',
  '/apps/kuaizhizao/equipment-management/maintenance-executions': 'maintenance_execution',
  '/apps/kuaizhizao/equipment-management/spare-parts': 'spare_part',
  '/apps/kuaizhizao/equipment-management/spare-part-requisitions': 'spare_part_requisition',
  '/apps/kuaizhizao/equipment-management/molds': 'mold',
  '/apps/kuaizhizao/equipment-management/mold-trials': 'mold_trial',
  '/apps/kuaizhizao/equipment-management/mold-borrows': 'mold_borrow',
  '/apps/kuaizhizao/equipment-management/mold-maintenances': 'mold_maintenance',
  '/apps/kuaizhizao/equipment-management/mold-repairs': 'mold_repair',
  '/apps/kuaizhizao/equipment-management/mold-scrap-applications': 'mold_scrap',
  '/apps/kuaizhizao/equipment-management/tool-ledger': 'tool_ledger',
  '/apps/kuaizhizao/equipment-management/tool-borrows': 'tool_borrow',
  '/apps/kuaizhizao/equipment-management/tool-maintenances': 'tool_maintenance',
  '/apps/kuaizhizao/equipment-management/tool-repairs': 'tool_repair',
  '/apps/kuaizhizao/equipment-management/tool-scrap-applications': 'tool_scrap',
  // 物流
  '/apps/kuaizhizao/logistics-management/freight-orders': 'freight_order',
  '/apps/kuaizhizao/logistics-management/tracking': 'freight_tracking',
  '/apps/kuaizhizao/logistics-management/freight-bills': 'freight_bill',
  // 售后
  '/apps/kuaizhizao/after-sales-service/tickets': 'after_sales_ticket',
  '/apps/kuaizhizao/after-sales-service/install-execution': 'install_execution',
  '/apps/kuaizhizao/after-sales-service/repair-orders': 'after_sales_repair_order',
  '/apps/kuaizhizao/after-sales-service/dispatch-orders': 'service_dispatch',
  '/apps/kuaizhizao/after-sales-service/spare-part-requisitions': 'after_sales_spare_part_requisition',
  '/apps/kuaizhizao/after-sales-service/service-settlements': 'service_settlement',
  // 财务
  '/apps/kuaicaiwu/finance-management/receivables': 'finance_receivable',
  '/apps/kuaicaiwu/finance-management/payables': 'finance_payable',
  '/apps/kuaicaiwu/finance-management/receipts': 'finance_receipt',
  '/apps/kuaicaiwu/finance-management/payments': 'finance_payment',
  '/apps/kuaicaiwu/finance-management/sales-invoices': 'sales_invoice',
  '/apps/kuaicaiwu/finance-management/purchase-invoices': 'purchase_invoice',
  '/apps/kuaicaiwu/finance-management/prepayments': 'prepayment',
  '/apps/kuaicaiwu/finance-management/settlement': 'finance_settlement',
};

// 聚焦“搜索框”未输入时展示的固定常用菜单（制造业日常最常用单据 Top8）
// 说明：使用系统内已存在的 menu `path`，避免依赖“菜单扁平前 N 项”带来的不可控变化
const TOPBAR_SEARCH_HOT_MENU_PATHS: string[] = [
  '/apps/kuaizhizao/production-execution/work-orders', // 工单
  '/apps/kuaizhizao/purchase-management/purchase-orders', // 采购订单
  '/apps/kuaizhizao/sales-management/sales-forecasts', // 销售预测
  '/apps/kuaizhizao/sales-management/sales-orders', // 销售订单
  '/apps/kuaizhizao/warehouse-management/inbound', // 入库单
  '/apps/kuaizhizao/plan-management/demand-computation', // 需求计算
  '/apps/kuaizhizao/quality-management/incoming-inspection', // 来料检验
  '/apps/kuaizhizao/quality-management/process-inspection', // 过程检验
  '/apps/kuaizhizao/quality-management/finished-goods-inspection', // 成品检验
];

/** 根据菜单 path 获取徽章 key（统一去除尾斜杠与查询参数） */
function getMenuBadgeKey(path: string | undefined): string | undefined {
  if (!path || typeof path !== 'string') return undefined;
  const normalized = path.replace(/\/$/, '').split('?')[0];
  return MENU_BADGE_PATH_KEY[path] ?? MENU_BADGE_PATH_KEY[normalized];
}

const MENU_BADGE_OVERDUE_COLOR = '#f5222d';
const MENU_BADGE_IN_PROGRESS_COLOR = '#1677ff';

type MenuBadgeTranslate = (key: string, options?: Record<string, unknown>) => string;

function formatMenuBadgeTitle(t: MenuBadgeTranslate, overdue: number, inProgress: number): string {
  const parts: string[] = [];
  if (overdue > 0) {
    parts.push(t('ui.menu.badgeOverdue', { count: overdue }));
  }
  if (inProgress > 0) {
    parts.push(t('ui.menu.badgeInProgress', { count: inProgress }));
  }
  return parts.join(t('ui.menu.badgeTitleSeparator'));
}

function resolveMenuBadge(
  badgeData: MenuBadgeEntry | null | undefined,
  t: MenuBadgeTranslate,
): { count: number; color: string; title: string } | null {
  if (badgeData == null) return null;
  if (typeof badgeData === 'number') {
    if (badgeData <= 0) return null;
    return {
      count: badgeData,
      color: MENU_BADGE_IN_PROGRESS_COLOR,
      title: t('ui.menu.badgeInProgress', { count: badgeData }),
    };
  }
  const overdue = Number(badgeData.overdue) || 0;
  const inProgress = (Number(badgeData.in_progress) || 0) + (Number(badgeData.pending) || 0);
  if (overdue <= 0 && inProgress <= 0) return null;
  const title = formatMenuBadgeTitle(t, overdue, inProgress);
  if (overdue > 0) {
    return { count: overdue, color: MENU_BADGE_OVERDUE_COLOR, title };
  }
  return { count: inProgress, color: MENU_BADGE_IN_PROGRESS_COLOR, title };
}

// 权限守卫组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const currentUser = useCurrentUser();
  const loading = useGlobalStore((s) => s.loading);
  const setCurrentUser = useGlobalStore((s) => s.setCurrentUser);
  const setLoading = useGlobalStore((s) => s.setLoading);
  const { t } = useSafeTranslation();

  const isInfraSuperAdmin = resolveIsInfraSuperAdminSession();
  const shouldFetchUser = !!getToken() && !currentUser && isInfraSuperAdmin;

  const { data: userData, isLoading, error } = useCurrentUserQuery({ enabled: shouldFetchUser });

  useEffect(() => {
    if (error && getToken()) {
      const restoredUser = buildRestoredUserFromStorage();
      if (restoredUser) {
        setCurrentUser(restoredUser);
        console.warn('⚠️ 获取用户信息失败，使用本地缓存:', error);
      } else {
        const isInApp = window.location.pathname.startsWith('/apps/');
        if ((error as any)?.response?.status === 401 && !isInApp) {
          clearAuth();
          setCurrentUser(undefined);
        }
      }
    } else if (!getToken()) {
      clearAuth();
      setCurrentUser(undefined);
    }
  }, [error, setCurrentUser]);

  useEffect(() => {
    if (userData) {
      setCurrentUser(userData);
    }
  }, [userData, setCurrentUser]);

  const publicPaths = ['/login', '/debug/'];
  const isInfraLoginPage = isPlatformAdminLoginPathname(location.pathname);
  const isSharedReportOrDashboard =
    location.pathname === '/apps/kuaireport/dashboards/shared' ||
    location.pathname === '/apps/kuaireport/reports/shared';
  const isPublicPath =
    publicPaths.some((path) => location.pathname.startsWith(path)) ||
    isInfraLoginPage ||
    isSharedReportOrDashboard;

  React.useEffect(() => {
    if (isPublicPath) {
      setLoading(false);
      return;
    }
    if (currentUser && isLoading) {
      return;
    }
    setLoading(isLoading);
  }, [isLoading, isPublicPath, setLoading, currentUser]);

  const renderAuthLoading = () => <PageLoadingFullscreen />;

  const currentTenantId = getTenantId();

  // ⚠️ 关键修复：如果是平台超级管理员访问系统级页面，但没有选择组织，则重定向到平台首页
  // 必须放在所有 Hook 之后，避免 Hook 顺序问题
  const isSystemPage = location.pathname.startsWith('/system/');
  if (isInfraSuperAdmin && isSystemPage && !currentTenantId) {
    message.warning(t('common.selectOrganizationFirst', { defaultValue: '请先选择要管理的组织' }));
    return <Navigate to="/infra/login" replace />;
  }

  // ⚠️ 关键修复：如果是调试页面，直接渲染内容，不受加载状态影响
  if (location.pathname.startsWith('/debug/')) {
    return <>{children}</>;
  }

  // 如果正在加载，显示全屏 Lottie（与 App AuthGuard 一致，避免 Spin 叠 Lottie）
  if (!currentUser && (loading || isLoading)) {
    return renderAuthLoading();
  }

  // 有 token 但 currentUser 尚未就绪（仅平台超管补拉 /auth/me）
  if (getToken() && !currentUser && shouldFetchUser) {
    return renderAuthLoading();
  }

  // 如果是公开页面且已登录，根据用户类型重定向
  if (isPublicPath && currentUser) {
    // 平台超管登录后，如果访问的是登录页，重定向到平台运营看板
    if (isInfraLoginPage && currentUser.is_infra_admin) {
      return <Navigate to="/infra/operation" replace />;
    }
    // 普通用户登录后，如果访问的是登录页，立刻跳到本地默认首页
    if (location.pathname === '/login' && !currentUser.is_infra_admin) {
      return <Navigate to={getDefaultTenantHomePath()} replace />;
    }
  }

  // 如果不是公开页面且未登录，自动重定向到登录页（SPA 内部跳转，避免 dev 下 /login MPA 缺 Provider 白屏）
  if (!isPublicPath && !currentUser && !getToken()) {
    if (isPlatformInfraPath(location.pathname)) {
      return <Navigate to="/infra/login" replace />;
    }
    return <Navigate to={buildLoginRedirectPath()} replace />;
  }

  return <>{children}</>;
};

/**
 * 根据菜单名称或路径获取 Lucide 图标
 * 左侧菜单全部使用 Lucide 图标，确保风格统一
 * 
 * @param menuName - 菜单名称
 * @param menuPath - 菜单路径（可选）
 * @returns React 图标组件，总是返回 Lucide 图标
 */
const getMenuIcon = (menuName: string, menuPath?: string): React.ReactNode => {
  // 根据菜单路径和名称映射到制造业图标
  // 优先使用路径匹配（路径是固定的，不受翻译影响）
  // 先按路径映射；未命中时再按名称映射

  // 路径映射（优先使用，因为路径是固定的，不受翻译影响）
  if (menuPath) {
    const pathMap: Record<string, React.ComponentType<any>> = {
      '/system': ManufacturingIcons.systemConfig,
      '/system/dashboard': ManufacturingIcons.industrialDashboard,
      '/system/dashboard/workplace': ManufacturingIcons.production,
      '/system/dashboard/analysis': ManufacturingIcons.chartLine,
      '/system/roles': ManufacturingIcons.shield, // 角色权限管理 - 使用盾牌图标
      '/system/departments': ManufacturingIcons.building, // 部门管理 - 使用建筑图标
      '/system/positions': ManufacturingIcons.userCog, // 职位管理 - 使用用户配置图标
      '/system/users': ManufacturingIcons.user, // 账户管理 - 使用单用户图标，和在线用户区分
      '/system/applications': ManufacturingIcons.layout, // 应用中心 - 使用应用入口/布局图标
      '/system/menus': ManufacturingIcons.menu, // 菜单管理 - 使用菜单图标
      '/system/site-settings': ManufacturingIcons.mdSettings, // 站点设置 - 使用设置图标
      '/system/config-center': ManufacturingIcons.mdConfiguration, // 业务配置 - 使用设置2图标，区别于站点设置
      '/system/business-config': ManufacturingIcons.mdConfiguration, // 重定向到 config-center
      '/system/system-parameters': ManufacturingIcons.mdConfiguration, // 重定向到 config-center
      '/system/data-dictionaries': ManufacturingIcons.bookOpen, // 数据字典 - 使用打开的书本图标
      '/system/code-rules': ManufacturingIcons.code, // 编号规则 - 使用代码图标
      '/system/integration-configs': ManufacturingIcons.network, // 数据连接 - 使用网络图标
      '/system/languages': ManufacturingIcons.languages, // 语言管理 - 使用语言图标
      '/system/custom-fields': ManufacturingIcons.toolbox, // 自定义字段 - 使用工具箱图标
      '/system/files': ManufacturingIcons.folder, // 文件管理 - 使用文件夹图标
      '/system/apis': ManufacturingIcons.api, // API管理 - 使用API图标
      '/system/data-sources': ManufacturingIcons.database, // 数据源 - 使用数据库图标
      '/system/application-connections': ManufacturingIcons.gitBranch, // 应用连接器 - 使用分支连接图标
      '/system/datasets': ManufacturingIcons.inventory, // 数据集 - 使用库存图标
      '/system/initial-data': ManufacturingIcons['arrow-down-to-line'], // 期初数据导入（导入入库）
      '/system/onboarding-wizard': ManufacturingIcons.compass, // 上线向导 - 指引/向导
      '/system/messages/config': ManufacturingIcons.bell, // 消息配置 - 使用铃铛图标
      '/system/messages/template': ManufacturingIcons.fileText, // 消息模板 - 使用文件文本图标
      '/system/approval-processes': ManufacturingIcons.workflow, // 审批流程 - 使用工作流图标
      '/system/approval-instances': ManufacturingIcons.checkCircle, // 审批实例 - 使用检查圆圈图标
      '/system/print-templates': ManufacturingIcons.fileSpreadsheet, // 打印模板 - 使用模板文档图标
      '/system/report-templates': ManufacturingIcons.chartBar, // 报表模板 - 使用柱状图图标
      '/system/print-devices': ManufacturingIcons.printer, // 打印设备 - 使用打印机图标
      '/personal': ManufacturingIcons.userCircle, // 个人中心 - 使用用户圆圈图标
      '/personal/profile': ManufacturingIcons.user, // 个人资料 - 使用用户图标
      '/personal/preferences': ManufacturingIcons.pencil, // 偏好设置 - 使用编辑图标，区别系统设置
      '/personal/messages': ManufacturingIcons.bell, // 我的消息 - 使用铃铛图标
      '/personal/tasks': ManufacturingIcons.checklist, // 我的任务 - 使用清单图标
      '/system/operation-logs': ManufacturingIcons.history, // 操作日志 - 使用历史图标
      '/system/login-logs': ManufacturingIcons.logIn, // 登录日志 - 使用登录图标
      '/system/online-users': ManufacturingIcons.users, // 在线用户 - 使用用户组图标
      '/system/data-backups': ManufacturingIcons.hardDrive, // 数据备份 - 使用硬盘图标
      '/infra/operation': ManufacturingIcons.analytics, // 运营中心 - 使用分析图标
      '/infra/tenants': ManufacturingIcons.building, // 租户管理 - 使用建筑图标（保持）
      '/infra/packages': ManufacturingIcons.package, // 应用包管理 - 使用包裹图标
      '/infra/scripts': ManufacturingIcons.fileCode, // 脚本管理
      '/infra/scheduled-tasks': ManufacturingIcons.clock, // 定时任务
      '/infra/admin': ManufacturingIcons.shield, // 平台管理 - 使用盾牌图标
      '/infra/license-management': ManufacturingIcons.certificate, // 许可证管理

      // 应用菜单路径图标映射（使用前缀匹配，支持 /apps/{app-code}/... 格式）
      '/apps/kuaizhizao/plan-management': ManufacturingIcons.calendar, // 计划管理 - 使用日历图标
      '/apps/kuaizhizao/production-execution': ManufacturingIcons.activity, // 生产执行 - 使用活动/执行图标
      '/apps/kuaizhizao/purchase-management': ManufacturingIcons.shoppingBag, // 采购管理 - 使用购物袋图标
      '/apps/kuaizhizao/sales-management': ManufacturingIcons.chartLine, // 销售管理 - 使用趋势上升图标（销售增长）
      '/apps/kuaizhizao/warehouse-management': ManufacturingIcons.warehouse, // 仓储管理 - 使用仓库图标
      '/apps/kuaizhizao/quality-management': ManufacturingIcons.quality, // 质量管理 - 使用质量图标
      '/apps/kuaizhizao/equipment-management': ManufacturingIcons.wrench, // 设备管理 - 扳手图标（与系统设置齿轮区分）
      '/apps/kuaizhizao/finance-management': ManufacturingIcons.wallet, // 财务管理 - 使用钱包图标
      '/apps/kuaireport/analysis-center': ManufacturingIcons.chartBar, // 分析中心（已迁至快报表）- 柱状图
      '/apps/kuaicrm': ManufacturingIcons.users, // 快客户
      '/apps/kuaipdm': ManufacturingIcons.layers, // 快研发
      '/apps/kuaicaiwu': ManufacturingIcons.wallet, // 快财务
      '/apps/kuaichain': ManufacturingIcons.gitBranch, // 快协同
      '/apps/kuaicaiwu/finance-management': ManufacturingIcons.wallet, // 财务管理
      '/apps/kuaicaiwu/cost-management': ManufacturingIcons.calculator, // 成本管理
      '/apps/kuaizhizao/performance': ManufacturingIcons.trophy, // 绩效管理 - 奖杯图标（与分析中心区分）
      '/apps/master-data': ManufacturingIcons.database, // 主数据 - 使用数据库图标
      '/apps/master-data/warehouse': ManufacturingIcons.archive, // 主数据-仓库数据 - 使用归档图标（区别于仓储管理）
      '/apps/master-data/supply-chain': ManufacturingIcons.handshake, // 主数据-客户供应商（客户+供应商）- 握手/合作图标
      '/apps/kuaireport': ManufacturingIcons.fileBarChart, // 快报表 - 报表/图表图标（与仪表盘、大屏中心区分）
      '/apps/kuaireport/reports': ManufacturingIcons.fileBarChart, // 报表中心
      '/apps/kuaireport/dashboards': ManufacturingIcons.layoutDashboard, // 大屏中心
      '/apps/kuaiai': ManufacturingIcons.sparkles, // KU-AI - 顶栏 AI 助手（无侧栏菜单）
      '/apps/haoligo/workspace': ManufacturingIcons.layoutDashboard, // 好力 GO 工作台（仪表板分组下）
      '/apps/haoligo/equipment': ManufacturingIcons.wrench, // 好力 GO 设备管理
      '/apps/haoligo/molds': ManufacturingIcons.package, // 好力 GO 模具管理
      '/apps/haoligo/patrol': ManufacturingIcons.clipboardCheck, // 好力 GO 现场巡查（点检/记录）
      '/apps/haoligo/quality': ManufacturingIcons['shield-check'], // 好力 GO 品质管理
      '/apps/haoligo/finance': ManufacturingIcons.wallet, // 好力 GO 财务管理
    };

    // 精确路径匹配
    if (pathMap[menuPath]) {
      const IconComponent = pathMap[menuPath];
      return React.createElement(IconComponent, { size: 16 });
    }

    // 前缀路径匹配（用于父级菜单）
    const matchedPath = Object.keys(pathMap).find(path => menuPath.startsWith(path));
    if (matchedPath) {
      const IconComponent = pathMap[matchedPath];
      return React.createElement(IconComponent, { size: 16 });
    }
  }

  // 名称映射（路径未命中时使用，支持中英文）
  // 注意：菜单名称可能已翻译，路径匹配始终优先
  const nameMap: Record<string, React.ComponentType<any>> = {
    // 常见的中文和英文名称映射
    'Dashboard': ManufacturingIcons.industrialDashboard,
    'Workplace': ManufacturingIcons.production,
    'Analysis': ManufacturingIcons.chartLine,
    'Operations Dashboard': ManufacturingIcons.analytics,
    'Operations Center': ManufacturingIcons.operationsCenter,
    'User Management': ManufacturingIcons.users, // 用户管理 - 使用用户组图标
    'Users': ManufacturingIcons.users,
    'System Configuration': ManufacturingIcons.systemConfig,
    'Settings': ManufacturingIcons.systemConfig,
    'Personal Center': ManufacturingIcons.userCircle, // 个人中心 - 使用用户圆圈图标
    'Personal': ManufacturingIcons.userCircle,
    // 应用菜单名称映射
    'Plan Management': ManufacturingIcons.calendar,
    'Planning': ManufacturingIcons.calendar,
    'Production Execution': ManufacturingIcons.activity, // 生产执行 - 使用活动/执行图标
    'Production': ManufacturingIcons.activity,
    'Purchase Management': ManufacturingIcons.shoppingBag,
    'Purchasing': ManufacturingIcons.shoppingBag,
    'Sales Management': ManufacturingIcons.chartLine, // 销售管理 - 使用趋势上升图标（销售增长）
    'Sales': ManufacturingIcons.chartLine,
    'Warehouse Management': ManufacturingIcons.warehouse,
    'Warehouse': ManufacturingIcons.warehouse,
    'Quality Management': ManufacturingIcons.quality,
    'Quality': ManufacturingIcons.quality,
    '品质管理': ManufacturingIcons['shield-check'],
    'Cost Management': ManufacturingIcons.calculator,
    'Cost': ManufacturingIcons.calculator,
    'Equipment Management': ManufacturingIcons.wrench,
    'Equipment': ManufacturingIcons.wrench,
    'Finance Management': ManufacturingIcons.wallet, // 财务管理 - 使用钱包图标
    'Finance': ManufacturingIcons.wallet,
    'Tooling Management': ManufacturingIcons.wrench,
    'Tooling': ManufacturingIcons.wrench,
    'Analysis Center': ManufacturingIcons.analytics,
    'Analytics': ManufacturingIcons.analytics,
    // 基础数据管理相关
    '仓库数据': ManufacturingIcons.archive, // 基础数据管理-仓库数据 - 使用归档图标
    'Warehouse Data': ManufacturingIcons.archive, // 基础数据管理-仓库数据（英文）
    'Report Center': ManufacturingIcons.fileBarChart, // 报表中心
    'Dashboard Center': ManufacturingIcons.layoutDashboard, // 大屏中心
    '报表中心': ManufacturingIcons.fileBarChart,
    '大屏中心': ManufacturingIcons.layoutDashboard,
    // 自制报表（与仪表盘 Gauge 区分，避免重复）
    '自制报表': ManufacturingIcons.fileBarChart,
    'Reports & Dashboards': ManufacturingIcons.fileBarChart,
    'app.kuaireport.name': ManufacturingIcons.fileBarChart,
    'app.kuaireport.menu.selfMadeReports': ManufacturingIcons.fileBarChart,
    // ... 其他常见的英文名称可以在这里添加
  };

  if (nameMap[menuName]) {
    const IconComponent = nameMap[menuName];
    return React.createElement(IconComponent, { size: 16 });
  }

  // 如果找不到匹配的图标，返回默认的 Lucide 图标
  return React.createElement(ManufacturingIcons.dashboard, { size: 16 });
};

/**
 * 平台级 + 系统级菜单配置（原有写法，硬编号）
 * 仅应用级 APP 使用数据库统一源（manifest 同步 → core_menus）
 */
type PermissionMenuDataItem = MenuDataItem &
  MenuDataItemWithLocaleKey & {
    permissionCodes?: string[];
  };

/** 根据当前路由计算侧栏应展开的分组 key（不含叶子节点 key） */
function computeMenuOpenKeysForPath(items: MenuDataItem[], currentPath: string): string[] {
  const openKeys: string[] = [];
  const walk = (nodes: MenuDataItem[], ancestors: string[]): boolean => {
    for (const node of nodes) {
      const nodeKey = node.key ?? node.path;
      const keyStr = nodeKey ? String(nodeKey) : '';
      const nextAncestors = keyStr ? [...ancestors, keyStr] : ancestors;
      if (node.path === currentPath) {
        openKeys.push(...ancestors);
        return true;
      }
      if (node.children?.length && walk(node.children, nextAncestors)) {
        return true;
      }
    }
    return false;
  };
  walk(items, []);
  return [...new Set(openKeys)];
}

const getMenuConfig = (t: (key: string) => string): PermissionMenuDataItem[] => [
  {
    path: '/system/dashboard',
    name: t('menu.dashboard'),
    icon: getMenuIcon(t('menu.dashboard'), '/system/dashboard'),
    permissionCodes: ['system:application:read', 'system:menu:read'],
    children: [
      {
        path: '/system/dashboard/workplace',
        name: t('menu.dashboard.workplace'),
        icon: getMenuIcon(t('menu.dashboard.workplace'), '/system/dashboard/workplace'),
        permissionCodes: ['system:application:read', 'system:menu:read'],
      },
      {
        path: '/system/dashboard/analysis',
        name: t('menu.dashboard.analysis'),
        icon: getMenuIcon(t('menu.dashboard.analysis'), '/system/dashboard/analysis'),
        permissionCodes: ['system:application:read', 'system:menu:read'],
      },
    ],
  },
  {
    path: '/system',
    name: t('menu.system'),
    icon: getMenuIcon(t('menu.system'), '/system'),
    permissionCodes: [
      'system:application:read',
      'system:menu:read',
      'system:site-setting:read',
      'system:config-center:read',
      'system:data-dictionary:read',
      'system:language:read',
      'system:code-rule:read',
      'system:custom-field:read',
      'system:department:read',
      'system:position:read',
      'system:role:read',
      'system:user:read',
      'system:file:read',
      'system:api:read',
      'system:data-source:read',
      'system:application-connection:read',
      'system:dataset:read',
      'system:approval-process:read',
      'system:approval-instance:read',
      'system:message-template:read',
      'system:message-config:read',
      'system:print-device:read',
      'system:print-template:read',
      'system:operation-log:read',
      'system:login-log:read',
      'system:online-user:read',
      'system:data-backup:read',
      'kuaizhizao:warehouse-management-initial-data:read',
      'system:user-profile:read',
      'system:user-preference:read',
      'system:user-message:read',
      'system:user-task:read',
    ],
    children: [
      { key: 'core-config-group', type: 'group', name: t('menu.group.core-config'), label: t('menu.group.core-config'), className: 'riveredge-menu-group-title', children: [
        { path: '/system/applications', name: t('menu.system.applications'), icon: getMenuIcon(t('menu.system.applications'), '/system/applications'), permissionCodes: ['system:application:create', 'system:application:read', 'system:application:update', 'system:application:delete'] },
        { path: '/system/menus', name: t('menu.system.menus'), icon: getMenuIcon(t('menu.system.menus'), '/system/menus'), permissionCodes: ['system:menu:create', 'system:menu:read', 'system:menu:update', 'system:menu:delete'] },
        { path: '/system/site-settings', name: t('menu.system.site-settings'), icon: getMenuIcon(t('menu.system.site-settings'), '/system/site-settings'), permissionCodes: ['system:site-setting:read', 'system:site-setting:update'] },
        { path: '/system/config-center', name: t('menu.system.business-config'), icon: getMenuIcon(t('menu.system.business-config'), '/system/config-center'), permissionCodes: ['system:config-center:create', 'system:config-center:read', 'system:config-center:update', 'system:config-center:delete'] },
        { path: '/system/data-dictionaries', name: t('menu.system.data-dictionaries'), icon: getMenuIcon(t('menu.system.data-dictionaries'), '/system/data-dictionaries'), permissionCodes: ['system:data-dictionary:create', 'system:data-dictionary:read', 'system:data-dictionary:update', 'system:data-dictionary:delete'] },
        { path: '/system/languages', name: t('menu.system.languages'), icon: getMenuIcon(t('menu.system.languages'), '/system/languages'), permissionCodes: ['system:language:create', 'system:language:read', 'system:language:update', 'system:language:delete'] },
        { path: '/system/code-rules', name: t('menu.system.code-rules'), icon: getMenuIcon(t('menu.system.code-rules'), '/system/code-rules'), permissionCodes: ['system:code-rule:create', 'system:code-rule:read', 'system:code-rule:update', 'system:code-rule:delete'] },
        { path: '/system/custom-fields', name: t('menu.system.custom-fields'), icon: getMenuIcon(t('menu.system.custom-fields'), '/system/custom-fields'), permissionCodes: ['system:custom-field:create', 'system:custom-field:read', 'system:custom-field:update', 'system:custom-field:delete'] },
        { path: '/system/onboarding-wizard', name: t('menu.system.onboarding-wizard'), icon: getMenuIcon(t('menu.system.onboarding-wizard'), '/system/onboarding-wizard'), permissionCodes: ['system:onboarding-wizard:read', 'system:onboarding-wizard:update'] },
      ]},
      { key: 'user-management-group', type: 'group', name: t('menu.group.user-management'), label: t('menu.group.user-management'), className: 'riveredge-menu-group-title', children: [
        { path: '/system/departments', name: t('menu.system.departments'), icon: getMenuIcon(t('menu.system.departments'), '/system/departments'), permissionCodes: ['system:department:create', 'system:department:read', 'system:department:update', 'system:department:delete', 'system:department:import', 'system:department:export'] },
        { path: '/system/positions', name: t('menu.system.positions'), icon: getMenuIcon(t('menu.system.positions'), '/system/positions'), permissionCodes: ['system:position:create', 'system:position:read', 'system:position:update', 'system:position:delete', 'system:position:import', 'system:position:export'] },
        { path: '/system/roles', name: t('menu.system.roles-permissions'), icon: getMenuIcon(t('menu.system.roles-permissions'), '/system/roles'), permissionCodes: ['system:role:create', 'system:role:read', 'system:role:update', 'system:role:delete', 'system:role:assign', 'system:role:import', 'system:role:export'] },
        { path: '/system/users', name: t('menu.system.users'), icon: getMenuIcon(t('menu.system.users'), '/system/users'), permissionCodes: ['system:user:create', 'system:user:read', 'system:user:update', 'system:user:delete', 'system:user:import', 'system:user:export'] },
      ]},
      { key: 'data-center-group', type: 'group', name: t('menu.group.data-center'), label: t('menu.group.data-center'), className: 'riveredge-menu-group-title', children: [
        {
          path: '/system/initial-data',
          name: t('menu.system.initial-data'),
          icon: getMenuIcon(t('menu.system.initial-data'), '/system/initial-data'),
          permissionCodes: ['kuaizhizao:warehouse-management-initial-data:read'],
        },
        { path: '/system/files', name: t('menu.system.files'), icon: getMenuIcon(t('menu.system.files'), '/system/files'), permissionCodes: ['system:file:create', 'system:file:read', 'system:file:update', 'system:file:delete', 'system:file:export'] },
        { path: '/system/apis', name: t('menu.system.apis'), icon: getMenuIcon(t('menu.system.apis'), '/system/apis'), permissionCodes: ['system:api:create', 'system:api:read', 'system:api:update', 'system:api:delete'] },
        { path: '/system/data-sources', name: t('menu.system.data-sources'), icon: getMenuIcon(t('menu.system.data-sources'), '/system/data-sources'), permissionCodes: ['system:data-source:create', 'system:data-source:read', 'system:data-source:update', 'system:data-source:delete'] },
        { path: '/system/application-connections', name: t('menu.system.application-connections'), icon: getMenuIcon(t('menu.system.application-connections'), '/system/application-connections'), permissionCodes: ['system:application-connection:create', 'system:application-connection:read', 'system:application-connection:update', 'system:application-connection:delete'] },
        { path: '/system/datasets', name: t('menu.system.datasets'), icon: getMenuIcon(t('menu.system.datasets'), '/system/datasets'), permissionCodes: ['system:dataset:create', 'system:dataset:read', 'system:dataset:update', 'system:dataset:delete'] },
      ]},
      { key: 'process-management-group', type: 'group', name: t('menu.group.process-management'), label: t('menu.group.process-management'), className: 'riveredge-menu-group-title', children: [
        { path: '/system/approval-processes', name: t('menu.system.approval-processes'), icon: getMenuIcon(t('menu.system.approval-processes'), '/system/approval-processes'), permissionCodes: ['system:approval-process:create', 'system:approval-process:read', 'system:approval-process:update', 'system:approval-process:delete'], children: [{ path: '/system/approval-processes/designer', name: t('path.system.approval-processes.designer'), hideInMenu: true, permissionCodes: ['system:approval-process:update'] }] },
        { path: '/system/messages/template', name: t('menu.system.messages.template'), icon: getMenuIcon(t('menu.system.messages.template'), '/system/messages/template'), permissionCodes: ['system:message-template:create', 'system:message-template:read', 'system:message-template:update', 'system:message-template:delete'] },
        { path: '/system/print-templates', name: t('menu.system.print-templates'), icon: getMenuIcon(t('menu.system.print-templates'), '/system/print-templates'), permissionCodes: ['system:print-template:create', 'system:print-template:read', 'system:print-template:update', 'system:print-template:delete'], children: [{ path: '/system/print-templates/design', name: t('path.system.print-templates.design'), hideInMenu: true, permissionCodes: ['system:print-template:update'] }] },
        { path: '/system/approval-instances', name: t('menu.system.approval-instances'), icon: getMenuIcon(t('menu.system.approval-instances'), '/system/approval-instances'), permissionCodes: ['system:approval-instance:read', 'system:approval-instance:update'] },
        { path: '/system/messages/config', name: t('menu.system.messages.config'), icon: getMenuIcon(t('menu.system.messages.config'), '/system/messages/config'), permissionCodes: ['system:message-config:create', 'system:message-config:read', 'system:message-config:update', 'system:message-config:delete'] },
        { path: '/system/print-devices', name: t('menu.system.print-devices'), icon: getMenuIcon(t('menu.system.print-devices'), '/system/print-devices'), permissionCodes: ['system:print-device:create', 'system:print-device:read', 'system:print-device:update', 'system:print-device:delete'] },
      ]},
      { key: 'monitoring-ops-group', type: 'group', name: t('menu.group.monitoring-ops'), label: t('menu.group.monitoring-ops'), className: 'riveredge-menu-group-title', children: [
        { path: '/system/operation-logs', name: t('menu.system.operation-logs'), icon: getMenuIcon(t('menu.system.operation-logs'), '/system/operation-logs'), permissionCodes: ['system:operation-log:read'] },
        { path: '/system/login-logs', name: t('menu.system.login-logs'), icon: getMenuIcon(t('menu.system.login-logs'), '/system/login-logs'), permissionCodes: ['system:login-log:read'] },
        { path: '/system/online-users', name: t('menu.system.online-users'), icon: getMenuIcon(t('menu.system.online-users'), '/system/online-users'), permissionCodes: ['system:online-user:read'] },
        { path: '/system/data-backups', name: t('menu.system.data-backups'), icon: getMenuIcon(t('menu.system.data-backups'), '/system/data-backups'), permissionCodes: ['system:data-backup:read'] },
      ]},
      { key: 'personal-center-group', type: 'group', name: t('menu.personal'), label: t('menu.personal'), className: 'riveredge-menu-group-title', children: [
        {
          path: '/personal/profile',
          name: t('menu.personal.profile'),
          icon: getMenuIcon(t('menu.personal.profile'), '/personal/profile'),
          permissionCodes: ['system:user-profile:read', 'system:user-profile:update'],
        },
        {
          path: '/personal/preferences',
          name: t('menu.personal.preferences'),
          icon: getMenuIcon(t('menu.personal.preferences'), '/personal/preferences'),
          permissionCodes: ['system:user-preference:read', 'system:user-preference:update'],
        },
        {
          path: '/personal/messages',
          name: t('menu.personal.messages'),
          icon: getMenuIcon(t('menu.personal.messages'), '/personal/messages'),
          permissionCodes: ['system:user-message:read', 'system:user-message:update'],
        },
        {
          path: '/personal/tasks',
          name: t('menu.personal.tasks'),
          icon: getMenuIcon(t('menu.personal.tasks'), '/personal/tasks'),
          permissionCodes: ['system:user-task:read', 'system:user-task:update'],
        },
      ]},
    ],
  },
  {
    key: 'menu.infra',
    name: t('menu.infra'),
    icon: getMenuIcon(t('menu.infra'), '/infra/operation'),
    children: [
      { path: '/infra/operation', name: t('menu.infra.operation'), icon: getMenuIcon(t('menu.infra.operation'), '/infra/operation') },
      { path: '/infra/admin', name: t('menu.infra.admin'), icon: getMenuIcon(t('menu.infra.admin'), '/infra/admin') },
      { path: '/infra/tenants', name: t('menu.infra.tenants'), icon: getMenuIcon(t('menu.infra.tenants'), '/infra/tenants') },
      { path: '/infra/packages', name: t('menu.infra.packages'), icon: getMenuIcon(t('menu.infra.packages'), '/infra/packages') },
      { path: '/infra/scripts', name: t('menu.infra.scripts'), icon: getMenuIcon(t('menu.infra.scripts'), '/infra/scripts') },
      { path: '/infra/scheduled-tasks', name: t('menu.infra.scheduled-tasks'), icon: getMenuIcon(t('menu.infra.scheduled-tasks'), '/infra/scheduled-tasks') },
      { path: '/infra/client-releases', name: t('menu.infra.client-releases'), icon: getMenuIcon(t('menu.infra.client-releases'), '/infra/client-releases') },
      { path: '/infra/license-management', name: t('menu.infra.license-management'), icon: getMenuIcon(t('menu.infra.license-management'), '/infra/license-management') },
    ],
  },
];

/**
 * 基础布局组件
 */
export default function BasicLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken(); // 获取主题 token
  const { i18n: i18nInstance, t } = useSafeTranslation(); // 获取 i18n 实例和翻译函数（安全的）
  
  // 精确订阅：只读取 BasicLayout 需要的 sidebar_collapsed 字段
  // 避免订阅整个 preferences 对象，防止无关偏好更新导致整个布局重渲染
  const sidebarCollapsedPref = useUserPreferenceStore((s) => {
    const prefs = s.preferences;
    if (prefs?.ui?.sidebar_collapsed !== undefined) return prefs.ui.sidebar_collapsed;
    if (prefs?.['ui.sidebar_collapsed'] !== undefined) return prefs['ui.sidebar_collapsed'];
    return undefined;
  });
  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);

  const sidebarMenuLayoutPref = useUserPreferenceStore((s) =>
    readSidebarMenuLayoutPref(s.preferences as Record<string, unknown> | undefined),
  );

  // 侧边栏折叠状态
  const [collapsed, setCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (sidebarCollapsedPref !== undefined) {
      setCollapsed(Boolean(sidebarCollapsedPref));
    }
  }, [sidebarCollapsedPref]);

  // 处理侧边栏折叠切换
  const handleSetCollapsed = (payload: boolean) => {
    setCollapsed(payload);
    // 更新用户偏好
    updatePreferences({ 'ui.sidebar_collapsed': payload });
  };

  const screens = Grid.useBreakpoint?.() ?? {};
  const touchScreen = useTouchScreen();

  // PC / H5 二分：宽度中间档不再走平板壳；仅「触屏工位 + 竖屏」保留紧凑顶栏
  // 普通浏览器缩到 <1200 已跳 H5，此处勿再按 screens.lg / 宽度切平板模式
  const isMobileOrTablet = touchScreen.isTouchScreenMode && touchScreen.isPortrait;
  const isSplitSidebarLayout = sidebarMenuLayoutPref === 'split' && !isMobileOrTablet;
  /** 双列偏好且侧栏展开时才用 SplitSidebarMenu；收起时走平铺菜单 */
  const useSplitSidebarMenu = isSplitSidebarLayout && !collapsed;

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-sidebar-menu-layout',
      useSplitSidebarMenu ? 'split' : 'flat',
    );
  }, [useSplitSidebarMenu]);

  // 工作区最大化模式 (由 UniTab 控制)
  const [isFullscreen, setIsFullscreen] = useState(false);
  // 浏览器全屏模式 (由顶栏控制)
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [techStackModalOpen, setTechStackModalOpen] = useState(false);
  const [themeEditorOpen, setThemeEditorOpen] = useState(false);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  /** 开始面板：挂载与退场动画（仿 Win11 自左下上浮/下沉） */
  const [systemSettingsPanelMounted, setSystemSettingsPanelMounted] = useState(false);
  const [systemSettingsPanelExiting, setSystemSettingsPanelExiting] = useState(false);
  const [breadcrumbVisible, setBreadcrumbVisible] = useState(true);
  /** 详情页等通过 riveredge:update-tab-title 推送的单号，用于面包屑末级展示 */
  const [customPageLabel, setCustomPageLabel] = useState<string | undefined>();
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const systemSettingsPanelRef = useRef<HTMLDivElement>(null);
  const systemSettingsTriggerRef = useRef<HTMLButtonElement>(null);

  const closeSystemSettingsPanelAnimated = useCallback(() => {
    if (!systemSettingsPanelMounted || systemSettingsPanelExiting) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSystemSettingsPanelMounted(false);
      setSystemSettingsPanelExiting(false);
      return;
    }
    setSystemSettingsPanelExiting(true);
  }, [systemSettingsPanelMounted, systemSettingsPanelExiting]);

  const openSystemSettingsPanel = useCallback(() => {
    if (systemSettingsPanelExiting) return;
    setSystemSettingsPanelExiting(false);
    setSystemSettingsPanelMounted(true);
  }, [systemSettingsPanelExiting]);

  const unmountSystemSettingsPanel = useCallback(() => {
    setSystemSettingsPanelExiting(false);
    setSystemSettingsPanelMounted(false);
  }, []);

  const handleSystemSettingsPanelAnimationEnd = useCallback((e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.animationName !== 'riveredgeSystemPanelOut') return;
    setSystemSettingsPanelMounted(false);
    setSystemSettingsPanelExiting(false);
  }, []);
  const currentUser = useCurrentUser();
  const logout = useGlobalStore((s) => s.logout);
  const isLocked = useGlobalStore((s) => s.isLocked);
  const lockScreen = useGlobalStore((s) => s.lockScreen);
  // 头像 URL：优先从缓存读取以消除首屏闪烁，再异步拉取最新
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);

  // 版权声明关键字段校验（Layout 挂载时执行一次）
  useEffect(() => {
    verifyCopyright();
  }, []);

  // 可选实例登记：telemetry 开启时主界面进入后 POST 一次，失败静默
  useEffect(() => {
    const storageKey = 'install_register_sent';
    if (localStorage.getItem(storageKey) === '1') return;

    let cancelled = false;
    (async () => {
      const provenance = await getBuildProvenance();
      if (cancelled || !provenance?.telemetry_enabled || !provenance.install_instance_id) {
        return;
      }
      const result = await registerInstallInstance({
        install_instance_id: provenance.install_instance_id,
        git_commit: provenance.git_commit,
        build_time: provenance.build_time,
        provenance_status: provenance.status,
        build_git_remote: provenance.build_git_remote,
        build_git_branch: provenance.build_git_branch,
      });
      if (!cancelled && result?.registered) {
        localStorage.setItem(storageKey, '1');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 获取用户头像 URL（如果有 UUID）
  useEffect(() => {
    const loadAvatarUrl = async () => {
      const avatarUuid = (currentUser as any)?.avatar;

      if (avatarUuid) {
        const cached = getCachedAvatarUrl(avatarUuid);
        if (cached) setAvatarUrl(cached);

        try {
          const url = await getAvatarUrl(avatarUuid);
          if (url) {
            setAvatarUrl(url);
          } else {
            setAvatarUrl(undefined);
          }
        } catch (error) {
          console.error(t('ui.error.loadAvatar'), error);
          setAvatarUrl(undefined);
        }
      } else {
        let foundAvatar = false;
        if (currentUser) {
          try {
            const { getUserProfile } = await import('../services/userProfile');
            const profile = await getUserProfile();
            if (profile.avatar) {
              const cached = getCachedAvatarUrl(profile.avatar);
              if (cached) setAvatarUrl(cached);
              const url = await getAvatarUrl(profile.avatar);
              if (url) {
                setAvatarUrl(url);
                foundAvatar = true;
              }
            }
          } catch (error) {
            // 静默失败
          }
        }

        if (!foundAvatar) setAvatarUrl(undefined);
      }
    };

    if (currentUser) {
      loadAvatarUrl();
    }
  }, [currentUser]);

  useEffect(() => {
    setAvatarImageFailed(false);
  }, [avatarUrl]);

  const headerTextAvatar = isTextAvatarDisplay(avatarUrl, avatarImageFailed);

  // 获取可用语言列表
  const { data: languageListData } = useQuery({
    queryKey: ['availableLanguages'],
    queryFn: () => getLanguageList({ is_active: true }),
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });

  // 组织初始化提醒已移至上线助手中，不再全局展示




  const queryClient = useQueryClient();

  const { data: platformSettingsPublic } = useQuery({
    queryKey: ['platformSettingsPublic'],
    queryFn: getPlatformSettingsPublic,
    staleTime: 60 * 1000,
  });
  const copyrightMenuEnabled = platformSettingsPublic?.copyright_menu_enabled !== false;

  /** 登出前清理租户相关 Query 缓存，避免重新登录后仍显示旧侧边栏菜单（applicationMenus staleTime 内不 refetch） */
  const performLogout = useCallback(() => {
    clearSessionScopedQueries(queryClient);
    logout();
    redirectAfterLogout(navigate);
  }, [queryClient, logout, navigate]);

  // 站点设置：统一从 configStore 获取（app.tsx 初始化时已 fetchConfigs，site-settings 保存时会 refresh）
  const siteName = (useConfigStore((s) => (s.getConfig('site_name', '') as string)?.trim()) || '') || 'RiverEdge SaaS';
  const launchWizardEnabled = useConfigStore((s) => s.configs.enable_launch_wizard !== false);
  const enableSystemDashboard = useConfigStore((s) => s.configs.enable_system_dashboard !== false);
  const documentVisible = useDocumentVisible();

  const tenantIdStrForHome = getTenantId()?.toString() ?? null;
  const { data: tenantBackendHome } = useQuery({
    queryKey: [...TENANT_BACKEND_HOME_QUERY_KEY, tenantIdStrForHome],
    queryFn: getTenantBackendHome,
    enabled: !!(getToken() && tenantIdStrForHome && currentUser),
    staleTime: 60 * 1000,
  });

  const { data: effectiveHome } = useQuery({
    queryKey: [...EFFECTIVE_HOME_QUERY_KEY, tenantIdStrForHome],
    queryFn: getEffectiveHome,
    enabled: !!(getToken() && tenantIdStrForHome && currentUser),
    staleTime: 60 * 1000,
  });

  const effectiveSystemHomePath = useMemo(
    () =>
      resolveEffectiveHomePath(effectiveHome, tenantBackendHome?.path, {
        enable_system_dashboard: enableSystemDashboard,
      }),
    [effectiveHome, tenantBackendHome?.path, enableSystemDashboard],
  );

  // 消息下拉菜单状态
  const [messageDropdownOpen, setMessageDropdownOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiAssistantEverOpened, setAiAssistantEverOpened] = useState(false);
  const openAiAssistant = useCallback(() => {
    setAiAssistantEverOpened(true);
    setAiAssistantOpen(true);
  }, []);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  // 获取消息统计
  const { data: messageStats, refetch: refetchMessageStats } = useQuery({
    queryKey: ['userMessageStats'],
    queryFn: () => getUserMessageStats(),
    ...layoutShellQueryOptions,
    staleTime: 60 * 1000,
    refetchInterval: documentVisible ? 3 * 60 * 1000 : false,
    enabled: !!currentUser && documentVisible,
  });

  // 获取最近的消息列表（仅在下拉菜单打开时获取）
  const { data: recentMessages, isLoading: recentMessagesLoading, refetch: refetchRecentMessages } = useQuery({
    queryKey: ['recentUserMessages'],
    queryFn: () => getUserMessages({ page: 1, page_size: 10, unread_only: false }),
    staleTime: 30 * 1000, // 30 秒缓存
    enabled: !!currentUser && messageDropdownOpen, // 只在用户登录且下拉菜单打开时获取
  });

  // 未读消息数量
  const unreadCount = messageStats?.unread || 0;

  // 判断字符串是否是UUID格式（菜单 name 过滤，与站点 Logo 无关）
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const resolvedSiteLogoUrl = useSiteLogoUrl();
  const [siteLogoDisplayUrl, setSiteLogoDisplayUrl] = useState(resolvedSiteLogoUrl);
  useEffect(() => {
    setSiteLogoDisplayUrl(resolvedSiteLogoUrl);
  }, [resolvedSiteLogoUrl]);

  // 传入 ReactNode，避免 ProLayout 对 string 固定渲染 alt="logo"；加载失败：自定义 → /img/logo.png → /favicon.svg → 内置 data URI
  const siteLogo = useMemo(
    () =>
      siteLogoDisplayUrl ? (
        <img
          src={siteLogoDisplayUrl}
          alt=""
          height={22}
          fetchpriority="high"
          decoding="async"
          style={{
            height: 22,
            width: 'auto',
            maxWidth: 180,
            objectFit: 'contain',
            display: 'block',
            imageRendering: 'auto',
          }}
          onError={() => {
            setSiteLogoDisplayUrl((prev) => nextSiteLogoUrlAfterImageError(prev));
          }}
        />
      ) : (
        <span style={{ height: 22, width: 22, display: 'block' }} />
      ),
    [siteLogoDisplayUrl],
  );

  // 站点设置更新由 site-settings 等页面保存时直接 invalidateQueries，不再依赖 siteThemeUpdated

  /**
   * 将 MenuTree 转换为 MenuDataItem
   * 支持应用菜单的国际化翻译
   */
  const convertMenuTreeToMenuDataItem = React.useCallback((menu: MenuTree, isAppMenu: boolean = false, depth: number = 0): MenuDataItem => {
    // 处理图标：一级菜单必显图标，有 icon 的二级菜单（如主数据-客户供应商）也显示
    // 统一图标大小：16px
    let iconElement: React.ReactNode = undefined;

    // 同等级菜单：优先使用固定的 path 映射（避免 menu.icon 数据不一致）
    if (depth === 0 && menu.path) {
      const normalizedMenuPath = typeof menu.path === 'string' ? menu.path.replace(/\/$/, '') : menu.path;
      const iconFromPath = getMenuIcon(menu.name ?? '', normalizedMenuPath as string);
      // getMenuIcon 找不到匹配时会返回 dashboard 默认图标，这里用它来判断是否命中映射
      if (React.isValidElement(iconFromPath) && (iconFromPath as any).type !== ManufacturingIcons.dashboard) {
        iconElement = iconFromPath;
      }
    }

    if (!iconElement && menu.icon) {
      // 首先尝试从预定义的 ManufacturingIcons 中获取
      const iconKey = menu.icon as keyof typeof ManufacturingIcons;
      const IconComponent = ManufacturingIcons[iconKey];
      if (IconComponent) {
        iconElement = React.createElement(IconComponent, { size: 16 });
      } else {
        // 如果预定义映射中没有，尝试直接从 Lucide Icons 中获取（全量导入支持）
        // 需要动态导入 Lucide Icons（因为全量导入会增加打包体积，所以按需导入）
        // 注意：这里使用同步方式，因为 convertMenuTreeToMenuDataItem 是同步函数
        // 实际上，由于 manufacturingIcons.tsx 已经全量导入了，我们可以直接使用
        // 但为了更好的性能，这里先尝试从预定义映射获取，失败后再尝试直接访问

        // 尝试映射 Ant Design 图标名称
        const lucideIconMap: Record<string, React.ComponentType<any>> = {
          'DashboardOutlined': ManufacturingIcons.industrialDashboard,
          'UserOutlined': ManufacturingIcons.user,
          'TeamOutlined': ManufacturingIcons.users,
          'ApartmentOutlined': ManufacturingIcons.building,
          'CrownOutlined': ManufacturingIcons.crown,
          'AppstoreOutlined': ManufacturingIcons.factory,
          'ControlOutlined': ManufacturingIcons.systemConfig,
          'ShopOutlined': ManufacturingIcons.shop,
          'FileTextOutlined': ManufacturingIcons.fileText,
          'DatabaseOutlined': ManufacturingIcons.database,
          'MonitorOutlined': ManufacturingIcons.monitor,
          'GlobalOutlined': ManufacturingIcons.languages, // 语言管理使用语言图标
          'ApiOutlined': ManufacturingIcons.api,
          'CodeOutlined': ManufacturingIcons.code,
          'PrinterOutlined': ManufacturingIcons.printer,
          'HistoryOutlined': ManufacturingIcons.history,
          'UnorderedListOutlined': ManufacturingIcons.list,
          'CalendarOutlined': ManufacturingIcons.calendar,
          'PlayCircleOutlined': ManufacturingIcons.playCircle,
          'InboxOutlined': ManufacturingIcons.inbox,
          'SafetyOutlined': ManufacturingIcons.shield, // 安全相关使用盾牌图标
          'ShoppingOutlined': ManufacturingIcons.shoppingCart,
          'UserSwitchOutlined': ManufacturingIcons.userCog,
          'SettingOutlined': ManufacturingIcons.mdSettings,
          'BellOutlined': ManufacturingIcons.bell,
          'LoginOutlined': ManufacturingIcons.logIn,
          'BookOutlined': ManufacturingIcons.bookOpen, // 数据字典
          'ClockCircleOutlined': ManufacturingIcons.clock, // 定时任务
          'CheckCircleOutlined': ManufacturingIcons.checkCircle, // 审批实例
          // 快格轻制造应用图标映射
          'planning': ManufacturingIcons.calendar, // 计划管理使用日历图标
          'shopping-cart': ManufacturingIcons.shoppingCart, // 销售管理使用购物车图标
          'bar-chart': ManufacturingIcons.chartBar, // 分析中心 - 柱状图
          'chartBar': ManufacturingIcons.chartBar,
          'analytics': ManufacturingIcons.chartBar, // 分析入口图标
          'trophy': ManufacturingIcons.trophy, // 绩效管理 - 奖杯图标
          'fileSpreadsheet': ManufacturingIcons.fileSpreadsheet, // 报表中心 - 表格图标
          'fileBarChart': ManufacturingIcons.fileBarChart, // 自制报表 - 报表/图表图标
          'layoutDashboard': ManufacturingIcons.layoutDashboard, // 大屏中心
          'Wallet': ManufacturingIcons.wallet,
          'ScanLine': ManufacturingIcons.scanLine,
          'Banknote': ManufacturingIcons.banknote,
          'Building2': ManufacturingIcons.building,
          'BarChartBig': ManufacturingIcons.chartBar,
          'PieChart': ManufacturingIcons.pieChart,
          'CalendarDays': ManufacturingIcons.calendar,
        };
        const IconComponent = lucideIconMap[menu.icon];
        if (IconComponent) {
          iconElement = React.createElement(IconComponent, { size: 16 });
        } else {
          // 预定义映射未命中：按名称 DynamicIcon（按需加载单图标，避免 import *）
          const iconName = menu.icon as string;
          iconElement = React.createElement(LucideIconByName, { name: iconName, size: 16 });
        }
      }
    }

    // 若 icon 未配置/未匹配：按名称与路径回退（含应用菜单 i18n key，如自制报表）
    if (!iconElement && (menu.name || menu.path)) {
      const fromMap = getMenuIcon(menu.name || '', menu.path);
      if (React.isValidElement(fromMap) && (fromMap as any).type !== ManufacturingIcons.dashboard) {
        iconElement = fromMap;
      } else if (depth === 0 && !isAppMenu) {
        // 系统一级菜单：未命中映射时仍给默认图标
        iconElement = fromMap;
      }
    }

    // 处理菜单名称翻译
    const menuNameKey = menu.name;
    const meta = (menu as { meta?: Record<string, any> }).meta;
    const displayNameOverride = isSyncedI18nMenuName(menuNameKey)
      ? getMenuDisplayNameOverride(meta)
      : '';
    let menuName = menuNameKey;
    if (displayNameOverride) {
      menuName = displayNameOverride;
    } else if (isAppMenu && menuNameKey) {
      // 应用菜单使用应用菜单翻译函数
      // 对于分组菜单（没有path），传递子菜单以便从子菜单路径提取应用code
      menuName = translateAppMenuItemName(menuNameKey, menu.path, t, menu.children, meta);
    } else if (menuNameKey) {
      // 系统菜单使用通用菜单翻译函数
      menuName = translateMenuName(menuNameKey, t, menu.path);
    }

    const menuItem: PermissionMenuDataItem = {
      path: menu.path == null ? undefined : menu.path, // 确保 path 不为 null，避免 @umijs/route-utils mergePath 报错
      name: menuName,
      menuNameKey,
      displayNameOverride: displayNameOverride || undefined,
      icon: iconElement,
      key: menu.uuid || menu.path, // 添加 key 字段，ProLayout 需要
      // 如果菜单有子项，确保子项也有 key（应用菜单的子项也是应用菜单）
      children: menu.children && menu.children.length > 0
        ? menu.children.map(child => convertMenuTreeToMenuDataItem(child, isAppMenu, depth + 1))
        : undefined,
    };
    if (menu.permission_code) {
      (menuItem as any).permissionCodes = [menu.permission_code];
    }

    // 如果菜单没有 path，说明是分组标题，需要特殊处理
    if (!menu.path && menu.children && menu.children.length > 0) {
      // 对于有子菜单但没有 path 的菜单项，ProLayout 会将其作为分组标题处理
      // 但我们需要确保子菜单能正确显示
      menuItem.path = undefined; // 明确设置为 undefined
    }

    // 从 meta 同步 type、className、hideInMenu（数据库系统菜单入库后使用）
    if (meta) {
      if (meta.type === 'group') menuItem.type = 'group';
      if (meta.className) menuItem.className = meta.className;
      if (meta.hideInMenu === true) menuItem.hideInMenu = true;
    }

    return menuItem;
  }, [t]); // 添加 t 作为依赖项，确保翻译函数是最新的

  // 稳定引用：避免每次渲染创建新函数导致 useUnifiedMenuData 重复计算
  const getSystemMenuConfig = React.useCallback(() => getMenuConfig(t), [t]);

  const {
    sidebarMenuData: filteredMenuData,
    breadcrumbMenuData,
    isLoading: appMenusLoading,
  } = useUnifiedMenuData({
    getSystemMenuConfig,
    convertMenuTreeToMenuDataItem,
    t,
    collapsed,
  });

  const splitMenuRoots = useMemo(
    () => buildSplitMenuRoots(breadcrumbMenuData),
    [breadcrumbMenuData],
  );

  // APP 菜单来自 navigation-tree（异步），系统菜单为同步硬编码即时渲染。
  // 首次加载（缓存未命中）时在 APP 菜单将出现的位置展示骨架占位，避免「系统菜单先出、
  // APP 菜单稍后无征兆弹出」的突兀感。命中缓存时 isLoading 为 false，不显示骨架。
  const showAppMenuSkeleton = useMemo(() => {
    if (!appMenusLoading) return false;
    const hasAppMenu = filteredMenuData.some(
      (item) =>
        (typeof item.className === 'string' && item.className.includes('app-menu-item')) ||
        item.path?.startsWith('/apps/'),
    );
    return !hasAppMenu;
  }, [appMenusLoading, filteredMenuData]);

  const appMenuSkeletonItems = useMemo<MenuDataItem[]>(() => {
    if (!showAppMenuSkeleton) return [];
    return Array.from({ length: 4 }, (_, i) => ({
      key: `__app-menu-skeleton-${i}`,
      name: '',
      isAppMenuSkeleton: true,
      className: 'app-menu-skeleton-item',
    }) as MenuDataItem);
  }, [showAppMenuSkeleton]);

  const systemMenuEntry = useMemo(
    () => filteredMenuData.find((item) => item.path === '/system'),
    [filteredMenuData]
  );
  const systemSettingsGroups = useMemo(() => {
    const preferredOrder = [
      'core-config-group',
      'user-management-group',
      'personal-center-group',
      'data-center-group',
      'process-management-group',
      'monitoring-ops-group',
    ];
    const spanByKey: Record<string, number> = {
      // 按 24 栅格布局：
      // 第一行：核心配置(12) + 用户管理(6) + 个人中心(6) = 24
      'core-config-group': 12,
      'user-management-group': 6,
      'personal-center-group': 6,
      // 第二行：数据中心(9) + 流程管理(9) + 监控运维(6) = 24
      'data-center-group': 9,
      'process-management-group': 9,
      'monitoring-ops-group': 6,
    };
    const groups = (systemMenuEntry?.children ?? []) as MenuDataItem[];
    const visibleGroups = groups
      .filter((group) => !group?.hideInMenu)
      .map((group, index) => {
        const items = (group.children ?? []).filter(
          (child) =>
            !child?.hideInMenu &&
            !!child?.path &&
            // 顶栏已有入口，不在系统配置浮层里重复展示
            child.path !== '/system/onboarding-wizard' &&
            child.path !== '/system/launch-progress'
        );
        const itemCount = items.length;
        // 每个分组固定显示为两行：列数按数量自动计算
        const itemCols = Math.max(2, Math.ceil(itemCount / 2));
        // 组宽度按设计占位，确保每行总占位凑满 12，避免右侧空白列
        const rawKey = String(group.key || group.name || `system-group-${index}`);
        const groupSpan = spanByKey[rawKey] ?? Math.min(6, Math.max(3, itemCols + 1));
        return {
          key: rawKey,
          name: group.name,
          items,
          itemCount,
          itemCols,
          groupSpan,
        };
      })
      .filter((group) => group.itemCount > 0)
      .sort((a, b) => {
        const aOrder = preferredOrder.indexOf(a.key);
        const bOrder = preferredOrder.indexOf(b.key);
        if (aOrder === -1 && bOrder === -1) return 0;
        if (aOrder === -1) return 1;
        if (bOrder === -1) return -1;
        return aOrder - bOrder;
      });
    return visibleGroups;
  }, [systemMenuEntry]);

  const systemSettingsPanelGridColumns = useMemo(() => {
    if (!systemSettingsGroups.length) return 6;
    let currentRowSpan = 0;
    let maxRowSpan = 0;
    systemSettingsGroups.forEach((group) => {
      const span = Math.max(3, Math.min(24, Number(group.groupSpan) || 6));
      if (currentRowSpan + span > 24) {
        maxRowSpan = Math.max(maxRowSpan, currentRowSpan);
        currentRowSpan = 0;
      }
      currentRowSpan += span;
      maxRowSpan = Math.max(maxRowSpan, currentRowSpan);
    });
    return Math.max(6, Math.min(24, maxRowSpan));
  }, [systemSettingsGroups]);

  const isInfraSuperAdmin = resolveIsInfraSuperAdminSession();

  const { data: infraTenantInfo } = useQuery({
    queryKey: ['systemPanelTenantInfo', currentUser?.tenant_id],
    queryFn: () => getTenantById(currentUser!.tenant_id!, true),
    enabled: systemSettingsPanelMounted && !!currentUser?.tenant_id && isInfraSuperAdmin,
    staleTime: 60_000,
  });

  const { data: systemPanelPackageConfigs } = useQuery({
    queryKey: ['systemPanelPackageConfigs'],
    queryFn: getPackageConfigs,
    enabled: systemSettingsPanelMounted && !!currentUser?.tenant_id,
    staleTime: 300_000,
  });

  const systemSettingsTenantPlan = infraTenantInfo?.plan ?? currentUser?.tenant_plan;
  const systemSettingsTenantExpiresAt = infraTenantInfo?.expires_at ?? currentUser?.tenant_expires_at;

  const systemSettingsPlanLabel = useMemo(() => {
    if (!systemSettingsTenantPlan) return undefined;
    const planKey = String(systemSettingsTenantPlan).toLowerCase();
    return systemPanelPackageConfigs?.[planKey]?.name || undefined;
  }, [systemSettingsTenantPlan, systemPanelPackageConfigs]);

  const systemSettingsExpiresLabel = useMemo(() => {
    if (!systemSettingsTenantExpiresAt) return '2099-12-31';
    return formatDateTime(systemSettingsTenantExpiresAt, 'YYYY-MM-DD HH:mm');
  }, [systemSettingsTenantExpiresAt]);

  const showSystemSettingsTenantMeta = !!currentUser?.tenant_id;

  const systemSettingsPanelWidth = useMemo(() => {
    // 与现有 24 栅格视觉密度保持一致：按列数线性缩放面板宽度
    const columns = systemSettingsPanelGridColumns;
    const trackWidth = 26;
    const columnGap = 12;
    const bodyHorizontalPadding = 28;
    const borderWidth = 2;
    return (
      columns * trackWidth +
      (columns - 1) * columnGap +
      bodyHorizontalPadding +
      borderWidth
    );
  }, [systemSettingsPanelGridColumns]);

  const handleSystemSettingsNavigate = useCallback((path?: string) => {
    if (!path) return;
    unmountSystemSettingsPanel();
    if (path.startsWith('http://') || path.startsWith('https://')) {
      window.open(path, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(path);
  }, [navigate, unmountSystemSettingsPanel]);

  const getSystemPanelIcon = useCallback((path?: string): React.ReactNode => {
    if (!path) return <IconifyIcon icon="fluent-color:apps-24" />;
    const iconMap: Record<string, string> = {
      '/system/applications': 'fluent-color:apps-24',
      '/system/menus': 'fluent-color:apps-list-detail-24',
      '/system/site-settings': 'fluent-color:settings-24',
      '/system/config-center': 'fluent-color:briefcase-24',
      '/system/data-dictionaries': 'fluent-color:book-open-24',
      '/system/languages': 'fluent-color:globe-24',
      '/system/code-rules': 'fluent-color:code-24',
      '/system/custom-fields': 'fluent-color:form-24',
      '/system/departments': 'fluent-color:building-24',
      '/system/positions': 'fluent-color:people-list-24',
      '/system/roles': 'fluent-color:shield-24',
      '/system/users': 'fluent-color:people-24',
      '/system/files': 'fluent-color:document-folder-24',
      '/system/initial-data': 'fluent-color:text-bullet-list-square-sparkle-16',
      '/system/apis': 'fluent-color:puzzle-piece-16',
      '/system/data-sources': 'fluent-color:database-24',
      '/system/application-connections': 'fluent-color:data-pie-24',
      '/system/datasets': 'fluent-color:table-24',
      '/system/approval-processes': 'fluent-color:clipboard-task-24',
      '/system/approval-instances': 'fluent-color:checkmark-circle-24',
      '/system/messages/template': 'fluent-color:drafts-24',
      '/system/messages/config': 'fluent-color:chat-24',
      '/system/print-devices': 'fluent-color:phone-laptop-16',
      '/system/print-templates': 'fluent-color:document-24',
      '/system/operation-logs': 'fluent-color:history-24',
      '/system/login-logs': 'fluent-color:clock-24',
      '/system/online-users': 'fluent-color:people-team-24',
      '/system/data-backups': 'fluent-color:arrow-clockwise-dashes-24',
      '/personal/profile': 'fluent-color:person-24',
      '/personal/preferences': 'fluent-color:options-24',
      '/personal/messages': 'fluent-color:chat-24',
      '/personal/tasks': 'fluent-color:clipboard-24',
    };
    const iconName = iconMap[path];
    if (iconName) return <IconifyIcon icon={iconName} />;
    const matchedPrefix = Object.keys(iconMap).find((key) => path.startsWith(key));
    if (matchedPrefix) {
      return <IconifyIcon icon={iconMap[matchedPrefix]} />;
    }
    return <IconifyIcon icon="fluent-color:apps-24" />;
  }, []);

  const { data: installedApps } = useQuery({
    queryKey: ['installedApplications', { is_active: true }],
    queryFn: () => getInstalledApplicationList({ is_active: true }),
    ...layoutShellQueryOptions,
    staleTime: 5 * 60 * 1000,
  });

  const hasAiAssistantEntry = useMemo(() => {
    const kuaiaiApp = (installedApps ?? []).find((app) => app.code === 'kuaiai');
    if (!kuaiaiApp) return false;
    if (kuaiaiApp.is_pro && kuaiaiApp.can_access === false) return false;
    const user = resolveUserForMenuPermission(currentUser);
    if (!user) return false;
    if (user.is_tenant_admin || user.is_infra_admin) return true;
    return hasPermission(user, 'kuaiai:entry:read');
  }, [installedApps, currentUser]);


  useEffect(() => {
    if (!hasAiAssistantEntry || currentUser?.tenant_id == null) return;
    void queryClient.prefetchQuery({
      queryKey: buildChatIntegrationStatusQueryKey(currentUser.tenant_id),
      queryFn: getChatIntegrationStatus,
      staleTime: 5 * 60 * 1000,
    });
  }, [hasAiAssistantEntry, currentUser?.tenant_id, queryClient]);

  useEffect(() => {
    unmountSystemSettingsPanel();
  }, [location.pathname, unmountSystemSettingsPanel]);

  useEffect(() => {
    if (!systemSettingsPanelMounted) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        systemSettingsPanelRef.current?.contains(target) ||
        systemSettingsTriggerRef.current?.contains(target)
      ) {
        return;
      }
      closeSystemSettingsPanelAnimated();
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSystemSettingsPanelAnimated();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [systemSettingsPanelMounted, closeSystemSettingsPanelAnimated]);

  const { data: menuBadgeCounts = {} } = useQuery({
    queryKey: ['menuBadgeCounts'],
    queryFn: getMenuBadgeCounts,
    enabled: !!currentUser?.id && documentVisible,
    ...layoutShellQueryOptions,
    staleTime: 5 * 60 * 1000,
    refetchInterval: documentVisible ? 5 * 60 * 1000 : false,
  });

  // 用户登录后清除菜单缓存（invalidate 会自动触发 refetch，避免重复调用导致竞态）
  const prevUserIdRef = useRef<number | undefined>();
  useEffect(() => {
    const userId = currentUser?.id;
    const justLoggedIn = userId !== undefined && prevUserIdRef.current === undefined;
    prevUserIdRef.current = userId;
    if (!justLoggedIn) return;
    queryClient.invalidateQueries({ queryKey: ['navigationMenuTree'] });
    queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
  }, [currentUser?.id, queryClient]);

  // 监听租户ID变化，刷新菜单（invalidate 会自动触发 refetch）
  const prevTenantIdRef = useRef<number | undefined>();
  useEffect(() => {
    const tid = currentUser?.tenant_id;
    if (tid !== undefined && prevTenantIdRef.current !== undefined && prevTenantIdRef.current !== tid) {
      queryClient.invalidateQueries({ queryKey: ['navigationMenuTree'] });
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
    }
    prevTenantIdRef.current = tid;
  }, [currentUser?.tenant_id, queryClient]);

  // 当前语言代码
  const currentLanguage = i18nInstance.language || 'zh-CN';
  const isEnglishLocale = currentLanguage.startsWith('en');

  /**
   * 计算颜色的亮度值
   * @param color - 颜色值（十六进制或 rgb/rgba 格式）
   * @returns 亮度值（0-255）
   */
  const calculateColorBrightness = (color: string): number => {
    if (!color || typeof color !== 'string') return 255; // 默认返回浅色

    // 处理十六进制颜色
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      // 处理 3 位十六进制（如 #fff）
      const fullHex = hex.length === 3
        ? hex.split('').map(c => c + c).join('')
        : hex;
      const r = parseInt(fullHex.slice(0, 2), 16);
      const g = parseInt(fullHex.slice(2, 4), 16);
      const b = parseInt(fullHex.slice(4, 6), 16);
      // 计算亮度 (使用相对亮度公式)
      return (r * 299 + g * 587 + b * 114) / 1000;
    }

    // 处理 rgb/rgba 格式
    if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0]);
        const g = parseInt(match[1]);
        const b = parseInt(match[2]);
        return (r * 299 + g * 587 + b * 114) / 1000;
      }
    }

    return 255; // 默认返回浅色
  };

  // 从 themeStore 订阅主题相关状态（单一数据源，无需事件监听）
  // 注意：必须分别订阅，避免选择器返回新对象导致无限重渲染
  const storeSiderBg = useThemeStore((s) => s.resolved.siderBgColor);
  const storeHeaderBg = useThemeStore((s) => s.resolved.headerBgColor);
  const isDarkMode = useThemeStore((s) => s.resolved.isDark);

  useEffect(() => {
    (window as any).__RIVEREDGE_LAYOUT_MODE__ = 'mix';
  }, []);

  // 计算菜单栏背景色和对应的文字颜色
  const siderBgColor = React.useMemo(() => {
    if (isDarkMode) return token.colorBgContainer;
    return storeSiderBg || token.colorBgContainer;
  }, [storeSiderBg, token.colorBgContainer, isDarkMode]);

  // 计算顶栏背景色（支持透明度）
  const headerBgColor = React.useMemo(() => {
    if (isDarkMode) return token.colorBgContainer;
    return storeHeaderBg || token.colorBgContainer;
  }, [storeHeaderBg, token.colorBgContainer, isDarkMode]);

  // 根据顶栏背景色计算文字颜色（参考左侧菜单栏的实现）
  const headerTextColor = React.useMemo(() => {
    if (isDarkMode) {
      return 'var(--ant-colorText)';
    }

    const customBgColor = storeHeaderBg;

    if (customBgColor) {
      // 如果有自定义背景色，根据背景色亮度计算文字颜色
      const brightness = calculateColorBrightness(customBgColor);
      // 如果背景色较暗（亮度 < 128），使用浅色文字；否则使用深色文字
      return brightness < 128 ? '#ffffff' : 'var(--ant-colorText)';
    } else {
      // 如果没有自定义背景色（使用默认背景色），使用默认文字颜色
      return 'var(--ant-colorText)';
    }
  }, [storeHeaderBg, isDarkMode]);

  // 判断显示模式：浅色模式浅色背景
  const isLightModeLightBg = React.useMemo(() => {
    return !isDarkMode && headerTextColor !== '#ffffff';
  }, [isDarkMode, headerTextColor]);

  // 根据菜单栏背景色计算文字颜色
  const siderTextColor = React.useMemo(() => {
    // 深色模式下，使用深色模式的默认文字颜色
    if (isDarkMode) {
      return 'var(--ant-colorText)';
    }

    // 浅色模式下，检查是否有自定义背景色
    const customBgColor = storeSiderBg;

    if (customBgColor) {
      const brightness = calculateColorBrightness(customBgColor);
      return brightness < 128 ? '#ffffff' : 'var(--ant-colorText)';
    }
    return 'var(--ant-colorText)';
  }, [storeSiderBg, isDarkMode]);

  // 浅色模式 + 深色侧栏：菜单统一白字
  const isLightModeDarkSider = React.useMemo(
    () => !isDarkMode && siderTextColor === '#ffffff',
    [isDarkMode, siderTextColor],
  );

  /** 底栏统一判定：深色模式或深色侧栏（白字） */
  const isDarkSiderFooter = React.useMemo(
    () => isDarkMode || siderTextColor === '#ffffff',
    [isDarkMode, siderTextColor],
  );
  /** 底栏按钮统一 token：只维护这一套 */
  const siderFooterToken = React.useMemo(
    () =>
      theme.getDesignToken({
        algorithm: isDarkSiderFooter ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: { colorPrimary: token.colorPrimary },
      }),
    [isDarkSiderFooter, token.colorPrimary],
  );
  /** 开始菜单圆角：跟随系统 token，保底 4px */
  const startMenuBaseRadius = React.useMemo(
    () => Math.max(4, Number(token.borderRadius ?? 6)),
    [token.borderRadius],
  );
  const startMenuPanelRadius = React.useMemo(
    () => Math.max(4, Number(token.borderRadiusLG ?? token.borderRadius ?? 8)),
    [token.borderRadiusLG, token.borderRadius],
  );

  /** 开始菜单（底栏入口 + 浮层）三层磨砂：托盘 blur → 分组半透明卡片 → 图标磁贴 */
  const startMenuTheme = React.useMemo(() => {
    const primary = String(token.colorPrimary);
    if (isDarkSiderFooter) {
      return {
        settingsBtnBg: 'rgba(255, 255, 255, 0.08)',
        settingsBtnBgHover: 'rgba(255, 255, 255, 0.12)',
        settingsBtnBgActive: 'rgba(255, 255, 255, 0.16)',
        settingsBtnBorder: 'rgba(255, 255, 255, 0.14)',
        settingsBtnColor: '#ffffff',
        /** L1 托盘：唯一 backdrop-filter（与 L2 配色对调试验） */
        panelBg: `color-mix(in srgb, ${primary} 8%, rgba(255, 255, 255, 0.05))`,
        panelBgFallback: '#1f2128',
        panelBorder: `color-mix(in srgb, ${primary} 14%, rgba(255, 255, 255, 0.10))`,
        panelShadow: '0 16px 48px rgba(0, 0, 0, 0.48)',
        panelBlur: true,
        panelBlurAmount: '24px',
        panelBlurSaturate: '180%',
        panelHeaderBorder: 'rgba(255, 255, 255, 0.08)',
        panelTitleColor: 'rgba(255, 255, 255, 0.92)',
        panelCloseColor: 'rgba(255, 255, 255, 0.55)',
        panelCloseHoverBg: `color-mix(in srgb, ${primary} 10%, rgb(58 62 74))`,
        panelCloseHoverBorder: 'rgba(255, 255, 255, 0.28)',
        panelCloseHoverColor: 'rgba(255, 255, 255, 0.92)',
        /** L2 分组 */
        panelGroupBg: 'rgba(22, 24, 30, 0.62)',
        panelGroupBorder: 'rgba(255, 255, 255, 0.14)',
        panelGroupInsetShadow: `inset 0 1px 0 color-mix(in srgb, ${primary} 6%, rgba(255, 255, 255, 0.08))`,
        panelGroupTitle: `color-mix(in srgb, ${primary} 28%, rgba(255, 255, 255, 0.78))`,
        /** L3 图标磁贴：最内层，hover 再提亮 */
        panelItemColor: 'rgba(255, 255, 255, 0.88)',
        panelItemBg: 'rgba(255, 255, 255, 0.04)',
        panelItemBorder: 'rgba(255, 255, 255, 0.08)',
        panelItemHoverBg: 'rgba(255, 255, 255, 0.11)',
        panelItemHoverBorder: 'rgba(255, 255, 255, 0.14)',
      };
    }
    // 浅色侧栏：不用 antd colorPrimaryBg。深品牌色（如海军蓝）时 primaryBg 会偏脏灰，
    // 改为主色掺白的淡底，始终保持浅 tint。
    return {
      settingsBtnBg: `color-mix(in srgb, ${primary} 10%, #ffffff)`,
      settingsBtnBgHover: `color-mix(in srgb, ${primary} 16%, #ffffff)`,
      settingsBtnBgActive: `color-mix(in srgb, ${primary} 22%, #ffffff)`,
      settingsBtnBorder: `color-mix(in srgb, ${primary} 18%, #ffffff)`,
      settingsBtnColor: primary,
      /** L1 托盘（与 L2 配色对调试验） */
      panelBg: `color-mix(in srgb, ${primary} 6%, rgba(255, 255, 255, 0.48))`,
      panelBgFallback: String(token.colorBgElevated),
      panelBorder: `color-mix(in srgb, ${primary} 12%, rgba(15, 23, 42, 0.08))`,
      panelShadow:
        `0 0 0 1px rgba(15, 23, 42, 0.06), 0 16px 48px rgba(15, 23, 42, 0.14), inset 0 1px 0 color-mix(in srgb, ${primary} 5%, rgba(255, 255, 255, 0.75))`,
      panelBlur: true,
      panelBlurAmount: '24px',
      panelBlurSaturate: '180%',
      panelHeaderBorder: 'rgba(0, 0, 0, 0.06)',
      panelTitleColor: String(token.colorText),
      panelCloseColor: String(token.colorTextSecondary),
      panelCloseHoverBg: String(siderFooterToken.colorPrimaryBgHover),
      panelCloseHoverBorder: String(siderFooterToken.colorPrimaryBorder),
      panelCloseHoverColor: String(token.colorText),
      /** L2 分组 */
      panelGroupBg: 'rgba(255, 255, 255, 0.58)',
      panelGroupBorder: 'rgba(15, 23, 42, 0.16)',
      panelGroupInsetShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.72)',
      panelGroupTitle: String(siderFooterToken.colorPrimaryText ?? token.colorTextSecondary),
      /** L3 图标磁贴 */
      panelItemColor: String(token.colorText),
      panelItemBg: 'rgba(255, 255, 255, 0.22)',
      panelItemBorder: 'rgba(255, 255, 255, 0.40)',
      panelItemHoverBg: 'rgba(255, 255, 255, 0.48)',
      panelItemHoverBorder: 'rgba(255, 255, 255, 0.62)',
    };
  }, [isDarkSiderFooter, token, siderFooterToken]);

  /**
   * 检查锁屏状态，如果已锁定则重定向到锁屏页
   */
  useEffect(() => {
    if (isLocked && location.pathname !== '/lock-screen') {
      navigate('/lock-screen', { replace: true });
    }
  }, [isLocked, location.pathname, navigate]);

  /**
   * 处理搜索
   */


  /**
   * 键盘快捷键：/ 聚焦侧栏搜索；Ctrl+K 同上；Alt+N 新建；Ctrl+Enter/Ctrl+S 提交弹窗；? 显示快捷键帮助
   * 使用捕获阶段并阻止默认，避免 Alt 被系统/浏览器抢走（如 Windows 菜单栏）
   */
  useEffect(() => {
    const isInputLike = (target: EventTarget | null) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const el = target as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      const role = el.getAttribute?.('role');
      const editable = el.isContentEditable;
      return tag === 'input' || tag === 'textarea' || tag === 'select' || role === 'textbox' || editable;
    };

    const focusSearchInput = () => {
      const sidebarSearch = document.querySelector('.riveredge-sidebar-search-wrapper .ant-input') as HTMLInputElement;
      if (sidebarSearch) {
        sidebarSearch.focus();
        return true;
      }
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 接管 F1 控制，开启 AI 助手（仅在 AI 应用已启用时）
      if (e.key === 'F1' && hasAiAssistantEntry) {
        e.preventDefault();
        e.stopPropagation();
        openAiAssistant();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        focusSearchInput();
        return;
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isInputLike(e.target)) {
        e.preventDefault();
        focusSearchInput();
        return;
      }
      if (e.shiftKey && e.key === '?') {
        e.preventDefault();
        setShortcutHelpOpen((open) => !open);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        if (hasSubmitHandler()) {
          e.preventDefault();
          e.stopPropagation();
          triggerSubmit();
        }
        return;
      }
      if (e.ctrlKey && e.key === 'Enter') {
        if (hasSubmitHandler()) {
          e.preventDefault();
          e.stopPropagation();
          triggerSubmit();
        }
      }
      if (e.altKey && e.key.toLowerCase() === 'n') {
        if (hasNewHandler()) {
          e.preventDefault();
          e.stopPropagation();
          triggerNew();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [hasAiAssistantEntry, openAiAssistant]);

  useEffect(() => {
    if (!hasAiAssistantEntry) return;
    const handleOpenAiAssistant = () => openAiAssistant();
    window.addEventListener('riveredge:open-ai-assistant', handleOpenAiAssistant);
    return () => window.removeEventListener('riveredge:open-ai-assistant', handleOpenAiAssistant);
  }, [hasAiAssistantEntry, openAiAssistant]);

  /**
   * 检测面包屑是否换行，如果换行则隐藏
   */
  useEffect(() => {
    const checkBreadcrumbWrap = () => {
      if (!breadcrumbRef.current) {
        setBreadcrumbVisible(true);
        return;
      }

      const breadcrumbElement = breadcrumbRef.current;
      const olElement = breadcrumbElement.querySelector('ol') || breadcrumbElement.querySelector('ul');
      if (!olElement) {
        setBreadcrumbVisible(true);
        return;
      }

      // 检测第一个和最后一个元素是否在同一行
      const firstItem = olElement.querySelector('.ant-breadcrumb-item:first-child');
      const lastItem = olElement.querySelector('.ant-breadcrumb-item:last-child');
      if (firstItem && lastItem) {
        const firstRect = firstItem.getBoundingClientRect();
        const lastRect = lastItem.getBoundingClientRect();
        // 如果最后一个元素在第一个元素下方（允许5px误差），说明换行了
        const isWrapped = lastRect.top > firstRect.top + 5;
        setBreadcrumbVisible(!isWrapped);
      } else {
        setBreadcrumbVisible(true);
      }
    };

    // 延迟检测，确保 DOM 已完全渲染
    const timer = setTimeout(checkBreadcrumbWrap, 100);

    let resizeThrottle: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      if (resizeThrottle) return;
      resizeThrottle = setTimeout(() => {
        resizeThrottle = undefined;
        checkBreadcrumbWrap();
      }, 120);
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      clearTimeout(timer);
      if (resizeThrottle) clearTimeout(resizeThrottle);
      window.removeEventListener('resize', onResize);
    };
  }, [location.pathname]);

  /**
   * 为分组标题动态添加 className。
   * ProLayout 不会把 items.className 传到 type:'group' 的 DOM，
   * 导致依赖 [class*="menu-group-title-app"] 的主色样式永远不命中，
   * 被后面的 siderTextColor / 灰色通用规则盖掉。
   */
  useLayoutEffect(() => {
    if (useSplitSidebarMenu) return;

    const markGroupTitles = () => {
      document.querySelectorAll('.ant-pro-sider-menu .ant-menu-item-group').forEach((group) => {
        const title = group.querySelector(':scope > .ant-menu-item-group-title');
        if (!title) return;
        title.classList.add('riveredge-menu-group-title');

        const groupEl = group as HTMLElement;
        const idBlob = [
          groupEl.getAttribute('data-menu-id') || '',
          groupEl.id || '',
          title.getAttribute('data-menu-id') || '',
        ].join(' ');
        const hasAppMarker =
          idBlob.includes('app-group') ||
          Boolean(
            group.querySelector(
              '[data-menu-id*="app-group-placeholder"], .app-group-placeholder-item, [data-app-menu-group], .menu-group-title-app-inner, .menu-group-title-app-label',
            ),
          ) ||
          Boolean(title.querySelector('[data-app-menu-group], .menu-group-title-app-inner'));

        if (hasAppMarker) {
          title.classList.add('menu-group-title-app');
          groupEl.classList.add('menu-group-title-app', 'app-menu-container-start');
        }
      });

      document
        .querySelectorAll('.ant-pro-sider-menu .ant-menu-submenu[data-menu-id*="app-group"]')
        .forEach((submenu) => {
          submenu.classList.add('menu-group-title-app', 'app-menu-container-start');
        });
    };

    markGroupTitles();
  }, [filteredMenuData, collapsed, location.pathname, appMenusLoading, useSplitSidebarMenu]);

  /**
   * 根据当前路径设置文档标题（浏览器标签页标题）
   */
  useEffect(() => {
    // 排除登录页等特殊页面
    if (location.pathname.startsWith('/login') || isPlatformAdminLoginPathname(location.pathname)) {
      return;
    }

    // 获取当前页面的标题（使用 breadcrumbMenuData，保留完整层级结构）
    const pageTitle = findMenuTitleWithTranslation(location.pathname, breadcrumbMenuData, t);

    // 站点名称统一从 configStore 获取
    const currentSiteName = useConfigStore.getState().getConfig('site_name', 'RiverEdge SaaS') as string;

    const customTitle = resolveCustomPageTitle(location.pathname, location.search);
    if (customTitle) {
      document.title = `${customTitle} - ${currentSiteName}`;
      return;
    }

    // 设置文档标题，使用站点名称作为后缀
    if (pageTitle && pageTitle !== t('common.unnamedPage')) {
      document.title = `${pageTitle} - ${currentSiteName}`;
    } else {
      document.title = `${currentSiteName} - ${t('common.docTitleSuffix')}`;
    }
  }, [location.pathname, location.search, breadcrumbMenuData, t, siteName, currentUser]);

  /** 路由切换时从缓存恢复详情页单号（标签栏已写入 customPageTitles） */
  useEffect(() => {
    setCustomPageLabel(resolveCustomPageTitle(location.pathname, location.search));
  }, [location.pathname, location.search]);

  /**
   * 页面加载后通过 riveredge:update-tab-title 推送的单号/名称，同步更新浏览器标签标题
   */
  useEffect(() => {
    const handleUpdateTabTitle = (event: Event) => {
      const { key, path, title } = (event as CustomEvent<{ key?: string; path?: string; title: string }>).detail ?? {};
      if (!title) return;
      const currentKey = location.pathname + location.search;
      const matches =
        (key && key === currentKey) ||
        (path && path === location.pathname) ||
        (path && currentKey.split('?')[0] === path);
      if (!matches) return;
      setCustomPageLabel(title);
      const currentSiteName = useConfigStore.getState().getConfig('site_name', 'RiverEdge SaaS') as string;
      document.title = `${title} - ${currentSiteName}`;
    };
    window.addEventListener('riveredge:update-tab-title', handleUpdateTabTitle);
    return () => window.removeEventListener('riveredge:update-tab-title', handleUpdateTabTitle);
  }, [location.pathname, location.search]);

  /**
   * 根据用户权限过滤菜单
   * 
   * 权限控制规则：
   * - 平台级管理员：可见第一组 + 第二组 + 第三组 + 第四组
   * - 系统级管理员：可见第一组 + 第二组 + 第三组
   * - 应用级用户：可见第一组 + 第二组（根据权限过滤）
   */
  /**
   * 用户菜单项
   */
  const getUserMenuItems = (t: (key: string) => string): MenuProps['items'] => {
    const items: NonNullable<MenuProps['items']> = [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: t('ui.user.profile'),
      },
    ];
    if (copyrightMenuEnabled) {
      items.push({
        key: 'copyright',
        icon: <FileTextOutlined />,
        label: t('ui.copyright'),
      });
    }
    items.push(
      {
        key: 'clear-menu-cache',
        icon: <DeleteOutlined />,
        label: t('ui.clearCache'),
      },
      {
        key: 'lock-screen',
        icon: <LockOutlined />,
        label: t('ui.lock.screen'),
        onClick: handleLockScreen,
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: t('ui.logout'),
      },
    );
    return items;
  };

  // 处理用户菜单点击
  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'profile':
        // 导航到个人资料页面
        navigate('/personal/profile');
        break;
      case 'copyright':
        verifyCopyright();
        setTechStackModalOpen(true);
        break;
      case 'clear-menu-cache':
        queryClient.invalidateQueries({ queryKey: ['navigationMenuTree'] });
        queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-menu-tree'] });
        message.success(t('ui.clearCacheSuccess'));
        break;
      case 'lock-screen':
        handleLockScreen();
        break;
      case 'logout':
        performLogout();
        break;
    }
  };

  /**
   * 根据当前路径和统一菜单数据生成面包屑（使用 filteredMenuData，含应用菜单）
   */
  const generateBreadcrumb = useMemo(() => {
    const breadcrumbItems: {
      title: string;
      path?: string;
      icon?: React.ReactNode;
      menu?: { items: Array<{ key: string; label: string; onClick: () => void }> };
    }[] = [];

    // 查找当前路径对应的菜单项及其父级菜单
    const findMenuPath = (items: MenuDataItem[] | undefined, targetPath: string, path: MenuDataItem[] = []): MenuDataItem[] | null => {
      if (!items || !Array.isArray(items) || items.length === 0) {
        return null;
      }

      for (const item of items) {
        const currentPath = [...path, item];

        if (item.path && item.path.replace(/\/$/, '') === targetPath.replace(/\/$/, '')) {
          return currentPath;
        }

        if (item.children) {
          const found = findMenuPath(item.children, targetPath, currentPath);
          if (found) return found;
        }
      }
      return null;
    };

    // 统一的面包屑生成逻辑：使用 breadcrumbMenuData（保留完整层级），优先匹配菜单树，匹配不到时向上寻找最近的父级菜单
    let menuPath = findMenuPath(breadcrumbMenuData, location.pathname);
    
    // 如果直接匹配不到（不在菜单里的详情页/设计器），尝试向上寻找父级路径
    if (!menuPath) {
      let tempPath = location.pathname;
      while (tempPath.includes('/') && !menuPath) {
        tempPath = tempPath.substring(0, tempPath.lastIndexOf('/'));
        if (tempPath) {
          const parentPath = findMenuPath(breadcrumbMenuData, tempPath);
          if (parentPath) {
            menuPath = [...parentPath, { path: location.pathname, name: t('common.unnamedPage') }];
          }
        }
      }
    }

    const findFirstActualMenuItem = (items: MenuDataItem[] | undefined): MenuDataItem | null => {
      if (!items || !Array.isArray(items) || items.length === 0) return null;
      const firstItem = items[0];
      if (firstItem.type === 'group' && firstItem.children) {
        return findFirstActualMenuItem(firstItem.children);
      }
      if (firstItem.path && firstItem.name) {
        return firstItem;
      }
      if (firstItem.children) {
        return findFirstActualMenuItem(firstItem.children);
      }
      return null;
    };

    if (menuPath) {
      menuPath.forEach((item, index) => {
        // 跳过没有名称的占位节点
        if (!item.name) return;
        // 跳过 UUID 名称（不应显示在面包屑中）
        if (isUUID(item.name as string)) return;

        let menu: { items: Array<{ key: string; label: string; onClick: () => void }> } | undefined;
        
        // 确定面包屑项的跳转路径：
        // 1. 如果节点有 path，直接使用
        // 2. 如果节点没有 path（中间分组节点，如"销售管理"），找第一个有 path 的子孙节点
        let actualPath = item.path;
        if (!actualPath && item.children && item.children.length > 0) {
          const firstLeaf = findFirstActualMenuItem(item.children);
          if (firstLeaf?.path) {
            actualPath = firstLeaf.path;
          }
        }
        
        // 如果是第一级且有子项，尝试找到第一个实际的菜单项作为链接跳转路径
        if (index === 0 && item.children && item.children.length > 0) {
          const firstChild = item.children[0];
          if (firstChild.type === 'group' && firstChild.children) {
            const firstMenuItem = findFirstActualMenuItem(firstChild.children);
            if (firstMenuItem && firstMenuItem.path) {
              actualPath = firstMenuItem.path;
            }
          }
        }

        // 处理下拉菜单（如果有多个同级子项）
        if (index > 0) {
          const parentItem = menuPath![index - 1];
          if (parentItem.children && parentItem.children.length > 1) {
            menu = {
              items: parentItem.children
                .filter(child => child.name && !child.hideInMenu && !isUUID(child.name as string))
                .map(child => {
                  // 子节点的跳转路径：有 path 用 path，没有则找第一个叶子
                  const childPath = child.path || findFirstActualMenuItem(child.children)?.path;
                  if (!childPath) return null;
                  const isAppMenu = childPath.startsWith('/apps/');
                  const label = isAppMenu
                    ? translateAppMenuItemName(child.name as string, child.path, t)
                    : translateMenuName(child.name as string, t, childPath);
                  return {
                    key: childPath,
                    label: label,
                    onClick: () => { navigate(childPath); }
                  };
                })
                .filter(Boolean) as Array<{ key: string; label: string; onClick: () => void }>
            };
          }
        }

        // 翻译标题
        // 判断是否为 APP 根节点（面包屑中的 APP 名称）：
        // 1. key 以 breadcrumb-app- 开头（useUnifiedMenuData 注入的标识）
        // 2. 或者带有 isAppRoot 标记（最可靠的识别方式）
        // 3. 或者 item.path 为空或只有 /apps/{code} 两段（无子菜单路径）
        // 这类节点的 name 已由 useUnifiedMenuData 通过 getAppDisplayName+locale 翻译，直接使用
        const isAppMenu = (actualPath || '')?.startsWith('/apps/');
        const nodeKey = typeof item.key === 'string' ? item.key : '';
        const isAppRootNode = isAppMenu && (
          (item as any).isAppRoot === true ||
          nodeKey.startsWith('breadcrumb-app-') ||
          (!item.path || (item.path as string).match(/^\/apps\/[^/]+$/) !== null)
        );
        const breadcrumbTitle = translateMenuItemTitle(item as PermissionMenuDataItem, t, {
          isAppRoot: isAppRootNode,
        });

        breadcrumbItems.push({
          title: breadcrumbTitle,
          path: actualPath,
          icon: item.icon,
          menu: menu?.items && menu.items.length > 0 ? menu : undefined,
        });
      });
    }

    // 若未命中任何菜单节点，应用路由禁止 path 片段兜底
    if (breadcrumbItems.length === 0 && !location.pathname.startsWith('/apps/')) {
      const translatedTitle = translatePathTitle(location.pathname, t);
      if (translatedTitle) {
        breadcrumbItems.push({
          title: translatedTitle,
          path: location.pathname,
        });
      }
    }

    const labelOverride =
      customPageLabel ?? resolveCustomPageTitle(location.pathname, location.search);
    if (labelOverride && breadcrumbItems.length > 0) {
      const lastIdx = breadcrumbItems.length - 1;
      breadcrumbItems[lastIdx] = { ...breadcrumbItems[lastIdx], title: labelOverride };
    }

    return breadcrumbItems.filter(item => item.title);
  }, [location.pathname, location.search, breadcrumbMenuData, navigate, t, customPageLabel]);

  /**
   * 计算应该选中的菜单 key（只选中精确匹配的路径，不选中父级菜单）
   * 
   * @param menuItems - 菜单项数组
   * @param currentPath - 当前路径
   * @returns 应该选中的菜单 key 数组
   */
  const calculateSelectedKeys = React.useCallback((menuItems: MenuDataItem[], currentPath: string): string[] => {
    const selectedKeys: string[] = [];

    /**
     * 递归查找精确匹配当前路径的菜单项
     * 
     * @param items - 菜单项数组
     * @param path - 当前路径
     * @returns 是否找到匹配的菜单项
     */
    const findExactMatch = (items: MenuDataItem[], path: string): boolean => {
      for (const item of items) {
        const itemKey = item.key || item.path;
        if (!itemKey) continue;

        // 精确匹配：只有路径完全相等时才选中
        if (item.path === path) {
          selectedKeys.push(itemKey as string);
          return true;
        }

        // 如果菜单项有子菜单，递归查找
        if (item.children && item.children.length > 0) {
          const hasMatch = findExactMatch(item.children, path);
          if (hasMatch) {
            return true;
          }
        }
      }
      return false;
    };

    findExactMatch(menuItems, currentPath);
    return selectedKeys;
  }, []);

  const menuDataForSelection = useSplitSidebarMenu ? breadcrumbMenuData : filteredMenuData;

  // 计算应该选中的菜单 key（只选中精确匹配的路径）
  const selectedKeys = useMemo(() => {
    return calculateSelectedKeys(menuDataForSelection, location.pathname);
  }, [menuDataForSelection, location.pathname, calculateSelectedKeys]);

  const [sidebarOpenKeys, setSidebarOpenKeys] = useState<string[]>(() =>
    computeMenuOpenKeysForPath(filteredMenuData, location.pathname)
  );
  const siderFooterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (useSplitSidebarMenu) {
      setSidebarOpenKeys(
        computeSplitSecondaryOpenKeys(splitMenuRoots, location.pathname, computeMenuOpenKeysForPath),
      );
      return;
    }
    setSidebarOpenKeys(computeMenuOpenKeysForPath(filteredMenuData, location.pathname));
  }, [location.pathname, filteredMenuData, useSplitSidebarMenu, splitMenuRoots]);

  useLayoutEffect(() => {
    const footerEl = siderFooterRef.current;
    const siderChildren = footerEl?.closest('.ant-layout-sider-children') as HTMLElement | null;
    if (!footerEl || !siderChildren) return;

    const syncFooterInset = () => {
      const footerHeight = Math.ceil(footerEl.getBoundingClientRect().height);
      siderChildren.style.setProperty('--riveredge-sider-footer-height', `${footerHeight}px`);
    };

    syncFooterInset();
    const observer = new ResizeObserver(syncFooterInset);
    observer.observe(footerEl);
    return () => observer.disconnect();
  }, [collapsed, isFullscreen]);

  /**
   * 处理全屏切换 (浏览器级别，顶栏触发)
   */
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsBrowserFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);


  /**
   * 处理语言切换
   * 
   * @param languageCode - 语言代码（如 'zh-CN', 'en-US'）
   */
  const handleLanguageChange = React.useCallback(async (languageCode: string) => {
    try {
      await applyLanguageWithPersist(languageCode);
      message.success(t('common.switchLanguageSuccess', { language: LANGUAGE_MAP[languageCode] || languageCode }));
    } catch (error: any) {
      console.error(t('common.switchLanguageFailed'), error);
      message.error(error?.message || t('common.switchLanguageFailed'));
    }
  }, [t]);

  /**
   * 构建语言切换下拉菜单
   */
  const languageMenuItems: MenuProps['items'] = React.useMemo(() => {
    // 从后端获取的语言列表
    const backendLanguages = languageListData?.items || [];

    // 如果后端有语言列表，优先使用后端的
    if (backendLanguages.length > 0) {
      return backendLanguages
        .filter((lang: Language) => lang.is_active)
        .map((lang: Language) => ({
          key: lang.code,
          label: lang.native_name || lang.name || LANGUAGE_MAP[lang.code] || lang.code,
          onClick: () => handleLanguageChange(lang.code),
        }));
    }

    // 如果没有后端语言列表，使用默认的语言映射
    return Object.entries(LANGUAGE_MAP).map(([code, name]) => ({
      key: code,
      label: name,
      onClick: () => handleLanguageChange(code),
    }));
  }, [languageListData, handleLanguageChange]);

  /**
   * 处理主题颜色切换
   */
  const handleThemeChange = () => {
    setThemeEditorOpen(true);
  };

  /**
   * 处理锁定屏幕
   */
  const handleLockScreen = () => {
    // 保存当前路径
    lockScreen(location.pathname);
    // 导航到锁屏页
    navigate('/lock-screen', { replace: true });
  };

  /**
   * 全屏状态管理
   * 
   * 验证方案3：同时使用 collapsed + siderWidth + menuRender
   * - 全屏时：collapsed={true} + siderWidth={0} + menuRender={() => null}
   *   - collapsed={true}：收起侧边栏
   *   - siderWidth={0}：设置侧边栏宽度为0
   *   - menuRender={() => null}：不渲染菜单，确保折叠的侧边栏也不占据空间
   * - 退出全屏时：恢复所有 props
   * 
   * 关键问题：即使 collapsed={true}，折叠的侧边栏仍然占据空间（通常 48-80px）
   * 解决方案：使用 menuRender={() => null} 完全不渲染菜单，配合 CSS 确保侧边栏不占据空间
   * 
   * 同时保留 CSS 作为辅助，确保顶部导航栏也被隐藏
   */
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const fullscreenClass = 'riveredge-fullscreen-mode';

    if (isFullscreen) {
      // 进入全屏：
      // 1. 添加 CSS class（用于隐藏顶部导航栏）
      html.classList.add(fullscreenClass);
      body.classList.add(fullscreenClass);
      // 2. 收起侧边栏（通过 ProLayout 的 collapsed prop）
      // 注意：这里不直接设置 collapsed，而是通过 CSS 和 siderWidth 控制
    } else {
      // 退出全屏：移除 class 并恢复布局
      html.classList.remove(fullscreenClass);
      body.classList.remove(fullscreenClass);

      // 退出全屏时，需要确保 ProLayout 重新计算布局
      // 使用多重延迟确保 DOM 更新、样式应用和 props 变化都完成
      // 注意：移除 class 后，所有全屏 CSS 样式会自动失效
      // 但 ProLayout 需要时间重新计算布局，所以需要多次触发 resize
      const timer1 = requestAnimationFrame(() => {
        // 第一次：触发 resize 事件，让 ProLayout 开始重新计算布局
        window.dispatchEvent(new Event('resize'));

        const timer2 = requestAnimationFrame(() => {
          // 第二次：再次触发 resize，确保布局计算完成
          window.dispatchEvent(new Event('resize'));

          const timer3 = setTimeout(() => {
            // 第三次：延迟触发，确保所有状态都已恢复
            window.dispatchEvent(new Event('resize'));
            // 额外触发一次，确保 ProLayout 完全重新计算
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 50);
          }, 150);

          return () => {
            if (timer3) clearTimeout(timer3);
          };
        });

        return () => {
          if (timer2) cancelAnimationFrame(timer2);
        };
      });

      return () => {
        if (timer1) cancelAnimationFrame(timer1);
      };
    }

    // 组件卸载时清理
    return () => {
      html.classList.remove(fullscreenClass);
      body.classList.remove(fullscreenClass);
    };
  }, [isFullscreen]);

  /**
   * 切换全屏状态
   */
  const handleToggleFullscreen = () => {
    setIsFullscreen(prev => !prev);
  };

  const layoutStyleContext = useMemo<BasicLayoutStyleContext>(
    () => ({
      token,
      isDarkMode,
      isLightModeLightBg,
      isLightModeDarkSider,
      isEnglishLocale,
      siderTextColor,
      siderBgColor,
      headerBgColor,
      headerTextColor,
      siderFooterToken,
      startMenuBaseRadius,
      startMenuPanelRadius,
      startMenuTheme,
    }),
    [
      token,
      isDarkMode,
      isLightModeLightBg,
      isLightModeDarkSider,
      isEnglishLocale,
      siderTextColor,
      siderBgColor,
      headerBgColor,
      headerTextColor,
      siderFooterToken,
      startMenuBaseRadius,
      startMenuPanelRadius,
      startMenuTheme,
    ],
  );
  const { shellStyles, themeStyles } = useBasicLayoutInlineStyles(layoutStyleContext);

  useLayoutEffect(() => {
    const logoTitleColor = isDarkMode
      ? '#ffffff'
      : (isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)');
    document.documentElement.style.setProperty('--riveredge-logo-title-color', logoTitleColor);
  }, [isDarkMode, isLightModeLightBg]);

  const sidebarSearchExtra = useMemo(() => {
    return (
      <div className="riveredge-sidebar-search-wrapper">
        <TopBarSearch
          menuData={filteredMenuData}
          hotMenuPaths={TOPBAR_SEARCH_HOT_MENU_PATHS}
          isLightModeLightBg={siderTextColor !== '#ffffff'}
          token={token}
          placeholder={t('common.searchPlaceholderShort')}
          inputHeight={30}
          borderRadius={15}
          shortcutKey="/"
          transparentBg
        />
      </div>
    );
  }, [filteredMenuData, siderTextColor, t, token]);

  const handleSplitNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  const splitMenuContentRender = useCallback(
    () => (
      <SplitSidebarMenu
        roots={splitMenuRoots}
        currentPath={location.pathname}
        collapsed={false}
        selectedKeys={selectedKeys}
        openKeys={sidebarOpenKeys}
        onOpenChange={setSidebarOpenKeys}
        searchExtra={sidebarSearchExtra}
        onNavigate={handleSplitNavigate}
      />
    ),
    [
      splitMenuRoots,
      location.pathname,
      selectedKeys,
      sidebarOpenKeys,
      sidebarSearchExtra,
      handleSplitNavigate,
    ],
  );

  const menuContentRenderProp = useMemo(() => {
    if (isFullscreen) return false as const;
    if (useSplitSidebarMenu) return splitMenuContentRender;
    return undefined;
  }, [isFullscreen, useSplitSidebarMenu, splitMenuContentRender]);

  return (
    <>
      {/* 技术栈列表 Modal */}
      <TechStackModal
        open={techStackModalOpen}
        onCancel={() => setTechStackModalOpen(false)}
      />

      <LayoutStyleInjector shellStyles={shellStyles} themeStyles={themeStyles} />

      <ProLayout
        title={siteName}
        logo={siteLogo}
        headerTitleRender={isMobileOrTablet ? (logo) => (
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
            onClick={() => navigate(effectiveSystemHomePath)}
          >
            {logo}
          </div>
        ) : undefined}
        menuHeaderRender={isMobileOrTablet ? undefined : undefined} // 保持 PC 端默认，手机端由 headerTitleRender 处理
        layout="mix" // 固定使用 MIX 布局模式
        navTheme={isDarkMode ? "realDark" : "light"}
        collapsedButtonRender={(collapsed) => {
          const settingsBtnBg = startMenuTheme.settingsBtnBg;
          const settingsBtnBorder = startMenuTheme.settingsBtnBorder;
          const settingsAccentColor = startMenuTheme.settingsBtnColor;
          const collapseBtnBg = String(siderFooterToken.colorFillSecondary);
          const collapseBtnBorder = String(siderFooterToken.colorSplit);
          const collapseChromeColor = siderTextColor;

          return (
            <div
              ref={siderFooterRef}
              className="riveredge-sider-footer-bar"
              style={{
                padding: '8px',
                flexShrink: 0,
              }}
            >
              <div
                className="riveredge-footer-btns"
                style={{
                  display: 'flex',
                  gap: 8,
                  flexDirection: collapsed ? 'column' : 'row',
                }}
              >
                <div style={{ flex: 3 }}>
                  <Button
                    ref={systemSettingsTriggerRef}
                    className="riveredge-footer-settings-btn"
                    type="default"
                    icon={<SettingOutlined style={{ color: settingsAccentColor }} />}
                    onClick={() => {
                      if (systemSettingsPanelExiting) return;
                      if (systemSettingsPanelMounted) {
                        closeSystemSettingsPanelAnimated();
                      } else {
                        openSystemSettingsPanel();
                      }
                    }}
                    style={{
                      color: settingsAccentColor,
                      backgroundColor: settingsBtnBg,
                      border: `1px solid ${settingsBtnBorder}`,
                      minHeight: 34,
                    }}
                    title={t('ui.sidebar.systemSettings')}
                    aria-expanded={!!systemSettingsPanelMounted && !systemSettingsPanelExiting}
                    aria-label={t('ui.sidebar.systemSettings')}
                  >
                    {!collapsed ? t('ui.sidebar.systemSettingsShort') : null}
                  </Button>
                </div>
                <div style={{ flex: 1 }}>
                  <Button
                    className="riveredge-footer-collapse-btn"
                    type="default"
                    icon={
                      collapsed ? (
                        <MenuUnfoldOutlined style={{ color: collapseChromeColor }} />
                      ) : (
                        <MenuFoldOutlined style={{ color: collapseChromeColor }} />
                      )
                    }
                    onClick={() => handleSetCollapsed(!collapsed)}
                    style={{
                      color: collapseChromeColor,
                      backgroundColor: collapseBtnBg,
                      border: `1px solid ${collapseBtnBorder}`,
                      minHeight: 34,
                    }}
                    title={collapsed ? t('ui.sidebar.expand') : t('ui.sidebar.collapse')}
                  />
                </div>
              </div>
            </div>
          );
        }}
        contentWidth="Fluid"
        fixedHeader
        fixSiderbar
        breadcrumbRender={isMobileOrTablet ? () => [] : undefined}
        breadcrumbProps={isMobileOrTablet ? { style: { display: 'none' } } : undefined}
        // 全屏时 menuRender={() => null} 完全隐藏侧边栏；双列模式用 menuContentRender 仅替换菜单区，保留底栏与侧栏壳层
        collapsed={isFullscreen ? true : collapsed}
        onCollapse={isFullscreen ? undefined : handleSetCollapsed}
        location={location}
        siderWidth={
          isFullscreen ? 0 : useSplitSidebarMenu ? SPLIT_SIDEBAR_WIDTH : FLAT_SIDEBAR_WIDTH
        }
        menuRender={isFullscreen ? () => null : undefined}
        menuContentRender={menuContentRenderProp}
        menuExtraRender={
          isFullscreen || collapsed || useSplitSidebarMenu
            ? undefined
            : () => sidebarSearchExtra
        }
        // 退出全屏时，强制 ProLayout 重新计算布局
        // 使用 location 作为 key 的一部分，确保路由变化时重新渲染
        // 但这里不使用 key，因为会导致标签丢失
        // 内容区域样式
        contentStyle={{
          // 统一使用非简写属性，避免与简写属性冲突
          paddingTop: 0,
          paddingBottom: 0,
          paddingInline: 0,
          paddingInlineStart: 0,
          paddingInlineEnd: 0,
          background: token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5'),
          // 全屏时：确保内容区域占据全屏，覆盖 ProLayout 的默认 padding-inline: 40px
          ...(isFullscreen ? {
            marginLeft: 0,
            width: '100%',
            maxWidth: '100%',
          } : {
            // 退出全屏时：保持统一的padding设置
          }),
        }}
        headerContentRender={() => {
          return (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 12 }}>
            {/* 分割线 - 仅在 PC 端显示 */}
            {!isMobileOrTablet && (
              <Divider
                orientation="vertical"
                style={{
                  height: '20px',
                  margin: '4px 0 0 2px',
                  borderColor: isLightModeLightBg ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.25)',
                  alignSelf: 'center',
                  verticalAlign: 'middle',
                }}
              />
            )}
            {!isMobileOrTablet && (
              <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: -8 }}>
                <HeaderQuickEntryPopover isLightModeLightBg={isLightModeLightBg} />
              </span>
            )}
            <div ref={breadcrumbRef} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <Breadcrumb
                style={{
                  display: breadcrumbVisible ? 'flex' : 'none',
                  alignItems: 'center',
                  maxHeight: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                items={generateBreadcrumb.map((item, index) => ({
                  title: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, lineHeight: '1.5', verticalAlign: 'middle' }}>
                      {index === generateBreadcrumb.length - 1 || index === 0 ? (
                        <span className={index === generateBreadcrumb.length - 1 ? 'riveredge-breadcrumb-active' : undefined} style={{ fontWeight: 400, lineHeight: '1.5', verticalAlign: 'middle' }}>{item.title}</span>
                      ) : (
                        <a
                          onClick={() => {
                            if (item.path) {
                              navigate(item.path);
                            }
                          }}
                          style={{ cursor: 'pointer', lineHeight: '1.5', verticalAlign: 'middle' }}
                        >
                          {item.title}
                        </a>
                      )}
                    </span>
                  ),
                  menu: item.menu,
                }))}
              />
            </div>
          </div>
          );
        }}
        actionsRender={() => {
          const actions: React.ReactNode[] = [];

          if (!isMobileOrTablet && hasAiAssistantEntry) {
          // AI 助手入口：仅 Lottie 图标 48x48，无文字、无背景、无动效
          actions.push(
            <AiAssistantHeaderButton
              key="aiAssistant"
              tooltip={t('ui.aiAssistant.tooltip')}
              onClick={openAiAssistant}
              isLightModeLightBg={isLightModeLightBg}
            />,
          );
          }

          // 上线向导：工作台欢迎条右侧展示；其他页面保留顶栏入口
          if (launchWizardEnabled && location.pathname !== '/system/dashboard/workplace') {
            actions.push(
              <OnboardingWizardEntry
                key="onboarding"
                variant="header"
                compact={isMobileOrTablet}
                isLightModeLightBg={isLightModeLightBg}
              />,
            );
          }

          // 顶栏小程序码（开启且已上传图片时显示）- 置于手机客户端下载前
          actions.push(<HeaderMiniprogramQrButton key="miniprogram-qr" />);

          // 租户可下载客户端（扫码安装）- 置于消息铃铛前
          actions.push(<HeaderClientDownloadButton key="client-download" />);

          // 消息提醒（带数量徽标）- 平板/手机也显示
          actions.push(
            <Dropdown
              key="notifications"
              placement="bottomRight"
              trigger={['click']}
              arrow={false}
              classNames={{ root: 'header-actions-dropdown' }}
              open={messageDropdownOpen}
              onOpenChange={(open) => {
                setMessageDropdownOpen(open);
                if (open) {
                  refetchRecentMessages();
                  refetchMessageStats();
                }
              }}
              popupRender={() => {
                const messages = recentMessages?.items || [];
                const isUnread = (msg: UserMessage) =>
                  msg.status === 'pending' || msg.status === 'sending' || msg.status === 'success';

                return (
                  <div
                    style={{
                      width: 400,
                      maxHeight: 500,
                      backgroundColor: token.colorBgElevated,
                      borderRadius: token.borderRadiusLG,
                      boxShadow: token.boxShadowSecondary,
                      overflow: 'hidden',
                    }}
                  >
                    {/* 标题栏 */}
                    <div
                      style={{
                        padding: '12px 16px',
                        borderBottom: `1px solid ${token.colorBorder}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Space size={8} align="center">
                        <Typography.Text strong style={{ fontSize: 16 }}>
                          {t('ui.message.notification')}
                        </Typography.Text>
                        {unreadCount > 0 && (
                          <Badge
                            count={unreadCount}
                            size="small"
                          />
                        )}
                      </Space>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setMessageDropdownOpen(false);
                          navigate('/personal/messages');
                        }}
                      >
                        {t('pages.dashboard.viewAll')} <RightOutlined />
                      </Button>
                    </div>

                    {/* 消息列表 */}
                    <div
                      style={{
                        maxHeight: 400,
                        overflowY: 'auto',
                      }}
                    >
                      {recentMessagesLoading ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                          <Spin />
                        </div>
                      ) : messages.length > 0 ? (
                        <div>
                          {messages.map((item: UserMessage) => {
                            const unread = isUnread(item);
                            return (
                              <div
                                key={item.uuid}
                                style={{
                                  padding: '12px 16px',
                                  cursor: 'pointer',
                                  backgroundColor: unread ? token.colorFillAlter : 'transparent',
                                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 12,
                                }}
                                onClick={async () => {
                                  setMessageDropdownOpen(false);
                                  navigate('/personal/messages');
                                  if (unread) {
                                    try {
                                      await markMessagesRead({
                                        message_uuids: [item.uuid],
                                      });
                                      refetchMessageStats();
                                      refetchRecentMessages();
                                    } catch (error) {
                                      // 静默失败
                                    }
                                  }
                                }}
                              >
                                <Badge dot={unread}>
                                  <Avatar
                                    size={40}
                                    style={{
                                      backgroundColor: unread ? token.colorPrimary : token.colorFillTertiary,
                                    }}
                                    icon={<BellOutlined />}
                                  />
                                </Badge>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <Typography.Text strong={unread} ellipsis style={{ maxWidth: 250 }}>
                                    {item.subject || t('common.noSubject')}
                                  </Typography.Text>
                                  <Typography.Paragraph
                                    ellipsis={{ rows: 2 }}
                                    style={{
                                      marginBottom: 4,
                                      marginTop: 2,
                                      fontSize: 12,
                                      color: token.colorTextSecondary,
                                      whiteSpace: 'pre-wrap',
                                    }}
                                  >
                                    {item.content}
                                  </Typography.Paragraph>
                                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                    {item.sent_at
                                      ? formatDateTime(item.sent_at, 'YYYY-MM-DD HH:mm')
                                      : formatDateTime(item.created_at, 'YYYY-MM-DD HH:mm')}
                                  </Typography.Text>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <Empty
                          description={t('common.noMessages')}
                          style={{ padding: '40px 0' }}
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      )}
                    </div>
                  </div>
                );
              }}
            >
              <Tooltip title={t('ui.message.notification')} open={messageDropdownOpen ? false : undefined}>
                <Button
                  type="text"
                  size="small"
                  icon={<BellOutlined />}
                  className={
                    unreadCount > 0
                      ? 'riveredge-header-notification-bell riveredge-header-notification-btn--has-count'
                      : 'riveredge-header-notification-bell'
                  }
                  {...(unreadCount > 0
                    ? {
                        'data-unread-count': unreadCount > 99 ? '99+' : String(unreadCount),
                      }
                    : {})}
                  onClick={() => {
                    setMessageDropdownOpen(!messageDropdownOpen);
                  }}
                />
              </Tooltip>
            </Dropdown>
          );
          


          if (!isMobileOrTablet) {
          // 语言切换下拉菜单
          actions.push(
            <Dropdown
              key="language"
              menu={{
                items: languageMenuItems,
                selectedKeys: [currentLanguage],
              }}
              placement="bottomLeft"
              trigger={['click']}
              open={languageDropdownOpen}
              onOpenChange={(open) => {
                setLanguageDropdownOpen(open);
              }}
            >
              <Tooltip
                title={`${t('ui.current.language')}: ${LANGUAGE_MAP[currentLanguage] || currentLanguage}`}
                trigger={['hover']}
                mouseEnterDelay={0.5}
                open={languageDropdownOpen ? false : undefined}
                destroyOnHidden
              >
                <Button
                  type="text"
                  size="small"
                  icon={<TranslationOutlined />}
                />
              </Tooltip>
            </Dropdown>
          );

          // 颜色配置
          actions.push(
            <Tooltip key="theme" title={t('ui.theme.color')}>
              <Button
                type="text"
                size="small"
                icon={<BgColorsOutlined />}
                onClick={handleThemeChange}
              />
            </Tooltip>
          );

          // 全屏按钮
          actions.push(
            <Tooltip key="fullscreen" title={isFullscreen ? t('ui.fullscreen.exit') : t('ui.fullscreen.enter')}>
              <Button
                type="text"
                size="small"
                icon={
                  isFullscreen ? (
                    <FullscreenExitOutlined />
                  ) : (
                    <FullscreenOutlined />
                  )
                }
                onClick={handleFullscreen}
              />
            </Tooltip>
          );

          // 租户切换选择框 - 优化样式，不显示图标（仅桌面）
          if (currentUser && !isMobileOrTablet) {
            actions.push(
              <div
                key="tenant"
                className="tenant-selector-wrapper"
                data-header-light-text={!isLightModeLightBg}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <TenantSelector headerLightText={!isLightModeLightBg} />
              </div>
            );
          }
          }

          // 用户头像和下拉菜单 - 平板/手机也显示
          if (currentUser) {
            actions.push(
              <Dropdown
                key="user"
                menu={{
                  items: getUserMenuItems(t),
                  onClick: handleUserMenuClick,
                }}
                placement="bottomRight"
              >
                <Space
                  size={8}
                  style={{
                    cursor: 'pointer',
                    padding: '0 12px 0 4px',
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '16px',
                    background: isLightModeLightBg ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.20)',
                  }}
                >
                  <Avatar
                    size={24}
                    src={headerTextAvatar ? undefined : avatarUrl}
                    onError={() => setAvatarImageFailed(true)}
                    style={{
                      ...(headerTextAvatar
                        ? getTextAvatarCircleStyle(token)
                        : getImageAvatarCircleStyle()),
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: getAvatarFontSize(24),
                      fontWeight: 500,
                    }}
                  >
                    {headerTextAvatar
                      ? getAvatarText(currentUser.full_name, currentUser.username)
                      : null}
                  </Avatar>
                  <span
                    style={{
                      fontSize: token.fontSize,
                      fontWeight: 500,
                      color: isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                      lineHeight: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      maxWidth: 120, // ⚠️ 防止姓名过长挤压顶栏
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {/* 优先显示全名，如果全名为空则显示用户名，文字跟随系统 */}
                    {(currentUser.full_name && currentUser.full_name.trim() !== '') ? currentUser.full_name : currentUser.username}
                  </span>
                </Space>
              </Dropdown>
            );
          }

          // 锁定屏幕按钮 - 移到最后一个防止误点
          actions.push(
            <Tooltip key="lock" title={t('ui.lock.screen')} placement="bottomRight">
              <Button
                type="text"
                size="small"
                icon={<LockOutlined />}
                onClick={handleLockScreen}
              />
            </Tooltip>
          );

          return <Space size={8} align="center" style={{ flexShrink: 0 }}>{actions}</Space>;
        }}
        menuDataRender={() => {
          // 过滤系统设置项并插入加载骨架（收起态仅显示原生图标，无简称文字）。
          const data = filteredMenuData.filter((item) => item.path !== '/system');
          if (appMenuSkeletonItems.length) {
            // APP 菜单插入在系统首项之后（与 useUnifiedMenuData 的 splice(1, ...) 一致）
            const insertAt = data.length > 0 ? 1 : 0;
            return [
              ...data.slice(0, insertAt),
              ...appMenuSkeletonItems,
              ...data.slice(insertAt),
            ];
          }
          return data;
        }}
        menuTextRender={(item: any, defaultText: React.ReactNode) => {
          // 应用分组标题：全部套主色样式；PRO 徽标仅对 PRO 应用
          if (!isSidebarAppGroupTitleItem(item)) return defaultText;
          const appCode = resolveSidebarAppGroupCode(item);
          const showPro = Boolean(appCode && (PRO_APP_CODES as readonly string[]).includes(appCode));
          return (
            <span
              className="menu-group-title-app-label"
              data-app-menu-group={appCode || '1'}
              style={APP_GROUP_TITLE_TEXT_STYLE}
            >
              {defaultText}
              {showPro ? <span className="menu-item-badge menu-item-badge-pro">PRO</span> : null}
            </span>
          );
        }}
        menuProps={{
          mode: 'inline',
          ...(collapsed || isFullscreen
            ? {}
            : {
                openKeys: sidebarOpenKeys,
                onOpenChange: (keys) => {
                  setSidebarOpenKeys(keys as string[]);
                },
              }),
          selectedKeys: selectedKeys, // 只选中精确匹配的路径，不选中父级菜单
          // ⚠️ 关键修复：阻止 Ant Design Menu 的默认链接行为，防止整页刷新
          // Menu 会为有 path 的菜单项自动创建 <a> 标签，需要阻止默认行为
          onClick: (info) => {
            // 如果菜单项有 path，阻止默认的链接跳转行为
            // 使用 type assertion 绕过 ReactInstance 类型限制
            const menuItem = info.item as any;
            if (menuItem && menuItem.props && menuItem.props.path) {
              const path = menuItem.props.path;
              // 外部链接已经在 menuItemRender 中处理，这里只阻止内部路由的默认行为
              if (path && !path.startsWith('http://') && !path.startsWith('https://')) {
                // 完全阻止默认行为，让 Link 组件处理路由
                info.domEvent.preventDefault();
                info.domEvent.stopPropagation();
              }
            }
          },
        }}
        onMenuHeaderClick={() => navigate(effectiveSystemHomePath)}
        subMenuItemRender={(item: any, defaultDom) => {
          if (isSidebarAppGroupTitleItem(item)) {
            const attachGroupSubmenuClass = (el: HTMLElement | null) => {
              const submenu = el?.closest('.ant-menu-submenu') as HTMLElement | null;
              if (submenu) submenu.classList.add('menu-group-title-app');
            };
            return React.isValidElement(defaultDom)
              ? React.cloneElement(defaultDom as React.ReactElement, {
                  ref: attachGroupSubmenuClass,
                })
              : defaultDom;
          }
          // 父分组悬停：一次性预取其下全部子项 chunk，展开即可见、点击即渲染
          const collectLeafPaths = (node: any, acc: string[]): string[] => {
            if (!node) return acc;
            if (Array.isArray(node.children) && node.children.length > 0) {
              for (const child of node.children) collectLeafPaths(child, acc);
            } else if (typeof node.path === 'string') {
              acc.push(node.path);
            }
            return acc;
          };
          const paths = collectLeafPaths(item, []);
          const handleEnter = () => {
            if (paths.length === 0) return;
            const systemPaths: string[] = [];
            const pluginCodes = new Set<string>();
            const kuaiPaths: string[] = [];
            const masterDataPaths: string[] = [];
            for (const p of paths) {
              if (p.startsWith('/apps/')) {
                const code = extractAppCodeFromPath(p);
                if (code) pluginCodes.add(code);
                if (p.startsWith('/apps/kuaizhizao')) kuaiPaths.push(p);
                if (p.startsWith('/apps/master-data')) masterDataPaths.push(p);
              } else {
                systemPaths.push(p);
              }
            }
            pluginCodes.forEach((code) => prefetchPlugin(code));
            kuaiPaths.forEach((p) => prefetchKuaizhizaoRoute(p));
            masterDataPaths.forEach((p) => prefetchMasterDataRoute(p));
            if (systemPaths.length > 0) prefetchSystemRoutes(systemPaths);
          };
          // 保持 ProLayout 原生结构，仅克隆挂上悬停预取（不包裹额外节点、不叠布局样式）。
          return React.isValidElement(defaultDom)
            ? React.cloneElement(defaultDom as React.ReactElement, { onMouseEnter: handleEnter })
            : defaultDom;
        }}
        menuItemRender={(item: any, dom) => {
          // APP 菜单加载占位：首次拉取 navigation-tree 期间的骨架行
          if (item.isAppMenuSkeleton) {
            return (
              <div
                className="app-menu-skeleton-item"
                style={{ width: '100%', padding: '4px 0', pointerEvents: 'none' }}
              >
                <Skeleton.Input active size="small" block style={{ height: 16, borderRadius: 4 }} />
              </div>
            );
          }
          // 处理外部链接
          if (item.path && (item.path.startsWith('http://') || item.path.startsWith('https://'))) {
            return (
              <a href={item.path} target={item.target || '_blank'} rel="noopener noreferrer">
                {dom}
              </a>
            );
          }
          // 应用级分组标题：主色标题 + PRO 徽标（仅 PRO 应用）
          if (isSidebarAppGroupTitleItem(item)) {
            const fallback = typeof item.name === 'string' ? item.name : '';
            const appCode = resolveSidebarAppGroupCode(item);
            const groupTitle = appCode
              ? resolveAppMenuGroupDisplayName(appCode, fallback, t)
              : fallback;
            const showPro = Boolean(appCode && (PRO_APP_CODES as readonly string[]).includes(appCode));

            return (
              <div
                className="menu-group-title-app"
                data-app-code={appCode || undefined}
                style={{
                  ...APP_GROUP_TITLE_TEXT_STYLE,
                  padding: 0,
                  margin: 0,
                  height: '16px',
                  minHeight: '16px',
                  maxHeight: '16px',
                  cursor: 'default',
                  userSelect: 'none',
                  pointerEvents: 'none',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  const parent = e.currentTarget.closest('.ant-menu-item') as HTMLElement;
                  if (parent) {
                    parent.style.backgroundColor = 'transparent';
                    parent.classList.add('menu-group-title-app');
                  }
                }}
                onMouseLeave={(e) => {
                  const parent = e.currentTarget.closest('.ant-menu-item') as HTMLElement;
                  if (parent) {
                    parent.style.backgroundColor = 'transparent';
                  }
                }}
                ref={(el) => {
                  const parent = el?.closest('.ant-menu-item') as HTMLElement | null;
                  if (parent) parent.classList.add('menu-group-title-app');
                }}
              >
                <span
                  className="menu-group-title-app-label"
                  data-app-menu-group={appCode || '1'}
                  style={APP_GROUP_TITLE_TEXT_STYLE}
                >
                  {groupTitle}
                  {showPro ? <span className="menu-item-badge menu-item-badge-pro">PRO</span> : null}
                </span>
              </div>
            );
          }

          // 如果是系统级菜单的分组标题（type: 'group'），确保使用翻译后的名称
          // 注意：系统级菜单的分组标题在菜单配置中已经使用 t() 函数翻译，但 dom 参数可能还未翻译
          if (item.type === 'group' && item.name) {
            // 检查是否是应用菜单（通过路径判断）
            const firstChildPath = item.children?.[0]?.path;
            const isAppMenu = firstChildPath?.startsWith('/apps/');
            const translatedName = isAppMenu
              ? translateAppMenuItemName(item.name as string, undefined, t, item.children)
              : translateMenuName(item.name as string, t, firstChildPath);
            // 如果翻译后的名称与 dom 不一致，返回翻译后的名称
            // 否则直接返回 dom（因为 dom 可能已经是翻译后的）
            if (translatedName !== item.name && translatedName !== dom) {
              return (
                <span>
                  {translatedName}
                </span>
              );
            }
          }

          // ⚠️ 关键修复：使用 ProLayout 原生方式，返回 React Router 的 Link 组件
          // Link 组件会自动处理 SPA 路由，不会整页刷新
          if (item.path && !item.disabled) {
            const path = item.path as string;

            const prefetchForPath = () => {
              if (path.startsWith('/apps/')) {
                const appCode = extractAppCodeFromPath(path);
                if (appCode) prefetchPlugin(appCode);
                if (path.startsWith('/apps/kuaizhizao')) prefetchKuaizhizaoRoute(path);
                if (path.startsWith('/apps/master-data')) prefetchMasterDataRoute(path);
              } else {
                prefetchSystemRoute(path);
              }
            };

            // 左侧菜单小徽标：仅业务单据显示未完成数量；hover 说明数字含义（延期 / 进行中）
            const badgeKey = getMenuBadgeKey(path);
            const badgeView = resolveMenuBadge(badgeKey ? menuBadgeCounts[badgeKey] : null, t);
            const badgeEl = badgeView ? (
              <Tooltip title={badgeView.title} placement="right">
                <span className="menu-item-badge-count-wrap">
                  <Badge
                    count={badgeView.count}
                    size="small"
                    color={badgeView.color}
                    className="menu-item-badge-count"
                    title=""
                  />
                </span>
              </Tooltip>
            ) : null;

            return (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onMouseEnter={() => {
                  if (path.startsWith('/apps/')) {
                    const appCode = extractAppCodeFromPath(path);
                    if (appCode) prefetchPlugin(appCode);
                    if (path.startsWith('/apps/kuaizhizao')) prefetchKuaizhizaoRoute(path);
                    if (path.startsWith('/apps/master-data')) prefetchMasterDataRoute(path);
                    const menuPath = path.split('?')[0];
                    if (
                      menuPath.includes('/apps/kuaizhizao/') &&
                      menuPath.includes('production-execution/work-orders') &&
                      !menuPath.includes('/kiosk')
                    ) {
                      void import('../apps/kuaizhizao/pages/production-execution/work-orders/workOrderListTable').then(
                        (m) => {
                          const pageSize = useUserPreferenceStore
                            .getState()
                            .getPreference('ui.default_page_size', 20)
                          m.prefetchDefaultWorkOrderList(queryClient, pageSize)
                        }
                      );
                    }
                  } else {
                    // 系统级/平台级/个人中心路由：悬停即预取目标 chunk，点击即渲染
                    prefetchSystemRoute(path);
                  }
                }}
                style={{ display: 'block', width: '100%' }}
              >
                <Link to={item.path} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 6 }}>
                  {dom}
                  {badgeEl}
                </Link>
              </div>
            );
          }
          // 没有 path 或 disabled 的菜单项：直接返回 dom
          return dom;
        }}
      >
        {isMobileOrTablet ? (
          <RouteTransition>{children}</RouteTransition>
        ) : (
        <UniTabs
          menuConfig={filteredMenuData}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        >
          <>
            {children}
          </>
        </UniTabs>
        )}
      </ProLayout >
      {systemSettingsPanelMounted && (
        <div
          ref={systemSettingsPanelRef}
          className={`riveredge-system-settings-panel${systemSettingsPanelExiting ? ' riveredge-system-settings-panel--exiting' : ''}`}
          style={
            {
              '--riveredge-system-panel-columns': systemSettingsPanelGridColumns,
              '--riveredge-system-panel-width': `${systemSettingsPanelWidth}px`,
            } as React.CSSProperties
          }
          role="dialog"
          aria-modal="false"
          aria-label={t('menu.system')}
          onAnimationEnd={handleSystemSettingsPanelAnimationEnd}
        >
          <div className="riveredge-system-settings-panel-header">
            <span className="riveredge-system-settings-panel-title">{t('menu.system')}</span>
            <div className="riveredge-system-settings-panel-header-actions">
              {showSystemSettingsTenantMeta && (
                <div className="riveredge-system-settings-panel-meta">
                  {systemSettingsPlanLabel && (
                    <span className="riveredge-system-settings-panel-meta-item">
                      {t('ui.systemSettingsPanel.versionLabel')}：{systemSettingsPlanLabel}
                    </span>
                  )}
                  <span className="riveredge-system-settings-panel-meta-item">
                    {t('ui.systemSettingsPanel.expiresLabel')}：{systemSettingsExpiresLabel}
                  </span>
                </div>
              )}
              <button
                type="button"
                className="riveredge-system-settings-panel-close"
                onClick={closeSystemSettingsPanelAnimated}
                title={t('common.close')}
                aria-label={t('common.close')}
              >
                <CloseOutlined />
              </button>
            </div>
          </div>
          <div className="riveredge-system-settings-panel-body">
            {systemSettingsGroups.map((group) => {
              return (
                <section
                  key={group.key}
                  className="riveredge-system-settings-group-wrap"
                  style={{ gridColumn: `span ${group.groupSpan}` }}
                >
                  <div className="riveredge-system-settings-group">
                    <div className="riveredge-system-settings-group-title">{group.name as React.ReactNode}</div>
                    <div
                      className="riveredge-system-settings-grid"
                      style={{ gridTemplateColumns: `repeat(${group.itemCols}, minmax(0, 1fr))` }}
                    >
                      {group.items.map((child) => {
                        return (
                          <button
                            key={String(child.key || child.path)}
                            type="button"
                            className="riveredge-system-settings-item"
                            onClick={() => handleSystemSettingsNavigate(child.path)}
                            title={typeof child.name === 'string' ? child.name : undefined}
                          >
                            <span
                              className="riveredge-system-settings-item-icon"
                            >
                              {getSystemPanelIcon(child.path)}
                            </span>
                            <span className="riveredge-system-settings-item-label">{child.name as React.ReactNode}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {/* 技术栈信息弹窗 */}
      < TechStackModal
        open={techStackModalOpen}
        onCancel={() => setTechStackModalOpen(false)
        }
      />

      {/* 主题编辑面板 */}
      <ThemeEditor
        open={themeEditorOpen}
        onClose={() => setThemeEditorOpen(false)}
        onThemeUpdate={(themeConfig) => {
          // 主题更新回调（可选）
        }}
      />

      {/* AI 助手：首次打开后再挂载，避免未使用时常驻重包 */}
      {aiAssistantEverOpened && (
        <React.Suspense fallback={null}>
          <AiAssistant
            open={aiAssistantOpen}
            onClose={() => setAiAssistantOpen(false)}
          />
        </React.Suspense>
      )}

      {/* 新手引导 */}
      {/* <OnboardingGuide /> */}

      {/* 键盘快捷键帮助 */}
      <Modal
        title={t('common.shortcutHelpTitle')}
        open={shortcutHelpOpen}
        onCancel={() => setShortcutHelpOpen(false)}
        footer={null}
        width={420}
        centered
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {t('common.shortcutHelpIntro')}
        </Typography.Paragraph>
        {[
          { keys: '/', desc: t('common.shortcutSearch') },
          { keys: 'Ctrl + K', desc: t('common.shortcutSearch') },
          { keys: 'Alt + N', desc: t('common.shortcutNew') },
          { keys: 'Ctrl + S', desc: t('common.shortcutSubmit') },
          { keys: '?', desc: t('common.shortcutHelp') },
        ].map(({ keys, desc }) => {
            const keyParts = keys.split(/\s*\+\s*/).map((s: string) => s.trim());
            const keyStyle: React.CSSProperties = {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px 10px',
              borderRadius: 6,
              background: 'var(--river-divider-color)',
              border: '1px solid var(--river-border-color)',
              boxShadow: isDarkMode ? '0 2px 4px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.08)',
              fontSize: 12,
              fontFamily: CODE_FONT_FAMILY,
              fontWeight: 500,
              color: isDarkMode ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.65)',
            };
            return (
              <div key={keys} style={{ padding: '6px 0' }}>
                <Space align="center">
                  <Space size={4}>
                    {keyParts.map((part, i) => (
                      <kbd key={i} style={keyStyle}>
                        {part}
                      </kbd>
                    ))}
                  </Space>
                  <span>{desc}</span>
                </Space>
              </div>
            );
          })}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('common.shortcutHelpHint')}
        </Typography.Text>
      </Modal>

      {/* 新组织首次登录：应用 + 必备系统初始项引导 */}
      <React.Suspense fallback={null}>
        <TenantBootstrapModal />
      </React.Suspense>

      {/* 右下角悬浮按钮：迭代提示与意见反馈 */}
      <IterationFloatButton />
    </>
  );
}
