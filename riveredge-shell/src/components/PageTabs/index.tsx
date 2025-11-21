/**
 * RiverEdge SaaS 多组织框架 - 页面标签栏组件
 *
 * 提供多标签页管理功能，支持标签的添加、切换、关闭等操作
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs } from 'antd';
import type { MenuDataItem } from '@ant-design/pro-components';

/**
 * 标签项接口
 */
export interface TabItem {
  key: string;
  path: string;
  label: string;
  closable?: boolean;
}

/**
 * 从菜单配置中查找页面标题
 */
const findMenuTitle = (path: string, menuConfig: MenuDataItem[]): string => {
  const findInMenu = (items: MenuDataItem[]): string | null => {
    for (const item of items) {
      // 精确匹配
      if (item.path === path) {
        return item.name as string;
      }
      // 子菜单递归查找
      if (item.children) {
        const found = findInMenu(item.children);
        if (found) return found;
      }
    }
    return null;
  };

  return findInMenu(menuConfig) || path.split('/').pop() || '未命名页面';
};

/**
 * 页面标签栏组件属性
 */
interface PageTabsProps {
  menuConfig: MenuDataItem[];
  children: React.ReactNode;
}

/**
 * 标签栏配置常量
 */
const TAB_CONFIG = {
  MAX_TABS: 20, // 最大标签数量，超过后自动关闭最旧的标签
};

/**
 * 页面标签栏组件
 */
export default function PageTabs({ menuConfig, children }: PageTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');

  /**
   * 根据路径获取标签标题
   */
  const getTabTitle = useCallback(
    (path: string): string => {
      return findMenuTitle(path, menuConfig);
    },
    [menuConfig]
  );

  /**
   * 添加标签
   */
  const addTab = useCallback(
    (path: string) => {
      // 排除登录页等不需要标签的页面
      const excludePaths = ['/login', '/register'];
      if (excludePaths.some((p) => path.startsWith(p))) {
        return;
      }

      setTabs((prevTabs) => {
        // 检查标签是否已存在
        const existingTab = prevTabs.find((tab) => tab.key === path);
        if (existingTab) {
          return prevTabs;
        }

        // 添加新标签
        const newTab: TabItem = {
          key: path,
          path,
          label: getTabTitle(path),
          closable: path !== '/dashboard', // 工作台标签不可关闭
        };

        let newTabs: TabItem[];

        // 如果添加的是仪表盘，确保它在第一个位置
        if (path === '/dashboard') {
          // 检查是否已存在仪表盘标签
          const dashboardTab = prevTabs.find((tab) => tab.key === '/dashboard');
          if (dashboardTab) {
            return prevTabs;
          }
          // 仪表盘始终在第一个位置
          newTabs = [newTab, ...prevTabs];
        } else {
          // 其他标签添加在仪表盘之后
          const dashboardIndex = prevTabs.findIndex((tab) => tab.key === '/dashboard');
          if (dashboardIndex >= 0) {
            // 如果存在仪表盘，插入到仪表盘之后
            const beforeDashboard = prevTabs.slice(0, dashboardIndex + 1);
            const afterDashboard = prevTabs.slice(dashboardIndex + 1);
            newTabs = [...beforeDashboard, newTab, ...afterDashboard];
          } else {
            // 如果没有仪表盘，先添加仪表盘，再添加新标签
            const dashboardTab: TabItem = {
              key: '/dashboard',
              path: '/dashboard',
              label: getTabTitle('/dashboard'),
              closable: false,
            };
            newTabs = [dashboardTab, newTab];
          }
        }

        // 性能优化：如果标签数量超过限制，自动关闭最旧的标签（保留仪表盘）
        if (newTabs.length > TAB_CONFIG.MAX_TABS) {
          // 找到最旧的标签（除了仪表盘）
          const closableTabs = newTabs.filter((tab) => tab.closable);
          if (closableTabs.length > 0) {
            // 移除最旧的标签（第一个可关闭的标签）
            const oldestTab = closableTabs[0];
            newTabs = newTabs.filter((tab) => tab.key !== oldestTab.key);
          }
        }

        return newTabs;
      });
    },
    [getTabTitle]
  );

  /**
   * 移除标签
   */
  const removeTab = useCallback((targetKey: string) => {
    setTabs((prevTabs) => {
      const newTabs = prevTabs.filter((tab) => tab.key !== targetKey);
      return newTabs;
    });
  }, []);

  /**
   * 监听路由变化，自动添加标签
   */
  useEffect(() => {
    if (location.pathname) {
      // 确保仪表盘标签始终存在（固定第一个）
      addTab('/dashboard');
      // 添加当前页面标签
      addTab(location.pathname);
      setActiveKey(location.pathname);
    }
  }, [location.pathname, addTab]);

  /**
   * 处理标签切换
   */
  const handleTabChange = (key: string) => {
    setActiveKey(key);
    navigate(key);
  };

  /**
   * 处理标签关闭
   */
  const handleTabClose = (targetKey: string) => {
    const targetIndex = tabs.findIndex((tab) => tab.key === targetKey);
    const newTabs = tabs.filter((tab) => tab.key !== targetKey);

    // 如果关闭的是当前激活的标签，切换到相邻标签
    if (targetKey === activeKey) {
      if (newTabs.length > 0) {
        // 优先切换到右侧标签，如果没有则切换到左侧
        const nextTab = newTabs[targetIndex] || newTabs[targetIndex - 1] || newTabs[0];
        if (nextTab) {
          setActiveKey(nextTab.key);
          navigate(nextTab.key);
        }
      } else {
        // 如果没有标签了，跳转到工作台
        navigate('/dashboard');
      }
    }

    removeTab(targetKey);
  };



  // 如果没有标签，直接渲染子组件
  if (tabs.length === 0) {
    return <>{children}</>;
  }

  return (
    <>
      <style>{`
        /* 标签栏样式优化 */
        .page-tabs-container .ant-tabs {
          margin: 0;
        }
        .page-tabs-container .ant-tabs-nav {
          margin: 0;
          padding: 0 16px;
        }
        .page-tabs-container .ant-tabs-tab {
          margin: 0 !important;
          padding: 8px 16px !important;
          border: none !important;
          border-bottom: none !important;
          background: transparent !important;
          border-radius: 0 !important;
        }
        /* 未激活标签：使用竖线分隔 */
        .page-tabs-container .ant-tabs-tab:not(.ant-tabs-tab-active) {
          position: relative;
        }
        .page-tabs-container .ant-tabs-tab:not(.ant-tabs-tab-active)::after {
          content: '';
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 1px;
          height: 16px;
          background: #e8e8e8;
        }
        .page-tabs-container .ant-tabs-content-holder {
          display: none;
        }
        /* 移除标签底部指示线 */
        .page-tabs-container .ant-tabs-ink-bar {
          display: none !important;
        }
        /* 激活标签背景色与内容区一致 */
        .page-tabs-container .ant-tabs-tab-active {
          background: #f0f2f5 !important;
          border-bottom: none !important;
          margin-left: -1px !important;
          padding-left: 17px !important;
          border-top-left-radius: 4px !important;
          border-top-right-radius: 4px !important;
        }
        .page-tabs-container .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: #1890ff;
        }
        /* 移除标签切换时的过渡动画 */
        .page-tabs-container .ant-tabs-tab {
          transition: none !important;
        }
        .page-tabs-container .ant-tabs-ink-bar {
          transition: none !important;
        }
        /* 标签栏与内容区无缝融合 */
        .page-tabs-wrapper {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .page-tabs-header {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          flex-shrink: 0;
          padding-top: 2px;
          position: sticky;
          top: 56px; /* ProLayout 顶栏高度 */
          z-index: 10;
        }
        .page-tabs-content {
          flex: 1;
          overflow: auto;
          position: relative;
          background: #f0f2f5;
        }
      `}</style>
      <div className="page-tabs-wrapper">
        <div className="page-tabs-header">
          <Tabs
            activeKey={activeKey}
            onChange={handleTabChange}
            type="editable-card"
            hideAdd
            onEdit={(targetKey, action) => {
              if (action === 'remove') {
                handleTabClose(targetKey as string);
              }
            }}
            items={tabs.map((tab) => ({
              key: tab.key,
              label: tab.label,
              closable: tab.closable,
            }))}
            size="small"
            className="page-tabs-container"
          />
        </div>
        <div className="page-tabs-content">
          {children}
        </div>
      </div>
    </>
  );
}

