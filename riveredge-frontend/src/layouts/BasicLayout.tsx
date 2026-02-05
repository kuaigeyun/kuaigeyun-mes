/**
 * RiverEdge SaaS 多组织框架 - 基础布局组件
 * 
 * 使用 ProLayout 实现现代化页面布局，集成状态管理和权限控制
 */

import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Spin, theme } from 'antd';
import type { MenuDataItem } from '@ant-design/pro-components';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  ApartmentOutlined,
  CrownOutlined,
  LogoutOutlined,
  UserSwitchOutlined,
  SettingOutlined,
  MonitorOutlined,
  AppstoreOutlined,
  ControlOutlined,
  ShopOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  GlobalOutlined,
  TranslationOutlined,
  BgColorsOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  LockOutlined,
  SearchOutlined,
  BellOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  PrinterOutlined,
  HistoryOutlined,
  LoginOutlined,
  UnorderedListOutlined,
  CalendarOutlined,
  PlayCircleOutlined,
  InboxOutlined,
  SafetyOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { message, Button, Tooltip, Badge, Avatar, Dropdown, Space, Input, Breadcrumb, List, Typography, Empty, Divider } from 'antd';
import type { MenuProps } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RightOutlined, CheckOutlined } from '@ant-design/icons';
import { translateMenuName, translatePathTitle, translateAppMenuName, translateAppMenuItemName, extractAppCodeFromPath, findMenuTitleWithTranslation } from '../utils/menuTranslation';
import dayjs from 'dayjs';
import { getUserMessageStats, getUserMessages, markMessagesRead, type UserMessage } from '../services/userMessage';

// 安全的翻译 hook，避免多语言初始化失败导致应用崩溃
const useSafeTranslation = () => {
  try {
    return useTranslation();
  } catch (error) {
    console.warn('i18n initialization failed, using fallback:', error);
    // 返回一个基本的翻译函数作为后备
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
import { MobileQRCode } from '../components/mobile-preview';
import ThemeEditor from '../components/theme-editor';
import { getCurrentUser } from '../services/auth';
import { getCurrentInfraSuperAdmin } from '../services/infraAdmin';
import { getToken, clearAuth, getUserInfo, getTenantId } from '../utils/auth';
import { useGlobalStore } from '../stores';
import { getLanguageList, Language } from '../services/language';
import { updateUserPreference } from '../services/userPreference';
import { LANGUAGE_MAP } from '../config/i18n';
import i18n, { refreshTranslations } from '../config/i18n';
import { getMenuTree, MenuTree } from '../services/menu';
import { ManufacturingIcons } from '../utils/manufacturingIcons';
import * as LucideIcons from 'lucide-react'; // 全量导入 Lucide Icons，支持动态访问所有图标
import { getAvatarUrl, getAvatarText, getAvatarFontSize } from '../utils/avatar';
import { getSiteSetting } from '../services/siteSetting';
import { getFilePreview } from '../services/file';

// 权限守卫组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { currentUser, loading, setCurrentUser, setLoading } = useGlobalStore();
  const { t } = useSafeTranslation(); // 使用安全的翻译 hook

  // 检查用户类型（平台超级管理员还是系统级用户）
  const userInfo = getUserInfo();
  const isInfraSuperAdmin = userInfo?.user_type === 'infra_superadmin';

  // 检查是否访问系统级页面
  const isSystemPage = location.pathname.startsWith('/system/');
  const currentTenantId = getTenantId();

  // 如果是平台超级管理员访问系统级页面，但没有选择组织，则重定向到平台首页
  if (isInfraSuperAdmin && isSystemPage && !currentTenantId) {
    message.warning(t('common.selectOrganizationFirst', { defaultValue: '请先选择要管理的组织' }));
    // 重定向到infra登录页
    return <Navigate to="/infra/login" replace />;
  }

  // 如果 currentUser 已存在且信息完整，不需要重新获取
  // 只有在以下情况才需要获取用户信息：
  // 1. 有 token 但没有 currentUser
  // 注意：避免在 currentUser 已存在时重复获取，防止无限循环
  const shouldFetchUser = !!getToken() && !currentUser;

  // 根据用户类型调用不同的接口
  const { data: userData, isLoading, error } = useQuery({
    queryKey: ['currentUser', isInfraSuperAdmin],
    queryFn: async () => {
      // 优先使用 userInfo 判断用户类型
      const shouldUsePlatformAPI = isInfraSuperAdmin;

      if (shouldUsePlatformAPI) {
        // 平台超级管理员：调用平台接口
        const infraUser = await getCurrentInfraSuperAdmin();
        return {
          id: infraUser.id,
          username: infraUser.username,
          email: infraUser.email,
          full_name: infraUser.full_name,
          is_infra_admin: true, // 平台超级管理员始终是平台管理
          is_tenant_admin: false,
          tenant_id: undefined,
        };
      } else {
        // 系统级用户：调用系统接口
        return await getCurrentUser();
      }
    },
    enabled: shouldFetchUser,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5分钟内不重新获取
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
          is_infra_admin: savedUserInfo.user_type === 'infra_superadmin' || savedUserInfo.is_infra_admin || false,
          is_tenant_admin: savedUserInfo.is_tenant_admin || false,
          tenant_id: savedUserInfo.tenant_id,
        };
        setCurrentUser(restoredUser);

        // 如果是平台超级管理员，但后端接口失败，记录警告但不阻止访问
        if (savedUserInfo.user_type === 'infra_superadmin') {
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

  React.useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // 公开页面（登录页面包含注册功能，通过 Drawer 实现）
  const publicPaths = ['/login', '/debug/'];
  // 平台登录页是公开的，但其他平台页面需要登录
  const isInfraLoginPage = location.pathname === '/infra/login';
  const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path)) || isInfraLoginPage;

  // ⚠️ 关键修复：如果是调试页面，直接渲染内容，不受加载状态影响
  if (location.pathname.startsWith('/debug/')) {
    return <>{children}</>;
  }

  // 如果正在加载，显示加载状态
  if (loading || isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // ⚠️ 关键修复：如果有 token 但 currentUser 不存在，且正在获取用户信息，等待加载完成
  // 避免在数据加载过程中误判为未登录
  if (getToken() && !currentUser && shouldFetchUser) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // 如果是公开页面且已登录，根据用户类型重定向
  if (isPublicPath && currentUser) {
    // 平台超管登录后，如果访问的是登录页，重定向到平台运营看板
    if (isInfraLoginPage && currentUser.is_infra_admin) {
      return <Navigate to="/infra/operation" replace />;
    }
    // 普通用户登录后，如果访问的是登录页，重定向到系统仪表盘工作台
    if (location.pathname === '/login' && !currentUser.is_infra_admin) {
      return <Navigate to="/system/dashboard/workplace" replace />;
    }
  }

  // 如果不是公开页面且未登录，自动重定向到登录页
  if (!isPublicPath && !currentUser && !getToken()) {
    // infra级路由重定向到infra登录页
    if (location.pathname.startsWith('/infra')) {
      return <Navigate to="/infra/login" replace />;
    }
    // 系统级路由重定向到用户登录页
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
  // 路径映射作为主要方式，名称映射作为后备方案（为了向后兼容）

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
      '/system/users': ManufacturingIcons.users, // 用户管理 - 使用用户组图标
      '/system/applications': ManufacturingIcons.factory, // 应用中心 - 使用工厂图标
      '/system/menus': ManufacturingIcons.checklist, // 菜单管理 - 使用清单图标
      '/system/site-settings': ManufacturingIcons.mdSettings, // 站点设置 - 使用设置图标
      '/system/business-config': ManufacturingIcons.systemConfig, // 业务配置 - 使用系统配置图标
      '/system/system-parameters': ManufacturingIcons.mdConfiguration, // 系统参数 - 使用配置图标
      '/system/data-dictionaries': ManufacturingIcons.bookOpen, // 数据字典 - 使用打开的书本图标
      '/system/code-rules': ManufacturingIcons.code, // 编码规则 - 使用代码图标
      '/system/integration-configs': ManufacturingIcons.network, // 数据连接 - 使用网络图标
      '/system/languages': ManufacturingIcons.languages, // 语言管理 - 使用语言图标
      '/system/custom-fields': ManufacturingIcons.toolbox, // 自定义字段 - 使用工具箱图标
      '/system/files': ManufacturingIcons.folder, // 文件管理 - 使用文件夹图标
      '/system/apis': ManufacturingIcons.api, // API管理 - 使用API图标
      '/system/data-sources': ManufacturingIcons.database, // 数据源 - 使用数据库图标
      '/system/datasets': ManufacturingIcons.inventory, // 数据集 - 使用库存图标
      '/system/messages/config': ManufacturingIcons.bell, // 消息配置 - 使用铃铛图标
      '/system/messages/template': ManufacturingIcons.fileText, // 消息模板 - 使用文件文本图标
      '/system/scheduled-tasks': ManufacturingIcons.clock, // 定时任务 - 使用时钟图标
      '/system/approval-processes': ManufacturingIcons.workflow, // 审批流程 - 使用工作流图标
      '/system/approval-instances': ManufacturingIcons.checkCircle, // 审批实例 - 使用检查圆圈图标
      '/system/scripts': ManufacturingIcons.fileCode, // 脚本管理 - 使用代码文件图标
      '/system/print-templates': ManufacturingIcons.fileText, // 打印模板 - 使用文件文本图标
      '/system/print-devices': ManufacturingIcons.printer, // 打印设备 - 使用打印机图标
      '/personal': ManufacturingIcons.userCircle, // 个人中心 - 使用用户圆圈图标
      '/personal/profile': ManufacturingIcons.user, // 个人资料 - 使用用户图标
      '/personal/preferences': ManufacturingIcons.mdSettings, // 偏好设置 - 使用设置图标
      '/personal/messages': ManufacturingIcons.bell, // 我的消息 - 使用铃铛图标
      '/personal/tasks': ManufacturingIcons.checklist, // 我的任务 - 使用清单图标
      '/system/operation-logs': ManufacturingIcons.history, // 操作日志 - 使用历史图标
      '/system/login-logs': ManufacturingIcons.logIn, // 登录日志 - 使用登录图标
      '/system/online-users': ManufacturingIcons.users, // 在线用户 - 使用用户组图标
      '/system/data-backups': ManufacturingIcons.hardDrive, // 数据备份 - 使用硬盘图标
      '/infra/operation': ManufacturingIcons.analytics, // 运营中心 - 使用分析图标
      '/infra/tenants': ManufacturingIcons.building, // 租户管理 - 使用建筑图标（保持）
      '/infra/packages': ManufacturingIcons.package, // 应用包管理 - 使用包裹图标
      '/infra/monitoring': ManufacturingIcons.monitor, // 系统监控 - 使用显示器图标
      '/infra/inngest': ManufacturingIcons.workflow, // Inngest工作流 - 使用工作流图标
      '/infra/admin': ManufacturingIcons.shield, // 平台管理 - 使用盾牌图标

      // 应用菜单路径图标映射（使用前缀匹配，支持 /apps/{app-code}/... 格式）
      '/apps/kuaizhizao/plan-management': ManufacturingIcons.calendar, // 计划管理 - 使用日历图标
      '/apps/kuaizhizao/production-execution': ManufacturingIcons.activity, // 生产执行 - 使用活动/执行图标
      '/apps/kuaizhizao/purchase-management': ManufacturingIcons.shoppingBag, // 采购管理 - 使用购物袋图标
      '/apps/kuaizhizao/sales-management': ManufacturingIcons.chartLine, // 销售管理 - 使用趋势上升图标（销售增长）
      '/apps/kuaizhizao/warehouse-management': ManufacturingIcons.warehouse, // 仓储管理 - 使用仓库图标
      '/apps/kuaizhizao/quality-management': ManufacturingIcons.quality, // 质量管理 - 使用质量图标
      '/apps/kuaizhizao/cost-management': ManufacturingIcons.calculator, // 成本管理 - 使用计算器图标
      '/apps/kuaizhizao/equipment-management': ManufacturingIcons.machine, // 设备管理 - 使用机器图标
      '/apps/kuaizhizao/finance-management': ManufacturingIcons.wallet, // 财务管理 - 使用钱包图标
      '/apps/kuaizhizao/reports': ManufacturingIcons.analytics, // 报表分析 - 使用分析图标
      '/apps/master-data': ManufacturingIcons.database, // 基础数据管理 - 使用数据库图标
      '/apps/master-data/warehouse': ManufacturingIcons.archive, // 基础数据管理-仓库数据 - 使用归档图标（区别于仓储管理）
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

  // 名称映射（后备方案，为了向后兼容，支持中英文）
  // 注意：由于菜单名称可能已翻译，这里作为最后的后备方案
  const nameMap: Record<string, React.ComponentType<any>> = {
    // 常见的中文和英文名称映射（保留作为后备）
    'Dashboard': ManufacturingIcons.industrialDashboard,
    'Workplace': ManufacturingIcons.production,
    'Analysis': ManufacturingIcons.chartLine,
    'Operations Dashboard': ManufacturingIcons.analytics,
    'Operations Center': ManufacturingIcons.operationsCenter,
    'User Management': ManufacturingIcons.users, // 用户管理 - 使用用户组图标
    'System Configuration': ManufacturingIcons.systemConfig,
    'Personal Center': ManufacturingIcons.userCircle, // 个人中心 - 使用用户圆圈图标
    // 应用菜单名称映射（后备方案）
    'Plan Management': ManufacturingIcons.calendar,
    'Production Execution': ManufacturingIcons.activity, // 生产执行 - 使用活动/执行图标
    'Purchase Management': ManufacturingIcons.shoppingBag,
    'Sales Management': ManufacturingIcons.chartLine, // 销售管理 - 使用趋势上升图标（销售增长）
    'Warehouse Management': ManufacturingIcons.warehouse,
    'Quality Management': ManufacturingIcons.quality,
    'Cost Management': ManufacturingIcons.calculator,
    'Equipment Management': ManufacturingIcons.machine,
    'Finance Management': ManufacturingIcons.wallet, // 财务管理 - 使用钱包图标
    // 基础数据管理相关
    '仓库数据': ManufacturingIcons.archive, // 基础数据管理-仓库数据 - 使用归档图标
    'Warehouse Data': ManufacturingIcons.archive, // 基础数据管理-仓库数据（英文）
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
 * 菜单配置函数
 *
 * 按照菜单分组架构设计：
 * 【第一组】固定仪表盘 - 平台级、系统级、应用级都可见
 * 【第二组】应用菜单（插件式加载）- 根据用户权限和已安装插件动态加载
 * 【第三组】系统配置 - 平台级、系统级、应用级可见
 *   └─ 用户管理（分组标题，不可点击）
 *      ├─ 角色权限管理（第1优先级，包含角色和权限管理）
 *      ├─ 部门管理（第2优先级）
 *      ├─ 职位管理（第3优先级）
 *      └─ 账户管理（第4优先级）
 * 【第四组】运营中心 - 仅平台级管理员可见
 * 
 * @param t - i18n 翻译函数
 * @returns 菜单配置数组
 */
const getMenuConfig = (t: (key: string) => string): MenuDataItem[] => [
  // ==================== 【第一组】固定仪表盘 ====================
  // 可见范围：平台级、系统级、应用级 都可见
  {
    path: '/system/dashboard',
    name: t('menu.dashboard'),
    icon: getMenuIcon(t('menu.dashboard'), '/system/dashboard'),
    children: [
      {
        path: '/system/dashboard/workplace',
        name: t('menu.dashboard.workplace'),
        icon: getMenuIcon(t('menu.dashboard.workplace'), '/system/dashboard/workplace'),
      },
      {
        path: '/system/dashboard/analysis',
        name: t('menu.dashboard.analysis'),
        icon: getMenuIcon(t('menu.dashboard.analysis'), '/system/dashboard/analysis'),
      },
    ],
  },

  // ==================== 【第二组】应用菜单（插件式加载） ====================
  // 可见范围：根据用户权限和已安装插件动态加载
  // 注意：插件式的菜单按分组菜单设计，应用的名称作为分组名，不可点击，只显示
  // 插件里的菜单直接显示到左侧菜单
  // TODO: 后续从插件系统动态加载应用菜单
  // 占位的 MES 菜单已移除

  // ==================== 【第三组】系统菜单 ====================
  // 可见范围：平台级、系统级、应用级 可见
  // 注意：组织管理已移除，组织管理在平台级运营中心进行管理
  {
    path: '/system',
    name: t('menu.system'),
    icon: getMenuIcon(t('menu.system'), '/system'),
    children: [
      // 用户管理分组标题（使用 Ant Design Menu 的 type: 'group'）
      {
        key: 'user-management-group',
        type: 'group',
        name: t('menu.group.user-management'),  // ProLayout 使用 name，但 type: 'group' 会传递给 Ant Design Menu 作为 label
        label: t('menu.group.user-management'),  // 同时提供 label 以确保 Ant Design Menu 能正确显示
        className: 'riveredge-menu-group-title',  // 自定义 className，用于专门设置样式
        children: [
          // 按照系统级功能建设计划第一阶段顺序排序的用户管理功能
          {
            path: '/system/roles',
            name: t('menu.system.roles-permissions'),
            icon: getMenuIcon(t('menu.system.roles-permissions'), '/system/roles'),
          },
          {
            path: '/system/departments',
            name: t('menu.system.departments'),
            icon: getMenuIcon(t('menu.system.departments'), '/system/departments'),
          },
          {
            path: '/system/positions',
            name: t('menu.system.positions'),
            icon: getMenuIcon(t('menu.system.positions'), '/system/positions'),
          },
          {
            path: '/system/users',
            name: t('menu.system.users'),
            icon: getMenuIcon(t('menu.system.users'), '/system/users'),
          },
        ],
      },
      // 核心配置分组标题
      {
        key: 'core-config-group',
        type: 'group',
        name: t('menu.group.core-config'),
        label: t('menu.group.core-config'),
        className: 'riveredge-menu-group-title',
        children: [
          {
            path: '/system/applications',
            name: t('menu.system.applications'),
            icon: getMenuIcon(t('menu.system.applications'), '/system/applications'),
          },
          {
            path: '/system/menus',
            name: t('menu.system.menus'),
            icon: getMenuIcon(t('menu.system.menus'), '/system/menus'),
          },
          {
            path: '/system/site-settings',
            name: t('menu.system.site-settings'),
            icon: getMenuIcon(t('menu.system.site-settings'), '/system/site-settings'),
          },
          {
            path: '/system/business-config',
            name: t('menu.system.business-config'),
            icon: getMenuIcon(t('menu.system.business-config'), '/system/business-config'),
          },
          {
            path: '/system/system-parameters',
            name: t('menu.system.system-parameters'),
            icon: getMenuIcon(t('menu.system.system-parameters'), '/system/system-parameters'),
          },
          {
            path: '/system/data-dictionaries',
            name: t('menu.system.data-dictionaries'),
            icon: getMenuIcon(t('menu.system.data-dictionaries'), '/system/data-dictionaries'),
          },
          {
            path: '/system/code-rules',
            name: t('menu.system.code-rules'),
            icon: getMenuIcon(t('menu.system.code-rules'), '/system/code-rules'),
          },
          {
            path: '/system/integration-configs',
            name: t('menu.system.integration-configs'),
            icon: getMenuIcon(t('menu.system.integration-configs'), '/system/integration-configs'),
          },
          {
            path: '/system/languages',
            name: t('menu.system.languages'),
            icon: getMenuIcon(t('menu.system.languages'), '/system/languages'),
          },
          {
            path: '/system/custom-fields',
            name: t('menu.system.custom-fields'),
            icon: getMenuIcon(t('menu.system.custom-fields'), '/system/custom-fields'),
          },
        ],
      },
      // 数据中心分组标题
      {
        key: 'data-center-group',
        type: 'group',
        name: t('menu.group.data-center'),
        label: t('menu.group.data-center'),
        className: 'riveredge-menu-group-title',
        children: [
          {
            path: '/system/files',
            name: t('menu.system.files'),
            icon: getMenuIcon(t('menu.system.files'), '/system/files'),
          },
          {
            path: '/system/apis',
            name: t('menu.system.apis'),
            icon: getMenuIcon(t('menu.system.apis'), '/system/apis'),
          },
          {
            path: '/system/data-sources',
            name: t('menu.system.data-sources'),
            icon: getMenuIcon(t('menu.system.data-sources'), '/system/data-sources'),
          },
          {
            path: '/system/datasets',
            name: t('menu.system.datasets'),
            icon: getMenuIcon(t('menu.system.datasets'), '/system/datasets'),
          },
        ],
      },
      // 流程管理分组标题
      {
        key: 'process-management-group',
        type: 'group',
        name: t('menu.group.process-management'),
        label: t('menu.group.process-management'),
        className: 'riveredge-menu-group-title',
        children: [
          {
            path: '/system/messages/config',
            name: t('menu.system.messages.config'),
            icon: getMenuIcon(t('menu.system.messages.config'), '/system/messages/config'),
          },
          {
            path: '/system/messages/template',
            name: t('menu.system.messages.template'),
            icon: getMenuIcon(t('menu.system.messages.template'), '/system/messages/template'),
          },
          {
            path: '/system/scheduled-tasks',
            name: t('menu.system.scheduled-tasks'),
            icon: getMenuIcon(t('menu.system.scheduled-tasks'), '/system/scheduled-tasks'),
          },
          {
            path: '/system/approval-processes',
            name: t('menu.system.approval-processes'),
            icon: getMenuIcon(t('menu.system.approval-processes'), '/system/approval-processes'),
          },
          {
            path: '/system/approval-instances',
            name: t('menu.system.approval-instances'),
            icon: getMenuIcon(t('menu.system.approval-instances'), '/system/approval-instances'),
          },
          {
            path: '/system/scripts',
            name: t('menu.system.scripts'),
            icon: getMenuIcon(t('menu.system.scripts'), '/system/scripts'),
          },
          {
            path: '/system/print-templates',
            name: t('menu.system.print-templates'),
            icon: getMenuIcon(t('menu.system.print-templates'), '/system/print-templates'),
          },
          {
            path: '/system/print-devices',
            name: t('menu.system.print-devices'),
            icon: getMenuIcon(t('menu.system.print-devices'), '/system/print-devices'),
          },
        ],
      },
      {
        path: '/personal',
        name: t('menu.personal'),
        icon: getMenuIcon(t('menu.personal'), '/personal'),
        children: [
          {
            path: '/personal/profile',
            name: t('menu.personal.profile'),
            icon: getMenuIcon(t('menu.personal.profile'), '/personal/profile'),
          },
          {
            path: '/personal/preferences',
            name: t('menu.personal.preferences'),
            icon: getMenuIcon(t('menu.personal.preferences'), '/personal/preferences'),
          },
          {
            path: '/personal/messages',
            name: t('menu.personal.messages'),
            icon: getMenuIcon(t('menu.personal.messages'), '/personal/messages'),
          },
          {
            path: '/personal/tasks',
            name: t('menu.personal.tasks'),
            icon: getMenuIcon(t('menu.personal.tasks'), '/personal/tasks'),
          },
        ],
      },
      // 监控运维分组标题
      {
        key: 'monitoring-ops-group',
        type: 'group',
        name: t('menu.group.monitoring-ops'),
        label: t('menu.group.monitoring-ops'),
        className: 'riveredge-menu-group-title',
        children: [
          {
            path: '/system/operation-logs',
            name: t('menu.system.operation-logs'),
            icon: getMenuIcon(t('menu.system.operation-logs'), '/system/operation-logs'),
          },
          {
            path: '/system/login-logs',
            name: t('menu.system.login-logs'),
            icon: getMenuIcon(t('menu.system.login-logs'), '/system/login-logs'),
          },
          {
            path: '/system/online-users',
            name: t('menu.system.online-users'),
            icon: getMenuIcon(t('menu.system.online-users'), '/system/online-users'),
          },
          {
            path: '/system/data-backups',
            name: t('menu.system.data-backups'),
            icon: getMenuIcon(t('menu.system.data-backups'), '/system/data-backups'),
          },
        ],
      },
    ],
  },

  // ==================== 【第四组】运营中心 ====================
  // 可见范围：仅平台级管理员可见
  {
    // 父菜单不设置 path，避免与子菜单路径冲突
    name: t('menu.infra'),
    icon: getMenuIcon(t('menu.infra'), '/infra/operation'),
    children: [
      {
        path: '/infra/operation',
        name: t('menu.infra.operation'),
        icon: getMenuIcon(t('menu.infra.operation'), '/infra/operation'),
      },
      {
        path: '/infra/tenants',
        name: t('menu.infra.tenants'),
        icon: getMenuIcon(t('menu.infra.tenants'), '/infra/tenants'),
      },
      {
        path: '/infra/packages',
        name: t('menu.infra.packages'),
        icon: getMenuIcon(t('menu.infra.packages'), '/infra/packages'),
      },
      {
        path: '/infra/monitoring',
        name: t('menu.infra.monitoring'),
        icon: getMenuIcon(t('menu.infra.monitoring'), '/infra/monitoring'),
      },
      {
        path: '/infra/inngest',
        name: t('menu.infra.inngest'),
        icon: getMenuIcon(t('menu.infra.inngest'), '/infra/inngest'),
      },
      {
        path: '/infra/admin',
        name: t('menu.infra.admin'),
        icon: getMenuIcon(t('menu.infra.admin'), '/infra/admin'),
      },
    ],
  },
];

/**
 * 用户菜单项
 */

/**
 * 基础布局组件
 */
export default function BasicLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken(); // 获取主题 token
  const { i18n: i18nInstance, t } = useSafeTranslation(); // 获取 i18n 实例和翻译函数（安全的）
  const [collapsed, setCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [techStackModalOpen, setTechStackModalOpen] = useState(false);
  const [themeEditorOpen, setThemeEditorOpen] = useState(false);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [breadcrumbVisible, setBreadcrumbVisible] = useState(true);
  const [userOpenKeys, setUserOpenKeys] = useState<string[]>([]); // 用户手动展开的菜单 key
  const [userClosedKeys, setUserClosedKeys] = useState<string[]>([]); // 用户手动收起的菜单 key
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const { currentUser, logout, isLocked, lockScreen } = useGlobalStore();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  // 获取用户头像 URL（如果有 UUID）
  useEffect(() => {
    const loadAvatarUrl = async () => {
      const userInfo = getUserInfo();
      const avatarUuid = (currentUser as any)?.avatar || userInfo?.avatar;

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
            const { getUserProfile } = await import('../services/userProfile');
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

  // 获取可用语言列表
  const { data: languageListData } = useQuery({
    queryKey: ['availableLanguages'],
    queryFn: () => getLanguageList({ is_active: true }),
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });




  const queryClient = useQueryClient();

  // 获取站点设置
  // 获取站点设置
  // 优化：使用 localStorage 缓存，实现同步初始化，避免 LOGO 闪烁
  const { data: siteSetting } = useQuery({
    queryKey: ['siteSetting'],
    queryFn: async () => {
      const data = await getSiteSetting();
      // 缓存到 localStorage
      try {
        localStorage.setItem('siteSettingCache', JSON.stringify({
          data,
          timestamp: Date.now(),
        }));
      } catch (e) {
        console.warn('Failed to cache site settings', e);
      }
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
    enabled: !!currentUser, // 只在用户登录后获取
    placeholderData: () => {
      // 尝试从缓存读取，实现同步渲染
      try {
        const cachedStr = localStorage.getItem('siteSettingCache');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          // 检查有效期（例如 24 小时，或者更短，视需求而定，这里主要为了首屏不闪烁，数据新鲜度由 useQuery 保证）
          // 这里不做严格过期检查，优先展示缓存，useQuery 会在后台更新
          return cached.data;
        }
      } catch (e) {
        // ignore
      }
      return undefined;
    }
  });

  // 消息下拉菜单状态
  const [messageDropdownOpen, setMessageDropdownOpen] = useState(false);

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

  // 获取站点名称（如果未配置或为空字符串则使用默认值）
  const siteName = (siteSetting?.settings?.site_name?.trim() || '') || 'RiverEdge SaaS';

  // 获取站点LOGO（支持UUID和URL格式）
  // 获取站点LOGO（支持UUID和URL格式）
  // 优化：同步初始化 LOGO URL
  const [siteLogoUrl, setSiteLogoUrl] = useState<string>(() => {
    // 1. 尝试从站点设置缓存中获取 logo 配置
    let logoValue = '';
    try {
      // 优先看当前内存中的 siteSetting (如果已经被 placeholderData 同步初始化)
      // 如果 siteSetting 还没来得及初始化（极少情况），尝试直接读 localStorage
      if (siteSetting?.settings?.site_logo) {
        logoValue = siteSetting.settings.site_logo.trim();
      } else {
        const cachedStr = localStorage.getItem('siteSettingCache');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          if (cached.data?.settings?.site_logo) {
            logoValue = cached.data.settings.site_logo.trim();
          }
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. 如果有 logo 配置
    if (logoValue) {
      // 如果是 UUID，尝试从专门的 logo URL 缓存中读取
      if (isUUID(logoValue)) {
        try {
          const cachedLogoUrl = localStorage.getItem(`siteLogoUrlCache_${logoValue}`);
          if (cachedLogoUrl) {
            return cachedLogoUrl;
          }
        } catch (e) {
          // ignore
        }
      } else {
        // 如果是 URL，直接返回
        return logoValue;
      }
    }

    return '/img/logo.png';
  });
  const siteLogoValue = siteSetting?.settings?.site_logo?.trim() || '';

  // 处理LOGO URL（如果是UUID格式，需要通过getFilePreview获取URL）
  // 处理LOGO URL（如果是UUID格式，需要通过getFilePreview获取URL）
  useEffect(() => {
    const loadSiteLogo = async () => {
      if (!siteLogoValue) {
        setSiteLogoUrl('/img/logo.png');
        return;
      }

      // 如果是UUID格式，获取文件预览URL
      if (isUUID(siteLogoValue)) {
        // 先检查缓存，避免重复请求导致的闪烁
        const cacheKey = `siteLogoUrlCache_${siteLogoValue}`;
        const cachedUrl = localStorage.getItem(cacheKey);

        // 如果当前显示的已经是缓存的 URL，且没有强制刷新，可以暂不更新
        // 但为了确保 URL 有效性（例如签名过期），还是建议请求，但不要先重置为默认 logo
        
        try {
          const previewInfo = await getFilePreview(siteLogoValue);
          const newUrl = previewInfo.preview_url;
          setSiteLogoUrl(newUrl);
          // 缓存解析后的 URL
          localStorage.setItem(cacheKey, newUrl);
        } catch (error) {
          console.error('获取站点LOGO预览URL失败:', error);
          // 只有在没有缓存的情况下降级，避免将正确的缓存覆盖为默认图
          if (!cachedUrl) {
            setSiteLogoUrl('/img/logo.png');
          }
        }
      } else {
        // 如果是URL格式，直接使用
        setSiteLogoUrl(siteLogoValue);
      }
    };

    loadSiteLogo();
  }, [siteLogoValue]);

  const siteLogo = siteLogoUrl;

  // 监听站点设置更新事件，刷新站点设置查询
  useEffect(() => {
    const handleSiteSettingUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['siteSetting'] });
    };

    window.addEventListener('siteThemeUpdated', handleSiteSettingUpdate);
    return () => {
      window.removeEventListener('siteThemeUpdated', handleSiteSettingUpdate);
    };
  }, [queryClient]);

  // 获取应用菜单（仅获取已安装且启用的应用的菜单）
  // 优化缓存策略：使用 localStorage 缓存，避免每次刷新都重新加载
  const { data: applicationMenus, isLoading: applicationMenusLoading, refetch: refetchApplicationMenus } = useQuery({
    queryKey: ['applicationMenus'],
    queryFn: async () => {
      // 获取菜单数据
      const menuData = await getMenuTree({ is_active: true });
      // 只返回应用菜单（application_uuid 不为空）
      const appMenus = menuData.filter(menu => menu.application_uuid);

      // 更新 localStorage 缓存（包含时间戳，用于判断是否过期）
      try {
        const cacheData = {
          data: appMenus,
          timestamp: Date.now(),
          tenantId: currentUser?.tenant_id, // 添加租户ID，确保不同租户的缓存不冲突
        };
        localStorage.setItem('applicationMenusCache', JSON.stringify(cacheData));
      } catch (error) {
        // 忽略存储错误（localStorage 可能已满或被禁用）
        console.warn('保存应用菜单缓存失败:', error);
      }

      return appMenus;
    },
    enabled: !!currentUser, // 只在用户登录后加载
    staleTime: process.env.NODE_ENV === 'development' ? 30 * 1000 : 5 * 60 * 1000, // 开发环境30秒缓存，生产环境5分钟缓存
    gcTime: 10 * 60 * 1000, // 缓存保留时间10分钟
    placeholderData: () => {
      // 使用缓存数据作为占位符，避免闪烁
      try {
        const cachedStr = localStorage.getItem('applicationMenusCache');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          // 检查缓存是否过期（超过5分钟视为过期）和租户是否匹配
          const cacheAge = Date.now() - (cached.timestamp || 0);
          const isExpired = cacheAge > 5 * 60 * 1000;
          const isTenantMatch = cached.tenantId === currentUser?.tenant_id;

          if (!isExpired && isTenantMatch && cached.data) {
            return cached.data;
          }
        }
      } catch (e) {
        // ignore
      }
      return []; // Return empty array instead of undefined to match expected type
    },
    refetchInterval: false, // 不自动轮询刷新，避免菜单逐个出现
    refetchOnWindowFocus: false, // 窗口聚焦时不自动刷新（避免频繁刷新）
    refetchOnMount: (query) => {
      // 智能刷新策略：
      // 1. 如果查询从未执行过（首次启用），总是刷新
      // 2. 如果数据过期，刷新
      if (!query.state.data || query.isStale()) {
        return true;
      }

      // 如果有缓存数据且未过期，不刷新
      // 租户ID匹配检查在 useEffect 中处理，避免闭包问题
      return false;
    },
    refetchOnReconnect: true, // 网络重连时刷新
  });


  // 监听用户登录事件，清除菜单缓存并触发菜单查询（确保重新登录时获取最新菜单）
  useEffect(() => {
    const handleUserLogin = () => {
      console.log('🔄 用户登录，清除菜单缓存并触发菜单加载...');
      // 清除 localStorage 缓存
      try {
        localStorage.removeItem('applicationMenusCache');
      } catch (error) {
        // 忽略清除错误
      }
      // 清除 React Query 缓存
      queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
      // 使用 requestAnimationFrame 替代 setTimeout，减少延迟（约 16ms 而非 100ms）
      // 这样可以在下一个渲染帧执行，此时 currentUser 应该已经更新
      requestAnimationFrame(() => {
        // 使用 setTimeout 0 确保在 React 状态更新后执行
        setTimeout(() => {
          refetchApplicationMenus();
        }, 0);
      });
    };

    // 监听自定义事件（在登录页面触发）
    window.addEventListener('user-logged-in', handleUserLogin);

    return () => {
      window.removeEventListener('user-logged-in', handleUserLogin);
    };
  }, [queryClient, refetchApplicationMenus]);

  // 使用 ref 记录 previous currentUser，用于检测用户从无到有的变化
  const prevCurrentUserRef = useRef(currentUser);

  // 监听 currentUser 变化，当用户从无到有时主动触发菜单查询
  // 这解决了登录后菜单不显示的问题
  useEffect(() => {
    const prevUser = prevCurrentUserRef.current;

    // 检测用户从无到有的变化（登录场景）
    const userJustLoggedIn = !prevUser && currentUser;

    // 更新 ref
    prevCurrentUserRef.current = currentUser;

    if (userJustLoggedIn) {
      console.log('🔄 检测到用户登录（从无到有），主动触发菜单加载...');
      // 清除可能存在的旧缓存
      try {
        localStorage.removeItem('applicationMenusCache');
      } catch (error) {
        // 忽略清除错误
      }
      // 由于 currentUser 已经更新，查询应该已经启用（enabled: !!currentUser）
      // 使用 requestAnimationFrame + setTimeout 0 确保在 React 渲染周期后执行，最小化延迟
      requestAnimationFrame(() => {
        setTimeout(() => {
          refetchApplicationMenus();
        }, 0);
      });
    } else if (currentUser && !applicationMenusLoading) {
      // 如果用户已登录但没有菜单数据，尝试加载
      const hasMenuData = applicationMenus && applicationMenus.length > 0;
      if (!hasMenuData) {
        console.log('🔄 用户已登录但没有菜单数据，主动触发菜单加载...');
        refetchApplicationMenus();
      }
    }
  }, [currentUser, applicationMenus, applicationMenusLoading, refetchApplicationMenus]);

  // 监听租户ID变化，清除菜单缓存（确保切换组织时获取最新菜单）
  useEffect(() => {
    if (currentUser?.tenant_id) {
      // 检查缓存中的租户ID是否与当前租户ID匹配
      try {
        const cachedStr = localStorage.getItem('applicationMenusCache');
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          // 如果租户ID不匹配，清除缓存并重新加载
          if (cached.tenantId !== currentUser.tenant_id) {
            console.log('🔄 检测到租户ID变化，清除菜单缓存并重新加载...');
            localStorage.removeItem('applicationMenusCache');
            queryClient.invalidateQueries({ queryKey: ['applicationMenus'] });
            // 主动触发菜单查询
            refetchApplicationMenus();
          }
        }
      } catch (error) {
        // 忽略解析错误
      }
    }
  }, [currentUser?.tenant_id, queryClient, refetchApplicationMenus]);

  // 监听应用状态变更事件，主动刷新菜单
  useEffect(() => {
    const handleApplicationStatusChange = () => {
      console.log('🔄 检测到应用状态变更，刷新菜单...');
      // 清除 localStorage 缓存
      try {
        localStorage.removeItem('applicationMenusCache');
      } catch (error) {
        // 忽略清除错误
      }
      // 重新获取菜单
      refetchApplicationMenus();
    };

    // 监听自定义事件
    window.addEventListener('application-status-changed', handleApplicationStatusChange);

    return () => {
      window.removeEventListener('application-status-changed', handleApplicationStatusChange);
    };
  }, [refetchApplicationMenus]);

  /**
   * 将 MenuTree 转换为 MenuDataItem
   * 支持应用菜单的国际化翻译
   */
  const convertMenuTreeToMenuDataItem = React.useCallback((menu: MenuTree, isAppMenu: boolean = false): MenuDataItem => {
    // 处理图标：左侧菜单全部使用 Lucide 图标
    // 统一图标大小：16px
    let iconElement: React.ReactNode = undefined;

    // 优先使用 menu.icon 字段（如果存在）
    if (menu.icon) {
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
            console.warn(`图标未找到: ${menu.icon}，菜单: ${menu.name || menu.path}。提示：可以直接使用 Lucide 图标名（PascalCase），如 "Factory", "Home" 等`);
          }
        }
      }
    }

    // 如果 menu.icon 不存在或未匹配到图标，再尝试根据菜单名称和路径获取图标
    if (!iconElement) {
      if (menu.name) {
        iconElement = getMenuIcon(menu.name, menu.path);
      } else if (menu.path) {
        iconElement = getMenuIcon('', menu.path);
      }
    }

    // 如果还是没有图标，使用默认的 Lucide 图标
    if (!iconElement) {
      iconElement = React.createElement(ManufacturingIcons.dashboard, { size: 16 });
    }

    // 处理菜单名称翻译
    let menuName = menu.name;
    if (isAppMenu && menuName) {
      // 应用菜单使用应用菜单翻译函数
      // 对于分组菜单（没有path），传递子菜单以便从子菜单路径提取应用code
      menuName = translateAppMenuItemName(menuName, menu.path, t, menu.children);
    } else if (menuName) {
      // 系统菜单使用通用菜单翻译函数
      menuName = translateMenuName(menuName, t);
    }

    const menuItem: MenuDataItem = {
      path: menu.path == null ? undefined : menu.path, // 确保 path 不为 null，避免 @umijs/route-utils mergePath 报错
      name: menuName,
      icon: iconElement,
      key: menu.uuid || menu.path, // 添加 key 字段，ProLayout 需要
      // 如果菜单有子项，确保子项也有 key（应用菜单的子项也是应用菜单）
      children: menu.children && menu.children.length > 0
        ? menu.children.map(child => convertMenuTreeToMenuDataItem(child, isAppMenu))
        : undefined,
    };

    // 如果菜单没有 path，说明是分组标题，需要特殊处理
    if (!menu.path && menu.children && menu.children.length > 0) {
      // 对于有子菜单但没有 path 的菜单项，ProLayout 会将其作为分组标题处理
      // 但我们需要确保子菜单能正确显示
      menuItem.path = undefined; // 明确设置为 undefined
    }

    return menuItem;
  }, [t]); // 添加 t 作为依赖项，确保翻译函数是最新的

  // 当前语言代码
  const currentLanguage = i18nInstance.language || 'zh-CN';

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

  // 使用 Ant Design 原生方式判断是否为深色模式
  // 通过检查 token 中的背景色值来判断（深色模式下 colorBgContainer 通常是深色）
  // 更可靠的方法：检查 colorBgContainer 的亮度值
  const isDarkMode = React.useMemo(() => {
    const bgColor = token.colorBgContainer;
    const brightness = calculateColorBrightness(bgColor);
    // 如果亮度小于 128，认为是深色模式
    return brightness < 128;
  }, [token.colorBgContainer]);

  // 菜单栏背景色状态（用于响应主题更新）
  const [siderBgColorState, setSiderBgColorState] = useState<string | undefined>(() => {
    return (window as any).__RIVEREDGE_SIDER_BG_COLOR__;
  });

  // 顶栏背景色状态（用于响应主题更新）
  const [headerBgColorState, setHeaderBgColorState] = useState<string | undefined>(() => {
    return (window as any).__RIVEREDGE_HEADER_BG_COLOR__;
  });

  // 监听主题更新事件，实时更新菜单栏和顶栏背景色
  useEffect(() => {
    const handleThemeUpdate = (event?: any) => {
      // 延迟一下，确保全局变量已经更新
      setTimeout(() => {
        const customSiderBgColor = (window as any).__RIVEREDGE_SIDER_BG_COLOR__;
        const customHeaderBgColor = (window as any).__RIVEREDGE_HEADER_BG_COLOR__;
        setSiderBgColorState(customSiderBgColor);
        setHeaderBgColorState(customHeaderBgColor);

        // 固定使用 MIX 布局模式
        (window as any).__RIVEREDGE_LAYOUT_MODE__ = 'mix';
      }, 0);
    };

    window.addEventListener('siteThemeUpdated', handleThemeUpdate);
    return () => {
      window.removeEventListener('siteThemeUpdated', handleThemeUpdate);
    };
  }, []);

  // 计算菜单栏背景色和对应的文字颜色
  const siderBgColor = React.useMemo(() => {
    // 深色模式下，不使用自定义背景色，使用默认背景色
    if (isDarkMode) {
      return token.colorBgContainer;
    }
    // 浅色模式下，优先使用状态中的自定义背景色，否则使用全局变量，最后使用默认背景色
    const customBgColor = siderBgColorState || (window as any).__RIVEREDGE_SIDER_BG_COLOR__;
    return customBgColor || token.colorBgContainer;
  }, [siderBgColorState, token.colorBgContainer, isDarkMode]);

  // 计算顶栏背景色（支持透明度）
  const headerBgColor = React.useMemo(() => {
    // 深色模式下，不使用自定义背景色，使用默认背景色
    if (isDarkMode) {
      return token.colorBgContainer;
    }
    // 浅色模式下，优先使用状态中的自定义背景色，否则使用全局变量，最后使用默认背景色
    const customBgColor = headerBgColorState || (window as any).__RIVEREDGE_HEADER_BG_COLOR__;
    return customBgColor || token.colorBgContainer;
  }, [headerBgColorState, token.colorBgContainer, isDarkMode]);

  // 根据顶栏背景色计算文字颜色（参考左侧菜单栏的实现）
  const headerTextColor = React.useMemo(() => {
    // 深色模式下，使用深色模式的默认文字颜色
    if (isDarkMode) {
      return 'var(--ant-colorText)';
    }

    // 浅色模式下，检查是否有自定义背景色
    const customBgColor = headerBgColorState || (window as any).__RIVEREDGE_HEADER_BG_COLOR__;

    if (customBgColor) {
      // 如果有自定义背景色，根据背景色亮度计算文字颜色
      const brightness = calculateColorBrightness(customBgColor);
      // 如果背景色较暗（亮度 < 128），使用浅色文字；否则使用深色文字
      return brightness < 128 ? '#ffffff' : 'var(--ant-colorText)';
    } else {
      // 如果没有自定义背景色（使用默认背景色），使用默认文字颜色
      return 'var(--ant-colorText)';
    }
  }, [headerBgColorState, isDarkMode]);

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
    const customBgColor = siderBgColorState || (window as any).__RIVEREDGE_SIDER_BG_COLOR__;

    if (customBgColor) {
      // 如果有自定义背景色，根据背景色亮度计算文字颜色
      const brightness = calculateColorBrightness(customBgColor);
      // 如果背景色较暗（亮度 < 128），使用浅色文字；否则使用深色文字
      return brightness < 128 ? '#ffffff' : 'var(--ant-colorText)';
    } else {
      // 如果没有自定义背景色（使用默认背景色），按浅色背景处理，使用深色文字
      return 'var(--ant-colorText)';
    }
  }, [siderBgColorState, isDarkMode]);

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
   * 键盘快捷键：Ctrl+K / Cmd+K 聚焦搜索框
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // 聚焦搜索框
        const searchInput = document.querySelector('.ant-pro-layout-header .ant-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

    // 监听窗口大小变化
    window.addEventListener('resize', checkBreadcrumbWrap);

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver(() => {
      setTimeout(checkBreadcrumbWrap, 50);
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
      window.removeEventListener('resize', checkBreadcrumbWrap);
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

    // 使用 MutationObserver 监听 DOM 变化，确保新增的分组标题也能添加 className
    const observer = new MutationObserver(() => {
      addGroupTitleClassName();
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
      observer.disconnect();
    };
  }, [currentUser]); // 当用户或菜单数据变化时重新添加 className

  /**
   * 动态设置 LOGO 后标题文字颜色（H1元素）- 确保在浅色模式深色背景时与深色模式文字颜色一致
   */
  useEffect(() => {
    const updateLogoTitleColor = () => {
      // 计算应该使用的文字颜色
      const logoTitleColor = isDarkMode
        ? 'var(--ant-colorText)'
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

    // 使用 MutationObserver 监听 DOM 变化，确保新增的元素也能应用颜色
    const observer = new MutationObserver(() => {
      updateLogoTitleColor();
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
      observer.disconnect();
    };
  }, [isDarkMode, isLightModeLightBg]); // 当主题或背景色变化时重新设置

  // 获取翻译后的菜单配置（必须在 generateBreadcrumb 之前定义）
  const menuConfig = useMemo(() => getMenuConfig(t), [t]);


  /**
   * 根据当前路径和菜单配置生成面包屑
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
      // 防御性检查：如果 items 为空或未定义，直接返回 null
      if (!items || !Array.isArray(items) || items.length === 0) {
        return null;
      }

      for (const item of items) {
        const currentPath = [...path, item];

        // 精确匹配
        if (item.path === targetPath) {
          return currentPath;
        }

        // 子菜单递归查找
        if (item.children) {
          const found = findMenuPath(item.children, targetPath, currentPath);
          if (found) return found;
        }
      }
      return null;
    };

    // 查找父级菜单项，用于获取同级菜单
    const findParentMenu = (items: MenuDataItem[], targetPath: string, parent: MenuDataItem | null = null): { item: MenuDataItem; parent: MenuDataItem | null } | null => {
      for (const item of items) {
        if (item.path === targetPath) {
          return { item, parent };
        }
        if (item.children) {
          const found = findParentMenu(item.children, targetPath, item);
          if (found) return found;
        }
      }
      return null;
    };

    const menuPath = findMenuPath(menuConfig, location.pathname);

    // 查找菜单组下每层第一组的第一个实际菜单项（有 path 的）
    // 规则：只查找每层第一组的第一个菜单项，不遍历所有项
    const findFirstActualMenuItem = (items: MenuDataItem[] | undefined): MenuDataItem | null => {
      if (!items || !Array.isArray(items) || items.length === 0) return null;

      // 只处理第一项（第一组）
      const firstItem = items[0];

      // 如果第一项是菜单组，递归查找其子项的第一组
      if (firstItem.type === 'group' && firstItem.children) {
        return findFirstActualMenuItem(firstItem.children);
      }

      // 如果第一项是实际菜单项（有 path），返回它
      if (firstItem.path && firstItem.name) {
        return firstItem;
      }

      // 如果第一项有子项（但不是菜单组），递归查找其子项的第一组
      if (firstItem.children) {
        return findFirstActualMenuItem(firstItem.children);
      }

      return null;
    };

    if (menuPath) {
      menuPath.forEach((item, index) => {
        if (item.name && item.path) {
          // 检查是否有同级菜单（父级菜单有多个子项）
          let menu: { items: Array<{ key: string; label: string; onClick: () => void }> } | undefined;

          // 检查第一级菜单项：如果第一个子项是菜单组，找到该菜单组下的第一个实际菜单项
          let actualPath = item.path;
          if (index === 0 && item.children && item.children.length > 0) {
            const firstChild = item.children[0];
            // 如果第一个子项是菜单组，找到该菜单组下的第一个实际菜单项
            if (firstChild.type === 'group' && firstChild.children) {
              const firstMenuItem = findFirstActualMenuItem(firstChild.children);
              if (firstMenuItem && firstMenuItem.path) {
                actualPath = firstMenuItem.path;
              }
            }
          }

          if (index > 0) {
            // 获取父级菜单项
            const parentItem = menuPath[index - 1];
            if (parentItem.children && parentItem.children.length > 1) {
              // 有同级菜单，创建下拉菜单
              menu = {
                items: parentItem.children
                  .filter(child => child.name && child.path)
                  .map(child => {
                    // 检查是否是应用菜单（通过路径判断）
                    const isAppMenu = child.path?.startsWith('/apps/');
                    const label = isAppMenu
                      ? translateAppMenuItemName(child.name as string, child.path, t)
                      : translateMenuName(child.name as string, t);
                    return {
                      key: child.path!,
                      label: label,
                      onClick: () => {
                        navigate(child.path!);
                      },
                    };
                  }),
              };
            }
          }

          // 检查是否是应用菜单（通过路径判断）
          const isAppMenu = item.path?.startsWith('/apps/');
          const breadcrumbTitle = isAppMenu
            ? translateAppMenuItemName(item.name as string, item.path, t)
            : translateMenuName(item.name as string, t);

          breadcrumbItems.push({
            title: breadcrumbTitle, // 使用统一的翻译逻辑
            path: actualPath, // 使用实际路径（可能是第一个菜单组下的第一个菜单项）
            icon: item.icon,
            menu: menu,
          });
        } else if (item.name && item.type === 'group') {
          // 菜单组：找到第一个实际菜单项作为点击目标
          const firstMenuItem = findFirstActualMenuItem(item.children);
          if (firstMenuItem && firstMenuItem.path) {
            // 检查是否有同级菜单组（父级菜单有多个子项，包括菜单组）
            let menu: { items: Array<{ key: string; label: string; onClick: () => void }> } | undefined;

            if (index > 0) {
              const parentItem = menuPath[index - 1];
              if (parentItem.children && parentItem.children.length > 1) {
                // 为同级菜单组创建下拉菜单，每个菜单组显示其第一个实际菜单项
                menu = {
                  items: parentItem.children
                    .filter(child => child.name)
                    .map(child => {
                      // 如果是菜单组，找到第一个实际菜单项
                      if (child.type === 'group') {
                        const firstItem = findFirstActualMenuItem(child.children);
                        if (firstItem && firstItem.path) {
                          // 检查是否是应用菜单（通过路径判断）
                          const isAppMenu = firstItem.path.startsWith('/apps/');
                          const label = isAppMenu
                            ? translateAppMenuName(child.name as string, firstItem.path, undefined, t)
                            : translateMenuName(child.name as string, t);
                          return {
                            key: firstItem.path,
                            label: label,
                            onClick: () => {
                              navigate(firstItem.path!);
                            },
                          };
                        }
                      } else if (child.path) {
                        // 检查是否是应用菜单（通过路径判断）
                        const isAppMenu = child.path.startsWith('/apps/');
                        const label = isAppMenu
                          ? translateAppMenuItemName(child.name as string, child.path, t)
                          : translateMenuName(child.name as string, t);
                        return {
                          key: child.path,
                          label: label,
                          onClick: () => {
                            navigate(child.path!);
                          },
                        };
                      }
                      return null;
                    })
                    .filter((item): item is { key: string; label: string; onClick: () => void } => item !== null),
                };
              }
            }

            // 检查是否是应用菜单（通过路径判断）
            const isAppMenu = firstMenuItem.path?.startsWith('/apps/');
            const breadcrumbTitle = isAppMenu
              ? translateAppMenuItemName(item.name as string, firstMenuItem.path, t)
              : translateMenuName(item.name as string, t);
            breadcrumbItems.push({
              title: breadcrumbTitle,
              path: firstMenuItem.path, // 使用第一个实际菜单项的路径
              icon: item.icon,
              menu: menu,
            });
          }
        }
      });
    } else {
      // 如果没有找到匹配的菜单项，使用路径翻译
      const pathSegments = location.pathname.split('/').filter(Boolean);
      pathSegments.forEach((segment, index) => {
        const path = '/' + pathSegments.slice(0, index + 1).join('/');
        // 使用统一的路径翻译逻辑
        const translatedTitle = translatePathTitle(path, t);
        breadcrumbItems.push({
          title: translatedTitle,
          path: path,
        });
      });
    }

    return breadcrumbItems;
  }, [location.pathname, menuConfig, navigate, t]);

  /**
   * 根据当前路径设置文档标题（浏览器标签页标题）
   */
  useEffect(() => {
    // 排除登录页等特殊页面
    if (location.pathname.startsWith('/login') || location.pathname.startsWith('/infra/login')) {
      return;
    }

    // 获取当前页面的标题
    const pageTitle = findMenuTitleWithTranslation(location.pathname, menuConfig, t);

    // 获取站点名称（优先使用 siteSetting，如果未加载则尝试从缓存读取，最后使用默认值）
    let currentSiteName = 'RiverEdge SaaS';

    if (siteSetting?.settings?.site_name?.trim()) {
      // 如果 siteSetting 已加载且有站点名称，使用它并缓存
      currentSiteName = siteSetting.settings.site_name.trim();
      try {
        localStorage.setItem('cachedSiteName', currentSiteName);
      } catch (error) {
        // 忽略存储错误
      }
    } else {
      // 如果 siteSetting 未加载或没有站点名称，尝试从缓存读取
      try {
        const cachedSiteName = localStorage.getItem('cachedSiteName');
        if (cachedSiteName) {
          currentSiteName = cachedSiteName;
        }
      } catch (error) {
        // 忽略读取错误
      }
    }

    // 设置文档标题
    if (pageTitle && pageTitle !== t('common.unnamedPage')) {
      document.title = `${pageTitle} - ${currentSiteName}`;
    } else {
      document.title = `${currentSiteName} - 多组织管理框架`;
    }
  }, [location.pathname, menuConfig, t, siteSetting]);

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

    // 监听窗口大小变化
    window.addEventListener('resize', checkBreadcrumbWrap);

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver(() => {
      setTimeout(checkBreadcrumbWrap, 50);
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
      window.removeEventListener('resize', checkBreadcrumbWrap);
      observer.disconnect();
    };
  }, [location.pathname]);

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
  const getUserMenuItems = (logout: () => void, t: (key: string) => string): MenuProps['items'] => [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: t('ui.user.profile'),
    },
    {
      type: 'divider',
    },
    {
      key: 'copyright',
      icon: <FileTextOutlined />,
      label: t('ui.copyright'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('ui.logout'),
      onClick: logout,
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
        setTechStackModalOpen(true);
        break;
      case 'logout':
        logout();
        // ⚠️ 关键修复：退出登录后使用 navigate 跳转，避免页面刷新
        navigate('/login', { replace: true });
        break;
    }
  };

  /**
   * 计算应该展开的菜单 key（只展开当前路径的直接父菜单）
   * 
   * @param menuItems - 菜单项数组
   * @param currentPath - 当前路径
   * @returns 应该展开的菜单 key 数组
   */
  const calculateOpenKeys = React.useCallback((menuItems: MenuDataItem[], currentPath: string): string[] => {
    const openKeys: string[] = [];

    /**
     * 递归查找包含当前路径的菜单项
     * 
     * @param items - 菜单项数组
     * @param path - 当前路径
     * @param parentKeys - 父菜单的 key 数组
     * @returns 是否找到匹配的菜单项
     */
    const findParentMenu = (items: MenuDataItem[], path: string, parentKeys: string[] = []): boolean => {
      for (const item of items) {
        const itemKey = item.key || item.path;
        if (!itemKey) continue;

        // 如果当前路径完全匹配菜单项的 path，说明找到了目标菜单
        if (item.path === path) {
          // 将父菜单的 key 添加到 openKeys（不包括当前菜单本身）
          openKeys.push(...parentKeys);
          return true;
        }

        // 如果菜单项有子菜单，检查当前路径是否在该菜单项的子菜单中
        if (item.children && item.children.length > 0) {
          // 检查子菜单中是否有匹配的路径
          const hasMatch = findParentMenu(item.children, path, [...parentKeys, itemKey as string]);
          if (hasMatch) {
            return true;
          }
        }
      }
      return false;
    };

    findParentMenu(menuItems, currentPath);
    return openKeys;
  }, []);

  const filteredMenuData = useMemo(() => {
    if (!currentUser) return [];

    let menuItems = [...menuConfig];

    // 【第二组】应用菜单：从后端动态加载
    // 应用菜单处理逻辑：
    // 1. 应用的名称作为分组标题（不可点击，灰色，小字号）
    // 2. 应用的子菜单提升到主菜单一级（和"仪表盘"、"系统配置"等同一级别）
    if (applicationMenus && applicationMenus.length > 0) {
      // 收集所有应用菜单项（分组标题 + 子菜单）
      const appMenuItems: MenuDataItem[] = [];

      // 使用后端返回的原始顺序（后端已根据 Application.sort_order 排序）
      const sortedApplicationMenus = applicationMenus;

      // 遍历每个应用，将应用的子菜单提升到主菜单级别
      sortedApplicationMenus.forEach(appMenu => {
        if (appMenu.children && appMenu.children.length > 0) {
          // 1. 先添加应用名称作为分组标题（仅在菜单展开时显示）
          // 使用 Ant Design 原生的 type: 'group' 来创建分组标题（与系统级菜单保持一致）
          // 注意：即使子菜单已经提升到主菜单级别，group 仍然需要 children 才能被渲染
          // 所以我们创建一个临时的子菜单项，然后在 menuItemRender 中处理
          // 菜单收起时不显示分组标题
          if (!collapsed) {
            // 翻译应用名称（直接从路径提取应用 code，不依赖数据库中存储的名称）
            // 这样可以确保无论数据库中的名称是什么（中文或英文），都能正确翻译
            const firstChildPath = appMenu.children[0]?.path;
            let translatedAppName = appMenu.name; // 默认使用数据库中的名称

            // 优先从路径提取应用 code 并使用翻译 key
            if (firstChildPath && firstChildPath.startsWith('/apps/')) {
              const appCode = extractAppCodeFromPath(firstChildPath);
              if (appCode) {
                // 直接使用翻译 key app.{app-code}.name，不依赖 appMenu.name 的值
                const appNameKey = `app.${appCode}.name`;
                const appNameTranslated = t(appNameKey, { defaultValue: appMenu.name });
                // 如果翻译成功（翻译结果不等于 key），使用翻译后的名称
                if (appNameTranslated && appNameTranslated !== appNameKey) {
                  translatedAppName = appNameTranslated;
                }
              }
            }

            // 如果路径提取失败，使用 translateAppMenuName 作为后备方案
            if (translatedAppName === appMenu.name) {
              translatedAppName = translateAppMenuName(appMenu.name, firstChildPath, appMenu.application_uuid, t);
            }

            const groupTitle: MenuDataItem = {
              name: translatedAppName,
              label: translatedAppName, // Ant Design Menu 使用 label 显示分组标题
              key: `app-group-${appMenu.uuid}`,
              type: 'group', // 使用原生 group 类型
              className: 'menu-group-title-app app-menu-container-start', // 用于样式识别和容器开始标记
              icon: undefined,
              children: [
                // 创建一个隐藏的占位子菜单项，确保 group 能被渲染
                {
                  key: `app-group-placeholder-${appMenu.uuid}`,
                  name: '', // 空名称，不显示
                  path: undefined,
                  style: { display: 'none' },
                },
              ],
            };
            appMenuItems.push(groupTitle);
          }

          // 2. 将应用的子菜单提升到主菜单级别，并添加应用菜单容器的 className
          appMenu.children.forEach(childMenu => {
            // 传递 isAppMenu=true 标记这是应用菜单，使用应用菜单翻译逻辑
            // 注意：应用菜单的子菜单也需要使用应用菜单翻译逻辑，递归处理子菜单时也会传递 isAppMenu=true
            const converted = convertMenuTreeToMenuDataItem(childMenu, true);
            // 为应用菜单项添加特殊的 className，用于 CSS 容器样式
            if (converted.className) {
              converted.className = `${converted.className} app-menu-item`;
            } else {
              converted.className = 'app-menu-item';
            }
            appMenuItems.push(converted);
          });
        }
      });

      // 插入到第二组位置（在仪表盘之后，系统菜单之前）
      // 注意：分割线通过 CSS 添加，不通过菜单项
      menuItems.splice(1, 0, ...appMenuItems);
    }

    // 【第四组】运营中心：仅平台级管理员可见
    // 根据路径过滤，而不是名称（因为名称可能已翻译）
    if (!currentUser.is_infra_admin) {
      // 过滤掉运营中心菜单（通过检查是否有 /infra/operation 路径的子菜单来判断）
      menuItems = menuItems.filter(item => {
        // 如果菜单有子菜单，检查是否包含运营中心相关的路径
        if (item.children) {
          const hasInfraOperation = item.children.some(child =>
            child.path?.startsWith('/infra/operation') ||
            child.path?.startsWith('/infra/tenants') ||
            child.path?.startsWith('/infra/packages') ||
            child.path?.startsWith('/infra/monitoring') ||
            child.path?.startsWith('/infra/inngest') ||
            child.path?.startsWith('/infra/admin')
          );
          return !hasInfraOperation;
        }
        // 如果菜单没有子菜单，保留它（不是运营中心菜单）
        return true;
      });
    }

    // 注意：组织管理已从第三组移除，移至运营中心（第四组）
    // 因此不再需要过滤第三组的组织管理菜单

    return menuItems;
  }, [currentUser, applicationMenus, convertMenuTreeToMenuDataItem, collapsed, t]);

  // 计算应该展开的菜单 key（只展开当前路径的直接父菜单）
  const requiredOpenKeys = useMemo(() => {
    return calculateOpenKeys(filteredMenuData, location.pathname);
  }, [filteredMenuData, location.pathname, calculateOpenKeys]);

  // 合并用户手动展开的菜单和当前路径的父菜单
  // 遵循 Ant Design Pro Layout 原生行为：允许用户手动收起任何菜单，包括有激活子菜单的菜单组
  const openKeys = useMemo(() => {
    // 1. 从 requiredOpenKeys 中排除用户手动收起的菜单
    const autoOpenKeys = requiredOpenKeys.filter(key => !userClosedKeys.includes(key));
    // 2. 合并自动展开的菜单和用户手动展开的菜单
    const merged = [...new Set([...autoOpenKeys, ...userOpenKeys])];
    return merged;
  }, [requiredOpenKeys, userOpenKeys, userClosedKeys]);

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

  // 当路径变化时，如果新路径需要展开之前手动收起的菜单，则清除这些菜单的收起状态
  // 这样可以确保当用户导航到新页面时，相关的菜单会自动展开
  useEffect(() => {
    // 如果当前路径需要展开的菜单中有被用户手动收起的，则清除这些菜单的收起状态
    const shouldReopenKeys = requiredOpenKeys.filter(key => userClosedKeys.includes(key));
    if (shouldReopenKeys.length > 0) {
      setUserClosedKeys(prev => prev.filter(key => !shouldReopenKeys.includes(key)));
    }
  }, [location.pathname, requiredOpenKeys]); // 只在路径变化时执行


  /**
   * 处理全屏切换
   */
  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };


  /**
   * 处理语言切换
   * 
   * @param languageCode - 语言代码（如 'zh-CN', 'en-US'）
   */
  const handleLanguageChange = React.useCallback(async (languageCode: string) => {
    try {
      // 切换到新语言
      await i18n.changeLanguage(languageCode);

      // 从后端加载翻译内容
      await refreshTranslations();

      // 更新用户偏好设置
      try {
        await updateUserPreference({
          preferences: {
            language: languageCode,
          },
        });
      } catch (error) {
        // 如果更新偏好设置失败，不影响语言切换
        console.warn('更新用户偏好设置失败:', error);
      }

      message.success(`已切换到${LANGUAGE_MAP[languageCode] || languageCode}`);
    } catch (error: any) {
      console.error('切换语言失败:', error);
      message.error(error?.message || t('common.switchLanguageFailed'));
    }
  }, []);

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
        /* 禁用主题切换时的过渡动画，让切换更干脆 */
        * {
          transition: background-color 0s !important;
          transition: color 0s !important;
          transition: border-color 0s !important;
        }
        /* 确保 Ant Design 组件也立即切换，无过渡 */
        .ant-pro-layout,
        .ant-pro-layout *,
        .ant-layout,
        .ant-layout * {
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
        /* 内容区域占据剩余空间 */
        html.riveredge-fullscreen-mode .uni-tabs-content,
        body.riveredge-fullscreen-mode .uni-tabs-content {
          flex: 1 !important;
          overflow: auto !important;
          height: calc(100vh - 40px) !important;
          min-height: calc(100vh - 40px) !important;
          max-height: calc(100vh - 40px) !important;
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
        /* 全局滚动条样式 - 只对主要内容区域隐藏滚动条，保持菜单滚动条可见 */
        /* ==================== 菜单分组标题样式 ==================== */
        /* 参考：https://ant-design.antgroup.com/components/menu-cn
         * groupTitleColor: rgba(0,0,0,0.45), groupTitleFontSize: 14, groupTitleLineHeight: 1.5714285714285714
         * 使用主题颜色变量，支持深色模式，并根据菜单栏背景色自动适配
         */
        /* 侧边栏内的分组标题 - 根据菜单栏背景色自动适配 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-item-group-title {
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
          font-weight: normal !important;
          padding: 12px 16px 12px 0 !important;
          margin: 0 0 8px 0 !important;
          border-bottom: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'} !important;
          background: transparent !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
        }
        /* 浅色模式下，菜单收起时弹出的二级菜单中的分组标题 - 使用深色文字 */
        /* 弹出菜单通常在 body 下，不在 .ant-pro-layout 内，所以使用全局选择器 */
        /* 只在浅色模式下应用（非深色模式），确保优先级足够高，放在最后以覆盖其他规则 */
        ${!isDarkMode ? `
        /* 弹出菜单中的分组标题 - 使用深色文字（弹出菜单背景是浅色的） */
        body .ant-menu-submenu-popup .ant-menu-item-group-title,
        body .ant-menu-popup .ant-menu-item-group-title,
        body .ant-menu-submenu-popup .ant-menu-item-group-title:hover,
        body .ant-menu-submenu-popup .ant-menu-item-group-title:active,
        body .ant-menu-submenu-popup .ant-menu-item-group-title:focus,
        body .ant-menu-popup .ant-menu-item-group-title:hover,
        body .ant-menu-popup .ant-menu-item-group-title:active,
        body .ant-menu-popup .ant-menu-item-group-title:focus {
          color: rgba(0, 0, 0, 0.45) !important;
          border-bottom: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'} !important;
        }
        ` : ''}
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-group-title:hover,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-group-title:active,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-group-title:focus,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title:hover,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title:active,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title:focus,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected .ant-menu-item-group-title:hover,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected .ant-menu-item-group-title:active,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected .ant-menu-item-group-title:focus {
          background: transparent !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
        }
        /* ==================== 一级菜单项 - 完全遵循 Ant Design 原生样式 ==================== */
        /* 不做任何修改，完全使用 Ant Design 的原生样式和垂直居中 */
        /* 统一所有一级菜单项的图标样式 */
        /* 统一所有菜单图标大小：16px，背景容器：20x20 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .anticon,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .anticon,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item .anticon {
          font-size: 16px !important;
          width: 16px !important;
          height: 16px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          min-width: 16px !important;
          min-height: 16px !important;
          max-width: 16px !important;
          max-height: 16px !important;
          position: relative !important;
          margin-right: 12px !important;
          margin-left: 0 !important;
          color: inherit !important;
          line-height: 1 !important;
          vertical-align: middle !important;
        }
        /* 为图标添加统一的 20x20 背景容器（使用伪元素，配合主题色但更淡） */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-item-icon::before,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .anticon::before,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-item-icon::before,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .anticon::before {
          content: '' !important;
          position: absolute !important;
          left: 50% !important;
          top: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: 20px !important;
          height: 20px !important;
          background: ${(() => {
          // 将主题色转换为 rgba，使用 0.15 的透明度（更淡但可见）
          const primaryColor = String(token.colorPrimary || '#1890ff');
          // 如果是十六进制颜色，转换为 rgba
          if (primaryColor.startsWith('#')) {
            const hex = primaryColor.slice(1);
            // 处理 3 位或 6 位十六进制
            const r = hex.length === 3
              ? parseInt(hex[0] + hex[0], 16)
              : parseInt(hex.slice(0, 2), 16);
            const g = hex.length === 3
              ? parseInt(hex[1] + hex[1], 16)
              : parseInt(hex.slice(2, 4), 16);
            const b = hex.length === 3
              ? parseInt(hex[2] + hex[2], 16)
              : parseInt(hex.slice(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, 0.15)`;
          }
          // 如果已经是 rgba 格式，提取颜色并降低透明度
          const rgbaMatch = primaryColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (rgbaMatch) {
            return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, 0.15)`;
          }
          // 默认使用主题色但更淡
          return 'rgba(24, 144, 255, 0.15)';
        })()} !important;
          border-radius: 4px !important;
          z-index: 0 !important;
          pointer-events: none !important;
        }
        /* 选中菜单项的图标强制白色 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected .anticon {
          color: #fff !important;
        }
        /* ==================== 菜单项样式 - 使用 Ant Design 原生 ==================== */
        /* 让 Ant Design 使用其默认的菜单项高度和行高 */

        /* ==================== 分组菜单下的子菜单项 ==================== */
        /* 使用最高优先级的选择器覆盖内联样式 - 必须匹配所有可能的组合 */
        /* 注意：CSS 的 !important 可以覆盖内联样式，但需要选择器足够具体 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group .ant-menu-item.ant-menu-item-selected.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-group .ant-menu-item.ant-menu-item-selected.ant-menu-item-only-child.ant-pro-base-menu-inline-menu-item,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group .ant-menu-item.ant-menu-item-selected.ant-menu-item-only-child,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-group .ant-menu-item.ant-menu-item-selected.ant-menu-item-only-child,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group .ant-menu-item.ant-menu-item-selected,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-group .ant-menu-item.ant-menu-item-selected,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group .ant-menu-item,
        /* 子菜单标题样式（ant-menu-submenu-title）- 使用 Ant Design 原生样式 */
        /* 使用主题颜色变量，支持深色模式 */
        /* 注意：只针对侧边栏内的子菜单标题，不影响弹出菜单 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title {
          /* 子菜单标题的独立样式，与普通菜单项区分开 */
          padding-right: 4px !important; /* 增加右侧padding，为下拉箭头留出更多空间 */
          color: ${siderTextColor} !important;
          font-size: var(--ant-fontSize) !important;
          font-weight: normal !important;
        }
        
        /* 优化菜单标题内容，防止文字与箭头重叠 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content {
          max-width: calc(100% - 32px) !important; /* 为箭头预留32px空间 */
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          flex: 1 !important;
          min-width: 0 !important; /* 允许flex子元素收缩 */
        }
        
        /* 一级菜单项的文字内容也需要优化 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-title-content {
          max-width: calc(100% - 32px) !important; /* 为箭头预留32px空间 */
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          flex: 1 !important;
          min-width: 0 !important; /* 允许flex子元素收缩 */
        }
        
        /* 确保下拉箭头有足够的空间 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-submenu-arrow {
          flex-shrink: 0 !important;
          margin-left: 8px !important; /* 增加箭头与文字的间距 */
        }
        /* 子菜单标题悬浮状态 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title:hover {
          background-color: var(--ant-colorFillTertiary) !important;
          color: ${siderTextColor} !important;
        }
        /* 子菜单标题激活状态 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-selected > .ant-menu-submenu-title {
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
          border-top: 1px solid ${siderTextColor === '#ffffff'
          ? 'rgba(255, 255, 255, 0.15)'
          : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)')} !important;
        }
        /* 侧边栏底部收起按钮样式 - 根据菜单栏背景色自动适配 */
        .ant-pro-layout .ant-pro-sider-footer .ant-btn,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer .ant-btn,
        .ant-pro-layout .ant-pro-sider-footer > div .ant-btn,
        .ant-pro-layout .ant-layout-sider .ant-pro-sider-footer > div .ant-btn {
          width: 100% !important;
          color: ${siderTextColor} !important;
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
        /* 统一顶部、标签栏和菜单栏的背景色 - 使用 token 值并同步到 CSS 变量 */
        :root {
          --ant-colorBgContainer: ${token.colorBgContainer};
        }
        /* 顶栏背景色（支持透明度） */
        .ant-pro-layout .ant-pro-layout-header,
        .ant-pro-layout .ant-layout-header {
          background: ${headerBgColor} !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
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
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
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
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
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
        /* 确保 ProLayout 内容区域背景色与激活标签一致 */
        .ant-pro-layout-content,
        .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout-content .ant-pro-page-container-children-content {
          background: ${token.colorBgLayout || (isDarkMode ? '#141414' : '#f5f5f5')} !important;
        }
        /* 左侧菜单区背景色 - 与顶栏和标签栏保持一致 */
        /* 浅色模式下，如果设置了自定义背景色，则使用自定义背景色；否则使用默认背景色（与顶栏一致） */
        /* 深色模式下，始终使用默认深色背景 */
        /* 强制覆盖 ProLayout 的 navTheme 默认背景色 */
        .ant-pro-layout .ant-pro-sider,
        .ant-pro-layout .ant-layout-sider,
        .ant-pro-layout .ant-pro-sider-menu,
        .ant-pro-layout .ant-pro-sider .ant-layout-sider,
        .ant-pro-layout .ant-pro-sider .ant-layout-sider-children,
        .ant-pro-layout[data-theme="light"] .ant-pro-sider,
        .ant-pro-layout[data-theme="light"] .ant-layout-sider,
        .ant-pro-layout[data-theme="light"] .ant-pro-sider-menu {
          background: ${siderBgColor} !important;
        }
        
        /* 根据菜单栏背景色自动适配文字颜色 */
        /* 深色背景使用浅色文字，浅色背景使用深色文字 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item:not(.ant-menu-item-selected),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title:not(.ant-menu-submenu-selected > .ant-menu-submenu-title),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title {
          color: ${siderTextColor} !important;
        }
        
        /* 菜单项图标颜色也自动适配 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item:not(.ant-menu-item-selected) .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item:not(.ant-menu-item-selected) .anticon,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title:not(.ant-menu-submenu-selected > .ant-menu-submenu-title) .anticon,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title) .anticon,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title) .anticon {
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : siderTextColor} !important;
        }
        
        /* 子菜单项文字颜色也自动适配 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item:not(.ant-menu-item-selected),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-item:not(.ant-menu-item-selected) {
          color: ${siderTextColor} !important;
        }
        
        /* 三级子菜单标题箭头图标颜色也自动适配 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title) .ant-menu-submenu-arrow,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title) .ant-menu-submenu-arrow {
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : 'var(--ant-colorTextSecondary)'} !important;
        }
        
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
        /* 一级菜单激活状态 - 使用主题色背景，白色文字 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected {
          background-color: var(--riveredge-menu-primary-color) !important;
          border-right: none !important;
          box-shadow: none !important;
          color: #fff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > span,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected .ant-menu-title-content a,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected .ant-menu-title-content span {
          color: #fff !important;
          font-weight: normal !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected .anticon,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected .ant-menu-item-icon .anticon {
          color: #fff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected::after {
          display: none !important;
        }
        /* 一级子菜单标题激活状态 - 只有文字颜色，无背景色 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title {
          background-color: transparent !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title > .ant-menu-title-content {
          color: var(--riveredge-menu-primary-color) !important;
        }
        
        /* 二级及以下菜单激活状态 - 使用主题色背景 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-selected,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-item-selected {
          background-color: var(--riveredge-menu-primary-color) !important;
        }
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-selected > .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-item-selected > .ant-menu-title-content > a {
          color: #fff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-selected::after,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-item-selected::after {
          border-right-color: var(--riveredge-menu-primary-color) !important;
        }
        /* 隐藏子菜单中的图标（只保留一级菜单的图标） */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-item .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group .ant-menu-item .ant-menu-item-icon {
          display: none !important;
        }
        /* 子菜单内边距设置 */
        .ant-pro-base-menu-inline .ant-pro-base-menu-inline-submenu-has-icon > .ant-menu-sub {
          padding-inline-start: 0 !important;
          padding:0 10px !important;
        }
        .ant-menu-item ant-menu-item-only-child ant-pro-base-menu-inline-menu-item {
          padding-left: 32px !important;
        }
        /* 二级及以下子菜单标题固定样式 - 使用 Ant Design 原生样式（排除分组标题） */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title:not(.ant-menu-item-group-title),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title:not(.ant-menu-item-group-title) {
          background-color: transparent !important;
          background: transparent !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : 'var(--ant-colorTextSecondary)'} !important;
          /* border-bottom: 1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'} !important; */

          padding-left: 32px !important;
          padding-right: 16px !important;
          border-radius: 0 !important;
          box-sizing: border-box !important;
          transition: none !important;
        }
        /* 二级子菜单标题 hover 和 content 样式 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title):hover,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title):hover,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title:not(.ant-menu-item-group-title):hover,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title:not(.ant-menu-item-group-title):hover,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title) > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title) > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title:not(.ant-menu-item-group-title) > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title:not(.ant-menu-item-group-title) > .ant-menu-title-content {
          background: transparent !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : 'var(--ant-colorTextSecondary)'} !important;
        }
        /* 确保分组标题不受子菜单激活状态影响，使用菜单栏文字颜色 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-item-group-title {
          background: transparent !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
        }
        /* ==================== 菜单动画 - 使用 Ant Design 默认 ==================== */
        /* 顶栏右侧操作按钮样式优化 - 遵循 Ant Design 规范 */
        .ant-pro-layout .ant-pro-layout-header .ant-space {
          gap: 8px !important;
        }
        /* 统一按钮样式 - 保留圆形背景，浅色背景时图标颜色统一为黑色 */
        /* 注意：这些样式会被之前的通用顶栏按钮样式覆盖，但保留这里作为备用和补充 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn,
        .ant-pro-layout .ant-layout-header .ant-btn {
          width: 32px !important;
          height: 32px !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 50% !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
          border: none !important;
          transition: none !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn .anticon,
        .ant-pro-layout .ant-layout-header .ant-btn .anticon {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 16px !important;
        }
        /* Badge 内按钮样式 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn,
        .ant-pro-layout .ant-layout-header .ant-badge .ant-btn {
          width: 32px !important;
          height: 32px !important;
          padding: 0 !important;
          border-radius: 50% !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
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
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
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
        .ant-pro-layout .ant-pro-layout-header .ant-btn .ant-avatar {
          border: none;
        }
        /* 租户选择器样式 - 胶囊型，与搜索框一致 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper {
          padding: 0;
          transition: none !important;
        }
        /* 租户选择器 wrapper 内的 span（系统级用户显示组织名称） - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper > span {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 16px !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
          font-size: 14px;
          font-weight: 500;
          height: 32px;
          line-height: 24px;
        }
        /* 租户选择器内的选择框样式 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-selector {
          border-radius: 16px !important; /* 胶囊型圆角 */
          border: none !important;
          box-shadow: none !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
          background: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
          height: 32px !important;
        }
        /* 租户选择器文字颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-placeholder,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-search-input {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        /* 租户选择器箭头图标颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.65)'} !important;
        }
        /* 租户选择器所有状态 - 浅色模式浅色背景无hover */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:not(.ant-select-disabled):hover .ant-select-selector {
          border: none !important;
          box-shadow: none !important;
          background: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
        }
        /* 租户选择器 hover 和 focused 状态下的文字颜色 - 根据显示模式统一 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selection-item,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selection-item,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selection-item {
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        /* 租户选择器内部输入框样式 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-search-input,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item {
          background: transparent !important;
        }
        /* 租户选择器文字左右边距 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selection-item {
          padding-left: 6px !important;
          padding-right: 18px !important;
        }
        /* 租户选择器切换图标样式 - 确保在右侧 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow {
          right: 8px !important;
        }
        /* 禁用租户选择器 wrapper 的 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper:hover {
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
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper:hover,
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper-focused {
          border: none !important;
          box-shadow: none !important;
          background-color: ${isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)'} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-input {
          background-color: transparent !important;
          border: none !important;
          color: ${isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)'} !important;
        }
        .ant-pro-global-header{
          margin-inline: 0 !important;
        }
        .ant-layout-sider-children{
          padding-inline: 0 !important;
        }
        /* LOGO 样式 - 设置 min-width 和垂直对齐 */
        .ant-pro-global-header-logo {
          min-width: 167px !important;
          display: flex !important;
          align-items: center !important;
          height: 100% !important;
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
          color: ${isDarkMode ? 'var(--ant-colorText)' : (isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)')} !important;
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
        /* ==================== 面包屑样式 ==================== */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb {
          font-size: 14px !important;
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
        /* 面包屑内部容器防止换行 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb ol,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb ul {
          display: flex !important;
          flex-wrap: nowrap !important;
          white-space: nowrap !important;
          overflow: visible !important;
        }
        /* 面包屑项防止换行，允许收缩但优先显示最后一项 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item {
          white-space: nowrap !important;
          flex-shrink: 1 !important;
          display: inline-flex !important;
          align-items: center !important;
          min-width: 0;
          max-width: 100%;
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
        /* ==================== 弹出菜单文字颜色（放在最后，确保最高优先级） ==================== */
        /* 浅色模式下，菜单收起时弹出的菜单 - 使用深色文字（弹出菜单背景是浅色的） */
        ${!isDarkMode ? `
        /* 弹出菜单中的第一层菜单项和子菜单标题 - 使用深色文字（最高优先级，覆盖所有其他规则） */
        body .ant-menu-submenu-popup .ant-menu-item,
        body .ant-menu-submenu-popup .ant-menu-submenu > .ant-menu-submenu-title,
        body .ant-menu-submenu-popup .ant-menu-item-group .ant-menu-item,
        body .ant-menu-popup .ant-menu-item,
        body .ant-menu-popup .ant-menu-submenu > .ant-menu-submenu-title,
        body .ant-menu-popup .ant-menu-item-group .ant-menu-item,
        /* 覆盖所有状态（hover、selected） */
        body .ant-menu-submenu-popup .ant-menu-submenu > .ant-menu-submenu-title:hover,
        body .ant-menu-submenu-popup .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title,
        body .ant-menu-popup .ant-menu-submenu > .ant-menu-submenu-title:hover,
        body .ant-menu-popup .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title,
        /* 文字内容 */
        body .ant-menu-submenu-popup .ant-menu-item .ant-menu-title-content,
        body .ant-menu-submenu-popup .ant-menu-item .ant-menu-title-content > a,
        body .ant-menu-submenu-popup .ant-menu-item .ant-menu-title-content > span,
        body .ant-menu-submenu-popup .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-title-content,
        body .ant-menu-submenu-popup .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-title-content > span,
        body .ant-menu-submenu-popup .ant-menu-item-group .ant-menu-item .ant-menu-title-content,
        body .ant-menu-popup .ant-menu-item .ant-menu-title-content,
        body .ant-menu-popup .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-title-content,
        body .ant-menu-popup .ant-menu-item-group .ant-menu-item .ant-menu-title-content {
          color: var(--ant-colorText) !important;
        }
        ` : ''}
      `}</style>
      <ProLayout
        title={siteName}
        logo={siteLogo}
        layout="mix" // 固定使用 MIX 布局模式
        navTheme={isDarkMode ? "realDark" : "light"}
        collapsedButtonRender={(collapsed) => {
          // 根据菜单栏文字颜色计算分割线颜色
          // 如果是浅色文字（深色背景），使用浅色分割线；否则使用深色分割线
          const dividerColor = siderTextColor === '#ffffff'
            ? 'rgba(255, 255, 255, 0.15)'
            : (isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.12)');

          return (
            <div
              style={{
                padding: '8px',
                borderTop: `1px solid ${dividerColor}`,
              }}
            >
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined style={{ color: siderTextColor }} /> : <MenuFoldOutlined style={{ color: siderTextColor }} />}
                onClick={() => setCollapsed(!collapsed)}
                style={{
                  width: '100%',
                  color: siderTextColor,
                }}
                title={collapsed ? t('ui.sidebar.expand') : t('ui.sidebar.collapse')}
              />
            </div>
          );
        }}
        contentWidth="Fluid"
        fixedHeader
        fixSiderbar
        // 验证方案3：同时使用 collapsed + siderWidth + menuRender
        // 全屏时：collapsed={true} + siderWidth={0} + menuRender={() => null} 完全隐藏侧边栏
        // 退出全屏时：恢复所有 props，确保 ProLayout 重新计算布局
        collapsed={isFullscreen ? true : collapsed}
        onCollapse={isFullscreen ? undefined : setCollapsed}
        location={location}
        siderWidth={isFullscreen ? 0 : undefined}
        // 全屏时：不渲染菜单，确保折叠的侧边栏也不占据空间
        menuRender={isFullscreen ? () => null : undefined}
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
        headerContentRender={() => (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%', gap: 12 }}>
            {/* 分割线 */}
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
            {/* 面包屑 */}
            <div ref={breadcrumbRef} style={{ flex: 1, overflow: 'visible', paddingLeft: 8 }}>
              <Breadcrumb
                style={{
                  display: breadcrumbVisible ? 'flex' : 'none',
                  alignItems: 'center',
                  height: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'visible',
                }}
                items={generateBreadcrumb.map((item, index) => ({
                  title: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, lineHeight: '1.5', verticalAlign: 'middle' }}>
                      {index === generateBreadcrumb.length - 1 ? (
                        <span style={{ color: 'var(--ant-colorText)', fontWeight: 500, lineHeight: '1.5', verticalAlign: 'middle' }}>{item.title}</span>
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
        )}
        actionsRender={() => {
          const actions = [];

          // 搜索框（始终展开）
          actions.push(
            <TopBarSearch
              key="search"
              menuData={filteredMenuData}
              isLightModeLightBg={isLightModeLightBg}
              token={token}
              placeholder={t('common.searchPlaceholder', '搜索菜单、功能...')}
            />
          );

          // 消息提醒（带数量徽标）
          actions.push(
            <Dropdown
              key="notifications"
              placement="bottomRight"
              trigger={['click']}
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
                      <Typography.Text strong style={{ fontSize: 16 }}>
                        消息通知
                        {unreadCount > 0 && (
                          <Badge
                            count={unreadCount}
                            size="small"
                            style={{ marginLeft: 8 }}
                          />
                        )}
                      </Typography.Text>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setMessageDropdownOpen(false);
                          navigate('/personal/messages');
                        }}
                      >
                        查看全部 <RightOutlined />
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
                        <List
                          dataSource={messages}
                          renderItem={(item: UserMessage) => {
                            const unread = isUnread(item);
                            return (
                              <List.Item
                                style={{
                                  padding: '12px 16px',
                                  cursor: 'pointer',
                                  backgroundColor: unread ? token.colorFillAlter : 'transparent',
                                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                }}
                                onClick={async () => {
                                  // 点击消息，跳转到消息详情页面
                                  setMessageDropdownOpen(false);
                                  navigate('/personal/messages');

                                  // 如果是未读消息，自动标记为已读
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
                                <List.Item.Meta
                                  avatar={
                                    <Badge dot={unread}>
                                      <Avatar
                                        size={40}
                                        style={{
                                          backgroundColor: unread ? token.colorPrimary : token.colorFillTertiary,
                                        }}
                                        icon={<BellOutlined />}
                                      />
                                    </Badge>
                                  }
                                  title={
                                    <Space>
                                      <Typography.Text strong={unread} ellipsis style={{ maxWidth: 250 }}>
                                        {item.subject || t('common.noSubject')}
                                      </Typography.Text>
                                    </Space>
                                  }
                                  description={
                                    <div>
                                      <Typography.Paragraph
                                        ellipsis={{ rows: 2 }}
                                        style={{
                                          marginBottom: 4,
                                          fontSize: 12,
                                          color: token.colorTextSecondary,
                                        }}
                                      >
                                        {item.content}
                                      </Typography.Paragraph>
                                      <Typography.Text
                                        type="secondary"
                                        style={{ fontSize: 11 }}
                                      >
                                        {item.sent_at
                                          ? dayjs(item.sent_at).format('YYYY-MM-DD HH:mm')
                                          : dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
                                      </Typography.Text>
                                    </div>
                                  }
                                />
                              </List.Item>
                            );
                          }}
                        />
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
              <Badge count={unreadCount} size="small" offset={[-8, 8]}>
                <Tooltip title={t('ui.message.notification')} open={messageDropdownOpen ? false : undefined}>
                  <Button
                    type="text"
                    size="small"
                    icon={<BellOutlined />}
                    onClick={() => {
                      setMessageDropdownOpen(!messageDropdownOpen);
                    }}
                  />
                </Tooltip>
              </Badge>
            </Dropdown>
          );

          // 手机端扫码按钮
          actions.push(<MobileQRCode key="mobile-qr" />);

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

          // 租户切换选择框 - 优化样式，不显示图标
          if (currentUser) {
            actions.push(
              <div
                key="tenant"
                className="tenant-selector-wrapper"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginLeft: 4,
                }}
              >
                <TenantSelector />
              </div>
            );
          }

          // 用户头像和下拉菜单
          if (currentUser) {
            actions.push(
              <Dropdown
                key="user"
                menu={{
                  items: getUserMenuItems(logout, t),
                  onClick: handleUserMenuClick,
                }}
                placement="bottomRight"
              >
                <Space
                  size={8}
                  style={{
                    cursor: 'pointer',
                    padding: '0 8px 0 4px',
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '16px',
                    background: isLightModeLightBg ? token.colorFillTertiary : 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  {avatarUrl ? (
                    <Avatar
                      size={24}
                      src={avatarUrl}
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    />
                  ) : (
                    <Avatar
                      size={24}
                      style={{
                        backgroundColor: token.colorPrimary,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: getAvatarFontSize(24),
                        fontWeight: 500,
                      }}
                    >
                      {/* 显示首字母（优先全名，否则用户名） */}
                      {getAvatarText(currentUser.full_name, currentUser.username)}
                    </Avatar>
                  )}
                  <span
                    style={{
                      fontSize: 14,
                      color: isLightModeLightBg ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
                      lineHeight: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {/* 优先显示全名，如果全名为空则显示用户名 */}
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

          return actions;
        }}
        menuDataRender={() => {
          return filteredMenuData;
        }}
        menuProps={{
          mode: 'inline',
          openKeys: openKeys, // 受控的 openKeys，合并用户手动展开的菜单和当前路径的父菜单
          selectedKeys: selectedKeys, // 受控的 selectedKeys，只选中精确匹配的路径
          // ⚠️ 关键修复：阻止 Ant Design Menu 的默认链接行为，防止整页刷新
          // Menu 会为有 path 的菜单项自动创建 <a> 标签，需要阻止默认行为
          onClick: (info) => {
            // 如果菜单项有 path，阻止默认的链接跳转行为
            const menuItem = info.item;
            if (menuItem && menuItem.props && menuItem.props.path) {
              const path = menuItem.props.path;
              // 外部链接已经在 menuItemRender 中处理，这里只阻止内部路由的默认行为
              if (path && !path.startsWith('http://') && !path.startsWith('https://')) {
                // 完全阻止默认行为，让 Link 组件处理路由
                // React Router 的 Link 组件会阻止默认行为并使用 navigate() 进行路由跳转
                info.domEvent.preventDefault();
                info.domEvent.stopPropagation();
              }
            }
          },
          onOpenChange: (keys) => {
            // 遵循 Ant Design Pro Layout 原生行为：允许用户手动收起任何菜单
            // 1. 计算哪些菜单被收起了（从 requiredOpenKeys 中移除的）
            const closedKeys = requiredOpenKeys.filter(key => !keys.includes(key));
            if (closedKeys.length > 0) {
              // 用户手动收起了某些菜单，记录这些菜单
              setUserClosedKeys(prev => [...new Set([...prev, ...closedKeys])]);
            }

            // 2. 计算哪些菜单被展开了（不在 requiredOpenKeys 中的）
            const manuallyOpenedKeys = keys.filter(key => !requiredOpenKeys.includes(key));
            setUserOpenKeys(manuallyOpenedKeys);

            // 3. 如果用户重新展开了之前手动收起的菜单，从 userClosedKeys 中移除
            const reopenedKeys = userClosedKeys.filter(key => keys.includes(key));
            if (reopenedKeys.length > 0) {
              setUserClosedKeys(prev => prev.filter(key => !reopenedKeys.includes(key)));
            }
          },
        }}
        onMenuHeaderClick={() => navigate('/system/dashboard/workplace')}
        menuItemRender={(item: any, dom) => {
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
            // 确保应用菜单分组标题使用最新的翻译（在渲染时重新翻译，确保语言切换后能正确显示）
            // 从第一个子菜单的路径中提取应用 code，然后直接使用翻译 key
            const firstChildPath = item.children?.[0]?.path;
            let groupTitle = item.name || item.label || '';

            // 如果第一个子菜单路径存在且是应用菜单路径，直接从路径提取应用 code 并使用翻译 key
            if (firstChildPath && firstChildPath.startsWith('/apps/')) {
              const appCode = extractAppCodeFromPath(firstChildPath);
              if (appCode) {
                // 直接使用翻译 key app.{app-code}.name 进行翻译，不依赖 item.name 的值
                // 这样可以确保无论 item.name 是什么值（中文或英文），都能根据当前语言正确翻译
                const appNameKey = `app.${appCode}.name`;
                const appNameTranslated = t(appNameKey, { defaultValue: groupTitle });
                if (appNameTranslated && appNameTranslated !== appNameKey) {
                  groupTitle = appNameTranslated;
                }
              }
            }

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
              ? translateAppMenuName(item.name as string, firstChildPath, undefined, t)
              : translateMenuName(item.name as string, t);
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
            // 内部路由：使用 Link 组件进行 SPA 路由跳转
            // 确保应用菜单的子菜单项使用翻译后的名称
            // item.name 已经在 convertMenuTreeToMenuDataItem 中翻译过，但 Ant Design Menu 可能使用原始的 dom
            // 如果是应用菜单项，确保使用翻译后的名称
            let finalDom = dom;
            if (item.path.startsWith('/apps/') && item.name) {
              // 再次翻译，确保使用最新的翻译函数（因为 t 可能已经更新）
              const translatedName = translateAppMenuItemName(item.name as string, item.path, t);
              // 如果翻译成功且与 dom 不一致，使用翻译后的名称
              if (translatedName && translatedName !== item.name) {
                // 如果 dom 是 React 元素，需要重新构建；如果是字符串，直接替换
                if (typeof dom === 'string') {
                  finalDom = translatedName;
                } else if (dom && typeof dom === 'object' && 'props' in dom) {
                  // 如果是 React 元素，尝试替换其中的文本内容
                  // 这里我们直接使用翻译后的名称创建一个新的元素
                  finalDom = <span>{translatedName}</span>;
                } else {
                  finalDom = translatedName;
                }
              }
            }

            // 包装在 div 中并阻止事件冒泡，防止 Menu 的默认行为
            return (
              <div
                onClick={(e) => {
                  // 阻止事件冒泡到 Menu，防止 Menu 的默认链接行为
                  e.stopPropagation();
                }}
                style={{ display: 'block', width: '100%' }}
              >
                <Link to={item.path} style={{ display: 'block', width: '100%' }}>
                  {finalDom}
                </Link>
              </div>
            );
          }
          // 没有 path 或 disabled 的菜单项：直接返回 dom
          return dom;
        }}
      >
        <UniTabs
          menuConfig={menuConfig}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        >
          {children}
        </UniTabs>
      </ProLayout >

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
    </>
  );
}

