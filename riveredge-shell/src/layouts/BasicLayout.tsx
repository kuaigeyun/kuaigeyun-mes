/**
 * RiverEdge SaaS 多组织框架 - 基础布局组件
 * 
 * 使用 ProLayout 实现现代化页面布局，集成状态管理和权限控制
 */

import { ProLayout } from '@ant-design/pro-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
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
} from '@ant-design/icons';
import { Avatar, Dropdown, Space, message, Button } from 'antd';
import type { MenuProps } from 'antd';
import TenantSelector from '@/components/TenantSelector';
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
const getUserMenuItems = (logout: () => void): MenuProps['items'] => [
  {
    key: 'profile',
    icon: <UserSwitchOutlined />,
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

/**
 * 基础布局组件
 */
export default function BasicLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { currentUser, logout } = useGlobalStore();

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

  return (
    <>
      {/* 自定义分组标题样式 */}
      <style>{`
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
        actionsRender={() => {
          const actions = [];
          
          // 添加用户头像和下拉菜单
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
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar
                    size="small"
                    src={currentUser.avatar}
                    style={{ backgroundColor: '#1890ff' }}
                  >
                    {currentUser.username?.[0]?.toUpperCase()}
                  </Avatar>
                  <span>{currentUser.username}</span>
                </Space>
              </Dropdown>
            );
          }
          
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
      headerContentRender={() => <TenantSelector />}
      menuFooterRender={() => (
        <div style={{
          padding: '8px 4px',
          borderTop: '1px solid #f0f0f0',
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
      {children}
    </ProLayout>
    </>
  );
}

