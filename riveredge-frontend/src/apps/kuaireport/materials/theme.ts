import type { CSSProperties } from 'react';

/** 看板装饰主题 token（原创，与 TechUI/DataV 无关） */

export type DashboardThemeTokens = {
  accent: string;
  accentSoft: string;
  bg: string;
  panel: string;
  panelBorder: string;
  text: string;
  textMuted: string;
  gridLine: string;
};

export const DEFAULT_DASHBOARD_THEME: DashboardThemeTokens = {
  accent: '#00d4ff',
  accentSoft: 'rgba(0, 212, 255, 0.35)',
  bg: '#050a12',
  panel: 'rgba(8, 22, 40, 0.72)',
  panelBorder: 'rgba(0, 180, 255, 0.28)',
  text: 'rgba(255, 255, 255, 0.92)',
  textMuted: 'rgba(255, 255, 255, 0.55)',
  gridLine: 'rgba(0, 160, 255, 0.06)',
};

export function themeToCssVars(theme: Partial<DashboardThemeTokens> = {}): CSSProperties {
  const t = { ...DEFAULT_DASHBOARD_THEME, ...theme };
  return {
    ['--kb-accent' as string]: t.accent,
    ['--kb-accent-soft' as string]: t.accentSoft,
    ['--kb-bg' as string]: t.bg,
    ['--kb-panel' as string]: t.panel,
    ['--kb-panel-border' as string]: t.panelBorder,
    ['--kb-text' as string]: t.text,
    ['--kb-text-muted' as string]: t.textMuted,
    ['--kb-grid-line' as string]: t.gridLine,
  };
}

export const DEMO_CHART_DATA = [
  { x: '1月', y: 30, value: 30, type: 'A', col1: '数据1', col2: '100', item: '质量', score: 80, y1: 30, y2: 20 },
  { x: '2月', y: 40, value: 40, type: 'A', col1: '数据2', col2: '200', item: '交期', score: 70, y1: 40, y2: 28 },
  { x: '3月', y: 35, value: 35, type: 'A', col1: '数据3', col2: '150', item: '成本', score: 85, y1: 35, y2: 22 },
  { x: '4月', y: 50, value: 50, type: 'A', col1: '数据4', col2: '300', item: '服务', score: 90, y1: 50, y2: 35 },
];
