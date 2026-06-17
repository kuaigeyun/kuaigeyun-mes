/**
 * KU-AI 对话服务
 *
 * 通过后端代理调用 DeepSeek，API Key 由站点设置统一管理。
 */

import { DeepSeekChatProvider } from '@ant-design/x-sdk';
import { apiRequest, API_BASE_URL } from '../../../services/api';
import { getToken } from '../../../utils/auth';
import i18n from '../../../config/i18n';

const DEEPSEEK_STATUS_URL = '/core/site-settings/integrations/deepseek/status';
const DEEPSEEK_COMPLETIONS_PATH = '/core/site-settings/integrations/deepseek/completions';

export const KUAI_CHAT_COMPLETIONS_URL = `${API_BASE_URL}${DEEPSEEK_COMPLETIONS_PATH}`;

export interface ChatIntegrationStatus {
  configured: boolean;
  enabled: boolean;
  model: string;
}

/** 去掉 DeepSeek 思考链标记，仅展示对用户可见的正文 */
export function stripAssistantThinkContent(text: string): string {
  if (!text) return '';
  return text
    .replace(/<think[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, '')
    .replace(/<think[^>]*>[\s\S]*/gi, '')
    .replace(/<think>[\s\S]*/gi, '')
    .replace(/<\/?think[^>]*>/gi, '')
    .replace(/<\/?redacted_thinking>/gi, '')
    .trim();
}

type DeepSeekChoice = {
  delta?: { content?: string; role?: string };
  message?: { content?: string; role?: string };
};

type DeepSeekChunk = {
  choices?: DeepSeekChoice[];
};

/**
 * 不展示 reasoning_content /  区块，仅保留回答正文。
 */
export class KuaiDeepSeekChatProvider<
  ChatMessage extends { role?: string; content?: string } = { role?: string; content?: string },
  Input = Record<string, unknown>,
  Output = Record<string, unknown>,
> extends DeepSeekChatProvider<ChatMessage, Input, Output> {
  transformMessage(info: Parameters<DeepSeekChatProvider<ChatMessage, Input, Output>['transformMessage']>[0]) {
    const { originMessage, chunk, responseHeaders } = info;
    let currentContent = '';
    let role = 'assistant';

    try {
      let message: DeepSeekChunk | undefined;
      if (responseHeaders.get('content-type')?.includes('text/event-stream')) {
        if (chunk && (chunk as { data?: string }).data?.trim() !== '[DONE]') {
          message = JSON.parse((chunk as { data: string }).data) as DeepSeekChunk;
        }
      } else {
        message = chunk as DeepSeekChunk;
      }

      message?.choices?.forEach(choice => {
        if (choice?.delta) {
          currentContent += choice.delta.content || '';
          role = choice.delta.role || role;
        } else if (choice?.message) {
          currentContent += choice.message.content || '';
          role = choice.message.role || role;
        }
      });
    } catch {
      // ignore parse errors
    }

    const originRaw = originMessage?.content;
    const originMessageContent =
      typeof originRaw === 'string' ? originRaw : (originRaw as { text?: string } | undefined)?.text || '';

    return {
      content: stripAssistantThinkContent(`${originMessageContent}${currentContent}`),
      role: role || 'assistant',
    } as ChatMessage;
  }
}

export function buildKuaiChatAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const tenantId = localStorage.getItem('tenant_id');
  if (tenantId?.trim()) headers['X-Tenant-ID'] = tenantId.trim();
  return headers;
}

export async function getChatIntegrationStatus(): Promise<ChatIntegrationStatus> {
  return apiRequest<ChatIntegrationStatus>(DEEPSEEK_STATUS_URL, {
    method: 'GET',
  });
}

export async function parseKuaiChatErrorResponse(response: Response): Promise<string> {
  let detail = i18n.t('ui.aiAssistant.chatRequestFailed', { status: response.status });
  try {
    const data = await response.clone().json();
    if (typeof data?.detail === 'string') {
      detail = data.detail;
    } else if (data?.detail?.message) {
      detail = String(data.detail.message);
    } else if (data?.message) {
      detail = String(data.message);
    }
  } catch {
    // ignore parse errors
  }
  if (response.status === 404 && (detail === 'Not Found' || detail.includes('Not Found'))) {
    return i18n.t('ui.aiAssistant.chatUnavailable');
  }
  return detail;
}
