/**
 * 统一分段控制器主题：通过 ConfigProvider 的组件 token 设置选中态，
 * 与 thumb 动画同源，避免手写 .item-selected 样式在切换后失效。
 */

import React, { useMemo } from 'react';
import { ConfigProvider, Segmented, theme } from 'antd';
import type { SegmentedProps } from 'antd';
import type { ThemeConfig } from 'antd/es/config-provider/context';

export function useSegmentedComponentTheme(): ThemeConfig {
  const { token } = theme.useToken();
  return useMemo(
    () => ({
      components: {
        Segmented: {
          trackBg: token.colorFillSecondary,
          itemColor: token.colorTextSecondary,
          itemHoverColor: token.colorText,
          /** 选中态：实心主题色 + 浅色文字（与 thumb 同源 token，切换不丢样式） */
          itemSelectedBg: token.colorPrimary,
          itemSelectedColor: token.colorTextLightSolid,
        },
      },
    }),
    [
      token.colorFillSecondary,
      token.colorTextSecondary,
      token.colorText,
      token.colorPrimary,
      token.colorTextLightSolid,
    ]
  );
}

export const ThemedSegmented = React.forwardRef<HTMLDivElement, SegmentedProps>((props, ref) => {
  const segmentedTheme = useSegmentedComponentTheme();
  return (
    <ConfigProvider theme={segmentedTheme}>
      <Segmented ref={ref} {...props} />
    </ConfigProvider>
  );
});

ThemedSegmented.displayName = 'ThemedSegmented';
