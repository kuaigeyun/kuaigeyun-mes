import type { Data } from '@measured/puck';
import type { DashboardThemeTokens } from '../materials/theme';

export type DashboardPuckData = Data;

export type DashboardRootProps = {
  accent?: string;
  backgroundVariant?: 'radialGrid' | 'panelWash' | 'deepVoid';
  title?: string;
};

export const EMPTY_PUCK_DATA = {
  content: [],
  root: {
    props: {
      accent: '#00d4ff',
      backgroundVariant: 'radialGrid',
      title: '',
    },
  },
} as DashboardPuckData;

/** 将接口返回规范为 Puck Data；非法/空数据回落为空画布 */
export function normalizePuckData(layout: unknown): DashboardPuckData {
  if (
    layout &&
    typeof layout === 'object' &&
    Array.isArray((layout as Data).content)
  ) {
    return layout as DashboardPuckData;
  }
  return EMPTY_PUCK_DATA;
}

export function themeFromRootProps(root: Record<string, unknown> | undefined): Partial<DashboardThemeTokens> {
  if (!root) return {};
  const props = (root.props as Record<string, unknown> | undefined) || root;
  return {
    accent: typeof props.accent === 'string' ? props.accent : undefined,
  };
}
