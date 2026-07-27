/**
 * 菜单管理：图标 / 来源列徽章（分类标识 → MarkerTag filled）
 */

import React from 'react';
import { SettingOutlined, SyncOutlined } from '@ant-design/icons';
import type { TFunction } from 'i18next';
import { MarkerTag, MARKER_TAG_VARIANT } from '../../../constants/statusBadges';
import { renderMenuIconByKey } from '../../../components/MenuIconPicker';

export function renderMenuIconMarker(icon?: string | null, iconSize = 14): React.ReactNode {
  const key = String(icon ?? '').trim();
  if (!key) return '-';
  return React.createElement(
    MarkerTag,
    { color: 'geekblue', icon: renderMenuIconByKey(key, iconSize) },
    key,
  );
}

export function renderMenuSourceMarker(
  t: TFunction,
  applicationUuid?: string | null,
): React.ReactNode {
  if (applicationUuid) {
    return React.createElement(
      MarkerTag,
      { color: 'processing', icon: React.createElement(SyncOutlined) },
      t('menu.system.appMenu'),
    );
  }
  return React.createElement(
    MarkerTag,
    { color: 'purple', icon: React.createElement(SettingOutlined) },
    t('menu.system.systemMenu'),
  );
}
