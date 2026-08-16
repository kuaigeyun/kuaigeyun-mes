/**
 * 页面级注册 KU-AI 业务上下文；卸载时自动清除。
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { type AiContextPayload, useAiContext } from '../contexts/AiContext';

export function useRegisterAiContext(payload: AiContextPayload | null | undefined) {
  const { setContext } = useAiContext();
  const location = useLocation();

  useEffect(() => {
    if (!payload) {
      setContext(null);
      return () => setContext(null);
    }
    setContext({
      ...payload,
      screen: payload.screen ?? location.pathname,
    });
    return () => setContext(null);
  }, [
    setContext,
    location.pathname,
    payload?.screen,
    payload?.screenLabel,
    payload?.resourceKey,
    payload?.recordId,
    payload?.recordLabel,
    payload?.capabilityMode,
    payload?.agentId,
  ]);
}
