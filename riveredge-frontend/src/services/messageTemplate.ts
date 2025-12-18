/**
 * 消息模板管理服务
 * 
 * 提供消息模板的 CRUD 操作。
 * 注意：所有 API 自动过滤当前组织的消息模板
 */

import { apiRequest } from './api';

export interface MessageTemplate {
  uuid: string;
  tenant_id: number;
  name: string;
  code: string;
  type: 'email' | 'sms' | 'internal' | 'push';
  description?: string;
  subject?: string;
  content: string;
  variables?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplateListParams {
  skip?: number;
  limit?: number;
  type?: string;
  is_active?: boolean;
}

export interface CreateMessageTemplateData {
  name: string;
  code: string;
  type: 'email' | 'sms' | 'internal' | 'push';
  description?: string;
  subject?: string;
  content: string;
  variables?: Record<string, any>;
  is_active?: boolean;
}

export interface UpdateMessageTemplateData {
  name?: string;
  description?: string;
  subject?: string;
  content?: string;
  variables?: Record<string, any>;
  is_active?: boolean;
}

/**
 * 获取消息模板列表
 */
export async function getMessageTemplateList(params?: MessageTemplateListParams): Promise<MessageTemplate[]> {
  return apiRequest<MessageTemplate[]>('/core/message-templates', {
    params,
  });
}

/**
 * 获取消息模板详情
 */
export async function getMessageTemplateByUuid(messageTemplateUuid: string): Promise<MessageTemplate> {
  return apiRequest<MessageTemplate>(`/core/message-templates/${messageTemplateUuid}`);
}

/**
 * 创建消息模板
 */
export async function createMessageTemplate(data: CreateMessageTemplateData): Promise<MessageTemplate> {
  return apiRequest<MessageTemplate>('/core/message-templates', {
    method: 'POST',
    data,
  });
}

/**
 * 更新消息模板
 */
export async function updateMessageTemplate(messageTemplateUuid: string, data: UpdateMessageTemplateData): Promise<MessageTemplate> {
  return apiRequest<MessageTemplate>(`/core/message-templates/${messageTemplateUuid}`, {
    method: 'PUT',
    data,
  });
}

/**
 * 删除消息模板
 */
export async function deleteMessageTemplate(messageTemplateUuid: string): Promise<void> {
  return apiRequest<void>(`/core/message-templates/${messageTemplateUuid}`, {
    method: 'DELETE',
  });
}

