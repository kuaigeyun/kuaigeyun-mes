/** 解析指标卡展示用数值字符串，供动画插值与格式化 */
export type KpiValueMode = 'int' | 'percent' | 'decimal';

export function parseKpiValueString(s: string): { n: number; mode: KpiValueMode; groupThousands: boolean } {
  const t = s.trim();
  if (!t) return { n: 0, mode: 'int', groupThousands: false };
  const groupThousands = t.includes(',');
  const isPct = t.endsWith('%');
  const raw = t.replace(/,/g, '').replace(/%$/, '').trim();
  const n = Number(raw);
  if (Number.isNaN(n)) return { n: 0, mode: 'int', groupThousands: false };
  if (isPct) return { n, mode: 'percent', groupThousands: false };
  if (raw.includes('.')) return { n, mode: 'decimal', groupThousands: false };
  return { n, mode: 'int', groupThousands };
}

export function formatKpiAnimatedNumber(
  n: number,
  mode: KpiValueMode,
  groupThousands: boolean
): string {
  if (mode === 'percent') return `${n.toFixed(1)}%`;
  if (mode === 'decimal') {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
  }
  const v = Math.round(n);
  return groupThousands ? v.toLocaleString('en-US') : String(v);
}
