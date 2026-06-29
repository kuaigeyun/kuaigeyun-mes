import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, theme } from 'antd';
import { ShopOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  resolveQuickEntryDisplayItems,
  findMenuInTree,
} from '../quick-entry/quickEntryItems';
import { convertMenuTreeToTreeData } from '../quick-entry/convertMenuTreeToTreeData';
import { renderQuickEntryMenuIcon } from '../quick-entry/renderQuickEntryMenuIcon';
import type { QuickEntryItem } from '../quick-entry/QuickEntryGrid';
import { useNavigationMenuTreeQuery } from '../../hooks/useNavigationMenuTreeQuery';
import type { UserPreference } from '../../services/userPreference';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';
import { useThemeStore } from '../../stores/themeStore';
import { useConfigStore } from '../../stores/configStore';
import { getPlatformVersion } from '../../services/platformSettings';
import { formatTimeInTimezone } from '../../utils/formatTimeInTimezone';
import { formatLunarDate } from '../../utils/lunarDate';

const { useToken } = theme;

export function useUniDashboardSidebar() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = useToken();
  const isDark = useThemeStore((s) => s.resolved.isDark);

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

  const { data: menuTree, isLoading: menuTreeLoading } = useNavigationMenuTreeQuery();

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
    return resolveQuickEntryDisplayItems(quickEntryMenuTree, quickEntriesFromPref, t, 10);
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
