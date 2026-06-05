import { describe, expect, it } from 'vitest';
import {
  evaluateEquipmentMaintenanceAlert,
  isActionableEquipmentMaintenanceRow,
  type EquipmentRow,
} from './equipmentMaintenanceAlert';

const baseEquipment = (over: Partial<EquipmentRow>): EquipmentRow =>
  ({
    id: 1,
    asset_code: 'EQ-TEST',
    name: '测试设备',
    operational_status: 'running',
    used_yield: '0',
    ...over,
  }) as EquipmentRow;

describe('evaluateEquipmentMaintenanceAlert', () => {
  it('returns setup_no_baseline when cycle configured but no upkeep', () => {
    const row = evaluateEquipmentMaintenanceAlert(
      baseEquipment({
        used_yield: '50',
        maintenance_cycle_by_yield: '100',
      }),
      new Map(),
    );
    expect(row?.reminder_kind).toBe('setup_no_baseline');
    expect(isActionableEquipmentMaintenanceRow(row!)).toBe(true);
  });

  it('evaluates days dimension when used_yield is zero', () => {
    const row = evaluateEquipmentMaintenanceAlert(
      baseEquipment({
        used_yield: '0',
        maintenance_cycle_by_days: 30,
      }),
      new Map([['EQ-TEST', '2020-01-01T00:00:00Z']]),
    );
    expect(row?.dominant_dimension).toBe('days');
    expect(row?.alert_level).toBe('critical');
  });
});
