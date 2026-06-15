/**
 * 顶栏快捷入口：与工作台快捷入口同源（图标、渐变色、默认项逻辑），最多 9 项
 */

import React, { useMemo } from 'react';
import { Popover, theme } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';
import { useThemeStore } from '../../stores/themeStore';
import { useNavigationMenuTreeQuery } from '../../hooks/useNavigationMenuTreeQuery';
import { QuickEntryIcon } from './QuickEntryIcon';
import type { QuickEntryItem } from './QuickEntryGrid';
import { generateQuickEntryGradient } from './quickEntryGradients';
import { resolveQuickEntryDisplayItems } from './quickEntryItems';

const { useToken } = theme;

const HEADER_QUICK_ENTRY_LIMIT = 9;

export interface HeaderQuickEntryPopoverProps {
  isLightModeLightBg?: boolean;
}

export const HeaderQuickEntryPopover: React.FC<HeaderQuickEntryPopoverProps> = ({
  isLightModeLightBg = true,
}) => {
  const { token } = useToken();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isDark = useThemeStore((s) => s.resolved.isDark);
  const themeStyle = useThemeStore((s) => s.resolved.themeStyle);
  const isPlain = themeStyle === 'plain';

  const dashboardQuickEntriesRaw = useUserPreferenceStore(
    (s) => s.preferences?.dashboard_quick_entries as QuickEntryItem[] | undefined,
  );

  const { data: menuTree } = useNavigationMenuTreeQuery();

  const quickEntryItems = useMemo(
    () =>
      resolveQuickEntryDisplayItems(menuTree || [], dashboardQuickEntriesRaw, t, HEADER_QUICK_ENTRY_LIMIT),
    [dashboardQuickEntriesRaw, menuTree, t],
  );

  const popoverContent = (
    <div style={{ width: 280, padding: '4px 0' }}>
      {quickEntryItems.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '16px 8px',
            padding: '8px 4px',
          }}
        >
          {quickEntryItems.map((item, index) => (
            <QuickEntryIcon
              key={item.menu_uuid}
              icon={item.menu_icon}
              title={item.menu_name}
              gradient={
                isPlain
                  ? generateQuickEntryGradient(index, isDark, 'plain')
                  : item.gradient || generateQuickEntryGradient(index, isDark, 'vivid')
              }
              plain={isPlain}
              onClick={() => {
                if (item.menu_path) navigate(item.menu_path);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  const headerIconColor = isLightModeLightBg
    ? 'rgba(0, 0, 0, 0.85)'
    : 'rgba(255, 255, 255, 0.85)';

  const trigger = (
    <span
      role="button"
      tabIndex={0}
      className="riveredge-header-quick-entry-trigger"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: token.borderRadius,
        cursor: 'pointer',
        flexShrink: 0,
        color: headerIconColor,
        fontSize: 18,
        transition: 'background 0.2s ease',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click();
      }}
    >
      <AppstoreOutlined />
    </span>
  );

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0, flexShrink: 0 }}>
      <Popover
        placement="bottomLeft"
        trigger="hover"
        arrow={false}
        content={popoverContent}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <AppstoreOutlined style={{ color: token.colorPrimary }} />
            {t('pages.dashboard.quickEntry')}
          </span>
        }
      >
        {trigger}
      </Popover>
    </span>
  );
};

export default HeaderQuickEntryPopover;
