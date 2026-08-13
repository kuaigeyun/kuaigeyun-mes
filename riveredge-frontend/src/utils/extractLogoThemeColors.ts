/**
 * 从站点 Logo 图片提取排名靠前、彼此有明显差异的主色（供主题色选用）。
 *
 * 算法：缩放到小画布采样 → 量化桶计频 → 过滤近白/近透明/低饱和灰 →
 * 按频次降序贪心选取，LAB 距离不足则跳过。
 */

export type ExtractedThemeColor = {
  hex: string;
  /** 在有效像素中的占比 0–1 */
  weight: number;
};

type Rgb = { r: number; g: number; b: number };
type Lab = { l: number; a: number; b: number };

const DEFAULT_MAX_COLORS = 5;
/** CIE76 ΔE 约 25：肉眼能区分的主色差异 */
const DEFAULT_MIN_DELTA_E = 25;
const QUANT_STEP = 16;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function rgbToLab({ r, g, b }: Rgb): Lab {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  let x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  let y = (R * 0.2126729 + G * 0.7151522 + B * 0.072175) / 1;
  let z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

function deltaE76(a: Lab, b: Lab): number {
  return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
}

function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** HSV 饱和度 0–1 */
function saturation({ r, g, b }: Rgb): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

function isBackgroundLike(rgb: Rgb, alpha: number): boolean {
  if (alpha < 128) return true;
  const lum = relativeLuminance(rgb);
  // 近白底 / 近黑描边通常不是主题色
  if (lum > 0.92) return true;
  if (lum < 0.04 && saturation(rgb) < 0.12) return true;
  // 低饱和灰阶忽略（除非后面有效像素太少再回退）
  if (saturation(rgb) < 0.08 && lum > 0.15 && lum < 0.85) return true;
  return false;
}

function quantizeKey(r: number, g: number, b: number): string {
  const qr = Math.round(r / QUANT_STEP) * QUANT_STEP;
  const qg = Math.round(g / QUANT_STEP) * QUANT_STEP;
  const qb = Math.round(b / QUANT_STEP) * QUANT_STEP;
  return `${clampByte(qr)},${clampByte(qg)},${clampByte(qb)}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('LOGO_IMAGE_LOAD_FAILED'));
    img.src = url;
  });
}

function sampleBuckets(img: HTMLImageElement): Map<string, { count: number; sum: Rgb }> {
  const maxSide = 96;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height, 1));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('LOGO_CANVAS_UNSUPPORTED');
  }
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    throw new Error('LOGO_CANVAS_TAINTED');
  }

  const buckets = new Map<string, { count: number; sum: Rgb }>();
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const a = px[i + 3];
    const rgb = { r, g, b };
    if (isBackgroundLike(rgb, a)) continue;
    const key = quantizeKey(r, g, b);
    const prev = buckets.get(key);
    if (prev) {
      prev.count += 1;
      prev.sum.r += r;
      prev.sum.g += g;
      prev.sum.b += b;
    } else {
      buckets.set(key, { count: 1, sum: { r, g, b } });
    }
  }
  return buckets;
}

function bucketsToCandidates(buckets: Map<string, { count: number; sum: Rgb }>): Array<{ rgb: Rgb; count: number }> {
  const list: Array<{ rgb: Rgb; count: number }> = [];
  for (const { count, sum } of buckets.values()) {
    list.push({
      count,
      rgb: {
        r: sum.r / count,
        g: sum.g / count,
        b: sum.b / count,
      },
    });
  }
  list.sort((a, b) => b.count - a.count);
  return list;
}

/**
 * 回退：背景过滤过严时，放宽为仅跳过透明与极白，再取主色。
 */
function sampleBucketsRelaxed(img: HTMLImageElement): Map<string, { count: number; sum: Rgb }> {
  const maxSide = 96;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height, 1));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('LOGO_CANVAS_UNSUPPORTED');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const buckets = new Map<string, { count: number; sum: Rgb }>();
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const a = px[i + 3];
    if (a < 128) continue;
    if (relativeLuminance({ r, g, b }) > 0.95) continue;
    const key = quantizeKey(r, g, b);
    const prev = buckets.get(key);
    if (prev) {
      prev.count += 1;
      prev.sum.r += r;
      prev.sum.g += g;
      prev.sum.b += b;
    } else {
      buckets.set(key, { count: 1, sum: { r, g, b } });
    }
  }
  return buckets;
}

function pickDistinct(
  candidates: Array<{ rgb: Rgb; count: number }>,
  maxColors: number,
  minDeltaE: number,
): ExtractedThemeColor[] {
  const total = candidates.reduce((s, c) => s + c.count, 0) || 1;
  const picked: Array<{ rgb: Rgb; lab: Lab; count: number }> = [];
  for (const c of candidates) {
    const lab = rgbToLab(c.rgb);
    if (picked.some((p) => deltaE76(p.lab, lab) < minDeltaE)) continue;
    picked.push({ rgb: c.rgb, lab, count: c.count });
    if (picked.length >= maxColors) break;
  }
  return picked.map((p) => ({
    hex: rgbToHex(p.rgb),
    weight: p.count / total,
  }));
}

export async function extractDistinctLogoThemeColors(
  imageUrl: string,
  options?: { maxColors?: number; minDeltaE?: number },
): Promise<ExtractedThemeColor[]> {
  const maxColors = options?.maxColors ?? DEFAULT_MAX_COLORS;
  const minDeltaE = options?.minDeltaE ?? DEFAULT_MIN_DELTA_E;
  if (!imageUrl?.trim()) {
    throw new Error('LOGO_IMAGE_MISSING');
  }

  const img = await loadImage(imageUrl.trim());
  let buckets = sampleBuckets(img);
  let candidates = bucketsToCandidates(buckets);
  if (candidates.length === 0) {
    buckets = sampleBucketsRelaxed(img);
    candidates = bucketsToCandidates(buckets);
  }
  if (candidates.length === 0) {
    throw new Error('LOGO_NO_THEME_COLOR');
  }
  return pickDistinct(candidates, maxColors, minDeltaE);
}

/** 供测试 / 调试：比较两 hex 是否视为「明显不同」 */
export function areThemeColorsDistinct(a: string, b: string, minDeltaE = DEFAULT_MIN_DELTA_E): boolean {
  return deltaE76(rgbToLab(hexToRgb(a)), rgbToLab(hexToRgb(b))) >= minDeltaE;
}
