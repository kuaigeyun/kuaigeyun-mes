/**
 * 编号 + 复制：布局与交互说明
 *
 * **抖动根因（已避免）**：
 * 1. `Typography.Text` 的 `ellipsis` 使用 ResizeObserver，首帧后重测宽度 → 明显「跳一下」。
 * 2. 复制区在 `order_code` 从空到有值时才挂载 → 整行宽度突变。
 *
 * **策略**：
 * - 文本截断：纯 CSS（`overflow` + `text-overflow`），无 JS 测量。
 * - 复制区：固定 22×22px，无内容时 `visibility: hidden` 仍占位，与数据是否到达无关。
 * - 样式仅 `copyable-code.module.css` + 本文件内联无布局逻辑。
 */

import React, { useCallback } from 'react'
import { App } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'

import styles from './copyable-code.module.css'

export interface CopyableCodeProps {
  code?: string | number | null
  placeholder?: string
  tooltip?: string
  successMessage?: string
  errorMessage?: string
  /** @deprecated 无作用，保留防破坏已有调用 */
  gap?: number
  /** @deprecated 无作用 */
  iconSize?: number
  className?: string
  style?: React.CSSProperties
  /**
   * 为 true 时单行省略并 `title` 展示全文；为 false 时不截断（列很宽时可用）
   * @default true
   */
  ellipsis?: boolean
}

export const CopyableCode: React.FC<CopyableCodeProps> = ({
  code,
  placeholder = '-',
  tooltip,
  successMessage,
  errorMessage,
  className,
  style,
  ellipsis = true,
}) => {
  const { t } = useTranslation()
  const { message } = App.useApp()

  const text = code == null || code === '' ? '' : String(code)
  const display = text || placeholder

  const copyTip = tooltip ?? t('field.invitationCode.copy')
  const ok = successMessage ?? t('common.copySuccess')
  const fail = errorMessage ?? t('common.copyFailed')

  const onCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!text) return
      const p = navigator.clipboard?.writeText(text)
      if (p && typeof p.then === 'function') {
        p.then(() => message.success(ok), () => message.error(fail))
      } else {
        message.success(ok)
      }
    },
    [text, message, ok, fail],
  )

  const rootClass = [styles.wrap, className].filter(Boolean).join(' ')

  return (
    <div className={rootClass} style={style} onClick={(e) => e.stopPropagation()}>
      <span
        className={ellipsis ? styles.text : styles.textPlain}
        title={ellipsis ? display : undefined}
      >
        {display}
      </span>
      <button
        type="button"
        className={`${styles.copyBtn} ${!text ? styles.copyBtnHidden : ''}`}
        aria-label={copyTip}
        title={copyTip}
        tabIndex={text ? 0 : -1}
        aria-hidden={!text}
        onClick={onCopy}
      >
        <CopyOutlined className={styles.copyIcon} />
      </button>
    </div>
  )
}

export default CopyableCode
