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
import { message, Button, Tooltip, Badge, Avatar, Dropdown, Space, Input, Breadcrumb } from 'antd';
import type { MenuProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import TenantSelector from '../components/tenant-selector';
import UniTabs from '../components/uni-tabs';
import TechStackModal from '../components/tech-stack-modal';
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

// 权限守卫组件
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { currentUser, loading, setCurrentUser, setLoading } = useGlobalStore();

  // 检查用户类型（平台超级管理员还是系统级用户）
  const userInfo = getUserInfo();
  const isInfraSuperAdmin = userInfo?.user_type === 'infra_superadmin';

  // 检查是否访问系统级页面
  const isSystemPage = location.pathname.startsWith('/system/');
  const currentTenantId = getTenantId();

  // 如果是平台超级管理员访问系统级页面，但没有选择组织，则重定向到平台首页
  if (isInfraSuperAdmin && isSystemPage && !currentTenantId) {
    message.warning('请先选择要管理的组织');
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
        // 没有本地缓存时，清理认证信息
        if ((error as any)?.response?.status === 401) {
          console.error('❌ 认证已过期，请重新登录:', error);
          clearAuth();
          setCurrentUser(undefined);
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
  const publicPaths = ['/login'];
  // 平台登录页是公开的，但其他平台页面需要登录
  const isInfraLoginPage = location.pathname === '/infra/login';
  const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path)) || isInfraLoginPage;

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
    // 普通用户登录后，如果访问的是登录页，重定向到系统仪表盘
    if (location.pathname === '/login' && !currentUser.is_infra_admin) {
      return <Navigate to="/system/dashboard" replace />;
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
  // 根据菜单名称和路径映射到制造业图标
  // 只对制造业相关的菜单使用制造业图标，系统配置类菜单继续使用 Ant Design 图标
  const iconMap: Record<string, React.ComponentType<any>> = {
    // 仪表盘相关 - 使用工业仪表盘图标，增强工业关联度
    '仪表盘': ManufacturingIcons.industrialDashboard, // 使用 Gauge 仪表盘图标
    '工作台': ManufacturingIcons.production,
    '分析页': ManufacturingIcons.chartLine,
    '运营看板': ManufacturingIcons.analytics,
    
    // 用户管理相关 - 使用安全和组织图标
    '角色权限': ManufacturingIcons.quality,
    '部门管理': ManufacturingIcons.building,
    '职位管理': ManufacturingIcons.tool,
    '账户管理': ManufacturingIcons.safety,
    
    // 核心配置 - 使用工业齿轮图标，增强工业关联度
    '系统配置': ManufacturingIcons.systemConfig, // 使用齿轮图标，更符合工业系统配置
    '应用中心': ManufacturingIcons.factory,
    '菜单管理': ManufacturingIcons.checklist,
    '站点设置': ManufacturingIcons.mdSettings,
    '参数设置': ManufacturingIcons.mdConfiguration,
    '数据字典': ManufacturingIcons.warehouse, // 使用仓库图标表示数据存储
    '编码规则': ManufacturingIcons.mdPrecision,
    '集成设置': ManufacturingIcons.automation,
    '语言管理': ManufacturingIcons.clipboardList, // 使用清单图标
    '自定义字段': ManufacturingIcons.toolbox,
    '邀请码管理': ManufacturingIcons.clipboardCheck, // 使用检查清单图标
    
    // 数据中心 - 使用仓储和库存图标
    '文件管理': ManufacturingIcons.box, // 使用箱子图标
    '接口管理': ManufacturingIcons.automation,
    '数据源管理': ManufacturingIcons.warehouse,
    '数据集管理': ManufacturingIcons.inventory,
    
    // 流程管理 - 使用生产线和检查图标
    '消息配置': ManufacturingIcons.clipboardList, // 使用清单图标
    '消息模板': ManufacturingIcons.clipboardList,
    '定时任务': ManufacturingIcons.mdSettings,
    '审批流程': ManufacturingIcons.productionLine,
    '审批实例': ManufacturingIcons.checkCircle,
    '脚本管理': ManufacturingIcons.mdPrecision,
    '打印模板': ManufacturingIcons.clipboardList,
    '打印设备': ManufacturingIcons.machine, // 使用机器图标
    
    // 个人中心 - 使用安全和个人相关图标
    '个人中心': ManufacturingIcons.safety, // 使用安全帽图标
    '个人资料': ManufacturingIcons.safety,
    '偏好设置': ManufacturingIcons.mdSettings,
    '我的消息': ManufacturingIcons.clipboardList,
    '我的任务': ManufacturingIcons.checklist,
    
    // 监控运维 - 使用仓储和检查图标
    '操作日志': ManufacturingIcons.clipboardList,
    '登录日志': ManufacturingIcons.clipboardList,
    '在线用户': ManufacturingIcons.safety, // 使用安全帽图标表示人员
    '数据备份': ManufacturingIcons.warehouse,
    
    // 运营中心 - 使用工厂图标，增强工业关联度
    '运营中心': ManufacturingIcons.operationsCenter, // 使用工厂图标，更符合工业运营中心
    '组织管理': ManufacturingIcons.building,
    '套餐管理': ManufacturingIcons.shoppingBag, // 使用购物袋图标
    '系统监控': ManufacturingIcons.analytics, // 使用分析图标
    '流程后台': ManufacturingIcons.automation,
    '平台管理': ManufacturingIcons.quality, // 使用质量图标表示管理
    
    // MES 相关菜单 - 使用工厂图标，增强工业关联度
    '快格轻MES': ManufacturingIcons.production, // 使用生产图标，更符合制造执行系统
    '生产计划': ManufacturingIcons.checklist, // 使用清单图标，更符合生产计划场景
    '生产执行': ManufacturingIcons.production, // 使用生产趋势图标，更符合生产执行场景
    '物料管理': ManufacturingIcons.warehouse, // 使用仓库图标，更符合工业物料管理场景
    '质量管控': ManufacturingIcons.quality, // 使用质量盾牌图标，更符合质量管控场景
    '工单管理': ManufacturingIcons.checklist,
    '生产排程': ManufacturingIcons.productionLine,
    '实时报工': ManufacturingIcons.production,
    '进度跟踪': ManufacturingIcons.chartLine,
    '库存明细': ManufacturingIcons.inventory,
    '出入库操作': ManufacturingIcons.warehouse,
    '质检标准': ManufacturingIcons.quality,
    '质量追溯': ManufacturingIcons.inspection,
    '不良品处理': ManufacturingIcons.exclamationTriangle,
  };
  
  // 优先使用菜单名称匹配
  if (iconMap[menuName]) {
    const IconComponent = iconMap[menuName];
    return React.createElement(IconComponent, { size: 16 });
  }
  
  // 如果名称不匹配，尝试根据路径匹配
  if (menuPath) {
    const pathMap: Record<string, React.ComponentType<any>> = {
      '/system': ManufacturingIcons.systemConfig, // 系统配置（使用齿轮图标，更工业）
      '/system/dashboard': ManufacturingIcons.industrialDashboard, // 工业仪表盘
      '/system/roles': ManufacturingIcons.quality,
      '/system/departments': ManufacturingIcons.building,
      '/system/positions': ManufacturingIcons.tool,
      '/system/users': ManufacturingIcons.safety,
      '/system/applications': ManufacturingIcons.factory,
      '/system/menus': ManufacturingIcons.checklist,
      '/system/site-settings': ManufacturingIcons.mdSettings,
      '/system/system-parameters': ManufacturingIcons.mdConfiguration,
      '/system/data-dictionaries': ManufacturingIcons.warehouse,
      '/system/code-rules': ManufacturingIcons.mdPrecision,
      '/system/integration-configs': ManufacturingIcons.automation,
      '/system/languages': ManufacturingIcons.clipboardList,
      '/system/custom-fields': ManufacturingIcons.toolbox,
      '/system/files': ManufacturingIcons.box,
      '/system/apis': ManufacturingIcons.automation,
      '/system/data-sources': ManufacturingIcons.warehouse,
      '/system/datasets': ManufacturingIcons.inventory,
      '/system/messages/config': ManufacturingIcons.clipboardList,
      '/system/messages/template': ManufacturingIcons.clipboardList,
      '/system/scheduled-tasks': ManufacturingIcons.mdSettings,
      '/system/approval-processes': ManufacturingIcons.productionLine,
      '/system/approval-instances': ManufacturingIcons.checkCircle,
      '/system/scripts': ManufacturingIcons.mdPrecision,
      '/system/print-templates': ManufacturingIcons.clipboardList,
      '/system/print-devices': ManufacturingIcons.machine,
      '/personal': ManufacturingIcons.safety,
      '/system/operation-logs': ManufacturingIcons.clipboardList,
      '/system/login-logs': ManufacturingIcons.clipboardList,
      '/system/online-users': ManufacturingIcons.safety,
      '/system/data-backups': ManufacturingIcons.warehouse,
      '/infra/operation': ManufacturingIcons.operationsCenter, // 运营中心
      '/infra/tenants': ManufacturingIcons.building,
      '/infra/packages': ManufacturingIcons.shoppingBag,
      '/infra/monitoring': ManufacturingIcons.analytics,
      '/infra/inngest': ManufacturingIcons.automation,
      '/infra/admin': ManufacturingIcons.quality,
      
      // MES 相关路径
      '/apps/kuaimes': ManufacturingIcons.production, // MES 制造执行系统（生产图标）
      '/apps/kuaimes/planning': ManufacturingIcons.checklist, // 生产计划 - 清单图标
      '/apps/kuaimes/execution': ManufacturingIcons.production, // 生产执行 - 生产趋势图标
      '/apps/kuaimes/material': ManufacturingIcons.warehouse, // 物料管理 - 仓库图标
      '/apps/kuaimes/quality': ManufacturingIcons.quality, // 质量管控 - 质量盾牌图标
    };
    
    if (pathMap[menuPath]) {
      const IconComponent = pathMap[menuPath];
      return React.createElement(IconComponent, { size: 16 });
    }
  }
  
  // 如果找不到匹配的图标，返回默认的 Lucide 图标（LayoutDashboard）
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
    name: t('menu.dashboard') || '仪表盘',
    icon: getMenuIcon(t('menu.dashboard') || '仪表盘', '/system/dashboard'),
    children: [
      {
        path: '/system/dashboard/workplace',
        name: t('menu.dashboard.workplace') || '工作台',
        icon: getMenuIcon(t('menu.dashboard.workplace') || '工作台', '/system/dashboard/workplace'),
      },
      {
        path: '/system/dashboard/analysis',
        name: t('menu.dashboard.analysis') || '分析页',
        icon: getMenuIcon(t('menu.dashboard.analysis') || '分析页', '/system/dashboard/analysis'),
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
    icon: getMenuIcon('系统配置', '/system'),
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
            name: '角色权限',
            icon: getMenuIcon('角色权限', '/system/roles'),
          },
          {
            path: '/system/departments',
            name: '部门管理',
            icon: getMenuIcon('部门管理', '/system/departments'),
          },
          {
            path: '/system/positions',
            name: '职位管理',
            icon: getMenuIcon('职位管理', '/system/positions'),
          },
          {
            path: '/system/users',
            name: '账户管理',
            icon: getMenuIcon('账户管理', '/system/users'),
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
            icon: getMenuIcon(t('menu.system.applications') || '应用中心', '/system/applications'),
          },
          {
            path: '/system/menus',
            name: t('menu.system.menus') || '菜单管理',
            icon: getMenuIcon(t('menu.system.menus') || '菜单管理', '/system/menus'),
          },
          {
            path: '/system/site-settings',
            name: t('menu.system.site-settings') || '站点设置',
            icon: getMenuIcon(t('menu.system.site-settings') || '站点设置', '/system/site-settings'),
          },
          {
            path: '/system/system-parameters',
            name: t('menu.system.system-parameters') || '参数设置',
            icon: getMenuIcon(t('menu.system.system-parameters') || '参数设置', '/system/system-parameters'),
          },
          {
            path: '/system/data-dictionaries',
            name: t('menu.system.data-dictionaries') || '数据字典',
            icon: getMenuIcon(t('menu.system.data-dictionaries') || '数据字典', '/system/data-dictionaries'),
          },
          {
            path: '/system/code-rules',
            name: t('menu.system.code-rules') || '编码规则',
            icon: getMenuIcon(t('menu.system.code-rules') || '编码规则', '/system/code-rules'),
          },
          {
            path: '/system/integration-configs',
            name: t('menu.system.integration-configs') || '集成设置',
            icon: getMenuIcon(t('menu.system.integration-configs') || '集成设置', '/system/integration-configs'),
          },
          {
            path: '/system/languages',
            name: t('menu.system.languages') || '语言管理',
            icon: getMenuIcon(t('menu.system.languages') || '语言管理', '/system/languages'),
          },
          {
            path: '/system/custom-fields',
            name: t('menu.system.custom-fields') || '自定义字段',
            icon: getMenuIcon(t('menu.system.custom-fields') || '自定义字段', '/system/custom-fields'),
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
            icon: getMenuIcon('文件管理', '/system/files'),
          },
          {
            path: '/system/apis',
            name: '接口管理',
            icon: getMenuIcon('接口管理', '/system/apis'),
          },
          {
            path: '/system/data-sources',
            name: '数据源管理',
            icon: getMenuIcon('数据源管理', '/system/data-sources'),
          },
          {
            path: '/system/datasets',
            name: '数据集管理',
            icon: getMenuIcon('数据集管理', '/system/datasets'),
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
            icon: getMenuIcon('消息配置', '/system/messages/config'),
          },
          {
            path: '/system/messages/template',
            name: '消息模板',
            icon: getMenuIcon('消息模板', '/system/messages/template'),
          },
          {
            path: '/system/scheduled-tasks',
            name: '定时任务',
            icon: getMenuIcon('定时任务', '/system/scheduled-tasks'),
          },
          {
            path: '/system/approval-processes',
            name: '审批流程',
            icon: getMenuIcon('审批流程', '/system/approval-processes'),
          },
          {
            path: '/system/approval-instances',
            name: '审批实例',
            icon: getMenuIcon('审批实例', '/system/approval-instances'),
          },
          {
            path: '/system/scripts',
            name: '脚本管理',
            icon: getMenuIcon('脚本管理', '/system/scripts'),
          },
          {
            path: '/system/print-templates',
            name: '打印模板',
            icon: getMenuIcon('打印模板', '/system/print-templates'),
          },
          {
            path: '/system/print-devices',
            name: '打印设备',
            icon: getMenuIcon('打印设备', '/system/print-devices'),
          },
        ],
      },
      {
        path: '/personal',
        name: '个人中心',
        icon: getMenuIcon('个人中心', '/personal'),
        children: [
          {
            path: '/personal/profile',
            name: '个人资料',
            icon: getMenuIcon('个人资料', '/personal/profile'),
          },
          {
            path: '/personal/preferences',
            name: '偏好设置',
            icon: getMenuIcon('偏好设置', '/personal/preferences'),
          },
          {
            path: '/personal/messages',
            name: '我的消息',
            icon: getMenuIcon('我的消息', '/personal/messages'),
          },
          {
            path: '/personal/tasks',
            name: '我的任务',
            icon: getMenuIcon('我的任务', '/personal/tasks'),
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
            icon: getMenuIcon('操作日志', '/system/operation-logs'),
          },
          {
            path: '/system/login-logs',
            name: '登录日志',
            icon: getMenuIcon('登录日志', '/system/login-logs'),
          },
          {
            path: '/system/online-users',
            name: '在线用户',
            icon: getMenuIcon('在线用户', '/system/online-users'),
          },
          {
            path: '/system/data-backups',
            name: '数据备份',
            icon: getMenuIcon('数据备份', '/system/data-backups'),
          },
        ],
      },
    ],
  },

  // ==================== 【第四组】运营中心 ====================
  // 可见范围：仅平台级管理员可见
  {
    // 父菜单不设置 path，避免与子菜单路径冲突
    name: '运营中心',
    icon: getMenuIcon('运营中心', '/infra/operation'),
    children: [
      {
        path: '/infra/operation',
        name: '运营看板',
        icon: getMenuIcon('运营看板', '/infra/operation'),
      },
      {
        path: '/infra/tenants',
        name: '组织管理',
        icon: getMenuIcon('组织管理', '/infra/tenants'),
      },
      {
        path: '/infra/packages',
        name: '套餐管理',
        icon: getMenuIcon('套餐管理', '/infra/packages'),
      },
      {
        path: '/infra/monitoring',
        name: t('menu.infra.monitoring') || '系统监控',
        icon: getMenuIcon(t('menu.infra.monitoring') || '系统监控', '/infra/monitoring'),
      },
      {
        path: '/infra/inngest',
        name: t('menu.infra.inngest') || '流程后台',
        icon: getMenuIcon(t('menu.infra.inngest') || '流程后台', '/infra/inngest'),
      },
      {
        path: '/infra/admin',
        name: t('menu.infra.admin') || '平台管理',
        icon: getMenuIcon(t('menu.infra.admin') || '平台管理', '/infra/admin'),
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
  const [layoutMode, setLayoutMode] = useState<'mix' | 'mix-integrated'>('mix');
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
  
  // 获取应用菜单（仅获取已安装且启用的应用的菜单）
  // 开发环境下：不缓存，窗口聚焦时刷新，确保菜单配置修改后立即生效
  // 生产环境下：正常缓存，减少请求
  const { data: applicationMenus, isLoading: applicationMenusLoading } = useQuery({
    queryKey: ['applicationMenus'],
    queryFn: () => getMenuTree({ is_active: true }),
    staleTime: process.env.NODE_ENV === 'development' ? 0 : 1 * 60 * 1000, // 开发环境不缓存，生产环境1分钟缓存
    refetchInterval: false, // 不自动轮询刷新，避免菜单逐个出现
    refetchOnWindowFocus: process.env.NODE_ENV === 'development' ? true : false, // 开发环境窗口聚焦时刷新
    refetchOnMount: true, // 组件挂载时刷新
    select: (data) => {
      // 只返回应用菜单（application_uuid 不为空）
      const appMenus = data.filter(menu => menu.application_uuid);
      return appMenus;
    },
  });
  
  /**
   * 将 MenuTree 转换为 MenuDataItem
   */
  const convertMenuTreeToMenuDataItem = React.useCallback((menu: MenuTree): MenuDataItem => {
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
          'DashboardOutlined': ManufacturingIcons.dashboard,
          'UserOutlined': ManufacturingIcons.user,
          'TeamOutlined': ManufacturingIcons.team,
          'ApartmentOutlined': ManufacturingIcons.building,
          'CrownOutlined': ManufacturingIcons.crown,
          'AppstoreOutlined': ManufacturingIcons.appstore,
          'ControlOutlined': ManufacturingIcons.control,
          'ShopOutlined': ManufacturingIcons.shop,
          'FileTextOutlined': ManufacturingIcons.fileCode,
          'DatabaseOutlined': ManufacturingIcons.database,
          'MonitorOutlined': ManufacturingIcons.monitor,
          'GlobalOutlined': ManufacturingIcons.global,
          'ApiOutlined': ManufacturingIcons.api,
          'CodeOutlined': ManufacturingIcons.code,
          'PrinterOutlined': ManufacturingIcons.printer,
          'HistoryOutlined': ManufacturingIcons.history,
          'UnorderedListOutlined': ManufacturingIcons.list,
          'CalendarOutlined': ManufacturingIcons.calendar,
          'PlayCircleOutlined': ManufacturingIcons.playCircle,
          'InboxOutlined': ManufacturingIcons.inbox,
          'SafetyOutlined': ManufacturingIcons.safety,
          'ShoppingOutlined': ManufacturingIcons.shop,
          'UserSwitchOutlined': ManufacturingIcons.userSwitch,
          'SettingOutlined': ManufacturingIcons.mdSettings,
          'BellOutlined': ManufacturingIcons.bell,
          'LoginOutlined': ManufacturingIcons.login,
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

    const menuItem: MenuDataItem = {
      path: menu.path,
      name: menu.name,
      icon: iconElement,
      key: menu.uuid || menu.path, // 添加 key 字段，ProLayout 需要
      // 如果菜单有子项，确保子项也有 key
      children: menu.children && menu.children.length > 0
        ? menu.children.map(child => convertMenuTreeToMenuDataItem(child))
        : undefined,
    };

    // 如果菜单没有 path，说明是分组标题，需要特殊处理
    if (!menu.path && menu.children && menu.children.length > 0) {
      // 对于有子菜单但没有 path 的菜单项，ProLayout 会将其作为分组标题处理
      // 但我们需要确保子菜单能正确显示
      menuItem.path = undefined; // 明确设置为 undefined
    }

    return menuItem;
  }, []);
  
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

  // 初始化布局模式配置
  useEffect(() => {
    const THEME_CONFIG_STORAGE_KEY = 'riveredge_theme_config';
    try {
      const savedThemeConfig = localStorage.getItem(THEME_CONFIG_STORAGE_KEY);
      if (savedThemeConfig) {
        const themeConfig = JSON.parse(savedThemeConfig);
        const savedLayoutMode = themeConfig.layoutMode || 'mix';
        setLayoutMode(savedLayoutMode);
        (window as any).__RIVEREDGE_LAYOUT_MODE__ = savedLayoutMode;
      }
    } catch (error) {
      console.warn('Failed to load layout mode from localStorage:', error);
    }
  }, []);

  // 监听主题更新事件，实时更新菜单栏背景色
  useEffect(() => {
    const handleThemeUpdate = (event?: any) => {
      // 延迟一下，确保全局变量已经更新
      setTimeout(() => {
        const customBgColor = (window as any).__RIVEREDGE_SIDER_BG_COLOR__;
        const themeConfig = event?.detail?.themeConfig || {};
        const currentLayoutMode = themeConfig.layoutMode || (window as any).__RIVEREDGE_LAYOUT_MODE__ || 'mix';
        setSiderBgColorState(customBgColor);
        setLayoutMode(currentLayoutMode);

        // 设置全局变量供其他组件使用
        (window as any).__RIVEREDGE_LAYOUT_MODE__ = currentLayoutMode;
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
   * 将路径片段转换为中文名称（作为后备方案）
   */
  const translatePathSegmentToChinese = (segment: string): string => {
    const pathMap: Record<string, string> = {
      // 工厂数据
      'workshops': '车间',
      'production-lines': '产线',
      'workstations': '工位',
      'factory': '工厂数据',
      // 仓库数据
      'warehouses': '仓库',
      'storage-areas': '库区',
      'storage-locations': '库位',
      'warehouse': '仓库数据',
      // 物料数据
      'groups': '物料分组',
      'materials': '物料数据',
      'bom': 'BOM',
      'list': '物料管理',
      // 工艺数据
      'defect-types': '不良品',
      'operations': '工序',
      'routes': '工艺路线',
      'sop': '作业程序',
      'process': '工艺数据',
      // 供应链数据
      'customers': '客户',
      'suppliers': '供应商',
      'supply-chain': '供应链数据',
      // 绩效数据
      'holidays': '假期',
      'skills': '技能',
      'performance': '绩效数据',
      // 应用路径
      'master-data': '基础数据管理',
      'apps': '应用',
    };
    
    return pathMap[segment] || segment;
  };
  
  /**
   * 根据完整路径转换为中文名称（更精确的匹配）
   */
  const translateFullPathToChinese = (path: string): string => {
    const fullPathMap: Record<string, string> = {
      '/apps/master-data/materials': '物料数据',
      '/apps/master-data/materials/list': '物料管理',
      '/apps/master-data/materials/bom': 'BOM',
      '/apps/master-data/factory/workshops': '车间',
      '/apps/master-data/factory/production-lines': '产线',
      '/apps/master-data/factory/workstations': '工位',
      '/apps/master-data/warehouse/warehouses': '仓库',
      '/apps/master-data/warehouse/storage-areas': '库区',
      '/apps/master-data/warehouse/storage-locations': '库位',
    };
    
    return fullPathMap[path] || translatePathSegmentToChinese(path.split('/').pop() || '');
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
      // 如果没有找到匹配的菜单项，使用路径作为面包屑，并转换为中文
      const pathSegments = location.pathname.split('/').filter(Boolean);
      pathSegments.forEach((segment, index) => {
        const path = '/' + pathSegments.slice(0, index + 1).join('/');
        // 优先使用完整路径匹配，如果失败则使用路径片段匹配
        const chineseTitle = translateFullPathToChinese(path) || translatePathSegmentToChinese(segment);
        breadcrumbItems.push({
          title: chineseTitle,
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
      
      // 遍历每个应用，将应用的子菜单提升到主菜单级别
      applicationMenus.forEach(appMenu => {
        if (appMenu.children && appMenu.children.length > 0) {
          // 1. 先添加应用名称作为分组标题（仅在菜单展开时显示）
          // 使用 Ant Design 原生的 type: 'group' 来创建分组标题（与系统级菜单保持一致）
          // 注意：即使子菜单已经提升到主菜单级别，group 仍然需要 children 才能被渲染
          // 所以我们创建一个临时的子菜单项，然后在 menuItemRender 中处理
          // 菜单收起时不显示分组标题
          if (!collapsed) {
            const groupTitle: MenuDataItem = {
              name: appMenu.name,
              label: appMenu.name, // Ant Design Menu 使用 label 显示分组标题
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
            const converted = convertMenuTreeToMenuDataItem(childMenu);
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
    if (!currentUser.is_infra_admin) {
      menuItems = menuItems.filter(item => item.name !== '运营中心');
    }

    // 注意：组织管理已从第三组移除，移至运营中心（第四组）
    // 因此不再需要过滤第三组的组织管理菜单

    return menuItems;
  }, [currentUser, applicationMenus, convertMenuTreeToMenuDataItem, collapsed]);

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
        .uni-tabs-content .ant-pro-table {
          padding: 16px !important;
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
          padding-right: 16px !important;
          color: ${siderTextColor} !important;
          font-size: var(--ant-fontSize) !important;
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
        /* ==================== 全局滚动条样式 ==================== */
        /* 隐藏整个页面的滚动条，只保留UniTable的滚动条 */
        html::-webkit-scrollbar,
        body::-webkit-scrollbar,
        .ant-pro-layout::-webkit-scrollbar,
        .ant-pro-layout-container::-webkit-scrollbar,
        .ant-pro-page-container::-webkit-scrollbar,
        .ant-pro-layout-content::-webkit-scrollbar,
        .ant-layout::-webkit-scrollbar,
        .ant-layout-content::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        html,
        body,
        .ant-pro-layout,
        .ant-pro-layout-container,
        .ant-pro-page-container,
        .ant-pro-layout-content,
        .ant-layout,
        .ant-layout-content {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
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
        /* ==================== UniTable 滚动条样式 ==================== */
        /* UniTable 组件滚动条样式 */
        .uni-table-pro-table .ant-table-container::-webkit-scrollbar,
        .uni-table-pro-table .ant-table-body::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .uni-table-pro-table .ant-table-container::-webkit-scrollbar-track,
        .uni-table-pro-table .ant-table-body::-webkit-scrollbar-track {
          background: ${token.colorFillTertiary};
          border-radius: 4px;
        }
        .uni-table-pro-table .ant-table-container::-webkit-scrollbar-thumb,
        .uni-table-pro-table .ant-table-body::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'};
          border-radius: 4px;
        }
        .uni-table-pro-table .ant-table-container::-webkit-scrollbar-thumb:hover,
        .uni-table-pro-table .ant-table-body::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'};
        }
        /* Firefox UniTable 滚动条样式 */
        .uni-table-pro-table .ant-table-container,
        .uni-table-pro-table .ant-table-body {
          scrollbar-width: thin;
          scrollbar-color: ${isDarkMode ? 'rgba(255, 255, 255, 0.3) ' + token.colorFillTertiary : 'rgba(0, 0, 0, 0.3) ' + token.colorFillTertiary};
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
        /* 租户选择器 wrapper 内的 span（系统级用户显示组织名称） - 胶囊型背景 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper > span {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 16px !important;
          background-color: ${token.colorFillTertiary} !important;
          color: ${token.colorText} !important;
          font-size: 14px;
          font-weight: 500;
          height: 32px;
          line-height: 24px;
        }
        /* 租户选择器内的选择框样式 - 胶囊型（与搜索框完全一致，使用 token 值） */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-selector,
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select-selector {
          border-radius: 16px !important; /* 胶囊型圆角 */
          border: none !important;
          box-shadow: none !important;
          background-color: ${token.colorFillTertiary} !important;
          background: ${token.colorFillTertiary} !important;
          height: 32px !important;
        }
        .ant-select-content-value{
          padding-left: 10px !important;
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
        /* 租户选择器切换图标样式 - 确保在右侧 */
        .ant-pro-layout .ant-pro-layout-header .tenant-selector-wrapper .ant-select .ant-select-arrow {
          right: 8px !important;
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
          align-items: center !important;
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
        }
        /* 面包屑下拉箭头对齐 */
        .ant-pro-layout-container .ant-layout-header .ant-breadcrumb .ant-breadcrumb-item .anticon {
          display: inline-flex !important;
          align-items: center !important;
          vertical-align: middle !important;
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
        logo={layoutMode === 'mix-integrated' ? false : "/img/logo.png"} // 融合模式下禁用顶栏LOGO
        layout="mix" // 恢复到mix布局
        navTheme={isDarkMode ? "realDark" : "light"}
        className={layoutMode === 'mix-integrated' ? 'ant-pro-layout-mix-integrated' : ''}
        // 根据布局模式调整头部渲染
        {...(layoutMode === 'mix-integrated' ? {
          // MIX融合模式：修改左侧菜单栏头部样式，让LOGO与菜单栏视觉融合
          menuHeaderRender: (logo: React.ReactNode, title: React.ReactNode, props: any) => (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              height: '64px',
              background: token.colorBgContainer,
              borderRight: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              borderBottom: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              // 让侧边栏头部到顶
              position: 'fixed',
              top: 0,
              left: 0,
              right: 'auto',
              width: '208px',
              zIndex: 1001,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* 自定义更大的LOGO */}
                <img
                  src="/img/logo.png"
                  alt="RiverEdge SaaS"
                  style={{
                    height: '48px', // 增大LOGO尺寸
                    width: 'auto',
                  }}
                />
                {/* 调整字体大小 */}
                <span style={{
                  fontSize: '14px', // 减小字体大小
                  fontWeight: 600,
                  color: token.colorText,
                  whiteSpace: 'nowrap',
                }}>
                  RiverEdge SaaS
                </span>
              </div>
              {/* 为融合模式添加特殊样式，让菜单内容在头部下面开始 */}
              <style dangerouslySetInnerHTML={{
                __html: `
                  .ant-pro-layout-mix-integrated .ant-pro-sider-menu {
                    padding-top: 72px !important;
                  }
                `
              }} />
            </div>
          ),
        } : {})}
        collapsedButtonRender={(collapsed) => (
        <div
          style={{
            padding: '8px',
            borderTop: `1px solid ${isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              color: token.colorTextSecondary,
            }}
            title={collapsed ? '展开侧边栏' : '收起侧边栏'}
          />
        </div>
      )}
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
          background: token.colorBgLayout,
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
          <div ref={breadcrumbRef}>
            <Breadcrumb
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
          </div>
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
                destroyOnHidden
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
                      color: token.colorText,
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
      menuDataRender={() => {
        return filteredMenuData;
      }}
      menuProps={{
        mode: 'inline',
        openKeys: openKeys, // 受控的 openKeys，合并用户手动展开的菜单和当前路径的父菜单
        selectedKeys: selectedKeys, // 受控的 selectedKeys，只选中精确匹配的路径
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
              {item.name}
            </div>
          );
        }
        // 使用 Ant Design 原生渲染，只添加点击导航功能
        // 优化：防止重复点击和不必要的导航
        return (
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (item.path && item.path !== location.pathname && !item.disabled) {
                // 使用React Router的导航，确保SPA行为
                navigate(item.path, { replace: false });
              }
            }}
            style={{
              cursor: item.path && !item.disabled ? 'pointer' : 'default',
              width: '100%',
              height: '100%',
            }}
            role="menuitem"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && item.path && item.path !== location.pathname && !item.disabled) {
                e.preventDefault();
                navigate(item.path, { replace: false });
              }
            }}
          >
            {dom}
          </div>
        );
      }}
    >
      <UniTabs
        menuConfig={menuConfig}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      >
        {children}
      </UniTabs>
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
      }}
    />
    </>
  );
}

