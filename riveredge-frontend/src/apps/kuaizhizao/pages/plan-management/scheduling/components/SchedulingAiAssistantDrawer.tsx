/**
 * 可视排产 - AI 排产助手抽屉
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Image, theme } from 'antd';
import { PaperClipOutlined, PlusOutlined } from '@ant-design/icons';
import { Bubble, Prompts, Sender } from '@ant-design/x';
import type { PromptsItemType } from '@ant-design/x';
import { useTranslation } from 'react-i18next';
import { DRAWER_CONFIG } from '../../../../../../components/layout-templates';
import { UniDetail } from '../../../../../../components/uni-detail';
import { UniAiButton, UniAiLottieIcon } from '../../../../../../components/uni-ai-button';
import { useKuaiaiEntryAvailable } from '../../../../../kuaiai/hooks/useKuaiaiEntryAvailable';
import { formatApiErrorDetail } from '../../../../../../services/api';
import type { WorkOrderForGantt } from '../../../../components/GanttSchedulingChart/types';
import type { VisualSchedulingBoardScan } from '../../../../services/production';
import { visualSchedulingApi } from '../../../../services/production';
import {
  schedulingAiApi,
  type SchedulingAiPriorityResult,
  type SchedulingAiProposal,
} from '../../../../services/scheduling-ai';
import { applySchedulingAiProposal } from '../applySchedulingAiProposal';
import { convertEngineProposalToAiProposal } from '../convertEngineProposal';
import { SchedulingAiExplainCard } from './SchedulingAiExplainCard';
import { SchedulingAiPriorityCard } from './SchedulingAiPriorityCard';
import { SchedulingAiProposalCard } from './SchedulingAiProposalCard';
import './SchedulingAiAssistantDrawer.less';

const I18N = 'app.kuaizhizao.scheduling.aiAssist';

type ChatKind = 'explain' | 'priority' | 'proposal';

type ChatMessage = {
  key: string;
  role: 'user' | 'assistant';
  text: string;
  status?: 'loading' | 'error' | 'done';
  kind?: ChatKind;
  imagePreview?: string;
  explainAnswer?: string;
  priorityResult?: SchedulingAiPriorityResult;
  proposal?: SchedulingAiProposal;
  errorDetail?: string;
};

type BubbleItem = {
  key: string;
  role: 'user' | 'ai';
  content: string;
  status?: 'loading' | 'success' | 'error';
  extraInfo?: { msg: ChatMessage };
};

function nextMessageKey(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatApiError(err: unknown, fallback: string): string {
  return (
    formatApiErrorDetail((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail) ||
    (err instanceof Error ? err.message : '') ||
    fallback
  );
}

function looksLikeAdjustmentIntent(text: string): boolean {
  const lowered = text.toLowerCase();
  return /提前|推迟|延后|改到|移到|平移|换工位|排到|改期|调整|tomorrow|shift|move|reschedule/.test(
    lowered,
  );
}

export interface SchedulingAiAssistantContext {
  poolWorkOrderIds: number[];
  selectedWorkOrderIds: number[];
  planDate?: string;
  boardScan?: VisualSchedulingBoardScan | null;
  workOrders: WorkOrderForGantt[];
}

export interface SchedulingAiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  context: SchedulingAiAssistantContext;
  canUpdate: boolean;
  draftWoUpdatesRef: React.MutableRefObject<
    Map<number, { work_order_id: number; planned_start_date: string; planned_end_date: string }>
  >;
  draftOpUpdatesRef: React.MutableRefObject<
    Map<number, { operation_id: number; planned_start_date: string; planned_end_date: string }>
  >;
  draftStationUpdatesRef: React.MutableRefObject<
    Map<number, { operation_id: number; assigned_station_id: number }>
  >;
  mutateGanttWorkOrders: (updater: (prev: WorkOrderForGantt[] | undefined) => WorkOrderForGantt[]) => void;
  pushUndoSnapshot: () => void;
  syncDraftPendingCount: () => void;
  setDraftMode: (on: boolean) => void;
  onPoolReorder?: (order: number[]) => void;
  onSelectSuggested?: (order: number[]) => void;
  onSelectOverdue?: () => void;
}

export function SchedulingAiAssistantTrigger({
  onOpen,
}: {
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const kuaiaiAvailable = useKuaiaiEntryAvailable();
  if (!kuaiaiAvailable) {
    return null;
  }
  return <UniAiButton onClick={onOpen}>{t(`${I18N}.trigger`)}</UniAiButton>;
}

export function SchedulingAiAssistantDrawer({
  open,
  onClose,
  context,
  canUpdate,
  draftWoUpdatesRef,
  draftOpUpdatesRef,
  draftStationUpdatesRef,
  mutateGanttWorkOrders,
  pushUndoSnapshot,
  syncDraftPendingCount,
  setDraftMode,
  onPoolReorder,
  onSelectSuggested,
  onSelectOverdue,
}: SchedulingAiAssistantDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewUrlsRef = useRef<string[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [senderValue, setSenderValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [latestProposal, setLatestProposal] = useState<SchedulingAiProposal | null>(null);

  const apiContext = useMemo(
    () => ({
      workOrderIds: context.poolWorkOrderIds,
      planDate: context.planDate,
      selectedWorkOrderIds: context.selectedWorkOrderIds,
    }),
    [context.planDate, context.poolWorkOrderIds, context.selectedWorkOrderIds],
  );

  const workOrderCodeById = useMemo(() => {
    const map = new Map<number, string>();
    context.workOrders.forEach((wo) => {
      if (wo.code) map.set(wo.id, wo.code);
    });
    return map;
  }, [context.workOrders]);

  const hasOverdueInPool = useMemo(
    () =>
      context.workOrders.some(
        (wo) =>
          context.poolWorkOrderIds.includes(wo.id) &&
          wo.planned_end_date &&
          new Date(wo.planned_end_date).getTime() < Date.now(),
      ),
    [context.poolWorkOrderIds, context.workOrders],
  );

  const revokeImagePreviews = useCallback(() => {
    imagePreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    imagePreviewUrlsRef.current = [];
  }, []);

  useEffect(() => {
    if (!open) {
      revokeImagePreviews();
      setMessages([]);
      setSenderValue('');
      setBusy(false);
      setApplyingKey(null);
      setLatestProposal(null);
    }
  }, [open, revokeImagePreviews]);

  const rememberImagePreview = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    imagePreviewUrlsRef.current.push(url);
    return url;
  }, []);

  const patchMessage = useCallback((key: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const appendAssistantError = useCallback(
    (assistantKey: string, errorDetail: string) => {
      patchMessage(assistantKey, {
        status: 'error',
        text: t(`${I18N}.requestFailed`),
        errorDetail,
      });
      message.error(errorDetail);
    },
    [message, patchMessage, t],
  );

  const runExplain = useCallback(
    async (text: string, assistantKey: string) => {
      const res = await schedulingAiApi.explain(text, apiContext);
      patchMessage(assistantKey, {
        status: 'done',
        kind: 'explain',
        text: t(`${I18N}.explainDone`),
        explainAnswer: res.answer,
      });
    },
    [apiContext, patchMessage, t],
  );

  const runPriority = useCallback(
    async (text: string | undefined, assistantKey: string) => {
      const res = await schedulingAiApi.suggestPriority(apiContext, text);
      patchMessage(assistantKey, {
        status: 'done',
        kind: 'priority',
        text: t(`${I18N}.priorityDone`),
        priorityResult: res,
      });
      onPoolReorder?.(res.suggestedPoolOrder ?? []);
    },
    [apiContext, onPoolReorder, patchMessage, t],
  );

  const runProposal = useCallback(
    async (text: string, assistantKey: string, proposalContext?: SchedulingAiProposal | null) => {
      let engineContext = proposalContext ?? null;
      if (!engineContext && apiContext.selectedWorkOrderIds?.length) {
        try {
          const engineRes = await visualSchedulingApi.autoReschedule({
            work_order_ids: apiContext.selectedWorkOrderIds,
            scope: 'selected',
            plan_date: apiContext.planDate,
          });
          engineContext = convertEngineProposalToAiProposal(engineRes.proposal);
        } catch {
          engineContext = null;
        }
      }
      const res = await schedulingAiApi.suggestAdjustments(text, apiContext, engineContext);
      setLatestProposal(res.proposal);
      patchMessage(assistantKey, {
        status: 'done',
        kind: 'proposal',
        text: t(`${I18N}.proposalDone`),
        proposal: res.proposal,
      });
    },
    [apiContext, patchMessage, t],
  );

  const submitText = useCallback(
    async (rawText: string, forcedKind?: ChatKind) => {
      const text = rawText.trim();
      if (!text || busy) return;

      const userKey = nextMessageKey();
      const assistantKey = nextMessageKey();
      const kind: ChatKind =
        forcedKind ??
        (canUpdate && looksLikeAdjustmentIntent(text) ? 'proposal' : 'explain');

      setMessages((prev) => [
        ...prev,
        { key: userKey, role: 'user', text, status: 'done' },
        {
          key: assistantKey,
          role: 'assistant',
          text: t(`${I18N}.thinking`),
          status: 'loading',
          kind,
        },
      ]);
      setSenderValue('');
      setBusy(true);

      try {
        if (kind === 'priority') {
          await runPriority(text, assistantKey);
        } else if (kind === 'proposal') {
          if (!canUpdate) {
            appendAssistantError(assistantKey, t(`${I18N}.updateRequired`));
            return;
          }
          await runProposal(text, assistantKey, latestProposal);
        } else {
          await runExplain(text, assistantKey);
        }
      } catch (err: unknown) {
        appendAssistantError(assistantKey, formatApiError(err, t(`${I18N}.requestFailed`)));
      } finally {
        setBusy(false);
      }
    },
    [appendAssistantError, busy, canUpdate, latestProposal, runExplain, runPriority, runProposal, t],
  );

  const runFollowUpPriority = useCallback(() => {
    void submitText(t(`${I18N}.promptPriority`), 'priority');
  }, [submitText, t]);

  const runFollowUpAdjustments = useCallback(
    (hint: string) => {
      void submitText(hint, 'proposal');
    },
    [submitText],
  );

  const submitImage = useCallback(
    async (file: File) => {
      if (busy) return;
      if (!canUpdate) {
        message.warning(t(`${I18N}.updateRequired`));
        return;
      }
      if (!file.type.startsWith('image/')) {
        message.warning(t(`${I18N}.uploadHint`));
        return;
      }
      if (file.size > 12 * 1024 * 1024) {
        message.warning(t(`${I18N}.uploadHint`));
        return;
      }

      const preview = rememberImagePreview(file);
      const userKey = nextMessageKey();
      const assistantKey = nextMessageKey();
      setMessages((prev) => [
        ...prev,
        {
          key: userKey,
          role: 'user',
          text: t(`${I18N}.userImageMessage`),
          status: 'done',
          imagePreview: preview,
        },
        {
          key: assistantKey,
          role: 'assistant',
          text: t(`${I18N}.recognizing`),
          status: 'loading',
          kind: 'proposal',
        },
      ]);
      setBusy(true);

      try {
        const res = await schedulingAiApi.parseDispatchImage(file, apiContext);
        setLatestProposal(res.proposal);
        patchMessage(assistantKey, {
          status: 'done',
          kind: 'proposal',
          text: t(`${I18N}.proposalDone`),
          proposal: res.proposal,
        });
      } catch (err: unknown) {
        appendAssistantError(assistantKey, formatApiError(err, t(`${I18N}.requestFailed`)));
      } finally {
        setBusy(false);
      }
    },
    [apiContext, appendAssistantError, busy, canUpdate, message, patchMessage, rememberImagePreview, t],
  );

  const handleApplyProposal = useCallback(
    async (msg: ChatMessage) => {
      if (!msg.proposal) return;
      setApplyingKey(msg.key);
      try {
        applySchedulingAiProposal({
          proposal: msg.proposal,
          draftWoUpdatesRef,
          draftOpUpdatesRef,
          draftStationUpdatesRef,
          mutateGanttWorkOrders,
          pushUndoSnapshot,
          syncDraftPendingCount,
          setDraftMode,
          onPoolReorder,
          message,
          t,
        });
      } finally {
        setApplyingKey(null);
      }
    },
    [
      draftOpUpdatesRef,
      draftStationUpdatesRef,
      draftWoUpdatesRef,
      message,
      mutateGanttWorkOrders,
      onPoolReorder,
      pushUndoSnapshot,
      setDraftMode,
      syncDraftPendingCount,
      t,
    ],
  );

  const handleNewChat = useCallback(() => {
    revokeImagePreviews();
    setMessages([]);
    setSenderValue('');
    setLatestProposal(null);
  }, [revokeImagePreviews]);

  const promptItems: PromptsItemType[] = useMemo(
    () => [
      {
        key: 'overload',
        label: t(`${I18N}.promptOverload`),
        icon: <span className="scheduling-ai-chat-prompt-hash">#</span>,
      },
      {
        key: 'overdue',
        label: t(`${I18N}.promptOverdue`),
        icon: <span className="scheduling-ai-chat-prompt-hash">#</span>,
      },
      {
        key: 'priority',
        label: t(`${I18N}.promptPriority`),
        icon: <span className="scheduling-ai-chat-prompt-hash">#</span>,
      },
      {
        key: 'readiness',
        label: t(`${I18N}.promptReadiness`),
        icon: <span className="scheduling-ai-chat-prompt-hash">#</span>,
      },
    ],
    [t],
  );

  const bubbleItems: BubbleItem[] = useMemo(
    () =>
      messages.map((msg) => ({
        key: msg.key,
        role: msg.role === 'user' ? 'user' : 'ai',
        content: msg.explainAnswer || msg.text,
        status: msg.status === 'loading' ? 'loading' : msg.status === 'error' ? 'error' : 'success',
        extraInfo: { msg },
      })),
    [messages],
  );

  const renderUserBubble = useCallback(
    (_: unknown, info: { extraInfo?: { msg?: ChatMessage } }) => {
      const msg = info.extraInfo?.msg;
      if (!msg) return null;
      return (
        <div className="scheduling-ai-chat-user-bubble">
          {msg.imagePreview ? (
            <Image
              src={msg.imagePreview}
              alt=""
              className="scheduling-ai-chat-user-image"
              preview={{ mask: t(`${I18N}.previewImage`) }}
            />
          ) : null}
          <span>{msg.text}</span>
        </div>
      );
    },
    [t],
  );

  const renderAiBubble = useCallback(
    (_: unknown, info: { extraInfo?: { msg?: ChatMessage } }) => {
      const msg = info.extraInfo?.msg;
      if (!msg) return null;
      if (msg.status === 'loading') return msg.text;
      if (msg.errorDetail) {
        return <Alert type="error" showIcon message={msg.text} description={msg.errorDetail} />;
      }
      if (msg.explainAnswer) {
        return (
          <SchedulingAiExplainCard
            answer={msg.explainAnswer}
            canUpdate={canUpdate}
            hasSelectedWorkOrders={context.selectedWorkOrderIds.length > 0}
            hasOverdueInPool={hasOverdueInPool}
            busy={busy}
            onSuggestPriority={runFollowUpPriority}
            onSelectOverdue={onSelectOverdue}
            onSuggestAdjustments={canUpdate ? runFollowUpAdjustments : undefined}
          />
        );
      }
      if (msg.priorityResult) {
        return (
          <SchedulingAiPriorityCard
            result={msg.priorityResult}
            workOrderCodeById={workOrderCodeById}
            canSelectSuggested={Boolean(onSelectSuggested)}
            onSelectSuggested={onSelectSuggested}
          />
        );
      }
      if (msg.proposal) {
        return (
          <SchedulingAiProposalCard
            proposal={msg.proposal}
            workOrders={context.workOrders}
            canApply={canUpdate}
            applying={applyingKey === msg.key}
            onApply={() => void handleApplyProposal(msg)}
          />
        );
      }
      return msg.text;
    },
    [
      applyingKey,
      busy,
      canUpdate,
      context.selectedWorkOrderIds.length,
      context.workOrders,
      handleApplyProposal,
      hasOverdueInPool,
      onSelectOverdue,
      onSelectSuggested,
      runFollowUpAdjustments,
      runFollowUpPriority,
      workOrderCodeById,
    ],
  );

  const senderFooter = useCallback(
    (_oriNode: React.ReactNode, { components }: { components: Record<string, React.ComponentType> }) => {
      const ActionBtn = busy ? components.LoadingButton : components.SendButton;
      return (
        <div className="scheduling-ai-chat-sender-toolbar">
          {canUpdate ? (
            <div className="scheduling-ai-chat-upload-group">
              <Button
                type="text"
                size="small"
                icon={<PaperClipOutlined />}
                disabled={busy}
                aria-label={t(`${I18N}.uploadImage`)}
                onClick={() => fileInputRef.current?.click()}
              />
              {open && !busy ? (
                <span
                  className="scheduling-ai-chat-upload-hint"
                  style={{
                    color: token.colorTextSecondary,
                    background: token.colorBgElevated,
                    borderColor: token.colorBorderSecondary,
                  }}
                >
                  {t(`${I18N}.uploadImageTooltip`)}
                </span>
              ) : null}
            </div>
          ) : (
            <span />
          )}
          <ActionBtn />
        </div>
      );
    },
    [busy, canUpdate, open, t, token],
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void submitImage(file);
        }}
      />
      <UniDetail
        title={
          <span className="scheduling-ai-chat-title">
            <UniAiLottieIcon size={22} />
            <span>{t(`${I18N}.title`)}</span>
          </span>
        }
        open={open}
        onClose={onClose}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        className="scheduling-ai-assistant-drawer"
        styles={{
          body: {
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
          },
          title: { display: 'flex', alignItems: 'center', margin: 0 },
        }}
        extra={
          <Button type="text" icon={<PlusOutlined />} onClick={handleNewChat} disabled={busy}>
            {t(`${I18N}.newChat`)}
          </Button>
        }
      >
        <div className="scheduling-ai-chat">
          <div className="scheduling-ai-chat-main">
            {messages.length === 0 ? (
              <div className="scheduling-ai-chat-welcome">
                <div>
                  <div className="scheduling-ai-chat-welcome-title">{t(`${I18N}.welcomeTitle`)}</div>
                  <div className="scheduling-ai-chat-welcome-desc">{t(`${I18N}.welcomeDesc`)}</div>
                </div>
                <Prompts
                  className="scheduling-ai-chat-prompts"
                  items={promptItems}
                  onItemClick={(item) => {
                    const key = String(item.data?.key ?? item.key);
                    if (key === 'priority') {
                      void submitText(t(`${I18N}.promptPriority`), 'priority');
                      return;
                    }
                    const label = typeof item.data?.label === 'string' ? item.data.label : String(item.label ?? '');
                    if (label) void submitText(label, 'explain');
                  }}
                />
              </div>
            ) : (
              <div className="scheduling-ai-chat-scroll">
                <Bubble.List
                  className="scheduling-ai-chat-bubbles"
                  items={bubbleItems}
                  autoScroll
                  role={{
                    ai: {
                      placement: 'start',
                      contentRender: renderAiBubble,
                      styles: {
                        content: {
                          background: token.colorFillTertiary,
                          color: token.colorText,
                          maxWidth: '100%',
                        },
                      },
                      avatar: <UniAiLottieIcon size={32} />,
                    },
                    user: {
                      placement: 'end',
                      contentRender: renderUserBubble,
                      styles: {
                        content: {
                          background: token.colorPrimaryBg,
                          color: token.colorText,
                        },
                      },
                    },
                  }}
                />
              </div>
            )}
          </div>
          <div className="scheduling-ai-chat-sender-wrap">
            <Sender
              className="scheduling-ai-chat-sender"
              value={senderValue}
              onChange={setSenderValue}
              onSubmit={(val) => void submitText(val)}
              loading={busy}
              placeholder={t(`${I18N}.inputPlaceholder`)}
              footer={senderFooter}
            />
          </div>
        </div>
      </UniDetail>
    </>
  );
}
