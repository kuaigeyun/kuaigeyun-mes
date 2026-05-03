/**
 * 生命周期圆环进度（percent）：优先根据后端下发的 main_stages 推导，避免按 stage_key 硬编码百分比。
 *
 * 规则：
 * 1. 当前 active 节点若自带 percent（0～100），直接使用；
 * 2. 否则按 active 在主线的序号线性映射：[0, n-1] → [0%, 100%]；
 * 3. 若无 active 且全部为 done（如已完成贯穿），视为 100%；
 * 4. 无法推导时返回 null，由调用方使用兜底映射。
 */

export type LifecycleStageLike = {
  status: 'done' | 'active' | 'pending';
  percent?: number;
};

export function deriveLifecycleRingPercent(stages: LifecycleStageLike[]): number | null {
  if (!stages.length) return null;

  const activeIdx = stages.findIndex((s) => s.status === 'active');
  if (activeIdx >= 0) {
    const active = stages[activeIdx];
    if (active.percent != null && Number.isFinite(Number(active.percent))) {
      return Math.min(100, Math.max(0, Math.round(Number(active.percent))));
    }
    const n = stages.length;
    if (n <= 1) return 100;
    return Math.min(100, Math.max(0, Math.round((activeIdx / (n - 1)) * 100)));
  }

  if (stages.every((s) => s.status === 'done')) return 100;

  return null;
}
