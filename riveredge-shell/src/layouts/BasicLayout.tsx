/**
 * 基础布局组件
 * 
 * 使用 ProLayout 实现页面布局，包含顶部导航栏、侧边栏菜单等
 */

import { ProLayout } from '@ant-design/pro-components';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
// MenuDataItem 类型可以从 @ant-design/pro-components 导入
import type { MenuDataItem } from '@ant-design/pro-components';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  ApartmentOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import TenantSelector from '@/components/TenantSelector';

/**
 * 图标映射
 * 
 * 将字符串图标名称映射为实际的图标组件
 */
const iconMap: Record<string, React.ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  UserOutlined: <UserOutlined />,
  TeamOutlined: <TeamOutlined />,
  ApartmentOutlined: <ApartmentOutlined />,
  CrownOutlined: <CrownOutlined />,
};

/**
 * 菜单数据渲染
 * 
 * 处理菜单数据，将图标字符串转换为图标组件
 */
const menuDataRender = (menuList: MenuDataItem[]): MenuDataItem[] => {
  return menuList.map((item) => {
    // 处理图标：如果是字符串，从 iconMap 中获取；如果已经是组件，直接使用
    let icon = item.icon;
    if (typeof item.icon === 'string' && iconMap[item.icon]) {
      icon = iconMap[item.icon];
    }

    return {
      ...item,
      icon,
      children: item.children ? menuDataRender(item.children) : undefined,
    };
  });
};

/**
 * 路由配置（React Router 菜单配置）
 *
 * 定义所有菜单项的路由配置
 */
const routeConfig: MenuDataItem[] = [
  {
    path: '/dashboard',
    name: '仪表盘',
    icon: 'DashboardOutlined',
  },
  {
    path: '/user',
    name: '用户管理',
    icon: 'UserOutlined',
    children: [
      {
        path: '/user/list',
        name: '用户列表',
      },
    ],
  },
  {
    path: '/role',
    name: '角色管理',
    icon: 'TeamOutlined',
    children: [
      {
        path: '/role/list',
        name: '角色列表',
      },
    ],
  },
  {
    path: '/tenant',
    name: '租户管理',
    icon: 'ApartmentOutlined',
    children: [
      {
        path: '/tenant/list',
        name: '租户列表',
      },
    ],
  },
  {
    path: '/superadmin',
    name: '超级管理员',
    icon: 'CrownOutlined',
    children: [
      {
        path: '/superadmin/tenants',
        name: '租户管理',
        children: [
          {
            path: '/superadmin/tenants/list',
            name: '租户列表',
          },
        ],
      },
    ],
  },
];

/**
 * 基础布局组件
 */
export default function BasicLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // 过滤菜单项：移除 hideInMenu 为 true 的项
  const menuData = useMemo(() => {
    const filterMenu = (items: MenuDataItem[]): MenuDataItem[] => {
      return items
        .filter((item) => !item.hideInMenu)
        .map((item) => ({
          ...item,
          children: item.children ? filterMenu(item.children) : undefined,
        }));
    };
    return filterMenu(routeConfig);
  }, []);

  return (
    <ProLayout
      title="RiverEdge SaaS"
      logo="/logo.png"
      layout="mix"
      collapsed={collapsed}
      onCollapse={setCollapsed}
      location={location}
      menu={{
        request: async () => {
          // 返回菜单数据
          return menuData;
        },
      }}
      menuDataRender={menuDataRender}
      onMenuHeaderClick={() => navigate('/dashboard')}
      menuItemRender={(item, dom) => (
        <div onClick={() => item.path && navigate(item.path)}>{dom}</div>
      )}
      headerContentRender={() => <TenantSelector />}
      footerRender={() => null}
    >
      <Outlet />
    </ProLayout>
  );
}

