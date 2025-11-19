/**
 * RiverEdge SaaS 多租户框架 - 基础布局组件
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
} from '@ant-design/icons';
import { Avatar, Dropdown, Space, message } from 'antd';
import type { MenuProps } from 'antd';
import TenantSelector from '@/components/TenantSelector';
import { useGlobalStore } from '@/app';

/**
 * 菜单配置
 */
const menuConfig: MenuDataItem[] = [
  {
    path: '/dashboard',
    name: '仪表盘',
    icon: <DashboardOutlined />,
  },
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
  {
    path: '/tenants',
    name: '租户管理',
    icon: <ApartmentOutlined />,
  },
  {
    path: '/superadmin',
    name: '超级管理员',
    icon: <CrownOutlined />,
    children: [
      {
        path: '/superadmin/tenants',
        name: '租户管理',
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

  // 根据用户权限过滤菜单
  const filteredMenuData = useMemo(() => {
    if (!currentUser) return [];

    let menuItems = [...menuConfig];

    // 如果不是超级管理员，隐藏超级管理员菜单
    if (!currentUser.is_superuser) {
      menuItems = menuItems.filter(item => item.path !== '/superadmin');
    }

    // 如果不是租户管理员且不是超级管理员，隐藏租户管理菜单
    if (!currentUser.is_tenant_admin && !currentUser.is_superuser) {
      menuItems = menuItems.filter(item => item.path !== '/tenants');
    }

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
    <ProLayout
      title="RiverEdge SaaS"
      logo="/logo.png"
      layout="mix"
      collapsed={collapsed}
      onCollapse={setCollapsed}
      location={location}
      menu={{
        request: async () => filteredMenuData,
      }}
      onMenuHeaderClick={() => navigate('/dashboard')}
      menuItemRender={(item, dom) => (
        <div
          onClick={() => {
            if (item.path && item.path !== location.pathname) {
              navigate(item.path);
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {dom}
        </div>
      )}
      headerContentRender={() => <TenantSelector />}
      rightContentRender={() => (
        <Space>
          {currentUser && (
            <Dropdown
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
          )}
        </Space>
      )}
      footerRender={() => (
        <div style={{
          textAlign: 'center',
          padding: '16px',
          color: '#666',
          fontSize: '12px'
        }}>
          © 2025 RiverEdge SaaS 多租户框架
        </div>
      )}
    >
      {children}
    </ProLayout>
  );
}

