import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, theme } from 'antd';
import { ShopOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  buildQuickEntriesFromMenuTree,
  findMenuInTree,
  getTranslatedMenuTitle,
} from '../quick-entry/quickEntryItems';
import { convertMenuTreeToTreeData } from '../quick-entry/convertMenuTreeToTreeData';
import {
  getQuickEntryIconByPath,
  renderQuickEntryMenuIcon,
} from '../quick-entry/renderQuickEntryMenuIcon';
import type { QuickEntryItem } from '../quick-entry/QuickEntryGrid';
import { getNavigationMenuTree } from '../../services/menu';
import type { UserPreference } from '../../services/userPreference';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';
import { useGlobalStore } from '../../stores';
import { useThemeStore } from '../../stores/themeStore';
import { useConfigStore } from '../../stores/configStore';
import { getPlatformVersion } from '../../services/platformSettings';
import { formatTimeInTimezone } from '../../utils/formatTimeInTimezone';
import { formatLunarDate } from '../../utils/lunarDate';
import {
  getDashboardTopBarCardBorder,
  getDashboardTopBarCardShadow,
} from '../../pages/system/dashboard/dashboardTopBarTheme';

const { useToken } = theme;

export function useUniDashboardSidebar() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = useToken();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  const currentUser = useGlobalStore((s) => s.currentUser);

  const [currentTime, setCurrentTime] = useState(() => dayjs());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const calendarDayKey = currentTime.format('YYYY-MM-DD');
  const lunarDateStr = useMemo(
    () => formatLunarDate(dayjs(calendarDayKey, 'YYYY-MM-DD')),
    [calendarDayKey],
  );

  const displayTimezone =
    useConfigStore((s) => s.configs?.timezone) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'Asia/Shanghai';

  const { data: platformVersion } = useQuery({
    queryKey: ['platformVersion'],
    queryFn: getPlatformVersion,
    staleTime: 5 * 60 * 1000,
  });

  const buildTimeDisplay = useMemo(
    () => formatTimeInTimezone(platformVersion?.build_time, displayTimezone),
    [platformVersion?.build_time, displayTimezone],
  );

  const copyPlatformCommit = useCallback(() => {
    const raw = (platformVersion?.git_commit || '').trim();
    if (!raw) return;
    void navigator.clipboard.writeText(raw).then(() => {
      message.success(t('pages.dashboard.copyCommitSuccess'));
    });
  }, [platformVersion?.git_commit, message, t]);

  const { data: menuTree, isLoading: menuTreeLoading } = useQuery({
    queryKey: ['navigationMenuTree'],
    queryFn: () => getNavigationMenuTree(),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const quickEntryMenuTree = useMemo(() => menuTree || [], [menuTree]);

  const userPreferenceRaw = useUserPreferenceStore((s) => s.preferences);
  const userPreferenceInitialized = useUserPreferenceStore((s) => s.initialized);
  const userPreferenceLoading = useUserPreferenceStore((s) => s.loading);
  const fetchPreferences = useUserPreferenceStore((s) => s.fetchPreferences);
  const updatePreferences = useUserPreferenceStore((s) => s.updatePreferences);

  useEffect(() => {
    if (!userPreferenceInitialized && !userPreferenceLoading) {
      fetchPreferences();
    }
  }, [userPreferenceInitialized, userPreferenceLoading, fetchPreferences]);

  const userPreference = useMemo<UserPreference | undefined>(
    () => (userPreferenceInitialized ? ({ preferences: userPreferenceRaw } as UserPreference) : undefined),
    [userPreferenceInitialized, userPreferenceRaw],
  );

  const quickEntryLoading = (!userPreferenceInitialized && userPreferenceLoading) || menuTreeLoading;

  const quickEntryItems = useMemo((): QuickEntryItem[] => {
    if (quickEntryLoading) {
      return [];
    }
    const quickEntriesFromPref = userPreference?.preferences?.dashboard_quick_entries as QuickEntryItem[] | undefined;

    if (Array.isArray(quickEntriesFromPref) && quickEntriesFromPref.length > 0) {
      return quickEntriesFromPref
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((entry) => {
          const menu = quickEntryMenuTree.length ? findMenuInTree(quickEntryMenuTree, entry.menu_uuid) : null;
          const resolvedPath = entry.menu_path || menu?.path || '';
          if (!resolvedPath) return null;

          return {
            ...entry,
            menu_name: entry.menu_name || (menu ? getTranslatedMenuTitle(menu, t) : ''),
            menu_path: resolvedPath,
            menu_icon: menu ? renderQuickEntryMenuIcon(menu) : getQuickEntryIconByPath(resolvedPath, entry.menu_name),
          };
        })
        .filter((item) => item !== null) as QuickEntryItem[];
    }

    if (!quickEntryMenuTree.length) {
      return [];
    }

    return buildQuickEntriesFromMenuTree(quickEntryMenuTree, renderQuickEntryMenuIcon, t, 10);
  }, [quickEntryLoading, userPreference, quickEntryMenuTree, t]);

  const quickEntryMenuTreeData = useMemo(() => {
    if (!quickEntryMenuTree.length) return [];
    return convertMenuTreeToTreeData(quickEntryMenuTree, t);
  }, [quickEntryMenuTree, t]);

  const saveQuickEntries = useCallback(
    async (items: QuickEntryItem[]) => {
      const serializableItems = items.map(({ menu_icon, ...rest }) => rest);
      await updatePreferences({ dashboard_quick_entries: serializableItems });
    },
    [updatePreferences],
  );

  const renderQuickEntryIcon = useCallback(
    (menuUuid: string) => {
      if (!quickEntryMenuTree.length) return <ShopOutlined />;
      const menu = findMenuInTree(quickEntryMenuTree, menuUuid);
      return menu ? renderQuickEntryMenuIcon(menu) : <ShopOutlined />;
    },
    [quickEntryMenuTree],
  );

  return {
    t,
    isDark,
    currentTime,
    lunarDateStr,
    cardRadius: token.borderRadiusLG,
    cardShadow: token.boxShadowTertiary,
    cardBorder: getDashboardTopBarCardBorder(isDark),
    calendarCardShadow: getDashboardTopBarCardShadow(isDark),
    quickEntryItems,
    quickEntryLoading,
    quickEntryMenuTreeData,
    saveQuickEntries,
    renderQuickEntryIcon,
    gitCommit: platformVersion?.git_commit,
    buildTimeDisplay,
    copyPlatformCommit,
  };
}
