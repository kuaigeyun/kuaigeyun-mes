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
 * 优先从 localStorage 的 tenant_id 获取，如果没有则尝试从 user_info 中获取
 *
 * @returns 组织ID 或 null
 */
function getCurrentTenantId(): string | null {
  // 优先从 localStorage 的 tenant_id 获取
  const tenantId = localStorage.getItem('tenant_id');
  if (tenantId) {
    return tenantId;
  }
  
  // 如果 localStorage 中没有，尝试从 user_info 中获取
  try {
    const userInfoStr = localStorage.getItem('user_info');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      // 尝试多个可能的字段名：tenant_id, tenantId
      const tenantIdFromUserInfo = userInfo?.tenant_id || userInfo?.tenantId;
      if (tenantIdFromUserInfo) {
        // 如果从 user_info 中获取到，同时保存到 tenant_id，避免下次再查找
        const tenantIdStr = String(tenantIdFromUserInfo);
        localStorage.setItem('tenant_id', tenantIdStr);
        console.log('✅ 从 user_info 中恢复 tenant_id:', tenantIdStr);
        return tenantIdStr;
      } else {
        console.warn('⚠️ user_info 中未找到 tenant_id 字段:', {
          userInfoKeys: Object.keys(userInfo || {}),
          userInfo: userInfo,
        });
      }
    } else {
      console.warn('⚠️ localStorage 中没有 user_info');
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
  
  // 检查是否是公开接口（登录、注册等接口不应该携带 token）
  const isPublicEndpoint = 
    url.includes('/auth/login') || 
    url.includes('/login') ||
    url.includes('/auth/register') ||
    url.includes('/register') ||
    url.includes('/tenants/search') ||
    url.includes('/tenants/check-domain');
  
  // 检查 Token 是否存在（公开接口除外）
  if (!token && !isPublicEndpoint) {
    console.warn(`⚠️ API 请求 ${url} 没有 Token`);
  }
  
  // 获取当前选择的组织ID
  const currentTenantId = getCurrentTenantId();
  
  // 检查是否是平台超级管理员（从 user_info 中获取）
  let isPlatformSuperAdmin = false;
  try {
    const userInfoStr = localStorage.getItem('user_info');
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      isPlatformSuperAdmin = userInfo?.user_type === 'platform_superadmin' || userInfo?.is_platform_admin === true;
    }
  } catch (error) {
    // 忽略解析错误
  }
  
  // 检查 body 是否是 FormData
  const isFormData = options?.body instanceof FormData;
  
  // 判断是否需要组织上下文（系统级API和个人中心API需要）
  const needsTenantContext = url.startsWith('/system/') || 
    url.startsWith('/api/v1/system/') || 
    url.startsWith('/personal/') || 
    url.startsWith('/api/v1/personal/');
  
  // 如果需要组织上下文但没有 tenant_id，输出警告（平台超级管理员除外，后端会处理默认租户）
  if (needsTenantContext && !currentTenantId && !isPlatformSuperAdmin) {
    console.error('⚠️ 组织上下文未设置:', {
      url,
      tenantId: currentTenantId,
      isPlatformSuperAdmin,
      localStorage_tenant_id: localStorage.getItem('tenant_id'),
      user_info: localStorage.getItem('user_info'),
    });
  }
  
  // 构建请求头（如果是 FormData，需要删除 Content-Type，让浏览器自动设置）
  const headers: Record<string, string> = {};
  
  // 如果是 FormData，不设置 Content-Type，让浏览器自动设置（包含 boundary）
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  
  // 如果存在 Token 且不是公开接口，添加到请求头
  // ⚠️ 关键修复：公开接口（登录、注册等）不应该携带 token，避免过期 token 干扰验证
  if (token && !isPublicEndpoint) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // 如果存在组织ID且需要组织上下文，添加到请求头
  // ⚠️ 关键修复：系统级API和个人中心API需要组织上下文，平台级API不需要
  // ⚠️ 重要：对于系统级API和个人中心API，必须要有组织上下文
  // ⚠️ 平台超级管理员：即使没有 tenant_id，也允许发送请求（后端会使用默认租户）
  if (needsTenantContext) {
    if (currentTenantId) {
      headers['X-Tenant-ID'] = currentTenantId;
      console.log('✅ 添加 X-Tenant-ID 请求头:', currentTenantId, 'URL:', url);
    } else if (isPlatformSuperAdmin) {
      // 平台超级管理员即使没有 tenant_id，也允许发送请求
      // 后端会检测到是平台超级管理员，并使用默认租户
      console.log('ℹ️ 平台超级管理员请求，后端将使用默认租户，URL:', url);
    } else {
      // 非平台超级管理员且没有 tenant_id，输出详细错误信息
      console.error('❌ 组织上下文未设置，无法添加 X-Tenant-ID 请求头:', {
        url,
        currentTenantId,
        isPlatformSuperAdmin,
        localStorage_tenant_id: localStorage.getItem('tenant_id'),
        user_info: localStorage.getItem('user_info'),
        needsTenantContext,
      });
    }
  }
  
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
    // 调试日志：输出请求信息
    if (isFormData) {
      console.log('📤 发送文件上传请求:', {
        url: requestUrl,
        method: fetchOptions.method,
        hasFile: fetchOptions.body instanceof FormData,
        headers: headers,
        tenantId: currentTenantId,
        isPlatformSuperAdmin,
        allHeaders: Object.keys(headers),
        xTenantIdHeader: headers['X-Tenant-ID'],
        fetchOptionsHeaders: fetchOptions.headers,
      });
      
      // 验证 X-Tenant-ID 是否在 fetchOptions 中
      if (fetchOptions.headers && 'X-Tenant-ID' in fetchOptions.headers) {
        console.log('✅ X-Tenant-ID 请求头已添加到 fetchOptions:', fetchOptions.headers['X-Tenant-ID']);
      } else {
        console.error('❌ X-Tenant-ID 请求头未添加到 fetchOptions!', {
          headers: fetchOptions.headers,
          currentTenantId,
          needsTenantContext,
        });
      }
    }
    
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
        const isPublicEndpoint = 
          url.includes('/auth/login') || 
          url.includes('/login') ||
          url.includes('/auth/register') ||
          url.includes('/register') ||
          url.includes('/tenants/search') ||
          url.includes('/tenants/check-domain');
        if (isPublicEndpoint) {
          // 公开接口返回 401，说明认证失败（登录：用户名或密码错误；注册：可能的问题）
          // 尝试从响应中提取错误信息
          const errorMessage = data?.detail || data?.message || (url.includes('/register') ? '注册失败' : '用户名或密码错误');
          const error = new Error(errorMessage) as any;
          error.response = { data, status: response.status };
          throw error;
        } else {
          // 其他接口返回 401，可能是 Token 过期或无效
          // 清除过期的 Token，路由守卫会自动处理重定向到登录页
          console.warn('⚠️ API 返回 401，Token 已过期或无效，清除 Token');
          clearAuth();
          
          // ⚠️ 关键修复：不在这里直接跳转，由路由守卫自动处理重定向，避免页面刷新
          // 路由守卫会在检测到没有 token 时自动重定向到登录页
          
          const error = new Error('认证已过期，请重新登录') as any;
          error.response = { data, status: response.status };
          throw error;
        }
      }
      
      // 处理 400 错误（可能是组织上下文未设置或其他验证错误）
      if (response.status === 400) {
        const errorDetail = data?.detail || data?.message || '';
        console.error('❌ 400 错误详情:', {
          url,
          errorDetail,
          fullResponse: data,
          localStorage_tenant_id: localStorage.getItem('tenant_id'),
          user_info: localStorage.getItem('user_info'),
        });
        
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

