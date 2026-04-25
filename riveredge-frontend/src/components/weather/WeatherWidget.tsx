/**
 * 天气组件
 *
 * 显示当前天气信息，包括温度、天气状况、写实图标
 * 根据IP自动定位并获取天气
 *
 * @author Luigi Lu
 * @date 2026-01-21
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Space, Typography, Spin, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getWeatherByIP, type WeatherData, getCachedWeather, isWeatherCacheExpired } from '../../services/weather';
import { getWeatherIcon } from './weatherIcons';

const { Text } = Typography;
const WEATHER_REFRESH_ONCE_PER_PAGE_KEY = 'RIVEREDGE_WEATHER_REFRESH_ONCE_PER_PAGE';

interface WeatherWidgetProps {
  /** 是否显示刷新按钮 */
  showRefresh?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 天气数据变化时回调（用于外层卡片背景随天气变化） */
  onWeatherChange?: (data: WeatherData | null) => void;
  /** 紧凑布局（窄列、工作台首行） */
  compact?: boolean;
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
  tone = 'dark',
}) => {
  // 1. 优先从本地缓存读取，实现“秒开”
  const cachedWeather = getCachedWeather();
  const [weather, setWeather] = useState<WeatherData | null>(cachedWeather);
  const [loading, setLoading] = useState(!cachedWeather);
  const [error, setError] = useState<string | null>(null);
  const weatherRef = useRef<WeatherData | null>(cachedWeather);

  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);

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
      const data = await getWeatherByIP(force);
      if (data) {
        setWeather(data);
        onWeatherChange?.(data);
      } else if (!hasCurrentWeather) {
        // 只有既没有新数据也没有缓存数据时才报错
        setWeather(null);
        setError('无法获取天气信息');
        onWeatherChange?.(null);
      }
    } catch (err: unknown) {
      if (typeof window !== 'undefined') {
        window.console.error('加载天气失败:', err);
      }
      if (!hasCurrentWeather) {
        setWeather(null);
        setError(err instanceof Error ? err.message : '加载天气失败');
        onWeatherChange?.(null);
      }
    } finally {
      setLoading(false);
    }
  }, [onWeatherChange]);

  useEffect(() => {
    // 延迟执行 initial load，避免 effect 期间的同步 setState 警告
    const timerId = window.setTimeout(() => {
      // 只在“页面刷新后的首次加载”执行自动更新逻辑。
      // SPA 内路由切换回来时不再触发，减少 API 调用。
      const hasCheckedThisPage = window.sessionStorage.getItem(WEATHER_REFRESH_ONCE_PER_PAGE_KEY) === '1';
      if (hasCheckedThisPage) {
        return;
      }
      window.sessionStorage.setItem(WEATHER_REFRESH_ONCE_PER_PAGE_KEY, '1');

      // 进入工作台：先展示本地缓存，仅当缓存超过1小时再异步拉取一次
      if (!weatherRef.current || isWeatherCacheExpired()) {
        loadWeather();
      }
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [loadWeather]);

  const iconBox = 56;
  const tempSize = compact ? 24 : 20;
  const metaSize = compact ? 12 : 13;

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
          加载天气...
        </Text>
      </Space>
    );
  }

  if (error || !weather) {
    return (
      <Space style={style} size={compact ? 'small' : 'middle'}>
        <Text style={{ color: tc.muted, fontSize: compact ? 12 : 14 }}>
          天气信息暂不可用
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
  const WeatherIcon = getWeatherIcon(weather.iconCode, weather.description);

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
      <Space orientation="vertical" size={compact ? 2 : 0}>
        <Space size="small">
          <Text
            style={{
              color: tc.primary,
              fontSize: tempSize,
              fontWeight: 600,
              lineHeight: 1,
              whiteSpace: 'nowrap', // ⚠️ 防止温度符号由于宽度极窄而换行
            }}
          >
            {weather.temperature}°C
          </Text>
          {weather.feelsLike !== undefined && weather.feelsLike !== weather.temperature && (
            <Text
              style={{
                color: tc.muted,
                fontSize: compact ? 11 : 12,
                lineHeight: 1,
              }}
            >
              体感 {weather.feelsLike}°C
            </Text>
          )}
        </Space>
        <Space size="small" wrap>
          <Text
            style={{
              color: tc.meta,
              fontSize: metaSize,
              lineHeight: 1.2,
            }}
          >
            {weather.city}
          </Text>
          <Text
            style={{
              color: tc.muted,
              fontSize: metaSize,
              lineHeight: 1.2,
            }}
          >
            {weather.description}
          </Text>
        </Space>
      </Space>

      {/* 刷新按钮 */}
      {showRefresh && (
        <Tooltip title="刷新天气">
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
