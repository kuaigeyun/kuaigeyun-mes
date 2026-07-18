/**
 * 工业触屏终端设计 Token（精炼深色工业风）
 * 与 riveredge-app-station/src/hmi/tokens/design.ts 保持同值，避免漂移
 */
export const HMI_DESIGN_TOKENS = {
  STATUS_OK: '#00C853',
  STATUS_WARNING: '#FFB300',
  STATUS_ALARM: '#D32F2F',
  STATUS_INFO: '#1677ff',
  STATUS_IDLE: 'rgba(255, 255, 255, 0.55)',
  STATUS_ANDON_EQUIPMENT: '#FF5722',

  TOUCH_MIN_SIZE: 48,

  FONT_CAPTION: 14,
  FONT_SECONDARY: 16,
  FONT_BODY: 18,
  FONT_BODY_MIN: 22,
  FONT_LIST: 22,
  FONT_CARD_HEADER: 22,
  FONT_FIGURE: 28,
  FONT_TITLE_MIN: 32,
  CARD_HEADER_ICON_SIZE: 20,
  FONT_FAMILY:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif",

  BG_PRIMARY: '#0e141d',
  BG_PANEL: '#151d29',
  BG_FLOAT: '#1c2634',
  BG_CARD: '#151d29',
  BG_ELEVATED: '#1c2634',

  BORDER: 'rgba(255, 255, 255, 0.12)',
  TEXT_PRIMARY: '#ffffff',
  TEXT_SECONDARY: 'rgba(255, 255, 255, 0.65)',
  TEXT_TERTIARY: 'rgba(255, 255, 255, 0.45)',

  RADIUS_CHIP: 2,
  CONTAINER_RADIUS: 4,
  PANEL_RADIUS: 4,
  CONTAINER_BORDER: '1px solid rgba(255, 255, 255, 0.12)',
  CONTAINER_SHADOW: '0 2px 8px rgba(0, 0, 0, 0.3)',
  CARD_SHADOW: '0 2px 8px rgba(0, 0, 0, 0.3)',

  SECTION_GAP: 16,
  PANEL_PADDING: 16,
  LIST_CARD_PADDING: 12,
  LIST_CARD_GAP: 8,
  LIST_CARD_BG: 'rgba(255, 255, 255, 0.04)',
  LIST_CARD_SELECTED_BG: 'rgba(22, 119, 255, 0.14)',
  LIST_CARD_SELECTED_BORDER: 'rgba(22, 119, 255, 0.55)',

  STATUS_BADGE: {
    draft: { bg: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)' },
    released: { bg: 'rgba(22,119,255,0.3)', color: '#90caff' },
    pending: { bg: 'rgba(22,119,255,0.3)', color: '#90caff' },
    in_progress: { bg: 'rgba(255,179,0,0.35)', color: '#ffe58f' },
    processing: { bg: 'rgba(255,179,0,0.35)', color: '#ffe58f' },
    completed: { bg: 'rgba(0,200,83,0.35)', color: '#95de64' },
    cancelled: { bg: 'rgba(211,47,47,0.35)', color: '#ff7875' },
    idle: { bg: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)' },
    stopped: { bg: 'rgba(211,47,47,0.28)', color: '#ff7875' },
    default: { bg: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' },
  } as const,

  BUTTON_GAP: 16,
  BUTTON_PADDING_PRIMARY: 28,
  BUTTON_PADDING_SECONDARY: 24,
} as const;

export type HmiStatusKey = keyof typeof HMI_DESIGN_TOKENS.STATUS_BADGE;
