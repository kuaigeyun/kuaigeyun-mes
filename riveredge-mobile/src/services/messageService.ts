/**
 * 用户消息服务
 * 对接 /api/v1/personal/user-messages
 */

import { apiRequest } from './api';

export interface UserMessage {
  uuid: string;
  type: string;
  recipient: string;
  subject?: string;
  content: string;
  status: string;
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

export interface UserMessageStatsResponse {
  total: number;
  unread: number;
  read: number;
  failed: number;
}

/** 获取消息列表 */
export async function getUserMessages(params?: {
  page?: number;
  page_size?: number;
  unread_only?: boolean;
  status?: string;
  channel?: string;
}): Promise<UserMessageListResponse> {
  return apiRequest<UserMessageListResponse>('/personal/user-messages', {
    method: 'GET',
    params,
  });
}

/** 获取消息统计 */
export async function getUserMessageStats(): Promise<UserMessageStatsResponse> {
  return apiRequest<UserMessageStatsResponse>('/personal/user-messages/stats', {
    method: 'GET',
  });
}

/** 获取消息详情 */
export async function getUserMessage(uuid: string): Promise<UserMessage> {
  return apiRequest<UserMessage>(`/personal/user-messages/${uuid}`, {
    method: 'GET',
  });
}

/** 标记消息已读 */
export async function markMessagesRead(messageUuids: string[]): Promise<{ updated_count: number }> {
  return apiRequest<{ updated_count: number }>('/personal/user-messages/mark-read', {
    method: 'POST',
    data: { message_uuids: messageUuids },
  });
}
