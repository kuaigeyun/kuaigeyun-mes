import { normalizeFormListItems } from '../../../utils/formListItems';

const toSafeNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toCents = (value: unknown): number => Math.round(toSafeNumber(value) * 100);
const fromCents = (cents: number): number => cents / 100;

/** 单据明细行价税拆分（与销售/报价/合同/采购明细一致） */
export function calcDocumentLineAmounts(
  qtyInput: unknown,
  priceInput: unknown,
  taxRateInput: unknown,
  priceTypeInput?: string,
) {
  const qty = toSafeNumber(qtyInput);
  const unitPriceCents = toCents(priceInput);
  const taxRate = toSafeNumber(taxRateInput);
  const priceType = priceTypeInput ?? 'tax_exclusive';

  if (priceType === 'tax_inclusive') {
    const inclCents = Math.round(qty * unitPriceCents);
    const exclCents = Math.round(inclCents / (1 + taxRate / 100));
    const taxCents = inclCents - exclCents;
    return {
      excl: fromCents(exclCents),
      tax: fromCents(taxCents),
      incl: fromCents(inclCents),
    };
  }

  const exclCents = Math.round(qty * unitPriceCents);
  const taxCents = Math.round((exclCents * taxRate) / 100);
  return {
    excl: fromCents(exclCents),
    tax: fromCents(taxCents),
    incl: fromCents(exclCents + taxCents),
  };
}

export interface DocumentGoodsTotals {
  totalQuantity: number;
  goodsExcl: number;
  taxAmount: number;
  goodsIncl: number;
}

export interface DocumentTotalsWithDiscount extends DocumentGoodsTotals {
  discountAmount: number;
  goodsAfterDiscount: number;
}

export interface SalesDocumentTotals extends DocumentTotalsWithDiscount {
  customerFees: number;
  ourFees: number;
  estimatedReceivable: number;
}

export interface PurchaseDocumentTotals extends DocumentGoodsTotals {
  otherSideFees: number;
  ourSideFees: number;
  estimatedPayable: number;
  estimatedTotalCost: number;
}

type LineReader = (row: Record<string, unknown>) => {
  qty: unknown;
  price: unknown;
  taxRate: unknown;
};

function sumFeeAmounts(feeDetails: unknown[] | undefined) {
  let otherSideCents = 0;
  let ourSideCents = 0;
  for (const fee of normalizeFormListItems<Record<string, unknown>>(feeDetails)) {
    const feeCents = toCents(fee?.amount);
    if (fee?.bearer === 'other_side') otherSideCents += feeCents;
    else ourSideCents += feeCents;
  }
  return {
    otherSide: fromCents(otherSideCents),
    ourSide: fromCents(ourSideCents),
  };
}

/** 汇总明细行货值、税额、含税货值 */
export function computeDocumentGoodsTotals(
  items: unknown[] | undefined,
  priceType: string | undefined,
  readLine: LineReader,
): DocumentGoodsTotals {
  const rows = normalizeFormListItems<Record<string, unknown>>(items);
  const pt = priceType ?? 'tax_exclusive';
  let totalQuantity = 0;
  let goodsExclCents = 0;
  let taxAmountCents = 0;
  let goodsInclCents = 0;

  for (const row of rows) {
    const { qty, price, taxRate } = readLine(row);
    totalQuantity += toSafeNumber(qty);
    const line = calcDocumentLineAmounts(qty, price, taxRate, pt);
    goodsExclCents += toCents(line.excl);
    taxAmountCents += toCents(line.tax);
    goodsInclCents += toCents(line.incl);
  }

  return {
    totalQuantity,
    goodsExcl: fromCents(goodsExclCents),
    taxAmount: fromCents(taxAmountCents),
    goodsIncl: fromCents(goodsInclCents),
  };
}

/** 整单优惠：从价税合计扣减，不低于 0（对齐用友/金蝶整单折让） */
export function applyDocumentHeaderDiscount(
  goodsIncl: number,
  discountAmountInput: unknown,
): Pick<DocumentTotalsWithDiscount, 'discountAmount' | 'goodsAfterDiscount'> {
  const inclCents = toCents(goodsIncl);
  const discountCents = Math.min(Math.max(0, toCents(discountAmountInput)), inclCents);
  return {
    discountAmount: fromCents(discountCents),
    goodsAfterDiscount: fromCents(inclCents - discountCents),
  };
}

export function computeDocumentTotalsWithDiscount(
  items: unknown[] | undefined,
  priceType: string | undefined,
  quantityField: string,
  discountAmountInput?: unknown,
): DocumentTotalsWithDiscount {
  const goods = computeDocumentGoodsTotals(items, priceType, (row) => ({
    qty: row[quantityField],
    price: row.unit_price,
    taxRate: row.tax_rate,
  }));
  const discount = applyDocumentHeaderDiscount(goods.goodsIncl, discountAmountInput);
  return { ...goods, ...discount };
}

/** 销售类单据：优惠后货值 + 对方承担费用 = 预计应收 */
export function computeSalesDocumentTotals(
  items: unknown[] | undefined,
  feeDetails: unknown[] | undefined,
  priceType: string | undefined,
  quantityField: string,
  discountAmountInput?: unknown,
): SalesDocumentTotals {
  const withDiscount = computeDocumentTotalsWithDiscount(
    items,
    priceType,
    quantityField,
    discountAmountInput,
  );
  const fees = sumFeeAmounts(feeDetails);
  const estimatedReceivableCents =
    toCents(withDiscount.goodsAfterDiscount) + toCents(fees.otherSide);

  return {
    ...withDiscount,
    customerFees: fees.otherSide,
    ourFees: fees.ourSide,
    estimatedReceivable: fromCents(estimatedReceivableCents),
  };
}

/** 采购类单据：应付 = 含税货值 + 对方费用；总成本 = 含税货值 + 我方成本 */
export function computePurchaseDocumentTotals(
  items: unknown[] | undefined,
  feeDetails: unknown[] | undefined,
  priceType: string | undefined,
  quantityField = 'ordered_quantity',
): PurchaseDocumentTotals {
  const goods = computeDocumentGoodsTotals(items, priceType, (row) => ({
    qty: row[quantityField],
    price: row.unit_price,
    taxRate: row.tax_rate,
  }));
  const fees = sumFeeAmounts(feeDetails);
  const estimatedPayableCents = toCents(goods.goodsIncl) + toCents(fees.otherSide);
  const estimatedTotalCostCents = toCents(goods.goodsIncl) + toCents(fees.ourSide);

  return {
    ...goods,
    otherSideFees: fees.otherSide,
    ourSideFees: fees.ourSide,
    estimatedPayable: fromCents(estimatedPayableCents),
    estimatedTotalCost: fromCents(estimatedTotalCostCents),
  };
}

export function formatDocumentMoneyYuan(n: number): string {
  return `¥${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
