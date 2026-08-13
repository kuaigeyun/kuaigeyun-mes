import { describe, expect, it } from 'vitest';

import {
  shouldInjectLinkedDocumentRender,
  resolveLinkedDocumentColumn,
  resolveLinkedDocumentFromRecord,
  resolveStackedSecondaryLinkedDocument,
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

describe('resolveLinkedDocumentColumn', () => {
  it('accepts camelCase dataIndex', () => {
    expect(resolveLinkedDocumentColumn('purchaseReceiptCode')?.documentType).toBe('purchase_receipt');
    expect(resolveLinkedDocumentColumn('purchaseReceiptCode')?.idField).toBe('purchase_receipt_id');
  });

  it('maps original_work_order_code to work_order', () => {
    expect(resolveLinkedDocumentColumn('original_work_order_code')).toEqual({
      documentType: 'work_order',
      idField: 'original_work_order_id',
      codeField: 'original_work_order_code',
    });
  });

  it('maps related_demand_code to demand', () => {
    expect(resolveLinkedDocumentColumn('related_demand_code')).toEqual({
      documentType: 'demand',
      idField: 'related_demand_id',
      codeField: 'related_demand_code',
    });
  });

  it('maps freight_order_code to freight_order', () => {
    expect(resolveLinkedDocumentColumn('freight_order_code')).toEqual({
      documentType: 'freight_order',
      idField: 'freight_order_id',
      codeField: 'freight_order_code',
    });
  });
});

describe('resolveStackedSecondaryLinkedDocument', () => {
  it('links stacked secondary purchase receipt by keys and camelCase id', () => {
    const resolved = resolveStackedSecondaryLinkedDocument(
      {
        purchase_receipt_code: 'CGSD202607200002',
        purchaseReceiptId: 88,
      },
      'CGSD202607200002',
      ['purchase_receipt_code', 'purchaseReceiptCode'],
    );
    expect(resolved).toEqual({
      documentType: 'purchase_receipt',
      documentId: 88,
      code: 'CGSD202607200002',
    });
  });

  it('does not link material codes', () => {
    expect(
      resolveStackedSecondaryLinkedDocument(
        { material_code: '00000001', material_id: 3 },
        '00000001',
        ['material_code'],
      ),
    ).toBeNull();
  });
});

describe('resolveLinkedDocumentFromRecord', () => {
  it('reads camelCase id when snake is missing', () => {
    const binding = resolveLinkedDocumentColumn('work_order_code');
    expect(binding).not.toBeNull();
    expect(
      resolveLinkedDocumentFromRecord(binding!, {
        work_order_code: 'WO1',
        workOrderId: 12,
      }),
    ).toEqual({ documentType: 'work_order', documentId: 12, code: 'WO1' });
  });
});
