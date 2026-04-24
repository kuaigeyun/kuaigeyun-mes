import type { WeatherData } from '../../services/weather';

/**
 * 工作台首行天气卡：灰阶微差（无主题色混入）。
 */
export function getWeatherCardGradient(data: WeatherData | null | undefined): string {
  if (!data) {
    return 'linear-gradient(165deg, #f5f5f4 0%, #ebeae8 100%)';
  }
  const desc = (data.description || '').toLowerCase();
  const code = String(data.iconCode || '');

  const has = (re: RegExp) => re.test(desc) || re.test(data.description || '');

  if (has(/雷|暴|thunder|storm/i) || ['200', '386', '389', '392', '395'].includes(code)) {
    return 'linear-gradient(165deg, #e8e7e5 0%, #dcdbd8 100%)';
  }
  if (has(/雪|snow|ice/i) || /^(179|182|227|230|323|326|329|332)/.test(code)) {
    return 'linear-gradient(168deg, #f7f7f6 0%, #e9e9e7 100%)';
  }
  if (has(/雨|rain|drizzle|shower/i)) {
    return 'linear-gradient(168deg, #eff0f1 0%, #e1e3e5 100%)';
  }
  if (has(/雾|霾|fog|mist|haze/i) || ['143', '248', '260'].includes(code)) {
    return 'linear-gradient(165deg, #f3f3f2 0%, #e5e4e2 100%)';
  }
  if (has(/云|阴|cloud|overcast/i) || ['119', '122', '103', '116'].includes(code)) {
    return 'linear-gradient(165deg, #f5f5f4 0%, #eae9e7 100%)';
  }
  if (has(/晴|sun|clear|fair/i) || ['100', '113'].includes(code)) {
    return 'linear-gradient(168deg, #fdfcfa 0%, #f3efe8 55%, #ebe6df 100%)';
  }

  return 'linear-gradient(165deg, #f5f5f4 0%, #e8e7e5 100%)';
}
