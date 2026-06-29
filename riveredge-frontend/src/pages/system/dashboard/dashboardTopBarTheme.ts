/** ① 问候卡：整面基于主题色 `colorPrimary`（浅色实心 / 深色略压暗的渐变，避免硬编码固定色相） */
export function dashboardTopBarUserCardBackground(primary: string, isDark: boolean) {
  if (isDark) {
    return `linear-gradient(135deg, color-mix(in srgb, ${primary} 88%, black) 0%, color-mix(in srgb, ${primary} 58%, black) 100%)`;
  }
  return primary;
}

/** 获取顶栏卡片背景渐变 */
export function getDashboardTopBarTheme(isDark: boolean) {
  return {
    /** ③ 工业工具 */
    toolkitCardBackground: isDark
      ? 'linear-gradient(180deg, #27272a 0%, #18181b 100%)'
      : 'linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)',

    /** 工具展开托盘 */
    toolkitTrayBackground: isDark
      ? 'linear-gradient(180deg, #18181b 0%, #141416 100%)'
      : 'linear-gradient(180deg, #f4f4f5 0%, #f0f0f2 100%)',

    /** ④ 时钟外框 */
    clockCardBackground: isDark
      ? 'linear-gradient(180deg, #1c1c1c 0%, #111111 100%)'
      : 'linear-gradient(180deg, #fafaf9 0%, #f4f4f5 100%)',

    /** 文本与状态颜色 */
    textColor: isDark ? 'rgba(255, 255, 255, 0.85)' : '#18181b',
    textSecondaryColor: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(24, 24, 27, 0.45)',
    textMutedColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(24, 24, 27, 0.35)',
    itemHoverBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(24, 24, 27, 0.04)',
    itemActiveBg: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(24, 24, 27, 0.08)',
  } as const;
}

export const dashboardTopBarTheme = getDashboardTopBarTheme(false);



