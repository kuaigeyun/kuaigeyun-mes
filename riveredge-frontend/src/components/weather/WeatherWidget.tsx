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
}

/**
 * 天气组件
 */
export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ 
  showRefresh = true,
  style 
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
      } else {
        setError('无法获取天气信息');
      }
    } catch (err: any) {
      console.error('加载天气失败:', err);
      setError(err.message || '加载天气失败');
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

  if (loading) {
    return (
      <Space style={style}>
        <Spin size="small" />
        <Text style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 14 }}>
          加载天气...
        </Text>
      </Space>
    );
  }

  if (error || !weather) {
    return (
      <Space style={style}>
        <Text style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: 14 }}>
          天气信息暂不可用
        </Text>
        {showRefresh && (
          <ReloadOutlined 
            style={{ 
              color: 'rgba(255, 255, 255, 0.85)', 
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
      size="middle" 
      style={style}
    >
      {/* 天气图标 */}
      <div style={{ fontSize: 48, lineHeight: 1 }}>
        {WeatherIcon}
      </div>
      
      {/* 天气信息 */}
      <Space direction="vertical" size={0}>
        <Space size="small">
          <Text 
            style={{ 
              color: '#ffffff', 
              fontSize: 20, 
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {weather.temperature}°C
          </Text>
          {weather.feelsLike !== undefined && weather.feelsLike !== weather.temperature && (
            <Text 
              style={{ 
                color: 'rgba(255, 255, 255, 0.65)', 
                fontSize: 12,
                lineHeight: 1,
              }}
            >
              体感 {weather.feelsLike}°C
            </Text>
          )}
        </Space>
        <Space size="small">
          <Text 
            style={{ 
              color: 'rgba(255, 255, 255, 0.85)', 
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            {weather.city}
          </Text>
          <Text 
            style={{ 
              color: 'rgba(255, 255, 255, 0.65)', 
              fontSize: 13,
              lineHeight: 1,
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
              color: 'rgba(255, 255, 255, 0.65)', 
              cursor: 'pointer',
              fontSize: 14,
            }}
            onClick={loadWeather}
          />
        </Tooltip>
      )}
    </Space>
  );
};

export default WeatherWidget;
