/**
 * 金额显示组件
 *
 * 优先按角色「字段权限」策略（明文/脱敏/隐藏）展示；
 * 无字段策略时回退 kuaizhizao:pricing:view 等历史金额可见权限。
 */

import React from 'react'
import { Tooltip } from 'antd'
import { useGlobalStore } from '../../stores/globalStore'
import { LockOutlined } from '@ant-design/icons'
import { canViewKuaizhizaoPricing } from '../../utils/kuaizhizaoPricingPermission'
import { resolveAmountFieldVisibility } from '../../utils/fieldMaskPermission'
import { useUserFieldMasks } from '../../hooks/useUserFieldMasks'
import { formatNumber } from '../../utils/format'

export interface AmountDisplayProps {
  /** 业务资源键（如 kuaizhizao:quotation）；与角色字段权限 resource 一致 */
  resource?: string
  /** 字段 canonical 名（如 tax_amount、unit_price、amount_without_tax） */
  fieldName?: string
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

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  resource,
  fieldName,
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
  const fieldMasks = useUserFieldMasks()
  const legacyResource = resource?.includes(':') ? undefined : resource
  const hasLegacyPricingAccess = canViewKuaizhizaoPricing(currentUser, legacyResource)
  const visibility = resolveAmountFieldVisibility(fieldMasks, resource, fieldName, hasLegacyPricingAccess)

  if (visibility === 'hide') {
    return (
      <span className={className} style={{ color: 'rgba(0, 0, 0, 0.25)', ...style }}>
        —
      </span>
    )
  }

  if (visibility === 'mask') {
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
