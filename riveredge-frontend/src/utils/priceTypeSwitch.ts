import type { PriceTypeValue } from '../components/price-type-switch/PriceTypeSwitch';

type ConvertUnitPriceFn = (
  unitPrice: unknown,
  taxRate: unknown,
  fromPriceType: string,
  toPriceType: string,
) => number;

type FormLike = {
  getFieldValue: (name: string | string[]) => unknown;
  setFieldsValue: (values: Record<string, unknown>) => void;
  setFieldValue?: (name: string | string[], value: unknown) => void;
};

export function setFormPriceType(form: FormLike | null | undefined, priceType: PriceTypeValue): void {
  if (!form) return;
  if (typeof form.setFieldValue === 'function') {
    form.setFieldValue('price_type', priceType);
  } else {
    form.setFieldsValue({ price_type: priceType });
  }
}

/** 切换价类后异步换算明细行单价，不阻塞 Switch 视觉反馈 */
export function deferConvertLineItemsByPriceType(
  form: FormLike | null | undefined,
  fromType: PriceTypeValue,
  toType: PriceTypeValue,
  convertUnitPrice: ConvertUnitPriceFn,
): void {
  if (!form || fromType === toType) return;

  const items = form.getFieldValue('items');
  if (!Array.isArray(items) || items.length === 0) return;

  const snapshot = items;
  queueMicrotask(() => {
    const convertedItems = snapshot.map((row: Record<string, unknown>) => ({
      ...row,
      unit_price: convertUnitPrice(row?.unit_price, row?.tax_rate, fromType, toType),
    }));
    form.setFieldsValue({ items: convertedItems });
  });
}
