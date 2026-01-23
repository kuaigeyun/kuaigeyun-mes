/**
 * 自定义字段 API 服务
 * 
 * 提供自定义字段管理相关的 API 接口
 * 注意：所有 API 自动过滤当前组织的自定义字段
 */

import { apiRequest } from './api';

/**
 * 自定义字段信息接口
 */
export interface CustomField {
  uuid: string;
  name: string;
  code: string;
  table_name: string;
  field_type: 'text' | 'number' | 'date' | 'time' | 'datetime' | 'select' | 'multiselect' | 'textarea' | 'image' | 'file' | 'associated_object' | 'formula' | 'json';
  config?: Record<string, any>;
  label?: string;
  placeholder?: string;
  is_required: boolean;
  is_searchable: boolean;
  is_sortable: boolean;
  sort_order: number;
  is_active: boolean;
  tenant_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * 自定义字段列表查询参数
 */
export interface CustomFieldListParams {
  page?: number;
  page_size?: number;
  table_name?: string;
  is_active?: boolean;
}

/**
 * 自定义字段列表响应数据
 */
export interface CustomFieldListResponse {
  items: CustomField[];
  total: number;
}

/**
 * 创建自定义字段数据
 */
export interface CreateCustomFieldData {
  name: string;
  code: string;
  table_name: string;
  field_type: 'text' | 'number' | 'date' | 'time' | 'datetime' | 'select' | 'multiselect' | 'textarea' | 'image' | 'file' | 'associated_object' | 'formula' | 'json';
  config?: Record<string, any>;
  label?: string;
  placeholder?: string;
  is_required?: boolean;
  is_searchable?: boolean;
  is_sortable?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * 更新自定义字段数据
 */
export interface UpdateCustomFieldData {
  name?: string;
  field_type?: 'text' | 'number' | 'date' | 'time' | 'datetime' | 'select' | 'multiselect' | 'textarea' | 'image' | 'file' | 'associated_object' | 'formula' | 'json';
  config?: Record<string, any>;
  label?: string;
  placeholder?: string;
  is_required?: boolean;
  is_searchable?: boolean;
  is_sortable?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

/**
 * 自定义字段值请求数据
 */
export interface CustomFieldValueRequest {
  field_uuid: string;
  value: any;
}

/**
 * 批量设置字段值请求数据
 */
export interface BatchSetFieldValuesRequest {
  record_id: number;
  record_table: string;
  values: CustomFieldValueRequest[];
}

/**
 * 获取自定义字段列表
 * 
 * 自动过滤当前组织的自定义字段。
 * 
 * @param params - 查询参数
 * @returns 自定义字段列表响应数据
 */
export async function getCustomFieldList(params?: CustomFieldListParams): Promise<CustomFieldListResponse> {
  return apiRequest<CustomFieldListResponse>('/core/custom-fields', {
    params,
  });
}

/**
 * 获取指定表的所有自定义字段
 * 
 * @param tableName - 表名
 * @param isActive - 是否只获取启用的字段（可选）
 * @returns 自定义字段列表
 */
export async function getCustomFieldsByTable(tableName: string, isActive?: boolean): Promise<CustomField[]> {
  const params: any = {};
  if (isActive !== undefined) {
    params.is_active = isActive;
  }
  return apiRequest<CustomField[]>(`/core/custom-fields/by-table/${tableName}`, {
    params,
  });
}

/**
 * 获取自定义字段详情
 * 
 * 自动验证组织权限：只能获取当前组织的自定义字段。
 * 
 * @param fieldUuid - 自定义字段 UUID
 * @returns 自定义字段信息
 */
export async function getCustomFieldByUuid(fieldUuid: string): Promise<CustomField> {
  return apiRequest<CustomField>(`/core/custom-fields/${fieldUuid}`);
}

/**
 * 创建自定义字段
 * 
 * 自动设置当前组织的 tenant_id。
 * 
 * @param data - 自定义字段创建数据
 * @returns 创建的自定义字段信息
 */
export async function createCustomField(data: CreateCustomFieldData): Promise<CustomField> {
  return apiRequest<CustomField>('/core/custom-fields', {
    method: 'POST',
    data,
  });
}

/**
 * 更新自定义字段
 * 
 * 自动验证组织权限：只能更新当前组织的自定义字段。
 * 
 * @param fieldUuid - 自定义字段 UUID
 * @param data - 自定义字段更新数据
 * @returns 更新后的自定义字段信息
 */
export async function updateCustomField(fieldUuid: string, data: UpdateCustomFieldData): Promise<CustomField> {
  return apiRequest<CustomField>(`/core/custom-fields/${fieldUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除自定义字段
 * 
 * 自动验证组织权限：只能删除当前组织的自定义字段。
 * 
 * @param fieldUuid - 自定义字段 UUID
 */
export async function deleteCustomField(fieldUuid: string): Promise<void> {
  return apiRequest<void>(`/core/custom-fields/${fieldUuid}`, {
    method: 'DELETE',
  });
}

/**
 * 批量设置字段值
 * 
 * @param data - 批量设置字段值请求数据
 * @returns 设置结果
 */
export async function batchSetFieldValues(data: BatchSetFieldValuesRequest): Promise<{ success: boolean; count: number }> {
  return apiRequest<{ success: boolean; count: number }>('/core/custom-fields/values', {
    method: 'POST',
    data,
  });
}

/**
 * 获取记录的所有自定义字段值
 * 
 * @param recordTable - 关联表名
 * @param recordId - 关联记录ID
 * @returns 字段值字典（key 为字段代码，value 为字段值）
 */
export async function getFieldValues(recordTable: string, recordId: number): Promise<Record<string, any>> {
  return apiRequest<Record<string, any>>(`/core/custom-fields/values/${recordTable}/${recordId}`);
}

/**
 * 自定义字段页面配置接口
 */
export interface CustomFieldPageConfig {
  page_code: string;
  page_name: string;
  page_path: string;
  table_name: string;
  table_name_label: string;
  module: string;
  module_icon?: string;
}

/**
 * 获取自定义字段功能页面配置列表
 * 
 * 返回系统中所有支持自定义字段的功能页面配置。
 * 
 * @returns 功能页面配置列表（已转换为camelCase格式）
 */
export async function getCustomFieldPages(): Promise<CustomFieldPageConfig[]> {
  try {
    console.log('📡 请求自定义字段页面配置 API: /core/custom-fields/pages');
    const pages = await apiRequest<CustomFieldPageConfig[]>('/core/custom-fields/pages');
    console.log(`📋 API 返回 ${pages.length} 个页面配置`);
    
    // 转换字段名从 snake_case 到 camelCase
    const convertedPages = pages.map(page => ({
      pageCode: page.page_code,
      pageName: page.page_name,
      pagePath: page.page_path,
      tableName: page.table_name,
      tableNameLabel: page.table_name_label,
      module: page.module,
      moduleIcon: page.module_icon,
    }));
    
    console.log('✅ 转换后的页面配置:', convertedPages.map(p => p.pageCode));
    return convertedPages;
  } catch (error: any) {
    console.error('❌ 获取自定义字段页面配置失败:', error);
    throw error;
  }
}

