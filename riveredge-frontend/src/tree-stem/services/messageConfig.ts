/**
 * 消息配置管理服务
 * 
 * 提供消息配置的 CRUD 操作。
 * 注意：所有 API 自动过滤当前组织的消息配置
 */

import { apiRequest } from './api';

export interface MessageConfig {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  type: 'email' | 'sms' | 'internal' | 'push';
  description?: string;
  config: Record<string, any>;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageConfigListParams {
  skip?: number;
  limit?: number;
  type?: string;
  is_active?: boolean;
}

export interface CreateMessageConfigData {
  name: string;
  code: string;
  type: 'email' | 'sms' | 'internal' | 'push';
  description?: string;
  config: Record<string, any>;
  is_active?: boolean;
  is_default?: boolean;
}

export interface UpdateMessageConfigData {
  name?: string;
  description?: string;
  config?: Record<string, any>;
  is_active?: boolean;
  is_default?: boolean;
}

/**
 * 获取消息配置列表
 */
export async function getMessageConfigList(params?: MessageConfigListParams): Promise<MessageConfig[]> {
  return apiRequest<MessageConfig[]>('/system/message-configs', {
    params,
  });
}

/**
 * 获取消息配置详情
 */
export async function getMessageConfigByUuid(messageConfigUuid: string): Promise<MessageConfig> {
  return apiRequest<MessageConfig>(`/system/message-configs/${messageConfigUuid}`);
}

/**
 * 创建消息配置
 */
export async function createMessageConfig(data: CreateMessageConfigData): Promise<MessageConfig> {
  return apiRequest<MessageConfig>('/system/message-configs', {
    method: 'POST',
    data,
  });
}

/**
 * 更新消息配置
 */
export async function updateMessageConfig(messageConfigUuid: string, data: UpdateMessageConfigData): Promise<MessageConfig> {
  return apiRequest<MessageConfig>(`/system/message-configs/${messageConfigUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除消息配置
 */
export async function deleteMessageConfig(messageConfigUuid: string): Promise<void> {
  return apiRequest<void>(`/system/message-configs/${messageConfigUuid}`, {
    method: 'DELETE',
  });
}

