/**
 * 语言管理 API 服务
 * 
 * 提供语言管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的语言
 */

import { apiRequest } from './api';

/**
 * 语言信息接口
 */
export interface Language {
  uuid: string;
  code: string;
  name: string;
  native_name?: string;
  translations: Record<string, string>;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * 语言列表查询参数
 */
export interface LanguageListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}

/**
 * 语言列表响应数据
 */
export interface LanguageListResponse {
  items: Language[];
  total: number;
}

/**
 * 创建语言数据
 */
export interface CreateLanguageData {
  code: string;
  name: string;
  native_name?: string;
  translations?: Record<string, string>;
  is_default?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

/**
 * 更新语言数据
 */
export interface UpdateLanguageData {
  name?: string;
  native_name?: string;
  is_default?: boolean;
  is_active?: boolean;
  sort_order?: number;
}

/**
 * 翻译更新请求数据
 */
export interface TranslationUpdateRequest {
  translations: Record<string, string>;
}

/**
 * 翻译获取响应数据
 */
export interface TranslationGetResponse {
  translations: Record<string, string>;
  language_code: string;
  language_name: string;
}

/**
 * 获取语言列表
 * 
 * 自动过滤当前组织的语言。
 * 
 * @param params - 查询参数
 * @returns 语言列表响应数据
 */
export async function getLanguageList(params?: LanguageListParams): Promise<LanguageListResponse> {
  return apiRequest<LanguageListResponse>('/system/languages', {
    params,
  });
}

/**
 * 获取语言详情
 * 
 * 自动验证组织权限：只能获取当前组织的语言。
 * 
 * @param languageUuid - 语言 UUID
 * @returns 语言信息
 */
export async function getLanguageByUuid(languageUuid: string): Promise<Language> {
  return apiRequest<Language>(`/system/languages/${languageUuid}`);
}

/**
 * 创建语言
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 语言创建数据
 * @returns 创建的语言信息
 */
export async function createLanguage(data: CreateLanguageData): Promise<Language> {
  return apiRequest<Language>('/system/languages', {
    method: 'POST',
    data,
  });
}

/**
 * 更新语言
 * 
 * 自动验证组织权限：只能更新当前组织的语言。
 * 
 * @param languageUuid - 语言 UUID
 * @param data - 语言更新数据
 * @returns 更新后的语言信息
 */
export async function updateLanguage(languageUuid: string, data: UpdateLanguageData): Promise<Language> {
  return apiRequest<Language>(`/system/languages/${languageUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除语言
 * 
 * 自动验证组织权限：只能删除当前组织的语言。
 * 默认语言不可删除。
 * 
 * @param languageUuid - 语言 UUID
 */
export async function deleteLanguage(languageUuid: string): Promise<void> {
  return apiRequest<void>(`/system/languages/${languageUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 获取翻译内容
 * 
 * 根据语言代码获取翻译内容。
 * 如果语言不存在，返回默认语言的翻译。
 * 
 * @param code - 语言代码
 * @returns 翻译内容
 */
export async function getTranslations(code: string): Promise<TranslationGetResponse> {
  return apiRequest<TranslationGetResponse>(`/system/languages/code/${code}/translations`);
}

/**
 * 更新翻译内容
 * 
 * @param languageUuid - 语言 UUID
 * @param data - 翻译更新请求数据
 * @returns 更新后的语言信息
 */
export async function updateTranslations(languageUuid: string, data: TranslationUpdateRequest): Promise<Language> {
  return apiRequest<Language>(`/system/languages/${languageUuid}/translations`, {
    method: 'PUT',
    data,
  });
}

