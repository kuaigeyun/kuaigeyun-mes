/**
 * 金额显示组件
 *
 * 根据用户是否具有查看金额的权限，决定显示真实金额还是经过掩码处理的内容。
 *
 * @author Antigravity
 * @date 2026-02-19
 */

import React from 'react'
import { Tooltip } from 'antd'
import { useGlobalStore } from '../../stores/globalStore'
import { LockOutlined } from '@ant-design/icons'
import { hasPermission } from '../../utils/permission'
import { formatNumber } from '../../utils/format'

export interface AmountDisplayProps {
  /** 资源名称（如：sales_order, purchase_order） */
  resource: string
  /** 金额数值 */
  value: number | null | undefined
  /** 小数位数（默认 2） */
  decimals?: number
  /** 前缀（如：¥） */
  prefix?: string
  /** 后缀（如：元） */
  suffix?: string
  /** 无权限时的替代文本（默认 '***'） */
  maskText?: string
  /** 是否在掩码状态下显示提示 */
  maskTooltip?: string
  /** 自定义样式 */
  style?: React.CSSProperties
  /** 自定义类名 */
  className?: string
}

/**
 * 金额显示组件
 */
export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  resource,
  value,
  decimals = 2,
  prefix = '¥',
  suffix = '',
  maskText = '***',
  maskTooltip = '无权限查看金额',
  style,
  className,
}) => {
  const currentUser = useGlobalStore((s) => s.currentUser)

  // 检查对应的字段级权限
  const permissionCode = `${resource}:view:amount`
  const hasAccess = hasPermission(currentUser, permissionCode)

  if (!hasAccess) {
    return (
      <Tooltip title={maskTooltip}>
        <span
          className={className}
          style={{ color: 'rgba(0, 0, 0, 0.45)', cursor: 'help', ...style }}
        >
          {prefix}
          {maskText}
          {suffix} <LockOutlined style={{ fontSize: '10px' }} />
        </span>
      </Tooltip>
    )
  }

  const formattedValue = formatNumber(value, decimals)

  return (
    <span className={className} style={style}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  )
}

export default AmountDisplay
