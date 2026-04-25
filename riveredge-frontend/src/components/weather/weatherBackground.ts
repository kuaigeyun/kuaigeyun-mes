import type { WeatherData } from '../../services/weather';

/**
 * 工作台首行天气卡：色彩轻度增强版（晴天更暖，雨天更透）。
 */
export function getWeatherCardGradient(data: WeatherData | null | undefined, isDark?: boolean): string {
  if (!data) {
    return isDark 
      ? 'linear-gradient(165deg, #18181b 0%, #09090b 100%)' 
      : 'linear-gradient(165deg, #f9fafb 0%, #f3f4f6 100%)';
  }
  const desc = (data.description || '').toLowerCase();
  const code = String(data.iconCode || '');

  const has = (re: RegExp) => re.test(desc) || re.test(data.description || '');

  // 深色模式通用底色
  const darkBase = 'linear-gradient(165deg, #18110a 0%, #18181b 100%)';

  // 雷阵雨/暴雨
  if (has(/雷|暴|thunder|storm/i) || ['200', '386', '389', '392', '395'].includes(code)) {
    return isDark
      ? 'linear-gradient(165deg, #1e1b4b 0%, #0c0a09 100%)'
      : 'linear-gradient(165deg, #f1f5f9 0%, #e2e8f0 100%)';
  }
  // 雪
  if (has(/雪|snow|ice/i) || /^(179|182|227|230|323|326|329|332)/.test(code)) {
    return isDark
      ? 'linear-gradient(165deg, #1e293b 0%, #0f172a 100%)'
      : 'linear-gradient(168deg, #ffffff 0%, #f8fafc 100%)';
  }
  // 雨
  if (has(/雨|rain|drizzle|shower/i)) {
    return isDark
      ? 'linear-gradient(168deg, #0c4a6e 0%, #082f49 100%)'
      : 'linear-gradient(168deg, #f0f9ff 0%, #e0f2fe 55%, #d1edff 100%)';
  }
  // 雾/霾/阴/多云
  if (has(/雾|霾|fog|mist|haze|云|阴|cloud|overcast/i) || ['143', '248', '260', '119', '122', '103', '116'].includes(code)) {
    return isDark
      ? 'linear-gradient(165deg, #27272a 0%, #09090b 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #f1f5f9 100%)';
  }
  // 晴
  if (has(/晴|sun|clear|fair/i) || ['100', '113'].includes(code)) {
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


