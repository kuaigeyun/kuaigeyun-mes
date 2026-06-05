import { describe, expect, it } from 'vitest';
import {
  evaluateMoldMaintenanceAlert,
  isActionableMoldMaintenanceRow,
  type MoldRow,
} from './moldMaintenanceAlert';

const baseMold = (over: Partial<MoldRow>): MoldRow =>
  ({
    id: 1,
    mold_code: 'M-TEST',
    name: '测试模具',
    unit: '件',
    total_manufacture_qty: '0',
    used_yield: '0',
    status: '在用',
    ...over,
  }) as MoldRow;

describe('evaluateMoldMaintenanceAlert', () => {
  it('returns setup_no_cycle when tracking without cycle', () => {
    const row = evaluateMoldMaintenanceAlert(
      baseMold({ used_yield: '10', maintenance_cycle_by_yield: null }),
      new Map(),
    );
    expect(row?.reminder_kind).toBe('setup_no_cycle');
    expect(isActionableMoldMaintenanceRow(row!)).toBe(true);
  });

  it('dual_max picks total_manufacture_qty track', () => {
    const row = evaluateMoldMaintenanceAlert(
      baseMold({
        maintenance_cycle_by_yield: '100',
        used_yield: '10',
        total_manufacture_qty: '95',
      }),
      new Map([['M-TEST', '2024-01-01T00:00:00Z']]),
    );
    expect(row?.dominant_dimension).toBe('yield_total');
    expect(row?.alert_level).toBe('warning');
  });

  it('manual maintenance when status is 保养', () => {
    const row = evaluateMoldMaintenanceAlert(
      baseMold({ status: '保养' }),
      new Map(),
    );
    expect(row?.reminder_kind).toBe('manual_maintenance');
  });
});
