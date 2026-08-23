import type { WeatherData } from '../../services/weather';

type WeatherSkyKind = 'default' | 'thunder' | 'snow' | 'rain' | 'cloudy' | 'clear';

/** Open-Meteo WMO 代码优先；wttr 三位码作兼容 */
function resolveWeatherSkyKindFromIconCode(iconCode: string | undefined): WeatherSkyKind | null {
  const code = parseInt(String(iconCode ?? ''), 10);
  if (!Number.isFinite(code)) return null;

  if (code === 0 || code === 1 || code === 100 || code === 113) return 'clear';
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'cloudy';
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    [176, 263, 266, 281, 284, 293, 296, 299, 302, 305, 308, 311, 314, 353, 356, 359, 362, 365].includes(code)
  ) {
    return 'rain';
  }
  if (
    (code >= 71 && code <= 77) ||
    code === 85 ||
    code === 86 ||
    [179, 182, 227, 230, 323, 326, 329, 332, 335, 338, 368, 371, 374, 377].includes(code)
  ) {
    return 'snow';
  }
  if (
    (code >= 95 && code <= 99) ||
    [200, 386, 389, 392, 395].includes(code)
  ) {
    return 'thunder';
  }
  if ([103, 116, 119, 122, 143, 248, 260].includes(code)) return 'cloudy';

  return null;
}

function resolveWeatherSkyKind(data: WeatherData | null | undefined): WeatherSkyKind {
  if (!data) return 'default';

  const fromCode = resolveWeatherSkyKindFromIconCode(data.iconCode);
  if (fromCode) return fromCode;

  const desc = (data.description || '').toLowerCase();
  const has = (re: RegExp) => re.test(desc) || re.test(data.description || '');

  if (has(/雷|暴|thunder|storm/i)) return 'thunder';
  if (has(/雪|snow|ice/i)) return 'snow';
  if (has(/雨|rain|drizzle|shower/i)) return 'rain';
  if (has(/晴|sun|clear|fair|基本晴|大部晴朗|mainly clear/i)) return 'clear';
  if (has(/雾|霾|fog|mist|haze|云|阴|overcast|partly cloudy|部分多云|阴/i)) return 'cloudy';

  return 'default';
}

const WEATHER_SKY_GRADIENTS: Record<WeatherSkyKind, { light: string; dark: string }> = {
  default: {
    light: 'linear-gradient(145deg, #dceefb 0%, #eaf4fc 42%, #f4f9fd 100%)',
    dark:
      'linear-gradient(145deg, color-mix(in srgb, var(--ant-color-primary) 18%, transparent) 0%, color-mix(in srgb, var(--ant-color-primary) 6%, var(--ant-color-bg-container)) 100%)',
  },
  clear: {
    light: 'linear-gradient(160deg, #5eb0f5 0%, #7ec0fa 42%, #9ecef5 72%, #b8dcf5 100%)',
    dark: 'linear-gradient(160deg, #0d2137 0%, #1a3a5c 45%, #234a6e 100%)',
  },
  cloudy: {
    light: 'linear-gradient(160deg, #9eb4c4 0%, #b8cad6 42%, #d4e0e8 72%, #e8eef2 100%)',
    dark: 'linear-gradient(160deg, #1e293b 0%, #334155 55%, #475569 100%)',
  },
  rain: {
    light: 'linear-gradient(160deg, #6b8fa3 0%, #8aa9ba 45%, #aec4d2 72%, #c8d8e4 100%)',
    dark: 'linear-gradient(168deg, #0c4a6e 0%, #164e63 55%, #1e3a5f 100%)',
  },
  snow: {
    light: 'linear-gradient(168deg, #b8d4f0 0%, #d4e8f8 45%, #eaf4fc 72%, #f8fbff 100%)',
    dark: 'linear-gradient(165deg, #1e293b 0%, #2d3f54 55%, #3d5166 100%)',
  },
  thunder: {
    light: 'linear-gradient(160deg, #4a5568 0%, #5f6d7e 42%, #7a8796 72%, #95a1ad 100%)',
    dark: 'linear-gradient(165deg, #1e1b4b 0%, #312e81 38%, #1e293b 100%)',
  },
};

/**
 * 日历天气插件顶部：按天气模拟天空渐变。
 */
export function getWeatherSkyGradient(data: WeatherData | null | undefined, isDark?: boolean): string {
  const kind = resolveWeatherSkyKind(data);
  return WEATHER_SKY_GRADIENTS[kind][isDark ? 'dark' : 'light'];
}

/** 顶部天空是否偏亮（浅色天空用深色字，仅雷暴/深色模式用浅色字） */
export function isWeatherSkyLight(data: WeatherData | null | undefined, isDark?: boolean): boolean {
  if (isDark) return false;
  return resolveWeatherSkyKind(data) !== 'thunder';
}

/**
 * 工作台首行天气卡：色彩轻度增强版（晴天更暖，雨天更透）。
 */
export function getWeatherCardGradient(data: WeatherData | null | undefined, isDark?: boolean): string {
  if (!data) {
    return isDark 
      ? 'linear-gradient(165deg, #18181b 0%, #09090b 100%)' 
      : 'linear-gradient(165deg, #f9fafb 0%, #f3f4f6 100%)';
  }
  const kind = resolveWeatherSkyKind(data);

  // 雷阵雨/暴雨
  if (kind === 'thunder') {
    return isDark
      ? 'linear-gradient(165deg, #1e1b4b 0%, #0c0a09 100%)'
      : 'linear-gradient(165deg, #f1f5f9 0%, #e2e8f0 100%)';
  }
  // 雪
  if (kind === 'snow') {
    return isDark
      ? 'linear-gradient(165deg, #1e293b 0%, #0f172a 100%)'
      : 'linear-gradient(168deg, #ffffff 0%, #f8fafc 100%)';
  }
  // 雨
  if (kind === 'rain') {
    return isDark
      ? 'linear-gradient(168deg, #0c4a6e 0%, #082f49 100%)'
      : 'linear-gradient(168deg, #f0f9ff 0%, #e0f2fe 55%, #d1edff 100%)';
  }
  // 雾/霾/阴/多云
  if (kind === 'cloudy') {
    return isDark
      ? 'linear-gradient(165deg, #27272a 0%, #09090b 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #f1f5f9 100%)';
  }
  // 晴
  if (kind === 'clear') {
    return isDark
      ? 'linear-gradient(168deg, #321008 0%, #18181b 100%)'
      : 'linear-gradient(168deg, #fffdf5 0%, #fff9e6 50%, #fef3c7 100%)';
  }

  return isDark 
    ? 'linear-gradient(165deg, #18181b 0%, #09090b 100%)' 
    : 'linear-gradient(165deg, #f9fafb 0%, #f3f4f6 100%)';
}

export function getWeatherAdaptiveTint(data: WeatherData | null | undefined, isDark?: boolean): string {
  if (!data) return 'rgba(0,0,0,0)';
  const desc = (data.description || '').toLowerCase();
  const has = (re: RegExp) => re.test(desc) || re.test(data.description || '');

  if (isDark) {
    if (has(/雷|暴|thunder|storm/i)) return 'rgba(99, 102, 241, 0.08)'; 
    if (has(/雪|snow|ice/i)) return 'rgba(186, 230, 253, 0.08)'; 
    if (has(/雨|rain/i)) return 'rgba(14, 165, 233, 0.08)';     
    if (has(/晴|sun|clear/i)) return 'rgba(251, 191, 36, 0.12)'; 
    return 'rgba(255,255,255,0.02)';
  }

  if (has(/雷|暴|thunder|storm/i)) return 'rgba(71, 85, 105, 0.05)';
  if (has(/雪|snow|ice/i)) return 'rgba(186, 230, 253, 0.04)';
  if (has(/雨|rain/i)) return 'rgba(14, 165, 233, 0.05)';
  if (has(/晴|sun|clear/i)) return 'rgba(252, 211, 77, 0.07)';
  return 'rgba(0,0,0,0)';
}


