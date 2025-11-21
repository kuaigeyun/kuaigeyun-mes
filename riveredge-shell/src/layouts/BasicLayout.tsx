/**
 * RiverEdge SaaS 多组织框架 - 基础布局组件
 * 
 * 使用 ProLayout 实现现代化页面布局，集成状态管理和权限控制
 */

import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
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
} from '@ant-design/icons';
import { message, Button, Tooltip, Badge, Avatar, Dropdown, Space, Input, Breadcrumb } from 'antd';
import type { MenuProps } from 'antd';
import TenantSelector from '@/components/TenantSelector';
import PageTabs from '@/components/PageTabs';
import { useGlobalStore } from '@/app';

/**
 * 菜单配置
 * 
 * 按照菜单分组架构设计：
 * 【第一组】固定仪表盘 - 平台级、系统级、应用级都可见
 * 【第二组】应用菜单（插件式加载）- 根据用户权限和已安装插件动态加载
 * 【第三组】系统菜单 - 平台级、系统级、应用级可见
 * 【第四组】运营中心 - 仅平台级管理员可见
 */
const menuConfig: MenuDataItem[] = [
  // ==================== 【第一组】固定仪表盘 ====================
  // 可见范围：平台级、系统级、应用级 都可见
  {
    path: '/dashboard',
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
      {
        path: '/users',
        name: '用户管理',
        icon: <UserOutlined />,
      },
      {
        path: '/roles',
        name: '角色管理',
        icon: <TeamOutlined />,
      },
      // 组织管理已移除，移至运营中心
      // {
      //   path: '/tenants',
      //   name: '组织管理',
      //   icon: <ApartmentOutlined />,
      // },
      // TODO: 后续添加
      // - 权限管理
      // - 系统配置（基础配置、参数配置、字典管理）
      // - 日志管理（操作日志、登录日志、系统日志）
    ],
  },

  // ==================== 【第四组】运营中心 ====================
  // 可见范围：仅平台级管理员可见
  {
    path: '/operations',
    name: '运营中心',
    icon: <GlobalOutlined />,
    children: [
      {
        path: '/operations/dashboard',
        name: '运营看板',
        icon: <DashboardOutlined />,
      },
      {
        path: '/operations/tenants',
        name: '组织管理',
        icon: <ApartmentOutlined />,
      },
      {
        path: '/operations/monitoring',
        name: '系统状态',
        icon: <MonitorOutlined />,
      },
      {
        path: '/operations/packages',
        name: '套餐管理',
        icon: <AppstoreOutlined />,
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
   * 获取用户菜单项
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
      case 'logout':
        logout();
        break;
    }
  };

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
  const filteredMenuData = useMemo(() => {
    if (!currentUser) return [];

    let menuItems = [...menuConfig];

    // 【第四组】运营中心：仅平台级管理员可见
    if (!currentUser.is_platform_admin) {
      menuItems = menuItems.filter(item => item.path !== '/operations');
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
      {/* 自定义分组标题样式 */}
      <style>{`
        /* 全局禁用 PageContainer 的默认面包屑 */
        .ant-pro-page-container .ant-page-header .ant-page-header-breadcrumb {
          display: none !important;
        }
        .ant-pro-page-container .ant-breadcrumb {
          display: none !important;
        }
        /* 分组标题样式：小字体、灰色、不可点击 */
        .ant-menu-item-group-title {
          font-size: 12px !important;
          color: #8c8c8c !important;
          font-weight: 500 !important;
          padding: 8px 16px !important;
          cursor: default !important;
          user-select: none !important;
          pointer-events: none !important;
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
        /* 去掉 ant-pro-sider-footer 的底部间距 */
        .ant-pro-sider-footer {
          margin-bottom: 10px !important;
          padding-bottom: 0 !important;
        }
        /* 加深顶部分割线颜色 */
        .ant-pro-sider-footer {
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
        /* 二级及以下子菜单标题激活状态 - 有蓝色背景 */
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title {
          background-color: #1890ff !important;
        }
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title > .ant-menu-title-content,
        .ant-pro-layout .ant-pro-sider-menu .ant-menu-submenu .ant-menu-submenu .ant-menu-submenu-selected > .ant-menu-submenu-title > .ant-menu-title-content {
          color: #fff !important;
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
        /* 禁用顶栏按钮的 hover 效果 */
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover {
          background-color: rgba(0, 0, 0, 0.04) !important;
          color: #595959 !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:hover .anticon {
          color: #595959 !important;
        }
        .ant-pro-layout .ant-pro-layout-header .ant-btn:active {
          background-color: rgba(0, 0, 0, 0.04) !important;
          color: #595959 !important;
        }
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
        /* 租户选择器样式 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper {
          padding: 4px 8px;
          border-radius: 4px;
          transition: none !important;
        }
        /* 禁用租户选择器的 hover 效果 */
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
        /* 面包屑样式 - 顶栏左侧，在 ant-pro-layout-container 内 */
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
          overflow: hidden;
          flex: 1;
          min-width: 0;
          max-width: calc(100% - 400px);
        }
        /* 面包屑内部容器防止换行 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb ol,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb ul {
          display: flex !important;
          flex-wrap: nowrap !important;
          white-space: nowrap !important;
          overflow: hidden;
        }
        /* 面包屑项防止换行 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item {
          white-space: nowrap !important;
          flex-shrink: 0 !important;
          display: inline-flex !important;
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
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb::before,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 1px;
          height: 16px;
          background-color: #d9d9d9;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb a,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb a {
          color: #595959;
        }
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb a:hover,
        .ant-pro-layout-container .ant-pro-layout-header .ant-breadcrumb a:hover {
          color: #1890ff;
        }
      `}</style>
      <ProLayout
        title="RiverEdge SaaS"
        logo="/logo.png"
        layout="mix"
        navTheme="light"
        primaryColor="#1890ff"
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
                  {item.icon && (
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
                    {currentUser.username?.[0]?.toUpperCase()}
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
                    {currentUser.username}
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
      onMenuHeaderClick={() => navigate('/dashboard')}
      menuItemRender={(item, dom) => {
        // 如果没有 path 且没有 icon，说明是分组标题，使用自定义样式渲染
        if (!item.path && !item.icon && item.className === 'menu-group-title-plugin') {
          return (
            <div
              className="menu-group-title-plugin"
              style={{
                fontSize: '12px',
                color: '#8c8c8c',
                fontWeight: 500,
                padding: '8px 16px',
                cursor: 'default',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            >
              {item.name}
            </div>
          );
        }
        return (
          <div
            onClick={() => {
              if (item.path && item.path !== location.pathname) {
                navigate(item.path);
              }
            }}
            style={{ cursor: item.path ? 'pointer' : 'default' }}
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

