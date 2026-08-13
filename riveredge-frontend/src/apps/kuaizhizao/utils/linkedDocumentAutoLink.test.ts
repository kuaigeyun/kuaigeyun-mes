import { describe, expect, it } from 'vitest';

import {
  shouldInjectLinkedDocumentRender,
  resolveLinkedDocumentColumn,
} from './linkedDocumentAutoLink';

describe('shouldInjectLinkedDocumentRender', () => {
  it('does not overwrite stacked primary column that already has render', () => {
    expect(
      shouldInjectLinkedDocumentRender({
        dataIndex: 'quotation_code',
        render: () => null,
      }),
    ).toBe(false);
  });

  it('injects for a plain quotation_code column without render', () => {
    expect(
      shouldInjectLinkedDocumentRender({
        dataIndex: 'quotation_code',
      }),
    ).toBe(true);
    expect(resolveLinkedDocumentColumn('quotation_code')?.documentType).toBe('quotation');
  });

  it('skips when skipLinkedDocumentLink or hideInTable', () => {
    expect(
      shouldInjectLinkedDocumentRender({
        dataIndex: 'quotation_code',
        skipLinkedDocumentLink: true,
      }),
    ).toBe(false);
    expect(
      shouldInjectLinkedDocumentRender({
        dataIndex: 'quotation_code',
        hideInTable: true,
      }),
    ).toBe(false);
  });
});
