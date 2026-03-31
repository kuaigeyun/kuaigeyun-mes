import type { WeatherData } from '../../services/weather';

/**
 * 根据天气数据生成卡片背景渐变（用于工作台天气区块）
 */
export function getWeatherCardGradient(data: WeatherData | null | undefined): string {
  if (!data) {
    return 'linear-gradient(145deg, #64748b 0%, #475569 100%)';
  }
  const desc = (data.description || '').toLowerCase();
  const code = String(data.iconCode || '');

  const has = (re: RegExp) => re.test(desc) || re.test(data.description || '');

  if (has(/雷|暴|thunder|storm/i) || ['200', '386', '389', '392', '395'].includes(code)) {
    return 'linear-gradient(145deg, #312e81 0%, #5b21b6 55%, #7c3aed 100%)';
  }
  if (has(/雪|snow|ice/i) || /^(179|182|227|230|323|326|329|332)/.test(code)) {
    return 'linear-gradient(145deg, #1e3a5f 0%, #334155 45%, #475569 100%)';
  }
  if (has(/雨|rain|drizzle|shower/i)) {
    return 'linear-gradient(145deg, #1e293b 0%, #334155 50%, #475569 100%)';
  }
  if (has(/雾|霾|fog|mist|haze/i) || ['143', '248', '260'].includes(code)) {
    return 'linear-gradient(145deg, #57534e 0%, #78716c 100%)';
  }
  if (has(/云|阴|cloud|overcast/i) || ['119', '122', '103', '116'].includes(code)) {
    return 'linear-gradient(145deg, #64748b 0%, #94a3b8 100%)';
  }
  if (has(/晴|sun|clear|fair/i) || ['100', '113'].includes(code)) {
    return 'linear-gradient(145deg, #fbbf24 0%, #f59e0b 55%, #ea580c 100%)';
  }

  return 'linear-gradient(145deg, #0ea5e9 0%, #0284c7 55%, #0369a1 100%)';
}
