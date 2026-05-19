type Rgb01 = [number, number, number];

const COLOR_EPS = 0.04;

/** background.json 渐变描边中的紫色系锚点 */
const BG_GRADIENT_PURPLE: Rgb01[] = [
  [0.357, 0.216, 0.573],
  [0.569, 0.286, 1],
];

function parseHexColor(hex: string): Rgb01 {
  const normalized = hex.trim().replace(/^#/, '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    return [0.09, 0.47, 1];
  }
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function colorDistance(a: Rgb01, b: Rgb01): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function adjustLightness(rgb: Rgb01, delta: number): Rgb01 {
  if (delta >= 0) {
    return rgb.map((c) => mix(c, 1, delta)) as Rgb01;
  }
  const factor = 1 + delta;
  return rgb.map((c) => c * factor) as Rgb01;
}

function replaceGradientColors(k: number[], theme: Rgb01): number[] {
  if (k.length < 8) return k;
  const next = [...k];
  let i = 0;
  while (i < next.length) {
    if (typeof next[i] !== 'number' || next[i] > 1) break;
    const pos = next[i];
    if (i + 3 >= next.length) break;
    const r = next[i + 1];
    const g = next[i + 2];
    const b = next[i + 3];
    if (typeof r !== 'number' || typeof g !== 'number' || typeof b !== 'number') break;
    if (r > 1 || g > 1 || b > 1) break;

    let rgb: Rgb01 = [r, g, b];
    const isPurple = BG_GRADIENT_PURPLE.some((p) => colorDistance(rgb, p) <= COLOR_EPS);
    const isDarkNeutral = colorDistance(rgb, [0.15, 0.15, 0.15]) <= COLOR_EPS;

    if (isPurple) {
      rgb = pos <= 0.01 ? adjustLightness(theme, -0.35) : pos >= 0.99 ? adjustLightness(theme, 0.2) : theme;
    } else if (isDarkNeutral) {
      rgb = adjustLightness(theme, -0.5);
    }

    next[i + 1] = rgb[0];
    next[i + 2] = rgb[1];
    next[i + 3] = rgb[2];
    i += 4;
  }
  return next;
}

function stripSolidBackgroundLayers(layers?: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return (layers ?? [])
    .filter((layer) => layer.ty !== 1)
    .map((layer) =>
      Array.isArray(layer.layers)
        ? { ...layer, layers: stripSolidBackgroundLayers(layer.layers as Array<Record<string, unknown>>) }
        : layer,
    );
}

function walkBackgroundLottieColors(node: unknown, theme: Rgb01): void {
  if (!node || typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;

  if (obj.ty === 'gs' || obj.ty === 'gf') {
    const g = obj.g as { k?: { k?: number[] } } | undefined;
    if (Array.isArray(g?.k?.k)) {
      g.k.k = replaceGradientColors(g.k.k, theme);
    }
  }

  if (Array.isArray(node)) {
    node.forEach((item) => walkBackgroundLottieColors(item, theme));
    return;
  }

  Object.values(obj).forEach((value) => walkBackgroundLottieColors(value, theme));
}

/** 隐藏 login.json 内置圆形底（页面不再显示磨砂圆） */
export function prepareLoginDecorationLottie<T extends object>(animationData: T): T {
  const cloned =
    typeof structuredClone === 'function'
      ? structuredClone(animationData)
      : (JSON.parse(JSON.stringify(animationData)) as T);
  const root = cloned as { layers?: Array<{ nm?: string; ks?: { o?: { k?: number } } }> };

  for (const layer of root.layers ?? []) {
    if (layer.nm === 'Layer 1' && layer.ks?.o) {
      layer.ks.o.k = 0;
    }
  }

  return cloned;
}

/** 将 background.json 中的强调色替换为平台主题色（不修改源文件） */
export function applyLottieThemeColor<T extends object>(animationData: T, themeHex: string): T {
  const cloned =
    typeof structuredClone === 'function'
      ? structuredClone(animationData)
      : (JSON.parse(JSON.stringify(animationData)) as T);
  const root = cloned as { layers?: Array<Record<string, unknown>>; assets?: Array<{ layers?: Array<Record<string, unknown>> }> };
  if (root.layers) root.layers = stripSolidBackgroundLayers(root.layers);
  for (const asset of root.assets ?? []) {
    if (asset.layers) asset.layers = stripSolidBackgroundLayers(asset.layers);
  }
  walkBackgroundLottieColors(cloned, parseHexColor(themeHex));
  return cloned;
}
