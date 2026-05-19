type Rgb01 = [number, number, number];

const COLOR_EPS = 0.04;

/** background.json 渐变描边中的紫色系锚点 */
const BG_GRADIENT_PURPLE: Rgb01[] = [
  [0.357, 0.216, 0.573],
  [0.569, 0.286, 1],
];

/** 背景 Lottie 固定为白色系时的渐变替换色（由原主题色逻辑在 #ffffff 下推导） */
const WHITE_GRADIENT_START: Rgb01 = [0.65, 0.65, 0.65];
const WHITE_GRADIENT_END: Rgb01 = [1, 1, 1];
const WHITE_DARK_NEUTRAL: Rgb01 = [0.5, 0.5, 0.5];

function cloneLottie<T extends object>(animationData: T): T {
  const clone = globalThis.structuredClone;
  return typeof clone === 'function'
    ? clone(animationData)
    : (JSON.parse(JSON.stringify(animationData)) as T);
}

function colorDistance(a: Rgb01, b: Rgb01): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function replaceGradientColors(k: number[]): number[] {
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

    const rgb: Rgb01 = [r, g, b];
    const isPurple = BG_GRADIENT_PURPLE.some((p) => colorDistance(rgb, p) <= COLOR_EPS);
    const isDarkNeutral = colorDistance(rgb, [0.15, 0.15, 0.15]) <= COLOR_EPS;

    let replacement: Rgb01 | null = null;
    if (isPurple) {
      replacement = pos <= 0.01 ? WHITE_GRADIENT_START : WHITE_GRADIENT_END;
    } else if (isDarkNeutral) {
      replacement = WHITE_DARK_NEUTRAL;
    }

    if (replacement) {
      next[i + 1] = replacement[0];
      next[i + 2] = replacement[1];
      next[i + 3] = replacement[2];
    }
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

function walkBackgroundLottieColors(node: unknown): void {
  if (!node || typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;

  if (obj.ty === 'gs' || obj.ty === 'gf') {
    const g = obj.g as { k?: { k?: number[] } } | undefined;
    if (Array.isArray(g?.k?.k)) {
      g.k.k = replaceGradientColors(g.k.k);
    }
  }

  if (Array.isArray(node)) {
    node.forEach(walkBackgroundLottieColors);
    return;
  }

  Object.values(obj).forEach(walkBackgroundLottieColors);
}

/** 隐藏 login.json 内置圆形底（页面不再显示磨砂圆） */
export function prepareLoginDecorationLottie<T extends object>(animationData: T): T {
  const cloned = cloneLottie(animationData);
  const root = cloned as { layers?: Array<{ nm?: string; ks?: { o?: { k?: number } } }> };

  for (const layer of root.layers ?? []) {
    if (layer.nm === 'Layer 1' && layer.ks?.o) {
      layer.ks.o.k = 0;
    }
  }

  return cloned;
}

/** 预处理 background.json：去除纯色底并统一为白色系渐变（不修改源文件） */
export function prepareBackgroundLottie<T extends object>(animationData: T): T {
  const cloned = cloneLottie(animationData);
  const root = cloned as {
    layers?: Array<Record<string, unknown>>;
    assets?: Array<{ layers?: Array<Record<string, unknown>> }>;
  };
  if (root.layers) root.layers = stripSolidBackgroundLayers(root.layers);
  for (const asset of root.assets ?? []) {
    if (asset.layers) asset.layers = stripSolidBackgroundLayers(asset.layers);
  }
  walkBackgroundLottieColors(cloned);
  return cloned;
}
