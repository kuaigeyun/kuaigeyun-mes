import type React from 'react';
import type { GlobalToken } from 'antd/es/theme/interface';

export type ModuleDashboardThemeStyle = 'vivid' | 'plain';

export function isModuleDashboardPlain(themeStyle: ModuleDashboardThemeStyle | string): boolean {
  return themeStyle === 'plain';
}

export type ModuleKpiVisualTokens = {
  card: React.CSSProperties;
  titleColor: string;
  valueColor: string;
  subtitleColor: string;
  sideBorder: string;
  sideLabelColor: string;
  sideValueColor: string;
  iconWrapBg: string;
  iconColor: string;
  progressStroke: string;
  progressRail: string;
  plain: boolean;
};

function extractGradientAccentColor(vividGradient: string | undefined): string {
  const match = String(vividGradient ?? '').match(/#[0-9a-fA-F]{3,8}/);
  return match?.[0] ?? '#1677ff';
}

/** 模块工作台 KPI：卡面与瀑布流同白底；语义色只落在数字 / 图标浅底（同右侧快捷入口） */
export function resolveModuleKpiVisual(
  vividGradient: string | undefined,
  _vividBoxShadow: string | undefined,
  plain: boolean,
  token: GlobalToken,
  isDark = false,
): ModuleKpiVisualTokens {
  if (!plain) {
    const accent = extractGradientAccentColor(vividGradient);
    return {
      plain: false,
      card: {
        background: token.colorBgContainer,
        boxShadow: 'none',
        border: `1px solid ${token.colorBorderSecondary}`,
      },
      titleColor: token.colorTextSecondary,
      valueColor: accent,
      subtitleColor: token.colorTextTertiary,
      sideBorder: token.colorSplit,
      sideLabelColor: token.colorTextTertiary,
      sideValueColor: token.colorText,
      iconWrapBg: `color-mix(in srgb, ${accent} ${isDark ? 22 : 12}%, ${token.colorBgContainer})`,
      iconColor: accent,
      progressStroke: accent,
      progressRail: `color-mix(in srgb, ${accent} 18%, transparent)`,
    };
  }

  return {
    plain: true,
    card: {
      background: token.colorPrimaryBg,
      boxShadow: 'none',
      border: `1px solid ${token.colorPrimaryBorder}`,
    },
    titleColor: token.colorTextSecondary,
    valueColor: token.colorPrimary,
    subtitleColor: token.colorTextTertiary,
    sideBorder: token.colorPrimaryBorder,
    sideLabelColor: token.colorTextSecondary,
    sideValueColor: token.colorText,
    iconWrapBg: token.colorBgContainer,
    iconColor: token.colorPrimary,
    progressStroke: token.colorPrimary,
    progressRail: token.colorPrimaryBorder,
  };
}

export function resolveModuleRankBadgeStyle(
  rank: number,
  plain: boolean,
  token: GlobalToken,
  isDark = false,
): { background: string; color: string; boxShadow: string } {
  if (plain) {
    const highlighted = rank <= 3;
    return {
      background: highlighted ? token.colorPrimaryBg : token.colorFillSecondary,
      color: highlighted ? token.colorPrimary : token.colorTextSecondary,
      boxShadow: 'none',
    };
  }
  const colors = ['#f5222d', '#fa8c16', '#fadb14'];
  if (isDark) {
    const accent = colors[rank - 1] ?? token.colorTextQuaternary;
    const highlighted = rank <= 3;
    return {
      background: highlighted
        ? `color-mix(in srgb, ${accent} 22%, ${token.colorBgContainer})`
        : token.colorFillSecondary,
      color: highlighted ? accent : token.colorTextSecondary,
      boxShadow: 'none',
    };
  }
  const bg = rank <= 3 ? `linear-gradient(135deg, ${colors[rank - 1]} 0%, #fff 180%)` : '#e8e8e8';
  return {
    background: bg,
    color: rank <= 3 ? '#fff' : '#595959',
    boxShadow: rank <= 3 ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
  };
}

export function resolveModuleFollowUpIconColors(
  code: string | undefined,
  plain: boolean,
  token: GlobalToken,
): { bg: string; fg: string } {
  if (plain) {
    return { bg: token.colorPrimaryBg, fg: token.colorPrimary };
  }
  const c = String(code || '').toUpperCase();
  if (c.includes('PHONE') || c.includes('电话')) return { bg: '#1890ff', fg: '#fff' };
  if (c.includes('MEETING') || c.includes('拜访') || c.includes('现场')) return { bg: '#fa8c16', fg: '#fff' };
  if (c.includes('EMAIL') || c.includes('邮件')) return { bg: '#fadb14', fg: '#fff' };
  if (c.includes('WECHAT') || c.includes('微信') || c.includes('IM') || c.includes('沟通')) {
    return { bg: '#52c41a', fg: '#fff' };
  }
  return { bg: '#8c8c8c', fg: '#fff' };
}
