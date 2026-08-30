/**
 * 同步进度 NDJSON 流式请求：边收 progress 边回调，最终返回 done.result。
 */

import { API_BASE_URL } from '../../services/api';
import { getToken } from '../../utils/auth';
import { webClientChannelHeaders } from '../../utils/clientChannel';

export type SyncProgressEventHandler = (message: string) => void;

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/x-ndjson',
    ...webClientChannelHeaders(),
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const tenantId = localStorage.getItem('tenant_id')?.trim();
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }
  return headers;
}

export async function apiRequestSyncNdjson<T>(
  url: string,
  options: {
    data?: unknown;
    timeoutMs?: number;
    onProgress?: SyncProgressEventHandler;
  },
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 600_000;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  const sep = url.includes('?') ? '&' : '?';
  const requestUrl = `${API_BASE_URL}${url}${sep}stream=true`;

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(options.data ?? {}),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        detail = errBody?.detail || errBody?.message || detail;
      } catch {
        /* ignore */
      }
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }

    if (!response.body) {
      throw new Error('同步响应缺少正文流');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result: T | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let event: { event?: string; message?: string; result?: T; detail?: string };
        try {
          event = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (event.event === 'progress' && event.message) {
          options.onProgress?.(event.message);
        } else if (event.event === 'done' && event.result !== undefined) {
          result = event.result;
        } else if (event.event === 'error') {
          throw new Error(event.detail || '同步失败');
        }
      }
    }

    if (buffer.trim()) {
      try {
        const event = JSON.parse(buffer.trim());
        if (event.event === 'done' && event.result !== undefined) {
          result = event.result;
        } else if (event.event === 'error') {
          throw new Error(event.detail || '同步失败');
        }
      } catch (err) {
        if (err instanceof Error && err.message !== '同步失败') {
          /* trailing incomplete line */
        } else {
          throw err;
        }
      }
    }

    if (result == null) {
      throw new Error('同步未返回结果');
    }
    return result;
  } finally {
    window.clearTimeout(timer);
  }
}
