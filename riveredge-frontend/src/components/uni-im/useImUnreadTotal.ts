import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listImConversations } from '../../services/im';
import { getUserMessageStats } from '../../services/userMessage';
import { useCurrentUser } from '../../hooks/useCurrentUser';

/** 顶栏未读：短轮询兜底（实时推送失败或 noop 时仍能刷新角标） */
const HEADER_POLL_MS = 15_000;

export function useImUnreadTotal(enabled: boolean): number {
  const currentUser = useCurrentUser();
  const tenantId = currentUser?.tenant_id ?? null;

  const { data: conversations } = useQuery({
    queryKey: ['imConversations', tenantId],
    queryFn: () => listImConversations({ page: 1, page_size: 50 }),
    enabled: enabled && tenantId != null,
    staleTime: 5_000,
    refetchInterval: enabled ? HEADER_POLL_MS : false,
    refetchIntervalInBackground: false,
  });

  const { data: messageStats } = useQuery({
    queryKey: ['userMessageStats', tenantId],
    queryFn: getUserMessageStats,
    enabled: enabled && tenantId != null,
    staleTime: 5_000,
    refetchInterval: enabled ? HEADER_POLL_MS : false,
    refetchIntervalInBackground: false,
  });

  return useMemo(() => {
    const imUnread = (conversations?.items ?? []).reduce(
      (sum, item) => sum + (item.unread_count || 0),
      0,
    );
    return imUnread + (messageStats?.unread ?? 0);
  }, [conversations?.items, messageStats?.unread]);
}
