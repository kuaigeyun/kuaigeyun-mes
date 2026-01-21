/**
 * 天气图标映射
 *
 * 根据天气代码返回对应的写实天气图标
 * 使用 React Icons 或自定义 SVG 图标
 *
 * @author Luigi Lu
 * @date 2026-01-21
 */

import React from 'react';

/**
 * 获取天气图标组件
 * 
 * @param iconCode 天气代码（wttr.in 格式）
 * @param description 天气描述（用于备用匹配）
 * @returns React 图标组件
 */
export function getWeatherIcon(iconCode: string, description: string = ''): React.ReactNode {
  // wttr.in 天气代码到图标的映射
  // 使用 emoji 作为写实图标（简单且无需额外资源）
  const iconMap: Record<string, string> = {
    // 晴天
    '100': '☀️',  // 晴
    '113': '☀️',  // 晴间多云
    
    // 多云
    '103': '⛅',  // 部分多云
    '116': '⛅',  // 部分多云
    '119': '☁️',  // 多云
    '122': '☁️',  // 阴
    
    // 雾
    '143': '🌫️',  // 雾
    '248': '🌫️',  // 雾
    '260': '🌫️',  // 冻雾
    
    // 雨
    '176': '🌦️',  // 小雨
    '263': '🌦️',  // 小雨
    '266': '🌦️',  // 小雨
    '293': '🌦️',  // 小雨
    '296': '🌦️',  // 小雨
    '299': '🌧️',  // 中雨
    '302': '🌧️',  // 大雨
    '305': '🌧️',  // 中雨
    '308': '🌧️',  // 大雨
    '353': '🌦️',  // 小雨
    '356': '🌧️',  // 中雨
    '359': '🌧️',  // 大雨
    
    // 雪
    '179': '🌨️',  // 雨夹雪
    '182': '🌨️',  // 雨夹雪
    '185': '🌨️',  // 雨夹雪
    '227': '❄️',  // 吹雪
    '230': '❄️',  // 暴风雪
    '317': '🌨️',  // 雨夹雪
    '320': '🌨️',  // 雨夹雪
    '323': '❄️',  // 小雪
    '326': '❄️',  // 小雪
    '329': '❄️',  // 中雪
    '332': '❄️',  // 大雪
    '335': '❄️',  // 中雪
    '338': '❄️',  // 大雪
    '362': '🌨️',  // 雨夹雪
    '365': '🌨️',  // 雨夹雪
    '368': '❄️',  // 小雪
    '371': '❄️',  // 大雪
    '374': '🌨️',  // 雨夹雪
    
    // 雷暴
    '200': '⛈️',  // 雷暴
    '386': '⛈️',  // 雷暴
    '389': '⛈️',  // 雷暴
    '392': '⛈️',  // 雷暴雪
    '395': '⛈️',  // 雷暴雪
    
    // 其他
    '281': '🌧️',  // 冻雨
    '284': '🌧️',  // 冻雨
    '311': '🌧️',  // 冻雨
    '314': '🌧️',  // 冻雨
    '350': '🌨️',  // 冰雹
    '377': '🌧️',  // 冻雨
    
    // === Open-Meteo WMO 天气代码 ===
    '0': '☀️',   // 晴
    '1': '🌤️',   // 基本晴
    '2': '⛅',   // 部分多云
    '3': '☁️',   // 阴
    '45': '🌫️',  // 雾
    '48': '🌫️',  // 沉积霜雾
    '51': '🌦️',  // 小雨
    '53': '🌦️',  // 中雨
    '55': '🌧️',  // 大雨
    '56': '🌧️',  // 冻小雨
    '57': '🌧️',  // 冻大雨
    '61': '🌦️',  // 小雨
    '63': '🌧️',  // 中雨
    '65': '🌧️',  // 大雨
    '66': '🌧️',  // 冻雨
    '67': '🌧️',  // 冻大雨
    '71': '❄️',   // 小雪
    '73': '❄️',   // 中雪
    '75': '❄️',   // 大雪
    '77': '❄️',   // 雪粒
    '80': '🌦️',  // 小阵雨
    '81': '🌧️',  // 中阵雨
    '82': '🌧️',  // 大阵雨
    '85': '❄️',   // 小阵雪
    '86': '❄️',   // 大阵雪
    '95': '⛈️',   // 雷暴
    '96': '⛈️',   // 雷暴伴冰雹
    '99': '⛈️',   // 雷暴伴大冰雹
  };

  // 优先使用代码匹配
  let icon = iconMap[iconCode];
  
  // 如果代码匹配失败，尝试根据描述匹配
  if (!icon) {
    const desc = description.toLowerCase();
    if (desc.includes('晴') || desc.includes('sunny') || desc.includes('clear')) {
      icon = '☀️';
    } else if (desc.includes('云') || desc.includes('cloud')) {
      if (desc.includes('部分') || desc.includes('partly')) {
        icon = '⛅';
      } else {
        icon = '☁️';
      }
    } else if (desc.includes('雨') || desc.includes('rain')) {
      if (desc.includes('小') || desc.includes('light')) {
        icon = '🌦️';
      } else {
        icon = '🌧️';
      }
    } else if (desc.includes('雪') || desc.includes('snow')) {
      icon = '❄️';
    } else if (desc.includes('雾') || desc.includes('fog') || desc.includes('mist')) {
      icon = '🌫️';
    } else if (desc.includes('雷') || desc.includes('thunder')) {
      icon = '⛈️';
    } else {
      icon = '🌤️'; // 默认图标
    }
  }

  return (
    <span 
      style={{ 
        fontSize: 'inherit', 
        lineHeight: 1,
        display: 'inline-block',
        verticalAlign: 'middle',
        transform: 'translateY(-4px)', // 硬编码补偿：向上偏移2px以修正emoji偏下的问题
        filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
      }}
    >
      {icon}
    </span>
  );
}
