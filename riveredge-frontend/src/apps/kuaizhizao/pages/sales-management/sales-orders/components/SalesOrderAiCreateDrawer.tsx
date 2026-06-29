/**
 * 销售订单 · AI 对话式智能录单抽屉
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Image, theme } from 'antd';
import { PaperClipOutlined, PlusOutlined } from '@ant-design/icons';
import { Bubble, Prompts, Sender } from '@ant-design/x';
import type { PromptsItemType } from '@ant-design/x';
import { useTranslation } from 'react-i18next';
import type { ProFormInstance } from '@ant-design/pro-components';
import { DRAWER_CONFIG } from '../../../../../../components/layout-templates';
import { UniDetail } from '../../../../../../components/uni-detail';
import { UniAiButton, UniAiLottieIcon } from '../../../../../../components/uni-ai-button';
import { formatApiErrorDetail } from '../../../../../../services/api';
import {
  extractSalesOrderFromImage,
  parseSalesOrderFromText,
  type SalesOrderOcrResult,
} from '../../../../services/sales-order-ocr';
import { applySalesOrderOcrResult } from './applySalesOrderOcrResult';
import {
  buildOcrCreatePlan,
  buildOcrMatchPreview,
  type CustomerLike,
  type MaterialLike,
} from './salesOrderOcrMasters';
import { SalesOrderOcrResultCard } from './SalesOrderOcrResultCard';
import { SalesOrderOcrMasterConfirmModal } from './SalesOrderOcrMasterConfirmModal';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import './SalesOrderAiCreateDrawer.less';

const I18N = 'app.kuaizhizao.salesOrder.aiCreate';

type ChatMessage = {
  key: string;
  role: 'user' | 'assistant';
  text: string;
  status?: 'loading' | 'error' | 'done';
  imagePreview?: string;
  result?: SalesOrderOcrResult;
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

export interface SalesOrderAiCreateTriggerProps {
  formRef: React.RefObject<ProFormInstance | undefined>;
  customers: CustomerLike[];
  materials: MaterialLike[];
  users: Array<{ id: number; full_name?: string; username?: string }>;
  onCustomersChange?: (customers: CustomerLike[]) => void;
  onMaterialsChange?: (materials: MaterialLike[]) => void;
}

export function SalesOrderAiCreateTrigger({
  formRef,
  customers,
  materials,
  users,
  onCustomersChange,
  onMaterialsChange,
}: SalesOrderAiCreateTriggerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <UniAiButton onClick={() => setOpen(true)}>{t(`${I18N}.trigger`)}</UniAiButton>
      <SalesOrderAiCreateDrawer
        open={open}
        onClose={() => setOpen(false)}
        formRef={formRef}
        customers={customers}
        materials={materials}
        users={users}
        onCustomersChange={onCustomersChange}
        onMaterialsChange={onMaterialsChange}
        onApplied={() => setOpen(false)}
      />
    </>
  );
}

export interface SalesOrderAiCreateDrawerProps extends SalesOrderAiCreateTriggerProps {
  open: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

export function SalesOrderAiCreateDrawer({
  open,
  onClose,
  onApplied,
  formRef,
  customers,
  materials,
  users,
  onCustomersChange,
  onMaterialsChange,
}: SalesOrderAiCreateDrawerProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const customerPerm = useResourcePermissions('master-data:supply-chain:customer');
  const materialPerm = useResourcePermissions('master-data:material');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewUrlsRef = useRef<string[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [senderValue, setSenderValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingApplyMsg, setPendingApplyMsg] = useState<ChatMessage | null>(null);

  const latestResult = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const row = messages[i];
      if (row.result) return row.result;
    }
    return null;
  }, [messages]);

  const revokeImagePreviews = useCallback(() => {
    imagePreviewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    imagePreviewUrlsRef.current = [];
  }, []);

  useEffect(() => {
    if (!open) {
      revokeImagePreviews();
      setMessages([]);
      setSenderValue('');
      setBusy(false);
      setApplyingKey(null);
      setConfirmOpen(false);
      setPendingApplyMsg(null);
    }
  }, [open, revokeImagePreviews]);

  const rememberImagePreview = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    imagePreviewUrlsRef.current.push(url);
    return url;
  }, []);

  const patchMessage = useCallback((key: string, patch: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(item => (item.key === key ? { ...item, ...patch } : item)));
  }, []);

  const appendAssistantResult = useCallback(
    (assistantKey: string, result: SalesOrderOcrResult) => {
      patchMessage(assistantKey, {
        status: 'done',
        text: t(`${I18N}.parseSuccess`),
        result,
      });
    },
    [patchMessage, t],
  );

  const appendAssistantError = useCallback(
    (assistantKey: string, errorDetail: string) => {
      patchMessage(assistantKey, {
        status: 'error',
        text: t(`${I18N}.recognizeFailed`),
        errorDetail,
      });
      message.error(errorDetail);
    },
    [message, patchMessage, t],
  );

  const submitText = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || busy) return;

      const userKey = nextMessageKey();
      const assistantKey = nextMessageKey();
      setMessages(prev => [
        ...prev,
        { key: userKey, role: 'user', text, status: 'done' },
        {
          key: assistantKey,
          role: 'assistant',
          text: t(`${I18N}.thinking`),
          status: 'loading',
        },
      ]);
      setSenderValue('');
      setBusy(true);

      try {
        const data = await parseSalesOrderFromText(text, latestResult);
        appendAssistantResult(assistantKey, data);
      } catch (err: unknown) {
        appendAssistantError(assistantKey, formatApiError(err, t(`${I18N}.recognizeFailed`)));
      } finally {
        setBusy(false);
      }
    },
    [appendAssistantError, appendAssistantResult, busy, latestResult, t],
  );

  const submitImage = useCallback(
    async (file: File) => {
      if (busy) return;
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
      setMessages(prev => [
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
        },
      ]);
      setBusy(true);

      try {
        const data = await extractSalesOrderFromImage(file);
        appendAssistantResult(assistantKey, data);
      } catch (err: unknown) {
        appendAssistantError(assistantKey, formatApiError(err, t(`${I18N}.recognizeFailed`)));
      } finally {
        setBusy(false);
      }
    },
    [appendAssistantError, appendAssistantResult, busy, message, rememberImagePreview, t],
  );

  const finishApply = useCallback(
    async (
      msg: ChatMessage,
      extras?: {
        createdCustomer?: CustomerLike;
        createdMaterialsByDedupeKey?: Map<string, MaterialLike>;
        customers?: CustomerLike[];
        materials?: MaterialLike[];
      },
    ) => {
      if (!msg.result) return false;
      const ok = await applySalesOrderOcrResult({
        formRef,
        result: msg.result,
        customers: extras?.customers ?? customers,
        materials: extras?.materials ?? materials,
        users,
        message,
        t,
        onCustomersChange,
        onMaterialsChange,
        createdCustomer: extras?.createdCustomer,
        createdMaterialsByDedupeKey: extras?.createdMaterialsByDedupeKey,
      });
      if (ok) onApplied?.();
      return ok;
    },
    [
      formRef,
      customers,
      materials,
      users,
      message,
      t,
      onCustomersChange,
      onMaterialsChange,
      onApplied,
    ],
  );

  const handleApply = useCallback(
    async (msg: ChatMessage) => {
      if (!msg.result) return;
      const plan = buildOcrCreatePlan(msg.result, customers, materials, {
        canCreateCustomer: customerPerm.canCreate,
        canCreateMaterial: materialPerm.canCreate,
      });
      if (plan.needsConfirmation) {
        setPendingApplyMsg(msg);
        setConfirmOpen(true);
        return;
      }
      setApplyingKey(msg.key);
      try {
        await finishApply(msg);
      } finally {
        setApplyingKey(null);
      }
    },
    [customers, materials, customerPerm.canCreate, materialPerm.canCreate, finishApply],
  );

  const handleConfirmModalSkip = useCallback(async () => {
    if (!pendingApplyMsg) return;
    setConfirmOpen(false);
    setApplyingKey(pendingApplyMsg.key);
    try {
      await finishApply(pendingApplyMsg);
    } finally {
      setApplyingKey(null);
      setPendingApplyMsg(null);
    }
  }, [pendingApplyMsg, finishApply]);

  const handleConfirmModalConfirmed = useCallback(
    async (payload: {
      customers: CustomerLike[];
      materials: MaterialLike[];
      createdCustomer?: CustomerLike;
      createdMaterialsByDedupeKey: Map<string, MaterialLike>;
    }) => {
      if (!pendingApplyMsg) return;
      setConfirmOpen(false);
      setApplyingKey(pendingApplyMsg.key);
      try {
        await finishApply(pendingApplyMsg, payload);
      } finally {
        setApplyingKey(null);
        setPendingApplyMsg(null);
      }
    },
    [pendingApplyMsg, finishApply],
  );

  const handleNewChat = useCallback(() => {
    revokeImagePreviews();
    setMessages([]);
    setSenderValue('');
  }, [revokeImagePreviews]);

  const promptItems: PromptsItemType[] = useMemo(
    () => [
      {
        key: 'sample-order',
        label: t(`${I18N}.promptSampleOrder`),
        icon: <span className="sales-order-ai-chat-prompt-hash">#</span>,
      },
      {
        key: 'sample-supplement',
        label: t(`${I18N}.promptSampleSupplement`),
        icon: <span className="sales-order-ai-chat-prompt-hash">#</span>,
      },
    ],
    [t],
  );

  const bubbleItems: BubbleItem[] = useMemo(
    () =>
      messages.map(msg => ({
        key: msg.key,
        role: msg.role === 'user' ? 'user' : 'ai',
        content: msg.text,
        status: msg.status === 'loading' ? 'loading' : msg.status === 'error' ? 'error' : 'success',
        extraInfo: { msg },
      })),
    [messages],
  );

  const renderUserBubble = useCallback((_: unknown, info: { extraInfo?: { msg?: ChatMessage } }) => {
    const msg = info.extraInfo?.msg;
    if (!msg) return null;
    return (
      <div className="sales-order-ai-chat-user-bubble">
        {msg.imagePreview ? (
          <Image
            src={msg.imagePreview}
            alt=""
            className="sales-order-ai-chat-user-image"
            preview={{ mask: t(`${I18N}.previewImage`) }}
          />
        ) : null}
        <span>{msg.text}</span>
      </div>
    );
  }, [t]);

  const renderAiBubble = useCallback(
    (_: unknown, info: { extraInfo?: { msg?: ChatMessage } }) => {
      const msg = info.extraInfo?.msg;
      if (!msg) return null;
      if (msg.status === 'loading') return msg.text;
      if (msg.errorDetail) {
        return (
          <Alert
            type="error"
            showIcon
            message={msg.text}
            description={msg.errorDetail}
          />
        );
      }
      if (msg.result) {
        const matchPreview = buildOcrMatchPreview(msg.result, customers, materials, {
          canCreateCustomer: customerPerm.canCreate,
          canCreateMaterial: materialPerm.canCreate,
        });
        return (
          <SalesOrderOcrResultCard
            result={msg.result}
            matchPreview={matchPreview}
            applying={applyingKey === msg.key}
            onApply={() => void handleApply(msg)}
          />
        );
      }
      return msg.text;
    },
    [applyingKey, customerPerm.canCreate, customers, handleApply, materialPerm.canCreate, materials],
  );

  const senderFooter = useCallback(
    (_oriNode: React.ReactNode, { components }: { components: Record<string, React.ComponentType> }) => {
      const ActionBtn = busy ? components.LoadingButton : components.SendButton;
      return (
        <div className="sales-order-ai-chat-sender-toolbar">
          <div className="sales-order-ai-chat-upload-group">
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
                className="sales-order-ai-chat-upload-hint"
                style={{
                  color: token.colorTextSecondary,
                  background: token.colorBgElevated,
                  borderColor: token.colorBorderSecondary,
                  ['--upload-hint-bg' as string]: token.colorBgElevated,
                  ['--upload-hint-border' as string]: token.colorBorderSecondary,
                }}
              >
                {t(`${I18N}.uploadImageTooltip`)}
              </span>
            ) : null}
          </div>
          <ActionBtn />
        </div>
      );
    },
    [busy, open, t, token],
  );

  return (
    <>
      <UniDetail
      title={
        <span className="sales-order-ai-chat-title">
          <UniAiLottieIcon size={22} />
          <span>{t(`${I18N}.title`)}</span>
        </span>
      }
      open={open}
      onClose={onClose}
      width={DRAWER_CONFIG.STANDARD_WIDTH}
      className="sales-order-ai-create-drawer"
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
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleNewChat}
          disabled={busy || messages.length === 0}
          aria-label={t(`${I18N}.newChat`)}
          title={t(`${I18N}.newChat`)}
        />
      }
      plainBody={
        <div className="sales-order-ai-chat">
          <div className="sales-order-ai-chat-main">
            {messages.length === 0 ? (
              <div className="sales-order-ai-chat-welcome">
                <div className="sales-order-ai-chat-welcome-copy">
                  <div className="sales-order-ai-chat-welcome-title">{t(`${I18N}.welcomeTitle`)}</div>
                  <div className="sales-order-ai-chat-welcome-desc">{t(`${I18N}.welcomeDesc`)}</div>
                </div>
                <div className="sales-order-ai-chat-prompts">
                  <Prompts
                    items={promptItems}
                    vertical
                    onItemClick={({ data }) => {
                      const label = typeof data.label === 'string' ? data.label : '';
                      if (label) void submitText(label);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="sales-order-ai-chat-scroll">
                <Bubble.List
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

          <div className="sales-order-ai-chat-sender-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void submitImage(file);
                e.target.value = '';
              }}
            />
            <Sender
              placeholder={t(`${I18N}.senderPlaceholder`)}
              loading={busy}
              disabled={!open}
              value={senderValue}
              onChange={setSenderValue}
              onSubmit={value => void submitText(value)}
              suffix={false}
              footer={senderFooter}
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          </div>
        </div>
      }
    />
      <SalesOrderOcrMasterConfirmModal
        open={confirmOpen}
        result={pendingApplyMsg?.result ?? null}
        customers={customers}
        materials={materials}
        canCreateCustomer={customerPerm.canCreate}
        canCreateMaterial={materialPerm.canCreate}
        onClose={() => {
          setConfirmOpen(false);
          setPendingApplyMsg(null);
        }}
        onSkip={() => void handleConfirmModalSkip()}
        onConfirmed={(payload) => void handleConfirmModalConfirmed(payload)}
      />
    </>
  );
}

export default SalesOrderAiCreateTrigger;
