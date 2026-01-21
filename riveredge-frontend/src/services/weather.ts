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
 * 使用免费的IP定位API
 */
export async function getLocationByIP(): Promise<LocationData | null> {
  try {
    // 使用 ip-api.com 免费API（无需API Key，限制：45次/分钟）
    const response = await fetch('http://ip-api.com/json/?lang=zh-CN&fields=status,country,regionName,city,lat,lon');
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        city: data.city || '',
        region: data.regionName || '',
        country: data.country || '',
        lat: data.lat,
        lon: data.lon,
      };
    }
    return null;
  } catch (error) {
    console.error('获取IP定位失败:', error);
    return null;
  }
}

/**
 * 获取天气信息
 * 使用多个免费天气API，优先使用 wttr.in，备用 Open-Meteo
 * 
 * @param city 城市名称或经纬度（格式：lat,lon）
 */
export async function getWeather(city: string): Promise<WeatherData | null> {
  try {
    // 方法1: 尝试使用 wttr.in（更详细的数据）
    try {
      const wttrUrl = `https://wttr.in/${encodeURIComponent(city)}?format=j1&lang=zh`;
      const wttrResponse = await fetch(wttrUrl, {
        headers: {
          'Accept': 'application/json',
        },
        // 设置超时
        signal: AbortSignal.timeout(5000),
      });
      
      if (wttrResponse.ok) {
        const data = await wttrResponse.json();
        
        if (data.current_condition && data.current_condition.length > 0) {
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
    } catch (wttrError) {
      console.warn('wttr.in API 请求失败，尝试备用方案:', wttrError);
    }
    
    // 方法2: 备用方案 - 使用 Open-Meteo（免费，无需API Key）
    // 如果 city 是经纬度格式
    if (city.includes(',')) {
      const [lat, lon] = city.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lon)) {
        try {
          const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
          const meteoResponse = await fetch(meteoUrl, {
            signal: AbortSignal.timeout(5000),
          });
          
          if (meteoResponse.ok) {
            const data = await meteoResponse.json();
            const current = data.current;
            
            if (current) {
              // Open-Meteo 天气代码映射到描述
              const weatherCode = current.weather_code || 0;
              const description = getWeatherDescription(weatherCode);
              
              return {
                city: city, // Open-Meteo 不返回城市名，使用传入的参数
                temperature: Math.round(current.temperature_2m || 0),
                description: description,
                iconCode: weatherCode.toString(),
                humidity: Math.round(current.relative_humidity_2m || 0),
                windSpeed: Math.round((current.wind_speed_10m || 0) * 3.6), // m/s 转 km/h
                feelsLike: Math.round(current.temperature_2m || 0), // Open-Meteo 不提供体感温度
              };
            }
          }
        } catch (meteoError) {
          console.warn('Open-Meteo API 请求失败:', meteoError);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('获取天气信息失败:', error);
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

/**
 * 根据IP自动获取天气
 * 先获取IP定位，再获取天气
 */
export async function getWeatherByIP(): Promise<WeatherData | null> {
  try {
    // 1. 获取IP定位
    const location = await getLocationByIP();
    if (!location || !location.city) {
      console.warn('无法获取IP定位信息');
      return null;
    }
    
    // 2. 优先使用经纬度，如果没有则使用城市名称
    const locationParam = location.lat && location.lon 
      ? `${location.lat},${location.lon}`
      : location.city;
    
    // 3. 获取天气
    const weather = await getWeather(locationParam);
    
    if (weather) {
      // 使用定位获取的城市名称
      weather.city = location.city;
    }
    
    return weather;
  } catch (error) {
    console.error('根据IP获取天气失败:', error);
    return null;
  }
}
