import type { KpiItem } from '../mockData';
import { formatKpiAnimatedNumber, parseKpiValueString } from './kpiValueFormat';

function rndi(a: number, b: number) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** 单次随机游走，模拟实时波动（仅改 value 字符串） */
export function simulateKpiValueStep(item: KpiItem): string {
  const { n, mode, groupThousands } = parseKpiValueString(item.value);
  let next = n;

  switch (item.id) {
    case 'orders':
      next = clamp(n + rndi(-5, 7), 148, 235);
      break;
    case 'otd':
      next = clamp(n + (Math.random() - 0.5) * 0.45, 87.5, 98.8);
      break;
    case 'wip':
      next = clamp(n + rndi(-32, 38), 1020, 1420);
      break;
    case 'exceptions':
      next = clamp(n + rndi(-2, 3), 10, 42);
      break;
    case 'turnover':
      next = clamp(n + rndi(-1, 1), 21, 37);
      break;
    case 'closedWo7d':
      next = clamp(n + rndi(-14, 20), 250, 430);
      break;
    case 'shipmentsToday':
      next = clamp(n + rndi(-6, 8), 68, 118);
      break;
    case 'oeeAvg':
      next = clamp(n + (Math.random() - 0.5) * 0.5, 71.5, 86.5);
      break;
    default:
      return item.value;
  }

  return formatKpiAnimatedNumber(next, mode, groupThousands);
}
