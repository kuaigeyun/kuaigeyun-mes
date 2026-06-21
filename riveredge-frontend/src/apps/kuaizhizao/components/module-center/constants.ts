import type React from 'react';

/** 模块看板 KPI 卡 body 统一高度（与采购/销售等标准三卡一致） */
export const MODULE_KPI_CARD_BODY_HEIGHT = 128;

export const MODULE_KPI_CARD_BODY_STYLE: React.CSSProperties = {
  padding: '14px 20px',
  color: '#fff',
  height: MODULE_KPI_CARD_BODY_HEIGHT,
  minHeight: MODULE_KPI_CARD_BODY_HEIGHT,
  maxHeight: MODULE_KPI_CARD_BODY_HEIGHT,
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  overflow: 'hidden',
};

export const MODULE_CENTER_GUTTER = 16;

/** 模块看板 action / chart 面板标题统一字号 */
export const MODULE_PANEL_TITLE_FONT_SIZE = 16;
export const MODULE_PANEL_TITLE_ICON_SIZE = 16;
export const MODULE_PANEL_TITLE_STYLE: React.CSSProperties = {
  fontSize: MODULE_PANEL_TITLE_FONT_SIZE,
  fontWeight: 600,
  lineHeight: '24px',
};
