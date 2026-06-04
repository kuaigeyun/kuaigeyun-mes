/**
 * 可视排产冻结窗与工单锁定（与后端 scheduling_freeze 语义一致）
 */

import dayjs, { type Dayjs } from 'dayjs';
import type { WorkOrderForGantt } from '../../../components/GanttSchedulingChart/types';

export function buildFreezeAnchor(freezeHorizonDays: number, now: Dayjs = dayjs()): Dayjs {
  return now.add(Math.max(0, Number(freezeHorizonDays || 0)), 'day').endOf('day');
}

export function isPlannedStartInFreezeWindow(
  plannedStart: string | null | undefined,
  freezeHorizonDays: number,
  freezeAnchor?: Dayjs
): boolean {
  if (!plannedStart) return false;
  const anchor = freezeAnchor ?? buildFreezeAnchor(freezeHorizonDays);
  const start = dayjs(plannedStart);
  return start.isBefore(anchor) || start.isSame(anchor);
}

export function getWorkOrderSchedulingLockReason(
  wo: Pick<WorkOrderForGantt, 'is_frozen' | 'planned_start_date'>,
  freezeHorizonDays: number,
  freezeAnchor?: Dayjs
): 'frozen' | 'freeze_window' | null {
  if (wo.is_frozen) return 'frozen';
  if (isPlannedStartInFreezeWindow(wo.planned_start_date, freezeHorizonDays, freezeAnchor)) {
    return 'freeze_window';
  }
  return null;
}

export function isWorkOrderSchedulingLocked(
  wo: Pick<WorkOrderForGantt, 'is_frozen' | 'planned_start_date'>,
  freezeHorizonDays: number,
  freezeAnchor?: Dayjs
): boolean {
  return getWorkOrderSchedulingLockReason(wo, freezeHorizonDays, freezeAnchor) != null;
}

export function canShiftWorkOrder(
  wo: WorkOrderForGantt,
  freezeHorizonDays: number,
  freezeAnchor?: Dayjs
): boolean {
  if (!wo.planned_start_date || !wo.planned_end_date) return false;
  return !isWorkOrderSchedulingLocked(wo, freezeHorizonDays, freezeAnchor);
}
