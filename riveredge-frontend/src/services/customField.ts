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
  field_type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'json';
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
  field_type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'json';
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
  field_type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'json';
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
  return apiRequest<CustomFieldListResponse>('/system/custom-fields', {
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
  return apiRequest<CustomField[]>(`/system/custom-fields/by-table/${tableName}`, {
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
  return apiRequest<CustomField>(`/system/custom-fields/${fieldUuid}`);
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
  return apiRequest<CustomField>('/system/custom-fields', {
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
  return apiRequest<CustomField>(`/system/custom-fields/${fieldUuid}`, {
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
  return apiRequest<void>(`/system/custom-fields/${fieldUuid}`, {
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
  return apiRequest<{ success: boolean; count: number }>('/system/custom-fields/values', {
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
  return apiRequest<Record<string, any>>(`/system/custom-fields/values/${recordTable}/${recordId}`);
}

