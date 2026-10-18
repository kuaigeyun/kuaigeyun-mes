/**
 * 租户管理员：manifest 与库内菜单不一致时，右下角通知征求同意后再同步。
 * 「立即同步」实际执行：扫描应用 + 一键同步菜单。不阻断操作；禁止读路径静默写库。
 */

import React, { useEffect, useRef } from 'react';
import { App, Button, Space } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getMenuSyncStatus,
  scanApplications,
  syncAllManifestsAndMenus,
  MENU_SYNC_STATUS_QUERY_KEY,
} from '../../services/application';
import { getBootstrapStatus } from '../../services/tenantInit';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useGlobalStore } from '../../stores';
import { NAVIGATION_MENU_TREE_QUERY_KEY } from '../../hooks/useUnifiedMenuData';

const DISMISS_STORAGE_KEY_PREFIX = 'menu-sync-prompt:dismissed';
const NOTIFICATION_KEY_PREFIX = 'menu-sync-prompt';
/** 抬高于右下角 IterationFloatButton（bottom: 24），避免被盖住 */
const NOTIFICATION_BOTTOM_OFFSET = 88;

function buildDismissStorageKey(tenantId: number, manifestFingerprint: string): string {
  return `${DISMISS_STORAGE_KEY_PREFIX}:${tenantId}:${manifestFingerprint}`;
}

const MenuSyncPrompt: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, notification } = App.useApp();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const tenantId = currentUser?.tenant_id;
  const shownFingerprintRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const { data: bootstrapStatus } = useQuery({
    queryKey: ['tenantBootstrapStatus'],
    queryFn: getBootstrapStatus,
    enabled: tenantId != null,
    staleTime: 60_000,
  });

  const { data: syncStatus } = useQuery({
    queryKey: [...MENU_SYNC_STATUS_QUERY_KEY, tenantId],
    queryFn: getMenuSyncStatus,
    enabled: tenantId != null && !!currentUser && bootstrapStatus?.pending !== true,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (
      tenantId == null
      || bootstrapStatus?.pending
      || !syncStatus?.needs_sync
      || !syncStatus.manifest_fingerprint
    ) {
      return;
    }

    const fingerprint = syncStatus.manifest_fingerprint;
    if (shownFingerprintRef.current === fingerprint) {
      return;
    }

    const dismissKey = buildDismissStorageKey(tenantId, fingerprint);
    // 用 localStorage：同一指纹下「稍后」跨刷新不再烦扰；指纹随发版 manifest 变才会再提示
    if (localStorage.getItem(dismissKey) === '1') {
      shownFingerprintRef.current = fingerprint;
      return;
    }

    shownFingerprintRef.current = fingerprint;
    const notificationKey = `${NOTIFICATION_KEY_PREFIX}-${tenantId}-${fingerprint}`;
    const staleCount = syncStatus.stale_app_count;

    const dismiss = () => {
      localStorage.setItem(dismissKey, '1');
      notification.destroy(notificationKey);
    };

    const openIdle = () => {
      notification.open({
        key: notificationKey,
        title: t('components.menuSyncPrompt.title'),
        description: t('components.menuSyncPrompt.description', { count: staleCount }),
        placement: 'bottomRight',
        bottom: NOTIFICATION_BOTTOM_OFFSET,
        duration: 0,
        icon: <SyncOutlined style={{ color: 'var(--ant-color-primary)' }} />,
        actions: (
          <Space>
            <Button size="small" onClick={dismiss}>
              {t('components.menuSyncPrompt.later')}
            </Button>
            <Button type="primary" size="small" onClick={() => void runSync()}>
              {t('components.menuSyncPrompt.action')}
            </Button>
          </Space>
        ),
        onClose: dismiss,
      });
    };

    const openBusy = () => {
      notification.open({
        key: notificationKey,
        title: t('components.menuSyncPrompt.title'),
        description: t('components.menuSyncPrompt.syncing'),
        placement: 'bottomRight',
        bottom: NOTIFICATION_BOTTOM_OFFSET,
        duration: 0,
        icon: <SyncOutlined spin style={{ color: 'var(--ant-color-primary)' }} />,
        actions: (
          <Button type="primary" size="small" loading disabled>
            {t('components.menuSyncPrompt.action')}
          </Button>
        ),
      });
    };

    const runSync = async () => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      openBusy();
      try {
        await scanApplications();
        const result = await syncAllManifestsAndMenus();
        busyRef.current = false;
        dismiss();
        messageApi.success(
          result.message
          || t('components.menuSyncPrompt.syncSuccess', {
            count: result.menu_count ?? 0,
          }),
        );
        useGlobalStore.getState().incrementApplicationMenuVersion();
        queryClient.invalidateQueries({ queryKey: [NAVIGATION_MENU_TREE_QUERY_KEY] });
        queryClient.invalidateQueries({ queryKey: [...MENU_SYNC_STATUS_QUERY_KEY] });
      } catch (error: unknown) {
        busyRef.current = false;
        const msg = error instanceof Error ? error.message : String(error || '');
        messageApi.error(msg || t('components.menuSyncPrompt.syncFailed'));
        openIdle();
      }
    };

    openIdle();
  }, [
    bootstrapStatus?.pending,
    messageApi,
    notification,
    queryClient,
    syncStatus,
    t,
    tenantId,
  ]);

  return null;
};

export default MenuSyncPrompt;

export function invalidateMenuSyncStatusQuery(queryClient: QueryClient, tenantId?: number | null): void {
  queryClient.invalidateQueries({
    queryKey: tenantId != null ? [...MENU_SYNC_STATUS_QUERY_KEY, tenantId] : MENU_SYNC_STATUS_QUERY_KEY,
  });
}
