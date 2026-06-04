import {
  canonicalizeFieldName,
  resolveFieldMaskLevel,
  type UserFieldMaskMap,
} from '../utils/fieldMaskPermission';

describe('fieldMaskPermission', () => {
  const masks: UserFieldMaskMap = {
    'kuaizhizao:quotation': {
      tax_amount: 'full',
      unit_price: 'masked',
    },
  };

  it('resolves full mask for tax_amount on quotation', () => {
    expect(resolveFieldMaskLevel(masks, 'kuaizhizao:quotation', 'tax_amount')).toBe('full');
  });

  it('canonicalizes untaxed_amount to amount_without_tax key', () => {
    expect(canonicalizeFieldName('untaxed_amount')).toBe('amount_without_tax');
  });
});
