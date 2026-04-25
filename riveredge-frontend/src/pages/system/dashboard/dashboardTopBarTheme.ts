/** ① 问候卡：整面 `colorPrimary` */
export function dashboardTopBarUserCardBackground(primary: string, isDark: boolean) {
  if (isDark) {
    // 深色模式下使用稍微深一点且带有质感的渐变红
    return `linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)`;
  }
  return primary;
}

/** 统一顶栏卡片外边框 */
export function getDashboardTopBarCardBorder(isDark: boolean) {
  return isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)';
}

/** 统一顶栏卡片阴影 */
export function getDashboardTopBarCardShadow(isDark: boolean) {
  return isDark
    ? '0 4px 24px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2)'
    : '0 2px 12px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)';
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
    clockCardBorder: getDashboardTopBarCardBorder(isDark),
    clockCardShadow: getDashboardTopBarCardShadow(isDark),

    /** 文本与状态颜色 */
    textColor: isDark ? 'rgba(255, 255, 255, 0.85)' : '#18181b',
    textSecondaryColor: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(24, 24, 27, 0.45)',
    textMutedColor: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(24, 24, 27, 0.35)',
    itemHoverBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(24, 24, 27, 0.04)',
    itemActiveBg: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(24, 24, 27, 0.08)',
    itemBorder: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(24, 24, 27, 0.08)',
  } as const;
}

/** 遗留兼容项（建议后续替换为函数调用） */
export const dashboardTopBarCardBorder = '1px solid rgba(0, 0, 0, 0.08)';
export const dashboardTopBarCardShadow = '0 2px 12px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)';
export const dashboardTopBarUserCardOuterBorder = dashboardTopBarCardBorder;
export const dashboardTopBarTheme = getDashboardTopBarTheme(false);



