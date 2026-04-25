/**
 * 天气服务
 *
 * 提供天气相关的API调用
 * 使用免费的天气API服务
 *
 * @author Luigi Lu
 * @date 2026-01-21
 */

/**
 * 天气数据接口
 */
export interface WeatherData {
  /** 城市名称 */
  city: string;
  /** 当前温度（摄氏度） */
  temperature: number;
  /** 天气描述（如：晴、多云、雨等） */
  description: string;
  /** 天气代码（用于匹配图标） */
  iconCode: string;
  /** 湿度（百分比） */
  humidity?: number;
  /** 风速（km/h） */
  windSpeed?: number;
  /** 体感温度 */
  feelsLike?: number;
}

/**
 * IP定位数据接口
 */
export interface LocationData {
  /** 城市名称 */
  city: string;
  /** 省份/州 */
  region?: string;
  /** 国家 */
  country?: string;
  /** 经纬度 */
  lat?: number;
  lon?: number;
}

/**
 * 获取IP定位信息
 * 通过后端代理调用 ip-api.com，避免 HTTPS 页面的 Mixed Content 问题
 */
export async function getLocationByIP(): Promise<LocationData | null> {
  try {
    const { apiRequest } = await import('./api');
    const data = await apiRequest<{ city?: string; region?: string; country?: string; lat?: number; lon?: number }>(
      '/core/ip-location'
    );
    if (data && (data.city || data.region || data.country)) {
      return {
        city: data.city || '',
        region: data.region || '',
        country: data.country || '',
        lat: data.lat,
        lon: data.lon,
      };
    }
    return null;
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.console.error('获取IP定位失败:', error);
    }
    return null;
  }
}

/**
 * 通过 Open-Meteo 地理编号 API 将城市名解析为经纬度
 */
async function geocodeCity(cityName: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=zh`;
    const res = await window.fetch(url, { signal: (window.AbortSignal as any).timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results;
    if (Array.isArray(results) && results.length > 0) {
      const r = results[0];
      const lat = parseFloat(r.latitude);
      const lon = parseFloat(r.longitude);
      if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    }
  } catch {
    // 静默失败
  }
  return null;
}

/**
 * 通过 Open-Meteo 获取天气（经纬度）
 */
async function getWeatherByCoords(lat: number, lon: number, cityLabel?: string): Promise<WeatherData | null> {
  try {
    const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
    const res = await window.fetch(meteoUrl, { signal: (window.AbortSignal as any).timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.current;
    if (!current) return null;
    const weatherCode = current.weather_code || 0;
    return {
      city: cityLabel ?? `${lat},${lon}`,
      temperature: Math.round(current.temperature_2m ?? 0),
      description: getWeatherDescription(weatherCode),
      iconCode: weatherCode.toString(),
      humidity: Math.round(current.relative_humidity_2m ?? 0),
      windSpeed: Math.round((current.wind_speed_10m ?? 0) * 3.6),
      feelsLike: Math.round(current.temperature_2m ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * 获取天气信息
 * 优先使用 Open-Meteo（国内可访问）；城市名时先地理编号再取天气，避免依赖 wttr.in
 *
 * @param city 城市名称或经纬度（格式：lat,lon）
 */
export async function getWeather(city: string): Promise<WeatherData | null> {
  try {
    // 1. 若有经纬度，直接使用 Open-Meteo
    if (city.includes(',')) {
      const parts = city.split(',');
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lon)) {
        const result = await getWeatherByCoords(lat, lon, city);
        if (result) return result;
      }
    }

    // 2. 城市名：通过 Open-Meteo 地理编号获取经纬度，再取天气
    const coords = await geocodeCity(city);
    if (coords) {
      const result = await getWeatherByCoords(coords.lat, coords.lon, city);
      if (result) return result;
    }

    // 3. 备选：wttr.in（国内可能超时）
    try {
      const wttrUrl = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=zh`;
      const wttrResponse = await window.fetch(wttrUrl, {
        headers: { Accept: 'application/json' },
        signal: (window.AbortSignal as any).timeout(4000),
      });
      if (wttrResponse.ok) {
        const data = await wttrResponse.json();
        if (data.current_condition?.[0]) {
          const current = data.current_condition[0];
          const location = data.nearest_area?.[0] || {};
          const weatherCode = parseInt(current.weatherCode) || 100;
          return {
            city: location.areaName?.[0]?.value || city,
            temperature: parseInt(current.temp_C) || 0,
            description: current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value || '未知',
            iconCode: weatherCode.toString(),
            humidity: parseInt(current.humidity) || 0,
            windSpeed: parseInt(current.windspeedKmph) || 0,
            feelsLike: parseInt(current.FeelsLikeC) || 0,
          };
        }
      }
    } catch {
      // wttr.in 失败静默跳过
    }

    return null;
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.console.error('获取天气信息失败:', error);
    }
    return null;
  }
}

/**
 * 根据 Open-Meteo 天气代码获取天气描述
 */
function getWeatherDescription(code: number): string {
  // Open-Meteo WMO 天气代码
  const codeMap: Record<number, string> = {
    0: '晴',
    1: '基本晴',
    2: '部分多云',
    3: '阴',
    45: '雾',
    48: '沉积霜雾',
    51: '小雨',
    53: '中雨',
    55: '大雨',
    56: '冻小雨',
    57: '冻大雨',
    61: '小雨',
    63: '中雨',
    65: '大雨',
    66: '冻雨',
    67: '冻大雨',
    71: '小雪',
    73: '中雪',
    75: '大雪',
    77: '雪粒',
    80: '小阵雨',
    81: '中阵雨',
    82: '大阵雨',
    85: '小阵雪',
    86: '大阵雪',
    95: '雷暴',
    96: '雷暴伴冰雹',
    99: '雷暴伴大冰雹',
  };
  
  return codeMap[code] || '未知';
}

const WEATHER_CACHE_KEY = 'RIVEREDGE_WEATHER_CACHE';
const WEATHER_CACHE_DURATION = 60 * 60 * 1000; // 缓存1小时

interface WeatherCachePayload {
  data: WeatherData;
  timestamp: number;
}

function readWeatherCache(): WeatherCachePayload | null {
  try {
    if (typeof window === 'undefined') return null;
    const cached = window.localStorage.getItem(WEATHER_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as WeatherCachePayload;
    if (!parsed?.data || typeof parsed.timestamp !== 'number') {
      window.localStorage.removeItem(WEATHER_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 获取本地缓存的天气数据
 */
export function getCachedWeather(): WeatherData | null {
  return readWeatherCache()?.data ?? null;
}

/**
 * 本地天气缓存是否超过有效期
 */
export function isWeatherCacheExpired(maxAge = WEATHER_CACHE_DURATION): boolean {
  const cached = readWeatherCache();
  if (!cached) return true;
  return Date.now() - cached.timestamp > maxAge;
}

/**
 * 根据IP自动获取天气
 * 先获取IP定位，再获取天气
 * 增加本地缓存逻辑，减少拉取频率
 * 
 * @param force 是否强制拉取最新数据（跳过缓存）
 */
export async function getWeatherByIP(force = false): Promise<WeatherData | null> {
  try {
    // 1. 尝试从缓存读取
    if (!force) {
      const cached = readWeatherCache();
      if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_DURATION) {
        return cached.data;
      }
    }

    // 2. 无缓存、已过期或强制刷新，则拉取新数据
    const location = await getLocationByIP();
    if (!location || (!location.city && (location.lat == null || location.lon == null))) {
      return null;
    }
    const locationParam = location.lat != null && location.lon != null
      ? `${location.lat},${location.lon}`
      : location.city;
      
    const weather = await getWeather(locationParam);
    if (weather) {
      weather.city = location.city || location.region || weather.city;
      
      // 3. 存入本地缓存
      const cacheData = {
        data: weather,
        timestamp: Date.now()
      };
      window.localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cacheData));
    }
    return weather;
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.console.error('根据IP获取天气失败:', error);
    }
    return null;
  }
}
