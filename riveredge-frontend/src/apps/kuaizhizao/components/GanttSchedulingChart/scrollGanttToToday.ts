import type { RiverGanttApi } from '../../../../components/river-gantt';

/** 将甘特图时间轴横向滚动，使「今天」进入可视区域（偏左约 1/3 处） */
export function scrollGanttToToday(api: RiverGanttApi, wrapperEl: HTMLElement | null): boolean {
  const state = api.getState();
  if (!state.pxPerMs) return false;

  const rawLeft = Math.max(0, Math.round((Date.now() - state.start.getTime()) * state.pxPerMs));

  const timelineEl = wrapperEl?.querySelector('.river-gantt__timeline') as HTMLElement | null;
  const viewportWidth = timelineEl?.clientWidth ?? 0;
  const left = viewportWidth > 0 ? Math.max(0, rawLeft - Math.floor(viewportWidth / 3)) : rawLeft;

  api.scrollChart({ left });
  return true;
}
