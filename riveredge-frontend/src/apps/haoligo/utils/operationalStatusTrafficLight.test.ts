import { describe, expect, it } from 'vitest';
import { operationalStatusActiveBulb } from './operationalStatusTrafficLight';

describe('operationalStatusActiveBulb', () => {
  it('maps upkeep to yellow (maintenance caution)', () => {
    expect(operationalStatusActiveBulb('upkeep')).toBe('yellow');
    expect(operationalStatusActiveBulb('保养')).toBe('yellow');
  });
});
