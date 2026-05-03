/**
 * 详情抽屉与其它右侧 Drawer 统一的「悬浮卡片」外边距与主题圆角（与 DRAWER_CONFIG.FLOAT_MARGIN 对齐）
 */

import type { CSSProperties } from 'react';
import type { DrawerProps } from 'antd';
import { DRAWER_CONFIG } from './constants';

export interface DrawerFloatingChromeToken {
  borderRadiusLG: number;
  boxShadowSecondary: string;
}

export function getDrawerFloatingWrapperStyle(
  placement: DrawerProps['placement'] | undefined,
  token: DrawerFloatingChromeToken,
  options?: { disabled?: boolean; margin?: number }
): CSSProperties {
  if (options?.disabled) return {};
  const m = options?.margin ?? DRAWER_CONFIG.FLOAT_MARGIN;
  const resolvedPlacement = placement ?? 'right';
  const chrome: CSSProperties = {
    borderRadius: token.borderRadiusLG,
    overflow: 'hidden',
    boxShadow: token.boxShadowSecondary,
  };
  switch (resolvedPlacement) {
    case 'top':
      return { ...chrome, marginTop: m, marginLeft: m, marginRight: m };
    case 'bottom':
      return { ...chrome, marginBottom: m, marginLeft: m, marginRight: m };
    case 'left':
      return { ...chrome, marginTop: m, marginBottom: m, marginLeft: m };
    case 'right':
    default:
      return { ...chrome, marginTop: m, marginBottom: m, marginRight: m };
  }
}
