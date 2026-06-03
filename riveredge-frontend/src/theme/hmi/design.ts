/**
 * 工业触屏终端设计 Token（ISA-101 风格）
 */
export const HMI_DESIGN_TOKENS = {
  STATUS_OK: '#00C853',
  STATUS_WARNING: '#FFB300',
  STATUS_ALARM: '#D32F2F',
  STATUS_INFO: '#1677ff',
  TOUCH_MIN_SIZE: 48,
  FONT_BODY_MIN: 20,
  FONT_TITLE_MIN: 28,
  FONT_CARD_HEADER: 20,
  CARD_HEADER_ICON_SIZE: 18,
  FONT_FIGURE: 26,
  FONT_FAMILY:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",
  BG_PRIMARY: '#000814',
  BG_CARD: 'rgba(255, 255, 255, 0.05)',
  BG_ELEVATED: 'rgba(255, 255, 255, 0.08)',
  HEADER_FLOATING_BG:
    'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)',
  BORDER: 'rgba(255, 255, 255, 0.15)',
  TEXT_PRIMARY: '#ffffff',
  TEXT_SECONDARY: 'rgba(255, 255, 255, 0.65)',
  TEXT_TERTIARY: 'rgba(255, 255, 255, 0.45)',
  CONTAINER_RADIUS: 8,
  CONTAINER_BORDER: '1px solid rgba(255, 255, 255, 0.08)',
  CONTAINER_SHADOW: '0 2px 12px rgba(0, 0, 0, 0.25)',
  PANEL_RADIUS: 8,
  SECTION_GAP: 24,
  PANEL_PADDING: 24,
  LIST_CARD_PADDING: 12,
  LIST_CARD_GAP: 6,
  LIST_CARD_BG: 'rgba(255, 255, 255, 0.04)',
  LIST_CARD_SELECTED_BG: 'rgba(0, 200, 83, 0.15)',
  STATUS_BADGE: {
    draft: { bg: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' },
    released: { bg: 'rgba(22,119,255,0.3)', color: '#90caff' },
    pending: { bg: 'rgba(22,119,255,0.3)', color: '#90caff' },
    in_progress: { bg: 'rgba(255,179,0,0.35)', color: '#ffe58f' },
    processing: { bg: 'rgba(255,179,0,0.35)', color: '#ffe58f' },
    completed: { bg: 'rgba(0,200,83,0.35)', color: '#95de64' },
    cancelled: { bg: 'rgba(211,47,47,0.35)', color: '#ff7875' },
    default: { bg: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' },
  } as const,
  BUTTON_GAP: 20,
  BUTTON_PADDING_PRIMARY: 28,
  BUTTON_PADDING_SECONDARY: 24,
  BG_GRADIENT_MAIN:
    'linear-gradient(180deg, #0f2847 0%, #0a1f3c 40%, #061428 70%, #000814 100%)',
  BG_GRADIENT_SIDEBAR:
    'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
  PANEL_GLOW: '0 0 40px rgba(22,119,255,0.06), 0 4px 24px rgba(0,0,0,0.2)',
  PANEL_FROSTED: 'rgba(0,8,20,0.75)',
  CARD_SHADOW: '0 4px 16px rgba(0,0,0,0.2)',
  BTN_PRIMARY_SHADOW: '0 4px 14px rgba(22,119,255,0.35)',
  BTN_SUCCESS_SHADOW: '0 4px 14px rgba(0,200,83,0.3)',
} as const;

export type HmiStatusKey = keyof typeof HMI_DESIGN_TOKENS.STATUS_BADGE;
