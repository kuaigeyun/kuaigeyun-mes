import type { ThemeConfig } from 'antd';
import { HMI_DESIGN_TOKENS } from './design';
import { HMI_TOUCH } from './touch';

export const HMI_ANTD_TOKEN_OVERRIDE = {
  colorPrimary: HMI_DESIGN_TOKENS.STATUS_INFO,
  colorSuccess: HMI_DESIGN_TOKENS.STATUS_OK,
  colorWarning: HMI_DESIGN_TOKENS.STATUS_WARNING,
  colorError: HMI_DESIGN_TOKENS.STATUS_ALARM,
  colorBgLayout: HMI_DESIGN_TOKENS.BG_PRIMARY,
  colorBgContainer: HMI_DESIGN_TOKENS.BG_PANEL,
  colorBorder: HMI_DESIGN_TOKENS.BORDER,
  colorText: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
  colorTextSecondary: HMI_DESIGN_TOKENS.TEXT_SECONDARY,
  colorTextTertiary: HMI_DESIGN_TOKENS.TEXT_TERTIARY,
  borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
  fontSize: HMI_DESIGN_TOKENS.FONT_BODY,
  fontSizeLG: 20,
  fontSizeXL: 24,
  fontSizeHeading1: HMI_DESIGN_TOKENS.FONT_TITLE_MIN,
  fontSizeHeading2: HMI_DESIGN_TOKENS.FONT_FIGURE,
  fontSizeHeading3: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
} as const;

/** 触屏终端 ConfigProvider 主题（与主站共用 antd 组件） */
export function createHmiTheme(overrides?: ThemeConfig): ThemeConfig {
  return {
    token: {
      ...HMI_ANTD_TOKEN_OVERRIDE,
      colorBgElevated: HMI_DESIGN_TOKENS.BG_FLOAT,
      colorTextPlaceholder: HMI_DESIGN_TOKENS.TEXT_TERTIARY,
      ...overrides?.token,
    },
    components: {
      Select: {
        selectorBg: HMI_DESIGN_TOKENS.BG_ELEVATED,
        colorBgElevated: HMI_DESIGN_TOKENS.BG_FLOAT,
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
        fontSizeLG: HMI_DESIGN_TOKENS.FONT_BODY_MIN,
        borderRadius: HMI_DESIGN_TOKENS.PANEL_RADIUS,
      },
      ...overrides?.components,
    },
    ...overrides,
  };
}
