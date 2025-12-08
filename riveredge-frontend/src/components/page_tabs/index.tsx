/**
 * RiverEdge SaaS 多组织框架 - 页面标签栏组件
 *
 * 提供多标签页管理功能，支持标签的添加、切换、关闭等操作
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, Button, Dropdown, MenuProps, theme } from 'antd';
import { CaretLeftFilled, CaretRightFilled, ReloadOutlined } from '@ant-design/icons';
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
  const findInMenu = (items: MenuDataItem[] | undefined): string | null => {
    // 防御性检查：如果 items 为空或未定义，直接返回 null
    if (!items || !Array.isArray(items) || items.length === 0) {
      return null;
    }
    
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

  // 防御性检查：如果 menuConfig 为空或未定义，直接返回路径的最后一部分
  if (!menuConfig || !Array.isArray(menuConfig) || menuConfig.length === 0) {
    return path.split('/').pop() || '未命名页面';
  }

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
  const { token } = theme.useToken();
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');
  const tabsNavRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

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
      // 排除登录页等不需要标签的页面（注册功能已整合到登录页面）
      const excludePaths = ['/login'];
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
          closable: path !== '/system/dashboard/workplace', // 工作台标签不可关闭
        };

        let newTabs: TabItem[];

        // 如果添加的是工作台，确保它在第一个位置
        if (path === '/system/dashboard/workplace') {
          // 检查是否已存在工作台标签
          const workplaceTab = prevTabs.find((tab) => tab.key === '/system/dashboard/workplace');
          if (workplaceTab) {
            return prevTabs;
          }
          // 工作台始终在第一个位置
          newTabs = [newTab, ...prevTabs];
        } else {
          // 其他标签添加在工作台之后
          const workplaceIndex = prevTabs.findIndex((tab) => tab.key === '/system/dashboard/workplace');
          if (workplaceIndex >= 0) {
            // 如果存在工作台，插入到工作台之后
            const beforeWorkplace = prevTabs.slice(0, workplaceIndex + 1);
            const afterWorkplace = prevTabs.slice(workplaceIndex + 1);
            newTabs = [...beforeWorkplace, newTab, ...afterWorkplace];
          } else {
            // 如果没有工作台，先添加工作台，再添加新标签
            const workplaceTab: TabItem = {
              key: '/system/dashboard/workplace',
              path: '/system/dashboard/workplace',
              label: getTabTitle('/system/dashboard/workplace'),
              closable: false,
            };
            newTabs = [workplaceTab, newTab];
          }
        }

        // 性能优化：如果标签数量超过限制，自动关闭最旧的标签（保留工作台）
        if (newTabs.length > TAB_CONFIG.MAX_TABS) {
          // 找到最旧的标签（除了工作台）
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
      // 确保工作台标签始终存在（固定第一个）
      addTab('/system/dashboard/workplace');
      // 添加当前页面标签
      addTab(location.pathname);
      setActiveKey(location.pathname);
    }
  }, [location.pathname, addTab]);

  /**
   * 监听 refresh 参数，实现局部刷新
   */
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.has('_refresh')) {
      // 移除 refresh 参数，保持 URL 干净
      searchParams.delete('_refresh');
      const newSearch = searchParams.toString();
      const newPath = newSearch ? `${location.pathname}?${newSearch}` : location.pathname;
      navigate(newPath, { replace: true });
      // 更新 refreshKey 触发组件重新渲染
      setRefreshKey(prev => prev + 1);
    }
  }, [location.search, location.pathname, navigate]);

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
        navigate('/system/dashboard/workplace');
      }
    }

    removeTab(targetKey);
  };

  /**
   * 关闭右侧标签
   */
  const handleCloseRight = (targetKey: string) => {
    const targetIndex = tabs.findIndex((tab) => tab.key === targetKey);
    if (targetIndex === -1) return;

    // 保留目标标签及其左侧的所有标签
    const newTabs = tabs.slice(0, targetIndex + 1);
    setTabs(newTabs);

    // 如果当前激活的标签被关闭，切换到目标标签
    if (!newTabs.find((tab) => tab.key === activeKey)) {
      setActiveKey(targetKey);
      navigate(targetKey);
    }
  };

  /**
   * 关闭其他标签
   */
  const handleCloseOthers = (targetKey: string) => {
    // 保留目标标签和工作台标签（如果存在）
    const workplaceTab = tabs.find((tab) => tab.key === '/system/dashboard/workplace');
    const targetTab = tabs.find((tab) => tab.key === targetKey);
    const newTabs: TabItem[] = [];

    // 先添加工作台标签（如果存在且不是目标标签）
    if (workplaceTab && workplaceTab.key !== targetKey) {
      newTabs.push(workplaceTab);
    }

    // 添加目标标签（如果存在且不是工作台）
    if (targetTab) {
      newTabs.push(targetTab);
    }

    setTabs(newTabs);
    setActiveKey(targetKey);
    navigate(targetKey);
  };

  /**
   * 全部关闭
   */
  const handleCloseAll = () => {
    // 只保留仪表盘标签
    const workplaceTab = tabs.find((tab) => tab.key === '/system/dashboard/workplace');
    if (workplaceTab) {
      setTabs([workplaceTab]);
      setActiveKey('/system/dashboard/workplace');
      navigate('/system/dashboard/workplace');
    } else {
      setTabs([]);
      navigate('/system/dashboard/workplace');
    }
  };

  /**
   * 处理标签刷新 - 局部刷新当前标签页
   */
  const handleTabRefresh = useCallback((tabKey: string) => {
    // 如果当前路径就是目标路径，通过添加 refresh 参数来触发局部刷新
    if (location.pathname === tabKey) {
      // 添加 refresh 参数，触发路由变化，从而触发组件重新渲染
      const separator = location.search ? '&' : '?';
      navigate(`${tabKey}${separator}_refresh=${Date.now()}`, { replace: true });
    } else {
      // 如果当前路径不是目标路径，先导航到目标路径
      navigate(tabKey, { replace: true });
    }
  }, [navigate, location.pathname, location.search]);

  /**
   * 获取标签右键菜单
   */
  const getTabContextMenu = (tabKey: string): MenuProps => {
    const targetIndex = tabs.findIndex((tab) => tab.key === tabKey);
    const isWorkplace = tabKey === '/system/dashboard/workplace';
    const hasRightTabs = targetIndex < tabs.length - 1;
    const hasOtherTabs = tabs.length > 1;

    const menuItems: MenuProps['items'] = [
      {
        key: 'refresh',
        label: '刷新',
        icon: <ReloadOutlined />,
      },
      {
        type: 'divider',
      },
      {
        key: 'close',
        label: '关闭',
        disabled: isWorkplace, // 工作台标签不可关闭
      },
      {
        key: 'closeRight',
        label: '关闭右侧',
        disabled: !hasRightTabs || isWorkplace,
      },
      {
        key: 'closeOthers',
        label: '关闭其他',
        disabled: !hasOtherTabs || isWorkplace,
      },
      {
        key: 'closeAll',
        label: '全部关闭',
        disabled: tabs.length <= 1 || (tabs.length === 1 && isWorkplace),
      },
    ];

    return {
      items: menuItems,
      onClick: ({ key }) => {
        switch (key) {
          case 'refresh':
            handleTabRefresh(tabKey);
            break;
          case 'close':
            handleTabClose(tabKey);
            break;
          case 'closeRight':
            handleCloseRight(tabKey);
            break;
          case 'closeOthers':
            handleCloseOthers(tabKey);
            break;
          case 'closeAll':
            handleCloseAll();
            break;
        }
      },
    };
  };

  /**
   * 检查是否可以滚动
   */
  const checkScrollability = useCallback(() => {
    if (!tabsNavRef.current) return;
    
    // Ant Design Tabs 的滚动容器是 .ant-tabs-nav-wrap，而不是 .ant-tabs-nav-list
    const navWrapElement = tabsNavRef.current.querySelector('.ant-tabs-nav-wrap') as HTMLElement;
    if (!navWrapElement) return;

    const { scrollLeft, scrollWidth, clientWidth } = navWrapElement;
    
    // 允许1px的误差，避免浮点数精度问题
    // 可以向左滚动：当前滚动位置大于0
    const canScrollLeftValue = scrollLeft > 1;
    
    // 可以向右滚动：内容宽度大于容器宽度，且当前滚动位置未到达最右边
    // 当标签占满时，scrollWidth <= clientWidth，此时 canScrollRight 为 false
    const canScrollRightValue = scrollWidth > clientWidth + 1 && (scrollLeft + clientWidth) < scrollWidth - 1;
    
    setCanScrollLeft(canScrollLeftValue);
    setCanScrollRight(canScrollRightValue);
  }, []);

  /**
   * 滚动标签栏
   */
  const scrollTabs = useCallback((direction: 'left' | 'right') => {
    if (!tabsNavRef.current) return;
    
    // Ant Design Tabs 的滚动容器是 .ant-tabs-nav-wrap
    const navWrapElement = tabsNavRef.current.querySelector('.ant-tabs-nav-wrap') as HTMLElement;
    if (!navWrapElement) return;

    const scrollAmount = 200; // 每次滚动200px
    const newScrollLeft = direction === 'left' 
      ? navWrapElement.scrollLeft - scrollAmount
      : navWrapElement.scrollLeft + scrollAmount;
    
    navWrapElement.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    });
    
    // 滚动后重新检查状态
    setTimeout(() => {
      checkScrollability();
    }, 100);
  }, [checkScrollability]);

  /**
   * 监听标签变化和窗口大小变化，检查滚动状态
   */
  useEffect(() => {
    // 使用多个延迟检查，确保DOM完全渲染后再检查
    checkScrollability();
    const timer1 = setTimeout(checkScrollability, 50);
    const timer2 = setTimeout(checkScrollability, 100);
    const timer3 = setTimeout(checkScrollability, 200);
    
    const handleResize = () => {
      checkScrollability();
    };
    
    window.addEventListener('resize', handleResize);
    
    // 监听滚动事件 - 使用 .ant-tabs-nav-wrap 作为滚动容器
    const navWrapElement = tabsNavRef.current?.querySelector('.ant-tabs-nav-wrap') as HTMLElement;
    if (navWrapElement) {
      navWrapElement.addEventListener('scroll', checkScrollability);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      window.removeEventListener('resize', handleResize);
      if (navWrapElement) {
        navWrapElement.removeEventListener('scroll', checkScrollability);
      }
    };
  }, [tabs, checkScrollability]);

  // 如果没有标签，直接渲染子组件
  if (tabs.length === 0) {
    return <>{children}</>;
  }

  return (
    <>
      <style>{`
        /* 标签栏样式优化 */
        .page-tabs-container .ant-tabs {
          margin: 0 !important;
          margin-bottom: 0 !important;
          border: none !important;
          border-bottom: none !important;
          box-shadow: none !important;
          outline: none !important;
          background: var(--ant-colorBgContainer) !important;
        }
        /* 覆盖 Ant Design Tabs 原生下边框样式 */
        .page-tabs-container .ant-tabs-nav {
          margin: 0 !important;
          margin-bottom: 0 !important;
          padding: 0 !important;
          padding-bottom: 0 !important;
          border-bottom: none !important;
        }
        .page-tabs-container .ant-tabs-nav::before {
          display: none !important;
          border-bottom: none !important;
        }
        .page-tabs-container .ant-tabs-nav-wrap {
          border-bottom: none !important;
          overflow-x: auto !important;
          overflow-y: visible !important;
        }
        .page-tabs-container .ant-tabs-nav-wrap::before {
          display: none !important;
          border-bottom: none !important;
        }
        .page-tabs-container .ant-tabs-nav-list {
          border-bottom: none !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
          overflow: visible !important;
        }
        /* 覆盖所有可能的边框颜色 #F0F0F0 */
        .page-tabs-container .ant-tabs-nav,
        .page-tabs-container .ant-tabs-nav-wrap,
        .page-tabs-container .ant-tabs-nav-list,
        .page-tabs-container .ant-tabs-tab {
          border-color: transparent !important;
        }
        .page-tabs-container .ant-tabs-nav::after {
          display: none !important;
          border-bottom: none !important;
        }
        /* Chrome 式标签样式 - 所有标签都有顶部圆角 */
        .page-tabs-container .ant-tabs-tab {
          margin: 0 !important;
          padding: 8px 16px !important;
          border: none !important;
          border-bottom: none !important;
          background: var(--ant-colorBgContainer) !important;
          border-top-left-radius: 8px !important;
          border-top-right-radius: 8px !important;
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
          position: relative;
          overflow: visible !important;
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
          background: rgba(0, 0, 0, 0.16) !important;
          z-index: 1;
          opacity: 1 !important;
        }
        /* 最后一个标签不需要右侧竖线 */
        .page-tabs-container .ant-tabs-tab:last-child::after {
          display: none !important;
        }
        .page-tabs-container .ant-tabs-content-holder {
          display: none;
        }
        /* 移除标签底部指示线 */
        .page-tabs-container .ant-tabs-ink-bar {
          display: none !important;
        }
        /* 激活标签背景色与内容区一致，仿 Chrome 浏览器样式 - 使用主题背景色 */
        /* 参考：https://juejin.cn/post/6986827061461516324 */
        .page-tabs-container .ant-tabs-tab-active {
          background: var(--ant-colorBgLayout) !important;
          border-bottom: none !important;
          border-top-left-radius: 8px !important;
          border-top-right-radius: 8px !important;
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
          position: relative;
          z-index: 2;
          margin-bottom: 0px !important;
          margin-top: 0 !important;
          overflow: visible !important;
          /* Chrome 式外圆角效果 - 强制显示圆角，防止被父容器裁剪 */
          border-radius: 8px 8px 0 0 !important;
        }
        /* Chrome 式反向圆角 - 使用伪元素实现左右两侧的内凹圆角 */
        .page-tabs-container .ant-tabs-tab-active::before,
        .page-tabs-container .ant-tabs-tab-active::after {
          position: absolute;
          bottom: 0;
          content: '';
          width: 16px;
          height: 16px;
          border-radius: 100%;
          box-shadow: 0 0 0 40px var(--ant-colorBgLayout);
          pointer-events: none;
          z-index: -1;
        }
        /* 左侧反向圆角 */
        .page-tabs-container .ant-tabs-tab-active::before {
          left: -16px;
          clip-path: inset(50% -8px 0 50%);
        }
        /* 右侧反向圆角 - 调整 clip-path 确保右侧圆角正确显示 */
        .page-tabs-container .ant-tabs-tab-active::after {
          right: -16px;
          clip-path: inset(50% 50% 0 -8px);
        }
        /* 第一个标签不需要左侧反向圆角 */
        .page-tabs-container .ant-tabs-tab-active:first-child::before {
          display: none;
        }
        /* 最后一个标签不需要右侧反向圆角 */
        .page-tabs-container .ant-tabs-tab-active:last-child::after {
          display: none;
        }
        /* 确保单个标签时也没有底部间距 */
        .page-tabs-container .ant-tabs-nav:has(.ant-tabs-tab:only-child) {
          margin-bottom: 0 !important;
        }
        .page-tabs-container .ant-tabs-nav:has(.ant-tabs-tab:only-child) .ant-tabs-tab-active {
          margin-bottom: 0px !important;
        }
        /* Chrome 式标签：激活标签与内容区无缝融合 */
        /* 激活标签向左偏移1px，但排除第一个标签，实现标签之间的重叠效果 */
        .page-tabs-container .ant-tabs-tab-active:not(:first-child) {
          margin-left: -1px !important;
          padding-left: 17px !important;
        }
        /* Chrome 式效果：激活标签文字颜色 */
        .page-tabs-container .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: var(--ant-colorText) !important;
          font-weight: 500 !important;
        }
        /* Chrome 式效果：激活标签与相邻未激活标签之间的分隔线隐藏 */
        /* 注意：不能隐藏激活标签的 ::after，因为需要用它来实现右侧圆角 */
        /* 只隐藏未激活标签右侧的分隔线 */
        .page-tabs-container .ant-tabs-tab-active + .ant-tabs-tab::after {
          display: none !important;
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
          overflow: visible !important;
        }
        .page-tabs-header {
          background: var(--ant-colorBgContainer) !important;
          flex-shrink: 0;
          padding-top: 2px;
          padding-bottom: 0;
          margin-bottom: 0;
          position: sticky;
          top: 56px; /* ProLayout 顶栏高度 */
          z-index: 10;
          overflow: visible !important;
          border-bottom: none !important;
        }
        /* 确保背景色生效 - 增加选择器优先级，支持深色模式 */
        div.page-tabs-header {
          background: var(--ant-colorBgContainer) !important;
        }
        /* 标签栏容器背景色与菜单栏一致 */
        .page-tabs-container {
          background: var(--ant-colorBgContainer) !important;
        }
        .page-tabs-container .ant-tabs-nav {
          background: var(--ant-colorBgContainer) !important;
        }
        .page-tabs-container .ant-tabs-nav-wrap {
          background: var(--ant-colorBgContainer) !important;
        }
        .page-tabs-container .ant-tabs-nav-list {
          background: var(--ant-colorBgContainer) !important;
        }
        /* 确保单个标签时也没有底部间距 */
        .page-tabs-container .ant-tabs-nav {
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }
        .page-tabs-container .ant-tabs-nav-list {
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }
        /* 当只有一个标签时，确保没有额外间距 */
        .page-tabs-container .ant-tabs-nav:has(.ant-tabs-tab:only-child) {
          margin-bottom: 0 !important;
        }
        .page-tabs-container .ant-tabs-nav:has(.ant-tabs-tab:only-child) .ant-tabs-tab-active {
          margin-bottom: -1px !important;
        }
        .page-tabs-content {
          flex: 1;
          overflow: auto;
          position: relative;
          background: var(--ant-colorBgLayout);
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        /* 标签栏头部包装器 - 包含滚动按钮 */
        .page-tabs-header-wrapper {
          display: flex;
          align-items: center;
          position: relative;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          overflow: visible !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
          z-index: 1;
          pointer-events: none;
        }
        /* 允许按钮和标签栏接收点击事件 */
        .page-tabs-header-wrapper .page-tabs-scroll-button,
        .page-tabs-header-wrapper .page-tabs-container {
          pointer-events: auto;
        }
        /* 滚动按钮样式 - 默认主题色（可点击时） */
        .page-tabs-header-wrapper .page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]),
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]),
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]),
        .page-tabs-header-wrapper button.page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]),
        .page-tabs-header-wrapper button.page-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]),
        .page-tabs-header-wrapper button.page-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]) {
          width: 24px !important;
          height: 30px !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
          border: none !important;
          border-bottom: none !important;
          background: transparent !important;
          box-shadow: none !important;
          color: ${token.colorPrimary} !important;
          cursor: pointer !important;
          pointer-events: auto !important;
          position: relative !important;
          z-index: 2 !important;
          margin-bottom: 0 !important;
          line-height: 1 !important;
        }
        /* 按钮图标颜色 - 可点击时使用主题色 */
        .page-tabs-header-wrapper .page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]) .ant-btn-icon,
        .page-tabs-header-wrapper .page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]) span.anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .page-tabs-header-wrapper button.page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .page-tabs-header-wrapper button.page-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .page-tabs-header-wrapper button.page-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]) svg,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]) svg,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]) svg {
          color: ${token.colorPrimary} !important;
          fill: ${token.colorPrimary} !important;
        }
        /* 去掉按钮的所有伪元素和边框 */
        .page-tabs-header-wrapper .page-tabs-scroll-button::before,
        .page-tabs-header-wrapper .page-tabs-scroll-button::after {
          display: none !important;
        }
        /* 无法点击时：浅灰色 - 覆盖所有可能的样式 */
        .page-tabs-header-wrapper .page-tabs-scroll-button:disabled,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-disabled,
        .page-tabs-header-wrapper .page-tabs-scroll-button[disabled],
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn:disabled,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn.ant-btn-disabled,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-text:disabled,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-text.ant-btn-disabled,
        .page-tabs-header-wrapper button.page-tabs-scroll-button:disabled,
        .page-tabs-header-wrapper button.page-tabs-scroll-button.ant-btn-disabled,
        .page-tabs-header-wrapper button.page-tabs-scroll-button[disabled] {
          color: rgba(0, 0, 0, 0.25) !important;
          background: transparent !important;
          cursor: not-allowed !important;
          pointer-events: none !important;
        }
        .page-tabs-header-wrapper .page-tabs-scroll-button:disabled .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button:disabled .ant-btn-icon,
        .page-tabs-header-wrapper .page-tabs-scroll-button:disabled span.anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-disabled .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-disabled .ant-btn-icon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-disabled span.anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button[disabled] .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button[disabled] .ant-btn-icon,
        .page-tabs-header-wrapper .page-tabs-scroll-button[disabled] span.anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn:disabled .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn.ant-btn-disabled .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-text:disabled .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-text.ant-btn-disabled .anticon,
        .page-tabs-header-wrapper button.page-tabs-scroll-button:disabled .anticon,
        .page-tabs-header-wrapper button.page-tabs-scroll-button:disabled svg,
        .page-tabs-header-wrapper .page-tabs-scroll-button:disabled svg {
          color: rgba(0, 0, 0, 0.25) !important;
          fill: rgba(0, 0, 0, 0.25) !important;
        }
        /* 可以点击时：主题色（默认状态，hover 时加深） */
        .page-tabs-header-wrapper .page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover {
          color: var(--ant-colorPrimaryHover) !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .page-tabs-header-wrapper .page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover .ant-btn-icon,
        .page-tabs-header-wrapper .page-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover span.anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover .anticon,
        .page-tabs-header-wrapper .page-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover .anticon {
          color: var(--ant-colorPrimaryHover) !important;
        }
        /* 按钮容器样式 - 高度与 ant-tabs 一致 */
        .page-tabs-scroll-button-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 38px;
          padding-bottom: 1px !important;
          border-bottom: none !important;
        }
        .page-tabs-scroll-button-left {
          margin-right: 4px;
          position: relative;
          z-index: 2;
        }
        .page-tabs-scroll-button-right {
          margin-left: 4px;
          position: relative;
          z-index: 2;
        }
        /* 标签栏容器 - 允许横向滚动，底部允许溢出显示外圆角 */
        .page-tabs-container {
          flex: 1;
          overflow-x: hidden;
          overflow-y: visible;
          position: relative;
          z-index: 1;
        }
        .page-tabs-container .ant-tabs-nav {
          overflow-x: auto;
          overflow-y: visible;
        }
        .page-tabs-container .ant-tabs-nav-list {
          overflow: visible !important;
        }
        .page-tabs-container .ant-tabs-tab {
          overflow: visible !important;
        }
          .ant-tabs-nav-more{
            padding: 8px 0px 8px 8px!important;
            box-shadow: none !important;
          }
        /* 移除所有可能移动的阴影效果和分隔线 */
        .page-tabs-container .ant-tabs-nav-more {
          box-shadow: none !important;
        }
        .page-tabs-container .ant-tabs-nav-operations {
          box-shadow: none !important;
        }
        /* 移除 nav-operations 的伪元素分隔线 */
        .page-tabs-container .ant-tabs-nav-operations::before,
        .page-tabs-container .ant-tabs-nav-operations::after {
          display: none !important;
          box-shadow: none !important;
        }
        /* 移除 nav-wrap 的分隔线 */
        .page-tabs-container .ant-tabs-nav-wrap::after {
          display: none !important;
        }
        /* 移除 nav-list 的分隔线 */
        .page-tabs-container .ant-tabs-nav-list::after {
          display: none !important;
        }
      `}</style>
      <div className="page-tabs-wrapper">
        <div className="page-tabs-header">
          <div className="page-tabs-header-wrapper" ref={tabsNavRef}>
            {/* 左侧滚动箭头 */}
            <div className="page-tabs-scroll-button-wrapper">
              <Button
                type="text"
                size="small"
                icon={<CaretLeftFilled />}
                onClick={() => scrollTabs('left')}
                disabled={!canScrollLeft}
                className="page-tabs-scroll-button page-tabs-scroll-button-left"
              />
            </div>
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
                label: (
                  <Dropdown
                    menu={getTabContextMenu(tab.key)}
                    trigger={['contextMenu']}
                  >
                    <span
                      onDoubleClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // 仪表盘标签不可双击关闭
                        if (tab.key !== '/system/dashboard/workplace' && tab.closable) {
                          handleTabClose(tab.key);
                        }
                      }}
                      style={{ userSelect: 'none' }}
                    >
                      {tab.label}
                    </span>
                  </Dropdown>
                ),
                closable: tab.closable,
              }))}
              size="small"
              className="page-tabs-container"
            />
            {/* 右侧滚动箭头 */}
            <div className="page-tabs-scroll-button-wrapper">
              <Button
                type="text"
                size="small"
                icon={<CaretRightFilled />}
                onClick={() => scrollTabs('right')}
                disabled={!canScrollRight}
                className="page-tabs-scroll-button page-tabs-scroll-button-right"
              />
            </div>
          </div>
        </div>
        <div className="page-tabs-content" key={`content-${activeKey}-${refreshKey}`}>
          {children}
        </div>
      </div>
    </>
  );
}

