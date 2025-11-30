/**
 * API 类型定义
 * 
 * 定义 API 相关的 TypeScript 类型
 */

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
 * 分页请求参数接口
 */
export interface PageParams {
  page?: number;
  page_size?: number;
}

/**
 * 当前用户接口
 */
export interface CurrentUser {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  is_platform_admin?: boolean;
  is_tenant_admin?: boolean;
  tenant_id?: number;
}

