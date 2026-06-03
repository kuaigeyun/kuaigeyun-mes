import type { ThemeConfig } from 'antd';
import { HMI_DESIGN_TOKENS } from './design';
import { HMI_TOUCH } from './touch';

export const HMI_ANTD_TOKEN_OVERRIDE = {
  colorPrimary: '#1677ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  colorBgLayout: HMI_DESIGN_TOKENS.BG_PRIMARY,
  colorBgContainer: HMI_DESIGN_TOKENS.BG_CARD,
  colorBorder: HMI_DESIGN_TOKENS.BORDER,
  colorText: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
  colorTextSecondary: HMI_DESIGN_TOKENS.TEXT_SECONDARY,
  colorTextTertiary: HMI_DESIGN_TOKENS.TEXT_TERTIARY,
  borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
  fontSize: 14,
  fontSizeLG: 16,
  fontSizeXL: 20,
  fontSizeHeading1: 38,
  fontSizeHeading2: 30,
  fontSizeHeading3: 24,
} as const;

/** 触屏终端 ConfigProvider 主题（与主站共用 antd 组件） */
export function createHmiTheme(overrides?: ThemeConfig): ThemeConfig {
  return {
    token: {
      ...HMI_ANTD_TOKEN_OVERRIDE,
      colorBgElevated: '#0f2847',
      colorTextPlaceholder: HMI_DESIGN_TOKENS.TEXT_TERTIARY,
      ...overrides?.token,
    },
    components: {
      Select: {
        selectorBg: HMI_DESIGN_TOKENS.BG_ELEVATED,
        colorBgElevated: '#0f2847',
        optionSelectedBg: 'rgba(22, 119, 255, 0.35)',
        optionActiveBg: 'rgba(255, 255, 255, 0.1)',
        colorText: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
        colorTextQuaternary: HMI_DESIGN_TOKENS.TEXT_TERTIARY,
      },
      Form: {
        labelColor: 'rgba(255, 255, 255, 0.85)',
      },
      Button: {
        defaultBg: HMI_DESIGN_TOKENS.BG_ELEVATED,
        defaultColor: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
        defaultBorderColor: HMI_DESIGN_TOKENS.BORDER,
        controlHeight: HMI_TOUCH.ACTION_BTN_HEIGHT,
        controlHeightLG: HMI_TOUCH.PRIMARY_BTN_HEIGHT,
        fontSizeLG: 18,
      },
      ...overrides?.components,
    },
    ...overrides,
  };
}
