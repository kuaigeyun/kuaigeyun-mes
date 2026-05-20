/**
 * RiverEdge SaaS 多组织框架 - 基础布局组件
 * 
 * 使用 ProLayout 实现现代化页面布局，集成状态管理和权限控制
 */

import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
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
  ExperimentOutlined,
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
  AppstoreAddOutlined,
} from '@ant-design/icons';
import { message, Button, Tooltip, Badge, Avatar, Dropdown, Space, Input, Breadcrumb } from 'antd';
import type { MenuProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import TenantSelector from '../components/tenant_selector';
import PageTabs from '../components/page_tabs';
import TechStackModal from '../components/tech-stack-modal';
import ThemeEditor from '../components/theme-editor';
import { getCurrentUser } from '../services/auth';
import { getCurrentPlatformSuperAdmin } from '../services/platformAdmin';
import { getToken, clearAuth, getUserInfo, getTenantId } from '../utils/auth';
import { useGlobalStore } from '../stores';
import { getLanguageList, Language } from '../services/language';
import { updateUserPreference } from '../services/userPreference';
import { LANGUAGE_MAP } from '../config/i18n';
import i18n, { refreshTranslations } from '../config/i18n';

// 权限守卫组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { currentUser, loading, setCurrentUser, setLoading } = useGlobalStore();

  // 检查用户类型（平台超级管理员还是系统级用户）
  const userInfo = getUserInfo();
  const isPlatformSuperAdmin = userInfo?.user_type === 'platform_superadmin';

  // 检查是否访问系统级页面
  const isSystemPage = location.pathname.startsWith('/system/');
  const currentTenantId = getTenantId();

  // 如果是平台超级管理员访问系统级页面，但没有选择组织，则重定向到平台首页
  if (isPlatformSuperAdmin && isSystemPage && !currentTenantId) {
    message.warning('请先选择要管理的组织');
    // 重定向到平台首页，让用户先选择组织
    return <Navigate to="/platform" replace />;
  }
  
  // 如果 currentUser 已存在且信息完整，不需要重新获取
  // 只有在以下情况才需要获取用户信息：
  // 1. 有 token 但没有 currentUser
  // 注意：避免在 currentUser 已存在时重复获取，防止无限循环
  const shouldFetchUser = !!getToken() && !currentUser;

  // 根据用户类型调用不同的接口
  const { data: userData, isLoading } = useQuery({
    queryKey: ['currentUser', isPlatformSuperAdmin],
    queryFn: async () => {
      // 优先使用 userInfo 判断用户类型
      const shouldUsePlatformAPI = isPlatformSuperAdmin;
      
      if (shouldUsePlatformAPI) {
        // 平台超级管理员：调用平台接口
        try {
          const platformUser = await getCurrentPlatformSuperAdmin();
          return {
            id: platformUser.id,
            username: platformUser.username,
            email: platformUser.email,
            full_name: platformUser.full_name,
            is_platform_admin: true, // 平台超级管理员始终是平台管理
            is_tenant_admin: false,
            tenant_id: undefined,
          };
        } catch (error) {
          // 如果平台接口失败，可能是 token 无效，抛出错误让 onError 处理
          throw error;
        }
      } else {
        // 系统级用户：调用系统接口
        return await getCurrentUser();
      }
    },
    enabled: shouldFetchUser,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5分钟内不重新获取
    onSuccess: (data) => {
      setCurrentUser(data);
    },
    onError: (error: any) => {
      // 如果有 token，尝试从 localStorage 恢复用户信息
      if (getToken()) {
        const savedUserInfo = getUserInfo();
        if (savedUserInfo) {
          // 从 localStorage 恢复用户信息
          const restoredUser = {
            id: savedUserInfo.id || 1,
            username: savedUserInfo.username || 'admin',
            email: savedUserInfo.email,
            full_name: savedUserInfo.full_name,
            is_platform_admin: savedUserInfo.user_type === 'platform_superadmin' || savedUserInfo.is_platform_admin || false,
            is_tenant_admin: savedUserInfo.is_tenant_admin || false,
            tenant_id: savedUserInfo.tenant_id,
          };
          setCurrentUser(restoredUser);
          
          // 如果是平台超级管理员，但后端接口失败，记录警告但不阻止访问
          if (savedUserInfo.user_type === 'platform_superadmin') {
            console.warn('⚠️ 获取平台超级管理员信息失败，使用本地缓存:', error);
          } else {
            console.warn('⚠️ 获取用户信息失败，使用本地缓存:', error);
          }
        } else {
          // ⚠️ 修复：没有本地缓存时，不要立即清理认证信息，避免导致重定向
          // 只有在明确是 401 错误时才清理（401 错误会在 api.ts 中处理）
          if (error?.response?.status === 401) {
            console.error('❌ 认证已过期，请重新登录:', error);
            // 401 错误会在 api.ts 中处理，这里不需要再次清理
          } else {
            console.warn('⚠️ 获取用户信息失败，但保留当前状态，允许继续访问:', error);
            // 不清理认证信息，允许用户继续访问（可能是网络问题等临时错误）
          }
        }
      } else {
        // 没有 token，清理认证信息
        clearAuth();
        setCurrentUser(undefined);
      }
    },
  });

  React.useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // 公开页面（只包括登录和注册页面，不包括平台管理页面）
  const publicPaths = ['/login', '/register', '/register/personal', '/register/organization'];
  // 平台登录页是公开的，但其他平台页面需要登录
  const isPlatformLoginPage = location.pathname === '/platform' || location.pathname === '/platform/login';
  const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path)) || isPlatformLoginPage;

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
    if (isPlatformLoginPage && currentUser.is_platform_admin) {
      return <Navigate to="/platform/operation" replace />;
    }
    // 普通用户登录后，如果访问的是登录页，重定向到系统仪表盘
    if (location.pathname === '/login' && !currentUser.is_platform_admin) {
      return <Navigate to="/system/dashboard" replace />;
    }
  }

  // 如果不是公开页面且未登录，自动重定向到登录页
  if (!isPublicPath && !currentUser && !getToken()) {
    // 平台级路由重定向到平台登录页
    if (location.pathname.startsWith('/platform')) {
      return <Navigate to="/platform" replace />;
    }
    // 系统级路由重定向到用户登录页
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

/**
 * 菜单配置函数
 *
 * 按照菜单分组架构设计：
 * 【第一组】固定仪表盘 - 平台级、系统级、应用级都可见
 * 【第二组】应用菜单（插件式加载）- 根据用户权限和已安装插件动态加载
 * 【第三组】系统配置 - 平台级、系统级、应用级可见
 *   └─ 用户管理（分组标题，不可点击）
 *      ├─ 角色管理（第1优先级）
 *      ├─ 权限管理（包含在角色权限管理中）
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
    name: t('menu.dashboard') || '仪表盘',
    icon: <DashboardOutlined />,
    children: [
      {
        path: '/system/dashboard/workplace',
        name: t('menu.dashboard.workplace') || '工作台',
      },
      {
        path: '/system/dashboard/analysis',
        name: t('menu.dashboard.analysis') || '分析页',
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
    name: '系统配置',
    icon: <ControlOutlined />,
    children: [
      // 用户管理分组标题（使用 Ant Design Menu 的 type: 'group'）
      {
        key: 'user-management-group',
        type: 'group',
        name: '用户管理',  // ProLayout 使用 name，但 type: 'group' 会传递给 Ant Design Menu 作为 label
        label: '用户管理',  // 同时提供 label 以确保 Ant Design Menu 能正确显示
        className: 'riveredge-menu-group-title',  // 自定义 className，用于专门设置样式
        children: [
          // 按照系统级功能建设计划第一阶段顺序排序的用户管理功能
          {
            path: '/system/roles',
            name: '角色管理',
            icon: <CrownOutlined />,
          },
          {
            path: '/system/permissions',
            name: '权限管理',
            icon: <LockOutlined />,
          },
          {
            path: '/system/departments',
            name: '部门管理',
            icon: <ApartmentOutlined />,
          },
          {
            path: '/system/positions',
            name: '职位管理',
            icon: <UserSwitchOutlined />,
          },
          {
            path: '/system/users',
            name: '账户管理',
            icon: <UserOutlined />,
          },
        ],
      },
      // 核心配置分组标题
      {
        key: 'core-config-group',
        type: 'group',
        name: t('menu.group.core-config') || '核心配置',
        label: t('menu.group.core-config') || '核心配置',
        className: 'riveredge-menu-group-title',
        children: [
          {
            path: '/system/applications',
            name: t('menu.system.applications') || '应用中心',
            icon: <AppstoreOutlined />,
          },
          {
            path: '/system/menus',
            name: t('menu.system.menus') || '菜单管理',
            icon: <UnorderedListOutlined />,
          },
          {
            path: '/system/site-settings',
            name: t('menu.system.site-settings') || '站点设置',
            icon: <SettingOutlined />,
          },
          {
            path: '/system/system-parameters',
            name: t('menu.system.system-parameters') || '参数设置',
            icon: <SettingOutlined />,
          },
          {
            path: '/system/data-dictionaries',
            name: t('menu.system.data-dictionaries') || '数据字典',
            icon: <DatabaseOutlined />,
          },
          {
            path: '/system/code-rules',
            name: t('menu.system.code-rules') || '编码规则',
            icon: <FileTextOutlined />,
          },
          {
            path: '/system/integration-configs',
            name: t('menu.system.integration-configs') || '集成设置',
            icon: <ApiOutlined />,
          },
          {
            path: '/system/languages',
            name: t('menu.system.languages') || '语言管理',
            icon: <FileTextOutlined />,
          },
          {
            path: '/system/custom-fields',
            name: t('menu.system.custom-fields') || '自定义字段',
            icon: <AppstoreOutlined />,
          },
          {
            path: '/system/invitation-codes',
            name: t('menu.system.invitation-codes') || '邀请码管理',
            icon: <TeamOutlined />,
          },
        ],
      },
      // 数据中心分组标题
      {
        key: 'data-center-group',
        type: 'group',
        name: '数据中心',
        label: '数据中心',
        className: 'riveredge-menu-group-title',
        children: [
          {
            path: '/system/files',
            name: '文件管理',
            icon: <FileTextOutlined />,
          },
          {
            path: '/system/apis',
            name: '接口管理',
            icon: <ApiOutlined />,
          },
          {
            path: '/system/data-sources',
            name: '数据源管理',
            icon: <DatabaseOutlined />,
          },
          {
            path: '/system/datasets',
            name: '数据集管理',
            icon: <DatabaseOutlined />,
          },
        ],
      },
      // 流程管理分组标题
      {
        key: 'process-management-group',
        type: 'group',
        name: '流程管理',
        label: '流程管理',
        className: 'riveredge-menu-group-title',
        children: [
          {
            path: '/system/messages/config',
            name: '消息配置',
            icon: <BellOutlined />,
          },
          {
            path: '/system/messages/template',
            name: '消息模板',
            icon: <FileTextOutlined />,
          },
          {
            path: '/system/scheduled-tasks',
            name: '定时任务',
            icon: <ControlOutlined />,
          },
          {
            path: '/system/approval-processes',
            name: '审批流程',
            icon: <FileTextOutlined />,
          },
          {
            path: '/system/approval-instances',
            name: '审批实例',
            icon: <CheckCircleOutlined />,
          },
          {
            path: '/system/scripts',
            name: '脚本管理',
            icon: <CodeOutlined />,
          },
          {
            path: '/system/print-templates',
            name: '打印模板',
            icon: <FileTextOutlined />,
          },
          {
            path: '/system/print-devices',
            name: '打印设备',
            icon: <PrinterOutlined />,
          },
        ],
      },
      {
        path: '/personal',
        name: '个人中心',
        icon: <UserOutlined />,
        children: [
          {
            path: '/personal/profile',
            name: '个人资料',
            icon: <UserOutlined />,
          },
          {
            path: '/personal/preferences',
            name: '偏好设置',
            icon: <SettingOutlined />,
          },
          {
            path: '/personal/messages',
            name: '我的消息',
            icon: <BellOutlined />,
          },
          {
            path: '/personal/tasks',
            name: '我的任务',
            icon: <FileTextOutlined />,
          },
        ],
      },
      // 监控运维分组标题
      {
        key: 'monitoring-ops-group',
        type: 'group',
        name: '监控运维',
        label: '监控运维',
        className: 'riveredge-menu-group-title',
        children: [
          {
            path: '/system/operation-logs',
            name: '操作日志',
            icon: <HistoryOutlined />,
          },
          {
            path: '/system/login-logs',
            name: '登录日志',
            icon: <LoginOutlined />,
          },
          {
            path: '/system/online-users',
            name: '在线用户',
            icon: <TeamOutlined />,
          },
          {
            path: '/system/data-backups',
            name: '数据备份',
            icon: <DatabaseOutlined />,
          },
        ],
      },
    ],
  },

  // ==================== 【第四组】运营中心 ====================
  // 可见范围：仅平台级管理员可见
  {
    path: '/platform',
    name: '运营中心',
    icon: <GlobalOutlined />,
    children: [
      {
        path: '/platform/operation',
        name: '运营看板',
        icon: <DashboardOutlined />,
      },
      {
        path: '/platform/tenants',
        name: '组织管理',
        icon: <ApartmentOutlined />,
      },
      {
        path: '/platform/packages',
        name: '套餐管理',
        icon: <ShopOutlined />,
      },
      {
        path: '/platform/monitoring',
        name: t('menu.platform.monitoring') || '系统监控',
        icon: <MonitorOutlined />,
      },
      {
        path: '/system/inngest',
        name: t('menu.platform.inngest') || '流程后台',
        icon: <MonitorOutlined />,
      },
      {
        path: '/platform/admin',
        name: t('menu.platform.admin') || '平台管理',
        icon: <CrownOutlined />,
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
  const { i18n: i18nInstance, t } = useTranslation(); // 获取 i18n 实例和翻译函数
  const [collapsed, setCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [techStackModalOpen, setTechStackModalOpen] = useState(false);
  const [themeEditorOpen, setThemeEditorOpen] = useState(false);
  const [languageDropdownOpen, setLanguageDropdownOpen] = useState(false);
  const [breadcrumbVisible, setBreadcrumbVisible] = useState(true);
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const { currentUser, logout, isLocked, lockScreen } = useGlobalStore();
  
  // 获取可用语言列表
  const { data: languageListData } = useQuery({
    queryKey: ['availableLanguages'],
    queryFn: () => getLanguageList({ is_active: true }),
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });
  
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

  // 监听主题更新事件，实时更新菜单栏背景色
  useEffect(() => {
    const handleThemeUpdate = () => {
      // 延迟一下，确保全局变量已经更新
      setTimeout(() => {
        const customBgColor = (window as any).__RIVEREDGE_SIDER_BG_COLOR__;
        setSiderBgColorState(customBgColor);
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
  const handleSearch = (value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      // TODO: 实现搜索功能
      message.info(`搜索: ${trimmedValue}（功能开发中）`);
    }
  };

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
                  .map(child => ({
                    key: child.path!,
                    label: child.name as string,
                    onClick: () => {
                      navigate(child.path!);
                    },
                  })),
              };
            }
          }
          
          breadcrumbItems.push({
            title: item.name as string,
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
                          return {
                            key: firstItem.path,
                            label: child.name as string,
                            onClick: () => {
                              navigate(firstItem.path!);
                            },
                          };
                        }
                      } else if (child.path) {
                        return {
                          key: child.path,
                          label: child.name as string,
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
            
            breadcrumbItems.push({
              title: item.name as string,
              path: firstMenuItem.path, // 使用第一个实际菜单项的路径
              icon: item.icon,
              menu: menu,
            });
          }
        }
      });
    } else {
      // 如果没有找到匹配的菜单项，使用路径作为面包屑
      const pathSegments = location.pathname.split('/').filter(Boolean);
      pathSegments.forEach((segment, index) => {
        const path = '/' + pathSegments.slice(0, index + 1).join('/');
        breadcrumbItems.push({
          title: segment,
          path: path,
        });
      });
    }
    
    return breadcrumbItems;
  }, [location.pathname, menuConfig, navigate]);

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
  const getUserMenuItems = (logout: () => void): MenuProps['items'] => [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
    },
    {
      type: 'divider',
    },
    {
      key: 'copyright',
      icon: <FileTextOutlined />,
      label: '版权声明',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: logout,
    },
  ];

  // 处理用户菜单点击
  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'profile':
        message.info('个人资料功能开发中');
        break;
      case 'copyright':
        setTechStackModalOpen(true);
        break;
      case 'logout':
        logout();
        break;
    }
  };

  const filteredMenuData = useMemo(() => {
    if (!currentUser) return [];

    let menuItems = [...menuConfig];

    // 【第四组】运营中心：仅平台级管理员可见
    if (!currentUser.is_platform_admin) {
      menuItems = menuItems.filter(item => item.path !== '/platform');
    }

    // 注意：组织管理已从第三组移除，移至运营中心（第四组）
    // 因此不再需要过滤第三组的组织管理菜单

    // TODO: 后续添加应用菜单（第二组）的权限过滤逻辑
    // 根据用户权限和已安装插件动态加载应用菜单

    return menuItems;
  }, [currentUser]);


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
      message.error(error?.message || '切换语言失败，请重试');
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

  return (
    <>
      {/* 技术栈列表 Modal */}
      <TechStackModal
        open={techStackModalOpen}
        onCancel={() => setTechStackModalOpen(false)}
      />
      
      {/* 动态设置全局背景色，确保深色模式下正确应用 */}
      <style>{`
        html, body {
          background-color: ${token.colorBgLayout} !important;
          transition: none !important;
        }
        #root {
          background-color: ${token.colorBgLayout} !important;
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
      `}</style>
      {/* 自定义分组标题样式 */}
      <style>{`
        /* 动态注入主题色到 CSS 变量 */
        :root {
          --riveredge-menu-primary-color: ${token.colorPrimary};
          --ant-colorBgLayout: ${token.colorBgLayout};
        }
        /* ==================== PageContainer 相关 ==================== */
        .ant-pro-page-container .ant-page-header .ant-page-header-breadcrumb,
        .ant-pro-page-container .ant-breadcrumb {
          display: none !important;
        }
        .ant-pro-page-container .ant-pro-page-container-children-content {
          padding: 0 !important;
        }
        /* 全局页面边距：16px */
        .page-tabs-content .ant-pro-table {
          padding: 16px !important;
        }
        /* 侧边栏收起时，确保内容区域左边距正确 - 覆盖所有可能的情况 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content {
          margin-left: 0 !important;
        }
        /* 侧边栏收起时，内容区域和页面容器的左边距 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .ant-pro-page-container {
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
        /* 覆盖所有可能的布局容器 */
        .ant-pro-layout-container .ant-pro-layout-content,
        .ant-pro-layout-container .ant-layout-content {
          margin-left: 0 !important;
        }
        /* 侧边栏收起时，确保所有内容容器都没有左边距 */
        .ant-pro-layout.ant-pro-layout-has-mix[class*="collapsed"] .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider[class*="collapsed"] ~ .ant-pro-layout-content,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider[class*="collapsed"] ~ .ant-pro-layout-content {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* 确保 PageTabs 组件在侧边栏收起时也没有左边距 */
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-layout-content .page-tabs-wrapper,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-pro-sider-collapsed ~ .ant-pro-layout-content .page-tabs-wrapper,
        .ant-pro-layout.ant-pro-layout-has-mix .ant-layout-sider-collapsed ~ .ant-pro-layout-content .page-tabs-wrapper {
          margin-left: 0 !important;
          padding-left: 0 !important;
        }
        /* 文件管理页面无边距（覆盖全局规则） */
        .page-tabs-content .file-management-page .ant-pro-table {
          padding: 0 !important;
        }
        .pro-table-button-container {
          margin-bottom: 16px;
          padding: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        /* 隐藏整个页面的垂直滚动条（但保持滚轮滚动功能） */
        .ant-pro-layout,
        .ant-pro-layout *,
        .ant-pro-layout-container,
        .ant-pro-layout-container *,
        .ant-pro-page-container,
        .ant-pro-page-container *,
        .ant-pro-layout-content,
        .ant-pro-layout-content *,
        .ant-layout,
        .ant-layout *,
        .ant-layout-content,
        .ant-layout-content *,
        body,
        html {
          scrollbar-width: none !important; /* Firefox */
          -ms-overflow-style: none !important; /* IE 10+ */
        }
        .ant-pro-layout *::-webkit-scrollbar,
        .ant-pro-layout::-webkit-scrollbar,
        .ant-pro-layout-container *::-webkit-scrollbar,
        .ant-pro-layout-container::-webkit-scrollbar,
        .ant-pro-page-container *::-webkit-scrollbar,
        .ant-pro-page-container::-webkit-scrollbar,
        .ant-pro-layout-content *::-webkit-scrollbar,
        .ant-pro-layout-content::-webkit-scrollbar,
        .ant-layout *::-webkit-scrollbar,
        .ant-layout::-webkit-scrollbar,
        .ant-layout-content *::-webkit-scrollbar,
        .ant-layout-content::-webkit-scrollbar,
        body::-webkit-scrollbar,
        html::-webkit-scrollbar {
          display: none !important; /* Chrome, Safari, Edge */
          width: 0 !important;
          height: 0 !important;
        }
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
          font-size: 14px !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
          line-height: 1.5714285714285714 !important;
          font-weight: normal !important;
          padding: 12px 16px 12px 0 !important;
          margin: 0 0 8px 0 !important;
          border-bottom: 1px solid ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)'} !important;
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
          border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
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
        /* ==================== 一级菜单项 - 统一所有一级菜单项样式，与子菜单标题对齐 ==================== */
        /* 统一所有一级菜单项的 padding-left，与子菜单标题一致（24px），覆盖内联样式 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item {
          padding-left: 24px !important;
          margin-left: 0 !important;
        }
        /* 统一所有一级菜单项的图标样式 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item .anticon {
          font-size: 16px !important;
          width: 16px !important;
          height: 16px !important;
          min-width: 16px !important;
          min-height: 16px !important;
          max-width: 16px !important;
          max-height: 16px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-right: 12px !important;
          margin-left: 0 !important;
          color: inherit !important;
          line-height: 1 !important;
          vertical-align: middle !important;
        }
        /* 选中菜单项的图标强制白色 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected .anticon {
          color: #fff !important;
        }
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
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-group .ant-menu-item,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-group .ant-menu-item-group .ant-menu-item {
          padding-left: 24px !important;
        }
        /* 子菜单标题样式（ant-menu-submenu-title）- 独立设置，不影响普通菜单项 */
        /* 使用主题颜色变量，支持深色模式 */
        /* 注意：只针对侧边栏内的子菜单标题，不影响弹出菜单 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title {
          /* 子菜单标题的独立样式，与普通菜单项区分开 */
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          padding-right: 16px !important;
          height: 40px !important;
          line-height: 40px !important;
          color: ${siderTextColor} !important;
          font-size: 14px !important;
          font-weight: normal !important;
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
          font-size: 12px !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
        }
        /* 系统菜单分组标题样式 */
        .menu-group-title-system {
          font-size: 12px !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
          margin-top: 8px !important;
        }
        /* 使用 ProLayout 原生收起按钮，保持原生行为 */
        /* 不再隐藏原生收起按钮，让 ProLayout 自己处理收起展开逻辑 */
        /* 隐藏 ant-pro-layout-container 里的 footer */
        .ant-pro-layout-container .ant-pro-layout-footer {
          display: none !important;
        }
        /* ==================== 菜单收起状态 - 系统性重构，遵循 Ant Design 原生行为 ==================== */
        /* 原则：不干扰 Ant Design 原生行为，只做最小化自定义（隐藏文字和箭头） */
        
        /* 1. 确保图标显示（最高优先级，覆盖所有可能的图标位置，包括在 .ant-menu-title-content 内部的情况） */
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-item .anticon:not(.ant-menu-submenu-arrow),
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .anticon:not(.ant-menu-submenu-arrow),
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-item-icon,
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-item .anticon:not(.ant-menu-submenu-arrow),
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .anticon:not(.ant-menu-submenu-arrow),
        /* 图标在 .ant-menu-title-content 内部的情况 - 必须明确设置 font-size，不受父元素影响 */
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content .anticon:not(.ant-menu-submenu-arrow),
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content .anticon:not(.ant-menu-submenu-arrow),
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content .ant-menu-item-icon,
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content .anticon:not(.ant-menu-submenu-arrow),
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content .anticon:not(.ant-menu-submenu-arrow) {
          display: inline-flex !important;
          font-size: 16px !important;
          line-height: 1 !important;
          width: 16px !important;
          height: 16px !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        /* 2. 隐藏文字内容（只隐藏文字元素，不影响图标） */
        /* 使用 font-size: 0 隐藏文本节点，但确保图标不受影响 */
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content,
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content,
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content {
          font-size: 0 !important;
          line-height: 0 !important;
        }
        /* 隐藏所有文字元素（span、a 等），但排除图标 */
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content > span:not(.anticon):not(.ant-menu-item-icon),
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content > span:not(.anticon):not(.ant-menu-item-icon),
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content > a,
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content > span:not(.anticon):not(.ant-menu-item-icon),
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content > a,
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content > span:not(.anticon):not(.ant-menu-item-icon),
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content > a {
          display: none !important;
        }
        
        /* 3. 隐藏子菜单箭头（遵循 Ant Design 原生行为） */
        .ant-pro-layout .ant-pro-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-submenu-arrow,
        .ant-pro-layout .ant-layout-sider-collapsed .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-submenu-arrow {
          display: none !important;
        }
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
        /* 隐藏左侧菜单栏滚动条，但保持滚轮滚动功能 */
        /* 使用通用选择器覆盖所有可能的滚动容器 */
        /* 注意：只设置滚动条样式，不设置背景色，避免覆盖 ProLayout 原生深色模式 */
        .ant-pro-layout .ant-pro-sider *,
        .ant-pro-layout .ant-layout-sider * {
          scrollbar-width: none !important; /* Firefox */
          -ms-overflow-style: none !important; /* IE 10+ */
        }
        .ant-pro-layout .ant-pro-sider *::-webkit-scrollbar,
        .ant-pro-layout .ant-layout-sider *::-webkit-scrollbar {
          display: none !important; /* Chrome, Safari, Edge */
          width: 0 !important;
          height: 0 !important;
        }
        /* ==================== 菜单底部 ==================== */
        /* 使用主题边框颜色，支持深色模式，并根据菜单栏背景色自动适配 */
        .ant-pro-sider-footer {
          margin-bottom: 10px !important;
          padding-bottom: 0 !important;
          border-top-color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)'} !important;
        }
        /* 统一顶部、标签栏和菜单栏的背景色 - 使用 token 值并同步到 CSS 变量 */
        :root {
          --ant-colorBgContainer: ${token.colorBgContainer};
        }
        .ant-pro-layout .ant-pro-layout-header,
        .ant-pro-layout .ant-layout-header {
          background: ${token.colorBgContainer} !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
        }
        /* 内容区背景颜色与 PageContainer 一致 - 使用 token 值 */
        .ant-pro-layout-bg-list {
          background: ${token.colorBgLayout} !important;
        }
        /* 确保 ProLayout 内容区域背景色与激活标签一致 */
        .ant-pro-layout-content,
        .ant-pro-layout-content .ant-pro-page-container,
        .ant-pro-layout-content .ant-pro-page-container-children-content {
          background: ${token.colorBgLayout} !important;
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
        /* 二级及以下子菜单标题固定样式 - 无论是否有子菜单被选中，都保持相同样式（排除分组标题） */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu > .ant-menu-submenu-title:not(.ant-menu-item-group-title),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title:not(.ant-menu-item-group-title),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title:not(.ant-menu-item-group-title) {
          background-color: transparent !important;
          background: transparent !important;
          color: ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : 'var(--ant-colorTextSecondary)'} !important;
          border-bottom: 1px solid ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.12)' : 'var(--ant-colorBorderSecondary)'} !important;
          
          padding-top: 4px !important;
          padding-bottom: 4px !important;
          padding-left: 28px !important;
          padding-right: 16px !important;
          border-radius: 0 !important;
          box-sizing: border-box !important;
          min-height: 32px !important;
          height: auto !important;
          line-height: 1.5 !important;
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
        /* ==================== 菜单收起/展开动画优化 - 干净利落 ==================== */
        /* 侧边栏收起/展开动画 - 快速且干脆 */
        .ant-pro-layout .ant-pro-sider,
        .ant-pro-layout .ant-layout-sider {
          transition: width 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        /* 菜单容器动画优化 */
        .ant-pro-layout .ant-pro-sider-menu,
        .ant-pro-layout .ant-layout-sider .ant-menu {
          transition: none !important;
        }
        /* 菜单项动画优化 - 移除所有过渡效果，立即显示/隐藏 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title {
          transition: none !important;
        }
        /* 子菜单展开/收起动画 - 快速且干脆 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-inline .ant-menu {
          transition: opacity 0.1s ease-out, max-height 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        /* 菜单项文字和图标立即显示/隐藏，无过渡 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-icon,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title .ant-menu-submenu-arrow {
          transition: none !important;
        }
        /* 子菜单展开/收起时，立即显示/隐藏，无延迟 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-open > .ant-menu,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-open > .ant-menu-submenu > .ant-menu {
          display: block !important;
          opacity: 1 !important;
          max-height: 1000px !important;
          transition: opacity 0.1s ease-out, max-height 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu:not(.ant-menu-submenu-open) > .ant-menu,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu:not(.ant-menu-submenu-open) > .ant-menu-submenu > .ant-menu {
          display: none !important;
          opacity: 0 !important;
          max-height: 0 !important;
          transition: opacity 0.1s ease-out, max-height 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        /* 菜单项 hover 效果 - 立即响应，无过渡 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item:hover,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu-title:hover {
          transition: background-color 0.1s ease-out !important;
        }
        /* 顶栏右侧操作按钮样式优化 - 遵循 Ant Design 规范 */
        .ant-pro-layout .ant-pro-layout-header .ant-space {
          gap: 8px !important;
        }
        /* 统一按钮样式 - 保留圆形背景，使用 token 值确保深色/浅色模式都正确 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn {
          width: 32px !important;
          height: 32px !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 50% !important;
          background-color: ${token.colorFillTertiary} !important;
          border: none !important;
          transition: none !important;
          color: ${token.colorText} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn .anticon {
          color: ${token.colorText} !important;
        }
        /* 保留圆形背景的 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover,
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active {
          background-color: ${token.colorFillTertiary} !important;
          color: ${token.colorText} !important;
          border-radius: 50% !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover .anticon,
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active .anticon {
          color: ${token.colorText} !important;
        }
        /* Badge 内按钮样式 - 确保按钮样式一致，保留圆形背景 */
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn {
          width: 32px !important;
          height: 32px !important;
          padding: 0 !important;
          border-radius: 50% !important;
          background-color: ${token.colorFillTertiary} !important;
          transition: none !important;
        }
        /* 保留 Badge 内按钮的圆形背景 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn:hover,
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover .ant-btn {
          background-color: ${token.colorFillTertiary} !important;
          color: ${token.colorText} !important;
          border-color: transparent !important;
          box-shadow: none !important;
          transform: none !important;
          border-radius: 50% !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn:hover .anticon {
          color: ${token.colorText} !important;
        }
        /* 确保 Badge 本身无任何 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover {
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
        /* 租户选择器内的选择框样式 - 胶囊型（与搜索框完全一致，使用 token 值） */
        /* 只对 selector 设置背景色，避免双层背景 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select {
          background: transparent !important;
        }
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selector {
          border-radius: 16px !important; /* 胶囊型圆角 */
          border: none !important;
          box-shadow: none !important;
          background-color: ${token.colorFillTertiary} !important;
          height: 32px !important;
        }
        /* 租户选择器所有状态 - 确保颜色与搜索框完全一致 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:not(.ant-select-disabled):hover .ant-select-selector {
          border: none !important;
          box-shadow: none !important;
          background: ${token.colorFillTertiary} !important;
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
        /* 禁用租户选择器 wrapper 的 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper:hover {
          background-color: transparent !important;
        }
        /* 搜索框样式 - 使用 token 值，与按钮背景色一致 */
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper {
          border: none !important;
          box-shadow: none !important;
          background-color: ${token.colorFillTertiary} !important;
        }
        /* 手机模式下隐藏搜索框 */
        @media (max-width: 768px) {
          .ant-pro-layout .ant-pro-layout-header .ant-space-item:has(.ant-input-affix-wrapper),
          .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper {
            display: none !important;
          }
        }
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper:hover,
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper-focused {
          border: none !important;
          box-shadow: none !important;
          background-color: ${token.colorFillTertiary} !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-input {
          background-color: transparent !important;
          border: none !important;
        }
        /* LOGO 样式 - 设置 min-width */
        .ant-pro-global-header-logo {
          min-width: 167px !important;
        }
        /* ==================== 面包屑样式 ==================== */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb {
          padding-left: 16px;
          font-size: 14px;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb {
          display: flex !important;
          align-items: center;
          height: 100%;
          position: relative;
          white-space: nowrap !important;
          overflow: hidden !important;
          flex: 1 1 auto;
          min-width: 0;
          max-width: none;
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
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
        }
        /* 最后一个面包屑项不收缩，优先显示完整 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item:last-child {
          flex-shrink: 0 !important;
        }
        /* 面包屑分隔符防止换行 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-separator {
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          display: inline-flex !important;
        }
        /* 面包屑内部文本防止换行 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb span,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb a {
          white-space: nowrap !important;
          display: inline-flex !important;
        }
        /* 面包屑链接内部的 gap - 图标和文字之间的间距 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-link span,
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item span {
          gap: 8px !important;
        }
        /* 面包屑前面的小竖线 - 使用主题边框颜色 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 1px;
          height: 16px;
          background-color: ${token.colorBorder} !important;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb a {
          color: var(--ant-colorText);
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb a:hover {
          color: var(--riveredge-menu-primary-color);
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
        title="RiverEdge SaaS"
        logo="/img/logo.png"
        layout="mix"
        navTheme={isDarkMode ? "realDark" : "light"}
        contentWidth="Fluid"
        fixedHeader
        fixSiderbar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        location={location}
        contentStyle={{
          padding: 0,
          background: token.colorBgLayout,
        }}
        headerContentRender={() => (
          <Breadcrumb
            ref={breadcrumbRef}
            style={{ 
              display: breadcrumbVisible ? 'flex' : 'none',
              alignItems: 'center',
              height: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
            items={generateBreadcrumb.map((item, index) => ({
              title: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* 只有第一项（一级菜单）显示图标 */}
                  {item.icon && index === 0 && (
                    <span style={{ fontSize: 14, display: 'flex', alignItems: 'center' }}>
                      {item.icon}
                    </span>
                  )}
                  {index === generateBreadcrumb.length - 1 ? (
                    <span style={{ color: 'var(--ant-colorText)', fontWeight: 500 }}>{item.title}</span>
                  ) : (
                    <a 
                      onClick={() => {
                        if (item.path) {
                          navigate(item.path);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {item.title}
                    </a>
                  )}
                </span>
              ),
              menu: item.menu,
            }))}
          />
        )}
        actionsRender={() => {
          const actions = [];
          
          // 搜索框（始终展开）
          actions.push(
            <Input
              key="search"
              placeholder="搜索菜单、功能..."
              prefix={<SearchOutlined style={{ fontSize: 16, color: 'var(--ant-colorTextSecondary)' }} />}
              size="small"
              onPressEnter={(e) => {
                const value = (e.target as HTMLInputElement).value;
                handleSearch(value);
              }}
              style={{
                width: 280,
                height: 32,
                borderRadius: '16px',
                backgroundColor: token.colorFillTertiary,
              }}
              allowClear
            />
          );

          // 消息提醒（带数量徽标）
          actions.push(
            <Badge key="notifications" count={5} size="small" offset={[-8,8]}>
              <Tooltip title="消息通知">
                <Button
                  type="text"
                  size="small"
                  icon={<BellOutlined style={{ fontSize: 16 }} />}
                  onClick={() => message.info('消息通知功能开发中')}
                />
              </Tooltip>
            </Badge>
          );
          
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
                title={`当前语言: ${LANGUAGE_MAP[currentLanguage] || currentLanguage}`}
                trigger={['hover']}
                mouseEnterDelay={0.5}
                open={languageDropdownOpen ? false : undefined}
                destroyTooltipOnHide
              >
                <Button
                  type="text"
                  size="small"
                  icon={<TranslationOutlined style={{ fontSize: 16 }} />}
                />
              </Tooltip>
            </Dropdown>
          );

          // 颜色配置
          actions.push(
            <Tooltip key="theme" title="主题颜色">
              <Button
                type="text"
                size="small"
                icon={<BgColorsOutlined style={{ fontSize: 16 }} />}
                onClick={handleThemeChange}
              />
            </Tooltip>
          );

          // 全屏按钮
          actions.push(
            <Tooltip key="fullscreen" title={isFullscreen ? '退出全屏' : '全屏'}>
              <Button
                type="text"
                size="small"
                icon={
                  isFullscreen ? (
                    <FullscreenExitOutlined style={{ fontSize: 16 }} />
                  ) : (
                    <FullscreenOutlined style={{ fontSize: 16 }} />
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
                  items: getUserMenuItems(logout),
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
                    background: token.colorFillTertiary,
                  }}
                >
                  <Avatar
                    size={24}
                    src={(currentUser as any)?.avatar}
                    style={{
                      backgroundColor: token.colorPrimary,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* 优先显示全名的首字母，如果全名为空则显示用户名的首字母 */}
                    {(currentUser.full_name || currentUser.username)?.[0]?.toUpperCase()}
                  </Avatar>
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--ant-colorText)',
                      lineHeight: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {/* 优先显示全名，如果全名为空则显示用户名 */}
                    {currentUser.full_name || currentUser.username}
                  </span>
                </Space>
              </Dropdown>
            );
          }

          // 锁定屏幕按钮 - 移到最后一个防止误点
          actions.push(
            <Tooltip key="lock" title="锁定屏幕" placement="bottomRight">
              <Button
                type="text"
                size="small"
                icon={<LockOutlined style={{ fontSize: 16 }} />}
                onClick={handleLockScreen}
              />
            </Tooltip>
          );
          
          return actions;
        }}
      menu={{
        request: async () => filteredMenuData,
      }}
      menuProps={{
        mode: 'inline',
      }}
      onMenuHeaderClick={() => navigate('/system/dashboard')}
      menuItemRender={(item, dom) => {
        // 处理外部链接
        if (item.path && (item.path.startsWith('http://') || item.path.startsWith('https://'))) {
          return (
            <a href={item.path} target={item.target || '_blank'} rel="noopener noreferrer">
              {dom}
            </a>
          );
        }
        // 如果没有 path 且有特定的 className，说明是分组标题，使用自定义样式渲染
        if (!item.path && (item.className === 'menu-group-title-plugin' || item.className === 'menu-group-title-system')) {
          return (
            <div
              className={item.className}
              style={{
                fontSize: '12px',
                color: 'var(--ant-colorTextSecondary)',
                fontWeight: 500,
                padding: '8px 16px',
                cursor: 'default',
                userSelect: 'none',
                pointerEvents: 'none',
                marginTop: item.className === 'menu-group-title-system' ? '8px' : '0',
              }}
            >
              {item.name}
            </div>
          );
        }
        // 统一所有一级菜单项的样式，确保完全一致
        return (
          <div
            onClick={() => {
              if (item.path && item.path !== location.pathname) {
                navigate(item.path);
              }
            }}
            style={{
              cursor: item.path ? 'pointer' : 'default',
            }}
            ref={(el) => {
              if (el) {
                // 使用 setTimeout 确保 DOM 已渲染
                setTimeout(() => {
                  // 查找内部的 li 元素（Ant Design Menu 渲染的）
                  const liElement = el.querySelector('li.ant-menu-item') as HTMLElement;
                  if (liElement) {
                    // 检查是否是选中状态
                    const isSelected = liElement.classList.contains('ant-menu-item-selected');
                    
                    if (isSelected) {
                      // 选中状态：使用主题色背景，白色文字
                      liElement.style.color = '#fff';
                      liElement.style.backgroundColor = token.colorPrimary;
                      
                      // 设置文字和图标为白色
                      const titleContent = liElement.querySelector('.ant-menu-title-content') as HTMLElement;
                      if (titleContent) {
                        titleContent.style.color = '#fff';
                        const link = titleContent.querySelector('a');
                        if (link) {
                          link.style.color = '#fff';
                        }
                      }
                      
                      // 设置图标为白色
                      const icon = liElement.querySelector('.ant-menu-item-icon, .anticon') as HTMLElement;
                      if (icon) {
                        icon.style.color = '#fff';
                      }
                    } else {
                      // 未选中状态：透明背景，使用主题文字颜色
                      liElement.style.color = 'var(--ant-colorText)';
                      liElement.style.backgroundColor = 'transparent';
                    }
                    
                    liElement.style.borderRight = 'none';
                    liElement.style.boxShadow = 'none';
                    liElement.style.fontWeight = 'normal';

                    // 隐藏右边框指示器
                    const afterElement = liElement.querySelector('::after') as HTMLElement;
                    if (afterElement) {
                      afterElement.style.display = 'none';
                    }

                    // 检查是否在分组菜单下（通过查找父元素中的 .ant-menu-item-group）
                    const menuGroup = el.closest('.ant-menu-item-group');
                    if (menuGroup && liElement.style.paddingLeft === '48px') {
                      // 设置正确的 padding-left，覆盖内联样式
                      liElement.style.paddingLeft = '24px';
                    }
                  }
                }, 0);
              }
            }}
          >
            {dom}
          </div>
        );
      }}
      collapsedButtonRender={(collapsed) => (
        <div
          style={{
            padding: '4px 0',
            borderTop: `1px solid ${siderTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)'}`,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="menu-collapse-button"
            style={{
              width: '100%',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              color: siderTextColor,
            }}
          />
        </div>
      )}
    >
      <PageTabs menuConfig={menuConfig}>{children}</PageTabs>
    </ProLayout>
    
    {/* 技术栈信息弹窗 */}
    <TechStackModal
      open={techStackModalOpen}
      onCancel={() => setTechStackModalOpen(false)}
    />
    
    {/* 主题编辑面板 */}
    <ThemeEditor
      open={themeEditorOpen}
      onClose={() => setThemeEditorOpen(false)}
      onThemeUpdate={(themeConfig) => {
        // 主题更新回调（可选）
        console.log('主题配置已更新:', themeConfig);
      }}
    />
    </>
  );
}

