import { useEffect, useState } from 'react';

/**
 * 延后到连续两帧 rAF 之后再变为 true，让浏览器先提交主内容（如 UniTable）的首次绘制，
 * 再发起次要请求（指标卡、统计聚合等），减轻与列表接口的并发竞争。
 */
export function useDeferAfterPaint(active = true): boolean {
  const [ready, setReady] = useState(!active);

  useEffect(() => {
    if (!active) {
      setReady(true);
      return;
    }
    setReady(false);
    let id1 = 0;
    let id2 = 0;
    id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => {
        setReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [active]);

  return ready;
}
