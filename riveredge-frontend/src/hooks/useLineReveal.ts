/**
 * 逐行显示 Hook
 *
 * 模拟 AI 对话框的流式输出，一行一行地显示内容，提高阅读效率。
 *
 * @param lines - 要显示的行数组
 * @param interval - 每行出现的间隔（毫秒），默认 80ms
 * @param enabled - 是否启用
 */
import { useState, useEffect, useRef } from 'react';

export function useLineReveal(
  lines: string[],
  interval: number = 80,
  enabled: boolean = true
): { visibleLines: string[]; visibleCount: number; isComplete: boolean } {
  const [visibleCount, setVisibleCount] = useState(0);
  const linesKey = lines.join('\n');
  const completedLinesKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/14723169-35ed-4ca8-9cad-d93c6c16c078', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'useLineReveal.ts:useEffect',
        message: 'useLineReveal effect run',
        data: {
          enabled,
          linesLength: lines.length,
          linesKeyLen: linesKey.length,
          willReset: enabled && lines.length > 0,
          skipped: completedLinesKeyRef.current === linesKey,
          runId: 'post-fix',
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        hypothesisId: 'C,E',
      }),
    }).catch(() => {});
    // #endregion

    if (!enabled || lines.length === 0) {
      setVisibleCount(lines.length);
      completedLinesKeyRef.current = null;
      return;
    }

    if (completedLinesKeyRef.current === linesKey) {
      return;
    }

    completedLinesKeyRef.current = null;
    setVisibleCount(0);

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= lines.length; i++) {
      timers.push(
        setTimeout(() => {
          setVisibleCount(i);
          if (i === lines.length) {
            completedLinesKeyRef.current = linesKey;
          }
        }, i * interval)
      );
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [linesKey, interval, enabled, lines.length]);

  const visibleLines = lines.slice(0, visibleCount);
  const isComplete = visibleCount >= lines.length;

  if (isComplete && linesKey) {
    completedLinesKeyRef.current = linesKey;
  }

  return { visibleLines, visibleCount, isComplete };
}
