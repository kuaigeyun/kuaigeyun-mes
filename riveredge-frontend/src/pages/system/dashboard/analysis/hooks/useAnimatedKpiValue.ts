import { useEffect, useRef, useState } from 'react';
import {
  formatKpiAnimatedNumber,
  parseKpiValueString,
} from '../utils/kpiValueFormat';

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * 指标主数值从旧值缓动到新值，用于轨道卡「实时感」。
 */
export function useAnimatedKpiValue(targetValue: string, durationMs = 720): string {
  const { n: targetN, mode, groupThousands } = parseKpiValueString(targetValue);
  const [display, setDisplay] = useState(targetN);
  const displayRef = useRef(targetN);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    const fromN = displayRef.current;
    if (Math.abs(fromN - targetN) < 1e-6) {
      return;
    }
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const v = fromN + (targetN - fromN) * easeOutCubic(t);
      displayRef.current = v;
      setDisplay(v);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        displayRef.current = targetN;
        setDisplay(targetN);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetN, durationMs]);

  return formatKpiAnimatedNumber(display, mode, groupThousands);
}
