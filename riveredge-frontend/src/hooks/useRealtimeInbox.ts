/**
 * 实时收件箱：python-socketio（默认同进程）或 Centrifugo + HTTP 轮询兜底
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { getToken } from '../utils/auth';
import {
  getRealtimeConfig,
  getRealtimeToken,
  KUAIIOT_DEVICE_REALTIME_EVENT,
  resolveRealtimeWsUrl,
  resolveSocketIoOrigin,
  type KuaiiotDeviceRealtimePayload,
  type RealtimeEnvelope,
} from '../services/realtime';

type Options = {
  enabled: boolean;
  onEvent?: (event: string, payload: Record<string, unknown>) => void;
};

function refetchImInbox(queryClient: ReturnType<typeof useQueryClient>, payload: Record<string, unknown>) {
  void queryClient.invalidateQueries({ queryKey: ['imConversations'] });
  void queryClient.refetchQueries({ queryKey: ['imConversations'], type: 'active' });
  const convUuid = payload.conversation_uuid;
  if (typeof convUuid === 'string' && convUuid) {
    void queryClient.invalidateQueries({ queryKey: ['imMessages', convUuid] });
    void queryClient.refetchQueries({ queryKey: ['imMessages', convUuid], type: 'active' });
  }
}

export function useRealtimeInbox({ enabled, onEvent }: Options) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const centrifugeRef = useRef<{ disconnect: () => void } | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;

    const invalidateInbox = (event: string, payload: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ['userMessageStats'] });
      queryClient.invalidateQueries({ queryKey: ['recentUserMessages'] });
      queryClient.invalidateQueries({ queryKey: ['userInboxMessages'] });
      if (event.startsWith('approval.')) {
        queryClient.invalidateQueries({ queryKey: ['approval-instances'] });
      }
      if (event.startsWith('andon.')) {
        queryClient.invalidateQueries({ queryKey: ['station-andon'] });
        queryClient.invalidateQueries({ queryKey: ['andon'] });
      }
      if (event.startsWith('kuaiiot.device.')) {
        window.dispatchEvent(
          new CustomEvent<KuaiiotDeviceRealtimePayload>(KUAIIOT_DEVICE_REALTIME_EVENT, {
            detail: payload as KuaiiotDeviceRealtimePayload,
          }),
        );
      }
      if (event.startsWith('im.')) {
        refetchImInbox(queryClient, payload);
      }
      if (event.startsWith('message.')) {
        void queryClient.refetchQueries({ queryKey: ['userMessageStats'], type: 'active' });
        void queryClient.refetchQueries({ queryKey: ['userInboxMessages'], type: 'active' });
      }
      onEvent?.(event, payload);
    };

    const handleEnvelope = (raw: unknown) => {
      const data = (raw || {}) as RealtimeEnvelope;
      const event = typeof data.event === 'string' ? data.event : 'unknown';
      const payload =
        data.payload && typeof data.payload === 'object'
          ? (data.payload as Record<string, unknown>)
          : {};
      invalidateInbox(event, payload);
    };

    (async () => {
      try {
        const config = await getRealtimeConfig();
        if (cancelled || !config.enabled) {
          return;
        }

        if (config.backend === 'socketio') {
          const token = getToken();
          if (!token) {
            return;
          }
          const socket = io(resolveSocketIoOrigin(), {
            path: config.socket_path || '/socket.io',
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
          });
          socketRef.current = socket;
          socket.on('realtime', handleEnvelope);
          return;
        }

        if (config.backend === 'centrifugo') {
          const { Centrifuge } = await import('centrifuge');
          const tokenResp = await getRealtimeToken();
          if (cancelled) {
            return;
          }
          const wsUrl = resolveRealtimeWsUrl(config);
          if (!wsUrl) {
            return;
          }
          const client = new Centrifuge(wsUrl, { token: tokenResp.token });
          const sub = client.newSubscription(tokenResp.channel);
          sub.on('publication', (ctx) => handleEnvelope(ctx.data));
          sub.subscribe();
          client.connect();
          centrifugeRef.current = {
            disconnect: () => {
              sub.unsubscribe();
              client.disconnect();
            },
          };
        }
      } catch {
        // 实时不可用时不影响轮询主路径
      }
    })();

    return () => {
      cancelled = true;
      socketRef.current?.off('realtime');
      socketRef.current?.disconnect();
      socketRef.current = null;
      centrifugeRef.current?.disconnect();
      centrifugeRef.current = null;
    };
  }, [enabled, onEvent, queryClient]);
}
