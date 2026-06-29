import React from 'react';
import { DashboardCalendarWeatherClock } from '../../pages/system/dashboard/DashboardCalendarWeatherClock';
import { DashboardUsageTipsCarousel } from '../../pages/system/dashboard/DashboardUsageTipsCarousel';
import { QuickEntryGrid } from '../quick-entry/QuickEntryGrid';
import { useUniDashboardSidebar } from './useUniDashboardSidebar';

export const UNI_DASHBOARD_LAYOUT_GUTTER = 16;

export function UniDashboardSidebar() {
  const {
    t,
    isDark,
    currentTime,
    lunarDateStr,
    cardRadius,
    quickEntryItems,
    quickEntryLoading,
    quickEntryMenuTreeData,
    saveQuickEntries,
    renderQuickEntryIcon,
    gitCommit,
    buildTimeDisplay,
    copyPlatformCommit,
  } = useUniDashboardSidebar();

  return (
    <>
      <DashboardCalendarWeatherClock
        currentTime={currentTime}
        isDark={isDark}
        cardRadius={cardRadius}
        lunarDateStr={lunarDateStr}
        t={t}
      />
      <div
        className="dashboard-right-bottom-section"
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: UNI_DASHBOARD_LAYOUT_GUTTER,
        }}
      >
        <QuickEntryGrid
          title={t('pages.dashboard.quickEntry')}
          items={quickEntryItems}
          loading={quickEntryLoading}
          menuTree={quickEntryMenuTreeData}
          showConfig
          onSave={saveQuickEntries}
          isDark={isDark}
          renderMenuIcon={renderQuickEntryIcon}
        />
        <DashboardUsageTipsCarousel
          t={t}
          cardRadius={cardRadius}
          gitCommit={gitCommit}
          buildTimeDisplay={buildTimeDisplay}
          onCopyCommit={copyPlatformCommit}
        />
      </div>
    </>
  );
}
