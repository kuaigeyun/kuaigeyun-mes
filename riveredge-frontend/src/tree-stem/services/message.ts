/**
 * 消息发送服务
 * 
 * 提供消息发送和消息记录查询功能。
 * 注意：所有 API 自动过滤当前组织的数据
 */

import { apiRequest } from './api';

export interface SendMessageRequest {
  template_uuid?: string;
  config_uuid?: string;
  type: 'email' | 'sms' | 'internal' | 'push';
  recipient: string;
  subject?: string;
  content: string;
  variables?: Record<string, any>;
}

export interface SendMessageResponse {
  success: boolean;
  message_log_uuid?: string;
  inngest_run_id?: string;
  error?: string;
}

export interface MessageLog {
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

export interface MessageLogListParams {
  skip?: number;
  limit?: number;
  type?: string;
  status?: string;
}

/**
 * 发送消息
 */
export async function sendMessage(data: SendMessageRequest): Promise<SendMessageResponse> {
  return apiRequest<SendMessageResponse>('/system/messages/send', {
    method: 'POST',
    data,
  });
}

/**
 * 获取消息发送记录列表
 */
export async function getMessageLogList(params?: MessageLogListParams): Promise<MessageLog[]> {
  return apiRequest<MessageLog[]>('/system/messages/logs', {
    params,
  });
}

