/** 运营看板 AntV 暗色主题与强调色 */
export const accent = {
  cyan: '#38bdf8',
  emerald: '#34d399',
  amber: '#fbbf24',
  violet: '#a78bfa',
  rose: '#fb7185',
  slate: '#94a3b8',
};

export const businessBoardChartTheme = {
  styleSheet: {
    backgroundColor: 'transparent',
  },
  axis: {
    x: {
      label: { fill: '#cbd5e1', fontSize: 9 },
      grid: { stroke: 'rgba(255,255,255,0.06)' },
      line: { stroke: 'rgba(255,255,255,0.14)' },
    },
    y: {
      label: { fill: '#cbd5e1', fontSize: 9 },
      grid: { stroke: 'rgba(255,255,255,0.06)' },
      line: { stroke: 'rgba(255,255,255,0.14)' },
    },
  },
  legend: { text: { fill: '#94a3b8' } },
};

/** 运营看板 HUD 调色板 */
export interface BusinessBoardHud {
  bgDeep: string;
  bgMid: string;
  bgPanel: string;
  bgPanelTop: string;
  cyan: string;
  cyanSoft: string;
  cyanDim: string;
  borderLine: string;
  platformBlue: string;
  amber: string;
  emerald: string;
  rose: string;
  violet: string;
  textPrimary: string;
  textSoft: string;
  textDim: string;
}

/** 多彩运营看板 HUD（默认） */
export const businessBoardVividHud: BusinessBoardHud = {
  bgDeep: '#06162d',
  bgMid: '#0a1f3d',
  bgPanel: 'rgba(8, 26, 54, 0.72)',
  bgPanelTop: 'rgba(12, 36, 70, 0.78)',
  cyan: '#00d0ff',
  cyanSoft: '#7ee7ff',
  cyanDim: 'rgba(0, 208, 255, 0.22)',
  borderLine: 'rgba(0, 208, 255, 0.35)',
  platformBlue: '#0095ff',
  amber: '#fbbf24',
  emerald: '#34d399',
  rose: '#fb7185',
  violet: '#a78bfa',
  textPrimary: '#e0f7ff',
  textSoft: '#9fb8d0',
  textDim: '#5c7798',
};

/** 简约模式：灰阶 HUD + 品牌主色 accent */
export function buildBusinessBoardPlainHud(colorPrimary: string): BusinessBoardHud {
  const accentSoft = `${colorPrimary}cc`;
  const accentDim = `${colorPrimary}38`;
  return {
    bgDeep: '#0f1419',
    bgMid: '#151b22',
    bgPanel: 'rgba(20, 24, 28, 0.82)',
    bgPanelTop: 'rgba(24, 28, 34, 0.88)',
    cyan: colorPrimary,
    cyanSoft: accentSoft,
    cyanDim: accentDim,
    borderLine: 'rgba(255, 255, 255, 0.14)',
    platformBlue: colorPrimary,
    amber: '#94a3b8',
    emerald: '#94a3b8',
    rose: '#94a3b8',
    violet: '#94a3b8',
    textPrimary: '#e8eaed',
    textSoft: '#9aa0a6',
    textDim: '#6b7280',
  };
}

export function getBusinessBoardWarehouseChartColors(
  plain: boolean,
  colorPrimary: string,
): { colorIn: string; colorOut: string } {
  if (plain) {
    return {
      colorIn: colorPrimary,
      colorOut: '#64748b',
    };
  }
  return {
    colorIn: '#0095ff',
    colorOut: '#fb7185',
  };
}
