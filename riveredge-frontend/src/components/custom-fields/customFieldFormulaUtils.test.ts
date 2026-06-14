import { describe, expect, it } from 'vitest';
import {
  evaluateCustomFieldFormula,
  extractFormulaFieldCodes,
  substituteFormulaExpression,
} from './customFieldFormulaUtils';

describe('customFieldFormulaUtils', () => {
  it('extracts field codes from expression', () => {
    expect(extractFormulaFieldCodes('{212} * 2 + {qty}')).toEqual(['212', 'qty']);
  });

  it('substitutes operand values', () => {
    expect(substituteFormulaExpression('{212} * 2', { '212': 2 })).toBe('2 * 2');
  });

  it('evaluates formula result', () => {
    expect(evaluateCustomFieldFormula('{212} * 2', { '212': 2 })).toBe(4);
  });

  it('treats missing operands as zero', () => {
    expect(evaluateCustomFieldFormula('{missing} + 1', {})).toBe(1);
  });
});
