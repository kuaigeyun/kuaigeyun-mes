import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createCache, StyleProvider } from '@ant-design/cssinjs'
import { message, Button, Spin, theme } from 'antd'
import BorderBeam from 'antd/es/border-beam'
import { CloseOutlined, CopyOutlined, ReloadOutlined, PlusOutlined, CaretDownOutlined } from '@ant-design/icons'
import { Bubble, Prompts, Sender } from '@ant-design/x'
import type { PromptsItemType } from '@ant-design/x'
import { useXChat, XRequest } from '@ant-design/x-sdk'
import Lottie from 'lottie-react'
import { useTranslation } from 'react-i18next'
import {
  buildKuaiChatAuthHeaders,
  KuaiDeepSeekChatProvider,
  KUAI_CHAT_COMPLETIONS_URL,
  parseKuaiChatErrorResponse,
  stripAssistantThinkContent,
  type ChatIntegrationStatus,
} from '../../apps/kuaiai/services/chat'
import { useChatIntegrationStatus } from '../../hooks/useChatIntegrationStatus'
import assistAnimation from '../../../static/lottie/assist.json'
import welcomeAnimation from '../../../static/lottie/welcome.json'
import AiAssistantMarkdown from './AiAssistantMarkdown'
import './index.less'

type XChatMessage = {
  role: string
  content: string
}

/** Bubble.List 单条 item 形状（与 Ant Design X 默认对话样式一致） */
type BubbleItem = {
  key: string | number
  role: 'user' | 'ai'
  content: string
  status?: 'local' | 'loading' | 'updating' | 'success' | 'error' | 'abort'
  extraInfo?: Record<string, unknown>
}

export interface AIAssistantProps {
  open?: boolean
  onClose?: () => void
  /**
   * 仅界面预览：不接入真实 API，用本地 mock 数据展示对话框样式。
   * 未传时根据站点设置中的 DeepSeek 集成配置自动判断。
   */
  designOnly?: boolean
}

const SCROLL_LOCK_CLASSES = ['ant-scrolling-effect', 'ant-modal-open'] as const

const SCROLL_LOCK_STYLE_KEYS = ['overflow', 'overflow-x', 'overflow-y', 'padding-right', 'width'] as const

const aiAssistantStyleCache = createCache()

function releaseScrollLockStyles(element: HTMLElement) {
  SCROLL_LOCK_STYLE_KEYS.forEach(key => {
    element.style.removeProperty(key)
  })
}

function releaseGlobalScrollLock() {
  const hasOtherOverlay = document.querySelector(
    '.ant-modal-wrap:not([aria-hidden="true"]), .ant-drawer-open, .ant-image-preview-wrap',
  )
  if (hasOtherOverlay) return

  releaseScrollLockStyles(document.body)
  releaseScrollLockStyles(document.documentElement)

  SCROLL_LOCK_CLASSES.forEach(className => {
    document.body.classList.remove(className)
    document.documentElement.classList.remove(className)
  })
}

function requestProLayoutReflow() {
  window.dispatchEvent(new Event('resize'))
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
}

function scheduleScrollLockRelease() {
  const run = () => {
    releaseGlobalScrollLock()
    requestProLayoutReflow()
  }

  run()
  const raf1 = requestAnimationFrame(run)
  const raf2 = requestAnimationFrame(() => requestAnimationFrame(run))
  const timeout0 = window.setTimeout(run, 0)
  const timeout50 = window.setTimeout(run, 50)

  return () => {
    cancelAnimationFrame(raf1)
    cancelAnimationFrame(raf2)
    window.clearTimeout(timeout0)
    window.clearTimeout(timeout50)
  }
}

function usePromptItems(): PromptsItemType[] {
  const { t } = useTranslation()
  return useMemo(
    () => [
      {
        key: 'work-order',
        label: t('ui.aiAssistant.prompt.workOrder'),
        icon: <span className="ai-qa-prompt-hash">#</span>,
      },
      {
        key: 'inventory',
        label: t('ui.aiAssistant.prompt.inventory'),
        icon: <span className="ai-qa-prompt-hash">#</span>,
      },
      {
        key: 'reporting',
        label: t('ui.aiAssistant.prompt.reporting'),
        icon: <span className="ai-qa-prompt-hash">#</span>,
      },
      {
        key: 'progress',
        label: t('ui.aiAssistant.prompt.progress'),
        icon: <span className="ai-qa-prompt-hash">#</span>,
      },
    ],
    [t],
  )
}

function blurPanelFocus(shell: HTMLElement | null) {
  const active = document.activeElement
  if (active instanceof HTMLElement && shell?.contains(active)) {
    active.blur()
  }
}

const kuaiChatProviderCache = new Map<
  string,
  KuaiDeepSeekChatProvider<XChatMessage, Record<string, unknown>, Record<string, unknown>>
>()

function getKuaiChatProvider(model: string) {
  let provider = kuaiChatProviderCache.get(model)
  if (!provider) {
    provider = new KuaiDeepSeekChatProvider<XChatMessage, Record<string, unknown>, Record<string, unknown>>({
      request: buildKuaiChatRequest(model),
    })
    kuaiChatProviderCache.set(model, provider)
  }
  return provider
}

function buildKuaiChatRequest(model: string) {
  return XRequest(KUAI_CHAT_COMPLETIONS_URL, {
    manual: true,
    timeout: 120000,
    headers: buildKuaiChatAuthHeaders(),
    params: {
      model,
      stream: false,
      temperature: 0.7,
    },
    middlewares: {
      onRequest: async (url, options) => {
        const headers = {
          ...options.headers,
          ...buildKuaiChatAuthHeaders(),
          'Content-Type': 'application/json',
        }
        return [url, { ...options, headers }]
      },
      onResponse: async (response: Response) => {
        if (!response.ok) {
          throw new Error(await parseKuaiChatErrorResponse(response))
        }
        return response
      },
    },
  })
}

function renderAiBubbleContent(content: unknown) {
  const text = typeof content === 'string' ? content : ''
  if (!text.trim()) return null
  return <AiAssistantMarkdown content={text} />
}

type AIAssistantDialogUIProps = {
  open: boolean
  onClose?: () => void
  displayItems: BubbleItem[]
  isLoading: boolean
  onSubmit: (question: string) => void
  onNewChat: () => void
  senderDisabled?: boolean
  welcomeHint?: React.ReactNode
  modelName?: string
}

const AIAssistantDialogUI: React.FC<AIAssistantDialogUIProps> = ({
  open,
  onClose,
  displayItems,
  isLoading,
  onSubmit,
  onNewChat,
  senderDisabled = false,
  welcomeHint,
  modelName,
}) => {
  const { t } = useTranslation()
  const promptItems = usePromptItems()
  const { token } = theme.useToken()
  const [senderValue, setSenderValue] = useState('')
  const borderBeamColor = useMemo(
    () => [
      { color: token.colorPrimary, percent: 0 },
      { color: token.colorPrimaryHover, percent: 48 },
      { color: '#69b1ff', percent: 100 },
    ],
    [token.colorPrimary, token.colorPrimaryHover],
  )

  const handleCopy = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(
      () => message.success(t('ui.aiAssistant.copySuccess')),
      () => message.error(t('ui.aiAssistant.copyFailed')),
    )
  }

  const handleRegenerate = (lastUserMessage: string) => {
    if (!lastUserMessage?.trim() || senderDisabled || isLoading) return
    onSubmit(lastUserMessage.trim())
    setSenderValue('')
  }

  const handleSenderSubmit = useCallback(
    (value: string) => {
      const q = value?.trim?.() || ''
      if (!q || senderDisabled || isLoading) return
      onSubmit(value)
      setSenderValue('')
    },
    [isLoading, onSubmit, senderDisabled],
  )

  const handleNewChatClick = () => {
    onNewChat()
    setSenderValue('')
  }

  const senderFooter = useCallback(
    (_oriNode: React.ReactNode, { components }: { components: Record<string, React.ComponentType> }) => {
      const ActionBtn = isLoading ? components.LoadingButton : components.SendButton
      return (
        <div className={`ai-qa-sender-toolbar${modelName?.trim() ? '' : ' ai-qa-sender-toolbar--end'}`}>
          {modelName?.trim() ? (
            <span className="ai-qa-sender-model" title={modelName}>
              <span className="ai-qa-sender-model-name">{modelName}</span>
              <CaretDownOutlined className="ai-qa-sender-model-caret" />
            </span>
          ) : null}
          <ActionBtn />
        </div>
      )
    },
    [isLoading, modelName],
  )

  const senderProps = useMemo(
    () => ({
      placeholder: t('ui.aiAssistant.senderPlaceholder'),
      loading: isLoading,
      disabled: senderDisabled || !open,
      value: senderValue,
      onChange: setSenderValue,
      onSubmit: handleSenderSubmit,
      suffix: false as const,
      footer: senderFooter,
      autoSize: { minRows: 3, maxRows: 8 },
    }),
    [isLoading, open, senderDisabled, senderValue, handleSenderSubmit, senderFooter, t],
  )

  const qaContent = (
    <div className="ai-qa-layout">
      <header className="ai-qa-panel-header">
        <span className="ai-qa-panel-header-title">{t('ui.aiAssistant.title')}</span>
        <div className="ai-qa-panel-header-actions">
          <span
            className="ai-qa-panel-header-beta"
            style={{
              background: token.colorPrimaryBg,
              color: token.colorPrimary,
              borderColor: token.colorPrimaryBorder,
            }}
          >
            {t('ui.aiAssistant.beta')}
          </span>
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={handleNewChatClick}
            className="ai-qa-header-icon-btn"
            aria-label={t('ui.aiAssistant.newChat')}
            title={t('ui.aiAssistant.newChat')}
          />
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            className="ai-qa-header-icon-btn"
            aria-label={t('ui.aiAssistant.close')}
            title={t('ui.aiAssistant.close')}
          />
        </div>
      </header>

      <div className="ai-qa-panel-main">
        {displayItems.length === 0 ? (
          <div className="ai-qa-welcome-screen">
            <div className="ai-qa-welcome-copy">
              <Lottie
                className="ai-qa-lottie-enhance ai-qa-welcome-hero"
                animationData={welcomeAnimation}
                loop
              />
              <div className="ai-qa-welcome-hi">{t('ui.aiAssistant.welcomeHi')}</div>
              <div className="ai-qa-welcome-title">{t('ui.aiAssistant.welcomeTitle')}</div>
              <div className="ai-qa-welcome-desc">{t('ui.aiAssistant.welcomeDesc')}</div>
              {welcomeHint}
            </div>
            {open && !senderDisabled ? (
              <div className="ai-qa-prompts-wrap">
                <Prompts
                  items={promptItems}
                  vertical
                  onItemClick={({ data }) => {
                    const label = typeof data.label === 'string' ? data.label : ''
                    if (label) handleSenderSubmit(label)
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="ai-qa-chat-scroll">
            <Bubble.List
              items={displayItems}
              autoScroll
              role={{
                ai: {
                  placement: 'start',
                  contentRender: renderAiBubbleContent,
                  styles: {
                    content: {
                      background: token.colorFillTertiary,
                      color: token.colorText,
                    },
                  },
                  avatar: (
                    <Lottie
                      className="ai-qa-lottie-enhance"
                      animationData={assistAnimation}
                      loop
                      style={{ width: 32, height: 32 }}
                    />
                  ),
                  footer: (content: unknown, info: { status?: string; extraInfo?: { lastUserMessage?: string } }) => {
                    if (info?.status === 'loading') return null
                    const lastUser = info?.extraInfo?.lastUserMessage ?? ''
                    const text = typeof content === 'string' ? content : ''
                    return (
                      <div className="ai-qa-bubble-actions">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={() => handleCopy(text)}
                          onKeyDown={e => e.key === 'Enter' && handleCopy(text)}
                          className="ai-qa-bubble-action"
                        >
                          <CopyOutlined /> {t('ui.aiAssistant.copy')}
                        </span>
                        {lastUser ? (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => handleRegenerate(lastUser)}
                            onKeyDown={e => e.key === 'Enter' && handleRegenerate(lastUser)}
                            className="ai-qa-bubble-action"
                          >
                            <ReloadOutlined /> {t('ui.aiAssistant.regenerate')}
                          </span>
                        ) : null}
                      </div>
                    )
                  },
                },
                user: {
                  placement: 'end',
                  styles: {
                    content: {
                      background: token.colorPrimary,
                      color: '#fff',
                    },
                  },
                },
              }}
            />
          </div>
        )}
      </div>

      <div className="ai-qa-composer">
        <div className="ai-qa-sender-wrap">
          <Sender {...senderProps} />
        </div>
        <p className="ai-qa-disclaimer">{t('ui.aiAssistant.disclaimer')}</p>
      </div>
    </div>
  )

  return (
    <div
      className="ai-qa-panel"
      role="dialog"
      aria-label={t('ui.aiAssistant.ariaLabel')}
      aria-modal={false}
    >
      <div className="ai-qa-panel-glow">
        <BorderBeam color={borderBeamColor}>
          <div className="ai-qa-panel-container">
            <div className="ai-qa-panel-content">
              <div className="ai-qa-panel-body ai-assistant-modal-content">{qaContent}</div>
            </div>
          </div>
        </BorderBeam>
      </div>
    </div>
  )
}

type AIAssistantLivePanelProps = {
  open: boolean
  onClose?: () => void
  model: string
}

const AIAssistantLivePanel: React.FC<AIAssistantLivePanelProps> = ({ open, onClose, model }) => {
  const { t } = useTranslation()
  const provider = useMemo(() => getKuaiChatProvider(model), [model])

  const chat = useXChat<XChatMessage, XChatMessage, Record<string, unknown>, Record<string, unknown>>({
    provider,
    conversationKey: 'riveredge-ai-assistant-qa',
    defaultMessages: [],
    requestFallback: (_requestParams, { error }) => ({
      role: 'assistant',
      content: error?.message || t('ui.aiAssistant.requestFailed'),
    }),
  })

  const bubbleItems = useMemo(() => {
    return chat.messages.map((m, i) => {
      const msg = m.message as XChatMessage
      const role = msg?.role === 'user' ? ('user' as const) : ('ai' as const)
      const content =
        role === 'ai'
          ? stripAssistantThinkContent(typeof msg?.content === 'string' ? msg.content : '')
          : typeof msg?.content === 'string'
            ? msg.content
            : ''
      const prevMsg = chat.messages[i - 1]?.message as XChatMessage | undefined
      const lastUserMessage =
        role === 'ai' && prevMsg?.role === 'user'
          ? typeof prevMsg?.content === 'string'
            ? prevMsg.content
            : ''
          : ''
      return {
        key: m.id,
        role,
        content,
        status: m.status,
        extraInfo: { ...((m.extraInfo as object) || {}), lastUserMessage },
      }
    })
  }, [chat.messages])

  const displayItems = useMemo(() => {
    if (!chat.isRequesting) return bubbleItems
    return [
      ...bubbleItems,
      {
        key: 'ai-loading',
        role: 'ai' as const,
        content: '',
        status: 'loading' as const,
        loading: true,
      },
    ]
  }, [bubbleItems, chat.isRequesting])

  const handleNewChat = () => {
    const c = chat as {
      clearMessages?: () => void
      setMessages?: (messages: []) => void
      onClear?: () => void
    }
    if (typeof c.clearMessages === 'function') c.clearMessages()
    else if (typeof c.setMessages === 'function') c.setMessages([])
    else if (typeof c.onClear === 'function') c.onClear()
  }

  const handleSubmit = (question: string) => {
    const q = question?.trim?.() || ''
    if (!q || chat.isRequesting) return
    chat.onRequest(
      {
        messages: [{ role: 'user', content: q }],
      },
      { extraInfo: {} },
    )
  }

  return (
    <AIAssistantDialogUI
      open={open}
      onClose={onClose}
      displayItems={displayItems}
      isLoading={chat.isRequesting}
      onSubmit={handleSubmit}
      onNewChat={handleNewChat}
      modelName={model}
    />
  )
}

type FallbackReason = 'preview' | 'loading' | 'unconfigured' | 'status_error'

type AIAssistantFallbackPanelProps = {
  open: boolean
  onClose?: () => void
  reason: FallbackReason
  chatStatus?: ChatIntegrationStatus | null
  statusError?: string | null
}

const AIAssistantFallbackPanel: React.FC<AIAssistantFallbackPanelProps> = ({
  open,
  onClose,
  reason,
  chatStatus,
  statusError,
}) => {
  const { t } = useTranslation()
  const [messages, setMessages] = useState<BubbleItem[]>([])
  const [loading, setLoading] = useState(false)

  const configHint = useMemo(() => {
    if (reason === 'loading') return null
    if (reason === 'status_error' && statusError) {
      return t('ui.aiAssistant.statusError', { message: statusError })
    }
    if (!chatStatus?.configured) {
      return t('ui.aiAssistant.notConfigured')
    }
    if (!chatStatus?.enabled) {
      return t('ui.aiAssistant.notEnabled')
    }
    return null
  }, [reason, chatStatus, statusError, t])

  const welcomeHint = useMemo(() => {
    if (reason === 'loading') {
      return (
        <div style={{ marginTop: 4, color: 'var(--ant-colorTextSecondary)' }}>
          <Spin size="small" style={{ marginRight: 8 }} />
          {t('ui.aiAssistant.connecting')}
        </div>
      )
    }
    if (configHint) {
      return <div style={{ marginTop: 4, color: 'var(--ant-colorWarning)' }}>{configHint}</div>
    }
    return null
  }, [reason, configHint, t])

  const handleNewChat = () => setMessages([])

  const handleSubmit = (question: string) => {
    const q = question?.trim?.() || ''
    if (!q || reason === 'loading') return

    if (configHint) {
      message.warning(configHint)
    }

    const userItem: BubbleItem = {
      key: `fallback-user-${Date.now()}`,
      role: 'user',
      content: q,
      status: 'success',
    }
    setMessages(prev => [...prev, userItem])
    setLoading(true)
    window.setTimeout(() => {
      const reply =
        reason === 'preview'
          ? t('ui.aiAssistant.previewReply')
          : configHint || t('ui.aiAssistant.notReadyReply')
      setMessages(prev => [
        ...prev,
        {
          key: `fallback-ai-${Date.now()}`,
          role: 'ai',
          content: reply,
          status: 'success',
          extraInfo: { lastUserMessage: q },
        },
      ])
      setLoading(false)
    }, 500)
  }

  const displayItems = useMemo(() => {
    if (!loading) return messages
    return [
      ...messages,
      {
        key: 'fallback-loading',
        role: 'ai' as const,
        content: '',
        status: 'loading' as const,
      },
    ]
  }, [messages, loading])

  return (
    <AIAssistantDialogUI
      open={open}
      onClose={onClose}
      displayItems={displayItems}
      isLoading={loading}
      onSubmit={handleSubmit}
      onNewChat={handleNewChat}
      senderDisabled={reason === 'loading'}
      welcomeHint={welcomeHint}
      modelName={chatStatus?.model}
    />
  )
}

type AIAssistantPanelProps = {
  open: boolean
  onClose?: () => void
  designOnly?: boolean
}

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({ open, onClose, designOnly }) => {
  const { t } = useTranslation()
  const {
    data: chatStatus,
    isPending: statusPending,
    error: statusQueryError,
  } = useChatIntegrationStatus({ enabled: designOnly !== true })

  if (designOnly === true) {
    return <AIAssistantFallbackPanel open={open} onClose={onClose} reason="preview" />
  }

  if (statusPending) {
    return <AIAssistantFallbackPanel open={open} onClose={onClose} reason="loading" />
  }

  const statusError =
    statusQueryError instanceof Error
      ? statusQueryError.message
      : statusQueryError
        ? t('ui.aiAssistant.requestError')
        : null

  if (statusError) {
    return (
      <AIAssistantFallbackPanel
        open={open}
        onClose={onClose}
        reason="status_error"
        statusError={statusError}
      />
    )
  }

  if (!chatStatus) {
    return <AIAssistantFallbackPanel open={open} onClose={onClose} reason="loading" />
  }

  if (chatStatus.configured && chatStatus.enabled) {
    return <AIAssistantLivePanel open={open} onClose={onClose} model={chatStatus.model} />
  }

  return (
    <AIAssistantFallbackPanel open={open} onClose={onClose} reason="unconfigured" chatStatus={chatStatus} />
  )
}

const AIAssistant: React.FC<AIAssistantProps> = ({ open = false, onClose, designOnly }) => {
  // 生命周期约定：Portal 常驻 + ai-qa-modal-hidden 隐藏；禁止 if (!open) return null，避免卸载触发全局样式误清理。
  const shellRef = useRef<HTMLDivElement | null>(null)
  const [styleContainer, setStyleContainer] = useState<HTMLElement | null>(null)

  const handleClose = useCallback(() => {
    blurPanelFocus(shellRef.current)
    onClose?.()
  }, [onClose])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      handleClose()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, handleClose])

  useEffect(() => {
    if (open) return
    return scheduleScrollLockRelease()
  }, [open])

  return createPortal(
    <div
      ref={node => {
        shellRef.current = node
        if (node !== styleContainer) setStyleContainer(node)
      }}
      className={`ai-qa-modal-bottom-right${open ? '' : ' ai-qa-modal-hidden'}`}
      aria-hidden={!open}
    >
      <StyleProvider cache={aiAssistantStyleCache} container={styleContainer ?? document.body}>
        <AIAssistantPanel open={open} onClose={handleClose} designOnly={designOnly} />
      </StyleProvider>
    </div>,
    document.body,
  )
}

export default AIAssistant
