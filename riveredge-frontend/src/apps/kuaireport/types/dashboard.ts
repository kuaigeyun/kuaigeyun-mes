import type { Data } from '@measured/puck';

/** 看板布局：Puck Data（存于 layout_config） */
export type DashboardLayoutConfig = Data;

export interface DashboardThemeConfig {
  accent?: string;
  backgroundVariant?: 'radialGrid' | 'panelWash' | 'deepVoid';
  [key: string]: unknown;
}

export interface DashboardConfig {
  name: string;
  layout: DashboardLayoutConfig;
  theme?: DashboardThemeConfig;
}
