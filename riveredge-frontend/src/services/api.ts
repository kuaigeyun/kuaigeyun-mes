/**
 * API 基础配置
 * 
 * 定义 API 基础 URL 和通用配置
 */

// 使用 Fetch API 进行 HTTP 请求
import { clearAuth, getToken } from '../utils/auth';
import { updateLastActivity } from '../utils/activityUtils';
import { handleNetworkError, handleServerError } from '../utils/errorRecovery';

/**
 * API 基础 URL
 */
export const API_BASE_URL = '/api/v1';

/**
 * 获取当前选择的组织ID
 *
 * 优先从 localStorage 的 tenant_id 获取，如果没有则尝试从 user_info 中获取
 *
 * @returns 组织ID 或 null
 */
function getCurrentTenantId(): string | null {
  try {
    // 优先从 localStorage 的 tenant_id 获取
    const tenantId = localStorage.getItem('tenant_id');
    // ⚠️ 关键修复：检查 tenantId 是否有效（不为 null、undefined 或空字符串）
    if (tenantId !== null && tenantId !== undefined && tenantId !== '') {
      const trimmedTenantId = tenantId.trim();
      if (trimmedTenantId !== '') {
        return trimmedTenantId;
      }
    }
  } catch (error) {
    console.warn('⚠️ 读取 localStorage tenant_id 失败:', error);
  }
  
  // 如果 localStorage 中没有，尝试从 user_info 中获取
  try {
    const userInfoStr = localStorage.getItem('user_info');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      // 尝试多个可能的字段名：tenant_id, tenantId
      const tenantIdFromUserInfo = userInfo?.tenant_id || userInfo?.tenantId;
      if (tenantIdFromUserInfo !== undefined && tenantIdFromUserInfo !== null) {
        // 如果从 user_info 中获取到，同时保存到 tenant_id，避免下次再查找
        const tenantIdStr = String(tenantIdFromUserInfo).trim();
        if (tenantIdStr !== '') {
          localStorage.setItem('tenant_id', tenantIdStr);
          console.log('✅ 从 user_info 中恢复 tenant_id:', tenantIdStr);
          return tenantIdStr;
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ 解析 user_info 失败:', error);
  }
  
  return null;
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
  // ⚠️ 关键修复：确保 url 是字符串类型
  if (typeof url !== 'string') {
    console.error('❌ apiRequest: url 必须是字符串类型，当前类型:', typeof url, '值:', url);
    throw new Error(`apiRequest: url 必须是字符串类型，当前类型: ${typeof url}`);
  }
  
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

  // 检查是否是公开接口（登录、注册等接口不应该携带 token）
  // ⚠️ 关键修复：使用精确匹配，避免误匹配包含 '/login' 的其他路径（如 '/core/login-logs'）
  const isPublicEndpoint = 
    url === '/auth/login' ||
    url.startsWith('/auth/login?') ||
    url === '/auth/guest-login' ||
    url.startsWith('/auth/guest-login?') ||
    (url === '/login' || url === '/infra/login') ||
    url.startsWith('/login?') ||
    url === '/auth/register' ||
    url.startsWith('/auth/register?') ||
    url === '/register' ||
    url.startsWith('/register?') ||
    url.startsWith('/tenants/search') ||
    url.startsWith('/tenants/check-domain') ||
    url.startsWith('/apps/kuaireport/dashboards/shared') ||
    url.startsWith('/apps/kuaireport/reports/shared');
  
  // ========== 重写：简化 Token 和 Tenant ID 获取逻辑 ==========
  
  // 1. 获取 Token（公开接口不需要）
  const token = !isPublicEndpoint ? getToken() : null;
  
  // 调试日志：检查 Token（已禁用以减少控制台输出）
  // if (!isPublicEndpoint) {
  //   console.log('🔍 apiRequest 调试:', {
  //     url,
  //     hasToken: !!token,
  //     tokenLength: token?.length || 0,
  //     tokenPreview: token ? `${token.substring(0, 20)}...` : 'null',
  //   });
  // }
  
  // 2. 获取 Tenant ID 和用户信息（公开接口不需要）
  let tenantId: string | null = null;
  let isInfraSuperAdmin = false;
  
  if (!isPublicEndpoint) {
    // 优先从 localStorage 获取 tenant_id
    const tenantIdFromStorage = localStorage.getItem('tenant_id');
    if (tenantIdFromStorage && tenantIdFromStorage.trim()) {
      tenantId = tenantIdFromStorage.trim();
    } else {
      // 如果 localStorage 中没有，尝试从 user_info 恢复
      try {
        const userInfoStr = localStorage.getItem('user_info');
        if (userInfoStr) {
          const userInfo = JSON.parse(userInfoStr);
          const tenantIdFromUserInfo = userInfo?.tenant_id || userInfo?.tenantId;
          if (tenantIdFromUserInfo != null) {
            tenantId = String(tenantIdFromUserInfo).trim();
            // 保存到 localStorage，避免下次再查找
            if (tenantId) {
              localStorage.setItem('tenant_id', tenantId);
            }
          }
          // 检查是否是平台超级管理员
          isInfraSuperAdmin = userInfo?.user_type === 'infra_superadmin' || userInfo?.is_infra_admin === true;
        }
      } catch (error) {
        // 忽略解析错误
      }
    }
  }
  
  // 3. 构建请求头
  const headers: Record<string, string> = {};
  
  // Content-Type（FormData 时不设置，让浏览器自动设置）
  const isFormData = options?.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Authorization（公开接口不需要）
  if (token && !isPublicEndpoint) {
    headers['Authorization'] = `Bearer ${token}`;
    // console.log('✅ apiRequest: 添加 Authorization 头');
  }
  
  // X-Tenant-ID（所有非公开接口都需要添加，因为后端所有需要租户上下文的API都需要这个请求头）
  if (!isPublicEndpoint && tenantId) {
    headers['X-Tenant-ID'] = tenantId;
    // console.log('✅ apiRequest: 添加 X-Tenant-ID 头:', tenantId);
  }
  
  // 5. 验证必需信息（需要认证的接口必须有 Token）
  // ⚠️ 移除前端检查，让请求发送到后端，由后端统一处理认证失败
  // 这样可以避免前端和后端认证逻辑不一致的问题
  // if (!isPublicEndpoint && !token) {
  //   console.error('❌ apiRequest: 前端检查 Token 缺失，拒绝请求', {
  //     url,
  //     isPublicEndpoint,
  //   });
  //   return Promise.reject({
  //     response: {
  //       status: 401,
  //       data: { detail: 'Token缺失' },
  //     },
  //     message: 'Token缺失',
  //   });
  // }
  
  // 合并用户自定义的 headers（如果是 FormData，需要删除 Content-Type）
  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      // 如果是 FormData，忽略 Content-Type，让浏览器自动设置
      if (isFormData && key.toLowerCase() === 'content-type') {
        return;
      }
      headers[key] = value;
    });
  }

  // 构建请求配置
  const fetchOptions: RequestInit = {
    method: options?.method || 'GET',
    headers,
  };

  // 处理请求体：如果提供了 data，则序列化为 JSON；否则使用 body
  if (options?.data !== undefined) {
    fetchOptions.body = JSON.stringify(options.data);
  } else if (options?.body !== undefined) {
    if (isFormData) {
      // FormData 直接使用，不序列化
      fetchOptions.body = options.body;
    } else {
      fetchOptions.body = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
    }
  }

  // 合并其他选项（但排除 data、body 和 headers，因为已经处理过了）
  const { data, body, headers: userHeaders, ...otherOptions } = options || {};
  
  // ⚠️ 关键修复：确保 headers 不被覆盖
  // Object.assign 会覆盖 headers，所以我们需要在最后再次设置 headers
  Object.assign(fetchOptions, otherOptions);
  
  // 确保 headers 始终使用我们构建的 headers（包含 X-Tenant-ID）
  fetchOptions.headers = headers;

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
        // ⚠️ 关键修复：区分公开接口和其他接口的错误处理
        // ⚠️ 关键修复：使用精确匹配，避免误匹配包含 '/login' 的其他路径（如 '/core/login-logs'）
        const isPublicEndpoint = 
          url === '/auth/login' ||
          url.startsWith('/auth/login?') ||
          url === '/auth/guest-login' ||
          url.startsWith('/auth/guest-login?') ||
          (url === '/login' || url === '/infra/login') ||
          url.startsWith('/login?') ||
          url === '/auth/register' ||
          url.startsWith('/auth/register?') ||
          url === '/register' ||
          url.startsWith('/register?') ||
          url.startsWith('/tenants/search') ||
          url.startsWith('/tenants/check-domain');
        if (isPublicEndpoint) {
          // 公开接口返回 401，说明认证失败（登录：用户名或密码错误；注册：可能的问题）
          // 尝试从响应中提取错误信息
          const errorMessage = data?.detail || data?.message || (url.includes('/register') ? '注册失败' : '用户名或密码错误');
          const error = new Error(errorMessage) as any;
          error.response = { data, status: response.status };
          throw error;
        } else {
          // 其他接口返回 401，可能是 Token 过期或无效
          // 清除过期的 Token，并跳转到登录页
          console.warn('⚠️ API 返回 401，Token 已过期或无效，清除 Token 并跳转到登录页');
          clearAuth();
          
          // 清除全局状态中的用户信息
          try {
            const { useGlobalStore } = await import('../stores/globalStore');
            const store = useGlobalStore.getState();
            store.setCurrentUser(undefined);
          } catch (e) {
            // 忽略导入错误
          }
          
          // 跳转到登录页（若已在登录页则不重定向，避免 401 导致无限刷新循环）
          const currentPath = window.location.pathname;
          if (currentPath !== '/login' && currentPath !== '/infra/login') {
            if (currentPath.startsWith('/infra')) {
              window.location.href = '/infra/login';
            } else {
              window.location.href = '/login';
            }
          }
          
          const error = new Error('认证已过期，请重新登录') as any;
          error.response = { data, status: response.status };
          throw error;
        }
      }
      
      // 处理 400 错误（可能是组织上下文未设置或其他验证错误）
      if (response.status === 400) {
        const errorDetail =
          data?.detail ||
          data?.message ||
          (data?.success === false && data?.error?.message ? data.error.message : '');
        if (import.meta.env.DEV) {
          console.error('❌ 400 错误详情:', {
            url,
            errorDetail,
            fullResponse: data,
            localStorage_tenant_id: localStorage.getItem('tenant_id'),
            user_info: localStorage.getItem('user_info'),
          });
        }
        
        if (errorDetail.includes('组织上下文未设置') || errorDetail.includes('tenant')) {
          // 尝试再次获取 tenant_id
          const retryTenantId = getCurrentTenantId();
          if (!retryTenantId) {
            const error = new Error('组织上下文未设置，请重新登录') as any;
            error.response = { data, status: response.status };
            throw error;
          }
        }
        
        // 如果是其他 400 错误，直接抛出详细错误信息
        if (errorDetail) {
          const error = new Error(errorDetail) as any;
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
          let errorMessage: string;
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail)) {
            // 如果是数组，提取第一个错误信息
            errorMessage = data.detail[0]?.msg || JSON.stringify(data.detail);
          } else {
            errorMessage = JSON.stringify(data.detail);
          }
          // 对于 404 错误，如果 detail 是 "Not Found"，提供更友好的错误信息
          if (response.status === 404) {
            if (errorMessage === 'Not Found' || errorMessage.includes('Not Found')) {
              errorMessage = `接口不存在: ${url}`;
            }
            // 其他情况直接使用后端返回的错误信息（不进行任何拼接）
          }
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
      // 对于 404 错误，提供更友好的错误信息
      let errorMessage = `HTTP error! status: ${response.status}`;
      if (response.status === 404) {
        errorMessage = `接口不存在: ${url}`;
      }
      const error = new Error(errorMessage) as any;
      error.response = { data, status: response.status };
      throw error;
    }

    // 非公开接口的成功响应计入用户活动（API 请求表示用户正在使用系统）
    if (!isPublicEndpoint && response.ok) {
      updateLastActivity(true);
    }

    // 检查后端响应格式
    if (data && typeof data === 'object') {
      const responseObj = data as any;

      // 如果是列表响应格式 { success: true, data: [...], total: ... }
      // 需要返回整个对象，而不是只返回 data，因为前端需要 total 和 success
      if (responseObj.success === true && 'data' in responseObj && 'total' in responseObj) {
        return responseObj;
      }

      // 如果是成功响应 { success: true, data: ... }（非列表响应）
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

/**
 * API 便捷对象
 * 
 * 提供 get、post、put、delete 等便捷方法，内部调用 apiRequest
 */
export const api = {
  /**
   * GET 请求
   */
  get: <T = any>(url: string, options?: { params?: Record<string, any>; headers?: Record<string, string> }): Promise<T> => {
    return apiRequest<T>(url, { ...options, method: 'GET' });
  },

  /**
   * POST 请求
   */
  post: <T = any>(url: string, data?: any, options?: { params?: Record<string, any>; headers?: Record<string, string> }): Promise<T> => {
    return apiRequest<T>(url, { ...options, method: 'POST', data });
  },

  /**
   * PUT 请求
   */
  put: <T = any>(url: string, data?: any, options?: { params?: Record<string, any>; headers?: Record<string, string> }): Promise<T> => {
    return apiRequest<T>(url, { ...options, method: 'PUT', data });
  },

  /**
   * DELETE 请求
   */
  delete: <T = any>(url: string, options?: { params?: Record<string, any>; headers?: Record<string, string> }): Promise<T> => {
    return apiRequest<T>(url, { ...options, method: 'DELETE' });
  },

  /**
   * PATCH 请求
   */
  patch: <T = any>(url: string, data?: any, options?: { params?: Record<string, any>; headers?: Record<string, string> }): Promise<T> => {
    return apiRequest<T>(url, { ...options, method: 'PATCH', data });
  },
};
