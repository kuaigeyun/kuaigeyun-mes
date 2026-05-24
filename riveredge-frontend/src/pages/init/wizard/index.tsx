/**
 * 初始化向导页面（已废弃交互，自动应用默认设置并跳转首页）
 *
 * Author: Luigi Lu
 * Date: 2025-01-15
 */

import React, { useEffect } from 'react'
import { Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getInitSteps } from '../../../services/init-wizard'
import { getTenantId } from '../../../utils/auth'
import { getDefaultTenantHomePath } from '../../../stores/configStore'

/**
 * 访问 /init/wizard 时静默完成默认初始化并进入首页，不再展示向导弹窗
 */
const InitWizardPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tenantId = getTenantId()

  useEffect(() => {
    if (!tenantId) return

    let cancelled = false
    const goHome = () => {
      if (!cancelled) {
        navigate(getDefaultTenantHomePath(), { replace: true })
      }
    }

    void getInitSteps(tenantId).finally(goHome)
    return () => {
      cancelled = true
    }
  }, [tenantId, navigate])

  if (!tenantId) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p>{t('pages.init.wizard.noTenantId')}</p>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Spin size="large" />
    </div>
  )
}

export default InitWizardPage
