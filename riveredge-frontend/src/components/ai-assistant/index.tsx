import React, { useEffect, useMemo, useState } from 'react'
import { message, Button } from 'antd'
import { CloseOutlined, CopyOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons'
import { Bubble, Prompts, Sender, Welcome, XProvider } from '@ant-design/x'
import type { PromptsItemType } from '@ant-design/x'
import { DeepSeekChatProvider, useXChat, XRequest } from '@ant-design/x-sdk'
import Lottie from 'lottie-react'
import assistAnimation from '../../../static/lottie/assist.json'
import welcomeAnimation from '../../../static/lottie/welcome.json'
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
   * 仅界面预览：不接入真实 API，用本地 mock 数据展示 Ant Design X 默认对话框样式。
   * 默认 true，先设计界面；接入 API 时改为 false。
   */
  designOnly?: boolean
}

const DEFAULT_DEEPSEEK_MODEL = 'deepseek-chat'
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'

const MSG_WELCOME_TITLE = '你好，我是 KU-AI'
const MSG_WELCOME_DESC = '可解答生产排产、设备与质量管理、上线准备、系统操作等问题。'
const MSG_WELCOME_CTA = '赶快开始提问吧～'
const SENDER_PLACEHOLDER = '按下 Enter 提交问题，Ctrl + Enter 换行'
const GLOBAL_LOCK_CLASSES = ['ant-scrolling-effect', 'ant-modal-open']
const BODY_STYLE_KEYS = ['overflow', 'overflow-y', 'padding-right', 'width', 'font-size', 'line-height'] as const
const HTML_STYLE_KEYS = ['overflow', 'overflow-y', 'font-size', 'line-height'] as const

/** 制造业向推荐问题（点击即发送） */
const PROMPT_ITEMS: PromptsItemType[] = [
  { key: 'onboard', label: '上线准备有哪些步骤？' },
  { key: 'plan', label: '如何创建或调整生产计划？' },
  { key: 'equipment', label: '设备报修/保养怎么操作？' },
  { key: 'cost', label: '如何查看成本报表？' },
]

const AIAssistant: React.FC<AIAssistantProps> = ({ open = false, onClose, designOnly = true }) => {
  useEffect(() => {
    if (!open) return

    const body = document.body
    const html = document.documentElement
    const classSnapshot = {
      body: new Set(body.classList),
      html: new Set(html.classList),
    }
    const bodyStyleSnapshot = new Map<string, string | null>()
    const htmlStyleSnapshot = new Map<string, string | null>()

    BODY_STYLE_KEYS.forEach(key => bodyStyleSnapshot.set(key, body.style.getPropertyValue(key) || null))
    HTML_STYLE_KEYS.forEach(key => htmlStyleSnapshot.set(key, html.style.getPropertyValue(key) || null))

    return () => {
      Array.from(body.classList).forEach(className => {
        if (className.startsWith('ant-') && !classSnapshot.body.has(className)) {
          body.classList.remove(className)
        }
      })
      Array.from(html.classList).forEach(className => {
        if (className.startsWith('ant-') && !classSnapshot.html.has(className)) {
          html.classList.remove(className)
        }
      })

      GLOBAL_LOCK_CLASSES.forEach(className => {
        const hadBodyClass = classSnapshot.body.has(className)
        const hadHtmlClass = classSnapshot.html.has(className)

        if (hadBodyClass) body.classList.add(className)
        else body.classList.remove(className)

        if (hadHtmlClass) html.classList.add(className)
        else html.classList.remove(className)
      })

      BODY_STYLE_KEYS.forEach(key => {
        const value = bodyStyleSnapshot.get(key) ?? null
        if (value == null || value === '') body.style.removeProperty(key)
        else body.style.setProperty(key, value)
      })
      HTML_STYLE_KEYS.forEach(key => {
        const value = htmlStyleSnapshot.get(key) ?? null
        if (value == null || value === '') html.style.removeProperty(key)
        else html.style.setProperty(key, value)
      })
    }
  }, [open])

  // 仅界面模式：本地消息列表，用于展示默认对话样式
  const [designOnlyMessages, setDesignOnlyMessages] = useState<BubbleItem[]>([])
  const [designOnlyLoading, setDesignOnlyLoading] = useState(false)

  const deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined
  const deepseekModel =
    (import.meta.env.VITE_DEEPSEEK_MODEL as string | undefined) || DEFAULT_DEEPSEEK_MODEL
  const deepseekBaseUrl =
    (import.meta.env.VITE_DEEPSEEK_BASE_URL as string | undefined) || DEFAULT_DEEPSEEK_BASE_URL

  const configError = useMemo(() => {
    if (designOnly) return null // 仅界面时不校验 API
    if (!deepseekApiKey) return '未配置 DeepSeek：请设置 VITE_DEEPSEEK_API_KEY（用于前端直连）。'
    try {
      new URL(deepseekBaseUrl)
    } catch {
      return 'VITE_DEEPSEEK_BASE_URL 不合法：请填写类似 https://api.deepseek.com/v1。'
    }
    if (!deepseekModel) return '未配置 DeepSeek：请设置 VITE_DEEPSEEK_MODEL。'
    return null
  }, [designOnly, deepseekApiKey, deepseekBaseUrl, deepseekModel])

  const provider = useMemo(() => {
    if (configError || designOnly) return undefined
    return new DeepSeekChatProvider<XChatMessage, any, any>({
      request: XRequest(`${deepseekBaseUrl.replace(/\/$/, '')}/chat/completions`, {
        manual: true,
        headers: {
          Authorization: `Bearer ${deepseekApiKey}`,
        },
        params: {
          model: deepseekModel,
          stream: false,
          temperature: 0.7,
        },
      }),
    })
  }, [configError, designOnly, deepseekApiKey, deepseekBaseUrl, deepseekModel])

  const chat = useXChat<XChatMessage, XChatMessage, any, any>({
    provider: provider ?? undefined,
    conversationKey: 'riveredge-ai-assistant-qa',
    defaultMessages: designOnly
      ? undefined
      : [{ message: { role: 'assistant', content: '你好，有什么可以帮你的？' } }],
  })

  const bubbleItemsFromChat = useMemo(() => {
    return chat.messages.map((m, i) => {
      const msg = m.message as XChatMessage
      const content = typeof msg?.content === 'string' ? msg.content : ''
      const role = msg?.role === 'user' ? ('user' as const) : ('ai' as const)
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

  const bubbleItems = designOnly ? designOnlyMessages : bubbleItemsFromChat
  const isLoading = designOnly ? designOnlyLoading : chat.isRequesting

  const handleNewChat = () => {
    if (designOnly) {
      setDesignOnlyMessages([])
    } else {
      const c = chat as any
      if (typeof c.clearMessages === 'function') c.clearMessages()
      else if (typeof c.setMessages === 'function') c.setMessages([])
      else if (typeof c.onClear === 'function') c.onClear()
    }
  }

  const handleSubmit = (question: string) => {
    const q = question?.trim?.() || ''
    if (!q) return

    if (designOnly) {
      const userItem: BubbleItem = {
        key: `design-user-${Date.now()}`,
        role: 'user',
        content: q,
        status: 'success',
      }
      setDesignOnlyMessages(prev => [...prev, userItem])
      setDesignOnlyLoading(true)
      setTimeout(() => {
        const aiItem: BubbleItem = {
          key: `design-ai-${Date.now()}`,
          role: 'ai',
          content: '（当前为界面预览，未接入 API。此处为占位回复。）',
          status: 'success',
          extraInfo: { lastUserMessage: q },
        }
        setDesignOnlyMessages(prev => [...prev, aiItem])
        setDesignOnlyLoading(false)
      }, 600)
      return
    }

    if (configError) {
      message.error(configError)
      return
    }

    chat.onRequest(
      {
        messages: [{ role: 'user', content: q }],
      } as any,
      { extraInfo: {} }
    )
  }

  const displayItems = useMemo(() => {
    if (!isLoading) return bubbleItems
    const loadingItem: BubbleItem & { loading?: boolean } = {
      key: 'ai-loading',
      role: 'ai',
      content: '',
      status: 'loading',
      loading: true,
    }
    return [...bubbleItems, loadingItem]
  }, [bubbleItems, isLoading])

  const handleCopy = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(
      () => message.success('已复制'),
      () => message.error('复制失败')
    )
  }

  const handleRegenerate = (lastUserMessage: string) => {
    if (lastUserMessage?.trim()) handleSubmit(lastUserMessage.trim())
  }

  const qaContent = (
    <div
      className="ai-qa-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        height: '100%',
      }}
    >
      {/* 左上角 普通开始新对话按钮（仅当有对话内容时显示，带浅灰色背景） */}
      {displayItems.length > 0 && (
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={handleNewChat}
          style={{
            position: 'absolute',
            top: 8,
            left: 12,
            zIndex: 100,
            color: 'var(--ant-colorTextSecondary)',
            backgroundColor: 'var(--ant-colorFillAlter)',
            padding: '4px 12px',
          }}
        >
          新对话
        </Button>
      )}
      {/* 悬浮关闭按钮 */}
      <span
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={e => e.key === 'Enter' && onClose?.()}
        className="ai-qa-fancy-close"
        aria-label="关闭"
      >
        <CloseOutlined style={{ fontSize: 16 }} />
      </span>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {displayItems.length === 0 ? (
          <>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto',
              }}
            >
              <Welcome
                variant="borderless"
                icon={<Lottie className="ai-qa-lottie-enhance" animationData={welcomeAnimation} loop style={{ width: 96, height: 96 }} />}
                title={MSG_WELCOME_TITLE}
                description={
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ color: 'var(--ant-colorTextSecondary)' }}>{MSG_WELCOME_DESC}</div>
                    <div className="ai-qa-welcome-cta">{MSG_WELCOME_CTA}</div>
                  </div>
                }
                style={{
                  flexShrink: 0,
                  padding: '16px 20px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
                styles={{
                  title: { marginTop: 40, marginBottom: 8, fontSize: 22, fontWeight: 600, whiteSpace: 'nowrap' },
                  description: { fontSize: 13, lineHeight: 1.5 },
                }}
              />
              <div className="ai-qa-prompts-wrap">
                <Prompts
                  items={PROMPT_ITEMS}
                  wrap
                  onItemClick={({ data }) => {
                    const label = typeof data.label === 'string' ? data.label : ''
                    if (label) handleSubmit(label)
                  }}
                  style={{ flexShrink: 0, marginTop: 8, marginBottom: 12 }}
                />
              </div>
            </div>
            <div className="ai-qa-sender-wrap">
              <Sender
                placeholder={SENDER_PLACEHOLDER}
                loading={isLoading}
                onSubmit={value => handleSubmit(value)}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Bubble.List
                items={displayItems}
                autoScroll
                role={{
                  ai: {
                    placement: 'start',
                    avatar: <Lottie className="ai-qa-lottie-enhance" animationData={assistAnimation} loop style={{ width: 32, height: 32 }} />,
                    footer: (content: any, info: any) => {
                      if (info?.status === 'loading') return null
                      const lastUser =
                        (info?.extraInfo as { lastUserMessage?: string })?.lastUserMessage ?? ''
                      return (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 12 }}>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => handleCopy(typeof content === 'string' ? content : '')}
                            onKeyDown={e =>
                              e.key === 'Enter' &&
                              handleCopy(typeof content === 'string' ? content : '')
                            }
                            style={{ cursor: 'pointer', color: 'var(--ant-colorTextSecondary)' }}
                          >
                            <CopyOutlined /> 复制
                          </span>
                          {lastUser && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={() => handleRegenerate(lastUser)}
                              onKeyDown={e => e.key === 'Enter' && handleRegenerate(lastUser)}
                              style={{ cursor: 'pointer', color: 'var(--ant-colorTextSecondary)' }}
                            >
                              <ReloadOutlined /> 重新生成
                            </span>
                          )}
                        </div>
                      )
                    },
                  },
                  user: { placement: 'end' },
                }}
              />
            </div>
            <div className="ai-qa-sender-wrap">
              <Sender
                placeholder={SENDER_PLACEHOLDER}
                loading={isLoading}
                onSubmit={value => handleSubmit(value)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )

  return (
    open ? (
      <div className="ai-qa-modal-bottom-right">
        <div className="ai-qa-panel" role="dialog" aria-label="AI 助手" aria-modal={false}>
          <div className="ai-qa-panel-container">
            <div className="ai-qa-panel-content">
              <div className="ai-qa-panel-body ai-assistant-modal-content">
                <XProvider>{qaContent}</XProvider>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null
  )
}

export default AIAssistant
