import React, { memo, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

type AiAssistantMarkdownProps = {
  content: string
}

const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="ai-qa-markdown-table-wrap">
      <table>{children}</table>
    </div>
  ),
}

function AiAssistantMarkdown({ content }: AiAssistantMarkdownProps) {
  const trimmed = content.trim()
  const plugins = useMemo(() => [remarkGfm], [])

  if (!trimmed) return null

  return (
    <div className="ai-qa-markdown">
      <ReactMarkdown remarkPlugins={plugins} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default memo(AiAssistantMarkdown)
