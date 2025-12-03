/**
 * 用户消息管理服务
 * 
 * 提供用户消息的查询、标记已读等功能。
 * 注意：所有 API 自动获取当前用户的消息。
 */

import { apiRequest } from './api';

export interface UserMessage {
  uuid: string;
  tenant_id: number;
  template_uuid?: string;
  config_uuid?: string;
  type: string;
  recipient: string;
  subject?: string;
  content: string;
  variables?: Record<string, any>;
  status: string;
  inngest_run_id?: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserMessageListResponse {
  items: UserMessage[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserMessageStats {
  total: number;
  unread: number;
  read: number;
  failed: number;
}

export interface MarkReadRequest {
  message_uuids: string[];
}

export interface MarkReadResponse {
  updated_count: number;
}

/**
 * 获取当前用户消息列表
 */
export async function getUserMessages(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  channel?: string;
  unread_only?: boolean;
}): Promise<UserMessageListResponse> {
  return apiRequest<UserMessageListResponse>('/personal/user-messages', {
    params,
  });
}

/**
 * 获取当前用户消息详情
 */
export async function getUserMessage(messageUuid: string): Promise<UserMessage> {
  return apiRequest<UserMessage>(`/personal/user-messages/${messageUuid}`);
}

/**
 * 获取当前用户消息统计
 */
export async function getUserMessageStats(): Promise<UserMessageStats> {
  return apiRequest<UserMessageStats>('/personal/user-messages/stats');
}

/**
 * 标记消息为已读
 */
export async function markMessagesRead(data: MarkReadRequest): Promise<MarkReadResponse> {
  return apiRequest<MarkReadResponse>('/personal/user-messages/mark-read', {
    method: 'POST',
    data,
  });
}

