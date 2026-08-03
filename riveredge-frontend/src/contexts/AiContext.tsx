/**
 * KU-AI 业务上下文（ContextBroker 前端真源）
 *
 * 页面通过 useRegisterAiContext 注册当前 screen / 单据信息，
 * 顶栏 KU-Ask 自动携带并在 UI 展示上下文徽标。
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type AiCapabilityMode = 'ask' | 'query' | 'guide';

export type AiContextPayload = {
  /** 路由 path，如 /apps/kuaizhizao/production-execution/work-orders */
  screen?: string;
  /** 页面中文名 */
  screenLabel?: string;
  /** 业务单据 resource_key */
  resourceKey?: string;
  /** 单据主键 */
  recordId?: string | number;
  /** 单据展示名（编码等） */
  recordLabel?: string;
  /** KU-AI 能力模式：综合问答 / 智能问数 / 智能实施 */
  capabilityMode?: AiCapabilityMode;
};

export type PendingAssistantRequest = {
  prompt?: string;
  context?: AiContextPayload;
};

type AiContextValue = {
  context: AiContextPayload | null;
  setContext: (payload: AiContextPayload | null) => void;
  hasContext: boolean;
  contextBadge: string | null;
  pendingAssistant: PendingAssistantRequest | null;
  setPendingAssistant: (payload: PendingAssistantRequest | null) => void;
};

const AiContext = createContext<AiContextValue | null>(null);

export function AiContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContextState] = useState<AiContextPayload | null>(null);
  const [pendingAssistant, setPendingAssistant] = useState<PendingAssistantRequest | null>(null);

  const setContext = useCallback((payload: AiContextPayload | null) => {
    setContextState(payload);
  }, []);

  const contextBadge = useMemo(() => {
    if (!context) return null;
    if (context.recordLabel) return context.recordLabel;
    if (context.screenLabel) return context.screenLabel;
    if (context.screen) {
      const seg = context.screen.split('/').filter(Boolean).pop();
      return seg || context.screen;
    }
    return null;
  }, [context]);

  const value = useMemo(
    () => ({
      context,
      setContext,
      hasContext: Boolean(contextBadge),
      contextBadge,
      pendingAssistant,
      setPendingAssistant,
    }),
    [context, setContext, contextBadge, pendingAssistant],
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAiContext(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) {
    return {
      context: null,
      setContext: () => undefined,
      hasContext: false,
      contextBadge: null,
      pendingAssistant: null,
      setPendingAssistant: () => undefined,
    };
  }
  return ctx;
}

/** 供 completions API 使用的 snake_case 载荷 */
export function toAiContextApiPayload(context: AiContextPayload | null): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const payload: Record<string, unknown> = {};
  if (context.screen) payload.screen = context.screen;
  if (context.screenLabel) payload.screen_label = context.screenLabel;
  if (context.resourceKey) payload.resource_key = context.resourceKey;
  if (context.recordId != null && context.recordId !== '') payload.record_id = context.recordId;
  if (context.recordLabel) payload.record_label = context.recordLabel;
  const extra: Record<string, unknown> = {};
  if (context.capabilityMode) extra.capability_mode = context.capabilityMode;
  if (Object.keys(extra).length) payload.extra = extra;
  return Object.keys(payload).length ? payload : undefined;
}
