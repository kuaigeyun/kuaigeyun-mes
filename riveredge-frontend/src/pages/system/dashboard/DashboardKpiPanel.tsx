/**
 * 工作台 KPI 面板：单 Card 整合时间筛选 + 1×5 指标行
 */

import React, { useMemo } from 'react';
import { Card, Segmented } from 'antd';
import type { NavigateFunction } from 'react-router-dom';
import type { TFunction } from 'i18next';
import type { StatisticsResponse } from '../../../services/dashboard';
import { DASHBOARD_SECTION_CARD_CLASS } from './dashboardCardSurface';
import DashboardKpiRichCard, {
  formatDashboardMetric,
  formatDashboardRate,
  type DashboardKpiMainSemantic,
} from './DashboardKpiRichCard';

export type DashboardTimeRange =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'last7days'
  | 'last30days';

const TIME_RANGE_OPTIONS: DashboardTimeRange[] = [
  'today',
  'yesterday',
  'thisWeek',
  'thisMonth',
  'last7days',
  'last30days',
];

const TIME_RANGE_I18N: Record<DashboardTimeRange, string> = {
  today: 'pages.dashboard.timeToday',
  yesterday: 'pages.dashboard.timeYesterday',
  thisWeek: 'pages.dashboard.timeThisWeek',
  thisMonth: 'pages.dashboard.timeThisMonth',
  last7days: 'pages.dashboard.timeLast7Days',
  last30days: 'pages.dashboard.timeLast30Days',
};

export interface DashboardKpiPanelProps {
  timeRange: DashboardTimeRange;
  onTimeRangeChange: (value: DashboardTimeRange) => void;
  statistics: StatisticsResponse | undefined;
  isDark: boolean;
  t: TFunction;
  navigate: NavigateFunction;
  cardRadius: number;
  kpiCellHeight?: number;
  layoutGutter: number;
  /** 撑满左侧顶区剩余高度（与右侧日历对齐） */
  fillHeight?: boolean;
}

type KpiItemConfig = {
  titleKey: string;
  subtitleKey: string;
  mainSuffixKey?: string;
  mainSemantic?: DashboardKpiMainSemantic;
  path: string;
  getMainValue: (stats: StatisticsResponse | undefined) => React.ReactNode;
  getMainNumeric: (stats: StatisticsResponse | undefined) => number | null | undefined;
  getRightTop: (stats: StatisticsResponse | undefined, t: TFunction) => { label: string; value: React.ReactNode };
  getRightBottom: (stats: StatisticsResponse | undefined, t: TFunction) => { label: string; value: React.ReactNode };
};

function buildKpiItems(t: TFunction): KpiItemConfig[] {
  return [
    {
      titleKey: 'pages.dashboard.statWorkOrderTotal',
      subtitleKey: 'pages.dashboard.kpiSubWorkOrdersInRange',
      mainSuffixKey: 'pages.dashboard.unitOrder',
      mainSemantic: 'work_order_total',
      path: '/apps/kuaizhizao/production-execution/work-orders',
      getMainValue: (s) => formatDashboardMetric(s?.production?.total),
      getMainNumeric: (s) => s?.production?.total ?? null,
      getRightTop: (s, tr) => ({
        label: tr('pages.dashboard.kpiSideCompleted'),
        value: `${formatDashboardMetric(s?.production?.completed)}${tr('pages.dashboard.unitOrder')}`,
      }),
      getRightBottom: (s, tr) => ({
        label: tr('pages.dashboard.kpiSideInProgress'),
        value: `${formatDashboardMetric(s?.production?.in_progress)}${tr('pages.dashboard.unitOrder')}`,
      }),
    },
    {
      titleKey: 'pages.dashboard.statWorkOrderInProgress',
      subtitleKey: 'pages.dashboard.kpiSubWorkOrdersExecuting',
      mainSuffixKey: 'pages.dashboard.unitOrder',
      mainSemantic: 'work_order_wip',
      path: '/apps/kuaizhizao/production-execution/work-orders?status=in_progress',
      getMainValue: (s) => formatDashboardMetric(s?.production?.in_progress),
      getMainNumeric: (s) => s?.production?.in_progress ?? null,
      getRightTop: (s, tr) => ({
        label: tr('pages.dashboard.kpiSideCompleted'),
        value: `${formatDashboardMetric(s?.production?.completed)}${tr('pages.dashboard.unitOrder')}`,
      }),
      getRightBottom: (s, tr) => ({
        label: tr('pages.dashboard.statWorkOrderCompletion'),
        value: `${formatDashboardRate(s?.production?.completion_rate)}%`,
      }),
    },
    {
      titleKey: 'pages.dashboard.statWorkOrderCompletion',
      subtitleKey: 'pages.dashboard.kpiSubCompletionByOrders',
      mainSemantic: 'completion_rate',
      path: '/apps/kuaizhizao/production-execution/work-orders?status=completed',
      getMainValue: (s) => formatDashboardRate(s?.production?.completion_rate),
      getMainNumeric: (s) => s?.production?.completion_rate ?? null,
      getRightTop: (s, tr) => ({
        label: tr('pages.dashboard.kpiSideCompletedOrders'),
        value: `${formatDashboardMetric(s?.production?.completed)}${tr('pages.dashboard.unitOrder')}`,
      }),
      getRightBottom: (s, tr) => ({
        label: tr('pages.dashboard.kpiSideTotalOrders'),
        value: `${formatDashboardMetric(s?.production?.total)}${tr('pages.dashboard.unitOrder')}`,
      }),
    },
    {
      titleKey: 'pages.dashboard.statCompletedQuantity',
      subtitleKey: 'pages.dashboard.kpiSubOutputInRange',
      mainSuffixKey: 'pages.dashboard.unitPiece',
      mainSemantic: 'output_quantity',
      path: '/apps/kuaizhizao/production-execution/work-orders',
      getMainValue: (s) => formatDashboardMetric(s?.production?.completed_quantity),
      getMainNumeric: (s) => s?.production?.completed_quantity ?? null,
      getRightTop: (s, tr) => ({
        label: tr('pages.dashboard.statCapacityRate'),
        value: `${formatDashboardRate(s?.production?.capacity_achievement_rate)}%`,
      }),
      getRightBottom: (s, tr) => ({
        label: tr('pages.dashboard.kpiSideClosedWorkOrders'),
        value: `${formatDashboardMetric(s?.production?.completed)}${tr('pages.dashboard.unitOrder')}`,
      }),
    },
    {
      titleKey: 'pages.dashboard.statQualitySummary',
      subtitleKey: 'pages.dashboard.kpiSubQualityInRange',
      mainSemantic: 'quality_rate',
      path: '/apps/kuaizhizao/quality-management',
      getMainValue: (s) => formatDashboardRate(s?.quality?.quality_rate),
      getMainNumeric: (s) => s?.quality?.quality_rate ?? null,
      getRightTop: (s, tr) => ({
        label: tr('pages.dashboard.statQualityOpenSuffix'),
        value: formatDashboardMetric(s?.quality?.open_exceptions),
      }),
      getRightBottom: (s, tr) => ({
        label: tr('pages.dashboard.kpiSideTotalExceptions'),
        value: formatDashboardMetric(s?.quality?.total_exceptions),
      }),
    },
  ];
}

/** KPI 面板高度：左侧顶区总高 − 欢迎行 − 间距 */
export function getDashboardKpiPanelHeight(
  calendarWidgetHeight: number,
  welcomeLineHeight: number,
  layoutGutter: number,
): number {
  return calendarWidgetHeight - welcomeLineHeight - layoutGutter;
}

export default function DashboardKpiPanel({
  timeRange,
  onTimeRangeChange,
  statistics,
  isDark,
  t,
  navigate,
  cardRadius,
  kpiCellHeight = 132,
  layoutGutter,
  fillHeight = false,
}: DashboardKpiPanelProps) {
  const kpiItems = useMemo(() => buildKpiItems(t), [t]);

  const segmentedOptions = TIME_RANGE_OPTIONS.map((key) => ({
    label: t(TIME_RANGE_I18N[key]),
    value: key,
  }));

  return (
    <Card
      variant="borderless"
      className={[
        'dashboard-kpi-panel',
        DASHBOARD_SECTION_CARD_CLASS,
        fillHeight ? 'dashboard-kpi-panel--fill' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        borderRadius: cardRadius,
        flexShrink: fillHeight ? undefined : 0,
        flex: fillHeight ? '1 1 0' : undefined,
        minHeight: fillHeight ? 0 : undefined,
        ...(fillHeight
          ? {}
          : { ['--dashboard-kpi-cell-height' as string]: `${kpiCellHeight}px` }),
      }}
      styles={{
        body: {
          padding: '12px 16px 16px',
          ...(fillHeight
            ? {
                flex: '1 1 0',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }
            : {}),
        },
      }}
    >
      <div className="dashboard-kpi-panel-toolbar" style={{ marginBottom: layoutGutter }}>
        <Segmented
          className="dashboard-kpi-panel-segmented"
          value={timeRange}
          options={segmentedOptions}
          onChange={(value) => onTimeRangeChange(value as DashboardTimeRange)}
          size="small"
        />
      </div>
      <div className="dashboard-kpi-panel-grid">
        {kpiItems.map((item) => (
          <DashboardKpiRichCard
            key={item.path + item.titleKey}
            embedded
            title={t(item.titleKey)}
            mainValue={item.getMainValue(statistics)}
            mainSuffix={item.mainSuffixKey ? t(item.mainSuffixKey) : '%'}
            subtitle={t(item.subtitleKey)}
            rightTop={item.getRightTop(statistics, t)}
            rightBottom={item.getRightBottom(statistics, t)}
            isDark={isDark}
            mainSemantic={item.mainSemantic}
            mainNumeric={item.getMainNumeric(statistics)}
            onClick={() => navigate(item.path)}
          />
        ))}
      </div>
    </Card>
  );
}
