/** 快捷入口图标背景渐变（与工作台 QuickEntryGrid 一致） */
export type QuickEntryThemeStyle = 'vivid' | 'plain';

export function generateQuickEntryGradient(
  index: number,
  isDark: boolean,
  themeStyle: QuickEntryThemeStyle = 'vivid',
): string {
  if (themeStyle === 'plain') {
    return isDark
      ? 'var(--ant-color-fill-secondary, #2a2a2a)'
      : 'var(--ant-color-fill-tertiary, #f5f5f5)';
  }

  if (isDark) {
    const darkGradients = [
      'linear-gradient(135deg, #0A4A8F 0%, #06305C 100%)',
      'linear-gradient(135deg, #3C3A8F 0%, #29285C 100%)',
      'linear-gradient(135deg, #7A3A9F 0%, #52286B 100%)',
      'linear-gradient(135deg, #8F1A35 0%, #5C1122 100%)',
      'linear-gradient(135deg, #A1223C 0%, #691627 100%)',
      'linear-gradient(135deg, #8F5906 0%, #5C3A04 100%)',
      'linear-gradient(135deg, #8F7200 0%, #5C4A00 100%)',
      'linear-gradient(135deg, #1A6B3E 0%, #114528 100%)',
      'linear-gradient(135deg, #006B66 0%, #004542 100%)',
      'linear-gradient(135deg, #2D6B82 0%, #1D4554 100%)',
      'linear-gradient(135deg, #6B5941 0%, #453A2A 100%)',
      'linear-gradient(135deg, #3E4E8F 0%, #28325C 100%)',
      'linear-gradient(135deg, #1D6B30 0%, #13451F 100%)',
      'linear-gradient(135deg, #8F3C3C 0%, #5C2626 100%)',
      'linear-gradient(135deg, #21457A 0%, #152C4D 100%)',
    ];
    return darkGradients[index % darkGradients.length];
  }

  const gradients = [
    'linear-gradient(135deg, #0A84FF 0%, #5AC8FA 100%)',
    'linear-gradient(135deg, #5E5CE6 0%, #7D7AFF 100%)',
    'linear-gradient(135deg, #BF5AF2 0%, #DA8FFF 100%)',
    'linear-gradient(135deg, #FF2D55 0%, #FF6482 100%)',
    'linear-gradient(135deg, #FF375F 0%, #FF7A95 100%)',
    'linear-gradient(135deg, #FF9F0A 0%, #FFC15A 100%)',
    'linear-gradient(135deg, #FFCC00 0%, #FFE066 100%)',
    'linear-gradient(135deg, #30D158 0%, #6DE28A 100%)',
    'linear-gradient(135deg, #00C7BE 0%, #5EDFD7 100%)',
    'linear-gradient(135deg, #64D2FF 0%, #9BE4FF 100%)',
    'linear-gradient(135deg, #AC8E68 0%, #C8A983 100%)',
    'linear-gradient(135deg, #6C8CF5 0%, #9AAEF9 100%)',
    'linear-gradient(135deg, #34C759 0%, #7FDF95 100%)',
    'linear-gradient(135deg, #FF6B6B 0%, #FF9A8B 100%)',
    'linear-gradient(135deg, #3A7BD5 0%, #6FB1FC 100%)',
  ];
  return gradients[index % gradients.length];
}

function parseGradientColors(gradient: string): [string, string] {
  const colors = gradient.match(/#[0-9A-Fa-f]{6}/g);
  return [colors?.[0] ?? '#0A84FF', colors?.[1] ?? '#5AC8FA'];
}

/** 工序卡 header 配色（与快捷入口图标色板一致，按 index 循环） */
export function getQuickEntryHeaderColors(
  index: number,
  isDark: boolean,
  themeStyle: QuickEntryThemeStyle = 'vivid',
  colorPrimary = '#1677ff',
  colorPrimaryBg = '#e6f4ff',
) {
  if (themeStyle === 'plain') {
    return {
      solid: colorPrimary,
      soft: colorPrimary,
      nameBackground: colorPrimary,
      progressBackground: colorPrimaryBg,
      progressText: colorPrimary,
    };
  }

  const gradient = generateQuickEntryGradient(index, isDark, 'vivid');
  const [solid, soft] = parseGradientColors(gradient);
  return {
    solid,
    soft,
    nameBackground: solid,
    progressBackground: isDark
      ? `color-mix(in srgb, ${soft} 28%, #141414)`
      : `color-mix(in srgb, ${soft} 38%, #ffffff)`,
    progressText: isDark ? soft : solid,
  };
}
