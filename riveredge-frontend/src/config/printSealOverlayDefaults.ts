/** A4 合同常用电子章尺寸（宽高一致） */
export const SEAL_OVERLAY_DEFAULT_SIZE_MM = 40;

export type SealOverlaySizeUnit = 'mm' | 'px';

export const DEFAULT_SEAL_OVERLAY_SIZE = {
  width: SEAL_OVERLAY_DEFAULT_SIZE_MM,
  height: SEAL_OVERLAY_DEFAULT_SIZE_MM,
  sizeUnit: 'mm' as SealOverlaySizeUnit,
  keepRatio: true,
  sealAlign: 'center' as const,
  url: '{{ company_seal }}',
};

/** 解析设计器/schema 中的印章宽高的 CSS 值 */
export function resolveSealOverlayDimensionCss(
  value: number | undefined,
  unit: SealOverlaySizeUnit | undefined,
  fallback = SEAL_OVERLAY_DEFAULT_SIZE_MM,
): string {
  const n = Number(value);
  const safe = Number.isFinite(n) && n > 0 ? n : fallback;
  const u = unit === 'px' ? 'px' : 'mm';
  return `${safe}${u}`;
}

/** 旧模板（88/100px）无 sizeUnit 时仍按 px 渲染 */
export function resolveSealOverlaySizeUnit(
  width: number | undefined,
  sizeUnit: SealOverlaySizeUnit | undefined,
): SealOverlaySizeUnit {
  if (sizeUnit === 'mm' || sizeUnit === 'px') return sizeUnit;
  const w = Number(width);
  if (Number.isFinite(w) && w >= 60) return 'px';
  return 'mm';
}

export function createDefaultSealOverlayFields(
  content: string,
  overrides?: Partial<{
    width: number;
    height: number;
    sizeUnit: SealOverlaySizeUnit;
    sealAlign: 'left' | 'center' | 'right';
    sealOffsetX: number;
    sealOffsetY: number;
    style: { fontSize?: string };
  }>,
) {
  return {
    ...DEFAULT_SEAL_OVERLAY_SIZE,
    content,
    style: { fontSize: '13px' },
    ...overrides,
  };
}
