/**
 * 运行模式配置
 * 
 * 统一使用 SaaS 模式
 * 单体部署本质上就是只有 app，没有新建其他租户应用
 */

/**
 * 当前运行模式（统一为 SaaS）
 */
export const MODE = 'saas' as const

/**
 * 是否为单体模式（已废弃，统一使用 SaaS）
 */
export const IS_MONOLITHIC = false

/**
 * 是否为 SaaS 模式
 */
export const IS_SAAS = true

/**
 * 运行模式配置
 */
export const MODE_CONFIG = {
  mode: MODE,
  isMonolithic: IS_MONOLITHIC,
  isSaas: IS_SAAS,
} as const

/**
 * 获取运行模式信息（用于调试）
 */
export const getModeInfo = () => {
  return {
    mode: MODE,
    isMonolithic: IS_MONOLITHIC,
    isSaas: IS_SAAS,
    description: 'SaaS 模式：统一使用 SaaS 模式，单体部署本质上就是只有 maintree',
  }
}

