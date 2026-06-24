/**
 * RiverEdge SaaS 多组织框架 - 基础布局组件
 * 
 * 使用 ProLayout 实现现代化页面布局，集成状态管理和权限控制
 */

import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import fluentColorIcons from '@iconify-json/fluent-color/icons.json';
import { translateMenuName, translatePathTitle, translateAppMenuItemName, extractAppCodeFromPath, findMenuTitleWithTranslation, getAppDisplayName } from '../utils/menuTranslation';
import { resolveCustomPageTitle } from '../utils/customPageTitle';
import { prefetchPlugin } from '../utils/pluginLoader';
import { prefetchKuaizhizaoRoute } from '../apps/kuaizhizao/routePrefetch';
import { prefetchMasterDataRoute } from '../apps/master-data/routePrefetch';
import { prefetchSystemRoute, prefetchSystemRoutes } from '../routes/systemRoutePrefetch';
import dayjs from 'dayjs';
import { DEFAULT_SITE_LOGO_URL, SITE_LOGO_FALLBACK_SVG_URL, nextSiteLogoUrlAfterImageError } from '../constants/siteAssets';
import { getUserMessageStats, getUserMessages, markMessagesRead, type UserMessage } from '../services/userMessage';
import { formatDateTime } from '../utils/format';

addCollection(fluentColorIcons);

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
import AiAssistant from '../components/ai-assistant';
import UniTabs from '../components/uni-tabs';
import TechStackModal from '../components/tech-stack-modal';
import { HeaderClientDownloadButton } from '../components/header-client-download';
import ThemeEditor from '../components/theme-editor';
import IterationFloatButton from '../components/iteration-float-button';
import { RouteTransition } from '../components/route-transition';
const TenantBootstrapModal = React.lazy(() => import('../components/tenant-bootstrap-modal'));
import { getCurrentUser } from '../services/auth';
import { getCurrentInfraSuperAdmin } from '../services/infraAdmin';
import { getTenantById, TenantPlan } from '../services/tenant';
import { getToken, clearAuth, getUserInfo, getTenantId, isInfraSuperAdminUser, isInfraSuperAdminFromToken } from '../utils/auth';
import { useGlobalStore } from '../stores';
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
import * as LucideIcons from 'lucide-react'; // 全量导入 Lucide Icons，支持动态访问所有图标
import { getAvatarUrl, getAvatarText, getAvatarFontSize, getCachedAvatarUrl, toRelativeIfLocalhost, isTextAvatarDisplay, getTextAvatarCircleStyle, getImageAvatarCircleStyle } from '../utils/avatar';
import { triggerNew, hasNewHandler } from '../utils/globalNewShortcut';
import { triggerSubmit, hasSubmitHandler } from '../utils/globalSubmitShortcut';
import { CODE_FONT_FAMILY } from '../constants/fonts';
import { clearSessionScopedQueries } from '../utils/clearSessionQueries';
import { getInstalledApplicationList } from '../services/application';
import { getChatIntegrationStatus } from '../apps/kuaiai/services/chat';
import { buildChatIntegrationStatusQueryKey } from '../hooks/useChatIntegrationStatus';
import { hasPermission, resolveUserForMenuPermission } from '../utils/permission';
import { getSiteLogoPreview, isSiteLogoUuidKnownMissing } from '../services/file';
import Lottie from 'lottie-react';
import assistAnimation from '../../static/lottie/assist.json';
import OnboardingGuide from '../components/onboarding-guide';
import { OnboardingWizardEntry } from '../components/onboarding-guide/OnboardingWizardEntry';
import { HeaderQuickEntryPopover } from '../components/quick-entry';

/** LOGO 缓存 TTL：25 分钟（token 1 小时过期，提前刷新避免 403） */
const SITE_LOGO_CACHE_TTL_MS = 25 * 60 * 1000;

function getCachedSiteLogoUrl(logoUuid: string): string | undefined {
  try {
    const raw = localStorage.getItem(`siteLogoUrlCache_${logoUuid}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const { url, ts } = typeof parsed === 'object' ? parsed : { url: raw, ts: 0 };
    if (!url || typeof url !== 'string') return undefined;
    if (typeof ts === 'number' && Date.now() - ts > SITE_LOGO_CACHE_TTL_MS) return undefined;
    return toRelativeIfLocalhost(url);
  } catch {
    return undefined;
  }
}

function setCachedSiteLogoUrl(logoUuid: string, url: string): void {
  try {
    localStorage.setItem(`siteLogoUrlCache_${logoUuid}`, JSON.stringify({ url, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

function clearCachedSiteLogoUrl(logoUuid: string): void {
  try {
    localStorage.removeItem(`siteLogoUrlCache_${logoUuid}`);
  } catch {
    /* ignore */
  }
}
import { useUserPreferenceStore } from '../stores/userPreferenceStore';
import { useConfigStore, resolveEffectiveHomePath, getDefaultTenantHomePath } from '../stores/configStore';
import { useThemeStore } from '../stores/themeStore';
import { getMenuBadgeCounts } from '../services/dashboard';
import { verifyCopyright } from '../utils/copyrightIntegrity';
import { useTouchScreen } from '../hooks/useTouchScreen';

/**
 * 左侧菜单 path → menu-badge-counts 的 key（与后端 get_menu_badge_counts 一致）
 * 销售式三态：逾期(红) > 待审核(橙) > 进行中(绿)，见 menuItemRender
 */
const MENU_BADGE_PATH_KEY: Record<string, string> = {
  '/apps/kuaizhizao/production-execution/work-orders': 'work_order',
  '/apps/kuaizhizao/production-execution/rework-orders': 'rework_order',
  '/apps/kuaizhizao/production-execution/material-shortage-exceptions': 'exception',
  '/apps/kuaizhizao/production-execution/delivery-delay-exceptions': 'exception',
  '/apps/kuaizhizao/production-execution/quality-exceptions': 'exception',
  '/apps/kuaizhizao/production-execution/outsource-management': 'outsource_work_order',
  '/apps/kuaizhizao/production-execution/packing-binding': 'packing_binding',
  '/apps/kuaizhizao/purchase-management/purchase-orders': 'purchase_order',
  '/apps/kuaizhizao/purchase-management/purchase-requisitions': 'purchase_requisition',
  '/apps/kuaizhizao/purchase-management/receipt-notices': 'receipt_notice',
  '/apps/kuaizhizao/purchase-management/logistics-tracking': 'purchase_logistics',
  '/apps/kuaizhizao/purchase-management/purchase-returns': 'purchase_return',
  '/apps/kuaizhizao/sales-management/sales-orders': 'sales_order',
  '/apps/kuaizhizao/sales-management/sales-forecasts': 'sales_forecast',
  '/apps/kuaizhizao/sales-management/customer-pool': 'customer_pool',
  '/apps/kuaizhizao/sales-management/quotations': 'quotation',
  '/apps/kuaizhizao/sales-management/customer-follow-ups': 'customer_follow_up',
  '/apps/kuaizhizao/sales-management/sample-trials': 'sample_trial',
  '/apps/kuaizhizao/sales-management/shipment-notices': 'shipment_notice',
  '/apps/kuaizhizao/sales-management/sales-returns': 'sales_return',
  '/apps/kuaizhizao/warehouse-management/inbound': 'inbound',
  '/apps/kuaizhizao/warehouse-management/other-inbound': 'other_inbound',
  '/apps/kuaizhizao/warehouse-management/material-returns': 'material_return',
  '/apps/kuaizhizao/warehouse-management/outbound': 'sales_outbound',
  '/apps/kuaizhizao/warehouse-management/other-outbound': 'other_outbound',
  '/apps/kuaizhizao/warehouse-management/material-borrows': 'material_borrow',
  '/apps/kuaizhizao/warehouse-management/delivery-notes': 'delivery_notice',
  '/apps/kuaizhizao/warehouse-management/batching-center': 'batching_order',
  '/apps/kuaizhizao/warehouse-management/material-calls': 'batching_order',
  '/apps/kuaizhizao/warehouse-management/stocktaking': 'stocktaking',
  '/apps/kuaizhizao/warehouse-management/inventory-transfer': 'inventory_transfer',
  '/apps/kuaizhizao/warehouse-management/assembly-orders': 'assembly_order',
  '/apps/kuaizhizao/warehouse-management/disassembly-orders': 'disassembly_order',
  '/apps/kuaizhizao/warehouse-management/customer-material-registration': 'customer_material_registration',
  '/apps/kuaizhizao/quality-management/inspection-center': 'quality_inspection',
  '/apps/kuaizhizao/quality-management/incoming-inspection': 'incoming_inspection',
  '/apps/kuaizhizao/quality-management/process-inspection': 'process_inspection',
  '/apps/kuaizhizao/quality-management/finished-goods-inspection': 'finished_goods_inspection',
  '/apps/kuaizhizao/quality-management/inspection-plans': 'inspection_plan',
  '/apps/kuaizhizao/plan-management/production-plans': 'production_plan',
  '/apps/kuaizhizao/plan-management/demand-computation': 'demand_computation',
  '/apps/kuaizhizao/equipment-management/equipment': 'equipment',
  '/apps/kuaizhizao/equipment-management/molds': 'mold',
  '/apps/kuaizhizao/equipment-management/inspection': 'equipment_inspection',
  '/apps/kuaizhizao/equipment-management/spare-parts': 'spare_part',
  '/apps/kuaizhizao/equipment-management/equipment-faults': 'equipment_fault',
  '/apps/kuaizhizao/equipment-management/maintenance-plans': 'maintenance_plan',
  '/apps/kuaizhizao/equipment-management/maintenance-reminders': 'maintenance_reminder',
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
  '/apps/kuaizhizao/plan-management/production-plans', // 生产计划
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

// 权限守卫组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const loading = useGlobalStore((s) => s.loading);
  const setCurrentUser = useGlobalStore((s) => s.setCurrentUser);
  const setLoading = useGlobalStore((s) => s.setLoading);
  const { t } = useSafeTranslation(); // 使用安全的翻译 hook

  // 检查用户类型（平台超级管理员还是系统级用户）
  const userInfo = getUserInfo();
  const isInfraSuperAdmin = isInfraSuperAdminUser(userInfo) || isInfraSuperAdminFromToken();

  // 获取组织 ID
  const currentTenantId = getTenantId();


  // 如果 currentUser 已存在且信息完整，不需要重新获取
  // 只有在以下情况才需要获取用户信息：
  // 1. 有 token 但没有 currentUser
  // 注意：避免在 currentUser 已存在时重复获取，防止无限循环
  // 租户用户由 App AuthGuard 定期拉取 /auth/me；此处仅平台超管在无 currentUser 时补拉
  const shouldFetchUser = !!getToken() && !currentUser && isInfraSuperAdmin;

  // 根据用户类型调用不同的接口
  const { data: userData, isLoading, error } = useQuery({
    queryKey: ['currentUser', isInfraSuperAdmin],
    queryFn: async () => {
      // 优先使用 userInfo 判断用户类型
      const shouldUsePlatformAPI = isInfraSuperAdmin;

      if (shouldUsePlatformAPI) {
        // 平台超级管理员：调用平台接口
        const infraUser = await getCurrentInfraSuperAdmin();
        const tenantId = getTenantId();
        return {
          id: infraUser.id,
          username: infraUser.username,
          email: infraUser.email,
          full_name: infraUser.full_name,
          is_infra_admin: true,
          is_tenant_admin: false,
          tenant_id: tenantId ?? undefined,
          user_type: 'infra_superadmin' as const,
        };
      } else {
        // 系统级用户：调用系统接口
        return await getCurrentUser();
      }
    },
    enabled: shouldFetchUser,
    retry: false,
    staleTime: useConfigStore.getState().getConfig('security.user_cache_time', 300) * 1000, // 使用配置缓存时间
  });

  // 处理查询错误
  useEffect(() => {
    if (error && getToken()) {
      const savedUserInfo = getUserInfo();
      if (savedUserInfo) {
        // 从 localStorage 恢复用户信息
        const restoredUser = {
          id: savedUserInfo.id || 1,
          username: savedUserInfo.username || 'admin',
          email: savedUserInfo.email,
          full_name: savedUserInfo.full_name,
          is_infra_admin: isInfraSuperAdminUser(savedUserInfo) || savedUserInfo.is_infra_admin || false,
          is_tenant_admin: savedUserInfo.is_tenant_admin || false,
          tenant_id: savedUserInfo.tenant_id,
          tenant_name: savedUserInfo.tenant_name,
          permissions: Array.isArray(savedUserInfo.permissions) ? savedUserInfo.permissions : [],
          permission_version: savedUserInfo.permission_version || 1,
          department: savedUserInfo.department,
          position: savedUserInfo.position,
          roles: Array.isArray(savedUserInfo.roles) ? savedUserInfo.roles : [],
        };
        setCurrentUser(restoredUser);

        // 如果是平台超级管理员，但后端接口失败，记录警告但不阻止访问
        if (isInfraSuperAdminUser(savedUserInfo)) {
          console.warn('⚠️ 获取平台超级管理员信息失败，使用本地缓存:', error);
        } else {
          console.warn('⚠️ 获取用户信息失败，使用本地缓存:', error);
        }
      } else {
        // 没有本地缓存时，如果是401错误且不在应用页面，则清理认证信息
        // 在应用页面时不清除认证信息，避免跳转
        const isInApp = window.location.pathname.startsWith('/apps/');
        if ((error as any)?.response?.status === 401 && !isInApp) {
          console.error('❌ 认证已过期，请重新登录:', error);
          clearAuth();
          setCurrentUser(undefined);
        } else if ((error as any)?.response?.status === 401 && isInApp) {
          console.warn('⚠️ 应用页面用户信息获取失败（401），跳过清除认证信息:', error);
        } else {
          console.warn('⚠️ 获取用户信息失败，但保留当前状态，允许继续访问:', error);
        }
      }
    } else if (!getToken()) {
      // 没有 token，清理认证信息
      clearAuth();
      setCurrentUser(undefined);
    }
  }, [error, setCurrentUser]);

  // 处理成功获取用户数据
  useEffect(() => {
    if (userData) {
      setCurrentUser(userData);
    }
  }, [userData, setCurrentUser]);

  const publicPaths = ['/login', '/debug/'];
  const isInfraLoginPage = location.pathname === '/infra/login';
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
    if (location.pathname.startsWith('/infra')) {
      return <Navigate to="/infra/login" replace />;
    }
    return <Navigate to="/login" replace />;
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

      // 应用菜单路径图标映射（使用前缀匹配，支持 /apps/{app-code}/... 格式）
      '/apps/kuaizhizao/plan-management': ManufacturingIcons.calendar, // 计划管理 - 使用日历图标
      '/apps/kuaizhizao/production-execution': ManufacturingIcons.activity, // 生产执行 - 使用活动/执行图标
      '/apps/kuaizhizao/purchase-management': ManufacturingIcons.shoppingBag, // 采购管理 - 使用购物袋图标
      '/apps/kuaizhizao/sales-management': ManufacturingIcons.chartLine, // 销售管理 - 使用趋势上升图标（销售增长）
      '/apps/kuaizhizao/warehouse-management': ManufacturingIcons.warehouse, // 仓储管理 - 使用仓库图标
      '/apps/kuaizhizao/quality-management': ManufacturingIcons.quality, // 质量管理 - 使用质量图标
      '/apps/kuaizhizao/cost-management': ManufacturingIcons.calculator, // 成本管理 - 使用计算器图标
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
type PermissionMenuDataItem = MenuDataItem & {
  permissionCodes?: string[];
};

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
        { path: '/system/config-center', name: t('menu.system.business-config'), icon: getMenuIcon(t('menu.system.business-config'), '/system/config-center'), permissionCodes: ['system:config-center:read', 'system:config-center:update'] },
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
  
  // 决定是否使用移动端/平板布局
  // 如果开启了触屏模式且是竖屏，强制使用移动端布局
  // 否则，根据分辨率判断（lg = 992px）
  const isMobileOrTablet = touchScreen.isTouchScreenMode 
    ? touchScreen.isPortrait 
    : (screens.lg === false);

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
  const currentUser = useGlobalStore((s) => s.currentUser);
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

  // 获取用户头像 URL（如果有 UUID）
  useEffect(() => {
    const loadAvatarUrl = async () => {
      const userInfo = getUserInfo();
      const avatarUuid = (currentUser as any)?.avatar || userInfo?.avatar;

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

  /** 登出前清理租户相关 Query 缓存，避免重新登录后仍显示旧侧边栏菜单（applicationMenus staleTime 内不 refetch） */
  const performLogout = useCallback(() => {
    clearSessionScopedQueries(queryClient);
    logout();
    // SPA 内部跳转：dev 下 /login 会映射到 login.html MPA，LoginPage 依赖 QueryClientProvider，全页跳转易白屏
    navigate('/login', { replace: true });
  }, [queryClient, logout, navigate]);

  // 站点设置：统一从 configStore 获取（app.tsx 初始化时已 fetchConfigs，site-settings 保存时会 refresh）
  const siteName = (useConfigStore((s) => (s.getConfig('site_name', '') as string)?.trim()) || '') || 'RiverEdge SaaS';
  const siteLogoValue = (useConfigStore((s) => (s.getConfig('site_logo', '') as string)?.trim()) || '') || '';
  const launchWizardEnabled = useConfigStore((s) => s.configs.enable_launch_wizard !== false);
  const configs = useConfigStore((s) => s.configs);

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
    () => resolveEffectiveHomePath(effectiveHome, tenantBackendHome?.path, configs),
    [effectiveHome, tenantBackendHome?.path, configs],
  );

  // 消息下拉菜单状态
  const [messageDropdownOpen, setMessageDropdownOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  // 获取消息统计
  const { data: messageStats, refetch: refetchMessageStats } = useQuery({
    queryKey: ['userMessageStats'],
    queryFn: () => getUserMessageStats(),
    staleTime: 30 * 1000, // 30 秒缓存
    refetchInterval: 60 * 1000, // 每分钟自动刷新
    enabled: !!currentUser, // 只在用户登录后获取
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

  // 判断字符串是否是UUID格式
  const isUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // 获取站点LOGO（支持UUID和URL格式），同步从 configStore 读取（有 persist 缓存）
  const [siteLogoUrl, setSiteLogoUrl] = useState<string>(() => {
    const logoValue = (useConfigStore.getState().getConfig('site_logo', '') as string)?.trim() || '';

    if (logoValue) {
      if (isUUID(logoValue)) {
        if (isSiteLogoUuidKnownMissing(logoValue)) {
          return DEFAULT_SITE_LOGO_URL;
        }
        // 预览 URL 未就绪时先用极小 SVG，避免先拉 34KB 默认 PNG 再切换
        return SITE_LOGO_FALLBACK_SVG_URL;
      } else {
        return logoValue;
      }
    }

    return DEFAULT_SITE_LOGO_URL;
  });

  // 处理LOGO URL（UUID 需通过 getFilePreview 获取，带 TTL 缓存并转为相对路径）
  useEffect(() => {
    const loadSiteLogo = async () => {
      try {
        if (!siteLogoValue) {
          setSiteLogoUrl(DEFAULT_SITE_LOGO_URL);
          return;
        }

        if (isUUID(siteLogoValue)) {
          if (isSiteLogoUuidKnownMissing(siteLogoValue)) {
            clearCachedSiteLogoUrl(siteLogoValue);
            setSiteLogoUrl(DEFAULT_SITE_LOGO_URL);
            return;
          }
          const previewInfo = await getSiteLogoPreview(siteLogoValue, { forAvatar: true });
          if (!previewInfo?.preview_url) {
            clearCachedSiteLogoUrl(siteLogoValue);
            setSiteLogoUrl(DEFAULT_SITE_LOGO_URL);
            return;
          }
          const newUrl = toRelativeIfLocalhost(previewInfo.preview_url);
          setSiteLogoUrl(newUrl);
          setCachedSiteLogoUrl(siteLogoValue, newUrl);
        } else {
          setSiteLogoUrl(siteLogoValue);
        }
      } catch {
        setSiteLogoUrl(DEFAULT_SITE_LOGO_URL);
      }
    };

    loadSiteLogo();
  }, [siteLogoValue]);

  // 传入 ReactNode，避免 ProLayout 对 string 固定渲染 alt="logo"；加载失败：自定义 → /img/logo.png → /favicon.svg → 内置 data URI
  const siteLogo = useMemo(
    () => (
      <img
        src={siteLogoUrl}
        alt=""
        width="auto"
        height={22}
        fetchpriority="high"
        decoding="async"
        onError={() => {
          setSiteLogoUrl((prev) => nextSiteLogoUrlAfterImageError(prev));
        }}
      />
    ),
    [siteLogoUrl],
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
        };
        const IconComponent = lucideIconMap[menu.icon];
        if (IconComponent) {
          iconElement = React.createElement(IconComponent, { size: 16 });
        } else {
          // 如果预定义映射和 Ant Design 映射都没有，尝试直接从 Lucide Icons 中获取
          // 支持 PascalCase 图标名（如 "Factory", "Home"）或 kebab-case（如 "factory", "home"）
          const iconName = menu.icon as string;

          // 尝试直接访问（PascalCase）
          let DirectIcon = (LucideIcons as any)[iconName];

          // 如果直接访问失败，尝试转换为 PascalCase
          if (!DirectIcon) {
            const pascalCaseName = iconName
              .split(/[-_]/)
              .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
              .join('');
            DirectIcon = (LucideIcons as any)[pascalCaseName];
          }

          if (DirectIcon && DirectIcon !== React.Fragment && typeof DirectIcon === 'function') {
            iconElement = React.createElement(DirectIcon, { size: 16 });
          } else if (process.env.NODE_ENV === 'development') {
            console.warn(`Icon not found: ${menu.icon} for menu: ${menu.name || menu.path}. Tip: You can use Lucide icon names (PascalCase) directly, such as "Factory", "Home", etc.`);
          }
        }
      }
    }

    // 一级菜单：若 icon 未匹配，再尝试根据名称和路径获取
    if (depth === 0 && !iconElement) {
      if (menu.name) {
        iconElement = getMenuIcon(menu.name, menu.path);
      } else if (menu.path) {
        iconElement = getMenuIcon('', menu.path);
      }
      if (!iconElement) {
        iconElement = React.createElement(ManufacturingIcons.dashboard, { size: 16 });
      }
    }

    // 处理菜单名称翻译
    let menuName = menu.name;
    if (isAppMenu && menuName) {
      // 应用菜单使用应用菜单翻译函数
      // 对于分组菜单（没有path），传递子菜单以便从子菜单路径提取应用code
      menuName = translateAppMenuItemName(menuName, menu.path, t, menu.children);
    } else if (menuName) {
      // 系统菜单使用通用菜单翻译函数
      menuName = translateMenuName(menuName, t, menu.path);
    }

    const menuItem: MenuDataItem = {
      path: menu.path == null ? undefined : menu.path, // 确保 path 不为 null，避免 @umijs/route-utils mergePath 报错
      name: menuName,
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
    const meta = (menu as { meta?: Record<string, any> }).meta;
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

  const isInfraSuperAdmin = isInfraSuperAdminUser(currentUser) || isInfraSuperAdminFromToken();

  const { data: infraTenantInfo } = useQuery({
    queryKey: ['systemPanelTenantInfo', currentUser?.tenant_id],
    queryFn: () => getTenantById(currentUser!.tenant_id!, true),
    enabled: systemSettingsPanelMounted && !!currentUser?.tenant_id && isInfraSuperAdmin,
    staleTime: 60_000,
  });

  const systemSettingsTenantPlan = infraTenantInfo?.plan ?? currentUser?.tenant_plan;
  const systemSettingsTenantExpiresAt = infraTenantInfo?.expires_at ?? currentUser?.tenant_expires_at;

  const systemSettingsPlanLabel = useMemo(() => {
    if (!systemSettingsTenantPlan) return undefined;
    const planKeyMap: Record<string, string> = {
      [TenantPlan.TRIAL]: 'pages.infra.tenant.planTrial',
      [TenantPlan.BASIC]: 'pages.infra.tenant.planBasic',
      [TenantPlan.PROFESSIONAL]: 'pages.infra.tenant.planProfessional',
      [TenantPlan.ENTERPRISE]: 'pages.infra.tenant.planEnterprise',
    };
    const labelKey = planKeyMap[systemSettingsTenantPlan];
    return labelKey ? t(labelKey) : systemSettingsTenantPlan;
  }, [systemSettingsTenantPlan, t]);

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
    staleTime: 60_000,
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

  const aiAssistantMountedRef = useRef(false);
  if (hasAiAssistantEntry) {
    aiAssistantMountedRef.current = true;
  }

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
    enabled: !!currentUser?.id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
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
        panelCloseColor: 'rgba(255, 255, 255, 0.85)',
        panelCloseHoverBg: 'rgba(255, 255, 255, 0.1)',
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
    return {
      settingsBtnBg: String(siderFooterToken.colorPrimaryBg),
      settingsBtnBgHover: String(siderFooterToken.colorPrimaryBgHover),
      settingsBtnBgActive: String(siderFooterToken.colorPrimaryBorder),
      settingsBtnBorder: String(siderFooterToken.colorPrimaryBorder),
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
      panelCloseHoverBg: 'rgba(0, 0, 0, 0.04)',
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
        setAiAssistantOpen(true);
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
  }, [hasAiAssistantEntry]);

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

    let moRaf = 0;
    const observer = new MutationObserver(() => {
      if (moRaf) return;
      moRaf = window.requestAnimationFrame(() => {
        moRaf = 0;
        checkBreadcrumbWrap();
      });
    });
    if (breadcrumbRef.current) {
      observer.observe(breadcrumbRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      });
    }

    return () => {
      clearTimeout(timer);
      if (resizeThrottle) clearTimeout(resizeThrottle);
      window.removeEventListener('resize', onResize);
      if (moRaf) cancelAnimationFrame(moRaf);
      observer.disconnect();
    };
  }, [location.pathname]);

  /**
   * 为分组标题动态添加自定义 className
   * 因为 ProLayout 不会将 className 传递给 type: 'group' 的项
   */
  useEffect(() => {
    const addGroupTitleClassName = () => {
      // 查找所有分组标题元素
      const groupTitles = document.querySelectorAll('.ant-menu-item-group-title');
      groupTitles.forEach((title) => {
        // 检查是否已经添加了 className
        if (!title.classList.contains('riveredge-menu-group-title')) {
          title.classList.add('riveredge-menu-group-title');
        }
      });
    };

    // 初始添加
    addGroupTitleClassName();

    // 使用 MutationObserver 监听 DOM 变化，确保新增的分组标题也能添加 className（合并到 rAF，避免菜单动画/重排时连发同步回调）
    let groupMoRaf = 0;
    const observer = new MutationObserver(() => {
      if (groupMoRaf) return;
      groupMoRaf = window.requestAnimationFrame(() => {
        groupMoRaf = 0;
        addGroupTitleClassName();
      });
    });

    // 观察菜单容器
    const menuContainer = document.querySelector('.ant-pro-sider-menu');
    if (menuContainer) {
      observer.observe(menuContainer, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      if (groupMoRaf) cancelAnimationFrame(groupMoRaf);
      observer.disconnect();
    };
  }, [currentUser?.id, currentUser?.tenant_id]); // 用户/租户切换时重建；避免无关字段刷新导致反复挂载 Observer

  /**
   * 动态设置 LOGO 后标题文字颜色（H1元素）- 确保在浅色模式深色背景时与深色模式文字颜色一致
   */
  useEffect(() => {
    const updateLogoTitleColor = () => {
      // 计算应该使用的文字颜色
      const logoTitleColor = isDarkMode
        ? '#ffffff'
        : (isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)');

      // 直接查找 h1 元素（LOGO 后的标题文字）
      const h1Selectors = [
        '.ant-pro-global-header-logo h1',
        '.ant-pro-global-header-logo a h1',
        '.ant-pro-layout-header .ant-pro-global-header-logo h1',
        '.ant-pro-layout-header .ant-pro-global-header-logo a h1',
        '.ant-layout-header .ant-pro-global-header-logo h1',
        '.ant-layout-header .ant-pro-global-header-logo a h1',
      ];

      h1Selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.setProperty('color', logoTitleColor, 'important');
          }
        });
      });
    };

    // 初始设置
    updateLogoTitleColor();

    // 使用 MutationObserver 监听 DOM 变化，确保新增的元素也能应用颜色（rAF 合并，避免顶栏频繁 attribute 变动时同步重查 DOM）
    let logoMoRaf = 0;
    const observer = new MutationObserver(() => {
      if (logoMoRaf) return;
      logoMoRaf = window.requestAnimationFrame(() => {
        logoMoRaf = 0;
        updateLogoTitleColor();
      });
    });

    // 观察顶栏容器
    const headerContainer = document.querySelector('.ant-pro-layout-header, .ant-layout-header');
    if (headerContainer) {
      observer.observe(headerContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    }

    return () => {
      if (logoMoRaf) cancelAnimationFrame(logoMoRaf);
      observer.disconnect();
    };
  }, [isDarkMode, isLightModeLightBg]); // 当主题或背景色变化时重新设置

  /**
   * 根据当前路径设置文档标题（浏览器标签页标题）
   */
  useEffect(() => {
    // 排除登录页等特殊页面
    if (location.pathname.startsWith('/login') || location.pathname.startsWith('/infra/login')) {
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
  const getUserMenuItems = (t: (key: string) => string): MenuProps['items'] => [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: t('ui.user.profile'),
    },
    {
      key: 'copyright',
      icon: <FileTextOutlined />,
      label: t('ui.copyright'),
    },
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
  ];

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

        if (item.path === targetPath) {
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
            // 找到了最近的菜单父级，构造一个虚拟的菜单路径，包含当前页面
            const currentTitle = translatePathTitle(location.pathname, t);
            menuPath = [...parentPath, { path: location.pathname, name: currentTitle }];
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
        const breadcrumbTitle = isAppRootNode
          ? (item.name as string)  // APP 根节点直接用已翻译的 name，与菜单显示保持一致
          : isAppMenu
            ? translateAppMenuItemName(item.name as string, item.path, t)
            : translateMenuName(item.name as string, t, actualPath);

        breadcrumbItems.push({
          title: breadcrumbTitle,
          path: actualPath,
          icon: item.icon,
          menu: menu?.items && menu.items.length > 0 ? menu : undefined,
        });
      });
    }

    // 若未命中任何菜单节点，则直接显示当前路径翻译
    if (breadcrumbItems.length === 0) {
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

  // 计算应该选中的菜单 key（只选中精确匹配的路径）
  const selectedKeys = useMemo(() => {
    return calculateSelectedKeys(filteredMenuData, location.pathname);
  }, [filteredMenuData, location.pathname, calculateSelectedKeys]);

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

  return (
    <>
      {/* 技术栈列表 Modal */}
      <TechStackModal
        open={techStackModalOpen}
        onCancel={() => setTechStackModalOpen(false)}
      />

      {/* 动态设置全局背景色，确保浅色和深色模式下都正确应用 */}
      <style>{`
        html, body {
          background-color: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')} !important;
          transition: none !important;
        }
        #root {
          background-color: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')} !important;
          transition: none !important;
        }
        /* 主题切换：仅掐断布局壳常见层的过渡。避免使用全文档星号通配选择器及 ant-layout 下全后代通配，否则样式引擎需遍历巨量节点，易严重掉帧 */
        .ant-pro-layout,
        .ant-layout,
        .ant-layout-header,
        .ant-layout-content,
        .ant-layout-footer,
        .ant-pro-sider,
        .ant-pro-sider-menu,
        .ant-pro-global-header,
        .ant-pro-global-header-logo,
        .ant-menu,
        .ant-menu-submenu,
        .ant-menu-item {
          transition: background-color 0s !important;
          transition: color 0s !important;
          transition: border-color 0s !important;
        }
        /* ==================== 全屏模式样式 ==================== */
        /* 使用 class 控制，确保退出全屏时样式自动清除 */
        /* 全局容器全屏 - 使用最高优先级选择器 */
        html.riveredge-fullscreen-mode,
        body.riveredge-fullscreen-mode,
        html.riveredge-fullscreen-mode body,
        body.riveredge-fullscreen-mode html {
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        html.riveredge-fullscreen-mode #root,
        body.riveredge-fullscreen-mode #root,
        html.riveredge-fullscreen-mode body #root,
        body.riveredge-fullscreen-mode html #root {
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        /* 隐藏左侧菜单 - 配合 siderWidth={0} + menuRender={() => null} 使用，确保侧边栏完全隐藏 */
        /* 关键：即使 collapsed={true}，折叠的侧边栏仍然占据空间（通常 48-80px），需要完全隐藏 */
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider,
        /* 覆盖折叠状态的侧边栏 */
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider.ant-layout-sider-collapsed,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider.ant-layout-sider-collapsed,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider.ant-layout-sider-collapsed,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider.ant-layout-sider-collapsed {
          display: none !important;
          visibility: hidden !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: 0 !important;
          flex: 0 0 0 !important;
          flex-basis: 0 !important;
          flex-grow: 0 !important;
          flex-shrink: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
          left: -9999px !important;
        }
        /* 隐藏侧边栏内部内容 */
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider-menu,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-sider-menu,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider-children,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-sider-children,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-menu-container,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-menu-container {
          display: none !important;
          visibility: hidden !important;
        }
        /* 确保 flex 布局不为隐藏的侧边栏保留空间 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-has-sider,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-has-sider,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout {
          gap: 0 !important;
          column-gap: 0 !important;
          row-gap: 0 !important;
        }
        /* 确保内容区域占据所有可用空间 - 增强规则 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider > .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider > .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-has-sider > .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-has-sider > .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout > .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout > .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          left: 0 !important;
        }
        /* 隐藏顶部导航栏 */
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-layout-header,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-layout-header,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-header,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-header,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-header,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-header,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-header,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-header {
            display: none !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            flex: 0 0 0 !important;
          }
        /* 确保 ProLayout 容器也占据全屏 */
        html.riveredge-fullscreen-mode .ant-pro-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout-container,
        body.riveredge-fullscreen-mode .ant-pro-layout-container,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout {
            height: 100vh !important;
            min-height: 100vh !important;
            max-height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            left: 0 !important;
            right: 0 !important;
          }
        /* 确保flex容器不为隐藏的sider保留空间 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-layout-has-sider .ant-layout {
          gap: 0 !important;
          column-gap: 0 !important;
          row-gap: 0 !important;
        }
        /* 确保mix布局下的所有布局容器都不保留左侧空间 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout > .ant-layout,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout > .ant-layout {
            margin-left: 0 !important;
            padding-left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
        /* 内容区域占据整个视口 - 从左边距0开始 - 增强规则覆盖所有情况 */
        /* 关键：覆盖 ProLayout 的默认 padding-inline: 40px */
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout .ant-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content,
        /* 覆盖 collapsed 状态下的内容区域 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-layout-content {
          margin-left: 0 !important;
          margin-top: 0 !important;
          margin-right: 0 !important;
          margin-bottom: 0 !important;
          padding: 0 !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
          padding-inline: 0 !important;
          padding-inline-start: 0 !important;
          padding-inline-end: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
          overflow: hidden !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
          left: 0 !important;
          position: relative !important;
        }
        /* 确保 mix 布局下的所有内容容器都从左边距0开始 - 增强规则 */
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .ant-pro-page-container,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .ant-pro-page-container,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content .ant-pro-page-container,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content .ant-pro-page-container,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .uni-tabs-wrapper,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .uni-tabs-wrapper,
        html.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content .uni-tabs-wrapper,
        body.riveredge-fullscreen-mode .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-content .uni-tabs-wrapper,
        /* 覆盖所有可能的布局容器 */
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-pro-layout-content,
        html.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-content,
        body.riveredge-fullscreen-mode .ant-pro-layout-container .ant-layout-content {
          margin-left: 0 !important;
          padding-left: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          left: 0 !important;
        }
        /* 标签栏固定在顶部 */
        html.riveredge-fullscreen-mode .uni-tabs-header,
        body.riveredge-fullscreen-mode .uni-tabs-header {
          top: 0 !important;
          position: sticky !important;
          z-index: 10 !important;
          padding-top: 2px !important;
        }
        /* 标签栏和内容区域容器占据全屏 */
        html.riveredge-fullscreen-mode .uni-tabs-wrapper,
        body.riveredge-fullscreen-mode .uni-tabs-wrapper {
          height: 100vh !important;
          min-height: 100vh !important;
          max-height: 100vh !important;
          width: 100% !important;
          max-width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
          left: 0 !important;
          right: 0 !important;
        }
        html.riveredge-fullscreen-mode .uni-tabs-content,
        body.riveredge-fullscreen-mode .uni-tabs-content {
          flex: 1 !important;
          min-height: 0 !important;
          overflow: auto !important;
          height: auto !important;
          max-height: none !important;
          width: 100% !important;
          max-width: 100% !important;
          margin-left: 0 !important;
          padding-left: 0 !important;
          left: 0 !important;
          right: 0 !important;
        }
      `}</style>
      {/* 自定义分组标题样式 */}
      <style>{`
        /* 动态注入主题色到 CSS 变量 */
        :root {
          --riveredge-menu-primary-color: ${token.colorPrimary};
          --ant-colorPrimary: ${token.colorPrimary};
          --ant-colorBgLayout: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')};
          --ant-colorBorder: ${token.colorBorder};
          --ant-colorBorderSecondary: ${token.colorBorderSecondary ?? token.colorBorder};
          --ant-borderRadius: ${token.borderRadius}px;
          --ant-borderRadiusLG: ${token.borderRadiusLG ?? token.borderRadius + 2}px;
        }
        /* ==================== PageContainer 相关 ==================== */
        .ant-pro-page-container .ant-page-header .ant-page-header-breadcrumb,
        .ant-pro-page-container .ant-breadcrumb {
          display: none !important;
        }
        .ant-pro-page-container .ant-pro-page-container-children-content {
          padding: 0 !important;
        }
        /* 全局页面边距：已由 ListPageTemplate 统一管理，不再需要全局样式 */
        /* 注意：未使用 ListPageTemplate 的页面需要自行管理 padding */
        .uni-tabs-content .ant-pro-table {
          padding: 0 !important;
        }
        /* 侧边栏收起时，确保内容区域左边距正确 - 只在侧边栏收起时生效 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content {
          margin-left: 0 !important;
        }
        /* 侧边栏收起时，内容区域和页面容器的左边距 - 只在侧边栏收起时生效 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* 侧边栏收起状态下的内容区域 - 使用更通用的选择器 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed + .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed + .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed + .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed + .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed + .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed + .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content .ant-pro-page-container {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* 覆盖所有可能的布局容器 - 只在侧边栏收起时生效 */
        .ant-pro-layout-container .ant-pro-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout-container .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout-container .ant-layout-sider-collapsed ~ .ant-pro-layout-content,
        .ant-pro-layout-container .ant-pro-sider-collapsed ~ .ant-layout-content,
        .ant-pro-layout-container .ant-pro-sider.ant-layout-sider-collapsed ~ .ant-layout-content,
        .ant-pro-layout-container .ant-layout-sider-collapsed ~ .ant-layout-content {
          margin-left: 0 !important;
        }
        /* 侧边栏收起时，确保所有内容容器都没有左边距 */
        .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider[class*="collapsed"] ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider[class*="collapsed"] ~ .ant-pro-layout-content {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* 确保 UniTabs 组件在侧边栏收起时也没有左边距 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .uni-tabs-wrapper,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content .uni-tabs-wrapper,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content .uni-tabs-wrapper {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* 文件管理页面无边距（覆盖全局规则） */
        .uni-tabs-content .file-management-page .ant-pro-table {
          padding: 0 !important;
        }
        .pro-table-button-container {
          margin-bottom: 16px;
          padding: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        /* 列表搜索条「重置」：hover / 键盘聚焦时强调为 warning，避免与主色蓝混淆 */
        .uni-search-reset-btn.ant-btn:hover,
        .uni-search-reset-btn.ant-btn:focus-visible {
          color: var(--ant-color-warning, #faad14) !important;
          border-color: var(--ant-color-warning, #faad14) !important;
        }
        .uni-search-reset-btn.ant-btn:hover .anticon,
        .uni-search-reset-btn.ant-btn:focus-visible .anticon {
          color: var(--ant-color-warning, #faad14) !important;
        }
        /* 全局滚动条样式 - 只对主要内容区域隐藏滚动条，保持菜单滚动条可见 */
        /* ==================== 菜单分组标题样式 ==================== */
        /* 参考：https://ant-design.antgroup.com/components/menu-cn
         * groupTitleColor: rgba(0,0,0,0.45), groupTitleFontSize: 14, groupTitleLineHeight: 1.5714285714285714
         * 使用主题颜色变量，支持深色模式，并根据菜单栏背景色自动适配
         */
        /* 侧边栏内的分组标题 - 根据菜单栏背景色自动适配 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item-group > .ant-menu-item-group-title {
          font-size: var(--ant-fontSize) !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
          line-height: 1.5714285714285714 !important;
        }
        /* 应用级菜单分组标题样式 - 使用原生的 .ant-menu-item-group-title */
        .ant-pro-sider-menu .ant-menu-item-group[class*="app-group-"] .ant-menu-item-group-title,
        .ant-pro-sider-menu .ant-menu-item-group[class*="menu-group-title-app"] .ant-menu-item-group-title {
          font-size: 12px !important;
          color: var(--ant-colorPrimary) !important;
          font-weight: 700 !important;
          padding: 2px 16px 2px 0 !important;
          margin: 0 !important;
          line-height: 1.2 !important;
          height: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
        }
        /* 隐藏占位子菜单项 */
        .ant-pro-sider-menu .ant-menu-item[class*="app-group-placeholder-"],
        .ant-pro-sider-menu .ant-menu-item[key*="app-group-placeholder-"] {
          display: none !important;
          height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item-group > .ant-menu-item-group-title:hover,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item-group > .ant-menu-item-group-title:active,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item-group > .ant-menu-item-group-title:focus {
          background: transparent !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
        }
        /* ==================== 一级菜单项 - 完全遵循 Ant Design 原生样式 ==================== */
        /* 不做任何修改，完全使用 Ant Design 的原生样式和垂直居中 */
        /* 侧栏菜单图标是 Lucide <svg>（包裹在 .ant-pro-base-menu-inline-item-icon 内，size=16），
           颜色经 currentColor 继承自菜单项文字色。原先这里针对 .ant-menu-item-icon/.anticon 的
           图标尺寸、20x20 伪元素背景、选中白色等规则均为 antd v4/v5 残留，对 ProLayout 7.x 结构
           完全不命中（零匹配），已清理。 */
        /* ==================== 菜单项样式 - 使用 Ant Design 原生 ==================== */
        /* 让 Ant Design 使用其默认的菜单项高度和行高 */

        /* 子菜单标题样式（ant-menu-submenu-title）- 使用 Ant Design 原生样式 */
        /* 使用主题颜色变量，支持深色模式 */
        /* 注意：只针对侧边栏内的子菜单标题，不影响弹出菜单 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-submenu-title {
          /* 子菜单标题的独立样式，与普通菜单项区分开；几何参数跨主题固定，避免切换时右侧抖动 */
          margin-inline: 6px !important;
          width: calc(100% - 24px) !important;
          box-sizing: border-box !important;
          padding-inline-end: 10px !important; /* 固定箭头区预留空间，避免主题切换导致右侧1-2px位移 */
          color: ${siderTextColor} !important;
          font-size: var(--ant-fontSize) !important;
          font-weight: normal !important;
        }
        /* 一级子菜单箭头位置微调：修复视觉偏左 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed)
          > .ant-menu-submenu
          > .ant-menu-submenu-title
          .ant-menu-submenu-arrow {
          inset-inline-end: 4px !important;
        }
        
        /* 优化菜单标题内容：AntD 6.4 下避免 max-width 计算导致的右侧挤出 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-title-content {
          max-width: calc(100% - 28px) !important; /* 为右侧箭头预留空间，避免重叠 */
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          flex: 1 !important;
          min-width: 0 !important; /* 允许flex子元素收缩 */
        }
        
        /* 一级菜单项的文字内容也需要优化（同上，仅展开态） */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-item .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-title-content {
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          flex: 1 !important;
          min-width: 0 !important; /* 允许flex子元素收缩 */
        }

        /* ⚠️ 收起态唯一必要的框架兼容修复（仅作用于收起栏的「一级项」），其余一切保持 ProLayout 原生。
           antd v6（node_modules/antd/es/menu/style/vertical.js）对收起态写死：
             .ant-menu-inline-collapsed > .ant-menu-item > .ant-menu-title-content { width:0; opacity:0; overflow:hidden }
           v6 假设图标是 title-content 的兄弟节点（antd 自带的 .ant-menu-item-icon），收起时把整块
           title-content 隐藏、单独保留图标；但 ProLayout 7.x 把图标放进 title-content 内部
           （.ant-pro-base-menu-inline-item-icon），导致图标被一起隐藏。这里恢复其可见并居中（仅图标，无文字）。
           ⚠️ 必须用「子选择器」精确限定到收起栏顶层项，不能用后代选择器——否则会波及悬浮弹出的二级菜单
           （ProLayout 把弹出层挂在 body，层级与作用域均不同），破坏其 antd 原生样式。 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title > .ant-menu-title-content {
          width: 100% !important;
          opacity: 1 !important;
          overflow: visible !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
          flex: none !important;
        }
        /* 收起态一级项：清掉 antd v6 的 padding-inline 居中（其前提是图标在 title-content 外），改用 flex 居中。 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title {
          padding-inline: 0 !important;
          justify-content: center !important;
        }
        /* 收起态：激活菜单使用主题色背景，图标白色 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item.ant-menu-item-selected,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title {
          background-color: var(--riveredge-menu-primary-color) !important;
          color: #fff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item.ant-menu-item-selected .anticon,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item.ant-menu-item-selected svg,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title .anticon,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title svg,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-item.ant-menu-item-selected .ant-pro-base-menu-inline-item-icon,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu-inline-collapsed > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title .ant-pro-base-menu-inline-item-icon {
          color: #fff !important;
        }
        
        /* 子菜单标题悬浮状态 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu > .ant-menu-submenu-title:hover {
          background-color: var(--ant-colorFillTertiary) !important;
          color: ${siderTextColor} !important;
        }
        /* 子菜单标题激活状态 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title {
          color: var(--riveredge-menu-primary-color) !important;
        }
        /* 使用自定义样式选择器针对插件分组标题 */
        .menu-group-title-plugin {
          font-size: var(--ant-fontSizeSM) !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
        }
        /* 系统菜单分组标题样式 */
        .menu-group-title-system {
          font-size: var(--ant-fontSizeSM) !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
          margin-top: 8px !important;
        }
        /* 应用级菜单分组标题样式 - 使用实际的选择器 */
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"] {
          padding: 0 16px 0 0 !important; /* 减小上下 padding */
          margin: 0 !important;
          line-height: 1.2 !important;
          height: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
          background-color: transparent !important;
        }
        /* 禁用分组标题的所有交互状态 - 完全去掉 hover 效果 */
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app:hover,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app:focus,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app:active,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app.ant-menu-item-selected,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"]:hover,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"]:focus,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"]:active,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"]:hover::before,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"]:hover::after {
          background-color: transparent !important;
          color: var(--ant-colorTextSecondary) !important;
          box-shadow: none !important;
          border: none !important;
        }
        /* 确保分组标题的容器和内容高度最小 */
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"] {
          height: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
          line-height: 1.2 !important;
        }
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app .ant-menu-title-content,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"] .ant-menu-title-content {
          height: 20px !important;
          min-height: 20px !important;
          max-height: 20px !important;
          line-height: 1.2 !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
        }
        /* 分组标题内部div样式 - 减小上下 padding */
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item.menu-group-title-app .menu-group-title-app,
        .ant-menu-item.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item[class*="menu-group-title-app"] .menu-group-title-app {
          padding: 0 !important; /* 减小上下 padding */
          margin: 0 !important;
          line-height: 1.2 !important;
        }
        /* 左侧菜单小徽标：报表 / 大屏 / 业务未完成数量 */
        .menu-item-badge {
          flex-shrink: 0;
          font-size: 10px;
          line-height: 1.2;
          padding: 0 4px;
          border-radius: 2px;
          font-weight: 500;
        }
        .menu-item-badge-report {
          background: var(--ant-colorPrimaryBg);
          color: var(--ant-colorPrimary);
        }
        .menu-item-badge-dashboard {
          background: var(--ant-colorInfoBg);
          color: var(--ant-colorInfo);
        }
        .menu-item-badge-count.ant-badge .ant-badge-count {
          font-size: 10px;
          line-height: 14px;
          min-width: 14px;
          height: 14px;
          padding: 0 2px;
        }
        .menu-item-badge-count {
          flex-shrink: 0;
          margin-right: 4px;
        }
        /* 菜单项含数字徽标时：增加右侧留白，避免徽标右边被遮挡 */
        .ant-pro-sider-menu .ant-menu-item:has(.menu-item-badge-count) {
          padding-right: 22px !important;
          overflow: visible !important;
        }
        .ant-pro-sider-menu .ant-menu-item:has(.menu-item-badge-count) .ant-menu-title-content {
          overflow: visible !important;
        }
        /* 使用 ProLayout 原生收起按钮，保持原生行为 */
        /* 不再隐藏原生收起按钮，让 ProLayout 自己处理收起展开逻辑 */
        /* 隐藏 ant-pro-layout-container 里的 footer */
        .ant-pro-layout-container .ant-pro-layout-footer {
          display: none !important;
        }
        /* ==================== 菜单收起状态 - 遵循 Ant Design 原生行为 ==================== */
        /* 原则：让 Ant Design 自己处理菜单收起/展开，不做过多干预 */
        .ant-pro-layout-container footer {
          display: none !important;
        }
        /* 菜单底部收起按钮样式 - 根据菜单栏背景色自动适配 */
        .menu-collapse-button {
          color: ${siderTextColor} !important;
        }
        .menu-collapse-button:hover {
          background-color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.08)' : 'var(--ant-colorFillTertiary)'} !important;
          border-radius: 4px !important;
          color: ${siderTextColor} !important;
        }
        .menu-collapse-button:active {
          background-color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.12)' : 'var(--ant-colorFillSecondary)'} !important;
          color: ${siderTextColor} !important;
        }
        /* ==================== 菜单底部 ==================== */
        /* 使用主题边框颜色，支持深色模式，并根据菜单栏背景色自动适配 */
        .ant-pro-sider-footer {
          margin-bottom: 10px !important;
          padding-bottom: 0 !important;
        }
        /* 侧边栏底部收起按钮区域样式 - 根据菜单栏背景色自动适配 */
        .ant-pro-layout .ant-pro-sider-footer,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer,
        /* 覆盖 collapsedButtonRender 返回的 div */
        .ant-pro-layout .ant-pro-sider-footer > div,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div {
          border-top: 1px solid var(--river-divider-color) !important;
        }
        /* 侧边栏底部收起按钮样式 - 根据菜单栏背景色自动适配 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn {
          color: ${siderTextColor} !important;
        }
        /* 盖过上一段：设置钮文字/图标用主题主色 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .riveredge-footer-settings-btn,
        .riveredge-footer-collapse-btn {
          width: 100% !important;
          border-radius: ${startMenuBaseRadius}px !important;
        }
        /* 系统设置入口：深色侧栏中性底 + 主题色字；浅色侧栏主色浅底 */
        .riveredge-footer-settings-btn {
          background: ${startMenuTheme.settingsBtnBg} !important;
          border-color: ${startMenuTheme.settingsBtnBorder} !important;
          box-shadow: none !important;
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .riveredge-footer-settings-btn .anticon,
        .riveredge-footer-settings-btn svg {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .riveredge-footer-settings-btn:hover {
          background: ${startMenuTheme.settingsBtnBgHover} !important;
          border-color: ${startMenuTheme.settingsBtnBorder} !important;
        }
        .riveredge-footer-settings-btn:active {
          background: ${startMenuTheme.settingsBtnBgActive} !important;
        }
        /* 折叠钮统一中性底 token */
        .riveredge-footer-collapse-btn {
          background: ${siderFooterToken.colorFillSecondary} !important;
          border-color: ${siderFooterToken.colorSplit} !important;
          box-shadow: none !important;
        }
        .riveredge-footer-collapse-btn:hover {
          background: ${siderFooterToken.colorFillTertiary} !important;
        }
        .riveredge-footer-collapse-btn:active {
          background: ${siderFooterToken.colorFillQuaternary} !important;
        }
        @keyframes riveredgeSystemPanelIn {
          from {
            opacity: 0;
            transform: translate3d(0, 14px, 0) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes riveredgeSystemPanelOut {
          from {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          to {
            opacity: 0;
            transform: translate3d(0, 16px, 0) scale(0.97);
          }
        }
        .riveredge-system-settings-panel {
          position: fixed;
          left: 8px;
          bottom: 52px;
          width: min(var(--riveredge-system-panel-width, 940px), calc(100vw - 24px));
          max-height: min(86vh, 860px);
          border-radius: ${startMenuPanelRadius}px;
          border: 1px solid ${startMenuTheme.panelBorder};
          background: ${startMenuTheme.panelBg};
          ${startMenuTheme.panelBlur ? `backdrop-filter: blur(${startMenuTheme.panelBlurAmount}) saturate(${startMenuTheme.panelBlurSaturate}); -webkit-backdrop-filter: blur(${startMenuTheme.panelBlurAmount}) saturate(${startMenuTheme.panelBlurSaturate});` : ''}
          box-shadow: ${startMenuTheme.panelShadow};
          z-index: 1200;
          overflow: hidden;
          transform-origin: left bottom;
          animation: riveredgeSystemPanelIn 0.26s cubic-bezier(0.16, 1, 0.3, 1) both;
          will-change: transform, opacity;
        }
        .riveredge-system-settings-panel.riveredge-system-settings-panel--exiting {
          animation: riveredgeSystemPanelOut 0.22s cubic-bezier(0.4, 0, 0.2, 1) both;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .riveredge-system-settings-panel {
            animation: none;
          }
        }
        .riveredge-system-settings-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 18px 12px;
          border-bottom: 1px solid ${startMenuTheme.panelHeaderBorder};
        }
        .riveredge-system-settings-panel-title {
          font-size: 16px;
          font-weight: 700;
          color: ${startMenuTheme.panelTitleColor};
        }
        .riveredge-system-settings-panel-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: auto;
          min-width: 0;
        }
        .riveredge-system-settings-panel-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 12px;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          line-height: 1.4;
          color: ${startMenuTheme.panelTitleColor};
          background: ${startMenuTheme.panelGroupBg};
          border: 1px solid ${startMenuTheme.panelGroupBorder};
          box-shadow: ${startMenuTheme.panelGroupInsetShadow};
        }
        .riveredge-system-settings-panel-meta-item {
          white-space: nowrap;
        }
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close,
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close .anticon {
          color: ${startMenuTheme.panelCloseColor} !important;
        }
        .riveredge-system-settings-panel-header .riveredge-system-settings-panel-close:hover {
          color: ${startMenuTheme.panelTitleColor} !important;
          background: ${startMenuTheme.panelCloseHoverBg} !important;
        }
        .riveredge-system-settings-panel-body {
          padding: 14px;
          overflow-y: auto;
          max-height: min(78vh, 760px);
          display: grid;
          grid-template-columns: repeat(var(--riveredge-system-panel-columns, 24), minmax(0, 1fr));
          align-content: start;
          gap: 12px;
          background: transparent;
        }
        .riveredge-system-settings-group-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-width: 0;
        }
        .riveredge-system-settings-group {
          border-radius: ${startMenuPanelRadius}px;
          padding: 12px;
          background: ${startMenuTheme.panelGroupBg};
          border: 1px solid ${startMenuTheme.panelGroupBorder};
          box-shadow: ${startMenuTheme.panelGroupInsetShadow};
        }
        .riveredge-system-settings-group-title {
          font-size: 13px;
          font-weight: 600;
          color: ${startMenuTheme.panelGroupTitle};
          padding: 0 2px;
          line-height: 1.3;
        }
        .riveredge-system-settings-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .riveredge-system-settings-item {
          width: 100%;
          border: 1px solid ${startMenuTheme.panelItemBorder};
          background: ${startMenuTheme.panelItemBg};
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          color: ${startMenuTheme.panelItemColor};
          padding: 10px 8px;
          border-radius: ${startMenuBaseRadius}px;
          min-height: 76px;
          height: auto;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
        }
        .riveredge-system-settings-item:hover {
          background: ${startMenuTheme.panelItemHoverBg};
          border-color: ${startMenuTheme.panelItemHoverBorder};
          transform: translateY(-1px);
          box-shadow: none;
        }
        .riveredge-system-settings-item:focus-visible {
          outline: 2px solid var(--ant-colorPrimary);
          outline-offset: 1px;
        }
        .riveredge-system-settings-item-icon {
          width: 44px;
          height: 44px;
          border-radius: ${startMenuPanelRadius}px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          line-height: 1;
          transition: transform 0.18s ease;
        }
        .riveredge-system-settings-item-icon .anticon,
        .riveredge-system-settings-item-icon svg {
          font-size: 42px;
          width: 42px;
          height: 42px;
          color: currentColor;
        }
        .riveredge-system-settings-item:hover .riveredge-system-settings-item-icon {
          transform: translateY(-1px);
        }
        .riveredge-system-settings-item-label {
          font-size: 13px;
          line-height: 1.25;
          font-weight: 500;
          text-align: center;
          width: 100%;
          min-height: calc(1.25em * 2);
          display: flex;
          align-items: center;
          justify-content: center;
          white-space: normal;
          overflow-wrap: break-word;
          word-break: normal;
        }
        @media (max-width: 900px) {
          .riveredge-system-settings-panel {
            left: 8px;
            right: 8px;
            width: auto;
          }
          .riveredge-system-settings-panel-body {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
          .riveredge-system-settings-group-wrap {
            grid-column: span 6 !important;
          }
        }
        @supports not ((backdrop-filter: blur(2px))) {
          .riveredge-system-settings-panel {
            background: ${startMenuTheme.panelBgFallback};
          }
        }
        /* 侧边栏底部收起按钮图标样式 - 根据菜单栏背景色自动适配 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn svg {
          color: ${siderTextColor} !important;
        }
        /* 侧边栏底部收起按钮 hover 状态 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:hover,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:hover,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:hover,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:hover {
          color: ${siderTextColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:hover .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:hover .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:hover svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:hover svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:hover .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:hover .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:hover svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:hover svg {
          color: ${siderTextColor} !important;
        }
        /* 侧边栏底部收起按钮 active 状态 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:active,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:active,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:active,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:active {
          color: ${siderTextColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:active .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:active .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn:active svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn:active svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:active .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:active .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn:active svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn:active svg {
          color: ${siderTextColor} !important;
        }
        /* 设置钮图标：跟主题主色（盖过上面「全体侧栏底栏图标 = siderTextColor」） */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn svg {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:hover svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:hover svg {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active .anticon,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active .anticon,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active .anticon,
        .ant-pro-layout .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn.riveredge-footer-settings-btn:active svg,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active svg,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn.riveredge-footer-settings-btn:active svg {
          color: ${startMenuTheme.settingsBtnColor} !important;
        }
        /* ==================== 左侧菜单栏滚动条样式 ==================== */
        /* 完全隐藏左侧菜单栏滚动条，不占用任何宽度 */
        .ant-pro-layout .ant-pro-sider-menu::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        .ant-pro-layout .ant-pro-sider-menu::-webkit-scrollbar-track {
          display: none !important;
        }
        .ant-pro-layout .ant-pro-sider-menu::-webkit-scrollbar-thumb {
          display: none !important;
        }
        /* Firefox 左侧菜单栏滚动条样式 */
        .ant-pro-layout .ant-pro-sider-menu {
          scrollbar-width: none !important;
        }
        /* 统一顶部、标签栏和菜单栏的背景色 - 使用 token 值并同步到 CSS 变量；Modal 内容区/footer 使用 colorBgElevated */
        :root {
          --ant-colorBgContainer: ${token.colorBgContainer};
          --ant-colorBgElevated: ${token.colorBgElevated};
        }
        /* 顶栏背景色（支持透明度） */
        .ant-pro-layout .ant-pro-layout-header,
        .ant-pro-layout .ant-layout-header {
          background: ${headerBgColor} !important;
          border-bottom: 1px solid ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)'} !important;
        }
        /* ==================== 顶栏文字颜色自动适配（根据背景色亮度反色处理） ==================== */
        /* 顶栏文字颜色 - 根据背景色亮度自动适配 */
        .ant-pro-layout .ant-pro-layout-header,
        .ant-pro-layout .ant-layout-header {
          color: ${headerTextColor} !important;
        }
        /* 顶栏按钮文字颜色和图标颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn,
        .ant-pro-layout .ant-layout-header .ant-btn {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn .anticon,
        .ant-pro-layout .ant-layout-header .ant-btn .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn svg,
        .ant-pro-layout .ant-layout-header .ant-btn svg {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 16px !important;
        }
        /* 顶栏按钮 hover 状态 - 浅色模式浅色背景无hover */
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover,
        .ant-pro-layout .ant-layout-header .ant-btn:hover {
          background-color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.1)'} !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover .anticon,
        .ant-pro-layout .ant-layout-header .ant-btn:hover .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover svg,
        .ant-pro-layout .ant-layout-header .ant-btn:hover svg {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 16px !important;
        }
        /* 顶栏按钮 active 状态 - 浅色模式浅色背景无active效果 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active,
        .ant-pro-layout .ant-layout-header .ant-btn:active {
          background-color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.1)'} !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active .anticon,
        .ant-pro-layout .ant-layout-header .ant-btn:active .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active svg,
        .ant-pro-layout .ant-layout-header .ant-btn:active svg {
          color: ${isDarkMode ? 'var(--ant-colorText)' : 'rgba(0, 0, 0, 0.85)'} !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 16px !important;
        }
        /* 内容区背景颜色与 PageContainer 一致 - 使用 token 值 */
        .ant-pro-layout-bg-list {
          background: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')} !important;
        }
        /* 确保 ProLayout 内容区域背景色与激活标签一致；强制 padding 为 0，避免首次加载 32px→16px 布局闪烁 */
        .ant-pro-layout-content,
        .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout-content .ant-pro-page-container-children-content {
          background: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')} !important;
          padding: 0 !important;
          padding-inline: 0 !important;
        }
        /* 左侧菜单区背景色 - 仅主侧栏（ant-pro-sider），不影响页面内嵌 Sider（如配置中心参数分类） */
        .ant-pro-layout .ant-pro-sider,
        .ant-pro-layout .ant-pro-sider-menu,
        .ant-pro-layout .ant-pro-sider .ant-layout-sider,
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children,
        .ant-pro-layout[data-theme="light"] .ant-pro-sider,
        .ant-pro-layout[data-theme="light"] .ant-pro-sider-menu {
          background: ${siderBgColor} !important;
        }
        
        /* 根据菜单栏背景色自动适配文字颜色 */
        /* 深色背景使用浅色文字，浅色背景使用深色文字 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item:not(.ant-menu-item-selected),
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu > .ant-menu-submenu-title,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item-group > .ant-menu-item-group-title {
          color: ${siderTextColor} !important;
        }
        /* 统一菜单文字排版（跨主题固定），避免切换明暗模式时文字抖动 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content > span,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content > span {
          font-weight: 400 !important;
          letter-spacing: 0 !important;
        }
        
        /* （菜单图标颜色由 currentColor 继承自上面的菜单项文字色，无需单独的 .anticon 规则，已清理） */
        
        /* 菜单栏增加与顶部间距 */
        .ant-pro-layout .ant-pro-sider-menu {
          padding-top: 8px !important;
          /* 确保菜单容器有正确的布局 */
          display: flex !important;
          flex-direction: column !important;
          height: 100% !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
        /* 确保菜单项正常显示 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu {
          flex-shrink: 0 !important;
        }
        /* 菜单底部区域确保在底部 */
        .ant-pro-layout .ant-pro-sider-footer {
          margin-top: auto !important;
          flex-shrink: 0 !important;
        }
        /* 嵌套菜单排版（明暗模式一致）：三级及以下保持原缩进，二级略向左 */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) .ant-menu-sub .ant-menu-item,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) .ant-menu-sub .ant-menu-submenu-title {
          margin-inline: 6px !important;
          width: calc(100% - 24px) !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          padding-inline-start: 40px !important;
        }
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-sub > .ant-menu-item,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-sub > .ant-menu-submenu > .ant-menu-submenu-title {
          padding-inline-start: 32px !important;
        }
        ${!isDarkMode ? `
        /* 浅色模式：激活菜单统一主题色背景（含浅色侧栏与深色侧栏） */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected {
          background-color: var(--riveredge-menu-primary-color) !important;
          border-right: none !important;
          box-shadow: none !important;
          color: #fff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > span,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected .ant-menu-title-content a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected .ant-menu-title-content span {
          color: #fff !important;
          font-weight: normal !important;
        }
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected::after {
          display: none !important;
        }
        ` : ''}
        ${isDarkMode ? `
        /* 深色模式：激活菜单项宽度与明亮模式保持一致（参考明亮模式右侧留白） */
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-item.ant-menu-item-selected,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) .ant-menu-sub .ant-menu-item.ant-menu-item-selected,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu:not(.ant-menu-inline-collapsed) .ant-menu-sub .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title {
          margin-inline: 6px !important;
          width: calc(100% - 24px) !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }
        /* 深色模式：激活态文本排版固定，避免模式切换时字宽抖动 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > span,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title .ant-menu-title-content > span {
          font-weight: 400 !important;
          letter-spacing: 0 !important;
        }
        ` : ''}
        ${isLightModeDarkSider ? `
        /* 浅色模式 + 深色侧栏：所有菜单层级统一白色文字 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content > span,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content > span,
        .ant-menu-item[data-menu-id*='app-group-'],
        .ant-menu-item[class*='menu-group-title-app'] {
          color: #fff !important;
        }
        .ant-menu-item[data-menu-id*='app-group-']:hover,
        .ant-menu-item[class*='menu-group-title-app']:hover,
        .ant-menu-item[data-menu-id*='app-group-'] .ant-menu-title-content,
        .ant-menu-item[class*='menu-group-title-app'] .ant-menu-title-content {
          color: #fff !important;
        }
        ` : ''}
        ${(isDarkMode || isLightModeDarkSider) ? `
        /* 收起态二级弹层（submenu popup）：浅色+深色侧栏场景使用白底 80% 透明，提高可读性 */
        .ant-menu-submenu-popup > .ant-menu {
          background: ${isLightModeDarkSider ? 'rgba(255, 255, 255, 0.8)' : 'rgba(11, 23, 42, 0.9)'} !important;
          border: 1px solid ${isLightModeDarkSider ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.14)'} !important;
          box-shadow:
            ${isLightModeDarkSider ? '0 14px 32px rgba(15, 23, 42, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.55)' : '0 14px 32px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.08)'} !important;
          backdrop-filter: ${isLightModeDarkSider ? 'blur(14px) saturate(145%)' : 'blur(16px) saturate(155%)'} !important;
          -webkit-backdrop-filter: ${isLightModeDarkSider ? 'blur(14px) saturate(145%)' : 'blur(16px) saturate(155%)'} !important;
        }
        .ant-menu-submenu-popup > .ant-menu .ant-menu-item,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-submenu-title,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-title-content,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-title-content > a,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-title-content > span {
          color: ${isLightModeDarkSider ? 'rgba(0, 0, 0, 0.88)' : 'rgba(255, 255, 255, 0.92)'} !important;
        }
        .ant-menu-submenu-popup > .ant-menu .ant-menu-item:hover,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-submenu-title:hover {
          background: ${isLightModeDarkSider ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.12)'} !important;
          color: ${isLightModeDarkSider ? 'rgba(0, 0, 0, 0.92)' : '#fff'} !important;
        }
        .ant-menu-submenu-popup > .ant-menu .ant-menu-item-selected,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-submenu-selected > .ant-menu-submenu-title {
          background: var(--riveredge-menu-primary-color) !important;
          color: #fff !important;
        }
        .ant-menu-submenu-popup > .ant-menu .ant-menu-submenu-arrow::before,
        .ant-menu-submenu-popup > .ant-menu .ant-menu-submenu-arrow::after {
          background: ${isLightModeDarkSider ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.75)'} !important;
        }
        ` : ''}
        
        /* 二级及以下菜单恢复 antd/pro-layout 原生样式：不再覆写颜色、选中态、缩进与过渡。 */
        /* ==================== 侧栏菜单动效：更短、更利落（仅作用于侧栏，不影响主题切换全局 0s 规则） ==================== */
        .ant-pro-layout .ant-pro-sider .ant-motion-collapse,
        .ant-pro-layout .ant-pro-sider .ant-motion-collapse-legacy-active {
          transition:
            height 0.15s cubic-bezier(0.33, 1, 0.68, 1),
            opacity 0.1s ease !important;
        }
        .ant-pro-layout .ant-pro-sider-menu.ant-menu > .ant-menu-item,
        .ant-pro-layout .ant-pro-sider-menu.ant-menu > .ant-menu-submenu > .ant-menu-submenu-title {
          transition:
            background-color 0.12s cubic-bezier(0.33, 1, 0.68, 1),
            color 0.12s cubic-bezier(0.33, 1, 0.68, 1) !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-submenu-arrow,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-submenu-arrow::before,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-submenu-arrow::after {
          transition: transform 0.12s cubic-bezier(0.33, 1, 0.68, 1) !important;
        }
        .ant-pro-layout .ant-pro-sider.ant-layout-sider {
          transition:
            width 0.18s cubic-bezier(0.33, 1, 0.68, 1),
            min-width 0.18s cubic-bezier(0.33, 1, 0.68, 1),
            max-width 0.18s cubic-bezier(0.33, 1, 0.68, 1),
            flex 0.18s cubic-bezier(0.33, 1, 0.68, 1) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .ant-pro-layout .ant-pro-sider .ant-motion-collapse,
          .ant-pro-layout .ant-pro-sider .ant-motion-collapse-legacy-active,
          .ant-pro-layout .ant-pro-sider-menu.ant-menu > .ant-menu-item,
          .ant-pro-layout .ant-pro-sider-menu.ant-menu > .ant-menu-submenu > .ant-menu-submenu-title,
          .ant-pro-layout .ant-pro-sider.ant-layout-sider {
            transition: none !important;
          }
        }
        /* 顶栏右侧操作按钮样式优化 - 遵循 Ant Design 规范 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions,
        .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions,
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header {
          flex-shrink: 0 !important;
          min-width: max-content !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-space,
        .ant-pro-layout .ant-layout-header .ant-space {
          gap: 8px !important;
          align-items: center !important;
        }
        /* AI 助手 Lottie 按钮与搜索框等垂直对齐 */
        .ant-pro-layout .ant-pro-layout-header .ant-space-item:has(.ai-assistant-lottie-btn-wrapper),
        .ant-pro-layout .ant-layout-header .ant-space-item:has(.ai-assistant-lottie-btn-wrapper),
        .ant-pro-layout .ant-pro-layout-header .ant-space-item:has(.header-search-wrapper),
        .ant-pro-layout .ant-layout-header .ant-space-item:has(.header-search-wrapper) {
          display: flex !important;
          align-items: center !important;
        }
        /* 搜索框与顶栏其他元素垂直居中，修正 Input 内部 baseline 导致的视觉偏低 */
        .ant-pro-layout .ant-pro-layout-header .header-search-wrapper,
        .ant-pro-layout .ant-layout-header .header-search-wrapper {
          display: inline-flex !important;
          align-items: center !important;
          align-self: center !important;
        }
        .ant-pro-layout .ant-pro-layout-header .header-search-wrapper .ant-input-affix-wrapper,
        .ant-pro-layout .ant-layout-header .header-search-wrapper .ant-input-affix-wrapper {
          display: inline-flex !important;
          align-items: center !important;
        }
        /* 统一按钮样式 - 保留圆形背景，浅色背景时图标颜色统一为黑色 */
        /* 注意：这些样式会被之前的通用顶栏按钮样式覆盖，但保留这里作为备用和补充 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn,
        .ant-pro-layout .ant-layout-header .ant-btn {
          width: 32px !important;
          height: 32px !important;
          flex-shrink: 0 !important; // ⚠️ 防止挤压变形
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 50% !important;
          background-color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.1)'} !important;
          border: none !important;
          transition: none !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn .anticon,
        .ant-pro-layout .ant-layout-header .ant-btn .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        /* Badge 内按钮样式 - 与顶栏 .ant-btn 保持相同 flex 居中（antd 6.4+ 下缺此项会偏上） */
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn {
          width: 32px !important;
          height: 32px !important;
          flex-shrink: 0 !important; // ⚠️ 防止挤压变形
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 50% !important;
          background-color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.1)'} !important;
          transition: none !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn .anticon,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn svg,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn svg {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 16px !important;
        }
        /* Badge 内按钮 hover 状态 - 浅色模式浅色背景无hover */
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn:hover,
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover .ant-btn,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn:hover,
        .ant-pro-layout .ant-layout-header .ant-badge:hover .ant-btn {
          background-color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.1)'} !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          border-color: transparent !important;
          box-shadow: none !important;
          transform: none !important;
          border-radius: 50% !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn:hover .anticon,
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover .ant-btn .anticon,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn:hover .anticon,
        .ant-pro-layout .ant-layout-header .ant-badge:hover .ant-btn .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn:hover svg,
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover .ant-btn svg,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn:hover svg,
        .ant-pro-layout .ant-layout-header .ant-badge:hover .ant-btn svg {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          width: 16px !important;
          height: 16px !important;
          font-size: 16px !important;
        }
        /* 确保 Badge 本身无任何 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover,
        .ant-pro-layout .ant-layout-header .ant-badge:hover {
          background-color: transparent !important;
          border-color: transparent !important;
          box-shadow: none !important;
        }
        /* 用户头像按钮样式 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn .ant-avatar,
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-avatar {
          border: none;
          box-shadow: none;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn .ant-avatar:has(img),
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-avatar:has(img) {
          background: transparent !important;
        }
        /* 顶栏文字头像：背景/字色跟随主题（避免透明底 + antd 默认灰底白字） */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-avatar:not(:has(img)),
        .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions .ant-avatar:not(:has(img)) {
          background-color: var(--ant-colorPrimary) !important;
          color: var(--ant-colorTextLightSolid, #ffffff) !important;
        }
        /* 租户选择器样式 - 胶囊型，与搜索框一致 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper {
          padding: 0;
          transition: none !important;
        }
        /* 顶栏胶囊型按钮统一样式（租户选择器 - 与组织选择器完全一致），文字跟随系统 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper > span,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper > span {
          display: flex !important;
          align-items: center !important;
          vertical-align: middle !important;
          gap: 6px !important;
          padding: 4px 12px !important;
          border-radius: 16px !important;
          background-color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.1)'} !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: ${token.fontSize}px !important;
          font-weight: 500 !important;
          height: 32px !important;
          line-height: 24px !important;
        }
        /* AI 助手 Lottie 按钮：仅图标 48x48，无背景、无动效 */
        .ai-assistant-lottie-btn-wrapper {
          display: inline-flex;
          align-items: center;
          align-self: center;
        }
        .ant-pro-layout .ant-pro-layout-header .ai-assistant-lottie-btn,
        .ant-pro-layout .ant-layout-header .ai-assistant-lottie-btn {
          display: block !important;
          padding: 0 !important;
          margin: 0 !important;
          background: none !important;
          border: none !important;
          cursor: pointer !important;
          line-height: 0 !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ai-assistant-lottie-btn:hover,
        .ant-pro-layout .ant-layout-header .ai-assistant-lottie-btn:hover {
          background: none !important;
        }
        /* 上线向导：图标与文案间距 4px，!important 避免被 Space/主题覆盖 */
        .ant-pro-layout .ant-pro-layout-header .riveredge-header-onboarding-space.ant-space,
        .ant-pro-layout .ant-layout-header .riveredge-header-onboarding-space.ant-space {
          gap: 4px !important;
          column-gap: 4px !important;
        }
        /* 租户选择器内的选择框样式 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select-selector {
          border-radius: 16px !important; /* 胶囊型圆角 */
          border: none !important;
          box-shadow: none !important;
          background-color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.1)'} !important;
          background: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.1)'} !important;
          height: 32px !important;
        }
        /* 租户选择器文字颜色与字号 - 根据显示模式统一，深色背景时强制浅色，文字跟随系统 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-placeholder,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-placeholder,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-search-input {
          font-size: ${token.fontSize}px !important;
          font-weight: 500 !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-content-value,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-content-value,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-content,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-content {
          font-size: ${token.fontSize}px !important;
          font-weight: 500 !important;
        }
        /* 深色顶栏下组织选择器强制浅色文字（通过 data-header-light-text 标记，覆盖 Ant Design 默认） */
        /* Ant Design 6 使用 --select-color 控制文字颜色，需覆盖该变量 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select,
        .ant-pro-global-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select,
        .tenant-selector-select-light-text .ant-select {
          --select-color: rgba(255, 255, 255, 0.85) !important;
          color: rgba(255, 255, 255, 0.85) !important;
        }
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-item,
        /* Ant Design 6 新结构：content-value、content、placeholder */
        .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-content-value,
        .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-content,
        .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-placeholder,
        .tenant-selector-select-light-text .ant-select .ant-select-content-value,
        .tenant-selector-select-light-text .ant-select .ant-select-content,
        .tenant-selector-select-light-text .ant-select .ant-select-placeholder,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-placeholder,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-placeholder,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-search,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selection-search,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] > span,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] > span,
        /* 覆盖 Select 内部文字元素；或通过组件内 className 标记 */
        .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selector,
        .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-selector *,
        .tenant-selector-select-light-text .ant-select .ant-select-selector,
        .tenant-selector-select-light-text .ant-select .ant-select-selector * {
          color: rgba(255, 255, 255, 0.85) !important;
        }
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-arrow,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-arrow,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-suffix,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-suffix,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-suffix .anticon,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper[data-header-light-text="true"] .ant-select .ant-select-suffix .anticon,
        .tenant-selector-select-light-text .ant-select .ant-select-suffix,
        .tenant-selector-select-light-text .ant-select .ant-select-suffix .anticon {
          color: rgba(255, 255, 255, 0.65) !important;
        }
        /* 租户选择器箭头图标颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.65)'} !important;
        }
        /* 租户选择器所有状态 - 浅色模式浅色背景无hover */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:not(.ant-select-disabled):hover .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select:not(.ant-select-disabled):hover .ant-select-selector {
          border: none !important;
          box-shadow: none !important;
          background: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.1)'} !important;
        }
        /* 租户选择器 hover 和 focused 状态下的文字颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selection-item,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selection-item,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selection-item {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        /* 租户选择器内部输入框样式 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item {
          background: transparent !important;
        }
        /* 租户选择器文字左右边距 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item {
          padding-left: 6px !important;
          padding-right: 18px !important;
        }
        /* 租户选择器切换图标样式 - 确保在右侧 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow {
          right: 8px !important;
        }
        /* 禁用租户选择器 wrapper 的 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper:hover,
        .ant-pro-layout .ant-layout-header .tenant-selector-wrapper:hover {
          background-color: transparent !important;
        }
        /* 搜索框样式 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper {
          border: none !important;
          box-shadow: none !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
        }
        /* 搜索框文字颜色和占位符颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper .ant-input {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper .ant-input::placeholder {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.45)'} !important;
        }
        /* 搜索框图标颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.65)'} !important;
        }
        /* 手机模式下隐藏搜索框 */
        @media (max-width: 768px) {
          .ant-pro-layout .ant-pro-layout-header .ant-space-item:has(.ant-input-affix-wrapper),
          .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper {
            display: none !important;
          }
        }
        /* 搜索框 hover 状态 - 浅色模式浅色背景无hover */
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper:hover {
          border: none !important;
          box-shadow: none !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
        }
        /* 搜索框聚焦时外侧框线强调，使用户意识到处于搜索状态 */
        .ant-pro-layout .ant-pro-layout-header .header-search-wrapper .ant-input-affix-wrapper-focused {
          border: none !important;
          box-shadow: 0 0 0 2px ${isLightModeLightBg ? token.colorPrimaryBorder : 'rgba(255, 255, 255, 0.5)'} !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.15)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-input {
          background-color: transparent !important;
          border: none !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        /* 顶栏消息、手机预览等下拉框：统一无箭头、对齐 */
        .header-actions-dropdown.ant-dropdown {
          padding: 0 !important;
        }
        .header-actions-dropdown .ant-dropdown-arrow {
          display: none !important;
        }
        /* 顶栏消息未读角标：挂在 Button 伪元素上，DOM 与语言/主题按钮一致（Tooltip → Button） */
        .ant-pro-layout .ant-pro-layout-header .riveredge-header-notification-btn--has-count,
        .ant-pro-layout .ant-layout-header .riveredge-header-notification-btn--has-count {
          position: relative !important;
          overflow: visible !important;
        }
        .ant-pro-layout .ant-pro-layout-header .riveredge-header-notification-btn--has-count::after,
        .ant-pro-layout .ant-layout-header .riveredge-header-notification-btn--has-count::after {
          content: attr(data-unread-count);
          position: absolute;
          top: 0;
          inset-inline-end: 0;
          transform: translate(50%, -50%);
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 8px;
          background: var(--ant-color-error);
          color: var(--ant-color-text-light-solid, #fff);
          font-size: 12px;
          line-height: 16px;
          text-align: center;
          font-weight: 500;
          box-shadow: 0 0 0 1px var(--ant-color-bg-container);
          pointer-events: none;
          z-index: 1;
        }
        .ant-pro-global-header{
          margin-inline: 0 !important;
        }
        .ant-layout-sider-children{
          padding-inline: 0 !important;
        }
        /* 侧栏顶部搜索框：固定高度 38px 与 unitabs 等高，宽度填满，无胶囊背景、聚焦无光晕 */
        .ant-layout-sider .riveredge-sidebar-search-wrapper {
          width: 100% !important;
          box-sizing: border-box;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-affix-wrapper,
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box;
          background: transparent !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-affix-wrapper {
          padding-inline: 4px !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input {
          padding-left: 4px !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-affix-wrapper:hover {
          background: transparent !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-affix-wrapper-focused,
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-affix-wrapper:focus-within {
          box-shadow: none !important;
          outline: none !important;
        }
        .ant-layout-sider .riveredge-sidebar-search-wrapper .ant-input-prefix .anticon {
          color: ${isDarkMode ? 'rgba(255,255,255,0.65)' : (siderTextColor === '#ffffff' ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)')} !important;
        }
        /* 侧栏搜索框占位字符颜色：适配“明亮模式 + 深色背景” */
        .riveredge-sidebar-search-wrapper input::placeholder,
        .riveredge-sidebar-search-wrapper .ant-input::placeholder {
          color: ${isDarkMode ? 'rgba(255, 255, 255, 0.45)' : (siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.58)' : 'rgba(0, 0, 0, 0.25)')} !important;
        }
        /* 侧栏搜索框快捷键（拟物按键）：框线/底影与搜索条底边一致，不用浅色主题的 --river-border-color */
        .riveredge-sidebar-search-wrapper .topbar-search-shortcut-key {
          color: ${isDarkMode ? 'rgba(255,255,255,0.28)' : (siderTextColor === '#ffffff' ? 'rgba(255,255,255,0.28)' : (token?.colorBorder ?? '#d9d9d9'))} !important;
          background: ${isDarkMode ? 'rgba(255,255,255,0.10)' : (siderTextColor === '#ffffff' ? 'rgba(255,255,255,0.10)' : (token?.colorFillQuaternary ?? '#f5f5f5'))} !important;
          border: 1px solid ${
            siderTextColor === '#ffffff'
              ? 'rgba(255, 255, 255, 0.15)'
              : isDarkMode
                ? 'rgba(255, 255, 255, 0.12)'
                : (token?.colorBorder ?? 'rgba(0, 0, 0, 0.15)')
          } !important;
          box-shadow: 0 1px 0 ${
            siderTextColor === '#ffffff'
              ? 'rgba(255, 255, 255, 0.12)'
              : isDarkMode
                ? 'rgba(255, 255, 255, 0.10)'
                : (token?.colorBorder ?? '#d9d9d9')
          } !important;
          font-family: "JetBrains Mono", "Cascadia Code", Consolas, monospace !important;
          font-size: 12px !important;
        }
        /* LOGO 样式 - 设置 min-width 和垂直对齐 */
        .ant-pro-global-header-logo {
          min-width: 181px !important;
          display: flex !important;
          align-items: center !important;
          height: 100% !important;
          /* 手机端移除 min-width 限制 */
          @media (max-width: 1024px) {
            min-width: 0 !important;
          }
        }
        /* LOGO 图片垂直对齐 */
        .ant-pro-global-header-logo img {
          display: inline-block !important;
          vertical-align: middle !important;
          max-height: 32px !important;
          height: auto !important;
          width: auto !important;
        }
        /* LOGO 标题文字垂直对齐和颜色 - 根据顶栏背景色自动适配，浅色模式深色背景时与深色模式文字颜色一致 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header-title,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header-title,
        .ant-pro-layout-header .ant-pro-global-header-title,
        .ant-layout-header .ant-pro-global-header-title,
        .ant-pro-global-header-title {
          display: inline-flex !important;
          align-items: center !important;
          vertical-align: middle !important;
          line-height: 1.5 !important;
          height: auto !important;
          font-size: 16px !important;
          color: ${isDarkMode ? 'var(--ant-colorText)' : (isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)')} !important;
        }
        /* LOGO 容器内的链接和文字垂直对齐和颜色 - 根据顶栏背景色自动适配，浅色模式深色背景时与深色模式文字颜色一致 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header-logo a,
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header-logo span,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header-logo a,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header-logo span,
        .ant-pro-layout-header .ant-pro-global-header-logo a,
        .ant-pro-layout-header .ant-pro-global-header-logo span,
        .ant-layout-header .ant-pro-global-header-logo a,
        .ant-layout-header .ant-pro-global-header-logo span,
        .ant-pro-global-header-logo a,
        .ant-pro-global-header-logo span {
          display: inline-flex !important;
          align-items: center !important;
          vertical-align: middle !important;
          line-height: 1.5 !important;
          flex-shrink: 0 !important; // ⚠️ 防止 LOGO 组被挤压
          color: ${isDarkMode ? 'var(--ant-colorText)' : (isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)')} !important;
        }
        .ant-pro-global-header-logo img {
          flex-shrink: 0 !important; // ⚠️ 防止图片变成椭圆
          object-fit: contain !important;
        }
        /* LOGO 后标题文字（H1元素）颜色 - 根据顶栏背景色自动适配，浅色模式深色背景时与深色模式文字颜色一致 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header-logo h1,
        .ant-pro-layout .ant-pro-layout-header .ant-pro-global-header-logo a h1,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header-logo h1,
        .ant-pro-layout .ant-layout-header .ant-pro-global-header-logo a h1,
        .ant-pro-layout-header .ant-pro-global-header-logo h1,
        .ant-pro-layout-header .ant-pro-global-header-logo a h1,
        .ant-layout-header .ant-pro-global-header-logo h1,
        .ant-layout-header .ant-pro-global-header-logo a h1,
        .ant-pro-global-header-logo h1,
        .ant-pro-global-header-logo a h1 {
          color: ${isDarkMode ? 'var(--ant-colorText)' : (isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)')} !important;
          ${isEnglishLocale ? 'letter-spacing: -0.02em !important;' : ''}
        }
        .ant-pro-global-header-logo h1{
        line-height: 31px !important;
        }
        /* ==================== 顶栏布局调整 ==================== */
        /* 顶栏主容器：左侧 LOGO组 + 分割线 + 面包屑，右侧 操作按钮组 */
        .ant-pro-layout .ant-pro-layout-header,
        .ant-pro-layout .ant-layout-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 0 16px !important;
        }
        /* 顶栏左侧区域：LOGO组 + 分割线 + 面包屑 */
        .ant-pro-layout .ant-pro-layout-header > div:first-child,
        .ant-pro-layout .ant-layout-header > div:first-child {
          display: flex !important;
          align-items: center !important;
          flex: 1 !important;
          min-width: 0 !important;
          overflow: visible !important;
        }
        /* headerContentRender 容器样式 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-content,
        .ant-pro-layout .ant-layout-header .ant-pro-layout-header-content {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          flex: 1 !important;
          min-width: 0 !important;
          overflow: visible !important;
          height: 100% !important;
        }
        /* headerContentRender 容器内的分割线垂直居中 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-content .ant-divider,
        .ant-pro-layout .ant-layout-header .ant-pro-layout-header-content .ant-divider {
          align-self: center !important;
          margin: 0 !important;
          height: 32px !important;
          border-color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.25)'} !important;
        }
        /* 顶栏快捷入口触发按钮 hover */
        .riveredge-header-quick-entry-trigger:hover {
          background: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.12)'} !important;
        }
        /* ==================== 面包屑样式 ==================== */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb {
          font-size: 1em !important;
          line-height: 1.5 !important;
          display: flex !important;
          align-items: center !important;
          height: 100% !important;
          position: relative !important;
          white-space: nowrap !important;
          overflow: visible !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
          max-width: none !important;
        }
        /* 面包屑内部容器防止换行；宽度不足时横向滚动 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb ol,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb ul {
          display: flex !important;
          flex-wrap: nowrap !important;
          white-space: nowrap !important;
          overflow-x: auto !important;
          overflow-y: visible !important;
          max-width: 100% !important;
        }
        /* 面包屑项不收缩，避免只剩最后一级可见 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item {
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          overflow: visible !important;
          padding: 0 4px !important;
          line-height: 1.5 !important;
          vertical-align: middle !important;
        }
        /* 第一项左侧 padding，确保 hover 背景完整显示 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:first-child {
          padding-left: 8px !important;
          margin-left: -8px !important;
        }
        /* 最后一个面包屑项不收缩，优先显示完整，确保对齐 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:last-child {
          flex-shrink: 0 !important;
          line-height: 1.5 !important;
          vertical-align: middle !important;
        }
        /* 最后一项内部的文本和链接，确保与其他项对齐（即使加粗） */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:last-child span,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:last-child a {
          line-height: 1.5 !important;
          vertical-align: middle !important;
          display: inline-flex !important;
          align-items: center !important;
        }
        /* 面包屑分隔符防止换行 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-separator {
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
        }
        /* 面包屑内部文本防止换行 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb span,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb a {
          white-space: nowrap !important;
          display: inline-flex !important;
          align-items: center !important;
        }
        /* 面包屑链接内部的 gap - 图标和文字之间的间距 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-link span,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item span {
          gap: 4px !important;
          display: inline-flex !important;
          align-items: center !important;
        }
        /* 面包屑项内部的链接和文字对齐 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-link {
          display: inline-flex !important;
          align-items: center !important;
          padding: 4px 8px !important;
          margin: -4px -8px !important;
          border-radius: 4px !important;
        }
        /* 第一项链接的左侧 padding，确保 hover 背景完整显示 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:first-child .ant-breadcrumb-link {
          margin-left: -8px !important;
          padding-left: 8px !important;
        }
        /* 面包屑下拉箭头对齐 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item .anticon {
          display: inline-flex !important;
          align-items: center !important;
          vertical-align: middle !important;
        }
        /* 面包屑文字颜色 - 根据显示模式统一 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb span,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item span {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        /* 末级面包屑（激活项）：主题色覆盖全局颜色强制 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .riveredge-breadcrumb-active,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item .riveredge-breadcrumb-active {
          color: ${token.colorPrimary} !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb a {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        /* 完全禁用面包屑项本身的 hover 背景（包括 Ant Design 默认样式） */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:hover {
          background-color: transparent !important;
          background: transparent !important;
        }
        /* 面包屑链接 hover 样式 - 根据显示模式统一，浅色模式浅色背景无hover */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item a:hover,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item .ant-breadcrumb-link:hover {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 1)'} !important;
          background-color: ${isLightModeLightBg ? 'transparent' : 'rgba(255, 255, 255, 0.1)'} !important;
          border-radius: 4px !important;
        }
        /* 确保当链接 hover 时，父级面包屑项本身不显示背景（但允许链接显示背景） */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:hover {
          background-color: transparent !important;
        }
        /* 第一项链接 hover 时确保左侧背景完整显示 - 浅色模式浅色背景无hover */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:first-child a:hover,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:first-child .ant-breadcrumb-link:hover {
          margin-left: -8px !important;
          padding-left: 8px !important;
          background-color: ${isLightModeLightBg ? 'transparent' : 'rgba(255, 255, 255, 0.1)'} !important;
        }
        /* 面包屑分隔符颜色 - 根据显示模式统一 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-separator {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)'} !important;
        }
        /* 面包屑图标颜色 - 根据显示模式统一 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        /* 面包屑下拉菜单样式优化 - 确保完整显示 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-dropdown {
          z-index: 1050 !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-dropdown-menu {
          max-height: 400px;
          overflow-y: auto;
        }
        /* 确保 header 和面包屑容器不裁剪下拉菜单 */
        .ant-pro-layout-container .ant-layout-header {
          overflow: visible !important;
        }
        .ant-pro-layout-container .ant-pro-layout-header {
          overflow: visible !important;
        }
        /* 面包屑下拉菜单样式优化 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-dropdown {
          z-index: 1050 !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-dropdown-menu {
          max-height: 400px;
          overflow-y: auto;
        }
        /* 确保面包屑容器不裁剪下拉菜单 */
        .ant-pro-layout-container .ant-layout-header {
          overflow: visible !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb {
          overflow: visible !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb ol,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb ul {
          overflow: visible !important;
        }
        /* 平板和手机模式下顶栏圆形按键/头像保持正圆，防止被 flex 拉伸变形 */
        @media (max-width: 991.98px) {
          .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions,
          .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions {
            align-items: center !important;
          }
          .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-space-item,
          .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions .ant-space-item {
            align-self: center !important;
            flex-shrink: 0 !important;
          }
          .ant-pro-layout .ant-pro-layout-header .ant-btn,
          .ant-pro-layout .ant-layout-header .ant-btn {
            min-height: 32px !important;
            max-height: 32px !important;
            flex-shrink: 0 !important;
            align-self: center !important;
          }
          .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn,
          .ant-pro-layout .ant-layout-header .ant-badge .ant-btn {
            min-width: 32px !important;
            max-width: 32px !important;
            min-height: 32px !important;
            max-height: 32px !important;
            flex-shrink: 0 !important;
          }
          .ant-pro-layout .ant-pro-layout-header .ant-btn .ant-avatar,
          .ant-pro-layout .ant-layout-header .ant-btn .ant-avatar,
          .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-avatar,
          .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions .ant-avatar {
            flex-shrink: 0 !important;
          }
          .ant-pro-layout .ant-pro-layout-header .ant-pro-layout-header-actions .ant-dropdown-trigger,
          .ant-pro-layout .ant-layout-header .ant-pro-layout-header-actions .ant-dropdown-trigger {
            align-self: center !important;
            height: auto !important;
          }
        }
        /* 平板和手机模式下隐藏面包屑 - 放在最后，确保最高优先级 */
        @media (max-width: 1024px) {
          .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
          .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb,
          body .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
          body .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
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
          const dividerColor = isDarkSiderFooter
            ? 'rgba(255, 255, 255, 0.15)'
            : 'rgba(0, 0, 0, 0.12)';
          const settingsBtnBg = startMenuTheme.settingsBtnBg;
          const settingsBtnBorder = startMenuTheme.settingsBtnBorder;
          const settingsAccentColor = startMenuTheme.settingsBtnColor;
          const collapseBtnBg = String(siderFooterToken.colorFillSecondary);
          const collapseBtnBorder = String(siderFooterToken.colorSplit);
          const collapseChromeColor = siderTextColor;

          return (
            <div
              style={{
                padding: '8px',
                borderTop: `1px solid ${dividerColor}`,
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
        // 验证方案3：同时使用 collapsed + siderWidth + menuRender
        // 全屏时：collapsed={true} + siderWidth={0} + menuRender={() => null} 完全隐藏侧边栏
        // 退出全屏时：恢复所有 props，确保 ProLayout 重新计算布局
        collapsed={isFullscreen ? true : collapsed}
        onCollapse={isFullscreen ? undefined : handleSetCollapsed}
        location={location}
        siderWidth={isFullscreen ? 0 : undefined}
        // 全屏时：不渲染菜单，确保折叠的侧边栏也不占据空间
        menuRender={isFullscreen ? () => null : undefined}
        // 侧栏顶部固定搜索框：总高 38px，输入框 34px、上下各 2px，胶囊圆角 50%，简短文案，拟物按键提示
        menuExtraRender={isFullscreen || collapsed ? undefined : () => {
          // 与侧栏底部分割线一致（深色底栏统一用 isDarkSiderFooter）
          const sidebarSearchBottomBorder = isDarkSiderFooter
            ? 'rgba(255, 255, 255, 0.15)'
            : 'rgba(0, 0, 0, 0.12)';
          return (
          <div
            className="riveredge-sidebar-search-wrapper"
            style={{
              flexShrink: 0,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              margin: '-13px 0 0 0',
              padding: '2px 0 4px 0',
              borderBottom: `1px solid ${sidebarSearchBottomBorder}`,
            }}
          >
            <TopBarSearch
              menuData={filteredMenuData}
              hotMenuPaths={TOPBAR_SEARCH_HOT_MENU_PATHS}
              isLightModeLightBg={siderTextColor !== '#ffffff'}
              token={token}
              placeholder={t('common.searchPlaceholderShort')}
              inputHeight={34}
              borderRadius={17}
              shortcutKey="/"
              transparentBg
            />
          </div>
          );
        }}
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
                        <span className={index === generateBreadcrumb.length - 1 ? 'riveredge-breadcrumb-active' : undefined} style={{ color: index === 0 ? 'var(--ant-colorTextSecondary)' : 'var(--ant-colorText)', fontWeight: 400, lineHeight: '1.5', verticalAlign: 'middle' }}>{item.title}</span>
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
            <Tooltip key="aiAssistant" title={t('ui.aiAssistant.tooltip')}>
            <span className="ai-assistant-lottie-btn-wrapper">
              <span
                role="button"
                tabIndex={0}
                onClick={() => setAiAssistantOpen(true)}
                onKeyDown={(e) => e.key === 'Enter' && setAiAssistantOpen(true)}
                className="ai-assistant-lottie-btn"
              >
                <Lottie
                  animationData={assistAnimation}
                  loop
                  autoplay
                  style={{
                    width: 52,
                    height: 52,
                    display: 'block',
                    ...( !isLightModeLightBg ? {
                      filter: 'brightness(2) contrast(1.2) drop-shadow(0 0 6px rgba(255, 255, 255, 0.5)) drop-shadow(0 0 16px rgba(255, 255, 255, 0.25))'
                    } : {})
                  }}
                />
              </span>
            </span>
            </Tooltip>
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
                    background: isLightModeLightBg ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.1)',
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
        menuProps={{
          mode: 'inline',
          // openKeys / onOpenChange 交由 ProLayout BaseMenu 原生管理：路由变化时按 matchMenuKeys 自动收起其它分组（autoClose 默认开启）
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
          // 如果是应用级菜单的分组标题（只有应用级菜单才需要特殊处理）
          // 系统级菜单的分组标题（type: 'group'）由 Ant Design Menu 原生处理，不需要自定义渲染
          // 检查条件：path 以 #app-group- 开头，或者有 menu-group-title-app className
          if (item.className && (item.className.includes('menu-group-title-app') || item.className.includes('app-menu-container-start'))) {
            // 应用名唯一来源：仅用 locale 的 app.${appCode}.name，与 useUnifiedMenuData 一致
            const firstChildPath = item.children?.[0]?.path;
            const fallback = item.name || item.label || '';
            const appCode = firstChildPath ? extractAppCodeFromPath(firstChildPath) : null;
            const groupTitle = appCode ? getAppDisplayName(appCode, t, fallback) : fallback;

            return (
              <div
                className="menu-group-title-app"
                style={{
                  fontSize: '12px',
                  color: 'var(--ant-colorPrimary)',
                  fontWeight: 500,
                  padding: '0', // 减小上下 padding
                  margin: 0,
                  lineHeight: '1.2',
                  height: '16px',
                  minHeight: '16px',
                  maxHeight: '16px',
                  cursor: 'default',
                  userSelect: 'none',
                  pointerEvents: 'none',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  // 阻止hover效果传播到父元素
                  e.stopPropagation();
                  const parent = e.currentTarget.closest('.ant-menu-item') as HTMLElement;
                  if (parent) {
                    parent.style.backgroundColor = 'transparent';
                  }
                }}
                onMouseLeave={(e) => {
                  const parent = e.currentTarget.closest('.ant-menu-item') as HTMLElement;
                  if (parent) {
                    parent.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {groupTitle}
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

            // 左侧菜单小徽标：仅业务单据显示未完成数量
            const badgeKey = getMenuBadgeKey(path);
            const badgeData = (badgeKey ? menuBadgeCounts[badgeKey] : null) as any;

            let badgeEl: React.ReactNode = null;
            if (badgeData) {
              if (typeof badgeData === 'number' && badgeData > 0) {
                // 传统形式：仅数字，默认红色（antd Badge 默认）
                badgeEl = <Badge count={badgeData} size="small" className="menu-item-badge-count" />;
              } else if (typeof badgeData === 'object') {
                // 拟物化分类徽标，优先级：逾期 (red) > 待审核 (orange) > 进行中 (green)
                if (badgeData.overdue > 0) {
                  badgeEl = <Badge count={badgeData.overdue} size="small" color="#f5222d" className="menu-item-badge-count" />;
                } else if (badgeData.pending > 0) {
                  badgeEl = <Badge count={badgeData.pending} size="small" color="#fa8c16" className="menu-item-badge-count" />;
                } else if (badgeData.in_progress > 0) {
                  badgeEl = <Badge count={badgeData.in_progress} size="small" color="#52c41a" className="menu-item-badge-count" />;
                }
              }
            }

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
                        (m) => m.prefetchDefaultWorkOrderList(queryClient, 20)
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
              <Button
                type="text"
                size="small"
                className="riveredge-system-settings-panel-close"
                onClick={closeSystemSettingsPanelAnimated}
                title={t('common.close')}
                aria-label={t('common.close')}
                icon={<CloseOutlined />}
              />
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
                  <div className="riveredge-system-settings-group-title">{group.name as React.ReactNode}</div>
                  <div className="riveredge-system-settings-group">
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

      {/* AI 助手：挂载后保持实例，避免路由切换重复检测 DeepSeek 状态 */}
      {aiAssistantMountedRef.current && (
        <AiAssistant
          open={aiAssistantOpen}
          onClose={() => setAiAssistantOpen(false)}
        />
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
