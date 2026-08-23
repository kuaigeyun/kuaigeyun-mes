/**
 * 天气组件
 *
 * 显示当前天气信息，包括温度、天气状况、写实图标
 * 按站点「用户位置」：IP 定位或手工行政区
 *
 * @author Luigi Lu
 * @date 2026-01-21
 */

import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { Space, Typography, Spin, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  getWeatherByIP,
  type WeatherData,
  getCachedWeather,
  isWeatherCacheExpired,
  localizeWeatherData,
  reverseGeocodeLabel,
  resolveWeatherLanguage,
  getSiteWeatherLocationKey,
} from '../../services/weather';
import { useConfigStore } from '../../stores/configStore';
import { getWeatherIcon } from './weatherIcons';

const { Text } = Typography;
const WEATHER_REFRESH_ONCE_PER_PAGE_KEY = 'RIVEREDGE_WEATHER_REFRESH_ONCE_PER_PAGE';
/** Zustand selector 缺省值须稳定引用，禁止 inline []（每次 render 新数组 → 无限重渲染 React #185） */
const EMPTY_REGION_CODES: string[] = [];

interface WeatherWidgetProps {
  /** 是否显示刷新按钮 */
  showRefresh?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 天气数据变化时回调（用于外层卡片背景随天气变化） */
  onWeatherChange?: (data: WeatherData | null) => void;
  /** 紧凑布局（窄列、工作台首行） */
  compact?: boolean;
  /** 侧栏日历等极窄场景：更小图标与字号，与周围文字对齐 */
  mini?: boolean;
  /** 浅色卡上用深色字；深色背景卡用 light（默认） */
  tone?: 'light' | 'dark';
}

/**
 * 天气组件
 */
export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  showRefresh = true,
  style,
  onWeatherChange,
  compact = false,
  mini = false,
  tone = 'dark',
}) => {
  const { t, i18n } = useTranslation();
  const locationMode = useConfigStore((s) => s.getConfig<string>('user_location.mode', 'ip'));
  const locationCodes = useConfigStore((s) =>
    s.getConfig<string[]>('user_location.region_codes', EMPTY_REGION_CODES),
  );
  const locationKey = useMemo(
    () => getSiteWeatherLocationKey(),
    [locationMode, Array.isArray(locationCodes) ? locationCodes.join('/') : '']
  );
  // 1. 优先从本地缓存读取，实现"秒开"
  const cachedWeather = getCachedWeather(i18n.language);
  const [weather, setWeather] = useState<WeatherData | null>(cachedWeather);
  const [loading, setLoading] = useState(!cachedWeather);
  const [error, setError] = useState<string | null>(null);
  const [localizedCity, setLocalizedCity] = useState<string | null>(null);
  const weatherRef = useRef<WeatherData | null>(cachedWeather);

  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);

  useLayoutEffect(() => {
    onWeatherChange?.(weather);
  }, [weather, onWeatherChange]);

  /**
   * 加载天气数据
   * @param force 是否强制刷新
   */
  const loadWeather = useCallback(async (force = false) => {
    const hasCurrentWeather = !!weatherRef.current;
    // 只有在没数据或者是强制刷新时才显示 loading 状态
    if (!hasCurrentWeather || force) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getWeatherByIP(force, i18n.language);
      if (data) {
        setWeather(data);
      } else if (!hasCurrentWeather) {
        // 只有既没有新数据也没有缓存数据时才报错
        setWeather(null);
        setError(t('components.weather.loadFailed'));
      }
    } catch (err: unknown) {
      if (typeof window !== 'undefined') {
        window.console.error('加载天气失败:', err);
      }
      if (!hasCurrentWeather) {
        setWeather(null);
        setError(err instanceof Error ? err.message : t('components.weather.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [onWeatherChange, i18n.language]);

  const displayWeather = useMemo(
    () => (weather ? localizeWeatherData(weather, i18n.language) : null),
    [weather, i18n.language]
  );

  useEffect(() => {
    if (!weather?.lat || !weather?.lon) {
      setLocalizedCity(null);
      return;
    }
    let cancelled = false;
    const lang = resolveWeatherLanguage(i18n.language);
    reverseGeocodeLabel(weather.lat, weather.lon, lang).then((name) => {
      if (!cancelled) setLocalizedCity(name);
    });
    return () => {
      cancelled = true;
    };
  }, [weather?.lat, weather?.lon, i18n.language]);

  useEffect(() => {
    const pageKey = `${WEATHER_REFRESH_ONCE_PER_PAGE_KEY}:${locationKey}`;
    const cached = getCachedWeather(i18n.language);
    if (cached && !isWeatherCacheExpired()) {
      setWeather(cached);
      window.sessionStorage.setItem(pageKey, '1');
      return;
    }
    const hasCheckedThisPage = window.sessionStorage.getItem(pageKey) === '1';
    if (!hasCheckedThisPage || !weatherRef.current) {
      window.sessionStorage.setItem(pageKey, '1');
      loadWeather(true);
    }
  }, [loadWeather, locationKey, i18n.language]);

  const iconBox = mini ? 48 : 56;
  const tempSize = mini ? 16 : compact ? 24 : 20;
  const metaSize = mini ? 11 : compact ? 12 : 13;

  const tc =
    tone === 'light'
      ? {
          primary: '#18181b',
          meta: 'rgba(24, 24, 27, 0.78)',
          muted: 'rgba(24, 24, 27, 0.52)',
        }
      : {
          primary: '#ffffff',
          meta: 'rgba(255, 255, 255, 0.85)',
          muted: 'rgba(255, 255, 255, 0.65)',
        };

  if (loading) {
    return (
      <Space style={style} size={compact ? 'small' : 'middle'}>
        <Spin size="small" />
        <Text style={{ color: tc.meta, fontSize: compact ? 12 : 14 }}>
          {t('components.weather.loading')}
        </Text>
      </Space>
    );
  }

  if (error || !displayWeather) {
    return (
      <Space style={style} size={compact ? 'small' : 'middle'}>
        <Text style={{ color: tc.muted, fontSize: compact ? 12 : 14 }}>
          {t('components.weather.unavailable')}
        </Text>
        {showRefresh && (
          <ReloadOutlined
            style={{
              color: tc.meta,
              cursor: 'pointer',
              fontSize: 14,
            }}
            onClick={() => loadWeather(true)}
          />
        )}
      </Space>
    );
  }

  // 获取天气图标
  const WeatherIcon = getWeatherIcon(displayWeather.iconCode, displayWeather.description);
  const cityLabel = localizedCity ?? displayWeather.city;

  return (
    <Space 
      size={compact ? 'small' : 'middle'}
      style={style}
    >
      {/* 天气图标 */}
      <div style={{ fontSize: iconBox, lineHeight: 1, flexShrink: 0 }}>
        {WeatherIcon}
      </div>
      
      {/* 天气信息 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: mini || compact ? 2 : 4,
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.1 }}>
          <Text
            style={{
              color: tc.primary,
              fontSize: tempSize,
              fontWeight: 600,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              margin: 0,
            }}
          >
            {displayWeather.temperature}°C
          </Text>
          {displayWeather.feelsLike !== undefined &&
            displayWeather.feelsLike !== displayWeather.temperature && (
              <Text
                style={{
                  color: tc.muted,
                  fontSize: mini ? 10 : compact ? 11 : 12,
                  lineHeight: 1.1,
                  margin: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {t('components.weather.feelsLike', { value: displayWeather.feelsLike })}
              </Text>
            )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.1 }}>
          <Text
            ellipsis
            style={{
              color: tc.meta,
              fontSize: metaSize,
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {cityLabel}
          </Text>
          <Text
            ellipsis
            style={{
              color: tc.muted,
              fontSize: metaSize,
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {displayWeather.description}
          </Text>
        </div>
      </div>

      {/* 刷新按钮 */}
      {showRefresh && (
        <Tooltip title={t('components.weather.refresh')}>
          <ReloadOutlined
            style={{
              color: tc.muted,
              cursor: 'pointer',
              fontSize: compact ? 13 : 14,
            }}
            onClick={() => loadWeather(true)}
          />
        </Tooltip>
      )}
    </Space>
  );
};

export default WeatherWidget;
