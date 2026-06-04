import { describe, expect, it } from 'vitest';
import dayjs from 'dayjs';
import { buildFreezeAnchor, canShiftWorkOrder, isWorkOrderSchedulingLocked } from './freezeUtils';

describe('freezeUtils', () => {
  it('locks work order in freeze window', () => {
    const anchor = buildFreezeAnchor(2, dayjs('2026-06-06').endOf('day'));
    const wo = { is_frozen: false, planned_start_date: '2026-06-05T08:00:00' };
    expect(isWorkOrderSchedulingLocked(wo, 2, anchor)).toBe(true);
  });

  it('allows shift when outside freeze window', () => {
    const anchor = buildFreezeAnchor(2, dayjs('2026-06-06').endOf('day'));
    const wo = {
      is_frozen: false,
      planned_start_date: '2026-06-10T08:00:00',
      planned_end_date: '2026-06-12T08:00:00',
    };
    expect(canShiftWorkOrder(wo, 2, anchor)).toBe(true);
  });
});
