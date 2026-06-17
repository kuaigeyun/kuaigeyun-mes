/**
 * DeepSeek 集成状态（站点设置）统一查询。
 *
 * AI 助手与其它消费方共用 queryKey，避免路由切换导致组件重挂载时重复拉取 status。
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getChatIntegrationStatus, type ChatIntegrationStatus } from '../apps/kuaiai/services/chat';
import { useGlobalStore } from '../stores';

export const CHAT_INTEGRATION_STATUS_QUERY_KEY = 'chatIntegrationStatus';

export function buildChatIntegrationStatusQueryKey(tenantId?: number | null) {
  return [CHAT_INTEGRATION_STATUS_QUERY_KEY, tenantId ?? null] as const;
}

export interface UseChatIntegrationStatusOptions {
  enabled?: boolean;
}

export function useChatIntegrationStatus(options: UseChatIntegrationStatusOptions = {}) {
  const { enabled = true } = options;
  const tenantId = useGlobalStore((s) => s.currentUser?.tenant_id);

  const queryKey = useMemo(() => buildChatIntegrationStatusQueryKey(tenantId), [tenantId]);

  return useQuery<ChatIntegrationStatus>({
    queryKey,
    queryFn: getChatIntegrationStatus,
    enabled: enabled && tenantId != null,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
