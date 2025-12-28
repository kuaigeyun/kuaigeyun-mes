/**
 * RiverEdge SaaS 多组织框架 - 统一标签栏组件
 *
 * 提供多标签页管理功能，支持标签的添加、切换、关闭等操作
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, Button, Dropdown, MenuProps, theme, Tooltip } from 'antd';
import { CaretLeftFilled, CaretRightFilled, ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined, PushpinOutlined } from '@ant-design/icons';
import type { MenuDataItem } from '@ant-design/pro-components';
import { getUserPreference } from '../../services/userPreference';

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
 * 将路径片段转换为中文名称（作为后备方案）
 */
const translatePathToChinese = (pathSegment: string): string => {
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
    'materials': '物料',
    'bom': 'BOM',
    'material': '物料数据',
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
  };
  
  return pathMap[pathSegment] || pathSegment;
};

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
    // 如果路径匹配应用路由，尝试从路径中提取中文名称
    const pathSegment = path.split('/').pop() || '';
    return translatePathToChinese(pathSegment) || '未命名页面';
  }

  const menuTitle = findInMenu(menuConfig);
  if (menuTitle) {
    return menuTitle;
  }
  
  // 如果没有找到菜单项，尝试从路径中提取中文名称
  const pathSegment = path.split('/').pop() || '';
  return translatePathToChinese(pathSegment) || '未命名页面';
};

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
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');
  const tabsNavRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [tabsPersistence, setTabsPersistence] = useState<boolean>(false); // 标签栏持久化配置
  const [isInitialized, setIsInitialized] = useState<boolean>(false); // 是否已初始化（避免重复恢复）

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

        // 性能优化：如果标签数量超过限制，自动关闭最旧的标签（保留工作台和固定标签）
        if (newTabs.length > TAB_CONFIG.MAX_TABS) {
          // 找到最旧的标签（除了工作台和固定标签）
          const closableTabs = newTabs.filter((tab) => tab.closable && !tab.pinned && tab.key !== '/system/dashboard/workplace');
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
   * 读取标签栏持久化配置
   */
  useEffect(() => {
    const loadTabsPersistence = async () => {
      try {
        // 优先从用户偏好设置读取
        const userPreference = await getUserPreference().catch(() => null);

        if (userPreference?.preferences?.tabs_persistence !== undefined) {
          const persistence = userPreference.preferences.tabs_persistence;
          setTabsPersistence(persistence);
          // 如果未启用持久化，立即标记为已初始化
          if (!persistence) {
            setIsInitialized(true);
          }
        } else {
          // 其次从本地存储读取
          const localTabsPersistence = localStorage.getItem('riveredge_tabs_persistence');
          if (localTabsPersistence !== null) {
            const persistence = localTabsPersistence === 'true';
            setTabsPersistence(persistence);
            // 如果未启用持久化，立即标记为已初始化
            if (!persistence) {
              setIsInitialized(true);
            }
          } else {
            // 默认关闭，立即标记为已初始化
            setTabsPersistence(false);
            setIsInitialized(true);
          }
        }
      } catch (error) {
        // 如果获取失败，从本地存储读取
        const localTabsPersistence = localStorage.getItem('riveredge_tabs_persistence');
        if (localTabsPersistence !== null) {
          const persistence = localTabsPersistence === 'true';
          setTabsPersistence(persistence);
          // 如果未启用持久化，立即标记为已初始化
          if (!persistence) {
            setIsInitialized(true);
          }
        } else {
          // 默认关闭，立即标记为已初始化
          setTabsPersistence(false);
          setIsInitialized(true);
        }
      }
    };
    
    loadTabsPersistence();
    
    // 监听用户偏好更新事件
    const handleUserPreferenceUpdated = (event: CustomEvent) => {
      console.log('UniTabs收到用户偏好更新事件:', event.detail);
      if (event.detail?.preferences?.tabs_persistence !== undefined) {
        const persistence = event.detail.preferences.tabs_persistence;
        console.log('UniTabs更新标签栏持久化配置:', persistence);
        setTabsPersistence(persistence);
        // 配置更新后，立即标记为已初始化（无论开启还是关闭）
        setIsInitialized(true);
        console.log('UniTabs配置更新完成，已标记为已初始化');
      }
    };
    
    window.addEventListener('userPreferenceUpdated', handleUserPreferenceUpdated as EventListener);
    
    return () => {
      window.removeEventListener('userPreferenceUpdated', handleUserPreferenceUpdated as EventListener);
    };
  }, []);

  /**
   * 恢复持久化的标签（仅在启用持久化且未初始化时执行一次）
   * 刷新页面时恢复之前打开的标签
   */
  useEffect(() => {
    // 如果已经初始化或有标签了，不再恢复
    if (isInitialized) {
      return;
    }
    
    // 如果 tabsPersistence 还没有加载完成（还是默认值 false），等待加载完成
    // 通过检查 localStorage 来判断是否已经加载完成
    const localTabsPersistence = localStorage.getItem('riveredge_tabs_persistence');
    const userPreferenceTabsPersistence = tabsPersistence;
    
    // 如果既没有从用户偏好设置读取到，也没有从本地存储读取到，说明还在加载中，等待
    if (!userPreferenceTabsPersistence && localTabsPersistence === null) {
      // 还在加载中，等待
      return;
    }
    
    // 确定最终的持久化配置值
    const finalTabsPersistence = userPreferenceTabsPersistence || (localTabsPersistence === 'true');
    
    // 如果未启用持久化，直接标记为已初始化，不恢复任何标签
    // 只保留工作台标签（会在路由监听中自动添加）
    if (!finalTabsPersistence) {
      setIsInitialized(true);
      return;
    }
    
    // 启用持久化时，尝试从 localStorage 恢复标签
    try {
      const savedTabs = localStorage.getItem('riveredge_saved_tabs');

      if (savedTabs) {
        const parsedTabs: TabItem[] = JSON.parse(savedTabs);

        if (Array.isArray(parsedTabs) && parsedTabs.length > 0) {
          // 检查当前是否在平台级页面
          const isInfraPage = location.pathname.startsWith('/infra');

          // 根据当前页面类型过滤标签
          const validTabs = parsedTabs.filter((tab) => {
            // 验证标签格式
            if (!tab || typeof tab !== 'object' || !tab.key || !tab.path || !tab.label) {
              return false;
            }

            // 如果在平台级页面，只恢复平台级标签；如果在系统级页面，只恢复系统级标签
            if (isInfraPage) {
              return tab.path.startsWith('/infra');
            } else {
              return !tab.path.startsWith('/infra') || tab.path.startsWith('/system');
            }
          });

          if (validTabs.length > 0) {
            // 根据当前页面级别确保默认标签存在
            if (isInfraPage) {
              // 平台级页面：确保运营中心标签存在
              const hasOperation = validTabs.some((tab) => tab.key === '/infra/operation');
              if (!hasOperation) {
                const operationTab: TabItem = {
                  key: '/infra/operation',
                  path: '/infra/operation',
                  label: getTabTitle('/infra/operation'),
                  closable: false,
                  pinned: false,
                };
                validTabs.unshift(operationTab);
              }
            } else {
              // 系统级页面：确保工作台标签存在
              const hasWorkplace = validTabs.some((tab) => tab.key === '/system/dashboard/workplace');
              if (!hasWorkplace) {
                const workplaceTab: TabItem = {
                  key: '/system/dashboard/workplace',
                  path: '/system/dashboard/workplace',
                  label: getTabTitle('/system/dashboard/workplace'),
                  closable: false,
                  pinned: false,
                };
                validTabs.unshift(workplaceTab);
              }
            }

            setTabs(validTabs);
          } else {
            // 如果没有有效的标签页，根据当前页面级别创建默认标签
            const defaultTabs: TabItem[] = [];
            let defaultActiveKey: string;

            if (isInfraPage) {
              defaultActiveKey = '/infra/operation';
              defaultTabs.push({
                key: defaultActiveKey,
                path: defaultActiveKey,
                label: getTabTitle(defaultActiveKey),
                closable: false,
                pinned: false,
              });
            } else {
              defaultActiveKey = '/system/dashboard/workplace';
              defaultTabs.push({
                key: defaultActiveKey,
                path: defaultActiveKey,
                label: getTabTitle(defaultActiveKey),
                closable: false,
                pinned: false,
              });
            }
            setTabs(defaultTabs);
            setActiveKey(defaultActiveKey);
            // 临时禁用自动导航，避免调试页面被跳转
            // setTimeout(() => {
            //   navigate(defaultActiveKey);
            // }, 0);
          }

          // 对于有有效标签的情况，设置活动标签并导航
          if (validTabs.length > 0) {
            // 设置活动标签并导航的函数
            const setActiveKeyAndNavigate = (tabs: TabItem[], savedActiveKey: string | null, isInfraPage: boolean) => {
              // 如果当前路径是调试页面或应用页面，不进行自动导航
              const currentPath = window.location.pathname;
              if (currentPath.startsWith('/debug/') || currentPath.startsWith('/apps/')) {
                console.log('🚫 UniTabs: 调试页面或应用页面，跳过自动导航');
                setActiveKey(currentPath);
                return;
              }

              if (savedActiveKey && tabs.some((tab) => tab.key === savedActiveKey)) {
                // 检查保存的活动标签是否与当前页面级别匹配
                const isSavedInfraTab = savedActiveKey.startsWith('/infra');
                if ((isInfraPage && isSavedInfraTab) || (!isInfraPage && !isSavedInfraTab)) {
                  setActiveKey(savedActiveKey);
                  setTimeout(() => {
                    navigate(savedActiveKey);
                  }, 0);
                  return;
                }
              }

              // 默认激活第一个标签
              setActiveKey(tabs[0].key);
              setTimeout(() => {
                navigate(tabs[0].key);
              }, 0);
            };

            // 恢复当前激活的标签（如果存在且匹配当前页面级别）
            const savedActiveKey = localStorage.getItem('riveredge_saved_active_key');
            setActiveKeyAndNavigate(validTabs, savedActiveKey, isInfraPage);
          }

          setIsInitialized(true);
          return;
        }
      }
    } catch (error) {
      // 恢复失败，使用默认行为
    }
    
    // 如果没有保存的标签，标记为已初始化，使用默认行为
    setIsInitialized(true);
  }, [tabsPersistence, isInitialized, getTabTitle, navigate]);

  /**
   * 保存标签到本地存储（当启用持久化且标签变化时）
   * 每次标签变化时自动保存，刷新页面时就能恢复
   */
  useEffect(() => {
    if (!tabsPersistence || !isInitialized || tabs.length === 0) {
      return;
    }
    
    try {
      // 保存标签列表
      localStorage.setItem('riveredge_saved_tabs', JSON.stringify(tabs));
      // 保存当前激活的标签
      if (activeKey) {
        localStorage.setItem('riveredge_saved_active_key', activeKey);
      }
    } catch (error) {
      // 保存失败，静默处理
    }
  }, [tabs, activeKey, tabsPersistence, isInitialized]);

  /**
   * 监听路由变化，自动添加标签
   * 注意：如果启用了持久化且正在恢复标签，不要立即添加标签，避免覆盖恢复的标签
   */
  useEffect(() => {
    if (!isInitialized) {
      // 如果还没有初始化，等待恢复标签完成
      return;
    }
    
    if (location.pathname) {
      // 确保工作台标签始终存在（固定第一个）
      addTab('/system/dashboard/workplace');
      // 添加当前页面标签
      addTab(location.pathname);
      setActiveKey(location.pathname);
    }
  }, [location.pathname, addTab, isInitialized]);

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
    const targetTab = tabs[targetIndex];
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
  const handleCloseAll = () => {
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

    // 如果还有标签，切换到第一个标签；否则跳转到工作台
    if (newTabs.length > 0) {
      setTabs(newTabs);
      setActiveKey(newTabs[0].key);
      navigate(newTabs[0].key);
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
    const targetTab = tabs.find((tab) => tab.key === tabKey);
    const isWorkplace = tabKey === '/system/dashboard/workplace';
    const hasRightTabs = targetIndex < tabs.length - 1;
    const hasOtherTabs = tabs.length > 1;
    const isPinned = targetTab?.pinned || false;

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
        key: 'pin',
        label: isPinned ? '取消固定' : '固定',
        icon: <PushpinOutlined style={{ transform: isPinned ? 'rotate(-45deg)' : 'none' }} />,
      },
      {
        type: 'divider',
      },
      {
        key: 'close',
        label: '关闭',
        disabled: isWorkplace || isPinned, // 工作台和固定标签不可关闭
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

  // 如果没有标签，直接渲染子组件
  if (tabs.length === 0) {
    return <>{children}</>;
  }

  return (
    <>
      <style>{`
        /* 标签栏样式优化 */
        .uni-tabs-container .ant-tabs {
          margin: 0 !important;
          margin-bottom: 0 !important;
          border: none !important;
          border-bottom: none !important;
          box-shadow: none !important;
          outline: none !important;
          background: var(--ant-colorBgContainer) !important;
        }
          .ant-tabs{
            padding-top: 2px;
            padding-left: 8px;
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
        /* Chrome 式标签样式 - 所有标签都有顶部圆角 */
        .uni-tabs-container .ant-tabs-tab {
          margin: 0 !important;
          padding: 8px 16px !important;
          padding-bottom: 8px !important;
          border: none !important;
          border-bottom: none !important;
          background: var(--ant-colorBgContainer) !important;
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
        /* Chrome 式效果：激活标签文字颜色 */
        .uni-tabs-container .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: var(--ant-colorText) !important;
          font-weight: 500 !important;
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
        .uni-tabs-header {
          background: var(--ant-colorBgContainer) !important;
          flex-shrink: 0;
          padding-bottom: 0;
          margin-bottom: 0;
          position: sticky;
          top: 56px; /* ProLayout 顶栏高度 */
          z-index: 10;
          overflow: visible !important;
          border-bottom: none !important;
        }
        /* 确保背景色生效 - 增加选择器优先级，支持深色模式 */
        div.uni-tabs-header {
          background: var(--ant-colorBgContainer) !important;
        }
        /* 标签栏容器背景色与菜单栏一致 */
        .uni-tabs-container {
          background: var(--ant-colorBgContainer) !important;
        }
        .uni-tabs-container .ant-tabs-nav {
          background: var(--ant-colorBgContainer) !important;
        }
        .uni-tabs-container .ant-tabs-nav-wrap {
          background: var(--ant-colorBgContainer) !important;
        }
        .uni-tabs-container .ant-tabs-nav-list {
          background: var(--ant-colorBgContainer) !important;
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
          overflow: auto;
          position: relative;
          background: var(--ant-colorBgLayout);
          margin-top: 0 !important;
          padding-top: 0 !important;
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
        /* 滚动按钮样式 - 默认主题色（可点击时）统一大小和padding */
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
          color: ${token.colorPrimary} !important;
          cursor: pointer !important;
          pointer-events: auto !important;
          position: relative !important;
          z-index: 2 !important;
          margin-bottom: 0 !important;
          margin-top: 0 !important;
          line-height: 1 !important;
        }
        /* 按钮图标颜色 - 可点击时使用主题色 */
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
          color: ${token.colorPrimary} !important;
          fill: ${token.colorPrimary} !important;
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
        .uni-tabs-scroll-button-wrapper:has(.uni-tabs-scroll-button-left)::after {
          content: '';
          position: absolute;
          right: 0;
          top: -1px;
          bottom: 0; /* 确保分割线到底部 */
          width: 1px;
          background: rgba(0, 0, 0, 0.06) !important; /* 与顶栏分割线颜色一致 */
          z-index: 1;
          opacity: 1 !important;
        }
        /* 深色模式下的分割线颜色 */
        html[data-theme='dark'] .uni-tabs-scroll-button-wrapper:has(.uni-tabs-scroll-button-left)::after,
        body[data-theme='dark'] .uni-tabs-scroll-button-wrapper:has(.uni-tabs-scroll-button-left)::after {
          background: rgba(255, 255, 255, 0.08) !important; /* 深色模式与顶栏分割线颜色一致 */
        }
        /* 左侧阴影 - 显示在左按钮右侧，当可以向左滚动时显示 */
        .uni-tabs-header-wrapper.can-scroll-left::before {
          content: '';
          position: absolute;
          left: 24px; /* 按钮宽度 24px，适配新按钮尺寸 */
          top: 0;
          bottom: 0; /* 与右侧阴影保持一致，确保对称 */
          width: 20px;
          background: linear-gradient(to right, rgba(0, 0, 0, 0.08), transparent) !important; /* 提高不透明度，确保可见 */
          pointer-events: none;
          z-index: 1; /* 与右侧阴影一致，确保不遮挡标签文字 */
        }
        /* 深色模式下的左侧阴影 */
        html[data-theme='dark'] .uni-tabs-header-wrapper.can-scroll-left::before,
        body[data-theme='dark'] .uni-tabs-header-wrapper.can-scroll-left::before {
          background: linear-gradient(to right, rgba(255, 255, 255, 0.08), transparent) !important; /* 提高不透明度，确保可见 */
        }
        /* 右按钮容器 - 左侧分割线（移除右侧分割线避免重复） */
        .uni-tabs-scroll-button-right {
          margin-left: 0;
          position: relative;
          z-index: 2;
        }
        .uni-tabs-scroll-button-wrapper:has(.uni-tabs-scroll-button-right)::before {
          content: '';
          position: absolute;
          left: 0;
          top: -1px;
          bottom: 0; /* 确保分割线到底部 */
          width: 1px;
          background: rgba(0, 0, 0, 0.06) !important; /* 与顶栏分割线颜色一致 */
          z-index: 1;
          opacity: 1 !important;
        }
        /* 深色模式下的分割线颜色 */
        html[data-theme='dark'] .uni-tabs-scroll-button-wrapper:has(.uni-tabs-scroll-button-right)::before,
        body[data-theme='dark'] .uni-tabs-scroll-button-wrapper:has(.uni-tabs-scroll-button-right)::before {
          background: rgba(255, 255, 255, 0.08) !important; /* 深色模式与顶栏分割线颜色一致 */
        }
        /* 右侧阴影 - 显示在小箭头按钮左侧，固定位置不随滚动移动 */
        .uni-tabs-header-wrapper.can-scroll-right::after {
          content: '';
          position: absolute;
          right: 24px; /* 按钮宽度 24px，适配新按钮尺寸 */
          top: 0;
          bottom: 0;
          width: 20px;
          background: linear-gradient(to left, rgba(0, 0, 0, 0.06), transparent);
          pointer-events: none;
          z-index: 1;
        }
        /* 深色模式下的右侧阴影 */
        html[data-theme='dark'] .uni-tabs-header-wrapper.can-scroll-right::after,
        body[data-theme='dark'] .uni-tabs-header-wrapper.can-scroll-right::after {
          background: linear-gradient(to left, rgba(255, 255, 255, 0.06), transparent);
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
        /* 全屏按钮左侧分割线 - 与标签页分割线样式一致，等高 */
        .uni-tabs-fullscreen-button-wrapper::before {
          content: '';
          position: absolute;
          left: 0;
          top: -1px;
          bottom: 0; /* 确保分割线到底部 */
          width: 1px;
          background: rgba(0, 0, 0, 0.06) !important; /* 与顶栏分割线颜色一致 */
          z-index: 1;
          opacity: 1 !important;
        }
        /* 深色模式下的分割线颜色 */
        html[data-theme='dark'] .uni-tabs-fullscreen-button-wrapper::before,
        body[data-theme='dark'] .uni-tabs-fullscreen-button-wrapper::before {
          background: rgba(255, 255, 255, 0.08) !important; /* 深色模式与顶栏分割线颜色一致 */
        }
        /* 全屏按钮样式 - 单独设置，保持左右padding为13px（与左右按钮不同） */
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button,
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button.ant-btn,
        .uni-tabs-header-wrapper .uni-tabs-fullscreen-button.ant-btn-text,
        .uni-tabs-header-wrapper button.uni-tabs-fullscreen-button,
        .uni-tabs-header-wrapper button.uni-tabs-fullscreen-button.ant-btn,
        .uni-tabs-header-wrapper button.uni-tabs-fullscreen-button.ant-btn-text {
          width: 40px !important; /* 正方形，与高度一致 */
          height: 40px !important; /* 总高40px */
          padding: 13px !important; /* 四周padding相等（左右13px），图标14px居中 */
        }
        /* 标签栏容器 - 允许横向滚动，底部允许溢出显示外圆角 */
        .uni-tabs-container {
          flex: 1;
          overflow-x: hidden;
          overflow-y: visible;
          position: relative;
          z-index: 1;
        }
        .uni-tabs-container .ant-tabs-nav {
          overflow-x: auto;
          overflow-y: visible;
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
        }
        .uni-tabs-container .ant-tabs-nav-list {
          overflow: visible !important;
          padding-bottom: 0 !important;
          margin-bottom: 0 !important;
        }
        .uni-tabs-container .ant-tabs-tab {
          overflow: visible !important;
        }
          .ant-tabs-nav-more{
            padding: 8px 0px 8px 8px!important;
            box-shadow: none !important;
          }
        /* 移除所有可能移动的阴影效果和分隔线 */
        .uni-tabs-container .ant-tabs-nav-more {
          box-shadow: none !important;
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
      `}</style>
      <div className="uni-tabs-wrapper">
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
                <Tooltip title={isFullscreen ? '退出全屏' : '全屏'} placement="left">
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
        <div className="uni-tabs-content" key={`content-${activeKey}-${refreshKey}`}>
          {children}
        </div>
      </div>
    </>
  );
}

