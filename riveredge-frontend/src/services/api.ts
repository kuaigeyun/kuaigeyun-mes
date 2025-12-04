/**
 * API 基础配置
 * 
 * 定义 API 基础 URL 和通用配置
 */

// 使用 Fetch API 进行 HTTP 请求
import { clearAuth } from '../utils/auth';
import { handleNetworkError, handleServerError } from '../utils/errorRecovery';

/**
 * API 基础 URL
 */
export const API_BASE_URL = '/api/v1';

/**
 * 获取认证 Token
 * 
 * @returns JWT Token 或 null
 */
function getAuthToken(): string | null {
  const token = localStorage.getItem('token');
  // 调试信息：检查 Token 是否存在
  if (!token) {
    console.warn('⚠️ localStorage 中没有 token，当前 localStorage 内容:', {
      token: localStorage.getItem('token'),
      user_info: localStorage.getItem('user_info'),
      tenant_id: localStorage.getItem('tenant_id'),
    });
  }
  return token;
}

/**
 * 获取当前选择的组织ID
 *
 * @returns 组织ID 或 null
 */
function getCurrentTenantId(): string | null {
  return localStorage.getItem('tenant_id');
}

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
 * @param options.method - HTTP 方法（GET, POST, PUT, DELETE 等）
 * @param options.data - 请求体数据（会自动序列化为 JSON）
 * @param options.body - 请求体（如果提供了 data，则忽略此字段）
 * @param options.headers - 请求头
 * @returns 响应数据
 */
export async function apiRequest<T = any>(
  url: string,
  options?: {
    method?: string;
    data?: any;
    body?: any;
    params?: Record<string, any>; // 查询参数
    headers?: Record<string, string>;
    [key: string]: any;
  }
): Promise<T> {
  // 使用相对路径，确保代理生效
  // 相对路径会被 Vite 的 proxy 配置自动代理到后端服务器
  let requestUrl = `${API_BASE_URL}${url}`;
  
  // 处理查询参数
  if (options?.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      requestUrl += `?${queryString}`;
    }
  }

  // 获取认证 Token
  const token = getAuthToken();
  
  // 检查是否是登录接口（登录接口不应该携带 token）
  const isAuthEndpoint = url.includes('/auth/login') || url.includes('/login');
  
  // 检查 Token 是否存在（登录接口除外）
  if (!token && !isAuthEndpoint) {
    console.warn(`⚠️ API 请求 ${url} 没有 Token`);
  }
  
  // 获取当前选择的组织ID
  const currentTenantId = getCurrentTenantId();
  
  // 构建请求配置
  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 如果存在 Token 且不是登录接口，添加到请求头
      // ⚠️ 关键修复：登录接口不应该携带 token，避免过期 token 干扰登录验证
      ...(token && !isAuthEndpoint ? { 'Authorization': `Bearer ${token}` } : {}),
      // 如果存在组织ID且不是平台级接口，添加到请求头
      // ⚠️ 关键修复：系统级API需要组织上下文，平台级API不需要
      // ⚠️ 重要：对于系统级API，必须要有组织上下文
      ...(currentTenantId && (url.startsWith('/system/') || url.startsWith('/api/v1/system/')) ? { 'X-Tenant-ID': currentTenantId } : {}),
      ...options?.headers,
    },
  };

  // 处理请求体：如果提供了 data，则序列化为 JSON；否则使用 body
  if (options?.data !== undefined) {
    fetchOptions.body = JSON.stringify(options.data);
  } else if (options?.body !== undefined) {
    fetchOptions.body = typeof options.body === 'string' 
      ? options.body 
      : JSON.stringify(options.body);
  }

  // 合并其他选项（但排除 data，因为已经处理过了）
  const { data, body, ...otherOptions } = options || {};
  Object.assign(fetchOptions, otherOptions);

  try {
    const response = await fetch(requestUrl, fetchOptions);

    // 读取响应体（无论成功还是失败都需要读取）
    let data: any;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      // 如果响应体不是 JSON，则使用空对象
      data = null;
    }

    // 检查响应状态
    if (!response.ok) {
      // 处理网络错误
      if (!response.ok && response.status === 0) {
        handleNetworkError(new Error('网络连接失败'));
        const error = new Error('网络连接失败') as any;
        error.response = { data, status: response.status };
        throw error;
      }
      
      // 处理服务器错误
      if (response.status >= 500 && response.status < 600) {
        handleServerError({ response: { status: response.status, data } });
      }
      
      // 处理 401 未授权错误
      if (response.status === 401) {
        // ⚠️ 关键修复：区分登录接口和其他接口的错误处理
        const isAuthEndpoint = url.includes('/auth/login') || url.includes('/login');
        if (isAuthEndpoint) {
          // 登录接口返回 401，说明用户名或密码错误
          // 尝试从响应中提取错误信息
          const errorMessage = data?.detail || data?.message || '用户名或密码错误';
          const error = new Error(errorMessage) as any;
          error.response = { data, status: response.status };
          throw error;
        } else {
          // 其他接口返回 401，可能是 Token 过期或无效
          // 清除过期的 Token 并重定向到登录页
          console.warn('⚠️ API 返回 401，Token 已过期或无效，清除 Token');
          clearAuth();
          
          // 延迟重定向，避免在请求处理过程中重定向
          setTimeout(() => {
            if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/platform')) {
              window.location.href = '/login';
            }
          }, 100);
          
          const error = new Error('认证已过期，请重新登录') as any;
          error.response = { data, status: response.status };
          throw error;
        }
      }
      
      // 尝试从响应体中提取错误信息
      if (data && typeof data === 'object') {
        // 如果是统一错误格式 { success: false, error: ... }
        if (data.success === false && data.error) {
          const errorMessage = data.error.message || data.error.details || '请求失败';
          const error = new Error(errorMessage) as any;
          error.response = { data, status: response.status };
          throw error;
        }
        // 如果是 FastAPI 错误格式 { detail: ... }
        if (data.detail) {
          const errorMessage = typeof data.detail === 'string' 
            ? data.detail 
            : JSON.stringify(data.detail);
          const error = new Error(errorMessage) as any;
          error.response = { data, status: response.status };
          throw error;
        }
        // 如果是旧格式 { code: ..., message: ... }
        if (data.code && data.code !== 200) {
          const error = new Error(data.message || '请求失败') as any;
          error.response = { data, status: response.status };
          throw error;
        }
      }
      // 如果无法提取错误信息，使用默认错误
      const error = new Error(`HTTP error! status: ${response.status}`) as any;
      error.response = { data, status: response.status };
      throw error;
    }

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
    // 如果错误已经有 response 信息（我们在上面已经处理过了），直接抛出
    if (error.response) {
      throw error;
    }
    
    // 如果是网络错误或其他错误，包装后抛出
    const wrappedError = new Error(error.message || '请求失败') as any;
    wrappedError.originalError = error;
    throw wrappedError;
  }
}

