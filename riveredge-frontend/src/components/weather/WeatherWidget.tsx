/**
 * 天气组件
 *
 * 显示当前天气信息，包括温度、天气状况、写实图标
 * 根据IP自动定位并获取天气
 *
 * @author Luigi Lu
 * @date 2026-01-21
 */

import React, { useState, useEffect } from 'react';
import { Space, Typography, Spin, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getWeatherByIP, type WeatherData } from '../../services/weather';
import { getWeatherIcon } from './weatherIcons';

const { Text } = Typography;

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
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载天气数据
   */
  const loadWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWeatherByIP();
      if (data) {
        setWeather(data);
        onWeatherChange?.(data);
      } else {
        setWeather(null);
        setError('无法获取天气信息');
        onWeatherChange?.(null);
      }
    } catch (err: any) {
      console.error('加载天气失败:', err);
      setWeather(null);
      setError(err.message || '加载天气失败');
      onWeatherChange?.(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWeather();
    
    // 每30分钟自动刷新一次
    const timer = setInterval(() => {
      loadWeather();
    }, 30 * 60 * 1000);
    
    return () => clearInterval(timer);
  }, []);

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
            onClick={loadWeather}
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
            onClick={loadWeather}
          />
        </Tooltip>
      )}
    </Space>
  );
};

export default WeatherWidget;
