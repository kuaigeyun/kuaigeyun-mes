/**
 * API 基础配置
 * 
 * 定义 API 基础 URL 和通用配置
 */

// 使用 Fetch API 进行 HTTP 请求

/**
 * API 基础 URL
 */
export const API_BASE_URL = '/api/v1';

/**
 * 通用 API 响应接口
 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

/**
 * 分页响应接口
 */
export interface PageResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * 通用 API 请求函数
 *
 * @param url - 请求 URL
 * @param options - 请求选项
 * @returns 响应数据
 */
export async function apiRequest<T = any>(
  url: string,
  options?: any
): Promise<T> {
  // 使用相对路径，确保代理生效
  // 相对路径会被 Vite 的 proxy 配置自动代理到后端服务器
  const requestUrl = `${API_BASE_URL}${url}`;

  try {
    const response = await fetch(requestUrl, {
      ...options,
      // 设置默认 headers
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 检查后端响应格式
    if (data && typeof data === 'object') {
      const responseObj = data as any;

      // 如果是成功响应 { success: true, data: ... }
      if (responseObj.success === true && 'data' in responseObj) {
        return responseObj.data;
      }

      // 如果是错误响应 { success: false, error: ... }
      if (responseObj.success === false && 'error' in responseObj) {
        throw new Error(responseObj.error.message || '请求失败');
      }

      // 如果是旧格式 { code: 200, message: ..., data: ... }
      if ('data' in responseObj && 'code' in responseObj) {
        if (responseObj.code === 200) {
          return responseObj.data;
        } else {
          throw new Error(responseObj.message || '请求失败');
        }
      }
    }

    // 直接返回响应（兼容简单数据响应）
    return data;
  } catch (error: any) {
    // 如果是 Fetch API 的错误，重新抛出
    if (error.message?.includes('HTTP error!')) {
      // 尝试从响应体中提取错误信息
      try {
        const responseData = await error.response?.json?.() || error.response;
        if (responseData && typeof responseData === 'object') {
          if (responseData.success === false && responseData.error) {
            throw new Error(responseData.error.message || '请求失败');
          }
          if (responseData.code && responseData.code !== 200) {
            throw new Error(responseData.message || '请求失败');
          }
        }
      } catch (e) {
        // 如果解析失败，保留原始错误
      }
    }

    // 重新抛出原始错误
    throw error;
  }
}

