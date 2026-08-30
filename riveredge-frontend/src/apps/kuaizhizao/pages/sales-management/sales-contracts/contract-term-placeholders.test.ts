import { describe, expect, it } from 'vitest';

import {
  applyPlaceholders,
  buildTermPreviewSegments,
  extractFieldBindings,
  extractPlaceholders,
  resolveContractTermFieldBindings,
  formatContractTermHeading,
  intToChineseSimple,
  resolveTermsWithPlaceholders,
  splitUnresolvedPlaceholderSegments,
} from './contract-term-placeholders';

describe('contract-term-placeholders', () => {
  it('extracts manual placeholders but not field bindings', () => {
    expect(extractPlaceholders('结算方式 {@payment_terms}，定金 {定金比例}')).toEqual(['定金比例']);
    expect(extractFieldBindings('结算方式 {@payment_terms}，定金 {定金比例}')).toEqual(['payment_terms']);
  });

  it('resolves field bindings from form values with dictionary labels', () => {
    const bindings = resolveContractTermFieldBindings(
      { payment_terms: 'NET30', 定金比例: '30%' },
      {
        dictionaryLabelsByCode: {
          PAYMENT_TERMS: { NET30: '月结30天' },
        },
      },
      ['payment_terms'],
    );
    expect(bindings).toEqual({ payment_terms: '月结30天' });
  });

  it('merges manual and field binding values when resolving terms', () => {
    const resolved = resolveTermsWithPlaceholders(
      [{ term_name: '付款', template_content: '方式 {@payment_terms}，定金 {定金比例}', content: '' }],
      { 定金比例: '30%' },
      { payment_terms: '月结30天' },
    );
    expect(resolved[0].content).toBe('方式 月结30天，定金 30%');
    expect(resolved[0].placeholder_values).toEqual({ 定金比例: '30%' });
  });

  it('leaves unresolved placeholders visible in preview', () => {
    expect(applyPlaceholders('{@unknown}', {})).toBe('{@unknown}');
  });

  it('splits unresolved placeholders for preview highlighting', () => {
    expect(splitUnresolvedPlaceholderSegments('定金 {定金比例}，交期 {交期}')).toEqual([
      { type: 'text', value: '定金 ' },
      { type: 'placeholder', value: '{定金比例}', filled: false },
      { type: 'text', value: '，交期 ' },
      { type: 'placeholder', value: '{交期}', filled: false },
    ]);
  });

  it('highlights filled and unresolved placeholders from template + resolved content', () => {
    expect(
      buildTermPreviewSegments(
        '方式 月结30天，定金 30%，交期 {交期}',
        '方式 {@payment_terms}，定金 {定金比例}，交期 {交期}',
        { 定金比例: '30%' },
      ),
    ).toEqual([
      { type: 'text', value: '方式 ' },
      { type: 'placeholder', value: '月结30天', filled: true },
      { type: 'text', value: '，定金 ' },
      { type: 'placeholder', value: '30%', filled: true },
      { type: 'text', value: '，交期 ' },
      { type: 'placeholder', value: '{交期}', filled: false },
    ]);
  });

  it('formats contract term heading with chinese index', () => {
    expect(intToChineseSimple(1)).toBe('一');
    expect(intToChineseSimple(11)).toBe('十一');
    expect(formatContractTermHeading(0, '付款方式')).toBe('一、付款方式');
    expect(formatContractTermHeading(1, '交货期限')).toBe('二、交货期限');
  });
});
