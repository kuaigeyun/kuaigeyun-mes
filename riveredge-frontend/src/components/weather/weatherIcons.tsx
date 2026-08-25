/**
 * 天气图标（系统 Emoji 字体，见 decorative/systemEmoji.tsx）
 */

import React from 'react';
import { WeatherEmojiIcon } from '../decorative/systemEmoji';

export interface WeatherIconProps {
  iconCode: string;
  description?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function WeatherIcon({
  iconCode,
  description = '',
  size = 48,
  className,
  style,
}: WeatherIconProps) {
  return (
    <WeatherEmojiIcon
      iconCode={iconCode}
      description={description}
      size={size}
      className={className}
      style={style}
    />
  );
}

export function getWeatherIcon(
  iconCode: string,
  description = '',
  size = 48,
): React.ReactNode {
  return <WeatherIcon iconCode={iconCode} description={description} size={size} />;
}
