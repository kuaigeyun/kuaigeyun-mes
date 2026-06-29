/**
 * 工作台右侧：日历 + 天气 + 数字时钟（白底紧凑布局）
 */

import React, { useMemo, useState } from 'react';
import { Button, Card, Typography, theme } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { type Dayjs } from 'dayjs';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import WeatherWidget from '../../../components/weather/WeatherWidget';
import type { WeatherData } from '../../../services/weather';
import { DASHBOARD_SECTION_CARD_CLASS } from './dashboardCardSurface';

const { Text } = Typography;

/** 右侧栏日历组件固定高度（与 layout 对齐计算共用） */
export const DASHBOARD_CALENDAR_WIDGET_HEIGHT = 300;

const WEEKDAY_KEYS = [
  'pages.dashboard.calendarWeekSun',
  'pages.dashboard.calendarWeekMon',
  'pages.dashboard.calendarWeekTue',
  'pages.dashboard.calendarWeekWed',
  'pages.dashboard.calendarWeekThu',
  'pages.dashboard.calendarWeekFri',
  'pages.dashboard.calendarWeekSat',
] as const;

function buildCalendarDays(month: Dayjs): { date: Dayjs; inMonth: boolean }[] {
  const startOfMonth = month.startOf('month');
  const daysInMonth = month.daysInMonth();
  const startPad = startOfMonth.day();
  const cells: { date: Dayjs; inMonth: boolean }[] = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({
      date: startOfMonth.subtract(startPad - i, 'day'),
      inMonth: false,
    });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ date: month.date(d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: last.add(1, 'day'), inMonth: false });
  }
  return cells;
}

export interface DashboardCalendarWeatherClockProps {
  currentTime: Dayjs;
  isDark: boolean;
  cardRadius: number | string;
  lunarDateStr: string;
  t: TFunction;
  onWeatherChange?: (data: WeatherData | null) => void;
}

export function DashboardCalendarWeatherClock({
  currentTime,
  isDark,
  cardRadius,
  lunarDateStr,
  t,
  onWeatherChange,
}: DashboardCalendarWeatherClockProps) {
  const { i18n } = useTranslation();
  const { token } = theme.useToken();
  const [viewMonth, setViewMonth] = useState(() => currentTime.startOf('month'));

  const todayKey = currentTime.format('YYYY-MM-DD');
  const cells = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);
  const weekdayLabels = useMemo(() => WEEKDAY_KEYS.map((key) => t(key)), [t]);

  const timeText = currentTime.format('HH:mm:ss');
  const weekdayText = currentTime.format('dddd');

  return (
    <Card
      variant="borderless"
      className={`dashboard-cwc-card ${DASHBOARD_SECTION_CARD_CLASS}`}
      style={{
        flexShrink: 0,
        width: '100%',
        height: DASHBOARD_CALENDAR_WIDGET_HEIGHT,
        minHeight: DASHBOARD_CALENDAR_WIDGET_HEIGHT,
        maxHeight: DASHBOARD_CALENDAR_WIDGET_HEIGHT,
        borderRadius: cardRadius,
        overflow: 'hidden',
      }}
      styles={{
        body: {
          padding: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          minHeight: 0,
          background: 'transparent',
          borderRadius: cardRadius,
        },
      }}
    >
      <div className={`dashboard-cwc-top${isDark ? ' dashboard-cwc-top--dark' : ''}`}>
        <div className="dashboard-cwc-header">
          <div className="dashboard-cwc-header-left">
            <div className="dashboard-cwc-date-meta">
              <Text className="dashboard-cwc-day-name">{weekdayText}</Text>
              <span className="dashboard-cwc-clock">{timeText}</span>
            </div>
            <div className="dashboard-cwc-month-nav">
              <Button
                type="text"
                size="small"
                icon={<LeftOutlined />}
                aria-label={t('pages.dashboard.calendarPrevMonth')}
                onClick={() => setViewMonth((m) => m.subtract(1, 'month'))}
                style={{ color: token.colorPrimary, minWidth: 20, width: 20, height: 20, padding: 0, fontSize: 11 }}
              />
              <span className="dashboard-cwc-month-label-wrap">
                <Text className="dashboard-cwc-month-label">
                  <span className="dashboard-cwc-month-year">{viewMonth.format('YYYY')}</span>
                  <span className="dashboard-cwc-month-sep">.</span>
                  <span className="dashboard-cwc-month-num">{viewMonth.format('MM')}</span>
                </Text>
              </span>
              <Button
                type="text"
                size="small"
                icon={<RightOutlined />}
                aria-label={t('pages.dashboard.calendarNextMonth')}
                onClick={() => setViewMonth((m) => m.add(1, 'month'))}
                style={{ color: token.colorPrimary, minWidth: 20, width: 20, height: 20, padding: 0, fontSize: 11 }}
              />
            </div>
          </div>
          <div className="dashboard-cwc-weather">
            <WeatherWidget
              tone={isDark ? 'dark' : 'light'}
              onWeatherChange={onWeatherChange}
              compact
              mini
              showRefresh={false}
            />
          </div>
        </div>

        <svg
          className="dashboard-cwc-wave"
          viewBox="0 0 400 10"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,10 L0,4 C50,10 100,0 150,4 S250,10 300,4 S350,0 400,4 L400,10 Z" />
        </svg>
      </div>

      <div className="dashboard-cwc-calendar">
      <div className="dashboard-cwc-weekdays">
        {weekdayLabels.map((label) => (
          <span key={label} className="dashboard-cwc-weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="dashboard-cwc-grid">
        {cells.map(({ date, inMonth }) => {
          const key = date.format('YYYY-MM-DD');
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={[
                'dashboard-cwc-cell',
                !inMonth ? 'dashboard-cwc-cell--outside' : '',
                isToday ? 'dashboard-cwc-cell--today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                isToday
                  ? undefined
                  : {
                      color: inMonth ? token.colorText : token.colorTextQuaternary,
                    }
              }
            >
              {date.date()}
            </div>
          );
        })}
      </div>

      <Text ellipsis className="dashboard-cwc-lunar">
        {i18n.language?.startsWith('zh')
          ? `${t('pages.dashboard.lunarLabel')} ${lunarDateStr}`
          : null}
      </Text>
      </div>
    </Card>
  );
}
