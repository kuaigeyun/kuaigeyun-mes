import {
  buildFunctionScopedResourceOptions,
  collectGrantedResourceKeys,
} from './roleGrantedResourceScope';

describe('roleGrantedResourceScope', () => {
  it('collects granted resource keys from function permission codes', () => {
    const keys = collectGrantedResourceKeys([
      'kuaizhizao:sales-order:read',
      'kuaizhizao:quotation:update',
      'kuaizhizao:workspace:read',
    ]);
    expect(keys.has('kuaizhizao:sales-order')).toBe(true);
    expect(keys.has('kuaizhizao:quotation')).toBe(true);
    expect(keys.has('kuaizhizao:workspace')).toBe(false);
  });

  it('builds resource options for data and field tabs', () => {
    const keys = collectGrantedResourceKeys(['kuaizhizao:sales-order:read']);
    const opts = buildFunctionScopedResourceOptions(keys, [], (k) => k);
    expect(opts).toHaveLength(1);
    expect(opts[0].value).toBe('kuaizhizao:sales-order');
  });
});
