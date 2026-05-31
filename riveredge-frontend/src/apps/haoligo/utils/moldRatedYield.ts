/** 模具台账：额定可用产量 = 单模产能 × 额定可用次数 */

export function numOrUndef(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function computeMoldRatedUsableYield(capacity: unknown, times: unknown): number | undefined {
  const cap = capacity != null && capacity !== '' ? Number(capacity) : Number.NaN;
  const t = numOrUndef(times);
  if (t === undefined || !Number.isFinite(cap)) return undefined;
  return Math.round(cap * t);
}

export function moldRatedUsableYieldToPayloadValue(capacity: unknown, times: unknown): string | undefined {
  const y = computeMoldRatedUsableYield(capacity, times);
  if (y === undefined) return undefined;
  return String(y);
}

/** 产量为空或仍等于上次自动值时，随产能/次数变化重新推算 */
export function shouldAutoFillRatedUsableYield(currentYield: unknown, lastAutoYield: number | undefined): boolean {
  const cur = numOrUndef(currentYield);
  if (cur === undefined) return true;
  if (lastAutoYield === undefined) return false;
  return cur === lastAutoYield;
}

export function resolveUsableYieldPayload(
  capacity: unknown,
  times: unknown,
  formYield: unknown,
): string | undefined {
  const manual = formYield != null && formYield !== '' ? String(formYield) : undefined;
  if (manual !== undefined) {
    const n = Number(manual);
    return Number.isFinite(n) ? String(Math.round(n)) : manual;
  }
  return moldRatedUsableYieldToPayloadValue(capacity, times);
}
