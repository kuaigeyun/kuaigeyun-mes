/**
 * 统一分段控制器主题：通过 ConfigProvider 的组件 token 设置选中态，
 * 与 thumb 动画同源，避免手写 .item-selected 样式在切换后失效。
 */

import React, { useMemo } from 'react';
import { ConfigProvider, Segmented, theme } from 'antd';
import type { SegmentedProps } from 'antd';
import type { ThemeConfig } from 'antd/es/config-provider/context';
import {
  getUniToolbarControlShellStyle,
  UNI_TOOLBAR_SEGMENTED_CLASS,
} from '../uni-search/toolbarChrome';

export type ThemedSegmentedProps = SegmentedProps & {
  /** 轨道使用卡片白底（colorBgContainer），适合灰底工具栏上的分段选择 */
  surfaceBackground?: boolean;
};

export function useSegmentedComponentTheme(options?: { surfaceBackground?: boolean }): ThemeConfig {
  const { token } = theme.useToken();
  const surfaceBackground = options?.surfaceBackground ?? false;
  return useMemo(
    () => ({
      components: {
        Segmented: {
          trackBg: surfaceBackground ? 'transparent' : token.colorFillSecondary,
          trackPadding: surfaceBackground ? 2 : undefined,
          itemColor: token.colorTextSecondary,
          itemHoverColor: token.colorText,
          itemHoverBg: surfaceBackground ? token.colorFillTertiary : undefined,
          /** 选中态：实心主题色 + 浅色文字（与 thumb 同源 token，切换不丢样式） */
          itemSelectedBg: token.colorPrimary,
          itemSelectedColor: token.colorTextLightSolid,
        },
      },
    }),
    [
      surfaceBackground,
      token.colorBgContainer,
      token.colorFillSecondary,
      token.colorFillTertiary,
      token.colorTextSecondary,
      token.colorText,
      token.colorPrimary,
      token.colorTextLightSolid,
    ]
  );
}

export const ThemedSegmented = React.forwardRef<HTMLDivElement, ThemedSegmentedProps>(
  ({ surfaceBackground, style, className, ...props }, ref) => {
    const { token } = theme.useToken();
    const segmentedTheme = useSegmentedComponentTheme({ surfaceBackground });
    return (
      <ConfigProvider theme={segmentedTheme}>
        <Segmented
          ref={ref}
          className={
            surfaceBackground
              ? [UNI_TOOLBAR_SEGMENTED_CLASS, className].filter(Boolean).join(' ')
              : className
          }
          style={
            surfaceBackground
              ? {
                  ...getUniToolbarControlShellStyle(token),
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 2,
                  ...style,
                }
              : style
          }
          {...props}
        />
      </ConfigProvider>
    );
  }
);

ThemedSegmented.displayName = 'ThemedSegmented';
