/**
 * RiverEdge SaaS 多组织框架 - 基础布局组件
 * 
 * 使用 ProLayout 实现现代化页面布局，集成状态管理和权限控制
 */

import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { Spin } from 'antd';
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
import TenantSelector from '../components/tenant_selector';
import PageTabs from '../components/page_tabs';
import TechStackModal from '../components/tech-stack-modal';
import { getCurrentUser } from '../services/auth';
import { getCurrentPlatformSuperAdmin } from '../services/platformAdmin';
import { getToken, clearAuth, getUserInfo, getTenantId } from '../utils/auth';
import { useGlobalStore } from '../stores';

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
 * 菜单配置
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
 */
const menuConfig: MenuDataItem[] = [
  // ==================== 【第一组】固定仪表盘 ====================
  // 可见范围：平台级、系统级、应用级 都可见
  {
    path: '/system/dashboard',
    name: '仪表盘',
    icon: <DashboardOutlined />,
  },

  // ==================== 【第二组】应用菜单（插件式加载） ====================
  // 可见范围：根据用户权限和已安装插件动态加载
  // 注意：插件式的菜单按分组菜单设计，应用的名称作为分组名，不可点击，只显示
  // 插件里的菜单直接显示到左侧菜单
  // TODO: 后续从插件系统动态加载应用菜单
  {
    // 使用无 path 的菜单项作为分组标题，通过自定义渲染实现分组效果
    name: 'MES 制造执行系统',  // 分组标题，不可点击，只显示
    // 不设置 path，使其不可点击
    // 不设置 icon，使其显示为分组标题样式
    className: 'menu-group-title-plugin',  // 自定义样式选择器
  },
  // 应用下的菜单项直接显示在主菜单中（扁平化结构）
  {
    path: '/mes/production',
    name: '生产管理',
    icon: <ShopOutlined />,
    children: [
      {
        path: '/mes/production/plan',
        name: '生产计划',
      },
      {
        path: '/mes/production/workorder',
        name: '工单管理',
      },
      {
        path: '/mes/production/route',
        name: '工艺路线',
      },
    ],
  },
  {
    path: '/mes/quality',
    name: '质量管理',
    icon: <ExperimentOutlined />,
    children: [
      {
        path: '/mes/quality/inspection',
        name: '质检单',
      },
      {
        path: '/mes/quality/defect',
        name: '不良品管理',
      },
    ],
  },
  {
    path: '/mes/inventory',
    name: '库存管理',
    icon: <DatabaseOutlined />,
    children: [
      {
        path: '/mes/inventory/material',
        name: '原材料',
      },
      {
        path: '/mes/inventory/product',
        name: '成品库',
      },
    ],
  },

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
        name: '核心配置',
        label: '核心配置',
        className: 'riveredge-menu-group-title',
        children: [
          {
            path: '/system/applications',
            name: '应用中心',
            icon: <AppstoreOutlined />,
          },
          {
            path: '/system/menus',
            name: '菜单管理',
            icon: <UnorderedListOutlined />,
          },
          {
            path: '/system/site-settings',
            name: '站点设置',
            icon: <SettingOutlined />,
          },
          {
            path: '/system/system-parameters',
            name: '参数设置',
            icon: <SettingOutlined />,
          },
          {
            path: '/system/data-dictionaries',
            name: '数据字典',
            icon: <DatabaseOutlined />,
          },
          {
            path: '/system/code-rules',
            name: '编码规则',
            icon: <FileTextOutlined />,
          },
          {
            path: '/system/integration-configs',
            name: '集成设置',
            icon: <ApiOutlined />,
          },
          {
            path: '/system/languages',
            name: '语言管理',
            icon: <FileTextOutlined />,
          },
          {
            path: '/system/custom-fields',
            name: '自定义字段',
            icon: <AppstoreOutlined />,
          },
          {
            path: '/system/invitation-codes',
            name: '邀请码管理',
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
            path: '/system/inngest',
            name: 'Inngest服务',
            icon: <MonitorOutlined />,
          },
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
            path: '/system/electronic-records',
            name: '电子记录',
            icon: <FileTextOutlined />,
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
        name: '系统监控',
        icon: <MonitorOutlined />,
      },
      {
        path: '/platform/admin',
        name: '平台管理',
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
  const [collapsed, setCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [techStackModalOpen, setTechStackModalOpen] = useState(false);
  const { currentUser, logout } = useGlobalStore();

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
    const findMenuPath = (items: MenuDataItem[], targetPath: string, path: MenuDataItem[] = []): MenuDataItem[] | null => {
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
    
    if (menuPath) {
      menuPath.forEach((item, index) => {
        if (item.name && item.path) {
          // 检查是否有同级菜单（父级菜单有多个子项）
          let menu: { items: Array<{ key: string; label: string; onClick: () => void }> } | undefined;
          
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
            path: item.path,
            icon: item.icon,
            menu: menu,
          });
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
   */
  const handleLanguageChange = () => {
    message.info('语言切换功能开发中');
  };

  /**
   * 处理主题颜色切换
   */
  const handleThemeChange = () => {
    message.info('主题颜色配置功能开发中');
  };

  /**
   * 处理锁定屏幕
   */
  const handleLockScreen = () => {
    message.info('锁定屏幕功能开发中');
  };

  return (
    <>
      {/* 技术栈列表 Modal */}
      <TechStackModal
        open={techStackModalOpen}
        onCancel={() => setTechStackModalOpen(false)}
      />
      
      {/* 自定义分组标题样式 */}
      <style>{`
        /* ==================== PageContainer 相关 ==================== */
        .ant-pro-page-container .ant-page-header .ant-page-header-breadcrumb,
        .ant-pro-page-container .ant-breadcrumb {
          display: none !important;
        }
        .ant-pro-page-container .ant-pro-page-container-children-content {
          padding: 0 !important;
        }
        /* 全局页面边距：24px */
        .page-tabs-content .ant-pro-table {
          padding: 24px !important;
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
         */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-item-group-title {
          font-size: 14px !important;
          color: rgba(0, 0, 0, 0.45) !important;
          line-height: 1.5714285714285714 !important;
          font-weight: normal !important;
          padding: 12px 16px 12px 0 !important;
          margin: 0 0 8px 0 !important;
          border-bottom: 1px solid #f0f0f0 !important;
          background: transparent !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
        }
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
          color: rgba(0, 0, 0, 0.45) !important;
        }
        /* ==================== 一级菜单项 - 确保使用默认对齐 ==================== */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item {
          padding-left: 16px !important;
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
        .ant-menu-submenu-title {
          /* 子菜单标题的独立样式，与普通菜单项区分开 */
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          padding-right: 16px !important;
          height: 40px !important;
          line-height: 40px !important;
          color: rgba(0, 0, 0, 0.88) !important;
          font-size: 14px !important;
          font-weight: normal !important;
        }
        /* 子菜单标题悬浮状态 */
        .ant-menu-submenu-title:hover {
          background-color: rgba(0, 0, 0, 0.06) !important;
          color: rgba(0, 0, 0, 0.88) !important;
        }
        /* 子菜单标题激活状态 */
        .ant-menu-submenu-selected > .ant-menu-submenu-title {
          color: #1677ff !important;
        }
        /* 使用自定义样式选择器针对插件分组标题 */
        .menu-group-title-plugin {
          font-size: 12px !important;
          color: #8c8c8c !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
        }
        /* 系统菜单分组标题样式 */
        .menu-group-title-system {
          font-size: 12px !important;
          color: #8c8c8c !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
          margin-top: 8px !important;
        }
        /* 隐藏默认的收起按钮（在侧边栏顶部） */
        .ant-pro-layout .ant-pro-sider-collapsed-button {
          display: none !important;
        }
        .ant-pro-layout .ant-layout-sider-trigger {
          display: none !important;
        }
        /* 隐藏 ant-pro-layout-container 里的 footer */
        .ant-pro-layout-container .ant-pro-layout-footer {
          display: none !important;
        }
        .ant-pro-layout-container footer {
          display: none !important;
        }
        /* 菜单底部收起按钮 hover 效果：方形背景 */
        .menu-collapse-button:hover {
          background-color: rgba(0, 0, 0, 0.06) !important;
          border-radius: 4px !important;
        }
        .menu-collapse-button:active {
          background-color: rgba(0, 0, 0, 0.1) !important;
        }
        /* 隐藏左侧菜单栏滚动条，但保持滚轮滚动功能 */
        /* 使用通用选择器覆盖所有可能的滚动容器 */
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
        .ant-pro-sider-footer {
          margin-bottom: 10px !important;
          padding-bottom: 0 !important;
          border-top-color: #d9d9d9 !important;
        }
        /* 统一顶部和标签栏的透明度和 backdrop-filter */
        .ant-pro-layout .ant-pro-layout-header,
        .ant-pro-layout .ant-layout-header {
          background: rgba(255, 255, 255, 0.85) !important;
          backdrop-filter: blur(8px) !important;
          -webkit-backdrop-filter: blur(8px) !important;
        }
        /* 内容区背景颜色与 PageContainer 一致 */
        .ant-pro-layout-bg-list {
          background: #f0f2f5 !important;
        }
        /* 左侧菜单区单独设置背景色，与总体背景色区分开 */
        .ant-pro-layout .ant-pro-sider,
        .ant-pro-layout .ant-layout-sider,
        .ant-pro-layout .ant-pro-sider-menu {
          background: #fff !important;
        }
        /* 菜单栏增加与顶部间距 */
        .ant-pro-layout .ant-pro-sider-menu {
          padding-top: 8px !important;
        }
        /* 一级菜单激活状态 - 只有文字颜色，无背景色 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected {
          background-color: transparent !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected > .ant-menu-title-content > a {
          color: #1890ff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-item.ant-menu-item-selected::after {
          border-right-color: #1890ff !important;
        }
        /* 一级子菜单标题激活状态 - 只有文字颜色，无背景色 */
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title {
          background-color: transparent !important;
        }
        .ant-pro-layout .ant-pro-sider-menu > .ant-menu-submenu.ant-menu-submenu-selected > .ant-menu-submenu-title > .ant-menu-title-content {
          color: #1890ff !important;
        }
        
        /* 二级及以下菜单激活状态 - 有蓝色背景 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-selected,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-item-selected {
          background-color: #1890ff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-selected > .ant-menu-title-content > a,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-item-selected > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-item-selected > .ant-menu-title-content > a {
          color: #fff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-item-selected::after,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-item-selected::after {
          border-right-color: #1890ff !important;
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
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title:not(.ant-menu-item-group-title),
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title:not(.ant-menu-item-group-title) {
          background-color: transparent !important;
          background: transparent !important;
          color: rgba(0, 0, 0, 0.45) !important;
          border-bottom: 1px solid #f0f0f0 !important;
          
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
          color: rgba(0, 0, 0, 0.45) !important;
        }
        /* 确保分组标题不受子菜单激活状态影响 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected .ant-menu-item-group-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-item-group-title {
          background: transparent !important;
          color: rgba(0, 0, 0, 0.45) !important;
        }
        /* 顶栏右侧操作按钮样式优化 - 遵循 Ant Design 规范 */
        .ant-pro-layout .ant-pro-layout-header .ant-space {
          gap: 8px !important;
        }
        /* 统一按钮样式 - 深灰色图标，圆形淡灰色背景 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn {
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50% !important;
          background-color: rgba(0, 0, 0, 0.04) !important;
          border: none !important;
          transition: none !important;
          color: #595959 !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn .anticon {
          color: #595959 !important;
        }
        /* 禁用顶栏按钮的 hover/active 效果 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover,
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active {
          background-color: rgba(0, 0, 0, 0.04) !important;
          color: #595959 !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover .anticon,
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active .anticon {
          color: #595959 !important;
        }
        /* Badge 内按钮样式 - 确保按钮样式一致，完全禁用 hover */
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn {
          width: 32px !important;
          height: 32px !important;
          padding: 0 !important;
          border-radius: 50% !important;
          background-color: rgba(0, 0, 0, 0.04) !important;
          transition: none !important;
        }
        /* 完全禁用 Badge 内按钮的 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn:hover,
        .ant-pro-layout .ant-pro-layout-header .ant-badge:hover .ant-btn {
          background-color: rgba(0, 0, 0, 0.04) !important;
          color: #595959 !important;
          border-color: transparent !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-badge .ant-btn:hover .anticon {
          color: #595959 !important;
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
        /* 租户选择器内的选择框样式 - 胶囊型（与搜索框完全一致，使用相同的颜色值 #F5F5F5） */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-selector {
          border-radius: 16px !important; /* 胶囊型圆角 */
          border: none !important;
          box-shadow: none !important;
          background-color: #F5F5F5 !important;
          background: #F5F5F5 !important;
          height: 32px !important;
        }
        /* 租户选择器所有状态 - 确保颜色与搜索框完全一致（#F5F5F5） */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:hover .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select.ant-select-focused .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select:not(.ant-select-disabled):hover .ant-select-selector {
          border: none !important;
          box-shadow: none !important;
          background: #F5F5F5 !important;
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
        /* 搜索框样式 */
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper {
          border: none !important;
          box-shadow: none !important;
          background-color: rgba(0, 0, 0, 0.04) !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper:hover,
        .ant-pro-layout .ant-pro-layout-header .ant-input-affix-wrapper-focused {
          border: none !important;
          box-shadow: none !important;
          background-color: rgba(0, 0, 0, 0.04) !important;
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
          margin-left: 16px;
          padding-left: 30px;
          font-size: 14px;
          display: flex !important;
          align-items: center;
          height: 100%;
          position: relative;
          white-space: nowrap !important;
          overflow: visible !important;
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
        /* 面包屑前面的小竖线 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 1px;
          height: 16px;
          background-color: #d9d9d9;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb a {
          color: #595959;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb a:hover {
          color: #1890ff;
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
      `}</style>
      <ProLayout
        title="RiverEdge SaaS"
        logo="/img/logo.png"
        layout="mix"
        navTheme="light"
        contentWidth="Fluid"
        fixedHeader
        fixSiderbar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        location={location}
        contentStyle={{
          padding: 0,
          background: '#f0f2f5',
        }}
        headerContentRender={() => (
          <Breadcrumb
            style={{ 
              display: 'flex',
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
                    <span style={{ color: '#262626', fontWeight: 500 }}>{item.title}</span>
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
              prefix={<SearchOutlined style={{ fontSize: 16, color: '#595959' }} />}
              size="small"
              onPressEnter={(e) => {
                const value = (e.target as HTMLInputElement).value;
                handleSearch(value);
              }}
              style={{
                width: 280,
                height: 32,
                borderRadius: '16px',
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              }}
              allowClear
            />
          );

          // 消息提醒（带数量徽标）
          actions.push(
            <Tooltip key="notifications" title="消息通知">
              <Badge count={5} size="small" offset={[-8,8]}>
                <Button
                  type="text"
                  size="small"
                  icon={<BellOutlined style={{ fontSize: 16 }} />}
                  onClick={() => message.info('消息通知功能开发中')}
                />
              </Badge>
            </Tooltip>
          );
          
          // 语言切换
          actions.push(
            <Tooltip key="language" title="语言切换">
              <Button
                type="text"
                size="small"
                icon={<TranslationOutlined style={{ fontSize: 16 }} />}
                onClick={handleLanguageChange}
              />
            </Tooltip>
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
                    background: 'rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <Avatar
                    size={24}
                    src={(currentUser as any)?.avatar}
                    style={{
                      backgroundColor: '#595959',
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
                      color: '#262626',
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
            <Tooltip key="lock" title="锁定屏幕">
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
                color: '#8c8c8c',
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
        // 普通菜单项正常渲染
        // 如果是分组菜单下的子菜单项，通过 ref 设置正确的 padding-left
        return (
          <div
            onClick={() => {
              if (item.path && item.path !== location.pathname) {
                navigate(item.path);
              }
            }}
            style={{ cursor: item.path ? 'pointer' : 'default' }}
            ref={(el) => {
              if (el) {
                // 使用 setTimeout 确保 DOM 已渲染
                setTimeout(() => {
                  // 查找内部的 li 元素（Ant Design Menu 渲染的）
                  const liElement = el.querySelector('li.ant-menu-item') as HTMLElement;
                  if (liElement) {
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
      menuFooterRender={() => (
        <div style={{
          padding: '8px 4px',
          paddingBottom: 0,
          marginBottom: 0,
          borderTop: '1px solid #d9d9d9',
          textAlign: 'center',
        }}>
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
            }}
          />
        </div>
      )}
    >
      <PageTabs menuConfig={menuConfig}>{children}</PageTabs>
    </ProLayout>
    </>
  );
}

