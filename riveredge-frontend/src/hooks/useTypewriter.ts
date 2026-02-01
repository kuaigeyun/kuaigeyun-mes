/**
 * 打字机效果 Hook
 *
 * 逐字显示文本，模拟思考过程，支持中文和英文。
 *
 * @param text - 要显示的完整文本
 * @param speed - 每字符间隔（毫秒），默认 20ms，偏快
 * @param enabled - 是否启用打字效果
 * @returns displayedText - 当前已显示文本, isComplete - 是否完成, reset - 重置函数
 */
import { useState, useEffect, useCallback, useRef } from 'react';

export function useTypewriter(
  text: string,
  speed: number = 20,
  enabled: boolean = true
): { displayedText: string; isComplete: boolean; reset: () => void } {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    indexRef.current = 0;
    setDisplayedText('');
    setIsComplete(false);
  }, []);

  useEffect(() => {
    if (!enabled || !text) {
      setDisplayedText(text || '');
      setIsComplete(true);
      return;
    }

    indexRef.current = 0;
    setDisplayedText('');
    setIsComplete(false);

    const typeNext = () => {
      if (indexRef.current >= text.length) {
        setIsComplete(true);
        return;
      }

      indexRef.current += 1;
      setDisplayedText(text.slice(0, indexRef.current));
      timerRef.current = setTimeout(typeNext, speed);
    };

    timerRef.current = setTimeout(typeNext, speed);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [text, speed, enabled]);

  return { displayedText, isComplete, reset };
}
