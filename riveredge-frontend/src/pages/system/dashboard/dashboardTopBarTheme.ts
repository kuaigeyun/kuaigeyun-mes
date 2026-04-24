/**
 * 工作台首行：问候卡为纯色主题底 + 白字（与参考一致，无渐变）；其余卡仍为 zinc。
 */

/** ① 问候卡：整面 `colorPrimary`，扁平 */
export function dashboardTopBarUserCardBackground(primary: string) {
  return primary;
}

/** 问候卡：浅白描边，压在主色上 */
export const dashboardTopBarUserCardOuterBorder = '1px solid rgba(255, 255, 255, 0.22)';

export const dashboardTopBarTheme = {
  /** ③ 工业工具 */
  toolkitCardBackground: 'linear-gradient(180deg, #fafafa 0%, #f4f4f5 100%)',

  /** 工具展开托盘 */
  toolkitTrayBackground: 'linear-gradient(180deg, #f4f4f5 0%, #e4e4e7 100%)',

  /** ④ 时钟外框 */
  clockCardBackground: 'linear-gradient(180deg, #fafaf9 0%, #f4f4f5 100%)',
  clockCardBorder: '1px solid rgba(24, 24, 27, 0.08)',
  clockCardShadow: '0 1px 2px rgba(24, 24, 27, 0.04), 0 10px 28px rgba(24, 24, 27, 0.07)',
} as const;
