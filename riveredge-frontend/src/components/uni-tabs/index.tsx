/**
 * RiverEdge SaaS 多组织框架 - 统一标签栏组件
 *
 * 提供多标签页管理功能，支持标签的添加、切换、关闭等操作
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, Button, Dropdown, MenuProps, theme, Tooltip } from 'antd';
import { CaretLeftFilled, CaretRightFilled, ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined, PushpinOutlined } from '@ant-design/icons';
import type { MenuDataItem } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { getUserPreference } from '../../services/userPreference';
import { findMenuTitleWithTranslation } from '../../utils/menuTranslation';
import { useConfigStore } from '../../stores/configStore';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';

/**
 * 标签项接口
 */
export interface TabItem {
  key: string;
  path: string;
  label: string;
  closable?: boolean;
  /** 是否固定 */
  pinned?: boolean;
}


/**
 * 统一标签栏组件属性
 */
interface UniTabsProps {
  menuConfig: MenuDataItem[];
  children: React.ReactNode;
  /** 是否全屏 */
  isFullscreen?: boolean;
  /** 切换全屏状态 */
  onToggleFullscreen?: () => void;
}

/**
 * 标签栏配置常量
 */
const TAB_CONFIG = {
  MAX_TABS: 20, // 最大标签数量，超过后自动关闭最旧的标签
};

/**
 * 统一标签栏组件
 */
export default function UniTabs({ menuConfig, children, isFullscreen = false, onToggleFullscreen }: UniTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const { t } = useTranslation(); // 获取翻译函数
  // 1. 同步初始化持久化配置
  const [tabsPersistence, setTabsPersistence] = useState<boolean>(() => {
    try {
       const local = localStorage.getItem('riveredge_tabs_persistence');
       return local === 'true';
    } catch { return false; }
  });

  // 2. 同步初始化标签列表（直接从本地存储读取并过滤）
  const [tabs, setTabs] = useState<TabItem[]>(() => {
    if (typeof window === 'undefined') return [];
    
    // 如果未开启持久化，仅返回空（等待后续逻辑添加默认标签）或直接返回默认标签
    const localPersistence = localStorage.getItem('riveredge_tabs_persistence') === 'true';
    if (!localPersistence) return [];

    try {
      const savedTabs = localStorage.getItem('riveredge_saved_tabs');
      if (savedTabs) {
        const parsedTabs: TabItem[] = JSON.parse(savedTabs);
        if (Array.isArray(parsedTabs) && parsedTabs.length > 0) {
           const isInfraPage = location.pathname.startsWith('/infra');
           
           // 根据当前页面类型过滤标签
           const validTabs = parsedTabs.filter((tab) => {
             if (!tab || typeof tab !== 'object' || !tab.key || !tab.path || !tab.label) return false;
             if (isInfraPage) return tab.path.startsWith('/infra');
             return !tab.path.startsWith('/infra') || tab.path.startsWith('/system');
           });

           // 确保默认标签存在
           if (validTabs.length > 0) {
              if (isInfraPage) {
                 const hasOperation = validTabs.some((tab) => tab.key === '/infra/operation');
                 if (!hasOperation) {
                    const opPath = '/infra/operation';
                    // 同步获取标题
                    const opTitle = findMenuTitleWithTranslation(opPath, menuConfig, t);
                    validTabs.unshift({
                        key: opPath,
                        path: opPath,
                        label: opTitle,
                        closable: false,
                        pinned: false
                    });
                 }
              } else {
                 const hasWorkplace = validTabs.some((tab) => tab.key === '/system/dashboard/workplace');
                 if (!hasWorkplace) {
                     const wpPath = '/system/dashboard/workplace';
                     const wpTitle = findMenuTitleWithTranslation(wpPath, menuConfig, t);
                     validTabs.unshift({
                        key: wpPath,
                        path: wpPath,
                        label: wpTitle,
                        closable: false,
                        pinned: false
                    });
                 }
              }
              return validTabs;
           }
        }
      }
    } catch (e) { console.warn('Failed to load tabs from cache', e); }
    return [];
  });

  // 3. 同步初始化 activeKey
  const [activeKey, setActiveKey] = useState<string>(() => {
     // 优先使用当前 URL（这最准确）
     // 如果当前 URL 是根路径或重定向路径，才考虑恢复上次的
     // 但实际上 BasicLayout 会处理重定向，这里 location.pathname 已经是准确的
     return location.pathname + location.search;
  });

  // 不再需要 isInitialized，因为初始状态就是 initialized
  // const [isInitialized, setIsInitialized] = useState<boolean>(true);

  const tabsNavRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // 标签栏背景色状态
  const [tabsBgColorState, setTabsBgColorState] = useState<string | undefined>(() => {
    return (window as any).__RIVEREDGE_TABS_BG_COLOR__;
  });

  /**
   * 根据路径或完整 tabKey 获取标签标题（key 可能含 query，标题按 pathname 查找）
   */
  const getTabTitle = useCallback(
    (pathOrKey: string): string => {
      const pathname = (pathOrKey || '').split('?')[0];
      return findMenuTitleWithTranslation(pathname, menuConfig, t);
    },
    [menuConfig, t]
  );

  /**
   * 监听语言/菜单变化，自动更新所有标签的标题
   */
  useEffect(() => {
    setTabs((prevTabs) => {
      // 避免如果不必要的更新
      let hasChanges = false;
      const newTabs = prevTabs.map((tab) => {
        const newLabel = getTabTitle(tab.key);
        if (newLabel !== tab.label) {
          hasChanges = true;
          return { ...tab, label: newLabel };
        }
        return tab;
      });
      return hasChanges ? newTabs : prevTabs;
    });
  }, [t, menuConfig, getTabTitle]);

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
          pinned: false, // 默认不固定
        };

        let newTabs: TabItem[];

        // 排序逻辑：工作台 -> 固定标签 -> 其他标签
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
          // 其他标签：插入到工作台之后，固定标签之后
          const workplaceTab = prevTabs.find((tab) => tab.key === '/system/dashboard/workplace');
          const pinnedTabs = prevTabs.filter((tab) => tab.pinned && tab.key !== '/system/dashboard/workplace');
          const unpinnedTabs = prevTabs.filter((tab) => !tab.pinned && tab.key !== '/system/dashboard/workplace');

          if (workplaceTab) {
            // 有工作台：工作台 -> 固定标签 -> 新标签 -> 其他标签
            newTabs = [workplaceTab, ...pinnedTabs, newTab, ...unpinnedTabs];
          } else {
            // 没有工作台：先添加工作台，再添加新标签
            const workplaceTab: TabItem = {
              key: '/system/dashboard/workplace',
              path: '/system/dashboard/workplace',
              label: getTabTitle('/system/dashboard/workplace'),
              closable: false,
              pinned: false, // 工作台默认不固定（但始终在第一个位置）
            };
            newTabs = [workplaceTab, ...pinnedTabs, newTab, ...unpinnedTabs];
          }
        }

      // 引入配置
      const { getConfig } = useConfigStore.getState();
      const { getPreference } = useUserPreferenceStore.getState();
      // 最大标签数优先级：User Preference > Config Store > Default(20)
      const maxTabs = getPreference('ui.max_tabs', getConfig('ui.max_tabs', 20));

      if (newTabs.length > maxTabs) {
          // 超过数量时保留新的、关闭旧的：在可关闭且非固定的标签中，排除当前新加的 path，移除最旧的一个
          const closableTabs = newTabs.filter((tab) => tab.closable && !tab.pinned && tab.key !== '/system/dashboard/workplace');
          const closableExceptNew = closableTabs.filter((tab) => tab.key !== path);
          const oldestTab = closableExceptNew[0];
          if (oldestTab) {
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
   * 固定/取消固定标签
   */
  const togglePinTab = useCallback((targetKey: string) => {
    setTabs((prevTabs) => {
      const newTabs = prevTabs.map((tab) => {
        if (tab.key === targetKey) {
          return { ...tab, pinned: !tab.pinned };
        }
        return tab;
      });

      // 排序：固定标签在前，然后是按顺序排列的其他标签
      // 工作台始终在第一个位置（如果存在）
      const workplaceTab = newTabs.find((tab) => tab.key === '/system/dashboard/workplace');
      const pinnedTabs = newTabs.filter((tab) => tab.pinned && tab.key !== '/system/dashboard/workplace');
      const unpinnedTabs = newTabs.filter((tab) => !tab.pinned && tab.key !== '/system/dashboard/workplace');

      const sortedTabs: TabItem[] = [];
      if (workplaceTab) {
        sortedTabs.push(workplaceTab);
      }
      sortedTabs.push(...pinnedTabs);
      sortedTabs.push(...unpinnedTabs);

      return sortedTabs;
    });
  }, []);

  /**
   * 从本地存储加载并验证标签（供初始化和异步恢复使用）
   */
  const loadTabsFromStorage = useCallback((): TabItem[] | null => {
    if (typeof window === 'undefined') return null;
    try {
      const savedTabs = localStorage.getItem('riveredge_saved_tabs');
      if (!savedTabs) return null;
      const parsedTabs: TabItem[] = JSON.parse(savedTabs);
      if (!Array.isArray(parsedTabs) || parsedTabs.length === 0) return null;

      const isInfraPage = location.pathname.startsWith('/infra');
      const validTabs = parsedTabs.filter((tab) => {
        if (!tab || typeof tab !== 'object' || !tab.key || !tab.path || !tab.label) return false;
        if (isInfraPage) return tab.path.startsWith('/infra');
        return !tab.path.startsWith('/infra') || tab.path.startsWith('/system');
      });

      if (validTabs.length === 0) return null;
      const wpPath = isInfraPage ? '/infra/operation' : '/system/dashboard/workplace';
      const hasDefault = validTabs.some((tab) => tab.key === wpPath);
      if (!hasDefault) {
        const title = findMenuTitleWithTranslation(wpPath, menuConfig, t);
        validTabs.unshift({
          key: wpPath,
          path: wpPath,
          label: title,
          closable: false,
          pinned: false,
        });
      }
      return validTabs;
    } catch {
      return null;
    }
  }, [location.pathname, menuConfig, t]);

  /**
   * 同步用户偏好设置（异步更新，不阻塞 UI）
   */
  useEffect(() => {
    const syncUserPreference = async () => {
      try {
        const userPreference = await getUserPreference().catch(() => null);
        if (userPreference?.preferences?.tabs_persistence !== undefined) {
          const persistence = userPreference.preferences.tabs_persistence;
          // 仅当配置不同才更新，避免不必要的重新渲染
          setTabsPersistence(prev => {
             if (prev !== persistence) {
                localStorage.setItem('riveredge_tabs_persistence', String(persistence));
                return persistence;
             }
             return prev;
          });
        }
      } catch (error) {
        // 忽略错误
      }
    };
    
    syncUserPreference();

    const handleUserPreferenceUpdated = (event: CustomEvent) => {
      if (event.detail?.preferences?.tabs_persistence !== undefined) {
        setTabsPersistence(event.detail.preferences.tabs_persistence);
      }
    };

    window.addEventListener('userPreferenceUpdated', handleUserPreferenceUpdated as EventListener);
    return () => {
      window.removeEventListener('userPreferenceUpdated', handleUserPreferenceUpdated as EventListener);
    };
  }, []);

  /** 是否已从异步恢复中加载过标签（避免重复覆盖用户操作） */
  const didRestoreFromSyncRef = useRef(false);
  /** 正在从存储恢复，避免保存 effect 在同周期用错误数据覆盖 */
  const isRestoringRef = useRef(false);
  /**
   * 当 tabsPersistence 异步恢复为 true 时（如登出后再次登录），从本地存储恢复标签
   * 解决 clearForLogout 清除 riveredge_tabs_persistence 导致初始化时 tabs=[] 的问题
   */
  useEffect(() => {
    if (!tabsPersistence || didRestoreFromSyncRef.current) return;
    const restored = loadTabsFromStorage();
    if (restored && restored.length > 0) {
      didRestoreFromSyncRef.current = true;
      isRestoringRef.current = true;
      setTabs(restored);
      const savedActive = typeof window !== 'undefined' ? localStorage.getItem('riveredge_saved_active_key') : null;
      if (savedActive && restored.some((tab) => tab.key === savedActive)) {
        setActiveKey(savedActive);
      }
    }
  }, [tabsPersistence, loadTabsFromStorage]);

  /**
   * 保存标签到本地存储（当启用持久化且标签变化时）
   * 每次标签变化时自动保存，刷新页面时就能恢复
   */
  useEffect(() => {
    if (!tabsPersistence) return;
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    try {
      localStorage.setItem('riveredge_saved_tabs', JSON.stringify(tabs));
      if (activeKey && !activeKey.startsWith('/apps/')) {
        localStorage.setItem('riveredge_saved_active_key', activeKey);
      }
    } catch (error) {
    }
  }, [tabs, activeKey, tabsPersistence]);

  /**
   * 监听路由变化，自动添加标签
   * 注意：如果启用了持久化且正在恢复标签，不要立即添加标签，避免覆盖恢复的标签
   */
  useEffect(() => {
    // 移除 isInitialized 检查
    // if (!isInitialized) return;

    if (location.pathname) {
      // 确保工作台标签始终存在（固定第一个）
      addTab('/system/dashboard/workplace');
      // 使用 pathname+search 作为 tabKey，切换回来时保留 query（如 designer?materialId=xxx）
      // 排除 _refresh 参数，避免右键刷新时因 URL 变化而新建标签
      const searchParams = new URLSearchParams(location.search || '');
      searchParams.delete('_refresh');
      const cleanSearch = searchParams.toString();
      const tabKey = location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
      addTab(tabKey);
      setActiveKey(tabKey);
    }
  }, [location.pathname, location.search, addTab]);

  /**
   * 返回时关闭当前标签：当通过 state.closeTab 指定要关闭的标签时，移除该标签并清除 state
   */
  useEffect(() => {
    const state = location.state as { closeTab?: string } | null;
    if (state?.closeTab) {
      removeTab(state.closeTab);
      const search = location.search ? location.search : '';
      navigate(location.pathname + search, { replace: true, state: {} });
    }
  }, [location.pathname, location.search, location.state, removeTab, navigate]);

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

    // 保留目标标签及其左侧的所有标签，以及所有固定标签
    const leftTabs = tabs.slice(0, targetIndex + 1);
    const rightTabs = tabs.slice(targetIndex + 1);
    // 保留右侧的固定标签
    const rightPinnedTabs = rightTabs.filter((tab) => tab.pinned || tab.key === '/system/dashboard/workplace');
    const newTabs = [...leftTabs, ...rightPinnedTabs];

    // 重新排序：工作台 -> 固定标签 -> 其他标签
    const workplaceTab = newTabs.find((tab) => tab.key === '/system/dashboard/workplace');
    const pinnedTabs = newTabs.filter((tab) => tab.pinned && tab.key !== '/system/dashboard/workplace');
    const unpinnedTabs = newTabs.filter((tab) => !tab.pinned && tab.key !== '/system/dashboard/workplace');
    const sortedTabs: TabItem[] = [];
    if (workplaceTab) {
      sortedTabs.push(workplaceTab);
    }
    sortedTabs.push(...pinnedTabs);
    sortedTabs.push(...unpinnedTabs);

    setTabs(sortedTabs);

    // 如果当前激活的标签被关闭，切换到目标标签
    if (!sortedTabs.find((tab) => tab.key === activeKey)) {
      setActiveKey(targetKey);
      navigate(targetKey);
    }
  };

  /**
   * 关闭其他标签
   */
  const handleCloseOthers = (targetKey: string) => {
    // 保留目标标签、工作台标签和所有固定标签
    const workplaceTab = tabs.find((tab) => tab.key === '/system/dashboard/workplace');
    const targetTab = tabs.find((tab) => tab.key === targetKey);
    const pinnedTabs = tabs.filter((tab) => tab.pinned && tab.key !== '/system/dashboard/workplace' && tab.key !== targetKey);
    const newTabs: TabItem[] = [];

    // 先添加工作台标签（如果存在且不是目标标签）
    if (workplaceTab && workplaceTab.key !== targetKey) {
      newTabs.push(workplaceTab);
    }

    // 添加固定标签（不包括目标标签）
    newTabs.push(...pinnedTabs);

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
  const handleCloseAll = useCallback(() => {
    // 使用 setTimeout 确保在当前事件循环结束后执行，避免竞态条件
    setTimeout(() => {
      // 保留工作台标签和所有固定标签
      const workplaceTab = tabs.find((tab) => tab.key === '/system/dashboard/workplace');
      const pinnedTabs = tabs.filter((tab) => tab.pinned && tab.key !== '/system/dashboard/workplace');
      const newTabs: TabItem[] = [];

      // 先添加工作台标签（如果存在）
      if (workplaceTab) {
        newTabs.push(workplaceTab);
      }

      // 添加所有固定标签
      newTabs.push(...pinnedTabs);

      // 批量更新状态，避免竞态条件
      if (newTabs.length > 0) {
        setTabs(newTabs);
        setActiveKey(newTabs[0].key);
        // 延迟导航，确保状态更新完成
        setTimeout(() => navigate(newTabs[0].key), 0);
      } else {
        setTabs([]);
        setActiveKey('/system/dashboard/workplace');
        setTimeout(() => navigate('/system/dashboard/workplace'), 0);
      }
    }, 0);
  }, [tabs, navigate]);

  /**
   * 处理标签刷新 - 局部刷新当前标签页
   */
  const handleTabRefresh = useCallback((tabKey: string) => {
    // 计算当前逻辑 tabKey（排除 _refresh），用于判断是否已在目标标签
    const searchParams = new URLSearchParams(location.search || '');
    searchParams.delete('_refresh');
    const cleanSearch = searchParams.toString();
    const currentTabKey = location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
    // 如果当前路径就是目标路径，通过添加 refresh 参数来触发局部刷新
    if (currentTabKey === tabKey) {
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
    const targetTab = tabs.find((tab) => tab.key === tabKey);
    const isWorkplace = tabKey === '/system/dashboard/workplace';
    const hasRightTabs = targetIndex < tabs.length - 1;
    const hasOtherTabs = tabs.length > 1;
    const isPinned = targetTab?.pinned || false;

    const menuItems: MenuProps['items'] = [
      {
        key: 'refresh',
        label: t('tabs.refresh'),
        icon: <ReloadOutlined />,
      },
      {
        type: 'divider',
      },
      {
        key: 'pin',
        label: isPinned ? t('tabs.unpin') : t('tabs.pin'),
        icon: <PushpinOutlined style={{ transform: isPinned ? 'rotate(-45deg)' : 'none' }} />,
      },
      {
        type: 'divider',
      },
      {
        key: 'close',
        label: t('tabs.close'),
        disabled: isWorkplace || isPinned, // 工作台和固定标签不可关闭
      },
      {
        key: 'closeRight',
        label: t('tabs.closeRight'),
        disabled: !hasRightTabs || isWorkplace,
      },
      {
        key: 'closeOthers',
        label: t('tabs.closeOthers'),
        disabled: !hasOtherTabs || isWorkplace,
      },
      {
        key: 'closeAll',
        label: t('tabs.closeAll'),
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
          case 'pin':
            togglePinTab(tabKey);
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

  // 监听主题更新事件，实时更新标签栏背景色
  useEffect(() => {
    const handleThemeUpdate = () => {
      // 延迟一下，确保全局变量已经更新
      setTimeout(() => {
        const customBgColor = (window as any).__RIVEREDGE_TABS_BG_COLOR__;
        setTabsBgColorState(customBgColor);
      }, 0);
    };

    window.addEventListener('siteThemeUpdated', handleThemeUpdate);
    return () => {
      window.removeEventListener('siteThemeUpdated', handleThemeUpdate);
    };
  }, []);

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
  const isDarkMode = useMemo(() => {
    const bgColor = token.colorBgContainer;
    const brightness = calculateColorBrightness(bgColor);
    // 如果亮度小于 128，认为是深色模式
    return brightness < 128;
  }, [token.colorBgContainer]);

  // 计算标签栏背景色（支持透明度）
  const tabsBgColor = useMemo(() => {
    // 深色模式下，不使用自定义背景色，使用默认背景色
    if (isDarkMode) {
      return token.colorBgContainer;
    }
    // 浅色模式下，优先使用状态中的自定义背景色，否则使用全局变量，最后使用默认背景色
    const customBgColor = tabsBgColorState || (window as any).__RIVEREDGE_TABS_BG_COLOR__;
    return customBgColor || token.colorBgContainer;
  }, [tabsBgColorState, token.colorBgContainer, isDarkMode]);

  // 根据标签栏背景色计算文字颜色（参考左侧菜单栏的实现）
  const tabsTextColor = useMemo(() => {
    // 深色模式下，使用深色模式的默认文字颜色
    if (isDarkMode) {
      return 'var(--ant-colorText)';
    }

    // 浅色模式下，检查是否有自定义背景色
    const customBgColor = tabsBgColorState || (window as any).__RIVEREDGE_TABS_BG_COLOR__;

    if (customBgColor) {
      // 如果有自定义背景色，根据背景色亮度计算文字颜色
      const brightness = calculateColorBrightness(customBgColor);
      // 如果背景色较暗（亮度 < 128），使用浅色文字；否则使用深色文字
      return brightness < 128 ? '#ffffff' : 'var(--ant-colorText)';
    } else {
      // 如果没有自定义背景色（使用默认背景色），使用默认文字颜色
      return 'var(--ant-colorText)';
    }
  }, [tabsBgColorState, isDarkMode]);

  /** 当前是否为 HMI/生产终端类页面（需使用专用内容容器：左右 16px padding + 系统圆角） */
  const isHMIPage = useMemo(() => {
    const key = activeKey || '';
    return key.includes('production-execution/terminal') || key.includes('/kiosk');
  }, [activeKey]);

  /** 是否为工作台/分析页（使用 location.pathname 确保首帧即正确，避免 activeKey 延迟导致的 32px→16px 布局闪烁） */
  const isDashboardOrAnalysisPage = location.pathname === '/system/dashboard/workplace' || location.pathname === '/system/dashboard/analysis';

  // 如果没有标签，直接渲染子组件
  if (tabs.length === 0) {
    return <>{children}</>;
  }

  return (
    <>
      <style>{`
        /* 标签栏样式优化 - 支持自定义背景色（支持透明度） */
        .uni-tabs-header .ant-tabs {
          margin: 0 !important;
          margin-bottom: 0 !important;
          border: none !important;
          border-bottom: none !important;
          box-shadow: none !important;
          outline: none !important;
          background: ${tabsBgColor} !important;
          padding-top: 2px !important;
          padding-left: 8px !important;
        }
        /* 覆盖 Ant Design Tabs 原生下边框样式 */
        .uni-tabs-container .ant-tabs-nav {
          margin: 0 !important;
          margin-bottom: 0 !important;
          padding: 0 !important;
          padding-bottom: 0 !important;
          border-bottom: none !important;
          height: 38px !important;
          overflow: visible !important;
        }
        .uni-tabs-container .ant-tabs-nav::before {
          display: none !important;
          border-bottom: none !important;
        }
        .uni-tabs-container .ant-tabs-nav-wrap {
          border-bottom: none !important;
          overflow-x: auto !important;
          /* 不设置 overflow-y，避免与 overflow-x: auto 冲突导致 visible 被计算为 auto */
          height: 38px !important;
          /* 移除 clip-path: none，允许 Ant Design 原生阴影显示 */
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
          box-sizing: border-box !important;
          position: relative; /* 为阴影定位提供参考 */
          /* 隐藏滚动条且不占用高度 */
          scrollbar-width: none !important; /* Firefox */
          -ms-overflow-style: none !important; /* IE/Edge */
        }
        /* 隐藏 Chrome/Safari/Webkit 滚动条且不占用高度 */
        .uni-tabs-container .ant-tabs-nav-wrap::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        /* 禁用 Ant Design 原生左侧阴影，使用自定义阴影适配小箭头按钮 */
        /* 注意：当 can-scroll-left 时，会通过更具体的选择器覆盖此规则显示阴影 */
        .uni-tabs-container .ant-tabs-nav-wrap::before {
          display: none !important;
          border-bottom: none !important;
        }
        .uni-tabs-container .ant-tabs-nav-list {
          border-bottom: none !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
          overflow: visible !important;
          height: 38px !important;
          display: flex !important;
          align-items: center !important;
        }
        /* 覆盖所有可能的边框颜色 #F0F0F0 */
        .uni-tabs-container .ant-tabs-nav,
        .uni-tabs-container .ant-tabs-nav-wrap,
        .uni-tabs-container .ant-tabs-nav-list,
        .uni-tabs-container .ant-tabs-tab {
          border-color: transparent !important;
        }
        .uni-tabs-container .ant-tabs-nav::after {
          display: none !important;
          border-bottom: none !important;
        }
        /* Chrome 式标签样式 - 所有标签都有顶部圆角 - 支持自定义背景色（支持透明度） */
        .uni-tabs-container .ant-tabs-tab {
          margin: 0 !important;
          padding: 8px 16px !important;
          padding-bottom: 8px !important;
          border: none !important;
          border-bottom: none !important;
          background: ${tabsBgColor} !important;
          border-top-left-radius: 8px !important;
          border-top-right-radius: 8px !important;
          border-bottom-left-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
          position: relative;
          overflow: visible !important;
          height: 38px !important;
          line-height: 22px !important;
          display: flex !important;
          align-items: center !important;
          box-sizing: border-box !important;
        }
        /* 标签按钮和关闭按钮垂直居中 */
        .uni-tabs-container .ant-tabs-tab-btn {
          display: flex !important;
          align-items: center !important;
          line-height: 22px !important;
        }
        .uni-tabs-container .ant-tabs-tab-remove {
          display: flex !important;
          align-items: center !important;
          line-height: 22px !important;
        }
        /* 未激活标签：使用竖线分隔 */
        .uni-tabs-container .ant-tabs-tab:not(.ant-tabs-tab-active) {
          position: relative;
        }
        .uni-tabs-container .ant-tabs-tab:not(.ant-tabs-tab-active)::after {
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
        .uni-tabs-container .ant-tabs-tab:last-child::after {
          display: none !important;
        }
        .uni-tabs-container .ant-tabs-content-holder {
          display: none;
        }
        
        /* 移除标签底部指示线 */
        .uni-tabs-container .ant-tabs-ink-bar {
          display: none !important;
        }
        /* 激活标签背景色与内容区一致，仿 Chrome 浏览器样式 - 使用主题背景色 */
        /* 参考：https://juejin.cn/post/6986827061461516324 */
        .uni-tabs-container .ant-tabs-tab-active {
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
          height: 38px !important;
          padding: 8px 16px !important;
          padding-bottom: 8px !important;
          box-sizing: border-box !important;
          display: flex !important;
          align-items: center !important;
        }
        /* Chrome 式反向圆角 - 使用伪元素实现左右两侧的内凹圆角 */
        .uni-tabs-container .ant-tabs-tab-active::before,
        .uni-tabs-container .ant-tabs-tab-active::after {
          position: absolute;
          bottom: 0;
          content: '';
          width: 16px;
          height: 16px;
          border-radius: 100%;
          box-shadow: 0 0 0 40px var(--ant-colorBgLayout);
          pointer-events: none;
          z-index: -1;
          /* 确保伪元素不被父容器裁剪 */
          overflow: visible !important;
          /* 确保伪元素可以溢出显示 */
          will-change: transform;
        }
        /* 左侧反向圆角 */
        .uni-tabs-container .ant-tabs-tab-active::before {
          left: -16px;
          clip-path: inset(50% -8px 0 50%);
        }
        /* 右侧反向圆角 - 调整 clip-path 确保右侧圆角正确显示 */
        .uni-tabs-container .ant-tabs-tab-active::after {
          right: -16px;
          clip-path: inset(50% 50% 0 -8px);
        }
        /* 第一个标签不需要左侧反向圆角 */
        .uni-tabs-container .ant-tabs-tab-active:first-child::before {
          display: none;
        }
        /* 最后一个标签不需要右侧反向圆角 */
        .uni-tabs-container .ant-tabs-tab-active:last-child::after {
          display: none;
        }
        /* 确保单个标签时也没有底部间距 */
        .uni-tabs-container .ant-tabs-nav:has(.ant-tabs-tab:only-child) {
          margin-bottom: 0 !important;
        }
        .uni-tabs-container .ant-tabs-nav:has(.ant-tabs-tab:only-child) .ant-tabs-tab-active {
          margin-bottom: 0px !important;
        }
        /* Chrome 式标签：激活标签与内容区无缝融合 */
        /* 激活标签向左偏移1px，但排除第一个标签，实现标签之间的重叠效果 */
        .uni-tabs-container .ant-tabs-tab-active:not(:first-child) {
          margin-left: -1px !important;
          padding-left: 17px !important;
        }
        /* ==================== 标签栏文字颜色自动适配（根据背景色亮度反色处理） ==================== */
        /* 未激活标签文字颜色 - 根据标签栏背景色自动适配 */
        .uni-tabs-container .ant-tabs-tab:not(.ant-tabs-tab-active) .ant-tabs-tab-btn {
          color: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : tabsTextColor} !important;
          font-weight: normal !important;
        }
        /* 未激活标签分隔线颜色 - 根据标签栏背景色自动适配 */
        .uni-tabs-container .ant-tabs-tab:not(.ant-tabs-tab-active)::after {
          background: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.16)'} !important;
        }
        /* Chrome 式效果：激活标签文字颜色 - 激活标签使用内容区背景，文字颜色使用默认主题色 */
        .uni-tabs-container .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: var(--ant-colorText) !important;
          font-weight: 500 !important;
        }
        /* 标签关闭按钮颜色 - 根据标签栏背景色自动适配 */
        .uni-tabs-container .ant-tabs-tab:not(.ant-tabs-tab-active) .ant-tabs-tab-remove {
          color: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.45)'} !important;
        }
        .uni-tabs-container .ant-tabs-tab:not(.ant-tabs-tab-active) .ant-tabs-tab-remove:hover {
          color: ${tabsTextColor} !important;
        }
        /* Chrome 式效果：激活标签与相邻未激活标签之间的分隔线隐藏 */
        /* 注意：不能隐藏激活标签的 ::after，因为需要用它来实现右侧圆角 */
        /* 但是，激活标签后面的标签仍然需要显示分割线，所以不隐藏它 */
        /* 注释掉原来的规则，让分割线正常显示 */
        /* .uni-tabs-container .ant-tabs-tab-active + .ant-tabs-tab::after {
          display: none !important;
        } */
        /* 移除标签切换时的过渡动画 */
        .uni-tabs-container .ant-tabs-tab {
          transition: none !important;
        }
        .uni-tabs-container .ant-tabs-ink-bar {
          transition: none !important;
        }
        /* 标签栏与内容区无缝融合 */
        .uni-tabs-wrapper {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: visible !important;
        }
        /* 标签栏头部背景色 - 支持自定义背景色（支持透明度） */
        .uni-tabs-header {
          background: ${tabsBgColor} !important;
          flex-shrink: 0;
          padding-bottom: 0;
          margin-bottom: 0px; /* 移除底部间距，由内容区控制 */
          position: sticky;
          top: 56px; /* ProLayout 顶栏高度 */
          z-index: 10;
          overflow: visible !important;
          border-bottom: none !important;
        }
        /* 确保背景色生效 - 增加选择器优先级，支持深色模式 */
        div.uni-tabs-header {
          background: ${tabsBgColor} !important;
        }
        /* 标签栏容器背景色 - 支持自定义背景色（支持透明度） */
        .uni-tabs-container {
          background: ${tabsBgColor} !important;
        }
        .uni-tabs-container .ant-tabs-nav {
          background: ${tabsBgColor} !important;
        }
        .uni-tabs-container .ant-tabs-nav-wrap {
          background: ${tabsBgColor} !important;
        }
        .uni-tabs-container .ant-tabs-nav-list {
          background: ${tabsBgColor} !important;
        }
        /* 确保单个标签时也没有底部间距 */
        .uni-tabs-container .ant-tabs-nav {
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }
        .uni-tabs-container .ant-tabs-nav-list {
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
        }
        /* 当只有一个标签时，确保没有额外间距 */
        .uni-tabs-container .ant-tabs-nav:has(.ant-tabs-tab:only-child) {
          margin-bottom: 0 !important;
        }
        .uni-tabs-container .ant-tabs-nav:has(.ant-tabs-tab:only-child) .ant-tabs-tab-active {
          margin-bottom: -1px !important;
        }
        .uni-tabs-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          background: var(--ant-colorBgLayout);
          margin-top: 16px !important; /* 将间距移到这里 */
          padding-top: 0 !important;
          /* 限高优化：高度 = 浏览器高度 - 顶栏高度(56px) - unitabs高度(56px) - 间距(16px) */
          height: calc(100vh - ${isFullscreen ? '0px' : '56px'} - 56px - 16px); 
          max-height: calc(100vh - ${isFullscreen ? '0px' : '56px'} - 56px - 16px);
          /* 彻底隐藏滚动条且不占用空间 */
          scrollbar-width: none !important; /* Firefox */
          -ms-overflow-style: none !important; /* IE/Edge */
        }
        /* 工作台：不滚动，边距由内部 DashboardTemplate 控制避免加载抖动 */
        .uni-tabs-content.uni-tabs-content-dashboard {
          overflow: hidden !important;
        }
        .uni-tabs-content::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        /* HMI 外层：与内容区四边等距 16px */
        .uni-tabs-content-hmi-container {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          min-height: calc( 100vh - ${isFullscreen ? '0px' : '56px'} - 56px - 16px);
          box-sizing: border-box;
          padding: 0 16px;
        }
        /* HMI 内层：带圆角的框，裁剪内部 HMI，工业风边框与阴影 */
        .uni-tabs-content-hmi-inner {
          flex: 1;
          min-height: 0;
          border-radius: ${typeof token.borderRadius === 'number' ? token.borderRadius : 8}px !important;
          overflow: hidden !important;
          isolation: isolate;
          contain: layout paint;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
        }
        /* 内层直接子元素（HMI 根）适配圆角与宽度 */
        .uni-tabs-content-hmi-inner > * {
          border-radius: inherit;
          max-width: 100%;
          box-sizing: border-box;
        }
        /* 确保所有元素在滚动条隐藏时不占位 */
        * {
          scrollbar-gutter: auto !important;
        }
        /* 标签栏头部包装器 - 包含滚动按钮 */
        .uni-tabs-header-wrapper {
          display: flex;
          align-items: center;
          position: relative;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          overflow: visible !important;
          overflow-x: visible !important;
          overflow-y: visible !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
          z-index: 1;
          pointer-events: none;
        }
        /* 允许按钮和标签栏接收点击事件 */
        .uni-tabs-header-wrapper .uni-tabs-scroll-button,
        .uni-tabs-header-wrapper .uni-tabs-container {
          pointer-events: auto;
        }
        /* 滚动按钮样式 - 根据标签栏背景色自动适配颜色，统一大小和padding */
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]),
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]),
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]),
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]),
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]),
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]) {
          width: 24px !important; /* 图标14px + 左右padding各5px = 24px */
          height: 40px !important; /* 总高40px */
          padding: 13px 5px !important; /* 上下13px，左右5px，图标14px居中 */
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
          border: none !important;
          border-bottom: none !important;
          background: transparent !important;
          box-shadow: none !important;
          color: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : token.colorPrimary} !important;
          cursor: pointer !important;
          pointer-events: auto !important;
          position: relative !important;
          z-index: 2 !important;
          margin-bottom: 0 !important;
          margin-top: 0 !important;
          line-height: 1 !important;
        }
        /* 按钮图标颜色 - 根据标签栏背景色自动适配（深色背景使用浅色图标，浅色背景使用主题色） */
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]) .ant-btn-icon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]) span.anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]) .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]) svg,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]) svg,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]) svg {
          color: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : token.colorPrimary} !important;
          fill: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : token.colorPrimary} !important;
        }
        /* 去掉按钮的所有伪元素和边框 */
        .uni-tabs-header-wrapper .uni-tabs-scroll-button::before,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button::after {
          display: none !important;
        }
        /* 无法点击时：浅灰色 - 覆盖所有可能的样式，统一大小和padding */
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:disabled,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-disabled,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button[disabled],
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn:disabled,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn.ant-btn-disabled,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-text:disabled,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-text.ant-btn-disabled,
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button:disabled,
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button.ant-btn-disabled,
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button[disabled] {
          width: 24px !important; /* 图标14px + 左右padding各5px = 24px */
          height: 40px !important; /* 总高40px */
          padding: 13px 5px !important; /* 上下13px，左右5px，图标14px居中 */
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          flex-shrink: 0 !important;
          border: none !important;
          border-bottom: none !important;
          background: transparent !important;
          box-shadow: none !important;
          color: rgba(0, 0, 0, 0.25) !important;
          cursor: not-allowed !important;
          pointer-events: none !important;
          position: relative !important;
          z-index: 2 !important;
          margin-bottom: 0 !important;
          margin-top: 0 !important;
          line-height: 1 !important;
        }
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:disabled .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:disabled .ant-btn-icon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:disabled span.anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-disabled .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-disabled .ant-btn-icon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-disabled span.anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button[disabled] .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button[disabled] .ant-btn-icon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button[disabled] span.anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn:disabled .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn.ant-btn-disabled .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-text:disabled .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-text.ant-btn-disabled .anticon,
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button:disabled .anticon,
        .uni-tabs-header-wrapper button.uni-tabs-scroll-button:disabled svg,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:disabled svg {
          color: rgba(0, 0, 0, 0.25) !important;
          fill: rgba(0, 0, 0, 0.25) !important;
        }
        /* 可以点击时：主题色（默认状态，hover 时加深） */
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover {
          color: var(--ant-colorPrimaryHover) !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover .ant-btn-icon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover span.anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover .anticon,
        .uni-tabs-header-wrapper .uni-tabs-scroll-button.ant-btn-text:not(:disabled):not(.ant-btn-disabled):not([disabled]):hover .anticon {
          color: var(--ant-colorPrimaryHover) !important;
        }
        /* 按钮容器样式 - 高度与按钮一致，宽度等于按钮宽度 */
        .uni-tabs-scroll-button-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px; /* 按钮宽度 24px，容器宽度也设置为 24px */
          height: 40px; /* 与按钮高度一致 */
          padding-bottom: 0 !important;
          padding-top: 0 !important;
          border-bottom: none !important;
          position: relative;
          overflow: visible; /* 确保分割线可以显示 */
          flex-shrink: 0; /* 防止被压缩 */
        }
        /* 左按钮容器 - 右侧分割线 */
        .uni-tabs-scroll-button-left {
          margin-right: 0;
          position: relative;
          z-index: 2;
        }
        /* 左按钮右侧分割线 - 根据标签栏背景色自动适配 */
        .uni-tabs-scroll-button-wrapper:has(.uni-tabs-scroll-button-left)::after {
          content: '';
          position: absolute;
          right: 0;
          top: -1px;
          bottom: 0; /* 确保分割线到底部 */
          width: 1px;
          background: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.06)'} !important;
          z-index: 1;
          opacity: 1 !important;
        }
        /* 左侧阴影 - 显示在左按钮右侧，当可以向左滚动时显示，根据标签栏背景色自动适配 */
        .uni-tabs-header-wrapper.can-scroll-left::before {
          content: '';
          position: absolute;
          left: 24px; /* 按钮宽度 24px，适配新按钮尺寸 */
          top: 0;
          bottom: 0; /* 与右侧阴影保持一致，确保对称 */
          width: 20px;
          background: linear-gradient(to right, ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)'}, transparent) !important;
          pointer-events: none;
          z-index: 1; /* 与右侧阴影一致，确保不遮挡标签文字 */
        }
        /* 右按钮容器 - 左侧分割线（移除右侧分割线避免重复） */
        .uni-tabs-scroll-button-right {
          margin-left: 0;
          position: relative;
          z-index: 2;
        }
        /* 右按钮左侧分割线 - 根据标签栏背景色自动适配 */
        .uni-tabs-scroll-button-wrapper:has(.uni-tabs-scroll-button-right)::before {
          content: '';
          position: absolute;
          left: 0;
          top: -1px;
          bottom: 0; /* 确保分割线到底部 */
          width: 1px;
          background: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.06)'} !important;
          z-index: 1;
          opacity: 1 !important;
        }
        /* 右侧阴影 - 显示在小箭头按钮左侧，固定位置不随滚动移动，根据标签栏背景色自动适配 */
        .uni-tabs-header-wrapper.can-scroll-right::after {
          content: '';
          position: absolute;
          right: 24px; /* 按钮宽度 24px，适配新按钮尺寸 */
          top: 0;
          bottom: 0;
          width: 20px;
          background: linear-gradient(to left, ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.06)'}, transparent);
          pointer-events: none;
          z-index: 1;
        }
        /* 如果有全屏按钮且没有右按钮，右侧阴影直接在全屏按钮左侧 */
        .uni-tabs-header-wrapper.can-scroll-right:has(.uni-tabs-fullscreen-button-wrapper):not(:has(.uni-tabs-scroll-button-right))::after {
          right: 40px; /* 全屏按钮 40px */
        }
        /* 如果有全屏按钮且有右按钮，右侧阴影需要向右偏移 */
        .uni-tabs-header-wrapper.can-scroll-right:has(.uni-tabs-fullscreen-button-wrapper):has(.uni-tabs-scroll-button-right)::after {
          right: 64px; /* 右按钮 24px + 全屏按钮 40px */
        }
        /* 全屏按钮容器样式 - 统一大小和padding，与按钮宽度高度一致 */
        .uni-tabs-fullscreen-button-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px; /* 按钮宽度 40px，容器宽度也设置为 40px */
          height: 40px; /* 与按钮高度一致 */
          margin-left: 0;
          padding-bottom: 0 !important;
          padding-top: 0 !important;
          border-bottom: none !important;
          position: relative;
          overflow: visible; /* 确保分割线可以显示 */
          flex-shrink: 0; /* 防止被压缩 */
          z-index: 2;
        }
        /* 全屏按钮左侧分割线 - 与标签页分割线样式一致，等高，根据标签栏背景色自动适配 */
        .uni-tabs-fullscreen-button-wrapper::before {
          content: '';
          position: absolute;
          left: 0;
          top: -1px;
          bottom: 0; /* 确保分割线到底部 */
          width: 1px;
          background: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.06)'} !important;
          z-index: 1;
          opacity: 1 !important;
        }
        /* 全屏按钮样式 - 单独设置，保持左右padding为13px（与左右按钮不同），根据标签栏背景色自动适配 */
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button,
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button.ant-btn,
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button.ant-btn-text,
        .uni-tabs-header-wrapper button.uni-tabs-fullscreen-button,
        .uni-tabs-header-wrapper button.uni-tabs-fullscreen-button.ant-btn,
        .uni-tabs-header-wrapper button.uni-tabs-fullscreen-button.ant-btn-text {
          width: 40px !important; /* 正方形，与高度一致 */
          height: 40px !important; /* 总高40px */
          padding: 13px !important; /* 四周padding相等（左右13px），图标14px居中 */
          color: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : token.colorPrimary} !important;
        }
        /* 全屏按钮图标颜色 - 根据标签栏背景色自动适配 */
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button .anticon,
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button.ant-btn .anticon,
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button.ant-btn-text .anticon,
        .uni-tabs-header-wrapper button.uni-tabs-fullscreen-button .anticon,
        .uni-tabs-header-wrapper button.uni-tabs-fullscreen-button.ant-btn .anticon,
        .uni-tabs-header-wrapper button.uni-tabs-fullscreen-button.ant-btn-text .anticon {
          color: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : token.colorPrimary} !important;
        }
        /* 全屏按钮 hover 状态 - 根据标签栏背景色自动适配 */
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button:hover,
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button.ant-btn:hover,
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button.ant-btn-text:hover {
          color: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 1)' : 'var(--ant-colorPrimaryHover)'} !important;
        }
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button:hover .anticon,
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button.ant-btn:hover .anticon,
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button.ant-btn-text:hover .anticon {
          color: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 1)' : 'var(--ant-colorPrimaryHover)'} !important;
        }
        /* 标签栏容器 - 允许横向滚动，底部允许溢出显示外圆角 */
        .uni-tabs-container {
          flex: 1;
          overflow-x: hidden;
          overflow-y: hidden;
          position: relative;
          z-index: 1;
        }
        /* 强制隐藏 tabs nav 的滚动条 */
        .uni-tabs-container .ant-tabs-nav::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .uni-tabs-container .ant-tabs-nav {
          overflow-x: auto;
          overflow-y: hidden; /* 关键：防止垂直滚动条出现 */
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
          scrollbar-width: none !important; /* Firefox */
        }
        .uni-tabs-container .ant-tabs-nav-list {
          overflow: visible !important;
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
        }
        .uni-tabs-container .ant-tabs-tab {
          overflow: visible !important;
        }
        /* 移除所有可能移动的阴影效果和分隔线 */
        .uni-tabs-container .ant-tabs-nav-more {
          padding: 8px 0px 8px 8px !important;
          box-shadow: none !important;
          color: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : tabsTextColor} !important;
        }
        /* 更多标签按钮图标颜色 - 根据标签栏背景色自动适配 */
        .uni-tabs-container .ant-tabs-nav-more .anticon {
          color: ${tabsTextColor === '#ffffff' ? 'rgba(255, 255, 255, 0.85)' : tabsTextColor} !important;
        }
        .uni-tabs-container .ant-tabs-nav-operations {
          box-shadow: none !important;
        }
        /* 移除 nav-operations 的伪元素分隔线 */
        .uni-tabs-container .ant-tabs-nav-operations::before,
        .uni-tabs-container .ant-tabs-nav-operations::after {
          display: none !important;
          box-shadow: none !important;
        }
        /* 禁用 Ant Design 原生右侧阴影，使用自定义阴影适配小箭头按钮 */
        .uni-tabs-container .ant-tabs-nav-wrap::after {
          display: none !important;
        }
        /* 移除 nav-list 的分隔线 */
        .uni-tabs-container .ant-tabs-nav-list::after {
          display: none !important;
        }
        /* 彻底隐藏所有相关容器的滚动条 */
        .uni-tabs-container .ant-tabs-nav-wrap::-webkit-scrollbar,
        .uni-tabs-container .ant-tabs-nav-scroll::-webkit-scrollbar,
        .uni-tabs-container .ant-tabs-nav-list::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        
        /* 统一内容容器样式 */
        .uni-tabs-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .uni-tabs-content {
          flex: 1;
          overflow: auto; /* 允许滚动，所有页面滚动都在这个容器上 */
          position: relative;
        }

        /* 普通页面统一添加 16px 内边距（顶部由 margin-top 控制，所以顶部内边距为 0） */
        /* 使用 !important 确保在全屏模式下 padding 不会被 ProLayout 或其他样式覆盖 */
        .uni-tabs-content-padded {
          /* 使用 margin 代替 padding，避免在全屏模式下 padding 失效的问题 */
          /* 此时滚动条会位于内容区域的边缘（margin 内部），而不是窗口边缘 */
          margin: 16px !important;
          padding: 0 !important;
          box-sizing: border-box;
          width: calc(100% - 32px) !important;
        }
      `}</style>
      <div 
        className="uni-tabs-wrapper"
        style={{
          '--header-height': isFullscreen ? '0px' : '56px',
          '--tabs-height': '56px',
          '--content-margin': '16px',
        } as React.CSSProperties}
      >
        <div className="uni-tabs-header">
          <div
            className={`uni-tabs-header-wrapper ${canScrollLeft ? 'can-scroll-left' : ''} ${canScrollRight ? 'can-scroll-right' : ''}`}
            ref={tabsNavRef}
          >
            {/* 左侧滚动箭头 - 仅在需要时显示 */}
            {canScrollLeft && (
              <div className="uni-tabs-scroll-button-wrapper">
                <Button
                  type="text"
                  size="small"
                  icon={<CaretLeftFilled />}
                  onClick={() => scrollTabs('left')}
                  disabled={!canScrollLeft}
                  className="uni-tabs-scroll-button uni-tabs-scroll-button-left"
                />
              </div>
            )}
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
                        // 仪表盘标签和固定标签不可双击关闭
                        if (tab.key !== '/system/dashboard/workplace' && tab.closable && !tab.pinned) {
                          handleTabClose(tab.key);
                        }
                      }}
                      style={{ userSelect: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {tab.label}
                      {tab.pinned && (
                        <PushpinOutlined
                          style={{
                            fontSize: 12,
                            color: 'var(--ant-colorPrimary)',
                            transform: 'rotate(-45deg)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </span>
                  </Dropdown>
                ),
                closable: tab.closable && !tab.pinned, // 固定标签不可关闭
              }))}
              size="small"
              className="uni-tabs-container"
            />
            {/* 右侧滚动箭头 - 仅在需要时显示 */}
            {canScrollRight && (
              <div className="uni-tabs-scroll-button-wrapper">
                <Button
                  type="text"
                  size="small"
                  icon={<CaretRightFilled />}
                  onClick={() => scrollTabs('right')}
                  disabled={!canScrollRight}
                  className="uni-tabs-scroll-button uni-tabs-scroll-button-right"
                />
              </div>
            )}
            {/* 全屏按钮 */}
            {onToggleFullscreen && (
              <div className="uni-tabs-scroll-button-wrapper uni-tabs-fullscreen-button-wrapper">
                <Tooltip title={isFullscreen ? t('tabs.exitFullscreen') : t('tabs.fullscreen')} placement="left">
                  <Button
                    type="text"
                    size="small"
                    icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                    onClick={onToggleFullscreen}
                    className="uni-tabs-scroll-button uni-tabs-fullscreen-button"
                  />
                </Tooltip>
              </div>
            )}
          </div>
        </div>
        <div
          className={`uni-tabs-content${isDashboardOrAnalysisPage ? ' uni-tabs-content-dashboard' : ''}`}
          key={`content-${activeKey}-${refreshKey}`}
        >
          {isHMIPage ? (
            <div className="uni-tabs-content-hmi-container">
              <div className="uni-tabs-content-hmi-inner">
                {children}
              </div>
            </div>
          ) : (
            <div style={{
              padding: isDashboardOrAnalysisPage ? 0 : '0 16px 0 16px',
              width: '100%',
              flex: 1,
              minHeight: 0,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {children}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

