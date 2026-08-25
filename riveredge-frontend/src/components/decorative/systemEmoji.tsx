/**
 * 系统彩色 Emoji 渲染（唯一路径）
 *
 * 使用 Unicode + 本机 emoji 字体栈（Segoe UI Emoji / Apple Color Emoji 等），
 * 不走 Iconify / SVG 图标包，保留各操作系统原生 emoji 观感。
 */

import React from 'react';

export const SYSTEM_EMOJI_FONT_FAMILY =
  '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", emoji';

export const WAVING_HAND_EMOJI = '👋';

export type WeatherEmojiKind =
  | 'sun'
  | 'mostly-sunny'
  | 'partly-cloudy'
  | 'cloud'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'sleet'
  | 'snow'
  | 'thunder';

/** 天气语义 → Unicode emoji（唯一真源） */
export const WEATHER_EMOJI: Record<WeatherEmojiKind, string> = {
  sun: '☀️',
  'mostly-sunny': '🌤️',
  'partly-cloudy': '⛅',
  cloud: '☁️',
  fog: '🌫️',
  drizzle: '🌦️',
  rain: '🌧️',
  sleet: '🌨️',
  snow: '❄️',
  thunder: '⛈️',
};

const CODE_TO_KIND: Record<string, WeatherEmojiKind> = {
  '0': 'sun',
  '1': 'mostly-sunny',
  '2': 'partly-cloudy',
  '3': 'cloud',
  '45': 'fog',
  '48': 'fog',
  '51': 'drizzle',
  '53': 'drizzle',
  '55': 'rain',
  '56': 'rain',
  '57': 'rain',
  '61': 'drizzle',
  '63': 'rain',
  '65': 'rain',
  '66': 'rain',
  '67': 'rain',
  '71': 'snow',
  '73': 'snow',
  '75': 'snow',
  '77': 'snow',
  '80': 'drizzle',
  '81': 'rain',
  '82': 'rain',
  '85': 'snow',
  '86': 'snow',
  '95': 'thunder',
  '96': 'thunder',
  '99': 'thunder',
  '100': 'sun',
  '113': 'sun',
  '103': 'partly-cloudy',
  '116': 'partly-cloudy',
  '119': 'cloud',
  '122': 'cloud',
  '143': 'fog',
  '176': 'drizzle',
  '179': 'sleet',
  '182': 'sleet',
  '185': 'sleet',
  '200': 'thunder',
  '227': 'snow',
  '230': 'snow',
  '248': 'fog',
  '260': 'fog',
  '263': 'drizzle',
  '266': 'drizzle',
  '281': 'rain',
  '284': 'rain',
  '293': 'drizzle',
  '296': 'drizzle',
  '299': 'rain',
  '302': 'rain',
  '305': 'rain',
  '308': 'rain',
  '311': 'rain',
  '314': 'rain',
  '317': 'sleet',
  '320': 'sleet',
  '323': 'snow',
  '326': 'snow',
  '329': 'snow',
  '332': 'snow',
  '335': 'snow',
  '338': 'snow',
  '350': 'sleet',
  '353': 'drizzle',
  '356': 'rain',
  '359': 'rain',
  '362': 'sleet',
  '365': 'sleet',
  '368': 'snow',
  '371': 'snow',
  '374': 'sleet',
  '377': 'rain',
  '386': 'thunder',
  '389': 'thunder',
  '392': 'thunder',
  '395': 'thunder',
};

export function resolveWeatherEmojiKind(iconCode: string, description = ''): WeatherEmojiKind {
  const mapped = CODE_TO_KIND[iconCode];
  if (mapped) return mapped;

  const desc = description.toLowerCase();
  if (desc.includes('晴') || desc.includes('sunny') || desc.includes('clear')) {
    return 'sun';
  }
  if (desc.includes('云') || desc.includes('cloud')) {
    if (desc.includes('部分') || desc.includes('partly')) {
      return 'partly-cloudy';
    }
    return 'cloud';
  }
  if (desc.includes('雨') || desc.includes('rain')) {
    if (desc.includes('小') || desc.includes('light')) {
      return 'drizzle';
    }
    return 'rain';
  }
  if (desc.includes('雪') || desc.includes('snow')) {
    return 'snow';
  }
  if (desc.includes('雾') || desc.includes('fog') || desc.includes('mist')) {
    return 'fog';
  }
  if (desc.includes('雷') || desc.includes('thunder')) {
    return 'thunder';
  }
  return 'mostly-sunny';
}

export function resolveWeatherEmoji(iconCode: string, description = ''): string {
  return WEATHER_EMOJI[resolveWeatherEmojiKind(iconCode, description)];
}

export interface SystemEmojiProps {
  emoji: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /** 天气区略上移，与文字对齐 */
  variant?: 'default' | 'weather';
}

export function SystemEmoji({
  emoji,
  size = 24,
  className,
  style,
  variant = 'default',
}: SystemEmojiProps) {
  return (
    <span
      className={[
        'system-emoji',
        variant === 'weather' ? 'system-emoji--weather' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        fontSize: size,
        ...style,
      }}
      aria-hidden
    >
      {emoji}
    </span>
  );
}

export interface WeatherEmojiIconProps {
  iconCode: string;
  description?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function WeatherEmojiIcon({
  iconCode,
  description = '',
  size = 48,
  className,
  style,
}: WeatherEmojiIconProps) {
  return (
    <SystemEmoji
      emoji={resolveWeatherEmoji(iconCode, description)}
      size={size}
      className={className}
      style={style}
      variant="weather"
    />
  );
}
